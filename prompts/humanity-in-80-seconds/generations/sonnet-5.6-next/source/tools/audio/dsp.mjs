// Small DSP kit: buses, filters, noise, instruments' building blocks, FFT reverb.
export const SR = 48000;
export const DUR = 80;
export const N = SR * DUR;
export const TAU = Math.PI * 2;

export function rng(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const ramp = (a, b, x) => smooth((x - a) / (b - a));
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export const hz = (name) => {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
  return mtof(12 * (Number(m[2]) + 1) + NOTE[m[1]]);
};
// automation: [[time, value], ...]
export function curve(points) {
  return (t) => {
    if (t <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      if (t <= points[i][0]) {
        const [t0, a] = points[i - 1], [t1, b] = points[i];
        return a + (b - a) * smooth((t - t0) / (t1 - t0));
      }
    }
    return points[points.length - 1][1];
  };
}

export class Bus {
  constructor() { this.L = new Float32Array(N); this.R = new Float32Array(N); }
}
export const dry = new Bus();
export const space = new Bus();   // long, dark hall
export const room = new Bus();    // short, close

// Write a mono voice into the buses. fn(tau, i) returns the sample.
export function voice(t0, dur, fn, o = {}) {
  const { gain = 1, pan = 0, send = 0.2, near = 0, panFn = null } = o;
  const i0 = Math.max(0, Math.round(t0 * SR));
  const i1 = Math.min(N, Math.round((t0 + dur) * SR));
  let gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  const start = Math.round(t0 * SR);
  for (let i = i0; i < i1; i++) {
    const k = i - start;
    const tau = k / SR;
    let s = fn(tau, k) * gain;
    if (!Number.isFinite(s)) s = 0;
    if (panFn && (k & 255) === 0) {
      const p = panFn(tau);
      gl = Math.cos((p + 1) * Math.PI / 4); gr = Math.sin((p + 1) * Math.PI / 4);
    }
    const l = s * gl, r = s * gr;
    dry.L[i] += l; dry.R[i] += r;
    if (send) { space.L[i] += l * send; space.R[i] += r * send; }
    if (near) { room.L[i] += l * near; room.R[i] += r * near; }
  }
}

// RBJ biquad, coefficients may be re-set while running
export class Biquad {
  constructor(type, f, q = 0.707, gainDb = 0) {
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(type, f, q, gainDb);
  }
  set(type, f, q = 0.707, gainDb = 0) {
    const w = TAU * clamp(f, 8, SR * 0.46) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
    const A = Math.pow(10, gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'pk') { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
    else if (type === 'hs') {
      const sq = 2 * Math.sqrt(A) * al;
      b0 = A * ((A + 1) + (A - 1) * c + sq); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - sq);
      a0 = (A + 1) - (A - 1) * c + sq; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - sq;
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

export function pinkSource(seed) {
  const r = rng(seed);
  let b0 = 0, b1 = 0, b2 = 0;
  return () => {
    const w = r() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913;
    return (b0 + b1 + b2 + w * 0.1848) * 0.2;
  };
}
export function whiteSource(seed) { const r = rng(seed); return () => r() * 2 - 1; }

// band-limited saw (PolyBLEP)
export function saw(phase, dt) {
  let v = 2 * phase - 1;
  if (phase < dt) { const x = phase / dt; v -= x + x - x * x - 1; }
  else if (phase > 1 - dt) { const x = (phase - 1) / dt; v -= x * x + x + x + 1; }
  return v;
}
export const adsr = (tau, dur, a, r) => (tau < a ? smooth(tau / a) : tau > dur - r ? smooth((dur - tau) / r) : 1);

// ---- FFT convolution reverb ------------------------------------------------
function fft(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? TAU : -TAU) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

export function impulse(seconds, seed, { damp = 3500, pre = 0.018 } = {}) {
  const n = Math.round(seconds * SR), out = new Float64Array(n);
  const r = rng(seed);
  let lp = 0;
  for (let i = Math.round(pre * SR); i < n; i++) {
    const tau = i / SR;
    const k = Math.exp(-TAU * (damp * Math.exp(-tau * 0.9) + 500) / SR);   // highs die first
    lp = (1 - k) * (r() * 2 - 1) + k * lp;
    out[i] = lp * Math.exp(-6.9 * tau / seconds);
  }
  let e = 0;
  for (let i = 0; i < n; i++) e += out[i] * out[i];
  const g = 1 / Math.sqrt(e);
  for (let i = 0; i < n; i++) out[i] *= g;
  return out;
}

export function convolve(input, ir) {
  let size = 1;
  while (size < ir.length * 3) size <<= 1;
  const block = size - ir.length + 1;
  const Hr = new Float64Array(size), Hi = new Float64Array(size);
  Hr.set(ir); fft(Hr, Hi, false);
  const out = new Float32Array(N);
  const re = new Float64Array(size), im = new Float64Array(size);
  for (let start = 0; start < N; start += block) {
    re.fill(0); im.fill(0);
    let any = false;
    for (let i = 0; i < block && start + i < N; i++) { re[i] = input[start + i]; if (re[i]) any = true; }
    if (!any) continue;
    fft(re, im, false);
    for (let i = 0; i < size; i++) {
      const a = re[i], b = im[i];
      re[i] = a * Hr[i] - b * Hi[i]; im[i] = a * Hi[i] + b * Hr[i];
    }
    fft(re, im, true);
    for (let i = 0; i < size && start + i < N; i++) out[start + i] += re[i];
  }
  return out;
}
