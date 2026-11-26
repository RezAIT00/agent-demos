// ================================================================ atmosphere (Hillaire-style LUTs), sun/moon, ambient SH, volumetric clouds
const G_ATMOS = /* glsl */`
const float RG = 6360.0, RT = 6460.0;
const vec3 RAY_S = vec3(5.802e-3, 13.558e-3, 33.1e-3);
const float MIE_S = 3.996e-3, MIE_A = 4.4e-3;
const vec3 OZO_A = vec3(0.650e-3, 1.881e-3, 0.085e-3);
void atmDensity(float h, out vec3 rayS, out float mieS, out vec3 ext){
  float dr = exp(-max(h, 0.0) / 8.0), dm = exp(-max(h, 0.0) / 1.2);
  float dz = max(0.0, 1.0 - abs(h - 25.0) / 15.0);
  rayS = RAY_S * dr; mieS = MIE_S * dm;
  ext = rayS + vec3((MIE_S + MIE_A) * dm) + OZO_A * dz;
}
float raySphere(vec3 o, vec3 d, float r){ // nearest positive hit, -1 if none
  float b = dot(o, d), c = dot(o, o) - r * r, disc = b * b - c;
  if (disc < 0.0) return -1.0;
  float s = sqrt(disc);
  if (-b - s > 0.0) return -b - s;
  return -b + s > 0.0 ? -b + s : -1.0;
}
vec2 transUV(float r, float mu){
  float H = sqrt(RT * RT - RG * RG), rho = sqrt(max(r * r - RG * RG, 0.0));
  float d = -r * mu + sqrt(max(r * r * (mu * mu - 1.0) + RT * RT, 0.0));
  float dmin = RT - r, dmax = rho + H;
  return vec2((d - dmin) / (dmax - dmin), rho / H);
}
float phaseRay(float c){ return 3.0 / (16.0 * 3.14159265) * (1.0 + c * c); }
float phaseMie(float c){ float g = 0.8, g2 = g * g; return 3.0 / (8.0 * 3.14159265) * ((1.0 - g2) * (1.0 + c * c)) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
`;
const G_SKY_SAMPLE = /* glsl */`
vec2 skyUV(vec3 d){
  float lat = asin(clamp(d.y, -1.0, 1.0));
  float v = 0.5 + 0.5 * sign(lat) * sqrt(abs(lat) / 1.5707963);
  float u = atan(d.z, d.x) / 6.2831853 + 0.5;
  return vec2(u, v);
}
vec3 skyRadiance(sampler2D lut, vec3 d){ return textureLod(lut, skyUV(d), 0.0).rgb; }
`;

