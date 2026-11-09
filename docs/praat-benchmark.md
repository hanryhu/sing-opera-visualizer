# App analyzer vs Praat (2026-11-08)

Praat 6.1.38 via parselmouth 0.4.7. App analyzer run offline on the same 48 kHz files, 10 ms hop, 4096-sample frames.
Harness: `tools/praat-bench/` (see bottom). App frames lag Praat's by 40 ms (window end + smoothing), compensated.

## Sets
- **Synthetic, ground truth**: 70 files — vowels i e a o u × f0 110–784 Hz × with/without 6 Hz ±60 c vibrato.
  Cascade resonators (F1–F3 = Ferrero sung values, F4 3500, F5 4500) on a 1/k harmonic source.
- **Real**: the five aria samples' Demucs vocal stems. No ground truth; Praat is the reference for pitch.

Praat settings: `To Pitch (ac)` 60–1500 Hz; `To Formant (burg)` 5 formants, 25 ms, ceiling 5000 Hz (5500 for high voices / f0 ≥ 300).

## Results

### Pitch
| | App | Praat |
|---|---|---|
| Synthetic median error, steady tones | 1.4–3.1 cents | 1.4–3.1 cents |
| Synthetic gross errors | 0 % | 0 % |

The two are equally accurate on clean tones.

On the real arias, with frames where both trackers are voiced:

| voice | frames within 50 c | app an octave above Praat | app voiced / Praat voiced |
|---|---|---|---|
| bass | 67 % | 14 % | 60 % / 84 % |
| baritone | 83 % | 0 % | 58 % / 78 % |
| tenor | 83 % | 14 % | 91 % / 91 % |
| mezzo | 85 % | 1 % | 80 % / 92 % |
| soprano | 88 % | 0 % | 85 % / 93 % |

The octave disagreements are almost always the app reading high. On the longest one, the tenor's held F4 (343 Hz) at 5.2–6.2 s, the app reads 686 Hz. In the spectrum, h2 dominates while h1 and h3 are 21–27 dB below it, and h5–h8 are as strong as the even harmonics. This is the classic picture of R1 tuned to 2f0, plus a weak fundamental in an old recording. Only a 343 Hz fundamental produces odd harmonics, so Praat is right.

In YIN terms, d′(τ) at 686 Hz is only 0.02–0.07, which passes as clean, so the app's 2× check (it needs d′ > 0.11) never fires. d′(2τ) is usually lower (ratio about 0.3), but not on every frame. Praat avoids this because its path finder decides octaves over the whole contour, not frame by frame.

### Formants
Median absolute error against ground truth, in %. Each cell is app / Praat with default settings.

| f0 | F1 | F2 | F3 |
|---|---|---|---|
| 110–220 Hz | 2–7 / 2–6 | 0.5–1.7 / 22–23 | 0.5–0.7 / 25–36 |
| 330 Hz | 8 / 9 | 1.6 / 6 | 0.6 / 19 |
| 440 Hz | 36 / 30 | 6 / 5 | 1.1 / 16 |
| 587–784 Hz | 74–113 / 69–110 | 29–31 / 20–26 | 7–8 / 10–11 |

- **Praat's default F2/F3 errors come from its settings, not its method.** With 5 formants under 5000 Hz, it inserted a spurious formant between F1 and F2. With 4 formants under 4000–4500 Hz, its low-pitch errors drop to F1 3 %, F2 1 % and F3 1–3 %, the same as the app. This is the known Praat caveat: users tune the ceiling and formant count per speaker. The app's fixed settings didn't need tuning on this set.
- **Above about 440 Hz, both fail on F1 in the same way.** Once f0 is above the true F1, no harmonic falls near F1, so it can't be measured by any method. This is physics, not a bug. It's why the app moves its vowel targets with pitch.
- On the real arias, the app's formants are within 5–12 % of Praat's for F1, 5–25 % for F2 (worst on the mezzo) and 3–10 % for F3. Neither is ground truth there.

## What to take from Praat
1. **Note-level octave decision.** This is Praat's path-finder idea made causal. While a note is held, accumulate d′(2τ)/d′(τ). If it stays clearly below 1 for about 200 ms, show the lower octave for the rest of the note. This targets the 14 % of tenor and bass frames above. The risk is period doubling (vocal fry, pressed onsets), which looks the same within a single frame. Validate with this harness plus test.html before shipping: an earlier per-frame harmonic check made results worse.
2. **Adaptive voicing gate.** Praat sets its silence threshold relative to the loudest part of the file. The app uses a fixed −45 dB, so it drops 20–25 % more frames on quiet low-voice passages. A live version would use the recent peak level, for example over the last 10 s.
3. **Not worth adopting:**
   - Burg LPC: no accuracy gain here, and it needs per-voice tuning.
   - Praat's formant tracker: our median and exponential smoothing already hold steady.
   - Jitter, shimmer and HNR: clinical measures, outside the app's purpose.
   - Cepstral peak prominence, a measure of how clear versus breathy a voice is, would be the only voice-quality measure worth considering later.

## Re-running
```bash
cd tools/praat-bench
python -m pip install praat-parselmouth numpy scipy
python synth.py                       # synthetic WAVs + truth.json
for v in bass baritone tenor mezzo soprano; do ffmpeg -y -i ../../samples/$v.vocals.ogg -ac 1 -ar 48000 -c:a pcm_f32le real_$v.wav; done
python praat_run.py                   # praat.json
python receiver.py &                  # saves the browser's POST as app.json
# open http://localhost:5174/tools/praat-bench/app_run.html (python serve.py 5174 from repo root)
python compare.py
```
