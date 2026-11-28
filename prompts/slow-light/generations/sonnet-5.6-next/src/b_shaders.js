// ───────────────────────────── shaders ─────────────────────────────
const GLSL_NOISE = /* glsl */`
float hash13(vec3 p3){ p3 = fract(p3*.1031); p3 += dot(p3, p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 hash33(vec3 p3){ p3 = fract(p3*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yxz+33.33); return fract((p3.xxy+p3.yxx)*p3.zyx); }
float vnoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x), mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x), mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5;} return s; }
float fbm2(vec3 p){ return .65*vnoise(p)+.35*vnoise(p*2.17+7.3); }
`;

// The ONE physical law of the film: a lamp's intensity as a function of emission time tau = t - pathLength / c.
const GLSL_PHYSICS = /* glsl */`
#define C_LIGHT 5.0
#define RISE 0.016
#define FALL 0.022
#define FLARE_TF 0.042
#define FLARE_A 6.2
uniform vec3 uLampPos[3];
uniform vec3 uLampCol[3];
uniform vec3 uFlareCol[3];
uniform vec3 uLampTiming[3];   // x = on, y = off, z = radius
uniform float uTime;
float s01(float x){ x=clamp(x,0.,1.); return x*x*(3.-2.*x); }
float neonStutter(float a){
  float e=0.006;
  float g1 = s01((a-0.080)/e)*(1.-s01((a-0.175)/e));
  float g2 = s01((a-0.245)/e)*(1.-s01((a-0.385)/e));
  float g3 = s01((a-0.455)/e)*(1.-s01((a-0.495)/e));
  return 1.0 - 0.95*(g1+g2+g3);
}
vec2 lampProfile(int i, float tau){
  float a = tau - uLampTiming[i].x;
  if(a <= 0.0) return vec2(0.0);
  float on = s01(a/RISE);
  float off = 1.0 - s01((tau - uLampTiming[i].y)/FALL);
  float fl = on*exp(-a/FLARE_TF)*FLARE_A;
  float st = (i==2) ? neonStutter(a) : 1.0;
  return vec2(on*off*st, fl*off*st);
}
vec3 lampEmit(int i, float tau){ vec2 p = lampProfile(i,tau); return uLampCol[i]*p.x + uFlareCol[i]*p.y; }
`;

const GBUF_VERT = /* glsl */`
in vec3 aColor;
in vec4 aMat;
out vec3 vWP;
out vec3 vN;
out vec3 vCol;
flat out vec4 vMat;
out vec3 vLocal;
void main(){
  vec3 p = position; vec3 n = normal; vec3 col = aColor;
  #ifdef USE_INSTANCING
    vec3 s2 = vec3(dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz), dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz), dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz));
    n = mat3(instanceMatrix) * (n / s2);
    p = (instanceMatrix * vec4(p,1.0)).xyz;
    #ifdef USE_INSTANCING_COLOR
      col *= instanceColor;
    #endif
  #endif
  vec4 wp = modelMatrix * vec4(p,1.0);
  vWP = wp.xyz; vN = normalize(mat3(modelMatrix)*n); vCol = col; vMat = aMat; vLocal = position;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const GBUF_FRAG = /* glsl */`
precision highp float;
in vec3 vWP; in vec3 vN; in vec3 vCol; flat in vec4 vMat; in vec3 vLocal;
uniform vec3 uViewPos;
uniform vec4 uClipPlane;
uniform float uTime;
uniform vec4 uDrips[24];     // xz position, phase, period
layout(location=0) out vec4 gPos;
layout(location=1) out vec4 gNor;
layout(location=2) out vec4 gAlb;
layout(location=3) out vec4 gEmi;
${GLSL_NOISE}

// bricks in wall coordinates
vec4 brickPat(vec2 q, vec2 sz){
  float row = floor(q.y/sz.y);
  float off = mod(row,2.0)*0.5 + hash12(vec2(row,3.1))*0.12;
  vec2 c = vec2(q.x/sz.x + off, q.y/sz.y);
  vec2 id = floor(c); vec2 f = (fract(c)-0.5)*sz;
  vec2 d = sz*0.5 - abs(f);
  float edge = min(d.x,d.y) + (vnoise(vec3(q*38.0,1.0))-0.5)*0.006;
  float m = smoothstep(0.004,0.009,edge);
  return vec4(m, hash12(id+0.5), hash12(id+19.7), smoothstep(0.004,0.022,edge));
}

