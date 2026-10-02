import { Z } from '../core/constants.js';

// LUMINA VILLAGE — City 1, safe hub. Terrain: maps/lumina.js. Map rules: world/mapManager.js
// Tile coordinates are tiles of the map's grid (world/levels): maps on the same grid share one coordinate space.
//  region : which world tiles belong to this map (zones [+ tile-row limits])
//  spawn  : default arrival point · exits: rect [tx0, ty0, tx1, ty1] (inclusive) -> map `to`, arriving at `entry`
//  requires: { flag } — exit only works once that world flag is set (locked gates, sealed roads)
export const LUMINA_VILLAGE = {
  id: 'lumina', name: 'LUMINA VILLAGE', short: 'Lumina', sub: 'City 1 · Safe Zone', grid: 'whispering', type: 'city', safe: true,
  region: { zones: [Z.VILLAGE] },
  spawn: [48.5, 191],
  exits: [
    { id: 'north_gate', rect: [44, 158, 51, 159], to: 'a1', entry: [47.5, 154], label: 'Whispering Forest' },
    { id: 'bramble_lane', rect: [63, 158, 67, 159], to: 'a1', entry: [65.5, 154], label: 'Bramble Lane' },
    { id: 'eastern_road', rect: [71, 179, 71, 181], to: 'b1', entry: [6, 21], label: 'Frostwind Plains (Route B)' },
  ],
  // route choice at the north gate (data/routes.js: Route A is open, Route B is architecture only for now)
  content: {
    interactables: [
      // ONLINE N5: Solo / Party entry to any unlocked route area (the roads north / east still work on foot)
      { id: 'lumina_dungeon_gate', kind: 'dungeonGate', tx: 60, ty: 182, prompt: 'Use the Dungeon Gate', radius: 40 },
      {
        id: 'lumina_route_sign', kind: 'sign', tx: 43, ty: 162, prompt: 'Read Route Sign', title: 'Roads from Lumina',
        text: 'ROADS FROM LUMINA VILLAGE\n↑ ROUTE A — The Forest Road: Whispering Forest (A1) → Ancient Valley (A2) → Rune Citadel (A3) → City 2 Asteria\n→ ROUTE B — The Eastern Road: Frostwind Plains (B1) → Crystal Caverns (B2) → Frostpeak (B3) → City 2 Asteria\n\n"Each forest keeps a guardian. The road past it stays shut until the guardian falls." — Guild notice',
      },
    ],
  },
};
