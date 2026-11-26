# Delivery audits: luma pops, flash rate, decode, durations, loudness, faststart.
#   python tools/audit.py pelican_trailer.mp4 [pelican_trailer_x.mp4 ...]
import subprocess, sys, json, os, re
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
FPS = 24
TL = json.loads(subprocess.check_output(['node', '-e', "const fs=require('fs');const TL=new Function(fs.readFileSync('src/timeline.js','utf8')+';return TL;')();"
                                         "console.log(JSON.stringify({beat:TL.BEAT,dur:TL.DURATION,shots:TL.shots.map(s=>[s.id,s.t0,s.t1]),impacts:TL.IMPACTS}))"]).decode())
BEAT = TL['beat']
W, H = 96, 54


def frames(path):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={W}:{H}:flags=area:in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24', '-f', 'rawvideo', '-'])
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float64) / 255.0


def rel_lum(rgb):  # WCAG relative luminance
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    return lin[..., 0] * 0.2126 + lin[..., 1] * 0.7152 + lin[..., 2] * 0.0722


def shot_of(frame):
    t = frame / FPS + 1e-6
    cur = TL['shots'][0]
    for s in TL['shots']:
        if t >= s[1]:
            cur = s
    return cur


def explain(i):
    """why may the picture change sharply between frame i-1 and frame i?"""
    t = i / FPS
    for sid, a, _ in TL['shots']:
        if abs(round(a * FPS) - i) <= 0:
            return 'cut -> ' + sid
    for beat, _ in TL['impacts']:
        start = int(np.ceil(beat * BEAT * FPS - 1e-6))
        if i in (start, start + 2):
            return 'impact frame ' + ('on' if i == start else 'off') + f' (beat {beat})'
    sid, a, b = shot_of(i)
    u = t - a
    # intended hard changes inside a shot: panels, on-screen slams, lightning, variant swaps, snaps
    intended = {
        'eye': [(0.0, 0.09, 'scripted fade in from black'), (2 * BEAT, 0.25, 'eye snaps open')],
        'grip': [(0.67, 0.08, 'scripted fade out to the first card')],
        'fallcard': [(0.0, 0.17, 'lettering slam settling')],
        'againcard': [(0.0, 0.17, 'lettering slam settling')],
        'slam': [(0.04, 0.14, 'wing hits water')],
        'scream': [(0.0, 0.27, 'wings spreading')],
        'falling': [(2.08, 0.18, 'scripted fade down into flashbacks')],
        'title': [(5.70, 0.31, 'scripted fade out')],
        'aftermath': [(0.0, 0.23, 'scripted fade in')],
        'gulp': [(0.86, 0.27, 'scripted final fade to black')],
        'rwheel': [(0.0, 0.31, 'scripted fade in')],
        'reye': [(0.0, 0.13, 'scripted fade in'), (1.5 * BEAT, 0.25, 'rival eye opens')],
        'eyesnap': [(0.5 * BEAT, 0.30, 'eye snaps open / aura')],
        'svg': [(0, 0.1, 'drawing 1'), (2 * BEAT, 0.12, 'drawing 2'), (4 * BEAT, 0.12, 'drawing 3')],
        'shatter': [(0.0, 0.45, 'glass shatter')],
        'split': [(0.0, 0.25, 'panel 1'), (BEAT, 0.25, 'panel 2'), (2 * BEAT, 0.25, 'panel 3')],
        'flashback': [(k * BEAT, 0.10, f'flashback {k + 1}') for k in range(4)],
        'card3': [(2 * BEAT, 0.2, 'NEVER slam')],
        'rhero': [(2.5 * BEAT, 0.4, 'lightning'), (6.2 * BEAT, 0.4, 'lightning'), (0.22, 0.2, 'name bar')],
        'versus': [(0.0, 0.25, 'panels slide in'), (BEAT, 0.12, 'VS slam')],
        'pouch': [(185.4 * BEAT - 182 * BEAT, 0.2, 'punchline card')],
    }
    for t0, win, why in intended.get(sid, []):
        if t0 - 1e-3 <= u <= t0 + win:
            return why
    return None


def luma_audit(f):
    y = (f[..., 0] * 0.2126 + f[..., 1] * 0.7152 + f[..., 2] * 0.0722).mean(axis=(1, 2)) * 255
    d = np.diff(y)
    big = [(i + 1, d[i]) for i in range(len(d)) if abs(d[i]) > 12]
    unexplained = [(i, v) for i, v in big if explain(i) is None]
    # one-frame pops: a frame that differs from both neighbours in the same direction
    pops = []
    for i in range(1, len(y) - 1):
        a, b = y[i] - y[i - 1], y[i] - y[i + 1]
        if a * b > 0 and min(abs(a), abs(b)) > 7:
            pops.append((i, a, b))
    bad_pops = [p for p in pops if explain(p[0]) is None and explain(p[0] + 1) is None]
    print(f'  frames {len(y)}  mean luma {y.mean():.1f}  jumps > 12/255: {len(big)}  of which unexplained: {len(unexplained)}')
    for i, v in unexplained:
        print(f'    UNEXPLAINED frame {i} (t={i / FPS:.3f}s, {shot_of(i)[0]}): {v:+.1f}')
    print(f'  single-frame pops > 7/255: {len(pops)}  unexplained: {len(bad_pops)}')
    for i, a, b in bad_pops:
        print(f'    POP frame {i} (t={i / FPS:.3f}s, {shot_of(i)[0]}): {a:+.1f} / {b:+.1f}')
    reasons = {}
    for i, v in big:
        r = explain(i) or 'unexplained'
        key = r.split(' ->')[0].split(' (')[0]
        reasons[key] = reasons.get(key, 0) + 1
    print('  explained jumps by reason:', reasons)
    return y, big, unexplained, bad_pops


