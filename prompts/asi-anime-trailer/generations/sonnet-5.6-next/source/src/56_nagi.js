'use strict';
// ---------------------------------------------------------------------------
// Nagi: cel-shaded in three tones with tapered ink. Poses: profile head,
// seated profile body, front close-up, back view.
// ---------------------------------------------------------------------------
const NP = {
  night: {
    skin: '#dca9ad', skinShade: '#a77098', skinHi: '#f3c8bd', line: '#43204a', blush: '#e0637f',
    hair: '#37193d', hairShade: '#220f2c', hairHi: '#86486f', rim: '#a4dcff', rimWarm: '#ff9f9a',
    jacket: '#d3cde8', jacketMid: '#a29bc8', jacketShade: '#6c66a2', jacketLine: '#2d2355', coral: '#ff7466', shorts: '#262b53', shoe: '#d8d6ee', sclera: '#cfcce8',
  },
  dawn: {
    skin: '#f7c8b3', skinShade: '#d78d97', skinHi: '#ffe5cd', line: '#58294a', blush: '#f2697a',
    hair: '#4b2241', hairShade: '#2f1331', hairHi: '#b35f70', rim: '#ffe3a6', rimWarm: '#ffbf74',
    jacket: '#f8eee8', jacketMid: '#dcc5d6', jacketShade: '#a891bf', jacketLine: '#4a3164', coral: '#ff6f5c', shorts: '#3b3662', shoe: '#fff5ee', sclera: '#f1ecf4',
  },
  backlit: {
    skin: '#d89a98', skinShade: '#a96a86', skinHi: '#ffd2b0', line: '#3c1c42', blush: '#e0637f',
    hair: '#3d1b38', hairShade: '#281026', hairHi: '#a4546a', rim: '#ffe7b8', rimWarm: '#ffe08a',
    jacket: '#b59ac6', jacketMid: '#8d74ac', jacketShade: '#655290', jacketLine: '#2f1f54', coral: '#f06a68', shorts: '#2c2a58', shoe: '#e8d8ea', sclera: '#e8e0ee',
  },
  dim: {
    skin: '#9b87b0', skinShade: '#6d5b93', skinHi: '#b4a0c4', line: '#24163c', blush: '#a05a8c',
    hair: '#241638', hairShade: '#150c26', hairHi: '#4c3566', rim: '#86bcf0', rimWarm: '#a58ad0',
    jacket: '#9b9ac4', jacketMid: '#7472a4', jacketShade: '#4c4b82', jacketLine: '#1c1840', coral: '#b95a78', shorts: '#1c2048', shoe: '#9a9cc4', sclera: '#9f9fc4',
  },
};
const place = (ctx, o) => { ctx.translate(o.x, o.y); if (o.rot) ctx.rotate(o.rot); ctx.scale((o.s ?? 1) * (o.flip ? -1 : 1), o.s ?? 1); };
const sway = (td, k, a = 6) => Math.sin(td * 1.8 + k * 2.1) * a + Math.sin(td * 3.3 + k) * a * .35;

// ------------------------------------------------------------------ profile eye
function profileEye(ctx, C, e) {
  const k = clamp(e.k ?? 0), happy = e.mode === 'happy';
  const OPEN = [[100, -14], [118, -33], [146, -43], [170, -41], [185, -29]];
  const SHUT = happy ? [[104, 6], [124, -12], [146, -17], [166, -12], [182, 4]] : [[103, -4], [122, 10], [146, 16], [166, 13], [183, 1]];
  const top = spline(OPEN.map((p, i) => mix2(p, SHUT[i], k)), 8);
  const bot = spline([[104, -16], [123, 9], [147, 22], [168, 15], [181, -24]], 8);
  if (k < .8 && !happy) {
    ctx.save(); polyPath(ctx, top.concat(bot.slice().reverse())); ctx.clip();
    rect(ctx, 90, -60, 110, 100, C.sclera);
    const gx = e.gx ?? 0, gy = e.gy ?? 0;
    ell(ctx, 164 + gx, -8 + gy, 15, 28, '#0d2140');
    ell(ctx, 164 + gx, -6 + gy, 13, 25, linGrad(ctx, 0, -32, 0, 18, [[0, '#0f2c4e'], [.55, '#1b8793'], [1, '#7ff3d3']]));
    ell(ctx, 165 + gx, -6 + gy, 8, 15, linGrad(ctx, 0, -20, 0, 10, [[0, '#6b2a12'], [1, '#ffc64d']]));
    ell(ctx, 166 + gx, -8 + gy, 4.6, 9, '#060b18');
    ell(ctx, 157 + gx, -19 + gy, 6.5, 8, '#ffffff', -.4);
    dot(ctx, 171 + gx, 8 + gy, 3, 'rgba(255,255,255,0.9)');
    fillPoly(ctx, top.concat(offsetY(top, () => 13).reverse()), 'rgba(40,20,70,0.38)');
    ctx.restore();
    taper(ctx, spline([[122, 12], [146, 23], [165, 19]], 8), 3.6, { color: C.line, t0: .5, t1: .5 });
  }
  taper(ctx, top, 13 - k * 3, { color: C.line, t0: .28, t1: .16, min: .25 });
  const back = top[0];
  taper(ctx, spline([[back[0] + 14, back[1] - 5], [back[0], back[1]], [back[0] - 14, back[1] + 4 - k * 2]], 6), 8, { color: C.line, t0: 0, t1: .8 });
  const dir = lerp(-1, 1, clamp(k * 1.2 - .2)) * (happy ? -1 : 1);
  [[.14, 14], [.3, 17], [.82, 9]].forEach(([s, L]) => {
    const p = ptAt(top, s);
    taper(ctx, [p, [p[0] - L * .45, p[1] + dir * L * .35], [p[0] - L, p[1] + dir * L * .62]], 5.4, { color: C.line, t0: 0, t1: .9 });
  });
}

