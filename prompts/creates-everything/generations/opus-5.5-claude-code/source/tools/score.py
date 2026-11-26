# Score + sound design for the proof, synthesised from scratch (numpy only). 48 kHz stereo float -> WAV.
import numpy as np, wave, sys, json
SR = 48000; DUR = 12.0; N = int(SR * DUR); R = np.random.default_rng(55)
out = sys.argv[1] if len(sys.argv) > 1 else 'score.wav'
dry = np.zeros((2, N + SR * 8)); hall = np.zeros_like(dry); nave = np.zeros_like(dry)   # sends
def T(d): return np.arange(int(d * SR)) / SR
def add(bus, x, t0, g=1.0, pan=0.0):
    i = int(t0 * SR); x = np.asarray(x)
    if x.ndim == 1: x = np.stack([x * np.cos((pan + 1) * np.pi / 4), x * np.sin((pan + 1) * np.pi / 4)]) * 1.0
    n = min(x.shape[1], bus.shape[1] - i)
    if n > 0 and i >= 0: bus[:, i:i + n] += x[:, :n] * g
def env(t, a, d, p=1.0): return np.clip(t / a, 0, 1) ** p * np.exp(-np.maximum(t - a, 0) / d)
def filt(x, lo=None, hi=None, sl=4):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR) + 1e-6; H = np.ones_like(f)
    if lo: H = H / np.sqrt(1 + (lo / f) ** (2 * sl))
    if hi: H = H / np.sqrt(1 + (f / hi) ** (2 * sl))
    return np.fft.irfft(X * H, len(x))
def noise(d): return R.standard_normal(int(d * SR))
def pink(d):
    n = int(d * SR); X = np.fft.rfft(R.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR); X /= np.sqrt(np.maximum(f, 20)) / np.sqrt(20); y = np.fft.irfft(X, n); return y / np.std(y)
def brown(d):
    n = int(d * SR); X = np.fft.rfft(R.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR); X /= np.maximum(f, 18) / 18; y = np.fft.irfft(X, n); return y / np.std(y)
def hz(m): return 440 * 2 ** ((m - 69) / 12)
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def nt(s):
    o = int(s[-1]); b = s[:-1]; v = NOTE[b[0]] + (1 if '#' in b else 0) - (1 if 'b' in b[1:] else 0); return 12 * (o + 1) + v
def saw(f, d, fc, det=0.0, vib=0.0, K=60):   # additive saw through a moving lowpass; fc may be an array
    t = T(d); ph0 = R.random() * 6.28; fi = f * 2 ** (det / 1200); ph = 2 * np.pi * np.cumsum(fi * (1 + vib * np.sin(2 * np.pi * 5.3 * t + ph0) * np.clip(t / .4, 0, 1))) / SR + ph0
    y = np.zeros_like(t); fc = np.broadcast_to(fc, t.shape)
    for k in range(1, K):
        if k * fi > 11000: break
        y += np.sin(k * ph) / k * np.exp(-(k * fi / fc) ** 2 * .7)
    return y
def stack(notes, d, fc, g=1.0, dets=(-9, 0, 8), vib=0.0):
    L = np.zeros(int(d * SR)); Rr = np.zeros_like(L)
    for n in notes:
        for j, c in enumerate(dets):
            y = saw(hz(nt(n)), d, fc, c + R.uniform(-2, 2), vib); p = (j / (len(dets) - 1) - .5) * 1.5 if len(dets) > 1 else 0
            L += y * np.cos((p + 1) * np.pi / 4); Rr += y * np.sin((p + 1) * np.pi / 4)
    return np.stack([L, Rr]) * g / max(1, len(notes)) ** .7
