// ---------- ACT 0-2: cold open, lore, training ----------
const beat_ = (u, t0) => smooth(t0 - 0.02, t0 + 0.12, u) * (1 - smooth(t0 + 0.12, t0 + 0.34, u));
SHOTFN.eye = (F, u) => {
  const g = fxLayer(F), tOpen = bt(2);
  const k = u < tOpen ? 0 : clamp((u - tOpen) / 0.085);
  const open = k <= 0 ? 0 : easeOutBack(k, 2.8);
  const glint = u < tOpen + 0.04 ? 0 : Math.max(0, 1 - (u - tOpen - 0.04) / 0.32);
  const jolt = pulse(u, tOpen, 0.3);
  const zoom = 1.04 + u * 0.05 + (u > tOpen ? 0.10 * easeOutExpo(clamp((u - tOpen) / 0.35)) : 0);
  g.save(); g.translate(fbm1(u * 40, 1) * 22 * jolt, fbm1(u * 40, 2) * 22 * jolt);
  drawEyeCloseup(g, { t: u, open, glint, zoom, brow: u < tOpen ? 0.4 : 1.0, pupil: u < tOpen + 0.12 ? 1.25 : 0.82, dim: u < tOpen ? 0.52 - 0.11 * (beat_(u, 0.06) + beat_(u, bt(1))) : 0 });
  g.restore();
  if (u > tOpen + 0.08) speedRadial(g, 960, 540, F.draw, { inner: 560, alpha: 0.42 * Math.max(0.25, jolt), n: 90 });
  F.post = { vig: 0.55, bloom: 0.35, bloomThr: 0.93, fade: u < 0.08 ? 1 - u / 0.08 : 0 };
};

SHOTFN.click = (F, u, ua) => {
  const tc = bt(4) - bt(3);
  const lift = u < tc ? (ua < tc - 0.13 ? 1.0 - 0.10 * smooth(0, tc - 0.13, ua) : 0.90 * (1 - easeIn(clamp((ua - (tc - 0.13)) / 0.13)))) : 0;
  const push = u < tc ? 0 : easeOut(clamp((ua - tc) / 0.70)) * 1.55;
  const th = -0.95 + push;
  const c = lerpCam(cam([0.62, 0.56, 1.08], [0.08, 0.335, 0.09], 31, -0.10), cam([0.50, 0.46, 0.84], [0.09, 0.325, 0.09], 29, -0.06), easeOut(clamp(u / 1.1)));
  const punch = pulse(u, tc, 0.22);
  if (punch > 0) c.fov *= 1 - 0.13 * punch;
  const v = view3d(F, {
    cam: shake(c, u, 0.016 * punch, 30), env: { mode: 11, time: u, scroll: 0.2 * u }, light: LIGHT.macro, focus: [0.05, 0.4, 0.05], shadowSize: 0.8,
    scene: (mb, out) => {
      const st = { crank: th, t: ua, wind: 0.25, neck: 'ride' };
      if (lift > 0) { const pf = pedalFrame(th, 1); const a = 0.45 * lift; st.legs = { r: { pf: { P: add(pf.P, [0.085 * lift, 0.118 * lift, 0.03 * lift]), ex: [Math.cos(a), Math.sin(a), 0], ey: [-Math.sin(a), Math.cos(a), 0], ez: [0, 0, 1] } } }; }
      hero(mb, out, st, { wheel: push * BG.gear, blur: u > tc ? 0.35 * (1 - clamp((u - tc) / 0.7)) : 0 });
    }, eyes: { hero: { open: 1, brow: 1 } }
  });
  const g = fxLayer(F);
  const p = v.pt(pedalFrame(th, 1).P);
  if (u >= tc) {
    shockRing(g, p[0], p[1] - 10, u - tc, { r: 620, color: '#fff3c0', w: 40, flat: 0.55 });
    sparks(g, u, { x: p[0] - 20, y: p[1] + 4, t0: tc, t1: tc + 0.09, rate: 800, dir: -PI * 0.5, spread: 3.4, speed: 1300, life: 0.38, width: 8 });
    if (u - tc < 0.2) speedRadial(g, p[0], p[1], F.draw, { inner: 430, alpha: 0.65, n: 100 });
    sfxWord(g, 'KA-CHAK!', 1440, 270, 150, u - tc, { rot: -0.14, life: 0.62 });
  } else speedH(g, u, 4, { n: 26, alpha: 0.35, dir: -1, y0: 0, y1: 460, len: 300 });
  F.post = { vig: 0.5, bloom: 0.4 };
};

SHOTFN.grip = (F, u, ua) => {
  const curl = easeOutBack(clamp((ua - 0.05) / 0.2), 1.4);
  const squeeze = pulse(ua, bt(7) - bt(6), 0.25);
  const c = lerpCam(cam([1.18, 1.16, 0.88], [0.575, 0.905, 0.18], 27, 0.13), cam([0.99, 1.06, 0.75], [0.590, 0.895, 0.19], 24.5, 0.08), easeOut(clamp(u / 0.75)));
  const v = view3d(F, {
    cam: shake(c, u, 0.006 * (squeeze + pulse(u, 0.22, 0.15)), 28), env: { mode: 11, time: u + 3, scroll: 0.1 }, light: LIGHT.macro, focus: [0.55, 0.9, 0.15], shadowSize: 0.7,
    scene: (mb, out) => hero(mb, out, { crank: 0.4, t: ua, wind: 0.35, neck: 'ride', gripY: -0.0015 * squeeze, wing: { curl: Math.max(0.12, curl) } }), eyes: { hero: { open: 1, brow: 1 } }
  });
  const g = fxLayer(F); const p = v.pt([0.61, 0.9, 0.21]);
  if (u > 0.2 && u < 0.45) speedRadial(g, p[0], p[1], F.draw + 3, { inner: 470, alpha: 0.38, n: 70 });
  sfxWord(g, 'GRRIP', 470, 250, 120, u - 0.22, { rot: -0.16, life: 0.46 });
  F.post = { vig: 0.55, bloom: 0.3, fade: u > 0.69 ? clamp((u - 0.69) / 0.06) : 0 };
};

