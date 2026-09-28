// BOSS DATA — every boss of the world is described here. boss/bossSystem.js reads it and never names a boss.
// Add a boss = add an entry (+ its arena in a map file's region). No game-loop code changes.
//
//  id, name, title          : text (boss bar, banners)
//  type                     : 'area' (guards a field map) | 'major' (end of a route, several phases, unlocks a city)
//  impl                     : which code runs the fight — 'area' = generic data-driven boss (boss/areaBoss.js)
//                             'guardian' = the V2 Guardian of the Forest (boss/guardian.js, its own 3-phase fight)
//  route, map               : where it lives (map id from maps/mapRegistry.js)
//  monster                  : (optional) MONSTERS id it is known as (codex, quest objectives written before V2.2)
//  level, recommendedLevel  : shown in the boss bar / route panel
//  planned                  : true = design placeholder only (Route B) — never spawned, has no map yet
//  stats                    : hp, def, speed, radius, height, mass, weakness[], superArmor, poise
//  look                     : placeholder art — an existing monster sprite scaled up + an aura (no new asset files)
//  arena                    : tile coordinates — center, radius (collision boundary while engaged),
//                             trigger (step inside this radius = the fight starts), bossSpawn, entry (arena entrance)
//  appear                   : requirements (progression/requirements.js) to leave the HIDDEN state (default: none)
//  phases[]                 : { name, sub, hpBelow (enter when HP% <= this), moves[], windup (mult), speed (mult),
//                               shockwave: power of the phase-change blast }
//  moves{}                  : attack patterns (the "mechanics"). kinds:
//      strike  : telegraph around / in front of the boss        shape: cone {r, half} · circle {r, offset} · ring {r0, r}
//      dash    : line telegraph, then a charge along it          len, width
//      leap    : circle telegraph on the player, jump + slam     r, track (share of the windup it follows the player)
//      volley  : fan of projectiles                               count, spread, speed
//      pattern : many circles in a layout                         layout 'cross' | 'ring' | 'scatter', count, r, step, delay
//      nova    : rings expanding from the boss (dodge through)   rings, width, gap
//      summon  : calls adds (summoned monsters give no EXP/loot) monster, count, max, corrupted
//    common: range / min (distance to the player it is used at), windup, recover, cd, weight, power, guardBreak / unblockable
//            (Combat 2.0: smashes a normal block / ignores guard + parry),
//            dmg ('physical' | 'magic' | ...), knock, status [{ id, dur }], opening (weak window seconds after it)
//  rewards                  : { exp, loot (table in data/lootTables.js), gold, items: { id: n }, lore } — first kill only
//  unlocks                  : map ids this boss opens (info for UI/tools; the unlock itself = map `requires` + world triggers)
//  teaches                  : one line shown in the route panel (what this fight tests)
export const BOSS_TYPE = { AREA: 'area', MAJOR: 'major' };

