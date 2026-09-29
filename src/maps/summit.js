import { Z } from '../core/constants.js';

// THE SUMMIT CITADEL — B3's MAJOR boss arena (B3b): its own map above Frostpeak's summit gate; the entrance asks first,
// exits seal + the camera holds the arena while the CRYSTAL WARDEN fights (data/bosses.js boss_b3). Once it falls, the
// north road leads on to City 2 (Asteria City). Terrain: maps/frostpeak.js (zone PEAK_SUMMIT).
export const SUMMIT = {
  id: 'summit', name: 'THE SUMMIT CITADEL', short: 'B3 Boss', sub: 'Route B · B3 Major Boss · the Crystal Warden', grid: 'frostpeak',
  type: 'boss_arena', route: 'B', parent: 'b3', bossId: 'boss_b3', nextMap: 'city2',
  requires: [],
  region: { zones: [Z.PEAK_SUMMIT] },
  spawn: [90, 44],
  gates: [
    { id: 'city2_frost_gate', rect: [88, 10, 92, 10], requires: [{ type: 'map_unlocked', map: 'city2', label: 'Defeat the Crystal Warden (B3 Major Boss)' }], color: '255,224,138', label: 'Road to Asteria City' },
  ],
  exits: [
    { id: 'summit_gate', rect: [88, 49, 92, 49], to: 'b3', entry: [90, 57], label: 'Frostpeak' },
    // the north road must sit inside the summit zone (tiles within 22 of the arena centre)
    { id: 'north_road', rect: [89, 8, 91, 8], to: 'city2', entry: [82, 154], label: 'Asteria City' },
  ],
};
