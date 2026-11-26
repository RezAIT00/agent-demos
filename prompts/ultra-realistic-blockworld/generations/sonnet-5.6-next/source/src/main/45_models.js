// ================================================================ procedural modelling kit + lit model material
const v3add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const v3sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const v3mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const v3len = (a) => Math.hypot(a[0], a[1], a[2]);
const v3norm = (a) => { const l = v3len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const v3cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const v3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const hexRGB = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

class ModelBuilder {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.mat = []; this.tint = []; this.bone = []; this.idx = []; this.n = 0; }
  // o: {layer, color, rough, metal, emissive, ao, bone, bone2, weight(p), fur, colorFn(p, n)}
  vert(p, n, u, v, o) {
    const c = o.colorFn ? o.colorFn(p, n) : o.color || [1, 1, 1];
    this.pos.push(p[0], p[1], p[2]); this.nrm.push(n[0], n[1], n[2]); this.uv.push(u, v);
    this.mat.push(o.layer === undefined ? -1 : o.layer, o.rough === undefined ? -1 : o.rough, o.metal === undefined ? -1 : o.metal, o.emissive || 0);
    this.tint.push(c[0], c[1], c[2], o.aoFn ? o.aoFn(p, n) : o.ao === undefined ? 1 : o.ao);
    const w = o.weight ? o.weight(p) : 0;
    this.bone.push(o.bone || 0, o.bone2 === undefined ? o.bone || 0 : o.bone2, w, typeof o.fur === 'function' ? o.fur(p, n) : o.fur || 0);
    return this.n++;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quadIdx(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  quad(p, uvs, o, normals) {
    const n = normals || (() => { const f = v3norm(v3cross(v3sub(p[1], p[0]), v3sub(p[3], p[0]))); return [f, f, f, f]; })();
    const i = p.map((q, k) => this.vert(q, n[k], uvs[k][0], uvs[k][1], o));
    this.quadIdx(i[0], i[1], i[2], i[3]);
  }
  box(c, h, o, axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], faceOpts) {
    for (let f = 0; f < 6; f++) {
      const F = FACES[f];
      const tr = (q) => [c[0] + axes[0][0] * q[0] * h[0] + axes[1][0] * q[1] * h[1] + axes[2][0] * q[2] * h[2], c[1] + axes[0][1] * q[0] * h[0] + axes[1][1] * q[1] * h[1] + axes[2][1] * q[2] * h[2], c[2] + axes[0][2] * q[0] * h[0] + axes[1][2] * q[1] * h[1] + axes[2][2] * q[2] * h[2]];
      const pts = F.c.map((q) => tr([q[0] * 2 - 1, q[1] * 2 - 1, q[2] * 2 - 1]));
      const n = v3norm([axes[0][0] * F.n[0] + axes[1][0] * F.n[1] + axes[2][0] * F.n[2], axes[0][1] * F.n[0] + axes[1][1] * F.n[1] + axes[2][1] * F.n[2], axes[0][2] * F.n[0] + axes[1][2] * F.n[1] + axes[2][2] * F.n[2]]);
      const su = Math.abs(F.u[0]) * h[0] * 2 + Math.abs(F.u[1]) * h[1] * 2 + Math.abs(F.u[2]) * h[2] * 2;
      const sv = Math.abs(F.v[0]) * h[0] * 2 + Math.abs(F.v[1]) * h[1] * 2 + Math.abs(F.v[2]) * h[2] * 2;
      const fo = faceOpts ? faceOpts(f, o) : o;
      const k = fo.uvScale || 1;
      const uvs = fo.fit ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [su * k, 0], [su * k, sv * k], [0, sv * k]];
      this.quad(pts, uvs, fo, [n, n, n, n]);
    }
  }
  // smooth tube through points with per-point radii; ends are rounded with caps
  tube(pts, radii, seg, o, squash = 1) {
    const rings = [];
    let side = null;
    for (let i = 0; i < pts.length; i++) {
      const dir = v3norm(v3sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]));
      if (!side) side = v3norm(v3cross(dir, Math.abs(dir[1]) < 0.92 ? [0, 1, 0] : [1, 0, 0]));
      else side = v3norm(v3sub(side, v3mul(dir, v3dot(side, dir))));
      const up = v3cross(dir, side);
      const r = Array.isArray(radii) ? radii[i] : radii;
      const ring = [];
      for (let s = 0; s <= seg; s++) {
        const a = (s / seg) * Math.PI * 2;
        const nv = v3add(v3mul(side, Math.cos(a)), v3mul(up, Math.sin(a) * squash));
        const p = v3add(pts[i], v3mul(nv, r));
        const nn = v3norm(v3add(v3mul(side, Math.cos(a)), v3mul(up, Math.sin(a) / Math.max(squash, 0.2))));
        ring.push(this.vert(p, nn, (s / seg) * (o.uvScale || 1) * Math.max(1, r * 6.28), (i / (pts.length - 1)) * (o.uvScale || 1) * v3len(v3sub(pts[pts.length - 1], pts[0])), o));
      }
      rings.push(ring);
    }
    for (let i = 0; i < rings.length - 1; i++) for (let s = 0; s < seg; s++) this.quadIdx(rings[i][s], rings[i][s + 1], rings[i + 1][s + 1], rings[i + 1][s]);
    for (const [end, sign] of [[0, -1], [pts.length - 1, 1]]) {
      const r = Array.isArray(radii) ? radii[end] : radii;
      const dir = v3norm(v3sub(pts[Math.min(end + 1, pts.length - 1)], pts[Math.max(end - 1, 0)]));
      const tip = v3add(pts[end], v3mul(dir, sign * r * 0.7));
      const ti = this.vert(tip, v3mul(dir, sign), 0.5, 0.5, o);
      for (let s = 0; s < seg; s++) { if (sign > 0) this.tri(rings[end][s], rings[end][s + 1], ti); else this.tri(rings[end][s + 1], rings[end][s], ti); }
    }
  }
  ellipsoid(c, r, su, sv, o, deform, axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
    const rows = [];
    for (let j = 0; j <= sv; j++) {
      const th = (j / sv) * Math.PI, row = [];
      for (let i = 0; i <= su; i++) {
        const ph = (i / su) * Math.PI * 2;
        const d = [Math.sin(th) * Math.cos(ph), -Math.cos(th), Math.sin(th) * Math.sin(ph)];
        const k = deform ? deform(d) : 1;
        const l = [d[0] * r[0] * k, d[1] * r[1] * k, d[2] * r[2] * k];
        const p = [c[0] + axes[0][0] * l[0] + axes[1][0] * l[1] + axes[2][0] * l[2], c[1] + axes[0][1] * l[0] + axes[1][1] * l[1] + axes[2][1] * l[2], c[2] + axes[0][2] * l[0] + axes[1][2] * l[1] + axes[2][2] * l[2]];
        const ln = v3norm([d[0] / r[0], d[1] / r[1], d[2] / r[2]]);
        const n = [axes[0][0] * ln[0] + axes[1][0] * ln[1] + axes[2][0] * ln[2], axes[0][1] * ln[0] + axes[1][1] * ln[1] + axes[2][1] * ln[2], axes[0][2] * ln[0] + axes[1][2] * ln[1] + axes[2][2] * ln[2]];
        row.push(this.vert(p, n, (i / su) * (o.uvScale || 1) * 2, (j / sv) * (o.uvScale || 1), o));
      }
      rows.push(row);
    }
    for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) this.quadIdx(rows[j][i], rows[j + 1][i], rows[j + 1][i + 1], rows[j][i + 1]);
  }
  // flat polygon in the XY plane extruded along Z with chamfered rim (tool heads, blades)
  extrude(poly, thick, bevel, xf, o) {
    const n = poly.length;
    let cx = 0, cy = 0; for (const p of poly) { cx += p[0] / n; cy += p[1] / n; }
    const inner = poly.map((p) => { const dx = cx - p[0], dy = cy - p[1], l = Math.hypot(dx, dy) || 1; return [p[0] + (dx / l) * bevel, p[1] + (dy / l) * bevel]; });
    const P = (q, z) => xf([q[0], q[1], z]);
    for (const s of [1, -1]) {
      const z = (s * thick) / 2;
      const nz = v3norm(v3sub(xf([0, 0, s]), xf([0, 0, 0])));
      const ci = this.vert(P([cx, cy], z), nz, cx * 2, cy * 2, o);
      const ids = inner.map((q) => this.vert(P(q, z), nz, q[0] * 2, q[1] * 2, o));
      for (let i = 0; i < n; i++) { if (s > 0) this.tri(ci, ids[i], ids[(i + 1) % n]); else this.tri(ci, ids[(i + 1) % n], ids[i]); }
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const quad = [P(poly[i], z * 0.28), P(poly[j], z * 0.28), P(inner[j], z), P(inner[i], z)];
        if (s < 0) quad.reverse();
        const uvs = [[poly[i][0] * 2, poly[i][1] * 2], [poly[j][0] * 2, poly[j][1] * 2], [inner[j][0] * 2, inner[j][1] * 2], [inner[i][0] * 2, inner[i][1] * 2]];
        if (s < 0) uvs.reverse();
        this.quad(quad, uvs, o);
      }
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.quad([P(poly[i], -thick * 0.14), P(poly[j], -thick * 0.14), P(poly[j], thick * 0.14), P(poly[i], thick * 0.14)], [[0, 0], [1, 0], [1, 0.1], [0, 0.1]], o);
    }
  }
  geometry(skinned = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 4));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(this.tint, 4));
    if (skinned) g.setAttribute('aBone', new THREE.Float32BufferAttribute(this.bone, 4));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

