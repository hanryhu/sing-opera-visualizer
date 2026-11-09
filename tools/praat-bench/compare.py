"""Compare app.json and praat.json: synthetic files vs ground truth, real arias app vs Praat."""
import json
import numpy as np

P = json.load(open('praat.json')); A = json.load(open('app.json')); T = json.load(open('truth.json'))


def interp(src, key, ts):
    """Sample a track at times ts (nearest frame); None/0 -> nan."""
    t = np.array(src['t']); v = np.array([np.nan if (x is None or x == 0) else x for x in src[key]], float)
    i = np.clip(np.searchsorted(t, ts), 0, len(t) - 1)
    return v[i]


def app_at(name, key, ts, lag):
    return interp(A[name], key, ts + lag)


cents = lambda a, b: 1200 * np.log2(a / b)

# Best lag of the app (its frame time = window END + smoothing) vs Praat (window centre), from real arias
def best_lag():
    best = None
    for lag in np.arange(0, 0.121, 0.01):
        errs = []
        for v in ['bass', 'baritone', 'tenor', 'mezzo', 'soprano']:
            n = 'real_' + v; ts = np.array(P[n]['t'])
            p = interp(P[n], 'f0', ts); a = app_at(n, 'f0', ts, lag)
            m = ~np.isnan(p) & ~np.isnan(a)
            errs.append(np.abs(cents(a[m], p[m])))
        e = np.median(np.concatenate(errs))
        if best is None or e < best[1]: best = (lag, e)
    return best[0]

LAG = best_lag()
print(f'app time offset vs Praat: {LAG*1000:.0f} ms\n')

# ---------- Synthetic ----------
print('SYNTHETIC (ground truth). Pitch: median |error| cents (steady files) / gross-error % (>50 c beyond vibrato) / voiced %')
rows = {}
for name, tr in T.items():
    ts = np.arange(0.35, 1.45, 0.01)
    f0 = tr['f0']
    vib_ext = 60 if tr['vib'] else 0
    res = {}
    for who in ('app', 'praat'):
        src = A[name] if who == 'app' else P[name]
        lag = LAG if who == 'app' else 0
        p = interp(src, 'f0', ts + lag)
        voiced = ~np.isnan(p)
        e = np.abs(cents(p[voiced], f0))
        gross = np.mean(e > vib_ext + 50) * 100 if voiced.any() else np.nan
        med = np.median(e) if voiced.any() and not tr['vib'] else np.nan
        fe = {}
        for k in ('f1', 'f2', 'f3'):
            fv = interp(src, k, ts + lag)
            ok = ~np.isnan(fv)
            fe[k] = np.median(np.abs(fv[ok] / tr[k] - 1)) * 100 if ok.any() else np.nan
        res[who] = dict(voiced=voiced.mean() * 100, gross=gross, med=med, **fe)
    rows[name] = res

def table(group_key, label):
    keys = sorted({T[n][group_key] for n in T}, key=lambda x: (isinstance(x, str), x))
    print(f'\n by {label}:')
    print('  {:>6} | {:>18} | {:>14} | {:>17} | {:>17} | {:>17}'.format(label, 'pitch med c app/pr', 'gross% app/pr', 'F1 err% app/pr', 'F2 err% app/pr', 'F3 err% app/pr'))
    for g in keys:
        ns = [n for n in T if T[n][group_key] == g]
        f = lambda who, k: np.nanmean([rows[n][who][k] for n in ns])
        print('  {:>6} | {:>8.1f} / {:<7.1f} | {:>5.1f} / {:<6.1f} | {:>7.1f} / {:<7.1f} | {:>7.1f} / {:<7.1f} | {:>7.1f} / {:<7.1f}'.format(
            str(g), f('app', 'med'), f('praat', 'med'), f('app', 'gross'), f('praat', 'gross'),
            f('app', 'f1'), f('praat', 'f1'), f('app', 'f2'), f('praat', 'f2'), f('app', 'f3'), f('praat', 'f3')))

table('f0', 'f0 Hz')
table('vowel', 'vowel')

# ---------- Real arias ----------
print('\nREAL ARIAS (Demucs vocal stems): app vs Praat')
print('  {:>9} | {:>7} {:>7} | {:>8} {:>8} {:>8} | {:>14} {:>14} {:>14}'.format('voice', 'voc app', 'voc pr', '<50c %', 'octave%', 'other%', 'F1 diff% med', 'F2 diff% med', 'F3 diff% med'))
for v in ['bass', 'baritone', 'tenor', 'mezzo', 'soprano']:
    n = 'real_' + v; ts = np.array(P[n]['t'])
    p = interp(P[n], 'f0', ts); a = app_at(n, 'f0', ts, LAG)
    both = ~np.isnan(p) & ~np.isnan(a)
    d = cents(a[both], p[both])
    near = np.mean(np.abs(d) < 50) * 100
    octv = np.mean(np.abs(np.abs(d) - 1200) < 100) * 100 + np.mean(np.abs(np.abs(d) - 1902) < 100) * 100
    other = 100 - near - octv
    fd = []
    for k in ('f1', 'f2', 'f3'):
        pf = interp(P[n], k, ts); af = app_at(n, k, ts, LAG)
        m = both & ~np.isnan(pf) & ~np.isnan(af)
        fd.append(np.median(np.abs(af[m] / pf[m] - 1)) * 100)
    print('  {:>9} | {:>6.0f}% {:>6.0f}% | {:>8.1f} {:>8.1f} {:>8.1f} | {:>14.1f} {:>14.1f} {:>14.1f}'.format(
        v, np.mean(~np.isnan(a)) * 100, np.mean(~np.isnan(p)) * 100, near, octv, other, *fd))
    # median Praat f0 for context
    print(f'            median f0 Praat {np.nanmedian(p):.0f} Hz')
