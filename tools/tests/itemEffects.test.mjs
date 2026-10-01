// Item System G3: triggers -> conditions -> effects, cooldowns, caps, no infinite loops.
// Run:  node tools/tests/itemEffects.test.mjs
import { EventBus } from '../../src/core/events.js';
import { Inventory } from '../../src/inventory/inventory.js';
import { Equipment } from '../../src/equipment/equipment.js';
import { ItemEffectSystem, EFFECT_HANDLERS } from '../../src/items/effectSystem.js';
import { checkCondition, CONDITION_CHECKS } from '../../src/items/conditionSystem.js';
import { TRIGGER_EVENTS, EFFECT_LIMITS } from '../../src/data/items/triggers.js';
import { TRIGGERS, CONDITIONS, EFFECT_TYPES } from '../../src/data/items/rules.js';
import { ResourcePool } from '../../src/combat/resourceSystem.js';
import { Cooldowns } from '../../src/combat/cooldownSystem.js';
import { RESOURCES } from '../../src/data/resources.js';
import { ITEMS } from '../../src/items/items.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

// a small game: real event bus / inventory / equipment / resources / cooldowns, stub combat (records hits)
function game() {
  const g = { time: 0, events: new EventBus(), audio: { sfx() {} }, vfx: { text() {} }, hits: [], marked: new Set() };
  g.combat = { inCombat: true, dealDamage: (src, target, opts) => { g.hits.push({ src, target, opts }); g.events.emit('damageDealt', { source: src, target, amount: opts.power, opts }); } };
  g.marks = { get: (e, id) => (g.marked.has(e) ? 1 : 0), list: (e) => (g.marked.has(e) ? [1] : []) };
  g.inventory = new Inventory(g); g.equipment = new Equipment(g);
  const p = {
    team: 'player', hp: 300, maxHp: 300, dead: false, x: 0, y: 0, primaryResource: 'guard_gauge', cls: { id: 'aegis_guardian' }, recomputed: 0,
    resources: new ResourcePool(['guard_gauge', 'stamina'], RESOURCES, { stats: () => ({}), onChange: (e) => g.events.emit('resourceChanged', { entity: p, ...e }) }),
    skillSys: { skills: { guardian_challenge: { id: 'guardian_challenge', tags: ['taunt', 'defense'] }, guardian_slash: { id: 'guardian_slash', tags: ['attack'] } }, cooldowns: new Cooldowns() },
    status: { added: [], add(id, d, o) { this.added.push({ id, d, o }); } },
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    recomputeStats() { this.recomputed++; this.stats = g.equipment.finalStats({ def: 10, hp: 300 }); },
    gearMod(t) { return g.equipment.getModifierValue(t); },
  };
  g.player = p;
  g.fx = new ItemEffectSystem(g);
  const wear = (...ids) => { for (const id of ids) { g.inventory.add(id); ok(g.equipment.equip(id), 'equip ' + id); } };
  const foe = { team: 'enemy', dead: false, x: 10, y: 0 };
  return { g, p, wear, foe };
}

console.log('data');
test('every trigger / condition / effect name has its runner', () => {
  for (const t of TRIGGERS) ok(TRIGGER_EVENTS[t], 'trigger ' + t);
  for (const c of CONDITIONS) ok(CONDITION_CHECKS[c], 'condition ' + c);
  for (const e of EFFECT_TYPES) ok(EFFECT_HANDLERS[e], 'effect ' + e);
});

console.log('conditions');
test('hpBelow / hpAbove / resourceAbove / resourceBelow / targetHasMark / perfectGuard / inCombat; unknown = false', () => {
  const p = { hp: 80, maxHp: 300, primaryResource: 'guard_gauge', resources: { has: () => true, get: () => 85 } };
  ok(checkCondition({ type: 'hpBelow', value: 0.3 }, p) && !checkCondition({ type: 'hpAbove', value: 0.3 }, p), 'hp');
  ok(checkCondition({ type: 'resourceAbove', value: 80 }, p) && !checkCondition({ type: 'resourceBelow', value: 80 }, p), 'resource');
  const t = {}; ok(checkCondition({ type: 'targetHasMark', mark: 'guardian_mark' }, p, { target: t }, { marks: () => 1 }), 'mark');
  ok(!checkCondition({ type: 'targetHasMark' }, p, { target: t }, { marks: () => 0 }), 'no mark');
  ok(checkCondition({ type: 'perfectGuard' }, p, { perfect: true }) && !checkCondition({ type: 'perfectGuard' }, p, {}), 'perfect');
  ok(checkCondition({ type: 'inCombat' }, p, {}, { inCombat: true }) && !checkCondition({ type: 'inCombat' }, p, {}, {}), 'combat');
  ok(checkCondition(null, p), 'none = true'); ok(!checkCondition({ type: 'moonPhase' }, p), 'unknown = false');
});

