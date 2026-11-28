// ---------------------------------------------------------------- crystal field
// Every frame the lattice history is turned into a 2.5D height field at sim
// step S. Nothing is morphed: a cell exists if and only if the simulation had
// frozen it by step S.
const HMAX_CELLS = 14;           // half thickness range, in hero cells
const ICE_HM = HMAX_CELLS / 440; // the same range in crystal-local units

const FIELD_A = `
uniform sampler2D uLat;
uniform float uE, uS, uSoft, uAgeSpan, uLatR;
vec4 cellAt(ivec2 c, float w){
  int u = abs(c.x), v = abs(c.y), s = abs(c.x + c.y);
  int hi = max(u, max(v, s)), lo = min(u, min(v, s)), mid = u + v + s - hi - lo;
  if (float(hi) > uLatR) return vec4(0.0);
  vec4 t = texelFetch(uLat, ivec2(mid, lo), 0);
  if (t.r < 0.0) return vec4(0.0);
  float occ = clamp((uS - t.r)/uSoft + 0.5, 0.0, 1.0);
  float age = clamp((uS - t.r)/uAgeSpan, 0.0, 1.0);
  return w*occ*vec4(1.0, t.g, age, t.b);
}
void main(){
  vec2 p = (vUv*2.0 - 1.0)*uE;
  float r = p.y*1.15470054, q = p.x - r*0.5;
  vec2 f = fract(vec2(q, r)); ivec2 b = ivec2(floor(vec2(q, r)));
  vec4 acc;
  if (f.x + f.y < 1.0) acc = cellAt(b, 1.0-f.x-f.y) + cellAt(b+ivec2(1,0), f.x) + cellAt(b+ivec2(0,1), f.y);
  else acc = cellAt(b+ivec2(1,1), f.x+f.y-1.0) + cellAt(b+ivec2(0,1), 1.0-f.x) + cellAt(b+ivec2(1,0), 1.0-f.y);
  outColor = acc;
}`;

const FIELD_BLUR = `
uniform sampler2D uTex; uniform vec2 uStep; uniform float uSigma;
void main(){
  vec4 acc = vec4(0.0); float tot = 0.0;
  for (int i = -6; i <= 6; i++) {
    float x = float(i)*max(uSigma, 0.001)/2.4;
    float w = exp(-0.5*float(i*i)/5.76);
    acc += w*textureLod(uTex, vUv + uStep*x, 0.0); tot += w;
  }
  outColor = acc/tot;
}`;

const FIELD_COMPOSE = `
uniform sampler2D uB, uC, uD;
uniform float uTexel;
void main(){
  vec4 b = textureLod(uB, vUv, 0.0), c = textureLod(uC, vUv, 0.0);
  float occ = b.r;
  float m = b.g/max(occ, 1e-4), age = b.b/max(occ, 1e-4), air = b.a/max(occ, 1e-4);
  float occW = c.r, mW = c.g/max(occW, 1e-4);
  float cover = smoothstep(0.30, 0.60, occ);
  float bevel = smoothstep(0.43, 0.90, occ);
  float ridge = clamp((m - mW)*1.25, -0.8, 1.15);     // ribs and spines from the ice mass
  float thin = clamp(max(smoothstep(0.12, 0.7, air), smoothstep(0.66, 0.30, m)), 0.0, 1.0);
  float rim = bevel*smoothstep(0.94, 0.66, occW);     // thickened outer margin
  float occD = textureLod(uD, vUv, 0.0).r;          // very wide: gives each branch a gentle crown
  float h = 0.75 + 1.35*clamp(m/1.7, 0.0, 1.35) + 1.9*sqrt(age);
  h += 2.9*smoothstep(0.30, 0.95, occD)*bevel;
  h += 2.9*max(ridge, 0.0) - 1.25*max(-ridge, 0.0);
  h += 1.35*rim;
  h = mix(h, 0.75, thin*0.8);
  h *= mix(0.40, 1.0, bevel);
  h *= cover;
  outColor = vec4(clamp(h/${HMAX_CELLS}.0, 0.0, 1.0), occ, thin, occW);
}`;

