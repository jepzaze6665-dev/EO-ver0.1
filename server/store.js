// ONLINE N1 — server persistence adapters (same idea as the browser's src/save/storage.js). DEVELOPMENT ONLY:
// one JSON file per collection, rewritten whole on save (temp file + rename, so a crash never leaves half a file).
// A real database later = another adapter with the same get / set / all / flush.
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export class MemoryStore {
  constructor() { this.data = new Map(); }
  get(key) { return this.data.get(key); }
  set(key, value) { this.data.set(key, value); }
  all() { return [...this.data.values()]; }
  flush() {}
}

// one JSON file per key (player saves: a write touches only that player's file). Keys must be safe file names.
export class JsonDirStore {
  constructor(dir) { this.dir = dir; mkdirSync(dir, { recursive: true }); this.cache = new Map(); }
  file(key) { if (!/^[A-Za-z0-9_-]{1,64}$/.test(key)) throw new Error('bad store key'); return join(this.dir, key + '.json'); }
  get(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    const f = this.file(key);
    let v;
    if (existsSync(f)) {
      try { v = JSON.parse(readFileSync(f, 'utf8')); } catch (e) {
        renameSync(f, f + '.damaged-' + Date.now());
        console.error(`[store] ${f} was damaged (${e.message}) — moved aside`);
      }
    }
    this.cache.set(key, v);
    return v;
  }
  set(key, value) {
    const f = this.file(key), tmp = f + '.tmp';
    this.cache.set(key, value);
    writeFileSync(tmp, JSON.stringify(value));
    renameSync(tmp, f);
  }
  all() { return [...this.cache.values()].filter(Boolean); }
  flush() {}
}

export class JsonFileStore extends MemoryStore {
  constructor(dir, name) {
    super();
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, name + '.json');
    this.timer = null;
    if (existsSync(this.file)) {
      try {
        const obj = JSON.parse(readFileSync(this.file, 'utf8'));
        for (const [k, v] of Object.entries(obj)) this.data.set(k, v);
      } catch (e) {
        // a damaged file is kept aside, never silently overwritten
        renameSync(this.file, this.file + '.damaged-' + Date.now());
        console.error(`[store] ${this.file} was damaged (${e.message}) — moved aside, starting empty`);
      }
    }
  }
  set(key, value) { super.set(key, value); this.schedule(); }
  schedule() { if (!this.timer) { this.timer = setTimeout(() => this.flush(), 200); this.timer.unref?.(); } }
  flush() {
    clearTimeout(this.timer); this.timer = null;
    const tmp = this.file + '.tmp';
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.data), null, 1));
    renameSync(tmp, this.file);
  }
}
