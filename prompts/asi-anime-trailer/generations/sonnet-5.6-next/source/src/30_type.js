'use strict';
// ---------------------------------------------------------------------------
// stroke lettering. No font files, no system fonts: every glyph is a path in a
// box where y=0 is cap height, y=36 x-height, y=100 baseline, y=134 descender.
// [advanceWidth, pathData]
// ---------------------------------------------------------------------------
const GLYPH = {
  A: [72, 'M0 100 L36 0 L72 100 M14 67 L58 67'],
  B: [64, 'M0 0 L0 100 M0 0 L35 0 C52 0 58 11 58 24 C58 38 49 48 34 48 L0 48 M34 48 C54 48 64 58 64 74 C64 90 52 100 35 100 L0 100'],
  C: [68, 'M67 19 C59 6 49 0 37 0 C13 0 0 20 0 50 C0 80 13 100 37 100 C50 100 60 94 68 81'],
  D: [68, 'M0 0 L0 100 L27 100 C54 100 68 80 68 50 C68 20 54 0 27 0 L0 0'],
  E: [56, 'M56 0 L0 0 L0 100 L57 100 M0 49 L49 49'],
  F: [54, 'M54 0 L0 0 L0 100 M0 50 L47 50'],
  G: [70, 'M67 18 C59 6 49 0 37 0 C13 0 0 20 0 50 C0 80 13 100 37 100 C58 100 70 87 70 70 L70 56 L41 56'],
  H: [64, 'M0 0 L0 100 M64 0 L64 100 M0 49 L64 49'],
  I: [0, 'M0 0 L0 100'],
  J: [46, 'M46 0 L46 70 C46 90 36 100 23 100 C11 100 3 93 0 82'],
  K: [64, 'M0 0 L0 100 M61 0 L0 63 M23 40 L64 100'],
  L: [52, 'M0 0 L0 100 L52 100'],
  M: [82, 'M0 100 L0 0 L41 64 L82 0 L82 100'],
  N: [64, 'M0 100 L0 0 L64 100 L64 0'],
  O: [74, 'M37 0 C13 0 0 20 0 50 C0 80 13 100 37 100 C61 100 74 80 74 50 C74 20 61 0 37 0 Z'],
  P: [62, 'M0 100 L0 0 L35 0 C52 0 62 11 62 27 C62 43 52 54 35 54 L0 54'],
  Q: [74, 'M37 0 C13 0 0 20 0 50 C0 80 13 100 37 100 C61 100 74 80 74 50 C74 20 61 0 37 0 Z M43 70 L75 105'],
  R: [64, 'M0 100 L0 0 L35 0 C52 0 61 11 61 26 C61 42 51 53 35 53 L0 53 M33 53 L64 100'],
  S: [62, 'M58 16 C52 5 43 0 31 0 C15 0 4 10 4 25 C4 40 16 44 31 48 C49 53 62 59 62 74 C62 90 49 100 31 100 C17 100 6 94 0 83'],
  T: [64, 'M0 0 L64 0 M32 0 L32 100'],
  U: [64, 'M0 0 L0 66 C0 88 13 100 32 100 C51 100 64 88 64 66 L64 0'],
  V: [70, 'M0 0 L35 100 L70 0'],
  W: [102, 'M0 0 L25 100 L51 14 L77 100 L102 0'],
  X: [66, 'M2 0 L64 100 M64 0 L2 100'],
  Y: [66, 'M0 0 L33 51 L66 0 M33 51 L33 100'],
  Z: [62, 'M3 0 L60 0 L2 100 L62 100'],
  0: [62, 'M31 0 C11 0 0 18 0 50 C0 82 11 100 31 100 C51 100 62 82 62 50 C62 18 51 0 31 0 Z'],
  1: [40, 'M2 22 L31 1 L31 100'],
  2: [60, 'M3 25 C5 10 17 0 31 0 C47 0 58 10 58 26 C58 40 49 50 35 63 L2 100 L60 100'],
  3: [60, 'M4 14 C10 5 20 0 30 0 C46 0 56 9 56 24 C56 38 44 47 24 47 C46 47 60 57 60 73 C60 90 47 100 30 100 C17 100 6 94 0 84'],
  4: [64, 'M47 100 L47 0 L0 70 L64 70'],
  5: [60, 'M55 0 L10 0 L5 48 C12 41 22 38 32 38 C49 38 60 51 60 69 C60 88 47 100 30 100 C17 100 7 95 1 85'],
  6: [61, 'M52 9 C46 3 39 0 32 0 C12 0 1 22 1 57 C1 85 13 100 31 100 C49 100 61 87 61 69 C61 52 49 40 32 40 C17 40 5 49 2 61'],
  7: [60, 'M0 0 L60 0 L21 100'],
  8: [62, 'M31 0 C16 0 6 9 6 23 C6 37 17 46 31 46 C45 46 56 37 56 23 C56 9 46 0 31 0 Z M31 46 C13 46 0 57 0 73 C0 89 13 100 31 100 C49 100 62 89 62 73 C62 57 49 46 31 46 Z'],
  9: [61, 'M9 91 C15 97 22 100 29 100 C49 100 60 78 60 43 C60 15 48 0 30 0 C12 0 0 13 0 31 C0 48 12 60 29 60 C44 60 56 51 59 39'],
  a: [42, 'M42 37 L42 100 M42 53 C38 42 30 36 22 36 C8 36 0 49 0 68 C0 87 8 100 22 100 C31 100 39 93 42 83'],
  b: [44, 'M0 -4 L0 100 M0 53 C4 42 12 36 22 36 C36 36 44 49 44 68 C44 87 36 100 22 100 C13 100 4 94 0 83'],
  c: [41, 'M40 46 C36 40 29 36 22 36 C8 36 0 49 0 68 C0 87 8 100 22 100 C30 100 37 96 41 89'],
  d: [42, 'M42 -4 L42 100 M42 53 C38 42 30 36 22 36 C8 36 0 49 0 68 C0 87 8 100 22 100 C31 100 39 94 42 83'],
  e: [43, 'M1 67 L43 67 C43 48 35 36 22 36 C8 36 0 49 0 68 C0 87 9 100 24 100 C32 100 38 97 42 91'],
  f: [28, 'M30 -2 C28 -4 25 -4 23 -4 C15 -4 11 2 11 12 L11 100 M0 38 L27 38'],
  g: [42, 'M42 37 L42 108 C42 125 33 134 20 134 C13 134 7 132 3 128 M42 53 C38 42 30 36 22 36 C8 36 0 49 0 66 C0 84 8 96 22 96 C31 96 39 90 42 80'],
  h: [40, 'M0 -4 L0 100 M0 55 C4 43 12 36 22 36 C34 36 40 44 40 58 L40 100'],
  i: [2, 'M1 37 L1 100 M1 13 L1 14'],
  j: [14, 'M13 37 L13 116 C13 128 8 134 -3 133 M13 13 L13 14'],
  k: [38, 'M0 -4 L0 100 M36 37 L0 75 M13 62 L39 100'],
  l: [2, 'M1 -4 L1 100'],
  m: [66, 'M0 37 L0 100 M0 53 C3 42 10 36 18 36 C28 36 33 43 33 55 L33 100 M33 53 C36 42 43 36 51 36 C61 36 66 43 66 55 L66 100'],
  n: [40, 'M0 37 L0 100 M0 55 C4 43 12 36 22 36 C34 36 40 44 40 58 L40 100'],
  o: [44, 'M22 36 C8 36 0 49 0 68 C0 87 8 100 22 100 C36 100 44 87 44 68 C44 49 36 36 22 36 Z'],
  p: [44, 'M0 37 L0 134 M0 53 C4 42 12 36 22 36 C36 36 44 49 44 68 C44 87 36 100 22 100 C13 100 4 94 0 83'],
  q: [42, 'M42 37 L42 134 M42 53 C38 42 30 36 22 36 C8 36 0 49 0 68 C0 87 8 100 22 100 C31 100 39 94 42 83'],
  r: [28, 'M0 37 L0 100 M0 57 C4 43 12 36 22 36 C25 36 27 37 28 38'],
  s: [37, 'M34 44 C31 39 25 36 19 36 C10 36 3 41 3 50 C3 59 10 63 19 66 C30 69 37 73 37 82 C37 94 28 100 19 100 C11 100 4 97 0 91'],
  t: [29, 'M11 16 L11 83 C11 95 16 100 24 100 C26 100 28 100 29 99 M0 38 L28 38'],
  u: [40, 'M0 37 L0 78 C0 92 7 100 18 100 C28 100 36 94 40 82 M40 37 L40 100'],
  v: [42, 'M0 37 L21 100 L42 37'],
  w: [64, 'M0 37 L16 100 L32 46 L48 100 L64 37'],
  x: [39, 'M1 37 L38 100 M38 37 L1 100'],
  y: [42, 'M0 37 L22 98 M43 37 L18 114 C14 126 9 134 -1 133'],
  z: [39, 'M2 37 L37 37 L1 100 L39 100'],
  '.': [2, 'M1 99 L1 99.6'],
  ',': [6, 'M5 98 C5 107 2 113 -2 117'],
  "'": [3, 'M3 0 L1 19'],
  '’': [3, 'M3 0 L1 19'],
  '"': [17, 'M3 0 L1 19 M17 0 L15 19'],
  '“': [17, 'M3 0 L1 19 M17 0 L15 19'],
  '”': [17, 'M3 0 L1 19 M17 0 L15 19'],
  '?': [50, 'M0 23 C2 9 12 0 26 0 C41 0 50 9 50 23 C50 36 42 41 33 47 C27 52 25 57 25 69 M25 98.5 L25 99.4'],
  '!': [2, 'M1 0 L1 69 M1 98.5 L1 99.4'],
  '-': [26, 'M0 64 L26 64'],
  '—': [70, 'M0 64 L70 64'],
  ':': [2, 'M1 50 L1 51 M1 97 L1 98'],
  '…': [50, 'M1 99 L1 99.6 M25 99 L25 99.6 M49 99 L49 99.6'],
  '·': [2, 'M1 66 L1 67'],
  '/': [36, 'M0 108 L36 -6'],
  '+': [40, 'M0 62 L40 62 M20 42 L20 82'],
  '=': [40, 'M0 52 L40 52 M0 76 L40 76'],
  '#': [52, 'M18 4 L8 96 M44 4 L34 96 M4 32 L52 32 M0 68 L48 68'],
  '(': [18, 'M18 -6 C6 12 0 30 0 52 C0 74 6 92 18 110'],
  ')': [18, 'M0 -6 C12 12 18 30 18 52 C18 74 12 92 0 110'],
  ' ': [30, ''],
};
const _gpts = new Map();
function glyphStrokes(ch) {
  let g = _gpts.get(ch);
  if (!g) {
    const def = GLYPH[ch] || GLYPH['?'];
    g = { w: def[0], s: def[1] ? parsePath(def[1]).map(s => sampleSub(s, 12)) : [] };
    _gpts.set(ch, g);
  }
  return g;
}
// layout. size = cap height in px, weight = stroke width in px
function typeMeasure(text, o) {
  const size = o.size, wgt = o.weight ?? size * (o.bold ? .19 : .075), k = size / 100;
  const sx = o.sx ?? 1, track = o.track ?? (o.bold ? size * .09 : size * .13);
  const chars = []; let x = 0;
  for (const ch of text) {
    const g = glyphStrokes(ch);
    const adv = g.w * k * sx + (ch === ' ' ? 0 : wgt);
    chars.push({ ch, g, x, adv });
    x += adv + track;
  }
  return { chars, width: Math.max(0, x - track), wgt, k, sx, size };
}
function glyphPath(ctx, g, ox, oy, kx, ky, reveal = 1) {
  ctx.beginPath();
  let total = 0, lens = null;
  if (reveal < 1) {
    lens = g.s.map(s => { let l = 0; for (let i = 1; i < s.length; i++) l += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); l = Math.max(l, 6); total += l; return l; });
  }
  let left = total * reveal;
  for (let j = 0; j < g.s.length; j++) {
    const s = g.s[j];
    if (lens && left <= 0) break;
    ctx.moveTo(ox + s[0][0] * kx, oy + s[0][1] * ky);
    let used = 0;
    for (let i = 1; i < s.length; i++) {
      const d = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
      if (lens && used + d > left) {
        const f = Math.max(0, left - used) / (d || 1);
        ctx.lineTo(ox + lerp(s[i - 1][0], s[i][0], f) * kx, oy + lerp(s[i - 1][1], s[i][1], f) * ky);
        break;
      }
      used += d;
      ctx.lineTo(ox + s[i][0] * kx, oy + s[i][1] * ky);
    }
    // a path that returns to its start is closed so the join is clean
    const a = s[0], b = s[s.length - 1];
    if (!lens && s.length > 3 && Math.abs(a[0] - b[0]) < .01 && Math.abs(a[1] - b[1]) < .01) ctx.closePath();
    if (lens) left -= lens[j];
  }
}
/**
 * draw(ctx, text, x, y, opts)  (x,y) = anchor; y is the cap-height TOP.
 * opts: size, bold, weight, track, sx, align ('center'|'left'|'right'), color,
 *       alpha, outline (px), outlineColor, shadow {x,y,color}, reveal 0..1,
 *       per(i, n, ch) -> {dx,dy,s,sx,sy,rot,a,color,reveal}
 */
