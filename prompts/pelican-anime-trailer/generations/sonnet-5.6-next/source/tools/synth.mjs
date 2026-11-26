// Original soundtrack + sound design for BEAK VELOCITY. Everything is synthesised here: no samples, no recordings.
//   node tools/synth.mjs [out.wav]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TL = new Function(fs.readFileSync(path.join(root, 'src/timeline.js'), 'utf8') + '\nreturn TL;')();
const SR = 48000, DUR = TL.DURATION, N = Math.round(DUR * SR), BE = TL.BEAT, bt = b => b * BE;
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, k) => a + (b - a) * k;
let seed = 12345; const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) / 4294967296); };
const noise = () => rnd() * 2 - 1;
const mkNoise = s0 => { let s = (s0 * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 2147483648 - 1; }; };

const bus = () => [new Float32Array(N), new Float32Array(N)];
const B = { drums: bus(), bass: bus(), gtrL: bus(), gtrR: bus(), lead: bus(), strings: bus(), brass: bus(), choir: bus(), keys: bus(), sfx: bus(), amb: bus() };
function add(b, i, v, pan = 0) { if (i < 0 || i >= N) return; const a = (pan + 1) * Math.PI / 4; b[0][i] += v * Math.cos(a) * 1.414; b[1][i] += v * Math.sin(a) * 1.414; }
// render a voice: fn(tLocal) -> sample
function voice(b, t, dur, fn, pan = 0) { const i0 = Math.round(t * SR), n = Math.round(dur * SR); for (let i = 0; i < n; i++) { const k = i0 + i; if (k >= N) break; const v = fn(i / SR, i); add(b, k, v, typeof pan === 'function' ? pan(i / SR) : pan); } }

// ---------- filters ----------
class Biquad {
  constructor(type, f, q = 0.707, db = 0) { this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(type, f, q, db); }
  set(type, f, q = 0.707, db = 0) {
    const w = TAU * clamp(f, 10, SR * 0.45) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q), A = Math.pow(10, db / 40); let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
    else if (type === 'hs') { const q2 = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * c + q2); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - q2); a0 = (A + 1) - (A - 1) * c + q2; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - q2; }
    else { const q2 = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) - (A - 1) * c + q2); b1 = 2 * A * ((A - 1) - (A + 1) * c); b2 = A * ((A + 1) - (A - 1) * c - q2); a0 = (A + 1) + (A - 1) * c + q2; a1 = -2 * ((A - 1) + (A + 1) * c); a2 = (A + 1) + (A - 1) * c - q2; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0; return this;
  }
  p(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}
class SVF { // topology-preserving, safe to modulate per sample
  constructor() { this.a = 0; this.b = 0; }
  p(x, f, q) { const g = Math.tan(Math.PI * clamp(f, 15, SR * 0.45) / SR), k = 1 / q, a1 = 1 / (1 + g * (g + k)); const v3 = x - this.b, v1 = a1 * this.a + g * a1 * v3, v2 = this.b + g * v1; this.a = 2 * v1 - this.a; this.b = 2 * v2 - this.b; this.lp = v2; this.bp = v1; this.hp = x - k * v1 - v2; return this; }
}
const blep = (t, dt) => t < dt ? (t /= dt, t + t - t * t - 1) : t > 1 - dt ? (t = (t - 1) / dt, t * t + t + t + 1) : 0;
class Osc { constructor(ph = rnd()) { this.ph = ph; } saw(f) { const dt = f / SR; this.ph += dt; if (this.ph >= 1) this.ph -= 1; return 2 * this.ph - 1 - blep(this.ph, dt); } sq(f, w = 0.5) { const dt = f / SR; this.ph += dt; if (this.ph >= 1) this.ph -= 1; let v = this.ph < w ? 1 : -1; v += blep(this.ph, dt); v -= blep((this.ph + 1 - w) % 1, dt); return v; } sin(f) { this.ph += f / SR; if (this.ph >= 1) this.ph -= 1; return Math.sin(TAU * this.ph); } }
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const NOTE = s => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(s); const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]]; return 12 * (+m[3] + 1) + base + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
const env = (t, a, d, s, r, len) => { if (t < a) return t / a; const v = t < a + d ? lerp(1, s, (t - a) / d) : s; return t > len ? v * Math.max(0, 1 - (t - len) / r) : v; };

// ---------- drums ----------
const kickTimes = [];
function kick(t, g = 1) { kickTimes.push(t); let ph = 0; voice(B.drums, t, 0.34, tt => { const f = 46 + 120 * Math.exp(-tt * 34); ph += f / SR; return (Math.tanh(Math.sin(TAU * ph) * 2.2) * Math.exp(-tt * 9.5) + (tt < 0.004 ? noise() * 0.6 * (1 - tt / 0.004) : 0)) * 0.95 * g; }); }
function snare(t, g = 1, pan = 0.02) { const bp = new Biquad('bp', 1900, 0.65), hp = new Biquad('hp', 900); let ph = 0; voice(B.drums, t, 0.32, tt => { const f = 178 + 70 * Math.exp(-tt * 60); ph += f / SR; const n = noise(); return (Math.sin(TAU * ph) * Math.exp(-tt * 22) * 0.62 + bp.p(n) * Math.exp(-tt * 15) * 1.15 + hp.p(n) * Math.exp(-tt * 26) * 0.40) * 0.72 * g; }, pan); }
function hat(t, g = 1, open = false, pan = 0.28) { const hp = new Biquad('hp', 7600, 0.8), pk = new Biquad('peak', 10200, 2.2, 6); voice(B.drums, t, open ? 0.30 : 0.07, tt => pk.p(hp.p(noise())) * Math.exp(-tt * (open ? 11 : 70)) * 0.20 * g, pan); }
function metal(t, dur, g, pan, base, dec, hpf) { const fr = [1, 1.347, 1.683, 2.09, 2.52, 3.17, 3.91].map(r => r * base); const os = fr.map(() => new Osc()); const hp = new Biquad('hp', hpf, 0.7), hp2 = new Biquad('hp', hpf * 0.7, 0.7); voice(B.drums, t, dur, tt => { let s = 0; for (let i = 0; i < os.length; i++) s += os[i].sq(fr[i] * (1 + 0.002 * Math.sin(tt * 40 + i))); const n = noise(); return (hp.p(s / 7) * 0.85 + hp2.p(n) * 0.75) * Math.exp(-tt * dec) * Math.min(1, tt / 0.002) * g; }, pan); }
const crash = (t, g = 1, pan = -0.15, dur = 2.2) => metal(t, dur, 0.30 * g, pan, 372, 2.1, 3600);
const ride = (t, g = 1) => metal(t, 0.5, 0.10 * g, 0.35, 540, 7.5, 5200);
function tom(t, f, g = 1, pan = 0) { let ph = 0; const lp = new Biquad('lp', 1800); voice(B.drums, t, 0.5, tt => { ph += (f * (1 + 0.55 * Math.exp(-tt * 28))) / SR; return (Math.sin(TAU * ph) * Math.exp(-tt * 7) + lp.p(noise()) * Math.exp(-tt * 40) * 0.55) * 0.72 * g; }, pan); }
function taiko(t, g = 1, pan = 0) { let ph = 0, ph2 = 0; const lp = new Biquad('lp', 520, 0.9); voice(B.drums, t, 1.1, tt => { ph += (58 + 52 * Math.exp(-tt * 22)) / SR; ph2 += (92 + 60 * Math.exp(-tt * 30)) / SR; return Math.tanh((Math.sin(TAU * ph) * Math.exp(-tt * 4.2) + 0.5 * Math.sin(TAU * ph2) * Math.exp(-tt * 9) + lp.p(noise()) * Math.exp(-tt * 18) * 2.0) * 1.35) * 0.78 * g; }, pan); }

