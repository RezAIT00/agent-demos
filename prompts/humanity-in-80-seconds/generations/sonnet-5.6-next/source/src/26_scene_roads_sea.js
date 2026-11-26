// 38.3 - 42.1 s : the long road.   42.1 - 45 s : the open ocean.
(() => {
  const camX = (t) => (t - 38.0) * 300 + 130 * ramp(39.5, 41.6, t);
  const FAR = 0.58;

  function temple(c, x, y, s) {
    c.fillStyle = '#d8b48c';
    c.fillRect(x - s * 1.08, y - 14, s * 2.16, 14); c.fillRect(x - s, y - 28, s * 2, 14);
    for (let i = 0; i < 7; i++) {
      const px = x - s * 0.86 + i * s * 0.2867;
      c.fillStyle = '#e2c29a'; fillPoly(c, [[px - 9, y - 28], [px - 7, y - s * 1.02], [px + 7, y - s * 1.02], [px + 9, y - 28]]);
      c.fillStyle = '#b08a68'; c.fillRect(px + 2, y - s * 1.0, 3, s * 1.0 - 30);
      c.fillStyle = '#e2c29a'; c.fillRect(px - 13, y - s * 1.02 - 7, 26, 8);
    }
    c.fillStyle = '#cfa882'; c.fillRect(x - s, y - s * 1.02 - 28, s * 2, 22);
    c.fillStyle = '#b9876a'; fillPoly(c, [[x - s * 1.05, y - s * 1.02 - 28], [x, y - s * 1.40 - 28], [x + s * 1.05, y - s * 1.02 - 28]]);
  }
  function aqueduct(c, x0, x1, y, h, col) {
    c.fillStyle = col; c.fillRect(x0, y - h, x1 - x0, 20);
    for (let x = x0; x < x1; x += 74) {
      c.fillRect(x, y - h, 17, h + 4);
      c.beginPath(); c.moveTo(x + 17, y - h + 18); c.lineTo(x + 74, y - h + 18); c.lineTo(x + 74, y - h + 56); c.arc(x + 45.5, y - h + 56, 28.5, 0, PI, true); c.closePath(); c.fill();
    }
  }
  function wallAndTowers(c, x, y, col) {
    const line = (u) => y - 70 - Math.sin(u * PI * 2.2) * 46 - u * 40;
    c.fillStyle = col;
    c.beginPath(); c.moveTo(x - 420, y + 40);
    for (let i = 0; i <= 60; i++) { const u = i / 60; c.lineTo(x - 420 + u * 840, line(u)); }
    c.lineTo(x + 420, y + 40); c.fill();
    c.strokeStyle = '#a8785c'; c.lineWidth = 17; c.beginPath();
    for (let i = 0; i <= 60; i++) { const u = i / 60; i ? c.lineTo(x - 420 + u * 840, line(u) - 7) : c.moveTo(x - 420, line(0) - 7); } c.stroke();
    c.fillStyle = '#a8785c'; for (let i = 0; i <= 60; i++) { const u = i / 60; c.fillRect(x - 423 + u * 840, line(u) - 24, 7, 10); }
    for (const u of [0.12, 0.40, 0.70, 0.93]) {
      const tx = x - 420 + u * 840, ty = line(u);
      c.fillStyle = '#9c6c52'; c.fillRect(tx - 24, ty - 64, 48, 72);
      c.fillStyle = '#6b3c30'; c.fillRect(tx - 7, ty - 50, 14, 22);
      c.fillStyle = '#7a4636'; fillPoly(c, [[tx - 42, ty - 62], [tx, ty - 96], [tx + 42, ty - 62], [tx + 28, ty - 66], [tx - 28, ty - 66]]);
    }
  }
  function mayaPyramid(c, x, y, s) {
    for (let i = 0; i < 7; i++) {
      const w = s * (2.0 - i * 0.22), h = s * 0.19;
      c.fillStyle = i % 2 ? '#b6a088' : '#c4ae94';
      fillPoly(c, [[x - w / 2, y - i * h], [x - w / 2 + 11, y - (i + 1) * h], [x + w / 2 - 11, y - (i + 1) * h], [x + w / 2, y - i * h]]);
    }
    c.fillStyle = '#d2bda2'; fillPoly(c, [[x - s * 0.22, y], [x - s * 0.12, y - s * 1.33], [x + s * 0.12, y - s * 1.33], [x + s * 0.22, y]]);
    c.strokeStyle = '#a48e78'; c.lineWidth = 2; for (let k = 10; k < s * 1.33; k += 12) { c.beginPath(); c.moveTo(x - s * 0.21 + k * 0.07, y - k); c.lineTo(x + s * 0.21 - k * 0.07, y - k); c.stroke(); }
    c.fillStyle = '#cbb69c'; c.fillRect(x - s * 0.34, y - s * 1.33 - s * 0.34, s * 0.68, s * 0.34);
    c.fillStyle = '#6a4c40'; c.fillRect(x - s * 0.08, y - s * 1.33 - s * 0.22, s * 0.16, s * 0.22);
    c.fillStyle = '#b6a088'; c.fillRect(x - s * 0.26, y - s * 1.33 - s * 0.58, s * 0.52, s * 0.24);
  }
  function canopy(c, x0, x1, y, col, seed, r0 = 34) {
    c.fillStyle = col;
    const r = rng(seed);
    for (let x = x0; x < x1; x += 26) { disc(c, x + r() * 20, y + r() * 22 - 6, r0 * (0.55 + r() * 0.7)); }
    c.fillRect(x0, y, x1 - x0, 80);
  }
  function banyan(c, x, y, t) {
    c.fillStyle = '#3a2316';
    chain(c, [[x, y + 8, 42], [x - 6, y - 150, 26], [x - 30, y - 300, 16]]);
    for (const [bx, by] of [[-200, -330], [-90, -400], [70, -390], [190, -310], [-250, -260], [140, -240]]) chain(c, [[x - 6, y - 180, 19], [x + bx * 0.6, y + by * 0.88, 11], [x + bx, y + by, 6]]);
    c.strokeStyle = '#3a2316'; c.lineWidth = 3.4;
    for (let i = 0; i < 13; i++) { const rx = x - 210 + i * 34 + hash(i) * 15; if (Math.abs(rx - x) < 55) continue; c.beginPath(); c.moveTo(rx, y - 270 + hash(i + 3) * 40); c.quadraticCurveTo(rx + Math.sin(t + i) * 7, y - 150, rx + (hash(i + 5) - 0.5) * 18, y - 20 - hash(i + 7) * 130); c.stroke(); }
    const r = rng(6);
    for (let i = 0; i < 190; i++) {
      const a = r() * TAU, d = Math.sqrt(r());
      c.fillStyle = r() < 0.5 ? '#43361a' : '#524020';
      oval(c, x - 20 + Math.cos(a) * d * 300 + Math.sin(t * 1.3 + i) * 2, y - 370 + Math.sin(a) * d * 128, 38 + r() * 30, 19 + r() * 15, (r() - 0.5) * 0.7);
    }
  }

  defineScene('roads', 38.3, { kind: 'pan', dur: 0.8 }, (S) => {
    const { t, env, back, far, near, glow: g } = S;
    const cx = camX(t);
    const d = ramp(38.4, 42.3, t);
    env.sky = {
      top: M('#2f6aa8', '#35558c', d), mid: M('#94b8cc', '#c49a98', d), low: M('#f6e2b8', '#ffc27e', d), ground: '#9a6648',
      horizon: 740, midAt: 0.6, cloud: 0.46, cloudColor: M('#eed4c0', '#e8a88c', d),
      sun: { x: 1620 - cx * 0.04, y: 290 + d * 150, r: 40, color: M('#fff0c8', '#ffd090', d), glow: 90, k: 0.68 * ramp(38.45, 38.95, t) * (1 - ramp(41.45, 41.85, t)) + 0.001 },
    };
    env.haze = { color: '#e6bd9c', amt: 0.16 };
    env.skyRim = '#ffdca8'; env.skyRimAmt = 0.3;
    const fx = (wx) => wx - cx * FAR;
    ridge(far, { y: 655, amp: 90, freq: 0.0017, seed: 101, scroll: cx * 0.1, color: '#a8869a' });
    ridge(far, { y: 725, amp: 44, freq: 0.0029, seed: 102, scroll: cx * 0.22, color: '#a8785c' });

    // Mediterranean stone
    aqueduct(far, fx(230), fx(760), 792, 150, '#c9a07c');
    temple(far, fx(975), 792, 132);
    // China: wall and watchtowers over the ridges
    wallAndTowers(far, fx(1560), 792, '#8a6450');
    // the Maya lowlands
    const mx = fx(2190);
    canopy(far, mx - 520, mx + 520, 756, '#46603e', 31, 38);
    mayaPyramid(far, mx + 10, 796, 168);
    canopy(far, mx - 560, mx + 560, 800, '#32482e', 32, 30);

    // the road
    const gy = (x) => 884 + (fbm1((x + cx) * 0.0021, 104, 3) - 0.5) * 30;
    near.fillStyle = vgrad(near, 860, H, [[0, '#6e3f28'], [0.35, '#472618'], [1, '#1a0c0a']]);
    near.beginPath(); near.moveTo(-60, H + 40); for (let x = -60; x <= W + 60; x += 14) near.lineTo(x, gy(x)); near.lineTo(W + 60, H + 40); near.fill();
    near.strokeStyle = 'rgba(214,150,96,0.35)'; near.lineWidth = 5; near.setLineDash([38, 26]); near.lineDashOffset = cx;
    near.beginPath(); near.moveTo(-40, 1000); near.lineTo(W + 40, 1000); near.stroke(); near.setLineDash([]);

    const nx = (wx) => wx - cx;
    // a caravan going the same way, lamp lit at its head
    const pace = (t - 38) * 272;
    const lead = nx(790) + pace;
    for (let i = 0; i < 4; i++) {
      const x = lead - 130 - i * 262, ph = t * 1.1 + i * 0.27;
      const y = gy(x) + 30;
      near.fillStyle = '#34180f';
      FIG.camel(near, x, y, 205 - (i % 2) * 14, ph, '#34180f');
      near.fillStyle = ['#a03a24', '#c08a3c', '#6c2c36', '#b06a2c'][i];
      blob(near, [[x - 62, y - 158], [x - 30, y - 196], [x + 14, y - 190], [x + 36, y - 152], [x + 8, y - 128], [x - 44, y - 130]], 0.7);
      if (i % 2) FIG.person(near, { x: x - 6, y: y - 118, h: 150, color: '#34180f', cloth: '#8a3422', dress: 'robe', hat: 'wrap', p: FIG.sit({ hip: [0, 0.4], footA: [0.14, 0.18], footB: [0.1, 0.2], handA: [0.2, 0.55], handB: [0.18, 0.55] }) });
    }
    const walker = FIG.person(near, { x: lead + 70, y: gy(lead + 70) + 34, h: 262, color: '#3c1c10', far: '#28120c', cloth: '#7a2c1e', dress: 'robe', hat: 'wrap', wind: 0.2, t, p: FIG.walk(pace / (FIG.cycleLength(0.3) * 262) + (t - 38) * 0.4, { stride: 0.3, over: { handA: [0.25, 0.58] } }) });
    // the lantern on its staff keeps the flame with us
    const lx = walker.handA[0] + 12, ly = walker.handA[1] + 34;
    near.strokeStyle = '#2a140c'; near.lineWidth = 6; near.beginPath(); near.moveTo(walker.handA[0] - 8, walker.handA[1] - 4); near.lineTo(lx, ly - 24); near.stroke();
    near.fillStyle = '#2a140c'; fillPoly(near, [[lx - 20, ly - 24], [lx + 20, ly - 24], [lx + 13, ly - 36], [lx - 13, ly - 36]]); near.fillRect(lx - 18, ly + 22, 36, 8);
    g.fillStyle = 'rgba(255,190,96,0.88)'; blob(g, [[lx - 14, ly - 22], [lx + 14, ly - 22], [lx + 20, ly], [lx + 14, ly + 22], [lx - 14, ly + 22], [lx - 20, ly]], 0.5);
    glow(g, lx, ly, 120, '#ffa23c', 0.42 * flick(t, 18));
    env.lights.push({ x: lx, y: ly, r: 270, i: 0.42, color: '#ffa244' });

    // a teacher under a banyan, children listening
    const bx = nx(2140);
    if (bx > -500 && bx < W + 500) {
      banyan(near, bx, 936, t);
      FIG.person(near, { x: bx - 96, y: 962, h: 320, color: '#3a1b10', far: '#26110b', cloth: '#9a6232', dress: 'robe', hair: 'short', t, p: FIG.sit({ hip: [-0.03, 0.15], lean: 0.05, handA: [0.24, 0.43 + Math.sin(t * 2.6) * 0.04], handB: [0.14, 0.26] }) });
      [[100, 205, 0], [196, 178, 1], [282, 196, 2]].forEach(([dx, h, i]) => FIG.person(near, { x: bx + dx, y: 968 + i * 9, h, face: -1, child: 0.8, color: '#3a1b10', cloth: ['#a8402a', '#c8a878', '#7a3a30'][i], dress: 'tunic', hair: i === 1 ? 'bun' : 'short', p: FIG.sit({ lean: 0.1 + 0.05 * Math.sin(t * 1.6 + i), handA: [0.18, 0.22], tilt: -0.2 }) }));
    }
    // a porter and a potter further along
    const porter = (wx, h, ph, face) => {
      const x = nx(wx) + face * (t - 38) * 60;
      if (x < -200 || x > W + 200) return;
      const f = FIG.person(near, { x, y: gy(x) + 54, h, face, color: '#3c1c10', cloth: '#b8905c', dress: 'tunic', hat: 'conical', t, p: FIG.walk(t * 1.2 + ph, { lean: 0.12, stride: 0.3, over: { handA: [0.10, 0.80], handB: [-0.14, 0.78] } }) });
      near.strokeStyle = '#2c160c'; near.lineWidth = 6; near.beginPath(); near.moveTo(f.shoulder[0] - 92, f.shoulder[1] - 8); near.lineTo(f.shoulder[0] + 92, f.shoulder[1] - 8); near.stroke();
      near.fillStyle = '#7a3c1c'; for (const s of [-1, 1]) { blob(near, [[f.shoulder[0] + s * 90 - 24, f.shoulder[1] + 36], [f.shoulder[0] + s * 90 - 19, f.shoulder[1] + 74], [f.shoulder[0] + s * 90 + 19, f.shoulder[1] + 74], [f.shoulder[0] + s * 90 + 24, f.shoulder[1] + 36]], 0.7); near.fillRect(f.shoulder[0] + s * 90 - 2, f.shoulder[1] - 8, 3, 46); }
    };
    porter(3050, 280, 0.4, -1);
    porter(1500, 246, 0.9, 1);

    PROPS.grass(near, t, { y: 1030, n: 40, h: 46, color: '#1a0b08', seed: 111, scroll: cx * 1.3, x1: W + 300, spreadY: 60 });
    env.lights.push({ x: 1620 - cx * 0.04, y: 330 + d * 150, r: 1500, i: 0.22, color: '#ffc078' });
    env.rim = 0.95; env.bloom = 0.22; env.thresh = 0.92; env.vig = 0.22;
  });

  // ---- the Pacific -------------------------------------------------------
  function seaLayers(far, near, g, t, sunX, scroll, d) {
    const HZ = 704;
    far.fillStyle = vgrad(far, HZ, H, [[0, M('#d08a6c', '#5a4a72', d)], [0.12, M('#7c5a6e', '#2c3358', d)], [0.55, '#14203c'], [1, '#060b18']]);
    far.fillRect(-40, HZ, W + 80, H - HZ + 40);
    // the road of light on the water
    for (let i = 0; i < 230; i++) {
      const dep = Math.pow(hash(i + 3), 1.7);
      const y = HZ + 4 + dep * 370;
      const spread = 24 + dep * 420;
      const x = sunX + (hash(i + 9) - 0.5) * spread * (0.5 + hash(i + 11)) + Math.sin(t * 2 + i) * 6;
      const w = (8 + dep * 54) * (0.4 + hash(i + 13));
      const on = Math.sin(t * (2 + hash(i) * 4) + i * 7);
      if (on < -0.2) continue;
      far.fillStyle = rgb(mixc([255, 196, 120], [186, 150, 200], d), (0.62 - dep * 0.32) * clamp(on + 0.4) * (1 - d * 0.55));
      oval(far, x, y, w / 2, 1.2 + dep * 2.6);
    }
  }
  function swell(c, t, y, amp, speed, color, phase, scroll) {
    c.fillStyle = color;
    c.beginPath(); c.moveTo(-60, H + 60);
    for (let x = -60; x <= W + 60; x += 16) {
      c.lineTo(x, y + Math.sin((x + scroll) * 0.0062 + t * speed + phase) * amp + Math.sin((x + scroll) * 0.017 - t * speed * 1.4 + phase) * amp * 0.34);
    }
    c.lineTo(W + 60, H + 60); c.fill();
  }
  function canoe(c, g, x, y, s, t, env) {
    const bob = Math.sin(t * 2.1) * 6, roll = Math.sin(t * 2.1 + 1.2) * 0.022;
    c.save(); c.translate(x, y + bob); c.rotate(roll); c.scale(s, s);
    const dark = '#150d14';
    // crab-claw sails
    const sail = (mx, my, k, col) => {
      c.fillStyle = col;
      c.beginPath(); c.moveTo(mx, my);
      c.bezierCurveTo(mx - 60 * k, my - 150 * k, mx - 150 * k, my - 300 * k, mx - 195 * k, my - 372 * k);
      c.bezierCurveTo(mx - 52 * k, my - 270 * k, mx + 28 * k, my - 268 * k, mx + 142 * k, my - 350 * k);
      c.bezierCurveTo(mx + 118 * k, my - 250 * k, mx + 74 * k, my - 120 * k, mx, my);
      c.fill();
      c.strokeStyle = dark; c.lineWidth = 6 * k; c.lineCap = 'round';
      c.beginPath(); c.moveTo(mx, my); c.bezierCurveTo(mx - 60 * k, my - 150 * k, mx - 150 * k, my - 300 * k, mx - 195 * k, my - 372 * k); c.stroke();
      c.beginPath(); c.moveTo(mx, my); c.bezierCurveTo(mx + 74 * k, my - 120 * k, mx + 118 * k, my - 250 * k, mx + 142 * k, my - 350 * k); c.stroke();
      c.lineWidth = 1.5 * k; c.strokeStyle = 'rgba(30,14,22,0.55)';
      for (let i = 1; i < 8; i++) { c.beginPath(); c.moveTo(mx - i * 22 * k, my - i * 44 * k); c.quadraticCurveTo(mx, my - i * 40 * k, mx + i * 17 * k, my - i * 42 * k); c.stroke(); }
    };
    sail(190, -52, 0.86, '#5e2e30');
    sail(-130, -56, 1.0, '#763a34');
    // far hull, deck, near hull
    const hull = (dy, col) => {
      c.fillStyle = col;
      c.beginPath(); c.moveTo(-470, -118 + dy);
      c.bezierCurveTo(-420, -30 + dy, -360, 16 + dy, -230, 22 + dy);
      c.lineTo(280, 22 + dy); c.bezierCurveTo(410, 14 + dy, 468, -40 + dy, 512, -132 + dy);
      c.bezierCurveTo(450, -76 + dy, 390, -44 + dy, 280, -34 + dy); c.lineTo(-240, -34 + dy);
      c.bezierCurveTo(-350, -42 + dy, -420, -74 + dy, -470, -118 + dy); c.fill();
    };
    hull(-18, '#241218');
    c.fillStyle = dark; c.fillRect(-290, -66, 590, 22);
    // a thatched shelter and a sand hearth that never goes out
    c.fillStyle = '#26131a'; fillPoly(c, [[-40, -66], [-18, -134], [70, -146], [132, -66]]);
    const who = (o) => FIG.person(c, { color: dark, far: '#0e0810', cloth: '#2c1218', dress: 'wrap', t, ...o });
    who({ x: -262, y: -62, h: 168, hair: 'bun', p: FIG.stand({ lean: -0.02, handA: [0.34, 0.86 + Math.sin(t * 0.9) * 0.012], handB: [0.02, 0.5], tilt: -0.2, footA: [0.12, 0.035], footB: [-0.1, 0.035] }) });
    who({ x: 252, y: -62, h: 154, face: -1, hair: 'long', p: FIG.seat({ handA: [0.26, 0.42], handB: [0.2, 0.40] }) });
    who({ x: 322, y: -62, h: 104, face: -1, child: 0.9, hair: 'curls', p: FIG.sit({ tilt: -0.3, handA: [0.2, 0.24] }) });
    who({ x: -380, y: -46, h: 160, hair: 'short', p: FIG.kneel({ lean: 0.5, handA: [0.3, 0.2], handB: [0.24, 0.26] }) });
    c.strokeStyle = dark; c.lineWidth = 8; c.beginPath(); c.moveTo(-352, -70); c.lineTo(-470, 26); c.stroke();
    c.fillStyle = '#31161a'; c.fillRect(142, -78, 58, 13);
    hull(14, dark);
    c.fillStyle = '#4a2420'; for (let i = 0; i < 24; i++) fillPoly(c, [[-300 + i * 24, -8], [-288 + i * 24, 6], [-276 + i * 24, -8]]);
    c.restore();
    return [x + 171 * s, y + bob + (-76) * s];
  }

  defineScene('ocean', 42.1, { kind: 'pan', dur: 0.85 }, (S) => {
    const { t, env, back, far, near, glow: g } = S;
    const u = t - 42.1;
    const d = ramp(42.2, 45.0, t);                 // sunset falls into starlight
    const sunX = 1380 - u * 36;
    env.sky = {
      top: M('#2c3a72', '#070d26', d), mid: M('#9a5a78', '#25285a', d), low: M('#ffae66', '#a05a74', d), ground: '#241f3a',
      horizon: 706, midAt: 0.6, cloud: 0.40, cloudColor: M('#b0607a', '#3a3460', d), milky: 0.7 * ramp(43.4, 45.0, t),
      sun: { x: sunX, y: 596 + d * 190, r: 62, color: '#ffb060', glow: 150, k: 0.82 * (1 - d * 0.65) },
    };
    env.haze = { color: M('#c07a6c', '#3c3860', d), amt: 0.22 };
    env.skyRim = M('#ffb078', '#8090d0', d); env.skyRimAmt = 0.35;
    SKY.stars(back, t, { alpha: ramp(42.6, 44.2, t) * 0.9, pole: [600, -300], horizon: 640 });

    // far shores slide past: temple towers, then stone walls
    const sl = u * 210;
    const ax = 560 - sl;
    far.fillStyle = M('#6a3c58', '#242448', d);
    blob(far, [[ax - 380, 712], [ax - 250, 684], [ax, 676], [ax + 230, 690], [ax + 350, 712]], 0.5);
    for (const [dx, h, w] of [[0, 150, 54], [-70, 106, 40], [70, 106, 40], [-132, 72, 30], [132, 72, 30]]) {
      blob(far, [[ax + dx - w / 2, 686], [ax + dx - w * 0.46, 686 - h * 0.42], [ax + dx - w * 0.26, 686 - h * 0.78], [ax + dx, 686 - h], [ax + dx + w * 0.26, 686 - h * 0.78], [ax + dx + w * 0.46, 686 - h * 0.42], [ax + dx + w / 2, 686]], 0.55);
    }
    far.fillRect(ax - 180, 668, 360, 22);
    const zx = 1130 - sl;
    blob(far, [[zx - 240, 712], [zx - 130, 686], [zx + 40, 672], [zx + 180, 692], [zx + 260, 712]], 0.5);
    far.fillRect(zx - 90, 650, 190, 34); blob(far, [[zx - 120, 684], [zx - 118, 646], [zx - 86, 640], [zx - 74, 684]], 0.4);
    fillPoly(far, [[zx + 40, 676], [zx + 47, 612], [zx + 62, 596], [zx + 77, 612], [zx + 84, 676]]);
    // and a new land rises ahead: long, steep, snow on its back
    const nz = lerp(2500, 1610, easeOut(invLerp(43.0, 45.2, t)));
    const rise = ramp(42.9, 44.3, t);
    if (rise > 0) {
      far.fillStyle = M('#53324c', '#1b2040', d);
      fillPoly(far, [[nz - 520, 712], [nz - 380, 668], [nz - 270, 680], [nz - 140, 596], [nz - 80, 622], [nz + 10, 540], [nz + 82, 604], [nz + 150, 586], [nz + 300, 660], [nz + 520, 712]]);
      far.fillStyle = M('#f2c4b0', '#9aa0cc', d);
      fillPoly(far, [[nz + 10, 540], [nz + 40, 568], [nz + 22, 565], [nz + 8, 582], [nz - 8, 566], [nz - 30, 574]]);
      puff(far, nz - 60, 566, 330, 15, '#e8e0ee', 0.5 * rise);
    }

    seaLayers(far, near, g, t, sunX, u, d);
    swell(near, t, 842, 9, 1.5, M('#42304e', '#121a36', d), 1.0, u * 60);
    const hearth = canoe(near, g, 800 + u * 70, 894, 0.98, t, env);
    swell(near, t, 920, 13, 1.9, M('#291d38', '#0b1228', d), 2.3, u * 130);
    swell(near, t, 990, 18, 2.3, M('#170f24', '#060a18', d), 4.1, u * 230);
    near.strokeStyle = rgb([255, 214, 170], 0.20 * (1 - d * 0.6)); near.lineWidth = 2.4;
    for (let i = 0; i < 46; i++) { const x = mod(hash(i) * 2300 - u * (150 + hash(i + 1) * 120), 2300) - 190, y = 860 + hash(i + 2) * 200; near.beginPath(); near.moveTo(x, y); near.quadraticCurveTo(x + 24, y - 6, x + 52, y); near.stroke(); }

    env.flames.push({ x: hearth[0], y: hearth[1] + 6, w: 17, h: 56, i: 0.95, seed: 15, lean: -0.35, halo: 0.9 });
    env.lights.push({ x: hearth[0], y: hearth[1] - 20, r: 300, i: 0.62 * flick(t, 16), color: '#ff9438' });
    env.lights.push({ x: sunX, y: 590 + d * 190, r: 1250, i: 0.36 * (1 - d * 0.5), color: '#ff9660' });
    // the evening star they steer by
    const sa = ramp(43.0, 43.6, t);
    glow(g, 338, 330, 36, '#dfe8ff', 0.9 * sa); g.fillStyle = rgb([255, 255, 255], sa); disc(g, 338, 330, 3.4);
    for (let i = 0; i < 5; i++) { const x = 1050 + i * 52 - u * 30 + Math.sin(i * 3) * 30, y = 430 + Math.abs(i - 2) * 26 + Math.sin(t + i) * 5; FIG.bird(near, x, y, 15, t * 7 + i, M('#2a1a2c', '#0c0c1e', d), 2.6); }
    env.rim = 1.1; env.bloom = 0.42; env.thresh = 0.74; env.vig = 0.26;
  });
})();
