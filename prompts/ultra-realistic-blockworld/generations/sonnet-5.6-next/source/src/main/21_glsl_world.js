// ================================================================ world geometry shaders
const G_VOXEL_VERT = /* glsl */`
precision highp float;
in vec4 aNrm; in vec4 aInfo; in vec4 aLight; in vec4 aTint; in vec2 aUv;
out vec3 vWorld; out vec3 vNormal; out vec4 vLight; out vec4 vTint; out vec2 vUv;
flat out ivec4 vInfo;
${G_WIND}
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  ivec4 info = ivec4(aInfo + 0.5);
  if (aNrm.w > 0.004) wp.xyz += windSway(wp.xyz, aNrm.w, info.z);
  if (info.y == ${LAYER.lava} && position.y - floor(position.y) > 0.5) wp.y += sin(uTime * 1.1 + wp.x * 1.7 + wp.z * 1.3) * 0.025 - 0.01;
  vWorld = wp.xyz; vNormal = aNrm.xyz; vLight = aLight; vTint = aTint; vUv = aUv; vInfo = info;
  gl_Position = projectionMatrix * viewMatrix * wp;
#ifdef VIEWMODEL
  gl_Position.z = (gl_Position.z + gl_Position.w) * 0.05 - gl_Position.w;
#endif
}`;

const G_SURFACE_COMMON = /* glsl */`
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uAlbedoArr, uNormalArr, uExtraArr;
uniform sampler2D uLayerParams, uNoiseTex, uWaterNormals, uRainMap;
uniform vec4 uRainMapInfo;
uniform vec3 uCamPos;
uniform float uTime, uFrame, uTexSize;
uniform float uWetness, uPuddle, uSnowCover, uRain;
uniform float uObjFlags;
${G_COMMON}
${G_GBUF}
vec3 tintApply(vec3 alb, vec3 tintSrgb, float mask){
  vec3 k = srgbToLin(tintSrgb) / 0.2158;
  return alb * mix(vec3(1.0), k, mask);
}
float rainExposure(vec3 wp, float ny, float sky){
  vec2 uv = (wp.xz - uRainMapInfo.xy) / uRainMapInfo.z;
  float e = sat((sky - 0.55) * 3.0);
  if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
    float roof = texture(uRainMap, uv).r;
    float over = smoothstep(roof - 0.75, roof - 0.12, wp.y + (ny > 0.5 ? 0.0 : 0.45));
    e = min(e + 0.25, 1.0) * over;
  }
  return e;
}
vec3 rainRipples(vec2 p, float amount){
  vec2 sum = vec2(0.0);
  for (int k = 0; k < 2; k++) {
    vec2 q = p * (k == 0 ? 2.3 : 3.7) + float(k) * 17.3;
    vec2 cell = floor(q);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(i, j);
      vec2 h = hash22(c);
      float t = fract(uTime * (1.25 + h.x * 0.5) + h.y);
      vec2 d = q - (c + 0.15 + h * 0.7);
      float r = length(d);
      float ring = sin((r - t * 0.9) * 26.0) * smoothstep(0.16, 0.0, abs(r - t * 0.9)) * (1.0 - t) * (1.0 - t);
      sum += (d / max(r, 0.001)) * ring;
    }
  }
  return vec3(sum * amount, 1.0);
}
`;

