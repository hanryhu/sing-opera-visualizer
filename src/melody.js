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
