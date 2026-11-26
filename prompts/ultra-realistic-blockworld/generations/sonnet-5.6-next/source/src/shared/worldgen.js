// ---------------------------------------------------------------- world generation (pure & deterministic)
const CSPLINE = [[-1, -38], [-0.42, -22], [-0.22, -9], [-0.11, -3], [-0.055, 1.4], [0.05, 4.5], [0.2, 9], [0.45, 17], [1, 28]];
function spline(pts, v) {
  if (v <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (v <= pts[i][0]) {
      const a = pts[i - 1], b = pts[i];
      return lerp(a[1], b[1], smooth01((v - a[0]) / (b[0] - a[0])));
    }
  }
  return pts[pts.length - 1][1];
}

class WorldGen {
  constructor(seed, features) {
    this.seed = seed >>> 0;
    const S = (k) => new Simplex(ihash(seed, k, 991));
    this.sC = S(1); this.sE = S(2); this.sM = S(3); this.sH = S(4); this.sT = S(5); this.sW = S(6); this.sR = S(7);
    this.sX = S(8); this.sD = S(9); this.sK = S(10); this.sK2 = S(11); this.sG = S(12); this.sF = S(13);
    this.features = features || {};
    this.villageCache = new Map();
    this.colCache = new Map();
  }

  // ---- raw column (no structures)
  baseColumn(x, z, o) {
    const wx = x + this.sX.n2(x / 310, z / 310) * 46 + this.sX.n2(x / 71, z / 71) * 9;
    const wz = z + this.sX.n2(x / 310 + 37, z / 310 - 11) * 46 + this.sX.n2(x / 71 - 5, z / 71 + 23) * 9;
    let cont = this.sC.fbm2(wx / 1500, wz / 1500, 5, 0.52) * 1.55 + 0.1;
    cont = clamp(cont, -1, 1);
    const ero = this.sE.fbm2(wx / 760, wz / 760, 3) * 1.4;
    let temp = this.sT.fbm2(x / 1500 + 3.7, z / 1500 - 1.3, 3, 0.45) * 1.55;
    let hum = this.sW.fbm2(x / 1250 - 7.1, z / 1250 + 4.9, 3, 0.45) * 1.55;
    // keep borders organic
    const bn = this.sD.n2(x / 64, z / 64) * 0.035 + this.sD.n2(x / 17, z / 17) * 0.012;
    temp += bn; hum -= bn;

    const inland = sstep(-0.07, 0.16, cont);
    let h = SEA + spline(CSPLINE, cont);
    const hillAmp = lerp(15, 2.5, sstep(-0.25, 0.45, ero));
    h += this.sH.fbm2(wx / 190, wz / 190, 4) * hillAmp * inland;
    h += this.sH.fbm2(x / 33, z / 33, 3) * 1.5 * inland;

    const desert = sstep(0.14, 0.3, temp) * sstep(0.06, -0.12, hum) * sstep(-0.05, 0.03, cont);

    // mountains
    let mm = sstep(0.03, 0.42, this.sM.fbm2(wx / 1050, wz / 1050, 3) * 1.5);
    mm *= sstep(-0.06, 0.2, cont) * (1 - 0.75 * sstep(0.12, 0.6, ero)) * (1 - desert * 0.85);
    let ridge = 0;
    if (mm > 0.001) {
      ridge = erodedRidge(wx / 330, wz / 330, 6, this.seed + 401);
      h += mm * (Math.pow(ridge, 1.35) * 178 + 10) + mm * this.sD.fbm2(x / 47, z / 47, 3) * 5;
    }

    // desert: dunes and layered mesas
    let mesa = 0;
    if (desert > 0.001) {
      const wind = (x * 0.83 + z * 0.55) / 36 + this.sD.n2(x / 140, z / 140) * 1.7 + this.sD.n2(x / 51, z / 51) * 0.35;
      const f = wind - Math.floor(wind);
      const prof = f < 0.72 ? Math.pow(f / 0.72, 1.35) : Math.pow((1 - f) / 0.28, 1.1);
      const duneAmp = clamp(this.sH.n2(x / 230, z / 230) * 0.8 + 0.55, 0, 1);
      h += prof * duneAmp * 6.5 * desert;
      const mn = this.sF.fbm2(wx / 245, wz / 245, 4, 0.5) + this.sD.n2(x / 19, z / 19) * 0.022 + this.sD.n2(x / 6.5, z / 6.5) * 0.0065;
      const md = sstep(0.35, 0.65, desert);
      if (md > 0) {
        const talus = sstep(0.10, 0.2, mn);
        const t1 = sstep(0.196, 0.214, mn), t2 = sstep(0.31, 0.325, mn), t3 = sstep(0.43, 0.442, mn);
        const lift = talus * talus * 7 + t1 * 14 + t2 * 10 + t3 * 7;
        if (lift > 0) h = lerp(h, h * (1 - t1) + (SEA + 9 + this.sD.n2(x / 90, z / 90) * 1.2) * t1, md) + lift * md;
        mesa = t1 * md;
      }
    }

    // swamp flats
    let swamp = sstep(0.12, 0.3, hum) * sstep(-0.08, 0.05, temp) * sstep(0.34, 0.14, temp - 0.2) * sstep(-0.1, -0.03, cont);
    swamp *= sstep(SEA + 13, SEA + 5, h) * (1 - mm) * sstep(0.0, 0.25, this.sG.n2(x / 420, z / 420) + 0.35);
    if (swamp > 0.001) {
      const flat = SEA + 0.35 + this.sD.fbm2(x / 21, z / 21, 3) * 2.6;
      h = lerp(h, flat, swamp);
    }

    // lakes
    let lake = 0;
    if (inland > 0.5 && mm < 0.2 && desert < 0.3) {
      const ln = this.sF.n2(x / 170 + 71, z / 170 - 13) + this.sD.n2(x / 37, z / 37) * 0.09;
      lake = sstep(0.62, 0.8, ln) * sstep(SEA + 18, SEA + 9, h) * (1 - mm * 5);
      if (lake > 0) h = lerp(h, SEA - 5.5, lake);
    }

    // rivers: meandering zero-crossings of a warped noise, carving valleys
    const rx = wx + this.sX.n2(x / 150, z / 150) * 34, rz = wz + this.sX.n2(x / 150 + 9, z / 150 + 9) * 34;
    const rn = Math.abs(this.sR.n2(rx / 780, rz / 780));
    let river = 0, valley = 0;
    if (cont > -0.09 && rn < 0.17) {
      const wid = 0.017 + sstep(0.1, -0.05, cont) * 0.012;
      valley = Math.pow(sstep(0.17, wid, rn), 1.7) * (1 - 0.88 * sstep(0.05, 0.45, mm));
      if (h > SEA + 2.2) h = lerp(h, SEA + 2.2 + this.sD.n2(x / 29, z / 29) * 0.9, valley * (1 - desert * mesa));
      river = sstep(wid * 1.25, wid * 0.55, rn) * (1 - sstep(0.12, 0.42, mm)) * (1 - desert * 0.9);
      if (river > 0) {
        const bed = SEA - 3.6 + this.sD.n2(x / 13, z / 13) * 0.8;
        if (h > bed) h = lerp(h, bed, river);
      }
    }

    o.h = clamp(h, 6, WORLD_H - 24);
    o.cont = cont; o.temp = temp; o.hum = hum; o.mm = mm; o.desert = desert; o.mesa = mesa; o.swamp = swamp;
    o.lake = lake; o.river = river; o.valley = valley; o.rn = rn; o.village = 0;
    return o;
  }

  biomeOf(x, z, c) {
    const h = c.h;
    if (h < SEA - 1.2 && c.river < 0.3 && c.lake < 0.2 && c.swamp < 0.5) return c.temp > 0.06 && h > SEA - 16 ? BIOME.REEF : BIOME.OCEAN;
    if (c.cont < -0.02 && h < SEA + 2.4 && c.swamp < 0.4) return BIOME.BEACH;
    if (c.mm > 0.38 && h > SEA + 42) return BIOME.MOUNTAIN;
    if (c.desert > 0.5) return c.mesa > 0.25 ? BIOME.MESA : BIOME.DESERT;
    const effT = c.temp - Math.max(0, h - SEA - 38) * 0.004;
    if (effT < -0.27) return BIOME.TAIGA;
    if (c.swamp > 0.45) return BIOME.SWAMP;
    const grove = this.sG.n2(x / 360 + 11, z / 360 - 4) + this.sD.n2(x / 70, z / 70) * 0.12;
    if (grove > 0.5 && c.temp > -0.14 && c.temp < 0.4) return BIOME.GROVE;
    if (c.hum > 0.04) return BIOME.FOREST;
    return BIOME.MEADOW;
  }