class FieldBuilder {
  constructor(renderer, size) {
    this.renderer = renderer; this.size = size;
    const wide = size >> 2;
    this.a = makeRT(size, size); this.t = makeRT(size, size); this.b = makeRT(size, size);
    this.wa = makeRT(wide, wide); this.wt = makeRT(wide, wide);
    this.da = makeRT(wide >> 1, wide >> 1); this.dt = makeRT(wide >> 1, wide >> 1);
    this.pA = fsPass(FIELD_A, { uLat: { value: null }, uE: { value: 1 }, uS: { value: 0 }, uSoft: { value: 1 }, uAgeSpan: { value: 1 }, uLatR: { value: 1 } });
    this.pBlur = fsPass(FIELD_BLUR, { uTex: { value: null }, uStep: { value: new THREE.Vector2() }, uSigma: { value: 1 } });
    this.pC = fsPass(FIELD_COMPOSE, { uB: { value: null }, uC: { value: null }, uD: { value: null }, uTexel: { value: 1 / size } });
  }
  blur(src, dst, tmp, sigma) {
    const u = this.pBlur.u, w = dst.width;
    u.uSigma.value = sigma;
    u.uTex.value = src.texture; u.uStep.value.set(1 / w, 0); this.pBlur.render(this.renderer, tmp);
    u.uTex.value = tmp.texture; u.uStep.value.set(0, 1 / w); this.pBlur.render(this.renderer, dst);
  }
  build(f, S, soft, out) {
    const u = this.pA.u;
    u.uLat.value = f.lattice; u.uE.value = f.E; u.uS.value = S; u.uSoft.value = soft;
    u.uAgeSpan.value = f.ageSpan; u.uLatR.value = f.R;
    this.pA.render(this.renderer, this.a);
    const texelsPerCell = this.size / (2 * f.E);
    this.blur(this.a, this.b, this.t, Math.max(0.9, 0.62 * texelsPerCell));
    this.blur(this.b, this.wa, this.wt, Math.max(1.2, 3.8 * texelsPerCell * f.thick / 4));
    this.blur(this.wa, this.da, this.dt, Math.max(1.0, 7.5 * texelsPerCell / 8));
    this.pC.u.uB.value = this.b.texture; this.pC.u.uC.value = this.wa.texture; this.pC.u.uD.value = this.da.texture;
    this.pC.render(this.renderer, out);
  }
}

function makeHeightRT(size, renderer) {
  const rt = makeRT(size, size, { minFilter: THREE.LinearMipmapLinearFilter, generateMipmaps: true });
  rt.texture.anisotropy = 4;
  return rt;
}

