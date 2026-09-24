import React,{useState} from 'react';
function DebugEntry({entry}){
  const [open,setOpen]=useState(false);
  return <div className="debug-event"><button aria-expanded={open} onClick={()=>setOpen(!open)}><time>{new Date(entry.time).toLocaleTimeString('zh-CN',{hour12:false})}</time> {entry.event}{entry.elapsedMs!==undefined?` · ${entry.elapsedMs} ms`:''}{entry.decision?` · ${entry.decision}`:''}</button>{open&&<pre>{JSON.stringify(entry,null,2)}</pre>}</div>;
}
export function DebugPanel({entries,onClear}){
  const [open,setOpen]=useState(false);
  return <div className="debug-panel"><button aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'▾':'▸'} Debug · 判断与执行记录（{entries.length}）</button>
    {open&&<div>
    <div className="debug-toolbar"><span>仅当前页面内存，最多 200 条；含转写原文，刷新清空，不记录密钥。</span><button onClick={onClear}>清空记录</button></div>
    <div className="debug-events">{entries.length?entries.slice().reverse().map(entry=><DebugEntry key={entry.id} entry={entry}/>):<p>开始说话或加入文字后，这里会显示各阶段的输入、结果与耗时。</p>}</div>
    </div>}
  </div>;
}
