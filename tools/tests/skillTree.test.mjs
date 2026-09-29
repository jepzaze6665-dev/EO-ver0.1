// Unit tests for Skill Tree + Class Level (Skill System S5). Run:  node tools/tests/skillTree.test.mjs
import { SKILL_TREE, skillUnlockCheck } from '../../src/data/skillTree.js';
import { ClassProgress } from '../../src/progression/classProgress.js';
import { SkillSystem, SKILL_FAIL } from '../../src/combat/skillSystem.js';
import { expToNext } from '../../src/progression/experience.js';
import { CLASSES } from '../../src/skills/classes.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

const UB = CLASSES.umbral_sword, all = [...UB.skills, UB.special];
const byId = (id) => all.find((s) => s.id === id);
const ctx = (lv) => ({ classLevel: lv, skill: byId, nameOf: (id) => byId(id).name });

console.log('skill tree + class level');
test('Umbral tree order: Slash 1 · Step 2 · Twin Fang 4 · Arc 6 · Veil 8 · Phantom Edge 10 · ult 10', () => {
  const at = (id) => (byId(id).unlock && byId(id).unlock.classLevel) || 1;
  eq(at('shadow_slash'), 1); eq(at('shade_step'), 2); eq(at('twin_fang'), 4); eq(at('shadow_arc'), 6);
  eq(at('shadow_veil'), 8); eq(at('phantom_edge'), 10); eq(at('eclipse_sever'), 10); eq(at('shadow_break'), 1);
});
test('every skill names a known category', () => {
  for (const s of all) ok(SKILL_TREE.categories[s.category], s.id);
});
test('unlock by class level, prerequisites must be unlocked too', () => {
  ok(skillUnlockCheck(byId('shadow_slash'), ctx(1)).ok, 'slash at 1');
  eq(skillUnlockCheck(byId('twin_fang'), ctx(3)).missing.join(), 'Class LV 4');
  ok(skillUnlockCheck(byId('twin_fang'), ctx(4)).ok, 'fang at 4');
  const fake = { unlock: { classLevel: 1, requires: ['twin_fang'] } };
  eq(skillUnlockCheck(fake, ctx(2)).missing.join(), 'Twin Fang');
  ok(skillUnlockCheck({ id: 'free' }, ctx(1)).ok, 'no unlock data = open');
});
test('unlockAll (dev tools) opens everything', () => {
  SKILL_TREE.unlockAll = true;
  try { ok(skillUnlockCheck(byId('eclipse_sever'), ctx(1)).ok, 'open'); } finally { SKILL_TREE.unlockAll = false; }
});
test('SkillSystem refuses a locked skill: nothing spent, no cooldown', () => {
  let spent = 0;
  const caster = { stats: {}, resources: { canAfford: () => true, spend: () => spent++, has: () => false }, skillUnlocked: () => false };
  const sys = new SkillSystem(caster, [{ id: 'k', cooldown: 3, cost: 5, cast: () => null }]);
  eq(sys.use('k').reason, SKILL_FAIL.LOCKED); eq(spent, 0); ok(sys.cooldowns.ready('k'), 'no cooldown');
});
test('class EXP levels a class on its own; sync copies the character level', () => {
  const cp = new ClassProgress();
  eq(cp.addClassExp('nightfall_reaper', expToNext(1) + expToNext(2)), 2);
  eq(cp.classes.nightfall_reaper.level, 3);
  cp.syncLevel('umbral_sword', 12, 5);
  eq(cp.classes.umbral_sword.level, 12); eq(cp.classes.umbral_sword.exp, 5);
  eq(cp.classes.nightfall_reaper.level, 3, 'other class untouched');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
