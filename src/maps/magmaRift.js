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
  // after the Magma Beast: the east causeway opens toward A3 (collision gate + the A3 map's requirement)
  gates: [
    { id: 'a3_road_gate', rect: [104, 19, 104, 25], requires: [{ type: 'map_unlocked', map: 'a3', label: 'Defeat the Magma Beast (A2 Boss)' }], color: '140,180,255', label: 'Road to the Rune Citadel' },
  ],
  exits: [
    { id: 'rift_south', rect: [81, 41, 87, 41], to: 'a2', entry: [84, 46], label: 'High Meadow' },
    { id: 'east_road', rect: [108, 19, 109, 25], to: 'a3', entry: [84, 198], label: 'Rune Citadel' },
  ],
};
