"""Every sound in both films and in play mode, synthesized from noise, oscillators and filters.
No recordings, samples or sound libraries are used anywhere."""
import math

import numpy as np
from scipy import signal

SR = 48000


def secs(t):
    return int(round(t * SR))


def rng_for(seed):
    return np.random.default_rng(seed)


# ------------------------------------------------------------------ building blocks
def white(n, rng):
    return rng.standard_normal(n).astype(np.float64)


def pink(n, rng):
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    spec /= np.sqrt(np.maximum(f, 20.0))
    x = np.fft.irfft(spec, n)
    return x / (np.std(x) + 1e-12)


def brown(n, rng):
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    spec /= np.maximum(f, 15.0)
    x = np.fft.irfft(spec, n)
    return x / (np.std(x) + 1e-12)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, min(f, SR * 0.45), "lowpass", fs=SR, output="sos"), x, axis=0)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, max(f, 5.0), "highpass", fs=SR, output="sos"), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [max(lo, 5.0), min(hi, SR * 0.45)], "bandpass", fs=SR, output="sos"), x, axis=0)


def slow(n, rate, rng, lo=0.0, hi=1.0):
    """Smooth random control signal changing about `rate` times per second."""
    pts = max(int(n / SR * rate) + 4, 4)
    v = rng.random(pts)
    x = np.linspace(0, pts - 3, n)
    i = x.astype(int)
    f = x - i
    f = f * f * (3 - 2 * f)
    return lo + (hi - lo) * (v[i] * (1 - f) + v[i + 1] * f)


def decay(n, tau, attack=0.002):
    t = np.arange(n) / SR
    e = np.exp(-t / max(tau, 1e-4))
    a = max(secs(attack), 1)
    e[:a] *= np.linspace(0, 1, a)[:min(a, n)]
    return e


def fade(x, a=0.01, r=0.02):
    n = len(x)
    na, nr = min(secs(a), n), min(secs(r), n)
    w = np.ones(n)
    if na:
        w[:na] = 0.5 - 0.5 * np.cos(np.linspace(0, math.pi, na))
    if nr:
        w[-nr:] *= 0.5 + 0.5 * np.cos(np.linspace(0, math.pi, nr))
    return x * (w if x.ndim == 1 else w[:, None])


def tone(freq, n=None, phase=0.0):
    """freq: scalar (needs n) or per-sample array."""
    if np.isscalar(freq):
        freq = np.full(n, float(freq))
    return np.sin(2 * math.pi * np.cumsum(freq) / SR + phase)


def saw(freq, n=None, partials=18):
    if np.isscalar(freq):
        freq = np.full(n, float(freq))
    ph = 2 * math.pi * np.cumsum(freq) / SR
    out = np.zeros(len(freq))
    for k in range(1, partials + 1):
        mask = freq * k < SR * 0.4
        out += mask * np.sin(ph * k) / k
    return out * 0.6


def pan(mono, p, width=0.0):
    """p in -1..1; a short interaural delay adds width."""
    a = (np.clip(p, -1, 1) + 1) * math.pi / 4
    left, right = mono * np.cos(a), mono * np.sin(a)
    if np.isscalar(p) and abs(p) > 0.05:
        d = int(abs(p) * 0.0006 * SR)
        if d:
            if p > 0:
                left = np.concatenate([np.zeros(d), left[:-d]])
            else:
                right = np.concatenate([np.zeros(d), right[:-d]])
    return np.stack([left, right], axis=1)


def stereo_noise(n, rng, kind=white):
    return np.stack([kind(n, rng), kind(n, rng)], axis=1)


def place(bus, snd, at, gain=1.0):
    """Adds snd (mono or stereo) into the stereo bus at time `at` seconds."""
    if snd.ndim == 1:
        snd = pan(snd, 0.0)
    i = secs(at)
    j0 = max(-i, 0)
    i = max(i, 0)
    m = min(len(snd) - j0, len(bus) - i)
    if m > 0:
        bus[i:i + m] += snd[j0:j0 + m] * gain


_IR_CACHE = {}


