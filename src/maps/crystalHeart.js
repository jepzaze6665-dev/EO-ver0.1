import { Z } from '../core/constants.js';

// HEART OF THE CAVERNS — B2's boss arena (B2b): its own map east of the Northern Gallery, the entrance asks first, exits
// seal + the camera holds the arena while the AMETHYST COLOSSUS fights (data/bosses.js boss_b2). Terrain:
// maps/crystalCaverns.js (zone CAVERN_HEART).
export const CRYSTAL_HEART = {
  id: 'crystal_heart', name: 'HEART OF THE CAVERNS', short: 'B2 Boss', sub: 'Route B · B2 Area Boss · the Amethyst Colossus', grid: 'caverns',
  type: 'boss_arena', route: 'B', parent: 'b2', bossId: 'boss_b2', nextMap: 'b3',
  requires: [],
  region: { zones: [Z.CAVERN_HEART] },
  spawn: [128, 29],
  exits: [
    { id: 'heart_west', rect: [124, 26, 124, 32], to: 'b2', entry: [117, 29], label: 'Northern Gallery' },
  ],
};
