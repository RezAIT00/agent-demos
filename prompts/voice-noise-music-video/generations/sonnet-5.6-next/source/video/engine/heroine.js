// KOE, the heroine. Original design, drawn entirely from curves.
'use strict';
const KOE = {
  line: '#2a0a35', skin: '#ffe4d4', skinShade: '#f3a9a0', skinHi: '#fff4ec',
  hair: '#ff4f9c', hairShade: '#c0267f', hairDeep: '#6a1468', hairHi: '#ffd0e6', tip: '#52ecff',
  jacket: '#f7f5ff', jacketShade: '#aea6e4', dark: '#2a2558', darkShade: '#161238',
  scarf: '#ff7a2b', scarfShade: '#cc3320', phone: '#f4f2ff', phoneShade: '#a9a3d8',
};

function headDefaults(o) {
  return Object.assign({
    x: 960, y: 540, s: 1, tilt: 0, turn: 0, eyeL: 1, eyeR: 1, happy: false, mouth: 'smile', open: 0.5,
    brow: 0, t: 0, wind: 0.15, lift: 0, look: [0, 0], phones: true, glow: 0.4, blush: 0.7, length: 1,
  }, o);
}
function headSpace(ctx, o, fn) {
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.tilt); ctx.scale(o.s, o.s); fn(); ctx.restore();
}

// A lock of hair with outline, base colour, one hard cel shadow and cyan tip.
function lock(ctx, spine, w, base, shade, tip = 0, lw = 5) {
  const width = u => w * Math.pow(Math.sin(Math.PI * (0.18 + 0.82 * u)), 0.8) * (1 - u * 0.25) * (u > 0.97 ? 0.15 : 1);
  ribbon(ctx, spine, width);
  paint(ctx, base, KOE.line, lw);
  ctx.save(); ribbon(ctx, spine, width); ctx.clip();
  ribbon(ctx, spine.map((p, i) => [p[0] + w * 0.55 * Math.min(1, i / 5), p[1] + w * 0.12]), u => width(u) * 0.62);
  paint(ctx, shade);
  if (tip) {
    const a = spine[Math.floor(spine.length * (1 - tip))], b = spine[spine.length - 1];
    ctx.fillStyle = lin(ctx, a[0], a[1], b[0], b[1], [[0, KOE.tip + '00'], [0.55, KOE.tip + 'cc'], [1, KOE.tip]]);
    ctx.fillRect(Math.min(a[0], b[0]) - 90, Math.min(a[1], b[1]) - 90, Math.abs(a[0] - b[0]) + 180, Math.abs(a[1] - b[1]) + 180);
  }
  ctx.restore();
}

function backHair(ctx, opts) {
  const o = headDefaults(opts);
  headSpace(ctx, o, () => {
    const n = 11;
    // far layer first so nearer strands overlap it
    for (const layer of [0, 1]) {
      for (let i = layer; i < n; i += 2) {
        const k = i / (n - 1) * 2 - 1; // -1 .. 1 across the back of the head
        const rootX = k * 138, rootY = -60 - (1 - Math.abs(k)) * 70;
        let ang = Math.PI / 2 - k * 0.42 - o.wind * (1.05 + 0.12 * Math.sin(i * 2.1));
        ang -= o.lift * (k < 0 ? -1.6 : 1.6) * Math.abs(k + 0.001);
        const len = (430 + 110 * hash(i + 3) + Math.abs(o.wind) * 120) * o.length;
        const spine = flow(rootX, rootY, ang, len, o.t, {
          amp: 20 + 42 * Math.abs(o.wind), freq: 1.5 + hash(i) * 0.7, speed: 4.5 + 3 * Math.abs(o.wind),
          phase: i * 1.3, droop: (k < 0 ? 0.5 : -0.5) * (1 - Math.abs(o.wind)) + o.wind * 0.35, n: 22,
        });
        lock(ctx, spine, 62 + 20 * hash(i + 9), layer ? KOE.hairShade : KOE.hairDeep,
          layer ? KOE.hairDeep : '#48104f', layer ? 0.34 : 0.22, 5);
      }
    }
    // skull volume
    spline(ctx, [[0, -226], [112, -204], [172, -118], [176, -6], [132, 78], [0, 96], [-132, 78], [-176, -6], [-172, -118], [-112, -204]]);
    paint(ctx, KOE.hairShade, KOE.line, 5);
  });
}