void main(){
  if(dot(vec4(vWP,1.0), uClipPlane) < 0.0) discard;
  float mid = floor(vMat.x + 0.5);
  float interior = 0.0;
  if(mid >= 100.0){ mid -= 100.0; interior = 1.0; }
  int m = int(mid);
  vec3 Ng = normalize(vN);
  vec3 V = normalize(uViewPos - vWP);
  if(m==10 || m==11 || m==12){ if(dot(Ng,V) < 0.0) Ng = -Ng; }
  vec3 p = vWP;
  // wall coordinates
  vec3 tang = abs(Ng.y) > 0.75 ? vec3(1,0,0) : normalize(cross(vec3(0,1,0), Ng));
  vec2 q = abs(Ng.y) > 0.75 ? p.xz : vec2(dot(p,tang), p.y);

  vec3 alb = vCol; float rough = vMat.y; float metal = 0.0; float h = 0.0; float wet = 0.0; float transl = 0.0;
  vec3 emi = vec3(0.0); float flag = 0.0;
  vec3 Nout = Ng; bool bump = true;

  if(m==0){ // plaster, weathered, with patches of bare brick
    float big = fbm(p*0.55 + vCol*13.0);
    float mot = fbm(p*2.6);
    float fine = vnoise(p*34.0);
    alb *= 0.74 + 0.52*big;
    alb *= 0.86 + 0.28*mot;
    alb *= 0.93 + 0.14*fine;
    float streak = vnoise(vec3(q.x*5.2, q.y*0.42, 2.0))*vnoise(vec3(q.x*17.0, q.y*0.9, 5.0));
    alb *= 1.0 - 0.52*smoothstep(0.22,0.62,streak);
    float damp = 1.0 - smoothstep(0.35, 1.35, p.y + (fbm(p*1.7)-0.5)*1.1);
    alb = mix(alb, alb*vec3(0.38,0.43,0.40), damp);
    float pm = fbm(p*0.85 + 17.3) + (vnoise(p*9.0)-0.5)*0.07 + max(0.0, 1.6-p.y)*0.07;
    float patchM = smoothstep(0.636,0.652,pm) * (1.0-interior);
    float lip = smoothstep(0.622,0.640,pm) * (1.0-patchM) * (1.0-interior);
    h = (fbm(p*11.0)-0.5)*0.006 + (fine-0.5)*0.0022 + (fbm(p*2.2)-0.5)*0.012;
    float crk = abs(fbm(p*1.35+4.0) - 0.5);
    float crack = (1.0-smoothstep(0.0015,0.006,crk)) * smoothstep(0.45,0.7,vnoise(p*0.8+9.0));
    alb *= 1.0 - 0.55*crack; h -= crack*0.003;
    if(patchM > 0.001){
      vec4 b = brickPat(q, vec2(0.235,0.078));
      vec3 bc = mix(vec3(0.30,0.105,0.060), vec3(0.40,0.20,0.10), b.y) * (0.7+0.6*b.z) * (0.8+0.4*fine);
      vec3 mc = vec3(0.23,0.20,0.17)*(0.8+0.4*fine);
      alb = mix(alb, mix(mc,bc,b.x), patchM);
      h = mix(h, -0.016 + b.w*0.009 + (fine-0.5)*0.003, patchM);
    }
    h += lip*0.004; alb *= 1.0 + lip*0.14;
    float wetk = smoothstep(0.46,0.72, fbm(vec3(q.x*1.9, q.y*0.28, 6.0))) ;
    wetk = max(wetk, damp*0.8) * (1.0-interior);
    alb *= 1.0 - 0.22*wetk;
    rough = mix(0.86, 0.34, wetk);
  } else if(m==1){ // brick
    float fine = vnoise(p*40.0);
    vec4 b = brickPat(q, vec2(0.232,0.076));
    vec3 bc = vCol * (0.62+0.75*b.y) * mix(vec3(1.0), vec3(0.75,0.7,0.78), step(0.82,b.z));
    bc *= 0.75 + 0.5*fbm(p*7.0);
    alb = mix(vec3(0.22,0.195,0.165)*(0.75+0.5*fine), bc, b.x);
    alb *= 0.8+0.4*fbm(p*0.7);
    h = b.w*0.011 + (fine-0.5)*0.0035 + (vnoise(p*12.0)-0.5)*0.004;
    float wetk = smoothstep(0.45,0.75,fbm(vec3(q.x*1.6,q.y*0.3,2.0)));
    alb *= 1.0-0.25*wetk; rough = mix(0.82,0.3,wetk);
  } else if(m==2){ // dressed stone
    float fine = vnoise(p*55.0);
    vec4 b = brickPat(q, vec2(0.58,0.29));
    alb = vCol*(0.78+0.4*fbm(p*3.1))*(0.9+0.2*fine)*(0.88+0.24*b.y);
    alb *= 0.65 + 0.35*b.x;
    alb *= 1.0 - 0.35*smoothstep(0.4,0.8,fbm(vec3(q.x*4.0,q.y*0.6,8.0)));
    h = b.w*0.006 + (fbm(p*14.0)-0.5)*0.006 + (fine-0.5)*0.0015;
    rough = 0.42 + 0.3*fbm(p*2.0);
  } else if(m==3){ // painted timber
    float g = vnoise(vec3(q.x*70.0, q.y*3.0, 1.0));
    alb = vCol*(0.78+0.3*g)*(0.8+0.4*fbm(p*4.0));
    float chip = smoothstep(0.66,0.70,fbm(vec3(q.x*11.0,q.y*4.0,3.0)));
    alb = mix(alb, vec3(0.16,0.11,0.07), chip*0.8);
    h = (g-0.5)*0.0012 - chip*0.001;
    rough = mix(0.46,0.75,chip);
  } else if(m==4){ // wrought iron
    alb = vCol*(0.7+0.6*vnoise(p*23.0));
    float rust = smoothstep(0.6,0.78,fbm(p*9.0));
    alb = mix(alb, vec3(0.10,0.045,0.02), rust);
    metal = 0.55*(1.0-rust); rough = mix(0.34,0.7,rust);
  } else if(m==5){ // old window glass with a faint curtain behind
    vec2 cq = vec2(dot(p,tang), p.y);
    float fold = 0.5+0.5*sin(cq.x*52.0 + 2.5*vnoise(vec3(cq*3.0,0.0)));
    float curt = step(0.55, hash12(floor(cq*vec2(0.9,0.62))+3.0));
    alb = mix(vec3(0.006,0.008,0.011), vec3(0.07,0.065,0.058)*(0.4+0.6*fold), curt*smoothstep(0.3,0.6,fbm2(vec3(cq*1.7,2.0))));
    rough = 0.035; bump = false;
    vec3 w = vec3(vnoise(p*5.0), vnoise(p*5.0+11.0), vnoise(p*5.0+23.0)) - 0.5;
    Nout = normalize(Ng + w*0.022);
    flag = 3.0;
  } else if(m==6){ // wet cobble sett
    float fine = vnoise(p*85.0);
    float mid2 = fbm(p*17.0);
    alb *= (0.62+0.76*mid2)*(0.86+0.28*fine);
    alb = mix(alb, alb*vec3(1.35,1.2,1.0), smoothstep(0.55,0.75,fbm(p*5.3+3.0)));
    alb *= 0.62;
    h = (mid2-0.5)*0.0070 + (fine-0.5)*0.0012 + (vnoise(p*31.0)-0.5)*0.0022;
    float film = smoothstep(0.34,0.66,fbm(p*1.9+vec3(3.0,0.0,1.0)));
    rough = mix(0.36, 0.13, film);
    wet = mix(0.35, 1.0, film);
    float tide = 1.0 - smoothstep(0.0012, 0.0085, p.y + (fine-0.5)*0.003);
    alb *= 1.0 - 0.45*tide; rough = mix(rough, 0.07, tide); wet = mix(wet, 1.0, tide); h *= 1.0 - 0.8*tide;
    flag = 1.0;
  } else if(m==7){ // wet grit between the setts
    float fine = vnoise(p*70.0);
    alb = vCol*(0.5+fine)*(0.7+0.6*fbm(p*8.0));
    h = (fine-0.5)*0.004;
    rough = 0.42; wet = 0.35; flag = 1.0;
  } else if(m==8){ // puddle water at y = 0
    float shallow = 1.0 - smoothstep(0.04, 0.55, vCol.r);
    alb = vec3(0.004,0.0055,0.0065) + vec3(0.075,0.062,0.046)*shallow*shallow*(0.35+0.9*fbm(p*14.0));
    rough = 0.02; wet = 1.0; flag = 2.0; bump = false;
    vec2 grad = vec2(0.0);
    for(int i=0;i<24;i++){
      vec4 d = uDrips[i];
      if(d.w <= 0.0) continue;
      vec2 rv = p.xz - d.xy; float r = length(rv);
      if(r > 0.9) continue;
      // light-travel delay applies to the ripples too
      float tv = uTime - length(vec3(p.x,0.0,p.z) - uViewPos)/5.0;
      float age = mod(tv - d.z, d.w);
      float front = age*0.34;
      float x = r - front;
      float env = exp(-x*x/0.0016) * exp(-age*2.1) * smoothstep(0.0,0.05,age);
      float x2 = r - front*0.62;
      float env2 = exp(-x2*x2/0.0009) * exp(-age*2.6) * smoothstep(0.1,0.2,age);
      float sl = cos(x*150.0)*env*0.11 + cos(x2*170.0)*env2*0.07;
      grad += (rv/max(r,1e-3))*sl;
    }
    vec2 mic = vec2(vnoise(vec3(p.xz*7.0,1.0)), vnoise(vec3(p.xz*7.0,9.0))) - 0.5;
    grad += mic*0.006;
    Nout = normalize(vec3(-grad.x, 1.0, -grad.y));
  } else if(m==9){ // silvered mirror, foxed with age
    float edgeFox = smoothstep(0.62,0.80, fbm(p*4.3+31.0));
    alb = vec3(0.86,0.84,0.78)*(1.0-0.5*edgeFox*smoothstep(0.5,0.8,vnoise(p*23.0)));
    rough = 0.03; metal = 1.0; flag = 4.0; bump = false;
  } else if(m==10){ // cloth
    float weave = vnoise(p*140.0);
    alb = vCol*(0.9+0.2*weave)*(0.85+0.3*fbm(p*3.3));
    rough = 0.85; transl = 0.55; h = (weave-0.5)*0.0008;
  } else if(m==11){ // leaves
    alb = vCol*(0.65+0.7*vnoise(p*19.0));
    rough = 0.36; transl = 0.45; bump = false;
  } else if(m==12){ // petals
    alb = vCol*(0.75+0.5*vnoise(p*40.0));
    rough = 0.6; transl = 0.4; bump = false;
  } else if(m==13){ // generic matte
    alb = vCol*(0.8+0.4*vnoise(p*60.0))*(0.85+0.3*fbm(p*9.0));
    h = (vnoise(p*160.0)-0.5)*0.0012;
  } else if(m==14){ // roof tile
    alb = vCol*(0.6+0.8*fbm(p*5.0));
    alb = mix(alb, vec3(0.03,0.05,0.02), smoothstep(0.58,0.74,fbm(p*2.2+8.0)));
    rough = 0.33+0.3*vnoise(p*4.0); h = (vnoise(p*45.0)-0.5)*0.003;
  } else if(m==15){ // bottle glass
    alb = vCol*0.22; rough = 0.055; transl = 1.0; bump = false; flag = 5.0;
  } else if(m==16){ // brass
    alb = vCol*(0.8+0.4*vnoise(p*18.0)); metal = 0.9; rough = 0.3; bump = false;
  } else if(m==17){ // emitter: colour carries the source tint, aMat.z the lamp
    alb = vec3(0.025); rough = 0.12; bump = false;
    emi = vec3(vMat.z, vMat.w, 0.0);
    flag = 6.0;
  } else if(m==18){ // interior plaster / wallpaper
    alb = vCol*(0.85+0.3*fbm(p*1.8))*(0.94+0.12*vnoise(p*45.0));
    alb *= 0.93 + 0.07*step(0.5, fract(q.x*7.0));
    rough = 0.82; h = (vnoise(p*45.0)-0.5)*0.001;
  } else if(m==19){ // wooden boards (interior floor, counter)
    float board = floor(q.x/0.14);
    float g = vnoise(vec3(q.x*55.0, q.y*4.0, board));
    alb = vCol*(0.7+0.5*g)*(0.8+0.4*hash12(vec2(board,2.0)));
    alb *= 0.55+0.45*smoothstep(0.004,0.01, min(fract(q.x/0.14), 1.0-fract(q.x/0.14))*0.14);
    rough = 0.34; h = (g-0.5)*0.0008;
  } else if(m==20){ // fur
    float f1 = vnoise(vec3(p.x*190.0, p.y*70.0, p.z*190.0));
    float tab = smoothstep(0.35,0.65, 0.5+0.5*sin(p.y*70.0 + p.z*55.0 + 6.0*fbm(p*11.0)));
    alb = vCol*(0.55+0.9*f1)*mix(1.0,0.45,tab);
    rough = 0.72; h = (f1-0.5)*0.0022; transl = 0.0;
  }

  if(bump){
    vec3 dpx = dFdx(vWP), dpy = dFdy(vWP);
    float dhx = dFdx(h), dhy = dFdy(h);
    vec3 r1 = cross(dpy, Ng), r2 = cross(Ng, dpx);
    float det = dot(dpx, r1);
    vec3 gr = sign(det)*(dhx*r1 + dhy*r2);
    vec3 nb = abs(det)*Ng - gr;
    if(dot(nb,nb) > 1e-24) Nout = normalize(nb);
  }
  gPos = vec4(vWP, float(m)+1.0 + interior*100.0);
  gNor = vec4(Nout, rough);
  gAlb = vec4(alb, metal);
  gEmi = m==17 ? vec4(vCol, vMat.z*1000.0 + vMat.w) : vec4(transl, wet, flag, 0.0);
}`;

const DIST_VERT = /* glsl */`
out vec3 vWP;
void main(){
  vec3 p = position;
  #ifdef USE_INSTANCING
    p = (instanceMatrix*vec4(p,1.0)).xyz;
  #endif
  vec4 wp = modelMatrix*vec4(p,1.0); vWP = wp.xyz;
  gl_Position = projectionMatrix*viewMatrix*wp;
}`;
const DIST_FRAG = /* glsl */`
precision highp float;
in vec3 vWP; uniform vec3 uOrigin; uniform vec3 uAxis; uniform float uMode;
layout(location=0) out vec4 o;
void main(){
  float d = uMode < 0.5 ? length(vWP-uOrigin) : dot(uOrigin - vWP, uAxis);
  o = vec4(d/100.0, 0.0, 0.0, 1.0);
}`;

const FS_VERT = /* glsl */`
out vec2 vUv;
void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy,0.0,1.0); }`;

// shared by all lighting passes
const GLSL_LIGHT_COMMON = /* glsl */`
precision highp float; precision highp sampler3D;
in vec2 vUv;
uniform sampler2D tPos, tNor, tAlb, tEmi;
uniform samplerCube tShadow0, tShadow1, tShadow2;
uniform sampler2D tMoonShadow;
uniform mat4 uMoonMatrix; uniform vec3 uMoonDir; uniform vec3 uMoonOrigin;
uniform sampler3D tNoise3;
uniform sampler2D tBlue;
uniform vec3 uViewPos;        // camera position; for a reflection this is the MIRRORED camera
uniform mat4 uInvViewProj;
uniform mat4 uViewProj;
uniform vec4 uPlane;          // mirror plane of this view (0 for the main view)
uniform float uIsRefl;
uniform float uSample;
uniform vec2 uRes;
uniform float uLampI[3];
#define NVPL 112
uniform sampler2D tVpl;       // 3 rows: position+path0, normal, flux
uniform int uVplCount;
${GLSL_NOISE}
${GLSL_PHYSICS}

