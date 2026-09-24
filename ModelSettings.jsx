import React, {useEffect, useState} from 'react';

async function request(path, body) {
  const response=await fetch('/api/thinking/'+path,body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : undefined);
  const data=await response.json();
  if(!response.ok) throw Error(data.error || '请求失败');
  return data;
}
export function ModelSettings() {
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState({baseUrl:'',model:'',apiKey:''});
  const [saved,setSaved]=useState(null);
  const [models,setModels]=useState([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{if(!open)return;setBusy(true);request('settings').then(data=>{
    setSaved(data);setForm({baseUrl:data.baseUrl,model:data.model,apiKey:'',clearKey:false});setModels([]);setMessage('');
  }).catch(e=>setMessage(e.message)).finally(()=>setBusy(false));},[open]);
  const change=(key,value)=>{setForm(old=>({...old,[key]:value,...(key==='baseUrl'?{apiKey:'',model:''}:{})}));setModels([]);};
  async function run(save) {
    setBusy(true);setMessage('');
    try {
      const result=await request(save?'settings':'models',form);
      if(save){setSaved(result);setForm(old=>({...old,apiKey:'',clearKey:false}));setMessage('已保存，立即生效');}
      else {setModels(result.models);setForm(old=>({...old,model:result.models.includes(old.model)?old.model:result.models[0]}));setMessage(`已获取 ${result.models.length} 个模型，请选择后保存`);}
    } catch(error){setMessage(error.message);} finally {setBusy(false);}
  }
  return <div className="model-settings">
    <button onClick={()=>setOpen(!open)} aria-expanded={open}>模型设置</button>
    {open && <div className="model-settings-popover" role="dialog" aria-label="模型设置">
      <h3>整理模型 · OpenAI 兼容接口</h3>
      <label>Base URL（通常以 /v1 结尾）<input type="url" value={form.baseUrl} disabled={busy} placeholder="https://服务地址/v1" onChange={e=>change('baseUrl',e.target.value)}/></label>
      <label>API Key<input type="password" autoComplete="new-password" value={form.apiKey} disabled={busy} placeholder={saved?.hasApiKey&&form.baseUrl===saved.baseUrl?'已保存，留空保持原密钥':'输入密钥；无认证的本地服务可留空'} onChange={e=>change('apiKey',e.target.value)}/></label>
      <label className="key-clear"><input type="checkbox" checked={!!form.clearKey} disabled={busy} onChange={e=>change('clearKey',e.target.checked)}/>清除已保存的密钥</label>
      <button disabled={busy||!form.baseUrl} onClick={()=>run(false)}>{busy?'处理中…':'获取模型列表'}</button>
      <label>模型 ID<select value={form.model} disabled={busy||!models.length} onChange={e=>setForm({...form,model:e.target.value})}>
        {!models.length && <option value={form.model}>{form.model||'请先获取模型列表'}</option>}
        {models.map(id=><option key={id} value={id}>{id}</option>)}
      </select></label>
      <p>密钥仅保存在本机服务端配置文件（明文、仅当前用户可读写），不保存到浏览器或画布。模型列表可获取不代表所有模型都支持文本整理。</p>
      <button disabled={busy||!models.includes(form.model)} onClick={()=>run(true)}>保存设置</button>{' '}
      <button disabled={busy} onClick={()=>{setOpen(false);setForm(old=>({...old,apiKey:''}));}}>关闭</button>
      <p role="status">{message}</p>
    </div>}
  </div>;
}
