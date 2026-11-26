// Frame-exact capture: headless Edge (WebGPU) -> raw RGBA -> ffmpeg.
//   node tools/cap.mjs --times 1.2,3 --out out/x      stills
//   node tools/cap.mjs --from 0 --to 12 --fps 60 --out proof.mp4
//   node tools/cap.mjs --from 0 --to 12 --fps 4 --sheet 8x6 --tw 480 --out sheet.png
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import {spawn} from 'node:child_process'; import {fileURLToPath} from 'node:url'; import {build} from './build.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'); process.chdir(root);
const A={}; for(let i=2;i<process.argv.length;i++){const k=process.argv[i]; if(k.startsWith('--')){const n=process.argv[i+1]; if(n===undefined||n.startsWith('--'))A[k.slice(2)]=true; else{A[k.slice(2)]=n;i++;}}}
const W=+(A.w||1920),H=+(A.h||1080),N=+(A.n||16),fps=+(A.fps||60),port=8700+Math.floor(Math.random()*800);
build();
let waiter=null;
const srv=http.createServer((q,r)=>{ if(q.method==='POST'){const ch=[];q.on('data',d=>ch.push(d));q.on('end',()=>{r.end('ok');waiter&&waiter(Buffer.concat(ch));});return;}
  r.setHeader('content-type','text/html');r.end(fs.readFileSync(path.join(root,'index.html')));}).listen(port,'127.0.0.1');
const prof=path.join(root,'.edgeprof'+port); fs.mkdirSync(prof,{recursive:true});
const dport=port+1000;
const br=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--remote-debugging-port='+dport,'--user-data-dir='+prof,'--enable-unsafe-webgpu','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','--disable-sync','--disable-gpu-watchdog','--force-high-performance-gpu','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0;const pend=new Map();
async function connect(){for(let i=0;i<80;i++){try{const l=await (await fetch('http://127.0.0.1:'+dport+'/json')).json();const p=l.find(x=>x.type==='page');if(p){ws=new WebSocket(p.webSocketDebuggerUrl);await new Promise((a,b)=>{ws.onopen=a;ws.onerror=b});return;}}catch(e){}await sleep(150);}throw new Error('no browser');}
const send=(m,p={})=>new Promise((a,b)=>{const i=++id;pend.set(i,[a,b]);ws.send(JSON.stringify({id:i,method:m,params:p}));});
async function ev(x){const r=await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function cleanup(code){try{send('Browser.close');}catch(e){}await sleep(500);try{br.kill();}catch(e){}srv.close();await sleep(700);try{fs.rmSync(prof,{recursive:true,force:true,maxRetries:8,retryDelay:300});}catch(e){}process.exit(code);}
try{
 await connect();
 ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&pend.has(d.id)){const[a,b]=pend.get(d.id);pend.delete(d.id);d.error?b(new Error(JSON.stringify(d.error))):a(d.result);}
  else if(d.method==='Runtime.consoleAPICalled'){console.log('[page]',d.params.args.map(x=>x.value??x.description).join(' ').slice(0,3000));}
  else if(d.method==='Runtime.exceptionThrown'){console.log('[EXC]',d.params.exceptionDetails.exception?.description||d.params.exceptionDetails.text);}};
 await send('Runtime.enable');await send('Page.enable');
 await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/?capture=1&w='+W+'&h='+H+'&n='+N});
 let ok=false;for(let i=0;i<900;i++){await sleep(100);try{const s=await ev('window.READY===true?"r":(window.FAILED||"")');if(s==='r'){ok=true;break;}if(s){console.log('FAILED',s);break;}}catch(e){}}
 if(!ok)throw new Error('page not ready');
 if(A.pre)await ev(A.pre);
 const load=async()=>{await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/?capture=1&w='+W+'&h='+H+'&n='+N});for(let i=0;i<900;i++){await sleep(100);try{const s=await ev('window.READY===true?"r":(window.FAILED||"")');if(s==='r')return;}catch(e){}}throw new Error('reload failed');};
 const grab1=async t=>{const p=new Promise(r=>waiter=r);await ev('(async()=>{await renderAt('+t+');const b=await readFrame();await fetch("/f",{method:"POST",body:b});})()');return p;};
 const grab=async t=>{for(let k=0;;k++){try{return await grab1(t);}catch(e){console.log('retry frame',t,e.message.slice(0,120));if(k>=4)throw e;await sleep(1500);await load();}}};
 if(A.eval){console.log(JSON.stringify(await ev(A.eval)));}
 const ff=(args)=>spawn('ffmpeg',['-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgba','-s',W+'x'+H,'-r',String(fps),'-i','-',...args],{stdio:['pipe','inherit','inherit']});
 const done=f=>new Promise(r=>f.on('close',r));
 const T0=Date.now();let cnt=0;
 if(A.times){for(const ts of String(A.times).split(',')){const t=+ts;const b=await grab(t);const f=ff(['-frames:v','1',...(A.tw?['-vf','scale='+A.tw+':-1']:[]),(A.out||'out/s')+'_'+t.toFixed(3)+'.png']);f.stdin.end(b);await done(f);cnt++;}}
 else if(A.to){const from=+(A.from||0),to=+A.to;const n=Math.round((to-from)*fps);
  const f=ff(A.sheet?['-vf','scale='+(A.tw||480)+':-1,tile='+A.sheet,'-frames:v','1',A.out]:['-c:v','libx264','-preset',A.preset||'slow','-crf',A.crf||'16','-vf','scale=out_color_matrix=bt709:out_range=tv','-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-color_range','tv','-movflags','+faststart',A.out]);
  for(let i=0;i<n;i++){const b=await grab(from+i/fps);if(!f.stdin.write(b))await new Promise(r=>f.stdin.once('drain',r));cnt++;if(i%30===29)console.log('frame '+(i+1)+'/'+n+'  '+((Date.now()-T0)/cnt/1000).toFixed(3)+' s/frame');}
  f.stdin.end();await done(f);}
 console.log('done',cnt,'frames',((Date.now()-T0)/Math.max(cnt,1)/1000).toFixed(3),'s/frame');
 const errs=await ev('window.ERRS?window.ERRS.slice(0,6).join("\\n---\\n"):""');if(errs)console.log('GPU ERRORS:\n'+errs);
 await cleanup(0);
}catch(e){console.log('ERR',e.message);await cleanup(1);}
