import React, { useState, useRef, useEffect } from 'react';
import { parseVoiceCommand } from './voice-command';
export function VoicePanel() {
  const [text,setText]=useState(''),[phase,setPhase]=useState('idle'),[message,setMessage]=useState('本地 transcribe · 点击录音，说完后停止');
  const recorder=useRef(null), stream=useRef(null), timer=useRef(null), alive=useRef(true);
  useEffect(()=>()=>{alive.current=false;clearTimeout(timer.current);stream.current?.getTracks().forEach(t=>t.stop());},[]);
  async function record() {
    if(phase==='recording'){recorder.current.stop();return;}
    setPhase('requesting');setMessage('正在请求麦克风权限…');
    try {
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('当前浏览器不支持录音，请使用 Chrome 打开本地画布');
      stream.current=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!alive.current){stream.current.getTracks().forEach(t=>t.stop());return;}
      const mimeType=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
      const r=new MediaRecorder(stream.current,mimeType?{mimeType}:undefined);recorder.current=r;
      const chunks=[];r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      r.onstop=async()=>{
        clearTimeout(timer.current);stream.current?.getTracks().forEach(t=>t.stop());
        if(!alive.current)return;
        setPhase('transcribing');setMessage('正在用本机 transcribe 转写…');
        try {
          const response=await fetch('/api/transcribe',{method:'POST',headers:{'Content-Type':r.mimeType||'audio/webm'},body:new Blob(chunks),signal:AbortSignal.timeout(155000)});
          const data=await response.json();if(!response.ok)throw Error(data.error);
          if(!alive.current)return;
          setText(data.text);setMessage(data.text?`转写完成（${data.elapsedSec ?? '?'} 秒），可修改后点击执行`:'未识别到语音，请重试');
        } catch(error){if(alive.current)setMessage(error.message);}
        finally {if(alive.current)setPhase('idle');}
      };
      r.start();setPhase('recording');setMessage('正在录音，点击停止；最长 60 秒');
      timer.current=setTimeout(()=>{if(r.state==='recording')r.stop();},60000);
    } catch(error) {stream.current?.getTracks().forEach(t=>t.stop());setPhase('idle');setMessage(`无法录音：${error.message}`);}
  }
  async function execute() {
    setPhase('executing');
    try {
      const invoke=async command=>{const r=await fetch('/api/canvas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command)});const data=await r.json();if(!r.ok)throw Error(data.error);return data.result;};
      const state=await invoke({op:'state'});
      const command=parseVoiceCommand(text,state.selectedIds);
      await invoke(command);setMessage(`已执行：${text}`);setText('');
    }catch(error){setMessage(error.message);}finally{setPhase('idle');}
  }
  return <aside className="voice-panel">
    <div className="voice-row"><button onClick={record} disabled={!['idle','recording'].includes(phase)}>{phase==='recording'?'停止录音':'开始录音'}</button>
      <input aria-label="语音口令" value={text} onChange={e=>setText(e.target.value)} placeholder="例如：加一条，保留人的主动性" disabled={phase!=='idle'} onKeyDown={e=>{if(e.key==='Enter'&&phase==='idle')execute();}}/>
      <button onClick={execute} disabled={phase!=='idle'||!text.trim()}>执行口令</button></div>
    <div className="voice-status" role="status">{message}</div>
  </aside>;
}
