import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export function endpoint(baseUrl, suffix) {
  const url = new URL(baseUrl);
  if (url.username || url.password || url.search || url.hash) throw Error('接口地址不能包含账号、查询参数或片段');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw Error('远程接口必须使用 HTTPS');
  return url.href.replace(/\/$/, '') + suffix;
}

export async function createModelSettings(config, directory = join(homedir(), '.config', 'voice-canvas')) {
  const file = join(directory, 'model.json');
  let current = {baseUrl:config.CANVAS_LLM_BASE_URL || '', model:config.CANVAS_LLM_MODEL || '', apiKey:config.CANVAS_LLM_API_KEY || ''};
  try { current = JSON.parse(await readFile(file,'utf8')); } catch (error) { if(error.code !== 'ENOENT') throw Error('无法读取本地模型设置'); }
  const publicValue = () => ({baseUrl:current.baseUrl, model:current.model, hasApiKey:!!current.apiKey});
  const candidate = input => {
    if(typeof input.baseUrl !== 'string' || typeof input.model !== 'string' || (input.apiKey !== undefined && typeof input.apiKey !== 'string')) throw Error('设置格式不正确');
    const baseUrl=input.baseUrl.trim().replace(/\/$/,'');
    endpoint(baseUrl,'/models');
    if(input.model.length>200 || (input.apiKey?.length || 0)>4096) throw Error('设置内容过长');
    // Never forward a saved key to a changed endpoint without explicit re-entry.
    return {baseUrl,model:input.model,apiKey:input.clearKey ? '' : (input.apiKey || (baseUrl===current.baseUrl ? current.apiKey : ''))};
  };
  return {
    get:()=>({...current}), publicValue,
    async models(input) {
      const value=candidate(input);
      const response=await fetch(endpoint(value.baseUrl,'/models'),{redirect:'error',signal:AbortSignal.timeout(15000),headers:value.apiKey?{Authorization:`Bearer ${value.apiKey}`}:{}});
      if(!response.ok) throw Error(`获取模型失败：HTTP ${response.status}`);
      const data=await response.json();
      if(!Array.isArray(data.data)) throw Error('接口未返回兼容的模型列表 data[]');
      const models=[...new Set(data.data.map(item=>item.id).filter(id=>typeof id==='string' && id.length>0 && id.length<=200))].sort();
      if(!models.length) throw Error('接口返回的模型列表为空');
      return {models};
    },
    async save(input) {
      const value=candidate(input);
      if(!value.model) throw Error('请先选择模型');
      await mkdir(directory,{recursive:true,mode:0o700});
      const temp=file+'.tmp';
      await writeFile(temp,JSON.stringify(value),{mode:0o600});
      await rename(temp,file);
      current=value;
      return publicValue();
    }
  };
}
