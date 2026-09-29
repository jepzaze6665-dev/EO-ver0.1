// Unit tests for skill modifiers + charges (Skill System S6). Run:  node tools/tests/skillModifiers.test.mjs
import { applySkillModifiers, describe, MOD_LIMITS } from '../../src/progression/skillModifiers.js';
import { Cooldowns } from '../../src/combat/cooldownSystem.js';
import { SkillSystem } from '../../src/combat/skillSystem.js';
import { ITEMS } from '../../src/items/items.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const near = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-9) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

const base = { power: 1, area: 1, cooldown: 1, cost: 1, flags: {}, values: {} };
const slash = { id: 'shadow_slash', tags: ['melee', 'shadow'] };

console.log('skill modifiers + charges');
test('MULTIPLY / ADD by skill id and by tag', () => {
  const m = applySkillModifiers(base, [
    { skillId: 'shadow_slash', stat: 'damage', operation: 'MULTIPLY', value: 1.1 },
    { tag: 'shadow', stat: 'damage', operation: 'MULTIPLY', value: 1.05 },
    { skillId: 'shadow_slash', stat: 'resourceGain', operation: 'ADD', value: 5 },
    { skillId: 'other', stat: 'damage', operation: 'MULTIPLY', value: 9 },
  ], slash);
  near(m.power, 1.1 * 1.05); eq(m.resourceGain, 5); eq(m.gear.length, 3);
});
test('limits: cooldown / cost floors, extra charges capped', () => {
  const m = applySkillModifiers(base, [
    { skillId: 'shadow_slash', stat: 'cooldown', operation: 'MULTIPLY', value: 0.1 },
    { skillId: 'shadow_slash', stat: 'cost', operation: 'MULTIPLY', value: 0 },
    { skillId: 'shadow_slash', stat: 'charges', operation: 'ADD', value: 9 },
  ], slash);
  eq(m.cooldown, MOD_LIMITS.cooldown); eq(m.cost, MOD_LIMITS.cost); eq(m.charges, MOD_LIMITS.maxExtraCharges);
});
test('describe() reads like a tooltip', () => {
  eq(describe({ skillId: 'shadow_slash', stat: 'damage', operation: 'MULTIPLY', value: 1.1 }, () => 'Shadow Slash'), 'Shadow Slash: +10% damage');
  eq(describe({ skillId: 'shade_step', stat: 'charges', operation: 'ADD', value: 1 }, () => 'Shade Step'), 'Shade Step: +1 charge(s)');
});
test('the shop items carry valid skill modifiers', () => {
  for (const id of ['hunger_rune', 'shade_charm', 'eclipse_relic']) {
    ok(ITEMS[id] && ITEMS[id].skillModifiers.length, id);
    for (const m of ITEMS[id].skillModifiers) ok((m.skillId || m.tag) && m.stat && m.operation && Number.isFinite(m.value), id);
  }
});
test('charges: 2/2 -> 0/2, each recharges on its own timer', () => {
  const c = new Cooldowns(); c.setMax('s', 2);
  eq(c.charges('s'), 2); c.start('s', 5); eq(c.charges('s'), 1); ok(c.ready('s'), 'still ready');
  c.update(2); c.start('s', 5); eq(c.charges('s'), 0); ok(!c.ready('s'), 'empty');
  near(c.remaining('s'), 3, 'first charge back first');
  c.update(3); eq(c.charges('s'), 1);
  c.update(2); eq(c.charges('s'), 2);
});
test('charges: plain cooldowns unchanged, lowering max keeps it sane', () => {
  const c = new Cooldowns(); c.start('x', 4); ok(!c.ready('x'), 'cd'); eq(c.maxCharges('x'), 1); c.update(4); ok(c.ready('x'), 'back');
  c.setMax('y', 3); c.start('y', 5); c.start('y', 5); c.start('y', 5); eq(c.charges('y'), 0);
  c.setMax('y', 2); eq(c.charges('y'), 0); c.setMax('y', 1); ok(c.ready('y'), 'back to a plain cooldown');
  c.setMax('z', 2); c.start('z', 5); c.reduceAll(5); eq(c.charges('z'), 2, 'reduceAll works on charges');
});
test('SkillSystem: gear charges let a skill be used twice in a row', () => {
  const caster = { stats: {}, resources: { canAfford: () => true, spend() {}, has: () => false }, skillMods: () => ({ cooldown: 1, cost: 1, charges: 1 }) };
  const sys = new SkillSystem(caster, [{ id: 'step', cooldown: 5, cast: () => null }]);
  ok(sys.use('step').ok, '1st'); ok(sys.use('step').ok, '2nd'); eq(sys.use('step').reason, 'cooldown');
  sys.update(5); ok(sys.use('step').ok, 'recharged');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
