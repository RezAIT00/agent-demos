"""Synthesizes the whole soundtrack (score + sound design) from src/hits.json. numpy only, no samples.

  audio.py [--out soundtrack.wav] [--stems]
Timing: 48 kHz, 2000 samples per picture frame, 144 BPM = 10 frames per beat, beat grid origin at frame 204.
"""
import argparse, json, math, os, wave
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
HITS = json.load(open(os.path.join(ROOT, 'src', 'hits.json'), encoding='utf-8'))
SR = 48000
SPF = 2000
N = 1200 * SPF
H = {h['id']: h for h in HITS['hits'] + HITS['minor']}


def S(frame):
    return int(round(frame * SPF))


def rng(seed):
    return np.random.default_rng(seed)


# ---------------------------------------------------------------- filters (causal biquads applied by FFT)
def _biquad_coeffs(kind, fc, q, gain_db=0.0):
    w = 2 * math.pi * min(max(fc, 10.0), SR * 0.47) / SR
    c, s = math.cos(w), math.sin(w)
    alpha = s / (2 * q)
    A = 10 ** (gain_db / 40)
    if kind == 'lp':
        b = [(1 - c) / 2, 1 - c, (1 - c) / 2]; a = [1 + alpha, -2 * c, 1 - alpha]
    elif kind == 'hp':
        b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]; a = [1 + alpha, -2 * c, 1 - alpha]
    elif kind == 'bp':
        b = [alpha, 0, -alpha]; a = [1 + alpha, -2 * c, 1 - alpha]
    elif kind == 'peak':
        b = [1 + alpha * A, -2 * c, 1 - alpha * A]; a = [1 + alpha / A, -2 * c, 1 - alpha / A]
    elif kind == 'hshelf':
        sq = 2 * math.sqrt(A) * alpha
        b = [A * ((A + 1) + (A - 1) * c + sq), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sq)]
        a = [(A + 1) - (A - 1) * c + sq, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sq]
    else:
        raise ValueError(kind)
    return b, a


def filt(x, *stages):
    """stages: tuples (kind, fc, q[, gain_db])"""
    n = len(x)
    pad = min(max(4096, int(SR * 0.25)), SR)
    L = 1
    while L < n + pad:
        L *= 2
    X = np.fft.rfft(x, L)
    z = np.exp(-1j * np.linspace(0, math.pi, len(X)))
    z2 = z * z
    for st in stages:
        b, a = _biquad_coeffs(*st)
        X *= (b[0] + b[1] * z + b[2] * z2) / (a[0] + a[1] * z + a[2] * z2)
    return np.fft.irfft(X, L)[:n]


def lp(x, fc, q=0.707, n=1):
    return filt(x, *[('lp', fc, q)] * n)


def hp(x, fc, q=0.707, n=1):
    return filt(x, *[('hp', fc, q)] * n)


def bp(x, fc, q=1.0, n=1):
    return filt(x, *[('bp', fc, q)] * n)


def svf_sweep(x, f0, f1, q=2.0, mode='bp', curve=None):
    """time-varying state-variable filter, for whooshes and risers"""
    n = len(x)
    out = np.zeros(n)
    low = band = 0.0
    if curve is None:
        fr = f0 * (f1 / f0) ** (np.arange(n) / max(1, n - 1))
    else:
        fr = curve
    g = 2 * np.sin(np.pi * np.minimum(fr, SR / 6.5) / SR)
    damp = 1.0 / q
    xl = x.tolist(); gl = g.tolist()
    res = [0.0] * n
    for i in range(n):
        low += gl[i] * band
        high = xl[i] - low - damp * band
        band += gl[i] * high
        res[i] = band if mode == 'bp' else (low if mode == 'lp' else high)
    out[:] = res
    return out


# ---------------------------------------------------------------- building blocks
def noise(n, seed):
    return rng(seed).standard_normal(n)


def env_exp(n, tau, attack=0.0005):
    t = np.arange(n) / SR
    e = np.exp(-t / tau)
    a = max(1, int(attack * SR))
    e[:a] *= np.linspace(0, 1, a)
    return e


def fade(x, a=0.004, r=0.01):
    x = x.copy()
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    na, nr = min(na, len(x)), min(nr, len(x))
    x[:na] *= np.linspace(0, 1, na)
    x[-nr:] *= np.linspace(1, 0, nr)
    return x


def sine_sweep(n, f0, f1, tau_f, phase=0.0):
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / tau_f)
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


def saw(freq, n, detune=0.0, phase=0.0):
    """band-limited-ish sawtooth (polyBLEP)"""
    f = freq * (2 ** (detune / 1200))
    if np.isscalar(f):
        f = np.full(n, f)
    dt = f / SR
    ph = (np.cumsum(dt) + phase) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    t = ph[m] / dt[m]
    y[m] -= t + t - t * t - 1
    m = ph > 1 - dt
    t = (ph[m] - 1) / dt[m]
    y[m] -= t * t + t + t + 1
    return y


def note(m):
    return 440.0 * 2 ** ((m - 69) / 12)


class Bus:
    def __init__(self):
        self.a = np.zeros((2, N))

    def add(self, x, at, gain=1.0, pan=0.0):
        """at in samples; pan -1..1. x mono or (2, n)"""
        at = int(at)
        if x.ndim == 1:
            l = math.cos((pan + 1) * math.pi / 4) * math.sqrt(2)
            r = math.sin((pan + 1) * math.pi / 4) * math.sqrt(2)
            st = np.stack([x * l, x * r])
        else:
            st = x
        n = st.shape[1]
        s = max(0, -at)
        e = min(n, N - at)
        if e > s:
            self.a[:, at + s:at + e] += st[:, s:e] * gain


def reverb(stereo, seconds=1.8, decay=0.55, wet=0.25, seed=3, lpf=5200, pre=0.012):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(stereo)
    L = 1
    while L < stereo.shape[1] + n:
        L *= 2
    for ch in range(2):
        ir = noise(n, seed + ch) * np.exp(-t / decay)
        ir = lp(ir, lpf)
        ir = hp(ir, 140)
        ir[:int(pre * SR)] = 0
        ir /= math.sqrt(np.sum(ir * ir)) + 1e-9
        y = np.fft.irfft(np.fft.rfft(stereo[ch], L) * np.fft.rfft(ir, L), L)[:stereo.shape[1]]
        out[ch] = y
    return stereo + out * wet


# ---------------------------------------------------------------- instruments
def kick(vel=1.0, long=False):
    n = int(SR * (0.42 if long else 0.30))
    body = sine_sweep(n, 165, 47, 0.028) * env_exp(n, 0.13 if long else 0.09, 0.001)
    click = hp(noise(n, 11), 3200) * env_exp(n, 0.004) * 0.35
    return np.tanh((body * 1.5 + click) * 1.4) * 0.85 * vel


def snare(vel=1.0, seed=21):
    n = int(SR * 0.32)
    tone = (sine_sweep(n, 330, 185, 0.012) * env_exp(n, 0.06) + 0.5 * sine_sweep(n, 480, 330, 0.01) * env_exp(n, 0.03))
    nz = filt(noise(n, seed), ('hp', 1100, 0.7), ('lp', 8500, 0.7), ('peak', 3800, 1.0, 4)) * env_exp(n, 0.095)
    return np.tanh((tone * 0.9 + nz * 0.75) * 1.5) * 0.7 * vel


def hat(vel=1.0, opened=False, seed=31):
    n = int(SR * (0.28 if opened else 0.06))
    x = np.zeros(n)
    t = np.arange(n) / SR
    for f in (3150, 4270, 5480, 6620, 8230, 9940):
        x += np.sign(np.sin(2 * np.pi * f * t))
    x = hp(x * 0.2 + noise(n, seed) * 0.8, 7200, n=2)
    return x * env_exp(n, 0.09 if opened else 0.014) * 0.22 * vel


def crash(vel=1.0, seed=41, length=2.2):
    n = int(SR * length)
    x = noise(n, seed)
    t = np.arange(n) / SR
    for f in (412, 587, 791, 1133, 1687, 2459):
        x += 0.25 * np.sign(np.sin(2 * np.pi * f * 1.37 * t))
    x = filt(x, ('hp', 2600, 0.7), ('peak', 6200, 0.8, 4))
    return x * env_exp(n, length * 0.30, 0.002) * 0.22 * vel


def taiko(vel=1.0, pitch=70, seed=51):
    n = int(SR * 0.9)
    body = sine_sweep(n, pitch * 2.1, pitch, 0.03) * env_exp(n, 0.22, 0.002)
    ring = sine_sweep(n, pitch * 3.4, pitch * 1.62, 0.02) * env_exp(n, 0.09) * 0.45
    skin = bp(noise(n, seed), 380, 0.8) * env_exp(n, 0.03) * 1.2
    return np.tanh((body + ring + skin) * 1.3) * 0.8 * vel


def ks_string(freq, dur, seed, bright=0.5, damp=0.996):
    """Karplus-Strong, advanced one period at a time"""
    n = int(dur * SR)
    P = max(2, int(round(SR / freq)))
    buf = rng(seed).uniform(-1, 1, P)
    buf = buf * bright + np.convolve(buf, np.ones(5) / 5, 'same') * (1 - bright)
    out = np.zeros(n + P)
    out[:P] = buf
    pos = P
    prev_last = buf[-1]
    while pos < n:
        last = out[pos - P:pos]
        shifted = np.empty(P)
        shifted[1:] = last[:-1]
        shifted[0] = prev_last
        prev_last = last[-1]
        out[pos:pos + P] = damp * (0.5 * last + 0.5 * shifted)
        pos += P
    return out[:n]


