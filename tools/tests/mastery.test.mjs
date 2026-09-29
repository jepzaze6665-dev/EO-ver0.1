// Unit tests for Skill Mastery (Skill System S3). Run:  node tools/tests/mastery.test.mjs
import { MASTERY } from '../../src/data/skillMastery.js';
import { masteryLevelFor, masteryInfo, addMasteryXp, masteryReward, MasterySystem } from '../../src/progression/masterySystem.js';
import { ClassProgress } from '../../src/progression/classProgress.js';
import { EventBus } from '../../src/core/events.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

// fake game: a player with 2 skills of 'umbral_sword'
function world() {
  const events = new EventBus();
  const skills = { a: { id: 'a', type: 'active' }, b: { id: 'b', type: 'active' } };
  const player = { cls: { id: 'umbral_sword' }, skillSys: { get: (id) => skills[id] || null } };
  const g = { events, time: 0, player, classProgress: new ClassProgress() };
  g.classProgress.switchTo('umbral_sword');
  g.mastery = new MasterySystem(g);
  const xp = (id) => (g.classProgress.peekSkill('umbral_sword', id) || {}).masteryXp || 0;
  return { g, player, xp };
}

console.log('skill mastery');
test('levels from XP, capped at the last threshold', () => {
  eq(masteryLevelFor(0), 0); eq(masteryLevelFor(59), 0); eq(masteryLevelFor(60), 1); eq(masteryLevelFor(99999), MASTERY.thresholds.length - 1);
  const e = { masteryXp: 0 };
  eq(addMasteryXp(e, 200), 2); eq(e.masteryLevel, 2);
  addMasteryXp(e, 1e6); eq(e.masteryXp, MASTERY.thresholds.at(-1), 'no endless grind');
  eq(masteryInfo(e).need, 0);
});
test('rewards are small utility only (no damage field, cooldown ≥ ×0.9)', () => {
  for (const r of MASTERY.rewards) { ok(!('power' in r), 'power'); ok((r.cooldown ?? 1) >= 0.9, 'cd'); }
  eq(masteryReward(0).cooldown, 1); eq(masteryReward(99).cost, MASTERY.rewards.at(-1).cost);
});
test('use + hits (capped per cast) + kill pay XP', () => {
  const { g, player, xp } = world(), X = MASTERY.xp;
  g.events.emit('skillUsed', { caster: player, skillId: 'a' });
  for (let i = 0; i < 10; i++) g.events.emit('skillHit', { source: player, skillId: 'a', target: {}, killed: i === 9 });
  eq(xp('a'), X.use + X.hit * X.hitCapPerCast + X.kill);
});
test('dummies / breakables / other casters / recasts give nothing', () => {
  const { g, player, xp } = world();
  g.events.emit('skillHit', { source: player, skillId: 'a', target: { isDummy: true }, killed: true });
  g.events.emit('skillHit', { source: {}, skillId: 'a', target: {} });
  g.events.emit('skillUsed', { caster: player, skillId: 'a', recast: true });
  g.events.emit('skillUsed', { caster: player, skillId: 'old_class_skill' });
  eq(xp('a'), 0);
  ok(!g.classProgress.peekSkill('umbral_sword', 'old_class_skill'), 'locked skill untouched');
});
test('perfect dodge -> next skill hit pays the bonus once', () => {
  const { g, player, xp } = world(), X = MASTERY.xp;
  g.events.emit('perfectDodge', {});
  g.time = 1;
  g.events.emit('skillHit', { source: player, skillId: 'a', target: {} });
  g.events.emit('skillHit', { source: player, skillId: 'a', target: {} });
  eq(xp('a'), X.hit * 2 + X.afterPerfect);
});
test('combo: casting b right after a hit pays b the combo bonus', () => {
  const { g, player, xp } = world(), X = MASTERY.xp;
  g.events.emit('skillHit', { source: player, skillId: 'a', target: {} });
  g.time = 1;
  g.events.emit('skillUsed', { caster: player, skillId: 'b' });
  eq(xp('b'), X.use + X.combo);
  g.time = 10;
  g.events.emit('skillUsed', { caster: player, skillId: 'b' });
  eq(xp('b'), X.use * 2 + X.combo, 'too late = no combo');
});
test("'skillMasteryUp' fires on a new level", () => {
  const { g, player } = world();
  let got = null;
  g.events.on('skillMasteryUp', (e) => (got = e));
  g.mastery.give('a', 60);
  eq(got && got.level, 1); eq(got.name, 'I');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