// ---------- lore cards ----------
SHOTFN.card1 = (F, u) => {
  const g = fxLayer(F); cardBG(g, { t: u });
  slamText(g, 'THEY SAID', 960, 540, 190, u, 0.0, { track: 10 });
  F.post = { vig: 0.45, bloom: 0.2, chroma: 1.2 * pulse(u, 0, 0.2) };
};
SHOTFN.card2 = (F, u, ua) => {
  const k = easeOut(clamp(u / 0.75));
  view3d(F, {
    cam: cam([0.55 - 0.18 * k, 0.70, 4.9 - 0.25 * k], [0.08, 0.86, 0], 30), env: { mode: 10, time: u, vanish: [0.52, 0.44], dim: 1.12 }, light: Object.assign({}, LIGHT.rival, { rim: [1.0, 0.55, 0.20], rimDir: [-0.6, 0.55, -0.55] }), sil: 0.97, silCol: [0.045, 0.012, 0.07], ink: [0.04, 0.008, 0.06], noShadow: true,
    scene: (mb, out) => { const r = ride(0, ua, { coast: 0.35 }); hero(mb, out, { t: ua, wind: 0.8, neck: 'ride', scarf: { wind: 0.85 } }, r); }, eyes: { hero: { open: 1, brow: 1, glow: 1, glowCol: [1, 0.8, 0.3] } }
  });
  const g = fxLayer(F);
  const gr = g.createLinearGradient(0, 760, 0, 1080); gr.addColorStop(0, 'rgba(6,2,12,0)'); gr.addColorStop(1, 'rgba(6,2,12,0.92)'); g.fillStyle = gr; g.fillRect(0, 760, W, 320);
  slamText(g, 'A PELICAN', 960, 208, 200, u, 0.0, { layers: [['#12071c', 20]] });
  F.post = { vig: 0.5, bloom: 0.5 };
};
SHOTFN.card3 = (F, u) => {
  const g = fxLayer(F);
  const tN = bt(14) - bt(12), tR = bt(15) - bt(12);
  const hot = u >= tN && u < tN + 0.9;
  cardBG(g, { t: u + 2, streak: hot ? 'rgba(230,40,70,0.45)' : 'rgba(120,80,190,0.35)' });
  if (hot) { const gr = g.createRadialGradient(960, 560, 40, 960, 560, 900); gr.addColorStop(0, 'rgba(150,12,44,0.55)'); gr.addColorStop(1, 'rgba(150,12,44,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  slamText(g, 'COULD', 960, 235, 150, u, 0.0, { track: 12 });
  slamText(g, 'NEVER', 960, 545, 340, u, tN, { from: 2.2, jolt: 44, fill: [[0, '#ff5466'], [0.55, '#e81a3a'], [1, '#9c0626']], layers: [['#f7f2ea', 14], ['#17061a', 6]], drop: [20, 22, '#3a0414'] });
  slamText(g, 'RIDE.', 960, 868, 170, u, tR, { track: 12 });
  F.post = { vig: 0.45, bloom: 0.22, chroma: 2.2 * pulse(u, tN, 0.25), shake: [fbm1(u * 45, 4) * 0.014 * pulse(u, tN, 0.35), fbm1(u * 45, 8) * 0.018 * pulse(u, tN, 0.35), 1 + 0.03 * pulse(u, tN, 0.35), 0] };
};

// ---------- the drawings the machines made ----------
const svgCanvas = mkCanvas();
function drawBadSVG(g, variant, u) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#2b2d36'; g.fillRect(0, 0, W, H);
  // plain editor chrome
  g.fillStyle = '#3a3d49'; g.fillRect(150, 70, 1620, 76);
  ['#ff6159', '#ffbd2e', '#28c941'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(200 + i * 44, 108, 13, 0, TAU); g.fill(); });
  const names = ['ATTEMPT_0001.SVG', 'ATTEMPT_0047.SVG', 'ATTEMPT_0512.SVG'];
  strokeText(g, names[variant], 960, 108, 36, { color: '#e8e9f0', weight: 4.2 });
  g.fillStyle = '#ffffff'; g.fillRect(150, 146, 1620, 700);
  g.strokeStyle = '#e4e6ee'; g.lineWidth = 2; for (let x = 150; x <= 1770; x += 54) { g.beginPath(); g.moveTo(x, 146); g.lineTo(x, 846); g.stroke(); } for (let y = 146; y <= 846; y += 54) { g.beginPath(); g.moveTo(150, y); g.lineTo(1770, y); g.stroke(); }
  g.lineWidth = 7; g.strokeStyle = '#000000'; g.lineCap = 'butt'; g.lineJoin = 'miter';
  const circle = (x, y, r, f) => { g.beginPath(); g.arc(x, y, r, 0, TAU); if (f) { g.fillStyle = f; g.fill(); } g.stroke(); };
  const ell = (x, y, a, b, f, rot = 0) => { g.beginPath(); g.ellipse(x, y, a, b, rot, 0, TAU); g.fillStyle = f; g.fill(); g.stroke(); };
  const line = (...p) => { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke(); };
  const tri = (a, b, c, d, e, f, col) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.lineTo(e, f); g.closePath(); g.fillStyle = col; g.fill(); g.stroke(); };
  if (variant === 0) {
    circle(640, 660, 128); circle(1230, 622, 96);
    line(700, 590, 900, 520, 1010, 665, 700, 590); line(1060, 540, 1180, 560); line(900, 520, 880, 470);
    line(842, 470, 925, 470); line(1300, 480, 1360, 470);
    ell(905, 335, 170, 104, '#ffffff'); circle(1080, 222, 66, '#ffffff'); circle(1103, 205, 9, '#000');
    tri(1020, 200, 1020, 262, 826, 214, '#ffa500');
    line(860, 436, 838, 540); line(955, 436, 990, 548);
    g.fillStyle = '#000'; g.fillRect(960, 752, 62, 16);
  } else if (variant === 1) {
    circle(820, 600, 170); circle(985, 600, 170);
    line(560, 430, 700, 380, 860, 445); line(1280, 700, 1420, 520);
    ell(935, 430, 215, 150, '#d9d9d9', 0.5); circle(780, 300, 74, '#ffffff'); circle(752, 282, 24, '#fff'); circle(752, 282, 7, '#000');
    g.fillStyle = '#ffa500'; g.fillRect(836, 262, 470, 42); g.strokeRect(836, 262, 470, 42);
    g.setLineDash([16, 12]); line(820, 600, 760, 282); line(985, 600, 760, 282); g.setLineDash([]);
    line(1000, 560, 1060, 790); line(1060, 560, 1150, 790); ell(1330, 780, 50, 14, '#777');
  } else {
    circle(560, 640, 110); circle(960, 668, 74); circle(1300, 610, 138);
    line(560, 640, 1300, 610); line(960, 668, 960, 300);
    ell(930, 560, 160, 96, '#ffffff', PI); circle(1090, 720, 60, '#ffffff'); circle(1108, 736, 8, '#000');
    tri(1130, 700, 1130, 745, 1400, 790, '#ffa500');
    ell(520, 262, 54, 16, '#777'); ell(700, 230, 54, 16, '#777'); line(1380, 330, 1560, 330); ell(1470, 318, 80, 18, '#222');
    line(880, 480, 850, 360); line(990, 480, 1020, 360); tri(826, 350, 874, 350, 850, 320, '#ffa500'); tri(996, 350, 1044, 350, 1020, 320, '#ffa500');
  }
  // selection box with handles, like an editor
  const boxes = [[728, 150 + 4, 458, 400], [690, 220, 640, 360], [450, 215, 1130, 580]][variant];
  const bx = [[728, 154, 458, 440], [690, 222, 640, 560], [440, 200, 1136, 616]][variant];
  g.strokeStyle = '#1c7cff'; g.lineWidth = 3; g.setLineDash([12, 8]); g.lineDashOffset = -Math.floor(u * 12) * 5; g.strokeRect(bx[0], bx[1], bx[2], bx[3]); g.setLineDash([]);
  for (const [hx, hy] of [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]]) { g.fillStyle = '#fff'; g.fillRect(bx[0] + bx[2] * hx - 9, bx[1] + bx[3] * hy - 9, 18, 18); g.strokeRect(bx[0] + bx[2] * hx - 9, bx[1] + bx[3] * hy - 9, 18, 18); }
  const cx = bx[0] + bx[2] + 40 - 30 * Math.sin(u * 5), cy = bx[1] + bx[3] - 20 + 16 * Math.cos(u * 4);
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + 58); g.lineTo(cx + 15, cy + 45); g.lineTo(cx + 27, cy + 70); g.lineTo(cx + 39, cy + 64); g.lineTo(cx + 27, cy + 40); g.lineTo(cx + 46, cy + 40); g.closePath(); g.fillStyle = '#000'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke();
  // validator readout
  const stats = [['FEET ON PEDALS: FALSE', 'WINGS ON BARS: FALSE', 'FRAME: ?'], ['FEET ON PEDALS: FALSE', 'CHAIN: ATTACHED TO FACE', 'WHEELS: MERGED'], ['FEET ON PEDALS: NOT FOUND', 'WHEELS: 3', 'RIDER: UPSIDE DOWN']][variant];
  g.fillStyle = '#1b1c23'; g.fillRect(150, 846, 1620, 54);
  stats.forEach((s, i) => strokeText(g, s, [182, 730, 1290][i], 873, 21, { color: '#ff6a6a', align: 'left', weight: 3.0 }));
  g.restore();
}
function svgCaption(g, u) {
  g.fillStyle = 'rgba(8,4,16,0.94)'; g.fillRect(0, 928, W, 152);
  slamText(g, 'EVERY MACHINE DREW IT WRONG.', 960, 1000, 82, u, 0.0, { from: 1.2, jolt: 6, drift: 0.006, track: 8 });
}
SHOTFN.svg = (F, u) => {
  const g = fxLayer(F); const v = Math.min(2, Math.floor(u / bt(2) + 1e-4)), lu = u - v * bt(2);
  g.save(); const s = 1 + 0.05 * pulse(lu, 0, 0.16) + lu * 0.016; g.translate(960, 500); g.scale(s, s); g.rotate((v - 1) * 0.006 * (1 - pulse(lu, 0, 0.2))); g.translate(-960, -500);
  drawBadSVG(freshCtx(svgCanvas), v, lu); g.drawImage(svgCanvas, 0, 0); g.restore();
  svgCaption(g, u);
  // the cracks arrive half a beat before the break
  const tc = bt(21.5) - bt(16);
  if (u > tc) {
    const r = rng(55); g.strokeStyle = '#17142e'; g.lineCap = 'round';
    for (let i = 0; i < 13; i++) { let x = 960, y = 470, a = i / 13 * TAU + r() * 0.4; const reach = (u - tc) / 0.19; g.lineWidth = 8; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { a += (r() - 0.5) * 0.8; const L = (60 + r() * 120) * clamp(reach * 1.6 - k * 0.1, 0, 1); x += Math.cos(a) * L; y += Math.sin(a) * L; g.lineTo(x, y); } g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.stroke(); g.strokeStyle = '#17142e'; }
  }
  F.post = { vig: 0.18, bloom: 0, grain: 0.012, shake: [fbm1(u * 50, 6) * 0.008 * pulse(u, tc, 0.18), 0, 1 + 0.015 * pulse(u, tc, 0.18), 0] };
};
const shatterSrc = mkCanvas();
SHOTFN.shatter = (F, u, ua) => {
  // behind the glass: the real one, charging straight at us
  const k = easeOut(clamp(u / 0.75));
  const c = cam([3.7 - 1.0 * k, 0.40 + 0.05 * k, 1.65 - 0.2 * k], [0.28, 1.02, 0.0], 31, -0.11);
  const r = ride(9, ua, { cadence: 9.5 });
  view3d(F, {
    cam: shake(c, u, 0.012, 22), env: { mode: 7, time: u, scroll: 9 * u, speed: 9, sun: [-0.62, 0.20, -0.76], dim: 0.9 }, light: Object.assign({}, LIGHT.sunset, { dir: [0.75, 0.45, 0.5] }),
    scene: (mb, out) => { hero(mb, out, { t: ua, wind: 1, neck: 'front', beakOpen: 0, scarf: { wind: 1, len: 1.25, lift: 0.42 }, crestRaise: 0.4, body: { bob: 0.008 * Math.sin(ua * 30) } }, r); buildRocks(mb, 9 * u, -3.6, 2.6, 5, 0.25, MAT.rock); }, eyes: { hero: { open: 1, brow: 1.1, glint: pulse(u, 0.42, 0.25) } }
  });
  const g = fxLayer(F);
  speedRadial(g, 900, 470, F.draw, { inner: 640, alpha: 0.55, n: 85, color: '#fff2d8' });
  { const sg = freshCtx(shatterSrc); drawBadSVG(sg, 2, bt(2)); svgCaption(sg, bt(6)); }
  if (u < 0.62) shatterDraw(g, shatterSrc, u + 0.055, 960, 470, 21);
  slamText(g, 'UNTIL NOW.', 960, 905, 170, u, bt(23) - bt(22), { from: 1.9, jolt: 26, layers: [['#14061c', 18], ['#ffb21e', 7], ['#14061c', 3]] });
  F.post = { vig: 0.38, bloom: 0.5, chroma: 2 * pulse(u, 0.05, 0.3) };
};

