// ================= worlds 2..7: crown splash, birds, the rising city, lanterns, rain up, the galaxy
fn wggx(nh:f32,a2:f32)->f32 { let d=nh*nh*(a2-1.0)+1.0; return a2/(PI*d*d); }
fn ambSky()->vec3f { return domeRaw(vec3f(0.1,0.95,0.2),6.0).rgb*u.sun.w*(1.0-u.seg2.w); }
const QD = array<vec2u,6>(vec2u(0,0),vec2u(1,0),vec2u(1,1),vec2u(0,0),vec2u(1,1),vec2u(0,1));
const QS = array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(1,1),vec2f(-1,-1),vec2f(1,1),vec2f(-1,1));

// ---------------------------------------------------------------- 1. the crown: a 300 m sheet of water thrown up round the cursor's sun
struct CO { @builtin(position) pos:vec4f, @location(0) wp:vec3f, @location(1) n:vec3f, @location(2) q:vec2f, @location(3) mi:vec4f };
fn crownH(tau:f32)->f32 { return 310.0*(1.0-exp(-tau*3.2))*(1.0-smoothstep(0.85,1.9,tau)); }
fn crownP(th:f32,v:f32,tau:f32)->vec3f {
  let R=u.birth.z; let rb=max(R*0.28,5.0)+3.0; let H=crownH(tau);
  let wob=(vnoise(vec2f(th*7.64,tau*0.9+v*2.0))-0.5)*0.26+(vnoise(vec2f(th*22.9,v*5.0-tau*2.0))-0.5)*0.07;
  let fall=smoothstep(0.8,1.9,tau); let fl=(0.12*v+0.20*v*v)*(1.0+wob)+fall*v*v*0.28;
  let r=rb+H*fl; let y=H*v*(1.0-0.08*v)*(1.0+wob*0.25)-fall*v*v*H*0.45;
  return vec3f(u.birth.x+sin(th)*r,y,u.birth.y+cos(th)*r);
}
@vertex fn vsCrown(@builtin(vertex_index) vi:u32)->CO {
  var o:CO; let tau=u.gal2.w; let c=QD[vi%6u]; let cell=vi/6u; let iu=cell%480u; let iv=cell/480u;
  let th=f32(iu+c.x)/480.0*2.0*PI; let v=f32(iv+c.y)/96.0;
  if(tau<0.0||tau>2.0){ o.pos=vec4f(0,0,-9,1); return o; }
  let p=crownP(th,v,tau); let pt=crownP(th+0.01,v,tau); let pv=crownP(th,v+0.01,tau);
  o.n=normalize(cross(pt-p,pv-p)); o.wp=p; o.q=vec2f(th,v); o.mi=vec4f(tau,crownH(tau),0,0); o.pos=u.vp*vec4f(p,1.0); return o;
}
@fragment fn fsCrown(v:CO)->@location(0) vec4f {
  let tau=v.mi.x; let th=v.q.x; let vv=v.q.y;
  // the rim tears into fingers, and the sheet itself tears open as it falls
  let fing=vnoise(vec2f(th*10.19,1.3)); let nf=th*64.0/(2.0*PI); let fx=abs(fract(nf+vnoise(vec2f(th*3.0,vv*2.0))*0.6)-0.5);
  let top=0.86+0.16*fing-0.75*smoothstep(0.9,1.8,tau)*(0.6+0.8*vnoise(vec2f(th*4.0,tau)));
  if(vv>top){ let tip=(vv-top)/0.16; if(fx>0.30*(1.0-tip)){ discard; } }
  let hole=vnoise(vec2f(th*18.0,vv*9.0-tau*1.5))+vnoise(vec2f(th*41.0,vv*20.0))*0.5; if(hole<smoothstep(0.9,1.8,tau)*1.4-0.15){ discard; }
  let V=normalize(u.cam.xyz-v.wp); var n=normalize(v.n); if(dot(n,V)<0.0){ n=-n; } let L=u.sun.xyz;
  let nrm=normalize(n+vec3f(vnoise(vec2f(th*90.0,vv*30.0-tau*4.0))-0.5,0.0,vnoise(vec2f(th*80.0+3.0,vv*28.0))-0.5)*0.35);
  let nv=max(dot(nrm,V),0.03); let F=0.02+0.98*pow(1.0-nv,5.0); var R=reflect(-V,nrm); R.y=abs(R.y)+0.02; let sky=dome(normalize(R),1.5).rgb;
  let d=mix(7.0,0.9,vv); let thr=normalize(mix(-V,refract(-V,nrm,0.75),0.7)); let ext=exp(-vec3f(0.42,0.10,0.09)*d);
  let cS=sat(dot(thr,L)); let glow=hg(cS,0.78)*0.6+hg(cS,0.95)*0.12+0.03; let amb=ambSky();
  let water=vec3f(0.85,0.95,1.3)*(u.sunC.rgb*glow*ext*1.2+skyThrough(thr,5.0)*ext*0.35)+vec3f(0.004,0.03,0.04)*amb;
  // streaming white water up the sheet
  let st=textureSampleLevel(tFoam,sRep,vec2f(th*7.0,vv*1.4-tau*1.1),1.0); let st2=textureSampleLevel(tFoam,sRep,vec2f(th*23.0,vv*4.0-tau*2.3),0.5);
  let fm=smoothstep(0.55,1.05,st.b*0.7+st2.r*0.35+vv*0.25+exp(-vv*14.0)*0.8);
  let fc=vec3f(0.9,0.95,1.0)*(u.sunC.rgb*(0.05+0.22*hg(sat(dot(-V,L)),0.55))+amb*vec3f(0.85,0.95,1.1)*1.1);
  var col=mix(water*(1.0-F)+sky*F,fc,fm*0.85);
  let dist=distance(u.cam.xyz,v.wp); col=mix(col,fogColor(-V),1.0-exp(-dist*u.sky.z));
  return vec4f(max(col,vec3f(0.0)),1.0);
}