def guitar(root_midi, dur, mute=True, seed=0, drive=9.0):
    """double-tracked distorted power chord: root, fifth, octave"""
    chans = []
    for side in range(2):
        x = 0
        for i, semi in enumerate((0, 7, 12)):
            f = note(root_midi + semi) * (1 + (side - 0.5) * 0.004 + i * 0.0006)
            x = x + ks_string(f, dur, seed * 7 + i + side * 31, bright=0.75, damp=0.985 if mute else 0.9975) * (1.0 - i * 0.18)
        n = len(x)
        if mute:
            x = x * env_exp(n, 0.075, 0.001) * 1.4
        x = np.tanh(hp(x, 110) * drive)
        x = np.tanh(x * 2.2 + 0.12) - math.tanh(0.12)
        x = filt(x, ('hp', 85, 0.7), ('peak', 420, 0.9, -4), ('peak', 1500, 1.1, 3), ('lp', 4600, 0.8), ('lp', 5600, 0.7))
        chans.append(fade(x, 0.001, 0.012))
    return np.stack(chans) * 0.34


def bass(midi, dur, seed=0):
    n = int(dur * SR)
    f = note(midi)
    t = np.arange(n) / SR
    x = saw(f, n) * 0.6 + np.sin(2 * np.pi * f * t) * 0.9 + saw(f * 2.002, n) * 0.18
    x = lp(x, 620, 0.9, 2)
    x = np.tanh(x * 2.4)
    return fade(x, 0.003, 0.02) * 0.46


def strings(midis, dur, attack=0.12, release=0.25, bright=2600, trem=0.0, seed=0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    r = rng(900 + seed)
    for m in midis:
        for k in range(5):
            vib = 1 + 0.0035 * np.sin(2 * np.pi * (5.2 + r.random()) * t + r.random() * 6) * np.minimum(1, t / 0.3)
            x = saw(note(m) * vib, n, detune=(k - 2) * 7 + r.uniform(-3, 3), phase=r.random())
            pan = (k - 2) / 2.4
            out[0] += x * (1 - pan) * 0.5
            out[1] += x * (1 + pan) * 0.5
    for ch in range(2):
        out[ch] = filt(out[ch], ('lp', bright, 0.7), ('hp', 120, 0.7), ('peak', 700, 0.8, 2))
    if trem > 0:
        out *= 1 - trem * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 14.4 * t)) * 0.8)
    e = np.minimum(1, t / max(attack, 1e-3)) * np.minimum(1, (dur - t) / max(release, 1e-3)).clip(0, 1)
    return out * e * 0.075 / math.sqrt(len(midis))


def brass(midis, dur, seed=0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    r = rng(300 + seed)
    for m in midis:
        for k in range(3):
            scoop = 1 - 0.012 * np.exp(-t / 0.035)
            x += saw(note(m) * scoop, n, detune=(k - 1) * 9, phase=r.random())
    cutoff = 400 + 3800 * np.minimum(1, t / 0.045) * np.exp(-t / (dur * 0.8))
    x = svf_sweep(x / len(midis), 1, 1, q=1.1, mode='lp', curve=cutoff)
    x = np.tanh(x * 1.8)
    e = np.minimum(1, t / 0.018) * np.minimum(1, (dur - t) / 0.08).clip(0, 1)
    return x * e * 0.30


def choir(midis, dur, vowel='ah', attack=0.6, release=0.6, seed=0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = rng(500 + seed)
    out = np.zeros((2, n))
    for m in midis:
        for k in range(6):
            vib = 1 + 0.006 * np.sin(2 * np.pi * (4.6 + r.random() * 1.2) * t + r.random() * 6)
            x = saw(note(m) * vib, n, detune=r.uniform(-14, 14), phase=r.random())
            out[k % 2] += x
    form = {'ah': [(730, 6, 1.0), (1090, 8, 0.6), (2440, 12, 0.22)], 'oo': [(340, 6, 1.0), (870, 8, 0.35), (2240, 12, 0.08)]}[vowel]
    res = np.zeros_like(out)
    for ch in range(2):
        for f, q, g in form:
            res[ch] += bp(out[ch], f, q) * g
    e = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / release).clip(0, 1)
    return res * e * 0.16 / math.sqrt(len(midis))


def bell(midi, dur=2.2, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = note(midi)
    x = np.zeros(n)
    for ratio, amp, tau in ((1, 1.0, 0.9), (2.0, 0.45, 0.55), (3.01, 0.22, 0.35), (4.17, 0.14, 0.22), (6.8, 0.06, 0.1)):
        x += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / tau)
    return fade(x, 0.002, 0.05) * 0.16 * vel


# ---------------------------------------------------------------- sound design
def crack(vel, seed, colour=1.0):
    """the sync anchor: a click and a very short bright burst starting exactly on its first sample"""
    n = int(SR * 0.09)
    x = hp(noise(n, seed), 1900, n=2) * env_exp(n, 0.006, 0.0002) * 1.7
    snap = bp(noise(n, seed + 1), 3400 * colour, 1.1) * env_exp(n, 0.022, 0.0003) * 1.6
    mid = bp(noise(n, seed + 2), 900 * colour, 0.9) * env_exp(n, 0.016, 0.0003) * 1.2
    x = x + snap + mid
    x[0:24] += np.linspace(1.4, 0, 24)
    return np.tanh(x * 1.5) * vel


def thump(vel, scale, f0=125, f1=40):
    tau = 0.10 + 0.035 * scale
    n = int(SR * min(2.2, tau * 5))
    x = sine_sweep(n, f0, f1, 0.035) * env_exp(n, tau, 0.0008)
    x += 0.35 * sine_sweep(n, f0 * 2.1, f1 * 2, 0.02) * env_exp(n, tau * 0.4, 0.0008)
    return np.tanh(x * 1.9) * vel


def bass_drop(vel, dur, f0=150, f1=26):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (dur * 0.22))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    x = np.tanh(x * 2.2) * 0.75 + np.sin(4 * np.pi * np.cumsum(f) / SR) * 0.10
    e = np.minimum(1, t / 0.012) * (1 - t / dur).clip(0, 1) ** 1.3
    return x * e * vel


def crunch(vel, dur, lo, hi, seed, grain=160):
    """stone and masonry: band noise whose loudness is broken into grains"""
    n = int(SR * dur)
    r = rng(seed)
    x = filt(r.standard_normal(n), ('hp', lo, 0.7), ('lp', hi, 0.7))
    g = np.zeros(n)
    count = int(grain * dur)
    at = (r.random(count) ** 1.6 * n).astype(int)
    for a in at:
        L = int(r.uniform(0.004, 0.03) * SR)
        e = min(n, a + L)
        g[a:e] += np.exp(-np.arange(e - a) / (L * 0.35)) * r.uniform(0.2, 1.0)
    g = np.minimum(g, 2.0) + 0.25
    return np.tanh(x * g * env_exp(n, dur * 0.28, 0.001) * 1.4) * vel


def glass(vel, dur, seed, count=110):
    n = int(SR * dur)
    r = rng(seed)
    out = np.zeros((2, n))
    for i in range(count):
        a = int((r.random() ** 2.2) * n * 0.75) if i > 6 else i * 40
        L = min(n - a, int(r.uniform(0.02, 0.22) * SR))
        if L <= 10:
            continue
        t = np.arange(L) / SR
        f = r.uniform(2300, 9800)
        ping = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * r.uniform(1.4, 2.3) * t)
        ping *= np.exp(-t / r.uniform(0.008, 0.06)) * r.uniform(0.15, 1.0)
        ping[:24] *= np.linspace(0, 1, min(24, L))[:len(ping[:24])]
        p = r.uniform(-0.9, 0.9)
        out[0, a:a + L] += ping * (1 - p) * 0.5
        out[1, a:a + L] += ping * (1 + p) * 0.5
    burst = hp(noise(n, seed + 5), 4200) * env_exp(n, 0.05) * 0.8
    out += burst
    return out * vel * 0.42


def metal(vel, dur, base, seed, dec=0.5):
    n = int(SR * dur)
    t = np.arange(n) / SR
    r = rng(seed)
    x = np.zeros(n)
    for ratio in (1.0, 1.47, 2.09, 2.76, 3.9, 5.4, 6.8, 8.93):
        f = base * ratio * r.uniform(0.985, 1.015)
        x += np.sin(2 * np.pi * f * t + r.random() * 6) * np.exp(-t / (dec / ratio ** 0.45)) / ratio ** 0.35
    x += bp(noise(n, seed + 1), base * 6, 1.0) * np.exp(-t / 0.05) * 2
    return fade(np.tanh(x * 0.8), 0.0005, 0.03) * vel


def air_boom(vel, dur, seed, fc=260):
    n = int(SR * dur)
    x = lp(noise(n, seed), fc, 0.8, 2) * 5
    t = np.arange(n) / SR
    e = np.minimum(1, t / 0.006) * np.exp(-t / (dur * 0.3))
    return np.tanh(x * e * 1.6) * vel


