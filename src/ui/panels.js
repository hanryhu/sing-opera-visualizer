// Canvas renderers for the four dashboard panels.

import { nearestStep, stepName, stepOctave, midiToFreq } from '../dsp/pitch.js';

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
    ctx.font = `500 9px ${C.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
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
  const rows = h < 150 ? 4 : 5;
  const rowPx = (h - top - bottom) / rows;
  const yOf = (m) => top + (h - top - bottom) / 2 - (m - centerMidi) * rowPx;
  const xOf = (t) => w - right - ((now - t) / window) * (w - left - right);
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
    let name = stepName(n);
    if (opts.detail) name += stepOctave(n);
    ctx.font = `${isCur ? 700 : 500} ${isCur ? 14 : isQuarter ? 10 : 12}px ${C.ui}`;
    ctx.fillStyle = isCur ? C.text : C.faint;
    ctx.fillText(name, opts.detail ? left - 50 : left - 10, y);
    if (opts.detail && (!isQuarter || rowPx > 30)) {
      ctx.font = `400 10px ${C.ui}`; ctx.fillStyle = C.faint;
      ctx.fillText(midiToFreq(n, opts.a4).toFixed(1), left - 8, y);
    }
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
export function drawF3(s, f3, trail, ring, now, opts = {}) {
  const ctx = s.begin();
  const { w, h } = s;
  const ringH = 46;
  const wide = w >= 220;
  const pair = opts.pair; // {unrounded, rounded} for the current tongue position
  const barW = Math.min(40, w * 0.3);
  const bx = wide ? Math.round(w * 0.36 - barW / 2) : (w - barW) / 2;
  const barTop = wide ? 40 : 86, barBot = h - (wide ? ringH + 12 : 56 + ringH);
  const yOf = (f) => barBot - (Math.log(f / F3_LO) / Math.log(F3_HI / F3_LO)) * (barBot - barTop);

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
    ctx.fillText(tiny ? (txt === 'unrounded' ? 'unrnd' : 'rnd') : txt, x, y);
  };
  if (wide) {
    const lx = Math.min(w - 50, bx + barW + 100);
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
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.stroke();

  // Detailed: Hz scale on the left of the bar
  if (opts.detail) {
    ctx.font = `500 9px ${C.ui}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const f of [2000, 2500, 2800, 3000, 3400, 4000]) {
      const y = yOf(f);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(bx - 5, y - 0.5, 4, 1);
      ctx.fillStyle = C.faint; ctx.fillText(f >= 4000 ? '4k' : (f / 1000).toFixed(1) + 'k', bx - 8, y);
    }
  }

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
    if (opts.detail) {
      ctx.font = `600 10px ${C.ui}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = C.text;
      if (bx + barW + 52 <= w) ctx.fillText(Math.round(f3), bx + barW + 23, y);
      else { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(Math.round(f3), w - 6, y - 8); }
    }
  }

  // Ring meter
  const ry = h - ringH + 6;
  ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(12, ry - 12, w - 24, 1);
  ctx.textAlign = 'left'; ctx.fillStyle = C.muted; ctx.font = `600 10px ${C.ui}`;
  if (!tiny) ctx.fillText('RING', 14, ry + 6);
  const mx = tiny ? 10 : 50, mw = w - mx - (tiny ? 10 : 14);
  roundRect(ctx, mx, ry, mw, 8, 4); ctx.fillStyle = C.track; ctx.fill();
  if (ring) {
    const v = Math.max(0, Math.min(1, (ring + 30) / 30)); // −30 dB … 0 dB
    const rg = ctx.createLinearGradient(mx, 0, mx + mw, 0);
    rg.addColorStop(0, rgba(C.accent, 0.5)); rg.addColorStop(1, C.green);
    roundRect(ctx, mx, ry, mw * v, 8, 4); ctx.fillStyle = rg; ctx.fill();
    if (opts.detail) {
      ctx.font = `500 9px ${C.ui}`; ctx.textAlign = 'right'; ctx.fillStyle = C.muted;
      ctx.fillText(`${ring.toFixed(0)} dB`, w - 14, ry + 20);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Vowel map: F2 (x, reversed) × F1 (y)                                */
/* ------------------------------------------------------------------ */
const F2_HI = 3200, F2_LO = 580, F1_LO = 220, F1_HI = 1200;
export function drawVowelMap(s, vowels, cur, trail, now, opts = {}) {
  const ctx = s.begin();
  const { w, h } = s;
  const D = !!opts.detail;
  const compact = h < 300; // short panel (laptop thirds layout): tighter margins
  const L = 44, R = D ? 40 : 24, T = compact ? 36 : D ? 62 : 44, B = compact && D ? 40 : compact ? 30 : 36;
  const xOf = (f2) => L + (Math.log(F2_HI / f2) / Math.log(F2_HI / F2_LO)) * (w - L - R);
  const yOf = (f1) => T + (Math.log(f1 / F1_LO) / Math.log(F1_HI / F1_LO)) * (h - T - B);

  // Plot area + soft grid
  roundRect(ctx, L - 10, T - 10, w - L - R + 20, h - T - B + 20, 12);
  ctx.fillStyle = 'rgba(255,255,255,.015)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1;
  if (D) {
    // Hz grid: F2 labels along the top, F1 labels on the right
    ctx.font = `500 9px ${C.ui}`; ctx.fillStyle = C.faint; ctx.strokeStyle = 'rgba(255,255,255,.06)';
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
      ctx.fillText('Hz · F2 top · F1 right', w - 12, T - 32);
    }
  } else {
    for (let i = 1; i < 6; i++) {
      const x = L + (i / 6) * (w - L - R), y = T + (i / 6) * (h - T - B);
      ctx.beginPath(); ctx.moveTo(x, T - 10); ctx.lineTo(x, h - B + 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L - 10, y); ctx.lineTo(w - R + 10, y); ctx.stroke();
    }
  }

  // Axis hints
  ctx.fillStyle = C.faint; ctx.font = `500 11px ${C.ui}`; ctx.textBaseline = 'middle';
  if (!(compact && D)) {
    ctx.textAlign = 'left'; ctx.fillText('front', L - 8, h - B / 2 + 4);
    ctx.textAlign = 'right'; ctx.fillText('back', w - R + 8, h - B / 2 + 4);
  }
  ctx.save(); ctx.translate(L / 2 - 4, 0); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'right'; ctx.fillText('close', -T + 8, 0);
  ctx.textAlign = 'left'; ctx.fillText('open', -(h - B) - 8, 0);
  ctx.restore();

  const r = Math.max(11, Math.min(30, Math.min(w, h) * 0.06, (h - T - B) * 0.1));
  const pts = vowels.map((v) => ({ ...v, x: xOf(v.f2), y: yOf(v.f1) }));
  const extras = (opts.extras || []).map((v) => ({ ...v, x: xOf(v.f2), y: yOf(v.f1), extra: true }));

  // Vowel space outline
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke(); ctx.setLineDash([]);

  // Nearest landmark (main or extra)
  let active = null;
  if (cur) {
    const cx = xOf(cur.f2), cy = yOf(cur.f1);
    let best = Infinity;
    for (const p of [...pts, ...extras]) {
      const d = Math.hypot(p.x - cx, p.y - cy) * (p.extra ? 1.4 : 1);
      if (d < best) { best = d; active = p; }
    }
    if (best > r * 1.5) active = null;
  }

  // Extra IPA landmarks (Detailed UI): small, no fill
  for (const p of extras) {
    const on = p === active;
    ctx.fillStyle = on ? C.green : 'rgba(207,213,225,.5)';
    ctx.font = `${on ? 600 : 400} ${Math.round(r * 0.7)}px ${C.ipa}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.ipa, p.x, p.y);
    if (on) { ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.65, 0, Math.PI * 2); ctx.strokeStyle = C.green; ctx.lineWidth = 1.5; ctx.stroke(); }
  }

  for (const p of pts) {
    const on = p === active;
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
      ctx.font = `600 11px ${C.ui}`; ctx.textBaseline = 'middle';
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
 * Level bar (current RMS + peak hold) and, when there is room, a scrolling level history.
 * @param {{t:number, db:number, clip?:boolean}[]} hist
 */
export function drawMeter(s, rmsDb, peakHoldDb, opts = {}, hist = [], now = 0) {
  const ctx = s.begin();
  const { w, h } = s;
  const D = !!opts.detail;
  const x0 = 16, x1 = w - 16, bh = 14;
  const y = h < 90 ? h / 2 - 9 : 34;
  const xOf = (db) => x0 + ((Math.max(DB_MIN, Math.min(0, db)) - DB_MIN) / -DB_MIN) * (x1 - x0);

  // ---- bar ----
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
  ctx.fillStyle = 'rgba(11,13,18,.55)';
  for (let x = x0 + 6; x < x1; x += 6) ctx.fillRect(x, y, 1.5, bh);
  ctx.restore();
  if (peakHoldDb > DB_MIN) { ctx.fillStyle = '#fff'; ctx.fillRect(xOf(peakHoldDb) - 1, y - 3, 2, bh + 6); }

  ctx.font = `500 10px ${C.ui}`; ctx.fillStyle = C.faint; ctx.textBaseline = 'top';
  if (D) {
    for (const db of [-60, -45, -30, -18, -6, 0]) {
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(xOf(db) - 0.5, y + bh + 2, 1, 4);
      ctx.fillStyle = C.faint;
      ctx.textAlign = db === -60 ? 'left' : db === 0 ? 'right' : 'center';
      ctx.fillText(`${db} dB`, xOf(db), y + bh + 6);
    }
  } else {
    ctx.textAlign = 'left'; ctx.fillText('quiet', x0, y + bh + 6);
    ctx.textAlign = 'center'; ctx.fillText('good', (xOf(-45) + xOf(-6)) / 2, y + bh + 6);
    ctx.textAlign = 'right'; ctx.fillText('max', x1, y + bh + 6);
    ctx.fillStyle = 'rgba(255,255,255,.15)';
    ctx.fillRect(xOf(-45) - 0.5, y + bh + 2, 1, 4);
    ctx.fillRect(xOf(-6) - 0.5, y + bh + 2, 1, 4);
  }

  // ---- history ----
  const hy0 = y + bh + 30, hy1 = h - 12;
  if (hy1 - hy0 < 30) return;
  const span = 8; // seconds
  const hx = (t) => x1 - ((now - t) / span) * (x1 - x0);
  const hyOf = (db) => hy1 - ((Math.max(DB_MIN, Math.min(0, db)) - DB_MIN) / -DB_MIN) * (hy1 - hy0);

  roundRect(ctx, x0, hy0, x1 - x0, hy1 - hy0, 8);
  ctx.fillStyle = 'rgba(255,255,255,.015)'; ctx.fill();
  // zone guides
  ctx.setLineDash([3, 5]); ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(C.orange, 0.35);
  ctx.beginPath(); ctx.moveTo(x0, hyOf(-6)); ctx.lineTo(x1, hyOf(-6)); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.beginPath(); ctx.moveTo(x0, hyOf(-45)); ctx.lineTo(x1, hyOf(-45)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `500 10px ${C.ui}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = rgba(C.orange, 0.7); ctx.fillText(D ? '−6 dB' : 'loud', x0 + 6, hyOf(-6) - 2);
  ctx.fillStyle = C.faint; ctx.fillText(D ? '−45 dB' : 'quiet', x0 + 6, hyOf(-45) - 2);

  const pts = hist.filter((p) => now - p.t <= span);
  if (pts.length > 1) {
    ctx.save();
    roundRect(ctx, x0, hy0, x1 - x0, hy1 - hy0, 8); ctx.clip();
    ctx.beginPath();
    ctx.moveTo(hx(pts[0].t), hy1);
    for (const p of pts) ctx.lineTo(hx(p.t), hyOf(p.db));
    ctx.lineTo(hx(pts[pts.length - 1].t), hy1);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, hy0, 0, hy1);
    g.addColorStop(0, rgba(C.orange, 0.35));
    g.addColorStop((hyOf(-6) - hy0) / (hy1 - hy0), rgba(C.green, 0.3));
    g.addColorStop(1, rgba(C.green, 0.04));
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(hx(p.t), hyOf(p.db)) : ctx.moveTo(hx(p.t), hyOf(p.db))));
    ctx.strokeStyle = C.green; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#ff4d5e';
    for (const p of pts) if (p.clip) ctx.fillRect(hx(p.t) - 1, hy0, 2, hy1 - hy0);
    ctx.restore();
  }
}
