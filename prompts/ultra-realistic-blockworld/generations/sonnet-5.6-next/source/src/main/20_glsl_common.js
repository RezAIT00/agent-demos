// ================================================================ GLSL shared chunks
const G_COMMON = /* glsl */`
#define PI 3.14159265359
#define sat(x) clamp(x, 0.0, 1.0)
float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3 hash33(vec3 p3){ p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
// interleaved gradient noise, animated by golden ratio
float ign(vec2 px, float frame){ return fract(52.9829189 * fract(dot(px + mod(frame, 64.0) * 5.588238, vec2(0.06711056, 0.00583715)))); }
vec2 octWrap(vec2 v){ return (1.0 - abs(v.yx)) * vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0); }
vec2 octEncode(vec3 n){ n /= (abs(n.x) + abs(n.y) + abs(n.z)); return n.z >= 0.0 ? n.xy : octWrap(n.xy); }
vec3 octDecode(vec2 f){ vec3 n = vec3(f, 1.0 - abs(f.x) - abs(f.y)); float t = max(-n.z, 0.0); n.x += n.x >= 0.0 ? -t : t; n.y += n.y >= 0.0 ? -t : t; return normalize(n); }
vec3 srgbToLin(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

const G_WIND = /* glsl */`
uniform float uTime;
uniform vec4 uWind;
vec2 windAt(vec2 p){
  vec2 d = uWind.xy; vec2 o = vec2(-d.y, d.x);
  float g = sin(dot(p, d) * 0.085 - uTime * 1.25 + sin(dot(p, o) * 0.047) * 2.2) * 0.5 + 0.5;
  g *= g;
  float g2 = sin(dot(p, d * 0.8 + o * 0.35) * 0.27 - uTime * 2.3 + sin(dot(p, o) * 0.19)) * 0.5 + 0.5;
  float amp = uWind.z * (0.22 + g * 1.15 + g2 * 0.32);
  vec2 flutter = vec2(sin(uTime * 3.1 + p.x * 1.7 + p.y * 0.9), cos(uTime * 2.7 + p.x * 1.1 - p.y * 1.5)) * 0.14 * uWind.z;
  return d * amp + flutter;
}
vec3 windSway(vec3 wp, float sway, int flags){
  vec2 w = windAt(wp.xz);
  if ((flags & 32) != 0) return vec3(w.x * 0.19, -abs(w.x + w.y) * 0.035, w.y * 0.19) * sway;
  float fl = sin(uTime * 4.1 + wp.x * 5.1 + wp.y * 3.3 + wp.z * 4.7);
  float br = sin(uTime * 1.1 + wp.x * 0.35 + wp.z * 0.41);
  return vec3(w.x * 0.085 + fl * 0.016 * uWind.z + br * 0.02 * uWind.z, fl * 0.018 * uWind.z, w.y * 0.085 + fl * 0.013 * uWind.z) * sway * 1.55;
}
`;

// G-buffer outputs and packing shared by every opaque material
const G_GBUF = /* glsl */`
layout(location = 0) out vec4 gA;
layout(location = 1) out vec4 gN;
layout(location = 2) out vec4 gL;
layout(location = 3) out vec4 gM;
// matClass: 0 standard, 1 foliage, 2 snow, 3 skin/fur, 4 ice/crystal, 5 lava, 6 distant water
void writeG(vec3 albedo, float ao, vec3 N, float rough, float metal, vec4 light, float emissive, float matClass, float face, float extra, float flags){
  gA = vec4(sqrt(sat(albedo)), sat(ao));
  gN = vec4(octEncode(N), sat(rough), sat(metal));
  gL = vec4(sqrt(sat(light.rgb)), sat(light.a));
  gM = vec4(sqrt(sat(emissive / 64.0)), (matClass + face * 8.0) / 255.0, sat(extra), flags / 255.0);
}
`;