// ---------------------------------------------------------------- 2. birds: shards unfold into articulated stained-glass birds
struct BO { @builtin(position) pos:vec4f, @location(0) wp:vec3f, @location(1) n:vec3f, @location(2) @interpolate(flat) c:vec4f, @location(3) mi:vec4f };
// 22 triangles: body 10, tail 2, per wing inner 2 + outer 3. seg: 0 body/tail, 1 inner wing, 2 outer wing; sign = side
const BV = array<vec3f,15>(vec3f(0.0,0.02,0.52),vec3f(0.0,0.09,0.30),vec3f(0.0,0.10,0.0),vec3f(0.0,-0.10,0.05),vec3f(-0.085,0.0,0.1),vec3f(0.085,0.0,0.1),vec3f(0.0,0.03,-0.30),
  vec3f(-0.16,0.02,-0.58),vec3f(0.0,0.03,-0.50),vec3f(0.16,0.02,-0.58), vec3f(0.07,0.04,0.20),vec3f(0.07,0.04,-0.12),vec3f(0.55,0.04,0.17),vec3f(0.55,0.04,-0.16),vec3f(1.05,0.04,-0.05));
const BT = array<u32,36>(0u,1u,4u, 0u,5u,1u, 0u,4u,3u, 0u,3u,5u, 1u,2u,4u, 1u,5u,2u, 4u,2u,6u, 2u,5u,6u, 4u,6u,3u, 3u,6u,5u, 6u,7u,8u, 6u,8u,9u);
fn birdLocal(k:u32,side:f32,a1:f32,a2:f32,fold:f32)->vec3f {
  // wing triangles: inner (S1,E1,S2),(S2,E1,E2); outer (E1,P1,E2),(E2,P1,P2),(P1,Pt,P2)
  let wi=array<u32,15>(10u,12u,11u, 11u,12u,13u, 12u,14u,13u, 13u,14u,15u, 14u,16u,15u);
  let id=wi[k]; var p:vec3f;
  if(id<15u){ p=BV[id]; } else if(id==15u){ p=vec3f(0.98,0.04,-0.26); } else { p=vec3f(1.12,0.04,-0.17); }
  let seg=select(1.0,2.0,id>=12u); var q=p;
  if(seg>1.5){ var e=q-vec3f(0.55,0.04,q.z); e.x*=fold; let ca=cos(a2); let sa=sin(a2); e=vec3f(e.x*ca-e.y*sa,e.x*sa+e.y*ca,e.z); q=vec3f(0.55,0.04,q.z)+e; }
  if(id!=10u&&id!=11u){ var e=q-vec3f(0.07,0.04,q.z); let ca=cos(a1); let sa=sin(a1); e=vec3f(e.x*ca-e.y*sa,e.x*sa+e.y*ca,e.z); q=vec3f(0.07,0.04,q.z)+e; }
  q.x*=side; return q;
}
fn birdPos(i:u32,f:f32)->vec4f { let fi=clamp(f,0.0,f32(BIRD_NF-1u)); let i0=u32(floor(fi)); let k=fi-f32(i0);
  let a=birdsB[min(i0,BIRD_NF-1u)*NBIRDC+i]; let b=birdsB[min(i0+1u,BIRD_NF-1u)*NBIRDC+i]; let p0=birdsB[max(i0,1u)*NBIRDC-NBIRDC+i]; let p3=birdsB[min(i0+2u,BIRD_NF-1u)*NBIRDC+i];
  let k2=k*k; let k3=k2*k; let cr=0.5*((2.0*a.xyz)+(-p0.xyz+b.xyz)*k+(2.0*p0.xyz-5.0*a.xyz+4.0*b.xyz-p3.xyz)*k2+(-p0.xyz+3.0*a.xyz-3.0*b.xyz+p3.xyz)*k3);
  return vec4f(cr,max(a.w,b.w)); }