function facePath(ctx) {
  spline(ctx, [[-139, -92], [-141, -8], [-130, 56], [-105, 100], [-62, 137], [-22, 164], [0, 172, 1],
    [22, 164], [62, 137], [105, 100], [130, 56], [141, -8], [139, -92], [76, -170], [0, -188], [-76, -170]]);
}

const BANG_TIPS = [ // [tipX, tipY, notchX, notchY] right to left
  [152, 90, 128, -44], [112, -6, 90, -88], [70, -28, 46, -112], [30, -2, 6, -108],
  [-6, 22, -26, -116], [-54, -22, -68, -106], [-100, -4, -118, -78], [-148, 76, -162, -24]];

function bangsPath(ctx, o) {
  const dx = o.turn * 10, sway = i => Math.sin(o.t * 3.1 + i * 1.7) * 3 + o.wind * 16;
  ctx.beginPath();
  ctx.moveTo(-168, -20);
  ctx.bezierCurveTo(-186, -170, -92, -232, 0, -232);
  ctx.bezierCurveTo(92, -232, 186, -170, 168, -20);
  let px = 168, py = -20;
  BANG_TIPS.forEach(([tx, ty, nx, ny], i) => {
    const X = tx + dx + sway(i), Y = ty;
    ctx.bezierCurveTo(px + 8, py + (Y - py) * 0.35, X + 20, Y - 46, X, Y);
    ctx.bezierCurveTo(X - 4, Y - 38, nx + dx + 22, ny + 20, nx + dx, ny);
    px = nx + dx; py = ny;
  });
  ctx.bezierCurveTo(-168, -52, -170, -38, -168, -20);
  ctx.closePath();
}

function eye(ctx, o, side, open) {
  const cx = side * 66 + o.turn * 22, cy = 30;
  const squash = 1 - Math.max(0, side * o.turn) * 0.1;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(side * squash, 1);
  if (o.happy || open < 0.07) { // closed: ^ ^ when happy, soft lid otherwise
    const up = o.happy ? -1 : 1;
    spline(ctx, [[-40, 8 - up * 4, 1], [-16, 8 + up * 15], [10, 8 + up * 17], [34, 8 + up * 6], [56, 6 - up * 2, 1],
      [34, 8 + up * 14], [8, 8 + up * 27], [-18, 8 + up * 23]]);
    paint(ctx, KOE.line, KOE.line, 3);
    for (const [a, b] of [[30, 17], [14, 23]]) {
      ctx.beginPath(); ctx.moveTo(a, 8 + up * b * 0.75); ctx.quadraticCurveTo(a + 9, 8 + up * (b + 8), a + 19, 8 + up * (b + 9));
      paint(ctx, null, KOE.line, 3.5);
    }
    ctx.restore(); return;
  }
  const k = clamp(open, 0, 1.12);
  const P = (a, b) => mix2(a, b, k);
  const inner = P([-40, 18], [-41, 2]), u1 = P([-18, 27], [-24, -36]), u2 = P([14, 28], [20, -43]),
    outer = P([46, 14], [49, -15]), l1 = [42, 18 + 3 * k], l2 = [18, 22 + 19 * k], l3 = [-20, 21 + 19 * k];
  const sclera = () => {
    ctx.beginPath(); ctx.moveTo(...inner);
    ctx.bezierCurveTo(...u1, ...u2, ...outer);
    ctx.bezierCurveTo(...l1, ...l2, 2, 23 + 17 * k);
    ctx.bezierCurveTo(...l3, -36, 16 + 12 * k, ...inner);
    ctx.closePath();
  };
  sclera(); paint(ctx, '#fffdfc');
  ctx.save(); sclera(); ctx.clip();
  ctx.fillStyle = lin(ctx, 0, -36, 0, 8, ['#9d98cf', '#9d98cf00']); ctx.fillRect(-60, -50, 130, 70);
  // iris and catch-lights are not mirrored: both eyes share one light source
  ctx.scale(side, 1);
  const ix = -side * 2 + o.look[0] * 14, iy = 3 + o.look[1] * 12, R = 1 + (o.irisPulse || 0) * 0.08;
  ctx.translate(ix, iy); ctx.scale(R, R);
  ellipse(ctx, 0, 0, 31, 40);
  paint(ctx, lin(ctx, 0, -40, 0, 40, [[0, '#17104f'], [0.34, '#2c3fb8'], [0.66, '#1f9ee8'], [1, '#7dffd9']]), '#120a3a', 4.5);
  ctx.save(); ellipse(ctx, 0, 0, 29, 38); ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 22; i++) { // iris fibres
    const a = i / 22 * TAU + 0.1;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * 13, 3 + Math.sin(a) * 19); ctx.lineTo(Math.cos(a) * 30, 3 + Math.sin(a) * 40);
    paint(ctx, null, a > 0.2 && a < 2.95 ? '#6ffff055' : '#5a6cff33', 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  ellipse(ctx, 0, 1, 12.5, 18); paint(ctx, '#0b0630');
  ellipse(ctx, 0, -33, 40, 20); paint(ctx, '#0d0838aa');
  ctx.beginPath(); ctx.ellipse(0, 6, 22, 28, 0, 0.35, Math.PI - 0.35); paint(ctx, null, '#c9fff0cc', 5);
  ctx.restore();
  if (o.irisMark) o.irisMark(ctx, side);
  ellipse(ctx, -12, -15, 11, 13.5, -0.5); paint(ctx, '#ffffff');
  circle(ctx, 12, 17, 5.5); paint(ctx, '#ffffff');
  circle(ctx, 17, -3, 2.6); paint(ctx, '#ffffffdd');
  ctx.restore();
  // upper lash: heavy wedge with a flick at the outer corner
  ctx.beginPath(); ctx.moveTo(inner[0] - 3, inner[1] + 2);
  ctx.bezierCurveTo(u1[0] - 3, u1[1] - 5, u2[0] + 2, u2[1] - 9, outer[0] + 5, outer[1] - 7);
  ctx.lineTo(outer[0] + 19, outer[1] - 12); ctx.lineTo(outer[0] + 8, outer[1] + 1);
  ctx.lineTo(outer[0] + 15, outer[1] + 5); ctx.lineTo(outer[0] - 2, outer[1] + 6);
  ctx.bezierCurveTo(u2[0], u2[1] + 8, u1[0] + 2, u1[1] + 7, inner[0] + 2, inner[1] + 3);
  ctx.closePath(); paint(ctx, KOE.line, KOE.line, 2);
  ctx.beginPath(); ctx.moveTo(40, 24 + 6 * k); ctx.quadraticCurveTo(24, 24 + 18 * k, 4, 24 + 17.5 * k);
  paint(ctx, null, KOE.line, 3);
  ctx.beginPath(); ctx.moveTo(-22, u1[1] - 13); ctx.bezierCurveTo(-4, u1[1] - 22, 22, u2[1] - 18, 40, outer[1] - 20);
  paint(ctx, null, '#a0476d99', 3);
  ctx.restore();
}