def choir(notes, d, a=.25, rel=.5, bright=1.0):
    t = T(d); L = np.zeros_like(t); Rr = np.zeros_like(t); F = [(650, 130, 1.0), (1080, 140, .55), (2650, 220, .22 * bright), (3300, 300, .12 * bright)]
    for n in notes:
        f0 = hz(nt(n))
        for v in range(4):
            p = R.uniform(-.9, .9); ph0 = R.random() * 6.28; dt = R.uniform(-11, 11); vr = R.uniform(4.6, 5.9); f = f0 * 2 ** (dt / 1200)
            ph = 2 * np.pi * np.cumsum(f * (1 + .0055 * np.sin(2 * np.pi * vr * t + ph0) * np.clip(t / .6, 0, 1))) / SR
            y = np.zeros_like(t)
            for k in range(1, 40):
                fk = k * f
                if fk > 5200: break
                am = sum(g / (1 + ((fk - c) / b) ** 2) for c, b, g in F) + .05; y += np.sin(k * ph + ph0 * k) * am / k ** .55
            L += y * np.cos((p + 1) * np.pi / 4); Rr += y * np.sin((p + 1) * np.pi / 4)
    e = np.clip(t / a, 0, 1) ** 1.4 * np.clip((d - t) / rel, 0, 1); return np.stack([L, Rr]) * e * .09 / max(1, len(notes)) ** .5
def organ(notes, d, a=.05, rel=.25, full=1.0):
    t = T(d); L = np.zeros_like(t); Rr = np.zeros_like(t); ranks = [(.5, .8), (1, 1.0), (2, .75), (3, .30), (4, .5), (6, .22 * full), (8, .30 * full), (12, .10 * full), (16, .10 * full)]
    for n in notes:
        f0 = hz(nt(n))
        for r, g in ranks:
            if f0 * r > 9000: continue
            for dt in (-2.2, 2.6):
                p = R.uniform(-.8, .8); ph = 2 * np.pi * f0 * r * 2 ** (dt / 1200) * t + R.random() * 6.28; y = (np.sin(ph) + .28 * np.sin(2 * ph) + .13 * np.sin(3 * ph)) * g * .5
                L += y * np.cos((p + 1) * np.pi / 4); Rr += y * np.sin((p + 1) * np.pi / 4)
    e = (1 - np.exp(-t / a)) * np.clip((d - t) / rel, 0, 1); return np.stack([L, Rr]) * e * .10 / max(1, len(notes)) ** .5
def sub(f0, f1, d, dec, g=1.0):
    t = T(d); f = f1 + (f0 - f1) * np.exp(-t / .12); y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.clip(t / .004, 0, 1) * np.exp(-t / dec); return np.tanh(y * 1.6) * g
def taiko(g=1.0, f=62):
    f = f * 1.25
    t = T(1.2); y = np.sin(2 * np.pi * np.cumsum(f + 95 * np.exp(-t / .03)) / SR) * np.exp(-t / .26); y += filt(noise(1.2), 180, 1600) * np.exp(-t / .03) * .55; y += filt(noise(1.2), 60, 260) * np.exp(-t / .16) * .4; return np.tanh(y * 1.3) * g
def impact(g=1.0, d=3.0):
    t = T(d); y = filt(noise(d), 30, 900) * np.exp(-t / .22) * .9 + filt(noise(d), 1500, 9000) * np.exp(-t / .10) * .35 + filt(brown(d), 25, 160) * np.exp(-t / .7) * .6; return y * g
def key(g=1.0, heavy=False):
    t = T(.12); y = filt(noise(.12), 1800, 7000) * np.exp(-t / .004) * .9 + np.sin(2 * np.pi * (310 if not heavy else 170) * t) * np.exp(-t / .016) * .5
    y2 = np.roll(filt(noise(.12), 2500, 9000) * np.exp(-t / .003), int(.028 * SR)) * .35; y2[:int(.028 * SR)] = 0; return (y + y2) * g * (1.5 if heavy else 1)
def ping(f, d, g=1.0):
    t = T(d * 5); y = np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / (d * .4)) + .25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / (d * .2)); return y * np.exp(-t / d) * np.clip(t / .0008, 0, 1) * g
def bell(f, d, g=1.0):
    t = T(d * 3.5); y = 0
    for r, a, dd in [(.5, .5, 1.3), (1, 1, 1), (1.19, .5, .8), (1.5, .35, .7), (2, .6, .6), (2.74, .35, .4), (4.1, .2, .25), (5.4, .12, .18)]: y = y + a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (d * dd))
    return y * np.clip(t / .001, 0, 1) * g * .35
def curve(pts, d, t0=0.0):
    t = T(d) + t0; return np.interp(t, [p[0] for p in pts], [p[1] for p in pts])
