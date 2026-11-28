const { makeWedge, growCrystal } = require('./sim.js');
const { writePNG, drawCrystal } = require('./png.js');
const R = 440;
const base = { alpha: 0.08, theta: 0.025, kappa: 0.003, mu: 0.07, gamma: 0.00005 };
const variants = {
  A: [[22, 0.62, 2.2], [27, 0.46, 2.6, 2500], [46, 0.66, 2.1], [51, 0.46, 2.6, 2500], [68, 0.66, 2.15], [165, 0.48, 1.45], [215, 0.75, 1.3], [245, 0.40, 1.8, 7000], [310, 0.64, 1.3], [400, 0.75, 1.9, 14000], [425, 0.5, 2.6, 6000]],
  B: [[30, 0.58, 2.2], [36, 0.80, 1.9, 1500], [56, 0.55, 2.35], [62, 0.82, 1.9, 1500], [72, 0.56, 2.2], [168, 0.49, 1.45], [216, 0.75, 1.3], [246, 0.40, 1.8, 7000], [312, 0.64, 1.3], [398, 0.78, 1.88, 14000], [424, 0.5, 2.6, 6000]],
};
const T = 900;
const names = Object.keys(variants);
const img = new Uint8Array(T * 2 * T * 3);
const W = makeWedge(R);
names.forEach((nm, col) => {
  const stages = variants[nm];
  let si = 0, stageStart = 0;
  const marks = [];
  const env = (step, radius) => {
    const s = stages[si];
    if (radius >= s[0] || step - stageStart >= (s[3] || 1e9)) {
      marks.push([step, radius]);
      si++; stageStart = step;
      if (si >= stages.length) return { done: true };
    }
    const st = stages[si], prev = stages[Math.max(0, si - 1)];
    const w = Math.min(1, (step - stageStart) / 120);
    return { ...base, rho: prev[1] + (st[1] - prev[1]) * w, beta: prev[2] + (st[2] - prev[2]) * w };
  };
  const t0 = Date.now();
  const res = growCrystal(R, env, { maxSteps: 150000, margin: 70 });
  console.log(nm, res.steps, res.radius, Date.now() - t0, JSON.stringify(marks));
  let lo = 1e9, hi = -1e9, n = 0;
  for (let k = 0; k < res.N; k++) if (res.attachStep[k] >= 0) { lo = Math.min(lo, res.attachMass[k]); hi = Math.max(hi, res.attachMass[k]); n++; }
  console.log('cells', n, 'mass', lo, hi);
  drawCrystal(res, W, img, T * 2, col * T, 0, T, 1e9, res.radius * 1.03);
});
writePNG(__dirname + '/explore3.png', T * 2, T, img);