// ---------- ACT 2: training ----------
function stamp(g, a, b, u, t0 = 0.05) {
  if (u < t0) return; const k = easeOut(clamp((u - t0) / 0.2));
  g.save(); g.globalAlpha = k; g.translate(90 - (1 - k) * 60, 96);
  heavyText(g, a, 0, 0, 62, { align: 'left', skew: 0.18, layers: [['#14071c', 9]] });
  if (b) strokeText(g, b, 4, 70, 30, { align: 'left', color: '#ffd45e', outline: '#14071c', weight: 4.5, reveal: clamp((u - t0 - 0.1) / 0.3) });
  g.restore();
}
SHOTFN.wobble = (F, u, ua) => {
  const r = ride(2.6, ua, { cadence: 6.5 });
  const wob = Math.sin(ua * 10.5) * (0.07 + ua * 0.11);
  const c = lerpCam(cam([1.65, 1.12, 4.1], [0.12, 0.92, 0], 30, 0.02), cam([1.2, 1.0, 3.75], [0.10, 0.93, 0], 30, -0.04), clamp(u / 1.5));
  const v = view3d(F, {
    cam: shake(c, u, 0.012, 5), env: { mode: 1, time: u, scroll: 2.6 * u, speed: 2.6, sun: [-0.5, 0.42, -0.75] }, light: LIGHT.day,
    scene: (mb, out) => {
      const root = M4.chain(M4.T([Math.sin(ua * 7) * 0.05, 0, 0]), leanM(wob), M4.about([-0.41, 0, 0], M4.Ry(Math.sin(ua * 8.7) * 0.09)));
      const flail = Math.sin(ua * 26) * 0.5;
      hero(mb, out, { root, t: ua, wind: 0.25, neck: 'tall', head: { roll: -wob * 0.9, pitch: Math.sin(ua * 13) * 0.14, yaw: -0.25 }, beakOpen: 0.30 + 0.1 * Math.sin(ua * 19), crestRaise: 0.85, brow: -0.4, body: { pitch: 0.05 + Math.sin(ua * 9) * 0.06 }, wing: { l: { spread: 0.78, flap: 0.28 + flail }, r: {} }, scarf: { wind: 0.35 } }, r);
      buildGrassTufts(mb, 2.6 * u, -3.9, 0.42, 3); buildGrassTufts(mb, 2.6 * u, 1.85, 0.7, 13, 6); buildRocks(mb, 2.6 * u, -4.6, 3.1, 8, 0.22, MAT.rock);
    }, eyes: { hero: { open: 1, brow: -0.5, mode: 1, lookX: Math.sin(ua * 15) * 0.5 } }
  });
  const g = fxLayer(F); const h = v.P('head');
  sweatDrops(g, h[0] - 70, h[1] - 60, ua);
  for (let i = 0; i < 2; i++) { g.strokeStyle = '#fff'; g.lineWidth = 7; g.globalAlpha = 0.85; const p = v.P(i ? 'frontContact' : 'rearContact'); g.beginPath(); for (let k = 0; k < 14; k++) g.lineTo(p[0] - 90 - k * 30, p[1] + 4 + Math.sin(k * 1.5 + ua * 20 + i) * (6 + k)); g.stroke(); g.globalAlpha = 1; }
  stamp(typeLayer(F), 'ONE YEAR EARLIER', 'ATTEMPT 001', u);
  F.post = { vig: 0.22, bloom: 0.25 };
};

