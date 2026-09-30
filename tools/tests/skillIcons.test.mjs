// Skill icon art (tools/build-icons.js -> assets/icons, map in src/data/skillIcons.js). Run:  node tools/tests/skillIcons.test.mjs
import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import { CLASSES } from '../../src/skills/classes.js';
import { SKILL_ICONS } from '../../src/data/skillIcons.js';
const require = createRequire(import.meta.url);
const png = require('../png.js');

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const ROOT = new URL('../../', import.meta.url);
const meta = JSON.parse(readFileSync(new URL('assets/icons/icons.json', ROOT)));
const skillIds = new Set(Object.values(CLASSES).flatMap((c) => [...c.skills, c.special].filter(Boolean).map((s) => s.id)));

console.log('skill icons');
test('every mapped skill exists in some class', () => {
  for (const id of Object.keys(SKILL_ICONS)) ok(skillIds.has(id), 'no skill ' + id);
});
test('every mapped icon was built and its file exists (64 × 64)', () => {
  for (const [id, key] of Object.entries(SKILL_ICONS)) {
    ok(meta[key], `${id}: icon ${key} not in icons.json`);
    const url = new URL(meta[key].file, ROOT);
    ok(existsSync(url), 'no file ' + meta[key].file);
    const im = png.read(url); ok(im.width === 64 && im.height === 64, `${key} ${im.width}x${im.height}`);
  }
});
test('no two skills of one class share an icon', () => {
  for (const c of Object.values(CLASSES)) {
    const keys = [...c.skills, c.special].filter(Boolean).map((s) => SKILL_ICONS[s.id]).filter(Boolean);
    ok(new Set(keys).size === keys.length, c.id + ' repeats an icon');
  }
});
test('every playable class shows art on (almost) all its skills', () => {
  for (const c of Object.values(CLASSES)) {
    const list = [...c.skills, c.special].filter(Boolean), missing = list.filter((s) => !SKILL_ICONS[s.id]);
    ok(missing.length <= 1, `${c.id}: no icon for ${missing.map((s) => s.id).join(', ')}`);
  }
});
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
