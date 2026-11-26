// Synthesize soundtrack.wav: compose, add reverb, master to about -14 LUFS with
// a true-peak ceiling. Pure JavaScript, no samples, no packages.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, N, dry, space, room, impulse, convolve, Biquad, curve } from './dsp.mjs';
import { compose } from './score.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = path.resolve(process.argv[2] || path.join(root, 'soundtrack.wav'));
const TARGET = -14.0;
// AAC adds up to about 1.2 dB of overshoot, so the PCM master leaves room for it
const CEILING_DB = -2.9;

const t0 = Date.now();
compose();
console.log(`composed in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// reverbs (different impulse per ear for width)
const mix = [new Float32Array(N), new Float32Array(N)];
const sides = [
  [dry.L, space.L, room.L, 11, 21],
  [dry.R, space.R, room.R, 12, 22],
];
sides.forEach(([d, s, r, s1, s2], c) => {
  const a = convolve(s, impulse(3.4, s1, { damp: 4200, pre: 0.024 }));
  const b = convolve(r, impulse(0.6, s2, { damp: 6500, pre: 0.006 }));
  const hp = new Biquad('hp', 27, 0.7), low = new Biquad('pk', 210, 0.8, -1.5), air = new Biquad('hs', 6500, 0.7, 1.5);
  const sub = new Biquad('pk', 58, 0.8, -4.0), hp2 = new Biquad('hp', 31, 0.8);
  for (let i = 0; i < N; i++) mix[c][i] = air.run(low.run(sub.run(hp2.run(hp.run(d[i] + a[i] * 0.50 + b[i] * 0.45)))));
});
console.log(`reverb done at ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// ---- ITU-R BS.1770 integrated loudness ------------------------------------
function loudness(ch) {
  const powers = [];
  const filtered = ch.map((x) => {
    const y = new Float64Array(N);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, u1 = 0, u2 = 0, v1 = 0, v2 = 0;
    for (let i = 0; i < N; i++) {
      const a = 1.53512485958697 * x[i] - 2.69169618940638 * x1 + 1.19839281085285 * x2 + 1.69065929318241 * y1 - 0.73248077421585 * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = a;
      const b = a - 2 * u1 + u2 + 1.99004745483398 * v1 - 0.99007225036621 * v2;
      u2 = u1; u1 = a; v2 = v1; v1 = b;
      y[i] = b;
    }
    return y;
  });
  const win = SR * 0.4, hop = SR * 0.1;
  for (let s = 0; s + win <= N; s += hop) {
    let p = 0;
    for (const y of filtered) { let e = 0; for (let i = s; i < s + win; i++) e += y[i] * y[i]; p += e / win; }
    powers.push(p);
  }
  const L = (p) => -0.691 + 10 * Math.log10(p + 1e-20);
  const abs = powers.filter((p) => L(p) > -70);
  const gate = L(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const rel = abs.filter((p) => L(p) > gate);
  return L(rel.reduce((a, b) => a + b, 0) / rel.length);
}

// ---- true peak (4x oversampled, windowed sinc) -----------------------------
const TAPS = 16;
const PHASES = [0.25, 0.5, 0.75].map((frac) => {
  const h = [];
  for (let k = -TAPS / 2 + 1; k <= TAPS / 2; k++) {
    const x = k - frac;
    const sinc = Math.sin(Math.PI * x) / (Math.PI * x);
    const w = 0.5 + 0.5 * Math.cos(Math.PI * x / (TAPS / 2));
    h.push(sinc * w);
  }
  return h;
});
function peakEnvelope(ch) {
  const env = new Float32Array(N);
  for (const x of ch) {
    for (let i = 0; i < N; i++) {
      let m = Math.abs(x[i]);
      if (m > 0.2 || (i + 1 < N && Math.abs(x[i + 1]) > 0.2)) {
        for (const h of PHASES) {
          let s = 0;
          for (let k = 0; k < TAPS; k++) { const j = i + k - TAPS / 2 + 1; if (j >= 0 && j < N) s += x[j] * h[k]; }
          m = Math.max(m, Math.abs(s));
        }
      }
      if (m > env[i]) env[i] = m;
    }
  }
  return env;
}

// look-ahead limiter driven by the true-peak envelope
function limit(ch, ceiling) {
  const env = peakEnvelope(ch);
  const look = Math.round(SR * 0.004);
  const need = new Float32Array(N);
  for (let i = 0; i < N; i++) need[i] = env[i] > ceiling ? ceiling / env[i] : 1;
  // minimum over the look-ahead window (monotone deque)
  const held = new Float32Array(N);
  const q = new Int32Array(N);
  let h = 0, tail = 0;
  for (let i = 0, j = 0; i < N; i++) {
    for (; j < Math.min(N, i + look + 1); j++) { while (tail > h && need[q[tail - 1]] >= need[j]) tail--; q[tail++] = j; }
    while (q[h] < i - look) h++;
    held[i] = need[q[h]];
  }
  // smooth attack (box filter over the look-ahead), slow release
  const rel = Math.exp(-1 / (SR * 0.09));
  const g = new Float32Array(N);
  let cur = 1;
  for (let i = 0; i < N; i++) { cur = held[i] < cur ? held[i] : 1 - (1 - cur) * rel; if (cur > held[i]) cur = held[i]; g[i] = cur; }
  let sum = 0;
  const sm = new Float32Array(N);
  for (let i = 0; i < N; i++) { sum += g[i]; if (i >= look) sum -= g[i - look]; sm[i] = sum / Math.min(i + 1, look); }
  let deepest = 1;
  const res = ch.map((x) => { const y = new Float32Array(N); for (let i = 0; i < N; i++) { const k = Math.min(sm[i], need[i]); y[i] = x[i] * k; if (k < deepest) deepest = k; } return y; });
  const perSecond = [];
  for (let s = 0; s < 80; s++) { let m = 1; for (let i = s * SR; i < (s + 1) * SR; i++) m = Math.min(m, sm[i]); perSecond.push(20 * Math.log10(m)); }
  return { res, deepest, perSecond };
}

// the shape of the whole film, in dB: intimate openings, a real hush, two big hits
const FADER = curve([[0, -5], [1.4, -3.5], [5.6, -2], [6.4, -1.5], [11, 0], [17.9, 0], [18.3, -2], [22.5, -2], [23.2, -2.5], [26.6, -2.5], [27.2, -0.5], [31, -1],
  [32.5, 0], [44.7, 0], [45.1, -2], [47, -1.5], [48.8, -2], [49.15, -3.5], [51.9, -3.5], [52.3, 0.5], [56, 0], [57.95, 0], [58.45, -14], [59.52, -14], [59.66, -0.5],
  [61, -1], [63, -0.5], [64.9, -0.5], [65.02, -1], [65.7, -2.5], [66.3, -3], [73.1, -3.5], [75.5, -3], [78, -2.5], [79.4, -1.5], [80, -1.5]]);
for (const x of mix) for (let i = 0; i < N; i++) x[i] *= Math.pow(10, FADER(i / SR) / 20);

// gentle top-and-tail so the file starts and ends without a click
for (const x of mix) {
  for (let i = 0; i < SR * 0.012; i++) x[i] *= i / (SR * 0.012);
  const fade = Math.round(SR * 0.22);
  for (let i = 0; i < fade; i++) x[N - 1 - i] *= Math.pow(i / fade, 1.5);
}

const ceiling = Math.pow(10, CEILING_DB / 20);
let gain = Math.pow(10, (TARGET - loudness(mix)) / 20);
let result, lufs, deepest, perSecond;
for (let pass = 0; pass < 6; pass++) {
  const scaled = mix.map((x) => { const y = new Float32Array(N); for (let i = 0; i < N; i++) y[i] = x[i] * gain; return y; });
  ({ res: result, deepest, perSecond } = limit(scaled, ceiling));
  lufs = loudness(result);
  console.log(`pass ${pass}: ${lufs.toFixed(2)} LUFS, deepest limiting ${(20 * Math.log10(deepest)).toFixed(1)} dB`);
  if (Math.abs(lufs - TARGET) < 0.08) break;
  gain *= Math.pow(10, (TARGET - lufs) / 20);
}

let tp = 0, sp = 0, clipped = 0;
const env = peakEnvelope(result);
for (let i = 0; i < N; i++) tp = Math.max(tp, env[i]);
for (const x of result) for (let i = 0; i < N; i++) { const a = Math.abs(x[i]); sp = Math.max(sp, a); if (a >= 0.9999) clipped++; }

// 24-bit stereo WAV, exactly 80.000 s
const data = Buffer.alloc(N * 6);
for (let i = 0; i < N; i++) {
  for (let c = 0; c < 2; c++) {
    const v = Math.max(-8388608, Math.min(8388607, Math.round(result[c][i] * 8388607)));
    data.writeIntLE(v, i * 6 + c * 3, 3);
  }
}
const head = Buffer.alloc(44);
head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVEfmt ', 8);
head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22); head.writeUInt32LE(SR, 24);
head.writeUInt32LE(SR * 6, 28); head.writeUInt16LE(6, 32); head.writeUInt16LE(24, 34);
head.write('data', 36); head.writeUInt32LE(data.length, 40);
fs.writeFileSync(out, Buffer.concat([head, data]));
console.log(`wrote ${out}`);
console.log('seconds limited by more than 3 dB: ' + perSecond.map((v, s) => (v < -3 ? `${s}s:${v.toFixed(1)}` : null)).filter(Boolean).join(' '));
console.log(`integrated ${lufs.toFixed(2)} LUFS | true peak ${(20 * Math.log10(tp)).toFixed(2)} dBTP | sample peak ${(20 * Math.log10(sp)).toFixed(2)} dBFS | clipped samples ${clipped} | ${(N / SR).toFixed(3)} s`);
console.log(`total ${((Date.now() - t0) / 1000).toFixed(1)} s`);
