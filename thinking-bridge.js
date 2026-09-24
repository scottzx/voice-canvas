import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateDiagram, diagramSchema } from './diagram-schema';
import { createModelSettings, endpoint } from './model-settings';
import {parseModelDiagram} from './model-output';

export function installThinkingBridge(server, config) {
  const settingsReady=createModelSettings(config);
  settingsReady.catch(()=>{});
  let worker;
  const pending=new Map();
  function judge(text) {
    if(!worker) {
      worker=spawn(config.LAYA_PYTHON||resolve('../laya/.venv/bin/python'),[resolve('laya-worker.py')],{stdio:['pipe','pipe','pipe']});
      const fail=()=>{worker=null;for(const cb of [...pending.values()])cb({error:'Laya worker stopped; check local Python and weights'});};
      worker.on('error',fail);worker.on('exit',fail);
      // Warnings are kept server-side; never log speech or API keys.
      worker.stderr.on('data',()=>{});
      createInterface({input:worker.stdout}).on('line',line=>{try{const msg=JSON.parse(line);pending.get(msg.id)?.(msg);}catch{}});
    }
    return new Promise((resolve,reject)=>{
      const id=randomUUID();
      const timer=setTimeout(()=>{pending.delete(id);reject(Error('Laya 判断超时'));},60000);
      pending.set(id,msg=>{clearTimeout(timer);pending.delete(id);msg.error?reject(Error(msg.error)):resolve(msg.result);});
      worker.stdin.write(JSON.stringify({id,text})+'\n',error=>{if(error)pending.get(id)?.({error:error.message});});
    });
  }
  server.httpServer.once('close',()=>worker?.kill());
  server.middlewares.use('/api/thinking',async(req,res)=>{
    const send=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
    if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host||'')||(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`))return send(403,{error:'Local requests only'});
    res.setHeader('Cache-Control','no-store');
    if(req.method==='GET' && ['/status','/settings'].includes(req.url)) {
      try { const value=(await settingsReady).publicValue();return send(200,{...value,configured:!!(value.baseUrl&&value.model)}); }
      catch { return send(500,{error:'无法读取本地模型配置'}); }
    }
    if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json'))return send(405,{error:'POST JSON required'});
    try {
      let body='';for await(const chunk of req){body+=chunk;if(body.length>12000)return send(413,{error:'文本过长'});}
      const input=JSON.parse(body);
      const settings=await settingsReady;
      if(req.url==='/models')return send(200,await settings.models(input));
      if(req.url==='/settings')return send(200,await settings.save(input));
      const {text}=input;
      if(typeof text!=='string'||!text.trim()||text.length>1500)return send(400,{error:'待处理内容须为 1–1500 字；长段请先分段'});
      if(req.url==='/judge')return send(200,await judge(text));
      if(req.url!=='/organize')return send(404,{error:'Unknown endpoint'});
      const modelConfig=settings.get();
      if(!modelConfig.baseUrl||!modelConfig.model)return send(503,{error:'请先在模型设置中配置接口并选择模型，原话已保留'});
      const response=await fetch(endpoint(modelConfig.baseUrl,'/chat/completions'),{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',...(modelConfig.apiKey?{Authorization:`Bearer ${modelConfig.apiKey}`}:{})},signal:AbortSignal.timeout(60000),body:JSON.stringify({model:modelConfig.model,response_format:{type:'json_object'},messages:[
        {role:'system',content:`你是忠实的思考整理助手。仅整理用户原话，不添加原话没有的主张。消除口头填充词、提炼简洁中文标题。默认节点 appearance=box；用户要求无边框则 text。仅输出符合以下 JSON Schema 的 JSON 对象；节点 ID 为本次结果内的简短英文标识，关系只引用这些 ID。关系必须有原话依据；不明确就留空。没有工具权限，不返回坐标、代码、画布操作或额外字段。Schema: ${JSON.stringify(diagramSchema)}`},
        {role:'user',content:text}
      ]})});
      if(!response.ok)throw Error(`大模型接口返回 HTTP ${response.status}，原话已保留`);
      const data=await response.json();
      const content=data.choices?.[0]?.message?.content;
      if(typeof content!=='string')throw Error('大模型未返回文本 JSON');
      send(200,{diagram:parseModelDiagram(content),model:modelConfig.model});
    }catch(error){send(500,{error:error.message});}
  });
}
