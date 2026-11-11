// Rhythm for Learn: meters, note values and a generator that fills bars with "feet" (a strong note and
// the weaker notes after it, the way syllables group around a stress), so accents land on strong beats.
// Durations are in quarter notes.

/** Meters: beat lengths (quarters) and which beats are strong. */
export const METERS = {
  cut: { num: 2, den: 2, beats: [2, 2], strong: [0] },
  '2/4': { num: 2, den: 4, beats: [1, 1], strong: [0] },
  '3/4': { num: 3, den: 4, beats: [1, 1, 1], strong: [0] },
  '4/4': { num: 4, den: 4, beats: [1, 1, 1, 1], strong: [0, 2] },
  '5/4': { num: 5, den: 4, beats: [1, 1, 1, 1, 1], strong: [0, 3] },
  '6/8': { num: 6, den: 8, beats: [1.5, 1.5], strong: [0], compound: true },
  '9/8': { num: 9, den: 8, beats: [1.5, 1.5, 1.5], strong: [0], compound: true },
  '12/8': { num: 12, den: 8, beats: [1.5, 1.5, 1.5, 1.5], strong: [0, 2], compound: true },
  '7/8': { num: 7, den: 8, beats: [1, 1, 1.5], strong: [0] },
};
/** Time signature choices in the menu; 'other' draws from the less common meters. */
export const SIG_CHOICES = ['cut', '3/4', '4/4', '6/8', 'other'];
const OTHER = ['2/4', '5/4', '9/8', '12/8', '7/8'];
export const NOTE_VALUES = ['16', '8', 'q', 'h', 'w'];
const BASE = { 16: 0.25, 8: 0.5, q: 1, h: 2, w: 4 };

export const DEFAULT_RHYTHM = { values: ['8', 'q', 'h', 'w'], dotted: true, triplets: false, ties: false };
export const DEFAULT_TEMPO = { sigs: ['4/4'], changes: false, min: 3, max: 6 };

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const EPS = 1e-6;
const eq = (a, b) => Math.abs(a - b) < EPS;

/** How a duration is written: base value, dots, tuplet (3 = triplet). Null if not writable as one note. */
export function noteType(d) {
  const table = [[4, 'w', 0], [3, 'h', 1], [2, 'h', 0], [1.5, 'q', 1], [1, 'q', 0], [0.75, '8', 1], [0.5, '8', 0], [0.25, '16', 0]];
  for (const [v, base, dots] of table) if (eq(d, v)) return { base, dots, tuplet: 0 };
  if (eq(d, 2 / 3)) return { base: 'q', dots: 0, tuplet: 3 };
  if (eq(d, 1 / 3)) return { base: '8', dots: 0, tuplet: 3 };
  return null;
}

/** Durations allowed by the Rhythm settings (plain and dotted). */
function allowedDurations(R, meter) {
  const out = [];
  for (const v of R.values) {
    out.push(BASE[v]);
    if (R.dotted && v !== '16' && v !== 'w') out.push(BASE[v] * 1.5); // dotted 8th, quarter, half
  }
  // compound meters are built on the dotted quarter: allow it whenever quarters are allowed
  if (meter.compound && R.values.includes('q') && !out.includes(1.5)) out.push(1.5);
  return [...new Set(out)].sort((a, b) => b - a);
}

/**
 * All ways to fill [from, to) of a bar with k notes. Rules of good notation: a note that starts off the
 * beat ends by the next beat; a note never crosses the middle of the bar unless it starts on the downbeat
 * (4/4, 12/8); triplets fill one simple beat (or a half note in cut time).
 */
function patterns(meter, from, to, k, D, triplets) {
  const bounds = [0];
  meter.beats.forEach((b) => bounds.push(bounds[bounds.length - 1] + b));
  const onBeat = (x) => bounds.some((b) => eq(b, x));
  const nextBeat = (x) => bounds.find((b) => b > x + EPS) ?? bounds[bounds.length - 1];
  const half = meter.strong.length > 1 ? bounds[meter.strong[1]] : null;
  const res = [];
  const rec = (pos, left, acc) => {
    if (res.length > 300) return;
    if (eq(pos, to)) { if (left === 0) res.push(acc); return; }
    if (left === 0 || pos > to + EPS) return;
    // triplet group on a simple beat (quarter, or half in cut time)
    const beatLen = nextBeat(pos) - pos;
    if (triplets && onBeat(pos) && !meter.compound && (eq(beatLen, 1) || eq(beatLen, 2)) && pos + beatLen <= to + EPS) {
      const third = beatLen / 3, id = `t${pos}`;
      if (left >= 3) rec(pos + beatLen, left - 3, [...acc, ...[0, 1, 2].map(() => ({ d: third, tup: id }))]);
      if (left >= 2 && eq(beatLen, 1)) rec(pos + beatLen, left - 2, [...acc, { d: 2 * third, tup: id }, { d: third, tup: id }]);
    }
    for (const d of D) {
      const end = pos + d;
      if (end > to + EPS) continue;
      if (!onBeat(pos) && end > nextBeat(pos) + EPS) continue; // off-beat notes stay inside their beat
      if (half != null && pos < half - EPS && end > half + EPS && !eq(pos, 0)) continue; // don't hide the mid-bar
      // a note from the beat that runs past the next beat must end on a beat, except the dotted quarter
      if (onBeat(pos) && end > nextBeat(pos) + EPS && !onBeat(end) && !eq(end, to) && !(eq(d, 1.5) && !meter.compound)) continue;
      rec(end, left - 1, [...acc, { d }]);
    }
  };
  rec(from, k, []);
  return res;
}