const G_CLOUD_COMMON = /* glsl */`
uniform sampler3D uCloudNoise, uCloudDetail;
uniform float uCloudCover, uCloudDensity, uStorm;
uniform vec2 uCloudOffset;
const float CB = 336.0, CTOP = 585.0;
float rmp(float v, float a, float b, float c, float d){ return c + (v - a) * (d - c) / (b - a); }
float cloudWeather(vec2 xz){
  vec2 q = (xz + uCloudOffset) / 4300.0;
  float n = textureLod(uNoiseTex, q, 0.0).b * 0.7 + textureLod(uNoiseTex, q * 2.31 + 0.37, 1.0).b * 0.3;
  n = (n - 0.5) * 1.9 + 0.5;
  return clamp(smoothstep(1.0 - uCloudCover - 0.2, 1.0 - uCloudCover + 0.26, n), 0.0, 1.0);
}
vec2 xz_(vec3 p){ return p.xz; }
float cloudDensity(vec3 p, bool detail){
  float h = (p.y - CB) / (CTOP - CB);
  if (h <= 0.0 || h >= 1.0) return 0.0;
  float cov = cloudWeather(p.xz);
  if (uStorm > 0.0) {
    vec2 sq = (xz_(p) + uCloudOffset * 1.3) / 1500.0;
    float cell_ = smoothstep(0.34, 0.68, textureLod(uNoiseTex, sq, 0.0).b * 0.72 + textureLod(uNoiseTex, sq * 3.1 + 0.17, 0.0).a * 0.28);
    cov = max(cov, uStorm * (0.44 + 0.52 * cell_));
  }
  if (cov <= 0.001) return 0.0;
  vec3 q = vec3(p.x + uCloudOffset.x * 1.15, p.y, p.z + uCloudOffset.y * 1.15);
  vec4 b = textureLod(uCloudNoise, (q + (textureLod(uCloudDetail, q / 410.0, 0.0).rgb - 0.5) * 46.0) / 690.0, 0.0);
  float fbm = b.g * 0.625 + b.b * 0.25 + b.a * 0.125;
  float base = clamp(rmp(b.r, fbm - 1.0, 1.0, 0.0, 1.0), 0.0, 1.0);
  float topFall = mix(mix(0.42, 0.9, cov), 1.0, uStorm);
  float grad = smoothstep(0.0, 0.085, h) * (1.0 - smoothstep(topFall * 0.45, topFall, h));
  base *= grad;
  float d = clamp(rmp(base, 1.0 - cov * 0.82, 1.0, 0.0, 1.0), 0.0, 1.0) * mix(0.55, 1.0, cov);
  if (detail && d > 0.0) {
    vec3 dn = textureLod(uCloudDetail, (q + vec3(0.0, -uCloudOffset.x * 0.4, 0.0)) / 128.0, 0.0).rgb;
    float hf = dn.r * 0.625 + dn.g * 0.25 + dn.b * 0.125;
    float md = mix(hf, 1.0 - hf, clamp(h * 5.0, 0.0, 1.0));
    vec3 dn2 = textureLod(uCloudDetail, q / 47.0, 0.0).rgb;
    md = mix(md, dn2.r * 0.7 + dn2.g * 0.3, 0.28);
    d = clamp(rmp(d, md * 0.5 * (1.0 - uStorm * 0.4), 1.0, 0.0, 1.0), 0.0, 1.0);
  }
  return d * uCloudDensity;
}
float cloudShadowAt(vec3 wp, vec3 L){
  if (L.y < 0.03) return 1.0;
  float t = (CB + 55.0 - wp.y) / L.y;
  if (t < 0.0) return 1.0;
  vec3 p = wp + L * t;
  float d = cloudDensity(p, false) * 0.7 + cloudDensity(p + L * (60.0 / max(L.y, 0.25)), false) * 0.5;
  float s = exp(-d * 2.6);
  return mix(1.0, s, 0.85);
}
`;

