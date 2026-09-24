import React, { useState, useEffect, useRef } from 'react';
import { connectCommands } from './commands';
import { VoicePanel } from './ContinuousVoicePanel';
import { ModelSettings } from './ModelSettings';
import { createRoot } from 'react-dom/client';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './style.css';

const key = 'voice-canvas-v1';
let saved;
try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
let timer;
function save(elements, appState, files) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ elements, files, appState: {
        viewBackgroundColor: appState.viewBackgroundColor,
      }}));
      document.getElementById('status').textContent = '已保存到当前浏览器';
    } catch {
      document.getElementById('status').textContent = '本地保存失败，请通过菜单导出画布';
    }
  }, 300);
}
function App() {
 const [api,setApi]=useState(null);
 const host=useRef(null);
 useEffect(()=>api?connectCommands(api,host.current):undefined,[api]);
 return (
  <main>
    <header><strong>对话画布</strong><span>先把想法放下来，自由连线与整理</span><small id="status">本地画布</small><ModelSettings/></header>
    <VoicePanel/>
    <section ref={host}><Excalidraw excalidrawAPI={setApi} langCode="zh-CN" initialData={saved || undefined} onChange={save}/></section>
  </main>
 );
}
createRoot(document.getElementById('root')).render(<App/>);
