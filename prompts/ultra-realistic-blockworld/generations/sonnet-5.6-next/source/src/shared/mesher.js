// ---------------------------------------------------------------- lighting + meshing (runs in workers)
const FLAG = { SUBMERGED: 1, MODEL: 2, LEAF: 4, ROT: 8, LIT: 16, PLANT: 32, SMOOTHN: 64, NEARWATER: 128 };

class VB { // growable interleaved-by-attribute vertex builder
  constructor(cap = 2048) { this.n = 0; this.alloc(cap); }
  alloc(cap) {
    const o = this.pos ? this : null;
    const pos = new Float32Array(cap * 3), nrm = new Int8Array(cap * 4), info = new Uint8Array(cap * 4), light = new Uint8Array(cap * 4), tint = new Uint8Array(cap * 4), uv = new Float32Array(cap * 2);
    if (o) { pos.set(o.pos); nrm.set(o.nrm); info.set(o.info); light.set(o.light); tint.set(o.tint); uv.set(o.uv); }
    this.cap = cap; this.pos = pos; this.nrm = nrm; this.info = info; this.light = light; this.tint = tint; this.uv = uv;
  }
  v(x, y, z, nx, ny, nz, sway, face, layer, flags, edge, lr, lg, lb, sky, tr, tg, tb, ao, u, v) {
    if (this.n >= this.cap) this.alloc(this.cap * 2);
    const i = this.n++, i3 = i * 3, i4 = i * 4, i2 = i * 2;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.nrm[i4] = nx * 127; this.nrm[i4 + 1] = ny * 127; this.nrm[i4 + 2] = nz * 127; this.nrm[i4 + 3] = sway * 127;
    this.info[i4] = face; this.info[i4 + 1] = layer; this.info[i4 + 2] = flags; this.info[i4 + 3] = edge;
    this.light[i4] = lr; this.light[i4 + 1] = lg; this.light[i4 + 2] = lb; this.light[i4 + 3] = sky;
    this.tint[i4] = tr; this.tint[i4 + 1] = tg; this.tint[i4 + 2] = tb; this.tint[i4 + 3] = ao;
    this.uv[i2] = u; this.uv[i2 + 1] = v;
  }
  out() {
    if (!this.n) return null;
    const n = this.n;
    return { n, pos: this.pos.slice(0, n * 3), nrm: this.nrm.slice(0, n * 4), info: this.info.slice(0, n * 4), light: this.light.slice(0, n * 4), tint: this.tint.slice(0, n * 4), uv: this.uv.slice(0, n * 2) };
  }
}

// face tables: normal, u axis, v axis, 4 corners
const FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const UVQ = [[0, 0], [1, 0], [1, 1], [0, 1]];
const MW = 48, MM = 16; // meshing volume width and margin

const LightScratch = { vol: null, sky: null, lr: null, lg: null, lb: null, queue: null, cap: 0 };
function ensureScratch(size) {
  if (LightScratch.cap >= size) return;
  LightScratch.cap = size;
  LightScratch.vol = new Uint8Array(size); LightScratch.sky = new Uint8Array(size);
  LightScratch.lr = new Uint8Array(size); LightScratch.lg = new Uint8Array(size); LightScratch.lb = new Uint8Array(size);
  LightScratch.queue = new Int32Array(1 << 21);
}

function floodFill(light, vol, H, queue, head, tail) {
  const QM = queue.length - 1, W2 = MW * MW, size = W2 * H;
  while (head !== tail) {
    const i = queue[head]; head = (head + 1) & QM;
    const l = light[i];
    if (l <= 1) continue;
    const x = i % MW, z = ((i / MW) | 0) % MW;
    for (let d = 0; d < 6; d++) {
      let j;
      if (d === 0) { if (x === MW - 1) continue; j = i + 1; } else if (d === 1) { if (x === 0) continue; j = i - 1; }
      else if (d === 2) { if (z === MW - 1) continue; j = i + MW; } else if (d === 3) { if (z === 0) continue; j = i - MW; }
      else if (d === 4) { j = i + W2; if (j >= size) continue; } else { j = i - W2; if (j < 0) continue; }
      const att = T_LIGHT[vol[j]];
      if (att >= 15) continue;
      const nl = l - (att > 1 ? att : 1);
      if (nl > light[j]) { light[j] = nl; queue[tail] = j; tail = (tail + 1) & QM; }
    }
  }
}

function buildLight(nb) {
  // find vertical extent
  let maxY = 0;
  for (let k = 0; k < 9; k++) {
    const a = nb[k];
    for (let i = a.length - 1; i >= maxY * 256; i--) if (a[i] !== 0) { maxY = Math.max(maxY, (i >> 8) + 1); break; }
  }
  const H = Math.min(WORLD_H, maxY + 3), W2 = MW * MW, size = W2 * H;
  ensureScratch(size);
  const { vol, sky, lr, lg, lb, queue } = LightScratch;
  for (let k = 0; k < 9; k++) {
    const a = nb[k], ox = (k % 3) * 16, oz = ((k / 3) | 0) * 16;
    for (let y = 0; y < H; y++) for (let z = 0; z < 16; z++) {
      let s = (z << 4) | (y << 8), d = ox + (oz + z) * MW + y * W2;
      for (let x = 0; x < 16; x++) { const q = a[s++]; vol[d++] = (q & 0x800) && T_AXIS[q & 255] ? LIMB_VOL : q & 255; }
    }
  }
  sky.fill(0, 0, size); lr.fill(0, 0, size); lg.fill(0, 0, size); lb.fill(0, 0, size);
  const full = new Int16Array(W2);
  const QM = queue.length - 1;
  let head = 0, tail = 0;
  for (let z = 0; z < MW; z++) for (let x = 0; x < MW; x++) {
    let l = 15, y = H - 1;
    const c = x + z * MW;
    full[c] = H;
    for (; y >= 0; y--) {
      const i = c + y * W2, att = T_LIGHT[vol[i]];
      if (att >= 15) break;
      if (att > 0) l -= att;
      if (l <= 0) break;
      sky[i] = l;
      if (l === 15) full[c] = y;
    }
  }
  for (let z = 0; z < MW; z++) for (let x = 0; x < MW; x++) {
    const c = x + z * MW;
    let mx = full[c];
    if (x > 0) mx = Math.max(mx, full[c - 1]); if (x < MW - 1) mx = Math.max(mx, full[c + 1]);
    if (z > 0) mx = Math.max(mx, full[c - MW]); if (z < MW - 1) mx = Math.max(mx, full[c + MW]);
    for (let y = full[c]; y < mx; y++) { queue[tail] = c + y * W2; tail = (tail + 1) & QM; }
    for (let y = full[c] - 1; y >= 0; y--) { const i = c + y * W2; if (sky[i] <= 1) break; queue[tail] = i; tail = (tail + 1) & QM; }
  }
  floodFill(sky, vol, H, queue, head, tail);
  // block light per channel
  const emitters = [];
  for (let i = 0; i < size; i++) { const id = vol[i]; if (T_EMIT_R[id] | T_EMIT_G[id] | T_EMIT_B[id]) emitters.push(i); }
  const chans = [[lr, T_EMIT_R], [lg, T_EMIT_G], [lb, T_EMIT_B]];
  if (emitters.length) for (const [arr, tab] of chans) {
    let t = 0;
    for (const i of emitters) { const e = tab[vol[i]]; if (e > 0) { arr[i] = e; queue[t] = i; t = (t + 1) & QM; } }
    floodFill(arr, vol, H, queue, 0, t);
  }
  return H;
}

