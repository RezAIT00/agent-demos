"""Delivery checks. Each prints a table and writes work/audit_<name>.txt

  audit.py sync <audio or video file>       transient onset vs contact frame, every hit
  audit.py picture <video>                  flash count (WCAG-style), luma pops, black frames
  audit.py colour                           colour-rule results gathered during capture --audit
  audit.py media <video> [wav]              loudness, true peak, clipping, decode, frame count, durations
"""
import json, os, re, subprocess, sys
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
HITS = json.load(open(os.path.join(ROOT, 'src', 'hits.json'), encoding='utf-8'))
SR = 48000
SPF = 2000
OUT = []


def say(s=''):
    OUT.append(s)
    print(s)


def save(name):
    os.makedirs(os.path.join(ROOT, 'work'), exist_ok=True)
    with open(os.path.join(ROOT, 'work', 'audit_%s.txt' % name), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(OUT) + '\n')


def decode_audio(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(np.float64)


# ------------------------------------------------------------------ sync
def highpass(x, fc):
    L = 1
    while L < len(x) + SR:
        L *= 2
    X = np.fft.rfft(x, L)
    f = np.fft.rfftfreq(L, 1 / SR)
    w = 2 * np.pi * fc / SR
    c, s = np.cos(w), np.sin(w)
    al = s / (2 * 0.707)
    z = np.exp(-2j * np.pi * f / SR)
    H = ((1 + c) / 2 - (1 + c) * z + (1 + c) / 2 * z * z) / ((1 + al) - 2 * c * z + (1 - al) * z * z)
    return np.fft.irfft(X * H * H, L)[:len(x)]


def onset(env_cum, target, half):
    """the sharpest jump in level inside +-half samples of the contact: energy just after vs just before"""
    post, pre = int(0.004 * SR), int(0.020 * SR)
    lo, hi = max(pre, target - half), min(len(env_cum) - post - 1, target + half)
    idx = np.arange(lo, hi)
    after = (env_cum[idx + post] - env_cum[idx]) / post
    before = (env_cum[idx] - env_cum[idx - pre]) / pre
    # level rise in dB, weighted by how loud the arrival is, so a faint tick cannot win over the hit
    rise = 10 * np.log10((after + 1e-9) / (before + 1e-7))
    loud = 10 * np.log10(after + 1e-9)
    score = rise + 0.8 * (loud - loud.max())
    i = int(idx[int(np.argmax(score))])
    # walk to the first sample that carries the jump
    seg = env_cum[i + 1:i + post + 1] - env_cum[i:i + post]
    base = np.sqrt(max(before[i - lo], 1e-12))
    peak = np.sqrt(seg.max())
    over = np.nonzero(np.sqrt(seg) > base + 0.18 * (peak - base))[0]
    first = i + (int(over[0]) if len(over) else 0)
    return first, float(rise[i - lo]), float(10 * np.log10(after[i - lo] + 1e-12))


def sync(path):
    a = decode_audio(path)
    mono = a.mean(axis=0)
    y = highpass(mono, 1500)
    cum = np.concatenate([[0], np.cumsum(y * y)])
    say('SYNC AUDIT  %s' % os.path.basename(path))
    say('onset = sharpest level jump in the 1.5 kHz-high-passed mix within +-3 frames of the contact; pass = within +-1 frame (41.7 ms)')
    say('%-4s %-5s %-9s %-10s %-9s %-8s %-8s %-6s %s' % ('id', 'frame', 'contact s', 'onset s', 'error ms', 'err fr', 'jump dB', 'result', 'hit'))
    rows = []
    for group, label in ((HITS['hits'], 'MAJOR'), (HITS['minor'], 'minor')):
        say('--- %s' % label)
        for h in group:
            t = h['f'] * SPF
            first, rise, level = onset(cum, t, 3 * SPF)
            err = (first - t) / SR * 1000
            fr = (first - t) / SPF
            ok = abs(fr) <= 1.0
            rows.append((label, h['id'], ok, err))
            say('%-4s %-5d %-9.4f %-10.4f %+-9.2f %+-8.3f %-8.1f %-6s %s' % (h['id'], h['f'], h['f'] / 24, first / SR, err, fr, rise, 'PASS' if ok else 'FAIL', h['name']))
    for label in ('MAJOR', 'minor'):
        sel = [r for r in rows if r[0] == label]
        say('%s: %d/%d within +-1 frame; worst %.2f ms' % (label, sum(r[2] for r in sel), len(sel), max(abs(r[3]) for r in sel)))
    save('sync')
    return rows


# ------------------------------------------------------------------ picture
def read_video(path, w, h):
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', path, '-vf', 'scale=%d:%d:flags=area' % (w, h), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    while True:
        raw = p.stdout.read(w * h * 3)
        if len(raw) < w * h * 3:
            break
        yield np.frombuffer(raw, np.uint8).reshape(h, w, 3)
    p.wait()


def srgb_lin(v):
    v = v / 255.0
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)


