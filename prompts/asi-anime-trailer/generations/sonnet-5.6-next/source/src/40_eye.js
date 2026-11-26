'use strict';
// ---------------------------------------------------------------------------
// the eye. Local space: iris centre (0,0), iris radius IR, eye width ~1030.
// WEB is the branching structure inside the iris. At 40-46 s the same points
// are drawn as ten billion futures, so the reveal is a true match cut.
// ---------------------------------------------------------------------------
const IR = 262;
const WEB = (() => {
  const R = rng(20261126), nodes = [], edges = [];
  const add = (a, r, d) => { nodes.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, r, a, d, ph: R() }); return nodes.length - 1; };
  const grow = (from, a, r, d) => {
    if (r > IR * .915 || d > 8) return;
    const nr = Math.min(IR * .94, r + IR * R.range(.055, .13)), na = a + R.range(-.13, .13);
    const n = add(na, nr, d);
    edges.push({ a: from, b: n, d, bend: R.range(-.18, .18) });
    if (d < 6 && R() < .5) { grow(n, na - R.range(.05, .13), nr, d + 1); grow(n, na + R.range(.05, .13), nr, d + 1); }
    else grow(n, na, nr, d + 1);
  };
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * TAU + R.range(-.09, .09), s = add(a, IR * R.range(.3, .37), 0);
    grow(s, a, nodes[s].r, 1);
  }
  const links = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, dd = dx * dx + dy * dy;
    if (dd < (IR * .085) ** 2 && dd > (IR * .025) ** 2 && R() < .22) links.push({ a: i, b: j, d: Math.max(nodes[i].d, nodes[j].d), bend: R.range(-.3, .3) });
  }
  return { nodes, edges, links };
})();
function webEdgePath(ctx, e) {
  const a = WEB.nodes[e.a], b = WEB.nodes[e.b];
  const mx = (a.x + b.x) / 2 - (b.y - a.y) * e.bend, my = (a.y + b.y) / 2 + (b.x - a.x) * e.bend;
  ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y);
}
function drawWeb(ctx, a = 1, lw = 1, o = {}) {
  ctx.save(); ctx.lineCap = 'round';
  const bands = [[0, .5, '#ffe3a1'], [.5, .7, '#d9f3b5'], [.7, 2, '#9df7ea']];
  for (const [lo, hi, col] of bands) {
    ctx.strokeStyle = rgba(col, .62 * a); ctx.lineWidth = 2.1 * lw; ctx.beginPath();
    for (const e of WEB.edges) { const q = WEB.nodes[e.b].r / IR; if (q >= lo && q < hi) webEdgePath(ctx, e); }
    ctx.stroke();
    ctx.strokeStyle = rgba(col, .32 * a); ctx.lineWidth = 1.2 * lw; ctx.beginPath();
    for (const e of WEB.links) { const q = WEB.nodes[e.b].r / IR; if (q >= lo && q < hi) webEdgePath(ctx, e); }
    ctx.stroke();
  }
  for (let i = 0; i < WEB.nodes.length; i += 2) {
    const n = WEB.nodes[i], q = n.r / IR;
    dot(ctx, n.x, n.y, (1.2 + n.ph * 2.2) * lw * (o.nodeK ?? 1), rgba(q < .55 ? '#fff0c2' : '#c8fff6', .85 * a));
  }
  ctx.restore();
}

// ---- lid geometry ------------------------------------------------------
const EYE_IN = [-505, 72], EYE_OUT = [522, -52];
const LID_OPEN = [[-420, -85], [-215, -232], [35, -240], [265, -246], [430, -152]];
const LID_SHUT = [[-392, 158], [-190, 188], [40, 178], [262, 168], [424, 66]];
const LOW_OPEN = [[-392, 176], [-202, 236], [30, 222], [270, 208], [455, 76]];
function lidCtrl(k) {
  const up = LID_OPEN.map((p, i) => mix2(p, LID_SHUT[i], k));
  const lk = Math.pow(k, 2.4);
  const low = LOW_OPEN.map((p, i) => mix2(p, LID_SHUT[i], lk));
  return { up, low };
}
function lidPts(c, n = 30) { // inner -> outer
  const a = bezPts(EYE_IN, c[0], c[1], c[2], n), b = bezPts(c[2], c[3], c[4], EYE_OUT, n);
  return a.concat(b.slice(1));
}
function aperture(ctx, up, low) {
  ctx.beginPath(); ctx.moveTo(up[0][0], up[0][1]);
  for (const p of up) ctx.lineTo(p[0], p[1]);
  for (let i = low.length - 1; i >= 0; i--) ctx.lineTo(low[i][0], low[i][1]);
  ctx.closePath();
}
const ptAt = (pts, s) => {
  const f = clamp(s) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f));
  return mix2(pts[i], pts[i + 1], f - i);
};
const offsetY = (pts, f) => pts.map((p, i) => [p[0], p[1] + f(i / (pts.length - 1))]);