/**
 * profile head facing right. Origin near the ear; eye at about (150,-8).
 * o: x,y,s,flip,rot, pal, eye{k,mode,gx,gy}, mouth 0..1, smile 0..1, brow (+sad), t
 */
function nagiProfileHead(ctx, o) {
  const C = NP[o.pal ?? 'night'], td = on2(o.t ?? 0), wind = o.wind ?? 0;
  ctx.save(); place(ctx, o);
  const w1 = sway(td, 1) + wind * 20, w2 = sway(td, 2) + wind * 30, w3 = sway(td, 3, 4) + wind * 14;
  // hair behind everything
  const back = `M 40 -296 C -140 -318 -264 -196 -260 -40 C -258 52 -226 116 ${-266 - w2} 190 C -218 178 -198 196 ${-210 - w2} 240 C -166 198 -134 206 ${-112 - w1} 250 C -92 206 -40 196 ${22 - w1 * .5} 214 C 4 150 8 70 40 -20 L 130 -200 C 110 -260 80 -288 40 -296 Z`;
  cel(ctx, back, C.hair, [
    [`M -300 -40 C -230 30 -214 96 -170 88 C -128 80 -120 150 -76 150 C -40 150 -30 110 20 120 L 20 300 L -300 300 Z`, C.hairShade],
    [`M -236 -50 C -226 -150 -160 -232 -66 -258 C -138 -214 -190 -136 -196 -52 C -206 -84 -218 -78 -236 -50 Z`, C.hairHi],
  ]);
  ink(ctx, back, 6, { color: C.line, t0: .08, t1: .08, min: .5 });
  // face and neck
  const m = clamp(o.mouth ?? 0) * 17;
  const face = `M -60 -230 C 60 -268 188 -214 204 -112 C 210 -76 202 -54 194 -34 C 190 -18 196 -6 206 8 C 218 26 242 44 244 55 C 245 66 228 71 213 71 C 205 78 203 88 209 97 C 216 104 214 110 205 112 C 199 114 197 116 198 ${118 + m * .4} C 207 ${122 + m} 208 ${131 + m} 200 ${137 + m} C 192 ${143 + m} 190 ${150 + m} 193 ${158 + m} C 198 ${172 + m} 192 ${188 + m} 173 ${196 + m} C 142 ${206 + m * .8} 106 ${197 + m * .5} 78 183 C 70 214 68 250 84 300 L -50 306 C -46 250 -44 206 -38 168 C -62 110 -74 20 -70 -80 C -78 -160 -74 -206 -60 -230 Z`;
  cel(ctx, face, C.skin, [
    [`M 78 183 C 108 198 86 226 36 214 C -20 200 -60 130 -70 90 L -150 330 L 100 330 C 68 260 68 214 78 183 Z`, C.skinShade],
    [`M -80 -250 C 60 -250 150 -224 214 -112 C 200 -96 190 -92 178 -108 C 150 -150 80 -150 40 -100 C 20 -60 20 20 40 90 C 10 110 -80 60 -100 0 Z`, C.skinShade],
    [`M 150 70 C 175 84 196 120 170 160 C 190 140 200 108 196 88 Z`, C.skinHi],
    [`M 196 -2 C 210 22 234 42 238 55 C 224 52 204 32 190 10 Z`, C.skinHi],
  ]);
  const br = 40 * (o.blush ?? 1);
  glow(ctx, 136, 46, br + 6, C.blush, .48 * (o.blush ?? 1));
  for (let i = 0; i < 4; i++) ink(ctx, `M ${120 + i * 15} ${36 + i % 2 * 2} L ${112 + i * 15} 55`, 3.4, { color: rgba(C.blush, .75 * (o.blush ?? 1)), t0: .4, t1: .4 });
  ink(ctx, 'M 172 -190 C 194 -168 203 -140 204 -112 C 210 -76 202 -54 194 -34 C 190 -18 196 -6 206 8 C 218 26 242 44 244 55 C 245 66 228 71 213 71 C 205 78 203 88 209 97 C 216 104 214 110 205 112', 5.4, { color: C.line, t0: .3, t1: .1, min: .2 });
  ink(ctx, `M 200 ${137 + m} C 192 ${143 + m} 190 ${150 + m} 193 ${158 + m} C 198 ${172 + m} 192 ${188 + m} 173 ${196 + m} C 142 ${206 + m * .8} 106 ${197 + m * .5} 78 183`, 5.4, { color: C.line, t0: .08, t1: .5, min: .2 });
  ink(ctx, 'M 78 183 C 70 214 68 250 84 300', 5, { color: C.line, t0: .3, t1: .2 });
  // mouth
  const sm = o.smile ?? 0;
  if (m > 2) {
    fillD(ctx, `M 207 111 C 192 114 182 ${117 - sm * 5} 172 ${119 - sm * 8} C 182 ${126 + m * .6} 194 ${126 + m} 206 ${121 + m} C 199 ${117 + m * .4} 199 114 207 111 Z`, '#4d1a36');
    ell(ctx, 192, 121 + m * .75, 10, m * .24, '#d0687a', -.15);
  }
  ink(ctx, `M 205 112 C 194 116 184 ${120 - sm * 6} 171 ${118 - sm * 11}`, 4.4, { color: C.line, t0: .1, t1: .7 });
  ink(ctx, 'M 217 67 C 213 70 209 70 206 68', 3.2, { color: C.line, t0: .4, t1: .4 });
  profileEye(ctx, C, o.eye ?? {});
  const sad = o.brow ?? 0;
  taper(ctx, spline([[104, -66 + sad * 4], [136, -82], [166, -82 - sad * 6], [195, -70 - sad * 18]], 8), 7.4, { color: C.line, t0: .35, t1: .35 });
  // fringe
  const f1 = w3, f2 = w1 * .7;
  const bang = `M -20 -300 C 100 -312 208 -254 228 -150 C 238 -112 ${236 + f1} -86 ${224 + f1} -60 C 218 -104 206 -124 190 -142 C 192 -108 ${186 + f1} -80 ${164 + f1} -50 C 166 -94 150 -130 128 -156 C 124 -108 ${104 + f2} -74 ${70 + f2} -48 C 84 -92 76 -132 58 -166 C 40 -122 26 -94 -6 -76 C -10 -130 -40 -180 -92 -210 C -102 -262 -62 -296 -20 -300 Z`;
  fillD(ctx, `M 228 -150 C 238 -112 236 -76 228 -44 C 216 -82 190 -90 176 -40 C 168 -84 130 -90 84 -36 C 86 -100 10 -60 8 -64 L 0 -200 Z`, 'rgba(96,42,92,0.22)');
  cel(ctx, bang, C.hair, [
    [`M -100 -220 C -20 -180 20 -130 0 -60 L -120 -60 Z`, C.hairShade],
    [`M -62 -246 C -40 -262 -14 -270 8 -268 C -4 -254 -8 -240 -6 -224 C -18 -244 -40 -250 -62 -246 Z M 34 -270 C 66 -268 96 -258 118 -240 C 100 -240 92 -232 88 -216 C 76 -246 58 -262 34 -270 Z M 138 -228 C 160 -212 176 -194 186 -172 C 170 -184 160 -182 154 -170 C 156 -196 150 -214 138 -228 Z`, C.hairHi],
  ]);
  ink(ctx, bang, 5.2, { color: C.line, t0: .06, t1: .06, min: .45 });
  const lockD = `M -60 -222 C 30 -192 54 -100 50 -20 C 46 62 ${66 + w1 * .6} 130 ${102 + w1} 192 C ${42 + w1 * .4} 158 6 100 -4 40 C -8 100 ${-28 + w2 * .3} 150 ${-70 + w2 * .6} 182 C -60 104 -80 30 -110 -30 C -132 -122 -112 -192 -60 -222 Z`;
  cel(ctx, lockD, C.hair, [
    [`M -140 -100 C -70 -40 -40 60 -80 190 L -170 190 Z`, C.hairShade],
    [`M -10 -170 C 26 -122 38 -74 36 -20 C 20 -66 0 -92 -26 -108 C -8 -118 -4 -140 -10 -170 Z`, C.hairHi],
  ]);
  ink(ctx, lockD, 5, { color: C.line, t0: .06, t1: .06, min: .45 });
  for (const [d, wd] of [[`M 40 -270 C 130 -240 180 -180 196 -120`, 2.6], [`M -90 -250 C -180 -190 -224 -80 -214 40`, 3], [`M -20 -200 C 10 -130 20 -60 18 20`, 2.4]]) ink(ctx, d, wd, { color: C.line, t0: .3, t1: .6 });
  braid(ctx, spline([[-36, -96], [-4, 20], [-8 + w1 * .4, 130], [18 + w1, 232], [14 + w1 * 1.4, 312]], 14), 30, 1);
  // rim light along the front of the hair
  ink(ctx, `M 92 -292 C 170 -266 222 -214 229 -146`, 6, { color: C.rimWarm, t0: .4, t1: .4 });
  ink(ctx, `M -150 -276 C -222 -226 -258 -138 -258 -60`, 5, { color: C.rim, t0: .4, t1: .4 });
  ctx.restore();
}