def glitch_audit(f):
    """local one-frame glitches: a block that changes and then changes straight back"""
    y = (f[..., 0] * 0.2126 + f[..., 1] * 0.7152 + f[..., 2] * 0.0722) * 255
    n = len(y)
    b = y.reshape(n, 9, H // 9, 12, W // 12).mean(axis=(2, 4))  # 12 x 9 blocks
    prev, cur, nxt = b[:-2], b[1:-1], b[2:]
    mask = (np.abs(cur - prev) > 28) & (np.abs(cur - nxt) > 28) & (np.abs(prev - nxt) < 7) & ((cur - prev) * (cur - nxt) > 0)
    hits = {}
    for i, r, c in zip(*np.nonzero(mask)):
        hits.setdefault(int(i) + 1, []).append((int(r), int(c)))
    loud = [(i, v) for i, v in hits.items() if explain(i) is None and explain(i + 1) is None and len(v) >= 3]
    print(f'  local one-frame glitches (3+ of 108 blocks flip and flip back, outside named events): {len(loud)}')
    for i, v in loud[:20]:
        print(f'    frame {i} (t={i / FPS:.3f}s, {shot_of(i)[0]}): {len(v)} blocks')


def flash_count(series, thr=0.10):
    """times of opposing luminance transitions >= thr with the darker side below 0.80"""
    trans = []
    ext = series[0]
    direction = 0
    for i in range(1, len(series)):
        v = series[i]
        if direction >= 0 and v > ext and direction == 1:
            ext = v
            continue
        if direction <= 0 and v < ext and direction == -1:
            ext = v
            continue
        if v - ext >= thr and min(v, ext) < 0.80 and direction != 1:
            trans.append(i); direction = 1; ext = v
        elif ext - v >= thr and min(v, ext) < 0.80 and direction != -1:
            trans.append(i); direction = -1; ext = v
        elif direction == 0:
            pass
    # one flash = a pair of opposing transitions
    worst, where = 0, 0
    for s in range(0, len(series)):
        n = sum(1 for t in trans if s <= t < s + FPS)
        if n // 2 > worst:
            worst, where = n // 2, s
    return worst, where, len(trans)


def flash_audit(f):
    L = rel_lum(f)
    regions = {'full frame': L.mean(axis=(1, 2))}
    # sliding regions a quarter of the screen in size
    hh, ww = H // 2, W // 2
    for ry, y0 in enumerate([0, H // 4, H // 2]):
        for rx, x0 in enumerate([0, W // 4, W // 2]):
            regions[f'region {ry}{rx}'] = L[:, y0:y0 + hh, x0:x0 + ww].mean(axis=(1, 2))
    worst = (0, 0, 'none')
    for name, s in regions.items():
        n, at, _ = flash_count(s)
        if n > worst[0]:
            worst = (n, at, name)
    full = flash_count(regions['full frame'])
    print(f'  flashes: worst 1-second window, full frame = {full[0]} (at {full[1] / FPS:.2f}s);  worst quarter-screen region = {worst[0]} ({worst[2]} at {worst[1] / FPS:.2f}s);  limit 3')
    return full[0], worst[0]


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    return p.stdout + p.stderr


first = True
for path in sys.argv[1:]:
    print(f'==== {path}  ({os.path.getsize(path) / 1e6:.1f} MB)')
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,profile,pix_fmt,width,height,r_frame_rate,bit_rate,sample_rate,channels,duration,nb_frames:format=duration,bit_rate', '-of', 'json', path]).decode())
    for s in info['streams']:
        print('  ' + ' '.join(f'{k}={v}' for k, v in s.items()))
    print('  container duration', info['format']['duration'], ' bitrate', f"{int(info['format']['bit_rate']) / 1e6:.2f} Mb/s")
    durs = {s['codec_type']: float(s['duration']) for s in info['streams']}
    if 'video' in durs and 'audio' in durs:
        print(f"  A/V duration difference: {abs(durs['video'] - durs['audio']) * 1000:.1f} ms")
    err = run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'null', '-'])
    print('  full decode:', 'CLEAN' if not err.strip() else 'ERRORS\n' + err[:2000])
    cnt = subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames', '-select_streams', 'v', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', path]).decode().strip()
    print('  decoded video frames:', cnt)
    head = open(path, 'rb').read(1 << 20)
    mv, md = head.find(b'moov'), head.find(b'mdat')
    print('  faststart (moov before mdat):', mv != -1 and (md == -1 or mv < md))
    lo = run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'])
    summary = lo[lo.rfind('Summary:'):]
    I = re.search(r'I:\s+(-?[\d.]+) LUFS', summary); P = re.search(r'Peak:\s+(-?[\d.]+) dBFS', summary); R = re.search(r'LRA:\s+(-?[\d.]+) LU', summary)
    print(f'  loudness: integrated {I.group(1)} LUFS, LRA {R.group(1)} LU, true peak {P.group(1)} dBTP')
    pcm = np.frombuffer(subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-vn', '-f', 'f32le', '-ac', '2', '-ar', '48000', '-']), np.float32)
    print(f'  decoded audio: max |sample| {np.abs(pcm).max():.4f}, samples at or above full scale: {int((np.abs(pcm) >= 1.0).sum())}')
    f = frames(path)
    if first or '--all' in sys.argv:
        luma_audit(f)
        glitch_audit(f)
    flash_audit(f)
    first = False
