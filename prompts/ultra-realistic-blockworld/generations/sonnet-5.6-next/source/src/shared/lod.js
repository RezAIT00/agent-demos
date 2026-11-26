// ---------------------------------------------------------------- distant terrain (blocky level-of-detail beyond the voxel radius)
// continuous surface colour: every threshold is blended so coarse sampling never turns into a checkerboard
function lodSurface(gen, wx, wz, h, c, slope, colors, out) {
  const mix = (a, b, t) => { a[0] += (b[0] - a[0]) * t; a[1] += (b[1] - a[1]) * t; a[2] += (b[2] - a[2]) * t; };
  const tinted = (layer, tint) => { const q = colors[layer] || [110, 110, 100]; return tint ? [clamp(q[0] * tint[0] / 128, 0, 255), clamp(q[1] * tint[1] / 128, 0, 255), clamp(q[2] * tint[2] / 128, 0, 255)] : [q[0], q[1], q[2]]; };
  const tints = gen.tintsFor(wx, wz, c);
  const n1 = gen.sD.n2(wx / 61 + 5, wz / 61 - 9), n2 = gen.sD.n2(wx / 23 - 3, wz / 23 + 7);
  let layer = LAYER.grass_top, mat = 0;
  const col = tinted(LAYER.grass_top, tints[0]);
  // meadow vegetation reads as the blade colour from far away
  mix(col, [tints[0][0] * 0.86, tints[0][1] * 0.9, tints[0][2] * 0.72], 0.5);
  if (c.biome === BIOME.FOREST) mix(col, tinted(LAYER.forest_top), sstep(-0.2, 0.5, n1) * 0.55);
  if (c.biome === BIOME.SWAMP) mix(col, tinted(LAYER.mud), sstep(0.0, 0.5, n1) * 0.7);
  const desert = sstep(0.38, 0.6, c.desert);
  if (desert > 0) {
    const red = sstep(0.18, 0.4, gen.sF.n2(wx / 190, wz / 190) + c.mesa);
    const s = tinted(LAYER.sand); mix(s, tinted(LAYER.red_sand), red);
    mix(col, s, desert); if (desert > 0.5) layer = red > 0.5 ? LAYER.red_sand : LAYER.sand;
  }
  const beach = sstep(SEA + 2.6, SEA + 1.0, h);
  if (beach > 0) { mix(col, tinted(c.river > 0.05 || c.temp < -0.24 ? LAYER.gravel : c.biome === BIOME.SWAMP ? LAYER.mud : LAYER.sand), beach); if (beach > 0.5) layer = c.river > 0.05 ? LAYER.gravel : LAYER.sand; }
  // scree, then bare strata on steep ground
  const scree = sstep(0.75, 1.15, slope + n2 * 0.25) * sstep(SEA + 20, SEA + 40, h) * (1 - desert);
  if (scree > 0) { mix(col, tinted(LAYER.scree), scree * 0.85); if (scree > 0.55) layer = LAYER.scree; }
  const rock = Math.max(sstep(1.2, 2.1, slope + n2 * 0.35), c.mm > 0.3 ? sstep(0.15, 0.65, n1 + n2 * 0.4) * 0.8 : 0);
  if (rock > 0) {
    const id = gen.strata(Math.floor(wx), Math.floor(h - 1), Math.floor(wz), c);
    const lay = BLOCKS[id].layers[2];
    mix(col, tinted(lay), rock); if (rock > 0.5) layer = lay;
  }
  if (c.mesa > 0.55 && desert > 0.5) { const id = gen.strata(Math.floor(wx), Math.floor(h - 1), Math.floor(wz), c); const lay = BLOCKS[id].layers[2]; mix(col, tinted(lay), 0.75); layer = lay; }
  const snowY = gen.snowLine(wx, wz, c);
  const snow = sstep(snowY - 5, snowY + 6, h + n2 * 4) * (1 - sstep(1.35, 2.5, slope + n1 * 0.3));
  if (snow > 0) { mix(col, tinted(LAYER.snow), snow); if (snow > 0.5) { layer = LAYER.snow; mat = 2; } }
  out.col = col; out.layer = layer; out.mat = mat; out.tints = tints; out.snow = snow;
  return out;
}

