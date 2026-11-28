// Shared maths, drawing helpers and the audio-timing queries.
'use strict';
const W = 1920, H = 1080, TAU = Math.PI * 2;
const D = window.DATA;

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const smooth = t => t * t * (3 - 2 * t);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const expoOut = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
const backOut = (t, s = 2.2) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const onTwos = t => Math.floor(t * 12 + 1e-4) / 12;
const mix2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  return lerp(hash(i + seed * 57.3), hash(i + 1 + seed * 57.3), smooth(f)) * 2 - 1;
}

const BAR = D.bar, BEAT = D.beat;
// Bars are numbered as in the first cut; from VERSE_AT on they move back to make room for the sung verse.
const VERSE_AT = 8, VERSE_BARS = 8;
const barT = (bar, beat = 0) => D.songAt + (bar >= VERSE_AT ? bar + VERSE_BARS : bar) * BAR + beat * BEAT;
const rawT = (bar, beat = 0) => D.songAt + bar * BAR + beat * BEAT; // verse bars 8-15, numbered as they are in the song
const songBeat = t => (t - D.songAt) / BEAT;
const beatPulse = (t, decay = 6) => t < D.songAt ? 0 : Math.exp(-(songBeat(t) % 1) * decay);

const byInst = {};
for (const e of D.events) (byInst[e.i] ||= []).push(e);

// 1 at a note's start, falling away; stays raised while the note is held.
function hitEnv(inst, t, decay = 0.14, roles = null) {
  const list = byInst[inst];
  if (!list) return 0;
  let v = 0;
  for (const e of list) {
    if (e.t > t) break;
    if (t - e.t > e.d + decay * 6 || (roles && !roles.includes(e.r))) continue;
    const held = t < e.t + e.d ? 0.45 : 0;
    const after = Math.max(0, t - e.t);
    v = Math.max(v, Math.exp(-after / decay), held * Math.exp(-Math.max(0, t - e.t - e.d) / decay));
  }
  return clamp(v);
}
// the events of one instrument that started in the last `span` seconds
function recent(inst, t, span, roles = null) {
  return (byInst[inst] || []).filter(e => e.t <= t && t - e.t < span && (!roles || roles.includes(e.r)));
}
function activeNote(t, role, inst) {
  const list = byInst[inst] || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (e.r === role && t >= e.t && t < e.t + e.d) return e;
  }
  return null;
}
// How wide the heroine's mouth is while she "sings" the vocal line.
function singOpen(t) {
  const n = vocalAt(t);
  if (!n) return 0;
  const a = clamp((t - n.t) / 0.07), r = clamp((n.t + n.d - t) / 0.1);
  return a * r * (0.82 + 0.18 * Math.sin(t * 34));
}
const mixEnv = t => D.env.mix[clamp(Math.floor(t * 60), 0, D.env.mix.length - 1)] || 0;

// ------------------------------------------------------------ drawing helpers
function mk(w = W, h = H) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function poly(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
// Smooth closed or open curve through points (Catmull-Rom). A point with a
// third value of 1 is a sharp corner (hair tips, claws, lashes).
function spline(ctx, pts, close = true, move = true) {
  const n = pts.length, at = i => close ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
  if (move) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); }
  const last = close ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const k1 = p1[2] ? 0 : 1 / 6, k2 = p2[2] ? 0 : 1 / 6;
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k1, p1[1] + (p2[1] - p0[1]) * k1,
      p2[0] - (p3[0] - p1[0]) * k2, p2[1] - (p3[1] - p1[1]) * k2, p2[0], p2[1]);
  }
  if (close) ctx.closePath();
}
function paint(ctx, fill, stroke, lw = 4) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); }
function ellipse(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU); }
function lin(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((s, i) => Array.isArray(s) ? g.addColorStop(s[0], s[1]) : g.addColorStop(i / (stops.length - 1), s));
  return g;
}
function rad(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach((s, i) => Array.isArray(s) ? g.addColorStop(s[0], s[1]) : g.addColorStop(i / (stops.length - 1), s));
  return g;
}
function glow(ctx, x, y, r, color, a = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  ctx.fillStyle = rad(ctx, x, y, 0, r, [[0, color], [0.35, color + '88'], [1, color + '00']]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}
function inCam(ctx, cx, cy, zoom, rot, fn, px = W / 2, py = H / 2) {
  ctx.save();
  ctx.translate(px, py); ctx.rotate(rot); ctx.scale(zoom, zoom); ctx.translate(-cx, -cy);
  fn(); ctx.restore();
}
// A tapered, curved ribbon along a spine; width(u) gives half-width at 0..1.
function ribbon(ctx, spine, width) {
  const L = [], R = [], n = spine.length;
  for (let i = 0; i < n; i++) {
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
    const w = width(i / (n - 1));
    L.push([spine[i][0] - dy * w, spine[i][1] + dx * w]);
    R.push([spine[i][0] + dy * w, spine[i][1] - dx * w]);
  }
  poly(ctx, L.concat(R.reverse()));
}
// Spine for hair, scarves and streamers: starts at (x,y), heads along `ang`,
// and waves more the further it gets from the root.
function flow(x, y, ang, len, t, { amp = 30, freq = 2.2, speed = 7, droop = 0, phase = 0, n = 18 } = {}) {
  const pts = [];
  let px = x, py = y, a = ang;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const wob = Math.sin(u * freq * Math.PI - t * speed + phase) * amp * u;
    pts.push([px - Math.sin(a) * wob, py + Math.cos(a) * wob]);
    a += droop / n;
    px += Math.cos(a) * len / (n - 1); py += Math.sin(a) * len / (n - 1);
  }
  return pts;
}
