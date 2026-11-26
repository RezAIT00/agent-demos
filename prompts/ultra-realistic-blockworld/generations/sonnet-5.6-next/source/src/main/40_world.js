// ================================================================ world streaming, voxel access and edits
const chunkKey = (cx, cz) => cx + ',' + cz;
const DOOR_DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const LADDER_DIR = [[0, -1], [-1, 0], [0, 1], [1, 0]];
const TORCH_DIR = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
const FULL_BOX = [[0, 0, 0, 1, 1, 1]];
const FAR_N = 384, FAR_STEP = 8;
const FALLING = new Set([B.sand, B.red_sand, B.gravel, B.scree]);

function doorBox(meta) {
  const f = meta & 3, open = (meta & 4) !== 0;
  const side = open ? (f + 3) & 3 : f;
  const t = 0.17;
  const d = DOOR_DIR[side];
  if (d[1] === -1) return [0, 0, 0, 1, 1, t];
  if (d[1] === 1) return [0, 0, 1 - t, 1, 1, 1];
  if (d[0] === 1) return [1 - t, 0, 0, 1, 1, 1];
  return [0, 0, 0, t, 1, 1];
}
function collisionBoxes(id, meta) {
  if (!T_SOLID[id]) return null;
  switch (T_KIND[id]) {
    case KIND.slab: return [[0, 0, 0, 1, 0.5, 1]];
    case KIND.chest: return [[0.06, 0, 0.06, 0.94, 0.875, 0.94]];
    case KIND.door: return [doorBox(meta)];
    default: return id === B.cactus ? [[0.06, 0, 0.06, 0.94, 1, 0.94]] : FULL_BOX;
  }
}
function pickBoxes(id, meta) {
  switch (T_KIND[id]) {
    case KIND.cross: return id === B.lily_pad ? [[0.1, -0.15, 0.1, 0.9, 0.02, 0.9]] : id === B.pebbles ? [[0.1, 0, 0.1, 0.9, 0.22, 0.9]] : [[0.15, 0, 0.15, 0.85, 0.82, 0.85]];
    case KIND.crystal: return [[0.15, 0, 0.15, 0.85, 0.9, 0.85]];
    case KIND.torch: { const d = TORCH_DIR[meta & 7] || [0, 0]; return (meta & 7) ? [[0.35 - d[0] * 0.32, 0.18, 0.35 - d[1] * 0.32, 0.65 - d[0] * 0.32, 0.85, 0.65 - d[1] * 0.32]] : [[0.38, 0, 0.38, 0.62, 0.68, 0.62]]; }
    case KIND.ladder: { const d = LADDER_DIR[meta & 3]; return [[d[0] > 0 ? 0.82 : 0, 0, d[1] > 0 ? 0.82 : 0, d[0] < 0 ? 0.18 : 1, 1, d[1] < 0 ? 0.18 : 1]]; }
    case KIND.campfire: return [[0.05, 0, 0.05, 0.95, 0.45, 0.95]];
    default: return collisionBoxes(id, meta) || FULL_BOX;
  }
}

