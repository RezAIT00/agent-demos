// Canvas2D helpers shared by all scenes.

// sub-path for a capsule whose two ends have different radii
function capsulePath(c, x1, y1, r1, x2, y2, r2) {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
  if (d <= Math.abs(r1 - r2) + 0.01) {
    const [x, y, r] = r1 > r2 ? [x1, y1, r1] : [x2, y2, r2];
    c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); return;
  }
  const a = Math.atan2(dy, dx), th = Math.acos(clamp((r1 - r2) / d, -1, 1));
  c.moveTo(x1 + Math.cos(a + th) * r1, y1 + Math.sin(a + th) * r1);
  c.arc(x1, y1, r1, a + th, a - th + TAU);
  c.arc(x2, y2, r2, a - th, a + th);
  c.closePath();
}
function capsule(c, x1, y1, r1, x2, y2, r2) { c.beginPath(); capsulePath(c, x1, y1, r1, x2, y2, r2); c.fill(); }
// chain of [x, y, r] joints, filled as one union
function chain(c, pts) {
  c.beginPath();
  for (let i = 0; i + 1 < pts.length; i++) capsulePath(c, ...pts[i], ...pts[i + 1]);
  c.fill();
}
function disc(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0, r), 0, TAU); c.fill(); }
function oval(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU); c.fill(); }
function poly(c, pts, close = true) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  if (close) c.closePath();
}
function fillPoly(c, pts) { poly(c, pts); c.fill(); }
// closed Catmull-Rom spline through the points
function blobPath(c, pts, tension = 0.5) {
  const n = pts.length;
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const k = tension / 3;
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k,
      p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
  }
  c.closePath();
}
function blob(c, pts, tension) { blobPath(c, pts, tension); c.fill(); }
// an SVG-like path string, scaled and placed
const PATHS = new Map();
function shape(c, d, x, y, sx = 1, sy = sx, rot = 0) {
  let p = PATHS.get(d);
  if (!p) PATHS.set(d, p = new Path2D(d));
  c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(sx, sy); c.fill(p); c.restore();
}

// additive soft light on the glow layer
function glow(c, x, y, r, color, a = 1) {
  if (a <= 0.003 || r <= 0) return;
  const col = hex(color);
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgb(col, clamp(a)));
  g.addColorStop(0.35, rgb(col, clamp(a * 0.38)));
  g.addColorStop(1, rgb(col, 0));
  const op = c.globalCompositeOperation;
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  c.globalCompositeOperation = op;
}
// soft colour pool in normal blending (mist, haze, smoke)
function puff(c, x, y, rx, ry, color, a) {
  if (a <= 0.003 || rx <= 0 || ry <= 0) return;
  const col = hex(color);
  c.save(); c.translate(x, y); c.scale(rx, ry);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, rgb(col, clamp(a))); g.addColorStop(0.55, rgb(col, clamp(a * 0.55))); g.addColorStop(1, rgb(col, 0));
  c.fillStyle = g; c.fillRect(-1, -1, 2, 2);
  c.restore();
}

// rising sparks: each is a pure function of time
function sparks(c, x, y, t, o = {}) {
  const { n = 40, spread = 60, height = 300, size = 2.4, alpha = 1, wind = 0, seed = 3, color = '#ffb255', speed = 1 } = o;
  if (alpha <= 0.003) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const per = (1.0 + hash2(i, seed) * 1.8) / speed;
    const q = t / per + hash2(i, seed + 1);
    const k = Math.floor(q), f = q - k;
    const r = (j) => hash2(i * 131 + k, seed + j);
    const pos = (u) => [
      x + (r(2) - 0.5) * spread + wind * u * u + Math.sin(u * (5 + r(3) * 6) + r(4) * 9) * 22 * u * (0.4 + r(5)),
      y - u * height * (0.35 + r(6) * 0.85) + 18 * u * u * r(7),
    ];
    const a = alpha * Math.sin(Math.min(1, f * 7) * PI / 2) * Math.pow(1 - f, 1.4) * (0.45 + 0.55 * r(8));
    if (a < 0.02) continue;
    const [x0, y0] = pos(Math.max(0, f - 0.025)), [x1, y1] = pos(f);
    c.globalAlpha = clamp(a);
    c.strokeStyle = color;
    c.lineWidth = size * (0.55 + r(9) * 0.8);
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1 + 0.01, y1); c.stroke();
  }
  c.restore();
}

// falling snow / drifting motes, wrapping around the frame
function snowfall(c, t, o = {}) {
  const { n = 420, alpha = 1, wind = 60, fall = 90, seed = 11, color = '#dbe9ff', y0 = -20, y1 = H + 20, size = 2.6 } = o;
  if (alpha <= 0.003) return;
  c.save();
  c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const d = hash2(i, seed);                       // depth
    const spd = fall * (0.4 + d);
    const y = y0 + mod(hash2(i, seed + 1) * (y1 - y0) + t * spd, y1 - y0);
    const x = mod(hash2(i, seed + 2) * (W + 200) + t * wind * (0.4 + d) + Math.sin(t * 1.3 + i) * 14, W + 200) - 100;
    c.globalAlpha = alpha * (0.25 + 0.65 * d);
    disc(c, x, y, size * (0.35 + d * d));
  }
  c.restore();
}

// a rolling ridgeline filled down to the bottom of the frame
function ridge(c, o) {
  const { y, amp, freq, seed = 1, scroll = 0, color, x0 = -40, x1 = W + 40, step = 8, oct = 4, bottom = H + 40, shapeFn } = o;
  c.beginPath(); c.moveTo(x0, bottom);
  for (let x = x0; x <= x1 + step; x += step) {
    let yy = y + (fbm1((x + scroll) * freq, seed, oct) - 0.5) * 2 * amp;
    if (shapeFn) yy = shapeFn(x, yy);
    c.lineTo(x, yy);
  }
  c.lineTo(x1 + step, bottom); c.closePath();
  c.fillStyle = color; c.fill();
}
const ridgeY = (x, o) => o.y + (fbm1((x + (o.scroll || 0)) * o.freq, o.seed ?? 1, o.oct ?? 4) - 0.5) * 2 * o.amp;

// vertical linear gradient helper
function vgrad(c, y0, y1, stops) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [p, col] of stops) g.addColorStop(p, col);
  return g;
}

// run fn with a camera: zoom about (ax, ay), then pan
function withCam(ctxs, cam, depth, fn) {
  const { x = 0, y = 0, z = 1, ax = 960, ay = 640 } = cam;
  const zz = 1 + (z - 1) * depth;
  for (const c of ctxs) {
    c.save();
    c.translate(ax, ay); c.scale(zz, zz); c.translate(-ax - x * depth, -ay - y * depth);
  }
  fn();
  for (const c of ctxs) c.restore();
}
// the same transform applied to a point (for lights and flames)
function camPoint(cam, depth, px, py) {
  const { x = 0, y = 0, z = 1, ax = 960, ay = 640 } = cam;
  const zz = 1 + (z - 1) * depth;
  return [ax + (px - ax - x * depth) * zz, ay + (py - ay - y * depth) * zz, zz];
}
const flick = (t, seed = 0) => 1 + (noise1(t * 7.5, seed) - 0.5) * 0.16 + (noise1(t * 17, seed + 9) - 0.5) * 0.08;