vec4 blue(vec2 fc, float k){
  vec4 b = texelFetch(tBlue, ivec2(mod(fc + floor(vec2(k*17.0, k*29.0)), 64.0)), 0);
  return fract(b + k*vec4(0.61803398875, 0.75487766625, 0.56984029099, 0.41421356237));
}
float shadowRaw(int i, vec3 d){
  if(i==0) return textureLod(tShadow0, d, 0.0).r*100.0;
  if(i==1) return textureLod(tShadow1, d, 0.0).r*100.0;
  return textureLod(tShadow2, d, 0.0).r*100.0;
}
// contact-hardening shadows from a small spherical source
float lampShadow(int i, vec3 P, vec3 N, vec4 bn){
  vec3 L = uLampPos[i];
  float d0 = distance(P,L);
  vec3 Po = P + N*(0.006 + 0.0011*d0);
  vec3 v = Po - L; float dr = length(v); vec3 w = v/dr;
  vec3 T = normalize(cross(w, abs(w.y)<0.9 ? vec3(0,1,0) : vec3(1,0,0))), B = cross(w,T);
  float rad = uLampTiming[i].z;
  float planeD = dot(v,N);
  float rot = bn.x*6.2831853;
  float bsum = 0.0, bn_ = 0.0;
  float searchR = clamp(rad*(dr-1.0)/1.0, 0.02, 0.28);
  for(int k=0;k<8;k++){
    float r = sqrt((float(k)+bn.y)/8.0), a = float(k)*2.39996+rot;
    vec3 sp = v + (T*cos(a)+B*sin(a))*r*searchR;
    vec3 sd = normalize(sp);
    float occ = shadowRaw(i, sd);
    float nd = dot(sd,N); float rec = nd < -0.06 ? planeD/nd : dr;
    if(occ < min(rec, dr+0.3) - 0.018 - dr*0.0012){ bsum += occ; bn_ += 1.0; }
  }
  if(bn_ < 0.5) return 1.0;
  float db = bsum/bn_;
  float pen = clamp(rad*(dr-db)/max(db,0.15), 0.006, 0.24);
  float lit = 0.0;
  for(int k=0;k<14;k++){
    float r = sqrt((float(k)+bn.z)/14.0), a = float(k)*2.39996+rot+1.3;
    vec3 sp = v + (T*cos(a)+B*sin(a))*r*pen;
    vec3 sd = normalize(sp);
    float occ = shadowRaw(i, sd);
    float nd = dot(sd,N); float rec = nd < -0.06 ? min(planeD/nd, dr+0.35) : dr;
    lit += step(rec - 0.016 - dr*0.0012, occ);
  }
  return lit/14.0;
}
float moonShadow(vec3 P, vec3 N, vec4 bn){
  vec3 Po = P + N*0.035 + uMoonDir*0.02;
  vec4 c = uMoonMatrix*vec4(Po,1.0); vec2 uv = c.xy*0.5+0.5;
  if(any(lessThan(uv,vec2(0.0))) || any(greaterThan(uv,vec2(1.0)))) return 1.0;
  float d = dot(uMoonOrigin - Po, uMoonDir);
  float lit = 0.0; float rot = bn.w*6.2831853;
  for(int k=0;k<6;k++){
    float r = sqrt((float(k)+bn.x)/6.0), a = float(k)*2.39996+rot;
    vec2 o = vec2(cos(a),sin(a))*r*0.0014;
    lit += step(d - 0.05, textureLod(tMoonShadow, uv+o, 0.0).r*100.0);
  }
  return lit/6.0;
}

