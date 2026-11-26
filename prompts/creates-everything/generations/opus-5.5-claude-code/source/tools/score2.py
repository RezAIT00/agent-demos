# The full film's score + sound design, synthesised from scratch with numpy. 120 BPM; every Enter lands on a beat.
# python tools/score2.py soundtrack.wav [gain]
import numpy as np, wave, sys, os
src = open(os.path.join(os.path.dirname(__file__), 'score.py'), encoding='utf8').read()
exec(src.split('# ---------------------------------------------------------------- typing')[0].replace('DUR = 12.0', 'DUR = 55.0'))
R = np.random.default_rng(5505)
def ping(f, d, g=1.0):
    t = T(d * 5); y = np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / (d * .4)) + .25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / (d * .2)); return y * np.exp(-t / d) * np.clip(t / .0008, 0, 1) * g
def bell(f, d, g=1.0):
    t = T(d * 3.5); y = 0
    for r, a, dd in [(.5, .5, 1.3), (1, 1, 1), (1.19, .5, .8), (1.5, .35, .7), (2, .6, .6), (2.74, .35, .4), (4.1, .2, .25), (5.4, .12, .18)]: y = y + a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (d * dd))
    return y * np.clip(t / .001, 0, 1) * g * .35
def curve(pts, d, t0=0.0):
    t = T(d) + t0; return np.interp(t, [p[0] for p in pts], [p[1] for p in pts])
