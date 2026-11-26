'use strict';
// ---------------------------------------------------------------------------
// act two (28 - 46 s): the lives it imagines for her, and where they come from
// ---------------------------------------------------------------------------

// ---- silhouettes with a one-sided rim light --------------------------------
function silhouette(ctx, draw, o = {}) {
  const [mask, mx] = scratch('silMask');
  mx.setTransform(ctx.getTransform()); mx.fillStyle = '#fff'; mx.strokeStyle = '#fff';
  draw(mx);
  const [body, bx] = scratch('silBody');
  bx.drawImage(mask, 0, 0); bx.globalCompositeOperation = 'source-in';
  rect(bx, 0, 0, W, H, o.fill ?? '#0d0b2c');
  const [rim, rx] = scratch('silRim');
  const rimPass = (dx, dy, color, a) => {
    rx.globalCompositeOperation = 'source-over'; rx.clearRect(0, 0, W, H); rx.drawImage(mask, 0, 0);
    rx.globalCompositeOperation = 'destination-out'; rx.drawImage(mask, dx, dy);
    rx.globalCompositeOperation = 'source-in'; rect(rx, 0, 0, W, H, color);
    bx.globalCompositeOperation = 'source-atop'; bx.globalAlpha = a; bx.drawImage(rim, 0, 0); bx.globalAlpha = 1;
  };
  const [dx, dy] = o.dir ?? [-8, 6];
  rimPass(dx, dy, o.rim ?? '#ffd9a0', 1);
  if (o.rim2) rimPass(-dx * .55, -dy * .55, o.rim2, .8);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(body, 0, 0); ctx.restore();
}
// her bob haircut, as a silhouette (r = head radius)
function bobPath(c, x, y, r, flow = 0) {
  c.save(); c.translate(x, y); c.scale(r / 100, r / 100);
  c.fill(new Path2D(`M 0 -128 C 86 -130 136 -64 130 24 C 128 66 138 90 ${156 + flow} 116 C 128 104 112 110 ${108 + flow * .6} 132 C 94 108 78 108 64 118 L 40 40 L -46 40 L -66 120 C -80 108 -96 108 ${-112 + flow * .6} 134 C -114 110 -132 106 ${-158 + flow} 116 C -140 90 -128 66 -130 24 C -136 -64 -86 -130 0 -128 Z`));
  c.restore();
}
// a posable figure. p: {head:[x,y,r], neck, hip, arms:[[a,b,c]..], legs:[..], coat, w}
function person(c, p) {
  const [hx, hy, hr] = p.head, w = p.w ?? 1;
  c.beginPath(); c.arc(hx, hy, hr, 0, TAU); c.fill();
  if (p.bob !== false) bobPath(c, hx, hy, hr, p.flow ?? 0);
  capsule(c, [[hx, hy + hr * .6], p.neck], hr * .62 * w, hr * .66 * w);
  capsule(c, [p.neck, mix2(p.neck, p.hip, .5), p.hip], hr * 1.75 * w, hr * 1.55 * w);
  for (const a of p.arms ?? []) capsule(c, a, hr * .74 * w, hr * .34 * w);
  for (const l of p.legs ?? []) capsule(c, l, hr * .9 * w, hr * .44 * w);
  if (p.coat) { c.beginPath(); const [a, b, d, e] = p.coat; c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.quadraticCurveTo((b[0] + d[0]) / 2, (b[1] + d[1]) / 2 + 24, d[0], d[1]); c.lineTo(e[0], e[1]); c.closePath(); c.fill(); }
}
// her braid and the mint thread: how she can be found in every life
function futureBraid(ctx, g, x, y, len, sway0, s = 1, hair = '#150f35') {
  const pts = spline([[x, y], [x + 7 * s + sway0 * .3, y + len * .4], [x + 2 * s + sway0, y + len]], 10);
  braid(ctx, pts, 13 * s, 1, { step: 2.6 });
  const e = pts[pts.length - 1];
  dot(ctx, e[0], e[1] + 2 * s, 5.5 * s, '#a8ffe4');
  glow(ctx, e[0], e[1], 34 * s, '#7dffd8', .85); if (g) glow(g, e[0], e[1], 44 * s, '#7dffd8', 1);
}
function futureCaption(ctx, t, t0, t1, no, text) {
  const a = env(t, t0 + .05, t1 + .02, .2, .1);
  if (a <= 0) return;
  rect(ctx, 0, 780, W, 300, linGrad(ctx, 0, 780, 0, 1080, [[0, 'rgba(5,6,28,0)'], [1, `rgba(5,6,28,${.78 * a})`]]));
  type(ctx, 'future no. ' + no, 960, 886, { size: 25, weight: 2.7, track: 5.5, color: '#b6ffe8', alpha: a, reveal: inv(t0 + .04, t0 + .4, t), shadow: { color: 'rgba(5,6,28,0.66)', x: 0, y: 2, grow: 5.5 } });
  narrate(ctx, text, 960, 940, t, t0 + .04, t1 + .1, { size: 52, stagger: .005, outDur: .12 });
}
// every cut in the montage lands with a short zoom punch and a burst of lines
function cutHit(S, t0, o = {}) {
  const u = S.t - t0;
  if (u < 0) return;
  S.P.zoom = 1 + (o.z ?? .075) * Math.exp(-u * 11);
  S.P.radial = Math.max(0, (o.r ?? .14) * (1 - u / .16));
  S.P.ca = 1.1 + 7 * Math.exp(-u * 14);
  const [sx, sy] = shake(S.t, t0, o.shake ?? 14, 11); S.P.shake = [sx, sy];
  if (u < .125) { S.ctx.save(); S.ctx.globalAlpha = .8 * (1 - u / .125); focusLines(S.ctx, 960, 520, { n: 70, r0: 760, seed: drawNo(S.t) + 3, w: 9 }); S.ctx.restore(); }
}

