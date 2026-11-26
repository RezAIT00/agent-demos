// ---------- app ----------
const glCanvas = document.getElementById('c');
const fxCanvas = mkCanvas(), typeCanvas = mkCanvas();
const FX = fxCanvas.getContext('2d'), TX = typeCanvas.getContext('2d');
const R = new Renderer(glCanvas);
const MESHES = [new Mesh(), new Mesh(), new Mesh(), new Mesh()];
let meshUse = 0;
// build a 3D scene into a pooled mesh
function makeScene(fn) {
  const mesh = MESHES[meshUse++ % MESHES.length].reset();
  const out = { spokes: [], anchors: {}, legs: {} };
  fn(mesh, out);
  return { mesh, spokes: out.spokes, A: out.anchors, legs: out.legs, head: out.head, out };
}

const frameBuf = new Uint8Array(W * H * 4);
window.readFrame = async () => R.read(frameBuf);

// ---------- character sheet ----------
const SHEET_LIGHT = { dir: [0.42, 0.78, 0.55], lit: [1, 0.99, 0.97], shade: [1, 1, 1], rim: [1, 0.86, 0.6], rimDir: [-0.75, 0.35, -0.55], rimAmt: 0.55 };
function heroOnBike(mb, out, st, bikeExtra) {
  buildBike(mb, out, Object.assign({ wheel: (st.crank || 0) * BG.gear, crank: st.crank || 0, blur: 0 }, bikeExtra || {}));
  buildPelican(mb, out, st);
}
function renderStill(view, post) {
  meshUse = 0;
  R.render({ t: 0, draw: 0, views: [view], post: Object.assign({ vig: 0.12, bloom: 0.12, grain: 0.006 }, post || {}) });
}
function sheetView(st, cam, extra) {
  const s = makeScene((mb, out) => heroOnBike(mb, out, st, extra && extra.bike));
  return Object.assign({ cam, env: { mode: 0 }, light: SHEET_LIGHT, mesh: s.mesh, spokes: s.spokes, focus: [0.05, 0.8, 0], shadowSize: 1.5, eyes: { hero: (extra && extra.eye) || { open: 1, brow: 0.8 } }, scene: s }, extra && extra.view);
}
const orbit = (az, el, dist, tgt, fov = 30) => ({ pos: [tgt[0] + Math.sin(az) * Math.cos(el) * dist, tgt[1] + Math.sin(el) * dist, tgt[2] + Math.cos(az) * Math.cos(el) * dist], tgt, fov });
const BASE_ST = { crank: 0.55, neck: 'ride', t: 0.31, wind: 0.55, scarf: { wind: 0.8 } };

function label(g, text, x, y, size, col = '#1a1028', align = 'center') { strokeText(g, text, x, y, size, { color: col, align, weight: size * 0.14 }); }

window.renderTurnaround = () => {
  const cv = mkCanvas(3840, 1620), g = cv.getContext('2d');
  g.fillStyle = '#141024'; g.fillRect(0, 0, cv.width, cv.height);
  heavyText(g, 'TURNAROUND · THE PELICAN ON THE BIKE', 1920, 70, 74, { fill: '#fff', skew: 0.12 });
  const views = [['DRIVE SIDE', 0, 0.04], ['FRONT 3/4', 0.9, 0.12], ['FRONT', PI / 2, 0.05], ['FRONT 3/4 NON-DRIVE', 2.35, 0.16], ['NON-DRIVE SIDE', PI, 0.04], ['REAR 3/4', -2.3, 0.2], ['REAR', -PI / 2, 0.08], ['HIGH 3/4', 0.55, 0.62]];
  views.forEach((v, i) => {
    renderStill(sheetView(BASE_ST, orbit(v[1], v[2], 4.35, [0.07, 0.86, 0])));
    const x = (i % 4) * 960, y = 140 + Math.floor(i / 4) * 740;
    g.drawImage(glCanvas, 240, 0, 1440, 1080, x + 6, y, 948, 711);
    g.fillStyle = 'rgba(255,255,255,0.88)'; g.fillRect(x + 6, y + 663, 948, 48);
    label(g, v[0], x + 480, y + 687, 26);
  });
  return cv.toDataURL('image/png');
};

