// The score and sound design for BETWEEN BLINKS.
//   node src/audio/score.mjs [out.wav] [--stems]
// 120 BPM, D major. At 24 fps a beat is 12 frames. Ring clicks, raindrop chimes
// and guesses use the same times as the picture (read from the film's source).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, N, TAU, Bus, writer, rng, hz, biquad, svf, onepole, reverb, echo, lufs, limit, truePeaks, wav24, db, clamp, lerp } from './dsp.mjs';
import * as I from './instruments.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const grab = (text, re) => (0, eval)('(' + text.match(re)[1] + ')');
const RING_KEYS = grab(src('55_ma.js'), /const RING_KEYS = (\[[\s\S]*?\]\]);/);
const NAMED = grab(src('60_shots_act1.js'), /const NAMED = (\[[\s\S]*?\n\]);/);
const BLINK_START = +src('55_ma.js').match(/const BLINK_START = ([\d.]+)/)[1];

const mus = new Bus(), sfx = new Bus(), send = new Bus(), dly = new Bus();     // gated
const post = new Bus(), psend = new Bus();                                     // never gated
const rainA = new Bus(), rainB = new Bus();
// routing presets: [dry bus, gain], [reverb send, gain], [echo send, gain]
const M = (wet = .35, dry = 1, ech = 0) => [[mus, dry], [send, wet], [dly, ech]];
const S = (wet = .25, dry = 1) => [[sfx, dry], [send, wet]];
const Po = (wet = .4, dry = 1) => [[post, dry], [psend, wet]];

const CHORD = {
  G: { root: 'G2', pad: ['G3', 'B3', 'D4', 'F#4'], hi: ['B4', 'D5', 'F#5'] },
  A: { root: 'A2', pad: ['A3', 'C#4', 'E4', 'A4'], hi: ['C#5', 'E5', 'A5'] },
  Fsm: { root: 'F#2', pad: ['F#3', 'A3', 'C#4', 'E4'], hi: ['A4', 'C#5', 'E5'] },
  Bm: { root: 'B1', pad: ['B3', 'D4', 'F#4', 'A4'], hi: ['B4', 'D5', 'F#5'] },
  D: { root: 'D2', pad: ['D3', 'A3', 'D4', 'F#4'], hi: ['D5', 'F#5', 'A5'] },
  Em: { root: 'E2', pad: ['E3', 'B3', 'D4', 'G4'], hi: ['B4', 'D5', 'G5'] },
};
const pad = (t, len, c, o = {}) => CHORD[c].pad.forEach((n, i) => I.strings(t, n, len, { to: M(o.wet ?? .4), vel: o.vel ?? .5, cut: o.cut ?? 2400, a: o.a, r: o.r, swell: o.swell, pan: (i - 1.5) * .18 }));
const voices = (t, len, notes, o = {}) => notes.forEach((n, i) => I.choir(t, n, len, { to: o.route ?? M(o.wet ?? .55, o.dry ?? .8), vel: o.vel ?? .5, vowel: o.vowel ?? 'ah', to2: o.to2, a: o.a, r: o.r, swell: o.swell, singers: o.singers ?? 3, pan: (i - (notes.length - 1) / 2) * .4 }));
const keys = (t, note, len, vel = .6, route = M(.45)) => I.piano(t, note, len, { to: route, vel });
const phrase = (t0, list, fn) => list.forEach(([dt, n, len]) => fn(t0 + dt, n, len));
// the blink motif: a rising question that settles back
const MOTIF = [[0, 'A4', .75], [.75, 'D5', .25], [1, 'E5', .5], [1.5, 'F#5', .5], [2, 'E5', 1.5], [3.5, 'C#5', .5], [4, 'D5', .75], [4.75, 'E5', .25], [5, 'F#5', .5], [5.5, 'A5', .5], [6, 'F#5', 2]];
const up = (n, k = 1) => hz(n) * Math.pow(2, k);

// ---------------------------------------------------------------- rain ambience
function rainBed(bus, from, to, seed) {
  const R = rng(seed);
  for (const side of [0, 1]) {
    const data = side ? bus.R : bus.L;
    const hp = biquad('hp', 900), lp = biquad('lp', 6200), body = biquad('bp', 420, .7), lfo = onepole(3);
    for (let i = Math.round(from * SR); i < Math.min(N, Math.round(to * SR)); i++) {
      const v = R.bi();
      data[i] += lp(hp(v)) * (.055 + .012 * lfo(R.bi()) * 6) + body(v) * .03;
    }
  }
  const count = Math.round((to - from) * 85);
  for (let k = 0; k < count; k++) {
    const t = R.range(from, to - .04), f = R.range(1700, 6800), a = Math.pow(R(), 2.5) * .075, pan = R.bi();
    const w = writer([[bus, 1]], pan), st = Math.round(t * SR);
    let ph = 0;
    for (let i = 0; i < .018 * SR; i++) { ph += TAU * f * (1 + i / SR * 9) / SR; w(st + i, Math.sin(ph) * Math.exp(-i / SR * 260) * a); }
  }
}
rainBed(rainA, 0, 2.6, 501);
rainBed(rainB, 73.35, 84.5, 502);
{ // time stops: the rain is dragged to a halt like a tape, in a quarter second
  const L = Float32Array.from(rainA.L), R_ = Float32Array.from(rainA.R), t0 = 2.0, stop = .24;
  for (let i = Math.round(t0 * SR); i < Math.round(2.7 * SR); i++) {
    const u = i / SR - t0;
    if (u >= stop) { rainA.L[i] = 0; rainA.R[i] = 0; continue; }
    const pos = (t0 + u - u * u / (2 * stop)) * SR, j = pos | 0, f = pos - j, a = 1 - u / stop;
    rainA.L[i] = (L[j] * (1 - f) + L[j + 1] * f) * a; rainA.R[i] = (R_[j] * (1 - f) + R_[j + 1] * f) * a;
  }
}
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const ga = t < 2.4 ? .95 : 0, gb = clamp((t - 73.4) / 1.6) * (1 - clamp((t - 82.6) / 1.7)) * (t > 76.875 && t < 77.7 ? .55 : 1) * .5;
  sfx.L[i] += rainA.L[i] * ga + rainB.L[i] * gb; sfx.R[i] += rainA.R[i] * ga + rainB.R[i] * gb;
}