def impulse(rt60, predelay=0.015, damp=3500.0, seed=5):
    key = (round(rt60, 2), round(predelay, 3), int(damp), seed)
    if key not in _IR_CACHE:
        rng = rng_for(seed)
        n = secs(rt60 * 1.1)
        t = np.arange(n) / SR
        ir = stereo_noise(n, rng) * np.exp(-6.9 * t / rt60)[:, None]
        ir = lp(ir, damp)
        ir = np.concatenate([np.zeros((secs(predelay), 2)), ir])
        # a few early slaps off facades
        for _ in range(7):
            k = secs(rng.uniform(0.012, 0.11))
            if k < len(ir):
                ir[k, rng.integers(2)] += rng.uniform(2.0, 5.0) * rng.choice([-1, 1])
        ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True)) + 1e-9
        _IR_CACHE[key] = ir
    return _IR_CACHE[key]


def reverb(x, rt60=1.4, wet=0.25, damp=3500.0, predelay=0.015, tail=True):
    if x.ndim == 1:
        x = pan(x, 0.0)
    ir = impulse(rt60, predelay, damp)
    w = np.stack([signal.fftconvolve(x[:, c], ir[:, c]) for c in range(2)], axis=1)
    n = len(w) if tail else len(x)
    out = np.zeros((n, 2))
    out[:len(x)] += x * (1 - wet * 0.5)
    out += w[:n] * wet
    return out


def softclip(x, drive=1.0):
    return np.tanh(x * drive) / math.tanh(drive)


def norm(x, peak=1.0):
    return x * (peak / (np.max(np.abs(x)) + 1e-12))


# ------------------------------------------------------------------ weather
def rain(n, rng, intensity, close=0.5):
    """intensity: scalar or per-sample 0..1.  close: how near the individual drops are."""
    inten = np.full(n, float(intensity)) if np.isscalar(intensity) else np.asarray(intensity, float)
    hiss = bp(stereo_noise(n, rng), 1400, 9500) * 0.17
    body = bp(stereo_noise(n, rng, pink), 300, 2500) * 0.12
    flutter = np.stack([slow(n, 9, rng, 0.8, 1.15), slow(n, 9, rng, 0.8, 1.15)], axis=1)
    out = (hiss + body) * flutter * np.power(inten, 1.15)[:, None]
    # single drops: short resonant ticks
    templates = []
    for _ in range(28):
        m = secs(rng.uniform(0.006, 0.03))
        f = rng.uniform(900, 5200)
        g = bp(white(m, rng), f * 0.8, f * 1.25) * decay(m, rng.uniform(0.002, 0.008), 0.0004)
        templates.append(norm(g))
    per_second = 20 + 240 * close
    count = int(n / SR * per_second)
    where = rng.integers(0, max(n - secs(0.05), 1), count)
    for k, i in enumerate(where):
        if rng.random() > inten[i]:
            continue
        tpl = templates[int(rng.integers(len(templates)))]
        a = (rng.random() ** 3) * 0.22 * (0.35 + close)
        p = rng.uniform(-1, 1)
        out[i:i + len(tpl), 0] += tpl * a * math.cos((p + 1) * math.pi / 4)
        out[i:i + len(tpl), 1] += tpl * a * math.sin((p + 1) * math.pi / 4)
    return out


def drips(n, rng, rate=2.5, gain=0.2):
    out = np.zeros((n, 2))
    for _ in range(int(n / SR * rate)):
        m = secs(rng.uniform(0.03, 0.09))
        f = rng.uniform(500, 1600)
        sweep = f * (1 + np.linspace(0, rng.uniform(0.3, 1.1), m))
        d = tone(sweep) * decay(m, rng.uniform(0.008, 0.025), 0.001)
        place(out, pan(d, rng.uniform(-0.9, 0.9)), rng.uniform(0, n / SR - 0.1), gain * rng.uniform(0.2, 1.0))
    return out


def wind(n, rng, strength, whistle=0.2):
    s = np.full(n, float(strength)) if np.isscalar(strength) else np.asarray(strength, float)
    gust = slow(n, 0.7, rng, 0.35, 1.0)[:, None]
    low = hp(lp(stereo_noise(n, rng, pink), 460), 65) * 0.23
    mid = bp(stereo_noise(n, rng, pink), 250, 900) * 0.16 * slow(n, 1.4, rng, 0.2, 1.0)[:, None]
    f = slow(n, 0.5, rng, 480.0, 1150.0)
    howl = bp(stereo_noise(n, rng), 600, 760) * 0.10 * (np.stack([tone(f * 0.01, phase=0.3), tone(f * 0.0097)], 1) * 0.5 + 0.5)
    return (low + mid + howl * whistle * gust) * gust * s[:, None] * 1.5


