"""Measure what can be measured: tuning of every melody note, balance, clipping."""
import json
import os
import numpy as np
from scipy.io import wavfile
import sampler

OUT = os.path.join(sampler.ROOT, "out")
meta = json.load(open(os.path.join(OUT, "events.json")))
SONG_AT = meta["songAt"]
sr, voices = sampler.load_voices()


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def harmonic_error(y, target):
    """Cents between `target` and the strongest spectral comb near it."""
    n = 1 << 18
    spec = np.abs(np.fft.rfft(y * np.hanning(len(y)), n))
    cands = target * 2 ** (np.arange(-150, 151, 2) / 1200)
    score = []
    for f in cands:
        k = np.arange(1, 9) * f
        k = k[k < 7000]
        score.append(np.interp(k, np.fft.rfftfreq(n, 1 / sr), spec).sum())
    return float(np.arange(-150, 151, 2)[int(np.argmax(score))])


# 1) every distinct melody note rendered dry, exactly as the arrangement asks
print("tuning of dry melody notes (cents, 100 = one semitone)")
groups = {}
for e in meta["events"]:
    if e["r"] in ("riff", "vocal", "echo", "bass") and e["m"] is not None:
        groups.setdefault((e["r"], e["i"], e["m"], round(e["d"], 3)), 0)
by_role = {}
for role, name, m, d in groups:
    kw = {}
    if role == "riff":
        kw = dict(formant=1.42 if name == "nyaa" else 1.22, skip=0.2 if name == "nyaa" else 0.05)
    elif role == "bass":
        kw = dict(skip=0.03)
    else:
        kw = dict(formant=float(np.clip(1 + (m - 57) * 0.016, 1.0, 1.34)))
    y = voices[name].play(hz(m), max(d, 0.14), **kw)
    err = harmonic_error(y[int(0.03 * sr):int(max(d, 0.14) * sr)], hz(m))
    by_role.setdefault(role, []).append((abs(err), err, name, m, d))
for role, rows in by_role.items():
    a = np.array([r[0] for r in rows])
    worst = max(rows)
    print(f"  {role:6s} {len(rows):3d} notes  median {np.median(a):4.0f}  worst {a.max():4.0f} "
          f"({worst[2]} midi {worst[3]}, {worst[4]:.2f}s)")

# 2) balance of stems per section
print("\nstem loudness by section (dB RMS, before master)")
stems = {f[:-4]: wavfile.read(os.path.join(OUT, "stems", f))[1]
         for f in sorted(os.listdir(os.path.join(OUT, "stems")))}
print("  " + " " * 12 + "".join(f"{k:>8s}" for k in stems))
for s in meta["sections"]:
    a, b = int((s["start"] - SONG_AT) * sr), int((s["end"] - SONG_AT) * sr)
    row = []
    for v in stems.values():
        r = np.sqrt(np.mean(v[a:b] ** 2))
        row.append(f"{20*np.log10(r+1e-9):8.1f}" if r > 1e-6 else "       -")
    print(f"  {s['name']:12s}" + "".join(row))

# 3) final file health
_, y = wavfile.read(os.path.join(OUT, "soundtrack.wav"))
y = y.astype(np.float64) / 32768
print(f"\nsoundtrack peak {20*np.log10(np.abs(y).max()):.2f} dBFS, "
      f"samples at full scale: {(np.abs(y) > 0.999).sum()}")