def wet_slap(vel, seed, dark=True):
    n = int(SR * 0.34)
    r = rng(seed)
    x = filt(r.standard_normal(n), ('lp', 1700 if dark else 5200, 0.8), ('hp', 160 if dark else 500, 0.7))
    t = np.arange(n) / SR
    flut = 0.55 + 0.45 * np.sin(2 * np.pi * (38 * np.exp(-t / 0.15) + 12) * t)
    x *= flut * env_exp(n, 0.075, 0.0008)
    for i in range(14):
        a = int(r.uniform(0.02, 0.26) * SR)
        L = int(0.012 * SR)
        tt = np.arange(L) / SR
        f = r.uniform(500, 1600) if dark else r.uniform(1200, 3400)
        x[a:a + L] += np.sin(2 * np.pi * (f * tt + f * 9 * tt * tt)) * np.exp(-tt / 0.004) * 0.35
    return np.tanh(x * 1.8) * vel


def debris(vel, dur, seed, density=70, lo=500, hi=6000, rumble=0.5):
    n = int(SR * dur)
    r = rng(seed)
    out = np.zeros((2, n))
    count = int(density * dur)
    for i in range(count):
        a = int((r.random() ** 1.9) * (n - SR * 0.07))
        L = int(r.uniform(0.006, 0.055) * SR)
        f = r.uniform(lo, hi) if r.random() > 0.3 else r.uniform(120, 600)
        t = np.arange(L) / SR
        knock = (np.sin(2 * np.pi * f * t) * 0.6 + r.standard_normal(L) * 0.45) * np.exp(-t / (L / SR * 0.28))
        knock[:12] *= np.linspace(0, 1, 12)
        amp = r.uniform(0.1, 1.0) ** 1.7 * math.exp(-a / (n * 0.45))
        p = r.uniform(-1, 1)
        out[0, a:a + L] += knock * amp * (1 - p) * 0.5
        out[1, a:a + L] += knock * amp * (1 + p) * 0.5
    t = np.arange(n) / SR
    low = lp(noise(n, seed + 9), 130, 0.8, 2) * 6 * np.exp(-t / (dur * 0.34)) * np.minimum(1, t / 0.04)
    out += low * rumble
    return out * vel * 0.55


def whoosh(dur, f0, f1, seed, vel=1.0, peak=0.7, q=1.4):
    n = int(SR * dur)
    x = svf_sweep(noise(n, seed), f0, f1, q=q)
    u = np.linspace(0, 1, n)
    e = np.where(u < peak, (u / peak) ** 2.2, ((1 - u) / (1 - peak)).clip(0, 1) ** 1.6)
    return fade(x * e, 0.002, 0.005) * vel * 0.55


def suck(dur, seed, vel=1.0):
    """reverse inhale that stops dead just before contact"""
    n = int(SR * dur)
    x = svf_sweep(noise(n, seed), 260, 5200, q=1.8)
    u = np.linspace(0, 1, n)
    return fade(x * u ** 3.2, 0.001, 0.004) * vel * 0.5


def riser(dur, f0, f1, seed, vel=1.0):
    n = int(SR * dur)
    u = np.linspace(0, 1, n)
    nz = svf_sweep(noise(n, seed), 300, 7000, q=2.2) * 0.5
    f = f0 * (f1 / f0) ** (u ** 1.5)
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = (np.sin(ph) + 0.5 * np.sin(ph * 1.503) + 0.35 * np.sin(ph * 2.01)) * (0.7 + 0.3 * np.sin(2 * np.pi * np.cumsum(5 + 20 * u ** 2) / SR))
    return fade((nz + tone * 0.35) * u ** 2.0, 0.01, 0.004) * vel * 0.45


def splash_drop(vel=1.0, seed=1):
    n = int(SR * 0.5)
    t = np.arange(n) / SR
    plink = np.sin(2 * np.pi * np.cumsum(1250 + 1700 * np.minimum(1, t / 0.035)) / SR) * np.exp(-t / 0.055)
    plink[:48] *= np.linspace(0, 1, 48)
    return plink * vel * 0.5


def breath(dur, seed, f0, f1, vel):
    n = int(SR * dur)
    u = np.linspace(0, 1, n)
    x = svf_sweep(noise(n, seed), f0, f1, q=1.3)
    x = lp(x, 4200)
    return fade(x * np.sin(np.pi * u) ** 1.4, 0.02, 0.05) * vel