// one-bounce light: virtual point lights, each with its own exact path  lamp -> Q -> P -> camera
vec3 indirectAt(vec3 P, vec3 N, vec3 camP, int stride, int phase){
  vec3 sum = vec3(0.0);
  float dPC = distance(P,camP);
  for(int j=phase;j<uVplCount;j+=stride){
    vec4 a = texelFetch(tVpl, ivec2(j,0), 0);
    vec3 d = a.xyz - P; float d2 = dot(d,d); float dl = sqrt(d2); vec3 w = d/max(dl,1e-3);
    float cp = max(dot(N,w)*0.9+0.1, 0.0); if(cp <= 0.0) continue;
    vec4 b = texelFetch(tVpl, ivec2(j,1), 0);
    float cq = max(dot(b.xyz,-w), 0.0); if(cq <= 0.0) continue;
    vec4 f = texelFetch(tVpl, ivec2(j,2), 0);
    int li = int(f.w+0.5);
    float tau = uTime - (a.w + dl + dPC)/C_LIGHT;
    // an area patch spreads its arrival times, so its front is softer than a point source's
    float on = s01((tau - uLampTiming[li].x + 0.09)/0.18);
    float off = 1.0 - s01((tau - uLampTiming[li].y + 0.09)/0.18);
    float g = on*off; if(g <= 0.0) continue;
    sum += f.rgb * uLampCol[li] * (g*cp*cq/(3.14159*(d2+0.9)));
  }
  return sum*float(stride);
}

