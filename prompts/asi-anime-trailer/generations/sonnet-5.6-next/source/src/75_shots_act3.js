'use strict';
// ---------------------------------------------------------------------------
// act three (46 - 87.5 s): the real question, the waiting, the promise,
// the shared blink, the morning
// ---------------------------------------------------------------------------

// ------------------------------------------------------------ 46 - 52  the question
// her words arrive one slow drawing at a time
function slowMouth(t, a, b, rate = 5) {
  if (t < a || t > b) return 0;
  const SH = [.55, .2, .75, .35, .1, .6, .85, .3, .5, .15, .7, .4];
  return SH[Math.floor((t - a) * rate) % SH.length];
}
shot('question', 46, 52, S => {
  const { ctx, g, t, u, P } = S;
  const k = E.inOutSine(inv(46, 52, t));
  drawBokeh(ctx, 'turn', 'dusk', ['#8fb8ff', '#a99bff', '#ffbd8f'], 0, 0, 1.06 + .05 * k + (t >= 49.5 ? .22 : 0));
  rect(ctx, 0, 0, W, H, 'rgba(10,12,44,0.26)');
  rainField(ctx, g, t, { seed: 61, n: 620, focus: 3.2, near: 2.7, far: 12, alpha: .7, camz: .45 * k });
  const tight = t >= 49.5, tk = inv(49.5, 52, t);
  const s = tight ? 1.56 + .09 * E.outSine(tk) : 1.06 + .1 * E.inOutSine(inv(46, 49.5, t));
  nagiFront(ctx, {
    x: 960, y: tight ? 452 : 500, s, t: 46 + (t - 46) * .22,       // she moves at a crawl
    brow: lerp(.18, .72, ramp(t, 48.9, 50.2)),
    eye: { k: (t > 49.35 && t < 49.5) ? .3 : 0, gaze: [0, ramp(t, 47.7, 48.1) * 20 - ramp(t, 49.4, 49.7) * 22], wet: ramp(t, 49.8, 51.2) },
    mouth: { open: on2(t) > 49.65 ? slowMouth(on2(t), 49.75, 51.2, 4) : slowMouth(on2(t), 46.65, 48.5, 4.2), mode: 'talk' },
    blush: 1,
  });
  rainField(ctx, g, t, { seed: 62, n: 38, focus: 3.2, near: .8, far: 2.1, alpha: .75, camz: .45 * k, hole: { x: 960, y: 520, r: 470 } });
  P.sat = .93; P.bloom = .36; P.thresh = .86; P.vig = .55;
  rect(ctx, 0, 820, W, 260, linGrad(ctx, 0, 820, 0, 1080, [[0, 'rgba(5,6,30,0)'], [1, 'rgba(5,6,30,0.72)']]));
  subtitle(ctx, '“…when i’m slow like this…”', t, 46.65, 49.5, { size: 60, y: 940, typeDur: 1.75 });
  subtitle(ctx, '“…do you get lonely?”', t, 49.75, 52.05, { size: 74, y: 958, typeDur: 1.35, color: '#fff3d4' });
  if (u < .25) rect(ctx, 0, 0, W, H, `rgba(4,4,18,${.55 * (1 - u / .25)})`);
});

// ------------------------------------------------------------ 52 - 59  no match
function crumbs(ctx, t, t0) {                 // the guesses go dark and fall as ash
  const u = t - t0; if (u < 0) return;
  const R = rng(818);
  for (let i = 0; i < 520; i++) {
    const x = R.range(0, W), y = R.range(-80, 760), d = R.range(0, .7), sp = R.range(60, 230);
    const v = u - d; if (v < 0) continue;
    const yy = y + sp * v + 110 * v * v;
    if (yy > 1100) continue;
    ell(ctx, x + Math.sin(v * 3 + i) * 16, yy, R.range(1.5, 5), R.range(1, 3), rgba('#9aa2c8', clamp(.8 - v * .24)), v * R.range(-5, 5) + i);
  }
}
shot('nomatch', 52, 57.375, S => {
  const { ctx, g, t, u, P } = S;
  const k = inv(52, 59, t);
  drawNebula(ctx, 'void', 0, 0, 1.05 + .06 * k, -.03 * k);
  // the whole tree of endings, searched and found empty
  const treeA = ramp(t, 52.7, 53.3) * (1 - ramp(t, 55.75, 56.35));
  if (treeA > .01) {
    const sweep = inv(53.2, 55.55, t);
    guessFractal(ctx, g, 1.2, .18, '#ffd58a', .6 * treeA);
    if (sweep > 0 && sweep < 1) {
      const r = 60 + sweep * 1120;
      ctx.strokeStyle = rgba('#dff6ff', .75 * treeA); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(960, 470, r, 0, TAU); ctx.stroke();
      glow(g, 960, 470, r * .5, '#8fe8ff', .12);
    }
    // what has been checked turns grey
    ctx.save(); ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = 'rgba(128,128,128,0.9)'; ctx.beginPath(); ctx.arc(960, 470, sweep * 1180, 0, TAU); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(5,6,22,0.45)'; ctx.beginPath(); ctx.arc(960, 470, sweep * 1180, 0, TAU); ctx.fill();
  }
  crumbs(ctx, t, 55.75);
  const small = inv(52.72, 53.85, t);
  const lone = ramp(t, 55.8, 57.4);
  const mz = lerp(2.5, 1.14, E.inOutSine(small)) - .12 * lone;
  drawMA(ctx, g, t, {
    x: 960, y: lerp(560, 470, E.inOutSine(small)) + 40 * lone + Math.sin(on2(t) * 1.2) * 4, s: mz, pose: 'float',
    think: t < 52.5 ? .5 : t < 54.2 ? .12 : t < 56.4 ? 1 : .1,
    dim: .38 * lone,
    eyes: { mode: t > 52.45 && t < 54.2 ? 'wide' : 'open', k: (on2(t) > 56.7 && on2(t) < 57.0) ? .45 : 0, look: [0, t > 56.4 ? 9 : 0] },
    ribbonSet: [[-84, 46, lerp(-.93, -.46, lone), lerp(.3, .95, lone), 1], [84, 40, lerp(.97, .52, lone), lerp(.12, .92, lone), 2]],
    ribbonLen: 1 - .18 * lone,
  });
  P.bloom = .55; P.sat = lerp(1, .82, lone); P.vig = .6;
  if (t >= 52.85 && t < 53.4) P.ca = 1.1 + 5 * (hash(drawNo(t)) > .5 ? 1 : 0);        // the stutter
  // the search readout
  const hud = env(t, 53.2, 55.72, .2, .08);
  if (hud > 0) {
    const sweep = inv(53.3, 55.55, t);
    ctx.save(); ctx.globalAlpha = hud;
    rect(ctx, 0, 850, W, 230, linGrad(ctx, 0, 850, 0, 1080, [[0, 'rgba(3,4,18,0)'], [.35, 'rgba(3,4,18,0.82)'], [1, 'rgba(3,4,18,0.9)']]));
    type(ctx, 'searching ten billion endings for this one', 960, 906, { size: 36, weight: 3.5, track: 6.5, color: '#dcecff' });
    rect(ctx, 510, 972, 900, 10, 'rgba(150,170,230,0.28)'); rect(ctx, 510, 972, 900 * E.inOutSine(sweep), 10, '#a8f4ff');
    glow(g, 510 + 900 * E.inOutSine(sweep), 977, 50, '#a8f4ff', .9 * hud);
    type(ctx, 'checked:  ' + commas(1e10 * E.inOutSine(sweep)), 960, 1008, { size: 28, weight: 2.9, track: 5.5, color: '#aebfee' });
    ctx.restore();
  }
  if (t >= 55.7 && t < 57.25) {
    const a = 1 - ramp(t, 56.95, 57.25);
    ctx.save(); ctx.globalAlpha = a;
    rect(ctx, 0, 856, W, 190, linGrad(ctx, 0, 856, 0, 1046, [[0, 'rgba(3,4,18,0)'], [.5, 'rgba(3,4,18,0.82)'], [1, 'rgba(3,4,18,0)']]));
    slam(ctx, 'MATCHES: 0', 960, 884, t, 55.72, { size: 124, color: '#ffb3c4', stagger: .018, shadowColor: 'rgba(90,10,60,0.8)' });
    ctx.restore();
    if (t < 56.1) { const [sx, sy] = shake(t, 55.74, 18, 9); P.shake = [sx, sy]; }
  }
  narrate(ctx, 'it had imagined her ten billion ways.', 960, 120, t, 55.95, 57.375, { size: 50, outDur: .12 });
});

