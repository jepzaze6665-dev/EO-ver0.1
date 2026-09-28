import { Z } from '../core/constants.js';

// GUARDIAN ARENA — A1's boss arena (W2): the Guardian of the Forest (data/bosses.js boss_a1, fight code:
// boss/guardian.js). Exits lock during the fight (world/transitionSystem.js: no exit while a boss fight is active).
// After the Guardian falls the north road opens: gate + exit into A2, the Ancient Valley (another grid).
export const MAJOR_BOSS_ARENA = {
  id: 'arena', name: 'GUARDIAN ARENA', short: 'A1 Boss', sub: 'Route A · A1 Boss · Heart of the Forest', boss: 'guardian',
  grid: 'whispering', type: 'boss_arena', route: 'A', parent: 'a1', bossId: 'boss_a1', nextMap: 'a2',
  requires: [{ type: 'flag', flag: 'gateOpened', label: 'Unseal the Guardian Gate (Ancient Shrine, A1)' }],
  region: { zones: [Z.ARENA] },
  spawn: [135, 42],
  gates: [
    { id: 'a2_road_gate', rect: [131, 11, 139, 11], requires: [{ type: 'map_unlocked', map: 'a2', label: 'Defeat the Guardian of the Forest (A1 Boss)' }], color: '255,160,96', label: 'Road to the Ancient Valley' },
  ],
  exits: [
    { id: 'gate_south', rect: [131, 46, 139, 46], to: 'a1', entry: [135.5, 51], label: 'Guardian Gate' },
    { id: 'north_road', rect: [134, 10, 138, 10], to: 'a2', entry: [84.5, 196], label: 'Ancient Valley' },
  ],
};
