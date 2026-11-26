// ---------- GLSL ----------
const GLSL_COMMON = `#version 300 es
precision highp float; precision highp int; precision highp sampler2DShadow;
#define PI 3.14159265359
float h11(float n){ uint x=uint(int(n)+4096)*1597334677u; x=(x^(x>>16u))*2246822519u; x^=x>>13u; return float(x)/4294967295.0; }
float h21(vec2 p){ uvec2 q=uvec2(ivec2(floor(p))+ivec2(32768)); uint x=q.x*1597334677u ^ q.y*3812015801u; x=(x^(x>>16u))*2246822519u; x^=x>>13u; return float(x)/4294967295.0; }
vec2 h22(vec2 p){ return vec2(h21(p),h21(p+vec2(37.,113.))); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec2(11.7,5.3); a*=.5; } return s/0.9375; }
`;

const VS_FULL = `#version 300 es
out vec2 vUv;
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUv=p; gl_Position=vec4(p*2.-1.,0.,1.); }`;

const VS_MESH = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUv; layout(location=3) in vec4 aM;
uniform mat4 uVP, uView;
out vec3 vPos, vNrm; out vec2 vUv; flat out int vMat; flat out float vPart; out float vLW, vAO, vZ;
void main(){ vPos=aPos; vNrm=aNrm; vUv=aUv; vMat=int(aM.x+.5); vPart=aM.y; vLW=aM.z; vAO=aM.w; vZ = -(uView*vec4(aPos,1.)).z; gl_Position=uVP*vec4(aPos,1.); }`;

const VS_SHADOW = `#version 300 es
layout(location=0) in vec3 aPos; uniform mat4 uVP; void main(){ gl_Position=uVP*vec4(aPos,1.); }`;
const FS_SHADOW = `#version 300 es
precision highp float; void main(){}`;

const GLSL_SHADOWFN = `
uniform mat4 uShadowVP; uniform sampler2DShadow uShadow; uniform float uShadowOn;
float shadowAt(vec3 p){
  if(uShadowOn<.5) return 1.;
  vec4 c = uShadowVP*vec4(p,1.); vec3 s = c.xyz/c.w*.5+.5;
  if(s.x<0.||s.x>1.||s.y<0.||s.y>1.||s.z>1.) return 1.;
  float t=1./2048., r=0.;
  for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++) r+=texture(uShadow, vec3(s.xy+vec2(i,j)*t*1.2, s.z-.0016));
  return r/9.;
}
`;

const FS_MESH = GLSL_COMMON + GLSL_SHADOWFN + `
in vec3 vPos, vNrm; in vec2 vUv; flat in int vMat; flat in float vPart; in float vLW, vAO, vZ;
uniform vec4 uMatLit[56], uMatShade[56], uMatDeep[56];
uniform vec3 uCam, uL, uRimDir, uLitTint, uShadeTint, uRimCol, uFogCol, uSilCol;
uniform float uRimAmt, uFog, uSil, uT1, uTime, uDiscBlur, uChainBlur, uBright;
uniform vec4 uEyeA[2], uEyeB[2];
uniform vec3 uEyeGlow[2];
layout(location=0) out vec4 oColor; layout(location=1) out vec4 oG;

vec3 shadeOf(vec3 c){ return c*vec3(.70,.60,.74); }
vec3 deepOf(vec3 c){ return c*vec3(.40,.31,.52); }

float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }

