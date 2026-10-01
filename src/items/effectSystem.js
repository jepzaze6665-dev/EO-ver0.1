// ITEM EFFECT SYSTEM — runs the effects of the worn gear (relics, runes, ... `effects` in data/items/*.js):
//
//   game event ──> trigger (data/items/triggers.js) ──> condition (conditionSystem.js) ──> effect handler (below)
//
// Event-driven: it subscribes ONCE per event name and does nothing in frames without events (update() only checks
// timed buffs while some exist). Items never edit the combat loop: effects call the same game APIs a skill uses
// (resources.gain, combat.dealDamage, status.add, cooldowns.reduce, equipment.addTemp).
// SAFETY: every effect has a cooldown or a duration (data check), a per-effect rate cap (EFFECT_LIMITS.maxPerSecond),
// value caps per handler, and effects never fire from inside another effect (re-entry guard: no infinite chains, e.g.
// gain resource -> onResourceGain -> gain resource ...). Item damage carries opts.itemEffect so it never re-triggers.
import { ITEMS } from './items.js';
import { checkCondition } from './conditionSystem.js';
import { TRIGGER_EVENTS, LOW_HP_DEFAULT, EFFECT_LIMITS as L } from '../data/items/triggers.js';
import { GEAR_SLOTS } from '../data/items/rules.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// EFFECT HANDLERS — one per effect type (data/items/rules.js EFFECT_TYPES). (fx, p, ctx, g, entry) -> true if it acted.
export const EFFECT_HANDLERS = {
  // a temporary modifier (any MODIFIER_TYPES name) for `duration` s; the same effect firing again refreshes it
  modifyStat(fx, p, ctx, g, entry, sys) {
    const dur = clamp(entry.effect.duration || 5, 0.1, L.durationMax);
    g.equipment.addTemp(entry.key, { type: fx.stat, value: fx.value });
    sys.timed.set(entry.key, { until: g.time + dur, itemId: entry.itemId, stat: fx.stat, value: fx.value });
    return true;
  },
  gainResource(fx, p) {
    const id = !fx.resource || fx.resource === 'primary' ? p.primaryResource : fx.resource;
    if (!p.resources.has(id) || !(fx.value > 0)) return false; // never a negative "gain"
    return p.resources.gain(id, Math.min(fx.value, L.resourceMax), { raw: true, reason: 'item' }) > 0;
  },
  // part of the damage the guard stopped goes back to the attacker (flat damage, capped by the wearer's max HP)
  reflectDamage(fx, p, ctx, g) {
    const foe = ctx.source;
    if (!foe || foe.dead || foe === p || foe.team === p.team || !(ctx.blocked > 0)) return false;
    const amount = Math.min(ctx.blocked * fx.value, p.maxHp * L.reflectMaxHpShare);
    if (!(amount >= 1)) return false;
    g.combat.dealDamage(p, foe, { power: amount, flat: true, knock: 0, hitStop: 0, shake: 0.05, itemEffect: true, color: '#ffd070' });
    return true;
  },
  // skills (by id or by a tag in their data) recover `value` seconds
  reduceCooldown(fx, p) {
    const s = Math.min(fx.value || 0, L.cooldownCutMax);
    if (!(s > 0)) return false;
    let n = 0;
    for (const sk of Object.values(p.skillSys.skills)) {
      if (fx.skillId ? sk.id !== fx.skillId : fx.tag ? !(sk.tags || []).includes(fx.tag) : false) continue;
      if (p.skillSys.cooldowns.remaining(sk.id) > 0) { p.skillSys.cooldowns.reduce(sk.id, s); n++; }
    }
    return n > 0;
  },
  heal(fx, p) {
    if (!(fx.value > 0) || p.hp >= p.maxHp) return false;
    p.heal(p.maxHp * Math.min(fx.value, L.healMaxShare), 'item');
    return true;
  },
  barrier(fx, p, ctx, g, entry) {
    if (!(fx.value > 0)) return false;
    p.status.add('shield', clamp(entry.effect.duration || 6, 0.1, L.durationMax), { amount: Math.round(p.maxHp * Math.min(fx.value, L.barrierMaxShare)), source: p, refresh: true });
    return true;
  },
  // the next hit within `duration` s deals +value (Player.gearHitMult uses it up)
  nextHitBonus(fx, p, ctx, g, entry) {
    p.itemNextHit = { mult: 1 + Math.min(fx.value, L.nextHitMax), until: g.time + clamp(entry.effect.duration || 3, 0.1, L.durationMax), itemId: entry.itemId };
    return true;
  },
};