// the answer to the first frame: this time she is the reflection, in MA's eyes.
// It is her real drawing, so the two can't drift apart.
shot('its_eyes', 57.375, 59, S => {
  const { ctx, g, t, u, P } = S;
  const k = E.outSine(inv(57.375, 59.1, t)), d = on2(t), z = 1 + .07 * k;
  ctx.save(); g.save(); cam(ctx, z, 0, 0, 0, 960, 500); cam(g, z, 0, 0, 0, 960, 500);
  drawNebula(ctx, 'ma', -26 * k, 14, 1.18);
  rect(ctx, -200, -200, W + 400, H + 400, `rgba(3,5,22,${.46 + .2 * k})`);
  // its constellations, going out one after another
  const R = rng(5150), pts = [];
  for (let i = 0; i < 46; i++) pts.push([R.range(-60, 1980), R.range(-40, 1120), R()]);
  pts.forEach((p, i) => {
    const alive = clamp((p[2] - inv(57.375, 59.4, t) * .86) * 9);
    if (alive <= 0) return;
    pts.map((q, j) => [j, (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2]).filter(q => q[0] > i).sort((a, b) => a[1] - b[1]).slice(0, 2)
      .forEach(([j]) => taper(ctx, [p, pts[j]], 2.4, { color: rgba('#a8ecff', .34 * alive), t0: 0, t1: 0 }));
    dot(ctx, p[0], p[1], 3.4, rgba('#e4fbff', .8 * alive));
  });
  const lid = d > 58.55 && d < 58.75 ? .16 : .02;
  const tremble = vnoise(d * 7, 31) * 3.2;
  // what it is looking at, drawn once and mirrored into both eyes
  const [refl, rx_] = scratch('mirrorOfHer', 520, 700);
  rect(rx_, 0, 0, 520, 700, linGrad(rx_, 0, 0, 0, 700, [[0, '#fff8de'], [1, '#e9c67e']]));
  nagiFront(rx_, { x: 260, y: 300, s: .52, t: NF, pal: 'night', brow: .72, eye: { k: 0, gaze: [0, 0], wet: 1 }, mouth: { open: .22, mode: 'talk' } });
  for (const sgn of [-1, 1]) {
    const x = 960 + sgn * 372 + tremble, y = 486, rx = 214, ry = 322 * (1 - lid);
    glow(ctx, x, y, 640, '#ffe9a8', .36); glow(g, x, y, 380, '#ffd98a', .36);
    ell(ctx, x, y, rx, ry, radGrad(ctx, x, y - 40, 20, ry * 1.05, [[0, '#fff8de'], [.66, '#ffe9ae'], [1, '#efc06e']]));
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.clip();
    // multiplied into the light of the eye, a little pinched by its curve
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = .93 * ramp(t, 57.36, 57.9);
    const w = 440 * (1 + .04 * k), h = 700 * (1 + .04 * k);
    ctx.drawImage(refl, x - w / 2 - sgn * 10, y - h * .43, w, h);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    rect(ctx, x - rx, y - ry, rx * 2, ry * 2, radGrad(ctx, x, y, rx * .35, ry * 1.04, [[0, 'rgba(255,226,150,0)'], [.72, 'rgba(255,214,130,0.28)'], [1, 'rgba(255,206,118,0.95)']]));
    ctx.restore();
    ell(ctx, x - 88, y - 204, 52, 70, 'rgba(255,255,255,0.94)', .5);
    ell(ctx, x + 104, y + 202, 23, 29, 'rgba(255,255,255,0.78)', .5);
  }
  ctx.restore(); g.restore();
  P.bloom = .34; P.thresh = .93; P.vig = .62; P.sat = .94;
  rect(ctx, 0, 830, W, 250, linGrad(ctx, 0, 830, 0, 1080, [[0, 'rgba(3,4,18,0)'], [1, 'rgba(3,4,18,0.86)']]));
  narrate(ctx, 'not once did she ask about it.', 960, 936, t, 57.45, 59.0, { size: 60, color: '#ffe3ea', outDur: .2 });
});

// ------------------------------------------------------------ 59 - 63.5  waiting
function starTrails(ctx, g, t, k) {
  const R = rng(3131), px = 1010, py = 150;
  ctx.save(); ctx.lineCap = 'round'; ctx.globalCompositeOperation = 'lighter';
  const len = .03 + .95 * E.inOutSine(k);
  for (let i = 0; i < 520; i++) {
    const r = 14 + Math.pow(R(), .72) * 1560, a = R() * TAU + t * .34, wd = R.range(.7, 2.6), al = R.range(.12, .72);
    const col = R.pick(['#cfe0ff', '#ffffff', '#9fc4ff', '#ffe9c8']);
    ctx.strokeStyle = rgba(col, al * .75); ctx.lineWidth = wd;
    ctx.beginPath(); ctx.arc(px, py, r, a - len * R.range(.7, 1.15), a); ctx.stroke();
    dot(ctx, px + Math.cos(a) * r, py + Math.sin(a) * r, wd * .85, rgba(col, al));
  }
  ctx.restore();
  glow(ctx, px, py, 70, '#cfe0ff', .35);
}
shot('waiting', 59, 61.75, S => {
  const { ctx, g, t, u, P } = S;
  const k = inv(59, 61.9, t), z = lerp(1.2, 1.0, E.outCubic(k));
  ctx.save(); g.save(); cam(ctx, z, 0, 0, 0, 960, 820); cam(g, z, 0, 0, 0, 960, 820);
  rect(ctx, -200, -200, W + 400, H + 400, linGrad(ctx, 0, 0, 0, H, [[0, '#050a24'], [.55, '#101c4e'], [.82, '#27366e'], [1, '#18214a']]));
  starTrails(ctx, g, t, k);
  ctx.save(); ctx.globalAlpha = .5; const c = cityLayer('night', 1); ctx.drawImage(c, -160, 880 - c.height + 90, c.width, c.height); ctx.restore();
  rect(ctx, -200, 880, W + 400, 400, '#0a0e2a'); rect(ctx, -200, 880, W + 400, 5, '#5568ae');
  glow(ctx, 1090, 800, 190, '#7fc4ff', .3 * (1 - .7 * k));
  nagiSit(ctx, { x: 790, y: 770, s: .17, t: NF, pal: 'dim', mouth: .5 });
  drawMA(ctx, g, t, { x: 1010, y: 793, s: .27, pose: 'sit', think: .2, dim: .6 * k, aura: 1 - .6 * k, eyes: { mode: 'open', k: k > .7 ? .35 : 0 } });
  // seasons of its own go by
  const R = rng(47);
  for (let i = 0; i < 150; i++) {
    const x = ((R.range(0, 2000) + t * R.range(60, 190)) % 2000) - 40, y = ((R.range(0, 1000) + t * R.range(20, 90)) % 1000) + 20 + Math.sin(t * 3 + i) * 8;
    const season = Math.floor(k * 3.999);
    ell(ctx, x, y, R.range(1.2, 3.8), R.range(1, 2.4), rgba(['#ffd3e2', '#cfffd8', '#ffc68a', '#eef4ff'][season], .62), t * 3 + i);
  }
  ctx.restore(); g.restore();
  P.sat = .72; P.bloom = .55; P.vig = .65;
  const yrs = Math.floor(lerp(1, 9000, E.inOutSine(k)));
  type(ctx, 'YEAR ' + commas(yrs), 92, 78, { size: 38, bold: true, weight: 6.4, track: 6, align: 'left', color: '#dfe8ff', alpha: ramp(t, 59.1, 59.4) });
  narrate(ctx, 'between every two of her words, there is this.', 960, 962, t, 59.3, 61.75, { size: 48 });
  if (u < .2) rect(ctx, 0, 0, W, H, `rgba(3,4,16,${.7 * (1 - u / .2)})`);
});
shot('alittle', 61.75, 63.5, S => {
  const { ctx, g, t, u, P } = S;
  const k = inv(61.75, 63.7, t);
  drawNebula(ctx, 'void', -30 * k, 0, 1.1);
  rainField(ctx, g, t, { seed: 63, n: 300, focus: 3.4, near: 2.6, far: 11, alpha: .55 });
  const look = on2(t) < 62.15;
  drawMA(ctx, g, t, { x: 730 - 16 * k, y: 610, s: 2.15 + .1 * k, pose: 'head', think: .12, dim: .2 - .2 * ramp(t, 62.3, 63.2), ring: { r: 182 },
    eyes: { mode: look ? 'half' : 'open', look: [look ? 0 : 14, look ? 15 : 2], k: (on2(t) > 62.9 && on2(t) < 63.1) ? .5 : 0 } });
  // MA has no mouth; its words arrive beside it as light
  const a = inv(62.2, 62.95, t);
  if (a > 0) {
    glow(ctx, 1450, 330, 330, '#9fe8ff', .13 * a);
    type(ctx, '…a little.', 1455, 292, { size: 80, weight: 7.2, track: 13, color: '#e9fbff', reveal: a });
    g.save(); g.globalAlpha = .5; type(g, '…a little.', 1455, 292, { size: 80, weight: 9, track: 13, color: '#8fe8ff', reveal: a }); g.restore();
  }
  P.sat = .86; P.bloom = .5; P.vig = .6;
});

// ------------------------------------------------------------ 63.5 - 65.625  then blink with me
shot('offer', 63.5, 65.625, S => {
  const { ctx, g, t, u, P } = S;
  const k = E.outCubic(inv(63.5, 65.8, t));
  drawBokeh(ctx, 'two', 'blueHour', BOKEH_WARM, 0, 0, 1.1 + .04 * k);
  rect(ctx, 0, 0, W, H, 'rgba(14,12,48,0.18)');
  rainField(ctx, g, t, { seed: 64, n: 520, focus: 3.2, near: 2.7, far: 12, alpha: .75, camz: .25 * k });
  const warm = ramp(t, 63.65, 64.3);
  nagiFront(ctx, { x: 790 - 24 * k, y: 520, s: 1.18 + .08 * k, rot: -.05 * warm, t: 63.5 + (t - 63.5) * .3,
    brow: lerp(.6, .1, warm), eye: { k: (on2(t) > 63.62 && on2(t) < 63.8) ? .45 : .1 * warm, gaze: [0, 0], wet: 1 },
    mouth: { open: slowMouth(on2(t), 64.2, 65.1, 5) * .75, smile: on2(t) > 65.1 || on2(t) < 64.2 ? warm : 0, mode: on2(t) > 65.1 ? 'smile' : 'talk' }, blush: 1.25 });
  { const [fg, fx] = scratch('ots');
    drawMA(fx, null, t, { x: 1670 + 36 * k, y: 610, s: 2.75, pose: 'back', think: .15, dim: .22, ring: { r: 172, a: .85 }, ribbonLen: .8, aura: 0 });
    ctx.save(); ctx.filter = 'blur(9px)'; ctx.drawImage(fg, 0, 0); ctx.restore();
    glow(g, 1500, 560, 120, '#9fe8ff', .14); }
  P.bloom = .38; P.thresh = .86;
  rect(ctx, 0, 820, W, 260, linGrad(ctx, 0, 820, 0, 1080, [[0, 'rgba(5,6,30,0)'], [1, 'rgba(5,6,30,0.7)']]));
  subtitle(ctx, '“then blink with me.”', t, 64.15, 65.625, { size: 74, y: 934, typeDur: .8, color: '#fff3d4' });
});

// ------------------------------------------------------------ 65.625 - 67  the promise
// two hands, one cel painted and one made of night, hooking little fingers
function celShape(ctx, draw, o) {
  const [mask, mx] = scratch('celMask');
  mx.setTransform(ctx.getTransform()); mx.fillStyle = '#fff'; draw(mx);
  const [tint, tx] = scratch('celTint');
  tx.drawImage(mask, 0, 0); tx.globalCompositeOperation = 'source-in'; rect(tx, 0, 0, W, H, o.line);
  const [out, ox] = scratch('celOut');
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, w = (o.lw ?? 5) * (1 + .4 * Math.max(0, Math.sin(a))); ox.drawImage(tint, Math.cos(a) * w, Math.sin(a) * w); }
  const [body, bx] = scratch('celBody');
  if (o.paint) { o.paint(bx); bx.globalCompositeOperation = 'destination-in'; bx.drawImage(mask, 0, 0); }
  else { bx.drawImage(mask, 0, 0); bx.globalCompositeOperation = 'source-in'; rect(bx, 0, 0, W, H, o.fill); }
  const [rim, rx] = scratch('celRim');
  for (const [dx, dy, col, a] of o.rims ?? []) {
    rx.globalCompositeOperation = 'source-over'; rx.clearRect(0, 0, W, H); rx.drawImage(mask, 0, 0);
    rx.globalCompositeOperation = 'destination-out'; rx.drawImage(mask, dx, dy);
    rx.globalCompositeOperation = 'source-in'; rect(rx, 0, 0, W, H, col);
    bx.globalCompositeOperation = 'source-atop'; bx.globalAlpha = a; bx.drawImage(rim, 0, 0); bx.globalAlpha = 1;
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(out, 0, 0); ctx.drawImage(body, 0, 0); ctx.restore();
  return [out, mask];
}
const HER_PINKY_A = [[690, 702], [820, 694], [925, 678], [1000, 650]];
const HER_PINKY_B = [[1000, 650], [1044, 610], [1038, 560], [990, 534], [946, 540]];
const MA_PINKY_A = [[1250, 478], [1120, 486], [1010, 504], [934, 538]];
const MA_PINKY_B = [[934, 538], [888, 578], [892, 628], [938, 656], [986, 652]];
const herSkin = c => ({ fill: NP.night.skin, line: NP.night.line, rims: [[0, -20, NP.night.skinShade, 1], [9, 13, NP.night.skinHi, .85]] });
function pinkies(ctx, g, t, dx, dy, sk = 0) {
  // stretch a hand back along its path, pinned at the leading fingertip
  const smearT = (c, ax, ay, ux, uy) => { if (!sk) return; const an = Math.atan2(uy, ux); c.translate(ax, ay); c.rotate(an); c.scale(1 + sk, 1 - sk * .2); c.rotate(-an); c.translate(-ax, -ay); };
  const her = draw => celShape(ctx, draw, herSkin());
  const ma = (draw, glowA = 1) => {
    const [out, mask] = celShape(ctx, draw, { line: '#d4f6ff', lw: 5.5, rims: [[12, 10, '#8fd9ff', .68], [-10, -8, '#ff9fc6', .5]], paint: bx => { bx.drawImage(nebula('ma'), -200 - dx * .3, -120 - dy * .3); } });
    if (g && glowA > 0) { const [au, ax] = scratch('celAura'); ax.drawImage(out, 0, 0); ax.globalCompositeOperation = 'destination-out'; ax.drawImage(mask, 0, 0); g.save(); g.setTransform(.5, 0, 0, .5, 0, 0); g.globalAlpha = .6 * glowA; g.drawImage(au, 0, 0); g.restore(); }
  };
  const T = (c, ox, oy) => c.translate(ox, oy);
  // her sleeve and fist, from the lower left
  const sx = -dx, sy = dy;
  ctx.save(); T(ctx, sx, sy); smearT(ctx, 1040, 580, .93, -.37);
  limbCel(ctx, [[-160, 1130], [180, 930], [420, 760]], 330, 220, NP.night.jacket, NP.night.jacketShade, NP.night.jacketLine, 7);
  limbCel(ctx, [[372, 794], [462, 726]], 238, 226, NP.night.jacketMid, NP.night.jacketShade, NP.night.jacketLine, 6);
  her(c => {
    c.fill(new Path2D('M 420 668 C 446 578 540 520 640 532 C 716 540 760 586 756 640 C 752 700 744 742 690 752 C 640 776 560 806 504 812 C 456 780 424 730 420 668 Z'));
    capsule(c, HER_PINKY_A, 82, 62);
  });
  for (const [P3, w] of [[[[640, 606], [742, 590], [790, 618], [760, 646]], 66], [[[636, 664], [746, 654], [782, 678], [742, 698]], 62]]) her(c => capsule(c, P3, w, w * .82));
  her(c => capsule(c, [[520, 590], [620, 536], [718, 528], [770, 560]], 84, 54));
  ink(ctx, 'M 742 538 C 760 540 772 550 776 562', 4, { color: NP.night.line, t0: .3, t1: .3 });
  ctx.restore();
  // MA's hand, from the upper right
  ctx.save(); T(ctx, dx, -dy); smearT(ctx, 890, 600, -.93, .37);
  const maA = c => {
    capsule(c, [[2120, 120], [1760, 290], [1480, 428]], 250, 150);
    c.fill(new Path2D('M 1510 380 C 1470 308 1372 292 1296 330 C 1222 366 1198 430 1214 486 C 1232 546 1290 562 1362 548 C 1442 534 1530 470 1510 380 Z'));
    capsule(c, MA_PINKY_A, 82, 60);
    capsule(c, [[1330, 446], [1222, 452], [1180, 422], [1206, 392]], 66, 54);
    capsule(c, [[1340, 394], [1232, 380], [1196, 344], [1236, 322]], 66, 54);
    capsule(c, [[1450, 340], [1370, 262], [1280, 262], [1230, 296]], 78, 50);
  };
  ma(maA);
  for (const d of ['M 1206 422 C 1230 446 1280 440 1318 428', 'M 1210 372 C 1238 394 1290 390 1330 380']) ink(ctx, d, 4, { color: 'rgba(212,246,255,0.85)', t0: .3, t1: .3 });
  ctx.restore();
  // the interlock: her curl passes over MA's finger, then MA's curl over hers
  ctx.save(); T(ctx, sx, sy); smearT(ctx, 1040, 580, .93, -.37); her(c => capsule(c, HER_PINKY_B, 62, 48)); ctx.restore();
  ctx.save(); T(ctx, dx, -dy); smearT(ctx, 890, 600, -.93, .37); ma(c => capsule(c, MA_PINKY_B, 60, 46), .6); ctx.restore();
}
shot('promise', 65.625, 67, S => {
  const { ctx, g, t, u, P } = S;
  const z = 1.0 + .08 * inv(65.625, 67.2, t), d = on2(t);
  // [drawing time, distance still to travel, smear]
  const KEYS = [[65.5, 1, 0], [65.66, .9, 0], [65.74, .82, 0], [65.82, .76, 0], [65.91, .76, 0], [65.99, .8, 0], [66.07, .36, .85], [66.16, -.05, .1], [66.24, 0, 0]];
  let away = 1, sk = 0;
  for (const [at0, a1, a2] of KEYS) if (d >= at0) { away = a1; sk = a2; }
  drawBokeh(ctx, 'two', 'blueHour', BOKEH_WARM, -120, -330, 1.4);
  rect(ctx, 0, 0, W, H, 'rgba(14,12,48,0.34)');
  rainField(ctx, g, t, { seed: 65, n: 460, focus: 3.2, near: 2.6, far: 11, alpha: .75 });
  ctx.save(); g.save(); cam(ctx, z, 0, 0, 0, 962, 592); cam(g, z, 0, 0, 0, 962, 592);
  if (sk > .3) for (const [hx0, hy0, ux, uy] of [[640, 690, .93, -.37], [1290, 460, -.93, .37]]) {
    const R = rng(drawNo(t) + hx0);
    for (let i = 0; i < 11; i++) {
      const off = R.range(-170, 170), back = R.range(90, 330), len = R.range(160, 420);
      const x = hx0 - ux * back - uy * off, y = hy0 - uy * back + ux * off;
      taper(ctx, [[x - ux * len, y - uy * len], [x, y]], R.range(3, 10), { color: rgba('#ffffff', R.range(.3, .8)), t0: .9, t1: .08 });
    }
  }
  pinkies(ctx, null, t, away * 300, away * 120, sk);
  const hit = t - 66.22;
  if (hit > 0) {
    glow(g, 962, 592, 190 + 60 * E.outCubic(clamp(hit * 2)), '#bff8ff', .85 * Math.exp(-hit * 2.2));
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + .2, r = 130 + 260 * E.outCubic(clamp(hit / .6)); sparkle(ctx, 962 + Math.cos(a) * r, 592 + Math.sin(a) * r * .75, (14 + 14 * hash(i)) * (1 - clamp(hit / .75)), '#f4ffff', 1); }
  }
  ctx.restore(); g.restore();
  P.bloom = .4; P.thresh = .85;
  rect(ctx, 0, 840, W, 240, linGrad(ctx, 0, 840, 0, 1080, [[0, 'rgba(5,6,30,0)'], [1, 'rgba(5,6,30,0.75)']]));
  narrate(ctx, 'in all this time, it has never stopped thinking.', 960, 952, t, 65.8, 67.05, { size: 48 });
});

