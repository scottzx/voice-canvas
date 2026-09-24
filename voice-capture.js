export function wav(frames,rate) {
  const count=frames.reduce((sum,f)=>sum+f.length,0),buffer=new ArrayBuffer(44+count*2),view=new DataView(buffer);
  const str=(offset,text)=>[...text].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
  str(0,'RIFF');view.setUint32(4,36+count*2,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,count*2,true);
  let offset=44;for(const frame of frames)for(const sample of frame){view.setInt16(offset,Math.max(-1,Math.min(1,sample))*32767,true);offset+=2;}
  return new Blob([buffer],{type:'audio/wav'});
}
export async function startCapture({onSpeaking,onSegment,onError}) {
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}});
  let context;
  try {
    context=new AudioContext();await context.audioWorklet.addModule('/voice-worklet.js');await context.resume();
    const source=context.createMediaStreamSource(stream),node=new AudioWorkletNode(context,'voice-capture'),mute=context.createGain();
    mute.gain.value=0;source.connect(node);node.connect(mute);mute.connect(context.destination);
    let pre=[],frames=[],active=false,silence=0,length=0,voiced=0,closed=false;
    const finish=()=>{const elapsedMs=silence*1000;if(frames.length&&voiced>=.18)onSegment(wav(frames,context.sampleRate));frames=[];length=0;voiced=0;silence=0;active=false;onSpeaking(false,elapsedMs);};
    node.port.onmessage=event=>{
      if(closed)return;const frame=event.data,seconds=frame.length/context.sampleRate,loud=Math.sqrt(frame.reduce((s,x)=>s+x*x,0)/frame.length)>.018;
      if(!active){pre.push(frame);while(pre.length*seconds>.25)pre.shift();if(!loud)return;active=true;frames=pre;pre=[];onSpeaking(true);}else frames.push(frame);
      length+=seconds;if(loud){silence=0;voiced+=seconds;}else silence+=seconds;
      if(silence>=1.2||length>=25)finish();
    };
    const stop=()=>{if(closed)return;closed=true;if(active)finish();node.disconnect();source.disconnect();stream.getTracks().forEach(t=>t.stop());context.close();};
    stream.getAudioTracks()[0].onended=()=>{stop();onError('麦克风已断开');};return stop;
  }catch(error){stream.getTracks().forEach(t=>t.stop());await context?.close();throw error;}
}
