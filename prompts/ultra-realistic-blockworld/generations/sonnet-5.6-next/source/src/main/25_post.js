// ================================================================ screen-space passes
const G_AO_FRAG = /* glsl */`
uniform sampler2D uDepth, uGN, uGM;
uniform mat4 uInvProj, uView, uProj;
uniform vec2 uRes;
uniform float uFrame, uRadius;
uniform int uSlices, uSteps;
${G_COMMON}
layout(location=0) out vec4 o;
vec3 viewAt(vec2 uv, float d){ vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
void main(){
  float d = textureLod(uDepth, vUv, 0.0).r;
  if (d >= 1.0) { o = vec4(1.0, 4000.0, 0.0, 1.0); return; }
  vec3 P = viewAt(vUv, d);
  ivec2 fp = ivec2(vUv * uRes);
  int flags = int(texelFetch(uGM, fp, 0).a * 255.0 + 0.5);
  if ((flags & 1) != 0 || -P.z > 120.0) { o = vec4(1.0, -P.z, 0.0, 1.0); return; }
  vec3 N = normalize(mat3(uView) * octDecode(texelFetch(uGN, fp, 0).xy));
  vec3 V = normalize(-P);
  float radius = uRadius * (1.0 + sat(-P.z / 60.0));
  float radPx = min(radius * uProj[1][1] * uRes.y * 0.5 / -P.z, uRes.y * 0.12);
  if (radPx < 2.0) { o = vec4(1.0, -P.z, 0.0, 1.0); return; }
  float n0 = ign(gl_FragCoord.xy, uFrame), n1 = ign(gl_FragCoord.yx + 31.0, uFrame + 7.0);
  float vis = 0.0;
  for (int s = 0; s < 4; s++) {
    if (s >= uSlices) break;
    float phi = (float(s) + n0) * PI / float(uSlices);
    vec2 om = vec2(cos(phi), sin(phi));
    vec3 dirV = vec3(om, 0.0);
    vec3 ortho = dirV - dot(dirV, V) * V;
    vec3 axis = normalize(cross(ortho, V));
    vec3 projN = N - axis * dot(N, axis);
    float lenN = length(projN);
    float sg = sign(dot(ortho, projN));
    float n = sg * acos(clamp(dot(projN, V) / max(lenN, 1e-4), -1.0, 1.0));
    float hs[2];
    for (int side = 0; side < 2; side++) {
      float ss = side == 0 ? -1.0 : 1.0;
      float lowCos = cos(n + ss * PI * 0.5);
      float hc = lowCos;
      for (int j = 0; j < 8; j++) {
        if (j >= uSteps) break;
        float t = (float(j) + n1) / float(uSteps); t = t * t + 1.5 / radPx;
        vec2 uv = vUv + om * ss * t * radPx / uRes;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) break;
        vec3 S = viewAt(uv, textureLod(uDepth, uv, 0.0).r);
        vec3 D = S - P; float len = length(D);
        float ch = dot(D, V) / max(len, 1e-4) - 0.015;
        float w = sat(1.6 - len / radius * 1.6);
        hc = max(hc, mix(lowCos, ch, w));
      }
      hs[side] = n + clamp(ss * acos(clamp(hc, -1.0, 1.0)) - n, -PI * 0.5, PI * 0.5);
    }
    vis += lenN * 0.25 * ((cos(n) + 2.0 * hs[0] * sin(n) - cos(2.0 * hs[0] - n)) + (cos(n) + 2.0 * hs[1] * sin(n) - cos(2.0 * hs[1] - n)));
  }
  vis = sat(vis / float(uSlices));
  o = vec4(pow(vis, 1.45), -P.z, 0.0, 1.0);
}`;
const G_AOBLUR_FRAG = /* glsl */`
uniform sampler2D uSrc; uniform vec2 uDir;
layout(location=0) out vec4 o;
void main(){
  vec2 c = textureLod(uSrc, vUv, 0.0).rg;
  float sum = c.r, w = 1.0;
  for (int i = -3; i <= 3; i++) {
    if (i == 0) continue;
    vec2 s = textureLod(uSrc, vUv + uDir * float(i), 0.0).rg;
    float k = exp(-abs(s.g - c.g) * 10.0 / (0.25 + c.g * 0.06)) * exp(-float(i * i) * 0.12);
    sum += s.r * k; w += k;
  }
  o = vec4(sum / w, c.g, 0.0, 1.0);
}`;

