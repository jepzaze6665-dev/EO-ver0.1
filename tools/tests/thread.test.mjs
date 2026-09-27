// Unit tests for the generic thread system + Astral Weaver class data. Run:  node tools/tests/thread.test.mjs
import { ThreadSystem, distToSegment } from '../../src/combat/threadSystem.js';
import { THREADS, THREAD_RULES } from '../../src/data/threads.js';
import { MarkSystem } from '../../src/combat/markSystem.js';
import { MARKS } from '../../src/data/marks.js';
import { SkillSystem, REQUIREMENTS } from '../../src/combat/skillSystem.js';
import { AstralWeaver } from '../../src/skills/astralWeaver.js';
import { RESOURCES } from '../../src/data/resources.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-6) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
let nextId = 1;
const ent = (x, y, extra = {}) => ({ id: nextId++, x, y, radius: 10, dead: false, ...extra });
const make = () => { const log = []; const sys = new ThreadSystem(THREADS, { onEvent: (n, d) => log.push({ n, ...d }) }); return { sys, log, names: () => log.map((e) => e.n) }; };

console.log('threadSystem');
test('distToSegment', () => {
  eq(distToSegment(5, 3, 0, 0, 10, 0), 3); eq(distToSegment(-4, 3, 0, 0, 10, 0), 5); eq(distToSegment(1, 1, 0, 0, 0, 0), Math.SQRT2);
});
test('create: ground points and entity anchors, emits threadCreated', () => {
  const { sys, names } = make(); const o = ent(0, 0), foe = ent(100, 0);
  const th = sys.create(o, 'astral_thread', { x: 0, y: 0 }, { entity: foe });
  ok(th && th.b.entity === foe, 'entity anchor'); eq(sys.count(o), 1); ok(names()[0] === 'threadCreated', 'event');
  foe.x = 150; const [, b] = sys.ends(th); eq(b.x, 150, 'follows the entity');
  foe.dead = true; foe.x = 999; eq(sys.ends(th)[1].x, 150, 'dead entity -> last known point');
});
test('invalid anchors and zero-length threads are rejected; unknown type throws', () => {
  const { sys } = make(); const o = ent(0, 0);
  ok(sys.create(o, 'astral_thread', null, { x: 1, y: 1 }) === null, 'null anchor');
  ok(sys.create(o, 'astral_thread', { x: NaN, y: 0 }, { x: 50, y: 0 }) === null, 'NaN anchor');
  ok(sys.create(o, 'astral_thread', { x: 5, y: 5 }, { x: 5, y: 6 }) === null, 'too short');
  let threw = false; try { sys.create(o, 'nope', { x: 0, y: 0 }, { x: 50, y: 0 }); } catch { threw = true; } ok(threw, 'unknown type');
});
test('length is clamped to maxLength', () => {
  const { sys } = make(); const o = ent(0, 0);
  const th = sys.create(o, 'astral_thread', { x: 0, y: 0 }, { x: 1000, y: 0 });
  eq(th.b.x, THREADS.astral_thread.maxLength);
});
test('maxPerOwner: the oldest thread is replaced (expired with reason)', () => {
  const { sys, log } = make(); const o = ent(0, 0), max = THREADS.astral_thread.maxPerOwner;
  const first = sys.create(o, 'astral_thread', { x: 0, y: 0 }, { x: 50, y: 0 });
  for (let i = 0; i < max + 3; i++) sys.create(o, 'astral_thread', { x: 0, y: i * 20 }, { x: 60, y: i * 20 });
  eq(sys.count(o), max); ok(!sys.list.includes(first), 'oldest gone');
  ok(log.some((e) => e.n === 'threadExpired' && e.reason === 'replaced'), 'replaced event');
});
test('global cap across owners', () => {
  const { sys } = make();
  for (let i = 0; i < 100; i++) sys.create(ent(0, 0), 'astral_thread', { x: 0, y: i }, { x: 60, y: i });
  ok(sys.list.length <= THREAD_RULES.maxTotal, 'capped');
});
test('expires after its duration', () => {
  const { sys, names } = make(); const o = ent(0, 0);
  sys.create(o, 'astral_thread', { x: 0, y: 0 }, { x: 50, y: 0 }, { duration: 2 });
  sys.update(1.9); eq(sys.count(o), 1);
  sys.update(0.2); eq(sys.count(o), 0); ok(names().includes('threadExpired'), 'event');
});
test('owner death removes its threads', () => {
  const { sys } = make(); const o = ent(0, 0);
  sys.create(o, 'astral_thread', { x: 0, y: 0 }, { x: 50, y: 0 });
  o.dead = true; sys.update(0.016); eq(sys.count(), 0);
});
test('touch: only targets on the line, first flag once, re-touch after interval', () => {
  const { sys } = make(); const o = ent(0, 0), on = ent(50, 4), off = ent(50, 80);
  sys.create(o, 'astral_thread', { x: 0, y: 0 }, { x: 100, y: 0 });
  const touches = [];
  const ctx = { targets: () => [on, off], onTouch: (th, t, first) => touches.push([t.id, first]) };
  sys.update(0.016, ctx); sys.update(0.016, ctx);
  eq(touches.length, 1, 'one touch until the interval passes'); ok(touches[0][0] === on.id && touches[0][1], 'first touch');
  sys.update(THREADS.astral_thread.touch.interval + 0.01, ctx); sys.update(0.016, ctx);
  eq(touches.length, 2, 're-touch'); ok(touches[1][1] === false, 'not first anymore');
});
test('trigger / triggerAll consume the threads and return segments', () => {
  const { sys, names } = make(); const o = ent(0, 0), other = ent(0, 0);
  sys.create(o, 'astral_thread', { x: 0, y: 0 }, { x: 50, y: 0 });
  sys.create(o, 'astral_thread', { x: 0, y: 30 }, { x: 50, y: 30 });
  sys.create(other, 'astral_thread', { x: 0, y: 60 }, { x: 50, y: 60 });
  const segs = sys.triggerAll(o, 'burst');
  eq(segs.length, 2); eq(segs[1].ay, 30); ok(segs[0].def === THREADS.astral_thread, 'def attached');
  eq(sys.count(o), 0); eq(sys.count(other), 1, "other owner's threads untouched");
  eq(names().filter((n) => n === 'threadTriggered').length, 2);
  ok(sys.trigger(segs[0].thread) === null, 'cannot trigger twice');
});
test('huge dt / NaN never loops or throws', () => {
  const { sys } = make(); const o = ent(0, 0);
  sys.create(o, 'astral_thread', { x: 0, y: 0 }, { x: 50, y: 0 });
  sys.update(NaN); sys.update(-1); sys.update(1e9, { targets: () => [ent(10, 0)] }); eq(sys.count(), 0);
});