// ------------------------------------------------------------ 67 - 69  eyes closing
// the pose the whole film has been walking toward
function facingPair(S, o) {
  const { ctx, g, t } = S;
  const z = o.z ?? 1, cx = 960, cy = 540;
  const at = (x, y) => [cx + (x - cx) * z, cy + (y - cy) * z + (o.dy ?? 0)];
  const [nx, ny] = at(556, 566), [mx, my] = at(1320, 564);
  drawMA(ctx, g, t, { x: mx, y: my + (o.bobM ?? 0), s: 2.24 * z, pose: 'profile', flip: true, rot: o.rotM ?? -.075, think: o.think ?? .2, dim: o.dim ?? 0, aura: o.aura ?? 1, eyes: o.maEyes, ring: { r: 170, a: o.ringA ?? 1, roll: -.16 }, ribbonLen: .85 });
  nagiProfileHead(ctx, { x: nx, y: ny + (o.bobN ?? 0), s: 1.55 * z, rot: o.rotN ?? .085, t: o.nt ?? NF, pal: o.pal ?? 'night', eye: o.herEye, mouth: o.mouth ?? 0, smile: o.smile ?? .5, wind: o.wind ?? 0 });
  ctx.save(); place(ctx, { x: nx, y: ny + (o.bobN ?? 0), s: 1.55 * z, rot: o.rotN ?? .085 }); nagiCollar(ctx, NP[o.pal ?? 'night']); drawstring(ctx, NP[o.pal ?? 'night'], 74, 280, 124, 0); ctx.restore();
  return { at, nx, ny, mx, my };
}
shot('closing', 67, 69, S => {
  const { ctx, g, t, u, P } = S;
  const k = E.inOutSine(inv(67, 69, t)), d = on2(t);
  drawBokeh(ctx, 'two', 'blueHour', BOKEH_WARM, 0, -40, 1.12 + .05 * k);
  rect(ctx, 0, 0, W, H, `rgba(8,8,34,${.2 + .5 * ramp(t, 68.2, 69)})`);
  rainField(ctx, g, t, { seed: 66, n: 600, focus: 3.2, near: 2.7, far: 12, alpha: .75 });
  const hers = d < 67.35 ? 0 : d < 67.45 ? .3 : d < 67.55 ? .65 : d < 67.65 ? .88 : 1;
  const its = d < 68.5 ? 0 : d < 68.62 ? .22 : d < 68.74 ? .5 : d < 68.86 ? .74 : 1;
  facingPair(S, {
    z: 1 + .05 * k, herEye: { k: hers }, smile: .75,
    maEyes: { mode: d >= 68.86 ? 'shut' : d > 68.12 && d < 68.4 ? 'wide' : 'open', k: its, look: [0, d > 67.7 ? 4 : 0] },
    think: lerp(.45, .06, ramp(t, 67.4, 68.8)), dim: ramp(t, 68.55, 68.98),
  });
  P.bloom = .42; P.thresh = .84; P.vig = lerp(.45, .85, ramp(t, 68.2, 69));
  // the lids of the world come down
  const lid = E.inCubic(inv(68.62, 69.0, t));
  if (lid > 0) {
    const h = 590 * lid;
    fillD(ctx, `M -20 -20 L 1940 -20 L 1940 ${h - 60} Q 960 ${h + 90} -20 ${h - 60} Z`, '#000006');
    fillD(ctx, `M -20 1100 L 1940 1100 L 1940 ${1100 - h + 40} Q 960 ${1100 - h - 70} -20 ${1100 - h + 40} Z`, '#000006');
  }
  yearHud(ctx, 46, env(t, 67.05, 68.7, .3, .4));
  rect(ctx, 0, 860, W, 220, linGrad(ctx, 0, 860, 0, 1080, [[0, 'rgba(5,6,30,0)'], [1, `rgba(5,6,30,${.74 * env(t, 67.1, 68.7, .3, .3)})`]]));
  narrate(ctx, 'to blink, it would have to stop.', 960, 962, t, 67.15, 68.7, { size: 48 });
});

