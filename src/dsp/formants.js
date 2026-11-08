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