export const BOSSES = {
  // ---------------- ROUTE A
  boss_a1: {
    id: 'boss_a1', name: 'HOLLOW FANG', title: 'Alpha of the Whispering Forest', type: 'area', impl: 'area',
    route: 'A', map: 'a1', level: 5, recommendedLevel: 4,
    teaches: 'Basic combat · read the red ground · dodge the lunge',
    stats: { hp: 4500, def: 4, speed: 112, radius: 20, height: 44, mass: 5, weakness: ['shadow'], superArmor: true, poise: 650 },
    look: { sprite: 'wolf', scale: 2.2, aura: '255,176,112' },
    arena: { name: 'Howling Den', center: [58.5, 113.5], radius: 5.8, trigger: 4.4, bossSpawn: [58.5, 115], entry: [57.5, 106.5] },
    appear: [],
    phases: [
      { name: 'THE HUNT', sub: 'Watch the ground — then move', hpBelow: 1, moves: ['bite', 'lunge', 'howl'] },
    ],
    moves: {
      bite: { kind: 'strike', range: 70, windup: 0.62, recover: 0.5, cd: 1.3, weight: 4, power: 22, knock: 160, shape: { shape: 'cone', r: 78, half: 0.9 } },
      lunge: { kind: 'dash', guardBreak: true, range: 240, min: 90, windup: 0.85, recover: 0.8, cd: 4.5, weight: 3, power: 28, knock: 240, len: 230, width: 34, opening: 1.8 },
      howl: { kind: 'strike', range: 150, windup: 1.0, recover: 0.7, cd: 7, weight: 2, power: 18, knock: 200, dmg: 'magic', shape: { shape: 'circle', r: 118 }, status: [{ id: 'slow', dur: 2 }], opening: 1.4 },
    },
    rewards: { exp: 150, loot: 'boss_a1', items: { hollow_fang_pelt: 1 }, lore: 'hollow_fang' },
    unlocks: ['a2'],
  },

  boss_a2: {
    id: 'boss_a2', name: 'GRUKK THE THORNBOUND', title: 'Warchief of the Goblin Glade', type: 'area', impl: 'area',
    route: 'A', map: 'a2', level: 8, recommendedLevel: 7,
    teaches: 'AoE patterns · movement · adds · a second phase',
    stats: { hp: 9000, def: 7, speed: 92, radius: 20, height: 56, mass: 6, weakness: ['physical'], superArmor: true, poise: 850 },
    look: { sprite: 'goblinC', scale: 2.1, aura: '176,96,255' },
    arena: { name: 'Goblin Glade', center: [29.5, 60.5], radius: 6.4, trigger: 4.8, bossSpawn: [29.5, 58.5], entry: [36.5, 64.5] },
    appear: [],
    phases: [
      { name: 'WARCHIEF', sub: 'Stay mobile — the ground erupts in lines', hpBelow: 1, moves: ['cleave', 'leap', 'drums', 'warcry'] },
      {
        name: 'THORNBOUND', sub: 'The corruption answers — thorns and spears', hpBelow: 0.5, windup: 0.85, speed: 1.15, shockwave: 20,
        moves: ['cleave', 'leap', 'drums', 'thorn_ring', 'spears', 'warcry'],
      },
    ],
    moves: {
      cleave: { kind: 'strike', range: 80, windup: 0.7, recover: 0.55, cd: 1.6, weight: 4, power: 30, knock: 200, shape: { shape: 'cone', r: 92, half: 1.1 } },
      leap: { kind: 'leap', guardBreak: true, range: 320, min: 110, windup: 1.1, recover: 0.6, cd: 5, weight: 3, power: 34, knock: 280, r: 84, track: 0.6, opening: 1.6 },
      drums: { kind: 'pattern', layout: 'cross', range: 400, windup: 0.9, recover: 0.6, cd: 7, weight: 2, power: 24, knock: 180, count: 4, r: 30, step: 58, delay: 0.14 },
      thorn_ring: { kind: 'pattern', layout: 'ring', range: 400, windup: 1.2, recover: 0.8, cd: 9, weight: 2, power: 26, knock: 200, count: 11, r: 34, dist: 110, dmg: 'magic', status: [{ id: 'root', dur: 0.8 }], color: '120,255,120' },
      spears: { kind: 'volley', range: 360, min: 90, windup: 0.8, recover: 0.6, cd: 6, weight: 2, power: 18, count: 5, spread: 0.8, speed: 260, dmg: 'magic', status: [{ id: 'poison', dur: 3 }], color: '#b060ff' },
      warcry: { kind: 'summon', range: 999, windup: 1.0, recover: 0.6, cd: 16, weight: 1.5, monster: 'goblin', count: 2, max: 2, corrupted: true },
    },
    rewards: { exp: 300, loot: 'boss_a2', items: { warchief_totem: 1 }, lore: 'grukk' },
    unlocks: ['a3'],
  },

  // the V2 Guardian of the Forest = Route A's Major Boss (its fight code: boss/guardian.js; the arena: maps/ruins.js)
  boss_a3: {
    id: 'boss_a3', name: 'GUARDIAN OF THE FOREST', title: 'Warden of the Whispering Heart', type: 'major', impl: 'guardian',
    route: 'A', map: 'arena', monster: 'guardian', level: 10, recommendedLevel: 10,
    teaches: 'Everything so far · weak windows · arena hazards · the final attack',
    arena: { name: 'Guardian Arena', center: [132.5, 28], radius: 15.5, trigger: 13.6, bossSpawn: [132, 22], entry: [135, 42] },
    appear: [{ type: 'flag', flag: 'gateOpened', label: 'Open the Guardian Gate' }], // it sleeps behind the sealed gate
    phases: [
      { name: 'PHASE I', sub: 'Claw · Charge · Leap · Smash', hpBelow: 1 },
      { name: 'PHASE II', sub: 'Roots · Crystal volleys · Thornlings', hpBelow: 0.7 },
      { name: 'PHASE III — ENRAGED', sub: 'Combos · Nova · the Last Root', hpBelow: 0.3 },
    ],
    mechanics: ['Weak windows after heavy blows', 'Root patches + corruption pools (arena)', 'Summoned thornlings', 'Final attack: Last Root of the Forest'],
    rewards: { exp: 500, loot: 'guardian', lore: 'guardian_rest' },
    unlocks: ['city2'],
  },

  // ---------------- ROUTE B (architecture only — Phase 13/14 builds the maps; nothing here is spawned yet)
  boss_b1: { id: 'boss_b1', name: 'B1 AREA BOSS', title: 'Route B · to be designed', type: 'area', impl: 'area', route: 'B', map: 'b1', planned: true, unlocks: ['b2'] },
  boss_b2: { id: 'boss_b2', name: 'B2 AREA BOSS', title: 'Route B · to be designed', type: 'area', impl: 'area', route: 'B', map: 'b2', planned: true, unlocks: ['b3'] },
  boss_b3: { id: 'boss_b3', name: 'B3 MAJOR BOSS', title: 'Route B · to be designed', type: 'major', impl: 'area', route: 'B', map: 'b3', planned: true, unlocks: ['city2'] },
};

// every boss that can actually spawn (planned entries are skipped)
export const liveBosses = (data = BOSSES) => Object.values(data).filter((b) => !b.planned);