// ---------- pitched ----------
function bass(t, m, dur, g = 1) { const f = mtof(m), o = new Osc(0), s = new Osc(0), sub = new Osc(0), fl = new SVF(); voice(B.bass, t, dur + 0.04, tt => { const e = env(tt, 0.004, 0.08, 0.72, 0.035, dur); const x = o.saw(f) * 0.62 + s.sq(f * 1.003, 0.42) * 0.30; fl.p(x, 190 + 1500 * Math.exp(-tt * 17), 1.15); return (Math.tanh(fl.lp * 2.0) * 0.62 + sub.sin(f * 0.5 > 45 ? f * 0.5 : f) * 0.28) * e * 0.55 * g; }); }
// Karplus-Strong string into a buffer
function ksString(f, dur, o = {}) {
  const n = Math.round(dur * SR), out = new Float32Array(n);
  const period = SR / f - 0.5, L = Math.floor(period), frac = period - L, apc = (1 - frac) / (1 + frac);
  const line = new Float32Array(L + 1); const nz = mkNoise(o.seed || 7); const lp = new Biquad('lp', o.bright || 5200, 0.6);
  for (let i = 0; i < L; i++) line[i] = lp.p(nz());
  const pickPos = Math.floor(L * 0.17); const tmp = Float32Array.from(line); for (let i = 0; i < L; i++) line[i] = tmp[i] - tmp[(i + pickPos) % L] * 0.7;
  let idx = 0, apx = 0, apy = 0, prev = 0; const fb = Math.pow(0.001, 1 / (f * (o.decay || 3.2))), damp = o.damp === undefined ? 0.5 : o.damp;
  for (let i = 0; i < n; i++) {
    const cur = line[idx]; const avg = cur * (1 - damp) + prev * damp; prev = cur;
    const ap = apc * avg + apx - apc * apy; apx = avg; apy = ap;
    line[idx] = ap * fb; out[i] = cur; idx = (idx + 1) % L;
  }
  return out;
}
let gseed = 1;
function guitar(t, notes, dur, o = {}) {
  const g = o.gain === undefined ? 1 : o.gain, mute = !!o.mute;
  [[B.gtrL, -0.82, 0.0, -0.06], [B.gtrR, 0.82, 0.009, 0.07]].forEach(([b, pan, late, det]) => {
    notes.forEach((m, j) => {
      const s = ksString(mtof(m + det * 0.6), dur + 0.05, { seed: gseed++ * 31 + j, decay: mute ? 0.16 : 3.6, damp: mute ? 0.62 : 0.34, bright: mute ? 2600 : 5200 });
      const i0 = Math.round((t + late + j * 0.004 + (rnd() - 0.5) * 0.004) * SR);
      for (let i = 0; i < s.length; i++) { const tt = i / SR; const e = Math.min(1, tt / 0.002) * (tt > dur ? Math.max(0, 1 - (tt - dur) / 0.05) : 1); const k = i0 + i; if (k >= 0 && k < N) b[0][k] += s[i] * e * g * 0.5; }
    });
  });
}
const power = m => [m, m + 7, m + 12];
function lead(t, m, dur, g = 1, o = {}) {
  const f = mtof(m), a = new Osc(), b = new Osc(), c = new Osc(), fl = new SVF();
  voice(B.lead, t, dur + 0.09, tt => {
    const vib = 1 + Math.sin(TAU * 5.8 * tt) * 0.0072 * clamp((tt - 0.16) / 0.2); const bend = o.slide ? Math.pow(2, -o.slide / 12 * Math.exp(-tt * 28)) : 1 - 0.028 * Math.exp(-tt * 45);
    const x = a.saw(f * vib * bend) * 0.5 + b.saw(f * 1.006 * vib * bend) * 0.38 + c.sq(f * 0.5 * vib * bend, 0.46) * 0.24;
    fl.p(Math.tanh(x * 2.4), 2300 + 2600 * Math.exp(-tt * 7), 0.95);
    return fl.lp * env(tt, 0.012, 0.12, 0.82, 0.08, dur) * 0.27 * g;
  }, o.pan || 0.04);
}
function strings(t, notes, dur, g = 1, o = {}) {
  const atk = o.attack === undefined ? 0.09 : o.attack, rel = o.release || 0.28;
  notes.forEach((m, j) => {
    const f = mtof(m);
    for (let v = 0; v < 4; v++) {
      const os = new Osc(), lp = new Biquad('lp', o.bright || 3400, 0.6), hp = new Biquad('hp', 170);
      const det = 1 + (v - 1.5) * 0.0052 + (rnd() - 0.5) * 0.002, ph = rnd() * 6, pan = (v - 1.5) / 1.8 + (j % 2 ? 0.12 : -0.12);
      voice(B.strings, t, dur + rel, tt => { const vib = 1 + Math.sin(TAU * (4.8 + v * 0.35) * tt + ph) * 0.0042; let e = env(tt, atk, 0.2, 0.86, rel, dur); if (o.trem) e *= 0.62 + 0.38 * Math.abs(Math.sin(Math.PI * o.trem * tt + ph * 0.1)); if (o.swell) e *= Math.pow(clamp(tt / dur), 1.6) * 0.9 + 0.1; return hp.p(lp.p(os.saw(f * det * vib * (o.gliss ? Math.pow(2, o.gliss * clamp(tt / dur) / 12) : 1)))) * e * 0.075 * g; }, clamp(pan, -0.95, 0.95));
    }
  });
}
function brass(t, notes, dur, g = 1, o = {}) {
  notes.forEach((m, j) => {
    const f = mtof(m), os = [new Osc(), new Osc(), new Osc()], fl = new SVF();
    voice(B.brass, t, dur + 0.12, tt => { const x = os[0].saw(f * 0.996) + os[1].saw(f * 1.0035) + os[2].saw(f * 1.0005); const open = Math.min(1, tt / (o.bloom || 0.055)); fl.p(x / 3, 280 + 3300 * open * (0.45 + 0.55 * Math.exp(-tt * 3.2)), 1.05); return Math.tanh(fl.lp * 2.4) * env(tt, 0.016, 0.18, 0.74, 0.1, dur) * 0.145 * g; }, (j % 3 - 1) * 0.34);
  });
}
function braam(t, m, dur, g = 1) {
  const fs_ = [m, m + 0.12, m - 0.1, m + 12.07, m + 7.05].map(mtof), os = fs_.map(() => new Osc()), fl = new SVF(), fl2 = new SVF();
  voice(B.brass, t, dur + 0.3, tt => { let x = 0; for (let i = 0; i < os.length; i++) x += os[i].saw(fs_[i] * (1 + 0.004 * Math.sin(tt * (7 + i)))) * (i > 2 ? 0.55 : 1); const open = Math.min(1, tt / 0.12); fl.p(Math.tanh(x * 1.1), 140 + 1750 * open * Math.exp(-tt * 1.25), 1.7); fl2.p(fl.lp, 2600, 0.7); return Math.tanh(fl2.lp * 2.7) * env(tt, 0.03, 0.4, 0.8, 0.28, dur) * 0.34 * g; });
}
function choir(t, notes, dur, g = 1, o = {}) {
  const forms = o.vowel === 'oh' ? [[430, 7, 1], [820, 8, 0.5], [2600, 9, 0.12]] : [[760, 7, 1], [1180, 8, 0.66], [2750, 10, 0.24]];
  notes.forEach((m, j) => {
    const f = mtof(m);
    for (let v = 0; v < 3; v++) {
      const os = new Osc(), bps = forms.map(([ff, q]) => new Biquad('bp', ff * (1 + (v - 1) * 0.03), q)), ph = rnd() * 6;
      voice(B.choir, t, dur + 0.5, tt => { const vib = 1 + Math.sin(TAU * (5.1 + v * 0.5) * tt + ph) * 0.009 * clamp(tt / 0.4); const x = os.saw(f * (1 + (v - 1) * 0.006) * vib) + noise() * 0.05; let s = 0; for (let i = 0; i < 3; i++) s += bps[i].p(x) * forms[i][2]; return s * env(tt, o.attack || 0.22, 0.3, 0.9, 0.45, dur) * 0.17 * g; }, clamp((v - 1) * 0.6 + (j - 1) * 0.18, -0.9, 0.9));
    }
  });
}
function pluck(t, m, dur, g = 1, pan = 0, o = {}) { const s = ksString(mtof(m), dur, { seed: Math.round(m * 91 + t * 777), decay: o.decay || 1.8, damp: o.damp === undefined ? 0.52 : o.damp, bright: o.bright || 2800 }); const i0 = Math.round(t * SR); for (let i = 0; i < s.length; i++) add(B.keys, i0 + i, s[i] * Math.min(1, i / 60) * Math.min(1, (s.length - i) / 900) * 0.42 * g, pan); }
function toy(t, m, dur, g = 1) { const o = new Osc(0); let hold = 0, c = 0; voice(B.keys, t, dur, tt => { if (c++ % 5 === 0) hold = o.sq(mtof(m) * (1 - 0.012 * clamp((tt - dur * 0.6) / (dur * 0.4))), 0.5); return Math.round(hold * 5) / 5 * 0.12 * g * Math.min(1, tt / 0.003) * Math.exp(-tt * 6); }); }
function drone(t0, t1, m, g = 1, o = {}) { const f = mtof(m), a = new Osc(), b = new Osc(), s = new Osc(), fl = new SVF(); const dur = t1 - t0; voice(B.strings, t0, dur + 0.3, tt => { const x = a.saw(f * 0.997) + b.saw(f * 1.004); fl.p(x * 0.5, (o.cut || 260) + 120 * Math.sin(tt * 1.7), 1.2); return (fl.lp * 0.55 + s.sin(f * 0.5 > 38 ? f * 0.5 : f) * 0.38) * env(tt, o.attack || 0.5, 0.3, 0.9, 0.3, dur) * 0.22 * g; }); }
function riser(t0, t1, g = 1, o = {}) { const fl = new SVF(), os = new Osc(), os2 = new Osc(); const dur = t1 - t0; voice(B.sfx, t0, dur, tt => { const k = tt / dur; fl.p(noise(), 250 + 7800 * k * k, 2.6); const trem = 0.7 + 0.3 * Math.sin(TAU * (4 + 22 * k * k) * tt); const f = mtof((o.from || 52) + (o.span || 24) * k * k); return (fl.bp * 0.55 + (os.saw(f) + os2.saw(f * 1.009)) * 0.10) * Math.pow(k, 1.7) * trem * 0.55 * g; }, tt => Math.sin(tt * 9) * 0.3 * (tt / dur)); }

