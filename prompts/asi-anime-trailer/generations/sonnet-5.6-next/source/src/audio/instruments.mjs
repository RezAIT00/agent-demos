// Instruments. Each function writes one note or one sound into the buses given
// in o.to = [[bus, gain], ...], starting at time t (seconds).
import { SR, N, TAU, rng, hz, writer, biquad, svf, onepole, saw, adsr, clamp, lerp } from './dsp.mjs';

let seedCounter = 1;
const nextSeed = () => (seedCounter = (seedCounter * 7919 + 13) % 2147483647);

// decaying sine by two-term recurrence (cheap enough for rich additive voices)
function partial(f, phase, tau) {
  const w = TAU * f / SR, c = 2 * Math.cos(w), k = Math.exp(-1 / (tau * SR));
  let y1 = Math.sin(phase - w), y2 = Math.sin(phase - 2 * w), env = 1;
  return () => { const y = c * y1 - y2; y2 = y1; y1 = y; env *= k; return y * env; };
}

// ---- keys ------------------------------------------------------------------
export function piano(t, note, len, o = {}) {
  const f = hz(note), vel = o.vel ?? .7, R = rng(nextSeed());
  const w = writer(o.to, o.pan ?? clamp((Math.log2(f / 330)) * .22, -.45, .45));
  const B = .00032 * Math.pow(f / 261, .6), base = clamp(3.4 * Math.pow(220 / f, .55), .5, 6.5);
  const parts = [];
  const nP = Math.min(16, Math.floor(9000 / f) + 1);
  for (let n = 1; n <= nP; n++) {
    const fn = n * f * Math.sqrt(1 + B * n * n);
    if (fn > SR * .45) break;
    const hammer = Math.abs(Math.sin(Math.PI * n * .121)) + .18;
    const amp = hammer / Math.pow(n, 1.55 - vel * .55);
    const tau = base / (1 + (n - 1) * .42);
    for (const det of [-1, 1]) {
      const fd = fn * (1 + det * .00035 * (1 + R() * .5));
      parts.push({ slow: partial(fd, R() * .4, tau), fast: partial(fd, R() * .4, tau * .16), a: amp * .5 });
    }
  }
  const start = Math.round(t * SR), hold = len, rel = o.rel ?? .22, total = Math.round((hold + rel * 4) * SR);
  const nz = biquad('bp', clamp(f * 5, 800, 5200), .9);
  const gain = .2 * vel;
  for (let i = 0; i < total; i++) {
    const tt = i / SR;
    let v = 0;
    for (const p of parts) v += p.a * (p.slow() * .55 + p.fast() * .45);
    if (tt < .03) v += nz(R.bi()) * Math.exp(-tt * 190) * 1.2 * vel;
    const att = Math.min(1, tt / .0035);
    const damp = tt > hold ? Math.exp(-(tt - hold) / rel * 2.4) : 1;
    w(start + i, v * att * damp * gain);
  }
}
export function musicBox(t, note, o = {}) {
  const f = hz(note), R = rng(nextSeed()), w = writer(o.to, o.pan ?? R.range(-.28, .28));
  const dec = o.dec ?? 1.5;
  const parts = [[1, 1, dec], [2.01, .16, dec * .55], [3.02, .1, dec * .3], [5.43, .22, dec * .14], [8.93, .09, dec * .07]]
    .filter(p => p[0] * f < SR * .45).map(([r, a, d]) => ({ o: partial(f * r * (1 + R.bi() * .0012), R() * 6, d), a }));
  const start = Math.round(t * SR), gain = .16 * (o.vel ?? .8);
  for (let i = 0; i < dec * 3.4 * SR; i++) {
    let v = 0; for (const p of parts) v += p.o() * p.a;
    const tt = i / SR;
    if (tt < .006) v += R.bi() * (1 - tt / .006) * .35;
    w(start + i, v * Math.min(1, tt / .0015) * gain);
  }
}
// glassy bell, used for the raindrop names
export function glass(t, note, o = {}) {
  const f = hz(note), R = rng(nextSeed()), w = writer(o.to, o.pan ?? 0);
  const dec = o.dec ?? .8;
  const parts = [[1, 1, dec], [2.756, .34, dec * .4], [5.404, .14, dec * .18], [1.003, .5, dec * 1.1]]
    .filter(p => p[0] * f < SR * .45).map(([r, a, d]) => ({ o: partial(f * r, R() * 6, d), a }));
  const start = Math.round(t * SR), gain = .1 * (o.vel ?? .8);
  for (let i = 0; i < dec * 3.2 * SR; i++) { let v = 0; for (const p of parts) v += p.o() * p.a; w(start + i, v * Math.min(1, i / 90) * gain); }
}