// crash kinematics: bike pitches over its front wheel, rider flies
SHOTFN.crash = (F, u, ua) => {
  const k = ua;
  const bikeRoot = M4.chain(M4.T([0.55 * k, Math.max(0, 0.75 * k - 1.2 * k * k), 0]), M4.about([0.62, 0.2, 0], M4.Rz(-Math.min(2.35, 3.9 * k))), leanM(0.35 * k));
  const rx = 0.55 + 2.15 * k, ry = Math.max(-0.50, 0.12 + 2.5 * k - 4.3 * k * k), spin = -Math.min(2.2, 3.3 * k);
  const riderRoot = M4.chain(M4.T([rx, ry, 0.30]), M4.about([-0.05, 1.1, 0], M4.chain(M4.Rz(spin), M4.Rx(0.22 * k))));
  const c = cam([1.15 + 0.45 * u, 0.82, 5.15 - 0.5 * u], [0.95 + 0.65 * u, 0.92, 0], 33, 0.18 - 0.1 * u);
  const v = view3d(F, {
    cam: shake(c, u, 0.05 * Math.max(pulse(u, 0, 0.3), pulse(u, 0.42, 0.3)), 24), env: { mode: 1, time: u + 1.5, scroll: 6.5 + 0.8 * u, sun: [-0.5, 0.42, -0.75] }, light: LIGHT.day, focus: [1.2, 0.7, 0], shadowSize: 2.6,
    scene: (mb, out) => {
      buildBike(mb, out, { root: bikeRoot, wheel: 18 * ua, crank: 0.8, blur: 0.9 });
      const f = (side, ph) => { const base = [-0.16 + side * 0.24 + 0.16 * Math.sin(ua * 19 + ph), 0.42 + 0.12 * Math.cos(ua * 15 + ph)]; return { pf: freeFoot(base, -0.5 + 0.7 * Math.sin(ua * 13 + ph), side * 0.24) }; };
      buildPelican(mb, out, { root: riderRoot, t: ua, wind: 1, neck: 'proud', head: { pitch: 0.18 * Math.sin(ua * 18), yaw: -0.2 }, beakOpen: 0.5, crestRaise: 1, brow: -0.4, squash: ua > 0.45 && ua < 0.58 ? 0.80 : 1, legs: { r: f(1, 0), l: f(-1, 2.4) }, wing: { r: { spread: 0.40, flap: -0.35 + Math.sin(ua * 22) * 0.30, noFingers: true }, l: { spread: 0.86, flap: 0.30 + Math.sin(ua * 22 + 2) * 0.35, noFingers: true } }, scarf: { wind: 0.8, lift: 0.7 } });
      buildRocks(mb, 6.5 + 0.8 * u, -4.2, 3.1, 8, 0.22, MAT.rock); buildGrassTufts(mb, 6.5 + 0.8 * u, -3.9, 0.42, 3);
    }, eyes: { hero: { open: 1, mode: 2, brow: -0.3 } }
  });
  const g = fxLayer(F);
  const gy = v.pt([1.2, 0, 0.1]);
  dustBurst(g, v.pt([0.9, 0.02, 0])[0], gy[1], u, 3, { s: 1.15, life: 0.95, n: 14 });
  dustBurst(g, v.pt([2.35, 0.02, 0.3])[0], gy[1] + 6, u - 0.47, 9, { s: 1.30, life: 0.6, n: 14 });
  const h = v.P('chest'); featherBurst(g, h[0], h[1], u - 0.05, 7, { n: 20 });
  if (u < 0.3) speedRadial(g, h[0], h[1], F.draw, { inner: 430, alpha: 0.6, color: '#fff' });
  sfxWord(g, 'KRASH!', 520, 250, 190, u - 0.12, { rot: -0.18, life: 0.62 });
  F.post = { vig: 0.3, bloom: 0.2, smear: u < 0.2 ? 0.035 : 0, smearDir: [1, -0.25] };
};