function mouth(ctx, o) {
  const x = o.turn * 24, y = 119;
  ctx.save(); ctx.translate(x, y);
  const k = clamp(o.open);
  const inside = path => {
    path(); paint(ctx, '#8c1c43');
    ctx.save(); path(); ctx.clip();
    ctx.fillStyle = '#fffaf7'; ctx.beginPath(); ctx.ellipse(0, -9, 46, 13, 0, 0, TAU); ctx.fill();
    ellipse(ctx, 3, 13 + 30 * k, 22, 15 + 6 * k); paint(ctx, '#ff7d8c');
    ctx.restore();
    path(); paint(ctx, null, KOE.line, 4.2);
  };
  if (o.mouth === 'open' && k > 0.06) {
    const w = 19 + 10 * k, h = 7 + 38 * k;
    inside(() => {
      ctx.beginPath(); ctx.moveTo(-w, -3);
      ctx.quadraticCurveTo(0, 3, w, -3);
      ctx.bezierCurveTo(w * 0.92, h * 0.72, w * 0.45, h, 0, h);
      ctx.bezierCurveTo(-w * 0.45, h, -w * 0.92, h * 0.72, -w, -3); ctx.closePath();
    });
  } else if (o.mouth === 'grin') {
    inside(() => {
      ctx.beginPath(); ctx.moveTo(-38, -8); ctx.quadraticCurveTo(0, 2, 38, -8);
      ctx.bezierCurveTo(28, 24, 14, 31, 0, 31); ctx.bezierCurveTo(-14, 31, -28, 24, -38, -8); ctx.closePath();
    });
  } else if (o.mouth === 'o') {
    ellipse(ctx, 0, 8, 9 + 8 * k, 10 + 17 * k); paint(ctx, '#8c1c43', KOE.line, 4.2);
    ellipse(ctx, 0, 12 + 12 * k, 6 + 5 * k, 4 + 5 * k); paint(ctx, '#ff7d8c');
  } else if (o.mouth === 'cat') {
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.quadraticCurveTo(-11, 15, 0, 1); ctx.quadraticCurveTo(11, 15, 22, 0);
    paint(ctx, null, KOE.line, 4.5);
  } else if (o.mouth === 'determined') {
    ctx.beginPath(); ctx.moveTo(-19, 7); ctx.quadraticCurveTo(-2, 0, 20, 3); paint(ctx, null, KOE.line, 4.8);
  } else if (o.mouth === 'flat') {
    ctx.beginPath(); ctx.moveTo(-11, 5); ctx.quadraticCurveTo(0, 7, 11, 4); paint(ctx, null, KOE.line, 4.2);
  } else {
    ctx.beginPath(); ctx.moveTo(-24, -1); ctx.quadraticCurveTo(0, 17, 24, -1); paint(ctx, null, KOE.line, 4.6);
    ctx.beginPath(); ctx.moveTo(-10, 17); ctx.quadraticCurveTo(0, 20, 10, 17); paint(ctx, null, '#d5707a', 2.4);
  }
  ctx.restore();
}

