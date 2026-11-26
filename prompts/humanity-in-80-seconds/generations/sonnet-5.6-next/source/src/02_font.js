// A stroked alphabet drawn for this film. No font files, no system fonts.
// Units: baseline y = 0, cap height 70, x-height 48, y points UP.
// M x y        move
// L x y ...    line(s)
// C 6 numbers  cubic Bezier
// E cx cy rx ry a0 a1   ellipse arc in degrees (a1 > a0 turns counter-clockwise), new sub-path
const GLYPHS = {
  ' ': [24, ''],
  A: [58, 'M 3 0 L 29 70 L 55 0 M 12 22 L 46 22'],
  B: [53, 'M 7 0 L 7 70 L 27 70 C 39 70 45 63 45 54 C 45 44 38 37 27 37 L 7 37 M 27 37 C 41 37 49 30 49 19 C 49 7 41 0 28 0 L 7 0'],
  C: [58, 'E 33 35 28 36 43 317'],
  D: [60, 'M 7 0 L 7 70 L 23 70 C 43 70 55 56 55 35 C 55 14 43 0 23 0 L 7 0'],
  E: [48, 'M 43 70 L 7 70 L 7 0 L 44 0 M 7 36 L 38 36'],
  F: [46, 'M 43 70 L 7 70 L 7 0 M 7 35 L 37 35'],
  G: [62, 'E 33 35 28 36 43 360 L 39 35'],
  H: [58, 'M 7 0 L 7 70 M 51 0 L 51 70 M 7 36 L 51 36'],
  I: [18, 'M 9 0 L 9 70'],
  J: [41, 'M 34 70 L 34 20 C 34 7 28 -1 19 -1 C 11 -1 6 4 5 13'],
  K: [54, 'M 7 0 L 7 70 M 48 70 L 7 30 M 21 43 L 50 0'],
  L: [44, 'M 7 70 L 7 0 L 41 0'],
  M: [70, 'M 7 0 L 9 70 L 35 18 L 61 70 L 63 0'],
  N: [59, 'M 7 0 L 7 70 L 52 0 L 52 70'],
  O: [66, 'E 33 35 28 36 0 360'],
  P: [51, 'M 7 0 L 7 70 L 28 70 C 41 70 47 62 47 51 C 47 40 40 33 28 33 L 7 33'],
  Q: [66, 'E 33 35 28 36 0 360 M 39 18 L 60 -4'],
  R: [53, 'M 7 0 L 7 70 L 28 70 C 41 70 47 62 47 52 C 47 41 40 34 28 34 L 7 34 M 29 34 L 49 0'],
  S: [51, 'M 43 59 C 40 67 33 71 25 71 C 14 71 7 64 7 54 C 7 43 16 40 26 37 C 38 34 45 29 45 18 C 45 7 36 -1 25 -1 C 15 -1 8 4 5 12'],
  T: [50, 'M 3 70 L 47 70 M 25 70 L 25 0'],
  U: [58, 'M 7 70 L 7 25 C 7 8 16 -1 29 -1 C 42 -1 51 8 51 25 L 51 70'],
  V: [56, 'M 3 70 L 28 0 L 53 70'],
  W: [82, 'M 3 70 L 21 0 L 41 58 L 61 0 L 79 70'],
  X: [54, 'M 5 70 L 49 0 M 49 70 L 5 0'],
  Y: [54, 'M 3 70 L 27 35 L 51 70 M 27 35 L 27 0'],
  Z: [52, 'M 7 70 L 45 70 L 6 0 L 46 0'],

  a: [49, 'E 23 24 17 24.5 0 360 M 40 48 L 40 0'],
  b: [50, 'M 8 72 L 8 0 E 26 24 18 24.5 0 360'],
  c: [44, 'E 24 24 18 24.5 46 314'],
  d: [50, 'E 24 24 18 24.5 0 360 M 42 72 L 42 0'],
  e: [48, 'M 6 25 L 42 25 C 42 40 35 49 24 49 C 13 49 6 38 6 24 C 6 9 14 -1 26 -1 C 33 -1 38 2 41 7'],
  f: [31, 'M 29 71 C 19 74 13 68 13 58 L 13 0 M 4 47 L 28 47'],
  g: [50, 'E 24 24 18 24.5 0 360 M 42 48 L 42 -5 C 42 -17 34 -23 23 -23 C 17 -23 12 -21 9 -18'],
  h: [48, 'M 8 72 L 8 0 M 8 31 C 10 43 17 49 26 49 C 36 49 41 42 41 31 L 41 0'],
  i: [16, 'M 8 48 L 8 0 M 8 66 L 8 66.6'],
  j: [20, 'M 12 48 L 12 -10 C 12 -19 7 -23 -1 -22 M 12 66 L 12 66.6'],
  k: [44, 'M 8 72 L 8 0 M 38 48 L 8 19 M 19 29 L 40 0'],
  l: [16, 'M 8 72 L 8 0'],
  m: [73, 'M 8 48 L 8 0 M 8 31 C 10 43 16 49 23 49 C 32 49 36 42 36 31 L 36 0 M 36 31 C 38 43 44 49 51 49 C 60 49 65 42 65 31 L 65 0'],
  n: [48, 'M 8 48 L 8 0 M 8 31 C 10 43 17 49 26 49 C 36 49 41 42 41 31 L 41 0'],
  o: [50, 'E 25 24 19 24.5 0 360'],
  p: [50, 'M 8 48 L 8 -22 E 26 24 18 24.5 0 360'],
  q: [50, 'E 24 24 18 24.5 0 360 M 42 48 L 42 -22'],
  r: [33, 'M 8 48 L 8 0 M 8 28 C 10 42 19 50 31 47'],
  s: [42, 'M 35 40 C 32 46 27 49 21 49 C 13 49 8 45 8 37 C 8 30 14 28 21 26 C 30 24 36 21 36 13 C 36 4 29 -1 21 -1 C 13 -1 8 2 6 8'],
  t: [32, 'M 13 63 L 13 12 C 13 3 18 -2 28 1 M 4 47 L 28 47'],
  u: [48, 'M 8 48 L 8 17 C 8 6 14 -1 23 -1 C 32 -1 38 5 40 17 M 40 48 L 40 0'],
  v: [44, 'M 4 48 L 22 0 L 40 48'],
  w: [66, 'M 4 48 L 18 0 L 33 39 L 48 0 L 62 48'],
  x: [42, 'M 6 48 L 36 0 M 36 48 L 6 0'],
  y: [44, 'M 4 48 L 22 3 M 40 48 L 18 -10 C 15 -19 10 -23 3 -22'],
  z: [42, 'M 7 48 L 35 48 L 6 0 L 36 0'],

  // figures are tabular (all 52 wide) so the year counter never jitters
  0: [52, 'E 26 35 20 36 0 360'],
  1: [52, 'M 13 56 L 30 70 L 30 0'],
  2: [52, 'M 9 53 C 10 64 17 71 27 71 C 37 71 44 64 44 54 C 44 45 39 39 31 31 L 8 0 L 45 0'],
  3: [52, 'M 10 61 C 14 68 20 71 27 71 C 37 71 43 65 43 55 C 43 45 35 38 23 38 C 36 38 45 31 45 19 C 45 7 37 -1 26 -1 C 17 -1 10 4 7 11'],
  4: [52, 'M 35 0 L 35 70 L 5 21 L 48 21'],
  5: [52, 'M 41 70 L 13 70 L 10 39 C 14 43 20 45 27 45 C 38 45 45 36 45 23 C 45 8 37 -1 25 -1 C 17 -1 11 3 7 9'],
  6: [52, 'M 40 68 C 36 70 32 71 29 71 C 15 71 7 54 7 28 E 26 23 19 23.5 0 360'],
  7: [52, 'M 7 70 L 45 70 L 19 0'],
  8: [52, 'E 26 53.5 16 17 0 360 E 26 18 19.5 19 0 360'],
  9: [52, 'E 26 47 19 23.5 0 360 M 45 42 C 45 16 37 -1 23 -1 C 20 -1 16 0 12 2'],

  '.': [18, 'M 9 2 L 9 2.6'],
  ',': [18, 'M 10 3 L 7 -9'],
  ':': [20, 'M 10 5 L 10 5.6 M 10 39 L 10 39.6'],
  ';': [20, 'M 10 39 L 10 39.6 M 11 4 L 8 -8'],
  "'": [16, 'M 8 72 L 8 57'],
  '"': [28, 'M 9 72 L 9 57 M 19 72 L 19 57'],
  '!': [20, 'M 10 70 L 10 20 M 10 2 L 10 2.6'],
  '?': [48, 'M 8 56 C 9 66 16 71 24 71 C 34 71 41 65 41 56 C 41 43 24 41 23 27 L 23 20 M 23 2 L 23 2.6'],
  '-': [30, 'M 6 27 L 24 27'],
  '–': [46, 'M 6 27 L 40 27'],
  '=': [50, 'M 8 38 L 42 38 M 8 20 L 42 20'],
  '+': [50, 'M 25 46 L 25 10 M 7 28 L 43 28'],
  '~': [50, 'M 7 26 C 13 36 20 33 26 28 C 32 23 38 21 43 30'],
  '°': [30, 'E 15 60 9 9 0 360'],
  '·': [26, 'M 13 28 L 13 28.8'],
  '/': [38, 'M 4 -6 L 34 76'],
  '(': [24, 'M 18 76 C 10 63 7 50 7 35 C 7 20 10 7 18 -6'],
  ')': [24, 'M 6 76 C 14 63 17 50 17 35 C 17 20 14 7 6 -6'],
  '%': [64, 'E 15 55 9 14 0 360 E 49 15 9 14 0 360 M 49 70 L 15 0'],
};

