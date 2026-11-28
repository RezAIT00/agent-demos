"""A drum kit made only from the user's recording.

The four drum noises were not in the file, so each drum below is built by
slicing, re-pitching, filtering and re-shuffling the six noises that were.
No synthesiser, noise generator or outside sample is used: the random numbers
only choose which slice of the recording goes where.
"""
import numpy as np
from scipy.signal import butter, sosfilt
import sampler

sr, SRC = sampler.load_source()


def cut(a, b):
    return SRC[int(a * sr):int(b * sr)].copy()


def filt(x, kind, freq, order=4):
    return sosfilt(butter(order, freq, kind, fs=sr, output="sos"), x)


def unit(x, peak=1.0):
    return x / (np.abs(x).max() + 1e-12) * peak


def decay(n, tau, attack=0.001):
    env = np.exp(-np.arange(n) / (tau * sr))
    a = max(1, int(attack * sr))
    env[:a] *= np.linspace(0, 1, a)
    tail = min(n, int(0.008 * sr))
    env[-tail:] *= np.linspace(1, 0, tail)
    return env


def sweep(x, rates):
    """Play `x` at a speed that changes sample by sample (a pitch bend)."""
    pos = np.cumsum(rates)
    return np.interp(pos % (len(x) - 1), np.arange(len(x)), x)


def shuffle_noise(bands_hz, length, seed, grain_ms=(1.5, 5.0)):
    """Hiss made by scattering tiny high-passed slices of all six noises."""
    rng = np.random.default_rng(seed)
    pools = []
    for a, b, _, _ in sampler.PITCHED.values():
        p = filt(cut(a + 0.08, b - 0.08), "highpass", bands_hz)
        pools.append(p / (np.sqrt(np.mean(p ** 2)) + 1e-12))
    n = int(length * sr)
    out = np.zeros(n + sr // 10)
    at = 0
    while at < n:
        g = int(rng.uniform(*grain_ms) * sr / 1000)
        pool = pools[rng.integers(len(pools))]
        s = rng.integers(0, len(pool) - g)
        piece = pool[s:s + g] * np.hanning(g)
        if rng.random() < 0.5:
            piece = piece[::-1]
        out[at:at + g] += piece * rng.choice([-1.0, 1.0])
        at += g // 3
    return unit(np.tanh(out[:n] * 0.35))


def kick():
    n = int(0.42 * sr)
    body = filt(cut(5.55, 5.72), "lowpass", 220)  # the "o" of Dum
    t = np.arange(n) / sr
    rates = 0.52 + 2.1 * np.exp(-t / 0.028)  # fast downward bend
    low = unit(sweep(body, rates)) * decay(n, 0.13)
    click = unit(filt(cut(5.405, 5.440), "highpass", 1500))  # the "D"
    low[:len(click)] += 0.35 * click * decay(len(click), 0.008)
    return unit(np.tanh(low * 2.2))


def snare():
    n = int(0.30 * sr)
    hiss = filt(shuffle_noise(1400, 0.30, seed=11), "lowpass", 9500, 2) * decay(n, 0.075)
    body_src = filt(cut(1.15, 1.45), "bandpass", [140, 900])  # "Ahh"
    body = unit(sweep(body_src, 1.9 + 1.2 * np.exp(-np.arange(n) / (0.02 * sr)))) * decay(n, 0.045)
    crack = unit(filt(cut(5.405, 5.430), "highpass", 900))
    y = unit(hiss) * 0.9 + body * 0.55
    y[:len(crack)] += 0.6 * crack
    return unit(np.tanh(y * 1.8))


def hat(length=0.09, tau=0.020, seed=23):
    y = filt(shuffle_noise(6500, length, seed=seed, grain_ms=(0.8, 2.5)), "highpass", 6500)
    return unit(y * decay(len(y), tau))


def crash(length=2.4, seed=37):
    a = shuffle_noise(3200, length, seed=seed)
    b = filt(shuffle_noise(5500, length, seed=seed + 1, grain_ms=(0.8, 3.0)), "highpass", 5000)
    y = a * 0.7 + unit(b) * 0.7
    return unit(y * decay(len(y), 0.65, attack=0.002))


def riser(length):
    y = filt(shuffle_noise(2000, length, seed=51), "highpass", 2000)
    return unit(y * np.linspace(0.02, 1, len(y)) ** 2.2)


def tom(hz):
    n = int(0.34 * sr)
    _, voices = None, None
    body = filt(cut(5.52, 5.74), "lowpass", 900)  # Dum
    base = 96.3
    rates = hz / base * (1 + 0.5 * np.exp(-np.arange(n) / (0.03 * sr)))
    return unit(sweep(body, rates) * decay(n, 0.11))


def make_kit():
    return {
        "kick": kick(),
        "snare": snare(),
        "hat": hat(),
        "openhat": hat(0.28, 0.085, seed=29),
        "crash": crash(),
        "tom_hi": tom(196.0),
        "tom_mid": tom(147.0),
        "tom_lo": tom(110.0),
    }