function brows(ctx, o) {
  for (const s of [-1, 1]) {
    const d = o.brow;
    const ix = s * 30 + o.turn * 22, iy = -40 + d * 17, ox = s * 105 + o.turn * 18, oy = -43 - d * 9;
    ctx.beginPath(); ctx.moveTo(ix, iy);
    ctx.quadraticCurveTo((ix + ox) / 2, (iy + oy) / 2 - 13, ox, oy);
    ctx.quadraticCurveTo((ix + ox) / 2, (iy + oy) / 2 - 7, ix, iy + 6);
    ctx.closePath(); paint(ctx, '#6d1250', '#6d1250', 2);
  }
}

function face(ctx, opts) {
  const o = headDefaults(opts);
  headSpace(ctx, o, () => {
    facePath(ctx); paint(ctx, KOE.skin, KOE.line, 4.6);
    ctx.save(); facePath(ctx); ctx.clip();
    ctx.save(); ctx.translate(5, 24); bangsPath(ctx, o); paint(ctx, KOE.skinShade); ctx.restore();
    // shaded side of the face, a single hard-edged shape
    spline(ctx, [[150, -90], [118, 20], [114, 62], [86, 110], [40, 156], [10, 175], [160, 180]]);
    paint(ctx, '#f3a9a077');
    if (o.blush > 0) {
      for (const s of [-1, 1]) {
        const bx = s * 88 + o.turn * 18;
        ctx.save(); ctx.globalAlpha = o.blush;
        ctx.translate(bx, 84); ctx.scale(1, 0.46);
        ctx.fillStyle = rad(ctx, 0, 0, 0, 42, ['#ff6f8fbb', '#ff6f8f00']); circle(ctx, 0, 0, 42); ctx.fill(); ctx.restore();
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath(); ctx.moveTo(bx + i * 13 + 5, 77); ctx.lineTo(bx + i * 13 - 5, 92);
          paint(ctx, null, `rgba(225,70,110,${0.55 * o.blush})`, 2.6);
        }
      }
    }
    ctx.restore();
    eye(ctx, o, -1, o.eyeL); eye(ctx, o, 1, o.eyeR);
    // nose: a short shadow and a tiny highlight
    const nx = o.turn * 30;
    ctx.beginPath(); ctx.moveTo(nx + 6, 79); ctx.lineTo(nx + 1, 87); ctx.lineTo(nx + 9, 86); ctx.closePath(); paint(ctx, '#d9707a');
    circle(ctx, nx - 3, 79, 2.4); paint(ctx, '#ffffffcc');
    mouth(ctx, o);
  });
}

