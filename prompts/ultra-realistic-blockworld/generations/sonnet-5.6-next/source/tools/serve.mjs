// tiny static server on a random 4xxxx port
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
export const GPU_ARGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--force_high_performance_gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required'];

export function serve(extra) {
  return new Promise((resolve, reject) => {
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.mp4': 'video/mp4' };
    const server = http.createServer((req, res) => {
      if (extra && extra(req, res)) return;
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, url === '/' ? 'blockworld.html' : url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('no'); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    const attempt = (n) => {
      const port = 40000 + Math.floor(Math.random() * 9999);
      server.once('error', (e) => { if (n < 20) attempt(n + 1); else reject(e); });
      server.listen(port, '127.0.0.1', () => resolve({ server, port }));
    };
    attempt(0);
  });
}