@vertex fn vsBird(@builtin(vertex_index) vi:u32,@builtin(instance_index) ii:u32)->BO {
  var o:BO; let t=u.cam.w; let f=(t-T_FLY_C)*30.0; let info=birdsB[BIRD_OFF2+ii]; if(info.z<0.5||t<T_FLY_C){ o.pos=vec4f(0,0,-9,1); return o; }
  let cell=info.xy; let h=hash33(vec3f(cell,4.0)); let h2=hash33(vec3f(cell.yx,9.0));
  let P=birdPos(ii,f); let P1=birdPos(ii,f+0.5); let P0=birdPos(ii,f-0.5); var vel=(P1.xyz-P0.xyz)*60.0; let acc=(P1.xyz-2.0*P.xyz+P0.xyz)*3600.0;
  if(P.w>0.0&&t>P.w+0.05){ o.pos=vec4f(0,0,-9,1); return o; } // into the sea
  let sp=max(length(vel),1.0); let fw=vel/sp; let lat=dot(acc,normalize(cross(vec3f(0,1,0),fw)));
  var rt=normalize(cross(vec3f(0.0,1.0,0.0),fw)); var up=cross(fw,rt); let bank=clamp(lat*0.035,-1.1,1.1); let cb=cos(bank); let sb=sin(bank); let rt2=rt*cb+up*sb; up=up*cb-rt*sb; rt=rt2;
  // wing beat: flap, glide, or tuck for the dive
  let dive=smoothstep(T_CITY_C-0.2,T_CITY_C+0.6,t); let hz=3.2+1.4*h.x; let ph=t*hz*2.0*PI+h.y*6.28; let glide=smoothstep(0.55,0.75,sin(t*0.9+h.z*6.0));
  let am=mix(mix(0.62,0.08,glide),0.0,dive); var a1=am*sin(ph)+0.10+mix(0.0,0.10,glide); var a2=am*0.8*sin(ph-0.9)-0.05; var fold=1.0-0.28*max(0.0,cos(ph))*(1.0-glide);
  a1=mix(a1,-0.15,dive); fold=mix(fold,0.45,dive);
  // geometry
  let tri=vi/3u; let k=vi%3u; var lp:vec3f; var side=1.0; var seg=0.0;
  if(tri<12u){ lp=BV[BT[tri*3u+k]]; } else { let w=tri-12u; side=select(-1.0,1.0,w<5u); let wk=(w%5u)*3u+k; var kk=wk; if(side<0.0){ kk=(w%5u)*3u+(2u-k); } lp=birdLocal(kk,side,a1,a2,fold); seg=select(2.0,1.0,(w%5u)<2u); }
  let bs=1.0+0.7*h2.x;
  // the morph: at T_FLY the bird is a flat silhouette lying in its shard, then it unfolds
  let b=smoothstep(T_FLY_C+0.02,T_FLY_C+0.55+0.25*h.z,t);
  let sd=shardDyn(cell,T_FLY_C,true); let sc=vec3f(sd.mid,u.fr.z)+sd.off; let hp=vec2f(-sd.hax.y,sd.hax.x);
  let flatL=rotA(vec3f(hp*lp.x+sd.hax*lp.z,0.0)*0.55,sd.ax,sd.an);
  let world3=fw*lp.z*bs+rt*lp.x*bs+up*lp.y*bs;
  o.wp=mix(sc+flatL,P.xyz+world3,b);
  let col=roseAt(sd.mid); o.c=vec4f(col.rgb,seg); o.mi=vec4f(b,dive,lp.x,lp.z);
  let n0=rotA(vec3f(0.0,0.0,-1.0),sd.ax,sd.an); o.n=normalize(mix(n0,up+rt*lp.x*0.3*side,b)); o.pos=u.vp*vec4f(o.wp,1.0); return o;
}
@fragment fn fsBird(v:BO,@builtin(front_facing) ff:bool)->@location(0) vec4f {
  let V=normalize(u.cam.xyz-v.wp); var n=normalize(v.n); if(dot(n,V)<0.0){ n=-n; } let L=u.sun.xyz; let amb=ambSky();
  let nv=max(dot(n,V),0.03); let F=0.04+0.96*pow(1.0-nv,5.0); var R=reflect(-V,n); R.y=abs(R.y)+0.02; let env=dome(normalize(R),2.0).rgb;
  let lead=1.0-smoothstep(0.03,0.07,abs(fract(v.mi.z*3.0+v.mi.w*2.0)-0.5)*0.4);
  let back=hg(sat(dot(-V,L)),0.72)*1.4+0.02; let gcol=mix(vec3f(dot(v.c.rgb,vec3f(0.33))),v.c.rgb,0.75);
  let glass=vec3f(0.012,0.012,0.016)*amb+gcol*(u.sunC.rgb*back*0.9+skyThrough(-V,3.0)*0.18);
  var col=select(glass*(1.0-lead*0.85),vec3f(0.012,0.011,0.014)*amb+env*0.12,v.c.w<0.5)*(1.0-F)+env*F*0.6;
  // as night falls the glass starts to burn; diving, they become the city's lights
  let ember=smoothstep(T_CITY_C-3.4,T_CITY_C-0.9,u.cam.w); col+=v.c.rgb*mix(vec3f(1.0,0.75,0.45),vec3f(1.0),0.3)*ember*(2.2+4.0*v.mi.y)*select(1.0,0.35,v.c.w<0.5);
  let dist=distance(u.cam.xyz,v.wp); col=mix(col,fogColor(-V),1.0-exp(-dist*u.sky.z));
  return vec4f(max(col,vec3f(0.0)),1.0);
}

