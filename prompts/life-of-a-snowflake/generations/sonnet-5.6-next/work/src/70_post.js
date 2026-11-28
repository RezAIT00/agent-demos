// ---------------------------------------------------------------- post
const COC_GLSL = `
uniform float uNear, uFar, uFocus, uAperture, uMaxCoc, uBgCoc, uTilt, uTanHalf, uRadius;
uniform vec3 uPlaneP, uPlaneN;
uniform vec2 uCentre;
float cocAt(vec2 uv, float d){
  if (d > 0.999999) return uBgCoc;
  float z = uNear*uFar/(uFar - d*(uFar - uNear));
  float focus = uFocus;
  if (uTilt > 0.001) {
    // a tilted plane of focus lying along our flake, fading back to a normal lens
    vec3 ray = vec3((uv*2.0 - 1.0)*uTanHalf, -1.0);
    float den = dot(ray, uPlaneN);
    if (abs(den) > 1e-4) {
      float zp = clamp(dot(uPlaneP, uPlaneN)/den, uFocus*0.80, uFocus*1.25);
      float w = uTilt*(1.0 - smoothstep(uRadius*1.0, uRadius*1.65, length(uv - uCentre)));
      focus = mix(focus, zp + 0.10, w);
    }
  }
  return clamp(uAperture*(1.0 - focus/z), -uMaxCoc, uMaxCoc);
}
`;

const DOF_PRE = `
uniform sampler2D uColor, uDepth;
uniform vec2 uTexel;
${COC_GLSL}
float cocOf(vec2 uv){ return cocAt(uv, textureLod(uDepth, uv, 0.0).r); }
void main(){
  vec3 c = vec3(0.0); float coc = 0.0, wsum = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = (vec2(float(i & 1), float(i >> 1)) - 0.5)*uTexel;
    vec3 s = max(textureLod(uColor, vUv + o, 0.0).rgb, vec3(0.0));
    float w = 1.0/(1.0 + max(s.r, max(s.g, s.b))*0.10);
    c += s*w; wsum += w;
    float k = cocOf(vUv + o);
    coc = i == 0 || k < coc ? k : coc;
  }
  outColor = vec4(c/wsum, coc);
}`;

const DOF_GATHER = `
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uMaxCoc, uStep;
void main(){
  vec4 c = textureLod(uTex, vUv, 0.0);
  float centre = abs(c.a), tot = 1.0, reach = centre;
  vec3 col = c.rgb;
  float radius = uStep, ang = 0.0;
  for (int i = 0; i < 900; i++) {
    if (radius >= uMaxCoc) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang))*radius*uTexel;
    vec4 s = textureLod(uTex, tc, 0.0);
    float size = abs(s.a);
    if (s.a > c.a) size = min(size, centre*2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, size);
    col += mix(col/tot, s.rgb, m);
    reach += mix(reach/tot, size, m);
    tot += 1.0;
    radius += uStep/radius;
    ang += 2.39996323;
  }
  outColor = vec4(col/tot, reach/tot);
}`;

const DOF_MIX = `
uniform sampler2D uSharp, uBlur, uDepth;
${COC_GLSL}
void main(){
  float coc = cocAt(vUv, textureLod(uDepth, vUv, 0.0).r);
  vec3 s = max(textureLod(uSharp, vUv, 0.0).rgb, vec3(0.0));
  vec4 b = textureLod(uBlur, vUv, 0.0);
  float f = smoothstep(0.55, 1.9, max(abs(coc), b.a));
  outColor = vec4(mix(s, b.rgb, f), 1.0);
}`;

const BLOOM_DOWN = `
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uPrefilter;
vec3 s(vec2 o){ return textureLod(uTex, vUv + o*uTexel, 0.0).rgb; }
void main(){
  vec3 a = s(vec2(-2,2)), b = s(vec2(0,2)), c = s(vec2(2,2)), d = s(vec2(-2,0)), e = s(vec2(0,0)), f = s(vec2(2,0));
  vec3 g = s(vec2(-2,-2)), h = s(vec2(0,-2)), i = s(vec2(2,-2)), j = s(vec2(-1,1)), k = s(vec2(1,1)), l = s(vec2(-1,-1)), m = s(vec2(1,-1));
  vec3 col = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
  if (uPrefilter > 0.5) {
    float lum = max(col.r, max(col.g, col.b));
    col *= max(lum - 0.85, 0.0)/max(lum, 1e-4);
    col = min(col, vec3(14.0));
  }
  outColor = vec4(col, 1.0);
}`;