// ---- bowed and blown --------------------------------------------------------
export function strings(t, note, len, o = {}) {
  const f = hz(note), R = rng(nextSeed());
  const a = o.a ?? .35, r = o.r ?? .6, gain = .062 * (o.vel ?? .7), cut = o.cut ?? 2600;
  const voices = [-9, -4, 0, 5, 10].map((c, i) => ({ osc: saw(R()), det: Math.pow(2, (c + R.bi() * 2) / 1200), vr: 4.6 + R() * 1.6, vp: R() * TAU, pan: (i - 2) * .28 }));
  const start = Math.round(t * SR), total = Math.round((len + r) * SR);
  for (const side of [0, 1]) {
    const mine = voices.filter((_, i) => i % 2 === side || i === 2);
    const w = writer(o.to, clamp((o.pan ?? 0) + (side ? .38 : -.38), -1, 1));
    const lp = svf(), hp = onepole(120);
    for (let i = 0; i < total; i++) {
      const tt = i / SR, vib = clamp((tt - .25) / .5);
      let v = 0;
      for (const vo of mine) v += vo.osc(f * vo.det * (1 + Math.sin(TAU * vo.vr * tt + vo.vp) * .0042 * vib));
      const env = adsr(tt, len, a, .3, .85, r);
      const swell = o.swell ? lerp(o.swell[0], o.swell[1], clamp(tt / len)) : 1;
      const y = lp(v, cut * (.55 + .45 * env) * (o.swell ? .6 + .4 * swell : 1), .62).lp;
      w(start + i, (y - hp(y)) * env * swell * gain);
    }
  }
}
// short bowed notes for the ostinato
export function stab(t, note, len, o = {}) {
  strings(t, note, len, { ...o, a: .008, r: o.r ?? .07, cut: o.cut ?? 3200, vel: o.vel ?? .7 });
}
export function lead(t, note, len, o = {}) {
  const f = hz(note), R = rng(nextSeed()), w = writer(o.to, o.pan ?? 0);
  const from = o.from ? hz(o.from) : f;
  const o1 = saw(R()), o2 = saw(R()), o3 = saw(R()), lp = svf();
  const start = Math.round(t * SR), rel = .22, gain = .085 * (o.vel ?? .8);
  let ph = 0;
  for (let i = 0; i < (len + rel) * SR; i++) {
    const tt = i / SR;
    const glide = from * Math.pow(f / from, clamp(tt / .07));
    const vib = 1 + Math.sin(TAU * 5.6 * tt) * .0062 * clamp((tt - .22) / .3);
    const fr = glide * vib;
    ph += TAU * fr * 2 / SR;
    const v = o1(fr * 1.0035) + o2(fr * .9965) + o3(fr * .5) * .45;
    const env = adsr(tt, len, .018, .25, .78, rel);
    const y = lp(v, 900 + 4200 * (.45 + .55 * Math.exp(-tt * 2.2)), .8).lp;
    w(start + i, (y + Math.sin(ph) * .42) * env * gain);
  }
}
export function bass(t, note, len, o = {}) {
  const f = hz(note), w = writer(o.to, 0), s1 = saw(.1), lp = svf();
  const start = Math.round(t * SR), gain = .2 * (o.vel ?? .8);
  let ph = 0;
  for (let i = 0; i < (len + .08) * SR; i++) {
    const tt = i / SR; ph += TAU * f / SR;
    const env = adsr(tt, len, .005, .12, .7, .08);
    const y = lp(s1(f), 180 + 900 * Math.exp(-tt * 14), 1.1).lp;
    w(start + i, Math.tanh((Math.sin(ph) * 1.1 + y * .55) * 1.35) * env * gain);
  }
}

