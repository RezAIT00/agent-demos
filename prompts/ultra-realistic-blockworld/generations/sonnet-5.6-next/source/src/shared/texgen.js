// ---------------------------------------------------------------- procedural PBR material synthesis (runs in workers)
// every function is periodic so layers tile seamlessly
const TX_GR = (() => { const g = []; for (let i = 0; i < 16; i++) g.push([Math.cos(i * Math.PI / 8 + 0.13), Math.sin(i * Math.PI / 8 + 0.13)]); return g; })();
function pnoise(x, y, px, py, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const x0 = ((ix % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((iy % py) + py) % py, y1 = (y0 + 1) % py;
  const g = (gx, gy, dx, dy) => { const v = TX_GR[ihash(gx, gy, s) & 15]; return v[0] * dx + v[1] * dy; };
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = g(x0, y0, fx, fy), b = g(x1, y0, fx - 1, fy), c = g(x0, y1, fx, fy - 1), d = g(x1, y1, fx - 1, fy - 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 1.5;
}
// fbm over the unit square with integer base frequencies
function pfbm(u, v, fx, fy, oct, s, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * pnoise(u * fx, v * fy, fx, fy, s + i * 101);
    norm += amp; amp *= gain; fx *= 2; fy *= 2;
  }
  return sum / norm;
}
const WOR = { f1: 0, f2: 0, id: 0, cx: 0, cy: 0 };
function pworley(u, v, fx, fy, s, jit = 0.85) {
  const x = u * fx, y = v * fy, ix = Math.floor(x), iy = Math.floor(y);
  let f1 = 9, f2 = 9, id = 0, bx = 0, by = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j;
    const wx = ((cx % fx) + fx) % fx, wy = ((cy % fy) + fy) % fy;
    const h = ihash(wx, wy, s);
    const px = cx + 0.5 + (((h & 1023) / 1023) - 0.5) * jit, py = cy + 0.5 + ((((h >>> 10) & 1023) / 1023) - 0.5) * jit;
    const dx = px - x, dy = py - y, d = dx * dx + dy * dy;
    if (d < f1) { f2 = f1; f1 = d; id = h; bx = x - px; by = y - py; } else if (d < f2) f2 = d;
  }
  WOR.f1 = Math.sqrt(f1); WOR.f2 = Math.sqrt(f2); WOR.id = id; WOR.cx = bx; WOR.cy = by;
  return WOR;
}
const idr = (id, k) => ((ihash(id, k, 5) >>> 0) / 4294967296);

class Mat {
  constructor(S) {
    this.S = S; const n = S * S;
    this.r = new Float32Array(n); this.g = new Float32Array(n); this.b = new Float32Array(n);
    this.h = new Float32Array(n).fill(0.5); this.ro = new Float32Array(n).fill(0.85); this.me = new Float32Array(n);
    this.em = new Float32Array(n); this.al = new Float32Array(n).fill(1); this.mk = new Float32Array(n);
  }
  each(fn) {
    const S = this.S;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) fn((x + 0.5) / S, (y + 0.5) / S, y * S + x);
  }
  col(i, c, k = 1) { this.r[i] = c[0] * k; this.g[i] = c[1] * k; this.b[i] = c[2] * k; }
  mix(i, c, t) { this.r[i] += (c[0] - this.r[i]) * t; this.g[i] += (c[1] - this.g[i]) * t; this.b[i] += (c[2] - this.b[i]) * t; }
  mul(i, k) { this.r[i] *= k; this.g[i] *= k; this.b[i] *= k; }
  // iterate over a wrapped, rotated ellipse footprint; cb(i, a, b) with a,b in [-1,1]
  splat(cu, cv, ru, rv, ang, cb, wrap = true) {
    const S = this.S, c = Math.cos(ang), s = Math.sin(ang);
    const R = Math.max(ru, rv) * S + 1;
    const px = cu * S, py = cv * S;
    for (let y = Math.floor(py - R); y <= Math.ceil(py + R); y++) for (let x = Math.floor(px - R); x <= Math.ceil(px + R); x++) {
      const dx = (x + 0.5 - px) / S, dy = (y + 0.5 - py) / S;
      const a = (dx * c + dy * s) / ru, b = (-dx * s + dy * c) / rv;
      if (a < -1 || a > 1 || b < -1 || b > 1) continue;
      let xx = x, yy = y;
      if (wrap) { xx = ((x % S) + S) % S; yy = ((y % S) + S) % S; } else if (x < 0 || y < 0 || x >= S || y >= S) continue;
      cb(yy * S + xx, a, b);
    }
  }
  // thick tapered polyline; cb(i, t, across)
  stroke(pts, w0, w1, cb, wrap = true) {
    const S = this.S; let total = 0; const lens = [];
    for (let k = 0; k < pts.length - 1; k++) { const l = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]); lens.push(l); total += l; }
    if (total <= 0) return;
    let acc = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1], l = lens[k] || 1e-6;
      const ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
      const wmax = Math.max(w0, w1);
      const minx = Math.floor((Math.min(a[0], b[0]) - wmax) * S), maxx = Math.ceil((Math.max(a[0], b[0]) + wmax) * S);
      const miny = Math.floor((Math.min(a[1], b[1]) - wmax) * S), maxy = Math.ceil((Math.max(a[1], b[1]) + wmax) * S);
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        const dx = (x + 0.5) / S - a[0], dy = (y + 0.5) / S - a[1];
        const tl = clamp(dx * ux + dy * uy, 0, l);
        const ex = dx - ux * tl, ey = dy - uy * tl;
        const t = (acc + tl) / total;
        const w = Math.max(lerp(w0, w1, t), 0.55 / S);
        const d = Math.hypot(ex, ey);
        if (d > w) continue;
        let xx = x, yy = y;
        if (wrap) { xx = ((x % S) + S) % S; yy = ((y % S) + S) % S; } else if (x < 0 || y < 0 || x >= S || y >= S) continue;
        cb(yy * S + xx, t, (-dx * uy + dy * ux) / w);
      }
      acc += l;
    }
  }
  blur(src, r) {
    const S = this.S, tmp = new Float32Array(S * S), out = new Float32Array(S * S), k = 1 / (2 * r + 1);
    for (let y = 0; y < S; y++) {
      let s = 0; const row = y * S;
      for (let i = -r; i <= r; i++) s += src[row + ((i + S) % S)];
      for (let x = 0; x < S; x++) { tmp[row + x] = s * k; s += src[row + ((x + r + 1) % S)] - src[row + ((x - r + S) % S)]; }
    }
    for (let x = 0; x < S; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += tmp[((i + S) % S) * S + x];
      for (let y = 0; y < S; y++) { out[y * S + x] = s * k; s += tmp[((y + r + 1) % S) * S + x] - tmp[((y - r + S) % S) * S + x]; }
    }
    return out;
  }
  pack(normalStrength, aoStrength, cutout) {
    const S = this.S, n = S * S;
    const albedo = new Uint8Array(n * 4), normal = new Uint8Array(n * 4), extra = new Uint8Array(n * 4);
    const b1 = this.blur(this.h, Math.max(2, (S / 64) | 0)), b2 = this.blur(this.h, Math.max(4, (S / 18) | 0));
    const k = normalStrength * S / 256;
    // for cut-out cards, dilate colour into transparent texels so mipmaps don't pick up black fringes
    if (cutout) {
      let ar = 0, ag = 0, ab = 0, c = 0;
      for (let i = 0; i < n; i++) if (this.al[i] > 0.5) { ar += this.r[i]; ag += this.g[i]; ab += this.b[i]; c++; }
      c = c || 1;
      const filled = new Uint8Array(n);
      for (let i = 0; i < n; i++) filled[i] = this.al[i] > 0.05 ? 1 : 0;
      let mkAvg = 0; for (let i = 0; i < n; i++) if (this.al[i] > 0.5) mkAvg += this.mk[i]; mkAvg /= c;
      for (let pass = 0; pass < 10; pass++) {
        const next = [];
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const i = y * S + x; if (filled[i]) continue;
          for (const j of [y * S + ((x + 1) % S), y * S + ((x + S - 1) % S), ((y + 1) % S) * S + x, ((y + S - 1) % S) * S + x]) {
            if (filled[j]) { this.r[i] = this.r[j]; this.g[i] = this.g[j]; this.b[i] = this.b[j]; this.mk[i] = this.mk[j]; this.ro[i] = this.ro[j]; next.push(i); break; }
          }
        }
        for (const i of next) filled[i] = 1;
      }
      for (let i = 0; i < n; i++) if (!filled[i]) { this.r[i] = ar / c; this.g[i] = ag / c; this.b[i] = ab / c; this.mk[i] = mkAvg; }
    }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x, o = i * 4;
      const hl = this.h[y * S + ((x + S - 1) % S)], hr = this.h[y * S + ((x + 1) % S)];
      const hd = this.h[((y + S - 1) % S) * S + x], hu = this.h[((y + 1) % S) * S + x];
      let nx = (hl - hr) * k, ny = (hd - hu) * k;
      const il = 1 / Math.hypot(nx, ny, 1);
      nx *= il; ny *= il;
      const cav = Math.max(0, b1[i] - this.h[i]) * 1.6 + Math.max(0, b2[i] - this.h[i]) * 0.85;
      const ao = clamp(1 - cav * aoStrength, 0.25, 1);
      albedo[o] = clamp(this.r[i], 0, 255); albedo[o + 1] = clamp(this.g[i], 0, 255); albedo[o + 2] = clamp(this.b[i], 0, 255); albedo[o + 3] = clamp(this.h[i], 0, 1) * 255;
      normal[o] = (nx * 0.5 + 0.5) * 255 + 0.5; normal[o + 1] = (ny * 0.5 + 0.5) * 255 + 0.5; normal[o + 2] = clamp(this.ro[i], 0.02, 1) * 255; normal[o + 3] = ao * 255;
      extra[o] = clamp(this.em[i], 0, 1) * 255; extra[o + 1] = clamp(this.me[i], 0, 1) * 255; extra[o + 2] = clamp(this.mk[i], 0, 1) * 255; extra[o + 3] = clamp(this.al[i], 0, 1) * 255;
    }
    return { albedo, normal, extra };
  }
}

