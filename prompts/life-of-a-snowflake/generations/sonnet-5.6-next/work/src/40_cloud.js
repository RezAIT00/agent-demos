// ---------------------------------------------------------------- cloud
const CLOUD_FRAG = `
uniform mat3 uBasis; uniform float uTan, uTime, uFall, uDensity, uBand, uBandAmt, uReveal, uWarmAmt;
uniform vec3 uTop, uBot, uMist, uWarm, uSunCol;
uniform sampler2D uValley; uniform float uValleyOn;
${GLSL_NOISE}
vec3 cloudColour(vec3 dir, vec2 sc){
  vec3 col = mix(uBot, uTop, smoothstep(-0.55, 0.6, dir.y + (fbm3(dir*2.1 + vec3(0.0, uFall*0.09, 0.0)) - 0.5)*0.55));
  // diffuse sun somewhere above, warm light leaking in low on the right
  float sun = max(dot(dir, normalize(vec3(-0.38, 0.52, -0.76))), 0.0);
  col += uSunCol*(pow(sun, 7.0)*0.55 + pow(sun, 38.0)*0.45);
  float warm = max(dot(dir, normalize(vec3(0.80, -0.30, -0.52))), 0.0);
  col += uWarm*pow(warm, 6.0)*uWarmAmt;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    vec3 p = dir*(2.3 + fk*2.4) + vec3(uTime*0.045*(fk + 1.0), -uFall*(0.30 + 0.26*fk), fk*13.7 + uTime*0.03);
    vec3 warp = vec3(fbm3(p*0.8), fbm3(p*0.8 + 4.0), 0.0);
    float n = fbm3(p + warp*1.15);
    float a = smoothstep(0.44, 0.84, n)*uDensity*(0.78 - 0.18*fk);
    vec3 lit = uMist*(0.65 + 0.9*smoothstep(0.55, 0.9, fbm3(p*1.7 + vec3(0.0, 0.35, 0.0)))) + uSunCol*pow(sun, 3.0)*0.35 + uWarm*pow(warm, 3.0)*0.30*uWarmAmt;
    col = mix(col, lit, clamp(a, 0.0, 0.92));
    // soft shafts between the folds
    col *= 1.0 - 0.22*uDensity*smoothstep(0.52, 0.30, n)*(0.6 - 0.15*fk);
  }
  // a layer boundary sweeping upward as the crystal drops through it
  float wave = (fbm3(vec3(sc.x*1.6, uTime*0.22, 3.0)) - 0.5)*0.55;
  float d = sc.y + wave - uBand;
  float band = exp(-d*d*15.0)*uBandAmt;
  col = mix(col, uMist*1.55 + uSunCol*0.12, clamp(band*(0.45 + 0.7*fbm3(vec3(sc*3.4, uFall*0.4))), 0.0, 0.85));
  return col;
}
void main(){
  vec2 sc = vUv*2.0 - 1.0;
  vec3 dir = normalize(uBasis*vec3(sc*uTan, -1.0));
  vec3 col = cloudColour(dir, sc);
  if (uValleyOn > 0.5) {
    // falling out of the cloud base: the ceiling lifts and tears into wisps
    vec3 v = textureLod(uValley, vUv, 0.0).rgb;
    v *= mix(0.64, 1.02, smoothstep(0.12, 0.95, length(sc - vec2(0.0, 0.03))));
    float n1 = fbm3(vec3(sc.x*1.5, sc.y*2.3 - uFall*0.55, uTime*0.12));
    float n2 = fbm3(vec3(sc.x*4.2 + 8.0, sc.y*5.0 - uFall*1.1, uTime*0.2));
    float edge = mix(-2.15, 2.45, uReveal);
    float gone = smoothstep(-0.42, 0.42, edge - sc.y + (n1 - 0.5)*2.1 + (n2 - 0.5)*0.55);
    // wisps hanging below the base, and the lit fringe of the cloud
    float fringe = gone*(1.0 - gone)*4.0;
    vec3 c = mix(col, v, gone);
    c += fringe*(uMist*0.28 + uWarm*0.07);
    float wisp = smoothstep(0.58, 0.86, fbm3(vec3(sc.x*1.9 - uTime*0.15, sc.y*3.1 - uFall*0.8, 5.0)))*(1.0 - smoothstep(0.75, 1.0, uReveal));
    c = mix(c, uMist*1.2 + 0.01, wisp*0.5*gone);
    col = c;
  }
  outColor = vec4(col, 1.0);
}`;