// ---- voices: formant synthesis, no words ------------------------------------
const VOWELS = {
  ah: { f: [800, 1150, 2900, 3900, 4950], g: [0, -5, -24, -22, -38], bw: [90, 100, 130, 150, 180] },
  oh: { f: [450, 800, 2830, 3500, 4950], g: [0, -9, -26, -26, -42], bw: [80, 90, 120, 140, 160] },
  oo: { f: [340, 720, 2700, 3500, 4950], g: [0, -14, -34, -34, -48], bw: [70, 80, 120, 140, 160] },
  eh: { f: [550, 1700, 2650, 3600, 4950], g: [0, -10, -20, -26, -40], bw: [80, 100, 130, 150, 180] },
  ee: { f: [330, 2300, 3000, 3700, 4950], g: [0, -15, -20, -28, -42], bw: [70, 110, 140, 150, 180] },
};
export function choir(t, note, len, o = {}) {
  const f = hz(note), a = o.a ?? .5, r = o.r ?? .8, V = VOWELS[o.vowel ?? 'ah'], V2 = VOWELS[o.to2 ?? o.vowel ?? 'ah'];
  const singers = o.singers ?? 4, gain = .2 * (o.vel ?? .6) / Math.sqrt(singers);
  for (let s = 0; s < singers; s++) {
    const R = rng(nextSeed()), w = writer(o.to, clamp((o.pan ?? 0) + (s / Math.max(1, singers - 1) - .5) * (o.width ?? 1.2), -1, 1));
    const src = saw(R()), det = Math.pow(2, R.bi() * 9 / 1200), vr = 4.9 + R() * 1.3, vp = R() * TAU, drift = R() * TAU;
    const tilt = onepole(1700), breath = biquad('bp', 2400, .5);
    const bands = V.f.map(() => svf());
    const shift = 1 + R.bi() * .035;
    const start = Math.round((t + R() * .05) * SR);
    for (let i = 0; i < (len + r) * SR; i++) {
      const tt = i / SR;
      const vib = 1 + Math.sin(TAU * vr * tt + vp) * .008 * clamp((tt - .2) / .5) + Math.sin(TAU * .7 * tt + drift) * .0025;
      let x = tilt(src(f * det * vib)) * 1.7 + breath(R.bi()) * (o.breath ?? .06);
      const m = clamp(tt / len);
      let y = 0;
      for (let k = 0; k < 5; k++) {
        const fc = lerp(V.f[k], V2.f[k], m) * shift, bw = lerp(V.bw[k], V2.bw[k], m), q = fc / bw;
        y += bands[k](x, fc, q).bp / q * Math.pow(10, lerp(V.g[k], V2.g[k], m) / 20) * 6;
      }
      const env = adsr(tt, len, a, .4, .9, r);
      const swell = o.swell ? lerp(o.swell[0], o.swell[1], m) : 1;
      w(start + i, y * env * env * swell * gain);
    }
  }
}