// Air bubbles: soft ellipsoidal inclusions at the pockets the lattice closed.
function bubbleTexture(renderer, pockets, E, size, stepNorm) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  const A = [], B = [];
  const rnd = makeRng(77);
  for (const p of pockets) {
    const beads = !p.big && p.major > 3.2 ? 2 : 1;
    for (let q = 0; q < beads; q++) {
      const off = beads === 2 ? (q ? 1 : -1) * p.major * 0.55 : 0;
      const bx = p.x + Math.cos(p.ang) * off, by = p.y + Math.sin(p.ang) * off;
      const maj = p.big ? p.major : clamp(p.major / beads * (0.85 + 0.4 * rnd()), 1.7, 4.6), min = p.big ? p.minor : clamp(p.minor * (0.8 + 0.3 * rnd()), 1.15, 2.2);
      for (let m = 0; m < 2; m++) for (let r = 0; r < 6; r++) {
        let x = bx, y = by, a = p.ang;
        if (m) { y = -y; a = -a; }
        const th = r * Math.PI / 3, cs = Math.cos(th), sn = Math.sin(th);
        A.push((x * cs - y * sn) / E, (x * sn + y * cs) / E, a + th, p.step / stepNorm);
        B.push(maj / E, min / E);
      }
    }
  }
  geo.setAttribute('iA', new THREE.InstancedBufferAttribute(new Float32Array(A), 4));
  geo.setAttribute('iB', new THREE.InstancedBufferAttribute(new Float32Array(B), 2));
  geo.instanceCount = B.length / 2;
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false,
    vertexShader: `
      in vec4 iA; in vec2 iB; out vec2 vP; out vec2 vN; out float vStep;
      void main(){
        vec2 q = position.xy*1.25; float c = cos(iA.z), s = sin(iA.z);
        vec2 o = vec2(q.x*iB.x*c - q.y*iB.y*s, q.x*iB.x*s + q.y*iB.y*c);
        vP = q; vN = vec2(c, s); vStep = iA.w;
        gl_Position = vec4(iA.xy + o, 0.0, 1.0);
      }`,
    fragmentShader: `
      precision highp float; in vec2 vP; in vec2 vN; in float vStep; out vec4 o;
      void main(){
        float r = length(vP); if (r > 1.22) discard;
        float cov = 1.0 - smoothstep(0.94, 1.18, r);
        vec2 n = vec2(vP.x*vN.x - vP.y*vN.y, vP.x*vN.y + vP.y*vN.x);
        o = vec4(cov, n.x, n.y, vStep);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  const rt = makeRT(size, size);
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
  renderer.render(scene, fsqCam);
  return rt.texture;
}

// ---------------------------------------------------------------- ice material
const ICE_VERT = `
out vec3 vLocal;
void main(){ vLocal = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`;

const ICE_SHADE_COMMON = `
uniform sampler2D uBg;
uniform mat4 uModelViewI, uProjI;
uniform vec2 uRes;
uniform float uPxAngle, uOpacity, uRefract, uSeed;

vec3 toView(vec3 v){ return normalize(mat3(uModelViewI)*v); }
vec3 bgAt(vec2 uv, float lod){ return textureLod(uBg, clamp(uv, vec2(0.001), vec2(0.999)), lod).rgb; }
vec2 bendUV(vec3 outV, vec3 inV){
  return (outV.xy/max(-outV.z, 0.35) - inV.xy/max(-inV.z, 0.35))*uRefract;
}
vec3 filmColour(float dnm, float cosT){
  vec3 phase = 12.56637*1.31*dnm*cosT/vec3(650.0, 540.0, 450.0);
  return 0.5 - 0.5*cos(phase);
}
// pin-point facet glints, fixed in the crystal so they twinkle as it turns
vec3 glints(vec3 p, vec3 nv, vec3 V, float cellsPerUnit, float footprint){
  float vis = 1.0 - smoothstep(0.35, 1.1, footprint*cellsPerUnit*0.5);
  if (vis <= 0.0) return vec3(0.0);
  vec2 g = p.xy*cellsPerUnit, id = floor(g);
  vec3 h = hash33(vec3(id, uSeed + (p.z > 0.0 ? 0.0 : 7.0)));
  if (h.x < 0.945) return vec3(0.0);
  vec2 c = 0.3 + 0.4*hash33(vec3(id.yx, 3.1)).xy;
  float rad = max(0.07 + 0.22*h.y*h.y, footprint*cellsPerUnit*0.9);
  float dot_ = exp(-dot(g - id - c, g - id - c)/(rad*rad));
  vec3 jit = hash33(vec3(id, 9.7 + uSeed)) - 0.5;
  vec3 nm = normalize(nv + jit*0.75);
  vec3 R = reflect(-V, nm);
  float a = pow(max(dot(R, L_KEY), 0.0), 70.0);
  float b = pow(max(dot(R, L_RIM), 0.0), 40.0);
  float f = pow(max(dot(R, normalize(vec3(0.15, 0.35, 0.92))), 0.0), 90.0);
  vec3 s = pow(max(dot(R, uSweepDir), 0.0), 40.0)*vec3(1.0, 0.85, 0.6)*uSweep*3.0;
  return (a*vec3(0.75, 0.88, 1.0)*34.0 + b*vec3(1.0, 0.62, 0.30)*30.0 + f*vec3(0.9, 0.96, 1.0)*17.0 + s*20.0)*dot_*vis*(0.35 + 1.3*h.z*h.z);
}
`;

const ICE_FRAG = `
precision highp float;
precision highp int;
in vec3 vLocal;
out vec4 outColor;
uniform sampler2D uHeight, uBubbles;
uniform vec3 uCamLocal;
uniform float uTexels, uBubbleOn, uStepFrac, uBump, uThinGain, uBright, uMilk, uGlintAmt, uArmAmt, uArmAngle, uArmRest;
${GLSL_NOISE}
${GLSL_ENV}
${ICE_SHADE_COMMON}
const float HM = ${ICE_HM.toFixed(6)};
float H(vec2 xy, float lod){ return textureLod(uHeight, xy*0.5 + 0.5, lod).r*HM; }
float inside(vec3 p, float lod){ return H(p.xy, lod) - abs(p.z) - 2.0e-5; }
vec2 gradH(vec2 xy, float e, float lod){
  return vec2(H(xy + vec2(e,0.0), lod) - H(xy - vec2(e,0.0), lod), H(xy + vec2(0.0,e), lod) - H(xy - vec2(0.0,e), lod))/(2.0*e);
}
void main(){
  vec3 ro = uCamLocal, rd = normalize(vLocal - uCamLocal);
  vec3 ird = 1.0/rd;
  vec3 ta = (vec3(-1.0, -1.0, -HM) - ro)*ird, tb = (vec3(1.0, 1.0, HM) - ro)*ird;
  vec3 tn = min(ta, tb), tf = max(ta, tb);
  float t0 = max(max(tn.x, tn.y), max(tn.z, 0.0)), t1 = min(min(tf.x, tf.y), tf.z);
  if (t1 <= t0) discard;
  float footprint = (t0 + t1)*0.5*uPxAngle;
  float lod = max(0.0, log2(footprint*uTexels*0.5) - 0.25);
  float len = t1 - t0;
  float xyTex = length(rd.xy)*len*uTexels*0.5/exp2(lod);
  int N = int(clamp(xyTex*0.7, 30.0, 220.0));
  float dt = len/float(N), prevT = t0, t = -1.0;
  for (int i = 1; i <= N; i++) {
    float tc = t0 + dt*float(i);
    if (inside(ro + rd*tc, lod) > 0.0) {
      float lo = prevT, hi = tc;
      for (int k = 0; k < 7; k++) { float md = 0.5*(lo + hi); if (inside(ro + rd*md, lod) > 0.0) hi = md; else lo = md; }
      t = hi; break;
    }
    prevT = tc;
  }
  if (t < 0.0) discard;
  vec3 p = ro + rd*t;
  vec4 tx = textureLod(uHeight, p.xy*0.5 + 0.5, lod);
  float occ = tx.g, thin = tx.b, occW = tx.a;
  float alpha = smoothstep(0.33, 0.55, occ)*uOpacity;
  if (alpha < 0.004) discard;

  float e = max(2.6/uTexels, footprint*0.9);
  float side = p.z >= 0.0 ? 1.0 : -1.0;
  vec2 g = gradH(p.xy, e, lod);
  vec3 micro = vec3(vnoise(vec3(p.xy*95.0, uSeed)) - 0.5, vnoise(vec3(p.xy*95.0 + 13.0, uSeed)) - 0.5, 0.0);
  vec2 wavy = vec2(vnoise(vec3(p.xy*7.5, uSeed + 2.0)), vnoise(vec3(p.xy*7.5 + 31.0, uSeed + 2.0))) - 0.5;
  vec3 nL = normalize(vec3(-g*uBump + micro.xy*0.045 + wavy*0.20, side));

  // curvature picks out spines and ribs
  float e2 = max(6.0/uTexels, footprint*2.0);
  float hc = H(p.xy, lod);
  float lap = H(p.xy+vec2(e2,0.0), lod) + H(p.xy-vec2(e2,0.0), lod) + H(p.xy+vec2(0.0,e2), lod) + H(p.xy-vec2(0.0,e2), lod) - 4.0*hc;
  float spine = clamp(-lap/e2*3.2, 0.0, 1.0);
  float groove = clamp(lap/e2*3.2, 0.0, 1.0);

  vec3 nv = toView(nL);
  vec4 pv = uModelViewI*vec4(p, 1.0);
  vec3 V = normalize(-pv.xyz);
  if (dot(nv, V) < 0.03) nv = normalize(nv + V*(0.06 - dot(nv, V)));
  float ndv = clamp(dot(nv, V), 0.0, 1.0);
  float fres = 0.018 + 0.982*pow(1.0 - ndv, 5.0);

  // refract in through the front face, out through the back face
  vec3 inL = refract(rd, nL, 1.0/1.31);
  float depthRate = max(-inL.z*side, 0.12);
  float s = (hc*2.0)/depthRate;
  for (int k = 0; k < 2; k++) s = (abs(p.z) + H(p.xy + inL.xy*s, lod))/depthRate;
  s = clamp(s, 0.0, 0.5);
  vec3 q = p + inL*s;
  vec2 g2 = gradH(q.xy, e*1.4, lod);
  vec3 nB = normalize(vec3(-g2*uBump, -side));
  vec3 outL = refract(inL, -nB, 1.31);
  float tir = 0.0;
  if (dot(outL, outL) < 0.01) { tir = 1.0; outL = rd; }
  vec3 inV = toView(rd), outV = toView(outL);

  vec2 suv = gl_FragCoord.xy/uRes;
  vec2 off = bendUV(outV, inV);
  off *= min(1.0, 0.07/max(length(off), 1e-4));
  float frost = 0.8 + 2.6*spine + 1.2*thin;
  vec3 bg;
  bg.r = bgAt(suv + off*0.96, frost).r;
  bg.g = bgAt(suv + off, frost).g;
  bg.b = bgAt(suv + off*1.05, frost).b;
  vec3 absorb = exp(-s*vec3(7.0, 3.4, 1.8));
  vec3 through = bg*absorb*(1.0 - fres)*1.04;
  vec3 studioThrough = envMap(outV)*0.17*(1.0 - fres);

  vec3 Rv = reflect(-V, nv);
  vec3 refl = envMap(Rv)*(fres*1.9 + 0.040);
  vec3 innerL = reflect(inL, -nB);
  vec3 innerV = toView(vec3(innerL.xy, abs(innerL.z)*side));
  vec3 internal = envMap(innerV)*(0.030 + 0.30*tir);

  // light scattered inside the ice: spines, ribs, bevels and cloudy patches
  float cloudy = smoothstep(0.52, 0.85, fbm3(vec3(p.xy*17.0, uSeed)));
  float wk = 0.5 + 0.5*dot(nv, L_KEY), wr = clamp(dot(nv, L_RIM) + 0.7, 0.0, 1.7)/1.7;
  vec3 lightIn = uKeyCol*(0.22 + 0.78*wk*wk) + uRimCol*0.30*wr*wr;
  float density = 0.006 + 0.215*spine + 0.034*cloudy*cloudy + 0.028*smoothstep(0.25, 0.8, hc/HM);
  vec3 milk = lightIn*density*uMilk;

  // the narrow side facets act as light pipes: bright, direction dependent edges
  float ew = max(5.0/uTexels, footprint*2.5);
  vec2 gw = vec2(textureLod(uHeight, (p.xy+vec2(ew,0.0))*0.5+0.5, lod).g - textureLod(uHeight, (p.xy-vec2(ew,0.0))*0.5+0.5, lod).g,
                 textureLod(uHeight, (p.xy+vec2(0.0,ew))*0.5+0.5, lod).g - textureLod(uHeight, (p.xy-vec2(0.0,ew))*0.5+0.5, lod).g);
  float band = (1.0 - smoothstep(0.62, 0.97, occ))*smoothstep(0.02, 0.14, length(gw));
  vec3 outward = toView(vec3(-gw/max(length(gw), 1e-5), 0.30*side));
  vec2 o2 = normalize(outward.xy + 1e-5);
  float eK = pow(max(dot(o2, normalize(L_KEY.xy)), 0.0), 2.0);
  float eR = pow(max(dot(o2, normalize(L_RIM.xy)), 0.0), 2.0);
  vec3 edge = band*(uKeyCol*(0.05 + 1.25*eK) + uRimCol*2.2*eR);
  edge += band*envMap(reflect(-V, outward))*0.22;
  // second, inner edge line seen through the ice (the back rim)
  float occBack = textureLod(uHeight, q.xy*0.5+0.5, lod + 0.5).g;
  edge += (1.0 - smoothstep(0.55, 0.9, occBack))*smoothstep(0.40, 0.6, occBack)*(uKeyCol*0.14 + uRimCol*0.10);

  vec3 hk = normalize(L_KEY + V), hr = normalize(L_RIM + V), hf = normalize(vec3(-0.22, 0.30, 0.93) + V);
  vec3 spec = uKeyCol*pow(max(dot(nv, hk), 0.0), 160.0)*1.1 + uRimCol*pow(max(dot(nv, hr), 0.0), 60.0)*1.4
            + vec3(0.8, 0.9, 1.0)*pow(max(dot(nv, hf), 0.0), 420.0)*1.6;

  vec3 col = through + studioThrough + refl + internal + milk + edge + spec;
  col *= 1.0 - 0.30*groove;

  // thin-film colour where the crystal is thinnest
  float thinness = clamp(thin + 0.45*smoothstep(0.42, 0.14, hc/HM)*smoothstep(0.6, 0.85, occ), 0.0, 1.0);
  float dnm = 250.0 + 420.0*fbm3(vec3(p.xy*13.0, 4.2 + uSeed)) + 900.0*hc/HM + 140.0*vnoise(vec3(p.xy*52.0, 1.0));
  float cosT = sqrt(max(0.0, 1.0 - (1.0 - ndv*ndv)/1.716));
  vec3 film = filmColour(dnm, cosT);
  float lum = dot(refl + internal, vec3(0.3, 0.6, 0.1));
  col += (film - 0.30)*thinness*uThinGain*(0.095 + lum*1.3);
  col *= mix(vec3(1.0), 0.78 + 0.5*film, 0.13*smoothstep(0.1, 0.8, thinness + 0.35*(1.0 - ndv))*uThinGain);

  vec3 spark = glints(p, nv, V, 150.0, footprint)*uGlintAmt;
  col += spark;
  if (uArmAmt > 0.001) {
    // a warm lamp circles the resting flake: each arm flares as it passes
    float rad = length(p.xy);
    float facing = pow(max(cos(atan(p.y, p.x) - uArmAngle), 0.0), 14.0);
    float arm = mix(facing, 0.26, uArmRest)*smoothstep(0.06, 0.34, rad)*uArmAmt;
    col += arm*(band*vec3(1.0, 0.74, 0.44)*2.6 + spine*vec3(1.0, 0.86, 0.66)*0.75 + vec3(0.10, 0.085, 0.065)*smoothstep(0.55, 0.9, occ));
    col += spark*arm*3.0;
  }

  if (uBubbleOn > 0.5) {
    vec3 mid = p + inL*s*0.5;
    vec4 bub = textureLod(uBubbles, mid.xy*0.5 + 0.5, max(0.0, lod - 1.0));
    float shown = bub.r*smoothstep(bub.a, bub.a + 0.012, uStepFrac);
    if (shown > 0.01) {
      vec2 bn = bub.gb/max(bub.r, 1e-3);
      float rr = min(length(bn), 1.0);
      vec3 sph = normalize(vec3(bn, sqrt(max(0.0, 1.0 - rr*rr)) + 0.06));
      vec3 sphV = toView(vec3(sph.xy, sph.z*side));
      float ring = smoothstep(0.30, 0.62, rr)*(1.0 - smoothstep(0.74, 0.95, rr));
      col *= 1.0 - 0.72*ring*shown;                          // dark annulus: total internal reflection
      col *= 1.0 - 0.30*shown*(1.0 - smoothstep(0.35, 0.5, rr));
      float lip = exp(-pow((rr - 0.84)/0.12, 2.0));          // bright outline, as dark-field light shows it
      col += shown*(uKeyCol*pow(max(dot(sphV, normalize(L_KEY + vec3(0.0,0.0,0.6))), 0.0), 22.0)*2.3
                  + uRimCol*pow(max(dot(sphV, normalize(vec3(0.7,-0.5,0.5))), 0.0), 14.0)*1.05
                  + (uKeyCol*(0.34 + 0.30*max(dot(bn, vec2(-0.62, 0.78)), 0.0)) + uRimCol*0.52*max(dot(bn, vec2(0.85, -0.52)), 0.0))*lip);
    }
  }
  col = max(col*uBright, vec3(0.0));          // the film tint subtracts some hues

  vec4 clip = uProjI*pv;
  gl_FragDepth = clip.z/clip.w*0.5 + 0.5;
  outColor = vec4(col, alpha);
}`;

function lightUniforms(shared) {
  return {
    uEnvTop: shared.uEnvTop, uEnvMid: shared.uEnvMid, uEnvLow: shared.uEnvLow,
    uKeyCol: shared.uKeyCol, uRimCol: shared.uRimCol, uSweep: shared.uSweep, uSweepDir: shared.uSweepDir,
  };
}

function iceUniforms(shared, extra) {
  return Object.assign(lightUniforms(shared), {
    uBg: shared.uBg, uRes: shared.uRes, uPxAngle: { value: 0.001 }, uOpacity: { value: 1 },
    uRefract: shared.uRefract, uSeed: { value: 1 }, uModelViewI: { value: new THREE.Matrix4() }, uProjI: { value: new THREE.Matrix4() },
  }, extra || {});
}

const iceBoxGeo = new THREE.BoxGeometry(2, 2, 2 * ICE_HM);

function makeIceMesh(shared, heightTex, texels, opts) {
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: ICE_VERT, fragmentShader: ICE_FRAG,
    uniforms: iceUniforms(shared, {
      uHeight: { value: heightTex }, uTexels: { value: texels }, uBubbles: { value: opts.bubbles || null },
      uBubbleOn: { value: opts.bubbles ? 1 : 0 }, uStepFrac: { value: 1 }, uBump: { value: 0.82 },
      uThinGain: { value: 1 }, uBright: { value: 1 }, uMilk: { value: 1 }, uGlintAmt: { value: 1 }, uArmAmt: { value: 0 }, uArmAngle: { value: 0 }, uArmRest: { value: 0 }, uCamLocal: { value: new THREE.Vector3() },
    }),
    transparent: true, depthTest: true, depthWrite: true,
  });
  mat.uniforms.uSeed.value = opts.seed || 1;
  const mesh = new THREE.Mesh(iceBoxGeo, mat);
  mesh.frustumCulled = false;
  const inv = new THREE.Matrix4();
  mesh.onBeforeRender = (renderer, scene, camera) => {
    const u = mat.uniforms;
    u.uModelViewI.value.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
    u.uProjI.value.copy(camera.projectionMatrix);
    inv.copy(mesh.matrixWorld).invert();
    u.uCamLocal.value.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inv);
    // angular size of one pixel (the same in local units because scale is uniform)
    u.uPxAngle.value = 2 * Math.tan(camera.fov * D2R / 2) / shared.uRes.value.y;
    mat.uniformsNeedUpdate = true;
  };
  return mesh;
}
