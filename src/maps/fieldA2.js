import { Z } from '../core/constants.js';

// A2 — DEEP FOREST (north of the river): new monsters, the stone circle, the Elder Tree and the
// Hidden Cave (secret area). Terrain: maps/forest.js (tile rows < 98) + the cave.
export const FIELD_A2 = {
  id: 'a2', name: 'DEEP FOREST', sub: 'Route A · A2 — Beyond the River · Lv. 4 – 7',
  region: { zones: [Z.FOREST, Z.CAVE], maxTy: 97 },
  spawn: [50, 93],
  exits: [
    { id: 'bridge_south', rect: [48, 96, 52, 97], to: 'a1', entry: [50, 101.5], label: 'Whispering Forest' },
    { id: 'log_bridge', rect: [21, 96, 24, 97], to: 'a1', entry: [22.5, 100.5], label: 'Whispering Forest', requires: { flag: 'logBridge' } },
    { id: 'ancient_path', rect: [93, 68, 95, 73], to: 'a3', entry: [103, 71], label: 'Ancient Ruins' },
    { id: 'valley_road', rect: [29, 30, 35, 31], to: 'valley', entry: [32, 25], label: 'Ancient Valley', requires: { flag: 'guardianDefeated' } },
  ],
};
