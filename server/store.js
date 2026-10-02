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