const Sky = {
  init() {
    const lin = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.transRT = makeRT(256, 64, lin); this.msRT = makeRT(32, 32, lin);
    this.skyRT = makeRT(200, 112, Object.assign({}, lin, { wrapS: THREE.RepeatWrapping }));
    U.uSkyView.value = this.skyRT.texture;
    this.transPass = new FSPass(`${G_ATMOS}
      layout(location=0) out vec4 o;
      void main(){
        float H = sqrt(RT*RT - RG*RG); float rho = H * vUv.y; float r = sqrt(rho*rho + RG*RG);
        float dmin = RT - r, dmax = rho + H; float d = dmin + vUv.x * (dmax - dmin);
        float mu = d == 0.0 ? 1.0 : (H*H - rho*rho - d*d) / (2.0*r*d); mu = clamp(mu, -1.0, 1.0);
        vec3 od = vec3(0.0); float dt = d / 40.0;
        for (int i=0;i<40;i++){ float t = (float(i)+0.5)*dt; float h = sqrt(r*r + t*t + 2.0*r*mu*t) - RG; vec3 rs, ext; float ms; atmDensity(h, rs, ms, ext); od += ext*dt; }
        o = vec4(exp(-od), 1.0);
      }`, {});
    this.msPass = new FSPass(`${G_ATMOS}
      uniform sampler2D uTrans;
      layout(location=0) out vec4 o;
      void main(){
        float sunMu = vUv.x*2.0-1.0; float r = RG + 0.01 + vUv.y*(RT-RG-0.02);
        vec3 sunD = vec3(sqrt(max(0.0,1.0-sunMu*sunMu)), sunMu, 0.0);
        vec3 lum = vec3(0.0), fms = vec3(0.0);
        for (int a=0;a<8;a++) for (int b=0;b<8;b++){
          float ct = 1.0 - 2.0*(float(b)+0.5)/8.0; float st = sqrt(1.0-ct*ct); float ph = 6.2831853*(float(a)+0.5)/8.0;
          vec3 dir = vec3(st*cos(ph), ct, st*sin(ph)); vec3 ro = vec3(0.0, r, 0.0);
          float tG = raySphere(ro, dir, RG), tT = raySphere(ro, dir, RT); float tMax = tG > 0.0 ? tG : tT;
          vec3 T = vec3(1.0), L = vec3(0.0), F = vec3(0.0); float dt = tMax/20.0;
          for (int i=0;i<20;i++){
            vec3 p = ro + dir*(float(i)+0.5)*dt; float pr = length(p); float h = pr-RG; vec3 rs, ext; float ms; atmDensity(h, rs, ms, ext);
            vec3 sT = exp(-ext*dt); vec3 sc = rs + vec3(ms);
            float mu = dot(p/pr, sunD);
            vec3 trSun = texture(uTrans, transUV(pr, mu)).rgb * (raySphere(p, sunD, RG) > 0.0 ? 0.0 : 1.0);
            vec3 S = trSun * sc * (1.0/(4.0*3.14159265));
            L += T * (S - S*sT) / max(ext, vec3(1e-7)); F += T * (sc - sc*sT) / max(ext, vec3(1e-7)); T *= sT;
          }
          if (tG > 0.0) { vec3 p = ro + dir*tG; vec3 n = normalize(p); float mu = dot(n, sunD); L += T * texture(uTrans, transUV(RG, mu)).rgb * max(mu,0.0) * 0.22 / 3.14159265; }
          lum += L; fms += F;
        }
        lum /= 64.0; fms /= 64.0;
        o = vec4(lum / (vec3(1.0) - fms), 1.0);
      }`, { uTrans: { value: this.transRT.texture } });
    this.skyPass = new FSPass(`${G_ATMOS}
      uniform sampler2D uTrans, uMS;
      uniform vec3 uSunDir, uMoonDir, uMoonIllum; uniform float uSunIllum, uStorm, uAlt;
      layout(location=0) out vec4 o;
      void main(){
        float az = (vUv.x - 0.5) * 6.2831853;
        float vv = vUv.y*2.0 - 1.0; float lat = sign(vv) * vv*vv * 1.5707963;
        vec3 dir = vec3(cos(lat)*cos(az), sin(lat), cos(lat)*sin(az));
        vec3 ro = vec3(0.0, RG + uAlt, 0.0);
        float tG = raySphere(ro, dir, RG), tT = raySphere(ro, dir, RT); float tMax = tG > 0.0 ? tG : tT;
        vec3 T = vec3(1.0), L = vec3(0.0);
        float cS = dot(dir, uSunDir), cM = dot(dir, uMoonDir);
        float prev = 0.0;
        for (int i=0;i<32;i++){
          float f = (float(i)+1.0)/32.0; float tNew = f*f*tMax; float dt = tNew - prev; float t = prev + dt*0.5; prev = tNew;
          vec3 p = ro + dir*t; float pr = length(p); float h = pr - RG; vec3 rs, ext; float ms; atmDensity(h, rs, ms, ext);
          vec3 sT = exp(-ext*dt);
          vec3 up = p/pr;
          float muS = dot(up, uSunDir), muM = dot(up, uMoonDir);
          vec3 trS = texture(uTrans, transUV(pr, muS)).rgb * (raySphere(p, uSunDir, RG) > 0.0 ? 0.0 : 1.0);
          vec3 trM = texture(uTrans, transUV(pr, muM)).rgb * (raySphere(p, uMoonDir, RG) > 0.0 ? 0.0 : 1.0);
          vec3 msS = texture(uMS, vec2(muS*0.5+0.5, (pr-RG)/(RT-RG))).rgb;
          vec3 msM = texture(uMS, vec2(muM*0.5+0.5, (pr-RG)/(RT-RG))).rgb;
          vec3 S = uSunIllum * (trS * (rs*phaseRay(cS) + vec3(ms*phaseMie(cS))) + msS*(rs+vec3(ms)))
                 + uMoonIllum * (trM * (rs*phaseRay(cM) + vec3(ms*phaseMie(cM)*0.4)) + msM*(rs+vec3(ms)));
          L += T * (S - S*sT) / max(ext, vec3(1e-7)); T *= sT;
        }
        // airglow floor so the night sky is never pure black
        L += vec3(0.0011, 0.0019, 0.0042) * (1.0 + 0.6*pow(1.0 - abs(dir.y), 4.0));
        float g = dot(L, vec3(0.2126,0.7152,0.0722));
        L = mix(L, vec3(g*0.92, g*0.98, g*1.06) * mix(0.62, 0.34, smoothstep(0.0, 0.6, dir.y)), uStorm);
        o = vec4(L, 1.0);
      }`, { uTrans: { value: this.transRT.texture }, uMS: { value: this.msRT.texture }, uSunDir: U.uSunDir, uMoonDir: U.uMoonDir, uMoonIllum: U.uMoonIllum, uSunIllum: U.uSunIllum, uStorm: U.uStorm, uAlt: { value: 0.25 } });
    this.transPass.render(this.transRT);
    this.msPass.render(this.msRT);
    this.bakeCloudNoise();
    this._lastSH = null;
  },
  bakeCloudNoise() {
    const frag = `
      uniform float uSlice, uRes; uniform int uDetail;
      layout(location=0) out vec4 o;
      vec3 h33(vec3 p){ uvec3 q = uvec3(ivec3(p)) * uvec3(1597334673u, 3812015801u, 2798796415u); uint n = (q.x ^ q.y ^ q.z); uvec3 r = uvec3(n) * uvec3(1597334673u, 3812015801u, 2798796415u); return vec3(r) * (1.0/4294967295.0); }
      float worley(vec3 p, float f){ p *= f; vec3 i = floor(p), fr = fract(p); float d = 1.0; for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){ vec3 c = vec3(x,y,z); vec3 h = h33(mod(i+c, f)+7.0); vec3 r = c + h - fr; d = min(d, dot(r,r)); } return 1.0 - sqrt(d); }
      float grad(vec3 c, vec3 f, float per){ vec3 g = h33(mod(c, per)+31.0)*2.0-1.0; return dot(normalize(g), f); }
      float perlin(vec3 p, float f){ p *= f; vec3 i = floor(p), fr = fract(p); vec3 u = fr*fr*fr*(fr*(fr*6.0-15.0)+10.0);
        float a = grad(i, fr, f), b = grad(i+vec3(1,0,0), fr-vec3(1,0,0), f), c = grad(i+vec3(0,1,0), fr-vec3(0,1,0), f), d = grad(i+vec3(1,1,0), fr-vec3(1,1,0), f);
        float e = grad(i+vec3(0,0,1), fr-vec3(0,0,1), f), g = grad(i+vec3(1,0,1), fr-vec3(1,0,1), f), h = grad(i+vec3(0,1,1), fr-vec3(0,1,1), f), k = grad(i+vec3(1,1,1), fr-vec3(1,1,1), f);
        return mix(mix(mix(a,b,u.x), mix(c,d,u.x), u.y), mix(mix(e,g,u.x), mix(h,k,u.x), u.y), u.z); }
      void main(){
        vec3 p = vec3(vUv, (uSlice+0.5)/uRes);
        if (uDetail == 1) {
          float w1 = worley(p, 4.0), w2 = worley(p, 8.0), w3 = worley(p, 16.0);
          o = vec4(w1*0.65+w2*0.35, w2*0.65+w3*0.35, w3, 1.0);
        } else {
          float pf = 0.0, a = 1.0, nm = 0.0; float f = 4.0; for (int i=0;i<4;i++){ pf += a*perlin(p, f); nm += a; a *= 0.55; f *= 2.0; } pf = clamp(pf/nm*1.15 + 0.5, 0.0, 1.0);
          float w1 = worley(p, 4.0), w2 = worley(p, 8.0), w3 = worley(p, 14.0), w4 = worley(p, 24.0);
          float wf = w1*0.625 + w2*0.25 + w3*0.125;
          float pw = clamp(wf + (pf - 0.0) * (1.0 - wf), 0.0, 1.0);
          o = vec4(pw, w1*0.625+w2*0.25+w3*0.125, w2*0.625+w3*0.25+w4*0.125, w3*0.75+w4*0.25);
        }
      }`;
    const pass = new FSPass(frag, { uSlice: { value: 0 }, uRes: { value: 64 }, uDetail: { value: 0 } });
    const make = (res, detail) => {
      const t = new THREE.WebGL3DRenderTarget(res, res, res, { depthBuffer: false });
      t.texture.type = THREE.UnsignedByteType; t.texture.format = THREE.RGBAFormat;
      t.texture.minFilter = THREE.LinearFilter; t.texture.magFilter = THREE.LinearFilter;
      t.texture.wrapS = t.texture.wrapT = t.texture.wrapR = THREE.RepeatWrapping; t.texture.generateMipmaps = false;
      pass.u.uRes.value = res; pass.u.uDetail.value = detail;
      for (let z = 0; z < res; z++) { pass.u.uSlice.value = z; pass.render(t, z); }
      return t;
    };
    this.cloudNoiseRT = make(96, 0); this.cloudDetailRT = make(40, 1);
    U.uCloudNoise.value = this.cloudNoiseRT.texture; U.uCloudDetail.value = this.cloudDetailRT.texture;
  },
  // ---- CPU mirror of the atmosphere for sun colour and ambient light
  _ext(h, out) {
    const dr = Math.exp(-Math.max(h, 0) / 8), dm = Math.exp(-Math.max(h, 0) / 1.2), dz = Math.max(0, 1 - Math.abs(h - 25) / 15);
    out[0] = 5.802e-3 * dr + 8.396e-3 * dm + 0.65e-3 * dz; out[1] = 13.558e-3 * dr + 8.396e-3 * dm + 1.881e-3 * dz; out[2] = 33.1e-3 * dr + 8.396e-3 * dm + 0.085e-3 * dz;
    out[3] = dr; out[4] = dm;
    return out;
  },
  transmittance(alt, mu, steps = 24) {
    const r = 6360 + alt;
    if (mu < 0) { const disc = r * r * (mu * mu - 1) + 6360 * 6360; if (disc >= 0) return [0, 0, 0]; }
    const d = -r * mu + Math.sqrt(Math.max(r * r * (mu * mu - 1) + 6460 * 6460, 0));
    const od = [0, 0, 0], e = [0, 0, 0, 0, 0];
    let prev = 0;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps, tn = f * f * d, dt = tn - prev, t = prev + dt / 2; prev = tn;
      this._ext(Math.sqrt(r * r + t * t + 2 * r * mu * t) - 6360, e);
      od[0] += e[0] * dt; od[1] += e[1] * dt; od[2] += e[2] * dt;
    }
    return [Math.exp(-od[0]), Math.exp(-od[1]), Math.exp(-od[2])];
  },
  radiance(dir, lights) {
    const r = 6360.25, mu = dir[1];
    let tMax;
    const discG = r * r * (mu * mu - 1) + 6360 * 6360;
    if (mu < 0 && discG >= 0) tMax = -r * mu - Math.sqrt(discG);
    else tMax = -r * mu + Math.sqrt(r * r * (mu * mu - 1) + 6460 * 6460);
    const T = [1, 1, 1], L = [0, 0, 0], e = [0, 0, 0, 0, 0];
    let prev = 0;
    const STEPS = 10;
    for (let i = 1; i <= STEPS; i++) {
      const f = i / STEPS, tn = f * f * tMax, dt = tn - prev, t = prev + dt / 2; prev = tn;
      const px = dir[0] * t, py = r + dir[1] * t, pz = dir[2] * t, pr = Math.hypot(px, py, pz), h = pr - 6360;
      this._ext(h, e);
      const rs = [5.802e-3 * e[3], 13.558e-3 * e[3], 33.1e-3 * e[3]], ms = 3.996e-3 * e[4];
      for (const l of lights) {
        const ld = l.dir, cs = dir[0] * ld[0] + dir[1] * ld[1] + dir[2] * ld[2];
        const muS = (px * ld[0] + py * ld[1] + pz * ld[2]) / pr;
        const tr = this.transmittance(Math.max(h, 0), muS, 8);
        const pR = 0.0597 * (1 + cs * cs), g = 0.76, pM = 0.1194 * ((1 - g * g) * (1 + cs * cs)) / ((2 + g * g) * Math.pow(1 + g * g - 2 * g * cs, 1.5));
        const msTerm = 0.045 * clamp(muS + 0.25, 0, 1);
        for (let c = 0; c < 3; c++) {
          const S = l.E[c] * (tr[c] * (rs[c] * pR + ms * pM) + msTerm * (rs[c] + ms));
          L[c] += T[c] * S * (1 - Math.exp(-e[c] * dt)) / Math.max(e[c], 1e-7);
        }
      }
      for (let c = 0; c < 3; c++) T[c] *= Math.exp(-e[c] * dt);
    }
    L[0] += 0.0011; L[1] += 0.0019; L[2] += 0.0042;
    return L;
  },
  // set the clock: sun, moon, key light, ambient irradiance
  update(hours, groundAlbedo, force) {
    const a = (hours - 6) / 24 * Math.PI * 2;
    const sun = V3(Math.cos(a), Math.sin(a) * 0.9, Math.sin(a) * 0.36 + 0.12).normalize();
    const moon = V3(-Math.cos(a - 0.35), -Math.sin(a - 0.35) * 0.8 + 0.12, -0.42).normalize();
    U.uSunDir.value.copy(sun); U.uMoonDir.value.copy(moon);
    const E = U.uSunIllum.value;
    const storm = U.uStorm.value;
    const sunT = this.transmittance(0.25, Math.max(sun.y, -0.02));
    const sunFade = sstep(-0.045, 0.035, sun.y);
    const sunC = sunT.map((t) => t * E * sunFade * (1 - storm * 0.88));
    const night = sstep(0.08, -0.14, sun.y);
    U.uNight.value = night;
    const mE = [0.2, 0.27, 0.42].map((v) => v * (0.25 + 0.75 * night));
    U.uMoonIllum.value.set(mE[0] * 0.35, mE[1] * 0.35, mE[2] * 0.35);
    const moonFade = sstep(-0.02, 0.1, moon.y) * night;
    const moonC = [0.28 * moonFade * (1 - storm * 0.8), 0.39 * moonFade * (1 - storm * 0.8), 0.62 * moonFade * (1 - storm * 0.8)];
    const useSun = sunC[0] + sunC[1] > moonC[0] + moonC[1];
    U.uLightDir.value.copy(useSun ? sun : moon);
    if (U.uLightDir.value.y < 0.02) { U.uLightDir.value.y = 0.02; U.uLightDir.value.normalize(); }
    U.uLightColor.value.set(...(useSun ? sunC : moonC));
    const key = [sun.y.toFixed(3), a.toFixed(2), storm.toFixed(2), U.uCloudCover.value.toFixed(2)].join();
    if (key !== this._lastSH || force) {
      this._lastSH = key;
      this.computeSH(sun, moon, [E, E, E], mE.map((v) => v * 0.35), sunC, moonC, groundAlbedo || [0.13, 0.12, 0.07]);
    }
    this.sunY = sun.y;
  },
  computeSH(sun, moon, sunE, moonE, sunC, moonC, gAlb) {
    const lights = [];
    if (sun.y > -0.2) lights.push({ dir: [sun.x, sun.y, sun.z], E: sunE });
    if (sun.y < 0.1) lights.push({ dir: [moon.x, moon.y, moon.z], E: moonE });
    const coef = Array.from({ length: 9 }, () => [0, 0, 0]);
    const N = 40, storm = U.uStorm.value, cover = U.uCloudCover.value;
    const dW = (4 * Math.PI) / N;
    // upper hemisphere first, to derive the light arriving on the ground
    const samples = [];
    let skyE = [0, 0, 0];
    for (let i = 0; i < N; i++) {
      const y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), ph = i * 2.39996323;
      const d = [Math.cos(ph) * r, y, Math.sin(ph) * r];
      let L = null;
      if (y > 0) {
        L = this.radiance(d, lights);
        const g = 0.2126 * L[0] + 0.7152 * L[1] + 0.0722 * L[2];
        L = L.map((v, c) => lerp(v, g * [0.55, 0.6, 0.68][c], storm));
        // clouds brighten and neutralise the sky dome
        const cl = clamp((cover - 0.25) * 0.9, 0, 0.6) * (1 - storm);
        const cg = (sunC[0] + sunC[1] + sunC[2]) / 3 * 0.065 + g * 0.5;
        L = L.map((v) => lerp(v, cg, cl * 0.45));
        for (let c = 0; c < 3; c++) skyE[c] += L[c] * y * dW;
      }
      samples.push([d, L]);
    }
    const keyC = [sunC[0] * Math.max(sun.y, 0) + moonC[0] * Math.max(moon.y, 0), sunC[1] * Math.max(sun.y, 0) + moonC[1] * Math.max(moon.y, 0), sunC[2] * Math.max(sun.y, 0) + moonC[2] * Math.max(moon.y, 0)];
    const ground = [0, 1, 2].map((c) => gAlb[c] * (keyC[c] * 0.75 + skyE[c]) / Math.PI);
    for (const [d, Lsky] of samples) {
      const L = Lsky || ground;
      const [x, y, z] = d;
      const Y = [0.282095, 0.488603 * y, 0.488603 * z, 0.488603 * x, 1.092548 * x * y, 1.092548 * y * z, 0.315392 * (3 * z * z - 1), 1.092548 * x * z, 0.546274 * (x * x - y * y)];
      for (let k = 0; k < 9; k++) for (let c = 0; c < 3; c++) coef[k][c] += L[c] * Y[k] * dW;
    }
    const warm = sstep(0.42, 0.03, sun.y) * sstep(-0.06, 0.03, sun.y) * (1 - storm);
    if (warm > 0) for (let c = 0; c < 3; c++) coef[0][c] += sunC[c] * warm * 0.2;
    const A = [1, 2 / 3, 2 / 3, 2 / 3, 0.25, 0.25, 0.25, 0.25, 0.25];
    const Kc = [0.282095, 0.488603, 0.488603, 0.488603, 1.092548, 1.092548, 0.315392, 1.092548, 0.546274];
    for (let k = 0; k < 9; k++) U.uSH.value[k].set(coef[k][0] * A[k] * Kc[k], coef[k][1] * A[k] * Kc[k], coef[k][2] * A[k] * Kc[k]);
    U.uBounce.value.set(ground[0], ground[1], ground[2]);
    this.skyAvg = skyE.map((v) => v / Math.PI);
  },
  render(altitude) {
    this.skyPass.u.uAlt.value = Math.max(0.05, 0.12 + (altitude - SEA) / 1000);
    this.skyPass.render(this.skyRT);
  },
};
const G_SH = /* glsl */`
uniform vec3 uSH[9];
vec3 shIrradiance(vec3 n){
  vec3 r = uSH[0] + uSH[1]*n.y + uSH[2]*n.z + uSH[3]*n.x + uSH[4]*(n.x*n.y) + uSH[5]*(n.y*n.z) + uSH[6]*(3.0*n.z*n.z-1.0) + uSH[7]*(n.x*n.z) + uSH[8]*(n.x*n.x-n.y*n.y);
  return max(r, vec3(0.0));
}
`;