// ---------------------------------------------------------------- 3. the city: towers rise out of the sea, pouring water, lights coming on floor by floor
struct TO2 { @builtin(position) pos:vec4f, @location(0) wp:vec3f, @location(1) n:vec3f, @location(2) @interpolate(flat) id:vec4f, @location(3) q:vec4f };
@vertex fn vsTower(@builtin(vertex_index) vi:u32,@builtin(instance_index) ii:u32)->TO2 {
  var o:TO2; let ij=vec2i(i32(ii%CITYNX_C)-i32(CITYNX_C/2u),i32(ii/CITYNX_C)); let T=towerAt(ij);
  if(T.ok<0.5||u.cam.w<T.tr){ o.pos=vec4f(0,0,-9,1); return o; }
  let tier=vi/30u; let k=vi%30u; let face=k/6u; let c=QD[k%6u];
  let hw=select(T.hw,T.hw*vec2f(0.70,0.74),tier==1u); let base=T.top-T.H-45.0; let ysplit=T.top-T.H*0.26; var y0=base; var y1=ysplit; if(tier==1u){ y0=ysplit; y1=T.top+T.H*0.02; }
  var p:vec3f; var n:vec3f; let a=f32(c.x); let b=f32(c.y);
  if(face==0u){ p=vec3f(hw.x,mix(y0,y1,b),mix(-hw.y,hw.y,a)); n=vec3f(1,0,0); }
  else if(face==1u){ p=vec3f(-hw.x,mix(y0,y1,b),mix(hw.y,-hw.y,a)); n=vec3f(-1,0,0); }
  else if(face==2u){ p=vec3f(mix(hw.x,-hw.x,a),mix(y0,y1,b),hw.y); n=vec3f(0,0,1); }
  else if(face==3u){ p=vec3f(mix(-hw.x,hw.x,a),mix(y0,y1,b),-hw.y); n=vec3f(0,0,-1); }
  else { p=vec3f(mix(-hw.x,hw.x,a),y1,mix(-hw.y,hw.y,b)); n=vec3f(0,1,0); }
  // after gravity flips, towers tumble slowly as they fall up
  let tl=max(u.cam.w-T.tl,0.0); let rax=normalize(vec3f(T.h.x-0.5,0.3,T.h.y-0.5)); let an=tl*tl*0.006*(0.5+T.h.z);
  let cen=vec3f(0.0,T.top-T.H*0.5,0.0); p=cen+rotA(p-cen,rax,an); n=rotA(n,rax,an);
  o.wp=vec3f(T.c.x,0.0,T.c.y)+p; o.n=n; o.id=vec4f(f32(ij.x),f32(ij.y),f32(face),f32(tier)); o.q=vec4f(T.top,T.H,T.tr,T.tl);
  o.pos=u.vp*vec4f(o.wp,1.0); return o;
}
fn winLit(ij:vec2f,fl:f32,bay:f32,face:f32,H:f32,tr:f32,tl:f32,v:f32)->vec2f { // x: on, y: colour seed
  let h=hash33(vec3f(ij.x*7.0+face*131.0+bay*0.37,fl+ij.y*3.1,bay*1.7+face));
  if(h.x<0.60){ return vec2f(0.0,h.y); }
  let em=tr+2.4*(1.0-pow(clamp(v/max(H,1.0),0.0,1.0),0.3333));          // when this floor came out of the water
  let on=smoothstep(em+0.25+0.9*h.y,em+0.35+0.9*h.y,u.cam.w);
  let rel=T_GRAV_C+0.1+2.6*h.z;                                          // and when its light lets go
  return vec2f(on*(1.0-step(rel,u.cam.w)),h.y);
}
@fragment fn fsTower(v:TO2)->@location(0) vec4f {
  let V=normalize(u.cam.xyz-v.wp); let n=normalize(v.n); let face=v.id.z; let top=v.q.x; let H=v.q.y; let tr=v.q.z; let age=u.cam.w-tr;
  if(u.camU.w>0.5&&u.camU.w<1.5&&v.wp.y<0.0){ discard; }
  let th=hash22(v.id.xy+vec2f(3.3,8.1)); let style=floor(th.x*3.0);       // 0 punched grid, 1 ribbon bands, 2 fins
  let lv=v.wp.y-(top-H); let fl=floor(lv/3.6); let fv=fract(lv/3.6);
  let uu=select(v.wp.z,v.wp.x,abs(n.z)>0.5); let bw=select(3.1,select(6.0,1.6,style>1.5),style>0.5); let bay=floor(uu/bw); let fu=fract(uu/bw);
  let amb=ambSky(); let nv=max(dot(n,V),0.02); let F=0.03+0.97*pow(1.0-nv,5.0); var R=reflect(-V,n); R.y=abs(R.y)+0.01;
  let env=dome(normalize(R),1.0).rgb+starField(normalize(R),u.seg2.y)*0.3;
  var col=vec3f(0.010,0.012,0.016)*amb+env*F*0.9;
  var win=step(0.12,fu)*step(fu,0.88)*step(0.18,fv)*step(fv,0.86);
  if(style>0.5&&style<1.5){ win=step(0.22,fv)*step(fv,0.80)*step(0.04,fu); }
  if(style>1.5){ win=step(0.35,fu)*step(0.10,fv)*step(fv,0.92); }
  win*=step(face,3.5);
  if(win>0.5&&lv>0.0){ let w=winLit(v.id.xy,fl,bay,face,H,tr,v.q.w,lv);
    let floorOn=step(0.30,hash21(vec2f(fl*1.7+v.id.x,v.id.y*3.1+face)));             // whole dark floors
    let warm=mix(vec3f(1.0,0.58,0.26),vec3f(1.0,0.84,0.66),w.y); var wc=mix(warm,vec3f(0.62,0.80,1.0),step(0.80,w.y)); wc=mix(wc,vec3f(0.35,1.0,0.80),step(0.97,w.y));
    let depth=0.45+0.55*sin(fu*PI)*(0.6+0.4*fv); let inten=(0.30+1.5*pow(fract(w.y*7.3),2.0))*floorOn;
    col=col*0.5+wc*w.x*inten*depth+env*F*0.5; }
  else if(face<3.5){ let mull=step(fu,0.05)+step(0.96,fv); col+=vec3f(0.05,0.06,0.08)*amb*mull*0.6+vec3f(1.0,0.7,0.4)*0.004*mull; }
  let wet=exp(-max(age-2.0,0.0)/2.2)*sat(age*3.0); let st=textureSampleLevel(tFoam,sRep,vec2f(uu/9.0,(v.wp.y+u.cam.w*16.0)/60.0),1.0).b;
  let riv=smoothstep(0.80,0.95,textureSampleLevel(tFoam,sRep,vec2f(uu/1.7,(v.wp.y+u.cam.w*22.0)/90.0),0.0).r); col+=vec3f(0.45,0.55,0.62)*amb*wet*riv*0.5+env*wet*0.10;
  if(face>3.5){ let blink=step(0.5,fract(u.cam.w*0.7+v.id.x*0.13)); col+=vec3f(1.0,0.05,0.02)*blink*8.0*smoothstep(0.92,0.98,max(abs(fract(v.wp.x/14.0)-0.5),abs(fract(v.wp.z/14.0)-0.5))*2.0); }
  let dist=distance(u.cam.xyz,v.wp); col=mix(col,(fogColor(-V)*0.6+vec3f(0.022,0.015,0.010)*u.seg2.y)*(1.0-u.seg2.w),1.0-exp(-dist*u.sky.z*2.6));
  return vec4f(max(col,vec3f(0.0))*(1.0-u.seg2.w),1.0);
}
// water pouring off the roofs while a tower rises (real gravity, so it falls 4.9 t^2)
@vertex fn vsCascade(@builtin(vertex_index) vi:u32,@builtin(instance_index) ii:u32)->PO {
  var o:PO; let c=QS[vi]; let cell=ii/192u; let kk=ii%192u; let ij=vec2i(i32(cell%CITYNX_C)-i32(CITYNX_C/2u),i32(cell/CITYNX_C)); let T=towerAt(ij);
  if(T.ok<0.5){ o.pos=vec4f(0,0,-9,1); return o; }
  let pk=kk%48u; let m=kk/48u; let h=hash33(vec3f(f32(ii),3.0,7.0)); let te=T.tr+f32(m)*0.55+h.x*0.5; let a=u.cam.w-te;
  if(a<0.0||a>3.0||te>T.tr+2.3){ o.pos=vec4f(0,0,-9,1); return o; }
  let ke=sat((te-T.tr)/2.4); let topE=T.H*(1.0-pow(1.0-ke,3.0));
  let side=pk/12u; let s=(f32(pk%12u)+h.y)/12.0; var e:vec2f; var nn:vec2f;
  if(side==0u){ e=vec2f(T.hw.x,mix(-T.hw.y,T.hw.y,s)); nn=vec2f(1,0); } else if(side==1u){ e=vec2f(-T.hw.x,mix(-T.hw.y,T.hw.y,s)); nn=vec2f(-1,0); } else if(side==2u){ e=vec2f(mix(-T.hw.x,T.hw.x,s),T.hw.y); nn=vec2f(0,1); } else { e=vec2f(mix(-T.hw.x,T.hw.x,s),-T.hw.y); nn=vec2f(0,-1); }
  let out=(2.5+4.0*h.z)*a; let p=vec3f(T.c.x+e.x+nn.x*out,topE-4.9*a*a,T.c.y+e.y+nn.y*out);
  if(p.y<0.5){ o.pos=vec4f(0,0,-9,1); return o; }
  let sz=1.2+2.6*a+1.5*h.y; let dist=distance(p,u.cam.xyz); o.mi=vec4f(0.30*smoothstep(4.0,25.0,dist)*(1.0-smoothstep(2.0,3.0,a)),h.x,h.y,sz*0.10); o.uv=c; o.wp=p;
  o.pos=u.vp*vec4f(p+(u.camR.xyz*c.x+u.camU.xyz*c.y)*sz,1.0); return o;
}
// window lights that let go when gravity flips, and fall up
fn lanternPos(ii:u32,t:f32,ok:ptr<function,bool>)->vec4f {
  let cell=ii/160u; let kk=ii%160u; let ij=vec2i(i32(cell%CITYNX_C)-i32(CITYNX_C/2u),i32(cell/CITYNX_C)); let T=towerAt(ij);
  *ok=T.ok>0.5; let hk=hash33(vec3f(f32(ii),1.0,5.0)); let face=f32(kk%4u); let H=T.H;
  let fl=floor(hk.x*max(H/3.6-1.0,1.0)); let lv=(fl+0.5)*3.6; var uu=0.0; var wp:vec3f; let base=T.top-H;
  let along=(hk.y*2.0-1.0); let hwx=T.hw.x; let hwy=T.hw.y;
  if(face<0.5){ wp=vec3f(hwx+0.6,0.0,along*hwy); uu=T.c.y+along*hwy; } else if(face<1.5){ wp=vec3f(-hwx-0.6,0.0,along*hwy); uu=T.c.y+along*hwy; } else if(face<2.5){ wp=vec3f(along*hwx,0.0,hwy+0.6); uu=T.c.x+along*hwx; } else { wp=vec3f(along*hwx,0.0,-hwy-0.6); uu=T.c.x+along*hwx; }
  let bay=floor(uu/3.1); let w=winLit(vec2f(ij),fl,bay,face,H,T.tr,T.tl,lv); let h=hash33(vec3f(f32(ij.x)*7.0+face*131.0+bay*0.37,fl+f32(ij.y)*3.1,bay*1.7+face));
  let rel=T_GRAV_C+0.1+2.6*h.z; if(h.x<0.60){ *ok=false; }
  let emo=T.tr+2.4*(1.0-pow(clamp(lv/max(H,1.0),0.0,1.0),0.3333))+0.35+0.9*h.y; if(emo>rel){ *ok=false; }
  let dt=max(t-rel,0.0); let a=u.city.z*(2.2+1.4*hk.z);
  var p=vec3f(T.c.x,base+lv+T.lift*0.0,T.c.y)+wp; p.y=min(p.y, base+lv);
  let rise=0.5*a*dt*dt; p.y+=rise;
  // the river of light converges on one axis as it climbs, and turns
  let ax=vec2f(u.city.x,u.city.y+700.0); let k=smoothstep(60.0,1400.0,rise); let rel2=p.xz-ax; let an=rise*0.0011+dt*0.25; let ca=cos(an); let sa=sin(an);
  let rr=vec2f(rel2.x*ca-rel2.y*sa,rel2.x*sa+rel2.y*ca)*mix(1.0,0.10,k); p=vec3f(ax.x+rr.x,p.y,ax.y+rr.y);
  return vec4f(p,select(0.0,1.0-0.92*k,t>rel));
}
@vertex fn vsLantern(@builtin(vertex_index) vi:u32,@builtin(instance_index) ii:u32)->PO {
  var o:PO; let c=QS[vi]; var ok=true; let L=lanternPos(ii,u.cam.w,&ok);
  if(!ok||L.w<0.01||u.gal2.y>0.16){ o.pos=vec4f(0,0,-9,1); return o; }
  let h=hash33(vec3f(f32(ii),2.0,8.0)); let warm=mix(vec3f(1.0,0.62,0.30),vec3f(1.0,0.86,0.70),h.y); let dist=distance(L.xyz,u.cam.xyz);
  let sz=max(0.9+0.9*h.x,dist*0.0012); o.mi=vec4f(warm*(3.0+3.0*h.z)*min(1.0,(0.9+0.9*h.x)/sz*1.2)*smoothstep(3.0,25.0,dist)*L.w*(1.0-smoothstep(0.06,0.15,u.gal2.y))*mix(1.0,0.25,sin(PI*sat(u.seg.w/2.8))),1.0); o.uv=c; o.wp=L.xyz;
  o.pos=u.vp*vec4f(L.xyz+(u.camR.xyz*c.x+u.camU.xyz*c.y)*sz,1.0); return o;
}
@fragment fn fsSpray2(v:PO)->@location(0) vec4f {
  let r=length(v.uv); if(r>1.0){discard;} let V=normalize(u.cam.xyz-v.wp); let nz=textureSampleLevel(tFoam,sRep,v.uv*0.11+v.mi.yz*7.0,0.0);
  let a=pow(1.0-r,1.4)*smoothstep(0.30,0.75,nz.b+0.25*(nz.r-0.5))*v.mi.x*0.55; let amb=ambSky();
  let c=amb*vec3f(0.55,0.62,0.72)*1.2+vec3f(1.0,0.72,0.45)*0.012; return vec4f(c*a,a);
}
@fragment fn fsGlow(v:PO)->@location(0) vec4f { let r2=dot(v.uv,v.uv); if(r2>1.0){discard;} let k=exp(-r2*6.0)+0.08*exp(-r2*1.5); return vec4f(v.mi.rgb*k*v.mi.w,0.0); }
// the sea lets go too: drops and blobs falling upward
@vertex fn vsRainUp(@builtin(vertex_index) vi:u32,@builtin(instance_index) ii:u32)->PO {
  var o:PO; let c=QS[vi]; let side=400u; let cell=3.0; let id=vec2f(f32(ii%side),f32(ii/side))-vec2f(200.0,40.0)+floor(u.cam.xz/cell);
  let h=hash22(id); let h2=hash22(id+17.0); let t0=T_GRAV_C+0.2+2.8*h.x; let dt=u.cam.w-t0; if(dt<0.0||u.seg2.w>0.9){ o.pos=vec4f(0,0,-9,1); return o; }
  let big=step(0.985,h2.y); let p=vec3f((id.x+h2.x)*cell,0.5*u.city.z*(0.7+0.8*h2.y)*dt*dt+0.3,(id.y+h.y)*cell);
  let dist=distance(p,u.cam.xyz); let sz=mix(0.10+0.12*h2.x,1.2+2.5*h.y,big); let px=max(sz,dist*0.0011);
  o.mi=vec4f(mix(vec3f(0.55,0.62,0.75),vec3f(1.0,0.8,0.6),0.35)*0.45*min(1.0,sz/px)*(1.0-smoothstep(200.0,320.0,dist)),1.0); o.uv=c; o.wp=p;
  o.pos=u.vp*vec4f(p+(u.camR.xyz*c.x+u.camU.xyz*c.y)*px,1.0); return o;
}

