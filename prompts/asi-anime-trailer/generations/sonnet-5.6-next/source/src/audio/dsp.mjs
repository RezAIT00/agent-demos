// Small DSP kit for the score: oscillators, filters, reverb, limiter, loudness.
// Everything is synthesized. No samples are loaded anywhere.
export const SR = 48000;
export const DUR = 87.5;
export const N = Math.round(DUR * SR);
export const TAU = Math.PI * 2;

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const db = d => Math.pow(10, d / 20);

export function rng(seed) {
  let a = (seed >>> 0) || 1;
  const f = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.bi = () => f() * 2 - 1;
  return f;
}
const NAMES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
export function hz(note) {
  if (typeof note === 'number') return note;
  const m = note.match(/^([A-G]#?)(-?\d)$/);
  const midi = NAMES[m[1]] + (+m[2] + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class Bus {
  constructor() { this.L = new Float32Array(N); this.R = new Float32Array(N); }
  add(i, v, pan = 0) {
    if (i < 0 || i >= N) return;
    const a = (pan + 1) * Math.PI / 4;
    this.L[i] += v * Math.cos(a) * Math.SQRT2;
    this.R[i] += v * Math.sin(a) * Math.SQRT2;
  }
}
// a voice writes a mono signal into several buses with their own gains
export function writer(targets, pan) {
  const a = (clamp(pan, -1, 1) + 1) * Math.PI / 4, gl = Math.cos(a) * Math.SQRT2, gr = Math.sin(a) * Math.SQRT2;
  const list = targets.filter(t => t && t[1] > 0);
  return (i, v) => {
    if (i < 0 || i >= N) return;
    for (let k = 0; k < list.length; k++) { const b = list[k][0], g = list[k][1]; b.L[i] += v * gl * g; b.R[i] += v * gr * g; }
  };
}

// ---- filters -------------------------------------------------------------
export function biquad(type, f, q = .707, gainDb = 0) {
  const w = TAU * clamp(f, 10, SR * .47) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q), A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
  else if (type === 'hishelf') { const sq = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * c + sq); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - sq); a0 = (A + 1) - (A - 1) * c + sq; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - sq; }
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
// state-variable filter whose cutoff may move every sample
export function svf() {
  let ic1 = 0, ic2 = 0, g = 0, k = 1, a1 = 0, a2 = 0, a3 = 0, lastF = -1, lastQ = -1;
  return (x, f, q = .707) => {
    if (Math.abs(f - lastF) > 1 || q !== lastQ) {
      g = Math.tan(Math.PI * clamp(f, 16, SR * .45) / SR); k = 1 / q; a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; lastF = f; lastQ = q;
    }
    const v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    return { lp: v2, bp: v1, hp: x - k * v1 - v2 };
  };
}
export function onepole(f) { const a = 1 - Math.exp(-TAU * f / SR); let y = 0; return x => (y += a * (x - y)); }
// band-limited saw
export function saw(phase0 = 0) {
  let p = phase0;
  return f => {
    const dt = f / SR; p += dt; if (p >= 1) p -= 1;
    let v = 2 * p - 1;
    if (p < dt) { const t = p / dt; v -= t + t - t * t - 1; } else if (p > 1 - dt) { const t = (p - 1) / dt; v -= t * t + t + t + 1; }
    return v;
  };
}
export const adsr = (t, len, a, d, s, r) => {
  if (t < 0) return 0;
  let v = t < a ? t / a : t < a + d ? lerp(1, s, (t - a) / d) : s;
  if (t > len) v *= Math.max(0, 1 - (t - len) / r);
  return v;
};

// ---- feedback delay network reverb ---------------------------------------
export function reverb(inBus, o = {}) {
  const out = new Bus();
  const lens = [1423, 1777, 2143, 2557, 2909, 3299, 3671, 4093].map(v => Math.round(v * (o.size ?? 1)));
  const rt = o.rt ?? 3.2, damp = o.damp ?? 5200;
  const lines = lens.map(l => ({ buf: new Float32Array(l + 64), len: l, w: 0, g: Math.pow(10, -3 * l / SR / rt), lp: onepole(damp) }));
  const pre = Math.round((o.predelay ?? .022) * SR);
  const dif = [[142, .7], [107, .7], [379, .62], [277, .62]];
  const mkAp = ([l, g]) => { const b = new Float32Array(l); let i = 0; return x => { const d = b[i], y = d - g * x; b[i] = x + g * y; i = (i + 1) % l; return y; }; };
  const apL = dif.map(mkAp), apR = dif.map(([l, g]) => mkAp([l + 23, g]));
  const hpL = biquad('hp', o.lowcut ?? 160), hpR = biquad('hp', o.lowcut ?? 160);
  const s = new Float64Array(8);
  for (let i = 0; i < N; i++) {
    let xl = i >= pre ? inBus.L[i - pre] : 0, xr = i >= pre ? inBus.R[i - pre] : 0;
    xl = hpL(xl); xr = hpR(xr);
    for (const a of apL) xl = a(xl);
    for (const a of apR) xr = a(xr);
    let sum = 0;
    for (let k = 0; k < 8; k++) {
      const L = lines[k], mod = k < 2 ? Math.sin(TAU * (.31 + k * .17) * i / SR) * 9 : 0;
      let rp = L.w - L.len + mod; while (rp < 0) rp += L.buf.length;
      const i0 = rp | 0, fr = rp - i0, v = L.buf[i0 % L.buf.length] * (1 - fr) + L.buf[(i0 + 1) % L.buf.length] * fr;
      s[k] = L.lp(v) * L.g; sum += s[k];
    }
    const h = sum * .25;                      // Householder feedback
    for (let k = 0; k < 8; k++) {
      const L = lines[k];
      L.buf[L.w] = s[k] - h + (k % 2 ? xr : xl) * .42;
      L.w = (L.w + 1) % L.buf.length;
    }
    out.L[i] = (s[0] - s[2] + s[4] - s[6]) * .62;
    out.R[i] = (s[1] - s[3] + s[5] - s[7]) * .62;
  }
  return out;
}
// ping-pong echo, dotted eighth at 120 bpm
export function echo(inBus, time = .375, fb = .36, tone = 3400) {
  const out = new Bus(), d = Math.round(time * SR), lpL = onepole(tone), lpR = onepole(tone);
  for (let i = 0; i < N; i++) {
    const l = i >= d ? lpL(inBus.R[i - d] * 0 + out.R[i - d] * fb + inBus.L[i - d]) : 0;
    const r = i >= d ? lpR(out.L[i - d] * fb) : 0;
    out.L[i] = l; out.R[i] = r + (i >= 2 * d ? inBus.R[i - 2 * d] * .4 : 0);
  }
  return out;
}

// ---- loudness (ITU-R BS.1770-4) -------------------------------------------
export function lufs(L, R, from = 0, to = L.length) {
  const k = () => {
    const stage = (b, a) => { let x1 = 0, x2 = 0, y1 = 0, y2 = 0; return x => { const y = b[0] * x + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; }; };
    const s1 = stage([1.53512485958697, -2.69169618940638, 1.19839281085285], [-1.69065929318241, .73248077421585]);
    const s2 = stage([1, -2, 1], [-1.99004745483398, .99007225036621]);
    return x => s2(s1(x));
  };
  const kl = k(), kr = k(), step = SR / 10, sq = [];
  let acc = 0, n = 0;
  for (let i = from; i < to; i++) {
    const a = kl(L[i]), b = kr(R[i]); acc += a * a + b * b; n++;
    if (n === step) { sq.push(acc / step); acc = 0; n = 0; }
  }
  const blocks = [];
  for (let i = 0; i + 4 <= sq.length; i++) blocks.push((sq[i] + sq[i + 1] + sq[i + 2] + sq[i + 3]) / 4);
  const L_ = e => -.691 + 10 * Math.log10(e + 1e-20);
  const g1 = blocks.filter(e => L_(e) > -70);
  if (!g1.length) return -99;
  const rel = L_(g1.reduce((a, b) => a + b, 0) / g1.length) - 10;
  const g2 = g1.filter(e => L_(e) > rel);
  return L_(g2.reduce((a, b) => a + b, 0) / g2.length);
}

// ---- true-peak aware look-ahead limiter ------------------------------------
const OS_TAPS = (() => {            // 4x polyphase windowed sinc
  const phases = [];
  for (let p = 1; p < 4; p++) {
    const taps = [];
    for (let k = -7; k <= 8; k++) {
      const x = k - p / 4, w = .5 + .5 * Math.cos(Math.PI * x / 8.5);
      taps.push(Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x) * w);
    }
    phases.push(taps);
  }
  return phases;
})();
export function truePeaks(L, R) {
  const pk = new Float32Array(L.length);
  for (const ch of [L, R]) {
    for (let i = 0; i < ch.length; i++) {
      let m = Math.abs(ch[i]);
      if (m > .2 || (i + 1 < ch.length && Math.abs(ch[i + 1]) > .2)) {
        for (const taps of OS_TAPS) {
          let v = 0;
          for (let k = -7; k <= 8; k++) { const j = i + k; if (j >= 0 && j < ch.length) v += ch[j] * taps[k + 7]; }
          if (Math.abs(v) > m) m = Math.abs(v);
        }
      }
      if (m > pk[i]) pk[i] = m;
    }
  }
  return pk;
}
export function limit(L, R, ceilDb = -1.6, lookMs = 4, relMs = 90) {
  const ceil = db(ceilDb), look = Math.round(lookMs / 1000 * SR), pk = truePeaks(L, R);
  const need = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) need[i] = pk[i] > ceil ? ceil / pk[i] : 1;
  // sliding minimum over the look-ahead window, then smooth attack and release
  const dq = new Int32Array(L.length); let h = 0, t = 0;
  const mins = new Float32Array(L.length);
  let j = 0;
  for (let i = 0; i < L.length; i++) {
    while (j < L.length && j <= i + look) { while (t > h && need[dq[t - 1]] >= need[j]) t--; dq[t++] = j; j++; }
    while (dq[h] < i - 8) h++;
    mins[i] = need[dq[h]];
  }
  const rel = Math.exp(-1 / (relMs / 1000 * SR));
  let g = 1; const gain = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) { g = mins[i] < g ? mins[i] : mins[i] + (g - mins[i]) * rel; gain[i] = g; }
  // moving average removes the clicks a stepped gain would make
  let sum = 0; const W = Math.max(1, look >> 1);
  const sm = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) { sum += gain[i]; if (i >= W) sum -= gain[i - W]; sm[i] = sum / Math.min(i + 1, W); }
  let worst = 1;
  for (let i = 0; i < L.length; i++) {
    const gi = Math.min(sm[Math.min(L.length - 1, i + (W >> 1))], need[i]);
    L[i] *= gi; R[i] *= gi; if (gi < worst) worst = gi;
  }
  return 20 * Math.log10(worst);
}
export function wav24(L, R) {
  const n = L.length, buf = Buffer.alloc(44 + n * 6);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 6, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 6, 28); buf.writeUInt16LE(6, 32); buf.writeUInt16LE(24, 34); buf.write('data', 36); buf.writeUInt32LE(n * 6, 40);
  let o = 44; const R_ = rng(99);
  for (let i = 0; i < n; i++) for (const ch of [L, R]) {
    // true digital silence stays silent: dither only where there is signal
    const d = ch[i] === 0 ? 0 : (R_() - R_()) / 8388608;
    buf.writeIntLE(Math.round(clamp(ch[i] + d, -1, 1) * 8388607), o, 3); o += 3;
  }
  return buf;
}
