// ================================================================ block entities, item drops, falling blocks, debris
function perObjectLight(mesh) {
  mesh.onBeforeRender = (r, s, c, g, material) => {
    if (!material.uniforms || !material.uniforms.uLight) return;
    material.uniforms.uLight.value.copy(mesh.userData.light);
    material.uniforms.uEmisBoost.value = mesh.userData.emis === undefined ? 1 : mesh.userData.emis;
    material.uniforms.uHit.value = mesh.userData.hit || 0;
    material.uniformsNeedUpdate = true;
  };
}

const Entities = {
  blockMats: null, byChunk: new Map(), drops: [], falling: [], debris: [], maxDebris: 700, openChests: new Set(),
  init() {
    this.mat = makeModelMaterial(); this.mat.uniforms.uObjFlags.value = 2;
    this.shadowMat = makeModelShadowMaterial();
    this.geo = this._buildBlockEntityGeometry();
    // debris: instanced lit chips that bounce and come to rest
    const mb = new ModelBuilder();
    mb.box([0, 0, 0], [0.5, 0.5, 0.5], { layer: 0, uvScale: 0.25 });
    const g = mb.geometry();
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = rand01(Math.round(p.getX(i) * 2), Math.round(p.getY(i) * 2), Math.round(p.getZ(i) * 2), 9); const s = 0.55 + k * 0.75; p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.75, p.getZ(i) * s); }
    g.computeVertexNormals();
    this.iData = new THREE.InstancedBufferAttribute(new Float32Array(this.maxDebris * 4), 4);
    this.iLight = new THREE.InstancedBufferAttribute(new Float32Array(this.maxDebris * 4), 4);
    g.setAttribute('iData', this.iData); g.setAttribute('iLight', this.iLight);
    this.debrisMesh = new THREE.InstancedMesh(g, this.mat, this.maxDebris);
    this.debrisMesh.frustumCulled = false; this.debrisMesh.count = 0;
    this.debrisShadow = new THREE.InstancedMesh(g, this.shadowMat, this.maxDebris);
    this.debrisShadow.instanceMatrix = this.debrisMesh.instanceMatrix; this.debrisShadow.frustumCulled = false; this.debrisShadow.count = 0;
    Pipeline.scenes.gbuf.add(this.debrisMesh); Pipeline.scenes.shadow.add(this.debrisShadow);
  },
  reset() {
    for (const key of [...this.byChunk.keys()]) this._clearChunk(key);
    for (const d of this.drops) this._removeObj(d);
    for (const f of this.falling) this._removeObj(f);
    this.drops = []; this.falling = []; this.debris = []; this.debrisMesh.count = 0; this.debrisShadow.count = 0; this.openChests.clear();
  },
  _pair(geometry, light) {
    const m = new THREE.Mesh(geometry, this.mat), s = new THREE.Mesh(geometry, this.shadowMat);
    m.userData.light = light || V4(0, 0, 0, 1); perObjectLight(m);
    return [m, s];
  },
  _removeObj(o) { o.mesh.parent && o.mesh.parent.remove(o.mesh); o.shadow && o.shadow.parent && o.shadow.parent.remove(o.shadow); },
  _buildBlockEntityGeometry() {
    const iron = { layer: LAYER.iron, color: [0.75, 0.73, 0.7], metal: -1 };
    const brass = { layer: LAYER.iron, color: [1.0, 0.8, 0.45], metal: 0.95, rough: 0.34 };
    const wood = () => ({ layer: LAYER.chest_wood, fit: true });
    // chest, front facing +Z, origin at the block centre floor
    const base = new ModelBuilder();
    base.box([0, 0.29, 0], [0.44, 0.29, 0.44], {}, undefined, wood);
    for (const x of [-0.31, 0.31]) base.box([x, 0.29, 0], [0.036, 0.294, 0.447], iron);
    base.box([0, 0.025, 0], [0.45, 0.026, 0.45], iron); base.box([0, 0.55, 0], [0.45, 0.022, 0.45], iron);
    for (const x of [-0.435, 0.435]) for (const z of [-0.435, 0.435]) base.box([x, 0.29, z], [0.022, 0.29, 0.022], iron);
    base.box([0, 0.5, 0.452], [0.075, 0.07, 0.014], brass);
    const lid = new ModelBuilder();
    // lid is modelled relative to its back hinge
    lid.box([0, 0.11, 0.44], [0.44, 0.11, 0.44], {}, undefined, wood);
    lid.box([0, 0.255, 0.44], [0.4, 0.038, 0.36], {}, undefined, wood);
    for (const x of [-0.31, 0.31]) { lid.box([x, 0.12, 0.44], [0.036, 0.113, 0.447], iron); lid.box([x, 0.262, 0.44], [0.036, 0.034, 0.368], iron); }
    lid.box([0, 0.012, 0.44], [0.452, 0.016, 0.452], iron);
    lid.box([0, 0.055, 0.893], [0.05, 0.075, 0.012], brass);
    // door: a single 1 x 2 leaf on the +Z side, modelled around its hinge
    const door = new ModelBuilder();
    const t = 0.17, hx = 1 - t / 2;
    door.box([-hx + 0.5, 1, 0], [0.497, 0.998, t / 2], {}, undefined, (f) => (f >= 4 ? { layer: LAYER.door, fit: true } : { layer: LAYER.oak_planks, uvScale: 1 }));
    for (const side of [1, -1]) {
      for (const y of [0.34, 1.7]) door.box([-hx + 0.38, y, side * (t / 2 + 0.008)], [0.36, 0.035, 0.012], iron);
      door.tube([[-hx + 0.2, 0.92, side * (t / 2 + 0.02)], [-hx + 0.2, 0.92, side * (t / 2 + 0.07)], [-hx + 0.2, 1.08, side * (t / 2 + 0.07)], [-hx + 0.2, 1.08, side * (t / 2 + 0.02)]], 0.017, 7, brass);
    }
    return { chestBase: base.geometry(), chestLid: lid.geometry(), door: door.geometry() };
  },
  _clearChunk(key) {
    const list = this.byChunk.get(key);
    if (!list) return;
    for (const e of list) for (const p of e.parts) this._removeObj(p);
    this.byChunk.delete(key);
  },
  setChunk(chunk, list) {
    const old = this.byChunk.get(chunk.key) || [];
    const prevAngles = new Map(old.map((e) => [e.pos, e.angle]));
    this._clearChunk(chunk.key);
    const out = [];
    const S = Pipeline.scenes;
    for (const d of list) {
      if (d.id === B.door && (d.meta & 8)) continue;
      const light = V4(d.light[0] / 255, d.light[1] / 255, d.light[2] / 255, d.light[3] / 255);
      const f = d.meta & 3, rot = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][f];
      const pos = d.x + ',' + d.y + ',' + d.z;
      const e = { pos, x: d.x, y: d.y, z: d.z, id: d.id, meta: d.meta, parts: [], angle: 0 };
      const addPart = (geo, parentM) => { const [m, s] = this._pair(geo, light); S.gbuf.add(m); S.shadow.add(s); const part = { mesh: m, shadow: s }; e.parts.push(part); return part; };
      const place = (part, px, py, pz, ry, rx = 0) => { for (const o of [part.mesh, part.shadow]) { o.position.set(px, py, pz); o.rotation.set(rx, ry, 0, 'YXZ'); o.updateMatrixWorld(); } };
      if (d.id === B.chest) {
        const base = addPart(this.geo.chestBase), lid = addPart(this.geo.chestLid);
        const cx = d.x + 0.5, cz = d.z + 0.5;
        place(base, cx, d.y, cz, rot);
        e.lid = lid; e.place = (a) => place(lid, cx - Math.sin(rot) * 0.44, d.y + 0.575, cz - Math.cos(rot) * 0.44, rot, -a);
        e.angle = prevAngles.get(pos) || 0;
        e.target = () => (this.openChests.has(pos) ? 1.75 : 0);
      } else {
        const leaf = addPart(this.geo.door);
        const t = 0.17, off = 0.5 - t / 2;
        // hinge sits in the corner shared by the closed and open positions
        const hxl = off, hzl = off;
        const hx = d.x + 0.5 + hxl * Math.cos(rot) + hzl * Math.sin(rot), hz = d.z + 0.5 - hxl * Math.sin(rot) + hzl * Math.cos(rot);
        e.place = (a) => place(leaf, hx, d.y, hz, rot - a);
        const open = (d.meta & 4) !== 0;
        e.angle = prevAngles.has(pos) ? prevAngles.get(pos) : open ? Math.PI / 2 : 0;
        e.target = () => (open ? Math.PI / 2 : 0);
      }
      e.place(e.angle);
      out.push(e);
    }
    if (out.length) this.byChunk.set(chunk.key, out);
  },
  update(dt, world, player, inventory, onPickup) {
    for (const list of this.byChunk.values()) for (const e of list) {
      const t = e.target();
      if (Math.abs(t - e.angle) > 0.002) { e.angle += (t - e.angle) * Math.min(1, dt * 9); e.place(e.angle); }
    }
    // dropped items float, bob and fly to the player
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      const target = player ? V3(player.pos.x, player.pos.y + 0.8, player.pos.z) : null;
      const dist = target ? target.distanceTo(d.pos) : 99;
      let magnet = false;
      if (target && d.age > d.delay && dist < 2.2 && !player.dead) {
        magnet = true;
        const pull = V3().subVectors(target, d.pos).normalize().multiplyScalar(14 * dt * (2.4 - dist));
        d.vel.add(pull); d.vel.multiplyScalar(0.9);
        if (dist < 0.75) {
          const left = inventory.add(d.key, d.n, d.dur);
          if (left < d.n && onPickup) onPickup(d.key);
          d.n = left;
          if (!left) { this._removeObj(d); this.drops.splice(i, 1); continue; }
        }
      }
      if (!magnet) d.vel.y -= 16 * dt;
      const nx = d.pos.x + d.vel.x * dt, ny = d.pos.y + d.vel.y * dt, nz = d.pos.z + d.vel.z * dt;
      if (T_SOLID[world.getId(Math.floor(nx), Math.floor(d.pos.y), Math.floor(d.pos.z))]) d.vel.x *= -0.3; else d.pos.x = nx;
      if (T_SOLID[world.getId(Math.floor(d.pos.x), Math.floor(d.pos.y), Math.floor(nz))]) d.vel.z *= -0.3; else d.pos.z = nz;
      if (!magnet && T_SOLID[world.getId(Math.floor(d.pos.x), Math.floor(ny - 0.16), Math.floor(d.pos.z))]) { d.vel.y = 0; d.vel.x *= 0.82; d.vel.z *= 0.82; d.pos.y = Math.floor(ny - 0.16) + 1.16; d.rest = true; } else d.pos.y = ny;
      if (world.getId(Math.floor(d.pos.x), Math.floor(d.pos.y), Math.floor(d.pos.z)) === B.water) { d.vel.multiplyScalar(0.92); d.vel.y += 20 * dt; }
      if (T_SOLID[world.getId(Math.floor(d.pos.x), Math.floor(d.pos.y), Math.floor(d.pos.z))]) d.pos.y += dt * 3;
      const bob = Math.sin(d.age * 2.4 + d.phase) * 0.055 + 0.07;
      for (const o of [d.mesh, d.shadow]) { o.position.set(d.pos.x, d.pos.y + bob, d.pos.z); o.rotation.y = d.age * 1.1 + d.phase; o.updateMatrixWorld(); }
      const l = world.getLight(Math.floor(d.pos.x), d.pos.y + 0.2, Math.floor(d.pos.z));
      d.mesh.userData.light.set(l[0], l[1], l[2], l[3]);
      if (d.age > 300) { this._removeObj(d); this.drops.splice(i, 1); }
    }
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.vy -= 22 * dt; f.y += f.vy * dt;
      const below = world.getId(f.x, Math.floor(f.y - 0.001), f.z);
      if (T_SOLID[below] || f.y < 1) {
        const ty = Math.floor(f.y - 0.001) + 1;
        world.setBlock(f.x, ty, f.z, f.id);
        this._removeObj(f); this.falling.splice(i, 1); continue;
      }
      for (const o of [f.mesh, f.shadow]) { o.position.set(f.x + 0.5, f.y + 0.5, f.z + 0.5); o.updateMatrixWorld(); }
    }
    this.updateDebris(dt, world);
  },
  spawnDrop(key, n, pos, vel, delay = 0.45, dur) {
    if (!ITEMS[key]) return;
    const [m, s] = this._pair(itemGeometry(key));
    const sc = ITEMS[key].type === 'tool' ? 0.62 : 0.3;
    m.scale.setScalar(sc); s.scale.setScalar(sc);
    Pipeline.scenes.gbuf.add(m); Pipeline.scenes.shadow.add(s);
    this.drops.push({ key, n, dur, pos: pos.clone(), vel: vel || V3((Math.random() - 0.5) * 1.6, 2.6, (Math.random() - 0.5) * 1.6), age: 0, delay, phase: Math.random() * 6, mesh: m, shadow: s });
    if (this.drops.length > 120) { this._removeObj(this.drops[0]); this.drops.shift(); }
  },
  spawnFalling(x, y, z, id) {
    const key = BLOCKS[id].key;
    const [m, s] = this._pair(itemGeometry(key));
    m.scale.setScalar(0.995); s.scale.setScalar(0.995);
    Pipeline.scenes.gbuf.add(m); Pipeline.scenes.shadow.add(s);
    this.falling.push({ x, y, z, id, vy: 0, mesh: m, shadow: s });
  },
  // chips of the broken block's own material
  burst(world, pos, id, count, spread = 1, normal = null) {
    const def = BLOCKS[id];
    const layer = def.layers[2];
    const tint = def.tint === 1 ? [0.45, 0.55, 0.3] : def.tint === 2 ? [0.36, 0.48, 0.22] : [1, 1, 1];
    const leafy = T_KIND[id] === KIND.leaves || T_KIND[id] === KIND.cross;
    const l = world.getLight(Math.floor(pos.x + (normal ? normal.x * 0.6 : 0)), pos.y + (normal ? normal.y * 0.6 : 0.6), Math.floor(pos.z + (normal ? normal.z * 0.6 : 0)));
    for (let i = 0; i < count; i++) {
      const p = V3(pos.x + (Math.random() - 0.5) * 0.7 * spread, pos.y + (Math.random() - 0.5) * 0.7 * spread, pos.z + (Math.random() - 0.5) * 0.7 * spread);
      const v = V3((Math.random() - 0.5) * 3.2, Math.random() * 3.4 + 0.4, (Math.random() - 0.5) * 3.2);
      if (normal) v.addScaledVector(normal, 1.6);
      const soil = id === B.grass || id === B.forest_floor || id === B.snowy_grass;
      this.debris.push({ p, v, r: V3(Math.random() * 6, Math.random() * 6, Math.random() * 6), w: V3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14), s: (leafy ? 0.035 : 0.045) + Math.random() * Math.random() * 0.1, life: 1.8 + Math.random() * 1.8, age: 0, layer: soil && i % 3 ? def.layers[1] : leafy ? (id === B.tall_grass ? LAYER.grass_top : layer) : layer, tint: soil && i % 3 ? [1, 1, 1] : tint, light: l.slice(), leafy });
    }
    while (this.debris.length > this.maxDebris) this.debris.shift();
  },
  updateDebris(dt, world) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = V3();
    let n = 0;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.age += dt;
      if (d.age > d.life) { this.debris.splice(i, 1); continue; }
      d.v.y -= (d.leafy ? 5 : 17) * dt;
      if (d.leafy) d.v.multiplyScalar(1 - dt * 1.8);
      const half = d.s * 0.4;
      for (const ax of ['x', 'y', 'z']) {
        const next = d.p[ax] + d.v[ax] * dt;
        const probe = d.p.clone(); probe[ax] = next + Math.sign(d.v[ax]) * half;
        if (T_SOLID[world.getId(Math.floor(probe.x), Math.floor(probe.y), Math.floor(probe.z))]) {
          d.v[ax] *= -0.34;
          if (ax === 'y') { d.v.x *= 0.72; d.v.z *= 0.72; d.w.multiplyScalar(0.6); if (Math.abs(d.v.y) < 0.5) { d.v.y = 0; d.w.multiplyScalar(0.3); } }
        } else d.p[ax] = next;
      }
      d.r.addScaledVector(d.w, dt);
    }
    for (const d of this.debris) {
      if (n >= this.maxDebris) break;
      const fade = Math.min(1, (d.life - d.age) / 0.5);
      e.set(d.r.x, d.r.y, d.r.z); q.setFromEuler(e);
      m.compose(d.p, q, s.setScalar(d.s * fade));
      this.debrisMesh.setMatrixAt(n, m);
      this.iData.setXYZW(n, d.layer, d.tint[0], d.tint[1], d.tint[2]);
      this.iLight.setXYZW(n, d.light[0], d.light[1], d.light[2], d.light[3]);
      n++;
    }
    this.debrisMesh.count = n; this.debrisShadow.count = n;
    this.debrisMesh.instanceMatrix.needsUpdate = true; this.iData.needsUpdate = true; this.iLight.needsUpdate = true;
  },
};