def thunder(rng, distance, power=1.0, crack=True):
    """The sound of one stroke heard from `distance` metres: a tearing crack when near, a long roll after."""
    near = max(0.0, 1.0 - distance / 1500.0)
    length = secs(5.5 + distance / 700.0)
    t = np.arange(length) / SR
    out = np.zeros((length, 2))
    cutoff = 260 + 5200 * near ** 1.5
    if crack and near > 0.15:
        # many sharp reports from different parts of the channel arriving over a fraction of a second
        for k in range(26):
            at = (rng.random() ** 2) * (0.18 + 0.55 * (1 - near)) + (0.0 if k > 2 else k * 0.025)
            m = secs(rng.uniform(0.04, 0.28))
            burst = white(m, rng) * decay(m, rng.uniform(0.008, 0.06), 0.0003)
            burst = hp(burst, rng.uniform(120, 900))
            burst = lp(burst, cutoff + rng.uniform(0, 2500))
            place(out, pan(burst, rng.uniform(-0.7, 0.7)), at, near ** 1.3 * rng.uniform(0.12, 0.5) * (1.6 if k < 3 else 1.0))
    # the roll: swells of low noise as echoes come in from further along the channel and off the towers
    roll = lp(stereo_noise(length, rng, brown), min(cutoff, 520)) * 0.34
    env = np.zeros(length)
    for k in range(11):
        at = rng.uniform(0.0, 3.2) if k else 0.02
        width = rng.uniform(0.12, 0.7)
        amp = rng.uniform(0.25, 1.0) * math.exp(-at / 2.6)
        rise = np.clip((t - at) / (0.05 + 0.12 * (1 - near)), 0, 1)
        env += amp * rise * np.exp(-np.maximum(t - at, 0) / width)
    env *= np.exp(-t / (2.4 + distance / 900.0))
    out += roll * env[:, None]
    sub = lp(brown(length, rng), 75) * env * 0.45
    out += sub[:, None]
    out = reverb(out, 2.8, 0.35, damp=900 + 2500 * near, tail=False)
    return fade(norm(out, 0.35 + 0.65 * min(1.0, power * (0.35 + near))), 0.001, 1.2)


# ------------------------------------------------------------------ the city
def city_hum(n, rng, bright=700.0):
    low = hp(lp(stereo_noise(n, rng, brown), 150), 48) * 0.12
    wash = bp(stereo_noise(n, rng, pink), 160, bright) * 0.085 * np.stack([slow(n, 0.35, rng, 0.6, 1.2), slow(n, 0.35, rng, 0.6, 1.2)], 1)
    vent = (tone(59.9, n) * 0.012 + tone(120.3, n) * 0.008 + tone(178.7, n) * 0.003)[:, None]
    return low + wash + vent


def horn(rng, dur=0.45, kind=0):
    n = secs(dur)
    pairs = [(405.0, 508.0), (368.0, 440.0), (312.0, 371.0), (180.0, 225.0)]
    a, b = pairs[kind % len(pairs)]
    vib = 1 + 0.004 * tone(5.5, n)
    x = saw(a * vib) + saw(b * vib * 1.003)
    x = softclip(bp(x, 280 if kind < 3 else 120, 3200), 1.6)
    return fade(x, 0.012, 0.05) * 0.3


def siren(rng, dur, period=4.2, doppler=0.03):
    n = secs(dur)
    t = np.arange(n) / SR
    sweep = 720 + 520 * (0.5 - 0.5 * np.cos(2 * math.pi * t / period))
    sweep *= 1 + doppler * np.cos(math.pi * t / dur)
    x = saw(sweep, partials=6)
    return fade(lp(x, 2600) * 0.22, 0.6, 1.0)


def subway(rng, dur):
    """A train passing under the street: a swelling rumble and the beat of wheels over rail joints."""
    n = secs(dur)
    t = np.arange(n) / SR
    swell = np.sin(np.clip(t / dur, 0, 1) * math.pi) ** 1.4
    rumble = lp(brown(n, rng), 90) * 0.4 + bp(pink(n, rng), 60, 260) * 0.14
    out = rumble * swell
    beat = 0.0
    while beat < dur - 0.3:
        for off in (0.0, 0.085, 0.31, 0.395):
            m = secs(0.07)
            knock = lp(white(m, rng), 900) * decay(m, 0.012, 0.0005)
            i = secs(beat + off)
            if i + m < n:
                out[i:i + m] += knock * 0.2 * swell[i]
        beat += 0.78
    squeal = tone(2350 + 40 * slow(n, 3, rng, -1, 1)) * slow(n, 1.3, rng, 0, 1) ** 4 * 0.012
    return pan(out + squeal * swell, -0.15)


