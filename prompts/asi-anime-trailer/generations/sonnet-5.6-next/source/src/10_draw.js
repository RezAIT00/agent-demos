'use strict';
// ---------------------------------------------------------------------------
// vector drawing: path parsing, tapered ink, cel fills, glows, speed lines
// ---------------------------------------------------------------------------
const _pcache = new Map();
function parsePath(d) {
  let r = _pcache.get(d);
  if (r) return r;
  const tok = d.match(/[MLCQZmlcqz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const cmdRe = /^[MLCQZmlcqz]$/;
  const subs = []; let cur = null, i = 0, cmd = 'M', x = 0, y = 0, sx = 0, sy = 0;
  const num = () => parseFloat(tok[i++]);
  while (i < tok.length) {
    if (cmdRe.test(tok[i])) cmd = tok[i++];
    const C = cmd.toUpperCase(), rel = cmd !== C;
    const px = () => num() + (rel ? x : 0), py = () => num() + (rel ? y : 0);
    if (C === 'M') { const a = px(), b = py(); x = a; y = b; sx = x; sy = y; cur = [['M', x, y]]; subs.push(cur); cmd = rel ? 'l' : 'L'; }
    else if (C === 'L') { const a = px(), b = py(); x = a; y = b; cur.push(['L', x, y]); }
    else if (C === 'C') { const a = px(), b = py(), c = px(), e = py(), f = px(), h = py(); x = f; y = h; cur.push(['C', a, b, c, e, x, y]); }
    else if (C === 'Q') { const a = px(), b = py(), c = px(), e = py(); x = c; y = e; cur.push(['Q', a, b, x, y]); }
    else if (C === 'Z') { cur.push(['L', sx, sy]); x = sx; y = sy; if (i < tok.length && !cmdRe.test(tok[i])) cmd = 'M'; }
  }
  if (_pcache.size < 6000) _pcache.set(d, subs);
  return subs;
}
// sample one subpath into a polyline
function sampleSub(sub, res = 18) {
  const pts = []; let x = 0, y = 0;
  for (const s of sub) {
    if (s[0] === 'M') { x = s[1]; y = s[2]; pts.push([x, y]); }
    else if (s[0] === 'L') {
      const n = Math.max(1, Math.ceil(Math.hypot(s[1] - x, s[2] - y) / 40));
      for (let k = 1; k <= n; k++) pts.push([lerp(x, s[1], k / n), lerp(y, s[2], k / n)]);
      x = s[1]; y = s[2];
    } else if (s[0] === 'C') {
      for (let k = 1; k <= res; k++) {
        const t = k / res, m = 1 - t, a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, e = t * t * t;
        pts.push([a * x + b * s[1] + c * s[3] + e * s[5], a * y + b * s[2] + c * s[4] + e * s[6]]);
      }
      x = s[5]; y = s[6];
    } else if (s[0] === 'Q') {
      for (let k = 1; k <= res; k++) {
        const t = k / res, m = 1 - t, a = m * m, b = 2 * m * t, c = t * t;
        pts.push([a * x + b * s[1] + c * s[3], a * y + b * s[2] + c * s[4]]);
      }
      x = s[3]; y = s[4];
    }
  }
  return pts;
}
const polyOf = d => sampleSub(parsePath(d)[0]);

function polyPath(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
function fillPoly(ctx, pts, color) { polyPath(ctx, pts); ctx.fillStyle = color; ctx.fill(); }
function fillD(ctx, d, color) { ctx.fillStyle = color; ctx.fill(new Path2D(d)); }
function clipD(ctx, d, fn) { ctx.save(); ctx.clip(new Path2D(d)); try { fn(ctx); } finally { ctx.restore(); } }
// cel: base colour, then hard-edged tone shapes clipped to the base
function cel(ctx, baseD, base, tones = []) {
  const p = new Path2D(baseD);
  ctx.fillStyle = base; ctx.fill(p);
  if (!tones.length) return;
  ctx.save(); ctx.clip(p);
  for (const [d, c] of tones) { ctx.fillStyle = c; ctx.fill(new Path2D(d)); }
  ctx.restore();
}

// "line boil": a tiny re-drawn jitter that changes with each drawing on twos
function boilPts(pts, amp, seed) {
  if (!amp) return pts;
  return pts.map((p, i) => [p[0] + vnoise(i * .23, seed) * amp, p[1] + vnoise(i * .23, seed + 977) * amp]);
}

// tapered ink stroke: a filled polygon whose width swells and thins
function taper(ctx, pts, w, o = {}) {
  const n = pts.length; if (n < 2) return;
  const t0 = o.t0 ?? .22, t1 = o.t1 ?? .35, min = o.min ?? .06, reveal = o.reveal ?? 1;
  if (reveal <= 0) return;
  const len = [0];
  for (let i = 1; i < n; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = len[n - 1] || 1, stop = total * reveal;
  const L = [], R = []; let lastw = 0, lastp = null;
  for (let i = 0; i < n; i++) {
    let p = pts[i], l = len[i];
    let end = false;
    if (l > stop) {
      const a = pts[i - 1], f = (stop - len[i - 1]) / Math.max(1e-6, l - len[i - 1]);
      p = mix2(a, p, f); l = stop; end = true;
    }
    const s = l / total;
    let k = 1;
    if (t0 > 0 && s < t0) k = Math.min(k, min + (1 - min) * Math.sin((s / t0) * Math.PI / 2));
    if (t1 > 0 && s > 1 - t1) k = Math.min(k, min + (1 - min) * Math.sin(((1 - s) / t1) * Math.PI / 2));
    if (o.wf) k *= o.wf(s);
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
    const hw = w * k / 2;
    L.push([p[0] - dy * hw, p[1] + dx * hw]); R.push([p[0] + dy * hw, p[1] - dx * hw]);
    lastw = hw; lastp = p;
    if (end) break;
  }
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
  for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
  if (o.color) ctx.fillStyle = o.color;
  ctx.fill();
  if (o.round && lastp) { ctx.beginPath(); ctx.arc(lastp[0], lastp[1], lastw, 0, TAU); ctx.fill(); }
}
// ink along an SVG-like path string (each subpath is its own stroke)
function ink(ctx, d, w, o = {}) {
  const subs = parsePath(d);
  for (let k = 0; k < subs.length; k++) {
    let pts = sampleSub(subs[k]);
    if (o.boil) pts = boilPts(pts, o.boil, (o.seed || 0) + k * 31);
    taper(ctx, pts, w, o);
  }
}
// cubic bezier sampled directly
function bezPts(a, b, c, d, n = 24) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, m = 1 - t;
    out.push([m * m * m * a[0] + 3 * m * m * t * b[0] + 3 * m * t * t * c[0] + t * t * t * d[0],
      m * m * m * a[1] + 3 * m * m * t * b[1] + 3 * m * t * t * c[1] + t * t * t * d[1]]);
  }
  return out;
}
// Catmull-Rom through control points
function spline(P, n = 10) {
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(P[P.length - 1]);
  return out;
}

// ---- light ----------------------------------------------------------------
function glow(ctx, x, y, r, color, a = 1) {
  if (r <= 0 || a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(.25, rgba(color, a * .55));
  g.addColorStop(.6, rgba(color, a * .15)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function dot(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fill(); }
function ell(ctx, x, y, rx, ry, color, rot = 0) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU); ctx.fill(); }
// four-point glint
function sparkle(ctx, x, y, r, color = '#ffffff', a = 1, rot = 0) {
  if (r <= 0 || a <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha *= a; ctx.fillStyle = color;
  ctx.beginPath();
  const k = r * .09;
  ctx.moveTo(0, -r); ctx.quadraticCurveTo(k, -k, r, 0); ctx.quadraticCurveTo(k, k, 0, r);
  ctx.quadraticCurveTo(-k, k, -r, 0); ctx.quadraticCurveTo(-k, -k, 0, -r);
  ctx.fill(); ctx.restore();
}
// anime lens flare: streak, halo and ghosts along the line through screen centre
function lensFlare(ctx, x, y, a = 1, tint = '#ffd9a0') {
  if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y, 420, tint, .55 * a);
  glow(ctx, x, y, 110, '#ffffff', .9 * a);
  const st = ctx.createLinearGradient(x - 900, y, x + 900, y);
  st.addColorStop(0, rgba('#6fb8ff', 0)); st.addColorStop(.5, rgba('#cfe8ff', .75 * a)); st.addColorStop(1, rgba('#6fb8ff', 0));
  ctx.fillStyle = st; ctx.beginPath(); ctx.ellipse(x, y, 900, 3.2, 0, 0, TAU); ctx.fill();
  const dx = W / 2 - x, dy = H / 2 - y;
  const gh = [[.45, 34, '#7fe8ff', .16], [.8, 70, '#ff9ecb', .09], [1.25, 22, '#fff2c0', .22], [1.6, 110, '#8aa8ff', .08], [2.05, 48, '#9fffd8', .1]];
  for (const [k, r, c, al] of gh) {
    const gx = x + dx * k, gy = y + dy * k;
    ctx.fillStyle = rgba(c, al * a);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + .3; ctx.lineTo(gx + Math.cos(an) * r, gy + Math.sin(an) * r); }
    ctx.fill();
  }
  ctx.strokeStyle = rgba('#ffd0f0', .12 * a); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, 190, 0, TAU); ctx.stroke();
  ctx.restore();
}
// radial speed lines (impact / focus lines)
function focusLines(ctx, cx, cy, o = {}) {
  const n = o.n ?? 140, r0 = o.r0 ?? 420, r1 = o.r1 ?? 1400, R = rng((o.seed ?? 1) * 7919 + 13);
  ctx.fillStyle = o.color ?? 'rgba(255,255,255,0.85)';
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, inner = r0 * R.range(.85, 1.45), wd = (o.w ?? 14) * R.range(.25, 1.4);
    const ca = Math.cos(a), sa = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(cx + ca * inner, cy + sa * inner);
    ctx.lineTo(cx + ca * r1 - sa * wd, cy + sa * r1 + ca * wd);
    ctx.lineTo(cx + ca * r1 + sa * wd, cy + sa * r1 - ca * wd);
    ctx.fill();
  }
}
// parallel streaks, for travel and wind
function streaks(ctx, o = {}) {
  const n = o.n ?? 60, R = rng((o.seed ?? 1) * 104729 + 3), ang = o.angle ?? 0;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(ang);
  const color = o.color ?? '#ffffff';
  for (let i = 0; i < n; i++) {
    const y = R.range(-900, 900), len = R.range(200, 900), sp = R.range(.6, 1.4) * (o.speed ?? 3000);
    let x = R.range(-1600, 1600) + (o.t ?? 0) * sp;
    x = ((x + 1600) % 3200 + 3200) % 3200 - 1600;
    const th = R.range(1, o.w ?? 5);
    ctx.fillStyle = rgba(color, R.range(.2, 1) * (o.a ?? .7));
    ctx.beginPath(); ctx.moveTo(x - len, y); ctx.lineTo(x, y - th / 2); ctx.lineTo(x + len * .08, y); ctx.lineTo(x, y + th / 2); ctx.fill();
  }
  ctx.restore();
}
// drifting motes: analytic positions, so any frame can be drawn on its own
function motes(ctx, t, o = {}) {
  const n = o.n ?? 80, R = rng(o.seed ?? 5);
  for (let i = 0; i < n; i++) {
    const bx = R.range(0, W), by = R.range(0, H), s = R.range(o.s0 ?? 1, o.s1 ?? 4), ph = R() * TAU, sp = R.range(.4, 1.6);
    let x = bx + Math.sin(t * .6 * sp + ph) * 30 + (o.vx ?? 0) * t * sp, y = by + Math.cos(t * .45 * sp + ph) * 20 + (o.vy ?? -12) * t * sp;
    x = ((x % (W + 40)) + W + 40) % (W + 40) - 20; y = ((y % (H + 40)) + H + 40) % (H + 40) - 20;
    const tw = .55 + .45 * Math.sin(t * 2.2 * sp + ph * 3);
    glow(ctx, x, y, s * 5, o.color ?? '#ffe6b0', .35 * tw * (o.a ?? 1));
    dot(ctx, x, y, s * .6, rgba(o.color ?? '#ffe6b0', .9 * tw * (o.a ?? 1)));
  }
}
function linGrad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [k, c] of stops) g.addColorStop(k, c);
  return g;
}
function radGrad(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [k, c] of stops) g.addColorStop(k, c);
  return g;
}
function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
// camera shake with exponential decay after a hit at time t0
function shake(t, t0, amp = 22, decay = 7) {
  const u = t - t0;
  if (u < 0 || u > 1.2) return [0, 0];
  const k = amp * Math.exp(-u * decay), i = Math.floor(u * 24);
  return [(hash2(i, 11) * 2 - 1) * k, (hash2(i, 12) * 2 - 1) * k];
}