// ---------------------------------------------------------------- 0 - 5 hook and freeze
['D3', 'A3', 'E4'].forEach((n, i) => I.strings(0, n, 2.0, { to: M(.4), vel: .42, a: .25, r: .08, cut: 1700, swell: [.5, 1.25], pan: (i - 1) * .4 }));
I.taiko(.16, { to: S(.3), vel: .55, f: 56 }); I.thud(.16, { to: S(.2), vel: .8 });
I.musicBox(.19, 'A5', { to: M(.6), vel: .85, dec: 1.6 });
keys(.19, 'D2', 1.6, .55);
I.heartbeat(.62, { to: S(.15), vel: .55 }); I.heartbeat(1.36, { to: S(.15), vel: .72 });
I.swell(2.0, 1.35, { to: S(.2), vel: 1.15 });
I.whoosh(1.5, .52, { to: S(.2), vel: .6, f0: 900, f1: -600, peak: .9, dir: -1 });
// the world stops
I.boom(2.0, { to: S(.22), vel: 1.0, dec: 1.6 }); I.taiko(2.0, { to: S(.4), vel: 1.0, f: 50 }); I.crash(2.0, { to: S(.45), vel: .85, dec: 1.7 });
I.braam(2.0, 'D2', 1.25, { to: M(.3), vel: 1.0 });
I.glass(2.0, 'D7', { to: S(.8), vel: .55, dec: 1.8 });
I.drone(2.2, 'D6', 2.2, { to: M(.7), vel: .14, a: .5, r: 1.1 });
I.taiko(2.18, { to: S(.35), vel: .62, f: 66 });
I.taiko(2.62, { to: S(.4), vel: .95, f: 54 }); I.boom(2.62, { to: S(.2), vel: .55, dec: .9 }); keys(2.62, 'D2', 1.4, .75); keys(2.62, 'A2', 1.4, .6);
{ // the years counting up on screen
  let last = -1;
  for (let t = 2.63; t < 3.5; t += 1 / 96) {
    const k = (t - 2.62) / .88, n = Math.floor((1 - Math.pow(2, -10 * k)) * 36);
    if (n !== last) { I.tick(t, { to: S(.12), vel: .42, f: 2500 + n * 55, pan: (n % 2 ? .3 : -.3) }); last = n; }
  }
}
I.musicBox(3.5, 'D6', { to: M(.7), vel: .9, dec: 2 }); keys(3.5, 'D3', 1.2, .5);
I.tick(4.02, { to: Po(.5), vel: .55, f: 1900 }); I.tick(4.52, { to: Po(.5), vel: .5, f: 1450 });
I.whoosh(4.4, .66, { to: S(.3), vel: .85, f0: 260, f1: 3400, peak: .92 }); I.swell(5.0, .6, { to: S(.3), vel: .7 });

// ---------------------------------------------------------------- 5 - 15 the roof
I.boom(5.0, { to: S(.35), vel: .34, dec: 1.3 });
['G2', 'D3'].forEach(n => keys(5.0, n, 3.5, .5)); ['B4', 'F#5'].forEach(n => keys(5.02, n, 3, .34));
pad(5.0, 2.05, 'G', { vel: .42, cut: 1700, a: .5 }); pad(7.0, 2.05, 'A', { vel: .42, cut: 1750 }); pad(9.0, 2.05, 'Fsm', { vel: .44, cut: 1850 });
pad(11.0, 2.05, 'Bm', { vel: .42, cut: 1700 }); pad(13.0, 2.05, 'G', { vel: .44, cut: 1900 });
phrase(5.0, MOTIF, (t, n, len) => I.musicBox(t, up(n), { to: M(.62, .9, .18), vel: .82, dec: Math.max(.9, len * 1.5) }));
{ const R = rng(88), pent = ['D6', 'E6', 'F#6', 'A6', 'B6', 'D7'];
  for (let t = 5.6; t < 14.8; t += R.range(.45, 1.05)) I.glass(t, pent[Math.floor(R() * pent.length)], { to: S(.9, .45), vel: R.range(.16, .34), pan: R.bi() * .8, dec: .7 }); }
['B1', 'G1'].forEach((n, i) => I.drone(11 + i * 2, up(n), 2, { to: M(.2), vel: .55, a: .3, r: .5 }));
[[11.0, ['B2', 'F#3', 'D4', 'F#4']], [13.0, ['G2', 'D3', 'B3', 'D4']]].forEach(([t0, ns]) => ns.forEach((n, i) => keys(t0 + i * .5, n, 1.3, .38 + i * .03)));
// one spoken word, stretched across ten thousand years: a vowel that barely moves
I.choir(11.4, 'A3', 3.1, { to: M(.8, .55), vel: .2, vowel: 'eh', to2: 'ee', a: 1.1, r: .8, singers: 2, width: .4, breath: .22 });
I.glass(12.22, 'A6', { to: S(.7), vel: .4, pan: .35, dec: .5 }); I.glass(12.34, 'E7', { to: S(.7), vel: .3, pan: .4, dec: .4 });
I.whoosh(14.7, .42, { to: S(.35), vel: .4, peak: .75 });

// ---------------------------------------------------------------- 15 - 21 naming
pad(15.0, 2.05, 'D', { vel: .5, cut: 2300 }); pad(17.0, 2.55, 'A', { vel: .55, cut: 2500, swell: [.75, 1.15] });
[[15.0, ['D3', 'A3', 'D4', 'F#4', 'A4', 'F#4', 'D4', 'A3'], 8], [17.0, ['C#3', 'A3', 'C#4', 'E4', 'A4', 'C#5', 'E5', 'C#5'], 8], [19.0, ['C#3', 'A3'], 2]]
  .forEach(([t0, ns, cnt]) => { for (let i = 0; i < cnt; i++) keys(t0 + i * .25, ns[i % ns.length], .7, .36 + (i % 4 === 0 ? .1 : 0)); });
