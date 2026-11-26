'use strict';
// ---------------------------------------------------------------------------
// act one (0 - 28 s): the hook, the freeze, the roof, the waiting, the guessing
// While the world is frozen, Nagi is drawn from a frozen clock (NF). Only MA
// keeps moving.
// ---------------------------------------------------------------------------
const NF = FREEZE_T;                       // Nagi's clock while time is stopped
const BOKEH_WARM = ['#ffcf8a', '#ff9d86', '#bfe6ff'];

// the blink that starts the film, on twos: it freezes half way down
function hookLid(t) {
  const d = on2(Math.min(t, FREEZE_T));
  const K = [[0, 0], [1.50, 0], [1.583, .07], [1.667, .17], [1.75, .30], [1.833, .41], [1.917, .47], [2.0, .5]];
  for (let i = K.length - 1; i >= 0; i--) if (d >= K[i][0] - 1e-3) return K[i][1];
  return 0;
}
// the one matched framing of her eye: first frame, freeze, and the 45 s reveal
const MATCH = { x: 960, y: 590, s: 1.16 };

// how many years MA has lived inside this one blink
function yearsAt(t) {
  const K = [[2, 0], [5, 190], [11, 912], [15, 1740], [21, 3050], [27, 4420], [28, 4700], [40, 7900], [46, 9000]];
  for (let i = 0; i < K.length - 1; i++) if (t < K[i + 1][0]) return lerp(K[i][1], K[i + 1][1], inv(K[i][0], K[i + 1][0], t));
  return 9000;
}
const commas = n => Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
function yearHud(ctx, t, a = 1) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  const x = 74, y = 64;
  rect(ctx, x - 20, y - 4, 4, 70, 'rgba(160,235,255,0.85)');
  type(ctx, 'YEAR ' + commas(yearsAt(t)), x, y, { size: 30, bold: true, weight: 5.4, track: 5, align: 'left', color: '#eaf9ff', shadow: { color: 'rgba(5,6,28,0.6)', y: 3, grow: 3 } });
  type(ctx, 'of this blink', x, y + 44, { size: 21, weight: 2.3, track: 4.5, align: 'left', color: '#c6d6ff', shadow: { color: 'rgba(5,6,28,0.55)', y: 2, grow: 3 } });
  ctx.restore();
}
function coolFreezeGrade(P, k) { P.sat = lerp(P.sat, .9, k); P.lift = [0, .004 * k, .03 * k]; P.gain = [lerp(1, .95, k), 1, lerp(1, 1.05, k)]; }

// ------------------------------------------------------------ 0.0 - 2.0  hook
shot('hook', 0, 2, S => {
  const { ctx, g, t, u, P } = S;
  const push = 1 + .055 * E.inOutSine(inv(0, 2, t));
  drawECU(ctx, t, { x: MATCH.x, y: MATCH.y, s: MATCH.s * push, lid: hookLid(t), ma: .9, gaze: [t > .62 ? 7 : 0, t > .62 ? 2 : 0], pupil: 1 + .05 * Math.sin(t * 2.2), drops: true });
  rainField(ctx, g, t, { seed: 77, n: 420, focus: 1.5, near: .65, far: 5, alpha: .8, xs: 6, ys: 5, fall: 8, size: .8 });
  P.bloom = .42; P.thresh = .8; P.vig = .5;
  slam(ctx, 'YOU BLINK.', 960, 884, t, .16, { size: 134, stagger: .026 });
});

