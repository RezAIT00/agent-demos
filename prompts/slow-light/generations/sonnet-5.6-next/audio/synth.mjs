// Slow Light, the soundtrack. Pure procedural synthesis, seeded, no samples.
//   node audio/synth.mjs            ->  audio/slow-light.wav  (48 kHz stereo 24-bit, 20.000 s) + audio/cue-sheet.json
//
// Two rules, both from the film's own physics:
//   STREET sounds (switch, hum, gas, neon transformer, drips, moths) travel at 343 m/s from where they happen:
//        heard at  t = t_event + distance(source, camera) / 343        -> almost at once, long before you SEE it
//   LIGHT sounds (the score) voice what is on screen, which travels at 5 m/s:
//        they start on the first video frame that shows the event, and follow the measured lit region.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const K = JSON.parse(fs.readFileSync(path.join(dir, 'cues.json'), 'utf8'));
const STEMS = process.argv.includes('--stems');
const NO_DRIPS = process.argv.includes('--no-drips');     // diagnostic only: writes to _work/ and leaves the real mix alone
const SR = 48000, FPS = 30, N = Math.round(K.duration * SR);
const V_SOUND = 343, C_LIGHT = K.cLight, TAU = Math.PI * 2;

// ───────────── small maths ─────────────
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const s01 = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const db = d => Math.pow(10, d / 20);
const add3 = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function rngFor(name) { // an independent, named, seeded stream for every sound
  let h = 2166136261; for (const ch of 'slow-light/' + name) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  f.range = (lo, hi) => lo + (hi - lo) * f(); f.bi = () => f() * 2 - 1;
  return f;
}

