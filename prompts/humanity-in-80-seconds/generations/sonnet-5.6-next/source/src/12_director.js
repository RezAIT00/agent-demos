// Scene list, transitions and the "sky gearbox" (star trails tied to the rate).
const SCENES = [];
function defineScene(name, at, trans, draw) { SCENES.push({ name, at, trans, draw }); }

// How fast the sky runs: 1 at 25,000 years/second, 0 at 1 year/second.
const SKY = (() => {
  const HZ = 240;
  const speed = new Float64Array(TL.DURATION * HZ + 2);
  for (let i = 0; i < speed.length; i++) {
    const t = i / HZ;
    let s = 0;
    for (let k = -6; k <= 6; k++) {       // ease each gear change over ~0.4 s
      const r = TL.rateAt(clamp(t + k * 0.033, 0, 79.999));
      s += Math.log10(r) / Math.log10(25000);
    }
    speed[i] = s / 13;
  }
  const phase = new Float64Array(speed.length);
  for (let i = 1; i < speed.length; i++) phase[i] = phase[i - 1] + 0.40 * Math.pow(speed[i - 1], 2.3) / HZ;
  const at = (arr, t) => {
    const x = clamp(t, 0, TL.DURATION) * HZ, i = Math.floor(x);
    return lerp(arr[i], arr[Math.min(arr.length - 1, i + 1)], x - i);
  };
  const speedAt = (t) => at(speed, t);
  const phaseAt = (t) => at(phase, t);

  const STARS = (() => {
    const r = rng(77), list = [];
    for (let i = 0; i < 2600; i++) {
      const m = Math.pow(r(), 3.2);       // few bright, many faint
      list.push({
        rad: 90 + Math.sqrt(r()) * 2350, ang: r() * TAU,
        size: 0.55 + m * 2.2, a: 0.20 + m * 0.80, hue: r(), tw: r() * TAU,
      });
    }
    return list;
  })();

  // Stars wheel around a pole; trail length shows the current rate.
  function stars(ctx, t, o = {}) {
    const { alpha = 1, pole = [1500, -260], horizon = 1080, dx = 0, dy = 0, trailK = 1, density = 1 } = o;
    if (alpha <= 0.003) return;
    const sp = speedAt(t), ph = phaseAt(t);
    const len = 0.30 * Math.pow(sp, 2.5) * trailK;
    const cols = ['#bcd0ff', '#e8eeff', '#fff4e0', '#ffd9b0'];
    const bins = new Map();
    const n = Math.floor(STARS.length * density);
    for (let i = 0; i < n; i++) {
      const s = STARS[i];
      const a = s.ang + ph;
      const x = pole[0] + dx + Math.cos(a) * s.rad, y = pole[1] + dy + Math.sin(a) * s.rad;
      const reach = s.rad * len + 8;
      if (x < -reach || x > W + reach || y < -reach || y > Math.min(H, horizon) + reach) continue;
      if (y > horizon + 4 && len < 0.002) continue;
      const fade = clamp((horizon - y) / 150, 0, 1);
      if (fade <= 0.02) continue;
      const tw = 0.86 + 0.14 * Math.sin(t * 2.2 + s.tw * 7);
      const al = s.a * fade * tw * (len > 0.02 ? 0.78 : 1);
      const key = `${Math.min(3, s.hue * 4 | 0)}|${Math.ceil(al * 6)}|${Math.round(s.size * 2.4)}`;
      let p = bins.get(key);
      if (!p) bins.set(key, p = new Path2D());
      p.moveTo(pole[0] + dx + Math.cos(a - len) * s.rad, pole[1] + dy + Math.sin(a - len) * s.rad);
      p.arc(pole[0] + dx, pole[1] + dy, s.rad, a - len, a + 0.0001 + 0.35 / s.rad);
    }
    ctx.save();
    ctx.lineCap = 'round';
    for (const [key, p] of bins) {
      const [h, ab, sz] = key.split('|').map(Number);
      ctx.globalAlpha = clamp(ab / 6 * alpha, 0, 1);
      ctx.strokeStyle = cols[h];
      ctx.lineWidth = sz / 2.4;
      ctx.stroke(p);
    }
    ctx.restore();
  }
  return { speedAt, phaseAt, stars };
})();

function newEnv() {
  return {
    bg: 'sky',
    sky: { top: '#02030a', mid: '#070b1c', low: '#141a38', horizon: 760, midAt: 0.58 },
    lights: [], flames: [], rim: 1.0, skyRim: '#7088c8', skyRimAmt: 0.22,
    haze: { color: '#141a38', amt: 0 }, glowGain: 1,
    proj: { amt: 0, sweep: 4000, ghost: 0, solid: null },
    globe: null, rock: null, hands: null,
    // post settings (blended across transitions)
    bloom: 0.55, thresh: 0.66, vig: 0.30, exposure: 1,
  };
}

const DIR = (() => {
  function renderScene(i, t, slot) {
    const sc = SCENES[i];
    GFX.clearLayers();
    const env = newEnv();
    const L = GFX.layers;
    for (const n of ['back', 'far', 'near', 'glow']) L[n].save();
    sc.draw({ t, u: t - sc.at, env, back: L.back, far: L.far, near: L.near, glow: L.glow });
    for (const n of ['back', 'far', 'near', 'glow']) L[n].restore();
    return { env, fb: GFX.composeScene(env, slot, t) };
  }

  function plan(t) {
    let i = 0;
    while (i + 1 < SCENES.length && t >= SCENES[i + 1].at) i++;
    for (const j of [i + 1, i]) {
      const s = SCENES[j];
      if (!s || j === 0 || !s.trans || s.trans.dur <= 0) continue;
      const a = s.at - s.trans.dur * (s.trans.lead ?? 0.5);
      const b = a + s.trans.dur;
      if (t >= a && t < b) return { from: j - 1, to: j, p: (t - a) / s.trans.dur, trans: s.trans };
    }
    return { from: i, to: -1 };
  }

  // renders the picture (without HUD) and returns the frame buffer + post settings
  function render(t) {
    const pl = plan(t);
    const A = renderScene(pl.from, t, 0);
    if (pl.to < 0) return { fb: A.fb, post: A.env };
    const B = renderScene(pl.to, t, 1);
    const fb = GFX.transition(pl.trans.kind, pl.p, pl.trans.center || [960, 640], pl.trans.center2);
    const k = smooth(pl.p);
    const post = {};
    for (const n of ['bloom', 'thresh', 'vig', 'exposure']) post[n] = lerp(A.env[n], B.env[n], k);
    return { fb, post };
  }
  return { render, plan };
})();
