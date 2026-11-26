// The sheet mesh: sea, barrel and cathedral are the same triangles.
struct VO { @builtin(position) pos:vec4f, @location(0) wp:vec3f, @location(1) q:vec2f, @location(2) n:vec3f, @location(3) ts:vec3f, @location(4) tz:vec3f, @location(5) mi:vec4f };
override NX : u32 = 1500; override NZ : u32 = 1500;
fn gridAt(vi:u32)->vec4f { let i=vi%NX; let j=vi/NX; let s=grid[i]; let z=grid[NX+j]; let ds=grid[min(i+1u,NX-1u)]-grid[max(i,1u)-1u]; let dz=grid[NX+min(j+1u,NZ-1u)]-grid[NX+max(j,1u)-1u]; return vec4f(s,z,0.5*ds,0.5*dz); }
fn vsCommon(vi:u32,m:mat4x4f)->VO {
  let g=gridAt(vi); let lod=log2(max(max(g.z,g.w),0.03)); // relative metres -> level handled in seaDisp
  let o=surf(g.x,g.y,lod); var v:VO; v.wp=o.p; v.q=g.xy; v.n=o.n; v.ts=o.ts; v.tz=o.tz; v.mi=vec4f(o.st,o.fz,o.y0,o.rim); v.pos=m*vec4f(o.p,1.0); return v;
}
@vertex fn vsMain(@builtin(vertex_index) vi:u32)->VO { return vsCommon(vi,u.vp); }
@vertex fn vsRefl(@builtin(vertex_index) vi:u32)->VO { var v=vsCommon(vi,u.vp); return v; }
@vertex fn vsShadow(@builtin(vertex_index) vi:u32)->VO { return vsCommon(vi,u.svp); }

fn ggx(nh:f32,a2:f32)->f32 { let d=nh*nh*(a2-1.0)+1.0; return a2/(PI*d*d); }
fn thickness(s:f32)->f32 { return mix(26.0,1.1,smoothstep(0.0,118.0,s)); }

struct Sea { n:vec3f, var2:f32, fold:f32, sl:vec2f };
fn seaNormal(v:VO, dx:vec2f, dy:vec2f)->Sea {
  var sl=vec2f(0.0); var m2=0.0; var fold=0.0; let m=waveMask(v.q.x)*sat(u.wave.x*1.4); let q=vec2f(v.q.x-flowS(v.q.x),v.q.y);
  for(var i=0;i<4;i++){ let L=LC[i]; let t=textureSampleGrad(tDeriv,sRep,q/L,i,dx/L,dy/L); let w=select(1.0,mix(1.0,0.10,m),i==0); sl+=t.xy*w; m2+=max(t.z-dot(t.xy,t.xy),0.0)*w*w; fold+=(1.0-t.w)*w*select(1.0,0.75,i>2); }
  let k=u.flow.y*ringAt(v.wp.x,v.wp.z).y*mix(1.0,0.72,m); sl*=k; m2*=k*k; fold*=k;
  var o:Sea; o.sl=sl; o.n=normalize(v.n-v.ts*sl.x-v.tz*sl.y); o.var2=m2; o.fold=fold; return o;
}
fn foamTex(q:vec2f,dx:vec2f,dy:vec2f)->vec4f { let a=textureSampleGrad(tFoam,sRep,q/23.0,dx/23.0,dy/23.0); let b=textureSampleGrad(tFoam,sRep,q/5.3+vec2f(0.37,0.1),dx/5.3,dy/5.3); let c=textureSampleGrad(tFoam,sRep,q/131.0,dx/131.0,dy/131.0); return vec4f(a.r*0.65+b.r*0.35,max(a.g*0.5,b.g),c.b,b.a); }

