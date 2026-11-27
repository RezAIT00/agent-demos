"""Renders the destruction film through Movie Render Queue in two passes.

  record   a quick pass in which the physics runs and is recorded into each shot's Chaos cache
  play     the final pass, in which nothing is simulated: every piece is read back from the caches

  venv\\Scripts\\python.exe source\\render_destruction.py record [--shots a,b] [--build]
  venv\\Scripts\\python.exe source\\render_destruction.py play --out renders/destruction --res 3840x2160 --samples 8
Frames land in <out>/Dnn/Dnn.####.png.  The dev-loop editor must be running (source\\editor.ps1).
"""
import argparse
import importlib
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "film"))
from ue_send import ROOT, send  # noqa: E402
from render_client import render  # noqa: E402
import destruction_data  # noqa: E402


def ue(call, timeout=1800, quiet=False):
    code = ("import sys, importlib\nsys.path.insert(0, r'%s')\nimport destruction_film as _d\nimportlib.reload(_d)\n_d.reload()\n_d.%s\n"
            % (os.path.join(ROOT, "source", "ue"), call))
    ok, out = send(code, timeout, quiet=True)
    if not quiet or not ok:
        print(out.rstrip())
    if not ok:
        sys.exit(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["record", "play", "live"])
    ap.add_argument("--out", default="")
    ap.add_argument("--res", default="")
    ap.add_argument("--samples", type=int, default=0)
    ap.add_argument("--warmup", type=int, default=48)
    ap.add_argument("--shots", default="")
    ap.add_argument("--build", action="store_true")
    ap.add_argument("--cvar", action="append", default=[])
    a = ap.parse_args()
    wanted = [x for x in a.shots.split(",") if x] or [s.name for s in destruction_data.SHOTS]
    out_root = a.out or {"record": "renders/d_record", "play": "renders/destruction", "live": "renders/d_live"}[a.mode]
    w, h = (int(v) for v in (a.res or ("3840x2160" if a.mode == "play" else "960x540")).split("x"))
    samples = a.samples or (8 if a.mode == "play" else 1)
    cache = {"record": 1, "play": 2, "live": 0}[a.mode]
    if a.build:
        ue("build(%r)" % wanted)
    cvars = {"nyc.FilmCache": cache}
    cvars.update({kv.split("=")[0]: float(kv.split("=")[1]) for kv in a.cvar})
    total = 0.0
    for index, s in enumerate(destruction_data.SHOTS):
        if s.name not in wanted:
            continue
        tag = "D%02d" % (index + 1)
        out_dir = os.path.join(ROOT, out_root, tag)
        os.makedirs(out_dir, exist_ok=True)
        for f in os.listdir(out_dir):
            if f.endswith(".png"):
                os.remove(os.path.join(out_dir, f))
        if a.mode == "record":
            ue("fresh_caches([%r])" % s.name, quiet=True)
        seq = "/Game/NYC/Sequences/Destruction/%s_%s" % (tag, s.name)
        t0 = time.time()
        res = render([dict(seq=seq, out=out_dir, name=tag)], res=(w, h), tsamples=samples, ssamples=1,
                     warmup=a.warmup, engine_warmup=32, cvars=cvars, timeout=7200, quiet=True)
        if a.mode == "record":
            ue("save_caches([%r])" % s.name, quiet=True)
        n = len([f for f in os.listdir(out_dir) if f.endswith(".png")])
        dt = time.time() - t0
        total += dt
        print("%s %-22s %s  %d/%d frames  %.0f s  (%.2f s/frame)" % (tag, s.name, "ok" if res["success"] else "FAILED", n, s.frames, dt, dt / max(n, 1)),
              flush=True)
    print("total %.0f s" % total)


if __name__ == "__main__":
    main()
