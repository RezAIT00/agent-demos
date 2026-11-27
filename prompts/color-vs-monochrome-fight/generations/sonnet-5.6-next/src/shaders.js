// shaders.js — all GLSL
const GLSL_NOISE = `
float hash13(vec3 p){ p=fract(p*.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vnoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x), mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x), mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z); }
float noise2(vec2 x){ vec2 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x),f.y); }
float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5;} return s/0.9375; }
float fbm3(vec3 p){ return (vnoise(p)*.57+vnoise(p*2.03+3.1)*.29+vnoise(p*4.1+7.7)*.14); }
float fbm2(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*noise2(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,1.7); a*=.5;} return s/0.97; }
float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
`;

// IRO's paint palette (the only source of colour in the world)
const GLSL_PALETTE = `
vec3 herPal(float k){
  k = fract(k)*5.0;
  if(k<1.0) return vec3(1.00,0.16,0.50);   // magenta
  if(k<2.0) return vec3(1.00,0.32,0.14);   // vermilion
  if(k<3.0) return vec3(1.00,0.76,0.12);   // gold
  if(k<4.0) return vec3(0.05,0.80,0.76);   // turquoise
  return vec3(0.46,0.22,0.95);             // violet
}
`;

const GLSL_PAINT = `
uniform int uSplatN;
uniform vec4 uSplatA[48];   // xyz centre, w radius
uniform vec4 uSplatB[48];   // type(1 colour,2 ink), seed, birth(s), alpha
uniform vec4 uDrain;        // xyz centre, w radius : world pulled to ink wash
uniform vec4 uAsh;          // x global amount, y centre x, z clear radius, w amount outside the radius
uniform float uAshLum;      // how pale the ash is (grey in the lull, paper at the end)
uniform vec4 uBloomC;       // final ensō colour bloom: x,z centre, radius, amount
vec3 settleAsh(vec3 col, vec3 p){
  float amt = uAsh.x;
  if(uAsh.w > 0.0) amt = max(amt, uAsh.w*smoothstep(uAsh.z-2.0, uAsh.z+7.0, length(p.xz - vec2(uAsh.y, 0.0))));
  if(amt <= 0.0) return col;
  bool paper = uAshLum > 0.6;
  float l = luma(col);
  float target = mix(l, uAshLum, paper ? 0.72 : 0.60);
  float thin = paper ? 0.0 : smoothstep(0.655, 0.672, fbm3(p*0.30 + 11.0));
  vec3 grey = vec3(target * (0.965 + 0.07*step(0.56, fbm3(p*0.85))));
  float cover = amt * (paper ? 0.975 : 0.985) * (1.0 - thin*0.86);
  return mix(col, grey, clamp(cover, 0.0, 0.985));
}
vec3 inkWash(float l){
  float v = l<0.28 ? 0.028 : (l<0.46 ? 0.095 : (l<0.62 ? 0.21 : 0.47));
  return vec3(v);
}
// her colour, laid inside his circle: applied last so nothing can dull it
vec3 bloomPaint(vec3 col, vec3 p, float lb, float tone){
  if(uBloomC.w <= 0.0) return col;
  vec2 q = p.xz - uBloomC.xy;
  float rq = length(q);
  float a = atan(q.y, q.x);
  float rim = uBloomC.z*(0.84 + 0.20*fbm3(vec3(a*3.0, 1.0, 2.0)) + 0.07*noise2(vec2(a*17.0, 2.0)));
  float outer = step(rq, uBloomC.z*1.07) * step(0.84, vnoise(vec3(p.xz*1.3, 4.0)));
  if(rq >= rim && outer < 0.5) return col;
  vec3 wq = vec3(p.xz*0.075, 3.0);
  float w1 = fbm3(wq + fbm3(wq*1.9)*1.6);
  float k = a/6.2831*2.0 + w1*1.5 + rq*0.030;
  vec3 c = herPal(k);
  float petal = noise2(vec2(a*19.0 + fbm3(vec3(p.xz*0.1,1.0))*6.0, rq*0.10));
  if(petal>0.70) c = mix(c, vec3(1.0,0.95,0.82), 0.55); else if(petal<0.24) c*=0.74;
  c *= (0.84 + 0.24*tone)*(0.92 + 0.14*lb);
  if(rq > rim - 0.55) c *= 0.70;
  c = mix(c, vec3(1.0,0.95,0.80), smoothstep(uBloomC.z*0.30, uBloomC.z*0.06, rq + (fbm3(vec3(p.xz*0.3,9.0))-0.5)*4.0));
  return mix(col, c, uBloomC.w);
}
vec3 drainInk(vec3 col, vec3 p){
  if(uDrain.w <= 0.0) return col;
  float dd = length((p - uDrain.xyz)*vec3(1.0,0.7,1.0)) + (fbm3(p*0.3)-0.5)*6.0;
  if(dd >= uDrain.w) return col;
  vec3 w = inkWash(luma(col));
  float edge = uDrain.w - dd;
  vec3 r = mix(vec3(0.0), w, smoothstep(0.0, 1.2, edge));
  if(edge > 1.2 && edge < 1.7 && uDrain.w < 120.0) r = vec3(0.86);
  return r;
}
vec3 warp3(vec3 q){ return vec3(fbm3(q), fbm3(q+5.2), fbm3(q+9.1)); }
vec3 herPaint(vec3 p, float R, float seed){
  vec3 q = p*(1.5/(0.35+R*0.34)) + seed*3.0;
  vec3 w = warp3(q);
  float k = fbm3(q*0.75 + w*1.9)*2.9 + seed*0.37;
  vec3 col = herPal(k);
  float st = fbm3(q*2.3 + w*2.6);
  if(st>0.66) col = mix(col, vec3(1.0,0.94,0.80), 0.45);
  else if(st<0.34) col *= 0.72;
  return col;
}
float inkField(vec3 p, float R, float seed){
  vec3 q = p*(1.7/(0.35+R*0.34)) + seed*5.0;
  return fbm3(q*vec3(1.0,0.55,1.0) + warp3(q)*2.4);
}
// organic splash outline: lumps, thrown fingers, holes and speckle, all sized to the splat
float splatMask(vec3 p, vec3 c, float R, float seed, out float rim){
  vec3 d = p - c; d.y *= 0.75;
  float dist = length(d);
  rim = 0.0;
  if(dist > R*1.55) return 0.0;
  float ns = 2.4/(0.35 + R*0.48);
  float n = fbm3(p*ns + seed*7.1);
  float fingers = pow(vnoise(d/max(dist,1e-4)*5.5 + seed*13.0), 5.0);
  float edge = R*(0.48 + 0.62*n + 0.62*fingers);
  if(dist < edge){
    if(dist > R*0.38 && vnoise(p*ns*2.7 + seed*2.0) > 0.77) return 0.0;
    rim = (edge - dist) < 0.06*(0.4+R*0.12) ? 1.0 : 0.0;
    return 1.0;
  }
  float sp = vnoise(p*ns*4.0 + seed*3.0);
  return (sp > 0.83 + (dist/R-0.95)*0.16) ? 1.0 : 0.0;
}
// base: surface colour before lighting; tone: 0..1 lighting band; cutoff: splats born after this are ignored (for flying debris)
vec3 applyPaint(vec3 p, vec3 base, float tone, float cutoff, float wall){
  vec3 col = base;
  for(int i=0;i<48;i++){
    if(i>=uSplatN) break;
    vec4 A = uSplatA[i], B = uSplatB[i];
    if(B.z > cutoff || A.w<=0.0) continue;
    float rim;
    if(splatMask(p, A.xyz, A.w, B.y, rim) < 0.5) continue;
    float lb = luma(base);
    vec3 c;
    if(B.x < 1.5){
      c = herPaint(p, A.w, B.y);
      c = mix(vec3(luma(c)), c, wall>0.5 ? 0.80 : 0.86);
      c *= (0.50 + 0.62*tone) * (0.58 + 0.62*lb);
      if(rim>0.5) c *= 0.62;
    } else {
      float f = inkField(p, A.w, B.y);
      float v;
      if(wall>0.5) v = f>0.665 ? 0.74 : (f>0.545 ? 0.40 : 0.235);
      else v = f>0.69 ? 0.80 : (f>0.59 ? 0.40 : (f>0.46 ? 0.17 : 0.075));
      c = vec3(v * (0.74 + 0.36*tone));
      if(lb<0.25) c *= 0.8;
      if(rim>0.5) c *= 0.55;
    }
    col = mix(col, c, B.w);
  }
  return col;
}
`;

const GLSL_GROUND = `
uniform vec4 uCrater[8];     // x,z,R,depth
uniform float uCraterP[8];
uniform int uCraterN;
uniform vec4 uFissure;       // x0,x1,z,halfWidth
uniform float uFisP;
uniform vec4 uRip[8];        // x,z,age(s),amp
uniform int uRipN;
float gHash(float n){
  uint u = uint(int(n)) ^ 0x5bd1e995u; u *= 0x27d4eb2du; u ^= u >> 15; u *= 0x2c1b3c6du; u ^= u >> 13;
  return float(u)/4294967296.0;
}
float gNoise1(float x){ float i=floor(x), f=fract(x); f=f*f*(3.-2.*f); return mix(gHash(i),gHash(i+1.),f); }
float groundH(vec2 p){
  float h = 0.0;
  for(int i=0;i<8;i++){
    if(i>=uCraterN) break;
    vec4 c = uCrater[i]; float pr = uCraterP[i];
    if(pr<=0.0) continue;
    vec2 d = p - c.xy; float a = atan(d.y,d.x);
    float R = c.z*(0.9 + 0.22*gNoise1(a*5.0+float(i)*7.3) );
    float r = length(d)/R;
    if(r<1.0) h += -c.w*pow(1.0-r*r, 0.7)*pr;
    h += c.w*0.34*exp(-pow((r-1.04)/0.14,2.0))*pr*(0.6+0.8*gNoise1(a*17.0));
  }
  if(uFisP>0.0){
    float keep = 1.0;
    for(int i=0;i<8;i++){
      if(i>=uCraterN) break;
      vec4 c = uCrater[i];
      if(c.z > 10.0 && uCraterP[i] > 0.0) keep = min(keep, 1.0 - uCraterP[i]*(1.0 - smoothstep(0.78, 1.16, length(p-c.xy)/c.z)));
    }
    float reach = mix(uFissure.x, uFissure.y, uFisP);
    float fis = 0.0;
    if(p.x > uFissure.x-1.5 && p.x < reach+1.5){
      float jag = (gNoise1(p.x*0.55)-0.5)*2.4 + (gNoise1(p.x*1.9)-0.5)*0.7;
      float dz = abs(p.y - uFissure.z - jag);
      float endf = smoothstep(uFissure.x-1.5, uFissure.x+3.0, p.x)*smoothstep(reach+1.5, reach-4.0, p.x);
      float w = uFissure.w*(0.55+0.9*gNoise1(p.x*0.23+3.0))*endf;
      fis += -3.6*smoothstep(w, w*0.25, dz)*endf;
      fis += 0.85*exp(-pow((dz-w*1.35)/0.60,2.0))*endf*(0.5+gNoise1(p.x*0.9));
    }
    h += fis*keep;
  }
  for(int i=0;i<8;i++){
    if(i>=uRipN) break;
    vec4 rp = uRip[i];
    float r = length(p - rp.xy);
    float front = 38.0*rp.z;
    float x = (r - front)/2.2;
    h += rp.w*exp(-rp.z*2.6)*exp(-x*x)*cos(x*2.4)*smoothstep(0.8, 4.0, r);
  }
  return h;
}
`;

