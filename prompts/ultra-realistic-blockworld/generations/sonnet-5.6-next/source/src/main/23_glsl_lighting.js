// ================================================================ shared lighting chunks + deferred resolve
const G_SHADOW_SAMPLE = /* glsl */`
uniform sampler2D uShadowMap;
uniform mat4 uShadowMat[4];
uniform vec4 uCascadeTexel, uCascadeDepth, uCascadeSize;
uniform float uShadowOn, uShadowTile;
uniform int uPcf;
vec2 vogel(int i, int n, float phi){ float r = sqrt((float(i) + 0.5) / float(n)); float a = float(i) * 2.39996323 + phi; return r * vec2(cos(a), sin(a)); }
float shadowFetch(int c, vec2 uv){
  uv = clamp(uv, vec2(uShadowTile), vec2(1.0 - uShadowTile));
  return textureLod(uShadowMap, (uv + vec2(float(c & 1), float(c >> 1))) * 0.5, 0.0).r;
}
// returns visibility of the key light; soft penumbra that widens with blocker distance
float sunShadow(vec3 wp, vec3 Ng, float noise, bool soft){
  if (uShadowOn < 0.5) return 1.0;
  for (int c = 0; c < 4; c++) {
    float texel = uCascadeTexel[c];
    vec3 p = wp + Ng * texel * 1.7 + uLightDir * texel * 0.9;
    vec4 s = uShadowMat[c] * vec4(p, 1.0);
    float margin = 0.012;
    if (s.x < margin || s.y < margin || s.x > 1.0 - margin || s.y > 1.0 - margin) continue;
    float edge = min(min(s.x, 1.0 - s.x), min(s.y, 1.0 - s.y));
    if (c < 3 && edge < 0.07 && noise > (edge - margin) / (0.07 - margin)) continue;
    if (s.z >= 1.0) return 1.0;
    float depthRange = uCascadeDepth[c], size = uCascadeSize[c];
    float zr = s.z - (texel * 0.75 + 0.015) / depthRange;
    float phi = noise * 6.2831;
    float radius = texel * 1.3;
    if (soft) {
      float search = clamp(texel * 7.0, 0.18, 0.75) / size;
      float zsum = 0.0, cnt = 0.0;
      for (int i = 0; i < 8; i++) { float z = shadowFetch(c, s.xy + vogel(i, 8, phi) * search); if (z < zr) { zsum += z; cnt += 1.0; } }
      if (cnt < 0.5) return 1.0;
      float pen = (zr - zsum / cnt) * depthRange * 0.017;
      radius = clamp(pen, texel * 0.85, 0.85);
    }
    float rUV = radius / size;
    float sum = 0.0; int n = soft ? uPcf : 4;
    for (int i = 0; i < 32; i++) { if (i >= n) break; sum += step(zr, shadowFetch(c, s.xy + vogel(i, n, phi + 1.3) * rUV)); }
    float v = sum / float(n);
    if (c == 3) v = mix(1.0, v, smoothstep(0.012, 0.08, edge));
    return v;
  }
  return 1.0;
}
`;

const G_BRDF = /* glsl */`
float D_GGX(float nh, float a){ float a2 = a * a; float d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI * d * d + 1e-7); }
float V_Smith(float nv, float nl, float a){ float a2 = a * a; float gv = nl * sqrt(nv * nv * (1.0 - a2) + a2), gw = nv * sqrt(nl * nl * (1.0 - a2) + a2); return 0.5 / max(gv + gw, 1e-4); }
vec3 F_Schlick(float vh, vec3 f0){ float f = pow(1.0 - vh, 5.0); return f0 + (1.0 - f0) * f; }
vec3 envBRDF(vec3 f0, float rough, float nv){
  vec4 r = rough * vec4(-1.0, -0.0275, -0.572, 0.022) + vec4(1.0, 0.0425, 1.04, -0.04);
  float a004 = min(r.x * r.x, exp2(-9.28 * nv)) * r.x + r.y;
  vec2 ab = vec2(-1.04, 1.04) * a004 + r.zw;
  return f0 * ab.x + ab.y * clamp(50.0 * f0.g, 0.0, 1.0);
}
`;