# ---------------------------------------------------------------- impacts
def build_impacts(hitbus, tail):
    """every contact: crack (the sync anchor) + sub + body + debris, plus a drop for the big ones"""
    def put(x, f, g=1.0, pan=0.0, bus=None):
        (bus or hitbus).add(x, S(f), g, pan)

    def core(hid, level=1.0, pan=0.0, colour=1.0, drop=False, droplen=1.0):
        h = H[hid]; f = h['f']; sc = h['scale']; sd = sum(map(ord, hid)) * 13 + int(f)
        k = (0.36 + 0.064 * sc) * level
        put(crack(1.0, sd, colour), f, k * 1.02, pan)
        put(thump(1.0, sc, 135 - sc * 3, 44 - sc * 0.8), f, k * 1.10)
        if drop:
            put(bass_drop(1.0, droplen), f, k * 0.92)
        return k, sd

    def pre(hid, dur=0.28, vel=0.5, gap=1.0):
        f = H[hid]['f']
        x = suck(dur, int(f) + 7, vel)
        hitbus.add(x, S(f - gap) - len(x), 1.0)

    # H1: a drop that lands like a bomb
    k, sd = core('H1', 0.9, drop=True, droplen=1.2, colour=1.35)
    put(splash_drop(1.0), 18, 0.8)
    put(wet_slap(1.0, sd, dark=False), 18, 0.55)
    put(air_boom(1.0, 0.9, sd + 2, 190), 18, 0.35, bus=tail)
    put(splash_drop(0.25, 2), 25, 0.8, 0.4, bus=tail); put(splash_drop(0.18, 3), 29, 0.8, -0.5, bus=tail)
    # H2: the stomp
    k, sd = core('H2', 1.0, drop=True, droplen=0.9, colour=0.8)
    put(crunch(1.0, 0.45, 180, 2600, sd), 54, k * 0.9)
    put(wet_slap(1.0, sd + 1), 54, k * 1.0)
    put(debris(1.0, 1.4, sd + 2, 55), 55, k * 0.75, bus=tail)
    # H3: first clash
    k, sd = core('H3', 1.12, drop=True, droplen=2.0)
    put(glass(1.0, 2.2, sd, 260), 204.6, k * 0.78)
    put(air_boom(1.0, 1.6, sd + 1, 300), 204, k * 0.85)
    put(crunch(1.0, 0.8, 120, 3600, sd + 2), 204, k * 0.65)
    put(metal(1.0, 1.4, 196, sd + 3, 0.7), 204, k * 0.22)
    put(crack(1.0, sd + 4, 0.7), 212, k * 0.75)           # the release
    put(thump(1.0, 6, 100, 34), 212, k * 0.85)
    put(debris(1.0, 3.2, sd + 5, 110), 213, k * 0.8, bus=tail)
    put(glass(1.0, 1.8, sd + 6, 120), 215, k * 0.4, bus=tail)
    pre('H3', 0.30, 0.45, 5.0)
    # flurry
    for hid, pan, col in (('m1', -0.12, 1.25), ('m2', 0.14, 0.8), ('m3', -0.05, 1.3), ('m4', 0.12, 0.75)):
        k, sd = core(hid, 0.92, pan, col)
        if H[hid]['owner'] == 'sumi':
            put(wet_slap(1.0, sd), H[hid]['f'], k * 0.55, pan)
        else:
            put(bp(noise(int(SR * 0.12), sd), 1500, 1.2) * env_exp(int(SR * 0.12), 0.03), H[hid]['f'], k * 0.9, pan)
        put(debris(1.0, 0.5, sd + 3, 45, 800, 7000, 0.2), H[hid]['f'] + 1, k * 0.4, pan, bus=tail)
    # H4 + obelisk
    k, sd = core('H4', 1.12, 0.1, 1.15, drop=True, droplen=0.7)
    put(air_boom(1.0, 0.5, sd + 7, 340), 284, k * 0.55)
    put(crunch(1.0, 0.35, 300, 4200, sd), 284, k * 0.7)
    k2, sd2 = core('s1', 1.0, 0.45, 0.85)
    put(crunch(1.0, 0.9, 140, 3000, sd2), 292, k2 * 1.0, 0.45)
    put(debris(1.0, 2.0, sd2 + 1, 85, 400, 4500, 0.7), 293, k2 * 0.9, 0.4, bus=tail)
    # H5 + brick wall
    pre('H5', 0.42, 0.65, 1.2)
    k, sd = core('H5', 1.05, 0.0, 0.72, drop=True, droplen=0.8)
    put(wet_slap(1.0, sd), 334, k * 1.0)
    put(air_boom(1.0, 0.6, sd + 1, 420), 334, k * 0.6)
    k2, sd2 = core('s2', 1.05, -0.55, 0.9)
    put(crunch(1.0, 0.95, 160, 4200, sd2, 240), 342, k2 * 1.15, -0.5)
    put(debris(1.0, 2.2, sd2 + 1, 120, 600, 5000, 0.6), 343, k2 * 0.95, -0.45, bus=tail)
    put(crunch(1.0, 0.5, 200, 3600, sd2 + 3, 260), 345, k2 * 0.7, -0.5)
    put(thump(1.0, 4, 95, 36), 349, k2 * 0.7, -0.5)
    put(crunch(1.0, 0.5, 90, 1400, sd2 + 2), 349, k2 * 0.55, -0.6)
    # H6 + storefront + wall
    pre('H6', 0.35, 0.6, 1.2)
    k, sd = core('H6', 1.08, -0.1, 1.2, drop=True, droplen=1.0)
    put(whoosh(0.22, 900, 6800, sd, 1.0, 0.15), 404, k * 0.8)
    k2, sd2 = core('s3', 1.0, 0.35, 1.1)
    put(glass(1.0, 1.9, sd2, 230), 414, k2 * 0.95, 0.0)
    put(crunch(1.0, 0.6, 180, 3500, sd2 + 1), 414, k2 * 0.7, 0.35)
    k3, sd3 = core('s4', 1.0, 0.55, 0.85)
    put(crunch(1.0, 0.9, 150, 3600, sd3, 220), 424, k3 * 1.05, 0.55)
    put(debris(1.0, 2.2, sd3 + 1, 110), 425, k3 * 0.85, 0.5, bus=tail)
    put(crunch(1.0, 0.5, 400, 3000, sd3 + 4, 300), 440, 0.4, 0.4, bus=tail)
    # H7: the street opens
    pre('H7', 0.40, 0.6, 5.0)
    k, sd = core('H7', 1.12, 0.1, 0.7, drop=True, droplen=1.6)
    put(metal(1.0, 1.2, 92, sd, 0.6), 474, k * 0.42)
    put(crunch(1.0, 1.4, 70, 1900, sd + 1, 150), 474, k * 1.0)
    put(debris(1.0, 2.6, sd + 2, 90, 300, 3500, 1.5), 475, k * 1.0, 0.2, bus=tail)
    for i in range(9):
        put(thump(1.0, 3, 85, 34), 478 + i * 2.4, 0.42 * (1 - i / 12), -0.4 + i * 0.12, bus=tail)
        put(crunch(1.0, 0.3, 100, 2200, sd + 20 + i), 478 + i * 2.4, 0.34 * (1 - i / 14), -0.4 + i * 0.12, bus=tail)
    # H8 and the wreckage
    pre('H8', 0.30, 0.6, 1.2)
    k, sd = core('H8', 1.10, 0.0, 1.1, drop=True, droplen=1.0)
    put(air_boom(1.0, 0.5, sd, 380), 544, k * 0.5)
    k2, sd2 = core('s5', 1.0, 0.25, 1.0)
    put(metal(1.0, 1.1, 233, sd2, 0.45), 550, k2 * 0.65, 0.25)
    put(glass(1.0, 1.0, sd2 + 1, 120), 550, k2 * 0.65)
    put(crunch(1.0, 0.45, 300, 3000, sd2 + 2), 550, k2 * 0.7, 0.25)
    k3, sd3 = core('s6', 1.0, 0.35, 1.3)
    put(metal(1.0, 1.4, 415, sd3, 0.8), 556, k3 * 0.55, 0.35)
    put(metal(1.0, 1.2, 349, sd3 + 3, 0.7), 559, k3 * 0.42, 0.55)
    k4, sd4 = core('s7', 1.12, 0.15, 0.75, drop=True, droplen=1.2)
    put(crunch(1.0, 1.2, 90, 2800, sd4, 200), 564, k4 * 1.05, 0.15)
    put(glass(1.0, 1.8, sd4 + 1, 170), 565, k4 * 0.6)
    put(debris(1.0, 2.4, sd4 + 2, 100, 400, 4200, 1.0), 566, k4 * 0.85, 0.2, bus=tail)
    # the catch
    k, sd = core('c1', 1.0, 0.1, 0.9)
    put(bp(noise(int(SR * 0.16), sd), 700, 1.4) * env_exp(int(SR * 0.16), 0.035), 598, k * 1.6, 0.1)
    # H9 through the tower
    pre('H9', 0.24, 0.5, 1.2)
    k, sd = core('H9', 1.22, -0.05, 0.85, drop=True, droplen=1.5)
    put(air_boom(1.0, 0.8, sd + 8, 330), 624, k * 0.6)
    put(crunch(1.0, 1.1, 130, 3800, sd, 240), 624, k * 1.05)
    put(glass(1.0, 1.7, sd + 1, 200), 624.5, k * 0.7)
    put(debris(1.0, 1.8, sd + 2, 90), 630, k * 0.6, bus=tail)
    k2, sd2 = core('s8', 1.0, 0.45, 1.0)
    put(crunch(1.0, 0.8, 200, 4200, sd2, 200), 636, k2 * 0.9, 0.45)
    put(glass(1.0, 1.4, sd2 + 1, 120), 636, k2 * 0.55, 0.0)
    # the slice: one clean thin sound, then nothing
    k3, sd3 = core('x1', 0.80, 0.1, 1.7)
    n = int(SR * 1.1); t = np.arange(n) / SR
    shing = (np.sin(2 * np.pi * np.cumsum(3900 + 900 * np.exp(-t / 0.05)) / SR) + 0.5 * np.sin(2 * np.pi * 6230 * t)) * np.exp(-t / 0.30)
    put(fade(shing, 0.001, 0.05), 652, 0.20)
    put(whoosh(0.18, 7000, 1500, sd3, 1.0, 0.08, 2.5), 652, 0.7)
    # steel groan as the top slides, then it lands
    n = int(SR * 1.65); t = np.arange(n) / SR
    base = 62 + 16 * np.sin(2 * np.pi * 0.9 * t) + 26 * (t / 1.65) ** 2
    ph = 2 * np.pi * np.cumsum(base) / SR
    groan = np.sin(ph + 3.4 * np.sin(ph * 2.71) * (0.5 + 0.5 * np.sin(2 * np.pi * 2.2 * t))) + 0.5 * np.sin(ph * 4.07 + np.sin(ph))
    groan = filt(np.tanh(groan * 2), ('lp', 1600, 0.8), ('peak', 420, 3.0, 8)) * np.minimum(1, t / 0.25) * np.minimum(1, (1.65 - t) / 0.2)
    put(groan, 657, 0.30, 0.15, bus=tail)
    put(debris(1.0, 1.7, 6571, 55, 700, 5000, 0.8), 660, 0.6, 0.2, bus=tail)
    k4, sd4 = core('x2', 1.0, 0.45, 0.65, drop=True, droplen=1.1)
    put(crunch(1.0, 1.3, 60, 1500, sd4, 140), 692, k4 * 0.85, 0.4)
    put(debris(1.0, 2.2, sd4 + 1, 70, 300, 2800, 1.4), 693, k4 * 0.7, 0.3, bus=tail)
    # H10: sky clash
    pre('H10', 0.32, 0.6, 5.0)
    k, sd = core('H10', 1.14, 0.0, 1.0, drop=True, droplen=2.0)
    put(air_boom(1.0, 2.0, sd, 520), 704, k * 1.05)
    put(glass(1.0, 0.9, sd + 1, 80), 704, k * 0.35)
    put(crack(1.0, sd + 2, 0.7), 710, k * 0.7); put(thump(1.0, 7, 90, 32), 710, k * 0.8)
    # rolling thunder
    n = int(SR * 2.3); t = np.arange(n) / SR
    thunder = lp(noise(n, sd + 3), 190, 0.8, 2) * 7 * np.exp(-t / 0.9) * (0.65 + 0.35 * np.sin(2 * np.pi * 5.3 * t) * np.sin(2 * np.pi * 1.7 * t + 1))
    put(np.tanh(thunder), 712, k * 0.55, bus=tail)
    # H11: the axe heel
    pre('H11', 0.36, 0.65, 3.0)
    k, sd = core('H11', 1.14, 0.0, 1.05, drop=True, droplen=1.1)
    put(glass(1.0, 1.0, sd, 130), 764, k * 0.7)
    put(air_boom(1.0, 0.8, sd + 1, 600), 764, k * 0.6)
    n = int(SR * 1.2); t = np.arange(n) / SR   # falling doppler
    dop = svf_sweep(noise(n, sd + 2), 1, 1, q=3.0, curve=2600 * np.exp(-t / 0.75) + 180) * np.minimum(1, t / 0.5) ** 1.5 * np.where(t < 1.14, 1.0, 0.0)
    put(fade(dop, 0.01, 0.02), 764 + 5, 0.50, bus=tail)
    # H12: the ground
    k, sd = core('H12', 1.20, 0.0, 0.65, drop=True, droplen=2.4)
    put(crunch(1.0, 1.0, 55, 2400, sd, 220), 794, k * 1.05)
    put(air_boom(1.0, 1.4, sd + 1, 240), 794, k * 0.8)
    put(metal(1.0, 1.6, 73, sd + 2, 0.9), 794, k * 0.28)
    put(crack(1.0, sd + 3, 0.55), 802, k * 1.05); put(thump(1.0, 10, 110, 28), 802, k * 1.15)
    put(bass_drop(1.0, 1.9, 95, 24), 802, k * 0.75)
    put(crunch(1.0, 2.4, 45, 3200, sd + 4, 200), 802, k * 0.95)
    put(glass(1.0, 2.0, sd + 5, 150), 807, k * 0.4)
    put(debris(1.0, 4.4, sd + 6, 120, 250, 4000, 1.8), 804, k * 0.95, bus=tail)
    for i, ff in enumerate((836, 842, 846)):            # the other towers landing, in the order they fall
        put(crunch(1.0, 1.0, 50, 900, sd + 30 + i), ff, 0.40, (-1, 1, -0.5)[i], bus=tail)
    k2, sd2 = core('x3', 0.85, -0.3, 0.6)
    put(debris(1.0, 2.0, sd2, 70, 200, 2500, 1.2), 833, 0.5, bus=tail)
    # H13: the last hit. Everything, after near silence.
    k, sd = core('H13', 1.58, 0.0, 0.9, drop=True, droplen=3.4)
    put(metal(1.0, 2.2, 110, sd, 1.2), 1084, k * 0.34)
    put(glass(1.0, 2.2, sd + 1, 260), 1084, k * 0.72)
    put(air_boom(1.0, 1.6, sd + 2, 420), 1084, k * 0.95)
    put(crunch(1.0, 1.1, 80, 4200, sd + 3, 260), 1084, k * 0.85)
    put(wet_slap(1.0, sd + 4), 1084, k * 0.7)
    # the detonation
    put(crack(1.0, sd + 5, 0.5), 1092, k * 1.12); put(thump(1.0, 10, 120, 24), 1092, k * 1.25)
    put(bass_drop(1.0, 3.0, 120, 22), 1092, k * 1.0)
    put(air_boom(1.0, 3.2, sd + 6, 700), 1092, k * 1.05)
    put(crunch(1.0, 3.0, 40, 5200, sd + 7, 220), 1092, k * 0.9)
    put(glass(1.0, 3.0, sd + 8, 320), 1093, k * 0.55)
    put(debris(1.0, 4.4, sd + 9, 160, 250, 5200, 1.9), 1094, k * 0.9, bus=tail)
    # a second and third wave as the skyline goes
    for i, (ff, g) in enumerate(((1096, 0.80), (1101, 0.70), (1107, 0.58), (1114, 0.42))):
        put(thump(1.0, 10, 88 - i * 8, 24), ff, k * g * 0.85, (-0.5, 0.5, -0.25, 0.25)[i])
        put(crunch(1.0, 1.6, 45, 2600 - i * 300, sd + 40 + i, 180), ff, k * g * 0.75, (-0.7, 0.7, -0.4, 0.4)[i])
        put(air_boom(1.0, 2.0, sd + 50 + i, 360 - i * 50), ff, k * g * 0.6)
    n = int(SR * 3.2); t = np.arange(n) / SR
    quake = lp(noise(n, sd + 60), 110, 0.8, 2) * 8 * np.minimum(1, t / 0.15) * np.exp(-t / 1.15) * (0.75 + 0.25 * np.sin(2 * np.pi * 7.3 * t))
    put(np.tanh(quake), 1092, k * 0.62)