// cheap stand-in for treeAt: same jittered grid and probabilities, without the fine placement checks
function lodTree(gen, gx, gz, fine) {
  if (fine) return gen.treeAt(gx, gz);
  const seed = gen.seed;
  const tx = gx * 5 + Math.floor(rand01(gx, 21, gz, seed) * 4), tz = gz * 5 + Math.floor(rand01(gx, 22, gz, seed) * 4);
  const r = rand01(gx, 23, gz, seed), r2 = rand01(gx, 24, gz, seed);
  const c = gen.column(tx, tz, {});
  if (c.village > 0.25) return null;
  const cl = gen.sD.n2(tx / 62 - 21, tz / 62 + 33);
  let kind = null;
  switch (c.biome) {
    case BIOME.FOREST: if (r < (cl < -0.3 ? 0.05 : 0.62)) kind = r2 < 0.07 ? 'bigoak' : r2 < 0.78 ? 'oak' : 'birch'; break;
    case BIOME.GROVE: if (r < (cl < -0.15 ? 0.04 : 0.36)) kind = r2 < 0.55 ? 'blossom' : 'birch'; break;
    case BIOME.TAIGA: if (r < (cl < -0.3 ? 0.06 : 0.56)) kind = 'pine'; break;
    case BIOME.SWAMP: if (r < 0.24) kind = r2 < 0.75 ? 'cypress' : 'oak'; break;
    case BIOME.MEADOW: if (r < (cl > 0.45 ? 0.22 : 0.012)) kind = r2 < 0.7 ? 'oak' : r2 < 0.85 ? 'birch' : 'blossom'; break;
    case BIOME.MOUNTAIN: if (r < sstep(SEA + 82, SEA + 50, c.h) * (cl > -0.1 ? 0.34 : 0.05)) kind = 'pine'; break;
  }
  if (!kind || c.h < SEA + 0.6 || c.river > 0.35) return null;
  return { x: tx, y: Math.floor(c.h), z: tz, kind, seed: ihash(gx, 26, gz, seed), c };
}

