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
  // B0: owner's extra A1 sheets. The Leafling art is also the Guardian's Thornling adds.
  leafling: {
    sheet: 'leafling', replaces: ['leafling', 'thornling'], corrupt: '150,70,200',
    anims: {
      idle: ['idle', [4, 5, 6]], move: ['walk', [3, 4, 5, 6]], windup: ['telegraph', [4, 5, 6]], attack: ['attack', [4, 5]], hurt: ['hit', [1, 2, 3]],
      death: 'death', front: ['idle', [0, 1, 2]], bloom: 'special',
    },
    attacks: {
      seed: { windup: ['telegraph', [4, 5]], attack: ['attack', [4, 5, 6]] },
      bloom: { windup: ['special', [0]], attack: ['special', [1, 2, 3, 4, 5, 6]] },
      snap: { windup: ['attack', [1]], attack: ['attack', [3]] }, // Thornling
    },
    fps: { idle: 5, move: 8 },
  },
  treant: {
    sheet: 'treant', replaces: ['treant'], corrupt: '150,70,200',
    anims: { idle: 'idle', move: 'walk', windup: ['attack', [0, 1]], attack: ['attack', [2, 3]], hurt: 'hit', death: 'death', roots: 'special' },
    attacks: {
      swipe: { windup: ['attack', [0, 1]], attack: ['attack', [2, 3]] },
      slam: { windup: 'telegraph', attack: ['special', [6]] },          // branches up -> green ring
      orb: { windup: ['special', [0, 1, 2, 3]], attack: ['attack', [4]] },
      ring: { windup: 'telegraph', attack: ['special', [6]] },          // Elder Treant
      trample: { windup: 'telegraph', attack: 'walk' },
      barrage: { windup: ['special', [0, 1, 2, 3]], attack: ['attack', [4]] },
    },
    fps: { idle: 4, move: 7 },
  },
  armadillo: {
    sheet: 'armadillo', replaces: ['armadillo'],
    anims: {
      idle: ['walk', [0]], move: 'walk', windup: ['attack', [0, 1]], attack: ['attack', [2, 3]], hurt: 'hit', death: 'death',
      front: ['front', [0, 1, 2]], back: 'back', roll: 'special',
    },
    attacks: {
      tail: { windup: ['attack', [0]], attack: ['attack', [1, 2, 3]] },
      roll: { windup: ['special', [0]], attack: ['special', [1]] },     // curls (red outline) -> spinning ball
      spikes: { windup: ['special', [0]], attack: ['special', [2, 3]] }, // stone spikes / rock burst
    },
  },
  rock_rhino: {
    sheet: 'rock_rhino', replaces: ['rock_rhino'],
    anims: {
      idle: ['walk', [0]], move: 'walk', windup: ['gore', [0, 1]], attack: ['gore', [2, 3, 4]], hurt: 'hit', death: 'death',
      front: ['views', [0]], back: ['views', [1]], stomp: 'stomp',
    },
    attacks: {
      charge: { windup: ['stomp', [0, 1]], attack: 'walk' },          // dust aura build-up -> runs
      stomp: { windup: ['stomp', [0, 1]], attack: ['stomp', [2, 3, 4]] },
    },
    fps: { move: 9 },
  },
  magma_beast: {
    sheet: 'magma_beast', replaces: ['magma_beast'],
    anims: {
      idle: 'idle', move: 'walk', run: 'run', windup: ['bite', [0, 1, 2]], attack: ['bite', [3, 4, 5, 6]], hurt: 'hit',
      death: 'death', eruption: 'eruption', fireball: 'fireball', stagger: 'stagger', enrage: 'enrage',
      fire_wind: ['fireball', [0, 1, 2, 3, 4]], fire_shot: ['fireball', [5, 6, 7]],
    },
    fps: { eruption: 7, enrage: 8, run: 12, stagger: 7 },
  },
  quill_lizard: {
    sheet: 'quill_lizard', replaces: ['quill_lizard'],
    anims: {
      idle: ['walk', [0]], move: 'walk', windup: ['attack', [0]], attack: ['attack', [1, 2]], hurt: 'hit', death: 'death',
      front: ['front', [0, 1, 2, 3]], back: ['back', [0, 1, 2, 3]], spin: 'spin',
    },
    attacks: {
      whip: { windup: ['attack', [0]], attack: ['attack', [1, 2]] },
      quills: { windup: ['spikes', [0, 1]], attack: ['spikes', [2, 3, 4]] },   // quills rise -> spray
      spin: { windup: ['spikes', [1]], attack: ['spin', [2, 3, 4]] },
    },
    fps: { move: 10 },
  },
  burrower: {
    sheet: 'burrower', replaces: ['burrower'],
    anims: { idle: 'idle', move: 'walk', windup: ['attack', [0]], attack: ['attack', [1]], hurt: 'hit', death: 'death', burrow: 'special' },
    attacks: {
      snap: { windup: ['attack', [0]], attack: ['attack', [1]] },
      burrow: { windup: 'telegraph', attack: 'special' },                   // digs in -> bursts out, pincers first
    },
  },
  // ---------------- B1 FROSTWIND PLAINS: one pose per action row; columns = directions (0 down · 1 up · 2 / 3 sides —
  // which side faces RIGHT differs per sheet: wolf 2, bear 3, hare 2). Walks = walk pose + idle pose (2 steps).
  snow_hare: {
    sheet: 'snow_hare', replaces: ['snow_hare'],
    anims: {
      idle: ['idle', [2]], move: [['walk', [2]], ['idle', [2]]], windup: ['telegraph', [2]], attack: ['attack', [2]], hurt: ['hit', [2]], death: ['death', [2]],
      front: [['walk', [0]], ['idle', [0]]], back: [['walk', [1]], ['idle', [1]]],
    },
    attacks: { spin: { windup: ['telegraph', [2]], attack: ['special', [2]] } },
    fps: { move: 7, idle: 3 },
  },
  rime_wolf: {
    sheet: 'rime_wolf', replaces: ['rime_wolf'], corrupt: '150,70,200',
    anims: {
      idle: ['idle', [2]], move: [['walk', [2]], ['idle', [2]]], windup: ['telegraph', [2]], attack: ['attack', [2]], hurt: ['hit', [2]], death: ['death', [2]],
      front: [['walk', [0]], ['idle', [0]]], back: [['walk', [1]], ['idle', [1]]],
    },
    attacks: { lunge: { windup: ['telegraph', [2]], attack: ['special', [2]] } },
    fps: { move: 8, idle: 3 },
  },
  frost_harrier: {
    sheet: 'frost_harrier', replaces: ['frost_harrier'],
    // columns: 0 idle · 1-3 walk · 4 attack · 5 hit · 6 telegraph · 7 special · 8 death
    anims: {
      idle: ['right', [0]], move: ['right', [1, 2, 3]], windup: ['right', [6]], attack: ['right', [4]], hurt: ['right', [5]], death: ['right', [8]],
      front: ['down', [0, 1, 2, 3]],
    },
    attacks: { gale: { windup: ['right', [6]], attack: ['right', [7]] } },
    fps: { move: 8 },
  },
  frost_bear: {
    sheet: 'frost_bear', replaces: ['frost_bear'],
    anims: {
      idle: ['idle', [3]], move: [['walk', [3]], ['idle', [3]]], windup: ['telegraph', [3]], attack: ['attack', [3]], hurt: ['hit', [3]], death: ['death', [3]],
      front: [['walk', [0]], ['idle', [0]]], back: [['walk', [1]], ['idle', [1]]],
    },
    attacks: { eruption: { windup: ['telegraph', [3]], attack: ['special', [3]] } },
    fps: { move: 5, idle: 3 },
  },
  // ---------------- B2 CRYSTAL CAVERNS
  crystal_slime: {
    sheet: 'crystal_slime', replaces: ['crystal_slime'],
    anims: {
      idle: ['front', [0, 1, 2, 3, 4, 5, 6]], move: 'side', windup: ['special', [0, 1, 2]], attack: ['attack', [2, 3, 4]], hurt: ['hit', [4, 5]], death: 'death',
      front: ['front', [0, 1, 2, 3]], back: 'back',
    },
    attacks: {
      rush: { windup: ['attack', [0, 1]], attack: ['attack', [3, 4]] },
      pulse: { windup: ['special', [0, 1, 2, 3]], attack: ['special', [4, 5]] },
    },
    fps: { idle: 5, move: 7 },
  },
  // one pose per action row; columns = directions (0 down · 1 up · 2 left · 3 right)
  cave_spider: {
    sheet: 'cave_spider', replaces: ['cave_spider'],
    anims: {
      idle: ['idle', [3]], move: [['idle', [3]], ['telegraph', [3]]], windup: ['telegraph', [3]], attack: ['attack', [3]], hurt: ['hit', [3]], death: ['death', [3]],
      front: ['walk', [0, 1]], back: [['idle', [1]], ['walk', [2]]],
    },
    attacks: { eruption: { windup: ['telegraph', [3]], attack: ['special', [3]] } },
    fps: { move: 8, idle: 3 },
  },
  crystal_bat: {
    sheet: 'crystal_bat', replaces: ['crystal_bat'],
    anims: {
      idle: ['walk', [0, 1, 2, 3]], move: ['walk', [0, 1, 2, 3]], windup: ['telegraph', [0, 1]], attack: ['attack', [0, 2]], hurt: ['hit', [0, 1]], death: 'death',
    },
    attacks: {
      swoop: { windup: ['telegraph', [0, 1]], attack: ['attack', [0, 2, 3]] },
      storm: { windup: ['special', [0, 1]], attack: ['special', [3, 4]] },
    },
    fps: { idle: 8, move: 10 },
  },
  moss_tortoise: {
    sheet: 'moss_tortoise', replaces: ['moss_tortoise'],
    anims: { idle: 'idle', move: 'walk', windup: ['attack', [0, 1]], attack: ['attack', [2, 3, 4]], hurt: 'hit', death: 'death' },
    attacks: {
      quake: { windup: 'special', attack: ['special', [5, 6]] },
      pebbles: { windup: 'telegraph', attack: ['attack', [4, 5]] },
    },
    fps: { idle: 4, move: 6 },
  },
  // B2 BOSS: the Amethyst Colossus
  amethyst_colossus: {
    sheet: 'amethyst_colossus', replaces: ['amethyst_colossus'],
    anims: {
      idle: 'idle', move: 'walk', charge: 'charge', windup: ['strike', [0, 1]], attack: ['strike', [2, 3, 4]], hurt: ['hit', [0, 1, 2]], death: 'death',
      strike_wind: ['strike', [0, 1]], strike_hit: ['strike', [2, 3, 4, 5]], slam_wind: ['slam', [0, 1, 2, 3]], slam_hit: ['slam', [4, 5, 6, 7]],
      glow: ['glow', [0, 1, 2, 3, 4, 5, 6]], stagger: ['hit', [3, 4, 5, 6]],
    },
    fps: { charge: 12, glow: 8 },
  },
  // B1 BOSS: Hoarfang (a giant frost wolf)
  hoarfang: {
    sheet: 'hoarfang', replaces: ['hoarfang'],
    anims: {
      idle: 'idle', move: 'walk', run: 'run', windup: ['bite', [0, 1]], attack: ['bite', [2, 3, 4]], hurt: 'hit', death: 'death',
      bite_wind: ['bite', [0, 1]], bite_hit: ['bite', [2, 3, 4]], slash_wind: ['slash', [0, 1]], slash_hit: ['slash', [2, 3]],
      special: 'special', howl: 'howl', stagger: 'hit',
    },
    fps: { run: 12, howl: 8, special: 8 },
  },
  // ---------------- A3 RUNE CITADEL
  // rows = directions; columns: 0 idle · 1-2 walk · 3 attack · 4 hit · 5 telegraph · 6 special · 7-9 death
  void_scarab: {
    sheet: 'void_scarab', replaces: ['void_scarab'],
    anims: {
      idle: ['right', [0]], move: ['right', [1, 2]], windup: ['right', [5]], attack: ['right', [3]], hurt: ['right', [4]],
      death: ['right', [7, 8, 9]], front: ['down', [0, 1, 2]],
    },
    attacks: {
      claw: { windup: ['right', [5]], attack: ['right', [3]] },
      ring: { windup: ['right', [5]], attack: ['right', [6]] },
    },
    fps: { move: 10 },
  },
  rune_wisp: {
    sheet: 'rune_wisp', replaces: ['rune_wisp'],
    anims: {
      idle: ['idle', [0]], move: ['idle_b', [0]], windup: 'telegraph', attack: ['dash', [1]], hurt: 'hit', death: 'death', front: ['idle', [0]],
    },
    attacks: {
      breath: { windup: ['telegraph', [0, 1]], attack: ['breath', [0]] },
      dash: { windup: 'telegraph', attack: ['dash', [1, 2]] },
    },
    fps: { idle: 4 },
  },
  crystal_golem: {
    sheet: 'crystal_golem', replaces: ['crystal_golem'],
    anims: {
      idle: ['front', [0, 1, 2, 3, 4]], move: ['side_b', [0, 1, 2, 3]], windup: ['side_b', [3]], attack: ['side', [4]],
      hurt: ['special', [3]], death: 'death', front: ['front', [0, 1, 2, 3, 4]], back: ['back', [0, 1, 2]], slam: 'special',
    },
    attacks: {
      punch: { windup: ['side_b', [3]], attack: ['side', [4]] },
      slam: { windup: ['special', [4]], attack: ['special', [0, 1]] },   // arms up -> crystal ring
      ram: { windup: ['special', [4]], attack: ['special', [2]] },        // shoulder roll
    },
    fps: { move: 6, idle: 4 },
  },
  bronze_hoplite: {
    sheet: 'bronze_hoplite', replaces: ['bronze_hoplite'],
    anims: {
      idle: 'front', move: 'side', windup: ['attack', [0]], attack: ['attack', [1]], hurt: 'hit', death: 'death',
      front: 'front', back: 'back', ward: ['attack', [5]],
    },
    attacks: {
      bash: { windup: ['attack', [0]], attack: ['attack', [1]] },          // shield bash
      sweep: { windup: ['attack', [3]], attack: ['attack', [2]] },         // spear sweep (arc)
      phalanx: { windup: ['attack', [5]], attack: ['attack', [6]] },       // rune-lit spear thrust in formation
    },
  },
  rune_knight: {
    sheet: 'rune_knight', replaces: ['rune_knight'],
    anims: {
      idle: 'idle', move: 'walk', windup: ['slash', [0, 1, 2, 3]], attack: ['slash', [4, 5, 6]], hurt: ['guard', [3, 4, 5]],
      death: 'death', stance: 'stance', stagger: ['guard', [3, 4, 5, 6]],
      slash_wind: ['slash', [0, 1, 2, 3]], slash_hit: ['slash', [4, 5, 6]], combo_hit: ['combo', [0, 1, 2, 3]],
      lunge_wind: ['lunge', [0, 1]], lunge_go: ['lunge', [2, 3, 4, 5, 6]], rune_cast: ['nova', [1, 2, 3, 4, 5]], plunge: ['combo', [5, 6]],
    },
    fps: { stance: 6, rune_cast: 7, combo_hit: 11 },
  },
};
