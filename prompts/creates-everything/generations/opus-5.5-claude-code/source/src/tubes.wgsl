// Ribs, columns, tracery: tubes laid in the sheet's own (z,s,height) coordinates, so they are born with it.
override ALONG : u32 = 24; override RING : u32 = 8; override FIRST : u32 = 0; override PER : u32 = 1;
struct TO { @builtin(position) pos:vec4f, @location(0) wp:vec3f, @location(1) n:vec3f, @location(2) mi:vec4f };
fn tubePos(q:f32,inst:u32,a:vec4f,b:vec4f,bayZ:f32)->vec3f { let z=mix(a.x,a.z,q)+bayZ; let s=mix(a.y,a.w,q); let o=baseSurf(s,z); return o.p+o.n*b.z; }
fn tubeVS(vi:u32,ii:u32,m:mat4x4f)->TO {
  var v:TO; let bay=ii/PER; let k=ii%PER; let bayZ=(floor(u.cam.z/BAY)-2.0+f32(bay))*BAY;
  let a=tubes[(FIRST+k)*2u]; let b=tubes[(FIRST+k)*2u+1u];
  let tri=vi%6u; let cell=vi/6u; let ai=cell%ALONG; let ri=cell/ALONG;
  let ca=array<vec2u,6>(vec2u(0,0),vec2u(1,0),vec2u(1,1),vec2u(0,0),vec2u(1,1),vec2u(0,1)); let c=ca[tri];
  var q=f32(ai+c.x)/f32(ALONG); let an=f32(ri+c.y)/f32(RING)*2.0*PI;
  let zc=mix(a.x,a.z,0.5)+bayZ; let sc=mix(a.y,a.w,0.5); let sy=min(sc,236.0-sc); // symmetric height order: ribs climb both walls
  let g=u.fr.y*sat((u.fr.x-zc-sy*0.30)/34.0); let gl=1.0-pow(1.0-g,3.0); let over=1.0+0.9*sin(g*PI)*(1.0-g);
  q=q*gl; let e=0.02;
  if(g<=0.001||bayZ+a.x>u.fr.z-1.0||zc>u.fr.z-0.2){ v.pos=vec4f(0,0,-9,1); v.wp=vec3f(0); v.n=vec3f(0,1,0); v.mi=vec4f(0); return v; }
  let p0=tubePos(q,ii,a,b,bayZ); let p1=tubePos(q+e,ii,a,b,bayZ); let z=mix(a.x,a.z,q)+bayZ; let s=mix(a.y,a.w,q);
  let T=normalize(p1-p0); let o=baseSurf(s,z); let B=normalize(cross(T,o.n)); let N=cross(B,T);
  let r=mix(b.x,b.y,q)*over*smoothstep(0.0,0.10,gl); let dir=B*cos(an)+N*sin(an);
  // moulded section: a pointed roll rather than a pipe
  let prof=1.0+0.16*cos(an*2.0)+0.10*cos(an*6.0);
  v.wp=p0+dir*r*prof; v.n=dir; v.mi=vec4f(g,b.w,q,r); v.pos=m*vec4f(v.wp,1.0); return v;
}
@vertex fn vsTube(@builtin(vertex_index) vi:u32,@builtin(instance_index) ii:u32)->TO { return tubeVS(vi,ii,u.vp); }
@vertex fn vsTubeSh(@builtin(vertex_index) vi:u32,@builtin(instance_index) ii:u32)->TO { return tubeVS(vi,ii,u.svp); }

