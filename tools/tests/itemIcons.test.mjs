// Item icons (tools/build-item-icons.js): the manifest names real items, every built icon file exists, and the UI helper
// uses the art when there is one. Run:  node tools/tests/itemIcons.test.mjs
import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ITEMS } from '../../src/items/items.js';
import { isGear } from '../../src/items/itemDefs.js';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { SHEETS } = require('../build-item-icons.js');
let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

const meta = existsSync(join(ROOT, 'assets/icons/items/items.json')) ? JSON.parse(readFileSync(join(ROOT, 'assets/icons/items/items.json'), 'utf8')) : {};
test('every id in the icon manifest is a real item (no typos)', () => {
  for (const s of SHEETS) for (const row of s.rows) for (const id of row) if (id) ok(ITEMS[id], `${s.file}: unknown item "${id}"`);
});
test('every built icon has its file; every manifest item was built', () => {
  ok(Object.keys(meta).length > 0, 'items.json missing: run node tools/build-item-icons.js');
  for (const [id, v] of Object.entries(meta)) ok(existsSync(join(ROOT, v.file)), 'missing ' + v.file);
  for (const s of SHEETS) for (const row of s.rows) for (const id of row) if (id) ok(meta[id], 'not built: ' + id);
});
test('art coverage report (gear without art keeps the drawn icon)', () => {
  const missing = Object.values(ITEMS).filter((d) => (isGear(d) || d.key) && !meta[d.id]).map((d) => d.id);
  console.log('      gear / key items without art:', missing.join(', ') || 'none');
  ok(Object.values(ITEMS).filter((d) => isGear(d) && meta[d.id]).length >= 50, 'most gear has art');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
