// AudioWorklet: forwards the exact samples the analyzer hears to the main thread for a WAV file.
class TapRecorder extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('tap-recorder', TapRecorder);
