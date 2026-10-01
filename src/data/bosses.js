// BOSS DATA — every boss of the world is described here. boss/bossSystem.js reads it and never names a boss.
// Add a boss = add an entry (+ its arena in a map file's region). No game-loop code changes.
//
//  id, name, title          : text (boss bar, banners)
//  type                     : 'area' (guards a field map, opens the next one) | 'major' (end of a route, unlocks a city)
//                             'mini' (optional mini-boss: rewards once, gates nothing)
//                             'secret' (hidden boss behind a quest chain: rewards once, gates nothing, own arena map)
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
//  look.vfx                 : { charge, slash, impact, bolt, eruption, nova, phase, pool } VFX strips the fight uses
//  arena.cameraLock         : hold the camera on the arena while engaged (like the Guardian's arena)
//  mechanics                : [{ type, ... }] the boss's signature rules (boss/mechanics.js: overheat, lava_pools, ...)
export const BOSS_TYPE = { AREA: 'area', MAJOR: 'major', MINI: 'mini', SECRET: 'secret' };

export const BOSSES = {
  // ---------------- ROUTE A
  // ---------------- A1 optional mini-bosses (W2: the old A1 / A2 area bosses; they no longer lock any road)
  mini_hollow_fang: {
    id: 'mini_hollow_fang', name: 'HOLLOW FANG', title: 'Alpha of the Whispering Forest', type: 'mini', impl: 'area',
    route: 'A', map: 'a1', level: 7, nativeLevel: 5, recommendedLevel: 6,
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
    rewards: { exp: 150, loot: 'hollow_fang', items: { hollow_fang_pelt: 1 }, lore: 'hollow_fang' },
    unlocks: [],
  },

  mini_grukk: {
    id: 'mini_grukk', name: 'THE THORNBOUND ELDER', title: 'Heart of the Thornwood Glade', type: 'mini', impl: 'area',
    route: 'A', map: 'a1', level: 11, nativeLevel: 8, recommendedLevel: 10,
    teaches: 'AoE patterns · movement · adds · a second phase',
    stats: { hp: 9000, def: 7, speed: 92, radius: 20, height: 56, mass: 6, weakness: ['physical'], superArmor: true, poise: 850 },
    look: { sprite: 'treant', scale: 1.5, aura: '176,96,255' },
    arena: { name: 'Thornwood Glade', center: [29.5, 60.5], radius: 6.4, trigger: 4.8, bossSpawn: [29.5, 58.5], entry: [36.5, 64.5] },
    appear: [],
    phases: [
      { name: 'ELDER', sub: 'Stay mobile — the ground erupts in lines', hpBelow: 1, moves: ['cleave', 'leap', 'drums', 'warcry'] },
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
      warcry: { kind: 'summon', range: 999, windup: 1.0, recover: 0.6, cd: 16, weight: 1.5, monster: 'leafling', count: 2, max: 2, corrupted: true },
    },
    rewards: { exp: 300, loot: 'grukk', items: { warchief_totem: 1 }, lore: 'grukk' },
    unlocks: [],
  },

  // ---------------- OPTIONAL MINI-BOSSES on every field map (owner 2026-09-29: "like A1, on every map"). Pure data on
  // the generic AreaBoss: an existing monster's art scaled up + moves; they gate nothing, pay EXP + an elite loot roll.
  // Not marked on the map until their arena has been seen (data/mapMarkers.js) — players find them by exploring.
  mini_sunken_horn: {
    id: 'mini_sunken_horn', name: 'THE SUNKEN HORN', title: 'Ram of the Drowned Temple', type: 'mini', impl: 'area',
    route: 'A', map: 'a2', level: 20, nativeLevel: 12, recommendedLevel: 19,
    teaches: 'Bait the charge into a wall · punish the stumble',
    stats: { hp: 8000, def: 10, speed: 96, radius: 24, height: 56, mass: 7, weakness: ['shadow'], superArmor: true, poise: 900 },
    look: { sprite: 'rock_rhino', scale: 1.6, aura: '200,170,120' },
    arena: { name: 'Sunken Temple', center: [34.5, 93.5], radius: 6.4, trigger: 4.8, bossSpawn: [34.5, 91.5], entry: [34.5, 100.5] },
    appear: [],
    phases: [
      { name: 'THE HORN', sub: 'Sidestep the charge — it stumbles after', hpBelow: 1, moves: ['gore', 'charge', 'stomp'] },
      { name: 'RAMPAGE', sub: 'The temple shakes', hpBelow: 0.5, windup: 0.9, speed: 1.15, moves: ['gore', 'charge', 'stomp', 'rubble'] },
    ],
    moves: {
      gore: { kind: 'strike', range: 80, windup: 0.7, recover: 0.6, cd: 1.6, weight: 4, power: 29, knock: 220, shape: { shape: 'cone', r: 92, half: 0.9 } },
      charge: { kind: 'dash', guardBreak: true, range: 320, min: 100, windup: 1.0, recover: 1.3, cd: 5, weight: 3, power: 36, knock: 300, len: 300, width: 40, opening: 2.0 },
      stomp: { kind: 'strike', range: 140, windup: 1.0, recover: 0.8, cd: 7, weight: 2, power: 26, knock: 220, shape: { shape: 'circle', r: 120 }, status: [{ id: 'slow', dur: 2 }], opening: 1.2 },
      rubble: { kind: 'pattern', layout: 'ring', range: 400, windup: 1.1, recover: 0.7, cd: 9, weight: 2, power: 24, knock: 180, count: 9, r: 32, dist: 120 },
    },
    rewards: { exp: 700, loot: 'elite' },
    unlocks: [],
  },
  mini_archive_warden: {
    id: 'mini_archive_warden', name: 'THE ARCHIVE WARDEN', title: 'Crystal Keeper of the Lost Records', type: 'mini', impl: 'area',
    route: 'A', map: 'a3', level: 32, nativeLevel: 15, recommendedLevel: 31,
    teaches: 'Strike its crystal core from the front · clear the scarab swarm',
    stats: { hp: 10000, def: 14, speed: 70, radius: 24, height: 62, mass: 8, weakness: ['physical'], superArmor: true, poise: 1000 },
    look: { sprite: 'crystal_golem', scale: 1.5, aura: '120,200,255' },
    arena: { name: 'Archive Ruins', center: [46.5, 78.5], radius: 6.4, trigger: 4.8, bossSpawn: [46.5, 76.5], entry: [46.5, 85.5] },
    appear: [],
    phases: [
      { name: 'KEEPER', sub: 'Crystal lines erupt — read them early', hpBelow: 1, moves: ['slam', 'shards', 'volley'] },
      { name: 'THE SWARM WAKES', sub: 'Scarabs guard their keeper', hpBelow: 0.55, windup: 0.9, moves: ['slam', 'shards', 'volley', 'swarm'] },
    ],
    moves: {
      slam: { kind: 'strike', guardBreak: true, range: 90, windup: 0.9, recover: 0.8, cd: 2.2, weight: 4, power: 34, knock: 260, shape: { shape: 'circle', r: 96 }, opening: 1.2 },
      shards: { kind: 'pattern', layout: 'cross', range: 420, windup: 1.0, recover: 0.6, cd: 6, weight: 3, power: 27, knock: 180, count: 5, r: 30, step: 56, delay: 0.12, dmg: 'magic', color: '120,200,255' },
      volley: { kind: 'volley', range: 380, min: 90, windup: 0.8, recover: 0.6, cd: 5, weight: 2, power: 20, count: 6, spread: 0.9, speed: 280, dmg: 'magic', color: '#80c8ff' },
      swarm: { kind: 'summon', range: 999, windup: 1.0, recover: 0.6, cd: 16, weight: 1.5, monster: 'void_scarab', count: 3, max: 3 },
    },
    rewards: { exp: 1200, loot: 'elite' },
    unlocks: [],
  },
  mini_old_scarclaw: {
    id: 'mini_old_scarclaw', name: 'OLD SCARCLAW', title: 'The Bear the Trappers Never Caught', type: 'mini', impl: 'area',
    route: 'B', map: 'b1', level: 12, nativeLevel: 7, recommendedLevel: 11,
    difficulty: { hp: 1.15, power: 1.15 }, // Route B
    teaches: 'A late third swipe · break the frozen ground in time',
    stats: { hp: 6000, def: 8, speed: 88, radius: 24, height: 60, mass: 7, weakness: ['physical'], superArmor: true, poise: 800 },
    look: { sprite: 'frost_bear', scale: 1.5, aura: '160,210,255' },
    arena: { name: "Trapper's Ruins", center: [35.5, 62.5], radius: 6.4, trigger: 4.8, bossSpawn: [35.5, 62.5], entry: [35.5, 69.5] },
    appear: [],
    phases: [
      { name: 'SCARCLAW', sub: 'Count the swipes — the third comes late', hpBelow: 1, moves: ['mauls', 'rush', 'eruption'] },
      { name: 'OLD FURY', sub: 'The ground freezes beneath it', hpBelow: 0.5, windup: 0.9, speed: 1.15, moves: ['mauls', 'rush', 'eruption', 'frost_ring'] },
    ],
    moves: {
      mauls: { kind: 'combo', range: 80, recover: 0.7, cd: 2.4, weight: 4, power: 22, knock: 180, hits: [
        { windup: 0.55, power: 22, shape: { shape: 'cone', r: 88, half: 0.9 } },
        { windup: 0.4, power: 22, shape: { shape: 'cone', r: 88, half: 0.9 } },
        { windup: 0.85, power: 29, shape: { shape: 'cone', r: 96, half: 1.0 }, track: 0.5 },
      ] },
      rush: { kind: 'dash', guardBreak: true, range: 300, min: 100, windup: 0.9, recover: 1.1, cd: 5, weight: 3, power: 29, knock: 280, len: 280, width: 38, opening: 1.8 },
      eruption: { kind: 'strike', range: 150, windup: 1.1, recover: 0.8, cd: 7, weight: 2, power: 26, knock: 200, dmg: 'magic', shape: { shape: 'cone', r: 170, half: 0.5 }, status: [{ id: 'slow', dur: 2 }], opening: 1.4 },
      frost_ring: { kind: 'pattern', layout: 'ring', range: 400, windup: 1.2, recover: 0.8, cd: 9, weight: 2, power: 22, knock: 180, count: 10, r: 32, dist: 115, dmg: 'magic', status: [{ id: 'root', dur: 0.8 }], color: '160,220,255' },
    },
    rewards: { exp: 450, loot: 'elite' },
    unlocks: [],
  },
  mini_broodmother: {
    id: 'mini_broodmother', name: 'THE MINE BROODMOTHER', title: 'Queen of the Old Mine', type: 'mini', impl: 'area',
    route: 'B', map: 'b2', level: 25, nativeLevel: 12, recommendedLevel: 24,
    difficulty: { hp: 1.2, power: 1.2 }, // Route B
    teaches: 'Webs root you — dodge them, then burst the brood',
    stats: { hp: 8000, def: 9, speed: 112, radius: 22, height: 48, mass: 6, weakness: ['shadow'], superArmor: true, poise: 850 },
    look: { sprite: 'cave_spider', scale: 1.9, aura: '190,130,255' },
    arena: { name: 'Old Mine', center: [32.5, 92.5], radius: 6.4, trigger: 4.8, bossSpawn: [32.5, 90.5], entry: [32.5, 99.5] },
    appear: [],
    phases: [
      { name: 'BROODMOTHER', sub: 'Webs root — keep moving', hpBelow: 1, moves: ['fang', 'webs', 'pounce'] },
      { name: 'THE BROOD', sub: 'Her young answer', hpBelow: 0.5, windup: 0.9, speed: 1.2, moves: ['fang', 'webs', 'pounce', 'brood'] },
    ],
    moves: {
      fang: { kind: 'strike', range: 75, windup: 0.55, recover: 0.5, cd: 1.3, weight: 4, power: 26, knock: 160, shape: { shape: 'cone', r: 84, half: 0.8 }, status: [{ id: 'poison', dur: 3 }] },
      webs: { kind: 'volley', range: 380, min: 80, windup: 0.8, recover: 0.6, cd: 5, weight: 3, power: 15, count: 5, spread: 0.8, speed: 260, dmg: 'magic', status: [{ id: 'root', dur: 1 }], color: '#e0e0ff' },
      pounce: { kind: 'leap', guardBreak: true, range: 320, min: 110, windup: 1.0, recover: 0.7, cd: 5, weight: 3, power: 31, knock: 260, r: 80, track: 0.6, opening: 1.6 },
      brood: { kind: 'summon', range: 999, windup: 1.0, recover: 0.6, cd: 15, weight: 1.5, monster: 'cave_spider', count: 2, max: 3 },
    },
    rewards: { exp: 900, loot: 'elite' },
    unlocks: [],
  },
  mini_icebound_king: {
    id: 'mini_icebound_king', name: 'THE ICEBOUND KING', title: 'Yeti of the Frozen Cave', type: 'mini', impl: 'area',
    route: 'B', map: 'b3', level: 40, nativeLevel: 16, recommendedLevel: 39,
    difficulty: { hp: 1.25, power: 1.2, windup: 0.95 }, // Route B
    teaches: 'Guard-breaking pounds · ice rain — never stand still',
    stats: { hp: 11000, def: 14, speed: 72, radius: 26, height: 66, mass: 9, weakness: ['physical'], superArmor: true, poise: 1100 },
    look: { sprite: 'yeti', scale: 1.5, aura: '170,220,255' },
    arena: { name: 'Icebound Cave', center: [18.5, 136.5], radius: 6.4, trigger: 4.8, bossSpawn: [18.5, 134.5], entry: [24.5, 136.5] },
    appear: [],
    phases: [
      { name: 'THE KING', sub: 'The pound breaks guards — dodge it', hpBelow: 1, moves: ['swipe', 'pound', 'hurl'] },
      { name: 'BLIZZARD', sub: 'Ice falls from the cave roof', hpBelow: 0.5, windup: 0.85, speed: 1.15, moves: ['swipe', 'pound', 'hurl', 'icefall'] },
    ],
    moves: {
      swipe: { kind: 'strike', range: 85, windup: 0.65, recover: 0.6, cd: 1.5, weight: 4, power: 34, knock: 220, shape: { shape: 'cone', r: 96, half: 1.0 } },
      pound: { kind: 'strike', guardBreak: true, range: 120, windup: 1.1, recover: 1.0, cd: 5, weight: 3, power: 44, knock: 300, shape: { shape: 'circle', r: 128 }, opening: 1.6 },
      hurl: { kind: 'volley', range: 400, min: 100, windup: 0.9, recover: 0.6, cd: 5, weight: 2, power: 29, count: 3, spread: 0.5, speed: 300, color: '#c8f0ff' },
      icefall: { kind: 'pattern', layout: 'cross', range: 420, windup: 1.0, recover: 0.6, cd: 8, weight: 2, power: 31, knock: 180, count: 5, r: 34, step: 60, delay: 0.14, dmg: 'magic', status: [{ id: 'slow', dur: 2 }], color: '170,220,255' },
    },
    rewards: { exp: 1500, loot: 'elite' },
    unlocks: [],
  },

  // ---------------- A1 BOSS: the Guardian of the Forest (fight code: boss/guardian.js; arena: maps/ruins.js; art: the
  // owner's A1 boss sheet). W2: it guards the north road out of A1 — its fall opens A2 (Ancient Valley).
  boss_a1: {
    id: 'boss_a1', name: 'GUARDIAN OF THE FOREST', title: 'Warden of the Whispering Heart', type: 'area', impl: 'guardian',
    route: 'A', map: 'arena', monster: 'guardian', level: 14, nativeLevel: 10, recommendedLevel: 13,
    teaches: 'Everything A1 taught · weak windows · arena hazards · the final attack',
    arena: { name: 'Guardian Arena', center: [132.5, 28], radius: 15.5, trigger: 13.6, bossSpawn: [132, 22], entry: [135, 42] },
    appear: [{ type: 'flag', flag: 'gateOpened', label: 'Open the Guardian Gate' }], // it sleeps behind the sealed gate
    // the owner's A1 boss VFX sheet (tools/build-boss-vfx.js, 'g_*'), played by boss/guardian.js
    look: { vfx: { slash: 'g_slash', quake: 'g_quake', impact: 'g_shockwave', roots: 'g_pillar', crystal: 'g_burst', summon: 'g_eruption', nova: 'g_shockwave', phase: 'g_vortex' } },
    phases: [
      { name: 'PHASE I', sub: 'Claw · Charge · Leap · Smash', hpBelow: 1 },
      { name: 'PHASE II', sub: 'Roots · Crystal volleys · Thornlings', hpBelow: 0.7 },
      { name: 'PHASE III — ENRAGED', sub: 'Combos · Nova · the Last Root', hpBelow: 0.3 },
    ],
    notes: ['Weak windows after heavy blows', 'Root patches + corruption pools (arena)', 'Summoned thornlings', 'Final attack: Last Root of the Forest'],
    rewards: { exp: 500, loot: 'guardian', lore: 'guardian_rest' },
    unlocks: ['a2'],
  },

  // ---------------- A2 / A3 (planned: the fights arrive with their maps — W3 magma beast sheet, W4 rune knight sheet)
  // A2 BOSS (W3c): the Magma Beast in the Magma Rift (maps/ancientValley.js). Art = the owner's A2 boss sheet: bite,
  // run, eruption, fireball, stagger, and a red enraged form for phase 2.
  boss_a2: {
    id: 'boss_a2', name: 'MAGMA BEAST', title: 'Lord of the Magma Rift', type: 'area', impl: 'area',
    route: 'A', map: 'rift', level: 26, nativeLevel: 14, recommendedLevel: 25,
    teaches: 'Heat rhythm: survive the OVERHEAT blast, then burst its core · lava pools shrink the arena',
    stats: { hp: 16000, def: 12, speed: 96, radius: 26, height: 70, mass: 7, weakness: ['shadow'], superArmor: true, poise: 1000 },
    look: {
      sprite: 'magma_beast', scale: 1.15, aura: '255,120,40',
      anims: { hurt: 'stagger', roar: 'enrage' },
      phaseAnims: { 2: { idle: 'enrage', walk: 'run' } }, // MOLTEN FURY: the red form
      // the owner's A2 boss VFX sheet (tools/build-boss-vfx.js, 'm_*')
      vfx: { charge: 'm_orb', slash: 'm_slash', impact: 'm_crater', bolt: 'm_bolt', eruption: 'm_eruption', nova: 'm_shockwave', phase: 'm_vortex', pool: 'm_sigil' },
    },
    // a large round arena like the Guardian's; exits seal and the camera holds the arena while it fights
    arena: { name: 'Magma Rift', center: [84, 22], radius: 14.5, trigger: 12, bossSpawn: [84, 16], entry: [84, 36], cameraLock: true },
    // SIGNATURE (boss/mechanics.js): every fire move heats it; at 100% it OVERHEATS — survive the blast, then burst
    // its exposed core. Eruptions leave lava pools that burn: the arena shrinks until they cool.
    mechanics: [
      { type: 'overheat', max: 100, weak: 5.5, phase2Mult: 1.25, gain: { fireball: 15, fire_fan: 18, eruption: 20, lava_rain: 24, magma_nova: 22, charge: 8, bite: 5 }, blast: { r: 190, power: 46, windup: 1.7 } },
      { type: 'lava_pools', from: ['eruption', 'lava_rain'], life: 7, life2: 9, max: 14 },
    ],
    appear: [],
    phases: [
      { name: 'MOLTEN HIDE', sub: 'Bite · Charge · Fireballs · Eruptions', hpBelow: 1, moves: ['bite', 'charge', 'fireball', 'eruption'] },
      {
        name: 'MOLTEN FURY', sub: 'Its core blazes — rings of magma, a rain of fire', hpBelow: 0.5, windup: 0.85, speed: 1.2, shockwave: 26,
        moves: ['bite', 'charge', 'fire_fan', 'lava_rain', 'magma_nova'],
      },
    ],
    moves: {
      bite: { kind: 'strike', range: 90, windup: 0.7, recover: 0.6, cd: 1.6, weight: 4, power: 34, knock: 200, shape: { shape: 'cone', r: 96, half: 0.8 } },
      charge: { kind: 'dash', guardBreak: true, range: 300, min: 120, windup: 0.95, recover: 0.9, cd: 5, weight: 2.5, power: 40, knock: 300, len: 260, width: 42, opening: 1.6, anim: { attack: 'run' } },
      fireball: { kind: 'volley', range: 360, min: 110, windup: 0.8, recover: 0.6, cd: 4, weight: 2.5, power: 26, count: 3, spread: 0.5, speed: 260, dmg: 'magic', status: [{ id: 'burn', dur: 2 }], color: '#ff8a30', anim: { windup: 'fire_wind', attack: 'fire_shot' } },
      eruption: { kind: 'pattern', layout: 'scatter', range: 999, windup: 1.0, recover: 0.8, cd: 7, weight: 2, power: 30, count: 6, r: 42, delay: 0.15, dmg: 'magic', status: [{ id: 'burn', dur: 2 }], color: '255,120,40', opening: 1.2, anim: { roar: 'eruption' } },
      fire_fan: { kind: 'volley', range: 360, min: 90, windup: 0.8, recover: 0.6, cd: 4, weight: 2.5, power: 26, count: 5, spread: 0.9, speed: 280, dmg: 'magic', status: [{ id: 'burn', dur: 2 }], color: '#ff6a20', anim: { windup: 'fire_wind', attack: 'fire_shot' } },
      lava_rain: { kind: 'pattern', layout: 'scatter', range: 999, windup: 1.0, recover: 0.8, cd: 7, weight: 2, power: 30, count: 10, r: 40, delay: 0.1, dmg: 'magic', status: [{ id: 'burn', dur: 2.5 }], color: '255,90,30', anim: { roar: 'eruption' } },
      magma_nova: { kind: 'nova', range: 999, windup: 1.1, recover: 0.9, cd: 9, weight: 1.5, power: 28, rings: 3, width: 48, gap: 72, dmg: 'magic', status: [{ id: 'burn', dur: 2 }], color: '255,110,40', anim: { roar: 'enrage' } },
    },
    rewards: { exp: 800, gold: 300, loot: 'magma_beast', items: { magma_heart: 1 }, lore: 'magma_beast' },
    unlocks: ['a3'],
  },
  // A2 SECRET BOSS: VARKHARON, the Sealed Cinder King, on the Cinder Throne behind the dragon door of the Quiet Hollow
  // (maps/cinderThrone.js). Reached only through the Ashen Pilgrim's three trials (data/wanderers.js, quests ember_*).
  // Art = the owner's v2 dragon sheet ('varkharon', one form; phases by colour filter), effects = its VFX sheet ('d_*').
  // Owner: "different from every boss" — SKY CHAINS (it flies; hold [E] at chain posts to drag it down) · RISING LAVA
  // (the throne shrinks every phase, for real) · EMBER DEBT (fire hits stack embers that IGNITE) · LAST BREATH at 10%.
  boss_varkharon: {
    id: 'boss_varkharon', name: 'VARKHARON', title: 'the Sealed Cinder King', type: 'secret', impl: 'area',
    route: 'A', map: 'cinder', level: 34, nativeLevel: 14, recommendedLevel: 32,
    difficulty: { hp: 1.1, power: 1.1 },
    teaches: 'Chain the dragon out of the sky · keep to the shrinking throne · pay your ember debt before it ignites',
    stats: { hp: 22000, def: 13, speed: 100, radius: 30, height: 80, mass: 9, weakness: ['shadow'], superArmor: true, poise: 1200 },
    look: {
      sprite: 'varkharon', scale: 1, aura: '255,120,40', // drawn 1:1 (atlas built at the game size: no upscaling blur)
      anims: { roar: 'roar' },
      // one drawn form: each phase is its own colour (filter) + glow — 3 = the corrupted violet fire
      phaseStyle: { 1: { aura: '255,120,40' }, 2: { aura: '255,160,60', glow: 5, filter: 'saturate(1.25) brightness(1.08)' }, 3: { aura: '180,90,255', glow: 7, filter: 'hue-rotate(235deg) saturate(1.3)' }, 4: { aura: '255,70,40', glow: 10, scale: 1.08, filter: 'saturate(1.5) contrast(1.1)' } },
      vfx: { charge: 'd_aura', slash: 'm_slash', impact: 'd_ground', bolt: 'd_bolt', eruption: 'd_explosion', nova: 'd_ground', phase: 'd_phase', pool: 'd_telegraph', spark: 'd_hit', weak: 'd_weak' },
      phaseAura: {
        2: { transition: ['d_phase', 'd_enrage'], step: 0.4, stepLife: 0.7, scale: 1.4 },
        3: { transition: ['ca_form', 'ca_ring', 'ca_vortex'], step: 0.35, stepLife: 0.6, scale: 1.4 },
        4: { transition: ['d_enrage', 'd_explosion'], step: 0.4, stepLife: 0.7, loop: 'd_enrage', loopLife: 0.9, scale: 1.3 },
      },
    },
    arena: { name: 'The Cinder Throne', center: [148, 151], radius: 12, trigger: 9, bossSpawn: [148, 149], entry: [148, 165], cameraLock: true },
    appear: [],
    phases: [
      { name: 'SEALED EMBER', sub: 'Claw · tail · breath — every flame leaves an ember', hpBelow: 1, moves: ['claw', 'tail_sweep', 'bite_combo', 'breath'] },
      { name: 'AWAKENED FLAME', sub: 'It takes wing — chain it to the throne', hpBelow: 0.75, windup: 0.95, speed: 1.08, shockwave: 26, moves: ['claw', 'bite_combo', 'breath', 'fireball', 'pounce'] },
      { name: 'ABYSSAL CORRUPTION', sub: 'Black fire — every hit a double ember', hpBelow: 0.5, windup: 0.9, speed: 1.12, shockwave: 30, moves: ['claw', 'bite_combo', 'breath', 'fireball', 'flame_cross', 'ember_rain'] },
      { name: "CINDER KING'S WRATH", sub: 'The throne is almost gone', hpBelow: 0.25, windup: 0.85, speed: 1.18, shockwave: 34, moves: ['claw', 'bite_combo', 'breath', 'pounce', 'ember_rain', 'cinder_nova'] },
    ],
    moves: {
      claw: { kind: 'strike', range: 110, windup: 0.7, recover: 0.6, cd: 1.6, weight: 3.5, power: 40, knock: 220, shape: { shape: 'cone', r: 118, half: 0.9 } },
      tail_sweep: { kind: 'strike', range: 150, windup: 0.95, recover: 0.7, cd: 4, weight: 2, power: 36, knock: 260, shape: { shape: 'ring', r0: 40, r: 150 }, opening: 1.0, anim: { windup: 'tail', attack: 'sweep' } },
      bite_combo: {
        kind: 'combo', range: 110, cd: 4.5, weight: 2.5, power: 34, knock: 200, recover: 0.8, opening: 1.4, shape: { shape: 'cone', r: 104, half: 0.8 },
        hits: [{ windup: 0.5 }, { windup: 0.45 }, { windup: 1.15, track: true, power: 55, shape: { shape: 'cone', r: 128, half: 1.1 } }],
      },
      breath: { kind: 'strike', range: 260, windup: 1.2, recover: 0.8, cd: 5, weight: 2.5, power: 38, knock: 160, dmg: 'magic', status: [{ id: 'burn', dur: 2.5 }], color: '255,110,30', shape: { shape: 'cone', r: 250, half: 0.42 }, anim: { windup: 'breath_wind', attack: 'breath' } },
      fireball: { kind: 'volley', range: 380, min: 0, windup: 0.8, recover: 0.6, cd: 4, weight: 2.5, power: 28, count: 3, spread: 0.5, speed: 280, dmg: 'magic', status: [{ id: 'burn', dur: 2 }], color: '#ff8a30', anim: { windup: 'spit_wind', attack: 'spit' } },
      pounce: { kind: 'leap', guardBreak: true, range: 360, min: 120, windup: 1.0, recover: 0.9, cd: 6, weight: 2, power: 50, knock: 300, r: 86, track: 0.6, opening: 1.3 },
      flame_cross: { kind: 'pattern', layout: 'cross', range: 400, windup: 0.9, recover: 0.6, cd: 6, weight: 2, power: 32, knock: 180, count: 4, r: 38, step: 60, delay: 0.12, dmg: 'magic', status: [{ id: 'burn', dur: 2 }], color: '190,90,255', anim: { attack: 'spikes' } },
      ember_rain: { kind: 'pattern', layout: 'scatter', range: 999, windup: 1.0, recover: 0.8, cd: 7, weight: 2, power: 30, count: 10, r: 38, delay: 0.1, dmg: 'magic', status: [{ id: 'burn', dur: 2 }], color: '255,100,30', anim: { roar: 'roar' } },
      cinder_nova: { kind: 'nova', range: 999, windup: 1.1, recover: 0.9, cd: 9, weight: 1.5, power: 30, rings: 3, width: 46, gap: 64, dmg: 'magic', status: [{ id: 'burn', dur: 2 }], color: '255,90,30', anim: { roar: 'burst' } },
    },
    // SIGNATURE (boss/mechanics.js). Order = priority for the next turn: the rising lava first, then the sky, then IGNITE
    mechanics: [
      { type: 'rising_lava', rings: { 2: 11, 3: 9.6, 4: 8.4 }, floorTiles: [12, 14], lavaTile: 24 }, // T.ARENA, T.CORRUPT -> T.LAVA
      { type: 'sky_chains', phases: [2, 3], posts: [[148, 145], [142, 152], [154, 152]], every: 24, first: 5 },
      { type: 'ember_debt', every: 18, first: 14 },
    ],
    rewards: { exp: 2200, gold: 600, loot: 'varkharon', items: { heart_of_varkharon: 1 }, lore: 'varkharon' },
    unlocks: [],
  },
  // A3 MAJOR BOSS (W4b): the Rune Knight in the Sanctum behind the Golden Gate (maps/sanctum.js). Art = the owner's A3
  // boss sheet; effects = the A3 VFX sheet ('r_*'). A duel: SWORD / SHIELD stances, the RUNE SCRIPT (phase 2),
  // ECHOES of Asteria's soldiers (phase 3) and the FINAL JUDGEMENT (only the blue domes are safe).
  boss_a3: {
    id: 'boss_a3', name: 'RUNE KNIGHT', title: 'Last Warden of Asteria', type: 'major', impl: 'area',
    route: 'A', map: 'sanctum', level: 38, nativeLevel: 18, recommendedLevel: 36,
    teaches: 'Read the stance · wait out the late blade · remember the rune order · find the dome',
    stats: { hp: 24000, def: 16, speed: 110, radius: 20, height: 60, mass: 8, weakness: ['shadow'], superArmor: true, poise: 1300 },
    look: {
      sprite: 'rune_knight', scale: 1.1, aura: '140,190,255',
      anims: { hurt: 'stagger', roar: 'rune_cast' },
      vfx: { charge: 'r_orb', slash: 'r_slash', impact: 'r_blast', bolt: 'r_bolt', eruption: 'r_pillar', nova: 'r_burst', phase: 'r_vortex', sigil: 'r_sigil', dome: 'r_dome', shatter: 'r_shatter', spark: 'r_spark', echo: 'r_crystal' },
    },
    arena: { name: 'The Sanctum', center: [84, 24], radius: 14.5, trigger: 12, bossSpawn: [84, 17], entry: [84, 38], cameraLock: true },
    appear: [],
    phases: [
      { name: 'RUNE BLADE', sub: 'Sword and shield — read its stance', hpBelow: 1, moves: ['rune_slash', 'triple_cut', 'lunge', 'shield_bash', 'rune_bolts'] },
      { name: 'RUNE SCRIPT', sub: 'The floor remembers — so must you', hpBelow: 0.65, windup: 0.9, speed: 1.1, shockwave: 28, moves: ['rune_slash', 'triple_cut', 'lunge', 'shield_bash', 'rune_bolts'] },
      { name: 'ECHOES OF ASTERIA', sub: 'Its soldiers answer the call', hpBelow: 0.3, windup: 0.85, speed: 1.2, shockwave: 30, moves: ['rune_slash', 'triple_cut', 'lunge', 'shield_bash', 'rune_bolts'] },
    ],
    moves: {
      rune_slash: { kind: 'strike', range: 90, windup: 0.65, recover: 0.6, cd: 1.8, weight: 3, power: 42, knock: 220, shape: { shape: 'cone', r: 96, half: 0.85 }, anim: { windup: 'slash_wind', attack: 'slash_hit' } },
      // three cuts: quick, quick — then a LATE heavy blade (dodging early gets you hit)
      triple_cut: {
        kind: 'combo', range: 100, cd: 5, weight: 2.5, power: 34, knock: 200, recover: 0.8, opening: 1.2, shape: { shape: 'cone', r: 90, half: 0.8 },
        hits: [{ windup: 0.55 }, { windup: 0.4, track: true }, { windup: 1.05, track: true, power: 50, shape: { shape: 'cone', r: 110, half: 1.1 } }],
        anim: { windup: 'slash_wind', attack: 'combo_hit' },
      },
      lunge: { kind: 'dash', guardBreak: true, range: 320, min: 120, windup: 0.85, recover: 0.9, cd: 5, weight: 2, power: 44, knock: 300, len: 280, width: 36, opening: 1.3, anim: { windup: 'lunge_wind', attack: 'lunge_go' } },
      shield_bash: { kind: 'strike', range: 70, windup: 0.5, recover: 0.55, cd: 2, weight: 3, power: 36, knock: 320, shape: { shape: 'cone', r: 72, half: 0.9 }, anim: { windup: 'stance', attack: 'combo_hit' } },
      rune_bolts: { kind: 'volley', range: 380, min: 100, windup: 0.75, recover: 0.6, cd: 4, weight: 2.5, power: 30, count: 3, spread: 0.5, speed: 280, dmg: 'magic', color: '#9ad8ff', anim: { windup: 'rune_cast', attack: 'rune_cast' } },
    },
    // SIGNATURE (boss/mechanics.js). Order = priority when several want the next turn.
    mechanics: [
      { type: 'judgement', at: 0.15, domes: 3, domeR: 46, windup: 3.2, power: 80, weak: 6, anim: 'plunge', name: 'ASTERIAN JUDGEMENT' },
      { type: 'echoes', phase: 3, count: 2, life: 14, every: 22, delay: 0.3, sprite: 'bronze_hoplite' },
      { type: 'rune_sequence', phase: 2, every: 11, count: 4, r: 56, power: 36, gap: 0.55, delay: 1.1, anim: 'rune_cast' },
      {
        type: 'stance', switchEvery: { sword: 3, shield: 2 }, breakWeak: 4,
        stances: {
          sword: { label: 'SWORD STANCE', hint: 'Fast cuts — the last one comes late', moves: ['rune_slash', 'triple_cut', 'lunge'] },
          shield: { label: 'SHIELD STANCE', hint: 'Strike its back — or break the guard', moves: ['shield_bash', 'rune_bolts'], block: { arc: 1.3, mult: 0.1 }, guardHp: 1400, anims: { idle: 'stance', walk: 'stance' } },
        },
      },
    ],
    rewards: { exp: 2500, // pacing (L4): the end of Route A ≈ LV 38
      gold: 500, loot: 'rune_knight', items: { asterian_crest: 1 }, lore: 'rune_knight' },
    unlocks: ['city2'],
  },

  // ---------------- ROUTE B (architecture only — Phase 13/14 builds the maps; nothing here is spawned yet)
  // B1 AREA BOSS (B1b): HOARFANG in the Frost Arena (maps/frostArena.js). Art = the owner's B1 boss sheet (a giant frost
  // wolf); effects = the B1 VFX sheet ('f_*'); the phase change plays the owner's AURA sheet ('fa_*', look.phaseAura).
  // Phase 1 THE HUNT: a fast hunter (late third bite, pounce, shards, its howl brings the pack). Phase 2 WHITEOUT:
  // FROSTBITE punishes standing still, and ABSOLUTE ZERO sweeps the arena — hide behind the ice pillars it raises.
  boss_b1: {
    id: 'boss_b1', name: 'HOARFANG', title: 'The Winter Alpha', type: 'area', impl: 'area',
    route: 'B', map: 'frost_arena', level: 17, nativeLevel: 10, recommendedLevel: 16,
    difficulty: { hp: 1.15, power: 1.15 }, // Route B: harder than its level (Level rework L3)
    teaches: 'Wait for the late bite · keep moving (frostbite) · hide behind the ice from ABSOLUTE ZERO',
    stats: { hp: 11000, def: 10, speed: 128, radius: 24, height: 64, mass: 6, weakness: ['physical'], superArmor: true, poise: 800 },
    look: {
      sprite: 'hoarfang', scale: 1.1, aura: '150,210,255',
      anims: { hurt: 'hit', roar: 'howl' },
      phaseAnims: { 2: { walk: 'run' } },
      vfx: { charge: 'f_spark', slash: 'f_slash', impact: 'f_crater', bolt: 'f_bolt', eruption: 'f_spikes', nova: 'f_shockwave', phase: 'f_vortex', pillar: 'f_pillar', shatter: 'f_shatter', burst: 'f_burst' },
      // the owner's AURA sheet: ring forms -> spiked ring -> big ring -> burst when WHITEOUT begins, then a ring stays under it
      phaseAura: { 2: { transition: ['fa_form', 'fa_ring', 'fa_bigring', 'fa_burst'], step: 0.35, stepLife: 0.6, loop: 'fa_ring', loopLife: 0.9, scale: 1.3 } },
    },
    arena: { name: 'The Frost Arena', center: [142, 146], radius: 15.5, trigger: 12, bossSpawn: [142, 141], entry: [142, 131], cameraLock: true },
    appear: [],
    phases: [
      { name: 'THE HUNT', sub: 'Bite · Pounce · Frost shards — its howl calls the pack', hpBelow: 1, moves: ['bite', 'pounce', 'frost_shards', 'howl'] },
      { name: 'WHITEOUT', sub: 'The blizzard rises — keep moving, find the ice', hpBelow: 0.55, windup: 0.9, speed: 1.15, shockwave: 24, moves: ['bite', 'pounce', 'frost_shards', 'ice_spikes', 'frost_nova'] },
    ],
    moves: {
      // two quick bites, then a LATE heavy one (an early dodge gets caught)
      bite: {
        kind: 'combo', range: 90, cd: 3.5, weight: 3, power: 24, knock: 170, recover: 0.7, opening: 1.1, shape: { shape: 'cone', r: 84, half: 0.8 },
        hits: [{ windup: 0.45 }, { windup: 0.35, track: true }, { windup: 0.95, track: true, power: 34, shape: { shape: 'cone', r: 100, half: 1.0 } }],
        anim: { windup: 'bite_wind', attack: 'bite_hit' },
      },
      pounce: { kind: 'leap', guardBreak: true, range: 330, min: 110, windup: 0.9, recover: 0.7, cd: 5, weight: 2.5, power: 32, knock: 280, r: 80, track: 0.6, opening: 1.4, anim: { windup: 'run', attack: 'run' } },
      frost_shards: { kind: 'volley', range: 360, min: 100, windup: 0.75, recover: 0.6, cd: 4, weight: 2.5, power: 22, count: 3, spread: 0.5, speed: 270, dmg: 'magic', status: [{ id: 'slow', dur: 1.2 }], color: '#bfe6ff', anim: { windup: 'slash_wind', attack: 'slash_hit' } },
      howl: { kind: 'summon', range: 999, windup: 1.0, recover: 0.6, cd: 18, weight: 1.5, monster: 'rime_wolf', count: 2, max: 2, anim: { roar: 'howl' } },
      ice_spikes: { kind: 'pattern', layout: 'cross', range: 400, windup: 0.9, recover: 0.6, cd: 6, weight: 2, power: 26, knock: 180, count: 4, r: 30, step: 58, delay: 0.12, dmg: 'magic', color: '150,210,255', anim: { roar: 'special' } },
      frost_nova: { kind: 'nova', range: 999, windup: 1.1, recover: 0.9, cd: 9, weight: 1.5, power: 26, rings: 3, width: 44, gap: 70, dmg: 'magic', status: [{ id: 'slow', dur: 1.5 }], color: '150,210,255', anim: { roar: 'special' } },
    },
    // SIGNATURE (boss/mechanics.js): order = priority when several want the next turn
    mechanics: [
      { type: 'glacier', phase: 2, every: 17, count: 3, dist: 150, life: 9, windup: 3, power: 70, weak: 4, anim: 'howl', name: 'ABSOLUTE ZERO' },
      { type: 'frostbite', phase: 2, max: 5, rate: 1.1, melt: 2.2, freeze: 1.1, power: 28 },
    ],
    rewards: { exp: 700, gold: 280, loot: 'hoarfang', items: { frost_heart: 1 }, lore: 'hoarfang' },
    unlocks: ['b2'],
  },
  // B2 AREA BOSS (B2b): the AMETHYST COLOSSUS in the Heart of the Caverns (maps/crystalHeart.js). Art = the owner's B2 boss
  // sheet (a giant crystal golem); effects = the B2 VFX sheet ('c_*'); its phase change plays the B2 AURA sheet ('ca_*').
  // SIGNATURE crystal_armor: break its crystal ARMOR (SHATTERED), then smash the clusters it grows before it absorbs them.
  boss_b2: {
    id: 'boss_b2', name: 'AMETHYST COLOSSUS', title: 'Heart of the Crystal Caverns', type: 'area', impl: 'area',
    route: 'B', map: 'crystal_heart', level: 31, nativeLevel: 14, recommendedLevel: 30,
    difficulty: { hp: 1.2, power: 1.2, windup: 0.95 },
    teaches: 'Break the armour · smash the crystal clusters before they are absorbed · wait for the late third fist',
    stats: { hp: 15000, def: 12, speed: 88, radius: 28, height: 76, mass: 9, weakness: ['physical'], superArmor: true, poise: 1000 },
    look: {
      sprite: 'amethyst_colossus', scale: 1.15, aura: '190,140,255',
      anims: { hurt: 'hit', roar: 'glow' },
      phaseAnims: { 2: { idle: 'glow' } },
      vfx: { charge: 'c_spark', slash: 'c_slash', impact: 'c_crater', bolt: 'c_bolt', eruption: 'c_spikes', nova: 'c_eruption', phase: 'c_burst', shatter: 'c_shatter', burst: 'c_burst', spikes: 'c_spikes', sigil: 'c_sigil' },
      phaseAura: { 2: { transition: ['ca_form', 'ca_ring', 'ca_vortex', 'ca_surge', 'ca_burst'], step: 0.3, stepLife: 0.55, loop: 'ca_ring', loopLife: 0.9, scale: 1.3 } },
    },
    arena: { name: 'Heart of the Caverns', center: [142, 30], radius: 14.5, trigger: 11, bossSpawn: [142, 24], entry: [128, 29], cameraLock: true },
    appear: [],
    phases: [
      { name: 'CRYSTAL SHELL', sub: 'Break the armour — then smash what it grows', hpBelow: 1, moves: ['fists', 'charge', 'slam', 'crystal_spikes'] },
      { name: 'RESONANCE', sub: 'The Heart sings — crystals fall from the ceiling', hpBelow: 0.5, windup: 0.9, speed: 1.1, shockwave: 26, moves: ['fists', 'charge', 'slam', 'prism_volley', 'crystal_rain', 'resonance'] },
    ],
    moves: {
      fists: {
        kind: 'combo', range: 100, cd: 4, weight: 3, power: 30, knock: 200, recover: 0.8, opening: 1.1, shape: { shape: 'cone', r: 96, half: 0.8 },
        hits: [{ windup: 0.55 }, { windup: 0.45, track: true }, { windup: 1.1, track: true, power: 44, shape: { shape: 'cone', r: 116, half: 1.1 } }],
        anim: { windup: 'strike_wind', attack: 'strike_hit' },
      },
      charge: { kind: 'dash', guardBreak: true, range: 300, min: 120, windup: 1.0, recover: 1.0, cd: 5.5, weight: 2, power: 40, knock: 300, len: 260, width: 46, opening: 1.5, anim: { windup: 'charge', attack: 'charge' } },
      slam: { kind: 'strike', range: 110, windup: 1.0, recover: 1.0, cd: 4.5, weight: 2.5, power: 42, knock: 280, heavy: true, opening: 1.2, shape: { shape: 'circle', r: 88, offset: 44 }, anim: { windup: 'slam_wind', attack: 'slam_hit' } },
      crystal_spikes: { kind: 'pattern', layout: 'cross', range: 400, windup: 0.9, recover: 0.6, cd: 6, weight: 2, power: 26, knock: 180, count: 4, r: 30, step: 60, delay: 0.12, dmg: 'magic', color: '190,140,255', anim: { roar: 'slam_hit' } },
      prism_volley: { kind: 'volley', range: 380, min: 100, windup: 0.8, recover: 0.6, cd: 4, weight: 2.5, power: 26, count: 5, spread: 0.8, speed: 270, dmg: 'magic', color: '#c89aff', anim: { windup: 'glow', attack: 'strike_hit' } },
      crystal_rain: { kind: 'pattern', layout: 'scatter', range: 999, windup: 1.0, recover: 0.8, cd: 7, weight: 2, power: 28, count: 9, r: 38, delay: 0.1, dmg: 'magic', color: '190,140,255', anim: { roar: 'glow' } },
      resonance: { kind: 'nova', range: 999, windup: 1.1, recover: 0.9, cd: 9, weight: 1.5, power: 26, rings: 3, width: 46, gap: 72, dmg: 'magic', color: '190,140,255', anim: { roar: 'glow' } },
    },
    mechanics: [
      { type: 'crystal_armor', armor: 2400, weak: 5, clusters: 3, clusters2: 4, hp: 260, grow: 8, delay: 5, dist: 150, per: 0.4 },
    ],
    rewards: { exp: 1000, gold: 380, loot: 'amethyst_colossus', items: { amethyst_core: 1 }, lore: 'amethyst_colossus' },
    unlocks: ['b3'],
  },
  // B3 MAJOR BOSS (B3b): the CRYSTAL WARDEN on the Summit Citadel (maps/summit.js). Art = the owner's multi-phase sheet
  // ("Phase BOSS": dormant / awakened / corrupted forms; phase 4 = the corrupted form + the enraged aura); effects = the B3
  // VFX sheet ('w_*'). Four phases, each adds one rule: FROST SCRIPT (sigils in order), REFLECTIONS (crystal copies of
  // the Warden repeat its attacks), then the final SHATTERED ECLIPSE (break the pylons before the charge completes).
  boss_b3: {
    id: 'boss_b3', name: 'CRYSTAL WARDEN', title: 'Keeper of the Frozen Summit', type: 'major', impl: 'area',
    route: 'B', map: 'summit', level: 45, nativeLevel: 18, recommendedLevel: 43,
    // the hardest fight of version 1 (owner): tougher, hits harder, shorter telegraphs (party-ready: AreaBoss partyScale)
    difficulty: { hp: 1.3, power: 1.25, windup: 0.9 },
    teaches: 'Read four forms · remember the sigil order · watch the reflections · break the pylons in time',
    stats: { hp: 24000, def: 16, speed: 104, radius: 22, height: 64, mass: 8, weakness: ['physical'], superArmor: true, poise: 1300 },
    look: {
      sprite: 'crystal_warden', scale: 1.15, aura: '150,200,255',
      // each phase its own glow / size: pale ice -> bright cyan -> violet corruption -> magenta, larger (enraged)
      phaseStyle: { 1: { aura: '150,200,255' }, 2: { aura: '90,220,255', glow: 5 }, 3: { aura: '170,100,255', glow: 7, scale: 1.05 }, 4: { aura: '230,80,255', glow: 10, scale: 1.14 } },
      anims: { idle: 'p1_idle', walk: 'p1_move', windup: 'p1_wind', attack: 'p1_hit', hurt: 'p1_hurt', roar: 'p1_special' },
      phaseAnims: { 2: { idle: 'p2_idle', walk: 'p2_move', windup: 'p2_wind', attack: 'p2_hit', hurt: 'p2_hurt', roar: 'p2_special' }, 3: { idle: 'p3_idle', walk: 'p3_move', windup: 'p3_wind', attack: 'p3_hit', hurt: 'p3_hurt', roar: 'p3_special' }, 4: { idle: 'p3_idle', walk: 'p3_move', windup: 'p3_wind', attack: 'p3_hit', hurt: 'p3_hurt', roar: 'p3_special' } },
      vfx: { charge: 'w_spark', slash: 'w_slash', impact: 'w_crater', bolt: 'w_bolt', eruption: 'w_spikes', nova: 'w_eruption', phase: 'w_burst', sigil: 'w_sigil', pillar: 'w_pillar', shatter: 'w_shatter', spark: 'w_sparkle', echo: 'w_crystal', burst: 'w_blast' },
      // phase changes: the Warden's shape shifts inside an ice burst; phase 4 keeps the violet corruption aura (B2's AURA
      // sheet, 'ca_*') boiling under it
      phaseAura: {
        2: { transition: ['w_sigil', 'w_burst', 'w_shatter'], step: 0.35, stepLife: 0.6, scale: 1.3 },
        3: { transition: ['ca_form', 'ca_ring', 'ca_vortex'], step: 0.35, stepLife: 0.6, scale: 1.3 },
        4: { transition: ['ca_surge', 'ca_burst'], step: 0.4, stepLife: 0.7, loop: 'ca_vortex', loopLife: 0.9, scale: 1.4 },
      },
    },
    arena: { name: 'The Summit Citadel', center: [90, 28], radius: 16.5, trigger: 13, bossSpawn: [90, 20], entry: [90, 44], cameraLock: true },
    appear: [],
    phases: [
      { name: 'DORMANT', sub: 'The Warden stirs — blade and ice', hpBelow: 1, moves: ['blade', 'ice_spikes', 'lunge'] },
      { name: 'AWAKENED', sub: 'Frost sigils burn in order — remember them', hpBelow: 0.75, windup: 0.95, speed: 1.05, shockwave: 26, moves: ['blade', 'cross_cut', 'ice_spikes', 'lunge', 'shard_orbs'] },
      { name: 'CORRUPTED', sub: 'Its reflections answer from the crystal', hpBelow: 0.45, windup: 0.9, speed: 1.12, shockwave: 30, moves: ['blade', 'cross_cut', 'lunge', 'shard_orbs', 'shard_field', 'frost_nova'] },
      { name: 'ENRAGED', sub: 'The eclipse gathers on the summit', hpBelow: 0.2, windup: 0.85, speed: 1.2, shockwave: 34, moves: ['cross_cut', 'lunge', 'shard_orbs', 'shard_field', 'frost_nova', 'eruption_ring'] },
    ],
    moves: {
      blade: { kind: 'strike', range: 96, windup: 0.65, recover: 0.6, cd: 1.8, weight: 3, power: 42, knock: 220, shape: { shape: 'cone', r: 100, half: 0.85 } },
      // two cuts — the second one late and wider
      cross_cut: {
        kind: 'combo', range: 104, cd: 4.5, weight: 2.5, power: 36, knock: 220, recover: 0.8, opening: 1.2, shape: { shape: 'cone', r: 96, half: 0.8 },
        hits: [{ windup: 0.55 }, { windup: 1.0, track: true, power: 52, shape: { shape: 'cone', r: 118, half: 1.2 } }],
      },
      lunge: { kind: 'dash', guardBreak: true, range: 320, min: 120, windup: 0.85, recover: 0.9, cd: 5, weight: 2, power: 44, knock: 300, len: 280, width: 40, opening: 1.3 },
      ice_spikes: { kind: 'pattern', layout: 'cross', range: 400, windup: 0.9, recover: 0.6, cd: 6, weight: 2, power: 30, knock: 200, count: 4, r: 32, step: 62, delay: 0.12, dmg: 'magic', color: '150,200,255' },
      shard_orbs: { kind: 'volley', range: 380, min: 100, windup: 0.8, recover: 0.6, cd: 4, weight: 2.5, power: 30, count: 4, spread: 0.7, speed: 270, dmg: 'magic', status: [{ id: 'slow', dur: 1.2 }], color: '#bfe6ff' },
      shard_field: { kind: 'pattern', layout: 'scatter', range: 999, windup: 1.0, recover: 0.8, cd: 7, weight: 2, power: 30, count: 10, r: 38, delay: 0.1, dmg: 'magic', color: '190,140,255' },
      frost_nova: { kind: 'nova', range: 999, windup: 1.1, recover: 0.9, cd: 9, weight: 1.5, power: 28, rings: 3, width: 46, gap: 72, dmg: 'magic', status: [{ id: 'slow', dur: 1.4 }], color: '170,200,255' },
      eruption_ring: { kind: 'pattern', layout: 'ring', range: 400, windup: 1.1, recover: 0.8, cd: 8, weight: 2, power: 32, knock: 220, count: 12, r: 34, dist: 120, dmg: 'magic', color: '200,140,255' },
    },
    // SIGNATURE (boss/mechanics.js). Order = priority when several want the next turn.
    mechanics: [
      { type: 'pylons', phase: 4, at: 0.1, count: 3, hp: 380, channel: 14, dist: 150, power: 80, weak: 7, retry: 16, name: 'SHATTERED ECLIPSE' },
      { type: 'echoes', phase: 3, count: 2, life: 14, every: 22, delay: 0.3, sprite: 'crystal_warden', filter: 'brightness(1.7) saturate(1.5)', scale: 1.1 }, // pale crystal copies (no hue shift: the Warden is already blue)
      { type: 'rune_sequence', phase: 2, every: 12, count: 4, r: 56, power: 36, gap: 0.55, delay: 1.1 },
    ],
    rewards: { exp: 2500, // pacing (L4): the end of Route B ≈ LV 45
      gold: 500, loot: 'crystal_warden', items: { warden_crest: 1 }, lore: 'crystal_warden' },
    unlocks: ['city2'],
  },
};

// every boss that can actually spawn (planned entries are skipped)
export const liveBosses = (data = BOSSES) => Object.values(data).filter((b) => !b.planned);