float mistDensity(vec3 x){
  vec3 q = x*vec3(0.085,0.15,0.085) + vec3(uTime*0.0035, -uTime*0.001, uTime*0.002);
  float n = textureLod(tNoise3, q, 0.0).r;
  float n2 = textureLod(tNoise3, q*2.9+0.37, 0.0).r;
  float w = smoothstep(0.42,0.74, n*0.68+n2*0.32);
  float clearPocket = mix(0.28, 1.0, smoothstep(1.5, 7.5, length(x.xz - vec2(0.6, 0.0))));
  return (0.22 + 2.1*w*w) * exp(-max(x.y-1.2,0.0)/8.0) * (1.0 + 0.7*exp(-max(x.y,0.0)/0.8)) * clearPocket;
}
float phaseHG(float c, float g){ float g2=g*g; return (1.0-g2)/(12.566*pow(1.0+g2-2.0*g*c, 1.5)); }
float mistVis(int i, vec3 X, vec3 jit){
  vec3 v = X - uLampPos[i] + jit*(0.04 + 0.034*distance(X,uLampPos[i])); float d = length(v);
  return step(d - 0.05, shadowRaw(i, v/d));
}
#define SIGMA 0.0125
#define SHELL_GAIN 7.4
// In-scatter along a view ray. Because |L - X(s)| + s grows monotonically with s, the lit part of any ray is
// exactly the interval [s_darkness_front, s_light_front]: solved in closed form, so the shell never bands.
float frontS(float R, vec3 m, vec3 dir){
  float D2 = dot(m,m); if(R*R <= D2) return -1.0;
  return (R*R - D2)/(2.0*(R + dot(dir,m)));
}
vec3 mistRay(vec3 ro, vec3 dir, float s0, float s1, vec4 bn, int NS){
  vec3 acc = vec3(0.0);
  vec3 vj = fract(bn.zwx + bn.y*vec3(1.0,2.0,3.0)) - 0.5;
  for(int i=0;i<3;i++){
    vec3 L = uLampPos[i];
    vec3 m = ro - L;
    float tOn = uTime - uLampTiming[i].x;
    float tOff = uTime - uLampTiming[i].y;
    float sOn = frontS(C_LIGHT*(tOn - 0.5*RISE), m, dir);
    if(sOn < 0.0) continue;
    float sOff = frontS(C_LIGHT*(tOff - 0.5*FALL), m, dir);
    float a = max(s0, max(sOff, 0.0)), b = min(s1, sOn);
    float jit = fract(bn.x + float(i)*0.37);
    if(b > a + 1e-3){
      float tc = -dot(dir,m);
      float hh = max(sqrt(max(dot(m,m) - tc*tc, 0.0)), 0.16);
      float tha = atan((a-tc)/hh), thb = atan((b-tc)/hh);
      for(int k=0;k<NS;k++){
        float th = mix(tha,thb,(float(k)+jit)/float(NS));
        float s = tc + hh*tan(th);
        vec3 X = ro + dir*s;
        float dl = length(X-L);
        float tau = uTime - (dl + s)/C_LIGHT;
        vec2 pr = lampProfile(i, tau);
        if(pr.x <= 0.0) continue;
        float w = (thb-tha)/(float(NS)*hh) * (hh*hh + (s-tc)*(s-tc))/(dl*dl + 0.03);
        float ph = phaseHG(dot((X-L)/dl, -dir), 0.34);
        acc += uLampCol[i]*pr.x * (uLampI[i]*SIGMA*ph*w*mistDensity(X)*mistVis(i,X,vj)*exp(-0.012*(s+dl)));
      }
    }
    // the shell: sample uniformly in PATH LENGTH behind the front, then map back to distance along the ray
    float R = C_LIGHT*tOn;
    float D = length(m);
    for(int k=0;k<5;k++){
      float u = (float(k) + fract(bn.y + float(i)*0.21))/5.0;
      float lam = C_LIGHT*FLARE_TF*2.2;
      float x = -lam*log(1.0 - u*0.985);
      float pth = R - x;
      if(pth <= D) continue;
      float bb = dot(dir,m);
      float s = (pth*pth - D*D)/(2.0*(pth+bb));
      if(s < s0 || s > s1) continue;
      float dsdp = min((pth*pth + 2.0*pth*bb + D*D)/(2.0*(pth+bb)*(pth+bb)), 2.0);
      float pdf = exp(-x/lam)/(lam*0.985);
      vec3 X = ro + dir*s; float dl = length(X-L);
      float tau = uTime - pth/C_LIGHT;
      vec2 pr = lampProfile(i, tau);
      float ph = phaseHG(dot((X-L)/dl, -dir), 0.15);
      float dens = mistDensity(X);
      acc += uFlareCol[i]*vec3(1.0,0.83,0.60)*pr.y * (uLampI[i]*SIGMA*mix(0.8, SHELL_GAIN, smoothstep(0.1, 5.0, R-D))*ph*(0.78+0.36*dens)*mistVis(i,X,vj)*exp(-0.012*pth)/(dl*dl*0.13 + dl*0.82 + 1.9) * dsdp/(pdf*5.0));
    }
  }
  return acc;
}

vec3 skyColor(vec3 d){
  float h = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(vec3(0.030,0.054,0.100), vec3(0.0065,0.0135,0.038), pow(h,0.55));
  vec2 cp = d.xz/(d.y+0.22);
  float cl = fbm(vec3(cp*1.35 + 3.0, uTime*0.006));
  float cl2 = fbm(vec3(cp*3.7, 5.0 + uTime*0.01));
  float cloud = smoothstep(0.50,0.80, cl*0.75+cl2*0.25);
  float md = max(dot(d, uMoonDir),0.0);
  c = mix(c, vec3(0.030,0.043,0.070) + vec3(0.05,0.065,0.09)*pow(md,4.0), cloud*0.8);
  c += vec3(0.020,0.030,0.045)*pow(md,6.0);
  vec3 sd = d*210.0; vec3 id = floor(sd);
  vec3 rn = hash33(id);
  if(rn.x > 0.982){
    vec3 sp = id + 0.3 + 0.4*hash33(id+7.0);
    float dd = length(sd - sp);
    c += mix(vec3(0.6,0.75,1.0), vec3(1.0,0.86,0.7), rn.z) * exp(-dd*dd*11.0) * (0.06 + 1.1*pow(rn.y,6.0)) * (1.0-cloud*0.9) * smoothstep(0.02,0.25,d.y);
  }
  return c;
}
`;

// half-resolution: mist, one-bounce light, ambient occlusion
const HALF_FRAG = /* glsl */`
${GLSL_LIGHT_COMMON}
layout(location=0) out vec4 oMist;
layout(location=1) out vec4 oInd;
void main(){
  ivec2 full = textureSize(tPos,0);
  vec4 bn = blue(gl_FragCoord.xy, uSample);
  ivec2 ip = ivec2(vUv*vec2(full));
  vec4 P = texelFetch(tPos, ip, 0);
  vec4 wf = uInvViewProj*vec4(vUv*2.0-1.0, 1.0, 1.0);
  vec3 dir = normalize(wf.xyz/wf.w - uViewPos);
  float depth = 60.0;
  vec3 ind = vec3(0.0); float ao = 1.0;
  if(P.w > 0.5){
    depth = distance(P.xyz, uViewPos);
    dir = (P.xyz - uViewPos)/depth;
    vec3 N = texelFetch(tNor, ip, 0).xyz;
    ind = indirectAt(P.xyz, N, uViewPos, 1, 0);
    vec3 T = normalize(cross(N, abs(N.y)<0.9?vec3(0,1,0):vec3(1,0,0))), B = cross(N,T);
    float occ = 0.0;
    for(int k=0;k<14;k++){
      float u = (float(k)+bn.z)/14.0;
      float a = float(k)*2.39996 + bn.w*6.2831853;
      float ct = sqrt(1.0-u*0.92), st = sqrt(1.0-ct*ct);
      float rr = mix(0.05, 0.85, pow(fract(u*7.31+bn.y),1.6));
      vec3 S = P.xyz + N*0.012 + (T*cos(a)*st + B*sin(a)*st + N*ct)*rr;
      vec4 c = uViewProj*vec4(S,1.0); if(c.w<=0.0) continue;
      vec2 uv = c.xy/c.w*0.5+0.5;
      if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0)))) continue;
      vec4 Q = texture(tPos, uv); if(Q.w<0.5) continue;
      float dq = distance(Q.xyz,uViewPos), ds = distance(S,uViewPos);
      if(dq < ds - 0.012){ occ += smoothstep(1.3, 0.35, distance(Q.xyz,P.xyz)); }
    }
    ao = clamp(1.0 - occ/14.0*1.35, 0.06, 1.0);
  }
  oMist = vec4(mistRay(uViewPos, dir, 0.0, depth, bn, 18), depth);
  oInd = vec4(ind, ao);
}`;

// full-resolution shading; the same shader shades the reflection views from the mirrored camera
const LIGHT_FRAG = /* glsl */`
${GLSL_LIGHT_COMMON}
uniform sampler2D tHalfMist, tHalfInd;
uniform sampler2D tReflG, tReflM;
uniform vec4 uGlass[4];       // analytic panes: centre + half width
uniform vec3 uGlassU[4];
uniform vec4 uGlassN[4];      // normal + half height
uniform vec3 uMirrorN;
uniform float uAudit;       // > 0: show only the direct light of lamp (uAudit - 1)
layout(location=0) out vec4 o;