def build_foley(foley, amb):
    def put(x, f, g=1.0, pan=0.0, bus=None):
        (bus or foley).add(x, S(f), g, pan)

    def sw(f_end, dur, f0, f1, g, pan=0.0, seed=0, peak=0.85):
        x = whoosh(dur, f0, f1, seed or int(f_end * 3 + 5), 1.0, peak)
        foley.add(x, S(f_end) - int(len(x) * peak), g, pan)

    # the drop falling, the boot coming down
    n = int(SR * 0.72); t = np.arange(n) / SR
    put(fade(np.sin(2 * np.pi * np.cumsum(2400 - 1300 * (t / 0.72) ** 2) / SR) * (t / 0.72) ** 2, 0.05, 0.03), 0.4, 0.055)
    sw(52, 0.55, 150, 700, 0.85, 0.0)
    sw(68, 0.35, 300, 3200, 0.7, 0.15)
    # stare-down: cloth snapping in the wind
    for i, (f, p) in enumerate(((80, 0.5), (97, -0.55), (109, 0.55), (171, -0.6), (180, 0.4), (186, -0.5))):
        m = int(SR * 0.09)
        put(bp(noise(m, 700 + i), 1100 + 300 * (i % 3), 0.9) * env_exp(m, 0.022, 0.004), f, 0.30, p)
        put(bp(noise(m, 720 + i), 900 + 250 * (i % 2), 0.9) * env_exp(m, 0.018, 0.003), f + 2.2, 0.20, p)
    put(splash_drop(0.6, 4), 124, 0.35, -0.3)
    # the pebble in the silence
    m = int(SR * 0.05)
    tick = (np.sin(2 * np.pi * 2300 * np.arange(m) / SR) + noise(m, 801) * 0.5) * env_exp(m, 0.006)
    put(tick, 191, 0.20, -0.1); put(tick, 193.2, 0.07, -0.12)
    # launches, swings, flights
    for end, dur, f0, f1, g, pan in (
            (198, 0.34, 300, 2600, 0.55, -0.35), (199, 0.34, 180, 1500, 0.5, 0.35), (220, 0.55, 2200, 350, 0.75, -0.55), (219, 0.5, 1200, 240, 0.55, 0.5),
            (242, 0.30, 500, 3800, 0.65, -0.3), (252, 0.18, 800, 3000, 0.45, 0.2), (262, 0.22, 900, 4200, 0.55, -0.15), (272, 0.2, 300, 1800, 0.55, 0.15),
            (283, 0.26, 500, 4600, 0.75, -0.2), (291, 0.34, 2600, 500, 0.8, 0.45), (298, 0.4, 1500, 300, 0.5, 0.5),
            (332, 0.30, 500, 3400, 0.75, -0.35), (341, 0.30, 4200, 700, 0.95, -0.45), (348, 0.20, 1800, 350, 0.6, -0.55),
            (394, 0.45, 300, 4800, 0.95, -0.4), (403, 0.22, 700, 5200, 0.7, -0.15), (413, 0.34, 3800, 900, 0.9, 0.25), (423, 0.3, 2600, 600, 0.8, 0.5), (434, 0.35, 1600, 300, 0.55, 0.45),
            (448, 0.25, 600, 2600, 0.55, 0.35), (456, 0.42, 400, 4200, 0.75, -0.3), (463, 0.38, 200, 1400, 0.65, 0.3), (473, 0.20, 300, 2800, 0.85, 0.1),
            (497, 0.30, 600, 3000, 0.55, -0.35), (509, 0.30, 700, 3400, 0.6, -0.2), (523, 0.45, 400, 3000, 0.7, -0.15), (542, 0.30, 600, 5200, 0.85, -0.1),
            (549, 0.30, 4600, 900, 0.95, 0.2), (558, 0.35, 3200, 700, 0.8, 0.35), (591, 0.35, 500, 4800, 0.9, -0.4), (597, 0.2, 900, 5200, 0.8, -0.1),
            (606, 0.30, 300, 1500, 0.7, -0.5), (613, 0.28, 350, 2100, 0.85, 0.5), (618, 0.24, 400, 3200, 1.0, 0.0), (623, 0.22, 1200, 5200, 0.8, 0.1),
            (634, 0.2, 900, 3600, 0.5, 0.2), (645, 0.45, 2400, 500, 0.5, 0.45), (668, 0.3, 500, 2600, 0.45, -0.2), (686, 0.5, 400, 3800, 0.7, 0.1), (696, 0.6, 500, 4500, 0.85, 0.0),
            (702, 0.35, 600, 4800, 0.75, -0.25), (718, 0.5, 3000, 600, 0.65, -0.35), (734, 0.4, 500, 2200, 0.4, -0.1), (749, 0.3, 600, 3000, 0.45, -0.15), (762, 0.30, 500, 5400, 0.8, -0.1),
            (779, 0.45, 5000, 900, 0.85, 0.1), (790, 0.3, 2600, 400, 0.7, 0.0), (864, 0.4, 1800, 500, 0.35, -0.45),
            (1061, 0.40, 300, 4200, 0.85, -0.45), (1062, 0.42, 150, 1800, 0.75, 0.45), (1069, 0.35, 700, 5200, 0.6, -0.2)):
        sw(end, dur, f0, f1, g, pan, peak=0.82 if f1 > f0 else 0.18)
    # arrivals, footfalls
    for f, g, p in ((228, 0.5, -0.5), (236, 0.45, 0.5), (298, 0.35, -0.2), (304, 0.55, 0.5), (318, 0.22, 0.45), (322, 0.22, 0.4), (376, 0.2, -0.3), (426, 0.35, -0.5),
                    (440, 0.45, 0.4), (448, 0.2, -0.2), (452, 0.2, 0.0), (456, 0.22, 0.2), (460, 0.22, 0.3), (490, 0.4, -0.35), (502, 0.4, -0.15), (562, 0.4, -0.3), (664, 0.35, -0.1),
                    (668, 0.25, 0.0), (672, 0.25, -0.1), (676, 0.25, 0.0), (680, 0.28, -0.05), (874, 0.55, -0.35), (884, 0.3, -0.35)):
        m = int(SR * 0.22)
        put(thump(1.0, 1.5, 120, 52)[:m] * env_exp(m, 0.05), f, g * 0.55, p)
        put(crunch(1.0, 0.12, 300, 3200, int(f * 11)), f, g * 0.28, p)
    # skids
    for f, d, p in ((227, 0.55, -0.55), (224, 0.6, 0.55), (302, 0.35, 0.45), (438, 0.8, 0.4), (562, 0.5, -0.3)):
        x = crunch(1.0, d, 250, 2600, int(f * 17), 420)
        put(x * np.linspace(1, 0.1, len(x)), f, 0.27, p)
    # flare, energy and charge
    for f, d, g in ((382, 0.7, 0.55), (318, 0.65, 0.35), (460, 0.55, 0.35), (526, 0.7, 0.30), (746, 0.7, 0.35)):
        put(riser(d, 180, 760, int(f * 5), 1.0), f, g)
    # settling rubble through the lull
    put(debris(1.0, 3.4, 8401, 26, 600, 4000, 0.35), 838, 0.34, 0.1)
    put(debris(1.0, 2.2, 8402, 12, 900, 5000, 0.1), 888, 0.20, -0.4)
    put(debris(1.0, 0.9, 8403, 8, 1200, 5200, 0.0), 921, 0.16, 0.5)
    # breathing: hers quick and high, his slow and low
    t = 876.0
    for i in range(4):
        put(breath(0.36, 9000 + i, 900, 1900, 0.30), t + i * 19, 0.42, -0.35)
        put(breath(0.44, 9100 + i, 1500, 700, 0.23), t + i * 19 + 9.5, 0.42, -0.35)
    for i in range(2):
        put(breath(0.62, 9200 + i, 330, 620, 0.40), 884 + i * 34, 0.55, 0.4)
        put(breath(0.85, 9300 + i, 560, 250, 0.34), 900 + i * 34, 0.55, 0.4)
    put(breath(0.5, 9401, 700, 1700, 0.28), 961, 0.4, -0.3)
    # the one small sound
    put(splash_drop(1.0, 7), 946, 0.62, -0.15)
    m = int(SR * 0.05)
    put(hp(noise(m, 946), 2500) * env_exp(m, 0.004, 0.0002), 946, 0.34, -0.15)
    put(splash_drop(0.18, 8), 950.5, 0.5, 0.2)
    # ink tearing out of the ground, colour pulled in
    n = int(SR * 3.4); t_ = np.arange(n) / SR
    roar = lp(noise(n, 9761), 240, 0.9, 2) * 5 * np.minimum(1, t_ / 2.2) ** 1.5 * np.minimum(1, (3.4 - t_) / 0.25).clip(0, 1)
    put(np.tanh(roar), 976, 0.34)
    for i in range(26):
        sw(1014 + i * 1.65, 0.22 + 0.1 * (i % 3), 700 + 60 * i, 3000 + 140 * i, 0.16 + 0.008 * i, ((i * 7) % 11 - 5) / 6, seed=3000 + i, peak=0.8)
    # wind bed, level set by act
    n = N
    r = rng(4242)
    w1 = filt(r.standard_normal(n), ('bp', 340, 0.8), ('lp', 1200, 0.7))
    w2 = filt(r.standard_normal(n), ('bp', 340, 0.8), ('lp', 1200, 0.7))
    t = np.arange(n) / SR
    gust = 0.75 + 0.25 * np.sin(2 * np.pi * 0.23 * t) * np.sin(2 * np.pi * 0.61 * t + 2) + 0.18 * np.sin(2 * np.pi * 0.11 * t + 1)
    pts = [(0, 0.0), (6, 0.05), (66, 0.09), (74, 0.30), (160, 0.34), (188, 0.30), (193, 0.015), (204, 0.015), (232, 0.12), (600, 0.12), (696, 0.34), (760, 0.30), (794, 0.1),
           (836, 0.14), (870, 0.24), (930, 0.15), (944, 0.035), (962, 0.12), (1000, 0.2), (1060, 0.12), (1072, 0.012), (1083, 0.012), (1100, 0.10), (1140, 0.18), (1199, 0.0)]
    lv = np.interp(np.arange(n) / SPF, [p[0] for p in pts], [p[1] for p in pts])
    amb.a[0] += w1 * gust * lv * 1.15
    amb.a[1] += w2 * np.roll(gust, int(SR * 0.37)) * lv * 1.15


