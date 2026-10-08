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
await test('tx: messages — exact, pattern (+ captured piece looked up), "a · b" pieces, unknown unchanged', async () => {
  const { tx } = await import('../../src/i18n/i18n.js');
  ok(tx('Cooldown') === 'Cooldown', 'English untouched');
  setLang('th');
  ok(tx('Cooldown') === TH_UI['Cooldown'], 'exact');
  ok(tx('Wave 2/5') === 'ระลอก 2/5', 'pattern: ' + tx('Wave 2/5'));
  ok(tx('Wolf: inventory full').startsWith('Wolf:'), 'name kept');
  ok(tx('Dungeon entry cancelled — the party changed').includes(TH_UI['the party changed']), 'nested: ' + tx('Dungeon entry cancelled — the party changed'));
  ok(tx('Ann is offline · Bob is not in a city').includes('Bob'), 'pieces');
  ok(tx('Some text nobody knows') === 'Some text nobody knows', 'unknown');
  setLang('en');
});
await test('message patterns compile and use only the groups they capture', async () => {
  const { TH_PATTERNS } = await import('../../src/i18n/th/index.js');
  for (const [re, out] of TH_PATTERNS) {
    const groups = new RegExp(re + '|').exec('').length - 1;
    for (const n of out.match(/\$(\d)/g) || []) ok(+n.slice(1) <= groups, `${re} uses ${n}`);
  }
});
await test('every literal text the server sends to players has Thai (exact or pattern)', async () => {
  const { tx } = await import('../../src/i18n/i18n.js');
  const dir = join(ROOT, 'server'), missing = [];
  setLang('th');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    const src = readFileSync(join(dir, f), 'utf8');
    for (const m of src.matchAll(/(?:refuse\(s, |text: )(['`])((?:(?!\1).)+)\1/g)) {
      const sample = m[2].replace(/\$\{[^}]*\}/g, '7');
      if (tx(sample) === sample) missing.push(`${f}: ${m[2]}`);
    }
  }
  setLang('en');
  ok(!missing.length, 'no Thai for:\n      ' + missing.join('\n      '));
});
await test('T4: every item / set text has Thai, Thai tables name real ids, effect counts match', async () => {
  const { ITEMS, SHOPS } = await import('../../src/items/items.js');
  const { SETS } = await import('../../src/data/items/sets.js');
  const { STATUSES } = await import('../../src/data/statuses.js');
  const { TH_ITEMS, TH_SETS, TH_STATUSES, TH_SHOPS } = await import('../../src/i18n/th/items.js');
  const { tx } = await import('../../src/i18n/i18n.js');
  await import('../../src/i18n/dataText.js');
  const bad = [];
  for (const id of Object.keys(TH_ITEMS)) if (!ITEMS[id]) bad.push('unknown item ' + id);
  for (const id of Object.keys(TH_SETS)) if (!SETS[id]) bad.push('unknown set ' + id);
  for (const id of Object.keys(TH_STATUSES)) if (!STATUSES[id]) bad.push('unknown status ' + id);
  for (const id of Object.keys(TH_SHOPS)) if (!SHOPS[id]) bad.push('unknown shop ' + id);
  for (const [id, d] of Object.entries(ITEMS)) {
    const th = TH_ITEMS[id] || {};
    if ((d.effects || []).length !== (th.effects || []).length) bad.push(`${id}: effects ${(d.effects || []).length} vs Thai ${(th.effects || []).length}`);
  }
  for (const [id, s] of Object.entries(SETS)) if (s.bonuses.length !== ((TH_SETS[id] || {}).bonuses || []).length) bad.push('set bonuses ' + id);
  setLang('th');
  for (const d of Object.values(ITEMS)) for (const s of [d.description, d.modText, ...(d.effects || []).map((e) => e.text)]) if (s && tx(s) === s) bad.push(`${d.id}: "${s}"`);
  for (const s of Object.values(SETS)) for (const x of [s.description, ...s.bonuses.map((b) => b.text)]) if (x && tx(x) === x) bad.push(`set: "${x}"`);
  setLang('en');
  ok(!bad.length, bad.join('\n      '));
});
await test('T3: quests, lore, dialogue lines and map signs all have Thai (place names excepted)', async () => {
  const { QUESTS } = await import('../../src/data/quests.js');
  const { LORE } = await import('../../src/world/narrative.js');
  const { MAPS } = await import('../../src/maps/mapRegistry.js');
  const { tx, txBlock } = await import('../../src/i18n/i18n.js');
  const isName = (s) => /^[A-Z0-9][\w'’-]*( (of|the|to|and|[A-Z0-9(][\w'’()-]*))*$/.test(s); // "Whispering Forest", "Magma Rift"
  const miss = [];
  setLang('th');
  const need = (s, where) => { if (s && !isName(s) && txBlock(s) === s) miss.push(`${where}: ${s.slice(0, 80)}`); };
  for (const [id, q] of Object.entries(QUESTS)) { need(q.name, id); need(q.description, id); for (const o of q.objectives || []) need(o.text, id); }
  for (const [id, l] of Object.entries(LORE)) { need(l.title, id); need(l.text, id); }
  const src = readFileSync(join(ROOT, 'src/world/narrative.js'), 'utf8').split('export function dialogueFor')[1];
  // string literals of the dialogue code (a tiny tokenizer: quotes, escapes, // comments)
  const lits = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c !== "'" && c !== '"' && c !== '`') continue;
    let s = '', j = i + 1;
    for (; j < src.length && src[j] !== c; j++) { if (src[j] === '\\') { s += src[++j]; continue; } s += src[j]; }
    lits.push([c, s]); i = j;
  }
  for (const [q, s] of lits) {
    if (s.length < 14 || q === '`' || /^[a-z_:]+$/.test(s) || s.startsWith('quest:') || s === 'You again. You carry ') continue;
    need(s, 'dialogue');
  }
  const keys = ['title', 'text', 'wake', 'done', 'forge', 'open', 'opening', 'locked', 'label', 'prompt', 'sub', 'yes', 'no'];
  const walk = (o, k) => {
    if (typeof o === 'string') { if (keys.includes(k) && /[a-z] [a-z]/i.test(o)) need(o, 'map ' + k); return; }
    if (Array.isArray(o)) return o.forEach((x) => walk(x, k));
    if (o && typeof o === 'object') for (const [kk, v] of Object.entries(o)) if (typeof v !== 'function') walk(v, kk);
  };
  walk(Object.values(MAPS));
  setLang('en');
  ok(!miss.length, miss.length + ' without Thai:\n      ' + miss.slice(0, 40).join('\n      '));
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