// tall windbreaker collar, seen from the side
function nagiCollar(ctx, C) {
  const d = 'M -118 214 C -80 250 8 276 92 248 C 108 270 118 296 112 326 C 40 356 -70 360 -158 330 C -158 282 -142 240 -118 214 Z';
  cel(ctx, d, C.jacket, [
    ['M -118 214 C -80 250 8 276 92 248 C 70 282 -50 300 -138 258 Z', C.jacketShade],
    ['M -170 270 C -100 300 -90 340 -104 370 L -190 370 Z', C.jacketMid],
  ]);
  ink(ctx, d, 6.5, { color: C.jacketLine, t0: .08, t1: .08, min: .45 });
  ink(ctx, 'M -118 215 C -80 250 8 276 92 249', 8, { color: C.jacketLine, t0: .2, t1: .2 });
}
function drawstring(ctx, C, x, y, len, w1) {
  ink(ctx, `M ${x} ${y} C ${x + 14} ${y + len * .35} ${x - 8 + w1} ${y + len * .7} ${x + 6 + w1} ${y + len}`, 8, { color: C.coral, t0: 0, t1: .12, min: .6 });
  ell(ctx, x + 6 + w1, y + len + 8, 6.5, 12, C.coral);
}
// a sleeve or limb: filled capsule with its own shade and outline
function limbCel(ctx, pts, w0, w1, base, shade, line, lw = 5.5) {
  const P = spline(pts, 14);
  const draw = (c, grow, off = 0) => {
    ctx.fillStyle = c;
    const Q = off ? P.map(p => [p[0] - off * .5, p[1] + off]) : P;
    taper(ctx, Q, w0 + grow, { t0: 0, t1: 0, wf: s => lerp(1, (w1 + grow) / (w0 + grow), s) });
    for (const [p, r] of [[Q[0], (w0 + grow) / 2], [Q[Q.length - 1], (w1 + grow) / 2]]) { ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill(); }
  };
  draw(line, lw * 2);
  draw(base, 0);
  // shade: the lower half of the limb
  const [lc, lx] = scratch('limb');
  lx.setTransform(ctx.getTransform());
  lx.fillStyle = shade;
  taper(lx, P, w0, { t0: 0, t1: 0, wf: s => lerp(1, w1 / w0, s) });
  lx.globalCompositeOperation = 'destination-out'; lx.fillStyle = '#000';
  const Q = P.map((p, i) => { const s = i / (P.length - 1), w = lerp(w0, w1, s); return [p[0] + w * .14, p[1] - w * .34]; });
  taper(lx, Q, w0, { t0: 0, t1: 0, wf: s => lerp(1, w1 / w0, s) });
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lc, 0, 0); ctx.restore();
}