const PENT = ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6', 'A6', 'B6', 'D7', 'E7', 'D7', 'F#7'];
NAMED.forEach(([t, x], i) => {
  const pan = clamp((x - 960) / 1100, -.8, .8);
  I.glass(t, PENT[i], { to: [[sfx, 1], [send, .55], [dly, .2]], vel: i < 6 ? .92 : .6, pan, dec: .85 });
  I.tick(t, { to: S(.2), vel: .22, f: 3600, pan });
});
{ const R = rng(404); let t = 18.3, gap = .075;
  while (t < 19.47) { I.glass(t, PENT[3 + Math.floor(R() * 10)], { to: S(.7, .6), vel: R.range(.16, .36), pan: R.bi(), dec: .3 }); t += gap; gap = Math.max(.016, gap * .93); } }
I.riser(18.35, 1.15, { to: S(.3), vel: .5, f0: 220, span: 4 });
// each of MA's dashes has a short breath of air
[...NAMED.slice(0, 6).map(n => [n[0], n[1]]), [18.65, 1500]].forEach(([t0, x], i) =>
  I.whoosh(t0 - .27, .19, { to: S(.3), vel: .34, f0: 1100, f1: 3400, peak: .55, dir: i % 2 ? 1 : -1 }));
// the drop that is heading for her nose has its own two-note chime
const noseChime = (t, v, route) => { I.glass(t, 'E6', { to: route, vel: v, dec: 1.2, pan: .1 }); I.glass(t + .11, 'B6', { to: route, vel: v * .9, dec: 1.3, pan: .15 }); I.musicBox(t + .11, 'B5', { to: route, vel: v * .5, dec: 1.2 }); };
I.thud(19.5, { to: S(.4), vel: .6 }); pad(19.5, 1.5, 'G', { vel: .34, cut: 1600, a: .12 }); keys(19.5, 'G2', 1.4, .45);
noseChime(19.56, 1.0, [[sfx, 1], [send, .7], [dly, .3]]);
for (let i = 0; i < 11; i++) I.tick(19.96 + i * .045, { to: S(.3), vel: .22 + i * .012, f: 1900 + i * 210, pan: .1 });

// ---------------------------------------------------------------- 21 - 28 guessing, then nothing
I.whoosh(20.72, .42, { to: S(.3), vel: .65, peak: .85 });
I.taiko(21.1, { to: S(.35), vel: .8, f: 58 }); keys(21.1, 'B1', 1.8, .7);
{ const FIG = { Bm: ['B3', 'F#4', 'D4', 'F#4'], G: ['G3', 'D4', 'B3', 'D4'], Em: ['E3', 'B3', 'G3', 'B3'], A: ['A3', 'E4', 'C#4', 'E4'] };
  const at = t => (t < 23 ? 'Bm' : t < 25 ? 'G' : t < 26 ? 'Em' : 'A');
  let i = 0;
  for (let t = 21.0; t < 26.99; t += t < 24 ? .25 : .125, i++) {
    const c = at(t), n = FIG[c][i % 4], p = (t - 21) / 6;
    I.stab(t, n, .09, { to: M(.25), vel: .5 + .5 * p, cut: 1800 + 3800 * p, pan: i % 2 ? .4 : -.4 });
    if (t >= 24) I.stab(t, up(n), .07, { to: M(.3), vel: .22 + .4 * p, cut: 5200, pan: i % 2 ? -.5 : .5 });
  }
  pad(21.0, 2.02, 'Bm', { vel: .34 }); pad(23.0, 2.02, 'G', { vel: .42 }); pad(25.0, 1.02, 'Em', { vel: .52 }); pad(26.0, 1.0, 'A', { vel: .62, a: .1, r: .05 });
  for (let t = 23; t < 26.99; t += .25) I.bass(t, CHORD[at(t)].root, .18, { to: M(0), vel: .35 + (t - 23) * .1 });
  for (let t = 21.5; t < 25.5; t += t < 23 ? 1 : .5) I.taiko(t, { to: S(.3), vel: .4 + (t - 21) * .07, f: 64 });
  for (let t = 25.5; t < 26.99; t += t < 26.5 ? .25 : .125) I.taiko(t, { to: S(.3), vel: .5 + (t - 25.5) * .32, f: 70 });
  for (let t = 25.75; t < 26.97; t += t < 26.4 ? .125 : .0625) I.snare(t, { to: S(.2), vel: .18 + Math.pow((t - 25.75) / 1.2, 2) * .85 });
}
[21.55, 22.1, 22.6, 23.05, 23.4, 23.7, 23.95, 24.15].forEach((t, i) => {
  I.musicBox(t, ['B5', 'D6', 'E6', 'F#6', 'A6', 'B6', 'D7', 'E7'][i], { to: M(.45, 1, .25), vel: .9 - i * .02, dec: .9, pan: i % 2 ? .55 : -.55 });
});
{ const R = rng(1234); for (let i = 0; i < 58; i++) I.glass(23.9 + Math.pow(i / 58, .6) * 1.7, PENT[4 + Math.floor(R() * 9)], { to: S(.5, .5), vel: .14 + R() * .16, pan: R.bi(), dec: .2 }); }
voices(24.0, 2.98, ['B3', 'F#4', 'B4'], { vowel: 'oh', to2: 'ah', vel: .55, a: 1.4, r: .04, swell: [.25, 1.25] });
I.riser(23.0, 3.98, { to: S(.2), vel: .95, f0: 98, span: 7 });
// 27: hard stop, a breath, two piano notes
keys(27.02, 'B3', .45, .6, Po(.55)); keys(27.52, 'F#3', .4, .55, Po(.55));
I.breath(27.06, .5, { to: Po(.3), vel: 1.0 });
I.swell(28.0, .62, { to: Po(.1), vel: .95 }); I.whoosh(27.6, .42, { to: Po(.1), vel: .8, f0: 300, f1: 3800, peak: .96 });

