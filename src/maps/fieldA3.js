import { Z } from '../core/constants.js';

// A3 — ANCIENT RUINS + GUARDIAN GATE: stronger monsters, the shrine (seal fragment), lore, and the
// sealed gate to the Major Boss Arena. Terrain: maps/ruins.js (ruins + gate).
export const FIELD_A3 = {
  id: 'a3', name: 'ANCIENT RUINS', sub: 'Route A · A3 — Before the Gate · Lv. 7 – 10',
  region: { zones: [Z.RUINS, Z.GATE] },
  spawn: [103, 71],
  exits: [
    { id: 'forest_path', rect: [100, 68, 101, 73], to: 'a2', entry: [90.5, 71], label: 'Deep Forest' },
    { id: 'side_gate', rect: [100, 110, 102, 113], to: 'a1', entry: [90.5, 112], label: 'Whispering Forest', requires: { flag: 'ruinsGate' } },
    { id: 'arena_gate', rect: [131, 47, 139, 48], to: 'arena', entry: [135, 42], label: 'Guardian Arena', requires: { flag: 'gateOpened' } },
  ],
};