// anime eye drawn in decal space. returns rgb, a = 0 -> discard, a = .5 -> emissive
vec4 animeEye(vec2 p, int who, vec3 irisLo, vec3 irisHi, vec3 skin){
  vec4 A=uEyeA[who], B=uEyeB[who];
  float open=A.x, brow=A.y, pup=A.z; int mode=int(A.w+.5);
  float glint=B.x, glow=B.y; vec2 look=B.zw;
  vec3 ink=vec3(.075,.04,.10);
  float bx = p.x;
  float by = 0.80 - brow*0.30*bx - brow*0.07 + 0.07*(1.-bx*bx*.6);
  if(mode==1) by += .16;
  float bt = 0.285*(1.-smoothstep(.62,1.40,abs(bx+.08))) * (0.78+0.30*smoothstep(-1.2,.6,bx));
  if(who==1) bt*=1.15;
  float inBrow = step(abs(p.y-by), bt*.5);
  float skinD = length(vec2((p.x-.02)/(p.x>0.?1.28:1.16), (p.y+.02)/.84));
  if(skinD>1. && inBrow<.5) return vec4(0);
  vec3 col = skin;
  if(p.y>by-bt*.5-.2 && p.y<by) col = skin*vec3(.74,.62,.70);
  if(skinD>.9) col = skin*vec3(.86,.74,.76);
  float nx=(p.x-.03)/.90; float e=max(0.,1.-nx*nx);
  float top = open*(.55*pow(e,.55)) - brow*.23*nx*pow(e,.3) - brow*.07*pow(e,.5)*open - .02;
  float bot = -open*.43*pow(e,.75) - .03;
  if(mode==1){ top = .70*pow(e,.5)-.02; bot = -.58*pow(e,.6)-.03; }
  if(mode==4){ top = min(top, .07+.05*nx); }
  top += max(0.,-nx-.82)*.75;
  bool closed = open<.06 || mode==2 || mode==3 || mode==5;
  float em = 0.;
  if(!closed){
    if(abs(nx)<1. && p.y<top && p.y>bot){
      col = vec3(.98,.97,.99);
      if(p.y>top-.17) col = vec3(.66,.68,.86);
      vec2 c = vec2(.13,-.02)+look*vec2(.22,.16); float r = mode==1?.27:.43;
      float d = length(p-c);
      if(d<r){
        float g = smoothstep(-r*.8, r*.7, p.y-c.y);
        col = mix(irisLo, irisHi, g);
        if(p.y-c.y < -r*.30 && d<r*.82) col = mix(col, irisLo*1.25+.08, .6);
        float ang = atan(p.y-c.y,p.x-c.x);
        col *= .90+.13*step(.0, sin(ang*22.+d*9.));
        if(d>r*.84) col = irisHi*.30;
        vec2 q = p-c; if(who==1) q.x*=1.75;
        if(length(q)<r*.45*pup) col = ink;
        if(glow>0.){ col = mix(col, uEyeGlow[who], glow*smoothstep(r*.1,r,d)*.85); em=glow; }
        if(p.y>top-.15) col*=.62;
      }
      if(length(p-c-vec2(-.15,.15))<(mode==1?.07:.115)) { col=vec3(1.25); em=1.; }
      if(length(p-c-vec2(.15,-.17))<.052) { col=vec3(1.15); em=1.; }
      if(glint>0.){ vec2 q=p-c-vec2(-.15,.15); float s = abs(q.x*q.y)*900.+length(q)*3.2/(.2+glint); if(s<1.) {col=vec3(1.3); em=1.;} }
    }
    float tl = .115 + .05*smoothstep(.9,-.7,nx);
    if(nx>-1.22 && nx<1.04 && p.y>top-tl*.22 && p.y<top+tl*(.78-.35*smoothstep(-.95,-1.22,nx))) col=ink;
    if(abs(nx)<.78 && abs(p.y-bot+.028)<.024*(1.-nx*nx)+.006) col=ink;
    if(open>.5 && abs(nx)<.8 && abs(p.y-top-tl*1.75)<.020) col=skin*vec3(.62,.46,.5);
  } else {
    float d=1e3;
    if(mode==2){ d=min(sdSeg(p,vec2(-.62,.34),vec2(.42,-.02)), sdSeg(p,vec2(.42,-.02),vec2(-.58,-.36))); if(d<.085) col=ink; }
    else if(mode==3){ float y = .40*e-.17; if(abs(nx)<.92 && abs(p.y-y)<.075+.075*e) col=ink; }
    else { float y = -.06-.13*e + max(0.,-nx-.7)*.45; if(nx>-1.15&&nx<1. && abs(p.y-y)<.03+.055*e) col=ink;
      for(int k=0;k<3;k++){ float fx=-.55+float(k)*.22; if(sdSeg(p,vec2(fx,-.19),vec2(fx-.13,-.38+.03*float(k)))<.026) col=ink; } }
  }
  if(inBrow>.5){ col = who==1 ? vec3(.07,.05,.11) : vec3(.20,.12,.16); if(p.y>by+bt*.18) col = who==1? vec3(.22,.20,.34) : vec3(.55,.40,.40); }
  return vec4(col, em>0.?.5:1.);
}