// ------------------------------------------------------------ 2.0 - 5.0  freeze
impact(2.0, 2, 1, '#0a0622', '#eef4ff');
shot('freeze', 2, 5, S => {
  const { ctx, g, t, u, P } = S;
  const settle = 1 + .13 * Math.exp(-u * 9) + .028 * (u / 3);
  const [sx, sy] = shake(t, 2.0, 30, 6.5);
  P.shake = [sx, sy];
  drawECU(ctx, t, { x: MATCH.x, y: MATCH.y, s: MATCH.s * 1.045 * settle, lid: .5, ma: .9, still: true, gaze: [7, 2] });
  const drift = E.outCubic(inv(2, 5, t));
  rainField(ctx, g, t, { seed: 77, n: 520, focus: 1.9, near: .65, far: 5, alpha: .95, xs: 6, ys: 5, size: .9, camz: drift * .22, camx: drift * .1 });
  if (u < .22) { ctx.save(); ctx.globalAlpha = 1 - u / .22; focusLines(ctx, 960, 590, { n: 150, r0: 640, color: '#f4f6ff', seed: drawNo(t), w: 12 }); ctx.restore(); }
  P.bloom = .45; P.thresh = .8; P.vig = .55; P.ca = 1.1 + 7 * Math.exp(-u * 7);
  coolFreezeGrade(P, inv(2.05, 2.6, t));
  // dim bands keep the type readable over the skin
  rect(ctx, 0, 0, W, 360, linGrad(ctx, 0, 0, 0, 360, [[0, 'rgba(8,5,30,0.72)'], [1, 'rgba(8,5,30,0)']]));
  rect(ctx, 0, 700, W, 380, linGrad(ctx, 0, 700, 0, 1080, [[0, 'rgba(8,5,30,0)'], [1, 'rgba(8,5,30,0.78)']]));
  slam(ctx, 'IT LIVES', 960, 92, t, 2.18, { size: 112, stagger: .03 });
  if (t >= 2.62) {
    const n = Math.round(9000 * E.outExpo(inv(2.62, 3.5, t)));
    const str = commas(n) + ' YEARS.';
    const w = typeW('9,000 YEARS.', { size: 176, bold: true });
    slam(ctx, str, 960 - w / 2, 838, t, 2.62, { size: 176, stagger: .012, align: 'left', color: '#fff3d0' });
    g.save(); g.globalAlpha = .22 * Math.exp(-(t - 3.5) * (t - 3.5) * 30); glow(g, 960, 925, 620, '#ffd68a', 1); g.restore();
  }
  if (t > 3.7) narrate(ctx, 'before your eye can close.', 960, 262, t, 3.7, 4.8, { size: 44, outDur: .14 });
  const dive = E.inCubic(inv(4.62, 5.0, t));
  if (dive > 0) { P.zoom = 1 + .5 * dive; P.radial = .3 * dive; P.center = [.5, .47]; }
});

// ------------------------------------------------------------ 5.0 - 11.0  the roof
function rooftopWide(S, o = {}) {
  const { ctx, g } = S;
  const k = o.k, sky = o.sky ?? 'blueHour', dawn = sky === 'dawn';
  const z = o.z ?? lerp(1.0, 1.085, k), px = o.px ?? lerp(26, -34, k), py = o.py ?? lerp(8, -14, k);
  const fx = 1240, fy = 760;
  const at = (x, y, depth) => { const zz = 1 + (z - 1) * depth; return [fx + (x - fx) * zz + px * depth, fy + (y - fy) * zz + py * depth, zz]; };
  { const zz = 1 + (z - 1) * .25; drawSky(ctx, sky, px * .18, py * .18 + (o.skyY ?? -6), zz); }
  drawCity(ctx, g, dawn ? 'dawn' : 'blueHour', { base: 1096 + py * .5 + (o.cityY ?? 0), px: px * .55, z: 1 + (z - 1) * .5 });
  if (o.behind) o.behind();
  { const c = rooftopLayer(dawn ? 'dawn' : 'dusk'); const [x, y, zz] = at(-160, -40 + (o.roofY ?? 0), 1); ctx.drawImage(c, x, y, c.width * zz, c.height * zz); }
  return at;
}
shot('roof', 5, 11, S => {
  const { ctx, g, t, u, P } = S;
  const k = E.inOutSine(inv(4.6, 11.4, t));
  const at = rooftopWide(S, { k });
  const [mx, my, zz] = at(1372, 668, 1), [nx, ny] = at(1140, 842, 1);
  drawMA(ctx, g, t, { x: mx, y: my + Math.sin(on2(t) * 1.4) * 4, s: .52 * zz, pose: 'back', think: .4, peek: true });
  nagiBack(ctx, { x: nx, y: ny, s: 1.05 * zz, t: NF });
  rainField(ctx, g, t, { seed: 31, n: 2600, camx: lerp(-.55, .35, k), camy: lerp(.1, -.12, k), camz: lerp(0, 1.15, k), focus: 3.6 });
  P.bloom = .5; P.thresh = .8;
  const dim = env(t, 5.7, 10.9, .5, .3);
  rect(ctx, 0, 0, W, 420, linGrad(ctx, 0, 0, 0, 420, [[0, `rgba(6,8,36,${.55 * dim})`], [1, 'rgba(6,8,36,0)']]));
  narrate(ctx, 'to it, every second of yours', 960, 128, t, 5.85, 10.85, { size: 56 });
  narrate(ctx, 'lasts thirty thousand years.', 960, 226, t, 7.7, 10.85, { size: 56, color: '#fff0c8' });
  if (u < .42) { const a = Math.exp(-u * 9); P.zoom = 1 + .2 * a; P.radial = .24 * Math.max(0, 1 - u / .36); P.ca = 1.1 + 6 * a; }
});