// glossy reflections + depth hand-over to the forward target
const G_SSR_FRAG = /* glsl */`
uniform sampler2D uScene, uOpaqueDepth, uGA, uGN, uGL, uGM, uSkyView, uAO;
uniform mat4 uInvViewProj, uViewProj;
uniform vec2 uNearFar;
uniform vec3 uCamPos, uBounce;
uniform float uFrame;
uniform int uSSRSteps, uAOon;
${G_COMMON}
${G_SH}
${G_SKY_SAMPLE}
${G_BRDF}
layout(location=0) out vec4 o;
float linZ(float d){ return 2.0 * uNearFar.x * uNearFar.y / (uNearFar.y + uNearFar.x - (d * 2.0 - 1.0) * (uNearFar.y - uNearFar.x)); }
void main(){
  ivec2 px = ivec2(gl_FragCoord.xy);
  float depth = texelFetch(uOpaqueDepth, px, 0).r;
  gl_FragDepth = depth;
  vec4 scene = texelFetch(uScene, px, 0);
  o = scene;
  if (uSSRSteps <= 0 || depth >= 1.0) return;
  vec4 gN = texelFetch(uGN, px, 0), gM = texelFetch(uGM, px, 0);
  float rough = clamp(gN.z, 0.025, 1.0);
  int flags = int(gM.a * 255.0 + 0.5);
  if (rough >= 0.36 || (flags & 1) != 0) return;
  vec4 gA = texelFetch(uGA, px, 0), gL = texelFetch(uGL, px, 0);
  vec4 w4 = uInvViewProj * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec3 wp = w4.xyz / w4.w;
  vec3 V = uCamPos - wp; float dist = length(V); V /= dist;
  vec3 N = octDecode(gN.xy);
  float metal = gN.w;
  vec3 albedo = gA.rgb * gA.rgb;
  int matClass = int(gM.g * 255.0 + 0.5) & 7;
  vec3 f0 = mix(vec3(0.038), albedo, metal);
  float nv = max(dot(N, V), 0.002);
  float aoAll = gA.a * (uAOon == 1 ? texture(uAO, vUv).r : 1.0);
  float skyVis = pow(sat(gL.a), 2.3);
  vec3 R = reflect(-V, N);
  float n0 = ign(gl_FragCoord.xy, uFrame), n1 = ign(gl_FragCoord.yx + 17.0, uFrame + 11.0), n2 = ign(gl_FragCoord.xy + 71.0, uFrame + 23.0);
  vec3 Rj = normalize(R + (vec3(n0, n1, n2) - 0.5) * rough * rough * 2.2);
  vec3 env = Rj.y > -0.08 ? skyRadiance(uSkyView, normalize(vec3(Rj.x, max(Rj.y, 0.015), Rj.z))) : uBounce;
  env = mix(env, shIrradiance(Rj), sat(rough * 1.25)) * skyVis;
  vec3 blockC = gL.rgb * gL.rgb;
  env += blockC * (0.35 + blockC * 0.65) * 0.9;
  vec4 hit = vec4(0.0);
  {
    vec3 origin = wp + N * (0.02 + dist * 0.002);
    float t = 0.06 + n0 * 0.1, stp = 0.17;
    vec3 prev = origin;
    for (int i = 0; i < 64; i++) {
      if (i >= uSSRSteps) break;
      vec3 p = origin + Rj * t;
      vec4 c = uViewProj * vec4(p, 1.0);
      if (c.w <= 0.1) break;
      vec2 uv = c.xy / c.w * 0.5 + 0.5;
      if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) break;
      float sd = textureLod(uOpaqueDepth, uv, 0.0).r;
      float diff = c.w - linZ(sd);
      if (sd < 1.0 && diff > 0.0 && diff < stp * 1.5 + 0.25) {
        vec3 a = prev, b = p; vec2 huv = uv;
        for (int k = 0; k < 5; k++) { vec3 m = (a + b) * 0.5; vec4 mc = uViewProj * vec4(m, 1.0); vec2 muv = mc.xy / mc.w * 0.5 + 0.5; if (mc.w - linZ(textureLod(uOpaqueDepth, muv, 0.0).r) > 0.0) { b = m; huv = muv; } else a = m; }
        vec2 e = smoothstep(vec2(0.0), vec2(0.08), huv) * smoothstep(vec2(0.0), vec2(0.08), 1.0 - huv);
        hit = vec4(textureLod(uScene, huv, 0.0).rgb, e.x * e.y);
        break;
      }
      prev = p; t += stp; stp *= 1.13;
    }
  }
  vec3 refl = mix(env, hit.rgb, hit.a * smoothstep(0.36, 0.2, rough));
  vec3 eb = envBRDF(f0, rough, nv);
  float so = sat(pow(nv + aoAll, exp2(-16.0 * rough - 1.0)) - 1.0 + aoAll);
  o.rgb += min(refl, vec3(60.0)) * eb * so * (matClass == 2 ? 0.45 : 1.0);
}`;