// ---------------------------------------------------------------- 28 - 40 every life after
const DROP = [[28, 'G'], [30, 'A'], [32, 'Fsm'], [34, 'Bm'], [36, 'G'], [38, 'A']];
function groove(from, to, o = {}) {
  for (let b = from; b < to - .01; b += 2) {
    const end = Math.min(to, b + 2);
    const at = (dt, fn) => { if (b + dt < end - .001) fn(b + dt); };
    [0, .75, 1.0].forEach(d => at(d, t => I.kick(t, { to: S(.04), vel: (d === .75 ? .62 : .95) * (o.vel ?? 1) })));
    [.5, 1.5].forEach(d => at(d, t => { I.snare(t, { to: S(.2), vel: .95 * (o.vel ?? 1) }); I.taiko(t, { to: S(.25), vel: .22 * (o.vel ?? 1), f: 95 }); }));
    const step = o.fast ? .125 : .25;
    for (let d = 0; d < 1.999; d += step) at(d, t => I.hat(t, { to: S(.06), vel: (Math.abs((d * 2) % 1 - .5) < .01 ? .85 : .48) * (o.vel ?? 1), open: Math.abs(d - 1.75) < .01 }));
    if (o.fill !== false) [1.625, 1.75, 1.875].forEach((d, i) => at(d, t => I.taiko(t, { to: S(.25), vel: .36 + i * .14, f: 105 - i * 17, pan: -.4 + i * .4 })));
  }
}
for (const [t, c] of DROP) {
  pad(t, 2.0, c, { vel: .66, cut: 3900, a: .04, r: .16, wet: .3 });
  I.strings(t, up(CHORD[c].root), 2.0, { to: M(.2), vel: .55, cut: 1100, a: .03, r: .1 });
  voices(t, 1.98, CHORD[c].hi, { vel: .52, a: .08, r: .22, singers: 3 });
  for (let k = 0; k < 8; k++) I.bass(t + k * .25, k === 3 || k === 7 ? up(CHORD[c].root) : CHORD[c].root, .19, { to: M(0), vel: .86 });
  keys(t, CHORD[c].root, 1.4, .85, M(.3)); CHORD[c].hi.forEach(n => keys(t, n, 1.1, .5, M(.35)));
  I.crash(t, { to: S(.3), vel: .5, dec: 1.3 }); I.boom(t, { to: S(.15), vel: t === 28 ? .92 : .42, dec: t === 28 ? 1.4 : .7 });
}
I.taiko(28, { to: S(.35), vel: 1.05, f: 50 }); I.crash(28.0, { to: S(.4), vel: .55, dec: 2.2 });
groove(28, 36); groove(36, 38, { fast: true }); groove(38, 40, { fast: true, fill: false });
phrase(28, MOTIF, (t, n, len) => { I.lead(t, n, len * .96, { to: M(.34, 1, .22), vel: .95 }); I.musicBox(t, up(n), { to: M(.5, .55), vel: .55, dec: .8 }); });
phrase(36, MOTIF.slice(0, 5).map((m, i) => (i === 4 ? [2, 'A5', 2] : m)), (t, n, len) => { I.lead(t, n, len * .96, { to: M(.34, 1, .22), vel: 1.0 }); I.lead(t, up(n), len * .96, { to: M(.4, .45), vel: .5 }); });
// each life has its own sound
I.whoosh(27.98, .5, { to: S(.4), vel: .7, peak: .1, dir: 1 });
for (const t of [30.0, 30.9, 31.35]) I.whoosh(t - .06, .3, { to: S(.3), vel: .6, f0: 900, f1: 3600, peak: .35, dir: t === 30.9 ? -1 : 1 });
I.whoosh(32.0, 1.9, { to: S(.5), vel: .42, f0: 240, f1: 1500, peak: .45, dir: 1 });
['B4', 'D5', 'F#5', 'A5', 'B5', 'D6', 'F#6', 'A6', 'B6', 'A6', 'F#6', 'D6'].forEach((n, i) => keys(34.0 + i * .125 + .0625, n, .5, .52, M(.55, .85)));
{ const R = rng(34); for (let i = 0; i < 16; i++) I.plip(34.05 + R() * 1.85, { to: S(.7, .5), vel: .22, f: R.range(500, 1200), pan: R.bi() }); }
for (let i = 0; i < 9; i++) I.glass(36.1 + i * .2, PENT[2 + ((i * 3) % 9)], { to: S(.8, .55), vel: .3, pan: (i % 3 - 1) * .6, dec: .6 });
[38.5, 39.0, 39.5].forEach((t, i) => { I.taiko(t, { to: S(.35), vel: .7 + i * .12, f: 62 }); I.crash(t, { to: S(.3), vel: .24 + i * .08, dec: .5 }); I.whoosh(t - .2, .24, { to: S(.2), vel: .6, peak: .92, dir: i % 2 ? -1 : 1 }); });
['A5', 'C#6', 'E6', 'A6', 'C#7', 'E7'].forEach((n, i) => I.musicBox(38.5 + i * .25, n, { to: M(.5, .8, .2), vel: .7, dec: .5 }));
for (let t = 39.5; t < 40; t += .0625) I.snare(t, { to: S(.2), vel: .3 + (t - 39.5) * 1.2 });

// ---------------------------------------------------------------- 40 - 46 the web, then the eye
I.boom(40, { to: S(.25), vel: .74, dec: 1.2 }); I.crash(40, { to: S(.45), vel: .7, dec: 2.2 }); I.taiko(40, { to: S(.35), vel: .95, f: 52 });
const WEBC = [[40, 1.5, 'Bm'], [41.5, 1.5, 'G'], [43, 1.0, 'Em'], [44, 1.0, 'A']];
for (const [t, len, c] of WEBC) {
  const p = (t - 40) / 5;
  pad(t, len, c, { vel: .52 + p * .26, cut: 2600 + p * 2600, a: .06, r: .12 });
  I.strings(t, up(CHORD[c].root), len, { to: M(.25), vel: .6, cut: 1000, a: .03 });
  voices(t, len, CHORD[c].hi, { vel: .4 + p * .34, vowel: 'oh', to2: 'ah', a: .12, r: .12 });
  keys(t, CHORD[c].root, len, .7);
}
{ const walk = ['B4', 'D5', 'F#5', 'B5', 'D5', 'F#5', 'A5', 'D6', 'F#5', 'B5', 'D6', 'F#6', 'A5', 'D6', 'E6', 'A6'];
  for (let i = 0; i < 40; i++) {
    const t = 40 + i * .125, p = i / 40;
    I.musicBox(t, up(walk[i % 16], p > .72 ? 1 : 0), { to: M(.5, .75, .2), vel: .34 + p * .46, dec: .45, pan: Math.sin(i * .9) * .7 });
  } }
