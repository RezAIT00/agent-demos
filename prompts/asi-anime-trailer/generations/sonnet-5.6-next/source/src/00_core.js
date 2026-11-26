'use strict';
// ---------------------------------------------------------------------------
// core: constants, math, seeded randomness, easing, noise, colour helpers
// Everything here is pure. Nothing at render time may use Math.random().
// ---------------------------------------------------------------------------
const W = 1920, H = 1080, FPS = 24;
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const smooth = (a, b, x) => { const t = inv(a, b, x); return t * t * (3 - 2 * t); };
const mix2 = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];

const E = {
  lin: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: t => Math.sin(t * Math.PI / 2),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inOutQuint: t => (t < .5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2),
};
// eased ramp between times a and b
const ramp = (t, a, b, fn = E.inOutCubic) => fn(inv(a, b, t));
// envelope: rise over [a, a+i], hold, fall over [b-o, b]
const env = (t, a, b, i = .25, o = .25) => Math.min(inv(a, a + i, t), 1 - inv(b - o, b, t));

// integer hash -> [0,1)
function hash(n) {
  let x = (n | 0) ^ 0x5bd1e995;
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d);
  x = Math.imul(x ^ (x >>> 12), 0x297a2d39);
  x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}
const hash2 = (a, b) => hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663));
function rng(seed) {
  let a = (seed >>> 0) || 1;
  const f = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.gauss = () => { const u = Math.max(1e-9, f()), v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
  return f;
}
function vnoise(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash2(i, seed), hash2(i + 1, seed), u) * 2 - 1;
}
function vnoise2(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const h = (a, b) => hash2(a + seed * 131, b - seed * 57);
  return lerp(lerp(h(ix, iy), h(ix + 1, iy), ux), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), ux), uy) * 2 - 1;
}
const fbm1 = (x, s = 0) => vnoise(x, s) * .6 + vnoise(x * 2.1, s + 1) * .3 + vnoise(x * 4.3, s + 2) * .1;

// "on twos": character drawings change 12 times a second
const drawNo = t => Math.floor(t * 12 + 1e-4);
const on2 = t => drawNo(t) / 12;

// colour helpers
function rgbOf(h) {
  const n = parseInt(h.slice(1), 16);
  return h.length === 7 ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [(n >> 8 & 15) * 17, (n >> 4 & 15) * 17, (n & 15) * 17];
}
const rgba = (h, a = 1) => { const c = rgbOf(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
function mixc(a, b, t, al = 1) {
  const x = rgbOf(a), y = rgbOf(b);
  return `rgba(${Math.round(lerp(x[0], y[0], t))},${Math.round(lerp(x[1], y[1], t))},${Math.round(lerp(x[2], y[2], t))},${al})`;
}
function mixh(a, b, t) {
  const x = rgbOf(a), y = rgbOf(b);
  return '#' + [0, 1, 2].map(i => Math.round(lerp(x[i], y[i], clamp(t))).toString(16).padStart(2, '0')).join('');
}
const vec3 = h => rgbOf(h).map(v => v / 255);

// canvases
const CV = (w, h) => new OffscreenCanvas(Math.max(1, w | 0), Math.max(1, h | 0));
const C2D = c => c.getContext('2d');
const _cache = new Map();
// deterministic lazy cache: builder must depend only on the key
function cached(key, build) {
  let v = _cache.get(key);
  if (v === undefined) { v = build(); _cache.set(key, v); }
  return v;
}
function layer(key, w, h, paint) {
  return cached(key, () => { const c = CV(w, h); paint(C2D(c), w, h); return c; });
}
// scratch layers are cleared on every use, so they carry no state between frames
const _scratch = new Map();
function scratch(name, w = W, h = H) {
  let c = _scratch.get(name);
  if (!c || c.width !== w || c.height !== h) { c = CV(w, h); _scratch.set(name, c); }
  const x = C2D(c);
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none';
  x.shadowBlur = 0; x.shadowColor = 'transparent'; x.shadowOffsetX = 0; x.shadowOffsetY = 0;
  x.clearRect(0, 0, w, h);
  return [c, x];
}
function withCtx(ctx, fn) { ctx.save(); try { fn(ctx); } finally { ctx.restore(); } }
// camera transform: zoom about (cx,cy), pan (px,py), roll r
function cam(ctx, z = 1, px = 0, py = 0, r = 0, cx = W / 2, cy = H / 2) {
  ctx.translate(cx + px, cy + py);
  if (r) ctx.rotate(r);
  ctx.scale(z, z);
  ctx.translate(-cx, -cy);
}