// ---------------------------------------------------------------- 28: another moon
function ringedGiant(ctx, g, cx, cy, R, t) {
  const tilt = -.27;
  const ringHalf = (front) => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt);
    const bands = [[1.34, 24, '#e9c9a0', .32], [1.47, 46, '#f4dcb4', .62], [1.62, 14, '#8d6f98', .4], [1.74, 34, '#d9a9b4', .55], [1.9, 8, '#bfe6ff', .5]];
    for (const [k, wd, col, a] of bands) { ctx.strokeStyle = rgba(col, a); ctx.lineWidth = wd; ctx.beginPath(); ctx.ellipse(0, 0, R * k, R * k * .21, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); ctx.stroke(); }
    ctx.restore();
  };
  ringHalf(false);
  glow(ctx, cx, cy, R * 1.45, '#ffb87a', .3);
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
  rect(ctx, cx - R, cy - R, R * 2, R * 2, '#e8a76a');
  ctx.translate(cx, cy); ctx.rotate(tilt);
  const cols = ['#f6d7a4', '#d98a5e', '#f2c48a', '#b96a62', '#ffe5bc', '#cf8660', '#eab27a', '#a85a66', '#f4cd97'];
  for (let i = 0; i < 17; i++) {
    const y = -R + i * R * .124, h = R * (.04 + .07 * hash(i * 7));
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath(); ctx.moveTo(-R, y);
    ctx.bezierCurveTo(-R * .4, y + R * .1 + 10 * Math.sin(i), R * .4, y + R * .1 + 8 * Math.cos(i * 2), R, y);
    ctx.lineTo(R, y + h); ctx.bezierCurveTo(R * .4, y + h + R * .1, -R * .4, y + h + R * .11, -R, y + h); ctx.fill();
  }
  ell(ctx, -R * .28, R * .34, R * .17, R * .09, '#c9665a'); ell(ctx, -R * .28, R * .34, R * .11, R * .05, '#e89070');
  ctx.rotate(-tilt);
  // two-step terminator
  ctx.fillStyle = 'rgba(70,34,100,0.46)'; ctx.beginPath(); ctx.arc(0, 0, R * 1.2, 0, TAU); ctx.arc(-R * .42, -R * .3, R * 1.12, 0, TAU, true); ctx.fill('evenodd');
  ctx.fillStyle = 'rgba(30,14,66,0.62)'; ctx.beginPath(); ctx.arc(0, 0, R * 1.2, 0, TAU); ctx.arc(-R * .6, -R * .42, R * 1.34, 0, TAU, true); ctx.fill('evenodd');
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,236,206,0.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R - 2, Math.PI * .86, Math.PI * 1.62); ctx.stroke();
  ringHalf(true);
}
function futureMoon(S, u) {
  const { ctx, g, t } = S;
  const k = E.outCubic(clamp(u / 2.2));
  drawNebula(ctx, 'deep', 0, 20 - 40 * k, 1.03);
  ringedGiant(ctx, g, 1330, 400 + 26 * (1 - k), 372 * (1 + .04 * k), t);
  const py = 30 * (1 - k);
  const ridge = (d, col, off) => fillD(ctx, d, col);
  ctx.save(); ctx.translate(0, py);
  ridge('M -20 860 L 180 790 L 330 830 L 520 742 L 700 818 L 900 776 L 1180 872 L 1500 818 L 1720 880 L 1940 836 L 1940 1140 L -20 1140 Z', '#3c5a9c');
  ridge('M -20 930 L 150 868 L 300 880 L 470 800 L 640 778 L 760 800 L 900 892 L 1100 940 L 1360 900 L 1600 990 L 1940 930 L 1940 1140 L -20 1140 Z', linGrad(ctx, 0, 780, 0, 1100, [[0, '#cfefff'], [.35, '#8cc3ee'], [1, '#3b5299']]));
  ridge('M 640 778 L 760 800 L 900 892 L 1100 940 L 940 960 L 800 876 L 720 884 L 690 828 Z', '#4a6fbb');
  ridge('M 150 868 L 300 880 L 240 910 L 300 960 L 120 1010 L -20 1000 L -20 930 Z', '#5a86cc');
  ink(ctx, 'M -20 930 L 150 868 L 300 880 L 470 800 L 640 778 L 760 800 L 900 892 L 1100 940 L 1360 900 L 1600 990', 7, { color: '#fff3de', t0: .05, t1: .2 });
  for (let i = 0; i < 9; i++) { const x = 120 + i * 190 + hash(i) * 80, y = 985 + hash(i + 30) * 70; ell(ctx, x, y, 40 + hash(i + 9) * 50, 9, 'rgba(40,60,130,0.55)'); ink(ctx, `M ${x - 44} ${y + 4} Q ${x} ${y + 16} ${x + 46} ${y + 3}`, 3, { color: '#bfe4ff', t0: .3, t1: .3 }); }
  const bx = 566, by = 786, br = Math.sin(on2(t) * 2) * 2;
  silhouette(ctx, c => {
    person(c, { head: [bx + 8, by - 248 + br, 31], neck: [bx + 4, by - 205 + br], hip: [bx - 6, by - 112], w: 1.18,
      arms: [[[bx - 20, by - 196 + br], [bx - 52, by - 150], [bx - 46, by - 96]], [[bx + 30, by - 196 + br], [bx + 66, by - 168], [bx + 92, by - 218]]],
      legs: [[[bx - 20, by - 112], [bx - 44, by - 56], [bx - 54, by + 2]], [[bx + 8, by - 112], [bx + 30, by - 58], [bx + 44, by - 4]]] });
    c.beginPath(); c.roundRect(bx - 64, by - 224 + br, 48, 106, 18); c.fill();
    c.beginPath(); c.ellipse(bx - 56, by + 2, 24, 13, 0, 0, TAU); c.ellipse(bx + 50, by - 4, 24, 13, 0, 0, TAU); c.fill();
  }, { fill: '#171242', rim: '#ffd9a6', dir: [-9, 5], rim2: '#8fd8ff' });
  // glass helmet
  ctx.fillStyle = 'rgba(180,225,255,0.12)'; ctx.beginPath(); ctx.arc(bx + 9, by - 250 + br, 58, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(214,244,255,0.9)'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(bx + 9, by - 250 + br, 58, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,225,180,0.95)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(bx + 9, by - 250 + br, 49, -.95, -.15); ctx.stroke();
  futureBraid(ctx, g, bx + 34, by - 246 + br, 52, Math.sin(on2(t) * 1.4) * 4, .8);
  for (let i = 0; i < 6; i++) ell(ctx, bx - 140 - i * 66, by + 66 + i * 30, 16, 6, 'rgba(45,72,140,0.7)', .35);
  ctx.restore();
  motes(ctx, t, { n: 50, seed: 3, color: '#dff4ff', vy: -8, a: .7 });
  S.P.thresh = .8; S.P.bloom = .55;
}

// ---------------------------------------------------------------- 30: the mural
function muralWall() {
  return layer('mural', 2160, 1240, x => {
    x.translate(120, 80);
    rect(x, -120, -80, 2160, 1240, linGrad(x, 0, 0, 1920, 1080, [[0, '#ffd9a8'], [.5, '#f2ac8c'], [1, '#b76f8c']]));
    const R = rng(2024);
    for (let i = 0; i < 1500; i++) { x.fillStyle = rgba(R.pick(['#fff0d4', '#c9728a', '#ffbe90']), R.range(.03, .12)); x.beginPath(); x.ellipse(R.range(-120, 2040), R.range(-80, 1160), R.range(8, 70), R.range(3, 14), R.range(-.4, .4), 0, TAU); x.fill(); }
    for (let row = 0; row < 24; row++) for (let col = -2; col < 24; col++) { x.strokeStyle = 'rgba(122,60,98,0.16)'; x.lineWidth = 2; x.strokeRect(col * 96 + (row % 2) * 48, row * 52 - 80, 96, 52); }
    // storeys of small windows give the painting its size: the whole side of a building
    for (let row = 0; row < 9; row++) for (let col = 0; col < 17; col++) {
      const wx = -70 + col * 124, wy = -34 + row * 132;
      rect(x, wx - 5, wy - 5, 58, 82, 'rgba(120,56,96,0.55)');
      rect(x, wx, wy, 48, 72, linGrad(x, 0, wy, 0, wy + 72, [[0, R() < .22 ? '#ffe9a8' : '#6d4a86'], [1, R() < .22 ? '#ffc878' : '#4b3270']]));
      rect(x, wx + 22, wy, 4, 72, 'rgba(110,48,90,0.8)'); rect(x, wx - 9, wy + 77, 66, 8, '#ffd2a0'); rect(x, wx - 9, wy + 85, 66, 5, 'rgba(90,36,80,0.5)');
    }
    // a painted night, with ragged brush edges
    const field = [];
    for (let i = 0; i <= 90; i++) { const a = i / 90 * TAU; const m = 1 + .13 * vnoise(i * .3, 5) + .07 * vnoise(i * .9, 9); field.push([860 + Math.cos(a) * 720 * m, 470 + Math.sin(a) * 390 * m]); }
    fillPoly(x, field, '#25397e');
    x.save(); polyPath(x, field); x.clip();
    for (let i = 0; i < 520; i++) { const px = R.range(80, 1650), py = R.range(40, 900); ink(x, `M ${px} ${py} q ${R.range(40, 110)} ${R.range(-34, 34)} ${R.range(90, 230)} ${R.range(-20, 20)}`, R.range(10, 34), { color: rgba(R.pick(['#1b2c6c', '#3553a4', '#4a3d90', '#1f6f98']), R.range(.35, .8)), t0: .2, t1: .5 }); }
    for (let i = 0; i < 240; i++) dot(x, R.range(120, 1620), R.range(60, 880), R.range(1.5, 5), rgba('#fff3c8', R.range(.5, 1)));
    for (let i = 0; i < 20; i++) sparkle(x, R.range(160, 1580), R.range(90, 840), R.range(10, 26), '#fff6d8', .95);
    x.restore();
    // the whale
    const whale = 'M 330 520 C 380 340 640 262 900 296 C 1120 324 1262 420 1352 470 C 1420 500 1470 460 1500 380 C 1520 330 1580 292 1646 296 C 1610 330 1592 368 1594 404 C 1636 396 1676 410 1704 446 C 1636 446 1588 482 1560 524 C 1500 612 1380 640 1240 640 C 1100 720 900 772 690 740 C 480 710 316 640 330 520 Z';
    cel(x, whale, '#3f87c9', [
      ['M 300 560 C 520 660 900 640 1240 596 C 1400 576 1500 540 1580 470 L 1700 700 L 300 800 Z', '#2d5fa4'],
      ['M 316 560 C 470 640 700 660 900 640 C 1050 626 1150 610 1240 640 C 1100 720 900 772 690 740 C 480 710 340 650 316 560 Z', '#e9f4ff'],
      ['M 420 420 C 560 300 800 268 1010 320 C 860 316 640 340 480 460 Z', '#76c1ea'],
    ]);
    for (let i = 0; i < 9; i++) ink(x, `M ${420 + i * 66} ${636 + Math.sin(i * .7) * 28} Q ${520 + i * 70} ${694 + Math.sin(i) * 20} ${660 + i * 66} ${668 - i * 3}`, 6, { color: '#9fc4e6', t0: .4, t1: .4 });
    clipD(x, whale, () => {
      for (let i = 0; i < 620; i++) {
        const px = R.range(300, 1720), py = R.range(280, 780), low = py > 600;
        ink(x, `M ${px} ${py} q ${R.range(26, 70)} ${R.range(-24, 6)} ${R.range(70, 160)} ${R.range(-12, 26)}`, R.range(5, 20), { color: rgba(R.pick(low ? ['#ffffff', '#b9d4f4', '#f4d8ee'] : ['#55b4e4', '#2b64ae', '#6f7fd4', '#3fa6c4', '#244f98']), R.range(.18, .6)), t0: .25, t1: .6 });
      }
      // she paints it full of constellations, like someone she knows
      const pts = [];
      for (let i = 0; i < 34; i++) pts.push([R.range(560, 1340), R.range(340, 560)]);
      pts.forEach((p, i) => {
        pts.map((q, j) => [j, (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2]).filter(q => q[0] !== i).sort((a, b) => a[1] - b[1]).slice(0, 2)
          .forEach(([j]) => taper(x, [p, pts[j]], 3, { color: 'rgba(220,248,255,0.7)', t0: 0, t1: 0 }));
        dot(x, p[0], p[1], R.range(4, 8), '#f4feff');
        if (i % 7 === 0) sparkle(x, p[0], p[1], 24, '#ffffff', 1);
      });
    });
    ell(x, 492, 520, 21, 24, '#0d1c44'); dot(x, 485, 511, 8, '#ffffff');
    ink(x, 'M 348 586 C 430 606 500 598 566 566', 8, { color: '#1d3c74', t0: .3, t1: .5 });
    cel(x, 'M 760 628 C 800 720 880 780 980 794 C 950 734 920 676 902 620 Z', '#356fb2', [['M 760 640 C 860 700 920 750 980 794 L 760 820 Z', '#27528e']]);
    ink(x, whale, 9, { color: '#101c4a', t0: .04, t1: .04, min: .5 });
    for (const d of ['M 1560 640 C 1700 600 1790 520 1812 410', 'M 1520 690 C 1700 660 1850 560 1880 430', 'M 1660 300 C 1740 330 1790 380 1800 450', 'M 1450 760 C 1600 770 1760 720 1860 620']) {
      const pts = polyOf(d);
      for (let i = 0; i + 3 < pts.length; i += 5) taper(x, pts.slice(i, i + 4), 5, { color: 'rgba(255,250,235,0.85)', t0: .3, t1: .3 });
    }
    // stars spilling from the blowhole
    for (let i = 0; i < 46; i++) { const a = -Math.PI / 2 + R.range(-.65, .65), d = R.range(40, 270); sparkle(x, 640 + Math.cos(a) * d, 300 + Math.sin(a) * d * .82, R.range(8, 22), R.pick(['#fff1b0', '#ffffff', '#ff9fc0', '#9ff6ff']), 1); }
  });
}
function futureMural(S, u) {
  const { ctx, g, t } = S;
  const k = clamp(u / 2.2);
  const wall = muralWall();
  { const z = 1.08 - .07 * E.outCubic(k); ctx.drawImage(wall, 960 - wall.width * z / 2 + 40 * k - 20, 540 - wall.height * z / 2, wall.width * z, wall.height * z); }
  // sunlight falling across the wall in bands
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [x0, wd, a] of [[-240, 260, .13], [170, 90, .09], [380, 40, .08]]) fillPoly(ctx, [[x0, -20], [x0 + wd, -20], [x0 + wd + 620, 1100], [x0 + 620, 1100]], `rgba(255,214,140,${a})`);
  ctx.restore();
  // scaffold
  ctx.strokeStyle = '#3a2352'; ctx.lineWidth = 13;
  for (const x of [1440, 1660, 1870]) { ctx.beginPath(); ctx.moveTo(x, 770); ctx.lineTo(x, 1100); ctx.stroke(); }
  ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(1440, 800); ctx.lineTo(1660, 1060); ctx.moveTo(1660, 800); ctx.lineTo(1440, 1060); ctx.moveTo(1660, 800); ctx.lineTo(1870, 1060); ctx.moveTo(1870, 800); ctx.lineTo(1660, 1060); ctx.stroke();
  rect(ctx, 1390, 866, 530, 22, '#4b2d5e'); rect(ctx, 1390, 866, 530, 5, '#ffcf94');
  const bx = 1585, by = 868, dq = on2(t), swing = q => Math.sin(q * 5.2), sw = swing(dq);
  const tipAt = q => [1368 + swing(q) * 58, 466 - swing(q) * 108];
  const tip = tipAt(dq);
  if (Math.abs(Math.cos(dq * 5.2)) > .55) {              // paint smear along the stroke
    const arc = [];
    for (let i = 0; i <= 14; i++) { const q = dq - .17 * (1 - i / 14), p = tipAt(q), bow = Math.sin(i / 14 * Math.PI) * 34; arc.push([p[0] - bow, p[1] - bow * .35]); }
    taper(ctx, arc, 62, { color: 'rgba(255,127,164,0.9)', t0: .85, t1: .04 });
    taper(ctx, arc.map(p => [p[0] + 13, p[1] + 6]), 24, { color: 'rgba(255,208,90,0.85)', t0: .85, t1: .1 });
    taper(ctx, arc.map(p => [p[0] - 18, p[1] - 8]), 9, { color: 'rgba(255,246,220,0.85)', t0: .8, t1: .1 });
  }
  silhouette(ctx, c => {
    person(c, { head: [bx - 14, by - 252, 33], neck: [bx - 6, by - 208], hip: [bx + 14, by - 112], flow: 16,
      arms: [[[bx - 26, by - 196], [bx - 82, by - 214 - sw * 8], [bx - 112 + sw * 10, by - 268 - sw * 18]], [[bx + 10, by - 194], [bx - 38, by - 160], [bx - 74 + sw * 8, by - 214 - sw * 14]]],
      legs: [[[bx + 2, by - 112], [bx - 22, by - 54], [bx - 40, by]], [[bx + 24, by - 112], [bx + 42, by - 56], [bx + 52, by]]],
      coat: [[bx - 34, by - 168], [bx - 38, by - 80], [bx + 58, by - 84], [bx + 40, by - 180]] });
    c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(bx - 66 + sw * 8, by - 206 - sw * 12); c.lineTo(tip[0], tip[1]); c.stroke();
    c.beginPath(); c.ellipse(bx - 40, by, 22, 10, 0, 0, TAU); c.ellipse(bx + 56, by, 22, 10, 0, 0, TAU); c.fill();
  }, { fill: '#2a1648', rim: '#ffd592', dir: [9, 4] });
  rect(ctx, bx - 28, by - 196, 6, 54, '#7cf0d0');
  ell(ctx, tip[0], tip[1], 30, 19, '#ff7fa4', -.8);
  // paint thrown from the brush
  const R = rng(17);
  for (let i = 0; i < 70; i++) {
    const born = R() * 2.2, life = u - born; if (life < 0 || life > .9) continue;
    const a = R.range(-3.7, -1.3), sp = R.range(180, 640), c = R.pick(['#ff7fa4', '#ffd05a', '#7cf0d0', '#7fb8ff', '#fff3d2']);
    const x = tip[0] + Math.cos(a) * sp * life, y = tip[1] + Math.sin(a) * sp * life + 420 * life * life;
    ell(ctx, x, y, R.range(5, 17) * (1 - life * .6), R.range(4, 9) * (1 - life * .6), c, Math.atan2(Math.sin(a) * sp + 840 * life, Math.cos(a) * sp));
  }
  futureBraid(ctx, g, bx - 42, by - 244, 58, sw * 5, .82);
  for (const [px, c] of [[1448, '#ff7fa4'], [1730, '#ffd05a'], [1792, '#7cf0d0']]) { rect(ctx, px, 832, 40, 36, '#5d3a6c'); ell(ctx, px + 20, 834, 20, 6, c); }
  S.P.bloom = .36; S.P.thresh = .88;
}

// ---------------------------------------------------------------- 32: past the sun
function futureSail(S, u) {
  const { ctx, g, t } = S;
  const k = E.inOutSine(clamp(u / 2.2));
  drawNebula(ctx, 'void', -50 * k, 0, 1.06);
  const sx = 214 - 70 * k, sy = 420;
  glow(ctx, sx, sy, 900, '#ff8a3d', .75); glow(ctx, sx, sy, 440, '#ffd27a', .9);
  dot(ctx, sx, sy, 158, radGrad(ctx, sx, sy, 20, 158, [[0, '#fffdf0'], [.7, '#fff0bd'], [1, '#ffbe5c']]));
  glow(g, sx, sy, 330, '#ffcf80', .9);
  // the solar wind
  const R = rng(81);
  for (let i = 0; i < 130; i++) {
    const y0 = R.range(-60, 1140), sp = R.range(500, 1500), len = R.range(60, 260), x = ((R.range(0, 2400) + u * sp) % 2400) - 200;
    if (x < sx + 120) continue;
    const y = y0 + (y0 - sy) * (x - sx) / 5000;
    taper(ctx, [[x - len, y - (y0 - sy) * len / 5000], [x, y]], R.range(1.4, 4), { color: rgba('#ffe2a8', R.range(.15, .6)), t0: .9, t1: .05 });
  }
  ctx.save(); ctx.translate(40 * k - 20, 12 * Math.sin(u * 1.4));
  const sail = 'M 900 96 C 1180 150 1520 150 1830 118 C 1722 330 1730 590 1806 826 C 1500 780 1200 800 930 908 C 1006 650 996 360 900 96 Z';
  ctx.fillStyle = linGrad(ctx, 880, 90, 1840, 900, [[0, 'rgba(255,214,170,0.95)'], [.3, 'rgba(255,150,176,0.9)'], [.62, 'rgba(150,134,226,0.88)'], [1, 'rgba(78,84,180,0.9)']]);
  ctx.fill(new Path2D(sail));
  clipD(ctx, sail, () => {
    fillD(ctx, 'M 880 90 C 1100 380 1100 640 920 920 L 880 920 Z', 'rgba(255,244,212,0.85)');
    fillD(ctx, 'M 1180 60 L 1370 60 L 1160 950 L 1050 950 Z', 'rgba(255,255,255,0.2)');
    fillD(ctx, 'M 1480 60 L 1530 60 L 1330 950 L 1304 950 Z', 'rgba(255,255,255,0.16)');
    for (const [a, b] of [[[900, 96], [1806, 826]], [[1830, 118], [930, 908]], [[1356, 130], [1372, 842]], [[968, 500], [1744, 466]]]) { ctx.strokeStyle = 'rgba(60,34,110,0.55)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.strokeStyle = 'rgba(255,236,226,0.65)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(a[0], a[1] - 4); ctx.lineTo(b[0], b[1] - 4); ctx.stroke(); }
  });
  ink(ctx, sail, 7, { color: '#fff0e2', t0: .04, t1: .04, min: .6 });
  const pod = [648, 760];
  ctx.strokeStyle = 'rgba(224,232,255,0.75)'; ctx.lineWidth = 2.2; ctx.beginPath();
  for (const c of [[900, 96], [930, 908], [1356, 500]]) { ctx.moveTo(pod[0] + 40, pod[1] - 26); ctx.lineTo(c[0], c[1]); }
  ctx.stroke();
  const bx = 640, by = 760, fl = Math.sin(on2(t) * 2.4) * 6;
  silhouette(ctx, c => {
    c.fill(new Path2D(`M ${bx - 190} ${by + 22} C ${bx - 130} ${by - 14} ${bx + 40} ${by - 34} ${bx + 124} ${by - 6} C ${bx + 118} ${by + 40} ${bx + 20} ${by + 78} ${bx - 80} ${by + 72} C ${bx - 130} ${by + 68} ${bx - 170} ${by + 50} ${bx - 190} ${by + 22} Z`));
    c.fill(new Path2D(`M ${bx - 120} ${by + 52} L ${bx - 232} ${by + 104} L ${bx - 150} ${by + 28} Z`));
    c.fill(new Path2D(`M ${bx - 150} ${by + 8} L ${bx - 244} ${by - 38} L ${bx - 110} ${by - 4} Z`));
    c.lineWidth = 7; c.beginPath(); c.moveTo(bx + 70, by - 18); c.lineTo(bx + 96, by - 150); c.stroke();
    person(c, { head: [bx + 14, by - 168 + fl * .3, 25], neck: [bx + 8, by - 134], hip: [bx - 4, by - 64], flow: -30,
      arms: [[[bx + 18, by - 128], [bx + 58, by - 112], [bx + 78, by - 136]], [[bx - 4, by - 128], [bx - 42, by - 98], [bx - 66, by - 112 + fl]]],
      legs: [[[bx - 2, by - 64], [bx + 22, by - 28], [bx + 8, by + 8]], [[bx - 10, by - 64], [bx - 28, by - 22], [bx - 52, by - 2]]] });
  }, { fill: '#170f3e', rim: '#ffd48a', dir: [8, 3], rim2: '#9aa4ff' });
  for (let i = 0; i < 3; i++) { const wx = bx - 88 + i * 52, wy = by + 26 - i * 5; ell(ctx, wx, wy, 13, 13, '#ffe7a8'); glow(ctx, wx, wy, 40, '#ffd27a', .7); glow(g, wx, wy, 34, '#ffd27a', .7); }
  ink(ctx, `M ${bx - 182} ${by + 26} C ${bx - 90} ${by + 6} ${bx + 20} ${by - 6} ${bx + 118} ${by - 4}`, 5, { color: '#ffcf8a', t0: .3, t1: .3 });
  glow(ctx, bx - 214, by + 40, 90 + 16 * Math.sin(t * 23), '#9fe8ff', .75); glow(g, bx - 214, by + 40, 70, '#9fe8ff', .8);
  taper(ctx, spline([[bx - 6, by - 150], [bx - 80, by - 170 + fl], [bx - 150, by - 150 - fl]], 14), 12, { color: '#ff7466', t0: .05, t1: .9 });
  ctx.fillStyle = 'rgba(180,225,255,0.12)'; ctx.beginPath(); ctx.arc(bx + 15, by - 170 + fl * .3, 46, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(214,244,255,0.9)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,225,180,0.95)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(bx + 15, by - 170 + fl * .3, 38, Math.PI * .8, Math.PI * 1.4); ctx.stroke();
  futureBraid(ctx, g, bx + 32, by - 164, 46, -10 + fl, .66);
  ctx.restore();
  lensFlare(ctx, sx, sy, .62);
  S.P.thresh = .84; S.P.bloom = .5;
}

// ---------------------------------------------------------------- 34: the song
const FS_SEA = `
uniform float uT;
void main(){
  vec2 p = vec2(uv.x,1.-uv.y)*uRes/uRes.y;
  float y = p.y;
  vec3 col = mix(vec3(.40,.93,.84), vec3(.04,.33,.50), smoothstep(0.,.46,y));
  col = mix(col, vec3(.015,.10,.25), smoothstep(.46,1.0,y));
  vec2 s = p - vec2(1.16,-.5);
  float a = atan(s.x, s.y);
  float ray = pow(fbm3(vec2(a*13. + uT*.16, uT*.11)),3.)*2.2 + pow(fbm3(vec2(a*31. - uT*.22, 3.)),4.)*1.6;
  col += vec3(.55,1.,.9)*ray*(1.-smoothstep(.1,.98,y))*.62;
  // caustic net near the surface
  vec2 q = p*vec2(5.,13.) + vec2(uT*.3,0.);
  float c = abs(fbm3(q + fbm3(q*1.7+uT*.25)*1.6)-.5);
  col += vec3(.75,1.,.95)*smoothstep(.045,.0,c)*(1.-smoothstep(.0,.2,y))*.55;
  // sand
  float floorY = .83 + .022*sin(p.x*4.3) + .012*sin(p.x*11.);
  if(y>floorY){
    float d = (y-floorY)/(1.-floorY);
    vec3 sand = mix(vec3(.12,.36,.50), vec3(.03,.10,.24), d);
    vec2 cq = vec2(p.x*9./(.35+d), d*13.) + vec2(uT*.35, uT*.1);
    float cc = abs(fbm3(cq + fbm3(cq*1.4 - uT*.3)*1.8)-.5);
    sand += vec3(.45,.95,.85)*smoothstep(.055,.0,cc)*(1.-d*.7)*.65;
    col = sand;
  }
  col += (h21(p*uRes.y)-.5)/120.;
  O = vec4(col,1.);
}`;
function jellyfish(ctx, g, x, y, r, t, ph, col) {
  const pulse = Math.sin(t * 3.1 + ph);
  const w = r * (1 + .12 * pulse), hh = r * (.82 - .1 * pulse);
  glow(ctx, x, y, r * 2.6, col, .38); glow(g, x, y, r * 2, col, .5);
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const s = (i / 6 - .5) * 1.6;
    const pts = [];
    for (let j = 0; j <= 16; j++) { const q = j / 16; pts.push([x + s * w * (1 - q * .35) + Math.sin(q * 6.5 - t * 3.4 + ph + i) * r * .16 * q, y + q * r * (2.1 + .5 * hash(i + ph * 10))]); }
    taper(ctx, pts, r * .075, { color: rgba(col, .62), t0: 0, t1: .9 });
  }
  ctx.fillStyle = radGrad(ctx, x, y - hh * .4, 2, w * 1.1, [[0, 'rgba(255,255,255,0.88)'], [.45, rgba(col, .62)], [1, rgba(col, .24)]]);
  ctx.beginPath(); ctx.moveTo(x - w, y);
  ctx.bezierCurveTo(x - w, y - hh * 1.3, x + w, y - hh * 1.3, x + w, y);
  for (let i = 5; i >= 0; i--) { const px = x - w + i * (2 * w / 6); ctx.quadraticCurveTo(px + w / 6, y + r * .2, px, y); }
  ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', .75); ctx.lineWidth = Math.max(1.5, r * .05); ctx.beginPath(); ctx.moveTo(x - w * .78, y - hh * .35); ctx.bezierCurveTo(x - w * .62, y - hh * .98, x - w * .1, y - hh * 1.04, x + w * .14, y - hh * .92); ctx.stroke();
  ctx.restore();
}
function musicNote(ctx, x, y, s, col, a) {
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(s, s);
  ell(ctx, 0, 0, 13, 9.5, col, -.35);
  ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(11, -3); ctx.lineTo(11, -48); ctx.quadraticCurveTo(14, -34, 30, -28); ctx.quadraticCurveTo(38, -22, 32, -12); ctx.stroke();
  ctx.restore();
}
function futureSong(S, u) {
  const { ctx, g, t } = S;
  const k = clamp(u / 2.2);
  Painter.draw(ctx, 'sea', FS_SEA, 960, 540, { uT: t }, 0, 0, W, H);
  ctx.save(); cam(ctx, 1.02 + .05 * E.inOutSine(k)); g.save(); cam(g, 1.02 + .05 * E.inOutSine(k));
  ell(ctx, 1010, 936, 430, 34, 'rgba(2,10,30,0.55)');
  jellyfish(ctx, g, 300, 300 - u * 24, 74, t, 0, '#ff9ad2');
  jellyfish(ctx, g, 1646, 400 - u * 30, 96, t, 2.1, '#9fe0ff');
  jellyfish(ctx, g, 520, 150 - u * 18, 42, t, 4.0, '#c8a8ff');
  jellyfish(ctx, g, 1430, 170 - u * 14, 34, t, 1.2, '#ffc6e2');
  const hands = Math.sin(on2(t) * 13) * 7;
  silhouette(ctx, c => {
    // grand piano: lid raised on its stick
    c.fill(new Path2D('M 860 670 L 1450 670 C 1520 672 1542 716 1500 740 C 1440 772 1360 748 1290 764 C 1220 780 1200 800 1130 800 L 860 800 Z'));
    c.fill(new Path2D('M 880 662 L 1468 662 L 1380 430 C 1300 402 1190 452 1100 470 C 1000 490 940 520 880 662 Z'));
    c.beginPath(); c.rect(806, 704, 96, 36); c.fill();
    for (const x of [900, 1150, 1430]) { c.beginPath(); c.moveTo(x - 16, 760); c.lineTo(x + 16, 760); c.lineTo(x + 7, 934); c.lineTo(x - 7, 934); c.fill(); }
    c.beginPath(); c.rect(1010, 800, 10, 118); c.rect(986, 910, 58, 10); c.fill();
    // bench and the player
    c.beginPath(); c.rect(618, 806, 146, 22); c.rect(630, 826, 14, 108); c.rect(738, 826, 14, 108); c.fill();
    person(c, { head: [712, 560, 36], neck: [704, 610], hip: [680, 796], flow: -26,
      arms: [[[716, 622], [744, 704], [826, 706 + hands]], [[690, 622], [704, 710], [812, 712 - hands]]],
      legs: [[[692, 796], [806, 806], [812, 930]], [[672, 800], [772, 826], [768, 932]]] });
  }, { fill: '#061434', rim: '#9ffff0', dir: [-7, 7], rim2: '#ff9ad2' });
  rect(ctx, 806, 704, 96, 8, '#f2fbff'); for (let i = 0; i < 13; i++) rect(ctx, 810 + i * 7, 704, 2, 8, '#16305c');
  taper(ctx, spline([[1380, 432], [1300, 404], [1190, 452], [1100, 470], [1000, 490], [880, 662]], 10), 4, { color: 'rgba(160,255,240,0.8)', t0: .3, t1: .3 });
  // hair lifting in the water
  for (let i = 0; i < 4; i++) taper(ctx, spline([[690 - i * 6, 552 - i * 4], [636 - i * 14, 512 - i * 18 + Math.sin(on2(t) * 2.2 + i) * 10], [596 - i * 22, 522 - i * 38 + Math.sin(on2(t) * 2.2 + i + 1.3) * 18]], 12), 15 - i * 2, { color: '#0a1a40', t0: .05, t1: .85 });
  futureBraid(ctx, g, 736, 566, 62, Math.sin(on2(t) * 2) * 8, .85);
  // the song leaves the piano as light
  const R = rng(333);
  for (let i = 0; i < 22; i++) {
    const born = R.range(-.8, 2), life = u - born; if (life < 0) continue;
    const x = R.range(940, 1360) + Math.sin(life * 3 + i) * 50 + life * R.range(-60, 90), y = 650 - life * R.range(130, 260);
    const col = R.pick(['#c8fff4', '#ffe0a8', '#ffc4e6']);
    musicNote(ctx, x, y, R.range(.7, 1.25), col, clamp(life * 3) * clamp(1.8 - life)); glow(g, x, y, 40, col, .5 * clamp(1.8 - life));
  }
  for (let i = 0; i < 70; i++) {
    const r = R.range(2, 9), x = R.range(0, W) + Math.sin(t * 2 + i) * 9, y = ((R.range(0, 1100) - u * R.range(60, 190)) % 1100 + 1100) % 1100;
    ctx.strokeStyle = 'rgba(206,255,248,0.6)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); dot(ctx, x - r * .3, y - r * .35, r * .22, 'rgba(255,255,255,0.9)');
  }
  ctx.restore(); g.restore();
  S.P.bloom = .55; S.P.thresh = .8;
}

