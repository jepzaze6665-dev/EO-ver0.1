import { STATUSES, STATUS_RULES } from '../data/statuses.js';
// categories a 'debuffImmune' flag resists (buffs / defense statuses still apply)
const IMMUNE_TO = ['debuff', 'control', 'dot'];

// STATUS SYSTEM — generic timed effects on any entity (player, monster, boss, dummy, future party member).
// Rules come from data/statuses.js; this file never names a class or a skill.
// It is a pure data structure: it never deals damage or touches the game. Instead it queues
//   - ticks  (damage-over-time)  -> drained by combat/combat.js, which deals the damage
//   - events (statusApplied / statusStacked / statusExpired / statusRemoved / shieldBroken)
// so the same code runs in unit tests (tools/tests/status.test.mjs) and, later, on a server.
//
// State per status: { id, t, total, stacks, maxStacks, sourceId, source, tickT, ...data }
// (`t` = remaining seconds; `data` lets a skill override numbers, e.g. { mult: 1.3 } or { damage: 6 })
export class StatusSet {
  constructor(owner = null, defs = STATUSES) {
    this.owner = owner;
    this.defs = defs;
    this.map = new Map();
    this.events = [];
    this.ticks = [];
  }

  def(id) {
    const d = this.defs[id];
    if (!d) throw new Error(`Unknown status "${id}"`);
    return d;
  }
  emit(name, data) { if (this.events.length < STATUS_RULES.maxEvents) this.events.push({ name, target: this.owner, ...data }); }

  // add(id, seconds, data?) — data: { source, stacks, refresh, mult, damage, amount, ... }
  add(id, duration, data = {}) {
    const d = this.def(id);
    if (!(duration > 0) || !Number.isFinite(duration)) return this.map.get(id) || null;
    const { source = null, stacks = 1, refresh = false, ...rest } = data;
    // debuffImmune (e.g. a sanctuary): harmful statuses are resisted while it lasts
    if (IMMUNE_TO.includes(d.category) && this.flag('debuffImmune')) { this.emit('statusResisted', { id, source }); return null; }
    duration = Math.min(STATUS_RULES.maxDuration, duration);
    if (d.category === 'control') duration *= 1 - this.tenacity();
    const cur = this.map.get(id);
    if (cur) {
      const mode = refresh ? 'refresh' : d.stacking || 'longest';
      if (mode === 'longest' && cur.t >= duration) return cur;
      const before = cur.stacks;
      if (mode === 'stack') cur.stacks = Math.min(cur.maxStacks, cur.stacks + Math.max(1, Math.floor(stacks) || 1));
      cur.t = Math.max(mode === 'longest' ? cur.t : 0, duration); cur.total = cur.t;
      Object.assign(cur, rest);
      if (source) { cur.source = source; cur.sourceId = source.id ?? null; }
      if (cur.stacks > before) this.emit('statusStacked', { id, stacks: cur.stacks, source });
      return cur;
    }
    const s = {
      id, t: duration, total: duration, stacks: Math.min(d.maxStacks || 1, Math.max(1, Math.floor(stacks) || 1)),
      maxStacks: d.maxStacks || 1, source, sourceId: source ? source.id ?? null : null,
      tickT: d.dot ? d.dot.interval : 0, ...rest,
    };
    this.map.set(id, s);
    this.emit('statusApplied', { id, stacks: s.stacks, duration, source });
    return s;
  }
  has(id) { return this.map.has(id); }
  get(id) { return this.map.get(id); }
  stacks(id) { const s = this.map.get(id); return s ? s.stacks : 0; }
  list() { return [...this.map.values()]; }
  remove(id) { if (this.map.delete(id)) this.emit('statusRemoved', { id }); }
  clear() { this.map.clear(); this.ticks.length = 0; }
  // remove every status of a category (e.g. cleanse all 'dot' or 'control')
  cleanse(category) { for (const s of this.list()) if (this.defs[s.id].category === category) this.remove(s.id); }

  update(dt) {
    if (!(dt > 0)) return;
    for (const [id, s] of this.map) {
      const d = this.defs[id];
      if (d.dot) {
        const iv = Math.max(0.1, d.dot.interval); // guard: no zero-interval infinite ticks
        s.tickT -= Math.min(dt, s.t);
        let n = 0;
        while (s.tickT <= 1e-9 && n < 10) { s.tickT += iv; n++; this.queueTick(s, d); }
      }
      s.t -= dt;
      if (s.t <= 1e-9) { this.map.delete(id); this.emit('statusExpired', { id }); }
    }
  }
  queueTick(s, d) {
    if (this.ticks.length >= STATUS_RULES.maxEvents) return;
    const per = Number.isFinite(s.damage) ? Math.max(0, s.damage) : d.dot.damage;
    this.ticks.push({ id: s.id, source: s.source, amount: per * s.stacks, type: d.dot.type });
  }
  drainTicks() { const t = this.ticks; this.ticks = []; return t; }
  drainEvents() { const e = this.events; this.events = []; return e; }

  // ---- queries used by movement, combat and skills
  flag(name) { for (const s of this.map.values()) { const f = this.defs[s.id].flags; if (f && f.includes(name)) return true; } return false; }
  canAct() { return !this.flag('cannotAct'); }
  canMove() { return this.canAct() && !this.flag('cannotMove'); }
  canCast() { return this.canAct() && !this.flag('cannotCast'); }
  isVulnerable() { for (const s of this.map.values()) if (this.defs[s.id].vulnerable) return true; return false; }
  modifier(key) {
    let m = 1;
    for (const s of this.map.values()) {
      const d = this.defs[s.id];
      const base = d.modifiers && d.modifiers[key];
      if (base === undefined) continue;
      const v = Number.isFinite(s.mult) ? s.mult : base;
      m *= d.perStack ? Math.pow(v, s.stacks) : v;
    }
    return m;
  }
  moveMult() { return this.canMove() ? this.modifier('moveMult') : 0; }
  damageMult() { return this.modifier('damageMult'); }
  damageTakenMult() { return this.modifier('damageTakenMult'); }

  // shields soak damage first; returns the damage left for HP
  absorb(amount) {
    if (!(amount > 0)) return 0;
    for (const s of this.list()) {
      if (!this.defs[s.id].absorb) continue;
      const soak = Math.min(amount, Math.max(0, s.amount || 0));
      s.amount = (s.amount || 0) - soak;
      amount -= soak;
      if (s.amount <= 0) { this.map.delete(s.id); this.emit('shieldBroken', { id: s.id }); }
      if (amount <= 0) break;
    }
    return amount;
  }
  tenacity() {
    const st = this.owner && this.owner.stats;
    let v = st && Number.isFinite(st.tenacity) ? st.tenacity : 0;
    for (const s of this.map.values()) v += this.defs[s.id].tenacity || 0; // statuses may add tenacity (holy ground)
    return Math.min(STATUS_RULES.maxTenacity, Math.max(0, v));
  }
}