// tiny MA seen reflected in her iris: faint, curved with the cornea
function maReflection(ctx, x, y, s, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(.09); ctx.scale(s, s); ctx.globalAlpha *= a;
  ctx.globalCompositeOperation = 'screen';
  const body = new Path2D('M -1 -31 C 14 -32 23 -21 22 -8 C 21 3 13 10 3 11 C 12 17 15 28 22 38 C 27 46 34 52 40 55 C 24 54 12 58 2 52 C -6 58 -20 56 -30 59 C -22 48 -20 38 -15 27 C -11 19 -8 14 -5 11 C -16 10 -23 2 -24 -9 C -26 -22 -15 -30 -1 -31 Z');
  ctx.fillStyle = 'rgba(70,120,190,0.55)'; ctx.fill(body);
  ctx.strokeStyle = 'rgba(196,238,255,0.9)'; ctx.lineWidth = 1.6; ctx.stroke(body);
  ink(ctx, 'M -18 -20 C -40 -34 -48 -58 -34 -74 C -36 -58 -30 -42 -12 -27', 3, { color: 'rgba(196,238,255,0.75)', t0: .1, t1: .6 });
  ink(ctx, 'M -20 -10 C -48 -16 -66 -34 -62 -54 C -56 -38 -44 -24 -18 -18', 2.4, { color: 'rgba(196,238,255,0.55)', t0: .1, t1: .6 });
  ctx.beginPath(); ctx.ellipse(-1, -15, 37, 8.5, -.3, 0, TAU); ctx.lineWidth = 1.3; ctx.strokeStyle = 'rgba(220,244,255,0.85)'; ctx.stroke();
  glow(ctx, -9, -8, 9, '#fff3c4', .8); glow(ctx, 8, -9, 9, '#fff3c4', .8);
  ell(ctx, -9, -8, 2.5, 3.6, '#fffbe8'); ell(ctx, 8, -9, 2.5, 3.6, '#fffbe8');
  ctx.restore();
}

// ---- iris --------------------------------------------------------------
function irisStatic() {
  return layer('iris', 640, 640, (x) => {
    x.translate(320, 320);
    const R = IR, rr = rng(99);
    dot(x, 0, 0, R, '#0b1c2e');
    dot(x, 0, 0, R * .955, linGrad(x, 0, -R, 0, R, [[0, '#0f2542'], [.42, '#123f5e'], [.72, '#1c8390'], [1, '#6df0d2']]));
    // fine radial fibres
    for (let i = 0; i < 330; i++) {
      const a = rr() * TAU, r0 = R * rr.range(.42, .7), r1 = Math.min(R * .93, r0 + R * rr.range(.12, .36)), wd = rr.range(.006, .019);
      const lightSide = (Math.sin(a) + 1) / 2;
      x.fillStyle = rr() < .5 ? rgba(mixh('#2b86a0', '#b6ffe6', lightSide), rr.range(.12, .42)) : rgba('#061226', rr.range(.15, .42));
      x.beginPath();
      x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      x.lineTo(Math.cos(a + wd) * (r0 + r1) / 2, Math.sin(a + wd) * (r0 + r1) / 2);
      x.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      x.lineTo(Math.cos(a - wd) * (r0 + r1) / 2, Math.sin(a - wd) * (r0 + r1) / 2);
      x.fill();
    }
    // jagged amber core
    const core = (base, jit, seed) => {
      const pts = [];
      for (let i = 0; i < 180; i++) {
        const a = i / 180 * TAU, sp = i % 2 ? 1 : 1 + jit * (.35 + .65 * Math.abs(vnoise(i * .37, seed)));
        pts.push([Math.cos(a) * R * base * sp * (1 + .06 * vnoise(i * .09, seed + 4)), Math.sin(a) * R * base * sp * (1 + .06 * vnoise(i * .09, seed + 4))]);
      }
      return pts;
    };
    fillPoly(x, core(.52, .24, 3), 'rgba(150,92,30,0.55)');
    fillPoly(x, core(.46, .2, 7), linGrad(x, 0, -R * .5, 0, R * .55, [[0, '#6a2c12'], [.45, '#c4691c'], [.78, '#f4ab34'], [1, '#ffe287']]));
    fillPoly(x, core(.37, .16, 12), linGrad(x, 0, -R * .4, 0, R * .4, [[0, '#4d1f10'], [.55, '#8f4415'], [1, '#e8932b']]));
    // limbal ring
    x.strokeStyle = 'rgba(5,12,28,0.92)'; x.lineWidth = R * .055; x.beginPath(); x.arc(0, 0, R * .975, 0, TAU); x.stroke();
    x.strokeStyle = 'rgba(105,225,220,0.30)'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, R * .925, .1 * Math.PI, .9 * Math.PI); x.stroke();
  });
}
/**
 * drawIris: draws the iris centred at (0,0) in eye-local units.
 * o.webA web opacity, o.shine catchlight opacity, o.pupil pupil scale,
 * o.ma reflection opacity, o.lidShadow (upper lid points)
 */
