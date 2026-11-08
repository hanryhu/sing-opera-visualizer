// Formant estimation via LPC + polynomial root finding.

const firCache = new Map();

/** Windowed-sinc low-pass FIR for anti-alias before decimation. */
function lowpassFIR(factor, taps = 63) {
  const key = `${factor}:${taps}`;
  if (firCache.has(key)) return firCache.get(key);
  const fc = 0.45 / factor; // normalised cutoff (cycles/sample), a bit under new Nyquist
  const h = new Float64Array(taps);
  const m = (taps - 1) / 2;
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const x = i - m;
    const sinc = x === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * x) / (Math.PI * x);
    const win = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (taps - 1));
    h[i] = sinc * win;
    sum += h[i];
  }
  for (let i = 0; i < taps; i++) h[i] /= sum;
  firCache.set(key, h);
  return h;
}

/** Decimate the last `outLen` output samples of `buf` by integer `factor`. */
export function decimate(buf, factor, outLen) {
  const h = lowpassFIR(factor);
  const taps = h.length;
  const out = new Float64Array(outLen);
  const start = buf.length - outLen * factor;
  for (let k = 0; k < outLen; k++) {
    const c = start + k * factor;
    let acc = 0;
    for (let j = 0; j < taps; j++) {
      const idx = c - j + (taps >> 1);
      if (idx >= 0 && idx < buf.length) acc += h[j] * buf[idx];
    }
    out[k] = acc;
  }
  return out;
}

/** LPC coefficients a[0..p] (a[0] = 1) via autocorrelation + Levinson–Durbin. */
export function lpc(x, order) {
  const n = x.length;
  const r = new Float64Array(order + 1);
  for (let lag = 0; lag <= order; lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) s += x[i] * x[i - lag];
    r[lag] = s;
  }
  if (r[0] <= 0) return null;
  r[0] *= 1.0001; // white-noise correction for numerical stability
  const a = new Float64Array(order + 1);
  const tmp = new Float64Array(order + 1);
  a[0] = 1;
  let err = r[0];
  for (let i = 1; i <= order; i++) {
    let acc = r[i];
    for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
    const k = -acc / err;
    tmp.set(a);
    for (let j = 1; j < i; j++) a[j] = tmp[j] + k * tmp[i - j];
    a[i] = k;
    err *= 1 - k * k;
    if (err <= 0) return null;
  }
  return a;
}

/** Roots of monic polynomial z^p + a1 z^{p-1} + ... + ap (Durand–Kerner). */
export function polyRoots(a) {
  const p = a.length - 1;
  const re = new Float64Array(p), im = new Float64Array(p);
  // Initial guesses spread on a circle
  for (let i = 0; i < p; i++) {
    const ang = (2 * Math.PI * i) / p + 0.4;
    re[i] = 0.9 * Math.cos(ang);
    im[i] = 0.9 * Math.sin(ang);
  }
  for (let iter = 0; iter < 200; iter++) {
    let maxDelta = 0;
    for (let i = 0; i < p; i++) {
      // Evaluate polynomial at z_i (Horner)
      let pr = 1, pi = 0;
      const zr = re[i], zi = im[i];
      for (let k = 1; k <= p; k++) {
        const nr = pr * zr - pi * zi + a[k];
        const ni = pr * zi + pi * zr;
        pr = nr; pi = ni;
      }
      // Denominator prod (z_i - z_j)
      let dr = 1, di = 0;
      for (let j = 0; j < p; j++) {
        if (j === i) continue;
        const xr = zr - re[j], xi = zi - im[j];
        const nr = dr * xr - di * xi;
        const ni = dr * xi + di * xr;
        dr = nr; di = ni;
      }
      const den = dr * dr + di * di;
      if (den === 0) continue;
      const qr = (pr * dr + pi * di) / den;
      const qi = (pi * dr - pr * di) / den;
      re[i] -= qr;
      im[i] -= qi;
      const dlt = Math.abs(qr) + Math.abs(qi);
      if (dlt > maxDelta) maxDelta = dlt;
    }
    if (maxDelta < 1e-10) break;
  }
  const roots = [];
  for (let i = 0; i < p; i++) roots.push([re[i], im[i]]);
  return roots;
}

