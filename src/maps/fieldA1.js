import { Z } from '../core/constants.js';

// A1 — WHISPERING FOREST (forest edge, south of the river). Tutorial combat area.
// Terrain: maps/forest.js (the forest south of tile row 98).
export const FIELD_A1 = {
  id: 'a1', name: 'WHISPERING FOREST', sub: 'Route A · A1 — Forest Edge · Lv. 1 – 4',
  region: { zones: [Z.FOREST], minTy: 98 },
  spawn: [47.5, 150],
  exits: [
    { id: 'to_lumina', rect: [44, 156, 51, 157], to: 'lumina', entry: [47.5, 161.5], label: 'Lumina Village' },
    { id: 'to_lumina_lane', rect: [63, 156, 67, 157], to: 'lumina', entry: [65.5, 161.5], label: 'Lumina Village' },
    { id: 'bridge_north', rect: [48, 98, 52, 99], to: 'a2', entry: [50, 94.5], label: 'Deep Forest' },
    { id: 'log_bridge', rect: [21, 98, 24, 99], to: 'a2', entry: [22.5, 95], label: 'Deep Forest', requires: { flag: 'logBridge' } },
    { id: 'ruins_side', rect: [92, 110, 95, 113], to: 'a3', entry: [104, 112], label: 'Ancient Ruins', requires: { flag: 'ruinsGate' } },
  ],
};
