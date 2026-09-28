import { Z } from '../core/constants.js';

// THE FROST ARENA — B1's boss arena (B1b), built like the A1 / A2 / A3 arenas: its own map up the stairs in B1's
// south-east, the entrance asks first, exits seal + the camera holds the arena while HOARFANG fights
// (data/bosses.js boss_b1). Terrain: maps/frostwind.js (zone FROST_ARENA). The south stairs lead on to B2 (Crystal
// Caverns) — that road opens with B2.
export const FROST_ARENA_MAP = {
  id: 'frost_arena', name: 'THE FROST ARENA', short: 'B1 Boss', sub: 'Route B · B1 Area Boss · the Winter Alpha', grid: 'frostwind',
  type: 'boss_arena', route: 'B', parent: 'b1', bossId: 'boss_b1', nextMap: 'b2',
  requires: [],
  region: { zones: [Z.FROST_ARENA] },
  spawn: [142, 131],
  gates: [
    { id: 'b2_road_gate', rect: [140, 165, 144, 165], requires: [{ type: 'map_unlocked', map: 'b2', label: 'The road south to the Crystal Caverns (B2) opens in a later update' }], color: '160,210,255', label: 'Road to the Crystal Caverns' },
  ],
  exits: [
    { id: 'arena_north', rect: [140, 126, 144, 126], to: 'b1', entry: [142, 119], label: 'Frostwind Plains' },
  ],
};
