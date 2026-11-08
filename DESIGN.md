# Synsoph Vocal Analyzer — Design Doc

Status: draft v1 (2026-11-08) · MVP = Main UI only · Target host: Vercel (synsoph stack)

## 1. Goal

A browser-based, real-time visual feedback tool for classical/opera singers. While the singer
sustains a note, the screen answers three questions at a glance:

1. **Am I on pitch?** (pitch tuner)
2. **Is my vowel where I want it?** (F1 × F2 vowel map, Italian vowels)
3. **Do I have ring / is my vowel rounded?** (F3 bar with singer's-formant zone)

Plus an input-level meter so the singer knows the mic is getting a clean, unclipped signal.

Design principle: **coarse, glanceable labels**. A singer looks at the screen mid-phrase; there are
no Hz numbers in the Main UI, only note names, vowel symbols and colours. Numbers appear in the
Detailed UI (§6).

Non-goals (for now): accounts, server-side processing, recording storage, mobile-native apps.

## 2. Users & scenarios

- **Singer practising alone** with a laptop/phone mic: checks tuning of sustained notes and vowel
  modification across the passaggio (e.g. "is my [a] drifting toward [ɔ] on the top F?").
- **Voice teacher in lesson**: screen visible to student; teacher points to the vowel map.
- **Diction coach**: Italian vowel contrasts [e]/[ɛ] and [o]/[ɔ].

## 3. Main UI (MVP)

```
┌─────────────────────────────────────────────────────────────┐
│  Synsoph · Vocal Analyzer        [voice: High ▾] [■ Stop]   │
├─────────────────────────────────────────────────────────────┤
│  PITCH TUNER                                                │
│   … F   F#   G   G#  [ A ]  A#   B   C …   ← sliding strip   │
│                   ▲ needle      big "A" + "+8¢"-style bar    │
├───────────────┬─────────────────────────────────────────────┤
│  F3           │  VOWEL MAP  (F2 → horizontal, F1 ↓ vertical) │
│ unrounded     │    i        e                               │
│  ░░ orange    │          ɛ                     u            │
│  ██ GREEN ◄─  │                      ɔ     o                │
│  ░░ orange    │               a                             │
│ rounded       │        ● current vowel (with fading trail)  │
├───────────────┴─────────────────────────────────────────────┤
│  INPUT  ▕████████████▏░░░░░░░░░░░░░░░░░░░░░   CLIP           │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Start flow
- Landing state shows a single primary **Start analyzing** button and a one-line explanation.
- Click → `getUserMedia({audio:{echoCancellation:false, noiseSuppression:false,
  autoGainControl:false}})`. **All browser voice processing must be disabled**: AGC destroys the
  level meter's meaning and noise suppression/echo cancellation smear formants.
- Permission denied / no device → inline error with retry and browser-specific hint.
- A secondary **Try demo voice** button feeds a built-in synthetic singer (glottal source + formant
  filters cycling through the Italian vowels with vibrato) into the same pipeline. It is used for
  development/visual QA and as an onboarding preview, and is the foundation for the P2
  "produce the sound so the user can imitate it" feature.

### 3.2 Pitch tuner (top)
- Horizontal strip of semitone names (`C C# D … B`, sharps only in MVP) that slides so the current
  pitch sits under a fixed centre needle. Octave number shown small next to the big note name.
- Colour of the big note + needle:
  - **green**: |deviation| ≤ 10 cents
  - **orange**: 10 < |deviation| ≤ 30 cents
  - **no colour (neutral grey)**: > 30 cents ("between notes") or unvoiced
- **Vibrato handling**: operatic vibrato is ±50–100 cents at 5–7 Hz, so frame-by-frame pitch would
  flicker between colours. The note/colour decision uses the **mean pitch over the last ~300 ms**
  (≈ 1.5–2 vibrato cycles, computed in cents). The raw pitch is drawn as a short trail behind the
  needle so the singer still sees vibrato width and regularity.
- A4 = 440 Hz reference (configurable later: 415/430/432/442/443).

### 3.3 F3 bar (bottom-left)
- Vertical bar, log-frequency scale ≈ 1.8 – 4.0 kHz (no Hz labels in Main UI).
- Background: **bright green band centred at 3.0 kHz**, fading to **orange outside 2.8 – 3.4 kHz**
  (the singer's-formant region), neutral elsewhere.
- Labels: **"unrounded"** (i, e) at the top, **"rounded"** (y, u, o) at the bottom — lip rounding
  lengthens the vocal tract and lowers F3.
- Marker: horizontal pointer at the current smoothed F3, plus a small "ring" indicator showing
  the singer's-formant energy ratio (energy 2.5–3.5 kHz vs 0.3–2 kHz). F3 alone is not the singer's
  formant (which is a clustering of F3–F5); the ratio is the more honest "ring" measure, while the
  pointer satisfies the rounded/unrounded reading.

### 3.4 Vowel map (bottom-right)
- 2-D plot in IPA-chart orientation: **F2 on the x-axis, decreasing left→right** (front vowels
  left), **F1 on the y-axis, increasing downward** (close vowels on top). Both axes log-scaled.
- Landmarks: Italian seven-vowel system **i, e, ɛ, a, ɔ, o, u**, drawn as soft circles.
- Current vowel: bright dot + fading ~1.5 s trail. Nearest landmark is highlighted when the dot is
  inside its circle.
- Landmark values depend on vocal-tract length. MVP ships two presets selectable in the header:
  **High voice** (soprano/mezzo/countertenor) and **Low voice** (tenor/baritone/bass). Calibration
  (§6.3) replaces them with the singer's own values.

Default landmarks (Hz, approximate, from published Italian-vowel formant studies; tuned by ear on
the demo synth):

| vowel | Low F1 | Low F2 | High F1 | High F2 | F3 tendency |
|-------|-------:|-------:|--------:|--------:|-------------|
| i     | 280    | 2250   | 320     | 2750    | high        |
| e     | 380    | 2000   | 440     | 2400    | high        |
| ɛ     | 520    | 1800   | 600     | 2100    | mid         |
| a     | 700    | 1250   | 850     | 1450    | mid         |
| ɔ     | 560    | 950    | 650     | 1100    | low         |
| o     | 410    | 800    | 470     | 920     | low         |
| u     | 300    | 700    | 360     | 800     | low         |

### 3.5 Input level (bottom)
- Horizontal bar 0 → max: RMS in dBFS mapped −60 … 0 dB, peak-hold tick (decays over ~1 s).
- Zones: grey (too quiet, < −45 dBFS — analysis gated off), green (good), orange (> −6 dBFS),
  **CLIP** lamp latches for 1.5 s when any sample |x| ≥ 0.99.
- Yes, this is derivable: with AGC disabled we get raw float samples in [−1, 1]; 0 dBFS = digital
  full scale. It is relative to the mic/OS gain, not absolute SPL (SPL would need calibration).

## 4. Signal processing

All processing is client-side, Web Audio API, no server.

```
mic ─► MediaStreamSource ─► AnalyserNode (fftSize 4096, raw time-domain float)
                                  │  requestAnimationFrame (~60 Hz)
                                  ▼
        ┌──────── frame (last 4096 samples, ~85 ms @ 48 kHz) ────────┐
        │ level: RMS, peak                                           │
        │ gate: RMS > −45 dBFS                                       │
        │ pitch: YIN on 2048-sample window, f0 ∈ [60, 1500] Hz       │
        │ formants: decimate → ~12 kHz, pre-emphasis, Hamming,       │
        │           LPC order 12–14 (autocorrelation/Levinson),      │
        │           polynomial roots (Durand–Kerner) → freq + bw,    │
        │           keep bw < 500 Hz, assign F1/F2/F3 by range       │
        │ ring: band energies from FFT of the same frame             │
        └──────────────────────────┬─────────────────────────────────┘
                                   ▼
            smoothing (median-of-5 + EMA), vibrato-mean for tuner
                                   ▼
                     canvas renderers (tuner, F3, vowel map, meter)
```

- **Pitch — YIN** (de Cheveigné & Kawahara 2002) with cumulative-mean-normalised difference,
  absolute threshold 0.15, parabolic interpolation. Voicing = gate passed AND aperiodicity < 0.25.
  Range 60–1500 Hz covers bass low E2 to soprano F6/G6 (whistle register out of scope).
- **Formants — LPC**. Decimate by an integer factor to ~11–12 kHz (anti-alias FIR first), giving a
  ~5.5–6 kHz analysis band — enough for F1–F3 and the 3 kHz cluster. Order = 2 + fs/1000 ≈ 14.
  Roots in the upper half plane → `f = θ·fs/2π`, `bw = −ln|r|·fs/π`.
- **Known limitation — high voices**: when f0 > ~500 Hz (soprano above the staff) harmonics are
  so sparse that LPC fits the harmonics, not the resonances, and F1 tends to lock to f0 or 2f0.
  Mitigations: (a) show the dot faded/hollow with a "pitch too high for reliable vowel reading"
  hint when f0 > 600 Hz; (b) later, a harmonic-amplitude-based estimator. This is a physical
  limit of the method (and of the voice's acoustic output), not a bug — it also motivates the
  vowel-modification pedagogy for top notes.
- **Smoothing**: per-track median-of-5 to kill outliers, then exponential smoothing (τ ≈ 80 ms).
  Tracks are dropped (UI fades) after 150 ms unvoiced.
- **Performance**: one frame ≈ YIN O(N·τmax) on 2048 samples + LPC ~14×1024 + root finding 14³ —
  well under 2 ms on a laptop. Upgrade path: move to an AudioWorklet + Worker if mobile profiling
  shows jank.

## 5. Architecture & stack

- **Static site, no build step**: `index.html` + ES modules under `src/`. Zero dependencies.
  - `src/dsp/pitch.js` YIN, note/cents helpers
  - `src/dsp/formants.js` decimation, LPC, root finding, formant assignment
  - `src/dsp/analyzer.js` per-frame pipeline + smoothing
  - `src/ui/*.js` one canvas renderer per panel
  - `src/demo.js` synthetic singer
  - `src/vowels.js` landmark presets
- **Why vanilla**: the DSP and canvas renderers are framework-agnostic; when moving into the
  synsoph Vercel stack (assumed Next.js/React), they wrap into a client component
  (`'use client'`, start audio in an effect) without rewrite. If the stack turns out to be plain
  static, the folder deploys as-is (`vercel deploy`, framework preset "Other").
- **Requirements**: microphone needs a secure context — `http://localhost` (dev) or HTTPS (Vercel).
- **Persistence**: settings (voice preset, A4) and calibration in `localStorage` (the brief says
  "cookies"; localStorage is the better fit since nothing needs to reach a server — trivially
  swapped if synsoph needs server access).
- **Privacy**: audio never leaves the device. State this on the landing screen.

## 6. Roadmap after MVP

### 6.1 Detailed UI (toggle)
- Hz grid lines + numeric readouts on all panels (f0 Hz, cents, F1/F2/F3 Hz).
- Extra IPA landmarks: ə (schwa), y, ø, œ, ɨ, ʉ, ɯ, ɑ, æ, ʌ, ɪ, ʊ — shown in a lighter style.
- Scrolling **spectrogram** strip with formant tracks overlaid (the "spectrogram analyzer" view).

### 6.2 Quarter tones
- Tuner strip gains quarter-tone ticks and labels (`A↑` / `A𝄲`, `B↓` / `B𝄳`); colour thresholds
  halve (green ≤ 5¢, orange ≤ 15¢) and snap to the nearest 50-cent step.

### 6.3 Calibrated UI
- Guided flow: "Sing [a] on a comfortable pitch for 3 s" ×5 (a, e, i, o, u; optional ɛ, ɔ).
- Each capture = median F1/F2/F3 over the stable middle 2 s; reject if unvoiced/unstable.
- Saved to localStorage per voice profile; personal landmarks **replace** the defaults; ɛ/ɔ
  interpolated if not captured. Reset-to-defaults button.

### 6.4 P2
- **Test microphone**: record 3 s, play back, show level + noise floor, warn if AGC detected.
- **Model sound / imitate** (Praat-like): synthesise the target vowel at the chosen pitch with the
  demo synth (already built for the MVP).
- **Help tooltips** on every panel ("What is F3?", "Why does my vowel jump on high notes?").
- **Record & playback analysis**: record a phrase, then scrub through it with all panels synced.

## 7. Risks / open questions
1. Laptop mics + room acoustics distort F3 region; consider a "use headset/USB mic" hint.
2. Safari iOS: AudioContext must be created inside the click handler; check
   `getUserMedia` constraints are honoured (iOS ignores some).
3. Default landmarks are population averages — expect singers to be "off" until calibrated;
   onboarding copy should say so.
4. Synsoph stack details unknown — confirm framework and route (e.g. `/analyzer`) before porting.

## 8. MVP acceptance
- Start button → permission prompt → live panels within 1 s.
- Demo voice drives every panel; dot visits each Italian landmark in turn; tuner reads the
  demo's notes green.
- No horizontal scroll at 375 px width; works in Chrome, Edge, Firefox, Safari desktop.
