"""Checks that the final playback shows the same physics as the recording: for each destruction shot, one late
frame of each, side by side, with the share of pixels that differ clearly."""
import glob, os, sys
import numpy as np
from PIL import Image, ImageDraw
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
rows = []
for k in range(1, 15):
    d = "D%02d" % k
    a = sorted(glob.glob(os.path.join(root, "renders", "d_record", d, "*.png")))
    b = sorted(glob.glob(os.path.join(root, "renders", "destruction", d, "*.png")))
    if not a or not b:
        continue
    i = int(len(a) * 0.82)
    x = Image.open(a[i]).convert("RGB").resize((640, 360), Image.LANCZOS)
    y = Image.open(b[i]).convert("RGB").resize((640, 360), Image.LANCZOS)
    diff = float((np.abs(np.asarray(x, np.float32) - np.asarray(y, np.float32)).max(axis=2) > 48).mean())
    row = Image.new("RGB", (1280, 360))
    row.paste(x, (0, 0)); row.paste(y, (640, 0))
    ImageDraw.Draw(row).text((6, 6), "%s frame %d  record | playback   differing %.1f%%" % (d, i, diff * 100), fill=(255, 230, 60))
    rows.append(row)
    print(d, i, "differing %.1f%%" % (diff * 100))
for part in (0, 1):
    sel = rows[part * 7:(part + 1) * 7]
    img = Image.new("RGB", (1280, 360 * len(sel)))
    for n, r in enumerate(sel):
        img.paste(r, (0, n * 360))
    img.save(os.path.join(root, "build", "audit", "cache_match_%d.png" % (part + 1)))
