// 33.4 - 38.3 s : the first cities and the first writing. One long pan under a
// morning sky: Mesopotamia, Egypt, the Sahel, the Indus, Peru, Britain.
(() => {
  const camX = (t) => keys([[32.6, -60], [33.4, 0], [34.2, 120], [35.15, 235], [35.8, 1040], [36.5, 1620], [37.35, 2480], [38.3, 3080], [39.0, 3300]], t);
  const FAR = 0.62;

  function ziggurat(c, x, y) {
    const tier = (w, h, yy, col, face) => {
      c.fillStyle = col; fillPoly(c, [[x - w / 2, yy], [x - w / 2 + h * 0.22, yy - h], [x + w / 2 - h * 0.22, yy - h], [x + w / 2, yy]]);
      c.fillStyle = face; for (let i = x - w / 2 + 28; i < x + w / 2 - 28; i += 34) c.fillRect(i, yy - h + 8, 9, h - 10);
    };
    tier(560, 92, y, '#a8664a', '#945541');
    tier(400, 72, y - 92, '#b87452', '#a26248');
    c.fillStyle = '#ead2b0'; c.fillRect(x - 118, y - 164 - 74, 236, 74);   // the white temple
    c.fillStyle = '#c9a787'; for (let i = -100; i < 108; i += 26) c.fillRect(x + i, y - 232, 8, 62);
    c.fillStyle = '#6f3b30'; c.fillRect(x - 17, y - 214, 34, 50);
    c.fillStyle = '#c28a5a'; fillPoly(c, [[x - 34, y], [x - 14, y - 164], [x + 14, y - 164], [x + 34, y]]);
    c.strokeStyle = '#8d5843'; c.lineWidth = 2; for (let k = 8; k < 164; k += 11) { c.beginPath(); c.moveTo(x - 34 + k * 0.12, y - k); c.lineTo(x + 34 - k * 0.12, y - k); c.stroke(); }
  }
  function mudHouses(c, x0, x1, y, seed, cols) {
    const r = rng(seed);
    for (let x = x0; x < x1;) {
      const w = 54 + r() * 76, h = 36 + r() * 62;
      c.fillStyle = cols[(r() * cols.length) | 0];
      c.fillRect(x, y - h, w, h + 6); c.fillRect(x - 3, y - h - 7, w + 6, 8);
      c.fillStyle = '#5f342c';
      c.fillRect(x + w * 0.4, y - 24, 12, 26);
      if (h > 60) { c.fillRect(x + w * 0.18, y - h + 16, 8, 10); c.fillRect(x + w * 0.7, y - h + 16, 8, 10); }
      x += w * (0.75 + r() * 0.35);
    }
  }
  function palm(c, x, y, h, color, t, seed) {
    const bend = (hash(seed) - 0.5) * h * 0.3;
    c.fillStyle = color;
    chain(c, [[x, y, h * 0.035], [x + bend * 0.4, y - h * 0.55, h * 0.026], [x + bend, y - h, h * 0.02]]);
    for (let i = 0; i < 9; i++) {
      const a = -PI - 0.35 + i * (PI + 0.7) / 8;
      const ex = x + bend + Math.cos(a) * h * 0.40 + Math.sin(t * 1.4 + i + seed) * 4;
      const ey = y - h + Math.sin(a) * h * 0.24 + h * 0.16;
      c.beginPath(); c.moveTo(x + bend, y - h);
      c.quadraticCurveTo(x + bend + Math.cos(a) * h * 0.25, y - h + Math.sin(a) * h * 0.34 - h * 0.07, ex, ey);
      c.quadraticCurveTo(x + bend + Math.cos(a) * h * 0.18, y - h + Math.sin(a) * h * 0.20 + h * 0.02, x + bend, y - h + 9);
      c.fill();
    }
    c.fillStyle = '#7a3a1c'; for (let i = 0; i < 7; i++) disc(c, x + bend + (hash(i + seed) - 0.5) * h * 0.08, y - h + 12 + hash(i) * 10, h * 0.015);
  }
  function reedBoat(c, x, y, s) {
    c.fillStyle = '#6a3c26';
    c.beginPath(); c.moveTo(x - s, y - s * 0.34); c.quadraticCurveTo(x - s * 0.7, y + s * 0.14, x, y + s * 0.12);
    c.quadraticCurveTo(x + s * 0.7, y + s * 0.14, x + s * 1.05, y - s * 0.40); c.quadraticCurveTo(x + s * 0.5, y - s * 0.06, x, y - s * 0.07);
    c.quadraticCurveTo(x - s * 0.5, y - s * 0.06, x - s, y - s * 0.34); c.fill();
    FIG.person(c, { x: x - s * 0.25, y: y - s * 0.02, h: s * 0.9, color: '#5a2e24', dress: 'tunic', cloth: '#6a3424', p: FIG.stand({ lean: 0.14, handA: [0.24, 0.62], handB: [0.14, 0.5] }) });
    c.strokeStyle = '#5a2e24'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - s * 0.02, y - s * 0.72); c.lineTo(x + s * 0.2, y + s * 0.32); c.stroke();
  }
  function pyramid(c, x, y, w, h, o = {}) {
    const { built = 1, col = '#c98c5a', shade = '#9c6244' } = o;
    const top = h * built, tw = (w / 2) * (1 - built);
    c.fillStyle = col; fillPoly(c, [[x - w / 2, y], [x - tw, y - top], [x + tw * 0.2, y - top], [x + w * 0.10, y]]);
    c.fillStyle = shade; fillPoly(c, [[x + w * 0.10, y], [x + tw * 0.2, y - top], [x + tw, y - top], [x + w / 2, y]]);
    c.strokeStyle = 'rgba(110,62,40,0.42)'; c.lineWidth = 1.6;
    for (let k = 12; k < top; k += 13) { const half = (w / 2) * (1 - k / h); c.beginPath(); c.moveTo(x - half, y - k); c.lineTo(x + half, y - k); c.stroke(); }
  }
  function tinyWorkers(c, pts, s, col, t) {
    c.fillStyle = col;
    pts.forEach(([x, y, lean], i) => {
      const p = FIG.walk(t * 1.1 + i * 0.37, { lean: lean ?? 0.4, stride: 0.3, over: { handA: [0.30, 0.46], handB: [0.26, 0.50] } });
      FIG.person(c, { x, y, h: s, color: col, dress: 'wrap', p });
    });
  }
  function caral(c, x, y) {
    for (const [dx, w, h] of [[-170, 250, 118], [95, 190, 80], [255, 120, 52]]) {
      for (let i = 0; i < 4; i++) {
        c.fillStyle = i % 2 ? '#b07a56' : '#a06c4d';
        const ww = w * (1 - i * 0.17), hh = h / 4;
        fillPoly(c, [[x + dx - ww / 2, y - i * hh], [x + dx - ww / 2 + 7, y - (i + 1) * hh], [x + dx + ww / 2 - 7, y - (i + 1) * hh], [x + dx + ww / 2, y - i * hh]]);
      }
      c.fillStyle = '#c4905f'; fillPoly(c, [[x + dx - 16, y], [x + dx - 8, y - h], [x + dx + 8, y - h], [x + dx + 16, y]]);
    }
    c.fillStyle = '#8a5640'; oval(c, x - 40, y + 8, 120, 17); c.fillStyle = '#b8835a'; oval(c, x - 40, y + 5, 96, 11);
  }
  function henge(c, x, y, col) {
    c.fillStyle = col;
    const stone = (sx, w, h, tilt = 0) => blob(c, [[sx - w / 2, y + 4], [sx - w / 2 + tilt - 2, y - h * 0.5], [sx - w / 2 + tilt + 3, y - h], [sx + w / 2 + tilt - 3, y - h - 3], [sx + w / 2 + tilt + 2, y - h * 0.45], [sx + w / 2, y + 4]], 0.25);
    for (const [sx, h] of [[-250, 128], [-92, 162], [78, 168], [232, 134]]) {
      stone(x + sx - 33, 34, h); stone(x + sx + 33, 34, h);
      c.fillRect(x + sx - 62, y - h - 28, 124, 28);
    }
    stone(x - 350, 30, 78, 6); stone(x + 330, 36, 92, -9); stone(x - 10, 44, 66, 12);
  }
  // clay tablet with wedge marks pressed in one after another
  function tablet(c, x, y, s, k, rot) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.fillStyle = '#c58a58';
    blob(c, [[-s * 0.74, -s * 0.50], [0, -s * 0.57], [s * 0.74, -s * 0.50], [s * 0.80, 0], [s * 0.72, s * 0.50], [0, s * 0.56], [-s * 0.73, s * 0.50], [-s * 0.79, 0]], 0.4);
    c.strokeStyle = 'rgba(110,60,36,0.7)'; c.lineWidth = 2;
    for (let r = 1; r < 5; r++) { c.beginPath(); c.moveTo(-s * 0.68, -s * 0.52 + r * s * 0.205); c.lineTo(s * 0.68, -s * 0.52 + r * s * 0.205); c.stroke(); }
    const total = 5 * 9, shown = Math.floor(clamp(k) * total);
    const wedge = (wx, wy, a, len) => {
      c.save(); c.translate(wx, wy); c.rotate(a);
      c.fillStyle = '#6c3720'; fillPoly(c, [[-len * 0.34, -len * 0.30], [len * 0.14, 0], [-len * 0.34, len * 0.30]]);
      c.fillRect(-len * 0.05, -len * 0.07, len * 0.72, len * 0.14);
      c.fillStyle = 'rgba(255,214,160,0.6)'; c.fillRect(-len * 0.30, len * 0.26, len * 0.35, 1.6);
      c.restore();
    };
    let last = null;
    for (let i = 0; i < shown; i++) {
      const row = (i / 9) | 0, col = i % 9;
      const wx = -s * 0.60 + col * s * 0.148 + (hash(i + 4) - 0.5) * s * 0.03, wy = -s * 0.415 + row * s * 0.205;
      const kind = (hash(i + 100) * 4) | 0;
      wedge(wx, wy, [0, PI / 2, PI / 4, 0][kind], s * 0.12);
      if (kind === 3) wedge(wx + s * 0.02, wy + s * 0.05, PI / 2, s * 0.09);
      if (kind === 1) wedge(wx + s * 0.055, wy, PI / 2, s * 0.09);
      last = [wx, wy];
    }
    c.restore();
    return last;
  }

  defineScene('city', 33.62, { kind: 'pan', dur: 0.7 }, (S) => {
    const { t, env, back, far, near, glow: g } = S;
    const cx = camX(t);   // pan across the first cities
    const day = ramp(33.4, 38.4, t);
    env.sky = {
      top: M('#37588f', '#2f6aa8', day), mid: M('#96a0bc', '#8fb4cc', day), low: M('#ffd8a2', '#f6e2b8', day), ground: '#9a6a4c',
      horizon: 742, midAt: 0.62, cloud: 0.42, cloudColor: '#e8c8b4',
      sun: { x: 1540 - cx * 0.05, y: 296 - day * 46, r: 38, color: '#fff0c8', glow: 84, k: 0.7 * (1 - ramp(37.75, 38.15, t)) + 0.001 },
    };
    env.haze = { color: '#e4c4a8', amt: 0.17 };
    env.skyRim = '#ffe4b8'; env.skyRimAmt = 0.28;

    // lean in while the first marks are pressed into the clay
    const zk = keys([[33.9, 0], [34.55, 1], [35.05, 1], [35.55, 0]], t);
    const zcam = { z: 1 + 0.55 * zk, x: 0, y: 0, ax: 1085, ay: 905 };
    for (const [c, d] of [[far, 0.45], [near, 1], [g, 1]]) {
      const zz = 1 + (zcam.z - 1) * d;
      c.translate(zcam.ax, zcam.ay); c.scale(zz, zz); c.translate(-zcam.ax, -zcam.ay);
    }
    const fx = (wx) => wx - cx * FAR;        // far-layer world to screen
    // mountains and desert far behind
    ridge(far, { y: 690, amp: 56, freq: 0.0017, seed: 71, scroll: cx * 0.12, color: '#b08c92' });
    ridge(far, { y: 735, amp: 24, freq: 0.0031, seed: 72, scroll: cx * 0.25, color: '#bf9070' });

    // Mesopotamia
    ziggurat(far, fx(455), 790);
    mudHouses(far, fx(30), fx(178), 800, 3, ['#b07254', '#bd7f5c', '#a3664d']);
    mudHouses(far, fx(742), fx(930), 804, 4, ['#b07254', '#c08460', '#a3664d']);
    // Egypt: a pyramid still being raised, and one finished
    pyramid(far, fx(1260), 794, 470, 296, { built: 0.66 + 0.14 * invLerp(34.8, 36.6, t) });
    pyramid(far, fx(1010), 786, 250, 156, { col: '#d29a68', shade: '#a86e4e' });
    far.fillStyle = '#b87b52'; fillPoly(far, [[fx(1475), 800], [fx(1262), 662], [fx(1292), 662], [fx(1560), 800]]);
    if (fx(1400) > -200 && fx(1400) < W + 200) {
      const climb = (u) => [fx(lerp(1535, 1300, u)), lerp(798, 664, u)];
      tinyWorkers(far, [0.12, 0.2, 0.28, 0.62, 0.7].map((u, i) => [...climb(mod(u + t * 0.05, 0.9)), 0.55]), 44, '#6a3424', t);
      const b = climb(mod(0.38 + t * 0.05, 0.9)); far.fillStyle = '#e0b078'; far.fillRect(b[0] - 17, b[1] - 20, 30, 18);
    }
    // the Indus: straight brick streets, drains, a great bath
    const ix = fx(2130);
    mudHouses(far, ix - 270, ix - 70, 798, 8, ['#a85a42', '#b56348', '#9a5240']);
    mudHouses(far, ix + 70, ix + 262, 798, 9, ['#a85a42', '#b56348', '#9a5240']);
    far.fillStyle = '#8a4a38'; far.fillRect(ix - 70, 782, 140, 20); far.fillStyle = '#7fb4bc'; far.fillRect(ix - 52, 786, 104, 10);
    far.fillStyle = '#b8684a'; far.fillRect(ix - 24, 702, 48, 82); far.fillRect(ix - 34, 696, 68, 10);
    // Peru: platform mounds and a sunken round plaza
    ridge(far, { y: 805, amp: 4, freq: 0.01, seed: 3, color: '#b0825e', x0: fx(2430), x1: fx(3030), bottom: 830 });
    caral(far, fx(2690), 802);
    // Britain: a circle of standing stones, in morning mist
    const bx = fx(3290);
    ridge(far, { y: 790, amp: 15, freq: 0.004, seed: 88, color: '#6f8a62', x0: bx - 520, x1: bx + 640, bottom: 850 });
    henge(far, bx, 796, '#5d5560');
    puff(far, bx, 792, 460, 30, '#f2e2d2', 0.6);
    far.fillStyle = '#675a62'; blob(far, [[bx - 560, 806], [bx - 548, 778], [bx - 470, 776], [bx - 462, 806]], 0.3);
    far.strokeStyle = '#4a3a3c'; far.lineWidth = 2.6; far.beginPath(); far.moveTo(bx - 470, 792); far.lineTo(bx - 300, 770); far.stroke();
    tinyWorkers(far, [[bx - 390, 810, 0.55], [bx - 345, 806, 0.55], [bx - 300, 811, 0.55]], 66, '#4c342e', t);

    // river along the middle ground
    near.fillStyle = vgrad(near, 808, 868, [[0, '#9cc0c2'], [1, '#4e7684']]); near.fillRect(-40, 810, W + 80, 54);
    near.strokeStyle = 'rgba(255,240,212,0.65)'; near.lineWidth = 2;
    for (let i = 0; i < 46; i++) { const x = mod(hash(i + 31) * 2400 - cx * 0.82 + t * 20, 2400) - 240, y = 818 + hash(i + 71) * 40; near.beginPath(); near.moveTo(x, y); near.lineTo(x + 18 + hash(i) * 42, y); near.stroke(); }
    reedBoat(near, 760 - cx * 0.8 + t * 18 - 600, 842, 74);
    reedBoat(near, 2050 - cx * 0.8 + t * 14 - 500, 848, 62);

    // near bank
    const gy = (x) => 866 + (fbm1((x + cx) * 0.003, 90, 3) - 0.5) * 26;
    near.fillStyle = vgrad(near, 850, H, [[0, '#7a4630'], [0.4, '#4e2a20'], [1, '#1e0f10']]);
    near.beginPath(); near.moveTo(-60, H + 40); for (let x = -60; x <= W + 60; x += 14) near.lineTo(x, gy(x)); near.lineTo(W + 60, H + 40); near.fill();

    const nx = (wx) => wx - cx;
    palm(near, nx(150), 890, 330, '#35201a', t, 4);
    palm(near, nx(285), 876, 236, '#3c241c', t, 9);

    // the scribe, under a reed awning, by an oil lamp
    const sx = nx(1330), sy = 1062;
    near.strokeStyle = '#3a2016'; near.lineWidth = 15; near.lineCap = 'round';
    for (const px of [-330, 350]) { near.beginPath(); near.moveTo(sx + px, 1085); near.lineTo(sx + px, 560); near.stroke(); }
    near.fillStyle = '#4a2a1a'; fillPoly(near, [[sx - 380, 556], [sx + 400, 546], [sx + 392, 584], [sx - 372, 592]]);
    near.fillStyle = '#5c3620'; for (let i = 0; i < 38; i++) fillPoly(near, [[sx - 370 + i * 20.2, 584], [sx - 354 + i * 20.2, 584], [sx - 362 + i * 20.2, 606 + hash(i) * 14]]);
    const write = invLerp(33.75, 35.55, t);
    const stylusBob = Math.abs(Math.sin(t * 15)) * (write > 0 && write < 1 ? 1 : 0);
    const scribe = FIG.person(near, {
      x: sx + 96, y: sy, h: 560, face: -1, color: '#40201a', far: '#2c1512', cloth: '#d8c0a0', dress: 'tunic', hair: 'bun', t,
      lit: { x: sx - 130, y: 800, r: 520, color: '#d88a48', k: 0.5 },
      p: FIG.sit({ hip: [-0.05, 0.115], lean: 0.17, handA: [0.30, 0.355], handB: [0.31, 0.27], tilt: 0.30, footA: [0.20, 0.05], footB: [0.10, 0.06] }),
    });
    const tx = scribe.handB[0] - 46, ty = scribe.handB[1] - 12;
    const mark = tablet(near, tx, ty, 108, write, -0.16);
    const co = Math.cos(-0.16), si = Math.sin(-0.16);
    const mp = mark ? [tx + mark[0] * co - mark[1] * si, ty + mark[0] * si + mark[1] * co] : [tx - 20, ty - 20];
    near.strokeStyle = '#ecd29a'; near.lineWidth = 7;
    near.beginPath(); near.moveTo(mp[0] + 3, mp[1] - 2 - stylusBob * 9); near.lineTo(scribe.handA[0] + 14, scribe.handA[1] - 22); near.stroke();
    // a low table and the lamp
    near.fillStyle = '#33190f'; near.fillRect(sx - 442, 962, 128, 15); near.fillRect(sx - 430, 975, 12, 105); near.fillRect(sx - 340, 975, 12, 105);
    near.fillStyle = '#8c4c2c'; blob(near, [[sx - 420, 944], [sx - 392, 962], [sx - 348, 960], [sx - 330, 944], [sx - 308, 934], [sx - 340, 932], [sx - 380, 930], [sx - 410, 934]], 0.6);
    if (sx - 310 > -100 && sx - 310 < W + 100) {
      const [lx, ly, lz] = camPoint(zcam, 1, sx - 314, 936);
      env.flames.push({ x: lx, y: ly, w: 13 * lz, h: 50 * lz, i: 0.95, seed: 12, halo: 1.0 });
      env.lights.push({ x: lx, y: ly - 30 * lz, r: 380 * lz, i: 0.30 * flick(t, 14), color: '#ff9a40' });
    }
    // a woman carrying water, a man with a goat
    const carry = (wx, h, ph, cloth, jar) => {
      const f = FIG.person(near, { x: nx(wx) + (t - 33.4) * 34, y: gy(nx(wx)) + 18, h, color: '#442218', far: '#2e1612', cloth, dress: 'dress', hair: 'bun', t, p: FIG.walk(t * 1.15 + ph, { stride: 0.26, over: jar ? { handA: [0.04, 0.99], elbowA: 1 } : {} }) });
      if (jar) { near.fillStyle = '#9a5430'; blob(near, [[f.head[0] - 18, f.head[1] - 24], [f.head[0] - 26, f.head[1] - 52], [f.head[0] - 8, f.head[1] - 70], [f.head[0] + 8, f.head[1] - 70], [f.head[0] + 26, f.head[1] - 52], [f.head[0] + 18, f.head[1] - 24]], 0.9); }
    };
    carry(560, 215, 0.1, '#9a3c28', true);
    carry(705, 190, 0.55, '#c9a67c', false);
    // pyramid haulers pass in the foreground of Egypt
    const hx = nx(2070);
    if (hx > -500 && hx < W + 500) {
      near.fillStyle = '#c48e5c'; near.fillRect(hx - 150, 884, 150, 86);
      near.strokeStyle = '#33180f'; near.lineWidth = 11; near.beginPath(); near.moveTo(hx - 170, 976); near.lineTo(hx + 20, 976); near.stroke();
      near.lineWidth = 3.4; near.beginPath(); near.moveTo(hx - 4, 930); near.lineTo(hx + 330, 862); near.stroke();
      for (let i = 0; i < 3; i++) FIG.person(near, { x: hx + 130 + i * 108, y: 990, h: 215, color: '#3a1c14', far: '#28120e', cloth: '#c8ac88', dress: 'wrap', p: FIG.walk(t * 0.9 + i * 0.28, { stride: 0.3, lean: 0.55, over: { handA: [0.02, 0.60], handB: [-0.10, 0.56] } }) });
    }
    // the Sahel: pearl millet and the people who tame it
    const mx = nx(2760);
    if (mx > -700 && mx < W + 700) {
      for (let i = 0; i < 46; i++) {
        let x = mx - 420 + i * 19 + (hash(i + 8) - 0.5) * 20;
        const h = 150 + hash(i + 2) * 120, y = 980 + hash(i + 5) * 70, sw = Math.sin(t * 1.7 + i) * 6;
        near.strokeStyle = '#38200e'; near.lineWidth = 3.6; near.beginPath(); near.moveTo(x, y); near.quadraticCurveTo(x, y - h * 0.6, x + sw, y - h); near.stroke();
        near.fillStyle = i % 2 ? '#8a5a24' : '#6f451a'; oval(near, x + sw, y - h - 24, 7.5, 30, sw * 0.012);
      }
      PROPS.acacia(far, fx(2430) + 130, 800, 180, '#6a4636', 5);
      FIG.person(near, { x: mx + 70, y: 1000, h: 350, face: -1, color: '#3c1d12', far: '#28120c', cloth: '#a84426', dress: 'wrap', hat: 'wrap', t, p: FIG.stand({ lean: 0.2 + 0.08 * Math.sin(t * 5), handA: [0.30, 0.64 + 0.04 * Math.sin(t * 5)], handB: [0.18, 0.55] }) });
      const al = pulse(35.7, 37.25, t, 0.2) * clamp((mx + 40) / 200) * clamp((W - 40 - mx) / 200);
      if (al > 0.01) HUD.riding.push({ x: clamp(mx, 380, 1540), y: 975, a: al, lines: [['millet in the Sahel', 42, '#fff4e4'], ['c. 2500 BCE', 40, '#ffd498']] });
    }
    // beside the stones: a herd coming home, and a fire already lit
    const hf = nx(3500);
    if (hf > -600 && hf < W + 600) {
      for (let i = 0; i < 5; i++) {
        const x = hf - 480 + i * 96 + (t - 37) * 46, y = 1016 + (i % 2) * 26, step = Math.sin(t * 7 + i * 2) * 5;
        near.fillStyle = i % 2 ? '#4a2c22' : '#c8ac8c';
        blob(near, [[x - 40, y - 42], [x - 20, y - 62], [x + 18, y - 60], [x + 38, y - 44], [x + 24, y - 24], [x - 28, y - 24]], 0.9);
        near.fillStyle = '#2a140e'; oval(near, x + 44, y - 50, 15, 12, 0.3); oval(near, x + 40, y - 62, 4, 9, -0.5);
        for (const [dx, k] of [[-24, 1], [-8, -1], [12, 1], [26, -1]]) chain(near, [[x + dx, y - 30, 4], [x + dx + step * k, y, 2.5]]);
      }
      FIG.person(near, { x: hf - 590 + (t - 37) * 46, y: 1030, h: 268, color: '#3c1d12', far: '#28120c', cloth: '#8a4c2c', dress: 'cloak', hair: 'long', t, p: FIG.walk((t - 37) * 1.1, { stride: 0.26, over: { handA: [0.20, 0.62] } }) });
      const fxw = hf + 230;
      PROPS.logs(near, fxw, 1000, 40, '#200e08'); PROPS.coals(g, fxw, 1000, 40, t, 1);
      FIG.person(near, { x: fxw + 130, y: 1036, h: 270, face: -1, color: '#3c1d12', far: '#28120c', cloth: '#a8603a', dress: 'wrap', hair: 'bun', t, lit: { x: fxw, y: 960, r: 330, color: '#b45a20', k: 0.5 }, p: FIG.sit({ handA: [0.26, 0.28], handB: [0.2, 0.26], lean: 0.2 }) });
      env.flames.push({ x: fxw, y: 992, w: 27, h: 94, i: 1.0, seed: 78, halo: 0.9 });
      env.lights.push({ x: fxw, y: 955, r: 320, i: 0.5 * flick(t, 79), color: '#ff9438' });
    }
    palm(near, nx(3420), 905, 280, '#35201a', t, 13);
    palm(near, nx(4980), 905, 240, '#35201a', t, 16);

    // names that ride with the places
    const place = (name, wx, y, from, to) => {
      const x = fx(wx);
      const a = pulse(from, to, t, 0.2) * clamp((x - 120) / 160) * clamp((W - 120 - x) / 160);
      if (a > 0.01) HUD.riding.push({ x, y, a, lines: [[name, 40, '#fff8ee', 14]] });
    };
    place('MESOPOTAMIA', 470, 470, 33.55, 35.3);
    place('EGYPT', 1235, 420, 35.05, 36.35);
    place('INDUS VALLEY', 2130, 640, 36.25, 37.45);
    place('PERU', 2670, 620, 36.9, 38.0);
    place('BRITAIN', 3290, 566, 37.4, 38.45);

    env.lights.push({ x: 1540 - cx * 0.05, y: 280, r: 1500, i: 0.20, color: '#ffd8a0' });
    env.rim = 0.9; env.bloom = 0.22; env.thresh = 0.92; env.vig = 0.22;
  });
})();