const G_MODEL_VERT = /* glsl */`
precision highp float;
in vec4 aMat; in vec4 aTint;
#ifdef SKINNED
in vec4 aBone;
in float iShell;
uniform mat4 uBones[24];
uniform float uShellLen;
out float vShell; out float vFur; out vec3 vRest;
#endif
#ifdef USE_INSTANCING
in vec4 iData; in vec4 iLight;
out vec4 vInstLight;
#endif
out vec3 vWorld; out vec3 vNormal; out vec2 vUv; out vec4 vMat; out vec4 vTint;
uniform float uTime;
void main(){
  vec3 p = position; vec3 n = normal;
  vMat = aMat; vTint = aTint; vUv = uv;
#ifdef SKINNED
  vRest = position;
  float w = aBone.z;
  mat4 m = uBones[int(aBone.x + 0.5)] * (1.0 - w) + uBones[int(aBone.y + 0.5)] * w;
  vShell = iShell; vFur = aBone.w;
  p += normalize(normal) * aBone.w * iShell * uShellLen;
  p.y -= aBone.w * iShell * iShell * uShellLen * 0.55;
  p = (m * vec4(p, 1.0)).xyz;
  n = mat3(m) * n;
#endif
#ifdef USE_INSTANCING
  p = (instanceMatrix * vec4(p, 1.0)).xyz;
  n = mat3(instanceMatrix) * n;
  vMat.x = iData.x; vTint.rgb *= iData.yzw; vInstLight = iLight;
#endif
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz; vNormal = mat3(modelMatrix) * n;
  gl_Position = projectionMatrix * viewMatrix * wp;
#ifdef SKINNED
  if (iShell > 0.0 && aBone.w <= 0.0001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
#endif
#ifdef VIEWMODEL
  gl_Position.z = (gl_Position.z + gl_Position.w) * 0.05 - gl_Position.w;
#endif
}`;

