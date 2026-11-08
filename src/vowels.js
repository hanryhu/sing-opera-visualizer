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
    cite: 'Joliveau, E., Smith, J. & Wolfe, J. (2004). Tuning of vocal tract resonance by sopranos. Nature 427, 116.',
    url: 'https://www.phys.unsw.edu.au/jw/reprints/Joliveauetal.pdf',
    use: 'Pitch-aware vowels: R1 raised to follow f0 at high pitch.',
  },
  {
    cite: 'Henrich, N., Smith, J. & Wolfe, J. (2011). Vocal tract resonances in singing: Strategies used by sopranos, altos, tenors, and baritones. JASA 129(2), 1024–1035.',
    url: 'https://hal.archives-ouvertes.fr/hal-00569451/file/Henrich_JASA_2011.pdf',
    use: 'Pitch-aware vowels by voice type: R1:f0 and R2:2f0 (high voices), R1:2f0 (low voices).',
  },
  {
    cite: 'Sundberg, J. & Skoog, J. (1997). Dependence of jaw opening on pitch and vowel in singers. Journal of Voice 11(3), 301–306.',
    use: 'Pitch-aware vowels: jaw opening raises F1 as pitch approaches it.',
  },
  {
    cite: 'Miller, D. G. & Schutte, H. K. (1990). Formant tuning in a professional baritone. Journal of Voice 4(3), 231–237.',
    use: 'Pitch-aware vowels: R1 tuned to the 2nd harmonic in male voices.',
  },
  {
    cite: 'El-Jaroudi, A. & Makhoul, J. (1991). Discrete all-pole modeling. IEEE Trans. Signal Processing 39(2), 411–423.',
    use: 'Formant estimation above ~300 Hz F0 (fits the harmonic peaks only).',
  },
  {
    cite: 'Sundberg, J. (1974). Articulatory interpretation of the “singing formant”. JASA 55(4), 838–844.',
    use: 'Singer’s formant as a clustering of F3–F5 (green zone on the F3 bar).',
  },
  {
    cite: 'Sundberg, J. (1995). The singer’s formant revisited. STL-QPSR 36(2–3), 83–96.',
    url: 'https://www.speech.kth.se/qpsr/1995/1995_36_2-3_083-096.pdf',
    use: 'RING: observed minus vowel-predicted level near 3 kHz; ≥ 6 dB = singer’s formant. Calibrated to his Fig. 8 (−30 dB at F1 0.5 / F2 1 kHz).',
  },
  {
    cite: 'Omori, K., Kacker, A., Carroll, L. M., Riley, W. D. & Blaugrund, S. M. (1996). Singing power ratio: quantitative evaluation of singing voice quality. Journal of Voice 10(3), 228–235.',
    use: 'Related fixed-band measure (2–4 kHz vs 0–2 kHz); not used because it varies with the vowel.',
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

/* ---------------- pitch-aware landmarks (resonance tuning) ---------------- */
//
// Trained singers move their vocal-tract resonances as pitch rises so a harmonic stays on a
// resonance. These rules move each vowel's circle the way the literature reports:
//  1. All voices — R1 is kept at or just above f0 once f0 passes the vowel's speech F1
//     (Joliveau, Smith & Wolfe 2004; jaw opening with pitch: Sundberg & Skoog 1997).
//     This is also what any analyzer can measure: below f0 there is no harmonic to reveal F1.
//  2. High voices — R2 tuned to 2·f0 for vowels whose F2 falls below 2·f0 (Henrich, Smith &
//     Wolfe 2011, sopranos: R2:2f0, often together with R1:f0).
//  3. Low voices — R1 drawn toward 2·f0 when the 2nd harmonic comes near it (Henrich et al.
//     2011, tenors/baritones: R1:2f0; Miller & Schutte 1990).

const smoothMax = (a, b, p = 8) => Math.pow(Math.pow(a, p) + Math.pow(b, p), 1 / p);

/**
 * @param {{ipa:string,f1:number,f2:number}[]} base landmarks at low pitch (speech / calibration)
 * @param {number} f0 current sung pitch in Hz (0 = not singing → unchanged)
 * @param {'low'|'high'} voice
 * @returns landmarks with f1/f2 adjusted, plus base0 = original position, tuned = moved noticeably
 */
export function pitchAdjustedLandmarks(base, f0, voice) {
  return base.map((v) => {
    if (!f0) return { ...v, base0: v, tuned: false };
    // Rule 1: R1 rides just above f0 (smooth, so circles glide rather than jump)
    let f1 = smoothMax(v.f1, f0 * 1.05);
    let f2 = v.f2;
    if (voice === 'high') {
      // Rule 2: R2:2f0 for vowels whose F2 is below the 2nd harmonic
      f2 = smoothMax(f2, 2 * f0 * 1.03);
    } else {
      // Rule 3: R1 attracted to 2f0 when H2 is within ~±20% of F1 (weight peaks at coincidence)
      const d = Math.log(f1 / (2 * f0));
      const w = 0.6 * Math.exp(-((d / 0.15) ** 2));
      f1 = Math.exp((1 - w) * Math.log(f1) + w * Math.log(2 * f0));
    }
    if (f2 < f1 * 1.25) f2 = f1 * 1.25; // keep F2 above F1
    const tuned = Math.abs(Math.log(f1 / v.f1)) > 0.04 || Math.abs(Math.log(f2 / v.f2)) > 0.04;
    return { ...v, f1, f2, base0: v, tuned };
  });
}
