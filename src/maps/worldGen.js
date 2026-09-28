import { buildLumina } from './lumina.js';
import { buildForest, buildHowlingDen } from './forest.js';
import { buildRuins, buildGateAndArena, buildValley } from './ruins.js';
import { T, Z, SOLID_TILES } from '../core/constants.js';

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
  buildHowlingDen(b); // V2.2: Hollow Fang's den (added last so nothing else in the world moves)
  // W2: forest and ruins are ONE map (A1). The paths between them (Ancient Forest Path, ruins side gate) were a
  // zone-less gap walked over by an exit; give their open tiles the forest zone so they are part of A1.
  for (let ty = 60; ty <= 120; ty++) for (let tx = 96; tx <= 99; tx++) {
    const i = b.m.idx(tx, ty);
    if (!b.m.zone[i] && !SOLID_TILES.has(b.m.get(tx, ty))) b.m.zone[i] = Z.FOREST;
  }
}
