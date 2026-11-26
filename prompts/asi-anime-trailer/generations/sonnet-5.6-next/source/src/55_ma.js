'use strict';
// ---------------------------------------------------------------------------
// MA (間): the superintelligence. A soft silhouette that is a window into deep
// blue. Constellations inside rewire as it thinks. The clock ring around its
// head turns in every shot and stops exactly once.
// ---------------------------------------------------------------------------

// ring speed in radians per second, keyframed over the whole film
const RING_KEYS = [[0, .55], [5, .45], [11, .55], [15, .8], [20.5, 1.0], [21.5, 2.4], [24.5, 5.5], [26.9, 10], [28, 13], [40, 13], [43, 7], [46, 2.2],
  [52.4, 2.2], [52.9, .12], [53.5, .1], [54.2, 6.5], [56.4, 6.5], [57, .3], [58, .22], [63.5, .3], [65, .55], [67.2, .3], [68.3, .09], [68.9, 0], [200, 0]];
const BLINK_START = 68.95, EYES_OPEN_T = 73.0;
function ringIntegral(t) {
  let acc = 0;
  for (let i = 0; i < RING_KEYS.length - 1; i++) {
    const [a, va] = RING_KEYS[i], [b, vb] = RING_KEYS[i + 1];
    if (t <= a) break;
    const u = Math.min(t, b) - a, d = b - a;
    acc += va * u + (vb - va) * u * u / (2 * d);
  }
  return acc;
}
const ringSpeed = t => {
  if (t >= EYES_OPEN_T) return 0;
  for (let i = 0; i < RING_KEYS.length - 1; i++) { const [a, va] = RING_KEYS[i], [b, vb] = RING_KEYS[i + 1]; if (t >= a && t < b) return lerp(va, vb, (t - a) / (b - a)); }
  return 0;
};
// after the blink the ring ticks like a clock, once per second, on her time
const TICK0 = 74.0;
function ringAngle(t) {
  if (t < BLINK_START) return ringIntegral(t);
  const stop = ringIntegral(BLINK_START);
  if (t < TICK0) return stop;
  const u = t - TICK0, n = Math.floor(u), f = u - n;
  return stop + (n + E.outBack(clamp(f / .16), 2.4)) * TAU / 24;
}
const thinkPhase = t => ringAngle(t) * .42 + t * .04;

const MA_NET = (() => {
  const R = rng(4242), nodes = [];
  let guard = 0;
  while (nodes.length < 120 && guard++ < 4000) {
    const x = R.range(-250, 250), y = R.range(-150, 470);
    if (nodes.every(n => (n.x - x) ** 2 + (n.y - y) ** 2 > 34 * 34)) nodes.push({ x, y, ph: R() * TAU, s: R() });
  }
  const edges = [], seen = new Set();
  nodes.forEach((a, i) => {
    nodes.map((b, j) => [j, (a.x - b.x) ** 2 + (a.y - b.y) ** 2]).filter(q => q[0] !== i).sort((p, q) => p[1] - q[1]).slice(0, 4).forEach(([j]) => {
      const k = i < j ? i + ':' + j : j + ':' + i;
      if (!seen.has(k)) { seen.add(k); edges.push([i, j]); }
    });
  });
  return { nodes, edges };
})();