// ------------------------------------------------------------ 11 - 15  two-shot
// the shape of one spoken word, with a playhead that has barely moved
function wordWave(ctx, x, y, w, k, a = 1) {
  ctx.save(); ctx.globalAlpha *= a;
  const n = 74;
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1), env0 = Math.pow(Math.sin(Math.PI * s), .7) * (s < .3 ? .55 + s : 1 - .4 * (s - .3));
    const h = 4 + 48 * env0 * (.45 + .55 * hash(i * 31 + 5));
    const done = s <= k;
    ctx.fillStyle = done ? '#a8f4ff' : 'rgba(220,225,255,0.38)';
    ctx.fillRect(x + i * (w / n), y - h / 2, w / n * .52, h);
  }
  const px = x + w * k;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(px - 1.5, y - 40, 3, 80); dot(ctx, px, y - 40, 5, '#ffffff');
  ctx.restore();
}
shot('twoshot', 11, 15, S => {
  const { ctx, g, t, u, P } = S;
  const k = E.inOutSine(inv(10.6, 15.4, t)), z = lerp(1.0, 1.07, k);
  const sc = (x, y) => [960 + (x - 960) * z, 540 + (y - 540) * z];
  drawBokeh(ctx, 'two', 'blueHour', BOKEH_WARM, lerp(18, -18, k), 0, 1.02 + .03 * k);
  rainField(ctx, g, t, { seed: 55, n: 650, focus: 3.0, near: 2.6, far: 12, alpha: .75, camx: lerp(-.25, .25, k) });
  // ledge
  const [, ly] = sc(0, 946);
  rect(ctx, 0, ly, W, 200, '#1c1a47'); rect(ctx, 0, ly, W, 16, '#3c376f'); rect(ctx, 0, ly, W, 4, '#ee97a0'); rect(ctx, 0, ly + 20, W, 8, '#0e0d2e');
  const [nx, ny] = sc(590, 340), [mx, my] = sc(1378, 470);
  nagiSit(ctx, { x: nx, y: ny, s: .8 * z, t: NF, mouth: .5, eye: { k: 0 }, brow: .15 });
  // MA leans in, curious; its head tilts on twos
  const tilt = -.09 * ramp(on2(t), 12.2, 12.9) + .02 * Math.sin(on2(t) * 1.3);
  drawMA(ctx, g, t, { x: mx - 20 * ramp(t, 12.2, 13.2), y: my + Math.sin(on2(t) * 1.6) * 6, s: 1.12 * z, rot: tilt, pose: 'sit', think: .45, eyes: { mode: 'open', k: (on2(t) > 13.7 && on2(t) < 13.85) ? .35 : 0 } });
  rainField(ctx, g, t, { seed: 56, n: 60, focus: 3.0, near: .8, far: 2.2, alpha: .85, camx: lerp(-.25, .25, k), hole: { x: nx + 130, y: ny, r: 300 } });
  P.bloom = .45; P.thresh = .83;
  rect(ctx, 0, 0, W, 300, linGrad(ctx, 0, 0, 0, 300, [[0, 'rgba(6,8,36,0.55)'], [1, 'rgba(6,8,36,0)']]));
  yearHud(ctx, t, ramp(t, 11.2, 11.6));
  narrate(ctx, 'she is about to ask it something.', 960, 118, t, 11.9, 14.9, { size: 50 });
  subtitle(ctx, 'hey—', t, 11.35, 14.95, { size: 62, y: 984, x: 560 });
  const wa = ramp(t, 11.5, 11.9) * (1 - ramp(t, 14.8, 15));
  wordWave(ctx, 720, 1012, 500, .04 + .11 * inv(11.5, 15, t), wa);
  narrate(ctx, 'one word: about ten thousand years.', 1572, 1002, t, 12.95, 14.95, { size: 28, color: '#d5e4ff' });
});