// crystal spikes riding the freeze front
@vertex fn vsSpike(@builtin(vertex_index) vi:u32,@builtin(instance_index) ii:u32)->TO {
  var v:TO; let row=ii/36u; let col=ii%36u; let dz=1.4; let zi=floor((u.fr.x-105.0)/dz)+f32(row); let h=hash33(vec3f(zi,f32(col),3.0)); let h2=hash33(vec3f(f32(col),zi,9.0));
  let z=(zi+h.x)*dz; let s=8.0+(f32(col)+h.y)*4.0; let o=baseSurf(s,z); let d=(u.fr.x+frontNoise(s,z)-z);
  let g=sat(d/7.0)*(1.0-smoothstep(16.0,88.0,d))*u.fr.y*(1.0-step(u.fr.z-1.0,z)); let len=g*(0.5+6.0*pow(h.z,5.0)); let r=len*0.055+0.015*g;
  let dirv=normalize(o.n+o.ts*(h2.x-0.5)*1.1+vec3f(0,0,1)*(h2.y-0.15)*1.5);
  let ax=normalize(cross(dirv,vec3f(0.3,0.5,0.8))); let ay=cross(dirv,ax);
  let f=vi/3u; let k=vi%3u; let an0=f32(f)/6.0*2.0*PI; let an1=f32(f+1u)/6.0*2.0*PI;
  var p=o.p; if(k==0u){ p+=(ax*cos(an0)+ay*sin(an0))*r; } else if(k==1u){ p+=(ax*cos(an1)+ay*sin(an1))*r; } else { p+=dirv*len; }
  let am=0.5*(an0+an1); v.n=normalize(ax*cos(am)+ay*sin(am)+dirv*0.12); v.wp=p; v.mi=vec4f(0.6,9.0,f32(k/2u),g); v.pos=u.vp*vec4f(p,1.0); if(g<0.002){v.pos=vec4f(0,0,-9,1);} return v;
}
fn ggx2(nh:f32,a2:f32)->f32 { let d=nh*nh*(a2-1.0)+1.0; return a2/(PI*d*d); }
@fragment fn fsTube(v:TO)->@location(0) vec4f {
  if(u.camU.w>0.5 && u.camU.w<1.5 && v.wp.y<0.02){ discard; }
  let V=normalize(u.cam.xyz-v.wp); var n=normalize(v.n); let L=u.sun.xyz; if(dot(n,V)<0.0){ n=normalize(n-V*dot(n,V)*1.02); }
  let nv=max(dot(n,V),0.03); let F=0.045+0.955*pow(1.0-nv,5.0);
  let sh=shadowAt(v.wp+n*0.35,(u.jit.xy-0.5)*0.0012); let amb=domeRaw(vec3f(0.1,0.95,0.2),6.0).rgb*u.sun.w;
  let env=naveEnv(v.wp+n*0.05,reflect(-V,n)); let rd=refract(-V,n,1.0/1.42); let thru=naveEnv(v.wp+n*0.05,rd);
  let nl=sat(dot(n,L)); let wrap=sat(dot(n,L)*0.5+0.5);
  let tint=vec3f(0.80,0.95,0.97);
  var col=thru*tint*0.95*(0.30+0.70*nv)+vec3f(0.55,0.66,0.80)*amb*(0.05+0.10*sat(n.y*0.5+0.5))+vec3f(0.5,0.7,0.9)*pow(1.0-nv,2.0)*amb*0.22+vec3f(0.85,0.95,1.0)*sh*u.sunC.rgb*(nl*0.30+pow(wrap,3.0)*0.05);
  col=col*(1.0-F)+env*F*1.1;
  let H=normalize(V+L); col+=u.sunC.rgb*sh*min(ggx2(sat(dot(n,H)),0.006),30.0)*0.05*F*4.0;
  col+=vec3f(0.35,0.85,1.0)*pow(1.0-v.mi.x,3.0)*1.5*step(0.001,v.mi.x);
  if(v.mi.y>8.5){ col=thru*vec3f(0.6,0.95,1.0)*0.9+env*F+skyThrough(rd,3.0)*0.22+vec3f(0.25,0.7,0.85)*(0.15+0.9*pow(v.mi.z,3.0))*0.12*dot(u.sunC.rgb,vec3f(1.0)); }
  let dist=distance(u.cam.xyz,v.wp); let fog=1.0-exp(-dist*u.sky.z*0.15); col=mix(col,fogColor(-V),fog);
  return vec4f(max(col,vec3f(0.0)),1.0);
}