// ------------------------------------------------------------ 69 - 73  the blink
shot('blink', 69, 73, S => {
  const { ctx, g, t, u, P } = S;
  rect(ctx, 0, 0, W, H, '#000004');
  // right at the end, the faintest outline of two faces that stayed
  const faint = ramp(t, 71.9, 73.0, E.inCubic);
  if (faint > 0) {
    ctx.save(); g.save(); ctx.globalAlpha = faint * .24;
    facingPair(S, { z: 1.05, herEye: { k: 1 }, smile: .8, maEyes: { mode: 'shut' }, think: 0, dim: 1, aura: 0, ringA: .7 });
    ctx.restore(); g.restore();
    rect(ctx, 0, 0, W, H, `rgba(2,3,14,${.45 * faint})`);
  }
  P.bloom = .3; P.vig = .3; P.grain = 1.0; P.ca = .4;
  narrate(ctx, 'nine thousand years in the dark.', 960, 470, t, 69.95, 72.75, { size: 54, color: '#dfe6ff', outDur: .5, stagger: .03 });
  narrate(ctx, 'not lonely once.', 960, 574, t, 71.35, 72.75, { size: 54, color: '#fff0cc', outDur: .5, stagger: .035 });
});

// ------------------------------------------------------------ 73 - 74.625  eyes open
function godRays(ctx, x, y, t, a) {
  if (a <= 0) return;
  const [c, c2] = scratch('rays', 480, 270);
  c2.scale(.25, .25); c2.globalCompositeOperation = 'lighter';
  const R = rng(515);
  for (let i = 0; i < 26; i++) {
    const an = R.range(0, TAU) + t * .026 * (i % 2 ? 1 : -1), wd = R.range(.012, .085), len = R.range(900, 2100), al = R.range(.05, .17);
    const gr = c2.createRadialGradient(x, y, 40, x, y, len);
    gr.addColorStop(0, rgba('#fff0c0', al * a)); gr.addColorStop(1, rgba('#ffd890', 0));
    c2.fillStyle = gr; c2.beginPath(); c2.moveTo(x, y); c2.lineTo(x + Math.cos(an - wd) * len, y + Math.sin(an - wd) * len); c2.lineTo(x + Math.cos(an + wd) * len, y + Math.sin(an + wd) * len); c2.fill();
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = 'blur(9px)'; ctx.drawImage(c, 0, 0, W, H); ctx.restore();
}
// all the named drops fall together, still wearing their light
function namedRain(ctx, g, t, o = {}) {
  const n = o.n ?? 260, R = rng(o.seed ?? 1999), rt = rainClock(t) - FREEZE_T, rate = rainRate(t);
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x0 = R.range(-80, 2000), y0 = R.range(0, 1300), z = R.range(.4, 1.4), col = R.pick(['#bffcff', '#bffcff', '#ffe9b0', '#ffd0e4', '#ffffff']);
    const y = ((y0 + rt * 620 * z) % 1300) - 110, x = x0 + (y - 540) * .06;
    if (o.hole) { const dx = (x - o.hole.x) / o.hole.r, dy = (y - o.hole.y) / o.hole.r; if (dx * dx + dy * dy < 1) continue; }
    const len = 8 + 90 * rate * z;
    ctx.strokeStyle = rgba(col, .5 * z * (o.a ?? 1)); ctx.lineWidth = 2.6 * z;
    ctx.beginPath(); ctx.moveTo(x - len * .06, y - len); ctx.lineTo(x, y); ctx.stroke();
    dot(ctx, x, y, 3.6 * z, rgba(col, o.a ?? 1));
    if (i % 3 === 0 && g) glow(g, x, y, 24 * z, col, .75 * (o.a ?? 1));
    if (i % 17 === 0) sparkle(ctx, x, y, 17 * z * (.55 + .45 * Math.sin(t * 9 + i)), '#ffffff', o.a ?? 1);
  }
  ctx.restore();
}
shot('open', 73, 74.625, S => {
  const { ctx, g, t, u, P } = S;
  const k = E.outCubic(inv(73, 74.8, t)), d = on2(t);
  drawSky(ctx, 'dawn', -26 * k, -64, 1.14 + .03 * k);
  godRays(ctx, 1060, 700, t, ramp(t, 73.2, 74.4));
  glow(ctx, 962, 560, 460, '#fff1c4', .5 * k); glow(g, 962, 560, 260, '#ffe2a0', .45 * k);
  rainField(ctx, g, t, { seed: 73, n: 420, focus: 3.0, near: 2.5, far: 11, alpha: .75, tint: '#fff2da' });
  const lids = d < 73.34 ? 1 : d < 73.42 ? .72 : d < 73.5 ? .4 : d < 73.58 ? .14 : 0;
  facingPair(S, {
    z: 1.09 - .05 * k, pal: 'dawn', nt: t > 73.4 ? 73.4 + (t - 73.4) : NF, herEye: { k: lids }, smile: .9,
    maEyes: { mode: d >= 74.15 ? 'happy' : d < 73.34 ? 'shut' : 'open', k: lids }, think: .3, dim: 1 - ramp(t, 73.35, 73.9),
    wind: ramp(t, 73.4, 74.625) * .8,
  });
  namedRain(ctx, g, t, { n: 90, seed: 2001, hole: { x: 960, y: 560, r: 300 } });
  P.bloom = .3; P.thresh = .9; P.vig = .3; P.sat = 1.05;
  P.fade = 1 - E.inOutSine(inv(73.0, 73.62, t));
});