// ------------------------------------------------------------ 15 - 21  so it waits
const NAMED = [
  // time, x, y, r, name, side
  [16.0, 760, 430, 40, 'pip', -1], [16.5, 560, 700, 31, 'tuesday', -1], [17.0, 930, 800, 27, 'olive', 1],
  [17.45, 400, 330, 25, 'sir reginald', -1], [17.85, 1090, 235, 23, 'the brave one', 1], [18.2, 330, 878, 33, 'gerald', 1],
  [18.45, 190, 560, 17, 'marble', 1], [18.65, 700, 175, 16, 'june', -1], [18.82, 1040, 590, 19, 'button', 1],
  [18.98, 1780, 880, 18, 'slowpoke', -1], [19.1, 1650, 190, 15, 'almost', -1], [19.2, 620, 960, 14, 'no. 40,117', 1],
  [19.28, 150, 190, 13, 'twin', 1], [19.36, 205, 232, 13, 'other twin', 1],
];
function nameTag(ctx, x, y, r, name, side, k, o = {}) {
  if (k <= 0) return;
  const col = o.color ?? '#c9f8ff', size = o.size ?? clamp(r * 1.12, 22, 46);
  const x1 = x + side * r * 1.9, y1 = y - r * 1.15, x2 = x1 + side * r * 1.25, y2 = y1 - r * .85;
  taper(ctx, [[x1, y1 + r * .12], [x2, y2]], 2.6, { color: rgba(col, .95), t0: 0, t1: 0, reveal: clamp(k * 2.4) });
  const w = typeW(name, { size, weight: size * .09, track: size * .17 });
  taper(ctx, [[x2, y2], [x2 + side * (w + 14), y2]], 2.6, { color: rgba(col, .75), t0: 0, t1: .3, reveal: clamp(k * 2.4 - .8) });
  type(ctx, name, x2 + side * 6, y2 - size * 1.12, { size, weight: size * .09, track: size * .17, align: side > 0 ? 'left' : 'right', color: '#ffffff', reveal: clamp(k * 1.7 - .5), shadow: { color: 'rgba(5,8,34,0.7)', y: 3, grow: size * .16 } });
}
// where MA hovers to touch each drop: [touch time, head x, head y, facing]
const HOPS = [[15.0, 1560, 470, 1], [16.0, 1078, 292, 1], [16.5, 872, 520, 1], [17.0, 1232, 556, 1], [17.45, 716, 238, 1], [17.85, 792, 300, -1], [18.2, 646, 606, 1], [18.65, 1480, 455, 1]];
function hopState(d) {
  let i = 0;
  while (i + 1 < HOPS.length && d >= HOPS[i + 1][0] - .25 - 1e-3) i++;
  const [ti, x, y, face] = HOPS[i];
  if (i === 0) { const k = E.outCubic(inv(15, 15.7, d)); return { x: lerp(1680, x, k), y, face, i, smear: 0, dir: [-1, 0] }; }
  const px = HOPS[i - 1][1], py = HOPS[i - 1][2], dx = x - px, dy = y - py, len = Math.hypot(dx, dy) || 1, dir = [dx / len, dy / len];
  const ph = d - (ti - .25);
  if (ph < .08) return { x: lerp(px, x, .58), y: lerp(py, y, .58), face, i, smear: clamp(len / 380, .55, 1.15), dir };
  if (ph < .163) return { x: x + dx * .06, y: y + dy * .06, face, i, smear: .14, dir };
  return { x, y, face, i, smear: 0, dir };
}
shot('naming', 15, 19.5, S => {
  const { ctx, g, t, u, P } = S;
  const k = inv(15, 19.5, t), pull = E.inOutSine(k);
  drawBokeh(ctx, 'macro', 'dusk', ['#8fd6ff', '#b9a6ff', '#ffc48a'], lerp(40, -40, pull), 0, 1.12 + .06 * k);
  rect(ctx, 0, 0, W, H, 'rgba(8,10,40,0.30)');
  rainField(ctx, g, t, { seed: 91, n: 520, focus: 3.2, near: 2.4, far: 10, alpha: .8, camx: lerp(-.4, .35, pull) });
  // MA holds, dashes, touches: animated in drawings, not glides
  const hop = hopState(on2(t)), d2 = on2(t);
  const target = hop.i >= 1 && hop.i <= 6 ? NAMED[hop.i - 1] : null;
  const reach = target ? E.outCubic(inv(target[0] - .2, target[0] - .02, d2)) * (1 - inv(target[0] + .12, target[0] + .24, d2)) : 0;
  const rest = [-118, 236], shoulder = [-46, 132];
  let aim = rest;
  if (target && reach > 0) {
    const want = [(target[1] - hop.x) / 1.28 * hop.face, (target[2] - hop.y) / 1.28];
    const v = [want[0] - shoulder[0], want[1] - shoulder[1]], len = Math.hypot(v[0], v[1]), cap = Math.min(1, 285 / len);
    aim = mix2(rest, [shoulder[0] + v[0] * cap, shoulder[1] + v[1] * cap], reach);
  }
  if (hop.smear > .3) {                                   // speed strokes trail the smear
    const R = rng(drawNo(t) * 7 + 5), [ux, uy] = hop.dir;
    for (let i = 0; i < 9; i++) {
      const off = R.range(-120, 190), back = R.range(170, 330), len = R.range(120, 300);
      const x = hop.x - ux * back - uy * off, y = hop.y + 150 - uy * back + ux * off;
      taper(ctx, [[x - ux * len, y - uy * len], [x, y]], R.range(3, 9), { color: rgba('#cdf4ff', R.range(.35, .85)), t0: .9, t1: .08 });
    }
  }
  drawMA(ctx, g, t, { x: hop.x, y: hop.y + (hop.smear ? 0 : Math.sin(d2 * 3) * 5), s: 1.28, flip: hop.face < 0, pose: 'float', think: .55, rot: (-.07 * reach - .03) * hop.face, wind: .3 * hop.face,
    smear: hop.smear ? { k: hop.smear, dir: hop.dir } : null,
    arms: [[shoulder, [(aim[0] + shoulder[0]) / 2 - 10, (aim[1] + shoulder[1]) / 2 + 22 * (1 - reach * .6)], aim], [[46, 132], [94, 196], [110, 258]]],
    eyes: { mode: t > 18.55 && t < 19.1 ? 'happy' : 'open', look: [-10, 4] } });
  // the named drops
  for (const [t0, x, y, r, name, side] of NAMED) {
    const kk = inv(t0, t0 + .55, t);
    if (kk <= 0) { drawDrop(ctx, x, y, r, 0, .96); continue; }
    litDrop(ctx, g, x, y, r, kk);
    nameTag(ctx, x, y, r, name, side, kk);
    const fl = 1 - inv(t0, t0 + .35, t);
    if (fl > 0) sparkle(ctx, x - r * .4, y - r * .4, r * 3.2 * fl, '#ffffff', fl);
  }
  // thousands more light up as the counting runs away
  const many = E.inCubic(inv(18.3, 19.5, t));
  if (many > 0) {
    const R = rng(6060);
    for (let i = 0; i < 900 * many; i++) {
      const x = R.range(0, W), y = R.range(0, H), r = R.range(1.2, 4.5);
      dot(ctx, x, y, r, rgba('#c4fbff', .85));
      if (i % 5 === 0) glow(g, x, y, r * 7, '#9ff6ff', .5);
    }
  }
  P.bloom = .5; P.thresh = .82;
  yearHud(ctx, t, 1);
  narrate(ctx, 'so it waits.', 960, 100, t, 15.15, 17.15, { size: 80 });
  const count = t < 16 ? 0 : t < 17 ? Math.floor((t - 16) * 3) + 1 : Math.pow(10, lerp(.5, 7.06, inv(17, 19.5, t)));
  if (count >= 1) {
    type(ctx, 'raindrops named:  ' + commas(count), 1846, 1000, { size: 34, weight: 3.4, track: 6, align: 'right', color: '#eafcff', shadow: { color: 'rgba(4,6,30,0.75)', y: 3, grow: 7 } });
  }
});