function drawIris(ctx, o = {}) {
  const R = IR;
  ctx.drawImage(irisStatic(), -320, -320);
  drawWeb(ctx, (o.webA ?? 1) * .92, o.webLW ?? 1);
  // lid shadow, hard edged like a painted cel
  if (o.shadow !== false) {
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();
    const sy = o.shadowY ?? 0;
    fillD(ctx, `M -300 -300 L 300 -300 L 300 ${-92 + sy} C 170 ${-132 + sy} -150 ${-138 + sy} -300 ${-58 + sy} Z`, 'rgba(5,10,30,0.56)');
    rect(ctx, -300, -300, 600, 340 + sy, linGrad(ctx, 0, -260, 0, 40 + sy, [[0, 'rgba(4,8,26,0.62)'], [1, 'rgba(4,8,26,0)']]));
    ctx.restore();
  }
  // lower bounce light
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath(); ctx.arc(0, 0, R * .86, .17 * Math.PI, .83 * Math.PI); ctx.bezierCurveTo(-R * .38, R * .5, R * .38, R * .5, Math.cos(.17 * Math.PI) * R * .86, Math.sin(.17 * Math.PI) * R * .86);
  ctx.fillStyle = linGrad(ctx, 0, R * .46, 0, R * .86, [[0, 'rgba(140,255,225,0)'], [1, 'rgba(150,255,226,0.42)']]); ctx.fill();
  ctx.restore();
  // pupil
  const pk = o.pupil ?? 1;
  ell(ctx, 0, -4, R * .245 * pk, R * .285 * pk, '#040712');
  ctx.strokeStyle = 'rgba(255,176,60,0.55)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(0, -4, R * .262 * pk, R * .302 * pk, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(4,7,18,0.6)'; ctx.lineWidth = 11; ctx.beginPath(); ctx.ellipse(0, -4, R * .24 * pk, R * .28 * pk, 0, 0, TAU); ctx.stroke();
  if ((o.ma ?? 0) > 0) maReflection(ctx, 122, 30, 1.18, o.ma);
  // catchlights
  const sh = o.shine ?? 1;
  if (sh > 0) {
    const w = o.wob ?? 0;
    ctx.save(); ctx.globalAlpha *= sh;
    ctx.save(); ctx.translate(-112 + w, -94 - w * .5); ctx.rotate(-.52);
    fillD(ctx, 'M -66 -8 C -64 -40 -30 -50 8 -46 C 46 -42 68 -22 62 6 C 56 34 24 46 -14 42 C -50 38 -68 22 -66 -8 Z', 'rgba(252,254,255,0.97)');
    ctx.restore();
    ell(ctx, -26 + w, -44, 15, 12, 'rgba(252,254,255,0.92)', -.4);
    ell(ctx, 122 - w, 118, 27, 21, 'rgba(235,255,250,0.88)', -.6);
    dot(ctx, 168 - w, 74, 8, 'rgba(255,255,255,0.8)');
    dot(ctx, -72, 148 + w, 5.5, 'rgba(220,255,250,0.75)');
    ctx.strokeStyle = 'rgba(215,248,255,0.34)'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, R * .79, -.2 * Math.PI, .02 * Math.PI); ctx.stroke();
    ctx.restore();
  }
}

