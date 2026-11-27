// closeups.js — hand-built 2D drawings for the extreme close-ups. SUMI's are drawn with greys only.
function bez(p0, p1, p2, p3, n = 24) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, m = 1 - t;
    o.push([m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0],
      m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return o;
}
function pathOf(ctx, segs) { // segs: [[x,y], [c1x,c1y,c2x,c2y,x,y], ...]
  ctx.beginPath();
  ctx.moveTo(segs[0][0], segs[0][1]);
  for (let i = 1; i < segs.length; i++) {
    const s = segs[i];
    if (s.length === 2) ctx.lineTo(s[0], s[1]); else ctx.bezierCurveTo(s[0], s[1], s[2], s[3], s[4], s[5]);
  }
}
function inkLine(ctx, pts, w, color, t0 = 0.15, t1 = 0.1) { ctx.fillStyle = color; brushStroke(ctx, pts, w, t0, t1); }
function fillSegs(ctx, segs, fill) { pathOf(ctx, segs); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }

function washStrokes(ctx, seed, n, cols, y0, y1, ang, lenR, wR, drift) {
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const x = rr(r, -500, 2300) - drift * rr(r, 0.4, 1.6), y = rr(r, y0, y1), L = rr(r, lenR[0], lenR[1]), w = rr(r, wR[0], wR[1]);
    const a = ang + rr(r, -0.07, 0.07), c = cols[Math.floor(r() * cols.length)];
    const dx = Math.cos(a), dy = Math.sin(a);
    // a loose dry-brush stroke: a bundle of tapered bristles
    for (let k = 0; k < 9; k++) {
      const off = (k / 8 - 0.5) * w + rr(r, -w * 0.06, w * 0.06), s0 = rr(r, 0, 0.18), s1 = rr(r, 0.65, 1);
      const p0 = [x + dx * L * s0 - dy * off, y + dy * L * s0 + dx * off], p3 = [x + dx * L * s1 - dy * off, y + dy * L * s1 + dx * off];
      ctx.fillStyle = c;
      brushStroke(ctx, bez(p0, [p0[0] + dx * L * 0.3, p0[1] + dy * L * 0.3 - 18], [p3[0] - dx * L * 0.3, p3[1] - dy * L * 0.3 + 14], p3, 10), w / 8 * rr(r, 0.7, 1.5), 0.3, 0.05);
    }
  }
}

function hairLock(ctx, a, c1, tip, c2, b, cols, lw, sheen = true) {
  const segs = [a, [c1[0], c1[1], c1[2], c1[3], tip[0], tip[1]], [c2[0], c2[1], c2[2], c2[3], b[0], b[1]]];
  pathOf(ctx, segs); ctx.closePath();
  const bx = (a[0] + b[0]) / 2, by = (a[1] + b[1]) / 2;
  const g = ctx.createLinearGradient(bx, by, tip[0], tip[1]);
  // hard cel bands from root to tip
  g.addColorStop(0, cols[0]); g.addColorStop(0.46, cols[0]); g.addColorStop(0.47, cols[1]); g.addColorStop(0.74, cols[1]); g.addColorStop(0.75, cols[2]); g.addColorStop(1, cols[2]);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // shadow flank and glossy streak
  ctx.globalAlpha = 0.34; ctx.fillStyle = '#4a0638';
  brushStroke(ctx, bez(b, [c2[2], c2[3]], [c2[0], c2[1]], tip, 18), Math.hypot(a[0] - b[0], a[1] - b[1]) * 0.55, 1, 0.05);
  ctx.globalAlpha = 1;
  if (sheen) {
    const m = (t) => { const p = bez(a, [c1[0], c1[1]], [c1[2], c1[3]], tip, 30), q = bez(b, [c2[2], c2[3]], [c2[0], c2[1]], tip, 30); return p.map((v, i) => [lerp(v[0], q[i][0], t), lerp(v[1], q[i][1], t)]); };
    inkLine(ctx, m(0.30).slice(7, 22), 11, 'rgba(255,238,205,0.9)', 0.05, 0.05);
    inkLine(ctx, m(0.45).slice(10, 18), 5, 'rgba(255,238,205,0.8)', 0.05, 0.05);
  }
  ctx.restore();
  pathOf(ctx, segs); ctx.closePath();
  ctx.strokeStyle = '#2b0a22'; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke();
  inkLine(ctx, bez(a, [c1[0], c1[1]], [c1[2], c1[3]], tip), lw * 2.1, '#2b0a22', 0.35, 0.05);
}