// ---------- shared building blocks
function txGranite(m, s, base, o = {}) {
  const c0 = base[0], c1 = base[1];
  m.each((u, v, i) => {
    const wu = u + pfbm(u, v, 5, 5, 3, s + 1) * 0.06, wv = v + pfbm(u, v, 5, 5, 3, s + 2) * 0.06;
    const t = clamp(pfbm(wu, wv, 3, 3, 5, s + 3) * 1.25 + 0.5, 0, 1);
    m.col(i, [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)]);
    let hh = 0.5 + pfbm(wu, wv, 4, 4, 6, s + 4, 0.55) * 0.42;
    const rid = 1 - Math.abs(pnoise(wu * 3, wv * 3, 3, 3, s + 5));
    hh += (rid * rid - 0.5) * 0.14;
    let rough = 0.82;
    const gr = pworley(u, v, 80, 80, s + 6, 0.95);
    const k = idr(gr.id, 1), edge = sstep(0.62, 0.3, gr.f1);
    const grain = o.grain === undefined ? 1 : o.grain;
    if (k < 0.12) { m.mix(i, [62, 58, 55], edge * 0.52 * grain); rough -= edge * 0.4 * grain; }
    else if (k < 0.34) m.mix(i, [176, 167, 154], edge * 0.38 * grain);
    else if (k < 0.43) m.mix(i, [154, 126, 113], edge * 0.38 * grain);
    else if (k < 0.5) { m.mix(i, [194, 192, 186], edge * 0.28 * grain); rough -= edge * 0.3 * grain; }
    const fine = pnoise(u * 190, v * 190, 190, 190, s + 7);
    m.mul(i, 1 + fine * 0.09);
    hh += fine * 0.012 + (gr.f1 - 0.4) * 0.016;
    m.h[i] = hh; m.ro[i] = rough;
  });
}
function txCracks(m, s, freq, width, depth, dark, maskTh = 0.0) {
  m.each((u, v, i) => {
    const wu = u + pfbm(u, v, 4, 4, 4, s) * 0.11, wv = v + pfbm(u, v, 4, 4, 4, s + 9) * 0.11;
    const w = pworley(wu, wv, freq, freq, s + 3, 1);
    const e = w.f2 - w.f1;
    const mask = sstep(maskTh - 0.2, maskTh + 0.15, pfbm(u, v, 3, 3, 3, s + 5));
    if (e < width) {
      const t = (1 - e / width) * mask;
      m.h[i] -= t * depth; m.mul(i, 1 - t * dark);
    }
    // slight per-fracture-block height offset
    m.h[i] += (idr(w.id, 3) - 0.5) * 0.035 * mask;
  });
}
function txLichen(m, s, colors, cover, bump = 0.02) {
  colors.forEach((c, n) => {
    m.each((u, v, i) => {
      const a = pfbm(u, v, 5 + n, 5 + n, 4, s + n * 13) + pfbm(u, v, 23, 23, 3, s + n * 13 + 3) * 0.55;
      const t = sstep(cover, cover + 0.09, a);
      if (t <= 0) return;
      const sp = pnoise(u * 64, v * 64, 64, 64, s + n * 7);
      m.mix(i, c, t * clamp(0.62 + sp * 0.55, 0, 0.9));
      m.h[i] += t * bump * (1 + sp); m.ro[i] = lerp(m.ro[i], 0.96, t);
    });
  });
}
function txPebbles(m, s, count, rmin, rmax, palette, hbase, hvar, opts = {}) {
  const r = mulberry32(s);
  for (let k = 0; k < count; k++) {
    const cu = r(), cv = r(), ra = rmin + Math.pow(r(), 2.2) * (rmax - rmin), asp = 0.6 + r() * 0.4, ang = r() * 3.1416;
    const c = palette[(r() * palette.length) | 0], tone = 0.82 + r() * 0.34, hh = hbase + r() * hvar, ro = opts.rough || 0.78;
    const ns = (r() * 1000) | 0;
    m.splat(cu, cv, ra, ra * asp, ang, (i, a, b) => {
      const wob = 1 + pnoise(a * 2.1 + 7, b * 2.1 + 3, 16, 16, ns) * 0.2;
      const d = Math.sqrt(a * a + b * b) * wob;
      if (d >= 1) return;
      const dome = Math.sqrt(1 - d * d);
      const ph = hh + dome * (opts.dome || 0.12) + pnoise(a * 3, b * 3, 32, 32, ns + 1) * 0.015;
      if (ph > m.h[i]) {
        const sp = pnoise(a * 7, b * 7, 64, 64, ns + 2);
        const cover = sstep(1, 0.88, d);
        m.mix(i, [c[0] * tone * (1 + sp * 0.12), c[1] * tone * (1 + sp * 0.12), c[2] * tone * (1 + sp * 0.12)], cover);
        m.h[i] = ph; m.ro[i] = ro + sp * 0.08;
        if (opts.mask !== undefined) m.mk[i] = opts.mask;
      }
    });
  }
}
function txDirt(m, s, base) {
  m.each((u, v, i) => {
    const t = clamp(pfbm(u, v, 4, 4, 5, s) * 1.5 + 0.5, 0, 1);
    m.col(i, [lerp(base[0][0], base[1][0], t), lerp(base[0][1], base[1][1], t), lerp(base[0][2], base[1][2], t)]);
    const f = pnoise(u * 120, v * 120, 120, 120, s + 2);
    const f2 = pfbm(u, v, 24, 24, 3, s + 4);
    m.mul(i, 1 + f * 0.2 + f2 * 0.15);
    m.h[i] = 0.34 + pfbm(u, v, 6, 6, 5, s + 3) * 0.16 + f * 0.025 + f2 * 0.06;
    m.ro[i] = 0.95;
  });
  txPebbles(m, s + 11, 420, 0.006, 0.034, [base[0], base[1], [base[1][0] * 1.12, base[1][1] * 1.1, base[1][2] * 1.05]], 0.3, 0.14, { dome: 0.13, rough: 0.95 });
  txPebbles(m, s + 12, 75, 0.005, 0.022, [[128, 120, 108], [150, 134, 110], [96, 90, 84], [165, 152, 132]], 0.42, 0.12, { dome: 0.12, rough: 0.7 });
  const r = mulberry32(s + 13);
  for (let k = 0; k < 24; k++) {
    let x = r(), y = r(), a = r() * 6.28; const pts = [[x, y]];
    for (let j = 0; j < 7; j++) { a += (r() - 0.5) * 1.3; x += Math.cos(a) * 0.028; y += Math.sin(a) * 0.028; pts.push([x, y]); }
    const tone = 0.8 + r() * 0.4;
    m.stroke(pts, 0.0035, 0.0008, (i, t, c) => { m.mix(i, [150 * tone, 118 * tone, 80 * tone], 0.75); m.h[i] = Math.max(m.h[i], 0.56 - Math.abs(c) * 0.04); });
  }
}
function txBlade(m, r, x, y, ang, len, w, curve, color, h0, h1, mask, wrap = true, rough = 0.82) {
  const pts = []; let a = ang;
  for (let j = 0; j <= 5; j++) { pts.push([x, y]); a += curve / 5; x += Math.cos(a) * len / 5; y += Math.sin(a) * len / 5; }
  m.stroke(pts, w, w * 0.18, (i, t, c) => {
    const hh = lerp(h0, h1, t) - Math.abs(c) * 0.025;
    if (m.al[i] > 0.5 && hh < m.h[i] - 0.001) return;
    const shade = (0.62 + t * 0.5) * (1 - Math.abs(c) * 0.16) * (Math.abs(c) < 0.18 ? 1.12 : 1);
    m.r[i] = color[0] * shade; m.g[i] = color[1] * shade; m.b[i] = color[2] * shade;
    m.h[i] = hh; m.mk[i] = mask; m.al[i] = 1; m.ro[i] = rough;
  }, wrap);
}
function txTurf(m, s) {
  m.each((u, v, i) => {
    const t = clamp(pfbm(u, v, 5, 5, 4, s) * 1.4 + 0.5, 0, 1);
    m.col(i, [lerp(46, 82, t), lerp(36, 62, t), lerp(24, 40, t)]);
    m.mul(i, 1 + pnoise(u * 100, v * 100, 100, 100, s + 1) * 0.25);
    m.h[i] = 0.2 + pfbm(u, v, 8, 8, 4, s + 2) * 0.1; m.ro[i] = 0.95; m.mk[i] = 0;
    // green undergrowth so soil only shows through in places
    const g = sstep(-0.28, 0.12, pfbm(u, v, 9, 9, 4, s + 3));
    if (g > 0) { m.mix(i, [82, 86, 74], g); m.mk[i] = g; }
  });
  const r = mulberry32(s + 5);
  for (let k = 0; k < 3300; k++) {
    const x = r(), y = r(), ang = r() * 6.283, len = 0.025 + r() * 0.06, z = k / 3300;
    const dry = r() < 0.07;
    const hue = r(), br = 0.74 + r() * 0.55;
    const col = dry ? [166 * br, 142 * br, 88 * br] : [(120 + hue * 30) * br, (136 - hue * 6) * br, (112 - hue * 34) * br];
    txBlade(m, r, x, y, ang, len, 0.0034 + r() * 0.0034, (r() - 0.5) * 1.6, col, 0.28 + z * 0.25, 0.4 + z * 0.36 + r() * 0.1, dry ? 0 : 1);
  }
  // clover and small broad leaves
  for (let k = 0; k < 70; k++) {
    const x = r(), y = r(), rad = 0.008 + r() * 0.012, br = 0.85 + r() * 0.35, a0 = r() * 6.28;
    for (let l = 0; l < 3; l++) {
      const a = a0 + l * 2.094;
      m.splat(x + Math.cos(a) * rad * 0.8, y + Math.sin(a) * rad * 0.8, rad, rad * 0.78, a, (i, p, q) => {
        const d = p * p + q * q; if (d > 1) return;
        m.col(i, [122 * br, 142 * br, 110 * br], 1 - d * 0.22 + (Math.abs(q) < 0.1 ? 0.14 : 0)); m.h[i] = 0.88 - d * 0.05; m.mk[i] = 1;
      });
    }
  }
}
function txStrata(m, s, cols, layers, o = {}) {
  m.each((u, v, i) => {
    const warp = pfbm(u, v, 3, 3, 4, s) * 0.55 + pfbm(u, v, 9, 9, 3, s + 1) * 0.12;
    const sc = v * layers + warp * (o.warp || 1.2) + Math.sin(u * 6.2832) * (o.wave || 0.12);
    const li = Math.floor(sc), f = sc - li;
    const wrapL = ((li % layers) + layers) % layers;
    const nxt = (wrapL + 1) % layers;
    const pick = (k) => cols[Math.floor(rand01(k, 1, 0, s) * cols.length)];
    const a = pick(wrapL), b = pick(nxt), bl = sstep(0.82, 1.0, f);
    m.col(i, [lerp(a[0], b[0], bl), lerp(a[1], b[1], bl), lerp(a[2], b[2], bl)]);
    const lam = pnoise(u * 5, sc * (o.lam || 5), 5, layers * (o.lam || 5), s + 2);
    const grain = pnoise(u * 170, v * 170, 170, 170, s + 3), grain2 = pnoise(u * 70, v * 70, 70, 70, s + 8);
    m.mul(i, 1 + lam * 0.1 + grain * 0.13 + grain2 * 0.07 + pfbm(u, v, 7, 7, 4, s + 4) * 0.12);
    const ledge = (rand01(wrapL, 2, 0, s) - 0.5) * (o.ledge || 0.14);
    const groove = sstep(0.09, 0.0, f) + sstep(0.93, 1.0, f);
    m.h[i] = 0.55 + ledge * sstep(0.0, 0.16, f) + (rand01(((li - 1) % layers + layers) % layers, 2, 0, s) - 0.5) * (o.ledge || 0.14) * (1 - sstep(0.0, 0.16, f))
      - groove * (o.groove || 0.07) + pfbm(u, v, 5, 5, 6, s + 5, 0.55) * 0.3 + lam * 0.025 + grain * 0.016;
    m.mul(i, 1 - groove * 0.16);
    const w = pworley(u + warp * 0.06, v, 17, 23, s + 6, 1);
    if (idr(w.id, 1) < (o.pits || 0.14) && w.f1 < 0.3) { const t = sstep(0.3, 0.08, w.f1); m.h[i] -= t * 0.1; m.mul(i, 1 - t * 0.2); }
    m.ro[i] = (o.rough || 0.9) + grain * 0.06;
  });
}
function txRockCells(m, s, o) {
  // rounded fieldstones / pebble packing from a warped cellular field
  const fx = o.fx, fy = o.fy;
  m.each((u, v, i) => {
    const wu = u + pfbm(u, v, 6, 6, 3, s + 1) * o.warp, wv = v + pfbm(u, v, 6, 6, 3, s + 2) * o.warp;
    const w = pworley(wu, wv, fx, fy, s + 3, o.jit || 0.85);
    const e = w.f2 - w.f1, id = w.id, cx = w.cx, cy = w.cy;
    const c = o.palette[Math.floor(idr(id, 1) * o.palette.length)], tone = 0.8 + idr(id, 2) * 0.36;
    const det = pfbm(u, v, 14, 14, 4, s + 4), fine = pnoise(u * 140, v * 140, 140, 140, s + 5);
    const gap = sstep(o.gap, o.gap + 0.06, e + det * 0.05);
    const dome = Math.pow(clamp((e - o.gap) / (o.round || 0.42), 0, 1), 0.48);
    const facet = (cx * (idr(id, 3) - 0.5) + cy * (idr(id, 4) - 0.5)) * (o.facet || 0.12);
    const stoneH = 0.4 + dome * 0.34 + facet + (idr(id, 5) - 0.5) * (o.hvar || 0.2) + det * 0.1 + fine * 0.012;
    const gapH = 0.14 + pnoise(u * 60, v * 60, 60, 60, s + 6) * 0.07 + fine * 0.03;
    m.h[i] = lerp(gapH, stoneH, gap);
    const speck = pworley(u, v, 90, 90, s + 7);
    let sk = 1 + det * 0.2 + fine * 0.1;
    if (idr(speck.id, 1) < 0.2) sk *= 1 - sstep(0.5, 0.2, speck.f1) * 0.3; else if (idr(speck.id, 1) > 0.82) sk *= 1 + sstep(0.5, 0.2, speck.f1) * 0.28;
    const mortar = o.mortar || [74, 66, 52];
    m.col(i, [lerp(mortar[0] * (1 + fine * 0.3), c[0] * tone * sk, gap), lerp(mortar[1] * (1 + fine * 0.3), c[1] * tone * sk, gap), lerp(mortar[2] * (1 + fine * 0.3), c[2] * tone * sk, gap)]);
    m.mul(i, lerp(1, 0.78 + dome * 0.22, gap));
    m.ro[i] = lerp(0.98, o.rough || 0.78, gap);
  });
}
function txWood(m, s, base, o = {}) {
  const boards = o.boards || 4;
  m.each((u, v, i) => {
    const bi = Math.floor(v * boards), fv = v * boards - bi;
    const tone = 0.84 + rand01(bi, 1, 0, s) * 0.3;
    const joint = rand01(bi, 2, 0, s);
    const uu = (u + joint) % 1;
    const seg = u + joint >= 1 ? 1 : 0;
    // knots bend the grain
    let kx = rand01(bi, 3 + seg, 0, s), ky = 0.3 + rand01(bi, 5, 0, s) * 0.4;
    let dx = u - kx; dx -= Math.round(dx);
    const kd = Math.hypot(dx * 2.6, (fv - ky) / boards * 7.5);
    const hasKnot = rand01(bi, 6, 0, s) < 0.55;
    const bend = hasKnot ? Math.exp(-kd * kd * 18) : 0;
    const warp = pfbm(u, v, 2, 7, 4, s + 3) * 1.15 + bend * 1.9 * Math.sign(fv - ky || 1);
    const t = fv * (o.rings || 7.5) + warp + rand01(bi, 7, seg, s) * 9;
    const ring = t - Math.floor(t);
    const line = sstep(0.62, 0.93, ring) * sstep(1.0, 0.93, ring);
    const fibre = pfbm(u, v, 6, 190, 3, s + 4);
    const pore = sstep(0.34, 0.62, pnoise(u * 34, v * 230, 34, 230, s + 5));
    let k = tone * (1 - line * 0.3 + fibre * 0.17 - pore * 0.12 + pfbm(u, v, 5, 12, 3, s + 6) * 0.14);
    m.col(i, base, k);
    m.mix(i, [base[0] * 0.55, base[1] * 0.48, base[2] * 0.42], line * 0.35);
    let hh = 0.66 + fibre * 0.05 - pore * 0.03 - line * 0.025 + pfbm(u, v, 3, 4, 3, s + 8) * 0.05;
    if (hasKnot && kd < 0.2) {
      const kr = Math.sin(kd * 160);
      const t2 = sstep(0.2, 0.06, kd);
      m.mix(i, [64, 40, 22], t2 * (0.7 + kr * 0.2));
      hh += t2 * kr * 0.015;
    }
    // board edges and butt joints
    const edge = Math.min(fv, 1 - fv) / boards;
    const jd = Math.min(uu, 1 - uu);
    const groove = Math.max(sstep(0.0085, 0.0015, edge), sstep(0.006, 0.0012, jd));
    hh -= groove * 0.34; m.mul(i, 1 - groove * 0.66);
    hh -= sstep(0.03, 0.008, edge) * 0.05;
    // nails near the butt joint
    for (const ny of [0.26, 0.74]) {
      for (const nx of [0.032, 0.968]) {
        const d = Math.hypot(uu - nx, (fv - ny) / boards);
        if (d < 0.022) {
          const halo = sstep(0.022, 0.008, d);
          m.mix(i, [92, 55, 30], halo * 0.5);
          if (d < 0.0085) { m.col(i, [52, 46, 44]); m.me[i] = 0.7; hh = 0.62 - (0.0085 - d) * 2; }
        }
      }
    }
    m.h[i] = hh;
    if (m.me[i] < 0.1) m.ro[i] = (o.rough || 0.72) + fibre * 0.08 + pore * 0.08;
    else m.ro[i] = 0.45;
  });
}
function txBarkPlates(m, s, o) {
  m.each((u, v, i) => {
    const wu = u + pfbm(u, v, 5, 4, 4, s) * o.warp + pfbm(u, v, 2, 2, 2, s + 9) * o.warp;
    const wv = v + pfbm(u, v, 5, 4, 3, s + 1) * o.warp * 0.8;
    const w = pworley(wu, wv, o.fx, o.fy, s + 2, 0.9);
    const e = w.f2 - w.f1, id = w.id;
    const plate = sstep(o.furrow * 0.35, o.furrow * 1.5, e);
    const rough1 = pfbm(u, v, 18, 9, 4, s + 3);
    const flake = Math.floor(pfbm(u, v, 8, 14, 3, s + 4) * 6) / 6;
    const cross = sstep(0.07, 0.0, Math.abs(pnoise(wu * 7, wv * 21, 7, 21, s + 5)));
    let hh = 0.12 + plate * (0.54 + (idr(id, 1) - 0.5) * 0.18) + rough1 * 0.16 * plate + flake * o.flake * plate - cross * 0.09 * plate;
    hh += pnoise(u * 90, v * 30, 90, 30, s + 6) * 0.035;
    m.h[i] = hh;
    const t = clamp(plate * (0.5 + rough1 * 0.9 + flake * 0.8), 0, 1);
    const c = t < 0.5 ? [lerp(o.deep[0], o.mid[0], t * 2), lerp(o.deep[1], o.mid[1], t * 2), lerp(o.deep[2], o.mid[2], t * 2)] : [lerp(o.mid[0], o.top[0], t * 2 - 1), lerp(o.mid[1], o.top[1], t * 2 - 1), lerp(o.mid[2], o.top[2], t * 2 - 1)];
    m.col(i, c, 0.9 + idr(id, 2) * 0.2 + pnoise(u * 150, v * 80, 150, 80, s + 7) * 0.16 - cross * 0.2);
    m.ro[i] = 0.93;
  });
}
// long interlacing vertical ridges split by deep furrows and short cross cracks
function txFurrowBark(m, s, o) {
  m.each((u, v, i) => {
    const warp = pfbm(u, v, 3, 2, 4, s) * 0.085 + pfbm(u, v, 11, 5, 3, s + 1) * 0.022;
    const w = pworley(u + warp, v + pfbm(u, v, 5, 4, 3, s + 2) * 0.07, o.ridges, 2, s + 3, 0.95);
    const e = w.f2 - w.f1, id = w.id;
    const ridge = sstep(0.015, 0.36, e);
    const fibre = pfbm(u + warp, v, 44, 5, 4, s + 4), grit = pnoise(u * 130, v * 70, 130, 70, s + 5);
    const braid = 1 - Math.abs(pnoise((u + warp * 1.7) * 15, v * 3, 15, 3, s + 6));
    const cross = sstep(0.055, 0.0, Math.abs(pnoise((u + warp) * 6, v * 17, 6, 17, s + 7))) * sstep(-0.05, 0.25, pfbm(u, v, 6, 6, 2, s + 8));
    let hh = 0.14 + Math.pow(ridge, 0.7) * 0.52 + (idr(id, 1) - 0.5) * 0.12 * ridge + braid * braid * 0.12 * ridge + fibre * 0.13 + grit * 0.03 - cross * 0.14 * ridge;
    m.h[i] = hh;
    const t = clamp(ridge * (0.52 + fibre * 0.9 + braid * 0.35), 0, 1);
    const c = t < 0.5 ? [lerp(o.deep[0], o.mid[0], t * 2), lerp(o.deep[1], o.mid[1], t * 2), lerp(o.deep[2], o.mid[2], t * 2)] : [lerp(o.mid[0], o.top[0], t * 2 - 1), lerp(o.mid[1], o.top[1], t * 2 - 1), lerp(o.mid[2], o.top[2], t * 2 - 1)];
    m.col(i, c, 0.92 + idr(id, 2) * 0.16 + grit * 0.15 - cross * 0.28);
    m.ro[i] = 0.93;
  });
}
function txRings(m, s, o) {
  m.each((u, v, i) => {
    const dx = u - 0.5, dy = v - 0.5;
    const ang = Math.atan2(dy, dx);
    const wob = pfbm(u, v, 3, 3, 3, s) * 0.055;
    const sq = Math.max(Math.abs(dx), Math.abs(dy)), rad = Math.hypot(dx, dy);
    const d = lerp(rad, sq, sstep(0.34, 0.56, rad) * 0.7) + wob;
    const rings = d * 34 + pnoise(d * 11, 0.3, 64, 4, s + 1) * 0.9;
    const f = rings - Math.floor(rings);
    const line = sstep(0.55, 0.9, f) * sstep(1, 0.9, f);
    const heart = sstep(0.26, 0.12, d);
    const grain = pnoise(u * 160, v * 160, 160, 160, s + 2);
    m.col(i, o.wood, 1 - line * 0.3 - heart * 0.2 + grain * 0.14);
    m.h[i] = 0.55 - line * 0.03 + grain * 0.02;
    // radial checking
    const ray = Math.abs(pnoise((ang / 6.2832 + 0.5) * 23, d * 4, 23, 8, s + 3));
    if (ray < 0.05 && d > 0.05 && pnoise(ang * 3, d * 9, 32, 16, s + 4) > 0.08) { m.mul(i, 0.62); m.h[i] -= 0.07; }
    m.ro[i] = 0.86;
    if (sq > 0.43 + wob * 0.25) {
      const bn = pfbm(u, v, 24, 24, 3, s + 5);
      m.col(i, o.bark, 0.85 + bn * 0.6); m.h[i] = 0.58 + bn * 0.2; m.ro[i] = 0.95;
    }
  });
}
// pointed leaf silhouette with midrib and veins
function txLeaf(m, r, cx, cy, ang, len, wid, color, layer, o = {}) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const lobes = o.lobes || 0, serr = o.serrate || 0;
  const mx = cx + c * len * 0.5, my = cy + s * len * 0.5;
  const phase = r() * 6.28, bend = (r() - 0.5) * 0.35;
  m.splat(mx, my, len * 0.5, wid * 1.25, ang, (i, a, b) => {
    const t = a * 0.5 + 0.5;
    const bb = b * 1.25 - bend * Math.sin(t * 3.1416);
    let hw = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, o.point || 0.8))), 0.78);
    if (lobes) hw *= 0.78 + 0.3 * Math.pow(Math.abs(Math.sin(t * Math.PI * lobes + 0.5)), 0.6);
    if (serr) hw *= 1 - serr * Math.abs(Math.sin(t * 38 + phase));
    if (Math.abs(bb) > hw || t < 0.02) return;
    const hh = layer + (1 - (bb * bb) / (hw * hw + 1e-4)) * 0.07 + (o.cup || 0) * Math.abs(bb);
    if (m.al[i] > 0.5 && hh < m.h[i] - 0.09) return;
    const mid = Math.abs(bb) < 0.07 * (1 - t * 0.7);
    const vein = Math.abs(((t * 6.5 - Math.abs(bb) * 2.2) % 1 + 1) % 1 - 0.5) < 0.07 && Math.abs(bb) < hw * 0.86;
    const side = bb > 0 ? 1.07 : 0.9;
    let k = side * (0.86 + t * 0.2) * (1 - 0.16 * Math.pow(Math.abs(bb) / (hw + 1e-3), 3));
    k *= 1 + pnoise(a * 5 + phase, b * 5, 32, 32, 9) * 0.14;
    let cr = color[0] * k, cg = color[1] * k, cb = color[2] * k;
    if (mid) { cr *= 1.28; cg *= 1.22; cb *= 1.05; } else if (vein) { cr *= 1.12; cg *= 1.1; }
    m.r[i] = cr; m.g[i] = cg; m.b[i] = cb; m.al[i] = 1; m.h[i] = hh; m.mk[i] = o.mask === undefined ? 1 : o.mask; m.ro[i] = o.rough || 0.62;
  }, false);
}
function txClearCard(m, c) { m.each((u, v, i) => { m.al[i] = 0; m.h[i] = 0.0; m.col(i, c); m.ro[i] = 0.8; m.mk[i] = 0; }); }
function txLeafCluster(m, s, o) {
  txClearCard(m, [90, 100, 80]);
  const r = mulberry32(s);
  // twigs
  const twigs = [];
  for (let k = 0; k < o.twigs; k++) {
    let a = (k / o.twigs) * 6.283 + r() * 0.9, x = 0.5 + (r() - 0.5) * 0.12, y = 0.5 + (r() - 0.5) * 0.12;
    const pts = [[x, y]]; const L = 0.2 + r() * 0.17;
    for (let j = 0; j < 4; j++) { a += (r() - 0.5) * 0.7; x += Math.cos(a) * L / 4; y += Math.sin(a) * L / 4; pts.push([x, y]); }
    twigs.push(pts);
    m.stroke(pts, 0.009, 0.002, (i, t, c) => { m.col(i, [92, 68, 46], 1 - Math.abs(c) * 0.3); m.al[i] = 1; m.h[i] = 0.18; m.mk[i] = 0; }, false);
  }
  const N = o.count;
  for (let k = 0; k < N; k++) {
    const z = k / N;
    let x, y, a;
    if (r() < 0.76) {
      const tw = twigs[(r() * twigs.length) | 0], j = 1 + ((r() * (tw.length - 1)) | 0);
      const t = r();
      x = lerp(tw[j - 1][0], tw[j][0], t) + (r() - 0.5) * 0.07; y = lerp(tw[j - 1][1], tw[j][1], t) + (r() - 0.5) * 0.07;
      a = Math.atan2(y - 0.5, x - 0.5) + (r() - 0.5) * 2.1;
    } else {
      const rr = Math.sqrt(r()) * 0.34, an = r() * 6.283;
      x = 0.5 + Math.cos(an) * rr; y = 0.5 + Math.sin(an) * rr; a = r() * 6.283;
    }
    const len = o.len[0] + r() * (o.len[1] - o.len[0]);
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    const dist = Math.hypot(ex - 0.5, ey - 0.5);
    let l2 = len; if (dist > 0.485) l2 = len * 0.55;
    const br = (0.55 + z * 0.55) * (0.84 + r() * 0.32);
    const base = o.colors[(r() * o.colors.length) | 0];
    txLeaf(m, r, x, y, a, l2, l2 * o.wid * (0.85 + r() * 0.3), [base[0] * br, base[1] * br, base[2] * br], 0.25 + z * 0.65, o);
  }
}

