// ---------------------------------------------------------------- nucleation
// A mineral dust grain, vapour streaming onto it, a droplet that freezes and
// facets into a hexagonal prism. The same prism material also draws the
// columns, needles and capped columns lying on the mitten.
const CELL = 1 / 440;                // one hero lattice cell in crystal-local units
const GRAIN_R = 3.4 * CELL;

function makeGrain(shared) {
  const geo = new THREE.IcosahedronGeometry(1, 20);
  const pos = geo.attributes.position;
  const rnd = makeRng(5);
  const bumps = Array.from({ length: 34 }, (_, i) => ({ d: new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize(), a: (rnd() * 0.55 - 0.22) * (i < 14 ? 1 : 0.42), k: i < 14 ? 3 + rnd() * 9 : 14 + rnd() * 40 }));
  const lumps = makeNoise2(55);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let r = 0.86;
    for (const b of bumps) r += b.a * Math.pow(Math.max(0, v.dot(b.d)), b.k);
    r += 0.07 * Math.sin(v.x * 9.1 + v.y * 4.3) * Math.sin(v.z * 7.7 - v.x * 3.1);
    r += 0.075 * (lumps.n(v.x * 4.6 + v.z * 2.3 + 9, v.y * 4.6 - v.z * 1.7 + 9) - 0.5);
    pos.setXYZ(i, v.x * r * 1.22, v.y * r * 0.84, v.z * r * 0.92);
  }
  geo.computeVertexNormals();
  // average the normals of coincident corners for the smooth part of the surface
  const sums = new Map(), nrm = geo.attributes.normal;
  const keyOf = (i) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = keyOf(i);
    if (!sums.has(k)) sums.set(k, new THREE.Vector3());
    sums.get(k).add(v.fromBufferAttribute(nrm, i));
  }
  for (let i = 0; i < pos.count; i++) { const n = sums.get(keyOf(i)); v.copy(n).normalize(); nrm.setXYZ(i, v.x, v.y, v.z); }
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: Object.assign(lightUniforms(shared), { uGlint: { value: 0 } }),
    vertexShader: `out vec3 vN; out vec3 vV; out vec3 vL;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = -mv.xyz; vL = position; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `precision highp float; in vec3 vN; in vec3 vV; in vec3 vL; out vec4 o; uniform float uGlint;
      ${GLSL_NOISE} ${GLSL_ENV}
      void main(){
        vec3 V = normalize(vV);
        vec3 bumpN = vec3(vnoise(vL*11.0), vnoise(vL*11.0+7.0), vnoise(vL*11.0+19.0)) - 0.5;
        vec3 flatN = normalize(cross(dFdx(-vV), dFdy(-vV)));
        float cleaved = smoothstep(0.52, 0.70, vnoise(vL*3.3 + 4.0));
        vec3 fineN = vec3(vnoise(vL*27.0), vnoise(vL*27.0+3.0), vnoise(vL*27.0+9.0)) - 0.5;
        vec3 n = normalize(mix(normalize(vN), flatN, cleaved*0.75) + bumpN*0.45 + fineN*0.35);
        vec3 vC = mix(vec3(0.078,0.058,0.050), vec3(0.190,0.122,0.080), smoothstep(0.36, 0.64, fbm3(vL*2.4)));
        vC = mix(vC, vec3(0.46,0.34,0.215), smoothstep(0.60, 0.74, vnoise(vL*4.6 + 9.0)));
        vC = mix(vC, vec3(0.20,0.21,0.23), smoothstep(0.70, 0.82, vnoise(vL*8.5 + 31.0)));
        float grit = 0.55 + 0.9*vnoise(vL*7.0)*vnoise(vL*19.0)*1.8;
        vec3 col = vC*grit*(uKeyCol*(1.5*max(dot(n,L_KEY),0.0) + 0.10) + uRimCol*1.6*max(dot(n,L_RIM),0.0) + vec3(0.04,0.07,0.12));
        float rim = pow(1.0 - clamp(dot(n,V),0.0,1.0), 3.0);
        col += rim*(uRimCol*0.65*max(0.3+n.x,0.0) + uKeyCol*0.28);
        vec3 R = reflect(-V, n);
        col += envMap(R)*0.055;
        float sp = pow(max(dot(R, L_KEY),0.0), 60.0)*1.9 + pow(max(dot(R, normalize(vec3(0.2,0.3,0.93))),0.0), 190.0)*8.0*uGlint;
        col += sp*vec3(1.0,0.9,0.74)*step(0.45, vnoise(vL*5.0));
        o = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(GRAIN_R);
  return mesh;
}

