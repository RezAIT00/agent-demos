// world.js — the city: fractured geometry, deterministic debris physics, cracks, ground damage and paint
const HIT = {};
for (const h of HITDATA.hits.concat(HITDATA.minor)) HIT[h.id] = h;

// ---------- world clock: debris and dust slow down during hit-stop, then snap back ----------
const WARP = (() => {
  const spd = new Float32Array(NFRAMES_ALL()).fill(1);
  function NFRAMES_ALL() { return 1201; }
  const slow = (a, b, s) => { for (let f = a; f < b; f++) spd[f] = s; };
  for (const h of HITDATA.hits) {
    if (!h.hold) continue;
    slow(h.f, h.f + h.hold, h.hero ? 0.16 : 0.22);
    slow(h.f + h.hold, h.f + h.hold + 2, 1.5);          // the snap
  }
  slow(18, 40, 0.22);                                    // hook: the drop in slow motion
  slow(40, 54, 0.5);
  slow(652, 658, 0.25);                                  // the beat after the slice
  slow(754, 764, 0.4);
  slow(1070, 1084, 0.14);                                // the silence before the last hit
  slow(1092, 1106, 0.75);
  const cum = new Float64Array(1201);
  for (let f = 1; f <= 1200; f++) cum[f] = cum[f - 1] + spd[f - 1] / 24;
  return f => {
    const i = clamp(Math.floor(f), 0, 1199);
    return cum[i] + (f - i) * spd[i] / 24;
  };
})();

const GRAV = 16;

// ---------- ground damage (mirrors groundH in GLSL, without ripples) ----------
const CRATERS = [
  { x: 0.3, z: 2.45, R: 0.55, depth: 0.05, f: 54, grow: 2 },
  { x: 0.1, z: 0.0, R: 3.8, depth: 0.42, f: 204, grow: 14 },
  { x: -15.0, z: 0.3, R: 2.6, depth: 0.40, f: 349, grow: 3 },
  { x: 24.5, z: 0.0, R: 14.5, depth: 4.2, f: 794, grow: 14, hold: 0.28 },
  { x: 23.5, z: 0.0, R: 29.0, depth: 4.2, f: 1092, grow: 20 },
];
const FISSURE = { x0: 26.0, x1: 66.0, z: 0.0, w: 2.1, f: 474, grow: 13 };
const gHashJ = n => hash1(n);
const gNoise1J = x => { const i = Math.floor(x); let f = x - i; f = f * f * (3 - 2 * f); return lerp(gHashJ(i), gHashJ(i + 1), f); };
function craterProgress(c, f) {
  if (f < c.f) return 0;
  if (c.hold !== undefined) {            // a partial bowl during the hit-stop, then it blows out
    if (f < c.f + 8) return c.hold;
    return lerp(c.hold, 1, Ease.out3(invlerp(c.f + 8, c.f + 8 + c.grow, f)));
  }
  return Ease.out3(invlerp(c.f - 1, c.f + c.grow, f));
}
const fissureProgress = f => (f < FISSURE.f ? 0 : Ease.out(invlerp(FISSURE.f, FISSURE.f + FISSURE.grow, f)));
function groundHeight(x, z, f) {
  let h = 0;
  for (let i = 0; i < CRATERS.length; i++) {
    const c = CRATERS[i], pr = craterProgress(c, f);
    if (pr <= 0) continue;
    const dx = x - c.x, dz = z - c.z, a = Math.atan2(dz, dx);
    const R = c.R * (0.9 + 0.22 * gNoise1J(a * 5 + i * 7.3));
    const r = Math.hypot(dx, dz) / R;
    if (r < 1) h += -c.depth * Math.pow(1 - r * r, 0.7) * pr;
    h += c.depth * 0.34 * Math.exp(-Math.pow((r - 1.04) / 0.14, 2)) * pr * (0.6 + 0.8 * gNoise1J(a * 17));
  }
  const fp = fissureProgress(f);
  if (fp > 0) {
    let keep = 1, fis = 0;
    for (const c of CRATERS) {
      const pr = craterProgress(c, f);
      if (c.R > 10 && pr > 0) keep = Math.min(keep, 1 - pr * (1 - smooth(0.78, 1.16, Math.hypot(x - c.x, z - c.z) / c.R)));
    }
    const reach = lerp(FISSURE.x0, FISSURE.x1, fp);
    if (x > FISSURE.x0 - 1.5 && x < reach + 1.5) {
      const jag = (gNoise1J(x * 0.55) - 0.5) * 2.4 + (gNoise1J(x * 1.9) - 0.5) * 0.7;
      const dz = Math.abs(z - FISSURE.z - jag);
      const endf = smooth(FISSURE.x0 - 1.5, FISSURE.x0 + 3, x) * (1 - smooth(reach - 4, reach + 1.5, x));
      const w = FISSURE.w * (0.55 + 0.9 * gNoise1J(x * 0.23 + 3)) * endf;
      if (w > 1e-4) fis += -3.6 * (1 - smooth(w * 0.25, w, dz)) * endf;
      fis += 0.85 * Math.exp(-Math.pow((dz - w * 1.35) / 0.60, 2)) * endf * (0.5 + gNoise1J(x * 0.9));
    }
    h += fis * keep;
  }
  return h;
}

// ---------- 2D polygon helpers ----------
function clipPoly(poly, a, b, c) { // keep a*x + b*y <= c
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = a * p[0] + b * p[1] - c, dq = a * q[0] + b * q[1] - c;
    if (dp <= 0) out.push(p);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) { const t = dp / (dp - dq); out.push([lerp(p[0], q[0], t), lerp(p[1], q[1], t)]); }
  }
  return out;
}
function voronoiCells(w, h, nx, ny, jitter, rng) {
  const seeds = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) seeds.push([(i + 0.5 + (rng() - 0.5) * jitter) * w / nx, (j + 0.5 + (rng() - 0.5) * jitter) * h / ny]);
  const cells = [];
  for (const s of seeds) {
    let poly = [[0, 0], [w, 0], [w, h], [0, h]];
    for (const o of seeds) {
      if (o === s) continue;
      const dx = o[0] - s[0], dy = o[1] - s[1];
      if (Math.abs(dx) > w / nx * 2.6 || Math.abs(dy) > h / ny * 2.6) continue;
      poly = clipPoly(poly, dx, dy, (o[0] * o[0] + o[1] * o[1] - s[0] * s[0] - s[1] * s[1]) / 2);
      if (poly.length < 3) break;
    }
    if (poly.length >= 3) cells.push(poly);
  }
  return cells;
}

const ST_FACADE = 1, ST_FRACTURE = 2, ST_ROOF = 3, ST_TRIM = 4, ST_BRICK = 6, ST_STONE = 7, ST_CAR = 8, ST_CARGLASS = 9, ST_METAL = 10, ST_LAMP = 11, ST_GLASS = 13, ST_GRAVEL = 14;

class World {
  constructor() {
    this.chunks = [{ c: [0, 0, 0], tris: [], events: [], hidden: false }];   // chunk 0: never moves
    this.cracks = [];
    this.splats = [];
    this.groups = {};
    this.pile = new Map();
    this.rng = mulberry32(90125);
    this.buildCity();
    this.buildSetPieces();
    this.buildTower();
    this.buildFallingTowers();
    this.buildGroundBreaks();
    this.scheduleDestruction();
    this.finalBlast();
    this.simulate();
    this.bakeMeshes();
    this.buildGround();
  }

