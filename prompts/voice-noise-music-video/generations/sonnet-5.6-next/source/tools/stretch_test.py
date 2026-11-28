"""Cut the six clips, then check each can be held long and played in tune."""
import os
import numpy as np
import sampler

sr, x = sampler.load_source()
_, voices = sampler.load_voices()
clip_dir = os.path.join(sampler.ROOT, "noises", "clips")
os.makedirs(clip_dir, exist_ok=True)
for n, (name, (a, b, _, _)) in enumerate(sampler.PITCHED.items(), 1):
    sampler.save(os.path.join(clip_dir, f"{n}_{name}.wav"), sr, x[int(a * sr):int(b * sr)])

print("source pitch per clip (Hz):")
for name, v in voices.items():
    print(f"  {name:5s} base {v.base_hz:6.1f}  cycles total {len(v.marks):3d}  in sustain {len(v.sustain):3d}")


def measure(y, hz):
    """Pitch error in cents over the held part, searching around the target."""
    mid = y[int(0.25 * sr):int(1.9 * sr)]
    _, f0 = sampler.pitch_track(mid, sr, lo=hz / 1.5, hi=hz * 1.5, size=max(0.03, 4 / hz))
    cents = 1200 * np.log2(f0 / hz)
    return np.median(cents), np.percentile(np.abs(cents), 95)


print("\n2-second held notes: median error / 95th-percentile error, in cents (100 = one semitone)")
targets = {"G2": 98.0, "C3": 130.81, "G3": 196.0, "C4": 261.63, "G4": 392.0}
print("        " + "".join(f"{k:>14s}" for k in targets))
for name, v in voices.items():
    row = []
    for hz in targets.values():
        med, p95 = measure(v.play(hz, 2.0), hz)
        row.append(f"{med:+5.0f} /{p95:5.0f}")
    print(f"  {name:6s}" + "".join(f"{r:>14s}" for r in row))

# Demo: every noise plays the same short rising phrase, last note held for 1.6 s.
# Notes are far longer than the half-second originals on purpose.
semi = lambda base, s: base * 2 ** (s / 12)
parts, gap = [], np.zeros(int(0.35 * sr))
for name, v in voices.items():
    base = 65.41 if name == "dum" else 130.81  # C2 bass, C3 for the rest
    if name == "dum":
        base = 87.31  # F2: stays close to the recorded pitch
    phrase = [v.play(semi(base, s), d, release=0.05) for s, d in ((0, 0.28), (4, 0.28), (7, 0.28))]
    phrase.append(v.play(semi(base, 12), 1.6, release=0.15, vibrato_cents=22))
    parts += phrase + [gap]
demo = os.path.join(sampler.ROOT, "noises", "stretch_demo.wav")
sampler.save(demo, sr, np.concatenate(parts))
print("\nwrote", demo, f"({sum(len(p) for p in parts)/sr:.1f}s)")
