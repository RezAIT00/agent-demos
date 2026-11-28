"""Zoomed spectrogram + waveform of three busy moments, with cue frames drawn on top."""
import json, os, subprocess
from PIL import Image, ImageDraw, ImageFont

os.chdir(os.path.dirname(os.path.abspath(__file__)))
cues = json.load(open('cues.json'))['cues']
try:
    font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 18)
except OSError:
    font = ImageFont.load_default()
W, HS, HW, TOP = 2000, 420, 150, 96
rows = []
for t0, t1 in [(1.8, 3.6), (5.0, 7.6), (18.4, 20.0)]:
    for kind, h in (('spec', HS), ('wave', HW)):
        flt = (f'atrim={t0}:{t1},asetpts=PTS-STARTPTS,showspectrumpic=s={W}x{h}:legend=0:mode=combined:color=magma:scale=log:fscale=log:drange=85'
               if kind == 'spec' else f'atrim={t0}:{t1},asetpts=PTS-STARTPTS,showwavespic=s={W}x{h}:colors=0x8fd3ff:scale=lin')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', '../snowflake-sound.mp4', '-lavfi', f'[0:a]{flt}', '-frames:v', '1', f'zoom_{kind}.png'], check=True)
    canvas = Image.new('RGB', (W, TOP + HS + HW), (14, 16, 22))
    canvas.paste(Image.open('zoom_spec.png').convert('RGB'), (0, TOP))
    bg = Image.new('RGBA', (W, HW), (20, 24, 34, 255)); bg.alpha_composite(Image.open('zoom_wave.png').convert('RGBA'))
    canvas.paste(bg.convert('RGB'), (0, TOP + HS))
    d = ImageDraw.Draw(canvas)
    d.text((6, 4), f'{t0:.1f} s to {t1:.1f} s', fill=(180, 200, 230), font=font)
    lanes = [0] * 4
    for c in cues:
        t = c['frame'] / 30
        if not (t0 <= t < t1) or c['id'] in ('band', 'sheen'):
            continue
        x = int((t - t0) / (t1 - t0) * W)
        colour = {'touchdown': (255, 90, 90), 'flash': (255, 230, 120), 'arm': (255, 190, 100)}.get(c['id'], (240, 240, 250))
        for y in range(TOP, TOP + HS + HW, 10):
            d.line([(x, y), (x, y + 4)], fill=colour, width=1)
        label = f"{c['id']} {c['frame']}"
        wpx = int(d.textlength(label, font=font)) + 10
        xl = min(x, W - wpx)
        lane = next((i for i in range(4) if lanes[i] <= xl), 3)
        lanes[lane] = xl + wpx
        d.line([(x, 24 + lane * 18 + 16), (x, TOP)], fill=(110, 114, 130))
        d.text((xl + 2, 24 + lane * 18), label, fill=colour, font=font)
    rows.append(canvas)
out = Image.new('RGB', (W, sum(r.height for r in rows) + 16), (255, 255, 255))
y = 0
for r in rows:
    out.paste(r, (0, y)); y += r.height + 8
out.save('sheet_zoom.png')
for f in ('zoom_spec.png', 'zoom_wave.png'):
    os.remove(f)
print('sheet_zoom.png written')
