'use strict';
// ---------------------------------------------------------------------------
// painted backgrounds: cumulus skies (shader), nebulae (shader), city, rooftop
// ---------------------------------------------------------------------------
const FS_SKY = `
uniform vec3 uC0,uC1,uC2,uC3,uC4; uniform vec3 uPos;
uniform vec4 uPuff[220]; uniform float uNP;
uniform vec3 uDeep0,uShade0,uLit0,uHi0, uHaze;
uniform vec4 uSun; uniform vec3 uSunCol; uniform vec3 uL; uniform float uStars, uSeed, uWisp; uniform vec3 uWispCol;
vec3 grad(float y){
  if(y<uPos.x) return mix(uC0,uC1,smoothstep(0.,uPos.x,y));
  if(y<uPos.y) return mix(uC1,uC2,(y-uPos.x)/(uPos.y-uPos.x));
  if(y<uPos.z) return mix(uC2,uC3,(y-uPos.y)/(uPos.z-uPos.y));
  return mix(uC3,uC4,smoothstep(uPos.z,1.,y));
}
void main(){
  vec2 p = vec2(uv.x, 1.-uv.y) * uRes;         // pixel coords, y down
  vec2 q = p / uRes.y;
  float y = p.y/uRes.y;
  vec3 col = grad(y + (fbm3(q*vec2(1.5,5.)+uSeed)-.5)*.045);
  // brush grain in the open sky
  col *= 1. + (fbm(q*vec2(5.,22.)+uSeed*2.)-.5)*.07;
  // sun glow
  float sd = length((p - uSun.xy)/uRes.y);
  col += uSunCol * uSun.w * (exp(-sd*sd*18.)*.55 + exp(-sd*3.2)*.38);
  col = mix(col, uSunCol*1.15, smoothstep(uSun.z/uRes.y, uSun.z/uRes.y*.9, sd)*step(.5,uSun.z));
  // stars, thinning toward the horizon
  if(uStars>0.001){
    for(int k=0;k<2;k++){
      float cell = k==0 ? 26. : 64.;
      vec2 id = floor(p/cell); float r = h21(id+uSeed+float(k)*17.);
      if(r>.72){
        vec2 c = (id+.2+.6*vec2(h21(id+3.1),h21(id+7.7)))*cell;
        float d = length(p-c);
        float s = (k==0?1.1:1.9)*(.5+h21(id+9.));
        col += vec3(.85,.9,1.) * smoothstep(s,0.,d) * uStars * (1.-smoothstep(.25,.72,y)) * (.4+.6*h21(id+1.7));
      }
    }
  }
  // high wisps of cirrus
  if(uWisp>0.001){
    vec2 w = vec2(q.x*1.4 + q.y*1.1, q.y*7.5 - q.x*.7);
    float n = fbm(w + vec2(fbm(w*.7)*1.8, 0.) + uSeed);
    float a = smoothstep(.52,.82,n) * smoothstep(.0,.12,y) * (1.-smoothstep(.45,.8,y));
    col = mix(col, uWispCol, a*uWisp);
  }
  // three banks of cumulus, back to front
  vec2 wp = p + (vec2(fbm(p/110.+uSeed), fbm(p/110.+31.+uSeed))-.5)*54.
              + (vec2(fbm(p/34.+7.), fbm(p/34.+13.))-.5)*19.
              + (vec2(vn(p/11.), vn(p/11.+5.))-.5)*5.;
  for(int bank=0; bank<3; bank++){
    float alpha=0., hmax=0., wsum=0.; vec3 nsum=vec3(0.); float basey=0.; float topy=1e5;
    for(int i=0;i<220;i++){
      if(float(i)>=uNP) break;
      vec4 f = uPuff[i];
      int b = int(floor(f.w));
      if(b!=bank) continue;
      float base = fract(f.w)*2000.;
      vec2 d = (wp - f.xy);
      float L = length(d); float r = f.z;
      float a = smoothstep(r+2.5, r-2.5, L);
      // cumulus have flat bases
      a *= 1. - smoothstep(base-26., base+16., wp.y + (fbm3(p/70.)-.5)*44.);
      if(a<=0.) continue;
      alpha = max(alpha, a);
      float h = sqrt(max(r*r - L*L, 0.));
      float wgt = exp(h/13.);
      nsum += wgt * normalize(vec3(d/r, h/r+.05)); wsum += wgt;
      basey = base; topy = min(topy, f.y - r);
    }
    if(alpha<=0.) continue;
    vec3 n = normalize(nsum/max(wsum,1e-6));
    float lum = dot(vec3(n.x, n.y, n.z), normalize(uL));
    lum += (fbm(p/58.+float(bank)*9.)-.5)*.46 + (fbm(p/19.)-.5)*.16;
    float hb = clamp((basey - p.y)/max(basey-topy,1.), 0., 1.);
    lum += (hb-.5)*.38;
    vec3 c = mix(uDeep0, uShade0, smoothstep(-.20,-.10,lum));
    c = mix(c, mix(uShade0,uLit0,.45), smoothstep(.16,.21,lum));
    c = mix(c, uLit0, smoothstep(.36,.42,lum));
    c = mix(c, uHi0, smoothstep(.70,.78,lum));
    // warm bounce from the horizon on the flat base
    c = mix(c, uHaze, (1.-smoothstep(0.,.28,hb))*.42);
    float far = bank==0 ? .46 : bank==1 ? .20 : .0;
    c = mix(c, grad(y), far);
    col = mix(col, c, alpha*(bank==0?.93:1.));
  }
  // horizon haze
  col = mix(col, uHaze, smoothstep(.70,1.0,y)*.35);
  col += (h21(p+uSeed)-.5)/140.;
  O = vec4(col,1.);
}`;

