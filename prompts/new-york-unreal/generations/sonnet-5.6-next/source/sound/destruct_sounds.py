"""The sound of every destruction event, each built from its own recipe of noise, oscillators, resonators
and filters.  No recordings or libraries.  Writes build/audio/destruction/<name>.wav (mono, 48 kHz) for the
game to import; the film mixer uses the same functions.

  venv\\Scripts\\python.exe source\\sound\\destruct_sounds.py [name ...]
"""
import math
import os
import sys
import zlib

import numpy as np
from scipy import signal
from scipy.io import wavfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synth import (SR, bp, brown, decay, fade, hp, lp, norm, pink, reverb, rng_for, saw, secs, slow, softclip, thunder, tone,  # noqa: E402
                   white, wind)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "build", "audio", "destruction")


# ------------------------------------------------------------------ building blocks (mono unless said)
def blank(dur):
    return np.zeros(secs(dur))


def put(bus, snd, at=0.0, gain=1.0):
    i = secs(at)
    m = min(len(snd), len(bus) - i)
    if i >= 0 and m > 0:
        bus[i:i + m] += snd[:m] * gain
    return bus


def line(a, b, dur):
    return np.linspace(a, b, secs(dur))


def sweep(a, b, dur, curve=1.0):
    """Frequency running from a to b on a log scale."""
    u = np.linspace(0, 1, secs(dur)) ** curve
    return a * (b / a) ** u


def click(rng, f=3000.0, tau=0.003, q=0.5):
    n = secs(max(tau * 7, 0.004))
    return bp(white(n, rng), f * (1 - q * 0.5), f * (1 + q)) * decay(n, tau, 0.0002)


def thump(f0, f1, tau, dur=None):
    """A falling sine: the body of a blow or a blast."""
    dur = dur or tau * 6
    n = secs(dur)
    f = sweep(f0, f1, dur, 0.35)
    return tone(f) * decay(n, tau, 0.001)


def hiss_burst(rng, dur, lo, hi, tau, attack=0.002):
    n = secs(dur)
    return bp(white(n, rng), lo, hi) * decay(n, tau, attack)


def ring(rng, freqs, taus, dur, gain=None, jitter=0.004):
    """Struck metal, glass or ceramic: a handful of decaying partials."""
    n = secs(dur)
    out = np.zeros(n)
    for i, (f, t) in enumerate(zip(freqs, taus)):
        a = gain[i] if gain is not None else 1.0 / (1 + i * 0.35)
        out += tone(f * (1 + rng.uniform(-jitter, jitter)), n, rng.uniform(0, 6.28)) * decay(n, t, 0.0005) * a
    return out


def crackle(rng, dur, rate, f_lo, f_hi, tau=0.004, shape=None):
    """Many small independent breaks: gravel, splinters, fire, falling glass."""
    out = blank(dur)
    count = int(rate * dur)
    kinds = [click(rng, rng.uniform(f_lo, f_hi), tau * rng.uniform(0.4, 2.0), 0.8) for _ in range(24)]
    kinds = [norm(k) for k in kinds]
    for _ in range(count):
        at = rng.uniform(0, dur)
        a = rng.random() ** 2.2
        if shape is not None:
            a *= shape(at / dur)
        put(out, kinds[int(rng.integers(len(kinds)))], at, a)
    return out


def glass(rng, dur=1.4, amount=1.0):
    """A pane going: one sharp report and then pieces raining down."""
    out = blank(dur)
    put(out, hiss_burst(rng, 0.12, 2500, 14000, 0.025, 0.0004), 0, 0.9)
    for _ in range(int(150 * amount)):
        at = 0.01 + rng.random() ** 1.7 * (dur - 0.12)
        f = rng.uniform(2600, 9500)
        put(out, ring(rng, [f, f * rng.uniform(1.37, 2.2)], [rng.uniform(0.006, 0.05)] * 2, 0.09), at,
            rng.uniform(0.03, 0.22) * math.exp(-at * 1.4))
    return out


def debris(rng, dur, rate=90.0, heavy=0.5):
    """Rubble coming to rest: knocks of many sizes thinning out."""
    out = blank(dur)
    for _ in range(int(rate * dur)):
        at = rng.random() ** 1.8 * dur
        size = rng.random() ** 3
        if rng.random() < heavy * 0.25:
            s = thump(70 + 120 * (1 - size), 38, 0.03 + 0.06 * size) * 0.7
            put(out, s, at, (0.15 + size) * math.exp(-at / (dur * 0.5)))
        m = secs(0.02 + size * 0.09)
        f = 2600 * (1 - size) + 220
        put(out, bp(white(m, rng), f * 0.55, f * 1.6) * decay(m, 0.004 + size * 0.02), at, (0.12 + size) * math.exp(-at / (dur * 0.55)))
    return out


def explosion(rng, size, bright=1.0, tail=1.0, crack_gain=1.0, rubble=1.0):
    """size 0..1.4: a firecracker's cousin up to a city-sized detonation."""
    dur = 0.5 + 5.5 * size * tail
    out = blank(dur + 0.4)
    # the crack
    put(out, hiss_burst(rng, 0.05 + 0.1 * size, 300 + 900 * (1 - size), 4000 + 9000 * bright, 0.006 + 0.02 * size, 0.0003), 0, 1.0 * crack_gain)
    # the punch
    put(out, softclip(thump(150 - 70 * min(size, 1), 28 - 8 * min(size, 1), 0.07 + 0.42 * size) * 1.6, 2.2), 0.004, 0.95)
    # the roar of expanding gas
    n = secs(dur)
    roar = lp(brown(n, rng), 260 + 900 * (1 - size) * bright) * decay(n, 0.12 + 0.9 * size * tail, 0.008)
    roar *= 0.75 + 0.5 * slow(n, 11, rng, 0, 1)
    put(out, softclip(roar * 0.55, 1.8), 0.01, 0.9)
    air = bp(pink(n, rng), 500, 2600 + 3000 * bright) * decay(n, 0.07 + 0.35 * size, 0.004)
    put(out, air * 0.22, 0.008, bright)
    if rubble > 0:
        put(out, debris(rng, max(dur * 0.8, 0.4), 40 + 90 * size, 0.3 + 0.5 * size), 0.12 + 0.25 * size, 0.28 * rubble)
    return out


def rumble(rng, dur, f=90.0, wobble=3.0, swell=0.35):
    n = secs(dur)
    x = lp(brown(n, rng), f) * (0.45 + 0.55 * slow(n, wobble, rng, 0, 1))
    return fade(x * 0.45, dur * swell, dur * 0.4)


def whoosh(rng, dur, f0, f1, width=0.6, peak=0.6):
    n = secs(dur)
    src = pink(n, rng)
    out = np.zeros(n)
    steps = 24
    edges = np.linspace(0, n, steps + 1).astype(int)
    for k in range(steps):
        f = f0 * (f1 / f0) ** (k / (steps - 1))
        a, b = edges[k], min(edges[k + 1] + 600, n)
        seg = bp(src[a:b], f * (1 - width * 0.5), f * (1 + width))
        w = np.ones(b - a)
        r = min(600, b - a)
        w[:r] *= np.linspace(0, 1, r)
        w[-r:] *= np.linspace(1, 0, r)
        out[a:b] += seg * w
    t = np.linspace(0, 1, n)
    env = np.where(t < peak, (t / peak) ** 2, ((1 - t) / max(1 - peak, 1e-3)) ** 1.4)
    return out * env * 0.6


