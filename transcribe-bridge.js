import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const run = promisify(execFile);
export function classifyTranscribeError(error,stage) {
  const stderr=String(error.stderr||'');
  if(error.killed)return {noSpeech:false,error:'本地转写超时，请手动重试',stage};
  if(stage==='transcribe'&&/转写失败[:：]\s*未在音频中检测到人声音段/.test(stderr))return {noSpeech:true};
  const lines=stderr.replace(/\r/g,'\n').split('\n').map(s=>s.trim()).filter(Boolean);
  const meaningful=lines.filter(s=>/转写失败|error|failed|invalid|cannot|exception/i.test(s));
  const detail=(meaningful.at(-1)||lines.at(-1)||error.message||'未知错误').slice(-1200);
  return {noSpeech:false,error:`${stage==='ffmpeg'?'音频转换':'本地转写'}失败：${detail}`,stage,exitCode:error.code??null,signal:error.signal??null};
}
export function installTranscribeBridge(server) {
  let busy=false;
  server.middlewares.use('/api/transcribe', async (req,res) => {
    const send=(code,data)=>{res.statusCode=code;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
    if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host||'') || (req.headers.origin && req.headers.origin!==`http://${req.headers.host}`)) return send(403,{error:'Only local same-origin requests allowed'});
    if(req.method!=='POST'||!req.headers['content-type']?.startsWith('audio/')) return send(400,{error:'POST audio data required'});
    if(busy) return send(409,{error:'转写正在进行，请稍后再试'});
    busy=true;let dir,stage='input';
    try {
      const chunks=[];let size=0;
      for await(const chunk of req) {size+=chunk.length;if(size>20*1024*1024) return send(413,{error:'音频超过 20 MB'});chunks.push(chunk);}
      if(!size) return send(400,{error:'没有收到音频'});
      dir=await mkdtemp(join(tmpdir(),'voice-canvas-asr-'));
      const input=join(dir,'recording'),wav=join(dir,'speech.wav');
      await writeFile(input,Buffer.concat(chunks));
      stage='ffmpeg';
      await run('ffmpeg',['-nostdin','-v','error','-i',input,'-t','60','-ac','1','-ar','16000',wav],{timeout:30000,maxBuffer:1024*1024});
      const payload={method:'asr.transcribe',params:{audio_path:wav,output_dir:dir,format:'txt',engine:'gguf',lang:'zh'}};
      stage='transcribe';
      const {stdout}=await run('transcribe',['invoke','--payload',JSON.stringify(payload)],{timeout:120000,maxBuffer:4*1024*1024});
      stage='result';
      const result=JSON.parse(stdout);
      if(!result.files?.txt) throw Error('transcribe 未返回 TXT 结果');
      const text=(await readFile(result.files.txt,'utf8')).trim();
      send(200,{text,engine:'gguf',elapsedSec:result.elapsedSec});
    } catch(error) {const result=classifyTranscribeError(error,stage);if(result.noSpeech)send(200,{text:'',engine:'gguf',reason:'no_speech'});else send(500,result);}
    finally {busy=false;if(dir)await rm(dir,{recursive:true,force:true});}
  });
}
