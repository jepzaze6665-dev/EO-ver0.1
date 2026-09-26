// COOLDOWN SYSTEM — generic per-caster cooldown tracker (no DOM, no game references).
// Stores remaining AND total time so any UI can draw a sweep without knowing skill data.
export class Cooldowns {
  constructor() {
    this.remainingById = {};
    this.totalById = {};
  }
  start(id, seconds) {
    if (!(seconds > 0) || !Number.isFinite(seconds)) { this.clear(id); return; }
    this.remainingById[id] = seconds;
    this.totalById[id] = seconds;
  }
  remaining(id) { return this.remainingById[id] || 0; }
  total(id) { return this.totalById[id] || 0; }
  ratio(id) { const t = this.total(id); return t ? this.remaining(id) / t : 0; }
  ready(id) { return this.remaining(id) <= 0; }
  clear(id) { delete this.remainingById[id]; delete this.totalById[id]; }
  reduce(id, seconds) {
    if (!(seconds > 0) || !this.remainingById[id]) return;
    this.remainingById[id] = Math.max(0, this.remainingById[id] - seconds);
    if (!this.remainingById[id]) this.clear(id);
  }
  reduceAll(seconds) { for (const id of Object.keys(this.remainingById)) this.reduce(id, seconds); }
  update(dt) { if (dt > 0) this.reduceAll(dt); }
  serialize() { return { ...this.remainingById }; }
}