// ---------------------------------------------------------------- opaque voxels
const G_FAR_SLOPE = /* glsl */`
uniform sampler2D uFarHeight;
uniform vec4 uFarInfo;
vec3 farNormal(vec2 xz){
  vec2 uv = (xz - uFarInfo.xy) / uFarInfo.z;
  float e = 8.0 / uFarInfo.z;
  float hx = textureLod(uFarHeight, uv - vec2(e, 0.0), 0.0).r - textureLod(uFarHeight, uv + vec2(e, 0.0), 0.0).r;
  float hz = textureLod(uFarHeight, uv - vec2(0.0, e), 0.0).r - textureLod(uFarHeight, uv + vec2(0.0, e), 0.0).r;
  return normalize(vec3(hx, 17.0, hz));
}
// x: unused, y: how strongly this pixel should adopt the smooth slope
vec2 farSlope(vec3 wp, float dist){
  if (uFarInfo.w < 0.5) return vec2(0.0);
  vec2 uv = (wp.xz - uFarInfo.xy) / uFarInfo.z;
  if (uv.x < 0.01 || uv.y < 0.01 || uv.x > 0.99 || uv.y > 0.99) return vec2(0.0);
  float h = textureLod(uFarHeight, uv, 0.0).r;
  float near_ = 1.0 - smoothstep(4.0, 11.0, abs(wp.y - h));
  return vec2(0.0, smoothstep(48.0, 180.0, dist) * near_ * 0.82);
}
`;
const G_TERRAIN_FRAG = /* glsl */`
${G_SURFACE_COMMON}
${G_FAR_SLOPE}
in vec3 vWorld; in vec3 vNormal; in vec4 vLight; in vec4 vTint; in vec2 vUv;
flat in ivec4 vInfo;
uniform vec3 uLightDir;
uniform int uPomSteps;
uniform vec4 uBreak;

const vec3 FT[6] = vec3[6](vec3(0,0,-1), vec3(0,0,1), vec3(1,0,0), vec3(1,0,0), vec3(1,0,0), vec3(-1,0,0));
const vec3 FB[6] = vec3[6](vec3(0,1,0), vec3(0,1,0), vec3(0,0,-1), vec3(0,0,1), vec3(0,1,0), vec3(0,1,0));

struct Samp { vec4 a; vec4 n; vec4 e; };
Samp sampleOne(vec2 uv, float layer, vec2 dx, vec2 dy){
  Samp s; vec3 c = vec3(uv, layer);
  s.a = textureGrad(uAlbedoArr, c, dx, dy); s.n = textureGrad(uNormalArr, c, dx, dy); s.e = textureGrad(uExtraArr, c, dx, dy);
  return s;
}
// hexagonal stochastic tiling: three randomly offset copies blended on a triangle grid
void hexGrid(vec2 st, out vec3 w, out vec2 o1, out vec2 o2, out vec2 o3){
  st *= 2.1;
  vec2 sk = vec2(st.x - 0.57735027 * st.y, 1.15470054 * st.y);
  vec2 base = floor(sk);
  vec3 t = vec3(fract(sk), 0.0); t.z = 1.0 - t.x - t.y;
  vec2 v1, v2, v3;
  if (t.z > 0.0) { w = vec3(t.z, t.y, t.x); v1 = base; v2 = base + vec2(0.0, 1.0); v3 = base + vec2(1.0, 0.0); }
  else { w = vec3(-t.z, 1.0 - t.y, 1.0 - t.x); v1 = base + vec2(1.0, 1.0); v2 = base + vec2(1.0, 0.0); v3 = base + vec2(0.0, 1.0); }
  o1 = hash22(v1 + 11.7); o2 = hash22(v2 + 11.7); o3 = hash22(v3 + 11.7);
}

void main(){
  int face = vInfo.x; int layerI = vInfo.y; int flags = vInfo.z; int edge = vInfo.w;
  float layer = float(layerI);
  vec4 P0 = texelFetch(uLayerParams, ivec2(layerI, 0), 0);
  vec4 P1 = texelFetch(uLayerParams, ivec2(layerI, 1), 0);
  vec4 P2 = texelFetch(uLayerParams, ivec2(layerI, 2), 0);
  float span = P0.x; int tiling = int(P0.y + 0.5); float pomDepth = P0.z; float bevelS = P0.w;
  float matClass = P1.x; float porosity = P1.y; float emisScale = P1.z;
  bool isModel = (flags & 2) != 0;
  vec3 camV = uCamPos - vWorld;
  float dist = length(camV);
  vec3 V = camV / dist;
  vec3 Ng = normalize(vNormal);

  vec3 T, Bt;
  vec3 dpx = dFdx(vWorld), dpy = dFdy(vWorld);
  vec2 duvx = dFdx(vUv), duvy = dFdy(vUv);
  if (!isModel) {
    T = FT[face]; Bt = FB[face];
    if ((flags & 8) != 0) { vec3 t0 = T; T = Bt; Bt = -t0; }
  } else {
    vec3 dp2perp = cross(dpy, Ng), dp1perp = cross(Ng, dpx);
    vec3 t0 = dp2perp * duvx.x + dp1perp * duvy.x;
    vec3 b0 = dp2perp * duvx.y + dp1perp * duvy.y;
    float inv = inversesqrt(max(max(dot(t0, t0), dot(b0, b0)), 1e-12));
    T = t0 * inv; Bt = b0 * inv;
  }
  vec3 blockPos = floor(vWorld - (isModel ? vec3(0.0) : Ng * 0.02));

  // base texture coordinate and its screen-space gradients
  vec2 uv, gx, gy;
  if (isModel || tiling == 3 || tiling == 0) {
    uv = vUv; gx = duvx; gy = duvy;
    if (!isModel && tiling == 0) {
      vec3 h = hash33(blockPos + float(face) * 7.31);
      uv += vec2(h.x, floor(h.y * 4.0) * 0.25);
    }
  } else {
    vec3 sT = FT[isModel ? 2 : face], sB = FB[isModel ? 2 : face];
    uv = vec2(dot(vWorld, sT), dot(vWorld, sB)) / span;
    gx = vec2(dot(dpx, sT), dot(dpx, sB)) / span; gy = vec2(dot(dpy, sT), dot(dpy, sB)) / span;
  }
  if (layerI == ${LAYER.lava}) {
    uv = vWorld.xz / span + vec2(vWorld.y * 0.13, -vWorld.y * 0.11) + vec2(uTime * 0.011, uTime * 0.007);
    gx = dpx.xz / span; gy = dpy.xz / span;
  }

  // anti-tiling sample set (offset + weight)
  vec3 w = vec3(1.0, 0.0, 0.0); vec2 o1 = vec2(0.0), o2 = vec2(0.0), o3 = vec2(0.0);
  int ns = 1;
  if (!isModel && tiling == 2) {
    hexGrid(uv, w, o1, o2, o3);
    w = pow(w, vec3(4.0)); w /= (w.x + w.y + w.z);
    ns = 3;
  } else if (!isModel && tiling == 1) {
    float k = textureGrad(uNoiseTex, uv * 0.23, gx * 0.23, gy * 0.23).b * 9.0;
    float i0 = floor(k);
    o1 = vec2(hash11(i0 * 3.1), floor(hash11(i0 * 5.7) * 3.0) / 3.0);
    o2 = vec2(hash11((i0 + 1.0) * 3.1), floor(hash11((i0 + 1.0) * 5.7) * 3.0) / 3.0);
    float f = smoothstep(0.3, 0.7, fract(k));
    w = vec3(1.0 - f, f, 0.0); ns = 2;
  }

  // parallax occlusion mapping with soft self shadow
  float microShadow = 1.0;
  vec2 puv = uv;
  float pomFade = 1.0 - smoothstep(18.0, 30.0, dist);
  if (uPomSteps > 0 && pomDepth > 0.001 && !isModel && pomFade > 0.0) {
    vec3 vts = vec3(dot(V, T), dot(V, Bt), dot(V, Ng));
    float depthUV = pomDepth * pomFade / (tiling == 3 || tiling == 0 ? 1.0 : span);
    float nz = max(vts.z, 0.22);
    int steps = int(mix(float(uPomSteps), float(uPomSteps) * 0.45, sat(vts.z)));
    steps = max(steps, 4);
    float dl = 1.0 / float(steps);
    vec2 delta = vts.xy / nz * depthUV * dl;
    #define HEIGHTAT(q) (ns == 1 ? textureGrad(uAlbedoArr, vec3((q), layer), gx, gy).a : (ns == 2 ? textureGrad(uAlbedoArr, vec3((q) + o1, layer), gx, gy).a * w.x + textureGrad(uAlbedoArr, vec3((q) + o2, layer), gx, gy).a * w.y : textureGrad(uAlbedoArr, vec3((q) + o1, layer), gx, gy).a * w.x + textureGrad(uAlbedoArr, vec3((q) + o2, layer), gx, gy).a * w.y + textureGrad(uAlbedoArr, vec3((q) + o3, layer), gx, gy).a * w.z))
    // anchor the surface at height 0.75 so block silhouettes keep their position
    vec2 cur = uv + vts.xy / nz * depthUV * 0.25;
    float rayD = 0.0; float hD = 1.0 - HEIGHTAT(cur); float prevH = hD; float prevRay = 0.0;
    for (int i = 0; i < 40; i++) {
      if (i >= steps || rayD >= hD) break;
      prevRay = rayD; prevH = hD;
      cur -= delta; rayD += dl; hD = 1.0 - HEIGHTAT(cur);
    }
    float after = hD - rayD, before = prevH - prevRay;
    float t = sat(after / (after - before - 1e-5));
    puv = mix(cur, cur + delta, t);
    float hitD = mix(rayD, prevRay, t);
    vec3 lts = vec3(dot(uLightDir, T), dot(uLightDir, Bt), dot(uLightDir, Ng));
    if (lts.z > 0.02) {
      vec2 ld = lts.xy / max(lts.z, 0.28) * depthUV;
      float sh = 0.0;
      for (int i = 1; i <= 6; i++) {
        float f = float(i) / 6.0;
        float rd = hitD * (1.0 - f);
        float hh = 1.0 - HEIGHTAT(puv + ld * hitD * f);
        sh = max(sh, (rd - hh) * (1.0 - f * 0.55));
      }
      microShadow = 1.0 - sat(sh * 5.5) * 0.85 * pomFade;
    }
    // keep face-local features (bevels) consistent with the shifted surface
  }

  // fetch material
  vec4 alb, nr, ex;
  if (ns == 1) {
    Samp s = sampleOne(puv, layer, gx, gy); alb = s.a; nr = s.n; ex = s.e;
  } else {
    Samp s1 = sampleOne(puv + o1, layer, gx, gy), s2 = sampleOne(puv + o2, layer, gx, gy);
    vec3 k = w;
    if (ns == 3) {
      Samp s3 = sampleOne(puv + o3, layer, gx, gy);
      k = w * (0.18 + vec3(s1.a.a, s2.a.a, s3.a.a)); k = k * k * k; k /= (k.x + k.y + k.z);
      alb = s1.a * k.x + s2.a * k.y + s3.a * k.z; nr = s1.n * k.x + s2.n * k.y + s3.n * k.z; ex = s1.e * k.x + s2.e * k.y + s3.e * k.z;
    } else {
      vec2 kk = w.xy * (0.2 + vec2(s1.a.a, s2.a.a)); kk = kk * kk * kk; kk /= max(kk.x + kk.y, 1e-5);
      alb = s1.a * kk.x + s2.a * kk.y; nr = s1.n * kk.x + s2.n * kk.y; ex = s1.e * kk.x + s2.e * kk.y;
    }
  }
  vec3 albedo = alb.rgb;
  float height = alb.a;
  vec3 tn = vec3(nr.xy * 2.0 - 1.0, 0.0);
  tn.xy *= P1.w;
  tn.z = sqrt(max(0.05, 1.0 - dot(tn.xy, tn.xy)));
  float rough = nr.z;
  bool soft = layerI == ${LAYER.sand} || layerI == ${LAYER.red_sand} || layerI == ${LAYER.snow};
  float ao = nr.w * (soft ? mix(1.0, vTint.a, 0.45) : vTint.a);
  float metal = ex.g;
  if (layerI == ${LAYER.grass_top} || layerI == ${LAYER.grass_side}) albedo = tintApply(albedo, vTint.rgb, ex.b);
  else if (vTint.r < 0.999 || vTint.g < 0.999) albedo = tintApply(albedo, vTint.rgb, 1.0);

  vec3 N = normalize(T * tn.x + Bt * tn.y + Ng * tn.z);

  // micro grain that only resolves up close, so surfaces stay crisp at arm's length
  float nearK = 1.0 - smoothstep(3.0, 13.0, dist);
  if (nearK > 0.0 && !isModel && layerI != ${LAYER.lava}) {
    vec2 du = vec2(dot(vWorld, FT[face]), dot(vWorld, FB[face]));
    float g0 = textureGrad(uNoiseTex, du * 1.9, vec2(dot(dpx, FT[face]), dot(dpx, FB[face])) * 1.9, vec2(dot(dpy, FT[face]), dot(dpy, FB[face])) * 1.9).a;
    float gx1 = textureGrad(uNoiseTex, du * 1.9 + vec2(0.006, 0.0), vec2(dot(dpx, FT[face]), dot(dpx, FB[face])) * 1.9, vec2(dot(dpy, FT[face]), dot(dpy, FB[face])) * 1.9).a;
    float gy1 = textureGrad(uNoiseTex, du * 1.9 + vec2(0.0, 0.006), vec2(dot(dpx, FT[face]), dot(dpx, FB[face])) * 1.9, vec2(dot(dpy, FT[face]), dot(dpy, FB[face])) * 1.9).a;
    albedo *= 1.0 + (g0 - 0.5) * 0.3 * nearK;
    N = normalize(N - (FT[face] * (gx1 - g0) + FB[face] * (gy1 - g0)) * 2.4 * nearK);
    rough = clamp(rough + (g0 - 0.5) * 0.14 * nearK, 0.02, 1.0);
  }

  // large-scale colour variation so no two blocks read identically
  float m1 = texture(uNoiseTex, (vWorld.xz + vWorld.y * vec2(0.37, 0.61)) / 71.0).b;
  float m2 = texture(uNoiseTex, (vWorld.zx + vWorld.y * vec2(0.53, 0.29)) / 17.0).a;
  float varAmt = (tiling == 0 || tiling == 3) ? 0.55 : 1.0;
  albedo *= 1.0 + ((m1 - 0.5) * 0.34 + (m2 - 0.5) * 0.16) * varAmt;
  albedo *= mix(vec3(1.0), mix(vec3(1.06, 1.0, 0.93), vec3(0.95, 1.0, 1.05), m2), 0.6 * varAmt);
  if (!isModel && (tiling == 0 || tiling == 3)) albedo *= 0.93 + 0.14 * hash13(blockPos);

  // moss on shaded north faces, cave ceilings and damp tops
  float mossK = P2.x;
  if (mossK > 0.0 && !isModel) {
    float where_ = max(sat(-Ng.z) * 0.95, sat(Ng.y) * 0.5);
    where_ = max(where_, sat(-Ng.y) * (1.0 - vLight.a) * 0.8);
    float low = 1.0 - smoothstep(112.0, 150.0, vWorld.y);
    float n3 = texture(uNoiseTex, (vWorld.xz * 0.8 + vWorld.y * vec2(0.9, -0.7)) / 6.3).a;
    float n4 = texture(uNoiseTex, (vWorld.xz + vWorld.y * vec2(0.5, 0.8)) / 23.0).b;
    float mo = smoothstep(0.57, 0.70, n4 * 0.62 + n3 * 0.5 - height * 0.16) * where_ * mossK * low * smoothstep(0.1, 0.75, vLight.a + 0.18);
    if (mo > 0.001) {
      float fz = texture(uNoiseTex, uv * 5.0).r;
      vec3 mcol = mix(vec3(0.036, 0.058, 0.011), vec3(0.11, 0.15, 0.026), texture(uNoiseTex, uv * 2.3).a * 0.8 + fz * 0.35);
      albedo = mix(albedo, mcol, mo); rough = mix(rough, 0.96, mo); metal *= 1.0 - mo;
      N = normalize(mix(N, Ng + (vec3(fz, texture(uNoiseTex, uv * 5.0 + 0.37).r, 0.5) - 0.5) * 0.5, mo * 0.6));
    }
  }

  // rounded block edges: bend normals on convex corners, groove between neighbouring cut blocks
  if (!isModel && bevelS > 0.0 && dist < 70.0) {
    vec3 bT = FT[face], bB = FB[face];
    float fu = fract(dot(vWorld, bT)), fv = fract(dot(vWorld, bB));
    float chip = (texture(uNoiseTex, (vWorld.xz + vWorld.y * vec2(0.71, 0.43)) * 0.83).a - 0.5);
    vec4 d = vec4(fu, 1.0 - fu, fv, 1.0 - fv) + chip * 0.045 * bevelS;
    float grooveS = max(0.0, bevelS - 0.38) * 1.25;
    vec2 bend = vec2(0.0); float wear = 0.0, groove = 0.0;
    float fade = 1.0 - smoothstep(35.0, 70.0, dist);
    for (int e = 0; e < 4; e++) {
      bool convex = (edge & (1 << e)) != 0;
      float wdt = convex ? 0.018 + 0.085 * bevelS : 0.012 + 0.026 * grooveS;
      float t = sat(1.0 - d[e] / wdt);
      if (t <= 0.0) continue;
      vec2 dir = e == 0 ? vec2(-1.0, 0.0) : e == 1 ? vec2(1.0, 0.0) : e == 2 ? vec2(0.0, -1.0) : vec2(0.0, 1.0);
      if (convex) { bend += dir * t * t * (0.45 + 0.55 * bevelS); wear += t * t; }
      else if (grooveS > 0.0) { bend += dir * t * grooveS * 0.75; groove = max(groove, t * t * grooveS); }
    }
    N = normalize(N + (bT * bend.x + bB * bend.y) * 1.05 * fade);
    ao *= 1.0 - sat(groove) * 0.55 * fade;
    albedo *= 1.0 - sat(groove) * 0.3 * fade;
    albedo *= 1.0 + sat(wear) * bevelS * (0.12 + chip * 0.5) * fade;
    rough = mix(rough, rough * 0.9, sat(wear) * bevelS);
  }

  if (!isModel && (layerI == ${LAYER.oak_bark} || layerI == ${LAYER.birch_bark} || layerI == ${LAYER.pine_bark} || layerI == ${LAYER.cypress_bark} || layerI == ${LAYER.rosewood_bark})) {
    vec3 across = (flags & 8) != 0 ? FB[face] : FT[face];
    float cu_ = fract(dot(vWorld, across)) - 0.5;
    float th = cu_ * 1.55;
    N = normalize(N + Ng * (cos(th) - 1.0) + across * sin(th) * 0.85);
    ao *= 1.0 - pow(abs(cu_) * 2.0, 3.0) * 0.34;
  }

  // distant natural ground shades like the slope it belongs to, so stair steps stop reading as stripes
  float faceOut = isModel ? 6.0 : float(face);
  bool naturalLayer = tiling == 1 || tiling == 2 || layerI == ${LAYER.grass_side} || layerI == ${LAYER.forest_side} || layerI == ${LAYER.snow_side};
  if (!isModel && naturalLayer && dist > 48.0) {
    vec2 sm = farSlope(vWorld, dist);
    if (sm.y > 0.0) {
      N = normalize(mix(N, farNormal(vWorld.xz), sm.y));
      ao = mix(ao, max(ao, 0.9), sm.y);
      if (sm.y > 0.3) { faceOut = 6.0; microShadow = mix(microShadow, 1.0, sm.y); }
    }
  }

  // altitude snow dusting and live snowfall cover on exposed upward faces
  float sky = vLight.a;
  float upness = sat((N.y - 0.45) * 2.2) * sat(Ng.y + 0.3);
  if (layerI != ${LAYER.lava} && matClass != 2.0) {
    float sn = texture(uNoiseTex, vWorld.xz / 9.0).a;
    float alt = smoothstep(146.0, 172.0, vWorld.y + (m1 - 0.5) * 26.0 + (sn - 0.5) * 9.0);
    float cover = max(alt, uSnowCover * rainExposure(vWorld, Ng.y, sky));
    if (cover > 0.001 && sky > 0.6) {
      float s = sat((upness * 1.4 - 0.55 + cover * 0.75 + (0.55 - height) * 0.35 + (sn - 0.5) * 0.7) * 2.2) * sat(cover * 1.6) * step(0.3, Ng.y);
      if (s > 0.0) {
        float g = texture(uNoiseTex, vWorld.xz * 0.9).a;
        albedo = mix(albedo, vec3(0.74, 0.78, 0.84) * (0.92 + g * 0.16), s);
        rough = mix(rough, 0.66, s); metal *= 1.0 - s;
        N = normalize(mix(N, vec3(0.0, 1.0, 0.0) + vec3(g - 0.5, 0.0, sn - 0.5) * 0.22, s * 0.75));
        if (s > 0.5) matClass = 2.0;
      }
    }
  }

  // sparkle grains in snow and sand: a few texels become tiny randomly oriented mirrors
  if (P2.y > 0.0 && ex.b > 0.55 && matClass != 1.0 && layerI != ${LAYER.grass_top}) {
    vec3 h = hash33(floor(vec3(uv * uTexSize * 0.5, float(face))));
    N = normalize(N + (h - 0.5) * 1.35 * P2.y); rough = 0.16;
  }

  // wetness: darker, glossier, with puddles on flat ground
  float wetAmt = 0.0;
  if (uWetness > 0.001 && layerI != ${LAYER.lava}) {
    float expo = rainExposure(vWorld, Ng.y, sky);
    wetAmt = uWetness * expo;
    if (wetAmt > 0.001) {
      float pn = texture(uNoiseTex, vWorld.xz / 15.0).b * 0.72 + texture(uNoiseTex, vWorld.xz / 4.1).a * 0.28;
      float puddle = smoothstep(0.53, 0.60, pn + (0.5 - height) * 0.09) * step(0.9, Ng.y) * uPuddle * expo;
      albedo *= mix(1.0, 0.46 + 0.22 * (1.0 - porosity), wetAmt);
      rough = mix(rough, mix(0.34, 0.16, 1.0 - porosity) + (rough - 0.8) * 0.25, wetAmt * 0.92);
      N = normalize(mix(N, Ng, wetAmt * 0.3));
      if (puddle > 0.001) {
        albedo *= mix(1.0, 0.55, puddle);
        rough = mix(rough, 0.025, puddle);
        vec3 rip = rainRipples(vWorld.xz, 0.55 * uRain);
        N = normalize(mix(N, normalize(vec3(rip.x, 1.0, rip.y)), puddle));
        metal *= 1.0 - puddle; ao = mix(ao, vTint.a, puddle);
      }
    }
  }
  // shoreline: sand and gravel just above the waterline stay dark and glossy
  if ((flags & 128) != 0 && (flags & 1) == 0 && sky > 0.4) {
    float lap = ${(SEA + 0.875).toFixed(3)} + 0.14 + sin(uTime * 0.8 + vWorld.x * 0.5 + vWorld.z * 0.4) * 0.05 + (m2 - 0.5) * 0.12;
    float wl = 1.0 - smoothstep(lap - 0.05, lap + 0.08, vWorld.y);
    albedo *= mix(1.0, 0.56, wl * porosity); rough = mix(rough, 0.2, wl * 0.85);
  }
  if ((flags & 1) != 0) { albedo *= mix(1.0, 0.7, porosity); }

  // mining damage: fracture network spreading from the middle of the face
  if (uBreak.w > 0.0 && !isModel && all(equal(blockPos, floor(uBreak.xyz + 0.5)))) {
    vec3 bT = FT[face], bB = FB[face];
    vec2 p = vec2(fract(dot(vWorld, bT)), fract(dot(vWorld, bB)));
    vec2 q = p * 3.1 + (vec2(texture(uNoiseTex, p * 0.42).b, texture(uNoiseTex, p * 0.42 + 0.41).b) - 0.5) * 1.1;
    vec2 cell = floor(q); float f1 = 9.0, f2 = 9.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(i, j); vec2 pt = c + hash22(c + float(face) * 13.0); float dd = length(q - pt);
      if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd;
    }
    float web = f2 - f1;
    vec2 cp = p - 0.5;
    float r = length(cp);
    float wob = texture(uNoiseTex, p * 1.7).a - 0.5;
    float reveal = smoothstep(0.02, -0.12, r + wob * 0.22 - uBreak.w * 0.78);
    float net = smoothstep(0.018 + uBreak.w * 0.05, 0.003, web) * reveal * smoothstep(0.38, 0.8, uBreak.w);
    float split = 0.0, lip = 0.0;
    for (int k = 0; k < 6; k++) {
      float fk = float(k);
      if (fk > 1.5 + uBreak.w * 5.0) break;
      float ang0 = fk * 1.047 + hash13(blockPos + fk) * 0.85 + float(face);
      vec2 dir = vec2(cos(ang0), sin(ang0)); vec2 nrmD = vec2(-dir.y, dir.x);
      float along = dot(cp, dir);
      if (along < -0.02) continue;
      float jag = (textureLod(uNoiseTex, vec2(along * 0.85 + fk * 0.17, fk * 0.31), 0.0).b - 0.5) * 0.3 + (textureLod(uNoiseTex, vec2(along * 1.6, fk * 0.57), 0.0).a - 0.5) * 0.035;
      float off = dot(cp, nrmD) - jag * smoothstep(0.0, 0.2, along);
      float len = uBreak.w * (0.55 + 0.35 * hash13(blockPos + fk * 3.7));
      float wdt = (0.009 + 0.024 * uBreak.w) * sat(1.0 - along / max(len, 0.01));
      if (along < len) { split = max(split, smoothstep(wdt, wdt * 0.35, abs(off))); lip = max(lip, smoothstep(wdt * 3.0, wdt * 1.2, off) * step(wdt, off)); }
    }
    float crack = max(split, net * 0.85);
    float chipped = smoothstep(0.55, 0.8, uBreak.w) * smoothstep(0.54, 0.62, texture(uNoiseTex, p * 1.9 + 0.13).a) * smoothstep(0.5, 0.15, r);
    albedo *= 1.0 - crack * 0.86;
    albedo = mix(albedo, albedo * 1.5 + 0.05, sat(lip + chipped * 0.7) * (1.0 - crack));
    crack = max(crack, chipped * 0.45);
    ao *= 1.0 - crack * 0.7;
    vec2 tilt = vec2(dFdx(crack), dFdy(crack));
    N = normalize(N - (normalize(dpx) * tilt.x + normalize(dpy) * tilt.y) * 1.4);
  }

  // emission
  float emis = 0.0;
  bool litFlag = (flags & 16) != 0;
  if (emisScale > 0.0 && ex.r > 0.003) {
    bool needsLit = layerI == ${LAYER.furnace_front} || layerI == ${LAYER.charwood} || layerI == ${LAYER.mushroom_stem};
    if (!needsLit || litFlag) emis = ex.r * emisScale;
    if (layerI == ${LAYER.lava}) {
      vec2 uv2 = uv * 1.37 + vec2(0.31, 0.67) - vec2(uTime * 0.019, uTime * 0.004);
      float e2 = textureGrad(uExtraArr, vec3(uv2, layer), gx * 1.37, gy * 1.37).r;
      float pulse = 0.82 + 0.18 * sin(uTime * 0.7 + m1 * 20.0);
      float big = texture(uNoiseTex, vWorld.xz / 23.0 + uTime * vec2(0.0042, -0.0031)).b;
      float upwell = smoothstep(0.55, 0.74, big);
      float heat = sat((pow(ex.r, 1.45) * 0.96 + pow(e2, 3.5) * 0.17 + upwell * (0.06 + ex.r * 0.5)) * pulse);
      emis = pow(heat, 2.2) * emisScale * 1.5 + 0.006;
      float crustN = texture(uNoiseTex, vWorld.xz / 2.3).a;
      albedo = mix(vec3(0.022, 0.012, 0.009) * (0.5 + crustN), mix(vec3(0.72, 0.07, 0.003), vec3(1.0, 0.43, 0.04), sat(heat * 1.6 - 0.5)), smoothstep(0.14, 0.5, heat));
      rough = mix(0.82, 0.45, heat);
    }
    if (layerI == ${LAYER.charwood}) emis *= 0.75 + 0.25 * sin(uTime * 7.0 + hash13(floor(vWorld * 9.0)) * 40.0);
    if (layerI == ${LAYER.crystal_azure} || layerI == ${LAYER.crystal_amber}) {
      float fres = pow(1.0 - sat(dot(N, V)), 2.0);
      emis *= 0.45 + fres * 1.7 + 0.12 * sin(uTime * 1.3 + hash13(blockPos) * 6.28);
    }
  }

  if (layerI == ${LAYER.lava}) matClass = 5.0;
  float gflags = uObjFlags + ((flags & 1) != 0 ? 4.0 : 0.0);
  float extra = matClass == 1.0 ? 0.0 : microShadow;
  writeG(albedo, ao, N, rough, metal, vLight, emis, matClass, faceOut, extra, gflags);
}`;

