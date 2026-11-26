// ================================================================ water and glass (forward, on top of the resolved opaque image)
const G_WAVES = /* glsl */`
// four Gerstner waves; amplitude follows how open the water is
const vec4 WV[4] = vec4[4](vec4(0.92, 0.39, 14.0, 0.105), vec4(0.53, 0.85, 8.3, 0.062), vec4(-0.31, 0.95, 4.9, 0.034), vec4(0.99, -0.14, 2.9, 0.018));
vec3 gerstner(vec2 p, float amp, out vec3 normal, out float crest){
  vec3 off = vec3(0.0); vec3 n = vec3(0.0, 1.0, 0.0); crest = 0.0;
  p += vec2(sin(p.y * 0.093 + 1.7) + sin(p.y * 0.231 - p.x * 0.117), sin(p.x * 0.079) + sin(p.x * 0.197 + p.y * 0.141 + 2.1)) * 1.9;
  for (int i = 0; i < 4; i++) {
    vec2 d = normalize(WV[i].xy); float L = WV[i].z;
    float grp = 0.62 + 0.52 * sin(dot(p, vec2(-d.y, d.x)) * (0.9 / L) + float(i) * 2.3 + uTime * 0.17) * sin(dot(p, d) * (0.37 / L) - uTime * 0.21);
    float A = WV[i].w * amp * grp;
    float k = 6.2831853 / L, w = sqrt(9.81 * k) * 0.78;
    float ph = k * dot(d, p) - w * uTime + float(i) * 1.7;
    float c = cos(ph), s = sin(ph);
    off.y += A * s; off.xz += d * (0.55 * A * c);
    n.xz -= d * (k * A * c); n.y -= 0.55 * k * A * s;
    crest += s * WV[i].w;
  }
  normal = normalize(n); crest = crest / 0.219;
  return off;
}`;

const G_WATER_VERT = /* glsl */`
precision highp float;
in vec4 aNrm; in vec4 aInfo; in vec4 aLight; in vec4 aTint; in vec2 aUv;
out vec3 vWorld; out vec3 vBase; out vec3 vNormal; out vec4 vLight; out vec4 vData; out vec2 vUv; out float vAmp;
uniform float uTime, uStorm;
${G_WAVES}
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vBase = wp.xyz;
  float frac_ = position.y - floor(position.y);
  float ocean = aTint.z;
  float depth = aUv.x * 1.0;
  float amp = mix(0.16, 1.0, ocean) * smoothstep(0.5, 4.0, depth) * (1.0 + uStorm * 0.9);
  amp *= 1.0 - aTint.w * 0.7;
  // displacement dies away with distance so every level of detail meets seamlessly
  amp *= 1.0 - smoothstep(90.0, 170.0, length(wp.xz - cameraPosition.xz));
  vAmp = amp;
  if (frac_ > 0.05) { vec3 n; float c; vec3 o = gerstner(wp.xz, amp, n, c); wp.xyz += o; wp.y -= 0.02; }
  vWorld = wp.xyz; vNormal = aNrm.xyz; vLight = aLight; vData = aTint; vUv = aUv;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const G_FORWARD_COMMON = /* glsl */`
