// Vowel landmarks (Hz). f3 is used by the demo synth only; the UI shows F1×F2.
//
// Low voice = Standard Italian means from Ferrero, Magno Caldognetto, Vagges & Lavagnoli (1978),
//   ten Florentine speakers, as reprinted in Table 3.1 of the Salvadalena thesis (Univ. of Pavia).
// High voice = the same values scaled by female/male ratios measured in Italian speakers:
//   the Todi corpus (Salvadalena, Table 3.2) for every vowel, averaged with the arXiv:2005.06959
//   corpus (Table XIII, V1 centre) for /a i u/. See SOURCES below and the in-app help.
export const VOICE_PRESETS = {
  low: {
    label: 'Low voice',
    hint: 'tenor · baritone · bass',
    vowels: [
      { ipa: 'i', f1: 290, f2: 2310, f3: 3000 },
      { ipa: 'e', f1: 350, f2: 2050, f3: 2700 },
      { ipa: 'ɛ', f1: 490, f2: 1950, f3: 2600 },
      { ipa: 'a', f1: 780, f2: 1430, f3: 2600 },
      { ipa: 'ɔ', f1: 550, f2: 970, f3: 2500 },
      { ipa: 'o', f1: 390, f2: 870, f3: 2450 },
      { ipa: 'u', f1: 320, f2: 800, f3: 2350 },
    ],
  },
  high: {
    label: 'High voice',
    hint: 'soprano · mezzo · countertenor',
    vowels: [
      { ipa: 'i', f1: 361, f2: 2689, f3: 3350 },
      { ipa: 'e', f1: 403, f2: 2312, f3: 3050 },
      { ipa: 'ɛ', f1: 576, f2: 2123, f3: 2950 },
      { ipa: 'a', f1: 942, f2: 1585, f3: 2900 },
      { ipa: 'ɔ', f1: 562, f2: 1064, f3: 2800 },
      { ipa: 'o', f1: 431, f2: 969, f3: 2750 },
      { ipa: 'u', f1: 385, f2: 890, f3: 2650 },
    ],
  },
};

export const SOURCES = [
  {
    cite: 'Ferrero, F. E., Magno Caldognetto, E., Vagges, K. & Lavagnoli, C. (1978). Some acoustic characteristics of the Italian vowels. Journal of Italian Linguistics, 3, 87–96.',
    use: 'Low-voice landmarks (Standard Italian F1/F2 means).',
  },
  {
    cite: 'Salvadalena — thesis on the vowels of Todi vs Standard Italian, Università di Pavia. Tables 3.1 (reprint of Ferrero et al. 1978) and 3.2 (male/female Todi speakers).',
    url: 'https://unitesi.unipv.it/handle/20.500.14239/36029',
    use: 'Source of the Ferrero table; female/male scaling for high-voice landmarks.',
  },
  {
    cite: 'Consonant gemination in Italian: the affricate and fricative case (2020). arXiv:2005.06959, Table XIII.',
    url: 'https://arxiv.org/abs/2005.06959',
    use: 'Female/male F1/F2 for /a i u/ (high-voice scaling).',
  },
  {
    cite: 'de Cheveigné, A. & Kawahara, H. (2002). YIN, a fundamental frequency estimator for speech and music. JASA 111(4), 1917–1930.',
    use: 'Pitch detection.',
  },
  {
    cite: 'El-Jaroudi, A. & Makhoul, J. (1991). Discrete all-pole modeling. IEEE Trans. Signal Processing 39(2), 411–423.',
    use: 'Formant estimation above ~300 Hz F0 (fits the harmonic peaks only).',
  },
  {
    cite: 'Sundberg, J. (1974). Articulatory interpretation of the “singing formant”. JASA 55(4), 838–844.',
    use: 'Singer’s formant (~2.8–3.4 kHz) zone on the F3 bar.',
  },
];