// ---------------------------------------------------------------- alpha-tested foliage (leaf cards and plants)
const G_ALPHA_TEST = /* glsl */`
float coverageAlpha(vec2 uv, float a){
  vec2 dx = dFdx(uv * uTexSize), dy = dFdy(uv * uTexSize);
  float mip = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
  return a * (1.0 + mip * 0.24);
}`;
const G_CUTOUT_FRAG = /* glsl */`
${G_SURFACE_COMMON}
in vec3 vWorld; in vec3 vNormal; in vec4 vLight; in vec4 vTint; in vec2 vUv;
flat in ivec4 vInfo;
${G_ALPHA_TEST}
void main(){
  int layerI = vInfo.y; float layer = float(layerI); int flags = vInfo.z;
  vec3 c3 = vec3(vUv, layer);
  vec4 ex = texture(uExtraArr, c3);
  float a = coverageAlpha(vUv, ex.a);
  float dist = length(uCamPos - vWorld);
  float th = 0.5 + (ign(gl_FragCoord.xy, uFrame) - 0.5) * 0.46;
  if (a < th) discard;
  if (dist < 0.75 && ign(gl_FragCoord.yx, uFrame + 17.0) > smoothstep(0.25, 0.75, dist)) discard;
  vec4 alb = texture(uAlbedoArr, c3);
  vec4 nr = texture(uNormalArr, c3);
  vec3 albedo = tintApply(alb.rgb, vTint.rgb, ex.b);
  vec3 Ng = normalize(vNormal);
  vec3 dpx = dFdx(vWorld), dpy = dFdy(vWorld); vec2 ux = dFdx(vUv), uy = dFdy(vUv);
  vec3 p2 = cross(dpy, Ng), p1 = cross(Ng, dpx);
  vec3 T = p2 * ux.x + p1 * uy.x, Bt = p2 * ux.y + p1 * uy.y;
  float inv = inversesqrt(max(max(dot(T, T), dot(Bt, Bt)), 1e-12));
  vec2 tn = nr.xy * 2.0 - 1.0;
  vec3 N = normalize(Ng + (T * inv * tn.x + Bt * inv * tn.y) * 0.75);
  vec3 V = normalize(uCamPos - vWorld);
  if (dot(N, V) < -0.25) N = normalize(N + V * 0.65);
  float rough = nr.z;
  float m = texture(uNoiseTex, (vWorld.xz + vWorld.y * 0.7) / 23.0).b;
  albedo *= 0.88 + m * 0.26;
  if (uWetness > 0.001) { float e = rainExposure(vWorld, 1.0, vLight.a) * uWetness; albedo *= mix(1.0, 0.72, e); rough = mix(rough, 0.2, e); }
  if (uSnowCover > 0.001 || vWorld.y > 150.0) {
    float s = max(uSnowCover * 0.85, smoothstep(150.0, 174.0, vWorld.y)) * sat(N.y * 1.6 - 0.35) * smoothstep(0.6, 0.9, vLight.a);
    albedo = mix(albedo, vec3(0.72, 0.77, 0.84), s); rough = mix(rough, 0.7, s);
  }
  float ao = nr.w * vTint.a * (0.72 + 0.28 * alb.a);
  float trans = (flags & 2) != 0 ? 1.0 : 0.8;
  writeG(albedo, ao, N, rough, 0.0, vLight, 0.0, 1.0, 6.0, trans, uObjFlags + ((flags & 1) != 0 ? 4.0 : 0.0));
}`;

