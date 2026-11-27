"""Tile images into a labelled sheet: python sheet.py out.png cols thumb_w file..."""
import sys, os, glob
from PIL import Image, ImageDraw
out, cols, tw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
files = []
for a in sys.argv[4:]:
    files += sorted(glob.glob(a)) if any(c in a for c in "*?[") else [a]
ims = []
for f in files:
    im = Image.open(f).convert("RGB")
    h = int(im.height * tw / im.width)
    ims.append((os.path.basename(f), im.resize((tw, h), Image.LANCZOS)))
th = max(i.height for _, i in ims)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * (th + 14)), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for k, (n, im) in enumerate(ims):
    x, y = (k % cols) * tw, (k // cols) * (th + 14)
    sheet.paste(im, (x, y))
    d.text((x + 3, y + th + 1), n, fill=(230, 230, 230))
sheet.save(out)