# ---------------------------------------------------------------- the score
B = 10   # frames per beat


def beat(k):
    return 204 + B * k


def build_music(mus, drums, solo):
    def put(x, f, g=1.0, pan=0.0, bus=None):
        (bus or mus).add(x, S(f), g, pan)
    D2, E2 = 38, 40

    # hook: a drone and one bowed harmonic
    put(strings([26, 38], 3.0, 1.4, 0.4, 700, seed=1), 0, 1.5)
    n = int(SR * 2.9); t = np.arange(n) / SR
    harm = np.sin(2 * np.pi * note(86) * t + 2.2 * np.sin(2 * np.pi * 5.3 * t) * 0.15) * np.minimum(1, t / 1.6) * np.minimum(1, (2.9 - t) / 0.3)
    put(harm, 0, 0.030, 0.25)
    # stare-down: low strings, heartbeat drum, rising tension
    put(strings([38, 45], 3.2, 1.2, 0.5, 900, seed=2), 70, 2.0)
    put(strings([50, 57, 62], 2.0, 0.9, 0.4, 1500, seed=3), 118, 1.2)
    put(strings([50, 53, 57], 1.8, 0.8, 0.1, 2200, trem=0.35, seed=4), 148, 1.25)
    for i, f in enumerate((74, 94, 114, 124, 144, 154, 164, 174, 179, 184, 186.5)):
        put(taiko(0.45 + i * 0.05, 62), f, 0.62 + 0.02 * i, 0.0, drums)
    put(brass([38, 45, 50], 0.9, 5), 144, 0.55)
    put(bell(86, 1.6, 0.6), 127, 0.8, -0.4)
    x = riser(1.05, 98, 590, 77, 1.0)
    drums.add(x, S(189) - len(x), 0.80)

    # ---- riff engine: 16th grid, 2.5 frames per step
    def guitar_riff(f0, f1, root, pattern, accent=1.0, openness=None):
        step = 2.5
        i = 0
        f = f0
        while f < f1 - 0.1:
            s = pattern[i % len(pattern)]
            if s is not None:
                semi, long = s
                dur = (step * long) / 24 * 1.02
                put(guitar(root + semi, dur, mute=long == 1, seed=(i * 13 + int(semi)) % 97), f, 0.55 * accent)
                put(bass(root - 12 + semi if root - 12 + semi > 23 else root + semi, dur, i), f, 0.62 * accent)
            i += 1
            f += step

    def groove(f0, f1, kpat, spat, hatdiv=2, vel=1.0):
        step = 2.5
        i = 0
        f = f0
        while f < f1 - 0.1:
            s = i % 16
            if kpat[s] == 'x':
                put(kick(vel), f, 0.80, 0.0, drums)
            if spat[s] == 'x':
                put(snare(vel, 21 + i % 5), f, 0.72, 0.05, drums)
            if hatdiv and s % hatdiv == 0:
                put(hat(vel * (1.0 if s % 4 == 0 else 0.7), s == 14, 31 + i % 7), f, 0.75, 0.3, drums)
            i += 1
            f += step

    Z = None
    RA = [(0, 1), (0, 1), Z, (0, 1), (0, 1), Z, (3, 1), Z, (0, 1), (0, 1), Z, (0, 1), (5, 2), Z, (3, 1), (2, 1)]
    RB = [(0, 1), (0, 1), (0, 1), Z, (6, 2), Z, (5, 1), (0, 1), (0, 1), (0, 1), (8, 2), Z, (7, 1), (5, 1), (3, 1), (1, 1)]
    RC = [(0, 1), (0, 1), (12, 1), (0, 1), (0, 1), (10, 1), (0, 1), (0, 1), (8, 1), (0, 1), (0, 1), (7, 1), (0, 1), (5, 1), (3, 1), (2, 1)]
    K1 = 'x..x..x.xx..x...'
    K2 = 'xx.x..x.xx.x.x..'
    K3 = 'xxxxx.xxxxxxx.xx'
    SN = '....x.......x...'
    SN2 = '....x.......x.xx'

    # after the first clash the band arrives
    put(crash(1.0, 41, 2.0), 224, 0.9, -0.2, drums)
    guitar_riff(224, 284, D2, RA)
    groove(224, 284, K1, SN, 2, 0.95)
    put(crash(0.8, 43, 1.6), 244, 0.7, 0.3, drums)
    guitar_riff(284, 324, D2, RB, 1.0)
    groove(284, 324, K2, SN, 2)
    put(strings([62, 65, 69], 1.7, 0.1, 0.2, 3600, trem=0.5, seed=8), 284, 0.9)
    # the ink gathers: band cuts, low held tone
    put(strings([26, 33], 0.75, 0.2, 0.02, 600, seed=9), 316, 2.1)
    put(brass([39, 45], 0.65, 3), 318, 0.45)
    # after the wall
    guitar_riff(354, 374, D2, [(0, 4), Z, Z, Z, (1, 4), Z, Z, Z], 0.75)
    for f in (354, 364, 369):
        put(taiko(0.8, 58), f, 0.8, 0.0, drums)
    guitar_riff(384, 398, D2, [(0, 1)] * 16, 0.8)
    groove(384, 398, 'x.x.x.x.x.x.xxxx', '................', 1, 0.8)
    # exchange two: faster, heavier
    put(crash(1.0, 45, 2.0), 414, 0.8, 0.2, drums)
    guitar_riff(424, 464, D2, RC)
    groove(424, 464, K2, SN2, 2)
    for f, chord in ((414, [50, 57, 62]), (444, [48, 55, 60]), (454, [51, 58, 63])):
        put(brass(chord, 0.42, f), f + 1.5, 0.75)
    ost = [74, 77, 81, 77, 74, 79, 82, 79]
    for i in range(16):
        put(strings([ost[i % 8]], 0.11, 0.008, 0.04, 5200, seed=40 + i % 8), 424 + i * 2.5, 1.5, 0.35 if i % 2 else -0.35)
    # silence before the hammer, then the street
    put(crash(1.0, 47, 2.4), 484, 0.75, -0.3, drums)
    guitar_riff(494, 534, D2 - 2, RA, 0.95)
    groove(494, 534, K2, SN, 2)
    put(brass([46, 53, 58], 0.5, 11), 482, 0.8)
    guitar_riff(534, 540, D2, [(0, 1), (0, 1)], 1.0)
    put(crash(1.0, 49, 2.0), 574, 0.7, 0.3, drums)
    put(brass([38, 50, 56], 0.7, 13), 572, 0.8)
    guitar_riff(574, 594, D2, [(0, 2), Z, (0, 2), Z, (6, 2), Z, (5, 2), Z], 0.9)
    groove(574, 594, K3, '....x.......x.x.', 2, 0.9)
    put(strings([62, 63, 69], 0.8, 0.5, 0.03, 4200, trem=0.6, seed=14), 600, 1.3)
    for i, f in enumerate((600, 605, 609, 612.5, 615, 617.5)):
        put(taiko(0.6 + i * 0.07, 70 + i * 6), f, 0.7, 0.0, drums)
    put(brass([37, 44, 49], 0.35, 15), 626, 0.7)
    guitar_riff(630, 647, D2 - 1, [(0, 4), Z, Z, Z, (0, 2), Z, (1, 2), Z], 0.7)
    # after the slice: silence; then the fall in half time and the climb
    put(strings([26, 38, 45], 1.6, 0.7, 0.2, 1000, seed=16), 658, 2.0)
    for i, f in enumerate((664, 674, 679, 684, 686.5, 689)):
        put(taiko(0.7 + i * 0.05, 55), f, 0.75, 0.0, drums)
    x = riser(0.65, 147, 880, 177, 1.0)
    drums.add(x, S(700) - len(x), 0.5)
    run = [62, 65, 69, 74, 77, 81, 86, 89]
    for i, m in enumerate(run):
        put(strings([m], 0.2, 0.01, 0.05, 5400, seed=60 + i), 680 + i * 2.0, 1.4 + i * 0.1)

    # ---- sky: open, wide, lifting (D minor to B flat and C)
    chords = [(714, [46, 53, 58, 62, 65], 20), (734, [48, 55, 60, 64, 67], 20)]
    for f, ch, d in chords:
        put(strings(ch, d / 24 + 0.25, 0.15, 0.3, 3800, seed=f), f, 2.0)
        put(choir([ch[1] + 12, ch[3] + 12, ch[4] + 12], d / 24 + 0.2, 'ah', 0.2, 0.25, seed=f), f, 1.35)
        put(bass(ch[0] - 12, d / 24, f), f, 0.7)
    sky_ost = [70, 74, 77, 82, 77, 74, 72, 76, 79, 84, 79, 76]
    for i in range(16):
        put(strings([sky_ost[(i % 6) + (6 if i >= 8 else 0)]], 0.12, 0.008, 0.04, 5600, seed=80 + i % 12), 714 + i * 2.5, 1.35, 0.4 if i % 2 else -0.4)
    for i in range(8):
        put(taiko(0.75, 66 if i % 2 else 52), 714 + i * 5, 0.62, -0.2 if i % 2 else 0.2, drums)
    put(crash(0.9, 51, 2.2), 714, 0.65, 0.0, drums)
    put(choir([69, 74, 81], 0.9, 'oo', 0.35, 0.05, seed=5), 736, 1.2)
    x = riser(0.55, 196, 780, 188, 1.0)
    drums.add(x, S(757) - len(x), 0.42)
    # while he falls
    put(strings([50, 56, 62, 68], 0.95, 0.1, 0.05, 4800, trem=0.55, seed=21), 773, 1.5)
    for i, f in enumerate((774, 779, 783, 786, 788.5)):
        put(taiko(0.65 + 0.08 * i, 60), f, 0.7, 0.0, drums)
    # the lull has no music at all

    # ---- the last exchange: up a whole step, E minor
    put(strings([28, 40], 4.7, 2.4, 0.15, 800, seed=30), 960, 2.2)
    put(choir([52, 59], 2.2, 'oo', 1.4, 0.2, seed=31), 972, 1.6)
    put(brass([40, 47, 52], 1.0, 33), 982, 0.75)
    for f, ch, d in ((994, [52, 59, 64, 67], 20), (1014, [48, 55, 60, 64], 20), (1034, [50, 57, 62, 66], 20), (1054, [47, 54, 59, 63, 66], 16)):
        k_ = (f - 994) / 60
        put(choir([c + 12 for c in ch], d / 24 + 0.18, 'ah', 0.18, 0.12, seed=f), f, 1.3 + k_ * 0.9)
        put(strings(ch + [ch[-1] + 12], d / 24 + 0.2, 0.12, 0.1, 3000 + 2200 * k_, trem=0.25 + 0.3 * k_, seed=f + 1), f, 1.7 + k_ * 0.9)
        put(bass(ch[0] - 12, d / 24, f), f, 0.75)
    # heartbeat drum closing up
    for f in (964, 984, 1004, 1014, 1024, 1034, 1039, 1044, 1049, 1054):
        put(taiko(0.55 + (f - 964) / 200, 50), f, 0.72, 0.0, drums)
    guitar_riff(1014, 1054, E2, [(0, 8), Z, Z, Z, Z, Z, Z, Z], 0.55)
    guitar_riff(1054, 1069, E2, [(0, 1)] * 16, 0.85)
    for i in range(12):
        put(snare(0.35 + 0.055 * i, 90 + i), 1054 + i * 1.25, 0.7, 0.0, drums)
    put(brass([52, 59, 64], 0.55, 35), 1056, 0.9)
    for i, m in enumerate([64, 67, 71, 76, 79, 83, 88]):
        put(strings([m], 0.18, 0.008, 0.04, 6000, seed=95 + i), 1054 + i * 2.2, 1.5 + i * 0.12)
    x = riser(2.3, 82, 660, 199, 1.0)
    drums.add(x, S(1069) - len(x), 0.62)
    # the near silence: one heartbeat and a thread of ring
    for f, g in ((1073.5, 0.55), (1075.8, 0.34)):
        m = int(SR * 0.16)
        solo.add(thump(1.0, 1, 85, 48)[:m] * env_exp(m, 0.045), S(f), g * 0.6)
    n = int(SR * 0.50); t = np.arange(n) / SR
    solo.add(fade(np.sin(2 * np.pi * note(100) * t) * (t / 0.5) ** 1.5, 0.05, 0.02), S(1071), 0.028)

    # ---- aftermath: ringing ears, then E major
    n = int(SR * 3.4); t = np.arange(n) / SR
    ring = (np.sin(2 * np.pi * 3920 * t) + 0.55 * np.sin(2 * np.pi * 3943 * t) + 0.3 * np.sin(2 * np.pi * 6270 * t))
    ring *= np.minimum(1, t / 0.25) * np.exp(-np.maximum(0, t - 0.6) / 1.1) * np.minimum(1, (3.4 - t) / 0.4).clip(0, 1)
    solo.add(ring, S(1097), 0.060)
    put(strings([40, 52, 56, 59, 64], 3.6, 1.5, 0.7, 2600, seed=50), 1114, 2.3)
    put(choir([64, 68, 71], 2.9, 'ah', 1.3, 0.8, seed=51), 1128, 1.35)
    put(bass(28, 2.9, 52), 1130, 0.55)
    # a short original motif on bells, landing home as the circle closes
    for f, m, v in ((1134, 76, 0.7), (1144, 80, 0.75), (1154, 83, 0.85), (1159, 85, 0.7), (1164, 83, 0.8), (1174, 88, 1.0), (1174, 76, 0.7), (1184, 80, 0.45), (1184, 71, 0.45)):
        put(bell(m, 2.0, v), f, 1.35, ((m % 5) - 2) * 0.16)
    put(taiko(0.9, 41), 1174, 0.7, 0.0, drums)
    put(strings([76, 80, 83], 1.1, 0.35, 0.6, 4200, seed=55), 1172, 1.0)


