import { buildLumina } from './lumina.js';
import { buildForest, buildHowlingDen } from './forest.js';
import { buildRuins, buildGateAndArena, buildValley } from './ruins.js';
import { T } from '../core/constants.js';

// Terrain of the WHISPERING grid (the original connected world: world/levels/whispering.js):
//   VALLEY (north-west) — FOREST (centre-west) — RUINS (east) — GATE — ARENA (north-east)
//   LUMINA VILLAGE sits south of the forest; its north gate leads straight into the forest.
// `b` = Builder over an empty WorldMap made by World.buildLevel.
export function buildWhisperingTerrain(b) {
  buildForest(b);
  buildLumina(b);
  buildRuins(b);
  buildGateAndArena(b);
  buildValley(b);
  // ruins west entrance: make sure the Ancient Forest Path connects cleanly
  b.line([[93, 71], [101, 71]], 4, T.MOSS_STONE);
  b.line([[88, 112], [97, 112]], 3, T.FOREST_FLOOR);
  buildHowlingDen(b); // V2.2: A1 boss arena (added last so nothing else in the world moves)
}
