const { makeWedge, growCrystal } = require('./sim.js');
const { HERO_TIMELINE, HERO_STEPS, timelineEnv } = require('./src/weather.js');
const { writePNG, drawCrystal } = require('./png.js');
const R = 440;
const W = makeWedge(R);
const t0 = Date.now();
const res = growCrystal(R, timelineEnv(HERO_TIMELINE, +(process.argv[2] || HERO_STEPS)), { maxSteps: 200000, margin: 70 });
console.log('steps', res.steps, 'radius', res.radius, (Date.now() - t0) + 'ms');
const marks = HERO_TIMELINE.map((l) => l[0]).slice(1).concat([res.steps]);
console.log(marks.map((s) => s + ':' + res.radiusLog[Math.min(res.radiusLog.length - 1, Math.floor(s / 20) - 1)]).join('  '));

// final, big
const T = 1100;
let img = new Uint8Array(T * T * 3);
drawCrystal(res, W, img, T, 0, 0, T, 1e9, res.radius * 1.03);
writePNG(__dirname + '/hero_final.png', T, T, img);

// snapshots at the end of every layer
const S = 360, cols = 4;
img = new Uint8Array(S * cols * S * 3 * 3);
const pick = marks;
pick.forEach((m, n) => { if (n < 12) drawCrystal(res, W, img, S * cols, (n % cols) * S, Math.floor(n / cols) * S, S, m, res.radius * 1.03); });
writePNG(__dirname + '/hero_stages.png', S * cols, S * 3, img);

// attach-time map + pockets that closed late (candidate trapped air)
img = new Uint8Array(T * T * 3);
const att = res.attachStep;
let outside = new Uint8Array(res.N + 1);
const stack = [res.N];
outside[res.N] = 1;
// flood the never-frozen cells connected to the open air
for (let k = res.N - 1; k >= 0; k--) if (att[k] < 0 && res.I[k] + res.J[k] > res.radius) { outside[k] = 1; stack.push(k); }
while (stack.length) {
  const k = stack.pop(); if (k === res.N) continue;
  for (let n = 0; n < 6; n++) { const m = W.nb[k * 6 + n]; if (m < res.N && !outside[m] && att[m] < 0) { outside[m] = 1; stack.push(m); } }
}
let enclosed = 0, late = 0;
for (let k = 0; k < res.N; k++) if (att[k] < 0 && !outside[k]) enclosed++;
console.log('enclosed never-frozen wedge cells', enclosed);
module.exports = { res, W };
