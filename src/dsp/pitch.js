// Pitch detection (YIN) and note helpers.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * YIN fundamental-frequency estimator (de Cheveigné & Kawahara, 2002).
 * @returns {{f0:number, aperiodicity:number}} f0 = 0 when no pitch found.
 */
export function yin(buf, sampleRate, fmin = 60, fmax = 1500, threshold = 0.15) {
  const n = buf.length;
  const tauMin = Math.max(2, Math.floor(sampleRate / fmax));
  const tauMax = Math.min(Math.floor(sampleRate / fmin), Math.floor(n / 2));
  const w = n - tauMax;
  const d = new Float32Array(tauMax + 2);

  // Difference function
  for (let tau = 1; tau <= tauMax + 1 && tau < n - w; tau++) {
    let sum = 0;
    for (let i = 0; i < w; i++) {
      const diff = buf[i] - buf[i + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  // Cumulative mean normalised difference
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    running += d[tau];
    d[tau] = running > 0 ? (d[tau] * tau) / running : 1;
  }

  // First dip below threshold, then walk to its local minimum
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < threshold) {
      while (t + 1 <= tauMax && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    // No confident dip: report global minimum as low-confidence
    let best = tauMin;
    for (let t = tauMin; t <= tauMax; t++) if (d[t] < d[best]) best = t;
    tau = best;
  }
  // Strong high harmonics (e.g. F2 of [i]) can put ripples inside the dip;
  // take the true minimum within ±6% of the candidate period.
  {
    const lo = Math.max(tauMin, Math.floor(tau * 0.94));
    const hi = Math.min(tauMax, Math.ceil(tau * 1.06));
    for (let t = lo; t <= hi; t++) if (d[t] < d[tau]) tau = t;
  }
  const aperiodicity = d[tau];

  // Parabolic interpolation
  let betterTau = tau;
  if (tau > 1 && tau < tauMax) {
    const s0 = d[tau - 1], s1 = d[tau], s2 = d[tau + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) betterTau = tau + (s2 - s0) / denom;
  }
  return { f0: sampleRate / betterTau, aperiodicity };
}

export const freqToMidi = (f, a4 = 440) => 69 + 12 * Math.log2(f / a4);
export const midiToFreq = (m, a4 = 440) => a4 * Math.pow(2, (m - 69) / 12);

export function noteName(midi) {
  const n = Math.round(midi);
  return NOTE_NAMES[((n % 12) + 12) % 12];
}
export function noteOctave(midi) {
  return Math.floor(Math.round(midi) / 12) - 1;
}

/** Coarse tuning state from deviation in cents. */
export function tuningState(cents) {
  const a = Math.abs(cents);
  if (a <= 10) return 'in';
  if (a <= 30) return 'near';
  return 'off';
}