const GLSL_SHADOW = `
uniform sampler2DShadow uShadowMap;
uniform mat4 uShadowVP;
uniform float uShadowOn;
float shadowAt(vec3 wp, vec3 n){
  if(uShadowOn<0.5) return 1.0;
  vec4 s = uShadowVP*vec4(wp + n*0.06, 1.0);
  vec3 q = s.xyz/s.w*0.5+0.5;
  if(q.x<0.002||q.x>0.998||q.y<0.002||q.y>0.998||q.z>1.0) return 1.0;
  float t = 1.0/4096.0;
  float v = texture(uShadowMap, vec3(q.xy+vec2(-t,-t), q.z-0.0007))
          + texture(uShadowMap, vec3(q.xy+vec2( t,-t), q.z-0.0007))
          + texture(uShadowMap, vec3(q.xy+vec2(-t, t), q.z-0.0007))
          + texture(uShadowMap, vec3(q.xy+vec2( t, t), q.z-0.0007));
  return smoothstep(1.4, 2.6, v);
}
`;

const GLSL_GBUF_OUT = `
layout(location=0) out vec4 oColor;
layout(location=1) out vec4 oNrmDepth;
layout(location=2) out vec4 oId;
`;

// ------------------------------------------------------------------ world chunks
const VS_CHUNK = `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in float aChunk;
layout(location=3) in vec4 aMeta;
layout(location=4) in vec3 aRest;
uniform sampler2D uChunkTex;
uniform mat4 uVP, uView;
out vec3 vWorld, vRest, vNrm, vRestNrm, vViewN;
out vec4 vMeta, vTag;
out float vDepth;
vec3 qrot(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }
void main(){
  int c = int(aChunk+0.5);
  int x = (c % 512)*3; int y = c/512;
  vec4 t0 = texelFetch(uChunkTex, ivec2(x,y),0);
  vec4 t1 = texelFetch(uChunkTex, ivec2(x+1,y),0);
  vec4 t2 = texelFetch(uChunkTex, ivec2(x+2,y),0);
  vec3 wp = t0.xyz + qrot(t1, aPos*t2.w);
  vec3 n = qrot(t1, aNrm);
  vWorld=wp; vRest=aRest; vNrm=n; vRestNrm=aNrm; vMeta=aMeta; vTag=vec4(t2.xyz, t0.w);
  vViewN = mat3(uView)*n;
  vec4 vp = uView*vec4(wp,1.0); vDepth = -vp.z;
  gl_Position = uVP*vec4(wp,1.0);
  if(t0.w < 0.5) gl_Position = vec4(2.0,2.0,2.0,1.0);
}`;

const GLSL_ENVLIGHT = `
uniform vec3 uSunDir;
uniform vec3 uCamPos;
uniform vec3 uFogCol;
uniform float uFogDen;
uniform float uSceneDim;
uniform vec4 uGlass[6];  // xyz centre, w radius: windows inside are broken
vec3 applyFog(vec3 col, vec3 wp){
  float d = length(wp-uCamPos);
  float f = 1.0 - exp(-max(d-14.0,0.0)*uFogDen);
  return mix(col, uFogCol, clamp(f,0.0,0.88));
}
`;

const FS_CHUNK = `
${GLSL_GBUF_OUT}
in vec3 vWorld, vRest, vNrm, vRestNrm, vViewN;
in vec4 vMeta, vTag;
in float vDepth;
${GLSL_NOISE}${GLSL_PALETTE}${GLSL_PAINT}${GLSL_SHADOW}${GLSL_ENVLIGHT}
void main(){
  vec3 n = normalize(vNrm);
  if(!gl_FrontFacing) n = -n;
  int st = int(vMeta.x+0.5);
  float seed = vMeta.y;
  float alb = vMeta.z;
  vec3 rn = normalize(vRestNrm);
  vec2 fuv = abs(rn.x)>abs(rn.z) ? vec2(vRest.z, vRest.y) : vec2(vRest.x, vRest.y);
  float aa = fwidth(fuv.x)+fwidth(fuv.y);
  float a = alb;
  bool fracture = false;
  float lineMul = 1.0;
  float emis = 0.0;
  if(st==1){ // facade with windows
    float bayW = 2.1 + fract(seed*7.13)*1.5;
    float flH = 3.5;
    float style = floor(fract(seed*3.7)*3.0);
    vec2 cell = vec2(floor((fuv.x + seed*11.0)/bayW), floor(fuv.y/flH));
    vec2 f = vec2(fract((fuv.x + seed*11.0)/bayW), fract(fuv.y/flH));
    float mx = style<0.5 ? 0.16 : (style<1.5 ? 0.05 : 0.27);
    float y0 = style<1.5 ? 0.24 : 0.2, y1 = style<0.5 ? 0.86 : (style<1.5 ? 0.9 : 0.8);
    bool win = f.x>mx && f.x<1.0-mx && f.y>y0 && f.y<y1 && vRest.y>0.4;
    if(f.y<0.07) a = alb*1.22;
    else if(f.y<0.11) a = alb*0.62;
    if(win){
      float refl = step(0.62, fract((f.x*bayW + f.y*flH)*0.21 + hash12(cell+seed)*3.0));
      a = mix(0.31, 0.52, refl) + hash12(cell*1.7+seed)*0.06;
      float fx = min(f.x-mx, 1.0-mx-f.x)*bayW, fy = min(f.y-y0, y1-f.y)*flH;
      if(min(fx,fy) < 0.07) a = alb*1.18;
      if(abs(f.x-0.5)*bayW < 0.035) a = alb*0.9;
      vec3 wc = vRest;
      for(int i=0;i<6;i++){
        if(uGlass[i].w<=0.0) continue;
        float d = length(wc - uGlass[i].xyz) + hash12(cell+float(i))*5.0;
        if(d < uGlass[i].w && hash12(cell*3.1+float(i)+seed)>0.38){
          vec2 g = (f-0.5)*vec2(bayW,flH);
          float ang = atan(g.y,g.x);
          float jag = 0.30 + 0.50*noise2(vec2(ang*3.5, hash12(cell)*20.0));
          float rr_ = length(g/vec2(bayW*0.5, flH*0.36));
          a = rr_ < jag+0.2 ? 0.255 : (rr_<jag+0.28 ? 0.70 : a);
        }
      }
    }
  } else if(st==2){ // broken concrete
    fracture = true;
    float sp = vnoise(vRest*5.0);
    a = alb*0.80 + (sp>0.68?0.14:0.0) - (sp<0.25?0.1:0.0);
    if(abs(fract(vRest.y*1.3+vRest.x*0.4)-0.5)<0.02 && vnoise(vRest*1.1)>0.55) a = 0.14;
  } else if(st==3){
    a = alb*0.82 + step(0.6,vnoise(vRest*1.7))*0.05;
  } else if(st==6){ // brick
    float row = floor(fuv.y/0.24);
    float u = fuv.x/0.56 + 0.5*mod(row,2.0);
    float mortar = max(step(fract(fuv.y/0.24),0.12), step(fract(u),0.055));
    a = mortar>0.5 ? 0.74 : alb*(0.78 + 0.44*hash12(vec2(floor(u),row)));
    if(abs(dot(rn,vec3(0,1,0)))>0.7) a = alb*0.9;
  } else if(st==7){ // stone
    float v = fbm3(vRest*2.2);
    a = alb*(0.92 + 0.2*v);
    if(abs(fbm3(vRest*1.3+4.0)-0.5)<0.012) a *= 0.55;
    if(fract(vRest.y/1.05)<0.035) a *= 0.6;
  } else if(st==9){ // car glass
    a = 0.2 + step(0.6,fract((vRest.x+vRest.y)*0.9))*0.3;
  } else if(st==11){ a = 0.95; emis = 0.6; }
  else if(st==13){ // flying glass
    a = 0.80 + 0.18*step(0.5, fract(dot(n, vec3(2.1,3.3,1.7))*2.0)); emis=0.4; lineMul=0.35;
  } else if(st==14){ fracture=true; a = alb; lineMul = 0.45; } // gravel

  float ndl = dot(n, uSunDir);
  float sh = shadowAt(vWorld, n);
  float band = ndl>0.12 ? 1.0 : (ndl>-0.35 ? 0.42 : 0.0);
  band = min(band, mix(0.42, 1.0, sh));
  float mul = band>0.9 ? 1.10 : (band>0.3 ? 0.76 : 0.56);
  mul = mix(mul, 1.05, emis);
  // painterly modulation
  float br = fbm3(vRest*vec3(0.45,1.5,0.45) + seed*3.0);
  a *= 0.92 + 0.17*br;
  a *= mix(0.80, 1.0, clamp(vRest.y*0.22+0.25, 0.0, 1.0));
  vec3 base = vec3(a);
  float launch = vTag.x;
  vec3 col = applyPaint(vRest, base, band, launch, abs(rn.y)<0.5 ? 1.0 : 0.0);
  if(col == base) col = base*mul; else if(luma(abs(col-base))<0.001) col = base*mul;
  else col *= mix(0.9, 1.05, band);
  float tag = vTag.y;
  if(tag > 0.5){
    float tn = vnoise(vRest*3.7 + vTag.z*9.0)*0.72 + vnoise(vRest*9.0)*0.28;
    bool on = (fracture && tn>0.57) || tn>0.74;
    if(on){
      if(tag < 1.5){
        vec3 hc = herPal(fbm3(vRest*0.23)*2.7 + vTag.z*0.16);
        hc = mix(vec3(luma(hc)), hc, 0.88);
        col = hc*(band>0.9?0.98:(band>0.3?0.69:0.47));
      } else {
        float v = tn>0.79 ? 0.80 : 0.15;
        col = vec3(v*(band>0.3?1.0:0.75));
      }
    }
  }
  col = bloomPaint(drainInk(settleAsh(col, vRest), vRest), vRest, a, band);
  col *= uSceneDim;
  col = applyFog(col, vWorld);
  oColor = vec4(col,1.0);
  oNrmDepth = vec4(normalize(vViewN)*(gl_FrontFacing?1.0:-1.0), vDepth);
  oId = vec4(3.0/255.0, lineMul, 0.0, 1.0);
}`;

// ------------------------------------------------------------------ ground
const VS_GROUND = `
layout(location=0) in vec2 aXZ;
uniform mat4 uVP, uView;
${GLSL_GROUND}
out vec3 vWorld; out float vDepth; out float vH;
void main(){
  float h = groundH(aXZ);
  vec3 wp = vec3(aXZ.x, h, aXZ.y);
  vWorld = wp; vH = h;
  vec4 vp = uView*vec4(wp,1.0); vDepth = -vp.z;
  gl_Position = uVP*vec4(wp,1.0);
}`;

