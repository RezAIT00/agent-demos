// 27 - 33.4 s : the first dawn. The same planting gesture, in five lands that
// never met. One sun behind all of them.
(() => {
  const NAMES = [
    ['SOUTHWEST ASIA', 'c. 9500 BCE', 28.67],
    ['CHINA', 'c. 7000 BCE', 30.35],
    ['MEXICO', 'c. 7000 BCE', 30.35],
    ['NEW GUINEA', 'c. 5000 BCE', 32.0],
    ['ANDES', 'c. 5000 BCE', 32.0],
  ];
  // widths of the five bands over time
  function widths(t) {
    const a = easeInOut(invLerp(29.75, 30.55, t));   // one -> three
    const b = easeInOut(invLerp(31.45, 32.2, t));    // three -> five
    const w3 = [1920 - a * 1280, a * 640, a * 640, 0, 0];
    const w5 = [384, 384, 384, 384, 384];
    return w3.map((w, i) => lerp(w, w5[i], b));
  }

  const SOIL = '#150a09';
  const dim = (c1, k) => M(c1, '#e59a6a', k);

  function groundBand(near, y, col1, col2, bump = 14, seed = 1) {
    near.fillStyle = vgrad(near, y - 20, H, [[0, col1], [1, col2]]);
    near.beginPath(); near.moveTo(-1100, H + 40);
    for (let x = -1100; x <= 1100; x += 14) near.lineTo(x, y + (fbm1(x * 0.006, seed, 3) - 0.5) * bump * 2);
    near.lineTo(1100, H + 40); near.closePath(); near.fill();
  }

  // the shared gesture: reach down, press a seed in, lift. All five keep time.
  const press = (t) => Math.pow(Math.max(0, Math.sin((t - 27.2) * TAU / 1.0)), 1.5);

  function planter(near, g, t, o) {
    const k = press(t);
    const { x, y, h, face = 1, hat = null, hair = 'bun', dress = 'tunic', stoop = false, stick = false, lit } = o;
    let p;
    if (stoop) p = FIG.stand({ hip: [-0.06, 0.44 - k * 0.03], lean: 0.95 + k * 0.25, footA: [0.10, 0.035], footB: [-0.12, 0.035], handA: [0.40, 0.20 - k * 0.15], handB: [0.27, 0.30 - k * 0.06], tilt: -0.3 });
    else if (stick) p = FIG.stand({ hip: [-0.03, 0.46 - k * 0.07], lean: 0.30 + k * 0.28, footA: [0.12, 0.035], footB: [-0.13, 0.035], handA: [0.30, 0.52 - k * 0.14], handB: [0.24, 0.64 - k * 0.18], tilt: 0.16 });
    else p = FIG.kneel({ lean: 0.36 + k * 0.34, handA: [0.30 + k * 0.02, 0.17 - k * 0.12], handB: [0.12, 0.30], tilt: 0.20 });
    const f = FIG.person(near, { x, y, h, face, p, color: '#2a1210', far: '#1b0b0c', cloth: o.cloth || '#42180f', dress, hat, hair, lit, t });
    if (stick) {
      near.strokeStyle = '#241008'; near.lineWidth = 8; near.lineCap = 'round';
      near.beginPath(); near.moveTo(f.handB[0] - face * 20, f.handB[1] - 62); near.lineTo(f.handA[0] + face * 42, y + 4 - (1 - k) * 34); near.stroke();
    }
    // the seed catches the low sun
    const sx = f.handA[0] + face * 12, sy = Math.min(y - 4, f.handA[1] + 14);
    if (!stick) glow(g, sx, sy, 20, '#ffd38a', 0.30 + 0.55 * k);
    return f;
  }

  function wheat(near, t, x0, x1, y, hh, grow, seed, col, headCol, n) {
    near.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const bx = lerp(x0, x1, hash2(i, seed));
      const g = clamp(grow * 1.5 - hash2(i, seed + 4) * 0.5);
      if (g <= 0.03) continue;
      const h = hh * (0.55 + hash2(i, seed + 1) * 0.65) * g;
      const by = y + hash2(i, seed + 2) * 70 - 10;
      const sway = Math.sin(t * 1.9 + bx * 0.011 + i) * 7;
      const tx = bx + sway + (hash2(i, seed + 3) - 0.5) * 26;
      near.strokeStyle = col; near.lineWidth = 2.6;
      near.beginPath(); near.moveTo(bx, by); near.quadraticCurveTo(bx, by - h * 0.6, tx, by - h); near.stroke();
      if (g > 0.45) {
        near.fillStyle = headCol;
        const k = (g - 0.45) / 0.55;
        for (let j = 0; j < 5; j++) {
          oval(near, tx - 3.2, by - h - j * 6.4 * k, 3.1 * k, 5.4 * k, -0.45);
          oval(near, tx + 3.2, by - h - j * 6.4 * k - 3, 3.1 * k, 5.4 * k, 0.45);
        }
        near.strokeStyle = headCol; near.lineWidth = 1.1;
        near.beginPath(); near.moveTo(tx, by - h - 28 * k); near.lineTo(tx + sway * 0.4 - 9, by - h - 62 * k); near.moveTo(tx, by - h - 28 * k); near.lineTo(tx + sway * 0.4 + 8, by - h - 60 * k); near.stroke();
      }
    }
  }

  const BAND = [
    // ---- southwest Asia: wheat and barley --------------------------------
    function swAsia(far, near, g, t, lit) {
      ridge(far, { y: 668, amp: 62, freq: 0.0022, seed: 14, scroll: 500, color: '#8a4456', x0: -1100, x1: 1100 });
      ridge(far, { y: 736, amp: 38, freq: 0.0036, seed: 21, scroll: 120, color: '#5c2b38', x0: -1100, x1: 1100 });
      far.fillStyle = '#48202c';
      for (const [x, w] of [[-470, 130], [-336, 96], [470, 112], [590, 84]]) { far.fillRect(x, 712 - w * 0.38, w, w * 0.62); far.fillRect(x - 6, 712 - w * 0.42, w + 12, 9); }
      FIG.dog(far, -250, 786, 54, t, '#3e1a24', 1);
      PROPS.acacia(far, 690, 788, 170, '#44202e', 77);
      groundBand(near, 842, '#4a2014', SOIL, 16, 15);
      const grow = invLerp(27.6, 30.2, t);
      wheat(near, t, -960, -190, 856, 220, grow, 3, '#5c3014', '#b4762c', 230);
      wheat(near, t, 190, 960, 856, 220, grow, 4, '#5c3014', '#b4762c', 230);
      planter(near, g, t, { x: -40, y: 962, h: 430, hat: 'scarfhead', dress: 'robe', lit });
      near.fillStyle = '#220e0a';
      blob(near, [[-205, 968], [-222, 925], [-190, 898], [-140, 900], [-118, 930], [-132, 968]], 0.8);   // seed basket
      near.fillStyle = '#e0aa5a'; for (let i = 0; i < 24; i++) disc(near, -196 + hash(i) * 56, 902 + hash(i + 5) * 8, 3);
      wheat(near, t, -420, 420, 1050, 110, grow, 9, '#38190c', '#9c6a2c', 60);
    },
    // ---- China: rice in flooded fields ------------------------------------
    function china(far, near, g, t, lit) {
      for (const [x, w, h, c] of [[-330, 190, 250, '#8d5872'], [-90, 130, 310, '#9b6479'], [150, 220, 220, '#8d5872'], [390, 140, 280, '#a06a7e'], [-520, 170, 200, '#a06a7e']]) {
        far.fillStyle = c;
        blob(far, [[x - w * 0.62, 750], [x - w * 0.34, 750 - h * 0.62], [x - w * 0.2, 750 - h * 0.96], [x + w * 0.08, 750 - h], [x + w * 0.3, 750 - h * 0.72], [x + w * 0.36, 750 - h * 0.4], [x + w * 0.66, 750]], 0.75);
      }
      ridge(far, { y: 748, amp: 12, freq: 0.006, seed: 33, color: '#59334a', x0: -1000, x1: 1000 });
      far.fillStyle = '#3d2032';                                            // house on stilts
      fillPoly(far, [[68, 700], [140, 652], [212, 700]]); far.fillRect(86, 696, 108, 34);
      for (const px of [92, 128, 156, 186]) far.fillRect(px, 726, 5, 30);
      // water holding the sky
      near.fillStyle = vgrad(near, 772, H, [[0, '#d88a72'], [0.25, '#8a4c5e'], [1, '#1d0f1c']]);
      near.fillRect(-1000, 774, 2000, H);
      near.strokeStyle = 'rgba(255,214,160,0.42)';
      for (let i = 0; i < 70; i++) {
        const y = 782 + Math.pow(hash(i + 60), 1.4) * 280, x = (hash(i + 80) - 0.5) * 1100;
        near.lineWidth = 1 + (y - 780) / 140;
        const w = 20 + hash(i + 90) * 60, d = Math.sin(t * 1.5 + i) * 7;
        near.beginPath(); near.moveTo(x + d, y); near.lineTo(x + w + d, y); near.stroke();
      }
      near.fillStyle = '#2a1118';
      for (const y of [806, 862, 944]) { near.beginPath(); near.moveTo(-1000, y); near.quadraticCurveTo(0, y - 12, 1000, y + 6); near.lineTo(1000, y + 11 + (y - 800) / 14); near.quadraticCurveTo(0, y - 2 + (y - 800) / 14, -1000, y + 9 + (y - 800) / 14); near.fill(); }
      const grow = invLerp(29.6, 31.9, t);
      for (let r = 0; r < 4; r++) {
        const y = [834, 900, 990, 1050][r], hh = 24 + r * 13;
        for (let x = -600; x < 600; x += 34 + r * 9) {
          if (Math.abs(x - 20) < 95 && r < 3) continue;
          near.strokeStyle = '#33200f'; near.lineWidth = 2.4 + r * 0.5;
          near.beginPath();
          for (let k = -2; k <= 2; k++) { near.moveTo(x, y); near.quadraticCurveTo(x + k * 5, y - hh * 0.8 * grow, x + k * 10 + Math.sin(t * 2 + x) * 2, y - hh * (0.5 + grow * 0.6) * (1 - Math.abs(k) * 0.15)); }
          near.stroke();
        }
      }
      planter(near, g, t, { x: -30, y: 936, h: 400, hat: 'conical', stoop: true, cloth: '#2c1420', lit });
    },
    // ---- Mexico: maize --------------------------------------------------
    function mexico(far, near, g, t, lit) {
      far.fillStyle = '#87485a';
      blob(far, [[-560, 748], [-260, 640], [-70, 468], [-34, 482], [10, 462], [52, 474], [230, 632], [540, 748]], 0.35);
      far.fillStyle = 'rgba(255,196,180,0.5)'; fillPoly(far, [[-70, 468], [-34, 482], [10, 462], [52, 474], [78, 500], [30, 492], [4, 512], [-30, 496], [-66, 512], [-98, 494]]);
      puff(far, 40 + Math.sin(t) * 5, 430, 90, 30, '#c58a8c', 0.35);
      ridge(far, { y: 742, amp: 30, freq: 0.004, seed: 44, color: '#572a38', x0: -1000, x1: 1000 });
      far.fillStyle = '#431d2a';
      for (const [x, s] of [[-300, 70], [330, 58]]) for (let i = -4; i <= 4; i++) chain(far, [[x, 790, s * 0.12], [x + i * s * 0.22, 790 - s * (1 - Math.abs(i) * 0.12), 2]]);
      groundBand(near, 856, '#3f1b12', SOIL, 12, 45);
      const grow = invLerp(29.8, 32.3, t);
      const maize = (x, y, h, seed) => {
        const sw = Math.sin(t * 1.6 + seed) * 6;
        near.fillStyle = '#2d1c0c'; chain(near, [[x, y, 7], [x + sw * 0.4, y - h * 0.6, 5], [x + sw, y - h, 2.5]]);
        for (let i = 0; i < 6; i++) {
          const u = 0.16 + i * 0.13, d = (i + seed) % 2 ? 1 : -1, bx = x + sw * u, by = y - h * u, len = h * (0.32 - i * 0.025);
          near.fillStyle = i % 3 ? '#2d1c0c' : '#4a2c12';
          near.beginPath(); near.moveTo(bx, by); near.quadraticCurveTo(bx + d * len * 0.6, by - len * 0.75, bx + d * len, by - len * 0.12 + sw); near.quadraticCurveTo(bx + d * len * 0.5, by - len * 0.34, bx, by - 14); near.fill();
        }
        if (h > 110) { near.fillStyle = '#c8872f'; oval(near, x + sw * 0.5 + 9, y - h * 0.52, 8, 24, 0.3); }
        near.strokeStyle = '#b9823a'; near.lineWidth = 2;
        near.beginPath(); for (let k = -3; k <= 3; k++) { near.moveTo(x + sw, y - h); near.lineTo(x + sw + k * 8, y - h - 28 + Math.abs(k) * 5); } near.stroke();
      };
      for (let i = 0; i < 20; i++) {
        let x = -440 + i * 46 + (hash(i + 4) - 0.5) * 24;
        if (Math.abs(x - 10) < 120) x += x < 10 ? -150 : 150;
        maize(x, 872 + hash(i) * 56, (170 + hash(i + 9) * 130) * (0.45 + 0.55 * grow), i);
      }
      planter(near, g, t, { x: -46, y: 972, h: 420, hair: 'long', stick: true, cloth: '#3d150f', lit });
    },
    // ---- New Guinea highlands: taro in mounds ------------------------------
    function guinea(far, near, g, t, lit) {
      ridge(far, { y: 560, amp: 110, freq: 0.0042, seed: 51, color: '#7c5373', x0: -1000, x1: 1000 });
      puff(far, -80, 660, 430, 52, '#e3a79a', 0.55);
      ridge(far, { y: 700, amp: 74, freq: 0.0056, seed: 52, color: '#4d2f46', x0: -1000, x1: 1000 });
      puff(far, 160, 756, 360, 34, '#c98c8a', 0.42);
      far.fillStyle = '#341d2c';
      for (const [x, y, s] of [[-150, 784, 150], [168, 792, 190], [262, 786, 120]]) {   // tree ferns
        chain(far, [[x, y, 7], [x + 8, y - s, 4]]);
        for (let i = 0; i < 9; i++) { const a = -PI + i * PI / 8; chain(far, [[x + 8, y - s, 5], [x + 8 + Math.cos(a) * s * 0.28, y - s + Math.sin(a) * s * 0.20, 3.4], [x + 8 + Math.cos(a) * s * 0.46, y - s + Math.sin(a) * s * 0.16 + s * 0.14, 1]]); }
      }
      groundBand(near, 860, '#2f1612', SOIL, 10, 53);
      for (const [x, y, w] of [[-170, 892, 150], [150, 884, 130], [-90, 1020, 170], [190, 996, 150]]) { near.fillStyle = '#25100e'; blob(near, [[x - w / 2, y + 12], [x - w * 0.3, y - 22], [x, y - 32], [x + w * 0.3, y - 20], [x + w / 2, y + 12]], 0.8); }
      const grow = invLerp(31.2, 33.2, t);
      const taro = (x, y, s, seed) => {
        for (let i = 0; i < 4; i++) {
          const a = -PI / 2 + (i - 1.5) * 0.55, len = s * (0.8 + hash(seed + i) * 0.4) * (0.55 + 0.45 * grow);
          const ex = x + Math.cos(a) * len + Math.sin(t * 1.5 + i + seed) * 3, ey = y + Math.sin(a) * len;
          near.strokeStyle = '#2c2210'; near.lineWidth = 5; near.beginPath(); near.moveTo(x, y); near.quadraticCurveTo(x, ey + len * 0.3, ex, ey); near.stroke();
          near.fillStyle = i % 2 ? '#2f2912' : '#453417';
          const r = s * 0.36 * (0.6 + 0.4 * grow), tilt = (i - 1.5) * 0.5;
          near.save(); near.translate(ex, ey); near.rotate(tilt);
          near.beginPath(); near.moveTo(0, -r * 0.2); near.bezierCurveTo(r * 0.9, -r * 0.9, r * 1.1, r * 0.35, 0, r * 1.3); near.bezierCurveTo(-r * 1.1, r * 0.35, -r * 0.9, -r * 0.9, 0, -r * 0.2); near.fill();
          near.restore();
        }
      };
      taro(-170, 874, 120, 2); taro(150, 866, 105, 5); taro(-135, 1002, 150, 8); taro(180, 980, 138, 11);
      planter(near, g, t, { x: -26, y: 962, h: 400, hair: 'curls', stick: true, dress: 'wrap', lit });
    },
    // ---- the Andes: potatoes on terraces -------------------------------------
    function andes(far, near, g, t, lit) {
      far.fillStyle = '#84557a';
      fillPoly(far, [[-560, 760], [-290, 470], [-205, 540], [-70, 356], [24, 470], [96, 420], [270, 600], [350, 520], [560, 760]]);
      far.fillStyle = 'rgba(255,214,206,0.82)';
      fillPoly(far, [[-70, 356], [-18, 420], [-42, 412], [-62, 446], [-84, 414], [-120, 424]]);
      fillPoly(far, [[96, 420], [140, 466], [118, 460], [98, 486], [80, 454], [58, 450]]);
      fillPoly(far, [[-290, 470], [-250, 504], [-276, 500], [-292, 520], [-306, 497], [-326, 508]]);
      for (let i = 0; i < 5; i++) {
        far.fillStyle = M('#6a3650', '#2c1426', i / 4);
        const y = 668 + i * 38;
        far.beginPath(); far.moveTo(-700, H); far.lineTo(-700, y + 30 - i * 4);
        far.bezierCurveTo(-300, y - 26, 60, y + 26, 700, y - 16); far.lineTo(700, H); far.fill();
        far.strokeStyle = 'rgba(236,160,130,0.45)'; far.lineWidth = 2.5;
        far.beginPath(); far.moveTo(-700, y + 30 - i * 4); far.bezierCurveTo(-300, y - 26, 60, y + 26, 700, y - 16); far.stroke();
      }
      far.fillStyle = '#31172a'; FIG.camel(far, 150, 800, 74, t * 0.25, '#31172a', -1);   // llama-sized grazer
      groundBand(near, 868, '#34160f', SOIL, 10, 63);
      const bush = (x, y, s) => {
        near.fillStyle = '#2b1d0e';
        for (let i = 0; i < 13; i++) oval(near, x + (hash(i + x) - 0.5) * s * 1.5, y - hash(i + 7 + x) * s * 0.75, s * 0.3, s * 0.17, (hash(i + 3) - 0.5) * 1.4);
        near.fillStyle = '#e9c7e4'; for (let i = 0; i < 3; i++) disc(near, x + (hash(i + 2 + x) - 0.5) * s, y - s * 0.7 - hash(i + x) * 8, 3.6);
      };
      for (let i = 0; i < 10; i++) { let x = -330 + i * 70; if (Math.abs(x) < 110) x += x < 0 ? -110 : 110; bush(x, 900 + (i % 3) * 18, 42 + hash(i) * 22); }
      for (let i = 0; i < 7; i++) bush(-300 + i * 100, 1036 + (i % 2) * 16, 62);
      planter(near, g, t, { x: -40, y: 968, h: 420, hat: 'cap', stick: true, dress: 'tunic', cloth: '#4a1712', lit });
    },
  ];

  // where each household keeps its cooking fire: [x, y, size]
  const HEARTHS = [[178, 976, 1.0], [146, 757, 0.52], [150, 992, 0.92], [-158, 978, 0.9], [150, 990, 0.92]];

  defineScene('farm', 27.0, { kind: 'dawn', dur: 1.5, center: [960, 700] }, (S) => {
    const { t, env, back, far, near, glow: g } = S;
    const day = ramp(26.8, 33.2, t);
    const sunY = lerp(748, 520, day), sunX = 1035;
    env.sky = {
      top: M('#171a3e', '#3a5a94', day), mid: M('#6a3563', '#c8748a', day), low: M('#f08a52', '#ffd491', day),
      ground: '#5a2c34', horizon: 742, midAt: 0.60, cloud: 0.55, cloudColor: M('#8a4a6a', '#e89a90', day),
      sun: { x: sunX, y: sunY, r: 52, color: M('#f08844', '#f6cf90', day), glow: 118, k: 0.78 },
    };
    env.haze = { color: '#e08a70', amt: 0.17 };
    env.skyRim = '#ffc89a'; env.skyRimAmt = 0.30;
    SKY.stars(back, t, { alpha: 0.55 * (1 - ramp(26.9, 28.7, t)), pole: [420, -260], horizon: 560, density: 0.5 });

    const w = widths(t);
    const zoom = lerp(1.14, 1.0, easeOut(invLerp(26.6, 29.7, t)));
    let L = 0;
    for (let i = 0; i < 5; i++) {
      const wi = w[i];
      if (wi < 1) { L += wi; continue; }
      const cxp = L + wi / 2;
      const content = cxp + (i === 0 ? 0 : 0);
      for (const c of [far, near, g]) {
        c.save(); c.beginPath(); c.rect(L, 0, wi, H); c.clip();
        c.translate(content, 640); c.scale(zoom, zoom); c.translate(0, -640);
      }
      const lit = { x: sunX - content, y: sunY, r: 900, color: '#a8502a', k: 0.34 };
      BAND[i](far, near, g, t, lit);
      const [hx, hy, hs] = HEARTHS[i];
      if (i !== 1) {
        near.fillStyle = '#1c0c0a';
        for (let k = 0; k < 7; k++) oval(near, hx - 40 * hs + k * 13.5 * hs, hy + 5 + (k % 2) * 4, 10 * hs, 6.5 * hs);
        PROPS.logs(near, hx, hy - 2, 25 * hs, '#180a06');
      }
      PROPS.coals(g, hx, hy - 4, 28 * hs, t, 0.9);
      for (const c of [far, near, g]) c.restore();
      const fxs = content + hx * zoom, fys = 640 + (hy - 640) * zoom;
      if (fxs > L + 8 && fxs < L + wi - 8) {
        env.flames.push({ x: fxs, y: fys - 5, w: 15 * hs * zoom, h: 56 * hs * zoom, i: 0.98, seed: 70 + i, halo: 0.9 });
        if (i === 0) env.lights.push({ x: fxs, y: fys - 24, r: 260, i: 0.5 * flick(t, 71), color: '#ff9438' });
      }

      // seams between lands
      if (i > 0 && wi > 4) {
        near.fillStyle = '#0d060c'; near.fillRect(L - 3, 0, 6, H);
        glow(g, L, 760, 60, '#ffb070', 0.18);
        const sg = g.createLinearGradient(0, 200, 0, H);
        sg.addColorStop(0, 'rgba(255,196,140,0)'); sg.addColorStop(0.55, 'rgba(255,196,140,0.55)'); sg.addColorStop(1, 'rgba(255,196,140,0.08)');
        g.fillStyle = sg; g.fillRect(L - 1, 200, 2, H - 200);
      }
      const [name, date, when] = NAMES[i];
      const a = ramp(when, when + 0.18, t) * (1 - ramp(33.42, 33.66, t)) * clamp((wi - 250) / 120);
      if (a > 0.01) {
        const full = wi > 900;
        HUD.riding.push({ x: cxp, y: 994, a, lines: [[name, name.length > 11 ? 30 : 36, '#fff4e4', name.length > 11 ? 5 : 8], [date, 34, '#ffcf8e', 6]] });
      }
      L += wi;
    }

    // seed motes in the low light
    sparks(g, 960, 1000, t, { n: 36, spread: 1900, height: 380, size: 2.0, alpha: 0.30, seed: 55, color: '#ffe2a8', speed: 0.45 });
    env.lights.push({ x: sunX, y: sunY, r: 1250, i: 0.30, color: '#ff9a58' });
    env.rim = 1.15;
    env.bloom = 0.30; env.thresh = 0.90; env.vig = 0.26;
  });
})();
