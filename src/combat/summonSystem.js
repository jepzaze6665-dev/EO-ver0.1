import { SUMMON_RULES } from '../data/summons.js';

// SUMMON SYSTEM — generic owned summons (shadow clones today; spirits, turrets or totems tomorrow).
// Rules come from data/summons.js; it never names a class. Pure logic: lifetime, caps, following the
// owner and an action timer. What a summon DOES is class code listening to its events, so this file
// runs in unit tests as-is (tools/tests/summon.test.mjs).
//
// Summon: { id, type, owner, x, y, t, duration, facing, busy, actT, anim, animT, animDur }
//   busy > 0  : the class moved it / it is attacking — it does not follow or act until busy runs out
// Events (onEvent): summonCreated, summonReady (act timer), summonExpired (reason: timeout | replaced |
//                   ownerGone | cleared | ...)
let NEXT_ID = 1;

export class SummonSystem {
  constructor(defs, { onEvent } = {}) {
    this.defs = defs;
    this.list = [];
    this.onEvent = onEvent || null;
  }
  emit(name, data) { if (this.onEvent) this.onEvent(name, data); }
  def(type) { const d = this.defs[type]; if (!d) throw new Error(`Unknown summon "${type}"`); return d; }

  create(owner, type, x, y, opts = {}) {
    const d = this.def(type);
    if (!owner || owner.dead || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    const mine = this.forOwner(owner, type);
    while (mine.length >= (d.maxPerOwner || 1)) this.expire(mine.shift(), 'replaced');
    if (this.list.length >= SUMMON_RULES.maxTotal) this.expire(this.list[0], 'replaced');
    const dur = Number.isFinite(opts.duration) && opts.duration > 0 ? opts.duration : d.duration;
    const s = { id: NEXT_ID++, type, owner, x, y, t: 0, duration: dur, facing: owner.facing || 0, busy: 0, actT: 0, anim: null, animT: 0, animDur: 0, powerMult: d.powerMult ?? 1 };
    this.list.push(s);
    this.emit('summonCreated', { summon: s, owner });
    return s;
  }

  forOwner(owner, type) { return this.list.filter((s) => s.owner === owner && (!type || s.type === type)); }
  count(owner, type) { return owner ? this.forOwner(owner, type).length : this.list.length; }

  expire(s, reason = 'timeout') {
    const i = this.list.indexOf(s);
    if (i < 0) return;
    this.list.splice(i, 1);
    this.emit('summonExpired', { summon: s, owner: s.owner, reason });
  }
  clearOwner(owner, reason = 'cleared') { for (const s of this.forOwner(owner)) this.expire(s, reason); }
  clearAll() { this.list.length = 0; }

  // play an animation of the owner's sprite set for `dur` seconds and hold the summon still
  act(s, anim, dur, busy = dur) { s.anim = anim; s.animT = 0; s.animDur = dur; s.busy = Math.max(s.busy, busy); }

  update(dt) {
    if (!(dt > 0)) return;
    for (const s of [...this.list]) {
      const d = this.defs[s.type], o = s.owner;
      if (!o || o.dead || o.disposed) { this.expire(s, 'ownerGone'); continue; }
      s.t += dt;
      if (s.t >= s.duration) { this.expire(s, 'timeout'); continue; }
      s.busy = Math.max(0, s.busy - dt);
      if (s.anim) { s.animT += dt; if (s.animT >= s.animDur) s.anim = null; }
      if (d.follow && s.busy <= 0) {
        const f = d.follow, a = (o.facing || 0) + f.angle;
        const tx = o.x + Math.cos(a) * f.dist, ty = o.y + Math.sin(a) * f.dist;
        const k = 1 - Math.exp(-(f.speed || 8) * dt);
        const mx = (tx - s.x) * k, my = (ty - s.y) * k;
        s.x += mx; s.y += my;
        if (Math.hypot(mx, my) > 0.4 * dt * 60) s.facing = Math.atan2(my, mx);
        else s.facing = o.facing || s.facing;
      }
      if (d.act && s.busy <= 0) {
        s.actT += dt;
        if (s.actT >= d.act.interval) { s.actT = 0; this.emit('summonReady', { summon: s, owner: o }); }
      }
    }
  }
}
