// UI v2 (U-B): owner's UI icons (tools/build-ui-icons.js -> assets/ui/icons), character window data, POWER. Run:
//   node tools/tests/uiV2.test.mjs
import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
import { powerOf } from '../../src/progression/power.js';
import { CHAR_TABS, BAG_FILTERS } from '../../src/ui/charWindow.js';
const require = createRequire(import.meta.url);
const png = require('../png.js');
const { SHEETS } = require('../build-ui-icons.js');

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const ROOT = new URL('../../', import.meta.url);
const meta = JSON.parse(readFileSync(new URL('assets/ui/icons/icons.json', ROOT)));

test('every icon of the manifest was built, is see-through around and not empty', () => {
  for (const s of SHEETS) for (const n of s.names) {
    const name = s.prefix + n, m = meta[name];
    ok(m && existsSync(new URL(m.file, ROOT)), 'missing ' + name);
    const im = png.read(new URL(m.file, ROOT));
    let solid = 0; for (let i = 3; i < im.data.length; i += 4) if (im.data[i] > 100) solid++;
    ok(solid > 20, name + ' is empty');
    ok(im.data[3] < 30, name + ' corner is not transparent');
  }
});

test('the character window only uses icons that exist', () => {
  for (const x of [...CHAR_TABS, ...BAG_FILTERS]) ok(meta[x.icon], 'no icon ' + x.icon);
  for (const n of ['level_diamond', 'pedestal', 'cur_gold', 'empty_weapon', 'empty_armor', 'empty_relic', 'empty_charm', 'empty_rune']) ok(meta[n], 'no icon ' + n);
  const src = readFileSync(new URL('src/ui/charWindow.js', ROOT), 'utf8');
  for (const m of src.matchAll(/'stat_' \+ STAT_ICON|UI_ICON\('([a-z_]+)'\)/g)) if (m[1]) ok(meta[m[1]], 'charWindow uses missing ' + m[1]);
  for (const m of src.match(/STAT_ICON = \{[^}]+\}/)[0].matchAll(/: '([a-zA-Z]+)'/g)) ok(meta['stat_' + m[1]], 'no stat icon ' + m[1]);
});

test('NPC service panels only use icons that exist', () => {
  const src = readFileSync(new URL('src/ui/panels.js', ROOT), 'utf8');
  const used = [...src.matchAll(/icon: '([a-z_]+)'|UI_ICON('([a-z_]+)')/g)].map((m) => m[1] || m[2]);
  ok(used.length >= 4, 'npc panels found: ' + used.length);
  for (const n of used) ok(meta[n], 'missing icon ' + n);
});

test('POWER grows with every stat and is a whole number', () => {
  const base = { hp: 300, atk: 20, def: 5, crit: 0.05 };
  const p0 = powerOf(base, 300);
  ok(Number.isInteger(p0) && p0 > 0, 'power ' + p0);
  for (const [k, v] of [['atk', 30], ['def', 15], ['crit', 0.2], ['cdr', 0.1], ['attackSpeed', 0.2], ['critDmg', 0.5], ['physicalDmg', 0.2]]) ok(powerOf({ ...base, [k]: v }, 300) > p0, k + ' should raise power');
  ok(powerOf(base, 600) > p0, 'more HP = more power');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