// ---------------------------------------------------------------- 36: ninety-one
function flowerField(ctx, g, t, o = {}) {
  const R = rng(o.seed ?? 4321), hz = o.horizon ?? 740;
  for (let i = 0; i < 2100; i++) {
    const d = Math.pow(i / 2100, 1.7);               // far flowers first
    const y = hz + 8 + d * (1100 - hz) + R.range(-8, 8), x = R.range(-60, 1980);
    const s = 1.2 + d * 15 * R.range(.55, 1.2), wind = Math.sin(t * 2 + x * .006 + y * .01) * s * .7;
    const col = R.pick(['#fff4c9', '#ffd1e4', '#c9f4ff', '#ffe38f', '#ffffff']);
    if (d > .12) { ctx.strokeStyle = rgba('#2f6a5a', .8); ctx.lineWidth = Math.max(1, s * .16); ctx.beginPath(); ctx.moveTo(x, y + s * 2.6); ctx.quadraticCurveTo(x, y + s, x + wind, y); ctx.stroke(); }
    if (s > 6) { for (let p = 0; p < 5; p++) { const a = p / 5 * TAU + i; ell(ctx, x + wind + Math.cos(a) * s * .52, y + Math.sin(a) * s * .36, s * .5, s * .3, col, a); } dot(ctx, x + wind, y, s * .26, '#ffb340'); }
    else dot(ctx, x + wind, y, s * .55, col);
    if (g && i % 23 === 0) glow(g, x + wind, y, s * 3.4, col, .5);
  }
}
function futureOld(S, u) {
  const { ctx, g, t } = S;
  const k = E.outCubic(clamp(u / 2.2)), z = 1.13 - .12 * k;
  ctx.save(); g.save(); cam(ctx, z, 0, 16 * (1 - k), 0, 760, 760); cam(g, z, 0, 16 * (1 - k), 0, 760, 760);
  drawSky(ctx, 'gold', -10 * k, -70, 1.04);
  fillD(ctx, 'M -60 760 C 240 690 520 700 760 748 C 1040 800 1380 668 1980 726 L 1980 1160 L -60 1160 Z', '#8a6a92');
  fillD(ctx, 'M -60 800 C 300 744 620 770 900 822 C 1220 872 1560 760 1980 796 L 1980 1160 L -60 1160 Z', linGrad(ctx, 0, 750, 0, 1100, [[0, '#8fa377'], [.4, '#4f7e68'], [1, '#1f4150']]));
  ink(ctx, 'M -60 800 C 300 744 620 770 900 822 C 1220 872 1560 760 1980 796', 6, { color: '#ffe9ac', t0: .02, t1: .02 });
  flowerField(ctx, g, t, { horizon: 780 });
  const bx = 800, by = 928, sw = Math.sin(on2(t) * 6) * (u > .6 ? 2.4 : 0);
  ctx.save(); g.save();
  for (const c of [ctx, g]) { c.translate(bx, by - 40); c.scale(1.34, 1.34); c.translate(-bx, -(by + 4)); }
  silhouette(ctx, c => {
    person(c, { head: [bx + 22, by - 330 + sw, 41], neck: [bx + 2, by - 276 + sw], hip: [bx - 24, by - 150], flow: 22,
      arms: [[[bx + 22, by - 262 + sw], [bx + 68, by - 202], [bx + 96, by - 168]], [[bx - 26, by - 258 + sw], [bx - 46, by - 190], [bx + 2, by - 174 + sw]]],
      legs: [[[bx - 30, by - 150], [bx - 34, by - 76], [bx - 36, by + 6]], [[bx - 4, by - 150], [bx + 8, by - 76], [bx + 12, by + 6]]],
      coat: [[bx - 56, by - 236], [bx - 76, by - 52], [bx + 52, by - 52], [bx + 34, by - 244]] });
    c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(bx + 100, by - 172); c.lineTo(bx + 112, by + 8); c.stroke();
    c.beginPath(); c.arc(bx + 88, by - 172, 13, Math.PI, TAU); c.stroke();
  }, { fill: '#3b2350', rim: '#ffe6a0', dir: [11, 5], rim2: '#ffb0c8' });
  // white hair, same cut, same braid, same thread; she is laughing
  const hx = bx + 22, hy = by - 330 + sw;
  silhouette(ctx, c => bobPath(c, hx, hy, 41, 14), { fill: '#ded2ea', rim: '#fffbe4', dir: [10, 5] });
  cel(ctx, `M ${hx + 6} ${hy - 22} C ${hx + 36} ${hy - 22} ${hx + 50} ${hy - 4} ${hx + 49} ${hy + 8} C ${hx + 56} ${hy + 14} ${hx + 50} ${hy + 18} ${hx + 45} ${hy + 18} C ${hx + 42} ${hy + 40} ${hx + 22} ${hy + 50} ${hx + 4} ${hy + 42} C ${hx - 8} ${hy + 30} ${hx - 6} ${hy - 6} ${hx + 6} ${hy - 22} Z`, '#f4b9a0', [[`M ${hx - 12} ${hy + 22} C ${hx + 10} ${hy + 40} ${hx + 30} ${hy + 40} ${hx + 46} ${hy + 20} L ${hx + 46} ${hy + 60} L ${hx - 12} ${hy + 60} Z`, '#d9908e']]);
  silhouette(ctx, c => c.fill(new Path2D(`M ${hx - 4} ${hy - 44} C ${hx + 34} ${hy - 46} ${hx + 52} ${hy - 24} ${hx + 48} ${hy - 4} C ${hx + 38} ${hy - 18} ${hx + 28} ${hy - 20} ${hx + 18} ${hy - 16} C ${hx + 16} ${hy - 6} ${hx + 8} ${hy + 4} ${hx - 2} ${hy + 8} L ${hx - 20} ${hy - 20} Z`)), { fill: '#ded2ea', rim: '#fffbe4', dir: [6, 4] });
  ink(ctx, `M ${hx + 22} ${hy + 1} Q ${hx + 31} ${hy - 9} ${hx + 40} ${hy}`, 3.8, { color: '#4b2440', t0: .2, t1: .2 });
  fillD(ctx, `M ${hx + 24} ${hy + 20} Q ${hx + 36} ${hy + 26} ${hx + 46} ${hy + 19} Q ${hx + 42} ${hy + 36} ${hx + 32} ${hy + 34} Q ${hx + 25} ${hy + 31} ${hx + 24} ${hy + 20} Z`, '#6a2240');
  glow(ctx, hx + 20, hy + 14, 20, '#ff6f78', .5);
  futureBraid(ctx, g, hx - 2, hy + 12, 76, sw * 2, 1.0);
  ctx.restore(); g.restore();
  // petals on the wind
  const R = rng(91);
  for (let i = 0; i < 90; i++) {
    const sp = R.range(90, 300), x = ((R.range(0, 2200) + u * sp) % 2200) - 100, y = R.range(200, 1060) - Math.sin(t * 2 + i) * 30 - u * 20;
    ell(ctx, x, y, R.range(5, 13), R.range(2.5, 5.5), R.pick(['#fff0d0', '#ffc4d8', '#ffffff']), t * R.range(-4, 4) + i);
  }
  ctx.restore(); g.restore();
  lensFlare(ctx, 405, 750, .4);
  motes(ctx, t, { n: 60, seed: 8, color: '#fff0b8', vy: -26, a: .8 });
  S.P.bloom = .35; S.P.thresh = .88;
}

