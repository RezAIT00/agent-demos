// Cue sheet for the film, computed by running the timing code that is inside the
// delivered snowflake.html (growth lattice, growth clock, director). Nothing
// here is a hand-typed time: every cue is the first (or peak) VIDEO FRAME on
// which the corresponding thing is on screen.
//   node cues.js   ->  cues.json
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function main() {
  const THREE = await import('three');
  const htmlPath = path.join(__dirname, '..', 'snowflake.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const between = (a, b) => {
    const i = html.indexOf(a); const j = html.indexOf(b, i + a.length);
    if (i < 0 || j < 0) throw new Error('section not found: ' + a);
    return html.slice(i, j);
  };
  const section = (name) => '// ---------------------------------------------------------------- ' + name;
  const simSrc = between('<script type="text/js-sim" id="sim-source">', '</script>').replace(/^<script[^>]*>/, '');
  const SIM = new Function(simSrc + '\nreturn {makeWedge, growCrystal, HERO_TIMELINE, HERO_STEPS, timelineEnv};')();
  const utilSrc = between(section('utilities'), section('growth'));
  const hollowSrc = between('function findSealedHollows(', '// Trapped air: clusters');
  const directorSrc = between(section('director'), section('main'));
  const mittenSrc = between(section('the mitten'), 'const WOOL_LIGHT');
  const film = new Function('THREE', utilSrc + '\n' + hollowSrc + '\n' + mittenSrc + '\n' + directorSrc +
    '\nreturn {makeGrowthClock, makeDirector, findSealedHollows, mittenY, mittenSD, HERO_RADIUS_MM, FILM};')(THREE);

  const hero = SIM.growCrystal(440, SIM.timelineEnv(SIM.HERO_TIMELINE, SIM.HERO_STEPS), { maxSteps: 200000, margin: 70 });
  const wedge = SIM.makeWedge(440);
  const clock = film.makeGrowthClock(hero);
  const cellMM = film.HERO_RADIUS_MM / hero.radius;
  // resting height only affects stereo placement by a hair, never any cue time
  const restPos = new THREE.Vector3(0, 0.75, 0);
  const director = film.makeDirector(clock, cellMM, restPos);

  const FPS = 30, N = Math.round(film.FILM * FPS);
  const lerp = (a, b, u) => a + (b - a) * u;
  const st = Array.from({ length: N }, (_, f) => director.state(f / FPS));
  const first = (pred, from = 0) => { for (let f = from; f < N; f++) if (pred(st[f], f)) return f; throw new Error('cue never happens: ' + pred); };
  const argmax = (get, lo = 0, hi = N - 1) => { let best = lo; for (let f = Math.max(0, lo); f <= Math.min(N - 1, hi); f++) if (get(st[f], f) > get(st[best], best)) best = f; return best; };

  const cues = [];
  const add = (id, frame, label, sound, extra) => cues.push(Object.assign({ id, frame, t: +(frame / FPS).toFixed(4), label, sound }, extra || {}));

  add('open', 0, 'first frame: grain already tumbling, vapour streaming', 'cloud wind, vapour whisper, pad (D open fifth)');
  // visible glints on the grain: local maxima of the shader's glint drive
  for (let f = 1; f < 40; f++) {
    if (st[f].grainGlint > st[f - 1].grainGlint && st[f].grainGlint >= st[f + 1].grainGlint && st[f].grainGlint > 0.9)
      add('glint', f, 'the dust grain flashes', 'tiny mineral tink', { strength: +st[f].grainGlint.toFixed(2) });
  }
  add('condense', first((s) => s.dropOpacity > 0), 'droplet starts to condense on the grain', 'watery swell with droplet plips');
  const frostA = first((s) => s.frost > 0 && s.front > -1.2499);
  const frostB = first((s) => s.front >= 1.2499, frostA);
  add('freeze', frostA, 'freezing front starts across the droplet', 'ice crackle, panning with the front', { endFrame: frostB });
  add('facet', first((s) => s.morph > 0), 'facets begin to form', 'rising glass shing');
  add('flash', argmax((s) => s.flash), 'facet flash: the hexagonal prism', 'bright glass chord and sparkle burst');
  add('flatten', first((s) => s.prismAspect < 0.619), 'prism widens into a plate', 'soft falling glass glide');
  add('lattice', first((s) => s.crystalOpacity > 0), 'lattice-grown plate fades in', 'faint shimmer');

  // weather layers, on the frame where the displayed sim step enters each one
  const ids = ['plate', 'rib1', 'plateB', 'rib2', 'plateC', 'arms', 'burst', 'dry', 'updraught', 'sector', 'facets'];
  const sounds = {
    rib1: 'single glass bell (first rib)', rib2: 'second glass bell, a step higher',
    arms: 'six-note celesta arpeggio, one note per arm', burst: 'quick high glittering arpeggio (side branches)',
    dry: 'hollow, dry two-note chime (waist plates)', updraught: 'second arpeggio in a new mode with shimmer',
    sector: 'broad rolled glass chord (sector plates)', facets: 'high crystal polish bells',
  };
  SIM.HERO_TIMELINE.forEach((layer, i) => {
    const id = ids[i];
    if (!sounds[id]) return;
    add(id, first((s) => s.S >= layer[0]), `layer: ${layer[3]} (${layer[1]} °C, ${layer[2]} %)`, sounds[id], { step: layer[0] });
  });
  add('grown', first((s) => s.S >= SIM.HERO_STEPS - 40), 'growth complete', 'resolving celesta chord');

  const hollows = film.findSealedHollows(hero, wedge);
  const seals = hollows.map((h) => first((s) => s.S >= h.step)).sort((a, b) => a - b);
  [...new Set(seals)].forEach((f) => add('bubble', f, 'a hollow seals: air bubbles appear', 'tiny air "blip"', { count: seals.filter((x) => x === f).length }));

  for (const bt of [4.95, 7.0, 8.55, 9.55, 11.15, 13.85]) {
    add('band', argmax((s) => s.bandAmt, Math.floor((bt - 0.5) * FPS), Math.ceil((bt + 0.5) * FPS)), 'a layer boundary sweeps up through the mist', 'wind whoosh peaking here');
  }
  for (const at of [5.75, 7.65, 9.55, 10.85, 12.15, 13.45, 14.75, 16.25]) {
    add('sheen', argmax((s) => s.sweep, Math.floor((at - 0.64) * FPS), Math.ceil((at + 0.64) * FPS)), 'light slides across the faces (peak)', 'faint airy shimmer peaking here');
  }

  add('exit', first((s) => s.reveal > 0), 'falling out of the cloud base', 'cloud wind opens and falls away; valley hush and muffled snowfall fade in');
  add('valley', first((s) => s.reveal >= 0.999), 'valley fully clear', 'muffled snowfall, calm; felt-piano melody');

  // first frame on which any part of the mitten is inside the picture
  const outline = [];
  for (let x = -94; x <= 58; x += 2) for (let z = -100; z <= 120; z += 2) if (Math.abs(film.mittenSD(x, z)) < 2) outline.push(new THREE.Vector3(x, film.mittenY(x, z), z));
  const cam = new THREE.PerspectiveCamera(20, 1, 0.1, 100000);
  const aim = (s) => { cam.near = s.near; cam.far = s.far + 5000; cam.position.copy(s.camPos); cam.quaternion.copy(s.camQuat); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true); };
  add('mitten', first((s) => { if (!s.mittenOn) return false; aim(s); return outline.some((p) => { const q = p.clone().project(cam); return Math.abs(q.x) < 1 && Math.abs(q.y) < 1 && q.z < 1; }); }),
    'the mitten rises into the picture', 'soft descending air; the world grows more muffled');

  // touchdown: the first frame that shows the landing wobble (director: t > 18.82)
  const touch = first((s) => s.t > 18.82);
  add('touchdown', touch, `the flake touches the wool (${st[touch].dist.toFixed(2)} mm of travel left, wobble starts)`, 'tiny soft tick with a faint wool thud');

  // the lamp circling the arms: for each pass over an arm axis, the nearest frame
  const arms = [];
  const angleAt = (t) => director.state(t).armAngle;
  const a0 = angleAt(19.0), a1 = angleAt(19.9);
  for (let k = Math.ceil(a0 / (Math.PI / 3)); k * Math.PI / 3 <= a1; k++) {
    const want = k * Math.PI / 3;
    let lo = 19.0, hi = 19.9;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (angleAt(m) < want) lo = m; else hi = m; }
    const mid = Math.round(lo * FPS);
    // what the ice shader adds to this arm: armAmt * mix(facing^14, 0.26, armRest)
    const shine = (g) => st[g].armAmt * lerp(Math.pow(Math.max(Math.cos(want - st[g].armAngle), 0), 14), 0.26, st[g].armRest);
    let f = mid;
    for (let g = Math.max(0, mid - 3); g <= Math.min(N - 1, mid + 3); g++) if (shine(g) > shine(f)) f = g;
    if (st[f].armAmt < 0.4) continue;
    // where that arm tip is on screen, for stereo placement
    aim(st[f]);
    const tip = new THREE.Vector3(Math.cos(want), Math.sin(want), 0).multiplyScalar(film.HERO_RADIUS_MM).applyQuaternion(st[f].quat).add(st[f].flakePos);
    const q = tip.project(cam);
    arms.push({ f, arm: ((k % 6) + 6) % 6, x: +q.x.toFixed(2), y: +q.y.toFixed(2), exact: +lo.toFixed(4) });
  }
  arms.forEach((a, i) => add('arm', a.f, `lamp flares arm ${a.arm + 1}`, `celesta note ${i + 1} of ${arms.length}, panned to the arm`, { arm: a.arm, pan: Math.max(-1, Math.min(1, a.x)), exactT: a.exact, index: i }));
  add('settle', first((s) => s.armRest > 0), 'lamp settles: all six arms rest lit', 'soft final D add9 chord');

  cues.sort((a, b) => a.frame - b.frame);

  // ---- per-frame control tracks (what the beds and the growth shimmer follow)
  const mult = (i, j) => (i === 0 ? 1 : j === 0 || j === i ? 6 : 12);
  const grown = { cells: [], radius: [], total: 0 };
  const order = [];
  for (let k = 0; k < hero.N; k++) if (hero.attachStep[k] >= 0) order.push([hero.attachStep[k], hero.I[k] + hero.J[k], mult(hero.I[k], hero.J[k])]);
  order.sort((a, b) => a[0] - b[0]);
  let p = 0;
  for (let f = 0; f < N; f++) {
    let cells = 0, rsum = 0;
    while (p < order.length && order[p][0] <= st[f].S) { cells += order[p][2]; rsum += order[p][1] * order[p][2]; p++; }
    grown.cells.push(cells);
    grown.radius.push(cells ? +(rsum / cells / hero.radius).toFixed(4) : 0);
    grown.total += cells;
  }
  const speed = (f) => (director.fall(Math.min(20, (f + 0.5) / FPS)) - director.fall(Math.max(0, (f - 0.5) / FPS))) * FPS;
  const r4 = (v) => +v.toFixed(4);
  // where the six arm tips sit on screen (pixels at 1080) during the finale, for checking against the video
  const armTips = {};
  for (let f = 560; f < N; f++) {
    aim(st[f]);
    armTips[f] = [0, 1, 2, 3, 4, 5].map((k) => {
      const ends = [0.45, 0.92].map((reach) => {
        const q = new THREE.Vector3(Math.cos(k * Math.PI / 3), Math.sin(k * Math.PI / 3), 0)
          .multiplyScalar(film.HERO_RADIUS_MM * reach).applyQuaternion(st[f].quat).add(st[f].flakePos).project(cam);
        return [r4((q.x + 1) * 540), r4((1 - q.y) * 540)];
      });
      return ends;
    });
  }
  const tracks = {
    cells: grown.cells, cellRadius: grown.radius,
    fallSpeed: st.map((s, f) => r4(speed(f))), mist: st.map((s) => r4(s.density)), vapour: st.map((s) => r4(s.vapour)),
    band: st.map((s) => r4(s.bandAmt)), sheen: st.map((s) => r4(s.t < 17 ? s.sweep : 0)),
    reveal: st.map((s) => r4(s.reveal)), front: st.map((s) => r4(s.front)), frost: st.map((s) => r4(s.frost)),
    flakeTravelMM: st.map((s) => r4(s.dist)), crystalRadius: st.map((s) => r4(s.radiusCells / hero.radius)),
  };

  const out = {
    source: { file: 'snowflake.html', sha1: crypto.createHash('sha1').update(html).digest('hex') }, armTips,
    fps: FPS, frames: N, seconds: film.FILM, sampleRate: 48000, latticeCellsFrozen: grown.total, hollowSites: hollows.length, cues, tracks,
  };
  fs.writeFileSync(path.join(__dirname, 'cues.json'), JSON.stringify(out));
  for (const c of cues) console.log(String(c.frame).padStart(4), (c.frame / FPS).toFixed(3).padStart(7), c.id.padEnd(10), c.label);
  console.log('cues', cues.length, ' lattice cells', grown.total, ' html sha1', out.source.sha1.slice(0, 12));
}
main().catch((e) => { console.error(e); process.exit(1); });