I.riser(41.6, 3.4, { to: S(.25), vel: .8, f0: 147, span: 5 });
for (let t = 43; t < 44.97; t += t < 44 ? .25 : t < 44.6 ? .125 : .0625) I.taiko(t, { to: S(.35), vel: .22 + Math.pow((t - 43) / 2, 1.6) * .66, f: 73 });
I.swell(45.0, 1.1, { to: S(.3), vel: .95 });
I.boom(45.0, { to: S(.35), vel: 1.0, dec: 1.7 }); I.taiko(45.0, { to: S(.5), vel: 1.05, f: 47 }); I.crash(45.0, { to: S(.55), vel: .82, dec: 2.1 });
I.braam(45.0, 'D2', .75, { to: M(.4), vel: .6 });
['D2', 'A2', 'F#4', 'C#5', 'E5'].forEach(n => keys(45.0, n, 1.2, .78, M(.6)));
['D3', 'A3', 'F#4', 'C#5', 'E5'].forEach((n, i) => I.strings(45.0, n, .8, { to: M(.55), vel: .72, a: .02, r: .55, cut: 4200, pan: (i - 2) * .25 }));
voices(45.0, .8, ['D4', 'F#4', 'A4', 'E5'], { vel: .6, a: .04, r: .6, wet: .7 });
['A6', 'D7', 'F#6', 'E7', 'A7', 'C#7', 'D6', 'E6'].forEach((n, i) => I.glass(45.03 + i * .07, n, { to: S(.9, .6), vel: .45 - i * .03, pan: (i % 2 ? .6 : -.6), dec: 1.1 }));

// ---------------------------------------------------------------- 46 - 52 the question
I.heartbeat(46.22, { to: Po(.2), vel: .5 }); I.heartbeat(48.15, { to: Po(.2), vel: .44 });
[[46.68, 'B4', .46], [47.2, 'D5', .4], [47.72, 'C#5', .42], [48.5, 'A4', .46]].forEach(([t, n, v]) => keys(t, n, 1.3, v, Po(.75, .9)));
I.drone(46.1, 'B2', 3.3, { to: Po(.2), vel: .3, a: .9, r: .5 });
I.thud(49.5, { to: Po(.4), vel: .75 }); keys(49.5, 'G2', 2.6, .5, Po(.5)); keys(49.52, 'D3', 2.6, .38, Po(.5));
pad(49.5, 2.5, 'G', { vel: .26, cut: 1300, a: 1.1, r: .5, wet: .6 });
// the motif asks, and stops before its answer
[[49.82, 'A4', 1], [50.45, 'D5', .95], [51.1, 'E5', 1.0]].forEach(([t, n, v]) => { I.musicBox(t, up(n), { to: Po(.7), vel: v * .85, dec: 1.7 }); keys(t, n, 1.2, .3, Po(.7)); });

// ---------------------------------------------------------------- 52 - 59 no match
I.glass(52.46, 'B6', { to: S(.8), vel: .7, dec: .8 }); I.thud(52.46, { to: S(.3), vel: .35 });
[52.9, 52.98, 53.1, 53.34, 53.4].forEach((t, i) => I.tick(t, { to: S(.15), vel: .85, f: [3100, 1500, 2700, 900, 3300][i], pan: i % 2 ? .5 : -.5 }));
I.drone(53.2, 'B2', 2.5, { to: M(.3), vel: .5, a: .7, r: .05, ratio: 1.059 });
I.riser(53.3, 2.42, { to: S(.2), vel: .62, f0: 330, span: 3.2 });
for (let t = 53.5; t < 55.55; t += .25) I.bass(t, 'B1', .1, { to: M(0), vel: .3 + (t - 53.5) * .13 });
I.shatter(55.74, { to: Po(.35, .95) }); I.boom(55.74, { to: Po(.25), vel: .62, dec: .85 }); keys(55.74, 'C2', 1.1, .65, Po(.4));
{ const R = rng(56); for (let i = 0; i < 60; i++) { const t = 55.95 + Math.pow(R(), 1.5) * 1.7; I.tick(t, { to: Po(.5, .5), vel: .1 * (1 - (t - 55.95) / 1.9), f: R.range(600, 1900), pan: R.bi() }); } }
keys(57.43, 'F#2', 1.9, .46, Po(.6)); keys(57.45, 'B3', 1.9, .5, Po(.65));
I.thud(57.375, { to: Po(.5), vel: .46, f: 52 }); I.glass(57.385, 'F#6', { to: Po(.9), vel: .42, dec: 1.4 });
I.choir(57.4, 'D4', 1.35, { to: Po(.95, .4), vel: .26, vowel: 'oo', a: .5, r: .4, singers: 2 });
I.drone(56.4, 'F#5', 2.3, { to: Po(.6), vel: .1, a: .8, r: .5 });

// ---------------------------------------------------------------- 59 - 63.5 the waiting
[[59.1, 'F#4', .9], [59.75, 'B4', .3], [60.0, 'C#5', .35], [60.35, 'D5', .55], [60.9, 'C#5', 1.4]].forEach(([t, n, len]) => keys(t, n, len + .35, .52, M(.7, .95)));
keys(59.1, 'B2', 1.8, .36, M(.6)); keys(60.9, 'G2', 1.6, .36, M(.6)); keys(59.6, 'F#3', 1.2, .24, M(.6));
I.choir(59.3, 'F#4', 2.2, { to: M(.95, .45), vel: .34, vowel: 'oo', to2: 'oh', a: .9, r: .9, singers: 2 });
I.whoosh(59.0, 2.9, { to: S(.5), vel: .22, f0: 180, f1: 520, peak: .6, dir: 1 });
{ const R = rng(61); for (let i = 0; i < 14; i++) I.glass(59.2 + i * .17 + R() * .1, PENT[5 + Math.floor(R() * 8)], { to: S(1, .25), vel: .12, pan: R.bi(), dec: .6 }); }
keys(61.77, 'E3', 1.2, .3, M(.7));
[[62.22, 'D6', .62], [62.52, 'F#6', .55], [62.84, 'E6', .7]].forEach(([t, n, v]) => I.musicBox(t, n, { to: M(.75), vel: v, dec: 1.5 }));
pad(62.75, 1.0, 'G', { vel: .34, a: .7, cut: 1700 });

