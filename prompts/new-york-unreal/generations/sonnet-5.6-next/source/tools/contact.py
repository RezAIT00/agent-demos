"""Contact sheet from rendered shot folders: one frame every N seconds of the cut film.

  python source/tools/contact.py <render_dir> <out.png> [--every 3.0] [--cols 5] [--thumb 480]
"""
import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "film"))
import filmdata  # noqa: E402


def frame_at(root, t):
    start = 0.0
    for s in filmdata.SHOTS:
        if t < start + s.seconds - 1e-6 or s is filmdata.SHOTS[-1]:
            i = min(int(round((t - start) * filmdata.FPS)), s.frames - 1)
            return s, i, os.path.join(root, "S%02d" % s.id, "S%02d.%04d.png" % (s.id, i))
        start += s.seconds


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("root")
    ap.add_argument("out")
    ap.add_argument("--every", type=float, default=3.0)
    ap.add_argument("--offset", type=float, default=1.0)
    ap.add_argument("--cols", type=int, default=5)
    ap.add_argument("--thumb", type=int, default=480)
    a = ap.parse_args()
    total = sum(s.seconds for s in filmdata.SHOTS)
    items = []
    t = a.offset
    while t < total:
        s, i, path = frame_at(a.root, t)
        if os.path.exists(path):
            items.append((t, s, path))
        t += a.every
    if not items:
        print("no frames found")
        return
    th = int(a.thumb * 9 / 16)
    rows = (len(items) + a.cols - 1) // a.cols
    sheet = Image.new("RGB", (a.cols * a.thumb, rows * (th + 18)), (14, 14, 14))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    for k, (t, s, path) in enumerate(items):
        x, y = (k % a.cols) * a.thumb, (k // a.cols) * (th + 18)
        sheet.paste(Image.open(path).convert("RGB").resize((a.thumb, th), Image.LANCZOS), (x, y))
        d.text((x + 4, y + th + 2), "%5.1f s  S%02d %s" % (t, s.id, s.name.replace("_", " ")), fill=(220, 220, 220), font=font)
    sheet.save(a.out)
    print(a.out, len(items), "frames")


if __name__ == "__main__":
    main()
