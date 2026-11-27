"""Hearing by numbers: does each hit arrive out of quiet, own the mix, and escalate?  mixreport.py  (after audio.py --stems)"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from audit import decode_audio  # noqa
from sheets import draw_text
HITS = json.load(open(os.path.join(ROOT, 'src', 'hits.json'), encoding='utf-8'))
SR, SPF = 48000, 2000


def db(x):
    return 10 * np.log10(np.mean(x * x) + 1e-12)


def band(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, len(x))


def main():
    mix = decode_audio(os.path.join(ROOT, 'soundtrack.wav')).mean(axis=0)
    stems = {n: decode_audio(os.path.join(ROOT, 'work', 'stem_%s.wav' % n)).mean(axis=0) for n in ('music', 'impacts', 'ambience')}
    sub = band(mix, 20, 90)
    lines = ['MIX REPORT (dB are relative; compare down the columns)',
             'before = level in the 6 frames ahead of contact; hit = first 250 ms; jump = hit - before',
             'sub = energy below 90 Hz in the first 600 ms; over music = impacts stem minus music stem, first 250 ms',
             '%-4s %-5s %-6s %-8s %-7s %-7s %-7s %-10s' % ('id', 'scale', 'frame', 'before', 'hit', 'jump', 'sub', 'over music')]
    rows = []
    for h in HITS['hits']:
        t = h['f'] * SPF
        before = db(mix[max(0, t - 6 * SPF):t - 200])
        hit = db(mix[t:t + SR // 4])
        s = db(sub[t:t + int(SR * 0.6)])
        om = db(stems['impacts'][t:t + SR // 4]) - db(stems['music'][t:t + SR // 4])
        rows.append((h, before, hit, hit - before, s, om))
        lines.append('%-4s %-5.1f %-6d %-8.1f %-7.1f %-7.1f %-7.1f %-10.1f %s' % (h['id'], h['scale'], h['f'], before, hit, hit - before, s, om, h['name']))
    # total impact energy in the 1.5 s after each hit, the honest measure of "biggest"
    lines.append('')
    lines.append('energy in the 1.5 s after contact (dB):')
    en = [(h['id'], 10 * np.log10(np.sum(mix[h['f'] * SPF:h['f'] * SPF + int(1.5 * SR)] ** 2) + 1e-9)) for h in HITS['hits']]
    lines.append('  ' + '  '.join('%s %.1f' % e for e in en))
    top = sorted(en, key=lambda e: -e[1])
    lines.append('  loudest: %s (%.1f dB), next: %s (%.1f dB), margin %.1f dB' % (top[0][0], top[0][1], top[1][0], top[1][1], top[0][1] - top[1][1]))
    open(os.path.join(ROOT, 'work', 'mix_report.txt'), 'w').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))
    # level over time with the hits marked
    W, Hh = 1800, 520
    im = Image.new('RGB', (W, Hh), (20, 18, 24))
    d = ImageDraw.Draw(im)
    hop = len(mix) // W
    for x in range(W):
        for sig, col in ((mix, (230, 228, 222)), (stems['music'] * 2.5, (90, 150, 255)), (sub, (255, 90, 120))):
            v = db(sig[x * hop:(x + 1) * hop])
            y = Hh - 30 - max(0, (v + 60)) / 60 * (Hh - 90)
            d.point((x, y), fill=col)
            d.point((x, y + 1), fill=col)
    for h in HITS['hits']:
        x = h['f'] / 1200 * W
        d.line([(x, 52), (x, Hh - 30)], fill=(120, 100, 60), width=1)
        draw_text(im, h['id'], x - 10, 30 if int(h['id'][1:]) % 2 else 12, 13, (255, 205, 90))
    draw_text(im, 'LEVEL OVER 50 S - WHITE MIX - BLUE MUSIC - RED SUB BASS', 12, Hh - 22, 13, (220, 220, 220))
    im.save(os.path.join(ROOT, 'work', 'mix_report.png'))


if __name__ == '__main__':
    main()