function brutalCard(F, u, word, sub, size = 330) {
  const g = fxLayer(F); cardBG(g, { t: u + 7, streak: 'rgba(90,80,140,0.28)' });
  // tally of falls scratched into the card
  g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 7; g.lineCap = 'round';
  for (let i = 0; i < 42; i++) { const gx = 150 + (i % 14) * 122, gy = 90 + Math.floor(i / 14) * 70 + (i >= 28 ? 760 : 0); for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(gx + k * 17 + hash2(i, k) * 5, gy); g.lineTo(gx + k * 17 - hash2(k, i) * 7, gy + 48); g.stroke(); } g.beginPath(); g.moveTo(gx - 8, gy + 38); g.lineTo(gx + 62, gy + 10); g.stroke(); }
  slamText(g, word, 960, sub ? 505 : 540, size, u, 0.0, { from: 1.9, jolt: 34, drift: 0.09 });
  if (sub) caption(g, sub, 760, u, 0.06, { size: 38, color: '#ff5a6a' });
  F.post = { vig: 0.5, bloom: 0.15, chroma: 1.8 * pulse(u, 0, 0.2) };
}
SHOTFN.fallcard = (F, u) => brutalCard(F, u, 'FALL.', 'ATTEMPT 214');
SHOTFN.againcard = (F, u) => brutalCard(F, u, 'AGAIN.', null, 300);

SHOTFN.rain = (F, u, ua) => {
  const spd = 6.5, r = ride(spd, ua, { cadence: 10.5 });
  const c = lerpCam(cam([3.05, 0.62, 2.35], [0.22, 0.90, 0], 31, -0.07), cam([2.35, 0.50, 2.2], [0.30, 0.86, 0], 31, -0.10), easeIn(clamp(u / 1.125)));
  const v = view3d(F, {
    cam: shake(c, u, 0.010, 14), env: { mode: 2, time: u, scroll: spd * u + 3, speed: spd }, light: LIGHT.rain,
    scene: (mb, out) => { hero(mb, out, { t: ua, wind: 0.4, neck: 'tuck', head: { pitch: -0.05 + 0.04 * Math.sin(ua * 13), dy: 0.012 * Math.sin(ua * 21) }, body: { bob: 0.014 * Math.abs(Math.sin(r.crank)), pitch: -0.05 }, scarf: { wind: 0.5, lift: -0.05 }, brow: 1 }, r); buildLamps(mb, spd * u + 3); }, eyes: { hero: { open: 0.72, brow: 1.05 } }
  });
  const g = fxLayer(F);
  const rc = v.P('rearContact'), fc = v.P('frontContact');
  sparks(g, u, { x: rc[0], y: rc[1] - 6, t0: -0.4, rate: 130, dir: -PI * 0.83, spread: 0.55, speed: 900, life: 0.34, width: 7, color: '#cfe6ff', color2: 'rgba(110,160,230,0.7)' });
  sparks(g, u, { x: fc[0], y: fc[1] - 4, t0: -0.4, rate: 60, dir: -PI * 0.72, spread: 0.9, speed: 600, life: 0.28, width: 5, color: '#cfe6ff', color2: 'rgba(110,160,230,0.7)' });
  rain(g, u + 0.4, { n: 620 });
  F.post = { vig: 0.45, bloom: 0.55, bloomThr: 0.78 };
};

SHOTFN.rainfall = (F, u, ua) => {
  const k = clamp(ua / 0.55);
  const lean = easeIn(clamp(ua / 0.34)) * 1.30;
  const slide = easeOut(clamp(ua / 0.75)) * 0.75;
  const root = M4.chain(M4.T([slide * 0.8, 0, 0]), leanM(-lean * 0.86), M4.about([0.62, 0, 0], M4.Ry(-0.55 * k)), M4.about([0.62, 0, 0], M4.Rz(-0.12 * Math.sin(k * PI))));
  const c = cam([2.5 + 0.25 * u, 0.85, 3.55 - 0.25 * u], [0.35 + 0.3 * u, 0.62, -0.1], 32, 0.13 + 0.05 * u);
  const v = view3d(F, {
    cam: shake(c, u, 0.045 * pulse(u, 0.22, 0.35), 25), env: { mode: 2, time: u + 2, scroll: 10.5 + 1.2 * slide, sun: [0.3, 0.3, -1] }, light: LIGHT.rain, focus: [0.4, 0.5, -0.2], shadowSize: 2.4,
    scene: (mb, out) => { hero(mb, out, { root, t: ua, wind: 0.6, neck: 'tall', head: { pitch: 0.2, roll: 0.45 * k }, beakOpen: 0.44, crestRaise: 0.7, brow: -0.4, wing: { l: { spread: 0.9, flap: 0.5 + 0.3 * Math.sin(ua * 24) }, r: { spread: 0.55 * k, flap: -0.2 } }, scarf: { wind: 0.4, lift: 0.5, floorY: 0.05 } }, { wheel: 20 + ua * 6, crank: 2.1, blur: 0.3 }); buildLamps(mb, 10.5 + 1.2 * slide); }, eyes: { hero: { open: 1, mode: 2, brow: -0.2 } }
  });
  const g = fxLayer(F);
  const p = v.pt([0.55 + slide * 0.7, 0.02, -0.1]);
  splash(g, p[0], p[1] + 20, u - 0.02, 5, { s: 1.35, life: 0.72 });
  splash(g, p[0] - 260, p[1] + 40, u - 0.26, 15, { s: 1.0, life: 0.6 });
  rain(g, u + 3, { n: 520 });
  sfxWord(g, 'SPLOOSH!', 1330, 245, 150, u - 0.08, { rot: 0.12, life: 0.58, fill: [[0, '#eaf8ff'], [1, '#6fbaff']] });
  F.post = { vig: 0.45, bloom: 0.45, bloomThr: 0.8 };
};

