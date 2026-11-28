// ---------------------------------------------------------------- utilities
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const D2R = Math.PI / 180;

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Monotone cubic (Fritsch–Carlson) keyframe track: no overshoot, C1 smooth.
function track(keys) {
  const n = keys.length;
  const xs = keys.map((k) => k[0]);
  const dim = Array.isArray(keys[0][1]) ? keys[0][1].length : 0;
  const one = (ys) => {
    const d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
    m[0] = d[0] || 0; m[n - 1] = d[n - 2] || 0;
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return (x) => {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      let i = 0; while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] +
        (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  };
  if (!dim) return one(keys.map((k) => k[1]));
  const fs = [];
  for (let c = 0; c < dim; c++) fs.push(one(keys.map((k) => k[1][c])));
  return (x) => fs.map((f) => f(x));
}

// Integral table of an analytic speed function, so particle motion is a pure
// function of film time.
function integralTable(fn, t1, n) {
  const tab = new Float64Array(n + 1);
  const h = t1 / n;
  for (let i = 1; i <= n; i++) tab[i] = tab[i - 1] + fn((i - 0.5) * h) * h;
  return (t) => {
    const x = clamp(t / h, 0, n - 1e-6), i = Math.floor(x);
    return lerp(tab[i], tab[i + 1], x - i);
  };
}
