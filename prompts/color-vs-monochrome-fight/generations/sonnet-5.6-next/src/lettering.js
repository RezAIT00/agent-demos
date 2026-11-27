// lettering.js — brush lettering drawn from our own stroke data (GLYPHS is injected by the build). No fonts.
const GLYPH_NARROW = { 'I': 0.72, '1': 0.8, '.': 0.42, ',': 0.42, ':': 0.42, '!': 0.42, ' ': 0.66, "'": 0.36, '(': 0.55, ')': 0.55 };
function glyphAdvance(ch) { return (GLYPH_NARROW[ch] !== undefined ? GLYPH_NARROW[ch] : (ch === 'M' || ch === 'W' ? 1.12 : 1.0)) * 4; }
function textWidth(text, size, tracking = 1.35) {
  let w = 0; for (const c of text.toUpperCase()) w += glyphAdvance(c) + tracking;
  return (w - tracking) * size / 6;
}
function brushStroke(ctx, pts, w, t0, t1) {
  if (pts.length < 2) return;
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = lens[lens.length - 1] || 1;
  const res = [];
  const step = Math.max(1.2, w * 0.28);
  for (let d = 0, i = 1; ; d += step) {
    const dd = Math.min(d, L);
    while (i < pts.length - 1 && lens[i] < dd) i++;
    const u = (dd - lens[i - 1]) / Math.max(1e-6, lens[i] - lens[i - 1]);
    res.push([lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u), dd / L]);
    if (dd >= L) break;
  }
  for (let i = 0; i < res.length - 1; i++) {
    const a = res[i], b = res[i + 1];
    const wa = w * lerp(t0, 1, smooth(0, 0.28, a[2])) * lerp(1, t1, smooth(0.6, 1, a[2]));
    const wb = w * lerp(t0, 1, smooth(0, 0.28, b[2])) * lerp(1, t1, smooth(0.6, 1, b[2]));
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    ctx.beginPath();
    ctx.moveTo(a[0] + nx * wa / 2, a[1] + ny * wa / 2); ctx.lineTo(b[0] + nx * wb / 2, b[1] + ny * wb / 2);
    ctx.lineTo(b[0] - nx * wb / 2, b[1] - ny * wb / 2); ctx.lineTo(a[0] - nx * wa / 2, a[1] - ny * wa / 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(b[0], b[1], wb / 2, 0, TAU); ctx.fill();
    if (i === 0) { ctx.beginPath(); ctx.arc(a[0], a[1], wa / 2, 0, TAU); ctx.fill(); }
  }
}
function partialPolyline(pts, u) {
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = lens[lens.length - 1] * u;
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (lens[i] <= L) out.push(pts[i]);
    else { const k = (L - lens[i - 1]) / Math.max(1e-6, lens[i] - lens[i - 1]); out.push([lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]); break; }
  }
  return out;
}
// opts: color, weight (fraction of size), align, outline, outlineWidth, taper0, taper1, progress 0..1, slant, tracking
function drawText(ctx, text, x, y, size, opts = {}) {
  const s = size / 6, tr = opts.tracking !== undefined ? opts.tracking : 1.35;
  const W = textWidth(text, size, tr);
  let cx = x - (opts.align === 'center' ? W / 2 : (opts.align === 'right' ? W : 0));
  const w = size * (opts.weight || 0.13);
  const strokes = [];
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch];
    const narrow = GLYPH_NARROW[ch] !== undefined ? (glyphAdvance(ch) - 4) / 2 : (ch === 'M' || ch === 'W' ? 0.24 : 0);
    if (g) for (const st of g) strokes.push(st.map(p => [cx + (p[0] + narrow) * s + (6 - p[1]) * s * (opts.slant || 0), y + p[1] * s]));
    cx += (glyphAdvance(ch) + tr) * s;
  }
  const prog = opts.progress !== undefined ? opts.progress : 1;
  const n = strokes.length;
  const passes = [];
  if (opts.outline) passes.push([opts.outline, w + (opts.outlineWidth || w * 0.8)]);
  passes.push([opts.color || '#000', w]);
  for (const [col, ww] of passes) {
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const u = clamp(prog * (n + 1.5) - i);
      if (u <= 0) continue;
      let pts = strokes[i];
      if (u < 1) pts = partialPolyline(pts, u);
      brushStroke(ctx, pts, ww, opts.taper0 !== undefined ? opts.taper0 : 0.85, opts.taper1 !== undefined ? opts.taper1 : 0.55);
    }
  }
  return W;
}