function capsule(ctx, pts, w0, w1) {
  const P = pts.length > 2 ? spline(pts, 12) : bezPts(pts[0], mix2(pts[0], pts[1], .33), mix2(pts[0], pts[1], .66), pts[1], 12);
  taper(ctx, P, w0, { t0: 0, t1: 0, wf: s => lerp(1, w1 / w0, s) });
  const a = P[0], b = P[P.length - 1];
  ctx.beginPath(); ctx.arc(a[0], a[1], w0 / 2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(b[0], b[1], w1 / 2, 0, TAU); ctx.fill();
}
const MA_HEAD = 'M 0 -112 C 72 -114 120 -68 118 -6 C 116 54 74 98 0 106 C -74 98 -116 54 -118 -6 C -120 -68 -72 -114 0 -112 Z';
const MA_HEAD_PROFILE = 'M -8 -114 C 62 -116 108 -76 112 -22 C 113 -6 108 4 112 16 C 116 28 106 34 104 46 C 100 76 70 104 26 106 C -52 108 -112 58 -114 -10 C -116 -72 -68 -112 -8 -114 Z';

// two long ribbons trail from the nape in slow S-curves, as though under water
function maRibbons(ctx, td, o) {
  const wind = o.wind ?? 0, len = o.ribbonLen ?? 1;
  for (const [rx, ry, dirx, diry, k] of o.ribbons) {
    const P = [[rx * .55, ry - 8]], L = 380 * len, nx = -diry, ny = dirx;
    for (let i = 1; i <= 7; i++) {
      const q = i / 7;
      const wave = Math.sin(q * 6.1 - td * 2.2 + k * 2.6) * 52 * Math.pow(q, .8) * len;
      P.push([rx + dirx * q * L + nx * wave + wind * q * q * 200, ry + diry * q * L + ny * wave - 120 * q * q * len]);
    }
    taper(ctx, spline(P, 14), o.ribbonW ?? 34, { t0: .02, t1: .85, min: .05, wf: q => .7 + .3 * Math.sin(q * 8 + k * 2 - td * 1.4) });
  }
}
// body parts for each pose, drawn white into the mask
function maParts(ctx, pose, o, td) {
  const br = Math.sin(td * 1.5) * 3;
  if (pose === 'float' || pose === 'head') {
    ctx.fill(new Path2D(MA_HEAD));
    capsule(ctx, [[0, 84], [0, 130]], 52, 58);
    if (pose === 'head') {
      fillD(ctx, 'M -30 96 C -60 150 -168 158 -200 250 C -224 330 -230 430 -230 520 L 230 520 C 230 430 224 330 200 250 C 168 158 60 150 30 96 Z', ctx.fillStyle);
      return;
    }
    ctx.fill(new Path2D(`M -44 112 C -74 140 -62 ${196 + br} -54 232 C -62 262 -66 286 -52 298 C -26 318 26 318 52 298 C 66 286 62 262 54 232 C 62 ${196 + br} 74 140 44 112 C 20 100 -20 100 -44 112 Z`));
    const a = o.arms ?? [[[-46, 132], [-92, 196 + br], [-104, 262 + br]], [[46, 132], [92, 196 - br], [104, 262 - br]]];
    for (const arm of a) capsule(ctx, arm, 40, 17);
    const l = o.legs ?? [[[-26, 284], [-40, 372 + br], [-24, 460 + br]], [[26, 284], [44, 366 - br], [60, 446 - br]]];
    for (const leg of l) capsule(ctx, leg, 50, 7);
  } else if (pose === 'sit') {                       // side view, facing left
    ctx.fill(new Path2D(MA_HEAD));
    capsule(ctx, [[4, 84], [14, 134]], 52, 60);
    capsule(ctx, [[14, 140], [40, 215 + br * .4], [34, 292]], 92, 108);
    capsule(ctx, [[30, 292], [-72, 272], [-124, 266]], 78, 54);     // thigh
    capsule(ctx, [[-124, 268], [-140, 344], [-132 + br, 418]], 54, 24);
    capsule(ctx, [[46, 298], [-40, 300], [-90, 298]], 66, 48);
    capsule(ctx, [[-90, 298], [-90, 372], [-74 - br, 434]], 48, 22);
    const hand = o.hand ?? [-104, 264];
    capsule(ctx, [[2, 150], [-14, 232 + br * .3], hand], 44, 24);
    capsule(ctx, [[10, 262], [-70, 262]], 52, 44);
  } else if (pose === 'back') {                      // from behind, sitting
    ctx.fill(new Path2D(MA_HEAD));
    capsule(ctx, [[0, 84], [0, 140]], 56, 70);
    ctx.fill(new Path2D(`M -58 118 C -96 160 -92 ${250 + br} -100 330 C -64 356 64 356 100 330 C 92 ${250 + br} 96 160 58 118 C 26 104 -26 104 -58 118 Z`));
    capsule(ctx, [[-58, 142], [-104, 230], [-84, 300]], 36, 22);
    capsule(ctx, [[58, 142], [104, 230], [84, 300]], 36, 22);
  } else if (pose === 'profile') {                   // head and shoulders, facing right
    ctx.fill(new Path2D(MA_HEAD_PROFILE));
    capsule(ctx, [[-6, 80], [-24, 150]], 62, 74);
    fillD(ctx, 'M -50 108 C -120 156 -224 176 -258 292 C -276 366 -280 470 -280 600 L 190 600 C 190 440 170 322 122 246 C 84 190 34 168 18 112 Z', ctx.fillStyle);
  }
}
const MA_RIBBONS = {
  float: [[-84, 46, -.93, .3, 1], [84, 40, .97, .12, 2]],
  head: [[-88, 52, -.92, .36, 1], [88, 46, .96, .2, 2]],
  sit: [[84, 26, .99, -.02, 1], [66, 66, .88, .42, 2]],
  back: [[40, 74, .9, .42, 1], [62, 40, .99, .02, 2]],
  profile: [[-90, 40, -.99, .1, 1], [-70, 74, -.86, .48, 2]],
};
function maEyes(ctx, g, M, o) {
  const pose = o.pose, e = o.eyes ?? {};
  if (pose === 'back' && !o.peek) return;
  const k = clamp(e.k ?? 0), mode = e.mode ?? 'open', look = e.look ?? [0, 0];
  let spots = [[-41, 10], [41, 10]];
  if (pose === 'sit') spots = [[-70, 8], [-8, 12]];
  if (pose === 'profile') spots = [[70, 6]];
  if (pose === 'back') spots = [[-92, 6]];
  const sx = pose === 'profile' ? .72 : 1;
  for (let i = 0; i < spots.length; i++) {
    const ex = spots[i][0] + look[0], ey = spots[i][1] + look[1];
    const narrow = pose === 'sit' && i === 0 ? .72 : pose === 'back' ? .6 : 1;
    const wide = mode === 'wide' ? 1.3 : 1;
    const gl = (x, y, r, a) => { glow(ctx, x, y, r, '#ffe9a8', a); if (g) { g.save(); g.setTransform(M); glow(g, x, y, r * 1.1, '#ffdc8a', a * 1.2); g.restore(); } };
    if (mode === 'happy') {
      gl(ex, ey, 42, .45);
      ink(ctx, `M ${ex - 19 * narrow * sx} ${ey + 8} C ${ex - 8} ${ey - 17} ${ex + 8} ${ey - 17} ${ex + 19 * narrow * sx} ${ey + 8}`, 10, { color: '#fff6d2', t0: .3, t1: .3, min: .35 });
    } else if (mode === 'shut' || k > .82) {
      gl(ex, ey + 6, 30, .22);
      ink(ctx, `M ${ex - 18 * narrow * sx} ${ey + 2} C ${ex - 8} ${ey + 17} ${ex + 8} ${ey + 17} ${ex + 18 * narrow * sx} ${ey + 2}`, 7.5, { color: '#f3e8c4', t0: .3, t1: .3, min: .3 });
    } else {
      const rx = 12.5 * narrow * sx * wide, ry = 20 * wide * (1 - k * .9) * (mode === 'half' ? .55 : 1);
      gl(ex, ey, 46 * wide, .5);
      ell(ctx, ex, ey + (mode === 'half' ? 7 : 0) + k * 6, rx, ry, '#fff6d6');
      ell(ctx, ex - rx * .22, ey - ry * .34 + k * 6, rx * .42, ry * .28, '#ffffff');
    }
  }
}
// the clock ring: back half behind the head, front half in front
function maRing(ctx, g, M, t, o, front) {
  const R = o.ring ?? {}; if (R.a === 0) return;
  const cx = R.x ?? (o.pose === 'profile' ? -6 : 0), cy = R.y ?? -34;
  const rx = R.r ?? 188, ry = rx * (R.flat ?? .27), roll = R.roll ?? -.2, th = ringAngle(t);
  const spd = ringSpeed(t), blur = clamp((spd - 2.5) / 8), alpha = R.a ?? 1;
  const stopped = t >= BLINK_START && t < TICK0;
  const col = stopped ? '#7f94c4' : '#d6f6ff';
  const cr = Math.cos(roll), sr = Math.sin(roll), lwk = 1 / Math.pow(Math.max(1, o.s ?? 1), .55);
  const pt = (a, k = 1) => { const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k; return [cx + x * cr - y * sr, cy + x * sr + y * cr]; };
  const half = front ? [0, Math.PI] : [Math.PI, TAU];
  const stroke = (k, lw, style) => {
    ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const p = pt(lerp(half[0], half[1], i / 40), k); ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1]); }
    ctx.stroke();
  };
  ctx.save(); ctx.globalAlpha *= alpha * (front ? 1 : .55); ctx.lineCap = 'round';
  stroke(1, (3.2 + blur * 2) * lwk, rgba(col, .78));
  stroke(.86, 1.4 * lwk, rgba(col, .34));
  if (blur > 0) { stroke(1.07, 10 * blur, rgba('#8fe8ff', .22 * blur)); stroke(.93, 16 * blur, rgba('#bdf3ff', .18 * blur)); }
  if (g) {
    g.save(); g.setTransform(M); g.strokeStyle = rgba('#9fe6ff', (stopped ? .1 : .5 + blur * .4) * alpha); g.lineWidth = 7; g.beginPath();
    for (let i = 0; i <= 40; i++) { const p = pt(lerp(half[0], half[1], i / 40), 1); g[i ? 'lineTo' : 'moveTo'](p[0], p[1]); }
    g.stroke(); g.restore();
  }
  for (let i = 0; i < 24; i++) {
    let a = (th + i * TAU / 24) % TAU; if (a < 0) a += TAU;
    if (!(a >= half[0] && a < half[1])) continue;
    const big = i % 6 === 0;
    const p = pt(a, big ? 1.13 : 1.065), q = pt(a, big ? .9 : .96);
    ctx.strokeStyle = rgba(big ? '#fff4cf' : col, (1 - blur * .75) * (big ? 1 : .8)); ctx.lineWidth = (big ? 6 : 3) * lwk;
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    if (blur > .05 && big) {
      ctx.strokeStyle = rgba('#fff4cf', .75 * blur); ctx.lineWidth = 4; ctx.beginPath();
      for (let j = 0; j <= 10; j++) { const s = pt(a - j * .09 * blur * 1.8, 1.02); ctx[j ? 'lineTo' : 'moveTo'](s[0], s[1]); }
      ctx.stroke();
    }
  }
  // the one bright hand
  let hnd = (th * 1.0) % TAU; if (hnd < 0) hnd += TAU;
  if (hnd >= half[0] && hnd < half[1]) { const p = pt(hnd, 1); dot(ctx, p[0], p[1], 8 * lwk, '#fffbe6'); glow(ctx, p[0], p[1], 34 * lwk, '#fff1c0', .7); }
  ctx.restore();
}
function maNetwork(ctx, t, o) {
  const ph = thinkPhase(t), think = o.think ?? .5, dim = o.dim ?? 0;
  if (dim >= 1) return;
  const A = 1 - dim;
  const pos = MA_NET.nodes.map(n => [n.x + Math.sin(ph * 1.3 + n.ph) * 7, n.y + Math.cos(ph * 1.1 + n.ph * 2) * 7]);
  const lk = 1 / Math.pow(Math.max(1, o.s ?? 1), .5);
  ctx.lineWidth = 1.5 * lk; ctx.lineCap = 'round';
  for (let i = 0; i < MA_NET.edges.length; i++) {
    const [a, b] = MA_NET.edges[i];
    const x = ph * .9 + hash(i) * 7, ep = Math.floor(x), f = x - ep;
    const on = j => (hash2(i, j) < .24 + think * .34 ? 1 : 0);
    const al = lerp(on(ep), on(ep + 1), smooth(.35, .65, f));
    if (al < .02) continue;
    ctx.strokeStyle = rgba('#a8ecff', al * (.2 + think * .35) * A);
    ctx.beginPath(); ctx.moveTo(pos[a][0], pos[a][1]); ctx.lineTo(pos[b][0], pos[b][1]); ctx.stroke();
    if (think > .6 && hash2(i, ep + 5000) < .12) {      // a signal runs along the edge
      const p = mix2(pos[a], pos[b], (x * 2.3) % 1);
      dot(ctx, p[0], p[1], 3.4, rgba('#ffffff', al * A));
    }
  }
  for (let i = 0; i < pos.length; i++) {
    const n = MA_NET.nodes[i], tw = .55 + .45 * Math.sin(ph * 3 + n.ph);
    dot(ctx, pos[i][0], pos[i][1], (1.6 + n.s * 2.2) * lk, rgba(n.s > .8 ? '#fff0c0' : '#d4f6ff', (.35 + .6 * tw) * A));
    if (n.s > .93) sparkle(ctx, pos[i][0], pos[i][1], 15 * tw * lk, '#ffffff', .8 * A);
  }
}
/**
 * drawMA(ctx, g, t, o)
 * o: x,y (screen position of head centre), s, rot, flip, pose, eyes{mode,k,look},
 *    think, dim, ring{}, wind, ribbonLen, alpha, outline (px), inner (nebula pan)
 */
