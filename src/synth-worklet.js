// AudioWorklet: real-time formant voice synthesizer.
// Band-limited glottal-like source (harmonics ~1/k, octave-band wavetables so low notes keep
// their high harmonics) → cascade of 5 resonators (F1–F3 user-set, F4/F5 fixed above F3)
// → slow RMS normaliser so loudness tracks the Volume control, not the formant settings.

const TABLE = 2048;
const BAND_TOPS = [80, 160, 320, 640, 1280, 1700]; // max f0 each table is valid for

class FormantSynth extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'f0', defaultValue: 220, minValue: 40, maxValue: 1600, automationRate: 'k-rate' },
      { name: 'f1', defaultValue: 700, minValue: 150, maxValue: 1400, automationRate: 'k-rate' },
      { name: 'f2', defaultValue: 1300, minValue: 400, maxValue: 3500, automationRate: 'k-rate' },
      { name: 'f3', defaultValue: 2700, minValue: 1500, maxValue: 4200, automationRate: 'k-rate' },
      { name: 'gain', defaultValue: 0.3, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'vibrato', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    const nyq = sampleRate / 2;
    this.tables = BAND_TOPS.map((top) => {
      const t = new Float32Array(TABLE + 1);
      const harms = Math.max(1, Math.floor((nyq * 0.95) / top));
      for (let k = 1; k <= harms; k++) {
        const a = 1 / k;
        for (let i = 0; i <= TABLE; i++) t[i] += a * Math.sin((2 * Math.PI * k * i) / TABLE);
      }
      return t;
    });
    this.phase = 0;
    this.vibPhase = 0;
    this.y1 = new Float64Array(5);
    this.y2 = new Float64Array(5);
    this.cur = null; // smoothed parameter values
    this.ms = 0; // running mean square for normalisation (seeded from the first block)
    this.env = 0; // start-up fade-in 0 → 1 (prevents the click/pop when sound starts)
  }

  process(_inputs, outputs, p) {
    const out = outputs[0];
    const ch = out[0];
    if (!ch) return true;
    const fs = sampleRate;
    const target = {
      f0: p.f0[0], f1: p.f1[0], f2: p.f2[0], f3: p.f3[0], gain: p.gain[0], vib: p.vibrato[0],
    };
    if (!this.cur) this.cur = { ...target };
    const c = this.cur;
    // ~20 ms glide toward targets (per 128-sample block)
    const a = 1 - Math.exp(-ch.length / (0.02 * fs));
    for (const k in target) c[k] += (target[k] - c[k]) * a;

    const f4 = Math.max(c.f3 + 600, 3300), f5 = Math.max(f4 + 700, 4100);
    const F = [c.f1, c.f2, c.f3, f4, f5];
    const BW = [70, 90, 120, 160, 220];
    const A = new Float64Array(5), B = new Float64Array(5), C = new Float64Array(5);
    for (let r = 0; r < 5; r++) {
      const f = Math.min(F[r], fs / 2 - 200);
      C[r] = -Math.exp((-2 * Math.PI * BW[r]) / fs);
      B[r] = 2 * Math.exp((-Math.PI * BW[r]) / fs) * Math.cos((2 * Math.PI * f) / fs);
      A[r] = 1 - B[r] - C[r];
    }
    let ti = BAND_TOPS.findIndex((t) => c.f0 * 1.06 <= t);
    if (ti < 0) ti = BAND_TOPS.length - 1;
    const table = this.tables[ti];

    const fadeStep = 1 / (0.08 * fs); // 80 ms fade-in
    for (let n = 0; n < ch.length; n++) {
      this.vibPhase += 5.5 / fs;
      if (this.vibPhase >= 1) this.vibPhase -= 1;
      const f0 = c.f0 * Math.pow(2, (c.vib * 0.5 * Math.sin(2 * Math.PI * this.vibPhase)) / 12);
      this.phase += f0 / fs;
      if (this.phase >= 1) this.phase -= 1;
      const pos = this.phase * TABLE;
      const i0 = pos | 0;
      let s = table[i0] + (table[i0 + 1] - table[i0]) * (pos - i0);
      for (let r = 0; r < 5; r++) {
        const y = A[r] * s + B[r] * this.y1[r] + C[r] * this.y2[r];
        this.y2[r] = this.y1[r];
        this.y1[r] = y;
        s = y;
      }
      // Seed the level normaliser with the actual signal level so the first samples don't spike
      if (this.ms === 0) this.ms = s * s + 1e-6;
      // Track the level fast (~4 ms) while fading in so the normaliser never overshoots, then smoothly (~100 ms)
      this.ms += (s * s - this.ms) * (this.env < 1 ? 0.005 : 0.0002);
      if (this.env < 1) this.env = Math.min(1, this.env + fadeStep);
      const e = this.env * this.env * (3 - 2 * this.env); // smoothstep
      const y = (s / Math.sqrt(this.ms + 1e-12)) * 0.22 * c.gain * e;
      for (let k = 0; k < out.length; k++) out[k][n] = y;
    }
    return true;
  }
}

registerProcessor('formant-synth', FormantSynth);
