// Unit tests for Class 2 OATHBREAKER. Run:  node tools/tests/oathbreaker.test.mjs
import { ResourcePool } from '../../src/combat/resourceSystem.js';
import { SkillSystem } from '../../src/combat/skillSystem.js';
import { StatusSet } from '../../src/status/status.js';
import { RESOURCES } from '../../src/data/resources.js';
import { MARKS } from '../../src/data/marks.js';
import { ITEMS } from '../../src/items/items.js';
import { CLASSES } from '../../src/skills/classes.js';
import { CLASS_TREE } from '../../src/data/classTree.js';
import { SKILL_TIERS } from '../../src/data/skillTiers.js';
import { Oathbreaker as O } from '../../src/skills/oathbreaker.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

const noop = new Proxy({}, { get: () => () => {} });
function fakeGame() {
  const marks = new Map();
  const g = {
    time: 10, hitboxes: [], vfx: noop, audio: noop, camera: noop,
    marks: { apply: (t, id) => marks.set(t, id), get: (t, id) => (marks.get(t) === id ? 1 : 0) },
    combat: { spawnHitbox(h) { g.hitboxes.push(h); return h; }, dealDamage() {} },
    world: { hostiles: () => [], setFlag() {} }, events: { emit() {} }, after() {}, slowMo() {},
  };
  const p = { x: 0, y: 0, hp: 320, maxHp: 320, dead: false, game: g, cls: O, stats: { ...O.base } };
  p.status = new StatusSet(p);
  Object.defineProperty(p, 'primaryResource', { get: () => O.resource });
  p.resources = new ResourcePool(O.resources, RESOURCES, { stats: () => p.stats });
  p.gainResource = (n, raw) => p.resources.gain(O.resource, n, { raw });
  p.startAction = (a) => { p.started = a; };
  p.skillSys = new SkillSystem(p, [...O.skills, O.special]);
  return { g, p };
}
const play = (act) => { if (act.start) act.start(); for (const [, fn] of act.events || []) fn(); };

console.log('oathbreaker');
test('class data: registered + playable Class 2 of the Aegis, preset / gear / resource / mark, riskier than the Aegis', () => {
  ok(CLASSES.oathbreaker === O && CLASS_TREE.oathbreaker.playable && CLASS_TREE.oathbreaker.parent === 'aegis_guardian', 'registry');
  ok(O.preset === 'ok' && ITEMS[O.startingGear.weapon] && ITEMS[O.startingGear.armor] && RESOURCES.broken_oath && MARKS.oath_brand, 'data');
  ok(O.base.def < CLASSES.aegis_guardian.base.def && O.guard.reduction < CLASSES.aegis_guardian.guard.reduction && O.base.atk > CLASSES.aegis_guardian.base.atk, 'risk trade');
  for (const s of [...O.skills, O.special]) ok(SKILL_TIERS[s.tier] && s.cooldown > 0, s.id);
});
test('Broken Oath from hits: capped per hit, bosses give more (also capped); DoT ticks give nothing', () => {
  const { g, p } = fakeGame();
  O.on.damageTaken(p, g, { target: p, source: {}, amount: 9999 }); ok(p.resources.get('broken_oath') === O.charge.hurtMax, 'cap');
  p.resources.set('broken_oath', 0); O.on.damageTaken(p, g, { target: p, source: { isBoss: true }, amount: 9999 }); ok(p.resources.get('broken_oath') === O.charge.bossMax, 'boss cap');
  p.resources.set('broken_oath', 0); O.on.damageTaken(p, g, { target: p, source: {}, amount: 50, opts: { dot: true } }); ok(p.resources.get('broken_oath') === 0, 'dot');
});
test('Defiant Guard conversion (capped), block opens Retaliation, Perfect Guard +25 (Pain Repaid) + riposte', () => {
  const { g, p } = fakeGame();
  O.on.damageBlocked(p, g, { target: p, amount: 9999 }); ok(p.resources.get('broken_oath') === O.charge.blockMax, 'block cap');
  O.onGuardBlock(p, g); ok(p.retaliateUntil === g.time + O.retaliation.window, 'window');
  p.resources.set('broken_oath', 0); O.onPerfectGuard(p, g, { x: 20, y: 0 });
  ok(p.resources.get('broken_oath') === 25 && p.started && p.started.name === 'oath_riposte', 'perfect');
});
test('Sinful Counter: needs 20, spends at most 60, power grows with spend, every bonus together stays under the hard cap', () => {
  const { g, p } = fakeGame();
  p.resources.set('broken_oath', 19); ok(!p.skillSys.use('sinful_counter', p, g, 0).ok, 'needs 20');
  p.resources.set('broken_oath', 100); play(p.skillSys.use('sinful_counter', p, g, 0).result);
  ok(p.resources.get('broken_oath') === 40 && g.hitboxes.length === 1, 'spent 60');
  ok(O.counterPower(p, 60) > O.counterPower(p, 20) && near(O.counterPower(p, 999), O.counter.maxPower), 'scaling + cap');
  const t = {}; g.marks.apply(t, 'oath_brand'); p.hp = 10; p.status.add('oath_of_ruin', 5); p.status.add('forbidden_oath', 5);
  ok(O.counterPower(p, 999, t, true) === O.counter.hardCap, 'hard cap');
});
test('Oath of Ruin: more damage dealt AND taken, less DEF', () => {
  const s = new StatusSet({}); s.add('oath_of_ruin', 8);
  ok(s.damageMult() > 1 && s.damageTakenMult() > 1 && s.modifier('defenseMult') < 1, 'trade-off');
});
test('Oathbreaker Verdict: 60, stores 40% of damage taken (cap 60% max HP), blast ≤ 4.5× when it ends', () => {
  const { g, p } = fakeGame();
  p.resources.set('broken_oath', 59); ok(!p.skillSys.use('oathbreaker_verdict', p, g, 0).ok, 'needs 60');
  p.resources.set('broken_oath', 60); play(p.skillSys.use('oathbreaker_verdict', p, g, 0).result);
  ok(p.status.has('forbidden_oath') && p.status.flag('unshakable'), 'forbidden oath');
  for (let i = 0; i < 50; i++) O.on.damageTaken(p, g, { target: p, source: {}, amount: 100 });
  ok(near(p.verdictStore, p.maxHp * O.verdict.storeCap), 'store cap');
  p.status.remove('forbidden_oath'); O.tick(p, g, 0.05);
  ok(p.started && p.started.name === 'verdict_end' && !p.verdictStore, 'blast starts');
  play(p.started);
  ok(g.hitboxes.slice(-1)[0].power <= O.verdict.maxPower, 'blast capped');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
