import React,{useState,useRef,useEffect} from 'react';
import {startCapture} from './voice-capture';
import {VoicePipeline} from './voice-pipeline';
import {DebugPanel} from './DebugPanel';
async function request(path,body){
  const audio=path==='transcribe';
  const response=await fetch(audio?'/api/transcribe':path==='canvas'?'/api/canvas':'/api/thinking/'+path,{method:'POST',headers:{'Content-Type':audio?'audio/wav':'application/json'},body:audio?body:JSON.stringify(body),signal:AbortSignal.timeout(160000)});
  const data=await response.json();if(!response.ok){const error=Error(data.error||'请求失败');error.stage=data.stage;error.exitCode=data.exitCode;error.signal=data.signal;throw error;}return data;
}
export function VoicePanel(){
  const [listening,setListening]=useState(false),[speaking,setSpeaking]=useState(false),[starting,setStarting]=useState(false),[input,setInput]=useState('');
  const [state,setState]=useState({text:'',busy:false,queued:0,message:'点击开始监听；停顿后自动判断、整理并绘图'});
  const [entries,setEntries]=useState([]);
  const log=entry=>{if(alive.current)setEntries(old=>[...old.slice(-199),{...entry,id:crypto.randomUUID(),time:entry.time||new Date().toISOString()}]);};
  const pipeline=useRef(null),stop=useRef(null),alive=useRef(true);
  useEffect(()=>{
    alive.current=true;
    const labels={transcribe:'本地转写',judge:'Laya 判断',organize:'大模型整理',canvas:'画布渲染'};
    const tracedRequest=async(path,body)=>{
      const requestId=crypto.randomUUID(),start=performance.now();
      log({event:labels[path]+' · 请求',requestId,...(path==='transcribe'?{bytes:body.size}:path==='canvas'?{batchId:body.batchId,diagram:body.diagram}:{text:body.text})});
      try{
        const result=await request(path,body);
        const details=path==='canvas'?{createdIds:result.result?.createdIds,deduplicated:!!result.result?.deduplicated}:path==='judge'?{decision:result.decision,label:result.label,probabilities:result.probabilities,confidence:result.confidence,threshold:result.threshold,model:result.model}:path==='organize'?{diagram:result.diagram,model:result.model}:{text:result.text,engine:result.engine,elapsedSec:result.elapsedSec};
        log({event:labels[path]+' · 返回',requestId,elapsedMs:Math.round(performance.now()-start),...details,...(path==='transcribe'?{reason:result.reason}: {})});return result;
      }catch(error){log({event:labels[path]+' · 错误',requestId,elapsedMs:Math.round(performance.now()-start),error:error.message,stage:error.stage,exitCode:error.exitCode,signal:error.signal});throw error;}
    };
    pipeline.current=new VoicePipeline({request:tracedRequest,render:body=>tracedRequest('canvas',body),debug:log,notify:value=>{
      try{localStorage.setItem('voice-canvas-pending',value.text);}catch{}
      setState(old=>({...old,...value,message:value.message||old.message}));
    }});
    try{pipeline.current.replace(localStorage.getItem('voice-canvas-pending')||'');}catch{}
    const warn=event=>{if(pipeline.current.audio.length||pipeline.current.busy){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',warn);
    return()=>{alive.current=false;pipeline.current.dispose();stop.current?.();window.removeEventListener('beforeunload',warn);};
  },[]);
  async function toggle(){
    if(stop.current){stop.current();stop.current=null;setListening(false);return;}setStarting(true);
    try{const close=await startCapture({onSpeaking:(value,elapsedMs)=>{if(!alive.current)return;setSpeaking(value);pipeline.current.speakingChanged(value,elapsedMs);},onSegment:blob=>{if(alive.current)pipeline.current.segment(blob);},onError:message=>{setListening(false);stop.current=null;setState(old=>({...old,message}));}});if(!alive.current){close();return;}stop.current=close;setListening(true);}
    catch(error){log({event:'麦克风错误',error:error.message});setState(old=>({...old,message:'无法启动麦克风：'+error.message}));}finally{if(alive.current)setStarting(false);}
  }
  return <aside className="voice-panel">
    <div className="voice-row"><button onClick={toggle} disabled={starting}>{listening?'停止监听':starting?'请求麦克风…':'开始监听'}</button>
      <span className={'voice-indicator '+(speaking?'speaking':listening?'listening':'')}>{speaking?'● 正在说话':listening?'● 正在监听':'○ 已停止'}</span>
      <input aria-label="补充文字" value={input} onChange={e=>setInput(e.target.value)} placeholder="也可输入完整想法，测试判断和绘图"/>
      <button disabled={!input.trim()} onClick={()=>{pipeline.current.add(input);setInput('');}}>加入待处理池</button></div>
    <div className="voice-status" role="status">{state.message}{state.queued>0?`（${state.queued} 段音频待转写）`:''}</div>
    {state.paused&&<div role="alert">自动处理已暂停；内容保留。请展开待处理原话，点击「重新判断 / 重试」。</div>}
    <details><summary>待处理原话（{state.text.length} 字）</summary><textarea aria-label="待处理原话" value={state.text} disabled={state.busy||listening||state.queued>0} onChange={e=>pipeline.current.replace(e.target.value)}/>
      <button disabled={state.busy||speaking||(!state.text&&!state.queued)} onClick={()=>pipeline.current.retry()}>重新判断 / 重试</button></details>
    <DebugPanel entries={entries} onClear={()=>setEntries([])}/>
  </aside>;
}
