// Small DSP toolbox for the soundtrack. Everything is deterministic.
const SR = 48000;
const LEN = SR * 20;
const TAU = Math.PI * 2;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const db = (v) => Math.pow(10, v / 20);

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// topology-preserving state variable filter (safe to modulate every sample)
class SVF {
  constructor() { this.a = 0; this.b = 0; }
  run(x, fc, q) {
    const g = Math.tan(Math.PI * clamp(fc, 10, SR * 0.45) / SR), k = 1 / q;
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - this.b, v1 = a1 * this.a + a2 * v3, v2 = this.b + a2 * this.a + a3 * v3;
    this.a = 2 * v1 - this.a; this.b = 2 * v2 - this.b;
    this.lp = v2; this.bp = v1 * k; this.hp = x - k * v1 - v2;
    return this;
  }
}

function pinkSource(random) {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  return () => {
    const w = random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    const out = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
    return out * 0.11;
  };
}

// A stereo bus with its own reverb send.
class Bus {
  constructor(name, gain = 1) { this.name = name; this.gain = gain; this.L = new Float32Array(LEN); this.R = new Float32Array(LEN); this.sL = new Float32Array(LEN); this.sR = new Float32Array(LEN); }
  put(i, l, r, send) {
    if (i < 0 || i >= LEN) return;
    this.L[i] += l; this.R[i] += r;
    if (send) { this.sL[i] += l * send; this.sR[i] += r * send; }
  }
  // mono voice placed with equal-power panning, starting exactly at sample `at`
  voice(at, length, pan, gain, send, fn) {
    const a = (clamp(pan, -1, 1) + 1) * Math.PI / 4, gl = Math.cos(a) * gain, gr = Math.sin(a) * gain;
    const n = Math.min(length, LEN - at);
    const keep = Bus.log && Bus.logged.has(this.name) ? new Float32Array(Math.max(0, n)) : null;
    for (let i = 0; i < n; i++) {
      const v = fn(i / SR, i);
      if (keep) keep[i] = v;
      this.put(at + i, v * gl, v * gr, send);
    }
    if (keep) Bus.log.push({ bus: this.name, at, gl, gr, data: keep });
  }
}

// attack: raised cosine; release: exponential
const env = (t, attack, tau) => (t < attack ? 0.5 - 0.5 * Math.cos(Math.PI * t / attack) : Math.exp(-(t - attack) / tau));
const bell = (u) => (Math.abs(u) >= 1 ? 0 : (1 - u * u) * (1 - u * u));

