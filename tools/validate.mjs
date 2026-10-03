// DATA VALIDATOR — one command that checks every cross-reference in the game data.
//   node tools/validate.mjs        -> prints problems, exit 1 when there are any
// Each check names WHERE the bad reference lives (file area + id) and WHAT it points at. Import validate() from tests.
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ITEMS, SHOPS, shopId } from '../src/items/items.js';
import { LOOT_TABLES } from '../src/data/lootTables.js';
import { MONSTERS } from '../src/monsters/monsterTypes.js';
import { BOSSES } from '../src/data/bosses.js';
import { QUESTS } from '../src/data/quests.js';
import { MAPS } from '../src/maps/mapRegistry.js';
import { CLASSES } from '../src/skills/classes.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function validate() {
  const out = [];
  const bad = (where, msg) => out.push(`${where}: ${msg}`);
  const mapIds = new Set(MAPS.map((m) => m.id));
  const item = (where, id) => { if (!ITEMS[id]) bad(where, `unknown item '${id}'`); };

  // loot tables -> items
  for (const [id, t] of Object.entries(LOOT_TABLES)) {
    for (const d of t.drops || []) item(`loot ${id}`, d.item);
    for (const g of t.oneOf || []) for (const i of g.items || []) item(`loot ${id} (oneOf)`, i.item);
  }
  // monsters -> loot tables
  for (const [id, m] of Object.entries(MONSTERS)) if (m.loot && !LOOT_TABLES[m.loot]) bad(`monster ${id}`, `unknown loot table '${m.loot}'`);
  // shops -> items
  for (const [id, s] of Object.entries(SHOPS)) for (const e of s.stock) item(`shop ${id}`, shopId(e));
  // quests -> items / maps
  for (const [id, q] of Object.entries(QUESTS)) {
    for (const i of Object.keys((q.rewards && q.rewards.items) || {})) item(`quest ${id} reward`, i);
    for (const o of q.objectives || []) {
      if (o.type === 'collect' && o.item) item(`quest ${id} objective`, o.item);
      if (o.map && !mapIds.has(o.map)) bad(`quest ${id} objective`, `unknown map '${o.map}'`);
    }
  }
  // bosses -> maps / monsters / loot
  for (const [id, b] of Object.entries(BOSSES)) {
    if (b.planned) continue;
    if (b.map && !mapIds.has(b.map)) bad(`boss ${id}`, `unknown map '${b.map}'`);
    if (b.loot && !LOOT_TABLES[b.loot]) bad(`boss ${id}`, `unknown loot table '${b.loot}'`);
    for (const i of Object.keys((b.rewards && b.rewards.items) || {})) item(`boss ${id} reward`, i);
  }
  // maps -> exits / spawns / bosses
  for (const m of MAPS) {
    for (const e of m.exits || []) if (e.to && !mapIds.has(e.to)) bad(`map ${m.id} exit ${e.id}`, `unknown map '${e.to}'`);
    for (const s of (m.content && m.content.spawns) || []) if (!MONSTERS[s.type]) bad(`map ${m.id} spawn ${s.id}`, `unknown monster '${s.type}'`);
    if (m.boss && !BOSSES[m.boss] && !MONSTERS[m.boss]) bad(`map ${m.id}`, `unknown boss '${m.boss}'`);
    if (m.parent && !mapIds.has(m.parent)) bad(`map ${m.id}`, `unknown parent map '${m.parent}'`);
  }
  // items -> drop source boss
  for (const [id, d] of Object.entries(ITEMS)) if (d.signature && d.dropSource && !BOSSES[d.dropSource]) bad(`item ${id}`, `unknown dropSource boss '${d.dropSource}'`);
  // classes -> skills that exist
  for (const [id, c] of Object.entries(CLASSES)) {
    const ids = new Set((c.skills || []).map((s) => s.id));
    for (const s of (c.defaultLoadout || [])) if (s && !ids.has(s)) bad(`class ${id} loadout`, `unknown skill '${s}'`);
  }
  // built asset manifests exist
  for (const f of ['assets/vfx/vfx.json', 'assets/monsters/monsters.json', 'assets/tiles/tiles.json', 'assets/icons/icons.json']) if (!existsSync(join(ROOT, f))) bad('assets', `missing ${f}`);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const p = validate();
  if (p.length) { console.log(`DATA PROBLEMS (${p.length}):`); for (const l of p) console.log('  ✗ ' + l); process.exit(1); }
  console.log('DATA OK — no broken references');
}
