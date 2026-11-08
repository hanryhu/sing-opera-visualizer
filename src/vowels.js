// Italian vowel landmarks (approximate population averages, Hz).
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