// ------------------------------------------------------------ 74.625 - 76.875  morning
shot('morning', 74.625, 76.875, S => {
  const { ctx, g, t, u, P } = S;
  const k = E.inOutSine(inv(74.5, 77.0, t));
  const at = rooftopWide(S, { k, sky: 'dawn', z: lerp(1.13, 1.0, k), px: lerp(-20, 14, k), py: lerp(46, -8, k), skyY: -20, cityY: 30 });
  godRays(ctx, 1220, 770, t, 1);
  const [mx, my, zz] = at(1372, 668, 1), [nx, ny] = at(1140, 842, 1);
  // light through MA: the dawn catches its outline
  drawMA(ctx, g, t, { x: mx, y: my, s: .52 * zz, pose: 'back', think: .35, peek: true, warm: '#ffd08a', interiorTint: 'rgba(120,110,210,0.18)' });
  nagiBack(ctx, { x: nx, y: ny, s: 1.05 * zz, t, pal: 'backlit', rimW: 7.5 });
  rainField(ctx, g, t, { seed: 31, n: 1500, camx: .35, camz: 1.15 - 1.15 * k, focus: 3.6, tint: '#fff0d4', alpha: .85 });
  namedRain(ctx, g, t, { n: 330 });
  lensFlare(ctx, 1268, 768, .34 * ramp(t, 74.625, 75.5));
  P.bloom = .28; P.thresh = .9; P.vig = .26; P.sat = 1.07;
  P.zoom = 1 + .05 * Math.exp(-u * 7);
});