const FS_GROUND = `
${GLSL_GBUF_OUT}
in vec3 vWorld; in float vDepth; in float vH;
uniform mat4 uView;
uniform float uMacro;      // 1: hook floor tiles
uniform vec4 uEnso;        // x,z,radius,progress
${GLSL_NOISE}${GLSL_PALETTE}${GLSL_PAINT}${GLSL_GROUND}${GLSL_SHADOW}${GLSL_ENVLIGHT}
float gridLine(float x, float w){ float fw = fwidth(x); float d = abs(fract(x+0.5)-0.5); return 1.0 - smoothstep(w, w+fw*1.2, d); }
void main(){
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  if(n.y<0.0) n=-n;
  vec2 p = vWorld.xz;
  float a;
  float pr = length(p);
  if(pr < 17.0){
    // radial plaza paving
    float ring = pr/1.7;
    float segs = max(floor(ring)*6.0, 6.0);
    float ang = atan(p.y,p.x)/6.2831*segs;
    a = 0.60 + 0.07*(hash12(vec2(floor(ring), floor(ang)))-0.5)*2.0;
    float lr = 1.0 - smoothstep(0.012, 0.012+fwidth(ring)*1.3, abs(fract(ring+0.5)-0.5));
    float la = 1.0 - smoothstep(0.016, 0.016+fwidth(ang)*1.3, abs(fract(ang+0.5)-0.5));
    a = mix(a, 0.34, max(lr, la*step(1.0,ring)));
    if(abs(pr-10.2)<0.35) a = 0.45;
    if(abs(pr-16.6)<0.4) a = 0.74;
  } else if(abs(p.y) < 7.5){
    a = 0.37 + 0.03*(noise2(p*0.7)-0.5)*2.0;
    if(abs(p.y)<0.12 && fract(p.x*0.16)<0.55) a = 0.74;
    if(abs(abs(p.y)-6.4)<0.09) a = 0.66;
    if(abs(abs(p.y)-7.3)<0.2) a = 0.70;
    if(mod(p.x+8.0,38.0)<3.2 && abs(p.y)<6.0 && fract(p.y*0.75)<0.5) a = 0.72;
  } else {
    vec2 t = p/1.5;
    a = 0.52 + 0.08*(hash12(floor(t))-0.5);
    a = mix(a, 0.33, max(gridLine(t.x,0.014), gridLine(t.y,0.014)));
  }
  if(uMacro>0.5){
    vec2 t = p/0.62 + vec2(0.37,0.31);
    a = 0.56 + 0.07*(hash12(floor(t))-0.5)*2.0;
    a += (fbm2(p*17.0)-0.5)*0.12;
    a -= step(0.80, noise2(p*48.0))*0.07;
    a = mix(a, 0.28, max(gridLine(t.x,0.012), gridLine(t.y,0.012)));
  }
  // wear and wash
  a *= 0.93 + 0.14*fbm2(p*0.21);
  a -= 0.05*step(0.66, fbm2(p*1.3+7.0));
  // broken earth inside craters and fissure
  float inCr = 0.0;
  for(int i=0;i<8;i++){
    if(i>=uCraterN) break;
    vec4 c = uCrater[i]; if(uCraterP[i]<=0.0) continue;
    float r = length(p-c.xy)/c.z;
    if(r<1.18){
      float cs = max(c.z*0.11, 0.5);
      vec2 q = p/cs + vec2(noise2(p*0.6), noise2(p*0.6+9.0))*0.9;
      vec2 ip = floor(q), fp = fract(q); float d1=9.0, d2=9.0; vec2 id1;
      for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 o=hash22(ip+g); float d=length(g+o-fp); if(d<d1){d2=d1;d1=d;id1=ip+g;} else if(d<d2) d2=d; }
      float edge = d2-d1;
      float k = smoothstep(1.18, 0.9, r)*uCraterP[i];
      float ca = 0.30 + 0.24*hash12(id1) ;
      if(edge<0.06) ca = 0.07;
      ca *= mix(0.68, 1.12, smoothstep(0.15, 0.95, r));
      if(r>0.94 && r<1.12 && edge>0.1) ca += 0.17;
      a = mix(a, ca, k); inCr = max(inCr,k);
    }
  }
  float canyon = 0.0;
  if(uFisP>0.0){
    float reach = mix(uFissure.x, uFissure.y, uFisP);
    if(p.x > uFissure.x-1.0 && p.x < reach){
      float keep = 1.0;
      for(int i=0;i<8;i++){
        if(i>=uCraterN) break;
        vec4 c = uCrater[i];
        if(c.z > 10.0 && uCraterP[i] > 0.0) keep = min(keep, 1.0 - uCraterP[i]*(1.0 - smoothstep(0.78, 1.16, length(p-c.xy)/c.z)));
      }
      float jag = (gNoise1(p.x*0.55)-0.5)*2.4 + (gNoise1(p.x*1.9)-0.5)*0.7;
      float dz = abs(p.y - uFissure.z - jag) + (noise2(p*3.1)-0.5)*0.22;
      float endf = smoothstep(uFissure.x-1.5, uFissure.x+3.0, p.x)*smoothstep(reach+1.5, reach-4.0, p.x);
      float w = uFissure.w*(0.55+0.9*gNoise1(p.x*0.23+3.0))*endf*keep;
      if(w > 0.12){
        if(dz < w*0.82) { a = 0.015; canyon = 1.0; }
        else if(dz < w*1.04) { a = 0.93; canyon = 0.5; }
        else if(dz < w*1.20) a = 0.12;
      }
    }
  }
  float ndl = dot(n, uSunDir);
  float sh = shadowAt(vWorld, n);
  float band = ndl>0.34 ? 1.0 : (ndl>-0.1 ? 0.42 : 0.0);
  band = min(band, mix(0.30, 1.0, sh));
  float mul = band>0.9 ? 1.08 : (band>0.35 ? 0.80 : (band>0.2 ? 0.66 : 0.54));
  vec3 base = vec3(a);
  vec3 col = applyPaint(vWorld, base, band, 1e9, 0.0);
  if(col == base) col = base*mul; else col *= mix(0.74, 1.04, band);
  if(canyon > 0.4) col = vec3(canyon > 0.7 ? 0.012 : 0.88);
  col = bloomPaint(drainInk(settleAsh(col, vWorld), vWorld), vWorld, a, band);
  // the final ensō: one brush stroke of ink around her colour
  if(uEnso.w > 0.0){
    vec2 q = p - uEnso.xy; float r = length(q);
    float ang = atan(q.y, q.x);
    float u = fract((ang - 2.25)/6.2831);       // 0..1 along the stroke
    float prog = uEnso.w;
    if(u < prog*0.94){
      float t = u/0.94;
      float wdt = uEnso.z*0.135*(0.40 + 0.80*smoothstep(0.0,0.07,t) - 0.52*smoothstep(0.55,1.0,t));
      wdt *= 0.9 + 0.3*noise2(vec2(t*23.0, 2.0));
      float rc = uEnso.z*(1.0 + 0.045*sin(t*9.0+1.0) - 0.05*t);
      float d = (r - rc)/wdt;
      if(abs(d) < 1.0){
        float bristle = noise2(vec2(d*13.0 + noise2(vec2(t*8.0,d*2.0))*2.0, t*5.0));
        float dry = smoothstep(0.5, 1.0, t)*0.78 + smoothstep(0.55,1.0,abs(d))*0.30;
        if(bristle > dry - 0.05){
          col = vec3(0.028 + 0.05*step(0.78, noise2(vec2(d*24.0, t*3.0))));
        }
      }
    }
    // ink flecks flung off the stroke
    vec2 fl = p*0.55; vec2 ci = floor(fl); vec2 o = hash22(ci);
    float rc2 = abs(length((ci+o)/0.55 - uEnso.xy) - uEnso.z);
    if(prog>0.3 && rc2 < uEnso.z*0.28 && hash12(ci+3.0) > 0.86 && length(fract(fl)-o) < 0.10+0.28*hash12(ci)*(1.0-rc2/(uEnso.z*0.28))) col = vec3(0.04);
  }
  col *= uSceneDim;
  col = applyFog(col, vWorld);
  oColor = vec4(col,1.0);
  oNrmDepth = vec4(normalize(mat3(uView)*n), vDepth);
  oId = vec4(1.0/255.0, inCr>0.4?0.5:0.0, 0.0, 1.0);
}`;

// ------------------------------------------------------------------ crack decals (follow the ground)
const VS_CRACK = `
layout(location=0) in vec3 aPos;      // x, lift, z
layout(location=1) in vec4 aInfo;     // reveal distance, birth(s), type, seed
uniform mat4 uVP, uView;
uniform float uTime;
${GLSL_GROUND}
out vec3 vWorld; out float vDepth; out vec4 vInfo; out float vAge;
uniform vec2 uScour;   // time of the last blast, radius it strips
void main(){
  vec3 wp = vec3(aPos.x, groundH(aPos.xz) + 0.018 + aPos.y, aPos.z);
  vWorld = wp; vInfo = aInfo; vAge = uTime - aInfo.y;
  if(aInfo.y < uScour.x && uTime > uScour.x + 0.15 && length(aPos.xz - vec2(23.5, 0.0)) < uScour.y) vAge = -1.0;
  vec4 vp = uView*vec4(wp,1.0); vDepth = -vp.z;
  gl_Position = uVP*vec4(wp,1.0);
}`;
const FS_CRACK = `
${GLSL_GBUF_OUT}
in vec3 vWorld; in float vDepth; in vec4 vInfo; in float vAge;
${GLSL_NOISE}${GLSL_PALETTE}${GLSL_PAINT}${GLSL_ENVLIGHT}
void main(){
  if(vAge < 0.0 || vAge*60.0 < vInfo.x) discard;
  vec3 col = vec3(0.05);
  float typ = vInfo.z;
  if(typ > 0.5 && typ < 1.5){
    float k = fbm3(vWorld*0.35 + vInfo.w) + length(vWorld.xz)*0.01;
    col = herPal(k*1.7 + vInfo.w) * 0.90;
  }
  col = drainInk(settleAsh(col, vWorld), vWorld);
  col = applyFog(col*uSceneDim, vWorld);
  oColor = vec4(col,1.0);
  oNrmDepth = vec4(0.0,0.0,1.0, vDepth);
  oId = vec4(1.0/255.0, 0.0, 0.0, 1.0);
}`;

// ------------------------------------------------------------------ cloud sea (only seen in the sky act)
const VS_CLOUDS = `
layout(location=0) in vec2 aXZ;
uniform mat4 uVP, uView; uniform float uCloudY, uTime;
out vec3 vWorld; out float vDepth;
${GLSL_NOISE}
void main(){
  float h = (fbm2(aXZ*0.035 + vec2(uTime*0.02,0.0)) - 0.5)*9.0 + (fbm2(aXZ*0.11)-0.5)*3.0;
  vec3 wp = vec3(aXZ.x, uCloudY + h, aXZ.y);
  vWorld = wp;
  vec4 vp = uView*vec4(wp,1.0); vDepth = -vp.z;
  gl_Position = uVP*vec4(wp,1.0);
}`;
const FS_CLOUDS = `
${GLSL_GBUF_OUT}
in vec3 vWorld; in float vDepth;
uniform mat4 uView; uniform float uTime;
uniform vec4 uHole;      // x,z,radius, paint amount
${GLSL_NOISE}${GLSL_PALETTE}${GLSL_ENVLIGHT}
float cHeight(vec2 p){ return (fbm2(p*0.035+vec2(uTime*0.02,0.0))-0.5)*9.0 + (fbm2(p*0.11)-0.5)*3.0 + pow(abs(fbm2(p*0.23)-0.5)*2.0,0.6)*1.4; }
void main(){
  vec2 p = vWorld.xz;
  vec2 q = p - uHole.xy; float r = length(q); float a = atan(q.y,q.x);
  float edge = uHole.z*(0.88 + 0.24*noise2(vec2(a*6.0, r*0.05)));
  if(uHole.z>0.0 && r < edge) discard;
  float h0 = cHeight(p);
  vec2 sd = normalize(uSunDir.xz);
  float lit = h0 - cHeight(p + sd*2.4);
  float v = lit > 0.45 ? 0.97 : (lit > -0.35 ? 0.80 : 0.62);
  v += (fbm2(p*0.4)-0.5)*0.05;
  v *= 0.9 + 0.16*smoothstep(-4.0,4.0,h0);
  vec3 col = vec3(v);
  if(uHole.z>0.0){
    float band = r - edge;
    if(band < 5.0 + 4.0*noise2(vec2(a*14.0, 1.0))){
      float dn = q.x + (noise2(q*0.09)-0.5)*9.0;
      if(dn < 0.0){ vec3 c = herPal(a/6.2831*2.0 + noise2(q*0.06)); col = mix(col, c*(v+0.12), uHole.w); }
      else { float s = noise2(vec2(a*30.0, r*0.12)); col = mix(col, vec3(s>0.62?0.9:(s>0.42?0.3:0.05)), uHole.w); }
    }
    // pressure rings pushed through the cloud tops
    float ring = fract((r-edge)/7.0);
    if(r-edge < 34.0 && ring<0.08) col *= 0.74;
  }
  col *= uSceneDim;
  col = applyFog(col, vWorld);
  oColor = vec4(col,1.0);
  oNrmDepth = vec4(0.0,0.0,1.0, vDepth);
  oId = vec4(2.0/255.0, 0.0, 0.0, 1.0);
}`;

