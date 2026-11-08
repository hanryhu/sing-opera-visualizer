// Pitch detection (YIN) and note helpers.

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * YIN fundamental-frequency estimator (de Cheveigné & Kawahara, 2002).
 * @returns {{f0:number, aperiodicity:number}} f0 = 0 when no pitch found.
 */
export function yin(buf, sampleRate, fmin = 60, fmax = 1500, threshold = 0.15) {
  const n = buf.length;
  const tauMin = Math.max(2, Math.floor(sampleRate / fmax));
  const tauMax = Math.min(Math.floor(sampleRate / fmin), Math.floor(n / 2) - 1);
  // Window leaves room for lags up to tauMax + 1 (needed by the interpolation). Every lag must be
  // computed: an unfilled d[tau] = 0 would read as a perfect match and snap pitch to fmin.
  const w = n - tauMax - 1;
  const d = new Float32Array(tauMax + 2);

  // Difference function
  for (let tau = 1; tau <= tauMax + 1; tau++) {
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

/** Coarse tuning state from deviation in cents (thresholds halve in quarter-tone mode). */
export function tuningState(cents, quarter = false) {
  const a = Math.abs(cents);
  const k = quarter ? 0.5 : 1;
  if (a <= 10 * k) return 'in';
  if (a <= 30 * k) return 'near';
  return 'off';
}

/** Nearest pitch step: semitone, or quarter tone when `quarter`. */
export const nearestStep = (midi, quarter = false) =>
  quarter ? Math.round(midi * 2) / 2 : Math.round(midi);

/** Label for a (possibly quarter-tone) step, e.g. "A", "A#", "A↑" (A quarter-sharp). */
export function stepName(step) {
  const base = Math.floor(step + 1e-6);
  const name = NOTE_NAMES[((base % 12) + 12) % 12];
  return step - base > 0.25 ? name + '↑' : name;
}
export const stepOctave = (step) => Math.floor(Math.floor(step + 1e-6) / 12) - 1;

/**
 * Re-estimate f0 on a low-passed copy of the frame (zero-phase, cutoff ≈ 3.5·f0).
 * Stiff strings (piano) have partials sharper than n·f0; those upper partials pull a
 * period-based estimate sharp. Keeping only the lowest few partials removes most of that
 * bias. A voice's harmonics are exact multiples, so this changes nothing for singing.
 */
export function refinePitch(buf, sampleRate, f0) {
  const fc = Math.min(3.5 * f0, 4000);
  // RBJ biquad low-pass, Q = 0.707, applied forward then backward (no phase shift)
  const w0 = (2 * Math.PI * fc) / sampleRate, alpha = Math.sin(w0) / (2 * Math.SQRT1_2), cw = Math.cos(w0);
  const a0 = 1 + alpha;
  const b0 = (1 - cw) / 2 / a0, b1 = (1 - cw) / a0, b2 = b0, a1 = (-2 * cw) / a0, a2 = (1 - alpha) / a0;
  const run = (x) => {
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  };
  let y = run(run(buf).reverse()).reverse(); // two passes per direction = 4th-order slope
  y = run(run(y).reverse()).reverse();
  // Search only near the first estimate
  const r = yin(y, sampleRate, f0 / 1.12, f0 * 1.12, 0.3);
  return r.f0 && Math.abs(Math.log2(r.f0 / f0)) < 0.1 ? r.f0 : f0;
}