/** Weighted choice: favour a longer first note (the accent) and fewer kinds of value. */
function choosePattern(list, longEnd = false) {
  if (!list.length) return null;
  const w = list.map((p) => {
    const kinds = new Set(p.map((n) => n.d.toFixed(3))).size;
    let x = Math.sqrt(p[0].d / p.reduce((a, n) => a + n.d, 0) + 0.2) / kinds;
    if (longEnd) x *= p[p.length - 1].d;
    if (p.some((n) => n.tup)) x *= 0.6;
    return x;
  });
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}

/** Meter for each bar: one meter, or (with "changes") a new one every one to three bars. */
function meterPlan(T, count) {
  let pool = [];
  for (const s of T.sigs.length ? T.sigs : ['4/4']) pool.push(...(s === 'other' ? [pick(OTHER)] : [s]));
  if (T.changes && T.sigs.includes('other')) pool.push(...OTHER.filter(() => Math.random() < 0.4));
  pool = [...new Set(pool)];
  const plan = [];
  let cur = pick(pool), runLeft = 1 + rnd(3);
  for (let m = 0; m < count; m++) {
    if (T.changes && pool.length > 1 && runLeft <= 0) {
      cur = pick(pool.filter((x) => x !== cur));
      runLeft = 1 + rnd(3);
    }
    plan.push(cur);
    runLeft--;
  }
  return plan;
}

/**
 * Generate a rhythm.
 * @returns {{measures:{start:number,len:number,meter:string,showSig:boolean}[], events:{start:number,dur:number,
 *   pieces:{start:number,dur:number,type:object,tup?:string,m:number}[], strong:boolean, m:number}[]}}
 */
export function generateRhythm(R, T, count) {
  const plan = meterPlan(T, count);
  const measures = [];
  const notes = []; // single-piece notes before ties
  let t0 = 0;
  plan.forEach((sig, m) => {
    const meter = METERS[sig], len = meter.beats.reduce((a, b) => a + b, 0);
    measures.push({ start: t0, len, meter: sig, showSig: m === 0 || plan[m - 1] !== sig });
    const D = allowedDurations(R, meter);
    const bounds = [0];
    meter.beats.forEach((b) => bounds.push(bounds[bounds.length - 1] + b));
    const last = m === count - 1;
    let bi = 0;
    while (bi < meter.beats.length) {
      const from = bounds[bi];
      // span: how many beats this foot takes; prefer ending on a strong beat or the barline
      const spans = [];
      for (let s = 1; bi + s <= meter.beats.length; s++) {
        const endBeat = bi + s;
        let w = endBeat === meter.beats.length || meter.strong.includes(endBeat) ? 3 : 1;
        if (s > 2) w *= 0.5;
        if (last && endBeat !== meter.beats.length) w *= 0.6;
        spans.push({ s, w });
      }
      let chosen = null;
      for (let tries = 0; tries < 12 && !chosen; tries++) {
        let r = Math.random() * spans.reduce((a, x) => a + x.w, 0), s = spans[0].s;
        for (const x of spans) { r -= x.w; if (r <= 0) { s = x.s; break; } }
        const to = bounds[bi + s];
        const finalFoot = last && bi + s === meter.beats.length;
        const ks = finalFoot ? [1, 2, 1, 3] : [1, 2, 2, 3, 3, 4, 1, 2];
        const k = pick(ks);
        const p = choosePattern(patterns(meter, from, to, k, D, R.triplets), finalFoot);
        if (p) chosen = { s, p };
      }
      if (!chosen) { // fallback: anything that fills one beat
        for (let k = 1; k <= 6 && !chosen; k++) {
          const p = choosePattern(patterns(meter, from, bounds[bi + 1], k, D.length ? D : [0.5, 1], R.triplets));
          if (p) chosen = { s: 1, p };
        }
        if (!chosen) chosen = { s: 1, p: [{ d: meter.beats[bi] }] };
      }
      let pos = t0 + from;
      chosen.p.forEach((n, i) => {
        const inBar = pos - t0;
        const strong = i === 0 && (eq(inBar, 0) || meter.strong.some((b) => eq(bounds[b], inBar)));
        notes.push({ start: pos, dur: n.d, tup: n.tup ? `${m}${n.tup}` : null, m, strong });
        pos += n.d;
      });
      bi += chosen.s;
    }
    t0 += len;
  });

  // Ties: now and then a note runs over the barline into the next bar's downbeat
  const events = [];
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    const piece = { start: n.start, dur: n.dur, type: noteType(n.dur) || noteType(1), tup: n.tup, m: n.m };
    const prev = events[events.length - 1];
    if (R.ties && prev && n.m !== prev.m && !n.tup && !prev.pieces[prev.pieces.length - 1].tup
      && prev.pieces.length === 1 && i < notes.length - 1 && Math.random() < 0.3) {
      prev.pieces.push(piece);
      prev.dur += n.dur;
      continue;
    }
    events.push({ start: n.start, dur: n.dur, pieces: [piece], strong: n.strong, m: n.m });
  }
  return { measures, events };
}
