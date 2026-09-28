import { Z } from '../core/constants.js';

// THE SANCTUM — A3's Major Boss arena (W4b), built like the A1 / A2 arenas: its own map behind the Golden Gate, the
// entrance asks first, a large round arena, exits sealed + camera held on it while the Rune Knight fights
// (data/bosses.js boss_a3). Terrain: maps/runeCitadel.js (zone SANCTUM, rows 0-45 of the citadel grid).
export const SANCTUM = {
  id: 'sanctum', name: 'THE SANCTUM', short: 'A3 Boss', sub: 'Route A · A3 Major Boss · the last Warden', grid: 'citadel',
  type: 'boss_arena', route: 'A', parent: 'a3', bossId: 'boss_a3', nextMap: 'city2',
  requires: [],
  region: { zones: [Z.SANCTUM] },
  spawn: [84, 40],
  // the north road to City 2 stays shut until the knight falls (sealed like every exit while he fights)
  gates: [
    { id: 'city2_road_gate', rect: [82, 6, 86, 6], requires: [{ type: 'map_unlocked', map: 'city2', label: 'Defeat the Rune Knight (A3 Major Boss)' }], color: '255,224,138', label: 'Road to Asteria City' },
  ],
  exits: [
    { id: 'sanctum_gate', rect: [81, 44, 87, 44], to: 'a3', entry: [84, 52], label: 'Golden Gate' },
    { id: 'north_road', rect: [83, 2, 85, 2], to: 'city2', entry: [80, 154], label: 'Asteria City' },
  ],
};