// shadowed volumetric haze: light shafts, mist, cave glow
const G_VOL_FRAG = /* glsl */`
uniform sampler2D uDepth, uNoiseTex;
uniform mat4 uInvViewProj;
uniform vec3 uCamPos, uSunDir, uLightDir, uLightColor, uWaterColor;
uniform float uTime, uFrame, uVolDensity, uVolMax, uForestHaze, uCaveHaze, uUnderwater, uFlash, uGlow;
uniform vec4 uPointPos[48], uPointCol[48];
uniform int uPointCount, uVolSteps;
uniform float uFogBase, uCamSky;
${G_COMMON}
${G_SH}
${G_CLOUD_COMMON}
${G_SHADOW_SAMPLE}
layout(location=0) out vec4 o;
float hg(float c, float g){ float g2 = g * g; return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
float shadowTap(vec3 p){
  if (uShadowOn < 0.5) return 1.0;
  for (int c = 0; c < 4; c++) {
    vec4 s = uShadowMat[c] * vec4(p, 1.0);
    if (s.x < 0.01 || s.y < 0.01 || s.x > 0.99 || s.y > 0.99) continue;
    if (s.z >= 1.0) return 1.0;
    return step(s.z - 0.12 / uCascadeDepth[c], shadowFetch(c, s.xy));
  }
  return 1.0;
}
void main(){
  float d = textureLod(uDepth, vUv, 0.0).r;
  vec4 w = uInvViewProj * vec4(vUv * 2.0 - 1.0, min(d, 0.9999999) * 2.0 - 1.0, 1.0);
  vec3 wp = w.xyz / w.w;
  vec3 rd = wp - uCamPos; float sceneDist = length(rd); rd /= sceneDist;
  if (d >= 1.0) sceneDist = 4000.0;
  float maxD = min(sceneDist, uUnderwater > 0.5 ? 36.0 : uVolMax);
  float noise = ign(gl_FragCoord.xy, uFrame);
  float cosT = dot(rd, uLightDir);
  float phase = mix(hg(cosT, 0.66), hg(cosT, -0.1), 0.22) + 0.012;
  vec3 amb = shIrradiance(vec3(0.0, 1.0, 0.0)) * 0.5 * uCamSky + vec3(0.0006, 0.0008, 0.0012);
  float cshadow = cloudShadowAt(uCamPos + rd * maxD * 0.4, uLightDir);
  vec3 L = vec3(0.0); float T = 1.0;
  float prev = 0.0;
  for (int i = 0; i < 64; i++) {
    if (i >= uVolSteps) break;
    float f = (float(i) + noise) / float(uVolSteps);
    float t = maxD * f * (0.35 + 0.65 * f);
    float ds = t - prev; prev = t;
    vec3 p = uCamPos + rd * t;
    float dens;
    if (uUnderwater > 0.5) dens = 0.022;
    else {
      float hf = exp(-max(p.y - uFogBase - 2.0, 0.0) * 0.07);
      float nz = textureLod(uNoiseTex, (p.xz + p.y * vec2(0.6, 0.35)) / 37.0 + uTime * vec2(0.009, 0.004), 0.0).b;
      float wisps = 0.35 + 1.3 * nz;
      dens = uVolDensity * (0.28 + hf * 0.95) * wisps + uForestHaze * wisps * exp(-max(p.y - uFogBase - 9.0, 0.0) * 0.055) + uCaveHaze * wisps;
    }
    float vis = shadowTap(p) * cshadow;
    vec3 inl = uLightColor * phase * vis * (1.0 - uCaveHaze * 0.0) + amb * 0.085;
    if (uUnderwater > 0.5) {
      float dw = max(${(SEA + 0.875).toFixed(3)} - p.y, 0.0);
      vec2 cu = p.xz + uLightDir.xz / max(uLightDir.y, 0.3) * dw;
      float c = min(textureLod(uNoiseTex, cu / 7.3 + uTime * vec2(0.021, 0.013), 0.0).g, textureLod(uNoiseTex, cu / 5.1 - uTime * vec2(0.017, 0.026), 0.0).g);
      float brk = textureLod(uNoiseTex, cu / 23.0 + uTime * 0.011, 0.0).a;
      inl = uLightColor * exp(-dw * vec3(0.2, 0.07, 0.05)) * (0.008 + c * 0.2 * smoothstep(0.3, 0.75, brk)) * vis * (0.4 + hg(cosT, 0.5) * 1.7) + uWaterColor * amb * 0.5;
      inl *= vec3(0.35, 0.95, 1.0);
    }
    inl += vec3(0.5, 0.58, 0.9) * uFlash * 0.1;
    float stp = 1.0 - exp(-dens * ds);
    L += T * inl * stp;
    T *= 1.0 - stp;
  }
  // analytic single-scattering around nearby lamps, lava and crystals
  if (uGlow > 0.0) for (int i = 0; i < 48; i++) {
    if (i >= uPointCount) break;
    if (uPointCol[i].a < -0.5) continue;
    vec3 oc = uCamPos - uPointPos[i].xyz; float R = uPointPos[i].w * 0.8;
    float b = dot(rd, oc); float c = dot(oc, oc);
    float h2 = max(c - b * b, 0.09);
    if (h2 > R * R) continue;
    float h = sqrt(h2);
    float lim = min(sceneDist, 90.0);
    float integ = (atan((lim + b) / h) - atan(b / h)) / h;
    float wnd = 1.0 - h2 / (R * R); wnd *= wnd;
    L += uPointCol[i].rgb * integ * wnd * uGlow;
  }
  o = vec4(L, T);
}`;