// ---- the eyeball with lids and lashes (usable at any scale) -----------------
/**
 * o.lid 0 open .. 1 shut, o.gaze [x,y], o.lash colour, o.sclera, o.simple,
 * o.boil, o.seed, plus drawIris options
 */
function drawEyeBall(ctx, o = {}) {
  const k = clamp(o.lid ?? 0), c = lidCtrl(k);
  const up = lidPts(c.up), low = lidPts(c.low);
  const lashC = o.lash ?? '#1c0e22';
  const gz = o.gaze ?? [0, 0];
  if (k < .985) {
    ctx.save(); aperture(ctx, up, low); ctx.clip();
    rect(ctx, -560, -300, 1120, 580, o.sclera ?? linGrad(ctx, 0, -230, 0, 230, [[0, '#a9a6cf'], [.5, '#d3d4ea'], [1, '#dedaec']]));
    // cast shadow of the upper lid on the white
    fillPoly(ctx, up.concat(offsetY(up, s => 46 + 34 * Math.sin(s * Math.PI)).reverse()), o.scleraShade ?? 'rgba(112,104,168,0.55)');
    // inner corner
    fillD(ctx, 'M -520 70 C -470 34 -432 52 -412 82 C -438 112 -478 116 -520 70 Z', '#c97f93');
    ell(ctx, -452, 70, 12, 8, 'rgba(255,225,228,0.75)', -.3);
    // far corners fall into tone
    rect(ctx, -560, -300, 240, 580, linGrad(ctx, -560, 0, -320, 0, [[0, 'rgba(130,88,130,0.45)'], [1, 'rgba(130,88,130,0)']]));
    rect(ctx, 320, -300, 240, 580, linGrad(ctx, 320, 0, 560, 0, [[0, 'rgba(130,96,150,0)'], [1, 'rgba(130,96,150,0.42)']]));
    ctx.save(); ctx.translate(6 + gz[0], -8 + gz[1]);
    ell(ctx, 0, 6, IR * 1.035, IR * 1.035, 'rgba(70,74,130,0.30)');
    drawIris(ctx, { ...o, shadowY: lerp(0, 190, k) });
    ctx.restore();
    // wet waterline
    ctx.strokeStyle = 'rgba(255,240,246,0.55)'; ctx.lineWidth = 7; ctx.beginPath();
    for (let i = 8; i < low.length - 8; i++) ctx[i === 8 ? 'moveTo' : 'lineTo'](low[i][0], low[i][1] - 7);
    ctx.stroke();
    ctx.restore();
  }
  // lower lid line, strongest toward the outer corner
  const lowFromOut = low.slice().reverse();
  taper(ctx, lowFromOut.slice(0, Math.floor(lowFromOut.length * .62)), 13 * (o.lw ?? 1), { color: o.lowColor ?? '#4b2443', t0: .04, t1: .7 });
  taper(ctx, low.slice(2, 16), 6 * (o.lw ?? 1), { color: o.lowColor ?? '#6b3a58', t0: .5, t1: .5 });
  // upper lash band: thin at the inner corner, heavy toward the outer
  const th = s => 6 + 55 * Math.pow(Math.sin(Math.min(1, s * .92) * Math.PI / 1.62), 2.2) * (s > .94 ? 1 - (s - .94) * 6 : 1);
  const top = up.map((p, i) => { const s = i / (up.length - 1); return [p[0], p[1] - th(s) * (1 - k * .35)]; });
  const bot = up.map((p, i) => { const s = i / (up.length - 1); return [p[0], p[1] + 5 + 7 * Math.sin(s * Math.PI)]; });
  ctx.fillStyle = lashC;
  polyPath(ctx, top.concat(bot.reverse())); ctx.fill();
  // outer flick
  const endTop = ptAt(top, .9), tip = mix2([646, -128], [622, 34], k);
  ctx.beginPath(); ctx.moveTo(endTop[0], endTop[1]);
  ctx.quadraticCurveTo(EYE_OUT[0] + 52, EYE_OUT[1] - 48 + k * 40, tip[0], tip[1]);
  ctx.quadraticCurveTo(EYE_OUT[0] + 34, EYE_OUT[1] + 2 + k * 26, EYE_OUT[0] - 38, EYE_OUT[1] - 6 + k * 14);
  ctx.closePath(); ctx.fill();
  // lash clumps swing from up-and-out to down-and-out as the lid shuts
  const clumps = o.simple ? [[.62, 62, 0], [.78, 86, .1], [.9, 90, .2]] :
    [[.3, 44, -.35], [.4, 56, -.22], [.5, 82, -.1], [.575, 70, 0], [.65, 108, .06], [.725, 92, .16], [.8, 132, .22], [.86, 104, .32], [.915, 118, .4], [.96, 82, .55]];
  const bo = o.boil ?? 0;
  clumps.forEach(([s, len, lean], i) => {
    const p = ptAt(up, s), thk = th(s);
    const aOpen = -Math.PI / 2 + .42 + lean + (s - .6) * .8, aShut = Math.PI / 2 - .38 - lean * .7;
    const a = lerp(aOpen, aShut, E.inOutSine(clamp(k * 1.15)));
    const L = len * lerp(1, .82, k);
    const root = [p[0] - 6, p[1] - thk * (1 - k) * .48];
    const jit = bo ? vnoise(i * 2.3, (o.seed ?? 0)) * bo * 3 : 0;
    const end = [root[0] + Math.cos(a) * L + jit, root[1] + Math.sin(a) * L + jit];
    const mid = [root[0] + Math.cos(a + .1) * L * .45 + L * .14, root[1] + Math.sin(a + .1) * L * .45 + lerp(6, -4, k)];
    taper(ctx, bezPts(root, mix2(root, mid, .7), mid, end, 12), (o.simple ? 30 : 21) * (o.lw ?? 1), { color: lashC, t0: 0, t1: .92, min: .02 });
  });
  if (!o.simple) {
    // sheen on the lash band
    ctx.save(); polyPath(ctx, top.concat(up.slice().reverse())); ctx.clip();
    taper(ctx, offsetY(up, () => -26).slice(22, 52), 9, { color: 'rgba(132,86,132,0.55)', t0: .4, t1: .4 });
    ctx.restore();
    // lower lashes
    [[.07, 26], [.12, 36], [.18, 30], [.255, 24], [.33, 14]].forEach(([s, len], i) => {
      const p = ptAt(lowFromOut, s), a = Math.PI / 2 - .85 + i * .12;
      taper(ctx, bezPts(p, [p[0] + Math.cos(a) * len * .5 + 4, p[1] + Math.sin(a) * len * .5], [p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len * .8], [p[0] + Math.cos(a - .25) * len * 1.15, p[1] + Math.sin(a - .25) * len * 1.05], 8), 8, { color: '#43213f', t0: 0, t1: .9 });
    });
  }
  return { up, low };
}

