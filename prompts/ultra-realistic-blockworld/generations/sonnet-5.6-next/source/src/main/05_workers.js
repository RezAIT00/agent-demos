// ================================================================ worker pool (Blob workers built from the shared source)
class WorkerPool {
  constructor(count) {
    const url = URL.createObjectURL(new Blob([SHARED_SRC + '\nworkerMain(self);'], { type: 'text/javascript' }));
    this.workers = []; this.queue = []; this.jobs = new Map(); this.nextJob = 1; this.initMsg = null;
    for (let i = 0; i < count; i++) {
      const w = new Worker(url);
      const slot = { w, busy: 0 };
      w.onmessage = (e) => this._done(slot, e.data);
      w.onerror = (e) => console.error('worker error', e.message);
      this.workers.push(slot);
    }
  }
  init(seed, features) {
    this.initMsg = { type: 'init', seed, features: JSON.stringify(features || {}) };
    for (const s of this.workers) s.w.postMessage(this.initMsg);
  }
  get idle() { return this.workers.filter((s) => s.busy === 0).length; }
  run(msg, priority = 0, transfer) {
    return new Promise((resolve, reject) => {
      this.queue.push({ msg, priority, transfer, resolve, reject });
      this._pump();
    });
  }
  _pump() {
    for (const s of this.workers) {
      if (s.busy || !this.queue.length) continue;
      let best = 0;
      for (let i = 1; i < this.queue.length; i++) if (this.queue[i].priority < this.queue[best].priority) best = i;
      const job = this.queue.splice(best, 1)[0];
      const id = this.nextJob++;
      job.msg.job = id;
      this.jobs.set(id, job);
      s.busy = id;
      s.w.postMessage(job.msg, job.transfer || []);
    }
  }
  _done(slot, data) {
    const job = this.jobs.get(data.job);
    this.jobs.delete(data.job);
    slot.busy = 0;
    this._pump();
    if (!job) return;
    if (data.ok) job.resolve(data.result); else { console.error(data.error); job.reject(new Error(data.error)); }
  }
}
const WORKER_COUNT = Math.max(2, Math.min(12, (navigator.hardwareConcurrency || 4) - 2));