# ---------------------------------------------------------------- ducking, mix, master
def duck_envelope(kind):
    """gain per sample, driven straight from the hit list"""
    g = np.ones(N)
    frames = np.arange(N) / SPF

    def shape(f, pre, pre_g, hit_g, hold, rel):
        out = np.ones(N)
        a, b = S(max(0, f - pre - 3)), S(min(1200, f + hold + rel))
        x = frames[a:b]
        xs = [f - pre - 3, f - pre, f - 0.02, f, f + hold, f + hold + rel]
        ys = [1.0, pre_g, pre_g, hit_g, hit_g, 1.0]
        out[a:b] = np.interp(x, xs, ys)
        return out

    for h in HITS['hits']:
        sc, hero = h['scale'], h['hero']
        pre = {1: 13, 2: 0, 3: 15}.get(hero, 7 if sc >= 5.5 else 4)
        pre_g = 0.0 if hero in (1, 3) else (0.30 if sc >= 5.5 else 0.55)
        if h['id'] in ('H1', 'H2'):
            pre, pre_g = 5, 0.12
        if h['id'] == 'H4':
            pre, pre_g = 5, 0.12
        if h['id'] in ('H10', 'H12'):
            pre_g = 0.06
        hit_g = max(0.07, 0.34 - 0.03 * sc)
        rel = 8 + sc * 2.0
        hold = max(2, h['hold'])
        if hero == 2:
            rel = 40
        if hero == 3:
            rel = 34
            hold = 14
        if kind == 'amb':
            pre_g = min(1.0, pre_g + 0.12); hit_g = min(1.0, hit_g * 1.9)
        g = np.minimum(g, shape(h['f'], pre, pre_g, hit_g, hold, rel))
    for h in HITS['minor']:
        if h['id'] == 'p1':
            g = np.minimum(g, shape(h['f'], 12, 0.2, 0.5, 2, 10))
            continue
        hit_g = max(0.20, 0.62 - 0.08 * h['scale'])
        if kind == 'amb':
            hit_g = min(1.0, hit_g * 1.6)
        g = np.minimum(g, shape(h['f'], 1, 0.85, hit_g, 2, 7 + h['scale']))
    # the beat of silence after the slice
    if kind == 'music':
        g = np.minimum(g, np.interp(frames, [0, 646, 649, 657.5, 660, 1200], [1, 1, 0.06, 0.06, 1, 1]))
        g = np.minimum(g, np.interp(frames, [0, 188.5, 190, 203.9, 204, 1200], [1, 1, 0.0, 0.0, 1, 1]))
        g = np.minimum(g, np.interp(frames, [0, 836, 846, 956, 962, 1200], [1, 1, 0.0, 0.0, 1, 1]))
        g = np.minimum(g, np.interp(frames, [0, 1068.5, 1070.0, 1083.9, 1084, 1200], [1, 1, 0.0, 0.0, 1, 1]))
    # 3 ms smoothing so no gain step clicks (centred, so it does not move any onset)
    k = int(SR * 0.003)
    c = np.cumsum(np.concatenate([np.full(k, g[0]), g, np.full(k, g[-1])]))
    sm = (c[2 * k:] - c[:-2 * k]) / (2 * k)
    return sm[:N]