// build a cumulonimbus out of puffs. bank 0 = far, 2 = near
function cloudTower(R, cx, base, wdt, hgt, bank, out) {
  const bw = bank + base / 2000;
  const nBig = 7;
  for (let i = 0; i < nBig; i++) {
    const s = i / (nBig - 1);
    const r = lerp(wdt * .27, wdt * .15, s) * R.range(.85, 1.15);
    const x = cx + R.range(-.22, .22) * wdt * (1 - s * .5) + Math.sin(s * 3.1) * wdt * .07;
    const y = base - r * .45 - s * (hgt - r);
    out.push([x, y, r, bw]);
    for (let k = 0; k < 3; k++) {
      const a = R.range(-Math.PI * .95, -Math.PI * .05), rr = r * R.range(.34, .56);
      const px = x + Math.cos(a) * r * .86, py = y + Math.sin(a) * r * .8;
      out.push([px, py, rr, bw]);
      for (let j = 0; j < 2; j++) {
        const a2 = a + R.range(-1.1, 1.1);
        out.push([px + Math.cos(a2) * rr * .88, py + Math.sin(a2) * rr * .86, rr * R.range(.3, .5), bw]);
      }
    }
  }
  // spreading skirt
  for (let i = 0; i < 9; i++) {
    const s = i / 8 * 2 - 1, r = wdt * R.range(.09, .2) * (1 - Math.abs(s) * .35);
    out.push([cx + s * wdt * .62, base - r * .3, r, bw]);
  }
}
const SKIES = {
  blueHour: {
    cols: ['#0c1146', '#222f7e', '#5a57a8', '#c46f9c', '#ffae86'], pos: [.28, .54, .76],
    deep: '#3a3279', shade: '#6652a0', lit: '#d986a8', hi: '#ffd2b4', haze: '#e58f9a', sun: [1590, 930, 0, .8], sunCol: '#ff9f6e', L: [.75, -.28, .5], stars: .8, wisp: .5, wispCol: '#c984ba', seed: 3,
    towers: [[420, 905, 600, 640, 1], [860, 960, 420, 330, 0], [1720, 870, 380, 430, 0], [90, 1010, 330, 280, 2]],
  },
  dusk: {
    cols: ['#090d36', '#17215e', '#33357f', '#6d4a90', '#b9678c'], pos: [.3, .6, .82],
    deep: '#221f59', shade: '#3a3274', lit: '#82579b', hi: '#e29bab', haze: '#8d5688', sun: [1500, 1060, 0, .5], sunCol: '#e07a86', L: [.7, -.3, .5], stars: 1, wisp: .35, wispCol: '#675099', seed: 9,
    towers: [[260, 1010, 520, 470, 1], [1580, 1000, 560, 560, 1], [980, 1080, 460, 260, 0]],
  },
  night: {
    cols: ['#04061f', '#0a1140', '#142163', '#213079', '#3a4690'], pos: [.3, .6, .84],
    deep: '#0f1646', shade: '#1b2766', lit: '#344691', hi: '#6e8ad0', haze: '#2c3a82', sun: [1600, 120, 52, .28], sunCol: '#cfe0ff', L: [.6, -.6, .5], stars: 1, wisp: .25, wispCol: '#2b3c86', seed: 17,
    towers: [[330, 1060, 520, 380, 1], [1560, 1080, 480, 330, 0]],
  },
  dawn: {
    cols: ['#274fae', '#4d86d4', '#93b9e6', '#f2bfae', '#f9d79c'], pos: [.24, .5, .72],
    deep: '#6c69ae', shade: '#a58cc0', lit: '#f4bfae', hi: '#fde9d0', haze: '#f3c4a0', sun: [1330, 790, 54, .42], sunCol: '#ffe2a0', L: [.55, -.5, .6], stars: 0, wisp: .75, wispCol: '#ffe7e2', seed: 23,
    towers: [[370, 930, 640, 670, 1], [1690, 900, 560, 580, 1], [960, 980, 420, 240, 0], [60, 1050, 360, 300, 2], [1960, 1060, 360, 330, 2]],
  },
  gold: {
    cols: ['#283a8f', '#7a5fb0', '#e07f8a', '#ffb066', '#ffe39a'], pos: [.26, .5, .72],
    deep: '#6a3d83', shade: '#b4557e', lit: '#ff9f6c', hi: '#ffe9a6', haze: '#ffb36e', sun: [520, 820, 74, .8], sunCol: '#ffd27a', L: [-.7, -.3, .5], stars: 0, wisp: .6, wispCol: '#ffb18c', seed: 41,
    towers: [[1480, 900, 660, 620, 1], [880, 980, 420, 300, 0], [150, 940, 420, 380, 0]],
  },
};
// a painted sky, cached at w x h. cloud coords are authored for 1920x1080.
function paintedSky(name, w = 2240, h = 1260) {
  const S = SKIES[name];
  return Painter.still(`sky:${name}:${w}x${h}`, 'sky', FS_SKY, w, h, () => {
    const R = rng(S.seed * 77 + 5), puffs = [], k = h / 1080, ox = (w - 1920 * k) / 2;
    for (const [cx, base, wd, hg, bank] of S.towers) cloudTower(R, cx, base, wd, hg, bank, puffs);
    const arr = new Float32Array(220 * 4), n = Math.min(220, puffs.length);
    for (let i = 0; i < n; i++) {
      const p = puffs[i], bank = Math.floor(p[3]), base = (p[3] - bank) * 2000;
      arr.set([p[0] * k + ox, p[1] * k, p[2] * k, bank + (base * k) / 2000], i * 4);
    }
    const [c0, c1, c2, c3, c4] = S.cols.map(vec3);
    return {
      uC0: c0, uC1: c1, uC2: c2, uC3: c3, uC4: c4, uPos: S.pos, 'uPuff[0]': { v4: arr }, uNP: n,
      uDeep0: vec3(S.deep), uShade0: vec3(S.shade), uLit0: vec3(S.lit), uHi0: vec3(S.hi), uHaze: vec3(S.haze),
      uSun: [S.sun[0] * k + ox, S.sun[1] * k, S.sun[2] * k, S.sun[3]], uSunCol: vec3(S.sunCol), uL: S.L, uStars: S.stars, uSeed: S.seed, uWisp: S.wisp, uWispCol: vec3(S.wispCol),
    };
  });
}
// draw a cached sky with parallax pan and zoom. (px,py) in screen pixels.
function drawSky(ctx, name, px = 0, py = 0, z = 1) {
  const c = paintedSky(name);
  ctx.drawImage(c, W / 2 - c.width * z / 2 + px, H / 2 - c.height * z / 2 + py, c.width * z, c.height * z);
}

