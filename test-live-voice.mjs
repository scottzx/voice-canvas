// Explicit live integration test: synthetic speech, local ASR/Laya, configured LLM, real browser canvas.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {VoicePipeline} from './voice-pipeline.js';
const exec=promisify(execFile),dir=await mkdtemp(join(tmpdir(),'canvas-live-voice-'));
let lastMessage='',rendered;
async function request(path,body){const audio=path==='transcribe';const res=await fetch('http://127.0.0.1:5178'+(audio?'/api/transcribe':path==='canvas'?'/api/canvas':'/api/thinking/'+path),{method:'POST',headers:{'Content-Type':audio?'audio/wav':'application/json'},body:audio?body:JSON.stringify(body),signal:AbortSignal.timeout(160000)});const data=await res.json();if(!res.ok)throw Error(data.error);if(path==='judge')console.log('Laya:',data.decision,'threshold:',data.threshold);return data;}
const pipeline=new VoicePipeline({request,render:async body=>{rendered=await request('canvas',body);const twice=await request('canvas',body);assert.equal(twice.result.deduplicated,true);assert.equal(twice.result.elements.length,rendered.result.elements.length);},notify:state=>{if(state.message&&lastMessage!==state.message){lastMessage=state.message;console.log(state.message);}}});
try{
  await exec('say',['-v','Tingting','-o',join(dir,'speech.aiff'),'创建两个方框，一个叫人的主动性，另一个叫语音操作。从人的主动性画一条线连接到语音操作。']);
  await exec('ffmpeg',['-v','error','-i',join(dir,'speech.aiff'),'-ar','16000','-ac','1',join(dir,'speech.wav')]);
  pipeline.speakingChanged(true);pipeline.segment(new Blob([await readFile(join(dir,'speech.wav'))],{type:'audio/wav'}));pipeline.speakingChanged(false);
  const start=Date.now();while(!rendered&&Date.now()-start<180000){await new Promise(r=>setTimeout(r,250));if(!pipeline.busy&&lastMessage.startsWith('未完成'))throw Error(lastMessage);}
  assert.ok(rendered,'live pipeline timeout');assert.ok(rendered.result.createdIds.length>=3);console.log('PASS: synthetic audio → local ASR → Laya / 15-second fallback → configured LLM → real canvas; duplicate batch skipped');
}finally{pipeline.dispose();await rm(dir,{recursive:true,force:true});}
