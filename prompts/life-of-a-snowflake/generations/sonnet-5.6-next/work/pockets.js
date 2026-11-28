const { makeWedge, growCrystal } = require('./sim.js');
const { HERO_TIMELINE, HERO_STEPS, timelineEnv } = require('./src/weather.js');
const { writePNG } = require('./png.js');
const R = 440, W = makeWedge(R);
const res = growCrystal(R, timelineEnv(HERO_TIMELINE, HERO_STEPS), { maxSteps: 200000, margin: 70 });
const hist = [0, 0, 0, 0, 0, 0, 0];
for (let k = 0; k < res.N; k++) if (res.attachStep[k] >= 0) hist[res.attachN[k]]++;
console.log('attach neighbour histogram', hist);
const T = 1100, img = new Uint8Array(T * T * 3), S3 = Math.sqrt(3), viewR = res.radius * 1.03;
let thin = 0, cnt = 0;
for (let k = 0; k < res.N; k++) if (res.attachStep[k] >= 0) { cnt++; if (res.attachMass[k] < 0.45) thin++; }
console.log('cells', cnt, 'thin (<0.45 mass)', thin);
for (let py = 0; py < T; py++) for (let px = 0; px < T; px++) {
  const x = (px + 0.5 - T / 2) / (T / 2) * viewR, y = (py + 0.5 - T / 2) / (T / 2) * viewR;
  let r = y * 2 / S3, q = x - r / 2, s = -q - r;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs; else rs = -rq - rr;
  const u = Math.abs(rq), v = Math.abs(rr), w = Math.abs(rs);
  const hi = Math.max(u, v, w), lo = Math.min(u, v, w), mid = u + v + w - hi - lo;
  let col = [8, 12, 22];
  if (hi <= R) {
    const k = W.key[mid * (R + 2) + lo];
    if (res.attachStep[k] >= 0) {
      const f = res.attachStep[k] / res.steps;
      col = [60 + 190 * f, 120 + 80 * Math.sin(f * 20), 255 - 200 * f];
      if (res.attachMass[k] < 0.45) col = [255, 40, 40];
      if (res.attachN[k] >= 5) col = [255, 255, 255];
    }
  }
  img.set(col, (py * T + px) * 3);
}
writePNG(__dirname + '/pockets.png', T, T, img);
