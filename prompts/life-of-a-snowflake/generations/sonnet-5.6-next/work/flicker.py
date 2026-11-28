"""Frame-to-frame change across the finished video: looks for pops, flicker and dead stretches."""
import subprocess, sys
import numpy as np

src = sys.argv[1] if len(sys.argv) > 1 else '../snowflake.mp4'
W = 270
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-vf', f'scale={W}:{W}:flags=area', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
                     capture_output=True, check=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, W, W).astype(np.float32)
n = len(f)
d = np.array([np.abs(f[i] - f[i - 1]).mean() for i in range(1, n)])
lum = f.mean(axis=(1, 2))
# a pop is a change much larger than its neighbourhood
pops = []
for i in range(len(d)):
    lo, hi = max(0, i - 6), min(len(d), i + 7)
    ref = np.median(np.delete(d[lo:hi], i - lo))
    if d[i] > 1.6 * ref + 0.8:
        pops.append((i + 1, round((i + 1) / 30, 2), round(float(d[i]), 2), round(float(ref), 2)))
# flicker: frame differs from both neighbours while the neighbours agree
flick = []
for i in range(1, n - 1):
    a = np.abs(f[i] - f[i - 1]).mean(); b = np.abs(f[i] - f[i + 1]).mean(); c = np.abs(f[i + 1] - f[i - 1]).mean()
    if min(a, b) > 1.2 and c < 0.6 * min(a, b):
        flick.append((i, round(i / 30, 2), round(float(a), 2), round(float(c), 2)))
dl = np.abs(np.diff(lum))
print('frames', n)
print('motion per frame: min %.2f median %.2f max %.2f' % (d.min(), np.median(d), d.max()))
print('quietest frame at t=%.2fs' % ((d.argmin() + 1) / 30))
print('largest mean-brightness step %.2f at t=%.2fs' % (dl.max(), (dl.argmax() + 1) / 30))
print('pops:', pops[:30])
print('single-frame flicker:', flick[:30])
try:
    from PIL import Image, ImageDraw
    H = 220
    im = Image.new('RGB', (1200, H), (16, 18, 24)); g = ImageDraw.Draw(im)
    top = max(8.0, float(np.percentile(d, 99.5)))
    pts = [(i * 1200 / len(d), H - 12 - min(d[i], top) / top * (H - 30)) for i in range(len(d))]
    g.line(pts, fill=(120, 190, 255), width=1)
    for s in range(0, 21):
        x = s * 30 * 1200 / len(d); g.line([(x, H - 12), (x, H - 8)], fill=(150, 150, 150)); g.text((x + 1, H - 11), str(s), fill=(150, 150, 150))
    g.text((4, 4), 'mean |frame difference| (full scale %.1f)' % top, fill=(220, 220, 220))
    im.save('motion.png')
except Exception as e:
    print(e)