// ───────────── filters ─────────────
class Biquad {
  constructor(type, f, q = 0.7071) { this.type = type; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f, q); }
  set(f, q = this.q) {
    this.q = q; const w = TAU * clamp(f, 10, SR * 0.45) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q); let b0, b1, b2;
    if (this.type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (this.type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
    const a0 = 1 + al; this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = -2 * c / a0; this.a2 = (1 - al) / a0; return this;
  }
  run(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}
const onePole = fc => { let y = 0; const a = 1 - Math.exp(-TAU * fc / SR); return x => (y += a * (x - y)); };

// ───────────── the film: camera, projection, light timing ─────────────
const CAM = K.camera;
function camAt(t) {
  const i = clamp((t - CAM[0][0]) * 100, 0, CAM.length - 1.001), k = i | 0, f = i - k, a = CAM[k], b = CAM[k + 1];
  const v = j => lerp(a[j], b[j], f);
  const pos = [v(1), v(2), v(3)], fwd = unit(sub3([v(4), v(5), v(6)], pos)), right = unit(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
  return { pos, fwd, right, up };
}
const TAN = Math.tan(31 * Math.PI / 180);
function screenX(p, t) { const c = camAt(t), v = sub3(p, c.pos), z = Math.max(0.5, dot(v, c.fwd)); return clamp(dot(v, c.right) / (z * TAN), -1.4, 1.4); }
// when does something that happened at time e, at point p, reach the camera at speed v?
function arrival(e, p, v) { let t = e; for (let i = 0; i < 40; i++) t = e + len(sub3(p, camAt(t).pos)) / v; return t; }
// first video frame whose shutter (t +- 1/120 s) contains the change
const firstFrame = tSeen => Math.ceil((tSeen - 1 / 120) * FPS - 1e-6);
const frameTime = f => f / FPS;

const LAMP = Object.fromEntries(K.lamps.map(l => [l.name, l]));
const PT = K.points;
const mirrorImage = p => add3(p, PT.mirrorNormal, -2 * dot(sub3(p, PT.mirror), PT.mirrorNormal));
const cafe = K.walls.find(w => w.name === 'cafe');
const wallPoint = (w, u, v, d) => add3(add3(add3(w.o, w.U, u), [0, 1, 0], v), w.N, d);
const neonTubePts = []; for (const a of [-0.29, -0.15, 0, 0.15, 0.265]) for (const b of [-0.30, -0.1, 0.06, 0.24]) neonTubePts.push(wallPoint(cafe, 0.505, 3.36 + b, 0.58 + a));
const nearestTube = t => neonTubePts.reduce((best, p) => len(sub3(p, camAt(t).pos)) < len(sub3(best, camAt(t).pos)) ? p : best);

// seen times (light at 5 m/s) and heard times (sound at 343 m/s)
const SEEN = {
  bulbOn: arrival(LAMP.bulb.on, PT.bulb, C_LIGHT), bulbOff: arrival(LAMP.bulb.off, PT.bulb, C_LIGHT),
  mirrorOn: arrival(LAMP.bulb.on, mirrorImage(PT.bulb), C_LIGHT), mirrorOff: arrival(LAMP.bulb.off, mirrorImage(PT.bulb), C_LIGHT),
  lanternOn: arrival(LAMP.lantern.on, PT.lantern, C_LIGHT), lanternOff: arrival(LAMP.lantern.off, PT.lantern, C_LIGHT),
  neonFirst: arrival(LAMP.neon.on, nearestTube(10.9), C_LIGHT), neonCentre: arrival(LAMP.neon.on, PT.neonSign, C_LIGHT),
  neonOff: arrival(LAMP.neon.off, PT.neonSign, C_LIGHT),
};
// The picture has the last word: frames measured from the pixels of slow-light.mp4 (measure_picture.py).
// The physics prediction must agree to within one frame, or something is wrong.
const FR_PHYSICS = Object.fromEntries(Object.entries(SEEN).map(([k, t]) => [k, firstFrame(t)]));
const PICTURE = JSON.parse(fs.readFileSync(path.join(dir, 'picture-events.json'), 'utf8')).events;
for (const [k, f] of Object.entries(PICTURE)) if (Math.abs(f - FR_PHYSICS[k]) > 1) throw new Error(`${k}: picture frame ${f}, physics frame ${FR_PHYSICS[k]}`);
const FR = { ...FR_PHYSICS, ...PICTURE };

const stutter = a => { const { edge, depth, gaps } = K.neonStutter; let g = 0; for (const [x0, x1] of gaps) g += s01((a - x0) / edge) * (1 - s01((a - x1) / edge)); return 1 - depth * g; };

// per-frame measurements from the film, read at any time
function curve(arr) { return t => { const x = clamp(t * FPS, 0, arr.length - 1.001), i = x | 0; return lerp(arr[i], arr[i + 1], x - i); }; }
const REG = Object.fromEntries(Object.entries(K.region).map(([n, r]) => [n, Object.fromEntries(Object.entries(r).map(([k, a]) => [k, curve(a)]))]));
const LUM = Object.fromEntries(Object.entries(K.curves).map(([n, c]) => { const mx = Math.max(...c.lum); return [n, curve(c.lum.map(v => v / mx))]; }));
// how much of a lamp's light is on screen: lit share of the scene, faded where what is left is very dim
function lightOnScreen(name, t) {
  const onT = frameTime(name === 'bulb' ? FR.bulbOn : name === 'lantern' ? FR.lanternOn : FR.neonFirst);
  if (t < onT) return 0;
  const F = REG[name].frac(t), L = LUM[name](t);
  return Math.pow(F, 0.92) * Math.pow(clamp(L * 5, 0, 1), 0.35);
}

// ───────────── buses ─────────────
const bus = () => [new Float64Array(N), new Float64Array(N)];
const AMB = bus(), STREET = bus(), SCORE = bus(), VERB = bus(), MOTHS = bus();
const cues = [];
const cue = (o) => cues.push(o);

// place a mono sound at a stereo pan, with interaural delay and head shadow
function place(out, sig, t0, gain, pan, { send = 0, itd = true, lpHz = 0 } = {}) {
  pan = clamp(pan, -1, 1);
  const th = (pan * 0.92 + 1) * Math.PI / 4, g = [Math.cos(th) * gain, Math.sin(th) * gain];
  const start = t0 * SR;
  let air = null; if (lpHz) air = onePole(lpHz);
  const src = air ? sig.map(x => air(x)) : sig;
  for (let ch = 0; ch < 2; ch++) {
    const far = (ch === 0 && pan > 0) || (ch === 1 && pan < 0);
    const delay = itd && far ? Math.abs(pan) * 0.00058 * SR : 0;
    const shade = far ? onePole(lerp(20000, 4200, Math.abs(pan))) : null;
    const s0 = Math.floor(start + delay), frac = start + delay - s0;
    for (let i = 0; i <= src.length + 64; i++) {
      const n = s0 + i; if (n < 0 || n >= N) continue;
      let v = (i < src.length ? src[i] : 0) * (1 - frac) + (i > 0 && i <= src.length ? src[i - 1] : 0) * frac;
      if (shade) v = shade(v);
      out[ch][n] += v * g[ch];
      if (send) VERB[ch][n] += v * g[ch] * send;
    }
  }
}
const panOfDirection = (p, t) => { const c = camAt(t), v = unit(sub3(p, c.pos)); return clamp(dot(v, c.right) * 1.25, -0.95, 0.95); };
const REF_DIST = 8.0;
// A sound made somewhere in the street: direct path plus one bounce off each wall that can see both ends, and the wet ground.
function streetEvent(sig, tEvent, pos, gain, { send = 0.16, reflect = true } = {}) {
  const tH = arrival(tEvent, pos, V_SOUND), C = camAt(tH).pos, d = len(sub3(pos, C));
  place(STREET, sig, tH, gain * REF_DIST / Math.max(d, 2.0), panOfDirection(pos, tH), { send });
  if (!reflect) return tH;
  const planes = [...K.walls.map(w => ({ ...w, k: 0.46 })), { name: 'ground', o: [0, 0, 0], N: [0, 1, 0], U: null, k: 0.30 }];
  for (const w of planes) {
    const ds = dot(sub3(pos, w.o), w.N), dc = dot(sub3(C, w.o), w.N);
    if (ds < 0.03 || dc < 0.03) continue;
    const image = add3(pos, w.N, -2 * ds);
    const seg = sub3(image, C), s = -dc / dot(seg, w.N), X = add3(C, seg, s);
    if (w.U) { const u = dot(sub3(X, w.o), w.U); if (u < 0 || u > w.len || X[1] < 0 || X[1] > w.h) continue; }
    else if (X[0] < -4.5 || X[0] > 5 || X[2] > 3.5 || X[2] < -19) continue;
    const dr = len(seg), tr = tEvent + dr / V_SOUND;
    if (dr - d < 0.05) continue;
    place(STREET, sig, tr, gain * w.k * REF_DIST / Math.max(dr, 2.0), panOfDirection(image, tr), { send: send * 0.6, lpHz: 6500 });
  }
  return tH;
}

// ───────────── instruments ─────────────
const samples = s => new Float64Array(Math.ceil(s * SR));
const norm = sig => { let m = 0; for (const x of sig) m = Math.max(m, Math.abs(x)); if (m) for (let i = 0; i < sig.length; i++) sig[i] /= m; return sig; };
function ping(sig, at, hz, amp, tau, phase = 0, attack = 0.00012) {
  const i0 = Math.round(at * SR);
  for (let i = i0; i < sig.length; i++) { const t = (i - i0) / SR; const e = Math.exp(-t / tau) * Math.min(1, t / attack); if (t > tau * 9) break; sig[i] += amp * e * Math.sin(TAU * hz * t + phase); }
}
function burst(sig, rng, at, amp, tau, type, hz, q = 0.9) {
  const f = new Biquad(type, hz, q), i0 = Math.round(at * SR);
  for (let i = i0; i < sig.length; i++) { const t = (i - i0) / SR; if (t > tau * 10) break; sig[i] += f.run(rng.bi()) * amp * Math.exp(-t / tau); }
}

function switchClick(off) { // an old bakelite toggle: lever snap, contact bounce, the hollow body
  const rng = rngFor(off ? 'click-off' : 'click-on'), s = samples(0.16), p = off ? 0.90 : 1.0;
  burst(s, rng, 0, 1.5, 0.00045, 'hp', 1900); ping(s, 0, 2650 * p, 0.75, 0.0055, 1.2); ping(s, 0, 4150 * p, 0.32, 0.0028, 0.4); ping(s, 0, 1190 * p, 0.55, 0.0095, 0.9); ping(s, 0, 236 * p, 0.62, 0.020, 1.35); ping(s, 0, 610 * p, 0.3, 0.012, 1.0);
  const b = off ? 0.0115 : 0.0078; burst(s, rng, b, 0.7, 0.00035, 'hp', 2500); ping(s, b, 3350 * p, 0.38, 0.0038, 1.1); ping(s, b, 880 * p, 0.2, 0.007, 0.8);
  return norm(s);
}
function tick(rng, hz, tau = 0.004) { const s = samples(0.05); burst(s, rng, 0, 0.9, 0.0004, 'hp', 2200); ping(s, 0, hz, 0.5, tau, 1.1); return norm(s); }

function gasIgnite() { // a soft "fwup" in an old glass lantern
  const rng = rngFor('gas-on'), s = samples(0.5), lp = new Biquad('lp', 400, 0.9);
  for (let i = 0; i < s.length; i++) { const t = i / SR; if (!(i % 32)) lp.set(350 + 1700 * Math.exp(-Math.pow((t - 0.035) / 0.05, 2))); s[i] = lp.run(rng.bi()) * Math.min(1, t / 0.006) * Math.exp(-t / 0.095) * 1.6; }
  ping(s, 0.004, 3140, 0.22, 0.055); ping(s, 0.004, 4715, 0.12, 0.04); ping(s, 0.004, 1385, 0.1, 0.05);
  return norm(s);
}
function gasPuff() {
  const rng = rngFor('gas-off'), s = samples(0.5), lp = new Biquad('lp', 900, 0.8);
  for (let i = 0; i < s.length; i++) { const t = i / SR; if (!(i % 32)) lp.set(180 + 1100 * Math.exp(-t / 0.07)); s[i] = lp.run(rng.bi()) * Math.min(1, t / 0.004) * Math.exp(-t / 0.085); }
  ping(s, 0.001, 2350, 0.34, 0.032); ping(s, 0.001, 3720, 0.16, 0.022);
  return norm(s);
}
function neonRelay() { const rng = rngFor('relay'), s = samples(0.14); burst(s, rng, 0, 1.0, 0.0007, 'hp', 1200); ping(s, 0, 142, 0.9, 0.026, 1.4); ping(s, 0, 1880, 0.45, 0.006, 1.0); ping(s, 0, 760, 0.3, 0.01, 1.2); return norm(s); }
// The transformer's buzz, gated by the very stutter pattern the shader uses to light the tubes.
function neonBuzz(duration) {
  const rng = rngFor('neon-buzz'), s = samples(duration + 0.03);
  const H = []; for (let h = 1; h <= 44; h++) H.push({ f: 100 * h, a: Math.pow(h, -0.62) * (h % 2 ? 1 : 0.72), p: rng() * TAU });
  const hp = new Biquad('hp', 520, 0.7), lp = new Biquad('lp', 4300, 0.7), crk = new Biquad('bp', 3600, 0.8);
  const gaps = K.neonStutter.gaps;
  for (let i = 0; i < s.length; i++) {
    const a = i / SR;
    let v = 0; for (const h of H) v += h.a * Math.sin(TAU * h.f * a + h.p);
    v = Math.tanh(v * 0.9);
    const gate = stutter(a);
    const rate = a < 0.6 ? 130 : 0;   // the tube crackles only while it is striking
    const crackle = crk.run(rng() < rate / SR ? rng.bi() * 14 : 0);
    // loud while striking, then it settles into a thin hum
    const settle = lerp(1.0, 0.42, s01((a - 0.55) / 0.75));
    const gone = 1 - s01((a - duration) / 0.006);
    s[i] = lp.run(hp.run(v)) * gate * settle * Math.min(1, a / 0.004) * gone * 0.8 + crackle * gate * settle * gone * 0.5;
  }
  for (const [, back] of gaps) { burst(s, rng, back, 0.62, 0.0012, 'hp', 1500); ping(s, back, 2300, 0.28, 0.004, 1.0); } // each re-strike spits
  return s;
}

function waterDrop(rng, f0) { // a bubble ringing up in pitch as it closes, over a tiny splash
  const s = samples(0.24); let ph = 0;
  for (let i = 0; i < s.length; i++) { const t = i / SR; const f = f0 * (1 + 0.62 * (1 - Math.exp(-t / 0.017))); ph += TAU * f / SR; s[i] = (Math.sin(ph) + 0.16 * Math.sin(2 * ph)) * Math.min(1, t / 0.0011) * Math.exp(-t / 0.026); }
  burst(s, rng, 0, 0.55, 0.0017, 'hp', 3200);
  const late = rng.range(0.055, 0.095); ping(s, late, f0 * rng.range(1.7, 2.2), 0.13, 0.014, 0, 0.001);
  return norm(s);
}
function wetSplat(rng) { const s = samples(0.09); burst(s, rng, 0, 1.0, 0.0045, 'bp', rng.range(2500, 3900), 1.3); ping(s, 0, rng.range(620, 820), 0.28, 0.007, 1.2); return norm(s); }

// soft additive tone used by the score
function bell(partials, dur, attack, vibrato = 0) {
  const s = samples(dur);
  for (const [hz, amp, tau, ph = 0] of partials) for (let i = 0; i < s.length; i++) { const t = i / SR; s[i] += amp * Math.sin(TAU * hz * t + ph + vibrato * Math.sin(TAU * 5.1 * t)) * Math.exp(-t / tau) * s01(t / attack); }
  for (let i = 0; i < s.length; i++) s[i] *= 1 - s01((i / SR - (dur - 0.15)) / 0.15);
  return s;
}
function glide(from, to, dur, tau, attack = 0.012, second = 0.18) {
  const s = samples(dur); let ph = 0;
  for (let i = 0; i < s.length; i++) { const t = i / SR; const f = to + (from - to) * Math.exp(-t / 0.11); ph += TAU * f / SR; s[i] = (Math.sin(ph) + second * Math.sin(2 * ph + 0.6)) * s01(t / attack) * Math.exp(-t / tau) * (1 - s01((t - (dur - 0.1)) / 0.1)); }
  return s;
}
function breath(name, f0, f1, sweep, attack, tau, dur, q = 1.1) {
  const rng = rngFor(name), s = samples(dur), bp = new Biquad('bp', f0, q), bp2 = new Biquad('bp', f0 * 1.9, q);
  for (let i = 0; i < s.length; i++) { const t = i / SR; if (!(i % 32)) { const f = f0 * Math.pow(f1 / f0, s01(t / sweep)); bp.set(f); bp2.set(f * 1.9); } const w = rng.bi(); s[i] = (bp.run(w) + 0.45 * bp2.run(w)) * s01(t / attack) * Math.exp(-Math.max(0, t - attack) / tau) * (1 - s01((t - (dur - 0.12)) / 0.12)); }
  return norm(s);
}

// ───────────── 1. the night: city hush and the wet gutters ─────────────
function ambience() {
  const side = ['hush-mid', 'hush-left', 'hush-right'].map(n => {
    const rng = rngFor(n), out = samples(K.duration), lp = new Biquad('lp', 330, 0.6), lp2 = new Biquad('lp', 520, 0.6), hp = new Biquad('hp', 48, 0.7);
    let brown = 0; for (let i = 0; i < N; i++) { brown = brown * 0.9975 + rng.bi() * 0.045; out[i] = hp.run(lp2.run(lp.run(brown))); }
    return out;
  });
  const airy = ['air-left', 'air-right'].map(n => { const rng = rngFor(n), out = samples(K.duration), a = new Biquad('hp', 380, 0.6), b = new Biquad('lp', 1150, 0.6); for (let i = 0; i < N; i++) out[i] = b.run(a.run(rng.bi())); return out; });
  const lfo = rngFor('hush-lfo'), p = [lfo() * TAU, lfo() * TAU, lfo() * TAU];
  const rms = x => { let s = 0; for (const v of x) s += v * v; return Math.sqrt(s / x.length); };
  const gm = side.map(x => db(-47) / rms(x)), ga = airy.map(x => db(-62) / rms(x));
  for (let i = 0; i < N; i++) {
    const t = i / SR, swell = db(1.8 * Math.sin(TAU * t / 11.3 + p[0]) + 1.1 * Math.sin(TAU * t / 4.7 + p[1]));
    for (let ch = 0; ch < 2; ch++) AMB[ch][i] += (side[0][i] * gm[0] + side[1 + ch][i] * gm[1 + ch] * 0.55) * swell + airy[ch][i] * ga[ch] * db(1.5 * Math.sin(TAU * t / 6.1 + p[2] + ch));
  }
  // a thread of water in two downpipes: sparse tiny bubbles
  for (const [name, pos] of [['trickle-hero', PT.heroDownpipe], ['trickle-cafe', PT.cafeDownpipe]]) {
    const rng = rngFor(name);
    for (let t = rng() * 0.1; t < K.duration; t += -Math.log(1 - rng()) / 15) {
      const f = rng.range(1050, 3100), s = samples(0.03);
      let ph = 0; const tau = rng.range(0.003, 0.008);
      for (let i = 0; i < s.length; i++) { const u = i / SR; ph += TAU * f * (1 + 8 * u) / SR; s[i] = Math.sin(ph) * Math.min(1, u / 0.001) * Math.exp(-u / tau); }
      const c = camAt(t).pos, d = len(sub3(pos, c));
      place(AMB, s, t, db(-42 + rng.range(-9, 2)) * REF_DIST / d, panOfDirection(pos, t), { send: 0.25 });
    }
  }
}

// ───────────── 2. the street: everything that really makes a noise ─────────────
function street() {
  // the switch
  for (const [off, tE] of [[false, LAMP.bulb.on], [true, LAMP.bulb.off]]) {
    const tH = streetEvent(switchClick(off), tE, PT.switch, db(off ? -7.5 : -7), { send: 0.22 });
    cue({ id: off ? 'click-off' : 'click-on', kind: 'street', name: off ? 'Switch clicks OFF' : 'Switch clicks ON', event: tE, time: tH, seen: off ? SEEN.bulbOff : SEEN.bulbOn, check: { hz: [900, 5000] } });
  }
  // the bare filament humming at twice mains frequency, from click to click
  {
    const rng = rngFor('filament'), t0 = arrival(LAMP.bulb.on, PT.bulb, V_SOUND), t1 = arrival(LAMP.bulb.off, PT.bulb, V_SOUND);
    const s = samples(t1 - t0 + 0.02), bp = new Biquad('bp', 4300, 1.4);
    const H = [[100, 0.35], [200, 1.0], [300, 0.42], [400, 0.36], [600, 0.22], [800, 0.13], [1000, 0.09], [1200, 0.05]].map(([f, a]) => [f, a, rng() * TAU]);
    for (let i = 0; i < s.length; i++) { const t = i / SR; let v = 0; for (const [f, a, p] of H) v += a * Math.sin(TAU * f * t + p); v += bp.run(rng.bi()) * Math.pow(Math.abs(Math.sin(TAU * 50 * t)), 10) * 1.6; s[i] = v * 0.4 * s01(t / 0.03) * (1 - s01((t - (t1 - t0)) / 0.008)) * (1 + 0.07 * Math.sin(TAU * 0.7 * t)); }
    ping(s, 0.003, 5230, 0.35, 0.05); // the filament's tiny ping
    place(STREET, s, t0, db(-43), panOfDirection(PT.bulb, 5), { send: 0.1 });
    cue({ id: 'filament', kind: 'street', name: 'Filament hum (100 Hz and harmonics)', event: LAMP.bulb.on, time: t0, until: t1 });
  }
  // the old street lamp
  {
    const a = streetEvent(gasIgnite(), LAMP.lantern.on, PT.lantern, db(-11));
    cue({ id: 'gas-on', kind: 'street', name: 'Street lamp catches: soft gas "fwup"', event: LAMP.lantern.on, time: a, seen: SEEN.lanternOn, check: { hz: [300, 5000] } });
    const b = arrival(LAMP.lantern.off, PT.lantern, V_SOUND);
    const rng = rngFor('gas-hiss'), h = samples(b - a), hp = new Biquad('hp', 2600, 0.7), lp = new Biquad('lp', 5600, 0.7);
    for (let i = 0; i < h.length; i++) { const t = i / SR; h[i] = lp.run(hp.run(rng.bi())) * s01((t - 0.1) / 0.4) * (1 - s01((t - (b - a - 0.02)) / 0.02)) * (1 + 0.18 * Math.sin(TAU * 7.3 * t) * Math.sin(TAU * 2.1 * t)); }
    place(STREET, h, a, db(-45), panOfDirection(PT.lantern, 12), { send: 0.08 });
    streetEvent(gasPuff(), LAMP.lantern.off, PT.lantern, db(-12));
    cue({ id: 'gas-off', kind: 'street', name: 'Street lamp gas puffs out', event: LAMP.lantern.off, time: b, seen: SEEN.lanternOff, check: { hz: [1900, 4300] } });
  }
  // the neon sign's relay and transformer
  {
    const on = streetEvent(neonRelay(), LAMP.neon.on, PT.neonSign, db(-19.5));
    const dur = LAMP.neon.off - LAMP.neon.on;
    const buzz = neonBuzz(dur);
    const offH = arrival(LAMP.neon.off, PT.neonSign, V_SOUND);
    place(STREET, buzz, on, db(-19.5) * REF_DIST / len(sub3(PT.neonSign, camAt(on).pos)), panOfDirection(PT.neonSign, on), { send: 0.14 });
    streetEvent(tick(rngFor('neon-cut'), 2100, 0.006), LAMP.neon.off, PT.neonSign, db(-14));
    cue({ id: 'neon-on', kind: 'street', name: 'Neon relay clunks; transformer buzz stutters (the shader\'s own pattern)', event: LAMP.neon.on, time: on, seen: SEEN.neonCentre, check: { hz: [600, 4200] } });
    K.neonStutter.gaps.forEach(([, back], i) => cue({ id: 'strike-' + (i + 1), kind: 'street', name: `Neon re-strike ${i + 1}`, event: LAMP.neon.on + back, time: on + back, seen: SEEN.neonCentre + back, check: { hz: [1500, 6000], window: 0.045 } }));
    cue({ id: 'neon-off', kind: 'street', name: 'Neon buzz cuts out', event: LAMP.neon.off, time: offH, seen: SEEN.neonOff, check: { hz: [1500, 5000], window: 0.05 } });
  }
  // gutters and wet washing: the film's own drip schedule
  const drips = [];
  const LEAD = new Set([0, 2, 4]);     // splashes in view: left of centre, right, and further down the lane
  K.drips.forEach((d, di) => {
    const voice = rngFor('drip-voice-' + di), f0 = voice.range(820, 1950), level = LEAD.has(di) ? voice.range(-0.5, 1.5) : voice.range(-13.5, -9.5);
    const pos = [d.x, 0.03, d.z];
    for (let k = -3; ; k++) {
      const impact = d.phase + d.fall + k * d.period; if (impact > K.duration) break;
      if (arrival(impact, pos, V_SOUND) < 0.015) continue;
      const rng = rngFor(`drip-${di}-${k}`);
      const sig = d.water ? waterDrop(rng, f0 * rng.range(0.965, 1.035)) : wetSplat(rng);
      const dist = len(sub3(pos, camAt(impact).pos));
      if (NO_DRIPS) continue;
      const tH = streetEvent(sig, impact, pos, db((d.water ? -27.5 : -31) + level + rng.range(-2.5, 1.5)) * Math.pow(REF_DIST / Math.max(dist, 3), 0.35), { send: 0.3 });
      drips.push({ drip: di, lead: LEAD.has(di), impact: +impact.toFixed(4), heard: +tH.toFixed(4), rippleSeen: +arrival(impact, pos, C_LIGHT).toFixed(3), water: d.water });
    }
  });
  // moths: wing-beats at each moth's own rate, louder as it circles close to a lamp, and the odd tap on the glass
  const taps = [];
  K.moths.forEach((m, mi) => {
    const rng = rngFor('moth-' + mi), lamp = K.lamps[m.lamp];
    const at = e => { const x = clamp(e * K.mothTrackHz, 0, m.track.length - 1.001), i = x | 0, f = x - i; return [0, 1, 2].map(j => lerp(m.track[i][j], m.track[i + 1][j], f)); };
    const s = samples(K.duration), bp = new Biquad('bp', rng.range(1700, 3300), 1.15), lp = new Biquad('lp', 5200, 0.7), phase = rng() * TAU;
    const L = new Float64Array(N), R = new Float64Array(N); let gl = 0, gr = 0, tl = 0, tr = 0;
    for (let i = 0; i < N; i++) {
      const t = i / SR;
      if (!(i % 480)) {
        const p = at(t), c = camAt(t).pos, d = len(sub3(p, c)), r = len(sub3(p, lamp.pos));
        const near = 0.16 + 0.84 * Math.exp(-Math.max(0, r - 0.14) / 0.26);
        const calm = 1 - 0.5 * s01((t - arrival(lamp.off, lamp.pos, V_SOUND)) / 2.5);   // they settle once their lamp is out
        const g = db(-37.5) * near * calm * (REF_DIST / d), th = (panOfDirection(p, t) * 0.92 + 1) * Math.PI / 4;
        tl = Math.cos(th) * g; tr = Math.sin(th) * g;
      }
      gl += (tl - gl) * 0.004; gr += (tr - gr) * 0.004;
      const flutterRate = m.flapHz * (1 + 0.08 * Math.sin(TAU * 0.9 * t + phase));
      const beat = Math.pow(Math.max(0, Math.sin(TAU * flutterRate * t + phase + 0.5 * Math.sin(TAU * 1.7 * t))), 5);
      const bout = 0.55 + 0.45 * s01(Math.sin(TAU * t / (2.3 + 0.23 * mi) + phase * 3) * 2 + 0.5);
      const v = lp.run(bp.run(rng.bi())) * beat * bout * 3.2;
      L[i] = v * gl; R[i] = v * gr;
    }
    for (let i = 0; i < N; i++) { STREET[0][i] += L[i]; STREET[1][i] += R[i]; MOTHS[0][i] += L[i]; MOTHS[1][i] += R[i]; VERB[0][i] += L[i] * 0.12; VERB[1][i] += R[i] * 0.12; }
    for (let k = 1; k < m.track.length - 1; k++) {
      const e = k / K.mothTrackHz, r = q => len(sub3(m.track[q], lamp.pos));
      if (e > lamp.on + 0.6 && e < lamp.off && r(k) < r(k - 1) && r(k) <= r(k + 1) && r(k) < (m.lamp === 0 ? 0.15 : 0.21)) taps.push({ e, r: r(k), pos: m.track[k], mi, lamp: lamp.name });
    }
  });
  taps.sort((a, b) => a.r - b.r);
  const chosen = []; for (const q of taps) if (chosen.length < 7 && chosen.every(o => Math.abs(o.e - q.e) > 0.9)) chosen.push(q);
  chosen.sort((a, b) => a.e - b.e).forEach((q, i) => {
    const rng = rngFor('tap-' + i); const tH = streetEvent(tick(rng, rng.range(1900, 2900), 0.0035), q.e, q.pos, db(-27), { send: 0.2 });
    cue({ id: 'tap-' + (i + 1), kind: 'street', name: `Moth taps the ${q.lamp} glass`, event: q.e, time: tH, minor: true });
  });
  return drips;
}

// ───────────── 3. the score: the light, voiced ─────────────
const HZ = { D2: 73.416, A2: 110.0, E3: 164.81, D3: 146.83, A3: 220.0, D4: 293.66, Fs4: 369.99, A4: 440.0, B4: 493.88, Cs5: 554.37, E5: 659.26, Fs5: 739.99, Gs5: 830.61, B5: 987.77, Cs6: 1108.73, D6: 1174.66, Fs6: 1479.98, A6: 1760.0, Cs7: 2217.46, Fs7: 2959.96 };

// moonlight: an open fifth, no third. It arrived long ago, so it never changes.
function moonBed() {
  const rng = rngFor('moon');
  for (const [hz, level, pan] of [[HZ.D2, -47.5, 0], [HZ.A2, -45, -0.18], [HZ.E3, -48, 0.22], [HZ.D4 * 2, -62, -0.4], [HZ.A4 * 2, -66, 0.45]]) {
    const p1 = rng() * TAU, p2 = rng() * TAU, beat = rng.range(0.05, 0.13), g = db(level), th = (pan + 1) * Math.PI / 4;
    for (let i = 0; i < N; i++) { const t = i / SR; const v = (Math.sin(TAU * hz * t + p1) + 0.8 * Math.sin(TAU * (hz + beat) * t + p2)) / 1.8 * s01(t / 0.9) * g; SCORE[0][i] += v * Math.cos(th); SCORE[1][i] += v * Math.sin(th); VERB[0][i] += v * 0.15 * Math.cos(th); VERB[1][i] += v * 0.15 * Math.sin(th); }
  }
}

// A sustained chord whose size and brightness are the measured light on screen.
function lightVoice(name, lamp, notes, levelDb, { subNote = null, panAt = null, send = 0.2 } = {}) {
  const rng = rngFor(name);
  const voices = notes.map(([hz, enter, gain]) => ({ hz, enter, gain, osc: [-1, 0, 1].map(k => ({ det: 1 + k * 0.00085 + rng.bi() * 0.00012, ph: rng() * TAU, k })), lfo: rng.range(0.09, 0.23), lp: rng() * TAU }));
  const tone = [new Biquad('lp', 1200, 0.6), new Biquad('lp', 1200, 0.6)];
  let amp = 0, bright = 0, share = 0, centre = 0, spread = 0; const smooth = 1 - Math.exp(-1 / (0.018 * SR));
  let ampT = 0, brT = 0, shT = 0, cenT = 0, sprT = 0; let subPh = rng() * TAU;
  const out = [0, 0];
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    if (!(i % 48)) {
      ampT = lightOnScreen(lamp, t); shT = REG[lamp].frac(t); brT = clamp(0.25 * LUM[lamp](t) + 0.8 * shT, 0, 1) * (ampT > 0 ? 1 : 0);
      const source = clamp(screenX(PT[lamp === 'neon' ? 'neonSign' : lamp], t) * 0.62, -0.7, 0.7);
      const open = s01(shT * 1.35);
      cenT = panAt !== null ? panAt : lerp(source, clamp(REG[lamp].litX(t) * 0.5, -0.4, 0.4), open);
      sprT = 0.08 + 0.62 * open;
      for (const f of tone) f.set(700 + 2600 * brT);
    }
    amp += (ampT - amp) * smooth; bright += (brT - bright) * smooth; share += (shT - share) * smooth; centre += (cenT - centre) * smooth; spread += (sprT - spread) * smooth;
    out[0] = 0; out[1] = 0;
    if (amp > 1e-5) {
      const slope = 2.75 - 1.25 * bright;
      const w = [1, Math.pow(2, -slope), Math.pow(3, -slope), Math.pow(4, -slope), Math.pow(5, -slope)];
      for (const v of voices) {
        const g = v.gain * (v.enter <= 0 ? 1 : s01((share - v.enter) / 0.2));  // upper notes join as the lit region spreads
        if (g <= 0) continue;
        const breathe = 1 + 0.085 * Math.sin(TAU * v.lfo * t + v.lp);
        for (const o of v.osc) {
          const ph = TAU * v.hz * o.det * t + o.ph; let s = 0;
          for (let h = 0; h < 5; h++) if (v.hz * (h + 1) < 4200) s += w[h] * Math.sin(ph * (h + 1));
          const pan = clamp(centre + o.k * spread, -1, 1), th = (pan + 1) * Math.PI / 4, share_ = o.k ? 0.27 : 0.46;
          out[0] += s * g * breathe * share_ * Math.cos(th); out[1] += s * g * breathe * share_ * Math.sin(th);
        }
      }
      if (subNote) { const s = Math.sin(TAU * subNote * t + subPh) * 0.30; out[0] += s * 0.707; out[1] += s * 0.707; }
    }
    for (let ch = 0; ch < 2; ch++) { const y = tone[ch].run(out[ch]) * amp * db(levelDb); SCORE[ch][i] += y; VERB[ch][i] += y * send; }
  }
}

// air that moves with the fronts: bright while light is spreading, low while darkness is
function fronts() {
  for (const lamp of ['bulb', 'lantern', 'neon']) {
    const level = { bulb: -31, lantern: -40, neon: -42 }[lamp];
    for (const edge of ['light', 'dark']) {
      const rng = rngFor(`front-${lamp}-${edge}`);
      const bp = [new Biquad('bp', 2000, 0.8), new Biquad('bp', 2000, 0.8)];
      let g = 0, target = 0, pan = 0, panT = 0; const k = 1 - Math.exp(-1 / (0.05 * SR));
      for (let i = 0; i < N; i++) {
        const t = i / SR;
        if (!(i % 48)) {
          const rate = (REG[lamp].frac(t + 1 / FPS) - REG[lamp].frac(t - 1 / FPS)) * FPS / 2;   // share of the scene per second
          const starts = lamp === 'bulb' ? frameTime(FR.bulbOn) : lamp === 'lantern' ? frameTime(FR.lanternOn) : frameTime(FR.neonFirst);
          const stops = arrival(LAMP[lamp].off, PT[lamp === 'neon' ? 'neonSign' : lamp], C_LIGHT);
          const on = edge === 'light' ? (t >= starts && t < stops) : t >= stops - 1 / FPS;
          target = on ? Math.pow(clamp((edge === 'light' ? rate : -rate) / 0.42, 0, 1), 0.75) : 0;
          panT = clamp((edge === 'light' ? REG[lamp].frontX(t) : REG[lamp].darkX(t)) * 0.75, -0.8, 0.8);
          const sweep = clamp((t - starts) / 5, 0, 1);
          const f = edge === 'light' ? lerp(1500, 3600, sweep) : lerp(900, 360, clamp((t - stops) / 4, 0, 1));
          bp[0].set(f); bp[1].set(f * 1.07);
        }
        g += (target - g) * k; pan += (panT - pan) * k;
        if (g < 1e-5) continue;
        const th = (pan + 1) * Math.PI / 4, w = rng.bi(), w2 = rng.bi();
        const l = bp[0].run(w) * g * db(level) * 2.2 * Math.cos(th), r = bp[1].run(w2 * 0.5 + w * 0.5) * g * db(level) * 2.2 * Math.sin(th);
        SCORE[0][i] += l; SCORE[1][i] += r; VERB[0][i] += l * 0.35; VERB[1][i] += r * 0.35;
      }
    }
  }
}

function hits() {
  const hit = (id, name, frame, seen, sig, level, pan, opts = {}) => {
    place(SCORE, sig, frameTime(frame), db(level), pan, { send: opts.send ?? 0.28, itd: false });
    cue({ id, kind: 'light', name, time: frameTime(frame), frame, seen, check: opts.check });
  };
  const panAt = (p, t) => clamp(screenX(p, t) * 0.62, -0.75, 0.75);
  // the bulb is SEEN: a warm bloom on that exact frame
  {
    const sub = glide(88, HZ.D2, 2.2, 0.75, 0.016, 0.28);
    place(SCORE, sub, frameTime(FR.bulbOn), db(-23), 0, { send: 0.1, itd: false });
    const chord = bell([[HZ.D4, 0.9, 1.5], [HZ.D4 * 2.004, 0.2, 0.7], [HZ.A4, 0.65, 1.35, 1.1], [HZ.A4 * 2.996, 0.07, 0.35], [HZ.Fs5, 0.34, 1.1, 2.0], [HZ.D3, 0.55, 1.4, 0.7]], 3.2, 0.012);
    hit('bloom', 'BULB SEEN: warm bloom (sub D, soft struck D-A-F#)', FR.bulbOn, SEEN.bulbOn, norm(chord), -20, panAt(PT.bulb, 2), { send: 0.4, check: { hz: [120, 900] } });
    place(SCORE, breath('opening', 330, 2700, 1.5, 0.32, 0.75, 2.8), frameTime(FR.bulbOn), db(-30), panAt(PT.bulb, 2) * 0.5, { send: 0.45, itd: false });
  }
  // ...and again, later, in the cafe mirror
  hit('mirror-on', 'SAME BULB appears in the café mirror: glass shimmer', FR.mirrorOn, SEEN.mirrorOn,
    norm(bell([[HZ.Fs6, 1.0, 0.95], [HZ.A6, 0.7, 0.8, 1.3], [HZ.Cs7, 0.42, 0.55, 0.4], [HZ.Fs7, 0.14, 0.3], [HZ.Fs6 * 1.0035, 0.55, 0.9, 2.2], [HZ.D6, 0.3, 0.7]], 2.4, 0.004)), -22.5, panAt(PT.mirror, 4.5), { send: 0.5, check: { hz: [1350, 3200] } });
  hit('lantern-tone', 'STREET LAMP seen: small soft bell (C#)', FR.lanternOn, SEEN.lanternOn,
    norm(bell([[HZ.Cs6, 1.0, 0.85], [HZ.Cs5, 0.55, 1.2, 0.8], [HZ.Cs6 * 2.76, 0.16, 0.22], [HZ.Gs5, 0.28, 0.9, 1.7]], 2.4, 0.006)), -22, panAt(PT.lantern, 9.3), { send: 0.42, check: { hz: [1060, 1160] } });
  // the neon tone flickers exactly as the sign is SEEN to flicker
  {
    const lag = SEEN.neonCentre - frameTime(FR.neonFirst);
    const tone = bell([[HZ.B5, 1.0, 1.0], [HZ.B5 * 1.006, 0.6, 0.95, 1.9], [HZ.Fs6, 0.5, 0.7, 0.6], [HZ.B4, 0.45, 1.3, 1.1], [HZ.B5 * 3.0, 0.1, 0.3]], 2.4, 0.005, 0.12);
    for (let i = 0; i < tone.length; i++) tone[i] *= stutter(i / SR - lag);
    hit('neon-tone', 'NEON seen: soft tone (B) that stutters with the sign on screen', FR.neonFirst, SEEN.neonFirst, norm(tone), -20.5, panAt(PT.neonSign, 10.9), { send: 0.35, check: { hz: [940, 1040] } });
  }
  // darkness
  {
    place(SCORE, glide(HZ.A2 * 1.06, HZ.D2, 1.3, 0.30, 0.014, 0.3), frameTime(FR.bulbOff), db(-23), 0, { send: 0.12, itd: false });
    hit('bulb-dark', 'BULB SEEN to go dark: low falling breath', FR.bulbOff, SEEN.bulbOff, breath('exhale', 3600, 300, 0.95, 0.007, 0.34, 1.7), -18, panAt(PT.bulb, 14) * 0.6, { send: 0.4, check: { hz: [1800, 5000] } });
  }
  hit('neon-dark', 'NEON seen to go dark: tone drops', FR.neonOff, SEEN.neonOff, norm(glide(HZ.B5, HZ.Fs5, 1.1, 0.26, 0.006, 0.14)), -25, panAt(PT.neonSign, 14.7), { send: 0.45, check: { hz: [700, 1030], window: 0.12 } });
  hit('lantern-dark', 'STREET LAMP seen to go dark: bell drops', FR.lanternOff, SEEN.lanternOff, norm(glide(HZ.Cs6, HZ.Gs5, 1.2, 0.28, 0.006, 0.1)), -25, panAt(PT.lantern, 15.3), { send: 0.45, check: { hz: [800, 1150], window: 0.12 } });
  hit('mirror-dark', 'The bulb finally goes out IN THE MIRROR: last glass note falls', FR.mirrorOff, SEEN.mirrorOff,
    norm(bell([[HZ.Fs6, 0.8, 0.5], [HZ.D6, 0.9, 0.75, 0.9], [HZ.A6, 0.25, 0.25], [HZ.D4 * 2, 0.35, 0.9, 1.6]], 1.9, 0.004)), -25.5, panAt(PT.mirror, 16.6), { send: 0.55, check: { hz: [1140, 1520] } });
}

function score() {
  moonBed();
  // the warm swell: D major, opening upwards. The F sharp that makes it major arrives with the spreading light.
  lightVoice('warm-swell', 'bulb', [[HZ.D3, 0, 0.74], [HZ.A3, 0.02, 0.74], [HZ.D4, 0.10, 0.68], [HZ.Fs4, 0.22, 0.80], [HZ.A4, 0.46, 0.52], [HZ.E5, 0.70, 0.34]], -21.5, { subNote: HZ.D2, send: 0.24 });
  lightVoice('lantern-voice', 'lantern', [[HZ.Cs5, 0, 1.0], [HZ.Gs5, 0.45, 0.45]], -33.5, { send: 0.35 });
  lightVoice('neon-voice', 'neon', [[HZ.B4, 0, 1.0], [HZ.Fs5, 0.40, 0.42]], -34.5, { send: 0.35 });
  cue({ id: 'swell', kind: 'light', name: 'Warm D-major swell: loudness = share of the scene inside the lamp\'s ellipsoid', time: frameTime(FR.bulbOn), frame: FR.bulbOn, until: K.duration });
  cue({ id: 'bed', kind: 'bed', name: 'City hush, downpipe trickle, open-fifth moonlight drone (never changes)', time: 0, frame: 0, until: K.duration });
  fronts();
  hits();
}

// ───────────── reverb: a narrow stone lane (8-line feedback delay network) ─────────────
function reverb() {
  const lens = [1433, 1601, 1867, 2053, 2251, 2399, 2617, 2797], rt60 = 1.15;
  const lines = lens.map(L => ({ buf: new Float64Array(L), i: 0, g: Math.pow(10, -3 * L / (rt60 * SR)), damp: onePole(3600) }));
  const pre = Math.round(0.017 * SR), wet = bus(), hp = [new Biquad('hp', 180, 0.7), new Biquad('hp', 180, 0.7)];
  const x = new Float64Array(8);
  for (let n = 0; n < N; n++) {
    const inL = n >= pre ? hp[0].run(VERB[0][n - pre]) : 0, inR = n >= pre ? hp[1].run(VERB[1][n - pre]) : 0;
    for (let k = 0; k < 8; k++) x[k] = lines[k].damp(lines[k].buf[lines[k].i]) * lines[k].g;
    let l = 0, r = 0; for (let k = 0; k < 8; k++) { if (k & 1) r += x[k] * ((k & 2) ? -1 : 1); else l += x[k] * ((k & 2) ? -1 : 1); }
    wet[0][n] = l * 0.5; wet[1][n] = r * 0.5;
    for (let s = 1; s < 8; s <<= 1) for (let k = 0; k < 8; k += s << 1) for (let j = k; j < k + s; j++) { const a = x[j], b = x[j + s]; x[j] = a + b; x[j + s] = a - b; }
    for (let k = 0; k < 8; k++) { const ln = lines[k]; ln.buf[ln.i] = x[k] * Math.SQRT1_2 * 0.5 + (k & 1 ? inR : inL) * 0.5; ln.i = (ln.i + 1) % ln.buf.length; }
  }
  return wet;
}

// ───────────── mastering: BS.1770 loudness, true-peak limiter, fades ─────────────
function kWeight(x) {
  const stage = (b, a) => { let x1 = 0, x2 = 0, y1 = 0, y2 = 0; return v => { const y = b[0] * v + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; return y; }; };
  const s1 = stage([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]), s2 = stage([1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
  return x.map(v => s2(s1(v)));
}
function loudness(st) {
  const w = [kWeight(st[0]), kWeight(st[1])], block = 0.4 * SR, hop = 0.1 * SR, z = [];
  for (let s = 0; s + block <= st[0].length; s += hop) { let e = 0; for (let ch = 0; ch < 2; ch++) for (let i = s; i < s + block; i++) e += w[ch][i] * w[ch][i]; z.push(e / block); }
  const L = e => -0.691 + 10 * Math.log10(e + 1e-20), mean = a => a.reduce((p, q) => p + q, 0) / a.length;
  const a = z.filter(e => L(e) > -70); if (!a.length) return -99;
  const rel = L(mean(a)) - 10; return L(mean(a.filter(e => L(e) > rel)));
}
// 4x oversampling with a windowed sinc, for true-peak detection
const PHASES = [1, 2, 3].map(p => { const h = []; for (let k = -11; k <= 12; k++) { const x = k - p / 4; const w = 0.5 + 0.5 * Math.cos(Math.PI * x / 12.5); h.push(Math.sin(Math.PI * x) / (Math.PI * x) * w); } const sum = h.reduce((a, b) => a + b, 0); return h.map(v => v / sum); });
function truePeakEnv(st) {
  const env = new Float64Array(st[0].length);
  for (const x of st) for (let n = 0; n < x.length; n++) {
    let m = Math.abs(x[n]);
    if (m > 0.2 || Math.abs(x[n + 1] || 0) > 0.2) for (const h of PHASES) { let y = 0; for (let j = 0; j < 24; j++) { const i = n + j - 11; if (i >= 0 && i < x.length) y += x[i] * h[j]; } m = Math.max(m, Math.abs(y)); }
    if (m > env[n]) env[n] = m;
  }
  return env;
}
function limit(st, ceiling) {
  const env = truePeakEnv(st), n = env.length, look = Math.round(0.004 * SR);
  const need = new Float64Array(n); for (let i = 0; i < n; i++) need[i] = env[i] > ceiling ? ceiling / env[i] : 1;
  const held = new Float64Array(n), q = []; // minimum over the next `look` samples (and the previous one)
  let head = 0, next = 0;
  for (let i = 0; i < n; i++) {
    while (next < n && next <= i + look) { while (q.length > head && need[q[q.length - 1]] >= need[next]) q.pop(); q.push(next); next++; }
    while (q[head] < i - 1) head++;
    held[i] = need[q[head]];
  }
  const rel = 1 - Math.exp(-1 / (0.09 * SR)); let g = 1; const released = new Float64Array(n);
  for (let i = 0; i < n; i++) { g = held[i] < g ? held[i] : g + (held[i] - g) * rel; released[i] = g; }
  // smooth the attack with a moving average of the same length as the look-ahead
  const out = bus(); let acc = 0; const half = look;
  const smooth = new Float64Array(n);
  for (let i = 0; i < n; i++) { acc += released[i]; if (i >= half) acc -= released[i - half]; smooth[i] = acc / Math.min(i + 1, half); }
  let minGain = 1;
  for (let i = 0; i < n; i++) { const gg = Math.min(smooth[i], need[i]); minGain = Math.min(minGain, gg); out[0][i] = st[0][i] * gg; out[1][i] = st[1][i] * gg; }
  return { out, reductionDb: -20 * Math.log10(minGain) };
}
const fadeGain = i => { const t = i / SR; return s01(t / 0.012) * (1 - s01((t - (K.duration - 0.55)) / (0.55 - 0.004))); };

function writeWav(file, st) {
  const data = Buffer.alloc(st[0].length * 6), rng = rngFor('dither');
  for (let i = 0; i < st[0].length; i++) for (let ch = 0; ch < 2; ch++) {
    const tpdf = (rng() - rng()) * (fadeGain(i) > 0 ? 1 : 0);
    const v = clamp(Math.round(st[ch][i] * 8388607 + tpdf), -8388608, 8388607);
    data.writeIntLE(v, (i * 2 + ch) * 3, 3);
  }
  const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 6, 28); h.writeUInt16LE(6, 32); h.writeUInt16LE(24, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

// ───────────── render ─────────────
const started = Date.now();
ambience();
const drips = street();
score();
const wet = reverb();
const mix = bus();
for (let ch = 0; ch < 2; ch++) {
  const hp1 = new Biquad('hp', 30, 0.54), hp2 = new Biquad('hp', 30, 1.31);
  for (let i = 0; i < N; i++) mix[ch][i] = hp2.run(hp1.run(AMB[ch][i] + STREET[ch][i] + SCORE[ch][i] + wet[ch][i] * 0.8));
}
const TARGET = -16.0, CEIL = db(-1.9);
let gain = db(TARGET - loudness(mix)), master, red = 0;
for (let it = 0; it < 5; it++) {
  const g = [mix[0].map(v => v * gain), mix[1].map(v => v * gain)];
  const r = limit(g, CEIL); master = r.out; red = r.reductionDb;
  for (let ch = 0; ch < 2; ch++) for (let i = 0; i < N; i++) master[ch][i] *= fadeGain(i);
  const l = loudness(master);
  if (Math.abs(l - TARGET) < 0.03) break;
  gain *= db(TARGET - l);
}
if (NO_DRIPS) { fs.mkdirSync(path.join(dir, '_work'), { recursive: true }); writeWav(path.join(dir, '_work', 'nodrips.wav'), master); console.log('wrote _work/nodrips.wav (diagnostic)'); process.exit(0); }
writeWav(path.join(dir, 'slow-light.wav'), master);
if (STEMS) {
  const w = path.join(dir, '_work'); fs.mkdirSync(w, { recursive: true });
  for (const [name, st] of [['ambience', AMB], ['street', STREET], ['score', SCORE], ['reverb', wet], ['moths', MOTHS]]) writeWav(path.join(w, `stem-${name}.wav`), [st[0].map((v, i) => v * gain * fadeGain(i)), st[1].map((v, i) => v * gain * fadeGain(i))]);
}
const seenFrameOf = t => { const k = Object.keys(SEEN).find(k => Math.abs(SEEN[k] - t) < 1e-3 && PICTURE[k] !== undefined); return k ? PICTURE[k] : firstFrame(t); };
for (const c of cues) { c.time = +c.time.toFixed(4); c.videoFrame = c.frame !== undefined ? c.frame : Math.floor(c.time * FPS + 1e-3); if (c.seen !== undefined) { c.seenFrame = c.frame !== undefined ? c.frame : seenFrameOf(c.seen); c.seen = +c.seen.toFixed(4); } if (c.event !== undefined) c.event = +c.event.toFixed(4); if (c.until !== undefined) c.until = +c.until.toFixed(4); }
cues.sort((a, b) => a.time - b.time);
fs.writeFileSync(path.join(dir, 'cue-sheet.json'), JSON.stringify({ fps: FPS, sampleRate: SR, soundSpeed: V_SOUND, lightSpeed: C_LIGHT, seen: SEEN, frames: FR, physicsFrames: FR_PHYSICS, cues, drips: drips.sort((a, b) => a.heard - b.heard) }, null, 1));
console.log(`wrote slow-light.wav  ${N} samples = ${(N / SR).toFixed(3)} s | ${loudness(master).toFixed(2)} LUFS (internal meter) | limiter max ${red.toFixed(1)} dB | master gain ${(20 * Math.log10(gain)).toFixed(1)} dB | ${drips.length} drips | ${((Date.now() - started) / 1000).toFixed(1)} s`);
console.log('picture frames:', JSON.stringify(PICTURE));
console.log('physics frames:', JSON.stringify(FR_PHYSICS));
for (const c of cues) if (!c.minor) console.log(c.time.toFixed(3).padStart(7), 'f' + String(c.videoFrame).padEnd(4), c.kind.padEnd(6), c.name, c.seen !== undefined && c.kind === 'street' ? `  [seen ${c.seen.toFixed(2)} s]` : '');
