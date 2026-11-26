// 52 - 56 s : coal, steam, electric light.   56 - 60 s : the wars.
(() => {
  function puffs(c, x, y, t, o = {}) {
    const { n = 16, rise = 330, drift = 190, size = 58, color = '#3c2c34', alpha = 0.55, seed = 3, speed = 0.17 } = o;
    for (let i = 0; i < n; i++) {
      const q = t * speed + i / n + hash(seed) * 3;
      const f = mod(q, 1), k = Math.floor(q);
      const jx = (hash2(i + k * 31, seed) - 0.5) * 40;
      puff(c, x + jx + drift * f * f + Math.sin(f * 6 + i) * 12, y - rise * Math.pow(f, 0.82), size * (0.35 + f * 1.5), size * (0.30 + f * 1.05), color, alpha * Math.sin(Math.min(1, f * 5) * PI / 2) * (1 - f));
    }
  }
  function mill(c, g, x, y, w, h, col, lit, seed, t) {
    c.fillStyle = col; c.fillRect(x, y - h, w, h);
    for (let i = 0; i < w / 90; i++) fillPoly(c, [[x + i * 90, y - h], [x + i * 90 + 90, y - h], [x + i * 90 + 90, y - h - 34]]);
    c.fillRect(x + w * 0.62, y - h - 66, 64, 70); fillPoly(c, [[x + w * 0.62 - 6, y - h - 64], [x + w * 0.62 + 32, y - h - 96], [x + w * 0.62 + 70, y - h - 64]]);
    for (let floor = 0; floor * 50 < h - 44; floor++) {
      const dark = hash2(floor, seed) < 0.18;                 // a floor that has stopped for the night
      for (let k = 0; k * 36 < w - 34; k++) {
        if (k % 5 === 4) continue;                             // brick piers
        const r = hash2(k + seed * 7, floor);
        if (dark ? r < 0.9 : r < 0.20) continue;
        const wx = x + 17 + k * 36, wy = y - h + 20 + floor * 50;
        c.fillStyle = `rgba(255,${138 + (r * 70 | 0)},${48 + (r * 44 | 0)},${lit * (0.30 + r * 0.52) * (0.94 + 0.06 * Math.sin(t * 5 + k))})`;
        c.beginPath(); c.moveTo(wx, wy + 28); c.lineTo(wx, wy + 7); c.arc(wx + 7.5, wy + 7, 7.5, PI, 0); c.lineTo(wx + 15, wy + 28); c.fill();
      }
    }
  }
  const chimney = (c, x, y, h, w, col) => { c.fillStyle = col; fillPoly(c, [[x - w / 2, y], [x - w * 0.34, y - h], [x + w * 0.34, y - h], [x + w / 2, y]]); c.fillRect(x - w * 0.45, y - h - 10, w * 0.9, 12); };

  function train(c, g, env, x, y, s, t) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = '#0c0710';
    c.fillRect(0, -70, 170, 42); disc(c, 170, -49, 21); c.fillRect(-72, -96, 76, 68); c.fillRect(-82, -104, 96, 10);
    c.fillRect(138, -104, 20, 36); c.fillRect(132, -112, 32, 10); disc(c, 66, -74, 17);
    fillPoly(c, [[176, -30], [214, -6], [160, -8]]);
    for (const [wx, r] of [[-46, 22], [20, 26], [84, 26], [146, 16]]) {
      disc(c, wx, -r + 4, r);
      c.strokeStyle = '#4c2a2c'; c.lineWidth = 3;
      for (let k = 0; k < 5; k++) { const a = t * 11 + k * TAU / 5; c.beginPath(); c.moveTo(wx, -r + 4); c.lineTo(wx + Math.cos(a) * r * 0.8, -r + 4 + Math.sin(a) * r * 0.8); c.stroke(); }
    }
    for (let i = 0; i < 6; i++) { const cx = -205 - i * 128; c.fillStyle = '#0c0710'; c.fillRect(cx, -82, 114, 58); disc(c, cx + 24, -14, 14); disc(c, cx + 90, -14, 14); c.fillRect(cx + 110, -42, 22, 6); }
    c.restore();
    for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(255,186,96,0.85)'; for (let k = 0; k < 4; k++) c.fillRect(x + (-205 - i * 128 + 14 + k * 24) * s, y - 70 * s, 12 * s, 18 * s); }
    glow(g, x - 34 * s, y - 60 * s, 60 * s, '#ff7a24', 0.7);
  }

  function gasLamp(c, x, y, h) {
    c.fillStyle = '#0a0608';
    chain(c, [[x, y, 11], [x, y - h * 0.82, 7]]);
    c.fillRect(x - 18, y - 12, 36, 12);
    c.fillRect(x - 40, y - h * 0.80, 80, 6);
    c.lineWidth = 6; c.strokeStyle = '#0a0608';
    c.beginPath(); c.moveTo(x - 30, y - h * 0.84); c.lineTo(x - 43, y - h); c.moveTo(x + 30, y - h * 0.84); c.lineTo(x + 43, y - h); c.moveTo(x, y - h * 0.83); c.lineTo(x, y - h); c.stroke();
    c.fillRect(x - 34, y - h * 0.845, 68, 8);
    fillPoly(c, [[x - 56, y - h], [x, y - h - 34], [x + 56, y - h]]); disc(c, x, y - h - 38, 7);
  }

  // a glass lamp whose thread of metal glows
  function bulb(c, g, x, y, s, heat) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.strokeStyle = 'rgba(255,226,190,0.55)'; c.lineWidth = 3.2;
    c.fillStyle = `rgba(255,196,120,${0.10 + 0.08 * heat})`;
    c.beginPath(); c.moveTo(-34, 78); c.bezierCurveTo(-36, 46, -88, 22, -88, -34); c.bezierCurveTo(-88, -86, -48, -118, 0, -118); c.bezierCurveTo(48, -118, 88, -86, 88, -34); c.bezierCurveTo(88, 22, 36, 46, 34, 78); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#241610'; c.fillRect(-36, 76, 72, 46);
    c.strokeStyle = '#6a4a34'; c.lineWidth = 5; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-38, 86 + i * 11); c.lineTo(38, 82 + i * 11); c.stroke(); }
    c.strokeStyle = '#c9a27a'; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(-16, 76); c.lineTo(-25, 6); c.moveTo(16, 76); c.lineTo(25, 6); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.arc(-26, -40, 46, PI * 0.95, PI * 1.38); c.stroke();
    c.restore();
    if (heat > 0.01) {
      g.save(); g.translate(x, y); g.scale(s, s);
      for (const [w, col] of [[11, `rgba(255,150,50,${0.45 * heat})`], [4, `rgba(255,236,180,${heat})`]]) {
        g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(-25, 6);
        for (let i = 1; i <= 8; i++) g.lineTo(-25 + i * 6.25 - 3, i % 2 ? -22 : -2), g.lineTo(-25 + i * 6.25, 6 - (i < 8 ? 4 : 0));
        g.stroke();
      }
      g.restore();
      glow(g, x, y - 6 * s, 330 * s, '#ffb45a', 0.38 * heat);
    }
  }

  // ---- industry -------------------------------------------------------------
  defineScene('industry', 52.04, { kind: 'dip', dur: 0.72, center: [1500, 92], center2: [1222, 716] }, (S) => {
    const { t, env, back, far, near, glow: g } = S;
    const cx = keys([[51.4, -50], [52.4, 0], [53.7, 190], [54.7, 1120], [56.0, 1270], [56.6, 1330]], t);
    env.sky = { top: '#0c0a18', mid: '#33202c', low: '#9a4c30', ground: '#1a0e10', horizon: 730, midAt: 0.55, cloud: 0.8, cloudColor: '#4a2a2a' };
    env.haze = { color: '#6a3a30', amt: 0.24 };
    env.skyRim = '#d8805a'; env.skyRimAmt = 0.3;
    SKY.stars(back, t, { alpha: 0.22, pole: [900, -300], horizon: 400, density: 0.4 });
    const fx = (wx, k = 0.55) => wx - cx * k;
    // begin close to the furnace, then step back into the street
    const lean = { z: keys([[51.6, 1.34], [53.0, 1.27], [53.9, 1.13], [54.7, 1.0]], t), x: 0, y: 0, ax: 1130, ay: 850 };
    for (const c of [far, near, g]) { c.translate(lean.ax, lean.ay); c.scale(lean.z, lean.z); c.translate(-lean.ax, -lean.ay); }
    // smoke gathers over everything
    for (const [wx, h, sd] of [[300, 380, 1], [520, 330, 2], [880, 420, 3], [1180, 300, 4], [1560, 360, 5], [1960, 320, 6]]) {
      const x = fx(wx, 0.4);
      if (x < -300 || x > W + 300) continue;
      chimney(far, x, 770, h, 34, '#2c1820');
      puffs(far, x, 770 - h - 16, t, { seed: sd, rise: 250, drift: 260, size: 62, color: '#2a1c26', alpha: 0.72 });
    }
    mill(far, g, fx(80), 786, 540, 170, '#24131c', 0.55, 4, t);
    mill(far, g, fx(940), 788, 450, 210, '#1f1018', 0.50, 9, t);
    // a viaduct, and a train going over it
    const vx = fx(560, 0.62);
    far.fillStyle = '#190d14'; far.fillRect(vx, 646, 1560, 24);
    for (let i = 0; i < 14; i++) { const x = vx + i * 112; far.fillRect(x, 646, 30, 160); far.beginPath(); far.moveTo(x + 30, 668); far.lineTo(x + 112, 668); far.lineTo(x + 112, 724); far.arc(x + 71, 724, 41, 0, PI, true); far.closePath(); far.fill(); }
    const trX = vx + 340 + (t - 52) * 250;
    train(far, g, env, trX, 648, 0.86, t);
    puffs(far, trX + 128, 548, t, { seed: 11, rise: 130, drift: -420, size: 38, color: '#7a5a58', alpha: 0.55, speed: 0.62, n: 18 });

    near.fillStyle = vgrad(near, 866, H, [[0, '#1c0d0c'], [1, '#080406']]); near.fillRect(-60, 884, W + 120, 240);

    // the boiler, its open door, and the one who feeds it
    const bx = 1190 - cx;
    if (bx > -900) {
      near.fillStyle = '#120a0c';
      near.beginPath(); near.roundRect(bx - 150, 520, 470, 330, 70); near.fill();
      near.fillRect(bx - 130, 840, 430, 70); chimney(near, bx + 230, 530, 190, 50, '#120a0c');
      near.fillStyle = '#2c1814'; for (let i = 0; i < 12; i++) for (const y of [546, 826]) disc(near, bx - 116 + i * 36, y, 6);
      near.strokeStyle = '#1e100e'; near.lineWidth = 20; near.beginPath(); near.arc(bx + 40, 704, 96, 0, TAU); near.stroke();
      near.fillStyle = '#3a1004'; disc(near, bx + 40, 704, 88);
      g.fillStyle = 'rgba(255,96,16,0.30)'; disc(g, bx + 40, 704, 86);
      // the great wheel
      const wxw = bx + 450, wyw = 730, a0 = (t - 52) * 3.6;
      near.strokeStyle = '#160b0d'; near.lineWidth = 24; near.beginPath(); near.arc(wxw, wyw, 160, 0, TAU); near.stroke();
      near.lineWidth = 12; for (let k = 0; k < 8; k++) { const a = a0 + k * PI / 4; near.beginPath(); near.moveTo(wxw, wyw); near.lineTo(wxw + Math.cos(a) * 156, wyw + Math.sin(a) * 156); near.stroke(); }
      near.fillStyle = '#241210'; disc(near, wxw, wyw, 28);
      const crank = [wxw + Math.cos(a0) * 78, wyw + Math.sin(a0) * 78];
      near.strokeStyle = '#32180f'; near.lineWidth = 17; near.beginPath(); near.moveTo(wxw - 232, 730); near.lineTo(crank[0], crank[1]); near.stroke();
      near.fillStyle = '#1a0d0e'; near.fillRect(wxw - 290, 708, 80, 44);
      // stoker
      const sw = (t - 52) * 1.15;
      const throwK = Math.pow(Math.max(0, Math.sin(sw * TAU)), 1);
      const stoker = FIG.person(near, { x: bx - 300, y: 940, h: 405, color: '#180b09', far: '#100706', cloth: '#2a120c', dress: 'tunic', hat: 'cap', t, lit: { x: bx + 40, y: 704, r: 600, color: '#c85414', k: 0.74 },
        p: FIG.stand({ hip: [-0.02, 0.45], lean: 0.26 + throwK * 0.28, footA: [0.18, 0.035], footB: [-0.18, 0.035], handA: [0.22 + throwK * 0.20, 0.40 + throwK * 0.14], handB: [0.02 + throwK * 0.18, 0.46 + throwK * 0.08] }) });
      near.strokeStyle = '#150a08'; near.lineWidth = 10;
      const tip = [stoker.handA[0] + 96, stoker.handA[1] + 24 - throwK * 40];
      near.beginPath(); near.moveTo(stoker.handB[0] - 18, stoker.handB[1] + 4); near.lineTo(tip[0], tip[1]); near.stroke();
      near.fillStyle = '#150a08'; fillPoly(near, [[tip[0], tip[1] - 16], [tip[0] + 44, tip[1] - 4], [tip[0] + 42, tip[1] + 16], [tip[0], tip[1] + 10]]);
      near.fillStyle = '#0c0607'; blob(near, [[bx - 610, 940], [bx - 560, 868], [bx - 500, 848], [bx - 440, 886], [bx - 420, 940]], 0.6);
      sparks(g, bx + 10, 720, t, { n: 34, spread: 90, height: 180, size: 2.0, wind: -190, alpha: 0.9, seed: 81, speed: 1.4 });
      if (bx + 40 < W + 80) {
        env.flames.push({ x: bx + 22, y: 764, w: 34, h: 108, i: 0.92, seed: 31, halo: 0.7 });
        env.flames.push({ x: bx + 66, y: 766, w: 26, h: 82, i: 0.82, seed: 37, halo: 0.3 });
        env.lights.push({ x: bx + 30, y: 712, r: 560, i: 0.86 * flick(t, 28), color: '#ff7a24' });
      }
      // the shift going in
      for (let i = 0; i < 6; i++) {
        const x = bx - 1010 + i * 118 + (t - 52) * 62;
        if (x > -120 && x < bx - 470) FIG.person(near, { x, y: 944 + (i % 2) * 12, h: 252 - (i % 3) * 22, color: '#150a0b', far: '#0d0607', cloth: '#221012', dress: i % 3 === 1 ? 'dress' : 'coat', hat: i % 3 === 1 ? 'scarfhead' : 'cap', t, p: FIG.walk((t - 52) * 1.15 + i * 0.23, { stride: 0.26, lean: 0.16, over: { tilt: 0.2 } }) });
      }
      // a child with a basket of bobbins
      FIG.person(near, { x: bx + 705 - (t - 52) * 52, y: 936, h: 196, face: -1, child: 0.9, color: '#170b0a', cloth: '#26110d', dress: 'tunic', hat: 'cap', t, p: FIG.walk((t - 52) * 1.3, { stride: 0.26, lean: 0.14, over: { handA: [0.2, 0.52], handB: [0.18, 0.5] } }) });
    }

    // the street: gas light, then the thread of metal
    const sx = 2090 - cx;
    if (sx < W + 800) {
      mill(near, g, sx + 150, 902, 300, 330, '#150b10', 0.8, 21, t);
      mill(near, g, sx - 760, 902, 330, 290, '#170c11', 0.75, 23, t);
      const lx = sx - 280, lh = 520, ly = 920 - lh;
      gasLamp(near, lx, 920, lh);
      const keeper = FIG.person(near, { x: lx - 150, y: 932, h: 330, color: '#140a0c', far: '#0c0607', cloth: '#221014', dress: 'coat', hat: 'brim', t, p: FIG.stand({ lean: -0.03, tilt: -0.34, handA: [0.30, 0.86], handB: [0.21, 0.68], footA: [0.09, 0.035], footB: [-0.08, 0.035] }) });
      near.strokeStyle = '#10080a'; near.lineWidth = 6; near.beginPath(); near.moveTo(keeper.handB[0] - 12, keeper.handB[1] + 24); near.lineTo(lx - 20, ly + 52); near.stroke();
      const gas = 1 - ramp(55.5, 55.72, t);
      if (gas > 0.01) {
        env.flames.push({ x: lx, y: ly + 66, w: 14, h: 62, i: 0.95 * gas, seed: 33, halo: 1.0 });
        env.lights.push({ x: lx, y: ly + 36, r: 380, i: 0.66 * gas * flick(t, 29), color: '#ffa040' });
      }
      const on = ramp(55.58, 55.9, t);
      if (on > 0.01) {
        bulb(near, g, lx, ly + 40, 0.36, on);
        env.lights.push({ x: lx, y: ly + 36, r: 520, i: 0.62 * on, color: '#ffc27a' });
      }
      // the big one, close: the new kind of light
      const show = ramp(55.5, 55.85, t);
      if (show > 0) {
        near.save(); near.globalAlpha = show;
        near.strokeStyle = '#0a0608'; near.lineWidth = 8; near.beginPath(); near.moveTo(1250, -20); near.lineTo(1250, 340); near.stroke();
        near.restore();
        g.save(); g.globalAlpha = show; bulb(g, g, 1250, 430, 1.16, ramp(55.62, 56.0, t)); g.restore();
        env.lights.push({ x: 1250, y: 430, r: 760, i: 0.5 * show, color: '#ffc884' });
      }
      // lamps coming on down the street
      for (let i = 0; i < 9; i++) {
        const on2 = ramp(55.75 + i * 0.05, 55.85 + i * 0.05, t);
        if (on2 <= 0) continue;
        const x = sx - 700 + i * 150, y = 790 - (i % 2) * 18;
        far.fillStyle = '#1c0e14'; far.fillRect(x - 2, y, 4, 70);
        glow(g, x, y, 46, '#ffd090', 0.85 * on2); g.fillStyle = `rgba(255,240,205,${on2})`; disc(g, x, y, 4.5);
      }
    }
    for (const o of env.flames) { const [x, y] = camPoint(lean, 1, o.x, o.y); o.x = x; o.y = y; o.w *= lean.z; o.h *= lean.z; }
    for (const o of env.lights) { const [x, y] = camPoint(lean, 1, o.x, o.y); o.x = x; o.y = y; o.r *= lean.z; }
    env.rim = 1.1; env.bloom = 0.5; env.thresh = 0.68; env.vig = 0.34;
  });

  // ---- war -------------------------------------------------------------------
  const CITY = (() => {
    const r = rng(1914), blocks = [];
    for (let x = -60; x < 2000;) {
      const w = 60 + r() * 110, h = 90 + r() * 200;
      const wins = [];
      for (let ix = 10; ix < w - 16; ix += 22) for (let iy = 16; iy < h - 18; iy += 28) if (r() < 0.42) wins.push([ix, iy, r()]);
      blocks.push({ x, w, h, wins, spire: r() < 0.12 });
      x += w + r() * 8;
    }
    return blocks;
  })();
  function barbedWire(c, y, x0, x1, seed, col) {
    c.strokeStyle = col; c.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      c.lineWidth = 3.4;
      c.beginPath();
      for (let x = x0; x <= x1; x += 14) { const yy = y + k * 46 + Math.sin(x * 0.021 + k * 2 + seed) * 13 + (noise1(x * 0.02, seed + k) - 0.5) * 20; x === x0 ? c.moveTo(x, yy) : c.lineTo(x, yy); }
      c.stroke();
      c.lineWidth = 2.4;
      for (let x = x0; x <= x1; x += 62) { const yy = y + k * 46 + Math.sin(x * 0.021 + k * 2 + seed) * 13 + (noise1(x * 0.02, seed + k) - 0.5) * 20; c.beginPath(); c.moveTo(x - 9, yy - 11); c.lineTo(x + 9, yy + 11); c.moveTo(x + 9, yy - 11); c.lineTo(x - 9, yy + 11); c.stroke(); }
    }
    for (let x = x0 + 90; x < x1; x += 330) chain(c, [[x, y + 130, 11], [x + (hash(x | 0) - 0.5) * 36, y - 34, 6]]);
  }

  defineScene('war', 56.45, { kind: 'burn', dur: 0.6, center: [1250, 440] }, (S) => {
    const { t, env, back, far, near, glow: g } = S;
    const u = t - 56.15;
    // during the second line, everything but one small light recedes
    const hush = ramp(58.15, 58.55, t) * (1 - ramp(59.55, 59.75, t));
    const bomb = ramp(59.53, 59.97, t);
    const dim = 1 - hush * 0.90;
    env.sky = { top: M('#0b0c18', '#030305', hush), mid: M('#241620', '#07060a', hush), low: M('#9a3c22', '#140a0c', hush), ground: '#0a0507', horizon: 748, midAt: 0.52, cloud: 0.8 * dim, cloudColor: '#2c161a' };
    env.haze = { color: '#43201e', amt: 0.22 };
    env.skyRim = '#a84830'; env.skyRimAmt = 0.34 * dim;
    SKY.stars(back, t, { alpha: 0.18 + 0.2 * hush, pole: [900, -300], horizon: 460, density: 0.5 });

    // the city's lamps go out
    for (const b of CITY) {
      const x = b.x - u * 46;
      far.fillStyle = M('#241016', '#060406', hush);
      far.fillRect(x, 768 - b.h, b.w, b.h + 20);
      if (b.spire) fillPoly(far, [[x + b.w * 0.3, 768 - b.h], [x + b.w * 0.5, 768 - b.h - 90], [x + b.w * 0.7, 768 - b.h]]);
      for (const [ix, iy, r] of b.wins) {
        const off = 57.15 + r * 0.7;
        const on = clamp((off - t) / 0.12);
        if (on <= 0) continue;
        far.fillStyle = `rgba(255,${180 + (r * 50 | 0)},110,${0.80 * on})`; far.fillRect(x + ix, 768 - b.h + iy, 10, 14);
      }
    }
    const peace = 1 - ramp(57.3, 57.7, t);
    if (peace > 0.01) {
      for (let i = 0; i < 12; i++) {
        const x = mod(i * 190 + 60 - u * 46, 2200) - 100;
        far.fillStyle = rgb([24, 12, 16], peace); far.fillRect(x - 3, 726, 6, 96);
        glow(g, x, 724, 54, '#ffd79a', 0.42 * peace); far.fillStyle = `rgba(255,242,208,${peace})`; disc(far, x, 724, 5);
      }
    }
    // searchlights comb the cloud
    const beams = ramp(57.3, 57.75, t) * (1 - ramp(58.1, 58.4, t));
    if (beams > 0.01) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [bx, ph, sp] of [[330, 0, 1.3], [1070, 2.2, 1.05], [1640, 4.1, 1.5]]) {
        const a = -PI / 2 + Math.sin(t * sp + ph) * 0.52;
        const ex = bx + Math.cos(a) * 1000, ey = 770 + Math.sin(a) * 1000;
        const gr = g.createLinearGradient(bx, 770, ex, ey);
        gr.addColorStop(0, `rgba(190,205,230,${0.30 * beams})`); gr.addColorStop(1, 'rgba(160,180,220,0)');
        g.fillStyle = gr; fillPoly(g, [[bx - 5, 770], [ex - 74, ey], [ex + 74, ey], [bx + 5, 770]]);
      }
      g.restore();
      for (let i = 0; i < 9; i++) {
        const x = 2150 - (t - 56.8) * 330 + (i % 3) * 120 + Math.floor(i / 3) * 190, y = 300 + (i % 3) * 44 + Math.floor(i / 3) * 30;
        far.fillStyle = rgb([18, 10, 16], beams);
        fillPoly(far, [[x - 26, y], [x - 8, y - 4], [x + 4, y - 26], [x + 10, y - 26], [x + 8, y - 4], [x + 24, y - 2], [x + 30, y - 12], [x + 34, y - 2], [x + 8, y + 4], [x + 10, y + 26], [x + 4, y + 26], [x - 8, y + 4]]);
      }
    }
    // slow fires beyond the town (they swell, they never flash)
    for (const [x, s, ph] of [[420, 1.0, 0], [1480, 0.8, 1.7]]) {
      const a = ramp(57.4 + ph * 0.1, 58.1 + ph * 0.1, t) * dim;
      glow(g, x - u * 46, 756, 190 * s, '#c2420e', 0.26 * a * (0.85 + 0.15 * Math.sin(t * 3 + ph)));
      puffs(far, x - u * 46, 740, t, { seed: 41 + ph * 7 | 0, rise: 300, drift: 130, size: 55, color: '#190c10', alpha: 0.7 * a });
    }

    // soldiers, in file, going forward
    near.fillStyle = vgrad(near, 806, H, [[0, M('#160a0a', '#050304', hush)], [1, '#050203']]);
    const trench = (x) => lerp(790, 862, hush) + (fbm1((x + u * 80) * 0.006, 131, 3) - 0.5) * 66;
    near.beginPath(); near.moveTo(-60, H + 40); for (let x = -60; x <= W + 60; x += 14) near.lineTo(x, trench(x)); near.lineTo(W + 60, H + 40); near.fill();
    if (peace > 0.01) {
      const tx = 300 + u * 330, ty = 704;
      near.fillStyle = rgb([14, 8, 12], peace); near.beginPath(); near.roundRect(tx, ty, 300, 92, 16); near.fill(); near.fillRect(tx + 140, ty - 52, 6, 54);
      near.fillRect(tx - 600, ty - 54, 1500, 3); disc(near, tx + 60, ty + 98, 16); disc(near, tx + 240, ty + 98, 16);
      for (let i = 0; i < 6; i++) { near.fillStyle = rgb([255, 198, 120], 0.92 * peace); near.fillRect(tx + 22 + i * 45, ty + 18, 30, 34); }
    }
    const march = ramp(57.3, 57.65, t) * (1 - ramp(58.12, 58.45, t));
    if (march > 0.01) {
      near.save(); near.globalAlpha = march;
      for (let i = 0; i < 9; i++) {
        const x = -120 + i * 232 + (t - 56.15) * 96 + (hash(i + 3) - 0.5) * 60;
        const y = trench(x) + 12;
        const f = FIG.person(near, { x, y, h: 304 + hash(i) * 34, color: '#0e0708', far: '#080405', cloth: '#150a0b', dress: 'coat', hat: 'steel', hair: 'none', t, p: FIG.walk((t - 56) * 0.9 + i * 0.37, { stride: 0.27, lean: 0.24, over: { handA: [0.20, 0.56], handB: [0.07, 0.50], tilt: 0.14 } }) });
        near.strokeStyle = '#0a0506'; near.lineWidth = 6; near.beginPath(); near.moveTo(f.shoulder[0] - 38, f.shoulder[1] - 40); near.lineTo(f.handA[0] + 20, f.handA[1] + 14); near.stroke();
      }
      near.restore();
    }
    // wire and shattered trees belong to the war, not to the years before it
    near.save(); near.globalAlpha = ramp(57.3, 57.75, t);
    near.fillStyle = '#060304';
    for (const [x, h] of [[210, 190], [1700, 150]]) { chain(near, [[x - u * 70, 900, 17], [x - u * 70 + 8, 900 - h, 8]]); chain(near, [[x - u * 70 + 3, 900 - h * 0.55, 7], [x - u * 70 - 40, 900 - h * 0.82, 2]]); chain(near, [[x - u * 70 + 5, 900 - h * 0.74, 6], [x - u * 70 + 46, 900 - h * 0.96, 2]]); }
    barbedWire(near, 944, -80, 780, 3, '#070304');
    barbedWire(near, 948, 1150, 2020, 9, '#070304');
    near.restore();

    // the light that is kept for the dead
    const candle = ramp(58.15, 58.55, t) * (1 - ramp(59.86, 60.05, t));
    if (candle > 0.01) {
      near.fillStyle = rgb([196, 178, 150], candle); near.fillRect(948, 738, 24, 66);
      near.fillStyle = rgb([84, 64, 50], candle); near.fillRect(936, 800, 48, 10);
      const gust = ramp(59.62, 59.86, t);
      env.flames.push({ x: 960, y: 740, w: 14, h: 54 * (1 - 0.45 * gust), i: 0.9 * candle, seed: 41, lean: -0.7 * gust, halo: 1.0 });
      env.lights.push({ x: 960, y: 716, r: 360, i: 0.55 * candle * flick(t, 31), color: '#ff9a40' });
      glow(g, 960, 716, 210, '#a4480e', 0.20 * candle);
    }

    // 1945: the light swells without a flash, then the cloud rises into it
    if (bomb > 0) {
      const bx = 1230, hz = 752;
      const swell = smooth(invLerp(59.53, 59.91, t));
      // the light burns down before the dark returns
      // it holds for a breath, then burns down before the dark returns
      const fade = 1 - 0.76 * ramp(59.99, 60.34, t);
      glow(g, bx, hz - 70 * swell, 150 + 1150 * swell, '#ffd9a0', 0.74 * swell * fade);
      glow(g, bx, hz - 40 - 190 * swell, 90 + 420 * swell, '#fff4dc', 0.82 * swell * fade);
      const rise = easeOut(invLerp(59.66, 60.5, t));
      const top = hz - 90 - rise * 330;
      // drawn over its own light, so the shape survives the brightness
      g.save();
      g.globalAlpha = swell;
      const stem = g.createLinearGradient(0, hz, 0, top);
      stem.addColorStop(0, '#d8742c'); stem.addColorStop(0.55, '#7c2f16'); stem.addColorStop(1, '#a84a1e');
      g.fillStyle = stem;
      blob(g, [[bx - 118, hz + 6], [bx - 40, hz - 22], [bx - 24 - rise * 8, hz - 130 * rise], [bx - 30, top + 40], [bx + 30, top + 40], [bx + 22 + rise * 8, hz - 130 * rise], [bx + 44, hz - 22], [bx + 124, hz + 6]], 0.7);
      const cap = 52 + rise * 138;
      const lobes = (dx, dy, r, col) => { g.fillStyle = col; disc(g, bx + dx * cap, top + dy * cap, r * cap); };
      for (let i = 0; i < 22; i++) { const a = i / 22 * TAU; lobes(Math.cos(a) * 0.86, Math.sin(a) * 0.34, 0.24 + hash(i + 5) * 0.10, '#6a2614'); }
      for (let i = 0; i < 15; i++) { const a = i / 15 * TAU + 0.2; lobes(Math.cos(a) * 0.62, Math.sin(a) * 0.24 - 0.05, 0.22 + hash(i + 25) * 0.09, '#a8461c'); }
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; lobes(Math.cos(a) * 0.36, Math.sin(a) * 0.14 - 0.12, 0.20 + hash(i + 45) * 0.08, '#d87a30'); }
      lobes(0, -0.14, 0.26, '#f4b060');
      g.fillStyle = '#ffd896'; oval(g, bx, top + cap * 0.30, cap * 0.46, cap * 0.10);
      g.fillStyle = 'rgba(150,62,26,0.85)'; oval(g, bx, hz - 148 * rise, 26 + rise * 66, 9 + rise * 7);
      g.restore();
      glow(g, bx, top, 120 + 150 * rise, '#ffb060', 0.28 * swell);
    }
    env.rim = 0.9; env.bloom = 0.42 + 0.2 * bomb * (1 - ramp(59.99, 60.34, t)); env.thresh = 0.74; env.vig = 0.36 + 0.14 * hush;
  });
})();