// ---------------------------------------------------------------- 4. time.scale: the lights become stars, the stars a galaxy; collapse() pulls it into one point
fn galPos(i:u32,ok:ptr<function,f32>)->vec4f { // xyz world, w brightness
  let h=hash33(vec3f(f32(i)*0.013,f32(i%977u),7.0)); let h2=hash33(vec3f(f32(i%613u),f32(i)*0.007,3.0)); let h3=hash33(vec3f(f32(i)*0.017,1.0,f32(i%331u)));
  var rn:f32; var th:f32; var hy:f32; var br=1.0;
  if(h.x<0.13){ rn=0.16*pow(h.y,1.6); th=h.z*6.2832; hy=(h2.x-0.5)*0.22*(1.0-rn*3.0); br=1.6; }
  else { rn=min(-0.30*log(1.0-h.y*0.96)+0.04,1.25); let arm=select(0.0,PI,h2.y>0.5); let inArm=step(h3.x,0.74); th=arm+log(rn+0.05)*4.4+(h2.z-0.5)*mix(6.28,0.95*(0.35+rn),inArm); hy=(h3.y-0.5)*0.028*(1.0+rn); br=mix(0.55,1.3,inArm);
    if(h3.z<0.30&&rn>0.12){ let ci=floor(h3.z*1300.0); let ch=hash33(vec3f(ci,3.0,9.0)); let cr=0.15+0.85*ch.x; let ct=select(0.0,PI,ch.y>0.5)+log(cr+0.05)*4.4+(ch.z-0.5)*0.5; rn=cr+(h2.x-0.5)*0.035; th=ct+(h.z-0.5)*0.06/max(cr,0.1); br=1.8; } }
  th+=u.gal2.x*(0.12+0.05/max(rn,0.10));
  let c=u.seg2.x; let rn2=rn*(1.0-c); th+=6.0*c/(1.04-c); hy*=1.0-c;
  *ok=br; return vec4f(u.gal.xyz+u.gal.w*vec3f(cos(th)*rn2,hy,sin(th)*rn2),rn);
}
@vertex fn vsStar(@builtin(vertex_index) vi:u32,@builtin(instance_index) ii:u32)->PO {
  var o:PO; let c=QS[vi]; var br=1.0; let G=galPos(ii,&br); var p=G.xyz; var vis=u.gal2.z;
  if(ii<NLANT){ var ok=true; let L=lanternPos(ii,u.cam.w,&ok); if(ok&&L.w>0.01){ p=mix(L.xyz,G.xyz,u.gal2.y); vis=mix(L.w,1.0,u.gal2.y)*smoothstep(0.05,0.15,u.gal2.y); } }
  let h=hash33(vec3f(f32(ii)*0.031,5.0,f32(ii%101u))); let rn=G.w; var lant=0.0; if(ii<NLANT){ lant=1.0-u.gal2.y; }
  var col=mix(vec3f(0.62,0.74,1.0),vec3f(1.0,0.82,0.58),smoothstep(0.05,0.35,0.45-rn+h.x*0.3)); col=mix(col,vec3f(1.0,0.35,0.55),step(0.985,h.y)*step(0.15,rn));
  let bright=br*(0.25+3.5*pow(h.z,9.0))*(1.0+3.0*u.seg2.x)*0.55;
  let dist=distance(p,u.cam.xyz); let pxw=dist*2.0*tan(u.camF.w*0.5)/u.res.y; let sz=max(u.gal.w*0.00045*(0.5+h.x),pxw*1.15);
  let k=min(1.0,u.gal.w*0.00045*(0.5+h.x)/sz); let fade=1.0-smoothstep(44.55,44.95,u.cam.w);
  let hl=hash33(vec3f(f32(ii),2.0,8.0)); let lc=mix(vec3f(1.0,0.62,0.30),vec3f(1.0,0.86,0.70),hl.y)*(3.0+3.0*hl.z); let lsz=max(0.9+0.9*hl.x,pxw);
  var mcol=col*bright*k*k; if(lant>0.0){ mcol=mix(mcol,lc*min(1.0,(0.9+0.9*hl.x)/lsz*1.2),lant*select(0.0,1.0,vis>0.009))*(1.0-0.85*sin(PI*u.gal2.y)); }
  let szf=mix(sz,lsz,lant*select(0.0,1.0,vis>0.009));
  let dcg=distance(u.cam.xyz,u.gal.xyz)/u.gal.w; let thru=sin(PI*sat(u.seg.w/2.8)); let dens=mix(1.0,clamp(dcg*dcg*0.30,0.035,1.0),u.gal2.y)*mix(1.0,0.07,thru)*smoothstep(4.0,70.0,dist);
  o.mi=vec4f(mcol*vis*fade*dens*select(1.0,0.0,u.seg.w<0.0),1.0); o.uv=c; o.wp=p;
  if(ii==0u){ // the core, which is the last thing left: one point
    let core=u.gal.xyz; let pc=dist*0.0; let s2=mix(u.gal.w*0.06,pxw*2.2,smoothstep(43.0,44.9,u.cam.w));
    o.mi=vec4f(vec3f(1.0,0.92,0.82)*(3.0+30.0*u.seg2.x)*u.gal2.z*select(1.0,0.0,u.seg.w<0.0)*(1.0-smoothstep(45.9,46.15,u.cam.w)),1.0); o.wp=core;
    o.pos=u.vp*vec4f(core+(u.camR.xyz*c.x+u.camU.xyz*c.y)*s2+pc,1.0); return o; }
  o.pos=u.vp*vec4f(p+(u.camR.xyz*c.x+u.camU.xyz*c.y)*szf,1.0); if(o.mi.x+o.mi.y<1e-5){ o.pos=vec4f(0,0,-9,1); } return o;
}
@vertex fn vsDust(@builtin(vertex_index) vi:u32,@builtin(instance_index) ii:u32)->PO {
  var o:PO; let c=QS[vi]; let h=hash33(vec3f(f32(ii)*0.021,9.0,f32(ii%457u))); let h2=hash33(vec3f(f32(ii%389u),f32(ii)*0.011,2.0));
  let rn=0.12+0.75*pow(h.x,0.8); let arm=select(0.0,PI,h.y>0.5); var th=arm+log(rn+0.05)*4.4-0.16+(h2.x-0.5)*0.22; th+=u.gal2.x*(0.12+0.05/max(rn,0.10));
  let cc=u.seg2.x; th+=6.0*cc/(1.04-cc); let r2=rn*(1.0-cc);
  let p=u.gal.xyz+u.gal.w*vec3f(cos(th)*r2,(h2.y-0.5)*0.012,sin(th)*r2); let sz=u.gal.w*(0.006+0.012*h2.z);
  o.mi=vec4f(vec3f(0.006,0.005,0.005),0.035*u.gal2.z*(1.0-cc)*select(1.0,0.0,u.seg.w<0.0)); o.uv=c; o.wp=p; o.pos=u.vp*vec4f(p+(u.camR.xyz*c.x+u.camU.xyz*c.y)*sz,1.0); return o;
}
@fragment fn fsDust(v:PO)->@location(0) vec4f { let r2=dot(v.uv,v.uv); if(r2>1.0){discard;} let n=textureSampleLevel(tFoam,sRep,v.uv*0.2+v.wp.xz*0.0003,0.0).b; let a=v.mi.w*exp(-r2*2.5)*smoothstep(0.3,0.7,n); return vec4f(v.mi.rgb*a,a); }