const FS_NEBULA = `
uniform vec3 uBg,uA,uB,uC; uniform float uSeed, uScale, uStars, uAmt;
void main(){
  vec2 p = vec2(uv.x,1.-uv.y)*uRes; vec2 q = p/900.*uScale + uSeed;
  vec2 w1 = vec2(fbm(q), fbm(q+vec2(5.2,1.3)));
  vec2 w2 = vec2(fbm(q+2.4*w1+vec2(1.7,9.2)), fbm(q+2.4*w1+vec2(8.3,2.8)));
  float n = fbm(q + 2.2*w2);
  vec3 col = uBg;
  col = mix(col, uA, smoothstep(.34,.72,n)*uAmt);
  col = mix(col, uB, smoothstep(.55,.92,w2.x)*.85*uAmt);
  col = mix(col, uC, smoothstep(.62,.95,w1.y*n*1.55)*.75*uAmt);
  col *= .86 + .3*smoothstep(.3,.7,fbm(q*3.1));
  for(int k=0;k<3;k++){
    float cell = k==0?13.:(k==1?31.:97.);
    vec2 id = floor(p/cell); float r = h21(id+uSeed*3.+float(k)*11.);
    if(r > (k==2?.70:.80)){
      vec2 c = (id+.2+.6*vec2(h21(id+2.3),h21(id+6.1)))*cell;
      float s = (k==0?.9:(k==1?1.5:2.6))*(.55+h21(id+4.4));
      float d = length(p-c);
      vec3 tint = mix(vec3(.75,.86,1.), vec3(1.,.9,.74), h21(id+8.8));
      col += tint * (smoothstep(s,0.,d) + (k==2? exp(-d*.28)*.4 : 0.)) * uStars * (.35+.65*h21(id+5.5));
    }
  }
  O = vec4(col,1.);
}`;
const NEBULAE = {
  deep: { bg: '#050824', a: '#17255e', b: '#3a1f6e', c: '#1f6f8f', seed: 2.1, scale: 1.15, stars: 1, amt: 1 },
  ma: { bg: '#0a1554', a: '#2140a8', b: '#5a32a4', c: '#2fb6c8', seed: 7.7, scale: 1.9, stars: .95, amt: 1 },
  void: { bg: '#03040f', a: '#0a1233', b: '#150f38', c: '#0d2a46', seed: 4.4, scale: .9, stars: .75, amt: .9 },
  futures: { bg: '#060a2a', a: '#1d2c72', b: '#4c2678', c: '#b9604f', seed: 12.9, scale: 1.05, stars: .9, amt: 1 },
};
function nebula(name, w = 2240, h = 1260) {
  const N = NEBULAE[name];
  return Painter.still(`neb:${name}:${w}x${h}`, 'nebula', FS_NEBULA, w, h,
    { uBg: vec3(N.bg), uA: vec3(N.a), uB: vec3(N.b), uC: vec3(N.c), uSeed: N.seed, uScale: N.scale, uStars: N.stars, uAmt: N.amt });
}
function drawNebula(ctx, name, px = 0, py = 0, z = 1, rot = 0) {
  const c = nebula(name);
  ctx.save(); ctx.translate(W / 2 + px, H / 2 + py); ctx.rotate(rot); ctx.scale(z, z);
  ctx.drawImage(c, -c.width / 2, -c.height / 2); ctx.restore();
}

