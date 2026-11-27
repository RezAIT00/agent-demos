"""Five frames from each rendered shot folder, one row per shot: python shot_strip.py <render_dir> out.png [D07 ...]"""
import glob, os, sys
from PIL import Image, ImageDraw
root, out = sys.argv[1], sys.argv[2]
names = sys.argv[3:] or sorted(d for d in os.listdir(root) if d.startswith(("D", "S")))
rows = []
for d in names:
    frames = sorted(glob.glob(os.path.join(root, d, "*.png")))
    if not frames:
        continue
    row = Image.new("RGB", (5 * 480, 270))
    for i, u in enumerate((0.12, 0.34, 0.56, 0.78, 0.99)):
        f = frames[min(int(u * len(frames)), len(frames) - 1)]
        row.paste(Image.open(f).convert("RGB").resize((480, 270), Image.LANCZOS), (i * 480, 0))
    ImageDraw.Draw(row).text((6, 6), "%s  %d frames" % (d, len(frames)), fill=(255, 220, 60))
    rows.append(row)
img = Image.new("RGB", (2400, 270 * len(rows)))
for i, r in enumerate(rows):
    img.paste(r, (0, i * 270))
img.save(out)