const NOTE = (name) => {
  const m = /^([A-G])(#?)(-?\d)$/.exec(name);
  const semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
  return 440 * Math.pow(2, (semi + (+m[3] + 1) * 12 - 69) / 12);
};

// ---------------------------------------------------------------- instruments
function partials(bus, at, freq, list, { pan = 0, gain = 0.1, send = 0.3, attack = 0.003, detune = 0, seed = 1 } = {}) {
  const random = rng(seed * 7919 + at);
  const longest = Math.max(...list.map((p) => p[2]));
  const n = Math.floor((attack + longest * 6.5) * SR);
  const osc = [];
  for (const [ratio, amp, tau] of list) {
    const f = freq * ratio;
    if (f > SR * 0.42) continue;
    osc.push({ w: TAU * f / SR, amp: amp * (detune ? 0.5 : 1), tau, ph: 0 });
    // the twin starts nearly in phase (a random phase can cancel the attack) and drifts into a slow beat
    if (detune) osc.push({ w: TAU * f * (1 + detune * (0.6 + random())) / SR, amp: amp * 0.5, tau, ph: (random() - 0.5) * 0.9 });
  }
  bus.voice(at, n, pan, gain, send, (t, i) => {
    let v = 0;
    for (const o of osc) v += o.amp * Math.sin(o.w * i + o.ph) * env(t, attack, o.tau);
    return v * Math.min(1, (n - i) / 480);
  });
}

// celesta: struck bar over a resonator, mostly fundamental with a bright onset
function celesta(bus, at, freq, o = {}) {
  const k = Math.pow(660 / freq, 0.35) * (o.length || 1);
  partials(bus, at, freq, [[1, 1, 0.85 * k], [2.0, 0.16, 0.40 * k], [3.01, 0.075, 0.20 * k], [4.18, 0.06, 0.07 * k], [6.8, 0.025, 0.03 * k]], { attack: 0.002, detune: 0.0012, ...o });
}

// glass chime: free-bar modes
function glass(bus, at, freq, o = {}) {
  const k = o.length || 1;
  partials(bus, at, freq, [[1, 1, 1.05 * k], [2.756, 0.36, 0.45 * k], [5.404, 0.15, 0.20 * k], [8.933, 0.06, 0.09 * k]], { attack: 0.0025, detune: 0.0018, ...o });
}

// felt piano: stiff-string partials, soft hammer
function piano(bus, at, freq, { pan = 0, gain = 0.1, send = 0.3, length = 1, seed = 3 } = {}) {
  const base = clamp(2.1 * Math.pow(220 / freq, 0.45), 0.45, 3.2) * length;
  const list = [];
  for (let n = 1; n <= 10; n++) list.push([n * Math.sqrt(1 + 0.00038 * n * n), Math.exp(-0.34 * (n - 1)) / Math.pow(n, 1.15), base / (1 + 0.42 * (n - 1))]);
  partials(bus, at, freq, list, { pan, gain, send, attack: 0.007, detune: 0.0009, seed });
  const random = rng(seed * 31 + at), f = new SVF();
  bus.voice(at, Math.floor(0.05 * SR), pan, gain * 0.22, send, (t) => f.run(random() * 2 - 1, Math.min(2600, freq * 5), 0.8).lp * env(t, 0.002, 0.008));
}

// ---------------------------------------------------------------- reverb
// eight-line feedback delay network with damping
function reverb(inL, inR, { rt60 = 2.3, damp = 0.36, predelay = 0.022 } = {}) {
  const lens = [1423, 1637, 1871, 2053, 2311, 2539, 2777, 3109];
  const lines = lens.map((n) => ({ buf: new Float32Array(n), i: 0, lp: 0, g: Math.pow(10, -3 * n / (rt60 * SR)) }));
  const pd = Math.floor(predelay * SR);
  const outL = new Float32Array(LEN), outR = new Float32Array(LEN);
  const y = new Float64Array(8);
  for (let n = 0; n < LEN; n++) {
    const xl = n >= pd ? inL[n - pd] : 0, xr = n >= pd ? inR[n - pd] : 0;
    for (let k = 0; k < 8; k++) {
      const L = lines[k];
      L.lp = L.buf[L.i] * (1 - damp) + L.lp * damp;
      y[k] = L.lp * L.g;
    }
    outL[n] = (y[0] - y[2] + y[4] - y[6]) * 0.5;
    outR[n] = (y[1] - y[3] + y[5] - y[7]) * 0.5;
    // fast Walsh–Hadamard mix, normalised
    for (let span = 1; span < 8; span <<= 1) for (let i = 0; i < 8; i += span << 1) for (let j = i; j < i + span; j++) { const a = y[j], b = y[j + span]; y[j] = a + b; y[j + span] = a - b; }
    for (let k = 0; k < 8; k++) {
      const L = lines[k];
      L.buf[L.i] = y[k] * 0.35355339 + (k & 1 ? xr : xl) * (k & 2 ? -0.5 : 0.5);
      L.i = (L.i + 1) % L.buf.length;
    }
  }
  return [outL, outR];
}

// ---------------------------------------------------------------- mastering
// four-times oversampled peak estimate, look-ahead gain, smooth release
function truePeakLimit(L, R, ceiling, { lookahead = 0.005, release = 0.11 } = {}) {
  const TAPS = 32, phases = [0.25, 0.5, 0.75].map((frac) => {
    const h = new Float64Array(TAPS);
    for (let k = 0; k < TAPS; k++) {
      const x = k - TAPS / 2 + 1 - frac;
      const w = 0.5 + 0.5 * Math.cos(Math.PI * x / (TAPS / 2));
      h[k] = (Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * w;
    }
    return h;
  });
  const n = L.length, need = new Float32Array(n).fill(1);
  for (const x of [L, R]) for (let i = 0; i < n; i++) {
    let peak = Math.abs(x[i]);
    if (peak > ceiling * 0.5 || Math.abs(x[Math.min(n - 1, i + 1)]) > ceiling * 0.5) {
      for (const h of phases) {
        let s = 0;
        for (let k = 0; k < TAPS; k++) { const j = i + k - TAPS / 2 + 1; if (j >= 0 && j < n) s += x[j] * h[k]; }
        if (Math.abs(s) > peak) peak = Math.abs(s);
      }
    }
    const g = peak > ceiling ? ceiling / peak : 1;
    if (g < need[i]) { need[i] = g; if (i + 1 < n && g < need[i + 1]) need[i + 1] = g; }
  }
  const la = Math.floor(lookahead * SR), ahead = new Float32Array(n), q = new Int32Array(n);
  let head = 0, tail = 0, next = 0;
  for (let i = 0; i < n; i++) {
    while (next < n && next <= i + la) { while (tail > head && need[q[tail - 1]] >= need[next]) tail--; q[tail++] = next++; }
    while (q[head] < i) head++;
    ahead[i] = need[q[head]];
  }
  const rel = 1 - Math.exp(-1 / (release * SR));
  let g = 1;
  for (let i = 0; i < n; i++) { g = Math.min(ahead[i], g + (1 - g) * rel); ahead[i] = g; }
  const outL = new Float32Array(n), outR = new Float32Array(n);
  let sum = 0, minGain = 1, limited = 0;
  for (let i = 0; i < n; i++) {
    sum += ahead[i] - (i >= la ? ahead[i - la] : 0);
    const s = Math.min(1, (sum + (i < la ? (la - 1 - i) * 1 : 0)) / la);
    outL[i] = L[i] * s; outR[i] = R[i] * s;
    if (s < minGain) minGain = s;
    if (s < 0.891) limited++;                      // more than 1 dB of reduction
  }
  return { L: outL, R: outR, maxReductionDb: -20 * Math.log10(minGain), fractionOver1dB: limited / n };
}

function wav24(L, R) {
  const n = L.length, data = Buffer.alloc(44 + n * 6);
  data.write('RIFF', 0); data.writeUInt32LE(36 + n * 6, 4); data.write('WAVE', 8); data.write('fmt ', 12);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 6, 28); data.writeUInt16LE(6, 32); data.writeUInt16LE(24, 34); data.write('data', 36); data.writeUInt32LE(n * 6, 40);
  const random = rng(24601);                       // seeded triangular dither
  let o = 44;
  for (let i = 0; i < n; i++) for (const x of [L, R]) {
    const v = clamp(Math.round(x[i] * 8388607 + random() - random()), -8388608, 8388607);
    data.writeIntLE(v, o, 3); o += 3;
  }
  return data;
}

Bus.logged = new Set(['chimes', 'keys', 'nucleus', 'landing']);

module.exports = { SR, LEN, TAU, clamp, lerp, sstep, db, rng, SVF, pinkSource, Bus, env, bell, NOTE, partials, celesta, glass, piano, reverb, truePeakLimit, wav24 };