const PRISM_FRAG = `
precision highp float;
in vec3 vLocal;
out vec4 outColor;
uniform vec3 uCamLocal;
uniform float uRadius, uHalfH, uMorph, uSphereR, uFrost, uFront, uBright;
uniform vec3 uFrontDir;
${GLSL_NOISE}
${GLSL_ENV}
${ICE_SHADE_COMMON}
float sdHex(vec3 p, float ap, float hz){
  const vec3 k = vec3(-0.8660254, 0.5, 0.57735027);
  p = abs(p);
  p.xy -= 2.0*min(dot(k.xy, p.xy), 0.0)*k.xy;
  vec2 d = vec2(length(p.xy - vec2(clamp(p.x, -k.z*ap, k.z*ap), ap))*sign(p.y - ap), p.z - hz);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
float map(vec3 p){
  float bev = uRadius*0.025;
  float prism = sdHex(p, uRadius*0.8660254 - bev, uHalfH - bev) - bev;
  if (uMorph >= 0.999) return prism;
  float wob = (vnoise(p/uSphereR*2.2) - 0.5)*uSphereR*0.035;
  return mix(length(p) - uSphereR + wob, prism, uMorph);
}
vec3 normalAt(vec3 p, float e){
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy*map(p + k.xyy*e) + k.yyx*map(p + k.yyx*e) + k.yxy*map(p + k.yxy*e) + k.xxx*map(p + k.xxx*e));
}
void main(){
  vec3 ro = uCamLocal, rd = normalize(vLocal - uCamLocal);
  float bound = max(max(uRadius*1.12, uSphereR*1.12), uHalfH*1.1);
  float bsph = length(vec2(max(uRadius*1.1, uSphereR*1.15), max(uHalfH*1.05, uSphereR*1.15)));
  float b = dot(ro, rd), c = dot(ro, ro) - bsph*bsph, disc = b*b - c;
  if (disc < 0.0) discard;
  float t = max(-b - sqrt(disc), 0.0), tmax = -b + sqrt(disc);
  float footprint = length(ro)*uPxAngle;
  float minD = 1e9; float tHit = -1.0, tNear = t;
  for (int i = 0; i < 160; i++) {
    float d = map(ro + rd*t);
    if (d < minD) { minD = d; tNear = t; }
    if (d < footprint*0.2) { tHit = t; break; }
    t += max(d*0.75, footprint*0.25);
    if (t > tmax) break;
  }
  float cover = 1.0;
  if (tHit < 0.0) { if (minD > footprint*1.2) discard; tHit = tNear; cover = 1.0 - clamp(minD/(footprint*1.2), 0.0, 1.0); }
  vec3 p = ro + rd*tHit;
  float eps = max(footprint*0.7, uRadius*0.004);
  vec3 n = normalAt(p, eps);
  // real faces are never perfectly flat
  n = normalize(n + (vec3(vnoise(p/uRadius*3.1 + 2.0), vnoise(p/uRadius*3.1 + 8.0), vnoise(p/uRadius*3.1 + 17.0)) - 0.5)*0.085*uMorph);
  vec3 nrm = p/max(uSphereR, 1e-5);
  float frozen = smoothstep(0.05, -0.05, dot(normalize(p), uFrontDir) - uFront);
  float rime = frozen*uFrost;
  if (rime > 0.0) {
    vec3 j = vec3(vnoise(p/uRadius*14.0), vnoise(p/uRadius*14.0 + 5.0), vnoise(p/uRadius*14.0 + 11.0)) - 0.5;
    n = normalize(n + j*0.75*rime);
  }
  vec3 nv = toView(n);
  vec4 pv = uModelViewI*vec4(p, 1.0);
  vec3 V = normalize(-pv.xyz);
  if (dot(nv, V) < 0.02) nv = normalize(nv + V*(0.05 - dot(nv, V)));
  float ndv = clamp(dot(nv, V), 0.0, 1.0);
  float fres = 0.02 + 0.98*pow(1.0 - ndv, 5.0);
  // walk through the body to the far surface
  vec3 inD = refract(rd, n, 1.0/1.31);
  float s = footprint*3.0 + uRadius*0.04;
  for (int i = 0; i < 48; i++) {
    float d = -map(p + inD*s);
    if (d < footprint*0.2) break;
    s += max(d*0.8, footprint*0.4);
  }
  vec3 q = p + inD*s;
  vec3 nB = normalAt(q, eps*1.5);
  vec3 outD = refract(inD, -nB, 1.31);
  float tir = 0.0;
  if (dot(outD, outD) < 0.01) { tir = 1.0; outD = reflect(inD, -nB); }
  vec3 outV = toView(outD), inV = toView(rd);
  vec2 suv = gl_FragCoord.xy/uRes;
  // the grain sits at the middle: rays through the centre stay nearly straight
  vec2 off = bendUV(outV, inV)*0.34*smoothstep(0.60, 0.99, length(nv.xy));
  off *= min(1.0, 0.05/max(length(off), 1e-4));
  vec3 through = bgAt(suv + off, 0.4 + 4.0*rime)*exp(-s/max(uRadius, 1e-5)*vec3(0.20, 0.10, 0.05))*(1.0 - fres);
  vec3 col = through;
  vec3 R = reflect(-V, nv);
  col += envMap(R)*(fres*1.15 + 0.030);
  col += envMap(outV)*(0.075 + 0.22*tir)*(1.0 - fres);
  vec3 inner = toView(reflect(inD, -nB));
  col += envMap(inner)*0.07;
  float rimGlow = pow(1.0 - ndv, 2.2);
  col += rimGlow*(uKeyCol*0.42*max(dot(nv, L_KEY)+0.35, 0.0) + uRimCol*0.80*max(dot(nv, L_RIM)+0.35, 0.0));
  col += uKeyCol*pow(max(dot(nv, normalize(L_KEY + V)), 0.0), 150.0)*2.4 + uRimCol*pow(max(dot(nv, normalize(L_RIM + V)), 0.0), 70.0)*2.0;
  col += vec3(0.85,0.93,1.0)*pow(max(dot(nv, normalize(vec3(-0.22,0.30,0.93) + V)), 0.0), 600.0)*7.0;
  // milk of freshly frozen ice
  float cl = vnoise(p/uRadius*6.0)*0.6 + vnoise(p/uRadius*17.0)*0.4;
  col = mix(col, (uKeyCol*(0.24 + 0.42*max(dot(nv, L_KEY), 0.0)) + uRimCol*0.22*max(dot(nv, L_RIM), 0.0))*(0.26 + 0.86*cl*cl), rime*0.54);
  // the frost keeps a wet gloss: lamps, a bright rim and sparkling grains
  col += rime*(envMap(R)*(0.045 + 0.34*pow(1.0 - ndv, 2.0)) + rimGlow*(uKeyCol*0.24 + uRimCol*0.40*max(nv.x, 0.0)));
  col += rime*vec3(0.85, 0.93, 1.0)*pow(max(dot(nv, normalize(L_KEY + V)), 0.0), 40.0)*0.9;
  col += rime*smoothstep(0.76, 0.93, vnoise(p/uRadius*31.0 + 4.0))*pow(max(dot(nv, normalize(vec3(-0.25, 0.35, 0.90))), 0.0), 14.0)*vec3(0.8, 0.95, 1.15);
  // freezing front glows as latent heat leaves
  float frontBand = exp(-pow((dot(normalize(p), uFrontDir) - uFront)/0.075, 2.0))*step(0.001, uFrost);
  col += frontBand*vec3(0.55, 0.75, 1.0)*0.55*(1.0 - uMorph);
  // crisp crystal edges, front and back
  if (uMorph > 0.35) {
    float edgeAmt = 0.0;
    for (int side = 0; side < 2; side++) {
      vec3 w = side == 0 ? p : q;
      float d1 = -1e9, d2 = -1e9;
      for (int k = 0; k < 6; k++) {
        float a = 0.5235988 + float(k)*1.0471976;
        float d = dot(w.xy, vec2(cos(a), sin(a))) - uRadius*0.8660254;
        if (d > d1) { d2 = d1; d1 = d; } else if (d > d2) d2 = d;
      }
      float dz = abs(w.z) - uHalfH;
      if (dz > d1) { d2 = d1; d1 = dz; } else if (dz > d2) d2 = dz;
      float width = max(footprint*1.5, uRadius*0.014);
      float line = exp(-pow((d1 - d2)/width, 2.0))*step(-width*3.0, d1);
      edgeAmt += line*(side == 0 ? 1.0 : 0.42);
    }
    col += edgeAmt*smoothstep(0.35, 0.95, uMorph)*(uKeyCol*(0.24 + 0.45*max(-nv.x + nv.y, 0.0)) + uRimCol*0.55*max(nv.x - nv.y*0.4, 0.0));
    // faint hexagonal growth ribs on the basal faces, seen on both
    float ribs = 0.0;
    for (int side = 0; side < 2; side++) {
      vec3 w = side == 0 ? p : q;
      if (abs(abs(w.z) - uHalfH) < max(footprint*4.0, uRadius*0.03)) {
        float hx = max(abs(w.y), max(abs(dot(w.xy, vec2(0.8660254, 0.5))), abs(dot(w.xy, vec2(0.8660254, -0.5)))))/(uRadius*0.8660254);
        float wid = max(footprint/uRadius*1.4, 0.010);
        ribs += (exp(-pow((hx - 0.74)/wid, 2.0)) + 0.7*exp(-pow((hx - 0.48)/wid, 2.0)) + 0.4*exp(-pow((hx - 0.27)/wid, 2.0)))*(side == 0 ? 1.0 : 0.5);
      }
    }
    col += ribs*smoothstep(0.6, 1.0, uMorph)*(uKeyCol*0.11 + uRimCol*0.04)*(0.25 + 1.5*vnoise(p/uRadius*5.0));
  }
  col += glints(p*0.35/max(uRadius, 1e-5)*0.1, nv, V, 150.0, footprint*0.035/max(uRadius,1e-5))*smoothstep(0.5, 1.0, uMorph)*0.5;
  col *= uBright;
  vec4 clip = uProjI*pv;
  gl_FragDepth = clip.z/clip.w*0.5 + 0.5;
  outColor = vec4(max(col, vec3(0.0)), cover*uOpacity);
}`;

