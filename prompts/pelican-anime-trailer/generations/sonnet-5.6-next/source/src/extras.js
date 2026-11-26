// ---------- delivery stills rendered by the same renderer: thumbnail, contact sheet, determinism ----------
window.renderThumbnail = () => {
  meshUse = 0;
  const F = { t: 54.6, draw: 7, views: [], post: {}, fx: null, type: null };
  const v = view3d(F, {
    cam: cam([3.10, 0.52, 3.10], [-0.86, 1.46, 0.50], 37, -0.085), env: { mode: 8, time: 3.4, vanish: [0.76, 0.52], dim: 0.56 }, light: Object.assign({}, LIGHT.power, { dir: [0.55, 0.25, 0.78], lit: [0.99, 0.90, 0.76] }), noShadow: true, focus: [0, 1.3, 0], shadowSize: 2.4,
    scene: (mb, out) => hero(mb, out, { t: 2.13, wind: 1, neck: { a: 'proud', b: 'front', k: 0.45 }, head: { yaw: -0.20, pitch: 0.06 }, beakOpen: 0.34, crestRaise: 0.9, brow: 1, eyeFwd: 0.1, wing: { spread: 0.80, flap: 0.12 }, scarf: { wind: 1, lift: 0.42, len: 1.5 } }, { wheel: 7.3, crank: 0.62, blur: 1.7 }),
    discBlur: 1.5, eyes: { hero: { open: 1, brow: 1.55, glow: 0.65, glowCol: [1.0, 0.97, 0.65], pupil: 0.66, glint: 0.35 } }
  });
  const g = fxLayer(F);
  speedRadial(g, 1330, 500, 5, { inner: 700, alpha: 0.5, n: 90, color: '#fff2b8' });
  embers(g, 3.7, { n: 80, stretch: 3.0 });
  const tx = typeLayer(F);
  const gold = [[0, '#ffffff'], [0.34, '#fff1a8'], [0.60, '#ffb71c'], [1, '#f2531c']];
  const word = (s, y, size) => heavyText(tx, s, 78, y, size, { align: 'left', skew: 0.20, track: 6, fill: gold, layers: [['#150822', size * 0.13], ['#fff8e8', size * 0.062], ['#150822', size * 0.025]], drop: [size * 0.06, size * 0.07, '#a30f32'] });
  word('BEAK', 796, 170); word('VELOCITY', 968, 142);
  kanaText(tx, 'ペリカン', 214, 656, 54, { color: '#ffffff', outline: '#17081f' });
  F.post = { vig: 0.34, bloom: 0.24, bloomThr: 0.92, aura: goldAura(0.92, { len: 0.085, lean: -0.35, halo: 0.011 }), grain: 0.008 };
  R.render(F);
  return glCanvas.toDataURL('image/png');
};
window.renderContactSheet = (step = 2, first = 1) => {
  const cols = 6, times = []; for (let t = first; t < window.DURATION; t += step) times.push(t);
  const cw = 480, ch = 270, pad = 8, lab = 34, rows = Math.ceil(times.length / cols);
  const cv = mkCanvas(cols * (cw + pad) + pad, rows * (ch + lab + pad) + pad + 70), g = cv.getContext('2d');
  g.fillStyle = '#120c20'; g.fillRect(0, 0, cv.width, cv.height);
  heavyText(g, 'BEAK VELOCITY · ONE FRAME EVERY 2 SECONDS', cv.width / 2, 40, 40, { skew: 0.14, fill: '#ffffff' });
  times.forEach((t, i) => {
    window.renderAt(t);
    const x = pad + (i % cols) * (cw + pad), y = 76 + Math.floor(i / cols) * (ch + lab + pad);
    g.drawImage(glCanvas, 0, 0, W, H, x, y, cw, ch);
    strokeText(g, t.toFixed(2) + ' S  ·  ' + TL.shotAt(t).id.toUpperCase(), x + 8, y + ch + 17, 17, { align: 'left', color: '#ffc83a', weight: 2.4 });
  });
  return cv.toDataURL('image/png');
};
// whole-film rig check: every pedalling leg in every frame must reach its pedal without locking out
window.filmRigCheck = () => {
  const per = {}; let cur = null;
  window.__legStats = (who, reach) => { const k = cur + (who ? ' (rival)' : ''); const e = per[k] || (per[k] = { legs: 0, min: 9, max: 0, over: 0 }); e.legs++; e.min = Math.min(e.min, reach); e.max = Math.max(e.max, reach); if (reach > 0.995) e.over++; };
  const n = Math.round(window.DURATION * 24);
  // drivetrain: compare each bike with itself on the next frame of the same shot
  let calls = [], prev = null, prevShot = null;
  const D = { pedallingSteps: 0, coastingSteps: 0, maxPedalError_rad: 0, wheelLagsDrive: 0, badShots: {} };
  window.__driveStats = (rival, wheel, crank) => calls.push({ rival, wheel, crank });
  for (let i = 0; i < n; i++) {
    cur = TL.shotAt(i / 24).id; calls = []; window.renderAt(i / 24);
    // flashback replays earlier footage; in the crash the rider has left the bike
    if (prev && prevShot === cur && prev.length === calls.length && cur !== 'flashback' && cur !== 'crash') {
      calls.forEach((c, k) => {
        const dc = c.crank - prev[k].crank, dw = c.wheel - prev[k].wheel;
        if (Math.abs(dc) > 1e-9) { D.pedallingSteps++; const e = Math.abs(dw - BG.gear * dc); D.maxPedalError_rad = Math.max(D.maxPedalError_rad, e); if (e > 1e-6) D.badShots[cur] = (D.badShots[cur] || 0) + 1; }
        else if (Math.abs(dw) > 1e-9) { D.coastingSteps++; if (dw < 0) { D.wheelLagsDrive++; D.badShots[cur] = (D.badShots[cur] || 0) + 1; } }
      });
    }
    prev = calls; prevShot = cur;
  }
  window.__legStats = null; window.__driveStats = null;
  D.maxPedalError_rad = +D.maxPedalError_rad.toExponential(2);
  let legs = 0, mx = 0, mn = 9, over = 0, worst = '';
  for (const [k, e] of Object.entries(per)) { legs += e.legs; over += e.over; mn = Math.min(mn, e.min); if (e.max > mx) { mx = e.max; worst = k; } }
  return { drivetrain: D, pedallingLegPosesChecked: legs, minReach: +mn.toFixed(3), maxReach: +mx.toFixed(3), worstShot: worst, posesOverReach: over, overByShot: Object.fromEntries(Object.entries(per).filter(([, e]) => e.over).map(([k, e]) => [k, e.over])) };
};
// every frame must be a pure function of t: render in order, then shuffled, and compare the pixels
window.determinismCheck = (n = 48) => {
  const times = Array.from({ length: n }, (_, i) => Math.round(((i + 0.37) / n) * window.DURATION * 24) / 24);
  const a = new Uint8Array(W * H * 4), hashOf = () => { R.read(a); let h = 2166136261 >>> 0; for (let i = 0; i < a.length; i += 1) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
  const first = times.map(t => { window.renderAt(t); return hashOf(); });
  const order = times.map((_, i) => i).sort((x, y) => hash(x * 97 + 3) - hash(y * 97 + 3));
  const bad = [];
  for (const i of order) { window.renderAt(times[i]); if (hashOf() !== first[i]) bad.push(+times[i].toFixed(4)); }
  return { framesChecked: n, mismatches: bad.length, mismatchTimes: bad.slice(0, 12) };
};