  // ---- villages: flatten terrain around the site
  villageSite(gx, gz) {
    const key = gx + ',' + gz;
    let v = this.villageCache.get(key);
    if (v !== undefined) return v;
    v = null;
    const R = 640;
    if (rand01(gx, gz, 5, this.seed) < 0.55) {
      const x = Math.floor(gx * R + 90 + rand01(gx, gz, 6, this.seed) * (R - 180));
      const z = Math.floor(gz * R + 90 + rand01(gx, gz, 7, this.seed) * (R - 180));
      const c = this.baseColumn(x, z, {});
      const bio = this.biomeOf(x, z, c);
      if ((bio === BIOME.MEADOW || bio === BIOME.FOREST || bio === BIOME.TAIGA || bio === BIOME.GROVE) && c.h > SEA + 2 && c.h < SEA + 30 && c.mm < 0.1) {
        let ok = true;
        for (let k = 0; k < 8 && ok; k++) {
          const a = k * Math.PI / 4;
          const d = this.baseColumn(x + Math.cos(a) * 30, z + Math.sin(a) * 30, {});
          if (Math.abs(d.h - c.h) > 7 || d.h < SEA + 0.5) ok = false;
        }
        if (ok) v = { x, z, y: Math.floor(c.h), r: 34, seed: ihash(gx, gz, 8, this.seed) };
      }
    }
    this.villageCache.set(key, v);
    return v;
  }
  villageAt(x, z, margin) {
    const f = this.features.village;
    if (f) { const dx = x - f.x, dz = z - f.z; if (dx * dx + dz * dz < (f.r + margin) ** 2) return f; }
    const R = 640;
    const v = this.villageSite(Math.floor(x / R), Math.floor(z / R));
    if (v) { const dx = x - v.x, dz = z - v.z; if (dx * dx + dz * dz < (v.r + margin) ** 2) return v; }
    return null;
  }

  column(x, z, o = {}) {
    this.baseColumn(x, z, o);
    const ru = this.features.ruin;
    if (ru) {
      const d = Math.hypot(x - ru.x, z - ru.z);
      if (d < ru.r + 18) {
        const w = sstep(ru.r + 18, ru.r - 3, d);
        o.h = lerp(o.h, ru.y + 0.5, w);
        if (w > 0.3) { o.river = 0; o.lake = 0; o.swamp = 0; o.village = Math.max(o.village, d < ru.r + 3 ? 1 : 0.3); }
      }
    }
    const v = this.villageAt(x, z, 22);
    if (v) {
      const d = Math.hypot(x - v.x, z - v.z);
      const w = sstep(v.r + 22, v.r - 6, d);
      o.h = lerp(o.h, v.y + 0.5 + this.sD.n2(x / 31, z / 31) * 0.35, w);
      o.village = w;
      if (w > 0.5) { o.river = 0; o.lake = 0; o.swamp = 0; }
    }
    o.biome = this.biomeOf(x, z, o);
    return o;
  }
  col(x, z) { // cached integer column
    const key = (x + 1048576) * 2097152 + (z + 1048576);
    let c = this.colCache.get(key);
    if (c === undefined) {
      c = this.column(x, z, {});
      c.cliff = this.cliffAmount(x, z, c);
      if (this.colCache.size > 60000) this.colCache.clear();
      this.colCache.set(key, c);
    }
    return c;
  }

  cliffAmount(x, z, c) {
    if (c.village > 0 || c.h < SEA + 5) return 0;
    const n = this.sF.n2(x / 140 - 31, z / 140 + 57);
    return clamp(sstep(0.12, 0.5, n) * (0.25 + c.mm) + c.mm * 0.35, 0, 1) * (1 - c.desert) * sstep(SEA + 6, SEA + 18, c.h);
  }
  density(x, y, z, c) {
    return (c.h - y) + (this.sK.n3(x / 23, y / 15, z / 23) * 7.5 + this.sK.n3(x / 10 + 40, y / 8, z / 10) * 2.2) * c.cliff;
  }
  topSolid(x, z) {
    const c = this.col(x, z);
    if (c.cliff <= 0.02) return Math.floor(c.h);
    for (let y = Math.min(WORLD_H - 2, Math.floor(c.h) + 12); y > Math.floor(c.h) - 14; y--) if (this.density(x, y, z, c) > 0) return y;
    return Math.floor(c.h) - 14;
  }

  strata(x, y, z, c) {
    const w = this.sD.n2(x / 97, z / 97) * 4.5 + this.sD.n2(x / 23, z / 23) * 1.1;
    const s = y + w;
    if (c.desert > 0.45 && y > 52) {
      const band = Math.floor(s / 2.4);
      const r = rand01(band, 3, 0, this.seed);
      return r < 0.4 ? B.red_sandstone : r < 0.62 ? B.terracotta : r < 0.74 ? B.pale_sandstone : B.sandstone;
    }
    if (y < 13 + w) return B.basalt;
    if (y < 36 + w * 1.4) return this.sD.n3(x / 31, y / 19, z / 31) > 0.45 ? B.stone : B.slate;
    const band = Math.floor(s / 3.2);
    const r = rand01(band, 4, 0, this.seed);
    const mt = c.mm > 0.2;
    if (r < (mt ? 0.2 : 0.12)) return B.limestone;
    if (r < (mt ? 0.34 : 0.17)) return B.slate;
    return B.stone;
  }

  snowLine(x, z, c) {
    if (c.temp - Math.max(0, c.h - SEA - 38) * 0.004 < -0.27) return SEA - 20;
    return SEA + 88 + c.temp * 46 + this.sD.n2(x / 41, z / 41) * 6 + this.sD.n2(x / 11, z / 11) * 2.5;
  }

  // surface material stack: returns [top, under, underDepth]
  surfaceFor(x, y, z, c, slope, talus) {
    const n1 = this.sD.n2(x / 26 + 5, z / 26 - 9), n2 = this.sD.n2(x / 7.3, z / 7.3);
    const bio = c.biome;
    if (y < SEA - 1) {
      if (bio === BIOME.SWAMP) return [B.mud, B.mud, 3];
      if (c.river > 0.2 || c.lake > 0.2) return n1 > 0.35 ? [B.clay, B.clay, 2] : n1 + n2 * 0.4 > -0.25 ? [B.gravel, B.gravel, 3] : [B.sand, B.sand, 3];
      if (slope > 2.2) return [this.strata(x, y, z, c), 0, 0];
      if (y < SEA - 17) return n1 > 0.2 ? [B.clay, B.gravel, 2] : [B.gravel, B.gravel, 3];
      return n1 > 0.5 ? [B.gravel, B.sand, 3] : [B.sand, B.sand, 4];
    }
    const snowY = this.snowLine(x, z, c);
    if (slope >= 1.75) {
      if (y > snowY + 8 && slope < 2.7 && n2 > -0.1) return [B.snow, 0, 1];
      return [this.strata(x, y, z, c), 0, 0];
    }
    if (talus && y > SEA + 2) {
      if (c.desert > 0.5) return n2 > 0.1 ? [B.red_sand, B.red_sandstone, 2] : [this.strata(x, y, z, c), 0, 0];
      if (y > snowY) return n2 > 0.2 ? [B.scree, B.scree, 2] : [B.snow, B.scree, 2];
      return [B.scree, B.scree, 3];
    }
    if (slope >= 1.05 && y > SEA + 26 && c.desert < 0.5) {
      if (y > snowY) return n1 + n2 * 0.5 > -0.2 ? [B.snow, B.scree, 1] : [this.strata(x, y, z, c), 0, 0];
      return n1 + n2 * 0.5 > 0.15 ? [B.scree, B.scree, 2] : [this.strata(x, y, z, c), 0, 0];
    }
    if (y <= SEA + 1) {
      if (bio === BIOME.SWAMP) return n1 > -0.1 ? [B.mud, B.mud, 3] : [B.grass, B.mud, 3];
      if (c.temp < -0.24) return n1 > 0 ? [B.gravel, B.gravel, 3] : [B.snow, B.gravel, 3];
      if (c.river > 0.05 || c.valley > 0.85) return n1 + n2 * 0.5 > 0.0 ? [B.gravel, B.gravel, 3] : [B.sand, B.sand, 3];
      return [B.sand, B.sand, 4];
    }
    if (y > snowY) return c.temp - Math.max(0, y - SEA - 38) * 0.004 < -0.27 && y < SEA + 40 && n1 < 0.35 ? [B.snowy_grass, B.dirt, 3] : [B.snow, c.mm > 0.3 ? 0 : B.dirt, 2];
    if (y > snowY - 7 && n2 > 0.25) return [B.snow, B.dirt, 2];
    if (c.desert > 0.5) {
      if (c.mesa > 0.6) return n1 > 0.15 ? [this.strata(x, y, z, c), 0, 0] : [B.red_sand, B.red_sandstone, 3];
      if (c.mesa > 0.02 || this.sF.n2(x / 190, z / 190) > 0.28 + n2 * 0.1) return [B.red_sand, B.red_sandstone, 4];
      return [B.sand, B.sandstone, 5];
    }
    if (c.desert > 0.2 && n1 + n2 * 0.5 > 0.55 - c.desert) return [B.sand, B.sandstone, 3];
    if (bio === BIOME.MOUNTAIN) {
      if (n1 + n2 * 0.4 > 0.38) return [this.strata(x, y, z, c), 0, 0];
      return n1 < -0.35 ? [B.scree, B.dirt, 2] : [B.grass, B.dirt, 2];
    }
    if (bio === BIOME.TAIGA) return [B.snowy_grass, B.dirt, 3];
    if (bio === BIOME.FOREST) return n1 + n2 * 0.35 > 0.12 ? [B.forest_floor, B.dirt, 3] : n1 < -0.55 ? [B.moss_block, B.dirt, 3] : [B.grass, B.dirt, 3];
    if (bio === BIOME.SWAMP) return n1 + n2 * 0.3 > 0.25 ? [B.mud, B.mud, 3] : n1 < -0.35 ? [B.moss_block, B.mud, 3] : [B.grass, B.dirt, 3];
    if (bio === BIOME.BEACH) return [B.sand, B.sand, 4];
    return [B.grass, B.dirt, 3];
  }