// ---------------------------------------------------------------- 63.5 - 69 the promise
pad(63.5, 1.55, 'G', { vel: .48, cut: 2300, a: .2 }); pad(65.0, .62, 'A', { vel: .54, cut: 2700, a: .08 });
keys(63.5, 'G2', 1.5, .45); ['B3', 'D4'].forEach(n => keys(63.52, n, 1.4, .3)); keys(65.0, 'A2', .7, .45);
[[64.15, 'A4'], [64.9, 'D5'], [65.16, 'E5']].forEach(([t, n]) => { keys(t, n, 1.1, .56, M(.5)); I.musicBox(t, up(n), { to: M(.6, .9, .2), vel: .72, dec: 1.2 }); });
I.whoosh(65.52, .66, { to: S(.4), vel: .3, peak: .9 });
pad(65.625, .6, 'Bm', { vel: .54, cut: 2900, a: .06 });
// the fingers close, and the motif gets its answer
pad(66.22, 1.0, 'G', { vel: .72, cut: 3600, a: .04, r: .5 });
['G2', 'D3', 'B4'].forEach(n => keys(66.22, n, 1.4, .6)); keys(66.22, 'F#5', 1.5, .72, M(.55)); I.musicBox(66.22, 'F#6', { to: M(.65, 1, .25), vel: 1, dec: 2 });
['D6', 'A6', 'D7'].forEach((n, i) => I.glass(66.22 + i * .04, n, { to: S(.85), vel: .6, pan: (i - 1) * .5, dec: 1.2 }));
I.thud(66.22, { to: S(.4), vel: .6 });
voices(66.22, .95, ['D4', 'G4', 'B4'], { vel: .46, a: .14, r: .6 });
pad(67.05, 1.85, 'Em', { vel: .46, cut: 1900, a: .35, r: .1, swell: [1, .25] });
keys(67.12, 'E5', .8, .42, M(.6)); keys(67.9, 'D5', .8, .34, M(.6)); keys(67.12, 'E2', 1.7, .34, M(.5));
I.heartbeat(67.55, { to: S(.2), vel: .44 }); I.heartbeat(68.4, { to: S(.2), vel: .34 });
I.whoosh(68.56, .48, { to: S(.2), vel: .5, f0: 160, f1: 700, peak: .35, dir: -1 });

// MA's ring, heard: one click per tick mark passing, faster as it thinks
{
  const STEP = TAU / 24;
  const spd = t => { for (let i = 0; i < RING_KEYS.length - 1; i++) { const [a, va] = RING_KEYS[i], [b, vb] = RING_KEYS[i + 1]; if (t >= a && t < b) return va + (vb - va) * (t - a) / (b - a); } return 0; };
  // only while MA is on screen or the sequence is about its thinking
  const AUDIBLE = [[5, 11, .34], [11, 15, .3], [15, 21, .2], [21, 28, .62], [46, 52, 0], [52, 56.4, .72], [56.4, 59, .34], [59, 63.5, .26], [63.5, 67, .24], [67, 68.99, .95]];
  let acc = 0, last = 0, k = 0;
  for (let t = 0; t < BLINK_START; t += 1 / 2000) {
    acc += spd(t) / 2000;
    const n = Math.floor(acc / STEP);
    if (n !== last) {
      last = n; k++;
      const z = AUDIBLE.find(a => t >= a[0] && t < a[1]);
      if (z && z[2] > 0) {
        const fast = clamp((spd(t) - 2) / 9);
        I.tick(t, { to: [[t >= 56.4 && t < 69 ? post : sfx, 1], [t >= 56.4 && t < 69 ? psend : send, .18]], vel: z[2] * (1 - fast * .5), f: (k % 2 ? 2250 : 1650) + fast * 900, pan: Math.sin(acc * 1.3) * .35 });
      }
    }
  }
}
// the last click: the ring stops
I.tick(68.92, { to: Po(.7), vel: 1.35, f: 1150 }); I.thud(68.92, { to: Po(.3), vel: .35, f: 70 });

// ---------------------------------------------------------------- 69 - 73 the blink (true silence)
I.heartbeat(70.92, { to: Po(.12), vel: .5 }); I.heartbeat(72.12, { to: Po(.12), vel: .6 });
I.breath(72.52, .5, { to: Po(.35), vel: .62 });