def whistle(rng, dur, f0, f1, noise=0.25):
    n = secs(dur)
    f = sweep(f0, f1, dur) * (1 + 0.006 * tone(7.0, n))
    x = tone(f) * 0.6 + tone(f * 2.01) * 0.12
    x += bp(white(n, rng), min(f0, f1) * 0.8, max(f0, f1) * 1.3) * noise
    return x * np.linspace(0.12, 1.0, n) ** 2


def metal_hit(rng, base, dur=1.6, bright=1.0):
    ratios = [1.0, 2.32, 3.87, 4.9, 6.71, 8.43, 11.2]
    taus = [dur * 0.34, dur * 0.25, dur * 0.18, dur * 0.12, dur * 0.09, dur * 0.06, dur * 0.04]
    x = ring(rng, [base * r for r in ratios], taus, dur, jitter=0.03)
    put(x, hiss_burst(rng, 0.05, 900, 9000, 0.008, 0.0003), 0, 1.2 * bright)
    return x * 0.5


def crunch_metal(rng, size=1.0):
    dur = 0.7 + size
    out = blank(dur)
    for k in range(int(14 + 20 * size)):
        at = rng.random() ** 2 * dur * 0.5
        put(out, metal_hit(rng, rng.uniform(130, 900), rng.uniform(0.12, 0.6), rng.uniform(0.4, 1.0)), at, rng.uniform(0.1, 0.5) * math.exp(-at * 3))
    n = secs(dur * 0.6)
    put(out, softclip(bp(pink(n, rng), 180, 3500) * decay(n, 0.09 + 0.1 * size, 0.002) * (0.4 + slow(n, 40, rng)), 2.5), 0, 0.7)
    put(out, thump(120, 42, 0.09 + 0.08 * size), 0, 0.9)
    return out


def wood_crack(rng, size=1.0):
    dur = 0.5 + size * 0.7
    out = blank(dur)
    for k in range(int(5 + 12 * size)):
        at = rng.random() ** 2.4 * dur * 0.6
        f = rng.uniform(260, 1500)
        put(out, ring(rng, [f, f * 1.9, f * 3.3], [0.025, 0.012, 0.007], 0.12), at, rng.uniform(0.25, 0.8))
        put(out, click(rng, rng.uniform(1500, 5200), 0.004), at, rng.uniform(0.3, 0.9))
    return out


def engine(rng, dur, f0, f1, rough=0.35, whine=0.0):
    n = secs(dur)
    f = sweep(f0, f1, dur) * (1 + 0.025 * (slow(n, 12, rng) - 0.5))
    x = saw(f, partials=26) * 0.6 + saw(f * 0.5, partials=12) * 0.35
    fire = (0.5 + 0.5 * tone(f * 0.5)) ** 3
    x = x * (1 - rough + rough * fire * 2.4)
    x += lp(brown(n, rng), 380) * 0.14 + bp(pink(n, rng), 700, 2600) * 0.04
    if whine:
        x += tone(f * 14) * whine * 0.12
    return fade(lp(softclip(x, 1.6), 2400), 0.08, 0.3) * 0.7


def siren_tone(freq, dur, vib=0.0, rate=6.0):
    n = secs(dur)
    f = np.full(n, freq) if np.isscalar(freq) else freq
    return tone(f * (1 + vib * tone(rate, len(f))))


def zap(rng, dur, pitch=1.0, gate=60.0):
    n = secs(dur)
    buzz = saw(115 * pitch * (1 + 0.3 * (slow(n, 30, rng) - 0.5)), partials=30)
    sput = bp(white(n, rng), 2200, 11000)
    on = (slow(n, gate, rng) > 0.46).astype(float)
    on = lp(on, 900)
    return fade((buzz * 0.5 + sput * 0.55) * on * (0.5 + slow(n, 17, rng)), 0.002, dur * 0.4)


def water(rng, dur, lo=300, hi=5200, gush=0.4):
    n = secs(dur)
    x = bp(white(n, rng), lo, hi) * 0.28 * (1 - gush + gush * slow(n, 13, rng, 0, 1.6))
    x += bp(pink(n, rng), 90, 600) * 0.2 * slow(n, 5, rng, 0.4, 1.2)
    for _ in range(int(dur * 60)):
        at = rng.uniform(0, dur - 0.08)
        m = secs(rng.uniform(0.015, 0.05))
        f = rng.uniform(300, 1800)
        put(x, tone(f * (1 + np.linspace(0, 0.8, m))) * decay(m, 0.012), at, rng.uniform(0.03, 0.16))
    return x


def horn_chord(rng, freqs, dur, dirt=0.15, drift=0.0):
    n = secs(dur)
    x = np.zeros(n)
    for f in freqs:
        x += saw(f * (1 + drift * np.linspace(0, 1, n)) * (1 + 0.004 * tone(5.1, n, rng.uniform(0, 6))), partials=22)
    x = softclip(x / len(freqs) * 1.7, 1.5) + bp(pink(n, rng), 200, 1400) * dirt * 0.15
    return fade(lp(x, 2600), 0.06, 0.25)


def piano_note(rng, f, dur=3.2):
    n = secs(dur)
    out = np.zeros(n)
    for k in range(1, 11):
        fk = f * k * math.sqrt(1 + 0.0004 * k * k)
        if fk > 12000:
            break
        out += tone(fk, n, rng.uniform(0, 6)) * decay(n, dur * 0.45 / (1 + 0.35 * k), 0.002) / k ** 1.15
    return out


def bell_tone(rng, f, dur=1.6):
    return ring(rng, [f, f * 2.0, f * 2.76, f * 5.4, f * 8.9], [dur * 0.4, dur * 0.28, dur * 0.2, dur * 0.1, dur * 0.05], dur, jitter=0.002)


def seq(items, dur):
    """items: (time, signal, gain)."""
    out = blank(dur)
    for at, s, g in items:
        put(out, s, at, g)
    return out


def room(x, rt=1.6, wet=0.22, damp=3200.0):
    """The canyon the street makes: reverb, folded to mono."""
    y = reverb(x, rt, wet, damp=damp, predelay=0.028, tail=True)
    return y.mean(axis=1)