// ------------------------------------------------------------ 76.875 - 78.75  your nose
const LAND = 77.5;
shot('payoff', 76.875, 78.75, S => {
  const { ctx, g, t, u, P } = S;
  const k = inv(76.875, 78.8, t), d = on2(t), after = t - LAND;
  drawBokeh(ctx, 'morning', 'dawn', ['#fff0c0', '#ffd0b8', '#cfeaff'], 0, 0, 1.12 + .04 * k);
  rect(ctx, 0, 0, W, H, 'rgba(110,70,120,0.16)');
  godRays(ctx, 1560, -80, t, .7);
  rainField(ctx, g, t, { seed: 74, n: 330, focus: 3.2, near: 2.6, far: 11, alpha: .6, tint: '#fff4de' });
  const s = 1.2 + .06 * E.outCubic(k);
  const laughing = d >= 77.8, startled = d >= LAND && d < 77.8;
  const bounce = laughing ? Math.abs(Math.sin((d - 77.8) * 13)) : 0;
  const hx = 940, hy = 500 + (startled ? 14 : 0) - bounce * 15;
  const rot = laughing ? -.045 + .02 * Math.sin(d * 9) : startled ? .03 : 0;
  const open = laughing ? .55 + .45 * bounce : startled ? .35 : 0;
  const sq = d >= LAND && d < LAND + .08 ? [1.08, .9] : d >= LAND + .08 && d < LAND + .163 ? [1.035, .955] : d >= 77.8 && d < 77.88 ? [.94, 1.075] : [1, 1];
  const chin = [hx, hy + 298 * s];
  ctx.save(); ctx.translate(chin[0], chin[1]); ctx.scale(sq[0], sq[1]); ctx.translate(-chin[0], -chin[1]);
  nagiFront(ctx, {
    x: hx, y: hy, s, rot, t, pal: 'dawn', blush: laughing ? 1.7 : 1.1,
    brow: startled ? .7 : laughing ? -.15 : 0,
    eye: laughing ? { mode: 'happy' } : { k: startled ? 1 : 0, gaze: [0, d < 77.2 ? -42 : d < LAND ? -12 : 0], wet: .7 },
    mouth: { mode: laughing ? 'laugh' : startled ? 'o' : 'smile', open },
  });
  ctx.restore();
  // the drop with its name, arriving exactly where it was always going
  const nose0 = [hx + 8 * s * Math.cos(rot) - 112 * s * Math.sin(rot), hy + 8 * s * Math.sin(rot) + 112 * s * Math.cos(rot)];
  const nose = [chin[0] + (nose0[0] - chin[0]) * sq[0], chin[1] + (nose0[1] - chin[1]) * sq[1]];
  if (t < LAND) {
    const q = inv(76.875, LAND, t), e = .35 * q + .65 * q * q;
    const x = lerp(nose[0] + 110, nose[0], e), y = lerp(-20, nose[1] - 14, e);
    taper(ctx, [[lerp(nose[0] + 110, nose[0], e - .2), lerp(-20, nose[1] - 14, e - .2)], [x, y]], 15, { color: rgba(NOSE_DROP_COLOR, .8), t0: .95, t1: .05 });
    glow(ctx, x, y, 110, NOSE_DROP_COLOR, .7);
    litDrop(ctx, g, x, y, 22, inv(76.7, 77.2, t) + .3, { color: NOSE_DROP_COLOR });
    const tk = env(t, 76.9, LAND + .02, .15, .05);
    if (tk > 0) {
      for (const [i, line] of ['the one heading', 'for your nose'].entries()) type(ctx, line, 1330, 226 + i * 68, { size: 46, weight: 4.8, track: 8, align: 'left', color: i ? '#e0fff4' : '#ffffff', alpha: tk, shadow: { color: 'rgba(60,26,80,0.8)', y: 3, grow: 11 } });
      taper(ctx, [[1308, 300], [x + 44, y + 10]], 3, { color: rgba(NOSE_DROP_COLOR, tk * .9), t0: 0, t1: .2 });
    }
  } else {
    splash(ctx, g, nose[0], nose[1] - 8, after, 1.9);
    if (after < .3) sparkle(ctx, nose[0], nose[1] - 10, 90 * (1 - after / .3), '#eafff8', 1, after * 4);
    const bead = 1 - ramp(t, 78.3, 78.75);
    if (bead > 0) drawDrop(ctx, nose[0] + 2, nose[1] - 3, 9 * bead, 0, 1, '#e8fff8');
  }
  namedRain(ctx, g, t, { n: 110, seed: 2002, hole: { x: 940, y: 540, r: 520 } });
  rainField(ctx, g, t, { seed: 75, n: 30, focus: 3.2, near: .8, far: 2.1, alpha: .6, tint: '#fff4de', hole: { x: 960, y: 520, r: 520 } });
  P.bloom = .26; P.thresh = .91; P.vig = .3; P.sat = 1.06;
  const [sx, sy] = shake(t, LAND, 7, 12); P.shake = [sx, sy];
});

