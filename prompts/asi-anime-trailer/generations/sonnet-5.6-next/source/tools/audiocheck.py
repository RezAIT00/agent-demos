"""Audio QA: clipping, DC offset, clicks, digital silence, hit timing.
   python tools/audiocheck.py soundtrack.wav
"""
import sys, wave
import numpy as np

w = wave.open(sys.argv[1], 'rb')
sr, n, ch, sw = w.getframerate(), w.getnframes(), w.getnchannels(), w.getsampwidth()
raw = np.frombuffer(w.readframes(n), dtype=np.uint8)
if sw == 3:
    a = raw.reshape(-1, 3).astype(np.int32)
    v = a[:, 0] | (a[:, 1] << 8) | (a[:, 2] << 16)
    v = np.where(v & 0x800000, v - 0x1000000, v) / 8388608.0
else:
    v = np.frombuffer(raw.tobytes(), dtype=np.int16) / 32768.0
x = v.reshape(-1, ch).astype(np.float64)
print(f'format: {sr} Hz, {ch} ch, {sw * 8} bit, {n / sr:.3f} s')
print(f'sample peak: {20 * np.log10(np.abs(x).max()):.2f} dBFS   clipped samples (>= -0.01 dBFS): {(np.abs(x) >= .9988).sum()}')
print(f'dc offset: L {x[:, 0].mean():.2e}  R {x[:, 1].mean():.2e}')

# clicks: a sample step far outside what the surrounding 20 ms normally does
mono = x.mean(axis=1)
d = np.abs(np.diff(mono, n=2))
win = int(.02 * sr)
blocks = len(d) // win
bad = []
for b in range(blocks):
    seg = d[b * win:(b + 1) * win]
    ref = np.percentile(seg, 97) + 1e-9
    if seg.max() > max(.22, ref * 14):
        bad.append(((b * win + seg.argmax()) / sr, float(seg.max()), float(seg.max() / ref)))
print(f'click candidates: {len(bad)}', ' '.join(f'{t:.3f}s({m:.2f},x{r:.0f})' for t, m, r in bad[:12]))

# digital silence inside the blink
z = np.all(x == 0, axis=1)
runs, start = [], None
for i in np.flatnonzero(np.diff(z.astype(np.int8)) != 0) + 1:
    if z[i]:
        start = i
    elif start is not None:
        if i - start > sr * .3:
            runs.append((start / sr, i / sr))
        start = None
print('digital-silence runs > 0.3 s:', ', '.join(f'{a:.2f}-{b:.2f}s' for a, b in runs) or 'none')

# hit timing: strongest spectral-flux onset near each picture time
hop, size = 96, 1024
hann = np.hanning(size)
def flux_onset(t, span=.1):
    c0 = int((t - span) * sr) - size // 2
    frames = [np.log1p(40 * np.abs(np.fft.rfft(mono[c0 + k * hop: c0 + k * hop + size] * hann))) for k in range(int(2 * span * sr / hop) + 1)]
    f = np.array([np.clip(q - p, 0, None).sum() for p, q in zip(frames[:-1], frames[1:])])
    k = int(np.argmax(f))
    return (c0 + (k + 1) * hop + int(size * .75)) / sr
hits = {'impact/freeze': 2.0, 'roof': 5.0, 'nose chime': 19.56, 'drop': 28.0, 'future 2': 30.0, 'future 3': 32.0, 'future 4': 34.0,
        'future 5': 36.0, 'web': 40.0, 'iris boom': 45.0, 'matches:0': 55.74, 'pinky hook': 66.22, 'finale': 74.625, 'plip on nose': 77.5, 'title slam': 81.75}
print('hit alignment (audio onset minus picture time):')
errs = []
for k, t in hits.items():
    o = flux_onset(t); errs.append(abs(o - t) * 24)
    print(f'  {k:15s} {t:7.3f}s   {1000 * (o - t):+6.1f} ms  ({(o - t) * 24:+.2f} frames)')
print(f'within one frame: {sum(e <= 1 for e in errs)}/{len(errs)}   median error: {np.median(errs):.2f} frames')
