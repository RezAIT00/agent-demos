// 60 - 65.7 s : a screen, the Moon, a vaccine, a lit planet, a birth, and NOW.
const RED_CLOTH = '#a8341a';   // ochre red: the cave pigment, the blanket, the scarf

(() => {
  // what the family is watching
  function tvPicture(c, x, y, w, h, t) {
    c.save(); c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, 34); c.clip();
    c.fillStyle = '#0b0f16'; c.fillRect(x - w / 2, y - h / 2, w, h);
    c.fillStyle = '#9aa6b4'; c.beginPath(); c.moveTo(x - w / 2, y + h * 0.18); c.quadraticCurveTo(x, y + h * 0.04, x + w / 2, y + h * 0.20); c.lineTo(x + w / 2, y + h / 2); c.lineTo(x - w / 2, y + h / 2); c.fill();
    c.fillStyle = '#717c8a'; for (const [dx, dy, r] of [[-90, 56, 20], [80, 70, 13], [-30, 88, 9], [120, 44, 7]]) oval(c, x + dx, y + dy, r, r * 0.34);
    // the lander and one walker
    c.strokeStyle = '#c8d0da'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + 52, y + 40); c.lineTo(x + 72, y + 4); c.moveTo(x + 132, y + 40); c.lineTo(x + 112, y + 4); c.stroke();
    c.fillStyle = '#aeb8c4'; c.fillRect(x + 66, y - 24, 52, 30); fillPoly(c, [[x + 72, y - 24], [x + 82, y - 44], [x + 104, y - 44], [x + 112, y - 24]]);
    FIG.person(c, { x: x - 46 + (t - 60) * 12, y: y + 62, h: 108, color: '#e6ecf4', far: '#aab4c0', dress: 'astronaut', accent: '#39404c', hair: 'none', p: FIG.walk((t - 60) * 0.55, { stride: 0.2, lift: 0.1 }) });
    c.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 40; i++) c.fillRect(x - w / 2, y - h / 2 + mod(i * 7 + t * 40, h), w, 2);
    c.fillStyle = `rgba(200,220,255,${0.03 + 0.03 * noise1(t * 18, 3)})`; c.fillRect(x - w / 2, y - h / 2, w, h);
    c.restore();
  }

  defineScene('living', 60.42, { kind: 'dip', dur: 0.82, center: [1230, 470], center2: [932, 752] }, (S) => {
    const { t, env, back, far, near, glow: g } = S;
    env.sky = { top: '#0b0d18', mid: '#111320', low: '#1a1824', ground: '#0c0a10', horizon: 900, midAt: 0.5 };
    env.skyRimAmt = 0;
    const zoom = 1.20 + 0.14 * easeIn(invLerp(60.0, 61.35, t));
    const cam = { z: zoom, x: 0, y: 0, ax: 960, ay: 760 };
    withCam([far, near, g], cam, 1, () => {
      far.fillStyle = '#191724'; far.fillRect(-200, -100, 2320, 1000);
      for (let x = -160; x < 2100; x += 78) { far.fillStyle = 'rgba(255,255,255,0.018)'; far.fillRect(x, -100, 34, 1000); }
      // the window: the same night, now full of lamps
      far.fillStyle = '#0a1030'; far.fillRect(150, 330, 370, 330);
      far.fillStyle = '#d8dcf0'; for (let i = 0; i < 40; i++) disc(far, 160 + hash(i) * 350, 340 + hash(i + 50) * 150, 0.8 + hash(i + 9));
      for (let i = 0; i < 11; i++) { const x = 152 + i * 33, h = 60 + hash(i + 3) * 110; far.fillStyle = '#10142a'; far.fillRect(x, 660 - h, 30, h); for (let k = 0; k < 12; k++) if (hash2(i, k) > 0.5 && 660 - h + 8 + Math.floor(k / 2) * 17 < 644) { g.fillStyle = 'rgba(255,196,110,0.7)'; g.fillRect(x + 5 + (k % 2) * 13, 660 - h + 8 + Math.floor(k / 2) * 17, 7, 9); } }
      far.strokeStyle = '#272233'; far.lineWidth = 14; far.strokeRect(150, 330, 370, 330); far.lineWidth = 8; far.beginPath(); far.moveTo(335, 330); far.lineTo(335, 660); far.moveTo(150, 490); far.lineTo(520, 490); far.stroke();
      for (const [x, y, w, h] of [[1420, 380, 130, 100], [1590, 350, 90, 120], [1500, 510, 100, 76]]) { far.fillStyle = '#2a2430'; far.fillRect(x, y, w, h); far.fillStyle = '#12101a'; far.fillRect(x + 9, y + 9, w - 18, h - 18); }

      near.fillStyle = vgrad(near, 872, H, [[0, '#1a131c'], [1, '#07060a']]); near.fillRect(-200, 880, 2320, 300);
      near.fillStyle = '#1f1219'; oval(near, 960, 975, 620, 66);

      const lit = { x: 960, y: 760, r: 600, color: '#5a78a8', k: 0.55 };
      const who = (o) => FIG.person(near, { color: '#111019', far: '#0a0a11', cloth: '#1b1824', lit, t, dress: 'modern', ...o });
      // the same places as around the first fire
      near.fillStyle = '#0f0c14'; near.fillRect(724, 806, 130, 16); near.fillRect(722, 690, 18, 190); near.fillRect(840, 820, 12, 62);
      const mum = who({ x: 790, y: 880, h: 270, dress: 'dress', hair: 'bun', p: FIG.seat({ hip: [-0.05, 0.28], lean: 0.12, footA: [0.17, 0.035], footB: [0.11, 0.035], handA: [0.17, 0.45], handB: [0.12, 0.41], tilt: 0.12 }) });
      FIG.baby(near, mum.handA[0] - 6, mum.handA[1] - 8, 32, '#272232', '#15111a', -0.35);

      // the set stands where the fire stood
      near.fillStyle = '#120c0e';
      near.beginPath(); near.roundRect(772, 636, 376, 244, 26); near.fill();
      for (const lx of [812, 1094]) chain(near, [[lx, 870, 10], [lx + (lx < 960 ? -22 : 22), 936, 5]]);
      near.strokeStyle = '#120c0e'; near.lineWidth = 4; near.beginPath(); near.moveTo(930, 638); near.lineTo(880, 566); near.moveTo(990, 638); near.lineTo(1048, 560); near.stroke();
      tvPicture(g, 932, 756, 284, 208, t);
      for (let i = 0; i < 3; i++) { near.fillStyle = '#3a2c2c'; disc(near, 1110, 690 + i * 44, 13); }
      glow(g, 932, 756, 300, '#7c9cd8', 0.17 * (0.92 + 0.08 * noise1(t * 14, 6)));

      who({ x: 1190, y: 884, h: 258, face: -1, hair: 'short', p: FIG.kneel({ lean: 0.2, handA: [0.18, 0.32], handB: [0.15, 0.3], tilt: -0.02 }) });
      who({ x: 640, y: 944, h: 318, hair: 'curls', p: FIG.sit({ lean: 0.12, handA: [0.23, 0.26], handB: [0.14, 0.22], tilt: -0.10 }) });
      who({ x: 1330, y: 948, h: 316, face: -1, hair: 'short', p: FIG.crouch({ hip: [-0.1, 0.2], lean: 0.34, footA: [0.10, 0.035], footB: [-0.03, 0.035], handA: [0.20, 0.30], handB: [0.18, 0.22], tilt: -0.05 }) });
      who({ x: 1488, y: 956, h: 214, face: -1, child: 0.8, hair: 'curls', p: FIG.sit({ lean: 0.26, handA: [0.2, 0.19], handB: [0.16, 0.17], tilt: -0.22 }) });
      // a lamp: the old fire kept in a shade
      chain(near, [[1668, 946, 8], [1668, 700, 5]]);
      near.fillStyle = '#4a2c20'; fillPoly(near, [[1616, 700], [1642, 622], [1694, 622], [1720, 700]]);
      g.fillStyle = 'rgba(255,170,84,0.30)'; fillPoly(g, [[1616, 700], [1642, 622], [1694, 622], [1720, 700]]);
      glow(g, 1668, 712, 190, '#ff9a40', 0.34);
    });
    const [sx, sy, sz] = camPoint(cam, 1, 932, 756);
    env.lights.push({ x: sx, y: sy, r: 640 * sz, i: 0.82 * (0.94 + 0.06 * noise1(t * 14, 6)), color: '#8cb0f0' });
    const [lx, ly] = camPoint(cam, 1, 1668, 700);
    env.lights.push({ x: lx, y: ly, r: 360, i: 0.5, color: '#ff9a48' });
    env.rim = 1.15; env.bloom = 0.4; env.thresh = 0.74; env.vig = 0.42;
  });

  // ---- 1969 ------------------------------------------------------------------
  defineScene('moon', 61.2, { kind: 'push', dur: 0.30, center: [932, 750] }, (S) => {
    const { t, env, back, far, near, glow: g } = S;
    const vw = GLOBE.view(-20 + (t - 61) * 4, 12, 1450, 330, 118, 0);
    env.bg = 'globe'; env.globe = vw;
    env.sky = { top: '#000000', mid: '#010103', low: '#040508', horizon: 2000, midAt: 0.5 };
    SKY.stars(back, t, { alpha: 0.5, pole: [300, -600], horizon: 700, density: 0.35, trailK: 0 });
    const z = 1.0 + 0.09 * invLerp(60.9, 62.1, t);
    for (const c of [far, near, g]) { c.translate(960, 800); c.scale(z, z); c.translate(-960, -800); }
    ridge(far, { y: 724, amp: 40, freq: 0.0026, seed: 191, color: '#4c4e54' });
    ridge(far, { y: 766, amp: 18, freq: 0.006, seed: 192, color: '#66686e' });
    near.fillStyle = vgrad(near, 770, H, [[0, '#8b8c90'], [0.45, '#66676c'], [1, '#2a2b30']]);
    near.beginPath(); near.moveTo(-100, H + 60); for (let x = -100; x <= W + 100; x += 20) near.lineTo(x, 790 + (fbm1(x * 0.004, 193, 3) - 0.5) * 36); near.lineTo(W + 100, H + 60); near.fill();
    const crater = (x, y, r) => { near.fillStyle = '#4a4b50'; oval(near, x, y, r, r * 0.30); near.fillStyle = '#a6a8ad'; oval(near, x + r * 0.08, y + r * 0.10, r * 0.86, r * 0.20); near.fillStyle = '#5c5d63'; oval(near, x, y + r * 0.03, r * 0.80, r * 0.20); };
    for (let i = 0; i < 26; i++) crater(hash(i + 3) * 2000 - 40, 820 + Math.pow(hash(i + 7), 1.5) * 260, 8 + hash(i + 11) * 46);
    for (let i = 0; i < 700; i++) { const y = 800 + Math.pow(hash(i + 100), 1.3) * 290; near.fillStyle = hash(i) > 0.5 ? 'rgba(215,216,220,0.45)' : 'rgba(20,20,26,0.45)'; disc(near, hash(i + 400) * 2000 - 40, y, 0.8 + hash(i + 700) * 2.4 * (y - 780) / 280); }
    // the bootprint: ridges pressed into the dust, lit from one side
    near.save(); near.translate(900, 936); near.rotate(-0.30); near.scale(1, 0.60);
    near.fillStyle = '#2e2f35'; near.beginPath(); near.roundRect(-262, -150, 524, 300, 148); near.fill();
    near.fillStyle = '#55565d'; near.beginPath(); near.roundRect(-244, -128, 496, 272, 134); near.fill();
    for (let i = 0; i < 9; i++) {
      const x = -190 + i * 46, half = Math.sqrt(Math.max(0, 1 - Math.pow((x - 4) / 240, 2))) * 112 * (i === 3 ? 0.86 : 1);
      near.fillStyle = '#27282d'; near.beginPath(); near.roundRect(x - 13, -half + 6, 25, half * 2, 11); near.fill();
      near.fillStyle = '#b2b3b8'; near.beginPath(); near.roundRect(x + 8, -half + 10, 9, half * 2 - 6, 4); near.fill();
    }
    near.strokeStyle = '#b8b9be'; near.lineWidth = 9; near.beginPath(); near.roundRect(-262, -150, 524, 300, 148); near.stroke();
    near.restore();
    // the boot lifts away, as the hand once did
    const up = easeInOut(invLerp(61.0, 61.72, t));
    {
      const bx = 900 + up * 1040, by = 906 - up * 1220;
      near.save(); near.translate(bx, by); near.rotate(-0.30 - up * 0.42);
      near.fillStyle = '#c6c9d0';
      near.beginPath(); near.roundRect(-238, -92, 470, 116, 56); near.fill();
      chain(near, [[96, -70, 72], [190, -330, 84], [300, -640, 96]]);
      near.fillStyle = '#3c3f48'; near.beginPath(); near.roundRect(-244, 8, 482, 30, 14); near.fill();
      for (let i = 0; i < 9; i++) near.fillRect(-206 + i * 48, 30, 23, 17);
      near.strokeStyle = '#8c909a'; near.lineWidth = 8; near.beginPath(); near.moveTo(40, -150); near.lineTo(214, -196); near.moveTo(72, -268); near.lineTo(246, -320); near.stroke();
      near.restore();
    }
    env.lights.push({ x: 140, y: 420, r: 2200, i: 0.30, color: '#e8ecf8' });
    env.skyRim = '#e8eefc'; env.skyRimAmt = 0.30;
    env.rim = 0.9; env.bloom = 0.3; env.thresh = 0.8; env.vig = 0.38;
  });

  // ---- 1980 --------------------------------------------------------------
  defineScene('vaccine', 62.0, { kind: 'dip', dur: 0.56, center: [1450, 330], center2: [1500, 886] }, (S) => {
    const { t, env, back, far, near, glow: g } = S;
    env.sky = { top: '#1e305a', mid: '#7e5876', low: '#d89868', ground: '#6a3c2c', horizon: 742, midAt: 0.6, cloud: 0.4, cloudColor: '#a86c68', sun: { x: 1560, y: 612, r: 40, color: '#f0a864', glow: 88, k: 0.55 } };
    env.exposure = 0.94;
    env.haze = { color: '#d89478', amt: 0.18 }; env.skyRim = '#ffc890'; env.skyRimAmt = 0.3;
    const z = 1.03 + 0.06 * invLerp(61.8, 63.1, t);
    for (const c of [far, near, g]) { c.translate(960, 760); c.scale(z, z); c.translate(-960 - (t - 62.4) * 24, -760); }
    ridge(far, { y: 700, amp: 50, freq: 0.002, seed: 201, color: '#8a586a' });
    for (const [x, w] of [[220, 230], [520, 150], [1500, 200]]) { far.fillStyle = '#94564a'; far.fillRect(x, 800 - w * 0.62, w, w * 0.64); far.fillStyle = '#5c3430'; fillPoly(far, [[x - 28, 802 - w * 0.62], [x + w / 2, 800 - w * 1.06], [x + w + 28, 802 - w * 0.62]]); far.fillRect(x + w * 0.4, 800 - w * 0.34, w * 0.18, w * 0.36); }
    PROPS.acacia(far, 1790, 806, 300, '#4a2a30', 55);
    near.fillStyle = vgrad(near, 850, H, [[0, '#6a3a26'], [1, '#1c0e0e']]); near.fillRect(-200, 868, 2320, 300);
    const who = (o) => FIG.person(near, { color: '#351a12', far: '#23100c', cloth: '#8a3a24', t, lit: { x: 1560, y: 600, r: 1100, color: '#c0703c', k: 0.3 }, ...o });
    // those waiting their turn
    [[250, 330, 'dress', '#7a3a58', 'bun'], [396, 196, 'tunic', '#c08a4a', 'curls'], [512, 346, 'modern', '#35506a', 'short'], [626, 305, 'dress', '#b2602c', 'bun']].forEach(([x, h, dress, cloth, hair], i) => who({ x, y: 962 + (i % 2) * 14, h, dress, cloth, hair, child: h < 220 ? 0.85 : 0, hat: i === 3 ? 'wrap' : null, p: FIG.stand({ lean: 0.03 + 0.02 * Math.sin(t * 2 + i), handA: [0.07, 0.47] }) }));
    // mother and child; the health worker kneeling
    const mum = who({ x: 832, y: 996, h: 470, dress: 'dress', cloth: '#a02e24', hat: 'wrap', p: FIG.seat({ hip: [-0.07, 0.26], lean: 0.18, handA: [0.17, 0.46], handB: [0.12, 0.40], tilt: 0.14 }) });
    near.fillStyle = '#2a140c'; near.fillRect(718, 872, 170, 20); near.fillRect(736, 890, 14, 104); near.fillRect(856, 890, 14, 104);
    const kid = who({ x: 975, y: 962, h: 285, child: 0.9, dress: 'tunic', cloth: '#e0b060', hair: 'curls', p: FIG.seat({ hip: [-0.04, 0.34], lean: 0.02, footA: [0.16, 0.12], footB: [0.1, 0.12], handA: [0.17, 0.52], handB: [0.12, 0.44], tilt: -0.05 }) });
    const press = pulse(61.9, 63.2, t, 0.35);
    const nurse = who({ x: 1190, y: 1006, h: 480, face: -1, dress: 'coat', cloth: '#d8d0c0', hat: 'scarfhead', hair: 'none', p: FIG.kneel({ hip: [-0.03, 0.27], lean: 0.24, handA: [0.35, 0.40], handB: [0.30, 0.34], tilt: 0.14 }) });
    near.strokeStyle = '#e8e4dc'; near.lineWidth = 4; near.beginPath(); near.moveTo(nurse.handA[0] - 6, nurse.handA[1]); near.lineTo(nurse.handA[0] - 44, nurse.handA[1] + 6); near.stroke();
    // kit on a stool, and a lamp already lit for the evening
    near.fillStyle = '#2a140c'; near.fillRect(1376, 916, 140, 14); near.fillRect(1390, 928, 12, 70); near.fillRect(1490, 928, 12, 70);
    near.fillStyle = '#6e8a96'; near.fillRect(1390, 868, 66, 48); near.fillStyle = '#d8d4cc'; near.fillRect(1397, 876, 52, 8);
    near.fillStyle = '#3a2014'; near.fillRect(1470, 896, 32, 20); near.fillRect(1473, 850, 26, 6);
    g.fillStyle = 'rgba(255,196,110,0.5)'; near.strokeStyle = '#3a2014'; near.lineWidth = 3; near.strokeRect(1475, 856, 22, 40);
    env.flames.push({ x: 960 + (1486 - 960) * z, y: 760 + (894 - 760) * z, w: 8, h: 34, i: 0.95, seed: 43, halo: 1.1 });
    env.lights.push({ x: 1490, y: 870, r: 360, i: 0.45, color: '#ff9c48' });
    env.lights.push({ x: 1580, y: 600, r: 1200, i: 0.24, color: '#ffb070' });
    PROPS.grass(near, t, { y: 1030, n: 34, h: 44, color: '#241008', seed: 205, spreadY: 60 });
    env.rim = 1.0; env.bloom = 0.28; env.thresh = 0.88; env.vig = 0.26;
  });

  // ---- the planet at night, 1990s to 2020s ----------------------------------
  const LINKS = [[-74, 40.7, -0.1, 51.5], [-0.1, 51.5, 77.2, 28.6], [77.2, 28.6, 121.5, 31.2], [121.5, 31.2, 139.7, 35.7], [139.7, 35.7, -122.4, 37.8], [-0.1, 51.5, 3.4, 6.5], [3.4, 6.5, -46.6, -23.6], [-46.6, -23.6, -74, 40.7], [31.2, 30, 36.8, -1.3], [36.8, -1.3, 72.9, 19], [28, -26.2, 36.8, -1.3], [103.8, 1.4, 151.2, -33.9], [103.8, 1.4, 77.2, 28.6], [37.6, 55.8, 116.4, 39.9], [-58.4, -34.6, 18.4, -33.9], [-99.1, 19.4, -74, 40.7], [55.3, 25.2, 36.8, -1.3], [-77, -12, -58.4, -34.6], [2.4, 48.9, 15.3, -4.3], [151.2, -33.9, 174.8, -36.9]];
  const arcs = LINKS.map(([a, b, c, d]) => [GLOBE.vec(a, b), GLOBE.vec(c, d)]);

  defineScene('earth', 63.1, { kind: 'pull', dur: 0.72, center: [960, 640] }, (S) => {
    const { t, env, back, glow: g } = S;
    const k = keys([[62.6, [112, 14, 452, 628]], [63.55, [48, -28, 470, 626]], [64.3, [8, 4, 476, 628]], [64.75, [36, 2, 560, 620]], [65.2, [37, -1, 1700, 560]]], t);
    const lights = 0.35 + 0.85 * ramp(62.8, 64.4, t);
    const vw = GLOBE.view(k[0], k[1], 960, k[3], k[2], lights);
    env.bg = 'globe'; env.globe = vw;
    env.sky = { top: '#010208', mid: '#03050f', low: '#050816', horizon: 2000, midAt: 0.5, milky: 0.45 };
    SKY.stars(back, t, { alpha: 0.7, pole: [1700, -380], horizon: 2000, density: 0.7 });
    // threads between cities: voices, aircraft, data
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    arcs.forEach(([a, b], i) => {
      const grow = invLerp(62.9 + (i % 7) * 0.17, 63.5 + (i % 7) * 0.17, t);
      if (grow <= 0) return;
      const dot = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1), om = Math.acos(dot);
      const at = (u) => {
        const s0 = Math.sin((1 - u) * om) / Math.sin(om), s1 = Math.sin(u * om) / Math.sin(om);
        const lift = 1 + Math.sin(u * PI) * om * 0.11;
        return vw.project([(a[0] * s0 + b[0] * s1) * lift, (a[1] * s0 + b[1] * s1) * lift, (a[2] * s0 + b[2] * s1) * lift]);
      };
      const rt = vw.rot;
      g.strokeStyle = '#8fc8ff'; g.lineWidth = 1.5; g.globalAlpha = 0.34;
      g.beginPath(); let pen = false;
      for (let j = 0; j <= 40; j++) { const p = at(j / 40 * grow); if (p.z < 0.02) { pen = false; continue; } pen ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); pen = true; }
      g.stroke();
      const p = at(mod(t * 0.9 + i * 0.37, 1) * grow);
      if (p.z > 0.05) { g.globalAlpha = 0.9; g.fillStyle = '#e8f4ff'; disc(g, p.x, p.y, 2.4); }
    });
    g.restore();
    env.bloom = 0.62; env.thresh = 0.58; env.vig = 0.22;
  });

  // ---- born in 2026 ------------------------------------------------------
  // The NOW line: everything it passes becomes a projection.
  const sweepAt = (t) => (t < TL.NOW_T ? -200 : lerp(-60, 2140, easeInOut(invLerp(TL.NOW_T, TL.NOW_T + 0.85, t))));

  defineScene('birth', 64.82, { kind: 'push', dur: 0.42, center: [960, 640] }, (S) => {
    const { t, env, back, far, near, glow: g } = S;
    env.sky = { top: '#0a0f24', mid: '#141a34', low: '#221e34', ground: '#0c0a14', horizon: 930, midAt: 0.5 };
    env.skyRimAmt = 0.1; env.skyRim = '#8090c8';
    const z = 1.02 + 0.09 * invLerp(64.6, 65.9, t);
    const cam = { z, x: 0, y: 0, ax: 960, ay: 640 };
    withCam([far, near, g], cam, 1, () => {
      far.fillStyle = '#1b1a2c'; far.fillRect(-200, -100, 2320, 1040);
      // a window over a city
      far.fillStyle = '#0b1334'; far.fillRect(1260, 300, 520, 430);
      far.fillStyle = '#dfe4ff'; for (let i = 0; i < 46; i++) disc(far, 1268 + hash(i + 3) * 505, 308 + hash(i + 63) * 190, 0.7 + hash(i + 19));
      for (let i = 0; i < 13; i++) { const x = 1262 + i * 40, h = 80 + hash(i + 33) * 190; far.fillStyle = '#131a38'; far.fillRect(x, 730 - h, 37, h); for (let k = 0; k < 18; k++) if (hash2(i + 20, k) > 0.46 && 730 - h + 9 + Math.floor(k / 2) * 18 < 712) { g.fillStyle = 'rgba(255,204,128,0.62)'; g.fillRect(x + 6 + (k % 2) * 16, 730 - h + 9 + Math.floor(k / 2) * 18, 8, 9); } }
      far.strokeStyle = '#34314a'; far.lineWidth = 15; far.strokeRect(1260, 300, 520, 430); far.lineWidth = 8; far.beginPath(); far.moveTo(1520, 300); far.lineTo(1520, 730); far.stroke();
      near.fillStyle = vgrad(near, 920, H, [[0, '#171220'], [1, '#07060c']]); near.fillRect(-200, 940, 2320, 300);
      // a bed
      near.fillStyle = '#231a2a'; near.beginPath(); near.roundRect(330, 870, 920, 120, 26); near.fill(); near.fillRect(330, 700, 34, 280);
      near.fillStyle = '#35293c'; blob(near, [[380, 876], [440, 796], [540, 818], [600, 876]], 0.7);
      const lit = { x: 1130, y: 620, r: 720, color: '#c07a40', k: 0.58 };
      // the one who has just given birth, and the one beside them
      const mum = FIG.person(near, { x: 700, y: 1062, h: 640, color: '#2a1612', far: '#1c0e0c', cloth: '#57445e', dress: 'dress', hair: 'curls', lit, t,
        p: FIG.seat({ hip: [-0.05, 0.28], lean: 0.10, footA: [0.17, 0.05], footB: [0.12, 0.05], handA: [0.255, 0.50], handB: [0.18, 0.455], tilt: 0.30 }) });
      FIG.person(near, { x: 1062, y: 1075, h: 660, face: -1, color: '#24120f', far: '#180c0b', cloth: '#2c3a52', dress: 'modern', hair: 'short', lit, t,
        p: FIG.kneel({ hip: [-0.05, 0.30], lean: 0.30, handA: [0.30, 0.45], handB: [0.24, 0.38], tilt: 0.24 }) });
      // the newborn, wrapped in ochre red
      const breathe = Math.sin(t * 5) * 2;
      const bx = mum.handA[0] - 30, by = mum.handA[1] - 26 + breathe;
      FIG.baby(near, bx, by, 84, '#8e2410', '#5c2e1e', -0.30);
      near.fillStyle = '#34190f'; chain(near, [[mum.handA[0] - 84, mum.handA[1] + 26, 18], [mum.handA[0] - 30, mum.handA[1] + 24, 13], [mum.handA[0] + 26, mum.handA[1] + 2, 9]]);
      // the lamp
      near.fillStyle = '#231a2a'; near.fillRect(1120, 782, 150, 18); near.fillRect(1188, 800, 16, 190);
      near.fillStyle = '#6a4030'; fillPoly(near, [[1140, 668], [1164, 584], [1228, 584], [1252, 668]]);
      near.fillStyle = '#231a2a'; near.fillRect(1190, 668, 12, 100); oval(near, 1196, 778, 44, 12);
      g.fillStyle = 'rgba(255,186,106,0.52)'; fillPoly(g, [[1143, 666], [1165, 588], [1227, 588], [1249, 666]]);
      glow(g, 1196, 640, 330, '#ff9c44', 0.34);
    });
    const [lx, ly, lz] = camPoint(cam, 1, 1180, 646);
    env.lights.push({ x: lx, y: ly, r: 760 * lz, i: 0.52, color: '#ffa24c' });
    const sw = sweepAt(t);
    const [bx, by] = camPoint(cam, 1, 880, 700);
    env.proj = { amt: t >= TL.NOW_T ? 1 : 0, sweep: sw, ghost: 0, solid: { x: bx + 90, y: by + 10, r: 400, k: 0.9 } };
    env.rim = 1.15; env.bloom = 0.42; env.thresh = 0.74; env.vig = 0.40;
  });
})();