// Extra IPA landmarks for the Detailed UI. Approximate positions placed relative to the
// Italian landmarks (not from the sources above); high voice scaled ×1.15.
const EXTRA_LOW = [
  { ipa: 'ə', f1: 500, f2: 1500 },
  { ipa: 'y', f1: 290, f2: 1850 },
  { ipa: 'ø', f1: 390, f2: 1600 },
  { ipa: 'œ', f1: 540, f2: 1450 },
  { ipa: 'ɪ', f1: 400, f2: 1950 },
  { ipa: 'ʊ', f1: 440, f2: 1050 },
  { ipa: 'ʌ', f1: 620, f2: 1200 },
  { ipa: 'ɑ', f1: 760, f2: 1100 },
  { ipa: 'æ', f1: 700, f2: 1800 },
];
export function extraVowels(voice) {
  const k = voice === 'high' ? 1.15 : 1;
  return EXTRA_LOW.map((v) => ({ ipa: v.ipa, f1: v.f1 * k, f2: v.f2 * k }));
}

/* ---------------- calibration ---------------- */

export const CALIBRATION_ORDER = ['a', 'e', 'i', 'o', 'u', 'ɛ', 'ɔ'];
export const REQUIRED = ['a', 'e', 'i', 'o', 'u'];

const geo = (x, y) => Math.sqrt(x * y);

/**
 * Build a full seven-vowel landmark set from captured vowels.
 * ɛ / ɔ are interpolated (geometric mean of neighbours) when not captured.
 * @param {Record<string,{f1:number,f2:number,f3?:number}>} captured
 */
export function landmarksFromCalibration(captured) {
  const get = (ipa) => captured[ipa];
  const mid = (a, b) => (get(a) && get(b)
    ? { f1: geo(get(a).f1, get(b).f1), f2: geo(get(a).f2, get(b).f2) } : null);
  const out = [];
  for (const ipa of ['i', 'e', 'ɛ', 'a', 'ɔ', 'o', 'u']) {
    let v = get(ipa);
    let interpolated = false;
    if (!v && ipa === 'ɛ') { v = mid('e', 'a'); interpolated = true; }
    if (!v && ipa === 'ɔ') { v = mid('o', 'a'); interpolated = true; }
    if (v) out.push({ ipa, f1: v.f1, f2: v.f2, interpolated });
  }
  return out;
}

/* ---------------- rounding pairs (F3 bar labels) ---------------- */

// [unrounded, rounded] at each height × backness cell of the IPA chart.
const PAIRS = {
  close: { front: ['i', 'y'], central: ['ɨ', 'ʉ'], back: ['ɯ', 'u'] },
  closeMid: { front: ['e', 'ø'], central: ['ɘ', 'ɵ'], back: ['ɤ', 'o'] },
  openMid: { front: ['ɛ', 'œ'], central: ['ɜ', 'ɞ'], back: ['ʌ', 'ɔ'] },
  open: { front: ['a', 'ɶ'], central: ['a', 'ɒ'], back: ['ɑ', 'ɒ'] },
};

/**
 * The unrounded/rounded vowel pair for the current tongue position, judged from F1 (height)
 * and F2 (backness) relative to the active landmarks.
 * @returns {{unrounded:string, rounded:string}|null}
 */
export function roundingPair(f1, f2, landmarks) {
  if (!f1 || !f2) return null;
  const L = Object.fromEntries(landmarks.map((v) => [v.ipa, v]));
  if (!L.i || !L.u || !L.a || !L.e || !L.o) return null;
  const geo = (a, b) => Math.sqrt(a * b);
  const eps = L['ɛ'] || L.e, ops = L['ɔ'] || L.o;
  const rows = [
    ['close', geo(L.i.f1, L.u.f1), L.i.f2, L.u.f2],
    ['closeMid', geo(L.e.f1, L.o.f1), L.e.f2, L.o.f2],
    ['openMid', geo(eps.f1, ops.f1), eps.f2, ops.f2],
    ['open', L.a.f1, L.a.f2 * 1.25, L.a.f2 / 1.4],
  ];
  let row = rows[0];
  for (const r of rows) if (Math.abs(Math.log(f1 / r[1])) < Math.abs(Math.log(f1 / row[1]))) row = r;
  const [height, , front, back] = row;
  const t = Math.log(f2 / back) / Math.log(front / back); // 0 = back, 1 = front
  const col = t > 0.62 ? 'front' : t < 0.38 ? 'back' : 'central';
  const [unrounded, rounded] = PAIRS[height][col];
  return { unrounded, rounded };
}
