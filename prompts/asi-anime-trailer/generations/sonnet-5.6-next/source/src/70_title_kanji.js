'use strict';
// ---------------------------------------------------------------------------
// 間 : a gate (門) with the sun (日) standing in the gap. Twelve brush strokes
// in the standard stroke order, drawn in a 100 x 100 box.
// [path, width, kind]  kind: 'v' upright, 'h' bar, 'hz' bar turning down,
// 'hg' bar turning down with a hook
// ---------------------------------------------------------------------------
const MA_KANJI = [
  // 門 left door
  { d: 'M 14.5 9 L 14.2 93', w: 6.2, k: 'v' },
  { d: 'M 16 12.6 L 40.6 12 L 40.4 47', w: 5.6, k: 'turn' },
  { d: 'M 16 27.6 L 38.6 27.2', w: 3.5, k: 'h' },
  { d: 'M 16 42.8 L 38.8 42.4', w: 3.5, k: 'h' },
  // 門 right door
  { d: 'M 59.6 10 L 59.4 47', w: 5.6, k: 'v' },
  { d: 'M 61 12.6 L 86 12 L 85.8 87 C 85.8 92.5 83 93.6 76.5 90.4', w: 5.8, k: 'hook' },
  { d: 'M 61 27.6 L 83.6 27.2', w: 3.5, k: 'h' },
  { d: 'M 61 42.8 L 83.8 42.4', w: 3.5, k: 'h' },
  // 日
  { d: 'M 35.8 53.4 L 35.6 91.6', w: 5.2, k: 'v' },
  { d: 'M 37.4 56 L 64.4 55.4 L 64.2 91', w: 5.2, k: 'turn' },
  { d: 'M 37.4 70.8 L 62.4 70.4', w: 3.4, k: 'h' },
  { d: 'M 37.4 85.8 L 62.4 85.4', w: 3.4, k: 'h' },
];
function brushStroke(ctx, st, p, color) {
  if (p <= 0) return;
  const pts = polyOf(st.d);
  // corners get a pressed shoulder, bars end on a small triangular rest
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.4)); for (let k = 0; k < n; k++) dense.push(mix2(a, b, k / n)); }
  dense.push(pts[pts.length - 1]);
  const wf = s => {
    if (st.k === 'v') return s < .08 ? 1.12 : s > .92 ? 1 - (s - .92) * 2.6 : 1 - .06 * Math.sin(s * Math.PI);
    if (st.k === 'h') return s < .1 ? 1.1 : s > .9 ? 1.18 : .9 + .08 * s;
    if (st.k === 'hook') return s > .93 ? Math.max(.14, 1 - (s - .93) * 12) : .96;
    return 1;
  };
  ctx.fillStyle = color;
  taper(ctx, dense, st.w, { t0: 0, t1: 0, wf, reveal: p });
  // the brush lands at an angle: a slanted entry on uprights, a soft one on bars
  const q = dense[0], w0 = st.w;
  if (st.k === 'v') fillPoly(ctx, [[q[0] - w0 * .62, q[1] + w0 * .06], [q[0] + w0 * .3, q[1] - w0 * .5], [q[0] + w0 * .62, q[1] + w0 * .2], [q[0] + w0 * .5, q[1] + w0 * .8], [q[0] - w0 * .54, q[1] + w0 * .8]], color);
  else { ctx.beginPath(); ctx.ellipse(q[0] + w0 * .1, q[1], w0 * .5, w0 * .46, -.5, 0, TAU); ctx.fill(); }
  // shoulders at the turns
  const corners = parsePath(st.d)[0].filter(s => s[0] === 'L').slice(0, -1);
  if (st.k === 'turn' || st.k === 'hook') {
    const first = parsePath(st.d)[0][1];
    if (first && p > .42) { const [cx, cy] = [first[1], first[2]]; fillPoly(ctx, [[cx - st.w * .7, cy - st.w * .62], [cx + st.w * .28, cy - st.w * .86], [cx + st.w * .74, cy + st.w * .36], [cx - st.w * .2, cy + st.w * .62]], color); }
  }
  if (st.k === 'h' && p > .96) {
    const e = dense[dense.length - 1], w = st.w;
    fillPoly(ctx, [[e[0] - w * 1.25, e[1] - w * .46], [e[0] - w * .1, e[1] - w * 1.28], [e[0] + w * .85, e[1] + w * .12], [e[0] + w * .2, e[1] + w * .56], [e[0] - w * 1.2, e[1] + w * .46]], color);
  }
}
// draw(0..1): written stroke by stroke. size = box height in px, (x,y) = centre
function drawMaKanji(ctx, g, x, y, size, progress, o = {}) {
  const k = size / 100;
  const each = st => clamp(progress * (MA_KANJI.length + .6) - st);
  ctx.save(); ctx.translate(x - 50 * k, y - 51 * k); ctx.scale(k, k);
  // the sun in the gate
  const sun = o.sun ?? 0;
  if (sun > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 50, 72, 48, '#ff8a3a', .5 * sun);
    ctx.restore();
    // two panes of low sun, deep enough that the white strokes stay crisp
    for (const [ry, rh] of [[58.4, 10.4], [73.2, 10.6]]) rect(ctx, 38, ry, 24.4, rh, linGrad(ctx, 0, 58, 0, 84, [[0, rgba('#ffb64e', sun)], [1, rgba('#f2603c', sun)]]));
    if (g) { g.save(); g.translate(x - 50 * k, y - 51 * k); g.scale(k, k); glow(g, 50, 72, 40, '#ff8a3a', .42 * sun); g.restore(); }
  }
  ctx.save(); ctx.translate(.7, 1.1);
  for (let i = 0; i < MA_KANJI.length; i++) brushStroke(ctx, MA_KANJI[i], E.inOutSine(each(i)), o.shadow ?? 'rgba(12,10,48,0.55)');
  ctx.restore();
  for (let i = 0; i < MA_KANJI.length; i++) brushStroke(ctx, MA_KANJI[i], E.inOutSine(each(i)), o.color ?? '#fffaf0');
  ctx.restore();
}