console.log('astral weaver data');
test('class data matches the shared schema', () => {
  const c = AstralWeaver;
  ok(c.id && c.stableId && c.name && c.preset && c.anims, 'identity + preset');
  ok(RESOURCES[c.resource], 'resource exists'); ok(MARKS[c.enemyMark], 'enemy mark exists');
  ok(c.skills.length === 5 && c.special && typeof c.basic === 'function', 'kit');
  for (const s of [...c.skills, c.special]) {
    ok(s.id && s.name && s.type && typeof s.cast === 'function' && s.cooldown > 0, 'skill ' + s.id);
    for (const r of s.requirements || []) ok(REQUIREMENTS[r.type], 'requirement type ' + r.type);
  }
  for (const [k, v] of Object.entries(c.charge)) ok(Number.isFinite(v) && v > 0, 'charge rule ' + k);
  ok(new SkillSystem({ stats: {}, primaryResource: c.resource, resources: {} }, [...c.skills, c.special]), 'registers in SkillSystem');
});
test('Thread Burst needs a thread (value requirement on threadCount)', () => {
  const tb = AstralWeaver.skills.find((s) => s.id === 'thread_burst');
  const r = tb.requirements[0];
  ok(!REQUIREMENTS[r.type]({ threadCount: 0 }, r), 'no thread'); ok(REQUIREMENTS[r.type]({ threadCount: 2 }, r), 'has threads');
});
test('Star Mark: 3 stacks from the Weaver trigger once (Constellation Break), then reset', () => {
  const trig = [];
  const marks = new MarkSystem(MARKS, { onEvent: (n, d) => { if (n === 'markTriggered') trig.push(d); } });
  const p = { id: 1 }, foe = ent(0, 0);
  for (let i = 0; i < 3; i++) marks.apply(foe, AstralWeaver.enemyMark, { source: p });
  eq(trig.length, 1); ok(trig[0].source === p, 'source is the weaver'); eq(marks.get(foe, 'star_mark'), 0);
  marks.apply(foe, 'star_mark', { source: p }); eq(marks.get(foe, 'star_mark'), 1, 'can build again');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