// ------------------------------------------------------------------ painted sky
const FS_SKY = `
${GLSL_GBUF_OUT}
in vec2 vUv;
uniform mat4 uInvVP; uniform vec3 uCamPos2;
uniform float uTime, uDark, uSkylineErase, uAltitude;
uniform vec3 uSunDir;
uniform vec4 uSkyA[10];     // dir xyz, angular radius
uniform vec4 uSkyB[10];     // type, seed, alpha, -
uniform int uSkyN;
uniform float uSceneDim;
uniform vec4 uSkyDrain;     // dir, radius
uniform float uSkyBloom;
${GLSL_NOISE}${GLSL_PALETTE}
vec3 paintSwirl(vec3 d, vec3 c, float seed){
  vec3 q = d*3.4 + seed*2.0;
  vec3 w = vec3(fbm3(q), fbm3(q+5.2), fbm3(q+9.1));
  vec3 col = herPal(fbm3(q*0.8 + w*1.8)*2.8 + seed);
  float st = fbm3(q*2.6*vec3(1.0,2.6,1.0) + w*2.2);
  if(st>0.66) col = mix(col, vec3(1.0,0.93,0.78), 0.55); else if(st<0.34) col*=0.74;
  return col;
}
void main(){
  vec4 h = uInvVP*vec4(vUv*2.0-1.0, 1.0, 1.0);
  vec3 d = normalize(h.xyz/h.w - uCamPos2);
  float el = d.y;
  // gradient
  float top = mix(0.40, 0.07, uDark), hor = mix(0.84, 0.42, uDark);
  float v = mix(hor, top, pow(clamp(el*1.25,0.0,1.0), 0.65));
  v = mix(v, hor+0.07, exp(-abs(el)*14.0)*0.6);
  // big cumulus
  float cl = 0.0;
  if(el > -0.05){
    vec2 uv = d.xz/(abs(el)+0.22);
    vec2 w = vec2(uTime*0.012, uTime*0.004);
    float n1 = fbm2(uv*1.15 + w);
    float n2 = fbm2(uv*3.1 + w*1.7 + n1*1.4);
    float dens = n1*0.72 + n2*0.34;
    float m = smoothstep(0.585, 0.60, dens);
    vec2 sunOff = normalize(uSunDir.xz)*0.09;
    float n1b = fbm2((uv+sunOff)*1.15 + w);
    float densB = n1b*0.72 + fbm2((uv+sunOff)*3.1 + w*1.7 + n1b*1.4)*0.34;
    float edgeLit = dens - densB;
    float cv = edgeLit > 0.035 ? mix(0.98,0.66,uDark) : (edgeLit > -0.015 ? mix(0.76,0.30,uDark) : mix(0.56,0.15,uDark));
    float fade = smoothstep(-0.03, 0.14, el);
    v = mix(v, cv, m*fade);
    // thin dry-brush streaks
    float st = fbm2(vec2(atan(d.z,d.x)*5.0, el*34.0) + w*4.0);
    v += (st-0.5)*0.09*(1.0-m);
    v -= smoothstep(0.66,0.70,st)*0.06*fade;
    cl = m;
  }
  // sun disc
  float sd = distance(d, normalize(vec3(-0.55,0.30,-0.78)));
  v = mix(v, 0.99, smoothstep(0.062,0.058,sd)*(1.0-cl*0.85)*(1.0-uDark));
  v += exp(-sd*7.0)*0.10*(1.0-uDark);
  // painted skyline layers on the horizon
  float az = atan(d.z, d.x);
  if(el < 0.16 && uAltitude < 0.5){
    for(int k=0;k<3;k++){
      float fk = float(k);
      float scale = 46.0 + fk*31.0;
      float x = az*scale + fk*13.7;
      float id = floor(x);
      float hh = 0.018 + (2.0-fk)*0.008 + pow(hash12(vec2(id, fk+2.0)),2.2)*(0.085-fk*0.02);
      float fx = fract(x);
      if(fx>0.82 && hash12(vec2(id,fk+9.0))>0.5) hh *= 0.55;
      if(hash12(vec2(id,fk+5.0))>0.86 && abs(fx-0.5)<0.06) hh += 0.025;
      if(uSkylineErase > 0.0){
        float adiff = abs(mod(az + 1.5708 + 3.14159, 6.2831) - 3.14159);
        float er = clamp((uSkylineErase*4.2 - adiff - hash12(vec2(id,fk))*0.35)*2.2, 0.0, 1.0);
        float shatter = step(er, hash12(floor(vec2(x*5.0, el*420.0))));
        if(er>0.0 && (shatter<0.5 || er>0.97)) continue;
      }
      if(el < hh){
        float lv = mix(0.66 - (2.0-fk)*0.0, 0.50, fk/2.0);
        lv = mix(lv, lv*0.45, uDark);
        float winb = step(0.62, fract(el*520.0)) * step(0.55, hash12(vec2(floor(x*6.0), floor(el*520.0))));
        lv += winb*0.035;
        lv = mix(lv, hor, smoothstep(0.05,-0.02,el)*0.5);
        v = lv;
      }
    }
  }
  if(el < 0.0) v = mix(v, mix(0.52,0.2,uDark), smoothstep(0.0,-0.04,el));
  // paper grain in the wash
  v += (noise2(d.xy*420.0 + d.z*190.0)-0.5)*0.022;
  vec3 col = vec3(v);
  // paint and ink thrown across the sky
  for(int i=0;i<10;i++){
    if(i>=uSkyN) break;
    vec3 c = normalize(uSkyA[i].xyz); float R = uSkyA[i].w;
    if(R<=0.0) continue;
    float ang = acos(clamp(dot(d,c),-1.0,1.0));
    if(ang > R*2.3) continue;
    vec3 t = normalize(cross(c, vec3(0.07,1.0,0.03))); vec3 b = cross(c,t);
    float a = atan(dot(d,b), dot(d,t));
    float sd_ = uSkyB[i].y;
    a += ang*1.9*(hash12(vec2(sd_, 3.0))-0.35) + (fbm3(d*4.3 + sd_) - 0.5)*1.25;
    vec2 ring = vec2(cos(a), sin(a));
    float warp = fbm3(vec3(ring*2.1, ang*3.0 + sd_)) - 0.5;
    float lobe = fbm3(vec3(ring*3.3 + sd_, sd_*2.0));
    float ray = pow(vnoise(vec3(ring*6.5 + sd_*3.0, ang*2.2)), 3.5);
    float reach = R*(0.30 + 1.20*lobe + 0.62*ray) + (fbm3(d*13.0 + sd_*2.0)-0.5)*R*0.42;
    float x = ang/reach;
    if(x > 1.0) continue;
    // dry-brush bristles open up toward the tips
    float bristle = vnoise(vec3(ring*27.0 + warp*4.0, ang*7.0 + sd_))*0.75 + 0.25*vnoise(d*60.0);
    if(bristle < smoothstep(0.46, 1.0, x)*0.92) continue;
    float core = smoothstep(0.52, 0.0, x);
    vec3 pc;
    if(uSkyB[i].x < 1.5){
      float band = fbm3(vec3(ring*2.4 + warp*1.5, ang*1.6 - sd_))*3.1 + sd_*0.4;
      pc = herPal(band);
      pc = mix(vec3(luma(pc)), pc, 0.86);
      float st = vnoise(vec3(ring*26.0, ang*6.0 + 4.0));
      if(st > 0.70) pc = mix(pc, vec3(1.0,0.95,0.84), 0.55); else if(st < 0.27) pc *= 0.70;
      pc *= 0.58 + 0.55*v;
      pc = mix(pc, vec3(1.0,0.94,0.82), core*core*0.45);
      col = mix(col, pc, uSkyB[i].z*(0.90 - 0.22*smoothstep(0.4,1.0,x)));
    } else {
      float st = vnoise(vec3(ring*24.0 + warp*2.0, ang*5.0));
      float iv = st > 0.72 ? 0.74 : (st > 0.56 ? 0.30 : 0.055);
      iv = mix(iv, v*0.4, smoothstep(0.62,1.0,x)*0.5);
      col = mix(col, vec3(iv), uSkyB[i].z*0.94);
    }
  }
  if(uSkyDrain.w > 0.0){
    float ang = acos(clamp(dot(d, normalize(uSkyDrain.xyz)),-1.0,1.0)) + (fbm3(d*6.0)-0.5)*0.7;
    if(ang < uSkyDrain.w){
      float l = luma(col);
      vec2 sq = vec2(az*3.0, el*9.0);
      float s = fbm2(sq + vec2(fbm2(sq*1.7)*2.2, uTime*0.12));
      float iv = s>0.65 ? 0.62 : (s>0.55 ? 0.22 : (l>0.6 ? 0.085 : 0.025));
      col = mix(vec3(0.9), vec3(iv), smoothstep(0.0,0.05,uSkyDrain.w-ang));
    }
  }
  if(uSkyBloom > 0.0){
    vec3 c = normalize(vec3(0.0, 0.22, -1.0));
    vec3 pc = paintSwirl(d, c, 0.31);
    float ang = acos(clamp(dot(d,c),-1.0,1.0));
    float n = fbm3(d*3.5);
    float m = smoothstep(uSkyBloom*2.6, uSkyBloom*2.6-0.25, ang + (n-0.5)*0.9);
    col = mix(col, mix(pc, vec3(1.0,0.9,0.75), smoothstep(0.5,0.0,ang))*(0.62+0.5*v), m*0.92);
  }
  oColor = vec4(col*uSceneDim, 1.0);
  oNrmDepth = vec4(0.0,0.0,1.0, 4000.0);
  oId = vec4(0.0, 0.0, 0.0, 1.0);
}`;