// ---------------------------------------------------------------- 38: the flurry
function seaOfClouds(ctx, t, y0, cols, seed) {
  cols.forEach((col, row) => {
    const R = rng(seed + row * 31), y = y0 + row * 74;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-60, 1140); ctx.lineTo(-60, y);
    let x = -60;
    while (x < 1980) { const r = R.range(46, 140); ctx.quadraticCurveTo(x + r * .5, y - r * R.range(.35, .8), x + r, y + R.range(-14, 14)); x += r; }
    ctx.lineTo(1990, 1140); ctx.fill();
  });
}
function lifeSummit(S, u) {
  const { ctx, g, t } = S;
  drawSky(ctx, 'gold', -40 * u, -150, 1.12);
  seaOfClouds(ctx, t, 690, ['#c9788c', '#e5929a', '#f7b0a0', '#d98aa0'], 12);
  const bx = 960, by = 700;
  silhouette(ctx, c => {
    c.fill(new Path2D('M 380 1100 L 690 840 L 770 856 L 900 720 L 960 700 L 1040 724 L 1120 830 L 1240 858 L 1560 1100 Z'));
    person(c, { head: [bx, by - 214, 29], neck: [bx, by - 178], hip: [bx, by - 98], flow: 34,
      arms: [[[bx - 20, by - 168], [bx - 72, by - 214], [bx - 108, by - 282]], [[bx + 20, by - 168], [bx + 70, by - 218], [bx + 104, by - 284]]],
      legs: [[[bx - 12, by - 98], [bx - 30, by - 48], [bx - 42, by + 4]], [[bx + 12, by - 98], [bx + 28, by - 48], [bx + 36, by + 6]]] });
  }, { fill: '#33184a', rim: '#ffdf9a', dir: [8, 6] });
  taper(ctx, spline([[bx + 6, by - 176], [bx + 86, by - 182 + Math.sin(on2(t) * 9) * 12], [bx + 170, by - 158 - Math.sin(on2(t) * 9) * 18]], 12), 15, { color: '#ff6f5c', t0: .03, t1: .85 });
  futureBraid(ctx, g, bx + 24, by - 206, 54, 20, .76);
  lensFlare(ctx, 470, 640, .5);
}
function lifeLanterns(S, u) {
  const { ctx, g, t } = S;
  drawSky(ctx, 'dusk', 0, -40, 1.05);
  const R = rng(616);
  const lantern = (x, y, s) => {
    glow(ctx, x, y, s * 3.4, '#ff9f4a', .55); glow(g, x, y, s * 2.4, '#ffb45a', .5);
    fillD(ctx, `M ${x - s * .62} ${y - s} L ${x + s * .62} ${y - s} L ${x + s * .46} ${y + s * .8} L ${x - s * .46} ${y + s * .8} Z`, linGrad(ctx, 0, y - s, 0, y + s, [[0, '#ff8f48'], [.7, '#ffcf70'], [1, '#fff2b8']]));
    ink(ctx, `M ${x - s * .62} ${y - s} L ${x - s * .46} ${y + s * .8} L ${x + s * .46} ${y + s * .8} L ${x + s * .62} ${y - s} Z`, Math.max(1.5, s * .08), { color: '#a8442e', t0: 0, t1: 0 });
  };
  for (let i = 0; i < 90; i++) lantern(R.range(0, 1920), ((R.range(-60, 900) - u * R.range(40, 130)) % 960 + 960) % 960 - 40, R.range(4, 15) * (i > 80 ? 2.6 : 1));
  const by = 1010;
  silhouette(ctx, c => {
    c.fill(new Path2D('M -20 990 C 400 952 900 972 1300 1000 C 1600 1020 1800 984 1940 976 L 1940 1100 L -20 1100 Z'));
    person(c, { head: [870, by - 300, 38], neck: [870, by - 252], hip: [870, by - 132], flow: 12,
      arms: [[[896, by - 238], [940, by - 190], [998, by - 160]], [[844, by - 238], [800, by - 184], [792, by - 116]]],
      legs: [[[854, by - 132], [846, by - 66], [842, by]], [[886, by - 132], [896, by - 66], [902, by]]],
      coat: [[836, by - 216], [814, by - 98], [930, by - 98], [906, by - 216]] });
    person(c, { head: [1068, by - 192, 29], neck: [1068, by - 156], hip: [1070, by - 82], bob: false,
      arms: [[[1050, by - 150], [1022, by - 150], [998, by - 160]], [[1088, by - 148], [1124, by - 186], [1136, by - 246]]],
      legs: [[[1060, by - 82], [1056, by - 40], [1052, by]], [[1082, by - 82], [1088, by - 40], [1092, by]]] });
  }, { fill: '#160d38', rim: '#ffbd6a', dir: [0, 8] });
  lantern(1142, by - 292, 30);
  futureBraid(ctx, g, 900, by - 292, 68, 3, .9);
}
function lifeTeaching(S, u) {
  const { ctx, g, t } = S;
  rect(ctx, 0, 0, W, H, linGrad(ctx, 0, 0, 0, H, [[0, '#e9a27a'], [1, '#8a4f74']]));
  rect(ctx, 250, 96, 1420, 700, '#5b3052'); rect(ctx, 272, 118, 1376, 656, linGrad(ctx, 272, 118, 1648, 774, [[0, '#2c6f72'], [1, '#17404f']]));
  const chalk = 'rgba(232,255,246,0.85)';
  ink(ctx, 'M 560 440 C 560 340 640 280 740 280 C 840 280 920 340 920 440 C 920 540 840 600 740 600 C 640 600 560 540 560 440 Z', 6, { color: chalk, t0: .05, t1: .05, reveal: clamp(u * 4) });
  ink(ctx, 'M 460 500 C 600 590 900 560 1030 390', 5, { color: chalk, reveal: clamp(u * 3.4) });
  for (const [x, y, r] of [[1180, 260, 30], [1330, 400, 20], [1460, 250, 40], [1080, 540, 18], [420, 240, 26], [1500, 580, 24]]) sparkle(ctx, x, y, r, '#fff6cc', clamp(u * 5));
  ink(ctx, 'M 1180 260 L 1330 400 L 1460 250 L 1500 580 L 1180 640', 3, { color: 'rgba(232,255,246,0.55)', t0: .05, t1: .05, reveal: clamp(u * 2.6) });
  type(ctx, 'why is the sky purple?', 600, 676, { size: 38, weight: 4, track: 6, align: 'left', color: chalk, reveal: clamp(u * 2.4) });
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  fillPoly(ctx, [[1920, 0], [1920, 300], [200, 1080], [-40, 1080], [-40, 900]], 'rgba(255,190,120,0.12)'); ctx.restore();
  silhouette(ctx, c => {
    person(c, { head: [1500, 630, 52], neck: [1500, 694], hip: [1504, 880], flow: 12,
      arms: [[[1462, 712], [1380, 668], [1306, 596 + Math.sin(on2(t) * 8) * 8]], [[1540, 712], [1580, 790], [1560, 862]]],
      legs: [[[1480, 880], [1474, 990], [1470, 1100]], [[1528, 880], [1534, 990], [1540, 1100]]] });
    for (let i = 0; i < 5; i++) { const x = 300 + i * 210 + (i % 2) * 24, y = 936 + (i % 2) * 36 - (i === 2 ? 20 : 0); c.beginPath(); c.arc(x, y, 58, 0, TAU); c.fill(); capsule(c, [[x, y + 60], [x, y + 200]], 150, 180); }
    capsule(c, [[760, 920], [800, 840], [826, 742]], 34, 20);
  }, { fill: '#2a1240', rim: '#ffc287', dir: [10, 5] });
  futureBraid(ctx, g, 1542, 640, 92, 4, 1.15);
}
function lifeSnow(S, u) {
  const { ctx, g, t } = S;
  drawSky(ctx, 'night', 0, 0, 1.06);
  drawCity(ctx, g, 'night', { base: 1010 });
  rect(ctx, 0, 940, W, 140, linGrad(ctx, 0, 940, 0, 1080, [[0, '#b9c6f4'], [1, '#6c76b8']]));
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  fillPoly(ctx, [[690, 262], [770, 262], [1080, 960], [420, 960]], 'rgba(255,216,150,0.15)'); ctx.restore();
  ell(ctx, 760, 962, 340, 42, 'rgba(255,230,180,0.55)');
  const by = 960;
  silhouette(ctx, c => {
    c.beginPath(); c.rect(574, 240, 14, 722); c.rect(574, 240, 170, 12); c.fill(); c.beginPath(); c.ellipse(738, 262, 40, 18, 0, 0, TAU); c.fill();
    person(c, { head: [958, by - 318, 39], neck: [950, by - 268], hip: [946, by - 140], flow: 14,
      arms: [[[978, by - 254], [1028, by - 232], [1066, by - 296]], [[924, by - 254], [892, by - 188], [900, by - 118]]],
      legs: [[[930, by - 140], [922, by - 70], [916, by]], [[964, by - 140], [976, by - 70], [984, by]]],
      coat: [[912, by - 230], [880, by - 90], [1012, by - 90], [986, by - 232]] });
  }, { fill: '#12123c', rim: '#ffd596', dir: [10, 6], rim2: '#9fc8ff' });
  glow(ctx, 738, 270, 190, '#ffdd98', .8); glow(g, 738, 270, 150, '#ffdd98', .8); ell(ctx, 738, 268, 28, 12, '#fff6d8');
  taper(ctx, spline([[956, by - 262], [900, by - 262 + Math.sin(on2(t) * 7) * 9], [836, by - 238]], 12), 20, { color: '#ff6f78', t0: .02, t1: .8 });
  sparkle(ctx, 1072, by - 316, 26 + 5 * Math.sin(t * 9), '#e8fbff', 1, t); glow(g, 1072, by - 316, 40, '#dff6ff', .9);
  futureBraid(ctx, g, 990, by - 308, 70, 4, .9);
  const R = rng(1225);
  for (let i = 0; i < 480; i++) {
    const r = R.range(1.4, 6.5) * (i > 450 ? 2.3 : 1), sp = R.range(28, 90) + r * 8;
    dot(ctx, ((R.range(0, 2000) + Math.sin(t + i) * 26 - u * 40) % 2000 + 2000) % 2000 - 40, ((R.range(0, 1140) + u * sp * 2.4) % 1140 + 1140) % 1140 - 30, r, rgba('#f4f8ff', i > 450 ? .45 : .9));
  }
}

