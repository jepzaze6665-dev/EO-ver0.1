// Unit tests for the generic status system. Run:  node tools/tests/status.test.mjs
import { StatusSet } from '../../src/status/status.js';
import { STATUSES, STATUS_RULES } from '../../src/data/statuses.js';
import { computeDamage } from '../../src/combat/damageSystem.js';
import { SkillSystem, SKILL_FAIL } from '../../src/combat/skillSystem.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-6) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
let nextId = 1;
const make = (stats = {}) => { const owner = { id: nextId++, stats }; owner.status = new StatusSet(owner); return owner.status; };
const names = (st) => st.drainEvents().map((e) => e.name);

console.log('statusSystem');
test('add / has / expire after its duration (with events)', () => {
  const st = make(); const src = { id: 99 };
  st.add('slow', 2, { source: src });
  ok(st.has('slow') && st.get('slow').sourceId === 99, 'applied with source');
  st.update(1.9); ok(st.has('slow'), 'still active');
  st.update(0.2); ok(!st.has('slow'), 'expired');
  const n = names(st); ok(n[0] === 'statusApplied' && n.includes('statusExpired'), n.join(','));
});
test("stacking 'longest' keeps the longer duration; refresh flag forces reset", () => {
  const st = make();
  st.add('stun', 3); st.add('stun', 1); eq(st.get('stun').t, 3);
  st.add('stun', 1, { refresh: true }); eq(st.get('stun').t, 1);
});
test("stacking 'stack' adds stacks up to maxStacks and refreshes duration", () => {
  const st = make();
  for (let i = 0; i < 20; i++) st.add('poison', 4);
  eq(st.stacks('poison'), STATUSES.poison.maxStacks);
  st.update(3); st.add('poison', 4); eq(st.get('poison').t, 4);
});
test('modifiers: slow / haste multiply move speed; data override (mult)', () => {
  const st = make();
  st.add('slow', 2); eq(st.moveMult(), 0.6);
  st.add('haste', 2, { mult: 1.5 }); eq(st.moveMult(), 0.9);
});
test('perStack modifier: curse increases damage taken per stack', () => {
  const st = make();
  st.add('curse', 5); st.add('curse', 5);
  eq(st.damageTakenMult(), 1.06 * 1.06);
});
test('control flags: stun blocks everything, root blocks movement, silence blocks casting', () => {
  let st = make(); st.add('stun', 1); ok(!st.canAct() && !st.canMove() && !st.canCast() && st.moveMult() === 0, 'stun');
  st = make(); st.add('root', 1); ok(st.canAct() && !st.canMove() && st.canCast() && st.moveMult() === 0, 'root');
  st = make(); st.add('silence', 1); ok(st.canAct() && st.canMove() && !st.canCast(), 'silence');
});
test('tenacity shortens control only, and is capped', () => {
  const st = make({ tenacity: 5 });
  st.add('stun', 10); eq(st.get('stun').t, 10 * (1 - STATUS_RULES.maxTenacity));
  st.add('slow', 10); eq(st.get('slow').t, 10, 'slow is a debuff, not control');
});
test('damage over time: ticks on interval, scales with stacks, stops at expiry', () => {
  const st = make();
  st.add('burn', 2, { stacks: 2 });
  let total = 0, ticks = 0;
  for (let i = 0; i < 300; i++) { st.update(1 / 60); for (const t of st.drainTicks()) { total += t.amount; ticks++; } }
  eq(ticks, 4, 'ticks'); eq(total, 4 * 3 * 2, 'damage');
  ok(!st.has('burn'), 'gone');
});
test('DoT with a huge dt cannot loop forever', () => {
  const st = make(); st.add('burn', 60);
  st.update(1e9); ok(st.drainTicks().length <= 10, 'bounded ticks per update'); ok(!st.has('burn'), 'expired');
});
test('shield absorbs damage before HP and breaks when empty', () => {
  const st = make();
  st.add('shield', 5, { amount: 30 });
  eq(st.absorb(20), 0); eq(st.get('shield').amount, 10);
  eq(st.absorb(25), 15); ok(!st.has('shield'), 'broken');
  ok(names(st).includes('shieldBroken'), 'event');
});
test('cleanse removes a whole category', () => {
  const st = make();
  st.add('burn', 3); st.add('poison', 3); st.add('haste', 3);
  st.cleanse('dot'); ok(!st.has('burn') && !st.has('poison') && st.has('haste'), 'only dots removed');
});
test('invalid input is ignored; unknown status throws; durations capped', () => {
  const st = make();
  for (const d of [0, -1, NaN, Infinity]) st.add('slow', d);
  ok(!st.has('slow'), 'no invalid durations'); st.update(NaN); st.update(-5);
  st.add('slow', 1e6); eq(st.get('slow').t, STATUS_RULES.maxDuration);
  let threw = false; try { st.add('nope', 1); } catch { threw = true; } ok(threw, 'unknown throws');
  eq(st.absorb(NaN), 0);
});
test('event queue is bounded (no leak if nobody drains)', () => {
  const st = make();
  for (let i = 0; i < 1000; i++) { st.add('stun', 1, { refresh: true }); st.remove('stun'); }
  ok(st.events.length <= STATUS_RULES.maxEvents, 'bounded');
});
test('damage system: damageTakenMult and flat (DoT) hits', () => {
  const roll = () => 0.5;
  const base = computeDamage(null, { defense: 0 }, { power: 100 }, roll).amount;
  eq(computeDamage(null, { defense: 0, damageTakenMult: 0.8 }, { power: 100 }, roll).amount, Math.round(base * 0.8));
  const strong = { stats: { atk: 50, crit: 1 } };
  eq(computeDamage(strong, { defense: 0 }, { power: 6, flat: true }, roll).amount, 6, 'flat ignores atk/crit');
  eq(computeDamage(null, { defense: 0, damageTakenMult: NaN }, { power: 10 }, roll).amount, 1, 'NaN mult -> min damage');
});
test('skill system: silence blocks skills with a SILENCED reason', () => {
  const caster = { stats: {}, primaryResource: 'x', resources: { canAfford: () => true, spend: () => true }, status: new StatusSet() };
  const sys = new SkillSystem(caster, [{ id: 'a', cost: 0, cooldown: 1, cast: () => 1 }]);
  caster.status.add('silence', 2);
  eq(sys.use('a').reason === SKILL_FAIL.SILENCED ? 1 : 0, 1);
  caster.status.update(2.1); ok(sys.use('a').ok, 'usable after silence');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