// face down on the wet road
function lyingScene(mb, out, ua, rise) {
  const drop = lerp(-0.80, -0.60, rise);
  const root = M4.chain(M4.T([0, drop, 0.06]), M4.about([-0.1, 1.0, 0], M4.Rz(lerp(-0.07, 0.05, rise))));
  buildBike(mb, out, { root: M4.chain(M4.T([-0.55, 0.035, -0.78]), leanM(-1.47), M4.Ry(0.28)), wheel: 2.2 + ua * 0.5, crank: 1.2, blur: 0 });
  const leg = (side, x, z) => ({ pf: freeFoot([x, 0.83 - rise * 0.17], -0.1, side * z) });
  buildPelican(mb, out, {
    root, t: ua * 0.55, wind: 0.14, neck: rise > 0 ? { a: 'slump', b: 'ride', k: rise } : 'slump', head: { dy: lerp(-0.185, 0.0, rise), dx: lerp(0.03, 0, rise), pitch: lerp(0.40, 0.05, rise) }, brow: 0.9,
    legs: { r: leg(1, -0.62, 0.22), l: leg(-1, -0.50, 0.24) }, scarf: { wind: 0.10, floorY: 0.83 - rise * 0.17, len: 1.05 },
    wing: { noFingers: true, r: { spread: 0.3, W: [0.46, 0.845 - rise * 0.17, 0.40], E: [0.12, 0.98 - rise * 0.08, 0.40] }, l: { spread: 0.3, W: [0.40, 0.83, -0.38], E: [0.08, 0.98, -0.36] } }
  });
}
SHOTFN.down = (F, u, ua) => {
  const tOpen = bt(40.5) - bt(38);
  const k = clamp((u - tOpen) / 0.09);
  const c = lerpCam(cam([1.82, 0.50, 1.55], [0.42, 0.34, 0.06], 29, -0.07), cam([1.36, 0.40, 1.05], [0.50, 0.37, 0.08], 25, -0.03), easeInOut(clamp(u / 1.5)));
  const v = view3d(F, {
    cam: shake(c, u, 0.012 * pulse(u, tOpen, 0.2), 25), env: { mode: 2, time: u + 5, scroll: 13, dim: 0.85 }, light: Object.assign({}, LIGHT.rain, { dir: [0.55, 0.65, 0.5] }), focus: [0.2, 0.3, 0], shadowSize: 1.6,
    scene: (mb, out) => lyingScene(mb, out, ua, 0), eyes: { hero: u < tOpen ? { open: 0, mode: 5, brow: -0.1 } : { open: Math.max(0.1, easeOutBack(k, 2)), mode: 0, brow: 1.15, glint: Math.max(0, 1 - (u - tOpen - 0.05) / 0.35), glow: 0.5 * k, glowCol: [1.0, 0.75, 0.2] } }
  });
  const g = fxLayer(F);
  const e = v.P('eyeR');
  if (u > tOpen + 0.03) glintStar(g, e[0] - 10, e[1] - 12, 150, Math.max(0, 1 - (u - tOpen - 0.03) / 0.4), '#fff6c8', u);
  for (let i = 0; i < 12; i++) { const ph = fract(u * 2.3 + hash2(i, 5)), x = 150 + hash2(i, 6) * 1620, y = 780 + hash2(i, 7) * 260; g.globalAlpha = 1 - ph; g.strokeStyle = '#cfe4ff'; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, 8 + ph * 46, (8 + ph * 46) * 0.28, 0, 0, TAU); g.stroke(); }
  g.globalAlpha = 1;
  rain(g, u + 6, { n: 460, alpha: 0.85 });
  F.post = { vig: 0.55, bloom: 0.45, bloomThr: 0.8 };
};

SHOTFN.slam = (F, u, ua) => {
  const hit = clamp(ua / 0.09);
  const rise = easeInOut(clamp((ua - 0.30) / 0.45));
  const wy = lerp(0.36, 0.045, easeIn(hit));
  const c = cam([1.55, 0.36 + 0.28 * rise, 1.62], [0.40, 0.24 + 0.22 * rise, 0.22], 29, 0.12 - 0.08 * rise);
  const v = view3d(F, {
    cam: shake(c, u, 0.05 * pulse(u, 0.07, 0.3), 26), env: { mode: 2, time: u + 8, scroll: 13 }, light: Object.assign({}, LIGHT.rain, { dir: [0.55, 0.65, 0.5] }), focus: [0.3, 0.3, 0.1], shadowSize: 1.4,
    scene: (mb, out) => {
      const drop = lerp(-0.78, -0.52, rise);
      const root = M4.chain(M4.T([0, drop, 0.06]), M4.about([-0.1, 1.0, 0], M4.Rz(lerp(-0.02, 0.17, rise))));
      const inv = -drop;
      buildPelican(mb, out, {
        root, t: ua * 0.6, wind: 0.2, neck: { a: 'slump', b: 'ride', k: 0.35 + 0.65 * rise }, head: { dy: lerp(-0.09, 0.02, rise), pitch: lerp(0.25, 0.02, rise) },
        legs: { r: { pf: freeFoot([-0.55, 0.04 + inv], -0.1, 0.22) }, l: { pf: freeFoot([-0.32, 0.04 + inv], -0.2, -0.22) } }, scarf: { wind: 0.2, floorY: 0.03 + inv },
        wing: { r: { spread: 0.46, W: [0.56, wy + inv - rise * 0.0, 0.40], E: [0.25, lerp(0.40, 0.30, rise) + inv, 0.42], noFingers: true }, l: { spread: 0.2, W: [0.40, 0.05 + inv, -0.35], E: [0.10, 0.3 + inv, -0.36], noFingers: true } }
      });
      buildBike(mb, out, { root: M4.chain(M4.T([-0.62, 0.035, -0.85]), leanM(-1.47), M4.Ry(0.28)), wheel: 1.7, crank: 1.2 });
    }, eyes: { hero: { open: 0.9, brow: 1.2, glow: 0.45, glowCol: [1.0, 0.72, 0.2] } }
  });
  const g = fxLayer(F);
  const w = v.pt([0.62, 0.02, 0.46]);
  splash(g, w[0], w[1] + 10, u - 0.07, 25, { s: 0.95, life: 0.65 });
  shockRing(g, w[0], w[1] + 20, u - 0.07, { r: 700, flat: 0.26, color: '#d8ecff', w: 30 });
  if (u > 0.06 && u < 0.3) speedRadial(g, w[0], w[1], F.draw, { inner: 520, alpha: 0.4, color: '#dbeeff' });
  rain(g, u + 9, { n: 420, alpha: 0.8 });
  sfxWord(g, 'WHAM!', 420, 215, 160, u - 0.08, { rot: -0.14, life: 0.5 });
  F.post = { vig: 0.5, bloom: 0.45, bloomThr: 0.8 };
};

