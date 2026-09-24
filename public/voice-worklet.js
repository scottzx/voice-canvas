class VoiceCapture extends AudioWorkletProcessor {
  process(inputs) { const data=inputs[0]?.[0];if(data)this.port.postMessage(data.slice());return true; }
}
registerProcessor('voice-capture',VoiceCapture);