function meshLOD(gen, tx, tz, size, cell, colors) {
  const N = Math.round(size / cell), M = 5, P = N + M * 2;
  const hs = new Float32Array(P * P), colsL = new Array(P * P);
  const x0 = tx * size, z0 = tz * size;
  for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) {
    const x = x0 + (i - M) * cell + cell * 0.5, z = z0 + (j - M) * cell + cell * 0.5;
    const c = gen.column(Math.floor(x), Math.floor(z), {});
    colsL[j * P + i] = c;
    hs[j * P + i] = Math.floor(c.h) + 1;
  }
  // per-cell surface description with smooth slopes
  const surf = new Array(P * P), snorm = new Float32Array(P * P * 3);
  for (let j = 1; j < P - 1; j++) for (let i = 1; i < P - 1; i++) {
    const k = j * P + i;
    const gx = (hs[k + 1] - hs[k - 1]) / (2 * cell), gz = (hs[k + P] - hs[k - P]) / (2 * cell);
    const il = 1 / Math.hypot(gx, 1, gz);
    snorm[k * 3] = -gx * il; snorm[k * 3 + 1] = il; snorm[k * 3 + 2] = -gz * il;
    surf[k] = lodSurface(gen, x0 + (i - M + 0.5) * cell, z0 + (j - M + 0.5) * cell, hs[k] - 1, colsL[k], Math.hypot(gx, gz), colors, {});
    surf[k].slope = Math.hypot(gx, gz);
    // baked horizon occlusion keeps gullies and cliff feet readable at a distance
    if (i >= M - 1 && j >= M - 1 && i <= N + M && j <= N + M) {
      let occ = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        let best = 0;
        for (const d of [1, 2, 4]) { const o = (j + dz * d) * P + i + dx * d; best = Math.max(best, (hs[o] - hs[k]) / (d * cell * Math.hypot(dx, dz))); }
        occ += best / Math.sqrt(1 + best * best);
      }
      const ao = clamp(1 - (occ / 8) * 0.95, 0.42, 1);
      surf[k].col = [surf[k].col[0] * ao, surf[k].col[1] * ao, surf[k].col[2] * ao];
    }
  }
  const pos = [], nrm = [], col = [], uv = [];
  const water = new VB(256);
  let minY = 1e9, maxY = -1e9;
  const push = (p, n, c, kind, layer, u, v) => {
    pos.push(p[0], p[1], p[2]); nrm.push(n[0] * 127, n[1] * 127, n[2] * 127, layer); col.push(clamp(c[0], 0, 255), clamp(c[1], 0, 255), clamp(c[2], 0, 255), kind); uv.push(u * 255, v * 255);
    if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
  };
  const quadL = (p, ns, cs, kind, layer) => { for (let q = 0; q < 4; q++) push(p[q], ns[q] || ns[0], cs[q] || cs[0], kind, layer, q === 1 || q === 2 ? 1 : 0, q > 1 ? 1 : 0); };
  // colours and normals averaged at cell corners -> continuous shading over blocky geometry
  const corner = (i, j) => {
    const base = j * P + i; const c = [0, 0, 0], n = [0, 0, 0]; let w = 0;
    for (const k of [base, base - 1, base - P, base - P - 1]) {
      const s = surf[k]; if (!s) continue;
      c[0] += s.col[0]; c[1] += s.col[1]; c[2] += s.col[2];
      n[0] += snorm[k * 3]; n[1] += snorm[k * 3 + 1]; n[2] += snorm[k * 3 + 2]; w++;
    }
    const il = 1 / (Math.hypot(n[0], n[1], n[2]) || 1);
    return { c: [c[0] / w, c[1] / w, c[2] / w], n: [n[0] * il, n[1] * il, n[2] * il] };
  };
  for (let j = M; j < N + M; j++) for (let i = M; i < N + M; i++) {
    const idx = j * P + i, c = colsL[idx];
    const x = (i - M) * cell, z = (j - M) * cell;
    const top = hs[idx];
    if (top <= SEA) {
      const frozen = c.temp < -0.3 && c.h > SEA - 5;
      if (frozen) {
        const yw = SEA + 0.875;
        quadL([[x, yw, z + cell], [x + cell, yw, z + cell], [x + cell, yw, z], [x, yw, z]], [[0, 1, 0]], [colors[LAYER.ice]], 2, LAYER.ice);
      } else {
        const ocean = clamp(sstep(0.0, -0.12, c.cont), 0, 1) * 255, depth = clamp(SEA - top + 1, 1, 32);
        for (const [vx, vz] of [[x, z + cell], [x + cell, z + cell], [x + cell, z], [x, z]]) water.v(vx, SEA + 0.875, vz, 0, 1, 0, 0, 2, 0, 0, 0, 0, 0, 0, 255, 127.5, 127.5, ocean, 0, depth, 0);
      }
      continue;
    }
    const s = surf[idx];
    const a = corner(i, j + 1), b = corner(i + 1, j + 1), d = corner(i + 1, j), e = corner(i, j);
    quadL([[x, top, z + cell], [x + cell, top, z + cell], [x + cell, top, z], [x, top, z]], [a.n, b.n, d.n, e.n], [a.c, b.c, d.c, e.c], 0, s.layer);
    // skirts toward lower neighbours, banded with strata colours
    const nbs = [[idx + 1, [1, 0, 0]], [idx - 1, [-1, 0, 0]], [idx + P, [0, 0, 1]], [idx - P, [0, 0, -1]]];
    const sn = [snorm[idx * 3], snorm[idx * 3 + 1], snorm[idx * 3 + 2]];
    for (const [ni, n] of nbs) {
      let low = hs[ni] <= SEA ? SEA - 1 : hs[ni];
      const edgeI = (n[0] === 1 && i === N + M - 1) || (n[0] === -1 && i === M) || (n[2] === 1 && j === N + M - 1) || (n[2] === -1 && j === M);
      if (edgeI) low = Math.min(low, top - cell * 1.5);
      if (low >= top) continue;
      let yt = top;
      const tall = top - low;
      while (yt > low) {
        const yb = Math.max(low, yt - (tall > 24 ? 6 : 3.2));
        const deep = top - (yt + yb) / 2;
        let color = s.col, layer = s.layer;
        const soft = tall <= cell * 1.25 || (s.slope < 1.25 && c.mesa < 0.4);
        if (!soft && deep > 1.2) {
          const id = gen.strata(Math.floor(x0 + x + cell / 2), Math.floor((yt + yb) / 2), Math.floor(z0 + z + cell / 2), c);
          layer = BLOCKS[id].layers[2];
          color = colors[layer] || [120, 115, 105];
          if (s.mat === 2 && deep < 5) { color = s.col; layer = LAYER.snow; }
        }
        let p0, p1;
        if (n[0] === 1) { p0 = [x + cell, 0, z + cell]; p1 = [x + cell, 0, z]; }
        else if (n[0] === -1) { p0 = [x, 0, z]; p1 = [x, 0, z + cell]; }
        else if (n[2] === 1) { p0 = [x, 0, z + cell]; p1 = [x + cell, 0, z + cell]; }
        else { p0 = [x + cell, 0, z]; p1 = [x, 0, z]; }
        const k = soft ? 0.72 : 0.45;
        const bl = [lerp(n[0], sn[0], k), lerp(n[1], sn[1], k), lerp(n[2], sn[2], k)];
        const il = 1 / (Math.hypot(bl[0], bl[1], bl[2]) || 1);
        const nn = [bl[0] * il, bl[1] * il, bl[2] * il];
        quadL([[p0[0], yb, p0[2]], [p1[0], yb, p1[2]], [p1[0], yt, p1[2]], [p0[0], yt, p0[2]]], [nn], [color], 0, layer);
        yt = yb;
      }
    }
  }
  // forests: alpha-tested foliage cards standing exactly where the voxel trees grow
  const fine = cell <= 2;
  const gx0 = Math.ceil((x0 - 1) / 5), gx1 = Math.floor((x0 + size - 1) / 5), gz0 = Math.ceil((z0 - 1) / 5), gz1 = Math.floor((z0 + size - 1) / 5);
  const card = (cx, cy, cz, ang, w, h, color, layer, tilt, nUp) => {
    const dx = Math.cos(ang) * w / 2, dz = Math.sin(ang) * w / 2, tx_ = -Math.sin(ang) * tilt * h, tz_ = Math.cos(ang) * tilt * h;
    const p = [[cx - dx - tx_ / 2, cy - h / 2, cz - dz - tz_ / 2], [cx + dx - tx_ / 2, cy - h / 2, cz + dz - tz_ / 2], [cx + dx + tx_ / 2, cy + h / 2, cz + dz + tz_ / 2], [cx - dx + tx_ / 2, cy + h / 2, cz - dz + tz_ / 2]];
    const mk = (q) => { const nx = (p[q][0] - cx) / w, ny = (p[q][1] - cy) / h + nUp, nz = (p[q][2] - cz) / w; const il = 1 / (Math.hypot(nx, ny, nz) || 1); return [nx * il, ny * il, nz * il]; };
    const dim = [color[0] * 0.62, color[1] * 0.62, color[2] * 0.62];
    quadL(p, [mk(0), mk(1), mk(2), mk(3)], [dim, dim, color, color], 3, layer);
  };
  for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
    const t = lodTree(gen, gx, gz, fine);
    if (!t || t.kind === 'fallen' || t.kind === 'boulder') continue;
    const lx = t.x + 0.5 - x0, lz = t.z + 0.5 - z0, y = t.y + 1;
    const r = mulberry32(t.seed);
    const tint = gen.tintsFor(t.x, t.z, t.c)[1];
    const tc = (layer, tn) => { const q = colors[layer] || [80, 100, 50]; const v = 0.82 + r() * 0.34; return tn ? [q[0] * tn[0] / 128 * v, q[1] * tn[1] / 128 * v, q[2] * tn[2] / 128 * v] : [q[0] * v, q[1] * v, q[2] * v]; };
    const a0 = r() * 3.14;
    if (t.kind === 'cactus') { const cc = colors[LAYER.cactus_side]; const h = 2.5 + r() * 2.5; for (let k = 0; k < 2; k++) card(lx, y + h / 2, lz, a0 + k * 1.57, 0.8, h, cc, LAYER.cactus_side, 0, 0.2); continue; }
    if (t.kind === 'pine') {
      const H = 10 + Math.floor(r() * 8), cc = tc(LAYER.leaf_pine, null);
      const tiers = fine ? 4 : 2;
      for (let k = 0; k < tiers; k++) {
        const f = (k + 0.5) / tiers, w = (1 - f * 0.82) * (4.2 + H * 0.17), yy = y + 2.2 + f * (H - 0.5);
        for (let q = 0; q < (fine ? 3 : 2); q++) card(lx, yy, lz, a0 + q * (3.14159 / (fine ? 3 : 2)) + k * 0.7, w, H / tiers * 1.55, cc, LAYER.leaf_pine, 0, 0.45);
        if (fine) card(lx, yy - H / tiers * 0.2, lz, a0 + k, w * 0.9, w * 0.2, cc, LAYER.leaf_pine, 2.2, 1.4);
      }
    } else {
      let H = 6.5, W = 5.6, VH = 4.4, layer = LAYER.leaf_oak, tn = tint;
      if (t.kind === 'birch') { H = 8.8; W = 4.2; VH = 5.4; layer = LAYER.leaf_birch; }
      else if (t.kind === 'blossom') { H = 6.4; W = 7.2; VH = 3.6; layer = LAYER.leaf_blossom; tn = null; }
      else if (t.kind === 'bigoak') { H = 11.5; W = 9.5; VH = 6.2; }
      else if (t.kind === 'cypress') { H = 7.2; W = 7.6; VH = 4.0; layer = LAYER.leaf_willow; }
      H += (r() - 0.5) * 1.6;
      const cc = tc(layer, tn);
      const n = fine ? 7 : 3;
      for (let k = 0; k < n; k++) {
        const ox = k ? (r() - 0.5) * W * 0.5 : 0, oz = k ? (r() - 0.5) * W * 0.5 : 0, oy = k ? (r() - 0.5) * VH * 0.45 : 0;
        const flat = fine && k >= 5;
        card(lx + ox, y + H + oy, lz + oz, a0 + k * 1.13, W * (k ? 0.82 : 1.1), flat ? 0.6 : VH * (k ? 0.85 : 1.05), cc, layer, flat ? 6.0 : (r() - 0.5) * 0.35, flat ? 1.2 : 0.55);
      }
      if (fine) { const bl = t.kind === 'birch' ? LAYER.birch_bark : LAYER.oak_bark; const bark = colors[bl]; for (let k = 0; k < 2; k++) card(lx, y + (H - 1.5) / 2, lz, a0 + k * 1.57, 0.85, H - 1.5, bark, bl, 0, 0.05); }
    }
  }
  const waterOut = water.out();
  if (!pos.length) return waterOut ? { n: 0, water: waterOut, minY: SEA, maxY: SEA + 1 } : null;
  return { water: waterOut, n: pos.length / 3, pos: new Float32Array(pos), nrm: new Int8Array(nrm), col: new Uint8Array(col), uv: new Uint8Array(uv), minY, maxY };
}