def count_transitions(series):
    """frames at which luminance has moved >= 0.10 against the previous swing (darker side below 0.80)"""
    ev = []
    lo = hi = series[0]
    direction = 0
    for i in range(1, len(series)):
        v = series[i]
        if direction >= 0:
            if v > hi:
                hi = v
            if hi - v >= 0.10 and min(v, hi) < 0.80:
                ev.append((i, -1)); direction = -1; lo = v
                continue
        if direction <= 0:
            if v < lo:
                lo = v
            if v - lo >= 0.10 and min(v, lo) < 0.80:
                ev.append((i, 1)); direction = 1; hi = v
    return ev


def max_flashes(events, n):
    worst, at = 0, 0
    for s in range(0, n):
        k = sum(1 for f, _ in events if s <= f < s + 24)
        fl = k // 2
        if fl > worst:
            worst, at = fl, s
    return worst, at


def picture(path):
    TW, TH = 12, 8
    W, H = 192, 108
    mean, tiles, red, black = [], [], [], []
    prev_red = None
    for img in read_video(path, W, H):
        lin = srgb_lin(img.astype(np.float64))
        lum = lin[..., 0] * 0.2126 + lin[..., 1] * 0.7152 + lin[..., 2] * 0.0722
        mean.append(lum.mean())
        t = lum[:H // TH * TH, :W // TW * TW].reshape(TH, H // TH, TW, W // TW).mean(axis=(1, 3))
        tiles.append(t.ravel())
        r, g, b = img[..., 0].astype(float), img[..., 1].astype(float), img[..., 2].astype(float)
        sat = (r / (r + g + b + 1e-6) >= 0.8) & (r > 90)
        red.append(sat.mean())
        black.append(img.mean() < 4)
    n = len(mean)
    mean = np.array(mean); tiles = np.array(tiles)
    say('PICTURE AUDIT  %s   frames: %d' % (os.path.basename(path), n))
    say()
    say('FLASHES (WCAG 2.x definition: a pair of opposing relative-luminance changes >= 0.10, darker state < 0.80; limit 3 per second)')
    ev = count_transitions(mean)
    worst, at = max_flashes(ev, n)
    say('  whole-frame mean luminance: %d opposing transitions in the film; most flashes in any 1 s window = %d (window from frame %d)' % (len(ev), worst, at))
    # area test: a flash counts when at least a quarter of the screen swings the same way on the same frame
    tev = [count_transitions(tiles[:, i]) for i in range(tiles.shape[1])]
    need = int(np.ceil(0.25 * tiles.shape[1]))
    area_ev = []
    for d in (1, -1):
        cnt = np.zeros(n)
        for e in tev:
            for f, s in e:
                if s == d:
                    cnt[f] += 1
        area_ev += [(f, d) for f in range(n) if cnt[f] >= need]
    area_ev.sort()
    merged = []
    for f, d in area_ev:
        if not merged or merged[-1][1] != d:
            merged.append((f, d))
    worst2, at2 = max_flashes(merged, n)
    say('  large-area test (>= 25%% of %d tiles swinging together): %d transitions; most flashes in any 1 s window = %d (window from frame %d)' % (tiles.shape[1], len(merged), worst2, at2))
    say('  large-area transitions by frame: ' + ', '.join('%d%s' % (f, '+' if d > 0 else '-') for f, d in merged))
    per_window = []
    for s in range(0, n, 24):
        per_window.append(sum(1 for f, _ in merged if s <= f < s + 24) // 2)
    say('  flashes per whole second 0..49: ' + ' '.join(str(v) for v in per_window))
    say('  RESULT: %s' % ('PASS' if max(worst, worst2) <= 3 else 'FAIL'))
    # red flashes
    rv = np.array(red)
    rt = []
    for i in range(1, n):
        if abs(rv[i] - rv[i - 1]) > 0.25:
            rt.append(i)
    wr = max([sum(1 for f in rt if s <= f < s + 24) // 2 for s in range(n)] or [0])
    say('  saturated-red area swings > 25%% of screen: %d; most pairs in any 1 s = %d' % (len(rt), wr))
    say()
    say('LUMA CONTINUITY (frame-to-frame change of mean relative luminance > 0.07 must be intended)')
    src = open(os.path.join(ROOT, 'src', 'camera.js'), encoding='utf-8').read()
    cuts = sorted(set(int(m) for m in re.findall(r'^  \[(\d+), \[C\(', src, re.M)))
    cl = open(os.path.join(ROOT, 'src', 'closeups.js'), encoding='utf-8').read()
    for a_, b_ in re.findall(r'\[(\d+), (\d+), draw', cl):
        cuts += [int(a_), int(b_)]
    fx = open(os.path.join(ROOT, 'src', 'fx.js'), encoding='utf-8').read()
    imp = [int(m) for m in re.findall(r'^  (\d+): \[\d', fx, re.M)] + [int(m) for m in re.findall(r' (\d+): \[\d, \d+, [\d.]+\]', fx)]
    imp = sorted(set(imp))
    speed = [(int(x), int(y)) for x, y in re.findall(r'\[(\d+), (\d+), [\d.]+, [01], \[', fx)]
    unexplained = 0
    for i in range(1, n):
        d = mean[i] - mean[i - 1]
        if abs(d) <= 0.07:
            continue
        if i in cuts:
            why = 'cut'
        elif i in imp or (i - 1) in imp:
            why = 'impact frame in/out'
        elif 1093 <= i <= 1108:
            why = 'the single detonation white-out'
        elif any(h['f'] <= i <= h['f'] + 2 for h in HITS['hits']):
            why = 'contact (hit spark)'
        elif any(h['hold'] and h['f'] + h['hold'] <= i <= h['f'] + h['hold'] + 3 for h in HITS['hits']):
            why = 'hit-stop release (camera snaps wide)'
        elif any(i in (a_, a_ + 1, b_, b_ - 1) for a_, b_ in speed):
            why = 'speed lines switching on or off'
        else:
            why = 'UNEXPLAINED'
            unexplained += 1
        say('  frame %4d  %+.3f  (%.3f -> %.3f)  %s' % (i, d, mean[i - 1], mean[i], why))
    say('  unexplained luminance pops: %d   RESULT: %s' % (unexplained, 'PASS' if unexplained == 0 else 'CHECK'))
    bl = [i for i, b in enumerate(black) if b]
    say('  fully black frames: %s' % (bl if bl else 'none'))
    np.save(os.path.join(ROOT, 'work', 'luma.npy'), mean)
    save('picture')


def colour():
    rows = json.load(open(os.path.join(ROOT, 'work', 'audit_colour_rule.json')))
    say('COLOUR-RULE AUDIT (measured on the rendered pixels during capture)')
    say('pixels checked per frame: SUMI mask coverage >= 98% and no effect drawn over them; spread = max(R,G,B)-min(R,G,B)')
    tot = sum(r[1] for r in rows)
    withpx = [r for r in rows if r[1] > 0]
    worst = max((r[2] for r in rows), default=0)
    over = sum(r[4] for r in rows)
    mean = sum(r[3] * r[1] for r in rows) / max(1, tot)
    say('frames captured: %d, frames with SUMI visible: %d, SUMI pixels checked: %d' % (len(rows), len(withpx), tot))
    say('mean channel spread: %.3f / 255    worst single pixel: %d / 255    pixels with spread > 8: %d (%.6f%%)' % (mean, worst, over, 100.0 * over / max(1, tot)))
    say('note: film grain and the vignette are neutral, so any spread above ~2 would be colour leaking onto him')
    bad = sorted([r for r in rows if r[4] > 0], key=lambda r: -r[4])[:10]
    if bad:
        say('frames with the most off-grey pixels (frame, pixels checked, max spread, count > 8): ' + '; '.join('%d: %d, %d, %d' % (r[0], r[1], r[2], r[4]) for r in bad))
    say('RESULT: %s' % ('PASS' if over <= tot * 1e-5 else 'CHECK'))
    save('colour')


def purity(master, stills_dir):
    from PIL import Image
    say('PURITY AUDIT: frames re-rendered out of order in a new browser, compared with the lossless master')
    files = sorted(f for f in os.listdir(stills_dir) if f.endswith('.png'))
    worst = 0
    for name in files:
        f = int(name[1:5])
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', master, '-vf', "select='eq(n\\,%d)'" % f, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
        a = np.frombuffer(raw, np.uint8).reshape(1080, 1920, 3).astype(int)
        b = np.asarray(Image.open(os.path.join(stills_dir, name)).convert('RGB')).astype(int)
        d = np.abs(a - b)
        worst = max(worst, int(d.max()))
        say('  frame %4d  max channel difference %3d   pixels differing %d' % (f, d.max(), int((d.max(axis=2) > 0).sum())))
    say('RESULT: %s (worst difference %d / 255)' % ('PASS, bit-exact' if worst == 0 else ('PASS' if worst <= 2 else 'FAIL'), worst))
    save('purity')


def media(video, wav=None):
    say('MEDIA AUDIT')
    for p in [video] + ([wav] if wav else []):
        r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', p, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
        tail = r[r.rfind('Summary:'):]
        I = re.search(r'I:\s+(-?[\d.]+) LUFS', tail).group(1)
        TP = re.search(r'Peak:\s+(-?[\d.]+) dBFS', tail).group(1)
        LRA = re.search(r'LRA:\s+(-?[\d.]+) LU', tail).group(1)
        a = decode_audio(p)
        clipped = int(np.sum(np.abs(a) >= 0.99999))
        say('  %-16s integrated %s LUFS, true peak %s dBTP, LRA %s LU, sample peak %.2f dBFS, samples at full scale %d' % (os.path.basename(p), I, TP, LRA, 20 * np.log10(np.abs(a).max()), clipped))
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-f', 'null', '-'], capture_output=True, text=True)
    say('  full decode with -v error: %s' % ('clean (no output, exit %d)' % r.returncode if not r.stderr.strip() else r.stderr.strip()[:500]))
    pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', video], capture_output=True, text=True).stdout)
    for s in pr['streams']:
        if s['codec_type'] == 'video':
            say('  video: %s %s %dx%d %s fps, frames decoded %s, duration %s s, bitrate %.2f Mbit/s' % (s['codec_name'], s['pix_fmt'], s['width'], s['height'], s['r_frame_rate'], s['nb_read_frames'], s['duration'], int(s.get('bit_rate', 0)) / 1e6))
        else:
            say('  audio: %s %s Hz %s ch, duration %s s, bitrate %.0f kbit/s' % (s['codec_name'], s['sample_rate'], s['channels'], s['duration'], int(s.get('bit_rate', 0)) / 1e3))
    say('  container duration %s s, size %.1f MB' % (pr['format']['duration'], int(pr['format']['size']) / 1e6))
    with open(video, 'rb') as fh:
        head = fh.read(4 << 20)
    mv, md = head.find(b'moov'), head.find(b'mdat')
    say('  faststart (moov atom ahead of mdat): %s' % ('yes' if mv >= 0 and (md < 0 or mv < md) else 'NO'))
    save('media_' + os.path.splitext(os.path.basename(video))[0])


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'sync':
        sync(sys.argv[2])
    elif cmd == 'picture':
        picture(sys.argv[2])
    elif cmd == 'colour':
        colour()
    elif cmd == 'purity':
        purity(sys.argv[2], sys.argv[3])
    elif cmd == 'media':
        media(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
