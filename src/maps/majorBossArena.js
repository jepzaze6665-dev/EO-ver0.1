import { Z } from '../core/constants.js';

// MAJOR BOSS ARENA — the Guardian of the Forest (boss logic: boss/guardian.js). Exits lock during the fight
// (world/transitionSystem.js blocks every exit while a boss fight is active).
export const MAJOR_BOSS_ARENA = {
  id: 'arena', name: 'GUARDIAN ARENA', sub: 'Route A · Major Boss · Heart of the Forest', boss: 'guardian',
  region: { zones: [Z.ARENA] },
  spawn: [135, 42],
  exits: [
    { id: 'gate_south', rect: [131, 46, 139, 46], to: 'a3', entry: [135.5, 51], label: 'Guardian Gate' },
  ],
};