// ---------- sound effects ----------
const FX = {
  heart(t, g) { for (const [d, a] of [[0, 1], [0.17, 0.7]]) { let ph = 0; voice(B.sfx, t + d, 0.3, tt => { ph += (42 + 34 * Math.exp(-tt * 30)) / SR; return Math.sin(TAU * ph) * Math.exp(-tt * 15) * Math.min(1, tt / 0.004) * 0.85 * a * g; }); } },
  revcym(t, g, p, len = 1.2) { const hp = new Biquad('hp', 3200), hp2 = new Biquad('hp', 5200); voice(B.sfx, t, len, tt => { const k = tt / len; return (hp.p(noise()) * 0.5 + hp2.p(noise()) * 0.5) * Math.pow(k, 3) * (tt > len - 0.008 ? (len - tt) / 0.008 : 1) * 0.62 * g; }, p); },
  shing(t, g, p = 0) { const fr = [2637, 3951, 5274, 6645, 8372, 9956], os = fr.map(() => new Osc()), hp = new Biquad('hp', 2000); const fl = new SVF(); voice(B.sfx, t, 1.5, tt => { let s = 0; for (let i = 0; i < 6; i++) s += os[i].sin(fr[i] * (1 + 0.012 * (1 - Math.exp(-tt * 9)))) * Math.exp(-tt * (2.6 + i * 0.7)) / (1 + i * 0.35); fl.p(noise(), 3000 + 9000 * clamp(tt / 0.12), 3); return (hp.p(s) * 0.17 + fl.bp * Math.exp(-tt * 18) * 0.30) * Math.min(1, tt / 0.003) * g; }, p); },
  shing2(t, g) { const fr = [1480, 2093, 2960, 4186, 5588], os = fr.map(() => new Osc()); voice(B.sfx, t, 1.8, tt => { let s = 0; for (let i = 0; i < 5; i++) s += os[i].sin(fr[i] * (1 - 0.018 * clamp(tt))) * Math.exp(-tt * (2.0 + i * 0.5)) / (1 + i * 0.3); return Math.tanh(s * 0.8) * 0.20 * g * Math.min(1, tt / 0.003); }); },
  boom(t, g, p = 0) { let ph = 0; const lp = new Biquad('lp', 420, 0.8); voice(B.sfx, t, 1.5, tt => { ph += (30 + 66 * Math.exp(-tt * 9)) / SR; return Math.tanh((Math.sin(TAU * ph) * Math.exp(-tt * 2.9) * 1.35 + lp.p(noise()) * Math.exp(-tt * 7) * 1.4) * 1.2) * 0.62 * g * Math.min(1, tt / 0.003); }, p); },
  whoosh(t, g, p = 0) { const fl = new SVF(); const len = 0.46; voice(B.sfx, t - 0.14, len, tt => { const k = tt / len; fl.p(noise(), 350 + 3600 * Math.pow(Math.sin(Math.PI * k), 2), 1.7); return fl.bp * Math.pow(Math.sin(Math.PI * k), 2.2) * 0.80 * g; }, tt => clamp(p * 1.4 - p * 2.2 * (tt / len), -0.95, 0.95)); },
  pass(t, g, p = 0) { const fl = new SVF(), o = new Osc(); const len = 0.8; voice(B.sfx, t - 0.35, len, tt => { const k = tt / len, e = Math.exp(-Math.pow((k - 0.44) / 0.17, 2)); fl.p(noise(), 500 + 2100 * e, 1.3); const f = 190 * (1 + 0.30 * -Math.tanh((k - 0.44) * 14)); return (fl.bp * 0.75 + o.saw(f) * 0.07) * e * 0.75 * g; }, tt => clamp((tt / len - 0.44) * -3.5 * (p >= 0 ? 1 : -1), -0.9, 0.9)); },
  click(t, g) { const bp = new Biquad('bp', 3100, 3.5); voice(B.sfx, t, 0.35, tt => (bp.p(noise()) * Math.exp(-tt * 160) * 3.2 + Math.sin(TAU * 2480 * tt) * Math.exp(-tt * 28) * 0.33 + Math.sin(TAU * 1320 * tt) * Math.exp(-tt * 20) * 0.22 + (tt > 0.03 ? bp.p(noise()) * Math.exp(-(tt - 0.03) * 140) * 1.6 : 0)) * 0.75 * g); },
  chainsnap(t, g) { for (let i = 0; i < 9; i++) { const bp = new Biquad('bp', 2300 + i * 190, 6); voice(B.sfx, t + i * 0.019, 0.05, tt => bp.p(noise()) * Math.exp(-tt * 120) * 1.5 * g * (1 - i / 13), (i % 2) * 0.3 - 0.15); } },
  ratchet(t, g) { for (let i = 0; i < 14; i++) { const bp = new Biquad('bp', 4200, 7); voice(B.sfx, t + i * (0.022 + i * 0.0022), 0.03, tt => bp.p(noise()) * Math.exp(-tt * 190) * 1.5 * g, 0.2); } },
  creak(t, g, p = 0) { const o = new Osc(), bp = new Biquad('bp', 760, 5), bp2 = new Biquad('bp', 1900, 4); voice(B.sfx, t, 0.34, tt => { const rate = 55 + 40 * Math.sin(tt * 13) + 30 * noise() * 0.3; const x = o.sq(rate, 0.08) + noise() * 0.15; return (bp.p(x) + bp2.p(x) * 0.5) * Math.sin(Math.PI * tt / 0.34) * 0.55 * g; }, p); },
  thud(t, g, p = 0) { let ph = 0; const lp = new Biquad('lp', 900); voice(B.sfx, t, 0.42, tt => { ph += (55 + 70 * Math.exp(-tt * 40)) / SR; return (Math.sin(TAU * ph) * Math.exp(-tt * 11) + lp.p(noise()) * Math.exp(-tt * 28) * 0.8) * 0.75 * g; }, p); },
  plink(t, g, p, v) { const sets = [[[76, 0], [71, 0.14], [74, 0.28]], [[73, 0], [68, 0.14], [66, 0.30]], [[70, 0], [64, 0.12], [58, 0.28], [52, 0.44]]]; for (const [m, d] of sets[v || 0]) toy(t + d, m, 0.34, 1.25 * g); FX.click(t, 0.12); },
  crack(t, g) { for (let i = 0; i < 18; i++) { const hp = new Biquad('hp', 2400 + 4000 * rnd()); voice(B.sfx, t + Math.pow(rnd(), 1.4) * 0.2, 0.04, tt => hp.p(noise()) * Math.exp(-tt * 150) * 0.62 * g, rnd() * 1.4 - 0.7); } },
  shatter(t, g) { const hp = new Biquad('hp', 2100); voice(B.sfx, t, 0.6, tt => hp.p(noise()) * Math.exp(-tt * 8.5) * 0.62 * g); for (let i = 0; i < 90; i++) { const f = 1800 + 8200 * rnd(), d = Math.pow(rnd(), 1.7) * 0.85, a = 0.03 + rnd() * 0.11; voice(B.sfx, t + d, 0.22, tt => Math.sin(TAU * f * tt) * Math.exp(-tt * (22 + rnd() * 3)) * a * g, rnd() * 1.8 - 0.9); } FX.boom(t, 0.85 * g); },
  boing(t, g, p = 0) { const o = new Osc(0); voice(B.sfx, t, 0.4, tt => o.sin(240 + 150 * Math.sin(TAU * 8.5 * tt) * Math.exp(-tt * 4) + 80 * tt) * Math.exp(-tt * 7) * Math.min(1, tt / 0.008) * 0.26 * g, p); },
  crash(t, g) { FX.thud(t, 1.1 * g); FX.boom(t, 0.8 * g); const bp = new Biquad('bp', 1300, 0.8); voice(B.sfx, t, 0.5, tt => bp.p(noise()) * Math.exp(-tt * 9) * 1.0 * g); for (const [f, d] of [[412, 0], [655, 0.02], [987, 0.07], [533, 0.13], [1420, 0.19], [770, 0.27]]) { const o = [new Osc(), new Osc()]; voice(B.sfx, t + d, 0.5, tt => (o[0].sin(f) + o[1].sin(f * 2.76) * 0.5) * Math.exp(-tt * 11) * 0.16 * g, rnd() - 0.5); } },
  clatter(t, g, p = 0) { for (let i = 0; i < 9; i++) { const f = 500 + rnd() * 2200; voice(B.sfx, t + i * 0.055 * (1 + i * 0.12), 0.16, tt => (Math.sin(TAU * f * tt) + Math.sin(TAU * f * 2.41 * tt) * 0.6 + noise() * 0.3 * Math.exp(-tt * 90)) * Math.exp(-tt * 38) * 0.20 * g * (1 - i / 12), p + rnd() * 0.4 - 0.2); } },
  splash(t, g) { const fl = new SVF(), hp = new Biquad('hp', 2800); voice(B.sfx, t, 0.9, tt => { fl.p(noise(), 600 + 5200 * Math.exp(-tt * 5.5), 0.8); return (fl.lp * Math.exp(-tt * 5.2) * 0.85 + hp.p(noise()) * Math.exp(-tt * 3.8) * 0.24) * Math.min(1, tt / 0.008) * g; }); for (let i = 0; i < 26; i++) { const f0 = 500 + 1500 * rnd(); let ph = 0; voice(B.sfx, t + 0.05 + rnd() * 0.55, 0.06, tt => { ph += (f0 * (1 + tt * 14)) / SR; return Math.sin(TAU * ph) * Math.sin(Math.PI * tt / 0.06) * 0.075 * g; }, rnd() * 1.6 - 0.8); } },
  thunder(t, g, p = 0) { const lp = new Biquad('lp', 190, 0.8), lp2 = new Biquad('lp', 520, 0.7); let m = 0.6, mt = 0.6; voice(B.sfx, t, 2.6, (tt, i) => { if (i % 2400 === 0) mt = 0.35 + rnd() * 0.9; m += (mt - m) * 0.0016; return (lp.p(noise()) * 2.4 + lp2.p(noise()) * 0.55 * Math.exp(-tt * 3)) * m * Math.min(1, tt / 0.05) * Math.exp(-tt * 1.35) * 0.66 * g; }, p); },
  thunderclap(t, g) { const hp = new Biquad('hp', 900); voice(B.sfx, t, 0.3, tt => hp.p(noise()) * Math.exp(-tt * 15) * 0.75 * g); FX.thunder(t + 0.03, 1.1 * g); },
  cloth(t, g) { const bp = new Biquad('bp', 1500, 0.9); voice(B.sfx, t, 0.55, tt => bp.p(noise()) * (0.35 + 0.65 * Math.abs(Math.sin(tt * 23))) * Math.sin(Math.PI * tt / 0.55) * 0.55 * g, -0.2); },
  snap(t, g) { const bp = new Biquad('bp', 2100, 1.1); voice(B.sfx, t, 0.2, tt => bp.p(noise()) * Math.exp(-tt * 42) * 2.1 * g); const bp2 = new Biquad('bp', 700, 1.0); voice(B.sfx, t + 0.045, 0.5, tt => bp2.p(noise()) * (0.4 + 0.6 * Math.abs(Math.sin(tt * 44))) * Math.exp(-tt * 6.5) * 1.0 * g, -0.35); },
  shimmer(t, g) { [76, 83, 88, 95, 100].forEach((m, i) => { const o = new Osc(); voice(B.sfx, t + i * 0.07, 1.6, tt => o.sin(mtof(m)) * Math.exp(-tt * 2.7) * Math.min(1, tt / 0.01) * 0.045 * g, (i - 2) * 0.35); }); },
  hum(t, g, p, len = 1.5) { const o = new Osc(), o2 = new Osc(), fl = new SVF(); voice(B.sfx, t, len, tt => { const k = tt / len; fl.p(o.saw(58) + o2.saw(87.3) * 0.5, 180 + 700 * k, 3); return (fl.lp * 0.20 + noise() * 0.014) * Math.min(1, tt / 0.3) * (1 - Math.pow(k, 6)) * g; }, tt => -0.7 + 0.9 * clamp(tt / len)); },
  gleam(t, g, p = 0) { const fl = new SVF(); voice(B.sfx, t, 0.55, tt => { const k = tt / 0.55; fl.p(noise(), 2500 + 8500 * k, 7); return fl.bp * Math.sin(Math.PI * k) * 0.20 * g + Math.sin(TAU * (4700 + 1800 * k) * tt) * Math.pow(Math.sin(Math.PI * k), 3) * 0.05 * g; }, tt => -0.5 + tt * 2); },
  slamhit(t, g) { FX.thud(t, 0.8 * g); const bp = new Biquad('bp', 2600, 0.8); voice(B.sfx, t, 0.2, tt => bp.p(noise()) * Math.exp(-tt * 30) * 0.8 * g); },
  wriggle(t, g, p = 0) { for (let i = 0; i < 5; i++) { const bp = new Biquad('bp', 700 + rnd() * 900, 5); let ph = 0; const f = 380 + rnd() * 420; voice(B.sfx, t + i * 0.052 + rnd() * 0.01, 0.06, tt => { ph += f * (1 + 6 * tt) / SR; return (bp.p(noise()) * 1.4 + Math.sin(TAU * ph) * 0.22) * Math.sin(Math.PI * tt / 0.06) * 0.58 * g; }, p); } },
  beep(t, g, p, go) { const f = go ? 1318.5 : 659.25, o = new Osc(0), o2 = new Osc(0); voice(B.sfx, t, go ? 0.5 : 0.17, tt => (o.sq(f, 0.5) * 0.5 + o2.sin(f * 2)) * env(tt, 0.004, 0.04, 0.8, 0.04, go ? 0.42 : 0.12) * 0.13 * g); },
  sparks(t, g, p = 0, len = 1.0) { const hp = new Biquad('hp', 4200); let a = 0; voice(B.sfx, t, len, tt => { if (rnd() < 0.006) a = 0.5 + rnd(); a *= 0.992; return hp.p(noise()) * (a + 0.08) * Math.min(1, tt / 0.04) * Math.min(1, (len - tt) / 0.2) * 0.30 * g; }, tt => p + 0.3 * Math.sin(tt * 17)); },
  grind(t, g, p, len = 1.2) { const bp = new Biquad('bp', 3300, 9), bp2 = new Biquad('bp', 5100, 12), o = new Osc(); voice(B.sfx, t, len, tt => { const x = noise(); return (bp.p(x) * 0.9 + bp2.p(x) * 0.6) * (0.7 + 0.3 * o.sq(37, 0.5)) * Math.min(1, tt / 0.05) * Math.min(1, (len - tt) / 0.25) * 0.42 * g; }, 0.1); },
  skid(t, g, p = 0, len = 2.0) { const bp = new Biquad('bp', 1500, 2.2), o = new Osc(), o2 = new Osc(); let j = 0; voice(B.sfx, t, len, (tt, i) => { if (i % 400 === 0) j += (noise() * 38 - j * 0.4); const k = tt / len; const f = 1040 + j - 180 * k; const sq = (o.saw(f) * 0.5 + o2.saw(f * 1.503) * 0.28); return (bp.p(noise()) * 0.95 + sq * 0.13) * Math.min(1, tt / 0.06) * Math.min(1, (len - tt) / 0.35) * (0.8 + 0.2 * Math.sin(tt * 31)) * 0.46 * g; }, p); },
  slowmo(t, g, p, len = 1.5) { const fl = new SVF(); voice(B.sfx, t, len, tt => { const k = tt / len; fl.p(noise(), 900 - 650 * k, 4); return fl.lp * Math.sin(Math.PI * k) * 0.16 * g; }); const o = new Osc(); voice(B.sfx, t, len, tt => o.sin(220 * Math.pow(0.42, tt / len)) * Math.sin(Math.PI * tt / len) * 0.07 * g); },
  flashhit(t, g) { FX.revcym(t - 0.22, 0.42 * g, 0, 0.22); taiko(t, 0.8 * g); const bp = new Biquad('bp', 1800, 0.7); voice(B.sfx, t, 0.25, tt => bp.p(noise()) * Math.exp(-tt * 20) * 0.7 * g); },
  ignite(t, g) { const fl = new SVF(); voice(B.sfx, t, 0.75, tt => { const k = tt / 0.75; fl.p(noise(), 160 + 4200 * k * k, 1.4); return fl.lp * (0.3 + k) * Math.min(1, tt / 0.02) * 0.62 * g; }); FX.boom(t, 0.7 * g); },
  auraroar(t, g, p, len = 2) { const fl = new SVF(), fl2 = new SVF(); let m = 1, mt = 1; voice(B.sfx, t, len, (tt, i) => { if (i % 700 === 0) mt = 0.4 + rnd(); m += (mt - m) * 0.006; fl.p(noise(), 430 + 220 * Math.sin(tt * 8.3), 1.2); fl2.p(noise(), 110, 1.1); return (fl.bp * 0.42 + fl2.lp * 0.80) * m * Math.min(1, tt / 0.25) * Math.min(1, (len - tt) / (len > 4 ? 2.4 : 0.05)) * 0.34 * g; }, tt => 0.25 * Math.sin(tt * 3.1)); },
  squawk(t, g, p = 0, kind = 'battle') {
    if (kind === 'falcon') { for (let r = 0; r < 3; r++) squawkVoice(t + r * 0.115, 0.10, [[0, 1750], [0.4, 2250], [1, 1480]], g * 0.9, p, [2100, 3300, 5200], 0.25); return; }
    if (kind === 'yelp') { squawkVoice(t, 0.30, [[0, 390], [0.35, 760], [1, 330]], g, p, [900, 1750, 3000], 0.6); return; }
    // the battle cry: three throats, a rising yell with a gravel edge
    squawkVoice(t, 1.25, [[0, 250], [0.09, 540], [0.22, 505], [0.62, 585], [1, 300]], g * 1.0, -0.12, [860, 1520, 2750], 1.0);
    squawkVoice(t + 0.012, 1.18, [[0, 188], [0.1, 404], [0.25, 380], [0.6, 440], [1, 226]], g * 0.72, 0.22, [690, 1240, 2380], 0.9);
    squawkVoice(t + 0.028, 0.95, [[0, 500], [0.1, 1075], [0.3, 1000], [0.65, 1170], [1, 640]], g * 0.30, 0.0, [1300, 2500, 3900], 0.7);
  },
  pant(t, g, p = 0) { for (let i = 0; i < 2; i++) { const bp = new Biquad('bp', i ? 900 : 1500, 1.6); voice(B.sfx, t + i * 0.24, 0.21, tt => bp.p(noise()) * Math.sin(Math.PI * tt / 0.21) * (i ? 0.30 : 0.40) * g, p); } },
  cricket(t, g) { for (let c = 0; c < 5; c++) for (let i = 0; i < 4; i++) voice(B.sfx, t + c * 0.52 + i * 0.034, 0.024, tt => Math.sin(TAU * 4350 * tt) * Math.sin(Math.PI * tt / 0.024) * 0.050 * g, 0.55 - c * 0.04); },
  unroll(t, g, p = 0) { const fl = new SVF(); voice(B.sfx, t, 0.42, tt => { const k = tt / 0.42; fl.p(noise(), 240 + 900 * k, 5); return fl.bp * (0.55 + 0.45 * Math.sin(TAU * 24 * tt * (1 + k))) * Math.sin(Math.PI * k) * 0.85 * g; }, p); let ph = 0; voice(B.sfx, t + 0.36, 0.25, tt => { ph += (130 - 280 * tt) / SR; return Math.sin(TAU * ph) * Math.exp(-tt * 14) * 0.65 * g; }, p); },
  flop(t, g, p = 0, i = 0) { const lp = new Biquad('lp', 1700 + (i % 4) * 330, 1.4), bp = new Biquad('bp', 3200, 2); let ph = 0; voice(B.sfx, t, 0.19, tt => { ph += (125 - (i % 5) * 9 + 90 * Math.exp(-tt * 55)) / SR; return (lp.p(noise()) * Math.exp(-tt * 38) * 1.3 + Math.sin(TAU * ph) * Math.exp(-tt * 24) * 0.7 + bp.p(noise()) * Math.exp(-tt * 85) * 0.9) * 0.78 * g; }, p); voice(B.sfx, t + 0.085, 0.07, tt => bp.p(noise()) * Math.exp(-tt * 60) * 0.55 * g, p); },
  slurp(t, g) { const fl = new SVF(); voice(B.sfx, t, 0.30, tt => { const k = tt / 0.30; fl.p(noise(), 500 + 3300 * k * k, 6.5); return fl.bp * (0.45 + 0.55 * Math.abs(Math.sin(TAU * 21 * tt))) * Math.min(1, tt / 0.015) * (k > 0.9 ? (1 - k) * 10 : 1) * 0.85 * g; }); },
  gulp(t, g) { let ph = 0; voice(B.sfx, t, 0.34, tt => { const f = tt < 0.11 ? 310 - 2100 * tt : 80 + 760 * Math.pow(Math.max(0, tt - 0.11), 0.9); ph += Math.max(60, f) / SR; return Math.sin(TAU * ph + 0.5 * Math.sin(TAU * ph * 2)) * (tt < 0.11 ? Math.sin(Math.PI * tt / 0.12) : Math.exp(-(tt - 0.11) * 13)) * 0.75 * g; }); FX.thud(t + 0.115, 0.32 * g); },
  ding(t, g) { [90, 97, 102].forEach((m, i) => { const o = new Osc(); voice(B.sfx, t + i * 0.012, 0.8, tt => o.sin(mtof(m)) * Math.exp(-tt * 6) * Math.min(1, tt / 0.002) * 0.07 * g, (i - 1) * 0.3); }); }
};
function squawkVoice(t, len, pitch, g, pan, formants, rough) {
  const o = new Osc(), o2 = new Osc(), bps = formants.map((f, i) => new Biquad('bp', f, [4.5, 5.5, 7][i]));
  const at = k => { for (let i = 1; i < pitch.length; i++) if (k <= pitch[i][0]) { const [a, va] = pitch[i - 1], [b, vb] = pitch[i]; return lerp(va, vb, (k - a) / (b - a)); } return pitch[pitch.length - 1][1]; };
  let jit = 0;
  voice(B.sfx, t, len, (tt, i) => {
    const k = tt / len; if (i % 160 === 0) jit = noise() * 0.035 * rough;
    const f = at(k) * (1 + jit + 0.018 * Math.sin(TAU * 11 * tt));
    const rasp = 1 - 0.45 * rough * (0.5 + 0.5 * Math.sign(Math.sin(TAU * 62 * tt + 2 * Math.sin(TAU * 7 * tt))));
    const x = Math.tanh((o.saw(f) * 0.9 + o2.sq(f * 0.5, 0.35) * 0.35 * rough + noise() * 0.22) * 1.7) * rasp;
    const y = bps[0].p(x) * 1.0 + bps[1].p(x) * 0.8 + bps[2].p(x) * 0.5;
    return Math.tanh(y * 2.6) * Math.min(1, tt / 0.018) * Math.min(1, (len - tt) / (len * 0.28)) * 0.40 * g;
  }, pan);
}