const G_MODEL_FRAG = /* glsl */`
precision highp float; precision highp sampler2DArray;
uniform sampler2DArray uAlbedoArr, uNormalArr, uExtraArr;
uniform sampler2D uNoiseTex;
uniform vec4 uLight;
uniform float uHit, uDissolve, uTime, uFrame, uObjFlags, uWetness, uMatClass, uEmisBoost;
in vec3 vWorld; in vec3 vNormal; in vec2 vUv; in vec4 vMat; in vec4 vTint;
#ifdef SKINNED
in float vShell; in float vFur; in vec3 vRest;
#endif
#ifdef USE_INSTANCING
in vec4 vInstLight;
#endif
${G_COMMON}
${G_GBUF}
void main(){
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 dpx = dFdx(vWorld), dpy = dFdy(vWorld);
  vec3 albedo = srgbToLin(vTint.rgb);
  float rough = vMat.y < 0.0 ? 0.8 : vMat.y;
  float metal = max(vMat.z, 0.0);
  float ao = vTint.a;
  float emis = 0.0;
  if (vMat.x >= 0.0) {
    vec3 c = vec3(vUv, floor(vMat.x + 0.5));
    vec4 a = texture(uAlbedoArr, c), nr = texture(uNormalArr, c), ex = texture(uExtraArr, c);
    if (c.z >= ${FIRST_CUTOUT_LAYER}.0 && ex.a < 0.45) discard;
    albedo *= a.rgb;
    if (vMat.y < 0.0) rough = nr.z;
    if (vMat.z < 0.0) metal = ex.g;
    ao *= nr.w;
    emis = ex.r * vMat.w;
    vec2 ux = dFdx(vUv), uy = dFdy(vUv);
    vec3 p2 = cross(dpy, N), p1 = cross(N, dpx);
    vec3 T = p2 * ux.x + p1 * uy.x, Bt = p2 * ux.y + p1 * uy.y;
    float inv = inversesqrt(max(max(dot(T, T), dot(Bt, Bt)), 1e-12));
    vec2 tn = nr.xy * 2.0 - 1.0;
    N = normalize(N + (T * inv * tn.x + Bt * inv * tn.y) * 0.8);
  } else emis = vMat.w;
  float matClass = uMatClass;
  float extra = 1.0;
#ifdef SKINNED
  if (vFur > 0.0001) {
    // shell fur: strands thin out toward the tips
    vec3 q = vRest * 74.0;
    vec3 cell = floor(q);
    float strand = hash13(cell);
    vec3 f = fract(q) - 0.5 - (hash33(cell + 3.0) - 0.5) * 0.5;
    if (vShell > 0.0) {
      if (strand < vShell * 0.82 || length(f) > 0.78 - vShell * 0.34) discard;
    }
    albedo *= 0.56 + vShell * 0.72 + (strand - 0.5) * 0.4;
    ao *= 0.62 + 0.38 * sqrt(vShell + 0.08);
    N = normalize(N + (hash33(cell) - 0.5) * 0.55);
    rough = 0.82; matClass = 3.0;
  } else if (matClass == 3.0) {
    // skin, scale and feather grain
    float g = hash13(floor(vRest * 150.0));
    float g2 = texture(uNoiseTex, vRest.xz * 1.7 + vRest.y * 1.3).a;
    albedo *= 0.88 + 0.16 * g + (g2 - 0.5) * 0.35;
  }
  if (uDissolve > 0.0) {
    float d = texture(uNoiseTex, (vRest.xy + vRest.z * 0.7) * 0.9).a * 0.7 + hash13(floor(vRest * 28.0)) * 0.3;
    if (d < uDissolve) discard;
    if (d < uDissolve + 0.09) { emis = 12.0; albedo = vec3(1.0, 0.36, 0.06); }
  }
  emis *= uEmisBoost;
#endif
  if (uWetness > 0.0) { albedo *= 1.0 - 0.35 * uWetness; rough = mix(rough, 0.28, uWetness); }
  if (uHit > 0.0) { albedo = mix(albedo, vec3(0.5, 0.05, 0.03), uHit * 0.5); emis = max(emis, uHit * 0.4); }
#ifdef USE_INSTANCING
  vec4 light = vInstLight;
#else
  vec4 light = uLight;
#endif
  writeG(albedo, ao, N, rough, metal, light, emis, matClass, 6.0, extra, uObjFlags);
}`;