const G_FOG_FN = /* glsl */`
uniform float uFogDensity, uFogHeight, uFogBase, uHaze, uCamSky;
vec3 aerial(vec3 col, vec3 rd, float dist, float skyPix){
  float d = max(dist - 14.0, 0.0);
  float k = uFogHeight;
  float camH = max(uCamPos.y - uFogBase, -8.0);
  float dy = rd.y * k;
  float od = uFogDensity * exp(-camH * k) * (abs(dy) > 1e-5 ? (1.0 - exp(-d * dy)) / dy : d);
  od = clamp(od, 0.0, 12.0);
  float air = d * 0.00068 * exp(-max(uCamPos.y - ${SEA}.0, 0.0) * 0.004);
  vec3 T = exp(-(od * vec3(0.92, 0.98, 1.06) + air * vec3(0.42, 0.72, 1.18)));
  vec3 hzDir = normalize(vec3(rd.x, max(rd.y * 0.4, 0.0) + 0.028, rd.z));
  vec3 insc = skyRadiance(uSkyView, hzDir);
  float c = max(dot(rd, uSunDir), 0.0);
  insc += uLightColor * (pow(c, 10.0) * 0.022 + pow(c, 3.0) * 0.006) * uHaze * (1.0 - uStorm);
  float exposure = max(uCamSky, smoothstep(0.1, 0.7, skyPix));
  return col * T + insc * (1.0 - T) * exposure;
}
`;