function makeCloudPass() {
  return fsPass(CLOUD_FRAG, {
    uBasis: { value: new THREE.Matrix3() }, uTan: { value: 0.42 }, uTime: { value: 0 }, uFall: { value: 0 }, uDensity: { value: 0.6 },
    uBand: { value: -3 }, uBandAmt: { value: 0 }, uReveal: { value: 0 }, uWarmAmt: { value: 0.5 },
    uTop: { value: new THREE.Vector3() }, uBot: { value: new THREE.Vector3() }, uMist: { value: new THREE.Vector3() },
    uWarm: { value: new THREE.Vector3(0.5, 0.2, 0.08) }, uSunCol: { value: new THREE.Vector3(0.2, 0.3, 0.45) },
    uValley: { value: null }, uValleyOn: { value: 0 },
  });
}

// Out-of-focus droplets, ice motes and snow. One instanced quad each, placed in
// screen space with parallax, as a pure function of time.
function makeBokeh(count, seed, opts) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  const rnd = makeRng(seed);
  const A = new Float32Array(count * 4), B = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    A.set([rnd() * 2.7 - 1.35, rnd(), rnd(), rnd()], i * 4);
    B.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  }
  geo.setAttribute('iA', new THREE.InstancedBufferAttribute(A, 4));
  geo.setAttribute('iB', new THREE.InstancedBufferAttribute(B, 4));
  geo.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTravel: { value: 0 }, uTime: { value: 0 }, uAmount: { value: 1 }, uColA: { value: new THREE.Vector3(0.4, 0.6, 0.9) },
      uColB: { value: new THREE.Vector3(1.0, 0.6, 0.3) }, uSizeMin: { value: opts.sizeMin }, uSizeMax: { value: opts.sizeMax },
      uSoft: { value: opts.soft }, uSpeed: { value: opts.speed }, uClear: { value: opts.clear || 0 }, uZoom: { value: 1 },
    },
    vertexShader: `
      in vec4 iA; in vec4 iB; uniform float uTravel, uTime, uSizeMin, uSizeMax, uSpeed, uClear, uZoom;
      out vec2 vUv; out float vI; out float vHue; out float vSoftJ;
      void main(){
        float near = iA.z*iA.z;                       // 0 far .. 1 near
        float speed = uSpeed*(0.30 + 1.35*near)*(0.75 + 0.5*iB.w);
        float y = fract(iA.y + uTravel*speed)*2.9 - 1.45;
        float x = iA.x + 0.045*sin(uTime*(0.5 + iB.x) + iB.y*30.0) + 0.02*uTime*(iB.z - 0.45)*(0.4 + near);
        x = mod(x + 1.35, 2.7) - 1.35;
        vec2 c = vec2(x, y)*mix(1.0, uZoom, near*0.5);
        float size = mix(uSizeMin, uSizeMax, pow(iB.x, 2.6))*(0.45 + 1.1*near)*mix(1.0, uZoom, 0.4);
        float tw = 0.78 + 0.22*sin(uTime*(2.0 + 5.0*iB.y) + iB.z*40.0);
        float keep = mix(1.0, smoothstep(0.35, 0.95, length(c)), uClear);
        vUv = position.xy; vHue = iA.w; vSoftJ = iB.y;
        vI = (0.18 + 0.82*iB.z*iB.z)*tw*keep*(0.5 + 0.5*min(1.0, uSizeMin*2.5/size));
        gl_Position = vec4(c + position.xy*size, 0.0, 1.0);
      }`,
    fragmentShader: `precision highp float; in vec2 vUv; in float vI; in float vHue; in float vSoftJ; out vec4 o;
      uniform vec3 uColA, uColB; uniform float uAmount, uSoft;
      void main(){
        float a = atan(vUv.y, vUv.x);
        float seg = 6.2831853/9.0;
        float poly = cos(seg*0.5)/cos(mod(a + 0.3, seg) - seg*0.5);
        float r = length(vUv)/mix(1.0, poly, 0.45);
        float soft = clamp(uSoft*(0.55 + 0.9*vSoftJ), 0.03, 0.97);
        float disc = smoothstep(1.0, 1.0 - soft, r);
        if (disc <= 0.0) discard;
        float ring = 0.72 + 0.55*smoothstep(0.55, 0.92, r)*(1.0 - soft*0.7);
        vec3 col = mix(uColA, uColB, smoothstep(0.80, 0.86, vHue));
        o = vec4(col*disc*ring*vI*uAmount, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  return { mesh, mat, u: mat.uniforms, scene, render(renderer, target) { renderer.setRenderTarget(target); renderer.render(scene, fsqCam); } };
}