const G_COMPOSITE_FRAG = /* glsl */`
uniform sampler2D uScene, uDepth, uVol;
uniform mat4 uInvViewProj;
uniform vec3 uCamPos, uWaterColor, uLightColor;
uniform vec2 uVolRes, uNearFar;
uniform float uUnderwater, uCamSky;
${G_COMMON}
${G_SH}
layout(location=0) out vec4 o;
float linZ(float d){ return 2.0 * uNearFar.x * uNearFar.y / (uNearFar.y + uNearFar.x - (d * 2.0 - 1.0) * (uNearFar.y - uNearFar.x)); }
void main(){
  vec3 col = texelFetch(uScene, ivec2(gl_FragCoord.xy), 0).rgb;
  float d = texelFetch(uDepth, ivec2(gl_FragCoord.xy), 0).r;
  float z = min(linZ(d), 500.0);
  // depth-aware upsample of the half resolution haze
  vec2 hp = vUv * uVolRes - 0.5; vec2 base = floor(hp); vec2 f = hp - base;
  vec4 acc = vec4(0.0); float wsum = 0.0;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (base + vec2(i, j) + 0.5) / uVolRes;
    float zs = min(linZ(textureLod(uDepth, uv, 0.0).r), 500.0);
    float w = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y);
    w *= 1.0 / (0.02 + abs(zs - z) / max(z, 1.0) * 14.0);
    w += 1e-5;
    acc += textureLod(uVol, uv, 0.0) * w; wsum += w;
  }
  acc /= wsum;
  if (uUnderwater > 0.5) {
    vec4 wp = uInvViewProj * vec4(vUv * 2.0 - 1.0, min(d, 0.9999999) * 2.0 - 1.0, 1.0);
    float dist = d >= 1.0 ? 80.0 : length(wp.xyz / wp.w - uCamPos);
    vec3 tr = exp(-dist * vec3(0.125, 0.04, 0.031));
    vec3 fogC = uWaterColor * (shIrradiance(vec3(0.0, 1.0, 0.0)) * 1.1 + uLightColor * 0.09) * (0.25 + 0.75 * uCamSky);
    col = col * tr + fogC * (1.0 - tr);
  }
  o = vec4(col * acc.a + acc.rgb, 1.0);
}`;

