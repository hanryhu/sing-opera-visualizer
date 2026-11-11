// Melody generation and spelling for Learn.

const LETTERS = 'CDEFGAB';
const NAT_PC = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];

/* ---------------- spelling ---------------- */
// Candidate spellings of a pitch class: the natural, the sharp and the flat names, but never
// E♯ B♯ F♭ C♭ or double accidentals (hard to read in atonal music).
function candidates(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const out = [];
  for (let li = 0; li < 7; li++) {
    for (const acc of [0, 1, -1]) {
      if (((NAT_PC[li] + acc) % 12 + 12) % 12 !== pc) continue;
      const name = LETTERS[li] + (acc === 1 ? '♯' : acc === -1 ? '♭' : '');
      if (['E♯', 'B♯', 'F♭', 'C♭'].includes(name)) continue;
      // octave of the written letter (B♯/C♭ excluded, so the letter stays in the MIDI octave)
      out.push({ letter: LETTERS[li], acc, oct: Math.floor(midi / 12) - 1, li });
    }
  }
  return out;
}
// Letter steps that spell each interval plainly (m2 = a 2nd, P4 = a 4th ...). The tritone may be a 4th or a 5th.
const PLAIN_STEPS = { 0: [0], 1: [1], 2: [1], 3: [2], 4: [2], 5: [3], 6: [3, 4], 7: [4], 8: [5], 9: [5], 10: [6], 11: [6], 12: [7] };
const dia = (s) => s.oct * 7 + s.li;

/**
 * Spell a line by dynamic programming (lowest total cost):
 *  - each melodic interval spelled as its plain form, not augmented/diminished (e.g. C–D♭, not C–C♯);
 *  - fewer accidentals; sharps going up, flats going down;
 *  - no sharp right next to a flat.
 */
export function spellLine(notes) {
  const C = notes.map((n) => candidates(n.midi));
  const cost = C.map((cs) => cs.map(() => Infinity)), from = C.map((cs) => cs.map(() => -1));
  C[0].forEach((c, j) => { cost[0][j] = c.acc ? 0.3 : 0; });
  for (let i = 1; i < notes.length; i++) {
    const semis = notes[i].midi - notes[i - 1].midi, up = semis > 0;
    C[i].forEach((c, j) => {
      C[i - 1].forEach((p, k) => {
        let x = cost[i - 1][k];
        const steps = Math.abs(dia(c) - dia(p));
        if (!(PLAIN_STEPS[Math.abs(semis)] || [Math.round(Math.abs(semis) * 7 / 12)]).includes(steps)) x += 3;
        if (c.acc) x += 0.3;
        if ((c.acc === -1 && up) || (c.acc === 1 && !up)) x += 0.2;
        if (c.acc && p.acc && c.acc !== p.acc) x += 0.8;
        if (x < cost[i][j]) { cost[i][j] = x; from[i][j] = k; }
      });
    });
  }
  let j = cost[notes.length - 1].indexOf(Math.min(...cost[notes.length - 1]));
  const out = [];
  for (let i = notes.length - 1; i >= 0; i--) { out[i] = C[i][j]; j = from[i][j]; }
  return out.map(({ letter, acc, oct }) => ({ letter, acc, oct }));
}

/* ---------------- atonal line ---------------- */
// Triads and diatonic collections imply a key; an atonal line avoids them.
const TRIADS = [[0, 4, 7], [0, 3, 7]];
function isTriad(pcs) {
  const set = [...new Set(pcs)];
  if (set.length !== 3) return false;
  return set.some((r) => TRIADS.some((tri) => tri.every((d) => set.includes((r + d) % 12))));
}
function fitsOneMajorScale(pcs) {
  const set = new Set(pcs);
  for (let k = 0; k < 12; k++) if ([...set].every((p) => [0, 2, 4, 5, 7, 9, 11].includes((p - k + 12) % 12))) return true;
  return false;
}

/**
 * Next pitch for an atonal line: choose among the allowed intervals, weighting toward pitch classes
 * not heard recently (spreading over all twelve) and away from triads and one-key passages.
 */
