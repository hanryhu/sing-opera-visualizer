"""Run Praat (parselmouth) pitch + formant analysis on every WAV here; write praat.json.
Pitch: To Pitch (ac), 10 ms step, floor 60 Hz, ceiling 1500 Hz (Praat's standard singing settings).
Formants: To Formant (burg), 10 ms, 5 formants, 25 ms window; ceiling 5000 Hz for low voices / f0<300, 5500 otherwise."""
import glob, json, sys
import numpy as np
import parselmouth

out = {}
for path in sorted(glob.glob('*.wav')):
    name = path[:-4]
    snd = parselmouth.Sound(path)
    pitch = snd.to_pitch_ac(time_step=0.01, pitch_floor=60, pitch_ceiling=1500)
    ts = pitch.xs()
    f0 = pitch.selected_array['frequency']
    high = name.endswith(('mezzo', 'soprano')) or (name.startswith('syn_') and int(name.split('_')[2]) >= 300)
    ceiling = 5500 if high else 5000
    fm = snd.to_formant_burg(time_step=0.01, max_number_of_formants=5, maximum_formant=ceiling, window_length=0.025)
    F = [[fm.get_value_at_time(k, t) for t in ts] for k in (1, 2, 3)]
    clean = lambda a: [None if (v is None or not np.isfinite(v)) else round(float(v), 1) for v in a]
    out[name] = {'t': [round(float(t), 3) for t in ts], 'f0': [round(float(v), 2) for v in f0],
                 'f1': clean(F[0]), 'f2': clean(F[1]), 'f3': clean(F[2]), 'ceiling': ceiling}
    print(name, file=sys.stderr)
json.dump(out, open('praat.json', 'w'))
print(len(out), 'files')
