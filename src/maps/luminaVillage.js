import { Z } from '../core/constants.js';

// LUMINA VILLAGE — City 1, safe hub, own grid 'lumina'. Terrain: maps/luminaCity.js. Map rules: world/mapManager.js
// Tile coordinates are tiles of the map's grid (world/levels): maps on the same grid share one coordinate space.
//  region : which world tiles belong to this map (zones [+ tile-row limits])
//  spawn  : default arrival point · exits: rect [tx0, ty0, tx1, ty1] (inclusive) -> map `to`, arriving at `entry`
//  requires: { flag } — exit only works once that world flag is set (locked gates, sealed roads)
export const LUMINA_VILLAGE = {
  id: 'lumina', name: 'LUMINA VILLAGE', short: 'Lumina', sub: 'City 1 · Safe Zone', grid: 'lumina', type: 'city', safe: true,
  region: { zones: [Z.VILLAGE] },
  spawn: [48.5, 57],
  // owner 2026-10-13: NO road exits (players got lost) — the only way out is the DUNGEON GATE in the square
  // (map select, panels.dungeonGate); back = the return stone at every area's start
  exits: [],
  content: {
    interactables: [
      { id: 'lumina_gate', kind: 'dungeonGate', tx: 48, ty: 22, prompt: 'Dungeon Gate' },
      {
        id: 'lumina_route_sign', kind: 'sign', tx: 52, ty: 44, prompt: 'Read Route Sign', title: 'Roads from Lumina',
        text: 'ROADS FROM LUMINA VILLAGE\n↑ ROUTE A — The Forest Road: Whispering Forest (A1) → Ancient Valley (A2) → Rune Citadel (A3) → City 2 Asteria\n→ ROUTE B — The Eastern Road: Frostwind Plains (B1) → Crystal Caverns (B2) → Frostpeak (B3) → City 2 Asteria\n\n"Each forest keeps a guardian. The road past it stays shut until the guardian falls." — Guild notice',
      },
    ],
  },
};
