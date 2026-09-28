// ROUTE DATA — the world's main roads from City 1 (Lumina Village) to City 2. The route panel (HUD + world map),
// the World Progression System and the tests read this; no code names a route.
//
//  id, name, sub       : text
//  from, to            : city map ids at both ends
//  steps[]             : the route in order — { map, boss } (map ids: maps/mapRegistry.js, bosses: data/bosses.js)
//  playable            : false = architecture only (the maps are not built yet; shown as "coming soon")
//  cityPlanned         : true = the destination city has no map yet (W5 builds City 2)
//
// Steps without a built map are shown as planned. City 2 opens when EITHER route's major boss falls — the player
// never has to finish both routes. Both routes aim for similar difficulty but different bosses / lore / secrets.
export const ROUTES = {
  A: {
    id: 'A', name: 'ROUTE A', sub: 'The Forest Road', from: 'lumina', to: 'city2', cityPlanned: true, playable: true,
    steps: [
      { map: 'a1', boss: 'boss_a1' }, // Whispering Forest — its boss (the Guardian) waits in the Guardian Arena (map 'arena')
      { map: 'a2', boss: 'boss_a2' }, // Ashen Badlands (own grid) — boss planned (W3)
      { map: 'a3', boss: 'boss_a3', name: 'A3' }, // Rune Citadel — planned (W4): no map yet
    ],
  },
  B: {
    id: 'B', name: 'ROUTE B', sub: 'The Eastern Road', from: 'lumina', to: 'city2', cityPlanned: true, playable: false,
    steps: [
      { map: 'b1', boss: 'boss_b1', name: 'B1' },
      { map: 'b2', boss: 'boss_b2', name: 'B2' },
      { map: 'b3', boss: 'boss_b3', name: 'B3' },
    ],
  },
};