// ---------------------------------------------------------------- 73 - 80 morning
['G2', 'D3', 'B3', 'F#4', 'A4'].forEach((n, i) => I.strings(73.0, n, 1.6, { to: M(.55), vel: .62, a: 1.15, r: .12, cut: 3600, swell: [.45, 1.2], pan: (i - 2) * .3 }));
voices(73.05, 1.55, ['B4', 'D5', 'F#5'], { vowel: 'oo', to2: 'ah', vel: .5, a: 1.0, r: .15, swell: [.4, 1.2] });
keys(73.36, 'G2', 1.4, .42);
['D6', 'F#6', 'A6', 'B6', 'D7', 'F#7'].forEach((n, i) => I.glass(73.36 + i * .07, n, { to: S(.9, .75), vel: .55 - i * .04, pan: (i - 2.5) * .24, dec: 1.3 }));
I.musicBox(73.4, 'D6', { to: M(.7), vel: .8, dec: 2 });
I.swell(74.625, 1.15, { to: S(.3), vel: .95 }); for (let t = 74.1; t < 74.6; t += .0625) I.snare(t, { to: S(.2), vel: .12 + (t - 74.1) * 1.1 });
// ticks on her time: once a second, one with each tick on screen
for (let t = 74; t < 80; t += 1) I.tick(t, { to: [[post, 1], [psend, .4]], vel: .7, f: t % 2 ? 1450 : 1900 });
const FIN = [[74.625, 1.975, 'G'], [76.6, 1.2, 'A'], [77.8, .95, 'Bm'], [78.75, .625, 'G'], [79.375, .625, 'A']];
for (const [t, len, c] of FIN) {
  const hush = t === 76.6;
  pad(t, len, c, { vel: hush ? .38 : .74, cut: hush ? 2000 : 4300, a: .04, r: .2, wet: .38, swell: hush ? [.8, 1] : undefined });
  I.strings(t, up(CHORD[c].root), len, { to: M(.2), vel: hush ? .3 : .62, cut: 1100, a: .03 });
  if (!hush) {
    voices(t, len - .02, CHORD[c].hi, { vel: .64, a: .07, r: .25, singers: 4 });
    CHORD[c].pad.slice(1).forEach(n => I.strings(t, up(n), len, { to: M(.35), vel: .34, cut: 5200, a: .05, r: .15 }));
    keys(t, CHORD[c].root, len, .86, M(.3)); CHORD[c].hi.forEach(n => keys(t, n, len, .52, M(.4)));
    for (let k = 0; k * .25 < len - .05; k++) I.bass(t + k * .25, k % 4 === 3 ? up(CHORD[c].root) : CHORD[c].root, .19, { to: M(0), vel: .88 });
  }
}
I.boom(74.625, { to: S(.2), vel: .86, dec: 1.4 }); I.taiko(74.625, { to: S(.4), vel: 1.0, f: 52 }); I.crash(74.625, { to: S(.45), vel: .82, dec: 2.2 });
groove(74.625, 76.625, { fast: true, fill: false }); groove(77.8, 79.8, { fast: true });
I.crash(77.8, { to: S(.35), vel: .5, dec: 1.4 }); I.boom(77.8, { to: S(.2), vel: .45, dec: .8 });
phrase(74.625, [[0, 'A4', .73], [.75, 'D5', .24], [1, 'E5', .48], [1.5, 'F#5', .5], [2, 'E5', .6]], (t, n, len) => { I.lead(t, n, len, { to: M(.38, 1, .24), vel: 1.05 }); I.lead(t, up(n), len, { to: M(.45, .42), vel: .52 }); I.musicBox(t, up(n), { to: M(.55, .55), vel: .6, dec: .9 }); });
phrase(77.8, [[0, 'D5', .22], [.25, 'E5', .22], [.5, 'F#5', .38], [.9, 'A5', .62], [1.55, 'F#5', .33], [1.9, 'E5', .5]], (t, n, len) => { I.lead(t, n, len, { to: M(.38, 1, .24), vel: 1.05 }); I.lead(t, up(n), len, { to: M(.45, .42), vel: .52 }); });
{ const R = rng(746); for (let t = 74.65; t < 80; t += R.range(.07, .19)) if (t < 76.875 || t > 77.8) I.glass(t, PENT[5 + Math.floor(R() * 8)], { to: S(.8, .5), vel: R.range(.14, .32), pan: R.bi(), dec: .45 }); }
// the drop comes down, and lands exactly on the frame
{ const w = writer([[sfx, 1], [send, .5]], .15), st = Math.round(76.87 * SR), n = Math.round(.63 * SR);
  let ph = 0; for (let i = 0; i < n; i++) { const p = i / n; ph += TAU * (2350 - 1350 * p * p) / SR; w(st + i, Math.sin(ph) * .028 * Math.sin(Math.PI * Math.pow(p, .7)) * (.4 + .6 * p)); } }
I.plip(77.5, { to: Po(.5, 1), vel: 1.35, f: 820 }); I.plip(77.57, { to: Po(.5), vel: .55, f: 1350, pan: -.3 }); I.plip(77.62, { to: Po(.5), vel: .4, f: 1700, pan: .35 });
noseChime(77.5, 1.15, [[post, 1], [psend, .6]]);
['D6', 'F#6', 'A6', 'D7', 'A6', 'F#7'].forEach((n, i) => I.musicBox(77.8 + i * .11, n, { to: M(.5, .95, .2), vel: .78, dec: .5 }));
I.swell(80.0, .95, { to: S(.3), vel: .85 }); I.whoosh(79.15, 1.0, { to: S(.35), vel: .6, f0: 300, f1: 3200, peak: .84 });

// ---------------------------------------------------------------- 80 - 84.5 title
I.boom(80.0, { to: S(.3), vel: .5, dec: 1.2 }); I.crash(80.0, { to: S(.45), vel: .45, dec: 1.6 });
pad(80.0, 1.75, 'G', { vel: .52, cut: 2600, a: .05, r: .1, swell: [.6, 1.25] }); keys(80.0, 'G2', 1.7, .55);
for (let i = 0; i < 12; i++) I.brush(80.12 + (i / 12.6) * 1.5, .13, { to: S(.35), vel: i < 8 ? 1.0 : 1.2, pan: i < 4 ? -.3 : i < 8 ? .3 : 0 });
voices(81.0, .74, ['D4', 'G4', 'B4'], { vowel: 'oh', to2: 'ah', vel: .46, a: .5, r: .06, swell: [.4, 1.2] });
['A5', 'D6', 'F#6', 'A6'].forEach((n, i) => I.glass(81.36 + i * .09, n, { to: S(.9, .7), vel: .46, pan: (i - 1.5) * .3, dec: 1.2 }));
I.swell(81.75, .7, { to: S(.2), vel: .7 });
// the home chord, heard for the first time as a full close
I.boom(81.75, { to: S(.3), vel: .95, dec: 1.7 }); I.taiko(81.75, { to: S(.5), vel: 1.0, f: 48 }); I.crash(81.75, { to: S(.55), vel: .72, dec: 2.4 });
['D1', 'D2', 'A2', 'F#4', 'A4', 'D5'].forEach(n => keys(81.75, n, 2.4, .78, M(.55)));
['D3', 'A3', 'D4', 'F#4', 'A4', 'E5'].forEach((n, i) => I.strings(81.75, n, 1.9, { to: M(.55), vel: .66, a: .03, r: .8, cut: 3800, swell: [1.1, .6], pan: (i - 2.5) * .22 }));
voices(81.75, 1.7, ['D4', 'F#4', 'A4', 'D5'], { vel: .56, a: .06, r: .9, wet: .7, singers: 4 });
I.lead(81.75, 'D5', 1.3, { to: M(.55, .8, .2), vel: .72 });
[[82.4, 'A5'], [82.65, 'D6'], [82.9, 'E6'], [83.15, 'F#6'], [83.4, 'E6'], [83.65, 'D6']].forEach(([t, n], i) => I.musicBox(t, n, { to: M(.6, 1, .22), vel: .88 - i * .04, dec: 1.2 }));