const BLOOM_UP = `
uniform sampler2D uTex, uBase; uniform vec2 uTexel; uniform float uBlend;
void main(){
  vec3 c = vec3(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++)
    c += textureLod(uTex, vUv + vec2(x,y)*uTexel, 0.0).rgb*float((2 - abs(x))*(2 - abs(y)))/16.0;
  outColor = vec4(textureLod(uBase, vUv, 0.0).rgb + c*uBlend, 1.0);
}`;

// six faint diffraction spikes on the brightest glints (a hexagonal aperture)
const STAR = `
uniform sampler2D uTex; uniform vec2 uTexel;
void main(){
  vec3 acc = vec3(0.0);
  for (int d = 0; d < 6; d++) {
    float a = 0.2618 + float(d)*1.0471976;
    vec2 dir = vec2(cos(a), sin(a));
    for (int i = 1; i <= 22; i++) {
      float fi = float(i);
      vec3 s = textureLod(uTex, vUv + dir*uTexel*fi*1.5, 0.0).rgb;
      acc += max(s - 0.55, 0.0)*exp(-fi*0.15)*vec3(0.9 + 0.1*sin(fi*0.5), 0.96, 1.0 + 0.06*cos(fi*0.4));
    }
  }
  outColor = vec4(acc/22.0, 1.0);
}`;

const FINAL = `
uniform sampler2D uTex, uBloom, uStar;
uniform float uExposure, uBloomAmt, uStarAmt, uVignette, uFrame, uFade;
uniform vec3 uShadowTint, uHighTint;
vec3 fit(vec3 v){ vec3 a = v*(v + 0.0245786) - 0.000090537; vec3 b = v*(0.983729*v + 0.4329510) + 0.238081; return a/b; }
vec3 aces(vec3 c){
  const mat3 I = mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777);
  const mat3 O = mat3(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602);
  return clamp(O*fit(I*c), 0.0, 1.0);
}
vec3 srgb(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec2 q = vUv - 0.5;
  float r2 = dot(q, q);
  vec2 ca = q*r2*0.0045;
  vec3 col;
  col.r = textureLod(uTex, vUv - ca, 0.0).r;
  col.g = textureLod(uTex, vUv, 0.0).g;
  col.b = textureLod(uTex, vUv + ca, 0.0).b;
  col += textureLod(uBloom, vUv, 0.0).rgb*uBloomAmt + textureLod(uStar, vUv, 0.0).rgb*uStarAmt;
  col *= uExposure*(1.0 - uVignette*smoothstep(0.08, 0.55, r2));
  col = aces(col*1.28);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= mix(uShadowTint, vec3(1.0), smoothstep(0.0, 0.35, l));
  col *= mix(vec3(1.0), uHighTint, smoothstep(0.45, 0.95, l));
  col = srgb(clamp(col*uFade, 0.0, 1.0));
  // fixed-per-frame triangular dither keeps the dusk gradients free of banding
  float n1 = fract(sin(dot(gl_FragCoord.xy + uFrame*1.37, vec2(12.9898, 78.233)))*43758.5453);
  float n2 = fract(sin(dot(gl_FragCoord.xy - uFrame*0.91, vec2(39.346, 11.135)))*24634.6345);
  outColor = vec4(col + (n1 + n2 - 1.0)/255.0, 1.0);
}`;

