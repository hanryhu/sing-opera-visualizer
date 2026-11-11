// Canvas renderers for the four dashboard panels.

import { nearestStep, stepName, stepOctave, midiToFreq } from '../dsp/pitch.js';
import { t } from '../i18n.js';

export const C = {
  text: '#e8eaf0',
  muted: '#8b93a7',
  faint: '#566074',
  line: '#222836',
  track: '#1b2130',
  green: '#36e07f',
  orange: '#ff9c3b',
  accent: '#7cc4ff',
  ui: "'Inter', system-ui, sans-serif",
  ipa: "'Noto Serif', Georgia, serif",
};
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
export const stateColor = (s) => (s === 'in' ? C.green : s === 'near' ? C.orange : C.muted);

/** HiDPI canvas that tracks its CSS size. */
export class Surface {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0; this.h = 0; this.dpr = 1;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
  }
  begin() {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    return ctx;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), h, r);
}

/* Heart-monitor style sweep (no scrolling, to avoid motion sickness): a sample's x position is fixed
   by its time modulo the window; a write head moves left→right and erases the oldest data just ahead
   of it. Returns null for samples that are erased or too old. */
const SWEEP_GAP = 0.06; // fraction of the window kept blank ahead of the head
function sweepX(t, now, win, x0, x1) {
  const age = now - t;
  if (age < 0 || age > win * (1 - SWEEP_GAP)) return null;
  return x0 + ((((t / win) % 1) + 1) % 1) * (x1 - x0);
}
function sweepHead(ctx, now, win, x0, x1, y0, y1) {
  const x = x0 + ((((now / win) % 1) + 1) % 1) * (x1 - x0);
  ctx.save();
  ctx.fillStyle = rgba(C.accent, 0.35);
  ctx.fillRect(x - 0.75, y0, 1.5, y1 - y0);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Tuner gauge: −50…+50 cents                                          */
/* ------------------------------------------------------------------ */
export function drawGauge(s, cents, rawCents, state, opts = {}) {
  const ctx = s.begin();
  const { w, h } = s;
  const R = opts.quarter ? 25 : 50; // half a step either side
  const k = R / 50;
  const pad = 22, y = opts.detail ? h / 2 - 8 : h / 2 - 4, th = 8;
  const x = (c) => pad + ((Math.max(-R, Math.min(R, c)) + R) / (2 * R)) * (w - 2 * pad);

  roundRect(ctx, pad, y - th / 2, w - 2 * pad, th, th / 2);
  ctx.fillStyle = C.track; ctx.fill();
  ctx.fillStyle = rgba(C.orange, 0.28);
  roundRect(ctx, x(-30 * k), y - th / 2, x(30 * k) - x(-30 * k), th, 2); ctx.fill();
  ctx.fillStyle = rgba(C.green, 0.55);
  roundRect(ctx, x(-10 * k), y - th / 2, x(10 * k) - x(-10 * k), th, 2); ctx.fill();

  ctx.fillStyle = C.faint;
  for (const c of [-R, -R / 2, R / 2, R]) ctx.fillRect(x(c) - 0.5, y + 8, 1, 4);
  ctx.fillRect(x(0) - 0.5, y + 7, 1, 7);
  if (opts.detail) {
    ctx.font = `500 10px ${C.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const c of [-R, -R / 2, 0, R / 2, R]) ctx.fillText(c > 0 ? `+${c}` : `${c}`, x(c), y + 15);
  }

  ctx.font = `500 15px ${C.ui}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('♭', 9, y); ctx.fillText('♯', w - 9, y);

  if (cents == null) return;
  if (rawCents != null) {
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillRect(x(rawCents) - 1, y - 9, 2, 18);
  }
  const col = stateColor(state);
  ctx.save();
  if (state === 'in') { ctx.shadowColor = col; ctx.shadowBlur = 12; }
  ctx.fillStyle = col;
  roundRect(ctx, x(cents) - 3, y - 13, 6, 26, 3); ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Pitch trace: scrolling time × semitone lanes                        */
/* ------------------------------------------------------------------ */
export function drawTrace(s, hist, now, centerMidi, opts = {}) {
  const window = 4;
  const ctx = s.begin();
  const { w, h } = s;
  const left = opts.detail ? 92 : 46, right = 14, top = 10, bottom = 10;
  // Visible span in semitones: the default close-up, or wider when the caller zooms out
  const rows = Math.max(opts.span || 0, h < 150 ? 4 : 5);
  const rowPx = (h - top - bottom) / rows;
  const yOf = (m) => top + (h - top - bottom) / 2 - (m - centerMidi) * rowPx;
  const xOf = (t) => sweepX(t, now, window, left, w - right); // fixed position; null once erased
  const stepSize = opts.quarter ? 0.5 : 1;

  const lo = Math.floor(centerMidi - rows / 2 - 1), hi = Math.ceil(centerMidi + rows / 2 + 1);
  const lastMean = hist.length ? hist[hist.length - 1].mean || 0 : 0;
  const current = lastMean ? nearestStep(lastMean, opts.quarter) : null;
  const live = hist.length && now - hist[hist.length - 1].t < 0.2;
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let n = lo; n <= hi + 1e-6; n += stepSize) {
    const y = yOf(n);
    if (y < -rowPx || y > h + rowPx) continue;
    const isQuarter = n % 1 !== 0;
    const isCur = live && Math.abs(n - current) < 1e-6;
    // in-tune band (±10¢, or ±5¢ for quarter tones) and the step line
    const band = (opts.quarter ? 0.05 : 0.1) * rowPx;
    ctx.fillStyle = rgba(C.green, isCur ? 0.16 : isQuarter ? 0.035 : 0.06);
    ctx.fillRect(left, y - band, w - left - right, band * 2);
    if (isQuarter && !isCur) {
      ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(w - right, y); ctx.stroke(); ctx.setLineDash([]);
    } else {
      ctx.fillStyle = isCur ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.07)';
      ctx.fillRect(left, y - 0.5, w - left - right, 1);
    }
    // When zoomed out, thin the labels so they never overlap: naturals only, then only Cs
    const nameOnly = stepName(n);
    const sharpish = nameOnly.includes('#') || isQuarter;
    const showLabel = isCur || rowPx >= 13 || (rowPx >= 7 && !sharpish) || (nameOnly === 'C' && !isQuarter);
    let name = nameOnly;
    if (opts.detail || (rowPx < 13 && nameOnly === 'C')) name += stepOctave(n);
    ctx.font = `${isCur ? 700 : 500} ${isCur ? 14 : isQuarter || rowPx < 13 ? 10 : 12}px ${C.ui}`;
    ctx.fillStyle = isCur ? C.text : C.faint;
    if (showLabel) ctx.fillText(name, opts.detail ? left - 50 : left - 10, y);
    if (opts.detail && showLabel && (!isQuarter || rowPx > 30)) {
      ctx.font = `400 11px ${C.ui}`; ctx.fillStyle = C.faint;
      ctx.fillText(midiToFreq(n, opts.a4).toFixed(1), left - 8, y);
    }
  }

  // Trace (sweep: drawn where the head was at that moment; never scrolls)
  sweepHead(ctx, now, window, left, w - right, top, h - bottom);
  // Reference pitch (Performance playback): the written note as a dashed line, apart from the sung trace
  if (opts.refMidi) {
    const y = yOf(opts.refMidi);
    if (y > top - 2 && y < h - bottom + 2) {
      ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = rgba(C.accent, 0.9); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(w - right, y); ctx.stroke(); ctx.restore();
    }
  }
  ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  let prev = null, px = null;
  for (const p of hist) {
    const x = xOf(p.t);
    if (x === null) { prev = null; continue; }
    if (prev && px !== null && x >= px && p.t - prev.t < 0.12) { // x < px means it wrapped: break the line
      ctx.strokeStyle = stateColor(p.state);
      ctx.globalAlpha = 0.35 + 0.65 * (1 - (now - p.t) / window);
      ctx.beginPath();
      ctx.moveTo(px, yOf(prev.midi));
      ctx.lineTo(x, yOf(p.midi));
      ctx.stroke();
    }
    prev = p; px = x;
  }
  ctx.globalAlpha = 1;
  const last = hist[hist.length - 1];
  if (last && now - last.t < 0.15 && xOf(last.t) !== null) {
    ctx.save();
    ctx.fillStyle = stateColor(last.state);
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(xOf(last.t), yOf(last.midi), 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/* F3 bar                                                              */
/* ------------------------------------------------------------------ */
const F3_LO = 1800, F3_HI = 4000;
/** F3 bar layout shared by the renderer and pointer input (CSS px of the canvas). */
export function f3Geometry(w, h, detail = false) {
  const ringH = 46;
  const wide = w >= 220;
  // Detail: wide bar holding the sideways spectrum; default: slim bar with the F3 line only
  const barW = detail ? (wide ? Math.min(110, w * 0.28) : Math.min(40, w * 0.45)) : Math.min(40, w * 0.3);
  const bx = wide ? Math.round(w * 0.36 - barW / 2) : (w - barW) / 2;
  const barTop = wide ? 40 : 86, barBot = h - (wide ? ringH + 12 : 56 + ringH);
  const k = Math.log(F3_HI / F3_LO);
  const yOf = (f) => barBot - (Math.log(f / F3_LO) / k) * (barBot - barTop);
  const fAt = (y) => F3_LO * Math.exp(((barBot - Math.max(barTop, Math.min(barBot, y))) / (barBot - barTop)) * k);
  return { ringH, wide, barW, bx, barTop, barBot, yOf, fAt };
}
export function drawF3(s, f3, trail, ring, now, opts = {}) {
  const ctx = s.begin();
  const { w, h } = s;
  const pair = opts.pair; // {unrounded, rounded} for the current tongue position
  const { ringH, wide, barW, bx, barTop, barBot, yOf } = f3Geometry(w, h, opts.detail);
  const cluster = opts.detail ? opts.cluster : null; // spectrum only in Detail

  // Rounding labels: the unrounded/rounded pair for the vowel being sung
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const glyph = (txt, x, y, size) => {
    ctx.fillStyle = pair ? C.text : C.faint;
    ctx.font = `${size}px ${C.ipa}`;
    ctx.fillText(txt, x, y);
  };
  const tiny = w < 90; // compressed mobile column
  const small = (txt, x, y) => {
    ctx.fillStyle = C.muted; ctx.font = `500 ${tiny ? 9 : 11}px ${C.ui}`;
    ctx.fillText(t(tiny ? (txt === 'unrounded' ? 'unrnd' : 'rnd') : txt), x, y);
  };
  if (wide) {
    const lx = Math.min(w - 50, bx + barW + (opts.detail ? 70 : 100));
    glyph(pair ? pair.unrounded : '–', lx, barTop + 30, 34);
    small('unrounded', lx, barTop + 48);
    glyph(pair ? pair.rounded : '–', lx, barBot - 22, 34);
    small('rounded', lx, barBot - 4);
  } else {
    small('unrounded', w / 2, barTop - 40);
    glyph(pair ? pair.unrounded : '–', w / 2, barTop - 14, 22);
    glyph(pair ? pair.rounded : '–', w / 2, barBot + 30, 22);
    small('rounded', w / 2, barBot + 48);
  }

  // Bar with singer's-formant gradient (green @3 kHz → orange @2.8/3.4 kHz → dim)
  const g = ctx.createLinearGradient(0, barBot, 0, barTop);
  const stop = (f, col) => g.addColorStop((barBot - yOf(f)) / (barBot - barTop), col);
  stop(F3_LO, rgba(C.orange, 0.04));
  stop(2450, rgba(C.orange, 0.22));
  stop(2800, rgba(C.orange, 0.85));
  stop(3000, C.green);
  stop(3400, rgba(C.orange, 0.85));
  stop(3750, rgba(C.orange, 0.22));
  stop(F3_HI, rgba(C.orange, 0.04));
  roundRect(ctx, bx, barTop, barW, barBot - barTop, 10);
  ctx.save();
  ctx.globalAlpha = cluster ? 0.18 : 1; // dim track in Detail (spectrum drawn on it, or waiting for voice)
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.stroke();
  // Sideways spectrum (frequency up, level right): your harmonic peaks filled with the bar colours;
  // dashed = a speech-like voice with the same vowel. A clustered F3–F5 (ring) bulges out near 3 kHz.
  if (cluster) {
    const { obs, pred } = cluster, n = pred.length;
    const fAt = (i) => 2000 * Math.pow(4500 / 2000, i / (n - 1));
    const xOfDb = (db) => bx + ((Math.max(-60, Math.min(10, db)) + 60) / 70) * barW;
    const idx = []; for (let i = 0; i < n; i++) if (fAt(i) <= F3_HI) idx.push(i);
    ctx.save();
    roundRect(ctx, bx, barTop, barW, barBot - barTop, 10); ctx.clip();
    if (obs) {
      ctx.beginPath();
      ctx.moveTo(bx, yOf(fAt(idx[0])));
      for (const i of idx) ctx.lineTo(xOfDb(obs[i]), yOf(fAt(i)));
      ctx.lineTo(bx, yOf(fAt(idx[idx.length - 1])));
      ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
    }
    ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); idx.forEach((i, k) => (k ? ctx.lineTo : ctx.moveTo).call(ctx, xOfDb(pred[i]), yOf(fAt(i)))); ctx.stroke();
    ctx.restore();
  }

  // Detailed: Hz scale on the left of the bar
  if (opts.detail) {
    ctx.font = `500 ${bx < 40 ? 9 : 10}px ${C.ui}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; // phone column is narrow
    for (const f of [2000, 2500, 2800, 3000, 3400, 4000]) {
      const y = yOf(f);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(bx - 5, y - 0.5, 4, 1);
      const lab = f >= 4000 ? '4k' : (f / 1000).toFixed(1) + 'k';
      if (ctx.measureText(lab).width <= bx - 10) { ctx.fillStyle = C.faint; ctx.fillText(lab, bx - 8, y); } // no clipped labels in the phone column
    }
  }

  // Trail ticks
  for (const p of trail) {
    const age = now - p.t;
    if (age > 1.2) continue;
    ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - age / 1.2)})`;
    ctx.fillRect(bx - 4, yOf(p.f3) - 0.75, barW + 8, 1.5);
  }

  // Synth target (what you set): a diamond on the left edge of the bar + a dashed guide
  if (opts.target) {
    const y = Math.max(barTop, Math.min(barBot, yOf(opts.target)));
    ctx.save();
    ctx.setLineDash([3, 3]); ctx.strokeStyle = rgba(C.accent, 0.8); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bx - 4, y); ctx.lineTo(bx + barW + 4, y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.accent;
    ctx.beginPath(); ctx.moveTo(bx - 16, y); ctx.lineTo(bx - 9, y - 7); ctx.lineTo(bx - 2, y); ctx.lineTo(bx - 9, y + 7); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Pointer
  if (f3) {
    const y = Math.max(barTop, Math.min(barBot, yOf(f3)));
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,.6)'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#fff';
    roundRect(ctx, bx - 8, y - 2, barW + 16, 4, 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx + barW + 10, y);
    ctx.lineTo(bx + barW + 20, y - 7);
    ctx.lineTo(bx + barW + 20, y + 7);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    if (opts.detail) {
      ctx.font = `600 11px ${C.ui}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = C.text;
      if (bx + barW + 52 <= w) ctx.fillText(Math.round(f3), bx + barW + 23, y);
      else { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(Math.round(f3), w - 6, y - 8); }
    }
  }

  // Ring meter
  const ry = h - ringH + 6;
  ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(12, ry - 12, w - 24, 1);
  ctx.textAlign = 'left'; ctx.fillStyle = C.muted; ctx.font = `600 11px ${C.ui}`;
  if (!tiny) ctx.fillText(t('RING'), 14, ry + 6);
  const mx = tiny ? 10 : 50, mw = w - mx - (tiny ? 10 : 14);
  roundRect(ctx, mx, ry, mw, 8, 4); ctx.fillStyle = C.track; ctx.fill();
  // Ring = singer's formant level L_SF (Sundberg 1995): 0 dB ≈ ordinary speech-like voice for this vowel,
  // ≥ +6 dB = singer's formant present. Bar spans −15 … +15 dB.
  const LO = -15, HI = 15;
  const rx = (db) => mx + ((Math.max(LO, Math.min(HI, db)) - LO) / (HI - LO)) * mw;
  if (ring) {
    const rg = ctx.createLinearGradient(mx, 0, mx + mw, 0);
    rg.addColorStop(0, rgba(C.accent, 0.35)); rg.addColorStop((6 - LO) / (HI - LO), rgba(C.accent, 0.8)); rg.addColorStop(1, C.green);
    roundRect(ctx, mx, ry, rx(ring) - mx, 8, 4); ctx.fillStyle = rg; ctx.fill();
  }
  // Marks: 0 dB (speech-like) and +6 dB (singer's formant threshold)
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(rx(0) - 0.5, ry - 3, 1, 14);
  ctx.fillStyle = C.green; ctx.fillRect(rx(6) - 1, ry - 4, 2, 16);
  if (!tiny) {
    ctx.font = `500 10px ${C.ui}`; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    // The two marks are close: "speech" ends at its mark, "ring" starts at its own
    ctx.textAlign = 'right'; ctx.fillStyle = C.faint; ctx.fillText(t(opts.detail ? '0 dB speech' : 'speech'), rx(0) + 4, ry + 12);
    ctx.textAlign = 'left'; ctx.fillStyle = rgba(C.green, 0.8); ctx.fillText(t(opts.detail ? '+6 dB ring' : 'ring'), rx(6) - 4, ry + 12);
    if (opts.detail && ring) {
      ctx.textAlign = 'right'; ctx.fillStyle = C.text;
      ctx.fillText(`${ring >= 0 ? '+' : ''}${ring.toFixed(0)} dB`, w - 14, ry + 12);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Vowel map: F2 (x, reversed) × F1 (y)                                */
/* ------------------------------------------------------------------ */
const F2_HI = 3200, F2_LO = 580, F1_LO = 220, F1_HI = 1200;
/** Vowel-map layout shared by the renderer and pointer input (CSS px of the canvas). */
export function mapGeometry(w, h, detail) {
  const D = !!detail;
  const compact = h < 300; // short panel (laptop thirds layout): tighter margins
  const L = 44, R = D ? 40 : 24, T = compact ? 36 : D ? 62 : 44, B = compact && D ? 40 : compact ? 30 : 36;
  const kx = Math.log(F2_HI / F2_LO), ky = Math.log(F1_HI / F1_LO);
  const xOf = (f2) => L + (Math.log(F2_HI / f2) / kx) * (w - L - R);
  const yOf = (f1) => T + (Math.log(f1 / F1_LO) / ky) * (h - T - B);
  const f2At = (x) => F2_HI / Math.exp(((x - L) / (w - L - R)) * kx);
  const f1At = (y) => F1_LO * Math.exp(((y - T) / (h - T - B)) * ky);
  return { D, compact, L, R, T, B, xOf, yOf, f2At, f1At };
}
export function drawVowelMap(s, vowels, cur, trail, now, opts = {}) {
  const ctx = s.begin();
  const { w, h } = s;
  const { D, compact, L, R, T, B, xOf, yOf } = mapGeometry(w, h, opts.detail);

  // Plot area + soft grid
  roundRect(ctx, L - 10, T - 10, w - L - R + 20, h - T - B + 20, 12);
  ctx.fillStyle = 'rgba(255,255,255,.015)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1;
  if (D) {
    // Hz grid: F2 labels along the top, F1 labels on the right
    ctx.font = `500 10px ${C.ui}`; ctx.fillStyle = C.faint; ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.textAlign = 'center'; ctx.textBaseline = compact ? 'top' : 'bottom';
    for (const f of [600, 800, 1000, 1500, 2000, 2500, 3000]) {
      const x = xOf(f);
      ctx.beginPath(); ctx.moveTo(x, T - 10); ctx.lineTo(x, h - B + 10); ctx.stroke();
      // compact: F2 labels along the bottom so they don't collide with the panel title
      ctx.fillText(f >= 1000 ? `${f / 1000}k` : String(f), x, compact ? h - B + 14 : T - 14);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const f of [250, 300, 400, 500, 600, 800, 1000]) {
      const y = yOf(f);
      ctx.beginPath(); ctx.moveTo(L - 10, y); ctx.lineTo(w - R + 10, y); ctx.stroke();
      ctx.fillText(f >= 1000 ? '1k' : String(f), w - R + 14, y);
    }
    if (w > 520 && !compact) {
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillStyle = C.muted;
      ctx.fillText(t('Hz · F2 top · F1 right'), w - 12, T - 32);
    }
  } else {
    for (let i = 1; i < 6; i++) {
      const x = L + (i / 6) * (w - L - R), y = T + (i / 6) * (h - T - B);
      ctx.beginPath(); ctx.moveTo(x, T - 10); ctx.lineTo(x, h - B + 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L - 10, y); ctx.lineTo(w - R + 10, y); ctx.stroke();
    }
  }

  // Axis hints
  ctx.fillStyle = C.faint; ctx.font = `500 12px ${C.ui}`; ctx.textBaseline = 'middle';
  if (!(compact && D)) {
    ctx.textAlign = 'left'; ctx.fillText(t('front'), L - 8, h - B / 2 + 4);
    ctx.textAlign = 'right'; ctx.fillText(t('back'), w - R + 8, h - B / 2 + 4);
  }
  ctx.save(); ctx.translate(L / 2 - 4, 0); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'right'; ctx.fillText(t('close'), -T + 8, 0);
  ctx.textAlign = 'left'; ctx.fillText(t('open'), -(h - B) - 8, 0);
  ctx.restore();

  const r = Math.max(11, Math.min(30, Math.min(w, h) * 0.06, (h - T - B) * 0.1));
  const pts = vowels.map((v) => ({ ...v, x: xOf(v.f2), y: yOf(v.f1) }));
  const extras = (opts.extras || []).map((v) => ({ ...v, x: xOf(v.f2), y: yOf(v.f1), extra: true }));

  // Harmonic lines: a formant can only show where a harmonic of the sung note falls.
  // F1 is the vertical axis, so harmonics k·f0 are horizontal lines.
  if (opts.f0) {
    ctx.font = `600 11px ${C.ui}`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    for (let k = 1; k <= 3; k++) {
      const f = k * opts.f0;
      if (f < F1_LO || f > F1_HI) continue;
      const y = yOf(f);
      ctx.strokeStyle = rgba(C.accent, k === 1 ? 0.35 : 0.2); ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(L - 10, y); ctx.lineTo(w - R + 10, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = rgba(C.accent, 0.7);
      ctx.fillText(D ? `H${k} ${Math.round(f)} Hz` : `H${k}`, w - R + 6, y - 2);
    }
  }

  // Pitch-aware circles: faint ghost at the low-pitch (speech/calibrated) position + a guide line
  for (const p of pts) {
    if (!p.tuned || !p.base0) continue;
    const gx = xOf(p.base0.f2), gy = yOf(p.base0.f1);
    ctx.setLineDash([2, 3]); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(gx, gy, r * 0.75, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(207,213,225,.28)'; ctx.font = `${Math.round(r * 0.6)}px ${C.ipa}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.ipa, gx, gy);
  }

  // Vowel space outline
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke(); ctx.setLineDash([]);

  // Highlight every circle the dot is inside — overlapping (merged) vowels light up together,
  // which is the honest answer at high pitch. Otherwise the nearest one if close.
  const activeSet = new Set();
  if (cur) {
    const cx = xOf(cur.f2), cy = yOf(cur.f1);
    let best = Infinity, nearest = null;
    for (const p of [...pts, ...extras]) {
      const d = Math.hypot(p.x - cx, p.y - cy) * (p.extra ? 1.4 : 1);
      if (d <= r * 1.05) activeSet.add(p);
      if (d < best) { best = d; nearest = p; }
    }
    if (!activeSet.size && best <= r * 1.5) activeSet.add(nearest);
  }

  // Extra IPA landmarks (Detailed UI): small, no fill
  for (const p of extras) {
    const on = activeSet.has(p);
    ctx.fillStyle = on ? C.green : 'rgba(207,213,225,.5)';
    ctx.font = `${on ? 600 : 400} ${Math.round(r * 0.7)}px ${C.ipa}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.ipa, p.x, p.y);
    if (on) { ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.65, 0, Math.PI * 2); ctx.strokeStyle = C.green; ctx.lineWidth = 1.5; ctx.stroke(); }
  }

  for (const p of pts) {
    const on = activeSet.has(p);
    const cal = !!opts.calibrated;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = on ? rgba(C.green, 0.16) : cal ? 'rgba(124,196,255,.10)' : 'rgba(124,196,255,.05)';
    ctx.fill();
    ctx.lineWidth = on ? 2 : cal ? 1.5 : 1;
    if (p.interpolated) ctx.setLineDash([3, 3]);
    ctx.strokeStyle = on ? C.green : cal ? rgba(C.accent, 0.55) : 'rgba(255,255,255,.16)';
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = on ? C.green : '#cfd5e1';
    ctx.font = `${on ? 600 : 400} ${Math.round(r * 0.95)}px ${C.ipa}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.ipa, p.x, p.y + 1);
  }

  // Trail
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let prev = null;
  for (const p of trail) {
    const age = now - p.t;
    if (age > 1.5) { prev = null; continue; }
    if (prev && p.t - prev.t < 0.15) {
      ctx.strokeStyle = rgba(C.accent, 0.55 * (1 - age / 1.5));
      ctx.lineWidth = 1 + 3 * (1 - age / 1.5);
      ctx.beginPath(); ctx.moveTo(xOf(prev.f2), yOf(prev.f1)); ctx.lineTo(xOf(p.f2), yOf(p.f1)); ctx.stroke();
    }
    prev = p;
  }

  // Synth target (what you set): crosshair; drag on the map to move it
  if (opts.target) {
    const x = xOf(opts.target.f2), y = yOf(opts.target.f1);
    ctx.save();
    ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, T - 10); ctx.lineTo(x, h - B + 10); ctx.moveTo(L - 10, y); ctx.lineTo(w - R + 10, y);
    ctx.globalAlpha = 0.35; ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 17, y); ctx.lineTo(x - 7, y); ctx.moveTo(x + 7, y); ctx.lineTo(x + 17, y);
    ctx.moveTo(x, y - 17); ctx.lineTo(x, y - 7); ctx.moveTo(x, y + 7); ctx.lineTo(x, y + 17); ctx.stroke();
    ctx.font = `600 11px ${C.ui}`; ctx.fillStyle = C.accent; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    const lab = t(opts.targetLabel || 'set');
    ctx.fillText(D ? `${lab} ${Math.round(opts.target.f1)} / ${Math.round(opts.target.f2)}` : lab, x + 14, y - 10);
    ctx.restore();
  }

  // Current vowel
  if (cur) {
    const x = Math.max(L - 8, Math.min(w - R + 8, xOf(cur.f2)));
    const y = Math.max(T - 8, Math.min(h - B + 8, yOf(cur.f1)));
    ctx.save();
    ctx.shadowColor = C.accent; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
    if (opts.uncertain) {
      ctx.lineWidth = 2.5; ctx.strokeStyle = C.accent; ctx.stroke();
    } else {
      ctx.fillStyle = C.accent; ctx.fill();
      ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
    ctx.restore();
    if (D) {
      const label = `F1 ${Math.round(cur.f1)} · F2 ${Math.round(cur.f2)}`;
      ctx.font = `600 12px ${C.ui}`; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(label).width;
      const lx = x + 16 + tw > w - 8 ? x - 16 - tw : x + 16;
      ctx.fillStyle = 'rgba(11,13,18,.75)';
      roundRect(ctx, lx - 6, y - 10, tw + 12, 20, 6); ctx.fill();
      ctx.fillStyle = C.text; ctx.textAlign = 'left'; ctx.fillText(label, lx, y);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Input level meter                                                   */
/* ------------------------------------------------------------------ */
const DB_MIN = -60;
/**
 * Level bar layout shared by the renderer and pointer input (CSS px of the canvas).
 * Tall canvas (desktop side column): vertical bar, 0 dB at the top. Wide canvas (phone): horizontal, 0 dB at the right.
 */
export function meterGeometry(w, h, detail = false) {
  const vertical = h > w, bw = 14;
  const frac = (db) => (Math.max(DB_MIN, Math.min(0, db)) - DB_MIN) / -DB_MIN;
  if (vertical) {
    const x = detail ? w - 14 - bw : (w - bw) / 2, y0 = 40, y1 = h - 16; // y0: below the panel label
    return { vertical, bw, x, y0, y1, pos: (db) => y1 - frac(db) * (y1 - y0), dbAt: (_px, py) => DB_MIN + ((y1 - py) / (y1 - y0)) * -DB_MIN };
  }
  const x0 = 16, x1 = w - 16, y = detail ? h - 34 : h - 26;
  return { vertical, bw, x0, x1, y, pos: (db) => x0 + frac(db) * (x1 - x0), dbAt: (px) => DB_MIN + ((px - x0) / (x1 - x0)) * -DB_MIN };
}

/** Level bar: current RMS in zones (quiet / good / hot) with peak hold; opts.target = synth volume marker. */
export function drawMeter(s, rmsDb, peakHoldDb, opts = {}) {
  const ctx = s.begin();
  const { w, h } = s;
  const D = !!opts.detail;
  const g = meterGeometry(w, h, D), { bw } = g;
  // Rect of the span a..b along the bar
  const rect = (a, b, pad = 0) => {
    const pa = g.pos(a), pb = g.pos(b);
    return g.vertical ? [g.x - pad, Math.min(pa, pb), bw + 2 * pad, Math.abs(pb - pa)] : [Math.min(pa, pb), g.y - pad, Math.abs(pb - pa), bw + 2 * pad];
  };
  roundRect(ctx, ...rect(DB_MIN, 0), bw / 2); ctx.fillStyle = C.track; ctx.fill();
  ctx.save();
  roundRect(ctx, ...rect(DB_MIN, 0), bw / 2); ctx.clip();
  const lvl = Math.max(DB_MIN, Math.min(0, rmsDb));
  const seg = (a, b, col) => { const top = Math.min(b, lvl); if (top > a) { ctx.fillStyle = col; ctx.fillRect(...rect(a, top)); } };
  seg(DB_MIN, -45, C.faint);
  seg(-45, -6, C.green);
  seg(-6, 0, C.orange);
  ctx.fillStyle = 'rgba(11,13,18,.55)'; // LED segments
  for (let db = DB_MIN + 1.5; db < 0; db += 1.5) ctx.fillRect(...(g.vertical ? [g.x, g.pos(db), bw, 1.5] : [g.pos(db), g.y, 1.5, bw]));
  ctx.restore();
  ctx.fillStyle = '#fff';
  if (peakHoldDb > DB_MIN) ctx.fillRect(...(g.vertical ? [g.x - 3, g.pos(peakHoldDb) - 1, bw + 6, 2] : [g.pos(peakHoldDb) - 1, g.y - 3, 2, bw + 6]));

  // Synthesize: the set volume, dragged along the bar
  if (opts.target != null) {
    const p = g.pos(opts.target);
    ctx.fillStyle = C.accent;
    if (g.vertical) { roundRect(ctx, g.x - 5, p - 2, bw + 10, 4, 2); ctx.fill(); }
    else { roundRect(ctx, p - 2, g.y - 5, 4, bw + 10, 2); ctx.fill(); }
  }

  if (D) {
    ctx.font = `500 11px ${C.ui}`; ctx.fillStyle = C.faint;
    for (const db of [-60, -45, -30, -18, -6, 0]) {
      const p = g.pos(db);
      if (g.vertical) { ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(String(db), g.x - 6, p); }
      else {
        ctx.textAlign = db === -60 ? 'left' : db === 0 ? 'right' : 'center'; ctx.textBaseline = 'top';
        ctx.fillText(db === -60 ? '-60 dB' : String(db), p, g.y + bw + 4);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Vibrato indicator (rate scale with the published "typical" band)    */
/* ------------------------------------------------------------------ */
export function drawVibrato(s, v, opts = {}) {
  const ctx = s.begin();
  const { w, h } = s;
  const [bLo, bHi] = opts.rateBand, best = opts.rateBest, [eLo, eHi] = opts.extentBand;
  const LO = 3.5, HI = 8.5, x0 = 10, x1 = w - 10, y = h - 13;
  const tx = x1 - 18; // leave room for the hide (×) button in the top-right corner
  const xOf = (hz) => x0 + ((Math.max(LO, Math.min(HI, hz)) - LO) / (HI - LO)) * (x1 - x0);
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 8);
  ctx.fillStyle = 'rgba(11,13,18,.72)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.stroke();
  ctx.font = `600 11px ${C.ui}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = C.muted; ctx.fillText(t('VIBRATO'), x0, 12);

  // scale: track, typical band, "most appropriate" tick
  roundRect(ctx, x0, y - 3, x1 - x0, 6, 3); ctx.fillStyle = C.track; ctx.fill();
  ctx.fillStyle = rgba(C.green, 0.35); ctx.fillRect(xOf(bLo), y - 3, xOf(bHi) - xOf(bLo), 6);
  ctx.fillStyle = rgba(C.green, 0.9); ctx.fillRect(xOf(best) - 0.75, y - 6, 1.5, 12);
  if (opts.detail) {
    ctx.font = `500 9px ${C.ui}`; ctx.fillStyle = C.faint; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const hz of [4, 5, 6, 7, 8]) ctx.fillText(String(hz), xOf(hz), y + 4);
    ctx.textBaseline = 'middle';
  }

  ctx.textAlign = 'right'; ctx.font = `600 12px ${C.ui}`;
  if (!v) { ctx.fillStyle = C.faint; ctx.fillText(t('hold a note'), tx, 12); return; }
  if (!v.present) { ctx.fillStyle = C.muted; ctx.fillText(t('straight tone'), tx, 12); return; }

  const rateWord0 = v.rate < bLo - 0.5 ? 'slow' : v.rate < bLo ? 'a little slow' : v.rate <= bHi ? 'typical'
    : v.rate <= bHi + 0.8 ? 'a little fast' : 'fast';
  const rateWord = t(rateWord0);
  const extWord = t(v.extent < eLo ? 'narrow' : v.extent > eHi ? 'wide' : '');
  const inRate = v.rate >= bLo && v.rate <= bHi, nearRate = v.rate >= bLo - 0.5 && v.rate <= bHi + 0.8;
  const col = inRate ? C.green : nearRate ? C.orange : C.muted;
  const txt = opts.detail
    ? `${v.rate.toFixed(1)} Hz · ±${Math.round(v.extent)}¢`
    : `${rateWord}${extWord ? ' · ' + extWord : ''}`;
  ctx.fillStyle = col; ctx.fillText(txt, tx, 12);
  if (opts.detail && extWord) { ctx.font = `500 11px ${C.ui}`; ctx.fillStyle = C.orange; ctx.fillText(extWord, tx - ctx.measureText(txt).width - 30, 12); }
  // marker
  ctx.save();
  ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = inRate ? 8 : 0;
  ctx.beginPath(); ctx.arc(xOf(v.rate), y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