fn env0(p:vec3f,n:vec3f)->vec3f { return naveEnv(p+n*0.1,normalize(n+vec3f(0.0,-0.15,0.25))); }
@fragment fn fsMain(v:VO, @builtin(front_facing) ff:bool) -> @location(0) vec4f {
  let dx=dpdx(v.q); let dy=dpdy(v.q);
  if(u.camU.w>0.5 && u.camU.w<1.5 && v.wp.y<0.25 && v.mi.x>0.5){ discard; }
  if(u.fr.w>-0.65 && v.q.y>u.fr.z+2.4 && v.q.y<u.fr.z+9.0 && v.mi.x>0.001){ discard; }
  if(v.mi.x>1.02 && v.q.x>151.5 && v.q.x<320.0){ discard; } // the outer skin of the wave is gone once it is a wall of glass
  if(u.flow.w>0.25&&v.q.x>152.0&&v.q.x<318.0&&v.mi.x>0.3){ discard; }
  let fringe=152.0-(1.0-smoothstep(0.9,1.1,v.mi.x))*smoothstep(0.3,0.6,v.mi.x)*(4.5*vnoise(vec2f(v.q.y*0.16,u.cam.w*0.8))+2.0*vnoise(vec2f(v.q.y*0.7,u.cam.w*2.0))); if(v.q.x>fringe&&v.q.x<156.0&&v.mi.x<1.1&&v.mi.x>0.45){ discard; }
  if(u.camU.w>0.5&&u.camU.w<1.5&&u.birth.z<90000.0){ let rq=ringAt(v.wp.x,v.wp.z); if(rq.y+v.mi.w*3.0+rq.x*0.06<0.05){ discard; } }
  let V=normalize(u.cam.xyz-v.wp); let dist=distance(u.cam.xyz,v.wp);
  let L=u.sun.xyz; let light=u.sun.w;
  // ------------ water
  let sea=seaNormal(v,dx,dy); var n=sea.n; if(dot(n,V)<0.0){ n=normalize(n-V*dot(n,V)*1.02); }
  let inB=waveMask(v.q.x)*smoothstep(0.05,0.30,v.mi.x);           // on the barrel wall
  let wallS=smoothstep(4.0,26.0,v.q.x)*(1.0-smoothstep(172.0,190.0,v.q.x));
  let a2=clamp(0.0016+sea.var2*1.3,0.0016,0.16); let rough=pow(a2,0.25);
  let nv=max(dot(n,V),0.03); let F=0.02+0.98*pow(1.0-nv,5.0)/(1.0+6.0*sqrt(a2));
  var R=reflect(-V,n); let below=R.y; R.y=abs(R.y)+0.01; R=normalize(R);
  var sky=dome(R,1.0+rough*6.5).rgb*mix(1.0,0.55,sat(-below*4.0));
  let scr=v.pos.xy/u.res.xy;
  let refl=textureSampleLevel(tRefl,sClamp,clamp(scr+vec2f(n.x,-n.z)*vec2f(0.16,0.22),vec2f(0.002),vec2f(0.998)),1.5).rgb;
  let tubeEnv=u.flow.w*(1.0-u.fr.y);
  let floorK=smoothstep(0.6,0.9,v.n.y)*u.flow.w*step(u.camU.w,0.5);
  sky=mix(sky,refl,floorK*0.85*u.ext.x); let cityK=u.ext.x*smoothstep(-0.2,0.35,u.seg.y)*step(u.camU.w,0.5)*(1.0-inB); sky=mix(sky,textureSampleLevel(tRefl,sClamp,clamp(scr+vec2f(n.x,-n.z)*vec2f(0.05,0.30),vec2f(0.002),vec2f(0.998)),1.0).rgb+starField(R,u.seg2.y)*0.4,cityK*(0.92-0.5*sat(-below*3.0)));
  let R0=reflect(-V,n); let sunL=dot(u.sunC.rgb,vec3f(0.333));
  let tubeC=vec3f(0.004,0.035,0.042)*sunL*(0.5+1.6*sat(R0.x)+0.6*sat(-R0.y))+fogColor(vec3f(0.2,0.1,1.0))*smoothstep(0.86,0.99,R0.z)*0.5;
  sky=mix(sky,tubeC,inB*wallS*max(tubeEnv,smoothstep(0.45,0.8,v.mi.x)));
  let sh=shadowAt(v.wp+v.n*0.6,(vec2f(u.jit.x,u.jit.y)-0.5)*0.0015);
  let shOpen=mix(vec3f(1.0),sh,u.flow.w*smoothstep(0.6,0.9,v.n.y));
  // deep body colour + forward scatter through crests
  let up=sat(0.5+0.5*n.y); let amb=domeRaw(vec3f(0.1,0.95,0.2),6.0).rgb*light;
  var body=vec3f(0.007,0.075,0.098)*(amb*2.8+u.sunC.rgb*max(L.y,0.0)*0.5);
  let sssV=pow(sat(dot(-V,normalize(L-n*0.35))),5.0); let crest=sat(v.wp.y*0.055+sea.fold*0.55+v.mi.w*0.8);
  body+=vec3f(0.010,0.19,0.19)*u.sunC.rgb*(sssV*1.2+0.04*sat(dot(V,vec3f(-L.x,0,-L.z))+0.4))*crest*crest*0.22;
  // ring crest is thin water with the sun behind it
  body+=vec3f(0.02,0.40,0.34)*u.sunC.rgb*v.mi.w*(0.015+0.22*sssV);
  let sunL0=dot(u.sunC.rgb,vec3f(0.333)); let rk=smoothstep(0.02,0.30,v.mi.w); let yk=sat(v.wp.y/120.0); var ringFoam=0.0; var ringPat=0.0;
  if(v.mi.w>0.005){ let crest0=v.mi.w/max(u.birth.w,0.01); let thr2=exp(-vec3f(0.42,0.11,0.10)*mix(45.0,2.0,pow(crest0,3.0))); let bw=vec3f(0.002,0.014,0.020)*sunL0+u.sunC.rgb*thr2*(hg(sat(dot(-V,L)),0.72)*1.1+0.015)+amb*vec3f(0.006,0.035,0.045); body=mix(body,bw,rk);
    let rd2=v.wp.xz-u.birth.xy; let ra=atan2(rd2.x,rd2.y)*u.birth.z; let fa=textureSampleLevel(tFoam,sRep,vec2f(ra/64.0,v.wp.y/170.0+u.cam.w*0.9),1.0); let fb=textureSampleLevel(tFoam,sRep,vec2f(ra/17.0,v.wp.y/60.0+u.cam.w*1.6),0.5);
    body+=vec3f(1.0,0.80,0.52)*dot(u.sunC.rgb,vec3f(0.333))*rk*exp(-u.birth.z/45.0)*1.2; ringPat=fa.b*0.55+fb.b*0.35+fb.r*0.25; let crest=v.mi.w/max(u.birth.w,0.01); ringFoam=rk*max(smoothstep(0.80,0.97,crest+(fa.b-0.5)*0.05+(fb.b-0.5)*0.03),0.7*exp(-v.wp.y/6.0)*smoothstep(0.35,0.7,fb.b)); }
  // the wall of the barrel: backlit by the sun through metres of moving water
  let thick=thickness(v.q.x)*(1.0+0.35*clamp(sea.sl.x+sea.sl.y,-0.9,0.9));
  let rd=refract(-V,n,1.0/1.33); let thr=mix(-V,rd,0.75);
  let ext=exp(-vec3f(0.44,0.104,0.092)*thick);
  let cS=sat(dot(thr,L)); let glow=hg(cS,0.80)*0.55+hg(cS,0.93)*0.10+0.028;
  let streak=0.6+0.8*textureSampleGrad(tFoam,sRep,vec2f(v.q.y/61.0,(v.q.x-flowS(v.q.x))/260.0),dx.yx/vec2f(61.0,260.0),dy.yx/vec2f(61.0,260.0)).b;
  let caust=1.0+1.6*clamp(-(sea.fold-0.10),-0.5,0.9);
  let wallC=vec3f(0.85,0.95,1.35)*(u.sunC.rgb*glow*ext*caust*1.0+skyThrough(thr,6.5)*ext*0.16+vec3f(0.0,0.085,0.10)*sunL*exp(-thick*0.10)*0.10)*streak*light;
  body=mix(body,wallC,inB*wallS);
  let Fr=mix(F,min(F,0.18),rk);
  let faceStreak=rk*(1.0-smoothstep(0.80,0.95,v.mi.w/max(u.birth.w,0.01)))*smoothstep(0.45,0.85,textureSampleLevel(tFoam,sRep,vec2f(atan2(v.wp.x-u.birth.x,v.wp.z-u.birth.y)*u.birth.z/22.0,v.wp.y/70.0-u.cam.w*0.6),1.0).b);
  var col=body*(1.0-Fr)+sky*Fr*mix(1.0,0.7,rk);
  col=mix(col,vec3f(0.55,0.62,0.66)*(amb*0.9+u.sunC.rgb*0.05),faceStreak*0.5);
  // sun glint
  let H=normalize(V+L); let nh=sat(dot(n,H)); let spec=ggx(nh,a2)*(0.02+0.98*pow(1.0-sat(dot(V,H)),5.0))*sat(dot(n,L))*0.25/max(nv,0.25);
  col+=u.sunC.rgb*min(spec,40.0)*shOpen*(1.0-inB*wallS*0.8);
  // foam
  let ft=foamTex(vec2f(v.q.x-flowS(v.q.x),v.q.y),dx,dy);
  let wind=ft.z; let k0=u.flow.y*ringAt(v.wp.x,v.wp.z).y; var fc=smoothstep(0.16,0.85,sea.fold*1.9+wind*0.6-0.28)*u.flow.z;
  fc=max(fc,smoothstep(0.50,0.95,ft.z*0.55+textureSampleGrad(tFoam,sRep,vec2f(dot(v.q,vec2f(0.75,0.66))/210.0,dot(v.q,vec2f(-0.66,0.75))/38.0),dx/60.0,dy/60.0).b*0.55)*0.42*(1.0-inB)*k0);
  // white water: lip edge, curtain, trough impact line
  let lip=smoothstep(112.0,148.0,v.q.x)*(1.0-smoothstep(175.0,215.0,v.q.x))*smoothstep(0.06,0.22,v.mi.x);
  let up2=0.0;
  let impact=exp(-pow((v.q.x+26.0)/10.0,2.0))*smoothstep(0.75,1.0,v.mi.x);
  let faceF=inB*wallS*smoothstep(0.55,0.95,streak*0.62+ft.x*0.22)*0.5;
  fc=sat(max(max(max(fc,lip*(0.55+0.6*wind)),max(up2*(0.5+wind),impact)),faceF)+0.0);
  let cs=textureSampleGrad(tFoam,sRep,vec2f(v.q.y/9.0,(v.q.x-flowS(v.q.x)*1.6)/75.0),dx.yx/vec2f(9.0,75.0),dy.yx/vec2f(9.0,75.0)); let curt=smoothstep(112.0,132.0,v.q.x)*(1.0-smoothstep(160.0,175.0,v.q.x))*smoothstep(0.5,0.8,v.mi.x);
  var pat=mix(ft.x*0.75+ft.y*0.35,cs.b*0.9+cs.r*0.35,curt); fc=max(fc,curt*(0.42+0.42*smoothstep(126.0,146.0,v.q.x))); pat=mix(pat,ringPat,rk); fc=mix(fc,ringFoam,rk);
  let cw3=cityWater(v.wp.x,v.wp.z); let cwf=cw3.y; fc=max(fc,cwf); pat=mix(pat,ft.x*0.6+ft.y*0.5+0.15,cwf);
  let cover=smoothstep(1.0-fc,1.0-fc+0.45,pat)*smoothstep(0.02,0.2,fc);
  let fn2=normalize(n+v.ts*(ft.y-0.5)*0.35); let wrap=sat(dot(fn2,L)*0.6+0.4);
  var foamC=vec3f(0.82,0.88,0.90)*(u.sunC.rgb*(wrap*0.20+0.10*pow(sat(dot(-V,L)),2.0))*shOpen+amb*1.35);
  foamC=mix(foamC,foamC*vec3f(0.35,0.8,0.78)+wallC*0.7,inB*wallS*0.7);
  col=mix(col,foamC*(0.65+0.5*ft.y),cover*0.92);
  var litK=1.0; if(u.birth.z<90000.0){ let rr=ringAt(v.wp.x,v.wp.z); litK=smoothstep(0.02,0.5,rr.y+v.mi.w*3.0+rr.x*0.06); col*=litK; }
  // ------------ glass
  let fz=v.mi.y;
  if(fz>0.001){
    let g=stained(v.q.y,v.q.x); let isFloor=step(v.q.x,u.nave.x+0.3);
    let vv=vor(v.q*0.75+3.0); let tilt=(hash22(vv.zw)-0.5); let facetAmt=mix(0.5,0.05,smoothstep(0.3,1.0,fz));
    var gn=normalize(v.n+v.ts*tilt.x*facetAmt+v.tz*tilt.y*facetAmt);
    if(dot(gn,V)<0.0){ gn=normalize(gn-V*dot(gn,V)*1.02); }
    let rip=textureSampleGrad(tDeriv,sRep,v.q/6.0,2,dx/6.0,dy/6.0).xy*0.10;
    var gc:vec3f;
    if(isFloor>0.5){
      // polished black-glass floor
      let tile=abs(fract(v.q/vec2f(6.0,7.0)+0.5)-0.5); let gl=min(tile.x*6.0,tile.y*7.0); let line=1.0-smoothstep(0.03,0.07,gl);
      let dia=abs(fract((v.q.x+v.q.y)/14.0)-0.5)+abs(fract((v.q.x-v.q.y)/14.0)-0.5); let inl=smoothstep(0.46,0.5,dia)*(1.0-smoothstep(0.5,0.54,dia));
      let fl=0.04+0.96*pow(1.0-max(dot(v.n,V),0.0),5.0);
      let rr=textureSampleLevel(tRefl,sClamp,clamp(scr+rip*0.05+tilt*0.0015,vec2f(0.002),vec2f(0.998)),0.6).rgb*u.ext.x;
      let shf=shadowAt(v.wp+vec3f(0,0.05,0),(u.jit.xy-0.5)*0.0016);
      gc=vec3f(0.010,0.013,0.018)*amb+shf*u.sunC.rgb*max(L.y,0.05)*0.30*(1.0-line*0.6);
      gc=mix(gc,vec3f(1.0,0.72,0.3)*(shf*u.sunC.rgb*0.05+amb*0.1),inl*0.35);
      gc+=rr*mix(0.28,1.0,fl);
      gc+=u.sunC.rgb*shf*ggx(sat(dot(normalize(v.n+vec3f(rip.x,0,rip.y)),H)),0.004)*0.02;
    } else {
      let rr=refract(-V,normalize(gn+v.ts*rip.x*1.5+v.tz*rip.y*1.5),1.0/1.2); let td=mix(-V,rr,0.9);
      let cL=sat(dot(-v.n,L));                       // sun striking the outside of this pane
      let trans=g.rgb*(skyThrough(td,3.2)*1.15+u.sunC.rgb*cL*0.16);
      let nvg=max(dot(gn,V),0.04); let Fg=0.04+0.96*pow(1.0-nvg,5.0);
      let rdir=reflect(-V,gn); let env=naveEnv(v.wp+v.n*0.1,rdir);
      let lead=vec3f(0.020,0.022,0.026)*(amb+u.sunC.rgb*0.2);
      let shw=shadowAt(v.wp+v.n*0.5,(u.jit.xy-0.5)*0.0016); let st2=vor(v.q*vec2f(0.35,0.55)+9.0); let mason=0.55+0.45*hash21(st2.zw); let joint=smoothstep(0.02,0.09,st2.y-st2.x);
      let stone=vec3f(0.30,0.34,0.40)*mason*mix(0.5,1.0,joint)*(amb*0.10+shw*u.sunC.rgb*sat(dot(gn,L))*0.55)+env0(v.wp,v.n)*0.06;
      gc=mix(trans,mix(lead,stone,step(0.80,g.a)*(1.0-step(0.92,g.a))),g.a);
      gc=gc*(1.0-Fg*0.7)+env*Fg*0.9;
      let sg=ggx(sat(dot(gn,H)),0.0012); gc+=u.sunC.rgb*min(sg,30.0)*0.006*(1.0-g.a);
    }
    // the freezing edge: white-hot crystallisation, jagged
    let e=sat(fz/0.10)*(1.0-smoothstep(0.10,0.55,fz)); let cr=1.0-smoothstep(0.0,0.10,(vv.y-vv.x));
    gc+=vec3f(0.35,0.85,1.0)*(cr*0.9+0.10)*e*(0.6+dot(u.sunC.rgb,vec3f(0.10)));
    col=mix(col,gc,smoothstep(0.0,0.06,fz));
  }
  col+=vec3f(1.0,0.62,0.30)*cw3.z*0.12*(1.0-cover*0.5);
  // aerial perspective
  let fd=-V; let fog=1.0-exp(-dist*u.sky.z*mix(1.0,0.15,u.flow.w)); let fcol=fogColor(fd);
  let mieS=u.sunC.rgb*hg(sat(dot(fd,L)),0.80)*0.06*(1.0-u.flow.w);
  col=mix(col,(fcol+mieS)*litK,fog);
  if(litK<0.999&&u.camU.w<0.5){ let calm=mix(0.10,1.0,sat(u.gal2.w*4.0)); let rw=(textureSampleLevel(tDeriv,sRep,v.wp.xz/37.0+u.cam.w*0.02,2,0.0).xy*0.5+textureSampleLevel(tDeriv,sRep,v.wp.xz/9.0-u.cam.w*0.03,3,0.0).xy*0.3)*calm; let fm=0.02+0.98*pow(1.0-max(V.y,0.0),5.0); let mr=u.ext.x*textureSampleLevel(tRefl,sClamp,clamp(scr+vec2f(rw.x*0.10,rw.y*0.18),vec2f(0.002),vec2f(0.998)),0.0).rgb; col=mix(mr*fm*vec3f(0.80,0.92,1.0),col,litK); }
  return vec4f(max(col,vec3f(0.0)),1.0);
}
// coloured transmittance seen from the sun (only panes that face it)
@fragment fn fsShadow(v:VO)->@location(0) vec4f {
  if(v.q.x<16.0||v.q.x>151.0||v.mi.x<0.3||v.q.y>u.fr.z+0.5){ discard; }
  if(dot(v.n,u.sun.xyz)>-0.02){ discard; }
  let th=thickness(v.q.x); let water=exp(-vec3f(0.30,0.055,0.06)*th*0.9)*0.9;
  let g=stained(v.q.y,v.q.x); let gl=g.rgb*(1.0-g.a*0.94)*1.15;
  return vec4f(mix(water,gl,smoothstep(0.02,0.3,v.mi.y)),1.0);
}
