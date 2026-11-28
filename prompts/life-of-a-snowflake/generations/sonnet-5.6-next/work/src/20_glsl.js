// ---------------------------------------------------------------- shared GLSL
const GLSL_NOISE = `
float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float hash13(vec3 p3){ p3 = fract(p3*0.1031); p3 += dot(p3, p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
vec3 hash33(vec3 p){ p = fract(p*vec3(0.1031,0.1030,0.0973)); p += dot(p, p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash13(i+vec3(0,0,0)),hash13(i+vec3(1,0,0)),f.x), mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x), mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm3(vec3 p){ float a = 0.5, s = 0.0; for(int i=0;i<5;i++){ s += a*vnoise(p); p = p*2.03 + vec3(17.1, 9.2, 5.7); a *= 0.5; } return s; }
`;

// The studio the ice reflects. Lights live in view space so that the crystal is
// lit consistently as the camera turns from the cloud down onto the mitten.
const GLSL_ENV = `
uniform vec3 uEnvTop, uEnvMid, uEnvLow;
uniform vec3 uKeyCol, uRimCol;
uniform vec3 uSweepDir;
uniform float uSweep;
const vec3 L_KEY = vec3(-0.5560, 0.6178, 0.5560);
const vec3 L_RIM = vec3( 0.8430,-0.1686,-0.5110);
const vec3 L_BACK = vec3(-0.2287, 0.3287,-0.9163);
float panel(vec3 d, vec3 c, vec2 size, float soft){
  float z = dot(d,c); if(z <= 0.05) return 0.0;
  vec3 u = normalize(cross(vec3(0.0,1.0,0.0), c)); vec3 v = cross(c,u);
  vec2 q = abs(vec2(dot(d,u), dot(d,v))/z) - size;
  float sd = length(max(q,0.0)) + min(max(q.x,q.y),0.0);
  return 1.0 - smoothstep(-soft, soft, sd);
}
vec3 envMap(vec3 d){
  vec3 col = mix(uEnvLow, uEnvMid, smoothstep(-0.7, 0.1, d.y));
  col = mix(col, uEnvTop, smoothstep(0.05, 0.85, d.y));
  col += uKeyCol * 2.6 * panel(d, L_KEY, vec2(0.34,0.24), 0.10);
  col += uKeyCol * 5.0 * panel(d, normalize(vec3(-0.22,0.30,0.93)), vec2(0.045,0.30), 0.075);
  col += uKeyCol * 1.4 * panel(d, normalize(vec3(0.38,0.55,0.74)), vec2(0.28,0.05), 0.085);
  col += uRimCol * 4.2 * panel(d, L_RIM, vec2(0.12,0.75), 0.12);
  col += uRimCol * 1.7 * panel(d, normalize(vec3(0.62,-0.34,0.70)), vec2(0.22,0.06), 0.06);
  // dark-field backlight: nothing straight behind, a broken ring around it, so
  // only rays bent by a facet, rib or bevel pick up light
  {
    float cz = -d.z;
    float ring = smoothstep(0.985, 0.900, cz)*smoothstep(0.30, 0.62, cz);
    if (ring > 0.0) {
      vec2 az = d.xy/max(length(d.xy), 1e-4);
      float cold = pow(max(dot(az, vec2(-0.62, 0.78)), 0.0), 2.0) + 0.35*pow(max(dot(az, vec2(-0.35, -0.94)), 0.0), 6.0);
      float warm = pow(max(dot(az, vec2(0.93, -0.37)), 0.0), 3.0) + 0.30*pow(max(dot(az, vec2(0.45, 0.89)), 0.0), 8.0);
      col += ring*(uKeyCol*cold*3.4 + uRimCol*warm*4.6);
    }
  }
  col += vec3(0.35,0.55,0.85) * 1.1 * panel(d, normalize(vec3(-0.75,-0.45,0.48)), vec2(0.08,0.40), 0.08);
  // broad soft banks near the lens axis: tilted facets sweep through them
  col += uKeyCol * 0.85 * panel(d, normalize(vec3(0.30,0.33,0.89)), vec2(0.09,0.06), 0.13);
  col += uKeyCol * 0.55 * panel(d, normalize(vec3(-0.46,-0.16,0.87)), vec2(0.06,0.20), 0.12);
  col += uRimCol * 0.75 * panel(d, normalize(vec3(0.42,0.06,0.90)), vec2(0.035,0.22), 0.09);
  col += vec3(1.0,0.86,0.62) * uSweep * 7.0 * pow(max(dot(d,uSweepDir),0.0), 90.0);
  return col;
}
`;

const FSQ_VERT = `
out vec2 vUv;
void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fsqGeo = new THREE.BufferGeometry();
fsqGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
const fsqCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

function fsPass(frag, uniforms, opts) {
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: FSQ_VERT,
    fragmentShader: 'precision highp float;\nin vec2 vUv;\n' + (frag.includes('layout(location') ? '' : 'out vec4 outColor;\n') + frag,
    uniforms, depthTest: false, depthWrite: false, ...(opts || {}),
  });
  const mesh = new THREE.Mesh(fsqGeo, mat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  return {
    mat, u: mat.uniforms,
    render(renderer, target, clear) {
      renderer.setRenderTarget(target);
      if (clear) renderer.clear();
      renderer.render(scene, fsqCam);
    },
  };
}

function makeRT(w, h, opts) {
  const o = Object.assign({ type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false }, opts || {});
  return new THREE.WebGLRenderTarget(w, h, o);
}
