// Minimal Chrome DevTools Protocol client for headless Edge/Chrome.
// No packages: Node 22+ ships a global WebSocket. Only talks to the browser this
// process starts (private profile, random debugging port on localhost).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

export function findBrowser() {
  const hit = CANDIDATES.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('No Edge/Chrome found. Set BROWSER_PATH.');
  return hit;
}

export async function launch({ tag = 'run' } = {}) {
  const profile = path.join(ROOT, 'tmp', `profile-${tag}-${process.pid}`);
  fs.mkdirSync(profile, { recursive: true });
  const args = [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-component-update', '--disable-background-networking', '--disable-sync',
    '--hide-scrollbars', '--mute-audio', '--use-angle=d3d11', '--enable-gpu',
    '--ignore-gpu-blocklist', '--force-color-profile=srgb',
    '--force-device-scale-factor=1', '--window-size=1920,1080',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    'about:blank',
  ];
  const proc = spawn(findBrowser(), args, { stdio: 'ignore' });
  const portFile = path.join(profile, 'DevToolsActivePort');
  let port = 0;
  for (let i = 0; i < 200 && !port; i++) {
    await sleep(100);
    if (fs.existsSync(portFile)) {
      const first = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim();
      if (first) port = Number(first);
    }
  }
  if (!port) { proc.kill(); throw new Error('Browser did not open a debugging port'); }

  let target;
  for (let i = 0; i < 100 && !target; i++) {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    target = list.find((t) => t.type === 'page');
    if (!target) await sleep(100);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });

  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    } else if (msg.method) listeners.forEach((fn) => fn(msg));
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = nextId++;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });

  const logs = [];
  listeners.push((m) => {
    if (m.method === 'Runtime.consoleAPICalled') {
      logs.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      logs.push('EXCEPTION ' + (d.exception?.description || d.text));
    }
    if (m.method === 'Log.entryAdded') logs.push(m.params.entry.level + ': ' + m.params.entry.text);
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');

  async function evaluate(expression, { awaitPromise = false } = {}) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result.value;
  }

  async function open(file, query = '') {
    await send('Page.navigate', { url: pathToFileURL(file).href + query });
    for (let i = 0; i < 600; i++) {
      await sleep(100);
      try {
        const st = await evaluate('window.READY === true ? "ok" : (window.FAILED || "")');
        if (st === 'ok') return;
        if (st) throw new Error('Page failed: ' + st);
      } catch (e) {
        if (String(e).includes('Page failed')) throw e;
      }
      if (logs.some((l) => l.startsWith('EXCEPTION'))) break;
    }
    throw new Error('Page never became ready\n' + logs.join('\n'));
  }

  async function close() {
    try { await Promise.race([send('Browser.close'), sleep(3000)]); } catch { /* closing */ }
    await Promise.race([new Promise((r) => proc.once('exit', r)), sleep(5000)]);
    if (proc.exitCode === null) proc.kill();
    for (let i = 0; i < 20; i++) {
      try { fs.rmSync(profile, { recursive: true, force: true }); break; }
      catch { await sleep(300); }
    }
  }
  return { send, evaluate, open, close, logs };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