// ------------------------------------------------------------------ characters
const VS_CHAR = `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 aInfo;     // material, outline width, shade bias, flags
layout(location=3) in vec2 aUv;
uniform mat4 uVP, uView;
uniform float uHull, uPxWorld, uHullPx, uBoil, uDry;
uniform vec3 uCamPos;
out vec3 vWorld, vNrm, vViewN; out vec4 vInfo; out vec2 vUv2; out float vDepth;
${GLSL_NOISE}
void main(){
  vec3 wp = aPos;
  if(uHull > 0.5){
    float dist = length(uCamPos - wp);
    float wpx = uHullPx*aInfo.y;
    if(uDry > 0.5) wpx *= 0.45 + 1.35*vnoise(aPos*11.0 + uBoil*3.17);
    else wpx *= 0.82 + 0.36*vnoise(aPos*7.0 + uBoil*1.31);
    float wworld = min(wpx*dist*uPxWorld, 0.045);
    wp += normalize(aNrm)*wworld;
  }
  vWorld = wp; vNrm = aNrm; vInfo = aInfo; vUv2 = aUv;
  vViewN = mat3(uView)*aNrm;
  vec4 vp = uView*vec4(wp,1.0); vDepth = -vp.z;
  gl_Position = uVP*vec4(wp,1.0);
  if(uHull>0.5){ gl_Position.z += 0.00004*gl_Position.w; if(aInfo.y<=0.001) gl_Position = vec4(2.0,2.0,2.0,1.0); }
}`;
const FS_CHAR = `
${GLSL_GBUF_OUT}
in vec3 vWorld, vNrm, vViewN; in vec4 vInfo; in vec2 vUv2; in float vDepth;
uniform float uHull, uClass, uMono, uAmbientDim;
uniform vec3 uSunDir, uRimDir, uCamPos, uRimCol, uInk, uFill;
uniform vec3 uLit[40], uShade[40], uDeep[40];
uniform float uPattern[40];
${GLSL_NOISE}${GLSL_SHADOW}
void main(){
  int m = int(vInfo.x+0.5);
  vec3 col;
  float lineMul = 1.0;
  vec3 vn = normalize(vViewN);
  if(uHull > 0.5){
    col = uInk;
  } else {
    vec3 n = normalize(vNrm);
    if(!gl_FrontFacing) { n = -n; vn = -vn; }
    vec3 Vd = normalize(uCamPos - vWorld);
    float pat = uPattern[m];
    float ndl = dot(n, uSunDir) + vInfo.z;
    float sh = shadowAt(vWorld, n);
    float band = ndl > 0.08 ? 2.0 : (ndl > -0.52 ? 1.0 : 0.0);
    if(sh < 0.5) band = min(band, 1.0);
    vec3 lit = uLit[m], shd = uShade[m], dp = uDeep[m];
    if(pat > 0.5){
      if(pat < 1.5){        // wraps
        float s = fract(vUv2.y*15.0 + vUv2.x*1.0);
        if(s < 0.13){ lit = shd; shd = dp; }
      } else if(pat < 2.5){ // pleats
        float s = fract(vUv2.x*18.0);
        if(s < 0.09){ lit = dp; shd = dp; }
        else if(s < 0.20){ lit = mix(lit, vec3(1.0), 0.14); }
      } else if(pat < 3.5){ // hair gradient root->tip with glossy band
        vec3 mid = uLit[m+1], tip = uLit[m+2];
        float v = vUv2.y + (noise2(vec2(vUv2.x*38.0, 1.0))-0.5)*0.30;
        vec3 c = v < 0.42 ? lit : (v < 0.72 ? mid : tip);
        float shine = abs(dot(n, normalize(uSunDir+Vd)) - 0.80);
        lit = c; shd = c*vec3(0.66,0.48,0.66); dp = c*vec3(0.42,0.24,0.46);
        if(shine < 0.10 && noise2(vec2(vUv2.x*46.0, vUv2.y*4.0))>0.46) lit = shd = mix(c, vec3(1.0,0.95,0.8), 0.62);
      } else if(pat < 4.5){ // ink hair / ink skin with dry white streaks
        float shine = abs(dot(n, normalize(uSunDir+Vd)) - 0.78);
        if(shine < 0.09 && noise2(vec2(vUv2.x*52.0, vUv2.y*5.0))>0.52) lit = shd = vec3(0.86);
      } else if(pat < 5.5){ // trim stripe near hem
        if(vUv2.y > 0.90 && vUv2.y < 0.955){ lit = uLit[m+1]; shd = uShade[m+1]; dp = uDeep[m+1]; }
      } else if(pat < 6.5){ // ink-dipped forearm: ragged edge
        float edge = 0.30 + 0.20*noise2(vec2(vUv2.x*17.0, 3.0));
        if(vUv2.y < edge){ lit = uLit[m+1]; shd = uShade[m+1]; dp = uDeep[m+1]; }
        else if(fract(vUv2.y*6.5 - vUv2.x*2.0) < 0.06 && vUv2.y>0.62) { lit = vec3(0.8); shd = vec3(0.5); }
      } else if(pat < 7.5){ // open V neckline with white piping
        float sv = vUv2.y*1.22 - 0.2;
        float du = abs(fract(vUv2.x + 0.25) - 0.5);
        if(sv > 0.60){
          float w = (sv - 0.60)*0.235;
          if(du < w){ lit = uLit[0]; shd = uShade[0]; dp = uDeep[0];
            if(du < 0.0030 && sv < 0.82) { lit = uShade[0]*0.85; } }
          else if(du < w + 0.017){ lit = uLit[3]; shd = uShade[3]; dp = uDeep[3]; }
        }
        if(sv > 0.99){ lit = uLit[0]; shd = uShade[0]; dp = uDeep[0]; }
      }
    }
    col = band > 1.5 ? lit : (band > 0.5 ? shd : dp);
    if(pat > 8.5){ col = lit; lineMul = 0.0; }
    else {
      float fres = 1.0 - max(dot(n, Vd), 0.0);
      if(fres > 0.60 && dot(n, uRimDir) > 0.05) col = mix(col, uRimCol, 0.92);
      col *= uAmbientDim;
    }
    if(uFill.x >= 0.0) col = mix(col, uFill, 0.0);
  }
  if(uMono > 0.5) col = vec3(luma(col));
  oColor = vec4(col, 1.0);
  oNrmDepth = vec4(vn, vDepth);
  oId = vec4(uClass/255.0, lineMul, (float(m)+1.0)/64.0, 1.0);
}`;

const VS_SHADOW_CHAR = `
layout(location=0) in vec3 aPos;
uniform mat4 uVP;
void main(){ gl_Position = uVP*vec4(aPos,1.0); }`;
const VS_SHADOW_CHUNK = `
layout(location=0) in vec3 aPos;
layout(location=2) in float aChunk;
uniform sampler2D uChunkTex; uniform mat4 uVP;
vec3 qrot(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }
void main(){
  int c = int(aChunk+0.5); int x=(c%512)*3, y=c/512;
  vec4 t0 = texelFetch(uChunkTex, ivec2(x,y),0), t1 = texelFetch(uChunkTex, ivec2(x+1,y),0), t2 = texelFetch(uChunkTex, ivec2(x+2,y),0);
  gl_Position = uVP*vec4(t0.xyz + qrot(t1, aPos*t2.w), 1.0);
  if(t0.w<0.5) gl_Position = vec4(2.0,2.0,2.0,1.0);
}`;
const FS_EMPTY = `void main(){}`;

// ------------------------------------------------------------------ anime smoke: sphere impostors
const VS_PUFF = `
layout(location=0) in vec4 aPosR;
layout(location=1) in vec4 aInfo;    // seed, tint, opacity, erosion
uniform mat4 uView, uProj;
out vec2 vQ; out vec4 vInfo; out vec3 vCenterV; out float vR;
void main(){
  vec2 c = vec2((gl_VertexID & 1)*2-1, (gl_VertexID>>1)*2-1)*1.28;
  vec4 cv = uView*vec4(aPosR.xyz,1.0);
  vCenterV = cv.xyz; vR = aPosR.w; vQ = c; vInfo = aInfo;
  vec4 p = cv + vec4(c*aPosR.w, 0.0, 0.0);
  gl_Position = uProj*p;
}`;
const FS_PUFF = `
layout(location=0) out vec4 oA;
layout(location=1) out vec4 oB;
in vec2 vQ; in vec4 vInfo; in vec3 vCenterV; in float vR;
uniform mat4 uProj;
uniform sampler2D uSceneND;
uniform vec2 uRes;
${GLSL_NOISE}
void main(){
  float seed = vInfo.x;
  float r = length(vQ);
  if(r>1.28) discard;
  vec2 dirq = vQ/max(r,1e-4);
  float lump = fbm3(vec3(dirq*2.1, seed*3.0)) - 0.5;
  float lump2 = fbm3(vec3(vQ*2.4, seed*9.0)) - 0.5;
  float edge = 1.0 + lump*0.66 + lump2*0.26;
  if(r > edge) discard;
  float z = sqrt(max(edge*edge - r*r, 0.0))/edge;
  vec3 nrm = normalize(vec3(vQ/edge, z));
  vec3 bump = vec3(fbm3(vec3(vQ*2.2, seed))-0.5, fbm3(vec3(vQ*2.2+7.0, seed))-0.5, 0.0);
  nrm = normalize(nrm + bump*1.2);
  if(vInfo.w > 0.0 && fbm3(vec3(vQ*1.7, seed*5.0)) < vInfo.w*1.08 - 0.06) discard;
  float depth = -vCenterV.z - z*vR*0.8;
  float sceneD = texture(uSceneND, gl_FragCoord.xy/uRes).a;
  if(depth > sceneD || depth < 0.3) discard;
  vec4 cp = uProj*vec4(0.0,0.0,-depth,1.0);
  gl_FragDepth = clamp(cp.z/cp.w*0.5+0.5, 0.0, 1.0);
  oA = vec4(nrm.xy*0.5+0.5, vInfo.y/16.0, vInfo.z);
  oB = vec4(depth, 0.0, 0.0, 1.0);
}`;

