"""Find, in the delivered picture itself, the first frame that shows each light event.
    python audio/measure_picture.py      ->  audio/picture-events.json
The camera moves, so each lamp (or its mirror image) is re-projected into every frame."""
import json, subprocess, pathlib
import numpy as np

A = pathlib.Path(__file__).resolve().parent
K = json.load(open(A / 'cues.json'))
W = 1080
TAN = np.tan(np.radians(31))
cam = np.array(K['camera'])
P = {k: np.array(v) for k, v in K['points'].items()}
n = P['mirrorNormal']
mirrored_bulb = P['bulb'] - 2 * np.dot(P['bulb'] - P['mirror'], n) * n
cafe = next(w for w in K['walls'] if w['name'] == 'cafe')
def wall_point(w, u, v, d):
    return np.array(w['o']) + np.array(w['U']) * u + np.array([0, v, 0]) + np.array(w['N']) * d
# points on the neon tubes: cup outline, saucer, steam
neon = [wall_point(cafe, 0.505, 3.36 + b, 0.58 + a) for a, b in
        [(-.23, .06), (-.215, -.08), (-.15, -.19), (-.03, -.225), (.07, -.19), (.135, -.08), (.15, .06), (-.04, .068), (-.13, .068), (-.18, -.29), (-.04, -.30), (.10, -.29), (.235, .035), (.265, -.03)]]

def project(p, t):
    i = int(round((t + 3.0) * 100)); row = cam[i]
    pos, tgt = row[1:4], row[4:7]
    f = (tgt - pos) / np.linalg.norm(tgt - pos)
    r = np.cross(f, [0, 1, 0]); r /= np.linalg.norm(r)
    u = np.cross(r, f)
    v = p - pos; z = v @ f
    return ((v @ r) / (z * TAN) * .5 + .5) * W, (.5 - (v @ u) / (z * TAN) * .5) * W

def patch(img, p, t, half):
    x, y = project(p, t); x, y = int(round(x)), int(round(y))
    return img[max(0, y - half):y + half + 1, max(0, x - half):x + half + 1].astype(np.float32)

proc = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', str(A.parent / 'slow-light.mp4'), '-vf', 'scale=in_color_matrix=bt709:in_range=tv:out_range=full,format=rgb24', '-f', 'rawvideo', '-'], stdout=subprocess.PIPE)
series = {k: [] for k in ['bulb', 'mirror', 'lantern', 'neon']}
f = 0
while True:
    buf = proc.stdout.read(W * W * 3)
    if len(buf) < W * W * 3: break
    img = np.frombuffer(buf, np.uint8).reshape(W, W, 3)
    t = f / 30
    series['bulb'].append(float(patch(img, P['bulb'], t, 3).mean()))
    series['mirror'].append(float(patch(img, mirrored_bulb, t, 2).mean()))
    series['lantern'].append(float(patch(img, P['lantern'], t, 2).mean()))
    series['neon'].append(float(np.mean([patch(img, q, t, 2).max(axis=(0, 1)).mean() for q in neon])))
    f += 1
proc.wait()
assert f == 600, f

def before_lit(s, around):
    return np.median(s[around - 10:around - 2])

def first(sig, around, rising, frac):
    s = np.array(sig)
    before = np.median(s[around - 12:around - 2])
    after = np.median(s[around + 1:around + 3]) if rising else np.median(s[around + 3:around + 9])
    thr = before + frac * (after - before) if rising else None
    for i in range(around - 6, around + 8):
        if (rising and s[i] > thr) or (not rising and s[i] < before_lit(s, around) - frac * (before_lit(s, around) - after)):
            return i, round(float(before), 1), round(float(after), 1)
    raise SystemExit(f'no edge near frame {around}')

# search windows come from the physics (t = switch time + path / 5); the frame itself comes from the pixels
G = {'bulbOn': 60, 'mirrorOn': 135, 'lanternOn': 278, 'neonFirst': 327, 'bulbOff': 420, 'neonOff': 441, 'lanternOff': 459, 'mirrorOff': 498}
# an event's frame is the first one that shows at least a quarter of the change
src = {'bulbOn': ('bulb', True, .25), 'mirrorOn': ('mirror', True, .25), 'lanternOn': ('lantern', True, .25), 'neonFirst': ('neon', True, .25),
       'bulbOff': ('bulb', False, .25), 'neonOff': ('neon', False, .25), 'lanternOff': ('lantern', False, .25), 'mirrorOff': ('mirror', False, .25)}
events, detail = {}, {}
for name, (key, rising, frac) in src.items():
    i, lo, hi = first(series[key], G[name], rising, frac)
    events[name] = i
    detail[name] = {'frame': i, 'time_s': round(i / 30, 4), 'luma_before': lo, 'luma_after': hi, 'luma_prev_frame': round(series[key][i - 1], 1), 'luma_this_frame': round(series[key][i], 1)}
    print(f"{name:11s} frame {i:3d}  ({i/30:7.3f} s)   patch luma  prev {series[key][i-1]:6.1f} -> this {series[key][i]:6.1f}   (before {lo}, after {hi})")
# the neon stutter as the picture shows it
s = np.array(series['neon']); on = events['neonFirst']
print('neon patch luma, frames %d..%d:' % (on - 1, on + 20), ' '.join('%d' % v for v in s[on - 1:on + 21]))
json.dump({'events': events, 'detail': detail, 'series': {k: [round(v, 2) for v in vals] for k, vals in series.items()}}, open(A / 'picture-events.json', 'w'))