  tintsFor(x, z, c) {
    // continuous colour ramps from climate so biome borders blend
    const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    const cold = sstep(-0.05, -0.3, c.temp - Math.max(0, c.h - SEA - 38) * 0.003);
    const wet = sstep(-0.1, 0.3, c.hum);
    let g = mix3([130, 134, 66], [90, 114, 50], wet);
    let f = mix3([112, 120, 52], [78, 100, 42], wet);
    g = mix3(g, [104, 122, 92], cold); f = mix3(f, [70, 96, 68], cold);
    g = mix3(g, [160, 138, 74], sstep(0.05, 0.6, c.desert)); f = mix3(f, [130, 126, 54], sstep(0.05, 0.6, c.desert));
    g = mix3(g, [86, 96, 40], c.swamp); f = mix3(f, [74, 86, 34], c.swamp);
    const gv = this.sG.n2(x / 360 + 11, z / 360 - 4);
    const gw = sstep(0.34, 0.55, gv) * (1 - cold) * (1 - c.desert);
    g = mix3(g, [134, 152, 58], gw); f = mix3(f, [126, 150, 52], gw);
    const patch = this.sD.n2(x / 47 - 3, z / 47 + 8);
    const dry = sstep(0.15, 0.75, patch) * (1 - wet * 0.6);
    g = mix3(g, [150, 134, 66], dry * 0.55);
    return [g, f];
  }

  caveFields(x, y, z, out, o) {
    const cheese = this.sK.n3(x / 78, y / 44, z / 78) + 0.38 * this.sK2.n3(x / 33, y / 23, z / 33);
    out[o] = cheese;
    out[o + 1] = this.sK2.n3(x / 66, y / 46, z / 66);
    out[o + 2] = this.sK.n3(x / 66 + 101.5, y / 46, z / 66 + 57.2);
  }

  ravineAt(x, z, top) {
    if (top < SEA + 4) return null;
    const mask = this.sM.n2(x / 520 + 53, z / 520 - 21);
    if (mask < 0.42) return null;
    const rv = Math.abs(this.sR.n2(x / 240 + 191, z / 240 + 7) + 0.07 * this.sD.n2(x / 37, z / 37));
    if (rv > 0.028) return null;
    const depth = 26 + 22 * clamp(this.sD.n2(x / 90, z / 90) + 0.5, 0, 1);
    return { rv, depth, w: 0.028 * sstep(0.42, 0.6, mask) };
  }

  // ------------------------------------------------------------ chunk
  generate(cx, cz) {
    const blocks = new Uint16Array(CHUNK * CHUNK * WORLD_H);
    const biomes = new Uint8Array(256);
    const x0 = cx * 16, z0 = cz * 16, seed = this.seed;
    const tops = new Int16Array(24 * 24);
    const cols = new Array(24 * 24);
    for (let j = 0; j < 24; j++) for (let i = 0; i < 24; i++) {
      const x = x0 + i - 4, z = z0 + j - 4;
      cols[j * 24 + i] = this.col(x, z);
      tops[j * 24 + i] = this.topSolid(x, z);
    }
    // base terrain
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const x = x0 + lx, z = z0 + lz, ci = (lz + 4) * 24 + (lx + 4);
      const c = cols[ci], top = tops[ci];
      biomes[lz * 16 + lx] = c.biome;
      const hx = (tops[ci + 1] - tops[ci - 1]) * 0.5, hz = (tops[ci + 24] - tops[ci - 24]) * 0.5;
      let maxD = 0, rise = 0;
      for (const d of [1, -1, 24, -24]) maxD = Math.max(maxD, Math.abs(tops[ci + d] - top));
      for (const d of [3, -3, 72, -72, 2 + 48, -2 - 48]) rise = Math.max(rise, tops[ci + d] - top);
      const slope = Math.max(Math.hypot(hx, hz), maxD * 0.72);
      const talus = rise >= 5 && slope < 1.75 && slope > 0.3 && this.sD.n2(x / 9, z / 9) > -0.35;
      let surf = this.surfaceFor(x, top, z, c, slope, talus);
      const cliffy = c.cliff > 0.02;
      const hi = cliffy ? Math.min(WORLD_H - 2, Math.floor(c.h) + 12) : top;
      let depthBelow = -1;
      for (let y = hi; y >= 0; y--) {
        let solid = true;
        if (cliffy && y > Math.floor(c.h) - 14) solid = this.density(x, y, z, c) > 0;
        if (!solid) { depthBelow = -1; continue; }
        if (depthBelow < 0) {
          depthBelow = 0;
          if (y !== top) surf = this.surfaceFor(x, y, z, c, slope * 0.8, false);
        } else depthBelow++;
        let id;
        if (y <= top - 14 && y !== 0) id = this.strata(x, y, z, c);
        else if (depthBelow === 0) id = surf[0];
        else if (depthBelow <= surf[2] && surf[1]) id = surf[1];
        else id = this.strata(x, y, z, c);
        blocks[bidx(lx, y, lz)] = id;
      }
      // water
      if (top < SEA) {
        const frozen = c.temp < -0.3;
        for (let y = SEA; y > top; y--) {
          const i = bidx(lx, y, lz);
          if (blocks[i] === 0) blocks[i] = (frozen && y === SEA && (c.h > SEA - 5 || this.sD.n2(x / 17, z / 17) > 0.15)) ? B.ice : B.water;
        }
      }
    }

