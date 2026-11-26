// ================================================================ particles, flames, precipitation, lightning, selection
const G_FX_COMMON = /* glsl */`
precision highp float;
uniform sampler2D uDepthTex;
uniform vec2 uRes, uNearFar;
float linZ(float d){ return 2.0 * uNearFar.x * uNearFar.y / (uNearFar.y + uNearFar.x - (d * 2.0 - 1.0) * (uNearFar.y - uNearFar.x)); }
float depthFade(float viewZ, float soft){
  float d = texture(uDepthTex, gl_FragCoord.xy / uRes).r;
  if (d >= 1.0) return 1.0;
  return clamp((linZ(d) - viewZ) / soft, 0.0, 1.0);
}
`;

const G_PART_VERT = /* glsl */`
precision highp float;
in vec4 iPos; in vec4 iColor; in vec4 iMisc;
out vec2 vUv; out vec4 vColor; out vec4 vMisc; out float vViewZ; out vec3 vWorld;
uniform vec3 uCamPos;
void main(){
  vec3 c = iPos.xyz;
  vec3 toCam = normalize(uCamPos - c);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
  vec3 up = cross(toCam, right);
  float a = iMisc.y; vec2 q = position.xy;
  vec2 rq = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
  int type = int(iMisc.x + 0.5);
  vec2 sc = vec2(1.0, iMisc.z > 0.0 ? iMisc.z : 1.0);
  if (type == 4) { rq = q; sc.x = 0.35 + 0.65 * abs(sin(iMisc.w)); }
  vec3 p = c + (right * rq.x * sc.x + up * rq.y * sc.y) * iPos.w;
  vUv = q; vColor = iColor; vMisc = iMisc; vWorld = c;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const G_PART_FRAG = /* glsl */`
