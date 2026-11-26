// ---------- scalar / vector / matrix helpers ----------
const PI = Math.PI, TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, k) => a + (b - a) * k;
const invlerp = (a, b, x) => clamp((x - a) / (b - a));
const smooth = (a, b, x) => { const k = invlerp(a, b, x); return k * k * (3 - 2 * k); };
const fract = x => x - Math.floor(x);
const mix = lerp;
const easeIn = k => k * k * k;
const easeOut = k => 1 - Math.pow(1 - k, 3);
const easeInOut = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const easeOutBack = (k, s = 1.9) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
const easeOutExpo = k => k >= 1 ? 1 : 1 - Math.pow(2, -10 * k);

// deterministic hashing / noise
function hash(n) { let x = Math.imul((n | 0) ^ 0x5bd1e995, 0x27d4eb2d); x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; }
const hash2 = (a, b) => hash((Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663)) | 0);
function noise1(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash2(i, seed), hash2(i + 1, seed), u) * 2 - 1; }
function fbm1(x, seed = 0) { return noise1(x, seed) * 0.6 + noise1(x * 2.13, seed + 7) * 0.28 + noise1(x * 4.7, seed + 19) * 0.12; }
function rng(seed) { let k = 0; return () => hash2(seed, ++k); }

// vec3 (plain arrays)
const V = (x = 0, y = 0, z = 0) => [x, y, z];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const mad = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vlen = a => Math.hypot(a[0], a[1], a[2]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const vlerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const comb = (...terms) => { let x = 0, y = 0, z = 0; for (const [v, s] of terms) { x += v[0] * s; y += v[1] * s; z += v[2] * s; } return [x, y, z]; };
const rotAxis = (v, k, a) => { const c = Math.cos(a), s = Math.sin(a), kv = cross(k, v), kd = dot(k, v) * (1 - c); return [v[0] * c + kv[0] * s + k[0] * kd, v[1] * c + kv[1] * s + k[1] * kd, v[2] * c + kv[2] * s + k[2] * kd]; };
const rotZ = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; };
const rotY = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };

function bez3(a, b, c, d, t) { const m = 1 - t, w0 = m * m * m, w1 = 3 * m * m * t, w2 = 3 * m * t * t, w3 = t * t * t; return [a[0] * w0 + b[0] * w1 + c[0] * w2 + d[0] * w3, a[1] * w0 + b[1] * w1 + c[1] * w2 + d[1] * w3, a[2] * w0 + b[2] * w1 + c[2] * w2 + d[2] * w3]; }
function catmull(pts, t) { // t in [0,1] over whole polyline
  const n = pts.length - 1; let s = clamp(t) * n; let i = Math.min(n - 1, Math.floor(s)); s -= i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  const s2 = s * s, s3 = s2 * s, out = [0, 0, 0];
  for (let k = 0; k < 3; k++) out[k] = 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * s + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * s3);
  return out;
}
// piecewise-linear profile: [[u, v...], ...]
function profile(tab, u) {
  if (u <= tab[0][0]) return tab[0].slice(1);
  for (let i = 1; i < tab.length; i++) if (u <= tab[i][0]) { const a = tab[i - 1], b = tab[i]; const k = (u - a[0]) / (b[0] - a[0]); const o = []; for (let j = 1; j < a.length; j++) o.push(a[j] + (b[j] - a[j]) * k); return o; }
  return tab[tab.length - 1].slice(1);
}
// two-bone IK. returns joint position. bend = preferred bend direction
function ik2(root, target, l1, l2, bend) {
  let d = sub(target, root); let D = vlen(d); const dn = norm(d);
  D = clamp(D, Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
  const a = (l1 * l1 - l2 * l2 + D * D) / (2 * D); const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let p = sub(bend, mul(dn, dot(bend, dn))); p = norm(p);
  return add(add(root, mul(dn, a)), mul(p, h));
}
function segDist(p1, q1, p2, q2) { // min distance between two segments
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2); const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s, t; const c = dot(d1, r), b = dot(d1, d2), den = a * e - b * b;
  s = den > 1e-9 ? clamp((b * f - c * e) / den) : 0; t = (b * s + f) / e;
  if (t < 0) { t = 0; s = clamp(-c / a); } else if (t > 1) { t = 1; s = clamp((b - c) / a); }
  return dist(mad(p1, d1, s), mad(p2, d2, t));
}

// ---------- mat4 (column major) ----------
const M4 = {
  id() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
  mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; },
  chain(...ms) { return ms.reduce((a, b) => M4.mul(a, b)); },
  T(v) { const m = M4.id(); m[12] = v[0]; m[13] = v[1]; m[14] = v[2]; return m; },
  S(x, y = x, z = x) { const m = M4.id(); m[0] = x; m[5] = y; m[10] = z; return m; },
  R(axis, a) { const [x, y, z] = norm(axis), c = Math.cos(a), s = Math.sin(a), t = 1 - c; return new Float32Array([t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0, t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0, t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0, 0, 0, 0, 1]); },
  Rx(a) { return M4.R([1, 0, 0], a); }, Ry(a) { return M4.R([0, 1, 0], a); }, Rz(a) { return M4.R([0, 0, 1], a); },
  // rotate about a pivot point
  about(p, r) { return M4.chain(M4.T(p), r, M4.T([-p[0], -p[1], -p[2]])); },
  pt(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; },
  dir(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]]; },
  perspective(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); },
  ortho(hw, hh, n, f) { return new Float32Array([1 / hw, 0, 0, 0, 0, 1 / hh, 0, 0, 0, 0, -2 / (f - n), 0, 0, 0, -(f + n) / (f - n), 1]); },
  lookAt(eye, tgt, up) { const z = norm(sub(eye, tgt)), x = norm(cross(up, z)), y = cross(z, x); return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]); },
  invert(m) {
    const o = new Float32Array(16); const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det; o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  }
};

// camera: {pos, tgt, fov(deg vertical), roll(rad)}
function camMatrices(c, asp = 16 / 9) {
  const fwd = norm(sub(c.tgt, c.pos)); let up = [0, 1, 0];
  if (Math.abs(fwd[1]) > 0.995) up = [1, 0, 0];
  if (c.roll) up = rotAxis(up, fwd, c.roll);
  const view = M4.lookAt(c.pos, c.tgt, up), proj = M4.perspective((c.fov || 30) * D2R, asp, c.near || 0.03, c.far || 400);
  const vp = M4.mul(proj, view);
  const right = norm(cross(fwd, up)), tup = cross(right, fwd);
  return { view, proj, vp, ivp: M4.invert(vp), pos: c.pos, fwd, right, up: tup, fov: c.fov || 30 };
}
// world -> screen pixels (1920x1080, y down)
function project(cm, p, W = 1920, H = 1080) {
  const m = cm.vp; const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return [(x / w * 0.5 + 0.5) * W, (0.5 - y / w * 0.5) * H, w];
}
// pixels per world unit at point p
function pxPerUnit(cm, p, H = 1080) { const d = Math.max(0.05, dot(sub(p, cm.pos), cm.fwd)); return H / (2 * Math.tan(cm.fov * D2R / 2) * d); }
