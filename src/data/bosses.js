// BOSS DATA — every boss of the world is described here. boss/bossSystem.js reads it and never names a boss.
// Add a boss = add an entry (+ its arena in a map file's region). No game-loop code changes.
//
//  id, name, title          : text (boss bar, banners)
//  type                     : 'area' (guards a field map, opens the next one) | 'major' (end of a route, unlocks a city)
//                             'mini' (optional mini-boss: rewards once, gates nothing)
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
export const BOSS_TYPE = { AREA: 'area', MAJOR: 'major', MINI: 'mini' };

export const BOSSES = {
  // ---------------- ROUTE A
  // ---------------- A1 optional mini-bosses (W2: the old A1 / A2 area bosses; they no longer lock any road)
  mini_hollow_fang: {
    id: 'mini_hollow_fang', name: 'HOLLOW FANG', title: 'Alpha of the Whispering Forest', type: 'mini', impl: 'area',
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
    rewards: { exp: 150, loot: 'hollow_fang', items: { hollow_fang_pelt: 1 }, lore: 'hollow_fang' },
    unlocks: [],
  },

  mini_grukk: {
    id: 'mini_grukk', name: 'GRUKK THE THORNBOUND', title: 'Warchief of the Goblin Glade', type: 'mini', impl: 'area',
    route: 'A', map: 'a1', level: 8, recommendedLevel: 7,
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
    rewards: { exp: 300, loot: 'grukk', items: { warchief_totem: 1 }, lore: 'grukk' },
    unlocks: [],
  },

  // ---------------- A1 BOSS: the Guardian of the Forest (fight code: boss/guardian.js; arena: maps/ruins.js; art: the
  // owner's A1 boss sheet). W2: it guards the north road out of A1 — its fall opens A2 (Ancient Valley).
  boss_a1: {
    id: 'boss_a1', name: 'GUARDIAN OF THE FOREST', title: 'Warden of the Whispering Heart', type: 'area', impl: 'guardian',
    route: 'A', map: 'arena', monster: 'guardian', level: 10, recommendedLevel: 10,
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
    route: 'A', map: 'rift', level: 14, recommendedLevel: 13,
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
  // A3 MAJOR BOSS (W4b): the Rune Knight in the Sanctum behind the Golden Gate (maps/sanctum.js). Art = the owner's A3
  // boss sheet; effects = the A3 VFX sheet ('r_*'). A duel: SWORD / SHIELD stances, the RUNE SCRIPT (phase 2),
  // ECHOES of Asteria's soldiers (phase 3) and the FINAL JUDGEMENT (only the blue domes are safe).
  boss_a3: {
    id: 'boss_a3', name: 'RUNE KNIGHT', title: 'Last Warden of Asteria', type: 'major', impl: 'area',
    route: 'A', map: 'sanctum', level: 18, recommendedLevel: 17,
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
    rewards: { exp: 1500, gold: 500, loot: 'rune_knight', items: { asterian_crest: 1 }, lore: 'rune_knight' },
    unlocks: ['city2'],
  },

  // ---------------- ROUTE B (architecture only — Phase 13/14 builds the maps; nothing here is spawned yet)
  boss_b1: { id: 'boss_b1', name: 'B1 AREA BOSS', title: 'Route B · to be designed', type: 'area', impl: 'area', route: 'B', map: 'b1', planned: true, unlocks: ['b2'] },
  boss_b2: { id: 'boss_b2', name: 'B2 AREA BOSS', title: 'Route B · to be designed', type: 'area', impl: 'area', route: 'B', map: 'b2', planned: true, unlocks: ['b3'] },
  boss_b3: { id: 'boss_b3', name: 'B3 MAJOR BOSS', title: 'Route B · to be designed', type: 'major', impl: 'area', route: 'B', map: 'b3', planned: true, unlocks: ['city2'] },
};

// every boss that can actually spawn (planned entries are skipped)
export const liveBosses = (data = BOSSES) => Object.values(data).filter((b) => !b.planned);
