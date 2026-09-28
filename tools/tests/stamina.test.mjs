// Combat 2.0 phase C1 — stamina rules (pure parts). Run:  node tools/tests/stamina.test.mjs
import { ResourcePool } from '../../src/combat/resourceSystem.js';
import { RESOURCES } from '../../src/data/resources.js';
import { STAMINA } from '../../src/data/stamina.js';
import { SkillSystem, SKILL_FAIL } from '../../src/combat/skillSystem.js';
import { CLASSES } from '../../src/skills/classes.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-6) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const pool = () => new ResourcePool(['shadow_gauge', STAMINA.resource], RESOURCES, { stats: () => ({}) });

console.log('stamina');
test('data: max 100, starts full, dodge costs 20-25 (spec §42)', () => {
  const p = pool(); eq(p.max('stamina'), 100); eq(p.get('stamina'), 100);
  ok(STAMINA.dodge >= 20 && STAMINA.dodge <= 25, 'dodge cost');
});
test('regen waits for the delay after spending, then refills', () => {
  const p = pool(); p.spend('stamina', 50);
  p.update(RESOURCES.stamina.regen.delay * 0.5, { inCombat: true }); eq(p.get('stamina'), 50, 'no regen during the delay');
  p.update(RESOURCES.stamina.regen.delay, { inCombat: true }); ok(p.get('stamina') > 50, 'regen after the delay');
  for (let i = 0; i < 100; i++) p.update(0.1, { inCombat: true }); eq(p.get('stamina'), 100, 'full');
});
test('4 dodges in a row empty it; the 5th is not affordable', () => {
  const p = pool(); let n = 0;
  while (p.canAfford('stamina', STAMINA.dodge)) { p.spend('stamina', STAMINA.dodge); n++; }
  eq(n, Math.floor(100 / STAMINA.dodge));
});
test('drain never goes negative and returns what it took', () => {
  const p = pool(); p.set('stamina', 3); eq(p.drain('stamina', 10), 3); eq(p.get('stamina'), 0);
});
test('regen delay does not affect resources without one (shadow gauge)', () => {
  const p = pool(); p.spend('shadow_gauge', 10); p.update(1, { inCombat: false }); eq(p.get('shadow_gauge'), 30 + RESOURCES.shadow_gauge.regen.outOfCombat);
});
test('skill stamina cost: checked, spent with the class cost, fails as STAMINA', () => {
  const c = { resources: pool(), primaryResource: 'shadow_gauge', canAct: () => true, stats: {} };
  const sys = new SkillSystem(c, [{ id: 's', type: 'active', cost: 10, stamina: 30, cooldown: 1, cast: () => 1 }]);
  ok(sys.use('s').ok, 'first use'); eq(c.resources.get('stamina'), 70); eq(c.resources.get('shadow_gauge'), 30);
  c.resources.set('stamina', 5); sys.update(2);
  const r = sys.use('s'); ok(!r.ok && r.reason === SKILL_FAIL.STAMINA, 'stamina fail'); eq(c.resources.get('shadow_gauge'), 30, 'nothing spent');
});
test('Umbral Sword skills cost 8-35 stamina, basic attacks cost none', () => {
  const ub = CLASSES.umbral_sword;
  for (const id of ['shadow_slash', 'twin_fang', 'shade_step', 'shadow_arc', 'eclipse_sever']) {
    const s = ub.skills.find((k) => k.id === id); ok(s && s.stamina >= 8 && s.stamina <= 35, id);
  }
  ok(!ub.skills.some((k) => k.basic && k.stamina), 'basic attacks are free');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