// ---------------------------------------------------------------- cloud raymarch pass
const G_CLOUD_FRAG = /* glsl */`
uniform sampler2D uNoiseTex, uSkyView, uDepth, uHistory;
uniform mat4 uInvViewProj, uPrevViewProj;
uniform vec3 uCamPos, uSunDir, uMoonDir, uLightDir, uLightColor, uFlashPos;
uniform float uFrame, uFlash, uHistoryWeight, uTime, uMaxDist;
uniform int uSteps;
${G_COMMON}
${G_SH}
${G_SKY_SAMPLE}
${G_CLOUD_COMMON}
layout(location=0) out vec4 o;
float hg(float c, float g){ float g2 = g*g; return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0*g*c, 1.5)); }
void main(){
  vec4 far = uInvViewProj * vec4(vUv*2.0-1.0, 1.0, 1.0);
  vec3 rd = normalize(far.xyz/far.w - uCamPos);
  float depth = texture(uDepth, vUv).r;
  float sceneDist = 1e9;
  if (depth < 1.0) { vec4 w = uInvViewProj * vec4(vUv*2.0-1.0, depth*2.0-1.0, 1.0); sceneDist = length(w.xyz/w.w - uCamPos); }
  o = vec4(0.0, 0.0, 0.0, 1.0);
  float t0, t1;
  if (uCamPos.y < CB) { if (rd.y <= 0.004) return; t0 = (CB - uCamPos.y)/rd.y; t1 = (CTOP - uCamPos.y)/rd.y; }
  else if (uCamPos.y > CTOP) { if (rd.y >= -0.004) return; t0 = (CTOP - uCamPos.y)/rd.y; t1 = (CB - uCamPos.y)/rd.y; }
  else { t0 = 0.0; t1 = rd.y > 0.004 ? (CTOP - uCamPos.y)/rd.y : rd.y < -0.004 ? (CB - uCamPos.y)/rd.y : 2000.0; }
  t1 = min(t1, min(sceneDist, uMaxDist));
  if (t0 >= t1) return;
  float len = min(t1 - t0, 2600.0);
  float jit = ign(gl_FragCoord.xy, uFrame);
  int N = int(float(uSteps) * clamp(len/700.0, 0.45, 1.0));
  float ds = len / float(N);
  float cosT = dot(rd, uLightDir);
  vec3 sunC = uLightColor;
  vec3 ambTop = shIrradiance(vec3(0.0, 1.0, 0.0)) * 1.15;
  vec3 ambBot = shIrradiance(vec3(0.0, -1.0, 0.0)) * 0.8 + ambTop * 0.32;
  vec3 S = vec3(0.0); float T = 1.0; float wDist = 0.0, wSum = 0.0;
  const float SIG = 0.085;
  float t = t0 + ds*jit;
  for (int i = 0; i < 96; i++) {
    if (i >= N || T < 0.012) break;
    vec3 p = uCamPos + rd*t;
    float d = cloudDensity(p, true);
    if (d > 0.002) {
      float od = 0.0; float st = 11.0; vec3 lp = p;
      for (int j = 0; j < 5; j++) { lp = p + uLightDir * (st * (0.55 + jit*0.25)); od += cloudDensity(lp, j < 2) * st * 0.62; st *= 1.9; }
      vec3 sun = vec3(0.0); float a = 1.0, b = 1.0, c = 1.0;
      for (int k = 0; k < 3; k++) { float ph = mix(hg(cosT, 0.78*c), hg(cosT, -0.18*c), 0.32) + 0.018; sun += vec3(a * ph * exp(-od * SIG * b)); a *= 0.52; b *= 0.34; c *= 0.55; }
      float h = clamp((p.y - CB)/(CTOP - CB), 0.0, 1.0);
      float powder = 1.0 - 0.72*exp(-d*7.0) * (1.0 - clamp(cosT*0.5+0.5, 0.0, 1.0));
      vec3 amb = mix(ambBot, ambTop, smoothstep(0.0, 0.85, h)) * (0.55 + 0.45*exp(-od*SIG*0.22));
      vec3 src = sunC * sun * 7.2 * powder * (1.0 - 0.62 * smoothstep(0.02, -0.12, uSunDir.y)) + amb * 0.92;
      if (uStorm > 0.0) {
        float cell2 = textureLod(uNoiseTex, (p.xz + uCloudOffset * 1.3) / 760.0, 0.0).b;
        src *= mix(1.0, mix(0.1, 0.62, smoothstep(0.0, 0.9, h)) * (0.35 + 1.5 * smoothstep(0.38, 0.66, cell2)), uStorm);
      }
      if (uFlash > 0.001) { vec3 df = p - uFlashPos; df.y *= 0.55; src += vec3(0.62, 0.68, 1.0) * uFlash * exp(-dot(df,df)/(190.0*190.0)) * 22.0; }
      float ext = d * SIG;
      float stepT = exp(-ext * ds);
      S += T * src * (1.0 - stepT);
      wDist += t * (1.0 - stepT) * T; wSum += (1.0 - stepT) * T;
      T *= stepT;
      t += ds;
    } else t += ds;
  }
  float alpha = 1.0 - T;
  if (alpha > 0.001) {
    float dist = wSum > 0.0 ? wDist/wSum : t0;
    // aerial perspective on the clouds themselves
    vec3 hz = skyRadiance(uSkyView, normalize(vec3(rd.x, max(rd.y, 0.035), rd.z)));
    float fog = 1.0 - exp(-max(dist - 250.0, 0.0) / mix(2700.0, 2400.0, uStorm));
    S = mix(S, hz * alpha, fog * 0.92);
    float fade = 1.0 - smoothstep(uMaxDist*0.62, uMaxDist, dist);
    S *= fade; T = 1.0 - alpha*fade;
  }
  o = vec4(S, T);
  if (uHistoryWeight > 0.001) {
    vec3 wp = uCamPos + rd * min(max(t0, 0.0) + 90.0, sceneDist);
    vec4 pc = uPrevViewProj * vec4(wp, 1.0);
    vec2 puv = pc.xy/pc.w*0.5+0.5;
    if (pc.w > 0.0 && all(greaterThan(puv, vec2(0.002))) && all(lessThan(puv, vec2(0.998)))) {
      vec4 h = texture(uHistory, puv);
      o = mix(o, h, uHistoryWeight);
    }
  }
}`;