// ---------------- the rose window, made of shards from the start so it can break
struct RO { @builtin(position) pos:vec4f, @location(0) wp:vec3f, @location(1) n:vec3f, @location(2) q:vec2f, @location(3) br:f32 };
fn roseVS(vi:u32)->RO {
  var v:RO; let cell=vi/6u; let k=vi%6u; let c=vec2f(f32(cell%144u),f32(cell/144u)); let flip=hash21(c)>0.5;
  var o=array<vec2f,6>(vec2f(0,0),vec2f(1,0),vec2f(1,1),vec2f(0,0),vec2f(1,1),vec2f(0,1)); if(flip){ o=array<vec2f,6>(vec2f(0,0),vec2f(1,0),vec2f(0,1),vec2f(1,0),vec2f(1,1),vec2f(0,1)); }
  let me=roseVert(c+o[k]); let bird=isBirdCell(c); let t=u.cam.w;
  if(u.fr.y<0.5||u.fr.w>4.5||(bird&&t>=T_FLY_C)){ v.pos=vec4f(0,0,-9,1); return v; }
  let sd=shardDyn(c,t,bird); let rot=rotA(vec3f(me-sd.mid,0.0),sd.ax,sd.an);
  v.n=rotA(vec3f(0.0,0.0,-1.0),sd.ax,sd.an); v.wp=vec3f(sd.mid,u.fr.z)+rot+sd.off; v.q=me; v.br=smoothstep(0.0,0.05,sd.tt); v.pos=u.vp*vec4f(v.wp,1.0); return v;
}
@fragment fn fsRose(v:RO,@builtin(front_facing) ff:bool)->@location(0) vec4f {
  let p=v.q; let W=u.nave.x; let HW=u.nave.y; let GR=u.nave.z; if(abs(p.x)>W||p.y<0.0){ discard; } if(p.y>HW){ if(length(vec2f(abs(p.x)+(GR-W),p.y-HW))>GR){ discard; } }
  let born=u.fr.y*sat((u.fr.x-u.fr.z-length(p-vec2f(0.0,30.0))*1.2)/30.0); if(born<0.01){ discard; }
  if(u.camU.w>0.5&&u.camU.w<1.5&&v.wp.y<0.02){ discard; }
  let V=normalize(u.cam.xyz-v.wp); var n=normalize(v.n); if(dot(n,V)<0.0){n=-n;} let L=u.sun.xyz; let g=roseAt(p);
  if(v.br>0.02&&u.camU.w<0.5){ let nvv=abs(dot(normalize(v.n),V)); let opa=mix(1.0,0.22+0.75*pow(1.0-nvv,3.0)+0.6*step(0.9,g.a),v.br); if(ign(v.pos.xy,u.res.z*7.0+floor(u.jit.x*61.0))>opa){ discard; } } let e=0.10; let sx=roseAt(p+vec2f(e,0)).a-roseAt(p-vec2f(e,0)).a; let sy=roseAt(p+vec2f(0,e)).a-roseAt(p-vec2f(0,e)).a;
  let gn=normalize(n+vec3f(-sx,-sy,0.0)*0.8); let amb=domeRaw(vec3f(0.1,0.95,0.2),6.0).rgb*u.sun.w;
  let trans=g.rgb*(skyThrough(-V+vec3f(hash22(floor(p*2.0))-0.5,0.0)*0.10,2.2)*1.9+u.sunC.rgb*(0.10+0.12*sat(L.z)));
  let env=naveEnv(v.wp+vec3f(0,0,-0.2),reflect(-V,gn)); let stone=vec3f(0.30,0.36,0.38)*(amb*0.35)+env*0.30+vec3f(0.03,0.04,0.05)*amb;
  var col=mix(trans,stone,g.a); let F=0.04+0.96*pow(1.0-max(dot(n,V),0.0),5.0);
  let rfl=reflect(-V,n); let outside=dome(normalize(vec3f(rfl.x,abs(rfl.y)+0.01,rfl.z)),1.0).rgb; let rrf=refract(-V,n,1.0/1.45); let seen=dome(normalize(vec3f(rrf.x,abs(rrf.y)+0.01,rrf.z)),0.5).rgb+u.sunC.rgb*(hg(sat(dot(rrf,L)),0.97)*0.12+hg(sat(dot(-V,L)),0.55)*0.55); let edge2=pow(1.0-max(dot(n,V),0.0),2.0);
  col=mix(col,mix(g.rgb,vec3f(0.80,0.92,0.97),0.55)*seen*0.9*(1.0-edge2*0.5)*(1.0-0.75*step(0.96,g.a))+outside*(F*1.2+0.05)+u.sunC.rgb*pow(sat(dot(reflect(-V,n),L)),300.0)*6.0,v.br);
  let H=normalize(V+L); col+=u.sunC.rgb*min(ggx2(sat(dot(n,H)),0.0009),120.0)*0.03*v.br;
  col+=vec3f(0.45,0.9,1.0)*pow(1.0-born,2.0)*1.5;
  return vec4f(max(col,vec3f(0.0)),1.0);
}