def brake_squeal(rng, dur=0.7):
    n = secs(dur)
    f = 2900 + 120 * slow(n, 11, rng, -1, 1)
    x = (tone(f) + 0.4 * tone(f * 1.51)) * slow(n, 14, rng, 0.2, 1.0)
    return fade(x * 0.05, 0.05, 0.2)


def air_brake(rng):
    n = secs(0.8)
    return fade(hp(white(n, rng), 1800) * decay(n, 0.22, 0.004) * 0.22, 0.002, 0.2)


def wiper(rng):
    n = secs(0.34)
    swish = bp(white(n, rng), 700, 2400) * np.sin(np.linspace(0, math.pi, n)) ** 2 * 0.05
    m = secs(0.05)
    knock = lp(white(m, rng), 500) * decay(m, 0.012) * 0.16
    out = np.concatenate([swish, knock])
    return out


def pigeon_wings(rng):
    out = np.zeros((secs(0.9), 2))
    for k in range(9):
        m = secs(0.045)
        flap = bp(white(m, rng), 350, 2200) * decay(m, 0.012, 0.003)
        place(out, pan(flap, 0.3), 0.075 * k * (1 + 0.04 * k), 0.14 * math.exp(-k / 5))
    return out


def coo(rng):
    n = secs(1.1)
    t = np.arange(n) / SR
    f = 430 + 60 * np.sin(2 * math.pi * 1.7 * t) + 14 * np.sin(2 * math.pi * 26 * t)
    env = np.sin(np.clip(t / 0.45, 0, 1) * math.pi) + 0.7 * np.sin(np.clip((t - 0.55) / 0.5, 0, 1) * math.pi)
    return (tone(f) + 0.25 * tone(2 * f)) * env * 0.05


def skate(rng):
    n = secs(rng.uniform(0.35, 0.8))
    x = bp(white(n, rng), 2600, 7800) * np.sin(np.linspace(0, math.pi, n)) ** 1.5
    return x * slow(n, 25, rng, 0.5, 1.0) * 0.05


def snow_step(rng):
    n = secs(0.22)
    out = np.zeros(n)
    for _ in range(60):
        m = secs(rng.uniform(0.002, 0.012))
        i = int(rng.integers(0, n - m))
        out[i:i + m] += bp(white(m, rng), 900, 5200) * decay(m, 0.003) * rng.uniform(0.2, 1.0)
    return fade(lp(out, 6000) * np.sin(np.linspace(0, math.pi, n)) * 0.12)


def ship_horn(rng, dur=2.6, f=87.0):
    n = secs(dur)
    x = saw(f, n, 14) + saw(f * 1.26, n, 12) * 0.7
    x = lp(x, 700)
    return fade(x * 0.16, 0.25, 0.7)


def distant_voices(n, rng):
    """A murmur with the rhythm of speech but no words."""
    out = np.zeros((n, 2))
    for v in range(9):
        f0 = rng.uniform(110, 240)
        pitch = f0 * (1 + 0.12 * (slow(n, 3.0, rng, -1, 1)))
        src = saw(pitch, partials=10)
        formant = bp(src, rng.uniform(350, 650), rng.uniform(900, 1500))
        syll = np.clip(slow(n, rng.uniform(3.5, 6), rng, -0.6, 1.0), 0, 1) ** 2
        phrase = np.clip(slow(n, 0.45, rng, -0.7, 1.2), 0, 1)
        out += pan(formant * syll * phrase, rng.uniform(-0.9, 0.9)) * 0.03
    return lp(out, 1800)


