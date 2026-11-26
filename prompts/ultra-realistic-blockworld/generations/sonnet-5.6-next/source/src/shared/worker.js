// ---------------------------------------------------------------- worker entry (only executed inside Blob workers)
function workerMain(self) {
  let GEN = null;
  const collect = (obj, list) => {
    if (!obj) return;
    for (const k in obj) {
      const v = obj[k];
      if (v && v.buffer instanceof ArrayBuffer) list.push(v.buffer);
      else if (v && typeof v === 'object' && !Array.isArray(v)) collect(v, list);
    }
  };
  self.onmessage = (e) => {
    const m = e.data;
    try {
      if (m.type === 'init') { GEN = new WorldGen(m.seed, JSON.parse(m.features)); return; }
      let result, transfer = [];

      if (m.type === 'gen') {
        result = GEN.generate(m.cx, m.cz);
        transfer = [result.blocks.buffer, result.biomes.buffer];
      } else if (m.type === 'mesh') {
        result = meshChunk(GEN, m.cx, m.cz, m.nb, m.opts);
        collect(result, transfer);
      } else if (m.type === 'lod') {
        result = { mesh: meshLOD(GEN, m.tx, m.tz, m.size, m.cell, m.colors) };
        collect(result, transfer);
      } else if (m.type === 'heights') {
        const a = new Float32Array(m.n * (m.row1 - m.row0));
        const o = {};
        for (let j = m.row0; j < m.row1; j++) for (let i = 0; i < m.n; i++) a[(j - m.row0) * m.n + i] = GEN.column(Math.floor(m.x0 + (i + 0.5) * m.step), Math.floor(m.z0 + (j + 0.5) * m.step), o).h;
        result = { data: a };
        transfer = [a.buffer];
      } else if (m.type === 'tex') {
        result = generateLayer(m.index, m.size);
        transfer = [result.albedo.buffer, result.normal.buffer, result.extra.buffer];
      } else if (m.type === 'water') {
        result = generateWaterTextures(m.size);
        transfer = [result.normals.buffer, result.noise.buffer];
      }
      self.postMessage({ job: m.job, ok: true, result }, transfer);
    } catch (err) {
      self.postMessage({ job: m.job, ok: false, error: String(err && err.stack || err) });
    }
  };
}