console.log('effects');
test('Oath Mirror: Perfect Guard reflects 15% of the blocked damage; 8 s cooldown', () => {
  const { g, p, wear, foe } = game(); wear('relic_oath_mirror');
  g.events.emit('perfectGuard', { player: p, source: foe, blocked: 100 });
  eq(g.hits.length, 1); eq(g.hits[0].target, foe); eq(g.hits[0].opts.power, 15); ok(g.hits[0].opts.itemEffect && g.hits[0].opts.flat, 'item flat damage');
  g.time = 4; g.events.emit('perfectGuard', { player: p, source: foe, blocked: 100 }); eq(g.hits.length, 1, 'cooldown');
  g.time = 8.1; g.events.emit('perfectGuard', { player: p, source: foe, blocked: 100 }); eq(g.hits.length, 2, 'ready again');
});
test('reflect is capped (no infinite damage) and needs a living foe', () => {
  const { g, p, wear, foe } = game(); wear('relic_oath_mirror');
  g.events.emit('perfectGuard', { player: p, source: foe, blocked: 1e9 });
  eq(g.hits[0].opts.power, p.maxHp * EFFECT_LIMITS.reflectMaxHpShare);
  const { g: g2, p: p2, wear: w2 } = game(); w2('relic_oath_mirror');
  g2.events.emit('perfectGuard', { player: p2, source: { team: 'enemy', dead: true }, blocked: 100 }); eq(g2.hits.length, 0, 'dead foe');
  g2.events.emit('perfectGuard', { player: p2, source: null, blocked: 100 }); eq(g2.hits.length, 0, 'no source');
});
test('Guarding Soul: a block gives +4 Guard Gauge (0.5 s cooldown); other players / perfect guards do not', () => {
  const { g, p, wear, foe } = game(); wear('rune_guarding_soul');
  g.events.emit('guardBlocked', { player: p, source: foe, blocked: 20 }); eq(p.resources.get('guard_gauge'), 4);
  g.events.emit('guardBlocked', { player: p, source: foe }); eq(p.resources.get('guard_gauge'), 4, 'cooldown');
  g.time = 0.6; g.events.emit('guardBlocked', { player: {}, source: foe }); eq(p.resources.get('guard_gauge'), 4, 'someone else');
  g.events.emit('guardBlocked', { player: p, source: foe }); eq(p.resources.get('guard_gauge'), 8);
});
test('Iron Will: hit below 40% HP = +20% Defense for 4 s, then back', () => {
  const { g, p, wear, foe } = game(); wear('rune_iron_will'); p.recomputeStats(); const def0 = p.stats.def;
  g.events.emit('damageTaken', { source: foe, target: p, amount: 10, opts: {} }); eq(p.stats.def, def0, 'HP high: nothing');
  p.hp = 100; g.events.emit('damageTaken', { source: foe, target: p, amount: 10, opts: {} });
  ok(p.stats.def > def0, `def up ${def0} -> ${p.stats.def}`); eq(+p.gearMod('defense').toFixed(2), 0.2);
  g.time = 3; g.fx.update(); ok(p.stats.def > def0, 'still on');
  g.time = 4.1; g.fx.update(); eq(p.stats.def, def0, 'expired'); eq(g.fx.timed.size, 0);
});
test('Last Bastion: fires once when HP falls below 30% (damage reduction 25%, 6 s), not on every hit below', () => {
  const { g, p, wear, foe } = game(); wear('relic_last_bastion');
  p.hp = 200; g.events.emit('damageTaken', { source: foe, target: p, amount: 10, opts: {} }); eq(p.gearMod('damageReduction'), 0);
  p.hp = 80; g.events.emit('damageTaken', { source: foe, target: p, amount: 30, opts: {} }); eq(p.gearMod('damageReduction'), 0.25, 'crossed 90 -> 80');
  g.fx.reset(); p.hp = 60; g.events.emit('damageTaken', { source: foe, target: p, amount: 10, opts: {} }); eq(p.gearMod('damageReduction'), 0, 'already below: no new trigger');
});
test('Retribution: Perfect Guard -> next hit +30% within 3 s (one hit)', () => {
  const { g, p, wear, foe } = game(); wear('rune_retribution');
  g.events.emit('perfectGuard', { player: p, source: foe, blocked: 50 });
  ok(p.itemNextHit && p.itemNextHit.mult === 1.3 && p.itemNextHit.until === 3, JSON.stringify(p.itemNextHit));
});
test('Provocation: taunting a foe cuts defensive skill cooldowns by 1 s (cooldown 3 s)', () => {
  const { g, p, wear, foe } = game(); wear('rune_provocation');
  p.skillSys.cooldowns.start('guardian_challenge', 10); p.skillSys.cooldowns.start('guardian_slash', 10);
  g.events.emit('statusApplied', { id: 'taunted', target: foe, source: p });
  eq(p.skillSys.cooldowns.remaining('guardian_challenge'), 9); eq(p.skillSys.cooldowns.remaining('guardian_slash'), 10, 'not defensive');
  g.events.emit('statusApplied', { id: 'taunted', target: { team: 'enemy' }, source: p }); eq(p.skillSys.cooldowns.remaining('guardian_challenge'), 9, 'AoE taunt: once');
  g.events.emit('statusApplied', { id: 'stun', target: foe, source: p }); eq(p.skillSys.cooldowns.remaining('guardian_challenge'), 9, 'not a taunt');
  g.time = 3.1; g.events.emit('statusRefreshed', { id: 'taunted', target: foe, source: p }); eq(p.skillSys.cooldowns.remaining('guardian_challenge'), 8, 'a renewed taunt counts');
});
test('Dawn Core: creating a barrier gives +10 resource (4 s cooldown)', () => {
  const { g, p, wear } = game(); wear('relic_dawn_core');
  g.events.emit('barrierCreated', { owner: p, amount: 50 }); eq(p.resources.get('guard_gauge'), 10);
  g.events.emit('barrierCreated', { owner: p, amount: 50 }); eq(p.resources.get('guard_gauge'), 10, 'cooldown');
});
test('taking the item off: its effects stop and its buffs end at once', () => {
  const { g, p, wear, foe } = game(); wear('rune_iron_will'); p.recomputeStats();
  p.hp = 100; g.events.emit('damageTaken', { source: foe, target: p, amount: 10, opts: {} }); ok(p.gearMod('defense') > 0, 'on');
  g.equipment.unequip('rune1'); g.events.emit('damageTaken', { source: foe, target: p, amount: 1, opts: {} });
  eq(p.gearMod('defense'), 0, 'buff gone'); eq(g.fx.timed.size, 0);
});

