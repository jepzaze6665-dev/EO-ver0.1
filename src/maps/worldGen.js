import { WorldMap } from './worldMap.js';
import { Builder } from './builder.js';
import { buildTileset } from './tiles.js';
import { buildLumina } from './lumina.js';
import { buildForest, buildHowlingDen } from './forest.js';
import { buildRuins, buildGateAndArena, buildValley } from './ruins.js';
import { T } from '../core/constants.js';

// Assembles the single connected world grid:
//   VALLEY (A2, north-west) — FOREST (centre-west) — RUINS (east) — GATE — ARENA (north-east)
//   LUMINA VILLAGE sits south of the forest; its north gate leads straight into the forest.
export function generateWorld() {
  const tileset = buildTileset();
  const map = new WorldMap(tileset);
  const b = new Builder(map, 1337);
  buildForest(b);
  buildLumina(b);
  buildRuins(b);
  buildGateAndArena(b);
  buildValley(b);
  // ruins west entrance: make sure the Ancient Forest Path connects cleanly
  b.line([[93, 71], [101, 71]], 4, T.MOSS_STONE);
  b.line([[88, 112], [97, 112]], 3, T.FOREST_FLOOR);
  buildHowlingDen(b); // V2.2: A1 boss arena (added last so nothing else in the world moves)
  return { map, builder: b };
}
