# Pitch detector benchmark: app YIN vs pitchy (MPM)

Date: 2026-11-08 · Decision: **keep the app's own detector** (no migration). Re-run: open `bench.html`
on the dev server (`python serve.py`); the whistle row needs a local `.qa/whistle.ogg`.

## What was compared

| | App detector | pitchy 4.1.0 |
|---|---|---|
| Method | YIN (de Cheveigné & Kawahara 2002), time-domain difference function, + low-partial refine (re-measure on a zero-phase low-passed copy, cutoff 3.5·f0) | McLeod Pitch Method (normalized square difference via FFT autocorrelation) |
| Voicing rule (benchmark) | aperiodicity < 0.25 | clarity ≥ 0.9 (library default usage) |
| Code | `src/dsp/pitch.js` (`yin`, `refinePitch`) | MIT, npm `pitchy` |

Both were fed identical raw 2048-sample frames at 48 kHz, **before** the app's post-processing (octave folding,
median-of-5, hysteresis gate, vibrato-mean), so this compares the detector cores.

## Results

| Test | App (YIN + refine) | pitchy | Notes |
|---|---|---|---|
| Synthetic voice, 7 vowels × 13 pitches, 82–1047 Hz | 100% detected, 0% octave errors, median 0.37¢, p95 2.9¢ | 100%, 0%, median 0.00¢, p95 0.1¢ | pitchy more precise; both far below audibility (~5¢) |
| Piano-like tones A2–A5 (realistic inharmonicity) | bias **+1.1¢** | bias +6.6¢ (p95 15.9¢) | app wins only because of `refinePitch`; that step could wrap any core |
| User whistle recording (~1180 Hz, quiet) | 99.7% detected, median 2.1¢ | 99.7%, 2.0¢ | tie |
| Six aria vocal stems — steadiness | 9.5% frame-to-frame jumps > 1 st at 78% voiced | 9.5% at 77% voiced | tie **when matched for coverage** (see below) |
| False notes: silence, −40 dB noise, 50 Hz hum | 0 | 0 | tie |
| Speed per frame | 1.56 ms | 0.12 ms | pitchy ~13× faster (FFT-based) |

### Matched-coverage check (aria stems)
With default thresholds pitchy looked much steadier (0.7% jumps vs 9.1%), but it only reported a pitch on 43% of
frames vs 78%. Sweeping each detector's confidence threshold to the same coverage gives equal steadiness:

| Coverage | App jumps | pitchy jumps |
|---|---|---|
| ~40% | 0.4% | 0.5% |
| ~55% | 2.9% | 3.1% |
| ~70% | 7.8% | 6.7% |
| ~78% | 9.5% | 9.5% |

The jump rate is a property of how many ambiguous frames you accept, not of the core algorithm.

## Takeaways
- Accuracy and robustness are equivalent for this app's material; pitchy's precision edge is inaudible.
- pitchy is much faster. If mobile CPU becomes a problem, swapping the core is a low-risk option: keep
  `refinePitch`, octave folding, median smoothing and the voicing gate on top (they are detector-agnostic).
  Vendor the MIT bundle locally rather than loading from a CDN at runtime.
- The bugs found so far were in edge handling (an uncomputed lag in YIN, a too-strict level gate), not in the
  algorithm choice. Regression tests for these live in `test.html` and `bench.html`.