const FUTURES = [
  [28, 30, futureMoon, '4,102,553', 'the one where you walk on another moon.'],
  [30, 32, futureMural, '88,310,906', 'the one where you paint the whole city.'],
  [32, 34, futureSail, '1,540,002,771', 'the one where you sail past the sun.'],
  [34, 36, futureSong, '3,962,118,045', 'the one where you find the song.'],
  [36, 38, futureOld, '7,775,320,660', 'the one where you turn ninety-one.'],
];
for (const [a, b, fn, no, text] of FUTURES) {
  shot('future_' + a, a, b, S => {
    S.ctx.save(); S.g.save(); fn(S, S.u); S.ctx.restore(); S.g.restore();
    cutHit(S, a, a === 28 ? { z: .13, r: .24, shake: 26 } : {});
    futureCaption(S.ctx, S.t, a, b, no, text);
  });
}
impact(28.0, 2, 2, '#100726', '#fff6ea');
const FLURRY = [[38, lifeSummit], [38.5, lifeLanterns], [39, lifeTeaching], [39.5, lifeSnow]];
shot('flurry', 38, 40, S => {
  const i = Math.min(3, Math.floor((S.t - 38) / .5)), [a, fn] = FLURRY[i];
  S.P.bloom = .34; S.P.thresh = .87;
  // keep the four plates at similar brightness so fast cutting never strobes
  S.P.gain = [[.86, .86, .86], [1.08, 1.08, 1.08], [.96, .96, .96], [1, 1, 1]][i];
  S.ctx.save(); S.g.save(); const z = 1.07 - .05 * clamp((S.t - a) / .5); cam(S.ctx, z); cam(S.g, z); fn(S, S.t - a); S.ctx.restore(); S.g.restore();
  cutHit(S, a, { z: .06, r: .12, shake: 12 });
  futureCaption(S.ctx, S.t, 38, 40, '9,999,999,998', 'the one where you’re happy.');
});