export function nextAtonal(prev, steps, lo, hi) {
  const midi = prev[prev.length - 1], mid = (lo + hi) / 2;
  const opts = [];
  for (const st of steps) {
    for (const dir of [1, -1]) {
      const cand = midi + dir * st;
      if (cand < lo || cand > hi) continue;
      if (prev.length >= 2 && cand === prev[prev.length - 2]) continue; // no immediate back-and-forth
      let w = 1;
      w *= dir > 0 === midi < mid ? 1.6 : 1; // drift toward the middle of the range
      const pc = ((cand % 12) + 12) % 12;
      const recent = prev.slice(-6).map((m) => ((m % 12) + 12) % 12);
      if (recent.includes(pc)) w *= 0.35; // prefer fresh pitch classes
      const last3 = [...prev.slice(-2), cand].map((m) => ((m % 12) + 12) % 12);
      if (isTriad(last3)) w *= 0.08; // arpeggiated triad
      const last6 = [...prev.slice(-5), cand].map((m) => ((m % 12) + 12) % 12);
      if (last6.length >= 6 && new Set(last6).size >= 5 && fitsOneMajorScale(last6)) w *= 0.25; // sounds like one key
      opts.push({ cand, w });
    }
  }
  if (!opts.length) return midi + (midi < mid ? steps[0] : -steps[0]);
  let r = Math.random() * opts.reduce((a, o) => a + o.w, 0);
  for (const o of opts) { r -= o.w; if (r <= 0) return o.cand; }
  return opts[opts.length - 1].cand;
}

/* ---------------- tonal lines ---------------- */
// Major keys up to four sharps or flats: tonic letter index (C=0), tonic pitch class, signature (+sharps / −flats).
const MAJOR_KEYS = [
  { li: 0, pc: 0, sig: 0 }, { li: 4, pc: 7, sig: 1 }, { li: 1, pc: 2, sig: 2 }, { li: 5, pc: 9, sig: 3 }, { li: 2, pc: 4, sig: 4 },
  { li: 3, pc: 5, sig: -1 }, { li: 6, pc: 10, sig: -2 }, { li: 2, pc: 3, sig: -3 }, { li: 5, pc: 8, sig: -4 },
];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
// Each scale: semitones above the tonic, the letter step of each tone, chord tones (indices), and how its
// key signature is found: 'parent' mode degree of a major key, 'major' (same-tonic major key), or 'none'.
const SCALES = {
  major: { st: [0, 2, 4, 5, 7, 9, 11], lt: [0, 1, 2, 3, 4, 5, 6], chord: [0, 2, 4], mode: 0 },
  minor: { st: [0, 2, 3, 5, 7, 8, 10], lt: [0, 1, 2, 3, 4, 5, 6], chord: [0, 2, 4], mode: 5, leading: true },
  pentMajor: { st: [0, 2, 4, 7, 9], lt: [0, 1, 2, 4, 5], chord: [0, 2, 3], mode: 0 },
  pentMinor: { st: [0, 3, 5, 7, 10], lt: [0, 2, 3, 4, 6], chord: [0, 1, 3], mode: 5 },
  blues: { st: [0, 3, 5, 6, 7, 10], lt: [0, 2, 3, 4, 4, 6], chord: [0, 1, 4], sigFrom: 'major' },
  dorian: { st: [0, 2, 3, 5, 7, 9, 10], lt: [0, 1, 2, 3, 4, 5, 6], chord: [0, 2, 4], mode: 1 },
  phrygian: { st: [0, 1, 3, 5, 7, 8, 10], lt: [0, 1, 2, 3, 4, 5, 6], chord: [0, 2, 4], mode: 2 },
  lydian: { st: [0, 2, 4, 6, 7, 9, 11], lt: [0, 1, 2, 3, 4, 5, 6], chord: [0, 2, 4], mode: 3 },
  mixolydian: { st: [0, 2, 4, 5, 7, 9, 10], lt: [0, 1, 2, 3, 4, 5, 6], chord: [0, 2, 4], mode: 4 },
  wholeTone: { st: [0, 2, 4, 6, 8, 10], lt: [0, 1, 2, 3, 4, 5], chord: [0, 2, 4], sigFrom: 'none' },
  octatonic: { st: [0, 1, 3, 4, 6, 7, 9, 10], lt: [0, 1, 2, 2, 3, 4, 5, 6], chord: [0, 2, 4, 6], sigFrom: 'none' },
};
export const TONAL_STYLES = ['pentatonic', 'diatonic', 'blues', 'chromatic', 'modern'];
const STYLE_SCALES = {
  pentatonic: ['pentMajor', 'pentMinor'],
  diatonic: ['major', 'minor'],
  blues: ['blues'],
  chromatic: ['major', 'minor'],
  modern: ['dorian', 'phrygian', 'lydian', 'mixolydian', 'wholeTone', 'octatonic'],
};
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6]; // F C G D A E B (letter indices)
const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];  // B E A D G C F

