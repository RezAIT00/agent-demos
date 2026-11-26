# frame-difference + block-motion metrics from a low-res mp4/raw dump: python tools/metrics.py file.mp4
import subprocess, sys, numpy as np
f = sys.argv[1]; W, H = 320, 180
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f, '-vf', f'scale={W}:{H}:flags=area', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
a = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32); n = len(a); print('frames', n)
d = np.abs(np.diff(a, axis=0)).mean(axis=(1, 2)); m = a.mean(axis=(1, 2))
# second difference: spikes = pops
dd = np.abs(d[1:] - d[:-1])
print('mean luma per 0.5s:', [round(float(x), 1) for x in m[::30]])
print('mean |diff| per 0.5s:', [round(float(d[i:i + 30].mean()), 2) for i in range(0, n - 1, 30)])
k = np.argsort(-dd)[:14]; print('largest diff jumps (t, jump, diff):', sorted([(round((int(i) + 1) / 60, 3), round(float(dd[i]), 2), round(float(d[i + 1]), 2)) for i in k]))
# full-frame flashes: luma change > 25 in <= 4 frames
fl = [(round(i / 60, 2), round(float(m[i + 4] - m[i]), 1)) for i in range(n - 4) if abs(m[i + 4] - m[i]) > 25]; print('fast luma swings:', fl[:20])
# phase-correlation global motion (px/frame at 320w)
def pc(x, y):
    w = np.hanning(H)[:, None] * np.hanning(W)[None]; X = np.fft.rfft2((x - x.mean()) * w); Y = np.fft.rfft2((y - y.mean()) * w); c = X * np.conj(Y); c /= np.abs(c) + 1e-3; r = np.fft.irfft2(c, (H, W)); i = np.unravel_index(np.argmax(r), r.shape); return ((i[0] + H // 2) % H - H // 2, (i[1] + W // 2) % W - W // 2)
mv = [pc(a[i + 1], a[i]) for i in range(0, n - 1, 6)]; print('global shift samples px/frame (every 0.1s):', mv)