// ---- drums -------------------------------------------------------------------
export function kick(t, o = {}) {
  const w = writer(o.to, 0), start = Math.round(t * SR), g = .75 * (o.vel ?? 1), R = rng(nextSeed());
  let ph = 0;
  for (let i = 0; i < .45 * SR; i++) {
    const tt = i / SR, f = 46 + 130 * Math.exp(-tt * 32); ph += TAU * f / SR;
    const click = tt < .004 ? R.bi() * .35 * (1 - tt / .004) : 0;
    w(start + i, Math.tanh((Math.sin(ph) * Math.exp(-tt * 8.5) + click) * 1.6) * g * Math.min(1, tt / .001));
  }
}
export function snare(t, o = {}) {
  const w = writer(o.to, o.pan ?? .04), start = Math.round(t * SR), g = .3 * (o.vel ?? 1), R = rng(nextSeed());
  const bp = biquad('bp', 2600, .55), hp = biquad('hp', 1200);
  let ph = 0;
  for (let i = 0; i < .4 * SR; i++) {
    const tt = i / SR; ph += TAU * (188 + 60 * Math.exp(-tt * 40)) / SR;
    const nz = R.bi();
    w(start + i, ((bp(nz) * 1.5 + hp(nz) * .45) * Math.exp(-tt * 17) + Math.sin(ph) * Math.exp(-tt * 24) * .8) * g);
  }
}
export function hat(t, o = {}) {
  const w = writer(o.to, o.pan ?? .25), start = Math.round(t * SR), g = .12 * (o.vel ?? 1), R = rng(nextSeed());
  const hp = biquad('hp', 7600, .9), pk = biquad('peak', 10500, 2, 5), dec = o.open ? 9 : 70;
  for (let i = 0; i < (o.open ? .4 : .07) * SR; i++) { const tt = i / SR; w(start + i, pk(hp(R.bi())) * Math.exp(-tt * dec) * g); }
}
export function taiko(t, o = {}) {
  const w = writer(o.to, o.pan ?? 0), start = Math.round(t * SR), g = .62 * (o.vel ?? 1), R = rng(nextSeed()), f0 = o.f ?? 62;
  const lp = biquad('lp', 420, .8);
  let p1 = 0, p2 = 0;
  for (let i = 0; i < 1.3 * SR; i++) {
    const tt = i / SR, bend = 1 + .55 * Math.exp(-tt * 28);
    p1 += TAU * f0 * bend / SR; p2 += TAU * f0 * 1.59 * bend / SR;
    const v = Math.sin(p1) * Math.exp(-tt * 3.8) + Math.sin(p2) * .42 * Math.exp(-tt * 7) + lp(R.bi()) * Math.exp(-tt * 22) * 1.7;
    w(start + i, Math.tanh(v * 1.2) * g * Math.min(1, tt / .002));
  }
}
const CYM = [205.3, 304.4, 369.6, 522.7, 540, 800];
export function crash(t, o = {}) {
  const dec = o.dec ?? 1.9;
  for (const side of [-1, 1]) {
    const w = writer(o.to, side * .5), start = Math.round(t * SR), g = .15 * (o.vel ?? 1), R = rng(nextSeed());
    const hp = biquad('hp', o.hp ?? 3600, .7), hp2 = biquad('hp', 5200, .7);
    const ph = CYM.map(() => R());
    for (let i = 0; i < dec * 2.6 * SR; i++) {
      const tt = i / SR;
      let m = 0;
      for (let k = 0; k < 6; k++) { ph[k] += CYM[k] * 2.37 * (side > 0 ? 1.013 : 1) / SR; m += (ph[k] % 1) < .5 ? 1 : -1; }
      const v = hp(R.bi() * 1.25 + m * .2);
      w(start + i, hp2(v) * Math.exp(-tt / dec * 2.2) * g * Math.min(1, tt / .002) * (1 + .5 * Math.exp(-tt * 30)));
    }
  }
}
// a cymbal that swells backwards into time t
export function swell(t, len, o = {}) {
  for (const side of [-1, 1]) {
    const w = writer(o.to, side * .55), end = Math.round(t * SR), n = Math.round(len * SR), g = .13 * (o.vel ?? 1), R = rng(nextSeed());
    const lp = svf(), hp = biquad('hp', 900);
    for (let i = 0; i < n; i++) {
      const p = i / n;
      w(end - n + i, lp(hp(R.bi()), 900 + 9000 * p * p, .8).lp * Math.pow(p, 2.6) * g * (1 - Math.max(0, (p - .985) / .015)));
    }
  }
}

