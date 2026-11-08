// Canvas renderers for the four dashboard panels.

import { NOTE_NAMES } from '../dsp/pitch.js';

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

/* ------------------------------------------------------------------ */
/* Tuner gauge: −50…+50 cents                                          */
/* ------------------------------------------------------------------ */
export function drawGauge(s, cents, rawCents, state) {
  const ctx = s.begin();
  const { w, h } = s;
  const pad = 22, y = h / 2 - 4, th = 8;
  const x = (c) => pad + ((Math.max(-50, Math.min(50, c)) + 50) / 100) * (w - 2 * pad);

  roundRect(ctx, pad, y - th / 2, w - 2 * pad, th, th / 2);
  ctx.fillStyle = C.track; ctx.fill();
  ctx.fillStyle = rgba(C.orange, 0.28);
  roundRect(ctx, x(-30), y - th / 2, x(30) - x(-30), th, 2); ctx.fill();
  ctx.fillStyle = rgba(C.green, 0.55);
  roundRect(ctx, x(-10), y - th / 2, x(10) - x(-10), th, 2); ctx.fill();

  ctx.fillStyle = C.faint;
  for (const c of [-50, -25, 25, 50]) ctx.fillRect(x(c) - 0.5, y + 8, 1, 4);
  ctx.fillRect(x(0) - 0.5, y + 7, 1, 7);

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
export function drawTrace(s, hist, now, centerMidi, window = 4) {
  const ctx = s.begin();
  const { w, h } = s;
  const left = 46, right = 14, top = 10, bottom = 10;
  const rows = h < 150 ? 4 : 5;
  const rowPx = (h - top - bottom) / rows;
  const yOf = (m) => top + (h - top - bottom) / 2 - (m - centerMidi) * rowPx;
  const xOf = (t) => w - right - ((now - t) / window) * (w - left - right);

  const lo = Math.floor(centerMidi - rows / 2 - 1), hi = Math.ceil(centerMidi + rows / 2 + 1);
  const current = hist.length ? Math.round(hist[hist.length - 1].mean || 0) : null;
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let n = lo; n <= hi; n++) {
    const y = yOf(n);
    if (y < -rowPx || y > h + rowPx) continue;
    const isCur = n === current && now - hist[hist.length - 1].t < 0.2;
    // ±10 cent band (in tune) and the note line
    const band = 0.1 * rowPx;
    ctx.fillStyle = rgba(C.green, isCur ? 0.16 : 0.06);
    ctx.fillRect(left, y - band, w - left - right, band * 2);
    ctx.fillStyle = isCur ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.07)';
    ctx.fillRect(left, y - 0.5, w - left - right, 1);
    const name = NOTE_NAMES[((n % 12) + 12) % 12];
    ctx.font = `${isCur ? 700 : 500} ${isCur ? 14 : 12}px ${C.ui}`;
    ctx.fillStyle = isCur ? C.text : C.faint;
    ctx.fillText(name, left - 10, y);
  }

  // Trace
  ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  let prev = null;
  for (const p of hist) {
    if (now - p.t > window) { prev = null; continue; }
    if (prev && p.t - prev.t < 0.12) {
      ctx.strokeStyle = stateColor(p.state);
      ctx.globalAlpha = 0.35 + 0.65 * (1 - (now - p.t) / window);
      ctx.beginPath();
      ctx.moveTo(xOf(prev.t), yOf(prev.midi));
      ctx.lineTo(xOf(p.t), yOf(p.midi));
      ctx.stroke();
    }
    prev = p;
  }
  ctx.globalAlpha = 1;
  const last = hist[hist.length - 1];
  if (last && now - last.t < 0.15) {
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
export function drawF3(s, f3, trail, ring, now) {
  const ctx = s.begin();
  const { w, h } = s;
  const top = 86, ringH = 46, bottom = 56 + ringH;
  const barW = Math.min(40, w * 0.3), bx = (w - barW) / 2;
  const barTop = top, barBot = h - bottom;
  const yOf = (f) => barBot - (Math.log(f / F3_LO) / Math.log(F3_HI / F3_LO)) * (barBot - barTop);

  // End labels
  ctx.textAlign = 'center';
  ctx.fillStyle = C.muted; ctx.font = `500 11px ${C.ui}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('unrounded', w / 2, top - 40);
  ctx.fillStyle = C.text; ctx.font = `20px ${C.ipa}`;
  ctx.fillText('i  e', w / 2, top - 14);
  ctx.fillText('u  o', w / 2, barBot + 30);
  ctx.fillStyle = C.muted; ctx.font = `500 11px ${C.ui}`;
  ctx.fillText('rounded', w / 2, barBot + 48);

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
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.stroke();

  // Trail ticks
  for (const p of trail) {
    const age = now - p.t;
    if (age > 1.2) continue;
    ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - age / 1.2)})`;
    ctx.fillRect(bx - 4, yOf(p.f3) - 0.75, barW + 8, 1.5);
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
  }

  // Ring meter
  const ry = h - ringH + 6;
  ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(12, ry - 12, w - 24, 1);
  ctx.textAlign = 'left'; ctx.fillStyle = C.muted; ctx.font = `600 10px ${C.ui}`;
  ctx.fillText('RING', 14, ry + 6);
  const mx = 50, mw = w - mx - 14;
  roundRect(ctx, mx, ry, mw, 8, 4); ctx.fillStyle = C.track; ctx.fill();
  if (ring) {
    const v = Math.max(0, Math.min(1, (ring + 30) / 30)); // −30 dB … 0 dB
    const rg = ctx.createLinearGradient(mx, 0, mx + mw, 0);
    rg.addColorStop(0, rgba(C.accent, 0.5)); rg.addColorStop(1, C.green);
    roundRect(ctx, mx, ry, mw * v, 8, 4); ctx.fillStyle = rg; ctx.fill();
  }
}