function makePrismMesh(shared) {
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: ICE_VERT, fragmentShader: PRISM_FRAG,
    uniforms: iceUniforms(shared, {
      uCamLocal: { value: new THREE.Vector3() }, uRadius: { value: 0.02 }, uHalfH: { value: 0.01 }, uMorph: { value: 1 },
      uSphereR: { value: 0.01 }, uFrost: { value: 0 }, uFront: { value: 2 }, uFrontDir: { value: new THREE.Vector3(-0.6, 0.5, 0.62).normalize() },
      uBright: { value: 1 },
    }),
    transparent: true, depthWrite: true, side: THREE.BackSide, depthTest: true,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), mat);
  mesh.frustumCulled = false;
  const proxy = new THREE.Vector3(), inv = new THREE.Matrix4();
  // the proxy box is resized in the vertex stage to hug the body
  mat.uniforms.uBox = { value: new THREE.Vector3(1, 1, 1) };
  mat.vertexShader = `uniform vec3 uBox; out vec3 vLocal;
    void main(){ vLocal = position*uBox; gl_Position = projectionMatrix*modelViewMatrix*vec4(vLocal, 1.0); }`;
  mesh.onBeforeRender = (renderer, scene, camera) => {
    const u = mat.uniforms;
    u.uModelViewI.value.multiplyMatrices(camera.matrixWorldInverse, mesh.matrixWorld);
    u.uProjI.value.copy(camera.projectionMatrix);
    inv.copy(mesh.matrixWorld).invert();
    u.uCamLocal.value.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inv);
    u.uPxAngle.value = 2 * Math.tan(camera.fov * D2R / 2) / shared.uRes.value.y;
    const r = Math.max(u.uRadius.value, u.uSphereR.value) * 1.25;
    u.uBox.value.set(r, r, Math.max(u.uHalfH.value, u.uSphereR.value) * 1.25);
    mat.uniformsNeedUpdate = true;
  };
  return mesh;
}