/** Key signature as {letterIndex: +1|-1}. */
export function keySigMap(sig) {
  const m = {};
  (sig > 0 ? SHARP_ORDER : FLAT_ORDER).slice(0, Math.abs(sig)).forEach((li) => { m[li] = sig > 0 ? 1 : -1; });
  return m;
}

/** Spell a MIDI note on a given letter (diatonic number); falls back to null for double accidentals. */
// letterNum = octave × 7 + letter index (C4 = 28), the same numbering the staff uses
function onLetter(midi, letterNum) {
  const li = ((letterNum % 7) + 7) % 7, oct = Math.floor(letterNum / 7);
  const acc = midi - (12 * (oct + 1) + NAT_PC[li]);
  if (Math.abs(acc) > 1) return null;
  return { letter: LETTERS[li], acc, oct };
}

/**
 * A tonal line. Starts on a tonic-chord tone; moves mostly by step; a leap is followed by a step back;
 * strong beats lean toward chord tones; ends on the tonic, approached by step. 'chromatic' adds chromatic
 * approach notes that resolve by semitone.
 * @returns {{notes:{midi:number, spelled:object}[], sig:number, name:string}}
 */
export function tonalLine(style, count, strong, lo, hi) {
  const scaleId = pick(STYLE_SCALES[style] || STYLE_SCALES.diatonic);
  const S = SCALES[scaleId], N = S.st.length;
  // key: tonic letter/pc and signature
  let tonicLi, tonicPc, sig;
  if (S.sigFrom === 'none') {
    tonicLi = rnd(7); tonicPc = NAT_PC[tonicLi]; sig = 0;
  } else {
    const K = pick(MAJOR_KEYS);
    if (S.sigFrom === 'major') { tonicLi = K.li; tonicPc = K.pc; sig = K.sig; } else {
      tonicLi = (K.li + S.mode) % 7; tonicPc = (K.pc + MAJOR[S.mode]) % 12; sig = K.sig;
    }
  }
  const mid = (lo + hi) / 2;
  // tonic register: the tonic just below the middle of the range
  const tonicMidi = tonicPc + 12 * Math.floor((mid - 2 - tonicPc) / 12);
  const tonicLetterNum = (Math.floor((tonicMidi - (tonicPc - NAT_PC[tonicLi])) / 12) - 1) * 7 + tonicLi;
  const midiOf = (p) => tonicMidi + S.st[((p % N) + N) % N] + 12 * Math.floor(p / N);
  const letterOf = (p) => tonicLetterNum + S.lt[((p % N) + N) % N] + 7 * Math.floor(p / N);
  const inRange = (p) => midiOf(p) >= lo && midiOf(p) <= hi;

  const ps = [];
  // start on the tonic or the fifth (whole-tone has no fifth: tonic)
  const fifthIdx = S.st.indexOf(7);
  const homes = () => [0, fifthIdx].filter((x) => x >= 0).flatMap((x) => [x - N, x, x + N]).filter(inRange);
  const starts = homes();
  ps.push(starts.length ? pick(starts) : 0);
  const out = [];
  let forced = null;
  for (let i = 1; i < count; i++) {
    const p = ps[i - 1];
    if (i >= count - 2) break; // the last two notes are the cadence
    if (forced != null) { ps.push(forced); forced = null; continue; }
    const lastMove = i >= 2 ? ps[i - 1] - ps[i - 2] : 0;
    const opts = [];
    for (const d of [-4, -3, -2, -1, 1, 2, 3, 4]) {
      const q = p + d;
      if (!inRange(q)) continue;
      let w = { 1: 6, 2: 2.5, 3: 1, 4: 0.6 }[Math.abs(d)];
      if (Math.abs(lastMove) >= 3) w *= Math.sign(d) === -Math.sign(lastMove) && Math.abs(d) === 1 ? 4 : 0.3; // fill the gap
      if (strong[i] && S.chord.includes(((q % N) + N) % N)) w *= 2.2;
      if ((midiOf(q) > mid && d > 0) || (midiOf(q) < mid && d < 0)) w *= 0.75; // drift home
      if (i >= 2 && q === ps[i - 2] && Math.abs(d) === 1) w *= 0.5; // fewer neighbour wiggles
      opts.push({ q, w });
    }
    let r = Math.random() * opts.reduce((a, o) => a + o.w, 0), q = opts[0]?.q ?? p + 1;
    for (const o of opts) { r -= o.w; if (r <= 0) { q = o.q; break; } }
    ps.push(q);
  }
  // Cadence: end on the tonic (or now and then the fifth), nearest the line, approached by step
  const lastP = ps[ps.length - 1];
  const goal = fifthIdx >= 0 && Math.random() < 0.3 ? fifthIdx : 0;
  let T = Math.round((lastP - goal) / N) * N + goal;
  if (!inRange(T)) T += midiOf(T) < lo ? N : -N;
  let pen = lastP > T ? T + 1 : T - 1;
  if (pen === lastP) pen = lastP > T ? T - 1 : T + 1;
  if (!inRange(pen)) pen = T + (pen > T ? -1 : 1);
  ps.push(pen, T);
  while (ps.length > count) ps.splice(ps.length - 3, 1);
  // No repeated notes (the follower moves on by pitch change): nudge the earlier of a repeated pair
  for (let i = ps.length - 1; i >= 1; i--) {
    if (ps[i] !== ps[i - 1]) continue;
    const alt = [1, -1, 2, -2].map((d) => ps[i - 1] + d).find((q) => inRange(q) && q !== ps[i] && q !== ps[i - 2]);
    if (alt != null) ps[i - 1] = alt;
  }

  // Pitches and spellings
  for (let i = 0; i < ps.length; i++) {
    let midi = midiOf(ps[i]), ln = letterOf(ps[i]);
    // minor: raised leading tone just before the final tonic
    if (S.leading && i === ps.length - 2 && ps[i] < ps[i + 1] && ((ps[i + 1] % N) + N) % N === 0) midi += 1;
    out.push({ midi, ln });
  }
  // Chromatic approach notes: a semitone below (raised lower letter) or above (lowered upper letter)
  if (style === 'chromatic') {
    for (let i = 1; i < out.length - 2; i++) {
      if (Math.random() > 0.3) continue;
      const tgt = out[i + 1], from = out[i - 1];
      const below = Math.random() < 0.6;
      const midi = tgt.midi + (below ? -1 : 1), ln = tgt.ln + (below ? -1 : 1);
      if (midi === from.midi || midi === tgt.midi || midi < lo || midi > hi) continue;
      if (S.st.includes(((midi - tonicMidi) % 12 + 12) % 12)) continue; // must be chromatic
      out[i] = { midi, ln };
      i++; // keep chromatic notes apart
    }
  }
  const notes = out.map(({ midi, ln }) => ({ midi, spelled: onLetter(midi, ln) }));
  return { notes, sig, scaleId, tonicLi };
}