// ============================ THE SCORE ============================
// helpers in beats
const each = (a, b, step, fn) => { let i = 0; for (let x = a; x < b - 1e-6; x += step, i++) fn(x, i); };
const EM = { Em: [40, [52, 55, 59, 64]], C: [36, [48, 52, 55, 60]], G: [43, [50, 55, 59, 62]], D: [38, [50, 54, 57, 62]], Am: [45, [52, 57, 60, 64]], Bm: [35, [47, 50, 54, 59]], B: [35, [47, 51, 54, 59]], F: [41, [53, 57, 60, 65]] };
// original hero theme: eight bars, [beat offset, midi, length in beats]
const THEME = [
  // bar 1  Em
  [0, 71, 1.5], [1.5, 76, 0.5], [2, 78, 1], [3, 79, 1],
  // bar 2  C
  [4, 76, 1.5], [5.5, 79, 0.5], [6, 84, 1.25], [7.25, 83, 0.75],
  // bar 3  G
  [8, 83, 0.75], [8.75, 81, 0.75], [9.5, 79, 0.5], [10, 74, 1.5], [11.5, 76, 0.5],
  // bar 4  D
  [12, 78, 0.5], [12.5, 81, 0.5], [13, 86, 1.75], [14.75, 84, 0.25], [15, 83, 1],
  // bar 5  Em
  [16, 88, 2], [18, 83, 1], [19, 79, 1],
  // bar 6  C
  [20, 79, 0.5], [20.5, 81, 0.5], [21, 83, 1], [22, 84, 1], [23, 88, 1],
  // bar 7  Am
  [24, 88, 1.5], [25.5, 86, 0.5], [26, 84, 1], [27, 81, 1],
  // bar 8  B
  [28, 83, 1], [29, 87, 1], [30, 90, 2]
];
function theme(startBeat, from, to, transpose = 0, g = 1, o = {}) {
  for (const [off, m, len] of THEME) { if (off < from || off >= to) continue; const t = startBeat + off - from; lead(bt(t), m + transpose - 12, bt(len) * 0.94, g); if (o.octave) lead(bt(t), m + transpose, bt(len) * 0.94, g * 0.42, { pan: -0.25 }); if (o.brass) brass(bt(t), [m + transpose - 24], bt(len) * 0.9, 0.9 * o.brass); }
}
// full anime-rock band over a chord, in beats
function band(b0, chord, beats, o = {}) {
  const [root, voicing] = EM[chord]; const tr = o.tr || 0; const r = root + tr;
  const style = o.style || 'drive';
  if (style === 'drive' || style === 'race' || style === 'climax') {
    each(0, beats, 0.5, (x, i) => {
      const beatPos = (b0 + x) % 4;
      hat(bt(b0 + x), i % 2 ? 0.75 : 1.0, style !== 'drive' && i % 2 === 1);
      if (style === 'drive') { if (beatPos % 4 === 0 || beatPos === 1.5 || beatPos === 2.5) kick(bt(b0 + x), 0.95); }
      else if (beatPos !== 1 && beatPos !== 3) kick(bt(b0 + x), beatPos % 1 === 0 ? 1.0 : 0.8);
      if (beatPos === 1 || beatPos === 3) snare(bt(b0 + x), 1.0);
      bass(bt(b0 + x), r + (style !== 'drive' && i % 4 === 3 ? 12 : 0), bt(0.44), i % 2 ? 0.86 : 1.0);
    });
    if (style === 'climax') each(0.25, beats, 0.5, x => kick(bt(b0 + x), 0.46));
    if (style === 'drive') { guitar(bt(b0), power(r + 12), bt(0.9), { gain: 0.95 }); each(1, beats, 0.5, (x, i) => guitar(bt(b0 + x), power(r + 12), bt(0.40), { mute: (i % 3) !== 2, gain: (i % 3) !== 2 ? 1.15 : 0.82 })); }
    else if (style === 'race') each(0, beats, 1, x => { guitar(bt(b0 + x), power(r + 12), bt(0.46), { mute: true, gain: 1.25 }); guitar(bt(b0 + x + 0.5), power(r + 12), bt(0.24), { mute: true, gain: 1.0 }); guitar(bt(b0 + x + 0.75), power(r + 12), bt(0.24), { mute: true, gain: 1.0 }); });
    else { guitar(bt(b0), [...power(r + 12), r + 31], bt(Math.min(beats, 1.9)), { gain: 0.9 }); each(2, beats, 0.5, x => guitar(bt(b0 + x), power(r + 12), bt(0.46), { gain: 0.72 })); }
    strings(bt(b0), voicing.map(m => m + 12 + tr), bt(beats) - 0.02, o.str === undefined ? 0.85 : o.str, { attack: 0.05, release: 0.12 });
  }
  if (o.crash !== false) crash(bt(b0), o.crash || 0.8);
}
const hitAll = (beat, chord, g = 1, o = {}) => { const [r, v] = EM[chord]; const tr = o.tr || 0; taiko(bt(beat), g); kick(bt(beat), g); crash(bt(beat), 0.55 * g); brass(bt(beat), [r + 12 + tr, v[0] + tr, v[2] + tr, v[3] + 12 + tr], bt(o.len || 0.75), 1.05 * g); bass(bt(beat), r + tr, bt(o.len || 0.75), g); guitar(bt(beat), power(r + 12 + tr), bt(o.len || 0.75), { gain: 0.8 * g }); };
const snareRoll = (a, b, from = 0.5, to = 0.125, g0 = 0.25, g1 = 0.9) => { let x = a; while (x < b - 1e-6) { const k = (x - a) / (b - a); snare(bt(x), lerp(g0, g1, k), (Math.round(x * 8) % 2) * 0.16 - 0.08); x += lerp(from, to, k); } };

