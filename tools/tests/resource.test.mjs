// Unit tests for the generic resource system. Run:  node tools/tests/resource.test.mjs
import { ResourcePool } from '../../src/combat/resourceSystem.js';
import { RESOURCES } from '../../src/data/resources.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-9) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const make = (stats = {}, ids = ['shadow_gauge', 'astral_charge']) => new ResourcePool(ids, RESOURCES, { stats: () => stats });

console.log('resourceSystem');
test('starts at data-defined values', () => { const p = make(); eq(p.get('shadow_gauge'), 40); eq(p.get('astral_charge'), 0); });
test('gain applies the gain stat; raw gain ignores it', () => {
  const p = make({ shadowGain: 1.5 });
  p.gain('shadow_gauge', 10); eq(p.get('shadow_gauge'), 55);
  p.gain('shadow_gauge', 10, { raw: true }); eq(p.get('shadow_gauge'), 65);
});
test('never exceeds max, never negative', () => {
  const p = make();
  p.gain('shadow_gauge', 1e9, { raw: true }); eq(p.get('shadow_gauge'), 100);
  p.set('shadow_gauge', -500); eq(p.get('shadow_gauge'), 0);
});
test('spend succeeds only when affordable, and deducts exactly', () => {
  const p = make();
  ok(p.spend('shadow_gauge', 30), 'should afford 30 of 40'); eq(p.get('shadow_gauge'), 10);
  ok(!p.spend('shadow_gauge', 11), 'should not afford 11 of 10'); eq(p.get('shadow_gauge'), 10);
});
test('invalid numbers are ignored (NaN / Infinity / negative gain)', () => {
  const p = make();
  p.gain('shadow_gauge', NaN); p.gain('shadow_gauge', Infinity); p.gain('shadow_gauge', -20); p.set('shadow_gauge', NaN);
  eq(p.get('shadow_gauge'), 40);
  ok(!p.spend('shadow_gauge', NaN) && !p.spend('shadow_gauge', -5), 'invalid spends rejected'); eq(p.get('shadow_gauge'), 40);
});
test('out-of-combat regen follows data, none in combat', () => {
  const p = make(); p.set('shadow_gauge', 0);
  p.update(1, { inCombat: true }); eq(p.get('shadow_gauge'), 0);
  p.update(2, { inCombat: false }); eq(p.get('shadow_gauge'), 8);
});
test('decay waits for its delay, then drains, stopping at 0', () => {
  const p = make(); p.gain('astral_charge', 50, { raw: true });
  p.update(2); eq(p.get('astral_charge'), 50, 'still inside 3s delay');
  p.update(1.5); ok(p.get('astral_charge') < 50, 'decaying after delay');
  for (let i = 0; i < 100; i++) p.update(1); eq(p.get('astral_charge'), 0);
});
test('gaining resets the decay delay', () => {
  const p = make(); p.gain('astral_charge', 50, { raw: true });
  p.update(2.9); p.gain('astral_charge', 1, { raw: true }); p.update(2.9); eq(p.get('astral_charge'), 51);
});
test('modifiers: maxAdd, gainMult, costMult; removal re-clamps', () => {
  const p = make();
  p.addModifier({ id: 'ring', resource: 'shadow_gauge', kind: 'maxAdd', value: 50 }); eq(p.max('shadow_gauge'), 150);
  p.fill('shadow_gauge'); eq(p.get('shadow_gauge'), 150);
  p.removeModifier('ring'); eq(p.get('shadow_gauge'), 100, 're-clamped');
  p.addModifier({ id: 'x', resource: 'shadow_gauge', kind: 'costMult', value: 0.5 });
  ok(p.spend('shadow_gauge', 100), 'half cost'); eq(p.get('shadow_gauge'), 50);
  p.addModifier({ id: 'g', resource: 'shadow_gauge', kind: 'gainMult', value: 2 });
  p.gain('shadow_gauge', 10, { raw: true }); eq(p.get('shadow_gauge'), 70);
});
test('onChange fires for discrete changes but not for silent regen', () => {
  let n = 0; const p = new ResourcePool(['shadow_gauge'], RESOURCES, { onChange: () => n++ });
  p.gain('shadow_gauge', 5, { raw: true }); eq(n, 1);
  for (let i = 0; i < 60; i++) p.update(1 / 60); eq(n, 1);
});
test('no infinite resource: 10k random operations stay within [0, max]', () => {
  const p = make({ shadowGain: 3 });
  for (let i = 0; i < 10000; i++) {
    const r = Math.random();
    if (r < 0.4) p.gain('shadow_gauge', Math.random() * 80); else if (r < 0.8) p.spend('shadow_gauge', Math.random() * 60); else p.update(Math.random());
    const v = p.get('shadow_gauge'); if (!(v >= 0 && v <= 100)) throw new Error('out of range ' + v);
  }
});
test('unknown resource id is rejected at construction', () => {
  let threw = false; try { make({}, ['nope']); } catch { threw = true; } ok(threw, 'should throw');
});
test('serialize / load round-trip', () => {
  const p = make(); p.set('shadow_gauge', 77); const q = make(); q.load(p.serialize()); eq(q.get('shadow_gauge'), 77);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