export class ItemEffectSystem {
  constructor(game) {
    this.game = game;
    this.byTrigger = {}; // trigger -> [entry]
    this.key = null; // which items the index was built from
    this.readyAt = new Map(); // entry key -> game time it may fire again (kept when the item is taken off: no reset trick)
    this.recent = new Map(); // entry key -> [times in the last second] (rate cap)
    this.timed = new Map(); // temporary buffs: entry key -> { until, ... }
    this.depth = 0; // > 0 while an effect runs (re-entry guard)
    this.log = []; // last effects that fired (debug panel / tests)
    const events = new Set(Object.values(TRIGGER_EVENTS).flatMap((t) => [].concat(t.event)));
    for (const ev of events) game.events.on(ev, (e) => this.onEvent(ev, e));
  }
  // the local wearer (party members will carry their own equipment later)
  wearer() { return this.game.player; }
  // index of the worn effects, rebuilt only when the worn items changed
  index() {
    const eq = this.game.equipment;
    const key = GEAR_SLOTS.map((s) => eq.slots[s.id] || '').join('|');
    if (key === this.key) return this.byTrigger;
    this.byTrigger = {};
    for (const s of GEAR_SLOTS) {
      const def = ITEMS[eq.slots[s.id]];
      if (!def) continue;
      def.effects.forEach((effect, i) => {
        (this.byTrigger[effect.trigger] ||= []).push({ key: `${def.id}#${i}`, itemId: def.id, slot: s.id, trigger: effect.trigger, effect });
      });
    }
    // buffs of items no longer worn end now
    for (const [k, t] of this.timed) if (!Object.values(this.byTrigger).some((l) => l.some((x) => x.key === k))) this.endTimed(k, t);
    this.key = key;
    return this.byTrigger;
  }
  onEvent(evName, e) {
    if (this.depth > 0 || !e) return; // nothing fires from inside an effect
    const p = this.wearer();
    if (!p || p.dead) return;
    const idx = this.index();
    for (const [trigger, def] of Object.entries(TRIGGER_EVENTS)) {
      if (!idx[trigger] || !(def.event === evName || (Array.isArray(def.event) && def.event.includes(evName)))) continue;
      if (def.who(e, p) !== p || (def.skip && def.skip(e, p))) continue;
      const ctx = def.ctx(e);
      for (const entry of idx[trigger]) this.tryFire(entry, p, ctx);
    }
  }
  env() {
    const g = this.game;
    return { inCombat: !!(g.combat && g.combat.inCombat), marks: (ent, id) => (id ? g.marks.get(ent, id) : g.marks.list(ent).length) };
  }
  tryFire(entry, p, ctx) {
    const g = this.game, eff = entry.effect, now = g.time;
    if ((this.readyAt.get(entry.key) || -1) > now) return false;
    if (entry.trigger === 'onLowHP') { // fires once per fall below the line
      const line = eff.condition && eff.condition.type === 'hpBelow' ? eff.condition.value : LOW_HP_DEFAULT;
      if (!(p.hp < p.maxHp * line && p.hp + ctx.amount >= p.maxHp * line)) return false;
    }
    if (!checkCondition(eff.condition, p, ctx, this.env())) return false;
    const times = (this.recent.get(entry.key) || []).filter((t) => now - t < 1);
    if (times.length >= L.maxPerSecond) return false;
    const handler = EFFECT_HANDLERS[eff.effect.type];
    if (!handler) return false;
    let acted = false;
    this.depth++;
    try { acted = handler(eff.effect, p, ctx, g, entry, this); } finally { this.depth--; }
    if (!acted) return false;
    times.push(now); this.recent.set(entry.key, times);
    this.readyAt.set(entry.key, now + Math.max(eff.cooldown || 0, 1 / L.maxPerSecond));
    const def = ITEMS[entry.itemId];
    this.log.push({ t: now, itemId: entry.itemId, trigger: entry.trigger, effect: eff.effect.type });
    if (this.log.length > 20) this.log.shift();
    if ((eff.cooldown || 0) >= 3) g.vfx.text(p.x, p.y - 84, def.name.toUpperCase(), { color: def.color || '#ffd070', size: 9, life: 1 });
    g.events.emit('itemEffect', { player: p, itemId: entry.itemId, slot: entry.slot, trigger: entry.trigger, effect: eff.effect.type });
    return true;
  }
  endTimed(key, t) {
    this.timed.delete(key);
    this.game.equipment.removeTemp(key);
    this.game.events.emit('itemEffectEnded', { itemId: t.itemId, key });
  }
  // only timed buffs need time; nothing to do while none is running
  update() {
    if (!this.timed.size) return;
    const now = this.game.time;
    for (const [k, t] of this.timed) if (now >= t.until) this.endTimed(k, t);
  }
  // remaining cooldown per worn effect (debug panel)
  active() {
    const now = this.game.time, out = [];
    for (const list of Object.values(this.index())) for (const x of list) out.push({ ...x, cooldownLeft: Math.max(0, (this.readyAt.get(x.key) || 0) - now), running: this.timed.has(x.key) });
    return out;
  }
  // new session / respawn: no buffs carried over
  reset() { for (const [k, t] of [...this.timed]) this.endTimed(k, t); this.readyAt.clear(); this.recent.clear(); }
}