const G_LIGHTING_FRAG = /* glsl */`
uniform sampler2D uGA, uGN, uGL, uGM, uDepth, uAO, uCloudTex, uNoiseTex;
uniform sampler2D uSkyView;
uniform mat4 uInvViewProj, uVmInvViewProj, uViewProj;
uniform vec2 uNearFar;
uniform vec4 uPointPos[48], uPointCol[48];
uniform int uPointCount, uContactSteps, uSSRon, uAOon;
uniform vec3 uCamPos, uSunDir, uMoonDir, uLightDir, uLightColor, uBounce, uSunDisc;
uniform float uTime, uFrame, uNight, uFlash, uStarSpin, uPixelAngle, uUnderwater, uStarGain;
uniform vec3 uGalaxy;
uniform vec3 uFlashPos;
${G_COMMON}
${G_SH}
${G_SKY_SAMPLE}
${G_CLOUD_COMMON}
${G_SHADOW_SAMPLE}
${G_BRDF}
${G_FOG_FN}
layout(location=0) out vec4 oColor;

float linZ(float d){ return 2.0 * uNearFar.x * uNearFar.y / (uNearFar.y + uNearFar.x - (d * 2.0 - 1.0) * (uNearFar.y - uNearFar.x)); }

uniform sampler2D uFarHeight;
uniform vec4 uFarInfo;   // world origin x, z, extent, enabled
float horizonShadow(vec3 wp, float noise){
  if (uFarInfo.w < 0.5) return 1.0;
  vec2 flat_ = uLightDir.xz;
  float hl = length(flat_);
  if (hl < 0.05) return 1.0;
  flat_ /= hl;
  float rise = uLightDir.y / hl;
  float t = 10.0 + noise * 8.0, s = 1.0;
  for (int i = 0; i < 28; i++) {
    vec2 uv = (wp.xz + flat_ * t - uFarInfo.xy) / uFarInfo.z;
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) break;
    float h = textureLod(uFarHeight, uv, 0.0).r;
    float ray = wp.y + 2.5 + t * rise;
    s = min(s, clamp((ray - h) / (t * 0.025 + 3.0) + 0.5, 0.0, 1.0));
    if (s <= 0.0 || ray > 262.0) break;
    t += 9.0 + t * 0.13;
  }
  return s;
}

float contactShadow(vec3 wp, vec3 N, float dist, float noise){
  if (uContactSteps <= 0 || dist > 48.0) return 1.0;
  float len = clamp(dist * 0.028, 0.1, 0.6);
  for (int i = 0; i < 24; i++) {
    if (i >= uContactSteps) break;
    float t = (float(i) + noise) / float(uContactSteps);
    vec3 p = wp + N * (0.012 + dist * 0.0015) + uLightDir * (t * len);
    vec4 c = uViewProj * vec4(p, 1.0);
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) break;
    float d = textureLod(uDepth, uv, 0.0).r;
    float diff = c.w - linZ(d);
    if (diff > 0.018 + dist * 0.002 && diff < 0.24 + dist * 0.004) return mix(0.12, 1.0, t * t);
  }
  return 1.0;
}

vec3 starField(vec3 d){
  vec3 w0 = d;
  float cs = cos(uStarSpin), sn = sin(uStarSpin);
  vec3 axis = normalize(vec3(0.0, 0.55, 0.83));
  d = d * cs + cross(axis, d) * sn + axis * dot(axis, d) * (1.0 - cs);
  vec3 col = vec3(0.0);
  for (int l = 0; l < 3; l++) {
    float sc = l == 0 ? 74.0 : l == 1 ? 150.0 : 290.0;
    vec3 g = d * sc; vec3 cell = floor(g);
    vec3 h = hash33(cell + float(l) * 19.0);
    if (h.x < (l == 0 ? 0.016 : l == 1 ? 0.024 : 0.03)) {
      vec3 sp = normalize(cell + 0.2 + 0.6 * hash33(cell + 5.0));
      float ang = length(d - sp);
      float px = max(uPixelAngle * 0.72, 0.00055);
      float core = exp(-ang * ang / (px * px));
      float mag = pow(h.y, 6.0) * (l == 0 ? 1.35 : l == 1 ? 0.42 : 0.14) + (l == 0 ? 0.05 : 0.012);
      vec3 tint = mix(vec3(0.68, 0.78, 1.15), vec3(1.15, 0.9, 0.68), h.z);
      float tw = 0.86 + 0.14 * sin(uTime * (3.0 + h.z * 5.0) + h.y * 40.0);
      col += tint * core * mag * tw * 0.42;
    }
  }
  // the galaxy: a soft star cloud, brightest toward its core, split by long dust lanes and grained with faint stars
  vec3 gn = uGalaxy;
  float bb = dot(w0, gn);
  vec3 ga = normalize(cross(gn, vec3(0.0, 1.0, 0.0))), gb = cross(gn, ga);
  float lon = atan(dot(w0, gb), dot(w0, ga)) / 6.2831853;
  float wob = textureLod(uNoiseTex, vec2(lon * 3.0, bb * 0.9), 1.0).b - 0.5;
  float bw = bb + wob * 0.09;
  float core = exp(-bw * bw * 55.0), wide = exp(-bw * bw * 11.0);
  float bulge = exp(-pow(abs(fract(lon + 0.1) - 0.5) * 3.6, 2.0));
  float c1 = textureLod(uNoiseTex, vec2(lon * 5.0, bw * 2.6), 0.6).b, c2 = textureLod(uNoiseTex, vec2(lon * 9.0 + 0.31, bw * 4.4), 0.4).b;
  float clumps = smoothstep(0.3, 0.78, c1 * 0.62 + c2 * 0.45);
  float glow = core * (0.3 + 0.9 * clumps) * (0.55 + bulge * 1.1) + wide * 0.16;
  float lane = textureLod(uNoiseTex, vec2(lon * 6.0 + 0.57, (bw + 0.006) * 7.5), 0.5).b * 0.7 + textureLod(uNoiseTex, vec2(lon * 13.0, bw * 13.0), 0.5).b * 0.4;
  float dust = smoothstep(0.52, 0.72, lane) * exp(-(bw + 0.015) * (bw + 0.015) * 170.0);
  glow *= 1.0 - dust * 0.78;
  col += mix(vec3(0.34, 0.43, 0.68), vec3(0.74, 0.58, 0.43), bulge * core) * glow * 0.021;
  vec3 cellG = floor(d * 560.0);
  float hs = hash13(cellG);
  float fine = step(0.9975 - (core * 0.03 + wide * 0.005) * (1.0 - dust * 0.8), hs);
  col += mix(vec3(0.7, 0.78, 1.0), vec3(1.0, 0.88, 0.7), hash13(cellG + 3.0)) * fine * (0.35 + hash13(cellG + 7.0)) * 0.034;
  return col;
}

vec3 skyColor(vec3 rd){
  vec3 col = skyRadiance(uSkyView, rd);
  float horizon = smoothstep(-0.03, 0.05, rd.y);
  float cs = dot(rd, uSunDir);
  float ang = acos(clamp(cs, -1.0, 1.0));
  const float SR = 0.0105;
  if (ang < SR * 1.15) {
    float x = ang / SR; float mu = sqrt(max(0.0, 1.0 - x * x));
    col += uSunDisc * (0.42 + 0.58 * mu) * smoothstep(1.08, 0.92, x) * horizon * (1.0 - uStorm);
  }
  col += uSunDisc * (exp(-ang * ang * 2600.0) * 0.012 + exp(-ang * 26.0) * 0.0016) * horizon * (1.0 - uStorm);
  float moonCover = 0.0;
  float cm = dot(rd, uMoonDir);
  const float MR = 0.0175;
  float am = acos(clamp(cm, -1.0, 1.0));
  if (am < MR * 1.1 && uNight > 0.01) {
    vec3 mx = normalize(cross(vec3(0.0, 1.0, 0.0), uMoonDir)), my = cross(uMoonDir, mx);
    vec2 p = vec2(dot(rd, mx), dot(rd, my)) / sin(MR);
    float r2 = dot(p, p);
    if (r2 < 1.0) {
      vec3 n = vec3(p, sqrt(1.0 - r2));
      float lit = smoothstep(-0.06, 0.3, dot(n, normalize(vec3(0.58, 0.24, 0.62))));
      float maria = texture(uNoiseTex, p * 0.23 + 0.5).b * 0.7 + texture(uNoiseTex, p * 0.57 + 0.2).a * 0.3;
      float craters = texture(uNoiseTex, p * 0.9).r;
      float alb = mix(0.52, 1.0, smoothstep(0.38, 0.62, maria)) * (0.9 + craters * 0.22);
      float limb = 0.62 + 0.38 * n.z;
      moonCover = smoothstep(1.0, 0.95, r2);
      col = mix(col, col + vec3(0.78, 0.8, 0.84) * alb * alb * limb * (lit * 0.5 + 0.008), moonCover * uNight * horizon);
    }
  }
  col += vec3(0.35, 0.45, 0.7) * (exp(-am * 38.0) * 0.016 + exp(-am * 9.0) * 0.004) * uNight * horizon * (1.0 - uStorm);
  if (uNight > 0.01) col += starField(rd) * uStarGain * uNight * smoothstep(-0.01, 0.16, rd.y) * (1.0 - moonCover) * (1.0 - uStorm);
  return col;
}

void main(){
  ivec2 px = ivec2(gl_FragCoord.xy);
  float depth = texelFetch(uDepth, px, 0).r;
  vec4 cl = texture(uCloudTex, vUv);
  float noise = ign(gl_FragCoord.xy, uFrame);
  if (depth >= 1.0) {
    vec4 f = uInvViewProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec3 rd = normalize(f.xyz / f.w - uCamPos);
    vec3 col = skyColor(rd);
    if (rd.y < -0.0004 && uCamPos.y > ${(SEA + 0.875).toFixed(3)} && uUnderwater < 0.5) {
      float tw = min((uCamPos.y - ${(SEA + 0.875).toFixed(3)}) / -rd.y, 9000.0);
      vec3 up = normalize(vec3(rd.x, max(-rd.y, 0.012), rd.z));
      float fres = 0.02 + 0.98 * pow(1.0 - sat(-rd.y), 5.0);
      vec3 sea = skyRadiance(uSkyView, up) * fres * 0.92 + vec3(0.004, 0.03, 0.045) * (shIrradiance(vec3(0.0, 1.0, 0.0)) * 1.4 + uLightColor * 0.1);
      col = aerial(sea, rd, tw, 1.0);
    }
    col = col * cl.a + cl.rgb;
    if (uCamSky < 0.999) col *= mix(0.15, 1.0, uCamSky);
    oColor = vec4(col, 1.0);
    return;
  }
  vec4 gA = texelFetch(uGA, px, 0), gN = texelFetch(uGN, px, 0), gL = texelFetch(uGL, px, 0), gM = texelFetch(uGM, px, 0);
  int flags = int(gM.a * 255.0 + 0.5);
  bool viewmodel = (flags & 1) != 0;
  vec4 wp4;
  if (viewmodel) { float z = (depth * 2.0 - 1.0 + 1.0) / 0.05 - 1.0; wp4 = uVmInvViewProj * vec4(vUv * 2.0 - 1.0, z, 1.0); }
  else wp4 = uInvViewProj * vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec3 wp = wp4.xyz / wp4.w;
  vec3 toCam = uCamPos - wp;
  float dist = length(toCam);
  vec3 V = toCam / dist;

  vec3 albedo = gA.rgb * gA.rgb;
  vec3 N = octDecode(gN.xy);
  float rough = clamp(gN.z, 0.025, 1.0), metal = gN.w;
  vec3 blockL = gL.rgb * gL.rgb;
  float sky = gL.a;
  float emis = gM.r * gM.r * 64.0;
  int packed_ = int(gM.g * 255.0 + 0.5);
  int matClass = packed_ & 7, face = packed_ >> 3;
  float extra = gM.b;
  bool submerged = (flags & 4) != 0;
  vec3 Ng = N;
  if (face < 6) Ng = face == 0 ? vec3(1,0,0) : face == 1 ? vec3(-1,0,0) : face == 2 ? vec3(0,1,0) : face == 3 ? vec3(0,-1,0) : face == 4 ? vec3(0,0,1) : vec3(0,0,-1);

  float ssao = (uAOon == 1 && !viewmodel) ? texture(uAO, vUv).r : 1.0;
  float ao = gA.a;
  float aoAll = ao * ssao;
  float skyVis = pow(sat(sky), 2.3);
  float nv = max(dot(N, V), 0.002);
  vec3 f0 = mix(vec3(matClass == 4 ? 0.028 : matClass == 5 ? 0.004 : 0.038), albedo, metal);
  vec3 diffCol = albedo * (1.0 - metal) * (matClass == 5 ? 0.14 : 1.0);
  float a = max(rough * rough, 0.002);

  // ---------- key light
  vec3 L = uLightDir;
  float nl = dot(N, L);
  float gate = smoothstep(0.02, 0.28, sky);
  float shadow = 0.0, softShadow = 0.0;
  bool foliage = matClass == 1;
  if (gate > 0.0 && max(uLightColor.r, uLightColor.b) > 0.001 && (nl > -0.05 || foliage || matClass == 2 || matClass == 3)) {
    shadow = sunShadow(wp + (foliage ? L * 0.07 : vec3(0.0)), foliage ? vec3(0.0) : Ng, noise, true) * gate;
    if (dist > 60.0 && uFarInfo.w > 0.5) {
      float hs = horizonShadow(wp, noise);
      shadow *= mix(1.0, hs, smoothstep(60.0, 150.0, dist));
      // far away the little shadows of each step give way to the shadow of the landform
      if (!foliage) shadow = mix(shadow, hs * gate * cloudShadowAt(wp, L), smoothstep(100.0, 240.0, dist) * 0.55);
    }
    softShadow = shadow;
    if (shadow > 0.01 && !viewmodel) shadow *= contactShadow(wp, Ng, dist, noise);
    if (shadow > 0.001) { float cs_ = cloudShadowAt(wp, L); shadow *= cs_; softShadow *= cs_; }
  }
  float micro = foliage ? 1.0 : extra;
  if (!foliage && face < 6) micro *= smoothstep(-0.08, 0.12, dot(Ng, L));
  float directVis = shadow * micro * mix(1.0, ao, 0.35);
  vec3 sunE = uLightColor;
  vec3 caustic = vec3(1.0);
  vec3 waterAtt = vec3(1.0);
  if (submerged || (uUnderwater > 0.5 && wp.y < ${(SEA + 0.875).toFixed(3)})) {
    float dw = max(${(SEA + 0.875).toFixed(3)} - wp.y, 0.0);
    waterAtt = exp(-dw * vec3(0.22, 0.075, 0.055));
    vec2 cu = wp.xz + L.xz / max(L.y, 0.3) * dw;
    float c1 = texture(uNoiseTex, cu / 7.3 + uTime * vec2(0.021, 0.013)).g, c2 = texture(uNoiseTex, cu / 5.1 - uTime * vec2(0.017, 0.026)).g;
    float web = min(c1, c2);
    caustic = vec3(0.45) + web * 3.6 * exp(-dw * 0.1) * vec3(0.9, 1.0, 0.95);
  }

  vec3 color = vec3(0.0);
  vec3 H = normalize(L + V);
  float nh = max(dot(N, H), 0.0), vh = max(dot(V, H), 0.0);
  if (directVis > 0.0005 || (foliage && softShadow > 0.0005)) {
    float nlc = max(nl, 0.0);
    vec3 F = F_Schlick(vh, f0);
    vec3 spec = min(F * D_GGX(nh, max(a, 0.012)) * V_Smith(nv, max(nlc, 0.001), max(a, 0.012)), vec3(14.0));
    if (foliage) {
      float wrap = sat((nl + 0.45) / 1.45);
      float back = pow(sat(dot(-V, L) * 0.5 + 0.5), 5.0) * 1.6 + sat(-nl) * 0.42 + 0.08;
      vec3 trCol = albedo * vec3(1.5, 1.65, 0.55) + albedo.g * vec3(0.05, 0.07, 0.0);
      color += diffCol / PI * sunE * wrap * directVis * caustic * waterAtt * 0.95;
      color += trCol / PI * sunE * back * extra * mix(softShadow, shadow, 0.5) * (0.4 + 0.6 * ao) * caustic * waterAtt;
      color += spec * sunE * nlc * directVis * 0.5;
    } else if (matClass == 2) {
      float wrap = sat((nl + 0.28) / 1.28);
      color += diffCol / PI * sunE * mix(wrap, nlc, 0.5) * directVis;
      color += diffCol / PI * sunE * vec3(0.14, 0.2, 0.3) * sat(0.5 - nl) * shadow * 0.45;
      color += spec * sunE * nlc * directVis;
    } else if (matClass == 3) {
      float wrap = sat((nl + 0.4) / 1.4);
      color += diffCol / PI * sunE * wrap * directVis;
      color += albedo / PI * sunE * pow(1.0 - nv, 3.0) * sat(dot(-V, L) + 0.55) * softShadow * 0.9;
      color += spec * sunE * nlc * directVis * 0.35;
    } else {
      color += (diffCol / PI * (1.0 - F) + spec) * sunE * nlc * directVis * caustic * waterAtt;
    }
  }

  // ---------- sky + bounced light (voxel sky visibility keeps caves dark)
  vec3 irr = shIrradiance(N);
  if (foliage) irr = mix(irr, shIrradiance(vec3(0.0, 1.0, 0.0)), 0.35) + shIrradiance(-N) * vec3(0.3, 0.36, 0.14);
  vec3 bounce = uBounce * (0.2 + 0.42 * sat(0.6 - N.y * 0.6)) * (0.35 + 0.65 * softShadow);
  vec3 ambient = (irr + bounce) * skyVis * waterAtt;
  ambient += vec3(0.0011, 0.0014, 0.0022);
  if (uFlash > 0.001) {
    vec3 fd = normalize(uFlashPos - wp);
    ambient += vec3(0.55, 0.62, 0.95) * uFlash * skyVis * (0.35 + 1.4 * sat(dot(N, fd)));
  }
  color += diffCol * ambient * aoAll * (matClass == 2 ? vec3(0.98, 1.0, 1.05) : vec3(1.0));

  // ---------- propagated block light (warm torches, orange lava, cold crystals)
  float flick = 1.0 + (sin(uTime * 11.3 + wp.x * 0.9) * sin(uTime * 7.1 + wp.z * 1.1) * 0.055 + sin(uTime * 23.0 + wp.y * 2.3 + wp.x) * 0.028) * step(blockL.b, blockL.r);
  vec3 bli = blockL * (0.35 + blockL * 0.65) * 1.05 * flick;
  bli = mix(vec3(luma(bli)), bli, 0.66);
  color += (diffCol + albedo * metal * 0.35) * bli * aoAll;

  // ---------- dynamic point lights: directional shading for nearby emitters, gated by voxel light so they cannot leak
  float lgate = smoothstep(0.0, 0.16, max(max(blockL.r, blockL.g), blockL.b)) ;
  if (viewmodel) lgate = 1.0;
  for (int i = 0; i < 48; i++) {
    if (i >= uPointCount) break;
    // carried lights are not tied to the voxel light field
    float lg = uPointCol[i].a > 0.5 ? lgate : 1.0;
    if (lg <= 0.0) continue;
    vec3 lv = uPointPos[i].xyz - wp;
    float R = uPointPos[i].w;
    float d2 = dot(lv, lv);
    if (d2 > R * R) continue;
    float d = sqrt(d2); vec3 l = lv / d;
    float x = d2 / (R * R);
    float att = pow(sat(1.0 - x * x), 2.0) / (d2 + 0.6);
    float ndl = dot(N, l);
    float diffW = foliage ? sat((ndl + 0.6) / 1.6) + sat(-ndl) * 0.35 : sat((ndl + 0.12) / 1.12);
    if (face < 6 && !foliage) diffW *= smoothstep(-0.22, 0.14, dot(Ng, l));
    vec3 h = normalize(l + V);
    vec3 F = F_Schlick(max(dot(V, h), 0.0), f0);
    vec3 spec = min(F * D_GGX(max(dot(N, h), 0.0), max(a, 0.03)) * V_Smith(nv, max(ndl, 0.001), max(a, 0.03)), vec3(8.0)) * max(ndl, 0.0);
    color += (diffCol / PI * diffW + spec) * uPointCol[i].rgb * att * lg * mix(1.0, aoAll, 0.5);
  }

  // ---------- image based specular (glossy surfaces are finished by the reflection pass)
  vec3 specAmb = vec3(0.0);
  if (!(uSSRon == 1 && rough < 0.36 && !viewmodel)) {
    vec3 R = reflect(-V, N);
    vec3 env = R.y > -0.08 ? skyRadiance(uSkyView, normalize(vec3(R.x, max(R.y, 0.015), R.z))) : uBounce;
    env = mix(env, shIrradiance(R), sat(rough * 1.25));
    float so = sat(pow(nv + aoAll, exp2(-16.0 * rough - 1.0)) - 1.0 + aoAll);
    vec3 eb = envBRDF(f0, rough, nv);
    specAmb = env * eb * skyVis * so * (matClass == 2 ? 0.45 : 0.85);
    specAmb += bli * eb * so * 0.7;
    if (foliage) specAmb *= 0.35;
  }
  color += specAmb;
  if (metal > 0.4) {
    // metals need a surrounding to mirror: a bright upper hemisphere and the local lamplight
    vec3 Rm = reflect(-V, N);
    float band = 0.3 + 0.7 * pow(sat(Rm.y * 0.5 + 0.55), 2.0) + 0.5 * pow(sat(dot(Rm, normalize(vec3(-0.4, 0.6, 0.7)))), 12.0);
    color += albedo * metal * (ambient * 0.9 + bli * 0.35 + uLightColor * 0.012 * skyVis) * band * aoAll;
  }

  // ---------- emission
  color += albedo * emis;

  // distant water is a mirror of the sky
  if (matClass == 6) {
    vec3 R = reflect(-V, N); R.y = abs(R.y);
    float fres = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
    color += skyRadiance(uSkyView, normalize(R)) * fres * 0.9;
  }

  if (!viewmodel) {
    vec3 rd = -V;
    if (uUnderwater < 0.5) color = aerial(color, rd, dist, sky);
  }
  color = color * (viewmodel ? 1.0 : cl.a) + (viewmodel ? vec3(0.0) : cl.rgb);
  oColor = vec4(color, 1.0);
}`;
