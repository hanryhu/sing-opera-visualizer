// Per-frame analysis pipeline + smoothing.

import { yin, freqToMidi, refinePitch } from './pitch.js';
import { estimateFormants, estimateFormantsHarmonic } from './formants.js';
import { singersFormantLevel } from './ring.js';

// Above this F0 the harmonics are too sparse for plain LPC; fit the harmonic peaks (DAP) instead.
const DAP_F0 = 300;

// Voicing gate. Loud-enough + reasonably periodic, OR quiet-but-very-clean (e.g. a whistle or a
// soft note: a pure periodic tone is unmistakable even at low level, while room noise is never
// periodic). Hysteresis: while a note is sounding, the level threshold drops so it doesn't flicker.
const GATE_DB = -45;
const QUIET_GATE_DB = -62;      // quiet path: needs very clean periodicity
const QUIET_MAX_APERIODICITY = 0.08;
const HYSTERESIS_DB = 8;        // once voiced, stay voiced down to GATE_DB - 8
const MAX_APERIODICITY = 0.25;
const QUIET_MIN_F0 = 70;        // keeps mains hum (50/60 Hz) out of the quiet path
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
  /** Keep the last good value alive without a new reading (e.g. while the input is clipping). */
  touch(t) { if (this.value && this.lastT >= 0 && t - this.lastT <= HOLD) this.lastT = t; }
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
    let sum = 0, peak = 0, flat = 0, run = 0;
    const tail = frame.length - 2048;
    for (let i = tail; i < frame.length; i++) {
      const v = frame[i];
      sum += v * v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
      // Hard clipping leaves runs of identical samples at high level; a real voice (or even a
      // pure whistle) never holds perfectly still like that.
      if (a > 0.3 && Math.abs(v - frame[i - 1]) < 1e-6) { if (++run >= 2) flat++; } else run = 0;
    }
    const rms = Math.sqrt(sum / 2048);
    const rmsDb = 20 * Math.log10(rms + 1e-9);
    const peakDb = 20 * Math.log10(peak + 1e-9);
    const clipped = peak >= 0.99;
    // Distortion: clipped peaks or flat-topped waveform. Flattened peaks add harmonics the voice
    // never made, which reads as a falsely high F2 (e.g. [u] jumping toward [i]), so formant
    // readings from these frames are discarded; pitch is still fine (clipping keeps the period).
    const distorted = clipped || flat >= 3;

    const out = {
      t, rmsDb, peakDb, clipped, distorted, voiced: false,
      f0: 0, midiRaw: 0, midiMean: 0, f1: 0, f2: 0, f3: 0, ring: 0,
    };

    const wasVoiced = this.lastVoicedT >= 0 && t - this.lastVoicedT <= HOLD;
    if (rmsDb > QUIET_GATE_DB) {
      const { f0, aperiodicity } = yin(frame.subarray(tail), this.sr);
      const loudOk = rmsDb > GATE_DB - (wasVoiced ? HYSTERESIS_DB : 0) && aperiodicity < MAX_APERIODICITY;
      const quietOk = aperiodicity < QUIET_MAX_APERIODICITY && f0 >= QUIET_MIN_F0;
      if (f0 >= 60 && f0 <= 1500 && (loudOk || quietOk)) {
        out.voiced = true;
        // Remove the sharp bias from inharmonic sources (piano) by re-measuring on the low partials
        // Remove the sharp bias from inharmonic sources (piano) by re-measuring on the low partials
        let midi = freqToMidi(refinePitch(frame.subarray(tail), this.sr, f0), this.a4);
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
        out.midiFast = midi; // octave-corrected but not median-smoothed (keeps vibrato peaks for vibrato analysis)
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
        if (distorted) { this.f1.touch(t); this.f2.touch(t); this.f3.touch(t); }
        else if (fm) {
          this.f1.push(fm.f1, t);
          this.f2.push(fm.f2, t);
          this.f3.push(fm.f3, t);
        }
        // Ring = singer's formant level relative to what this vowel's F1/F2 predict (Sundberg 1995).
        // Not computed on distorted frames; unreliable at high F0 (sparse partials), so skipped above 600 Hz.
        if (!distorted && out.f0 < 600 && this.f1.value && this.f2.value) {
          const r = singersFormantLevel(frame, this.sr, out.f0, this.f1.value, this.f2.value);
          if (r && Number.isFinite(r.lsf)) this.ring.push(r.lsf + 100, t); // offset keeps it non-zero
        }
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