// ---- 0-8 cold open ----
drone(0, bt(8), 28, 1.0, { attack: 0.9, cut: 190 });
strings(bt(2), [64, 71, 76], bt(1.2), 0.9, { attack: 0.01, trem: 13 }); brass(bt(2), [40, 52], bt(0.9), 0.8);
each(3, 8, 0.5, (x, i) => { strings(bt(x), [40, 47], bt(0.3), 0.55 + i * 0.07, { attack: 0.008, release: 0.05, bright: 1700 }); });
taiko(bt(4), 1.0); taiko(bt(6), 0.7); taiko(bt(7), 0.75); taiko(bt(7.5), 0.9);
riser(bt(5.5), bt(8), 0.62, { from: 52, span: 19 });
// ---- 8-16 lore cards ----
hitAll(8, 'Em', 0.95, { len: 1.3 }); hitAll(10, 'C', 0.95, { len: 1.3 }); hitAll(12, 'Am', 0.9, { len: 1.2 }); hitAll(14, 'B', 1.25, { len: 0.95 }); crash(bt(14), 1.0, 0.2); FX.boom(bt(14), 0.8); hitAll(15, 'B', 0.75, { len: 0.8 });
each(8, 16, 0.5, (x, i) => strings(bt(x), [i % 4 === 3 ? 55 : 52], bt(0.28), 0.62, { attack: 0.008, release: 0.05, bright: 2000 }));
drone(bt(8), bt(15.9), 28, 0.65, { attack: 0.05 });
// ---- 16-22 the pathetic drawings: the band is gone ----
each(16.5, 21.5, 0.5, (x, i) => voice(B.keys, bt(x), 0.02, tt => Math.sin(TAU * (i % 2 ? 2100 : 2600) * tt) * Math.exp(-tt * 300) * 0.07, i % 2 ? 0.3 : -0.3));
strings(bt(20.5), [47, 51, 54], bt(1.5), 0.95, { swell: true, trem: 11, attack: 0.05, release: 0.03 });
// ---- 22-24 shatter ----
hitAll(22, 'Em', 1.15, { len: 0.9 }); guitar(bt(22), [40, 47, 52, 59], bt(1.9), { gain: 0.8 }); strings(bt(22), [64, 67, 71, 76], bt(1.9), 1.1, { attack: 0.02 });
hitAll(23, 'D', 0.9, { len: 0.9 }); snareRoll(23, 24, 0.25, 0.125, 0.4, 0.95);
// ---- 24-28 wobbling ----
crash(bt(24), 0.5);
each(24, 28, 1, (x, i) => { kick(bt(x), i % 2 ? 0.55 : 0.8); hat(bt(x + 0.5), 0.7); if (i % 2) snare(bt(x), 0.5); });
each(24, 28, 0.5, (x, i) => { guitar(bt(x), power(40), bt(0.3), { mute: true, gain: 0.58 }); bass(bt(x), i % 4 === 2 ? 47 : 40, bt(0.35), 0.62); });
[[24, 64], [24.5, 67], [25, 71], [25.5, 70], [26, 71], [26.5, 67], [27, 72], [27.5, 66]].forEach(([x, m], i) => pluck(bt(x), m + 12, 0.34, 0.75, i % 2 ? 0.3 : -0.3, { decay: 0.5, damp: 0.4, bright: 4200 }));
strings(bt(26), [71], bt(2), 0.6, { gliss: 3, trem: 9, attack: 0.3 });
// ---- 28-32 FALL ----
hitAll(30, 'Am', 1.2, { len: 0.7 }); braam(bt(30), 33, bt(1.3), 0.55);
// ---- 32-38 rain, second fall ----
drone(bt(32), bt(35), 28, 0.55, { attack: 0.1 });
each(32, 35, 0.5, (x, i) => pluck(bt(x), [64, 71, 76, 79, 76, 71][i % 6], 0.9, 0.95, (i % 3 - 1) * 0.4));
strings(bt(32), [52, 59, 64], bt(3), 0.9, { attack: 0.12 }); each(32, 35, 1, (x, i) => { kick(bt(x), 0.7); if (i % 2) snare(bt(x), 0.45); bass(bt(x), 40, bt(0.8), 0.7); });
hitAll(37, 'B', 1.15, { len: 0.7 }); braam(bt(37), 35, bt(0.9), 0.5);
// ---- 38-42 face down: the theme, alone ----
drone(bt(38), bt(42), 36, 0.5, { attack: 0.4, cut: 200 });
[[38.5, 71, 1.0], [39.5, 76, 0.5], [40, 78, 0.6], [40.75, 79, 1.2]].forEach(([x, m]) => { pluck(bt(x), m - 12, 1.9, 1.35, 0.05, { decay: 2.6, damp: 0.56 }); pluck(bt(x), m, 1.2, 0.35, -0.2, { decay: 1.4 }); });
strings(bt(38), [48, 55, 60], bt(2.4), 0.5, { attack: 0.5 }); strings(bt(40.5), [55, 60, 64], bt(1.5), 0.85, { swell: true, attack: 0.1 });
// ---- 42-48 getting up ----
taiko(bt(42), 1.2); FX.thud(bt(42), 0.5); bass(bt(42), 38, bt(1.8), 0.85);
strings(bt(42), [50, 54, 57, 62], bt(2), 0.95, { swell: true }); brass(bt(43), [38, 50, 57], bt(1), 0.55, { bloom: 0.35 });
taiko(bt(43), 0.55); taiko(bt(43.5), 0.65);
strings(bt(44), [47, 54, 59, 63, 66], bt(2), 1.1, { swell: true, trem: 12 }); choir(bt(44), [59, 63, 66], bt(2), 0.6, { attack: 0.7 });
snareRoll(44, 46, 0.5, 0.125, 0.14, 0.75); riser(bt(44.5), bt(46), 0.45, { from: 59, span: 12 });
hitAll(46, 'B', 1.2, { len: 1.9 }); crash(bt(46), 0.9, 0.3);
each(46.5, 47.5, 0.5, x => tom(bt(x), 150 - (x - 46.5) * 40, 0.8)); [47.5, 47.625, 47.75, 47.875].forEach((x, i) => tom(bt(x), 120 - i * 14, 0.85, i * 0.2 - 0.3));
// ---- 48-64 the opening theme ----
band(48, 'Em', 4); band(52, 'C', 4); band(56, 'G', 4, { crash: 1.0 }); band(60, 'D', 3.5);
theme(48, 0, 15.5, 0, 1.0);
brass(bt(48), [52, 59, 64], bt(0.7), 0.7); brass(bt(52), [48, 55, 60], bt(0.7), 0.65); choir(bt(56), [62, 67, 71], bt(4), 0.62); choir(bt(60), [62, 66, 69], bt(3.4), 0.7);
snareRoll(62.5, 63.5, 0.25, 0.125, 0.4, 0.9); crash(bt(63.5), 0.7); hitAll(63.5, 'D', 0.8, { len: 0.4 });
// ---- 64-84 the rival ----
braam(bt(64), 28, bt(3.6), 1.0); drone(bt(64), bt(72), 28, 0.9, { attack: 0.1, cut: 170 }); drone(bt(66), bt(72), 34, 0.45, { attack: 1.0 });
each(64, 72, 2, x => taiko(bt(x), 0.62));
each(64.5, 72, 0.25, (x, i) => voice(B.keys, bt(x), 0.03, tt => Math.sin(TAU * (i % 4 === 0 ? 5200 : 3900) * tt) * Math.exp(-tt * 240) * (i % 4 === 0 ? 0.075 : 0.038), i % 2 ? 0.45 : -0.45));
strings(bt(67), [76, 77, 82], bt(5), 0.62, { swell: true, trem: 14 });
hitAll(72, 'Em', 1.35, { len: 1.0 }); braam(bt(72), 28, bt(3.0), 1.15);
[[72, 40], [73.5, 40], [74, 41], [75, 40], [76, 40], [77.5, 40], [78, 46], [79, 41]].forEach(([x, m]) => { guitar(bt(x), power(m), bt(0.85), { gain: 1.1 }); bass(bt(x), m - 12, bt(0.8), 0.95); taiko(bt(x), 0.7); });
each(72.5, 80, 0.5, (x, i) => { if (![73.5, 74, 75, 76, 77.5, 78, 79].includes(x)) guitar(bt(x), [40, 47], bt(0.28), { mute: true, gain: 0.9 }); });
each(72, 80, 2, x => { kick(bt(x), 0.9); snare(bt(x + 1), 0.7); });
choir(bt(72), [52, 53, 59], bt(3.8), 0.7, { vowel: 'oh' }); choir(bt(76), [52, 58, 64], bt(3.8), 0.75, { vowel: 'oh' });
brass(bt(76), [40, 52, 53], bt(1.6), 0.8); brass(bt(78), [46, 58], bt(1.6), 0.8);
hitAll(81, 'Em', 1.2, { len: 0.9 }); braam(bt(80), 28, bt(1.4), 0.7); brass(bt(80), [52, 58], bt(0.8), 0.7);
snareRoll(82, 84, 0.5, 0.125, 0.2, 0.85); riser(bt(82), bt(84), 0.38, { from: 52, span: 12 }); each(82, 84, 0.5, (x, i) => tom(bt(x), 95 + i * 14, 0.6, i * 0.2 - 0.3));
// ---- 84-88 countdown ----
drone(bt(84), bt(87.9), 28, 0.7, { attack: 0.1 });
each(84, 85, 0.5, x => taiko(bt(x), 0.5)); [85, 86, 87].forEach((x, i) => { taiko(bt(x), 0.85 + i * 0.1); kick(bt(x), 0.9); strings(bt(x), [40 + i, 47 + i, 52 + i], bt(0.55), 1.0, { attack: 0.008 }); });
snareRoll(87, 88, 0.25, 0.0625, 0.3, 1.0); riser(bt(85), bt(88), 0.55, { from: 52, span: 24 });
// ---- 88-122 the descent ----
band(88, 'Em', 4, { style: 'race', crash: 1.1 }); FX.boom(bt(88), 0.7);
band(92, 'C', 2, { style: 'race', crash: 0.5 }); band(94, 'D', 2, { style: 'race', crash: false });
theme(96, 0, 6, 0, 1.0, { octave: true });
band(96, 'Em', 4, { style: 'race' }); band(100, 'C', 2, { style: 'race', crash: false });
brass(bt(88), [40, 52, 59, 64], bt(0.6), 0.95); [88.75, 89.5, 91, 92, 92.75, 93.5, 95, 95.5].forEach(x => brass(bt(x), x < 92 ? [52, 59, 64] : x < 95 ? [48, 55, 60] : [50, 57, 62], bt(0.32), 0.75));
each(88, 102, 0.25, (x, i) => strings(bt(x), [[64, 67, 71, 76][i % 4] + (x >= 92 && x < 94 ? -4 : x >= 94 && x < 96 ? -2 : x >= 100 ? -4 : 0)], bt(0.2), 0.52, { attack: 0.004, release: 0.03, bright: 4600 }));
// guitar run over the sparks
band(102, 'D', 4, { style: 'race', crash: 0.9, str: 0.5 });
[76, 79, 81, 83, 86, 83, 81, 83, 88, 86, 83, 81, 83, 86, 88, 91].forEach((m, i) => lead(bt(102 + i * 0.25), m - 12, bt(0.23), 0.9, { slide: i % 4 === 0 ? 2 : 0 }));
// hairpin: half time, toms, long bend
hitAll(106, 'C', 1.0, { len: 1.6 }); hitAll(110, 'D', 0.95, { len: 1.6 });
each(106, 114, 1, (x, i) => { kick(bt(x), 0.9); if (i % 2) snare(bt(x), 0.9); ride(bt(x), 0.9); ride(bt(x + 0.5), 0.6); });
[107.5, 107.75, 109.5, 109.75, 111.5, 111.75, 113, 113.25, 113.5, 113.75].forEach((x, i) => tom(bt(x), 130 - (i % 4) * 18, 0.85, (i % 4) * 0.28 - 0.42));
each(106, 110, 0.5, x => bass(bt(x), 36, bt(0.42), 0.9)); each(110, 114, 0.5, x => bass(bt(x), 38, bt(0.42), 0.9));
lead(bt(106), 76, bt(3.7), 0.85, { slide: 5 }); lead(bt(110), 78, bt(1.8), 0.85, { slide: 3 }); lead(bt(112), 81, bt(1.8), 0.9, { slide: 2 });
strings(bt(106), [60, 64, 67, 72], bt(4), 0.9); strings(bt(110), [62, 66, 69, 74], bt(4), 0.95);
// the Peregrine pulls away
each(114, 118, 0.5, (x, i) => { hat(bt(x), 0.8); bass(bt(x), i % 4 < 2 ? 40 : 41, bt(0.3), 0.85); if (i % 2 === 0) kick(bt(x), 0.75); });
brass(bt(114), [52, 53], bt(1.7), 0.8, { bloom: 0.25 }); brass(bt(116), [46, 58], bt(1.7), 0.85, { bloom: 0.25 }); strings(bt(114), [76, 77], bt(4), 0.55, { trem: 14 }); snare(bt(115), 0.6); snare(bt(117), 0.6);
// ramp
band(118, 'B', 2, { style: 'race', crash: 0.7, str: 0.4 });
each(120, 122, 0.25, (x, i) => { kick(bt(x), 0.7); bass(bt(x), 35 + Math.floor(i / 2), bt(0.2), 0.8); guitar(bt(x), power(47 + Math.floor(i / 2)), bt(0.22), { mute: true, gain: 0.95 }); });
snareRoll(118.5, 122, 0.5, 0.0625, 0.18, 0.95); riser(bt(118), bt(122), 0.8, { from: 47, span: 24 }); strings(bt(118), [59, 66, 71], bt(4), 0.9, { gliss: 5, trem: 15, swell: true });
// ---- 122-128 airborne ----
FX.boom(bt(122), 0.8); crash(bt(122), 1.1, 0, 3.0); taiko(bt(122), 1.0);
strings(bt(122), [48, 55, 60, 64, 67, 72], bt(4), 1.25, { attack: 0.15, release: 0.5 }); choir(bt(122), [60, 64, 67], bt(4), 1.15, { attack: 0.25 }); brass(bt(122), [36, 48, 55], bt(3.6), 0.7, { bloom: 0.6 });
choir(bt(126), [62, 66, 69], bt(2.1), 1.0, { attack: 0.15 }); strings(bt(126), [50, 57, 62, 66, 74], bt(2.1), 1.0, { attack: 0.15, release: 0.9 }); bass(bt(122), 36, bt(3.9), 0.6); bass(bt(126), 38, bt(1.9), 0.5);
lead(bt(122), 71, bt(1.9), 0.55); lead(bt(124), 76, bt(3.4), 0.5);
// ---- 128-134 falling short ----
drone(bt(128), bt(134), 33, 0.45, { attack: 0.8, cut: 170 });
[[129, 69, 0], [130, 64, -0.2], [131, 72, 0.15], [132.5, 71, 0], [133.25, 64, -0.1]].forEach(([x, m, p]) => { pluck(bt(x), m, 2.4, 1.05, p, { decay: 3.0, damp: 0.58 }); });
strings(bt(130), [57, 60, 64], bt(4), 0.45, { attack: 1.2 });
// ---- 134-138 every fall ----
[[134, 'C'], [135, 'D'], [136, 'Em'], [137, 'B']].forEach(([x, c], i) => { const [r, v] = EM[c]; brass(bt(x), [r + 12, v[1], v[2]], bt(0.6), 0.55 + i * 0.13); strings(bt(x), v.map(m => m + 12), bt(0.85), 0.55 + i * 0.12, { attack: 0.01 }); kick(bt(x), 0.8); bass(bt(x), r, bt(0.7), 0.7 + i * 0.1); });
snareRoll(137, 138, 0.25, 0.125, 0.25, 0.7);
// ---- 138-142 ignition ----
drone(bt(138), bt(141.95), 35, 1.0, { attack: 0.25, cut: 300 });
strings(bt(138.5), [59, 66, 71, 78], bt(3.4), 1.05, { swell: true, trem: 15, attack: 0.05, release: 0.02 }); choir(bt(140), [59, 63, 66], bt(1.9), 1.0, { attack: 0.9 });
riser(bt(139), bt(142), 0.95, { from: 47, span: 31 }); snareRoll(140, 142, 0.25, 0.0625, 0.25, 1.0); each(140, 142, 0.25, (x, i) => tom(bt(x), 80 + i * 13, 0.35 + i * 0.07, (i % 4) * 0.3 - 0.45));
// ---- 144-160 KEY CHANGE: F# minor ----
FX.boom(bt(144), 0.7);
band(144, 'Em', 4, { tr: 2, style: 'climax', crash: 1.2 }); band(148, 'C', 4, { tr: 2, style: 'climax', crash: 0.9 }); band(152, 'G', 4, { tr: -10, style: 'climax', crash: 1.0 }); band(156, 'D', 4, { tr: 2, style: 'climax', crash: 0.8 });
theme(144, 0, 16, 2, 1.12, { octave: true, brass: 0.75 });
choir(bt(144), [66, 69, 73], bt(4), 1.1, { attack: 0.04 }); choir(bt(148), [62, 66, 69], bt(4), 1.0); choir(bt(152), [64, 69, 73], bt(4), 1.05); choir(bt(156), [64, 68, 71], bt(3.8), 1.1);
brass(bt(144), [42, 54, 61, 66], bt(1.4), 0.9); brass(bt(148), [38, 50, 57, 62], bt(1.0), 0.8); brass(bt(152), [45, 57, 64, 69], bt(1.0), 0.8); brass(bt(156), [40, 52, 59, 64], bt(1.0), 0.8);
snareRoll(158.5, 160, 0.25, 0.0625, 0.4, 1.0); [159, 159.25, 159.5, 159.75].forEach((x, i) => tom(bt(x), 170 - i * 28, 0.9, i * 0.3 - 0.45));
// ---- 160-176 title ----
hitAll(160, 'Em', 1.4, { tr: 2, len: 1.9 }); crash(bt(160), 1.2, 0.35, 3.2); FX.boom(bt(160), 0.9); braam(bt(160), 30, bt(2.4), 0.7);
each(160.375, 161.9, 0.1875, (x, i) => tom(bt(x), 190 - (i % 5) * 22, 0.55, ((i % 5) - 2) * 0.22));
hitAll(162, 'C', 1.05, { tr: 2, len: 1.7 }); hitAll(164, 'D', 1.0, { tr: 2, len: 1.7 });
hitAll(166, 'Em', 1.1, { tr: 2, len: 1.6 }); choir(bt(160), [66, 69, 73], bt(7.8), 0.95, { attack: 0.03 }); strings(bt(160), [66, 73, 78], bt(7.8), 0.95, { attack: 0.03 });
band(168, 'Am', 2, { tr: 2, style: 'climax', crash: 1.0 }); band(170, 'B', 2, { tr: 2, style: 'climax', crash: 0.6 });
theme(168, 24, 32, 2, 1.1, { octave: true, brass: 0.7 });
// triumphant major landing
{ const t = 176 - 4; const ch = [42, 54, 58, 61, 66, 70]; taiko(bt(t), 1.3); kick(bt(t), 1.1); crash(bt(t), 1.2, -0.2, 2.4); brass(bt(t), ch, bt(2.0), 1.1); guitar(bt(t), [42, 49, 54, 58], bt(2.1), { gain: 0.9 }); bass(bt(t), 30, bt(2.1), 1.0); strings(bt(t), [66, 70, 73, 78, 82], bt(2.4), 1.1, { attack: 0.02, release: 0.7 }); choir(bt(t), [66, 70, 73], bt(2.2), 1.0, { attack: 0.03 }); lead(bt(t), 78, bt(2.0), 0.9); }
hitAll(174.5, 'Em', 0.85, { tr: 2, len: 0.35 });
// ---- 176-189 aftermath, played completely straight ----
strings(bt(176.4), [50, 57, 62, 66], bt(5.4), 0.62, { attack: 1.1, release: 0.4 });
[[177, 81], [178.5, 78], [180, 74], [181, 76]].forEach(([x, m]) => pluck(bt(x), m, 1.6, 0.8, 0.15, { decay: 2.0, damp: 0.55 }));
each(182, 183, 0.25, (x, i) => pluck(bt(x), 54 + i, 0.2, 0.55, -0.2, { decay: 0.3 }));
each(183.2, 185.35, 0.5, (x, i) => { pluck(bt(x), [66, 73, 70, 73][i % 4], 0.35, 0.8, i % 2 ? 0.3 : -0.3, { decay: 0.45, damp: 0.42, bright: 3800 }); bass(bt(x), i % 2 ? 37 : 42, bt(0.3), 0.5); });
// the solemn chord under the revelation
strings(bt(185.4), [50, 57, 62, 66, 69], bt(3.5), 1.1, { attack: 0.18, release: 0.35 }); choir(bt(185.4), [62, 66, 69], bt(3.3), 0.78, { attack: 0.3 }); brass(bt(185.4), [38, 50, 57], bt(2.8), 0.62, { bloom: 0.5 }); taiko(bt(185.4), 0.85); bass(bt(185.4), 38, bt(3.3), 0.55);
// ---- final button ----
{ const t = 191.2; taiko(bt(t), 1.0); kick(bt(t), 0.9); brass(bt(t), [42, 54, 61, 66, 70], bt(0.42), 1.0); guitar(bt(t), [42, 49, 54], bt(0.4), { gain: 0.75 }); crash(bt(t), 0.45, 0, 0.7); bass(bt(t), 30, bt(0.45), 0.9); }