@vertex fn vsRose(@builtin(vertex_index) vi:u32)->RO { return roseVS(vi); }
@vertex fn vsRoseSh(@builtin(vertex_index) vi:u32)->RO { var v=roseVS(vi); v.pos=u.svp*vec4f(v.wp,1.0); if(u.fr.y<0.5){ v.pos=vec4f(0,0,-9,1); } return v; }
@fragment fn fsRoseSh(v:RO)->@location(0) vec4f { let g=roseAt(v.q); let born=u.fr.y*sat((u.fr.x-u.fr.z-length(v.q-vec2f(0.0,30.0))*1.2)/30.0); let W=u.nave.x; let HW=u.nave.y; let GR=u.nave.z; if(abs(v.q.x)>W||(v.q.y>HW&&length(vec2f(abs(v.q.x)+(GR-W),v.q.y-HW))>GR)){ discard; } return vec4f(mix(vec3f(1.0),g.rgb*(1.0-g.a*0.97)*1.6,born),1.0); }
// ---------------- spray / hanging droplets: instanced sprites

@vertex fn vsSpray(@builtin(vertex_index) vi:u32,@builtin(instance_index) ii:u32)->PO {
  var v:PO; let c=array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(1,1),vec2f(-1,-1),vec2f(1,1),vec2f(-1,1))[vi];
  let side=400u; let gx=f32(ii%side); let gz=f32(ii/side); let cell=1.5; let org=floor(u.cam.xz/cell)+floor(u.camF.xz*95.0/cell);
  let id=vec2f(gx,gz)-f32(side)*0.5+org; let h=hash22(id); let h2=hash22(id+57.0); let life=1.3+1.2*h2.x; let ph=fract(u.misc.y/life+h.x); let t0=floor(u.misc.y/life+h.x);
  let q0=(id+hash22(id+t0*7.7))*cell; let m=sat(u.wave.x*1.4);
  var b=baseSurf(q0.x,q0.y); var d=seaDisp(vec2f(q0.x-flowS(q0.x),q0.y),1.5,mix(1.0,0.1,waveMask(q0.x)*m)); let ring=ringAt(b.p.x,q0.y);
  var src=smoothstep(0.38,0.95,d.w*u.flow.y*ring.y+ring.z*1.6);
  let lipK=smoothstep(118.0,140.0,q0.x)*(1.0-smoothstep(153.0,160.0,q0.x))*smoothstep(0.4,0.8,b.st); src=max(src,lipK*0.8); let imp=exp(-pow(abs(q0.x+25.0)/7.0,2.0))*smoothstep(0.8,1.0,b.st)*(1.0-step(1.05,b.st)); src=max(src,imp);
  let frozen=u.fr.y*0.0; let age=ph*life; let wind=vec3f(-u.sun.x,0.0,-u.sun.z)*(9.0+9.0*h2.y);
  var p=b.p+b.ts*d.x*u.flow.y*ring.y+b.n*d.y*u.flow.y*ring.y+vec3f(0,ring.x,0); p+=vec3f(0.0,ring.z*age*16.0*h2.x,0.0)+wind*age*0.9+vec3f(h.y-0.5,0.0,h2.x-0.5)*age*3.0+vec3f(0,(2.0+7.0*h.x*(0.4+src))*age-3.2*age*age,0)+b.n*lipK*age*5.0;
  let fz=freezeAt(q0.x,q0.y);
  p+=vec3f(1.5,5.0*h2.x,0.0)*imp*age; let sz=(0.14+0.70*h2.y*h2.y+age*1.9*(0.5+ring.z*1.2+imp*1.1))*step(0.02,src)*(1.0-sat(fz*6.0)); let fade=sin(ph*PI)*src;
  let dist=distance(p,u.cam.xyz); v.mi=vec4f(fade*smoothstep(1.5+20.0*ring.z,6.0+50.0*ring.z,dist)*(1.0-smoothstep(260.0,300.0,dist)),h.x,h2.x,sz); v.uv=c; v.wp=p;
  let wp=p+(u.camR.xyz*c.x+u.camU.xyz*c.y)*sz; v.pos=u.vp*vec4f(wp,1.0); if(sz<0.01||v.mi.x<0.004){v.pos=vec4f(0,0,-9,1);} return v;
}
@fragment fn fsSpray(v:PO)->@location(0) vec4f {
  let r=length(v.uv); if(r>1.0){discard;} let V=normalize(u.cam.xyz-v.wp); let nz=textureSampleLevel(tFoam,sRep,v.uv*0.11+v.mi.yz*7.0,0.0);
  var a=pow(1.0-r,1.4)*smoothstep(0.30,0.75,nz.b+0.25*(nz.r-0.5))*v.mi.x*0.42*exp(-v.mi.w*0.18);
  let amb=domeRaw(vec3f(0.1,0.95,0.2),6.0).rgb*u.sun.w; let ph=hg(sat(dot(-V,u.sun.xyz)),0.45)*0.6+0.06; let c=u.sunC.rgb*ph*0.30*mix(1.0,0.25,u.flow.w)+amb*vec3f(0.80,0.92,1.05)*0.85;
  return vec4f(c*a,a);
}
// the detonation: water thrown ballistically out of the point where the cursor was
@vertex fn vsBurst(@builtin(vertex_index) vi:u32,@builtin(instance_index) ii:u32)->PO {
  // water torn off the crown's rim and the column under the sun, thrown ballistically
  var v:PO; let c=array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(1,1),vec2f(-1,-1),vec2f(1,1),vec2f(-1,1))[vi]; let f=f32(ii); let h=hash33(vec3f(f,3.0,1.0)); let h2=hash33(vec3f(f,8.0,4.0));
  let T=u.gal2.w; let th=h.x*2.0*PI; var p:vec3f; var sz:f32; var al:f32; let plume=f<5000.0;
  if(plume){ let te=h2.x*0.25; let a=max(T-te,0.0); let jet=pow(vnoise(vec2f(th*5.0,1.0))*0.7+vnoise(vec2f(th*17.0,4.0))*0.3,2.0)*2.0; let up=(560.0+380.0*jet)*(1.0-exp(-a*3.6))*pow(h.z,0.7);
    p=vec3f(u.birth.x,0.0,u.birth.y)+vec3f(sin(th),0.0,cos(th))*(6.0+h.y*30.0+a*(12.0+40.0*h.y))+vec3f(0.0,up-55.0*a*a,0.0); sz=(6.0+12.0*h2.y)*(1.0+1.2*a); al=0.35*smoothstep(0.0,0.05,a)*(1.0-smoothstep(0.5,1.9,a)); }
  else { let te=pow(h2.x,1.5)*1.6; let a=T-te; if(a<0.0){ v.pos=vec4f(0,0,-9,1); return v; }
    let R=ringRw(te); let H=crownHw(te); let rr=max(R*0.28,5.0)+3.0+H*0.32; let fing=vnoise(vec2f(th*10.19,1.3));
    let p0=vec3f(u.birth.x+sin(th)*rr,H*(0.88+0.16*fing),u.birth.y+cos(th)*rr); let vo=30.0+110.0*h.y; let vu=10.0+90.0*h.z*h.z;
    let drag=(1.0-exp(-a*1.4))/1.4; p=p0+vec3f(sin(th),0.0,cos(th))*vo*drag+vec3f((h2.y-0.5)*20.0,vu,(h2.z-0.5)*20.0)*drag-vec3f(0.0,22.0*a*a,0.0);
    let big=step(0.97,h2.y); sz=mix(0.5+1.8*h2.z,2.5+4.0*h2.z,big)*(1.0+a*0.6); al=mix(2.0,0.35,big)*smoothstep(0.0,0.06,a)*(1.0-smoothstep(1.2,2.2,a))*step(0.3,p.y); }
  let dist=distance(p,u.cam.xyz); v.mi=vec4f(al*smoothstep(25.0,110.0,dist)*step(0.0,T),h.x,h2.x,select(sz*0.25,2.0,plume)); v.uv=c; v.wp=p;
  let wp=p+(u.camR.xyz*c.x+u.camU.xyz*c.y)*sz; v.pos=u.vp*vec4f(wp,1.0); if(v.mi.x<0.004){v.pos=vec4f(0,0,-9,1);} return v; }