SHOTFN.scarf = (F, u, ua) => {
  const tSnap = bt(46) - bt(44);
  const tied = clamp((ua - tSnap) / 0.12);
  const tug = u < tSnap ? Math.sin(clamp(u / tSnap) * PI * 3) * 0.5 + 0.5 : 0;
  const k = easeOut(clamp(u / 1.5));
  const c = lerpCam(cam([1.75, 0.92, 2.05], [0.14, 1.28, 0], 29, -0.05), cam([1.35, 0.86, 2.55], [0.00, 1.27, 0], 31, 0.03), k);
  const v = view3d(F, {
    cam: shake(c, u, 0.022 * pulse(u, tSnap, 0.3), 20), env: { mode: 4, time: u, scroll: 1.0, sun: [-0.72, 0.045 + 0.05 * k, -0.7], dim: lerp(0.52, 0.9, clamp(u / 1.4)) }, light: LIGHT.dawn, focus: [0, 1.15, 0],
    scene: (mb, out) => {
      const N = neckPose('proud'); const kn = [0.13 + 0.025 * tug, 1.305, 0.0];
      const w = u < tSnap + 0.05 ? { noFingers: false, r: { spread: 0.04, W: [kn[0] + 0.14 + 0.05 * tug, kn[1] - 0.02, 0.10 + 0.05 * tug], E: [0.12, 1.10, 0.34], noFingers: true }, l: { spread: 0.04, W: [kn[0] + 0.12 + 0.05 * tug, kn[1] - 0.03, -0.10 - 0.05 * tug], E: [0.12, 1.10, -0.34], noFingers: true } } : {};
      hero(mb, out, { t: ua, wind: 0.25 + 0.75 * tied, neck: 'proud', head: { yaw: -0.12, pitch: u < tSnap ? -0.16 : 0.03 }, wing: w, scarf: { wind: lerp(0.14, 1.0, tied), len: lerp(0.62, 1.38, easeOutBack(tied, 2.2)), lift: lerp(0.0, 0.34, tied) }, crestRaise: 0.25 * tied, brow: 1 }, { wheel: 0.4, crank: 0.5 });
      // tying it: one end in each wingtip, hauled tight until the knot bites
      if (u < tSnap + 0.05) for (const sd of [1, -1]) {
        const hand = [kn[0] + (sd > 0 ? 0.185 : 0.165) + 0.075 * tug, kn[1] + (sd > 0 ? -0.005 : -0.015), sd * (0.125 + 0.085 * tug)];
        const neckAt = [0.222, 1.262, sd * 0.055];
        const Lp = [], Rp = [];
        for (let i = 0; i <= 12; i++) { const s = i / 12; const q = vlerp(neckAt, hand, s); q[1] -= 0.030 * Math.sin(PI * s) * (1 - tug); Lp.push(add(q, [0, 0.036, 0.004 * sd])); Rp.push(add(q, [0, -0.036, -0.004 * sd])); }
        mb.ribbon(Lp, Rp, { mat: MAT.scarf, part: sd > 0 ? 46 : 47, lw: 1.15 });
        const end = add(hand, [0.035, -0.165, sd * 0.035 + Math.sin(ua * 14 + sd) * 0.012]);
        mb.ribbon([add(hand, [0.012, 0.030, 0]), vlerp(hand, end, 0.5), add(end, [0.030, 0, 0])], [add(hand, [-0.022, -0.018, 0]), add(vlerp(hand, end, 0.5), [-0.045, -0.006, 0]), add(end, [-0.038, -0.020, 0])], { mat: MAT.scarf, part: sd > 0 ? 48 : 49, lw: 1.15 });
        mb.sphere(hand, 0.030, { mat: MAT.wingBlack, part: sd > 0 ? 19 : 59 });
      }
    }, eyes: { hero: u < tSnap ? { open: 0, mode: 5 } : { open: 1, brow: 1.05, glint: pulse(u, tSnap + 0.05, 0.35) } }
  });
  const g = fxLayer(F);
  if (u >= tSnap) { const kn = v.P('knot'); shockRing(g, kn[0], kn[1], u - tSnap, { r: 760, color: '#ffd9c0', w: 24 }); speedH(g, u, 12, { n: 44, alpha: 0.5, dir: -1, color: '#ffe6d0', y0: 0, y1: 700 }); }
  featherBurst(g, 2050, 80, u - 0.2, 31, { n: 9, wind: -980, gravity: 70 });
  slamText(typeLayer(F), 'GET UP.', 430, 925, 170, u, tSnap + 0.06, { layers: [['#1c0820', 17]], from: 1.8 });
  F.post = { vig: 0.38, bloom: 0.42, bloomThr: 0.90, con: 1.05 };
};