precision highp float; precision highp sampler3D;
${G_FX_COMMON}
in vec2 vUv; in vec4 vColor; in vec4 vMisc; in float vViewZ; in vec3 vWorld;
uniform sampler2D uNoiseTex;
uniform vec3 uLightDir, uLightColor, uCamPos;
uniform float uFrame;
${G_COMMON}
${G_SHADOW_SAMPLE}
layout(location=0) out vec4 o;
void main(){
  int type = int(vMisc.x + 0.5);
  float r = length(vUv);
  float fade = depthFade(vViewZ, type == 0 ? 0.5 : 0.08) * (type == 3 ? smoothstep(0.9, 2.2, vViewZ) : smoothstep(0.12, 0.6, vViewZ));
  if (type == 0) {
    float n = texture(uNoiseTex, vUv * 0.42 + vec2(vMisc.w * 0.37, vMisc.w * 0.11)).a;
    float a = smoothstep(1.0, 0.1, r + (n - 0.5) * 0.9) * vColor.a * fade;
    o = vec4(vColor.rgb * a, a);
  } else if (type == 1) {
    float g = exp(-r * r * 5.5) * fade * vColor.a;
    o = vec4(vColor.rgb * g, 0.0);
  } else if (type == 2) {
    // dust motes only light up inside shafts of sunlight
    float lit = sunShadow(vWorld, vec3(0.0, 1.0, 0.0), ign(gl_FragCoord.xy, uFrame), false);
    float cs = max(dot(normalize(vWorld - uCamPos), uLightDir), 0.0);
    float g = exp(-r * r * 4.0) * fade * vColor.a * lit * (0.12 + pow(cs, 5.0) * 1.6);
    o = vec4(vColor.rgb * uLightColor * g, 0.0);
  } else if (type == 3) {
    vec2 p = vUv;
    float w = pow(max(0.0, sin((p.y * 0.5 + 0.5) * 3.14159)), 1.35) * 0.46;
    if (abs(p.x) > w) discard;
    float rib = 1.0 - smoothstep(0.0, 0.06, abs(p.x));
    float a = fade * vColor.a;
    o = vec4(vColor.rgb * (0.62 + rib * 0.35 + p.x * 0.35) * a, a);
  } else {
    vec2 p = vec2(abs(vUv.x), vUv.y);
    float wing = max(1.0 - length((p - vec2(0.5, 0.22)) * vec2(2.0, 1.9)), 1.0 - length((p - vec2(0.38, -0.34)) * vec2(2.6, 2.6)));
    if (wing <= 0.0 && !(p.x < 0.07 && abs(p.y) < 0.55)) discard;
    float vein = smoothstep(0.06, 0.0, abs(fract(atan(vUv.y, abs(vUv.x)) * 3.2) - 0.5) - 0.02);
    vec3 col = vColor.rgb * (wing > 0.0 && wing < 0.24 ? 0.12 : 1.0 - vein * 0.55);
    if (p.x < 0.07) col = vColor.rgb * 0.08;
    o = vec4(col * fade, fade);
  }
}`;

const G_FLAME_VERT = /* glsl */`
precision highp float;
in vec4 iPos; in vec4 iMisc;
out vec2 vUv; out float vSeed; out float vViewZ; out float vPower;
uniform vec3 uCamPos; uniform float uTime;
void main(){
  vec3 c = iPos.xyz;
  vec3 toCam = uCamPos - c; toCam.y = 0.0; toCam = normalize(toCam + vec3(0.0001));
  vec3 right = vec3(toCam.z, 0.0, -toCam.x);
  float s = iPos.w;
  float sway = sin(uTime * 7.0 + iMisc.x * 31.0) * 0.045 + sin(uTime * 13.0 + iMisc.x * 17.0) * 0.025;
  float h = position.y * 0.5 + 0.5;
  vec3 p = c + right * (position.x * 0.17 + sway * h * h) * s + vec3(0.0, (h * 0.52 - 0.12) * s * (1.0 + 0.1 * sin(uTime * 9.0 + iMisc.x * 9.0)), 0.0) + toCam * 0.02;
  vUv = vec2(position.x, h); vSeed = iMisc.x; vPower = iMisc.y;
  vec4 mv = viewMatrix * vec4(p, 1.0); vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const G_FLAME_FRAG = /* glsl */`
${G_FX_COMMON}
in vec2 vUv; in float vSeed; in float vViewZ; in float vPower;
uniform sampler2D uNoiseTex; uniform float uTime;
layout(location=0) out vec4 o;
void main(){
  float y = vUv.y;
  vec2 nuv = vec2(vUv.x * 0.34 + vSeed, y * 0.52 - uTime * 0.92);
  float n1 = texture(uNoiseTex, nuv).a - 0.5, n2 = texture(uNoiseTex, nuv * 2.3 + vec2(0.31, -uTime * 0.55)).a - 0.5;
  float x = vUv.x + (n1 * 1.05 + n2 * 0.55) * y;
  float w = smoothstep(0.0, 0.2, y) * pow(max(1.0 - y, 0.0), 0.62) * 1.12;
  float body = smoothstep(w, w * 0.25, abs(x));
  body *= smoothstep(1.0, 0.5, y + n2 * 0.65);
  if (body <= 0.002) discard;
  float core = smoothstep(0.55, 0.0, length(vec2(x * 1.7, (y - 0.23) * 2.1)));
  vec3 col = mix(vec3(0.9, 0.12, 0.008), vec3(1.0, 0.43, 0.04), smoothstep(0.1, 0.8, body * (1.15 - y)));
  col = mix(col, vec3(1.0, 0.83, 0.42), core);
  float inten = (2.6 + core * 8.5) * vPower;
  float blue = smoothstep(0.2, 0.02, y) * body;
  col = mix(col, vec3(0.18, 0.3, 1.0), blue * 0.55);
  float a = body * depthFade(vViewZ, 0.06);
  o = vec4(col * inten * a, a * 0.28);
}`;

const G_PRECIP_VERT = /* glsl */`
precision highp float;
in vec4 iSeed;
out vec2 vUv; out float vViewZ; out float vA;
uniform sampler2D uRainMap; uniform vec4 uRainMapInfo, uWind;
uniform vec3 uCamPos; uniform float uTime, uAmount; uniform int uMode;
float roofAt(vec2 p){ vec2 uv = (p - uRainMapInfo.xy) / uRainMapInfo.z; if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0; return textureLod(uRainMap, uv, 0.0).r; }
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vUv = position.xy; vA = 1.0;
  vec3 p; vec3 off;
  if (iSeed.w > uAmount) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (uMode == 2) {
    float rate = 2.3;
    float cyc = floor(uTime * rate + iSeed.z * 7.0);
    float ph = fract(uTime * rate + iSeed.z * 7.0);
    vec2 r = vec2(h21(iSeed.xy * 91.0 + mod(cyc, 997.0)), h21(iSeed.yx * 57.0 + mod(cyc, 991.0) + 3.1));
    vec2 xz = uCamPos.xz + (r - 0.5) * 26.0;
    float roof = roofAt(xz);
    if (roof <= 0.0 || abs(roof - uCamPos.y) > 15.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    float sz = 0.025 + ph * 0.11;
    p = vec3(xz.x + position.x * sz, roof + 0.025 + (1.0 - abs(length(position.xy) - 1.0)) * 0.0, xz.y + position.y * sz);
    vA = (1.0 - ph) * (1.0 - ph);
  } else {
    bool snow = uMode == 1;
    float area = snow ? 34.0 : 38.0, height = 28.0;
    float speed = snow ? 1.1 + iSeed.x * 0.9 : 17.0 + iSeed.x * 7.0;
    vec2 wind = uWind.xy * uWind.z * (snow ? 1.6 : 2.6);
    vec3 base = vec3(iSeed.x * area, iSeed.y * height, iSeed.z * area);
    base.xz += wind * uTime;
    if (snow) base.xz += vec2(sin(uTime * 0.9 + iSeed.y * 40.0), cos(uTime * 0.7 + iSeed.x * 40.0)) * 0.7;
    p.x = uCamPos.x + mod(base.x - uCamPos.x, area) - area * 0.5;
    p.z = uCamPos.z + mod(base.z - uCamPos.z, area) - area * 0.5;
    p.y = uCamPos.y - 10.0 + mod(base.y - uTime * speed - uCamPos.y + 10.0, height);
    if (p.y < roofAt(p.xz)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    vec3 toCam = normalize(uCamPos - p);
    if (snow) {
      vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam)), up = cross(toCam, right);
      float sz = 0.014 + iSeed.y * 0.022;
      p += (right * position.x + up * position.y) * sz;
    } else {
      vec3 axis = normalize(vec3(wind.x, -speed, wind.y));
      vec3 side = normalize(cross(axis, toCam));
      p += side * position.x * 0.0065 + axis * position.y * (0.26 + speed * 0.012);
    }
    vA = smoothstep(0.6, 2.2, length(uCamPos - p)) * (0.55 + 0.45 * iSeed.y);
  }
  vec4 mv = viewMatrix * vec4(p, 1.0); vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const G_PRECIP_FRAG = /* glsl */`
${G_FX_COMMON}
in vec2 vUv; in float vViewZ; in float vA;
uniform vec3 uSkyLum; uniform float uFlash; uniform int uMode;
layout(location=0) out vec4 o;
void main(){
  float a; vec3 col = uSkyLum + vec3(0.6, 0.68, 1.0) * uFlash * 0.9;
  if (uMode == 2) { float r = length(vUv); a = smoothstep(0.22, 0.0, abs(r - 0.76)) * 0.34 * vA; col *= 1.5; }
  else if (uMode == 1) { a = smoothstep(1.0, 0.2, length(vUv)) * 0.82 * vA; col = col * 2.1 + 0.015; }
  else { a = (1.0 - abs(vUv.x)) * smoothstep(1.0, 0.1, abs(vUv.y)) * 0.3 * vA; col *= 1.5; }
  a *= depthFade(vViewZ, 0.12);
  if (a <= 0.003) discard;
  o = vec4(col * a, a * 0.85);
}`;

const G_BOLT_VERT = /* glsl */`
precision highp float;
in vec3 aDir; in vec2 aSide; // side, width
in float aPow;
out float vSide; out float vPow; out float vViewZ;
uniform vec3 uCamPos;
void main(){
  vec3 toCam = normalize(uCamPos - position);
  vec3 side = normalize(cross(aDir, toCam));
  vec3 p = position + side * aSide.x * aSide.y;
  vSide = aSide.x; vPow = aPow;
  vec4 mv = viewMatrix * vec4(p, 1.0); vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const G_BOLT_FRAG = /* glsl */`
${G_FX_COMMON}
in float vSide; in float vPow; in float vViewZ;
uniform float uStrength;
layout(location=0) out vec4 o;
void main(){
  float core = exp(-vSide * vSide * 60.0), glow = exp(-abs(vSide) * 5.0);
  vec3 col = (vec3(0.92, 0.94, 1.0) * core * 90.0 + vec3(0.42, 0.5, 1.0) * glow * 5.0) * vPow * uStrength;
  o = vec4(col * depthFade(vViewZ, 2.0), 0.0);
}`;

const G_LINE_FRAG = /* glsl */`
${G_FX_COMMON}
in float vViewZ;
uniform vec4 uLineColor;
layout(location=0) out vec4 o;
void main(){
  float d = texture(uDepthTex, gl_FragCoord.xy / uRes).r;
  if (d < 1.0 && linZ(d) < vViewZ - 0.012 - vViewZ * 0.001) discard;
  o = vec4(uLineColor.rgb * uLineColor.a, uLineColor.a);
}`;

const Effects = {
  max: 3200, parts: [], time: 0,
  init() {
    const base = { uDepthTex: { value: null }, uRes: { value: V2(1, 1) }, uNearFar: Pipeline.shared.uNearFar };
    this.base = base;
    const premul = { glslVersion: THREE.GLSL3, transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, side: THREE.DoubleSide };
    const mk = (vs, fs, uniforms) => new THREE.ShaderMaterial(Object.assign({}, premul, { vertexShader: vs, fragmentShader: fs, uniforms: Object.assign({}, base, uniforms) }));
    const quad = (n, attrs) => {
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      const out = {};
      for (const name of attrs) { const a = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); out[name] = a; }
      g.instanceCount = 0;
      return { g, a: out };
    };
    const add = (geo, mat, order) => { const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = order; Pipeline.scenes.fx.add(m); return m; };
    // billboards
    const pq = quad(this.max, ['iPos', 'iColor', 'iMisc']);
    this.partGeo = pq;
    this.partMat = mk(G_PART_VERT, G_PART_FRAG, Object.assign(Pipeline.pick('uNoiseTex', 'uLightDir', 'uLightColor', 'uCamPos', 'uFrame', 'uShadowMap', 'uShadowMat', 'uCascadeTexel', 'uCascadeDepth', 'uCascadeSize', 'uShadowOn', 'uShadowTile', 'uPcf')));
    add(pq.g, this.partMat, 3);
    // flames
    const fq = quad(160, ['iPos', 'iMisc']);
    this.flameGeo = fq;
    add(fq.g, mk(G_FLAME_VERT, G_FLAME_FRAG, uni('uNoiseTex', 'uTime', 'uCamPos')), 2);
    // rain, snow, splashes
    this.precip = [];
    for (const [mode, count] of [[0, 9000], [1, 7000], [2, 1400]]) {
      const q = quad(count, ['iSeed']);
      const r = mulberry32(900 + mode);
      for (let i = 0; i < count * 4; i++) q.a.iSeed.array[i] = r();
      q.g.instanceCount = count;
      const mat = mk(G_PRECIP_VERT, G_PRECIP_FRAG, Object.assign(uni('uRainMap', 'uRainMapInfo', 'uWind', 'uCamPos', 'uTime', 'uFlash'), { uAmount: { value: 0 }, uMode: { value: mode }, uSkyLum: { value: V3(0.2, 0.22, 0.26) } }));
      const mesh = add(q.g, mat, 4); mesh.visible = false;
      this.precip.push({ mesh, mat });
    }
    // lightning
    this.boltGeo = new THREE.BufferGeometry();
    this.boltMat = mk(G_BOLT_VERT, G_BOLT_FRAG, Object.assign(uni('uCamPos'), { uStrength: { value: 0 } }));
    this.bolt = add(this.boltGeo, this.boltMat, 5); this.bolt.visible = false; this.strikeT = -99; this.strikeSeed = 0;
    // targeted-block outline
    const eg = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.lineMat = new THREE.ShaderMaterial(Object.assign({}, premul, { vertexShader: 'out float vViewZ; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vViewZ = -mv.z; gl_Position = projectionMatrix * mv; }', fragmentShader: G_LINE_FRAG, uniforms: Object.assign({}, base, { uLineColor: { value: V4(0.0, 0.0, 0.0, 0.62) } }) }));
    this.outline = new THREE.LineSegments(eg, this.lineMat); this.outline.frustumCulled = false; this.outline.visible = false; this.outline.renderOrder = 6;
    Pipeline.scenes.fx.add(this.outline);
  },
  bind(depthTex) { this.base.uDepthTex.value = depthTex; this.base.uRes.value.set(Pipeline.W, Pipeline.H); },
  reset() { this.parts = []; this.bolt.visible = false; this.strikeT = -99; },

  // radiance a white surface would reflect at a point: used to light dust and smoke
  litColor(albedo, light) {
    const sh = U.uSH.value[0], sun = U.uLightColor.value, s = light[3] * light[3];
    return [0, 1, 2].map((i) => {
      const k = ['x', 'y', 'z'][i];
      return albedo[i] * (sh[k] * s * 1.0 + sun[k] * s * 0.12 + light[i] * light[i] * 1.2 + 0.002);
    });
  },
  dust(world, pos, color, n = 6, spread = 0.5) {
    const l = world.getLight(Math.floor(pos.x), pos.y + 0.3, Math.floor(pos.z));
    const c = this.litColor(color, l);
    for (let i = 0; i < n; i++) this.parts.push({ type: 0, p: V3(pos.x + (Math.random() - 0.5) * spread, pos.y + (Math.random() - 0.5) * spread, pos.z + (Math.random() - 0.5) * spread), v: V3((Math.random() - 0.5) * 0.8, Math.random() * 0.5 + 0.1, (Math.random() - 0.5) * 0.8), s: 0.12 + Math.random() * 0.14, grow: 0.5, c, a: 0.42, life: 0.7 + Math.random() * 0.7, age: 0, rot: Math.random() * 6, g: -0.2 });
  },
  ember(pos, color, n = 1) {
    for (let i = 0; i < n; i++) this.parts.push({ type: 1, p: pos.clone(), v: V3((Math.random() - 0.5) * 1.3, Math.random() * 1.7 + 0.4, (Math.random() - 0.5) * 1.3), s: 0.018 + Math.random() * 0.025, grow: -0.01, c: [color[0] * 14, color[1] * 14, color[2] * 14], a: 1, life: 0.5 + Math.random() * 0.9, age: 0, rot: 0, g: -0.9 });
  },
  splash(world, pos) {
    const l = world.getLight(Math.floor(pos.x), pos.y + 1, Math.floor(pos.z));
    const c = this.litColor([0.8, 0.88, 0.92], l);
    for (let i = 0; i < 26; i++) this.parts.push({ type: 0, p: V3(pos.x + (Math.random() - 0.5) * 0.8, pos.y, pos.z + (Math.random() - 0.5) * 0.8), v: V3((Math.random() - 0.5) * 2.4, Math.random() * 3.4 + 0.6, (Math.random() - 0.5) * 2.4), s: 0.035 + Math.random() * 0.06, grow: 0.04, c, a: 0.75, life: 0.45 + Math.random() * 0.4, age: 0, rot: 0, g: 11 });
  },

  // lightning: a jagged branching channel generated from a seed so a strike can be replayed exactly
  strike(time, from, to, seed) {
    const r = mulberry32(seed);
    const segs = [];
    const split = (a, b, depth, pow, width) => {
      if (depth === 0) { segs.push([a, b, pow, width]); return; }
      const mid = v3mul(v3add(a, b), 0.5), len = v3len(v3sub(b, a));
      mid[0] += (r() - 0.5) * len * 0.34; mid[1] += (r() - 0.5) * len * 0.1; mid[2] += (r() - 0.5) * len * 0.34;
      split(a, mid, depth - 1, pow, width); split(mid, b, depth - 1, pow, width);
      if (depth >= 3 && depth <= 5 && r() < 0.36 && pow > 0.25) {
        const dir = v3sub(b, a);
        const end = [mid[0] + dir[0] * 0.5 + (r() - 0.5) * len * 0.9, mid[1] - len * (0.2 + r() * 0.45), mid[2] + dir[2] * 0.5 + (r() - 0.5) * len * 0.9];
        split(mid, end, depth - 2, pow * 0.34, width * 0.55);
      }
    };
    split(from, to, 7, 1, 2.6);
    const pos = [], dir = [], side = [], pw = [], idx = [];
    let n = 0;
    for (const [a, b, pow, width] of segs) {
      const d = v3norm(v3sub(b, a));
      for (const [p, s] of [[a, -1], [a, 1], [b, 1], [b, -1]]) { pos.push(...p); dir.push(...d); side.push(s, width * (0.4 + pow * 0.6)); pw.push(pow); }
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4;
    }
    this.boltGeo.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3)); g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 2)); g.setAttribute('aPow', new THREE.Float32BufferAttribute(pw, 1));
    g.setIndex(idx);
    this.boltGeo = g; this.bolt.geometry = g;
    this.strikeT = time; this.strikeSeed = seed;
    U.uFlashPos.value.set((from[0] + to[0]) / 2, Math.min(CB_Y + 40, from[1]), (from[2] + to[2]) / 2);
    this.strikeLen = { from, to };
  },
  flashEnvelope(dt) {
    if (dt < 0 || dt > 0.75) return 0;
    let f = 0;
    for (const [t0, a, k] of [[0, 1, 22], [0.09, 0.55, 30], [0.19, 0.85, 16], [0.34, 0.35, 12]]) if (dt >= t0) f += a * Math.exp(-(dt - t0) * k);
    return Math.min(1.25, f);
  },
  updateLightning(time) {
    const f = this.flashEnvelope(time - this.strikeT);
    U.uFlash.value = f * 1.6;
    this.bolt.visible = f > 0.03;
    this.boltMat.uniforms.uStrength.value = f;
  },

  // ambient particles that are pure functions of time, so the film can reproduce them exactly
  ambient(t, cam, world, env, push) {
    const cx = cam.x, cy = cam.y, cz = cam.z;
    if (env.motes > 0.01) {
      const S = 1.7, R = 7;
      const bx = Math.floor(cx / S), by = Math.floor(cy / S), bz = Math.floor(cz / S);
      for (let i = -R; i <= R; i++) for (let k = -R; k <= R; k++) for (let j = -2; j <= 3; j++) {
        const gx = bx + i, gy = by + j, gz = bz + k;
        const h = rand01(gx, gy, gz, 11);
        if (h > 0.38) continue;
        const h2 = rand01(gx, gy, gz, 12), h3 = rand01(gx, gy, gz, 13);
        const x = (gx + h2) * S + Math.sin(t * 0.21 + h * 40) * 0.35, y = (gy + h3) * S + Math.sin(t * 0.16 + h2 * 40) * 0.25, z = (gz + rand01(gx, gy, gz, 14)) * S + Math.cos(t * 0.19 + h3 * 40) * 0.35;
        const d = Math.hypot(x - cx, y - cy, z - cz);
        if (d > 12 || d < 0.5) continue;
        push(2, x, y, z, 0.008 + h3 * 0.014, 1.0, 0.86, 0.62, env.motes * (1 - d / 12) * (0.6 + 0.4 * Math.sin(t * 1.3 + h * 90)), 0, 1, h);
      }
    }
    if (env.fireflies > 0.01) {
      const S = 6, R = 6;
      const bx = Math.floor(cx / S), bz = Math.floor(cz / S);
      for (let i = -R; i <= R; i++) for (let k = -R; k <= R; k++) {
        const gx = bx + i, gz = bz + k, h = rand01(gx, 3, gz, 21);
        if (h > 0.5) continue;
        const x0 = (gx + rand01(gx, 3, gz, 22)) * S, z0 = (gz + rand01(gx, 3, gz, 23)) * S;
        const ground = world.roofAt(x0, z0);
        if (ground < SEA) continue;
        const x = x0 + Math.sin(t * 0.31 + h * 77) * 2.2 + Math.sin(t * 0.83 + h * 13) * 0.6, z = z0 + Math.cos(t * 0.27 + h * 51) * 2.2, y = Math.min(ground, cy + 4) + 0.6 + h * 2.2 + Math.sin(t * 0.7 + h * 31) * 0.5;
        const blink = Math.pow(Math.max(0, Math.sin(t * (1.2 + h) + h * 91)), 4);
        if (blink < 0.02) continue;
        push(1, x, y, z, 0.05, 5.5, 9, 1.6, blink * env.fireflies, 0, 1, h);
        push(1, x, y, z, 0.26, 0.5, 0.85, 0.15, blink * env.fireflies * 0.5, 0, 1, h);
      }
    }
    if (env.leaves > 0.01 || env.petals > 0.01) {
      const petal = env.petals > env.leaves;
      const S = 4, R = 6;
      const bx = Math.floor(cx / S), bz = Math.floor(cz / S);
      for (let i = -R; i <= R; i++) for (let k = -R; k <= R; k++) {
        const gx = bx + i, gz = bz + k, h = rand01(gx, 7, gz, 31);
        if (h > (petal ? env.petals * 0.75 : env.leaves * 0.28)) continue;
        const x0 = (gx + rand01(gx, 7, gz, 32)) * S, z0 = (gz + rand01(gx, 7, gz, 33)) * S;
        const roof = world.roofAt(x0, z0);
        if (roof < SEA + 3 || Math.abs(roof - cy) > 18) continue;
        const ph = (t * (0.06 + h * 0.04) + rand01(gx, 7, gz, 34)) % 1;
        const x = x0 + Math.sin(t * 1.3 + h * 40) * 0.5 + ph * U.uWind.value.x * 3.5, z = z0 + Math.cos(t * 1.1 + h * 23) * 0.5 + ph * U.uWind.value.y * 3.5, y = roof - ph * 9;
        const col = petal ? [0.85, 0.52, 0.6] : h > 0.12 ? [0.2, 0.26, 0.05] : [0.34, 0.2, 0.04];
        const lc = this.litColor(col, [0, 0, 0, 0.9]);
        push(3, x, y, z, petal ? 0.032 : 0.046, lc[0], lc[1], lc[2], Math.min(1, (1 - ph) * 6), t * (1.5 + h * 3) + h * 50, 0.55 + 0.45 * Math.abs(Math.sin(t * 2.2 + h * 9)), h);
      }
    }
    if (env.butterflies > 0.01) {
      for (let n = 0; n < 7; n++) {
        const S = 14, gx = Math.floor(cx / S) + (n % 3) - 1, gz = Math.floor(cz / S) + Math.floor(n / 3) - 1, h = rand01(gx, n, gz, 41);
        const x = (gx + h) * S + Math.sin(t * 0.42 + h * 30) * 3.5 + Math.sin(t * 1.7 + h * 11) * 0.5, z = (gz + rand01(gx, n, gz, 42)) * S + Math.cos(t * 0.37 + h * 19) * 3.5;
        const ground = world.roofAt(x, z);
        if (ground < SEA || Math.abs(ground - cy) > 9) continue;
        const y = ground + 0.8 + Math.sin(t * 2.1 + h * 70) * 0.35 + Math.sin(t * 6.3 + h * 5) * 0.08;
        const lc = this.litColor(h > 0.5 ? [0.62, 0.26, 0.03] : [0.5, 0.36, 0.05], [0, 0, 0, 0.9]);
        push(4, x, y, z, 0.052, lc[0] * 0.55, lc[1] * 0.55, lc[2] * 0.55, env.butterflies, 0, 1, t * 17 + h * 30);
      }
    }
  },
  // fire, embers and smoke that belong to light sources
  fires(t, cam, lights, push) {
    const F = this.flameGeo.a;
    let nf = 0;
    const flame = (x, y, z, s, seed, power) => { if (nf >= 160) return; F.iPos.setXYZW(nf, x, y, z, s); F.iMisc.setXYZW(nf, seed, power, 0, 0); nf++; };
    for (const l of lights) {
      const d = Math.hypot(l.x - cam.x, l.y - cam.y, l.z - cam.z);
      if (d > 48 || l.held) continue;
      const seed = rand01(Math.floor(l.x * 3), Math.floor(l.y * 3), Math.floor(l.z * 3), 3);
      if (l.type === 0) flame(l.x, l.y - 0.02, l.z, 0.82, seed, 1);
      else if (l.type === 5 && l.radius > 12) {
        for (let i = 0; i < 5; i++) flame(l.x + (rand01(i, 1, 1, 5) - 0.5) * 0.42, l.y - 0.4 + (i === 0 ? 0.08 : 0), l.z + (rand01(i, 2, 1, 5) - 0.5) * 0.42, i === 0 ? 1.75 : 1.0, seed + i * 0.21, 0.8);
        if (d < 40) for (let i = 0; i < 14; i++) {
          const ph = (t * (0.11 + 0.04 * rand01(i, 3, 3, 6)) + i / 14) % 1, h = rand01(i, 4, 3, 6);
          const lit = this.litColor([0.5, 0.48, 0.46], [0.2, 0.12, 0.06, 0.9]);
          push(0, l.x + Math.sin(t * 0.8 + i) * 0.2 * ph + U.uWind.value.x * ph * ph * 2.4, l.y + 0.4 + ph * 4.2, l.z + Math.cos(t * 0.7 + i * 2) * 0.2 * ph + U.uWind.value.y * ph * ph * 2.4, 0.18 + ph * 0.85, lit[0], lit[1], lit[2], 0.2 * (1 - ph) * Math.min(1, ph * 7), h * 6 + t * 0.2, 1, h * 10);
        }
      }
      if ((l.type === 2 || l.type === 5 || l.type === 0) && d < 34) {
        const n = l.type === 2 ? 3 : l.type === 5 ? 9 : 2;
        for (let i = 0; i < n; i++) {
          const rate = 0.34 + 0.3 * rand01(i, 5, Math.floor(l.x), 7);
          const cyc = t * rate + rand01(i, 6, Math.floor(l.z), 7) + seed;
          const ph = cyc % 1, c = Math.floor(cyc);
          if (l.type === 2 && rand01(c, i, Math.floor(l.x + l.z), 8) > 0.4) continue;
          const ox = (rand01(c, i, 1, 9) - 0.5) * (l.type === 2 ? 2.6 : 0.3), oz = (rand01(c, i, 2, 9) - 0.5) * (l.type === 2 ? 2.6 : 0.3);
          const rise = l.type === 2 ? 2.4 : l.type === 5 ? 2.2 : 0.7;
          push(1, l.x + ox + Math.sin(t * 3 + i + c) * 0.12 * ph, l.y - 0.2 + ph * rise, l.z + oz + Math.cos(t * 2.6 + i) * 0.12 * ph, 0.016 + 0.012 * rand01(c, i, 3, 9), 16, 5.2, 0.7, (1 - ph) * Math.min(1, ph * 8), 0, 1, i);
        }
      }
    }
    this.flameGeo.g.instanceCount = nf;
    F.iPos.needsUpdate = true; F.iMisc.needsUpdate = true;
  },

  // rebuild the instance buffers for this frame; dt = 0 keeps event particles frozen
  update(t, dt, cam, world, env, lights) {
    const A = this.partGeo.a;
    let n = 0;
    const push = (type, x, y, z, size, r, g, b, a, rot, stretch, seed) => {
      if (n >= this.max) return;
      A.iPos.setXYZW(n, x, y, z, size); A.iColor.setXYZW(n, r, g, b, a); A.iMisc.setXYZW(n, type, rot, stretch, seed); n++;
    };
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.age += dt;
      if (p.age > p.life) { this.parts.splice(i, 1); continue; }
      p.v.y -= p.g * dt; p.v.multiplyScalar(1 - dt * (p.type === 0 ? 1.6 : 0.4)); p.p.addScaledVector(p.v, dt);
      const f = p.age / p.life;
      push(p.type, p.p.x, p.p.y, p.p.z, p.s + p.grow * p.age, p.c[0], p.c[1], p.c[2], p.a * (1 - f * f) * Math.min(1, p.age * 18), p.rot, 1, i);
    }
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
    this.ambient(t, cam, world, env, push);
    this.fires(t, cam, lights, push);
    this.partGeo.g.instanceCount = n;
    A.iPos.needsUpdate = true; A.iColor.needsUpdate = true; A.iMisc.needsUpdate = true;
    // precipitation
    const amounts = [env.rain, env.snowfall, env.rain * 0.9];
    const sh = U.uSH.value[0];
    for (let i = 0; i < 3; i++) {
      const pr = this.precip[i];
      pr.mesh.visible = amounts[i] > 0.01 && U.uUnderwater.value < 0.5;
      pr.mat.uniforms.uAmount.value = amounts[i];
      pr.mat.uniforms.uSkyLum.value.set(sh.x * 0.62 + 0.008, sh.y * 0.62 + 0.01, sh.z * 0.62 + 0.014);
    }
    this.updateLightning(t);
  },
  setOutline(hit) {
    if (!hit) { this.outline.visible = false; return; }
    const boxes = pickBoxes(hit.id, hit.meta);
    const b = boxes[0];
    this.outline.visible = true;
    this.outline.scale.set(b[3] - b[0] + 0.006, b[4] - b[1] + 0.006, b[5] - b[2] + 0.006);
    this.outline.position.set(hit.x + (b[0] + b[3]) / 2, hit.y + (b[1] + b[4]) / 2, hit.z + (b[2] + b[5]) / 2);
    this.outline.updateMatrixWorld();
  },
};
const CB_Y = 336;
