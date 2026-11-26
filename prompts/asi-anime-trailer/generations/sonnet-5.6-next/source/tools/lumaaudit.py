"""Luma audit: find brightness pops that no edit asked for.
   python tools/lumaaudit.py film.mp4 out/timeline.json [--plot out/luma.png]

Per frame mean of the 8 bit luma plane. A step larger than STEP levels is
"explained" only if it falls on a listed cut, an impact frame or a declared
flash. Also looks for one-frame spikes (a frame unlike both neighbours while
the neighbours agree), which is what a rendering glitch looks like.
"""
import json, subprocess, sys
import numpy as np

path, tl_path = sys.argv[1], sys.argv[2]
tl = json.load(open(tl_path))
FPS = tl['fps']
W, H = 192, 108
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={W}:{H}:flags=area', '-pix_fmt', 'gray', '-f', 'rawvideo', '-'],
                     capture_output=True, check=True).stdout
v = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
Y = v.mean(axis=(1, 2))
n = len(Y)
STEP, SPIKE = 5.0, 2.5

intended = {}
for c in tl['cuts']:
    intended[int(np.ceil(c * FPS - 1e-6))] = 'cut'      # first frame of the new shot
for m in tl['impacts']:
    f0 = round(m['t'] * FPS)
    for k in range(f0, f0 + m['n'] + 1):
        intended[k] = 'impact frame'
for f in tl['flashes']:
    for k in range(int((f['t'] - f['up']) * FPS) - 1, int((f['t'] + f['down']) * FPS) + 2):
        intended[k] = 'declared flash'

ramp_notes, ramp_bad = [], []
for t0, t1, why in tl.get('ramps', []):
    i0, i1 = int(round(t0 * FPS)), min(n - 1, int(np.ceil(t1 * FPS)))
    seg = np.diff(Y[i0:i1 + 1])
    if len(seg) == 0:
        continue
    direction = 1 if Y[i1] >= Y[i0] else -1
    backwards = float(np.max(np.clip(-direction * seg, 0, None)))
    biggest = float(np.max(np.abs(seg)))
    smooth = backwards <= 1.5 and biggest <= 20
    ramp_notes.append(f'   {t0:6.2f}-{t1:6.2f}s {why:34s} {Y[i0]:6.1f} -> {Y[i1]:6.1f}  largest step {biggest:4.1f}  against the ramp {backwards:3.1f}  {"smooth" if smooth else "NOT SMOOTH"}')
    if not smooth:
        ramp_bad.append(why)
    else:
        for k in range(i0 + 1, i1 + 1):
            intended.setdefault(k, 'declared ramp')

d = np.diff(Y)
steps = [(i + 1, d[i]) for i in range(n - 1) if abs(d[i]) > STEP]
unexplained = [(i, x) for i, x in steps if i not in intended]
spikes = []
for i in range(1, n - 1):
    a, b, c = Y[i - 1], Y[i], Y[i + 1]
    if abs(b - (a + c) / 2) > SPIKE and abs(a - c) < 1.5 and i not in intended and (i + 1) not in intended:
        spikes.append((i, b - (a + c) / 2))

print('declared ramps (must be monotonic):')
print('\n'.join(ramp_notes))
print(f'frames: {n}   mean luma: {Y.mean():.1f}   range: {Y.min():.1f} .. {Y.max():.1f}')
print(f'steps over {STEP} levels: {len(steps)}, of which on intended edits: {len(steps) - len(unexplained)}, unexplained: {len(unexplained)}')
for i, x in unexplained:
    print(f'   frame {i}  t={i / FPS:.3f}s  {x:+.1f}')
print(f'one-frame spikes over {SPIKE} levels (not on an edit): {len(spikes)}')
for i, x in spikes:
    print(f'   frame {i}  t={i / FPS:.3f}s  {x:+.1f}')
quiet = [abs(d[i]) for i in range(n - 1) if (i + 1) not in intended]
print(f'frame to frame change away from edits: median {np.median(quiet):.2f}, 99th percentile {np.percentile(quiet, 99):.2f}, max {np.max(quiet):.2f} levels')

if '--plot' in sys.argv:
    from PIL import Image, ImageDraw
    pw, ph = 1750, 300
    im = Image.new('RGB', (pw, ph), (12, 14, 30))
    dr = ImageDraw.Draw(im)
    for c in tl['cuts']:
        x = int(c / tl['duration'] * pw)
        dr.line([(x, 0), (x, ph)], fill=(60, 70, 130))
    pts = [(int(i / n * pw), int(ph - 6 - Y[i] / 255 * (ph - 12))) for i in range(n)]
    dr.line(pts, fill=(170, 235, 255))
    for i, _ in unexplained + spikes:
        x = int(i / n * pw)
        dr.ellipse([x - 4, pts[i][1] - 4, x + 4, pts[i][1] + 4], outline=(255, 90, 110))
    im.save(sys.argv[sys.argv.index('--plot') + 1])
print('LUMA AUDIT:', 'PASS' if not unexplained and not spikes and not ramp_bad else 'REVIEW')
