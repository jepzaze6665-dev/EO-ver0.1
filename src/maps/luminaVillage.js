import { Z } from '../core/constants.js';

// LUMINA VILLAGE — City 1, safe hub. Terrain: maps/lumina.js. Map rules: world/mapManager.js
// Tile coordinates are world tiles (all maps share one coordinate space, so every map keeps its own positions).
//  region : which world tiles belong to this map (zones [+ tile-row limits])
//  spawn  : default arrival point · exits: rect [tx0, ty0, tx1, ty1] (inclusive) -> map `to`, arriving at `entry`
//  requires: { flag } — exit only works once that world flag is set (locked gates, sealed roads)
export const LUMINA_VILLAGE = {
  id: 'lumina', name: 'LUMINA VILLAGE', sub: 'City 1 · Safe Zone', safe: true,
  region: { zones: [Z.VILLAGE] },
  spawn: [48.5, 191],
  exits: [
    { id: 'north_gate', rect: [44, 158, 51, 159], to: 'a1', entry: [47.5, 154], label: 'Whispering Forest' },
    { id: 'bramble_lane', rect: [63, 158, 67, 159], to: 'a1', entry: [65.5, 154], label: 'Bramble Lane' },
  ],
};
