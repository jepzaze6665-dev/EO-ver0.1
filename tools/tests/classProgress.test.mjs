// Unit tests for per-class skill progress (Skill System S1). Run:  node tools/tests/classProgress.test.mjs
import { ClassProgress } from '../../src/progression/classProgress.js';
import { parseSave, SAVE_VERSION } from '../../src/save/saveData.js';
import { CLASSES } from '../../src/skills/classes.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

console.log('class progress');
test('switching class keeps the old class entry, its skills and its loadout', () => {
  const cp = new ClassProgress();
  cp.switchTo('umbral_sword');
  Object.assign(cp.skill('umbral_sword', 'twin_fang'), { level: 5, masteryLevel: 3, evolution: 'shadow_fang' });
  const back = cp.switchTo('nightfall_reaper', ['a', 'b', 'c', 'd']);
  eq(back, null, 'new class has no loadout yet');
  eq(cp.active, 'nightfall_reaper');
  eq(cp.peekSkill('umbral_sword', 'twin_fang').level, 5, 'old skill level kept');
  eq(cp.peekSkill('umbral_sword', 'twin_fang').evolution, 'shadow_fang');
  eq(cp.switchTo('umbral_sword', ['x', null, null, null]).join(), 'a,b,c,d', 'old loadout restored');
  eq(cp.classes.nightfall_reaper.loadout[0], 'x', 'reaper loadout remembered');
});
test('only the active class (or sharedClassIds) is usable', () => {
  const cp = new ClassProgress(); cp.switchTo('nightfall_reaper');
  ok(!cp.usable({ id: 's', classId: 'umbral_sword' }), 'old class locked');
  ok(cp.usable({ id: 's', classId: 'nightfall_reaper' }), 'active usable');
  ok(cp.usable({ id: 's', classId: 'umbral_sword', sharedClassIds: ['nightfall_reaper'] }), 'shared usable');
  ok(cp.usable({ id: 's' }, 'nightfall_reaper'), 'owner from the class list');
});
test('lockedSkills lists every skill of the old classes', () => {
  const cp = new ClassProgress(); cp.switchTo('umbral_sword'); cp.switchTo('nightfall_reaper');
  const locked = cp.lockedSkills(CLASSES);
  eq(locked.length, CLASSES.umbral_sword.skills.length);
  ok(locked.every((l) => l.classId === 'umbral_sword' && l.reason === 'old_class'), 'all umbral');
});
test('serialize -> load round trip, junk repaired', () => {
  const cp = new ClassProgress(); cp.switchTo('umbral_sword'); cp.skill('umbral_sword', 'twin_fang').level = 4;
  const again = new ClassProgress().load(JSON.parse(JSON.stringify(cp.serialize())));
  eq(again.peekSkill('umbral_sword', 'twin_fang').level, 4); eq(again.active, 'umbral_sword');
  const bad = new ClassProgress().load({ active: 5, classes: { x: { level: -3, skills: { s: { level: 'no', evolution: 7 } } }, y: 'junk' } });
  eq(bad.active, null); eq(bad.classes.x.level, 1); eq(bad.classes.x.skills.s.level, 1); eq(bad.classes.x.skills.s.evolution, null); ok(!bad.classes.y, 'junk dropped');
});
test('save v3 -> v4 seeds classProgress from the current class + loadout', () => {
  const v3 = { v: 3, player: { classId: 'umbral_sword', loadout: ['twin_fang', null, null, null], level: 3, x: 1, y: 2 } };
  const r = parseSave(JSON.stringify(v3)); ok(r.ok, r.error);
  eq(r.data.v, SAVE_VERSION); eq(r.data.classProgress.active, 'umbral_sword');
  eq(r.data.classProgress.classes.umbral_sword.loadout[0], 'twin_fang');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