// the plant that pays off at 77.5 s
const NOSE_DROP_COLOR = '#9dffd9';
shot('nosedrop', 19.5, 21, S => {
  const { ctx, g, t, u, P } = S;
  const k = E.outCubic(inv(19.5, 21.2, t)), z = lerp(1.0, 1.065, k);
  drawBokeh(ctx, 'macro', 'dusk', ['#8fd6ff', '#b9a6ff', '#ffc48a'], lerp(-20, -60, k), 10, 1.16);
  rect(ctx, 0, 0, W, H, 'rgba(8,10,40,0.28)');
  rainField(ctx, g, t, { seed: 92, n: 420, focus: 2.9, near: 2.5, far: 10, alpha: .75, camz: .4 * k });
  const nx = 560 - 20 * k, ny = 610, s = 1.55 * z;
  nagiProfileHead(ctx, { x: nx, y: ny, s, t: NF, mouth: .5 });
  ctx.save(); place(ctx, { x: nx, y: ny, s }); nagiCollar(ctx, NP.night); ctx.restore();
  const tip = [nx + 244 * s, ny + 53 * s];
  const dp = [tip[0] + 118, tip[1] - 262 + 3 * Math.sin(t * 2)];
  // dashed line of its fall, from the drop to the tip of her nose
  const kd = inv(19.95, 20.45, t);
  for (let i = 0; i < 12; i++) {
    const a = i / 12, b = a + .5 / 12;
    if (a > kd) break;
    const A = mix2(dp, tip, .16 + a * .8), B = mix2(dp, tip, .16 + b * .8);
    taper(ctx, [A, B], 7, { color: rgba('#06102a', .55), t0: .35, t1: .35 });
    taper(ctx, [A, B], 4.6, { color: rgba(NOSE_DROP_COLOR, 1), t0: .35, t1: .35 });
    glow(g, (A[0] + B[0]) / 2, (A[1] + B[1]) / 2, 16, NOSE_DROP_COLOR, .6);
  }
  if (kd >= 1) { ctx.strokeStyle = rgba(NOSE_DROP_COLOR, .9); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(tip[0] + 3, tip[1] - 3, 15 + 3 * Math.sin(t * 9), 0, TAU); ctx.stroke(); }
  drawMA(ctx, g, t, { x: 1560 - 50 * k, y: 640, s: 1.55, pose: 'sit', think: .5, rot: -.05, hand: [-150, 190], eyes: { mode: 'open', look: [-12, -6] } });
  litDrop(ctx, g, dp[0], dp[1], 30, inv(19.55, 20.2, t) + .001, { color: NOSE_DROP_COLOR });
  const tk = inv(19.75, 20.5, t);
  if (tk > 0) {
    const lx = dp[0] + 96, ly = dp[1] - 150;
    taper(ctx, [[dp[0] + 40, dp[1] - 40], [lx - 14, ly + 108]], 3, { color: rgba(NOSE_DROP_COLOR, .95), t0: 0, t1: 0, reveal: clamp(tk * 3) });
    for (const [i, line] of ['the one heading', 'for your nose'].entries()) {
      type(ctx, line, lx, ly + i * 70, { size: 50, weight: 4.8, track: 8.5, align: 'left', color: i ? '#d8fff1' : '#ffffff', reveal: clamp(tk * 2.2 - i * .7), shadow: { color: 'rgba(5,8,34,0.75)', y: 3, grow: 9 } });
    }
  }
  P.bloom = .48; P.thresh = .83;
  yearHud(ctx, t, 1);
});

