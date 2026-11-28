const { makeWedge, growCrystal } = require('./sim.js');
const { writePNG, drawCrystal } = require('./png.js');
const R = 440;
const base = { alpha: 0.08, theta: 0.025, kappa: 0.003, mu: 0.07, gamma: 0.00005 };
const head = [[22, 0.62, 2.2], [27, 0.46, 2.6, 2500], [46, 0.66, 2.1], [51, 0.46, 2.6, 2500], [68, 0.66, 2.15], [165, 0.48, 1.45], [215, 0.75, 1.3], [245, 0.40, 1.8, 7000], [312, 0.66, 1.3]];
const tails = [
  [[398, 0.54, 1.68, 40000], [424, 0.46, 2.2, 6000]],
  [[398, 0.50, 1.58, 40000], [424, 0.44, 2.1, 6000]],
  [[398, 0.58, 1.75, 40000], [424, 0.47, 2.3, 6000]],
  [[345, 0.56, 1.66, 20000], [356, 0.74, 1.45, 3000], [398, 0.55, 1.75, 30000], [424, 0.46, 2.3, 6000]],
  [[350, 0.50, 1.55, 20000], [362, 0.72, 1.35, 3000], [400, 0.53, 1.7, 30000], [424, 0.45, 2.2, 6000]],
  [[398, 0.62, 1.82, 40000], [424, 0.48, 2.4, 6000]],
];
const T = 640, cols = 3;
const img = new Uint8Array(T * cols * T * 2 * 3);
const W = makeWedge(R);
tails.forEach((tail, v) => {
  const stages = head.concat(tail);
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
  const res = growCrystal(R, env, { maxSteps: 200000, margin: 70 });
  console.log(v, res.steps, res.radius, Date.now() - t0, JSON.stringify(marks));
  drawCrystal(res, W, img, T * cols, (v % cols) * T, Math.floor(v / cols) * T, T, 1e9, 430);
});
writePNG(__dirname + '/explore4.png', T * cols, T * 2, img);
