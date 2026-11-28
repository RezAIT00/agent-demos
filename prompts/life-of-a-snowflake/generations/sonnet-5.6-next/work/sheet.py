# contact sheet:  python sheet.py out.png cols tile file...
import sys, os
from PIL import Image, ImageDraw
out, cols, tile = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
files = sys.argv[4:]
rows = (len(files) + cols - 1) // cols
S = Image.new('RGB', (cols * tile, rows * tile), (255, 0, 255))
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((tile, tile), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    label = os.path.basename(f)
    d.rectangle([0, 0, 8 + 7 * len(label), 16], fill=(0, 0, 0))
    d.text((4, 3), label, fill=(255, 255, 0))
    S.paste(im, ((i % cols) * tile, (i // cols) * tile))
S.save(out)
