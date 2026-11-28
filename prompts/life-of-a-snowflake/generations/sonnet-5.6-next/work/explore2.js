const { makeWedge, growCrystal } = require('./sim.js');
const { writePNG, drawCrystal } = require('./png.js');
const R = 440;
const base = { alpha: 0.08, theta: 0.025, kappa: 0.003, mu: 0.07, gamma: 0.00005 };
// stage: [untilRadius, rho, beta, maxStepsInStage]
const variants = require(process.argv[2] ? './' + process.argv[2] : './variants.js');
const T = 440, cols = 6;
const img = new Uint8Array(T * cols * T * variants.length * 3);
const W = makeWedge(R);
variants.forEach((stages, row) => {
  const t0 = Date.now();
  let si = 0, stageStart = 0, cur = null;
  const marks = [];
  const env = (step, radius) => {
    const s = stages[si];
    if (radius >= s[0] || step - stageStart >= (s[3] || 1e9)) {
      marks.push([step, radius]);
      si++; stageStart = step;
      if (si >= stages.length) return { done: true };
      cur = null;
    }
    const st = stages[si];
    // ease the environment between layers
    const prev = stages[Math.max(0, si - 1)];
    const w = Math.min(1, (step - stageStart) / 120);
    return { ...base, rho: prev[1] + (st[1] - prev[1]) * w, beta: prev[2] + (st[2] - prev[2]) * w, ...(st[4] || {}) };
  };
  const res = growCrystal(R, env, { maxSteps: 150000, margin: 70 });
  console.log('row', row, 'steps', res.steps, 'radius', res.radius, (Date.now() - t0) + 'ms', JSON.stringify(marks));
  const n = marks.length;
  for (let k = 0; k < cols; k++) {
    const mi = k === cols - 1 ? -1 : Math.floor((k + 0.0001) * n / (cols - 1));
    const upto = mi < 0 ? 1e9 : marks[mi] ? marks[mi][0] : res.steps;
    drawCrystal(res, W, img, T * cols, k * T, row * T, T, upto, R * 1.0);
  }
});
writePNG(__dirname + '/explore2.png', T * cols, T * variants.length, img);
