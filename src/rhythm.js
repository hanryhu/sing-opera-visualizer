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
  '7/4': { num: 7, den: 4, beats: [1, 1, 1, 1, 1, 1, 1], strong: [0, 4] },
  '5/8': { num: 5, den: 8, beats: [1, 1.5], strong: [0] },
  '3/2': { num: 3, den: 2, beats: [2, 2, 2], strong: [0] },
  '6/4': { num: 6, den: 4, beats: [3, 3], strong: [0, 1] },
  '3/8': { num: 3, den: 8, beats: [1.5], strong: [0], compound: true },
  '11/8': { num: 11, den: 8, beats: [1, 1, 1, 1.5], strong: [0] },
};
/** Time signature choices in the menu; 'other' draws from the less common meters. */
export const SIG_CHOICES = ['cut', '3/4', '4/4', '6/8', 'other'];
const OTHER = ['2/4', '5/4', '7/4', '5/8', '7/8', '3/2', '6/4', '3/8', '9/8', '11/8', '12/8'];
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
  const minD = Math.min(...D, triplets ? 1 / 3 : Infinity), maxD = Math.max(...D);
  let calls = 0;
  const rec = (pos, left, acc) => {
    if (res.length > 300 || ++calls > 20000) return; // enough choices; bounded work
    if (eq(pos, to)) { if (left === 0) res.push(acc); return; }
    if (left === 0 || pos > to + EPS) return;
    const room = to - pos; // prune: the notes left must be able to fill exactly the room left
    if (room < left * minD - EPS || room > left * maxD + EPS) return;
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

/* ---------------- rhythm from text ---------------- */
/** Split a duration starting at `pos` into writable pieces (tied), breaking at beats where needed. */
function writable(pos, dur, beatsAbs) {
  const out = [];
  const VALUES = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];
  let guard = 0;
  while (dur > EPS && guard++ < 40) {
    const onBeat = beatsAbs.some((b) => eq(b, pos));
    const nextB = beatsAbs.find((b) => b > pos + EPS) ?? pos + dur;
    let v = VALUES.find((x) => x <= dur + EPS && (onBeat ? beatsAbs.some((b) => eq(b, pos + x)) || eq(x, dur) : pos + x <= nextB + EPS)) ?? dur;
    out.push({ start: pos, dur: v });
    pos += v; dur -= v;
  }
  return out;
}

/**
 * Rhythm fitted to verse. Each stressed syllable starts a foot on a beat, preferring strong beats; the
 * unstressed syllables after it share the foot. Unstressed syllables before a line's first stress are an
 * upbeat: they end just before a strong beat (the previous line's last note is held to make room), and at
 * the very start they form a pickup bar. Lines end on longer notes.
 * @param lines [{sylls:[{text, stress, wordEnd}]}]
 * @returns same shape as generateRhythm, events carry .syl
 */
