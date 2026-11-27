"""Render film shots through Movie Render Queue.

  python source/render_film.py --out renders/animatic --res 960x540 --samples 1 [--shots 1,2,7] [--build]
Frames land in <out>/Sxx/Sxx.####.png
"""
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "film"))
from ue_send import ROOT, send
from render_client import render
import filmdata


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="renders/animatic")
    ap.add_argument("--res", default="960x540")
    ap.add_argument("--samples", type=int, default=1)
    ap.add_argument("--spatial", type=int, default=1)
    ap.add_argument("--warmup", type=int, default=48)
    ap.add_argument("--shots", default="")
    ap.add_argument("--build", action="store_true", help="rebuild the sequences first")
    ap.add_argument("--aa", default="tsr")
    ap.add_argument("--cvar", action="append", default=[])
    ap.add_argument("--skip-done", action="store_true")
    a = ap.parse_args()
    wanted = [int(x) for x in a.shots.split(",") if x] or [s.id for s in filmdata.SHOTS]
    if a.build:
        code = ("import sys, importlib\nsys.path.insert(0, r'%s')\nimport film; importlib.reload(film)\nfilm.build(%r)\n"
                % (os.path.join(ROOT, "source", "ue"), wanted))
        ok, out = send(code, 900, quiet=True)
        if not ok:
            print(out)
            sys.exit(1)
    w, h = (int(v) for v in a.res.split("x"))
    cvars = {kv.split("=")[0]: float(kv.split("=")[1]) for kv in a.cvar}
    total = 0.0
    for s in filmdata.SHOTS:
        if s.id not in wanted:
            continue
        out_dir = os.path.join(ROOT, a.out, "S%02d" % s.id)
        os.makedirs(out_dir, exist_ok=True)
        have = [f for f in os.listdir(out_dir) if f.endswith(".png")]
        if a.skip_done and len(have) >= s.frames:
            continue
        for f in have:
            os.remove(os.path.join(out_dir, f))
        seq = "/Game/NYC/Sequences/Film/S%02d_%s" % (s.id, s.name)
        t0 = time.time()
        res = render([dict(seq=seq, out=out_dir, name="S%02d" % s.id)], res=(w, h), tsamples=a.samples, ssamples=a.spatial,
                     warmup=a.warmup, engine_warmup=32, aa=a.aa, cvars=cvars, timeout=7200, quiet=True)
        n = len([f for f in os.listdir(out_dir) if f.endswith(".png")])
        dt = time.time() - t0
        total += dt
        print("S%02d %-24s %s  %d/%d frames  %.0f s  (%.2f s/frame)" % (s.id, s.name, "ok" if res["success"] else "FAILED", n, s.frames, dt, dt / max(n, 1)), flush=True)
    print("total %.0f s" % total)


if __name__ == "__main__":
    main()