// three diagonal panels
SHOTFN.split = (F, u, ua) => {
  const polys = [[[0, 0], [0.405, 0], [0.285, 1], [0, 1]], [[0.405, 0], [0.745, 0], [0.625, 1], [0.285, 1]], [[0.745, 0], [1, 0], [1, 1], [0.625, 1]]];
  const centers = [0.18, 0.515, 0.82];
  const r = ride(8, ua, { cadence: 11 });
  const g = fxLayer(F);
  for (let i = 0; i < 3; i++) {
    const ti = i * BE; if (u < ti) continue;
    const k = easeOutBack(clamp((u - ti) / 0.17), 1.5);
    const off = [0, (i === 1 ? -1 : 1) * (1 - k) * 1.0];
    const poly = polys[i].map(([x, y]) => [x, y + off[1]]);
    const lu = u - ti, drift = lu * 0.03;
    let c, env, light, sc, eyes;
    if (i === 0) { const N = neckPose('tuck'); c = cam([1.20 - drift, 1.34, 0.92], [N.H[0] + 0.05, N.H[1] - 0.015, 0], 25, -0.08); env = { mode: 3, time: u, scroll: 8 * u, speed: 8, sun: [0.4, 0.5, -0.8] }; light = LIGHT.night; eyes = { hero: { open: 0.8, brow: 1.2, glint: pulse(lu, 0.14, 0.3) } }; }
    else if (i === 1) { c = cam([0.55 - drift, 0.62, 1.55], [0.02, 0.43, 0.05], 33, 0.08); env = { mode: 3, time: u + 2, scroll: 8 * u + 4, speed: 8 }; light = Object.assign({}, LIGHT.night, { lit: [1.1, 0.95, 0.74] }); eyes = { hero: { brow: 1 } }; }
    else { c = cam([-0.95 + drift, 0.40, 1.12], [-0.38, 0.30, 0], 36, -0.12); env = { mode: 3, time: u + 4, scroll: 8 * u + 9, speed: 8 }; light = LIGHT.night; eyes = { hero: { brow: 1 } }; }
    const centre = centers[i] - 0.5;
    view3d(F, {
      cam: shake(c, u, 0.006, 19), env, light, poly, offset: [centre, -off[1]], zoom: 1.0, chainBlur: 0.5,
      scene: (mb, out) => hero(mb, out, { t: ua, wind: 0.6, neck: 'tuck', body: { bob: 0.012 * Math.abs(Math.sin(r.crank)) }, brow: 1, scarf: { wind: 0.7 } }, r), eyes
    });
  }
  for (let i = 0; i < 3; i++) { const ti = i * BE; if (u < ti) continue; const k = easeOutBack(clamp((u - ti) / 0.17), 1.5); const oy = (i === 1 ? -1 : 1) * (1 - k); panelBorder(g, polys[i].map(([x, y]) => [x, y + oy]), 10); }
  speedH(g, u, 22, { n: 18, alpha: 0.4, y0: 820, y1: 1060, color: '#bcd0ff' });
  F.post = { vig: 0.25, bloom: 0.5, bloomThr: 0.78 };
};

SHOTFN.night = (F, u, ua) => {
  const spd = 9, scroll = spd * u + 2.2;
  const r = ride(spd, ua, { cadence: 11.5 });
  // key light swings with each passing lamp
  const sp = 9; const lx = (Math.round(scroll / sp) * sp) - scroll;
  const ldir = norm([lx * 0.55, 2.4, -1.1 + 2.0]);
  const near = Math.exp(-lx * lx / 5);
  const c = lerpCam(cam([2.85, 0.42, 2.55], [0.16, 0.86, 0], 31, -0.08), cam([1.2, 0.55, 3.45], [0.06, 0.90, 0], 31, -0.02), easeInOut(clamp(u / 1.5)));
  const v = view3d(F, {
    cam: shake(c, u, 0.008, 12), env: { mode: 3, time: u, scroll, speed: spd, sun: [0.55, 0.38, -0.74] },
    light: { dir: ldir, lit: vlerp([0.66, 0.64, 0.86], [1.14, 0.96, 0.70], near), shade: LIGHT.night.shade, rim: LIGHT.night.rim, rimDir: LIGHT.night.rimDir, rimAmt: 0.95 },
    scene: (mb, out) => { hero(mb, out, { t: ua, wind: 0.6, neck: { a: 'tuck', b: 'ride', k: 0.35 }, body: { bob: 0.014 * Math.abs(Math.sin(r.crank)) }, brow: 1, scarf: { wind: 0.8, len: 1.15 } }, r); buildLamps(mb, scroll); }, eyes: { hero: { open: 0.86, brow: 1.1 } }
  });
  const g = fxLayer(F);
  speedH(g, u, 31, { n: 22, alpha: 0.28, color: '#b8c8ff', y0: 700, y1: 1060, v: 4200 });
  sweatDrops(g, v.P('head')[0] - 90, v.P('head')[1] - 40, ua + 0.2);
  F.post = { vig: 0.45, bloom: 0.62, bloomThr: 0.76 };
};

SHOTFN.dawn = (F, u, ua) => {
  const spd = 7.5, r = ride(spd, ua, { cadence: 9.0 });
  const k = easeInOut(clamp(u / 3.0));
  const c = lerpCam(cam([1.35, 0.55, 2.7], [0.20, 1.05, 0], 31, -0.06), cam([-0.15, 1.04, 5.05], [0.05, 0.97, 0], 30, 0.0), k);
  const v = view3d(F, {
    cam: c, env: { mode: 4, time: u + 2, scroll: spd * u, speed: spd, sun: [lerp(-0.86, -0.64, k), 0.05 + 0.03 * k, -0.76], dim: 0.88 }, light: LIGHT.dawn,
    scene: (mb, out) => { hero(mb, out, { t: ua, wind: 0.78, neck: { a: 'ride', b: 'proud', k: smooth(0.3, 1.4, ua) }, head: { pitch: 0.02 * Math.sin(ua * 3) }, body: { bob: 0.006 * Math.sin(r.crank * 2) }, brow: 0.8, crestRaise: 0.2, scarf: { wind: 0.95, len: 1.35, lift: 0.22 } }, r); buildGrassTufts(mb, spd * u, -4.0, 0.9, 41, 14); }, eyes: { hero: u > 1.9 && u < 2.9 ? { open: 1, mode: 5 } : { open: 0.85, brow: 0.8, glint: pulse(u, 2.9, 0.1) } }
  });
  const g = fxLayer(F);
  featherBurst(g, 1900, 420, u - 0.3, 77, { n: 10, wind: -760, gravity: 40, s: 0.8 });
  speedH(g, u, 44, { n: 13, alpha: 0.35, color: '#fff0dc', y0: 90, y1: 1000, v: 2600, len: 520 });
  const t2 = bt(61) - bt(56), tx = typeLayer(F);
  if (u >= bt(58) - bt(56)) slamText(tx, '1,000 FALLS.', 960, 160, 128, u, bt(58) - bt(56), { from: 1.35, jolt: 8, drift: 0.012, layers: [['#24102a', 13]] });
  if (u >= t2) slamText(tx, 'ONE RIDER.', 960, 930, 170, u, t2, { from: 1.6, jolt: 14, drift: 0.016, fill: [[0, '#fff6d0'], [1, '#ffb02a']], layers: [['#24102a', 17]] });
  F.post = { vig: 0.34, bloom: 0.42, bloomThr: 0.91, con: 1.07, sat: 1.12 };
};