def k_weight(x):
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]; a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]; a2 = [1.0, -1.99004745483398, 0.99007225036621]
    L = 1
    while L < len(x) + SR:
        L *= 2
    X = np.fft.rfft(x, L)
    z = np.exp(-1j * np.linspace(0, math.pi, len(X)))
    for b, a in ((b1, a1), (b2, a2)):
        X *= (b[0] + b[1] * z + b[2] * z * z) / (a[0] + a[1] * z + a[2] * z * z)
    return np.fft.irfft(X, L)[:len(x)]


def lufs(st):
    y = np.stack([k_weight(st[0]), k_weight(st[1])])
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    p = np.array([np.sum(np.mean(y[:, i:i + blk] ** 2, axis=1)) for i in range(0, y.shape[1] - blk + 1, hop)])
    l = -0.691 + 10 * np.log10(p + 1e-12)
    g1 = p[l > -70]
    rel = -0.691 + 10 * np.log10(np.mean(g1)) - 10
    g2 = p[(l > -70) & (l > rel)]
    return -0.691 + 10 * np.log10(np.mean(g2))


def oversample_peaks(x, factor=4, block=1 << 16):
    """per-sample maximum of the 4x oversampled signal"""
    out = np.zeros(len(x))
    pad = 256
    for s in range(0, len(x), block):
        a, b = max(0, s - pad), min(len(x), s + block + pad)
        seg = x[a:b]
        n = len(seg)
        X = np.fft.rfft(seg)
        up = np.fft.irfft(X, n * factor) * factor
        mx = np.max(np.abs(up).reshape(n, factor), axis=1)
        e = min(len(x), s + block)
        out[s:e] = mx[s - a:e - a]
    return out


def limiter(st, ceiling_db=-1.6, look=0.0025, release=0.085):
    ceil = 10 ** (ceiling_db / 20)
    pk = np.maximum(oversample_peaks(st[0]), oversample_peaks(st[1]))
    need = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    L = int(look * SR)
    # sliding minimum over the lookahead window (looks forward and back)
    m = need.copy()
    shift = 1
    while shift < L:
        m = np.minimum(m, np.concatenate([m[shift:], np.ones(shift)]))
        shift *= 2
    m = np.minimum(m, np.concatenate([np.ones(L // 2), m[:-(L // 2)]]))
    # release: gain climbs back exponentially
    blk = 16
    nb = len(m) // blk
    mb = m[:nb * blk].reshape(nb, blk).min(axis=1)
    out = np.empty(nb)
    cur = 1.0
    coef = math.exp(-blk / (release * SR))
    for i, v in enumerate(mb.tolist()):
        cur = v if v < cur else v + (cur - v) * coef
        out[i] = cur
    g = np.repeat(out, blk)
    g = np.concatenate([g, np.full(len(m) - len(g), g[-1])])
    k = max(1, L // 2)
    c = np.cumsum(np.concatenate([np.full(k, g[0]), g, np.full(k, g[-1])]))
    g = np.minimum((c[2 * k:] - c[:-2 * k])[:len(m)] / (2 * k), m)
    return st * g, g


def write_wav(path, st):
    x = np.clip(st.T, -1, 1)
    r = rng(123)
    d = (r.random(x.shape) - r.random(x.shape)) / (2 ** 23)
    ints = np.round((x + d) * (2 ** 23 - 1)).astype(np.int32)
    ints = np.clip(ints, -(2 ** 23), 2 ** 23 - 1)
    b = ints.astype('<i4').tobytes()
    raw = np.frombuffer(b, np.uint8).reshape(-1, 4)[:, :3].tobytes()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR)
        w.writeframes(raw)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'soundtrack.wav'))
    ap.add_argument('--stems', action='store_true')
    a = ap.parse_args()
    mus, drm, solo, hitb, tail, foley, amb = Bus(), Bus(), Bus(), Bus(), Bus(), Bus(), Bus()
    print('score'); build_music(mus, drm, solo)
    print('impacts'); build_impacts(hitb, tail)
    print('foley and air'); build_foley(foley, amb)
    print('space')
    mus.a = reverb(mus.a, 1.9, 0.50, 0.22, 5)
    drm.a = reverb(drm.a, 1.4, 0.36, 0.16, 9)
    tail.a = reverb(tail.a, 2.4, 0.70, 0.28, 13, 4200)
    foley.a = reverb(foley.a, 1.2, 0.30, 0.14, 17)
    amb.a = reverb(amb.a, 1.0, 0.25, 0.10, 19)
    hit_wet = reverb(hitb.a, 2.2, 0.62, 0.15, 23, 3800, 0.028)

    dm = duck_envelope('music'); da = duck_envelope('amb')
    # impacts own the mix; the score sits under them and gets out of their way
    music = (mus.a * 0.52 + drm.a * 0.54) * dm
    ambience = (amb.a * 0.55 + foley.a * 0.60) * da
    # foley must not mask the next contact: dip it in the last frames before big hits
    frames = np.arange(N) / SPF
    gate = np.ones(N)
    for h in HITS['hits']:
        if h['scale'] >= 5:
            gate = np.minimum(gate, np.interp(frames, [0, h['f'] - 3.0, h['f'] - 1.1, h['f'] - 0.01, h['f'], 1200], [1, 1, 0.12, 0.12, 1, 1]))
    ambience *= gate
    # debris tails duck under the next hit as well
    tails = tail.a * (0.45 + 0.55 * da) * gate
    # near silence before the heroes: nothing but the heartbeat
    for f0, f1, depth in ((199.0, 203.97, 0.05), (281.0, 283.97, 0.22), (699.5, 703.97, 0.10), (790.6, 793.97, 0.12), (1070.0, 1083.97, 0.05)):
        m = np.interp(frames, [0, f0 - 1.5, f0, f1, f1 + 0.02, 1200], [1, 1, depth, depth, 1, 1])
        tails *= m; ambience *= m
        # ring-out of earlier hits is pulled down too; the dry contacts that come later are untouched
        hit_wet = hit_wet * np.interp(frames, [0, f0 - 1.5, f0, f1, f1 + 0.02, 1200], [1, 1, max(depth, 0.2), max(depth, 0.2), 1, 1])
    solo_t = solo.a
    impacts = hit_wet * 0.92
    mix = music + ambience + tails * 0.66 + impacts + solo_t
    mix = np.stack([hp(mix[0], 24, 0.8), hp(mix[1], 24, 0.8)])
    if a.stems:
        os.makedirs(os.path.join(ROOT, 'work'), exist_ok=True)
        for nm, st in (('music', music), ('impacts', impacts), ('ambience', ambience + tails * 0.66)):
            write_wav(os.path.join(ROOT, 'work', 'stem_%s.wav' % nm), st * 0.4)

    print('master')
    target = -14.0
    gain = 10 ** ((target - lufs(mix)) / 20)
    for it in range(6):
        drive = mix * gain
        # soft saturation first so the limiter only has to catch the tips
        knee = 0.62
        mag = np.abs(drive)
        soft = np.where(mag > knee, np.sign(drive) * (knee + (1 - knee) * np.tanh((mag - knee) / (1 - knee))), drive)
        # extra headroom: the AAC encode overshoots on the densest hits
        out, g = limiter(soft, -2.3)
        # clean fade at the very end
        tailn = int(SR * 0.35)
        out[:, -tailn:] *= np.linspace(1, 0, tailn) ** 1.4
        out[:, :96] *= np.linspace(0, 1, 96)
        L = lufs(out)
        print('  pass %d: %.2f LUFS, max gain reduction %.1f dB' % (it, L, 20 * math.log10(g.min())))
        if abs(L - target) < 0.12:
            break
        gain *= 10 ** ((target - L) / 20)
    tp = max(oversample_peaks(out[0]).max(), oversample_peaks(out[1]).max())
    print('integrated %.2f LUFS, true peak %.2f dBTP, sample peak %.2f dBFS' % (lufs(out), 20 * math.log10(tp), 20 * math.log10(np.abs(out).max())))
    write_wav(a.out, out)
    print('wrote', a.out)


if __name__ == '__main__':
    main()
