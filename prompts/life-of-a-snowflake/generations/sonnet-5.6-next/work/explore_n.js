const { makeWedge, growCrystal } = require('./sim.js');
const { neighbourHistory, layeredEnv } = require('./src/weather.js');
const { writePNG, drawCrystal } = require('./png.js');
const R = 170, W = makeWedge(R);
const cols = 8, rows = 8, T = 220;
const img = new Uint8Array(cols * T * rows * T * 3);
let total = 0;
const info = [];
for (let n = 0; n < cols * rows; n++) {
  const t0 = Date.now();
  const res = growCrystal(R, layeredEnv(neighbourHistory(n + 11), R), { maxSteps: 70000, margin: 50 });
  total += Date.now() - t0;
  info.push(`${n}:${res.radius}`);
  drawCrystal(res, W, img, cols * T, (n % cols) * T, Math.floor(n / cols) * T, T, 1e9, res.radius * 1.05);
}
console.log('total ms', total, info.join(' '));
writePNG(__dirname + '/neighbours.png', cols * T, rows * T, img);