// ---- city ------------------------------------------------------------------
const CITY_STYLE = {
  blueHour: { layers: ['#6a5596', '#41377a', '#241f55'], win: ['#ffd58a', '#ffb26e', '#bfeaff'], haze: '#c9789a', lit: 1 },
  dusk: { layers: ['#3b316f', '#262257', '#141238'], win: ['#ffcf86', '#ff9e78', '#a8dcff'], haze: '#7a4c84', lit: 1.1 },
  night: { layers: ['#1a2260', '#111749', '#090c30'], win: ['#ffd790', '#8fd6ff', '#ff9ab8'], haze: '#2b377c', lit: 1.15 },
  dawn: { layers: ['#b79cc4', '#8776ad', '#585089'], win: ['#fff1c2', '#ffd9a0', '#ffffff'], haze: '#ffd4b0', lit: .3 },
};
function cityLayer(style, depth, w = 2240, h = 620) {
  return layer(`city:${style}:${depth}`, w, h, x => {
    const S = CITY_STYLE[style], R = rng(500 + depth * 91);
    const col = S.layers[depth], baseTop = [250, 330, 430][depth], varh = [150, 190, 170][depth];
    let px = -20;
    while (px < w + 20) {
      const bw = R.range(36, 120) * (1 + depth * .28), top = baseTop - R.range(-40, varh) * (R() < .13 ? 1.55 : .75);
      rect(x, px, top, bw + 1.5, h - top, col);
      // side face one tone darker, a lit edge facing the low sun
      rect(x, px, top, bw * R.range(.16, .34), h - top, rgba('#0b0a2c', .22));
      rect(x, px + bw - 2.5, top, 2.5, h - top, rgba(S.haze, .5));
      // roof furniture
      if (R() < .5) rect(x, px + bw * R.range(.1, .5), top - R.range(6, 20), bw * R.range(.2, .45), 22, col);
      if (R() < .22) { rect(x, px + bw * .5, top - R.range(24, 80), 2.2, 80, col); dot(x, px + bw * .5 + 1, top - 48, 2.2, '#ff6b78'); }
      const cw = [4, 6, 8][depth], ch = [5, 8, 11][depth], gx = [8, 12, 17][depth], gy = [10, 15, 21][depth];
      const style2 = R.int(0, 2), wc = R.pick(S.win);
      for (let yy = top + 8; yy < h - 6; yy += gy) {
        const rowLit = R() < .72;
        for (let xx = px + 6; xx < px + bw - cw - 4; xx += gx) {
          const p = style2 === 2 ? .5 : .2;
          if (rowLit && R() < p * S.lit) rect(x, xx, yy, style2 === 2 ? gx - 1.5 : cw, style2 === 2 ? ch * .45 : ch, rgba(R() < .8 ? wc : R.pick(S.win), R.range(.4, .95)));
          else if (R() < .25) rect(x, xx, yy, cw, ch, rgba(S.haze, .13));
        }
      }
      px += bw + R.range(-4, 9);
    }
    // haze pooling at the foot of each layer
    x.globalCompositeOperation = 'source-atop';
    rect(x, 0, 0, w, h, linGrad(x, 0, 240, 0, h, [[0, rgba(S.haze, 0)], [1, rgba(S.haze, [.7, .45, .16][depth])]]));
    x.globalCompositeOperation = 'source-over';
  });
}
// street-level glow plus three skyline layers; (px) pans with parallax
function drawCity(ctx, g, style, o = {}) {
  const base = o.base ?? 1080, px = o.px ?? 0, py = o.py ?? 0, z = o.z ?? 1;
  for (let d = 0; d < 3; d++) {
    const c = cityLayer(style, d), par = [.35, .62, 1][d];
    const w = c.width * z, h = c.height * z;
    ctx.drawImage(c, W / 2 - w / 2 + px * par, base - h + [-30, 20, 70][d] * z + py * par, w, h);
  }
  const S = CITY_STYLE[style];
  const R = rng(77);
  for (let i = 0; i < 26; i++) {
    const x = R.range(0, W) + px * .8, y = base - R.range(20, 150) + py * .8, c = R.pick(S.win);
    glow(ctx, x, y, R.range(14, 46), c, .28 * S.lit);
    if (g && i % 2 === 0) glow(g, x, y, R.range(10, 26), c, .4 * S.lit);
  }
}

