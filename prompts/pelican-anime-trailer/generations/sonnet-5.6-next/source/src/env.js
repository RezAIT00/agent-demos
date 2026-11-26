// ---------- painted environments (sky, mountains, ground) ----------
const GLSL_TEXNOISE = `
uniform sampler2D uRand, uCloudTex; uniform int uZ;
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return textureLod(uRand,(i+f+.5)/256.,0.).r; }
float fbm(vec2 p){ return textureLod(uCloudTex,p/16.,0.).r; }
float worley(vec2 p){ return textureLod(uCloudTex,p/16.,0.).g; }
`;
const GLSL_HASHONLY = GLSL_COMMON.slice(0, GLSL_COMMON.indexOf('float vnoise'));
const FS_ENV = GLSL_HASHONLY + GLSL_TEXNOISE + GLSL_SHADOWFN + `
uniform int uMode; uniform mat4 uIVP, uVP; uniform vec3 uCam, uSunDir; uniform float uTime, uScroll, uSpeed, uFlashL, uGround, uDrawN, uDim;
uniform vec4 uP; uniform vec2 uRes, uVanish; uniform float uSlope;
layout(location=0) out vec4 oColor; layout(location=1) out vec4 oG;

float cShape(vec2 q, float seed){ vec2 w=q+vec2(seed*7.3,seed*3.1); w+=.22*vec2(vnoise(w*2.1),vnoise(w*2.1+19.)); return fbm(w*1.15)*.80 + (1.-worley(w*3.6))*.27 + (1.-worley(w*9.5))*.085; }
void clouds(inout vec3 col, float az, float el, float base, float top, float cover, vec3 lit, vec3 mid, vec3 shd, float drift, float seed){
  if(el<base-.01||el>top+.1) return;
  vec2 q=vec2(az*1.9+drift, el*4.2);
  float prof=smoothstep(top,base,el);
  float thr=1.22-cover*.34;
  float d=cShape(q,seed)+prof*.50;
  if(d>thr){
    float da=cShape(q+vec2(.05,.20),seed)+smoothstep(top,base,el+.045)*.50;
    vec3 c=lit; if(da>thr+.035) c=mid; if(da>thr+.19) c=shd;
    float brush = vnoise(vec2(az*55.+vnoise(vec2(az*9.,el*30.))*4., el*210.));
    c *= .975+.05*brush;
    float soft = smoothstep(thr, thr+.012, d);
    col=mix(col,c, soft*smoothstep(base,base+.02+.015*vnoise(vec2(az*11.,3.)),el));
  }
}
float ridgeH(vec2 k){ float s=0.,a=.55; for(int i=0;i<4+uZ;i++){ float n=1.-abs(vnoise(k)*2.-1.); s+=a*n*n; k=k*2.07+vec2(7.7,3.1); a*=.5; } return s; }
void mountain(inout vec3 col, vec3 rd, float D, float baseH, float amp, float freq, float par, vec3 litC, vec3 shdC, vec3 snowC, float snowLine, float haze, vec3 hazeC, float trees){
  float hd=length(rd.xz); if(hd<1e-4) return; float slope=rd.y/hd;
  if(slope > (baseH+amp*1.2+trees*1.4-uCam.y)/D) return;
  float az=atan(rd.x,-rd.z);
  vec2 k=vec2(sin(az),-cos(az))*D*freq + vec2(uScroll*par*freq,0.);
  float H=baseH+amp*ridgeH(k);
  if(trees>0.){ float x=az*D*1.15 + uScroll*par; float c=floor(x); float f=fract(x); float th=(.45+h11(c)*.75)*trees; float tooth=1.-abs(f*2.-1.); H += th*pow(tooth,1.35)*(.86+.14*step(.5,fract(tooth*3.2))); }
  float elt=(H-uCam.y)/D;
  if(slope<elt){
    vec2 k2=vec2(sin(az+.010),-cos(az+.010))*D*freq + vec2(uScroll*par*freq,0.);
    float H2=baseH+amp*ridgeH(k2);
    float wy = uCam.y+slope*D;
    float gully=vnoise(vec2(az*D*freq*7.+wy*freq*3., wy*freq*5.));
    float side=(H2-H) + (gully-.5)*amp*.075;
    float lf = step(0., side*(uSunDir.x>0.?-1.:1.));
    vec3 c=mix(shdC,litC,lf);
    if(snowLine<500. && wy>snowLine - amp*.30*gully - amp*.12*vnoise(vec2(az*D*freq*19.,0.))) c = mix(snowC*vec3(.70,.76,.94), snowC, lf);
    c*= .97+.06*vnoise(vec2(az*260., slope*90.));
    float hz = haze*(1.-.65*smoothstep(-.02,max(elt,.001),slope));
    col=mix(c,hazeC,clamp(hz,0.,1.));
  }
}
vec3 grad3(float el, vec3 hor, vec3 midc, vec3 zen){ return el<.16 ? mix(hor,midc,smoothstep(-.02,.16,el)) : mix(midc,zen,smoothstep(.16,.62,el)); }
void sunDisc(inout vec3 col, vec3 rd, float rad, vec3 core, vec3 glow, float glowAmt){
  vec3 s=normalize(uSunDir); float a=acos(clamp(dot(rd,s),-1.,1.));
  col += glow*glowAmt*(exp(-a*5.5)*.55 + exp(-a*19.)*.6);
  float disc = 1.-smoothstep(rad-.0016,rad+.0016,a);
  col = mix(col, core, disc);
}
float rays(vec3 rd){ vec3 s=normalize(uSunDir); vec3 r=normalize(cross(s,vec3(0,1,0))); vec3 u=cross(r,s); float a=atan(dot(rd,u),dot(rd,r)); float n=vnoise(vec2(a*9.+uTime*.12,1.7))*.6+vnoise(vec2(a*23.-uTime*.09,8.3))*.4; return smoothstep(.55,.82,n)*exp(-acos(clamp(dot(rd,s),-1.,1.))*2.6); }
float stars(float az, float el){ vec2 q=vec2(az,el)*130.; vec2 c=floor(q); float h=h21(c); if(h<.965) return 0.; vec2 o=h22(c+9.)*.6+.2; float d=length(fract(q)-o); float tw=.6+.4*sin(uTime*5.+h*90.); return smoothstep(.16,.02,d)*tw*(h-.965)/.035; }

vec3 skyColor(vec3 rd){
  float az=atan(rd.x,-rd.z), el=rd.y;
  vec3 col=vec3(0);
  if(uMode==0) return mix(vec3(.80,.79,.88), vec3(.93,.92,.97), smoothstep(0.,.35,el));
  if(uMode==1){
    col=grad3(el, vec3(1.0,.90,.72), vec3(.42,.74,.97), vec3(.10,.36,.80));
    sunDisc(col,rd,.045,vec3(1.1,1.06,.88),vec3(1.0,.85,.55),.55);
    clouds(col,az,el,.045,.30,.62, vec3(1.0,.98,.93), vec3(.86,.84,.95), vec3(.60,.64,.88), uTime*.004, 1.3);
    clouds(col,az,el,.020,.11,.55, vec3(1.0,.93,.82), vec3(.88,.80,.88), vec3(.70,.68,.86), uTime*.008, 4.1);
    mountain(col,rd,140.,.5,9.,.030,.25, vec3(.38,.58,.70), vec3(.30,.45,.66), vec3(1), 999., .55, vec3(.86,.86,.88), 0.);
  } else if(uMode==2){
    col=grad3(el, vec3(.16,.24,.38), vec3(.07,.10,.21), vec3(.02,.03,.09));
    clouds(col,az,el,.03,.75,.95, vec3(.22,.28,.44), vec3(.13,.17,.31), vec3(.07,.09,.20), uTime*.016, 7.7);
    clouds(col,az,el,.10,.42,.70, vec3(.30,.37,.55), vec3(.18,.22,.38), vec3(.09,.12,.24), uTime*.03, 2.2);
    col += uFlashL*vec3(.55,.62,.85)*(.35+.65*vnoise(vec2(az*3.,el*7.)));
    mountain(col,rd,60.,.2,6.,.055,.35, vec3(.075,.11,.20), vec3(.055,.08,.16), vec3(1), 999., .15, vec3(.14,.20,.34), 1.1);
    mountain(col,rd,26.,-.4,2.4,.12,.7, vec3(.035,.055,.11), vec3(.025,.04,.09), vec3(1), 999., .05, vec3(.1,.15,.26), 1.0);
  } else if(uMode==3){
    col=grad3(el, vec3(.30,.22,.50), vec3(.09,.09,.30), vec3(.02,.02,.12));
    col += stars(az,el)*vec3(.9,.95,1.)*smoothstep(.02,.15,el);
    sunDisc(col,rd,.050,vec3(.97,.97,.90),vec3(.55,.62,1.0),.42);
    clouds(col,az,el,.06,.22,.46, vec3(.36,.34,.64), vec3(.22,.21,.48), vec3(.13,.12,.34), uTime*.006, 9.9);
    // far city
    float hd=length(rd.xz), slope=rd.y/max(hd,1e-4);
    for(int L=0;L<2+uZ;L++){
      float D= L==0?90.:55.; float x=az*D*(L==0?.55:.42)+uScroll*(L==0?.10:.22)+float(L)*31.; float c=floor(x);
      float bh=(L==0?2.0:1.0)+ (L==0?7.:5.)*pow(h11(c+float(L)*77.),2.0);
      float elt=(bh-uCam.y)/D;
      if(slope<elt && fract(x)<.9){
        col = L==0? vec3(.10,.09,.27) : vec3(.05,.045,.17);
        vec2 w=vec2(fract(x)*7., (uCam.y+slope*D)*3.2);
        float on=step(.74,h21(floor(w)+vec2(c*13.,float(L)*5.)));
        float win = step(.28,fract(w.x))*step(fract(w.x),.78)*step(.3,fract(w.y))*step(fract(w.y),.72);
        col=mix(col, h21(floor(w)+3.)>.3? vec3(1.0,.80,.42):vec3(.55,.85,1.0), on*win*(L==0?.6:.9));
      }
    }
  } else if(uMode==4){
    col=grad3(el, vec3(1.0,.72,.46), vec3(.93,.48,.60), vec3(.22,.20,.52));
    col += rays(rd)*vec3(1.0,.72,.42)*.42;
    sunDisc(col,rd,.095,vec3(1.12,.98,.72),vec3(1.0,.62,.30),.85);
    clouds(col,az,el,.07,.34,.52, vec3(1.0,.78,.64), vec3(.86,.48,.62), vec3(.47,.29,.58), uTime*.004, 3.3);
    clouds(col,az,el,.025,.10,.56, vec3(1.0,.85,.55), vec3(.95,.55,.50), vec3(.66,.34,.55), uTime*.007, 6.1);
    mountain(col,rd,150.,-.2,7.5,.026,.2, vec3(.62,.34,.55), vec3(.45,.24,.50), vec3(1), 999., .42, vec3(1.0,.66,.50), 0.);
  } else if(uMode==5){
    col=grad3(el, vec3(.58,.22,.50), vec3(.22,.08,.30), vec3(.05,.02,.11));
    clouds(col,az,el,.02,.80,.98, vec3(.46,.20,.52), vec3(.25,.10,.35), vec3(.13,.05,.22), uTime*.03, 5.5);
    clouds(col,az,el,.14,.55,.66, vec3(.70,.33,.66), vec3(.37,.15,.46), vec3(.17,.07,.28), uTime*.055, 8.8);
    if(uP.w>.5){ vec3 s=normalize(uSunDir); float a=acos(clamp(dot(rd,s),-1.,1.)); col+=vec3(.55,.30,.88)*(exp(-a*7.)*.50+exp(-a*2.6)*.16);
      float disc=1.-smoothstep(.1235,.1265,a); vec3 mc=vec3(.90,.76,1.0); float cr=vnoise(vec2(az*42.,el*42.))*.6+vnoise(vec2(az*97.,el*97.))*.4; mc*=1.-.16*step(.60,cr);
      float band=vnoise(vec2(az*6.+uTime*.12, el*34.)); mc=mix(mc,vec3(.36,.16,.52),step(.66,band)*step(el,s.y-.015)); col=mix(col,mc,disc); }
    // lightning bolt
    if(uFlashL>0.){ for(int b=0;b<2;b++){ float x0= b==0? -.50 : .62; float x = az - x0 - (vnoise(vec2(el*34.,float(b)*9.))-.5)*.10 - (vnoise(vec2(el*110.,4.))-.5)*.03; float w=.0022+.004*smoothstep(.1,.6,el);
        if(el>.04 && el<.75){ col += uFlashL*vec3(.95,.82,1.)*(1.-smoothstep(w*.5,w,abs(x))); col += uFlashL*vec3(.55,.30,.85)*exp(-abs(x)*45.)*.4; } }
      col += uFlashL*vec3(.30,.18,.45)*.55; }
    mountain(col,rd,70.,-1.,11.,.052,.15, vec3(.20,.08,.29), vec3(.13,.05,.21), vec3(1), 999., .30, vec3(.46,.18,.45), 0.);
    mountain(col,rd,30.,-1.8,5.2,.11,.3, vec3(.10,.035,.17), vec3(.065,.022,.12), vec3(1), 999., .06, vec3(.3,.12,.34), 0.);
  } else if(uMode==6){
    col=grad3(el, vec3(.80,.92,1.0), vec3(.34,.66,.97), vec3(.07,.27,.74));
    sunDisc(col,rd,.035,vec3(1.15,1.12,.98),vec3(1.0,.92,.70),.45);
    clouds(col,az,el,.10,.52,.60, vec3(1.0,.99,.96), vec3(.80,.84,.97), vec3(.53,.62,.90), uTime*.004, 2.6);
    mountain(col,rd,120.,2.,24.,.026,.20, vec3(.50,.62,.84), vec3(.30,.42,.72), vec3(.98,.99,1.02), 14.5, .38, vec3(.74,.85,.98), 0.);
    mountain(col,rd,62.,-2.,13.,.047,.42, vec3(.30,.48,.58), vec3(.18,.31,.50), vec3(.95,.97,1.0), 8.8, .24, vec3(.66,.80,.94), 0.);
    mountain(col,rd,30.,-4.2,5.2,.085,.75, vec3(.14,.38,.34), vec3(.08,.24,.30), vec3(1), 999., .17, vec3(.56,.74,.86), 1.5);
    mountain(col,rd,13.,-4.6,2.4,.16,1.0, vec3(.085,.29,.23), vec3(.045,.17,.21), vec3(1), 999., .04, vec3(.4,.6,.7), 1.25);
  } else if(uMode==7 || uMode==9){
    bool calm = uMode==9;
    col=grad3(el, calm?vec3(1.0,.70,.42):vec3(1.0,.62,.22), calm?vec3(.80,.40,.54):vec3(.92,.27,.34), calm?vec3(.18,.17,.45):vec3(.20,.07,.35));
    col += rays(rd)*vec3(1.0,.62,.25)*(calm?.2:.45);
    sunDisc(col,rd,calm?.085:.205, vec3(1.10,.93,.60), vec3(1.0,.55,.18), calm?.6:.75);
    // sun stripes
    vec3 s=normalize(uSunDir); if(!calm && acos(clamp(dot(rd,s),-1.,1.))<.206){ float dy=(rd.y-s.y)/.205; if(dy<0. && fract(dy*7.)<.18*(-dy)+.02) col=mix(col, vec3(1.0,.50,.22), .85); }
    clouds(col,az,el,.12,.40,.44, vec3(1.0,.66,.40), vec3(.78,.28,.40), vec3(.38,.11,.37), uTime*.004, 11.2);
    mountain(col,rd,110.,-2.,9.,.030,.20, vec3(.66,.24,.35), vec3(.47,.15,.34), vec3(1), 999., .35, vec3(1.0,.52,.30), 0.);
    mountain(col,rd,55.,-4.,7.5,.060,.40, vec3(.40,.11,.29), vec3(.27,.07,.26), vec3(1), 999., .16, vec3(.90,.38,.28), 0.);
    if(uGround<.5) { mountain(col,rd,24.,-9.5,5.5,.12,.7, vec3(.22,.05,.20), vec3(.14,.03,.17), vec3(1), 999., .05, vec3(.7,.25,.28), 0.);
      if(el<-.12) col=mix(col, vec3(.12,.03,.15), smoothstep(-.12,-.30,el)*.9); }
  }
  return col;
}

vec3 horizonColor(vec3 rd){
  vec3 s=normalize(uSunDir); float a=acos(clamp(dot(normalize(vec3(rd.x,.02,rd.z)),s),-1.,1.)); float gl=exp(-a*3.2);
  if(uMode==0) return vec3(.80,.79,.88);
  if(uMode==1) return vec3(.88,.86,.78)+vec3(.14,.10,.02)*gl;
  if(uMode==2) return vec3(.14,.20,.33);
  if(uMode==3) return vec3(.24,.18,.43);
  if(uMode==4) return vec3(.96,.64,.50)+vec3(.20,.16,.04)*gl;
  if(uMode==5) return vec3(.46,.18,.43);
  if(uMode==6) return vec3(.70,.83,.96);
  if(uMode==7) return vec3(.86,.36,.28)+vec3(.30,.28,.04)*gl;
  if(uMode==9) return vec3(.90,.55,.42)+vec3(.20,.18,.06)*gl;
  return vec3(.12,.07,.17);
}
vec3 groundAlbedo(float along, float lat, float aa, out float wet){
  wet=0.;
  float n=vnoise(vec2(along*3.1,lat*9.))*.6+vnoise(vec2(along*11.,lat*31.))*.4;
  float blurK = clamp(aa*2.,0.,1.);
  n = mix(n, .5, blurK*.7);
  float streak = vnoise(vec2(along*.35, lat*14.));
  vec3 asphalt=vec3(.33,.33,.40), shoulder=vec3(.55,.47,.40), lineC=vec3(.96,.93,.82), outer=vec3(.30,.50,.30);
  bool lines=true;
  if(uMode==1){ asphalt=vec3(.80,.62,.43); shoulder=vec3(.72,.55,.38); outer=vec3(.46,.66,.28); lines=false; }
  if(uMode==2){ asphalt=vec3(.070,.095,.16); shoulder=vec3(.055,.075,.12); lineC=vec3(.42,.50,.62); outer=vec3(.035,.07,.085); wet=1.; }
  if(uMode==3){ asphalt=vec3(.095,.090,.20); shoulder=vec3(.12,.10,.20); lineC=vec3(.62,.58,.60); outer=vec3(.045,.060,.13); }
  if(uMode==4){ asphalt=vec3(.40,.28,.42); shoulder=vec3(.60,.38,.40); lineC=vec3(1.0,.84,.66); outer=vec3(.34,.30,.30); }
  if(uMode==5){ asphalt=vec3(.13,.07,.19); shoulder=vec3(.16,.08,.21); outer=vec3(.09,.04,.14); lines=false; }
  if(uMode==6){ asphalt=vec3(.35,.37,.45); shoulder=vec3(.60,.54,.48); outer=vec3(.22,.44,.28); }
  if(uMode==7){ asphalt=vec3(.40,.18,.28); shoulder=vec3(.66,.28,.22); lineC=vec3(1.0,.74,.42); outer=vec3(.55,.20,.20); }
  if(uMode==9){ asphalt=vec3(.37,.24,.38); shoulder=vec3(.62,.34,.34); lineC=vec3(1.0,.84,.64); outer=vec3(.46,.24,.28); }
  if(uMode==11){ asphalt=vec3(.16,.13,.22); shoulder=asphalt; outer=asphalt; lines=false; }
  if(uMode==0){ vec2 g=abs(fract(vec2(along,lat)*2.+.5)-.5); float l=1.-smoothstep(.004,.012,min(g.x,g.y)); return mix(vec3(.80,.78,.84), vec3(.60,.58,.68), l); }
  vec3 c;
  if(lat>-3.35 && lat<1.45){
    c=asphalt*(.92+.16*n)*(.95+.10*streak);
    if(uMode==1){ if(abs(lat+.05)<.22||abs(lat+1.55)<.22) c*=.90; float pb=step(.86,vnoise(vec2(along*9.,lat*13.))); c=mix(c,c*.72,pb*(1.-blurK)); }
    if(lines){
      float dash = step(fract(along/5.),.5);
      float d1=abs(lat+1.05); if(d1<.065) c=mix(c,lineC,dash*(1.-smoothstep(.055,.065,d1)));
      if(abs(lat-1.18)<.055 || abs(lat+3.08)<.055) c=lineC;
    }
  } else if(lat>-4.0 && lat<2.1){ c=shoulder*(.88+.24*n); if(vnoise(vec2(along*14.,lat*16.))>.70) c*=mix(.76,1.,blurK); }
  else { float g=vnoise(vec2(along*1.1,lat*1.3))*.65+vnoise(vec2(along*5.,lat*5.))*.35; g=mix(g,.5,blurK); c=outer*(.80+.4*step(.5,g)+.1*n); }
  if((uMode==1||uMode==4) && lat<-6.2){ // sea
    float band=vnoise(vec2(along*.22+uTime*.25, lat*1.7));
    c = uMode==1? mix(vec3(.10,.46,.68), vec3(.24,.66,.80), step(.55,band)) : mix(vec3(.42,.26,.52), vec3(.80,.44,.52), step(.55,band));
    float glit=step(.80,vnoise(vec2(along*1.6+uTime*1.3, lat*6.)))*step(.6,vnoise(vec2(along*.4,lat*.8-uTime*.5)));
    c=mix(c, uMode==1?vec3(.95,.99,1.0):vec3(1.0,.88,.62), glit);
    if(lat>-6.75) c = mix(vec3(.97,.97,.95), c, smoothstep(-6.2,-6.75,lat)+ .3*sin(along*3.+uTime*2.));
  }
  if(uMode==9 && uP.w>0.){ float a=along-uP.w; if(a>0.&&a<1.1&&lat>-3.1&&lat<1.2){ float ck=mod(floor(a/.275)+floor(lat/.275),2.); c=mix(vec3(.93,.90,.84),vec3(.10,.06,.14),ck); } }
  return c;
}

void main(){
  vec2 ndc = gl_FragCoord.xy/uRes*2.-1.;
  vec4 pa = uIVP*vec4(ndc,-1.,1.), pb=uIVP*vec4(ndc,1.,1.);
  vec3 rd = normalize(pb.xyz/pb.w - pa.xyz/pa.w);
  vec2 sc = gl_FragCoord.xy/uRes;
  gl_FragDepth = .99999999;
  oG = vec4(0.,1000.,0.,0.);
  vec3 col;
  if(uMode==8){ // speed tunnel
    vec2 q=(sc-uVanish)*vec2(1.7778,1.); float r=length(q), a=atan(q.y,q.x);
    col=mix(vec3(.30,.07,.30), vec3(.035,.01,.10), smoothstep(.05,1.0,r));
    for(int L=0;L<3+uZ;L++){
      float N = 70.+float(L)*55.; float x=(a/6.2831853+.5)*N; float c=floor(x); float h=h11(c+float(L)*131.);
      float ph=fract(log(r+.04)*(.75+.2*h) - uTime*(1.4+1.8*h) + h*9.);
      float wid = (.10+.34*h11(c*3.+float(L)))*smoothstep(0.,.55,ph)*(1.-smoothstep(.75,1.,ph));
      if(h>.42 && abs(fract(x)-.5)<wid && r>.07+.13*h11(c+5.)){
        vec3 sc2 = h>.86? vec3(1.0,.97,.84) : h>.66? vec3(1.0,.70,.20) : vec3(.90,.18,.30);
        col=mix(col,sc2,.92-float(L)*.14);
      }
    }
    col += vec3(1.0,.80,.45)*exp(-r*5.2)*.95;
    oColor=vec4(col*uDim,1.); return;
  }
  if(uMode==10){ // title burst
    vec2 q=(sc-uVanish)*vec2(1.7778,1.); float r=length(q), a=atan(q.y,q.x);
    col=mix(vec3(.17,.08,.28), vec3(.015,.008,.05), smoothstep(.02,.95,r));
    float k=a*26./6.2831853+uTime*.22; float ray=step(.5,fract(k))*(.55+.45*h11(floor(k)));
    col=mix(col, vec3(.55,.20,.30), ray*.34*smoothstep(.06,.5,r));
    float k2=a*58./6.2831853-uTime*.35; col=mix(col, vec3(1.0,.66,.20), step(.78,fract(k2))*.22*smoothstep(.12,.7,r)*step(.45,h11(floor(k2))));
    col += vec3(1.0,.62,.22)*exp(-r*3.4)*.55;
    vec2 hp=gl_FragCoord.xy/(uRes.y/108.); hp=mat2(.707,-.707,.707,.707)*hp; float dotr=length(fract(hp)-.5); col*=1.-.28*smoothstep(.46,.36,dotr)*smoothstep(.35,1.0,r)*.0-.0; col=mix(col,vec3(.62,.24,.34), step(dotr, .38*smoothstep(.42,1.05,r))*.35);
    col *= .96+.08*vnoise(q*vec2(3.,90.));
    oColor=vec4(col*uDim,1.); return;
  }
  if(uMode==12){ // rival void
    col=mix(vec3(.075,.025,.13), vec3(.006,.003,.014), smoothstep(0.,.5,abs(rd.y)));
    if(rd.y<0.){ float s=-uCam.y/rd.y; vec3 p=uCam+rd*s; float g=exp(-dot(p.xz-vec2(0.,0.),p.xz)*.35); col=vec3(.012,.006,.025)+vec3(.20,.07,.36)*g;
      float li=1.-smoothstep(.006,.018,abs(fract((p.x+uScroll)*.8)-.5)); col+=vec3(.20,.09,.38)*li*exp(-length(p.xz)*.4);
      col*=mix(.35,1.,shadowAt(p+vec3(0,.003,0)));
      vec4 cl=uVP*vec4(p,1.); gl_FragDepth=clamp(cl.z/cl.w*.5+.5,0.,.9999999); oG.y=s; }
    oColor=vec4(col*uDim,1.); return;
  }
  if(uMode==11){ // macro backdrop with bokeh
    col=mix(vec3(.17,.09,.20), vec3(.035,.025,.09), smoothstep(-.05,.35,rd.y));
    float az=atan(rd.x,-rd.z);
    for(int k=0;k<2;k++){ vec2 q=vec2(az, rd.y)*(k==0?14.:23.)+vec2(uScroll*.1,float(k)*7.); vec2 c=floor(q); vec2 o=h22(c)*.6+.2; float d=length(fract(q)-o); float h=h21(c+21.); if(h>.62){ float rr=.14+.22*h11(c.x*7.+c.y); vec3 bc= h>.86? vec3(1.0,.62,.24): h>.74? vec3(.40,.75,1.0):vec3(.85,.30,.52); col+=bc*(1.-smoothstep(rr-.04,rr,d))*.20*smoothstep(-.1,.1,rd.y+.03); } }
  } else col = skyColor(rd);

  float gden = rd.y + uSlope*rd.x;
  if(gden<-.0005 && uGround>.5){
    float s=-(uCam.y+uSlope*uCam.x)/gden; vec3 p=uCam+rd*s;
    if(s>0. && s<300.){
      float along=p.x+uScroll, lat=p.z;
      if(uP.x!=0.){ float R=uP.x; vec2 v=vec2(p.x, p.z+R); lat=length(v)-abs(R); along=atan(v.x, v.y*sign(R))*abs(R)+uScroll; }
      bool gap = uP.y<uP.z && along>uP.y && along<uP.z;
      vec3 g; float depthS=s;
      if(!gap){
        float wet; float px = s*.0011/max(.08,-gden);
        float blur=uSpeed/55.;
        if(blur>.04){ g=vec3(0); for(int i=0;i<7+uZ;i++){ float off=(float(i)/6.-.5)*blur; g+=groundAlbedo(along+off, lat, max(px,blur*.6), wet); } g/=7.; }
        else g=groundAlbedo(along, lat, px, wet);
        float sh=shadowAt(p+vec3(0,.004,0));
        g *= mix(uMode==0?vec3(.74,.72,.84):vec3(.45,.40,.60), vec3(1.), sh);
        if(uSpeed>3. && uMode!=11){ float st=step(.83,vnoise(vec2(along/(1.+uSpeed*.14), lat*23.))); g=mix(g, g*1.45+.07, st*smoothstep(3.,14.,uSpeed)*.5); }
        if(uMode==3 || uMode==2){
          float sp=9.; float k0=floor((along)/sp+.5);
          for(int j=-2;j<=2+uZ;j++){
            float la=(k0+float(j))*sp; float lx=la-uScroll;
            if(uMode==3){ float pool=exp(-(pow(along-la,2.)/3.6+pow(lat+.55,2.)/5.0)); float band = pool>.55?1.:pool>.22?.55:pool>.07?.22:0.; g += vec3(.62,.44,.20)*band*.50*mix(.35,1.,sh); }
            vec3 lp=vec3(lx,3.0,-3.9); vec3 R=normalize(vec3(rd.x,-rd.y,rd.z)); vec3 L=normalize(lp-p);
            float daz=atan(L.x,-L.z)-atan(R.x,-R.z); daz=mod(daz+PI,2.*PI)-PI; float del=L.y-R.y;
            float rip = .55+.9*vnoise(vec2(along*2.2, lat*17.));
            float str = exp(-(daz*daz*(uMode==2?700.:1600.)+del*del*(uMode==2?5.:30.)))*rip;
            g += (uMode==2? vec3(.45,.68,1.0):vec3(1.0,.75,.35))*str*(uMode==2?.70:.30);
          }
        }
        if(uMode==2){
          float el2=clamp(-rd.y*2.2,0.,1.); vec3 refl=mix(vec3(.20,.30,.48),vec3(.05,.08,.17),el2)+uFlashL*vec3(.4); g += refl*.34*step(.46,vnoise(vec2(along*.55+rd.x*6.,lat*1.4+vnoise(vec2(along*4.,lat*7.))*.4)));
          vec2 q=vec2(along,lat)*2.6; vec2 c=floor(q);
          for(int a=-1;a<=1;a++) for(int b=-1;b<=1;b++){ vec2 cc=c+vec2(a,b); vec2 o=h22(cc); float ph=fract(uTime*1.9+h21(cc+5.)); float d=length(q-cc-o); float ring=(1.-smoothstep(.008,.045,abs(d-ph*.55)))*(1.-ph); g+=vec3(.45,.60,.85)*ring*.55*smoothstep(14.,3.,s); }
        }
        if(uMode==4){ vec3 sd=normalize(uSunDir); float daz=atan(rd.x,-rd.z)-atan(sd.x,-sd.z); g += vec3(1.0,.62,.36)*exp(-daz*daz*30.)*.18; }
        if(uMode==5) g += uFlashL*vec3(.25,.16,.40);
      } else {
        // canyon below the gap
        float depth=26.; vec3 g1;
        float best=1e9; float wy=0.; float wz=0.;
        for(int w=0;w<2;w++){ float wx=(w==0?uP.y:uP.z)-uScroll; float tw=(wx-uCam.x)/(abs(rd.x)<1e-5?1e-5:rd.x); if(tw>s*.999){ float y=uCam.y+rd.y*tw; if(y<0.&&y>-depth&&tw<best){best=tw;wy=y;wz=uCam.z+rd.z*tw;} } }
        float tf=(-depth-uCam.y)/rd.y;
        if(best<tf){
          float strata=vnoise(vec2(wy*.9+vnoise(vec2(wz*.4,wy*.3))*1.6, 2.));
          g1 = strata>.62? vec3(.60,.25,.24) : strata>.40? vec3(.46,.16,.24) : vec3(.32,.09,.22);
          g1 *= .86+.28*step(.5,vnoise(vec2(wz*1.7, wy*.22)));
          g1 = mix(g1, vec3(.17,.05,.20), smoothstep(-3.,-17.,wy));
          if(wy>-.28) g1=vec3(.96,.46,.24);
          depthS=best;
        } else {
          vec3 fp=uCam+rd*tf; float riv=abs(fp.z+ 3.*sin((fp.x+uScroll)*.25)+5.);
          g1 = riv<1.8? vec3(.96,.52,.30) : vec3(.13,.035,.18)*(1.+.5*step(.55,vnoise(fp.xz*.35)));
          depthS=tf;
        }
        g=g1;
      }
      float fogK = uMode==2?.030 : uMode==3?.016 : uMode==5?.03 : uMode==0?.02 : uMode==11?.05 : .011;
      vec3 hz = horizonColor(rd);
      float fog=1.-exp(-max(0.,depthS-5.)*fogK);
      if(uMode==1||uMode==4) fog*=.78;
      col=mix(g,hz,fog);
      vec4 cl=uVP*vec4(p,1.); gl_FragDepth=clamp(cl.z/cl.w*.5+.5,0.,.9999999); oG.y=gap?1000.:s;
    }
  }
  if(uMode==0 && rd.y>=-.0005) col=mix(vec3(.80,.79,.88), vec3(.93,.92,.97), smoothstep(0.,.35,rd.y));
  // lamp halos
  if(uMode==3||uMode==2){
    float sp=9.; float k0=floor((uScroll+uCam.x)/sp+.5);
    for(int j=-3;j<=3;j++){ float lx=(k0+float(j))*sp-uScroll; vec3 lp=vec3(lx,3.0,-3.9); vec3 v=lp-uCam; float t=dot(v,rd); if(t<=0.) continue; float d=length(v-rd*t); if(gl_FragDepth<.9999999 && oG.y<t) continue; col += (uMode==3?vec3(1.0,.74,.34):vec3(.50,.70,1.0))*(.0065/(d*d+.016))*.55; }
  }
  oColor=vec4(col*uDim,1.);
}`;
