"""Renders the same low-sun windows again (consecutive frames, film settings), encodes them with the film's x264
settings, and scores them with shimmer.py beside the old film.  Needs the dev-loop editor.

  python source/tools/shimmer_after.py build/before/film1_v1.mp4 --json build/shimmer/compare.json
"""
import argparse
import glob
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "source"))
sys.path.insert(0, os.path.join(ROOT, "source", "film"))
sys.path.insert(0, os.path.join(ROOT, "source", "tools"))
from render_client import render  # noqa: E402
import filmdata  # noqa: E402
import shimmer  # noqa: E402

COUNT = 12
# name, film frame where the window starts, region (None = whole frame)
WINDOWS = [("S02", 200, None), ("S03", 324, None), ("S04", 408, None), ("S05", 540, None), ("S14", 1800, None),
           ("S15", 1990, None), ("S14_sloped_tower", 1800, (768, 0, 1344, 1440)), ("S14_ribbon_block", 1800, (0, 192, 672, 1152))]


def shot_at(frame):
    start = 0
    for s in filmdata.SHOTS:
        if frame < start + s.frames:
            return s, frame - start
        start += s.frames
    raise ValueError(frame)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("before")
    ap.add_argument("--json", default="build/shimmer/compare.json")
    ap.add_argument("--keep", action="store_true")
    a = ap.parse_args()
    work = os.path.join(ROOT, "build", "shimmer", "after")
    os.makedirs(work, exist_ok=True)
    clips, results = {}, {}
    for name, start, region in WINDOWS:
        shot, local = shot_at(start)
        key = "S%02d_%d" % (shot.id, local)
        if key not in clips:
            frames = os.path.join(work, key)
            shutil.rmtree(frames, ignore_errors=True)
            os.makedirs(frames)
            res = render([dict(seq="/Game/NYC/Sequences/Film/S%02d_%s" % (shot.id, shot.name), out=frames, name=key,
                               start=local, end=local + COUNT)], res=(3840, 2160), tsamples=8, ssamples=1, warmup=64,
                         engine_warmup=32, cvars={"r.VolumetricFog.GridPixelSize": 4.0, "r.Lumen.ScreenProbeGather.DownsampleFactor": 8.0},
                         timeout=3600, quiet=True)
            got = sorted(glob.glob(os.path.join(frames, "*.png")))
            if not res["success"] or len(got) < COUNT:
                raise RuntimeError("render of %s gave %d frames" % (key, len(got)))
            for i, f in enumerate(got[:COUNT]):
                os.replace(f, os.path.join(frames, "f_%03d.png" % i))
            clip = os.path.join(work, key + ".mp4")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "24", "-i", os.path.join(frames, "f_%03d.png"),
                            "-vf", "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p", "-c:v", "libx264",
                            "-preset", "slow", "-crf", "16", "-frames:v", str(COUNT), clip], check=True)
            if not a.keep:
                for f in glob.glob(os.path.join(frames, "*.png"))[2:]:
                    os.remove(f)
            clips[key] = clip
        heat = os.path.join(ROOT, "build", "shimmer", "after_%s.png" % name)
        row = {"before": shimmer.measure(a.before, start, COUNT, region),
               "after": shimmer.measure(clips[key], 0, COUNT, region, heat if region is None else None)}
        results[name] = row
        print(name, json.dumps(row), flush=True)
    with open(os.path.join(ROOT, a.json), "w") as f:
        json.dump(results, f, indent=1)


if __name__ == "__main__":
    main()
