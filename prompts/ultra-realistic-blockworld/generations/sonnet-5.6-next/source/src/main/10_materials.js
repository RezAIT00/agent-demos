// ================================================================ material bake: CPU synthesis in workers -> GPU texture arrays
const Materials = {
  avg: [], avgLinear: [], texSize: 0,
  async bake(pool, size, onProgress) {
    const n = LAYER_COUNT, bytes = size * size * 4;
    const albedo = new Uint8Array(bytes * n), normal = new Uint8Array(bytes * n), extra = new Uint8Array(bytes * n);
    let done = 0;
    const jobs = [];
    this.cover = new Array(n).fill(0);
    for (let i = 0; i < n; i++) jobs.push(pool.run({ type: 'tex', index: i, size }, i).then((r) => {
      albedo.set(r.albedo, bytes * i); normal.set(r.normal, bytes * i); extra.set(r.extra, bytes * i);
      this.avg[i] = r.avg; this.cover[i] = r.tintCover;
      done++; onProgress(done / (n + 1), LAYER_DEFS[i][0]);
    }));
    const water = pool.run({ type: 'water', size: Math.min(size, 512) }, 0);
    await Promise.all(jobs);
    const w = await water;
    this.texSize = size;
    const aniso = Math.min(Q.name === 'low' ? 4 : 8, renderer.capabilities.getMaxAnisotropy());
    const makeArr = (data, srgb) => {
      const t = new THREE.DataArrayTexture(data, size, size, n);
      t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true; t.anisotropy = aniso; t.needsUpdate = true;
      return t;
    };
    if (U.uAlbedoArr.value) { U.uAlbedoArr.value.dispose(); U.uNormalArr.value.dispose(); U.uExtraArr.value.dispose(); }
    U.uAlbedoArr.value = makeArr(albedo, true);
    U.uNormalArr.value = makeArr(normal, false);
    U.uExtraArr.value = makeArr(extra, false);
    const make2D = (data, s) => {
      const t = new THREE.DataTexture(data, s, s, THREE.RGBAFormat, THREE.UnsignedByteType);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
      return t;
    };
    const ws = Math.round(Math.sqrt(w.normals.length / 4));
    U.uWaterNormals.value = make2D(w.normals, ws);
    U.uNoiseTex.value = make2D(w.noise, ws);
    this.buildParams();
    this.avgLinear = this.avg.map((c) => c.map((v) => Math.pow(v / 255, 2.2)));
    onProgress(1, 'ready');
  },
  buildParams() {
    const n = LAYER_COUNT, rows = 3, d = new Float32Array(n * rows * 4);
    const emis = { lava: 9, lamp: 7, azurite_ore: 2.4, ember_ore: 3.2, glow_cap: 3.4, crystal_azure: 3.6, crystal_amber: 3.2, charwood: 9, furnace_front: 10, mushroom_stem: 0.9 };
    const moss = { stone: 0.8, limestone: 0.45, slate: 0.35, cobble: 1.0, stone_bricks: 0.75, basalt: 0.3 };
    const nstr = { glass: 0.5, snow: 0.75, snow_side: 0.8, lava: 1, sand: 0.9, red_sand: 0.9 };
    const sparkle = { snow: 1, sand: 0.55, red_sand: 0.4, packed_ice: 0.5, snow_side: 0.8 };
    for (let i = 0; i < n; i++) {
      const def = LAYER_DEFS[i], name = def[0];
      d.set([def[1], def[2], def[3], def[4]], i * 4);
      d.set([def[5], def[6], emis[name] || 0, nstr[name] !== undefined ? nstr[name] : 1], (n + i) * 4);
      d.set([moss[name] || 0, sparkle[name] || 0, 0, 0], (2 * n + i) * 4);
    }
    const t = new THREE.DataTexture(d, n, rows, THREE.RGBAFormat, THREE.FloatType);
    t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
    U.uLayerParams.value = t;
  },
};
