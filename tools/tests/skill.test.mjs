// Unit tests for the generic skill + cooldown pipeline. Run:  node tools/tests/skill.test.mjs
import { SkillSystem, SKILL_FAIL, MAX_CDR } from '../../src/combat/skillSystem.js';
import { Cooldowns } from '../../src/combat/cooldownSystem.js';
import { ResourcePool } from '../../src/combat/resourceSystem.js';
import { RESOURCES } from '../../src/data/resources.js';
import { UmbralSword } from '../../src/skills/umbralSword.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-9) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

// a fake caster: no DOM, no game — proves the pipeline is class/engine agnostic
function caster(extra = {}) {
  const c = { stats: { cdr: 0 }, marks: 0, busy: false, primaryResource: 'shadow_gauge', casts: 0, ...extra };
  c.resources = new ResourcePool(['shadow_gauge'], RESOURCES, { stats: () => c.stats });
  c.canAct = () => !c.busy;
  return c;
}
const skill = (o = {}) => ({ id: 'test', type: 'active', cost: 10, cooldown: 4, cast: () => 'ACTION', ...o });

console.log('cooldownSystem');
test('start / remaining / ratio / ready', () => {
  const cd = new Cooldowns(); cd.start('a', 4); cd.update(1);
  eq(cd.remaining('a'), 3); eq(cd.ratio('a'), 0.75); ok(!cd.ready('a'), 'not ready');
  cd.update(5); ok(cd.ready('a'), 'ready'); eq(cd.remaining('a'), 0);
});
test('reduceAll never goes negative; invalid durations ignored', () => {
  const cd = new Cooldowns(); cd.start('a', 2); cd.reduceAll(10); eq(cd.remaining('a'), 0);
  cd.start('b', NaN); cd.start('c', -3); ok(cd.ready('b') && cd.ready('c'), 'invalid -> ready');
});

console.log('skillSystem');
test('successful use spends cost, starts cooldown, returns cast result, fires onUsed', () => {
  const c = caster(); let used = null;
  const sys = new SkillSystem(c, [skill()], { onUsed: (e) => (used = e) });
  const r = sys.use('test');
  ok(r.ok, 'ok'); eq(r.result === 'ACTION' ? 1 : 0, 1); eq(c.resources.get('shadow_gauge'), 30);
  eq(sys.cooldowns.remaining('test'), 4); eq(used.skillId === 'test' ? 1 : 0, 1);
});
test('cannot spam: second use fails on cooldown and spends nothing', () => {
  const c = caster(); const sys = new SkillSystem(c, [skill()]);
  sys.use('test'); const r = sys.use('test');
  ok(!r.ok && r.reason === SKILL_FAIL.COOLDOWN, 'cooldown'); eq(c.resources.get('shadow_gauge'), 30);
});
test('usable again after the cooldown elapses', () => {
  const c = caster(); const sys = new SkillSystem(c, [skill()]);
  sys.use('test'); sys.update(4.01); ok(sys.use('test').ok, 'ready again'); eq(c.resources.get('shadow_gauge'), 20);
});
test('unaffordable: fails with RESOURCE, no cooldown, no cast', () => {
  const c = caster(); c.resources.set('shadow_gauge', 5); let cast = 0;
  const sys = new SkillSystem(c, [skill({ cast: () => cast++ })]);
  const r = sys.use('test');
  ok(!r.ok && r.reason === SKILL_FAIL.RESOURCE, 'resource'); eq(cast, 0); ok(sys.cooldowns.ready('test'), 'no cooldown started');
});
test('busy caster: fails with BUSY and onFailed is not spammed', () => {
  const c = caster({ busy: true }); let failed = 0;
  const sys = new SkillSystem(c, [skill()], { onFailed: () => failed++ });
  ok(sys.use('test').reason === SKILL_FAIL.BUSY, 'busy'); eq(failed, 0);
});
test('data requirement (value) gates the skill', () => {
  const c = caster(); const sys = new SkillSystem(c, [skill({ id: 'brk', cost: 0, requirements: [{ type: 'value', key: 'marks', min: 3 }] })]);
  ok(sys.use('brk').reason === SKILL_FAIL.REQUIREMENT, 'needs marks'); c.marks = 3; ok(sys.use('brk').ok, 'with 3 marks');
});
test('cooldown reduction is capped (no zero-cooldown builds)', () => {
  const c = caster({ stats: { cdr: 5 } }); const sys = new SkillSystem(c, [skill()]);
  sys.use('test'); eq(sys.cooldowns.remaining('test'), 4 * (1 - MAX_CDR));
});
test('unknown skill and invalid skill data are rejected', () => {
  const sys = new SkillSystem(caster(), []);
  ok(sys.use('nope').reason === SKILL_FAIL.UNKNOWN, 'unknown');
  let threw = false; try { sys.register({ id: 'x' }); } catch { threw = true; } ok(threw, 'no cast() -> throw');
});
test('Umbral Sword data conforms to the shared schema', () => {
  for (const s of [...UmbralSword.skills, UmbralSword.special]) {
    ok(s.id && s.name && s.type && typeof s.cast === 'function', s.id + ' basic fields');
    ok(Number.isFinite(s.cooldown) && Number.isFinite(s.cost), s.id + ' cooldown/cost numbers');
    ok(Array.isArray(s.tags) && s.targeting, s.id + ' tags/targeting');
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