// ---- soft-focus city bokeh for close shots -------------------------------------
function bokehPlate(name, sky, tint) {
  return layer('bokehplate:' + name, 2240, 1260, x => {
    const tmp = CV(2240, 1260);
    const tx = C2D(tmp);
    tx.drawImage(paintedSky(sky), 0, 0);
    tx.drawImage(cityLayer(sky === 'dawn' ? 'dawn' : sky === 'night' ? 'night' : sky === 'dusk' ? 'dusk' : 'blueHour', 1), 0, 740);
    x.filter = 'blur(16px)';
    x.drawImage(tmp, -20, -20, 2280, 1300);
    x.filter = 'none';
    const R = rng(name.length * 131 + 9);
    x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 150; i++) {
      const bx = R.range(0, 2240), by = R.range(760, 1240), r = R.range(9, 46), c = R.pick(tint);
      x.globalAlpha = R.range(.05, .24);
      dot(x, bx, by, r, c);
      x.strokeStyle = c; x.lineWidth = 2; x.beginPath(); x.arc(bx, by, r, 0, TAU); x.stroke();
    }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  });
}
function drawBokeh(ctx, name, sky, tint, px = 0, py = 0, z = 1) {
  const c = bokehPlate(name, sky, tint);
  ctx.drawImage(c, W / 2 - c.width * z / 2 + px, H / 2 - c.height * z / 2 + py, c.width * z, c.height * z);
}