function animeEye(ctx, e) {
  // e: {cx, cy, w, h, open, flip, irisR, look}
  const { cx, cy, w, h, open, flip } = e;
  const X = u => cx + u * w / 2 * flip, Y = v => cy + v * h;
  const lidTop = bez([X(-1.02), Y(0.06)], [X(-0.62), Y(-0.62 * open - 0.02)], [X(0.34), Y(-0.80 * open - 0.02)], [X(1.03), Y(-0.30 * open - 0.06)], 30);
  const lidBot = bez([X(-1.02), Y(0.06)], [X(-0.50), Y(0.44 * open + 0.06)], [X(0.46), Y(0.46 * open + 0.04)], [X(1.03), Y(-0.30 * open - 0.06)], 30);
  if (open > 0.08) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(lidTop[0][0], lidTop[0][1]);
    for (const p of lidTop) ctx.lineTo(p[0], p[1]);
    for (let i = lidBot.length - 1; i >= 0; i--) ctx.lineTo(lidBot[i][0], lidBot[i][1]);
    ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#fff8f0'; ctx.fillRect(cx - w, cy - h * 1.5, w * 2, h * 3);
    ctx.fillStyle = '#c9a8bf'; // lid shadow across the white
    ctx.beginPath(); ctx.moveTo(lidTop[0][0], lidTop[0][1] + h * 0.1);
    for (const p of lidTop) ctx.lineTo(p[0], p[1] + h * 0.17);
    ctx.lineTo(X(1.2), Y(-1.4)); ctx.lineTo(X(-1.2), Y(-1.4)); ctx.closePath(); ctx.fill();
    const ix = X(e.look || 0.08), iy = cy - h * 0.05, R = e.irisR;
    const g = ctx.createLinearGradient(ix, iy - R * 1.15, ix, iy + R * 1.15);
    g.addColorStop(0, '#062a55'); g.addColorStop(0.45, '#0a79b8'); g.addColorStop(0.72, '#10e0f0'); g.addColorStop(1, '#c8ffe8');
    ctx.beginPath(); ctx.ellipse(ix, iy, R * 0.94, R * 1.12, 0, 0, TAU); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = R * 0.13; ctx.strokeStyle = '#05203f'; ctx.stroke();
    // radial fibres, with every colour caught in them
    ctx.save(); ctx.beginPath(); ctx.ellipse(ix, iy, R * 0.9, R * 1.08, 0, 0, TAU); ctx.clip();
    const cols = ['#ff2e82', '#ffc21f', '#7b3bff', '#e8fff8', '#12d8cc'];
    const r = mulberry32(5);
    for (let i = 0; i < 46; i++) {
      const a = i / 46 * TAU + rr(r, -0.05, 0.05);
      const c = i % 3 === 0 && Math.sin(a) > -0.1 ? cols[i % 5] : 'rgba(190,255,250,0.45)';
      inkLine(ctx, [[ix + Math.cos(a) * R * 0.50, iy + Math.sin(a) * R * 0.60], [ix + Math.cos(a) * R * rr(r, 0.72, 0.9), iy + Math.sin(a) * R * rr(r, 0.86, 1.06)]], R * 0.045, c, 0.2, 0.1);
    }
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(ix, iy - R * 0.02, R * (e.pupil || 0.34), R * (e.pupil || 0.34) * 1.35, 0, 0, TAU); ctx.fillStyle = '#041634'; ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(ix - R * 0.40, iy - R * 0.46, R * 0.27, R * 0.22, -0.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(ix + R * 0.38, iy + R * 0.52, R * 0.11, R * 0.10, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(ix + R * 0.52, iy + R * 0.28, R * 0.05, R * 0.05, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  inkLine(ctx, lidTop, h * 0.25, '#2b0a22', 0.35, 0.5);
  inkLine(ctx, [[X(0.86), Y(-0.36 * open - 0.1)], [X(1.18), Y(-0.55 * open - 0.1)], [X(1.30), Y(-0.74 * open - 0.1)]], h * 0.15, '#2b0a22', 0.9, 0.05);
  inkLine(ctx, [[X(0.66), Y(-0.55 * open - 0.1)], [X(0.90), Y(-0.80 * open - 0.12)]], h * 0.09, '#2b0a22', 0.9, 0.05);
  if (open > 0.08) {
    inkLine(ctx, lidBot.slice(12, 28), h * 0.065, '#2b0a22', 0.05, 0.3);
    inkLine(ctx, bez([X(-0.78), Y(-0.52 * open - 0.20)], [X(-0.3), Y(-0.88 * open - 0.24)], [X(0.4), Y(-0.98 * open - 0.22)], [X(0.86), Y(-0.66 * open - 0.22)]), h * 0.04, '#9a4658', 0.05, 0.05);
  }
}

// ------------------------------------------------------------------ IRO
function drawIroFace(ctx, t, o) {
  const sw = Math.sin(t * 5.1) * 9, sw2 = Math.sin(t * 6.7 + 1.4) * 13;
  const HAIR = ['#c60f64', '#ff4a26', '#ffc41c'];
  const BACK = ['#85094a', '#c22442', '#ea7a1c'];
  const OL = '#2b0a22';
  // mane behind the head
  hairLock(ctx, [560, 260], [200, 140, -60, 250], [-230 + sw2, 170 + sw], [60, 330, 330, 470], [600, 520], BACK, 7);
  hairLock(ctx, [620, 160], [380, -40, 120, -70], [-80 + sw, -40 + sw2], [200, 120, 380, 240], [640, 380], BACK, 7);
  hairLock(ctx, [560, 430], [260, 450, 20, 640], [-200 + sw, 700 + sw2], [140, 660, 360, 650], [620, 640], BACK, 7);
  hairLock(ctx, [600, 600], [380, 700, 230, 900], [-40 + sw2, 1060 + sw], [320, 930, 500, 830], [700, 760], BACK, 7);
  hairLock(ctx, [760, 150], [620, -80, 420, -160], [240 + sw, -140], [520, 40, 590, 170], [660, 300], HAIR, 7);
  hairLock(ctx, [1000, 140], [980, -60, 820, -190], [640 + sw2, -200], [800, -20, 780, 90], [760, 220], HAIR, 7);
  hairLock(ctx, [1180, 220], [1300, 20, 1260, -100], [1190 + sw, -190], [1170, -10, 1080, 80], [1010, 190], BACK, 7);
  // neck and collar
  fillSegs(ctx, [[790, 790], [800, 880, 790, 950, 760, 1100], [1090, 1100], [1060, 950, 1055, 870, 1075, 780]], '#e89270');
  fillSegs(ctx, [[800, 880], [880, 930, 990, 930, 1060, 850], [1052, 960], [960, 1030, 860, 1020, 795, 950]], '#a8525c');
  inkLine(ctx, bez([795, 800], [803, 880], [792, 960], [768, 1090]), 9, OL);
  inkLine(ctx, bez([1072, 800], [1056, 880], [1058, 960], [1092, 1090]), 9, OL);
  fillSegs(ctx, [[330, 1100], [440, 940, 640, 880, 790, 900], [830, 990, 850, 1050, 870, 1100]], '#12d6c6');
  fillSegs(ctx, [[1500, 1100], [1380, 940, 1200, 870, 1058, 890], [1040, 990, 1010, 1050, 990, 1100]], '#0a8a99');
  fillSegs(ctx, [[792, 900], [832, 990, 852, 1050, 872, 1100], [930, 1100], [900, 1030, 862, 960, 826, 896]], '#ffcc2a');
  fillSegs(ctx, [[1056, 890], [1040, 990, 1010, 1050, 990, 1100], [935, 1100], [968, 1040, 995, 970, 1022, 886]], '#db8210');
  inkLine(ctx, bez([330, 1100], [440, 940], [640, 880], [790, 900]), 10, OL);
  inkLine(ctx, bez([1500, 1100], [1380, 940], [1200, 870], [1058, 890]), 10, OL);
  // face
  const face = [[640, 270], [598, 400, 598, 500, 628, 606], [660, 710, 760, 800, 862, 866], [918, 902, 962, 906, 1006, 878], [1110, 812, 1196, 724, 1238, 622], [1272, 534, 1262, 440, 1236, 330], [1180, 150, 760, 120, 640, 270]];
  fillSegs(ctx, face, '#ffc89e');
  ctx.save(); pathOf(ctx, face); ctx.closePath(); ctx.clip();
  // cel shadows: under the fringe, along the near jaw, under the cheek
  fillSegs(ctx, [[560, 100], [1320, 100], [1300, 400], [1230, 356, 1190, 330, 1146, 420], [1130, 340, 1090, 330, 1060, 372], [1030, 348, 1000, 380, 978, 470], [948, 380, 914, 352, 880, 380], [840, 350, 800, 388, 770, 456], [750, 370, 710, 360, 690, 394], [650, 380, 620, 440, 596, 520]], '#e48a6a');
  fillSegs(ctx, [[590, 380], [640, 500, 640, 640, 724, 734], [790, 810, 880, 852, 960, 884], [900, 930], [560, 700]], '#e48a6a');
  fillSegs(ctx, [[1236, 520], [1220, 640, 1140, 760, 1024, 876], [1100, 880], [1300, 640]], '#f2a582');
  ctx.restore();
  pathOf(ctx, face.slice(0, 4)); ctx.strokeStyle = OL; ctx.lineWidth = 5; ctx.stroke();
  inkLine(ctx, bez([600, 440], [596, 560], [650, 700], [770, 800]), 13, OL, 0.1, 0.4);
  inkLine(ctx, bez([770, 800], [860, 880], [940, 916], [1008, 877]), 11, OL, 0.5, 0.5);
  inkLine(ctx, bez([1008, 877], [1140, 790], [1240, 660], [1255, 520]), 11, OL, 0.4, 0.05);
  // blush and nose
  for (let i = 0; i < 6; i++) inkLine(ctx, [[708 + i * 25, 652 - i * 2], [692 + i * 25, 686 - i * 2]], 6, '#ff7766', 0.1, 0.1);
  for (let i = 0; i < 4; i++) inkLine(ctx, [[1150 + i * 22, 628], [1138 + i * 22, 656]], 5, '#ff7766', 0.1, 0.1);
  fillSegs(ctx, [[1046, 578], [1062, 620, 1082, 646, 1090, 660], [1066, 668, 1050, 664, 1038, 658], [1052, 640, 1054, 612, 1046, 578]], '#e48a6a');
  inkLine(ctx, [[1052, 590], [1074, 636], [1090, 660], [1068, 666]], 6, '#7a2a38', 0.05, 0.4);
  // paint mark under the near eye
  fillSegs(ctx, [[826, 608], [856, 640], [830, 716], [802, 646]], '#12d6c6');
  pathOf(ctx, [[826, 608], [856, 640], [830, 716], [802, 646]]); ctx.closePath(); ctx.strokeStyle = '#064a56'; ctx.lineWidth = 4; ctx.stroke();
  // eyes
  const open = o.open;
  animeEye(ctx, { cx: 828, cy: 500, w: 232, h: 128, open, flip: -1, irisR: 57, look: -0.12, pupil: o.pupil });
  animeEye(ctx, { cx: 1148, cy: 492, w: 150, h: 118, open, flip: 1, irisR: 45, look: 0.02, pupil: o.pupil });
  const bd = o.brow;
  inkLine(ctx, bez([670, 392 - bd * 22], [752, 340 - bd * 4], [880, 372 + bd * 20], [960, 410 + bd * 34]), 28, OL, 0.15, 0.55);
  inkLine(ctx, bez([1252, 386 - bd * 20], [1192, 342], [1122, 368 + bd * 20], [1072, 408 + bd * 32]), 22, OL, 0.15, 0.55);
  // mouth: closed smirk, then the grin
  const gr = o.grin;
  if (gr < 0.2) {
    inkLine(ctx, bez([918, 746], [972, 766], [1040, 758], [1096, 718]), 11, OL, 0.2, 0.1);
  } else {
    const k = gr;
    const mouth = [[898, 738], [960, 740 + 4 * k, 1060, 736, 1128, 698 - 8 * k], [1106, 742 + 54 * k, 1048, 760 + 72 * k, 992, 758 + 70 * k], [950, 756 + 58 * k, 912, 750 + 24 * k, 898, 738]];
    fillSegs(ctx, mouth, '#5c0c26');
    ctx.save(); pathOf(ctx, mouth); ctx.closePath(); ctx.clip();
    fillSegs(ctx, [[880, 700], [1150, 690], [1124, 718], [1050, 752, 970, 762, 896, 748]], '#fff6ea');
    fillSegs(ctx, [[930, 786 + 40 * k], [980, 762 + 30 * k, 1050, 764 + 30 * k, 1096, 780 + 20 * k], [1060, 900], [940, 900]], '#ea5268');
    ctx.fillStyle = '#fff6ea'; ctx.beginPath(); ctx.moveTo(1060, 738); ctx.lineTo(1088, 730); ctx.lineTo(1070, 774); ctx.closePath(); ctx.fill();
    ctx.restore();
    pathOf(ctx, mouth); ctx.closePath(); ctx.strokeStyle = OL; ctx.lineWidth = 8; ctx.stroke();
    inkLine(ctx, [[870, 726], [902, 740]], 8, OL, 0.1, 0.8);
    inkLine(ctx, [[1124, 702], [1150, 678]], 8, OL, 0.8, 0.1);
  }
  inkLine(ctx, bez([972, 840], [1000, 852], [1030, 848], [1048, 834]), 6, '#a8525c', 0.1, 0.1);
  // fringe and side locks over the face
  hairLock(ctx, [860, 150], [690, 170, 620, 250], [560 + sw * 0.8, 478 + sw], [650, 360, 740, 300], [800, 270], HAIR, 7);
  hairLock(ctx, [960, 130], [850, 170, 790, 270], [764 + sw * 0.5, 452 + sw * 0.5], [850, 310, 920, 270], [1000, 220], HAIR, 7);
  hairLock(ctx, [1060, 130], [960, 200, 950, 300], [978 + sw * 0.6, 474 + sw * 0.7], [1020, 340, 1070, 290], [1130, 220], HAIR, 7);
  hairLock(ctx, [1150, 150], [1160, 240, 1170, 320], [1150 + sw * 0.5, 420 + sw * 0.6], [1220, 330, 1260, 270], [1240, 200], HAIR, 7);
  hairLock(ctx, [660, 240], [560, 330, 540, 500], [560 + sw2, 960 + sw], [610, 640, 630, 440], [740, 300], HAIR, 7);
  hairLock(ctx, [1210, 220], [1320, 330, 1330, 520], [1282 + sw, 840 + sw2 * 0.6], [1276, 560, 1262, 420], [1176, 260], HAIR, 7);
  // crown of the hair
  hairLock(ctx, [1250, 290], [1200, 80, 960, 20], [440 + sw2, 190 + sw], [720, 130, 800, 190], [880, 240], HAIR, 8);
  inkLine(ctx, bez([800, 128], [900, 96], [1040, 100], [1140, 160]), 15, 'rgba(255,238,205,0.95)', 0.05, 0.05);
}

function drawCloseupIro(ctx, lf, f) {
  const W = 1920, H = 1080, t = f / 24;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6e6e6e'); g.addColorStop(1, '#b9b9b9');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  washStrokes(ctx, 11, 26, ['#8a8a8a', '#a4a4a4', '#c6c6c6', '#5c5c5c'], 0, 1080, -0.12, [500, 1200], [40, 150], lf * 17);
  // her colour starts to lift off the paper as her eyes open
  const k = smooth(5, 12, lf);
  if (k > 0) {
    ctx.globalAlpha = k;
    washStrokes(ctx, 29, 15, ['#ff2e82', '#ff5424', '#ffc41c', '#12d8cc', '#7b3bff'], 40, 1060, -0.16, [500, 1300], [30, 90], lf * 52);
    ctx.globalAlpha = 1;
  }
  const open = lf < 6 ? 0.04 : (lf < 9 ? Ease.back(invlerp(6, 9, lf)) : lerp(1.0, 0.82, smooth(13, 18, lf)));
  const zoom = 1.04 + lf * 0.0042 + (lf >= 6 ? 0.045 * Math.exp(-(lf - 6) / 3) : 0);
  const shx = lf >= 6 && lf < 12 ? Math.cos((lf - 6) * 2.1) * 12 * Math.exp(-(lf - 6) / 2) : 0;
  ctx.setTransform(zoom, 0, 0, zoom, 930 - 930 * zoom + shx - lf * 1.1, 520 - 520 * zoom);
  ctx.translate(-90, 6);
  drawIroFace(ctx, Math.floor(f / 2) / 12, { open, grin: smooth(13, 17, lf), brow: smooth(7, 11, lf), pupil: lf < 10 ? 0.40 : 0.30 });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (lf >= 8) {
    const p = invlerp(8, 17, lf);
    drawText(ctx, 'IRO', 1620, 730, 190, { align: 'center', color: '#2b0a22', weight: 0.17, outline: '#fff4dc', outlineWidth: 28, progress: p, slant: 0.2 });
    const grd = ctx.createLinearGradient(1420, 0, 1820, 0);
    grd.addColorStop(0, '#ff2e82'); grd.addColorStop(0.5, '#ff5424'); grd.addColorStop(1, '#ffb000');
    drawText(ctx, 'IRO', 1620, 730, 190, { align: 'center', color: grd, weight: 0.095, progress: p, slant: 0.2 });
  }
}

// ------------------------------------------------------------------ SUMI (greys only)
function inkLock(ctx, a, c1, tip, c2, b, fill) {
  const segs = [a, [c1[0], c1[1], c1[2], c1[3], tip[0], tip[1]], [c2[0], c2[1], c2[2], c2[3], b[0], b[1]]];
  fillSegs(ctx, segs, fill || '#0b0b0b');
  ctx.save(); pathOf(ctx, segs); ctx.closePath(); ctx.clip();
  const p = bez(a, [c1[0], c1[1]], [c1[2], c1[3]], tip, 30), q = bez(b, [c2[2], c2[3]], [c2[0], c2[1]], tip, 30);
  for (const [t, w, s0, s1] of [[0.28, 6, 5, 22], [0.40, 3, 9, 25], [0.55, 2, 4, 14]]) {
    const m = p.map((v, i) => [lerp(v[0], q[i][0], t), lerp(v[1], q[i][1], t)]).slice(s0, s1);
    inkLine(ctx, m, w, '#d8d8d8', 0.05, 0.05);
  }
  ctx.restore();
  pathOf(ctx, segs); ctx.closePath(); ctx.strokeStyle = '#000000'; ctx.lineWidth = 5; ctx.stroke();
}
function sumiEye(ctx, cx, cy, w, h, open, flip, glow) {
  const X = u => cx + u * w / 2 * flip, Y = v => cy + v * h;
  const top = bez([X(-1.0), Y(0.18)], [X(-0.45), Y(-0.40 * open)], [X(0.35), Y(-0.62 * open - 0.04)], [X(1.05), Y(-0.52 * open - 0.10)], 28);
  const bot = bez([X(-1.0), Y(0.18)], [X(-0.40), Y(0.30 * open + 0.10)], [X(0.50), Y(0.20 * open + 0.02)], [X(1.05), Y(-0.52 * open - 0.10)], 28);
  if (glow > 0) {
    const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, w * 0.95);
    g.addColorStop(0, 'rgba(255,255,255,' + 0.85 * glow + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - w, cy - w, w * 2, w * 2);
  }
  // socket shadow
  fillSegs(ctx, [[X(-1.16), Y(0.10)], [X(-0.5), Y(-0.95), X(0.5), Y(-1.15), X(1.28), Y(-0.95)], [X(1.1), Y(0.20), X(0.2), Y(0.72), X(-1.16), Y(0.10)]], '#4b4b4b');
  if (open > 0.07) {
    ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1]);
    for (const p of top) ctx.lineTo(p[0], p[1]);
    for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
    ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill();
  }
  inkLine(ctx, top, h * 0.34, '#000000', 0.3, 0.45);
  inkLine(ctx, [[X(0.92), Y(-0.54 * open - 0.10)], [X(1.32), Y(-0.80 * open - 0.18)]], h * 0.18, '#000000', 0.9, 0.05);
  if (open > 0.07) inkLine(ctx, bot.slice(6, 26), h * 0.09, '#000000', 0.05, 0.4);
  inkLine(ctx, bez([X(-0.86), Y(0.60)], [X(-0.3), Y(0.84)], [X(0.35), Y(0.76)], [X(0.9), Y(0.34)]), h * 0.06, '#3c3c3c', 0.05, 0.05);
}
function drawSumiFace(ctx, t, o) {
  const sw = Math.sin(t * 3.6) * 7;
  const OL = '#000000';
  // the brush behind and above
  inkLock(ctx, [1180, 150], [1330, -80, 1620, -150], [2060 + sw, 120], [1650, 30, 1430, 90], [1290, 260]);
  inkLock(ctx, [1230, 220], [1420, 120, 1700, 160], [1960 + sw * 1.6, 520], [1660, 300, 1480, 280], [1300, 340]);
  // thick neck
  fillSegs(ctx, [[800, 760], [800, 880, 790, 970, 760, 1100], [1320, 1100], [1280, 940, 1280, 840, 1300, 700]], '#6c6c6c');
  fillSegs(ctx, [[1190, 760], [1200, 900, 1220, 1000, 1250, 1100], [1320, 1100], [1280, 940, 1280, 840, 1300, 700]], '#454545');
  const face = [[668, 280], [640, 400, 636, 500, 652, 592], [668, 700, 700, 790, 762, 856], [830, 914, 920, 924, 990, 894], [1100, 842, 1230, 730, 1290, 600], [1340, 480, 1340, 340, 1290, 240], [1160, 80, 780, 90, 668, 280]];
  fillSegs(ctx, face, '#b4b4b4');
  ctx.save(); pathOf(ctx, face); ctx.closePath(); ctx.clip();
  fillSegs(ctx, [[560, 80], [1380, 80], [1360, 380], [1200, 330, 1090, 380, 1010, 468], [962, 420, 880, 380, 800, 400], [720, 360, 660, 420, 620, 470]], '#6f6f6f');
  fillSegs(ctx, [[1360, 240], [1252, 420, 1270, 560, 1200, 660], [1130, 760, 1040, 830, 930, 925], [1400, 900]], '#787878');
  fillSegs(ctx, [[640, 560], [690, 660, 720, 760, 800, 850], [700, 900], [600, 700]], '#8c8c8c');
  fillSegs(ctx, [[902, 470], [892, 560, 866, 612, 842, 652], [884, 668, 920, 662, 946, 642], [920, 600, 918, 540, 928, 470]], '#7a7a7a');
  ctx.restore();
  inkLine(ctx, bez([668, 290], [620, 480], [640, 690], [764, 857]), 15, OL, 0.1, 0.5);
  inkLine(ctx, bez([764, 857], [840, 922], [920, 926], [992, 893]), 13, OL, 0.5, 0.5);
  inkLine(ctx, bez([992, 893], [1130, 826], [1270, 660], [1306, 540]), 13, OL, 0.5, 0.1);
  // ear
  fillSegs(ctx, [[1290, 470], [1356, 430, 1390, 500, 1362, 580], [1344, 640, 1296, 660, 1280, 640]], '#8c8c8c');
  inkLine(ctx, bez([1290, 470], [1368, 420], [1406, 560], [1282, 642]), 9, OL);
  inkLine(ctx, bez([1320, 510], [1360, 500], [1354, 570], [1306, 596]), 6, OL);
  // eyes (white, no pupils)
  sumiEye(ctx, 792, 506, 170, 92, o.open, 1, o.glow * 0.7);
  // the ink stripe through his left eye
  const stripe = [[1058, 110], [1096, 250, 1180, 340, 1180, 450], [1186, 560, 1150, 660, 1186, 720], [1120, 700, 1100, 640, 1094, 600], [1080, 720, 1060, 800, 1030, 872], [1040, 740, 1032, 640, 1034, 560], [1010, 470, 986, 330, 960, 120]];
  fillSegs(ctx, stripe, '#090909');
  inkLine(ctx, bez([1130, 200], [1190, 320], [1215, 440], [1196, 540]), 8, '#090909', 0.2, 0.05);
  sumiEye(ctx, 1104, 496, 250, 108, o.open, 1, o.glow);
  // brows
  inkLine(ctx, bez([650, 402], [740, 372], [850, 420], [936, 478]), 40, OL, 0.15, 0.7);
  inkLine(ctx, bez([1300, 366], [1192, 372], [1070, 420], [984, 478]), 48, OL, 0.15, 0.7);
  inkLine(ctx, [[948, 440], [966, 396]], 8, '#2a2a2a', 0.6, 0.05);
  inkLine(ctx, [[975, 446], [1000, 404]], 7, '#2a2a2a', 0.6, 0.05);
  // nose and mouth
  inkLine(ctx, [[912, 496], [878, 610], [842, 652], [884, 668], [920, 658]], 9, OL, 0.05, 0.4);
  inkLine(ctx, bez([858, 760], [910, 736], [1010, 738], [1076, 766]), 13, OL, 0.1, 0.15);
  inkLine(ctx, bez([930, 800], [960, 810], [996, 810], [1022, 798]), 7, '#555555', 0.1, 0.1);
  // ink running from the stripe
  const r = mulberry32(77);
  for (let i = 0; i < 7; i++) {
    const x = 1036 + r() * 130, y0 = 640 + r() * 150, len = 40 + r() * 120 + o.drip * (30 + r() * 150);
    inkLine(ctx, [[x, y0], [x + 2, y0 + len * 0.5], [x, y0 + len]], 7 + r() * 6, '#070707', 1, 0.5);
    ctx.fillStyle = '#070707'; ctx.beginPath(); ctx.ellipse(x, y0 + len, 7 + r() * 4, 10 + r() * 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8e8e8'; ctx.beginPath(); ctx.ellipse(x - 3, y0 + len - 3, 2.5, 3.5, 0, 0, TAU); ctx.fill();
  }
  // standing collar
  fillSegs(ctx, [[520, 1100], [600, 920, 690, 840, 760, 826], [840, 960, 940, 1030, 1050, 1040], [1180, 960, 1280, 800, 1336, 730], [1460, 800, 1560, 940, 1620, 1100]], '#141414');
  fillSegs(ctx, [[1050, 1040], [1180, 960, 1280, 800, 1336, 730], [1346, 780], [1290, 870, 1200, 1010, 1070, 1074]], '#ececec');
  fillSegs(ctx, [[760, 826], [840, 960, 940, 1030, 1050, 1040], [1040, 1074], [920, 1060, 814, 980, 742, 856]], '#cfcfcf');
  inkLine(ctx, bez([520, 1100], [600, 920], [690, 840], [760, 826]), 12, OL);
  inkLine(ctx, bez([760, 826], [850, 980], [960, 1044], [1050, 1040]), 12, OL);
  inkLine(ctx, bez([1050, 1040], [1180, 960], [1280, 800], [1336, 730]), 12, OL);
  inkLine(ctx, bez([1336, 730], [1470, 800], [1570, 950], [1620, 1100]), 12, OL);
  // hair cap, fringe, binding cord
  fillSegs(ctx, [[660, 300], [700, 100, 880, 40, 1060, 50], [1260, 60, 1370, 200, 1350, 420], [1300, 330, 1240, 250, 1150, 230], [1020, 190, 820, 190, 660, 300]], '#0b0b0b');
  inkLine(ctx, bez([780, 150], [900, 90], [1100, 90], [1230, 170]), 10, '#d8d8d8', 0.05, 0.05);
  inkLock(ctx, [900, 140], [760, 190, 690, 280], [648 + sw, 520 + sw * 0.5], [750, 330, 830, 270], [920, 240]);
  inkLock(ctx, [1010, 120], [900, 190, 870, 270], [866 + sw * 0.6, 432], [950, 300, 1010, 260], [1080, 210]);
  inkLock(ctx, [820, 150], [690, 180, 640, 240], [588 + sw, 360], [700, 260, 760, 240], [840, 220]);
  inkLock(ctx, [1240, 220], [1370, 330, 1390, 470], [1344 + sw * 0.7, 700], [1330, 490, 1300, 380], [1210, 300]);
  fillSegs(ctx, [[1130, 90], [1180, 40, 1290, 70, 1310, 150], [1250, 190, 1170, 160, 1130, 90]], '#dcdcdc');
  for (let i = 0; i < 4; i++) inkLine(ctx, bez([1148 + i * 36, 70 + i * 14], [1170 + i * 34, 100 + i * 14], [1170 + i * 32, 130 + i * 12], [1156 + i * 30, 150 + i * 10]), 7, '#5a5a5a');
}
function drawCloseupSumi(ctx, lf, f) {
  const W = 1920, H = 1080;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1c1c1c'); g.addColorStop(1, '#4a4a4a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  washStrokes(ctx, 41, 22, ['#0a0a0a', '#262626', '#5c5c5c', '#101010'], 0, 1080, 0.10, [600, 1400], [60, 200], -lf * 9);
  washStrokes(ctx, 57, 5, ['#bdbdbd', '#e6e6e6'], 80, 1000, 0.13, [500, 1100], [18, 50], -lf * 21);
  const open = lf < 9 ? 0.03 : (lf < 12 ? Ease.back(invlerp(9, 12, lf)) : 1.0);
  const glow = lf >= 9 ? Math.exp(-(lf - 9) / 4.5) : 0;
  const zoom = 1.05 + lf * 0.004 + (lf >= 9 ? 0.05 * Math.exp(-(lf - 9) / 3) : 0);
  const shx = lf >= 9 && lf < 15 ? Math.cos((lf - 9) * 2.1) * -15 * Math.exp(-(lf - 9) / 2) : 0;
  ctx.setTransform(zoom, 0, 0, zoom, 970 - 970 * zoom + shx + lf * 1.1, 520 - 520 * zoom);
  drawSumiFace(ctx, Math.floor(f / 2) / 12, { open, glow: glow * 0.8, drip: lf / 24 });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (lf >= 8) drawText(ctx, 'SUMI', 360, 760, 160, { align: 'center', color: '#050505', weight: 0.15, outline: '#f2f2f2', outlineWidth: 24, progress: invlerp(8, 19, lf), slant: 0.2 });
}
// one eye, filling the frame, snapping open
function drawEyeSnap(ctx, lf, f) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#101010'; ctx.fillRect(0, 0, 1920, 1080);
  const open = lf < 1 ? 0.03 : (lf < 2 ? 0.7 : 1.08);
  const k = 3.5 + lf * 0.12;
  ctx.setTransform(k, 0, 0, k, 960 - 1100 * k + (lf === 2 ? 26 : 0), 540 - 490 * k);
  drawSumiFace(ctx, Math.floor(f / 2) / 12, { open, glow: lf >= 1 ? 0.45 * Math.exp(-(lf - 1) / 2.5) : 0, drip: 0.4 });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
// the two pairs of eyes, stacked
function drawEyeStrips(ctx, lf, f) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, 1920, 1080);
  const clip = pts => { ctx.save(); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.clip(); };
  const slide = (1 - Ease.snap(invlerp(0, 4, lf))) * 520;
  // his, above, entering from the right
  clip([[0, 70], [1920, 30], [1920, 500], [0, 560]]);
  ctx.fillStyle = '#242424'; ctx.fillRect(0, 0, 1920, 600);
  let k = 2.15 + lf * 0.02;
  ctx.setTransform(k, 0, 0, k, 1060 - 960 * k + slide, 290 - 500 * k);
  drawSumiFace(ctx, f / 24, { open: 1.0, glow: 0.12, drip: 0.5 });
  ctx.restore(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  // hers, below, entering from the left
  clip([[0, 592], [1920, 532], [1920, 1010], [0, 1050]]);
  ctx.fillStyle = '#8f8f8f'; ctx.fillRect(0, 500, 1920, 600);
  washStrokes(ctx, 91, 10, ['#ff2e82', '#ff5424', '#ffc41c', '#12d8cc'], 540, 1050, -0.1, [500, 1200], [24, 70], lf * 60);
  k = 2.0 + lf * 0.02;
  ctx.setTransform(k, 0, 0, k, 880 - 975 * k - slide, 790 - 500 * k);
  drawIroFace(ctx, f / 24, { open: 1.0, grin: 0, brow: 1, pupil: 0.26 });
  ctx.restore(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  inkLine(ctx, [[-20, 576], [1940, 516]], 15, '#f6f6f6', 0.9, 0.9);
}

// the closing title, written stroke by stroke
function drawTitle(ctx, f) {
  const p = invlerp(1170, 1192, f);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, 1920, 1080);
  if (p <= 0) return false;
  const size = 70, y = 976, gap = 46;
  const w1 = textWidth('IRO', size), wx = textWidth('×', size), w2 = textWidth('SUMI', size);
  const total = w1 + wx + w2 + gap * 2, x0 = 960 - total / 2;
  const grd = ctx.createLinearGradient(x0, 0, x0 + w1, 0);
  grd.addColorStop(0, '#ff2e82'); grd.addColorStop(0.5, '#ff5a24'); grd.addColorStop(1, '#ffc01c');
  const o = { weight: 0.15, outlineWidth: 15, slant: 0.16 };
  drawText(ctx, 'IRO', x0, y, size, Object.assign({ color: grd, outline: '#fff8ea', progress: clamp(p * 2.2) }, o));
  drawText(ctx, '×', x0 + w1 + gap, y, size, Object.assign({ color: '#0a0a0a', outline: '#f6f6f6', progress: clamp(p * 2.6 - 0.9) }, o));
  drawText(ctx, 'SUMI', x0 + w1 + wx + gap * 2, y, size, Object.assign({ color: '#0a0a0a', outline: '#f6f6f6', progress: clamp(p * 1.9 - 0.9) }, o));
  return true;
}

// which frames are 2D drawings: [from, to, draw, forceMonochrome]
const CLOSEUPS = [
  [120, 144, drawCloseupIro, 0],
  [144, 168, drawCloseupSumi, 1],
  [590, 594, drawEyeSnap, 1],
  [952, 960, drawEyeStrips, 0],
];