class Post {
  constructor(renderer, N, quality) {
    this.renderer = renderer; this.N = N;
    const half = N >> 1;
    this.dofIn = makeRT(half, half);
    this.dofBlur = makeRT(half, half);
    this.out = makeRT(N, N);
    this.down = []; this.up = [];
    let s = half;
    for (let i = 0; i < 6; i++) { this.down.push(makeRT(s, s)); this.up.push(makeRT(s, s)); s = Math.max(4, s >> 1); }
    this.star = makeRT(half >> 1, half >> 1);
    const dofU = () => ({ uNear: { value: 0.1 }, uFar: { value: 100 }, uFocus: { value: 10 }, uAperture: { value: 0 }, uMaxCoc: { value: 1 }, uBgCoc: { value: 0 },
      uTilt: { value: 0 }, uTanHalf: { value: Math.tan(10 * D2R) }, uRadius: { value: 0.3 }, uPlaneP: { value: new THREE.Vector3() }, uPlaneN: { value: new THREE.Vector3(0, 0, 1) }, uCentre: { value: new THREE.Vector2(0.5, 0.5) } });
    this.pre = fsPass(DOF_PRE, Object.assign({ uColor: { value: null }, uDepth: { value: null }, uTexel: { value: new THREE.Vector2(1 / N, 1 / N) } }, dofU()));
    this.gather = fsPass(DOF_GATHER, { uTex: { value: null }, uTexel: { value: new THREE.Vector2(1 / half, 1 / half) }, uMaxCoc: { value: 1 }, uStep: { value: quality > 0.7 ? 0.5 : 1.6 } });
    this.mixPass = fsPass(DOF_MIX, Object.assign({ uSharp: { value: null }, uBlur: { value: null }, uDepth: { value: null } }, dofU()));
    this.pDown = fsPass(BLOOM_DOWN, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() }, uPrefilter: { value: 0 } });
    this.pUp = fsPass(BLOOM_UP, { uTex: { value: null }, uBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uBlend: { value: 1 } });
    this.pStar = fsPass(STAR, { uTex: { value: null }, uTexel: { value: new THREE.Vector2(2 / half, 2 / half) } });
    this.pFinal = fsPass(FINAL, {
      uTex: { value: null }, uBloom: { value: null }, uStar: { value: null }, uExposure: { value: 1 }, uBloomAmt: { value: 0.5 }, uStarAmt: { value: 0.3 },
      uVignette: { value: 0.35 }, uFrame: { value: 0 }, uFade: { value: 1 }, uShadowTint: { value: new THREE.Vector3(0.93, 0.99, 1.08) }, uHighTint: { value: new THREE.Vector3(1.03, 1.0, 0.97) },
    });
  }
  // dof(scene) -> this.out ; lens = {near, far, focus, aperture, maxCoc, bgCoc} in pixels at 1080
  dof(sceneRT, lens) {
    const half = this.N >> 1, k = half / 1080;
    for (const p of [this.pre, this.mixPass]) {
      const u = p.u;
      u.uNear.value = lens.near; u.uFar.value = lens.far; u.uFocus.value = lens.focus;
      u.uAperture.value = lens.aperture * k; u.uMaxCoc.value = lens.maxCoc * k; u.uBgCoc.value = lens.bgCoc * k;
      u.uDepth.value = sceneRT.depthTexture;
      u.uTilt.value = lens.tilt || 0;
      if (lens.tilt > 0) { u.uPlaneP.value.copy(lens.planeP); u.uPlaneN.value.copy(lens.planeN); u.uCentre.value.set(lens.centre[0], lens.centre[1]); u.uRadius.value = lens.radius; }
    }
    this.pre.u.uColor.value = sceneRT.texture;
    this.pre.render(this.renderer, this.dofIn);
    this.gather.u.uTex.value = this.dofIn.texture;
    this.gather.u.uMaxCoc.value = Math.max(1, lens.maxCoc * k);
    this.gather.render(this.renderer, this.dofBlur);
    this.mixPass.u.uSharp.value = sceneRT.texture; this.mixPass.u.uBlur.value = this.dofBlur.texture;
    this.mixPass.render(this.renderer, this.out);
    return this.out;
  }
  finish(src, opts) {
    const r = this.renderer;
    let prev = src;
    for (let i = 0; i < 6; i++) {
      this.pDown.u.uTex.value = prev.texture;
      this.pDown.u.uTexel.value.set(1 / prev.width, 1 / prev.height);
      this.pDown.u.uPrefilter.value = i === 0 ? 1 : 0;
      this.pDown.render(r, this.down[i]);
      prev = this.down[i];
    }
    let acc = this.down[5];
    for (let i = 4; i >= 0; i--) {
      this.pUp.u.uTex.value = acc.texture; this.pUp.u.uBase.value = this.down[i].texture;
      this.pUp.u.uTexel.value.set(1 / acc.width, 1 / acc.height); this.pUp.u.uBlend.value = 0.78;
      this.pUp.render(r, this.up[i]);
      acc = this.up[i];
    }
    this.pStar.u.uTex.value = this.down[0].texture;
    this.pStar.render(r, this.star);
    const u = this.pFinal.u;
    u.uTex.value = src.texture; u.uBloom.value = this.up[0].texture; u.uStar.value = this.star.texture;
    u.uExposure.value = opts.exposure; u.uBloomAmt.value = opts.bloom; u.uStarAmt.value = opts.star;
    u.uVignette.value = opts.vignette; u.uFrame.value = opts.frame; u.uFade.value = opts.fade;
    this.pFinal.render(r, null);
  }
}
