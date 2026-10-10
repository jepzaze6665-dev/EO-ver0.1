// Character Build B5: build presets (progression/buildPresets.js) + their storage in classProgress.
// Run:  node tools/tests/buildPresets.test.mjs
import { PRESET_RULES, cleanPreset, cleanPresets, capturePreset, buildSummary } from '../../src/progression/buildPresets.js';
import { ClassProgress } from '../../src/progression/classProgress.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };

console.log('Build presets');
test('capture keeps gear per slot + loadout, drops unknown items', () => {
  const pr = capturePreset('Bleeder', ['shadow_slash', 'twin_fang', null, 'x'], { relic: 'relic_bloodletter', charm: 'nope', rune1: 'rune_reckless' });
  eq(pr.name, 'Bleeder'); eq(pr.gear.relic, 'relic_bloodletter'); eq(pr.gear.rune1, 'rune_reckless');
  ok(!('charm' in pr.gear), 'unknown item dropped'); eq(pr.loadout.length, 4);
});
test('clean: junk -> null, list always PRESET_RULES.count long, long names cut', () => {
  eq(cleanPreset(5), null);
  const l = cleanPresets([{ name: 'x'.repeat(40), gear: {} }]);
  eq(l.length, PRESET_RULES.count); eq(l[0].name.length, PRESET_RULES.nameMax); eq(l[1], null);
});
test('presets survive classProgress save / load, per class', () => {
  const cp = new ClassProgress();
  cp.ensure('umbral_sword').presets = [capturePreset('A', ['shadow_slash'], { relic: 'relic_bloodletter' })];
  cp.ensure('astral_weaver');
  const back = new ClassProgress().load(JSON.parse(JSON.stringify(cp.serialize())));
  eq(cleanPresets(back.classes.umbral_sword.presets)[0].gear.relic, 'relic_bloodletter');
  eq(cleanPresets(back.classes.astral_weaver.presets)[0], null);
});
test('summary: strengths = tiers on, weaknesses = minus lines + rules', () => {
  const s = buildSummary({ critical: { points: 3, items: 3, evolutions: 0 } }, ['core_shadow_fang', 'rune_reckless']);
  eq(s.name, 'Critical');
  ok(s.strengths.some((x) => x.text.includes('Critical')), 'tier 3 strength');
  ok(s.weaknesses.some((x) => x.label === 'Max HP' && x.pct < 0), 'Shadow Fang -HP');
  ok(s.weaknesses.some((x) => x.rule), 'Reckless rule');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
