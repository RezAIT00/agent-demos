// ---------- hand-built 2D extreme close-ups of the eye ----------
// variable-width ink stroke along a cubic bezier
function taperStroke(g, p0, p1, p2, p3, w, color, n = 40) {
  const L = [], Rr = [];
  const at = t => { const m = 1 - t; return [m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0], m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1]]; };
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = at(Math.max(0, t - 0.01)), b = at(Math.min(1, t + 0.01)), p = at(t);
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const hw = (typeof w === 'function' ? w(t) : w * Math.sin(PI * (0.06 + 0.88 * t))) / 2;
    L.push([p[0] - dy * hw, p[1] + dx * hw]); Rr.push([p[0] + dy * hw, p[1] - dx * hw]);
  }
  g.beginPath(); L.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); for (let i = Rr.length - 1; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]); g.closePath(); g.fillStyle = color; g.fill();
}
// a pointed feather / tuft shape with a rounded root
function tuft(g, bx, by, ang, len, wid, fill, line, bend = 0.18) {
  const c = Math.cos(ang), s = Math.sin(ang), P = (u, v) => [bx + c * u * len - s * v * len, by + s * u * len + c * v * len];
  const w = wid / len;
  const o = P(0, 0), a1 = P(0.03, -w * 0.72), a2 = P(0.66, -w * 0.42 + bend * 0.40), tip = P(1, bend), b1 = P(0.62, w * 0.20 + bend * 0.42), b2 = P(0.03, w * 0.74);
  g.beginPath(); g.moveTo(o[0], o[1]); g.bezierCurveTo(a1[0], a1[1], a2[0], a2[1], tip[0], tip[1]); g.bezierCurveTo(b1[0], b1[1], b2[0], b2[1], o[0], o[1]); g.closePath();
  g.fillStyle = fill; g.fill();
  if (line) { g.strokeStyle = line; g.lineWidth = 3.2; g.lineJoin = 'round'; g.stroke(); }
}
const EYE_PAL = {
  pel: { bg0: '#121033', bg1: '#2a2764', tuftA: '#8f93d6', tuftB: '#c9ccf4', tuftC: '#eef0ff', shadow: '#4f4c9a', rim: '#ffb95c', skin: '#ffb92e', skinS: '#d8791f', skinD: '#9a4a1c', iris0: '#fff08a', iris1: '#ffb417', iris2: '#a84400', brow: '#2c1c2c', browHi: '#fff1c4', ink: '#160a1c' },
  fal: { bg0: '#07050f', bg1: '#191430', tuftA: '#26233f', tuftB: '#3a3860', tuftC: '#595a8c', shadow: '#100d20', rim: '#a45cff', skin: '#ffcf2e', skinS: '#c98a10', skinD: '#7a4a0c', iris0: '#f2b0ff', iris1: '#a436f0', iris2: '#2c0652', brow: '#0b0913', browHi: '#4a4776', ink: '#07040c' },
  gold: { bg0: '#2a0a22', bg1: '#6a1c36', tuftA: '#e8a85c', tuftB: '#ffdc8a', tuftC: '#fff6d6', shadow: '#a2433e', rim: '#fff2b0', skin: '#ffc437', skinS: '#e0801c', skinD: '#9c4416', iris0: '#ffffe6', iris1: '#ffd21f', iris2: '#e24a00', brow: '#3a1416', browHi: '#fff6d0', ink: '#1a0710' }
};
function drawEyeCloseup(g, o) {
  const P = EYE_PAL[o.pal || 'pel'], t = o.t || 0, open = o.open, gl = o.glint || 0;
  g.save();
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, P.bg0); bg.addColorStop(1, P.bg1);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.translate(W / 2, H / 2); const z = o.zoom || 1; g.scale(o.flip ? -z : z, z); g.rotate(o.rot || 0); g.translate(-W / 2, -H / 2);
  const ds = Math.floor(t * 12);
  // plumage: a lit head surface with strands that flow back from the bill around the eye
  const lit = g.createRadialGradient(1060, 560, 160, 960, 600, 1180);
  lit.addColorStop(0, P.tuftC); lit.addColorStop(0.40, P.tuftB); lit.addColorStop(0.66, P.tuftA); lit.addColorStop(1, P.bg0);
  g.fillStyle = lit; g.fillRect(-300, -300, W + 600, H + 600);
  const flow = (x, y) => { const dy = (y - 600) / 520, dx = (x - 1000) / 800; return PI + Math.atan(dy * 0.85 * Math.exp(-dx * dx * 0.35)) * (x > 1000 ? -0.55 : 1.0) * 0.8; };
  const r = rng(o.pal === 'fal' ? 911 : 407);
  for (let i = 0; i < 620; i++) {
    const x = r() * 2400 - 200, y = r() * 1400 - 160, kind = r(), len = 90 + r() * 240;
    const dx = (x - 960) / 700, dy = (y - 590) / 380, d = Math.sqrt(dx * dx + dy * dy);
    const sway = Math.sin(ds * 2.1 + i * 1.37) * 0.03;
    const a0 = flow(x, y) + sway, x1 = x + Math.cos(a0) * len * 0.5, y1 = y + Math.sin(a0) * len * 0.5, a1 = flow(x1, y1) + sway;
    const x2 = x1 + Math.cos(a1) * len * 0.5, y2 = y1 + Math.sin(a1) * len * 0.5;
    const col = kind < 0.42 ? P.shadow : kind < 0.72 ? P.tuftA : kind < 0.9 ? P.tuftC : P.bg0;
    g.globalAlpha = (kind < 0.42 ? 0.34 : kind < 0.72 ? 0.50 : kind < 0.9 ? 0.55 : 0.30) * (d < 0.9 ? 0.45 : 1);
    const wid = 5 + r() * r() * 28;
    taperStroke(g, [x, y], [x1, y1], [x1, y1], [x2, y2], v => wid * Math.sin(PI * clamp(0.12 + v * 0.88)) , col, 14);
  }
  g.globalAlpha = 1;
  // a few sharp locks catching the light
  for (let i = 0; i < 34; i++) {
    const x = r() * 2100, y = r() < 0.5 ? r() * 300 - 20 : 880 + r() * 300, a = flow(x, y) + Math.sin(ds * 2.4 + i) * 0.03;
    tuft(g, x, y, a, 190 + r() * 230, 36 + r() * 34, i % 3 === 0 ? P.tuftC : i % 3 === 1 ? P.tuftA : P.shadow, 'rgba(16,10,40,0.75)', (y < 600 ? -0.12 : 0.12));
  }
  const vg = g.createRadialGradient(1050, 560, 420, 1000, 560, 1200); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, o.pal === 'gold' ? 'rgba(40,4,20,0.78)' : 'rgba(5,3,20,0.80)'); g.fillStyle = vg; g.fillRect(-300, -300, W + 600, H + 600);
  g.translate(0, 58);
  // bare orbital skin
  const skinPath = () => { g.beginPath(); g.moveTo(330, 612); g.bezierCurveTo(430, 330, 790, 232, 1150, 296); g.bezierCurveTo(1420, 345, 1640, 450, 1800, 560); g.bezierCurveTo(1620, 640, 1500, 820, 1130, 880); g.bezierCurveTo(780, 940, 420, 820, 330, 612); g.closePath(); };
  skinPath(); g.fillStyle = P.skin; g.fill();
  g.save(); skinPath(); g.clip();
  g.fillStyle = P.skinS; g.beginPath(); g.moveTo(300, 200); g.lineTo(1850, 260); g.lineTo(1850, 520); g.bezierCurveTo(1450, 430, 1000, 300, 640, 420); g.bezierCurveTo(500, 470, 420, 560, 320, 640); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(380, 760); g.bezierCurveTo(700, 920, 1180, 940, 1520, 760); g.bezierCurveTo(1300, 990, 640, 1000, 380, 760); g.fill();
  const rs = rng(33); g.fillStyle = P.skinD; for (let i = 0; i < 110; i++) { const x = 380 + rs() * 1300, y = 300 + rs() * 600; g.globalAlpha = 0.20; g.beginPath(); g.ellipse(x, y, 3 + rs() * 6, 2 + rs() * 3, 0.3, 0, TAU); g.fill(); }
  g.globalAlpha = 1; g.restore();
  skinPath(); g.strokeStyle = P.ink; g.lineWidth = 7; g.stroke();
  // beak root with the scar entering from the right
  if (o.pal !== 'fal') {
    g.fillStyle = '#ffab24'; g.beginPath(); g.moveTo(1520, 548); g.bezierCurveTo(1680, 470, 1840, 505, 2060, 560); g.lineTo(2060, 905); g.bezierCurveTo(1820, 800, 1640, 700, 1520, 548); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 7; g.stroke();
    g.fillStyle = '#d96f17'; g.beginPath(); g.moveTo(1590, 630); g.bezierCurveTo(1750, 650, 1900, 700, 2060, 780); g.lineTo(2060, 905); g.bezierCurveTo(1820, 800, 1680, 730, 1590, 630); g.fill();
    taperStroke(g, [1545, 560], [1700, 585], [1860, 640], [2060, 720], 10, P.ink);
    for (const [x, y] of [[1700, 515], [1775, 538]]) { taperStroke(g, [x + 34, y - 30], [x + 15, y], [x - 6, y + 28], [x - 26, y + 62], 25, '#7a1f1c'); taperStroke(g, [x + 34, y - 30], [x + 15, y], [x - 6, y + 28], [x - 26, y + 62], 13, '#ffe9cc'); }
  } else {
    g.fillStyle = '#ffd23a'; g.beginPath(); g.moveTo(1600, 470); g.bezierCurveTo(1750, 450, 1860, 500, 1880, 640); g.bezierCurveTo(1760, 680, 1650, 640, 1600, 470); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 7; g.stroke();
    g.fillStyle = '#8e9bc4'; g.beginPath(); g.moveTo(1800, 480); g.bezierCurveTo(2030, 500, 2110, 660, 2000, 900); g.bezierCurveTo(1985, 760, 1900, 690, 1830, 660); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#15121f'; g.beginPath(); g.moveTo(2030, 610); g.bezierCurveTo(2090, 700, 2075, 800, 2000, 900); g.bezierCurveTo(2000, 790, 1985, 720, 1950, 690); g.fill();
  }
  // lids
  const k = clamp(open, 0, 1.25);
  const L0 = [575, 640], R0 = [1415, 588];
  const closeY = 668;
  const top1 = [700, lerp(closeY, 410, k)], top2 = [1110, lerp(closeY + 20, 352, k)], bot1 = [1210, lerp(closeY + 20, 790, k)], bot2 = [770, lerp(closeY + 8, 800, k)];
  const eyePath = () => { g.beginPath(); g.moveTo(L0[0], L0[1]); g.bezierCurveTo(top1[0], top1[1], top2[0], top2[1], R0[0], R0[1]); g.bezierCurveTo(bot1[0], bot1[1], bot2[0], bot2[1], L0[0], L0[1]); g.closePath(); };
  if (k > 0.04) {
    eyePath(); g.fillStyle = '#fbfaff'; g.fill();
    g.save(); eyePath(); g.clip();
    const cx = 1035 + (o.lookX || 0) * 60 + Math.sin(ds * 3.7) * 2, cy = 585 + (o.lookY || 0) * 40, ir = 186 * (o.irisScale || 1);
    const ig = g.createLinearGradient(0, cy - ir, 0, cy + ir); ig.addColorStop(0, P.iris2); ig.addColorStop(0.45, P.iris1); ig.addColorStop(1, P.iris0);
    g.fillStyle = ig; g.beginPath(); g.arc(cx, cy, ir, 0, TAU); g.fill();
    const ri = rng(77); for (let i = 0; i < 96; i++) { const a = i / 96 * TAU + ri() * 0.05, r0 = ir * (0.45 + ri() * 0.1), r1 = ir * (0.7 + ri() * 0.26); taperStroke(g, [cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * lerp(r0, r1, 0.33), cy + Math.sin(a) * lerp(r0, r1, 0.33)], [cx + Math.cos(a) * lerp(r0, r1, 0.66), cy + Math.sin(a) * lerp(r0, r1, 0.66)], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], 4 + ri() * 6, i % 3 ? 'rgba(90,20,0,0.35)' : 'rgba(255,255,220,0.40)', 6); }
    g.lineWidth = 17; g.strokeStyle = P.iris2; g.beginPath(); g.arc(cx, cy, ir - 7, 0, TAU); g.stroke(); g.lineWidth = 7; g.strokeStyle = P.ink; g.beginPath(); g.arc(cx, cy, ir, 0, TAU); g.stroke();
    const pr = ir * 0.43 * (o.pupil || 1); g.fillStyle = P.ink; g.beginPath(); g.ellipse(cx, cy, pr * (o.pal === 'fal' ? 0.52 : 1), pr, 0, 0, TAU); g.fill();
    // a bicycle reflected in the eye
    g.save(); g.translate(cx + 40, cy + 92); g.scale(0.62, 0.62); g.strokeStyle = o.pal === 'fal' ? 'rgba(255,225,255,0.80)' : 'rgba(255,250,225,0.82)'; g.lineWidth = 6; g.lineJoin = 'round';
    g.beginPath(); g.arc(-62, 14, 36, 0, TAU); g.stroke(); g.beginPath(); g.arc(70, 14, 36, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(-62, 14); g.lineTo(-4, 20); g.lineTo(-24, -34); g.closePath(); g.moveTo(-24, -34); g.lineTo(46, -36); g.lineTo(-4, 20); g.moveTo(46, -36); g.lineTo(70, 14); g.moveTo(46, -36); g.lineTo(52, -52); g.lineTo(68, -50); g.moveTo(-38, -40); g.lineTo(-10, -40); g.stroke(); g.restore();
    // lid shadow
    g.fillStyle = 'rgba(40,24,90,0.38)'; g.beginPath(); g.moveTo(L0[0] - 40, L0[1] - 20); g.bezierCurveTo(top1[0], top1[1] + 92, top2[0], top2[1] + 100, R0[0] + 30, R0[1] + 20); g.lineTo(R0[0] + 60, 200); g.lineTo(L0[0] - 60, 200); g.fill();
    // catch lights
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx - 78, cy - 70, 54, 42, -0.5, 0, TAU); g.fill(); g.beginPath(); g.arc(cx + 92, cy + 36, 17, 0, TAU); g.fill(); g.beginPath(); g.arc(cx - 20, cy - 108, 9, 0, TAU); g.fill();
    g.restore();
    // upper lid ink with a back-flick, thin lower lid
    taperStroke(g, [L0[0] - 8, L0[1] + 4], top1, top2, [R0[0] + 12, R0[1] + 2], u => 8 + 40 * Math.pow(Math.sin(PI * clamp(u * 0.9 + 0.1)), 0.7) * (1 - 0.35 * u), P.ink);
    taperStroke(g, [L0[0] + 10, L0[1] - 2], [515, 640], [455, 600], [398, 520], u => 34 * (1 - u) + 1, P.ink);
    taperStroke(g, R0, bot1, bot2, L0, 15, P.ink);
    taperStroke(g, [640, top1[1] - 8], [760, top1[1] - 62], [1100, top2[1] - 58], [1370, 530], 13, P.skinD);
  } else {
    taperStroke(g, L0, [720, 746], [1140, 752], R0, 46, P.ink);
    taperStroke(g, [L0[0] + 10, L0[1] - 2], [515, 640], [455, 600], [398, 520], u => 30 * (1 - u) + 1, P.ink);
    for (let i = 0; i < 6; i++) { const u = 0.1 + i * 0.13, m = 1 - u; const x = m * m * m * L0[0] + 3 * m * m * u * 720 + 3 * m * u * u * 1140 + u * u * u * R0[0], y = m * m * m * L0[1] + 3 * m * m * u * 746 + 3 * m * u * u * 752 + u * u * u * R0[1]; taperStroke(g, [x, y + 6], [x - 12, y + 30], [x - 30, y + 46], [x - 52, y + 58], v => 17 * (1 - v) + 1, P.ink); }
    taperStroke(g, [640, 590], [800, 520], [1120, 520], [1360, 560], 13, P.skinD);
  }
  // the brow: a heavy ridge angled down toward the bill, crowned with swept-back spikes
  const drop = (o.brow === undefined ? 1 : o.brow);
  const by0 = 258 - 24 * drop, by1 = 446 + 46 * drop;
  const browPt = u => [lerp(1540, 360, u), lerp(by1 - 30, by0 + 56, Math.pow(u, 0.62))];
  const spikes = [[0.16, 300, 54, 0.22], [0.28, 400, 66, 0.30], [0.41, 500, 76, 0.34], [0.54, 580, 86, 0.30], [0.66, 600, 84, 0.22], [0.79, 560, 78, 0.12], [0.90, 480, 70, 0.02], [0.99, 400, 60, -0.08], [0.47, 320, 52, 0.20], [0.72, 340, 52, 0.12]];
  spikes.forEach(([u, len, wid, lift], i) => {
    const p = browPt(u); const sway = Math.sin(ds * 2.7 + i * 1.9) * 12;
    const tip = [p[0] - len * Math.cos(lift), p[1] - len * Math.sin(lift) * 0.80 + sway];
    const c1 = [p[0] - len * 0.30, p[1] - len * lift * 0.50 - 26], c2 = [p[0] - len * 0.68, tip[1] + 6];
    taperStroke(g, p, c1, c2, tip, v => (wid + 13) * Math.pow(1 - v, 0.75) + 3, P.ink, 26);
    taperStroke(g, p, c1, c2, tip, v => wid * Math.pow(1 - v, 0.78), i % 2 ? P.browHi : P.tuftC, 26);
    taperStroke(g, [p[0], p[1] + wid * 0.18], [c1[0], c1[1] + wid * 0.2], [c2[0], c2[1] + wid * 0.1], tip, v => wid * 0.34 * Math.pow(1 - v, 0.9), P.tuftB, 22);
  });
  // the ridge itself: one bold stroke of brow, breaking into three long points at the back
  const bx0 = 1572, yb = by0;
  g.beginPath(); g.moveTo(bx0, by1 + 8);
  g.bezierCurveTo(1380, by1 - 106, 1010, yb - 16, 720, yb - 6);
  g.bezierCurveTo(580, yb - 4, 450, yb - 40, 250, yb - 96 + Math.sin(ds * 3.1) * 7);
  g.bezierCurveTo(380, yb - 12, 470, yb + 20, 575, yb + 40);
  g.bezierCurveTo(470, yb + 44, 360, yb + 34, 205, yb + 18 + Math.sin(ds * 2.6 + 2) * 7);
  g.bezierCurveTo(350, yb + 74, 480, yb + 92, 600, yb + 94);
  g.bezierCurveTo(520, yb + 112, 430, yb + 128, 300, yb + 150 + Math.sin(ds * 3.4 + 4) * 6);
  g.bezierCurveTo(520, yb + 158, 700, yb + 106, 900, yb + 96);
  g.bezierCurveTo(1150, yb + 100, 1370, by1 - 40, bx0, by1 + 8);
  g.closePath(); g.fillStyle = P.brow; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 9; g.lineJoin = 'round'; g.stroke();
  taperStroke(g, [350, yb - 52], [640, yb + 34], [1120, yb + 6], [1500, by1 - 24], 17, 'rgba(255,214,176,0.42)');
  taperStroke(g, [420, yb + 42], [700, yb + 66], [1040, yb + 46], [1340, by1 - 40], 9, 'rgba(255,214,176,0.20)');
  // wind wisps crossing the frame
  for (let i = 0; i < 7; i++) { const y = 80 + hash2(i, 5) * 920; const x = W + 200 - ((t * (900 + 500 * hash2(i, 9)) + hash2(i, 2) * 2600) % 2600); tuft(g, x, y, PI + Math.sin(t * 5 + i) * 0.2, 90 + 90 * hash2(i, 3), 14, P.tuftC, null, 0.2 * Math.sin(t * 7 + i)); }
  // rim light along the front edge
  const rg = g.createLinearGradient(1500, 0, 1920, 0); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, P.rim); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.30 + 0.20 * gl; g.fillStyle = rg; g.fillRect(1500, 0, 520, H); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (o.dim) { g.fillStyle = 'rgba(4,2,14,' + o.dim + ')'; g.fillRect(-300, -300, W + 600, H + 600); }
  if (gl > 0.01) glintStar(g, 957, 515, 120 + 460 * gl, gl, o.pal === 'fal' ? '#e9c4ff' : '#fff6c8', t * 0.6);
  g.restore();
}