  // ----- chunk construction -------------------------------------------------
  newChunk(tris, opt = {}) {
    // tris: [{p:[a,b,c], n, meta:[type,seed,alb,w]}] in world space; recentred on the vertex mean
    let c = [0, 0, 0], k = 0;
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const t of tris) for (const p of t.p) {
      c = V.add(c, p); k++;
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
    }
    c = V.mul(c, 1 / Math.max(k, 1));
    const ext = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
    const ch = { c, tris, events: [], hidden: !!opt.hidden, ext, radius: Math.max(ext[0], ext[1], ext[2]) * 0.5, group: null };
    if (opt.thin !== undefined) ch.thin = opt.thin;
    this.chunks.push(ch);
    return ch;
  }
  // extruded polygon. frame {o,u,v,w}; poly in (u,v); depth range d0..d1 along w
  prism(frame, poly, d0, d1, meta, opt = {}) {
    const P = (p, d) => V.add(frame.o, V.add(V.mul(frame.u, p[0]), V.add(V.mul(frame.v, p[1]), V.mul(frame.w, d))));
    let cx = 0, cy = 0; for (const p of poly) { cx += p[0]; cy += p[1]; }
    cx /= poly.length; cy /= poly.length;
    const tris = [];
    const n = V.norm(frame.w);
    const front = meta.front, back = meta.back || meta.front, side = meta.side || meta.back || meta.front;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      tris.push({ p: [P([cx, cy], d1), P(a, d1), P(b, d1)], n, meta: front });
      tris.push({ p: [P([cx, cy], d0), P(b, d0), P(a, d0)], n: V.neg(n), meta: back });
      let sn = V.cross(V.sub(P(b, d0), P(a, d0)), n);
      sn = V.norm(sn);
      if (V.dot(sn, V.sub(P(a, d0), P([cx, cy], d0))) < 0) sn = V.neg(sn);
      const sm = meta.sideFor ? meta.sideFor(a, b) : side;
      tris.push({ p: [P(a, d0), P(b, d0), P(b, d1)], n: sn, meta: sm });
      tris.push({ p: [P(a, d0), P(b, d1), P(a, d1)], n: sn, meta: sm });
    }
    return this.newChunk(tris, opt);
  }
  box(cx, cy, cz, sx, sy, sz, metaSide, metaTop, opt = {}) {
    const frame = { o: [cx - sx / 2, cy - sy / 2, cz - sz / 2], u: [1, 0, 0], v: [0, 1, 0], w: [0, 0, 1] };
    const mt = metaTop || metaSide;
    return this.prism(frame, [[0, 0], [sx, 0], [sx, sy], [0, sy]], 0, sz,
      { front: metaSide, back: metaSide, side: metaSide, sideFor: (a, b) => (a[1] === sy && b[1] === sy ? mt : metaSide) }, opt);
  }
  // random lumpy debris piece (hidden until launched)
  shard(p, size, meta, rng, flat = 1) {
    const pts = [];
    const sx = size * (0.6 + rng() * 0.8), sy = size * (0.4 + rng() * 0.6) * flat, sz = size * (0.6 + rng() * 0.7);
    for (let i = 0; i < 8; i++) pts.push([p[0] + ((i & 1) ? 1 : -1) * sx * 0.5 * (0.45 + rng() * 0.75), p[1] + ((i & 2) ? 1 : -1) * sy * 0.5 * (0.45 + rng() * 0.75), p[2] + ((i & 4) ? 1 : -1) * sz * 0.5 * (0.45 + rng() * 0.75)]);
    const faces = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
    const tris = [];
    for (const f of faces) for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
      const A = pts[f[a]], B = pts[f[b]], C = pts[f[c]];
      let n = V.norm(V.cross(V.sub(B, A), V.sub(C, A)));
      if (V.dot(n, V.sub(A, p)) < 0) n = V.neg(n);
      tris.push({ p: [A, B, C], n, meta });
    }
    return this.newChunk(tris, { hidden: true });
  }
  rock(p, size, meta, rng, flat = 1) {
    const sx = size * (0.55 + rng() * 0.75), sy = size * (0.32 + rng() * 0.55) * flat, sz = size * (0.5 + rng() * 0.7);
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const v = dirs.map(d => [p[0] + (d[0] * (0.55 + rng() * 0.75) + (rng() - 0.5) * 0.55) * sx * 0.75,
      p[1] + (d[1] * (0.55 + rng() * 0.75) + (rng() - 0.5) * 0.45) * sy * 0.75,
      p[2] + (d[2] * (0.55 + rng() * 0.75) + (rng() - 0.5) * 0.55) * sz * 0.75]);
    const faces = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]];
    const tris = [];
    for (const f of faces) {
      const A = v[f[0]], B = v[f[1]], C = v[f[2]];
      let n = V.norm(V.cross(V.sub(B, A), V.sub(C, A)));
      if (V.dot(n, V.sub(A, p)) < 0) n = V.neg(n);
      tris.push({ p: [A, B, C], n, meta });
    }
    return this.newChunk(tris, { hidden: true });
  }
  tetra(p, size, meta, rng) {
    const v = [0, 1, 2, 3].map(i => { const base = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]][i]; return [p[0] + base[0] * size * (0.35 + rng() * 0.5), p[1] + base[1] * size * (0.3 + rng() * 0.4), p[2] + base[2] * size * (0.35 + rng() * 0.5)]; });
    const tris = [];
    for (const [a, b, c] of [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]]) {
      let n = V.norm(V.cross(V.sub(v[b], v[a]), V.sub(v[c], v[a])));
      if (V.dot(n, V.sub(v[a], p)) < 0) n = V.neg(n);
      tris.push({ p: [v[a], v[b], v[c]], n, meta });
    }
    return this.newChunk(tris, { hidden: true });
  }
  glassShard(p, size, rng) {
    const a = [p[0] + (rng() - 0.5) * size * 2, p[1] + rng() * size, p[2]], b = [p[0] + (rng() - 0.5) * size * 2, p[1] - rng() * size, p[2] + 0.004], c = [p[0] + size * (0.3 + rng()), p[1] + (rng() - 0.5) * size, p[2]];
    const meta = [ST_GLASS, rng(), 0.85, 0];
    return this.newChunk([{ p: [a, b, c], n: [0, 0, 1], meta }, { p: [a, c, b], n: [0, 0, -1], meta }], { hidden: true });
  }

  launch(ch, f, v, w, tag = 0, tagSeed = 0, pos = null) {
    ch.events.push({ f, wt: WARP(f), v, w, tag, tagSeed: tagSeed || this.rng(), pos });
  }

  // spray of fresh debris from a point
  burst(f, origin, opt) {
    const rng = this.rng;
    const { n, dir, spread, speed, size, tag, kind = 'rock', box = [0.3, 0.3, 0.3] } = opt;
    for (let i = 0; i < n; i++) {
      const p = [origin[0] + rr(rng, -box[0], box[0]), origin[1] + rr(rng, -box[1], box[1]), origin[2] + rr(rng, -box[2], box[2])];
      if (opt.hole) { const a = rng() * TAU, rad = opt.hole * (1 + rng() * 0.7); p[0] = origin[0] + Math.cos(a) * rad; p[2] = origin[2] + Math.sin(a) * rad * 0.8; }
      const s = size[0] + (size[1] - size[0]) * Math.pow(rng(), 2.2);
      let ch;
      if (kind === 'glass') ch = this.glassShard(p, s, rng);
      else if (kind === 'gravel') ch = this.tetra(p, s, [ST_GRAVEL, rng(), rr(rng, 0.28, 0.62), 0], rng);
      else if (kind === 'brick') ch = this.shard(p, s, [ST_BRICK, rng(), rr(rng, 0.4, 0.55), 0], rng, 0.8);
      else if (kind === 'stone') ch = this.rock(p, s, [rng() < 0.5 ? ST_STONE : ST_FRACTURE, rng(), rr(rng, 0.45, 0.7), 0], rng);
      else if (kind === 'slab') ch = this.shard(p, s, [ST_FRACTURE, rng(), rr(rng, 0.36, 0.58), 0], rng, 0.35);
      else if (kind === 'metal') ch = this.shard(p, s, [ST_METAL, rng(), rr(rng, 0.2, 0.45), 0], rng, 0.3);
      else ch = this.rock(p, s * 1.1, [ST_FRACTURE, rng(), rr(rng, 0.36, 0.62), 0], rng);
      let d = V.norm([dir[0] + rr(rng, -spread, spread), dir[1] + rr(rng, -spread, spread), dir[2] + rr(rng, -spread, spread)]);
      if (!opt.keepZ && d[2] > 0) d = [d[0], d[1], d[2] * 0.30];
      const sp = rr(rng, speed[0], speed[1]) * (1.15 - 0.45 * (s - size[0]) / Math.max(1e-3, size[1] - size[0]));
      const useTag = tag === 'split' ? (p[0] < opt.splitX ? 1 : 2) : tag;
      const vel = V.mul(d, sp);
      if (opt.minOut) {
        let rx = p[0] - 24.5, rz = p[2]; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
        const radial = vel[0] * rx + vel[2] * rz, need = opt.minOut * (0.8 + rng() * 0.7);
        if (radial < need) {
          const side = rz > 0 && !opt.keepZ;
          vel[0] += rx * (need - radial); vel[2] += rz * (need - radial) * (side ? 0.55 : 1);
          if (side) vel[0] += (rx >= 0 ? 1 : -1) * (need - radial) * 0.45;
        }
      }
      this.launch(ch, f, vel, [rr(rng, -9, 9), rr(rng, -9, 9), rr(rng, -9, 9)], useTag, rng(), null);
    }
  }
  // push existing chunks away from an impact
  blast(chunks, f, centre, opt) {
    const rng = this.rng;
    const { power, radius, bias = [0, 0, 0], tag = 0, up = 0.35, delayPerM = 0, minPower = 0.25, spin = 6 } = opt;
    for (const ch of chunks) {
      const d = V.sub(ch.c, centre);
      const dist = V.len(d);
      if (dist > radius) continue;
      const fall = lerp(1, minPower, dist / radius);
      const dn = V.norm(d);
      const v = [
        dn[0] * power * fall * rr(rng, 0.6, 1.25) + bias[0] * fall * rr(rng, 0.5, 1.3),
        dn[1] * power * fall * 0.6 + power * up * rng() + bias[1] * fall * rr(rng, 0.4, 1.3),
        dn[2] * power * fall * rr(rng, 0.6, 1.25) + bias[2] * fall * rr(rng, 0.5, 1.3),
      ];
      if (!opt.keepZ && v[2] > 0) v[2] *= 0.35;
      const k = spin / (1 + ch.radius);
      const useTag = tag === 'split' ? (ch.c[0] < centre[0] ? 1 : 2) : tag;
      this.launch(ch, f + Math.round(dist * delayPerM), v, [rr(rng, -k, k), rr(rng, -k, k), rr(rng, -k, k)], useTag, rng());
    }
  }

  // ----- city ---------------------------------------------------------------
  boxBuilding(x, z, sx, sz, h, rng, store) {
    const seed = rng() * 10, alb = rr(rng, 0.50, 0.74);
    const meta = [ST_FACADE, seed, alb, 0], roof = [ST_ROOF, seed, 0.40, 0];
    const nh = Math.max(2, Math.round(h / 9)), nx = sx > 9 ? 2 : 1;
    const list = [];
    for (let j = 0; j < nh; j++) for (let i = 0; i < nx; i++) {
      list.push(this.box(x - sx / 2 + (i + 0.5) * sx / nx, (j + 0.5) * h / nh, z, sx / nx, h / nh, sz, meta, roof));
    }
    // crown: parapet, plant room, tank
    list.push(this.box(x, h + 0.25, z, sx + 0.5, 0.5, sz + 0.5, [ST_TRIM, seed, alb * 1.08, 0], roof));
    if (rng() < 0.7) list.push(this.box(x + rr(rng, -sx * 0.25, sx * 0.25), h + 1.5, z + rr(rng, -1, 1), sx * rr(rng, 0.25, 0.5), 2.0, sz * 0.4, [ST_TRIM, seed, alb * 0.8, 0], roof));
    if (rng() < 0.35) {
      const poly = []; for (let i = 0; i < 9; i++) poly.push([Math.cos(i / 9 * TAU) * 1.2, Math.sin(i / 9 * TAU) * 1.2]);
      list.push(this.prism({ o: [x + sx * 0.25, h + 0.5, z], u: [1, 0, 0], v: [0, 0, 1], w: [0, 1, 0] }, poly, 1.0, 3.2, { front: roof, back: roof, side: [ST_METAL, seed, 0.42, 0] }));
    }
    if (rng() < 0.3) list.push(this.box(x - sx * 0.3, h + 3.4, z, 0.16, 6.0, 0.16, [ST_METAL, seed, 0.24, 0]));
    for (const c of list) c.far = true;
    store.push(...list);
  }
  buildCity() {
    const rng = mulberry32(777);
    this.cityChunks = [];
    const row = (z, x0, x1, hmin, hmax, wmin, wmax, depth, skip) => {
      let x = x0;
      while (x < x1) {
        const w = rr(rng, wmin, wmax);
        const cx = x + w / 2;
        if (!skip || !skip(cx, w, z)) this.boxBuilding(cx, z + rr(rng, -1.5, 1.5), w, depth * rr(rng, 0.8, 1.15), rr(rng, hmin, hmax), rng, this.cityChunks);
        x += w + rr(rng, 0.5, 2.6);
      }
    };
    // north side (behind the fighters), three depths
    row(-23, -74, -26, 9, 19, 7, 13, 8);
    row(-24, -26, 24, 3.8, 6.8, 6, 9, 7);
    row(-23, 24, 120, 8, 19, 7, 13, 8, (x, w) => (x + w / 2 > 46 && x - w / 2 < 68));
    row(-46, -90, -28, 15, 34, 8, 15, 10);
    row(-48, -28, 26, 5, 10, 8, 12, 9);
    row(-40, 56, 140, 15, 34, 8, 15, 10);
    row(-72, -120, -34, 22, 52, 10, 18, 12);
    row(-84, -34, 34, 9, 18, 10, 16, 12);
    row(-62, 34, 170, 22, 52, 10, 18, 12);
    row(-104, -160, -48, 28, 70, 12, 22, 14);
    row(-138, -48, 48, 10, 24, 12, 20, 14);
    row(-104, 48, 200, 28, 70, 12, 22, 14);
    // far side (behind camera in side shots, seen from above)
    row(96, -100, 150, 8, 18, 8, 14, 10);
    row(118, -130, 180, 12, 28, 10, 18, 12);
    row(144, -160, 200, 16, 34, 12, 20, 14);
    // street ends
    for (const sx of [-52, -68, -86, -106, 84, 102, 122, 146]) {
      for (const sz of [-12.5, 13.5]) this.boxBuilding(sx + rr(rng, -2, 2), sz + rr(rng, -1, 1), rr(rng, 9, 14), rr(rng, 8, 11), rr(rng, 9, 26), rng, this.cityChunks);
    }
    // street trees of the modern kind: lamp posts and bollards along the kerbs
    this.posts = [];
    for (let x = -44; x <= 76; x += 11) {
      for (const z of [-8.4, 8.6]) {
        if (Math.abs(x) < 17) continue;
        this.posts.push(this.lampPost(x + (z > 0 ? 4 : 0), z));
      }
    }
    // plaza ring: low planters
    for (let i = 0; i < 14; i++) {
      const a = Math.PI * (1.04 + i / 13 * 0.92);
      const p = [Math.cos(a) * 15.2, 0.35, Math.sin(a) * 15.2];
      this.cityChunks.push(this.box(p[0], 0.35, p[2], 1.9, 0.7, 0.9, [ST_STONE, i, 0.56, 0]));
    }
  }
  lampPost(x, z) {
    const meta = [ST_METAL, 0, 0.26, 0];
    return [
      this.box(x, 0.35, z, 0.34, 0.7, 0.34, meta),
      this.box(x, 2.0, z, 0.15, 2.6, 0.15, meta),
      this.box(x, 4.3, z, 0.13, 2.0, 0.13, meta),
      this.box(x, 5.35, z + (z > 0 ? -0.45 : 0.45), 0.2, 0.12, 1.1, meta),
      this.box(x, 5.22, z + (z > 0 ? -0.9 : 0.9), 0.42, 0.18, 0.36, [ST_LAMP, 0, 0.9, 0]),
    ];
  }
  car(x, z, yaw, rng) {
    const R = M3.ry(yaw * D2R);
    const frame = (dx, dy, dz) => ({ o: V.add([x, 0, z], M3.v(R, [dx, dy, dz])), u: M3.v(R, [1, 0, 0]), v: [0, 1, 0], w: M3.v(R, [0, 0, 1]) });
    const alb = rr(rng, 0.36, 0.7), body = [ST_CAR, rng(), alb, 0], dark = [ST_CARGLASS, 0, 0.2, 0];
    const out = [];
    const side = { front: body, back: body, side: body };
    out.push(this.prism(frame(0, 0, 0), [[-2.15, 0.34], [-0.75, 0.34], [-0.75, 0.98], [-1.55, 0.95], [-2.12, 0.70]], -0.88, 0.88, side));
    out.push(this.prism(frame(0, 0, 0), [[-0.75, 0.34], [0.85, 0.34], [0.85, 1.00], [-0.75, 0.98]], -0.9, 0.9, side));
    out.push(this.prism(frame(0, 0, 0), [[0.85, 0.34], [2.1, 0.34], [2.16, 0.78], [1.9, 0.98], [0.85, 1.00]], -0.88, 0.88, side));
    out.push(this.prism(frame(0, 0, 0), [[-0.95, 0.98], [-0.45, 1.52], [-0.30, 1.52], [-0.30, 0.98]], -0.80, 0.80, { front: dark, back: dark, side: dark }));
    out.push(this.prism(frame(0, 0, 0), [[-0.30, 0.98], [-0.30, 1.54], [0.72, 1.54], [0.80, 0.99]], -0.82, 0.82, { front: dark, back: dark, side: body }));
    out.push(this.prism(frame(0, 0, 0), [[0.72, 0.99], [0.72, 1.52], [1.00, 1.46], [1.45, 0.99]], -0.80, 0.80, { front: dark, back: dark, side: dark }));
    const wheel = []; for (let i = 0; i < 10; i++) wheel.push([Math.cos(i / 10 * TAU) * 0.38, Math.sin(i / 10 * TAU) * 0.38]);
    for (const wx of [-1.4, 1.38]) for (const wz of [-0.82, 0.82])
      out.push(this.prism(frame(wx, 0.38, wz), wheel, -0.14, 0.14, { front: [ST_METAL, 0, 0.2, 0], back: [ST_METAL, 0, 0.2, 0], side: [ST_METAL, 0, 0.12, 0] }));
    return out;
  }
  // free-standing wall made of Voronoi prisms
  wall(cx, cz, yaw, width, height, thick, type, alb, nx, ny, seed) {
    const rng = mulberry32(seed);
    const R = M3.ry(yaw * D2R);
    const u = M3.v(R, [1, 0, 0]), w = M3.v(R, [0, 0, 1]);
    const o = V.sub([cx, 0, cz], V.mul(u, width / 2));
    const cells = voronoiCells(width, height, nx, ny, 0.85, rng);
    const face = [type, seed, alb, 0], broken = [ST_FRACTURE, seed, alb * 0.88, 0];
    const out = cells.map(poly => this.prism({ o, u, v: [0, 1, 0], w }, poly, -thick / 2, thick / 2, { front: face, back: face, side: broken }));
    // coping stones
    for (let i = 0; i < Math.round(width / 1.5); i++) {
      const n = Math.round(width / 1.5), a = i / n * width, b = (i + 1) / n * width;
      out.push(this.prism({ o, u, v: [0, 1, 0], w }, [[a, height], [b, height], [b, height + 0.28], [a, height + 0.28]], -thick / 2 - 0.1, thick / 2 + 0.1, { front: [ST_STONE, seed, 0.7, 0] }));
    }
    return out;
  }
  buildSetPieces() {
    const rng = mulberry32(4242);
    // obelisk on the plaza's east side
    const ob = [];
    const ring = (r, n, a0) => { const o = []; for (let i = 0; i < n; i++) o.push([Math.cos(a0 + i / n * TAU) * r, Math.sin(a0 + i / n * TAU) * r]); return o; };
    const up = (y) => ({ o: [9.6, y, -0.25], u: [1, 0, 0], v: [0, 0, 1], w: [0, 1, 0] });
    for (let q = 0; q < 6; q++) {
      const a = q / 6 * TAU, b = (q + 1) / 6 * TAU;
      ob.push(this.prism(up(0), [[0, 0], [Math.cos(a) * 1.55, Math.sin(a) * 1.55], [Math.cos(b) * 1.55, Math.sin(b) * 1.55]], 0, 0.42, { front: [ST_STONE, 1, 0.66, 0] }));
      ob.push(this.prism(up(0), [[0, 0], [Math.cos(a) * 1.1, Math.sin(a) * 1.1], [Math.cos(b) * 1.1, Math.sin(b) * 1.1]], 0.42, 0.9, { front: [ST_STONE, 2, 0.6, 0] }));
    }
    for (let k = 0; k < 11; k++) {
      const y0 = 0.9 + k * 0.5, r0 = lerp(0.62, 0.34, k / 11);
      const rot = rng() * 6;
      for (let q = 0; q < 3; q++) {
        const a = rot + q / 3 * TAU, b = rot + (q + 1) / 3 * TAU, m = (a + b) / 2;
        ob.push(this.prism(up(0), [[0, 0], [Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(m) * r0 * 1.12, Math.sin(m) * r0 * 1.12], [Math.cos(b) * r0, Math.sin(b) * r0]], y0, y0 + 0.5,
          { front: [ST_STONE, 3, 0.74, 0], back: [ST_STONE, 3, 0.74, 0], side: [ST_STONE, 3, 0.7, 0] }));
      }
    }
    ob.push(this.box(9.6, 6.65, -0.25, 0.62, 0.5, 0.62, [ST_TRIM, 4, 0.86, 0]));
    this.obelisk = ob;
    // west brick wall
    this.wallA = this.wall(-9.4, -0.4, 58, 9.5, 5.4, 0.55, ST_BRICK, 0.50, 9, 7, 11)
      .concat(this.wall(-11.8, -5.6, 12, 4.2, 3.2, 0.5, ST_BRICK, 0.46, 5, 4, 12));
    // storefront: piers, big panes, sign band, upper floor
    const sf = [];
    const R = M3.ry(62 * D2R), u = M3.v(R, [1, 0, 0]), w = M3.v(R, [0, 0, 1]);
    const o = V.sub([14.4, 0, -0.6], V.mul(u, 4.2));
    const fr = { o, u, v: [0, 1, 0], w };
    const stone = { front: [ST_STONE, 21, 0.66, 0], back: [ST_STONE, 21, 0.62, 0], side: [ST_FRACTURE, 21, 0.5, 0] };
    for (const a of [0, 2.65, 5.3, 7.95]) for (let k = 0; k < 4; k++) sf.push(this.prism(fr, [[a, k * 0.85], [a + 0.45, k * 0.85], [a + 0.45, (k + 1) * 0.85], [a, (k + 1) * 0.85]], -0.35, 0.35, stone));
    this.glassPanes = [];
    for (const a of [0.45, 3.1, 5.75]) {
      for (const cell of voronoiCells(2.2, 3.2, 3, 4, 0.9, rng)) {
        const p = cell.map(q => [q[0] + a, q[1] + 0.2]);
        const m = [ST_CARGLASS, 3, 0.4, 0];
        const g = this.prism(fr, p, -0.03, 0.03, { front: m, back: m, side: [ST_GLASS, 0, 0.9, 0] });
        sf.push(g);
      }
    }
    for (let k = 0; k < 7; k++) sf.push(this.prism(fr, [[k * 1.2, 3.4], [(k + 1) * 1.2, 3.4], [(k + 1) * 1.2, 4.2], [k * 1.2, 4.2]], -0.45, 0.45, { front: [ST_TRIM, 22, 0.80, 0], back: [ST_TRIM, 22, 0.7, 0], side: [ST_FRACTURE, 22, 0.55, 0] }));
    for (const cell of voronoiCells(8.4, 2.6, 7, 3, 0.8, rng)) sf.push(this.prism(fr, cell.map(q => [q[0], q[1] + 4.2]), -0.3, 0.3, { front: [ST_FACADE, 5.5, 0.62, 0], back: [ST_FRACTURE, 5, 0.5, 0], side: [ST_FRACTURE, 5, 0.5, 0] }));
    this.storefront = sf;
    this.wallC = this.wall(19.8, -0.3, 60, 8.0, 4.4, 0.55, ST_BRICK, 0.46, 8, 6, 13);
    // street furniture in the line of fire
    this.car1 = this.car(35.2, -0.5, 24, rng);
    this.car2 = this.car(31.5, 4.4, 4, rng);
    this.car3 = this.car(43.6, -4.2, -8, rng);
    this.car4 = this.car(-27, 3.2, 3, rng);
    this.car5 = this.car(66, 4.6, 12, rng);
    this.pathPosts = [this.lampPost(40.2, -0.55), this.lampPost(43.8, 0.45)];
  }

  // ----- the tower: panels and floor slabs, pre-cut along the plane of the stroke -----
  buildTower() {
    const rng = mulberry32(31337);
    const T = this.tower = { x0: 50.5, x1: 63.5, z0: -9.5, z1: 2.5, h: 49, fl: 3.5 };
    T.cut = { n: V.norm([0.46, 1.0, 0]), p: [57.0, 19.5, -3.5] };
    const cn = T.cut.n, cd = V.dot(cn, T.cut.p);
    this.towerChunks = [];
    const seed = 2.27;
    const addPiece = (frame, poly, d0, d1, meta) => {
      const mid = (d0 + d1) / 2;
      const a = V.dot(cn, frame.u), b = V.dot(cn, frame.v);
      const c = cd - V.dot(cn, V.mad(frame.o, frame.w, mid));
      const parts = [];
      if (Math.abs(a) + Math.abs(b) < 1e-5) parts.push([poly, c < 0 ? 1 : 0]);
      else {
        const lo = clipPoly(poly, a, b, c), hi = clipPoly(poly, -a, -b, -c);
        if (lo.length >= 3) parts.push([lo, 0]);
        if (hi.length >= 3) parts.push([hi, 1]);
      }
      for (const [pp, top] of parts) {
        let area = 0; for (let i = 0; i < pp.length; i++) { const p = pp[i], q = pp[(i + 1) % pp.length]; area += p[0] * q[1] - q[0] * p[1]; }
        if (Math.abs(area) < 0.08) continue;
        const ch = this.prism(frame, pp, d0, d1, meta);
        ch.top = top;
        this.towerChunks.push(ch);
      }
    };
    const facade = [ST_FACADE, seed, 0.70, 0], inner = [ST_FRACTURE, seed, 0.42, 0];
    const meta = { front: facade, back: inner, side: inner };
    const nf = Math.round(T.h / T.fl);
    const faces = [
      { o: [T.x0, 0, T.z1], u: [1, 0, 0], w: [0, 0, 1], len: T.x1 - T.x0, bays: 5 },
      { o: [T.x0, 0, T.z0], u: [0, 0, 1], w: [-1, 0, 0], len: T.z1 - T.z0, bays: 4 },
      { o: [T.x1, 0, T.z1], u: [0, 0, -1], w: [1, 0, 0], len: T.z1 - T.z0, bays: 4 },
      { o: [T.x1, 0, T.z0], u: [-1, 0, 0], w: [0, 0, -1], len: T.x1 - T.x0, bays: 5 },
    ];
    for (const f of faces) {
      const bw = f.len / f.bays;
      for (let j = 0; j < nf; j++) for (let i = 0; i < f.bays; i++) {
        const y0 = j * T.fl, y1 = y0 + T.fl, a = i * bw, b = a + bw;
        const frame = { o: f.o, u: f.u, v: [0, 1, 0], w: f.w };
        // each panel is two jagged halves so it breaks like masonry, not tiles
        const m1 = a + bw * rr(rng, 0.3, 0.7), m2 = a + bw * rr(rng, 0.3, 0.7);
        addPiece(frame, [[a, y0], [m1, y0], [m2, y1], [a, y1]], -0.45, 0.0, meta);
        addPiece(frame, [[m1, y0], [b, y0], [b, y1], [m2, y1]], -0.45, 0.0, meta);
      }
    }
    for (let j = 1; j <= nf; j++) {
      const y = j * T.fl;
      const cells = voronoiCells(T.x1 - T.x0 - 0.9, T.z1 - T.z0 - 0.9, 3, 3, 0.7, rng);
      for (const cell of cells) addPiece({ o: [T.x0 + 0.45, y - 0.32, T.z0 + 0.45], u: [1, 0, 0], v: [0, 0, 1], w: [0, 1, 0] }, cell, 0, 0.3, { front: [ST_ROOF, seed, 0.45, 0], back: inner, side: inner });
      // ledge band on the street faces
      for (let i = 0; i < 4; i++) {
        const bw = (T.x1 - T.x0) / 4;
        addPiece({ o: [T.x0 + i * bw, y - 0.14, T.z1], u: [1, 0, 0], v: [0, 1, 0], w: [0, 0, 1] }, [[0, 0], [bw, 0], [bw, 0.24], [0, 0.24]], 0, 0.28, { front: [ST_TRIM, seed, 0.84, 0] });
      }
    }
    // crown
    for (let i = 0; i < 3; i++) addPiece({ o: [T.x0 + 1 + i * 3.7, nf * T.fl, T.z0 + 2], u: [1, 0, 0], v: [0, 1, 0], w: [0, 0, 1] }, [[0, 0], [3.5, 0], [3.5, 3.2], [0, 3.2]], 0, 7, { front: [ST_TRIM, seed, 0.6, 0] });
    addPiece({ o: [58.5, nf * T.fl + 3.2, -4], u: [1, 0, 0], v: [0, 1, 0], w: [0, 0, 1] }, [[0, 0], [0.24, 0], [0.12, 9]], 0, 0.2, { front: [ST_METAL, seed, 0.22, 0] });
  }

  buildFallingTowers() {
    const rng = mulberry32(5150);
    this.sideTowers = [];
    const spec = [[31.0, -52, 9, 9, 36, 812], [28.0, -35, 10, 10, 42, 818], [44.5, -27, 9, 9, 30, 808], [56.0, -30, 9, 9, 28, 822]];
    spec.forEach(([x, z, sx, sz, h, f], ti) => {
      const list = [];
      const seed = rng() * 10, alb = rr(rng, 0.52, 0.72);
      const meta = [ST_FACADE, seed, alb, 0], roof = [ST_ROOF, seed, 0.4, 0];
      const nf = Math.round(h / 3.4);
      for (let j = 0; j < nf; j++) for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++)
        list.push(this.box(x - sx / 4 + i * sx / 2, (j + 0.5) * h / nf, z - sz / 4 + k * sz / 2, sx / 2, h / nf, sz / 2, meta, roof));
      list.push(this.box(x, h + 0.3, z, sx + 0.5, 0.6, sz + 0.5, [ST_TRIM, seed, 0.78, 0], roof));
      this.sideTowers.push({ chunks: list, x, z, sx, sz, h, f });
    });
  }

  // paving and road slabs that only appear once the ground breaks
  buildGroundBreaks() {
    const rng = mulberry32(8086);
    const slabRing = (cx, cz, r0, r1, rings, per, thick, alb) => {
      const out = [];
      for (let k = 0; k < rings; k++) {
        const ra = lerp(r0, r1, k / rings), rb = lerp(r0, r1, (k + 1) / rings);
        const n = Math.round(per * (0.6 + 0.4 * (k + 1) / rings));
        const off = rng() * TAU;
        for (let i = 0; i < n; i++) {
          const a = off + i / n * TAU, b = off + (i + 0.94) / n * TAU;
          const j = () => 1 + (rng() - 0.5) * 0.12;
          const poly = [[Math.cos(a) * ra * j(), Math.sin(a) * ra * j()], [Math.cos(b) * ra * j(), Math.sin(b) * ra * j()], [Math.cos(b) * rb * j(), Math.sin(b) * rb * j()], [Math.cos(a) * rb * j(), Math.sin(a) * rb * j()]];
          const t = thick * (0.6 + rng() * 0.8);
          out.push(this.prism({ o: [cx, -t, cz], u: [1, 0, 0], v: [0, 0, 1], w: [0, 1, 0] }, poly, 0, t, { front: [ST_STONE, rng(), alb, 0], back: [ST_FRACTURE, 0, 0.3, 0], side: [ST_FRACTURE, 0, 0.36, 0] }, { hidden: true }));
        }
      }
      return out;
    };
    this.ringClash = slabRing(0.1, 0, 1.2, 5.6, 4, 16, 0.22, 0.62);
    this.ringCrater = slabRing(24.5, 0, 3.0, 15.0, 5, 24, 0.85, 0.5);
    this.ringFinal = slabRing(23.5, 0, 6.0, 30.0, 6, 30, 1.3, 0.48);
    // street slabs along the fissure
    this.fisSlabs = [];
    for (let x = FISSURE.x0 + 0.5; x < FISSURE.x1 - 4; x += 1.55) {
      for (const side of [-1, 1]) {
        const w = rr(rng, 1.2, 2.2), len = rr(rng, 1.1, 1.9), t = rr(rng, 0.24, 0.55);
        const z = FISSURE.z + side * rr(rng, 2.7, 4.1);
        const poly = [[0, 0], [len, rr(rng, -0.2, 0.2)], [len * rr(rng, 0.8, 1.1), w], [rr(rng, -0.1, 0.3), w * rr(rng, 0.8, 1.1)]];
        const ch = this.prism({ o: [x, -t * 0.5, z - w / 2], u: [1, 0, 0], v: [0, 0, 1], w: [0, 1, 0] }, poly, 0, t, { front: [ST_STONE, rng(), 0.42, 0], back: [ST_FRACTURE, 0, 0.3, 0], side: [ST_FRACTURE, 0, 0.34, 0] }, { hidden: true });
        ch.side = side;
        this.fisSlabs.push(ch);
      }
    }
  }

  // ----- cracks -------------------------------------------------------------
  crack(f, x, z, opt) {
    const rng = this.rng;
    const { n = 10, len = 5, w = 0.07, type = 0, from = 0, arc = TAU, start = 0.2, branch = 0.35 } = opt;
    const walk = (px, pz, ang, L, width, dist, depth) => {
      const seg = Math.max(0.12, L / 9);
      let d = 0;
      while (d < L) {
        const na = ang + rr(rng, -0.55, 0.55);
        const s = seg * rr(rng, 0.6, 1.3);
        const qx = px + Math.cos(na) * s, qz = pz + Math.sin(na) * s;
        const w0 = width * (1 - d / L) + 0.006, w1 = width * (1 - (d + s) / L) + 0.004;
        const sx = -Math.sin(na), sz = Math.cos(na);
        const t = typeof type === 'function' ? type(qx, qz) : type;
        const birth = WARP(f);
        const quad = [[px + sx * w0, pz + sz * w0, dist], [px - sx * w0, pz - sz * w0, dist], [qx - sx * w1, qz - sz * w1, dist + s], [qx + sx * w1, qz + sz * w1, dist + s]];
        for (const k of [0, 1, 2, 0, 2, 3]) this.cracks.push(quad[k][0], 0, quad[k][1], quad[k][2], birth, t, rng());
        if (depth < 2 && rng() < branch * 0.5) walk(qx, qz, na + (rng() < 0.5 ? -1 : 1) * rr(rng, 0.5, 1.2), L * 0.4, w1 * 0.75, dist + s, depth + 1);
        px = qx; pz = qz; d += s; dist += s; ang = ang * 0.35 + na * 0.65;
      }
    };
    for (let i = 0; i < n; i++) {
      const a = from + (i + rr(rng, -0.3, 0.3)) / n * arc;
      walk(x + Math.cos(a) * start, z + Math.sin(a) * start, a, len * rr(rng, 0.55, 1.25), w * rr(rng, 0.7, 1.2), start, 0);
    }
  }
  splat(f, p, r, type, grow = 6, seed = null, alpha = 1) {
    this.splats.push({ f, p, r, type, grow, seed: seed === null ? this.rng() : seed, alpha, birth: WARP(f) + 0.002 });
  }

  // whatever is already lying near a blow gets thrown out of the way by it
  clearAround(f, centre, radius, power, tag) {
    const lying = this.chunks.filter(ch => {
      if (!ch.events.length || ch.events.some(e => e.f >= f - 6) || ch.group) return false;
      const g = this.restGuess(ch);
      return Math.hypot(g[0] - centre[0], g[2] - centre[2]) < radius;
    });
    const rng = this.rng;
    for (const ch of lying) {
      const g = this.restGuess(ch);
      let dx = g[0] - centre[0], dz = g[2] - centre[2]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      if (dz > 0) dz *= 0.4;
      const sp = power * rr(rng, 0.7, 1.35);
      this.launch(ch, f + Math.round(l * 0.2), [dx * sp - 2.5, rr(rng, 5, 12), dz * sp - rr(rng, 0, 5)], [rr(rng, -7, 7), rr(rng, -7, 7), rr(rng, -7, 7)], tag, rng());
    }
  }

  // ----- what breaks when ---------------------------------------------------
  scheduleDestruction() {
    const F = id => HIT[id].f;
    // H1: the drop
    this.splat(F('H1'), [0.0, 0.0, 2.5], 0.56, 1, 16, 0.12);
    this.crack(F('H1'), 0.0, 2.5, { n: 6, len: 0.42, w: 0.006, type: 0, start: 0.1 });
    this.crack(F('H1'), 0.0, 2.5, { n: 9, len: 0.34, w: 0.009, type: 1, start: 0.16 });
    this.burst(F('H1'), [0, 0.03, 2.5], { n: 26, dir: [0, 0.7, 0], spread: 1.2, speed: [0.5, 2.2], size: [0.006, 0.024], tag: 1, kind: 'gravel', box: [0.12, 0.01, 0.12] });
    // H2: the stomp
    this.splat(F('H2'), [0.02, 0.0, 2.47], 1.55, 2, 5, 0.7);
    this.crack(F('H2'), 0.03, 2.47, { n: 13, len: 2.4, w: 0.03, type: 0, start: 0.12 });
    this.burst(F('H2'), [0.0, 0.05, 2.47], { n: 60, dir: [0, 0.8, 0], spread: 1.3, speed: [1.2, 4.5], size: [0.012, 0.075], tag: 2, kind: 'gravel', box: [0.3, 0.02, 0.3] });
    this.burst(F('H2'), [0.0, 0.04, 2.47], { n: 12, dir: [0, 1, 0], spread: 1.1, speed: [1.5, 3.8], size: [0.1, 0.26], tag: 2, kind: 'slab', box: [0.35, 0.02, 0.35] });

    // H3: first clash. Paint to the west, ink to the east
    const f3 = F('H3');
    this.blast(this.ringClash, f3 + 1, [0.1, -0.9, 0], { power: 6.2, radius: 7, up: 1.1, tag: 'split', delayPerM: 0.9, minPower: 0.35, spin: 5 });
    this.crack(f3, 0.1, 0.0, { n: 30, len: 12, w: 0.13, type: (x) => (x < 0.1 ? 1 : 0), start: 0.7 });
    for (const [x, z, r, s] of [[-3.0, 0.4, 3.5, 0.05], [-6.5, -2.8, 3.0, 0.41], [-5.0, 3.2, 2.3, 0.73], [-12.5, -6, 3.4, 0.22], [-8, -22, 5.0, 0.55], [-21, -21, 3.8, 0.9]]) this.splat(f3 + 2, [x, z < -15 ? 5 : 0, z], r, 1, 9, s);
    for (const [x, z, r, s] of [[3.0, -0.4, 3.5, 0.15], [6.5, 2.6, 3.0, 0.61], [5.2, -3.3, 2.3, 0.33], [12.6, -6, 3.4, 0.8], [9, -22, 5.0, 0.47], [22, -21, 3.8, 0.19]]) this.splat(f3 + 2, [x, z < -15 ? 5 : 0, z], r, 2, 9, s);
    this.burst(f3, [0.1, 0.25, 0], { n: 260, dir: [0, 0.55, 0], spread: 1.3, speed: [4, 17], size: [0.03, 0.13], tag: 'split', splitX: 0.1, kind: 'gravel', box: [1.4, 0.1, 1.4] });
    this.burst(f3, [0.1, 0.3, 0], { n: 46, dir: [0, 0.8, 0], spread: 1.2, speed: [5, 13], size: [0.12, 0.42], tag: 'split', splitX: 0.1, kind: 'rock', box: [1.8, 0.1, 1.8] });
    for (let i = 0; i < 260; i++) {
      const x = rr(this.rng, -30, 30), y = rr(this.rng, 1.2, 15), z = -18.6 + rr(this.rng, -0.3, 0.3);
      const d = Math.hypot(x, y - 1.5, z);
      const ch = this.glassShard([x, y, z], rr(this.rng, 0.1, 0.34), this.rng);
      this.launch(ch, f3 + 2 + Math.round(d * 0.22), [x * 0.12 + rr(this.rng, -1, 1), rr(this.rng, -0.5, 3), rr(this.rng, 3, 9)], [rr(this.rng, -9, 9), rr(this.rng, -9, 9), rr(this.rng, -9, 9)], x < 0 ? 1 : 2);
    }
    for (const p of this.posts) if (Math.abs(p[0].c[0]) < 26) this.blast(p.slice(1), f3 + 5, [0, 0, 0], { power: 3.5, radius: 30, up: 0.2, minPower: 0.5, spin: 2 });

    // H4: she drives him back through the obelisk
    const f4 = F('H4'), s1 = F('s1');
    this.crack(f4, 2.7, 0.0, { n: 12, len: 4.5, w: 0.08, type: 1, start: 0.3 });
    this.splat(f4, [2.9, 0, 0.2], 2.6, 1, 8);
    this.burst(f4, [2.9, 0.1, 0], { n: 70, dir: [0.9, 0.55, 0], spread: 0.8, speed: [3, 11], size: [0.02, 0.1], tag: 1, kind: 'gravel' });
    this.blast(this.obelisk, s1, [8.5, 2.2, 0.0], { power: 5.5, radius: 9, bias: [11, 1.5, -0.6], tag: 1, up: 0.55, minPower: 0.45 });
    this.splat(s1, [9.6, 0.5, -0.25], 3.4, 1, 7);
    this.burst(s1, [9.5, 2.4, -0.2], { n: 90, dir: [1, 0.35, 0], spread: 0.8, speed: [4, 16], size: [0.04, 0.24], tag: 1, kind: 'stone', box: [0.4, 1.4, 0.4] });

    // H5: ink palm, through the brick wall
    const f5 = F('H5'), s2 = F('s2');
    this.splat(f5, [4.6, 1.2, 0], 2.6, 2, 6);
    this.burst(f5, [4.4, 0.05, 0], { n: 80, dir: [-0.9, 0.4, 0], spread: 0.8, speed: [4, 13], size: [0.02, 0.11], tag: 2, kind: 'gravel' });
    this.blast(this.wallA, s2, [-8.4, 2.0, 0.2], { power: 6.5, radius: 3.9, bias: [-17, 1.2, -1.0], tag: 2, up: 0.45, minPower: 0.35 });
    this.splat(s2, [-9.4, 2.1, -0.4], 4.2, 2, 6);
    this.crack(s2, -9.4, -0.4, { n: 9, len: 4, w: 0.08, type: 0, start: 0.5 });
    this.burst(s2, [-9.6, 2.0, -0.2], { n: 150, dir: [-1, 0.28, 0.1], spread: 0.62, speed: [5, 22], size: [0.05, 0.27], tag: 2, kind: 'brick', box: [0.3, 1.3, 1.1] });
    this.splat(s2 + 6, [-15.0, 0, 0.3], 3.0, 2, 5);
    this.crack(s2 + 4, -15.0, 0.3, { n: 11, len: 4.2, w: 0.09, type: 0, start: 0.6 });
    this.burst(s2 + 4, [-15.0, 0.15, 0.3], { n: 50, dir: [-0.5, 1, 0], spread: 0.9, speed: [3, 9], size: [0.04, 0.2], tag: 2, kind: 'brick', box: [0.9, 0.05, 0.9] });

    // H6: rising heel, up and through the storefront and the wall behind it
    const f6 = F('H6'), s3 = F('s3'), s4 = F('s4');
    this.splat(f6, [-1.8, 0, 0], 3.6, 1, 7);
    this.crack(f6, -2.3, 0.0, { n: 12, len: 5, w: 0.08, type: 1, start: 0.4 });
    this.burst(f6, [-1.9, 0.1, 0], { n: 90, dir: [0.25, 1, 0], spread: 0.65, speed: [4, 15], size: [0.02, 0.12], tag: 1, kind: 'gravel' });
    this.blast(this.storefront, s3, [13.6, 3.1, -0.2], { power: 6.5, radius: 4.6, bias: [14, 2.0, -0.4], tag: 1, up: 0.4, minPower: 0.4 });
    this.splat(s3, [14.4, 2.8, -0.6], 2.9, 1, 7);
    this.burst(s3, [14.2, 2.8, -0.3], { n: 170, dir: [1, 0.2, 0.15], spread: 0.75, speed: [5, 20], size: [0.05, 0.22], tag: 1, kind: 'glass', box: [0.5, 1.4, 1.5] });
    this.burst(s3, [14.4, 3.0, -0.5], { n: 50, dir: [1, 0.35, 0], spread: 0.6, speed: [5, 15], size: [0.08, 0.34], tag: 1, kind: 'stone', box: [0.3, 1.1, 1.2] });
    this.blast(this.wallC, s4, [18.8, 2.5, 0], { power: 6.5, radius: 3.9, bias: [16, 1.0, -0.8], tag: 1, up: 0.4, minPower: 0.4 });
    this.splat(s4, [19.8, 2.4, -0.3], 2.6, 1, 6);
    this.burst(s4, [20.0, 2.3, -0.2], { n: 120, dir: [1, 0.15, 0], spread: 0.6, speed: [6, 21], size: [0.05, 0.25], tag: 1, kind: 'brick', box: [0.3, 1.0, 1.0] });
    this.splat(s4 + 8, [24.2, 0, 0.0], 2.8, 1, 5);

    // his take-off blasts the rubble off the stretch of street he is about to open
    this.clearAround(456, [26.8, 0, 0], 10.5, 17, 2);

    // H7: two-fist hammer; the street opens
    const f7 = F('H7');
    this.splat(f7 + 5, [27.5, 0, 0], 5.4, 2, 7);
    this.crack(f7, 27.3, 0, { n: 22, len: 9, w: 0.17, type: 0, start: 0.7 });
    this.crack(f7 + 1, 28.0, 0, { n: 3, len: 38, w: 0.85, type: 0, from: -0.13, arc: 0.4, start: 0.2, branch: 0.9 });
    this.crack(f7 + 2, 30.0, 1.9, { n: 2, len: 30, w: 0.24, type: 0, from: -0.05, arc: 0.2, start: 0.2, branch: 1.0 });
    this.crack(f7 + 2, 30.0, -1.9, { n: 2, len: 30, w: 0.24, type: 0, from: -0.12, arc: 0.2, start: 0.2, branch: 1.0 });
    for (let i = 0; i < this.fisSlabs.length; i++) {
      const ch = this.fisSlabs[i];
      const along = ch.c[0] - FISSURE.x0;
      const k = Math.max(0.25, 1 - along / 52);
      this.launch(ch, f7 + 1 + Math.round(along * 0.36), [rr(this.rng, -1, 1.4), rr(this.rng, 4.5, 11.5) * k, ch.side * rr(this.rng, 0.6, 3.0)], [ch.side * rr(this.rng, 0.4, 3.0) * k, rr(this.rng, -0.8, 0.8), rr(this.rng, -2.2, 2.2) * k], 2);
    }
    for (let x = 31; x < 60; x += 6.5) {
      this.splat(f7 + Math.round((x - 26) * 0.4), [x, 0, 0], 2.3, 2, 6);
      this.burst(f7 + Math.round((x - 26) * 0.36), [x, 0.1, 0], { n: 28, dir: [0.1, 1, 0], spread: 0.6, speed: [4, 13], size: [0.04, 0.2], tag: 2, kind: 'rock', box: [1.2, 0.05, 0.6] });
    }
    this.burst(f7, [27.4, 0.15, 0], { n: 200, dir: [0, 0.8, 0], spread: 1.2, speed: [4, 18], size: [0.03, 0.15], tag: 2, kind: 'gravel', box: [1.0, 0.1, 1.0] });
    this.burst(f7, [27.4, 0.2, 0], { n: 34, dir: [0, 1, 0], spread: 1.0, speed: [5, 13], size: [0.25, 0.7], tag: 2, kind: 'slab', box: [1.5, 0.1, 1.5] });
    this.blast(this.car2, f7 + 3, [29, -0.8, 1.0], { power: 5.0, radius: 9, up: 1.0, tag: 2, minPower: 0.7, spin: 2.0 });

    // H8: wheel kick; he ploughs down the street into the tower
    const f8 = F('H8'), s5 = F('s5'), s6 = F('s6'), s7 = F('s7');
    this.splat(f8, [31.6, 1.2, 0], 3.2, 1, 6);
    this.burst(f8, [31.6, 0.2, 0], { n: 60, dir: [1, 0.45, 0], spread: 0.7, speed: [5, 16], size: [0.03, 0.14], tag: 1, kind: 'gravel' });
    this.blast(this.car1, s5, [34.0, 0.4, 0.2], { power: 7.5, radius: 6, bias: [13, 4.5, -1.0], tag: 1, up: 0.55, minPower: 0.6, spin: 5 });
    this.burst(s5, [35.2, 1.1, -0.3], { n: 80, dir: [1, 0.5, 0.1], spread: 0.8, speed: [4, 16], size: [0.04, 0.2], tag: 1, kind: 'glass', box: [0.8, 0.4, 0.5] });
    this.burst(s5, [35.2, 0.9, -0.3], { n: 28, dir: [1, 0.55, 0], spread: 0.8, speed: [5, 14], size: [0.1, 0.42], tag: 1, kind: 'metal' });
    this.splat(s5, [35.4, 0, -0.3], 3.4, 1, 6);
    this.blast(this.pathPosts[0].slice(1), s6 - 1, [39.2, 1.6, -0.55], { power: 5, radius: 8, bias: [12, 3, 0.8], tag: 1, minPower: 0.7, spin: 7 });
    this.blast(this.pathPosts[1].slice(1), s6 + 1, [42.8, 1.6, 0.45], { power: 5, radius: 8, bias: [12, 3.5, -0.8], tag: 1, minPower: 0.7, spin: 7 });
    for (let x = 33; x < 50; x += 2.8) this.splat(f8 + Math.round((x - 32) * 1.05), [x, 0, 0], 1.7, 1, 4);
    const baseHit = this.towerChunks.filter(c => c.c[0] < 53.5 && c.c[1] < 6.2 && c.c[2] > -4.6 && c.c[2] < 2.9);
    this.blast(baseHit, s7, [53.6, 2.0, -0.6], { power: 5.2, radius: 4.8, bias: [-5.5, 1.4, 2.2], tag: 1, up: 0.45, minPower: 0.3 });
    this.splat(s7, [50.5, 2.4, 0.3], 4.0, 1, 6, 0.37, 0.85);
    this.crack(s7, 49.8, 0.2, { n: 14, len: 7, w: 0.13, type: 1, from: Math.PI * 0.5, arc: Math.PI, start: 0.8 });
    this.burst(s7, [50.2, 2.2, 0.2], { n: 130, dir: [-0.7, 0.5, 0.45], spread: 0.7, speed: [4, 17], size: [0.05, 0.28], tag: 1, kind: 'rock', box: [0.3, 1.6, 1.5] });

    // H9: she is thrown through the tower
    const f9 = F('H9'), s8 = F('s8');
    const entry = this.towerChunks.filter(c => c.c[2] > 1.4 && Math.abs(c.c[0] - 55.2) < 3.4 && c.c[1] > 10.8 && c.c[1] < 17.8);
    this.blast(entry, f9, [55.2, 14.2, -0.8], { power: 5.0, radius: 6.0, bias: [0.6, 1.0, 7.5], tag: 2, up: 0.3, minPower: 0.4, keepZ: true });
    this.splat(f9, [55.2, 14.2, 2.5], 4.6, 2, 5);
    this.splat(f9 + 3, [57.6, 15.2, -2.0], 5.6, 1, 6);
    this.splat(f9 + 8, [62.0, 16.4, -4.5], 5.6, 1, 6);
    this.burst(f9, [55.2, 14.2, 2.9], { n: 130, dir: [-0.15, 0.15, 1], spread: 0.8, speed: [4, 17], size: [0.06, 0.34], tag: 2, kind: 'rock', box: [1.4, 1.5, 0.2], keepZ: true });
    this.burst(f9, [55.2, 14.2, 2.9], { n: 110, dir: [-0.2, 0.2, 1], spread: 1.0, speed: [4, 15], size: [0.06, 0.2], tag: 2, kind: 'glass', box: [2.2, 2.0, 0.2], keepZ: true });
    const exit = this.towerChunks.filter(c => c.c[0] > 62.4 && c.c[1] > 14.0 && c.c[1] < 21 && c.c[2] > -8 && c.c[2] < -0.5);
    this.blast(exit, s8, [61.4, 17.0, -4.4], { power: 5.0, radius: 6.5, bias: [11, 2.4, -1.0], tag: 1, up: 0.3, minPower: 0.4 });
    this.burst(s8, [63.9, 17.0, -4.4], { n: 160, dir: [1, 0.25, -0.1], spread: 0.55, speed: [6, 24], size: [0.07, 0.36], tag: 1, kind: 'rock', box: [0.2, 1.6, 1.6] });
    this.burst(s8, [63.9, 17.0, -4.4], { n: 90, dir: [1, 0.3, 0], spread: 0.7, speed: [6, 19], size: [0.07, 0.22], tag: 1, kind: 'glass', box: [0.2, 1.8, 1.8] });
    this.cutTower();

    // H10 happens in the sky; H11 too. H12: the ground itself
    const f12 = F('H12');
    this.splat(f12 + 8, [24.5, 0, 0], 8.0, 1, 6, 0.07);
    this.splat(f12 + 9, [24.5, 0, 0], 15.0, 1, 14, 0.52, 0.9);
    for (const [x, z, r] of [[9, -13, 6], [39, -12, 6.5], [13, 13, 5.5], [37, 14, 6], [4, -30, 5], [44.5, -28, 4.5], [25, -34, 5.5]]) this.splat(f12 + 12, [x, z < -20 ? 6 : 0, z], r, 1, 12);
    this.crack(f12, 24.5, 0, { n: 26, len: 11, w: 0.20, type: 0, start: 2.3 });
    this.crack(f12 + 8, 24.5, 0, { n: 30, len: 24, w: 0.17, type: 1, start: 4.5 });
    this.blast(this.ringCrater, f12 + 8, [24.5, -4.5, 0], { power: 19, radius: 19, up: 0.95, tag: 1, delayPerM: 0.28, minPower: 0.5, spin: 4 });
    this.burst(f12 + 1, [24.5, 0.2, 0], { n: 130, dir: [0, 0.6, 0], spread: 1.3, speed: [7, 27], size: [0.04, 0.17], tag: 1, kind: 'gravel', box: [0.3, 0.15, 0.3], hole: 3.4 });
    this.burst(f12 + 8, [24.5, -0.6, 0], { n: 150, dir: [0, 0.85, 0], spread: 1.25, speed: [8, 25], size: [0.16, 0.75], tag: 1, kind: 'rock', box: [5, 0.4, 5], minOut: 9 });
    this.burst(f12 + 8, [24.5, -0.6, 0], { n: 16, dir: [0, 1, 0], spread: 1.0, speed: [10, 21], size: [0.7, 1.4], tag: 1, kind: 'slab', box: [6, 0.3, 6], minOut: 11 });
    const nearCity = this.cityChunks.filter(c => c.c[2] < 0 && c.c[2] > -29 && c.c[0] > -4 && c.c[0] < 52 && c.c[1] > 2);
    this.blast(nearCity, f12 + 9, [24.5, 0, 0], { power: 9, radius: 34, bias: [0, 1, -3], tag: 1, delayPerM: 0.35, minPower: 0.2, spin: 2.5 });
    this.toppleTowers();
  }

  // the cut: the top of the tower slides down the line, tips, and bursts on landing
  cutTower() {
    const cn = this.tower.cut.n;
    const downhill = V.norm([cn[1], -cn[0], 0]);            // along the plane, falling to the east
    const top = this.towerChunks.filter(c => c.top === 1 && c.events.length === 0);
    const pivot = [63.5, this.tower.cut.p[1] - 0.46 * 6.5, -3.5];
    const f0 = 655, f1 = 692;
    this.towerGroup = {
      f0, f1, chunks: top,
      pose: (f) => {
        const t = clamp((f - f0) / 24, 0, 3);
        const slide = 10.5 * Math.pow(t, 1.65);
        const tip = Math.max(0, f - (f0 + 12)) / 24;
        const ang = -0.52 * tip * tip;
        const drop = 7.5 * Math.max(0, tip - 0.35) ** 2 * 3.2;
        const q = Q.axis([0, 0, 1], ang);
        const piv = V.mad(pivot, downhill, slide);
        return { q, move: p => V.add(V.add(piv, Q.rot(q, V.sub(V.mad(p, downhill, slide), piv))), [0, -drop, 0]) };
      },
    };
    for (const ch of top) ch.group = this.towerGroup;
    // landing: every piece goes its own way
    for (const ch of top) {
      const a = this.towerGroup.pose(f1 - 1).move(ch.c), b = this.towerGroup.pose(f1).move(ch.c);
      const v = V.mul(V.sub(b, a), 24);
      const jitter = [rr(this.rng, -3, 5), rr(this.rng, 0, 6), rr(this.rng, -4, 4)];
      const hitF = f1 + Math.round(clamp((b[1] - 4) / 3.2, 0, 14));
      this.launch(ch, f1, V.add(V.mul(v, 0.55), jitter), [rr(this.rng, -3, 3), rr(this.rng, -3, 3), rr(this.rng, -3, 3)], this.rng() < 0.5 ? 2 : 0);
    }
    this.splat(f0 - 4, [57, 0, -3], 0.01, 2, 1);
    this.burst(f1 + 2, [68, 1.5, -3], { n: 90, dir: [0.2, 1, 0], spread: 1.2, speed: [5, 16], size: [0.1, 0.8], tag: 2, kind: 'rock', box: [4, 1, 4] });
  }

  toppleTowers() {
    for (const tw of this.sideTowers) {
      const away = V.norm([tw.x - 24.5, 0, tw.z * 1.1]);
      const axis = V.norm(V.cross([0, 1, 0], away));
      const pivot = [tw.x + away[0] * tw.sx * 0.5, 0, tw.z + away[2] * tw.sz * 0.5];
      const f0 = tw.f, fHit = f0 + 24;
      const g = {
        f0, f1: fHit, chunks: tw.chunks,
        pose: f => {
          const t = clamp((f - f0) / 24, 0, 2);
          const ang = Math.min(1.25, 1.25 * t * t * t * 0.9 + 0.10 * t);
          const q = Q.axis(axis, ang);
          const sink = 5.0 * t * t;
          return { q, move: p => V.add(V.add(pivot, Q.rot(q, V.sub(p, pivot))), [0, -sink * clamp(p[1] / tw.h + 0.3), 0]) };
        },
      };
      for (const ch of tw.chunks) {
        ch.group = g;
        const a = g.pose(fHit - 1).move(ch.c), b = g.pose(fHit).move(ch.c);
        const v = V.mul(V.sub(b, a), 24);
        this.launch(ch, fHit + Math.floor(this.rng() * 3), V.add(V.mul(v, 0.42), [rr(this.rng, -4, 4), rr(this.rng, 0, 7), rr(this.rng, -4, 4)]), [rr(this.rng, -2.5, 2.5), rr(this.rng, -2.5, 2.5), rr(this.rng, -2.5, 2.5)], this.rng() < 0.45 ? 1 : 0);
      }
      this.groups['tw' + tw.x] = g;
    }
  }

  finalBlast() {
    const f = HIT.H13.f + 8;
    const C = [23.5, 0, 0];
    const everything = this.chunks.slice(1).filter(c => !c.hidden || c.events.length > 0);
    for (const ch of everything) {
      const dx = ch.c[0] - C[0], dz = ch.c[2] - C[2];
      // where is it now?
      const st = ch.events.length ? this.restGuess(ch) : ch.c;
      const d = Math.hypot(st[0] - C[0], st[2] - C[2]);
      if (d > 200) continue;
      if (st[1] < 0.8 && d > 70) continue;
      const delay = Math.round(Math.max(0, d - 6) * 0.2);
      const out = V.norm([st[0] - C[0], 0, st[2] - C[2]]);
      const k = clamp(1.25 - d / 190, 0.2, 1);
      let sp = rr(this.rng, 16, 44) * k * (ch.radius > 4 ? 0.65 : 1);
      let up = rr(this.rng, 3, 20) * k;
      if (d < 44) { sp = Math.max(sp, (52 - d) * rr(this.rng, 0.80, 1.35)); up = Math.max(up, rr(this.rng, 9, 22)); }
      this.launch(ch, f + delay, [out[0] * sp, up, out[2] * sp], [rr(this.rng, -4, 4), rr(this.rng, -4, 4), rr(this.rng, -4, 4)], this.rng() < 0.5 ? (st[0] < C[0] ? 1 : 2) : (this.rng() < 0.5 ? 1 : 2));
    }
    this.blast(this.ringFinal, f, [23.5, -9, 0], { power: 46, radius: 40, up: 0.75, tag: 'split', delayPerM: 0.18, minPower: 0.75, spin: 3, keepZ: true });
    this.burst(f, [23.5, 0.5, 0], { n: 320, dir: [0, 0.6, 0], spread: 1.3, speed: [14, 48], size: [0.1, 0.5], tag: 'split', splitX: 23.5, kind: 'gravel', box: [4, 0.3, 4], minOut: 34, keepZ: true });
    this.burst(f, [23.5, 0.2, 0], { n: 200, dir: [0, 0.75, 0], spread: 1.25, speed: [12, 38], size: [0.4, 1.5], tag: 'split', splitX: 23.5, kind: 'rock', box: [8, 0.5, 8], minOut: 38, keepZ: true });
    this.crack(f, 23.5, 0, { n: 30, len: 55, w: 0.42, type: 0, start: 34 });
    this.splat(HIT.H13.f + 8, [16, 0, 0], 17, 1, 18, 0.33);
    this.splat(HIT.H13.f + 8, [32, 0, 0], 17, 2, 18, 0.66);
  }
  restGuess(ch) {
    const e = ch.events[ch.events.length - 1];
    const t = 1.2;
    const p = e.pos || ch.c;
    return [p[0] + e.v[0] * t * 0.7, Math.max(0.3, p[1] + e.v[1] * 0.6 - 4), p[2] + e.v[2] * t * 0.7];
  }

  // ----- deterministic ballistic simulation, baked into segments -----
  simulate() {
    // process events in time order so rubble piles up consistently
    for (let id = 1; id < this.chunks.length; id++) {
      const ch = this.chunks[id];
      ch.events.sort((a, b) => a.f - b.f);
      ch.segs = [];
      const half = Math.max(0.01, Math.min(ch.ext[0], ch.ext[1], ch.ext[2]) * 0.5);
      // axis of least extent: which way is "flat"
      let thin = 0;
      if (ch.ext[1] <= ch.ext[0] && ch.ext[1] <= ch.ext[2]) thin = 1; else if (ch.ext[2] <= ch.ext[0] && ch.ext[2] <= ch.ext[1]) thin = 2;
      ch.restHalf = half; ch.thinAxis = thin;
    }
    const queue = [];
    for (let id = 1; id < this.chunks.length; id++) this.chunks[id].events.forEach((e, k) => queue.push({ id, k, wt: e.wt }));
    queue.sort((a, b) => a.wt - b.wt || a.id - b.id);
    for (const item of queue) {
      const ch = this.chunks[item.id], e = ch.events[item.k];
      const next = ch.events[item.k + 1];
      const until = next ? next.wt : 1e9;
      // state at the moment of this launch
      let st;
      if (ch.segs.length) st = this.evalSegs(ch, e.wt);
      else if (ch.group && e.f >= ch.group.f0) { const g = ch.group.pose(e.f); st = { p: g.move(ch.c), q: g.q }; }
      else st = { p: ch.c.slice(), q: [0, 0, 0, 1] };
      while (ch.segs.length && ch.segs[ch.segs.length - 1].t0 >= e.wt) ch.segs.pop();
      let p = e.pos || st.p, q = st.q, v = e.v.slice(), w = e.w.slice(), t = e.wt;
      const gAt = (x, z) => groundHeight(x, z, e.f + 30);
      if (p[1] < gAt(p[0], p[2]) + ch.restHalf * 0.5) p = [p[0], gAt(p[0], p[2]) + ch.restHalf * 0.5, p[2]];
      let bounces = 0;
      for (let guard = 0; guard < 6; guard++) {
        const seg = { t0: t, type: 0, p, v, q, w, tag: e.tag, tagSeed: e.tagSeed, launch: ch.segs.length ? ch.segs[0].launch : e.wt };
        ch.segs.push(seg);
        // time until the lowest point reaches the ground
        let tl = 0, hit = false;
        const dt = 1 / 30;
        for (let s = 1; s < 240; s++) {
          tl = s * dt;
          const y = p[1] + v[1] * tl - 0.5 * GRAV * tl * tl;
          const x = p[0] + v[0] * tl, z = p[2] + v[2] * tl;
          const vy = v[1] - GRAV * tl;
          if (vy < 0 && y - ch.restHalf <= gAt(x, z)) { hit = true; break; }
        }
        if (!hit || t + tl >= until) break;
        const hp = [p[0] + v[0] * tl, 0, p[2] + v[2] * tl];
        const gh = gAt(hp[0], hp[2]);
        hp[1] = gh + ch.restHalf;
        const wl = V.len(w);
        const hq = wl > 1e-4 ? Q.norm(Q.mul(Q.axis(w, wl * tl), q)) : q;
        const impactSpeed = Math.abs(v[1] - GRAV * tl);
        bounces++;
        t += tl; p = hp; q = hq;
        if (impactSpeed < 3.4 || bounces >= 3 || ch.radius > 3) {
          // settle: tip onto the flattest face and slide a little
          const axis = ch.thinAxis === 0 ? [1, 0, 0] : (ch.thinAxis === 1 ? [0, 1, 0] : [0, 0, 1]);
          const cur = Q.rot(q, axis);
          const tgt = [0, cur[1] >= 0 ? 1 : -1, 0];
          const ax = V.cross(cur, tgt);
          const ang = Math.acos(clamp(V.dot(cur, tgt), -1, 1));
          let rq = q;
          if (V.len(ax) > 1e-4) rq = Q.norm(Q.mul(Q.axis(ax, ang * 0.86), q));
          const slide = [v[0] * 0.09, 0, v[2] * 0.09];
          const rp = [p[0] + slide[0], 0, p[2] + slide[2]];
          const key = Math.round(rp[0] / 1.1) + ',' + Math.round(rp[2] / 1.1);
          const stack = this.pile.get(key) || 0;
          rp[1] = gAt(rp[0], rp[2]) + ch.restHalf + stack * 0.7;
          if (ch.radius < 1.2) this.pile.set(key, Math.min(stack + ch.restHalf * 0.5, 1.3));
          ch.segs.push({ t0: t, type: 1, p, q, p1: rp, q1: rq, dur: 0.28, tag: e.tag, tagSeed: e.tagSeed, launch: ch.segs[0].launch });
          break;
        }
        v = [v[0] * 0.58, impactSpeed * 0.27, v[2] * 0.58];
        w = V.mul(w, 0.6);
      }
    }
  }
  evalSegs(ch, wt) {
    let s = ch.segs[0];
    for (let i = ch.segs.length - 1; i >= 0; i--) if (ch.segs[i].t0 <= wt) { s = ch.segs[i]; break; }
    const t = Math.max(0, wt - s.t0);
    if (s.type === 1) {
      const u = Ease.out(clamp(t / s.dur));
      return { p: V.lerp(s.p, s.p1, u), q: Q.slerp(s.q, s.q1, u), seg: s };
    }
    const p = [s.p[0] + s.v[0] * t, s.p[1] + s.v[1] * t - 0.5 * GRAV * t * t, s.p[2] + s.v[2] * t];
    const wl = V.len(s.w);
    const q = wl > 1e-4 ? Q.norm(Q.mul(Q.axis(s.w, wl * t), s.q)) : s.q;
    return { p, q, seg: s };
  }

  bakeMeshes() {
    const out = [];
    for (let id = 0; id < this.chunks.length; id++) {
      const ch = this.chunks[id];
      for (const tri of ch.tris) for (const p of tri.p) {
        const l = V.sub(p, ch.c);
        out.push(l[0], l[1], l[2], tri.n[0], tri.n[1], tri.n[2], id, tri.meta[0], tri.meta[1], tri.meta[2], tri.meta[3], p[0], p[1], p[2]);
      }
      ch.tris = null;
    }
    this.chunkVerts = new Float32Array(out);
    this.chunkCount = this.chunks.length;
    this.chunkData = new Float32Array(1536 * Math.ceil(this.chunkCount / 512) * 4);
    this.crackVerts = new Float32Array(this.cracks);
    this.cracks = null;
  }

  // write every chunk's transform for this frame
  update(f, cam = null, subjects = []) {
    const wt = WARP(f);
    const sub = cam ? subjects.map(q => { const d = V.sub(q.c, cam.pos), L = V.len(d) || 1; return { dir: V.mul(d, 1 / L), L, r: q.r }; }) : [];
    this.wt = wt;
    const D = this.chunkData;
    for (let id = 0; id < this.chunkCount; id++) {
      const ch = this.chunks[id];
      const k = ((Math.floor(id / 512)) * 1536 + (id % 512) * 3) * 4;
      let p = ch.c, q = [0, 0, 0, 1], vis = ch.hidden ? 0 : 1, launch = 1e9, tag = 0, seed = 0;
      if (ch.segs && ch.segs.length && wt >= ch.segs[0].t0) {
        const st = this.evalSegs(ch, wt);
        p = st.p; q = st.q; vis = 1; launch = st.seg.launch; tag = st.seg.tag; seed = st.seg.tagSeed;
      } else if (ch.group && f >= ch.group.f0) {
        const g = ch.group.pose(f);
        p = g.move(ch.c); q = g.q; launch = WARP(ch.group.f0);
      }
      if (p[1] < -14) vis = 0;
      let sc = 1;
      if (vis && cam && launch < 1e9) {
        const vx = p[0] - cam.pos[0], vy = p[1] - cam.pos[1], vz = p[2] - cam.pos[2];
        const dist = Math.hypot(vx, vy, vz), rad = ch.radius;
        sc = clamp((dist - rad * 1.6 - 0.5) / (rad * 1.4 + 1.0));
        if (rad > 0.05) for (const q of sub) {
          const t = vx * q.dir[0] + vy * q.dir[1] + vz * q.dir[2];
          if (t <= 0 || t > q.L - 0.35) continue;
          const perp = Math.sqrt(Math.max(0, dist * dist - t * t));
          const need = rad * 0.9 + q.r * (t / q.L);
          if (perp < need) {
            const hide = smooth(0, 0.35 * need, need - perp) * smooth(0.04, 0.16, rad);
            sc *= 1 - hide;
          }
        }
        if (sc < 0.02) vis = 0;
      }
      D[k] = p[0]; D[k + 1] = p[1]; D[k + 2] = p[2]; D[k + 3] = vis;
      D[k + 4] = q[0]; D[k + 5] = q[1]; D[k + 6] = q[2]; D[k + 7] = q[3];
      D[k + 8] = launch; D[k + 9] = tag; D[k + 10] = seed; D[k + 11] = sc;
    }
  }

  groundState(f) {
    const craters = [];
    for (const c of CRATERS) craters.push({ x: c.x, z: c.z, R: c.R, depth: c.depth, p: craterProgress(c, f) });
    const ripples = [];
    for (const [hf, x, z, amp] of [[204, 0.1, 0, 0.55], [474, 27.4, 0, 0.8], [794, 24.5, 0, 1.0], [802, 24.5, 0, 1.6], [1092, 23.5, 0, 2.8], [564, 50.5, 0, 0.4], [54, 0.02, 2.47, 0.05]]) {
      const age = WARP(f) - WARP(hf);
      if (f >= hf && age < 1.8) ripples.push({ x, z, age, amp });
    }
    return { craters, fissure: [FISSURE.x0, FISSURE.x1, FISSURE.z, FISSURE.w], fisP: fissureProgress(f), ripples };
  }
  paintState(f) {
    const out = [];
    for (const s of this.splats) {
      if (f < s.f) continue;
      const u = invlerp(s.f - 1, s.f + s.grow, f);
      out.push({ p: s.p, r: s.r * Ease.out3(u), type: s.type, seed: s.seed, birth: s.birth, alpha: s.alpha });
    }
    return out;
  }

  buildGround() {
    const axis = (fine0, fine1, step, limit) => {
      const a = [];
      for (let x = fine0; x <= fine1 + 1e-6; x += step) a.push(x);
      let s = step, x = fine0;
      while (x > -limit) { s *= 1.22; x -= s; a.unshift(x); }
      s = step; x = a[a.length - 1];
      while (x < limit) { s *= 1.22; x += s; a.push(x); }
      return a;
    };
    const xs = axis(-24, 70, 0.34, 900), zs = axis(-30, 26, 0.34, 900);
    const v = new Float32Array((xs.length - 1) * (zs.length - 1) * 12);
    let k = 0;
    for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1], z0 = zs[j], z1 = zs[j + 1];
      v.set([x0, z0, x0, z1, x1, z1, x0, z0, x1, z1, x1, z0], k); k += 12;
    }
    this.groundVerts = v;
    const cx = axis(-60, 120, 1.6, 900), cz = axis(-80, 40, 1.6, 900);
    const c = new Float32Array((cx.length - 1) * (cz.length - 1) * 12);
    k = 0;
    for (let j = 0; j < cz.length - 1; j++) for (let i = 0; i < cx.length - 1; i++) {
      const x0 = cx[i], x1 = cx[i + 1], z0 = cz[j], z1 = cz[j + 1];
      c.set([x0, z0, x0, z1, x1, z1, x0, z0, x1, z1, x1, z0], k); k += 12;
    }
    this.cloudVerts = c;
  }
}
