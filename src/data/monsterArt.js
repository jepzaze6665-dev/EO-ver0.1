// MONSTER ART — which frames of the owner's monster sheets (tools/build-monsters.js -> assets/monsters/) play for
// each game animation. monsters/sheetSprites.js turns an entry into a sprite set with the same fields the canvas
// placeholder sets have (idle / move / windup / attack / hurt), so Monster / AreaBoss / Guardian draw it unchanged.
//
//  sheet      : atlas id in assets/monsters/monsters.json
//  replaces   : sprite keys (monsterTypes `sprite`, bosses `look.sprite`) this art is used for.
//               'wolfC' style keys (sprite + 'C') = the CORRUPTED look; with `corrupt` set it is generated from this art
//  corrupt    : tint for the corrupted variant ('r,g,b'), made at load time (no extra files)
//  anims      : game anim -> 'row' (every frame of that sheet row) | ['row', [frame indices]]
//     idle / move (loop) · windup (plays across the attack STARTUP) · attack (ACTIVE + RECOVERY) · hurt · death
//     front / back (optional): idle / move rows used when the monster faces the camera / away from it
//     any other name = extra animation for boss poses / specials (sheetSprites keeps them all in `set.anims`)
//  attacks    : per attack id overrides { windup, attack } (e.g. a dash plays the run row while charging)
//  fps        : frames per second per anim (default 8; idle 5; death spreads over the corpse lifetime)
//  poses      : (bosses with their own code) pose name -> anim name. `loop: [...]` = poses that repeat.
export const MONSTER_ART = {
  // ---------------- A1 WHISPERING FOREST
  rabbit: {
    sheet: 'rabbit', replaces: ['rabbit'], corrupt: '150,60,220',
    anims: {
      idle: ['walk', [0]], move: 'walk', windup: ['lunge', [0]], attack: ['lunge', [1, 2, 3]], hurt: ['hit', [0, 1, 2]],
      death: 'death', front: 'front', back: 'back', enrage: 'enrage',
    },
    fps: { move: 10, idle: 4 },
  },
  frost_wolf: {
    sheet: 'frost_wolf', replaces: ['wolf'], corrupt: '150,70,230',
    anims: {
      idle: ['bite', [0, 1]], move: ['run', [0, 1, 2]], windup: ['bite', [0, 1]], attack: ['bite', [2, 3]], hurt: ['hit', [0, 1, 2]],
      death: 'death', front: 'front', back: 'back', howl: 'howl',
    },
    attacks: { lunge: { windup: ['bite', [0, 1]], attack: ['run', [1, 2]] } },
    fps: { move: 12, idle: 3 },
  },
  forest_guardian: {
    sheet: 'forest_guardian', replaces: ['forest_guardian'],
    anims: {
      idle: 'idle', move: 'walk', windup: ['claw', [0, 1]], attack: ['claw', [2, 3, 4, 5]], hurt: ['hit', [0, 1, 2]],
      death: 'death', death_corrupt: 'death_corrupt', corrupt: 'corrupt',
      claw_wind: ['claw', [0, 1]], claw: ['claw', [2, 3, 4, 5]], charge_wind: ['charge', [0, 1]], charge: ['charge', [2, 3, 4]],
      raise: ['roots', [0, 1, 2]], slam: ['roots', [3, 4, 5, 6]], crouch: ['charge', [0]], kneel: ['death', [0, 1]],
      sleep: ['death', [1]], beam: 'beam',
    },
    fps: { idle: 6, move: 7 },
    // Guardian poses (boss/guardian.js) -> anims. Phase 3 idles in the corrupted form, and dies in it.
    poses: {
      idle: 'idle', walk: 'move', sleep: 'sleep', kneel: 'kneel', roar: 'raise', clawWind: 'claw_wind', claw: 'claw',
      chargeWind: 'charge_wind', charge: 'charge', rear: 'raise', slam: 'slam', crouch: 'crouch', air: 'raise',
      loop: ['idle', 'walk', 'charge'],
      corrupted: { idle: 'corrupt', walk: 'corrupt' },
    },
  },
  // ---------------- A2 ANCIENT VALLEY (sheets built; monsters join the game in W3b)
  armadillo: {
    sheet: 'armadillo', replaces: ['armadillo'],
    anims: {
      idle: ['walk', [0]], move: 'walk', windup: ['attack', [0, 1]], attack: ['attack', [2, 3]], hurt: 'hit', death: 'death',
      front: ['front', [0, 1, 2]], back: 'back', roll: 'special',
    },
  },
  rock_rhino: {
    sheet: 'rock_rhino', replaces: ['rock_rhino'],
    anims: {
      idle: ['walk', [0]], move: 'walk', windup: ['gore', [0, 1]], attack: ['gore', [2, 3, 4]], hurt: 'hit', death: 'death',
      front: ['views', [0]], back: ['views', [1]], stomp: 'stomp',
    },
  },
  magma_beast: {
    sheet: 'magma_beast', replaces: ['magma_beast'],
    anims: {
      idle: 'idle', move: 'walk', run: 'run', windup: ['bite', [0, 1, 2]], attack: ['bite', [3, 4, 5, 6]], hurt: 'hit',
      death: 'death', eruption: 'eruption', fireball: 'fireball', stagger: 'stagger', enrage: 'enrage',
    },
  },
  // ---------------- A3 RUNE CITADEL
  crystal_golem: {
    sheet: 'crystal_golem', replaces: ['crystal_golem'],
    anims: {
      idle: ['front', [0, 1, 2, 3, 4]], move: ['side_b', [0, 1, 2, 3]], windup: ['side', [3]], attack: ['side', [4]],
      hurt: ['special', [3]], death: 'death', back: ['back', [0, 1, 2]], slam: 'special',
    },
  },
  bronze_hoplite: {
    sheet: 'bronze_hoplite', replaces: ['bronze_hoplite'],
    anims: {
      idle: 'front', move: 'side', windup: ['attack', [0, 1]], attack: ['attack', [2, 3]], hurt: 'hit', death: 'death',
      back: 'back', ward: ['attack', [5, 6]],
    },
  },
  rune_knight: {
    sheet: 'rune_knight', replaces: ['rune_knight'],
    anims: {
      idle: 'idle', move: 'walk', windup: ['slash', [0, 1, 2, 3]], attack: ['slash', [4, 5, 6]], hurt: ['guard', [0, 1]],
      death: 'death', lunge: 'lunge', combo: 'combo', nova: 'nova', guard: 'guard', stance: 'stance',
    },
  },
};