// ---- hits, risers, air --------------------------------------------------------
export function boom(t, o = {}) {
  const w = writer(o.to, 0), start = Math.round(t * SR), g = .72 * (o.vel ?? 1), R = rng(nextSeed()), dec = o.dec ?? 1.7;
  const lp = biquad('lp', 190, .7), lp2 = biquad('lp', 2400, .6);
  let ph = 0;
  for (let i = 0; i < dec * 2.4 * SR; i++) {
    const tt = i / SR, f = 31 + 62 * Math.exp(-tt * 6.5); ph += TAU * f / SR;
    const nz = R.bi();
    const v = Math.sin(ph) * Math.exp(-tt / dec * 1.7) + lp(nz) * 2.6 * Math.exp(-tt * 5) + lp2(nz) * .5 * Math.exp(-tt * 38);
    w(start + i, Math.tanh(v * 1.5) * g * Math.min(1, tt / .0025));
  }
}
// low brass blare under the impacts
export function braam(t, note, len, o = {}) {
  const f = hz(note), R = rng(nextSeed()), g = .15 * (o.vel ?? 1);
  for (const side of [-1, 1]) {
    const w = writer(o.to, side * .45), start = Math.round(t * SR);
    const os = [1, 1.0072, .993, 1.5, 2.004].map(m => ({ s: saw(R()), m }));
    const lp = svf(), peak = biquad('peak', 700, .9, 4);
    for (let i = 0; i < (len + .8) * SR; i++) {
      const tt = i / SR;
      let v = 0; for (const x of os) v += x.s(f * x.m * (side > 0 ? 1.0025 : 1));
      const env = adsr(tt, len, .025, .5, .62, .8);
      const y = lp(v, 160 + 1900 * Math.exp(-tt * 2.1) + 200, 1.15).lp;
      w(start + i, Math.tanh(peak(y) * .95) * env * g);
    }
  }
}
export function riser(t, len, o = {}) {
  const R = rng(nextSeed()), g = .12 * (o.vel ?? 1), start = Math.round(t * SR), n = Math.round(len * SR);
  for (const side of [-1, 1]) {
    const w = writer(o.to, side * .7), bp = svf(), s1 = saw(R()), s2 = saw(R()), lp = svf();
    for (let i = 0; i < n; i++) {
      const p = i / n, f = (o.f0 ?? 110) * Math.pow(o.span ?? 6, p * p) * (side > 0 ? 1.008 : 1);
      const air = bp(R.bi(), 300 * Math.pow(26, p), 2.4).bp * .85;
      const tone = lp(s1(f) + s2(f * 1.5), 500 + 4200 * p, .9).lp * .22;
      const end = 1 - clamp((p - .992) / .008);
      w(start + i, (air + tone) * Math.pow(p, 2.1) * g * end);
    }
  }
}
export function whoosh(t, len, o = {}) {
  const R = rng(nextSeed()), g = .22 * (o.vel ?? 1), start = Math.round(t * SR), n = Math.round(len * SR);
  const dir = o.dir ?? 1, bp = svf(), peakAt = o.peak ?? .6;
  for (let i = 0; i < n; i++) {
    const p = i / n, e = p < peakAt ? Math.pow(p / peakAt, 2) : Math.pow(1 - (p - peakAt) / (1 - peakAt), 2.2);
    const v = bp(R.bi(), (o.f0 ?? 350) + (o.f1 ?? 2600) * e, 1.5).bp * e * g;
    const pan = dir * (p * 2 - 1) * .8, a = (pan + 1) * Math.PI / 4;
    for (const [bus, gn] of o.to) { const j = start + i; if (j >= 0 && j < N) { bus.L[j] += v * Math.cos(a) * 1.41 * gn; bus.R[j] += v * Math.sin(a) * 1.41 * gn; } }
  }
}
export function thud(t, o = {}) {
  const w = writer(o.to, o.pan ?? 0), start = Math.round(t * SR), g = .4 * (o.vel ?? 1), R = rng(nextSeed()), lp = biquad('lp', o.lp ?? 380, .9);
  let ph = 0;
  for (let i = 0; i < .5 * SR; i++) {
    const tt = i / SR; ph += TAU * ((o.f ?? 58) + 50 * Math.exp(-tt * 30)) / SR;
    w(start + i, (Math.sin(ph) * Math.exp(-tt * 12) + lp(R.bi()) * Math.exp(-tt * 40) * 1.2) * g * Math.min(1, tt / .003));
  }
}
export function heartbeat(t, o = {}) {
  thud(t, { ...o, f: 50, lp: 150, vel: (o.vel ?? 1) });
  thud(t + .24, { ...o, f: 44, lp: 130, vel: (o.vel ?? 1) * .62 });
}
export function tick(t, o = {}) {
  const w = writer(o.to, o.pan ?? 0), start = Math.round(t * SR), g = .16 * (o.vel ?? 1), R = rng(nextSeed());
  const f = o.f ?? 2300, bp = biquad('bp', f * 1.35, 3.2);
  let ph = 0;
  for (let i = 0; i < .05 * SR; i++) {
    const tt = i / SR; ph += TAU * f / SR;
    w(start + i, (Math.sin(ph) * Math.exp(-tt * 210) * .7 + bp(R.bi()) * Math.exp(-tt * 520) * 2.2) * g);
  }
}
// a drop of water: the pitch of a closing bubble rises as it rings
export function plip(t, o = {}) {
  const w = writer(o.to, o.pan ?? 0), start = Math.round(t * SR), g = .3 * (o.vel ?? 1), f0 = o.f ?? 720;
  let ph = 0;
  for (let i = 0; i < .2 * SR; i++) {
    const tt = i / SR, f = f0 * (1 + 1.5 * (1 - Math.exp(-tt * 34))); ph += TAU * f / SR;
    w(start + i, Math.sin(ph) * Math.exp(-tt * 27) * Math.min(1, tt / .0015) * g);
  }
}
export function shatter(t, o = {}) {
  const R = rng(nextSeed());
  for (let k = 0; k < 40; k++) {
    const dt = Math.pow(R(), 2.2) * .5;
    glass(t + dt, R.range(1900, 6800), { to: o.to, vel: R.range(.25, .9) * (1 - dt), pan: R.bi() * .8, dec: R.range(.06, .3) });
  }
  const w = writer(o.to, 0), start = Math.round(t * SR), hp = biquad('hp', 2800);
  for (let i = 0; i < .2 * SR; i++) w(start + i, hp(R.bi()) * Math.exp(-i / SR * 26) * .22);
}
export function breath(t, len, o = {}) {
  const w = writer(o.to, o.pan ?? 0), start = Math.round(t * SR), R = rng(nextSeed()), g = .1 * (o.vel ?? 1);
  const a = biquad('bp', 1150, 1.2), b = biquad('bp', 2700, 1.6), n = Math.round(len * SR);
  for (let i = 0; i < n; i++) { const p = i / n, v = R.bi(); w(start + i, (a(v) + b(v) * .55) * Math.pow(Math.sin(Math.PI * Math.pow(p, .8)), 2) * g); }
}
// soft bristle drag for each brush stroke of the title
export function brush(t, len, o = {}) {
  const w = writer(o.to, o.pan ?? 0), start = Math.round(t * SR), R = rng(nextSeed()), g = .09 * (o.vel ?? 1);
  const bp = svf(), n = Math.round(len * SR);
  for (let i = 0; i < n; i++) { const p = i / n; w(start + i, bp(R.bi(), 1500 + 2400 * p, 1.1).bp * Math.sin(Math.PI * p) * (.7 + .3 * R()) * g); }
}
export function drone(t, note, len, o = {}) {
  const f = hz(note), w = writer(o.to, o.pan ?? 0), start = Math.round(t * SR), g = .09 * (o.vel ?? 1);
  let p1 = 0, p2 = 0, p3 = 0;
  const a = o.a ?? .6, r = o.r ?? .6;
  for (let i = 0; i < (len + r) * SR; i++) {
    const tt = i / SR; p1 += TAU * f / SR; p2 += TAU * f * (o.ratio ?? 1.0045) / SR; p3 += TAU * f * 2.001 / SR;
    w(start + i, (Math.sin(p1) + Math.sin(p2) + Math.sin(p3) * .18) * adsr(tt, len, a, .2, 1, r) * g * .5);
  }
}
