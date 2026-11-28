const { makeWedge, growCrystal } = require('./sim.js');
const { writePNG, drawCrystal } = require('./png.js');
const R = 200;
const base = { alpha: 0.08, theta: 0.025, kappa: 0.003, mu: 0.07, gamma: 0.00005 };
const sets = [];
for (const rho of [0.38, 0.45, 0.55, 0.7]) for (const beta of [1.3, 1.8, 2.4, 3.0]) sets.push({ ...base, rho, beta });
const T = 340, cols = 4;
const img = new Uint8Array(T * cols * T * 4 * 3);
const W = makeWedge(R);
sets.forEach((p, n) => {
  const t0 = Date.now();
  const res = growCrystal(R, () => p, { maxSteps: 40000, margin: 60 });
  console.log(n, 'rho', p.rho, 'beta', p.beta, 'steps', res.steps, 'radius', res.radius, (Date.now() - t0) + 'ms');
  drawCrystal(res, W, img, T * cols, (n % cols) * T, Math.floor(n / cols) * T, T, 1e9, R * 1.02);
});
writePNG(__dirname + '/explore1.png', T * cols, T * 4, img);