export function generateTextRhythm(R, T, lines, minBars, maxBars) {
  const target = minBars + rnd(maxBars - minBars + 1);
  const plan = meterPlan(T, maxBars + 12);
  const measures = [], notes = [];
  let mi = -1, bi = 0, t0 = 0, meter = null, bounds = null, D = null;
  const ALL = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];
  const newBar = () => {
    if (meter) t0 += bounds[bounds.length - 1] - (measures[measures.length - 1].offset || 0);
    mi += 1;
    const sig = plan[Math.min(mi, plan.length - 1)];
    meter = METERS[sig];
    bounds = [0]; meter.beats.forEach((b) => bounds.push(bounds[bounds.length - 1] + b));
    D = allowedDurations(R, meter);
    const prev = measures[measures.length - 1];
    measures.push({ start: t0, len: bounds[bounds.length - 1], meter: sig, showSig: !prev || prev.meter !== sig });
    bi = 0;
  };
  const nb = () => meter.beats.length;
  const isStrongIdx = (b) => b === nb() || meter.strong.includes(b);
  const emit = (pattern, sylls, fromBeat) => {
    let pos = t0 + bounds[fromBeat] - (measures[measures.length - 1].offset || 0);
    pattern.forEach((n, i) => {
      const inBar = bounds[fromBeat] + pattern.slice(0, i).reduce((a, x) => a + x.d, 0);
      const strong = eq(inBar, 0) || meter.strong.some((b) => eq(bounds[b], inBar));
      notes.push({ start: pos, dur: n.d, tup: n.tup ? `${mi}${n.tup}` : null, m: measures.length - 1, strong: strong && sylls[i].stress, syl: sylls[i] });
      pos += n.d;
    });
  };
  // Place k syllables from beat bi: choose a span; returns how many were placed
  const placeFoot = (sylls, lineEnd) => {
    let left = sylls, guard = 0;
    while (left.length && guard++ < 40) {
      if (bi >= nb()) newBar();
      const k = left.length, opts = [];
      // your note values first; if nothing fits, any value (better than dropping words)
      for (const DD of [D, ALL]) {
        for (let s = 1; bi + s <= nb(); s++) {
          const pats = patterns(meter, bounds[bi], bounds[bi + s], k, DD, R.triplets && !lineEnd); // a line ends off a triplet
          if (!pats.length) continue;
          let w = isStrongIdx(bi + s) ? 3 : 1;
          if (lineEnd) w *= 1 + s; else if (s > 2) w *= 0.4;
          opts.push({ s, pats, w });
        }
        if (opts.length) break;
      }
      if (opts.length) {
        let r = Math.random() * opts.reduce((a, o) => a + o.w, 0), o = opts[0];
        for (const x of opts) { r -= x.w; if (r <= 0) { o = x; break; } }
        emit(choosePattern(o.pats, lineEnd), left, bi);
        bi += o.s; left = [];
        break;
      }
      // doesn't fit in this bar: put as many as fit, carry the rest over
      let placed = false;
      for (let kk = k - 1; kk >= 1 && !placed; kk--) {
        for (const DD of [D, ALL]) {
          const pats = patterns(meter, bounds[bi], bounds[nb()], kk, DD, R.triplets);
          if (pats.length) { emit(choosePattern(pats), left.slice(0, kk), bi); left = left.slice(kk); bi = nb(); placed = true; break; }
        }
      }
      if (!placed) {
        const pats = patterns(meter, bounds[bi], bounds[nb()], k, ALL, false);
        if (pats.length) { emit(choosePattern(pats), left, bi); left = []; bi = nb(); }
        else { // last resort: hold the previous note to the barline
          const last = notes[notes.length - 1];
          if (last) { last.dur += bounds[nb()] - bounds[bi]; last.tup = null; }
          bi = nb();
        }
      }
    }
  };
  // Hold the last note so an upbeat of k syllables ends right before a strong beat
  const makeRoomForUpbeat = (k) => {
    const last = notes[notes.length - 1];
    for (let ext = 0; bi + ext < nb(); ext++) {
      for (let s = 1; bi + ext + s <= nb(); s++) {
        if (!isStrongIdx(bi + ext + s)) continue;
        if (!patterns(meter, bounds[bi + ext], bounds[bi + ext + s], k, D, R.triplets).length) continue;
        if (ext && last) {
          if (last.tup || (bi === 0 && !R.ties)) continue; // never stretch a triplet; cross a barline only with ties
          const nd = last.dur + bounds[bi + ext] - bounds[bi];
          if (!noteType(nd) && !R.ties) continue;
          last.dur = nd;
        }
        bi += ext;
        return true;
      }
    }
    return false;
  };

  let first = true;
  // rough length of a line in bars (about one beat per syllable, plus a held ending)
  const estBars = (n) => (n * 0.9 + 1.5) / METERS[plan[Math.max(0, mi)]].beats.length;
  for (const line of lines) {
    let sy = line.sylls;
    const barsSoFar = measures.filter((m) => !m.pickup).length;
    if (!first && barsSoFar >= minBars && barsSoFar + estBars(sy.length) > maxBars + 0.5) break; // the next line won't fit
    if (first && estBars(sy.length) > maxBars + 0.5) { // even one line is too long: end it at a word boundary
      const keep = Math.max(1, Math.floor((maxBars * METERS[plan[0]].beats.length - 1.5) / 0.9));
      let cut = sy.slice(0, keep).map((x, i) => (x.wordEnd ? i : -1)).filter((i) => i >= 0).pop();
      sy = sy.slice(0, (cut ?? keep - 1) + 1);
    }
    let a = sy.findIndex((s) => s.stress);
    if (a < 0) a = 0;
    const upbeat = sy.slice(0, a);
    if (first) {
      newBar();
      if (upbeat.length) { // pickup bar: the last beat(s) of the first meter
        let done = false;
        for (let s = 1; s <= nb() && !done; s++) {
          const pats = patterns(meter, bounds[nb() - s], bounds[nb()], upbeat.length, D, R.triplets);
          if (!pats.length) continue;
          const m0 = measures[0];
          m0.offset = bounds[nb() - s]; m0.len = bounds[nb()] - m0.offset; m0.pickup = true;
          emit(choosePattern(pats), upbeat, nb() - s);
          bi = nb(); done = true;
        }
        if (!done) placeFoot(upbeat, false);
      }
      first = false;
    } else if (upbeat.length) {
      if (bi >= nb()) newBar();
      makeRoomForUpbeat(upbeat.length); // if there's no clean way, the upbeat simply starts where we are
      placeFoot(upbeat, false);
    }
    // feet: a stressed syllable and the unstressed ones after it
    const feet = [];
    for (let i = a; i < sy.length; i++) {
      if (sy[i].stress || !feet.length) feet.push([sy[i]]); else feet[feet.length - 1].push(sy[i]);
    }
    feet.forEach((f, k) => {
      if (bi >= nb()) newBar();
      // a stressed syllable on a weak beat: hold the previous note to the next strong beat when that is clean
      if (k > 0 && !isStrongIdx(bi) && bi > 0 && Math.random() < 0.5) {
        const last = notes[notes.length - 1], nextS = [...meter.strong, nb()].filter((b) => b > bi).sort((x, y) => x - y)[0];
        if (last && !last.tup && nextS != null && nextS < nb()) {
          const nd = last.dur + bounds[nextS] - bounds[bi];
          if (noteType(nd)) { last.dur = nd; bi = nextS; }
        }
      }
      placeFoot(f, k === feet.length - 1);
    });
    const bars = measures.filter((m) => !m.pickup).length;
    if (bars >= target) break;
    if (bars >= maxBars) break;
  }
  // End: hold the last note to the barline
  if (bi < nb()) { const last = notes[notes.length - 1]; if (last) { last.dur += bounds[nb()] - bounds[bi]; last.tup = null; } }

  // Notes → events with writable pieces (long or barline-crossing notes become tied pieces)
  const barAt = (tAbs) => {
    let k = measures.length - 1;
    while (k > 0 && measures[k].start > tAbs + EPS) k--;
    return k;
  };
  const beatsAbs = [];
  measures.forEach((mz) => {
    const M = METERS[mz.meter];
    let b = mz.start - (mz.offset || 0);
    for (const len of [0, ...M.beats]) { b += len; if (b >= mz.start - EPS && b <= mz.start + mz.len + EPS) beatsAbs.push(b); }
  });
  beatsAbs.push(...measures.map((mz) => mz.start), (measures[measures.length - 1]?.start ?? 0) + (measures[measures.length - 1]?.len ?? 0));
  beatsAbs.sort((x, y) => x - y);
  const events = notes.map((n) => {
    // split at barlines, then into writable values
    const pieces = [];
    let pos = n.start, left = n.dur, guard = 0;
    while (left > EPS && guard++ < 40) {
      const m = barAt(pos), end = measures[m].start + measures[m].len;
      let seg = Math.min(left, end - pos);
      if (seg <= EPS) seg = left; // past the last barline (shouldn't happen): keep the rest in this bar
      const type = noteType(seg);
      if (type) pieces.push({ start: pos, dur: seg, type, tup: n.tup, m });
      else for (const p of writable(pos, seg, beatsAbs)) pieces.push({ ...p, type: noteType(p.dur) || noteType(0.25), tup: null, m });
      pos += seg; left -= seg;
    }
    return { start: n.start, dur: n.dur, pieces, strong: n.strong, m: pieces[0].m, syl: n.syl };
  });
  return { measures, events };
}