// ---------------------------------------------------------------- 84.5 - 87.5 take your time
keys(84.86, 'D3', 2.2, .34, Po(.75)); keys(84.88, 'A4', 2.2, .36, Po(.75)); I.musicBox(84.9, 'F#5', { to: Po(.7), vel: .5, dec: 2 });
I.tick(86.0, { to: Po(.5), vel: .95, f: 1900 }); I.tick(87.0, { to: Po(.5), vel: .9, f: 1450 });
I.thud(86.38, { to: Po(.25), vel: .34, f: 66, lp: 240 }); I.thud(86.94, { to: Po(.25), vel: .22, f: 78, lp: 300 });
I.musicBox(86.9, 'D6', { to: Po(.8), vel: .52, dec: 1.4 });

// ---------------------------------------------------------------- mix
console.log('reverb and echo…');
const dl = echo(dly);
for (let i = 0; i < N; i++) { send.L[i] += dl.L[i] * .25; send.R[i] += dl.R[i] * .25; }
const hall = reverb(send, { rt: 2.9, damp: 5600, size: 1.0 });
const hall2 = reverb(psend, { rt: 2.6, damp: 5000, size: .94 });

// hard stops: a gate over everything that is allowed to be cut
const GATE = [[0, 1], [26.985, 1], [27.015, 0], [27.97, 0], [27.998, 1], [45.95, 1], [46.55, .16], [49.4, .16], [49.52, 1], [55.69, 1], [55.725, 0], [56.2, 0], [56.5, 1],
  [68.955, 1], [69.03, 0], [72.995, 0], [73.06, 1], [83.75, 1], [84.5, 0], [90, 0]];
// the quieter post bus also dies at the blink so the silence is complete
const PGATE = [[0, 1], [69.0, 1], [69.14, 0], [70.88, 0], [70.9, 1], [87.38, 1], [87.5, 0], [90, 0]];
const env = (K, t) => { for (let i = 1; i < K.length; i++) if (t < K[i][0]) return lerp(K[i - 1][1], K[i][1], (t - K[i - 1][0]) / (K[i][0] - K[i - 1][0])); return K[K.length - 1][1]; };
const L = new Float32Array(N), Rr = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const t = i / SR, g = env(GATE, t), p = env(PGATE, t);
  L[i] = g * (mus.L[i] + sfx.L[i] + dl.L[i] * .22 + hall.L[i] * .5) + p * (post.L[i] + hall2.L[i] * .46);
  Rr[i] = g * (mus.R[i] + sfx.R[i] + dl.R[i] * .22 + hall.R[i] * .5) + p * (post.R[i] + hall2.R[i] * .46);
}
// tone: clear the sub-rumble, add a little air
for (const ch of [L, Rr]) {
  const hp = biquad('hp', 30, .707), air = biquad('hishelf', 8200, .707, 2.6), mud = biquad('peak', 300, .8, -1.6);
  const sub = biquad('peak', 48, .8, -3.2), presence = biquad('peak', 3500, .6, 2.8);   // leaner low end, clearer on phones
  for (let i = 0; i < N; i++) ch[i] = air(presence(mud(sub(hp(ch[i])))));
}
// gentle bus compression holds the drop together without flattening the quiet
{
  const atk = Math.exp(-1 / (.012 * SR)), rel = Math.exp(-1 / (.22 * SR));
  let e = 0;
  const pre = lufs(L, Rr), norm = db(-17 - pre);
  for (let i = 0; i < N; i++) {
    L[i] *= norm; Rr[i] *= norm;
    const x = Math.max(Math.abs(L[i]), Math.abs(Rr[i]));
    e = x > e ? x + (e - x) * atk : x + (e - x) * rel;
    const over = 20 * Math.log10(e + 1e-9) - (-13);
    const gr = over > 0 ? db(-over * .42) : 1;
    L[i] *= gr; Rr[i] *= gr;
  }
}
// loudness: aim at -14 LUFS integrated with true peak under -1 dBTP
console.log('mastering…');
const TARGET = -14.0;
let gainDb = TARGET - lufs(L, Rr), outL, outR, got = 0, gr = 0;
for (let pass = 0; pass < 5; pass++) {
  outL = Float32Array.from(L); outR = Float32Array.from(Rr);
  const g = db(gainDb);
  for (let i = 0; i < N; i++) { outL[i] *= g; outR[i] *= g; }
  gr = limit(outL, outR, -1.7, 5, 80);
  got = lufs(outL, outR);
  console.log(`  pass ${pass + 1}: ${got.toFixed(2)} LUFS, deepest limiting ${gr.toFixed(1)} dB`);
  if (Math.abs(got - TARGET) < .08) break;
  gainDb += TARGET - got;
}
// the silence in the blink is digital silence
for (let i = Math.round(69.2 * SR); i < Math.round(70.86 * SR); i++) { outL[i] = 0; outR[i] = 0; }
for (let i = 0; i < 96; i++) { const k = i / 96; outL[i] *= k; outR[i] *= k; outL[N - 1 - i] *= k; outR[N - 1 - i] *= k; }
let sp = 0, tp = 0; const pk = truePeaks(outL, outR);
for (let i = 0; i < N; i++) { sp = Math.max(sp, Math.abs(outL[i]), Math.abs(outR[i])); tp = Math.max(tp, pk[i]); }
const sections = [[0, 2], [2, 5], [5, 15], [15, 21], [21, 27], [28, 40], [40, 46], [46, 52], [52, 59], [59, 63.5], [63.5, 69], [69, 73], [73, 80], [80, 84.5], [84.5, 87.5]];
const sec = sections.map(([a, b]) => `${a}-${b}: ${lufs(outL, outR, Math.round(a * SR), Math.round(b * SR)).toFixed(1)}`);
const out = process.argv[2] ?? path.join(root, 'soundtrack.wav');
fs.writeFileSync(out, wav24(outL, outR));
console.log('sections (LUFS):', sec.join('  |  '));
console.log(`integrated ${lufs(outL, outR).toFixed(2)} LUFS · true peak ${(20 * Math.log10(tp)).toFixed(2)} dBTP · sample peak ${(20 * Math.log10(sp)).toFixed(2)} dBFS`);
console.log(`wrote ${out}  ${(N / SR).toFixed(3)} s`);