/**
 * Estimate formants from a raw frame.
 * @param {Float32Array} frame raw samples at sampleRate
 * @returns {{candidates:{f:number,bw:number}[], f1:number, f2:number, f3:number}|null}
 */
export function estimateFormants(frame, sampleRate, opts = {}) {
  const targetFs = opts.targetFs ?? 11500;
  const factor = Math.max(1, Math.round(sampleRate / targetFs));
  const fs = sampleRate / factor;
  const order = opts.order ?? 12;
  const outLen = Math.min(opts.frameLen ?? 512, Math.floor(frame.length / factor) - 2);

  const x = decimate(frame, factor, outLen);
  // Pre-emphasis + Hamming
  const y = new Float64Array(outLen);
  let prev = x[0];
  for (let i = 0; i < outLen; i++) {
    const v = x[i] - 0.97 * prev;
    prev = x[i];
    y[i] = v * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (outLen - 1)));
  }
  const a = lpc(y, order);
  if (!a) return null;
  const roots = polyRoots(a);

  const candidates = [];
  for (const [r, i] of roots) {
    if (i <= 0) continue;
    const mag = Math.hypot(r, i);
    const f = (Math.atan2(i, r) * fs) / (2 * Math.PI);
    const bw = (-Math.log(mag) * fs) / Math.PI;
    if (f > 120 && f < fs / 2 - 150 && bw > 0 && bw < 600) candidates.push({ f, bw });
  }
  candidates.sort((p, q) => p.f - q.f);

  // Sequential assignment with plausible ranges
  const pick = (lo, hi, after) => {
    for (const c of candidates) if (c.f > after + 80 && c.f >= lo && c.f <= hi) return c.f;
    return 0;
  };
  const f1 = pick(180, 1150, 0);
  const f2 = f1 ? pick(550, 3200, f1) : 0;
  const f3 = f2 ? pick(1700, 4200, f2) : pick(1700, 4200, 1500);
  return { candidates, f1, f2, f3, fs };
}

/* ------------------------------------------------------------------ */
/* High-pitch path: Discrete All-Pole (DAP) modelling of harmonics     */
/* El-Jaroudi & Makhoul (1991), IEEE Trans. Signal Processing 39(2).   */
/* At high F0 only the harmonics carry information; ordinary LPC fits  */
/* the gaps between them and locks F1 onto a harmonic. DAP fits an     */
/* all-pole envelope to the harmonic amplitudes alone.                 */
/* ------------------------------------------------------------------ */

export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ar = re[i + j], ai = im[i + j];
        const br = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
        const bi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ar + br; im[i + j] = ai + bi;
        re[i + j + len / 2] = ar - br; im[i + j + len / 2] = ai - bi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

function solve(M, b) { // Gaussian elimination with partial pivoting
  const n = b.length;
  const A = M.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    if (Math.abs(A[c][c]) < 1e-300) return null;
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = A[r][n];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
}

const FFT_N = 8192;
let fftWin = null;