// ---------- per layer recipes: returns [normalStrength, aoStrength]
function paintLayer(name, m, s) {
  const S = m.S;
  switch (name) {
    case 'stone': txGranite(m, s, [[104, 101, 96], [142, 136, 126]]); txCracks(m, s + 20, 4, 0.045, 0.24, 0.45, 0.02); txCracks(m, s + 30, 11, 0.05, 0.07, 0.22, 0.1); txLichen(m, s + 40, [[150, 152, 124], [164, 138, 84], [196, 194, 180]], 0.4); return [3.4, 1.5];
    case 'limestone': {
      txStrata(m, s, [[180, 168, 144], [166, 153, 128], [192, 180, 156], [158, 148, 128]], 6, { warp: 0.9, pits: 0.28, ledge: 0.17, groove: 0.08 });
      txCracks(m, s + 20, 3, 0.03, 0.16, 0.34, 0.12); txLichen(m, s + 40, [[142, 140, 108], [120, 118, 106]], 0.46); return [3.2, 1.4];
    }
    case 'slate': {
      txStrata(m, s, [[74, 79, 88], [86, 90, 96], [64, 68, 76], [92, 88, 86]], 14, { warp: 1.5, wave: 0.3, ledge: 0.2, groove: 0.09, pits: 0.03, rough: 0.68 });
      txCracks(m, s + 21, 5, 0.04, 0.2, 0.4, -0.05); txLichen(m, s + 40, [[116, 122, 100]], 0.5); return [3.6, 1.6];
    }
    case 'basalt': {
      txGranite(m, s, [[44, 43, 44], [68, 65, 63]], { grain: 0.28 }); txCracks(m, s + 20, 5, 0.075, 0.28, 0.45, -0.1);
      m.each((u, v, i) => { const w = pworley(u, v, 34, 34, s + 31, 1); if (idr(w.id, 1) < 0.24 && w.f1 < 0.3) { const t = sstep(0.3, 0.12, w.f1); m.h[i] -= t * 0.13; m.mul(i, 1 - t * 0.35); } m.ro[i] = 0.74; });
      return [3.2, 1.5];
    }
    case 'sandstone': txStrata(m, s, [[188, 154, 108], [200, 168, 120], [172, 136, 94], [212, 186, 142], [180, 142, 98]], 9, { warp: 1.1, wave: 0.2, lam: 6, ledge: 0.13 }); txCracks(m, s + 22, 3, 0.022, 0.12, 0.26, 0.18); return [3.0, 1.3];
    case 'red_sandstone': txStrata(m, s, [[160, 84, 50], [176, 100, 62], [138, 68, 44], [188, 118, 76], [150, 76, 48]], 9, { warp: 1.0, wave: 0.18, lam: 6, ledge: 0.14 }); txCracks(m, s + 22, 3, 0.025, 0.14, 0.3, 0.12); return [3.0, 1.3];
    case 'pale_sandstone': txStrata(m, s, [[206, 188, 154], [218, 202, 170], [194, 172, 138], [224, 210, 182]], 8, { warp: 0.9, lam: 6, ledge: 0.1 }); return [2.8, 1.2];
    case 'terracotta': txStrata(m, s, [[162, 108, 68], [150, 96, 62], [174, 122, 76]], 5, { warp: 0.7, pits: 0.05, ledge: 0.06 }); txCracks(m, s + 23, 8, 0.05, 0.14, 0.3, -0.05); return [2.6, 1.3];
    case 'dirt': txDirt(m, s, [[78, 54, 36], [116, 86, 58]]); return [3.2, 1.5];
    case 'grass_top': txTurf(m, s); return [2.4, 1.5];
    case 'grass_side': case 'forest_side': {
      txDirt(m, s, [[78, 54, 36], [112, 82, 54]]);
      const r = mulberry32(s + 7), forest = name === 'forest_side';
      m.each((u, v, i) => {
        const edge = (forest ? 0.885 : 0.80) + pfbm(u, v, 9, 4, 3, s + 8) * 0.12;
        if (v > edge) { m.col(i, forest ? [78, 58, 32] : [92, 100, 80], 0.8 + pnoise(u * 90, v * 90, 90, 90, s) * 0.3); m.mk[i] = forest ? 0 : 1; m.h[i] = 0.72; }
      });
      if (!forest) {
        for (let k = 0; k < 520; k++) {
          const x = r(), y = 0.83 + r() * 0.18, br = 0.62 + r() * 0.62, lg = Math.pow(r(), 2.0);
          txBlade(m, r, x, Math.min(y, 0.997), -1.5708 + (r() - 0.5) * 0.95, 0.05 + lg * 0.34, 0.0048 + r() * 0.0044, (r() - 0.5) * 1.1, [(122 + r() * 26) * br, 136 * br, (108 - r() * 30) * br], 0.72 + k / 520 * 0.2, 0.66 + k / 520 * 0.2, 1);
        }
      } else {
        for (let k = 0; k < 150; k++) {
          const x = r(), y = 0.9 + r() * 0.09 - Math.pow(r(), 3) * 0.14;
          const col = [[128, 90, 48], [104, 78, 42], [142, 112, 60], [86, 66, 40]][(r() * 4) | 0];
          txLeaf(m, r, x, y, r() * 6.28, 0.04 + r() * 0.05, 0.016 + r() * 0.012, col, 0.7 + r() * 0.2, { mask: 0, rough: 0.8 });
        }
      }
      for (let i = 0; i < S * S; i++) m.al[i] = 1;
      return [3.0, 1.5];
    }
    case 'forest_top': {
      txDirt(m, s, [[56, 40, 26], [88, 64, 40]]);
      const r = mulberry32(s + 3);
      for (let k = 0; k < 280; k++) {
        const x = r(), y = r(), a = r() * 6.283, br = 0.65 + r() * 0.55;
        const col = [[132, 90, 48], [108, 80, 42], [150, 118, 62], [90, 68, 40], [102, 96, 50], [118, 72, 42]][(r() * 6) | 0];
        const len = 0.045 + r() * 0.06;
        m.splat(x + 0.006, y - 0.008, len * 0.5, len * 0.22, a, (i, p, q) => { if (p * p + q * q < 1) m.mul(i, 0.78); });
        const z = k / 280;
        const cx = x - Math.cos(a) * len * 0.5, cy = y - Math.sin(a) * len * 0.5;
        const ang = a;
        // wrapped copies keep the litter tileable
        for (const ox of [-1, 0, 1]) for (const oy of [-1, 0, 1]) {
          const px = cx + ox, py = cy + oy;
          if (px < -0.12 || px > 1.12 || py < -0.12 || py > 1.12) continue;
          const r2 = mulberry32(s + 500 + k);
          txLeaf(m, r2, px, py, ang, len, len * (0.34 + r2() * 0.16), [col[0] * br, col[1] * br, col[2] * br], 0.5 + z * 0.35, { mask: 0, rough: 0.78, lobes: r2() < 0.35 ? 4 : 0, cup: 0.04 });
        }
      }
      for (let k = 0; k < 260; k++) txBlade(m, r, r(), r(), r() * 6.28, 0.03 + r() * 0.07, 0.0017, (r() - 0.5) * 0.5, r() < 0.5 ? [146, 112, 66] : [74, 54, 34], 0.72 + r() * 0.2, 0.7 + r() * 0.22, 0);
      for (let i = 0; i < S * S; i++) { m.al[i] = 1; m.h[i] = 0.5 + (m.h[i] - 0.5) * 0.55; }
      return [1.7, 1.2];
    }
    case 'mud': {
      txDirt(m, s, [[46, 36, 25], [74, 58, 40]]);
      m.each((u, v, i) => { const low = sstep(0.5, 0.36, m.h[i] + pfbm(u, v, 4, 4, 4, s + 9) * 0.2); m.ro[i] = lerp(0.86, 0.34, low); m.h[i] = lerp(m.h[i], 0.38, low * 0.9); m.mul(i, 1 - low * 0.28); });
      return [2.2, 1.0];
    }
    case 'sand': case 'red_sand': {
      const base = name === 'sand' ? [[190, 156, 108], [216, 184, 132]] : [[158, 90, 52], [186, 112, 68]];
      m.each((u, v, i) => {
        const wp = pfbm(u, v, 3, 3, 3, s) * 0.75 + pfbm(u, v, 8, 8, 3, s + 1) * 0.18;
        const sc = (v * 11 + u * 2) + wp * 2.2;
        const f = sc - Math.floor(sc);
        const rip = f < 0.68 ? smooth01(f / 0.68) : smooth01((1 - f) / 0.32);
        const fade = clamp(0.6 + pfbm(u, v, 4, 4, 3, s + 2) * 1.3, 0.1, 1);
        const t = clamp(pfbm(u, v, 5, 5, 4, s + 3) + 0.5, 0, 1);
        m.col(i, [lerp(base[0][0], base[1][0], t), lerp(base[0][1], base[1][1], t), lerp(base[0][2], base[1][2], t)]);
        const g1 = (ihash((u * S) | 0, (v * S) | 0, s + 4) & 255) / 255 - 0.5;
        const g2 = pnoise(u * 128, v * 128, 128, 128, s + 5);
        let k = 1 + g1 * 0.17 + g2 * 0.09 + (rip - 0.5) * 0.07 * fade;
        const h3 = ihash((u * S / 2) | 0, (v * S / 2) | 0, s + 6) & 1023;
        if (h3 < 14) k *= 0.62; else if (h3 > 1008) k *= 1.22;
        m.mul(i, k);
        m.h[i] = 0.42 + rip * 0.2 * fade + g1 * 0.02 + g2 * 0.02 + pfbm(u, v, 6, 6, 4, s + 7) * 0.08;
        m.ro[i] = 0.93; m.mk[i] = h3 > 1015 ? 1 : 0;
      });
      txPebbles(m, s + 12, 40, 0.003, 0.011, [[225, 214, 192], [150, 126, 100], [120, 100, 82]], 0.55, 0.1, { dome: 0.06, mask: 0 });
      return [2.3, 0.7];
    }
    case 'gravel': {
      txDirt(m, s + 3, [[74, 62, 48], [104, 90, 70]]);
      m.each((u, v, i) => { m.h[i] *= 0.55; });
      const pal = [[124, 120, 114], [146, 138, 124], [108, 97, 84], [166, 158, 144], [96, 96, 100], [136, 112, 90], [116, 116, 108], [184, 178, 166]];
      txPebbles(m, s + 12, 620, 0.016, 0.036, pal, 0.18, 0.2, { dome: 0.3, rough: 0.74 });
      txPebbles(m, s + 13, 150, 0.026, 0.07, pal, 0.3, 0.22, { dome: 0.34, rough: 0.7 });
      txPebbles(m, s + 11, 520, 0.006, 0.017, [[140, 132, 118], [110, 100, 88], [165, 158, 145], [96, 80, 66]], 0.26, 0.28, { dome: 0.14, rough: 0.72 });
      return [3.2, 1.6];
    }
    case 'scree': {
      txRockCells(m, s, { fx: 8, fy: 9, warp: 0.07, gap: 0.04, round: 0.16, hvar: 0.42, facet: 0.55, mortar: [88, 80, 68], rough: 0.86, jit: 1, palette: [[138, 132, 120], [156, 148, 134], [116, 112, 104], [166, 160, 148], [128, 116, 100]] });
      txCracks(m, s + 4, 12, 0.05, 0.08, 0.2, 0.1); txPebbles(m, s + 11, 150, 0.008, 0.026, [[130, 124, 112], [150, 142, 126], [108, 102, 92]], 0.28, 0.2, { dome: 0.1 });
      return [3.2, 1.5];
    }
    case 'snow': {
      m.each((u, v, i) => {
        const a = pfbm(u, v, 3, 3, 5, s), b = pfbm(u, v, 14, 14, 4, s + 1), g = pnoise(u * 150, v * 150, 150, 150, s + 2);
        const rip = Math.sin((v * 7 + u * 3 + pfbm(u, v, 3, 3, 3, s + 5) * 1.5) * 6.2832) * 0.5 + 0.5;
        m.col(i, [220, 225, 233], 1 + a * 0.05 + g * 0.028 + b * 0.025);
        if (a < 0) m.mix(i, [196, 210, 230], -a * 1.2);
        m.h[i] = 0.5 + a * 0.22 + b * 0.07 + g * 0.018 + rip * 0.03;
        m.ro[i] = 0.62 + b * 0.18;
        m.mk[i] = (ihash((u * S) | 0, (v * S) | 0, s + 3) & 1023) > 1010 ? 1 : 0;
      });
      return [2.0, 0.55];
    }
    case 'snow_side': {
      txDirt(m, s, [[80, 58, 40], [112, 84, 58]]);
      m.each((u, v, i) => {
        const edge = 0.74 + pfbm(u, v, 5, 3, 4, s + 8) * 0.17 - Math.pow(Math.max(0, pnoise(u * 13, 0.5, 13, 4, s + 9)), 2) * 0.24;
        if (v > edge) {
          const g = pnoise(u * 110, v * 110, 110, 110, s + 1);
          const d = sstep(edge, edge + 0.07, v);
          m.col(i, [228, 233, 241], 0.9 + d * 0.1 + g * 0.03); m.h[i] = 0.62 + d * 0.16 + g * 0.02; m.ro[i] = 0.62;
        }
      });
      return [2.8, 1.2];
    }
    case 'ice': case 'packed_ice': {
      const packed = name === 'packed_ice';
      m.each((u, v, i) => {
        const a = pfbm(u, v, 3, 3, 5, s), frost = sstep(0.04, 0.34, pfbm(u, v, 5, 5, 5, s + 1));
        m.col(i, packed ? [138, 176, 208] : [128, 178, 208], 1 + a * 0.26);
        m.mix(i, [212, 230, 240], frost * (packed ? 0.62 : 0.5));
        let crack = 0;
        for (const [f, w, k] of [[3, 0.022, 1], [7, 0.026, 0.55], [13, 0.03, 0.3]]) {
          const wr = pworley(u + a * 0.12, v + pfbm(u, v, 4, 4, 3, s + 7) * 0.12, f, f, s + f, 1);
          const e = wr.f2 - wr.f1; if (e < w) crack = Math.max(crack, (1 - e / w) * k * sstep(-0.2, 0.2, pfbm(u, v, 5, 5, 3, s + f + 4)));
        }
        m.mix(i, [232, 246, 252], crack * 0.85);
        const bub = pworley(u, v, 46, 46, s + 30);
        if (idr(bub.id, 1) < 0.06 && bub.f1 < 0.16) m.mix(i, [236, 248, 255], 0.6);
        m.h[i] = 0.55 + a * 0.05 + frost * 0.025 - crack * 0.02;
        m.ro[i] = 0.06 + frost * (packed ? 0.55 : 0.4) + crack * 0.2;
      });
      return [1.6, 0.3];
    }
    case 'clay': txDirt(m, s, [[134, 128, 120], [156, 150, 140]]); m.each((u, v, i) => { m.h[i] = lerp(m.h[i], 0.4, 0.7); m.mix(i, [145, 139, 130], 0.55); m.ro[i] = 0.7; }); txCracks(m, s + 5, 6, 0.04, 0.12, 0.28, 0.0); return [2.2, 1.2];
    case 'moss': {
      m.each((u, v, i) => { m.col(i, [48, 60, 24], 1 + pfbm(u, v, 6, 6, 4, s) * 0.5); m.h[i] = 0.2; m.ro[i] = 0.97; });
      txPebbles(m, s + 1, 240, 0.02, 0.06, [[66, 86, 30], [82, 100, 34], [56, 72, 28]], 0.22, 0.2, { dome: 0.22, rough: 0.97 });
      txPebbles(m, s + 2, 2600, 0.004, 0.011, [[86, 110, 36], [108, 130, 44], [74, 96, 32], [128, 140, 52], [66, 82, 30]], 0.4, 0.34, { dome: 0.12, rough: 0.97 });
      return [2.8, 1.6];
    }
    case 'cobble': case 'mossy_cobble': {
      txRockCells(m, s, { fx: 5, fy: 6, warp: 0.07, gap: 0.075, round: 0.38, hvar: 0.18, facet: 0.15, mortar: [84, 76, 62], rough: 0.8, jit: 0.8, palette: [[132, 126, 116], [148, 140, 128], [112, 108, 102], [152, 134, 112], [124, 124, 124]] });
      txCracks(m, s + 4, 9, 0.035, 0.06, 0.2, 0.2);
      if (name === 'mossy_cobble') {
        m.each((u, v, i) => {
          const mo = sstep(-0.05, 0.18, pfbm(u, v, 4, 4, 5, s + 9) + (0.45 - m.h[i]) * 0.7);
          if (mo > 0) { const f = pnoise(u * 90, v * 90, 90, 90, s + 10), f2 = pfbm(u, v, 30, 30, 2, s + 11); m.mix(i, [(78 + f2 * 50), (100 + f2 * 52), 36], mo * clamp(0.85 + f * 0.4, 0, 1)); m.h[i] += mo * (0.05 + f * 0.05); m.ro[i] = lerp(m.ro[i], 0.97, mo); }
        });
      } else txLichen(m, s + 40, [[152, 154, 128], [160, 136, 90]], 0.47);
      return [3.6, 1.6];
    }
    case 'stone_bricks': case 'furnace_side': case 'furnace_front': {
      const fur = name !== 'stone_bricks';
      txGranite(m, s, fur ? [[92, 88, 82], [122, 116, 106]] : [[124, 120, 112], [154, 148, 136]], { grain: 0.55 });
      const rows = fur ? 4 : 2;
      m.each((u, v, i) => {
        const row = Math.floor(v * rows), fv = v * rows - row;
        const off = (row % 2) * (fur ? 0.27 : 0.5) + (fur ? rand01(row, 3, 0, s) * 0.2 : 0);
        const cols = fur ? 2 : 1;
        const uu = (u + off) * cols, ci = Math.floor(uu) % cols, fu = uu - Math.floor(uu);
        const tone = 0.86 + rand01(row, ci, 7, s) * 0.26;
        const wear = pfbm(u, v, 14, 14, 4, s + 8) * 0.016 + pfbm(u, v, 40, 40, 2, s + 18) * 0.007;
        const d = Math.min(fu / cols, (1 - fu) / cols, fv / rows, (1 - fv) / rows) + wear;
        const face = sstep(0.008, 0.017, d), bevel = sstep(0.012, 0.055, d);
        const chisel = Math.abs(pnoise((u + v) * 46, (u - v) * 9, 46, 9, s + 9));
        const base = m.h[i] - 0.5;
        m.h[i] = lerp(0.2 + base * 0.15, 0.5 + bevel * 0.22 + base * 0.42 - (chisel < 0.12 ? 0.02 : 0) + (rand01(row, ci, 9, s) - 0.5) * 0.08, face);
        m.mul(i, tone);
        if (face < 1) { m.mix(i, [96, 90, 78], 1 - face); m.ro[i] = 0.97; }
      });
      txCracks(m, s + 30, 3, 0.022, 0.12, 0.32, 0.18);
      if (!fur) txLichen(m, s + 40, [[146, 148, 122]], 0.52, 0.01);
      if (name === 'furnace_side') m.each((u, v, i) => { const soot = sstep(0.55, 1.0, v + pfbm(u, v, 6, 6, 4, s + 50) * 0.35); m.mix(i, [24, 21, 19], soot * 0.75); });
      if (name === 'furnace_front') {
        m.each((u, v, i) => {
          const dx = (u - 0.5) / 0.3, arch = v < 0.42 ? Math.abs(dx) : Math.hypot(dx, (v - 0.42) / 0.2);
          const soot = sstep(1.75, 1.0, Math.hypot((u - 0.5) / 0.33, (v - 0.55) / 0.3) + pfbm(u, v, 7, 7, 4, s + 51) * 0.5);
          m.mix(i, [22, 19, 17], soot * 0.8);
          if (v > 0.12 && arch < 1.22 && v < 0.7) {
            const rim = sstep(1.0, 1.06, arch) + sstep(0.19, 0.16, v);
            if (rim > 0.001) { m.col(i, [118, 108, 94], 0.7 + pfbm(u, v, 20, 20, 3, s + 52) * 0.5); m.h[i] = 0.8 - Math.abs(arch - 1.11) * 0.5; m.ro[i] = 0.9; m.mix(i, [30, 26, 22], soot * 0.45); }
            else {
              const coal = pworley(u, v, 17, 24, s + 53);
              const bed = sstep(0.34, 0.2, v + pfbm(u, v, 12, 12, 3, s + 54) * 0.07);
              m.col(i, [14, 11, 10]); m.h[i] = 0.06; m.ro[i] = 1;
              if (bed > 0) { const hot = sstep(0.36, 0.02, coal.f2 - coal.f1) * 0.75 + (idr(coal.id, 2) > 0.62 ? 0.35 : 0); m.mix(i, [255, 112, 22], bed * clamp(hot, 0, 1)); m.em[i] = bed * clamp(hot * 1.1, 0, 1); m.h[i] = 0.12 + (1 - coal.f1) * 0.15 * bed; }
              const tongue = Math.max(0, pfbm(u, v, 12, 7, 3, s + 55) + 0.25) * sstep(0.56, 0.26, v) * sstep(0.9, 0.35, Math.abs(dx));
              m.em[i] = Math.max(m.em[i], tongue * 0.75); m.mix(i, [255, 150, 40], clamp(tongue * 1.2, 0, 0.85));
            }
          }
        });
      }
      return [3.4, 1.5];
    }
    case 'clay_bricks': {
      txDirt(m, s, [[168, 158, 142], [188, 178, 160]]);
      m.each((u, v, i) => {
        const rows = 5, row = Math.floor(v * rows), fv = v * rows - row;
        const uu = u * 2 + (row % 2) * 0.5, ci = Math.floor(uu) % 2, fu = uu - Math.floor(uu);
        const wear = pfbm(u, v, 18, 18, 4, s + 8) * 0.012;
        const d = Math.min(fu / 2, (1 - fu) / 2, fv / rows, (1 - fv) / rows) + wear;
        const face = sstep(0.009, 0.016, d);
        if (face > 0) {
          const k = rand01(row, ci, 3, s);
          const col = k < 0.35 ? [150, 74, 52] : k < 0.65 ? [166, 88, 58] : k < 0.85 ? [128, 64, 48] : [172, 106, 72];
          const grain = pnoise(u * 150, v * 150, 150, 150, s + 2), blot = pfbm(u, v, 9, 9, 4, s + 3 + ci);
          const c = [col[0] * (1 + grain * 0.14 + blot * 0.24), col[1] * (1 + grain * 0.14 + blot * 0.24), col[2] * (1 + grain * 0.12 + blot * 0.2)];
          m.mix(i, c, face);
          m.h[i] = lerp(m.h[i] * 0.5, 0.62 + sstep(0.012, 0.04, d) * 0.12 + grain * 0.025 + blot * 0.08, face);
          m.ro[i] = lerp(0.97, 0.82, face);
          const pit = pworley(u, v, 40, 40, s + 12);
          if (idr(pit.id, 1) < 0.1 && pit.f1 < 0.22) { m.h[i] -= 0.08; m.mul(i, 0.75); }
        } else m.h[i] *= 0.6;
      });
      return [3.2, 1.5];
    }
    case 'oak_planks': txWood(m, s, [158, 119, 74]); return [2.8, 1.2];
    case 'birch_planks': txWood(m, s, [194, 168, 124], { rings: 6 }); return [2.4, 1.1];
    case 'pine_planks': txWood(m, s, [128, 88, 54], { rings: 9 }); return [2.8, 1.2];
    case 'chest_wood': txWood(m, s, [118, 78, 44], { boards: 5, rings: 8, rough: 0.62 }); m.each((u, v, i) => { const e = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)); m.mul(i, 1 - sstep(0.36, 0.5, e + pfbm(u, v, 8, 8, 3, s + 3) * 0.1) * 0.35); }); return [2.6, 1.2];
    case 'oak_bark': txFurrowBark(m, s, { ridges: 7, deep: [34, 25, 17], mid: [78, 62, 45], top: [126, 111, 92] }); txLichen(m, s + 40, [[112, 126, 88]], 0.46, 0.012); return [4.4, 1.6];
    case 'pine_bark': txBarkPlates(m, s, { fx: 9, fy: 3, warp: 0.045, furrow: 0.13, flake: 0.3, deep: [46, 31, 23], mid: [92, 62, 46], top: [126, 94, 74] }); txLichen(m, s + 40, [[122, 130, 112]], 0.46, 0.012); return [3.2, 1.3];
    case 'cypress_bark': txBarkPlates(m, s, { fx: 15, fy: 2, warp: 0.045, furrow: 0.22, flake: 0.08, deep: [48, 38, 30], mid: [106, 92, 76], top: [152, 138, 118] }); txLichen(m, s + 40, [[96, 118, 62]], 0.34, 0.02); return [3.8, 1.6];
    case 'birch_bark': {
      // papery cream bark: peeling horizontal layers, dark lenticels, chevron branch scars, weathered patches
      m.each((u, v, i) => {
        const a = pfbm(u, v, 3, 5, 5, s), b = pfbm(u, v, 34, 80, 2, s + 1);
        const warp = pfbm(u, v, 3, 3, 3, s + 11) * 0.05;
        m.col(i, [172, 166, 153], 1 + a * 0.2 + b * 0.1);
        m.mix(i, [158, 136, 108], sstep(0.04, 0.3, pfbm(u, v + warp, 2, 7, 4, s + 2)) * 0.65);
        m.mix(i, [112, 112, 104], sstep(0.12, 0.34, pfbm(u, v, 3, 3, 4, s + 12)) * 0.6);
        const layers = pfbm(u, v + warp, 2, 13, 3, s + 3) * 3.4 + (v + warp) * 9;
        const f = layers - Math.floor(layers);
        const lip = sstep(0.86, 1.0, f), shade = sstep(0.14, 0.0, f);
        const saw = f < 0.82 ? f / 0.82 : 1 - smooth01((f - 0.82) / 0.18);
        m.h[i] = 0.5 + saw * 0.085 + a * 0.08 + b * 0.025;
        m.mul(i, 1 + lip * 0.035 - shade * 0.24);
        m.ro[i] = 0.68;
        const patchN = sstep(0.2, 0.33, pfbm(u + warp, v, 4, 3, 4, s + 6));
        if (patchN > 0) { const g = pfbm(u, v, 26, 38, 3, s + 7); m.mix(i, [46, 40, 33], patchN * (0.75 + g * 0.6)); m.h[i] -= patchN * 0.16 * (1 + g); m.ro[i] = 0.95; }
        const crack = sstep(0.05, 0.0, Math.abs(pnoise(u * 5 + warp * 24, v * 2, 5, 2, s + 8))) * sstep(0.0, 0.25, pfbm(u, v, 3, 2, 2, s + 9));
        if (crack > 0) { m.mix(i, [58, 50, 42], crack * 0.8); m.h[i] -= crack * 0.12; }
      });
      const r = mulberry32(s + 4);
      for (let k = 0; k < 96; k++) {
        const x = r(), y = r(), len = 0.018 + Math.pow(r(), 1.7) * 0.13, th = 0.0055 + r() * 0.011, tone = 0.8 + r() * 0.4;
        m.splat(x, y, len, th, (r() - 0.5) * 0.1, (i, p, q) => { const d = p * p + q * q; if (d < 1) { const w = clamp((1 - d) * 2.2, 0, 1); m.mix(i, [52 * tone, 43 * tone, 34 * tone], w * 0.94); m.h[i] += (Math.abs(q) > 0.5 ? 0.04 : -0.09) * w; m.ro[i] = 0.9; } });
      }
      // branch scars: dark eyes with upswept brows
      for (let k = 0; k < 3; k++) {
        const x = (k + 0.2 + r() * 0.6) / 3, y = r(), sz = 0.045 + r() * 0.04;
        m.splat(x, y, sz * 0.7, sz * 0.5, 0, (i, p, q) => { const d = p * p + q * q; if (d < 1) { m.mix(i, [34, 27, 21], clamp((1 - d) * 2.4, 0, 1)); m.h[i] = lerp(m.h[i], 0.3 + d * 0.3, 0.8); m.ro[i] = 0.95; } });
        for (const side of [-1, 1]) m.stroke([[x, y + sz * 0.35], [x + side * sz * 1.1, y + sz * 0.62], [x + side * sz * 2.1, y + sz * 0.2]], sz * 0.22, 0.002, (i, t, c) => { m.mix(i, [44, 35, 27], 0.9 - t * 0.35); m.h[i] += (1 - Math.abs(c)) * 0.1 * (1 - t); m.ro[i] = 0.92; });
      }
      return [4.4, 1.7];
    }
    case 'rosewood_bark': {
      txBarkPlates(m, s, { fx: 3, fy: 9, warp: 0.05, furrow: 0.07, flake: 0.05, deep: [50, 28, 26], mid: [96, 56, 50], top: [128, 82, 72] });
      const r = mulberry32(s + 4);
      for (let k = 0; k < 120; k++) m.splat(r(), r(), 0.015 + r() * 0.05, 0.003 + r() * 0.004, (r() - 0.5) * 0.1, (i, a, b) => { if (a * a + b * b < 1) { m.mix(i, [168, 130, 112], 0.6); m.h[i] += 0.03; } });
      m.each((u, v, i) => { m.ro[i] = 0.62; });
      return [3.0, 1.4];
    }
    case 'oak_end': txRings(m, s, { wood: [170, 130, 82], bark: [78, 62, 46] }); return [2.4, 1.2];
    case 'birch_end': txRings(m, s, { wood: [200, 174, 128], bark: [186, 180, 166] }); return [2.4, 1.2];
    case 'pine_end': txRings(m, s, { wood: [178, 128, 80], bark: [94, 60, 42] }); return [2.4, 1.2];
    case 'rosewood_end': txRings(m, s, { wood: [172, 102, 80], bark: [92, 52, 46] }); return [2.4, 1.2];
    case 'cypress_end': txRings(m, s, { wood: [160, 124, 90], bark: [100, 86, 72] }); return [2.4, 1.2];
    case 'cactus_side': {
      m.each((u, v, i) => {
        const rib = Math.abs(Math.sin(u * Math.PI * 6));
        const f = pfbm(u, v, 12, 12, 4, s), g = pnoise(u * 100, v * 100, 100, 100, s + 1);
        m.col(i, [70, 102, 56], 0.72 + rib * 0.42 + f * 0.22 + g * 0.07);
        m.mix(i, [128, 136, 82], sstep(0.15, 0.4, pfbm(u, v, 5, 5, 4, s + 3)) * 0.4);
        m.h[i] = 0.22 + Math.pow(rib, 0.6) * 0.6 + f * 0.05; m.ro[i] = 0.55;
      });
      const r = mulberry32(s + 5);
      for (let k = 0; k < 6; k++) for (let j = 0; j < 6; j++) {
        const x = (k + 0.5) / 6, y = (j + 0.5 + (k % 2) * 0.5) / 6 + (r() - 0.5) * 0.04;
        m.splat(x, y, 0.016, 0.02, 0, (i, a, b) => { if (a * a + b * b < 1) { m.col(i, [188, 168, 124], 0.8 + r() * 0.3); m.h[i] = 0.88; m.ro[i] = 0.95; } });
        for (let q = 0; q < 7; q++) { const an = r() * 6.28; m.stroke([[x, y], [x + Math.cos(an) * (0.025 + r() * 0.035), y + Math.sin(an) * (0.025 + r() * 0.035)]], 0.0024, 0.0006, (i) => { m.col(i, [226, 212, 172]); m.h[i] = 0.94; }); }
      }
      return [3.0, 1.3];
    }
    case 'cactus_top': {
      m.each((u, v, i) => {
        const dx = u - 0.5, dy = v - 0.5, a = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
        const rib = Math.abs(Math.sin(a * 6));
        m.col(i, [84, 112, 62], 0.78 + rib * 0.3 + pfbm(u, v, 12, 12, 4, s) * 0.2);
        m.mix(i, [170, 160, 110], sstep(0.14, 0.02, d));
        m.h[i] = 0.35 + rib * 0.35 * sstep(0.05, 0.2, d) + (0.5 - d) * 0.3; m.ro[i] = 0.6;
      });
      return [2.8, 1.3];
    }
    case 'coral_pink': case 'coral_orange': case 'coral_violet': {
      const base = name === 'coral_pink' ? [206, 104, 124] : name === 'coral_orange' ? [214, 122, 52] : [128, 82, 168];
      m.each((u, v, i) => {
        const wu = u + pfbm(u, v, 4, 4, 3, s) * 0.14, wv = v + pfbm(u, v, 4, 4, 3, s + 1) * 0.14;
        let hh, k;
        if (name === 'coral_orange') { const w = pworley(wu, wv, 12, 12, s + 2, 0.7); const hole = sstep(0.14, 0.26, w.f1), lip = sstep(0.48, 0.26, w.f1); hh = 0.18 + hole * (0.34 + lip * 0.34); k = 0.45 + hole * 0.5 + lip * 0.3; }
        else if (name === 'coral_pink') { const n = pfbm(wu, wv, 5, 5, 3, s + 2); const gv = Math.abs(Math.sin(n * 24)); hh = 0.25 + Math.pow(gv, 0.5) * 0.5; k = 0.55 + gv * 0.55; }
        else { const w = pworley(wu, wv, 9, 9, s + 2, 0.9); const d = 1 - clamp(w.f1 * 1.4, 0, 1); hh = 0.2 + Math.sqrt(d) * 0.6; k = 0.6 + d * 0.65; }
        const g = pnoise(u * 90, v * 90, 90, 90, s + 3);
        m.col(i, base, k * (1 + g * 0.16 + pfbm(u, v, 3, 3, 3, s + 4) * 0.3)); m.h[i] = hh + g * 0.025; m.ro[i] = 0.72;
      });
      return [3.2, 1.5];
    }
    case 'coal_ore': case 'copper_ore': case 'iron_ore': case 'gold_ore': case 'azurite_ore': case 'ember_ore': {
      const deep = name === 'azurite_ore' || name === 'ember_ore' || name === 'gold_ore';
      if (deep) { txStrata(m, s + 1, [[74, 79, 86], [84, 86, 92], [66, 68, 76]], 11, { warp: 1.4, ledge: 0.14, pits: 0.02, rough: 0.74 }); txCracks(m, s + 21, 5, 0.045, 0.16, 0.34, 0.0); }
      else { txGranite(m, s + 1, [[102, 99, 94], [136, 130, 121]]); txCracks(m, s + 20, 4, 0.04, 0.18, 0.4, 0.06); }
      const r = mulberry32(s + 2);
      const clusters = [];
      for (let k = 0; k < 9; k++) clusters.push([(k % 3 + 0.18 + r() * 0.64) / 3, (Math.floor(k / 3) + 0.18 + r() * 0.64) / 3, 0.07 + r() * 0.09, r() * 3.14]);
      m.each((u, v, i) => {
        let best = 0;
        const wob = pfbm(u, v, 9, 9, 4, s + 3) * 0.07;
        for (const c of clusters) {
          let dx = u - c[0], dy = v - c[1]; dx -= Math.round(dx); dy -= Math.round(dy);
          const ca = Math.cos(c[3]), sa = Math.sin(c[3]);
          const a = dx * ca + dy * sa, b = -dx * sa + dy * ca;
          const d = Math.hypot(a * 0.75, b * 1.3) + wob;
          best = Math.max(best, sstep(c[2], c[2] * 0.45, d));
        }
        // stain halo around the lode
        let halo = 0;
        for (const c of clusters) { let dx = u - c[0], dy = v - c[1]; dx -= Math.round(dx); dy -= Math.round(dy); halo = Math.max(halo, sstep(c[2] * 2.1, c[2] * 0.7, Math.hypot(dx, dy) + wob * 1.6)); }
        const blot = pfbm(u, v, 17, 17, 4, s + 6);
        if (name === 'copper_ore' && halo > 0) m.mix(i, [72, 142, 116], halo * sstep(-0.05, 0.25, blot) * 0.85);
        if (name === 'iron_ore' && halo > 0) m.mix(i, [134, 74, 40], halo * sstep(-0.2, 0.3, blot) * 0.82);
        if (name === 'coal_ore' && halo > 0) m.mul(i, 1 - halo * 0.25);
        if (name === 'ember_ore' && halo > 0) { m.mix(i, [96, 40, 26], halo * 0.45); m.em[i] = sstep(0.1, 0.35, blot) * halo * 0.08; }
        if (name === 'azurite_ore' && halo > 0) m.mix(i, [62, 90, 124], halo * 0.4);
        if (best <= 0) return;
        const big = name === 'azurite_ore' || name === 'ember_ore' || name === 'coal_ore';
        const w = pworley(u, v, big ? 21 : 32, big ? 21 : 32, s + 4, 0.95);
        if (idr(w.id, 1) > best * (name === 'gold_ore' ? 0.78 : 0.95)) return;
        const e = w.f2 - w.f1;
        const body = sstep(0.04, 0.14, e);
        if (body <= 0) return;
        const tone = 0.62 + idr(w.id, 2) * 0.66;
        const facet = (w.cx * (idr(w.id, 3) - 0.5) + w.cy * (idr(w.id, 4) - 0.5));
        let col, rough = 0.4, metal = 0, emis = 0, rise = 0.12;
        if (name === 'coal_ore') { col = [26, 26, 30]; rough = 0.18 + idr(w.id, 5) * 0.25; metal = 0.16; }
        else if (name === 'copper_ore') { col = idr(w.id, 6) < 0.74 ? [214, 124, 76] : [88, 168, 138]; rough = col[0] > 150 ? 0.34 : 0.75; metal = col[0] > 150 ? 0.95 : 0.05; }
        else if (name === 'iron_ore') { col = idr(w.id, 6) < 0.6 ? [172, 152, 138] : [150, 92, 56]; rough = col[1] > 120 ? 0.36 : 0.85; metal = col[1] > 120 ? 0.9 : 0.15; }
        else if (name === 'gold_ore') { col = [244, 196, 82]; rough = 0.24 + idr(w.id, 5) * 0.16; metal = 1; }
        else if (name === 'azurite_ore') { col = [64, 150, 228]; rough = 0.08; metal = 0.25; emis = 0.12 + Math.max(0, facet) * 0.9 + (idr(w.id, 7) > 0.7 ? 0.2 : 0); rise = 0.2; }
        else { col = [240, 92, 34]; rough = 0.12; metal = 0.15; emis = 0.28 + Math.max(0, facet) * 1.2 + (idr(w.id, 7) > 0.65 ? 0.3 : 0); rise = 0.19; }
        const glint = big ? 1 + facet * 0.5 : 1 + pnoise(u * 110, v * 110, 110, 110, s + 8) * 0.2;
        m.mix(i, [col[0] * tone * glint, col[1] * tone * glint, col[2] * tone * glint], body);
        m.h[i] = lerp(m.h[i], 0.56 + rise * body + facet * 0.22, body);
        m.ro[i] = lerp(m.ro[i], rough, body); m.me[i] = metal * body; if (emis) m.em[i] = clamp(emis * body, 0, 1);
      });
      return [3.4, 1.5];
    }
    case 'bedrock': txRockCells(m, s, { fx: 6, fy: 6, warp: 0.13, gap: 0.03, round: 0.3, hvar: 0.5, facet: 0.4, mortar: [18, 18, 20], rough: 0.7, jit: 1, palette: [[44, 44, 48], [66, 64, 66], [28, 28, 32], [88, 84, 80]] }); return [3.6, 1.7];
    case 'obsidian': {
      m.each((u, v, i) => {
        const wu = u + pfbm(u, v, 3, 3, 4, s) * 0.16, wv = v + pfbm(u, v, 3, 3, 4, s + 1) * 0.16;
        const w = pworley(wu, wv, 4, 4, s + 2, 1);
        const arcs = Math.sin(w.f1 * 38 + idr(w.id, 1) * 6) * sstep(0.1, 0.4, w.f1);
        m.col(i, [20, 17, 26], 1 + pfbm(u, v, 8, 8, 4, s + 3) * 0.5);
        m.mix(i, [72, 54, 104], sstep(0.55, 1, arcs) * 0.35);
        m.h[i] = 0.5 + arcs * 0.035 + (w.cx * (idr(w.id, 3) - 0.5) + w.cy * (idr(w.id, 4) - 0.5)) * 0.25;
        m.ro[i] = 0.07 + Math.max(0, pfbm(u, v, 14, 14, 3, s + 4)) * 0.25;
      });
      return [2.6, 0.8];
    }
    case 'thatch': {
      m.each((u, v, i) => { m.col(i, [86, 76, 52], 1 + pfbm(u, v, 20, 4, 3, s) * 0.5); m.h[i] = 0.2; m.ro[i] = 0.95; });
      const r = mulberry32(s + 1);
      for (let row = 0; row < 4; row++) for (let k = 0; k < 420; k++) {
        const x = r(), y = (row + 0.98 - r() * 0.45) / 4, br = 0.62 + r() * 0.6;
        const col = r() < 0.2 ? [118 * br, 108 * br, 82 * br] : [176 * br, 163 * br, 122 * br];
        txBlade(m, r, x, y, -1.5708 + (r() - 0.5) * 0.4, 0.13 + r() * 0.14, 0.0028 + r() * 0.003, (r() - 0.5) * 0.3, col, 0.72 + r() * 0.15, 0.34 + r() * 0.2, 0, true, 0.9);
      }
      for (let i = 0; i < S * S; i++) m.al[i] = 1;
      return [3.2, 1.7];
    }
    case 'glass': {
      m.each((u, v, i) => {
        const edge = Math.min(u, 1 - u, v, 1 - v);
        const streak = sstep(0.16, 0.5, pfbm(u * 1, v, 2, 2, 4, s) + pnoise((u + v) * 9, (u - v) * 2, 9, 2, s + 1) * 0.25);
        const bub = pworley(u, v, 11, 11, s + 2);
        const bb = idr(bub.id, 1) < 0.12 ? sstep(0.075, 0.045, bub.f1) : 0;
        m.col(i, [206, 228, 228]); m.al[i] = 0.035 + streak * 0.075 + bb * 0.3; m.ro[i] = 0.03 + streak * 0.14;
        m.h[i] = 0.5 + pfbm(u, v, 4, 4, 3, s + 3) * 0.08 + bb * 0.06;
        if (edge < 0.048) { const b = sstep(0.048, 0.03, edge); m.col(i, [74, 70, 64], 1 + pnoise(u * 80, v * 80, 80, 80, s) * 0.2); m.al[i] = b > 0 ? 1 : 0.2; m.ro[i] = 0.45; m.me[i] = 0.75; m.h[i] = 0.75 - Math.abs(edge - 0.024) * 4; }
      });
      return [1.8, 0.5];
    }
    case 'lamp': {
      m.each((u, v, i) => {
        const edge = Math.min(u, 1 - u, v, 1 - v), cross = Math.min(Math.abs(u - 0.5), Math.abs(v - 0.5));
        const glow = Math.exp(-((u - 0.5) ** 2 + (v - 0.5) ** 2) * 5.5);
        const fr = pfbm(u, v, 9, 9, 4, s);
        m.col(i, [255, 196, 118], 0.82 + glow * 0.18 + fr * 0.14); m.em[i] = clamp(0.26 + glow * 0.74 + fr * 0.14, 0, 1); m.ro[i] = 0.18; m.h[i] = 0.4 + fr * 0.03;
        if (edge < 0.085 || cross < 0.022) { const g = pnoise(u * 70, v * 70, 70, 70, s + 1); m.col(i, [58, 50, 42], 1 + g * 0.2); m.em[i] = 0; m.me[i] = 0.8; m.ro[i] = 0.48; m.h[i] = edge < 0.085 ? 0.8 - Math.abs(edge - 0.042) * 3 : 0.68; }
      });
      for (const [x, y] of [[0.043, 0.043], [0.957, 0.043], [0.043, 0.957], [0.957, 0.957], [0.5, 0.043], [0.5, 0.957], [0.043, 0.5], [0.957, 0.5]]) m.splat(x, y, 0.018, 0.018, 0, (i, a, b) => { const d = a * a + b * b; if (d < 1) { m.h[i] = 0.82 + (1 - d) * 0.12; m.col(i, [104, 92, 74]); } });
      return [3.0, 1.0];
    }
    case 'iron': {
      m.each((u, v, i) => {
        const brush = pfbm(u, v, 3, 150, 3, s), big = pfbm(u, v, 4, 4, 5, s + 1);
        const w = pworley(u, v, 9, 9, s + 2, 0.9);
        const rust = sstep(0.34, 0.52, pfbm(u, v, 6, 6, 5, s + 3));
        m.col(i, [168, 168, 170], 0.95 + brush * 0.06 + big * 0.16);
        m.mix(i, [122, 86, 62], rust * 0.5);
        m.h[i] = 0.5 + brush * 0.015 - (1 - clamp(w.f1 * 1.5, 0, 1)) * 0.07 + rust * 0.02;
        m.me[i] = 1 - rust * 0.7; m.ro[i] = 0.31 + big * 0.12 + rust * 0.4 + brush * 0.04;
      });
      return [2.4, 0.8];
    }
    case 'table_top': {
      txWood(m, s, [150, 110, 68], { boards: 5, rings: 6, rough: 0.6 });
      m.each((u, v, i) => {
        const e = Math.min(u, 1 - u, v, 1 - v);
        if (e < 0.085) { const g = pfbm(u, v, 40, 6, 3, s + 2); m.col(i, [96, 64, 38], 1 + g * 0.35); m.h[i] = 0.76 - sstep(0.07, 0.085, e) * 0.1; }
        const gx = Math.abs(((u - 0.17) / 0.22) - Math.round((u - 0.17) / 0.22)) * 0.22, gy = Math.abs(((v - 0.17) / 0.22) - Math.round((v - 0.17) / 0.22)) * 0.22;
        if (u > 0.16 && u < 0.84 && v > 0.16 && v < 0.84 && Math.min(gx, gy) < 0.007) { m.mul(i, 0.52); m.h[i] -= 0.16; }
        const burn = sstep(0.34, 0.5, pfbm(u, v, 5, 5, 4, s + 9)); m.mul(i, 1 - burn * 0.3);
      });
      const r = mulberry32(s + 3);
      for (let k = 0; k < 60; k++) { const x = r(), y = r(), a = r() * 3.14, l = 0.02 + r() * 0.11; m.stroke([[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]], 0.0014, 0.0005, (i) => { m.mul(i, r() < 0.5 ? 0.82 : 1.012); m.h[i] -= 0.008; }); }
      return [3.0, 1.3];
    }
    case 'table_side': {
      txWood(m, s, [134, 96, 58], { boards: 3 });
      m.each((u, v, i) => {
        if (v > 0.8 || v < 0.1) { m.mul(i, 0.72); m.h[i] += 0.1; }
        if (Math.abs(u - 0.5) < 0.012) { m.mul(i, 0.5); m.h[i] -= 0.18; }
        for (const cx of [0.25, 0.75]) { const d = Math.hypot(u - cx, (v - 0.46) * 1.4); if (d < 0.05 && d > 0.026) { m.col(i, [70, 64, 58]); m.me[i] = 0.9; m.ro[i] = 0.4; m.h[i] = 0.86; } }
      });
      return [3.0, 1.3];
    }
    case 'door': {
      // painted for a 1 x 2 leaf: v spans both halves
      txWood(m, s, [128, 90, 54], { boards: 1, rings: 18 });
      m.each((u, v, i) => {
        const pl = u * 4, fp = pl - Math.floor(pl);
        const tone = 0.84 + rand01(Math.floor(pl), 1, 0, s) * 0.3;
        const fibre = pfbm(v, u, 6, 190, 3, s + 4), ring = pfbm(v, u, 3, 22, 4, s + 6);
        const t = u * 30 + pfbm(v, u, 2, 7, 3, s + 7) * 1.6; const line = sstep(0.6, 0.92, t - Math.floor(t)) * sstep(1, 0.92, t - Math.floor(t));
        m.col(i, [132, 94, 58], tone * (1 + fibre * 0.18 + ring * 0.2 - line * 0.24)); m.h[i] = 0.62 + fibre * 0.04 - line * 0.02; m.ro[i] = 0.7; m.me[i] = 0;
        if (Math.min(fp, 1 - fp) < 0.028) { m.mul(i, 0.42); m.h[i] = 0.34; }
        const edge = Math.min(u, 1 - u, v * 2, (1 - v) * 2);
        if (edge < 0.045) { m.mul(i, 0.62); m.h[i] += 0.07; }
        for (const b of [0.16, 0.46, 0.86]) if (Math.abs(v - b) < 0.028) { const g = pnoise(u * 60, v * 60, 60, 60, s + 8); m.col(i, [66, 60, 56], 1 + g * 0.3); m.me[i] = 0.85; m.ro[i] = 0.46; m.h[i] = 0.84 - Math.abs(v - b) * 2; if (Math.abs(((u * 6) % 1) - 0.5) < 0.1 && Math.abs(v - b) < 0.008) { m.col(i, [124, 114, 104]); m.h[i] = 0.94; } }
        // little barred window
        if (u > 0.28 && u < 0.72 && v > 0.6 && v < 0.79) {
          const bar = Math.min(Math.abs(u - 0.39), Math.abs(u - 0.5), Math.abs(u - 0.61));
          if (bar < 0.016) { m.col(i, [58, 52, 48]); m.me[i] = 0.9; m.ro[i] = 0.4; m.h[i] = 0.72; }
          else { m.col(i, [16, 13, 11]); m.h[i] = 0.2; m.ro[i] = 0.9; }
          if (u < 0.31 || u > 0.69 || v < 0.615 || v > 0.775) { m.col(i, [92, 62, 38]); m.h[i] = 0.82; m.me[i] = 0; m.ro[i] = 0.7; }
        }
        const d = Math.hypot(u - 0.82, (v - 0.4) * 2);
        if (d < 0.055 && d > 0.032) { m.col(i, [140, 122, 88]); m.me[i] = 1; m.ro[i] = 0.32; m.h[i] = 0.95; }
      });
      return [3.0, 1.3];
    }
    case 'cloth': {
      m.each((u, v, i) => {
        const a = Math.sin(u * Math.PI * 128), b = Math.sin(v * Math.PI * 128);
        const weave = ((Math.floor(u * 128) + Math.floor(v * 128)) & 1) ? Math.abs(a) : Math.abs(b);
        m.col(i, [92, 102, 94], 0.8 + weave * 0.3 + pfbm(u, v, 6, 6, 4, s) * 0.3 + pfbm(u, v, 90, 90, 2, s + 1) * 0.12);
        m.h[i] = 0.4 + weave * 0.2 + pfbm(u, v, 4, 4, 4, s + 2) * 0.25; m.ro[i] = 0.96;
      });
      return [2.2, 1.0];
    }
    case 'skin': {
      m.each((u, v, i) => {
        const a = pfbm(u, v, 5, 5, 5, s), p = pworley(u, v, 54, 54, s + 1), crease = sstep(0.09, 0.0, Math.abs(pfbm(u, v, 7, 15, 3, s + 2)));
        m.col(i, [182, 134, 108], 1 + a * 0.13 + pnoise(u * 120, v * 120, 120, 120, s + 3) * 0.04 - crease * 0.07);
        m.mix(i, [176, 108, 92], sstep(0.05, 0.4, pfbm(u, v, 4, 4, 4, s + 4)) * 0.4);
        m.h[i] = 0.5 + (p.f2 - p.f1) * 0.07 - crease * 0.07 + a * 0.08; m.ro[i] = 0.58 + a * 0.1;
      });
      return [1.8, 0.7];
    }
    case 'leather': {
      m.each((u, v, i) => {
        const w = pworley(u + pfbm(u, v, 8, 8, 3, s) * 0.05, v, 30, 30, s + 1, 1), e = w.f2 - w.f1;
        const a = pfbm(u, v, 5, 5, 5, s + 2);
        m.col(i, [98, 62, 38], 0.8 + sstep(0, 0.3, e) * 0.24 + a * 0.4); m.h[i] = 0.4 + sstep(0, 0.35, e) * 0.18 + a * 0.12; m.ro[i] = 0.62 - a * 0.12;
        if (Math.abs(v - 0.12) < 0.008 && ((u * 24) % 1) < 0.62) { m.col(i, [186, 160, 112]); m.h[i] = 0.74; }
        if (Math.abs(v - 0.88) < 0.008 && ((u * 24) % 1) < 0.62) { m.col(i, [186, 160, 112]); m.h[i] = 0.74; }
      });
      return [2.6, 1.2];
    }
    case 'charwood': {
      m.each((u, v, i) => {
        const w = pworley(u + pfbm(u, v, 6, 6, 3, s) * 0.08, v + pfbm(u, v, 6, 6, 3, s + 1) * 0.08, 7, 10, s + 2, 1);
        const e = w.f2 - w.f1, plate = sstep(0.03, 0.18, e);
        const g = pfbm(u, v, 40, 40, 3, s + 3);
        m.col(i, [30, 26, 23], 0.7 + plate * 0.5 + g * 0.6);
        m.mix(i, [118, 108, 100], sstep(0.2, 0.45, pfbm(u, v, 8, 8, 4, s + 4)) * 0.5 * plate);
        const glow = (1 - plate) * sstep(-0.12, 0.24, pfbm(u, v, 5, 5, 3, s + 5));
        m.mix(i, [255, 104, 18], glow); m.em[i] = glow;
        m.h[i] = 0.25 + plate * 0.45 + g * 0.1; m.ro[i] = 0.92;
      });
      return [3.2, 1.4];
    }
    case 'leaf_oak': txLeafCluster(m, s, { twigs: 7, count: 150, len: [0.1, 0.17], wid: 0.34, lobes: 3.5, colors: [[128, 134, 118], [140, 146, 112], [116, 126, 110], [150, 142, 104]] }); return [2.2, 0.9];
    case 'leaf_birch': txLeafCluster(m, s, { twigs: 8, count: 190, len: [0.075, 0.12], wid: 0.38, serrate: 0.14, point: 0.72, colors: [[146, 152, 106], [158, 160, 100], [132, 144, 108], [170, 156, 90]] }); return [2.0, 0.8];
    case 'leaf_blossom': {
      txLeafCluster(m, s, { twigs: 7, count: 52, len: [0.07, 0.12], wid: 0.34, mask: 0, colors: [[112, 134, 62], [136, 142, 66]] });
      const r = mulberry32(s + 9);
      for (let k = 0; k < 150; k++) {
        const rr = Math.sqrt(r()) * 0.42, an = r() * 6.283, x = 0.5 + Math.cos(an) * rr, y = 0.5 + Math.sin(an) * rr;
        const size = 0.019 + r() * 0.019, z = k / 150, br = 0.74 + z * 0.3 + r() * 0.1, a0 = r() * 6.28;
        const white = r() < 0.32;
        const col = white ? [250, 232, 232] : [238, 166 + r() * 30, 190 + r() * 20];
        for (let p = 0; p < 5; p++) {
          const a = a0 + p * 1.2566;
          m.splat(x + Math.cos(a) * size * 0.6, y + Math.sin(a) * size * 0.6, size * 0.66, size * 0.46, a, (i, pa, pb) => {
            const d = pa * pa + pb * pb; if (d > 1) return;
            const notch = pa > 0.72 && Math.abs(pb) < 0.18; if (notch) return;
            const k2 = br * (0.86 + (pa * 0.5 + 0.5) * 0.2);
            m.r[i] = col[0] * k2; m.g[i] = col[1] * k2; m.b[i] = col[2] * k2; m.al[i] = 1; m.h[i] = 0.4 + z * 0.5 + (1 - d) * 0.03; m.mk[i] = 0; m.ro[i] = 0.7;
          }, false);
        }
        m.splat(x, y, size * 0.24, size * 0.24, 0, (i, pa, pb) => { if (pa * pa + pb * pb < 1) { m.col(i, [196, 96, 86], br); m.al[i] = 1; m.h[i] = 0.44 + z * 0.5; } }, false);
      }
      return [1.8, 0.7];
    }
    case 'leaf_pine': {
      txClearCard(m, [48, 72, 52]);
      const r = mulberry32(s);
      for (let k = 0; k < 17; k++) {
        const z = k / 17;
        let x = 0.5 + (r() - 0.5) * 0.3, y = 0.5 + (r() - 0.5) * 0.3, a = (k / 17) * 6.283 + r() * 0.7;
        const pts = [[x, y]];
        for (let j = 0; j < 6; j++) { a += (r() - 0.5) * 0.35; x += Math.cos(a) * 0.045; y += Math.sin(a) * 0.045; if (Math.hypot(x - 0.5, y - 0.5) > 0.44) break; pts.push([x, y]); }
        if (pts.length < 2) continue;
        m.stroke(pts, 0.007, 0.002, (i) => { m.col(i, [86, 64, 44], 0.7 + z * 0.4); m.al[i] = 1; m.h[i] = 0.3 + z * 0.5; m.mk[i] = 0; }, false);
        for (let j = 1; j < pts.length; j++) {
          for (let q = 0; q < 17; q++) {
            const t = r(), px = lerp(pts[j - 1][0], pts[j][0], t), py = lerp(pts[j - 1][1], pts[j][1], t);
            const dirA = Math.atan2(pts[j][1] - pts[j - 1][1], pts[j][0] - pts[j - 1][0]) + (r() < 0.5 ? 1 : -1) * (0.5 + r() * 0.65);
            const br = (0.58 + z * 0.6) * (0.8 + r() * 0.4);
            txBlade(m, r, px, py, dirA, 0.035 + r() * 0.05, 0.0033, (r() - 0.5) * 0.4, r() < 0.12 ? [108 * br, 126 * br, 84 * br] : [62 * br, 96 * br, 66 * br], 0.25 + z * 0.6 + r() * 0.05, 0.3 + z * 0.6, 0, false, 0.68);
          }
        }
      }
      return [2.2, 0.9];
    }
    case 'leaf_willow': {
      txClearCard(m, [100, 114, 80]);
      const r = mulberry32(s);
      for (let k = 0; k < 24; k++) {
        const z = k / 24;
        let x = 0.07 + r() * 0.86, y = 0.97 - r() * 0.2;
        const pts = [[x, y]]; const len = 0.4 + r() * 0.5;
        for (let j = 1; j <= 6; j++) pts.push([x + Math.sin(j * 0.7 + k) * 0.018, y - (len * j) / 6]);
        m.stroke(pts, 0.0035, 0.001, (i) => { m.col(i, [104, 92, 58], 0.7 + z * 0.4); m.al[i] = 1; m.h[i] = 0.25 + z * 0.5; m.mk[i] = 0; }, false);
        for (let j = 0; j < 17; j++) {
          const t = (j + r()) / 17, idx = Math.min(5, Math.floor(t * 6)), f = t * 6 - idx;
          const px = lerp(pts[idx][0], pts[idx + 1][0], f), py = lerp(pts[idx][1], pts[idx + 1][1], f);
          if (py < 0.06) continue;
          const br = (0.62 + z * 0.52) * (0.85 + r() * 0.3);
          txLeaf(m, r, px, py, -1.5708 + (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.5), 0.06 + r() * 0.045, 0.011 + r() * 0.005, [134 * br, 146 * br, 108 * br], 0.3 + z * 0.55, { point: 0.9 });
        }
      }
      return [2.0, 0.8];
    }
    case 'plant_grass': {
      txClearCard(m, [112, 130, 90]);
      const r = mulberry32(s);
      for (let k = 0; k < 74; k++) {
        const x = 0.5 + (r() - 0.5) * 0.58, br = 0.68 + r() * 0.56, dry = r() < 0.1;
        const len = 0.34 + r() * 0.58;
        const lean = (x - 0.5) * 1.0 + (r() - 0.5) * 0.5;
        txBlade(m, r, x, 0.005, 1.5708 - lean * 0.6, len, 0.0075 + r() * 0.0065, -lean * 0.8 + (r() - 0.5) * 0.8, dry ? [176 * br, 152 * br, 96 * br] : [(128 + r() * 24) * br, 146 * br, (108 - r() * 26) * br], 0.2 + k / 74 * 0.6, 0.3 + k / 74 * 0.6, dry ? 0 : 1, false);
        if (r() < 0.08) { const tx = x + Math.sin(lean) * len * 0.6, ty = len * 0.92; m.splat(tx, ty, 0.008, 0.028, lean * 0.5, (i, a, b) => { if (a * a + b * b < 1) { m.col(i, [182, 162, 108], br); m.al[i] = 1; m.h[i] = 0.85; m.mk[i] = 0; } }, false); }
      }
      return [2.2, 0.9];
    }
    case 'plant_fern': {
      txClearCard(m, [108, 134, 92]);
      const r = mulberry32(s);
      m.stroke([[0.5, 0.0], [0.505, 0.35], [0.497, 0.7], [0.5, 0.97]], 0.014, 0.003, (i) => { m.col(i, [108, 112, 66]); m.al[i] = 1; m.h[i] = 0.5; m.mk[i] = 0.5; }, false);
      for (let k = 0; k < 15; k++) {
        const t = 0.07 + (k / 15) * 0.87;
        const len = 0.43 * Math.pow(Math.sin(Math.PI * (0.18 + t * 0.78)), 0.9);
        for (const side of [-1, 1]) {
          const a = 1.5708 - side * (1.2 - t * 0.35);
          const br = 0.82 + r() * 0.3;
          txLeaf(m, r, 0.5, t + side * 0.012, a, len, len * 0.092, [118 * br, 146 * br, 100 * br], 0.5 + k * 0.008, { serrate: 0.42, point: 0.62 });
        }
      }
      txLeaf(m, r, 0.5, 0.9, 1.5708, 0.095, 0.022, [128, 158, 106], 0.8, {});
      return [2.0, 0.8];
    }
    case 'flower_red': case 'flower_blue': case 'flower_yellow': case 'flower_white': {
      txClearCard(m, [100, 122, 72]);
      const r = mulberry32(s);
      for (let k = 0; k < 16; k++) { const x = 0.5 + (r() - 0.5) * 0.4, br = 0.7 + r() * 0.4; txBlade(m, r, x, 0.005, 1.5708 + (r() - 0.5) * 1.2, 0.18 + r() * 0.26, 0.012 + r() * 0.01, (r() - 0.5) * 1.4, [96 * br, 128 * br, 62 * br], 0.2, 0.34, 0, false); }
      const stems = name === 'flower_blue' ? 5 : 6;
      for (let k = 0; k < stems; k++) {
        const bx = 0.5 + (r() - 0.5) * 0.22, tx = 0.14 + (k + 0.2 + r() * 0.6) / stems * 0.72, ty = 0.5 + r() * 0.36;
        const mid = [lerp(bx, tx, 0.4) + (r() - 0.5) * 0.07, ty * 0.52];
        m.stroke([[bx, 0], mid, [tx, ty]], 0.0095, 0.0055, (i) => { m.col(i, [92, 122, 56]); m.al[i] = 1; m.h[i] = 0.4; m.mk[i] = 0; }, false);
        txLeaf(m, r, mid[0], mid[1] * 0.8, 1.5708 + (r() < 0.5 ? 1 : -1) * (0.7 + r() * 0.4), 0.14 + r() * 0.08, 0.03, [100, 136, 60], 0.45, { mask: 0 });
        const br = 0.85 + r() * 0.25, z = 0.6 + k * 0.04;
        if (name === 'flower_blue') {
          for (let q = 0; q < 26; q++) {
            const t = q / 26, fx = tx + (r() - 0.5) * 0.075 * (1 - t * 0.7), fy = ty - 0.1 + t * 0.2;
            const col = [(86 + r() * 46) * br, (104 + r() * 40) * br, 224 * br];
            for (let p = 0; p < 4; p++) { const a = p * 1.57 + r(); m.splat(fx + Math.cos(a) * 0.013, fy + Math.sin(a) * 0.013, 0.015, 0.009, a, (i, pa, pb) => { if (pa * pa + pb * pb < 1) { m.col(i, col, 0.85 + pa * 0.2); m.al[i] = 1; m.h[i] = z + t * 0.1; m.mk[i] = 0; } }, false); }
          }
        } else {
          const petals = name === 'flower_red' ? 6 : name === 'flower_yellow' ? 15 : 8;
          const R = name === 'flower_red' ? 0.062 : name === 'flower_yellow' ? 0.068 : 0.058;
          const col = name === 'flower_red' ? [208, 54, 30] : name === 'flower_yellow' ? [246, 196, 36] : [238, 238, 226];
          const squash = 0.55 + r() * 0.3, tilt = (r() - 0.5) * 0.7;
          for (let p = 0; p < petals; p++) {
            const a = (p / petals) * 6.283 + r() * 0.3;
            const ex = Math.cos(a) * R * 0.52, ey = Math.sin(a) * R * 0.52 * squash;
            const rx = ex * Math.cos(tilt) - ey * Math.sin(tilt), ry = ex * Math.sin(tilt) + ey * Math.cos(tilt);
            m.splat(tx + rx, ty + ry, R * 0.58, R * (name === 'flower_yellow' ? 0.16 : 0.34) * (0.7 + squash * 0.3), Math.atan2(ry, rx), (i, pa, pb) => {
              if (pa * pa + pb * pb > 1) return;
              m.col(i, col, br * (0.74 + (pa * 0.5 + 0.5) * 0.34) * (Math.abs(pb) < 0.1 ? 0.9 : 1)); m.al[i] = 1; m.h[i] = z + (p % 3) * 0.02 + 0.02 * (1 - pb * pb); m.mk[i] = 0;
            }, false);
          }
          m.splat(tx, ty, R * 0.3, R * 0.3 * squash, tilt, (i, pa, pb) => { const d = pa * pa + pb * pb; if (d < 1) { m.col(i, name === 'flower_red' ? [44, 26, 22] : name === 'flower_white' ? [226, 186, 48] : [150, 92, 20], 0.8 + pnoise(pa * 5, pb * 5, 16, 16, s) * 0.4); m.al[i] = 1; m.h[i] = z + 0.1 - d * 0.04; m.mk[i] = 0; } }, false);
        }
      }
      return [1.8, 0.7];
    }
    case 'bush': case 'berry_bush': {
      txLeafCluster(m, s, { twigs: 9, count: 230, len: [0.055, 0.105], wid: 0.4, serrate: 0.1, colors: [[122, 132, 108], [136, 142, 104], [108, 122, 104]] });
      if (name === 'berry_bush') {
        const r = mulberry32(s + 7);
        for (let k = 0; k < 16; k++) {
          const rr = Math.sqrt(r()) * 0.34, an = r() * 6.28, x = 0.5 + Math.cos(an) * rr, y = 0.5 + Math.sin(an) * rr;
          for (let q = 0; q < 4; q++) {
            const bx = x + (r() - 0.5) * 0.045, by = y + (r() - 0.5) * 0.045, rad = 0.015 + r() * 0.007;
            m.splat(bx, by, rad, rad, 0, (i, a, b) => { const d = a * a + b * b; if (d < 1) { const lit = Math.max(0, 1 - Math.hypot(a + 0.35, b - 0.35) * 2.2); m.col(i, [112 + lit * 120, 26 + lit * 90, 96 + lit * 110], 0.7 + (1 - d) * 0.4); m.al[i] = 1; m.h[i] = 0.9 + (1 - d) * 0.08; m.mk[i] = 0; m.ro[i] = 0.3; } }, false);
          }
        }
      }
      return [2.2, 0.9];
    }
    case 'dead_bush': {
      txClearCard(m, [116, 92, 62]);
      const r = mulberry32(s);
      const grow = (x, y, a, len, w, depth) => {
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        if (x2 < 0.03 || x2 > 0.97 || y2 > 0.97) return;
        const tone = 0.75 + r() * 0.5;
        m.stroke([[x, y], [(x + x2) / 2 + (r() - 0.5) * 0.03, (y + y2) / 2], [x2, y2]], w, w * 0.62, (i, t, c) => { m.col(i, [126 * tone, 98 * tone, 66 * tone], 1 - Math.abs(c) * 0.3); m.al[i] = 1; m.h[i] = 0.5 - Math.abs(c) * 0.2; }, false);
        if (depth > 0) for (let k = 0; k < 2 + (r() < 0.4 ? 1 : 0); k++) grow(x2, y2, a + (r() - 0.5) * 1.7, len * (0.66 + r() * 0.2), w * 0.62, depth - 1);
      };
      for (let k = 0; k < 5; k++) grow(0.5 + (r() - 0.5) * 0.1, 0.0, 1.5708 + (r() - 0.5) * 1.5, 0.18 + r() * 0.12, 0.016, 3);
      return [1.8, 0.8];
    }
    case 'reeds': {
      txClearCard(m, [124, 132, 70]);
      const r = mulberry32(s);
      for (let k = 0; k < 26; k++) {
        const x = 0.14 + r() * 0.72, br = 0.7 + r() * 0.5;
        txBlade(m, r, x, 0.002, 1.5708 + (r() - 0.5) * 0.22, 0.58 + r() * 0.4, 0.011 + r() * 0.009, (r() - 0.5) * 0.55, r() < 0.2 ? [172 * br, 154 * br, 92 * br] : [118 * br, 138 * br, 66 * br], 0.2 + k / 40, 0.3 + k / 40, 0, false);
      }
      for (let k = 0; k < 5; k++) {
        const x = 0.22 + (k + r() * 0.6) / 5 * 0.56, top = 0.72 + r() * 0.2;
        m.stroke([[x, 0], [x + (r() - 0.5) * 0.03, top]], 0.0068, 0.005, (i) => { m.col(i, [140, 138, 78]); m.al[i] = 1; m.h[i] = 0.8; }, false);
        m.splat(x, top - 0.055, 0.019, 0.072, 0, (i, a, b) => { const d = a * a + b * b * b * b; if (d < 1) { m.col(i, [112, 68, 36], 0.7 + (1 - a * a) * 0.35 + pnoise(a * 9, b * 30, 32, 64, s) * 0.2); m.al[i] = 1; m.h[i] = 0.92 - a * a * 0.2; m.ro[i] = 0.95; } }, false);
      }
      return [2.0, 0.8];
    }
    case 'lily': {
      txClearCard(m, [62, 96, 44]);
      m.each((u, v, i) => {
        const dx = u - 0.5, dy = v - 0.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        const notch = Math.abs(Math.atan2(Math.sin(a - 0.5), Math.cos(a - 0.5))) < 0.17 * sstep(0.02, 0.4, d);
        const rim = 0.455 + pnoise((a / 6.2832 + 0.5) * 19, 0.2, 19, 4, s) * 0.014;
        if (d < rim && !notch) {
          const vein = Math.abs(Math.sin(a * 9 + pfbm(u, v, 6, 6, 3, s) * 2.4)) < 0.13 * (1 - d);
          m.col(i, [66, 106, 40], 0.86 + pfbm(u, v, 5, 5, 4, s + 1) * 0.5 + (vein ? 0.28 : 0) - sstep(0.36, 0.46, d) * 0.12);
          m.mix(i, [128, 108, 46], sstep(0.2, 0.42, pfbm(u, v, 8, 8, 4, s + 2)) * 0.65);
          m.al[i] = 1; m.h[i] = 0.5 + (vein ? 0.06 : 0) + sstep(0.4, rim, d) * 0.1; m.ro[i] = 0.3;
        }
      });
      return [1.8, 0.6];
    }
    case 'mushroom_cap': {
      m.each((u, v, i) => {
        const d = Math.hypot(u - 0.5, v - 0.5), a = Math.atan2(v - 0.5, u - 0.5);
        m.col(i, [156, 96, 52], 1.12 - d * 0.9 + pfbm(u, v, 7, 7, 4, s) * 0.34 + pnoise((a / 6.2832 + 0.5) * 60, d * 8, 60, 8, s + 1) * 0.1);
        m.mix(i, [214, 188, 148], sstep(0.36, 0.5, d));
        const sp = pworley(u, v, 13, 13, s + 2); if (idr(sp.id, 1) < 0.22 && sp.f1 < 0.22) m.mix(i, [226, 208, 176], 0.8);
        m.h[i] = 0.6 + pfbm(u, v, 12, 12, 3, s + 3) * 0.08; m.ro[i] = 0.52; m.al[i] = 1;
      });
      return [1.8, 0.8];
    }
    case 'mushroom_stem': {
      m.each((u, v, i) => { const f = pfbm(u, v, 34, 4, 4, s); m.col(i, [206, 192, 164], 0.92 + f * 0.34); m.h[i] = 0.5 + f * 0.2; m.ro[i] = 0.82; m.em[i] = 0.1 + Math.max(0, f) * 0.2; });
      return [2.0, 1.0];
    }
    case 'glow_cap': {
      m.each((u, v, i) => {
        const d = Math.hypot(u - 0.5, v - 0.5), a = Math.atan2(v - 0.5, u - 0.5);
        const gill = Math.abs(Math.sin(a * 22 + pfbm(u, v, 5, 5, 3, s) * 3));
        m.col(i, [60, 196, 170], 0.72 + gill * 0.2 + pfbm(u, v, 8, 8, 3, s + 1) * 0.4);
        m.em[i] = clamp(0.12 + sstep(0.25, 0.46, d) * 0.5 + (1 - gill) * 0.14, 0, 1);
        const sp = pworley(u, v, 9, 9, s + 2); if (idr(sp.id, 1) < 0.35 && sp.f1 < 0.2) { m.mix(i, [196, 255, 236], 0.85); m.em[i] = 1; }
        m.h[i] = 0.55 + gill * 0.06; m.ro[i] = 0.4; m.al[i] = 1;
      });
      return [1.8, 0.7];
    }
    case 'crystal_azure': case 'crystal_amber': {
      const az = name === 'crystal_azure';
      m.each((u, v, i) => {
        const w = pworley(u + pfbm(u, v, 3, 3, 3, s) * 0.12, v, 5, 3, s + 1, 1);
        const streak = pfbm(u, v, 22, 3, 4, s + 2);
        const inner = sstep(0.07, 0.0, w.f2 - w.f1);
        const facet = (w.cx * (idr(w.id, 3) - 0.5) + w.cy * (idr(w.id, 4) - 0.5));
        m.col(i, az ? [96, 192, 244] : [190, 112, 244], 0.7 + idr(w.id, 2) * 0.35 + streak * 0.35 + facet * 0.3);
        m.mix(i, [232, 246, 255], inner * 0.5 + sstep(0.22, 0.5, streak) * 0.3);
        m.em[i] = clamp(0.16 + idr(w.id, 5) * 0.2 + inner * 0.55 + Math.max(0, streak) * 0.5 + v * 0.1, 0, 1);
        m.h[i] = 0.5 + facet * 0.12 + inner * 0.03; m.ro[i] = 0.06 + Math.max(0, streak) * 0.12; m.me[i] = 0.12;
      });
      return [2.0, 0.4];
    }
    case 'seagrass': case 'kelp': {
      txClearCard(m, [70, 104, 52]);
      const r = mulberry32(s), kel = name === 'kelp';
      if (!kel) for (let k = 0; k < 30; k++) { const x = 0.18 + r() * 0.64, br = 0.65 + r() * 0.5; txBlade(m, r, x, 0.002, 1.5708 + (r() - 0.5) * 0.5, 0.4 + r() * 0.56, 0.011 + r() * 0.012, (r() - 0.5) * 1.3, [84 * br, 136 * br, 62 * br], 0.2 + k / 40, 0.3 + k / 40, 0, false); }
      else for (let k = 0; k < 3; k++) {
        const x0 = 0.28 + k * 0.22;
        const stem = [];
        for (let j = 0; j <= 12; j++) stem.push([x0 + Math.sin(j / 12 * 6.2832 + k * 2) * 0.045, j / 12]);
        m.stroke(stem, 0.013, 0.013, (i) => { m.col(i, [92, 92, 36]); m.al[i] = 1; m.h[i] = 0.5; });
        for (let j = 0; j < 12; j++) { const br = 0.7 + r() * 0.5; txLeaf(m, r, stem[j][0], stem[j][1], 1.5708 + (j % 2 ? 1 : -1) * (0.6 + r() * 0.5), 0.16 + r() * 0.08, 0.034, [112 * br, 118 * br, 40 * br], 0.55 + r() * 0.2, { mask: 0, serrate: 0.12 }); }
      }
      return [2.0, 0.8];
    }
    case 'lava': {
      // cooling crust: broad ropey plates, thin incandescent seams, the odd molten window
      m.each((u, v, i) => {
        const wu = u + pfbm(u, v, 3, 3, 4, s) * 0.17, wv = v + pfbm(u, v, 3, 3, 4, s + 1) * 0.17;
        const w = pworley(wu, wv, 4, 4, s + 2, 1), e = w.f2 - w.f1, f1 = w.f1, id = w.id;
        const w2 = pworley(wu, wv, 13, 13, s + 3, 1), e2 = w2.f2 - w2.f1;
        const heat = pfbm(u, v, 3, 3, 4, s + 4);
        const g = pfbm(u, v, 30, 30, 4, s + 5);
        const ragged = e + g * 0.035;
        const seam = sstep(0.085, 0.008, ragged);
        const glow = sstep(0.32, 0.0, ragged) * 0.3;
        const hair = sstep(0.06, 0.004, e2 + g * 0.03) * sstep(-0.02, 0.26, heat) * 0.55;
        const windowM = sstep(0.3, 0.46, heat);
        const molten = clamp(Math.max(seam, hair, windowM) + glow * (0.5 + Math.max(0, heat)), 0, 1);
        const ropes = Math.sin((f1 * 26 + pfbm(u, v, 7, 7, 3, s + 6) * 5) + idr(id, 2) * 6) * 0.5 + 0.5;
        m.col(i, [36, 24, 19], 0.72 + g * 0.8 + ropes * 0.22);
        m.mix(i, [255, 104 + molten * 104, 14 + molten * molten * 94], sstep(0.12, 0.8, molten));
        m.em[i] = clamp(Math.pow(molten, 1.45), 0, 1);
        m.h[i] = 0.74 - molten * 0.46 + g * 0.14 + ropes * 0.06 * (1 - molten) + (1 - seam) * f1 * 0.05; m.ro[i] = lerp(0.84, 0.4, molten);
      });
      return [3.0, 1.0];
    }
    default: txGranite(m, s, [[110, 106, 100], [140, 134, 124]]); return [3, 1.4];
  }
}