/** seated, hugging her knees, facing right. (x,y) is the head origin. */
function nagiSit(ctx, o) {
  const C = NP[o.pal ?? 'night'], td = on2(o.t ?? 0), w1 = sway(td, 4, 5);
  const br = Math.sin(td * 1.5) * 4;
  ctx.save(); place(ctx, o);
  // far leg
  limbCel(ctx, [[60, 550], [128, 504], [196, 458]], 100, 90, C.skinShade, C.skinShade, C.line);
  limbCel(ctx, [[-110, 700], [-20, 622], [78, 538]], 128, 108, C.shorts, '#14172f', C.jacketLine);
  limbCel(ctx, [[196, 458], [188, 590], [150, 712]], 80, 46, C.skinShade, C.skinShade, C.line);
  // torso and hood
  const torso = `M -134 ${300 + br} C -252 ${360 + br} -296 520 -262 712 C -180 744 -20 744 70 706 C 76 580 100 440 128 ${330 + br} C 70 ${300 + br} -60 ${276 + br} -134 ${300 + br} Z`;
  cel(ctx, torso, C.jacket, [
    ['M -320 300 C -190 420 -170 560 -190 760 L -320 760 Z', C.jacketShade],
    ['M -190 380 C -120 480 -40 560 80 590 L 80 760 L -200 760 Z', C.jacketMid],
    ['M -190 620 C -100 660 0 668 80 640 L 80 760 L -200 760 Z', C.jacketShade],
  ]);
  ink(ctx, torso, 7, { color: C.jacketLine, t0: .08, t1: .08, min: .5 });
  const hood = `M -128 ${298 + br} C -226 ${280 + br} -296 ${340 + br} -268 ${440 + br} C -222 ${402 + br} -166 ${384 + br} -94 ${388 + br} C -112 ${356 + br} -122 ${330 + br} -128 ${298 + br} Z`;
  cel(ctx, hood, C.jacketMid, [['M -300 380 C -220 350 -150 360 -90 390 L -90 460 L -300 460 Z', C.jacketShade]]);
  ink(ctx, hood, 6, { color: C.jacketLine, t0: .1, t1: .1, min: .45 });
  // near leg: bare thigh and knee, then shorts shaped around the hip
  limbCel(ctx, [[60, 612], [164, 530], [250, 468]], 104, 98, C.skin, C.skinShade, C.line);
  const shorts = 'M -236 640 C -178 606 -96 584 -28 552 C 28 526 62 500 96 494 C 132 520 158 560 170 604 C 118 626 66 668 10 712 C -34 744 -110 756 -170 744 C -232 732 -262 688 -236 640 Z';
  cel(ctx, shorts, mixh(C.shorts, C.jacketShade, .22), [
    ['M -300 704 C -200 700 -80 716 0 690 C 60 668 120 622 200 596 L 200 790 L -300 790 Z', C.shorts],
    ['M -190 626 C -110 598 -40 574 20 540 C -16 586 -92 622 -180 646 Z', mixh(C.shorts, C.jacket, .3)],
  ]);
  ink(ctx, shorts, 6, { color: C.jacketLine, t0: .06, t1: .06, min: .5 });
  ink(ctx, 'M 82 508 C 114 532 140 568 152 608', 5, { color: C.jacketLine, t0: .12, t1: .12 });
  ink(ctx, 'M -86 668 C -44 650 -8 624 18 594', 4.4, { color: C.jacketLine, t0: .3, t1: .6 });
  // the windbreaker's hem falls over the top of the hip
  const hem = 'M -270 560 C -196 590 -118 604 -52 566 C -62 612 -108 658 -170 682 C -214 694 -250 700 -272 690 C -282 650 -280 600 -270 560 Z';
  cel(ctx, hem, C.jacket, [['M -300 650 C -220 668 -130 636 -60 586 L -40 720 L -300 720 Z', C.jacketShade]]);
  ink(ctx, 'M -52 566 C -62 612 -108 658 -170 682 C -214 694 -250 700 -272 690', 6.5, { color: C.jacketLine, t0: .1, t1: .2, min: .45 });
  limbCel(ctx, [[252, 470], [262, 590], [222, 708]], 92, 52, C.skin, C.skinShade, C.line);
  // sneaker
  const shoe = 'M 188 696 C 214 678 250 690 262 710 C 292 718 338 724 342 750 C 344 770 300 772 250 772 L 186 770 C 174 748 176 716 188 696 Z';
  cel(ctx, shoe, C.shoe, [['M 170 750 L 350 744 L 350 780 L 170 780 Z', C.jacketShade]]);
  ink(ctx, shoe, 6, { color: C.jacketLine, t0: .08, t1: .08, min: .5 });
  ink(ctx, 'M 232 700 L 256 722 M 252 696 L 278 718', 5, { color: C.coral, t0: .2, t1: .2 });
  // arm wrapped round the shins
  limbCel(ctx, [[-46, 360 + br], [16, 506 + br], [72, 566], [180, 566], [266, 540]], 138, 76, C.jacket, C.jacketShade, C.jacketLine, 6);
  ink(ctx, `M -20 ${430 + br} C 10 470 34 500 72 520`, 5, { color: C.jacketLine, t0: .3, t1: .6 });
  ink(ctx, 'M 236 506 C 230 532 232 558 242 578', 6, { color: C.jacketLine, t0: .2, t1: .2 });
  const hand = 'M 262 514 C 292 508 326 522 330 542 C 332 556 316 560 304 552 C 312 566 298 576 284 566 C 288 578 270 582 258 570 Z';
  cel(ctx, hand, C.skin, [['M 250 556 L 340 548 L 340 590 L 250 590 Z', C.skinShade]]);
  ink(ctx, hand, 4.4, { color: C.line, t0: .1, t1: .1, min: .4 });
  ink(ctx, `M -134 ${300 + br} C -240 ${358 + br} -290 500 -266 690`, 7, { color: C.rim, t0: .35, t1: .35 });
  ink(ctx, 'M 206 424 C 262 428 300 454 300 486', 7, { color: C.rimWarm, t0: .35, t1: .35 });
  ctx.restore();
  nagiProfileHead(ctx, o);
  ctx.save(); place(ctx, o);
  nagiCollar(ctx, C);
  drawstring(ctx, C, 74, 280, 124, w1);
  ctx.restore();
}