// ---- hair lock: a filled ribbon between two curves ------------------------
function lock(ctx, d, o = {}) {
  const p = new Path2D(d);
  ctx.fillStyle = o.fill ?? '#35193a'; ctx.fill(p);
  ctx.save(); ctx.clip(p);
  if (o.shade) { ctx.fillStyle = o.shadeColor ?? '#22102a'; ctx.fill(new Path2D(o.shade)); }
  if (o.hi) { ctx.fillStyle = o.hiColor ?? '#80446a'; ctx.fill(new Path2D(o.hi)); }
  ctx.restore();
}

// ---- the extreme close-up: skin, brow, eye, hair ---------------------------
function ecuSkin() {
  return layer('ecuSkin', 2560, 1700, (x) => {
    x.translate(1280, 850);
    rect(x, -1280, -850, 2560, 1700, linGrad(x, -900, -600, 900, 700, [[0, '#8e5f83'], [.4, '#c08c99'], [.75, '#d8a29b'], [1, '#b67f93']]));
    // soft modelling
    const soft = (cx, cy, rx, ry, col, a) => { x.save(); x.translate(cx, cy); x.scale(1, ry / rx); glow(x, 0, 0, rx, col, a); x.restore(); };
    soft(120, 420, 760, 320, '#f4bfa9', .75);
    soft(-40, -330, 640, 150, '#e6b0aa', .55);
    soft(560, 300, 420, 240, '#e8788c', .5);       // blush
    soft(-760, -80, 420, 640, '#5c3a72', .75);     // side of the nose bridge
    soft(980, -420, 620, 520, '#4c326e', .7);
    // eye socket: a hard cel shadow under the brow
    fillD(x, 'M -590 40 C -520 -240 -250 -432 80 -430 C 330 -428 500 -330 590 -150 C 470 -268 300 -352 50 -350 C -240 -346 -440 -206 -590 40 Z', 'rgba(118,66,116,0.42)');
    // lid fold plane
    fillD(x, 'M -505 72 C -420 -85 -215 -262 35 -266 C 265 -270 440 -175 522 -52 C 430 -216 262 -338 30 -340 C -224 -338 -428 -168 -505 72 Z', 'rgba(150,88,122,0.28)');
    // nose bridge shadow edge
    fillD(x, 'M -690 -850 C -640 -420 -610 -180 -668 90 C -716 300 -800 470 -900 640 L -1280 850 L -1280 -850 Z', 'rgba(94,52,104,0.46)');
    ink(x, 'M -688 -330 C -636 -150 -628 10 -676 150', 10, { color: 'rgba(232,168,170,0.55)' });
    // lower lid highlight and under-eye fold
    ink(x, 'M -420 196 C -210 268 70 290 300 218 C 392 180 450 128 492 74', 15, { color: 'rgba(250,212,200,0.62)', t0: .35, t1: .35 });
    ink(x, 'M -330 272 C -160 330 110 332 300 268', 7, { color: 'rgba(130,72,110,0.38)', t0: .5, t1: .5 });
    // painterly grain so the skin reads hand painted
    const R = rng(71);
    for (let i = 0; i < 2600; i++) {
      const px = R.range(-1280, 1280), py = R.range(-850, 850);
      x.fillStyle = rgba(R() < .5 ? '#ffd9cc' : '#6b3f74', R.range(.012, .035));
      x.beginPath(); x.ellipse(px, py, R.range(6, 40), R.range(2, 9), -.5 + R.range(-.2, .2), 0, TAU); x.fill();
    }
    // anime blush hatching
    for (let i = 0; i < 9; i++) ink(x, `M ${350 + i * 44 + (i % 2) * 6} ${380 - i * 3} L ${316 + i * 44} ${452 - i * 3 + (i % 3) * 5}`, 7, { color: 'rgba(196,72,112,0.5)', t0: .4, t1: .4 });
  });
}
function ecuBrow(ctx, lift = 0) {
  ctx.save(); ctx.translate(0, lift);
  fillD(ctx, 'M -520 -362 C -400 -470 -170 -520 80 -508 C 270 -498 430 -452 548 -372 C 420 -424 268 -456 84 -460 C -150 -466 -356 -428 -520 -362 Z', '#472544');
  const R = rng(5);
  for (let i = 0; i < 46; i++) {
    const s = i / 46, bx = lerp(-500, 470, s), by = -424 - Math.sin(s * 2.4 + .35) * 66 + R.range(-8, 8);
    ink(ctx, `M ${bx} ${by + 16} Q ${bx + 34} ${by - 6} ${bx + 84} ${by - 10 + s * 34}`, R.range(4, 8), { color: 'rgba(56,26,54,0.75)', t0: .15, t1: .6 });
  }
  ctx.restore();
}
// loose bangs and side locks that frame the close-up; sway is on twos
function ecuHair(ctx, t, o = {}) {
  const td = on2(t), sway = (k, a = 1) => (o.still ? Math.sin(k * 7.1) * 6 : Math.sin(td * 1.7 + k * 2.3) * 9 + Math.sin(td * 3.1 + k) * 3) * a;
  const a = sway(1), b = sway(2), c = sway(3), d = sway(4, 1.5);
  // big side lock on the left
  lock(ctx, `M -1100 -800 L -660 -800 C -700 -520 -742 -250 ${-790 + a} 20 C ${-826 + a} 230 ${-780 + a} 400 ${-690 + a * 2} 560 C ${-850 + a} 450 ${-905 + a} 300 -915 140 C -950 340 -1000 520 -1100 660 Z`, {
    shade: `M -1100 -800 L -880 -800 C -900 -450 -960 -100 -940 200 L -1100 660 Z`,
    hi: `M -780 -520 C -812 -330 -846 -170 ${-858 + a} -10 C -842 -170 -826 -330 -748 -530 Z M -724 -560 C -736 -450 -752 -360 -770 -280 C -752 -380 -738 -480 -706 -562 Z`,
  });
  ink(ctx, `M -664 -800 C -704 -520 -746 -250 ${-794 + a} 20 C ${-830 + a} 230 ${-784 + a} 400 ${-694 + a * 2} 556`, 9, { color: 'rgba(150,214,255,0.75)', t0: .3, t1: .3 });
  // fringe across the top
  lock(ctx, `M -700 -800 L -150 -800 C -230 -690 -300 -610 ${-384 + b} -520 C ${-452 + b} -436 ${-480 + b} -352 ${-492 + b * 1.6} -270 C ${-540 + b} -366 -552 -450 -532 -520 C -584 -420 -640 -350 ${-714 + b} -290 C -686 -390 -668 -480 -676 -560 Z`, {
    shade: `M -700 -800 L -520 -800 C -540 -650 -600 -520 -690 -420 Z`,
    hi: `M -420 -650 C -466 -580 -500 -520 -516 -470 C -474 -530 -430 -590 -372 -652 Z`,
  });
  lock(ctx, `M -170 -800 L 290 -800 C 180 -700 86 -640 ${14 + c} -566 C ${-34 + c} -514 ${-62 + c} -462 ${-76 + c * 1.5} -404 C ${-112 + c} -470 -114 -540 -90 -602 C -150 -540 -214 -500 ${-300 + c} -470 C -240 -540 -192 -640 -170 -800 Z`, {
    shade: `M -170 -800 L 0 -800 C -40 -700 -120 -600 -200 -540 Z`,
    hi: `M 120 -720 C 60 -666 14 -620 -14 -578 C 40 -616 96 -664 170 -722 Z`,
  });
  lock(ctx, `M 260 -800 L 800 -800 C 730 -710 676 -640 ${646 + a} -560 C ${620 + a} -478 ${626 + a} -400 ${652 + a * 1.4} -318 C ${580 + a} -400 556 -476 566 -552 C 524 -488 468 -446 ${384 + a} -420 C 430 -500 440 -580 424 -660 C 380 -610 330 -582 268 -566 C 314 -640 322 -720 260 -800 Z`, {
    shade: `M 640 -800 L 800 -800 C 700 -690 650 -590 640 -480 Z`,
    hi: `M 520 -690 C 500 -620 470 -560 436 -520 C 486 -556 526 -616 552 -694 Z`,
  });
  // right-hand mass and the braid with its mint thread
  lock(ctx, `M 700 -800 L 1120 -800 L 1120 600 C 1040 480 996 380 980 260 C 960 340 928 400 ${868 + a} 464 C 892 330 880 200 846 90 C 800 -60 760 -240 ${790 + c} -420 C 764 -540 730 -660 700 -800 Z`, {
    shade: `M 980 -800 L 1120 -800 L 1120 600 C 1000 300 960 -200 980 -800 Z`,
    hi: `M 824 -420 C 812 -270 834 -130 880 20 C 862 -140 846 -280 856 -440 Z`,
  });
  braid(ctx, spline([[760, -640], [724, -380], [712 + d * .4, -90], [742 + d * .8, 180], [722 + d, 380]], 14), 56, 1);
  // fine flyaway strands
  const fly = [[`M -300 -800 C -330 -560 -420 -420 ${-560 + d} -330`, 5], [`M 330 -800 C 380 -620 500 -500 ${620 + d} -480`, 4], [`M -610 -800 C -690 -480 -700 -230 ${-648 + d} -60`, 4.5], [`M 900 -500 C 830 -200 900 40 ${812 + d} 250`, 4], [`M 40 -800 C 10 -640 -70 -560 ${-190 + d} -520`, 3.5]];
  for (const [p, w] of fly) ink(ctx, p, w, { color: '#33173a', t0: .1, t1: .75 });
}
// a thin three-strand braid ending in a mint thread wrap and tassel
function braid(ctx, pts, w, a = 1, o = {}) {
  const n = Math.max(4, Math.round(pts.length / (o.step ?? 4.6)));
  ctx.save(); ctx.globalAlpha *= a;
  for (let i = 0; i < n; i++) {
    const s = i / n, p = ptAt(pts, s), q = ptAt(pts, s + 1 / n);
    const ang = Math.atan2(q[1] - p[1], q[0] - p[0]), len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const wd = w * (1 - s * .3), side = i % 2 ? 1 : -1;
    ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(ang - Math.PI / 2);
    fillD(ctx, `M ${-side * wd * .46} ${-len * .35} C ${side * wd * .2} ${-len * .45} ${side * wd * .62} ${len * .1} ${side * wd * .42} ${len * .62} C ${side * wd * .18} ${len * 1.22} ${-side * wd * .3} ${len * 1.1} ${-side * wd * .2} ${len * .7} C ${-side * wd * .12} ${len * .3} ${-side * wd * .5} ${len * .2} ${-side * wd * .46} ${-len * .35} Z`, i % 2 ? '#3d1c40' : '#4a2449');
    ink(ctx, `M ${side * wd * .14} ${-len * .2} C ${side * wd * .42} ${len * .1} ${side * wd * .34} ${len * .55} ${side * wd * .12} ${len * .82}`, wd * .09, { color: 'rgba(172,102,142,0.8)', t0: .4, t1: .4 });
    ink(ctx, `M ${-side * wd * .44} ${-len * .35} C ${-side * wd * .46} ${len * .2} ${-side * wd * .1} ${len * .3} ${-side * wd * .2} ${len * .75}`, wd * .07, { color: '#170a1f', t0: .2, t1: .4 });
    ctx.restore();
  }
  const e = pts[pts.length - 1], b = ptAt(pts, .94), ang = Math.atan2(e[1] - b[1], e[0] - b[0]);
  ctx.save(); ctx.translate(e[0], e[1]); ctx.rotate(ang - Math.PI / 2);
  for (let i = 0; i < 4; i++) rect(ctx, -w * .34, i * w * .17 - w * .12, w * .68, w * .12, i % 2 ? '#5fd6b8' : '#9dffe0');
  for (let i = -3; i <= 3; i++) ink(ctx, `M ${i * w * .07} ${w * .55} Q ${i * w * .14} ${w * .9} ${i * w * .2} ${w * 1.35}`, w * .1, { color: i % 2 ? '#3b1b3e' : '#4d264b', t0: 0, t1: .8 });
  ctx.restore();
  ctx.restore();
  return e;
}
/**
 * full close-up. o: x,y (screen centre of iris), s (scale), lid, ma, shine,
 * webA, pupil, gaze, drops
 */