const G_TAA_FRAG = /* glsl */`
uniform sampler2D uCurrent, uHistory, uDepth, uGM;
uniform mat4 uInvViewProj, uPrevViewProj, uCurViewProj;
uniform vec2 uRes;
uniform float uReset;
${G_COMMON}
layout(location=0) out vec4 o;
vec3 rgb2ycc(vec3 c){ return vec3(0.25*c.r + 0.5*c.g + 0.25*c.b, 0.5*c.r - 0.5*c.b, -0.25*c.r + 0.5*c.g - 0.25*c.b); }
vec3 ycc2rgb(vec3 c){ return vec3(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z); }
vec3 tm(vec3 c){ return c / (1.0 + max(c.r, max(c.g, c.b))); }
vec3 itm(vec3 c){ return c / max(1.0 - max(c.r, max(c.g, c.b)), 1e-4); }
vec3 catmull(sampler2D tex, vec2 uv){
  vec2 pos = uv * uRes; vec2 c = floor(pos - 0.5) + 0.5; vec2 f = pos - c;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f), w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2; vec2 t0 = (c - 1.0) / uRes, t3 = (c + 2.0) / uRes, t12 = (c + w2 / w12) / uRes;
  vec3 r = textureLod(tex, vec2(t12.x, t0.y), 0.0).rgb * (w12.x * w0.y) + textureLod(tex, vec2(t0.x, t12.y), 0.0).rgb * (w0.x * w12.y)
    + textureLod(tex, vec2(t12.x, t12.y), 0.0).rgb * (w12.x * w12.y) + textureLod(tex, vec2(t3.x, t12.y), 0.0).rgb * (w3.x * w12.y) + textureLod(tex, vec2(t12.x, t3.y), 0.0).rgb * (w12.x * w3.y);
  float ws = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
  return max(r / ws, vec3(0.0));
}
void main(){
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec3 cur = texelFetch(uCurrent, px, 0).rgb;
  vec3 m1 = vec3(0.0), m2 = vec3(0.0), mn = vec3(1e9), mx = vec3(-1e9);
  float closest = 1.0; ivec2 cpx = px;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 q = clamp(px + ivec2(i, j), ivec2(0), ivec2(uRes) - 1);
    vec3 c = rgb2ycc(tm(texelFetch(uCurrent, q, 0).rgb));
    m1 += c; m2 += c * c; mn = min(mn, c); mx = max(mx, c);
    float d = texelFetch(uDepth, q, 0).r; if (d < closest) { closest = d; cpx = q; }
  }
  if (uReset > 0.5) { o = vec4(cur, 1.0); return; }
  int flags = int(texelFetch(uGM, cpx, 0).a * 255.0 + 0.5);
  vec2 cuv = (vec2(cpx) + 0.5) / uRes;
  vec4 w = uInvViewProj * vec4(cuv * 2.0 - 1.0, closest * 2.0 - 1.0, 1.0);
  vec3 wp = w.xyz / w.w;
  vec4 pc = uPrevViewProj * vec4(wp, 1.0), cc = uCurViewProj * vec4(wp, 1.0);
  vec2 vel = (cc.xy / cc.w - pc.xy / pc.w) * 0.5;
  if ((flags & 1) != 0) vel = vec2(0.0);
  vec2 huv = vUv - vel;
  if (huv.x < 0.0 || huv.y < 0.0 || huv.x > 1.0 || huv.y > 1.0 || pc.w <= 0.0) { o = vec4(cur, 1.0); return; }
  vec3 hist = rgb2ycc(tm(catmull(uHistory, huv)));
  vec3 mean = m1 / 9.0, sd = sqrt(max(m2 / 9.0 - mean * mean, vec3(0.0)));
  vec3 lo = max(mean - sd * 1.3, mn), hi = min(mean + sd * 1.3, mx);
  vec3 center = (lo + hi) * 0.5, ext = (hi - lo) * 0.5 + 1e-4;
  vec3 diff = hist - center; vec3 un = abs(diff / ext); float mu = max(un.x, max(un.y, un.z));
  if (mu > 1.0) hist = center + diff / mu;
  float blend = 0.085;
  if ((flags & 2) != 0) blend = 0.2;
  if ((flags & 1) != 0) blend = 0.22;
  float vpx = length(vel * uRes);
  blend = mix(blend, 0.2, sat(vpx / 30.0));
  vec3 c = rgb2ycc(tm(cur));
  o = vec4(itm(max(ycc2rgb(mix(hist, c, blend)), vec3(0.0))), 1.0);
}`;

