# Synsoph Vocal Analyzer (MVP)

Live pitch tuner, F3 / singer's-formant bar and Italian-vowel F1×F2 map for classical singers.
Static site, no build step, no dependencies. See [DESIGN.md](DESIGN.md) for the full design.

## Run locally

```bash
python serve.py
```

Open http://localhost:5173 → **Start analyzing** (mic) or **Try demo voice** (synthetic singer).
`http://localhost:5173/?demo` auto-starts the demo silently (analysis only, for visual QA). The demo plays the phrase once and stops if the tab is hidden. `test.html` runs an offline DSP self-test
(pitch + formant accuracy on synthetic vowels).

The mic needs a secure context: `localhost` or HTTPS.

## Layout

```
index.html, styles.css
src/main.js            audio session, render loop, DOM
src/dsp/pitch.js       YIN pitch + note helpers
src/dsp/formants.js    decimation, LPC, root finding → F1/F2/F3
src/dsp/analyzer.js    per-frame pipeline, smoothing, vibrato-averaged pitch
src/ui/panels.js       canvas renderers (gauge, trace, F3 bar, vowel map, meter)
src/demo.js            formant-synth demo singer
src/vowels.js          landmark presets (high / low voice)
```

## Deploy (Vercel)

Plain static: `vercel deploy` from this folder with framework preset "Other" (no build command,
output dir `.`). To embed in a Next.js app, move `src/` under the app and mount it from a
`'use client'` component; the DSP and renderers are framework-free.