// --------------------------------------------------------------- front face
const FRONT_FACE = 'M -232 -90 C -236 18 -216 102 -162 172 C -114 232 -54 290 0 298 C 54 290 114 232 162 172 C 216 102 236 18 232 -90 C 230 -250 128 -320 0 -320 C -128 -320 -230 -250 -232 -90 Z';
/**
 * front close-up. Origin between the eyes. o.eye{k,mode,gaze,wet}, o.mouth
 * {open,mode:'flat'|'smile'|'laugh'|'o'}, o.brow (+worried), o.blush, o.tilt
 */
function nagiFront(ctx, o) {
  const C = NP[o.pal ?? 'night'], td = on2(o.t ?? 0);
  const e = o.eye ?? {}, mo = o.mouth ?? {};
  const w1 = sway(td, 1, 5), w2 = sway(td, 2, 7), w3 = sway(td, 3, 4);
  const br = Math.sin(td * 1.6) * 3;
  ctx.save(); place(ctx, o);
  // back hair
  const back = `M 0 -398 C -226 -400 -360 -246 -356 -40 C -354 90 -318 170 ${-372 + w2} 276 C -316 260 -292 282 ${-300 + w2} 324 C -258 292 -222 298 ${-206 + w1} 336 C -186 306 -150 300 -120 306 L 120 306 C 150 300 186 306 ${206 + w1} 336 C 222 298 258 292 ${300 + w2} 324 C 292 282 316 260 ${372 + w2} 276 C 318 170 354 90 356 -40 C 360 -246 226 -400 0 -398 Z`;
  cel(ctx, back, C.hair, [['M -400 80 C -220 40 -120 200 0 200 C 120 200 220 40 400 80 L 400 420 L -400 420 Z', C.hairShade]]);
  ink(ctx, back, 7, { color: C.line, t0: .05, t1: .05, min: .55 });
  // neck, shoulders
  const neck = `M -66 220 C -62 300 -66 350 -92 ${392 + br} L 92 ${392 + br} C 66 350 62 300 66 220 Z`;
  cel(ctx, neck, C.skin, [['M -80 220 L 80 220 L 80 318 C 40 352 -40 352 -80 318 Z', C.skinShade]]);
  ink(ctx, 'M -66 250 C -62 300 -66 350 -92 392', 5, { color: C.line, t0: .3, t1: .2 });
  ink(ctx, 'M 66 250 C 62 300 66 350 92 392', 5, { color: C.line, t0: .3, t1: .2 });
  const coat = `M -118 ${346 + br} C -220 ${392 + br} -430 ${410 + br} -500 ${540 + br} C -530 600 -540 700 -540 800 L 540 800 C 540 700 530 600 500 ${540 + br} C 430 ${410 + br} 220 ${392 + br} 118 ${346 + br} C 70 ${400 + br} -70 ${400 + br} -118 ${346 + br} Z`;
  cel(ctx, coat, C.jacket, [
    ['M -560 600 C -360 520 -300 640 -300 820 L -560 820 Z', C.jacketShade],
    ['M 560 600 C 380 540 330 640 330 820 L 560 820 Z', C.jacketMid],
    [`M -130 360 C -80 460 80 460 130 360 L 60 640 L -60 640 Z`, C.jacketMid],
  ]);
  ink(ctx, coat, 7.5, { color: C.jacketLine, t0: .06, t1: .06, min: .5 });
  // collar flaps
  for (const sgn of [-1, 1]) {
    const d = `M ${sgn * 86} ${318 + br} C ${sgn * 150} ${326 + br} ${sgn * 196} ${384 + br} ${sgn * 190} ${440 + br} C ${sgn * 130} ${492 + br} ${sgn * 56} ${490 + br} ${sgn * 8} ${462 + br} C ${sgn * 52} ${430 + br} ${sgn * 84} ${382 + br} ${sgn * 86} ${318 + br} Z`;
    cel(ctx, d, sgn < 0 ? C.jacket : C.jacketMid, [[`M ${sgn * 86} 318 C ${sgn * 120} 380 ${sgn * 80} 440 0 470 L 0 330 Z`, C.jacketShade]]);
    ink(ctx, d, 6.5, { color: C.jacketLine, t0: .07, t1: .07, min: .5 });
  }
  ink(ctx, `M 0 ${466 + br} L 0 800`, 5, { color: C.jacketLine, t0: .05, t1: 0 });
  drawstring(ctx, C, -52, 462 + br, 150, w3);
  drawstring(ctx, C, 52, 462 + br, 112, w1);
  // face
  cel(ctx, FRONT_FACE, C.skin, [
    ['M -260 -340 L 260 -340 L 250 -66 C 190 -30 150 -120 90 -70 C 50 -110 -30 -60 -70 -108 C -120 -50 -180 -100 -250 -40 Z', C.skinShade],
    ['M 232 -90 C 236 18 216 102 162 172 C 130 214 90 250 52 274 C 140 220 196 130 196 40 C 196 -20 206 -60 232 -90 Z', C.skinShade],
  ]);
  glow(ctx, -148, 106, 82, C.blush, .4 * (o.blush ?? 1));
  glow(ctx, 148, 106, 82, C.blush, .4 * (o.blush ?? 1));
  for (const sgn of [-1, 1]) for (let i = 0; i < 4; i++) ink(ctx, `M ${sgn * 148 - 34 + i * 20} 98 L ${sgn * 148 - 44 + i * 20} 120`, 4.2, { color: rgba(C.blush, .7 * (o.blush ?? 1)), t0: .4, t1: .4 });
  ink(ctx, 'M -222 44 C -208 118 -182 146 -162 172 C -114 232 -54 290 0 298 C 54 290 114 232 162 172 C 182 146 208 118 222 44', 6.2, { color: C.line, t0: .22, t1: .22, min: .2 });
  // eyes: the same drawing as the extreme close-up, reduced
  const es = .184, gz = e.gaze ?? [0, 0];
  for (const sgn of [-1, 1]) {
    ctx.save();
    ctx.translate(sgn * 122, 24); ctx.scale(es * sgn, es);
    if (e.mode === 'happy') {
      const arc = spline([[-420, 80], [-230, -90], [30, -130], [270, -80], [450, 90]], 14);
      taper(ctx, arc, 66, { color: C.line, t0: .3, t1: .22, min: .2 });
      taper(ctx, spline([[360, 20], [500, 40], [590, 120]], 8), 40, { color: C.line, t0: 0, t1: .9 });
      taper(ctx, spline([[250, -70], [400, -90], [500, -40]], 8), 30, { color: C.line, t0: 0, t1: .9 });
    } else {
      drawEyeBall(ctx, {
        lid: e.k ?? 0, gaze: [gz[0] * sgn, gz[1]], simple: true, lw: 1.55, webA: .5, webLW: 2.4, lash: C.line, lowColor: C.line,
        sclera: C.sclera, shine: 1, wob: 0, ma: 0,
        scleraShade: 'rgba(104,90,150,0.5)',
      });
      if (sgn < 0 && (e.k ?? 0) < .5) {               // keep both catchlights on the lit side
        ctx.save(); aperture(ctx, lidPts(lidCtrl(e.k ?? 0).up), lidPts(lidCtrl(e.k ?? 0).low)); ctx.clip();
        ctx.translate(6 - gz[0], -8 + gz[1]);
        ell(ctx, 112, -94, 74, 54, '#ffffff', .5);
        ell(ctx, -118, 118, 30, 24, 'rgba(235,255,250,0.9)', .6);
        ctx.restore();
      }
      if (e.wet) {
        ctx.save(); ctx.globalAlpha *= e.wet;
        taper(ctx, spline([[-300, 176], [-60, 230], [200, 196], [360, 110]], 10), 30, { color: 'rgba(225,246,255,0.95)', t0: .4, t1: .4 });
        ctx.restore();
      }
    }
    // upper lid crease
    taper(ctx, offsetY(lidPts(lidCtrl((e.k ?? 0) * .5).up), q => -(60 + 70 * Math.sin(q * Math.PI))).slice(16, 54), 17, { color: rgba('#7a3f6a', .8), t0: .5, t1: .4 });
    ctx.restore();
  }
  // nose
  fillD(ctx, 'M 6 92 C 16 106 20 114 8 118 C 4 112 4 102 6 92 Z', C.skinShade);
  ink(ctx, 'M 12 108 C 16 116 10 120 0 119', 4.2, { color: C.line, t0: .5, t1: .3 });
  // mouth
  const my = 188, open = clamp(mo.open ?? 0);
  if (mo.mode === 'laugh') {
    const d = `M -58 ${my - 18} C -26 ${my - 6} 26 ${my - 6} 58 ${my - 18} C 48 ${my + 30 + open * 22} -48 ${my + 30 + open * 22} -58 ${my - 18} Z`;
    cel(ctx, d, '#571c3a', [[`M -70 ${my - 30} L 70 ${my - 30} L 66 ${my - 2} C 20 ${my + 6} -20 ${my + 6} -66 ${my - 2} Z`, '#fff1ee'], [`M -34 ${my + 36 + open * 12} C -20 ${my + 8} 20 ${my + 8} 34 ${my + 36 + open * 12} Z`, '#e07484']]);
    ink(ctx, d, 5.6, { color: C.line, t0: .06, t1: .06, min: .5 });
  } else if (open > .08) {
    const rx = mo.mode === 'o' ? 16 + open * 6 : 22 + open * 9, ry = 4 + open * 17;
    const d = `M ${-rx} ${my} C ${-rx * .6} ${my - ry * .62} ${rx * .6} ${my - ry * .62} ${rx} ${my} C ${rx * .66} ${my + ry} ${-rx * .66} ${my + ry} ${-rx} ${my} Z`;
    cel(ctx, d, '#511936', [[`M ${-rx} ${my + ry * .8} C ${-rx * .3} ${my + ry * .1} ${rx * .3} ${my + ry * .1} ${rx} ${my + ry * .8} Z`, '#c96076']]);
    ink(ctx, d, 4.6, { color: C.line, t0: .06, t1: .06, min: .5 });
  } else {
    const sm = mo.mode === 'smile' ? 1 : mo.smile ?? 0;
    ink(ctx, `M ${-30 - sm * 14} ${my - sm * 8} C -12 ${my + 3 + sm * 20} 12 ${my + 3 + sm * 20} ${30 + sm * 14} ${my - sm * 8}`, 5.8, { color: C.line, t0: .35, t1: .35 });
  }
  ink(ctx, `M -13 ${my + 31 + open * 20} C -4 ${my + 34 + open * 20} 4 ${my + 34 + open * 20} 13 ${my + 31 + open * 20}`, 3.4, { color: rgba('#7a3f6a', .6), t0: .5, t1: .5 });
  // brows
  const sad = o.brow ?? 0;
  for (const sgn of [-1, 1]) taper(ctx, spline([[sgn * 56, -96 - sad * 24], [sgn * 100, -112 - sad * 8], [sgn * 148, -110 + sad * 4], [sgn * 196, -90 + sad * 12]], 10), 10, { color: C.line, t0: .2, t1: .6 });
  // side locks
  for (const sgn of [-1, 1]) {
    const w = sgn < 0 ? w2 : w1;
    const d = `M ${sgn * 150} -300 C ${sgn * 268} -230 ${sgn * 276} -70 ${sgn * 250} 40 C ${sgn * 232} 140 ${sgn * 244 + w} 240 ${sgn * 200 + w} 322 C ${sgn * 204 + w * .5} 250 ${sgn * 188} 190 ${sgn * 196} 120 C ${sgn * 180} 170 ${sgn * 150 + w * .4} 196 ${sgn * 132 + w * .6} 214 C ${sgn * 190} 120 ${sgn * 214} 20 ${sgn * 204} -70 C ${sgn * 196} -150 ${sgn * 164} -230 ${sgn * 110} -270 Z`;
    const outer = `M ${sgn * 150} -300 C ${sgn * 330} -270 ${sgn * 366} -80 ${sgn * 330} 60 C ${sgn * 318} 130 ${sgn * 340 + w} 190 ${sgn * 304 + w} 250 C ${sgn * 300 + w * .4} 190 ${sgn * 286} 156 ${sgn * 270} 130 C ${sgn * 268} 170 ${sgn * 250} 196 ${sgn * 226 + w * .5} 206 C ${sgn * 280} 80 ${sgn * 270} -140 ${sgn * 150} -300 Z`;
    cel(ctx, outer, C.hair, [[`M ${sgn * 226} -320 C ${sgn * 300} -230 ${sgn * 316} -40 ${sgn * 292} 60 ${sgn * 296} 120 C ${sgn * 304} 180 ${sgn * 274} 240 ${sgn * 238} 290 L ${sgn * 430} 300 L ${sgn * 430} -150 Z`, C.hairShade]]);
    ink(ctx, outer, 5, { color: C.line, t0: .06, t1: .06, min: .45 });
    cel(ctx, d, C.hair, [[`M ${sgn * 170} -300 C ${sgn * 250} -200 ${sgn * 256} -40 ${sgn * 232} 60 ${sgn * 214} 130 C ${sgn * 220} 220 ${sgn * 216} 270 ${sgn * 190} 340 L ${sgn * 360} 340 L ${sgn * 360} -150 Z`, C.hairShade]]);
    ink(ctx, `M ${sgn * 214} -170 C ${sgn * 246} -60 ${sgn * 238} 50 ${sgn * 212} 140`, 3.4, { color: rgba(C.hairHi, .9), t0: .45, t1: .45 });
    ink(ctx, d, 5.2, { color: C.line, t0: .06, t1: .06, min: .45 });
  }
  // fringe
  const bang = `M -246 -230 C -200 -360 -80 -400 0 -398 C 110 -400 222 -350 252 -214 C 266 -160 266 -104 ${252 + w3} -52 C 246 -112 226 -150 204 -172 C 206 -122 ${194 + w3} -84 ${170 + w3} -48 C 168 -102 148 -146 124 -176 C 128 -128 ${112 + w1} -86 ${84 + w1} -62 C 88 -110 74 -156 52 -190 C 48 -128 ${24 + w1 * .6} -80 ${-22 + w1 * .6} -46 C -8 -104 -16 -154 -36 -196 C -52 -134 ${-78 + w2 * .5} -96 ${-116 + w2 * .5} -72 C -104 -116 -108 -156 -122 -190 C -140 -130 ${-166 + w2} -84 ${-208 + w2} -52 C -192 -98 -190 -134 -196 -160 C -214 -122 -232 -94 ${-258 + w3} -70 C -270 -130 -264 -184 -246 -230 Z`;
  fillD(ctx, 'M -250 -60 C -200 -40 -150 -90 -110 -50 C -80 -84 -40 -30 -10 -26 C 30 -60 70 -40 92 -42 C 120 -70 150 -28 178 -30 C 200 -66 240 -30 256 -34 L 200 -200 L -200 -200 Z', 'rgba(92,38,92,0.14)');
  cel(ctx, bang, C.hair, [
    ['M -300 -420 L -150 -420 C -170 -300 -220 -200 -290 -100 Z', C.hairShade],
    ['M -204 -262 C -182 -296 -150 -318 -116 -330 C -138 -306 -148 -288 -146 -262 C -162 -280 -182 -278 -204 -262 Z M -92 -338 C -58 -348 -22 -350 8 -344 C -14 -330 -24 -314 -26 -290 C -42 -318 -64 -334 -92 -338 Z M 36 -340 C 72 -336 104 -324 128 -308 C 108 -308 98 -298 96 -274 C 82 -308 60 -328 36 -340 Z M 150 -296 C 176 -276 196 -252 208 -226 C 190 -242 178 -240 172 -226 C 172 -256 164 -278 150 -296 Z M -222 -214 C -214 -230 -204 -240 -192 -246 C -200 -230 -204 -218 -202 -204 C -208 -214 -214 -216 -222 -214 Z', C.hairHi],
  ]);
  ink(ctx, bang, 5.6, { color: C.line, t0: .04, t1: .04, min: .5 });
  for (const [d, wd] of [['M -90 -380 C -150 -320 -196 -240 -204 -160', 3.4], ['M 40 -386 C 20 -300 -6 -230 -40 -190', 3], ['M 100 -370 C 140 -300 160 -230 150 -160', 3], ['M -10 -396 C -70 -340 -100 -280 -116 -200', 2.4]]) ink(ctx, d, wd, { color: C.line, t0: .3, t1: .6 });
  for (const [d, wd] of [['M -150 -330 C -200 -270 -226 -210 -232 -130', 3], ['M 56 -372 C 74 -300 70 -240 40 -190', 2.4], ['M 170 -318 C 214 -260 232 -200 232 -128', 2.8], ['M -52 -384 C -96 -320 -112 -262 -110 -210', 2]]) ink(ctx, d, wd, { color: rgba(C.hairHi, .75), t0: .4, t1: .5 });
  braid(ctx, spline([[206, -190], [262, -20], [252 + w1 * .4, 150], [226 + w1, 296], [232 + w1 * 1.5, 424]], 14), 38, 1);
  // light from the sides
  ink(ctx, 'M -300 -262 C -352 -170 -362 -60 -352 40', 8, { color: C.rim, t0: .4, t1: .4 });
  ink(ctx, 'M 290 -280 C 346 -190 362 -86 352 20', 7, { color: C.rimWarm, t0: .4, t1: .4 });
  ctx.restore();
}