function headphones(ctx, o) {
  const pulse = o.glow;
  const band = () => { ctx.beginPath(); ctx.moveTo(-188, 4); ctx.bezierCurveTo(-214, -312, 214, -312, 188, 4); };
  band(); paint(ctx, null, KOE.line, 32); band(); paint(ctx, null, KOE.phone, 22);
  band(); paint(ctx, null, KOE.dark, 6);
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * (188 - s * o.turn * 14), 50); ctx.rotate(s * -0.09);
    const w = 1 - s * o.turn * 0.18; ctx.scale(w * 0.8, 0.82);
    ellipse(ctx, -s * 17, 0, 24, 62); paint(ctx, KOE.darkShade, KOE.line, 5);
    ellipse(ctx, s * 5, 0, 38, 66); paint(ctx, KOE.phone, KOE.line, 5);
    ctx.save(); ellipse(ctx, s * 5, 0, 36, 64); ctx.clip();
    ellipse(ctx, s * 5 + 17, 14, 36, 64); paint(ctx, KOE.phoneShade); ctx.restore();
    ellipse(ctx, s * 9, 0, 24, 45); paint(ctx, KOE.dark, KOE.line, 3);
    ellipse(ctx, s * 9, 0, 18, 36); paint(ctx, null, KOE.tip, 5.5);
    for (let i = -2; i <= 2; i++) { // equaliser logo
      const h = 6 + 15 * Math.abs(Math.sin(o.t * 9 + i * 1.3 + s)) * (0.3 + pulse);
      ctx.beginPath(); ctx.moveTo(s * 9 + i * 5.4, -h); ctx.lineTo(s * 9 + i * 5.4, h); paint(ctx, null, '#ffffff', 3);
    }
    ctx.restore();
    glow(ctx, s * 196, 50, 70 + 90 * pulse, '#3fe6ff', 0.25 + 0.6 * pulse);
  }
}

function frontHair(ctx, opts) {
  const o = headDefaults(opts);
  headSpace(ctx, o, () => {
    // long side locks framing the face
    for (const s of [-1, 1]) {
      const bend = o.wind * s < 0 ? 0.22 : 0.85; // the upwind lock must not cross the face
      const spine = flow(s * 146, -62, Math.PI / 2 - s * 0.1 - o.wind * bend - s * o.lift * 1.1, (360 + s * 14) * Math.min(1, o.length + 0.1), o.t,
        { amp: 16 + 30 * Math.abs(o.wind), freq: 1.4, speed: 5.5, phase: s * 2, droop: s * 0.16, n: 20 });
      lock(ctx, spine, 33, KOE.hair, KOE.hairShade, 0.42, 4.6);
      const thin = flow(s * 136, -30, Math.PI / 2 - s * 0.1 - o.wind * bend, 205, o.t, { amp: 14 + 24 * Math.abs(o.wind), speed: 6.4, phase: s, droop: -s * 0.2 });
      lock(ctx, thin, 15, KOE.hair, KOE.hairShade, 0.3, 3.6);
    }
    bangsPath(ctx, o); paint(ctx, KOE.hair, null);
    ctx.save(); bangsPath(ctx, o); ctx.clip();
    // shadow wedges between locks
    BANG_TIPS.forEach(([tx, ty, nx, ny], i) => {
      const dx = o.turn * 10 + Math.sin(o.t * 3.1 + i * 1.7) * 3 + o.wind * 16;
      ctx.beginPath(); ctx.moveTo(nx + o.turn * 10, ny - 28);
      ctx.quadraticCurveTo(nx + 34 + dx, ny + 16, tx + dx, ty + 3);
      ctx.quadraticCurveTo(nx + 12 + dx, ny + 8, nx + o.turn * 10 - 6, ny + 4); ctx.closePath(); paint(ctx, KOE.hairShade);
    });
    spline(ctx, [[130, -230], [150, -120], [178, -40], [200, -230]]); paint(ctx, KOE.hairShade);
    // the glossy "angel ring"
    const ring = [];
    for (let i = 0; i <= 18; i++) { const u = i / 18, x = lerp(-150, 142, u); ring.push([x, -158 + Math.pow((x + 4) / 150, 2) * 66 - (i % 2 ? 9 : -1), 1]); }
    for (let i = 18; i >= 0; i--) {
      const u = i / 18, x = lerp(-150, 142, u), thick = 8 + 26 * Math.sin(Math.PI * u) * (i % 2 ? 1 : 0.34);
      ring.push([x + 6, -158 + Math.pow((x + 4) / 150, 2) * 66 + thick, 1]);
    }
    poly(ctx, ring.map(p => [p[0], p[1]])); paint(ctx, KOE.hairHi + 'e6');
    ctx.restore();
    bangsPath(ctx, o); paint(ctx, null, KOE.line, 5);
    for (const [x0, y0, cx, cy, x1, y1] of [[-18, -210, -76, -150, -82, -80], [22, -212, 70, -158, 62, -86], [0, -214, -8, -170, -24, -118]]) {
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); paint(ctx, null, '#7a1560', 2.8);
    }
    ctx.save(); ctx.globalAlpha = 0.55; brows(ctx, o); ctx.restore();
    const ahoge = flow(4, -226, -1.85 - o.wind * 0.3 + Math.sin(o.t * 4) * 0.08, 112, o.t, { amp: 5, speed: 8, droop: 3.0 });
    ribbon(ctx, ahoge, u => 13 * (1 - u) + 0.6); paint(ctx, KOE.hair, KOE.line, 4);
    if (o.phones) headphones(ctx, o);
  });
}