// sound-design events come straight from the picture's timeline
for (const [beat, type, gain, pan, extra] of TL.SFX) { const fn = FX[type]; if (!fn) { console.log('missing sfx', type); continue; } if (type === 'flop') fn(bt(beat), gain, pan || 0, extra || 0); else fn(bt(beat), gain === undefined ? 1 : gain, pan || 0, extra); }

// ---------- beds driven by what each shot is doing: wind, chain, freewheel, rain ----------
{
  const wind = new SVF(), wind2 = new SVF(), chain = new Biquad('bp', 2900, 3.0), rainHp = new Biquad('hp', 2600), rainHp2 = new Biquad('hp', 2600), rainBp = new Biquad('bp', 900, 0.6), tick = new Biquad('bp', 4600, 6), tick2 = new Biquad('bp', 3000, 5);
  let sWind = 0, sSpeed = 0, sRain = 0, sPedal = 0, sCoast = 0, phT = 0, phC = 0, tickE = 0, chainE = 0, drop = 0, dropF = 3000, dropPh = 0, dropPan = 0;
  const k = 1 - Math.exp(-1 / (SR * 0.018));
  for (let i = 0; i < N; i++) {
    const t = i / SR, S = TL.shotAt(t), bed = S.bed;
    let spd = bed.speed || 0;
    if (S.id === 'start') spd = Math.max(0, t - bt(88)) * 16;
    if (S.id === 'rwheel') spd = 3.2 * Math.max(0, 1 - (t - S.t0) / 1.35);
    if (S.id === 'finish') spd = 11 * Math.max(0, 1 - (t - S.t0) / 0.75);
    sWind += (((bed.wind || 0)) - sWind) * k; sSpeed += (spd - sSpeed) * k; sRain += ((bed.rain || 0) - sRain) * k; sPedal += ((bed.pedal ? 1 : 0) - sPedal) * k; sCoast += ((bed.coast ? 1 : 0) - sCoast) * k;
    let L = 0, R = 0;
    if (sWind > 0.005) { const gust = 1 + 0.28 * Math.sin(t * 5.1) + 0.18 * Math.sin(t * 12.7 + 1); const cut = 260 + sSpeed * 52 + 170 * Math.sin(t * 2.3); wind.p(noise(), cut, 0.9); wind2.p(noise(), cut * 1.13, 0.9); const a = Math.pow(sWind, 1.3) * 0.17 * gust; L += (wind.lp * 0.8 + wind.bp * 0.35) * a; R += (wind2.lp * 0.8 + wind2.bp * 0.35) * a; }
    const wheelRev = sSpeed / (TAU * 0.34);
    if (sCoast > 0.02 && sSpeed > 0.3) { phT += Math.min(78, wheelRev * 18) / SR; if (phT >= 1) { phT -= 1; tickE = 1; } tickE *= 0.9952; const v = (tick.p(noise() * tickE) * 2.1 + tick2.p(noise() * tickE) * 1.1) * 0.30 * sCoast; L += v * 0.72; R += v; } else tickE = 0;
    if (sPedal > 0.02 && sSpeed > 0.3) { const rate = Math.min(120, (wheelRev / 2.5) * 45 * 0.8); phC += rate / SR; if (phC >= 1) { phC -= 1; chainE = 1; } chainE *= 0.993; const v = chain.p(noise() * (chainE * 0.9 + 0.12)) * 0.15 * sPedal * Math.min(1, sSpeed / 5); const sw = 0.75 + 0.25 * Math.sin(TAU * (wheelRev / 2.5) * 2 * t); L += v * sw; R += v * sw * 0.8; }
    if (sRain > 0.01) { L += (rainHp.p(noise()) * 0.062 + rainBp.p(noise()) * 0.05) * sRain; R += (rainHp2.p(noise()) * 0.062) * sRain + rainBp.y1 * 0.03 * sRain; if (rnd() < 0.0016 * sRain) { drop = 0.35 + rnd() * 0.65; dropF = 1600 + rnd() * 3800; dropPan = rnd() * 2 - 1; } if (drop > 0.002) { drop *= 0.9955; dropPh += dropF / SR; const v = Math.sin(TAU * dropPh) * drop * 0.045 * sRain; L += v * (1 - dropPan * 0.7); R += v * (1 + dropPan * 0.7); } }
    B.amb[0][i] += L; B.amb[1][i] += R;
  }
}