void main(){
  vec4 mL=uMatLit[vMat], mS=uMatShade[vMat], mD=uMatDeep[vMat];
  int pat=int(mL.a+.5);
  vec3 lit=mL.rgb, shd=mS.rgb, dep=mD.rgb; float spec=mS.a;
  vec3 N=normalize(vNrm), Vv=normalize(uCam-vPos);
  if(dot(N,Vv)<-.04) N=-N;
  bool emissive=false; bool eyeMat=false;
  vec2 uv=vUv;
  if(pat==1){ // beak
    float s=uv.x, a=abs(uv.y);
    lit = mix(vec3(1.0,.76,.22), vec3(1.0,.55,.11), smoothstep(.15,.85,s));
    if(a<.17) lit = mix(lit, vec3(1.0,.88,.46), .75);
    if(s>.895-a*.03) lit=vec3(.90,.24,.11);
    if(s>.972) lit=vec3(.62,.13,.09);
    if(a>.50&&a<.545&&s<.9) lit*=vec3(.74,.55,.52);
    if(s<.075) lit=mix(lit,vec3(1.,.70,.22),.5);
    // scar: two slashes across the base of the upper bill
    for(int k=0;k<2;k++){ float c = (k==0?.215:.285) + (a-.34)*.13; float w = (k==0?.0105:.0085)*(1.-smoothstep(.18,.34,abs(a-.38))); float d=abs(s-c);
      if(w>.001){ if(d<w) lit=vec3(1.0,.93,.83); else if(d<w+.0055) lit=vec3(.45,.13,.12); } }
    shd=shadeOf(lit); dep=deepOf(lit);
  } else if(pat==2){ // pouch
    float s=uv.x, a=abs(uv.y);
    lit = mix(vec3(1.0,.50,.17), vec3(1.0,.66,.24), smoothstep(.1,.9,a));
    if(fract(uv.y*4.6+.5)<.07 && s>.06 && s<.86) lit*=vec3(.90,.80,.80);
    if(!gl_FrontFacing && false) lit=vec3(.5,.1,.15);
    shd=shadeOf(lit); dep=deepOf(lit);
  } else if(pat==3){ // falcon body: slate back, barred cream breast
    float a=abs(uv.y);
    if(a>.47+.05*sin(uv.x*40.)){ lit=vec3(.93,.87,.74);
      float f=fract(uv.x*13.+a*1.1+ .12*sin(a*25.)); if(f<.30 && a>.56) lit=vec3(.30,.22,.26);
      shd=lit*vec3(.66,.60,.76); dep=deepOf(lit); }
  } else if(pat==4){ // tyre
    float a=abs(uv.y);
    if(a>.36&&a<.82){ lit=vec3(.88,.66,.42); shd=vec3(.60,.40,.30); dep=vec3(.32,.20,.20); if(a>.55&&a<.585) lit*=.82; }
    else if(a<.36 && fract(uv.x*90.)<.12 && uDiscBlur<.05) lit*=.7;
  } else if(pat==5){ // disc wheel emblem with rotational blur
    float acc=0., ring=0.;
    for(int k=0;k<12;k++){ float u=uv.x + uDiscBlur*(float(k)/12.)/6.2831853; float f=fract(u*3.-uv.y*.85); acc += step(f,.17)*step(.18,uv.y)*step(uv.y,.86); }
    acc/=12.;
    if(uv.y>.915&&uv.y<.95) ring=1.;
    vec3 vio=vec3(.56,.24,1.0);
    lit=mix(lit,vio,max(acc,ring)); shd=mix(shd,vio*.62,max(acc,ring)); dep=mix(dep,vio*.35,max(acc,ring));
    if(max(acc,ring)>.5) emissive=false;
    float sheen = smoothstep(.0,.06,.06-abs(fract(dot(N,vec3(.6,.7,.2))*.0 + (vPos.x+vPos.y)*1.3)-.5));
    lit = mix(lit, vec3(.45,.40,.62), sheen*.5);
  } else if(pat==6){ // scarf gold bands
    if((uv.x>.815&&uv.x<.868)||(uv.x>.892&&uv.x<.906)){ lit=vec3(1.0,.76,.22); shd=vec3(.72,.44,.14); dep=vec3(.40,.20,.12); }
  } else if(pat==7){ if(fract(uv.x*34.+uv.y*.7)<.13){ lit*=.78; shd*=.78; } }
  else if(pat==8){ if(abs(uv.y)<.085 && uv.x<.78){ lit=mix(lit,shd,.75); shd=mix(shd,dep,.5);} }
  else if(pat==9){ float f=step(fract(uv.x),.52); float v=mix(mix(.62,1.15,f), .92, uChainBlur); if(uChainBlur>.5) v *= .85+.3*step(.6,h11(floor(uv.x*.5)+floor(uTime*12.)*31.)); lit*=v; shd*=v; }
  else if(pat==10){
    int who = vMat==26 ? 1 : 0;
    vec4 e = animeEye(uv, who, uMatLit[vMat].rgb, uMatShade[vMat].rgb, uMatDeep[vMat].rgb);
    if(e.a<.1) discard;
    eyeMat=true; lit=e.rgb; if(e.a<.75) emissive=true;
    shd=e.rgb*vec3(.80,.74,.86); dep=e.rgb*vec3(.62,.54,.72);
  } else if(pat==11){ // pelican body: warm chest patch + soft scallops
    float a=abs(uv.y);
    float chest = smoothstep(.70,.705,uv.x + .03*sin(a*30.))*step(.46,a);
    if(chest>.5){ lit=vec3(1.0,.91,.66); shd=vec3(.83,.67,.60); dep=vec3(.52,.38,.52); }
  } else if(pat==12){ float a=abs(uv.y);
    if(a<.36){ lit=vec3(.24,.42,.62); } else if(a>.66){ lit=vec3(.92,.96,.98);}
    if(fract(uv.x*11.+a*2.5)<.10 && a<.66 && uv.x>.28 && uv.x<.86) lit*=.82;
    if(uv.x<.25 && abs(uv.x-.21+.05*a*a)<.012) lit*=.55;
    shd=shadeOf(lit); dep=deepOf(lit);
  } else if(pat==13){ float c=mod(floor(uv.x*22.)+floor(uv.y*3.),2.); lit=mix(vec3(.96,.95,.92),vec3(.09,.07,.11),c); shd=lit*.68; dep=lit*.4; }
  else if(pat==14){ emissive=true; }
  else if(pat==15){ // falcon head: black hood and moustache stripe, cream throat
    float a=abs(uv.y);
    bool hood = a < .56 - .10*smoothstep(.55,.2,uv.x);
    bool mal = uv.x>.57 && uv.x<.76 && a>=.40 && a<.86 - (uv.x-.57)*.9;
    if(hood||mal){ lit=vec3(.17,.17,.27); shd=vec3(.10,.09,.17); dep=vec3(.05,.04,.10); }
    else if(uv.x<.34){ lit=vec3(.37,.43,.57); shd=vec3(.23,.26,.41); dep=vec3(.13,.13,.25); }
  }

  vec3 col;
  float sh = shadowAt(vPos + N*.008);
  float ndl = dot(N,uL) + vAO;
  float litF = smoothstep(uT1-.018,uT1+.018,ndl) * smoothstep(.35,.62,sh);
  float deepF = (1.-smoothstep(-.60,-.565,ndl))*(1.-litF);
  if(eyeMat){ litF = max(litF, .55); deepF=0.; }
  col = mix(shd*uShadeTint, lit*uLitTint, litF);
  col = mix(col, dep*uShadeTint, deepF);
  col *= 1.0 + .045*N.y;
  // hard anime specular
  if(spec>0.){ vec3 H=normalize(uL+Vv); float s=pow(max(dot(N,H),0.),70.); float band=smoothstep(.42,.5,s)*smoothstep(.4,.6,sh); col=mix(col, vec3(1.08,1.06,1.02)*max(uLitTint,vec3(.8)), band*spec);
    vec3 R=reflect(-Vv,N); float b2=smoothstep(.30,.33,R.y)*(1.-smoothstep(.42,.45,R.y)); col=mix(col, lit*1.35+.12, b2*spec*.55); }
  // hard-edged rim light
  float fr = 1.-clamp(dot(N,Vv),0.,1.);
  float rim = smoothstep(.56,.60,fr) * smoothstep(.02,.16,dot(N,uRimDir));
  if(eyeMat || vMat==54) rim=0.;
  col = mix(col, uRimCol, rim*uRimAmt);
  if(emissive) col = lit*(eyeMat?1.0:1.12);
  if(uSil>0.){ vec3 sc = uSilCol; sc = mix(sc, uRimCol, rim); if(eyeMat && emissive) sc=lit; col=mix(col, sc, uSil); }
  col *= uBright;
  if(uFog>0.){ float f = 1.-exp(-max(0.,vZ-6.)*uFog); col=mix(col,uFogCol,f); }
  oColor = vec4(col,1.);
  float lw = vLW * mD.a;
  float mask = vPart<99.5 ? 1.0 : (vPart<199.5 ? .5 : (vPart<299.5 ? .8 : (vPart<399.5 ? .4 : 0.)));
  oG = vec4(vPart, vZ, lw, mask);
}`;

// ---------- analytic spinning spoke wheel ----------
const VS_SPOKE = `#version 300 es
uniform mat4 uVP, uView; uniform vec3 uC, uEx, uEy; uniform float uR;
out vec2 vQ; out vec3 vW; out float vZ;
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2) - 1.; if(gl_VertexID==2) p=vec2(-1.,3.); if(gl_VertexID==1) p=vec2(3.,-1.); if(gl_VertexID==0) p=vec2(-1.,-1.);
  vQ = p*uR; vW = uC + uEx*vQ.x + uEy*vQ.y; vZ = -(uView*vec4(vW,1.)).z; gl_Position = uVP*vec4(vW,1.); }`;
const FS_SPOKE = GLSL_COMMON + `
in vec2 vQ; in vec3 vW; in float vZ;
uniform float uRot, uBlur, uR, uHub, uSeed; uniform int uK; uniform vec3 uCol, uHi;
layout(location=0) out vec4 o;
void main(){
  float r=length(vQ); if(r>uR||r<uHub) discard;
  float phi=atan(vQ.y,vQ.x);
  float px = max(fwidth(r), 1e-5);
  float hw = max(.00135, px*.55);
  float acc=0.; int K=uK;
  float acc2=0.;
  for(int fam=0; fam<2; fam++){
    float beta = fam==0 ? 0.92 : -0.92;
    vec2 H=vec2(uHub,0.), Qp=uR*vec2(cos(beta),sin(beta)), d=Qp-H;
    float a=dot(d,d), b=2.*dot(H,d), c=dot(H,H)-r*r;
    float s=(-b+sqrt(max(0.,b*b-4.*a*c)))/(2.*a);
    vec2 P=H+d*s; float ao=atan(P.y,P.x);
    float inc = abs(dot(normalize(d), P/max(r,1e-4)));
    float sp = 6.2831853/16.; float off = float(fam)*sp*.5;
    for(int k=0;k<K;k++){
      float rot = uRot + uBlur*(float(k)+.5)/float(K);
      float da = phi - rot - ao - off; da = mod(da+sp*.5, sp)-sp*.5;
      float dd = abs(da)*r*max(inc,.25);
      float hwE = max(hw, r*max(inc,.25)*abs(uBlur)/float(K)*.62);
      float cov = clamp((hwE-dd)/max(px,hwE-hw)+.5, 0., 1.);
      acc2 += cov*(hw/hwE);
    }
  }
  acc = min(1., acc2/float(K));
  float blurAmt = smoothstep(.08,.55,abs(uBlur));
  vec3 col = uCol; float al = acc*(1.0+blurAmt*.55);
  // spin haze and anime arc streaks
  if(blurAmt>0.){
    al = max(al, blurAmt*.13*smoothstep(uHub, uR*.4, r));
    for(int k=0;k<6;k++){
      float fk=float(k); float rr = uR*(.40+.1*fk+ .05*h11(fk*7.+uSeed));
      float a0 = h11(fk*13.+uSeed*3.)*6.2831853 - uRot*.35; float len = .7+1.5*h11(fk*5.+uSeed);
      float da = mod(phi-a0, 6.2831853);
      if(abs(r-rr)<.0028 && da<len){ float t=da/len; al = max(al, blurAmt*.75*sin(t*PI)); col = mix(col,uHi,.7); }
    }
  }
  // one reflector so slow rotation reads
  float da = mod(phi-uRot+PI, 6.2831853)-PI;
  if(r>uR*.86 && r<uR*.93){ float cover=0.; for(int k=0;k<24;k++){ float rot=uRot+uBlur*float(k)/24.; float q=mod(phi-rot+PI,6.2831853)-PI; cover+=step(abs(q),.055);} cover/=24.; if(cover>0.){ col=mix(col,vec3(1.,.55,.15),clamp(cover*3.,0.,1.)); al=max(al,min(1.,cover*2.2)); } }
  if(al<.01) discard;
  o=vec4(col*al, al);
}`;

// ---------- ink lines from id/depth, resolved from 2x to 1x ----------
const FS_INK = GLSL_COMMON + `
uniform sampler2D uColor, uG; uniform float uLine, uSeed, uLineOn; uniform vec3 uInk;
layout(location=0) out vec4 o;
#define NS 76
uniform vec3 uOff[NS]; uniform int uNS, uSub;
void main(){
  ivec2 base = ivec2(gl_FragCoord.xy)*2;
  ivec2 lim = textureSize(uColor,0)-1;
  vec4 acc=vec4(0.);
  for(int sb=0; sb<uSub; sb++){
    ivec2 ip = base+ivec2(sb&1,sb>>1);
    vec3 c = texelFetch(uColor, ip, 0).rgb;
    vec4 g = texelFetch(uG, ip, 0);
    float ink=0.;
    if(uLineOn>.5){
      float boil = .86+.28*vnoise(vec2(ip)*.018+uSeed*7.31);
      for(int k=0;k<uNS;k++){
        vec3 of=uOff[k]; float r=of.z;
        if(r > uLine*2.1) break;
        ivec2 q=clamp(ip+ivec2(of.xy), ivec2(0), lim);
        vec4 n = texelFetch(uG,q,0);
        if(n.z<=0.001) continue;
        float w=0.;
        if(abs(n.x-g.x)>.5){
          float eps = .0016*n.y;
          if(n.y < g.y-eps || (n.y < g.y+eps && n.x>g.x)) w=1.;
        } else {
          if(g.y - n.y > .022 + .004*n.y) w=.72;
        }
        if(w>0.){
          float down = of.y/max(r,.5);
          float width = uLine*n.z*w*boil*(1.0+.34*down)*clamp(3.2/(n.y+.6),.72,1.5);
          ink = max(ink, clamp(width - r + .6, 0., 1.));
          if(ink>.99) break;
        }
      }
    }
    vec3 outc = mix(c, uInk, ink);
    float mask = max(g.w, ink>.5 ? 0. : 0.);
    acc += vec4(outc, mask);
  }
  o = acc*.25;
}`;

const FS_PANEL = `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform vec2 uOffset; uniform float uZoom; out vec4 o;
void main(){ o = texture(uTex, (vUv-.5)/uZoom+.5 - uOffset); }`;
const VS_POLY = `#version 300 es
layout(location=0) in vec2 aP; out vec2 vUv; void main(){ vUv=aP; gl_Position=vec4(aP*2.-1.,0.,1.); }`;

// scene + aura + effects layer + camera shake
const FS_COMPOSE = GLSL_COMMON + `
in vec2 vUv; uniform sampler2D uScene, uFx; uniform vec4 uShake; uniform float uFxOn, uTime, uDraw;
uniform vec4 uAura; uniform vec3 uAuraC0, uAuraC1, uAuraC2; uniform float uAuraMin, uAuraMax;
uniform float uSmear; uniform vec2 uSmearDir;
out vec4 o;
float maskAt(vec2 u){ float m = texture(uScene,u).a; return smoothstep(uAuraMin-.06,uAuraMin+.03,m)*(1.-smoothstep(uAuraMax-.01,uAuraMax+.04,m)); }
void main(){
  vec2 asp=vec2(16./9.,1.);
  vec2 u = (vUv-.5)*asp; float cs=cos(uShake.w), sn=sin(uShake.w); u = mat2(cs,-sn,sn,cs)*u/uShake.z; u = u/asp+.5 + uShake.xy;
  vec4 s = texture(uScene,u);
  vec3 col = s.rgb;
  if(uSmear>0.){ vec3 acc=col; float n=h21(vec2(floor(gl_FragCoord.y/5.), uDraw)); for(int i=1;i<10;i++){ float k=float(i)/9.; acc+=texture(uScene,u+uSmearDir*uSmear*k*(.4+.9*n)).rgb; } col=acc/10.; }
  if(uAura.x>0.){
    float m = maskAt(u);
    float len = uAura.y; float best=0.; float halo=0.;
    float t = uDraw*.31;
    for(int i=1;i<=30;i++){
      float k=float(i)/30.;
      vec2 wob = vec2((vnoise(vec2(u.x*24., u.y*13. - t*7.))-.5)*.048 + (vnoise(vec2(u.x*40., u.y*19.-t*11.))-.5)*.012, 0.)*k;
      vec2 q = u + wob - vec2(uAura.z*k*len, len*k);
      float lick = .55+.9*vnoise(vec2(u.x*26.+k*.8, u.y*8.-t*9.));
      best = max(best, maskAt(q)*(1.-k/max(lick,.2)));
    }
    for(int i=0;i<20;i++){ float a=float(i)/20.*6.2831853; float rr = uAura.w*(.75+.5*vnoise(vec2(a*5., t*6.))); halo = max(halo, maskAt(u+vec2(cos(a)/1.7778,sin(a))*rr)); halo=max(halo, maskAt(u+vec2(cos(a)/1.7778,sin(a))*rr*.45)*1.2); }
    float f = max(best, halo*.62);
    if(m<.5){
      float bg = 1.-smoothstep(.08,.30,s.a);
      vec3 ac = vec3(0.);
      float al=0.;
      if(f>.62){ ac=uAuraC0; al=1.; } else if(f>.34){ ac=uAuraC1; al=.93; } else if(f>.07){ ac=uAuraC2; al=.78; }
      col = mix(col, ac, al*uAura.x*bg);
    } else {
      float inner=0.; for(int i=0;i<8;i++){ float a=float(i)/8.*6.2831853; vec2 q=u+vec2(cos(a)/1.7778,sin(a))*.0034; inner += 1.-step(.10,texture(uScene,q).a); }
      col = mix(col, uAuraC1*1.08, clamp(inner/2.6,0.,1.)*uAura.x*.80);
    }
  }
  if(uFxOn>.5){ vec4 f = texture(uFx, u); col = col*(1.-f.a) + f.rgb; }
  o = vec4(col,1.);
}`;
const FS_BRIGHT = `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform vec2 uTx; uniform float uThr; out vec4 o;
void main(){ vec3 a=vec3(0.); for(int i=0;i<2;i++) for(int j=0;j<2;j++){ vec3 c=texture(uTex,vUv+(vec2(i,j)-.5)*uTx*2.).rgb; float l=max(c.r,max(c.g,c.b)); a+=c*smoothstep(uThr,uThr+.14,l);} o=vec4(a*.25,1.); }`;
const FS_BLUR = `#version 300 es
precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform vec2 uDir; out vec4 o;
void main(){ vec3 c=texture(uTex,vUv).rgb*.227027; float off[2]=float[](1.3846153846,3.2307692308), w[2]=float[](.3162162162,.0702702703);
 for(int i=0;i<2;i++){ c+=texture(uTex,vUv+uDir*off[i]).rgb*w[i]; c+=texture(uTex,vUv-uDir*off[i]).rgb*w[i]; } o=vec4(c,1.); }`;

const FS_POST = GLSL_COMMON + `
in vec2 vUv; uniform sampler2D uTex, uBloom, uType;
uniform float uBloomAmt, uVig, uChroma, uSat, uCon, uImpact, uFade, uGrain, uDraw, uTypeOn, uSepia, uFrame, uLetter;
uniform vec3 uGain, uLift; uniform vec4 uFlash; uniform vec2 uImpC;
out vec4 o;
void main(){
  vec2 u=vUv; vec2 d=u-.5;
  vec3 col;
  if(uChroma>0.){ float k=uChroma*dot(d,d)*4.; col = vec3(texture(uTex,u-d*k*.012).r, texture(uTex,u).g, texture(uTex,u+d*k*.012).b); }
  else col = texture(uTex,u).rgb;
  col += texture(uBloom,u).rgb*uBloomAmt;
  col = col*uGain + uLift*(1.-col);
  float lum = dot(col,vec3(.299,.587,.114));
  col = mix(vec3(lum), col, uSat);
  col = (col-.5)*uCon+.5;
  if(uSepia>0.){ vec3 sp = mix(vec3(.07,.05,.12), vec3(.95,.86,.72), smoothstep(.05,.95,lum)); col = mix(col, sp, uSepia); }
  col *= 1. - uVig*smoothstep(.28,.86,length(d*vec2(1.12,1.)));
  if(uImpact>.5){
    vec2 px=1./vec2(1920.,1080.);
    float l0 = dot(texture(uTex,u).rgb,vec3(.299,.587,.114));
    vec2 q=(u-uImpC)*vec2(1.7778,1.); float ang=atan(q.y,q.x), rr=length(q);
    float ray = step(.80, h11(floor(ang*90.)+floor(uDraw)*13.)) * step(.20+.35*h11(floor(ang*90.)+7.), rr);
    float gx = dot(texture(uTex,u+vec2(px.x*2.,0.)).rgb - texture(uTex,u-vec2(px.x*2.,0.)).rgb, vec3(.333));
    float gy = dot(texture(uTex,u+vec2(0.,px.y*2.)).rgb - texture(uTex,u-vec2(0.,px.y*2.)).rgb, vec3(.333));
    float edge = step(.16, length(vec2(gx,gy)));
    float v = step(.50, l0);
    if(uImpact>1.5) v = 1.-v;
    v = mix(v, 1.-v, edge);
    v = mix(v, uImpact>1.5?0.:1., ray);
    col = mix(vec3(.05,.02,.08), vec3(.96,.94,.90), v);
  }
  if(uTypeOn>.5){ vec4 t=texture(uType,u); col = col*(1.-t.a)+t.rgb; }
  col = mix(col, uFlash.rgb, uFlash.a);
  col *= 1.-uFade;
  float g = h21(gl_FragCoord.xy + vec2(uDraw*173., uDraw*291.)) - .5;
  col += g*uGrain;
  if(uLetter>0.){ float bar = step(abs(vUv.y-.5), .5-uLetter); col*=bar; }
  o = vec4(clamp(col,0.,1.),1.);
}`;
