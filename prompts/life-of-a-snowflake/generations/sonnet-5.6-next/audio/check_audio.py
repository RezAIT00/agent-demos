"""Measurements on the finished soundtrack, since nobody listened to it while it was made.
   python check_audio.py            (expects ../snowflake-sound.mp4 and snowflake.wav)
Writes check_report.json, spectrogram.png, waveform.png and sheet_audio.png."""
import hashlib, json, os, re, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SR, FPS = 48000, 30
HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
WAV, MP4, SILENT = 'snowflake.wav', '../snowflake-sound.mp4', '../snowflake.mp4'
sheet = json.load(open('cues.json'))
cues = sheet['cues']
report = {}

def run(args, binary=False):
    r = subprocess.run(args, capture_output=True, check=True)
    return r.stdout if binary else (r.stdout.decode(), r.stderr.decode())

def decode(path):
    raw = run(['ffmpeg', '-v', 'error', '-i', path, '-map', '0:a', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], True)
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)

def loudness(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-map', '0:a', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    tail = r.stderr[r.stderr.rindex('Summary:'):]
    g = lambda p: float(re.search(p, tail).group(1))
    return {'integrated_LUFS': g(r'I:\s+(-?[\d.]+) LUFS'), 'LRA_LU': g(r'LRA:\s+(-?[\d.]+) LU'), 'true_peak_dBTP': g(r'Peak:\s+(-?[\d.]+) dBFS')}

# ---------------------------------------------------------------- containers
probe = json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', MP4])[0])
report['mp4_streams'] = [{k: s.get(k) for k in ('codec_type', 'codec_name', 'profile', 'width', 'height', 'r_frame_rate', 'nb_frames', 'sample_rate', 'channels', 'bit_rate', 'duration')} for s in probe['streams']]
report['mp4_duration'] = float(probe['format']['duration'])
report['mp4_bytes'] = int(probe['format']['size'])
wprobe = json.loads(run(['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', WAV])[0])['streams'][0]
report['wav'] = {'codec': wprobe['codec_name'], 'rate': int(wprobe['sample_rate']), 'channels': wprobe['channels'], 'samples': int(wprobe['duration_ts']), 'duration': float(wprobe['duration'])}
report['loudness_wav'] = loudness(WAV)
report['loudness_mp4'] = loudness(MP4)
vmd5 = lambda p: run(['ffmpeg', '-v', 'error', '-i', p, '-map', '0:v', '-c', 'copy', '-f', 'md5', '-'])[0].strip()
report['video_stream_identical_to_silent'] = vmd5(MP4) == vmd5(SILENT)
data = open(MP4, 'rb').read()
report['faststart'] = data.find(b'moov') < data.find(b'mdat')

wav, mp4 = decode(WAV), decode(MP4)
report['decoded_samples'] = {'wav': len(wav), 'mp4_aac': len(mp4)}
# AAC encoder delay must be compensated: where does the decoded audio best match the WAV?
a, b = wav.mean(1), mp4.mean(1)
seg = slice(int(2.7 * SR), int(6.5 * SR))
lags = range(-3000, 3001)
scores = [float(np.dot(a[seg], b[seg.start + L:seg.stop + L])) for L in lags]
report['aac_lag_samples'] = int(lags[int(np.argmax(scores))])

mono_raw = mp4.mean(1)

# ---------------------------------------------------------------- defects
for name, x in (('wav', wav), ('mp4', mp4)):
    report[f'{name}_sample_peak_dBFS'] = round(float(20 * np.log10(np.abs(x).max())), 2)
    report[f'{name}_clipped_samples'] = int((np.abs(x) >= 0.999).sum())
# gaps: quietest 50 ms window, ignoring the two fades
win = int(0.05 * SR)
rms = np.array([np.sqrt((wav[i:i + win] ** 2).mean()) for i in range(int(0.06 * SR), len(wav) - int(0.30 * SR) - win, win // 2)])
k = int(rms.argmin())
report['quietest_50ms'] = {'dBFS': round(float(20 * np.log10(rms[k] + 1e-12)), 1), 'at_s': round(0.06 + k * win / 2 / SR, 3)}
report['windows_below_minus_55dBFS'] = int((rms < 10 ** (-55 / 20)).sum())
# clicks: a lone sample-to-sample jerk far above its surroundings
def find_clicks(sig):
    found = []
    for ch in range(2):
        d2 = np.abs(np.diff(sig[:, ch], 2))
        block = 960
        for s0 in range(0, len(d2) - block, block):
            w = d2[max(0, s0 - block):s0 + 2 * block]
            ref = np.percentile(w, 99.0) + 1e-5
            i = s0 + int(d2[s0:s0 + block].argmax())
            if d2[i] > 6.0 * ref and d2[i] > 0.02:
                found.append((round(i / SR, 4), round(float(d2[i]), 4), round(float(d2[i] / ref), 1)))
    return found
clicks = find_clicks(wav)
planted_times = [1.2345, 8.7654, 16.4321]
dirty = wav.copy()
for pt in planted_times:
    dirty[int(pt * SR)] += 0.2
caught = find_clicks(dirty)
report['click_detector_selftest'] = f"{sum(any(abs(c[0] - pt) < 0.001 for c in caught) for pt in planted_times)}/{len(planted_times)} planted 0.2 clicks found"
intended = [(c['frame'] / FPS - 0.005, (c.get('endFrame', c['frame']) / FPS) + 0.06) for c in cues if c['id'] in ('freeze', 'touchdown', 'glint')]
report['transients_flagged'] = len(clicks)
report['transients_outside_intended_clicks'] = sorted(set(t for t in clicks if not any(a0 <= t[0] <= a1 for a0, a1 in intended)))
report['max_sample_step'] = round(float(np.abs(np.diff(wav, axis=0)).max()), 4)
report['first_and_last_sample'] = [round(float(np.abs(wav[0]).max()), 6), round(float(np.abs(wav[-1]).max()), 6)]

# ---------------------------------------------------------------- hit timing inside the final MP4
# (1) matched filter: each hit, rendered alone, is searched for in the decoded AAC audio within +/-120 ms.
#     Both signals are differentiated so that attacks, not slow beds, decide the match.
def hp(x):
    return np.diff(x, prepend=x[:1])
def band(x, f0, f1):
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    spec[(f < f0) | (f > f1)] = 0
    return np.fft.irfft(spec, len(x))
mono = hp(mp4.mean(1))
mono_low = band(mp4.mean(1), 330, 1050)     # the band the low, round bubble blips live in
index = json.load(open('templates/index.json'))
REACH = int(0.120 * SR)
matched = []
for e in index:
    t = np.fromfile('templates/' + e['file'], np.float32).astype(np.float64)
    if np.abs(t).max() < 1e-5:
        matched.append({'id': e['id'], 'frame': e['frame'], 'offset_samples': None, 'correlation': 0}); continue
    # 25 ms of silence ahead of the attack: sliding a ringing tone by whole cycles then scores worse
    LEAD = int(0.025 * SR)
    low = e['id'] == 'bubble'
    t = np.concatenate([np.zeros(LEAD), t])
    t = band(t, 330, 1050) if low else hp(t)
    source = mono_low if low else mono
    lo, hi = e['sample'] - LEAD - REACH, e['sample'] - LEAD + REACH + len(t)
    seg = source[max(0, lo):min(len(source), hi)]
    pad_front = max(0, -lo)
    seg = np.pad(seg, (pad_front, max(0, (hi - lo) - len(seg) - pad_front)))
    n = 1 << int(np.ceil(np.log2(len(seg) + len(t))))
    cc = np.fft.irfft(np.fft.rfft(seg, n) * np.conj(np.fft.rfft(t, n)), n)[:2 * REACH + 1]
    energy = np.sqrt(np.convolve(seg ** 2, np.ones(len(t)), 'valid')[:2 * REACH + 1] * (t ** 2).sum()) + 1e-12
    rho = cc / energy
    k = int(rho.argmax())
    matched.append({'id': e['id'], 'frame': e['frame'], 'offset_samples': k - REACH, 'offset_ms': round((k - REACH) / SR * 1000, 2), 'correlation': round(float(rho[k]), 3)})
report['hits_matched'] = matched
ok = [m for m in matched if m['offset_samples'] is not None and abs(m['offset_samples']) <= 48]
report['hits_within_1ms'] = f'{len(ok)}/{len(matched)}'
half_frame = 1000 / FPS / 2
clear = [m for m in matched if m['correlation'] >= 0.3]
report['clear_matches_within_half_a_frame'] = f"{sum(abs(m['offset_ms']) <= half_frame for m in clear)}/{len(clear)}"
report['worst_clear_match_offset_ms'] = max(abs(m['offset_ms']) for m in clear)
report['too_faint_to_judge'] = [f"{m['id']} f{m['frame']} (r={m['correlation']}, offset {m.get('offset_ms')} ms)" for m in matched if m['correlation'] < 0.3]

# (2) template-free cross-check for the sharp hits: where does high-frequency energy jump?
sharp = []
for c in cues:
    if c['id'] not in ('touchdown', 'arm', 'freeze', 'glint'): continue
    t = c['frame'] / FPS
    N, HOP = 512, 48
    win_h = np.hanning(N); prev = None; times = []; vals = []
    for centre in range(int((t - 0.025) * SR), int((t + 0.045) * SR), HOP):
        fr = mp4.mean(1)[centre - N // 2:centre + N // 2] if False else None
        fr = mono_raw[centre - N // 2:centre + N // 2]
        mag = np.log1p(400 * np.abs(np.fft.rfft(fr * win_h)))
        if prev is not None:
            vals.append(np.maximum(mag - prev, 0)[8:].sum()); times.append(centre / SR)
        prev = mag
    times, vals = np.array(times), np.array(vals)
    first = times[np.argmax(vals >= np.median(vals) + 0.55 * (vals.max() - np.median(vals)))]
    sharp.append({'id': c['id'], 'frame': c['frame'], 'offset_ms': round(float((first - t) * 1000), 1), 'strength_over_median': round(float(vals.max() / (np.median(vals) + 1e-6)), 1)})
report['sharp_hits_flux'] = sharp

# ---------------------------------------------------------------- the same cues against the PICTURE
def frames(path, a_, b_, w=1080):
    raw = run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f"select='between(n\\,{a_}\\,{b_})',scale={w}:{w}", '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], True)
    return np.frombuffer(raw, np.uint8).reshape(-1, w, w).astype(np.float32)
by = lambda i: [c for c in cues if c['id'] == i]
picture = {}
# facet flash: brightest frame of the picture around the cue
f0 = by('flash')[0]['frame']
v = frames(SILENT, f0 - 8, f0 + 8)
picture['flash'] = {'cue_frame': f0, 'brightest_video_frame': int(f0 - 8 + v.reshape(len(v), -1).mean(1).argmax())}
# the lamp on the six arms: for each arm, the frame where it is brightest relative to the other five
lo, hi = 568, 598
v = frames(SILENT, lo, hi)
lum = np.zeros((len(v), 6))
for n in range(len(v)):
    tips = sheet['armTips'][str(lo + n)]
    for arm in range(6):
        (x0, y0), (x1, y1) = tips[arm]
        pts = []
        for u in np.linspace(0, 1, 90):
            cx, cy = x0 + (x1 - x0) * u, y0 + (y1 - y0) * u
            xa, ya = int(round(cx)), int(round(cy))
            if 12 <= xa < 1068 and 12 <= ya < 1068:
                pts.append(np.percentile(v[n, ya - 11:ya + 12, xa - 11:xa + 12], 85))
        lum[n, arm] = np.mean(pts) if pts else 0
rel = lum - lum.mean(1, keepdims=True)
rel -= np.median(rel, axis=0)
rows = []
for c in by('arm'):
    f = c['frame']
    w0, w1 = max(lo, f - 3), min(hi, f + 3)
    peak = w0 + int(rel[w0 - lo:w1 - lo + 1, c['arm']].argmax())
    brightest_arm = int(rel[f - lo].argmax())
    rows.append({'arm': c['arm'] + 1, 'cue_frame': f, 'video_peak_frame': peak, 'difference_frames': peak - f, 'brightest_arm_on_cue_frame': brightest_arm + 1})
picture['arm_flares'] = rows
# the mitten entering: first frame where the lower middle of the picture departs from the valley's own trend
f0 = by('mitten')[0]['frame']
v = frames(SILENT, f0 - 8, f0 + 8)
low = v[:, 960:1080, 200:880].reshape(len(v), -1)
dark = (low < 62).mean(1)                              # share of wool-dark pixels in the bottom strip
steps = np.diff(dark)
base = np.abs(steps[:5]).max() + 0.004
first = next((i + 1 for i, s in enumerate(steps) if s > base), None)
picture['mitten_enters'] = {'cue_frame': f0, 'first_video_frame_with_new_dark_area': None if first is None else int(f0 - 8 + first)}
report['picture'] = picture
report['silent_mp4_sha1'] = hashlib.sha1(open(SILENT, 'rb').read()).hexdigest()

# ---------------------------------------------------------------- pictures of the sound
W, H1, H2 = 2400, 760, 360
run(['ffmpeg', '-v', 'error', '-y', '-i', MP4, '-lavfi', f'[0:a]showspectrumpic=s={W}x{H1}:legend=0:mode=combined:color=magma:scale=log:fscale=log:drange=95:win_func=hann', 'spectrogram.png'])
run(['ffmpeg', '-v', 'error', '-y', '-i', MP4, '-lavfi', f'[0:a]showwavespic=s={W}x{H2}:split_channels=1:colors=0x8fd3ff|0xffc58f:scale=lin', 'waveform.png'])
try:
    font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 17)
except OSError:
    font = ImageFont.load_default()
PAD = 210
canvas = Image.new('RGB', (W, PAD + H1 + 16 + H2 + 26), (14, 16, 22))
spec = Image.open('spectrogram.png').convert('RGB').resize((W, H1))
wave = Image.open('waveform.png').convert('RGBA')
canvas.paste(spec, (0, PAD))
bg = Image.new('RGBA', (W, H2), (20, 24, 34, 255)); bg.alpha_composite(wave.resize((W, H2)))
canvas.paste(bg.convert('RGB'), (0, PAD + H1 + 16))
d = ImageDraw.Draw(canvas)
lanes = [0] * 11
shown = {}
for c in cues:
    if c['id'] in ('sheen',): continue
    shown[c['id']] = shown.get(c['id'], 0) + 1
    x = int(c['frame'] / FPS / 20 * W)
    colour = {'touchdown': (255, 80, 80), 'flash': (255, 230, 120), 'arm': (255, 180, 90), 'band': (110, 190, 255), 'bubble': (150, 255, 190)}.get(c['id'], (235, 235, 245))
    for y in range(PAD, PAD + H1 + 16 + H2, 9):
        d.line([(x, y), (x, y + 3)], fill=colour, width=1)
    if c['id'] in ('arm', 'bubble', 'band', 'glint') and shown[c['id']] > 1: continue
    label = {'arm': 'arm flares x7', 'bubble': 'bubble seals', 'band': 'mist bands', 'glint': 'glints'}.get(c['id'], c['id'])
    label = f"{label} f{c['frame']}"
    wpx = int(d.textlength(label, font=font)) + 8
    xl = min(x, W - wpx)
    lane = next((i for i in range(len(lanes)) if lanes[i] <= xl), len(lanes) - 1)
    lanes[lane] = xl + wpx
    yl = 6 + lane * 18
    d.line([(x, yl + 15), (x, PAD)], fill=(90, 94, 110), width=1)
    d.text((xl + 2, yl), label, fill=colour, font=font)
for s in range(21):
    x = int(s / 20 * (W - 1))
    d.line([(x, PAD + H1 + 16 + H2), (x, PAD + H1 + 16 + H2 + 6)], fill=(200, 200, 210))
    d.text((min(x + 2, W - 30), PAD + H1 + 16 + H2 + 6), f'{s}s', fill=(200, 200, 210), font=font)
canvas.save('sheet_audio.png')

json.dump(report, open('check_report.json', 'w'), indent=2)
for k, v in report.items():
    if k not in ('hits_matched', 'sharp_hits_flux', 'picture', 'transients_outside_intended_clicks'):
        print(f'{k}: {v}')
print('transients outside intended clicks:', len(report['transients_outside_intended_clicks']), report['transients_outside_intended_clicks'][:20])
print('\nmatched filter, each hit inside the encoded MP4:')
for m in matched:
    print(f"  {m['id']:10s} f{m['frame']:<4d} offset {m.get('offset_ms')} ms   r={m['correlation']}")
print('\nsharp hits, template-free onset:')
for o in sharp:
    print(f"  {o['id']:10s} f{o['frame']:<4d} {o['offset_ms']:+6.1f} ms (x{o['strength_over_median']})")
print('\npicture:', json.dumps(picture, indent=1))