// ============================ MIX ============================
function tone(b, fn) { for (let c = 0; c < 2; c++) { const f = fn(c); const a = b[c]; for (let i = 0; i < N; i++) a[i] = f(a[i], i); } }
// guitar amp: tight high-pass, hard drive, speaker cabinet
for (const [g, pan] of [[B.gtrL, -0.8], [B.gtrR, 0.8]]) {
  const h1 = new Biquad('hp', 95, 0.7), pre = new Biquad('peak', 820, 0.8, 5), c1 = new Biquad('lp', 4300, 0.85), c2 = new Biquad('lp', 5200, 0.6), c3 = new Biquad('hp', 105, 0.9), p1 = new Biquad('peak', 2300, 1.4, 3.5), p2 = new Biquad('peak', 430, 1.1, -4), thump = new Biquad('peak', 130, 1.2, 3);
  let envf = 0;
  for (let i = 0; i < N; i++) { const x = pre.p(h1.p(g[0][i])); envf = Math.max(Math.abs(x), envf * 0.9993); const gate = clamp((envf - 0.004) * 140); let y = Math.tanh(x * 17 + 0.16) - Math.tanh(0.16); y = Math.tanh(y * 2.2); y = thump.p(p2.p(p1.p(c3.p(c2.p(c1.p(y)))))) * gate * 0.255; const a = (pan + 1) * Math.PI / 4; g[0][i] = y * Math.cos(a) * 1.25; g[1][i] = y * Math.sin(a) * 1.25; }
}
// lead gets a ping-pong delay
{ const d = Math.round(bt(0.75) * SR); const L = B.lead[0], R = B.lead[1]; const wl = new Float32Array(N), wr = new Float32Array(N); for (let i = d; i < N; i++) { wl[i] = (R[i - d] + wr[i - d]) * 0.30; wr[i] = (L[i - d] + wl[i - d]) * 0.30; } for (let i = 0; i < N; i++) { L[i] += wl[i] * 0.7; R[i] += wr[i] * 0.7; } }
// tone shaping per bus
tone(B.bass, () => { const a = new Biquad('hp', 32), b = new Biquad('peak', 700, 1, 2.5), c = new Biquad('lp', 4200); return x => c.p(b.p(a.p(x))); });
tone(B.strings, () => { const a = new Biquad('hp', 90), b = new Biquad('hs', 5000, 0.7, 2); return x => b.p(a.p(x)); });
tone(B.brass, () => { const a = new Biquad('hp', 70), b = new Biquad('peak', 1500, 0.9, 2.5); return x => b.p(a.p(x)); });
tone(B.drums, () => { const a = new Biquad('hp', 28), b = new Biquad('peak', 62, 1.0, 2.0), c = new Biquad('hs', 7000, 0.7, 1.5); return x => c.p(b.p(a.p(x))); });
tone(B.amb, () => { const a = new Biquad('hp', 80); return x => a.p(x); });