def sweepnoise(d, pts, q=.5, t0=0.0):
    n = int(d * SR); x = R.standard_normal(n + 4096); o = np.zeros(n + 4096); H = 2048; w = np.hanning(2 * H); f = np.fft.rfftfreq(2 * H, 1 / SR) + 1
    for i in range(0, n, H // 2):
        c = np.interp(t0 + i / SR, [p[0] for p in pts], [p[1] for p in pts]); s = x[i:i + 2 * H]
        if len(s) < 2 * H: break
        o[i:i + 2 * H] += np.fft.irfft(np.fft.rfft(s * w) * np.exp(-(np.log(f / c) / q) ** 2)) * w
    return o[:n] / (np.std(o[:n]) + 1e-9)
def st(x, w=.6):  # decorrelated stereo from mono
    return np.stack([x, np.roll(x, int(.011 * SR)) * w + x * (1 - w)])
def hit(tt, g=1.0, braam=('D1', 'A1', 'D2', 'F2', 'A2', 'D3'), d=2.4, bright=3000, bus=None):
    add(dry, sub(150, 41, 2.4, .8, .62 * g), tt); add(dry, sub(240, 82, .5, .14, .30 * g), tt); add(dry, impact(.42 * g), tt); add(bus if bus is not None else hall, impact(.45 * g), tt)
    add(dry, taiko(.6 * g, 52), tt); add(hall, taiko(.5 * g, 52), tt)
    tv = T(d); fc = 260 + bright * np.exp(-tv / .55) * np.clip(tv / .03, 0, 1); b = stack(braam, d, fc, .40 * g) * (np.clip(tv / .015, 0, 1) * np.exp(-tv / 1.1) * np.clip((d - tv) / .4, 0, 1)); b = np.tanh(b * 1.6) * .55; add(dry, b, tt, .8); add(hall, b, tt, .5)
def keys_line(a, b, n, g=.10, bus=None):
    for i in range(n): tt = a + (i + 1) / n * (b - a); add(dry, key(g * R.uniform(.8, 1.15)), tt, 1, R.uniform(-.15, .25)); add(bus if bus is not None else hall, key(g * .5), tt)
def ostinato(a, b, ch, gain, bright=(900, 2600)):
    tt = a; i = 0; pat = [0, 2, 1, 3, 2, 1, 3, 2]
    while tt < b - .01:
        n = ch[pat[i % 8]]; d = .22; tv = T(d); ac = 1.35 if i % 4 == 0 else .8; gg = .20 * ac * gain
        y = saw(hz(nt(n)), d, bright[0] + bright[1] * np.exp(-tv / .05), R.uniform(-4, 4)) + .6 * saw(hz(nt(n) + 12), d, bright[0] * 1.3 + bright[1] * np.exp(-tv / .05), R.uniform(-5, 5)); y *= np.clip(tv / .006, 0, 1) * np.exp(-tv / .085)
        add(dry, y, tt, gg * .5, .35 * (-1) ** i); add(hall, y, tt, gg * .25, -.35 * (-1) ** i); tt += .125; i += 1
def pad(a, b, ch, gain, fcs=(700, 1300), choirg=.55, bus=None):
    d = b - a + .25; tv = T(d); p = stack(list(ch) + [ch[0][:-1] + str(int(ch[0][-1]) - 1)], d, np.interp(tv, [0, d], fcs), .30, (-12, -4, 5, 11), .004) * (np.clip(tv / .12, 0, 1) * np.clip((d - tv) / .22, 0, 1)); add(dry, p, a, .22 * gain); add(bus if bus is not None else hall, p, a, .16 * gain)
    if choirg > 0: add(bus if bus is not None else hall, choir(list(ch[1:]) + [ch[-1][:-1] + str(int(ch[-1][-1]) + 1)], d, a=.12, rel=.25), a, choirg * gain)
    bt = T(d); add(dry, np.tanh(1.8 * np.sin(2 * np.pi * hz(nt(ch[0]) - 12) * bt)) * np.clip(bt / .02, 0, 1) * np.clip((d - bt) / .2, 0, 1), a, .085 * gain)
def drums(pairs, bus=None, gain=1.0):
    for tt, g in pairs: add(dry, taiko(g * .62 * gain, R.uniform(54, 70)), tt, .8, R.uniform(-.3, .3)); add(bus if bus is not None else hall, taiko(g * .5 * gain, 60), tt, .55)
space = np.zeros_like(dry)
# ================================================================ 0..1  black water
keys_line(.10, .80, 13)
t = T(1.0); add(dry, np.sin(2 * np.pi * 36.7 * t) * np.clip(t / .6, 0, 1) ** 1.5 * .30 + np.sin(2 * np.pi * 73.4 * t) * t ** 2 * .10, 0)
add(dry, filt(noise(1.0), 600, 8000) * curve([(0, 0), (.4, .004), (.97, .13), (1, 0)], 1.0), 0); add(hall, filt(noise(1.0), 900, 5000) * curve([(0, 0), (.98, .06), (1, 0)], 1.0), 0)
for tt in (.02, .52): add(hall, sub(60, 42, .6, .16, .30), tt); add(dry, sub(60, 42, .6, .16, .22), tt)
# ================================================================ 1.0  sea.wind = 38: the crown
for tt in (1, 5, 9, 11, 14, 19, 27, 35, 43): add(dry, key(.55, True), tt - .012); add(hall, key(.25, True), tt - .012)
hit(1.0, 1.1)
add(hall, choir(['D3', 'A3', 'D4', 'F4', 'A4', 'D5'], 3.2, a=.05, rel=1.2), 1.0); add(dry, choir(['D3', 'A3', 'D4', 'F4', 'A4'], 2.6, a=.05, rel=1.2), 1.0, .5)
# the column of water going up, then the wall racing at us and the leap over its crest at ~2.1
add(dry, sweepnoise(1.6, [(0, 200), (.3, 900), (1.6, 300)], .7) * curve([(0, 0), (.05, 1), (1.6, 0)], 1.6), 1.0, .07)
wr = brown(2.6); add(dry, st(filt(wr, 30, 600)) * curve([(0, 0), (.3, .4), (1.05, 1.1), (1.2, .5), (2.6, .02)], 2.6), 1.0, .30)
wh = np.stack([filt(noise(2.6), 900, 9000), filt(noise(2.6), 900, 9000)]) * curve([(0, 0), (.4, .25), (1.05, 1.0), (1.18, .3), (1.6, .15), (2.6, 0)], 2.6); add(dry, wh, 1.0, .10); add(hall, wh, 1.0, .05)
add(dry, sweepnoise(1.3, [(0, 300), (1.05, 3000), (1.3, 600)], .55) * curve([(0, 0), (1.0, 1), (1.12, .6), (1.3, 0)], 1.3), 1.0, .085)
for k in range(40):  # spray hitting the lens as we crest
    tt = 2.05 + .5 * R.random(); d = .05; add(dry, filt(noise(d), 1500, 9000) * np.exp(-T(d) / .01), tt, .05 * R.random(), R.uniform(-1, 1))
# ================================================================ 1.5..9  storm run, the wave stands up
wind = np.stack([sweepnoise(7.6, [(0, 500), (1, 900), (2.2, 620), (3.2, 1000), (4.4, 700), (7.6, 460)], .6), sweepnoise(7.6, [(0, 600), (1.2, 820), (2.5, 560), (3.6, 1100), (4.8, 640), (7.6, 420)], .6)]) * curve([(0, 0), (.4, 1), (1.4, .7), (2.8, .55), (4.2, .75), (6.6, .5), (7.0, .12), (7.6, 0)], 7.6); add(dry, wind, 1.4, .05)
sea = np.stack([filt(pink(7.5), 200, 3800), filt(pink(7.5), 200, 3800)]) * (curve([(0, 0), (.6, 1), (3.0, .9), (5.0, 1.3), (6.9, 1.7), (7.05, .1), (7.2, 0)], 7.5) * (1 + .35 * np.sin(2 * np.pi * .7 * T(7.5)))); add(dry, sea, 1.8, .030)
for k in range(22): tt = 2.9 + k * .16 + R.uniform(-.04, .04); d = .30; tv = T(d); add(dry, filt(noise(d), 2200, 10000) * np.sin(np.pi * tv / d) ** 2, tt, .035 * R.uniform(.4, 1.2), R.uniform(-.8, .8))
for tt in (3.45, 3.95, 4.55):  # passing waterspouts: a low rotating roar that doppler-swings past
    d = 1.0; tv = T(d); y = filt(brown(d), 50, 500) * (np.sin(2 * np.pi * 9 * tv) * .3 + .7) * np.exp(-((tv - .5) / .2) ** 2); add(dry, st(y), tt - .5, .22, 0)
prog = [(1.5, 3, ['D3', 'F3', 'A3', 'D4']), (3, 5, ['Bb2', 'F3', 'Bb3', 'D4']), (5, 6.33, ['G2', 'D3', 'Bb3', 'D4']), (6.33, 7.5, ['Bb2', 'F3', 'Bb3', 'F4']), (7.5, 8.4, ['C3', 'G3', 'C4', 'E4']), (8.4, 8.86, ['A2', 'E3', 'C#4', 'E4'])]
for a, b, ch in prog: ostinato(a, b, ch, np.interp(a, [1.5, 3, 5, 8.4], [.5, .75, .85, 1.35])); pad(a, b, ch, np.interp(a, [1.5, 5, 8.4], [.7, .95, 1.25]), fcs=(np.interp(a, [1.5, 8.4], [700, 2400]), np.interp(b, [1.5, 8.4], [800, 3000])))
keys_line(4.05, 4.65, 16)
drums([(2.0, .5), (2.5, .35), (3.0, .6), (3.5, .4), (3.75, .4), (4.0, .6), (4.5, .5), (4.75, .5), (5.5, .5), (6.0, .65), (6.5, .5), (7.0, .6), (7.25, .4), (7.5, .65), (7.75, .4), (8.0, .6), (8.125, .4), (8.25, .6), (8.375, .4), (8.5, .7), (8.5625, .45), (8.625, .7), (8.6875, .5), (8.75, .8), (8.8125, .6)])
hit(5.0, .82, ('G1', 'D2', 'G2', 'Bb2', 'D3'), 2.2, 2400)
rm = brown(4.0); add(dry, st(filt(rm, 24, 190)) * curve([(0, .1), (.8, .7), (2.4, 1.0), (3.7, 1.1), (3.95, 0), (4, 0)], 4.0), 5.0, .22)
roar = np.stack([filt(pink(4), 150, 2200), filt(pink(4), 150, 2200)]) * curve([(0, 0), (1.5, .7), (2.5, 1.5), (3.0, 1.0), (3.85, 1.2), (3.97, 0), (4, 0)], 4.0); add(dry, roar, 5.0, .055)
d = 1.5; add(dry, sweepnoise(d, [(0, 250), (1.2, 4200), (1.5, 6000)], .45) * curve([(0, 0), (1.3, 1), (1.48, 1.2), (1.5, 0)], d), 7.48, .07)
tv = T(1.45); add(dry, np.sin(2 * np.pi * np.cumsum(110 * 2 ** (tv / 1.45 * 2)) / SR) * curve([(0, 0), (1.4, .16), (1.45, 0)], 1.45), 7.5, .5)
# ================================================================ 9.0 water = glass, 11.0 sky.hour, 12.935 the rose
keys_line(8.30, 8.78, 13)
hit(9.0, .95, ('D1', 'D2', 'A2', 'D3'), 1.0, 4200)
for k in range(520):
    u = R.random(); tt = 9.012 + 1.45 * u ** 1.7; f = R.uniform(1700, 9500) * (1 - .25 * u); dd = R.uniform(.012, .11); p = R.uniform(-.95, .95); g = .030 * R.uniform(.25, 1) * (1.15 - .75 * u); y = ping(f, dd, g); add(dry, y, tt, .75, p); add(nave, y, tt, .55, -p)
for k in range(46): tt = 9.0 + .9 * R.random() ** 1.6; d = .05; tv = T(d); y = filt(noise(d), 700, 6500) * np.exp(-tv / .006); add(dry, y, tt, .20 * R.uniform(.3, 1), R.uniform(-.9, .9)); add(nave, y, tt, .14)
d = 1.3; add(nave, sweepnoise(d, [(0, 1200), (.8, 7500), (1.3, 9500)], .3) * curve([(0, .2), (.15, 1), (1.3, 0)], d), 9.0, .06)
for i, n in enumerate(['D5', 'F#5', 'A5', 'D6', 'F#6', 'A6', 'D7']): add(nave, bell(hz(nt(n)), .7, .20), 9.08 + i * .062, .8, -.6 + i * .2); add(dry, bell(hz(nt(n)), .4, .10), 9.08 + i * .062, .5, -.6 + i * .2)
org = [(9.45, 10.25, ['D2', 'D3', 'A3', 'D4', 'F#4', 'A4'], .75), (10.25, 11.0, ['G2', 'D3', 'G3', 'B3', 'D4', 'G4'], .85), (11.0, 11.75, ['Bb1', 'Bb2', 'F3', 'Bb3', 'D4', 'F4', 'Bb4'], 1.1), (11.75, 12.35, ['C2', 'C3', 'G3', 'C4', 'E4', 'G4', 'C5'], 1.15), (12.35, 12.93, ['A1', 'A2', 'E3', 'A3', 'D4', 'E4', 'A4', 'D5'], 1.3)]
for a, b, ch, g in org:
    d = b - a + .30; o = organ(ch, d, full=.6 + .4 * g); add(nave, o, a, .62 * g); add(dry, o, a, .46 * g); c = choir(ch[2:] + [ch[-1][:-1] + str(int(ch[-1][-1]) + 1)], d, a=.14, rel=.3, bright=1.3); add(nave, c, a, .95 * g); add(dry, c, a, .35 * g)
    bt = T(d); add(dry, np.sin(2 * np.pi * hz(nt(ch[0])) * bt) * np.clip(bt / .04, 0, 1) * np.clip((d - bt) / .25, 0, 1), a, .16 * g)
keys_line(10.28, 10.58, 12, bus=nave)
for tt in (10.68, 10.78, 10.88): add(dry, key(.14), tt); add(nave, key(.10), tt)
hit(11.0, .72, ('Bb1', 'F2', 'Bb2', 'D3', 'F3'), 1.6, 2600, bus=nave)
d = 1.45; sw = np.stack([sweepnoise(d, [(0, 400), (.68, 5200), (1.45, 500)], .5), sweepnoise(d, [(0, 500), (.72, 4600), (1.45, 420)], .5)]) * curve([(0, .1), (.68, 1), (1.35, .35), (1.45, 0)], d); add(dry, sw, 11.0, .060); add(nave, sw, 11.0, .05)
for i, n in enumerate(['Bb4', 'D5', 'F5', 'Bb5', 'D6', 'F6', 'E6', 'G6', 'C6', 'G5', 'E5', 'C5']): tt = 11.0 + 1.36 * (i / 12) ** .9; add(nave, bell(hz(nt(n)), .6, .17), tt, .8, -.8 + 1.6 * i / 11); add(dry, bell(hz(nt(n)), .35, .10), tt, .6, -.8 + 1.6 * i / 11)
drums([(11.5, .5), (11.75, .6), (12.0, .5), (12.125, .35), (12.25, .5), (12.375, .6), (12.5, .6), (12.5625, .45), (12.625, .65), (12.6875, .5), (12.75, .75), (12.8125, .6), (12.875, .85)], bus=nave)
d = .86; add(dry, sweepnoise(d, [(0, 400), (.8, 6500)], .5) * curve([(0, 0), (.80, 1), (.845, 1.1), (.86, 0)], d), 12.07, .095)
X = 12.935
hit(X, 1.12, ('D1', 'D2', 'A2', 'D3', 'F#3', 'A3', 'D4'), 1.6, 4200)
add(dry, filt(noise(.5), 2500, 14000) * np.exp(-T(.5) / .07), X, .30); add(hall, filt(noise(.5), 2500, 12000) * np.exp(-T(.5) / .09), X, .22)
for k in range(700):
    u = R.random(); tt = X + .95 * u ** 2.4; f = 900 * 2 ** R.uniform(0, 3.6); dd = R.uniform(.008, .10) * (1.5 if u > .3 else 1); p = R.uniform(-1, 1); y = ping(f, dd, .050 * R.uniform(.2, 1) * (1.1 - .8 * u ** .6)); add(dry, y, tt, .75, p); add(hall, y, tt, .30, -p)
# ================================================================ 13..19  the slow-motion hang, shards.fly(), the flock at sunset
c = choir(['D4', 'F#4', 'A4', 'D5', 'F#5', 'A5'], 2.4, a=.05, rel=.9, bright=1.5); add(hall, c, X, 1.1); add(dry, c, X, .5)
for k in range(90):  # shards ringing as they hang in the air
    tt = 13.1 + .9 * R.random(); add(hall, ping(900 * 2 ** R.uniform(1, 3.4), .25, .03 * R.random()), tt, .8, R.uniform(-1, 1))
keys_line(13.25, 13.62, 12)
hit(14.0, .70, ('D2', 'A2', 'D3', 'F#3', 'A3'), 1.6, 3200)
d = .9; add(dry, sweepnoise(d, [(0, 300), (.5, 2400), (.9, 900)], .5) * curve([(0, 0), (.25, 1), (.9, 0)], d), 14.0, .09)
for k in range(260):  # wings: every bird has its own beat, the flock swells and passes
    st0 = 14.15 + 4.7 * R.random() ** .8; d = min(.7, 19.0 - st0)
    if d < .1: continue
    tv = T(d); rt = R.uniform(3.2, 5.2) * 2; y = filt(noise(d), 300, 3200) * np.maximum(0, np.sin(2 * np.pi * rt * tv + R.random() * 6)) ** 2.0 * np.sin(np.pi * tv / d) ** .8; add(dry, y, st0, .022 * R.uniform(.4, 1), R.uniform(-1, 1))
evening = [(14.0, 15.5, ['D3', 'A3', 'D4', 'F#4']), (15.5, 17.0, ['B2', 'F#3', 'B3', 'D4']), (17.0, 18.0, ['G2', 'D3', 'G3', 'B3']), (18.0, 19.0, ['A2', 'E3', 'A3', 'C#4'])]
for a, b, ch in evening: pad(a, b, ch, .85, fcs=(900, 1200), choirg=.65)
for i in range(16):  # a high glass line over the flock
    n = ['A5', 'F#5', 'D6', 'A5', 'B5', 'F#5', 'D6', 'B5', 'G5', 'D6', 'B5', 'G5', 'A5', 'E6', 'C#6', 'A5'][i]; add(hall, bell(hz(nt(n)), .45, .10), 14.5 + i * .28, .8, -.5 + i / 15)
sea2 = np.stack([filt(pink(5), 120, 2200), filt(pink(5), 120, 2200)]) * curve([(0, 0), (.8, 1), (4.2, .6), (5, 0)], 5); add(dry, sea2, 14.0, .02)
# ================================================================ 19.0 city.floors = 160: the city comes up out of the sea
keys_line(18.22, 18.78, 17)
hit(19.0, 1.0, ('C1', 'G1', 'C2', 'Eb2', 'G2'), 2.6, 1600)
rise = brown(5.0); add(dry, st(filt(rise, 20, 140)) * curve([(0, 0), (.3, 1.0), (2.8, .9), (4.2, .4), (5, 0)], 5.0), 19.0, .38)
pour = np.stack([filt(pink(6), 300, 5000), filt(pink(6), 300, 5000)]) * curve([(0, 0), (.5, 1), (3.0, .9), (4.5, .3), (6, 0)], 6.0); add(dry, pour, 19.2, .05); add(hall, pour, 19.2, .03)
for k in range(60):  # floors locking into place: deep metallic knocks climbing in pitch
    tt = 19.3 + 3.6 * R.random(); f = 70 * 2 ** (R.random() * 1.5 + (tt - 19.3) * .25); d = .4; tv = T(d); y = (np.sin(2 * np.pi * f * tv) + .5 * np.sin(2 * np.pi * f * 2.41 * tv)) * np.exp(-tv / .09); add(dry, y, tt, .05 * R.uniform(.4, 1), R.uniform(-.9, .9)); add(hall, y, tt, .04)
city_prog = [(19, 21, ['C3', 'G3', 'C4', 'Eb4']), (21, 23, ['Ab2', 'Eb3', 'Ab3', 'C4']), (23, 25, ['Eb3', 'Bb3', 'Eb4', 'G4']), (25, 26.5, ['Bb2', 'F3', 'Bb3', 'D4']), (26.5, 26.98, ['G2', 'D3', 'G3', 'B3'])]
for a, b, ch in city_prog:
    pad(a, b, ch, .8, fcs=(500, 900), choirg=.25)
    tt = a  # 16th pulse: a city's heartbeat
    while tt < b - .01:
        i = int(round((tt - a) / .125)); n = ch[(i * 3) % 4]; d = .12; tv = T(d); y = saw(hz(nt(n) + 12), d, 600 + 2400 * np.exp(-tv / .02) * (.4 + .6 * ((tt - 19) / 8)), 0) * np.exp(-tv / .05); add(dry, y, tt, .05 * (1.3 if i % 4 == 0 else .8), .4 * (-1) ** i); add(hall, y, tt, .03); tt += .125
drums([(20, .5), (21, .5), (21.5, .35), (22, .5), (23, .55), (23.5, .4), (24, .55), (24.5, .4), (25, .6), (25.5, .45), (25.75, .45), (26, .6), (26.25, .45), (26.5, .65), (26.625, .45), (26.75, .7), (26.875, .75)])
traffic = np.stack([filt(pink(8), 80, 900), filt(pink(8), 80, 900)]) * curve([(0, 0), (1.5, .7), (7.5, .8), (8, 0)], 8); add(dry, traffic, 19.5, .025)
keys_line(25.40, 25.80, 13)
for tt in (26.10, 26.20, 26.30): add(dry, key(.10), tt)        # cursor walks back
add(dry, key(.14), 26.52); add(hall, key(.08), 26.52)            # the minus
for tt in (26.72,): add(dry, key(.10), tt)
d = 1.0; add(dry, sweepnoise(d, [(0, 6000), (1.0, 400)], .5) * curve([(0, 0), (.9, 1), (1.0, 0)], d), 26.0, .07)   # reverse-cymbal into the flip
# ================================================================ 27.0 gravity = -9.8: everything falls up
hit(27.0, 1.05, ('D1', 'A1', 'D2', 'F2', 'A2'), 2.8, 2000)
tv = T(8.0); gl = np.sin(2 * np.pi * np.cumsum(55 * 2 ** (tv / 8 * 3.0)) / SR) * curve([(0, 0), (.3, .9), (7.5, .7), (8, 0)], 8); add(dry, st(gl), 27.0, .10)   # rising sub glissando
gliss = choir(['D4', 'A4', 'D5', 'F5'], 8.0, a=.6, rel=1.0, bright=1.2); add(hall, gliss, 27.0, .9)
for k in range(220):  # lights letting go: rising plucked glass
    tt = 27.1 + 7.6 * R.random() ** .9; f = 600 * 2 ** (R.random() * 2.5 + (tt - 27) * .12); add(hall, ping(f, .18, .025 * R.random()), tt, .8, R.uniform(-1, 1)); add(dry, ping(f, .12, .012 * R.random()), tt, .6, R.uniform(-1, 1))
upsw = np.stack([sweepnoise(8, [(0, 200), (8, 6000)], .4), sweepnoise(8, [(0, 240), (8, 6600)], .4)]) * curve([(0, .3), (1, 1), (7.6, 1.2), (8, 0)], 8); add(dry, upsw, 27.0, .035); add(hall, upsw, 27.0, .03)
grav_prog = [(27, 29, ['D3', 'A3', 'D4', 'F4']), (29, 31, ['F3', 'C4', 'F4', 'A4']), (31, 33, ['G3', 'D4', 'G4', 'Bb4']), (33, 34.5, ['A3', 'E4', 'A4', 'C#5']), (34.5, 34.98, ['A3', 'E4', 'G4', 'C#5'])]
for a, b, ch in grav_prog: pad(a, b, ch, np.interp(a, [27, 34.5], [.8, 1.3]), fcs=(np.interp(a, [27, 34], [900, 2600]), np.interp(b, [27, 35], [1100, 3200])), choirg=.7); ostinato(a, b, ch, np.interp(a, [27, 31, 34.5], [.5, .8, 1.2]), (1200, 3200))
keys_line(33.45, 34.10, 17)
drums([(29, .5), (30, .5), (31, .55), (31.5, .4), (32, .6), (32.5, .45), (33, .6), (33.5, .5), (34, .65), (34.25, .5), (34.5, .7), (34.625, .5), (34.75, .8), (34.875, .9)])
# ================================================================ 35.0 time.scale = 1e15: the cosmos
hit(35.0, 1.25, ('D1', 'A1', 'D2', 'A2', 'D3', 'F3'), 3.0, 1800, bus=space)
add(space, sub(90, 30, 5.0, 2.5, .6), 35.0); add(dry, sub(90, 30, 5.0, 2.0, .45), 35.0)
time_sw = np.stack([sweepnoise(3, [(0, 8000), (3, 120)], .5), sweepnoise(3, [(0, 7000), (3, 100)], .5)]) * curve([(0, 1), (3, 0)], 3); add(dry, time_sw, 35.0, .07); add(space, time_sw, 35.0, .06)
cos_prog = [(35.4, 37.4, ['D2', 'A2', 'D3', 'F3', 'A3', 'D4']), (37.4, 39.4, ['Bb1', 'F2', 'Bb2', 'D3', 'F3', 'Bb3']), (39.4, 41.4, ['F2', 'C3', 'F3', 'A3', 'C4', 'F4']), (41.4, 43.0, ['C2', 'G2', 'C3', 'E3', 'G3', 'C4'])]
for a, b, ch in cos_prog:
    d = b - a + .6; s = stack(ch, d, np.interp(T(d), [0, d], [500, 2200]), .30, (-14, -5, 6, 13), .003) * np.clip(T(d) / .5, 0, 1) * np.clip((d - T(d)) / .6, 0, 1); add(space, s, a, .45); add(dry, s, a, .14)
    add(space, choir(ch[2:] + [ch[-1][:-1] + str(int(ch[-1][-1]) + 1)], d, a=.5, rel=.6, bright=1.3), a, 1.1)
for k in range(140):  # stars: a slow sparkle of high partials
    tt = 36 + 7 * R.random(); add(space, bell(hz(nt(['A5', 'D6', 'F6', 'A6', 'C7', 'E7'][R.integers(6)])), .9, .05 * R.random()), tt, .9, R.uniform(-1, 1))
dr = brown(8); add(space, st(filt(dr, 25, 90)) * curve([(0, 0), (1, .6), (7, .6), (8, 0)], 8), 35.2, .20)
keys_line(41.90, 42.30, 10, bus=space)
# ================================================================ 43.0 collapse(): everything rushes into one point, then nothing
hit(43.0, .9, ('D1', 'D2', 'A2', 'D3'), 1.2, 2200, bus=space)
d = 2.0; tv = T(d); suck = np.stack([sweepnoise(d, [(0, 200), (2.0, 9000)], .35), sweepnoise(d, [(0, 180), (2.0, 9500)], .35)]) * (tv / d) ** 2.2; add(dry, suck, 43.0, .16)
rev = choir(['D3', 'A3', 'D4', 'F4', 'A4', 'D5'], 2.0, a=1.9, rel=.01, bright=1.6); add(dry, rev, 43.0, 1.4)
tv = T(2.0); ris = np.sin(2 * np.pi * np.cumsum(40 * 2 ** (tv / 2.0 * 6) ) / SR) * (tv / 2.0) ** 2; add(dry, st(ris), 43.0, .14)
# ================================================================ 45.95.. the cursor: clicks in silence, one low tail
# the typed finale is read from src/script.js (FINALE.lines), so the clicks always match the text on screen
import re as _re
_fl = _re.search(r"const FINALE = \{ lines: \[(.*?)\]", open(os.path.join(os.path.dirname(__file__), '..', 'src', 'script.js'), encoding='utf8').read()).group(1)
FIN = ''.join(a or b for a, b in _re.findall(r'''"([^"]*)"|'([^']*)\'''', _fl)); ty0, ty1 = 47.05, 49.85
def _clicks(text, bus):
    n = len(text)
    for i in range(n):
        k = (i + 1) / n; tt = ty0 + (ty1 - ty0) * k ** (1 / .92)
        if text[i] != ' ': add(bus, key(.09 * R.uniform(.85, 1.1)), tt, 1, R.uniform(-.1, .1))
# keep every later random draw (reverb impulse responses etc.) identical to the approved mix: replay the original
# 33-character line's draws into a scratch bus, then type the real line from the same starting state
_s0 = R.bit_generator.state; _clicks("I'm Opus 5.5.What should we make?", np.zeros((2, 8))); _s1 = R.bit_generator.state
R.bit_generator.state = _s0; _clicks(FIN, dry); R.bit_generator.state = _s1
print('finale typed:', repr(FIN))
add(dry, key(.05), 45.95)
d = 5.0; tv = T(d); tail = np.sin(2 * np.pi * 36.7 * tv) * np.clip(tv / 1.2, 0, 1) * np.exp(-tv / 2.2) * .18 + np.sin(2 * np.pi * 73.4 * tv) * np.clip(tv / 1.5, 0, 1) * np.exp(-tv / 1.8) * .05; add(dry, st(tail), 50.0, 1.0)
c = choir(['D3', 'A3', 'D4', 'F#4'], 4.8, a=1.5, rel=2.5, bright=.8); add(hall, c, 50.0, .35)
# ================================================================ mix
def ir(dec, d, lo, hi, pre=.02):
    t = T(d); o = []
    for ch in range(2):
        y = np.zeros_like(t)
        for a, b, m in [(lo, 400, 1.15), (400, 1600, 1.0), (1600, 5000, .62), (5000, hi, .34)]: y += filt(R.standard_normal(len(t)), a, b, 2) * np.exp(-t * 6.91 / (dec * m))
        y[:int(.002 * SR)] = 0; y = np.concatenate([np.zeros(int(pre * SR)), y]); o.append(y / np.sqrt(np.sum(y ** 2)))
    return np.stack(o)
def conv(x, h):
    n = x.shape[1] + h.shape[1]; m = 1 << int(np.ceil(np.log2(n))); return np.stack([np.fft.irfft(np.fft.rfft(x[c], m) * np.fft.rfft(h[c], m), m)[:x.shape[1]] for c in range(2)])
wetH = conv(hall, ir(2.6, 3.2, 60, 9000, .025)); wetN = conv(nave, ir(6.2, 7.0, 70, 10000, .045)); wetS = conv(space, ir(9.0, 10.0, 40, 8000, .06))
tt = np.arange(dry.shape[1]) / SR
duck = np.interp(tt, [0, 8.94, 8.985, 9.0, 9.10, 9.45, 99], [1, 1, .12, 1, .35, .9, 1]); wetH *= duck
gate = np.interp(tt, [0, 12.875, 12.895, 12.925, 12.936, 99], [1, 1, .06, .06, 1, 1]); wetN *= np.interp(tt, [0, 12.875, 12.895, 12.925, 12.95, 13.6, 99], [1, 1, .12, .12, .8, .25, .2])
pre = np.interp(tt, [0, .955, .975, .988, .999, 1.0, 99], [1, 1, .05, .05, .05, 1, 1])
dry *= gate * pre; wetH *= gate * pre
mix = dry + wetH * 1.15 + wetN * 1.1 + wetS * 1.0
# real silence: from the instant everything reaches the point until the cursor appears, every bus is cut to zero
sil = np.interp(tt, [0, 44.96, 45.0, 45.93, 45.95, 99], [1, 1, 0, 0, 1, 1]); mix *= sil
mix = mix[:, :N]
mix = np.stack([filt(m, 24, 19000, 2) for m in mix]); G = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0; mix *= G
mix = np.tanh(mix * .9) / .9
def limiter(x, ceil=10 ** (-1.6 / 20), look=.004, rel=.09):
    up = np.max(np.abs(np.stack([np.interp(np.arange(0, x.shape[1], .5), np.arange(x.shape[1]), c) for c in x])), axis=0).reshape(-1, 2).max(axis=1)
    need = np.minimum(1, ceil / np.maximum(up, 1e-9)); L = int(look * SR)
    from numpy.lib.stride_tricks import sliding_window_view as sw
    m = sw(np.pad(need, (L, L), mode='edge'), 2 * L + 1).min(axis=1); g = np.empty_like(m); c = 1.0; a = np.exp(-1 / (rel * SR))
    for i in range(len(m)):
        c = m[i] if m[i] < c else min(m[i], 1 - (1 - c) * a); g[i] = c
    k = np.hanning(2 * L + 1); k /= k.sum(); g = np.convolve(np.pad(g, (L, L), mode='edge'), k, 'valid'); return x * np.minimum(g, 1)
mix = limiter(mix); mix *= sil[:N]
nf = int(1.5 * SR); mix[:, -nf:] *= np.cos(np.linspace(0, np.pi / 2, nf)) ** 1.5
pcm = np.clip(mix * 8388607, -8388608, 8388607).astype(np.int32)
b = np.empty((N * 2,), np.int32); b[0::2] = pcm[0]; b[1::2] = pcm[1]; raw = np.frombuffer(b.tobytes(), np.uint8).reshape(-1, 4)[:, :3].tobytes()
with wave.open(out, 'wb') as w: w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR); w.writeframes(raw)
print('wrote', out, 'peak', round(20 * np.log10(np.max(np.abs(mix)) + 1e-12), 2), 'silence samples', int(np.sum(np.all(mix == 0, axis=0))))
