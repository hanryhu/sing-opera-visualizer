// Vibrato rate (Hz) and extent (± cents) from the recent pitch track.
//
// Reference bands (see the in-app help for citations):
//  - Rate: 5.5–6.7 Hz measured on sustained tones of ten celebrated singers (Prame 1994, JASA 96);
//    listeners judged vibrato most appropriate at ~6 Hz, less so above and below (Anand et al. 2012, J Voice 26).
//  - Extent: ±34 to ±123 cents across professional lyric singers, mean ±71 (Prame 1997, JASA 102);
//    greater depth was judged less appropriate (Anand et al. 2012).
// No study was found that prescribes vibrato rate as a function of tempo; rate rises toward note ends (Prame).

export const RATE_BAND = [5.5, 6.7];   // Hz, Prame 1994
export const RATE_BEST = 6.0;          // Hz, Anand et al. 2012
export const EXTENT_BAND = [34, 123];  // ± cents, Prame 1997

const FS = 100;       // resample the pitch track to 100 Hz
const WIN = 1.2;      // seconds analysed
const MIN_DUR = 0.6;  // need at least this much continuous voicing

/**
 * @param {{t:number, midi:number}[]} pts recent pitch readings (seconds, MIDI), oldest first
 * @param {number} now seconds
 * @param {number} [pitchWindow] duration (s) of the pitch-analysis window; each pitch reading averages the
 *   vibrato over this window, shrinking the swing by sinc(π·rate·window) — corrected below.
 * @returns {{present:boolean, rate:number, extent:number, strength:number}|null} null if not enough data
 */
export function analyzeVibrato(pts, now, pitchWindow = 0) {
  // Most recent continuous run (no gap > 120 ms) within the window
  let i = pts.length - 1;
  if (i < 0 || now - pts[i].t > 0.15) return null;
  while (i > 0 && pts[i].t - pts[i - 1].t < 0.12 && now - pts[i - 1].t <= WIN) i--;
  const run = pts.slice(i);
  const dur = run[run.length - 1].t - run[0].t;
  if (dur < MIN_DUR) return null;
  // Must be one held note (vibrato around a centre), not a run of notes
  let lo = Infinity, hi = -Infinity;
  for (const p of run) { lo = Math.min(lo, p.midi); hi = Math.max(hi, p.midi); }
  if (hi - lo > 3) return null;

  // Resample to a uniform 100 Hz series (cents)
  const n = Math.floor(dur * FS);
  const y = new Float64Array(n);
  let k = 0;
  for (let j = 0; j < n; j++) {
    const t = run[0].t + j / FS;
    while (k < run.length - 2 && run[k + 1].t < t) k++;
    const a = run[k], b = run[k + 1];
    const u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
    y[j] = (a.midi + (b.midi - a.midi) * Math.max(0, Math.min(1, u))) * 100;
  }
  // Remove the slow trend (the note centre, including slow drift): linear fit
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let j = 0; j < n; j++) { sx += j; sy += y[j]; sxx += j * j; sxy += j * y[j]; }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx), icpt = (sy - slope * sx) / n;
  for (let j = 0; j < n; j++) y[j] -= icpt + slope * j;

  // Autocorrelation peak for periods between 1/9 s and 1/3.5 s (rate 3.5–9 Hz)
  let r0 = 0;
  for (let j = 0; j < n; j++) r0 += y[j] * y[j];
  if (r0 <= 0) return { present: false, rate: 0, extent: 0, strength: 0 };
  let best = 0, bestLag = 0;
  const ac = [];
  for (let lag = Math.floor(FS / 9); lag <= Math.ceil(FS / 3.5) && lag < n - 10; lag++) {
    let s = 0;
    for (let j = 0; j + lag < n; j++) s += y[j] * y[j + lag];
    const v = s / r0 * (n / (n - lag)); // unbiased
    ac[lag] = v;
    if (v > best) { best = v; bestLag = lag; }
  }
  if (!bestLag) return { present: false, rate: 0, extent: 0, strength: 0 };
  // Parabolic refinement of the period
  const a = ac[bestLag - 1] ?? best, c = ac[bestLag + 1] ?? best;
  const den = a - 2 * best + c;
  const lag = bestLag + (den ? 0.5 * (a - c) / den : 0);
  const rms = Math.sqrt(r0 / n);
  const rate = FS / lag;
  const x = Math.PI * rate * pitchWindow;
  const sinc = x > 1e-6 ? Math.sin(x) / x : 1;
  const extent = (rms * Math.SQRT2) / Math.max(0.5, sinc); // ± cents of an equivalent sinusoid, window-corrected
  const present = best > 0.35 && extent > 12;
  return { present, rate, extent, strength: best };
}
