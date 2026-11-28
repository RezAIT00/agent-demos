"""Find the sounds in a mono WAV and measure each one (numpy + scipy only)."""
import sys
import numpy as np
from scipy.io import wavfile

sr, x = wavfile.read(sys.argv[1])
x = x.astype(np.float64)

hop, win = int(sr * 0.005), int(sr * 0.020)
db = np.array([
    20 * np.log10(np.sqrt(np.mean(x[i:i + win] ** 2)) + 1e-12)
    for i in range(0, len(x) - win, hop)
])
print(f"length {len(x)/sr:.2f}s  peak {20*np.log10(np.abs(x).max()):.1f} dBFS  "
      f"noise floor (p10) {np.percentile(db, 10):.1f} dB  loud (p95) {np.percentile(db, 95):.1f} dB")

print("\nloudness every 100 ms (dB):")
for i in range(0, len(db), 20):
    v = db[i:i + 20].max()
    print(f"  {i*hop/sr:5.2f}s {v:7.1f} {'#' * max(0, int((v + 80) / 2))}")


def f0_frame(s, lo=50, hi=2000):
    """Normalised autocorrelation pitch estimate -> (hz, clarity 0..1)."""
    s = s - s.mean()
    n = len(s)
    spec = np.fft.rfft(s, 2 * n)
    ac = np.fft.irfft(np.abs(spec) ** 2)[:n]
    e = np.concatenate([[0], np.cumsum(s ** 2)])
    lags = np.arange(n)
    m = e[n - lags] + (e[n] - e[lags])
    nsdf = 2 * ac / (m + 1e-12)
    a, b = int(sr / hi), min(int(sr / lo), n - 2)
    peaks = [k for k in range(a, b) if nsdf[k] > nsdf[k - 1] and nsdf[k] >= nsdf[k + 1] and nsdf[k] > 0]
    if not peaks:
        return 0.0, 0.0
    best = max(nsdf[k] for k in peaks)
    k = next(k for k in peaks if nsdf[k] >= 0.9 * best)
    y0, y1, y2 = nsdf[k - 1], nsdf[k], nsdf[k + 1]
    d = 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2 - 1e-12)
    return sr / (k + d), float(y1)


for thresh in (-40, -52):
    on = db > thresh
    segs, i = [], 0
    while i < len(on):
        if on[i]:
            j = i
            while j < len(on) and on[j]:
                j += 1
            segs.append([i * hop / sr, (j * hop + win) / sr])
            i = j
        else:
            i += 1
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < 0.08:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    print(f"\n=== segments above {thresh} dB: {len(merged)} ===")
    for n, (a, b) in enumerate(merged, 1):
        seg = x[int(a * sr):int(b * sr)]
        mag = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
        fr = np.fft.rfftfreq(len(seg), 1 / sr)
        cen = (fr * mag ** 2).sum() / (mag ** 2).sum()
        fl = int(sr * 0.046)
        est = [f0_frame(seg[k:k + fl]) for k in range(0, max(1, len(seg) - fl), int(sr * 0.01))
               if np.sqrt(np.mean(seg[k:k + fl] ** 2)) > 10 ** (thresh / 20)]
        voiced = [f for f, c in est if c > 0.8]
        if voiced:
            med = float(np.median(voiced))
            cents = 1200 * np.log2(np.array(voiced) / med)
            steady = np.mean(np.abs(cents) < 100)
            midi = 69 + 12 * np.log2(med / 440)
            names = "C C# D D# E F F# G G# A A# B".split()
            note = f"{names[int(round(midi)) % 12]}{int(round(midi)) // 12 - 1}"
            pitch = (f"f0 {med:7.1f} Hz ({note})  range {np.min(voiced):.0f}-{np.max(voiced):.0f}  "
                     f"within 1 semitone {steady:.0%}  pitched frames {len(voiced)}/{len(est)}")
        else:
            pitch = f"unpitched ({len(est)} frames)"
        print(f"{n:2d}  {a:5.2f}-{b:5.2f}s  dur {b-a:4.2f}s  peak {20*np.log10(np.abs(seg).max()+1e-12):6.1f}"
              f"  rms {20*np.log10(np.sqrt(np.mean(seg**2))+1e-12):6.1f}  centroid {cen:6.0f} Hz  {pitch}")
