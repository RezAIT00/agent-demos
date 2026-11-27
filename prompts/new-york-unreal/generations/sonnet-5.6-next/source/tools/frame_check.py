"""Scans rendered frames for missing, black, blank or corrupt images and sudden one-frame jumps."""
import glob, os, sys
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image

def look(f):
    try:
        with Image.open(f) as im:
            a = np.asarray(im.convert("L").resize((240, 135), Image.NEAREST), np.float32)
        return f, float(a.mean()), float(a.std()), a, os.path.getsize(f)
    except Exception as e:
        return f, -1.0, -1.0, None, 0

bad_total = 0
for d in sys.argv[1:]:
    frames = sorted(glob.glob(os.path.join(d, "*.png")))
    with ThreadPoolExecutor(16) as pool:
        rows = list(pool.map(look, frames))
    sizes = np.median([r[4] for r in rows]) if rows else 0
    bad = []
    for i, (f, m, s, a, size) in enumerate(rows):
        if m < 0 or m < 2.0 or s < 3.0 or size < sizes * 0.25:
            bad.append((os.path.basename(f), "black/blank/corrupt", round(m, 1), round(s, 1)))
        elif 0 < i < len(rows) - 1 and rows[i - 1][3] is not None and rows[i + 1][3] is not None:
            dp = np.abs(a - rows[i - 1][3]).mean(); dn = np.abs(a - rows[i + 1][3]).mean()
            around = np.abs(rows[i + 1][3] - rows[i - 1][3]).mean()
            if min(dp, dn) > 22 and min(dp, dn) > 2.5 * around:
                bad.append((os.path.basename(f), "one-frame jump", round(dp, 1), round(dn, 1), round(around, 1)))
    bad_total += len(bad)
    print("%s: %d frames, %d suspect %s" % (os.path.basename(d), len(frames), len(bad), bad[:8]))
print("suspect total:", bad_total)
