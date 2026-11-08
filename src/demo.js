// Synthetic singer: band-limited glottal source + cascade formant resonators.
// Cycles through the Italian vowels on a little melody, with vibrato.

import { VOICE_PRESETS } from './vowels.js';
import { midiToFreq } from './dsp/pitch.js';

const TABLE_SIZE = 4096;

function makeSourceTable(maxHarm) {
  const t = new Float32Array(TABLE_SIZE + 1);
  for (let k = 1; k <= maxHarm; k++) {
    const amp = 1 / k; // ≈ glottal −12 dB/oct + lip radiation +6 dB/oct
    for (let i = 0; i <= TABLE_SIZE; i++) t[i] += amp * Math.sin((2 * Math.PI * k * i) / TABLE_SIZE);
  }
  return t;
}

/** Klatt-style 2-pole resonator, coefficients updated per sample. */
class Resonator {
  constructor() { this.y1 = 0; this.y2 = 0; }
  step(x, f, bw, fs) {
    const T = 1 / fs;
    const C = -Math.exp(-2 * Math.PI * bw * T);
    const B = 2 * Math.exp(-Math.PI * bw * T) * Math.cos(2 * Math.PI * f * T);
    const A = 1 - B - C;
    const y = A * x + B * this.y1 + C * this.y2;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/**
 * Render a demo performance.
 * @param {number} fs sample rate
 * @param {'low'|'high'} voice
 * @param {{segment?:number, notes?:number[], detune?:number[]}} [opts]
 */
export function renderDemo(fs, voice = 'low', opts = {}) {
  const preset = VOICE_PRESETS[voice];
  // opts.only: sustain a single vowel (used for testing calibration)
  const vowels = opts.only
    ? Array(7).fill(preset.vowels.find((v) => v.ipa === opts.only) || preset.vowels[3])
    : preset.vowels;
  const seg = opts.segment ?? 1.8;
  // Melody (MIDI) — one note per vowel. Low: A3..E4, High: D4..A4
  // (kept in the middle voice: above ~500 Hz LPC formants become unreliable).
  const base = voice === 'low' ? 57 : 62;
  const notes = opts.notes ?? [0, 2, 4, 5, 7, 5, 4].map((d) => base + d);
  // Intentional intonation errors (cents) so the tuner shows all states.
  const detune = opts.detune ?? [0, 0, -20, 0, 45, 0, 15];
  const len = Math.floor(seg * vowels.length * fs);
  const out = new Float32Array(len);

  const maxF0 = midiToFreq(Math.max(...notes) + 1.5);
  const table = makeSourceTable(Math.floor(fs / 2 / maxF0));
  const res = [new Resonator(), new Resonator(), new Resonator(), new Resonator(), new Resonator()];
  const f4 = voice === 'low' ? 3300 : 3700;
  const f5 = voice === 'low' ? 3900 : 4300;

  let phase = 0;
  const glide = 0.12; // seconds of transition between vowels
  for (let n = 0; n < len; n++) {
    const t = n / fs;
    const idx = Math.min(vowels.length - 1, Math.floor(t / seg));
    const local = t - idx * seg;
    const prevIdx = Math.max(0, idx - 1);
    const mix = idx === 0 ? 1 : Math.min(1, local / glide);
    const lerp = (k) => vowels[prevIdx][k] + (vowels[idx][k] - vowels[prevIdx][k]) * mix;
    const f1 = lerp('f1'), f2 = lerp('f2'), f3 = lerp('f3');

    // Pitch: glide into note, vibrato onset after 0.35 s
    const midiPrev = notes[prevIdx] + detune[prevIdx] / 100;
    const midiCur = notes[idx] + detune[idx] / 100;
    const pmix = idx === 0 ? 1 : Math.min(1, local / 0.08);
    const vibDepth = Math.min(1, Math.max(0, (local - 0.35) / 0.4)) * 0.45; // semitones
    const midi = midiPrev + (midiCur - midiPrev) * pmix + vibDepth * Math.sin(2 * Math.PI * 5.6 * t);
    const f0 = midiToFreq(midi);

    phase += f0 / fs;
    if (phase >= 1) phase -= 1;
    const pos = phase * TABLE_SIZE;
    const i0 = pos | 0;
    let s = table[i0] + (table[i0 + 1] - table[i0]) * (pos - i0);
    s += (Math.random() - 0.5) * 0.02; // breath

    s = res[0].step(s, f1, 70, fs);
    s = res[1].step(s, f2, 90, fs);
    s = res[2].step(s, f3, 110, fs);
    s = res[3].step(s, f4, 140, fs);
    s = res[4].step(s, f5, 180, fs);

    // Amplitude envelope: short dip between notes, fade at loop edges
    let env = 1;
    if (local < 0.04) env = 0.35 + 0.65 * (local / 0.04);
    if (t < 0.15) env *= t / 0.15;
    if (len / fs - t < 0.15) env *= (len / fs - t) / 0.15;
    out[n] = s * env;
  }
  // Normalise to −6 dBFS peak
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = 0.5 / (peak || 1);
  for (let i = 0; i < len; i++) out[i] *= g;
  return { samples: out, segment: seg, vowels, notes, detune };
}
