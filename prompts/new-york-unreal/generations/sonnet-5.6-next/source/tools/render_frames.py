"""Final-quality test frames from a destruction shot's cache (random access in playback):
  python source/tools/render_frames.py <shot name> <first> <last> [--res 3840x2160] [--samples 8]"""
import argparse, os, sys
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, "film"))
from ue_send import ROOT
from render_client import render
import destruction_data
ap = argparse.ArgumentParser(); ap.add_argument("shot"); ap.add_argument("first", type=int); ap.add_argument("last", type=int)
ap.add_argument("--res", default="3840x2160"); ap.add_argument("--samples", type=int, default=8)
a = ap.parse_args()
index = [s.name for s in destruction_data.SHOTS].index(a.shot)
tag = "D%02d" % (index + 1)
out = os.path.join(ROOT, "renders", "frames", tag)
os.makedirs(out, exist_ok=True)
w, h = (int(v) for v in a.res.split("x"))
r = render([dict(seq="/Game/NYC/Sequences/Destruction/%s_%s" % (tag, a.shot), out=out, name=tag, start=a.first, end=a.last + 1)],
           res=(w, h), tsamples=a.samples, ssamples=1, warmup=48, engine_warmup=32, cvars={"nyc.FilmCache": 2, "r.VolumetricFog.GridPixelSize": 4}, timeout=3600, quiet=True)
print(r, sorted(os.listdir(out))[-3:])