// ---- foreground rooftop for the wide shot ------------------------------------
// the ledge top is at y = 872 in a 2240-wide layer centred on the frame
function rooftopLayer(mood) {
  const M = mood === 'dawn'
    ? { conc: '#6d6299', top: '#b7a0c0', edge: '#ffe2bc', dark: '#463e77', metal: '#574d86', rim: '#ffd9a6', puddle: '#ffd3b8' }
    : { conc: '#1b1a48', top: '#3a3470', edge: '#e58f9e', dark: '#100f30', metal: '#17163f', rim: '#ff9f8e', puddle: '#7a68b8' };
  return layer('rooftop:' + mood, 2240, 1180, x => {
    const R = rng(808);
    // water tank on stilts, left
    const tank = (tx, ty, s) => {
      x.save(); x.translate(tx, ty); x.scale(s, s);
      for (const lx of [-92, -34, 34, 92]) { rect(x, lx - 5, 60, 10, 250, M.dark); }
      for (let k = 0; k < 3; k++) ink(x, `M -92 ${90 + k * 74} L 92 ${150 + k * 74} M 92 ${90 + k * 74} L -92 ${150 + k * 74}`, 5, { color: M.dark, t0: 0, t1: 0 });
      rect(x, -118, -170, 236, 232, M.metal);
      rect(x, -118, -170, 70, 232, rgba('#07061c', .3));
      rect(x, 100, -170, 18, 232, rgba(M.rim, .55));
      for (let k = 0; k < 4; k++) rect(x, -120, -150 + k * 62, 240, 6, rgba('#08071e', .55));
      fillD(x, 'M -132 -170 L 0 -240 L 132 -170 Z', M.dark);
      ink(x, 'M 0 -236 L 132 -170', 5, { color: rgba(M.rim, .8) });
      rect(x, -3, -290, 6, 56, M.dark);
      x.restore();
    };
    tank(250, 560, 1.12);
    // antenna mast with guy wires
    rect(x, 520, 330, 7, 560, M.dark);
    for (let k = 0; k < 5; k++) rect(x, 490 + k * 3, 350 + k * 34, 68 - k * 6, 4, M.dark);
    ink(x, 'M 523 340 L 400 872 M 523 340 L 690 872', 2.4, { color: rgba('#0d0c2a', .8), t0: 0, t1: 0 });
    dot(x, 523, 330, 5, '#ff6b78');
    // sagging power lines across the sky
    for (const [a, b, c, wd] of [[210, 340, 470, 3.2], [262, 372, 548, 2.2], [150, 300, 420, 2]]) {
      ink(x, `M -20 ${a} Q 640 ${c} 1180 ${b} Q 1750 ${b - 100} 2260 ${a - 40}`, wd, { color: rgba('#0e0d2c', .72), t0: 0, t1: 0 });
    }
    // the slab and its ledge
    rect(x, 0, 872, 2240, 308, M.conc);
    rect(x, 0, 872, 2240, 22, M.top);
    rect(x, 0, 872, 2240, 4, M.edge);
    rect(x, 0, 894, 2240, 10, M.dark);
    for (let i = 0; i < 520; i++) {
      x.fillStyle = rgba(R() < .5 ? M.top : M.dark, R.range(.08, .3));
      x.beginPath(); x.ellipse(R.range(0, 2240), R.range(905, 1180), R.range(6, 70), R.range(1, 7), R.range(-.05, .05), 0, TAU); x.fill();
    }
    for (let k = -9; k <= 9; k++) {                       // seams run to a vanishing point
      const sx = 1120 + k * 150;
      taper(x, [[sx, 906], [1120 + (sx - 1120) * 2.05, 1190]], 5, { color: rgba(M.dark, .85), t0: 0, t1: 0 });
    }
    for (const sy of [946, 1012, 1112]) rect(x, 0, sy, 2240, 2.5, rgba(M.dark, .7));
    for (let i = 0; i < 8; i++) {
      const px = R.range(100, 2100), py = R.range(952, 1128), wd = R.range(110, 300), ht = wd * R.range(.09, .15);
      const pts = [];
      for (let k = 0; k < 64; k++) {
        const a = k / 64 * TAU, m = 1 + .34 * vnoise(k * .21, i * 7 + 3) + .16 * vnoise(k * .55, i * 5);
        pts.push([px + Math.cos(a) * wd * m, py + Math.sin(a) * ht * m]);
      }
      x.save(); polyPath(x, pts); x.clip();
      rect(x, px - wd * 2, py - ht * 2, wd * 4, ht * 4, linGrad(x, 0, py - ht, 0, py + ht, [[0, rgba(M.puddle, .72)], [1, rgba(M.top, .75)]]));
      for (let k = 0; k < 26; k++) {                      // broken reflections of the city
        const rx = px + R.range(-wd, wd), col = R.pick(['#ffd08a', '#ff9d8e', '#bfe6ff', M.edge]);
        for (let j = 0; j < 7; j++) rect(x, rx + R.range(-5, 5), py - ht + j * ht * .3, R.range(5, 20), 2.4, rgba(col, R.range(.18, .6)));
      }
      x.restore();
      taper(x, pts.slice(34, 62), 3, { color: rgba(M.edge, .75), t0: .4, t1: .4 });
    }
    // vent box and pipe, right
    rect(x, 1880, 770, 190, 106, M.metal); rect(x, 1880, 770, 190, 12, M.top); rect(x, 2056, 770, 14, 106, rgba(M.rim, .45));
    for (let k = 0; k < 6; k++) rect(x, 1900, 798 + k * 12, 140, 5, M.dark);
    rect(x, 2110, 690, 26, 186, M.dark); rect(x, 2096, 680, 54, 18, M.metal);
    // railing posts at the far right
    for (let sx = 1720; sx < 2240; sx += 92) rect(x, sx, 808, 6, 66, M.dark);
    rect(x, 1716, 808, 524, 7, M.dark); rect(x, 1716, 808, 524, 2.5, rgba(M.rim, .8));
  });
}