# ------------------------------------------------------------------ recipes: name -> (loudness, builder)
def R():
    table = {}

    def add(name, level, fn, rt=1.4, wet=0.2, damp=3500.0):
        table[name] = (level, fn, rt, wet, damp)

    # ---------------- hand tools
    add("sling", 0.30, lambda r: seq([(0, whoosh(r, 0.22, 500, 2600), 1.0), (0.0, thump(220, 110, 0.02), 0.5)], 0.35), 0.5, 0.08)
    add("tick_glass", 0.35, lambda r: glass(r, 0.45, 0.18) + seq([(0, ring(r, [3900, 6150], [0.05, 0.03], 0.12), 0.8)], 0.45), 0.8, 0.12)
    add("thock", 0.30, lambda r: seq([(0, ring(r, [430, 910, 1620], [0.03, 0.018, 0.01], 0.15), 1.0), (0, click(r, 2200, 0.004), 0.5)], 0.22), 0.6, 0.1)
    add("bat_crack", 0.55, lambda r: seq([(0, click(r, 2600, 0.008, 1.0), 1.0), (0, ring(r, [880, 2100, 3350], [0.02, 0.012, 0.008], 0.1), 0.8)], 0.2), 1.1, 0.25)
    add("marbles", 0.35, lambda r: seq([(r.uniform(0, 1.4), ring(r, [r.uniform(2400, 5200), r.uniform(6000, 8800)], [0.03, 0.015], 0.1), r.uniform(0.2, 1.0)) for _ in range(46)], 1.6), 0.7, 0.12)
    add("hammer", 0.45, lambda r: seq([(0, metal_hit(r, 1350, 0.35, 1.0), 0.6), (0, thump(260, 140, 0.025), 0.8), (0.01, debris(r, 0.5, 60, 0.0), 0.4)], 0.6), 0.9, 0.16)
    add("creak", 0.40, lambda r: fade(bp(saw(sweep(62, 148, 1.1, 1.6) * (1 + 0.1 * (slow(secs(1.1), 22, r) - 0.5)), partials=30), 280, 2400) * (0.3 + slow(secs(1.1), 31, r)), 0.1, 0.2))
    add("pick", 0.45, lambda r: seq([(0, metal_hit(r, 2250, 0.5, 0.8), 0.5), (0, thump(190, 90, 0.03), 0.7), (0.015, crackle(r, 0.55, 90, 900, 4200), 0.6)], 0.7), 0.9, 0.16)
    add("axe", 0.48, lambda r: seq([(0, wood_crack(r, 0.35), 0.9), (0, metal_hit(r, 1750, 0.3, 0.5), 0.35), (0, thump(170, 70, 0.04), 0.8)], 0.8), 0.9, 0.16)
    add("sledge", 0.65, lambda r: seq([(0, thump(130, 45, 0.09), 1.0), (0, hiss_burst(r, 0.12, 250, 3800, 0.02), 0.8), (0.03, debris(r, 0.9, 80, 0.4), 0.55)], 1.1), 1.2, 0.2)
    add("pop", 0.45, lambda r: seq([(0, click(r, 1400, 0.01, 1.2), 1.0), (0, thump(300, 120, 0.015), 0.7)], 0.12), 1.0, 0.25)
    add("bang_small", 0.55, lambda r: explosion(r, 0.08, 1.2, 0.8, 1.2, 0.2), 1.3, 0.28)
    add("chainsaw", 0.55, lambda r: fade(engine(r, 3.2, 92, 118, 0.7, 0.6) + bp(white(secs(3.2), r), 1800, 6500) * 0.16 * (0.4 + slow(secs(3.2), 7, r)), 0.15, 0.4), 0.8, 0.12)
    add("timber", 0.55, lambda r: seq([(0, wood_crack(r, 1.0), 1.0), (0.2, fade(bp(saw(sweep(140, 70, 0.9), partials=20), 200, 1800), 0.1, 0.3), 0.35), (0.85, thump(80, 38, 0.12), 0.9), (0.85, crackle(r, 0.6, 90, 700, 4200), 0.6)], 1.7), 1.2, 0.18)
    add("torch", 0.35, lambda r: fade(bp(white(secs(3.4), r), 2400, 9000) * 0.5 + bp(pink(secs(3.4), r), 700, 2200) * 0.2, 0.05, 0.3) + crackle(r, 3.4, 38, 2000, 7000) * 0.5, 0.6, 0.08)
    add("clang", 0.55, lambda r: metal_hit(r, r.uniform(290, 340), 1.8, 0.9), 1.6, 0.25)
    add("jackhammer", 0.62, lambda r: seq([(i * 0.062, seq([(0, thump(160, 70, 0.016), 1.0), (0, metal_hit(r, 920, 0.07, 0.8), 0.45), (0, click(r, 3300, 0.006), 0.5)], 0.1), r.uniform(0.8, 1.0)) for i in range(48)], 3.1), 1.0, 0.18)
    # ---------------- charges and fire
    add("pin", 0.25, lambda r: seq([(0, ring(r, [3100, 5300], [0.04, 0.02], 0.1), 0.7), (0.09, ring(r, [1900, 4400], [0.03, 0.02], 0.1), 0.5)], 0.25), 0.4, 0.06)
    add("grenade", 0.85, lambda r: explosion(r, 0.28, 1.2, 0.7, 1.4, 0.7) + 0, 1.8, 0.3)
    add("flare", 0.35, lambda r: seq([(0, hiss_burst(r, 0.4, 900, 6000, 0.12), 0.7), (0.1, fade(bp(white(secs(2.6), r), 1500, 7000) * (0.5 + slow(secs(2.6), 24, r)) * 0.4, 0.2, 0.7), 1.0)], 2.8), 0.7, 0.1)
    add("firework", 0.65, lambda r: seq([(0, explosion(r, 0.16, 1.5, 0.6, 1.0, 0), 0.9), (0.12, crackle(r, 1.6, 150, 2200, 9000, 0.003, lambda u: 1 - u), 0.9)], 2.0), 2.4, 0.35)
    add("whistle_up", 0.4, lambda r: whistle(r, 1.0, 900, 2600, 0.2) * np.linspace(1, 0.3, secs(1.0)), 1.4, 0.25)
    add("hiss", 0.35, lambda r: fade(bp(white(secs(1.8), r), 2500, 10000) * 0.35, 0.05, 0.4), 0.5, 0.06)
    add("fuse", 0.3, lambda r: fade(bp(white(secs(2.2), r), 3000, 11000) * 0.25 * (0.4 + slow(secs(2.2), 33, r)), 0.02, 0.1) + crackle(r, 2.2, 55, 2500, 8000) * 0.5, 0.4, 0.05)
    add("blast_small", 0.8, lambda r: explosion(r, 0.2, 1.1, 0.8, 1.1, 0.7), 1.9, 0.28)
    add("blast_med", 0.9, lambda r: explosion(r, 0.45, 1.0, 0.85, 1.0, 1.0), 2.2, 0.28)
    add("blast_big", 0.97, lambda r: explosion(r, 0.72, 0.85, 0.9, 1.0, 1.1), 2.8, 0.3, 2600)
    add("blast_huge", 1.0, lambda r: explosion(r, 0.95, 0.75, 1.05, 1.0, 1.2), 3.4, 0.32, 2200)
    add("blast_deep", 0.95, lambda r: seq([(0, thump(70, 22, 0.55), 1.0), (0.05, rumble(r, 4.2, 120, 6, 0.05), 1.0), (0.0, hiss_burst(r, 0.4, 100, 900, 0.1), 0.6), (0.5, debris(r, 2.6, 60, 0.9), 0.35)], 4.6), 2.6, 0.25, 1500)
    add("breach", 0.85, lambda r: seq([(0, explosion(r, 0.24, 1.4, 0.55, 1.5, 0.4), 1.0), (0.02, metal_hit(r, 420, 0.8, 0.8), 0.45), (0.05, glass(r, 1.2, 0.7), 0.4)], 1.8), 1.7, 0.28)
    add("beep", 0.2, lambda r: seq([(i * 0.22, fade(tone(2350, secs(0.07)), 0.004, 0.01), 0.6) for i in range(4)], 0.9), 0.4, 0.05)
    add("crack_charge", 0.82, lambda r: seq([(0, hiss_burst(r, 0.07, 500, 12000, 0.009, 0.0002), 1.4), (0, thump(180, 48, 0.07), 0.9), (0.04, debris(r, 0.9, 90, 0.3), 0.35)], 1.1), 2.0, 0.34)
    add("thermite", 0.45, lambda r: fade(bp(white(secs(5.5), r), 1200, 9000) * (0.35 + 0.5 * slow(secs(5.5), 19, r)) * 0.45, 0.25, 1.2) + crackle(r, 5.5, 80, 1500, 7000) * 0.6, 0.8, 0.1)
    add("glass", 0.5, lambda r: glass(r, 1.7, 1.0), 1.2, 0.18, 9000)
    add("dust_surge", 0.7, lambda r: seq([(0, fade(bp(pink(secs(5.0), r), 60, 1100) * (0.5 + slow(secs(5.0), 6, r)) * 0.4, 0.5, 2.4), 1.0), (0, rumble(r, 5.0, 130, 5, 0.1), 0.8), (0.2, debris(r, 4.0, 45, 0.7), 0.35)], 5.2), 2.2, 0.2, 2000)
    add("fire", 0.4, lambda r: fade(crackle(r, 5.0, 95, 500, 4800, 0.006) * 0.8 + lp(brown(secs(5.0), r), 420) * 0.22 * (0.5 + slow(secs(5.0), 8, r)), 0.4, 1.0), 0.7, 0.1)
    add("water", 0.55, lambda r: fade(water(r, 6.0), 0.2, 1.5), 0.9, 0.14, 7000)
    add("rocket_burn", 0.55, lambda r: fade(bp(pink(secs(2.6), r), 200, 4200) * (0.6 + 0.8 * slow(secs(2.6), 38, r)) * 0.45, 0.05, 0.7), 1.3, 0.2)
    # ---------------- machines
    add("crash_small", 0.6, lambda r: crunch_metal(r, 0.35) + seq([(0.05, glass(r, 0.8, 0.4), 0.45)], 1.05), 1.4, 0.22)
    add("engine", 0.45, lambda r: engine(r, 3.4, 58, 92, 0.4), 0.9, 0.14)
    add("engine_rev", 0.55, lambda r: seq([(0, engine(r, 1.4, 55, 205, 0.35, 0.2), 0.9), (1.3, engine(r, 2.2, 120, 230, 0.35, 0.2), 1.0)], 3.6), 1.2, 0.18)
    add("crash_car", 0.85, lambda r: seq([(0, crunch_metal(r, 0.9), 1.0), (0.04, glass(r, 1.5, 0.9), 0.6), (0.3, debris(r, 1.2, 40, 0.2), 0.3)], 2.2), 1.7, 0.26)
    add("engine_heavy", 0.6, lambda r: engine(r, 5.5, 36, 52, 0.6, 0.1) + 0, 1.0, 0.16, 1800)
    add("crash_heavy", 0.95, lambda r: seq([(0, crunch_metal(r, 1.6), 1.0), (0, thump(85, 28, 0.22), 1.0), (0.1, debris(r, 2.4, 80, 0.8), 0.6), (0.08, glass(r, 1.8, 0.8), 0.35)], 3.0), 2.2, 0.28, 2800)
    add("crunch", 0.7, lambda r: seq([(0, softclip(bp(pink(secs(0.8), r), 90, 2200) * (0.3 + slow(secs(0.8), 48, r)) * decay(secs(0.8), 0.25, 0.01), 2.8), 0.8), (0, crackle(r, 0.9, 120, 400, 3000, 0.007), 0.8), (0, thump(95, 40, 0.1), 0.6)], 1.0), 1.5, 0.2, 2600)
    add("hydraulic", 0.4, lambda r: fade(tone(sweep(190, 265, 2.4)) * 0.3 + saw(sweep(95, 132, 2.4), partials=9) * 0.25 + bp(white(secs(2.4), r), 1500, 5500) * 0.09, 0.15, 0.35), 0.8, 0.12)
    add("wrecking_hit", 1.0, lambda r: seq([(0, thump(90, 26, 0.3), 1.0), (0, metal_hit(r, 130, 2.4, 0.5), 0.55), (0, hiss_burst(r, 0.2, 150, 3000, 0.05), 0.8), (0.07, debris(r, 2.8, 110, 0.9), 0.65)], 3.2), 2.4, 0.28, 2600)
    add("pile_hit", 0.9, lambda r: seq([(0, thump(105, 34, 0.15), 1.0), (0, metal_hit(r, 245, 1.2, 1.0), 0.6), (0.04, debris(r, 0.9, 60, 0.5), 0.35)], 1.5), 2.2, 0.32)
    add("whoosh_heavy", 0.55, lambda r: whoosh(r, 1.5, 90, 700, 0.8, 0.75), 1.0, 0.15)
    add("steel_groan", 0.65, lambda r: fade(bp(saw(sweep(74, 49, 3.2) * (1 + 0.08 * (slow(secs(3.2), 7, r) - 0.5)), partials=34), 120, 1900) * (0.35 + slow(secs(3.2), 9, r)), 0.5, 0.8) + seq([(r.uniform(0.2, 2.6), metal_hit(r, r.uniform(160, 700), 0.7, 0.4), r.uniform(0.1, 0.35)) for _ in range(7)], 3.2), 2.6, 0.35, 2600)
    add("horn_warning", 0.55, lambda r: seq([(0, horn_chord(r, [311, 392], 0.9), 1.0), (1.15, horn_chord(r, [311, 392], 0.9), 1.0), (2.3, horn_chord(r, [311, 392], 1.5), 1.0)], 3.9), 2.2, 0.3)
    # ---------------- ordnance
    add("cannon", 0.92, lambda r: seq([(0, explosion(r, 0.42, 0.7, 0.8, 1.2, 0), 1.0), (0, thump(120, 34, 0.18), 0.7)], 3.0), 3.0, 0.36, 2400)
    add("mortar_thump", 0.65, lambda r: seq([(0, thump(165, 62, 0.07), 1.0), (0, ring(r, [210, 480, 760], [0.12, 0.07, 0.04], 0.4), 0.45), (0, hiss_burst(r, 0.12, 300, 2600, 0.03), 0.5)], 0.7), 1.8, 0.3)
    add("tank_fire", 0.98, lambda r: seq([(0, hiss_burst(r, 0.09, 200, 10000, 0.014, 0.0002), 1.4), (0, explosion(r, 0.55, 1.0, 0.7, 1.2, 0), 0.9), (0.02, metal_hit(r, 690, 0.6, 0.3), 0.2)], 3.0), 2.8, 0.34)
    add("whistle_down", 0.5, lambda r: whistle(r, 1.35, 2100, 620, 0.15), 1.3, 0.2)
    add("rocket_launch", 0.7, lambda r: seq([(0, hiss_burst(r, 0.5, 300, 7000, 0.18), 1.0), (0.05, whoosh(r, 1.5, 2400, 350, 0.9, 0.15), 1.0), (0, thump(110, 55, 0.06), 0.5)], 1.7), 1.6, 0.26)
    add("rocket_big", 0.8, lambda r: seq([(0, fade(bp(pink(secs(3.0), r), 90, 3200) * (0.7 + 0.7 * slow(secs(3.0), 27, r)) * 0.5, 0.3, 0.9), 1.0), (0, rumble(r, 3.0, 150, 12, 0.2), 0.8)], 3.1), 1.8, 0.24)
    add("cannon_far", 0.7, lambda r: lp(explosion(r, 0.6, 0.4, 1.0, 0.7, 0), 700), 4.0, 0.5, 900)
    add("suck_back", 0.65, lambda r: whoosh(r, 0.75, 4200, 90, 0.9, 0.9) + 0, 1.0, 0.15)
    # ---------------- hazards and weather
    add("burst", 0.8, lambda r: seq([(0, thump(100, 40, 0.13), 1.0), (0, hiss_burst(r, 0.7, 250, 5000, 0.22), 0.7), (0.08, water(r, 1.8) * np.linspace(1, 0, secs(1.8)), 0.8), (0.1, debris(r, 1.5, 60, 0.5), 0.35)], 2.2), 1.7, 0.24)
    add("rumble_short", 0.6, lambda r: rumble(r, 1.8, 95, 7, 0.4), 1.2, 0.12, 1000)
    add("rumble_long", 0.7, lambda r: rumble(r, 7.0, 105, 5, 0.25) + debris(r, 7.0, 14, 0.9) * 0.18, 2.0, 0.2, 1100)
    add("quake", 0.95, lambda r: rumble(r, 11.0, 85, 6, 0.15) * 1.4 + rumble(r, 11.0, 38, 3, 0.2) + debris(r, 11.0, 26, 0.9) * 0.3 + crackle(r, 11.0, 22, 120, 900, 0.02) * 0.5, 2.2, 0.2, 1200)
    add("zap_big", 0.8, lambda r: seq([(0, hiss_burst(r, 0.1, 1000, 14000, 0.02, 0.0002), 1.2), (0, zap(r, 1.4, 0.8, 38), 0.9), (0, thump(95, 34, 0.14), 0.7)], 1.5), 1.8, 0.24, 9000)
    add("zap", 0.55, lambda r: zap(r, 0.4, 1.25, 75), 1.2, 0.2, 9000)
    add("hail", 0.6, lambda r: fade(crackle(r, 9.5, 260, 900, 6500, 0.004) * 0.9 + crackle(r, 9.5, 45, 220, 900, 0.012) * 0.8 + wind(secs(9.5), r, 0.5, 0.2).mean(axis=1) * 0.6, 1.2, 2.0), 0.9, 0.14, 7000)
    add("thunder_close", 1.0, lambda r: thunder(r, 130.0, 1.0, True).mean(axis=1), 2.0, 0.12)
    add("gust", 0.8, lambda r: seq([(0, whoosh(r, 3.6, 130, 950, 0.9, 0.32), 1.0), (0, wind(secs(3.6), r, 1.0, 0.5).mean(axis=1) * np.linspace(0.3, 1, secs(3.6)), 0.8), (1.0, rumble(r, 2.2, 110, 8, 0.1), 0.6)], 4.0), 1.5, 0.18)
    add("blizzard", 0.55, lambda r: fade(wind(secs(11.0), r, 1.0, 0.8).mean(axis=1) + bp(white(secs(11.0), r), 3000, 9000) * 0.05 * slow(secs(11.0), 2.2, r, 0.2, 1.2), 2.0, 2.5), 1.0, 0.12)
    add("hurricane", 0.85, lambda r: fade(wind(secs(10.5), r, 1.0, 1.0).mean(axis=1) * 1.3 + bp(pink(secs(10.5), r), 90, 1600) * 0.22 * slow(secs(10.5), 2.4, r, 0.4, 1.3) + crackle(r, 10.5, 40, 300, 3200, 0.008) * 0.35, 1.5, 2.0), 1.2, 0.14)
    add("tornado", 0.95, lambda r: fade(lp(brown(secs(13.0), r), 340) * 0.4 * (0.7 + 0.6 * slow(secs(13.0), 9, r)) + bp(pink(secs(13.0), r), 250, 900) * 0.28 * slow(secs(13.0), 3.5, r, 0.5, 1.2) + bp(white(secs(13.0), r), 650, 760) * 0.1 * slow(secs(13.0), 1.1, r) + debris(r, 13.0, 22, 0.8) * 0.22, 2.5, 2.8), 1.4, 0.14, 2500)
    add("flood", 0.8, lambda r: fade(water(r, 10.0, 160, 4200, 0.6) * 1.1 + rumble(r, 10.0, 130, 9, 0.2) * 0.8 + debris(r, 10.0, 12, 0.8) * 0.25, 1.6, 2.4), 1.5, 0.18, 5000)
    add("tsunami", 1.0, lambda r: fade(rumble(r, 13.0, 95, 5, 0.3) * 1.3 + water(r, 13.0, 90, 3000, 0.7) * 1.2 + bp(pink(secs(13.0), r), 120, 900) * 0.25 * np.linspace(0.2, 1.0, secs(13.0)) + debris(r, 13.0, 28, 0.9) * 0.3, 3.5, 3.0), 2.0, 0.2, 3000)
    add("eruption", 1.0, lambda r: seq([(0, explosion(r, 1.0, 0.6, 1.0, 0.9, 0.6), 1.0), (0.4, rumble(r, 12.0, 100, 11, 0.05), 1.1), (0.4, fade(bp(pink(secs(12.0), r), 300, 2600) * 0.2 * slow(secs(12.0), 14, r, 0.2, 1.4), 0.4, 3.0), 1.0), (0.8, crackle(r, 11.0, 30, 300, 2800, 0.012), 0.4)], 13.0), 2.8, 0.24, 2200)
    # ---------------- absurd
    add("squeak", 0.75, lambda r: seq([(0, fade(tone(sweep(620, 1480, 0.17)) * 0.6 + tone(sweep(1240, 2960, 0.17)) * 0.3 + bp(white(secs(0.17), r), 1200, 3800) * 0.1, 0.01, 0.03), 1.0), (0.24, fade(tone(sweep(1350, 540, 0.26)) * 0.5 + tone(sweep(2700, 1080, 0.26)) * 0.25, 0.01, 0.07), 0.9)], 0.55), 1.8, 0.28, 6000)
    add("thud_giant", 0.85, lambda r: seq([(0, thump(75, 24, 0.24), 1.0), (0, hiss_burst(r, 0.25, 80, 900, 0.07), 0.7), (0.06, debris(r, 1.4, 60, 0.7), 0.35)], 1.8), 1.8, 0.24, 1800)
    add("bowling_roll", 0.8, lambda r: fade(lp(brown(secs(8.5), r), 210) * 0.5 * (0.65 + 0.35 * (0.5 + 0.5 * tone(sweep(2.2, 6.8, 8.5)))) + bp(pink(secs(8.5), r), 300, 1100) * 0.08, 2.5, 0.3), 1.6, 0.2, 1400)
    add("bowling_strike", 1.0, lambda r: seq([(0, thump(95, 30, 0.2), 1.0)] + [(r.uniform(0.0, 0.7) ** 1.5, ring(r, [r.uniform(380, 900), r.uniform(1100, 2300), r.uniform(2600, 4000)], [0.09, 0.05, 0.03], 0.35), r.uniform(0.2, 0.7)) for _ in range(34)] + [(0, crunch_metal(r, 1.2), 0.7), (0.1, debris(r, 2.0, 70, 0.8), 0.5)], 3.0), 2.4, 0.3)
    add("plunger", 0.55, lambda r: seq([(0, fade(tone(sweep(95, 330, 0.55)) * 0.4 + saw(sweep(47, 165, 0.55), partials=8) * 0.25, 0.05, 0.02), 1.0), (0.55, metal_hit(r, 640, 0.5, 1.0), 0.8)], 1.1), 1.2, 0.2)
    add("bell", 0.7, lambda r: seq([(0, bell_tone(r, 1175, 1.5), 0.8), (0, click(r, 3500, 0.004), 0.4)], 1.6), 1.9, 0.28, 9000)
    add("anvil", 0.65, lambda r: seq([(0, ring(r, [715, 1790, 2860, 4170, 5320], [0.55, 0.42, 0.25, 0.16, 0.1], 1.4), 0.55), (0, thump(140, 55, 0.06), 0.8), (0, click(r, 4200, 0.005), 0.7)], 1.5), 1.7, 0.26, 8000)
    add("piano_crash", 1.0, lambda r: seq([(r.uniform(0, 0.05), piano_note(r, f, 3.6), 0.34) for f in (41.2, 43.65, 61.7, 65.4, 87.3, 92.5, 130.8, 138.6, 185.0, 196.0, 277.2, 293.7, 415.3, 440.0)] + [(0, wood_crack(r, 1.3), 1.0), (0, thump(90, 35, 0.15), 0.9)] + [(r.uniform(0.2, 1.8), piano_note(r, r.uniform(120, 1500), 1.0), r.uniform(0.04, 0.18)) for _ in range(18)], 4.2), 2.2, 0.28, 6000)
    add("boot_stomp", 1.0, lambda r: seq([(0, thump(62, 19, 0.45), 1.0), (0, hiss_burst(r, 0.5, 60, 1200, 0.13), 0.9), (0.02, softclip(lp(brown(secs(1.8), r), 180) * decay(secs(1.8), 0.4, 0.004) * 0.7, 2.0), 0.9), (0.15, debris(r, 2.4, 90, 0.9), 0.45)], 2.8), 2.4, 0.26, 1500)
    add("gravity_up", 0.65, lambda r: seq([(0, fade(tone(sweep(60, 520, 5.2, 0.7)) * 0.3 + tone(sweep(90, 782, 5.2, 0.7)) * 0.18 + tone(sweep(120.7, 1043, 5.2, 0.7)) * 0.1, 0.4, 0.4), 0.8), (0, whoosh(r, 2.2, 120, 1900, 0.7, 0.6), 0.7)], 5.4), 2.6, 0.4, 6000)
    add("gravity_slam", 1.0, lambda r: seq([(0, fade(tone(sweep(780, 38, 0.9, 0.5)) * 0.5, 0.01, 0.1), 0.8), (0.85, thump(70, 21, 0.4), 1.0), (0.85, explosion(r, 0.55, 0.4, 0.8, 0.5, 1.5), 0.8)], 4.2), 2.6, 0.3, 2400)
    add("balloon_inflate", 0.35, lambda r: fade(bp(white(secs(2.4), r), 800, 3600) * 0.2 * (0.6 + 0.4 * tone(sweep(5, 12, 2.4))) + tone(sweep(240, 520, 2.4)) * 0.08, 0.1, 0.4), 0.8, 0.1)
    add("balloon_pop", 0.6, lambda r: seq([(0, hiss_burst(r, 0.06, 500, 11000, 0.007, 0.0002), 1.3), (0, thump(390, 160, 0.012), 0.7), (0.008, hiss_burst(r, 0.12, 1800, 7000, 0.03), 0.25)], 0.2), 1.6, 0.32, 9000)
    add("spring_load", 0.55, lambda r: fade(bp(saw(sweep(52, 240, 1.85, 1.8), partials=26), 160, 2600) * (0.55 + 0.45 * tone(sweep(7, 34, 1.85))), 0.2, 0.03) + seq([(1.85 * (i / 14) ** 0.7, metal_hit(r, 500 + 70 * i, 0.15, 0.5), 0.25) for i in range(14)], 1.85), 1.2, 0.2)
    add("boing", 1.0, lambda r: seq([(0, tone(95 * (1 + 0.55 * np.exp(-np.linspace(0, 3.4, secs(3.4)) * 0.8) * tone(sweep(15, 7, 3.4)))) * decay(secs(3.4), 1.0, 0.004), 0.85), (0, tone(285 * (1 + 0.4 * np.exp(-np.linspace(0, 3.4, secs(3.4))) * tone(sweep(15, 7, 3.4)))) * decay(secs(3.4), 0.55, 0.004), 0.4), (0, metal_hit(r, 190, 2.4, 0.8), 0.45), (0, thump(120, 40, 0.1), 0.8)], 3.6), 2.0, 0.26)
    add("magnet_hum", 0.6, lambda r: fade((tone(100, secs(8.0)) * 0.4 + tone(200.4, secs(8.0)) * 0.22 + tone(301, secs(8.0)) * 0.1 + saw(50.0, secs(8.0), 30) * 0.22) * (0.75 + 0.25 * tone(sweep(1.5, 6.0, 8.0))) * np.linspace(0.3, 1.0, secs(8.0)), 1.2, 0.08), 1.2, 0.16)
    add("powerdown", 0.6, lambda r: fade(saw(sweep(150, 22, 1.6, 0.6), partials=24) * 0.45 + tone(sweep(600, 40, 1.6, 0.5)) * 0.25, 0.01, 0.4), 1.5, 0.24)
    # ---------------- alien
    add("plasma_cut", 0.65, lambda r: fade((tone(sweep(1750, 1620, 4.4) * (1 + 0.018 * tone(63.0, secs(4.4)))) * 0.16 + saw(148.0, secs(4.4), 30) * 0.2 + bp(white(secs(4.4), r), 3000, 10000) * 0.25 * (0.4 + slow(secs(4.4), 29, r))), 0.25, 0.3) + crackle(r, 4.4, 75, 1200, 6500) * 0.5, 1.1, 0.2, 8000)
    add("grav_hold", 0.5, lambda r: fade(tone(218 * (1 + 0.035 * tone(9.0, secs(1.7)))) * 0.35 + tone(327.5 * (1 + 0.03 * tone(7.0, secs(1.7)))) * 0.2 + bp(pink(secs(1.7), r), 900, 2800) * 0.07, 0.12, 0.15), 1.2, 0.25, 6000)
    add("grav_fire", 0.85, lambda r: seq([(0, tone(sweep(920, 55, 0.5, 0.45)) * decay(secs(0.5), 0.17, 0.002), 0.9), (0, thump(130, 40, 0.1), 0.9), (0, whoosh(r, 0.7, 3200, 300, 0.8, 0.12), 0.7)], 0.9), 1.8, 0.3)
    add("sonic_pulse", 0.75, lambda r: seq([(0, fade((tone(172.0, secs(0.5)) + tone(179.5, secs(0.5)) + tone(344.8, secs(0.5)) * 0.5) * 0.4, 0.02, 0.28), 1.0), (0, hiss_burst(r, 0.3, 120, 700, 0.09, 0.02), 0.5)], 0.6), 2.0, 0.34)
    add("freeze", 0.7, lambda r: seq([(0, hiss_burst(r, 1.4, 3500, 13000, 0.5, 0.03), 0.8), (0, thump(140, 60, 0.07), 0.6), (0.1, crackle(r, 2.4, 110, 3500, 9500, 0.003, lambda u: 1 - 0.7 * u), 0.8)] + [(r.uniform(0.1, 1.9), ring(r, [r.uniform(2400, 7600)], [r.uniform(0.08, 0.3)], 0.5), r.uniform(0.03, 0.14)) for _ in range(30)], 2.8), 1.8, 0.35, 10000)
    add("ice_shatter", 0.9, lambda r: seq([(0, glass(r, 2.0, 1.7), 1.0), (0, thump(110, 45, 0.09), 0.7), (0, crackle(r, 0.9, 200, 1200, 5000, 0.006, lambda u: 1 - u), 0.9)], 2.2), 1.6, 0.26, 10000)
    add("ufo_hum", 0.55, lambda r: fade((tone(57 * (1 + 0.012 * tone(3.1, secs(11.0)))) * 0.45 + tone(114.7 * (1 + 0.02 * tone(5.3, secs(11.0)))) * 0.2 + tone(690 * (1 + 0.05 * tone(6.6, secs(11.0)))) * 0.05 + tone(733 * (1 + 0.05 * tone(6.1, secs(11.0)))) * 0.04) * (0.8 + 0.2 * tone(2.2, secs(11.0))), 1.8, 1.6), 1.8, 0.3, 4000)
    add("ufo_leave", 0.75, lambda r: seq([(0, fade(tone(sweep(110, 2400, 1.7, 2.4)) * 0.3 + tone(sweep(220, 4800, 1.7, 2.4)) * 0.1, 0.1, 0.5), 1.0), (0.9, whoosh(r, 1.3, 200, 4000, 0.8, 0.4), 0.8)], 2.4), 2.6, 0.38, 7000)
    add("tractor", 0.6, lambda r: fade((tone(sweep(130, 205, 7.2)) * 0.3 + tone(sweep(196, 310, 7.2)) * 0.2) * (0.55 + 0.45 * tone(sweep(4.0, 11.0, 7.2))) + bp(pink(secs(7.2), r), 900, 3400) * 0.1 * slow(secs(7.2), 5, r), 0.8, 0.8), 2.2, 0.36, 6000)
    add("death_ray", 0.85, lambda r: fade(softclip(saw(86 * (1 + 0.03 * (slow(secs(7.0), 16, r) - 0.5)), partials=40) * 0.5 + tone(1290 * (1 + 0.09 * tone(11.0, secs(7.0)))) * 0.16 + bp(white(secs(7.0), r), 1800, 7500) * 0.18, 2.0) * (0.75 + 0.25 * tone(23.0, secs(7.0))), 0.12, 0.25), 1.6, 0.24, 6500)
    add("tripod_horn", 0.95, lambda r: seq([(0, horn_chord(r, [58.3, 61.7, 87.3, 116.5], 2.4, 0.5, -0.04), 1.0), (2.7, horn_chord(r, [51.9, 55.0, 77.8, 103.8], 2.8, 0.5, -0.09), 1.0)], 5.8), 4.0, 0.45, 2600)
    add("tripod_step", 0.85, lambda r: seq([(0, thump(80, 26, 0.2), 1.0), (0, metal_hit(r, 98, 1.5, 0.6), 0.5), (0.05, fade(tone(sweep(420, 180, 0.5)) * 0.2, 0.02, 0.2), 0.6), (0.08, debris(r, 1.2, 50, 0.6), 0.35)], 1.8), 2.2, 0.28, 2400)
    add("heat_ray", 0.8, lambda r: seq([(0, fade(tone(sweep(2900, 1850, 0.62)) * 0.25 + saw(sweep(235, 205, 0.62), partials=30) * 0.35 + bp(white(secs(0.62), r), 2500, 9000) * 0.28, 0.008, 0.18), 1.0), (0, hiss_burst(r, 0.1, 800, 12000, 0.02), 0.6)], 0.75), 2.0, 0.3, 7500)
    add("ion_charge", 0.7, lambda r: fade((tone(sweep(52, 640, 3.2, 1.6)) * 0.3 + tone(sweep(78.3, 962, 3.2, 1.6)) * 0.18 + tone(sweep(208, 2560, 3.2, 1.6)) * 0.07) * (0.55 + 0.45 * tone(sweep(3.0, 29.0, 3.2, 1.4))) * np.linspace(0.15, 1.0, secs(3.2)) ** 1.3 + bp(white(secs(3.2), r), 2000, 8000) * 0.12 * np.linspace(0, 1, secs(3.2)) ** 3, 0.3, 0.03), 2.0, 0.28, 8000)
    add("ion_fire", 1.0, lambda r: seq([(0, explosion(r, 0.65, 1.3, 0.7, 1.4, 0.3), 1.0), (0.02, fade(softclip(saw(43.0, secs(2.9), 60) * 0.6 + bp(white(secs(2.9), r), 400, 6500) * 0.4 * (0.5 + slow(secs(2.9), 33, r)), 2.2), 0.05, 0.8), 0.75), (2.2, rumble(r, 3.0, 110, 6, 0.05), 0.8)], 5.4), 3.0, 0.3, 4000)
    add("swarm", 0.55, lambda r: fade(sum(saw(f * (1 + 0.07 * (slow(secs(9.6), 9, r) - 0.5)), partials=10) * slow(secs(9.6), 6, r, 0.1, 0.12) for f in (338, 351, 367, 394, 521, 547, 719, 757)) * np.linspace(0.35, 1.0, secs(9.6)) + crackle(r, 9.6, 240, 3000, 10000, 0.0018, lambda u: 0.2 + 0.8 * u) * 0.55, 1.2, 1.6), 1.0, 0.16, 9000)
    add("antimatter_charge", 0.55, lambda r: fade(tone(sweep(300, 3400, 2.2, 2.0) * (1 + 0.03 * tone(sweep(4, 40, 2.2)))) * 0.3 * np.linspace(0.1, 1.0, secs(2.2)) + tone(sweep(150, 1700, 2.2, 2.0)) * 0.2 * np.linspace(0.1, 1.0, secs(2.2)), 0.3, 0.01), 1.4, 0.2, 8000)
    add("antimatter_boom", 1.0, lambda r: seq([(0.0, whoosh(r, 0.5, 5200, 60, 0.9, 0.93), 0.9), (0.5, thump(64, 17, 0.75), 1.0), (0.5, explosion(r, 0.85, 0.55, 1.0, 0.8, 0.7), 0.9), (0.5, bell_tone(r, 196, 3.0), 0.12)], 6.4), 3.4, 0.34, 3000)
    add("blackhole", 0.85, lambda r: fade((tone(sweep(44, 27, 8.4)) * 0.45 + tone(sweep(66.4, 40.2, 8.4)) * 0.3) * (0.65 + 0.35 * tone(sweep(0.7, 5.5, 8.4))) + lp(brown(secs(8.4), r), 380) * 0.28 * np.linspace(0.2, 1.2, secs(8.4)) + tone(sweep(2300, 140, 8.4, 0.5)) * 0.035 + debris(r, 8.4, 18, 0.5) * 0.15, 1.4, 0.15), 3.0, 0.3, 2600)
    add("blackhole_pop", 1.0, lambda r: seq([(0, fade(tone(sweep(40, 900, 0.18)) * 0.5, 0.005, 0.01), 0.8), (0.17, explosion(r, 0.9, 1.1, 0.8, 1.5, 1.0), 1.0), (0.17, thump(58, 18, 0.6), 0.8)], 5.6), 3.2, 0.32, 3500)
    # ---------------- world ending
    add("rod_incoming", 0.8, lambda r: seq([(0, whoosh(r, 1.45, 260, 5200, 0.85, 0.96), 1.0), (0, whistle(r, 1.42, 700, 3900, 0.35), 0.4)], 1.5), 1.2, 0.18, 8000)
    add("kinetic_impact", 1.0, lambda r: seq([(0, hiss_burst(r, 0.16, 100, 13000, 0.03, 0.0002), 1.5), (0, thump(68, 17, 0.8), 1.0), (0.03, explosion(r, 1.05, 0.55, 1.0, 1.0, 1.6), 0.9), (0.6, rumble(r, 6.0, 90, 5, 0.05), 0.8)], 7.5), 3.6, 0.3, 2400)
    add("meteor_incoming", 0.85, lambda r: fade(whoosh(r, 4.2, 110, 1700, 0.9, 0.97) + rumble(r, 4.2, 160, 14, 0.5) * np.linspace(0.15, 1.5, secs(4.2)) + crackle(r, 4.2, 70, 300, 2800, 0.008, lambda u: u ** 2) * 0.5, 0.5, 0.05), 1.8, 0.2, 3500)
    add("meteor_impact", 1.0, lambda r: seq([(0, explosion(r, 1.1, 0.7, 1.0, 1.3, 1.4), 1.0), (0.05, thump(55, 16, 0.9), 0.9), (0.8, rumble(r, 6.5, 95, 5, 0.05), 0.8)], 8.0), 3.8, 0.32, 2400)
    add("meteor_huge", 1.0, lambda r: seq([(0, explosion(r, 1.35, 0.65, 1.25, 1.4, 1.8), 1.0), (0.04, thump(48, 14, 1.4), 1.0), (0.9, rumble(r, 10.0, 100, 4, 0.04), 1.1), (1.8, debris(r, 7.0, 70, 1.0), 0.4), (2.4, explosion(r, 0.8, 0.3, 1.0, 0.4, 0.5), 0.45)], 12.0), 4.5, 0.36, 2000)
    add("mothership", 0.9, lambda r: fade((tone(31.0, secs(13.0)) * 0.4 + tone(46.7, secs(13.0)) * 0.25 + saw(62.3 * (1 + 0.006 * tone(0.31, secs(13.0))), partials=30) * 0.22 + tone(373.6 * (1 + 0.025 * tone(1.7, secs(13.0)))) * 0.045) * (0.75 + 0.25 * tone(0.83, secs(13.0))), 3.0, 2.5) + seq([(0.4, horn_chord(r, [46.2, 69.3, 92.5], 2.6, 0.3, 0.02), 0.5)], 13.0), 4.0, 0.38, 2200)
    add("asteroid_incoming", 0.95, lambda r: fade(rumble(r, 6.8, 190, 15, 0.7) * np.linspace(0.1, 2.0, secs(6.8)) + whoosh(r, 6.8, 60, 900, 0.95, 0.98) * 1.2 + crackle(r, 6.8, 60, 200, 1900, 0.012, lambda u: u ** 2.5) * 0.6, 1.0, 0.03), 2.5, 0.25, 2400)
    add("asteroid_impact", 1.0, lambda r: seq([(0, explosion(r, 1.4, 0.7, 1.45, 1.6, 2.0), 1.0), (0.03, thump(40, 11, 2.2), 1.0), (0.7, rumble(r, 14.0, 110, 4, 0.03), 1.3), (2.5, explosion(r, 1.2, 0.3, 1.2, 0.5, 1.0), 0.65), (4.5, debris(r, 9.0, 90, 1.0), 0.45), (5.5, wind(secs(9.0), r, 1.0, 0.4).mean(axis=1) * np.linspace(1, 0, secs(9.0)), 0.6)], 16.0), 5.0, 0.38, 1800)
    add("nuke", 1.0, lambda r: seq([(0.0, hiss_burst(r, 0.3, 2000, 9000, 0.1, 0.05), 0.15), (0.5, hiss_burst(r, 0.14, 80, 12000, 0.03, 0.0003), 1.5), (0.5, explosion(r, 1.3, 0.6, 1.35, 1.3, 1.0), 1.0), (0.54, thump(46, 13, 1.7), 1.0), (1.4, rumble(r, 11.0, 105, 4, 0.04), 1.2)], 13.0), 4.8, 0.36, 2000)
    add("nuke_big", 1.0, lambda r: seq([(0.8, hiss_burst(r, 0.18, 60, 12000, 0.04, 0.0003), 1.5), (0.8, explosion(r, 1.4, 0.5, 1.7, 1.4, 1.2), 1.0), (0.84, thump(39, 10, 2.6), 1.0), (1.9, rumble(r, 15.0, 95, 3, 0.03), 1.4), (4.2, explosion(r, 1.1, 0.25, 1.3, 0.4, 0.4), 0.6)], 18.0), 5.5, 0.4, 1600)
    add("nuke_rumble", 0.9, lambda r: fade(rumble(r, 13.0, 120, 6, 0.1) * 1.3 + rumble(r, 13.0, 45, 2.5, 0.15) + wind(secs(13.0), r, 0.8, 0.3).mean(axis=1) * slow(secs(13.0), 0.8, r, 0.2, 1.0) + debris(r, 13.0, 25, 0.9) * 0.2, 0.8, 4.0), 3.0, 0.25, 1700)
    return table


def render(name, entry):
    level, fn, rt, wet, damp = entry
    r = rng_for(zlib.crc32(name.encode()))
    x = np.asarray(fn(r), float)
    if x.ndim == 2:
        x = x.mean(axis=1)
    x = hp(x, 18.0)
    x = norm(x, 1.0)
    x = softclip(x * 1.25, 1.1) if level > 0.75 else x
    x = norm(room(x, rt, wet, damp), level * 0.92)
    # trim the silent end of the reverb tail
    loud = np.flatnonzero(np.abs(x) > 0.0015)
    if len(loud):
        x = x[:min(len(x), loud[-1] + secs(0.05))]
    return fade(x, 0.001, 0.06)


def main():
    table = R()
    os.makedirs(OUT, exist_ok=True)
    names = sys.argv[1:] or sorted(table)
    for n in names:
        x = render(n, table[n])
        wavfile.write(os.path.join(OUT, n + ".wav"), SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
    print("destruction sounds: %d written to %s" % (len(names), OUT))


if __name__ == "__main__":
    main()
