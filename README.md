# Synsoph Vocal Analyzer

Live pitch tuner, F3 / singer's-formant bar and Italian-vowel F1×F2 map for classical singers.
Static site, no build step, no dependencies. See [DESIGN.md](DESIGN.md) for the full design.

## Run locally

```bash
python serve.py
```

Open http://localhost:5173 → **Start analyzing** (mic).
`test.html` runs an offline DSP self-test
(pitch + formant accuracy on synthetic vowels).

The mic needs a secure context: `localhost` or HTTPS.

## Modes (header toggles)

- **Detail**: Hz/cents/dB readouts and grids on every panel, plus extra IPA landmarks (ə y ø œ ɪ ʊ ʌ ɑ æ).
- **¼ tones**: quarter-tone steps (e.g. `A↑` = A quarter-sharp); in-tune band tightens to ±5¢.
- **Calibrate**: record a e i o u (ɛ ɔ optional, else interpolated); saved per voice type in
  localStorage and used instead of the default landmarks. "reset" on the map badge reverts.

Dev: `?devtest` runs the synthetic melody (vibrato, tuning errors) silently; `?devtest=a` sustains a single vowel; `window.__va.demo('e')` switches it (calibration QA).

## Feedback recordings

**● Feedback** (header) records up to 10 s while any source is running and offers three local files:
`sing-feedback-<time>.webm` (dashboard video + sound), `.wav` (the exact signal the analyzer heard) and `.json`
(every analyzer frame + settings). Replaying the WAV through `src/dsp/analyzer.js` reproduces a report exactly.

## Samples

**Samples** plays a 20–30 s looping excerpt per voice part (bass → soprano) through the analyzer: historic
Verdi recordings from ICBSA via Wikimedia Commons, CC BY-SA 4.0 — see [samples/CREDITS.md](samples/CREDITS.md).
Old acoustic recordings and orchestra make vowel readings noisier than a solo voice. Dev: `?devsample=tenor` (silent).

## Layout

```
index.html, styles.css
src/main.js            audio session, render loop, DOM
src/dsp/pitch.js       YIN pitch + note helpers
src/dsp/formants.js    decimation, LPC, root finding → F1/F2/F3
src/dsp/analyzer.js    per-frame pipeline, smoothing, vibrato-averaged pitch
src/ui/panels.js       canvas renderers (gauge, trace, F3 bar, vowel map, meter)
src/demo.js            formant-synth demo singer
src/vowels.js          landmark presets, extra IPA, calibration interpolation
src/calibration.js     calibration panel + persistence
```

## Deploy (Vercel)

Plain static: `vercel deploy` from this folder with framework preset "Other" (no build command,
output dir `.`). To embed in a Next.js app, move `src/` under the app and mount it from a
`'use client'` component; the DSP and renderers are framework-free.
