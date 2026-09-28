import { Z } from '../core/constants.js';

// MAGMA RIFT — A2's boss arena (W3d: built like A1's Guardian Arena — its own map, one road in, the entrance asks
// first, a large round arena, exits sealed + camera held on the arena while the Magma Beast fights: data/bosses.js
// boss_a2 arena.cameraLock). Terrain: maps/ancientValley.js (zone RIFT, rows 0-41 of the Ancient Valley grid).
export const MAGMA_RIFT = {
  id: 'rift', name: 'MAGMA RIFT', short: 'A2 Boss', sub: 'Route A · A2 Boss · the burning heart of the valley', grid: 'ancient_valley',
  type: 'boss_arena', route: 'A', parent: 'a2', bossId: 'boss_a2', nextMap: 'a3',
  requires: [],
  region: { zones: [Z.RIFT] },
  spawn: [84, 38],
  exits: [
    { id: 'rift_south', rect: [81, 41, 87, 41], to: 'a2', entry: [84, 46], label: 'High Meadow' },
  ],
};