function generateLayer(index, size) {
  const def = LAYER_DEFS[index];
  const m = new Mat(size);
  const [ns, ao] = paintLayer(def[0], m, 1000 + index * 77);
  const cutout = index >= FIRST_CUTOUT_LAYER && !['mushroom_cap', 'mushroom_stem', 'glow_cap', 'crystal_azure', 'crystal_amber', 'lava', 'charwood'].includes(def[0]);
  const out = m.pack(ns, ao, cutout);
  // linear-space average albedo (used for distant terrain, particles and bounce light)
  let r = 0, g = 0, b = 0, n = 0, mk = 0;
  for (let i = 0; i < size * size; i += 3) if (m.al[i] > 0.5) { r += Math.pow(clamp(m.r[i], 0, 255) / 255, 2.2); g += Math.pow(clamp(m.g[i], 0, 255) / 255, 2.2); b += Math.pow(clamp(m.b[i], 0, 255) / 255, 2.2); mk += m.mk[i]; n++; }
  n = n || 1;
  out.avg = [Math.pow(r / n, 1 / 2.2) * 255, Math.pow(g / n, 1 / 2.2) * 255, Math.pow(b / n, 1 / 2.2) * 255];
  out.tintCover = mk / n;
  out.index = index;
  return out;
}

// tileable helper textures shared by the shaders: water normals and a 4-channel noise atlas
function generateWaterTextures(size) {
  const S = size, normals = new Uint8Array(S * S * 4), noise = new Uint8Array(S * S * 4);
  const ha = new Float32Array(S * S), hb = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, i = y * S + x;
    const wu = u + pfbm(u, v, 4, 4, 3, 5) * 0.06, wv = v + pfbm(u, v, 4, 4, 3, 6) * 0.06;
    ha[i] = pfbm(wu, wv, 6, 6, 5, 7, 0.55) + (1 - Math.abs(pnoise(wu * 9, wv * 9, 9, 9, 8))) * 0.25;
    hb[i] = pfbm(wv, wu, 11, 11, 4, 17, 0.55) + (1 - Math.abs(pnoise(wu * 17, wv * 17, 17, 17, 18))) * 0.2;
    // R: cellular foam, G: caustic web, B: soft fbm, A: finer fbm
    const f = pworley(wu, wv, 18, 18, 21, 1); const f1 = f.f1, fe = f.f2 - f.f1;
    const f3 = pworley(u + pfbm(u, v, 9, 9, 3, 31) * 0.04, v, 40, 40, 23, 1);
    noise[i * 4] = clamp((1 - sstep(0.04, 0.3, fe)) * 0.75 + (1 - sstep(0.04, 0.34, f3.f2 - f3.f1)) * 0.45, 0, 1) * 255;
    const c1 = pworley(wu, wv, 7, 7, 41, 1); const e1 = c1.f2 - c1.f1;
    const c2 = pworley(wv, wu, 11, 11, 43, 1); const e2 = c2.f2 - c2.f1;
    noise[i * 4 + 1] = clamp(Math.pow(1 - sstep(0.0, 0.38, e1), 2.4) * 0.8 + Math.pow(1 - sstep(0.0, 0.34, e2), 2.6) * 0.45, 0, 1) * 255;
    noise[i * 4 + 2] = clamp(pfbm(u, v, 4, 4, 6, 51) * 0.95 + 0.5, 0, 1) * 255;
    noise[i * 4 + 3] = clamp(pfbm(u, v, 16, 16, 5, 61) * 0.95 + 0.5, 0, 1) * 255;
  }
  const k = 2.2 * S / 256;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    const dxa = (ha[y * S + ((x + 1) % S)] - ha[y * S + ((x + S - 1) % S)]) * k, dya = (ha[((y + 1) % S) * S + x] - ha[((y + S - 1) % S) * S + x]) * k;
    const dxb = (hb[y * S + ((x + 1) % S)] - hb[y * S + ((x + S - 1) % S)]) * k, dyb = (hb[((y + 1) % S) * S + x] - hb[((y + S - 1) % S) * S + x]) * k;
    normals[i * 4] = clamp(-dxa * 0.5 + 0.5, 0, 1) * 255; normals[i * 4 + 1] = clamp(-dya * 0.5 + 0.5, 0, 1) * 255;
    normals[i * 4 + 2] = clamp(-dxb * 0.5 + 0.5, 0, 1) * 255; normals[i * 4 + 3] = clamp(-dyb * 0.5 + 0.5, 0, 1) * 255;
  }
  return { normals, noise };
}