const FONT = (() => {
  const cache = new Map();
  function parse(d) {
    const tk = d.trim().split(/\s+/).filter(Boolean);
    const p = new Path2D();
    let i = 0, cmd = '';
    const num = () => parseFloat(tk[i++]);
    while (i < tk.length) {
      if (/^[A-Za-z]$/.test(tk[i])) cmd = tk[i++];
      if (cmd === 'M') { p.moveTo(num(), num()); cmd = 'L'; }
      else if (cmd === 'L') p.lineTo(num(), num());
      else if (cmd === 'C') p.bezierCurveTo(num(), num(), num(), num(), num(), num());
      else if (cmd === 'E') {
        const cx = num(), cy = num(), rx = num(), ry = num(), a0 = num(), a1 = num();
        const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 4));
        for (let k = 0; k <= n; k++) {
          const a = (a0 + (a1 - a0) * k / n) * Math.PI / 180;
          const x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
          if (k === 0) p.moveTo(x, y); else p.lineTo(x, y);
        }
        cmd = 'L';
      } else throw new Error('bad glyph command ' + cmd + ' in ' + d);
    }
    return p;
  }
  function glyph(ch) {
    let g = cache.get(ch);
    if (!g) {
      const def = GLYPHS[ch];
      if (!def) throw new Error('no glyph for "' + ch + '" (U+' + ch.charCodeAt(0).toString(16) + ')');
      g = { w: def[0], path: parse(def[1]) };
      cache.set(ch, g);
    }
    return g;
  }
  const TRACK = 7;   // default letter spacing in glyph units
  function measure(str, size, track = TRACK) {
    let w = 0;
    for (const ch of str) w += glyph(ch).w + track;
    return Math.max(0, w - track) * size / 70;
  }
  // size = cap height in px; (x, y) = baseline anchor
  function draw(ctx, str, x, y, size, o = {}) {
    const {
      color = '#fff', weight = Math.max(2.2, size * 0.105), align = 'left', track = TRACK,
      alpha = 1, halo = 0.55, haloColor = '4,5,12', reveal = 1,
    } = o;
    if (alpha <= 0.002 || reveal <= 0) return measure(str, size, track);
    const s = size / 70;
    const total = measure(str, size, track);
    let cx = x - (align === 'center' ? total / 2 : align === 'right' ? total : 0);
    const chars = [...str];
    const passes = halo > 0 ? ['halo', 'ink'] : ['ink'];
    for (const pass of passes) {
      let gx = cx;
      for (let i = 0; i < chars.length; i++) {
        const g = glyph(chars[i]);
        // left-to-right reveal: each glyph ramps in
        const a = reveal >= 1 ? 1 : clamp(reveal * (chars.length + 5) - i, 0, 5) / 5;
        if (a > 0 && chars[i] !== ' ') {
          ctx.save();
          ctx.translate(gx, y);
          ctx.scale(s, -s);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          if (pass === 'halo') {
            ctx.globalAlpha = alpha * a * halo;
            ctx.strokeStyle = `rgb(${haloColor})`;
            ctx.lineWidth = (weight + size * 0.16) / s;
            ctx.shadowColor = `rgba(${haloColor},1)`;
            ctx.shadowBlur = size * 0.28;
          } else {
            ctx.globalAlpha = alpha * a;
            ctx.strokeStyle = color;
            ctx.lineWidth = weight / s;
          }
          ctx.stroke(g.path);
          ctx.restore();
        }
        gx += (g.w + track) * s;
      }
    }
    return total;
  }
  return { draw, measure, glyph, has: (c) => c in GLYPHS };
})();
