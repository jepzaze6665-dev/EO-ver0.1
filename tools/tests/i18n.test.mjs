// i18n (src/i18n): Thai table sanity, every literal t('...') in the UI has a Thai entry, Thai line breaking.  Run: node tools/tests/i18n.test.mjs
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { t, tr, setLang, getLang, wrapLines, breakPieces, hasThai } from '../../src/i18n/i18n.js';
import { TH_UI } from '../../src/i18n/th/index.js';
import { LANG } from '../../src/data/lang.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

console.log('i18n');
await test('language list + names', () => { ok(LANG.options.includes(LANG.default), 'default'); for (const l of LANG.options) ok(LANG.names[l], 'name ' + l); });
await test('English is the default and returns the text unchanged, {params} filled', () => {
  ok(getLang() === 'en', 'default lang');
  ok(t('Hello {n}', { n: 3 }) === 'Hello 3', 'fill');
  ok(t('Resume') === 'Resume', 'en passthrough');
});
await test('Thai: translated, falls back to English when missing, params kept', () => {
  setLang('th');
  ok(t('Resume') === TH_UI['Resume'], 'th');
  ok(t('No such string {x}', { x: 1 }) === 'No such string 1', 'fallback');
  ok(t('Begin as {name}', { name: 'Zed' }).includes('Zed'), 'param');
  ok(tr('quests', 'nope', 'name', 'fb') === 'fb', 'tr fallback');
  setLang('en');
});
await test('every Thai entry keeps the same {params} as its English key and is not empty', () => {
  const ps = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
  for (const [k, v] of Object.entries(TH_UI)) { ok(v && v.trim(), 'empty: ' + k); ok(ps(k) === ps(v), 'params differ: ' + k); }
});
await test('every literal t(\'...\') in the UI code has a Thai entry', () => {
  const files = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (n.endsWith('.js')) files.push(p); } };
  walk(join(ROOT, 'src'));
  const missing = [];
  for (const f of files) {
    if (f.replace(/\\/g, '/').includes('/src/i18n/')) continue;
    const src = readFileSync(f, 'utf8');
    const m = src.match(/import \{([^}]*)\} from '[^']*i18n\/i18n\.js'/);
    if (!m) continue;
    const alias = (m[1].split(',').map((x) => x.trim()).find((x) => /^t( as \w+)?$/.test(x)) || '').split(' as ').pop();
    if (!alias) continue;
    const re = new RegExp(`(?<![\\w.$])${alias}\\('((?:[^'\\\\]|\\\\.)*)'`, 'g');
    let k;
    while ((k = re.exec(src))) { const key = k[1].replace(/\\'/g, "'"); if (!(key in TH_UI)) missing.push(`${f.split(/[\\/]/).pop()}: ${key}`); }
  }
  ok(!missing.length, 'no Thai entry for:\n      ' + missing.join('\n      '));
});
await test('labels that come from data (stats, slots, rarities, tiers, triggers, errors, tabs) all have Thai', async () => {
  const { MODIFIER_TYPES, TYPE_LABEL, GEAR_SLOTS, RARITIES, EQUIP_FAIL } = await import('../../src/data/items/rules.js');
  const { SKILL_TIERS } = await import('../../src/data/skillTiers.js');
  const { SKILL_TREE } = await import('../../src/data/skillTree.js');
  const { AUDIO_BUSES } = await import('../../src/data/sounds.js');
  const { PARTY } = await import('../../src/data/party.js');
  const { TRIGGER_TEXT } = await import('../../src/ui/itemTooltip.js');
  const { CHAR_TABS, BAG_FILTERS } = await import('../../src/ui/charWindow.js');
  const { finalStatRows } = await import('../../src/ui/loadoutUI.js');
  const fake = { stats: {}, gearMod: () => 0, maxHp: 1, resources: null };
  const labels = [
    ...Object.values(MODIFIER_TYPES).map((m) => m.label), ...Object.values(TYPE_LABEL).map((s) => s.toUpperCase()), ...Object.values(TYPE_LABEL),
    ...GEAR_SLOTS.map((s) => s.label), ...RARITIES.map((r) => r.toUpperCase()), ...Object.values(EQUIP_FAIL),
    ...Object.values(SKILL_TIERS).map((x) => x.label), ...Object.values(SKILL_TREE.categories).map((c) => c.label),
    ...Object.values(AUDIO_BUSES).map((b) => b.label), PARTY.failed.title, PARTY.failed.text, ...Object.values(TRIGGER_TEXT),
    ...CHAR_TABS.map((x) => x.label), ...BAG_FILTERS.map((x) => x.label), ...finalStatRows(fake).map((r) => r[0]),
    ...['Material', 'Consumable', 'Quest Item', 'Weapon', 'Armor'].map((s) => s.toUpperCase()),
  ];
  const missing = [...new Set(labels)].filter((l) => !(l in TH_UI));
  ok(!missing.length, 'no Thai for: ' + missing.join(' | '));
});
await test('Thai text breaks at word edges and fits the width', () => {
  const text = 'ปาร์ตี้ของคุณล้มลงแล้ว กลับไปที่จุดเช็กพอยต์ เรียนรู้จังหวะของศัตรู แล้วลองใหม่อีกครั้ง';
  ok(hasThai(text), 'hasThai');
  const pieces = breakPieces(text);
  ok(pieces.length > 8, 'segmenter gave ' + pieces.length + ' pieces');
  ok(pieces.join('') === text, 'pieces rejoin');
  const measure = (s) => s.length * 10;
  const lines = wrapLines(text, 200, measure);
  ok(lines.length > 1, 'wrapped');
  ok(lines.every((l) => measure(l) <= 200), 'a line is too wide: ' + lines.map((l) => l.length).join(','));
  ok(lines.join('') .replace(/\s/g, '') === text.replace(/\s/g, ''), 'no text lost');
});
await test('English wrapping keeps words whole', () => {
  const lines = wrapLines('the quick brown fox jumps over the lazy dog', 100, (s) => s.length * 10);
  ok(lines.every((l) => l.length * 10 <= 100), 'width');
  ok(lines.join(' ') === 'the quick brown fox jumps over the lazy dog', 'text: ' + JSON.stringify(lines));
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