// ---------------------------------------------------------------- instanced meadow grass
const G_GRASS_VERT = /* glsl */`
precision highp float;
in vec4 aBlade;   // yaw, lean, height scale, width
in float aSide;
in vec4 iPos; in vec4 iTint; in vec4 iLight;
out vec3 vWorld; out vec3 vNormal; out vec4 vLight; out vec4 vTint; out vec2 vUv;
uniform vec3 uCamPos, uPlayerPos;
uniform float uGrassDist;
${G_WIND}
${G_COMMON}
void main(){
  vec3 base = (modelMatrix * vec4(iPos.xyz, 1.0)).xyz;
  float rnd = iPos.w;
  float yaw = rnd * 6.2831 + aBlade.x;
  float cr = cos(rnd * 41.0), sr = sin(rnd * 41.0);
  vec2 off = mat2(cr, sr, -sr, cr) * position.xz;
  float t = position.y;
  float H = iTint.a * (255.0 / 160.0) * aBlade.z;
  float d = length(base.xz - uCamPos.xz);
  float keep = 1.0 - smoothstep(uGrassDist * 0.62, uGrassDist, d + (fract(rnd * 77.7) - 0.5) * uGrassDist * 0.45);
  H *= keep;
  vec2 dir = vec2(cos(yaw), sin(yaw)), perp = vec2(-dir.y, dir.x);
  float lean = aBlade.y * (0.75 + 0.5 * fract(rnd * 13.3));
  float widthK = aBlade.w * (1.0 + smoothstep(18.0, uGrassDist, d) * 1.4) * (1.0 - pow(t, 1.7) * 0.93) * step(0.001, keep);
  vec3 p = base + vec3(off.x, 0.0, off.y);
  p.xz += dir * lean * t * t * H + perp * aSide * widthK;
  p.y += t * H * (1.0 - lean * lean * t * t * 0.34);
  vec2 wnd = windAt(base.xz + off);
  float bendK = t * t * H;
  p.xz += wnd * bendK * 0.52;
  p.y -= dot(wnd, wnd) * bendK * 0.13;
  vec2 pd = p.xz - uPlayerPos.xz; float pl = length(pd);
  if (pl < 0.85 && abs(base.y - uPlayerPos.y) < 1.6) { float k = (0.85 - pl) * t; p.xz += pd / max(pl, 0.02) * k * 0.75; p.y -= k * H * 0.45; }
  vec3 tang = normalize(vec3(dir.x * lean * 2.0 * t + wnd.x * t, 1.0, dir.y * lean * 2.0 * t + wnd.y * t));
  vec3 side = vec3(perp.x, 0.0, perp.y);
  vec3 fn = normalize(cross(side, tang));
  if (dot(fn, uCamPos - p) < 0.0) fn = -fn;
  vNormal = normalize(mix(fn + side * aSide * 0.55, vec3(0.0, 1.0, 0.0), 0.42));
  vWorld = p; vLight = iLight; vTint = vec4(iTint.rgb, mix(0.3, 1.0, smoothstep(0.0, 0.75, t))); vUv = vec2(t, fract(rnd * 31.7 + aBlade.x * 3.1));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const G_GRASS_FRAG = /* glsl */`
