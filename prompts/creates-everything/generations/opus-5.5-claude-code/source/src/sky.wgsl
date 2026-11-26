// Sky dome: single scattering atmosphere + ray-marched cumulonimbus, written to a 4096x1024 HDR dome.
struct SU { sun:vec4f, t:vec4f }; // sun dir; t.x time, t.y coverage, t.z turbidity, t.w tile index
@group(0) @binding(0) var<uniform> s : SU;
@group(0) @binding(1) var nTex : texture_3d<f32>;
@group(0) @binding(2) var nS : sampler;
@group(0) @binding(3) var oDome : texture_storage_2d<rgba16float, write>;
const PI = 3.14159265;
const RG = 6360000.0; const RT = 6420000.0;
const BR = vec3f(5.802e-6,13.558e-6,33.1e-6); const BO = vec3f(0.65e-6,1.881e-6,0.085e-6);
fn domeDir(uv:vec2f)->vec3f { let q=uv.x*2.0-1.0; let az=sign(q)*pow(abs(q),1.0/0.75)*PI; let el=uv.y*uv.y*0.5*PI; return vec3f(sin(az)*cos(el), sin(el), cos(az)*cos(el)); }
fn rayS(o:vec3f,d:vec3f,r:f32)->vec2f { let b=dot(o,d); let c=dot(o,o)-r*r; let h=b*b-c; if(h<0.0){return vec2f(1e9,-1e9);} let q=sqrt(h); return vec2f(-b-q,-b+q); }
fn dens(h:f32)->vec3f { return vec3f(exp(-h/8000.0),exp(-h/1200.0),max(0.0,1.0-abs(h-25000.0)/15000.0)); }
fn ext(d:vec3f)->vec3f { return BR*d.x+vec3f(4.4e-6*s.t.z)*d.y+BO*d.z; }
fn sunT(p:vec3f)->vec3f { let gr=rayS(p,s.sun.xyz,RG-20.0); if(gr.x>0.0){ return vec3f(0.0); } let L=rayS(p,s.sun.xyz,RT).y; var od=vec3f(0.0); let n=8; for(var i=0;i<n;i++){ let a=f32(i)/f32(n); let b=f32(i+1)/f32(n); let t0=L*a*a; let t1=L*b*b; let h=length(p+s.sun.xyz*(t0+t1)*0.5)-RG; od+=ext(dens(max(h,0.0)))*(t1-t0); } return exp(-od); }
fn sunTc(p:vec3f)->vec3f { let gr=rayS(p,s.sun.xyz,RG-20.0); if(gr.x>0.0&&gr.x<1e8){ return vec3f(0.0); } let L=rayS(p,s.sun.xyz,RT).y; var od=vec3f(0.0); let n=8; for(var i=0;i<n;i++){ let a=f32(i)/f32(n); let b=f32(i+1)/f32(n); let t0=L*a*a; let t1=L*b*b; let h=length(p+s.sun.xyz*(t0+t1)*0.5)-RG; od+=ext(dens(max(h,0.0)))*(t1-t0); } return exp(-od); }
fn hg(c:f32,g:f32)->f32 { let g2=g*g; return (1.0-g2)/(4.0*PI*pow(max(1.0+g2-2.0*g*c,1e-4),1.5)); }
const E0 = vec3f(20.0,19.4,18.6);
fn atmos(d:vec3f)->vec3f {
  let o=vec3f(0.0,RG+60.0,0.0); let L=rayS(o,d,RT).y; let mu=dot(d,s.sun.xyz); let pr=3.0/(16.0*PI)*(1.0+mu*mu); let pm=hg(mu,0.76)*0.85+hg(mu,0.2)*0.15;
  var T=vec3f(1.0); var C=vec3f(0.0); let n=26;
  for(var i=0;i<n;i++){ let a=f32(i)/f32(n); let b=f32(i+1)/f32(n); let t0=L*a*a; let t1=L*b*b; let dt=t1-t0; let p=o+d*(t0+t1)*0.5; let h=max(length(p)-RG,0.0); let dn=dens(h); let e=ext(dn); let st=sunT(p);
    let sr=BR*dn.x; let sm=4.0e-6*s.t.z*dn.y; let S=E0*(st*(sr*pr+sm*pm)+(sr+sm)*(0.006+0.045*st)); let Tn=T*exp(-e*dt); C+=S*(T-Tn)/max(e,vec3f(1e-9)); T=Tn; }
  return C;
}
fn rm(x:f32,a:f32,b:f32,c:f32,d:f32)->f32 { return c+(x-a)/(b-a)*(d-c); }
fn sat(x:f32)->f32 { return clamp(x,0.0,1.0); }
fn hash(p:vec2f)->f32 { var q=fract(vec3f(p.xyx)*0.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
const CB = 800.0; const CT = 13500.0;
// composed cloudscape: azimuth deg, distance km, radius km, top km
const NTW = 9;
const TW = array<vec4f,9>(vec4f(17.0,31.0,9.0,12.8),vec4f(70.0,27.0,9.5,12.0),vec4f(-24.0,38.0,12.0,11.5),vec4f(122.0,30.0,13.0,11.0),vec4f(50.0,105.0,16.0,6.2),vec4f(34.0,98.0,12.0,5.4),vec4f(88.0,62.0,10.0,9.0),vec4f(-66.0,34.0,14.0,9.5),vec4f(190.0,40.0,18.0,10.0));
fn cloud(p:vec3f,detail:bool)->f32 { // p metres, y = altitude
  if(p.y<CB||p.y>CT){return 0.0;}
  let sh=vec3f(s.t.x*10.0,0.0,s.t.x*3.0);
  let wn=textureSampleLevel(nTex,nS,vec3f(p.x/31000.0,0.2,p.z/31000.0),0.0); let wq=p.xz+(vec2f(wn.w,wn.y)-0.5)*7000.0;
  var cov=0.0;
  for(var i=0;i<NTW;i++){ let t=TW[i]; let a=t.x*PI/180.0; let c=vec2f(sin(a),cos(a))*t.y*1000.0; let r=distance(wq,c)/(t.z*1000.0); if(r<1.25){ let top=t.w*1000.0*(1.0-0.62*r*r); let hh=p.y/top; let body=(1.0-smoothstep(0.55,1.15,r+0.28*smoothstep(0.05,0.45,hh)*(1.0-smoothstep(0.6,0.95,hh))))*(1.0-smoothstep(0.80,1.0,hh)); cov=max(cov,body); } }
  // low fair-weather deck, patchy
  let w2=textureSampleLevel(nTex,nS,vec3f(p.xz/17000.0+0.4,0.7),0.0); let low=sat((w2.w*0.75+w2.y*0.35-0.60+s.t.y)*2.6)*(1.0-smoothstep(1300.0,2300.0,p.y))*0.9*smoothstep(36000.0,60000.0,length(p.xz)); cov=max(cov,low);
  cov*=smoothstep(CB,CB+220.0,p.y); if(cov<0.02){return 0.0;}
  let n=textureSampleLevel(nTex,nS,(p+sh)/6100.0,0.0); let sb=n.x*0.55+(n.y*0.625+n.z*0.25)*0.55;
  var d=sat(rm(sb,1.0-cov*0.95,1.0,0.0,1.0))*1.25;
  if(d>0.0&&detail){ let q=textureSampleLevel(nTex,nS,(p+sh*1.6)/1150.0+vec3f(n.y*0.10),0.0); let er=q.y*0.60+q.z*0.35; d=sat(rm(d,(er*0.60)*(1.0-d*0.5),1.0,0.0,1.0)); }
  return d;
}
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) g:vec3u){
  let dim=vec2f(textureDimensions(oDome)); let px=vec2u(g.x,g.y+u32(s.t.w)*128u); if(px.y>=u32(dim.y)){return;}
  let uv=(vec2f(px)+0.5)/dim; let d=domeDir(uv); var sky=atmos(d); let sky0=sky; let o=vec3f(0.0,RG+30.0,0.0);
  let st=E0*sunTc(vec3f(0.0,RG+4000.0,0.0)); let mu=dot(d,s.sun.xyz);
  // cirrus sheet
  { let tc=rayS(o,d,RG+10500.0).y; let cp=(o+d*tc).xz; let a=textureSampleLevel(nTex,nS,vec3f(cp.x/90000.0+cp.y/260000.0,0.4,cp.y/34000.0),0.0); let b=textureSampleLevel(nTex,nS,vec3f(cp.x/21000.0,0.6,cp.y/7600.0),0.0); let ci=sat((a.w*0.8+b.w*0.35-0.52)*2.6)*sat(0.5+b.y); let fade=exp(-tc/170000.0); sky+=st*(hg(mu,0.6)*0.40+0.018)*ci*fade*0.55; }
  var C=vec3f(0.0); var T=1.0;
  let t0=rayS(o,d,RG+CB).y; let t1=min(rayS(o,d,RG+CT).y,125000.0);
  if(t0<120000.0){
    let n=176; let jit=hash(vec2f(px));
    let amb0=atmos(normalize(vec3f(-s.sun.x,0.9,-s.sun.z))); let ambh=atmos(normalize(vec3f(-s.sun.x*0.5,0.22,-s.sun.z)));
    let a0=max(t0,1.0); let ratio=t1/a0;
    for(var i=0;i<n;i++){
      let k0=f32(i)/f32(n); let k1=f32(i+1)/f32(n); let ta=mix(a0+(t1-a0)*k0,a0*pow(ratio,k0),0.5); let tb=mix(a0+(t1-a0)*k1,a0*pow(ratio,k1),0.5); let dt=tb-ta; let t=ta+dt*jit;
      let wp=o+d*t; let alt=length(wp)-RG; let dn=cloud(vec3f(wp.x,alt,wp.z),true);
      if(dn>0.002){
        var od=0.0; var lt=0.0; for(var j=0;j<7;j++){ let ls=80.0*pow(1.8,f32(j)); let lp=wp+s.sun.xyz*(lt+ls*0.5); let la=length(lp)-RG; od+=cloud(vec3f(lp.x,la,lp.z),j<4)*ls; lt+=ls; }
        let sig=0.0075; var lum=0.0; var aa=1.0; var bb=1.0; var gg=1.0;
        for(var m=0;m<4;m++){ let ph=mix(hg(mu,0.70*gg),hg(mu,-0.22*gg),0.28)+0.016; lum+=aa*ph*exp(-od*sig*bb); aa*=0.55; bb*=0.34; gg*=0.6; }
        let powd=1.0-0.6*exp(-dn*10.0);
        let hh=sat((alt-CB)/9000.0); let amb=mix(ambh*0.16,amb0*0.75,hh)*(0.25+0.75*hh);
        let S=st*lum*powd*2.7+amb; let e=dn*sig; let Tn=T*exp(-e*dt); let ap=exp(-t/70000.0); C+=mix(sky0,S,ap)*(T-Tn); T=Tn; if(T<0.008){break;}
      }
    }
  }
  var c=sky*T+C; let hz=exp(-max(d.y,0.0)*42.0); c=mix(c,sky,hz*0.5);
  textureStore(oDome,px,vec4f(min(c,vec3f(60.0)),T));
}