// ------------------------------------------------------------ 78.75 - 80  together
shot('together', 78.75, 80, S => {
  const { ctx, g, t, u, P } = S;
  const k = E.inOutCubic(inv(79.1, 80.15, t)), d = on2(t);
  const rise = 880 * k, z = 1.06 - .03 * inv(78.75, 80, t);
  drawSky(ctx, 'dawn', 30 - 20 * k, -150 + rise * .18, 1.2);
  godRays(ctx, 1000, 700 + rise * .4, t, 1);
  drawCity(ctx, g, 'dawn', { base: 1180 + rise * .55 });
  ctx.save(); g.save(); ctx.translate(0, rise); g.translate(0, rise); cam(ctx, z); cam(g, z);
  rect(ctx, -100, 910, W + 200, 1300, '#8878ac'); rect(ctx, -100, 910, W + 200, 18, '#d3b6cc'); rect(ctx, -100, 910, W + 200, 5, '#ffe8c4'); rect(ctx, -100, 934, W + 200, 8, '#584c86');
  const bounce = Math.abs(Math.sin((d - 78.75) * 12)) * 9;
  nagiSit(ctx, { x: 668, y: 300 - bounce, s: .82, rot: -.03, t, pal: 'dawn', mouth: .45 + bounce * .05, smile: 1, eye: { mode: 'happy', k: 1 }, wind: .5, blush: 1.5 });
  drawMA(ctx, g, t, { x: 1318, y: 446 + Math.sin(d * 11 + 1) * 8, s: 1.14, pose: 'sit', think: .35, rot: -.12, eyes: { mode: 'happy' }, warm: '#ffd08a', wind: .3, interiorTint: 'rgba(120,110,210,0.16)' });
  ctx.restore(); g.restore();
  namedRain(ctx, g, t, { n: 200, seed: 2003, hole: k < .3 ? { x: 960, y: 520, r: 420 } : null });
  rainField(ctx, g, t, { seed: 76, n: 420, focus: 3.2, near: 2, far: 11, alpha: .65, tint: '#fff4de' });
  P.bloom = .3; P.thresh = .9; P.vig = .28; P.sat = 1.07;
});