const G_LUM_FRAG = /* glsl */`
uniform sampler2D uSrc; layout(location=0) out vec4 o;
void main(){
  float s = 0.0, ws = 0.0;
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    vec2 uv = vUv + (vec2(i, j) - 1.5) / 256.0;
    vec3 c = textureLod(uSrc, uv, 0.0).rgb;
    float l = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.0006);
    vec2 p = (uv - vec2(0.5, 0.46)) * vec2(1.15, 1.35);
    float w = 0.28 + exp(-dot(p, p) * 5.0);
    s += log2(min(l, 14.0)) * w; ws += w;
  }
  o = vec4(s / 16.0, ws / 16.0, 0.0, 1.0);
}`;
const G_REDUCE_FRAG = /* glsl */`
uniform sampler2D uSrc; uniform int uFactor; layout(location=0) out vec4 o;
void main(){
  ivec2 base = ivec2(gl_FragCoord.xy) * uFactor; vec2 s = vec2(0.0);
  for (int j = 0; j < uFactor; j++) for (int i = 0; i < uFactor; i++) s += texelFetch(uSrc, base + ivec2(i, j), 0).rg;
  o = vec4(s / float(uFactor * uFactor), 0.0, 1.0);
}`;
const G_ADAPT_FRAG = /* glsl */`
uniform sampler2D uAvg, uPrev; uniform float uDt, uInstant, uComp, uMinExp, uMaxExp; layout(location=0) out vec4 o;
void main(){
  vec2 a = texelFetch(uAvg, ivec2(0), 0).rg;
  float L = exp2(a.x / max(a.y, 1e-4));
  // darker scenes keep a darker key so night and caves still read as dark
  float key = 0.17 * clamp(pow(L / 0.35, 0.2), 0.34, 1.35);
  float target = clamp(key / max(L, 1e-4), uMinExp, uMaxExp) * uComp;
  float prev = texelFetch(uPrev, ivec2(0), 0).r;
  float v = target;
  if (uInstant < 0.5 && prev > 0.0) { float rate = target > prev ? 0.9 : 2.4; v = exp(mix(log(prev), log(target), 1.0 - exp(-uDt * rate))); }
  o = vec4(v, L, 0.0, 1.0);
}`;

const G_DOWN_FRAG = /* glsl */`
uniform sampler2D uSrc; uniform vec2 uTexel; uniform int uFirst; layout(location=0) out vec4 o;
vec3 s(vec2 d){ return min(textureLod(uSrc, vUv + d * uTexel, 0.0).rgb, vec3(240.0)); }
float kw(vec3 c){ return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722)) * 0.25); }
void main(){
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2)), d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0)), g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2)), j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 g0 = (j + k + l + m) * 0.25, g1 = (a + b + d + e) * 0.25, g2 = (b + c + e + f) * 0.25, g3 = (d + e + g + h) * 0.25, g4 = (e + f + h + i) * 0.25;
  vec3 r;
  if (uFirst == 1) { float w0 = kw(g0) * 0.5, w1 = kw(g1) * 0.125, w2 = kw(g2) * 0.125, w3 = kw(g3) * 0.125, w4 = kw(g4) * 0.125; r = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4); }
  else r = g0 * 0.5 + (g1 + g2 + g3 + g4) * 0.125;
  o = vec4(max(r, vec3(0.0)), 1.0);
}`;
const G_UP_FRAG = /* glsl */`
uniform sampler2D uSrc, uBase; uniform vec2 uTexel; uniform float uScatter; layout(location=0) out vec4 o;
void main(){
  vec3 r = vec3(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) r += textureLod(uSrc, vUv + vec2(i, j) * uTexel, 0.0).rgb * float((2 - abs(i)) * (2 - abs(j)));
  r /= 16.0;
  o = vec4(mix(textureLod(uBase, vUv, 0.0).rgb, r, uScatter), 1.0);
}`;