// Neck, shoulders, jacket and scarf, for portrait shots.
function bust(ctx, opts) {
  const o = headDefaults(opts);
  headSpace(ctx, Object.assign({}, o, { tilt: o.tilt * 0.4 }), () => {
    spline(ctx, [[-44, 112], [-40, 196], [-74, 232], [0, 262], [74, 232], [40, 196], [44, 112]]);
    paint(ctx, KOE.skin, KOE.line, 4.6);
    ctx.save(); ctx.clip(); ellipse(ctx, 10, 148, 90, 46); paint(ctx, KOE.skinShade); ctx.restore();
    spline(ctx, [[-72, 214], [-168, 244], [-286, 300], [-334, 420], [-360, 760, 1], [360, 760, 1], [334, 420], [286, 300], [168, 244], [72, 214], [0, 232]]);
    paint(ctx, KOE.jacket, KOE.line, 6);
    ctx.save(); ctx.clip();
    spline(ctx, [[150, 240], [196, 330], [160, 520], [190, 770], [420, 770], [420, 240]]); paint(ctx, KOE.jacketShade);
    spline(ctx, [[-290, 380], [-240, 470], [-262, 770], [-232, 770], [-214, 460]]); paint(ctx, KOE.jacketShade);
    poly(ctx, [[-112, 226], [0, 520], [112, 226], [0, 250]]); paint(ctx, KOE.dark, KOE.line, 5);
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * 262, 330); ctx.lineTo(s * 300, 760); paint(ctx, null, KOE.tip, 9);
    }
    ctx.restore();
    for (const s of [-1, 1]) { // tall collar
      spline(ctx, [[s * 52, 184, 1], [s * 134, 214], [s * 158, 292, 1], [s * 62, 356, 1], [s * 20, 276], [s * 34, 214]]);
      paint(ctx, s < 0 ? KOE.jacket : KOE.jacketShade, KOE.line, 5);
    }
    spline(ctx, [[-86, 196], [0, 236], [88, 196], [100, 248], [0, 300], [-102, 248]]); paint(ctx, KOE.scarf, KOE.line, 5);
    ctx.save(); ctx.clip(); ellipse(ctx, 30, 302, 130, 44); paint(ctx, KOE.scarfShade); ctx.restore();
    // sound-wave pendant
    circle(ctx, 0, 362, 24); paint(ctx, KOE.darkShade, KOE.line, 4);
    for (let i = -2; i <= 2; i++) { const h = 5 + 11 * Math.abs(Math.cos(i * 1.1 + o.t * 8)); ctx.beginPath(); ctx.moveTo(i * 6.6, 362 - h); ctx.lineTo(i * 6.6, 362 + h); paint(ctx, null, KOE.tip, 3.4); }
  });
}

function scarfTail(ctx, opts, side = 1, len = 620) {
  const o = headDefaults(opts);
  headSpace(ctx, o, () => {
    const w = o.wind === 0 ? 0.3 : o.wind;
    const spine = flow(side * 60, 244, w > 0 ? 0.28 - o.lift : Math.PI - 0.28 + o.lift, len, o.t, { amp: 62, freq: 2.1, speed: 8, droop: w > 0 ? 0.25 : -0.25, n: 28 });
    const width = u => 40 + 20 * Math.sin(u * 5 + o.t * 3) - (u > 0.92 ? (u - 0.92) * 500 : 0);
    ribbon(ctx, spine, width); paint(ctx, KOE.scarf, KOE.line, 5);
    ctx.save(); ctx.clip(); ribbon(ctx, spine.map(p => [p[0], p[1] + 24]), u => width(u) * 0.55); paint(ctx, KOE.scarfShade); ctx.restore();
  });
}

function portrait(ctx, opts) {
  const o = headDefaults(opts);
  backHair(ctx, o);
  if (opts.scarfTail !== false) scarfTail(ctx, o, o.wind >= 0 ? 1 : -1);
  if (opts.bust !== false) bust(ctx, o);
  face(ctx, o);
  frontHair(ctx, o);
}
