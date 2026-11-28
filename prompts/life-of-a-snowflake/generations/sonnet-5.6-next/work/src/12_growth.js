// ---------------------------------------------------------------- growth
// The simulation source lives in <script id="sim-source"> so that exactly the
// same code runs on the main thread and inside Web Workers.
const SIM_SRC = document.getElementById('sim-source').textContent;
const SIM = new Function(SIM_SRC + '\nreturn {makeWedge, growCrystal, nakaya, HERO_TIMELINE, HERO_STEPS, timelineEnv, layeredEnv, neighbourHistory};')();

const WORKER_SRC = SIM_SRC + `
onmessage = (ev) => {
  const j = ev.data;
  const env = j.hero ? timelineEnv(HERO_TIMELINE, HERO_STEPS) : layeredEnv(j.layers, j.R);
  const res = growCrystal(j.R, env, { maxSteps: j.maxSteps, margin: j.margin,
    onProgress: j.hero ? (s) => postMessage({ id: j.id, progress: s }) : null });
  postMessage({ id: j.id, res }, [res.I.buffer, res.J.buffer, res.attachStep.buffer, res.attachMass.buffer, res.attachN.buffer, res.radiusLog.buffer]);
};`;

function runJobs(jobs, onStatus) {
  const results = new Array(jobs.length);
  const runLocal = (j) => {
    const env = j.hero ? SIM.timelineEnv(SIM.HERO_TIMELINE, SIM.HERO_STEPS) : SIM.layeredEnv(j.layers, j.R);
    return SIM.growCrystal(j.R, env, { maxSteps: j.maxSteps, margin: j.margin });
  };
  return new Promise((resolve) => {
    let next = 0, done = 0, workers = [];
    const finish = () => { workers.forEach((w) => w.terminate()); resolve(results); };
    const fallback = () => {
      workers.forEach((w) => w.terminate()); workers = [];
      jobs.forEach((j, k) => { if (!results[k]) results[k] = runLocal(j); });
      resolve(results);
    };
    try {
      const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
      const n = Math.max(2, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
      for (let w = 0; w < n; w++) {
        const worker = new Worker(url);
        const feed = () => { if (next < jobs.length) { const id = next++; worker.postMessage({ ...jobs[id], id }); } };
        worker.onmessage = (ev) => {
          if (ev.data.progress !== undefined) { onStatus && onStatus(done, jobs.length, ev.data.progress); return; }
          results[ev.data.id] = ev.data.res;
          done++; onStatus && onStatus(done, jobs.length);
          if (done === jobs.length) finish(); else feed();
        };
        worker.onerror = (e) => { console.warn('worker failed, growing on the main thread', e.message); fallback(); };
        workers.push(worker);
        feed();
      }
    } catch (e) {
      console.warn('no workers, growing on the main thread', e);
      fallback();
    }
  });
}

// Packs a wedge result into a lattice texture: texel (i,j) = wedge cell.
// r: step at which the cell froze (-1 never), g: ice mass, b: thin membrane flag.
function latticeTexture(res) {
  const w = res.R + 1, h = (res.R >> 1) + 1;
  const data = new Float32Array(w * h * 4);
  for (let t = 0; t < w * h; t++) data[4 * t] = -1;
  for (let k = 0; k < res.N; k++) {
    const o = (res.J[k] * w + res.I[k]) * 4;
    data[o] = res.attachStep[k];
    data[o + 1] = res.attachMass[k];
    data[o + 2] = res.attachStep[k] >= 0 && res.attachMass[k] < 0.5 ? 1 : 0;
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

// Sealed hollows: interior cells that froze later than most of the ice four cells
// around them. The lattice walled them off and filled them afterwards, which is
// where real crystals keep air. These become the larger bubbles.
function findSealedHollows(res, wedge) {
  const { N } = res, att = res.attachStep;
  const ringAt = (k, depth) => {
    let front = [k]; const seen = new Set(front);
    for (let d = 0; d < depth; d++) {
      const next = [];
      for (const c of front) for (let n = 0; n < 6; n++) {
        const m = wedge.nb[c * 6 + n];
        if (!seen.has(m)) { seen.add(m); if (m >= N) return null; next.push(m); }
      }
      front = next;
    }
    return front;
  };
  const cand = [];
  for (let k = 1; k < N; k++) {
    if (att[k] < 0 || res.I[k] + res.J[k] < 10) continue;
    const ring = ringAt(k, 4);
    if (!ring || ring.some((m) => att[m] < 0)) continue;
    const around = ring.map((m) => att[m]).sort((a, b) => a - b);
    const late = att[k] - around[Math.floor(around.length * 0.7)];
    if (late > 250) cand.push({ k, late });
  }
  cand.sort((a, b) => b.late - a.late);
  const out = [];
  for (const c of cand) {
    const x = res.I[c.k] + res.J[c.k] / 2, y = res.J[c.k] * Math.sqrt(3) / 2;
    if (out.some((p) => Math.hypot(p.x - x, p.y - y) < 13)) continue;
    // the longer it stayed open after being walled in, the larger the bubble
    const grade = clamp(Math.log10(c.late / 250) / Math.log10(60), 0, 1);
    // elongated along the arm near its axis, along the 60 degree side branch elsewhere
    out.push({ x, y, ang: y < 14 ? 0 : Math.PI / 3, major: 5.4 + 5.0 * grade, minor: 3.1 + 1.4 * grade, step: att[c.k], late: c.late, big: true, size: 99 });
    if (out.length >= 14) break;
  }
  return out;
}

// Trapped air: clusters of cells that closed pockets (froze with four or more
// frozen neighbours) or froze as thin membranes. Their positions come straight
// from the lattice history; every cluster is repeated by the D6 symmetry.
function findAirPockets(res, wedge) {
  const flag = new Uint8Array(res.N), seen = new Uint8Array(res.N);
  for (let k = 0; k < res.N; k++) {
    if (res.attachStep[k] < 0) continue;
    if (res.attachN[k] >= 4 || res.attachMass[k] < 0.45) flag[k] = 1;
  }
  const out = [];
  for (let k0 = 0; k0 < res.N; k0++) {
    if (!flag[k0] || seen[k0]) continue;
    const stack = [k0], cl = [];
    seen[k0] = 1;
    while (stack.length) {
      const k = stack.pop(); cl.push(k);
      for (let n = 0; n < 6; n++) {
        const m = wedge.nb[k * 6 + n];
        if (m < res.N && flag[m] && !seen[m]) { seen[m] = 1; stack.push(m); }
      }
    }
    if (cl.length < 3) continue;
    let mx = 0, my = 0, t = 0;
    const pts = cl.map((k) => {
      const i = res.I[k], j = res.J[k];
      const p = [i + j / 2, j * Math.sqrt(3) / 2]; // wedge cell -> cartesian
      mx += p[0]; my += p[1]; t = Math.max(t, res.attachStep[k]);
      return p;
    });
    mx /= pts.length; my /= pts.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of pts) { sxx += (p[0] - mx) ** 2; syy += (p[1] - my) ** 2; sxy += (p[0] - mx) * (p[1] - my); }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const tr = (sxx + syy) / pts.length;
    const det = Math.sqrt(Math.max(0, ((sxx - syy) / pts.length) ** 2 + (2 * sxy / pts.length) ** 2));
    const major = clamp(Math.sqrt((tr + det) / 2) * 1.3, 1.6, 7);
    const minor = clamp(Math.sqrt(Math.max(0, (tr - det) / 2)) * 1.1, 1.0, 2.4);
    out.push({ x: mx, y: my, ang, major, minor, step: t, size: cl.length });
  }
  out.sort((a, b) => b.size - a.size);
  return out.slice(0, 46);
}