${G_SURFACE_COMMON}
in vec3 vWorld; in vec3 vNormal; in vec4 vLight; in vec4 vTint; in vec2 vUv;
void main(){
  float t = vUv.x, r = vUv.y;
  vec3 tint = srgbToLin(vTint.rgb);
  vec3 base = tint * vec3(0.5, 0.58, 0.46);
  vec3 tip = tint * vec3(1.32, 1.3, 0.92) + vec3(0.022, 0.018, 0.0);
  vec3 albedo = mix(base, tip, smoothstep(0.05, 1.0, t));
  float dry = step(0.9, fract(r * 7.3));
  albedo = mix(albedo, vec3(0.3, 0.22, 0.085) * (0.5 + t * 0.7), dry * 0.75);
  float patchN = texture(uNoiseTex, vWorld.xz / 29.0).b;
  albedo *= 0.74 + r * 0.46 + (patchN - 0.5) * 0.55;
  vec3 N = normalize(vNormal);
  float rough = 0.62;
  if (uWetness > 0.001) { float e = uWetness * rainExposure(vWorld, 1.0, vLight.a); albedo *= mix(1.0, 0.7, e); rough = mix(rough, 0.22, e); }
  if (uSnowCover > 0.001) { float s = uSnowCover * sat(t * 1.6 - 0.35) * rainExposure(vWorld, 1.0, vLight.a); albedo = mix(albedo, vec3(0.72, 0.77, 0.84), s); }
  writeG(albedo, vTint.a, N, rough, 0.0, vLight, 0.0, 1.0, 6.0, 0.55 + t * 0.45, 0.0);
}`;

// ---------------------------------------------------------------- distant terrain
const G_LOD_VERT = /* glsl */`
precision highp float;
in vec4 aNrm; in vec4 aCol; in vec2 aUv;
out vec3 vWorld; out vec3 vNormal; out vec4 vCol; out vec2 vUv;
flat out int vLayer;
uniform float uFarShift;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz; vNormal = aNrm.xyz; vCol = aCol; vUv = aUv; vLayer = int(aNrm.w * 127.0 + 0.5);
  wp.y += uFarShift;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const G_LOD_FRAG = /* glsl */`
${G_SURFACE_COMMON}
in vec3 vWorld; in vec3 vNormal; in vec4 vCol; in vec2 vUv;
flat in int vLayer;
uniform sampler2D uLoadedMask;
uniform vec4 uMaskInfo;   // chunk origin x, z, size, enabled
uniform vec4 uHole;       // world rectangle already covered by a finer level
${G_ALPHA_TEST}
void main(){
  int kind = int(vCol.a * 255.0 + 0.5);
  vec2 cc = floor((vWorld.xz - (kind == 3 ? vec2(0.0) : vNormal.xz * 0.3)) / 16.0) - uMaskInfo.xy;
  if (uMaskInfo.w > 0.5 && cc.x >= 0.0 && cc.y >= 0.0 && cc.x < uMaskInfo.z && cc.y < uMaskInfo.z) {
    if (texelFetch(uLoadedMask, ivec2(cc), 0).r > 0.5) discard;
  }
  if (vWorld.x > uHole.x && vWorld.z > uHole.y && vWorld.x < uHole.z && vWorld.z < uHole.w) discard;
  float layer = float(vLayer);
  vec3 dpx = dFdx(vWorld), dpy = dFdy(vWorld);
  vec3 Ng = normalize(vNormal);
  vec3 N = Ng;
  vec3 albedo; float rough = 0.9; float matClass = 0.0; float ao = 1.0;
  float dist = length(vWorld - uCamPos);
  if (kind == 3) {
    float a = coverageAlpha(vUv, texture(uExtraArr, vec3(vUv, layer)).a);
    if (a < 0.46 + (ign(gl_FragCoord.xy, uFrame) - 0.5) * 0.4) discard;
    vec4 tx = texture(uAlbedoArr, vec3(vUv, layer));
    float lm = luma(tx.rgb) / max(luma(textureLod(uAlbedoArr, vec3(0.5, 0.5, layer), 12.0).rgb), 0.01);
    albedo = srgbToLin(vCol.rgb) * clamp(lm, 0.35, 1.9);
    N = normalize(Ng + (vec3(texture(uNoiseTex, vWorld.xz / 3.7).a, texture(uNoiseTex, vWorld.xy / 3.1).a, texture(uNoiseTex, vWorld.zy / 3.3).a) - 0.5) * 0.9);
    matClass = 1.0; ao = 0.45 + 0.55 * vUv.y;
  } else if (kind == 1) {
    float depth = vCol.r, warm = vCol.g;
    vec3 shallow = mix(vec3(0.02, 0.075, 0.085), vec3(0.025, 0.17, 0.15), warm);
    albedo = mix(shallow, vec3(0.006, 0.024, 0.045), sat(depth * 1.5));
    vec4 w1 = texture(uWaterNormals, vWorld.xz / 90.0 + uTime * vec2(0.006, 0.004));
    vec4 w2 = texture(uWaterNormals, vWorld.xz / 37.0 - uTime * vec2(0.011, -0.006));
    float flat_ = 1.0 / (1.0 + dist * 0.004);
    N = normalize(vec3((w1.x - 0.5 + w2.z - 0.5) * 0.42 * flat_, 1.0, (w1.y - 0.5 + w2.w - 0.5) * 0.42 * flat_));
    rough = 0.09 + sat(dist / 1800.0) * 0.14; matClass = 6.0;
  } else {
    // the same materials as the near blocks, projected along the dominant axis
    vec3 face = abs(normalize(cross(dpx, dpy)));
    vec2 p, gx, gy; vec3 T, Bt;
    if (face.y > 0.6) { p = vWorld.xz; gx = dpx.xz; gy = dpy.xz; T = vec3(1, 0, 0); Bt = vec3(0, 0, 1); }
    else if (face.x > face.z) { p = vWorld.zy; gx = dpx.zy; gy = dpy.zy; T = vec3(0, 0, 1); Bt = vec3(0, 1, 0); }
    else { p = vWorld.xy; gx = dpx.xy; gy = dpy.xy; T = vec3(1, 0, 0); Bt = vec3(0, 1, 0); }
    float span = texelFetch(uLayerParams, ivec2(vLayer, 0), 0).x * 2.0;
    vec4 tx = textureGrad(uAlbedoArr, vec3(p / span, layer), gx / span, gy / span);
    vec4 nr = textureGrad(uNormalArr, vec3(p / span, layer), gx / span, gy / span);
    vec3 avg = textureLod(uAlbedoArr, vec3(0.5, 0.5, layer), 12.0).rgb;
    float detail = clamp(luma(tx.rgb) / max(luma(avg), 0.01), 0.45, 1.75);
    albedo = srgbToLin(vCol.rgb) * mix(1.0, detail, 0.85);
    float n1 = texture(uNoiseTex, p / 23.0).a, n2 = texture(uNoiseTex, vWorld.xz / 97.0).b, n3 = texture(uNoiseTex, p / 7.1).r;
    albedo *= 0.74 + n1 * 0.34 + n2 * 0.34 - n3 * 0.1;
    vec2 tn = nr.xy * 2.0 - 1.0;
    N = normalize(Ng + (T * tn.x + Bt * tn.y) * 0.8 + (vec3(texture(uNoiseTex, p / 14.0).a, 0.5, texture(uNoiseTex, p / 14.0 + 0.5).a) - 0.5) * 0.55);
    ao = nr.w * (0.8 + 0.2 * n1);
    if (kind == 2) { rough = 0.2; matClass = 4.0; }
    if (vLayer == ${LAYER.snow}) { matClass = 2.0; rough = 0.7; }
    if (vWorld.y > 148.0 && Ng.y > 0.45) { float s = smoothstep(148.0, 174.0, vWorld.y + (n2 - 0.5) * 30.0 + (n1 - 0.5) * 8.0) * smoothstep(0.45, 0.75, N.y); albedo = mix(albedo, vec3(0.74, 0.78, 0.84), s); if (s > 0.5) matClass = 2.0; }
    if (uSnowCover > 0.0 && Ng.y > 0.5) albedo = mix(albedo, vec3(0.7, 0.75, 0.82), uSnowCover * 0.8);
    albedo *= 1.0 - uWetness * 0.28;
    rough = mix(rough, 0.45, uWetness);
  }
  writeG(albedo, ao, N, rough, 0.0, vec4(0.0, 0.0, 0.0, 1.0), 0.0, matClass, 6.0, matClass == 1.0 ? 0.75 : 1.0, 0.0);
}`;