const G_MODEL_SHADOW_FRAG = /* glsl */`
precision highp float; precision highp sampler2DArray;
uniform sampler2DArray uExtraArr;
in vec3 vWorld; in vec3 vNormal; in vec2 vUv; in vec4 vMat; in vec4 vTint;
layout(location = 0) out vec4 o;
void main(){
  if (vMat.x >= ${FIRST_CUTOUT_LAYER}.0 && texture(uExtraArr, vec3(vUv, floor(vMat.x + 0.5))).a < 0.5) discard;
  o = vec4(1.0);
}`;

// forward-lit variant used to render inventory icons from the same geometry and textures
const G_ICON_FRAG = /* glsl */`
precision highp float; precision highp sampler2DArray;
uniform sampler2DArray uAlbedoArr, uNormalArr, uExtraArr;
in vec3 vWorld; in vec3 vNormal; in vec2 vUv; in vec4 vMat; in vec4 vTint;
layout(location=0) out vec4 o;
${G_COMMON}
void main(){
  vec3 N = normalize(vNormal); if (!gl_FrontFacing) N = -N;
  vec3 albedo = srgbToLin(vTint.rgb);
  float rough = vMat.y < 0.0 ? 0.8 : vMat.y, metal = max(vMat.z, 0.0), ao = vTint.a, emis = vMat.x < 0.0 ? vMat.w : 0.0;
  if (vMat.x >= 0.0) {
    vec3 c = vec3(vUv, floor(vMat.x + 0.5));
    vec4 a = texture(uAlbedoArr, c), nr = texture(uNormalArr, c), ex = texture(uExtraArr, c);
    if (c.z >= ${FIRST_CUTOUT_LAYER}.0 && ex.a < 0.4) discard;
    albedo *= a.rgb; if (vMat.y < 0.0) rough = nr.z; if (vMat.z < 0.0) metal = ex.g; ao *= nr.w; emis = ex.r * vMat.w;
    vec3 dpx = dFdx(vWorld), dpy = dFdy(vWorld); vec2 ux = dFdx(vUv), uy = dFdy(vUv);
    vec3 p2 = cross(dpy, N), p1 = cross(N, dpx); vec3 T = p2 * ux.x + p1 * uy.x, Bt = p2 * ux.y + p1 * uy.y;
    float inv = inversesqrt(max(max(dot(T, T), dot(Bt, Bt)), 1e-12)); vec2 tn = nr.xy * 2.0 - 1.0;
    N = normalize(N + (T * inv * tn.x + Bt * inv * tn.y) * 0.85);
  }
  vec3 L = normalize(vec3(-0.35, 0.82, 0.55)), V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L + V);
  float nl = max(dot(N, L), 0.0), a2 = max(rough * rough, 0.04);
  float nh = max(dot(N, H), 0.0); float d = nh * nh * (a2 * a2 - 1.0) + 1.0;
  float spec = a2 * a2 / (3.14159 * d * d) * 0.25;
  vec3 f0 = mix(vec3(0.04), albedo, metal);
  vec3 col = albedo * (1.0 - metal * 0.7) * (nl * 1.9 + (0.46 + 0.3 * N.y) * ao + max(dot(N, vec3(0.7, 0.1, 0.3)), 0.0) * 0.4) + f0 * (min(spec, 6.0) * nl * 2.2 + metal * 0.55 * ao) + albedo * emis * 0.5;
  col = col / (1.0 + col * 0.22);
  o = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;

function modelUniforms(extra = {}) {
  return Object.assign(uni('uAlbedoArr', 'uNormalArr', 'uExtraArr', 'uNoiseTex', 'uTime', 'uFrame'), {
    uLight: { value: V4(0, 0, 0, 1) }, uHit: { value: 0 }, uDissolve: { value: 0 }, uObjFlags: { value: 2 }, uWetness: { value: 0 }, uMatClass: { value: 0 }, uEmisBoost: { value: 1 },
  }, extra);
}
function makeModelMaterial(opts = {}) {
  const defines = {};
  if (opts.skinned) defines.SKINNED = 1;
  if (opts.viewmodel) defines.VIEWMODEL = 1;
  const u = modelUniforms(opts.skinned ? { uBones: { value: Array.from({ length: 24 }, () => new THREE.Matrix4()) }, uShellLen: { value: 0 } } : {});
  if (opts.viewmodel) u.uObjFlags.value = 3;
  if (opts.matClass !== undefined) u.uMatClass.value = opts.matClass;
  return new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: G_MODEL_VERT, fragmentShader: G_MODEL_FRAG, uniforms: u, defines, side: THREE.DoubleSide });
}
function makeModelShadowMaterial(opts = {}, shared) {
  const defines = {};
  if (opts.skinned) defines.SKINNED = 1;
  return new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: G_MODEL_VERT, fragmentShader: G_MODEL_SHADOW_FRAG, defines, side: THREE.DoubleSide, colorWrite: false, uniforms: Object.assign(uni('uAlbedoArr', 'uExtraArr', 'uTime'), opts.skinned ? { uBones: shared.uBones, uShellLen: shared.uShellLen } : {}) });
}
