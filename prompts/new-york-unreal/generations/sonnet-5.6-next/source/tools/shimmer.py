"""Finds small high-frequency shimmer (aliasing, moire, sparkling highlights) that a whole-frame brightness
check cannot see.

For every frame t the frames before and after are lined up with it, tile by tile, by the shift that phase
correlation finds (so ordinary camera and object motion cancels), and what is left over,
  |I(t) - (aligned I(t-1) + aligned I(t+1)) / 2|,
is the part that flickers.  It is measured at full resolution on luma.  Reported per tile and as one score:
the mean residual of the worst 2 % of textured tiles, in 8-bit levels.  A heat map marks the worst places.

  python source/tools/shimmer.py video.mp4 --shot-frames START COUNT [--heat out.png] [--region x0,y0,x1,y1]
  python source/tools/shimmer.py --compare before.mp4 after.mp4 --windows name:start:count,... --json out.json
"""
import argparse
import json
import os
import subprocess

import numpy as np
from scipy import ndimage

TILE = 96
MAX_MOVE = 5.0


def probe_size(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                        "-of", "csv=p=0", path], capture_output=True, text=True)
    w, h = r.stdout.strip().split(",")[:2]
    return int(w), int(h)


def read_luma(path, start, count):
    w, h = probe_size(path)
    cmd = ["ffmpeg", "-v", "error", "-ss", "%.5f" % (start / 24.0), "-i", path, "-frames:v", str(count),
           "-f", "rawvideo", "-pix_fmt", "gray", "-"]
    raw = subprocess.run(cmd, capture_output=True).stdout
    n = len(raw) // (w * h)
    return np.frombuffer(raw[:n * w * h], np.uint8).reshape(n, h, w).astype(np.float32)


def shift_between(a, b, window):
    """The (dy, dx) that moves b onto a, to a fraction of a pixel."""
    A = np.fft.rfft2((a - a.mean()) * window)
    B = np.fft.rfft2((b - b.mean()) * window)
    R = A * np.conj(B)
    R /= np.abs(R) + 1e-3
    c = np.fft.irfft2(R, s=a.shape)
    k = int(np.argmax(c))
    py, px = divmod(k, a.shape[1])

    def refine(p, n, get):
        l, m, r = get((p - 1) % n), get(p), get((p + 1) % n)
        d = l - 2 * m + r
        off = 0.0 if abs(d) < 1e-9 else 0.5 * (l - r) / d
        v = p + float(np.clip(off, -0.5, 0.5))
        return v - n if v > n / 2 else v

    dy = refine(py, a.shape[0], lambda i: c[i, px])
    dx = refine(px, a.shape[1], lambda i: c[py, i])
    if abs(dy) > TILE / 4 or abs(dx) > TILE / 4:
        return 0.0, 0.0
    return dy, dx


def residual_tiles(frames, region=None):
    """Per tile: the shimmer residual averaged over time (8-bit levels), and a texture measure."""
    n, h, w = frames.shape
    x0, y0, x1, y1 = region if region else (0, 0, w, h)
    ys = range(y0, y1 - TILE + 1, TILE)
    xs = range(x0, x1 - TILE + 1, TILE)
    window = np.outer(np.hanning(TILE), np.hanning(TILE)).astype(np.float32)
    score = np.zeros((len(ys), len(xs)))
    texture = np.zeros_like(score)
    pad = 6
    for j, y in enumerate(ys):
        for i, x in enumerate(xs):
            acc = []
            for t in range(1, n - 1):
                cur = frames[t, y:y + TILE, x:x + TILE]
                side, moves = [], []
                for s in (t - 1, t + 1):
                    ya, yb, xa, xb = max(y - pad * 4, 0), min(y + TILE + pad * 4, h), max(x - pad * 4, 0), min(x + TILE + pad * 4, w)
                    dy, dx = shift_between(cur, frames[s, y:y + TILE, x:x + TILE], window)
                    moves.append((dy, dx))
                    big = ndimage.shift(frames[s, ya:yb, xa:xb], (dy, dx), order=3, mode="nearest")
                    side.append(big[y - ya:y - ya + TILE, x - xa:x - xa + TILE])
                # a tile with fast or uneven motion (a passing car) says nothing about shimmer: leave it out
                if max(abs(v) for m in moves for v in m) > MAX_MOVE or abs(moves[0][0] + moves[1][0]) + abs(moves[0][1] + moves[1][1]) > 1.5:
                    continue
                r = np.abs(cur - 0.5 * (side[0] + side[1]))[pad:-pad, pad:-pad]
                # shimmer is fine detail: drop the slowly varying part of what is left (lights fading, haze)
                r = np.abs(r - ndimage.uniform_filter(r, 15))
                acc.append(float(np.percentile(r, 90)))
            if len(acc) < max(2, (n - 2) // 2):
                score[j, i] = np.nan
                continue
            score[j, i] = float(np.mean(acc))
            mid = frames[n // 2, y:y + TILE, x:x + TILE]
            texture[j, i] = float(np.mean(np.abs(np.diff(mid, axis=1))) + np.mean(np.abs(np.diff(mid, axis=0))))
    return score, texture, list(xs), list(ys)


def summarise(score, texture):
    textured = score[(texture > 2.0) & np.isfinite(score)]
    if textured.size == 0:
        textured = score[np.isfinite(score)]
    top = np.sort(textured)[-max(1, int(textured.size * 0.02)):]
    return dict(worst2pct=round(float(top.mean()), 3), mean=round(float(textured.mean()), 3), tiles=int(textured.size))


def heat_image(frame, score, xs, ys, out, vmax=None):
    from PIL import Image
    base = np.stack([frame] * 3, axis=2) * 0.55
    vmax = vmax or max(float(np.nanpercentile(score, 99)), 1.0)
    for j, y in enumerate(ys):
        for i, x in enumerate(xs):
            a = np.clip((np.nan_to_num(score[j, i]) / vmax - 0.35) / 0.65, 0, 1)
            if a > 0:
                tile = base[y:y + TILE, x:x + TILE]
                tile[..., 0] = np.clip(tile[..., 0] + 255 * a, 0, 255)
    Image.fromarray(base.astype(np.uint8)).resize((1920, int(base.shape[0] * 1920 / base.shape[1]))).save(out)


def measure(path, start, count, region=None, heat=None):
    frames = read_luma(path, start, count)
    score, texture, xs, ys = residual_tiles(frames, region)
    if heat:
        heat_image(frames[len(frames) // 2], score, xs, ys, heat)
    return summarise(score, texture)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("videos", nargs="+")
    ap.add_argument("--compare", action="store_true")
    ap.add_argument("--windows", default="", help="name:startframe:count, comma separated")
    ap.add_argument("--region", default="")
    ap.add_argument("--heat", default="")
    ap.add_argument("--json", default="")
    a = ap.parse_args()
    region = tuple(int(v) for v in a.region.split(",")) if a.region else None
    windows = [(w.split(":")[0], int(w.split(":")[1]), int(w.split(":")[2])) for w in a.windows.split(",") if w]
    out = {}
    for name, start, count in windows:
        row = {}
        for k, v in enumerate(a.videos):
            label = ("before", "after")[k] if a.compare else os.path.splitext(os.path.basename(v))[0]
            heat = a.heat.replace(".png", "_%s_%s.png" % (name, label)) if a.heat else None
            row[label] = measure(v, start, count, region, heat)
        out[name] = row
        print(name, json.dumps(row), flush=True)
    if a.json:
        with open(a.json, "w") as f:
            json.dump(out, f, indent=1)


if __name__ == "__main__":
    main()
