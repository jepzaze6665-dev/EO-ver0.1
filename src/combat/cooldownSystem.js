// COOLDOWN SYSTEM — generic per-caster cooldown tracker (no DOM, no game references).
// Stores remaining AND total time so any UI can draw a sweep without knowing skill data.
//
// CHARGES (Skill System S6): setMax(id, n) with n > 1 turns a cooldown into n charges. start() spends a charge and
// starts ITS OWN recharge timer (every missing charge regenerates independently, in parallel). The skill is ready
// while at least one charge is left; remaining() = time until the next charge when none are left.
export class Cooldowns {
  constructor() {
    this.remainingById = {};
    this.totalById = {};
    this.maxById = {};     // id -> max charges (only for n > 1)
    this.rechargeById = {}; // id -> [seconds left per missing charge]
  }
  // --- charges
  setMax(id, n) {
    n = Math.max(1, Math.floor(n || 1));
    if (n <= 1) { if (this.maxById[id]) { delete this.maxById[id]; delete this.rechargeById[id]; } return; }
    this.maxById[id] = n;
    const r = this.rechargeById[id] || (this.rechargeById[id] = []);
    while (r.length > n) r.pop(); // max lowered (gear removed): keep the soonest timers
  }
  maxCharges(id) { return this.maxById[id] || 1; }
  charges(id) {
    if (!this.maxById[id]) return this.ready(id) ? 1 : 0;
    return this.maxById[id] - (this.rechargeById[id] || []).length;
  }
  // --- cooldowns
  start(id, seconds) {
    if (this.maxById[id]) {
      if (!(seconds > 0) || !Number.isFinite(seconds)) return;
      const r = this.rechargeById[id];
      if (r.length < this.maxById[id]) r.push(seconds);
      this.totalById[id] = seconds;
      return;
    }
    if (!(seconds > 0) || !Number.isFinite(seconds)) { this.clear(id); return; }
    this.remainingById[id] = seconds;
    this.totalById[id] = seconds;
  }
  remaining(id) {
    if (this.maxById[id]) {
      const r = this.rechargeById[id] || [];
      return r.length >= this.maxById[id] ? Math.min(...r) : 0;
    }
    return this.remainingById[id] || 0;
  }
  // next charge's progress (charge skills show it even while other charges are left)
  nextCharge(id) {
    const r = this.rechargeById[id] || [];
    return r.length ? Math.min(...r) : 0;
  }
  total(id) { return this.totalById[id] || 0; }
  ratio(id) { const t = this.total(id); return t ? this.remaining(id) / t : 0; }
  ready(id) { return this.remaining(id) <= 0; }
  clear(id) { delete this.remainingById[id]; delete this.totalById[id]; if (this.rechargeById[id]) this.rechargeById[id] = []; }
  reduce(id, seconds) {
    if (!(seconds > 0)) return;
    const r = this.rechargeById[id];
    if (r && r.length) {
      for (let i = 0; i < r.length; i++) r[i] -= seconds;
      this.rechargeById[id] = r.filter((t) => t > 0);
      return;
    }
    if (!this.remainingById[id]) return;
    this.remainingById[id] = Math.max(0, this.remainingById[id] - seconds);
    if (!this.remainingById[id]) this.clear(id);
  }
  reduceAll(seconds) {
    for (const id of new Set([...Object.keys(this.remainingById), ...Object.keys(this.rechargeById)])) this.reduce(id, seconds);
  }
  update(dt) { if (dt > 0) this.reduceAll(dt); }
  serialize() { return { ...this.remainingById }; }
}
