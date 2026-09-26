// Unit tests for the generic mark system. Run:  node tools/tests/mark.test.mjs
import { MarkSystem } from '../../src/combat/markSystem.js';
import { MARKS } from '../../src/data/marks.js';
import { REQUIREMENTS } from '../../src/combat/skillSystem.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-9) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
let nextId = 1;
const ent = (extra = {}) => ({ id: nextId++, dead: false, ...extra });
const make = () => { const log = []; const sys = new MarkSystem(MARKS, { onEvent: (n, d) => log.push({ n, ...d }) }); return { sys, log, names: () => log.map((e) => e.n) }; };

console.log('markSystem');
test('apply adds stacks and emits targetMarked', () => {
  const { sys, log } = make(); const e = ent(), src = ent();
  const r = sys.apply(e, 'shadow_mark', { source: src });
  eq(r.stacks, 1); eq(r.added, 1); eq(sys.get(e, 'shadow_mark'), 1);
  ok(log[0].n === 'targetMarked' && log[0].source === src && log[0].target === e, 'event data');
  eq(sys.state(e, 'shadow_mark').sourceId, src.id);
});
test('stacks never exceed maxStacks (no infinite stacks)', () => {
  const { sys } = make(); const e = ent();
  for (let i = 0; i < 50; i++) sys.apply(e, 'shadow_mark');
  sys.apply(e, 'shadow_mark', { stacks: 999 });
  eq(sys.get(e, 'shadow_mark'), 3);
});
test("onMax 'hold' emits markFull once and keeps the stacks", () => {
  const { sys, names } = make(); const e = ent();
  sys.apply(e, 'shadow_mark', { stacks: 3 }); sys.apply(e, 'shadow_mark');
  eq(names().filter((n) => n === 'markFull').length, 1); eq(sys.get(e, 'shadow_mark'), 3);
});
test("onMax 'trigger' consumes automatically and emits markTriggered", () => {
  const { sys, names } = make(); const e = ent();
  sys.apply(e, 'star_mark'); sys.apply(e, 'star_mark');
  const r = sys.apply(e, 'star_mark');
  ok(r.triggered, 'triggered'); eq(r.stacks, 0); eq(sys.get(e, 'star_mark'), 0);
  ok(names().includes('markTriggered'), 'event');
});
test('duration expires the mark and emits markExpired', () => {
  const { sys, names } = make(); const e = ent();
  sys.apply(e, 'star_mark');
  sys.update(5.9); eq(sys.get(e, 'star_mark'), 1);
  sys.update(0.2); eq(sys.get(e, 'star_mark'), 0);
  ok(names().includes('markExpired'), 'event');
});
test('refreshOnStack resets the duration', () => {
  const { sys } = make(); const e = ent();
  sys.apply(e, 'star_mark'); sys.update(5); sys.apply(e, 'star_mark'); sys.update(5);
  eq(sys.get(e, 'star_mark'), 2);
});
test('idle decay: only out of combat, after delay, then every step', () => {
  const { sys } = make(); const e = ent();
  sys.apply(e, 'shadow_mark', { stacks: 3 });
  sys.update(20, { inCombat: () => true }); eq(sys.get(e, 'shadow_mark'), 3, 'no decay in combat');
  const { sys: s2 } = make(); const e2 = ent(); s2.apply(e2, 'shadow_mark', { stacks: 3 });
  const out = { inCombat: () => false };
  s2.update(11.9, out); eq(s2.get(e2, 'shadow_mark'), 3, 'before delay');
  s2.update(0.2, out); eq(s2.get(e2, 'shadow_mark'), 2, 'first drop');
  s2.update(2.6, out); eq(s2.get(e2, 'shadow_mark'), 1, 'second drop after step');
  s2.update(2.6, out); eq(s2.get(e2, 'shadow_mark'), 0, 'gone');
  eq(s2.count(), 0);
});
test('new stack resets the idle timer', () => {
  const { sys } = make(); const e = ent(); const out = { inCombat: () => false };
  sys.apply(e, 'shadow_mark'); sys.update(11, out); sys.apply(e, 'shadow_mark'); sys.update(11, out);
  eq(sys.get(e, 'shadow_mark'), 2);
});
test('consume removes up to n and emits markConsumed', () => {
  const { sys, names } = make(); const e = ent();
  sys.apply(e, 'shadow_mark', { stacks: 3 });
  eq(sys.consume(e, 'shadow_mark', 2), 2); eq(sys.get(e, 'shadow_mark'), 1);
  eq(sys.consume(e, 'shadow_mark', 5), 1); eq(sys.get(e, 'shadow_mark'), 0);
  eq(sys.consume(e, 'shadow_mark'), 0, 'nothing left');
  ok(names().filter((n) => n === 'markConsumed').length === 2, 'two events');
});
test('marks are per entity and per mark type', () => {
  const { sys } = make(); const a = ent(), b = ent();
  sys.apply(a, 'shadow_mark', { stacks: 2 }); sys.apply(a, 'star_mark'); sys.apply(b, 'star_mark', { stacks: 2 });
  eq(sys.get(a, 'shadow_mark'), 2); eq(sys.get(a, 'star_mark'), 1); eq(sys.get(b, 'star_mark'), 2); eq(sys.get(b, 'shadow_mark'), 0);
  eq(sys.list(a).length, 2); eq(sys.count(), 3);
});
test('dead entities: cannot be marked, and are cleaned up on update', () => {
  const { sys } = make(); const e = ent();
  sys.apply(e, 'shadow_mark', { stacks: 2 });
  e.dead = true;
  eq(sys.apply(e, 'shadow_mark').added, 0);
  sys.update(0.016); eq(sys.count(), 0); eq(sys.get(e, 'shadow_mark'), 0);
});
test('invalid input is ignored safely', () => {
  const { sys } = make(); const e = ent();
  for (const n of [0, -2, NaN, Infinity, 0.5]) sys.apply(e, 'shadow_mark', { stacks: n });
  sys.apply(null, 'shadow_mark'); sys.consume(null, 'shadow_mark'); sys.update(NaN); sys.update(-1);
  eq(sys.get(e, 'shadow_mark'), 0); eq(sys.get(null, 'shadow_mark'), 0);
  let threw = false; try { sys.apply(e, 'nope'); } catch { threw = true; } ok(threw, 'unknown mark throws');
});
test("skill requirement type 'mark' reads caster.markCount", () => {
  const { sys } = make(); const c = ent(); c.markCount = (id) => sys.get(c, id);
  const r = { type: 'mark', mark: 'shadow_mark', min: 3 };
  ok(!REQUIREMENTS.mark(c, r), 'not yet'); sys.apply(c, 'shadow_mark', { stacks: 3 }); ok(REQUIREMENTS.mark(c, r), 'ready');
  ok(!REQUIREMENTS.mark({}, r), 'caster without marks');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