    this.carveCaves(blocks, cx, cz, cols, tops);
    this.placeOres(blocks, cx, cz);
    this.grandCaverns(blocks, cx, cz);
    this.decorate(blocks, cx, cz, cols, tops);
    this.placeTrees(blocks, cx, cz);
    this.placeVillages(blocks, cx, cz);
    this.placeRuin(blocks, cx, cz);
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      blocks[bidx(lx, 0, lz)] = B.bedrock;
      if (rand01(x0 + lx, 1, z0 + lz, seed) < 0.55) blocks[bidx(lx, 1, lz)] = B.bedrock;
    }
    return { blocks, biomes };
  }

  carveCaves(blocks, cx, cz, cols, tops) {
    const x0 = cx * 16, z0 = cz * 16;
    let maxTop = 0;
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) maxTop = Math.max(maxTop, tops[(lz + 4) * 24 + lx + 4]);
    const ny = Math.min(63, (Math.min(maxTop, 150) >> 2) + 2);
    const grid = new Float32Array(5 * 5 * (ny + 1) * 3);
    for (let gy = 0; gy <= ny; gy++) for (let gz = 0; gz < 5; gz++) for (let gx = 0; gx < 5; gx++)
      this.caveFields(x0 + gx * 4, gy * 4, z0 + gz * 4, grid, ((gy * 5 + gz) * 5 + gx) * 3);
    const f = [0, 0, 0];
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const x = x0 + lx, z = z0 + lz, ci = (lz + 4) * 24 + lx + 4, c = cols[ci], top = tops[ci];
      const wet = top < SEA + 2 || c.river > 0 || c.lake > 0;
      const entrance = !wet && c.village <= 0 && this.sF.n2(x / 54 + 13, z / 54 + 91) > 0.46;
      const limit = wet ? Math.min(top, SEA) - 8 : entrance ? top + 3 : top - 6;
      const rav = c.village <= 0 && !wet ? this.ravineAt(x, z, top) : null;
      const pool = this.sD.n2(x / 130 + 300, z / 130 - 77);
      const poolY = pool > 0.4 ? 21 + Math.floor(rand01(Math.floor(x / 160), 9, Math.floor(z / 160), this.seed) * 12) : -1;
      const gx = lx >> 2, gz = lz >> 2, tx = (lx & 3) / 4, tz = (lz & 3) / 4;
      const maxY = Math.min(rav ? top + 12 : limit, ny * 4 - 1);
      for (let y = 3; y <= maxY; y++) {
        const i = bidx(lx, y, lz);
        const cur = blocks[i];
        if (cur === 0 || cur === B.water || cur === B.ice) continue;
        let carve = false;
        if (y <= limit) {
          const gy = y >> 2, ty = (y & 3) / 4;
          const base = ((gy * 5 + gz) * 5 + gx) * 3;
          for (let k = 0; k < 3; k++) {
            const a = lerp(grid[base + k], grid[base + 3 + k], tx), b = lerp(grid[base + 15 + k], grid[base + 18 + k], tx);
            const d = lerp(grid[base + 75 + k], grid[base + 78 + k], tx), e = lerp(grid[base + 90 + k], grid[base + 93 + k], tx);
            f[k] = lerp(lerp(a, b, tz), lerp(d, e, tz), ty);
          }
          const depth = clamp((70 - y) / 55, 0, 1);
          if (f[0] > 0.83 - depth * 0.2) carve = true;
          const tube = f[1] * f[1] + f[2] * f[2];
          if (tube < 0.0058 + depth * 0.004) carve = true;
        }
        if (!carve && rav && y > top - rav.depth) {
          const t = clamp((y - (top - rav.depth)) / rav.depth, 0, 1);
          if (rav.rv < rav.w * (0.28 + 0.72 * t)) carve = true;
        }
        if (carve) {
          if (y <= 11) blocks[i] = B.lava;
          else if (y <= poolY) {
            const below = blocks[bidx(lx, y - 1, lz)];
            blocks[i] = below !== 0 ? B.water : 0;
          } else blocks[i] = 0;
        }
      }
    }
    // cave floor decoration
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const x = x0 + lx, z = z0 + lz, top = tops[(lz + 4) * 24 + lx + 4];
      for (let y = 4; y < Math.min(top - 8, 90); y++) {
        const i = bidx(lx, y, lz);
        if (blocks[i] !== 0) continue;
        const below = blocks[bidx(lx, y - 1, lz)], above = blocks[bidx(lx, y + 1, lz)];
        const lush = this.sD.n3(x / 41, y / 29, z / 41);
        const cry = this.sK2.n3(x / 29 + 7, y / 21, z / 29 - 3);
        const r = rand01(x, y, z, this.seed + 5);
        if (below !== 0 && T_OPAQUE[below]) {
          if (lush > 0.35) {
            if (r < 0.07) blocks[i] = B.glowshroom;
            else if (r < 0.1) blocks[i] = B.mushroom;
            if (rand01(x, y, z, 6) < 0.55) blocks[bidx(lx, y - 1, lz)] = B.moss_block;
          } else if (cry > 0.46 && r < 0.09) blocks[i] = y < 34 ? B.crystal_azure : B.crystal_amber;
          else if (r < 0.012) blocks[i] = B.pebbles;
        } else if (above !== 0 && T_OPAQUE[above] && cry > 0.5 && r < 0.05) blocks[i] = (y < 34 ? B.crystal_azure : B.crystal_amber) | (1 << 8);
      }
    }
  }

  placeOres(blocks, cx, cz) {
    const specs = [
      [B.coal_ore, 16, 18, 190, 18], [B.copper_ore, 11, 22, 108, 11], [B.iron_ore, 11, 6, 76, 10],
      [B.gold_ore, 3, 5, 40, 8], [B.azurite_ore, 2, 4, 30, 5], [B.ember_ore, 3, 4, 22, 6],
    ];
    const isHost = new Uint8Array(256);
    for (const id of [B.stone, B.slate, B.basalt, B.limestone, B.sandstone, B.red_sandstone, B.terracotta]) isHost[id] = 1;
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
      const r = mulberry32(ihash(cx + ox, cz + oz, 1234, this.seed));
      for (const [id, count, lo, hi, size] of specs) {
        for (let k = 0; k < count; k++) {
          let x = (cx + ox) * 16 + Math.floor(r() * 16), z = (cz + oz) * 16 + Math.floor(r() * 16), y = lo + Math.floor(r() * (hi - lo));
          const steps = Math.floor(size * (0.6 + r() * 0.7));
          for (let s = 0; s < steps; s++) {
            const lx = x - cx * 16, lz = z - cz * 16;
            if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16 && y > 1 && y < WORLD_H) {
              const i = bidx(lx, y, lz);
              if (isHost[blocks[i]]) blocks[i] = id;
            }
            const d = Math.floor(r() * 6);
            if (d === 0) x++; else if (d === 1) x--; else if (d === 2) y++; else if (d === 3) y--; else if (d === 4) z++; else z--;
          }
        }
      }
    }
  }

  cavernList(cx, cz) {
    const out = [];
    for (const f of this.features.caverns || []) out.push(f);
    const R = 448;
    const gx = Math.floor((cx * 16 + 8) / R), gz = Math.floor((cz * 16 + 8) / R);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const a = gx + i, b = gz + j;
      if (rand01(a, b, 31, this.seed) < 0.45) out.push({
        x: Math.floor(a * R + 60 + rand01(a, b, 32, this.seed) * (R - 120)), z: Math.floor(b * R + 60 + rand01(a, b, 33, this.seed) * (R - 120)),
        y: 28 + Math.floor(rand01(a, b, 34, this.seed) * 10), rx: 20 + rand01(a, b, 35, this.seed) * 10, ry: 11 + rand01(a, b, 36, this.seed) * 4, rz: 17 + rand01(a, b, 37, this.seed) * 9, lava: 6,
      });
    }
    return out;
  }
  cavernDist(x, y, z, f) {
    const dx = (x - f.x) / f.rx, dy = (y - f.y) / f.ry, dz = (z - f.z) / f.rz;
    let d = Math.sqrt(dx * dx + dy * dy + dz * dz) - 1;
    d += this.sK.n3(x / 13, y / 9, z / 13) * 0.2 + this.sK2.n3(x / 5.5, y / 5, z / 5.5) * 0.07;
    return d;
  }
  openSides(x, y, z, f) {
    return (this.cavernDist(x + 1, y, z, f) < 0.035) + (this.cavernDist(x - 1, y, z, f) < 0.035) + (this.cavernDist(x, y, z + 1, f) < 0.035) + (this.cavernDist(x, y, z - 1, f) < 0.035);
  }
  grandCaverns(blocks, cx, cz) {
    const x0 = cx * 16, z0 = cz * 16;
    for (const f of this.cavernList(cx, cz)) {
      if (x0 + 16 < f.x - f.rx * 1.4 || x0 > f.x + f.rx * 1.4 || z0 + 16 < f.z - f.rz * 1.4 || z0 > f.z + f.rz * 1.4) continue;
      const lavaY = Math.floor(f.y - f.ry * 0.62);
      const carved = [];
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const x = x0 + lx, z = z0 + lz;
        for (let y = Math.max(3, Math.floor(f.y - f.ry * 1.35)); y <= Math.min(WORLD_H - 2, Math.ceil(f.y + f.ry * 1.35)); y++) {
          const d = this.cavernDist(x, y, z, f);
          const i = bidx(lx, y, lz);
          if (d < 0) {
            // stalactites, stalagmites and a few natural pillars
            const sc = rand01(Math.floor(x / 2), 51, Math.floor(z / 2), this.seed);
            const hang = sc > 0.9 && this.cavernDist(x, y + 1 + Math.floor((sc - 0.9) * 60 * rand01(x, 1, z, 3)), z, f) >= 0;
            const foot = y - 1 - Math.floor(rand01(x, 2, z, 3) * 3);
            const grow = sc < 0.06 && foot > lavaY + 1 && this.cavernDist(x, foot, z, f) >= 0 && this.cavernDist(x, foot - 1, z, f) >= 0;
            if (hang || grow) blocks[i] = rand01(x, y, z, 52) < 0.3 ? B.limestone : B.slate;
            else { blocks[i] = y <= lavaY ? B.lava : 0; carved.push(x, y, z); }
          } else if (d < 0.3 && y >= lavaY && y <= lavaY + 4 && blocks[i] !== 0 && (y === lavaY || this.cavernDist(x, y - 1, z, f) < 0.035) && this.openSides(x, y, z, f) >= 2) {
            blocks[i] = y <= lavaY ? B.lava : 0;
          } else if (d < 0.14 && blocks[i] !== 0 && blocks[i] !== B.water) {
            if (y <= lavaY + 1) blocks[i] = rand01(x, y, z, 61) < 0.25 ? B.obsidian : B.basalt;
            else {
              const v = this.sD.n3(x / 6, y / 4, z / 6);
              if (v > 0.62) blocks[i] = y < f.y ? B.ember_ore : B.azurite_ore;
              else if (v < -0.68) blocks[i] = B.gold_ore;
            }
          } else if (d < 0.2 && blocks[i] === B.water) blocks[i] = B.slate;
        }
      }
      // sweep up whatever still sticks out of the lake on its own (two passes catch two-block scraps)
      for (let pass = 0; pass < 2; pass++) {
        const gone = [];
        for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
          const x = x0 + lx, z = z0 + lz;
          if (this.cavernDist(x, lavaY + 2, z, f) > 0.2) continue;
          for (let y = lavaY; y <= lavaY + 4; y++) {
            const i = bidx(lx, y, lz), id = blocks[i] & 255;
            if (!T_SOLID[id]) continue;
            const under = blocks[bidx(lx, y - 1, lz)] & 255;
            if (y > lavaY && under !== B.lava && under !== 0) continue;
            if (y === lavaY && (blocks[bidx(lx, y + 1, lz)] & 255) !== 0) continue;
            let held = 0;
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = lx + dx, nz = lz + dz;
              if (nx >= 0 && nx < 16 && nz >= 0 && nz < 16) held += T_SOLID[blocks[bidx(nx, y, nz)] & 255];
              else held += this.cavernDist(x + dx, y, z + dz, f) < 0.035 ? 0 : 1;
            }
            if (held <= 1) gone.push(i, y <= lavaY ? B.lava : 0);
          }
        }
        for (let k = 0; k < gone.length; k += 2) blocks[gone[k]] = gone[k + 1];
      }
      for (let k = 0; k < carved.length; k += 3) {
        const x = carved[k], y = carved[k + 1], z = carved[k + 2], lx = x - x0, lz = z - z0;
        const i = bidx(lx, y, lz);
        if (blocks[i] !== 0 || y <= lavaY + 1) continue;
        const below = blocks[bidx(lx, y - 1, lz)], above = blocks[bidx(lx, y + 1, lz)];
        const cry = this.sK2.n3(x / 9 + 17, y / 7, z / 9 - 13), r = rand01(x, y, z, this.seed + 77);
        if (below && T_OPAQUE[below]) {
          const q = f.sparse || 1;
          if (cry > 0.34 && r < 0.3 * q) blocks[i] = (x + z) & 8 ? B.crystal_azure : B.crystal_amber;
          else if (cry < -0.38 && r < 0.2 * q) blocks[i] = B.glowshroom;
        } else if (above && T_OPAQUE[above] && cry > 0.38 && r < 0.16 * (f.sparse || 1)) blocks[i] = ((x + z) & 8 ? B.crystal_azure : B.crystal_amber) | (1 << 8);
      }
    }
    // hand-shaped tunnels (list of capsules)
    for (const t of this.features.tunnels || []) {
      for (let s = 0; s < t.length - 1; s++) {
        const a = t[s], b = t[s + 1], rad = Math.max(a[3], b[3]) + 2;
        if (x0 + 16 < Math.min(a[0], b[0]) - rad || x0 > Math.max(a[0], b[0]) + rad || z0 + 16 < Math.min(a[2], b[2]) - rad || z0 > Math.max(a[2], b[2]) + rad) continue;
        const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], len2 = abx * abx + aby * aby + abz * abz;
        for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
          const x = x0 + lx, z = z0 + lz;
          for (let y = Math.max(3, Math.floor(Math.min(a[1], b[1]) - rad)); y <= Math.min(WORLD_H - 2, Math.ceil(Math.max(a[1], b[1]) + rad)); y++) {
            const h = clamp(((x - a[0]) * abx + (y - a[1]) * aby + (z - a[2]) * abz) / len2, 0, 1);
            const d = Math.hypot(x - a[0] - abx * h, (y - a[1] - aby * h) * 1.12, z - a[2] - abz * h);
            const r = lerp(a[3], b[3], h) + this.sK.n3(x / 7, y / 6, z / 7) * 1.5 + this.sK2.n3(x / 3.4, y / 3.4, z / 3.4) * 0.5;
            if (d < r) blocks[bidx(lx, y, lz)] = 0;
          }
        }
      }
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const x = x0 + lx, z = z0 + lz;
        for (let y = 36; y < 73; y++) {
          const i = bidx(lx, y, lz);
          if (blocks[i] !== 0) continue;
          let near = false;
          for (let s = 0; s < t.length - 1 && !near; s++) if (Math.hypot(x - t[s][0], y - t[s][1], z - t[s][2]) < 13 || Math.hypot(x - t[s + 1][0], y - t[s + 1][1], z - t[s + 1][2]) < 13) near = true;
          if (!near) continue;
          const below = blocks[bidx(lx, y - 1, lz)] & 255, above = blocks[bidx(lx, y + 1, lz)] & 255, r = rand01(x, y, z, 4021);
          if (below && T_OPAQUE[below]) { if (r < 0.05) blocks[i] = B.glowshroom; else if (r < 0.085) blocks[i] = y > 55 ? B.crystal_amber : B.crystal_azure; }
          else if (above && T_OPAQUE[above] && r < 0.028) blocks[i] = (y > 55 ? B.crystal_azure : B.crystal_amber) | (1 << 8);
        }
      }
    }
  }

  decorate(blocks, cx, cz, cols, tops) {
    const x0 = cx * 16, z0 = cz * 16, seed = this.seed;
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const x = x0 + lx, z = z0 + lz, ci = (lz + 4) * 24 + lx + 4, c = cols[ci], top = tops[ci];
      if (top < 2 || top >= WORLD_H - 4) continue;
      const ground = blocks[bidx(lx, top, lz)];
      if (!ground || !T_OPAQUE[ground]) continue;
      const above = blocks[bidx(lx, top + 1, lz)];
      const r = rand01(x, 11, z, seed), r2 = rand01(x, 12, z, seed);
      const patch = this.sD.n2(x / 14 + 40, z / 14 - 12);
      const set = (id, dy = 1) => { blocks[bidx(lx, top + dy, lz)] = id; };
      if (above === B.water) {
        const depth = SEA - top;
        if (c.biome === BIOME.REEF) {
          const reef = this.sF.n2(x / 26, z / 26);
          if (reef > 0.12 && depth >= 3) {
            if (r < 0.16 * (reef + 0.3)) {
              const kind = [B.coral_pink, B.coral_orange, B.coral_violet][Math.floor(rand01(Math.floor(x / 5), 1, Math.floor(z / 5), seed) * 3)];
              const hh = 1 + Math.floor(r2 * Math.min(3, depth - 2));
              for (let k = 1; k <= hh; k++) set(kind, k);
            } else if (r < 0.38) set(B.seagrass);
          } else if (r < 0.1) set(B.seagrass);
        } else if (depth >= 6 && patch > 0.25 && r < 0.16 && (c.biome === BIOME.OCEAN)) {
          const hh = 2 + Math.floor(r2 * Math.min(8, depth - 3));
          for (let k = 1; k <= hh; k++) set(B.kelp, k);
        } else if (r < (patch > 0.1 ? 0.2 : 0.02) && depth >= 2) set(B.seagrass);
        if (top === SEA - 1 && r2 < 0.34 && c.temp > -0.2 && (c.river > 0 || c.lake > 0 || c.swamp > 0.4) && patch > -0.1 && rand01(x, 13, z, seed) < 0.6) {
          if (ground !== B.gravel || r2 < 0.12) { set(B.reeds, 1); set(B.reeds, 2); }
        }
        if ((c.swamp > 0.45 || c.lake > 0.45) && top >= SEA - 3 && c.temp > -0.15 && this.sD.n2(x / 9, z / 9) > 0.18 && rand01(x, 14, z, seed) < 0.3) {
          if (!blocks[bidx(lx, SEA + 1, lz)]) blocks[bidx(lx, SEA + 1, lz)] = B.lily_pad;
        }
        continue;
      }
      if (above !== 0 || c.village > 0.55) continue;
      const nearWater = top <= SEA + 1 && (tops[ci + 1] < SEA || tops[ci - 1] < SEA || tops[ci + 24] < SEA || tops[ci - 24] < SEA);
      if (nearWater && c.temp > -0.2 && patch > 0.05 && r < 0.3 && c.desert < 0.4) {
        set(B.reeds, 1); if (r2 < 0.6) set(B.reeds, 2);
        continue;
      }
      if (ground === B.grass) {
        const flowerPatch = this.sF.n2(x / 19 - 5, z / 19 + 3);
        const flowerKind = [B.flower_red, B.flower_blue, B.flower_yellow, B.flower_white][Math.floor(rand01(Math.floor((x + patch * 9) / 23), 2, Math.floor(z / 23), seed) * 4)];
        if (c.biome === BIOME.FOREST) {
          if (r < (patch > 0.22 ? 0.22 : 0.025)) set(B.fern);
          else if (r < 0.2) set(B.tall_grass);
          else if (r < 0.218) set(B.bush);
          else if (r < 0.222) set(B.berry_bush);
          else if (r < 0.228) set(B.mushroom);
          else if (flowerPatch > 0.55 && r < 0.28) set(flowerKind);
        } else if (c.biome === BIOME.GROVE) {
          if (r < 0.24) set(B.tall_grass);
          else if (flowerPatch > 0.1 && r < 0.38) set(r2 < 0.75 ? B.flower_white : flowerKind);
          else if (r < 0.39) set(B.bush);
        } else if (c.biome === BIOME.SWAMP) {
          if (r < 0.18) set(B.tall_grass); else if (r < 0.21) set(B.fern); else if (r < 0.222) set(B.mushroom); else if (r < 0.228) set(B.bush);
        } else if (c.biome === BIOME.MOUNTAIN) {
          if (r < 0.09) set(B.tall_grass); else if (r < 0.1) set(B.pebbles); else if (flowerPatch > 0.62 && r < 0.17) set(flowerKind);
        } else {
          if (r < (patch > 0.1 ? 0.34 : 0.12)) set(B.tall_grass);
          else if (flowerPatch > 0.42 && r < 0.46) set(flowerKind);
          else if (r < 0.466) set(B.bush);
          else if (r < 0.468) set(B.berry_bush);
        }
      } else if (ground === B.forest_floor) {
        if (r < (patch > 0.2 ? 0.2 : 0.03)) set(B.fern); else if (r < 0.07) set(B.tall_grass); else if (r < 0.078) set(B.mushroom); else if (r < 0.095) set(B.bush); else if (r < 0.1) set(B.pebbles);
      } else if (ground === B.moss_block) {
        if (r < 0.14) set(B.fern); else if (r < 0.17) set(B.mushroom);
      } else if (ground === B.snowy_grass) {
        if (r < 0.025) set(B.fern); else if (r < 0.03) set(B.dead_bush); else if (r < 0.034) set(B.berry_bush);
      } else if ((ground === B.sand || ground === B.red_sand) && c.desert > 0.4) {
        if (r < 0.006) set(B.dead_bush); else if (r < 0.009) set(B.pebbles);
      } else if (ground === B.gravel || ground === B.scree) {
        if (r < 0.07) set(B.pebbles); else if (r < 0.078) set(B.dead_bush);
      } else if (ground === B.sand) {
        if (r < 0.008) set(B.pebbles);
      } else if (ground === B.mud) {
        if (r < 0.04) set(B.tall_grass);
      } else if (T_KIND[ground] === 1 && ground !== B.snow && r < 0.015 && top > SEA) set(B.pebbles);
    }
  }

  treeAt(gx, gz) {
    const seed = this.seed;
    const tx = gx * 5 + Math.floor(rand01(gx, 21, gz, seed) * 4), tz = gz * 5 + Math.floor(rand01(gx, 22, gz, seed) * 4);
    const r = rand01(gx, 23, gz, seed), r2 = rand01(gx, 24, gz, seed);
    const c = this.col(tx, tz);
    if (c.village > 0.25) return null;
    for (const k of this.features.clearings || []) if ((tx - k.x) ** 2 + (tz - k.z) ** 2 < k.r * k.r) return null;
    const clearing = this.sD.n2(tx / 62 - 21, tz / 62 + 33);
    let kind = null;
    switch (c.biome) {
      case BIOME.FOREST: if (r < (clearing < -0.22 ? 0.05 : 0.6)) kind = r2 < 0.07 ? 'bigoak' : r2 < 0.78 ? 'oak' : 'birch'; break;
      case BIOME.GROVE: if (r < (clearing < -0.15 ? 0.04 : 0.36)) kind = r2 < 0.55 ? 'blossom' : 'birch'; break;
      case BIOME.TAIGA: if (r < (clearing < -0.3 ? 0.06 : 0.56)) kind = 'pine'; break;
      case BIOME.SWAMP: if (r < 0.24) kind = r2 < 0.75 ? 'cypress' : 'oak'; break;
      case BIOME.MEADOW: if (r < (clearing > 0.45 ? 0.22 : 0.012)) kind = r2 < 0.7 ? 'oak' : r2 < 0.85 ? 'birch' : 'blossom'; break;
      case BIOME.MOUNTAIN: if (r < sstep(SEA + 82, SEA + 50, c.h) * (clearing > -0.1 ? 0.34 : 0.05)) kind = 'pine'; break;
      case BIOME.DESERT: if (r < 0.035) kind = 'cactus'; break;
      case BIOME.BEACH: break;
    }
    if (!kind && c.biome === BIOME.FOREST && r > 0.965) kind = 'fallen';
    if (!kind && c.biome === BIOME.TAIGA && r > 0.98) kind = 'fallen';
    if (!kind && (c.biome === BIOME.FOREST || c.biome === BIOME.MEADOW || c.biome === BIOME.MOUNTAIN || c.biome === BIOME.TAIGA || c.biome === BIOME.DESERT) && rand01(gx, 25, gz, seed) < (c.biome === BIOME.MOUNTAIN ? 0.07 : 0.012)) kind = 'boulder';
    if (!kind) return null;
    const y = this.topSolid(tx, tz);
    if (y < SEA - (kind === 'cypress' ? 2 : kind === 'boulder' ? 3 : -0.5) || y > WORLD_H - 40) return null;
    if (kind !== 'boulder') {
      let md = 0;
      md = Math.max(Math.abs(this.topSolid(tx + 1, tz) - y), Math.abs(this.topSolid(tx - 1, tz) - y), Math.abs(this.topSolid(tx, tz + 1) - y), Math.abs(this.topSolid(tx, tz - 1) - y));
      if (md > 2) return null;
      if (c.river > 0.35) return null;
      if (this.ravineAt(tx, tz, y)) return null;
      if (kind !== 'cactus' && y > this.snowLine(tx, tz, c) + 4 && c.biome !== BIOME.TAIGA) return null;
    }
    return { x: tx, y, z: tz, kind, seed: ihash(gx, 26, gz, seed), c };
  }

  placeTrees(blocks, cx, cz) {
    const x0 = cx * 16, z0 = cz * 16;
    const g0x = Math.floor((x0 - 10) / 5), g1x = Math.floor((x0 + 25) / 5);
    const g0z = Math.floor((z0 - 10) / 5), g1z = Math.floor((z0 + 25) / 5);
    for (let gz = g0z; gz <= g1z; gz++) for (let gx = g0x; gx <= g1x; gx++) {
      const t = this.treeAt(gx, gz);
      if (t) this.growTree(blocks, x0, z0, t);
    }
    for (const f of this.features.trees || []) {
      if (f.x + 10 < x0 || f.x - 10 > x0 + 15 || f.z + 10 < z0 || f.z - 10 > z0 + 15) continue;
      this.growTree(blocks, x0, z0, { x: f.x, y: this.topSolid(f.x, f.z), z: f.z, kind: f.kind, seed: f.seed, c: this.col(f.x, f.z) });
    }
  }

  growTree(blocks, x0, z0, t) {
    const r = mulberry32(t.seed);
    const cells = new Map();
    const keyOf = (x, y, z) => ((x - t.x + 64) << 16) | ((z - t.z + 64) << 8) | ((y - t.y + 64) & 255);
    const put = (x, y, z, id, force) => {
      const k = keyOf(x, y, z), prev = cells.get(k);
      if (!prev) cells.set(k, [x, y, z, id, !!force]);
      else if (force || (T_KIND[id & 255] === 1 && T_KIND[prev[3] & 255] === 2)) { prev[3] = id; prev[4] = prev[4] || !!force; }
    };
    const blob = (cx, cy, cz, rx, ry, id, holes = 0.12) => {
      for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) for (let dz = -Math.ceil(rx); dz <= Math.ceil(rx); dz++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
        const x = Math.round(cx) + dx, y = Math.round(cy) + dy, z = Math.round(cz) + dz;
        const d = (dx * dx + dz * dz) / (rx * rx) + (dy * dy) / (ry * ry);
        const n = rand01(x, y, z, 99);
        if (d < 1.12 - n * 0.42 && !(d > 0.5 && n < holes)) put(x, y, z, id);
      }
    };
    const { x, y, z } = t;
    // limb voxel meta: bits 0-1 girth, bit 3 limb flag, bits 4-7 + bit 2 offset to the parent segment
    const limb = (px, py, pz, cx, cy, cz, id, girth) => {
      if (px === cx && py === cy && pz === cz) return;
      const p = (clamp(px - cx, -1, 1) + 1) + 3 * (clamp(pz - cz, -1, 1) + 1) + 9 * (py < cy ? 1 : 0);
      put(cx, cy, cz, id | ((clamp(girth, 0, 3) | 8 | ((p & 15) << 4) | (((p >> 4) & 1) << 2)) << 8));
    };
    const trunk = (h, id) => { for (let k = 1; k <= h; k++) put(x, y + k, z, id, k < 3); };
    if (t.kind === 'oak') {
      const H = 5 + Math.floor(r() * 4);
      trunk(H, B.oak_log);
      const nb = 2 + Math.floor(r() * 3);
      for (let b = 0; b < nb; b++) {
        const a = (b / nb) * Math.PI * 2 + r() * 1.4, len = 2 + Math.floor(r() * 2);
        let bx = x, by = y + Math.floor(H * (0.55 + r() * 0.35)), bz = z;
        for (let s = 1; s <= len; s++) {
          const px = bx, py = by, pz = bz;
          bx = Math.round(x + Math.cos(a) * s); bz = Math.round(z + Math.sin(a) * s); if (s > 1) by++;
          limb(px, py, pz, bx, by, bz, B.oak_log, 3 - s);
        }
        blob(bx, by + 0.5, bz, 2.0 + r() * 0.7, 1.55 + r() * 0.4, B.oak_leaves);
        const ox = bx + Math.round(Math.cos(a)), oz = bz + Math.round(Math.sin(a));
        put(ox, by, oz, B.oak_leaves); put(bx, by + 1, bz, B.oak_leaves); put(bx, by - 1, bz, B.oak_leaves);
      }
      blob(x, y + H + 0.6, z, 2.5 + r() * 0.8, 2.0 + r() * 0.5, B.oak_leaves);
    } else if (t.kind === 'bigoak') {
      const H = 10 + Math.floor(r() * 4);
      for (let k = 0; k <= H; k++) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) if (k < H - 2 || (a === 0 && b === 0)) put(x + a, y + k, z + b, B.oak_log, k < 3);
      for (const [dx, dz] of [[-1, 0], [2, 1], [0, 2], [1, -1]]) if (r() < 0.7) put(x + dx, y + 1, z + dz, B.oak_log);
      for (let b = 0; b < 5; b++) {
        const a = (b / 5) * Math.PI * 2 + r(), len = 3 + Math.floor(r() * 2);
        let bx = x, by = y + Math.floor(H * (0.5 + r() * 0.35)), bz = z;
        for (let s = 1; s <= len; s++) {
          const qx = bx, py = by, qz = bz;
          bx = Math.round(x + 0.5 + Math.cos(a) * s); bz = Math.round(z + 0.5 + Math.sin(a) * s); if (s > 1) by++;
          const px = s === 1 ? clamp(bx, x, x + 1) : qx, pz = s === 1 ? clamp(bz, z, z + 1) : qz;
          limb(px, py, pz, bx, by, bz, B.oak_log, 4 - s);
        }
        blob(bx, by + 0.6, bz, 2.7 + r(), 1.9 + r() * 0.5, B.oak_leaves);
        const ox = bx + Math.round(Math.cos(a)), oz = bz + Math.round(Math.sin(a));
        put(ox, by, oz, B.oak_leaves); put(bx, by + 1, bz, B.oak_leaves); put(bx, by - 1, bz, B.oak_leaves);
      }
      blob(x + 0.5, y + H + 0.5, z + 0.5, 3.6, 2.6, B.oak_leaves);
    } else if (t.kind === 'birch') {
      const H = 7 + Math.floor(r() * 4);
      trunk(H, B.birch_log);
      blob(x, y + H - 0.6, z, 1.9 + r() * 0.5, 2.9 + r() * 0.8, B.birch_leaves, 0.2);
      blob(x, y + H + 2, z, 1.1, 1.4, B.birch_leaves, 0.1);
    } else if (t.kind === 'blossom') {
      const H = 4 + Math.floor(r() * 2);
      trunk(H, B.rosewood_log);
      const nb = 3 + Math.floor(r() * 2);
      for (let b = 0; b < nb; b++) {
        const a = (b / nb) * Math.PI * 2 + r() * 0.9, len = 2 + Math.floor(r() * 3);
        let bx = x, by = y + H - 1 - Math.floor(r() * 2), bz = z;
        for (let s = 1; s <= len; s++) {
          const px = bx, py = by, pz = bz;
          bx = Math.round(x + Math.cos(a) * s); bz = Math.round(z + Math.sin(a) * s); if (s & 1) by++;
          limb(px, py, pz, bx, by, bz, B.rosewood_log, 3 - s);
        }
        blob(bx, by + 0.8, bz, 2.4 + r() * 0.8, 1.35 + r() * 0.4, B.blossom_leaves, 0.18);
      }
      blob(x, y + H + 2, z, 2.6, 1.5, B.blossom_leaves, 0.15);
    } else if (t.kind === 'pine') {
      const H = 9 + Math.floor(r() * 9);
      trunk(H, B.pine_log);
      const start = 2 + Math.floor(r() * 3);
      const maxR = 2.2 + (H / 18) * 1.8;
      for (let k = start; k <= H + 1; k++) {
        const f = (k - start) / (H + 1 - start);
        let rad = maxR * Math.pow(1 - f, 0.85) + 0.55;
        if ((k - start) % 2 === 1) rad *= 0.62;
        const ir = Math.ceil(rad);
        for (let dz = -ir; dz <= ir; dz++) for (let dx = -ir; dx <= ir; dx++) {
          const d = Math.hypot(dx, dz);
          if (d <= rad + 0.15 - rand01(x + dx, y + k, z + dz, 98) * 0.55) put(x + dx, y + k, z + dz, B.pine_leaves);
        }
      }
      put(x, y + H + 1, z, B.pine_leaves); put(x, y + H + 2, z, B.pine_leaves);
    } else if (t.kind === 'cypress') {
      const H = 6 + Math.floor(r() * 4);
      trunk(H, B.cypress_log);
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) {
        if (r() < 0.65) { const hh = 1 + Math.floor(r() * 2); for (let k = -2; k <= hh; k++) put(x + dx, y + k, z + dz, B.cypress_log); }
      }
      const rad = 3.2 + r() * 1.2;
      blob(x, y + H + 0.3, z, rad, 1.55, B.willow_leaves, 0.12);
      blob(x, y + H + 1.5, z, rad * 0.6, 1.1, B.willow_leaves, 0.1);
      const ir = Math.ceil(rad);
      for (let dz = -ir; dz <= ir; dz++) for (let dx = -ir; dx <= ir; dx++) {
        const d = Math.hypot(dx, dz);
        if (d > rad - 1.5 && d < rad + 0.1 && rand01(x + dx, 5, z + dz, 97) < 0.42) {
          const len = 1 + Math.floor(rand01(x + dx, 6, z + dz, 96) * 4);
          for (let k = 0; k < len; k++) put(x + dx, y + H - 1 - k, z + dz, B.willow_leaves);
        }
      }
    } else if (t.kind === 'cactus') {
      const H = 2 + Math.floor(r() * 4);
      trunk(H, B.cactus);
      if (H >= 4) {
        for (let a = 0; a < 2; a++) {
          if (r() < 0.55) {
            const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(r() * 4)];
            const ay = y + 2 + Math.floor(r() * (H - 3));
            put(x + dx, ay, z + dz, B.cactus); put(x + dx * 2, ay, z + dz * 2, B.cactus); put(x + dx * 2, ay + 1, z + dz * 2, B.cactus);
            if (r() < 0.5) put(x + dx * 2, ay + 2, z + dz * 2, B.cactus);
          }
        }
      }
    } else if (t.kind === 'fallen') {
      const axis = r() < 0.5 ? 1 : 2, len = 3 + Math.floor(r() * 4);
      const id = t.c.biome === BIOME.TAIGA ? B.pine_log : r() < 0.7 ? B.oak_log : B.birch_log;
      for (let k = 0; k < len; k++) {
        const px = x + (axis === 1 ? k : 0), pz = z + (axis === 2 ? k : 0);
        const gy = this.topSolid(px, pz);
        if (Math.abs(gy - y) <= 1) { put(px, y + 1, pz, id | (axis << 8)); if (gy < y) put(px, y, pz, B.dirt); }
        if (rand01(px, 4, pz, 95) < 0.35) put(px + (axis === 2 ? 1 : 0), this.topSolid(px + (axis === 2 ? 1 : 0), pz + (axis === 1 ? 1 : 0)) + 1, pz + (axis === 1 ? 1 : 0), B.mushroom);
      }
    } else if (t.kind === 'boulder') {
      const rad = 1.1 + r() * 1.35;
      const desert = t.c.desert > 0.5;
      const mat = desert ? B.red_sandstone : t.c.biome === BIOME.FOREST ? B.mossy_cobble : t.c.biome === BIOME.TAIGA ? B.slate : B.stone;
      const ir = Math.ceil(rad);
      for (let dy = -ir; dy <= ir; dy++) for (let dz = -ir; dz <= ir; dz++) for (let dx = -ir; dx <= ir; dx++) {
        const d = Math.hypot(dx, dy * 1.25, dz);
        if (d < rad - rand01(x + dx, y + dy, z + dz, 94) * 0.45) {
          const lx = x + dx - x0, lz = z + dz - z0;
          if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16) {
            const i = bidx(lx, y + 1 + dy, lz);
            if (blocks[i] === 0 || T_KIND[blocks[i] & 255] === 3 || blocks[i] === B.water || dy <= -1) blocks[i] = mat === B.mossy_cobble && dy > 0 && rand01(x + dx, 2, z + dz, 93) < 0.4 ? B.moss_block : mat;
          }
        }
      }
    }
    // broadleaf crowns: drop single leaf blocks that cling by one face and would read as floating clumps
    if (t.kind === 'oak' || t.kind === 'bigoak' || t.kind === 'birch' || t.kind === 'blossom') {
      for (let pass = 0; pass < 2; pass++) {
        const drop = [];
        for (const [k, c] of cells) {
          if (T_KIND[c[3] & 255] !== 2) continue;
          let held = 0;
          for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
            const n = cells.get(keyOf(c[0] + dx, c[1] + dy, c[2] + dz));
            // leaves and solid trunk blocks support a leaf; a thin limb alone does not hide the gap
            if (n && (T_KIND[n[3] & 255] === 2 || (T_AXIS[n[3] & 255] && !((n[3] >> 8) & 8)))) held++;
          }
          if (held <= 1) drop.push(k);
        }
        for (const k of drop) cells.delete(k);
      }
    }
    for (const [, c] of cells) {
      const lx = c[0] - x0, lz = c[2] - z0, y2 = c[1], id = c[3];
      if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y2 < 1 || y2 >= WORLD_H) continue;
      const i = bidx(lx, y2, lz), cur = blocks[i] & 255;
      if (c[4] || cur === 0 || T_KIND[cur] === 3 || (T_KIND[id & 255] === 1 && T_KIND[cur] === 2) || (cur === B.water && T_KIND[id & 255] === 1)) blocks[i] = id;
    }
  }

  // ------------------------------------------------------------ villages
  villagePlan(v) {
    if (v.plan) return v.plan;
    const ops = []; // [x,y,z,id]
    const r = mulberry32(v.seed || 99);
    const gy = v.y;
    const put = (x, y, z, id) => ops.push(x, y, z, id);
    const huts = v.huts || [];
    if (!v.huts) {
      const n = 5 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r() * 0.35, d = 17 + r() * 8;
        huts.push({ x: Math.round(v.x + Math.cos(a) * d), z: Math.round(v.z + Math.sin(a) * d), w: 6 + Math.floor(r() * 3), d: 5 + Math.floor(r() * 2), a });
      }
    }
    // paths
    const path = (ax, az, bx, bz) => {
      const len = Math.max(1, Math.hypot(bx - ax, bz - az));
      for (let s = 0; s <= len; s += 0.5) {
        const px = Math.round(lerp(ax, bx, s / len) + Math.sin(s * 0.35) * 0.7), pz = Math.round(lerp(az, bz, s / len) + Math.cos(s * 0.29) * 0.7);
        for (let k = 0; k < 2; k++) for (let m = 0; m < 2; m++) if (rand01(px + k, 3, pz + m, 5) < 0.86) {
          put(px + k, gy, pz + m, rand01(px + k, 4, pz + m, 5) < 0.72 ? B.gravel : B.cobble);
          put(px + k, gy + 1, pz + m, 0);
        }
      }
    };
    for (const h of huts) path(v.x, v.z, h.x, h.z);
    // well
    for (let dz = -2; dz <= 1; dz++) for (let dx = -2; dx <= 1; dx++) {
      const edge = dx === -2 || dx === 1 || dz === -2 || dz === 1;
      put(v.x + dx, gy, v.z + dz, B.cobble);
      if (edge) put(v.x + dx, gy + 1, v.z + dz, B.mossy_cobble); else { put(v.x + dx, gy + 1, v.z + dz, 0); put(v.x + dx, gy, v.z + dz, B.water); put(v.x + dx, gy - 1, v.z + dz, B.water); put(v.x + dx, gy - 2, v.z + dz, B.cobble); }
    }
    for (const [dx, dz] of [[-2, -2], [1, -2], [-2, 1], [1, 1]]) { put(v.x + dx, gy + 2, v.z + dz, B.oak_log); put(v.x + dx, gy + 3, v.z + dz, B.oak_log); }
    for (let dz = -2; dz <= 1; dz++) for (let dx = -2; dx <= 1; dx++) put(v.x + dx, gy + 4, v.z + dz, B.wood_slab);
    put(v.x - 1, gy + 5, v.z - 1, B.lamp);
    // campfire and lamp posts
    put(v.x + 6, gy + 1, v.z + 5, B.campfire);
    for (const [dx, dz] of [[4, 5], [8, 5], [6, 3], [6, 7]]) put(v.x + dx, gy, v.z + dz, B.cobble);
    put(v.x + 4, gy + 1, v.z + 7, B.oak_log | (1 << 8)); put(v.x + 5, gy + 1, v.z + 7, B.oak_log | (1 << 8));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.43, d = 10.5 + (i % 2) * 2;
      const px = Math.round(v.x + Math.cos(a) * d), pz = Math.round(v.z + Math.sin(a) * d);
      put(px, gy + 1, pz, B.stone_bricks); put(px, gy + 2, pz, B.oak_log); put(px, gy + 3, pz, B.oak_log);
      if (i % 3 === 2) { put(px, gy + 4, pz, B.torch); } else put(px, gy + 4, pz, B.lamp);
    }
    // huts
    huts.forEach((h, hi) => {
      const hw = h.w >> 1, hd = h.d >> 1;
      const x1 = h.x - hw, x2 = h.x + hw, z1 = h.z - hd, z2 = h.z + hd;
      const wallMat = [B.oak_planks, B.pine_planks, B.birch_planks][hi % 3];
      const logMat = hi % 3 === 1 ? B.pine_log : B.oak_log;
      for (let x = x1 - 1; x <= x2 + 1; x++) for (let z = z1 - 1; z <= z2 + 1; z++) {
        for (let y = gy + 1; y <= gy + 9; y++) put(x, y, z, 0);
        if (x >= x1 && x <= x2 && z >= z1 && z <= z2) { put(x, gy, z, B.cobble); put(x, gy - 1, z, B.cobble); put(x, gy - 2, z, B.cobble); }
      }
      // door side faces the square
      const dxs = v.x - h.x, dzs = v.z - h.z;
      const doorX = Math.abs(dxs) > Math.abs(dzs) ? (dxs > 0 ? x2 : x1) : h.x;
      const doorZ = Math.abs(dxs) > Math.abs(dzs) ? h.z : (dzs > 0 ? z2 : z1);
      const facing = doorX === x2 ? 1 : doorX === x1 ? 3 : doorZ === z2 ? 2 : 0;
      for (let y = gy + 1; y <= gy + 3; y++) for (let x = x1; x <= x2; x++) for (let z = z1; z <= z2; z++) {
        const ex = x === x1 || x === x2, ez = z === z1 || z === z2;
        if (!ex && !ez) continue;
        if (ex && ez) put(x, y, z, logMat);
        else if (y === gy + 1) put(x, y, z, B.stone_bricks);
        else if (y === gy + 2 && ((ex && Math.abs(z - h.z) === 1) || (ez && Math.abs(x - h.x) === 1) || (ex && z === h.z && h.d > 5))) put(x, y, z, B.glass);
        else put(x, y, z, wallMat);
      }
      put(doorX, gy + 1, doorZ, B.door | (facing << 8)); put(doorX, gy + 2, doorZ, B.door | ((facing | 8) << 8));
      put(doorX, gy + 3, doorZ, wallMat);
      const ox = doorX === x2 ? 1 : doorX === x1 ? -1 : 0, oz = doorZ === z2 && !ox ? 1 : doorZ === z1 && !ox ? -1 : 0;
      put(doorX + ox + (oz ? 1 : 0), gy + 3, doorZ + oz + (ox ? 1 : 0), B.torch | ((ox === 1 ? 1 : ox === -1 ? 2 : oz === 1 ? 3 : 4) << 8));
      // gable roof along the longer axis
      const alongX = h.w >= h.d;
      const half = (alongX ? hd : hw) + 1;
      for (let s = 0; s <= half; s++) {
        const y = gy + 4 + s, off = half - s;
        for (let t = -(alongX ? hw : hd) - 1; t <= (alongX ? hw : hd) + 1; t++) {
          for (const side of [-1, 1]) {
            const px = alongX ? h.x + t : h.x + side * off, pz = alongX ? h.z + side * off : h.z + t;
            put(px, y, pz, B.thatch);
          }
          if (s < half && Math.abs(t) === (alongX ? hw : hd)) for (let q = -off + 1; q <= off - 1; q++) {
            put(alongX ? h.x + t : h.x + q, y, alongX ? h.z + q : h.z + t, q === 0 && s === 0 ? B.glass : wallMat);
          }
        }
      }
      // interior
      put(x1 + 1, gy + 1, z1 + 1, B.crafting_table);
      put(x2 - 1, gy + 1, z1 + 1, B.furnace | (2 << 8));
      put(x1 + 1, gy + 1, z2 - 1, B.chest | (0 << 8));
      put(h.x, gy + 4, h.z, B.lamp);
      // chimney
      if (hi % 2 === 0) for (let y = gy + 4; y <= gy + 6 + half; y++) put(x2 - 1, y, z1, B.cobble);
    });
    v.plan = ops;
    return ops;
  }

  ruinPlan(f) {
    if (f.plan) return f.plan;
    const ops = [], r = mulberry32(911), gy = f.y;
    const put = (x, y, z, id) => ops.push(x, y, z, id);
    const R = f.r;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const x = f.x + dx, z = f.z + dz, d = Math.max(Math.abs(dx), Math.abs(dz)) + this.sD.n2(x / 5, z / 5) * 2.4;
      if (d > R - 1) continue;
      const k = rand01(x, 3, z, 911), moss = this.sD.n2(x / 6.3 + 9, z / 6.3);
      const id = d > R - 4 && k < 0.3 ? B.moss_block : moss > 0.42 ? B.mossy_cobble : k < 0.1 ? B.cobble : B.stone_bricks;
      put(x, gy, z, id); put(x, gy - 1, z, B.cobble);
      for (let y = gy + 1; y < gy + 12; y++) put(x, y, z, 0);
      if (id === B.moss_block && rand01(x, 4, z, 911) < 0.35) put(x, gy + 1, z, B.tall_grass);
      else if (d > R - 6 && rand01(x, 5, z, 911) < 0.04) put(x, gy + 1, z, B.pebbles);
    }
    const column = (x, z, h) => { for (let k = 1; k <= h; k++) put(x, gy + k, z, k === 1 ? B.cobble : r() < 0.18 ? B.mossy_cobble : B.stone_bricks); };
    // two rows of columns running toward the north-east, framing the view
    const heights = [5, 3, 6, 2, 6, 4, 5, 1];
    for (let i = 0; i < 4; i++) {
      const along = -7 + i * 5;
      for (const side of [-1, 1]) {
        const x = f.x + Math.round(along * 0.72 + side * 4.6), z = f.z + Math.round(-along * 0.7 + side * 4.8);
        const h = heights[(i * 2 + (side > 0 ? 1 : 0)) % 8];
        column(x, z, h);
        if (h >= 5) { put(x + 1, gy + h, z, B.stone_slab); put(x, gy + h + 1, z, B.stone_slab); }
      }
    }
    // the surviving arch at the far end
    const ax = f.x + 9, az = f.z - 9;
    for (const s of [-3, 3]) column(ax + Math.round(s * 0.7), az + Math.round(s * 0.7), 7);
    for (let s = -3; s <= 3; s++) { const x = ax + Math.round(s * 0.7), z = az + Math.round(s * 0.7); put(x, gy + 8, z, B.stone_bricks); if (Math.abs(s) < 3) put(x, gy + 7, z, Math.abs(s) === 2 ? B.stone_bricks : 0); if (Math.abs(s) < 2) put(x, gy + 9, z, B.stone_slab); }
    // fallen drums and lamps on stumps
    for (let k = 0; k < 4; k++) put(f.x - 3 + k, gy + 1, f.z - 6, B.stone_bricks);
    put(f.x + 6, gy + 1, f.z + 3, B.cobble); put(f.x + 7, gy + 1, f.z + 3, B.stone_slab);
    for (const [dx, dz] of [[-3, 1], [5, -2], [2, -8], [8, -4]]) { put(f.x + dx, gy + 1, f.z + dz, B.stone_bricks); put(f.x + dx, gy + 2, f.z + dz, B.lamp); }
    f.plan = ops;
    return ops;
  }
  placeRuin(blocks, cx, cz) {
    const f = this.features.ruin;
    if (!f) return;
    const x0 = cx * 16, z0 = cz * 16;
    if (x0 + 15 < f.x - f.r - 12 || x0 > f.x + f.r + 12 || z0 + 15 < f.z - f.r - 12 || z0 > f.z + f.r + 12) return;
    const ops = this.ruinPlan(f);
    for (let i = 0; i < ops.length; i += 4) {
      const lx = ops[i] - x0, lz = ops[i + 2] - z0, y = ops[i + 1];
      if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16 && y > 0 && y < WORLD_H) blocks[bidx(lx, y, lz)] = ops[i + 3];
    }
  }

  placeVillages(blocks, cx, cz) {
    const x0 = cx * 16, z0 = cz * 16;
    const list = [];
    if (this.features.village) list.push(this.features.village);
    const R = 640;
    const v = this.villageSite(Math.floor((x0 + 8) / R), Math.floor((z0 + 8) / R));
    if (v) list.push(v);
    for (const s of list) {
      if (x0 + 15 < s.x - s.r - 8 || x0 > s.x + s.r + 8 || z0 + 15 < s.z - s.r - 8 || z0 > s.z + s.r + 8) continue;
      const ops = this.villagePlan(s);
      for (let i = 0; i < ops.length; i += 4) {
        const lx = ops[i] - x0, lz = ops[i + 2] - z0, y = ops[i + 1];
        if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16 && y > 0 && y < WORLD_H) blocks[bidx(lx, y, lz)] = ops[i + 3];
      }
    }
  }
}
