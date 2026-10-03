// WORLD MAP for the map-select screen (panels.dungeonGate). Presentation data only: the server still decides what may
// be entered (server/dungeons.js). Pin x / y are PERCENT of the map picture, so they can be moved to match the owner's
// painted map (assets/ui/worldmap.png, made from the prompt in docs/ui/world_map_prompt.md) without touching code.
//   pins   : one per dungeon area (ONLINE.dungeon.areas) — boss = atlas id in assets/monsters (portrait = its idle frame),
//            desc = the line shown in the side panel
//   cities : non-enterable landmarks drawn on the map (where the roads start / meet)
//   roads  : polylines (percent points) drawn under the pins; route A / B colours
export const WORLD_MAP = {
  image: null, // set to 'assets/ui/worldmap.png' once the owner's painted map exists (null = the code-drawn map, no 404)
  pins: {
    a1: { x: 34, y: 70, boss: 'forest_guardian', desc: 'A whispering forest south of Lumina. Wolves, hares and treants guard the old ruins; the Guardian waits in its arena.' },
    a2: { x: 22, y: 48, boss: 'magma_beast', desc: 'Green terraced cliffs, river fords and sunken temples — and a lava rift where the Magma Beast sleeps.' },
    a3: { x: 30, y: 25, boss: 'rune_knight', desc: 'The fallen Rune Citadel: walled streets, bronze hoplites and sealed vaults. The Rune Knight holds the Sanctum.' },
    b1: { x: 66, y: 70, boss: 'hoarfang', desc: 'Frostwind Plains: a snowfield swept by blizzards. Keep near the campfires — Hoarfang hunts in the storm.' },
    b2: { x: 78, y: 48, boss: 'amethyst_colossus', desc: 'Crystal Caverns: dark chambers lit only by glow crystals. The Amethyst Colossus guards the Heart.' },
    b3: { x: 70, y: 25, boss: 'crystal_warden', desc: 'Frostpeak: the colder you climb, the harder it bites. The Crystal Warden waits at the summit.' },
  },
  cities: [
    { id: 'lumina', name: 'Lumina', x: 50, y: 86 },
    { id: 'city2', name: 'Asteria', x: 50, y: 10 },
  ],
  roads: {
    A: [[50, 86], [34, 70], [22, 48], [30, 25], [50, 10]],
    B: [[50, 86], [66, 70], [78, 48], [70, 25], [50, 10]],
  },
  routeColor: { A: '#8fd06a', B: '#8ad0ff' },
};
