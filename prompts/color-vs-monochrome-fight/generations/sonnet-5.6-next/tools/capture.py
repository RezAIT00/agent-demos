"""Frame-exact capture: serves index.html on 127.0.0.1, drives headless Edge, receives raw RGBA frames.

  capture.py stills 0,18,54 --out work/stills [--ss 2] [--scale 0.5]
  capture.py video 0:1200 --out work/master.mkv [--ss 2]
  capture.py sheet character --out character_sheet.png
Only the Edge process started here (own --user-data-dir) is ever terminated.
"""
import argparse, json, os, subprocess, sys, threading, time, shutil
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
W, H = 1920, 1080
EDGE = [r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
        r'C:\Program Files\Microsoft\Edge\Application\msedge.exe']

CLIENT = r"""
(async () => {
  const post = (url, body) => fetch(url, {method:'POST', body});
  window.addEventListener('unhandledrejection', e => post('/log', 'rejection ' + (e.reason && e.reason.stack || e.reason)));
  const say = m => post('/log', String(m));
  for (const k of ['log','warn','error']) { const o = console[k].bind(console); console[k] = (...a) => { o(...a); say(k+': '+a.join(' ').slice(0,6000)); }; }
  window.addEventListener('error', e => say('window error: '+e.message+' @'+e.lineno));
  try {
    if (!window.READY) await new Promise(r => window.addEventListener('DOMContentLoaded', r));
    await window.READY;
    await say('GPU: ' + window.GPU_NAME);
    const job = await (await fetch('/job')).json();
    if (job.mode === 'sheet') {
      const cv = await window.renderSheet(job.name);
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      await post('/png', blob);
    } else {
      const buf = new Uint8Array(1920*1080*4), aux = new Uint8Array(1920*1080*4);
      for (const f of job.frames) {
        window.renderAt((f + 0.001) / 24);
        R.readPixels(buf);
        const e = gl.getError(); if (e) await say('GL error 0x' + e.toString(16) + ' at frame ' + f);
        const r = await post('/frame?f=' + f, buf);
        if (!r.ok) throw new Error('server refused frame ' + f);
        await r.text();
        if (job.audit) { R.auditMode = true; window.renderAt((f + 0.001) / 24); R.readPixels(aux); R.auditMode = false; const r2 = await post('/aux?f=' + f, aux); await r2.text(); }
      }
    }
    await post('/done', 'ok');
  } catch (e) { await say('FATAL ' + (e && e.stack || e)); await post('/done', 'err'); }
})();
"""


class Server(ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        if not isinstance(sys.exc_info()[1], (ConnectionError, BrokenPipeError)):
            super().handle_error(request, client_address)


class State:
    def __init__(self):
        self.done = threading.Event(); self.status = None; self.count = 0; self.t0 = time.time()
        self.ff = None; self.job = {}; self.args = None; self.lock = threading.Lock(); self.last = time.time()
        self.aux = []


ST = State()


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *a):
        pass

    def _send(self, code, body=b'', ctype='text/plain'):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == '/index.html':
            html = open(os.path.join(ROOT, 'index.html'), 'rb').read()
            html = html.replace(b'</body>', b'<script src="/client.js"></script></body>')
            self._send(200, html, 'text/html; charset=utf-8')
        elif u.path == '/client.js':
            self._send(200, CLIENT.encode(), 'text/javascript')
        elif u.path == '/job':
            self._send(200, json.dumps(ST.job).encode(), 'application/json')
        else:
            self._send(404)

    def do_POST(self):
        u = urlparse(self.path)
        n = int(self.headers.get('Content-Length', 0))
        body = bytearray()
        while len(body) < n:
            chunk = self.rfile.read(min(1 << 20, n - len(body)))
            if not chunk:
                break
            body += chunk
        ST.last = time.time()
        if u.path == '/log':
            print('[page]', body.decode('utf-8', 'replace'), flush=True)
        elif u.path == '/frame':
            f = int(parse_qs(u.query)['f'][0])
            if len(body) != W * H * 4:
                print('bad frame size', len(body)); self._send(500); return
            with ST.lock:
                handle_frame(f, bytes(body))
        elif u.path == '/aux':
            f = int(parse_qs(u.query)['f'][0])
            handle_aux(f, bytes(body))
        elif u.path == '/png':
            with open(ST.args.out, 'wb') as fh:
                fh.write(body)
            print('wrote', ST.args.out, len(body))
        elif u.path == '/done':
            ST.status = body.decode()
            ST.done.set()
        self._send(200, b'ok')


def handle_aux(f, data):
    """colour-rule audit: pixels fully covered by SUMI and not covered by effects must be neutral grey."""
    import numpy as np
    a = np.frombuffer(data, np.uint8).reshape(H, W, 4)
    last = ST.lastframe
    img = np.frombuffer(last, np.uint8).reshape(H, W, 4)[:, :, :3].astype(np.int16)
    sel = (a[:, :, 0] >= 250) & (a[:, :, 1] <= 2)
    npx = int(sel.sum())
    if npx:
        spread = img[sel].max(axis=1) - img[sel].min(axis=1)
        ST.aux.append((f, npx, int(spread.max()), float(spread.mean()), int((spread > 8).sum())))
    else:
        ST.aux.append((f, 0, 0, 0.0, 0))