precision highp float; precision highp sampler2DArray; precision highp sampler3D;
uniform sampler2D uScene, uOpaqueDepth, uNoiseTex, uWaterNormals, uSkyView, uRainMap;
uniform mat4 uInvViewProj, uViewProj;
uniform vec2 uRes, uNearFar;
uniform vec3 uCamPos, uSunDir, uLightDir, uLightColor, uSunDisc;
uniform float uTime, uFrame, uRain, uUnderwater, uFlash, uNight;
#define WATER_PASS
uniform vec4 uRainMapInfo;
uniform vec3 uWaterColor;
uniform int uSSRSteps;
${G_COMMON}
${G_SH}
${G_SKY_SAMPLE}
${G_CLOUD_COMMON}
${G_SHADOW_SAMPLE}
${G_BRDF}
${G_FOG_FN}
float linZ(float d){ return 2.0 * uNearFar.x * uNearFar.y / (uNearFar.y + uNearFar.x - (d * 2.0 - 1.0) * (uNearFar.y - uNearFar.x)); }
vec3 worldAt(vec2 uv, float d){ vec4 w = uInvViewProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return w.xyz / w.w; }
vec3 skyReflect(vec3 R, vec3 from, float skyVis){
  vec3 col = skyRadiance(uSkyView, normalize(vec3(R.x, max(R.y, 0.012), R.z)));
  if (R.y > 0.02) {
    float t = (CB + 50.0 - from.y) / R.y;
    vec3 p = from + R * t;
    float d = cloudDensity(p, false) * 0.8 + cloudDensity(p + vec3(0.0, 55.0, 0.0), false) * 0.5;
    if (d > 0.001) {
      vec3 cc = uLightColor * 0.17 + shIrradiance(vec3(0.0, 1.0, 0.0)) * 0.95;
      col = mix(col, cc * (1.0 - uStorm * 0.55), sat(d * 2.4) * smoothstep(0.02, 0.12, R.y));
    }
  }
  return col * skyVis;
}
vec4 traceScreen(vec3 origin, vec3 R, float jitter){
  float t = 0.12 + jitter * 0.12, stp = 0.28;
  vec3 prev = origin;
  for (int i = 0; i < 64; i++) {
    if (i >= uSSRSteps) break;
    vec3 p = origin + R * t;
    vec4 c = uViewProj * vec4(p, 1.0);
    if (c.w <= 0.1) break;
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) break;
    float d = textureLod(uOpaqueDepth, uv, 0.0).r;
    float diff = c.w - linZ(d);
    if (d < 1.0 && diff > 0.0 && diff < stp * 1.6 + 0.4) {
      vec3 a = prev, b = p; vec2 huv = uv;
      for (int k = 0; k < 5; k++) {
        vec3 m = (a + b) * 0.5; vec4 mc = uViewProj * vec4(m, 1.0); vec2 muv = mc.xy / mc.w * 0.5 + 0.5;
        if (mc.w - linZ(textureLod(uOpaqueDepth, muv, 0.0).r) > 0.0) { b = m; huv = muv; } else a = m;
      }
      vec2 e = smoothstep(vec2(0.0), vec2(0.09), huv) * smoothstep(vec2(0.0), vec2(0.09), 1.0 - huv);
      return vec4(textureLod(uScene, huv, 0.0).rgb, e.x * e.y);
    }
    prev = p; t += stp; stp *= 1.14;
  }
  return vec4(0.0);
}
`;

const G_WATER_FRAG = /* glsl */`
${G_FORWARD_COMMON}
${G_WAVES}
#ifdef LOD_WATER
uniform sampler2D uLoadedMask;
uniform vec4 uMaskInfo, uHole;
#endif
in vec3 vWorld; in vec3 vBase; in vec3 vNormal; in vec4 vLight; in vec4 vData; in vec2 vUv; in float vAmp;
layout(location=0) out vec4 o;
vec2 waveNormal(vec2 p, float scale, vec2 flow, int set){
  vec2 uv = p / scale;
  float s1 = fract(uTime * 0.28), s2 = fract(uTime * 0.28 + 0.5);
  vec2 fl = flow * 2.6 / scale;
  vec4 a = texture(uWaterNormals, uv - fl * s1), b = texture(uWaterNormals, uv - fl * s2 + 0.47);
  vec4 v = mix(a, b, abs(1.0 - 2.0 * s1));
  return (set == 0 ? v.xy : v.zw) * 2.0 - 1.0;
}
void main(){
#ifdef LOD_WATER
  {
    vec2 cc = floor(vBase.xz / 16.0) - uMaskInfo.xy;
    if (uMaskInfo.w > 0.5 && cc.x >= 0.0 && cc.y >= 0.0 && cc.x < uMaskInfo.z && cc.y < uMaskInfo.z && texelFetch(uLoadedMask, ivec2(cc), 0).r > 0.5) discard;
    if (vBase.x > uHole.x && vBase.z > uHole.y && vBase.x < uHole.z && vBase.z < uHole.w) discard;
  }
#endif
  vec2 suv = gl_FragCoord.xy / uRes;
  vec3 toCam = uCamPos - vWorld; float dist = length(toCam); vec3 V = toCam / dist;
  vec2 flow = vData.xy * 2.0 - 1.0; float ocean = vData.z, shore = vData.w;
  if (abs(flow.x) < 0.02 && abs(flow.y) < 0.02) flow = vec2(0.0);
  bool top = vNormal.y > 0.5;
  float noise = ign(gl_FragCoord.xy, uFrame);
  float sky = vLight.a;
  float skyVis = pow(sat(sky), 1.6);
  vec3 N; float crest = 0.0;
  float detailFade = 1.0 / (1.0 + dist * 0.012);
  if (top) {
    vec3 gn; vec3 unused = gerstner(vBase.xz, vAmp, gn, crest);
    vec2 drift = flow * 0.0;
    vec2 p = vWorld.xz;
    float river = sat(length(flow));
    vec2 d1 = waveNormal(p + uTime * vec2(0.21, 0.12) * (1.0 - river), 6.3, flow, 0);
    vec2 d2 = waveNormal(p - uTime * vec2(0.14, 0.23) * (1.0 - river), 2.35, flow * 1.4, 1);
    vec2 d3 = (texture(uWaterNormals, p / 29.0 + uTime * vec2(0.008, 0.005)).xy * 2.0 - 1.0) + (texture(uWaterNormals, p.yx / 83.0 - uTime * vec2(0.004, 0.006)).zw * 2.0 - 1.0) * 0.9;
    float k = (0.12 + 0.1 * ocean + uRain * 0.08 + uStorm * 0.12 + river * 0.05);
    vec2 dd = (d1 * 1.0 + d2 * 0.55 * detailFade) * k * mix(0.55, 1.0, detailFade) + d3 * (0.09 + 0.1 * ocean) * ocean;
    N = normalize(vec3(gn.x + dd.x, gn.y, gn.z + dd.y));
    if (uRain > 0.01 && sky > 0.7 && dist < 40.0) {
      vec2 sum = vec2(0.0);
      vec2 q = p * 2.4; vec2 cell = floor(q);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 c = cell + vec2(i, j); vec2 h = hash22(c);
        float t = fract(uTime * (1.3 + h.x * 0.5) + h.y);
        vec2 dv = q - (c + 0.15 + h * 0.7); float r = length(dv);
        sum += dv / max(r, 0.001) * sin((r - t) * 24.0) * smoothstep(0.17, 0.0, abs(r - t)) * (1.0 - t) * (1.0 - t);
      }
      N = normalize(N + vec3(sum.x, 0.0, sum.y) * 0.5 * uRain * (1.0 - dist / 40.0));
    }
  } else N = normalize(vNormal);

  float depth0 = textureLod(uOpaqueDepth, suv, 0.0).r;
  vec3 bottom = worldAt(suv, depth0);
  float selfZ = linZ(gl_FragCoord.z);
  bool below = uCamPos.y < vWorld.y && top;

  if (below) {
    // looking up through the surface: Snell window with total internal reflection outside it
    vec3 Nd = -N; float cosI = max(dot(Nd, V), 0.0);
    vec3 refr = refract(-V, Nd, 1.333);
    vec3 deep = uWaterColor * (shIrradiance(vec3(0.0, 1.0, 0.0)) + uLightColor * 0.08) * (0.4 + 0.6 * skyVis);
    vec3 col;
    if (dot(refr, refr) < 0.001) col = deep * 1.2;
    else {
      vec3 above = textureLod(uScene, clamp(suv + N.xz * 0.05, 0.0, 1.0), 0.0).rgb;
      if (depth0 >= 1.0) above = skyReflect(normalize(refr), vWorld, 1.0);
      float f = 0.02 + 0.98 * pow(1.0 - max(dot(refr, N), 0.0), 5.0);
      col = mix(above * vec3(0.82, 0.96, 0.97), deep, f);
    }
    o = vec4(col, 1.0);
    return;
  }

  float thick = depth0 >= 1.0 ? 60.0 : max(length(bottom - uCamPos) - dist, 0.0);
  float vdepth = depth0 >= 1.0 ? 40.0 : max(vWorld.y - bottom.y, 0.0);
  vec2 ruv = suv + (top ? N.xz : vec2(N.x, 0.0)) * 0.055 * sat(thick * 0.35) / (1.0 + dist * 0.045);
  float rd_ = textureLod(uOpaqueDepth, ruv, 0.0).r;
  if (linZ(rd_) < selfZ) ruv = suv;
  else { vec3 b2 = worldAt(ruv, rd_); thick = rd_ >= 1.0 ? 60.0 : max(length(b2 - uCamPos) - dist, 0.0); }
  vec3 refrCol = textureLod(uScene, ruv, 0.0).rgb;
  vec3 ext = vec3(0.36, 0.083, 0.062) * mix(1.25, 1.5, ocean) + vec3(0.02) * (1.0 - ocean) + vec3(0.03, 0.045, 0.05) * ocean;
  float murk = 1.0 + smoothstep(25.0, 200.0, dist) * (1.2 + ocean * 1.8);
  vec3 trans = exp(-ext * (thick + vdepth * 0.75) * murk);
  float shadow = sunShadow(vWorld + vec3(0.0, 0.08, 0.0), vec3(0.0, 1.0, 0.0), noise, false) * cloudShadowAt(vWorld, uLightDir) * smoothstep(0.05, 0.3, sky);
  vec3 ambUp = shIrradiance(vec3(0.0, 1.0, 0.0)) * skyVis;
  vec3 keyN = mix(uLightColor, vec3(luma(uLightColor)) * vec3(0.78, 0.98, 1.18), 0.75);
  vec3 ambN = mix(ambUp, vec3(luma(ambUp)) * vec3(0.72, 0.98, 1.25), 0.6);
  vec3 scatterC = uWaterColor * (ambN * 1.5 + keyN * max(uLightDir.y, 0.0) * 0.17 * (0.35 + 0.65 * shadow)) + vec3(vLight.rgb) * 0.02;
  vec3 refracted = refrCol * trans + scatterC * (1.0 - trans);
  // light shining through wave crests
  float sss = pow(sat(dot(V, -vec3(uLightDir.x, 0.0, uLightDir.z))), 3.0) * sat(crest * 0.7 + 0.25) * ocean;
  refracted += vec3(0.0, 0.12, 0.1) * uLightColor * sss * 0.12 * shadow;

  float nv = max(dot(N, V), 0.001);
  float fres = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
  vec3 R = reflect(-V, N);
  if (top && R.y < 0.015) { R.y = 0.015 + (0.015 - R.y) * 0.4; R = normalize(R); }
  vec3 refl = skyReflect(R, vWorld, max(skyVis, uCamSky * 0.15));
  if (uSSRSteps > 0) { vec4 hit = traceScreen(vWorld, R, noise); refl = mix(refl, hit.rgb, hit.a); }
  refl += vec3(vLight.rgb) * 0.03;

  vec3 col = mix(refracted, refl, top ? fres : fres * 0.35);
  // sun glitter
  vec3 H = normalize(uLightDir + V);
  float rough = mix(0.055, 0.2, sat(dist / 420.0)) + uStorm * 0.1;
  float a = rough * rough;
  float spec = D_GGX(max(dot(N, H), 0.0), a) * V_Smith(nv, max(dot(N, uLightDir), 0.001), a) * (0.02 + 0.98 * pow(1.0 - max(dot(V, H), 0.0), 5.0));
  col += uLightColor * min(spec, 28.0) * max(dot(N, uLightDir), 0.0) * shadow * (top ? 1.0 : 0.2);

  // foam where water meets land and on storm crests
  if (top) {
    float f1 = texture(uNoiseTex, vWorld.xz / 3.1 + flow * uTime * 0.12 + uTime * vec2(0.011, 0.007)).r;
    float f2 = texture(uNoiseTex, vWorld.xz / 1.37 - flow * uTime * 0.2 - uTime * vec2(0.016, -0.01)).r;
    float pat = f1 * 0.65 + f2 * 0.5;
    float contact = 1.0 - smoothstep(0.02, 0.5, vdepth);
    float surge = sin(uTime * 1.25 - vdepth * 7.0 + texture(uNoiseTex, vWorld.xz / 13.0).b * 9.0) * 0.5 + 0.5;
    float band = (1.0 - smoothstep(0.2, 1.35, vdepth)) * surge * surge * (0.35 + 0.65 * ocean);
    float obstacle = smoothstep(0.62, 1.0, shore) * (0.28 + length(flow) * 0.5);
    float surfK = 0.06 + 0.94 * smoothstep(0.15, 0.8, ocean) + length(flow) * 0.12;
    float foam = sat((contact * 1.0 + band * 0.75 + obstacle * 0.55) * smoothstep(0.44, 0.92, pat) * 1.3 * surfK);
    foam = max(foam, smoothstep(0.55, 0.95, crest) * smoothstep(0.55, 0.9, pat) * ocean * (0.12 + uStorm * 0.7));
    foam *= smoothstep(130.0, 60.0, dist);
    vec3 foamC = vec3(0.62, 0.66, 0.68) * (ambUp + uLightColor * max(dot(N, uLightDir), 0.0) * shadow / PI) + vec3(vLight.rgb) * 0.4;
    col = mix(col, foamC, foam * 0.92);
  }
  // soft shoreline edge
  float edge = top ? smoothstep(0.0, 0.07, vdepth) : 1.0;
  col = mix(textureLod(uScene, suv, 0.0).rgb * 0.93, col, edge);
  col += uFlash * vec3(0.1, 0.12, 0.2) * fres;
  if (uUnderwater < 0.5) col = aerial(col, -V, dist, sky);
  o = vec4(col, 1.0);
}`;

const G_GLASS_FRAG = /* glsl */`
${G_FORWARD_COMMON}
uniform sampler2DArray uAlbedoArr, uNormalArr, uExtraArr;
in vec3 vWorld; in vec3 vNormal; in vec4 vLight; in vec4 vTint; in vec2 vUv;
flat in ivec4 vInfo;
layout(location=0) out vec4 o;
void main(){
  vec2 suv = gl_FragCoord.xy / uRes;
  vec3 toCam = uCamPos - vWorld; float dist = length(toCam); vec3 V = toCam / dist;
  vec3 Ng = normalize(vNormal); if (dot(Ng, V) < 0.0) Ng = -Ng;
  vec3 c3 = vec3(vUv, float(vInfo.y));
  vec4 alb = texture(uAlbedoArr, c3), nr = texture(uNormalArr, c3), ex = texture(uExtraArr, c3);
  vec3 T = abs(Ng.y) > 0.5 ? vec3(1,0,0) : normalize(cross(vec3(0,1,0), Ng)), Bt = cross(Ng, T);
  vec2 tn = nr.xy * 2.0 - 1.0;
  vec3 N = normalize(Ng + (T * tn.x + Bt * tn.y) * 0.55);
  float noise = ign(gl_FragCoord.xy, uFrame);
  vec3 behind = textureLod(uScene, suv + tn * 0.012 / (1.0 + dist * 0.15), 0.0).rgb * vec3(0.9, 0.965, 0.95);
  float nv = max(dot(N, V), 0.001);
  float fres = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
  vec3 R = reflect(-V, N);
  vec3 refl = skyReflect(R, vWorld, pow(sat(vLight.a), 2.0)) + vLight.rgb * vLight.rgb * 0.35;
  if (uSSRSteps > 0) { vec4 hit = traceScreen(vWorld, R, noise); refl = mix(refl, hit.rgb, hit.a); }
  vec3 col = mix(behind, refl, fres);
  vec3 lit = alb.rgb * (shIrradiance(N) * pow(sat(vLight.a), 2.2) + vLight.rgb * vLight.rgb * 1.4 + uLightColor * max(dot(N, uLightDir), 0.0) / PI * smoothstep(0.1, 0.5, vLight.a) * sunShadow(vWorld, Ng, noise, false));
  col = mix(col, lit, ex.a);
  vec3 H = normalize(uLightDir + V);
  col += uLightColor * min(D_GGX(max(dot(N, H), 0.0), 0.01) * 0.04, 30.0) * smoothstep(0.1, 0.5, vLight.a);
  if (uUnderwater < 0.5) col = aerial(col, -V, dist, vLight.a);
  o = vec4(col, 1.0);
}`;
