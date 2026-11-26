// Math, deterministic noise / random, easing, colour. No Math.random anywhere:
// every frame must be a pure function of t.
const W = 1920, H = 1080;
const PI = Math.PI, TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, x) => clamp((x - a) / (b - a));
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const ramp = (a, b, x) => smooth((x - a) / (b - a));
// 0 -> 1 -> 0 window with soft edges
const pulse = (a, b, x, f = 0.3) => ramp(a, a + f, x) * (1 - ramp(b - f, b, x));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const easeIn = (t) => Math.pow(clamp(t), 3);
const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const mod = (a, n) => ((a % n) + n) % n;
const hypot = Math.hypot;

// integer hash -> [0,1)
function hash(n) {
  let x = (n | 0) ^ 0x5bf03635;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
const hash2 = (a, b) => hash((a | 0) * 374761393 + (b | 0) * 668265263);
function rng(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// smooth value noise 1D / 2D, range [0,1]
function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  return lerp(hash2(i, seed), hash2(i + 1, seed), f * f * (3 - 2 * f));
}
function noise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const h = (a, b) => hash2(a + seed * 131, b);
  return lerp(lerp(h(ix, iy), h(ix + 1, iy), u), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), u), v);
}
function fbm1(x, seed = 0, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise1(x * f, seed + i * 17); a *= 0.5; f *= 2.03; }
  return s / (1 - Math.pow(0.5, oct));
}

// colours as [r,g,b] 0..255
// accepts '#rrggbb' and the 'rgba(r,g,b,a)' strings that M()/rgb() produce
function hex(h) {
  if (h[0] !== '#') return h.slice(h.indexOf('(') + 1).split(',').slice(0, 3).map(Number);
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const C = (h, a = 1) => rgb(hex(h), a);
const M = (h1, h2, t, a = 1) => rgb(mixc(hex(h1), hex(h2), clamp(t)), a);
const v3 = (h, k = 1) => { const c = hex(h); return [c[0] / 255 * k, c[1] / 255 * k, c[2] / 255 * k]; };

// keyframes: [[t, value], ...] with smooth interpolation (numbers or arrays)
function keys(list, t) {
  if (t <= list[0][0]) return list[0][1];
  for (let i = 1; i < list.length; i++) {
    if (t <= list[i][0]) {
      const [t0, a] = list[i - 1], [t1, b] = list[i];
      const k = smooth((t - t0) / (t1 - t0));
      return Array.isArray(a) ? a.map((v, j) => lerp(v, b[j], k)) : lerp(a, b, k);
    }
  }
  return list[list.length - 1][1];
}
