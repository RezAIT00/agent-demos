// Where did the hero crystal seal a hollow? Interior cells that froze later than
// everything in the ring around them. Writes an overlay map for inspection.
const { makeWedge, growCrystal } = require('./sim.js');
const { HERO_TIMELINE, HERO_STEPS, timelineEnv } = require('./src/weather.js');
const { writePNG, drawCrystal } = require('./png.js');
const R = 440, W = makeWedge(R);
const res = growCrystal(R, timelineEnv(HERO_TIMELINE, HERO_STEPS), { maxSteps: 200000, margin: 70 });
const { N } = res, att = res.attachStep;
const ring = (k, depth) => {
  let front = [k]; const seen = new Set(front);
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const c of front) for (let n = 0; n < 6; n++) { const m = W.nb[c * 6 + n]; if (!seen.has(m)) { seen.add(m); if (m < N) next.push(m); else return null; } }
    front = next;
  }
  return front;
};
const cand = [];
for (let k = 1; k < N; k++) {
  if (att[k] < 0 || res.I[k] + res.J[k] < 10) continue;
  const r3 = ring(k, 4);
  if (!r3 || r3.some((m) => att[m] < 0)) continue;          // interior only
  const around = r3.map((m) => att[m]).sort((a, b) => a - b);
  const late = att[k] - around[Math.floor(around.length * 0.7)];
  if (late > 60) cand.push({ k, late });
}
cand.sort((a, b) => b.late - a.late);
const picked = [];
for (const c of cand) {
  const x = res.I[c.k] + res.J[c.k] / 2, y = res.J[c.k] * Math.sqrt(3) / 2;
  if (picked.some((p) => Math.hypot(p.x - x, p.y - y) < 13)) continue;
  picked.push({ x, y, late: Math.round(c.late), dist: res.I[c.k] + res.J[c.k], step: att[c.k] });
  if (picked.length >= 60) break;
}
console.log('late-closing interior cells', cand.length, 'separated sites', picked.length);
console.log(picked.slice(0, 40).map((p) => `${p.dist}:${p.late}`).join(' '));
const T = 1100, img = new Uint8Array(T * T * 3), viewR = res.radius * 1.03;
drawCrystal(res, W, img, T, 0, 0, T, 1e9, viewR);
for (const p of picked) for (let r = 0; r < 6; r++) for (let m = 0; m < 2; m++) {
  const yy = m ? -p.y : p.y, th = r * Math.PI / 3;
  const X = p.x * Math.cos(th) - yy * Math.sin(th), Y = p.x * Math.sin(th) + yy * Math.cos(th);
  const px = Math.round((X / viewR + 1) * T / 2), py = Math.round((Y / viewR + 1) * T / 2);
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (a * a + b * b <= 5) img.set([255, 60, 40], ((py + a) * T + px + b) * 3);
}
writePNG(__dirname + '/hollows.png', T, T, img);
