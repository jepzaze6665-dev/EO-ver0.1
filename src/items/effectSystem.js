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
import { activeSetBonuses } from './setSystem.js';
import { activeArchetypeBonuses } from './archetypeSystem.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// living foes within r px of (x, y) (World.hostiles minus breakables)
const foesNear = (g, x, y, r) => g.world.hostiles().filter((f) => !f.isBreakable && f.status && Math.hypot(f.x - x, f.y - y) <= r);

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
      if (fx.all ? false : fx.skillId ? sk.id !== fx.skillId : fx.tag ? !(sk.tags || []).includes(fx.tag) : true) continue;
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
  // ---- Character Build B4 (build-making legendaries) ----
  // DETONATE: a DoT status on the target bursts now: stacks × its tick damage × fx.value ticks, then is removed
  detonateStatus(fx, p, ctx, g) {
    const t = ctx.target, s = t && !t.dead && t.status && t.status.get(fx.status);
    if (!s) return false;
    const tick = s.damage || Math.max(1, ((p.stats && p.stats.atk) || 0) * 0.1);
    const amount = Math.min(tick * (s.stacks || 1) * Math.min(fx.value || 3, L.detonateTicksMax), p.maxHp * L.burstMaxHpShare);
    t.status.remove(fx.status);
    g.vfx.ring(t.x, t.y, 6, 46, { life: 0.3, color: '255,80,90', width: 3 });
    g.combat.dealDamage(p, t, { power: amount, flat: true, type: fx.dmgType || 'physical', knock: 0, itemEffect: true, color: '#ff5060' });
    return true;
  },
  // SPREAD: the target's status jumps to foes within fx.radius (same stacks, its own duration)
  spreadStatus(fx, p, ctx, g) {
    const t = ctx.target, s = t && t.status && t.status.get(fx.status);
    if (!s) return false;
    let n = 0;
    for (const f of foesNear(g, t.x, t.y, Math.min(fx.radius || 110, L.radiusMax))) {
      if (f === t || n >= (fx.max || 4)) continue;
      f.status.add(fx.status, Math.max(1, s.t || 3), { source: p, stacks: s.stacks || 1, damage: s.damage });
      g.vfx.bolt ? g.vfx.bolt(t.x, t.y, f.x, f.y, { color: '255,150,60', life: 0.2 }) : 0;
      n++;
    }
    return n > 0;
  },
  // AFTERSHOCK: a phantom strikes the same foe again fx.delay s later for fx.value × the damage of the hit
  aftershock(fx, p, ctx, g) {
    const t = ctx.target;
    if (!t || t.dead || !(ctx.amount > 0) || !g.after) return false;
    const amount = ctx.amount * Math.min(fx.value || 0.4, L.aftershockMax);
    g.after(fx.delay || 0.6, () => {
      if (t.dead || p.dead) return;
      g.vfx.ring(t.x, t.y, 4, 36, { life: 0.25, color: '170,140,255', width: 2 });
      g.combat.dealDamage(p, t, { power: amount, flat: true, type: fx.dmgType || 'shadow', knock: 0, itemEffect: true, color: '#b090ff' });
    });
    return true;
  },
  // NOVA: damage = fx.power × ATK to every foe within fx.radius of you (or of the target with at: 'target')
  nova(fx, p, ctx, g) {
    const c = fx.at === 'target' && ctx.target ? ctx.target : p;
    const r = Math.min(fx.radius || 90, L.radiusMax), power = Math.min(fx.power || 1, L.novaPowerMax);
    const list = foesNear(g, c.x, c.y, r);
    g.vfx.ring(c.x, c.y, 8, r, { life: 0.35, color: fx.color || '255,220,140', width: 3 });
    for (const f of list) g.combat.dealDamage(p, f, { power: ((p.stats && p.stats.atk) || 0) * power, flat: true, type: fx.dmgType || 'physical', knock: 80, itemEffect: true });
    return list.length > 0;
  },
  // EXECUTE: a non-boss, non-elite foe under fx.below of its max HP dies
  executeTarget(fx, p, ctx, g) {
    const t = ctx.target;
    if (!t || t.dead || t.isBoss || t.elite || !(t.maxHp > 0) || t.hp / t.maxHp >= Math.min(fx.below || 0.12, L.executeBelowMax)) return false;
    g.vfx.text(t.x, t.y - 34, 'EXECUTED', { color: '#ff4040', size: 11 });
    g.combat.dealDamage(p, t, { power: (t.hp + 1) * 4, flat: true, type: 'physical', knock: 0, itemEffect: true, color: '#ff4040' }); // ×4 = through armour / DEF
    return true;
  },
  // the next hit within `duration` s deals +value (Player.gearHitMult uses it up)
  // a status on the trigger's target (a foe): fx.status, entry duration (capped); fx.power = DoT per tick per stack
  // as a share of the wearer's ATK (bleed, burn, poison ...)
  applyStatus(fx, p, ctx, g, entry) {
    const t = ctx.target;
    if (!t || t.dead || t === p || t.team === p.team || !t.status || !t.status.add) return false;
    const data = { source: p };
    if (fx.power > 0) data.damage = Math.max(1, Math.round(((p.stats && p.stats.atk) || 0) * Math.min(fx.power, L.dotPowerMax)));
    return !!t.status.add(fx.status, clamp(fx.duration || 3, 0.1, L.statusDurationMax), data);
  },
  // the class mark: a self mark (Umbral Shadow Mark) on the wearer, else the class's enemy mark on the target
  addMark(fx, p, ctx, g) {
    const n = Math.min(fx.value || 1, L.markMax);
    if (p.markId) { const before = p.marks; p.addMark(n); return p.marks > before; }
    const mark = p.cls && p.cls.enemyMark, t = ctx.target;
    if (!mark || !t || t.dead || t.team === p.team || !g.marks) return false;
    return g.marks.apply(t, mark, { source: p, stacks: n, sourceClass: p.cls.id }).added > 0;
  },
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
    const key = eq.buildKey ? eq.buildKey() : GEAR_SLOTS.map((s) => eq.slots[s.id] || '').join('|');
    if (key === this.key) return this.byTrigger;
    this.byTrigger = {};
    for (const s of GEAR_SLOTS) {
      const def = ITEMS[eq.slots[s.id]];
      if (!def) continue;
      def.effects.forEach((effect, i) => {
        (this.byTrigger[effect.trigger] ||= []).push({ key: `${def.id}#${i}`, itemId: def.id, slot: s.id, trigger: effect.trigger, effect, name: def.name, color: def.color });
      });
    }
    // set bonus effects (data/items/sets.js) — on while enough pieces are worn
    for (const a of activeSetBonuses(eq.wornIds())) {
      (a.bonus.effects || []).forEach((effect, i) => {
        (this.byTrigger[effect.trigger] ||= []).push({ key: `${a.key}#${i}`, itemId: null, setId: a.setId, slot: null, trigger: effect.trigger, effect, name: a.set.name + ' (set)', color: a.set.color });
      });
    }
    // archetype tier effects (data/archetypes.js) — on while the build has the points
    if (eq.archetypePoints) for (const a of activeArchetypeBonuses(eq.archetypePoints())) {
      (a.tier.effects || []).forEach((effect, i) => {
        (this.byTrigger[effect.trigger] ||= []).push({ key: `${a.key}#${i}`, itemId: null, archetype: a.id, slot: null, trigger: effect.trigger, effect, name: a.arch.name + ' (build)', color: a.arch.color });
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
    this.log.push({ t: now, itemId: entry.itemId, setId: entry.setId, trigger: entry.trigger, effect: eff.effect.type });
    if (this.log.length > 20) this.log.shift();
    if ((eff.cooldown || 0) >= 3) g.vfx.text(p.x, p.y - 84, entry.name.toUpperCase(), { color: entry.color || '#ffd070', size: 9, life: 1 });
    g.events.emit('itemEffect', { player: p, itemId: entry.itemId, setId: entry.setId, slot: entry.slot, trigger: entry.trigger, effect: eff.effect.type });
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
