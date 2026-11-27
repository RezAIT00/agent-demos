"""Tiles rendered frames into sheets. Labels are drawn from our own stroke glyphs (src/glyphs.json), no fonts.

  sheets.py tile <dir> <out.png> [--cols 4] [--w 640] [--frames 0,24,...]
  sheets.py contact <master.mkv> <out.png>        one frame every 2 s (plus the last)
  sheets.py impact <master.mkv> <out.png>         hero impacts, 8 frames before to 16 after
"""
import argparse, glob, json, os, re, subprocess, sys
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
GLYPHS = json.load(open(os.path.join(ROOT, 'src', 'glyphs.json'), encoding='utf-8'))
HITS = json.load(open(os.path.join(ROOT, 'src', 'hits.json'), encoding='utf-8'))
NARROW = {'I': 0.72, '1': 0.8, '.': 0.42, ',': 0.42, ':': 0.42, '!': 0.42, ' ': 0.66, "'": 0.36, '(': 0.55, ')': 0.55}


def text_width(text, size, tracking=1.35):
    w = 0
    for c in text.upper():
        w += (NARROW.get(c, 1.12 if c in 'MW' else 1.0)) * 4 + tracking
    return (w - tracking) * size / 6


def draw_text(img, text, x, y, size, color, weight=0.13, outline=None, align='left'):
    """supersampled stroke lettering"""
    k = 3
    w = text_width(text, size)
    if align == 'center':
        x -= w / 2
    elif align == 'right':
        x -= w
    pad = int(size * 0.5)
    layer = Image.new('RGBA', (int((w + pad * 2) * k), int((size * 1.2 + pad * 2) * k)), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    s = size / 6 * k
    passes = []
    if outline:
        passes.append((outline, size * weight * k * 2.2))
    passes.append((color, size * weight * k))
    for col, lw in passes:
        cx = pad * k
        for ch in text.upper():
            adv = NARROW.get(ch, 1.12 if ch in 'MW' else 1.0) * 4
            off = (adv - 4) / 2 if ch in NARROW else (0.24 if ch in 'MW' else 0)
            for st in GLYPHS.get(ch, []):
                pts = [(cx + (p[0] + off) * s, pad * k + p[1] * s) for p in st]
                d.line(pts, fill=col, width=max(1, int(lw)), joint='curve')
                for px, py in (pts[0], pts[-1]):
                    d.ellipse([px - lw / 2, py - lw / 2, px + lw / 2, py + lw / 2], fill=col)
            cx += (adv + 1.35) * s
    layer = layer.resize((layer.width // k, layer.height // k), Image.LANCZOS)
    img.paste(layer, (int(x - pad), int(y - pad)), layer)


def read_frames(master, frames, w, h):
    """pull exact frames out of the lossless master"""
    sel = '+'.join('eq(n\\,%d)' % f for f in frames)
    cmd = ['ffmpeg', '-v', 'error', '-i', master, '-vf', "select='%s',scale=%d:%d:flags=lanczos" % (sel, w, h),
           '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    n = len(raw) // (w * h * 3)
    ordered = sorted(set(frames))
    assert n == len(ordered), (n, len(ordered))
    return {f: Image.frombytes('RGB', (w, h), raw[i * w * h * 3:(i + 1) * w * h * 3]) for i, f in enumerate(ordered)}


def tile(images, labels, cols, out, gap=6, bg=(18, 16, 20), title=None):
    w, h = images[0].size
    rows = (len(images) + cols - 1) // cols
    top = 70 if title else 0
    sheet = Image.new('RGB', (cols * w + (cols + 1) * gap, rows * h + (rows + 1) * gap + top), bg)
    if title:
        size = min(30, 30 * (sheet.width - 60) / max(1, text_width(title, 30)))
        draw_text(sheet, title, gap + 14, 22, size, (240, 238, 232))
    for i, (im, lab) in enumerate(zip(images, labels)):
        x = gap + (i % cols) * (w + gap)
        y = top + gap + (i // cols) * (h + gap)
        sheet.paste(im, (x, y))
        if lab:
            sz = max(13, w // 30)
            draw_text(sheet, lab, x + 10, y + 9, sz, (255, 255, 255), weight=0.15, outline=(0, 0, 0))
    sheet.save(out)
    print('wrote', out, sheet.size)


def contact(master, out):
    frames = [min(1199, i * 48) for i in range(25)] + [1199]
    frames = sorted(set(frames))
    imgs = read_frames(master, frames, 480, 270)
    tile([imgs[f] for f in frames], ['%.1f S  F%d' % (f / 24, f) for f in frames], 4, out,
         title='IRO X SUMI - CONTACT SHEET - ONE FRAME EVERY 2 S')


def impact(master, out):
    heroes = [h for h in HITS['hits'] if h['hero']]
    blocks = []
    for h in heroes:
        frames = list(range(h['f'] - 8, h['f'] + 17))
        imgs = read_frames(master, frames, 384, 216)
        labs = []
        for f in frames:
            d = f - h['f']
            lab = ('CONTACT F%d' % f) if d == 0 else ('%s%d' % ('+' if d > 0 else '-', abs(d)))
            if 0 < d <= h['impact']:
                lab += '  IMPACT FRAME'
            elif 0 < d < h['hold']:
                lab += '  HIT-STOP'
            labs.append(lab)
        tmp = os.path.join(ROOT, 'work', 'impact_%s.png' % h['id'])
        tile([imgs[f] for f in frames], labs, 5, tmp,
             title='HERO %d - %s - %s - CONTACT F%d (%.2f S) - HIT-STOP %d' % (h['hero'], h['id'], h['name'].replace(':', ' -'), h['f'], h['f'] / 24, h['hold']))
        blocks.append(Image.open(tmp))
    W = max(b.width for b in blocks)
    H = sum(b.height for b in blocks) + 24 * (len(blocks) - 1)
    sheet = Image.new('RGB', (W, H), (60, 56, 64))
    y = 0
    for b in blocks:
        sheet.paste(b, (0, y)); y += b.height + 24
    sheet.save(out)
    print('wrote', out, sheet.size)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['tile', 'contact', 'impact'])
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--cols', type=int, default=4); ap.add_argument('--w', type=int, default=640)
    ap.add_argument('--frames', default='')
    a = ap.parse_args()
    if a.cmd == 'contact':
        contact(a.src, a.out)
    elif a.cmd == 'impact':
        impact(a.src, a.out)
    else:
        files = sorted(glob.glob(os.path.join(a.src, 'f*.png')))
        if a.frames:
            want = set()
            for part in a.frames.split(','):
                if ':' in part:
                    want |= set(range(*[int(x) for x in part.split(':')]))
                else:
                    want.add(int(part))
            files = [f for f in files if int(re.search(r'f(\d+)', os.path.basename(f)).group(1)) in want]
        imgs = [Image.open(f).convert('RGB') for f in files]
        h = int(a.w * imgs[0].height / imgs[0].width)
        imgs = [im.resize((a.w, h), Image.LANCZOS) for im in imgs]
        tile(imgs, ['F' + str(int(re.search(r'f(\d+)', os.path.basename(f)).group(1))) for f in files], a.cols, a.out)


if __name__ == '__main__':
    main()