// Vapour molecules and haze streaming onto the growing ice. Positions are a
// closed-form function of time.
function makeVapour(shared, count) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  const rnd = makeRng(911);
  const A = new Float32Array(count * 4), B = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const z = rnd() * 2 - 1, th = rnd() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    A.set([s * Math.cos(th), s * Math.sin(th), z * 0.6, rnd()], i * 4);
    B.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  }
  geo.setAttribute('iA', new THREE.InstancedBufferAttribute(A, 4));
  geo.setAttribute('iB', new THREE.InstancedBufferAttribute(B, 4));
  geo.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uCentre: { value: new THREE.Vector3() }, uView: { value: 1 }, uSurface: { value: 0.1 }, uAmount: { value: 1 }, uUnitMM: { value: 1 }, uCol: { value: new THREE.Color(0.5, 0.75, 1) } },
    vertexShader: `
      in vec4 iA; in vec4 iB; uniform float uTime, uView, uSurface, uUnitMM; uniform vec3 uCentre;
      out vec2 vUv; out float vI;
      vec3 rotZ(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c*v.x - s*v.y, s*v.x + c*v.y, v.z); }
      vec3 place(float ph){
        float r0 = uView*(0.35 + 1.35*iB.x*iB.x + 0.2);
        float r = mix(r0, uSurface*(0.8 + 0.4*iB.y), pow(ph, 1.7));
        vec3 d = rotZ(normalize(iA.xyz), (1.0 - ph)*(1.5 + iB.z) + uTime*0.12);
        return d*r;
      }
      void main(){
        float ph = fract(uTime*(0.34 + 0.42*iB.w) + iA.w);
        vec3 p = place(ph), p2 = place(max(ph - 0.035, 0.0));
        vec4 c = modelViewMatrix*vec4(uCentre + p, 1.0), c2 = modelViewMatrix*vec4(uCentre + p2, 1.0);
        vec2 dir = c.xy - c2.xy; float L = length(dir); dir = L > 1e-7 ? dir/L : vec2(0.0, 1.0);
        float size = uView*uUnitMM*(0.0030 + 0.0100*iB.y*iB.y*iB.y*iB.y);
        c.xy += dir*position.y*(size + L*0.34) + vec2(-dir.y, dir.x)*position.x*size;
        c.xy -= dir*L*0.17;
        vUv = position.xy;
        vI = smoothstep(0.0, 0.25, ph)*smoothstep(1.0, 0.86, ph)*(0.25 + 0.75*iB.z)*sqrt(size/(size + L*0.55));
        gl_Position = projectionMatrix*c;
      }`,
    fragmentShader: `precision highp float; in vec2 vUv; in float vI; out vec4 o; uniform float uAmount; uniform vec3 uCol;
      void main(){ float a = exp(-dot(vUv, vUv)*3.2) - 0.04; if (a <= 0.0) discard; o = vec4(uCol*a*vI*uAmount, 1.0); }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}
