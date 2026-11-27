"""Renders one frame of a sequence under several console-variable variants and tiles chosen crops, so that an
artifact can be pinned on one feature.  Needs the dev-loop editor.

  python source/tools/probe.py spec.json
spec: {"seq": path, "frame": n, "res": [w,h], "samples": 4, "crops": [[x0,y0,x1,y1], ...],
       "variants": [{"name": "...", "cvars": {...}}], "out": "sheet.png", "scale": 1.0}
"""
import json
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)
from ue_send import ROOT  # noqa: E402
from render_client import render  # noqa: E402


def main():
    spec = json.load(open(sys.argv[1]))
    rows = []
    base_cv = {"r.VolumetricFog.GridPixelSize": 4, "r.Lumen.ScreenProbeGather.DownsampleFactor": 8, "nyc.FilmCache": 0}
    for i, v in enumerate(spec["variants"]):
        folder = os.path.join(ROOT, "build", "probe", "v%02d" % i)
        os.makedirs(folder, exist_ok=True)
        for f in os.listdir(folder):
            os.remove(os.path.join(folder, f))
        cv = dict(base_cv)
        cv.update(v.get("cvars", {}))
        render([dict(seq=spec["seq"], out=folder, name="p", start=spec["frame"], end=spec["frame"] + v.get("count", 1))], res=tuple(spec.get("res", (3840, 2160))),
               tsamples=v.get("samples", spec.get("samples", 4)), ssamples=1, warmup=48, engine_warmup=32, cvars=cv, timeout=1200, quiet=True)
        got = sorted(os.listdir(folder))
        im = Image.open(os.path.join(folder, got[-1])).convert("RGB")
        im.save(os.path.join(ROOT, "build", "probe", "full_%02d.png" % i))
        crops = [im.crop(tuple(c)) for c in spec["crops"]]
        w = sum(c.width for c in crops) + 8 * (len(crops) - 1)
        h = max(c.height for c in crops)
        row = Image.new("RGB", (w, h), (255, 0, 255))
        x = 0
        for c in crops:
            row.paste(c, (x, 0))
            x += c.width + 8
        s = spec.get("scale", 1.0)
        if s != 1.0:
            row = row.resize((int(row.width * s), int(row.height * s)), Image.LANCZOS)
        d = ImageDraw.Draw(row)
        d.rectangle([0, 0, 360, 18], fill=(0, 0, 0))
        d.text((5, 4), v["name"], fill=(255, 255, 0))
        rows.append(row)
        print("done", v["name"], flush=True)
    cols = spec.get("cols", 2)
    rw, rh = rows[0].size
    sheet = Image.new("RGB", (cols * rw + 10 * (cols - 1), ((len(rows) + cols - 1) // cols) * (rh + 10)), (0, 255, 0))
    for k, r in enumerate(rows):
        sheet.paste(r, ((k % cols) * (rw + 10), (k // cols) * (rh + 10)))
    sheet.save(os.path.join(ROOT, spec["out"]))
    print("sheet", spec["out"], sheet.size)


if __name__ == "__main__":
    main()