/** Harmonic amplitudes (power) at k·f0 from a Hann-windowed FFT. */
export function harmonicPowers(frame, sampleRate, f0, fmax = 5000) {
  const n = Math.min(frame.length, FFT_N);
  if (!fftWin || fftWin.length !== n) {
    fftWin = new Float64Array(n);
    for (let i = 0; i < n; i++) fftWin[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  }
  const re = new Float64Array(FFT_N), im = new Float64Array(FFT_N);
  const off = frame.length - n;
  for (let i = 0; i < n; i++) re[i] = frame[off + i] * fftWin[i];
  fft(re, im);
  const binHz = sampleRate / FFT_N;
  const freqs = [], pows = [];
  for (let k = 1; k * f0 < fmax; k++) {
    const lo = Math.floor((k * f0 - f0 * 0.25) / binHz), hi = Math.ceil((k * f0 + f0 * 0.25) / binHz);
    let best = 0, bi = lo;
    for (let b = Math.max(1, lo); b <= hi && b < FFT_N / 2; b++) {
      const p = re[b] * re[b] + im[b] * im[b];
      if (p > best) { best = p; bi = b; }
    }
    freqs.push(bi * binHz);
    pows.push(best + 1e-20);
  }
  return { freqs, pows };
}

/** DAP all-pole fit to discrete spectral samples. Returns a[0..p] (a0 = 1) or null. */
export function dap(w, P, p, iters = 30) {
  const K = w.length;
  const R = (i) => { let s = 0; for (let k = 0; k < K; k++) s += P[k] * Math.cos(i * w[k]); return s / K; };
  const Rv = Array.from({ length: p + 1 }, (_, i) => R(i));
  const T = Array.from({ length: p + 1 }, (_, i) => Array.from({ length: p + 1 }, (_, j) => Rv[Math.abs(i - j)]));
  let a = lpcFromR(Rv, p);
  if (!a) return null;
  for (let it = 0; it < iters; it++) {
    const h = new Float64Array(p + 1);
    for (let k = 0; k < K; k++) {
      let Ar = 0, Ai = 0;
      for (let l = 0; l <= p; l++) { Ar += a[l] * Math.cos(w[k] * l); Ai -= a[l] * Math.sin(w[k] * l); }
      const m2 = Ar * Ar + Ai * Ai;
      const ir = Ar / m2, ii = -Ai / m2; // 1/A
      for (let i = 0; i <= p; i++) h[i] += (ir * Math.cos(w[k] * i) + ii * Math.sin(w[k] * i)) / K;
    }
    const b = solve(T, h);
    if (!b || !b[0]) break;
    const next = Array.from(b, (v) => v / b[0]);
    a = a.map((v, i) => 0.5 * v + 0.5 * next[i]);
  }
  return a;
}

function lpcFromR(r, order) {
  const a = new Float64Array(order + 1), tmp = new Float64Array(order + 1);
  a[0] = 1;
  let err = r[0] * 1.0001;
  for (let i = 1; i <= order; i++) {
    let acc = r[i];
    for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
    const k = -acc / err;
    tmp.set(a);
    for (let j = 1; j < i; j++) a[j] = tmp[j] + k * tmp[i - j];
    a[i] = k;
    err *= 1 - k * k;
    if (err <= 0) return null;
  }
  return a;
}

/** Formants for high-pitched frames, from harmonic amplitudes via DAP. */
export function estimateFormantsHarmonic(frame, sampleRate, f0, opts = {}) {
  const fsE = opts.fsE ?? 11000;
  const { freqs, pows } = harmonicPowers(frame, sampleRate, f0, Math.min(5200, fsE / 2 - 200));
  if (freqs.length < 4) return null;
  const w = freqs.map((f) => (2 * Math.PI * f) / fsE);
  // Pre-emphasis (+6 dB/oct) to flatten the source tilt, as in the LPC path
  const P = pows.map((p, k) => p * (1 + 0.97 * 0.97 - 2 * 0.97 * Math.cos(w[k])));
  const order = Math.min(opts.order ?? 10, 2 * Math.floor((freqs.length - 1) / 1));
  const a = dap(w, P, order);
  if (!a) return null;
  const candidates = [];
  for (const [r, i] of polyRoots(a)) {
    if (i <= 0) continue;
    const mag = Math.hypot(r, i);
    if (mag >= 1) continue;
    const f = (Math.atan2(i, r) * fsE) / (2 * Math.PI);
    const bw = (-Math.log(mag) * fsE) / Math.PI;
    if (f > 120 && f < fsE / 2 - 150 && bw < 900) candidates.push({ f, bw });
  }
  candidates.sort((p, q) => p.f - q.f);
  const pick = (lo, hi, after) => {
    for (const c of candidates) if (c.f > after + 80 && c.f >= lo && c.f <= hi) return c.f;
    return 0;
  };
  const f1 = pick(180, 1300, 0);
  const f2 = f1 ? pick(550, 3400, f1) : 0;
  const f3 = f2 ? pick(1700, 4300, f2) : 0;
  return { candidates, f1, f2, f3 };
}