function drawECU(ctx, t, o = {}) {
  const x = o.x ?? 960, y = o.y ?? 590, s = o.s ?? 1.14, di = drawNo(t);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.drawImage(ecuSkin(), -1280, -850);
  const lid = o.lid ?? 0;
  ecuBrow(ctx, lid * 16);
  // crease: follows the lid down
  const cr = offsetY(lidPts(lidCtrl(lid * .55).up), q => -(40 + 82 * Math.sin(q * Math.PI)));
  taper(ctx, cr.slice(5, 57), 13, { color: '#74406a', t0: .45, t1: .35 });
  if (lid > .35) {
    // the lid skin itself, shaded as it travels down
    const upNow = lidPts(lidCtrl(lid).up);
    fillPoly(ctx, cr.slice(4, 58).concat(upNow.slice(4, 58).reverse()), rgba('#c28f9d', inv(.35, .8, lid) * .72));
    fillPoly(ctx, offsetY(upNow, q => -(34 + 40 * Math.sin(q * Math.PI))).concat(upNow.slice().reverse()), rgba('#a8718d', inv(.4, .9, lid) * .55));
  }
  drawEyeBall(ctx, { ...o, lid, boil: .8, seed: di, wob: o.still ? 0 : vnoise(on2(t) * 2.2, 8) * 2.5 });
  // beads of rain on the skin
  if (o.drops !== false) {
    skinDrop(ctx, 438, 306, 21); skinDrop(ctx, -316, 372, 13); skinDrop(ctx, 566, -206, 10);
  }
  ecuHair(ctx, t, o);
  ctx.restore();
}
function skinDrop(ctx, x, y, r) {
  ell(ctx, x + r * .15, y + r * .55, r * .95, r * .95, 'rgba(88,44,88,0.32)');
  ell(ctx, x, y, r * .82, r, 'rgba(236,196,200,0.55)');
  ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, r * .82, r, 0, 0, TAU); ctx.clip();
  ell(ctx, x, y + r * .55, r * .8, r * .55, 'rgba(255,236,226,0.85)');
  ctx.restore();
  ctx.strokeStyle = 'rgba(96,52,96,0.5)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.ellipse(x, y, r * .82, r, 0, Math.PI * .9, Math.PI * 2.2); ctx.stroke();
  ell(ctx, x - r * .3, y - r * .38, r * .26, r * .2, '#ffffff', -.5);
}
