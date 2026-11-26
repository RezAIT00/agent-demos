// 45 - 47 s : plague.  47 - 49 s : 1492.  49 - 52 s : the hold.
(() => {
  // ---- a town losing its lights ----------------------------------------
  function house(c, x, y, w, h, roof, col) {
    c.fillStyle = col;
    c.fillRect(x, y - h, w, h + 6);
    fillPoly(c, [[x - 9, y - h + 2], [x + w / 2, y - h - roof], [x + w + 9, y - h + 2]]);
    c.fillRect(x + w * 0.72, y - h - roof * 0.82, 12, roof * 0.55);
  }
  const TOWN = (() => {
    const r = rng(1347);
    const rows = [
      { y: 742, s: 0.55, col: '#1d1a38', depth: 0 },
      { y: 826, s: 0.78, col: '#141129', depth: 1 },
      { y: 930, s: 1.12, col: '#0b0916', depth: 2 },
    ];
    const houses = [], windows = [];
    rows.forEach((row) => {
      for (let x = -120; x < 2080;) {
        const w = (86 + r() * 92) * row.s, h = (88 + r() * 100) * row.s, roof = (50 + r() * 74) * row.s;
        const gap = row.depth === 2 && x > 620 && x < 1180;    // the street opens in front
        if (!gap) {
          houses.push({ x, y: row.y, w, h, roof, col: row.col, depth: row.depth });
          const nx = w > 120 * row.s ? 3 : 2, ny = h > 140 * row.s ? 2 : 1;
          for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
            if (r() < 0.24) continue;
            windows.push({ x: x + w * (i + 0.5) / nx - 6.5 * row.s, y: row.y - h + 22 * row.s + j * 52 * row.s, w: 13 * row.s, h: 20 * row.s, order: r(), warm: r(), depth: row.depth });
          }
        } else { x += 120; continue; }
        x += w * (0.86 + r() * 0.3);
      }
    });
    // death does not move neatly: most go out at random, a few streets together
    windows.forEach((w) => { w.off = 45.25 + Math.pow(w.order * 0.8 + 0.2 * noise1(w.x * 0.008, 3), 0.72) * 1.85; if (hash(w.x * 7 | 0) < 0.07) w.off = 99; });
    return { houses, windows };
  })();

  defineScene('plague', 45.04, { kind: 'dip', dur: 0.52, center: [1172, 824], center2: [786, 884] }, (S) => {
    const { t, env, back, far, near, glow: g } = S;
    const loss = ramp(45.2, 47.0, t);
    env.sky = { top: M('#161a3c', '#070a1a', loss), mid: M('#3c3560', '#171a36', loss), low: M('#8a5468', '#2e2c48', loss), ground: '#100d1c', horizon: 740, midAt: 0.56, cloud: 0.5, cloudColor: M('#4c3a60', '#1c1c36', loss),
      moon: { x: 1560, y: 250, r: 40, color: '#cfd6e8', a: 0.9 } };
    env.haze = { color: '#3a3458', amt: 0.18 };
    env.skyRim = '#8a98d0'; env.skyRimAmt = 0.34;
    SKY.stars(back, t, { alpha: 0.5 * loss, pole: [300, -300], horizon: 600, density: 0.6 });
    const cam = { x: (t - 46) * 44, y: 0, z: 1.03 + (t - 45) * 0.025, ax: 960, ay: 780 };

    withCam([far, near, g], cam, 1, () => {
      for (const h of TOWN.houses) if (h.depth === 0) house(far, h.x, h.y, h.w, h.h, h.roof, h.col);
      // the church
      far.fillStyle = '#18152e';
      far.fillRect(1228, 446, 92, 300); fillPoly(far, [[1220, 448], [1274, 306], [1328, 448]]); far.fillRect(1320, 594, 190, 150); fillPoly(far, [[1312, 598], [1415, 520], [1518, 598]]);
      far.strokeStyle = '#18152e'; far.lineWidth = 5; far.beginPath(); far.moveTo(1274, 308); far.lineTo(1274, 262); far.moveTo(1258, 278); far.lineTo(1290, 278); far.stroke();
      far.fillStyle = '#59507c'; far.beginPath(); far.moveTo(1248, 548); far.lineTo(1248, 496); far.arc(1274, 496, 26, PI, 0); far.lineTo(1300, 548); far.fill();
      const swing = Math.sin((t - 45.0) * PI * 1.9) * 0.55;
      far.save(); far.translate(1274, 486); far.rotate(swing); far.fillStyle = '#0c0a18';
      far.beginPath(); far.moveTo(-5, 4); far.bezierCurveTo(-17, 10, -13, 34, -23, 46); far.lineTo(23, 46); far.bezierCurveTo(13, 34, 17, 10, 5, 4); far.fill(); disc(far, Math.sin(swing) * -9, 50, 6);
      far.restore();
      for (const h of TOWN.houses) if (h.depth > 0) house(near, h.x, h.y, h.w, h.h, h.roof, h.col);
      near.fillStyle = vgrad(near, 924, H, [[0, '#14101f'], [1, '#050309']]); near.fillRect(-100, 926, W + 200, 200);
      near.strokeStyle = 'rgba(120,110,160,0.18)'; near.lineWidth = 2;
      for (let i = 0; i < 90; i++) { const x = 560 + hash(i) * 700, y = 936 + hash(i + 3) * 130; near.beginPath(); near.arc(x, y, 9 + hash(i + 6) * 11, PI * 1.1, PI * 1.9); near.stroke(); }

      // windows: warm, then dark
      for (const w of TOWN.windows) {
        const left = clamp((w.off - t) / 0.16);
        if (left <= 0) continue;
        const tw = 0.88 + 0.12 * Math.sin(t * (4 + w.warm * 5) + w.x);
        // a window is hidden by nearer rows
        const hidden = TOWN.houses.some((h) => h.depth > w.depth && w.x + w.w > h.x && w.x < h.x + h.w && w.y + w.h > h.y - h.h - h.roof * 0.4);
        if (hidden) continue;
        near.fillStyle = rgb(mixc([255, 168, 70], [255, 205, 130], w.warm), (0.62 + 0.38 * (w.depth / 2)) * left * tw);
        near.fillRect(w.x, w.y, w.w, w.h);
        glow(g, w.x + w.w / 2, w.y + w.h / 2, w.h * 1.7, '#ff9a36', 0.10 * left);
      }
      // one lantern goes on, past a shut door
      const wx = 700 + (t - 45) * 118;
      const f = FIG.person(near, { x: wx, y: 1014, h: 300, color: '#100b18', far: '#090710', cloth: '#171022', dress: 'robe', hat: 'hood', hair: 'none', t, p: FIG.walk((t - 45) * 0.95, { stride: 0.26, lean: 0.14, over: { handA: [0.23, 0.50] } }), lit: { x: wx + 80, y: 880, r: 230, color: '#7a3c18', k: 0.34 } });
      const lx = f.handA[0] + 4, ly = f.handA[1] + 30;
      near.strokeStyle = '#08050c'; near.lineWidth = 4; near.beginPath(); near.moveTo(f.handA[0], f.handA[1]); near.lineTo(lx, ly - 18); near.stroke();
      near.fillStyle = '#08050c'; near.fillRect(lx - 16, ly - 20, 32, 6); near.fillRect(lx - 16, ly + 18, 32, 6);
      g.fillStyle = 'rgba(255,184,88,0.92)'; g.fillRect(lx - 11, ly - 14, 22, 32);
      glow(g, lx, ly, 140, '#ff9a34', 0.45 * flick(t, 21));
    });
    const [px, py] = camPoint(cam, 1, 700 + (t - 45) * 118 + 84, 888);
    env.lights.push({ x: px, y: py, r: 300, i: 0.42, color: '#ff9438' });
    env.rim = 0.9; env.bloom = 0.46; env.thresh = 0.66; env.vig = 0.38;
  });

  // ---- 1492: sails on the horizon ----------------------------------------
  function tallShip(c, g, x, y, s, t, seed) {
    c.save(); c.translate(x, y + Math.sin(t * 1.8 + seed) * 5 * s); c.rotate(Math.sin(t * 1.5 + seed * 2) * 0.022); c.scale(s, s);
    c.fillStyle = '#0c0814';
    c.beginPath(); c.moveTo(-210, -78); c.lineTo(-170, -80); c.lineTo(-158, -52); c.lineTo(122, -50); c.lineTo(160, -72); c.lineTo(188, -74); c.bezierCurveTo(176, -20, 130, 14, 80, 16); c.lineTo(-130, 16); c.bezierCurveTo(-176, 8, -204, -32, -210, -78); c.fill();
    c.strokeStyle = '#0c0814'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(150, -64); c.lineTo(274, -128); c.stroke();
    const sail = (mx, top, w, h, col) => {
      c.fillStyle = col;
      c.beginPath(); c.moveTo(mx - w / 2, top); c.lineTo(mx + w / 2, top);
      c.quadraticCurveTo(mx + w / 2 + 20, top + h * 0.5, mx + w / 2 - 4, top + h);
      c.quadraticCurveTo(mx, top + h - 20, mx - w / 2 + 4, top + h);
      c.quadraticCurveTo(mx - w / 2 + 28, top + h * 0.5, mx - w / 2, top); c.fill();
      c.fillStyle = '#0c0814'; c.fillRect(mx - w / 2 - 6, top - 5, w + 12, 6);
    };
    for (const [mx, mh] of [[-98, 300], [26, 360], [128, 262]]) {
      c.fillStyle = '#0c0814'; c.fillRect(mx - 4, -50 - mh, 8, mh);
      sail(mx, -50 - mh + 22, 96 * mh / 320, mh * 0.25, '#7c6470');
      sail(mx, -50 - mh + 28 + mh * 0.27, 128 * mh / 320, mh * 0.40, '#6c5666');
      c.fillStyle = '#341520'; fillPoly(c, [[mx, -50 - mh - 4], [mx + 44, -50 - mh + 6], [mx, -50 - mh + 14]]);
    }
    c.fillStyle = '#4e3a50'; fillPoly(c, [[150, -66], [262, -123], [132, -226]]);
    c.lineWidth = 1.4; c.beginPath(); for (const [a, b] of [[[-98, -350], [-206, -76]], [[26, -410], [-98, -350]], [[26, -410], [128, -312]], [[128, -312], [272, -128]]]) { c.moveTo(...a); c.lineTo(...b); } c.stroke();
    c.restore();
    const lx = x - 196 * s, ly = y - 104 * s;
    glow(g, lx, ly, 56 * s, '#ffac48', 0.6); g.fillStyle = '#ffd690'; disc(g, lx, ly, 4 * s + 1);
    return [lx, ly];
  }

  defineScene('atlantic', 47.04, { kind: 'dip', dur: 0.44, center: [1028, 880], center2: [358, 776] }, (S) => {
    const { t, env, back, far, near, glow: g } = S;
    const u = t - 47.05;
    const dk = ramp(47.8, 49.0, t);
    env.sky = { top: M('#0d1230', '#060818', dk), mid: M('#3a2644', '#171224', dk), low: M('#a6483c', '#44202c', dk), ground: '#0a0a16', horizon: 700, midAt: 0.58, cloud: 0.55, cloudColor: M('#52283c', '#1f1424', dk) };
    env.haze = { color: M('#7c3a3c', '#30202e', dk), amt: 0.2 };
    env.skyRim = '#c06860'; env.skyRimAmt = 0.3;
    SKY.stars(back, t, { alpha: 0.5, pole: [900, -300], horizon: 520, density: 0.6 });
    far.fillStyle = vgrad(far, 700, H, [[0, M('#5c2c36', '#2a1822', dk)], [0.3, '#161428'], [1, '#04040a']]); far.fillRect(-40, 700, W + 80, 400);
    for (let i = 0; i < 90; i++) { const y = 706 + Math.pow(hash(i + 2), 1.6) * 300, x = mod(hash(i) * 2100 + u * 20 * hash(i + 5), 2100) - 90; far.fillStyle = `rgba(220,110,90,${0.22 * (1 - dk * 0.6) * (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)))})`; far.fillRect(x, y, 12 + hash(i + 8) * 44, 1.8); }

    // three ships close on a green coast
    tallShip(far, g, 360 + u * 98, 746, 0.42, t, 2);
    tallShip(far, g, 150 + u * 118, 776, 0.58, t, 5);
    const lamp = tallShip(near, g, 570 + u * 132, 888, 1.08, t, 1);
    env.lights.push({ x: lamp[0], y: lamp[1], r: 250, i: 0.5 * flick(t, 22), color: '#ff9440' });
    near.fillStyle = vgrad(near, 884, H, [[0, 'rgba(24,16,36,0.96)'], [1, '#04030a']]);
    near.beginPath(); near.moveTo(-60, H + 40);
    for (let x = -60; x <= W + 60; x += 16) near.lineTo(x, 896 + Math.sin(x * 0.011 + t * 2.4) * 7 + Math.sin(x * 0.029 - t * 3) * 3);
    near.lineTo(W + 60, H + 40); near.fill();

    // the people on the shore, and their fire
    near.fillStyle = '#0a0710';
    blob(near, [[1470, 1110], [1520, 920], [1640, 860], [1800, 836], [2000, 840], [2000, 1110]], 0.45);
    PROPS.acacia(far, 1880, 846, 190, '#0e0a16', 41);
    for (let i = 0; i < 24; i++) { far.fillStyle = '#100c18'; disc(far, 1720 + i * 17, 800 + hash(i + 9) * 40, 24 + hash(i) * 24); }
    const alive = 1 - ramp(48.05, 48.85, t);
    const fx = 1750, fy = 872;
    const lit = { x: fx, y: fy - 20, r: 270, color: '#7c3a18', k: 0.6 * alive };
    [[1652, 884, 170, 1, 'short', 0], [1700, 890, 150, 1, 'long', 1], [1838, 882, 160, -1, 'long', 2], [1880, 888, 108, -1, 'short', 3]].forEach(([x, y, h, face, hair, i]) => {
      FIG.person(near, { x, y, h, face, color: '#0c0810', far: '#07050a', cloth: '#181018', dress: 'wrap', hair, child: i === 3 ? 0.85 : 0, lit, t, p: i % 2 ? FIG.sit({ lean: 0.16 + 0.2 * (1 - alive), tilt: 0.3 * (1 - alive) }) : FIG.stand({ lean: 0.03, tilt: 0.28 * (1 - alive), handA: [0.06, 0.48] }) });
    });
    PROPS.logs(near, fx, fy, 22, '#06040a');
    if (alive > 0.02) {
      env.flames.push({ x: fx, y: fy - 6, w: 17 * (0.4 + 0.6 * alive), h: 58 * alive, i: 0.9 * alive, seed: 23, halo: 0.8 });
      env.lights.push({ x: fx, y: fy - 22, r: 240, i: 0.6 * alive * flick(t, 23), color: '#ff8c34' });
    }
    sparks(g, fx, fy - 26, t, { n: 12, spread: 20, height: 150, size: 1.4, alpha: alive, seed: 66 });
    puff(near, fx + 8, fy - 70 - ramp(48.4, 49.2, t) * 90, 22, 74, '#8a8494', 0.4 * ramp(48.3, 48.7, t) * (1 - ramp(48.85, 49.3, t)));
    env.rim = 0.9; env.bloom = 0.46; env.thresh = 0.66; env.vig = 0.42;
  });

  // ---- below the waterline -------------------------------------------------
  // people held in the dark, drawn quietly: heads, shoulders, knees
  function seated(c, x, y, h, i, litFill) {
    const kinds = [
      FIG.sit({ hip: [-0.06, 0.1], lean: 0.34, tilt: 0.52, footA: [0.17, 0.045], footB: [0.12, 0.05], handA: [0.17, 0.27], handB: [0.15, 0.25] }),
      FIG.sit({ hip: [-0.06, 0.1], lean: 0.10, tilt: -0.26, footA: [0.15, 0.045], footB: [0.1, 0.05], handA: [0.18, 0.22], handB: [0.13, 0.23] }),
      FIG.sit({ hip: [-0.07, 0.1], lean: 0.52, tilt: 0.34, footA: [0.13, 0.045], footB: [0.08, 0.05], handA: [0.14, 0.36], handB: [0.12, 0.34] }),
      FIG.sit({ hip: [-0.08, 0.1], lean: -0.04, tilt: 0.14, footA: [0.18, 0.045], footB: [0.15, 0.05], handA: [0.10, 0.16], handB: [0.06, 0.15] }),
    ];
    const hair = ['short', 'curls', 'none', 'short', 'curls'][(hash(i + 40) * 5) | 0];
    FIG.person(c, { x, y, h, face: hash(i + 11) < 0.72 ? 1 : -1, color: '#170d0c', far: '#0e0808', cloth: '#1c100e', dress: 'wrap', hair, child: hash(i + 90) < 0.12 ? 0.7 : 0, p: kinds[(hash(i + 7) * kinds.length) | 0], lit: litFill });
  }

  defineScene('hold', 49.0, { kind: 'dip', dur: 0.56, center: [615, 776], center2: [1508, 90] }, (S) => {
    const { t, env, far, near, glow: g } = S;
    const u = t - 49.0;
    const roll = Math.sin(u * 1.55) * 0.014;
    const thin = 1 - 0.45 * ramp(50.9, 52.0, t);
    env.sky = { top: '#070404', mid: '#0c0706', low: '#090504', ground: '#040202', horizon: 1080, midAt: 0.5 };
    env.skyRimAmt = 0;
    const hx = 1450, hy = 112;
    for (const c of [far, near, g]) { c.translate(960, 540); c.rotate(roll); const z = 1.05 + u * 0.012; c.scale(z, z); c.translate(-960, -540); }
    // planking
    far.fillStyle = '#140b08'; far.fillRect(-200, -100, 2320, 1300);
    for (let i = 0; i < 17; i++) { far.fillStyle = i % 2 ? '#170d09' : '#110907'; far.fillRect(-200, -60 + i * 74, 2320, 71); far.fillStyle = '#080403'; far.fillRect(-200, -60 + i * 74 + 70, 2320, 4); }
    // ribs of the hull and deck beams
    far.fillStyle = '#0a0504';
    for (const x of [-30, 360, 750, 1140, 1560, 1950]) blob(far, [[x - 26, -100], [x + 26, -100], [x + 34, 420], [x + 62, 1180], [x - 4, 1180], [x - 28, 420]], 0.3);
    far.fillRect(-200, 150, 1560, 40); far.fillRect(1590, 150, 700, 40);
    // the hatch, and the one patch of sky
    const sk = g.createLinearGradient(0, hy - 66, 0, hy + 40);
    sk.addColorStop(0, `rgba(176,160,140,${0.62 * thin})`); sk.addColorStop(1, `rgba(226,200,164,${0.70 * thin})`);
    g.fillStyle = sk; g.fillRect(hx - 118, hy - 66, 236, 106);
    const lantern = [hx + 62, hy - 26];
    glow(g, lantern[0], lantern[1], 70, '#ffae48', 0.75 * thin * flick(t, 25));
    near.fillStyle = '#050202';
    for (let i = 0; i <= 7; i++) near.fillRect(hx - 124 + i * 33.5, hy - 74, 15, 122);
    for (let i = 0; i < 4; i++) near.fillRect(hx - 126, hy - 68 + i * 34, 252, 12);
    near.strokeStyle = '#1f110b'; near.lineWidth = 17; near.strokeRect(hx - 128, hy - 76, 256, 126);
    // shaft of light, falling toward the one who reaches
    g.save(); g.globalCompositeOperation = 'lighter';
    const target = [1255, 700];
    for (const [spread, a] of [[1.0, 0.060], [0.66, 0.060], [0.34, 0.070]]) {
      const gr = g.createLinearGradient(hx, hy, target[0] - 130, 1040);
      gr.addColorStop(0, `rgba(236,208,168,${a * 2.0 * thin})`); gr.addColorStop(0.55, `rgba(220,180,130,${a * thin})`); gr.addColorStop(1, 'rgba(180,130,90,0)');
      g.fillStyle = gr;
      fillPoly(g, [[hx - 112 * spread, hy + 34], [hx + 112 * spread, hy + 34], [target[0] + 250 * spread, 1100], [target[0] - 400 * spread, 1100]]);
    }
    g.restore();
    for (let i = 0; i < 90; i++) {
      const k = mod(hash(i) + u * (0.015 + hash(i + 3) * 0.03), 1);
      const x = lerp(hx, target[0] - 90, k) + (hash(i + 5) - 0.5) * (130 + k * 380) + Math.sin(t + i) * 8, y = lerp(hy + 40, 1040, k);
      g.fillStyle = `rgba(255,226,190,${0.35 * thin * Math.sin(k * PI) * hash(i + 8)})`; disc(g, x, y, 1.1 + hash(i + 9) * 1.5);
    }
    // two shelves and the floor, crowded
    const litFill = { x: hx - 130, y: 520, r: 900, color: '#6a3a22', k: 0.46 * thin };
    const shelf = (c, y, hgt, n, x0, x1, seed, k) => {
      const lf = { ...litFill, k: litFill.k * k };
      for (let i = 0; i < n; i++) {
        // people crowd unevenly: pairs lean together, some are only half seen
        const x = lerp(x0, x1, (i + 0.5) / n) + (hash(i + seed) - 0.5) * hgt * 0.34;
        seated(c, x, y - 4 + hash(i + seed + 5) * 12, hgt * (0.84 + hash(i + seed + 9) * 0.30), i + seed, lf);
      }
      c.fillStyle = '#1b0e09'; c.fillRect(-150, y, 2220, hgt * 0.095);
      c.fillStyle = '#070303'; c.fillRect(-150, y + hgt * 0.095, 2220, hgt * 0.065);
    };
    shelf(far, 604, 172, 27, -140, 2060, 100, 0.50);
    far.fillStyle = 'rgba(8,4,3,0.30)'; far.fillRect(-200, 360, 2320, 270);
    shelf(near, 828, 262, 17, -150, 2080, 300, 0.92);
    for (let i = 0; i < 13; i++) {
      const x = -110 + i * 178 + (hash(i + 500) - 0.5) * 70;
      if (x > 850 && x < 1420) continue;
      seated(near, x, 1112 + hash(i) * 30, 392, i + 500, { ...litFill, k: 0.28 * thin });
    }
    // iron, barely seen: short sagging lengths along the edge of the boards
    near.strokeStyle = '#2c201d'; near.lineWidth = 2.6;
    for (const [x0, n] of [[150, 7], [610, 5], [1460, 8], [1790, 5]]) {
      for (let i = 0; i < n; i++) { const k = i / (n - 1); near.beginPath(); near.ellipse(x0 + i * 15, 826 + Math.sin(k * PI) * 17, 9.5, 3.8, (0.5 - k) * 1.4 + (i % 2) * 0.4, 0, TAU); near.stroke(); }
    }

    // one of them looks up and reaches
    const reach = easeInOut(invLerp(49.45, 50.9, t));
    const wx = 1005, wy = 1172;
    const f = FIG.person(near, {
      x: wx, y: wy, h: 650, color: '#1c0f0d', far: '#110908', cloth: '#22130f', dress: 'wrap', hair: 'short',
      lit: { x: 1360, y: 450, r: 560, color: '#80482a', k: 0.62 * thin },
      p: FIG.kneel({ hip: [-0.05, 0.25], lean: 0.20 - reach * 0.04, tilt: -0.30 * reach - 0.02, handA: [lerp(0.18, 0.30, reach), lerp(0.36, 0.90, reach)], handB: [0.14, 0.30], elbowA: -1 }),
    });
    // the same open hand that was left on the cave wall
    const [ax, ay] = f.handA;
    near.save(); near.translate(ax + 6, ay - 3); near.rotate(lerp(1.5, 0.52, reach)); near.scale(0.455, 0.455);
    const hg = near.createLinearGradient(40, -240, -60, 40);
    hg.addColorStop(0, M('#1c0f0d', '#b07c56', reach * thin)); hg.addColorStop(1, '#2a1610');
    near.fillStyle = hg; PROPS.hand(near, false); near.restore();
    glow(g, ax + 46, ay - 58, 120, '#e8b88c', 0.15 * reach * thin);

    env.lights.push({ x: hx - 40, y: 300, r: 900, i: 0.40 * thin, color: '#e8c090' });
    env.rim = 1.25; env.bloom = 0.46; env.thresh = 0.72; env.vig = 0.55;
  });
})();