window.renderCharacterSheet = () => {
  const cv = mkCanvas(3840, 3200), g = cv.getContext('2d');
  g.fillStyle = '#141024'; g.fillRect(0, 0, cv.width, cv.height);
  heavyText(g, 'THE PELICAN · CHARACTER SHEET', 1920, 78, 82, { fill: '#fff', skew: 0.12 });
  strokeText(g, 'BEAK VELOCITY · ORIGINAL DESIGN · EVERY PIXEL DRAWN BY CODE', 1920, 150, 30, { color: '#ffbe3a' });
  // 1. five expressions
  heavyText(g, '1 · FIVE EXPRESSIONS', 60, 230, 44, { fill: '#ffbe3a', align: 'left' });
  const ex = [
    ['DETERMINED', { open: 1, brow: 0.95, mode: 0, glint: 0.3 }, { beakOpen: 0, neck: 'ride' }],
    ['SHOCKED', { open: 1, brow: -0.55, mode: 1 }, { beakOpen: 0.42, neck: 'tall', crestRaise: 0.9, brow: -0.4 }],
    ['IN PAIN', { open: 1, brow: -0.35, mode: 2 }, { beakOpen: 0.16, neck: 'ride', head: { pitch: -0.18 }, wind: 0.1, brow: -0.2 }],
    ['PURE JOY', { open: 1, brow: -0.15, mode: 3 }, { beakOpen: 0.30, neck: 'proud', crestRaise: 0.35, brow: 0.1 }],
    ['SMUG', { open: 0.9, brow: 0.35, mode: 4, lookX: 0.2 }, { beakOpen: 0, neck: 'proud', head: { pitch: 0.04 }, pouch: 0.35, brow: 0.35 }]
  ];
  ex.forEach((e, i) => {
    const st = Object.assign({}, BASE_ST, e[2], { t: 0.4 + i * 0.21 });
    const N = neckPose(st.neck);
    const tgt = [N.H[0] + 0.09, N.H[1] - 0.045, 0];
    renderStill(sheetView(st, orbit(0.34, 0.02, 1.38, tgt, 30), { eye: e[1] }));
    const x = i * 768;
    g.drawImage(glCanvas, 420, 0, 1080, 1080, x + 8, 280, 752, 752);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(x + 8, 976, 752, 56); label(g, e[0], x + 384, 1004, 30);
  });
  // 2. pedal cycle with contact report
  heavyText(g, '2 · PEDAL CYCLE · ONE FULL CRANK TURN, FEET ON PEDALS', 60, 1100, 44, { fill: '#ffbe3a', align: 'left' });
  for (let i = 0; i < 8; i++) {
    const th = i / 8 * TAU;
    const st = Object.assign({}, BASE_ST, { crank: th, t: 0.31 });
    const view = sheetView(st, { pos: [0.0, 0.50, 2.95], tgt: [0.0, 0.50, 0], fov: 30 });
    renderStill(view);
    const x = (i % 4) * 960, y = 1150 + Math.floor(i / 4) * 640;
    g.drawImage(glCanvas, 160, 70, 1600, 920, x + 6, y, 948, 545);
    const cm = camMatrices(view.cam);
    for (const [key, col, side] of [['footR', '#ff2d55', 1], ['footL', '#2d7dff', -1]]) {
      const pf = pedalFrame(th, side);
      const p = project(cm, [pf.P[0], pf.P[1], pf.P[2]]);
      const sx = x + 6 + (p[0] - 160) * 948 / 1600, sy = y + (p[1] - 70) * 545 / 920;
      g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.arc(sx, sy, 15, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(sx - 24, sy); g.lineTo(sx + 24, sy); g.moveTo(sx, sy - 24); g.lineTo(sx, sy + 24); g.stroke();
    }
    const rep = contactReport(th);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(x + 6, y + 548, 948, 74);
    label(g, 'CRANK ' + Math.round(i * 45) + ' DEG · WHEEL ' + Math.round(i * 45 * BG.gear) + ' DEG', x + 480, y + 570, 24);
    label(g, 'SOLE GAP R ' + rep.footR.toFixed(1) + ' / L ' + rep.footL.toFixed(1) + ' MM · LEG REACH ' + Math.round(rep.reachR * 100) + '% / ' + Math.round(rep.reachL * 100) + '%', x + 480, y + 602, 20, '#7a1740');
  }
  // 3. contact close-ups
  heavyText(g, '3 · CONTACT POINTS UP CLOSE', 60, 2480, 44, { fill: '#ffbe3a', align: 'left' });
  const closes = [
    ['WING FINGERS WRAP THE BAR', { pos: [1.02, 1.04, 0.86], tgt: [0.585, 0.89, 0.19], fov: 27 }, { crank: 0.55 }],
    ['WEBBED FOOT ON PEDAL · CHAINRING', { pos: [0.40, 0.46, 0.90], tgt: [0.04, 0.30, 0.08], fov: 30 }, { crank: 0.2 }],
    ['SEATED ON THE SADDLE', { pos: [-0.55, 1.02, 1.55], tgt: [-0.17, 0.94, 0], fov: 30 }, { crank: 2.2 }],
    ['CHAIN · COG · SPOKES', { pos: [-0.54, 0.45, 1.05], tgt: [-0.33, 0.33, 0], fov: 32 }, { crank: 1.0 }]
  ];
  closes.forEach((c, i) => {
    renderStill(sheetView(Object.assign({}, BASE_ST, c[2]), c[1]));
    const x = i * 960;
    g.drawImage(glCanvas, 240, 0, 1440, 1080, x + 6, 2530, 948, 640);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(x + 6, 3122, 948, 50); label(g, c[0], x + 480, 3147, 24);
  });
  return cv.toDataURL('image/png');
};

// measure contact points from the real vertex buffers
function contactReport(theta) {
  const mb = MESHES[3].reset(); const out = { spokes: [], anchors: {}, legs: {} };
  buildPelican(mb, out, Object.assign({}, BASE_ST, { crank: theta }));
  const res = {};
  const partVerts = pred => { const a = []; for (let i = 0; i < mb.nv; i++) { const o = i * VSTR; if (pred(mb.v[o + 9])) a.push([mb.v[o], mb.v[o + 1], mb.v[o + 2]]); } return a; };
  for (const [key, side, parts] of [['footR', 1, [63, 64, 65]], ['footL', -1, [73, 74, 75]]]) {
    const pf = pedalFrame(theta, side); let minY = 1e9, penetr = 0, over = 0;
    for (const p of partVerts(q => parts.includes(q))) {
      const d = sub(p, pf.P), lx = dot(d, pf.ex), ly = dot(d, pf.ey), lz = d[2];
      if (Math.abs(lx) <= 0.050 && Math.abs(lz) <= 0.042 && ly > -0.002) { minY = Math.min(minY, ly - BG.pedalH); over++; }
    }
    res[key] = minY * 1000; res[key + 'Verts'] = over;
  }
  res.reachR = out.legs.footR.reach; res.reachL = out.legs.footL.reach;
  // fingers vs bar tape surface (tape radius 15.2 mm)
  for (const [key, side, parts] of [['gripR', 1, [15, 16, 17, 18]], ['gripL', -1, [55, 56, 57, 58]]]) {
    const G = [BG.grip[0], BG.grip[1], side * BG.grip[2]], ax = BG.gripAxis; let m = 1e9, near = 0;
    for (const p of partVerts(q => parts.includes(q))) { const d = sub(p, G), along = dot(d, ax); if (Math.abs(along) > 0.06) continue; const r = vlen(sub(d, mul(ax, along))) - 0.0152; m = Math.min(m, r); if (r < 0.006) near++; }
    res[key] = m * 1000; res[key + 'Near'] = near;
  }
  // body resting on saddle
  let mb1 = 1e9; for (const p of partVerts(q => q === 1)) if (p[0] > BG.saddleX - 0.09 && p[0] < BG.saddleX + 0.12 && Math.abs(p[2]) < 0.045) mb1 = Math.min(mb1, p[1]);
  res.saddle = (mb1 - BG.saddleTop) * 1000;
  // leg clearance to frame tubes and front wheel
  const L = out.legs; let clear = 1e9;
  const seat = [[BG.BB, BG.ST, 0.0175], [BG.BB, BG.HTB, 0.020], [BG.ST, BG.HTT, 0.016]];
  for (const k of ['footR', 'footL']) { const g = L[k]; for (const [a, b, r] of seat) { clear = Math.min(clear, segDist(g.J, g.A, a, b) - r - 0.022, segDist(g.K, g.J, a, b) - r - 0.026); } }
  res.legFrameClear = clear * 1000;
  let toe = 1e9; for (const p of partVerts(q => [63, 64, 65, 73, 74, 75].includes(q))) { const ring = Math.hypot(p[0] - BG.FA[0], p[1] - BG.FA[1]) - (BG.tireOut - BG.tireR); toe = Math.min(toe, Math.hypot(ring, p[2]) - BG.tireR); }
  res.toeWheelClear = toe * 1000;
  return res;
}
window.verifyRig = () => {
  const agg = {}; const upd = (k, v) => { if (!agg[k]) agg[k] = [v, v]; agg[k][0] = Math.min(agg[k][0], v); agg[k][1] = Math.max(agg[k][1], v); };
  for (let d = 0; d < 360; d += 5) { const r = contactReport(d * D2R); for (const k in r) upd(k, r[k]); }
  const round = {}; for (const k in agg) round[k] = agg[k].map(v => Math.round(v * 1000) / 1000);
  // drivetrain consistency
  const dt = 0.37, travel = dt * BG.ringR;
  round.drivetrain = { gear: BG.gear, ringRadius: +BG.ringR.toFixed(4), cogRadius: +BG.cogR.toFixed(4), chainTravelPerRadCrank_mm: +(travel / dt * 1000).toFixed(2), cogTravelPerRadCrank_mm: +(BG.gear * BG.cogR * 1000).toFixed(2), chainLoop_m: +CHAIN.L.toFixed(4) };
  const mb = MESHES[3].reset(); const out = { spokes: [], anchors: {}, legs: {} }; buildBike(mb, out, { crank: 0.4, wheel: 1.0 });
  let low = 1e9; for (let i = 0; i < mb.nv; i++) { const o = i * VSTR; if (mb.v[o + 9] === 212 || mb.v[o + 9] === 213) low = Math.min(low, mb.v[o + 1]); }
  round.tireLowestPoint_mm = +(low * 1000).toFixed(3);
  const lineD = (p, a, b) => segDist(p, p, a, b);
  round.frontTyreToDownTube_mm = +((lineD(BG.FA, BG.BB, BG.HTB) - BG.tireOut - 0.020) * 1000).toFixed(1);
  round.rearTyreToSeatTube_mm = +((lineD(BG.RA, BG.BB, BG.ST) - BG.tireOut - 0.0175) * 1000).toFixed(1);
  return round;
};

// ---------- film ----------
window.DURATION = typeof TL !== 'undefined' ? TL.DURATION : 0;
window.renderAt = t => {
  meshUse = 0;
  const frame = filmFrame(clamp(t, 0, window.DURATION - 1 / 240));
  R.render(frame);
};
window.CUTS = typeof TL !== 'undefined' ? TL.cuts() : [];
window.TIMELINE = typeof TL !== 'undefined' ? TL : null;

// live preview when opened directly (silent: the page loads no media)
if (!/capture/.test(location.search) && typeof filmFrame === 'function') {
  let t0 = null, paused = false, tcur = 0;
  const loop = ts => { if (t0 === null) t0 = ts - tcur * 1000; if (!paused) tcur = ((ts - t0) / 1000) % window.DURATION; window.renderAt(Math.floor(tcur * 24) / 24); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  addEventListener('keydown', e => { if (e.code === 'Space') { paused = !paused; t0 = null; e.preventDefault(); } if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { tcur = (tcur + (e.code === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 / 24 : 1.5) + window.DURATION) % window.DURATION; t0 = null; } });
  glCanvas.addEventListener('click', e => { const r = glCanvas.getBoundingClientRect(); tcur = (e.clientX - r.left) / r.width * window.DURATION; t0 = null; });
}
window.READY = true;