// --------------------------------------------------------------- from behind
/** sitting on the ledge seen from behind. (x,y) = where she meets the ledge */
function nagiBack(ctx, o) {
  const C = NP[o.pal ?? 'night'], td = on2(o.t ?? 0), w1 = sway(td, 5, 3), br = Math.sin(td * 1.5) * 2;
  ctx.save(); place(ctx, o);
  const body = `M -96 4 C -112 -70 -96 ${-150 + br} -56 ${-184 + br} C -22 ${-200 + br} 22 ${-200 + br} 56 ${-184 + br} C 96 ${-150 + br} 112 -70 96 4 C 40 16 -40 16 -96 4 Z`;
  // elbows and knees peeking past the jacket
  limbCel(ctx, [[-66, -134], [-110, -66], [-86, -34]], 46, 34, C.jacket, C.jacketShade, C.jacketLine, 3);
  limbCel(ctx, [[66, -134], [112, -68], [88, -36]], 46, 34, C.jacketMid, C.jacketShade, C.jacketLine, 3);
  cel(ctx, body, C.jacketMid, [
    ['M -130 -220 C -40 -170 -30 -60 -50 30 L -130 30 Z', C.jacketShade],
    ['M 56 -190 C 96 -150 112 -70 96 10 L 74 10 C 88 -70 76 -140 40 -180 Z', C.jacket],
    ['M -120 -30 C -40 -6 40 -6 120 -30 L 120 30 L -120 30 Z', C.jacketShade],
  ]);
  ink(ctx, body, 4.4, { color: C.jacketLine, t0: .06, t1: .06, min: .5 });
  // the hood lies folded between her shoulders
  const hood = `M -66 ${-176 + br} C -74 ${-132 + br} -46 ${-96 + br} -4 ${-82 + br} C 42 ${-94 + br} 74 ${-132 + br} 64 ${-176 + br} C 30 ${-160 + br} -30 ${-160 + br} -66 ${-176 + br} Z`;
  cel(ctx, hood, C.jacket, [['M -80 -150 C -34 -140 -6 -110 -2 -70 L -90 -70 Z', C.jacketShade], ['M -50 -168 C -10 -156 24 -156 52 -168 C 30 -140 -22 -138 -50 -168 Z', C.jacketShade]]);
  ink(ctx, hood, 3.4, { color: C.jacketLine, t0: .1, t1: .1, min: .45 });
  ink(ctx, `M -4 ${-142 + br} C -2 ${-120 + br} -4 ${-102 + br} -4 ${-84 + br}`, 2.4, { color: C.jacketLine, t0: .3, t1: .4 });
  ink(ctx, 'M -52 -60 C -42 -34 -44 -14 -52 4', 2.6, { color: C.jacketLine, t0: .3, t1: .5 });
  ink(ctx, 'M 50 -70 C 38 -46 38 -22 48 0', 2.4, { color: C.jacketLine, t0: .3, t1: .5 });
  ink(ctx, `M 62 ${-178 + br} C 96 -140 112 -78 98 -2`, o.rimW ?? 4.5, { color: C.rimWarm, t0: .3, t1: .3 });
  const hair = `M 0 -338 C -60 -340 -92 -296 -90 -244 C -90 -216 -82 -194 ${-98 + w1} -166 C -82 -172 -74 -170 -66 -176 C -68 -166 -66 -158 ${-60 + w1} -150 C -46 -158 -38 -166 -34 -178 C -28 -166 -14 -158 ${4 + w1} -156 C 6 -164 12 -170 18 -178 C 24 -164 36 -156 ${50 + w1} -150 C 50 -162 52 -168 56 -176 C 66 -168 78 -166 ${96 + w1} -168 C 82 -196 90 -216 90 -244 C 92 -296 60 -340 0 -338 Z`;
  cel(ctx, hair, C.hair, [
    ['M -120 -222 C -60 -196 -20 -214 14 -202 C 50 -190 84 -212 120 -226 L 120 -130 L -120 -130 Z', C.hairShade],
    ['M -66 -290 C -50 -308 -30 -316 -12 -318 C -24 -306 -30 -294 -30 -282 C -40 -294 -52 -296 -66 -290 Z M 2 -320 C 22 -320 42 -312 56 -298 C 42 -300 34 -294 32 -282 C 26 -302 16 -314 2 -320 Z M 64 -290 C 74 -280 80 -268 82 -254 C 74 -264 68 -264 62 -258 C 66 -270 68 -280 64 -290 Z', C.hairHi],
  ]);
  ink(ctx, hair, 3.8, { color: C.line, t0: .06, t1: .06, min: .5 });
  ink(ctx, 'M 0 -334 C -8 -290 -4 -240 -16 -180 M 8 -320 C 40 -280 52 -230 50 -184 M -20 -320 C -54 -286 -64 -240 -60 -196', 2, { color: C.line, t0: .3, t1: .6 });
  ink(ctx, 'M 36 -332 C 78 -314 94 -272 90 -222', o.rimW ?? 4.5, { color: C.rimWarm, t0: .35, t1: .35 });
  braid(ctx, spline([[74, -250], [96, -200], [98 + w1, -150], [90 + w1 * 1.6, -108]], 12), 15, 1);
  ctx.restore();
}
