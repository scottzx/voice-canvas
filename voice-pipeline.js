export class VoicePipeline {
  constructor({request,render,notify,debug=()=>{},silenceMs=15000}){Object.assign(this,{request,render,notify,debug,silenceMs});this.parts=[];this.audio=[];this.version=0;this.speaking=false;this.busy=false;this.disposed=false;this.attempted=-1;this.batch=null;this.forcePending=false;this.timer=null;}
  trace(event,data={}){if(!this.disposed)this.debug({time:new Date().toISOString(),event,version:this.version,...data});}
  emit(message){if(message)this.trace('流程状态',{message,queued:this.audio.length,pendingChars:this.parts.join('\n').length});if(!this.disposed)this.notify({text:this.parts.join('\n'),queued:this.audio.length,busy:this.busy,paused:!!this.paused,message});}
  armFallback(elapsedMs=0){clearTimeout(this.timer);if(this.paused)return;this.timer=setTimeout(()=>{if(this.paused||this.disposed||this.speaking||(!this.parts.length&&!this.audio.length))return;this.forcePending=true;this.attempted=-1;this.emit('已连续静音 15 秒，准备发送待处理内容…');this.forceJudge?.({decision:'complete'});this.pump();},Math.max(0,this.silenceMs-elapsedMs));}
  speakingChanged(value,elapsedMs=0){this.speaking=value;if(value){this.version++;clearTimeout(this.timer);this.forcePending=false;}else{this.armFallback(elapsedMs);this.pump();}this.trace(value?'检测到说话：重置静音计时':'说话停止：启动静音计时',{remainingMs:value?null:Math.max(0,this.silenceMs-elapsedMs)});}
  segment(blob){this.audio.push(blob);this.version++;this.trace('音频入队',{bytes:blob.size,mimeType:blob.type,queued:this.audio.length});this.pump();}
  add(text){if(text.trim()){this.parts.push(text.trim());this.version++;this.trace('文字入池',{text:text.trim()});if(!this.speaking)this.armFallback();this.pump();}}
  retry(){this.paused=false;this.attempted=-1;this.pump();}
  async pump(){
    if(this.busy||this.disposed||this.paused)return;this.busy=true;let failed=false;
    try {
      while(this.audio.length){this.emit('正在本地转写…');const result=await this.request('transcribe',this.audio[0]);if(this.disposed)return;this.audio.shift();if(result.text?.trim())this.parts.push(result.text.trim());this.version++;this.emit(result.text?'原话已加入待处理池':result.reason==='no_speech'?'未检测到有效人声，已跳过该段':'未识别到文字');}
      if(this.speaking||!this.parts.length||this.attempted===this.version)return;
      const version=this.version,text=this.parts.join('\n'),count=this.parts.length;this.attempted=version;
      if(text.length>1500)throw Error('超过 1500 字，请停止监听并拆分待处理文字');
      let forced=this.forcePending;this.forcePending=false;
      this.emit(forced?'静音兜底：正在发送原话…':'Laya 正在判断是否说完…');
      let judgment;
      try{judgment=forced?{decision:'complete'}:await Promise.race([this.request('judge',{text}),new Promise(resolve=>{this.forceJudge=resolve;})]);}finally{this.forceJudge=null;}
      if(this.disposed||this.speaking||version!==this.version){this.trace('丢弃过期判断',{requestVersion:version,currentVersion:this.version,speaking:this.speaking});return;}
      if(this.forcePending){forced=true;this.forcePending=false;}
      this.trace('最终发送决策',{source:forced?'15 秒静音兜底':'Laya',decision:forced?'send':judgment.decision==='complete'?'send':'wait',text});
      if(!forced&&judgment.decision!=='complete'){this.emit('Laya：继续等待；连续静音 15 秒后自动发送，可以接着说。');return;}
      clearTimeout(this.timer);
      this.emit(forced?'静音 15 秒兜底，正在整理节点和关系…':'已判定完整，正在整理节点和关系…');
      if(!this.batch||this.batch.text!==text){const result=await this.request('organize',{text});this.batch={text,diagram:result.diagram,batchId:crypto.randomUUID()};}
      if(this.disposed||this.speaking||version!==this.version){this.trace('暂不渲染过期整理结果',{requestVersion:version,currentVersion:this.version,speaking:this.speaking});return;}
      this.emit('正在渲染画布…');await this.render({...this.batch,sourceText:text,op:'renderDiagram'});
      if(this.disposed)return;this.parts.splice(0,count);this.batch=null;this.emit('已生成节点和关系；原话保存在生成元素中');
    }catch(error){failed=true;this.paused=true;clearTimeout(this.timer);this.forcePending=false;this.emit(`未完成：${error.message}。内容保留，自动处理已暂停，请点击重试。`);}
    finally{this.busy=false;this.emit();if(!failed&&!this.disposed&&!this.speaking&&(this.audio.length||(this.parts.length&&(this.forcePending||this.attempted!==this.version))))queueMicrotask(()=>this.pump());}
  }
  replace(text){if(this.busy||this.speaking||this.audio.length)return;clearTimeout(this.timer);this.forcePending=false;this.parts=text.trim()?[text.trim()]:[];this.batch=null;this.version++;this.emit('待处理文字已更新');}
  dispose(){this.disposed=true;clearTimeout(this.timer);}
}