// ------------------------------------------------------------- 40 - 46  the iris
// small pictures of other lives, one for each branching point of the web
function lifeTile(i) {
  return cached('tile' + i, () => {
    const c = CV(150, 100), x = C2D(c), R = rng(900 + i * 13);
    const pal = [['#121a55', '#7a4f9c', '#ffd2a8'], ['#1b4c8c', '#8cc4f0', '#fff0c8'], ['#5a2a62', '#f08a76', '#ffe39a'], ['#063a50', '#2fb2a8', '#c8fff0'], ['#241648', '#c0588a', '#ffc0d0'], ['#2c5a5e', '#a8d88c', '#fff6b4'], ['#0a0f30', '#27407e', '#cfe4ff'], ['#7a3a4a', '#ffb25e', '#fff0b0']][i % 8];
    rect(x, 0, 0, 150, 100, linGrad(x, 0, 0, 0, 100, [[0, pal[0]], [1, pal[1]]]));
    const sx = R.range(24, 126), sy = R.range(18, 46), sr = R.range(7, 19);
    glow(x, sx, sy, sr * 2.6, pal[2], .75); dot(x, sx, sy, sr, pal[2]);
    if (i % 4 === 1) { x.strokeStyle = pal[2]; x.lineWidth = 2; x.beginPath(); x.ellipse(sx, sy, sr * 1.9, sr * .42, -.3, 0, TAU); x.stroke(); }
    x.fillStyle = rgba('#0e0a28', .9);
    const hy = R.range(66, 82);
    x.beginPath(); x.moveTo(0, 100); x.lineTo(0, hy + R.range(-12, 8));
    for (let k = 1; k <= 5; k++) x.lineTo(k * 30, hy + (i % 3 === 0 ? R.range(-24, 8) : R.range(-6, 6)));
    x.lineTo(150, 100); x.fill();
    const fx = R.range(34, 112), k = R.range(.8, 1.2);
    x.save(); x.translate(fx, hy + 3); x.scale(k, k);
    x.beginPath(); x.arc(0, -29, 6, 0, TAU); x.fill(); bobPath(x, 0, -29, 6);
    capsule(x, [[0, -23], [0, -9]], 8, 8); capsule(x, [[-2, -9], [-5, 3]], 4, 3); capsule(x, [[2, -9], [5, 3]], 4, 3);
    capsule(x, [[0, -21], [R.range(-15, -7), R.range(-30, -10)]], 3.6, 2.4); capsule(x, [[0, -21], [R.range(7, 15), R.range(-30, -10)]], 3.6, 2.4);
    if (i % 5 === 2) { x.beginPath(); x.arc(18, -2, 5, 0, TAU); x.fill(); capsule(x, [[18, 1], [18, 5]], 6, 5); }
    x.restore();
    dot(x, fx + 5 * k, hy - 16 * k, 2.4, '#9dffd9');
    x.strokeStyle = 'rgba(255,246,220,0.9)'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, 147, 97);
    return c;
  });
}
// the nine lives we just saw, shrunk to postcards. Built once from a fixed
// moment of each scene, so the result never depends on playback order.
const VIGNETTES = [futureMoon, futureMural, futureSail, futureSong, futureOld, lifeSummit, lifeLanterns, lifeTeaching, lifeSnow];
function vignetteTile(k) {
  return cached('vtile' + k, () => {
    const full = CV(W, H), fx = C2D(full), gl = CV(W / 2, H / 2), gx = C2D(gl);
    gx.setTransform(.5, 0, 0, .5, 0, 0);
    const u = k < 5 ? 1.15 : .3;
    VIGNETTES[k]({ ctx: fx, g: gx, t: 29.15 + k, u, P: defaultPost() }, u);
    const c = CV(192, 108), x = C2D(c);
    x.drawImage(full, 0, 0, 192, 108);
    x.strokeStyle = 'rgba(255,246,220,0.95)'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, 189, 105);
    return c;
  });
}
const REVEAL_FOCUS = (() => {            // a real branching point, upper left
  let best = 0, bd = 1e9;
  const tx = Math.cos(-2.45) * IR * .7, ty = Math.sin(-2.45) * IR * .7;
  WEB.nodes.forEach((n, i) => { const d = (n.x - tx) ** 2 + (n.y - ty) ** 2; if (d < bd) { bd = d; best = i; } });
  return WEB.nodes[best];
})();
function revealCamera(t) {
  // still travelling into the last half second, then it stops dead on the hit
  const zA = Math.log(15), p = inv(39.9, 45.0, t);
  const lz = zA * (1 - Math.pow(p, 1.32));
  const Z = Math.exp(lz);
  const fk = smooth(Math.log(1.05), Math.log(3.6), lz);
  return { Z, lz, c: [REVEAL_FOCUS.x * fk, REVEAL_FOCUS.y * fk] };
}
flashAt(45.0, .09, .45, '#fff4e0', .13);
shot('reveal', 40, 46, S => {
  const { ctx, g, t, u, P } = S;
  const { Z, lz, c } = revealCamera(t);
  const breathe = 1 + .02 * E.inOutSine(inv(44.8, 46, t));
  const s = MATCH.s * Z * breathe;
  const irisX = MATCH.x + 6 * MATCH.s, irisY = MATCH.y - 8 * MATCH.s;
  const ox = irisX - s * (6 + c[0]), oy = irisY - s * (-8 + c[1]);       // where drawECU must sit
  const toS = n => [irisX + s * (n.x - c[0]), irisY + s * (n.y - c[1])];
  const eyeA = 1 - smooth(Math.log(1.18), Math.log(2.7), lz);
  const webA = smooth(Math.log(1.0), Math.log(1.9), lz);
  drawNebula(ctx, 'futures', -c[0] * .25, -c[1] * .25, 1.04 + .09 * lz, lz * .09);
  if (eyeA > .003) {
    ctx.save(); ctx.globalAlpha = eyeA;
    drawECU(ctx, t, { x: ox, y: oy, s, lid: 0, ma: smooth(.55, 1, eyeA) * .9, still: true, gaze: [0, 0], drops: Z < 1.6, webA: 1 + .25 * Math.exp(-Math.max(0, t - 45) * 2) });
    ctx.restore();
  }
  if (webA > .003) {
    const vis = n => { const p = toS(n); return p[0] > -200 && p[0] < W + 200 && p[1] > -200 && p[1] < H + 200; };
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const lwk = clamp(Math.pow(Z, .45), 1, 3.4);
    for (const [set, al, lw] of [[WEB.edges, .8, 1.7], [WEB.links, .36, 1]]) {
      for (const [lo, hi, col] of [[0, .52, '#ffd58a'], [.52, .72, '#c9e8c0'], [.72, 2, '#8fd8ff']]) {
        const path = new Path2D();
        for (const e of set) {
          const a = WEB.nodes[e.a], b = WEB.nodes[e.b], q = b.r / IR;
          if (q < lo || q >= hi || !(vis(a) || vis(b))) continue;
          const A = toS(a), B = toS(b);
          path.moveTo(A[0], A[1]); path.quadraticCurveTo((A[0] + B[0]) / 2 - (B[1] - A[1]) * e.bend, (A[1] + B[1]) / 2 + (B[0] - A[0]) * e.bend, B[0], B[1]);
        }
        ctx.strokeStyle = rgba(col, al * webA * .22); ctx.lineWidth = lw * lwk * 4.4; ctx.stroke(path);
        ctx.strokeStyle = rgba(col, al * webA); ctx.lineWidth = lw * lwk; ctx.stroke(path);
      }
    }
    // dust of smaller lives strung along the filaments
    const R = rng(7007);
    for (let i = 0; i < WEB.edges.length; i++) {
      const e = WEB.edges[i], a = WEB.nodes[e.a], b = WEB.nodes[e.b];
      for (let k = 0; k < 4; k++) {
        const q = R(), jx = R.gauss() * 3.4, jy = R.gauss() * 3.4;
        const p = toS({ x: lerp(a.x, b.x, q) + jx, y: lerp(a.y, b.y, q) + jy });
        if (p[0] < -4 || p[0] > W + 4 || p[1] < -4 || p[1] > H + 4) continue;
        const tw = .6 + .4 * Math.sin(t * 5 + i * 1.7 + k * 2);
        dot(ctx, p[0], p[1], clamp(.55 * Math.pow(s, .5), .8, 2.8), rgba(k % 2 ? '#fff0cc' : '#bfeaff', .72 * tw * webA));
      }
    }
    ctx.restore();
    // each branching point is one of her lives
    const th = 15.5 * s * .78;
    for (let i = 0; i < WEB.nodes.length; i++) {
      const n = WEB.nodes[i];
      if (!vis(n)) continue;
      const p = toS(n), wd = th * (.62 + n.ph * .8);
      const asTile = smooth(15, 34, wd);
      if (asTile > .01) {
        ctx.save(); ctx.globalAlpha = asTile * webA; ctx.translate(p[0], p[1]); ctx.rotate((n.ph - .5) * .24);
        const real = (i * 7) % 5 < 2;
        const tile = real ? vignetteTile((i * 5) % 9) : lifeTile(i % 40);
        const th2 = real ? wd * 9 / 16 : wd * 2 / 3;
        ctx.drawImage(tile, -wd / 2, -th2 / 2, wd, th2);
        ctx.restore();
      }
      if (asTile < .99) {
        const a = (1 - asTile) * webA;
        dot(ctx, p[0], p[1], 2 + n.ph * 2.4, rgba(n.r < IR * .55 ? '#fff2cc' : '#d4fbff', a));
        if (i % 6 === 0) glow(g, p[0], p[1], 16 + n.ph * 16, n.r < IR * .55 ? '#ffd58a' : '#8fe8ff', .8 * a);
      }
    }
  }
  P.bloom = lerp(.45, .7, webA); P.thresh = .78;
  P.radial = .05 * smooth(.2, 1.4, lz) * smooth(0, .3, u);
  P.ca = 1.1 + 3.5 * Math.exp(-Math.abs(t - 45) * 6);
  const [sx, sy] = shake(t, 45.0, 20, 5.5); P.shake = [sx, sy];
  cutHit(S, 40.0, { z: .08, r: .2, shake: 18 });
  if (t >= 45) {
    const k = t - 45;
    lensFlare(ctx, irisX + s * -112, irisY + s * -94, .34 * Math.exp(-k * 2.6));
  }
  rect(ctx, 0, 830, W, 250, linGrad(ctx, 0, 830, 0, 1080, [[0, 'rgba(5,6,28,0)'], [1, `rgba(5,6,28,${.8 * env(t, 40.5, 46.2, .4, .2)})`]]));
  narrate(ctx, 'ten billion lives.', 960, 946, t, 41.0, 43.35, { size: 62 });
  narrate(ctx, 'ten billion ways to finish her sentence.', 960, 950, t, 43.75, 46.0, { size: 56, color: '#fff2cc', outDur: .12 });
});