const G_TONEMAP_FRAG = /* glsl */`
uniform sampler2D uScene, uBloom, uExposure, uDepth, uCloudTex;
uniform vec2 uRes, uSunUV;
uniform float uBloomAmt, uFlareAmt, uVignette, uCA, uExpScale, uSat, uContrast, uUnderwater, uTime;
uniform vec3 uTint, uLift, uSunFlareColor;
${G_COMMON}
layout(location=0) out vec4 o;
vec3 agxContrast(vec3 x){ vec3 x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; }
vec3 agx(vec3 v){
  const mat3 m = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051, 0.0784335999999992, 0.878468636469772, 0.0784336, 0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  const mat3 mi = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438, -0.0980208811401368, 1.15190312639708, -0.0980434501171241, -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  v = m * max(v, vec3(1e-10));
  v = clamp(log2(v), -12.47393, 4.026069);
  v = (v + 12.47393) / 16.5;
  v = agxContrast(v);
  // punchy look in display space
  float l = dot(v, vec3(0.2126, 0.7152, 0.0722));
  v = pow(max(v, 0.0), vec3(1.28));
  float l2 = dot(v, vec3(0.2126, 0.7152, 0.0722));
  v = l2 + 1.17 * (v - l2);
  v = mi * v;
  return pow(max(v, vec3(0.0)), vec3(2.2));
}
vec3 toSrgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float sunVisibility(){
  if (uSunUV.x < -0.2 || uSunUV.x > 1.2 || uSunUV.y < -0.2 || uSunUV.y > 1.2) return 0.0;
  float v = 0.0;
  for (int i = 0; i < 16; i++) {
    float a = float(i) * 2.39996, r = sqrt((float(i) + 0.5) / 16.0) * 0.012;
    vec2 uv = uSunUV + vec2(cos(a) * uRes.y / uRes.x, sin(a)) * r;
    if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0) v += step(0.9999999, textureLod(uDepth, uv, 0.0).r) * textureLod(uCloudTex, uv, 0.0).a;
    else v += 0.5;
  }
  return v / 16.0;
}
void main(){
  vec2 uv = vUv;
  if (uUnderwater > 0.5) uv += vec2(sin(vUv.y * 31.0 + uTime * 2.1), cos(vUv.x * 27.0 + uTime * 1.7)) * 0.0016;
  vec2 cc = uv - 0.5;
  vec3 hdr;
  if (uCA > 0.0) {
    vec2 off = cc * dot(cc, cc) * uCA;
    hdr = vec3(textureLod(uScene, uv - off, 0.0).r, textureLod(uScene, uv, 0.0).g, textureLod(uScene, uv + off, 0.0).b);
  } else hdr = textureLod(uScene, uv, 0.0).rgb;
  vec3 bloom = textureLod(uBloom, uv, 0.0).rgb;
  hdr = mix(hdr, bloom, uBloomAmt);
  float exposure = texelFetch(uExposure, ivec2(0), 0).r * uExpScale;
  hdr *= exposure;
  if (uFlareAmt > 0.0) {
    float vis = sunVisibility();
    if (vis > 0.001) {
      vec2 asp = vec2(uRes.x / uRes.y, 1.0);
      vec2 d = (uv - uSunUV) * asp; float r = length(d);
      vec3 sc = uSunFlareColor * vis * uFlareAmt;
      float onscreen = smoothstep(0.75, 0.35, length(uSunUV - 0.5));
      vec3 f = sc * (exp(-r * 9.0) * 0.12 + exp(-r * 2.6) * 0.028);
      f += sc * exp(-abs(d.y) * 260.0) * exp(-abs(d.x) * 3.4) * 0.07;
      float ang = atan(d.y, d.x);
      f += sc * exp(-r * 13.0) * pow(abs(sin(ang * 6.0 + 0.4)), 18.0) * 0.1;
      vec2 axis = vec2(0.5) - uSunUV;
      for (int i = 0; i < 4; i++) {
        float k = i == 0 ? 0.55 : i == 1 ? 1.25 : i == 2 ? 1.62 : 2.05;
        float sz = i == 0 ? 0.028 : i == 1 ? 0.075 : i == 2 ? 0.036 : 0.12;
        vec2 gp = (uv - (uSunUV + axis * k)) * asp;
        float hex = max(abs(gp.x) * 0.866 + abs(gp.y) * 0.5, abs(gp.y));
        float disc = smoothstep(sz, sz * 0.82, hex) * (0.45 + 0.55 * smoothstep(0.3 * sz, sz, hex));
        vec3 tint = i == 0 ? vec3(0.9, 0.6, 0.35) : i == 1 ? vec3(0.35, 0.65, 0.55) : i == 2 ? vec3(0.45, 0.5, 0.95) : vec3(0.8, 0.45, 0.4);
        f += sc * tint * disc * 0.011 * onscreen;
      }
      hdr += f;
    }
  }
  float vig = 1.0 - uVignette * smoothstep(0.18, 0.86, length(cc * vec2(1.05, 1.18)));
  hdr *= vig;
  vec3 c = agx(hdr * 1.12);
  c *= uTint;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, uSat), 0.0);
  c = toSrgb(clamp(c, 0.0, 1.0));
  c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);
  c = c + uLift * (1.0 - c) * (1.0 - c);
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

// contrast-adaptive sharpening, film grain and dithering
const G_SHARPEN_FRAG = /* glsl */`
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uSharp, uGrain, uGrainSeed;
uniform int uDownsample;
${G_COMMON}
layout(location=0) out vec4 o;
vec3 fetch(vec2 uv){
  if (uDownsample == 1) {
    // tent-weighted 4x resolve for supersampled input
    vec2 t = uTexel * 0.5;
    return (textureLod(uSrc, uv + vec2(-t.x, -t.y), 0.0).rgb + textureLod(uSrc, uv + vec2(t.x, -t.y), 0.0).rgb + textureLod(uSrc, uv + vec2(-t.x, t.y), 0.0).rgb + textureLod(uSrc, uv + vec2(t.x, t.y), 0.0).rgb) * 0.25;
  }
  return textureLod(uSrc, uv, 0.0).rgb;
}
void main(){
  vec2 st = uTexel * (uDownsample == 1 ? 2.0 : 1.0);
  vec3 e = fetch(vUv);
  vec3 c = e;
  if (uSharp > 0.0) {
    vec3 b = fetch(vUv + vec2(0.0, -st.y)), d = fetch(vUv + vec2(-st.x, 0.0)), f = fetch(vUv + vec2(st.x, 0.0)), h = fetch(vUv + vec2(0.0, st.y));
    vec3 mn = min(e, min(min(b, d), min(f, h))), mx = max(e, max(max(b, d), max(f, h)));
    vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, 1e-3), 0.0, 1.0));
    vec3 w = amp * (-uSharp / 5.0);
    c = clamp((e + (b + d + f + h) * w) / (1.0 + 4.0 * w), 0.0, 1.0);
  }
  if (uGrain > 0.0) {
    float g = hash13(vec3(gl_FragCoord.xy, uGrainSeed)) + hash13(vec3(gl_FragCoord.yx, uGrainSeed + 7.7)) - 1.0;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c += g * uGrain * (1.0 - l * 0.7);
  }
  float dn = ign(gl_FragCoord.xy, uGrainSeed) - 0.5;
  o = vec4(c + dn / 255.0, 1.0);
}`;

const G_ACCUM_FRAG = /* glsl */`
uniform sampler2D uSrc; uniform float uWeightScale; layout(location=0) out vec4 o;
void main(){
  vec3 c = max(texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0).rgb, vec3(0.0));
  float w = uWeightScale / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722)) * 0.06);
  o = vec4(c * w, w);
}`;
const G_RESOLVE_FRAG = /* glsl */`
uniform sampler2D uSrc; layout(location=0) out vec4 o;
void main(){ vec4 a = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0); o = vec4(a.rgb / max(a.a, 1e-5), 1.0); }`;
const G_COPY_FRAG = 'uniform sampler2D uSrc; layout(location=0) out vec4 o; void main(){ o = textureLod(uSrc, vUv, 0.0); }';