// ---------------------------------------------------------------- depth-only shadow variants
const G_SHADOW_FRAG = 'precision highp float; layout(location = 0) out vec4 o; void main(){ o = vec4(1.0); }';
const G_SHADOW_CUTOUT_FRAG = /* glsl */`
precision highp float; precision highp sampler2DArray;
uniform sampler2DArray uExtraArr; uniform float uTexSize;
in vec3 vWorld; in vec3 vNormal; in vec4 vLight; in vec4 vTint; in vec2 vUv;
flat in ivec4 vInfo;
layout(location = 0) out vec4 o;
${G_ALPHA_TEST}
void main(){
  float a = coverageAlpha(vUv, texture(uExtraArr, vec3(vUv, float(vInfo.y))).a);
  if (a < 0.62) discard;
  o = vec4(1.0);
}`;
const G_SHADOW_GRASS_FRAG = 'precision highp float; in vec3 vWorld; in vec3 vNormal; in vec4 vLight; in vec4 vTint; in vec2 vUv; layout(location = 0) out vec4 o; void main(){ o = vec4(1.0); }';

// ---------------------------------------------------------------- material factory
const surfUniforms = (extra = {}) => Object.assign(uni('uFarHeight', 'uFarInfo', 'uAlbedoArr', 'uNormalArr', 'uExtraArr', 'uLayerParams', 'uNoiseTex', 'uWaterNormals', 'uRainMap', 'uRainMapInfo', 'uCamPos', 'uTime', 'uFrame', 'uTexSize', 'uWetness', 'uPuddle', 'uSnowCover', 'uRain', 'uWind', 'uLightDir', 'uPomSteps', 'uBreak'), { uObjFlags: { value: 0 } }, extra);
const WorldMats = {
  init() {
    const mk = (vs, fs, uniforms, extra = {}) => new THREE.ShaderMaterial(Object.assign({ glslVersion: THREE.GLSL3, vertexShader: vs, fragmentShader: fs, uniforms }, extra));
    this.terrain = mk(G_VOXEL_VERT, G_TERRAIN_FRAG, surfUniforms());
    this.cutout = mk(G_VOXEL_VERT, G_CUTOUT_FRAG, surfUniforms(), { side: THREE.DoubleSide });
    this.viewTerrain = mk('#define VIEWMODEL\n' + G_VOXEL_VERT, G_TERRAIN_FRAG, surfUniforms({ uObjFlags: { value: 3 } }));
    this.viewCutout = mk('#define VIEWMODEL\n' + G_VOXEL_VERT, G_CUTOUT_FRAG, surfUniforms({ uObjFlags: { value: 3 } }), { side: THREE.DoubleSide });
    this.dynTerrain = mk(G_VOXEL_VERT, G_TERRAIN_FRAG, surfUniforms({ uObjFlags: { value: 2 } }));
    const grassU = () => surfUniforms(uni('uPlayerPos', 'uGrassDist'));
    this.grass = mk(G_GRASS_VERT, G_GRASS_FRAG, grassU(), { side: THREE.DoubleSide });
    this.lod = mk(G_LOD_VERT, G_LOD_FRAG, surfUniforms({ uLoadedMask: { value: null }, uMaskInfo: { value: V4() }, uHole: { value: V4() }, uFarShift: { value: 0 } }), { side: THREE.DoubleSide });
    const shadowOpts = { side: THREE.DoubleSide, colorWrite: false };
    this.shadowOpaque = mk(G_VOXEL_VERT, G_SHADOW_FRAG, uni('uTime', 'uWind'), shadowOpts);
    this.shadowCutout = mk(G_VOXEL_VERT, G_SHADOW_CUTOUT_FRAG, uni('uTime', 'uWind', 'uExtraArr', 'uTexSize'), shadowOpts);
    this.shadowGrass = mk(G_GRASS_VERT, G_SHADOW_GRASS_FRAG, uni('uTime', 'uWind', 'uCamPos', 'uPlayerPos', 'uGrassDist'), shadowOpts);
  },
};

