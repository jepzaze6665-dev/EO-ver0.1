// ADMIN: give a player an item (run ON THE SERVER while the game server is STOPPED — the running server keeps its own copy).
//   pm2 stop eclipse && node tools/admin-give.mjs <name or player id> <item id> [count] && pm2 start eclipse
// Writes the server ledger (econ — or the anti-cheat would take it back) + the bag of the main / backup save.
// A copy of the player's file is kept next to it first (<id>.json.bak-<time>). The player logs out and back in to see it.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ITEMS } from '../src/items/items.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.EO_DATA || path.join(ROOT, 'server', 'data');
const [who, itemId, countArg] = process.argv.slice(2);
const count = Math.max(1, Math.floor(Number(countArg) || 1));
if (!who || !itemId) { console.log('usage: node tools/admin-give.mjs <name or player id> <item id> [count]'); process.exit(1); }
if (!ITEMS[itemId]) { console.log('unknown item: ' + itemId); process.exit(1); }

// name -> player id (accounts.json lists every account; with character slots the save id may differ: try both)
let id = who;
const saves = path.join(DATA, 'saves');
if (!fs.existsSync(path.join(saves, id + '.json'))) {
  const text = fs.readFileSync(path.join(DATA, 'accounts.json'), 'utf8');
  const m = text.match(new RegExp('"(p[0-9a-z]+)"[^{}]*?"name"\\s*:\\s*"' + who.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"', 'i'))
    || text.match(new RegExp('"name"\\s*:\\s*"' + who.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^{}]*?"id"\\s*:\\s*"(p[0-9a-z]+)"', 'i'));
  if (!m) { console.log('no player called ' + who); process.exit(1); }
  id = m[1];
}
const file = path.join(saves, id + '.json');
if (!fs.existsSync(file)) { console.log('no save file for ' + id); process.exit(1); }

const r = JSON.parse(fs.readFileSync(file, 'utf8'));
fs.copyFileSync(file, file + '.bak-' + Date.now());
const isGear = !!ITEMS[itemId].type && ['weapon_core', 'armor_core', 'relic', 'charm', 'rune'].includes(ITEMS[itemId].type);
if (isGear) { console.log(itemId + ' is gear (instances): not supported by this tool'); process.exit(1); }
r.econ = r.econ || {};
r.econ.items = r.econ.items || {};
r.econ.items[itemId] = (r.econ.items[itemId] || 0) + count;
const fix = (t) => {
  if (!t) return t;
  const d = JSON.parse(t);
  d.inventory = d.inventory || {}; d.inventory.items = d.inventory.items || {};
  d.inventory.items[itemId] = (d.inventory.items[itemId] || 0) + count;
  return JSON.stringify(d);
};
r.main = fix(r.main);
r.backup = fix(r.backup);
fs.writeFileSync(file + '.tmp', JSON.stringify(r));
fs.renameSync(file + '.tmp', file);
console.log(`gave ${count} × ${itemId} to ${who} (${id}): ledger ${r.econ.items[itemId]}`);
