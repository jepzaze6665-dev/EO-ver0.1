// Unit tests for the per-class skill progression data (Skill System S7). Run:  node tools/tests/skillProgression.test.mjs
import { CLASSES, STARTING_CLASSES } from '../../src/skills/classes.js';
import { SKILL_TREE } from '../../src/data/skillTree.js';
import { SKILL_PROGRESSION } from '../../src/data/skillProgression.js';
import { levelMods, maxLevel } from '../../src/progression/skillLevels.js';
import { TRAIT_TEXT } from '../../src/progression/skillTraits.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

const skillsOf = (c) => [...c.skills, c.special].filter(Boolean);
const allIds = new Set(Object.values(CLASSES).flatMap((c) => skillsOf(c).map((s) => s.id)));
const TRAITS = new Set(Object.keys(TRAIT_TEXT));

console.log('skill progression data (every class)');
test('every progression entry names a real skill', () => {
  for (const id of Object.keys(SKILL_PROGRESSION)) ok(allIds.has(id), 'unknown skill ' + id);
});
test('every skill of every class has a category', () => {
  for (const c of Object.values(CLASSES)) for (const s of skillsOf(c)) ok(SKILL_TREE.categories[s.category], `${c.id}/${s.id}`);
});
test('every active skill has 5 levels; Lv 5 adds behaviour (flag / value / charge), not only damage', () => {
  for (const c of Object.values(CLASSES)) for (const s of c.skills.filter((x) => x.type === 'active')) {
    ok(maxLevel(s) === 5, `${c.id}/${s.id} has ${maxLevel(s)} levels`);
    const m = levelMods(s, 5);
    ok(Object.keys(m.flags).length || Object.keys(m.values).length || m.charges, `${c.id}/${s.id} Lv5 is numbers only`);
    ok(m.power <= 1.3, `${c.id}/${s.id} Lv5 power creep`);
  }
});
test('ultimates and specials stay at 1 level', () => {
  for (const c of Object.values(CLASSES)) for (const s of skillsOf(c).filter((x) => x.type !== 'active')) ok(maxLevel(s) === 1, `${c.id}/${s.id}`);
});
test('every class has at least one skill with 2+ evolutions, each with a known trait or class flag', () => {
  for (const c of Object.values(CLASSES)) {
    const evs = skillsOf(c).filter((s) => (s.evolutions || []).length >= 2);
    ok(evs.length, c.id + ' has no evolution');
    for (const s of evs) for (const e of s.evolutions) {
      const flags = Object.keys(e.flags || {});
      ok(flags.length || e.charges, `${s.id}/${e.id} changes nothing`);
      if (c.id !== 'umbral_sword') ok(flags.every((f) => TRAITS.has(f)) , `${s.id}/${e.id} flag without core support: ${flags}`);
    }
  }
});
test('starting classes have a tree (unlocks); Class 2 skills are all open at the character level', () => {
  for (const id of STARTING_CLASSES) ok(skillsOf(CLASSES[id]).some((s) => s.unlock), id + ' no unlocks');
  for (const [id, c] of Object.entries(CLASSES)) if (!STARTING_CLASSES.includes(id)) ok(skillsOf(c).every((s) => !s.unlock), id + ' Class 2 has unlocks');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
