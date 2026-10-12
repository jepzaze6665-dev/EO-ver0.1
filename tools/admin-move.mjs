// ADMIN: move a player to a map's arrival point (run ON THE SERVER while the game server is STOPPED).
//   pm2 stop eclipse && node tools/admin-move.mjs <player id> [map id = lumina] && pm2 start eclipse
// Changes main + backup save (player.map / x / y); a copy of the file is kept first. The player logs out and back in.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MAPS } from '../src/maps/mapRegistry.js';
import { TILE } from '../src/core/constants.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.EO_DATA || path.join(ROOT, 'server', 'data');
const [id, mapId = 'lumina'] = process.argv.slice(2);
if (!id) { console.log('usage: node tools/admin-move.mjs <player id> [map id]'); process.exit(1); }
const def = MAPS.find((m) => m.id === mapId);
if (!def || !def.spawn) { console.log('unknown map (or no spawn): ' + mapId); process.exit(1); }
const file = path.join(DATA, 'saves', id + '.json');
if (!fs.existsSync(file)) { console.log('no save file for ' + id); process.exit(1); }

const r = JSON.parse(fs.readFileSync(file, 'utf8'));
fs.copyFileSync(file, file + '.bak-' + Date.now());
const x = def.spawn[0] * TILE, y = def.spawn[1] * TILE;
const fix = (t) => {
  if (!t) return t;
  const d = JSON.parse(t);
  if (d.player) { d.player.map = mapId; d.player.x = x; d.player.y = y; }
  return JSON.stringify(d);
};
r.main = fix(r.main);
r.backup = fix(r.backup);
fs.writeFileSync(file + '.tmp', JSON.stringify(r));
fs.renameSync(file + '.tmp', file);
console.log(`moved ${id} to ${mapId} (${x}, ${y})`);
