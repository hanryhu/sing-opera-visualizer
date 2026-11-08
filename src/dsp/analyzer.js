// Per-frame analysis pipeline + smoothing.

import { yin, freqToMidi } from './pitch.js';
import { estimateFormants, estimateFormantsHarmonic } from './formants.js';

// Above this F0 the harmonics are too sparse for plain LPC; fit the harmonic peaks (DAP) instead.
const DAP_F0 = 300;

const GATE_DB = -45;
const MAX_APERIODICITY = 0.25;
const VIBRATO_WINDOW = 0.45; // s — averaging window for the tuner decision
const HOLD = 0.15; // s — keep tracks alive through short gaps

class Track {
  constructor(tau) { this.tau = tau; this.hist = []; this.value = 0; this.lastT = -1; }
  push(v, t) {
    if (!v) return this.value;
    if (this.lastT < 0 || t - this.lastT > HOLD) { this.hist = []; this.value = 0; }
    this.hist.push(v);
    if (this.hist.length > 5) this.hist.shift();
    const med = [...this.hist].sort((a, b) => a - b)[this.hist.length >> 1];
    const dt = this.lastT < 0 ? 1 : t - this.lastT;
    const a = 1 - Math.exp(-dt / this.tau);
    this.value = this.value ? this.value + a * (med - this.value) : med;
    this.lastT = t;
    return this.value;
  }
  get(t) { return this.lastT >= 0 && t - this.lastT <= HOLD ? this.value : 0; }
}

export class Analyzer {
  constructor(sampleRate, opts = {}) {
    this.sr = sampleRate;
    this.a4 = opts.a4 ?? 440;
    this.f1 = new Track(0.08);
    this.f2 = new Track(0.08);
    this.f3 = new Track(0.1);
    this.ring = new Track(0.15);
    this.pitchHist = []; // {t, midi}
    this.lastVoicedT = -1;
  }

  /**
   * @param {Float32Array} frame time-domain samples (newest last)
   * @param {Float32Array|null} spectrumDb analyser dB spectrum for ring ratio
   * @param {number} t seconds
   */
  process(frame, spectrumDb, t) {
    // Level
    let sum = 0, peak = 0;
    const tail = frame.length - 2048;
    for (let i = tail; i < frame.length; i++) {
      const v = frame[i];
      sum += v * v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
    }
    const rms = Math.sqrt(sum / 2048);
    const rmsDb = 20 * Math.log10(rms + 1e-9);
    const peakDb = 20 * Math.log10(peak + 1e-9);
    const clipped = peak >= 0.99;

    const out = {
      t, rmsDb, peakDb, clipped, voiced: false,
      f0: 0, midiRaw: 0, midiMean: 0, f1: 0, f2: 0, f3: 0, ring: 0,
    };

    if (rmsDb > GATE_DB) {
      const { f0, aperiodicity } = yin(frame.subarray(tail), this.sr);
      if (f0 >= 60 && f0 <= 1500 && aperiodicity < MAX_APERIODICITY) {
        out.voiced = true;
        let midi = freqToMidi(f0, this.a4);
        // Pitch cleanup. Recent raw readings (reset after a gap in voicing):
        if (t - this.lastVoicedT > HOLD) this.rawHist = [];
        this.rawHist = this.rawHist || [];
        this.rawHist.push(midi);
        if (this.rawHist.length > 5) this.rawHist.shift();
        const recent = [...this.rawHist].sort((a, b) => a - b)[this.rawHist.length >> 1];
        // (1) Octave folding: a reading ~an octave from the recent pitch is almost always the
        //     tracker locking onto the 2nd harmonic (or a subharmonic) — weak fundamentals in old
        //     recordings make this common. A real octave leap survives: it moves `recent` within 3 frames.
        const dev = midi - recent;
        if (Math.abs(Math.abs(dev) - 12) < 0.8) midi -= 12 * Math.sign(dev);
        // (2) Median of the last 5 (folded) readings removes remaining one-frame spikes.
        this.foldHist = this.rawHist.length === 1 ? [] : this.foldHist || [];
        this.foldHist.push(midi);
        if (this.foldHist.length > 5) this.foldHist.shift();
        midi = [...this.foldHist].sort((a, b) => a - b)[this.foldHist.length >> 1];
        out.midiRaw = midi;
        out.f0 = 440 * Math.pow(2, (midi - 69) / 12) * (this.a4 / 440);
        this.lastVoicedT = t;
        if (this.pitchHist.length && Math.abs(this.pitchHist.at(-1).midi - out.midiRaw) > 2.5) {
          this.pitchHist = []; // note change / octave jump: restart averaging
        }
        this.pitchHist.push({ t, midi: out.midiRaw });

        let fm = out.f0 > DAP_F0 ? estimateFormantsHarmonic(frame, this.sr, out.f0) : null;
        if (!fm || !fm.f1 || !fm.f2) fm = estimateFormants(frame, this.sr); // fall back to LPC
        if (fm) {
          this.f1.push(fm.f1, t);
          this.f2.push(fm.f2, t);
          this.f3.push(fm.f3, t);
        }
        if (spectrumDb) this.ring.push(this.ringRatio(spectrumDb) + 100, t); // offset keeps it non-zero
      }
    }
    if (t - this.lastVoicedT > HOLD) this.pitchHist = [];
    while (this.pitchHist.length && t - this.pitchHist[0].t > VIBRATO_WINDOW) this.pitchHist.shift();
    if (this.pitchHist.length) {
      // Hann-weighted mean: suppresses the residual wobble from partial vibrato cycles
      let ws = 0, s = 0;
      const t0 = t - VIBRATO_WINDOW;
      for (const p of this.pitchHist) {
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * (p.t - t0)) / VIBRATO_WINDOW) + 0.05;
        ws += w;
        s += w * p.midi;
      }
      out.midiMean = s / ws;
    }
    out.f1 = this.f1.get(t);
    out.f2 = this.f2.get(t);
    out.f3 = this.f3.get(t);
    const r = this.ring.get(t);
    out.ring = r ? r - 100 : 0;
    out.tracking = out.midiMean > 0;
    return out;
  }

  /** Singer's-formant ratio: energy 2.5–3.5 kHz relative to 0.3–2 kHz, dB. */
  ringRatio(db) {
    const binHz = this.sr / 2 / db.length;
    const band = (lo, hi) => {
      let e = 0;
      for (let i = Math.floor(lo / binHz); i <= Math.ceil(hi / binHz) && i < db.length; i++) {
        e += Math.pow(10, db[i] / 10);
      }
      return e;
    };
    return 10 * Math.log10((band(2500, 3500) + 1e-20) / (band(300, 2000) + 1e-20));
  }
}
