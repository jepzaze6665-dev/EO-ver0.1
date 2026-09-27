// Monster definitions. Attacks are data: a telegraph shape, timings and a strike.
//   kind 'strike' : shape resolved once when the telegraph completes
//   kind 'dash'   : line telegraph, then the monster dashes along it hitting on contact
//   kind 'volley' : fires projectiles when the telegraph completes
// Knowledge fields feed the Monster Knowledge codex (revealed by fighting / lore).
export const MONSTERS = {
  wolf: {
    name: 'Forest Wolf', level: 2, hp: 70, def: 2, speed: 128, radius: 10, height: 30, mass: 0.8,
    detect: 150, leash: 520, exp: 18, loot: 'wolf', weakness: ['shadow'], sprite: 'wolf', staggerMax: 18, turn: 12,
    pattern: 'Charge / Bite', desc: 'Hunts in packs. Watch for the crouch before the lunge.',
    attacks: [
      { id: 'bite', range: 38, min: 0, windup: 0.38, recover: 0.42, cd: 1.1, power: 14, shape: { shape: 'cone', r: 42, half: 0.75 }, kind: 'strike', knock: 120 },
      { id: 'lunge', range: 125, min: 55, windup: 0.52, recover: 0.55, cd: 3.2, power: 18, shape: { shape: 'line', len: 125, width: 13 }, kind: 'dash', dashTime: 0.2 },
    ],
  },
  goblin: {
    name: 'Forest Goblin', level: 4, hp: 130, def: 5, speed: 82, radius: 11, height: 40, mass: 1.1,
    detect: 140, leash: 480, exp: 30, loot: 'goblin', weakness: ['physical'], sprite: 'goblin', staggerMax: 30, turn: 8,
    pattern: 'Swipe / Overhead Slam', desc: 'Raises its club high before a heavy slam — it is exposed afterwards.',
    attacks: [
      { id: 'swipe', range: 40, min: 0, windup: 0.45, recover: 0.45, cd: 1.4, power: 16, shape: { shape: 'cone', r: 46, half: 0.95 }, kind: 'strike' },
      { id: 'slam', range: 75, min: 0, windup: 0.95, recover: 1.0, cd: 3.4, power: 32, shape: { shape: 'circle', r: 50, offset: 34 }, kind: 'strike', knock: 260, heavy: true, opening: true },
    ],
  },
  crystal_beast: {
    name: 'Crystal Beast', level: 6, hp: 240, def: 10, armor: 120, speed: 56, radius: 18, height: 44, mass: 2.5,
    detect: 130, leash: 420, exp: 50, loot: 'crystal_beast', weakness: ['shadow'], sprite: 'crystal_beast', staggerMax: 60, turn: 1.6,
    superArmor: true, weakPoint: true,
    pattern: 'Spike Ring / Crystal Ram', desc: 'Crystal armour absorbs most damage. Its glowing core is on its back — it turns slowly.',
    attacks: [
      { id: 'ring', range: 72, min: 0, windup: 1.0, recover: 1.0, cd: 3.5, power: 26, shape: { shape: 'ring', r0: 22, r: 84 }, kind: 'strike', knock: 220 },
      { id: 'ram', range: 130, min: 40, windup: 0.85, recover: 1.4, cd: 4, power: 30, shape: { shape: 'line', len: 130, width: 20 }, kind: 'dash', dashTime: 0.3, exposes: 1.4 },
    ],
  },
  crystal_alpha: {
    name: 'Amethyst Behemoth', level: 8, hp: 720, def: 12, armor: 260, speed: 64, radius: 24, height: 56, mass: 5, scale: 1.45,
    detect: 190, leash: 400, exp: 240, loot: 'crystal_alpha', weakness: ['physical'], sprite: 'crystal_alpha', staggerMax: 140, turn: 1.8,
    superArmor: true, weakPoint: true, miniBoss: true,
    pattern: 'Spike Ring / Ram / Shard Barrage', desc: 'Guardian of the hidden cave. Break its amethyst armour, then punish the core.',
    attacks: [
      { id: 'ring', range: 90, min: 0, windup: 1.0, recover: 0.9, cd: 3.4, power: 34, shape: { shape: 'ring', r0: 28, r: 110 }, kind: 'strike', knock: 260 },
      { id: 'ram', range: 170, min: 50, windup: 0.8, recover: 1.2, cd: 4.5, power: 38, shape: { shape: 'line', len: 170, width: 26 }, kind: 'dash', dashTime: 0.32 },
      { id: 'barrage', range: 260, min: 90, windup: 0.9, recover: 0.8, cd: 5, power: 22, shape: { shape: 'cone', r: 200, half: 0.55 }, kind: 'volley', count: 5, spread: 0.9, speed: 230 },
    ],
  },
  thornling: {
    name: 'Thornling', level: 9, hp: 55, def: 2, speed: 118, radius: 9, height: 24, mass: 0.6,
    detect: 600, leash: 2000, exp: 8, loot: 'thornling', weakness: ['shadow'], sprite: 'thornling', staggerMax: 10, turn: 12,
    pattern: 'Snap', desc: 'Roots given hunger by the Guardian.',
    attacks: [{ id: 'snap', range: 32, min: 0, windup: 0.4, recover: 0.5, cd: 1.3, power: 12, shape: { shape: 'cone', r: 36, half: 0.8 }, kind: 'strike' }],
  },
  wraith: {
    name: 'Rune Wraith', level: 12, hp: 180, def: 6, speed: 90, radius: 11, height: 44, mass: 0.9, float: true,
    detect: 200, leash: 520, exp: 70, loot: 'wraith', weakness: ['physical'], sprite: 'wraith', staggerMax: 25, turn: 10,
    pattern: 'Rune Orbs / Blink', desc: 'A remnant of the valley wardens. Keeps its distance and blinks away when pressed.',
    keepAway: 110,
    attacks: [
      { id: 'orbs', range: 230, min: 0, windup: 0.75, recover: 0.7, cd: 2.4, power: 18, shape: { shape: 'cone', r: 180, half: 0.45 }, kind: 'volley', count: 3, spread: 0.55, speed: 170, projKind: 'orb', homing: 0.9 },
      { id: 'nova', range: 60, min: 0, windup: 0.7, recover: 0.9, cd: 4, power: 20, shape: { shape: 'circle', r: 64 }, kind: 'strike', blinkAfter: true },
    ],
  },
  guardian: {
    name: 'Guardian of the Forest', level: 10, hp: 12000, def: 18, radius: 30, height: 90, boss: true,
    exp: 500, loot: 'guardian', weakness: ['shadow'],
    pattern: 'Claw / Charge / Leap / Smash · Roots / Crystals / Summon · Enrage', desc: 'An ancient warden bound to the forest heart. Its crystal core is exposed after its heaviest attacks.',
  },
};

// Corrupted variants (before the Guardian falls): tougher, more aggressive, purple eyes.
export const CORRUPT_MOD = { hp: 1.2, detect: 1.35, power: 1.1, speed: 1.08 };

// Elite variants (spawn data `elite: true`): a simple mini-threat for later areas — bigger, tougher,
// more EXP and an extra roll on the 'elite' loot table. Multiplies with CORRUPT_MOD.
export const ELITE_MOD = { hp: 2.5, detect: 1.2, power: 1.3, speed: 1.05, exp: 3, scale: 1.2, loot: 'elite' };

// AI states (spec names). RETURN = walking home after a leash / lost target / stuck on a wall.
export const MONSTER_STATE = {
  IDLE: 'idle', PATROL: 'patrol', AGGRO: 'aggro', CHASE: 'chase', ATTACK: 'attack', HIT: 'hit', RETURN: 'return', DEAD: 'dead',
};
