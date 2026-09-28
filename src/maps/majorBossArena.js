import { Z } from '../core/constants.js';

// MAJOR BOSS ARENA — Route A's Major Boss, the Guardian of the Forest (data: data/bosses.js boss_a3, fight code:
// boss/guardian.js). Exits lock during the fight (world/transitionSystem.js: no exit while a boss fight is active).
// After the Guardian falls, the north road to City 2 (Valehaven) opens: gate + exit below.
export const MAJOR_BOSS_ARENA = {
  id: 'arena', name: 'GUARDIAN ARENA', short: 'A3 Boss', sub: 'Route A · Major Boss · Heart of the Forest', boss: 'guardian',
  grid: 'whispering', type: 'boss_arena', route: 'A', parent: 'a3', bossId: 'boss_a3', nextMap: 'city2',
  requires: [{ type: 'flag', flag: 'gateOpened', label: 'Unseal the Guardian Gate (Ancient Shrine, A3)' }],
  region: { zones: [Z.ARENA] },
  spawn: [135, 42],
  gates: [
    { id: 'city2_road_gate', rect: [131, 11, 139, 11], requires: [{ type: 'map_unlocked', map: 'city2', label: 'Defeat the Guardian of the Forest (Major Boss)' }], color: '255,224,138', label: 'Road to Valehaven' },
  ],
  exits: [
    { id: 'gate_south', rect: [131, 46, 139, 46], to: 'a3', entry: [135.5, 51], label: 'Guardian Gate' },
    { id: 'city_road', rect: [134, 10, 138, 10], to: 'city2', entry: [52, 18], label: 'Valehaven' },
    // W1 (temporary until W2 moves the Guardian to A1): ember portal on the east rim -> Ashen Badlands (other grid)
    { id: 'ember_portal', rect: [146, 28, 147, 29], to: 'ashen', entry: [84.5, 196], label: 'Ashen Badlands' },
  ],
};