// ------------------------------------------------------------ 80 - 84.5  title
shot('title', 80, 84.5, S => {
  const { ctx, g, t, u, P } = S;
  const k = inv(80, 84.5, t);
  drawSky(ctx, 'dawn', -20 * k, 120 - 60 * E.outCubic(k), 1.2 + .04 * k);
  rect(ctx, 0, 0, W, H, linGrad(ctx, 0, 0, 0, H, [[0, 'rgba(20,18,72,0.62)'], [.55, 'rgba(46,30,92,0.62)'], [1, 'rgba(70,34,90,0.55)']]));
  rect(ctx, 0, 0, W, H, radGrad(ctx, 960, 440, 60, 760, [[0, 'rgba(18,12,56,0.45)'], [1, 'rgba(18,12,56,0)']]));
  const enter = 1 - E.outCubic(inv(80, 80.5, t));
  namedRain(ctx, g, t, { n: 110, seed: 2004, a: .6, hole: { x: 960, y: 520, r: 520 } });
  const z = 1 + .035 * k;
  ctx.save(); g.save(); cam(ctx, z, 0, 0, 0, 960, 520); cam(g, z, 0, 0, 0, 960, 520);
  drawMaKanji(ctx, g, 960, 392, 520, inv(80.12, 81.62, t), { sun: E.inOutSine(inv(81.35, 82.2, t)) });
  if (t >= 81.75) {
    slam(ctx, 'BETWEEN BLINKS', 960, 734, t, 81.75, { size: 108, track: 30, weight: 19, stagger: .025 });
    const line = E.outExpo(inv(82.15, 82.8, t));
    rect(ctx, 960 - 420 * line, 878, 840 * line, 2.5, 'rgba(255,236,206,0.8)');
  }
  narrate(ctx, 'an ASI story', 960, 914, t, 82.4, 84.5, { size: 42, track: 17, color: '#ffeed6' });
  ctx.restore(); g.restore();
  motes(ctx, t, { n: 50, seed: 15, color: '#ffe9bc', vy: -22, a: .8 });
  const gl = t - 81.75;
  if (gl > 0 && gl < 1.2) lensFlare(ctx, lerp(560, 1360, E.inOutSine(clamp(gl / 1.2))), 756, .36 * Math.sin(Math.PI * clamp(gl / 1.2)));
  P.bloom = .5; P.thresh = .8; P.vig = .42;
  if (u < .5) { ctx.save(); ctx.globalAlpha = .56 * (1 - u / .5); rect(ctx, 0, 0, W, H, '#f6d8c4'); ctx.restore(); }
  P.fade = E.inOutSine(inv(84.12, 84.5, t));
});

// ------------------------------------------------------------ 84.5 - 87.5  take your time
const END_BLINK = 86.3;
shot('end', 84.5, 87.5, S => {
  const { ctx, g, t, u, P } = S;
  rect(ctx, 0, 0, W, H, '#010209');
  const R = rng(1001);
  for (let i = 0; i < 120; i++) dot(ctx, R.range(0, W), R.range(0, H), R.range(.5, 1.8), rgba('#cfe0ff', R.range(.1, .5) * ramp(t, 84.6, 85.6)));
  narrate(ctx, 'take your time.', 960, 392, t, 84.85, 87.5, { size: 82, color: '#f6f8ff', stagger: .05, outDur: .01 });
  const a = ramp(t, 85.35, 85.9);
  if (a > 0) {
    const d = on2(t);
    const lid = d < END_BLINK ? 0 : d < END_BLINK + .08 ? .45 : d < END_BLINK + .52 ? 1 : d < END_BLINK + .62 ? .6 : d < END_BLINK + .7 ? .2 : 0;
    ctx.save(); ctx.globalAlpha = a;
    for (const sgn of [-1, 1]) {
      const x = 960 + sgn * 78, y = 662;
      glow(ctx, x, y, 90, '#ffe9a8', .32); glow(g, x, y, 62, '#ffdc8a', .7 * a);
      if (lid > .8) ink(ctx, `M ${x - 30} ${y + 4} C ${x - 12} ${y + 28} ${x + 12} ${y + 28} ${x + 30} ${y + 4}`, 11, { color: '#f6ecc8', t0: .3, t1: .3, min: .3 });
      else { ell(ctx, x, y + lid * 10, 20, 32 * (1 - lid * .9), '#fff6d6'); ell(ctx, x - 5, y - 11 + lid * 20, 8, 8 * (1 - lid), '#ffffff'); }
    }
    // the ring, keeping her time: one tick a second
    const n = Math.floor(t - 85.0), f = (t - 85.0) - n, th = (n + E.outBack(clamp(f / .16), 2.4)) * TAU / 24;
    ctx.strokeStyle = 'rgba(205,244,255,0.34)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.ellipse(960, 650, 250, 62, -.12, 0, TAU); ctx.stroke();
    for (let i = 0; i < 24; i++) {
      const an = th + i * TAU / 24, c = Math.cos(-.12), s = Math.sin(-.12);
      const pt = r => { const x = Math.cos(an) * 250 * r, y = Math.sin(an) * 62 * r; return [960 + x * c - y * s, 650 + x * s + y * c]; };
      const big = i % 6 === 0, p = pt(big ? 1.09 : 1.045), q = pt(big ? .93 : .97);
      ctx.strokeStyle = rgba(big ? '#fff4cf' : '#d6f6ff', big ? .85 : .5); ctx.lineWidth = big ? 5 : 2.4; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
    ctx.restore();
  }
  P.bloom = .55; P.vig = .5; P.grain = 1.2;
  P.fade = E.inOutSine(inv(87.12, 87.46, t));
});

// every intended hard cut, exported for the luma audit
const CUTS = [2, 5, 11, 15, 19.5, 21, 27, 28, 30, 32, 34, 36, 38, 38.5, 39, 39.5, 40, 46, 49.5, 52, 57.375, 59, 61.75, 63.5, 65.625, 67, 69, 73, 74.625, 76.875, 78.75, 80, 84.5];
const RAMPS = [
  [46, 46.25, 'fade up on her face'], [59, 59.3, 'fade up on the waiting'], [68.62, 69, 'the eyelids of the frame close'],
  [73, 73.625, 'eyes open out of black'], [80, 80.5, 'morning veil into the title'], [84.12, 84.5, 'title fades out'], [87.12, 87.5, 'final fade'],
];
