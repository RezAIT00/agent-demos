// 18 - 23 s : a hand left on a wall.   23 - 25.45 s : the ice age.
(() => {
  // ---- a flat hand, wrist at (0,0), fingers up; about 250 units tall -------
  function handShape(c, arm = true) {
    c.beginPath();
    const cap = (a, b) => capsulePath(c, a[0], a[1], a[2], b[0], b[1], b[2]);
    const finger = (pts) => { for (let i = 0; i + 1 < pts.length; i++) cap(pts[i], pts[i + 1]); };
    finger([[-30, -92, 21], [-47, -152, 16.5], [-55, -176, 15.5], [-66, -214, 14]]);
    finger([[-6, -100, 21], [-9, -168, 16.5], [-10, -196, 15.8], [-11, -238, 14.2]]);
    finger([[20, -98, 20], [27, -160, 15.8], [30, -186, 15], [36, -224, 13.5]]);
    finger([[40, -78, 18], [60, -126, 13.8], [67, -146, 13], [80, -176, 11.8]]);
    finger([[-30, -30, 28], [-74, -66, 20], [-90, -84, 18.5], [-114, -116, 15.5]]);
    cap([-14, -50, 44], [10, -72, 48]);
    cap([2, -20, 40], [-2, -66, 52]);
    cap([20, -34, 30], [34, -82, 26]);
    if (arm) cap([2, -18, 38], [10, 66, 37]);
    c.fill();
  }
  PROPS.hand = handShape;
  // negative stencil: a cloud of blown pigment with the hand masked out
  function stencilDots(seed, n) {
    const r = rng(seed), dots = [];
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, rr = Math.sqrt(-2 * Math.log(1 - r() * 0.985));
      dots.push([Math.cos(a) * rr * 88 - 8, Math.sin(a) * rr * 100 - 112, 0.8 + Math.pow(r(), 3) * 4.2, 0.35 + r() * 0.6, i / n * 0.8 + r() * 0.2]);
    }
    return dots;
  }
  const sheet = document.createElement('canvas');
  sheet.width = 640; sheet.height = 640;
  const sx = sheet.getContext('2d', { willReadFrequently: true });
  function paintStencil(dots, k, color, soft = 1) {
    sx.clearRect(0, 0, 640, 640);
    sx.save(); sx.translate(320, 430);
    const g = sx.createRadialGradient(-8, -112, 20, -8, -112, 232);
    const col = hex(color);
    g.addColorStop(0, rgb(col, 0.97 * soft * smooth(k))); g.addColorStop(0.62, rgb(col, 0.88 * soft * smooth(k))); g.addColorStop(0.84, rgb(col, 0.36 * soft * smooth(k))); g.addColorStop(1, rgb(col, 0));
    sx.fillStyle = g; sx.fillRect(-320, -430, 640, 640);
    sx.fillStyle = color;
    for (const [x, y, s, a, at] of dots) {
      if (at > k) continue;
      sx.globalAlpha = a;
      disc(sx, x, y, s);
    }
    sx.globalAlpha = 1;
    sx.globalCompositeOperation = 'destination-out';
    sx.filter = 'blur(2.2px)';
    sx.fillStyle = '#000';
    handShape(sx, true);
    sx.filter = 'none';
    sx.globalCompositeOperation = 'source-over';
    sx.restore();
  }
  const mainDots = stencilDots(5, 2600);

  // the older hands on the wall, painted once
  const old = [];
  function makeOld() {
    for (const [seed, col, a] of [[11, '#8e2f18', 0.85], [12, '#a5471d', 0.7], [13, '#7c2a1c', 0.6]]) {
      paintStencil(stencilDots(seed, 1300), 1, col, 0.8);
      const c = document.createElement('canvas'); c.width = 640; c.height = 640;
      c.getContext('2d', { willReadFrequently: true }).drawImage(sheet, 0, 0);
      old.push([c, a]);
    }
  }

  // a Sulawesi-style warty pig in red ochre
  function pig(c, x, y, s, color) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = color;
    c.globalAlpha = 0.62;
    blob(c, [[-205, -4], [-185, -66], [-105, -104], [10, -112], [95, -82], [150, -92], [175, -70], [236, -22], [250, 8], [214, 22], [160, 14], [112, 44], [10, 56], [-95, 52], [-170, 36]], 0.85);
    for (const [lx, tilt] of [[-150, -10], [-108, 8], [62, -6], [104, 12]]) chain(c, [[lx, 34, 17], [lx + tilt, 84, 9], [lx + tilt * 1.3, 108, 5]]);
    chain(c, [[-202, -14, 6], [-240, 10, 3], [-232, 34, 2]]);
    fillPoly(c, [[130, -84], [140, -128], [162, -80]]);
    fillPoly(c, [[104, -88], [108, -124], [130, -86]]);
    c.globalAlpha = 0.9;
    c.strokeStyle = color; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-184, -62); c.bezierCurveTo(-120, -112, -10, -118, 96, -82); c.bezierCurveTo(130, -94, 160, -92, 178, -68); c.lineTo(244, -12); c.stroke();
    for (let i = 0; i < 22; i++) {                     // bristled crest and body strokes
      const u = i / 21;
      const bx = lerp(-165, 100, u), by = -80 - Math.sin(u * PI) * 30;
      c.lineWidth = 3.2; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - 7, by - 16 - hash(i) * 14); c.stroke();
      c.globalAlpha = 0.55; c.beginPath(); c.moveTo(bx + 6, -50 + hash(i + 4) * 30); c.lineTo(bx - 12, 6 + hash(i + 9) * 34); c.stroke(); c.globalAlpha = 0.9;
    }
    disc(c, 190, -42, 6);
    c.restore();
  }

  // the painter, head and shoulders in profile, facing left. (0,0) = head centre
  function bust(c, x, y, s, rot, t) {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
    const p = new Path2D('M -26 -104 C -66 -96 -84 -68 -85 -40 C -86 -26 -92 -18 -88 -8 C -84 2 -96 16 -108 30 C -112 38 -100 42 -88 41 C -84 46 -93 52 -91 57 C -88 62 -80 62 -80 65 C -82 69 -92 70 -88 76 C -85 82 -76 80 -77 86 C -80 98 -76 108 -62 110 C -46 113 -28 108 -18 104 C -12 124 -14 140 -28 160 C -60 180 -84 224 -92 290 C -100 380 -84 470 -80 640 L 300 640 C 292 460 268 320 214 232 C 176 176 112 172 78 150 C 56 134 54 112 60 90 C 86 62 98 24 92 -18 C 84 -78 34 -112 -26 -104 Z');
    c.fill(p);
    // tightly curled hair
    for (let i = 0; i < 46; i++) {
      const a = -2.6 + i / 45 * 3.9;
      const rr = 84 + hash(i + 2) * 17;
      disc(c, 4 + Math.cos(a) * rr, -10 + Math.sin(a) * rr * 1.02, 17 + hash(i + 8) * 9);
    }
    // a cord with a shell bead or two
    c.strokeStyle = '#2a150c'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(-26, 156); c.quadraticCurveTo(10, 196, 60, 150); c.stroke();
    for (let i = 0; i < 6; i++) { c.fillStyle = '#6a5340'; const u = (i + 0.5) / 6; oval(c, lerp(-26, 60, u), lerp(156, 150, u) + Math.sin(u * PI) * 21, 6, 5); }
    c.restore();
  }

  const camAt = (t) => ({
    z: keys([[17.6, 1.0], [20.9, 1.07], [22.35, 1.27], [23.5, 1.20]], t),
    x: keys([[20.9, 0], [22.35, 40], [23.5, 420]], t),
    y: keys([[20.9, 0], [22.35, -24], [23.5, -10]], t),
    ax: 1060, ay: 520,
  });

  defineScene('cave', 18.15, { kind: 'push', dur: 0.8, center: [960, 560] }, (S) => {
    const { t, env, far, near, glow: g } = S;
    if (!old.length) makeOld();
    const cam = camAt(t);
    const z = cam.z;
    env.bg = 'rock';
    const fk = flick(t, 12);
    const [tx, ty] = camPoint(cam, 1, 706, 560);
    const sway = (noise1(t * 3.1, 4) - 0.5) * 16;
    const cC = [960, 604.8];
    env.rock = {
      torch: { x: tx + 70 + sway, y: ty - 40, z: 400, i: 0.84 * fk, color: '#ffb872' },
      panel: [900 + 3100, 480 + 900, 690, 400],
      scale: 1 / z, ox: cam.ax + cam.x + (cC[0] - cam.ax) / z + 3100, oy: cam.ay + cam.y + (cC[1] - cam.ay) / z + 900,
    };

    const place = ramp(18.55, 19.2, t);            // hand goes to the wall
    const lifted = easeInOut(invLerp(21.0, 21.75, t));
    const paint = keys([[19.35, 0], [19.8, 0.30], [20.0, 0.34], [20.4, 0.68], [20.58, 0.72], [21.0, 1.0]], t);

    withCam([far, near, g], cam, 1, () => {
      // paintings sit in the rock itself
      pig(far, 450, 340, 0.92, '#7a2410');
      const stamp = (i, x, y, s, rot) => { const [cv, a] = old[i]; far.save(); far.translate(x, y); far.rotate(rot); far.scale(s, s); far.globalAlpha = a; far.drawImage(cv, -320, -430); far.restore(); };
      stamp(0, 1560, 400, 0.66, 0.22);
      stamp(1, 1715, 560, 0.56, -0.28);
      stamp(2, 850, 190, 0.50, -0.5);
      stamp(1, 232, 720, 0.60, 0.35);
      far.fillStyle = 'rgba(128,44,20,0.7)';
      for (let i = 0; i < 17; i++) disc(far, 1190 + i * 24 + hash(i) * 7, 206 + Math.sin(i * 0.4) * 17, 6 + hash(i + 5) * 3);

      if (paint > 0) {
        paintStencil(mainDots, paint, '#9c2a12', 1);
        far.drawImage(sheet, 1062 - 320, 668 - 430);
      }
    });

    let torchTip = [620, 645];
    withCam([near, g], cam, 1, () => {
      // child holding the light
      const lit = { x: 760, y: 500, r: 640, color: '#8a4418', k: 0.50 };
      const kid = FIG.person(near, {
        x: 560, y: 1240, h: 640, child: 0.75, color: '#180c08', far: '#100805', cloth: '#22110a', dress: 'wrap', hair: 'curls', lit, t,
        p: FIG.stand({ handA: [0.215, 0.80 + Math.sin(t * 1.6) * 0.005], handB: [0.13, 0.55], tilt: -0.16, lean: 0.04, elbowA: -1 }),
      });
      torchTip = PROPS.torch(near, kid.handA[0], kid.handA[1], -1.30, 128, '#140a06');

      // the painter
      const lean = place * (1 - lifted);
      const puffing = pulse(19.38, 19.86, t, 0.1) + pulse(20.0, 20.46, t, 0.1) + pulse(20.58, 21.02, t, 0.1);
      const headX = lerp(1580, 1452, lean) + lifted * 46, headY = lerp(600, 548, lean) + lifted * 52;
      near.fillStyle = '#1a0d08';
      bust(near, headX, headY, 1.0, lerp(0.04, -0.06, lean) + lifted * 0.05, t);

      // arm and flat hand
      const hx = lerp(lerp(1330, 1062, place), 1232, lifted), hy = lerp(lerp(900, 668, place), 880, lifted);
      const hs = lerp(1.06, 1.0, place) + lifted * 0.05;
      const sh = [headX + 78, headY + 215];
      const elbow = [lerp(sh[0], hx, 0.50) + 20, Math.max(sh[1], hy) + 128 - lifted * 20];
      near.fillStyle = '#1c0e09';
      chain(near, [[sh[0], sh[1], 70], [elbow[0], elbow[1], 46], [lerp(elbow[0], hx + 10, 0.55), lerp(elbow[1], hy + 66, 0.55), 40], [hx + 10 * hs, hy + 58 * hs, 33]]);
      near.save(); near.translate(hx, hy); near.rotate(lifted * 0.45); near.scale(hs, hs);
      const hg = near.createRadialGradient(-210, -100, 30, -210, -100, 420);
      hg.addColorStop(0, '#4a2415'); hg.addColorStop(1, '#1a0d08');
      near.fillStyle = hg;
      handShape(near, true);
      // pigment left on the skin
      if (paint > 0.1) {
        near.globalCompositeOperation = 'source-atop';
        near.fillStyle = rgb(hex('#7a2410'), 0.45 * paint);
        for (let i = 0; i < 260; i++) disc(near, (hash(i + 31) - 0.5) * 230 - 12, -hash(i + 77) * 250 + 20, 0.8 + hash(i + 3) * 1.8);
        near.globalCompositeOperation = 'source-over';
      }
      near.restore();

      // blown ochre
      if (puffing > 0.01) {
        const m = [headX - 90, headY + 66];
        for (let i = 0; i < 150; i++) {
          const f = mod(t * 2.3 + hash(i + 500), 1);
          const aim = [1062 - 14 + (hash(i + 600) - 0.5) * 330, 668 - 125 + (hash(i + 700) - 0.5) * 330];
          const px = lerp(m[0], aim[0], f), py = lerp(m[1], aim[1], easeOut(f)) - Math.sin(f * PI) * 18;
          near.fillStyle = rgb([176, 60, 28], puffing * (1 - f * 0.65) * 0.8);
          disc(near, px, py, 1.1 + hash(i + 800) * 3.2 * f);
        }
        puff(near, lerp(m[0], 1060, 0.55), lerp(m[1], 545, 0.55), 220, 110, '#9a3a18', 0.18 * puffing);
      }
      sparks(g, kid.handA[0] + 30, kid.handA[1] - 150, t, { n: 22, spread: 30, height: 240, size: 2.2, alpha: 0.9, seed: 90 });
    });

    const [fx, fy, fz] = camPoint(cam, 1, torchTip[0], torchTip[1]);
    env.flames.push({ x: fx + 4, y: fy + 14 * fz, w: 44 * fz, h: 168 * fz * (0.95 + 0.05 * fk), i: 1.04, seed: 4.4, halo: 0.55 });
    env.lights.push({ x: fx, y: fy - 70, r: 820, i: 0.56 * fk, color: '#ff9440' });
    env.skyRimAmt = 0; env.rim = 1.7;
    env.bloom = 0.45; env.thresh = 0.78; env.vig = 0.42;
  });

  // ---- ice age -------------------------------------------------------------
  function tent(c, x, y, s, color, g, open) {
    c.fillStyle = color;
    blob(c, [[x - s * 1.25, y + 8], [x - s * 0.72, y - s * 0.72], [x - s * 0.12, y - s * 1.16], [x + s * 0.18, y - s * 1.15], [x + s * 0.74, y - s * 0.70], [x + s * 1.22, y + 8]], 0.55);
    c.strokeStyle = color; c.lineWidth = s * 0.045; c.lineCap = 'round';
    for (const [dx, dy] of [[-0.36, -1.5], [-0.08, -1.58], [0.22, -1.52], [0.42, -1.40]]) { c.beginPath(); c.moveTo(x - dx * s * 0.2, y - s * 1.05); c.lineTo(x + dx * s, y + dy * s); c.stroke(); }
    // seams of the stitched hides
    c.strokeStyle = 'rgba(60,40,38,0.55)'; c.lineWidth = 2;
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * s * 0.05, y - s * 1.1); c.quadraticCurveTo(x + i * s * 0.26, y - s * 0.6, x + i * s * 0.36, y); c.stroke(); }
    if (open) {
      // the flap is tied back: a warm hollow, with someone inside
      const hole = () => blobPath(g, [[x + s * 0.34, y + 2], [x + s * 0.40, y - s * 0.40], [x + s * 0.53, y - s * 0.60], [x + s * 0.66, y - s * 0.34], [x + s * 0.74, y + 2]], 0.55);
      const gr = g.createRadialGradient(x + s * 0.55, y - s * 0.10, 4, x + s * 0.55, y - s * 0.18, s * 0.55);
      gr.addColorStop(0, 'rgba(255,170,74,0.88)'); gr.addColorStop(0.6, 'rgba(196,86,28,0.74)'); gr.addColorStop(1, 'rgba(90,34,16,0.55)');
      g.fillStyle = gr; hole(); g.fill();
      g.save(); hole(); g.clip();
      g.fillStyle = 'rgba(30,14,10,0.92)';
      FIG.person(g, { x: x + s * 0.55, y: y + 2, h: s * 0.62, face: -1, color: '#200e0a', far: '#180a07', cloth: '#200e0a', dress: 'fur', hair: 'bun', p: FIG.sit({ lean: 0.24, handA: [0.24, 0.30], tilt: 0.2 }) });
      g.restore();
      c.strokeStyle = 'rgba(120,80,56,0.8)'; c.lineWidth = 5; blobPath(c, [[x + s * 0.34, y + 2], [x + s * 0.40, y - s * 0.40], [x + s * 0.53, y - s * 0.60], [x + s * 0.66, y - s * 0.34], [x + s * 0.74, y + 2]], 0.55); c.stroke();
      glow(g, x + s * 0.54, y - s * 0.16, s * 0.9, '#ff7a22', 0.20);
    }
  }

  defineScene('ice', 23.05, { kind: 'pan', dur: 0.95 }, (S) => {
    const { t, env, back, far, near, glow: g } = S;
    const u = t - 23.0;
    const scroll = u * 52 + 330 * Math.pow(ramp(24.35, 25.9, t), 2);
    env.sky = { top: '#020917', mid: '#0a2038', low: '#2f5368', ground: '#1a3047', horizon: 700, midAt: 0.55, milky: 0.55, aurora: 1.0 };
    env.haze = { color: '#31566c', amt: 0.34 };
    env.skyRim = '#8fd8d0'; env.skyRimAmt = 0.40;
    SKY.stars(back, t, { alpha: 0.85, pole: [420, -260], horizon: 660 });

    // the ice sheet
    far.fillStyle = vgrad(far, 590, 760, [[0, '#7fa9c0'], [0.35, '#456a86'], [1, '#243d57']]);
    far.beginPath(); far.moveTo(-60, 900);
    for (let x = -60; x <= W + 60; x += 16) {
      const w = x + scroll * 0.10;
      const top = 668 - Math.pow(fbm1(w * 0.0019, 61, 3), 2) * 190 - (noise1(w * 0.045, 5) - 0.5) * 9;
      far.lineTo(x, top);
    }
    far.lineTo(W + 60, 900); far.closePath(); far.fill();
    far.strokeStyle = 'rgba(190,225,240,0.18)'; far.lineWidth = 2.4;
    for (let i = 0; i < 70; i++) {
      const x = mod(hash(i + 3) * 2300 - scroll * 0.10, 2300) - 190;
      const w = x + scroll * 0.10;
      const top = 668 - Math.pow(fbm1(w * 0.0019, 61, 3), 2) * 190;
      far.beginPath(); far.moveTo(x, top + 6); far.lineTo(x + (hash(i) - 0.5) * 12, top + 30 + hash(i + 1) * 52); far.stroke();
    }
    ridge(far, { y: 745, amp: 28, freq: 0.0031, seed: 62, scroll: scroll * 0.28, color: '#29435f' });

    // mammoths on the move
    const walk = u * 0.52;
    FIG.mammoth(far, 1370 + u * 34 - scroll * 0.42, 772, 168, walk, 1, '#101f33');
    FIG.mammoth(far, 1160 + u * 31 - scroll * 0.42, 766, 128, walk + 0.33, 1, '#14253b');
    FIG.mammoth(far, 1040 + u * 31 - scroll * 0.42, 770, 74, walk * 1.4 + 0.6, 1, '#142439');
    FIG.mammoth(far, 1760 + u * 30 - scroll * 0.42, 756, 96, walk + 0.7, 1, '#182c43');

    // snow underfoot
    const gy = (x) => 862 + (fbm1((x + scroll) * 0.0023, 64, 3) - 0.5) * 58;
    near.fillStyle = vgrad(near, 835, H, [[0, '#35506d'], [0.2, '#1d2f48'], [1, '#080e1c']]);
    near.beginPath(); near.moveTo(-60, H + 60);
    for (let x = -60; x <= W + 60; x += 12) near.lineTo(x, gy(x));
    near.lineTo(W + 60, H + 60); near.closePath(); near.fill();

    const fire = { x: 745 - scroll * 1.0, y: 912 };
    const lit = { x: fire.x, y: fire.y - 40, r: 430, color: '#8a4520', k: 0.55 };
    const who = (o) => FIG.person(near, { color: '#101521', far: '#0a0e17', cloth: '#1b1c26', lit, t, dress: 'fur', hat: 'furhood', hair: 'none', ...o });
    tent(near, 380 - scroll, 896, 205, '#17141c', g, true);
    PROPS.logs(near, fire.x, fire.y, 46);
    PROPS.coals(g, fire.x, fire.y, 46, t, 1);
    who({ x: fire.x - 165, y: 936, h: 262, p: FIG.sit({ handA: [0.26, 0.28], handB: [0.22, 0.30], lean: 0.2 }) });
    who({ x: fire.x + 168, y: 930, h: 250, face: -1, p: FIG.seat({ hip: [-0.07, 0.17], lean: 0.24, handA: [0.24, 0.29 + Math.sin(t * 3.6) * 0.012], handB: [0.2, 0.28] }) });
    who({ x: fire.x + 285, y: 940, h: 170, face: -1, child: 0.9, p: FIG.sit({ handA: [0.2, 0.2], lean: 0.16 }) });
    FIG.dog(near, fire.x + 62, 976, 96, t, '#0b0f1a', -1);

    // some of them set out eastward with the fire
    const go = ramp(24.15, 24.6, t);
    if (go > 0) {
      [[0, 296, 1250], [-0.35, 270, 1135], [-0.62, 190, 1055]].forEach(([off, h, x0], i) => {
        const d = Math.max(0, t - 24.15 + off * 0.2) * 245;
        const ph = d / (FIG.cycleLength(0.34) * h) + i * 0.31;
        const x = x0 + d - scroll * 0.55;
        const f = FIG.person(near, {
          x, y: gy(x) + 52 + i * 7, h, color: '#0c111d', far: '#080b13', cloth: '#171925', t, dress: 'fur', hat: 'furhood', hair: 'none', wind: 0.5,
          child: i === 2 ? 0.8 : 0, p: FIG.walk(ph, { stride: 0.34, lean: 0.14, over: i === 0 ? { handA: [0.19, 0.70] } : {} }),
        });
        if (i === 0) {
          const tip = PROPS.torch(near, f.handA[0], f.handA[1], -1.22, 80, '#0c111d');
          env.flames.push({ x: tip[0], y: tip[1] + 6, w: 24, h: 76 * go, i: 0.95, seed: 7, lean: -0.45, halo: 0.75 });
          env.lights.push({ x: tip[0], y: tip[1] - 26, r: 330, i: 0.8 * go * flick(t, 9), color: '#ff9440' });
          sparks(g, tip[0], tip[1] - 30, t, { n: 14, spread: 14, height: 140, size: 1.6, wind: -170, alpha: go, seed: 31 });
        }
      });
    }
    const fk = flick(t, 6);
    env.flames.unshift({ x: fire.x, y: fire.y - 6, w: 38, h: 118, i: 0.98, seed: 2.2, lean: 0.12, halo: 0.85 });
    env.lights.unshift({ x: fire.x, y: fire.y - 40, r: 430, i: 0.9 * fk, color: '#ff8a30' });
    sparks(g, fire.x, fire.y - 56, t, { n: 30, spread: 46, height: 300, size: 1.8, wind: 90, seed: 33 });
    snowfall(g, t, { n: 520, alpha: 0.5, wind: 95, fall: 105, color: '#bcd8ee', size: 2.5 });
    env.bloom = 0.5; env.thresh = 0.7;
  });
})();