# ------------------------------------------------------------------ vehicles
def vehicle_track(rng, n, times, dist, panpos, speed, kind, brake, wet, snow):
    """One vehicle heard from the camera, from samples of distance (m), pan, speed (m/s) and braking."""
    t = np.arange(n) / SR
    d = np.interp(t, times, dist)
    p = np.interp(t, times, panpos)
    v = np.interp(t, times, speed)
    present = np.interp(t, times, np.ones(len(times)), left=0.0, right=0.0)
    # radial velocity for doppler
    dd = np.gradient(d) * SR
    dd = lp(dd, 6.0, 1)
    doppler = np.clip(343.0 / (343.0 + np.clip(dd, -30, 30)), 0.9, 1.1)
    heavy = kind >= 4
    base = 34.0 if kind == 5 else 40.0 if kind == 4 else 52.0
    rpm = base + np.minimum(v, 14.0) * (4.2 if heavy else 6.5)
    engine = saw(rpm * doppler, partials=14) * 0.5 + tone(rpm * doppler * 0.5) * 0.35
    engine = lp(engine, 420 if heavy else 620)
    engine *= (0.35 + 0.65 * slow(n, 12, rng, 0.75, 1.0)) * (0.13 if heavy else 0.06)
    road = bp(pink(n, rng), 220, 2600) * np.clip(v / 12.0, 0, 1.3) ** 1.7 * 0.12
    if snow > 0:
        road = lp(road, 900) + bp(white(n, rng), 1500, 3800) * np.clip(v / 12.0, 0, 1) * 0.012 * slow(n, 30, rng, 0.3, 1.0)
    if wet > 0:
        road = road + hp(white(n, rng), 2400) * np.clip(v / 11.0, 0, 1.3) ** 1.5 * 0.055 * wet * slow(n, 7, rng, 0.8, 1.15)
    x = (engine + road * (1.35 if heavy else 1.0)) * present
    # inverse distance with air absorption approximated by a second, darker copy for far sound
    gain = 7.0 / np.maximum(d, 4.0)
    mix = np.clip((d - 12.0) / 70.0, 0, 1)
    x = x * (1 - mix) + lp(x, 750) * mix
    x = x * gain
    a = (np.clip(p, -1, 1) + 1) * math.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


# ------------------------------------------------------------------ master
def limiter(x, ceiling=0.85, release=0.08):
    """Look-ahead peak limiter on a 4x oversampled envelope, so that inter-sample peaks stay under too."""
    up = signal.resample_poly(x, 4, 1, axis=0)
    peak = np.max(np.abs(up), axis=1).reshape(-1)
    peak = peak[:len(x) * 4].reshape(len(x), 4).max(axis=1)
    need = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    look = secs(0.004)
    from scipy.ndimage import minimum_filter1d
    need = minimum_filter1d(need, size=2 * look + 1)
    coeff = math.exp(-1.0 / (release * SR))
    gain = np.empty_like(need)
    g = 1.0
    for i, v in enumerate(need):
        g = v if v < g else min(v, g * coeff + (1 - coeff))
        gain[i] = g
    kernel = np.hanning(look)
    kernel /= kernel.sum()
    gain = np.minimum(gain, np.convolve(gain, kernel, mode="same"))
    return x * gain[:, None]


def write_wav(path, x, bits=24):
    import wave
    x = np.clip(x, -1.0, 1.0)
    if x.ndim == 1:
        x = x[:, None]
    with wave.open(str(path), "wb") as w:
        w.setnchannels(x.shape[1])
        w.setframerate(SR)
        if bits == 16:
            w.setsampwidth(2)
            w.writeframes((x * 32767).astype("<i2").tobytes())
        else:
            w.setsampwidth(3)
            y = (x * 8388607).astype("<i4").reshape(-1)
            raw = y.view(np.uint8).reshape(-1, 4)[:, :3]
            w.writeframes(raw.tobytes())


def loudness(path):
    """(integrated LUFS, true peak dBTP) as measured by ffmpeg's EBU R128 meter."""
    import re
    import subprocess
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True)
    text = r.stderr[r.stderr.rfind("Summary:"):]
    i = float(re.search(r"I:\s+(-?[\d.]+) LUFS", text).group(1))
    tp = float(re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", text).group(1))
    return i, tp


def master(path, x, target=-14.0, peak_db=-1.0):
    """Brings a mix to the target loudness with the true peak under the limit; writes the wav."""
    x = hp(x, 24.0)
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.7
    gain = 1.0
    ceiling = 10 ** ((peak_db - 0.6) / 20)
    result = None
    for _ in range(7):
        y = limiter(x * gain, ceiling)
        write_wav(path, y)
        i, tp = loudness(path)
        result = (i, tp)
        if abs(i - target) < 0.25 and tp <= peak_db:
            break
        gain *= 10 ** ((target - i) / 20)
        if tp > peak_db:
            ceiling *= 10 ** ((peak_db - tp - 0.2) / 20)
    return result