float D_GGX(float nh, float a){ float a2=a*a; float d=nh*nh*(a2-1.0)+1.0; return a2/(3.14159*d*d+1e-7); }
float V_Smith(float nv, float nl, float a){ float a2=a*a; float gv=nl*sqrt(nv*nv*(1.0-a2)+a2), gsl=nv*sqrt(nl*nl*(1.0-a2)+a2); return 0.5/(gv+gsl+1e-6); }
vec3 brdf(vec3 N, vec3 V, vec3 L, vec3 diffC, vec3 F0, float rough, float sphereK){
  float nl = max(dot(N,L),0.0); if(nl<=0.0) return vec3(0.0);
  float nv = max(dot(N,V),1e-3);
  vec3 H = normalize(V+L); float nh = max(dot(N,H),0.0), vh = max(dot(V,H),0.0);
  float a = max(rough*rough, 0.0016);
  float a2 = clamp(a + sphereK, 0.0, 1.0);
  float norm = (a/a2)*(a/a2);
  vec3 F = F0 + (1.0-F0)*pow(1.0-vh,5.0);
  vec3 spec = D_GGX(nh,a2)*V_Smith(nv,nl,a2)*F*max(norm, 0.04);
  return (diffC/3.14159*(1.0-F) + min(spec, vec3(40.0)))*nl;
}

vec3 sampleRefl(sampler2D t, vec2 uv, vec2 spread, vec4 bn){
  vec3 s = vec3(0.0);
  float lod = max(log2(max(max(spread.x,spread.y)*float(textureSize(t,0).x)*0.45, 1.0)), 0.0);
  for(int k=0;k<10;k++){
    float r = sqrt((float(k)+bn.y)/10.0), a = float(k)*2.39996 + bn.x*6.2831853;
    s += textureLod(t, uv + vec2(cos(a),sin(a))*r*spread, lod).rgb;
  }
  return s/10.0;
}