function drawMA(ctx, g, t, o) {
  const pose = o.pose ?? 'float', s = o.s ?? 1, td = on2(t);
  const opt = { ...o, pose, ribbons: o.ribbonSet ?? MA_RIBBONS[pose] };
  const [mask, mx] = scratch('maMask'), [tint, tx] = scratch('maTint'), [body, bx] = scratch('maBody'), [rim, rx] = scratch('maRim');
  const sm = o.smear;
  const setT = c => {
    if (sm && sm.k > 0) {
      // a smear drawing: stretched back along the path, pinned at its leading edge
      const ax = o.x + sm.dir[0] * 120 * s, ay = o.y + 110 * s + sm.dir[1] * 140 * s, an = Math.atan2(sm.dir[1], sm.dir[0]);
      c.translate(ax, ay); c.rotate(an); c.scale(1 + sm.k * 1.15, 1 - sm.k * .3); c.rotate(-an); c.translate(-ax, -ay);
    }
    c.translate(o.x, o.y); c.rotate(o.rot ?? 0); c.scale(s * (o.flip ? -1 : 1), s);
  };
  mx.save(); setT(mx); mx.fillStyle = '#fff';
  if (o.ribbonLen !== 0) maRibbons(mx, td, opt);
  maParts(mx, pose, opt, td);
  mx.restore();
  mx.save(); setT(mx); const MT = mx.getTransform(); mx.restore();
  const gb = new DOMMatrix([.5, 0, 0, .5, 0, 0]).multiply(ctx.getTransform());   // follow any camera on ctx
  const alpha = o.alpha ?? 1;
  const ring = front => { ctx.save(); ctx.globalAlpha *= alpha; setT(ctx); maRing(ctx, g, gb.multiply(MT), t, opt, front); ctx.restore(); };
  ring(false);
  // luminous outline: the mask dilated, a little heavier on the shadow side
  const ow = (o.outline ?? 4.2) * clamp(.55 + s * .45, .5, 1.45);
  tx.drawImage(mask, 0, 0); tx.globalCompositeOperation = 'source-in'; rect(tx, 0, 0, W, H, o.lineColor ?? '#cdf4ff');
  const [ol, ox] = scratch('maOut');
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, w = ow * (1 + .45 * Math.max(0, Math.cos(a - .8)));
    ox.drawImage(tint, Math.cos(a) * w, Math.sin(a) * w);
  }
  ctx.save(); ctx.globalAlpha *= alpha; ctx.drawImage(ol, 0, 0); ctx.restore();
  if (g && (o.aura ?? 1) > 0) {
    const [au, ax] = scratch('maAura');
    ax.drawImage(ol, 0, 0); ax.globalCompositeOperation = 'destination-out'; ax.drawImage(mask, 0, 0);
    g.save(); g.setTransform(gb); g.globalAlpha = .62 * alpha * (o.aura ?? 1) * (1 - (o.dim ?? 0) * .7); g.drawImage(au, 0, 0); g.restore();
  }
  // interior: a window onto deep space, drifting against the silhouette
  const neb = nebula('ma');
  const inner = o.inner ?? [0, 0];
  bx.drawImage(neb, -160 + o.x * .08 + inner[0] - Math.sin(t * .11) * 40, -90 + o.y * .08 + inner[1] - Math.cos(t * .09) * 24);
  if (o.interiorTint) { bx.globalCompositeOperation = 'source-atop'; rect(bx, 0, 0, W, H, o.interiorTint); }
  bx.globalCompositeOperation = 'destination-in'; bx.drawImage(mask, 0, 0);
  bx.globalCompositeOperation = 'source-atop';
  bx.save(); setT(bx); maNetwork(bx, t, o); bx.restore();
  // directional rim light: mask minus a shifted copy
  const rimPass = (dx, dy, color, al) => {
    rx.globalCompositeOperation = 'source-over'; rx.clearRect(0, 0, W, H); rx.drawImage(mask, 0, 0);
    rx.globalCompositeOperation = 'destination-out'; rx.drawImage(mask, dx, dy);
    rx.globalCompositeOperation = 'source-in'; rect(rx, 0, 0, W, H, color);
    bx.globalAlpha = al; bx.drawImage(rim, 0, 0); bx.globalAlpha = 1;
  };
  const rw = 13 * clamp(s, .45, 1.6);
  rimPass(rw * .9, rw * .75, '#8fd9ff', .66 * (1 - (o.dim ?? 0) * .6));
  rimPass(-rw * .8, -rw * .5, o.warm ?? '#ff9fc6', .5);
  if (o.dim) { bx.globalCompositeOperation = 'source-atop'; rect(bx, 0, 0, W, H, `rgba(3,5,18,${o.dim * .55})`); }
  ctx.save(); ctx.globalAlpha *= alpha; ctx.drawImage(body, 0, 0);
  setT(ctx); maEyes(ctx, g, gb.multiply(MT), opt); ctx.restore();
  ring(true);
}