function meshChunk(gen, cx, cz, nb, opts) {
  const H = buildLight(nb);
  const { vol, sky, lr, lg, lb } = LightScratch;
  const W2 = MW * MW, size = W2 * H;
  const center = nb[4];
  const x0 = cx * 16, z0 = cz * 16, seed = gen.seed;
  const opaque = new VB(8192), cutout = new VB(8192), water = new VB(512), glass = new VB(64);
  const lights = new Map(), entities = [];
  const grass = [];
  const heightmap = new Float32Array(256);
  const cols = [], tints = [];
  for (let j = -1; j <= 16; j++) for (let i = -1; i <= 16; i++) {
    const c = gen.col(x0 + i, z0 + j); cols.push(c); tints.push(gen.tintsFor(x0 + i, z0 + j, c));
  }
  const tintAt = (lx, lz, which) => {
    let r = 0, g = 0, b = 0;
    for (let dz = 0; dz <= 1; dz++) for (let dx = 0; dx <= 1; dx++) {
      const t = tints[(lz + dz) * 18 + (lx + dx)][which]; r += t[0]; g += t[1]; b += t[2];
    }
    return [r / 4, g / 4, b / 4];
  };
  // volume access (local chunk coords -> volume index)
  const VI = (x, y, z) => (x + MM) + (z + MM) * MW + y * W2;
  const get = (x, y, z) => (y < 0 ? B.bedrock : y >= H ? 0 : vol[VI(x, y, z)]);
  const skyAt = (x, y, z) => (y < 0 ? 0 : y >= H ? 15 : sky[VI(x, y, z)]);
  const L4 = [0, 0, 0, 0];
  const cellLight = (x, y, z) => {
    if (y >= H) { L4[0] = 0; L4[1] = 0; L4[2] = 0; L4[3] = 15; return L4; }
    const i = VI(x, Math.max(0, y), z);
    L4[0] = lr[i]; L4[1] = lg[i]; L4[2] = lb[i]; L4[3] = sky[i]; return L4;
  };
  const maxLight = (x, y, z) => {
    let r = 0, g = 0, b = 0, s = 0;
    for (let d = -1; d < 6; d++) {
      const n = d < 0 ? [0, 0, 0] : FACES[d].n;
      const l = cellLight(x + n[0], y + n[1], z + n[2]);
      r = Math.max(r, l[0]); g = Math.max(g, l[1]); b = Math.max(b, l[2]); s = Math.max(s, l[3]);
    }
    return [r * 17, g * 17, b * 17, s * 17];
  };
  const addLight = (key, x, y, z, color, power, radius, type) => {
    let e = lights.get(key);
    if (!e) { e = { x: 0, y: 0, z: 0, n: 0, color, power, radius, type }; lights.set(key, e); }
    e.x += x; e.y += y; e.z += z; e.n++;
  };

  // generic oriented box for modelled blocks
  const box = (vb, o, ax, ay, az, hx, hy, hz, layer, flags, li, ao, uvScale = 1, layerTop = -1, tint = null) => {
    for (let f = 0; f < 6; f++) {
      const F = FACES[f];
      const nx = ax[0] * F.n[0] + ay[0] * F.n[1] + az[0] * F.n[2];
      const ny = ax[1] * F.n[0] + ay[1] * F.n[1] + az[1] * F.n[2];
      const nz = ax[2] * F.n[0] + ay[2] * F.n[1] + az[2] * F.n[2];
      const lay = f === 2 && layerTop >= 0 ? layerTop : layer;
      for (let k = 0; k < 4; k++) {
        const c = F.c[k];
        const lx = (c[0] * 2 - 1) * hx, ly = (c[1] * 2 - 1) * hy, lz = (c[2] * 2 - 1) * hz;
        const px = o[0] + ax[0] * lx + ay[0] * ly + az[0] * lz;
        const py = o[1] + ax[1] * lx + ay[1] * ly + az[1] * lz;
        const pz = o[2] + ax[2] * lx + ay[2] * ly + az[2] * lz;
        const su = Math.abs(F.u[0]) * hx * 2 + Math.abs(F.u[1]) * hy * 2 + Math.abs(F.u[2]) * hz * 2;
        const sv = Math.abs(F.v[0]) * hx * 2 + Math.abs(F.v[1]) * hy * 2 + Math.abs(F.v[2]) * hz * 2;
        vb.v(px, py, pz, nx, ny, nz, 0, 6, lay, flags | FLAG.MODEL, 0, li[0], li[1], li[2], li[3], tint ? tint[0] : 255, tint ? tint[1] : 255, tint ? tint[2] : 255, ao, UVQ[k][0] * su * uvScale, UVQ[k][1] * sv * uvScale);
      }
    }
  };
  const quad = (vb, p, n, layer, flags, li, tint, ao, sway, uvs) => {
    for (let k = 0; k < 4; k++) {
      const q = p[k], uvk = uvs ? uvs[k] : UVQ[k];
      vb.v(q[0], q[1], q[2], n[0], n[1], n[2], sway ? sway[k] : 0, 6, layer, flags | FLAG.MODEL, 0, li[0], li[1], li[2], li[3], tint[0], tint[1], tint[2], ao, uvk[0], uvk[1]);
    }
  };
  const norm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  // vertical card rotated around y with optional lean
  const card = (vb, bx, by, bz, ang, w, h, lean, layer, flags, li, tint, ao, swayTop, swayBot = 0) => {
    const dx = Math.cos(ang) * w * 0.5, dz = Math.sin(ang) * w * 0.5, lx = -Math.sin(ang) * lean, lz = Math.cos(ang) * lean;
    const n = norm3([-Math.sin(ang) * 0.35, 1, Math.cos(ang) * 0.35]);
    quad(vb, [[bx - dx, by, bz - dz], [bx + dx, by, bz + dz], [bx + dx + lx, by + h, bz + dz + lz], [bx - dx + lx, by + h, bz - dz + lz]], n, layer, flags | FLAG.PLANT, li, tint, ao, [swayBot, swayBot, swayTop, swayTop]);
  };
  // lumpy low-poly stone
  const ICO = (() => {
    const t = (1 + Math.sqrt(5)) / 2;
    const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm3);
    const f = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1];
    return { v, f };
  })();
  const rock = (vb, ox, oy, oz, rx, ry, rz, rng, layer, li, ao) => {
    const pts = ICO.v.map((p) => { const k = 0.72 + rng() * 0.56; return [ox + p[0] * rx * k, oy + p[1] * ry * k, oz + p[2] * rz * k]; });
    for (let t = 0; t < 60; t += 3) {
      const a = pts[ICO.f[t]], b = pts[ICO.f[t + 1]], c = pts[ICO.f[t + 2]];
      const n = norm3([(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])]);
      const tri = [a, b, c, c];
      for (let k = 0; k < 4; k++) {
        const q = tri[k], sm = norm3([(q[0] - ox) / (rx * rx), (q[1] - oy) / (ry * ry), (q[2] - oz) / (rz * rz)]);
        const nn = norm3([n[0] + sm[0] * 0.8, n[1] + sm[1] * 0.8, n[2] + sm[2] * 0.8]);
        vb.v(q[0], q[1], q[2], nn[0], nn[1], nn[2], 0, 6, layer, FLAG.MODEL | FLAG.SMOOTHN, 0, li[0], li[1], li[2], li[3], 255, 255, 255, q[1] < oy ? Math.round(ao * 0.55) : ao, (q[0] + q[2] * 0.7) * 1.2, (q[1] + q[2] * 0.7) * 1.2);
      }
    }
  };
  // tapered n-gon column (mushroom stems, crystals)
  const prism = (vb, base, axis, r0, r1, len, sides, layer, flags, li, ao, tip) => {
    const a = norm3(axis);
    const helper = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const s = norm3([a[1] * helper[2] - a[2] * helper[1], a[2] * helper[0] - a[0] * helper[2], a[0] * helper[1] - a[1] * helper[0]]);
    const t = [a[1] * s[2] - a[2] * s[1], a[2] * s[0] - a[0] * s[2], a[0] * s[1] - a[1] * s[0]];
    const pt = (k, r, d) => { const an = (k / sides) * Math.PI * 2; const c = Math.cos(an), sn = Math.sin(an); return [base[0] + a[0] * d + (s[0] * c + t[0] * sn) * r, base[1] + a[1] * d + (s[1] * c + t[1] * sn) * r, base[2] + a[2] * d + (s[2] * c + t[2] * sn) * r]; };
    const flat = (flags & FLAG.SMOOTHN) === 0;
    for (let k = 0; k < sides; k++) {
      const p = [pt(k, r0, 0), pt(k + 1, r0, 0), pt(k + 1, r1, len), pt(k, r1, len)];
      const dirAt = (kk) => { const an = (kk / sides) * Math.PI * 2; const c = Math.cos(an), sn = Math.sin(an); return [s[0] * c + t[0] * sn, s[1] * c + t[1] * sn, s[2] * c + t[2] * sn]; };
      const nf = norm3(dirAt(k + 0.5));
      const ns = flat ? [nf, nf, nf, nf] : [dirAt(k), dirAt(k + 1), dirAt(k + 1), dirAt(k)];
      for (let q = 0; q < 4; q++) vb.v(p[q][0], p[q][1], p[q][2], ns[q][0], ns[q][1], ns[q][2], 0, 6, layer, flags | FLAG.MODEL, 0, li[0], li[1], li[2], li[3], 255, 255, 255, q < 2 ? Math.round(ao * 0.75) : ao, UVQ[q][0] + k, UVQ[q][1]);
      if (tip > 0) {
        const apex = [base[0] + a[0] * (len + tip), base[1] + a[1] * (len + tip), base[2] + a[2] * (len + tip)];
        const nt = norm3([nf[0] * tip + a[0] * r1, nf[1] * tip + a[1] * r1, nf[2] * tip + a[2] * r1]);
        const tp = [p[3], p[2], apex, apex];
        for (let q = 0; q < 4; q++) vb.v(tp[q][0], tp[q][1], tp[q][2], nt[0], nt[1], nt[2], 0, 6, layer, flags | FLAG.MODEL, 0, li[0], li[1], li[2], li[3], 255, 255, 255, ao, UVQ[q][0] + k, UVQ[q][1]);
      }
    }
  };
  // smooth bark tube with texture running along its length
  const tube = (vb, base, axis, r0, r1, len, sides, layer, li, ao) => {
    const a = norm3(axis), helper = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const s = norm3([a[1] * helper[2] - a[2] * helper[1], a[2] * helper[0] - a[0] * helper[2], a[0] * helper[1] - a[1] * helper[0]]);
    const t = [a[1] * s[2] - a[2] * s[1], a[2] * s[0] - a[0] * s[2], a[0] * s[1] - a[1] * s[0]];
    const dirAt = (k) => { const an = (k / sides) * Math.PI * 2, c = Math.cos(an), sn = Math.sin(an); return [s[0] * c + t[0] * sn, s[1] * c + t[1] * sn, s[2] * c + t[2] * sn]; };
    for (let k = 0; k < sides; k++) {
      const d0 = dirAt(k), d1 = dirAt(k + 1);
      const p = [[base, d0, r0, 0, k], [base, d1, r0, 0, k + 1], [base, d1, r1, len, k + 1], [base, d0, r1, len, k]];
      for (let q = 0; q < 4; q++) {
        const [o, d, r, h, kk] = p[q];
        vb.v(o[0] + a[0] * h + d[0] * r, o[1] + a[1] * h + d[1] * r, o[2] + a[2] * h + d[2] * r, d[0], d[1], d[2], 0, 6, layer, FLAG.MODEL | FLAG.SMOOTHN, 0, li[0], li[1], li[2], li[3], 255, 255, 255, d[1] < -0.3 ? Math.round(ao * 0.7) : ao, (kk / sides) * 2, h);
      }
    }
  };
  const dome = (vb, c, rx, ry, layer, flags, li, ao, uvk = 1) => {
    const SEG = 8, RING = 3;
    const P = (i, j) => { const th = (j / RING) * Math.PI * 0.5, ph = (i / SEG) * Math.PI * 2; const r = Math.cos(th) * rx; return [c[0] + Math.cos(ph) * r, c[1] + Math.sin(th) * ry, c[2] + Math.sin(ph) * r]; };
    for (let j = 0; j < RING; j++) for (let i = 0; i < SEG; i++) {
      const p = [P(i, j), P(i, j + 1), P(i + 1, j + 1), P(i + 1, j)];
      for (let q = 0; q < 4; q++) {
        const n = norm3([(p[q][0] - c[0]) / (rx * rx), (p[q][1] - c[1]) / (ry * ry) + 0.2, (p[q][2] - c[2]) / (rx * rx)]);
        vb.v(p[q][0], p[q][1], p[q][2], n[0], n[1], n[2], 0, 6, layer, flags | FLAG.MODEL | FLAG.SMOOTHN, 0, li[0], li[1], li[2], li[3], 255, 255, 255, ao, 0.5 + (p[q][0] - c[0]) / rx * 0.48 * uvk, 0.5 + (p[q][2] - c[2]) / rx * 0.48 * uvk);
      }
    }
    // underside
    for (let i = 0; i < SEG; i++) {
      const p = [P(i, 0), P(i + 1, 0), c, c];
      for (let q = 0; q < 4; q++) vb.v(p[q][0], p[q][1], p[q][2], 0, -1, 0, 0, 6, layer, flags | FLAG.MODEL, 0, li[0], li[1], li[2], li[3], 190, 170, 150, Math.round(ao * 0.6), q < 2 ? 0.1 : 0.5, q === 1 ? 0.9 : 0.5);
    }
  };

  const grassDensity = opts.grass !== undefined ? opts.grass : 1;
  const leafCards = opts.leafCards || 6;
  const isOpq = (x, y, z) => T_OPAQUE[get(x, y, z)] === 1;
  const aoVal = (x, y, z) => { const id = get(x, y, z); return T_OPAQUE[id] ? 1 : T_KIND[id] === 2 ? 0.45 : 0; };

  for (let y = 0; y < H - 1; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const raw = center[bidx(x, y, z)];
    const id = raw & 255;
    if (id === 0) continue;
    const meta = raw >> 8;
    const def = BLOCKS[id], kind = T_KIND[id];
    const wx = x0 + x, wz = z0 + z;
    const colIdx = (z + 1) * 18 + (x + 1);

    if (def.axis && (meta & 8)) { // tree limb: bark tube from the parent segment, with a tapering tip
      const p = ((meta >> 4) & 15) | (((meta >> 2) & 1) << 4);
      const ox = (p % 3) - 1, oz = (((p / 3) | 0) % 3) - 1, oy = p >= 9 ? -1 : 0;
      const girth = [0.13, 0.19, 0.26, 0.33][meta & 3];
      const jig = mulberry32(ihash(wx, y, wz, 61));
      const a = [x + 0.5 + ox, y + 0.5 + oy, z + 0.5 + oz];
      const b = [x + 0.5 + (jig() - 0.5) * 0.16, y + 0.5 + (jig() - 0.5) * 0.16, z + 0.5 + (jig() - 0.5) * 0.16];
      const dir = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const len = Math.hypot(dir[0], dir[1], dir[2]);
      const li2 = maxLight(x, y, z);
      tube(opaque, a, dir, girth * 1.18, girth, len, 8, def.layers[2], li2, 235);
      const d1 = norm3(dir), tipDir = norm3([d1[0] + (jig() - 0.5) * 0.6, d1[1] + 0.25 + jig() * 0.35, d1[2] + (jig() - 0.5) * 0.6]);
      tube(opaque, b, tipDir, girth, girth * 0.3, 0.5, 7, def.layers[2], li2, 220);
      continue;
    }

    if (kind === 1 || kind === 8 || kind === 9) { // cubes, glass, slabs
      const vb = kind === 8 || id === B.ice ? (id === B.ice ? opaque : glass) : opaque;
      const slab = kind === 9;
      for (let f = 0; f < 6; f++) {
        const F = FACES[f], n = F.n;
        const ax = x + n[0], ay = y + n[1], az = z + n[2];
        const nid = get(ax, ay, az);
        if (T_OPAQUE[nid] && !(slab && f === 2)) continue;
        if (kind === 8 && nid === id) continue;
        if (slab && f === 3 && T_OPAQUE[nid]) continue;
        let layer = def.layers[f === 2 ? 0 : f === 3 ? 1 : 2];
        let flags = 0;
        if (def.axis && meta) {
          const ax = meta & 3, branch = (meta & 8) !== 0;
          const axisFace = ax === 1 ? f < 2 : ax === 2 ? f >= 4 : f === 2 || f === 3;
          layer = axisFace && !branch ? def.layers[0] : def.layers[2];
          if (ax && !axisFace) { if (ax === 1) flags |= FLAG.ROT; else if (f < 2) flags |= FLAG.ROT; }
        }
        if (nid === B.water || nid === B.kelp || nid === B.seagrass) flags |= FLAG.SUBMERGED;
        if (y <= SEA && y >= SEA - 2 && (nid === B.water || get(x + 1, y, z) === B.water || get(x - 1, y, z) === B.water || get(x, y, z + 1) === B.water || get(x, y, z - 1) === B.water || get(x + 1, y, z + 1) === B.water || get(x - 1, y, z - 1) === B.water || get(x + 1, y, z - 1) === B.water || get(x - 1, y, z + 1) === B.water)) flags |= FLAG.NEARWATER;
        // tint
        let tr = 255, tg = 255, tb = 255;
        if (def.tint === 1 && f !== 3) { const t = tintAt(x, z, 0); tr = t[0]; tg = t[1]; tb = t[2]; }
        // convex edge mask
        let edge = 0;
        const dirs = [[-F.u[0], -F.u[1], -F.u[2]], F.u, [-F.v[0], -F.v[1], -F.v[2]], F.v];
        for (let e = 0; e < 4; e++) { const d = dirs[e]; if (!isOpq(x + d[0], y + d[1], z + d[2])) edge |= 1 << e; }
        const aos = [0, 0, 0, 0], ls = [];
        for (let k = 0; k < 4; k++) {
          const c = F.c[k];
          const su = UVQ[k][0] * 2 - 1, sv = UVQ[k][1] * 2 - 1;
          const s1x = ax + F.u[0] * su, s1y = ay + F.u[1] * su, s1z = az + F.u[2] * su;
          const s2x = ax + F.v[0] * sv, s2y = ay + F.v[1] * sv, s2z = az + F.v[2] * sv;
          const ccx = s1x + F.v[0] * sv, ccy = s1y + F.v[1] * sv, ccz = s1z + F.v[2] * sv;
          const o1 = aoVal(s1x, s1y, s1z), o2 = aoVal(s2x, s2y, s2z), o3 = aoVal(ccx, ccy, ccz);
          const occ = o1 >= 1 && o2 >= 1 ? 3 : o1 + o2 + o3;
          aos[k] = 1 - occ * 0.215;
          let cnt = 0, r = 0, g = 0, b = 0, s = 0;
          const acc = (px, py, pz) => { if (!T_OPAQUE[get(px, py, pz)]) { const l = cellLight(px, py, pz); r += l[0]; g += l[1]; b += l[2]; s += l[3]; cnt++; } };
          acc(ax, ay, az); acc(s1x, s1y, s1z); acc(s2x, s2y, s2z);
          if (!(o1 >= 1 && o2 >= 1)) acc(ccx, ccy, ccz);
          if (slab && f === 2) { const l = cellLight(x, y + 1, z); r = l[0]; g = l[1]; b = l[2]; s = l[3]; cnt = 1; }
          cnt = cnt || 1;
          ls.push([(r / cnt) * 17, (g / cnt) * 17, (b / cnt) * 17, (s / cnt) * 17]);
        }
        const lum = (k) => aos[k] * 600 + ls[k][3] + ls[k][0] + ls[k][1];
        const start = lum(0) + lum(2) < lum(1) + lum(3) ? 1 : 0;
        for (let q = 0; q < 4; q++) {
          const k = (q + start) & 3, c = F.c[k];
          let cy = c[1];
          let uu = UVQ[k][0], vv = UVQ[k][1];
          if (slab) { cy = c[1] * 0.5; if (f !== 2 && f !== 3) vv *= 0.5; }
          if (flags & FLAG.ROT) { const t = uu; uu = vv; vv = 1 - t; }
          let tint = [tr, tg, tb];
          if (def.tint === 1 && f !== 3) {
            const t = tintAt(x + c[0] - (c[0] ? 0 : 0), z + c[2], 0);
            const t2 = tints[(z + c[2]) * 18 + (x + c[0])] ? t : tint;
            tint = t2;
          }
          vb.v(x + c[0], y + cy, z + c[2], n[0], n[1], n[2], 0, f, layer, flags, edge, ls[k][0], ls[k][1], ls[k][2], ls[k][3], tint[0], tint[1], tint[2], aos[k] * 255, uu, vv);
        }
      }
      if (id === B.ember_ore || id === B.azurite_ore) {
        let exposed = false;
        for (let f = 0; f < 6; f++) { const n = FACES[f].n; if (!isOpq(x + n[0], y + n[1], z + n[2])) { exposed = true; break; } }
        if (exposed) addLight('o' + (x >> 2) + ',' + (y >> 2) + ',' + (z >> 2), wx + 0.5, y + 0.5, wz + 0.5, id === B.ember_ore ? [1, 0.32, 0.08] : [0.2, 0.55, 1], 1.4, 5, 4);
      }
      if (id === B.lamp) addLight('lm' + x + ',' + y + ',' + z, wx + 0.5, y + 0.5, wz + 0.5, [1, 0.8, 0.57], 7.5, 13, 1);
      continue;
    }

    if (kind === 2) { // leaves: dense clusters of cards
      let open = 0, ex = 0, ey = 0, ez = 0, buried = 0;
      for (let f = 0; f < 6; f++) {
        const n = FACES[f].n, nid = get(x + n[0], y + n[1], z + n[2]);
        if (!T_OPAQUE[nid] && T_KIND[nid] !== 2) { open++; ex += n[0]; ey += n[1]; ez += n[2]; } else buried++;
      }
      const count = open > 0 ? leafCards + (open > 2 ? 1 : 0) : 2;
      const li = maxLight(x, y, z);
      if (open === 0) { li[3] *= 0.8; }
      let tint = [255, 255, 255];
      if (def.tint === 2) { const t = tints[colIdx][1]; tint = [t[0], t[1], t[2]]; }
      const vary = (rand01(wx, y, wz, 3) - 0.5) * 0.18 + gen.sD.n2(wx / 11, wz / 11) * 0.09;
      tint = [clamp(tint[0] * (1 + vary * 1.2), 0, 255), clamp(tint[1] * (1 + vary * 0.5), 0, 255), clamp(tint[2] * (1 - vary * 0.6), 0, 255)];
      const rng = mulberry32(ihash(wx, y, wz, 41));
      const droop = id === B.willow_leaves, needle = id === B.pine_leaves;
      for (let k = 0; k < count; k++) {
        const px = x + 0.5 + (rng() - 0.5) * 0.72 + ex * 0.1, py = y + 0.5 + (rng() - 0.5) * 0.72 + ey * 0.08, pz = z + 0.5 + (rng() - 0.5) * 0.72 + ez * 0.1;
        const theta = rng() * Math.PI * 2;
        let upx, upy, upz, rx, ry, rz;
        const sz = (needle ? 1.12 : 1.02) * (0.8 + rng() * 0.42) * (open ? 1 : 1.15) * (count < 6 ? 1.12 : 1);
        if (droop) { rx = Math.cos(theta); ry = 0; rz = Math.sin(theta); upx = (rng() - 0.5) * 0.25; upy = 1; upz = (rng() - 0.5) * 0.25; }
        else {
          const tilt = needle ? 0.25 + rng() * 0.45 : rng() * 1.25 + 0.15;
          const nx_ = Math.cos(theta) * Math.sin(tilt), ny_ = Math.cos(tilt), nz_ = Math.sin(theta) * Math.sin(tilt);
          const r0 = norm3([-Math.sin(theta), 0, Math.cos(theta)]);
          const u0 = norm3([ny_ * r0[2] - nz_ * r0[1], nz_ * r0[0] - nx_ * r0[2], nx_ * r0[1] - ny_ * r0[0]]);
          const spin = rng() * Math.PI * 2, cs = Math.cos(spin), sn = Math.sin(spin);
          rx = r0[0] * cs + u0[0] * sn; ry = r0[1] * cs + u0[1] * sn; rz = r0[2] * cs + u0[2] * sn;
          upx = u0[0] * cs - r0[0] * sn; upy = u0[1] * cs - r0[1] * sn; upz = u0[2] * cs - r0[2] * sn;
        }
        const h = sz * 0.5;
        const p = [
          [px - rx * h - upx * h, py - ry * h - upy * h, pz - rz * h - upz * h],
          [px + rx * h - upx * h, py + ry * h - upy * h, pz + rz * h - upz * h],
          [px + rx * h + upx * h, py + ry * h + upy * h, pz + rz * h + upz * h],
          [px - rx * h + upx * h, py - ry * h + upy * h, pz - rz * h + upz * h],
        ];
        const nrm = norm3([(px - x - 0.5) * 1.6 + ex * 0.75, (py - y - 0.5) * 1.6 + ey * 0.75 + 0.45, (pz - z - 0.5) * 1.6 + ez * 0.75]);
        const ao = Math.round(255 * clamp(1 - buried * 0.085 - (1 - (py - y)) * 0.12 + (rng() - 0.5) * 0.1, 0.3, 1));
        const flip = rng() < 0.5;
        const base = droop ? [0.28, 0.28, 0.5, 0.5] : [0.36, 0.36, 0.36, 0.36];
        for (let q = 0; q < 4; q++) {
          const vn = norm3([nrm[0] + (p[q][0] - px) * 0.5, nrm[1] + (p[q][1] - py) * 0.5, nrm[2] + (p[q][2] - pz) * 0.5]);
          cutout.v(p[q][0], p[q][1], p[q][2], vn[0], vn[1], vn[2], droop ? (q < 2 ? 0.75 : 0.25) : base[q], 6, def.layers[2], FLAG.LEAF | FLAG.MODEL, 0, li[0], li[1], li[2], li[3], tint[0], tint[1], tint[2], ao, flip ? 1 - UVQ[q][0] : UVQ[q][0], UVQ[q][1]);
        }
      }
      continue;
    }

    if (kind === 4) { // water
      const above = get(x, y + 1, z);
      const isWaterLike = (n) => n === B.water || n === B.kelp || n === B.seagrass || n === B.reeds && false;
      const surf = !isWaterLike(above);
      const c = cols[colIdx];
      const ocean = clamp(sstep(0.0, -0.12, c.cont), 0, 1);
      let depth = 1;
      while (depth < 32 && isWaterLike(get(x, y - depth, z))) depth++;
      // flow from the river noise tangent
      let fx = 0, fz = 0;
      if (c.river > 0.05 || (c.valley > 0.9 && ocean < 0.5)) {
        const a = gen.col(wx + 3, wz), b = gen.col(wx - 3, wz), d = gen.col(wx, wz + 3), e = gen.col(wx, wz - 3);
        const gx = a.rn - b.rn, gz = d.rn - e.rn, l = Math.hypot(gx, gz) || 1;
        fx = -gz / l; fz = gx / l;
        if (fx + fz < 0) { fx = -fx; fz = -fz; }
        const k = clamp(c.river * 1.5, 0.35, 1); fx *= k; fz *= k;
      }
      const level = meta & 7;
      const topH = surf ? 0.875 - level * 0.1 : 1;
      const cornerH = (dx, dz) => {
        let sum = 0, cnt = 0;
        for (let ox = dx - 1; ox <= dx; ox++) for (let oz = dz - 1; oz <= dz; oz++) {
          const n = get(x + ox, y, z + oz);
          if (isWaterLike(get(x + ox, y + 1, z + oz))) return 1;
          if (n === B.water) {
            let m = 0;
            if (x + ox >= 0 && x + ox < 16 && z + oz >= 0 && z + oz < 16) m = center[bidx(x + ox, y, z + oz)] >> 8;
            else m = level;
            sum += 0.875 - (m & 7) * 0.1; cnt++;
          } else if (!T_SOLID[n] && !isWaterLike(n)) { sum += 0.875 - Math.min(7, level + 1) * 0.1; cnt += 1; }
        }
        return cnt ? sum / cnt : topH;
      };
      const hs = surf ? [[cornerH(0, 0), cornerH(1, 0)], [cornerH(0, 1), cornerH(1, 1)]] : [[1, 1], [1, 1]];
      const shoreAt = (dx, dz) => {
        let s = 0;
        for (let ox = dx - 1; ox <= dx; ox++) for (let oz = dz - 1; oz <= dz; oz++) if (T_SOLID[get(x + ox, y, z + oz)]) s = 1;
        return s;
      };
      for (let f = 0; f < 6; f++) {
        const F = FACES[f], n = F.n, nid = get(x + n[0], y + n[1], z + n[2]);
        if (isWaterLike(nid)) continue;
        if (T_OPAQUE[nid] && !(f === 2 && topH < 1)) continue;
        if (nid === B.ice || nid === B.glass) continue;
        if (f !== 2 && T_KIND[nid] === 3) { if (f !== 3) { /* plants against water edge */ } }
        const l = cellLight(x + n[0], y + n[1], z + n[2]);
        const li = [l[0] * 17, l[1] * 17, l[2] * 17, Math.max(l[3], skyAt(x, y, z)) * 17];
        for (let k = 0; k < 4; k++) {
          const cc = F.c[k];
          const hh = cc[1] ? hs[cc[2]][cc[0]] : 0;
          const shore = f === 2 ? shoreAt(cc[0], cc[2]) : 0;
          water.v(x + cc[0], y + hh, z + cc[2], n[0], n[1], n[2], 0, f, 0, 0, 0, li[0], li[1], li[2], li[3], (fx * 0.5 + 0.5) * 255, (fz * 0.5 + 0.5) * 255, ocean * 255, shore * 255, depth, f === 2 ? 0 : 1);
        }
      }
      continue;
    }

    if (kind === 5) { // lava surface goes into the opaque pass
      for (let f = 0; f < 6; f++) {
        const F = FACES[f], n = F.n, nid = get(x + n[0], y + n[1], z + n[2]);
        if (nid === B.lava || T_OPAQUE[nid]) continue;
        const surf = get(x, y + 1, z) !== B.lava;
        for (let k = 0; k < 4; k++) {
          const cc = F.c[k];
          opaque.v(x + cc[0], y + (cc[1] ? (surf ? 0.9 : 1) : 0), z + cc[2], n[0], n[1], n[2], 0, f, LAYER.lava, FLAG.LIT, 0, 255, 150, 60, skyAt(x, y + 1, z) * 17, 255, 255, 255, 255, UVQ[k][0], UVQ[k][1]);
        }
        if (f === 2) addLight('lv' + (x >> 2) + ',' + (y >> 1) + ',' + (z >> 2), wx + 0.5, y + 1.25, wz + 0.5, [1, 0.38, 0.08], 4.2, 11, 2);
      }
      continue;
    }

    // ---- everything below is modelled geometry
    const li = maxLight(x, y, z);
    const rng = mulberry32(ihash(wx, y, wz, 77));
    const submerged = id === B.seagrass || id === B.kelp ? FLAG.SUBMERGED : 0;
    if (kind === 3) {
      let tint = [255, 255, 255];
      if (def.tint) { const t = tints[colIdx][def.tint - 1]; tint = [t[0], t[1], t[2]]; }
      const jx = x + 0.5 + (rng() - 0.5) * 0.34, jz = z + 0.5 + (rng() - 0.5) * 0.34;
      const below = get(x, y - 1, z);
      const by = below === B.water || id === B.lily_pad ? y : y;
      if (id === B.pebbles) {
        const cn = 4 + Math.floor(rng() * 6);
        const lay = below === B.sand || below === B.red_sand ? (below === B.red_sand ? LAYER.red_sandstone : LAYER.limestone) : rng() < 0.5 ? LAYER.stone : LAYER.limestone;
        for (let k = 0; k < cn; k++) {
          const s = 0.04 + rng() * rng() * 0.17;
          rock(opaque, x + 0.12 + rng() * 0.76, y + s * 0.38, z + 0.12 + rng() * 0.76, s, s * (0.55 + rng() * 0.3), s * (0.75 + rng() * 0.45), rng, lay, li, 235);
        }
      } else if (id === B.mushroom) {
        const cn = 2 + Math.floor(rng() * 3);
        for (let k = 0; k < cn; k++) {
          const px = x + 0.2 + rng() * 0.6, pz = z + 0.2 + rng() * 0.6, hh = 0.09 + rng() * 0.2, r = 0.05 + rng() * 0.09;
          const tx = (rng() - 0.5) * 0.2, tz = (rng() - 0.5) * 0.2;
          prism(opaque, [px, y, pz], [tx, 1, tz], r * 0.34, r * 0.24, hh, 6, LAYER.mushroom_stem, FLAG.SMOOTHN, li, 220, 0);
          dome(opaque, [px + tx * hh, y + hh - 0.01, pz + tz * hh], r, r * 0.66, LAYER.mushroom_cap, 0, li, 240);
        }
      } else if (id === B.glowshroom) {
        const cn = 3 + Math.floor(rng() * 4);
        for (let k = 0; k < cn; k++) {
          const px = x + 0.16 + rng() * 0.68, pz = z + 0.16 + rng() * 0.68, hh = 0.14 + rng() * rng() * 0.6, r = 0.04 + rng() * 0.1 * (0.5 + hh);
          const tx = (rng() - 0.5) * 0.45, tz = (rng() - 0.5) * 0.45;
          prism(opaque, [px, y, pz], [tx, 1, tz], 0.022, 0.014, hh, 5, LAYER.mushroom_stem, FLAG.SMOOTHN | FLAG.LIT, li, 230, 0);
          dome(opaque, [px + tx * hh, y + hh - 0.01, pz + tz * hh], r, r * 0.5, LAYER.glow_cap, FLAG.LIT, li, 255);
        }
        addLight('gs' + (x >> 2) + ',' + (y >> 2) + ',' + (z >> 2), wx + 0.5, y + 0.5, wz + 0.5, [0.5, 0.9, 0.78], 0.55, 6, 3);
      } else if (id === B.lily_pad) {
        const s = 0.42 + rng() * 0.12, a = rng() * 6.283, ox = x + 0.5 + (rng() - 0.5) * 0.15, oz = z + 0.5 + (rng() - 0.5) * 0.15, yy = y - 0.105;
        const c = Math.cos(a) * s, sn = Math.sin(a) * s;
        quad(cutout, [[ox - c + sn, yy, oz - sn - c], [ox + c + sn, yy, oz + sn - c], [ox + c - sn, yy, oz + sn + c], [ox - c - sn, yy, oz - sn + c]].reverse(), [0, 1, 0], def.layers[2], 0, li, tint, 245, null, [[0, 1], [1, 1], [1, 0], [0, 0]]);
      } else if (id === B.fern) {
        const cn = 7 + Math.floor(rng() * 3);
        const a0 = rng() * 6.283;
        for (let k = 0; k < cn; k++) {
          const a = a0 + (k / cn) * 6.283 + rng() * 0.5;
          const len = 0.55 + rng() * 0.38, rise = 0.28 + rng() * 0.42, w = 0.3 + rng() * 0.12;
          const dx = Math.cos(a), dz = Math.sin(a), sx = -dz * w * 0.5, sz = dx * w * 0.5;
          const m = [jx + dx * len * 0.52, y + rise, jz + dz * len * 0.52], e = [jx + dx * len, y + rise * 0.72, jz + dz * len];
          const nn = norm3([-dx * 0.25, 1, -dz * 0.25]);
          quad(cutout, [[jx - sx * 0.25, y, jz - sz * 0.25], [jx + sx * 0.25, y, jz + sz * 0.25], [m[0] + sx, m[1], m[2] + sz], [m[0] - sx, m[1], m[2] - sz]], nn, def.layers[2], FLAG.PLANT | FLAG.LEAF, li, tint, 210, [0, 0, 0.45, 0.45], [[0, 0], [1, 0], [1, 0.58], [0, 0.58]]);
          quad(cutout, [[m[0] - sx, m[1], m[2] - sz], [m[0] + sx, m[1], m[2] + sz], [e[0] + sx * 0.75, e[1], e[2] + sz * 0.75], [e[0] - sx * 0.75, e[1], e[2] - sz * 0.75]], norm3([dx * 0.3, 1, dz * 0.3]), def.layers[2], FLAG.PLANT | FLAG.LEAF, li, tint, 245, [0.45, 0.45, 0.85, 0.85], [[0, 0.58], [1, 0.58], [1, 1], [0, 1]]);
        }
      } else if (id === B.bush || id === B.berry_bush) {
        const cn = 15;
        for (let k = 0; k < cn; k++) {
          const a = rng() * 6.283, rr = Math.sqrt(rng()) * 0.32, hy = rng() * 0.5;
          const px = jx + Math.cos(a) * rr, pz = jz + Math.sin(a) * rr, w = 0.46 + rng() * 0.24;
          card(cutout, px, y + hy * 0.75 - 0.05, pz, rng() * 6.283, w, w * 0.85, (rng() - 0.5) * 0.5, def.layers[2], FLAG.LEAF, li, tint, 150 + hy * 200, 0.4, 0.15);
        }
      } else if (id === B.seagrass || id === B.kelp) {
        const kel = id === B.kelp;
        for (let k = 0; k < 3; k++) card(cutout, jx + (rng() - 0.5) * 0.2, y, jz + (rng() - 0.5) * 0.2, k * 1.047 + rng() * 0.4, kel ? 0.75 : 0.9, kel ? 1.04 : 0.55 + rng() * 0.4, (rng() - 0.5) * 0.15, def.layers[2], submerged | FLAG.LEAF, li, tint, 235, kel ? 0.6 : 0.8, kel ? 0.6 : 0);
      } else if (id === B.reeds) {
        const tall = get(x, y + 1, z) === B.reeds;
        const lower = below === B.reeds;
        for (let k = 0; k < 3; k++) {
          const rr = mulberry32(ihash(wx, k, wz, 78));
          const ox = x + 0.5 + (rr() - 0.5) * 0.5, oz = z + 0.5 + (rr() - 0.5) * 0.5, a = k * 1.047 + rr() * 0.5;
          const base = below === B.water ? y - 0.15 : y;
          card(cutout, ox, base, oz, a, 0.85, (y - base) + 1.0, 0, def.layers[2], FLAG.LEAF, li, tint, 235, lower ? 0.75 : tall ? 0.35 : 0.7, lower ? 0.35 : 0);
          if (tall) { /* upper half uses the top of the texture */ }
        }
      } else {
        const flower = id >= B.flower_red && id <= B.flower_white;
        const dead = id === B.dead_bush;
        const tallG = id === B.tall_grass;
        const flat_ = (gen.features.trample || []).some((k) => Math.hypot(wx + 0.5 - k.x, wz + 0.5 - k.z) < k.r);
        if (!flat_ && !(tallG && opts.grass > 0 && below === B.grass)) {
          const a0 = rng() * 3.14;
          const cn = flower ? 3 : 3;
          for (let k = 0; k < cn; k++) {
            const ox = jx + (flower ? (rng() - 0.5) * 0.36 : 0), oz = jz + (flower ? (rng() - 0.5) * 0.36 : 0);
            const w = flower ? 0.52 + rng() * 0.16 : dead ? 0.95 : 0.92, h = flower ? 0.52 + rng() * 0.2 : dead ? 0.7 : 0.62 + rng() * 0.3;
            card(cutout, ox, y - 0.02, oz, a0 + (k / cn) * 3.14159, w, h, (rng() - 0.5) * 0.2, def.layers[2], FLAG.LEAF, li, tint, 240, dead ? 0.12 : 0.7);
          }
        }
        if (tallG && grassDensity > 0 && !flat_) {
          const t = tints[colIdx][0];
          const nT = Math.round(4 * grassDensity);
          for (let k = 0; k < nT; k++) grass.push([x + rng(), y, z + rng(), rng(), t[0], t[1], t[2], 190 + rng() * 65, li[0], li[1], li[2], li[3]]);
        }
      }
      continue;
    }

    if (kind === 13) { // crystals
      const down = (meta & 1) === 1;
      const cn = 5 + Math.floor(rng() * 5);
      const lay = def.layers[2];
      for (let k = 0; k < cn; k++) {
        const main = k === 0;
        const bx = x + 0.5 + (main ? 0 : (rng() - 0.5) * 0.65), bz = z + 0.5 + (main ? 0 : (rng() - 0.5) * 0.65), by = down ? y + 1 : y;
        const ax = [(bx - x - 0.5) * 1.5 + (rng() - 0.5) * 0.45, down ? -1 : 1, (bz - z - 0.5) * 1.5 + (rng() - 0.5) * 0.45];
        const len = main ? 0.5 + rng() * 0.35 : 0.14 + rng() * 0.34, r = main ? 0.1 + rng() * 0.05 : 0.04 + rng() * 0.06;
        prism(opaque, [bx, by - (down ? -0.04 : 0.04), bz], ax, r, r * 0.8, len, 6, lay, FLAG.LIT, li, 255, r * 1.7);
      }
      const col = id === B.crystal_azure ? [0.55, 0.8, 1] : [0.84, 0.72, 1];
      addLight('cr' + (x >> 2) + ',' + (y >> 2) + ',' + (z >> 2), wx + 0.5, y + (down ? 0.35 : 0.65), wz + 0.5, col, 1.2, 7, 3);
      continue;
    }

    if (kind === 7) { // torch
      const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
      const d = dirs[meta & 7] || dirs[0];
      const wall = (meta & 7) > 0;
      const base = wall ? [x + 0.5 - d[0] * 0.46, y + 0.22, z + 0.5 - d[1] * 0.46] : [x + 0.5, y, z + 0.5];
      const axis = wall ? norm3([d[0] * 0.42, 1, d[1] * 0.42]) : [0, 1, 0];
      prism(opaque, base, axis, 0.042, 0.05, 0.55, 6, LAYER.oak_bark, FLAG.SMOOTHN, li, 255, 0);
      const top = [base[0] + axis[0] * 0.55, base[1] + axis[1] * 0.55, base[2] + axis[2] * 0.55];
      prism(opaque, [top[0] - axis[0] * 0.04, top[1] - axis[1] * 0.04, top[2] - axis[2] * 0.04], axis, 0.062, 0.055, 0.11, 7, LAYER.charwood, FLAG.LIT, li, 255, 0.025);
      addLight('t' + x + ',' + y + ',' + z, x0 + top[0], top[1] + 0.13, z0 + top[2], [1, 0.67, 0.37], 6.2, 12, 0);
      continue;
    }

    if (kind === 14) { // campfire
      for (let k = 0; k < 9; k++) { const a = (k / 9) * 6.283; rock(opaque, x + 0.5 + Math.cos(a) * 0.4, y + 0.07, z + 0.5 + Math.sin(a) * 0.4, 0.13, 0.1, 0.13, rng, LAYER.stone, li, 230); }
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * 6.283 + 0.4;
        prism(opaque, [x + 0.5 + Math.cos(a) * 0.34, y + 0.05, z + 0.5 + Math.sin(a) * 0.34], [-Math.cos(a), 0.62, -Math.sin(a)], 0.07, 0.055, 0.5, 7, k & 1 ? LAYER.oak_bark : LAYER.charwood, FLAG.SMOOTHN | (k & 1 ? 0 : FLAG.LIT), li, 235, 0);
      }
      for (let k = 0; k < 7; k++) rock(opaque, x + 0.35 + rng() * 0.3, y + 0.03, z + 0.35 + rng() * 0.3, 0.08, 0.04, 0.08, rng, LAYER.charwood, li, 255);
      addLight('cf' + x + ',' + y + ',' + z, wx + 0.5, y + 0.65, wz + 0.5, [1, 0.63, 0.3], 10, 15, 5);
      continue;
    }

    if (kind === 12) { // ladder
      const d = [[0, -1], [-1, 0], [0, 1], [1, 0]][meta & 3];
      const ax = [-d[1], 0, d[0]], az = [d[0], 0, d[1]];
      const c = [x + 0.5 + d[0] * 0.43, y + 0.5, z + 0.5 + d[1] * 0.43];
      for (const s of [-0.34, 0.34]) box(opaque, [c[0] + ax[0] * s, c[1], c[2] + ax[2] * s], ax, [0, 1, 0], az, 0.045, 0.5, 0.045, LAYER.oak_planks, 0, li, 240);
      for (let k = 0; k < 4; k++) box(opaque, [c[0], y + 0.125 + k * 0.25, c[2]], ax, [0, 1, 0], az, 0.34, 0.03, 0.03, LAYER.pine_planks, 0, li, 230);
      continue;
    }

    if (kind === 11 || kind === 10) { // chest & door are animated entities
      entities.push({ x: wx, y, z: wz, id, meta, light: li });
      continue;
    }

    if (kind === 6) {
      const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
      if (id === B.crafting_table) {
        box(opaque, [x + 0.5, y + 0.87, z + 0.5], X, Y, Z, 0.5, 0.12, 0.5, LAYER.oak_planks, 0, li, 255, 1, LAYER.table_top);
        for (const [ox, oz] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) box(opaque, [x + ox, y + 0.375, z + oz], X, Y, Z, 0.085, 0.375, 0.085, LAYER.oak_planks, 0, li, 225);
        box(opaque, [x + 0.5, y + 0.22, z + 0.5], X, Y, Z, 0.42, 0.035, 0.42, LAYER.pine_planks, 0, li, 200);
        for (const [o, a, b] of [[[0.5, 0.62, 0.09], X, Z], [[0.5, 0.62, 0.91], X, Z], [[0.09, 0.62, 0.5], Z, X], [[0.91, 0.62, 0.5], Z, X]]) box(opaque, [x + o[0], y + o[1], z + o[2]], a, Y, b, 0.34, 0.13, 0.028, LAYER.table_side, 0, li, 230);
        box(opaque, [x + 0.68, y + 1.03, z + 0.36], norm3([1, 0, 0.5]), Y, norm3([-0.5, 0, 1]), 0.18, 0.035, 0.05, LAYER.iron, 0, li, 255);
        box(opaque, [x + 0.34, y + 1.02, z + 0.66], norm3([1, 0, -0.35]), Y, norm3([0.35, 0, 1]), 0.2, 0.022, 0.03, LAYER.pine_planks, 0, li, 255);
        box(opaque, [x + 0.35, y + 0.31, z + 0.45], X, Y, Z, 0.16, 0.07, 0.12, LAYER.oak_bark, 0, li, 210);
      } else { // furnace
        const lit = (meta & 4) !== 0;
        const face = [5, 0, 4, 1][meta & 3];
        const l2 = li;
        for (let f = 0; f < 6; f++) {
          const F = FACES[f], n = F.n;
          if (isOpq(x + n[0], y + n[1], z + n[2])) continue;
          const lay = f === face ? LAYER.furnace_front : LAYER.furnace_side;
          const cl = cellLight(x + n[0], y + n[1], z + n[2]);
          const lf = [cl[0] * 17, cl[1] * 17, cl[2] * 17, cl[3] * 17];
          for (let k = 0; k < 4; k++) {
            const c = F.c[k];
            opaque.v(x + c[0], y + c[1], z + c[2], n[0], n[1], n[2], 0, f, lay, f === face && lit ? FLAG.LIT : 0, 15, lf[0], lf[1], lf[2], lf[3], 255, 255, 255, 240, UVQ[k][0], UVQ[k][1]);
          }
        }
        const fn = FACES[face].n, fu = FACES[face].u;
        const fc = [x + 0.5 + fn[0] * 0.53, y, z + 0.5 + fn[2] * 0.53];
        box(opaque, [fc[0], y + 0.56, fc[2]], fu, Y, fn, 0.34, 0.05, 0.05, LAYER.furnace_side, 0, l2, 235);
        box(opaque, [fc[0], y + 0.12, fc[2]], fu, Y, fn, 0.36, 0.04, 0.07, LAYER.iron, 0, l2, 235);
        for (const s of [-0.1, 0.0, 0.1]) box(opaque, [fc[0] + fu[0] * s * 1.6, y + 0.31, fc[2] + fu[2] * s * 1.6], fu, Y, fn, 0.016, 0.17, 0.016, LAYER.iron, 0, l2, 230);
        box(opaque, [x + 0.5, y + 1.03, z + 0.5], X, Y, Z, 0.44, 0.035, 0.44, LAYER.furnace_side, 0, l2, 245);
        if (lit) addLight('fu' + x + ',' + y + ',' + z, wx + 0.5 + fn[0] * 0.85, y + 0.35, wz + 0.5 + fn[2] * 0.85, [1, 0.45, 0.12], 4.5, 8, 5);
      }
      continue;
    }
  }

  // turf blades on exposed grass blocks, plus the rain-occlusion heightmap
  const GD = [0, 0, 0.3, 3.6, 1.7, 2.9, 0, 0, 0.35, 2.2, 1.8];
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    let top = 0;
    for (let y = H - 1; y > 0; y--) {
      const id = center[bidx(x, y, z)] & 255;
      if (id && (T_SOLID[id] || T_KIND[id] === 2 || id === B.water || id === B.lava)) { top = y + (id === B.water ? 0.875 : 1); break; }
    }
    heightmap[z * 16 + x] = top;
  }
  if (grassDensity > 0) {
    for (let y = 1; y < H - 1; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const id = center[bidx(x, y, z)] & 255;
      if (id !== B.grass && id !== B.snowy_grass && id !== B.forest_floor && id !== B.moss_block) continue;
      const above = center[bidx(x, y + 1, z)] & 255;
      if (above !== 0 && above !== B.tall_grass && !(above >= B.flower_red && above <= B.flower_white) && above !== B.dead_bush) continue;
      const li = cellLight(x, y + 1, z);
      if (li[3] < 4 && li[0] < 4) continue;
      const wx = x0 + x, wz = z0 + z, c = cols[(z + 1) * 18 + (x + 1)];
      const rng = mulberry32(ihash(wx, y, wz, 55));
      const patch = gen.sD.n2(wx / 13 + 9, wz / 13 - 4), big = gen.sD.n2(wx / 43, wz / 43);
      let dens = GD[c.biome] * clamp(0.8 + patch * 0.75, 0.12, 1.55);
      if (id === B.forest_floor) dens *= 0.28;
      if (id === B.snowy_grass) dens = 0.22;
      if (id === B.moss_block) dens *= 0.35;
      if (c.village > 0.6) dens *= 0.45;
      dens *= grassDensity;
      let trodden = 1;
      for (const k of gen.features.trample || []) trodden = Math.min(trodden, sstep(k.r * 0.45, k.r * 1.15, Math.hypot(wx + 0.5 - k.x, wz + 0.5 - k.z)));
      dens *= 0.12 + 0.88 * trodden;
      const count = Math.floor(dens + rng());
      const t = tints[(z + 1) * 18 + (x + 1)][0];
      for (let k = 0; k < count; k++) {
        const px = x + rng(), pz = z + rng();
        const hh = clamp((0.34 + big * 0.28 + patch * 0.2 + rng() * 0.42) * (id === B.snowy_grass ? 0.55 : 1) * (0.35 + 0.65 * trodden), 0.14, 1);
        const dry = id === B.snowy_grass ? [150, 132, 92] : t;
        grass.push([px, y + 1, pz, rng(), dry[0], dry[1], dry[2], hh * 160, li[0] * 17, li[1] * 17, li[2] * 17, li[3] * 17]);
      }
    }
  }
  let grassOut = null;
  if (grass.length) {
    const r = mulberry32(ihash(cx, cz, 91, seed));
    for (let i = grass.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = grass[i]; grass[i] = grass[j]; grass[j] = t; }
    const n = grass.length, ipos = new Float32Array(n * 4), itint = new Uint8Array(n * 4), ilight = new Uint8Array(n * 4);
    let mn = 1e9, mx = -1e9;
    for (let i = 0; i < n; i++) {
      const g = grass[i];
      ipos.set([g[0], g[1], g[2], g[3]], i * 4); itint.set([g[4], g[5], g[6], g[7]], i * 4); ilight.set([g[8], g[9], g[10], g[11]], i * 4);
      mn = Math.min(mn, g[1]); mx = Math.max(mx, g[1]);
    }
    grassOut = { n, ipos, itint, ilight, minY: mn, maxY: mx + 1.4 };
  }
  const lightList = [];
  for (const e of lights.values()) lightList.push({ x: e.x / e.n, y: e.y / e.n, z: e.z / e.n, color: e.color, power: e.power * (e.type === 2 || e.type === 3 ? Math.min(1.6, 0.6 + e.n * 0.09) : 1), radius: e.radius, type: e.type });
  // per-voxel light for the whole chunk (used by gameplay: spawning, item/creature shading)
  const lightVol = new Uint8Array(16 * 16 * H * 4);
  for (let y = 0; y < H; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const i = VI(x, y, z), o = (x + z * 16 + y * 256) * 4;
    lightVol[o] = lr[i] * 17; lightVol[o + 1] = lg[i] * 17; lightVol[o + 2] = lb[i] * 17; lightVol[o + 3] = sky[i] * 17;
  }
  const bounds = (vb) => {
    if (!vb) return;
    let mn = 1e9, mx = -1e9;
    for (let i = 1; i < vb.pos.length; i += 3) { const v = vb.pos[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    vb.minY = mn; vb.maxY = mx;
  };
  const out = { opaque: opaque.out(), cutout: cutout.out(), water: water.out(), glass: glass.out(), grass: grassOut, lights: lightList, entities, heightmap, lightVol, lightH: H };
  bounds(out.opaque); bounds(out.cutout); bounds(out.water); bounds(out.glass);
  return out;
}

