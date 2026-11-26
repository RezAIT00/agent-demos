// ===== shared by the rose, the birds and the city (appended to common at build time)
struct PO { @builtin(position) pos:vec4f, @location(0) uv:vec2f, @location(1) wp:vec3f, @location(2) mi:vec4f };
fn ringRw(tau:f32)->f32 { return 260.0*(1.0-exp(-tau/0.35))+110.0*tau+1400.0*max(0.0,tau-1.6)*max(0.0,tau-1.6); }
fn crownHw(tau:f32)->f32 { return 310.0*(1.0-exp(-tau*3.2))*(1.0-0.78*smoothstep(1.0,2.7,tau)); }
fn roseVert(i:vec2f)->vec2f { let j=(hash22(i+71.0)-0.5)*0.72; let cell=vec2f(40.0/144.0,60.0/216.0); return vec2f(-20.0,0.0)+(i+j)*cell; }
fn roseAt(p:vec2f)->vec4f { // rgb, stone
  let c=p-vec2f(0.0,30.0); let r=length(c); let th=atan2(c.x,c.y)/(2.0*PI)+0.5; var st=1.0; var key=0.0; var seed=0.0;
  if(r<1.7){ st=0.0; key=2.0; }
  else if(r<6.6){ let f=th*12.0; let i=floor(f); let l=abs(fract(f)-0.5)*2.0*PI*r/12.0; let w=mix(0.25,1.35,smoothstep(1.7,5.4,r)); let cap=length(vec2f(l,max(r-5.2,0.0)))-1.35; if((l<w&&r<5.2&&r>2.1)||(cap<0.0&&r>=5.2)){ st=0.0; key=select(0.0,1.0,fract(i*0.5)>0.25); seed=i; } }
  else if(r<11.6){ let f=th*24.0+0.5; let i=floor(f); let l=abs(fract(f)-0.5)*2.0*PI*r/24.0; let w=mix(0.55,1.28,smoothstep(7.0,10.2,r)); let cap=length(vec2f(l,max(r-10.1,0.0)))-1.25; if((l<w&&r<10.1&&r>7.0)||(cap<0.0&&r>=10.1)){ st=0.0; key=select(4.0,5.0,fract(i/2.0)>0.25); if(fract(i/4.0)>0.7){key=2.0;} seed=i+30.0; } }
  else if(r<14.6){ let f=th*24.0; let i=floor(f); let a=(i+0.5)/24.0*2.0*PI; let q=length(c-vec2f(sin(a-PI),cos(a-PI))*12.95); if(q<1.18){ st=0.0; key=select(6.0,3.0,fract(i/2.0)>0.25); if(q<0.5){key=2.0;} seed=i+60.0; } }
  else if(p.y<14.2&&p.y>3.0&&abs(p.x)<14.0){ let li=floor(p.x/4.0+0.5); let lx=p.x-li*4.0; var w=1.5; if(p.y>11.8){ w=sqrt(max(0.0,2.4*2.4-(p.y-11.8)*(p.y-11.8)))-0.9; } if(abs(lx)<w){ st=0.0; key=f32((i32(li)+20)%7); seed=li+90.0; } }
  let v=vor(p*1.35+seed); let h=hash22(v.zw+seed); var col=palette(i32(key)); col=mix(col,palette(i32(key)+1+i32(h.x*3.0)),step(0.78,h.y)); col*=0.7+0.6*h.x;
  let lead=1.0-smoothstep(0.03,0.07,(v.y-v.x)*0.5); return vec4f(col,max(st,lead*0.95));
}
// slow-motion burst: shards race out, then hang; shards that do not become birds fall after the birds leave
struct SD { mid:vec2f, off:vec3f, ax:vec3f, an:f32, tt:f32, hax:vec2f };
fn isBirdCell(c:vec2f)->bool { let k=u32(c.y)*144u+u32(c.x); return birdsB[BIRD_OFF1+k/4u][k%4u]>0.5; }
fn shardDyn(c:vec2f,t:f32,bird:bool)->SD {
  var o:SD; let flip=hash21(c)>0.5; var d0=roseVert(c); var d1=roseVert(c+vec2f(1.0,1.0)); if(flip){ d0=roseVert(c+vec2f(1.0,0.0)); d1=roseVert(c+vec2f(0.0,1.0)); }
  o.mid=(d0+d1)*0.5; o.hax=normalize(d1-d0); let h=hash33(vec3f(c,1.0)); let h2=hash33(vec3f(c.yx,6.0));
  let tau=t-13.0+0.07; var ts=select(0.62*(1.0-exp(-tau/0.24)),0.0,tau<=0.0); if(!bird){ ts+=max(t-13.15,0.0)*0.9; }
  let rel=o.mid-vec2f(0.0,30.0); let r=length(rel); let tt=max(ts-r*0.006,0.0); o.tt=tt; let sp=mix(78.0,16.0,sat(r/17.0))*(0.30+h.x);
  o.off=vec3f(rel/max(r,0.2)*sp*0.42*tt+(h2.xy-0.5)*9.0*tt, sp*1.5*tt*(0.3+h.y)+(h2.z-0.5)*9.0*tt); o.off.y-=1.2*tt*tt+select(0.0,14.0*max(t-13.15,0.0)*max(t-13.15,0.0),!bird);
  o.ax=normalize(h2-0.5); o.an=tt*(3.0+14.0*h.z); return o;
}
fn rotA(p:vec3f,ax:vec3f,an:f32)->vec3f { return p*cos(an)+cross(ax,p)*sin(an)+ax*dot(ax,p)*(1.0-cos(an)); }
// ---- the city that comes out of the sea
const CELL = 50.0;
struct Tower { c:vec2f, hw:vec2f, H:f32, top:f32, tr:f32, tl:f32, h:vec4f, ok:f32, lift:f32, rise:f32 };
fn towerAt(ij:vec2i)->Tower {
  var T:Tower; let fi=vec2f(ij); let h=hash22(fi+vec2f(31.7,77.1)); let h2=hash22(fi.yx+vec2f(5.3,9.1)); let h3=hash22(fi+vec2f(13.0,2.0));
  T.h=vec4f(h,h2); T.c=vec2f(u.city.x+fi.x*CELL,u.city.y+fi.y*CELL);
  T.ok=select(0.0,1.0,ij.x!=0&&h.x>0.08&&ij.y>=0&&ij.y<CITYNZ_C);
  T.hw=vec2f(9.0+9.5*h.y,9.0+9.5*h2.x); let ax=abs(fi.x*CELL);
  T.H=u.seg2.z*3.6*(0.20+0.80*pow(h2.y,0.6))*(1.0-0.55*smoothstep(380.0,1000.0,ax))*(0.72+0.28*smoothstep(0.0,700.0,fi.y*CELL));
  T.tr=T_CITY_C+0.30+length(vec2f(fi.x*CELL,fi.y*CELL-120.0))*0.00115+0.45*h3.x;
  let k=sat((u.cam.w-T.tr)/2.4); T.rise=1.0-(1.0-k)*(1.0-k)*(1.0-k);
  T.tl=T_GRAV_C+0.15+0.6*h3.y+0.0003*length(fi*CELL-vec2f(0.0,700.0)); let dt=max(u.cam.w-T.tl,0.0); T.lift=0.5*u.city.z*0.8*dt*dt;
  T.top=T.H*T.rise+T.lift; return T;
}
fn cityWater(x:f32,z:f32)->vec3f { // water heaped up and foaming round the rising towers
  if(u.seg.y<-0.2||u.seg2.w>0.99){ return vec3f(0.0); }
  let base=vec2i(round((vec2f(x,z)-u.city.xy)/CELL)); var bump=0.0; var foam=0.0; var glow=0.0;
  for(var j=-1;j<=1;j++){ for(var i=-1;i<=1;i++){ let T=towerAt(base+vec2i(i,j)); if(T.ok<0.5){continue;} let age=u.cam.w-T.tr; if(age<0.0){continue;}
    let q=abs(vec2f(x,z)-T.c)-T.hw; let d=length(max(q,vec2f(0.0)))+min(max(q.x,q.y),0.0); if(d>60.0){continue;}
    bump+=9.0*exp(-max(d,0.0)/10.0)*sat(age*2.5)*(1.0-sat(age/3.2))*(1.0-sat(T.lift*0.05));
    glow+=exp(-max(d,0.0)/18.0)*sat(age*2.0)*(1.0-sat(age/3.0))*min(T.H*0.0008,0.45); foam=max(foam,exp(-max(d,0.0)/2.5)*0.9*(1.0-sat(age/3.5))*(1.0-sat(T.lift*0.02))); } }
  return vec3f(bump,foam,glow);
}
fn starField(d:vec3f,k:f32)->vec3f {
  let n=d/(abs(d.x)+abs(d.y)+abs(d.z)); var uv=n.xz; if(n.y<0.0){ uv=(1.0-abs(n.zx))*sign(n.xz+vec2f(1e-6)); }
  var c=vec3f(0.0);
  for(var l=0;l<2;l++){ let sc=select(700.0,1500.0,l==1); let g=uv*sc; let ip=floor(g); let h=hash22(ip+vec2f(7.1+f32(l)*13.0,3.3)); let f=fract(g)-0.15-0.7*h; let b=pow(hash21(ip+11.0+f32(l)*5.0),select(28.0,14.0,l==1));
    let tint=mix(vec3f(0.65,0.78,1.0),vec3f(1.0,0.82,0.62),hash21(ip+3.0)); c+=tint*b*exp(-dot(f,f)*sc*0.9)*select(60.0,22.0,l==1); }
  let gal=normalize(vec3f(0.35,0.62,-0.70)); let band=exp(-pow(dot(d,gal)/0.16,2.0))*(0.4+0.6*fbm2(uv*9.0));
  return c*k+vec3f(0.55,0.58,0.75)*band*0.035*k;
}
