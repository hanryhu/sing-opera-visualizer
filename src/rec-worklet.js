// AudioWorklet: passes each 128-sample block of the input to the main thread (Learn's Performance mode).
// Small blocks keep the recording's start time exact to within ~3 ms.
class TakeRecorder extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('take-recorder', TakeRecorder);
