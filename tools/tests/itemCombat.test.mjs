// Item System G4: the item modifiers that combat reads — counter / magic damage, aggro, taunt power, guard / resource
// generation, resource cost, barrier strength. Run:  node tools/tests/itemCombat.test.mjs
import { Player } from '../../src/player/player.js';
import { StatusSet } from '../../src/status/status.js';
import { STATUS_RULES } from '../../src/data/statuses.js';
import { ResourcePool } from '../../src/combat/resourceSystem.js';
import { RESOURCES } from '../../src/data/resources.js';
import { scoreTarget, pickTarget } from '../../src/combat/targeting.js';
import { ModifierSet } from '../../src/items/modifierSystem.js';
import { ITEMS } from '../../src/items/items.js';
import { MODIFIER_TYPES } from '../../src/data/items/rules.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const near = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-6) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

// a wearer: real Player methods on a small object; mods = item modifier totals
const wearer = (mods = {}, extra = {}) => {
  const p = { team: 1, game: { time: 0 }, ...extra };
  p.gearMod = (t) => mods[t] || 0;
  for (const k of ['gearHitMult', 'gearDamageTakenMult', 'syncGearResources']) p[k] = Player.prototype[k];
  Object.defineProperty(p, 'aggro', { get: () => p.gearMod('aggro') });
  return p;
};
const foe = (statuses = []) => ({ team: 2, status: { has: (id) => statuses.includes(id) } });
const totals = (...ids) => { const m = new ModifierSet(); for (const id of ids) for (const x of ITEMS[id].modifiers) m.addModifier(id, x); return m; };

console.log('damage');
test('counterDamage: counter strikes and hits on a foe in a Counter Window, not ordinary hits', () => {
  const p = wearer({ counterDamage: 0.3 });
  near(p.gearHitMult(foe(), { counter: true }), 1.3); near(p.gearHitMult(foe(['counter_window']), {}), 1.3);
  near(p.gearHitMult(foe(), {}), 1); near(p.gearHitMult({ team: 1 }, { counter: true }), 1, 'allies never');
});
test('magicDamage: magic types only (holy / shadow / lightning ...), never physical', () => {
  const p = wearer({ magicDamage: 0.2 });
  near(p.gearHitMult(foe(), { type: 'holy' }), 1.2); near(p.gearHitMult(foe(), { type: 'shadow' }), 1.2);
  near(p.gearHitMult(foe(), { type: 'physical' }), 1); near(p.gearHitMult(foe(), {}), 1);
});
test('bonuses multiply: magic counter + next-hit bonus', () => {
  const p = wearer({ magicDamage: 0.2, counterDamage: 0.3 }); p.itemNextHit = { mult: 1.3, until: 5 };
  near(p.gearHitMult(foe(), { type: 'holy', counter: true }), 1.2 * 1.3 * 1.3); ok(!p.itemNextHit, 'bonus used');
});
test('damageReduction lowers damage taken (capped 40% by the modifier rules)', () => {
  near(wearer({ damageReduction: 0.25 }).gearDamageTakenMult(), 0.75);
  ok(MODIFIER_TYPES.damageReduction.max <= 0.4, 'cap');
});
test('Counter Core + Risk Armor = +45% counter damage (the Counter build)', () => near(totals('core_counter', 'armor_risk').getModifierValue('counterDamage'), 0.45));

console.log('aggro / taunt');
test('aggro raises the enemy targeting score; the aggro player is picked over a closer one', () => {
  const e = { x: 0, y: 0, status: null }, plain = wearer({}, { x: 100, y: 0, hp: 100, maxHp: 100 }), tank = wearer({ aggro: 0.8 }, { x: 200, y: 0, hp: 100, maxHp: 100 });
  ok(scoreTarget(e, tank) > scoreTarget(e, wearer({}, { x: 200, y: 0, hp: 100, maxHp: 100 })), 'score up');
  eq(pickTarget(e, [plain, tank]), tank);
  eq(pickTarget(e, [plain, wearer({}, { x: 200, y: 0, hp: 100, maxHp: 100 })]), plain, 'no aggro: the closer one');
});
test('a taunt still beats any aggro', () => {
  const plain = wearer({}, { x: 300, y: 0, hp: 100, maxHp: 100 }), tank = wearer({ aggro: 2 }, { x: 10, y: 0, hp: 100, maxHp: 100 });
  const e = { x: 0, y: 0, status: { get: (id) => (id === 'taunted' ? { source: plain } : null) } };
  eq(pickTarget(e, [plain, tank]), plain);
});
test('tauntPower lengthens taunts from that source only; capped by the status max duration', () => {
  const s = new StatusSet({ id: 9 });
  s.add('taunted', 8, { source: wearer({ tauntPower: 0.25 }) }); near(s.get('taunted').t, 10);
  const s2 = new StatusSet({ id: 10 }); s2.add('taunted', 8, { source: wearer({}) }); near(s2.get('taunted').t, 8);
  const s3 = new StatusSet({ id: 11 }); s3.add('stun', 1, { source: wearer({ tauntPower: 1 }) }); near(s3.get('stun').t, 1, 'other statuses untouched');
  const s4 = new StatusSet({ id: 12 }); s4.add('taunted', STATUS_RULES.maxDuration, { source: wearer({ tauntPower: 1 }) }); ok(s4.get('taunted').t <= STATUS_RULES.maxDuration, 'cap');
});

console.log('resources');
const pool = () => new ResourcePool(['guard_gauge', 'stamina'], RESOURCES, { stats: () => ({}) });
test('guardGeneration multiplies guard-built resources (data gearGain); resourceGeneration every class resource', () => {
  const p = wearer({ guardGeneration: 0.4 }, { resources: pool() }); p.syncGearResources();
  eq(p.resources.gain('guard_gauge', 10, { raw: true }), 14);
  const q = wearer({ guardGeneration: 0.4, resourceGeneration: 0.25 }, { resources: pool() }); q.syncGearResources();
  eq(q.resources.gain('guard_gauge', 10, { raw: true }), 17.5);
});
test('stamina never takes item modifiers', () => {
  const p = wearer({ resourceGeneration: 1, resourceCost: -0.4 }, { resources: pool() }); p.syncGearResources();
  p.resources.set('stamina', 0); eq(p.resources.gain('stamina', 10, { raw: true }), 10); eq(p.resources.cost('stamina', 20), 20);
});
test('resourceCost changes skill costs; never below 0', () => {
  const p = wearer({ resourceCost: -0.25 }, { resources: pool() }); p.syncGearResources(); eq(p.resources.cost('guard_gauge', 40), 30);
  const q = wearer({ resourceCost: -5 }, { resources: pool() }); q.syncGearResources(); eq(q.resources.cost('guard_gauge', 40), 0);
});
test('taking the items off removes the resource modifiers (sync with no modifiers)', () => {
  const mods = { guardGeneration: 0.4 }, p = wearer(mods, { resources: pool() }); p.syncGearResources();
  delete mods.guardGeneration; p.syncGearResources();
  eq(p.resources.gain('guard_gauge', 10, { raw: true }), 10); eq(p.resources.modifiers.length, 0);
});
test('the resource never goes negative or past max with modifiers', () => {
  const p = wearer({ guardGeneration: 1.5, resourceGeneration: 1 }, { resources: pool() }); p.syncGearResources();
  p.resources.gain('guard_gauge', 90, { raw: true }); eq(p.resources.get('guard_gauge'), RESOURCES.guard_gauge.max);
  ok(p.resources.spend('guard_gauge', 100), 'spend'); eq(p.resources.get('guard_gauge'), 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
