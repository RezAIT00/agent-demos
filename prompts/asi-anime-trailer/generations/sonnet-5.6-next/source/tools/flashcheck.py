"""Photosensitivity check, after WCAG 2.3.1 (general and red flashes).
   python tools/flashcheck.py film.mp4 [--timeline out/timeline.json]

A transition is a swing of at least 0.10 in relative luminance against the
last turning point, where the darker side is below 0.80. A flash is a pair of
opposing transitions. Two measures per sliding one second window:
  A. whole frame mean luminance
  B. 16 x 9 blocks: the flash count reached by at least 25 % of the picture
     (stricter than WCAG's area rule for a full screen video)
Both must stay at or below 3. Impact frames are included: they are measured
from the encoded file, not declared.
"""
import json, subprocess, sys
import numpy as np

path = sys.argv[1]
W, H, FPS = 160, 90, 24
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={W}:{H}:flags=area:in_color_matrix=bt709,format=rgb24',
                      '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
v = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32) / 255.0
lin = np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)
Y = lin @ np.array([0.2126, 0.7152, 0.0722], np.float32)
n = len(Y)


def transitions(series):
    """frame indices where the signal has swung >= 0.1 from its last extremum"""
    out, ext, direction = [], series[0], 0
    for i in range(1, len(series)):
        x = series[i]
        if direction >= 0 and x > ext:
            ext = x if direction == 1 else ext
        if direction <= 0 and x < ext:
            ext = x if direction == -1 else ext
        if direction != 1 and x - ext >= 0.1 and min(x, ext) < 0.8:
            out.append((i, 1)); direction, ext = 1, x
        elif direction != -1 and ext - x >= 0.1 and min(x, ext) < 0.8:
            out.append((i, -1)); direction, ext = -1, x
        elif direction == 0:
            if abs(x - ext) >= 0.1:
                ext = x
    return out


def worst_window(trs):
    counts = np.zeros(n, np.int32)
    idx = np.array([t[0] for t in trs], np.int64)
    for s in range(0, n - FPS + 1):
        k = np.searchsorted(idx, s + FPS) - np.searchsorted(idx, s)
        counts[s] = k // 2
    return counts


glob = Y.reshape(n, -1).mean(axis=1)
gt = transitions(glob)
gc = worst_window(gt)
BX, BY = 16, 9
blocks = Y.reshape(n, BY, H // BY, BX, W // BX).mean(axis=(2, 4)).reshape(n, -1)
bc = np.stack([worst_window(transitions(blocks[:, j])) for j in range(blocks.shape[1])], axis=1)
need = int(np.ceil(blocks.shape[1] * 0.25))
area = np.sort(bc, axis=1)[:, -need]

print(f'frames analysed: {n}')
print(f'whole frame: {len(gt)} luminance transitions in the film; worst 1 s window = {gc.max()} flashes (at {gc.argmax() / FPS:.2f} s)')
print(f'blocks (>=25% of picture): worst 1 s window = {area.max()} flashes (at {area.argmax() / FPS:.2f} s)')
busy = [(s / FPS, int(area[s])) for s in range(n) if area[s] >= 2]
if busy:
    spans, a = [], busy[0]
    prev = a
    for b in busy[1:]:
        if b[0] - prev[0] > 0.1:
            spans.append((a[0], prev[0])); a = b
        prev = b
    spans.append((a[0], prev[0]))
    print('windows with 2 or more flashes start in:', ', '.join(f'{x:.2f}-{y:.2f}s' for x, y in spans))
# saturated red: R / (R+G+B) >= 0.8
rs = lin.reshape(n, -1, 3)
red = ((rs[..., 0] / (rs.sum(axis=2) + 1e-6)) >= 0.8) & (rs[..., 0] > 0.05)
print(f'saturated red: largest share of any frame = {100 * red.mean(axis=1).max():.2f} %')
ok = gc.max() <= 3 and area.max() <= 3
print('FLASH CHECK:', 'PASS (<= 3 per second)' if ok else 'FAIL')
sys.exit(0 if ok else 1)
