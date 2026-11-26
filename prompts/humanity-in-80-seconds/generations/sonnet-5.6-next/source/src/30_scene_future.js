// 65.6 - 73 s : one life, walked left to right.   73 - 75.5 s : a hill in 2100.
// 75.5 - 80 s : the first gesture again.  Everything here is projection.
(() => {
  const SCARF = '#c0401f';
  const age = (t) => TL.yearAt(t) - TL.NOW_YEAR;

  // camera travel, with two places where the walker stops to do something
  const camX = (t) => keys([[65.0, -380], [65.9, 20], [66.5, 480], [67.2, 1060], [68.1, 1880], [68.85, 2500], [69.1, 2620], [69.8, 2650], [70.15, 2980], [70.45, 3300], [70.65, 3372], [71.05, 3400], [71.4, 3720], [72.2, 4420], [73.0, 5080], [73.8, 5500]], t);
  const WALKER_X = 700;
  const GROW = 1.46;                       // the one life fills the frame
  const FD = 0.8;                          // depth of the district skylines
  // keys() eases between points; sample it finely to integrate the footfalls
  const STEPS = (() => {
    const hz = 120, out = [0];
    let prev = camX(65);
    for (let i = 1; i <= 120 * 9; i++) { const x = camX(65 + i / hz); out.push(out[i - 1] + Math.abs(x - prev)); prev = x; }
    return (t) => { const k = clamp((t - 65) * hz, 0, out.length - 2), i = k | 0; return lerp(out[i], out[i + 1], k - i); };
  })();

  const heightAt = (a) => keys([[0, 150], [6, 188], [10, 236], [15, 300], [20, 338], [55, 336], [67, 312], [74, 304]], a);

  function turbine(c, x, y, h, t, seed, col = '#8fa6b8') {
    c.fillStyle = col; fillPoly(c, [[x - h * 0.028, y], [x - h * 0.012, y - h], [x + h * 0.012, y - h], [x + h * 0.028, y]]);
    const a0 = t * 1.9 + hash(seed) * TAU;
    for (let k = 0; k < 3; k++) {
      const a = a0 + k * TAU / 3;
      const tx = x + Math.cos(a) * h * 0.52, ty = y - h + Math.sin(a) * h * 0.52;
      c.beginPath(); c.moveTo(x, y - h);
      c.quadraticCurveTo(x + Math.cos(a + 0.28) * h * 0.2, y - h + Math.sin(a + 0.28) * h * 0.2, tx, ty);
      c.quadraticCurveTo(x + Math.cos(a - 0.06) * h * 0.2, y - h + Math.sin(a - 0.06) * h * 0.2, x, y - h);
      c.fill();
    }
    disc(c, x, y - h, h * 0.026);
  }
  function solarHome(c, x, y, w, h, col, seed) {
    c.fillStyle = col; c.fillRect(x, y - h, w, h + 6);
    fillPoly(c, [[x - 14, y - h + 4], [x + w * 0.30, y - h - 74], [x + w + 14, y - h + 4]]);
    c.fillStyle = '#233a5c'; fillPoly(c, [[x + w * 0.34, y - h - 68], [x + w * 0.96, y - h - 10], [x + w * 0.90, y - h - 3], [x + w * 0.31, y - h - 59]]);
    c.strokeStyle = '#8cb4dc'; c.lineWidth = 1.4; for (let i = 1; i < 7; i++) { const u = i / 7; c.beginPath(); c.moveTo(lerp(x + w * 0.34, x + w * 0.96, u), lerp(y - h - 68, y - h - 10, u)); c.lineTo(lerp(x + w * 0.31, x + w * 0.90, u), lerp(y - h - 59, y - h - 3, u)); c.stroke(); }
    c.fillStyle = '#2a2630'; for (let i = 0; i < 2; i++) c.fillRect(x + 22 + i * (w - 74), y - h + 28, 30, 36);
    c.fillStyle = 'rgba(255,208,140,0.55)'; c.fillRect(x + 24 + (seed % 2) * (w - 74), y - h + 31, 26, 30);
    c.fillStyle = '#3a2c2c'; c.fillRect(x + w * 0.44, y - 56, 26, 58);
  }
  function leafTree(c, x, y, h, t, seed, c1 = '#24483a', c2 = '#2f5a46') {
    c.fillStyle = '#2a1e1c'; chain(c, [[x, y + 6, h * 0.045], [x + 3, y - h * 0.5, h * 0.025], [x - 4, y - h * 0.66, h * 0.016]]);
    chain(c, [[x + 2, y - h * 0.4, h * 0.018], [x + h * 0.18, y - h * 0.62, h * 0.008]]);
    const r = rng(seed);
    for (let i = 0; i < 34; i++) {
      const a = r() * TAU, d = Math.sqrt(r());
      c.fillStyle = r() < 0.5 ? c1 : c2;
      disc(c, x + Math.cos(a) * d * h * 0.34 + Math.sin(t * 1.5 + i) * 1.6, y - h * 0.74 + Math.sin(a) * d * h * 0.25, h * (0.07 + r() * 0.06));
    }
  }
  // the lantern the walker keeps: the one solid thing
  function lantern(near, g, env, x, y, s, t) {
    near.strokeStyle = '#141018'; near.lineWidth = 3.2 * s; near.beginPath(); near.arc(x, y + 6 * s, 14 * s, PI, 0); near.stroke();
    near.fillStyle = '#141018'; near.fillRect(x - 17 * s, y + 6 * s, 34 * s, 6 * s); near.fillRect(x - 17 * s, y + 42 * s, 34 * s, 7 * s);
    g.fillStyle = 'rgba(255,190,96,0.90)'; g.fillRect(x - 12 * s, y + 13 * s, 24 * s, 28 * s);
    glow(g, x, y + 27 * s, 120 * s, '#ff9c34', 0.44 * flick(t, 51));
    env.lights.push({ x, y: y + 27 * s, r: 250 * s, i: 0.62 * flick(t, 52), color: '#ff9a3a' });
    env.flames.push({ x, y: y + 38 * s, w: 7 * s, h: 27 * s, i: 0.92, seed: 51, halo: 0.5 });
    return [x, y + 27 * s];
  }

  // a soft lattice of light: help that is not a person
  function lattice(g, x, y, r, t, a, reach) {
    if (a <= 0.01) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    const nodes = [];
    for (let i = 0; i < 38; i++) {
      const th = hash(i + 7) * TAU + t * (0.35 + hash(i) * 0.3) * (i % 2 ? 1 : -1);
      const ph = Math.acos(2 * hash(i + 91) - 1);
      const px = Math.sin(ph) * Math.cos(th), py = Math.cos(ph), pz = Math.sin(ph) * Math.sin(th);
      const rr = r * (0.66 + 0.34 * hash(i + 13));
      nodes.push([x + px * rr, y + py * rr * 0.86 + Math.sin(t * 2 + i) * 5, pz]);
    }
    g.lineWidth = 1.5;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]);
      if (d > r * 0.62) continue;
      g.strokeStyle = `rgba(132,206,255,${a * 0.34 * (1 - d / (r * 0.62))})`;
      g.beginPath(); g.moveTo(nodes[i][0], nodes[i][1]); g.lineTo(nodes[j][0], nodes[j][1]); g.stroke();
    }
    for (const [nx, ny, nz] of nodes) glow(g, nx, ny, 12 + nz * 5, '#9fdcff', a * (0.55 + 0.25 * nz));
    glow(g, x, y, r * 1.25, '#5a9ae0', a * 0.22);
    if (reach) {
      g.strokeStyle = `rgba(190,232,255,${a * 0.7})`; g.lineWidth = 2;
      g.setLineDash([3, 9]); g.lineDashOffset = -t * 40;
      g.beginPath(); g.moveTo(x - r * 0.5, y + r * 0.2); g.quadraticCurveTo((x + reach[0]) / 2, y + r * 0.7, reach[0], reach[1]); g.stroke(); g.setLineDash([]);
    }
    g.restore();
  }

  function moonLights(g, mx, my, mr, a) {
    for (const [dx, dy, s] of [[-0.46, 0.18, 1], [-0.36, 0.30, 0.8], [-0.55, 0.30, 0.6], [-0.28, 0.14, 0.55]]) {
      glow(g, mx + dx * mr, my + dy * mr, 11 * s, '#ffd89a', a);
      g.fillStyle = `rgba(255,236,196,${a})`; disc(g, mx + dx * mr, my + dy * mr, 1.9 * s + 0.4);
    }
  }

  defineScene('walk', 65.84, { kind: 'pan', dur: 0.86 }, (S) => {
    const { t, env, back, far, near, glow: g } = S;
    const cx = camX(t), A = age(t);
    const sk = (a, b, c, d, e) => keys([[65.8, a], [67.9, b], [69.4, c], [70.9, d], [72.8, e]], t);
    const rgbk = (arr) => { const v = sk(...arr.map(hex)); return rgb(v); };
    const sunA = keys([[66.6, 0.62], [67.8, 0.95], [69.2, 0.6], [70.6, 0.28], [71.4, 0]], t);
    env.sky = {
      top: rgbk(['#1c3a6c', '#4a5a80', '#2c4470', '#14224e', '#0a1238']),
      mid: rgbk(['#5a86a8', '#b09290', '#7a8a98', '#4a4a7c', '#2a2c5c']),
      low: rgbk(['#c8d4c8', '#f0bc8c', '#e8cc9c', '#c88478', '#8a5470']),
      ground: '#20303a', horizon: 730, midAt: 0.58, cloud: 0.36, cloudColor: rgbk(['#c0d0dc', '#e0ac98', '#d8c8b4', '#8a6c8c', '#4c3c64']),
      sun: sunA > 0.01 ? { x: 1800 - (t - 66) * 66, y: keys([[66, 560], [68, 560], [70, 620], [71.4, 740]], t), r: keys([[66, 36], [68, 56], [70, 40]], t), color: '#f4c490', glow: keys([[66, 70], [68, 104], [70, 80]], t), k: sunA * 0.72 } : null,
    };
    const moonUp = ramp(70.8, 72.0, t);
    if (moonUp > 0) env.sky.moon = { x: 1520, y: lerp(430, 262, moonUp), r: 52, color: '#e4e8f4', a: moonUp };
    env.haze = { color: env.sky.low, amt: 0.22 };
    env.skyRim = '#bfe4ff'; env.skyRimAmt = 0.34;
    SKY.stars(back, t, { alpha: 0.75 * ramp(71.2, 73.2, t), pole: [500, -300], horizon: 560, density: 0.6 });
    if (moonUp > 0) moonLights(g, 1520, lerp(430, 262, moonUp), 52, moonUp);

    const fx = (wx) => wx - cx * FD, nx = (wx) => wx - cx;
    const gy = 962;
    ridge(far, { y: 690, amp: 52, freq: 0.0019, seed: 211, scroll: cx * 0.1, color: '#4a6478' });
    ridge(far, { y: 742, amp: 30, freq: 0.0031, seed: 212, scroll: cx * 0.22, color: '#35505a' });

    // ---- a street with the sun on its roofs
    for (const [wx, h] of [[420, 230], [820, 292], [1180, 214]]) turbine(far, fx(wx), 722, h, t, wx, '#98aab6');
    for (let i = 0; i < 5; i++) solarHome(far, fx(60 + i * 290), 818, 176 + (i % 3) * 26, 130 + (i % 2) * 34, ['#6e605e', '#586470', '#706454'][i % 3], i);

    // ---- the coast: higher water, an old street under it
    const sea0 = fx(1700), sea1 = fx(3300);
    if (sea1 > -60 && sea0 < W + 60) {
      far.fillStyle = vgrad(far, 742, 900, [[0, '#7c98a0'], [0.3, '#3c6272'], [1, '#183446']]);
      far.fillRect(sea0, 744, sea1 - sea0, 300);
      for (let i = 0; i < 6; i++) {                                     // drowned houses
        const x = fx(1860 + i * 232), w = 138 + (i % 3) * 24, h = 160 + hash(i + 4) * 74, y = 872 + (i % 2) * 14, waterline = 810 + (i % 2) * 12;
        far.save(); far.beginPath(); far.rect(x - 40, 400, w + 80, waterline - 400); far.clip();
        far.fillStyle = '#42505a'; far.fillRect(x, y - h, w, h); fillPoly(far, [[x - 10, y - h + 3], [x + w / 2, y - h - 48], [x + w + 10, y - h + 3]]);
        far.fillStyle = '#1c2832'; for (let k = 0; k < 3; k++) far.fillRect(x + 14 + k * (w - 44) / 2, y - h + 24, 16, 24);
        far.restore();
        far.strokeStyle = 'rgba(206,232,236,0.6)'; far.lineWidth = 2.4; far.beginPath(); far.moveTo(x - 16, waterline + Math.sin(t * 2 + i) * 2); far.lineTo(x + w + 16, waterline - Math.sin(t * 2 + i) * 2); far.stroke();
      }
      far.strokeStyle = 'rgba(224,236,236,0.4)'; far.lineWidth = 1.8;
      for (let i = 0; i < 60; i++) { const x = lerp(sea0, sea1, hash(i + 5)), y = 752 + Math.pow(hash(i + 15), 1.3) * 130; far.beginPath(); far.moveTo(x, y); far.lineTo(x + 16 + hash(i) * 40 + Math.sin(t * 2 + i) * 6, y); far.stroke(); }
      for (const wx of [2900, 3070, 3230]) turbine(far, fx(wx), 762, 176, t, wx, '#8ea4b0');
    }

    // ---- ground, by district
    near.fillStyle = vgrad(near, 952, H, [[0, '#2a3234'], [1, '#0a0e12']]); near.fillRect(-80, gy, W + 160, 200);
    // the sea wall, and below it a window into the water
    const w0 = nx(1830), w1 = nx(3080);
    if (w1 > -80 && w0 < W + 80) {
      near.fillStyle = '#5a666c'; fillPoly(near, [[w0, gy + 4], [w0 + 60, gy - 8], [w1 - 60, gy - 8], [w1, gy + 4], [w1, gy + 26], [w0, gy + 26]]);
      near.fillStyle = vgrad(near, 986, H, [[0, '#2a6272'], [1, '#08202e']]); near.fillRect(w0 + 20, 988, w1 - w0 - 40, 130);
      near.strokeStyle = 'rgba(190,232,236,0.7)'; near.lineWidth = 2.6; near.beginPath(); for (let x = w0 + 20; x <= w1 - 20; x += 14) { const y = 989 + Math.sin(x * 0.04 + t * 3) * 2.6; x === w0 + 20 ? near.moveTo(x, y) : near.lineTo(x, y); } near.stroke();
      // coral gone white: knuckled branches, brain domes and a few fans
      near.lineCap = 'round';
      for (let i = 0; i < 24; i++) {
        const bx = w0 + 56 + i * ((w1 - w0 - 120) / 24) + (hash(i + 9) - 0.5) * 24, s = 26 + hash(i + 29) * 34;
        const col = i % 11 === 4 ? '#c8806a' : hash(i + 61) < 0.5 ? '#e4e6e0' : '#bfc6c2';
        near.strokeStyle = col; near.fillStyle = col;
        const kind = i % 4;
        if (kind === 1) {                        // brain coral
          near.beginPath(); near.ellipse(bx, 1086, s * 0.9, s * 0.62, 0, PI, 0); near.fill();
          near.strokeStyle = 'rgba(40,70,76,0.55)'; near.lineWidth = 2.2;
          for (let k = 1; k < 4; k++) { near.beginPath(); for (let x = -s * 0.8; x <= s * 0.8; x += 6) { const y = 1086 - Math.sqrt(Math.max(0, 1 - (x / (s * 0.9)) ** 2)) * s * 0.62 * (k / 4) + Math.sin(x * 0.4 + k) * 3; x === -s * 0.8 ? near.moveTo(bx + x, y) : near.lineTo(bx + x, y); } near.stroke(); }
        } else if (kind === 3) {                 // sea fan
          for (let k = 0; k < 9; k++) { const an = -PI + 0.35 + k * (PI - 0.7) / 8; near.lineWidth = 2.2; near.beginPath(); near.moveTo(bx, 1090); near.quadraticCurveTo(bx + Math.cos(an) * s * 0.5, 1090 + Math.sin(an) * s * 1.1, bx + Math.cos(an) * s, 1090 + Math.sin(an) * s * 1.35); near.stroke(); }
          near.lineWidth = 1.2; for (const r of [0.5, 0.85, 1.15]) { near.beginPath(); near.ellipse(bx, 1090, s * r * 0.8, s * r, 0, PI + 0.4, -0.4); near.stroke(); }
        } else {                                 // staghorn: short thick fingers
          const br = (x, y, an, len, wd, d) => { const ex = x + Math.cos(an) * len, ey = y + Math.sin(an) * len; near.lineWidth = wd; near.beginPath(); near.moveTo(x, y); near.lineTo(ex, ey); near.stroke(); if (d > 0) { br(ex, ey, an - 0.55 - hash(i + d) * 0.3, len * 0.68, wd * 0.82, d - 1); br(ex, ey, an + 0.5 + hash(i + d + 3) * 0.3, len * 0.68, wd * 0.82, d - 1); } else disc(near, ex, ey, wd * 0.62); };
          br(bx, 1094, -PI / 2, s * 0.62, 11, 2);
        }
      }
      near.fillStyle = '#31464a'; fillPoly(near, [[w0 + 20, 1100], [w0 + 20, 1078], [w0 + 300, 1066], [w0 + 640, 1080], [w1 - 340, 1062], [w1 - 20, 1078], [w1 - 20, 1100]]);
      for (let i = 0; i < 4; i++) { const x = w0 + 100 + mod(i * 250 + t * 50 * (1 + i * 0.2), Math.max(60, w1 - w0 - 200)), y = 1018 + i * 13; near.fillStyle = '#9ab8bc'; oval(near, x, y, 10, 4.4); fillPoly(near, [[x - 9, y], [x - 18, y - 6], [x - 18, y + 6]]); }
    }
    // ---- planting mangroves where the water comes in
    const mx = nx(WALKER_X + 2660);
    if (mx > -620 && mx < W + 620) {
      near.fillStyle = '#34443f'; near.fillRect(mx - 120, gy - 2, 640, 22);
      const mangrove = (x, y, s) => {
        near.strokeStyle = '#16261e'; near.lineCap = 'round';
        for (const dx of [-0.34, -0.17, 0.02, 0.2, 0.36]) { near.lineWidth = s * 0.028; near.beginPath(); near.moveTo(x, y - s * 0.42); near.quadraticCurveTo(x + dx * s * 0.9, y - s * 0.36, x + dx * s, y + 4); near.stroke(); }
        near.fillStyle = '#1c3c2c'; chain(near, [[x, y - s * 0.4, s * 0.03], [x, y - s * 0.62, s * 0.015]]);
        for (let i = 0; i < 22; i++) { near.fillStyle = i % 2 ? '#1f4432' : '#2c5a40'; oval(near, x + (hash(i + x * 3 | 0) - 0.5) * s * 0.62, y - s * 0.66 - (hash(i + 11) - 0.5) * s * 0.28, s * 0.09, s * 0.055, hash(i) * 2); }
      };
      mangrove(mx + 440, gy + 4, 300); mangrove(mx + 640, gy + 8, 220); mangrove(mx - 420, gy + 6, 180);
      for (let i = 0; i < 4; i++) { const k = ramp(69.1 + i * 0.12, 69.5 + i * 0.12, t); if (k <= 0) continue; const x = mx + 150 + i * 70; near.fillStyle = '#2f6a46'; chain(near, [[x, gy + 4, 3], [x, gy - 34 * k, 2]]); oval(near, x - 9, gy - 34 * k, 11 * k, 5 * k, -0.5); oval(near, x + 9, gy - 38 * k, 11 * k, 5 * k, 0.5); }
    }
    // ---- an open workshop, and help made of light
    const ax = nx(WALKER_X + 3420);
    if (ax > -900 && ax < W + 900) {
      near.fillStyle = '#1f2733'; for (const dx of [-340, 640]) near.fillRect(ax + dx, 470, 18, 500);
      fillPoly(near, [[ax - 390, 478], [ax + 150, 424], [ax + 700, 478], [ax + 700, 500], [ax - 390, 500]]);
      near.fillStyle = '#2a3442'; near.fillRect(ax + 120, 800, 300, 20); near.fillRect(ax + 140, 818, 15, 146); near.fillRect(ax + 386, 818, 15, 146);
      near.fillStyle = '#3c4856'; for (let i = 0; i < 5; i++) near.fillRect(ax + 156 + i * 50, 770 - (i % 2) * 16, 28, 32 + (i % 2) * 16);
      const a = ramp(69.75, 70.2, t) * (1 - ramp(71.25, 71.55, t));
      lattice(g, ax + 285, 640, 170, t, a, [ax + 92, 735]);
      FIG.person(near, { x: ax + 490, y: gy + 2, h: 380, face: -1, color: '#161c24', far: '#10141a', cloth: '#35506a', dress: 'modern', hair: 'long', t, p: FIG.stand({ lean: 0.1, handA: [0.25, 0.55 + Math.sin(t * 3) * 0.02], handB: [0.1, 0.48] }) });
    }
    // ---- a town that kept its shade
    for (let i = 0; i < 10; i++) {
      const x = fx(3860 + i * 250);
      if (x < -420 || x > W + 300) continue;
      far.fillStyle = ['#353d56', '#40405a', '#303c52'][i % 3]; far.fillRect(x, 812 - 150 - (i % 3) * 66, 140, 250);
      for (let k = 0; k < 18; k++) if (hash2(i + 50, k) > 0.52) { far.fillStyle = 'rgba(255,206,136,0.70)'; far.fillRect(x + 18 + (k % 3) * 40, 812 - 128 - (i % 3) * 66 + Math.floor(k / 3) * 32, 13, 17); }
      leafTree(far, x + 190, 818, 150 + (i % 2) * 40, t, i + 61, '#213c36', '#2a4a40');
    }
    for (const [wx, h] of [[6060, 440], [6640, 400], [7100, 480]]) { const x = nx(wx); if (x > -400 && x < W + 400) leafTree(near, x, gy + 12, h, t, wx % 997, '#142c25', '#1c3a2f'); }
    for (const [wx, h, dress, cloth, speed] of [[5420, 330, 'modern', '#4a5c74', -90], [5680, 232, 'tunic', '#7a5a52', 50], [6150, 350, 'dress', '#5a4a70', -60], [6430, 316, 'modern', '#3c6060', 40]]) {
      const x = nx(wx) + (t - 71.5) * speed;
      if (x > -150 && x < W + 150) FIG.person(near, { x, y: gy + 6, h, face: speed < 0 ? -1 : 1, color: '#19202a', far: '#11161e', cloth, dress, hair: wx % 3 ? 'bun' : 'curls', child: h < 200 ? 0.8 : 0, t, p: FIG.walk(t * 1.1 + wx, { stride: 0.28 }) });
    }

    // ================= the one life ======================================
    const h = heightAt(A) * GROW;
    const kid = clamp((15 - A) / 10);
    const old = clamp((A - 56) / 9);
    const moving = clamp(Math.abs(camX(t + 0.08) - camX(t - 0.08)) / 0.16 / 120);
    const ph = (STEPS(t) + t * 40) / (FIG.cycleLength(0.34) * h);
    const planting = pulse(68.95, 69.95, t, 0.24);
    const working = pulse(70.4, 71.2, t, 0.22);
    let p = FIG.walk(ph, { stride: 0.34, lean: 0.06 + old * 0.12, over: { handA: [0.24, 0.53], tilt: -0.02 + old * 0.1 } });
    const standing = FIG.stand({ lean: 0.04 + old * 0.12, handA: [0.24, 0.53] });
    p = FIG.mix(standing, p, moving);
    if (planting > 0) p = FIG.mix(p, FIG.kneel({ lean: 0.46 + 0.14 * Math.max(0, Math.sin(t * 8)), handA: [0.32, 0.16], handB: [0.20, 0.22], tilt: 0.2 }), planting);
    if (working > 0) p = FIG.mix(p, FIG.stand({ lean: 0.10, handA: [0.31, 0.60 + Math.sin(t * 4) * 0.025], handB: [0.23, 0.55], tilt: -0.02 }), working);
    const lit = { x: WALKER_X + 130, y: gy - h * 0.55, r: 460, color: '#9a5428', k: 0.50 };
    const who = (o) => FIG.person(near, { color: '#1c141a', far: '#120d12', lit, t, ...o });

    // beside them at each age: a parent, then a child of their own, then a grandchild
    const parentA = 1 - ramp(66.35, 66.75, t);
    if (parentA > 0.01) { near.save(); near.globalAlpha = parentA; who({ x: WALKER_X + 175 - (1 - parentA) * 260, y: gy + 2, h: 490, cloth: '#57445e', dress: 'dress', hair: 'curls', p: FIG.walk(ph * h / 490 + 0.3, { stride: 0.32, over: { handB: [-0.24, 0.50] } }) }); near.restore(); }
    const ownA = pulse(68.35, 71.0, t, 0.35);
    if (ownA > 0.01) {
      const ch = keys([[68.3, 150], [69.4, 188], [70.8, 246]], t) * GROW;
      near.save(); near.globalAlpha = ownA;
      let cp = FIG.mix(FIG.stand(), FIG.walk((STEPS(t) + t * 40) / (FIG.cycleLength(0.34) * ch) + 0.4, { stride: 0.34 }), moving);
      if (planting > 0) cp = FIG.mix(cp, FIG.kneel({ lean: 0.5, handA: [0.3, 0.15], tilt: 0.24 }), planting);
      who({ x: WALKER_X + 270, y: gy + 8, h: ch, face: planting > 0.5 ? -1 : 1, child: 0.8, cloth: '#c09a50', dress: 'tunic', hair: 'bun', p: cp });
      near.restore();
    }
    const grandA = ramp(72.05, 72.5, t);
    if (grandA > 0.01) { near.save(); near.globalAlpha = grandA; who({ x: WALKER_X + 168, y: gy + 8, h: 256, child: 0.95, cloth: '#b88858', dress: 'tunic', hair: 'curls', p: FIG.mix(FIG.stand(), FIG.walk((STEPS(t) + t * 40) / (FIG.cycleLength(0.32) * 256) + 0.2, { stride: 0.32, over: { handB: [-0.22, 0.52] } }), moving) }); near.restore(); }

    const hero = who({ x: WALKER_X - 20, y: gy + 10, h, child: kid * 0.9, cloth: '#2c4054', dress: A < 14 ? 'tunic' : 'coat', hair: A < 13 ? 'curls' : 'bun', scarf: SCARF, wind: 0.25 + 0.35 * moving, accent: null, p });
    if (old > 0.4) { near.strokeStyle = '#1c141a'; near.lineWidth = 10; near.beginPath(); near.moveTo(hero.handB[0], hero.handB[1]); near.lineTo(hero.handB[0] + 14, gy + 8); near.stroke(); }
    // keep the scarf's colour through the projection: a faint warm trace on top
    g.save(); g.globalAlpha = 0.52; g.strokeStyle = '#7a2208'; g.lineWidth = h * 0.019; g.lineCap = 'round';
    g.beginPath(); g.moveTo(hero.shoulder[0] + 10, hero.shoulder[1] - h * 0.035); g.quadraticCurveTo(hero.shoulder[0] - h * 0.08, hero.shoulder[1] - h * 0.02 + Math.sin(t * 4) * 4, hero.shoulder[0] - h * 0.15, hero.shoulder[1] + h * 0.03 + Math.sin(t * 4.3) * 7); g.stroke(); g.restore();
    const la = lantern(near, g, env, hero.handA[0] + 6, hero.handA[1] + 6, 0.78 + 0.44 * (h / 490), t);

    PROPS.grass(near, t, { y: 1052, n: 26, h: 40, color: '#0a1014', seed: 231, scroll: cx * 1.3, x1: W + 400, spreadY: 40 });

    const spread = 4 + 20 * clamp(A / 74);           // the uncertainty grows with distance from now
    env.proj = { amt: 1, sweep: 4000, ghost: spread, solid: { x: la[0], y: la[1], r: 285, k: 0.88 } };
    env.rim = 1.1; env.bloom = 0.42; env.thresh = 0.76; env.vig = 0.26;
  });

  // ---- 2093-2096: the hill by the sea, under the first sky --------------------
  defineScene('hill', 73.15, { kind: 'light', dur: 0.72, center: [900, 842] }, (S) => {
    const { t, env, back, far, near, glow: g } = S;
    env.sky = { top: '#030614', mid: '#0a1232', low: '#2c2c52', ground: '#0c1224', horizon: 712, midAt: 0.56, milky: 1.0, moon: { x: 1520, y: 262, r: 52, color: '#e4e8f4', a: 1 } };
    env.haze = { color: '#2a2c4c', amt: 0.24 };
    env.skyRim = '#a0c0ff'; env.skyRimAmt = 0.30;
    // at one year a second the stars have stopped: points, as sharp as they get
    SKY.stars(back, t, { alpha: 1.0, pole: [1530, -250], horizon: 700, trailK: 0 });
    moonLights(g, 1520, 262, 52, 0.95);
    const zoom = 1.20 + 0.55 * easeInOut(invLerp(73.0, 76.0, t));
    const cam = { z: zoom, x: 0, y: 0, ax: 962, ay: 842 };
    withCam([far, near, g], cam, 0.45, () => {
      // the bay
      far.fillStyle = vgrad(far, 712, 860, [[0, '#2a2e56'], [0.2, '#141a36'], [1, '#070b18']]); far.fillRect(-300, 712, 2520, 420);
      for (let i = 0; i < 46; i++) { const k = i / 46; const y = 716 + k * k * 130; far.fillStyle = `rgba(206,214,246,${0.30 * (1 - k * 0.7) * (0.45 + 0.55 * Math.abs(Math.sin(t * 1.7 + i * 2.1)))})`; const w = 10 + k * 70 * hash(i + 3); far.fillRect(1520 + (hash(i + 7) - 0.5) * (30 + k * 190) - w / 2, y, w, 1.8 + k * 1.4); }
      far.fillStyle = '#0d1126';
      blob(far, [[-300, 716], [-60, 668], [190, 690], [380, 660], [600, 700], [760, 714], [760, 726], [-300, 730]], 0.4);
      blob(far, [[1700, 716], [1820, 690], [1980, 700], [2220, 662], [2300, 730], [1700, 730]], 0.4);
      for (let i = 0; i < 120; i++) { const x = -80 + Math.pow(hash(i + 5), 1.2) * 780, y = 712 - hash(i + 55) * 26 * (1 - Math.abs(x - 280) / 500); far.fillStyle = `rgba(255,${196 + (hash(i) * 40 | 0)},128,${0.45 + hash(i + 9) * 0.55})`; disc(far, x, y + 2, 0.9 + hash(i + 19) * 1.5); }
      glow(g, 280, 712, 340, '#a86a30', 0.16);
      for (const [x, h] of [[1810, 96], [1900, 118], [1990, 90], [96, 78]]) { turbine(far, x, 692, h, t * 0.5, x, '#232a48'); const on = mod(t + x * 0.01, 1.4) < 0.5 ? 1 : 0.15; g.fillStyle = `rgba(255,90,80,${on * 0.85})`; disc(g, x, 692 - h, 2.4); }
    });
    const FIRE = { x: 962, y: 884 };
    const [fx, fy, fz] = camPoint(cam, 1, FIRE.x, FIRE.y);
    withCam([near, g], cam, 1, () => {
      const gl = (x) => 884 + Math.pow((x - 960) / 960, 2) * 96 + (fbm1(x * 0.004, 241, 3) - 0.5) * 22;
      near.fillStyle = vgrad(near, 870, H, [[0, '#111426'], [1, '#04050c']]);
      near.beginPath(); near.moveTo(-400, H + 300); for (let x = -400; x <= W + 400; x += 14) near.lineTo(x, gl(x) + 6); near.lineTo(W + 400, H + 300); near.fill();
      PROPS.grass(near, t, { y: 890, n: 120, h: 24, color: '#0a0d1c', seed: 243, x0: -300, x1: W + 300, ground: gl, sway: 0.7 });
      PROPS.logs(near, FIRE.x, FIRE.y + 6, 44, '#0c0808');
      PROPS.coals(g, FIRE.x, FIRE.y + 6, 44, t, 1);
      glow(g, FIRE.x, FIRE.y + 18, 240, '#8a360c', 0.16 * flick(t, 61));
      const lit = { x: FIRE.x, y: FIRE.y - 36, r: 320, color: '#8f4318', k: 0.48 };
      // sitting where the first family sat
      const breathe = Math.sin(t * 1.6) * 0.005;
      const elder = FIG.person(near, { x: 822, y: 928, h: 290, color: '#160d10', far: '#0d080b', cloth: '#24303e', dress: 'coat', hair: 'bun', scarf: SCARF, wind: 0.15, lit, t, p: FIG.sit({ hip: [-0.06, 0.11], lean: 0.22 + breathe, handA: [0.27, 0.30], handB: [0.22, 0.27], tilt: 0.12 }) });
      FIG.person(near, { x: 1100, y: 930, h: 204, face: -1, child: 0.9, color: '#160d10', far: '#0d080b', cloth: '#5a4032', dress: 'tunic', hair: 'curls', lit, t, p: FIG.sit({ lean: 0.24 - breathe, handA: [0.27, 0.28 + 0.025 * Math.sin(t * 1.1)], handB: [0.22, 0.25], tilt: -0.14 }) });
      g.save(); g.globalAlpha = 0.42; g.strokeStyle = '#8a2608'; g.lineWidth = 4.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(elder.shoulder[0] + 8, elder.shoulder[1] - 9); g.quadraticCurveTo(elder.shoulder[0] - 24, elder.shoulder[1] - 4, elder.shoulder[0] - 41, elder.shoulder[1] + 9 + Math.sin(t * 3) * 3); g.stroke(); g.restore();
      sparks(g, FIRE.x, FIRE.y - 46, t, { n: 34, spread: 46, height: 330, size: 1.7, alpha: 0.85, seed: 245 });
    });
    env.flames.push({ x: fx, y: fy - 4 * fz, w: 30 * fz, h: 92 * fz, i: 0.98, seed: 1.3, halo: 0.9 });
    env.lights.push({ x: fx, y: fy - 36 * fz, r: 360 * fz, i: 0.82 * flick(t, 62), color: '#ff8a30' });
    env.proj = { amt: 1, sweep: 4000, ghost: 24, solid: { x: fx, y: fy - 34 * fz, r: 150 * fz, k: 0.9 } };
    env.rim = 1.05; env.bloom = 0.46; env.thresh = 0.72; env.vig = 0.30;
  });

  // ---- the same fire -----------------------------------------------------------
  defineScene('finale', 75.72, { kind: 'push', dur: 0.72, center: [962, 800] }, (S) => {
    const { t, back, glow: g, env } = S;
    SKY.stars(back, t, { alpha: 0.8, pole: [1560, -300], density: 0.65, trailK: 0 });
    const pulseK = Math.exp(-Math.max(0, t - 79.5) * 3.2) * (t >= 79.5 ? 1 : 0);
    const intensity = 1.0 - 0.10 * ramp(78.2, 79.2, t) + 0.14 * pulseK;
    const H_ = handoff(S, {
      rise: invLerp(75.55, 76.9, t), tip: invLerp(76.75, 78.35, t), lift: invLerp(78.45, 79.75, t),
      push: ramp(75.4, 80, t), intensity, late: true,
      proj: 1, solidR: 10.5 + 2.2 * ramp(78.0, 79.9, t),
    });
    sparks(g, H_.ex, H_.ey - 24, t, { n: 24, spread: 50, height: 340, size: 2.0, alpha: 0.8, seed: 21 });
    sparks(g, H_.ex, H_.ey, t, { n: 12, spread: 130, height: 560, size: 1.4, alpha: 0.5, seed: 5, speed: 0.6 });
  });
})();