// geometry builders from worker output
function voxelGeometry(d, quads = true) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
  g.setAttribute('aNrm', new THREE.BufferAttribute(d.nrm, 4, true));
  g.setAttribute('aInfo', new THREE.BufferAttribute(d.info, 4, false));
  g.setAttribute('aLight', new THREE.BufferAttribute(d.light, 4, true));
  g.setAttribute('aTint', new THREE.BufferAttribute(d.tint, 4, true));
  g.setAttribute('aUv', new THREE.BufferAttribute(d.uv, 2));
  if (quads) { g.setIndex(quadIndex(d.n / 4)); g.setDrawRange(0, d.n / 4 * 6); }
  return g;
}
const _quadIdx = { cap: 0, attr: null };
function quadIndex(quads) {
  // one shared index buffer serves every quad mesh
  if (quads > _quadIdx.cap) {
    const cap = Math.max(quads, 65536, _quadIdx.cap * 2);
    const a = new Uint32Array(cap * 6);
    for (let i = 0; i < cap; i++) { const v = i * 4, o = i * 6; a[o] = v; a[o + 1] = v + 1; a[o + 2] = v + 2; a[o + 3] = v; a[o + 4] = v + 2; a[o + 5] = v + 3; }
    _quadIdx.cap = cap; _quadIdx.attr = new THREE.BufferAttribute(a, 1);
  }
  return _quadIdx.attr;
}
function grassClumpGeometry(blades) {
  const SEG = 3;
  const pos = [], blade = [], side = [], idx = [];
  const r = mulberry32(4242);
  let base = 0;
  for (let b = 0; b < blades; b++) {
    const ox = (r() - 0.5) * 0.52, oz = (r() - 0.5) * 0.52, yaw = r() * 6.283, lean = 0.12 + r() * 0.55, hs = 0.55 + r() * 0.6, wd = 0.008 + r() * 0.009;
    for (let s = 0; s <= SEG; s++) {
      for (const sd of [-1, 1]) { pos.push(ox, s / SEG, oz); blade.push(yaw, lean, hs, wd); side.push(sd); }
    }
    for (let s = 0; s < SEG; s++) { const a = base + s * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    base += (SEG + 1) * 2;
  }
  return { pos: new THREE.Float32BufferAttribute(pos, 3), blade: new THREE.Float32BufferAttribute(blade, 4), side: new THREE.Float32BufferAttribute(side, 1), index: new THREE.Uint16BufferAttribute(idx, 1) };
}