// ------------------------------------------------------------------ ink pass: smoke shading + line art
const FS_INK = `
out vec4 o;
in vec2 vUv;
uniform sampler2D uColor, uND, uId, uSmokeA, uSmokeD;
uniform vec2 uPx;
uniform float uSS, uSmokeOn;
uniform mat4 uInvView;
uniform vec2 uTan;
uniform vec3 uSunView;
uniform float uSceneDim;
${GLSL_NOISE}${GLSL_PALETTE}
vec3 smokeColor(float tint, float band){
  int t = int(tint+0.5);
  float v;
  if(t==0){ v = band>1.5?0.86:(band>0.5?0.66:0.50); return vec3(v); }
  if(t==1){ v = band>1.5?0.68:(band>0.5?0.55:0.45); return vec3(v); }
  if(t==2){ v = band>1.5?0.46:(band>0.5?0.27:0.15); return vec3(v); }
  if(t==7){ v = band>1.5?0.99:(band>0.5?0.85:0.68); return vec3(v); }
  if(t==8){ v = band>1.5?0.96:(band>0.5?0.76:0.26); return vec3(v); }
  if(t>=10){
    vec3 k = herPal(float(t-10)*0.2 + 0.05);
    if(band>1.5) return mix(k, vec3(1.0,0.96,0.86), 0.30);
    if(band>0.5) return k;
    return k*vec3(0.58,0.40,0.64);
  }
  vec3 c = t==3?herPal(0.05):(t==4?herPal(0.45):(t==5?herPal(0.65):(t==6?herPal(0.85):herPal(0.25))));
  c = mix(c, vec3(0.80), 0.26);
  if(band>1.5) return mix(c, vec3(1.0,0.95,0.86), 0.45);
  if(band>0.5) return c;
  return c*vec3(0.74,0.60,0.78);
}
void main(){
  vec4 c0 = texture(uColor, vUv);
  vec4 nd = texture(uND, vUv);
  vec4 id = texture(uId, vUv);
  vec3 col = c0.rgb;
  float cls = floor(id.r*255.0+0.5);
  float d0 = nd.a;
  // world-space position for stable line tapering
  vec3 vpos = vec3((vUv*2.0-1.0)*uTan*d0, -d0);
  vec3 wpos = (uInvView*vec4(vpos,1.0)).xyz;
  float taper = cls>0.5 ? (0.45 + 1.1*vnoise(wpos*(cls>=10.0?9.0:1.1))) : 1.0;
  bool isChar = cls >= 10.0;
  float width = (isChar ? 1.15 : 1.35*clamp(1.5 - d0/90.0, 0.55, 1.35))*uSS*taper;
  float line = 0.0;
  float charLine = 0.0;
  vec3 inkC = vec3(0.07);
  float inkDepth = d0;
  for(int i=0;i<8;i++){
    float a = float(i)*0.785398;
    vec2 off = vec2(cos(a), sin(a))*uPx*width;
    vec4 n1 = texture(uND, vUv+off);
    vec4 id1 = texture(uId, vUv+off);
    float c1 = floor(id1.r*255.0+0.5);
    float d1 = n1.a;
    bool char1 = c1>=10.0;
    // silhouettes: the line sits on the farther pixel
    float rel = (d0 - d1)/max(d1, 0.2);
    float th = char1 ? 0.0045 : 0.020 + d1*0.00025;
    if(rel > th && c1 > 1.5){
      line = max(line, smoothstep(th, th*1.7, rel));
      if(char1){ charLine = 1.0; inkC = c1>=20.0 ? vec3(0.0) : vec3(0.17,0.03,0.12); }
    }
    // creases
    if(c1==cls && id.g>0.05 && abs(d1-d0) < 0.02*d0+0.05){
      if(!isChar){
        float nn = dot(nd.xyz, n1.xyz);
        if(nn < 0.78) line = max(line, smoothstep(0.78,0.55,nn)*id.g*0.85);
      } else if(i<4 && abs(id1.b-id.b) > 0.004 && id1.g>0.05){
        line = max(line, 0.9);
        inkC = cls>=20.0 ? vec3(0.0) : vec3(0.17,0.03,0.12);
        charLine = 1.0;
      }
    }
  }
  if(charLine < 0.5) line *= (1.0 - smoothstep(70.0, 260.0, d0)*0.85);
  col = mix(col, inkC, clamp(line,0.0,1.0)*(isChar||charLine>0.5?0.96:0.86));
  // smoke
  if(uSmokeOn > 0.5){
    vec4 sa = texture(uSmokeA, vUv);
    float sd = texture(uSmokeD, vUv).r;
    bool has = sa.a > 0.003 && sd < d0;
    float tint = sa.b*16.0;
    // outline of the merged cloud shape
    float sline = 0.0; float ltint = tint; float lop = sa.a;
    for(int i=0;i<8;i++){
      float a = float(i)*0.785398;
      vec2 off = vec2(cos(a), sin(a))*uPx*1.6*uSS;
      vec4 s1 = texture(uSmokeA, vUv+off);
      float sd1 = texture(uSmokeD, vUv+off).r;
      bool has1 = s1.a>0.003;
      if(has1 && (!has || sd - sd1 > 0.11*sd1 + 1.6) && sd1 < d0){ sline = 1.0; ltint = s1.b*16.0; lop = s1.a; }
    }
    if(has){
      vec2 nxy = sa.rg*2.0-1.0;
      vec3 sn = vec3(nxy, sqrt(max(1.0-dot(nxy,nxy),0.0)));
      float l = dot(sn, uSunView);
      float band = l>0.42?2.0:(l>-0.12?1.0:0.0);
      vec3 sc = smokeColor(tint, band)*uSceneDim;
      col = mix(col, sc, sa.a);
    }
    if(sline > 0.5){
      vec3 lc = smokeColor(ltint, 0.0)*0.42;
      col = mix(col, lc, lop*0.55);
    }
  }
  o = vec4(col, 1.0);
}`;

// ------------------------------------------------------------------ downsample + character masks
const FS_DOWN = `
layout(location=0) out vec4 oC;
layout(location=1) out vec4 oM;
in vec2 vUv;
uniform sampler2D uSrc, uId, uFx, uSmokeA, uSmokeD, uND;
uniform vec2 uPx;
uniform float uSS, uSmokeOn;
void main(){
  vec3 c = vec3(0.0); float sumi=0.0, iro=0.0; float n = 0.0;
  vec2 o[4] = vec2[4](vec2(-0.5,-0.5), vec2(0.5,-0.5), vec2(-0.5,0.5), vec2(0.5,0.5));
  float k = uSS*0.5;
  for(int i=0;i<4;i++){
    vec2 uv = vUv + o[i]*uPx*k;
    c += texture(uSrc, uv).rgb;
    float cls = floor(texture(uId, uv).r*255.0+0.5);
    float cover = 1.0;
    if(uSmokeOn>0.5){
      vec4 sa = texture(uSmokeA, uv);
      if(sa.a>0.003 && texture(uSmokeD, uv).r < texture(uND, uv).a) cover = 1.0 - sa.a;
    }
    if(cls>=20.0 && cls<30.0) sumi += cover;
    if(cls>=10.0 && cls<20.0) iro += cover;
  }
  oC = vec4(c*0.25, 1.0);
  oM = vec4(sumi*0.25, iro*0.25, 0.0, 1.0);
}`;
const FS_FXDOWN = `
out vec4 o; in vec2 vUv; uniform sampler2D uSrc; uniform vec2 uPx; uniform float uSS;
void main(){
  float k = uSS*0.5;
  vec4 c = texture(uSrc, vUv+vec2(-.5,-.5)*uPx*k)+texture(uSrc, vUv+vec2(.5,-.5)*uPx*k)+texture(uSrc, vUv+vec2(-.5,.5)*uPx*k)+texture(uSrc, vUv+vec2(.5,.5)*uPx*k);
  o = c*0.25;
}`;

const FS_BRIGHT = `
out vec4 o; in vec2 vUv; uniform sampler2D uSrc, uFx; uniform float uThr;
void main(){
  vec3 c = texture(uSrc, vUv).rgb; vec4 f = texture(uFx, vUv);
  c = f.rgb + c*(1.0-f.a);
  float l = max(c.r, max(c.g,c.b));
  o = vec4(c*smoothstep(uThr, uThr+0.12, l) + f.rgb*max(0.0, 1.0-f.a)*0.6, 1.0);
}`;
const FS_BLUR = `
out vec4 o; in vec2 vUv; uniform sampler2D uSrc; uniform vec2 uDir;
void main(){
  vec3 c = texture(uSrc, vUv).rgb*0.227;
  c += (texture(uSrc, vUv+uDir*1.385).rgb + texture(uSrc, vUv-uDir*1.385).rgb)*0.316;
  c += (texture(uSrc, vUv+uDir*3.23).rgb + texture(uSrc, vUv-uDir*3.23).rgb)*0.070;
  o = vec4(c,1.0);
}`;

