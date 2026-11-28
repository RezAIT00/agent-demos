"""Measure the soundtrack, since nobody here can listen to it.
    python audio/verify.py      ->  audio/verify-report.json, audio/spectrogram.png, audio/waveform.png,
                                    audio/alignment.png
Everything is measured from the finished files: the WAV, and the AAC decoded back out of the final MP4."""
import json, subprocess, pathlib, re, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

A = pathlib.Path(__file__).resolve().parent
ROOT = A.parent
WAV, MP4, SILENT = A / 'slow-light.wav', ROOT / 'slow-light-sound.mp4', ROOT / 'slow-light.mp4'
SR, FPS = 48000, 30
SHEET = json.load(open(A / 'cue-sheet.json'))
PICT = json.load(open(A / 'picture-events.json'))
CUES = json.load(open(A / 'cues.json'))
report = {}

def run(*args):
    return subprocess.run(args, capture_output=True, check=True)
def ffprobe(f):
    return json.loads(run('ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(f)).stdout)
def decode(f):
    raw = run('ffmpeg', '-v', 'error', '-i', str(f), '-map', '0:a', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-').stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
def ebur(f):
    txt = run('ffmpeg', '-hide_banner', '-nostats', '-i', str(f), '-map', '0:a', '-af', 'ebur128=peak=true', '-f', 'null', '-').stderr.decode()
    s = txt[txt.rindex('Summary:'):]
    g = lambda pat: float(re.search(pat, s).group(1))
    return {'integrated_LUFS': g(r'I:\s+(-?[\d.]+) LUFS'), 'LRA_LU': g(r'LRA:\s+(-?[\d.]+) LU'), 'true_peak_dBTP': g(r'Peak:\s+(-?[\d.]+) dBFS')}
db = lambda x: 20 * np.log10(np.maximum(x, 1e-12))

# ── 1. containers and streams ──
pm, ps, pw = ffprobe(MP4), ffprobe(SILENT), ffprobe(WAV)
v = next(s for s in pm['streams'] if s['codec_type'] == 'video'); a = next(s for s in pm['streams'] if s['codec_type'] == 'audio')
w = pw['streams'][0]
md5 = lambda f: run('ffmpeg', '-v', 'error', '-i', str(f), '-map', '0:v', '-c', 'copy', '-f', 'md5', '-').stdout.decode().strip()
with wave.open(str(WAV)) as wf: wav_frames = wf.getnframes()
report['streams'] = {
    'mp4_video': {k: v.get(k) for k in ['codec_name', 'profile', 'width', 'height', 'pix_fmt', 'r_frame_rate', 'nb_frames', 'duration']},
    'mp4_audio': {k: a.get(k) for k in ['codec_name', 'profile', 'sample_rate', 'channels', 'bit_rate', 'duration']},
    'mp4_duration_s': float(pm['format']['duration']), 'mp4_size_bytes': int(pm['format']['size']),
    'wav': {'codec': w['codec_name'], 'sample_rate': int(w['sample_rate']), 'channels': w['channels'], 'samples': wav_frames, 'seconds': wav_frames / SR},
    'video_duration_s': float(ps['format']['duration']),
    'video_stream_untouched': md5(SILENT) == md5(MP4),
}
report['loudness'] = {'wav': ebur(WAV), 'mp4_aac': ebur(MP4)}

# ── 2. is the AAC in the MP4 sample-aligned with the WAV? ──
x, y = decode(WAV), decode(MP4)
m = min(len(x), len(y)); xm, ym = x[:m].mean(1), y[:m].mean(1)
nfft = 1 << 21
xc = np.fft.irfft(np.fft.rfft(ym, nfft) * np.conj(np.fft.rfft(xm, nfft)), nfft)
lags = np.arange(-4800, 4801); lag = int(lags[np.argmax(xc[lags % nfft])])
report['aac_alignment'] = {'decoded_samples': len(y), 'wav_samples': len(x), 'lag_samples': lag, 'correlation_at_lag': float(np.corrcoef(xm[2000:-2000], np.roll(ym, -lag)[2000:-2000])[0, 1])}

# ── 3. clipping, gaps, clicks, fades ──
def health(s):
    mono = s.mean(1)
    win = int(.05 * SR)
    rms = np.array([np.sqrt(np.mean(s[i:i + win] ** 2)) for i in range(int(.05 * SR), int(19.4 * SR) - win, win // 2)])
    return {'sample_peak_dBFS': round(float(db(np.abs(s).max())), 2), 'samples_at_full_scale': int((np.abs(s) >= 0.999).sum()),
            'quietest_50ms_window_dBFS_0.05_to_19.4s': round(float(db(rms.min())), 1),
            'first_sample': float(np.abs(s[0]).max()), 'last_10ms_peak_dBFS': round(float(db(np.abs(s[-480:]).max())), 1),
            'dc_offset': [float(f'{s[:, 0].mean():.2e}'), float(f'{s[:, 1].mean():.2e}')]}
report['health'] = {'wav': health(x), 'mp4_aac': health(y[:len(x)])}
# Stray clicks: 1 ms blocks whose sample-to-sample jerk towers over its neighbourhood, away from any intended transient.
intended = [c['time'] for c in SHEET['cues']] + [d['heard'] for d in SHEET['drips']]
d2 = np.abs(np.diff(x, 2, axis=0)).max(1); blk = 48
b = np.array([d2[i:i + blk].max() for i in range(0, len(d2) - blk, blk)])
stray = []
for i in range(len(b)):
    around = np.concatenate([b[max(0, i - 60):max(0, i - 2)], b[i + 3:i + 61]])
    t = i * blk / SR
    if len(around) and b[i] > 0.02 and b[i] > 7 * np.percentile(around, 90) and not any(-0.012 <= t - u <= 0.16 for u in intended):
        stray.append(round(t, 3))
report['health']['unexplained_clicks_s'] = stray
report['health']['largest_sample_step'] = round(float(np.abs(np.diff(x, axis=0)).max()), 3)

# ── 4. onsets: does each cue start where the cue sheet says? ──
def band(sig, lo, hi):   # zero-phase band-pass, so it cannot shift an onset
    f = np.fft.rfftfreq(len(sig), 1 / SR); S = np.fft.rfft(sig)
    mask = np.clip((f - lo * .9) / (lo * .1), 0, 1) * np.clip((hi * 1.1 - f) / (hi * .1), 0, 1)
    return np.fft.irfft(S * mask, len(sig))
cache = {}
def envelope(src, key, lo, hi):
    if (key, lo, hi) not in cache:
        z = np.abs(band(src[:, 0], lo, hi)) ** 2 + np.abs(band(src[:, 1], lo, hi)) ** 2
        k = int(.004 * SR); cache[(key, lo, hi)] = np.sqrt(np.convolve(z, np.hanning(k) / np.hanning(k).sum(), 'same'))
    return cache[(key, lo, hi)]
def onset(src, key, t, lo, hi, window):
    """Where does the level step up? For every instant near the cue, compare the median level of the 14 ms after
    with the median of the 14 ms before (medians ignore lone spikes), then walk to where that step begins."""
    e = envelope(src, key, lo, hi)
    L = db(e + 1e-7)
    w_, gap = int(.014 * SR), int(.001 * SR)
    ts = np.arange(max(w_ + gap, int((t - window) * SR)), min(len(L) - w_ - gap, int((t + window) * SR)), 24)
    step = np.array([np.median(L[i + gap:i + gap + w_]) - np.median(L[i - gap - w_:i - gap]) for i in ts])
    j = ts[int(np.argmax(step))]
    # inside +-12 ms of that step, the onset is the first sample past a quarter of the climb
    before, after = np.median(L[j - gap - w_:j - gap]), np.median(L[j + gap:j + gap + w_])
    lo_i, hi_i = max(0, j - int(.012 * SR)), min(len(L), j + int(.012 * SR))
    thr = before + 0.25 * (after - before)
    above = L[lo_i:hi_i] > thr
    k = next((lo_i + i for i in range(len(above) - 96) if above[i:i + 96].all()), j)
    return k / SR, float(step.max())
rows = []
for c in SHEET['cues']:
    if 'check' not in c or not c['check']: continue
    lo, hi = c['check']['hz']; win = c['check'].get('window', 0.09)
    tw, jw = onset(x, 'wav', c['time'], lo, hi, win)
    tm, jm = onset(y[:len(x)], 'mp4', c['time'], lo, hi, win)
    rows.append({'cue': c['id'], 'kind': c['kind'], 'cue_time_s': c['time'], 'frame': c.get('frame', int(c['time'] * FPS + 1e-3)),
                 'onset_wav_s': round(tw, 4), 'error_ms': round((tw - c['time']) * 1000, 1), 'onset_mp4_s': round(tm, 4), 'error_mp4_ms': round((tm - c['time']) * 1000, 1), 'rise_dB': round(jw, 1)})
report['onsets'] = rows

# ── 4b. the neon stutter, matched as a whole pattern: in the buzz you HEAR, the tone, and the sign you SEE ──
ST = CUES['neonStutter']
def stutter(a):
    s01 = lambda q: np.clip(q, 0, 1) ** 2 * (3 - 2 * np.clip(q, 0, 1))
    g = sum(s01((a - lo) / ST['edge']) * (1 - s01((a - hi) / ST['edge'])) for lo, hi in ST['gaps'])
    return np.where(a >= 0, 1 - ST['depth'] * g, 0.0)
def fit_audio(src, key, lo, hi, expect):
    e = db(envelope(src, key, lo, hi) + 1e-5)
    a = np.arange(-0.05, 0.53, 0.001); tmpl = np.where(stutter(a) > 0.5, 1.0, 0.0)
    best = max(((np.corrcoef(e[((T0 + a) * SR).astype(int)], tmpl)[0, 1], T0) for T0 in np.arange(expect - 0.15, expect + 0.15, 0.001)))
    return {'fitted_start_s': round(float(best[1]), 3), 'expected_s': round(float(expect), 3), 'error_ms': round(float(best[1] - expect) * 1000, 1), 'correlation': round(float(best[0]), 3)}
def fit_picture(expect):
    series = np.array(PICT['series']['neon']); frames = np.arange(320, 346)
    sub_ = (np.arange(16) + .5) / 16 / 60 - 1 / 120           # the video's own 16 shutter samples
    def model(T0): return np.array([stutter(f / FPS + sub_ - T0).mean() for f in frames])
    best = max(((np.corrcoef(series[frames], model(T0))[0, 1], T0) for T0 in np.arange(expect - 0.15, expect + 0.15, 0.001)))
    return {'fitted_start_s': round(float(best[1]), 3), 'expected_s': round(float(expect), 3), 'error_ms': round(float(best[1] - expect) * 1000, 1), 'correlation': round(float(best[0]), 3)}
buzz_t = next(c for c in SHEET['cues'] if c['id'] == 'neon-on')['time']
see_t = SHEET['seen']['neonCentre']
report['neon_stutter'] = {'buzz_heard_in_mp4_audio': fit_audio(y[:len(x)], 'mp4', 1800, 5000, buzz_t), 'tone_in_mp4_audio': fit_audio(y[:len(x)], 'mp4', 940, 1040, see_t), 'sign_in_mp4_picture': fit_picture(see_t)}
report['neon_stutter']['you_hear_it_this_long_before_you_see_it_s'] = round(report['neon_stutter']['sign_in_mp4_picture']['fitted_start_s'] - report['neon_stutter']['buzz_heard_in_mp4_audio']['fitted_start_s'], 3)

# The neon cut is a sound stopping, which an onset detector measures badly (and a real drip lands 42 ms earlier).
# So: render once with the drips muted (every sound has its own seed, so nothing else changes) and find the cut-off tick.
run('node', str(A / 'synth.mjs'), '--no-drips')
nd = decode(A / '_work' / 'nodrips.wav'); cut = next(c for c in SHEET['cues'] if c['id'] == 'neon-off')['time']
e_nd = envelope(nd, 'nodrips', 1800, 5000); i0, i1 = int((cut - .04) * SR), int((cut + .04) * SR)
pk = i0 + int(np.argmax(e_nd[i0:i1]))
report['neon_cut_without_drips'] = {'tick_peak_s': round(pk / SR, 4), 'cue_s': cut, 'error_ms': round((pk / SR - cut) * 1000, 1), 'above_buzz_dB': round(float(db(e_nd[pk]) - db(np.median(e_nd[int((cut - .15) * SR):int((cut - .015) * SR)]))), 1)}

# ── 4c. does the swell follow the light? level of the chord's band in the finished audio vs the lit region ──
def level_track(sig, lo, hi, step=0.25, win=0.75):
    z = band(sig[:, 0], lo, hi) ** 2 + band(sig[:, 1], lo, hi) ** 2
    ts = np.arange(0, 20.0001, step)
    def span(t):   # a window never reaches across the 2.000 s hit, so nothing appears to rise early
        a, b = max(0, t - win / 2), min(20, t + win / 2)
        return (a, min(b, 2.0)) if t < 2.0 else (max(a, 2.0), b)
    return ts, np.array([10 * np.log10(np.mean(z[int(span(t)[0] * SR):int(span(t)[1] * SR) + 1]) + 1e-12) for t in ts])
frac = np.array(CUES['region']['bulb']['frac'])
sw_t, sw_db = level_track(y[:len(x)], 140, 760)
at = lambda t: float(frac[min(599, int(round(t * 30)))])
use = (sw_t >= 2.75) & (sw_t <= 18.0)
report['swell_follows_light'] = {
    'correlation_chord_band_amplitude_vs_lit_share_2.75_to_18s': round(float(np.corrcoef(10 ** (sw_db[use] / 20), [at(t) for t in sw_t[use]])[0, 1]), 3),
    'level_dB_at_s': {str(t): round(float(sw_db[int(round(t / 0.25))]), 1) for t in [1.0, 2.5, 3.0, 4.0, 5.0, 7.0, 10.0, 13.0, 15.0, 16.0, 17.0, 18.0, 19.0]},
    'lit_share_at_s': {str(t): round(at(t), 2) for t in [1.0, 2.5, 3.0, 4.0, 5.0, 7.0, 10.0, 13.0, 15.0, 16.0, 17.0, 18.0, 19.0]},
}
# momentary loudness over time (BS.1770), for the report
def momentary():
    txt = run('ffmpeg', '-hide_banner', '-nostats', '-i', str(MP4), '-map', '0:a', '-af', 'ebur128=framelog=info', '-f', 'null', '-').stderr.decode()
    return {round(float(a), 1): float(b) for a, b in re.findall(r't:\s*([\d.]+)\s+TARGET.*?M:\s*(-?[\d.]+)', txt)}
mom = momentary()
pick = lambda t: mom[min(mom, key=lambda k: abs(k - t))]
report['momentary_LUFS_at_s'] = {str(t): pick(t) for t in [1.5, 2.5, 3.0, 4.0, 5.0, 7.0, 9.0, 11.0, 13.0, 14.5, 16.0, 17.0, 18.0, 19.0]}

# ── 5. picture against cue sheet ──
pic = []
for c in SHEET['cues']:
    if c['kind'] == 'light' and 'seen' in c:
        name = {'bloom': 'bulbOn', 'mirror-on': 'mirrorOn', 'lantern-tone': 'lanternOn', 'neon-tone': 'neonFirst', 'bulb-dark': 'bulbOff', 'neon-dark': 'neonOff', 'lantern-dark': 'lanternOff', 'mirror-dark': 'mirrorOff'}[c['id']]
        pic.append({'cue': c['id'], 'picture_frame': PICT['events'][name], 'audio_frame': c['frame'], 'audio_time_s': c['time'], 'physics_prediction_frame': SHEET['physicsFrames'][name]})
report['picture_vs_sound'] = pic
leads = {}
for cid in ['click-on', 'click-off', 'gas-on', 'neon-on', 'neon-off', 'gas-off']:
    c = next(c for c in SHEET['cues'] if c['id'] == cid); leads[cid] = {'heard_s': c['time'], 'seen_s': c['seen'], 'sound_leads_picture_by_s': round(c['seen'] - c['time'], 3)}
report['sound_leads_light'] = leads

# ── 6. the two requested images, plus an aligned one for reading cues against the picture ──
run('ffmpeg', '-v', 'error', '-y', '-i', str(WAV), '-lavfi', 'showspectrumpic=s=1800x900:mode=combined:scale=log:fscale=log:start=30:stop=12000:color=intensity:drange=96:legend=1', str(A / 'spectrogram.png'))
run('ffmpeg', '-v', 'error', '-y', '-i', str(WAV), '-filter_complex', 'showwavespic=s=1800x500:split_channels=1:colors=0x7fc8ff|0xffc27f:scale=lin', '-frames:v', '1', str(A / 'waveform.png'))
tmp = A / '_work'; tmp.mkdir(exist_ok=True)
run('ffmpeg', '-v', 'error', '-y', '-i', str(WAV), '-lavfi', 'showspectrumpic=s=1800x620:mode=combined:scale=log:fscale=log:start=30:stop=12000:color=intensity:drange=96:legend=0', str(tmp / 'spec_plain.png'))
spec = Image.open(tmp / 'spec_plain.png').convert('RGB'); wav_img = Image.open(A / 'waveform.png').convert('RGBA')
PW, LW = 1800, 150
H_lab, H_light = 190, 200
canvas = Image.new('RGB', (PW + 20, H_lab + spec.height + 12 + 300 + 12 + H_light + 22), (12, 13, 18))
d = ImageDraw.Draw(canvas)
try: font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 13)
except OSError: font = ImageFont.load_default()
X = lambda t: 10 + t / 20 * PW
y_spec = H_lab; y_wave = y_spec + spec.height + 12; y_light = y_wave + 300 + 12
canvas.paste(spec, (10, y_spec))
wv = wav_img.resize((PW, 300)); base = Image.new('RGBA', wv.size, (22, 24, 32, 255)); base.alpha_composite(wv); canvas.paste(base.convert('RGB'), (10, y_wave))
d.rectangle([10, y_light, 10 + PW, y_light + H_light], fill=(22, 24, 32))
for name, col in [('bulb', (255, 170, 70)), ('lantern', (130, 240, 190)), ('neon', (255, 80, 140))]:
    vals = CUES['region'][name]['frac']
    d.line([(X(i / 30), y_light + H_light - 4 - val * (H_light - 24)) for i, val in enumerate(vals)], fill=col, width=2)
amp = 10 ** (sw_db / 20); amp = amp / np.percentile(amp, 98)
pts = []
for t, a_ in zip(sw_t, amp):
    if abs(t - 2.0) < 1e-6: pts.append((X(2.0), pts[-1][1]))          # a true step at the hit, not a ramp between samples
    pts.append((X(t), y_light + H_light - 4 - min(1.05, a_) * (H_light - 24)))
d.line(pts, fill=(255, 255, 255), width=2)
d.text((16, y_light + 4), "orange / green / pink: what is ON SCREEN (share of the scene inside each lamp's ellipsoid).   white: what you HEAR (amplitude of the chord band, 140-760 Hz)", fill=(220, 220, 225), font=font)
for s in range(21):
    d.text((X(s) + 2, y_light + H_light + 4), f'{s}s', fill=(150, 152, 165), font=font)
big = [c for c in SHEET['cues'] if c['kind'] in ('street', 'light') and not c.get('minor') and c['id'] not in ('filament', 'swell') and not c['id'].startswith('strike')]
short = {'click-on': 'click ON', 'bloom': 'BULB SEEN', 'mirror-on': 'bulb in mirror', 'gas-on': 'gas catches', 'neon-on': 'neon buzz+stutter', 'lantern-tone': 'lamp seen', 'neon-tone': 'neon seen', 'click-off': 'click OFF', 'neon-off': 'buzz cut', 'gas-off': 'gas puff', 'bulb-dark': 'BULB DARK', 'neon-dark': 'neon dark', 'lantern-dark': 'lamp dark', 'mirror-dark': 'mirror dark'}
rows_used = []
for c in big:
    cx = X(c['time']); col = (120, 220, 255) if c['kind'] == 'street' else (255, 235, 160)
    label = f"{short.get(c['id'], c['id'])} f{c.get('frame', int(c['time'] * 30 + 1e-3))}"
    width = d.textlength(label, font=font)
    row = next(r for r in range(12) if all(not (rr == r and cx < end + 8) for rr, end in rows_used))
    rows_used.append((row, cx + width))
    ly = 6 + row * 17
    d.line([(cx, ly + 16), (cx, y_light + H_light)], fill=col, width=1)
    d.text((cx + 2, ly), label, fill=col, font=font)
d.text((14, H_lab - 20), 'blue = sound from the street (343 m/s)      yellow = score, on the first frame the light is seen (5 m/s)      top: spectrogram, middle: waveform (L, R)', fill=(200, 200, 210), font=font)
canvas.save(A / 'alignment.png')

json.dump(report, open(A / 'verify-report.json', 'w'), indent=1)
print(json.dumps({k: report[k] for k in ['loudness', 'aac_alignment', 'neon_cut_without_drips', 'neon_stutter']}, indent=1)); print('unexplained clicks', report['health']['wav'], report['health']['unexplained_clicks_s'])
print('\ncue            kind    frame   cue s   onset(WAV)  err ms   onset(MP4)  err ms   rise dB')
for r in rows:
    print(f"{r['cue']:14s} {r['kind']:6s} {r['frame']:5d} {r['cue_time_s']:8.3f} {r['onset_wav_s']:10.3f} {r['error_ms']:8.1f} {r['onset_mp4_s']:11.3f} {r['error_mp4_ms']:7.1f} {r['rise_dB']:8.1f}")
print('\npicture vs sound (score hits):')
for r in pic: print(f"  {r['cue']:13s} picture frame {r['picture_frame']:3d}   sound frame {r['audio_frame']:3d}   physics said {r['physics_prediction_frame']:3d}")
print('\nstreet sounds lead the light:'); [print(f"  {k:10s} heard {v['heard_s']:7.3f}  seen {v['seen_s']:7.3f}  lead {v['sound_leads_picture_by_s']:.3f} s") for k, v in leads.items()]