def handle_frame(f, data):
    from PIL import Image
    ST.lastframe = data
    a = ST.args
    if a.mode == 'video':
        ST.ff.stdin.write(data)
    else:
        im = Image.frombytes('RGBA', (W, H), data).transpose(Image.FLIP_TOP_BOTTOM).convert('RGB')
        if a.scale != 1.0:
            im = im.resize((int(W * a.scale), int(H * a.scale)), Image.LANCZOS)
        im.save(os.path.join(a.out, 'f%04d.png' % f), compress_level=1)
    ST.count += 1
    if ST.count % 100 == 0:
        el = time.time() - ST.t0
        print('  frames %d  (%.1f fps)' % (ST.count, ST.count / el), flush=True)


def parse_frames(s):
    out = []
    for part in s.split(','):
        if ':' in part:
            bits = [int(x) for x in part.split(':')]
            out += list(range(*bits))
        else:
            out.append(int(part))
    return out


def kill_mine(proc, profile):
    try:
        subprocess.run(['taskkill', '/F', '/T', '/PID', str(proc.pid)], capture_output=True)
    except Exception:
        pass
    # anything still holding OUR private profile directory is ours too
    ps = ("Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -like '*%s*' } "
          "| ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }") % profile
    subprocess.run(['powershell', '-NoProfile', '-Command', ps], capture_output=True)


def chunked(a, frames, size):
    """long videos are rendered as independent chunks (fresh browser each), then joined losslessly"""
    seg_dir = os.path.join(ROOT, 'work', 'segments')
    os.makedirs(seg_dir, exist_ok=True)
    parts = []
    for i in range(0, len(frames), size):
        sub = frames[i:i + size]
        seg = os.path.join(seg_dir, 'seg_%04d_%04d.mkv' % (sub[0], sub[-1]))
        cmd = [sys.executable, os.path.abspath(__file__), 'video', '%d:%d' % (sub[0], sub[-1] + 1), '--out', seg, '--ss', str(a.ss)]
        if a.audit:
            cmd.append('--audit')
        for attempt in range(3):
            r = subprocess.run(cmd)
            if r.returncode == 0:
                break
            print('chunk', sub[0], 'failed, retrying', attempt + 1, flush=True)
        else:
            sys.exit(1)
        if a.audit:
            src = os.path.join(ROOT, 'work', 'audit_colour_rule.json')
            shutil.copy(src, seg + '.audit.json')
        parts.append(seg)
    lst = os.path.join(seg_dir, 'list.txt')
    with open(lst, 'w') as fh:
        for p_ in parts:
            fh.write("file '%s'%s" % (p_.replace(os.sep, '/'), chr(10)))
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', os.path.abspath(a.out)], check=True)
    if a.audit:
        rows = []
        for p_ in parts:
            rows += json.load(open(p_ + '.audit.json'))
        with open(os.path.join(ROOT, 'work', 'audit_colour_rule.json'), 'w') as fh:
            json.dump(rows, fh)
    for p_ in parts:
        os.remove(p_)
        if os.path.exists(p_ + '.audit.json'):
            os.remove(p_ + '.audit.json')
    print('joined', len(parts), 'chunks into', a.out)


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap = argparse.ArgumentParser()
    ap.add_argument('mode', choices=['stills', 'video', 'sheet'])
    ap.add_argument('what')
    ap.add_argument('--out', required=True)
    ap.add_argument('--ss', type=float, default=2.0)
    ap.add_argument('--scale', type=float, default=1.0)
    ap.add_argument('--audit', action='store_true')
    ap.add_argument('--chunk', type=int, default=240)
    a = ap.parse_args()
    if a.mode == 'video' and len(parse_frames(a.what)) > a.chunk:
        chunked(a, parse_frames(a.what), a.chunk)
        return
    ST.args = a
    a.out = os.path.abspath(a.out)
    if a.mode == 'sheet':
        ST.job = {'mode': 'sheet', 'name': a.what}
    else:
        ST.job = {'mode': a.mode, 'frames': parse_frames(a.what), 'audit': a.audit}
    if a.mode == 'stills':
        os.makedirs(a.out, exist_ok=True)
    else:
        os.makedirs(os.path.dirname(a.out), exist_ok=True)
    if a.mode == 'video':
        cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '%dx%d' % (W, H), '-r', '24', '-i', '-',
               '-vf', 'vflip', '-c:v', 'libx264rgb', '-preset', 'ultrafast', '-qp', '0', a.out]
        ST.ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    srv = Server(('127.0.0.1', 0), Handler)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    profile = os.path.join(ROOT, 'work', 'edge-profile-%d' % os.getpid())
    os.makedirs(profile, exist_ok=True)
    edge = next(p for p in EDGE if os.path.exists(p))
    url = 'http://127.0.0.1:%d/index.html?cap=1&ss=%s' % (port, a.ss)
    proc = subprocess.Popen([edge, '--headless=new', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check',
                             '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-extensions', '--disable-sync',
                             '--disable-background-networking', '--disable-component-update', '--disable-domain-reliability',
                             '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--mute-audio',
                             '--window-size=1920,1080', url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ok = False
    try:
        while not ST.done.wait(1.0):
            if time.time() - ST.last > 150:
                print('TIMEOUT: no traffic from the page for 150 s'); break
        ok = ST.status == 'ok'
    finally:
        kill_mine(proc, profile)
        srv.shutdown()
        if ST.ff:
            ST.ff.stdin.close(); ST.ff.wait()
        time.sleep(0.4)
        shutil.rmtree(profile, ignore_errors=True)
    if a.audit and ST.aux:
        with open(os.path.join(ROOT, 'work', 'audit_colour_rule.json'), 'w') as fh:
            json.dump(ST.aux, fh)
    el = time.time() - ST.t0
    print('captured %d frame(s) in %.1f s, status=%s' % (ST.count, el, ST.status))
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