function type(ctx, text, x, y, o) {
  const m = typeMeasure(text, o);
  const align = o.align ?? 'center';
  const x0 = align === 'center' ? x - m.width / 2 : align === 'right' ? x - m.width : x;
  const size = m.size, wgt = m.wgt, bold = !!o.bold, n = m.chars.length;
  const passes = [];
  if (o.shadow) passes.push({ color: o.shadow.color, extra: o.shadow.grow ?? 0, ox: o.shadow.x ?? 0, oy: o.shadow.y ?? 6 });
  if (o.outline) passes.push({ color: o.outlineColor ?? '#0b0d22', extra: o.outline * 2, ox: 0, oy: 0 });
  passes.push({ color: null, extra: 0, ox: 0, oy: 0 });
  const rev = o.reveal ?? 1;
  ctx.save();
  const baseA = ctx.globalAlpha * (o.alpha ?? 1);
  for (let p = 0; p < passes.length; p++) {
    const ps = passes[p];
    for (let i = 0; i < n; i++) {
      const c = m.chars[i];
      if (c.ch === ' ') continue;
      const mod = o.per ? o.per(i, n, c.ch) : null;
      let a = baseA * (mod?.a ?? 1);
      // reveal runs left to right, a few letters overlapping
      let cr = 1;
      if (rev < 1) cr = clamp(rev * (n + 2) - i);
      if (mod?.reveal !== undefined) cr *= mod.reveal;
      if (a <= .003 || cr <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      const gx = x0 + c.x + c.adv / 2, gy = y + size / 2;
      ctx.translate(gx + (mod?.dx ?? 0) + ps.ox, gy + (mod?.dy ?? 0) + ps.oy);
      if (mod?.rot) ctx.rotate(mod.rot);
      const s = mod?.s ?? 1;
      if (s !== 1 || mod?.sx || mod?.sy) ctx.scale(s * (mod?.sx ?? 1), s * (mod?.sy ?? 1));
      const lw = wgt + ps.extra;
      ctx.strokeStyle = ps.color ?? mod?.color ?? o.color ?? '#ffffff';
      ctx.lineWidth = lw;
      if (bold) {
        // flat terminals: centrelines inset by half a stroke, then clipped to the box
        const hw = wgt / 2, top = -size / 2, ex = ps.extra / 2;
        const tail = (c.ch === 'Q' || c.ch === ',') ? size * .3 : 0;
        ctx.lineCap = 'square'; ctx.lineJoin = 'miter'; ctx.miterLimit = 2.6;
        if (c.ch === '.' || c.ch === ':' || c.ch === '·') ctx.lineCap = 'square';
        ctx.beginPath(); ctx.rect(-c.adv / 2 - lw, top - ex, c.adv + lw * 2, size + ex * 2 + tail); ctx.clip();
        glyphPath(ctx, c.g, -c.adv / 2 + hw, top + hw, m.k * m.sx, (size - wgt) / 100, cr);
      } else {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        glyphPath(ctx, c.g, -c.adv / 2 + wgt / 2, -size / 2, m.k * m.sx, size / 100, cr);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
  return m;
}
const typeW = (text, o) => typeMeasure(text, o).width;

// narration: thin lettering that rises softly into place, letter by letter
function narrate(ctx, text, x, y, t, tin, tout, o = {}) {
  if (t < tin || t > tout) return;
  const n = text.length, stagger = o.stagger ?? Math.min(.028, .55 / n);
  const out = 1 - ramp(t, tout - (o.outDur ?? .28), tout, E.inQuad);
  const size = o.size ?? 40;
  const per = i => {
    const k = ramp(t, tin + i * stagger, tin + i * stagger + .34, E.outCubic);
    return { a: k * out, dy: (1 - k) * size * .32 };
  };
  const base = { size, weight: o.weight ?? size * .088, track: o.track ?? size * .17, per, align: o.align, color: o.color ?? '#f4f6ff' };
  // soft dark halo keeps thin type readable over bright skies
  type(ctx, text, x, y, { ...base, shadow: { color: o.halo ?? 'rgba(8,10,34,0.42)', x: 0, y: size * .06, grow: size * .16 } });
}
// anime fansub style dialogue
function subtitle(ctx, text, t, tin, tout, o = {}) {
  if (t < tin || t > tout) return;
  const size = o.size ?? 46;
  const dur = o.typeDur ?? 0;
  const out = 1 - ramp(t, tout - .18, tout);
  const rev = dur ? inv(tin, tin + dur, t) : 1;
  type(ctx, text, o.x ?? W / 2, o.y ?? 930, {
    size, weight: size * .125, track: size * .17, color: o.color ?? '#ffffff', outline: size * .12, outlineColor: o.outlineColor ?? '#151230',
    alpha: out * (dur ? 1 : ramp(t, tin, tin + .12)), reveal: rev,
  });
}
// impact title: letters slam down with overshoot
function slam(ctx, text, x, y, t, tin, o = {}) {
  const u = t - tin;
  if (u < 0) return;
  const size = o.size ?? 150, stag = o.stagger ?? .022;
  type(ctx, text, x, y, {
    size, bold: true, weight: o.weight ?? size * .2, track: o.track ?? size * .1, color: o.color ?? '#ffffff', align: o.align, sx: o.sx,
    shadow: o.shadow ?? { x: 0, y: size * .055, color: o.shadowColor ?? 'rgba(10,8,40,0.55)', grow: size * .02 },
    outline: o.outline, outlineColor: o.outlineColor, alpha: o.alpha ?? 1,
    per: i => {
      const v = clamp((u - i * stag) / .2);
      if (v <= 0) return { a: 0 };
      const s = 1 + (1 - E.outBack(v, 2.2)) * .9;
      return { a: Math.min(1, v * 3), s, dy: (1 - E.outCubic(v)) * -size * .12 };
    },
  });
}
