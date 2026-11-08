// Vowel landmarks (approximate population averages, Hz).
// f3 is used by the demo synth only; the UI shows F1×F2 landmarks.

export const VOICE_PRESETS = {
  low: {
    label: 'Low voice',
    hint: 'tenor · baritone · bass',
    vowels: [
      { ipa: 'i', f1: 280, f2: 2250, f3: 3000 },
      { ipa: 'e', f1: 380, f2: 2000, f3: 2700 },
      { ipa: 'ɛ', f1: 520, f2: 1800, f3: 2600 },
      { ipa: 'a', f1: 700, f2: 1250, f3: 2600 },
      { ipa: 'ɔ', f1: 560, f2: 950, f3: 2500 },
      { ipa: 'o', f1: 410, f2: 800, f3: 2450 },
      { ipa: 'u', f1: 300, f2: 700, f3: 2350 },
    ],
  },
  high: {
    label: 'High voice',
    hint: 'soprano · mezzo · countertenor',
    vowels: [
      { ipa: 'i', f1: 320, f2: 2750, f3: 3350 },
      { ipa: 'e', f1: 440, f2: 2400, f3: 3050 },
      { ipa: 'ɛ', f1: 600, f2: 2100, f3: 2950 },
      { ipa: 'a', f1: 850, f2: 1450, f3: 2900 },
      { ipa: 'ɔ', f1: 650, f2: 1100, f3: 2800 },
      { ipa: 'o', f1: 470, f2: 920, f3: 2750 },
      { ipa: 'u', f1: 360, f2: 800, f3: 2650 },
    ],
  },
};

// Extra IPA landmarks for the Detailed UI (low-voice values; high voice scaled ×1.15).
const EXTRA_LOW = [
  { ipa: 'ə', f1: 500, f2: 1500 },
  { ipa: 'y', f1: 290, f2: 1850 },
  { ipa: 'ø', f1: 390, f2: 1600 },
  { ipa: 'œ', f1: 540, f2: 1450 },
  { ipa: 'ɪ', f1: 400, f2: 1950 },
  { ipa: 'ʊ', f1: 440, f2: 1050 },
  { ipa: 'ʌ', f1: 620, f2: 1200 },
  { ipa: 'ɑ', f1: 740, f2: 1050 },
  { ipa: 'æ', f1: 680, f2: 1700 },
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