/* ------------------------------------------------------------------ */
/* Vowel map: F2 (x, reversed) × F1 (y)                                */
/* ------------------------------------------------------------------ */
const F2_HI = 3200, F2_LO = 580, F1_LO = 220, F1_HI = 1050;
export function drawVowelMap(s, vowels, cur, trail, now, opts = {}) {
  const ctx = s.begin();
  const { w, h } = s;
  const L = 44, R = 24, T = 44, B = 36;
  const xOf = (f2) => L + (Math.log(F2_HI / f2) / Math.log(F2_HI / F2_LO)) * (w - L - R);
  const yOf = (f1) => T + (Math.log(f1 / F1_LO) / Math.log(F1_HI / F1_LO)) * (h - T - B);

  // Plot area + soft grid
  roundRect(ctx, L - 10, T - 10, w - L - R + 20, h - T - B + 20, 12);
  ctx.fillStyle = 'rgba(255,255,255,.015)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const x = L + (i / 6) * (w - L - R), y = T + (i / 6) * (h - T - B);
    ctx.beginPath(); ctx.moveTo(x, T - 10); ctx.lineTo(x, h - B + 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(L - 10, y); ctx.lineTo(w - R + 10, y); ctx.stroke();
  }

  // Axis hints (coarse, no Hz)
  ctx.fillStyle = C.faint; ctx.font = `500 11px ${C.ui}`; ctx.textBaseline = 'middle';
  ctx.textAlign = 'left'; ctx.fillText('front', L - 8, h - B / 2 + 4);
  ctx.textAlign = 'right'; ctx.fillText('back', w - R + 8, h - B / 2 + 4);
  ctx.save(); ctx.translate(L / 2 - 4, 0); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'right'; ctx.fillText('close', -T + 8, 0);
  ctx.textAlign = 'left'; ctx.fillText('open', -(h - B) - 8, 0);
  ctx.restore();

  const r = Math.max(17, Math.min(30, Math.min(w, h) * 0.06));
  const pts = vowels.map((v) => ({ ...v, x: xOf(v.f2), y: yOf(v.f1) }));

  // Vowel space outline
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke(); ctx.setLineDash([]);

  // Nearest landmark
  let active = null;
  if (cur) {
    const cx = xOf(cur.f2), cy = yOf(cur.f1);
    let best = Infinity;
    for (const p of pts) {
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < best) { best = d; active = p; }
    }
    if (best > r * 1.5) active = null;
  }

  for (const p of pts) {
    const on = p === active;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = on ? rgba(C.green, 0.16) : 'rgba(124,196,255,.05)'; ctx.fill();
    ctx.lineWidth = on ? 2 : 1;
    ctx.strokeStyle = on ? C.green : 'rgba(255,255,255,.16)'; ctx.stroke();
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
  }
}

/* ------------------------------------------------------------------ */
/* Input level meter                                                   */
/* ------------------------------------------------------------------ */
const DB_MIN = -60;
export function drawMeter(s, rmsDb, peakHoldDb) {
  const ctx = s.begin();
  const { w, h } = s;
  const x0 = 8, x1 = w - 8, y = h / 2 - 9, bh = 12;
  const xOf = (db) => x0 + ((Math.max(DB_MIN, Math.min(0, db)) - DB_MIN) / -DB_MIN) * (x1 - x0);

  roundRect(ctx, x0, y, x1 - x0, bh, bh / 2); ctx.fillStyle = C.track; ctx.fill();
  ctx.save();
  roundRect(ctx, x0, y, x1 - x0, bh, bh / 2); ctx.clip();
  const lvl = xOf(rmsDb);
  const seg = (a, b, col) => {
    const xa = xOf(a), xb = Math.min(xOf(b), lvl);
    if (xb > xa) { ctx.fillStyle = col; ctx.fillRect(xa, y, xb - xa, bh); }
  };
  seg(DB_MIN, -45, C.faint);
  seg(-45, -6, C.green);
  seg(-6, 0, C.orange);
  // segment separators for a hardware-meter feel
  ctx.fillStyle = 'rgba(11,13,18,.55)';
  for (let x = x0 + 6; x < x1; x += 6) ctx.fillRect(x, y, 1.5, bh);
  ctx.restore();

  if (peakHoldDb > DB_MIN) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(xOf(peakHoldDb) - 1, y - 3, 2, bh + 6);
  }

  ctx.font = `500 10px ${C.ui}`; ctx.fillStyle = C.faint; ctx.textBaseline = 'top';
  ctx.textAlign = 'left'; ctx.fillText('quiet', x0, y + bh + 6);
  ctx.textAlign = 'center'; ctx.fillText('good', (xOf(-45) + xOf(-6)) / 2, y + bh + 6);
  ctx.textAlign = 'right'; ctx.fillText('max', x1, y + bh + 6);
  ctx.fillStyle = 'rgba(255,255,255,.15)';
  ctx.fillRect(xOf(-45) - 0.5, y + bh + 2, 1, 4);
  ctx.fillRect(xOf(-6) - 0.5, y + bh + 2, 1, 4);
}