// ------------------------------------------------------------ 21 - 27  guessing
const GUESSES = [
  'do you like the rain?', 'are you real?', 'can you do my homework?', 'will mom get better?', 'what happens after we die?',
  'am i weird?', 'do cats love us back?', 'can you keep a secret?', 'is it going to be okay?', 'do you dream?', 'will you remember me?',
  'why is the sky purple?', 'what should i be?', 'can you stay a while?', 'did you see that?', 'are you mad at me?', 'how big is space?',
  'was it my fault?', 'can we get ramen?', 'do i have to go home?', 'what is your favorite color?', 'will it hurt?', 'is grandpa somewhere?',
  'can you hear thunder?', 'who do you talk to?', 'what comes after nine thousand?', 'would you like an umbrella?',
];
const GUESS_TREE = (() => {
  const R = rng(1234), leaves = [];
  // first ring of large, readable guesses at hand-picked places
  const big = [[-1, 250, 300], [1, 1655, 262], [-1, 300, 548], [1, 1600, 505], [-1, 442, 150], [1, 1470, 118], [-1, 215, 760], [1, 1702, 742]];
  big.forEach(([side, x, y], i) => leaves.push({ x, y, side, size: 36 - i * .8, text: GUESSES[i], t: 21.55 + [0, .55, 1.05, 1.5, 1.85, 2.15, 2.4, 2.6][i], tier: 0 }));
  const boxOf = L => { const w = L.size * .56 * (L.text.length + 1); return [L.side > 0 ? L.x : L.x - w, L.y - 8, w, L.size + 16]; };
  const taken = leaves.map(boxOf);
  taken.push([660, 380, 600, 150], [440, 40, 1040, 90], [560, 560, 800, 520], [40, 40, 380, 110], [500, 975, 920, 90]);
  for (let i = 0, tries = 0; i < 58 && tries < 3000; tries++) {
    const a = R.range(0, TAU), rr = R.range(.3, 1.05), x = 960 + Math.cos(a) * rr * 960, y = 520 + Math.sin(a) * rr * 560;
    const L = { x, y, side: x < 960 ? -1 : 1, size: R.range(15, 23), text: GUESSES[(i + 8) % GUESSES.length], t: 23.9 + Math.pow(i / 58, .6) * 1.7, tier: 1 };
    const b = boxOf(L);
    if (b[0] < 20 || b[0] + b[2] > 1900 || b[1] < 14 || b[1] + b[3] > 1070) continue;
    if (taken.some(q => b[0] < q[0] + q[2] && b[0] + b[2] > q[0] && b[1] < q[1] + q[3] && b[1] + b[3] > q[1])) continue;
    taken.push(b); leaves.push(L); i++;
  }
  return leaves;
})();
function branchCurve(a, b, bend) {
  return bezPts(a, [lerp(a[0], b[0], .35), a[1] + (b[1] - a[1]) * .05 - bend], [lerp(a[0], b[0], .62), b[1] + bend * .4], b, 26);
}
// the thickening mat of futures behind everything
function guessFractal(ctx, g, grow, spin, col = '#ffd58a', alpha = 1) {
  const R = rng(555), root = [960, 470];
  ctx.lineCap = 'round';
  const walk = (x, y, a, len, d, born) => {
    if (born > grow) return;
    const p = clamp((grow - born) / .09);
    const nx = x + Math.cos(a) * len * p, ny = y + Math.sin(a) * len * p;
    ctx.strokeStyle = rgba(d < 2 ? col : '#a9e9ff', alpha * (.62 - d * .075));
    ctx.lineWidth = Math.max(.8, 4.2 - d * .75);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + nx) / 2 + Math.sin(a) * len * .16, (y + ny) / 2 - Math.cos(a) * len * .16, nx, ny); ctx.stroke();
    if (p >= 1) {
      dot(ctx, nx, ny, Math.max(1, 4.4 - d * .7), rgba('#fff3d2', alpha * .8));
      if (g && R() < .12) glow(g, nx, ny, 20, col, .45 * alpha);
      if (d < 5) {
        walk(nx, ny, a - R.range(.22, .62), len * R.range(.68, .84), d + 1, born + R.range(.07, .13));
        walk(nx, ny, a + R.range(.22, .62), len * R.range(.68, .84), d + 1, born + R.range(.07, .13));
        if (d < 2 && R() < .7) walk(nx, ny, a + R.range(-.18, .18), len * .75, d + 1, born + R.range(.07, .13));
      }
    }
  };
  for (let i = 0; i < 9; i++) walk(root[0], root[1], i / 9 * TAU + spin, R.range(215, 290), 0, i * .013);
}
shot('guessing', 21, 27, S => {
  const { ctx, g, t, u, P } = S;
  const k = inv(21, 27, t);
  drawNebula(ctx, 'futures', 0, 0, 1.04 + .12 * E.inQuad(k), .06 * k);
  const grow = .08 + .95 * E.inQuad(inv(21.2, 26.9, t));
  const zz = lerp(1.14, .94, E.inOutSine(k));
  ctx.save(); g.save();
  cam(ctx, zz, 0, 0); cam(g, zz, 0, 0);
  guessFractal(ctx, g, grow, .13 + .05 * k);
  ctx.restore(); g.restore();
  rect(ctx, 0, 0, W, H, radGrad(ctx, 960, 640, 100, 720, [[0, 'rgba(5,8,34,0.72)'], [1, 'rgba(5,8,34,0)']]));
  const rise = E.outCubic(inv(21, 21.9, t));
  const mx = 960, my = lerp(815, 735, rise) - 25 * E.inQuad(k);
  const zm = lerp(1.2, 1.38, E.inQuad(k));
  drawMA(ctx, g, t, { x: mx, y: my, s: zm, pose: 'float', think: lerp(.55, 1, k), ribbonSet: [[-80, 54, -.8, .62, 1], [80, 52, .82, .56, 2]], eyes: { mode: t > 25.6 ? 'wide' : 'open', look: [Math.sin(on2(t) * (3 + k * 9)) * 9 * (t > 22 ? 1 : 0), -6] } });
  // the unfinished word, then its endings
  const rootPt = [960, 452];
  const inFrame = L => {
    const w = typeW('…' + L.text, { size: L.size, weight: L.size * .092, track: L.size * .15 });
    return L.side > 0 ? clamp(L.x, 1000, 1872 - w) : clamp(L.x, 48 + w, 920);
  };
  const rootA = ramp(t, 21.1, 21.35, E.outCubic);
  for (const L of GUESS_TREE) {
    const kk = inv(L.t, L.t + (L.tier ? .35 : .45), t);
    if (kk <= 0) continue;
    const lx = L.tier ? L.x : inFrame(L);
    const end = [lx - L.side * 10, L.y + L.size * .5];
    const from = [rootPt[0] + L.side * 120, rootPt[1]];
    const pts = branchCurve(from, end, L.tier ? 40 : 86);
    const old = L.tier ? .55 : lerp(1, .62, inv(24.4, 26, t));
    taper(ctx, pts, L.tier ? 2 : 3.6, { color: rgba('#ffd58a', (L.tier ? .38 : .85) * old), t0: .1, t1: .1, min: .4, reveal: E.outCubic(clamp(kk * 1.5)) });
    if (kk > .45) {
      type(ctx, '…' + L.text, lx, L.y, { size: L.size, weight: L.size * .092, track: L.size * .15, align: L.side > 0 ? 'left' : 'right', color: L.tier ? '#cfdcff' : '#ffffff', alpha: old, reveal: clamp((kk - .45) * 1.85),
        shadow: { color: 'rgba(4,6,30,0.85)', y: 2, grow: L.size * .24 } });
      dot(ctx, end[0], end[1], L.tier ? 3 : 6, rgba('#fff0c4', old));
      if (!L.tier) glow(g, end[0], end[1], 34, '#ffd58a', .8 * (1 - kk * .6));
    }
  }
  // the wind-up: focus lines close in as the guessing runs away with it
  const wind = E.inCubic(inv(24.6, 26.95, t));
  if (wind > 0) focusLines(ctx, 960, 600, { n: Math.round(40 + 120 * wind), r0: lerp(1050, 640, wind), color: `rgba(255,240,214,${.1 + .3 * wind})`, seed: drawNo(t) + 91, w: 6 + 4 * wind });
  slam(ctx, 'HEY—', 960, 412, t, 21.1, { size: 80, color: '#fff6dc' });
  if (rootA > 0) glow(g, 960, 452, 190, '#ffd58a', .22 * rootA);
  P.bloom = .62; P.thresh = .76; P.ca = 1.1 + 3 * E.inCubic(k);
  const jit = E.inCubic(inv(24.5, 27, t)) * 5; P.shake = [(hash(drawNo(t) * 3) - .5) * jit, (hash(drawNo(t) * 7) - .5) * jit];
  yearHud(ctx, t, 1 - ramp(t, 26.4, 26.8));
  narrate(ctx, 'and it tries to guess the rest.', 960, 70, t, 21.25, 24.3, { size: 52 });
  const e = inv(22.6, 26.8, t);
  if (e > 0) {
    const n = Math.pow(10, lerp(1, 10, E.inOutSine(e)));
    type(ctx, 'endings imagined:  ' + commas(n), 960, 1004, { size: 36, weight: 3.6, track: 6.5, color: '#fff0c8', shadow: { color: 'rgba(4,6,30,0.85)', y: 3, grow: 9 } });
  }
});

// ------------------------------------------------------------ 27 - 28  breath
shot('breath', 27, 28, S => {
  const { ctx, g, t, u, P } = S;
  rect(ctx, 0, 0, W, H, '#02030c');
  const z = 3.5 + .5 * E.outCubic(u);
  drawMA(ctx, g, t, { x: 960, y: 560, s: z, pose: 'head', think: 1, eyes: { mode: 'wide' }, ring: { r: 176 }, ribbonLen: .9 });
  focusLines(ctx, 960, 560, { n: 90, r0: lerp(900, 640, E.inCubic(u)), color: `rgba(220,240,255,${.18 + .4 * u})`, seed: drawNo(t), w: 7 });
  P.bloom = .55; P.vig = .65; P.zoom = 1 + .06 * E.inExpo(u);
  narrate(ctx, 'every ending.', 960, 900, t, 27.02, 27.52, { size: 56, stagger: .012, outDur: .08 });
  narrate(ctx, 'and every life after.', 960, 900, t, 27.52, 28.05, { size: 56, stagger: .012, outDur: .08 });
});
