"""Finds aerial viewpoints with the clearest view of a ground event: rays against every building box.
  python camera_search.py cx cy radius dist_min dist_max height_min height_max   (metres)"""
import json, math, os, sys
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
d = json.load(open(os.path.join(ROOT, "build", "city", "destruction.json")))
boxes = []
for b in d["buildings"]:
    x0, x1, y0, y1 = b["rect"]
    for t in (b.get("tiers") or []):
        if len(t) >= 6:
            boxes.append((t[0], t[1], t[2], t[3], t[4], t[5]))
    if not b.get("tiers"):
        boxes.append((x0, x1, y0, y1, 0.0, b["h"]))
B = np.array(boxes, float)          # x0 x1 y0 y1 z0 z1
lo = B[:, [0, 2, 4]]
hi = B[:, [1, 3, 5]]
cx, cy, R, d0, d1, h0, h1 = (float(v) for v in sys.argv[1:8])
targets = [(cx + math.cos(a) * r, cy + math.sin(a) * r, z) for r in (0.0, R * 0.5, R) for a in np.linspace(0, 2 * math.pi, 7)[:-1]
           for z in (8.0, R * 0.45, R * 0.9)]
T = np.array(targets)


def visible(cam):
    c = np.array(cam)
    seen = 0
    for t in T:
        v = t - c
        with np.errstate(divide="ignore", invalid="ignore"):
            a = (lo - c) / v
            b = (hi - c) / v
        tmin = np.nanmax(np.minimum(a, b), axis=1)
        tmax = np.nanmin(np.maximum(a, b), axis=1)
        hit = (tmax >= np.maximum(tmin, 0.0)) & (tmin < 0.9)
        seen += not hit.any()
    return seen / len(T)


def near(cam):
    c = np.array(cam)
    gap = np.maximum(np.maximum(lo - c, c - hi), 0.0)
    return float(np.sqrt((gap ** 2).sum(axis=1)).min())


out = []
for az in range(0, 360, 10):
    for dist in np.linspace(d0, d1, 3):
        for h in np.linspace(h0, h1, 3):
            cam = (cx + math.cos(math.radians(az)) * dist, cy + math.sin(math.radians(az)) * dist, h)
            if near(cam) < 40:
                continue
            # a foreground tower within the first third of the view spoils it even if rays get past
            out.append((visible(cam) - 0.00012 * h - 0.00004 * dist, az, round(float(dist)), round(float(h)), [round(v, 1) for v in cam]))
out.sort(reverse=True)
for row in out[:8]:
    print("score %.3f  az %3d  dist %4d  h %4d  cam %s" % row)