console.log('safety');
test('no infinite chain: an effect that gains resource never re-fires a resource-gain effect', () => {
  const { g, p } = game();
  ITEMS.__loop = { ...ITEMS.rune_guarding_soul, id: '__loop', effects: [{ trigger: 'onResourceGain', effect: { type: 'gainResource', resource: 'primary', value: 5 }, cooldown: 0.01, text: 't' }] };
  try {
    g.inventory.add('__loop'); g.equipment.equip('__loop');
    p.resources.gain('guard_gauge', 10, { raw: true }); eq(p.resources.get('guard_gauge'), 15, 'one +5, not a loop');
    for (let i = 0; i < 100; i++) p.resources.gain('guard_gauge', 1, { raw: true });
    ok(p.resources.get('guard_gauge') <= 15 + 100 + 5 * EFFECT_LIMITS.maxPerSecond, `rate capped: ${p.resources.get('guard_gauge')}`);
  } finally { delete ITEMS.__loop; }
});
test('item damage never triggers items (onHit / onKill ignore opts.itemEffect)', () => {
  const { g, p, foe } = game();
  ITEMS.__hit = { ...ITEMS.rune_guarding_soul, id: '__hit', effects: [{ trigger: 'onHit', effect: { type: 'gainResource', resource: 'primary', value: 5 }, cooldown: 0.01, text: 't' }] };
  try {
    g.inventory.add('__hit'); g.equipment.equip('__hit');
    g.events.emit('damageDealt', { source: p, target: foe, amount: 10, opts: { itemEffect: true } }); eq(p.resources.get('guard_gauge'), 0);
    g.events.emit('damageDealt', { source: p, target: foe, amount: 10, opts: {} }); eq(p.resources.get('guard_gauge'), 5);
  } finally { delete ITEMS.__hit; }
});
test('resource never negative / above max; caps on heal, cooldown cut, next-hit bonus', () => {
  const { g, p } = game(), entry = { key: 'k', itemId: 'relic_dawn_core', effect: { duration: 999 } };
  ok(!EFFECT_HANDLERS.gainResource({ value: -50 }, p), 'negative refused'); eq(p.resources.get('guard_gauge'), 0);
  EFFECT_HANDLERS.gainResource({ value: 1e9 }, p); ok(p.resources.get('guard_gauge') <= RESOURCES.guard_gauge.max, 'max');
  p.hp = 1; EFFECT_HANDLERS.heal({ value: 5 }, p); eq(p.hp, 1 + p.maxHp * EFFECT_LIMITS.healMaxShare);
  EFFECT_HANDLERS.nextHitBonus({ value: 50 }, p, {}, g, entry); eq(p.itemNextHit.mult, 1 + EFFECT_LIMITS.nextHitMax); eq(p.itemNextHit.until, EFFECT_LIMITS.durationMax);
  p.skillSys.cooldowns.start('guardian_challenge', 60); EFFECT_HANDLERS.reduceCooldown({ value: 999, tag: 'defense' }, p); eq(p.skillSys.cooldowns.remaining('guardian_challenge'), 60 - EFFECT_LIMITS.cooldownCutMax);
});
test('stacked temporary buffs stay inside the modifier caps', () => {
  const { g, p } = game();
  for (let i = 0; i < 10; i++) g.equipment.addTemp('buff' + i, { type: 'damageReduction', value: 0.3 });
  eq(p.gearMod('damageReduction'), 0.4);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