// ------------------------------------------------------------------ final composite
const FS_POST = `
out vec4 o;
in vec2 vUv;
uniform sampler2D uBase, uMask, uFx, uBloom, uOverlay;
uniform vec4 uWaveA[8];   // centre uv, radius, thickness (in screen heights)
uniform float uWaveS[8];
uniform int uWaveN;
uniform float uCA, uFrame, uVig, uGrain, uBloomAmt, uHaze;
uniform vec2 uBlurDir, uRadialC;
uniform float uRadial;
uniform float uSpeed, uSpeedDark, uSpeedInner;
uniform vec2 uSpeedC;
uniform int uImpact;           // 0 none, 1 ink negative, 2 paint field, 3 split, 4 paper, 5 night
uniform vec2 uImpactC;
uniform float uImpactSeed, uImpactThr;
uniform float uCrack;          // cracked-glass amount
uniform vec2 uCrackC;
uniform vec4 uFlash;           // rgb, amount
uniform float uMonoAll, uHalo, uOverlayOn, uExposure, uQuiet, uAudit;
${GLSL_NOISE}${GLSL_PALETTE}
const float ASP = 16.0/9.0;
vec2 distort(vec2 uv){
  vec2 off = vec2(0.0);
  for(int i=0;i<8;i++){
    if(i>=uWaveN) break;
    vec4 w = uWaveA[i];
    vec2 d = (uv - w.xy)*vec2(ASP,1.0);
    float r = length(d);
    float x = (r - w.z)/w.w;
    if(abs(x) < 1.0){
      float s = sin(x*3.14159)*(1.0-x*x);
      off -= normalize(d+1e-5)*s*uWaveS[i]/vec2(ASP,1.0);
    }
  }
  if(uHaze>0.0) off += vec2(noise2(uv*38.0+uFrame*0.37)-0.5, noise2(uv*38.0+9.0-uFrame*0.41)-0.5)*uHaze*0.006;
  return uv + off;
}
vec3 sampleBase(vec2 uv){
  vec3 c;
  if(uCA > 0.0){
    vec2 d = (uv-0.5)*uCA*0.012;
    c = vec3(texture(uBase, uv+d).r, texture(uBase, uv).g, texture(uBase, uv-d).b);
  } else c = texture(uBase, uv).rgb;
  return c;
}
float speedLines(vec2 uv, vec2 c, float amt, float inner, float seed){
  vec2 d = (uv-c)*vec2(ASP,1.0);
  float r = length(d), a = atan(d.y,d.x)/6.28318 + 0.5;
  float N = 210.0;
  float cell = floor(a*N);
  float h = hash12(vec2(cell, seed));
  float h2 = hash12(vec2(cell+7.0, seed));
  if(h > amt*0.55) return 0.0;
  float f = abs(fract(a*N)-0.5)*2.0;
  float start = inner + h2*0.45;
  float t = clamp((r-start)/0.5, 0.0, 1.0);
  return step(f, t*(0.35+0.65*hash12(vec2(cell,seed+3.0))));
}
// jagged radial + concentric fracture lines, like struck glass
float glassCrack(vec2 uv, vec2 c, float amt){
  vec2 d = (uv-c)*vec2(ASP,1.0);
  float r = length(d), a = atan(d.y,d.x);
  float line = 0.0;
  float N = 15.0;
  float u = a/6.28318*N + (noise2(vec2(r*13.0, floor((a/6.28318+0.5)*N)))-0.5)*0.34 + (noise2(vec2(r*47.0,3.0))-0.5)*0.07;
  float k = floor(u+0.5);
  float len = (0.35 + 1.4*hash12(vec2(k, 4.0)))*amt;
  float w = 0.0025*(1.0-r/max(len,0.001)) + 0.0006;
  if(r < len && abs(u-k)*6.28318/N*r < w) line = 1.0;
  for(int i=1;i<5;i++){
    float rr_ = 0.055*pow(float(i),1.5) + 0.03*hash12(vec2(floor(u), float(i)));
    if(rr_ < amt*0.8 && abs(r - rr_ - (fract(u)-0.5)*0.022*hash12(vec2(floor(u),float(i)+9.0))) < 0.0017 && hash12(vec2(floor(u), float(i)+2.0))>0.35) line = 1.0;
  }
  return line;
}
void main(){
  vec2 uv = distort(vUv);
  vec3 col = vec3(0.0);
  vec4 m = vec4(0.0);
  bool blurred = length(uBlurDir) > 0.0005 || uRadial > 0.0005;
  if(blurred){
    float j = hash12(gl_FragCoord.xy + uFrame);
    for(int i=0;i<12;i++){
      float t = (float(i)+j)/12.0 - 0.5;
      vec2 s = uv + uBlurDir*t + (uv-uRadialC)*uRadial*t;
      col += sampleBase(s); m += texture(uMask, s);
    }
    col /= 12.0; m /= 12.0;
  } else { col = sampleBase(uv); m = texture(uMask, uv); }
  float sumi = clamp(m.r*1.35, 0.0, 1.0);
  float iro = clamp(m.g*1.35, 0.0, 1.0);
  // THE RULE: SUMI is never in colour
  col = mix(col, vec3(luma(col)), sumi);
  if(uMonoAll > 0.0) col = mix(col, vec3(luma(col)), uMonoAll);
  {
    float near_ = 0.0;
    for(int i=0;i<10;i++){
      float a = float(i)*0.628319;
      vec2 off = vec2(cos(a)/ASP, sin(a))/1080.0;
      near_ += texture(uMask, uv+off*17.0).r + texture(uMask, uv+off*40.0).r;
    }
    near_ = clamp(near_/5.5, 0.0, 1.0)*(1.0-sumi)*(1.0-iro);
    vec3 calm = mix(col, vec3(mix(luma(col), 0.64, 0.55)), 0.62);
    col = mix(col, calm, near_*uHalo*uQuiet);
  }
  // readability halos: white around ink, warm cream around colour
  if(uHalo > 0.0){
    float ds = 0.0, di = 0.0;
    for(int i=0;i<12;i++){
      float a = float(i)*0.5236;
      vec2 off = vec2(cos(a)/ASP, sin(a))*uHalo/1080.0;
      ds = max(ds, texture(uMask, uv+off*3.3).r);
      di = max(di, texture(uMask, uv+off*2.4).g);
    }
    float hs = clamp(ds*1.6 - sumi*1.6, 0.0, 1.0)*(1.0-iro);
    col = mix(col, vec3(0.97), hs*0.88);
    float hi = clamp(di*1.5 - iro*1.5, 0.0, 1.0)*(1.0-sumi)*(1.0-hs);
    col = mix(col, vec3(1.0,0.93,0.74), hi*0.55);
  }
  vec4 fx = texture(uFx, uv);
  // audit output: where SUMI is on the finished picture (after all distortion and blur), and where effects cover him
  if(uAudit > 0.5){ o = vec4(max(sumi, uMonoAll), fx.a, 0.0, 1.0); return; }
  col = fx.rgb + col*(1.0 - clamp(fx.a,0.0,1.0));
  if(uBloomAmt > 0.0){
    vec3 b = texture(uBloom, uv).rgb;
    b = mix(b, vec3(luma(b)), sumi);
    col += b*uBloomAmt*(1.0-0.5*sumi);
  }
  col *= uExposure;
  if(uImpact > 0){
    vec2 px = vec2(1.0/1920.0, 1.0/1080.0)*1.6;
    float lx = luma(texture(uBase, uv+vec2(px.x,0)).rgb) - luma(texture(uBase, uv-vec2(px.x,0)).rgb);
    float ly = luma(texture(uBase, uv+vec2(0,px.y)).rgb) - luma(texture(uBase, uv-vec2(0,px.y)).rgb);
    float mx = texture(uMask, uv+vec2(px.x*2.0,0)).r + texture(uMask, uv+vec2(px.x*2.0,0)).g - texture(uMask, uv-vec2(px.x*2.0,0)).r - texture(uMask, uv-vec2(px.x*2.0,0)).g;
    float my = texture(uMask, uv+vec2(0,px.y*2.0)).r + texture(uMask, uv+vec2(0,px.y*2.0)).g - texture(uMask, uv-vec2(0,px.y*2.0)).r - texture(uMask, uv-vec2(0,px.y*2.0)).g;
    float edge = smoothstep(0.13, 0.28, length(vec2(lx,ly)));
    float medge = smoothstep(0.25, 0.7, length(vec2(mx,my)));
    float L = luma(texture(uBase, uv).rgb);
    int mode = uImpact;
    vec2 rel = (vUv - uImpactC)*vec2(ASP,1.0);
    if(mode == 3){
      float side = rel.x + rel.y*0.34 + (noise2(vec2(rel.y*17.0, uImpactSeed))-0.5)*0.12;
      mode = side < 0.0 ? 2 : 1;
    }
    float rad = length(rel);
    vec3 bg; vec3 lineC; vec3 sumiC; vec3 iroC;
    vec3 raw = col;
    float lr = luma(raw);
    vec3 sat = clamp(mix(vec3(lr), raw, 1.7), 0.0, 1.0);
    if(mode == 1){          // pure ink negative; IRO is the only colour
      float inv = L > uImpactThr ? 0.03 : 0.97;
      bg = vec3(mix(inv, 1.0-inv, edge));
      sumiC = vec3(mix(luma(col) > 0.30 ? 0.02 : 0.98, 0.02, medge));
      iroC = sat;
    } else if(mode == 2){   // flat paint field; SUMI a black cut-out
      float a = atan(rel.y,rel.x);
      vec3 pc = rad < 0.16 + 0.07*noise2(vec2(a*9.0,uImpactSeed)) ? vec3(1.0,0.95,0.80)
              : (rad < 0.42 + 0.16*noise2(vec2(a*6.0,uImpactSeed+2.0)) ? vec3(1.0,0.74,0.10)
              : (rad < 0.82 + 0.2*noise2(vec2(a*4.0,uImpactSeed+4.0)) ? vec3(1.0,0.22,0.36) : vec3(0.42,0.06,0.45)));
      bg = mix(pc, vec3(0.16,0.01,0.15), edge*0.85);
      sumiC = vec3(mix(0.015, 0.97, medge));
      iroC = mix(sat, vec3(1.0,0.97,0.88), medge);
    } else if(mode == 4){   // white paper: two silhouettes
      bg = vec3(mix(0.96, 0.10, edge*0.8));
      sumiC = vec3(0.015);
      iroC = mix(herPal(vUv.x*1.3 + vUv.y*0.9 + noise2(vUv*7.0)*0.5), vec3(0.15,0.0,0.1), medge);
    } else {                // night: white ink, colour silhouette
      bg = vec3(mix(0.015, 0.9, edge));
      sumiC = vec3(mix(0.97, 0.02, medge));
      iroC = mix(sat*1.15, vec3(1.0), medge);
    }
    vec3 ic = bg;
    ic = mix(ic, sumiC, smoothstep(0.25,0.75,sumi));
    ic = mix(ic, iroC, smoothstep(0.25,0.75,iro));
    ic = mix(ic, clamp(fx.rgb*1.2 + ic*(1.0-fx.a), 0.0, 1.0), clamp(fx.a,0.0,1.0)*0.55*(1.0-sumi));
    float sl = speedLines(vUv, uImpactC, 1.0, 0.16, uImpactSeed);
    if(sl > 0.5 && sumi<0.4 && iro<0.4){
      if(mode==1) ic = vec3(luma(ic) > 0.5 ? 0.0 : 1.0);
      else if(mode==2) ic = vec3(1.0,0.95,0.82);
      else if(mode==4) ic = vec3(0.02);
      else ic = vec3(0.96);
    }
    if(mode == 1 || mode == 5){ ic = mix(ic, vec3(luma(ic)), 1.0-smoothstep(0.2,0.6,iro)); }
    // the rule holds inside impact frames too, down to the pixels he shares with her
    ic = mix(ic, vec3(luma(ic)), smoothstep(0.70, 0.96, sumi));
    col = ic;
  }
  if(uSpeed > 0.0 && uImpact == 0){
    float sl = speedLines(vUv, uSpeedC, uSpeed, uSpeedInner, floor(uFrame/2.0)*3.1);
    float keep = 1.0 - clamp(max(sumi, iro)*1.2, 0.0, 1.0)*0.85;
    col = mix(col, vec3(uSpeedDark > 0.5 ? 0.03 : 0.97), sl*min(uSpeed*1.2,0.92)*keep);
  }
  if(uCrack > 0.0){
    float cr = glassCrack(vUv, uCrackC, uCrack);
    float cr2 = glassCrack(vUv + vec2(0.0022,-0.0031), uCrackC, uCrack);
    // the glass breaks behind the fighters: the cracks never cross out a face
    float clearOf = 1.0 - 0.88*clamp(max(sumi, iro)*1.6, 0.0, 1.0);
    clearOf *= smoothstep(0.055, 0.17, length((vUv - uCrackC)*vec2(ASP,1.0)));
    col = mix(col, vec3(0.02), cr2*0.9*clearOf);
    col = mix(col, vec3(0.98), cr*clearOf);
  }
  // vignette + grain
  vec2 q = vUv - 0.5;
  col *= 1.0 - uVig*smoothstep(0.30, 0.80, length(q*vec2(1.0,0.82)));
  float g = hash12(gl_FragCoord.xy + vec2(floor(uFrame/2.0)*17.0, uFrame*0.0)) - 0.5;
  float paper = noise2(gl_FragCoord.xy*0.37) - 0.5;
  col += (g*0.65 + paper*0.35)*uGrain;
  if(uFlash.a > 0.0) col = mix(col, uFlash.rgb, uFlash.a);
  if(uOverlayOn > 0.5){
    vec4 ov = texture(uOverlay, vec2(vUv.x, 1.0-vUv.y));
    col = mix(col, ov.rgb, ov.a);
  }
  o = vec4(clamp(col,0.0,1.0), 1.0);
}`;

// ------------------------------------------------------------------ FX: hit stars
const VS_STAR = `
uniform mat4 uView, uProj; uniform vec3 uCenter; uniform float uSize, uRot, uPull;
out vec2 vQ;
void main(){
  vec2 c = vec2((gl_VertexID & 1)*2-1, (gl_VertexID>>1)*2-1);
  vQ = c;
  vec4 cv = uView*vec4(uCenter,1.0);
  cv.xyz += normalize(-cv.xyz)*min(0.9, -cv.z*0.2)*uPull;
  float s = sin(uRot), k = cos(uRot);
  cv.xy += mat2(k,s,-s,k)*c*uSize*(-cv.z)/max(-(uView*vec4(uCenter,1.0)).z, 0.1);
  gl_Position = uProj*cv;
}`;
const FS_STAR = `
out vec4 o; in vec2 vQ;
uniform float uAge, uSeed, uKind, uSpikes, uStretch;
${GLSL_NOISE}${GLSL_PALETTE}
void main(){
  vec2 q = vQ; q.y *= uStretch;
  float r = length(q); float a = atan(q.y,q.x)/6.28318 + 0.5;
  float N = uSpikes;
  float cell = floor(a*N); float f = fract(a*N);
  float len = 0.34 + 0.66*pow(hash12(vec2(cell, uSeed)), 1.4);
  float tip = 1.0 - abs(f-0.5)*2.0;
  float grow = min(1.0, 0.55 + uAge*0.4);
  float R = (0.16 + (len-0.16)*pow(tip, 2.6))*grow;
  float R2 = R*1.0;
  float erode = clamp((uAge - 1.5)/3.5, 0.0, 1.0);
  float hole = erode*0.9*R;
  if(r > R2 || r < hole) discard;
  if(erode > 0.0 && noise2(q*9.0+uSeed) < erode*0.75) discard;
  float t = r/R;
  vec3 col;
  if(uKind < 0.5){          // colour
    col = t < 0.42 ? vec3(1.0,0.99,0.92) : (t < 0.62 ? vec3(1.0,0.82,0.14) : (t < 0.86 ? vec3(1.0,0.2,0.45) : vec3(0.28,0.03,0.3)));
  } else if(uKind < 1.5){   // ink
    col = t < 0.44 ? vec3(1.0) : (t < 0.87 ? vec3(0.02) : vec3(0.95));
  } else {                  // clash: left colour, right ink
    if(vQ.x + vQ.y*0.3 < 0.0) col = t < 0.42 ? vec3(1.0,0.99,0.92) : (t < 0.64 ? vec3(1.0,0.78,0.1) : (t<0.86?vec3(1.0,0.2,0.45):vec3(0.28,0.03,0.3)));
    else col = t < 0.44 ? vec3(1.0) : (t < 0.87 ? vec3(0.02) : vec3(0.95));
  }
  o = vec4(col, 1.0);
}`;

