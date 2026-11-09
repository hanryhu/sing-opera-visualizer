"""Synthetic sung vowels with known formants (ground truth) for the Praat-vs-app benchmark.
Cascade Klatt resonators on a 1/k harmonic source (-6 dB/oct after lip radiation), 48 kHz float WAV.
Writes syn_<vowel>_<f0>_<vib>.wav and truth.json."""
import json, wave, numpy as np
from scipy.signal import lfilter

FS = 48000
DUR = 1.6
# Sung Italian vowels (male-ish, Ferrero) + F4/F5
VOWELS = {
    'i': (290, 2310, 3000), 'e': (350, 2050, 2700), 'a': (780, 1430, 2600),
    'o': (390, 870, 2450), 'u': (320, 800, 2350),
}
F0S = [110, 165, 220, 330, 440, 587, 784]
BW = (70, 90, 120, 180, 250)
rng = np.random.default_rng(1)


def resonate(x, f, bw):
    T = 1 / FS
    C = -np.exp(-2 * np.pi * bw * T)
    B = 2 * np.exp(-np.pi * bw * T) * np.cos(2 * np.pi * f * T)
    A = 1 - B - C
    return lfilter([A], [1, -B, -C], x)


def source(f0, vib):
    t = np.arange(int(FS * DUR)) / FS
    cents = 60 * np.sin(2 * np.pi * 6 * t) if vib else 0 * t
    f = f0 * 2 ** (cents / 1200) * (1 + 0.002 * rng.standard_normal(len(t)).cumsum() / np.sqrt(len(t)))
    ph = 2 * np.pi * np.cumsum(f) / FS
    x = np.zeros_like(t)
    for k in range(1, int(5500 / f0) + 1):
        x += np.sin(k * ph) / k
    x += 0.003 * rng.standard_normal(len(t))  # a little breath noise
    return x


def write(path, x):
    x = (0.5 * x / np.max(np.abs(x))).astype('<f4')
    # float WAV (format 3) by hand
    import struct
    data = x.tobytes()
    hdr = b'RIFF' + struct.pack('<I', 36 + len(data)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 3, 1, FS, FS * 4, 4, 32) + b'data' + struct.pack('<I', len(data))
    open(path, 'wb').write(hdr + data)


truth = {}
for v, (f1, f2, f3) in VOWELS.items():
    F = (f1, f2, f3, 3500, 4500)
    for f0 in F0S:
        for vib in (0, 1):
            x = source(f0, vib)
            for f, bw in zip(F, BW):
                x = resonate(x, f, bw)
            name = f'syn_{v}_{f0}_{vib}'
            write(name + '.wav', x)
            truth[name] = {'vowel': v, 'f0': f0, 'vib': vib, 'f1': f1, 'f2': f2, 'f3': f3}
json.dump(truth, open('truth.json', 'w'), indent=0)
print(len(truth), 'files')