void main(){
  vec4 bn = blue(gl_FragCoord.xy, uSample+3.0);
  ivec2 ip = ivec2(gl_FragCoord.xy);
  vec4 P4 = texelFetch(tPos, ip, 0);
  vec4 wf = uInvViewProj*vec4(vUv*2.0-1.0, 1.0, 1.0);
  vec3 ray = normalize(wf.xyz/wf.w - uViewPos);
  vec3 col;
  float depth = 60.0;
  float mid = P4.w;
  float interior = 0.0; if(mid > 100.0){ mid -= 100.0; interior = 1.0; }

  bool audit = uAudit > 0.5; int auditLamp = int(uAudit + 0.5) - 1;
  if(P4.w < 0.5){
    col = audit ? vec3(0.0) : skyColor(ray);
  } else {
    vec3 P = P4.xyz;
    depth = distance(P, uViewPos);
    ray = (P - uViewPos)/depth;
    vec3 V = -ray;
    vec4 nr = texelFetch(tNor, ip, 0), am = texelFetch(tAlb, ip, 0), em = texelFetch(tEmi, ip, 0);
    vec3 N = nr.xyz; float rough = nr.w;
    int m = int(mid + 0.5) - 1;
    float transl = em.x, wet = em.y, flag = em.z;
    if(m==17){ transl = 0.0; wet = 0.0; flag = 6.0; }
    vec3 alb = am.rgb; float metal = am.a;
    vec3 diffC = alb*(1.0-metal);
    vec3 F0 = mix(vec3(m==8 ? 0.02 : 0.04), alb, metal);
    col = vec3(0.0);

    // ── indirect + occlusion ──
    vec3 ind; float ao;
    if(uIsRefl < 0.5){
      // depth-aware upsample of the half-resolution buffers
      vec2 hs = vec2(textureSize(tHalfInd,0));
      vec2 hp = vUv*hs - 0.5; ivec2 i0 = ivec2(floor(hp)); vec2 f = hp - floor(hp);
      vec4 sum = vec4(0.0); float ws = 0.0;
      for(int j=0;j<4;j++){
        ivec2 o_ = ivec2(j&1, j>>1);
        ivec2 c = clamp(i0+o_, ivec2(0), ivec2(hs)-1);
        float dd = texelFetch(tHalfMist, c, 0).a;
        float w = (o_.x==1?f.x:1.0-f.x)*(o_.y==1?f.y:1.0-f.y) / (0.002 + abs(dd-depth)/depth*8.0);
        sum += texelFetch(tHalfInd, c, 0)*w; ws += w;
      }
      sum /= max(ws,1e-6); ind = sum.rgb; ao = sum.a;
    } else {
      ind = indirectAt(P, N, uViewPos, 3, int(mod(uSample,3.0)));
      ao = 0.8;
    }

    // ── steady sky fill and moonlight: they arrived long ago and never change ──
    float skyVis = mix(0.52, 1.0, smoothstep(0.0, 8.5, P.y));
    if(interior > 0.5) skyVis *= 0.16;
    vec3 skyAmb = mix(vec3(0.044,0.062,0.094), vec3(0.108,0.176,0.325), N.y*0.5+0.5);
    skyAmb += vec3(0.028,0.046,0.086)*max(N.x,0.0) + vec3(0.016,0.025,0.046)*max(N.z,0.0);
    float aoA = ao*ao*0.55 + ao*0.45;
    col += diffC*skyAmb*skyVis*aoA*1.12;
    col += diffC*ind*aoA;
    {
      vec3 R = reflect(ray, N);
      float fr = pow(1.0-max(dot(N,V),0.0),5.0);
      vec3 envF = F0 + (max(vec3(1.0-rough),F0)-F0)*fr;
      vec3 env = mix(vec3(0.018,0.027,0.042), vec3(0.046,0.086,0.175), smoothstep(-0.2,0.7,R.y));
      if(flag == 1.0) env *= 2.3;
      if(flag < 1.5 || flag > 2.5) col += envF*env*skyVis*ao*(1.0-rough*0.6)*(flag==4.0?0.0:1.0)*(flag==3.0?1.9:1.0);
      col += ind*envF*ao*0.18*(flag==2.0||flag==4.0?0.0:1.0);
    }
    float nlM = dot(N, uMoonDir);
    vec3 moonC = vec3(0.235,0.355,0.640)*0.86;
    if(nlM > 0.0 || transl > 0.0){
      float ms = moonShadow(P, N*sign(nlM+1e-5), bn);
      if(flag != 2.0 && flag != 4.0) col += brdf(N,V,uMoonDir, diffC, F0, max(rough,0.16), 0.004)*moonC*3.14159*ms;
      col += diffC*moonC*max(-nlM,0.0)*transl*0.45*ms;
    }

    if(audit) col = vec3(0.0);

    // ── lamps: every term carries the full path length ──
    float dPC = depth;
    for(int i=0;i<3;i++){
      if(audit && i != auditLamp) continue;
      vec3 Lv = uLampPos[i] - P; float dl = length(Lv); vec3 L = Lv/dl;
      float tau = uTime - (dl + dPC)/C_LIGHT;
      vec3 e = lampEmit(i, tau);
      if(e.r+e.g+e.b <= 0.0) continue;
      float nl = dot(N,L);
      if(nl <= 0.0 && transl <= 0.0) continue;
      vec3 f = vec3(0.0);
      if(flag != 2.0 && flag != 4.0) f = brdf(N,V,L, diffC, F0, rough, uLampTiming[i].z/(2.0*dl));
      if(flag == 2.0) f = diffC*max(nl,0.0)*0.22;
      float tw = transl > 0.0 ? max(-nl,0.0)*transl : 0.0;
      if(flag==5.0){ tw = 0.0;
        // light caught inside a bottle: a soft coloured body glow plus a refracted caustic edge
        f += alb*(0.20 + 1.1*pow(1.0-abs(dot(N,V)),2.0) + 1.6*pow(max(dot(refract(-L,N,0.72),V),0.0),6.0))*0.55;
      }
      f += alb*tw*0.5/3.14159;
      if(f.r+f.g+f.b <= 0.0) continue;
      float sh = lampShadow(i, P, nl>0.0 ? N : -N, bn);
      if(sh <= 0.0) continue;
      float fall = 1.0/(dl*dl + 0.22);
      col += min(f*e*(uLampI[i]*fall*sh), vec3(30.0));
    }

    // ── emitters (bulb, lantern, neon tubes) ──
    if(flag == 6.0){
      float code = em.a; int li = int(floor(code/1000.0 + 0.0005)); float str = code - float(li)*1000.0;
      float tau = uTime - dPC/C_LIGHT;
      vec2 pr = lampProfile(li, tau);
      float rim = li==2 ? 1.0 : 0.55 + 0.45*max(dot(N,V),0.0);
      if(!audit || li == auditLamp) col += em.rgb*(pr.x + pr.y*0.35)*str*rim;
      if(!audit) col += em.rgb*0.006;
    }

    // ── planar reflections (rendered from the mirrored camera, so their delay is the full bounce path) ──
    if(uIsRefl < 0.5){
      if(flag == 1.0 || flag == 2.0){
        float cosV = max(dot(N,V), 0.0);
        if(flag == 2.0){
          float F = 0.085 + 0.915*pow(1.0-max(V.y,0.0), 3.4);
          vec2 dist = audit ? vec2(0.0) : N.xz*vec2(0.55, 0.9)/(1.0+depth*0.25);
          vec3 rf = sampleRefl(tReflG, vUv + dist, audit ? vec2(0.0) : vec2(0.0007, 0.0014), bn);
          col += rf*min(F*1.55, 1.0);
        } else {
          float up = smoothstep(0.35, 0.9, N.y);
          float F = 0.028 + 0.972*pow(1.0-clamp(mix(V.y, cosV, 0.35),0.0,1.0), 4.0);
          vec2 dist = (N.xz)*vec2(0.10, 0.07)/(1.0+depth*0.2);
          vec2 spr = vec2(0.0035, 0.020)*(rough*2.6) ;
          vec3 rf = sampleRefl(tReflG, vUv + dist, spr, bn);
          if(!audit) col += rf*F*wet*up*(1.0-rough*1.2)*0.95*mix(0.55,1.0,ao);
        }
      } else if(flag == 4.0){
        vec2 dist = audit ? vec2(0.0) : (vec2(vnoise(P*3.1), vnoise(P*3.1+5.0))-0.5)*0.0016;
        vec3 rf = textureLod(tReflM, vUv + dist, 0.0).rgb;
        col += rf*alb*1.05;
      }
    } else if(flag == 4.0){
      col += vec3(0.004,0.006,0.010);
    }
  }

  // ── thin clear panes in front of the cafe and the shop: faint, with exact glints ──
  float paneT = 1.0;
  if(uIsRefl < 0.5 && !audit){
    for(int g=0; g<4; g++){
      if(uGlass[g].w <= 0.0) continue;
      vec3 gn = uGlassN[g].xyz;
      float den = dot(ray, gn); if(den >= -0.02) continue;
      float s = dot(uGlass[g].xyz - uViewPos, gn)/den;
      if(s <= 0.0 || s >= depth) continue;
      vec3 X = uViewPos + ray*s; vec3 r = X - uGlass[g].xyz;
      if(abs(dot(r,uGlassU[g])) > uGlass[g].w || abs(r.y) > uGlassN[g].w) continue;
      vec3 w = vec3(vnoise(X*3.0), vnoise(X*3.0+11.0), vnoise(X*3.0+23.0)) - 0.5;
      vec3 N = normalize(gn + w*0.035);
      float F = 0.04 + 0.96*pow(1.0-abs(dot(ray,N)),5.0);
      vec3 R = reflect(ray,N);
      vec3 refl = mix(vec3(0.006,0.010,0.017), vec3(0.028,0.050,0.10), smoothstep(0.0,0.5,R.y));
      for(int i=0;i<3;i++){
        vec3 Lv = uLampPos[i]-X; float dl = length(Lv);
        float cs = max(dot(R, Lv/dl), 0.0);
        float glint = pow(cs, 2600.0)*220.0 + pow(cs, 120.0)*0.5;
        if(glint < 0.01) continue;
        refl += lampEmit(i, uTime-(dl+s)/C_LIGHT)*glint*uLampI[i]/(dl*dl)*1.2;
      }
      float smear = smoothstep(0.55,0.85,fbm(X*vec3(2.6,1.1,2.6)));
      col = col*(1.0 - F) + refl*F + vec3(0.002,0.003,0.005)*smear;
    }
  }

  // steady moonlit haze for depth
  float s0 = 0.0;
  if(uIsRefl > 0.5){
    float den = dot(ray, uPlane.xyz);
    s0 = clamp(-(dot(uViewPos, uPlane.xyz)+uPlane.w)/(abs(den)<1e-4?1e-4:den), 0.0, depth);
  }
  float fogA = 1.0 - exp(-(min(depth,45.0) - s0)*0.0085);
  if(P4.w > 0.5 && !audit) col = mix(col, vec3(0.017,0.032,0.064), fogA*(interior>0.5?0.2:1.0));

  vec3 mist = vec3(0.0);
  if(uIsRefl < 0.5){
    vec2 hs = vec2(textureSize(tHalfMist,0));
    vec2 hp = vUv*hs - 0.5; ivec2 i0 = ivec2(floor(hp)); vec2 f = hp - floor(hp);
    float ws = 0.0;
    for(int j=0;j<4;j++){
      ivec2 o_ = ivec2(j&1, j>>1);
      ivec2 c = clamp(i0+o_, ivec2(0), ivec2(hs)-1);
      vec4 s = texelFetch(tHalfMist, c, 0);
      float w = (o_.x==1?f.x:1.0-f.x)*(o_.y==1?f.y:1.0-f.y) / (0.004 + abs(s.a-depth)/depth*5.0);
      mist += s.rgb*w; ws += w;
    }
    mist /= max(ws,1e-6);
  } else {
    mist = mistRay(uViewPos, ray, s0, depth, bn, 9);
  }
  if(!audit) col += mist;
  if(!(col.r >= 0.0) || !(col.g >= 0.0) || !(col.b >= 0.0)) col = vec3(0.0);
  o = vec4(min(col, vec3(60.0)), 1.0);
}`;

const ACC_FRAG = /* glsl */`
precision highp float; in vec2 vUv; uniform sampler2D tSrc; uniform float uW; layout(location=0) out vec4 o;
void main(){ o = vec4(texelFetch(tSrc, ivec2(gl_FragCoord.xy), 0).rgb*uW, uW); }`;

const DOWN_FRAG = /* glsl */`
precision highp float; in vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uFirst; layout(location=0) out vec4 o;
vec3 S(vec2 d){ return texture(tSrc, vUv + d*uTexel).rgb; }
float karis(vec3 c){ return 1.0/(1.0+dot(c,vec3(0.2126,0.7152,0.0722))*0.25); }
void main(){
  vec3 a=S(vec2(-2,2)),b=S(vec2(0,2)),c=S(vec2(2,2)),d=S(vec2(-2,0)),e=S(vec2(0,0)),f=S(vec2(2,0)),g=S(vec2(-2,-2)),h=S(vec2(0,-2)),i=S(vec2(2,-2)),j=S(vec2(-1,1)),k=S(vec2(1,1)),l=S(vec2(-1,-1)),m=S(vec2(1,-1));
  vec3 r;
  if(uFirst > 0.5){
    vec3 g0=(j+k+l+m)*0.25, g1=(a+b+d+e)*0.25, g2=(b+c+e+f)*0.25, g3=(d+e+g+h)*0.25, g4=(e+f+h+i)*0.25;
    float w0=karis(g0)*0.5,w1=karis(g1)*0.125,w2=karis(g2)*0.125,w3=karis(g3)*0.125,w4=karis(g4)*0.125;
    r=(g0*w0+g1*w1+g2*w2+g3*w3+g4*w4)/(w0+w1+w2+w3+w4);
  } else r = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
  o = vec4(r,1.0);
}`;
const UP_FRAG = /* glsl */`
precision highp float; in vec2 vUv; uniform sampler2D tSrc; uniform sampler2D tBase; uniform vec2 uTexel; uniform float uMix; layout(location=0) out vec4 o;
vec3 S(vec2 d){ return texture(tSrc, vUv + d*uTexel).rgb; }
void main(){
  vec3 u = S(vec2(0))*4.0 + (S(vec2(1,0))+S(vec2(-1,0))+S(vec2(0,1))+S(vec2(0,-1)))*2.0 + S(vec2(1,1))+S(vec2(-1,1))+S(vec2(1,-1))+S(vec2(-1,-1));
  o = vec4(mix(texture(tBase,vUv).rgb, u/16.0, uMix), 1.0);
}`;

const FINAL_FRAG = /* glsl */`
precision highp float; in vec2 vUv;
uniform sampler2D tHDR, tBloom, tBlue;
uniform vec2 uOut; uniform float uFrame; uniform float uSS; uniform float uExposure;
layout(location=0) out vec4 o;
vec3 RRTAndODTFit(vec3 v){ vec3 a=v*(v+0.0245786)-0.000090537; vec3 b=v*(0.983729*v+0.4329510)+0.238081; return a/b; }
vec3 aces(vec3 c){
  const mat3 I = mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777);
  const mat3 O = mat3(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602);
  return clamp(O*RRTAndODTFit(I*(c/0.6)),0.0,1.0);
}
vec3 srgb(vec3 c){ return mix(c*12.92, 1.055*pow(c,vec3(1.0/2.4))-0.055, step(0.0031308,c)); }
void main(){
  vec2 px = 1.0/uOut;
  vec3 bloom = texture(tBloom, vUv).rgb;
  vec2 cc = vUv - 0.5;
  float vig = 1.0 - 0.27*smoothstep(0.18, 0.78, dot(cc,cc)*1.7);
  vec3 sum = vec3(0.0);
  // supersample resolve in display-linear light
  int n = uSS > 1.5 ? 2 : 1;
  for(int y=0;y<n;y++) for(int x=0;x<n;x++){
    vec2 uv = n==2 ? vUv + (vec2(x,y)-0.5)*0.5*px : vUv;
    vec3 h = texture(tHDR, uv).rgb;
    h = mix(h, bloom, 0.045) + max(bloom - 0.55, 0.0)*0.05;
    sum += aces(h*uExposure*vig);
  }
  vec3 c = sum/float(n*n);
  float lum = dot(c, vec3(0.2126,0.7152,0.0722));
  // gentle grade: cool lifted shadows, warm highlights
  c *= mix(vec3(0.95,1.0,1.07), vec3(1.03,1.0,0.96), smoothstep(0.02,0.45,lum));
  vec3 s = srgb(clamp(c,0.0,1.0));
  s = s + vec3(0.0035,0.0065,0.0135)*(1.0-smoothstep(0.0,0.35,s));
  float L = dot(s, vec3(0.299,0.587,0.114));
  // fine grain, strongest in the midtones and nearly absent in the darks
  ivec2 fc = ivec2(gl_FragCoord.xy);
  ivec2 off = ivec2(int(mod(uFrame*47.0,64.0)), int(mod(uFrame*83.0,64.0)));
  vec4 bn = texelFetch(tBlue, (fc+off)%64, 0);
  float h1 = fract(sin(dot(vec2(fc) + mod(uFrame,97.0)*vec2(1.37,2.11), vec2(12.9898,78.233)))*43758.5453);
  float gAmt = 0.020*smoothstep(0.03,0.30,L)*(1.0-0.6*smoothstep(0.55,0.95,L));
  s += (h1 + bn.g - 1.0)*gAmt;
  // blue-noise TPDF dither of one 8-bit step
  float u1 = bn.r;
  float tri = u1 < 0.5 ? sqrt(2.0*u1)-1.0 : 1.0-sqrt(2.0-2.0*u1);
  s += tri/255.0;
  o = vec4(clamp(s,0.0,1.0), 1.0);
}`;