// ------------------------------------------------------------------ FX: 3D shock rings and condensation discs
const VS_RING = `
uniform mat4 uVP; uniform vec3 uCenter, uAxisU, uAxisV; uniform float uR, uW, uSeed, uDisc;
out vec2 vP; out vec3 vDir;
float h1(float n){ return fract(sin(n*91.7)*43758.5); }
float n1(float x){ float i=floor(x), f=fract(x); f=f*f*(3.-2.*f); return mix(h1(i),h1(i+1.),f); }
void main(){
  int seg = gl_VertexID/2; int side = gl_VertexID & 1;
  float a = float(seg)/160.0*6.28318;
  float wob = 1.0 + (n1(a*9.0+uSeed)-0.5)*0.10 + (n1(a*31.0+uSeed*3.0)-0.5)*0.045;
  float wd = uW*(0.35 + 1.3*n1(a*13.0+uSeed*7.0));
  float r = side==0 ? (uDisc>0.5 ? 0.0 : max(uR*wob - wd, 0.0)) : uR*wob;
  vec3 dir = uAxisU*cos(a) + uAxisV*sin(a);
  vec3 wp = uCenter + dir*r;
  vP = vec2(a, float(side)); vDir = dir*r;
  gl_Position = uVP*vec4(wp,1.0);
}`;
const FS_RING = `
out vec4 o; in vec2 vP; in vec3 vDir;
uniform float uAlpha, uKind, uSeed, uDisc, uR;
${GLSL_NOISE}${GLSL_PALETTE}
void main(){
  float s = vP.y;
  vec3 col; float al = uAlpha;
  if(uKind > 4.5){
    float rr_ = length(vDir)/max(uR,0.001);
    if(rr_ > 0.86 + 0.14*noise2(vec2(vP.x*11.0, 5.0))) discard;
    col = vec3(0.015);
    al *= 1.0 - 0.45*smoothstep(0.5, 1.0, rr_);
  } else if(uKind > 3.5){
    float rr_ = length(vDir)/max(uR,0.001);
    float rag = 0.90 + 0.10*noise2(vec2(vP.x*9.0, 3.0)) - 0.05*noise2(vec2(vP.x*41.0, 1.0));
    if(rr_ > rag) discard;
    if(rr_ > rag - 0.09 && noise2(vec2(vP.x*90.0, rr_*14.0)) < (rr_-rag+0.09)*9.0) discard;
    float wash = noise2(vDir.xy*0.9 + vDir.z) ;
    col = vec3(0.86 + 0.05*step(0.55, wash) - 0.07*smoothstep(0.55, 0.95, rr_));
  } else if(uDisc > 0.5){
    float rr_ = length(vDir)/max(uR,0.001);
    float st = noise2(vec2(vP.x*26.0 + uSeed, rr_*3.0));
    if(rr_ < 0.45 + 0.28*noise2(vec2(vP.x*7.0, uSeed))) discard;
    if(st < 0.38) discard;
    col = vec3(st > 0.66 ? 1.0 : 0.84);
    al *= smoothstep(0.45, 0.95, rr_)*0.85;
    if(rr_>0.965) { col = vec3(1.0); al = uAlpha; }
  } else if(uKind < 0.5){
    col = herPal(vP.x/6.28318*2.0 + s*0.55 + uSeed);
    if(s > 0.86) col = vec3(1.0,0.97,0.88);
    if(s < 0.10) col = vec3(0.30,0.03,0.30);
    al *= smoothstep(0.0, 0.35, s)*0.9+0.1;
  } else if(uKind < 1.5){
    col = s > 0.80 ? vec3(0.03) : (s > 0.55 ? vec3(0.97) : (s>0.32?vec3(0.05):vec3(0.9)));
    al *= smoothstep(0.0, 0.3, s);
    if(s < 0.5 && noise2(vec2(vP.x*60.0, s*5.0+uSeed)) < 0.45) discard;
  } else if(uKind < 2.5){
    col = vec3(0.98);
    al *= smoothstep(0.1,0.8,s);
  } else {
    if(vDir.x < 0.0){ col = herPal(vP.x/6.28318*3.0 + s*0.5 + uSeed); if(s>0.85) col = vec3(1.0,0.97,0.88); }
    else col = s > 0.78 ? vec3(0.02) : (s > 0.5 ? vec3(0.97) : vec3(0.06));
    al *= smoothstep(0.0, 0.35, s);
  }
  o = vec4(col*al, al);
}`;

// ------------------------------------------------------------------ FX: ribbons (smears, trails, brush strokes, comet)
const VS_RIBBON = `
layout(location=0) in vec3 aPos;
layout(location=1) in vec4 aUvS;   // u along (0 tail..1 head), v across (-1..1), style, seed
layout(location=2) in vec4 aCol;
uniform mat4 uVP;
out vec4 vUvS; out vec4 vCol;
void main(){ vUvS = aUvS; vCol = aCol; gl_Position = uVP*vec4(aPos,1.0); }`;
const FS_RIBBON = `
out vec4 o; in vec4 vUvS; in vec4 vCol;
uniform float uTime;
${GLSL_NOISE}${GLSL_PALETTE}
void main(){
  float u = vUvS.x, v = vUvS.y; int st = int(vUvS.z+0.5); float seed = vUvS.w;
  vec3 col = vCol.rgb; float al = vCol.a;
  if(st==0){          // smear: solid core breaking into streaks toward the tail
    float k = noise2(vec2(v*7.0 + seed, u*2.0));
    if(k > u*1.5 + 0.02 - abs(v)*0.25) discard;
    if(abs(v) > 0.82) col = mix(col, vec3(0.04,0.0,0.03), 0.65);
    else if(v > 0.25) col = mix(col, vec3(1.0,0.95,0.84), 0.55);
  } else if(st==1){   // dry brush ink
    float bristle = noise2(vec2(v*16.0 + seed*7.0 + noise2(vec2(u*5.0,v*2.0))*1.6, u*3.5));
    float cover = smoothstep(0.0,0.45,u)*1.25 - smoothstep(0.55,1.0,abs(v))*0.55;
    if(bristle > cover) discard;
    float w = noise2(vec2(v*30.0+seed, u*1.4));
    col = vec3(0.02);
    if(w > 0.76) col = vec3(0.9); else if(w>0.66) col = vec3(0.32);
    if(abs(v)>0.93) col = vec3(0.95);
  } else if(st==2){   // spectral comet
    float k = noise2(vec2(v*9.0 + seed, u*5.0 - uTime*9.0));
    if(k > smoothstep(0.0,0.7,u)*1.2 - smoothstep(0.7,1.0,abs(v))*0.4) discard;
    col = herPal(v*0.42 + 0.5 + seed*0.17 + noise2(vec2(u*3.0, v*2.0))*0.25);
    if(abs(v) < 0.16 + u*0.12) col = vec3(1.0,0.97,0.88);
    if(abs(v) > 0.88) col = vec3(0.3,0.02,0.32);
  } else if(st==3){   // white speed streak
    float f = (1.0-abs(v))*smoothstep(0.0,0.6,u)*smoothstep(1.0,0.85,u);
    al *= smoothstep(0.1,0.5,f);
  } else if(st==4){   // soft energy thread
    al *= (1.0-v*v)*smoothstep(0.0,0.5,u);
    col = mix(col, vec3(1.0), (1.0-abs(v))*0.5);
  } else {            // the one stroke: colossal calligraphy
    float bristle = noise2(vec2(v*21.0 + noise2(vec2(u*7.0,v*3.0))*2.2 + seed, u*2.2));
    float cover = 1.12 - smoothstep(0.62,1.0,abs(v))*0.6 - (1.0-smoothstep(0.0,0.35,u))*0.75;
    if(bristle > cover) discard;
    float w = noise2(vec2(v*44.0, u*1.1+seed));
    col = vec3(0.012);
    if(w > 0.79) col = vec3(0.94); else if(w > 0.71) col = vec3(0.26);
    if(abs(v)>0.9) col = vec3(0.97);
  }
  o = vec4(col*al, al);
}`;

// ------------------------------------------------------------------ FX: droplets, sparks, streaks
const VS_DROP = `
layout(location=0) in vec4 aA;      // head xyz, width
layout(location=1) in vec4 aB;      // tail xyz, kind
layout(location=2) in vec4 aCol;
uniform mat4 uVP, uView; uniform vec3 uCamPos;
out vec2 vQ; out vec4 vCol; out float vKind; out float vLen;
void main(){
  vec2 c = vec2((gl_VertexID & 1), (gl_VertexID>>1)*2-1);
  vec3 head = aA.xyz, tail = aB.xyz; float w = aA.w;
  vec3 ax = head - tail; float L = length(ax);
  vec3 dir = L>1e-4 ? ax/L : vec3(0,1,0);
  vec3 toCam = normalize(uCamPos - head);
  vec3 side = normalize(cross(dir, toCam));
  vec3 p = mix(tail - dir*w, head + dir*w, c.x) + side*c.y*w;
  vQ = vec2(c.x*(L+2.0*w) - w, c.y*w)/max(w,1e-4);
  vKind = aB.w; vCol = aCol; vLen = L/max(w,1e-4);
  gl_Position = uVP*vec4(p,1.0);
  if(distance(uCamPos, head) < 0.35) gl_Position = vec4(2.0,2.0,2.0,1.0);
}`;
const FS_DROP = `
out vec4 o; in vec2 vQ; in vec4 vCol; in float vKind; in float vLen;
void main(){
  float x = vQ.x, y = vQ.y;
  float al = vCol.a;
  vec3 col = vCol.rgb;
  if(vKind < 0.5){
    float u = clamp(x/max(vLen,0.001), 0.0, 1.0);
    float rad = mix(0.22, 1.0, u*u);
    float dist = length(vec2(x - clamp(x, 0.0, vLen), y));
    if(dist > rad) discard;
    if(dist > rad*0.70) col = mix(col, vec3(0.03,0.0,0.02), 0.65);
    else if(length(vec2(x - vLen + 0.15, y - 0.28)) < 0.26) col = mix(col, vec3(1.0), 0.75);
  } else if(vKind > 1.5){
    if(abs(y) > 1.0) discard;
    al *= (1.0 - abs(y)); col = mix(col, vec3(1.0), 0.4);
  } else {
    if(abs(y) > mix(0.25, 1.0, smoothstep(-1.0, vLen+1.0, x))) discard;
  }
  o = vec4(col*al, al);
}`;

// ------------------------------------------------------------------ generic solid FX mesh (paint crown, drop)
const VS_BLOB = `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
uniform mat4 uVP;
out vec3 vN, vW;
void main(){ vN=aNrm; vW=aPos; gl_Position = uVP*vec4(aPos,1.0); }`;
const FS_BLOB = `
out vec4 o; in vec3 vN, vW;
uniform vec3 uCamPos, uSunDir; uniform float uKind, uTime;
${GLSL_NOISE}${GLSL_PALETTE}
void main(){
  vec3 n = normalize(vN); vec3 Vd = normalize(uCamPos - vW);
  if(!gl_FrontFacing) n = -n;
  vec3 c;
  float k = n.y*0.35 + n.x*0.2 + fbm3(vW*5.0)*0.55 + uTime*0.25;
  if(uKind<0.5){
    c = herPal(k);
    float l = dot(n, uSunDir);
    if(l < -0.15) c *= vec3(0.62,0.45,0.7);
    vec3 h = normalize(uSunDir+Vd);
    if(dot(n,h) > 0.93) c = vec3(1.0,0.98,0.92);
    if(1.0 - abs(dot(n,Vd)) > 0.72) c = vec3(0.22,0.02,0.24);
  } else {
    float l = dot(n, uSunDir);
    c = vec3(l > 0.6 ? 0.5 : 0.03);
    if(dot(n, normalize(uSunDir+Vd)) > 0.94) c = vec3(0.96);
    if(1.0 - abs(dot(n,Vd)) > 0.74) c = vec3(0.92);
  }
  o = vec4(c,1.0);
}`;