// sidechain: bass and pads breathe with the kick
const duck = new Float32Array(N).fill(1);
for (const t of kickTimes) { const i0 = Math.round(t * SR); for (let i = 0; i < SR * 0.18; i++) { const k = i0 + i; if (k < 0 || k >= N) continue; const v = 1 - 0.42 * Math.exp(-i / (SR * 0.055)); if (v < duck[k]) duck[k] = v; } }
for (const b of [B.bass, B.strings, B.choir]) for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) b[c][i] *= duck[i];

// hard stops in the music (the picture cuts dead, so does the band); sound design carries through
const MUSIC = ['drums', 'bass', 'gtrL', 'gtrR', 'lead', 'strings', 'brass', 'choir', 'keys'];
function gate(buses, a, b, fadeOut = 0.012, floor = 0) { const i0 = Math.round(bt(a) * SR), i1 = Math.round(bt(b) * SR), f = Math.round(fadeOut * SR); for (const n of buses) for (let c = 0; c < 2; c++) for (let i = i0 - f; i < i1; i++) { if (i < 0 || i >= N) continue; const g = i < i0 ? lerp(floor, 1, (i0 - i) / f) : floor; B[n][c][i] *= g; } }
gate(MUSIC, 28, 29.995); gate(MUSIC, 35, 36.995); gate(['drums', 'bass', 'gtrL', 'gtrR', 'lead'], 63.97, 63.999);
gate(MUSIC, 189.15, 191.19, 0.12);

// reverb (Schroeder / Freeverb topology)
function freeverb(inL, inR, room, damp) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(x => Math.round(x * SR / 44100)), aps = [556, 441, 341, 225].map(x => Math.round(x * SR / 44100));
  const out = [new Float32Array(N), new Float32Array(N)];
  for (let c = 0; c < 2; c++) {
    const cs = combs.map(l => ({ b: new Float32Array(l + c * 23), i: 0, s: 0 })), as = aps.map(l => ({ b: new Float32Array(l + c * 23), i: 0 }));
    const src = c ? inR : inL, other = c ? inL : inR;
    for (let i = 0; i < N; i++) {
      const x = (src[i] * 0.85 + other[i] * 0.15) * 0.016; let y = 0;
      for (const m of cs) { const o = m.b[m.i]; m.s = o * (1 - damp) + m.s * damp; m.b[m.i] = x + m.s * room; m.i = (m.i + 1) % m.b.length; y += o; }
      for (const m of as) { const o = m.b[m.i]; const v = -y + o; m.b[m.i] = y + o * 0.5; m.i = (m.i + 1) % m.b.length; y = v; }
      out[c][i] = y;
    }
  }
  return out;
}
const LEVEL = { drums: 0.90, bass: 0.62, gtrL: 0.80, gtrR: 0.80, lead: 1.04, strings: 0.92, brass: 0.90, choir: 0.84, keys: 1.05, sfx: 0.86, amb: 0.78 };
const SEND = { drums: 0.10, bass: 0.0, gtrL: 0.09, gtrR: 0.09, lead: 0.24, strings: 0.42, brass: 0.34, choir: 0.55, keys: 0.45, sfx: 0.22, amb: 0.03 };
const mix = bus(), send = bus();
for (const n in B) for (let c = 0; c < 2; c++) { const a = B[n][c], g = LEVEL[n], s = SEND[n]; for (let i = 0; i < N; i++) { mix[c][i] += a[i] * g; send[c][i] += a[i] * g * s; } }
const rv = freeverb(send[0], send[1], 0.83, 0.34);
for (let c = 0; c < 2; c++) { const hp = new Biquad('hp', 210); for (let i = 0; i < N; i++) mix[c][i] += hp.p(rv[c][i]) * 2.5; }
// THE SILENT SCREAM: true digital silence from beat 142 until the drop on 144
{ const i0 = Math.round(bt(142) * SR), i1 = Math.round(bt(144) * SR) - 8, f = Math.round(0.03 * SR); for (let c = 0; c < 2; c++) { for (let i = i0 - f; i < i0; i++) mix[c][i] *= (i0 - i) / f; for (let i = i0; i < i1; i++) mix[c][i] = 0; for (let i = i1; i < i1 + 8; i++) mix[c][i] *= (i - i1) / 8; } }

// ============================ MASTER ============================
for (let c = 0; c < 2; c++) { const a = new Biquad('hp', 34, 0.75), b = new Biquad('hs', 7800, 0.7, 1.8), d = new Biquad('peak', 300, 0.8, -1.6), e = new Biquad('ls', 110, 0.7, -2.6), f = new Biquad('peak', 2400, 0.7, 1.8); for (let i = 0; i < N; i++) mix[c][i] = f.p(e.p(d.p(b.p(a.p(mix[c][i]))))); }
// glue compressor
{ let e = 0; const atk = Math.exp(-1 / (SR * 0.008)), rel = Math.exp(-1 / (SR * 0.14)); for (let i = 0; i < N; i++) { const x = Math.max(Math.abs(mix[0][i]), Math.abs(mix[1][i])); e = x > e ? atk * e + (1 - atk) * x : rel * e + (1 - rel) * x; const db = 20 * Math.log10(e + 1e-9), thr = -16, ratio = 2.2; const gr = db > thr ? Math.pow(10, -((db - thr) * (1 - 1 / ratio)) / 20) : 1; mix[0][i] *= gr; mix[1][i] *= gr; } }

// BS.1770 integrated loudness at 48 kHz
function loudness(L, R) {
  const kw = () => { const s1 = { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 }, s2 = { b0: 1, b1: -2, b2: 1, a1: -1.99004745483398, a2: 0.99007225036621 }; const mk = c => { let x1 = 0, x2 = 0, y1 = 0, y2 = 0; return x => { const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; }; }; const f1 = mk(s1), f2 = mk(s2); return x => f2(f1(x)); };
  const kl = kw(), kr = kw(), sq = new Float64Array(N); for (let i = 0; i < N; i++) { const a = kl(L[i]), b = kr(R[i]); sq[i] = a * a + b * b; }
  const blk = Math.round(0.4 * SR), hop = Math.round(0.1 * SR), z = []; for (let s = 0; s + blk <= N; s += hop) { let sum = 0; for (let i = s; i < s + blk; i++) sum += sq[i]; z.push(sum / blk); }
  const lk = v => -0.691 + 10 * Math.log10(v + 1e-12); let g = z.filter(v => lk(v) > -70); const rel = lk(g.reduce((a, b) => a + b, 0) / g.length) - 10; g = g.filter(v => lk(v) > rel); return lk(g.reduce((a, b) => a + b, 0) / g.length);
}
// look-ahead limiter with 4x inter-sample peak detection
const TAPS = 12, PH = [0.25, 0.5, 0.75].map(fr => { const k = []; for (let j = -TAPS / 2 + 1; j <= TAPS / 2; j++) { const x = j - fr; const w = 0.5 + 0.5 * Math.cos(Math.PI * x / (TAPS / 2)); k.push((Math.sin(Math.PI * x) / (Math.PI * x)) * w); } return k; });
function truePeakEnv(a) { const e = new Float32Array(N); for (let i = 0; i < N; i++) { let p = Math.abs(a[i]); for (const k of PH) { let s = 0; for (let j = 0; j < TAPS; j++) { const q = i + j - TAPS / 2 + 1; if (q >= 0 && q < N) s += a[q] * k[j]; } const v = Math.abs(s); if (v > p) p = v; } e[i] = p; } return e; }
function limit(L, R, ceil) {
  const pl = truePeakEnv(L), pr = truePeakEnv(R), look = Math.round(0.004 * SR);
  const need = new Float32Array(N); for (let i = 0; i < N; i++) { const p = Math.max(pl[i], pr[i]); need[i] = p > ceil ? ceil / p : 1; }
  // sliding minimum over the look-ahead window
  const mn = new Float32Array(N), dq = new Int32Array(N); let h = 0, tl = 0;
  for (let i = N - 1; i >= 0; i--) { while (tl > h && need[dq[tl - 1]] >= need[i]) tl--; dq[tl++] = i; while (dq[h] > i + look) h++; mn[i] = need[dq[h]]; }
  const out = [new Float32Array(N), new Float32Array(N)]; let g = 1; const rel = Math.exp(-1 / (SR * 0.09)); const ring = new Float32Array(look).fill(1); let rs = look, ri = 0;
  for (let i = 0; i < N; i++) { const target = mn[i]; g = target < g ? target : rel * g + (1 - rel) * target; rs += g - ring[ri]; ring[ri] = g; ri = (ri + 1) % look; const gs = Math.min(rs / look, need[i] < 1 ? need[i] : 1); out[0][i] = L[i] * gs; out[1][i] = R[i] * gs; }
  return out;
}
let gain = 1, outp;
const TARGET = -13.95;
let before = loudness(mix[0], mix[1]); gain = Math.pow(10, (TARGET - before) / 20);
for (let pass = 0; pass < 4; pass++) {
  const L = new Float32Array(N), R = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = mix[0][i] * gain, b = mix[1][i] * gain; L[i] = Math.abs(a) < 0.7 ? a : Math.sign(a) * (0.7 + 0.42 * Math.tanh((Math.abs(a) - 0.7) / 0.42)); R[i] = Math.abs(b) < 0.7 ? b : Math.sign(b) * (0.7 + 0.42 * Math.tanh((Math.abs(b) - 0.7) / 0.42)); }
  outp = limit(L, R, Math.pow(10, -2.5 / 20));
  const l = loudness(outp[0], outp[1]); console.log('pass', pass, 'integrated', l.toFixed(2), 'LUFS');
  if (Math.abs(l - TARGET) < 0.08) break; gain *= Math.pow(10, (TARGET - l) / 20);
}
// short fades at the two ends
for (let c = 0; c < 2; c++) { for (let i = 0; i < 96; i++) outp[c][i] *= i / 96; const f = Math.round(0.06 * SR); for (let i = 0; i < f; i++) outp[c][N - 1 - i] *= i / f; }
let peak = 0; for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(outp[c][i]));
console.log('sample peak', (20 * Math.log10(peak)).toFixed(2), 'dBFS, samples', N, 'seconds', (N / SR).toFixed(3));
// 24-bit WAV with TPDF dither
const outPath = path.resolve(root, process.argv[2] || 'soundtrack.wav');
const data = Buffer.alloc(44 + N * 6);
data.write('RIFF', 0); data.writeUInt32LE(36 + N * 6, 4); data.write('WAVE', 8); data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 6, 28); data.writeUInt16LE(6, 32); data.writeUInt16LE(24, 34); data.write('data', 36); data.writeUInt32LE(N * 6, 40);
let o = 44; const LSB = 1 / 8388607;
for (let i = 0; i < N; i++) for (let c = 0; c < 2; c++) { let v = outp[c][i] + (outp[c][i] === 0 ? 0 : (rnd() - rnd()) * LSB); v = Math.max(-1, Math.min(1, v)); data.writeIntLE(Math.round(v * 8388607), o, 3); o += 3; }
fs.writeFileSync(outPath, data);
console.log('wrote', outPath);