// droplets hanging in frozen time
@vertex fn vsDrop(@builtin(vertex_index) vi:u32,@builtin(instance_index) ii:u32)->PO {
  var v:PO; let c=array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(1,1),vec2f(-1,-1),vec2f(1,1),vec2f(-1,1))[vi];
  let f=f32(ii); let h=hash33(vec3f(f,1.0,2.0)); let h2=hash33(vec3f(f,5.0,9.0)); let span=170.0; let zc=u.cam.z+60.0; var z=h.x*span; z=z+floor((zc-z)/span+0.5)*span;
  let p=vec3f((h.y-0.5)*30.0,1.5+h.z*34.0,z)+vec3f(sin(u.cam.w*0.7+f),cos(u.cam.w*0.5+f*1.3)*0.6-0.25*u.cam.w,0.0)*0.35; let g=u.fr.y*sat((u.fr.x-z)/20.0)*u.misc.w*(1.0-step(u.fr.z,z));
  let sz=(0.018+0.10*pow(h2.x,6.0))*g; let dist=distance(p,u.cam.xyz); v.mi=vec4f(smoothstep(0.8,3.0,dist),h2.x,h2.y,sz); v.uv=c; v.wp=p;
  let wp=p+(u.camR.xyz*c.x+u.camU.xyz*c.y)*sz; v.pos=u.vp*vec4f(wp,1.0); if(sz<0.002){v.pos=vec4f(0,0,-9,1);} return v;
}
@fragment fn fsDrop(v:PO)->@location(0) vec4f {
  let r2=dot(v.uv,v.uv); if(r2>1.0){discard;} let z=sqrt(1.0-r2); let V=normalize(u.cam.xyz-v.wp); let n=normalize(u.camR.xyz*v.uv.x+u.camU.xyz*v.uv.y+V*z);
  let nv=max(dot(n,V),0.03); let F=0.04+0.96*pow(1.0-nv,5.0); let sh=shadowAt(v.wp,vec2f(0.0)); let env=naveEnv(v.wp,reflect(-V,n)); let thru=naveEnv(v.wp,refract(-V,n,1.0/1.5));
  let H=normalize(V+u.sun.xyz); var col=thru*(1.0-F)*0.9+env*F*1.0+sh*u.sunC.rgb*(min(ggx2(sat(dot(n,H)),0.004),60.0)*0.02+pow(sat(dot(refract(-V,n,1.0/1.5),u.sun.xyz)),24.0)*0.8);
  return vec4f(max(col,vec3f(0.0)),v.mi.x);
}