class World {
  constructor(pool, seed, features) {
    this.pool = pool; this.seed = seed >>> 0; this.features = features || {};
    this.gen = new WorldGen(this.seed, this.features);
    pool.init(this.seed, this.features);
    this.chunks = new Map(); this.edits = new Map(); this.results = [];
    this.genInflight = 0; this.meshInflight = 0; this.lodInflight = 0;
    this.lod = [new Map(), new Map()];
    this.ring = []; this.ringKey = '';
    this.centerX = 1e9; this.centerZ = 1e9;
    this.fluid = new Map(); this.fluidTimer = 0;
    this.listeners = [];
    this.maskData = new Uint8Array(64 * 64);
    this.maskTex = new THREE.DataTexture(this.maskData, 64, 64, THREE.RedFormat, THREE.UnsignedByteType);
    this.maskTex.magFilter = this.maskTex.minFilter = THREE.NearestFilter; this.maskTex.needsUpdate = true;
    this.rainData = new Float32Array(256 * 256);
    this.rainTex = new THREE.DataTexture(this.rainData, 256, 256, THREE.RedFormat, THREE.FloatType);
    this.rainTex.magFilter = this.rainTex.minFilter = THREE.NearestFilter; this.rainTex.needsUpdate = true;
    U.uRainMap.value = this.rainTex;
    this.maskDirty = true; this.rainDirty = true; this.disposed = false;
    this.farData = new Float32Array(FAR_N * FAR_N);
    this.farTex = new THREE.DataTexture(this.farData, FAR_N, FAR_N, THREE.RedFormat, THREE.FloatType);
    this.farTex.magFilter = this.farTex.minFilter = renderer.extensions.has('OES_texture_float_linear') ? THREE.LinearFilter : THREE.NearestFilter; this.farTex.needsUpdate = true;
    this.farOrigin = null; this.farPending = false;
    U.uFarHeight.value = this.farTex; U.uFarInfo.value.set(0, 0, 1, 0);
    this.lodMats = [WorldMats.lod.clone(), WorldMats.lod.clone()];
    for (const [i, m] of this.lodMats.entries()) {
      m.uniforms = surfUniforms({ uLoadedMask: { value: this.maskTex }, uMaskInfo: { value: V4(0, 0, 64, i === 0 ? 1 : 1) }, uHole: { value: V4() }, uFarShift: { value: i === 0 ? -0.06 : -1.6 } });
    }
    this.lodWaterMats = this.lodMats.map((m, i) => {
      const w = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, defines: { LOD_WATER: 1 }, vertexShader: G_WATER_VERT, fragmentShader: G_WATER_FRAG, side: THREE.DoubleSide, uniforms: Object.assign({}, Pipeline.waterMat.uniforms, { uLoadedMask: m.uniforms.uLoadedMask, uMaskInfo: m.uniforms.uMaskInfo, uHole: m.uniforms.uHole }) });
      if (i === 1) { w.polygonOffset = true; w.polygonOffsetFactor = 2; w.polygonOffsetUnits = 2; }
      return w;
    });
    this.clump = grassClumpGeometry(Q.name === 'ultra' ? 12 : Q.name === 'high' ? 10 : Q.name === 'medium' ? 8 : 6);
  }
  dispose() {
    this.disposed = true;
    for (const c of this.chunks.values()) this._freeMeshes(c);
    for (const m of this.lod) { for (const t of m.values()) this._freeLod(t); m.clear(); }
    this.chunks.clear(); this.maskTex.dispose(); this.rainTex.dispose();
  }

  chunk(cx, cz) { return this.chunks.get(chunkKey(cx, cz)); }
  getBlock(x, y, z) {
    if (y < 0) return B.bedrock;
    if (y >= WORLD_H) return 0;
    const c = this.chunk(x >> 4, z >> 4);
    if (!c || !c.blocks) return 0;
    return c.blocks[bidx(x & 15, y, z & 15)];
  }
  getId(x, y, z) { return this.getBlock(x, y, z) & 255; }
  isLoaded(x, z) { const c = this.chunk(x >> 4, z >> 4); return !!(c && c.blocks); }
  getLight(x, y, z, out = [0, 0, 0, 1]) {
    const c = this.chunk(x >> 4, z >> 4);
    y = Math.floor(y);
    if (!c || !c.lightVol || y >= c.lightH) { out[0] = 0; out[1] = 0; out[2] = 0; out[3] = c && c.lightVol ? 1 : (y > SEA ? 1 : 0); return out; }
    const o = ((x & 15) + (z & 15) * 16 + Math.max(0, y) * 256) * 4;
    out[0] = c.lightVol[o] / 255; out[1] = c.lightVol[o + 1] / 255; out[2] = c.lightVol[o + 2] / 255; out[3] = c.lightVol[o + 3] / 255;
    return out;
  }
  surfaceY(x, z) {
    for (let y = WORLD_H - 1; y > 0; y--) { const id = this.getId(x, y, z); if (T_SOLID[id] && T_KIND[id] !== KIND.leaves) return y; }
    return SEA;
  }

  setBlock(x, y, z, value, opts = {}) {
    if (y <= 0 || y >= WORLD_H) return false;
    const cx = x >> 4, cz = z >> 4, c = this.chunk(cx, cz);
    if (!c || !c.blocks) return false;
    const i = bidx(x & 15, y, z & 15), old = c.blocks[i];
    if (old === value) return false;
    c.blocks[i] = value;
    if (!opts.transient) {
      let e = this.edits.get(c.key);
      if (!e) this.edits.set(c.key, e = new Map());
      e.set(i, value);
    }
    this._markDirty(cx, cz, true);
    const lx = x & 15, lz = z & 15, a = old & 255, b = value & 255;
    const lightChange = T_OPAQUE[a] !== T_OPAQUE[b] || T_EMIT_ANY(a) || T_EMIT_ANY(b) || T_LIGHT[a] !== T_LIGHT[b];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const touches = (dx === 0 || (dx < 0 ? lx === 0 : lx === 15)) && (dz === 0 || (dz < 0 ? lz === 0 : lz === 15));
      if (touches) this._markDirty(cx + dx, cz + dz, true);
      else if (lightChange) {
        const reach = (dx === 0 ? 0 : dx < 0 ? lx : 15 - lx) + (dz === 0 ? 0 : dz < 0 ? lz : 15 - lz);
        if (reach < 14) this._markDirty(cx + dx, cz + dz, false);
      }
    }
    if (!opts.noPhysics) this._wake(x, y, z);
    return true;
  }
  _markDirty(cx, cz, urgent) {
    const c = this.chunk(cx, cz);
    if (c) { c.dirty = true; if (urgent) c.urgent = true; }
  }
  _wake(x, y, z) {
    for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) this.fluid.set((x + dx) + ',' + (y + dy) + ',' + (z + dz), [x + dx, y + dy, z + dz]);
  }
  // water spreading, falling sand, and plants that lose their footing
  tickPhysics(dt, onFall, onPop) {
    this.fluidTimer += dt;
    if (this.fluidTimer < 0.22 || !this.fluid.size) return;
    this.fluidTimer = 0;
    const batch = [...this.fluid.values()].slice(0, 160);
    for (const [x, y, z] of batch) this.fluid.delete(x + ',' + y + ',' + z);
    for (const [x, y, z] of batch) {
      const v = this.getBlock(x, y, z), id = v & 255;
      if (!this.isLoaded(x, z)) continue;
      const below = this.getId(x, y - 1, z);
      if (FALLING.has(id)) {
        if (below === 0 || below === B.water || T_KIND[below] === KIND.cross) { this.setBlock(x, y, z, 0); onFall(x, y, z, id); }
        continue;
      }
      const kind = T_KIND[id];
      if ((kind === KIND.cross && id !== B.lily_pad && id !== B.kelp && !(id === B.reeds && below === B.reeds)) || kind === KIND.campfire || (kind === KIND.crystal && !((v >> 8) & 1))) {
        if (!T_SOLID[below] && !(id === B.reeds && below === B.water)) { this.setBlock(x, y, z, 0); onPop(x, y, z, id); continue; }
      }
      if (kind === KIND.torch) {
        const d = TORCH_DIR[(v >> 8) & 7] || [0, 0];
        const support = (v >> 8) & 7 ? this.getId(x - d[0], y, z - d[1]) : below;
        if (!T_SOLID[support]) { this.setBlock(x, y, z, 0); onPop(x, y, z, id); continue; }
      }
      if (id === B.lily_pad && below !== B.water) { this.setBlock(x, y, z, 0); onPop(x, y, z, id); continue; }
      if (id === B.water && (v >> 8) > 0) {
        // drain flowing water that lost its feed
        const lvl = v >> 8;
        let fed = this.getId(x, y + 1, z) === B.water;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = this.getBlock(x + dx, y, z + dz); if ((n & 255) === B.water && (n >> 8) < lvl) fed = true; }
        if (!fed) { this.setBlock(x, y, z, 0); continue; }
      }
      if (id === 0 || kind === KIND.cross && id !== B.seagrass && id !== B.kelp && id !== B.reeds && id !== B.lily_pad) {
        let level = 99;
        if (this.getId(x, y + 1, z) === B.water) level = 1;
        let sources = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = this.getBlock(x + dx, y, z + dz);
          if ((n & 255) !== B.water) continue;
          const nl = n >> 8;
          if (nl === 0) sources++;
          const under = this.getId(x + dx, y - 1, z + dz);
          if (under !== 0 || nl === 0) level = Math.min(level, nl + 1);
        }
        if (sources >= 2 && (T_SOLID[below] || below === B.water)) level = 0;
        if (level <= 6) { if (id !== 0) onPop(x, y, z, id); this.setBlock(x, y, z, B.water | (level << 8)); }
      }
    }
  }

  raycast(origin, dir, maxDist, hitFluid = false) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
    const tdx = sx ? Math.abs(1 / dir.x) : 1e9, tdy = sy ? Math.abs(1 / dir.y) : 1e9, tdz = sz ? Math.abs(1 / dir.z) : 1e9;
    let tx = sx > 0 ? (x + 1 - origin.x) * tdx : sx < 0 ? (origin.x - x) * tdx : 1e9;
    let ty = sy > 0 ? (y + 1 - origin.y) * tdy : sy < 0 ? (origin.y - y) * tdy : 1e9;
    let tz = sz > 0 ? (z + 1 - origin.z) * tdz : sz < 0 ? (origin.z - z) * tdz : 1e9;
    let t = 0;
    for (let i = 0; i < 128 && t <= maxDist; i++) {
      const v = this.getBlock(x, y, z), id = v & 255;
      if (id !== 0 && (hitFluid || (id !== B.water && id !== B.lava))) {
        let best = null;
        for (const b of pickBoxes(id, v >> 8)) {
          const h = rayBox(origin, dir, x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]);
          if (h && h.t <= maxDist && (!best || h.t < best.t)) best = h;
        }
        if (best) return { x, y, z, id, meta: v >> 8, t: best.t, nx: best.nx, ny: best.ny, nz: best.nz, px: origin.x + dir.x * best.t, py: origin.y + dir.y * best.t, pz: origin.z + dir.z * best.t };
      }
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; } else if (ty < tz) { y += sy; t = ty; ty += tdy; } else { z += sz; t = tz; tz += tdz; }
    }
    return null;
  }

  // ---------------------------------------------------------------- streaming
  update(px, pz, viewDist, dirx = 0, dirz = 1) {
    const ccx = Math.floor(px / 16), ccz = Math.floor(pz / 16);
    const key = ccx + ',' + ccz + ',' + viewDist;
    if (key !== this.ringKey) {
      this.ringKey = key; this.centerX = ccx; this.centerZ = ccz; this.viewDist = viewDist;
      this.ring = [];
      const R = viewDist + 1;
      for (let dz = -R - 1; dz <= R + 1; dz++) for (let dx = -R - 1; dx <= R + 1; dx++) {
        const d = Math.hypot(dx, dz);
        if (d <= R + 1.45) this.ring.push({ dx, dz, d });
      }
      this.ring.sort((a, b) => a.d - b.d);
      this._unload();
      this.maskDirty = true; this.rainDirty = true;
    }
    const maxGen = this.pool.workers.length + 2, maxMesh = this.pool.workers.length + 1;
    let missing = 0;
    for (const r of this.ring) {
      const cx = ccx + r.dx, cz = ccz + r.dz, k = chunkKey(cx, cz);
      let c = this.chunks.get(k);
      const behind = r.d > 2 && (r.dx * dirx + r.dz * dirz) / r.d < -0.2 ? r.d * 0.8 : 0;
      if (!c) {
        if (this.genInflight >= maxGen) continue;
        c = { cx, cz, key: k, blocks: null, meshed: false, dirty: false, urgent: false, pending: false, meshes: [], lights: [], entities: [], heightmap: null, lightVol: null, lightH: 0, version: 0, grass: null };
        this.chunks.set(k, c);
        this._requestGen(c, r.d + behind);
      }
    }
    // meshing: urgent rebuilds first, then nearest
    for (const r of this.ring) {
      if (r.d > viewDist + 0.5) continue;
      const c = this.chunks.get(chunkKey(ccx + r.dx, ccz + r.dz));
      if (!c || !c.blocks) { missing++; continue; }
      if (c.meshed && !c.dirty) continue;
      if (!c.meshed) missing++;
      if (c.pending) continue;
      if ((this.meshInflight >= maxMesh || this.results.length > 24) && !c.urgent) continue;
      const nb = this._neighbors(c);
      if (!nb) continue;
      const behind = r.d > 2 && (r.dx * dirx + r.dz * dirz) / r.d < -0.2 ? r.d * 0.8 : 0;
      this._requestMesh(c, nb, c.urgent ? -100 + r.d : 100 + r.d + behind);
    }
    this.missing = missing;
    this._updateLOD(px, pz, viewDist);
    this._updateFar(px, pz);
  }
  _neighbors(c) {
    const nb = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const n = this.chunk(c.cx + dx, c.cz + dz);
      if (!n || !n.blocks) return null;
      nb.push(n.blocks);
    }
    return nb;
  }
  _requestGen(c, priority) {
    this.genInflight++;
    this.pool.run({ type: 'gen', cx: c.cx, cz: c.cz }, 200 + priority).then((r) => {
      this.genInflight--;
      if (this.disposed || this.chunks.get(c.key) !== c) return;
      c.blocks = r.blocks; c.biomes = r.biomes;
      const e = this.edits.get(c.key);
      if (e) for (const [i, v] of e) c.blocks[i] = v;
    }).catch(() => { this.genInflight--; });
  }
  _requestMesh(c, nb, priority) {
    c.pending = true; c.dirty = false; const urgent = c.urgent; c.urgent = false;
    this.meshInflight++;
    this.pool.run({ type: 'mesh', cx: c.cx, cz: c.cz, nb, opts: { grass: Q.grass, leafCards: Q.leafCards } }, priority).then((r) => {
      this.meshInflight--;
      if (this.disposed || this.chunks.get(c.key) !== c) return;
      // a chunk stays pending until its mesh is actually uploaded, so it is not requested twice
      if (urgent) { c.pending = false; this._applyMesh(c, r); } else this.results.push([c, r]);
    }).catch(() => { this.meshInflight--; c.pending = false; });
  }
  applyPending(budget) {
    let n = 0;
    while (this.results.length && n < budget) {
      const [c, r] = this.results.shift();
      if (this.chunks.get(c.key) === c) { c.pending = false; this._applyMesh(c, r); n++; }
    }
    if (this.maskDirty) this._updateMask();
    if (this.rainDirty) this._updateRain();
  }
  _freeMeshes(c) {
    for (const m of c.meshes) { m.parent && m.parent.remove(m); if (m.geometry && !m.userData.shared) { m.geometry.index = null; m.geometry.dispose(); } }
    c.meshes = []; c.grass = null;
    if (this.onEntities) this.onEntities(c, []);
  }
  _applyMesh(c, r) {
    this._freeMeshes(c);
    const S = Pipeline.scenes, ox = c.cx * 16, oz = c.cz * 16;
    const add = (geo, mat, scene, shared) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(ox, 0, oz); m.matrixAutoUpdate = false; m.updateMatrix(); m.matrixWorld.copy(m.matrix); m.matrixWorldAutoUpdate = false;
      if (shared) m.userData.shared = true;
      scene.add(m); c.meshes.push(m);
      return m;
    };
    const setBounds = (geo, minY, maxY, pad = 1.2) => {
      geo.boundingBox = new THREE.Box3(V3(-pad, minY - pad, -pad), V3(16 + pad, maxY + pad, 16 + pad));
      geo.boundingSphere = new THREE.Sphere(); geo.boundingBox.getBoundingSphere(geo.boundingSphere);
    };
    if (r.opaque) { const g = voxelGeometry(r.opaque); setBounds(g, r.opaque.minY, r.opaque.maxY); add(g, WorldMats.terrain, S.gbuf).renderOrder = 1; add(g, WorldMats.shadowOpaque, S.shadow, true); }
    if (r.cutout) { const g = voxelGeometry(r.cutout); setBounds(g, r.cutout.minY, r.cutout.maxY); add(g, WorldMats.cutout, S.gbuf).renderOrder = 2; add(g, WorldMats.shadowCutout, S.shadow, true); }
    if (r.water) { const g = voxelGeometry(r.water); setBounds(g, r.water.minY, r.water.maxY); add(g, Pipeline.waterMat, S.water); }
    if (r.glass) { const g = voxelGeometry(r.glass); setBounds(g, r.glass.minY, r.glass.maxY); add(g, Pipeline.glassMat, S.glass); }
    if (r.grass) {
      const g = new THREE.InstancedBufferGeometry();
      const k = this.clump;
      g.setAttribute('position', k.pos); g.setAttribute('aBlade', k.blade); g.setAttribute('aSide', k.side); g.setIndex(k.index);
      g.setAttribute('iPos', new THREE.InstancedBufferAttribute(this._localise(r.grass.ipos, ox, oz), 4));
      g.setAttribute('iTint', new THREE.InstancedBufferAttribute(r.grass.itint, 4, true));
      g.setAttribute('iLight', new THREE.InstancedBufferAttribute(r.grass.ilight, 4, true));
      g.instanceCount = r.grass.n;
      setBounds(g, r.grass.minY, r.grass.maxY);
      const m = add(g, WorldMats.grass, S.gbuf); m.renderOrder = 3;
      const sm = add(g, WorldMats.shadowGrass, S.shadowNear, true);
      c.grass = { geo: g, n: r.grass.n, mesh: m, shadow: sm };
    }
    c.lights = r.lights; c.entities = r.entities; c.heightmap = r.heightmap; c.lightVol = r.lightVol; c.lightH = r.lightH;
    c.meshed = true; c.version++;
    this.maskDirty = true; this.rainDirty = true;
    if (this.onEntities) this.onEntities(c, r.entities);
  }
  _localise(ipos, ox, oz) {
    // grass instances arrive in chunk space already; copy so the transferable can be released
    return ipos;
  }
  updateGrass(camPos) {
    // thin distant chunks by drawing a prefix of the shuffled instance list
    const D = Q.grassDist;
    for (const c of this.chunks.values()) {
      if (!c.grass) continue;
      const dx = Math.max(c.cx * 16 - camPos.x, 0, camPos.x - c.cx * 16 - 16), dz = Math.max(c.cz * 16 - camPos.z, 0, camPos.z - c.cz * 16 - 16);
      const d = Math.hypot(dx, dz);
      const vis = d < D * 1.02;
      c.grass.mesh.visible = vis; c.grass.shadow.visible = d < 20;
      if (vis) c.grass.geo.instanceCount = Math.ceil(c.grass.n * clamp(1.25 - d / D, 0.18, 1));
    }
  }
  _unload() {
    const R = (this.viewDist || 8) + 3.5;
    for (const [k, c] of this.chunks) {
      const dx = c.cx - this.centerX, dz = c.cz - this.centerZ;
      if (dx * dx + dz * dz > R * R) { this._freeMeshes(c); this.chunks.delete(k); }
    }
  }
  _updateMask() {
    this.maskDirty = false;
    const ox = this.centerX - 32, oz = this.centerZ - 32;
    this.maskData.fill(0);
    const R2 = (this.viewDist + 0.5) ** 2;
    for (const c of this.chunks.values()) {
      const i = c.cx - ox, j = c.cz - oz, dx = c.cx - this.centerX, dz = c.cz - this.centerZ;
      if (c.meshed && i >= 0 && j >= 0 && i < 64 && j < 64 && dx * dx + dz * dz <= R2) this.maskData[j * 64 + i] = 255;
    }
    // draw voxel chunks only inside the radius so the film is independent of what happens to be cached
    for (const c of this.chunks.values()) {
      if (!c.meshed) continue;
      const dx = c.cx - this.centerX, dz = c.cz - this.centerZ, vis = dx * dx + dz * dz <= R2;
      for (const m of c.meshes) if (!c.grass || (m !== c.grass.mesh && m !== c.grass.shadow)) m.visible = vis;
      if (c.grass && !vis) { c.grass.mesh.visible = false; c.grass.shadow.visible = false; }
    }
    this.maskTex.needsUpdate = true;
    for (const m of this.lodMats) m.uniforms.uMaskInfo.value.set(ox, oz, 64, 1);
  }
  _updateRain() {
    this.rainDirty = false;
    const ox = (this.centerX - 8) * 16, oz = (this.centerZ - 8) * 16;
    this.rainData.fill(0);
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      const c = this.chunk(this.centerX - 8 + i, this.centerZ - 8 + j);
      if (!c || !c.heightmap) continue;
      for (let z = 0; z < 16; z++) this.rainData.set(c.heightmap.subarray(z * 16, z * 16 + 16), (j * 16 + z) * 256 + i * 16);
    }
    this.rainTex.needsUpdate = true;
    U.uRainMapInfo.value.set(ox, oz, 256, 0);
  }
  roofAt(x, z) {
    const c = this.chunk(Math.floor(x) >> 4, Math.floor(z) >> 4);
    if (!c || !c.heightmap) return 0;
    return c.heightmap[(Math.floor(z) & 15) * 16 + (Math.floor(x) & 15)];
  }

  // coarse height field for mountain-scale sun shadows
  _updateFar(px, pz) {
    if (this.farPending) return;
    const snap = 256, ext = FAR_N * FAR_STEP;
    const x0 = Math.round(px / snap) * snap - ext / 2, z0 = Math.round(pz / snap) * snap - ext / 2;
    if (this.farOrigin && this.farOrigin[0] === x0 && this.farOrigin[1] === z0) return;
    this.farPending = true;
    const strips = 8, jobs = [];
    for (let s = 0; s < strips; s++) {
      const row0 = Math.floor((s * FAR_N) / strips), row1 = Math.floor(((s + 1) * FAR_N) / strips);
      jobs.push(this.pool.run({ type: 'heights', x0, z0, step: FAR_STEP, n: FAR_N, row0, row1 }, 120).then((r) => [row0, r.data]));
    }
    Promise.all(jobs).then((parts) => {
      this.farPending = false;
      if (this.disposed) return;
      for (const [row0, d] of parts) this.farData.set(d, row0 * FAR_N);
      this.farTex.needsUpdate = true; this.farOrigin = [x0, z0];
      U.uFarInfo.value.set(x0, z0, ext, 1);
    }).catch(() => { this.farPending = false; });
  }

  // ---------------------------------------------------------------- distant terrain
  _updateLOD(px, pz, viewDist) {
    if (!Materials.avg.length) return;
    const levels = [
      { size: 128, cell: 2, k: Math.ceil((viewDist * 16 + Q.lodNear) / 128) },
      { size: 512, cell: 6.4, k: Math.ceil(Q.lodDist / 512) },
    ];
    let rectA = null, pending = 0;
    for (let li = 0; li < 2; li++) {
      const L = levels[li], store = this.lod[li];
      const tx = Math.floor(px / L.size), tz = Math.floor(pz / L.size);
      const wanted = new Set();
      let complete = true;
      const list = [];
      for (let dz = -L.k; dz <= L.k; dz++) for (let dx = -L.k; dx <= L.k; dx++) {
        if (li === 1 && dx * dx + dz * dz > (L.k + 0.6) ** 2) continue;
        list.push([dx * dx + dz * dz, tx + dx, tz + dz]);
      }
      list.sort((a, b) => a[0] - b[0]);
      for (const [d2, ax, az] of list) {
        const key = ax + ',' + az;
        wanted.add(key);
        let t = store.get(key);
        if (!t) {
          if (this.lodInflight >= Math.max(3, this.pool.workers.length - 2)) { complete = false; continue; }
          t = { ready: false, mesh: null };
          store.set(key, t);
          this.lodInflight++;
          this.pool.run({ type: 'lod', tx: ax, tz: az, size: L.size, cell: L.cell, colors: Materials.avg }, 150 + Math.sqrt(d2) * (li ? 18 : 6)).then((r) => {
            this.lodInflight--;
            if (this.disposed || store.get(key) !== t) return;
            t.ready = true;
            const m = r.mesh;
            if (!m) return;
            if (m.water) {
              const wg = voxelGeometry(m.water);
              wg.boundingBox = new THREE.Box3(V3(0, SEA - 2, 0), V3(L.size, SEA + 3, L.size)); wg.boundingSphere = new THREE.Sphere(); wg.boundingBox.getBoundingSphere(wg.boundingSphere);
              const wm = new THREE.Mesh(wg, this.lodWaterMats[li]);
              wm.position.set(ax * L.size, 0, az * L.size); wm.matrixAutoUpdate = false; wm.updateMatrix(); wm.matrixWorld.copy(wm.matrix); wm.matrixWorldAutoUpdate = false;
              wm.renderOrder = 1 + li;
              Pipeline.scenes.water.add(wm);
              t.water = wm;
            }
            if (!m.n) return;
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
            g.setAttribute('aNrm', new THREE.BufferAttribute(m.nrm, 4, true));
            g.setAttribute('aCol', new THREE.BufferAttribute(m.col, 4, true));
            g.setAttribute('aUv', new THREE.BufferAttribute(m.uv, 2, true));
            g.setIndex(quadIndex(m.n / 4)); g.setDrawRange(0, m.n / 4 * 6);
            g.boundingBox = new THREE.Box3(V3(0, m.minY - 1, 0), V3(L.size, m.maxY + 1, L.size));
            g.boundingSphere = new THREE.Sphere(); g.boundingBox.getBoundingSphere(g.boundingSphere);
            const mesh = new THREE.Mesh(g, this.lodMats[li]);
            mesh.position.set(ax * L.size, 0, az * L.size); mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.matrixWorld.copy(mesh.matrix); mesh.matrixWorldAutoUpdate = false;
            mesh.renderOrder = li;
            Pipeline.scenes.lod.add(mesh);
            t.mesh = mesh;
          }).catch(() => { this.lodInflight--; });
        }
        if (!t.ready) { complete = false; pending++; }
      }
      for (const [key, t] of store) {
        if (!wanted.has(key)) { this._freeLod(t); store.delete(key); }
      }
      if (li === 0) rectA = complete ? [(tx - L.k) * L.size, (tz - L.k) * L.size, (tx + L.k + 1) * L.size, (tz + L.k + 1) * L.size] : null;
    }
    const hole = this.lodMats[1].uniforms.uHole.value;
    if (rectA) hole.set(rectA[0] + 2, rectA[1] + 2, rectA[2] - 2, rectA[3] - 2); else hole.set(0, 0, 0, 0);
    this.lodPending = pending;
  }
  _freeLod(t) {
    if (t.water) { Pipeline.scenes.water.remove(t.water); t.water.geometry.index = null; t.water.geometry.dispose(); t.water = null; }
    if (t.mesh) { Pipeline.scenes.lod.remove(t.mesh); t.mesh.geometry.index = null; t.mesh.geometry.dispose(); t.mesh = null; }
  }

  // true once everything visible from here has been built
  get settled() { return this.missing === 0 && this.genInflight === 0 && this.meshInflight === 0 && this.results.length === 0 && !this.lodPending && this.lodInflight === 0 && !this.farPending; }
  async settle(px, pz, viewDist, onProgress) {
    let spins = 0;
    for (;;) {
      this.update(px, pz, viewDist, 0, 0);
      this.applyPending(1000);
      if (this.settled && ![...this.chunks.values()].some((c) => c.dirty && c.meshed && this._inView(c))) break;
      if (onProgress && (spins & 7) === 0) onProgress(this.missing);
      spins++;
      await sleep(4);
    }
  }
  _inView(c) { const dx = c.cx - this.centerX, dz = c.cz - this.centerZ; return dx * dx + dz * dz <= (this.viewDist + 0.5) ** 2; }

  collectLights(px, py, pz, out) {
    const ccx = Math.floor(px / 16), ccz = Math.floor(pz / 16);
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      const c = this.chunk(ccx + dx, ccz + dz);
      if (!c) continue;
      for (const l of c.lights) if (Math.abs(l.y - py) < 40) out.push(l);
    }
    return out;
  }

  serializeEdits() {
    const o = {};
    for (const [k, m] of this.edits) { const a = []; for (const [i, v] of m) a.push(i, v); o[k] = a; }
    return o;
  }
  loadEdits(o) {
    this.edits.clear();
    for (const k in o) { const m = new Map(), a = o[k]; for (let i = 0; i < a.length; i += 2) m.set(a[i], a[i + 1]); this.edits.set(k, m); }
  }
}
const T_EMIT_ANY = (id) => !!BLOCKS[id].emit;

function rayBox(o, d, x0, y0, z0, x1, y1, z1) {
  let tmin = -1e9, tmax = 1e9, nx = 0, ny = 0, nz = 0;
  const axes = [[o.x, d.x, x0, x1, 0], [o.y, d.y, y0, y1, 1], [o.z, d.z, z0, z1, 2]];
  for (const [p, v, lo, hi, a] of axes) {
    if (Math.abs(v) < 1e-9) { if (p < lo || p > hi) return null; continue; }
    let t0 = (lo - p) / v, t1 = (hi - p) / v, s = -1;
    if (t0 > t1) { const t = t0; t0 = t1; t1 = t; s = 1; }
    if (t0 > tmin) { tmin = t0; nx = a === 0 ? s : 0; ny = a === 1 ? s : 0; nz = a === 2 ? s : 0; }
    if (t1 < tmax) tmax = t1;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  return { t: Math.max(tmin, 0), nx, ny, nz };
}
