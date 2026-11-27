"""Frame-by-frame brightness checks on a rendered video or frame folders.

* flashes: a flash is a pair of opposing changes of relative luminance of at least 10 % of full
  white (WCAG 2.3.1), measured on the whole frame and on a 4 x 3 grid of regions.  The worst
  one-second window is reported; the limit here is 3.
* flicker: single-frame pops and rapid back-and-forth brightness that is not a cut or a
  scripted lightning strike.

  python source/tools/check_video.py <video.mp4 | render_dir> [--film] [--json out.json]
"""
import argparse
import glob
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "film"))

W, H = 160, 90


def frames_from_video(path):
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-vf", "scale=%d:%d:flags=area" % (W, H), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    out = []
    while True:
        buf = p.stdout.read(W * H * 3)
        if len(buf) < W * H * 3:
            break
        out.append(np.frombuffer(buf, np.uint8).reshape(H, W, 3))
    p.wait()
    return np.array(out)


def frames_from_dirs(root):
    from PIL import Image
    files = []
    for d in sorted(glob.glob(os.path.join(root, "S*"))):
        files += sorted(glob.glob(os.path.join(d, "*.png")))
    return np.array([np.asarray(Image.open(f).convert("RGB").resize((W, H), Image.BOX)) for f in files])


def rel_lum(f):
    c = f.astype(np.float32) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]


def count_flashes(series, fps, thresh=0.10):
    """Returns the frame index of every completed flash (a rise and a fall, each >= thresh)."""
    flashes = []
    extreme = series[0]
    direction = 0
    pending = None
    for i in range(1, len(series)):
        x = series[i]
        d = x - extreme
        if direction >= 0 and d <= -thresh and min(x, extreme) < 0.8:
            if pending == 1:
                flashes.append(i)
                pending = None
            else:
                pending = -1
            direction, extreme = -1, x
        elif direction <= 0 and d >= thresh and min(x, extreme) < 0.8:
            if pending == -1:
                flashes.append(i)
                pending = None
            else:
                pending = 1
            direction, extreme = 1, x
        elif (direction > 0 and x > extreme) or (direction < 0 and x < extreme) or direction == 0 and abs(d) > thresh:
            extreme = x
    return flashes


def worst_window(idx, fps):
    best, where = 0, 0
    for i in idx:
        n = sum(1 for j in idx if i <= j < i + fps)
        if n > best:
            best, where = n, i
    return best, where


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--fps", type=int, default=24)
    ap.add_argument("--film", action="store_true", help="use film 1's cut and lightning times to excuse intended changes")
    ap.add_argument("--cuts", default="", help="comma separated frame numbers of cuts")
    ap.add_argument("--excuse", default="", help="comma separated start-end frame ranges of intended flashes")
    ap.add_argument("--json", default="")
    a = ap.parse_args()
    frames = frames_from_video(a.path) if os.path.isfile(a.path) else frames_from_dirs(a.path)
    if len(frames) == 0:
        print("no frames")
        sys.exit(1)
    L = rel_lum(frames)
    mean = L.reshape(len(L), -1).mean(axis=1)
    cuts, excuse = set(), []
    if a.film:
        import filmdata
        from_actors = {8: [1.30, 3.95], 9: [2.10, 4.60], 10: [1.05, 3.40]}
        f0 = 0
        for s in filmdata.SHOTS:
            cuts.add(f0)
            for t in from_actors.get(s.id, []):
                excuse.append((f0 + int(t * a.fps) - 1, f0 + int((t + 0.85) * a.fps)))
            f0 += s.frames
    cuts |= {int(c) for c in a.cuts.split(",") if c}
    excuse += [tuple(int(v) for v in r.split("-")) for r in a.excuse.split(",") if r]

    # flashes over the whole frame and per region
    results = []
    regions = {"frame": mean}
    for r in range(3):
        for c in range(4):
            regions["r%d%d" % (r, c)] = L[:, r * H // 3:(r + 1) * H // 3, c * W // 4:(c + 1) * W // 4].reshape(len(L), -1).mean(axis=1)
    worst = (0, 0, "frame")
    for name, series in regions.items():
        # a cut is not a flash: count within each shot
        marks = sorted(cuts | {0, len(series)})
        idx = []
        for s0, s1 in zip(marks[:-1], marks[1:]):
            if s1 - s0 > 2:
                idx += [s0 + i for i in count_flashes(series[s0:s1], a.fps)]
        n, at = worst_window(idx, a.fps)
        if n > worst[0]:
            worst = (n, at, name)
        if name == "frame":
            results = idx

    # flicker: a frame that differs from both neighbours in the same direction
    pops = []
    for i in range(1, len(mean) - 1):
        if i in cuts or i + 1 in cuts or any(s - 1 <= i <= e + 1 for s, e in excuse):
            continue
        d0, d1 = mean[i] - mean[i - 1], mean[i] - mean[i + 1]
        ref = max(mean[i - 1], mean[i + 1], 0.02)
        if d0 * d1 > 0 and min(abs(d0), abs(d1)) > max(0.006, 0.07 * ref):
            pops.append((i, round(float(d0), 4)))
    jumps = []
    for i in range(1, len(mean)):
        if i in cuts or any(s - 1 <= i <= e + 1 for s, e in excuse):
            continue
        d = mean[i] - mean[i - 1]
        if abs(d) > max(0.015, 0.18 * max(mean[i - 1], 0.03)):
            jumps.append((i, round(float(d), 4)))
    # local flicker: share of pixels that jump and jump back, per frame
    local = []
    for i in range(1, len(L) - 1):
        if i in cuts or i + 1 in cuts or any(s - 1 <= i <= e + 1 for s, e in excuse):
            continue
        d0, d1 = L[i] - L[i - 1], L[i] - L[i + 1]
        frac = float(np.mean((d0 * d1 > 0) & (np.minimum(np.abs(d0), np.abs(d1)) > 0.12)))
        local.append((frac, i))
    local.sort(reverse=True)
    report = dict(frames=int(len(frames)), seconds=round(len(frames) / a.fps, 2), whole_frame_flashes=len(results),
                  worst_flashes_in_one_second=int(worst[0]), worst_window_frame=int(worst[1]), worst_region=worst[2],
                  flash_limit_ok=bool(worst[0] <= 3), single_frame_pops=pops, unexplained_jumps=jumps,
                  worst_local_flicker=[(i, round(f * 100, 2)) for f, i in local[:5]])
    print(json.dumps(report, indent=1))
    if a.json:
        with open(a.json, "w") as f:
            json.dump(report, f, indent=1)


if __name__ == "__main__":
    main()