def sweepnoise(d, pts, q=.5, t0=0.0):      # band noise whose centre follows pts (block FFT)
    n = int(d * SR); x = R.standard_normal(n + 4096); o = np.zeros(n + 4096); H = 2048; w = np.hanning(2 * H)
    f = np.fft.rfftfreq(2 * H, 1 / SR) + 1
    for i in range(0, n, H // 2):
        c = np.interp(t0 + i / SR, [p[0] for p in pts], [p[1] for p in pts]); s = x[i:i + 2 * H]
        if len(s) < 2 * H: break
        o[i:i + 2 * H] += np.fft.irfft(np.fft.rfft(s * w) * np.exp(-(np.log(f / c) / q) ** 2)) * w
    return o[:n] / (np.std(o[:n]) + 1e-9)

# ---------------------------------------------------------------- typing
LINES = [(0.10, .80, 13), (3.00, 3.72, 16), (6.30, 6.82, 13), (8.28, 8.58, 12)]
for a, b, n in LINES:
    for i in range(n): add(dry, key(.10 * R.uniform(.8, 1.15)), a + (i + 1) / n * (b - a), pan=R.uniform(-.15, .25)); add(hall, key(.05), a + (i + 1) / n * (b - a))
for tt in (8.68, 8.78, 8.88): add(dry, key(.14), tt); add(nave, key(.10), tt)
for tt in (1, 4, 7, 9):
    add(dry, key(.55, True), tt - .012); add(hall, key(.25, True), tt - .012)
# ---------------------------------------------------------------- 0..1  black water
t = T(1.0); add(dry, np.sin(2 * np.pi * 36.7 * t) * np.clip(t / .6, 0, 1) ** 1.5 * .30 + np.sin(2 * np.pi * 73.4 * t) * t ** 2 * .10, 0)
add(dry, filt(noise(1.0), 600, 8000) * curve([(0, 0), (.4, .004), (.97, .13), (1, 0)], 1.0), 0, 1.0); add(hall, filt(noise(1.0), 900, 5000) * curve([(0, 0), (.98, .06), (1, 0)], 1.0), 0)
for tt in (.02, .52): add(hall, sub(60, 42, .6, .16, .30), tt); add(dry, sub(60, 42, .6, .16, .22), tt)
# ---------------------------------------------------------------- 1.0  the ocean detonates
def hit(tt, g=1.0, braam=('D1', 'A1', 'D2', 'F2', 'A2', 'D3'), d=2.4, bright=3000):
    add(dry, sub(150, 41, 2.4, .8, .62 * g), tt); add(dry, sub(240, 82, .5, .14, .30 * g), tt); add(dry, impact(.42 * g), tt); add(hall, impact(.45 * g), tt); add(dry, taiko(.6 * g, 52), tt); add(hall, taiko(.5 * g, 52), tt)
    tv = T(d); fc = 260 + bright * np.exp(-tv / .55) * np.clip(tv / .03, 0, 1); b = stack(braam, d, fc, .40 * g) * (np.clip(tv / .015, 0, 1) * np.exp(-tv / 1.1) * np.clip((d - tv) / .4, 0, 1)); b = np.tanh(b * 1.6) * .55; add(dry, b, tt, .8); add(hall, b, tt, .5)
hit(1.0, 1.05)
add(hall, choir(['D3', 'A3', 'D4', 'F4', 'A4', 'D5'], 3.2, a=.05, rel=1.2), 1.0, 1.0); add(dry, choir(['D3', 'A3', 'D4', 'F4', 'A4'], 2.6, a=.05, rel=1.2), 1.0, .5)
# water wall: roar that swells to the leap at 1.47 and drops behind
wr = brown(2.0); w1 = filt(wr, 40, 700) * curve([(0, 0), (.1, .25), (.45, .95), (.6, .35), (2, .02)], 2.0); add(dry, w1, 1.0, .34); wh = np.stack([filt(noise(2.0), 900, 9000), filt(noise(2.0), 900, 9000)]) * curve([(0, 0), (.12, .18), (.46, .9), (.56, .45), (1.0, .12), (2, 0)], 2.0); add(dry, wh, 1.0, .105); add(hall, wh, 1.0, .05)
add(dry, sweepnoise(.9, [(0, 300), (.45, 2600), (.9, 500)], .55) * curve([(0, 0), (.42, 1), (.5, .8), (.9, 0)], .9), 1.02, .085)
# ---------------------------------------------------------------- 1.2..7  flight
wind = np.stack([sweepnoise(6.2, [(0, 500), (1, 900), (2.2, 620), (3.2, 1000), (4.4, 700), (6.2, 460)], .6), sweepnoise(6.2, [(0, 600), (1.2, 820), (2.5, 560), (3.6, 1100), (4.8, 640), (6.2, 420)], .6)]) * curve([(0, 0), (.4, 1), (1.4, .7), (2.8, .55), (4.2, .75), (5.6, .5), (5.8, .12), (6.2, 0)], 6.2); add(dry, wind, 1.2, .055)
sea = np.stack([filt(pink(6), 200, 3800), filt(pink(6), 200, 3800)]) * (curve([(0, 0), (.5, 1), (2.6, .9), (4, 1.3), (5.35, 1.7), (5.48, .1), (5.6, 0)], 6) * (1 + .35 * np.sin(2 * np.pi * .7 * T(6)))); add(dry, sea, 1.5, .030)
for k in range(16):   # spray swishes: near-miss crests
    tt = 2.0 + k * .155 + R.uniform(-.04, .04); d = .30; tv = T(d); add(dry, filt(noise(d), 2200, 10000) * np.sin(np.pi * tv / d) ** 2, tt, .035 * R.uniform(.4, 1.2), R.uniform(-.8, .8))
# ostinato: eight to the second, harmony by the second
prog = [(1.5, 3, ['D3', 'F3', 'A3', 'D4']), (3, 4, ['Bb2', 'F3', 'Bb3', 'D4']), (4, 5, ['G2', 'D3', 'Bb3', 'D4']), (5, 5.75, ['Bb2', 'F3', 'Bb3', 'F4']), (5.75, 6.4, ['C3', 'G3', 'C4', 'E4']), (6.4, 6.86, ['A2', 'E3', 'C#4', 'E4'])]
for a, b, ch in prog:
    tt = a; i = 0; pat = [0, 2, 1, 3, 2, 1, 3, 2]
    while tt < b - .01:
        n = ch[pat[i % 8]]; d = .22; tv = T(d); ac = 1.35 if i % 4 == 0 else .8; gg = .20 * ac * np.interp(tt, [1.5, 3, 4, 6.8], [.5, .75, .8, 1.35])
        y = saw(hz(nt(n)), d, 900 + 2600 * np.exp(-tv / .05), R.uniform(-4, 4)) + .6 * saw(hz(nt(n) + 12), d, 1200 + 2400 * np.exp(-tv / .05), R.uniform(-5, 5)); y *= np.clip(tv / .006, 0, 1) * np.exp(-tv / .085); add(dry, y, tt, gg * .5, .35 * (-1) ** i); add(hall, y, tt, gg * .25, -.35 * (-1) ** i); tt += .125; i += 1
for a, b, ch in prog:
    d = b - a + .25; tv = T(d); p = stack([c for c in ch] + [ch[0][:-1] + str(int(ch[0][-1]) - 1)], d, np.interp(tv + a, [1.5, 4, 6.8], [700, 1300, 3000]), .30, (-12, -4, 5, 11), .004) * (np.clip(tv / .12, 0, 1) * np.clip((d - tv) / .22, 0, 1)); add(dry, p, a, .22 * np.interp(a, [1.5, 4, 6.4], [.7, .95, 1.25])); add(hall, p, a, .16)
    add(hall, choir(ch[1:] + [ch[-1][:-1] + str(int(ch[-1][-1]) + 1)], d, a=.12, rel=.25), a, .55 * np.interp(a, [1.5, 4, 6.4], [.5, .8, 1.2]))
    bt = T(d); add(dry, np.tanh(1.8 * np.sin(2 * np.pi * hz(nt(ch[0]) - 12) * bt)) * np.clip(bt / .02, 0, 1) * np.clip((d - bt) / .2, 0, 1), a, .085)
for tt, g in [(2.0, .5), (2.5, .35), (2.75, .3), (3.0, .6), (3.5, .4), (3.625, .25), (3.75, .4), (3.875, .5), (4.5, .5), (4.75, .4), (5.0, .65), (5.25, .4), (5.5, .6), (5.625, .35), (5.75, .65), (6.0, .6), (6.125, .4), (6.25, .6), (6.375, .4), (6.5, .7), (6.5625, .45), (6.625, .7), (6.6875, .5), (6.75, .8), (6.8125, .6)]: add(dry, taiko(g * .62, R.uniform(54, 70)), tt, .8, R.uniform(-.3, .3)); add(hall, taiko(g * .5, 60), tt, .55)
# 4.0 wave.height: the sea stands up
hit(4.0, .82, ('G1', 'D2', 'G2', 'Bb2', 'D3'), 2.2, 2400)
rm = brown(3.0); add(dry, filt(rm, 24, 190) * curve([(0, .1), (.6, .7), (1.8, 1.0), (2.7, 1.1), (2.95, 0), (3, 0)], 3.0), 4.0, .22); roar = np.stack([filt(pink(3), 150, 2200), filt(pink(3), 150, 2200)]) * curve([(0, 0), (1.2, .7), (1.9, 1.5), (2.2, 1.0), (2.85, 1.2), (2.97, 0), (3, 0)], 3.0); add(dry, roar, 4.0, .055)
d = 1.5; add(dry, sweepnoise(d, [(0, 250), (1.2, 4200), (1.5, 6000)], .45) * curve([(0, 0), (1.3, 1), (1.48, 1.2), (1.5, 0)], d), 5.48, .07)   # riser into the freeze
tv = T(1.45); add(dry, np.sin(2 * np.pi * np.cumsum(110 * 2 ** (tv / 1.45 * 2)) / SR) * curve([(0, 0), (1.4, .16), (1.45, 0)], 1.45), 5.5, .5)
# ---------------------------------------------------------------- 7.0  water = glass
hit(7.0, .95, ('D1', 'D2', 'A2', 'D3'), 1.0, 4200)
for k in range(520):   # crystallisation: density follows the freeze front
    u = R.random(); tt = 7.0 + .012 + 1.45 * u ** 1.7; f = R.uniform(1700, 9500) * (1 - .25 * u); dd = R.uniform(.012, .11); p = R.uniform(-.95, .95); g = .030 * R.uniform(.25, 1) * (1.15 - .75 * u); y = ping(f, dd, g); add(dry, y, tt, .75, p); add(nave, y, tt, .55, -p)
for k in range(46):    # ice cracks
    tt = 7.0 + .9 * R.random() ** 1.6; d = .05; tv = T(d); y = filt(noise(d), 700, 6500) * np.exp(-tv / .006); add(dry, y, tt, .20 * R.uniform(.3, 1), R.uniform(-.9, .9)); add(nave, y, tt, .14)
d = 1.3; add(nave, sweepnoise(d, [(0, 1200), (.8, 7500), (1.3, 9500)], .3) * curve([(0, .2), (.15, 1), (1.3, 0)], d), 7.0, .06)
for i, n in enumerate(['D5', 'F#5', 'A5', 'D6', 'F#6', 'A6', 'D7']): add(nave, bell(hz(nt(n)), .7, .20), 7.08 + i * .062, .8, -.6 + i * .2); add(dry, bell(hz(nt(n)), .4, .10), 7.08 + i * .062, .5, -.6 + i * .2)
# ---------------------------------------------------------------- 7.45..10.9  the nave
org = [(7.45, 8.25, ['D2', 'D3', 'A3', 'D4', 'F#4', 'A4'], .75), (8.25, 9.0, ['G2', 'D3', 'G3', 'B3', 'D4', 'G4'], .85), (9.0, 9.75, ['Bb1', 'Bb2', 'F3', 'Bb3', 'D4', 'F4', 'Bb4'], 1.1), (9.75, 10.35, ['C2', 'C3', 'G3', 'C4', 'E4', 'G4', 'C5'], 1.15), (10.35, 10.93, ['A1', 'A2', 'E3', 'A3', 'D4', 'E4', 'A4', 'D5'], 1.3)]
for a, b, ch, g in org:
    d = b - a + .30; o = organ(ch, d, full=.6 + .4 * g); add(nave, o, a, .62 * g); add(dry, o, a, .46 * g); c = choir(ch[2:] + [ch[-1][:-1] + str(int(ch[-1][-1]) + 1)], d, a=.14, rel=.3, bright=1.3); add(nave, c, a, .95 * g); add(dry, c, a, .35 * g)
    bt = T(d); add(dry, np.sin(2 * np.pi * hz(nt(ch[0])) * bt) * np.clip(bt / .04, 0, 1) * np.clip((d - bt) / .25, 0, 1), a, .16 * g)
air = np.stack([filt(pink(4), 120, 1200), filt(pink(4), 120, 1200)]) * curve([(0, 0), (.5, 1), (3.3, 1), (3.5, 0), (4, 0)], 4); add(dry, air, 7.4, .010)
# 9.0 sky.hour: a day goes over
hit(9.0, .72, ('Bb1', 'F2', 'Bb2', 'D3', 'F3'), 1.6, 2600)
d = 1.45; sw = np.stack([sweepnoise(d, [(0, 400), (.68, 5200), (1.45, 500)], .5), sweepnoise(d, [(0, 500), (.72, 4600), (1.45, 420)], .5)]) * curve([(0, .1), (.68, 1), (1.35, .35), (1.45, 0)], d); add(dry, sw, 9.0, .060); add(nave, sw, 9.0, .05)
arp = ['Bb4', 'D5', 'F5', 'Bb5', 'D6', 'F6', 'E6', 'G6', 'C6', 'G5', 'E5', 'C5']
for i, n in enumerate(arp): tt = 9.0 + 1.36 * (i / 12) ** .9; add(nave, bell(hz(nt(n)), .6, .17), tt, .8, -.8 + 1.6 * i / 11); add(dry, bell(hz(nt(n)), .35, .10), tt, .6, -.8 + 1.6 * i / 11)
for tt, g in [(9.5, .5), (9.75, .6), (10.0, .5), (10.125, .35), (10.25, .5), (10.375, .6), (10.5, .6), (10.5625, .45), (10.625, .65), (10.6875, .5), (10.75, .75), (10.8125, .6), (10.875, .85)]: add(dry, taiko(g * .6, 56), tt, .75, R.uniform(-.3, .3)); add(nave, taiko(g * .4, 56), tt, .5)
d = .86; add(dry, sweepnoise(d, [(0, 400), (.8, 6500)], .5) * curve([(0, 0), (.80, 1), (.845, 1.1), (.86, 0)], d), 10.07, .095)
# ---------------------------------------------------------------- 10.93  through the rose
X = 10.935
hit(X, 1.12, ('D1', 'D2', 'A2', 'D3', 'F#3', 'A3', 'D4'), 1.6, 4200)
add(dry, filt(noise(.5), 2500, 14000) * np.exp(-T(.5) / .07), X, .30); add(hall, filt(noise(.5), 2500, 12000) * np.exp(-T(.5) / .09), X, .22)
for k in range(700):
    u = R.random(); tt = X + .95 * u ** 2.4; f = 900 * 2 ** R.uniform(0, 3.6); dd = R.uniform(.008, .10) * (1.5 if u > .3 else 1); p = R.uniform(-1, 1); y = ping(f, dd, .050 * R.uniform(.2, 1) * (1.1 - .8 * u ** .6)); add(dry, y, tt, .75, p); add(hall, y, tt, .30, -p)
c = choir(['D4', 'F#4', 'A4', 'D5', 'F#5', 'A5'], 1.4, a=.05, rel=.5, bright=1.5); add(hall, c, X, 1.2); add(dry, c, X, .6); o = stack(['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'], 1.4, 2600, .30, (-11, -4, 5, 12), .004) * np.clip((1.4 - T(1.4)) / .6, 0, 1); add(dry, o, X, .32); add(hall, o, X, .25)
# wings: flutter that grows out of the glass
for k in range(46):
    st = X + .22 + .8 * R.random(); d = min(.55, 12.0 - st) - .01
    if d < .08: continue
    tv = T(d); rt = R.uniform(13, 21); y = filt(noise(d), 350, 3400) * np.maximum(0, np.sin(2 * np.pi * rt * tv + R.random() * 6)) ** 2.2 * np.sin(np.pi * tv / d) ** .8; p0 = R.uniform(-.9, .9); add(dry, y, st, .050 * R.uniform(.4, 1), p0)
# ---------------------------------------------------------------- reverbs
def ir(dec, d, lo, hi, pre=.02, dens=1.0):
    t = T(d); o = []
    for ch in range(2):
        y = np.zeros_like(t)
        for a, b, m in [(lo, 400, 1.15), (400, 1600, 1.0), (1600, 5000, .62), (5000, hi, .34)]: y += filt(R.standard_normal(len(t)), a, b, 2) * np.exp(-t * 6.91 / (dec * m))
        y[:int(.002 * SR)] = 0; y = np.concatenate([np.zeros(int(pre * SR)), y]); o.append(y / np.sqrt(np.sum(y ** 2)))
    return np.stack(o)
def conv(x, h):
    n = x.shape[1] + h.shape[1]; m = 1 << int(np.ceil(np.log2(n))); return np.stack([np.fft.irfft(np.fft.rfft(x[c], m) * np.fft.rfft(h[c], m), m)[:x.shape[1]] for c in range(2)])
wetH = conv(hall, ir(2.6, 3.2, 60, 9000, .025)); wetN = conv(nave, ir(6.2, 7.0, 70, 10000, .045))
# real silence: the hall is choked at the freeze so the crystals speak alone; and again a breath before the rose
tt = np.arange(dry.shape[1]) / SR; duck = np.interp(tt, [0, 6.94, 6.985, 7.0, 7.10, 7.45, 20], [1, 1, .12, 1, .35, .9, 1]); wetH *= duck
gate = np.interp(tt, [0, 10.875, 10.895, 10.925, 10.936, 20], [1, 1, .06, .06, 1, 1]); wetN *= np.interp(tt, [0, 10.875, 10.895, 10.925, 10.95, 11.6, 20], [1, 1, .12, .12, .8, .25, .2])
wetH *= gate; dry *= gate
pre = np.interp(tt, [0, .955, .975, .988, .999, 1.0, 20], [1, 1, .05, .05, .05, 1, 1]); dry *= pre; wetH *= pre
mix = dry + wetH * 1.15 + wetN * 1.1
mix = mix[:, :N]
# master: low cut, gentle glue, look-ahead limiter
mix = np.stack([filt(m, 24, 19000, 2) for m in mix]); G = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0; mix *= G
mix = np.tanh(mix * .9) / .9 * 1.0
def limiter(x, ceil=10 ** (-1.6 / 20), look=.004, rel=.09):
    pk = np.max(np.abs(np.stack([np.interp(np.arange(0, x.shape[1], .5), np.arange(x.shape[1]), c) for c in x])), axis=0).reshape(-1, 2).max(axis=1); need = np.minimum(1, ceil / np.maximum(pk, 1e-9)); L = int(look * SR);
    from numpy.lib.stride_tricks import sliding_window_view as sw
    m = sw(np.pad(need, (L, L), mode='edge'), 2 * L + 1).min(axis=1); g = np.empty_like(m); c = 1.0; a = np.exp(-1 / (rel * SR))
    for i in range(len(m)):
        c = m[i] if m[i] < c else 1 - (1 - c) * a if (1 - (1 - c) * a) < m[i] else m[i]; g[i] = c
    k = np.hanning(2 * L + 1); k /= k.sum(); g = np.convolve(np.pad(g, (L, L), mode='edge'), k, 'valid'); g = np.minimum(g, 1); return x * np.minimum(g, m * 1.0 + 0.0 if False else g)
mix = limiter(mix); fade = np.ones(N); nf = int(.22 * SR); fade[-nf:] = np.cos(np.linspace(0, np.pi / 2, nf)) ** 1.5; mix *= fade
pcm = np.clip(mix * 8388607, -8388608, 8388607).astype(np.int32)
b = np.empty((N * 2,), np.int32); b[0::2] = pcm[0]; b[1::2] = pcm[1]; raw = np.frombuffer(b.tobytes(), np.uint8).reshape(-1, 4)[:, :3].tobytes()
with wave.open(out, 'wb') as w: w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR); w.writeframes(raw)
print('wrote', out, 'peak', 20 * np.log10(np.max(np.abs(mix))))
