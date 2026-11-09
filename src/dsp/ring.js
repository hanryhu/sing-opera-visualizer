// Singer's formant ("ring") level, after Sundberg (1995) "The singer's formant revisited", STL-QPSR 36(2-3).
//
// Every vowel has energy near 3 kHz, and how much depends on F1/F2 (≈ −45 dB re L1 in [u], +20 dB in [i]
// for an ordinary voice). So a fixed-band ratio mostly reports the vowel, not the ring. Sundberg's measure:
//   L_SF = (observed L3 − L1) − (predicted L3 − L1 for a speech-like voice with the same F1, F2)
// where the prediction uses formant-level theory (Fant 1970) with F3 = 2.5 kHz, F4 = 3.5, F5 = 4.5 kHz
// (keeping F3−F2 ≥ 0.5, F4−F3 ≥ 1, F5−F4 ≥ 1 kHz) and a −12 dB/oct source. L_SF ≥ 6 dB was proposed as the
// minimum for "possessing a singer's formant". Limits noted by Sundberg: grows with loudness; unreliable at
// high F0 (soprano range), where partials are too sparse to sample the formant peaks.

import { fft } from './formants.js';

const N = 8192;
let win = null;

/** Hann-windowed magnitude spectrum in dB of the frame (newest samples). */
export function spectrumDb(frame, sampleRate) {
  const n = Math.min(frame.length, N);
  if (!win || win.length !== n) {
    win = new Float64Array(n);
    for (let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  }
  const re = new Float64Array(N), im = new Float64Array(N);
  const off = frame.length - n;
  for (let i = 0; i < n; i++) re[i] = frame[off + i] * win[i];
  fft(re, im);
  const db = new Float64Array(N / 2);
  for (let k = 0; k < N / 2; k++) db[k] = 10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-20);
  return { db, binHz: sampleRate / N };
}

function peak(spec, lo, hi) {
  const { db, binHz } = spec;
  let m = -Infinity;
  for (let k = Math.max(1, Math.floor(lo / binHz)); k <= Math.min(db.length - 1, Math.ceil(hi / binHz)); k++) m = Math.max(m, db[k]);
  return m;
}

// Formant-level model: cascade of DC-normalised resonators (Fant), source −12 dB/oct, lip radiation +6 dB/oct.
const BW = [60, 80, 120, 150, 200];
function envelopeDb(f, F) {
  let g = 0;
  for (let i = 0; i < F.length; i++) {
    const b = BW[i] / 2, Fi = F[i];
    g += 20 * Math.log10((Fi * Fi + b * b) / Math.sqrt(((Fi - f) ** 2 + b * b) * ((Fi + f) ** 2 + b * b)));
  }
  return g - 6 * Math.log2(f / 100);
}

function rawRelL3(F1, F2) {
  const F3 = Math.max(2500, F2 + 500), F4 = Math.max(3500, F3 + 1000), F5 = Math.max(4500, F4 + 1000);
  const F = [F1, F2, F3, F4, F5];
  return envelopeDb(F3, F) - envelopeDb(F1, F);
}
// Calibration to Sundberg's published curve: his Fig. 8 gives L3 − L1 ≈ −30 dB for F1 = 0.5, F2 = 1 kHz, and
// his Fig. 9 range is about −45 dB ([u]) to −20 dB ([i]). This model has the same shape (span 26.5 dB)
// but sits ~12 dB lower (formant-bandwidth / level conventions), so it is shifted to match. Needed because
// his 6 dB threshold is defined on his scale.
const CALIBRATION = -30 - rawRelL3(500, 1000);

/** Predicted L3 − L1 (dB) for a speech-like voice with these F1, F2 (Sundberg's neutral reference). */
export function predictedRelL3(F1, F2) {
  return rawRelL3(F1, F2) + CALIBRATION;
}

// ---- Cluster view (Detail mode): spectrum shape 2–4.5 kHz ----
export const CLUSTER_LO = 2000, CLUSTER_HI = 4500, CLUSTER_N = 64;
export const clusterFreq = (i) => CLUSTER_LO * Math.pow(CLUSTER_HI / CLUSTER_LO, i / (CLUSTER_N - 1));

/** Predicted spectrum envelope (dB re L1) of a speech-like voice with these F1, F2, on the cluster grid. */
export function predictedClusterCurve(F1, F2) {
  const F3 = Math.max(2500, F2 + 500), F4 = Math.max(3500, F3 + 1000), F5 = Math.max(4500, F4 + 1000);
  const F = [F1, F2, F3, F4, F5];
  const l1 = envelopeDb(F1, F);
  const out = new Float32Array(CLUSTER_N);
  for (let i = 0; i < CLUSTER_N; i++) out[i] = envelopeDb(clusterFreq(i), F) - l1 + CALIBRATION;
  return out;
}

/** Observed harmonic-peak curve (dB re L1) on the cluster grid: partials joined by straight lines. */
function observedClusterCurve(spec, f0, L1) {
  const pts = [];
  for (let k = Math.max(1, Math.floor(CLUSTER_LO / f0) - 1); k * f0 <= CLUSTER_HI * 1.1; k++) {
    const f = k * f0;
    pts.push([f, peak(spec, f - f0 * 0.3, f + f0 * 0.3) - L1]);
  }
  if (pts.length < 2) return null;
  const out = new Float32Array(CLUSTER_N);
  let j = 0;
  for (let i = 0; i < CLUSTER_N; i++) {
    const f = clusterFreq(i);
    while (j < pts.length - 2 && pts[j + 1][0] < f) j++;
    const [fa, da] = pts[j], [fb, db] = pts[j + 1];
    const u = Math.max(0, Math.min(1, (f - fa) / (fb - fa)));
    out[i] = da + (db - da) * u;
  }
  return out;
}

/**
 * Singer's formant level L_SF in dB (≈0 = ordinary speech-like voice; ≥ 6 = singer's formant present).
 * @returns {{lsf:number, observed:number, predicted:number}|null}
 */
export function singersFormantLevel(frame, sampleRate, f0, F1, F2) {
  if (!(F1 > 0 && F2 > F1 && f0 > 0)) return null;
  const spec = spectrumDb(frame, sampleRate);
  // L1: strongest partial around F1 (widened by half a harmonic so a partial is always included)
  const w1 = Math.max(F1 * 0.2, f0 * 0.6);
  const L1 = peak(spec, Math.max(50, F1 - w1), F1 + w1);
  // L3: strongest partial in the singer's-formant region (F3–F5 cluster near 3 kHz)
  const L3 = peak(spec, 2200, 3800);
  const observed = L3 - L1;
  const predicted = predictedRelL3(F1, F2);
  return { lsf: observed - predicted, observed, predicted, cluster: observedClusterCurve(spec, f0, L1) };
}
