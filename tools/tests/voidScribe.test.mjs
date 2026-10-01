// Unit tests for the Void Scribe (Class 2 of the Astral Weaver). Run:  node tools/tests/voidScribe.test.mjs
// The live-game behaviour (scripts, rewrite, phantoms, chain, seal, null, class change) is checked by C.voidChecks.
import { KIT_PIECES } from '../../src/data/classKits.js';
import { CLASSES } from '../../src/skills/classes.js';
import { CLASS_TREE } from '../../src/data/classTree.js';
import { RESOURCES } from '../../src/data/resources.js';
import { STATUSES } from '../../src/data/statuses.js';
import { SCRIPTS, SCRIPT_RULES } from '../../src/data/scripts.js';
import { SUMMONS } from '../../src/data/summons.js';
import { ITEMS } from '../../src/items/items.js';
import { SKILL_ICONS } from '../../src/data/skillIcons.js';
import { StatusSet } from '../../src/status/status.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const VS = CLASSES.void_scribe;
const all = [...VS.skills, VS.special];

console.log('void scribe');
test('registered, playable Class 2 of the Astral Weaver, own preset / weapon / resource', () => {
  ok(VS && CLASS_TREE.void_scribe.playable && CLASS_TREE.void_scribe.parent === 'astral_weaver', 'tree');
  ok(VS.preset === 'vs' && VS.resource === 'void_ink' && RESOURCES.void_ink && KIT_PIECES[VS.signatureWeapon] && KIT_PIECES[VS.kit.armor], 'data');
});
test('kit: 5 actives + ultimate + Void Seal, each with a tier, icon art and a description; own skills', () => {
  ok(VS.skills.filter((s) => s.type === 'active').length === 5 && VS.skills.some((s) => s.ultimate) && VS.special.id === 'void_seal', 'counts');
  for (const s of all) ok(s.tier && s.desc && SKILL_ICONS[s.id], s.id);
  const others = new Set(['astral_weaver', 'stormcaller'].flatMap((id) => [...CLASSES[id].skills, CLASSES[id].special].map((s) => s.id)));
  ok(all.every((s) => !others.has(s.id)), 'shares a skill id with the Weaver / Stormcaller');
});
test('scripts: every effect is data (label, colour, pulse), REWRITE cycles back, statuses exist', () => {
  ok(SCRIPTS[SCRIPT_RULES.first] && SCRIPT_RULES.max === 3, 'rules');
  for (const d of Object.values(SCRIPTS)) {
    ok(d.label && d.color && d.pulse && SCRIPTS[d.next], d.id);
    ok(!d.pulse.status || STATUSES[d.pulse.status], d.id + ' status');
  }
  let e = SCRIPT_RULES.first; const seen = new Set();
  for (let i = 0; i < 10 && !seen.has(e); i++) { seen.add(e); e = SCRIPTS[e].next; }
  ok(e === SCRIPT_RULES.first && seen.size === Object.keys(SCRIPTS).length, 'the rewrite cycle visits every script');
});
test('void seal = DoTs tick twice as fast (generic dotRate) and the sealed foe deals less', () => {
  const plain = new StatusSet({}), sealed = new StatusSet({});
  for (const s of [plain, sealed]) s.add('void_rot', 5, { damage: 4 });
  sealed.add('void_seal', 5);
  for (let i = 0; i < 30; i++) { plain.update(0.1); sealed.update(0.1); }
  const a = plain.drainTicks().length, b = sealed.drainTicks().length;
  ok(b >= a * 2 - 1 && a >= 2, `${a} vs ${b} ticks in 3 s`);
  ok(sealed.damageMult() < 1 && sealed.damageTakenMult() > 1, 'weaken / amplify');
});
test('Endless Script: +12% per extra harmful effect, capped at +36%', () => {
  const st = new StatusSet({}), t = { status: st }, p = { cls: VS };
  ok(VS.endlessMult(p, t) === 1, 'none');
  st.add('void_rot', 5); st.add('slow', 5);
  ok(Math.abs(VS.endlessMult(p, t) - 1.12) < 1e-9, 'two effects ' + VS.endlessMult(p, t));
  st.add('sable_mark', 5); st.add('silence', 5); st.add('void_seal', 5); st.add('nulled', 5);
  ok(Math.abs(VS.endlessMult(p, t) - 1.36) < 1e-9, 'capped ' + VS.endlessMult(p, t));
});
test('ink is budgeted per second; deaths are capped per window', () => {
  const gains = [];
  const p = { cls: VS, inkBudget: VS.ink.perSec, resources: { gain: (id, n) => gains.push(n) } };
  let got = 0; for (let i = 0; i < 50; i++) got += VS.writeInk(p, null, 1, 'test');
  ok(got === VS.ink.perSec, 'budget ' + got);
  ok(VS.ink.deathCap >= VS.ink.death && VS.ink.deathWindow > 0, 'death cap');
});
test('phantoms: summon data drawn from its own art, 3 max (Phantom Quill keeps 2), Phantom Ward', () => {
  const s = SUMMONS.void_phantom;
  ok(s && s.maxPerOwner === 3 && VS.phantom.cap === 2 && s.visual.sprite.key === 'vs_phantom', 'data');
  ok(STATUSES.phantom_ward.modifiers.damageTakenMult < 1, 'ward');
});
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
