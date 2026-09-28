// Monster definitions. Attacks are data: a telegraph shape, timings and a strike.
//   kind 'strike' : shape resolved once when the telegraph completes
//   kind 'dash'   : line telegraph, then the monster dashes along it hitting on contact
//   kind 'volley' : fires projectiles when the telegraph completes
// Knowledge fields feed the Monster Knowledge codex (revealed by fighting / lore).
// Combat 2.0 (data/enemyCombat.js): windup = STARTUP, strike/dash = ACTIVE, recover = RECOVERY (longer after a miss:
// missRecover); role · flank · punishIdle + attack `punish` = roles §51.
export const MONSTERS = {
  // A1 forest entrance critter (owner's sheet art, data/monsterArt.js). ENRAGE (generic, any monster may use it):
  // below `below` HP the monster flares up once — speed / power ×, the sheet's enrage animation plays for `time` s.
  rabbit: {
    name: 'Whisper Hare', level: 1, hp: 38, def: 0, speed: 118, radius: 8, height: 20, mass: 0.5,
    detect: 110, leash: 380, exp: 7, loot: 'rabbit', weakness: ['physical'], sprite: 'rabbit', poise: 8, turn: 12,
    role: 'skirmisher', pattern: 'Hop Kick / Pounce', desc: 'Harmless until cornered. A wounded hare flares red and pounces faster.',
    enrage: { below: 0.5, speed: 1.3, power: 1.25, time: 0.7 },
    attacks: [
      { id: 'kick', range: 30, min: 0, windup: 0.42, recover: 0.45, cd: 1.3, power: 7, shape: { shape: 'cone', r: 34, half: 0.8 }, kind: 'strike', knock: 90 },
      { id: 'pounce', range: 100, min: 45, windup: 0.6, recover: 0.6, cd: 3.5, power: 10, shape: { shape: 'line', len: 95, width: 12 }, kind: 'dash', dashTime: 0.2 },
    ],
  },
  // ---------------- A2 ANCIENT VALLEY (owner's sheets desgin/monster/A/A2, art data/monsterArt.js). Lv 10-13 for a
  // player arriving at LV 10 after the Guardian. Each attack has a clear counter (read -> dodge -> punish):
  armadillo: {
    name: 'Stoneback Armadillo', level: 10, hp: 700, def: 12, speed: 84, radius: 12, height: 26, mass: 1.6,
    detect: 150, leash: 460, exp: 80, loot: 'armadillo', weakness: ['shadow'], sprite: 'armadillo', poise: 50, turn: 6,
    role: 'skirmisher',
    pattern: 'Tail Sweep / Boulder Roll / Spike Burst', desc: 'Curls into a stone ball and rolls straight at you — step aside, then strike while it reels.',
    attacks: [
      // tail sweep: a quick circle around it — back off or dodge out
      { id: 'tail', range: 40, min: 0, windup: 0.5, recover: 0.5, cd: 1.6, power: 24, shape: { shape: 'circle', r: 44 }, kind: 'strike', knock: 140 },
      // boulder roll: line telegraph, a fast roll along it, then DIZZY (vulnerable) — dodge sideways and punish
      // bounces: it ricochets off walls up to twice (and can hit again) — near a wall, expect the rebound
      { id: 'roll', range: 190, min: 70, windup: 0.75, recover: 0.8, cd: 4.2, power: 34, shape: { shape: 'line', len: 190, width: 22 }, kind: 'dash', dashTime: 0.34, exposes: 1.4, exposeText: 'DIZZY!', knock: 240, bounces: 2 },
      // spike burst (heavy): stone spikes erupt in a ring — leave the ring before it resolves
      { id: 'spikes', range: 70, min: 0, windup: 0.95, recover: 0.9, cd: 6, power: 32, shape: { shape: 'ring', r0: 18, r: 72 }, kind: 'strike', knock: 200, heavy: true },
    ],
  },
  rock_rhino: {
    name: 'Crag Rhino', level: 12, hp: 1300, def: 10, speed: 70, radius: 17, height: 40, mass: 3.2, superArmor: true,
    detect: 170, leash: 480, exp: 130, loot: 'rock_rhino', weakness: ['physical'], sprite: 'rock_rhino', poise: 90, turn: 2.2,
    role: 'bruiser',
    pattern: 'Horn Gore / Rampage Charge / Tremor Stomp', desc: 'Turns slowly and charges in a straight line. A missed charge leaves it stumbling — flank it.',
    attacks: [
      { id: 'gore', range: 50, min: 0, windup: 0.6, recover: 0.6, cd: 1.8, power: 32, shape: { shape: 'cone', r: 58, half: 0.7 }, kind: 'strike', knock: 180 },
      // rampage charge: long, guard-breaking; misses leave it recovering much longer (flank + punish)
      // steer: the charge can bend toward you once (0.8 rad) — dodge late, not early
      { id: 'charge', range: 240, min: 90, windup: 1.0, recover: 1.0, cd: 5.5, power: 44, shape: { shape: 'line', len: 240, width: 30 }, kind: 'dash', dashTime: 0.42, guardBreak: true, knock: 280, missRecover: 1.9, exposes: 1.2, exposeText: 'STUMBLING!', steer: 2.2, steerMax: 0.8 },
      // tremor stomp (heavy): the ground shakes around it and slows — step out of the circle
      { id: 'stomp', range: 64, min: 0, windup: 0.9, recover: 0.8, cd: 5, power: 30, shape: { shape: 'circle', r: 78 }, kind: 'strike', knock: 160, heavy: true, status: [{ id: 'slow', dur: 1.6 }] },
    ],
  },
  // B0: A2's extra sheets
  quill_lizard: {
    name: 'Quillback Lizard', level: 11, hp: 620, def: 9, speed: 108, radius: 11, height: 26, mass: 1.2,
    detect: 170, leash: 480, exp: 95, loot: 'quill_lizard', weakness: ['physical'], sprite: 'quill_lizard', poise: 45, turn: 9,
    role: 'skirmisher', flank: true,
    pattern: 'Tail Whip / Quill Spray / Spin Rush', desc: 'Circles to your side. Its quills rise before a spray — and after a Spin Rush it is dizzy for a moment.',
    attacks: [
      { id: 'whip', range: 42, min: 0, windup: 0.45, recover: 0.5, cd: 1.4, power: 26, shape: { shape: 'cone', r: 50, half: 1.0 }, kind: 'strike', knock: 150 },
      { id: 'quills', range: 220, min: 60, windup: 0.8, recover: 0.7, cd: 4, power: 20, shape: { shape: 'cone', r: 200, half: 0.5 }, kind: 'volley', count: 5, spread: 0.8, speed: 250, projColor: '#e8c070' },
      { id: 'spin', range: 170, min: 60, windup: 0.7, recover: 0.8, cd: 5, power: 32, shape: { shape: 'line', len: 170, width: 24 }, kind: 'dash', dashTime: 0.32, knock: 220, exposes: 1.2, exposeText: 'DIZZY!' },
    ],
  },
  burrower: {
    name: 'Thornshell Burrower', level: 12, hp: 1150, def: 14, speed: 64, radius: 15, height: 30, mass: 2.6, superArmor: true,
    detect: 150, leash: 440, exp: 125, loot: 'burrower', weakness: ['shadow'], sprite: 'burrower', poise: 80, turn: 3,
    role: 'bruiser',
    pattern: 'Pincer Snap / Burrow Ambush', desc: 'Digs under the ground and bursts up where it aims — watch the circle, not the shell. Stuck in the dirt afterwards.',
    attacks: [
      { id: 'snap', range: 44, min: 0, windup: 0.55, recover: 0.6, cd: 1.7, power: 30, shape: { shape: 'cone', r: 52, half: 0.7 }, kind: 'strike', knock: 170 },
      // burrow: the telegraph is ahead of it (where it will surface); heavy, a miss leaves it stuck
      { id: 'burrow', range: 150, min: 60, windup: 1.1, recover: 1.1, cd: 5.5, power: 40, shape: { shape: 'circle', r: 56, offset: 110 }, kind: 'strike', knock: 260, heavy: true, opening: true, missRecover: 1.8, guardBreak: true },
    ],
  },
  // ---------------- A3 RUNE CITADEL (owner's sheets desgin/monster/A/A3). Lv 14-16.
  crystal_golem: {
    name: 'Crystal Golem', level: 14, hp: 2400, def: 14, armor: 900, speed: 50, radius: 16, height: 42, mass: 3.5, superArmor: true,
    detect: 150, leash: 420, exp: 170, loot: 'crystal_golem', weakness: ['physical'], sprite: 'crystal_golem', poise: 120, turn: 2,
    role: 'tank', weakPoint: 'front', weakPointText: 'ARMORED — strike the chest crystal (front)',
    pattern: 'Stone Punch / Crystal Slam / Shoulder Ram', desc: 'Stone armour, a crystal heart on its chest. Its slam raises crystal spikes that wall you in — stay out of the ring, then hit the crystal while it recovers.',
    attacks: [
      { id: 'punch', range: 46, min: 0, windup: 0.7, recover: 0.7, cd: 2, power: 38, shape: { shape: 'cone', r: 54, half: 0.6 }, kind: 'strike', knock: 220 },
      // slam (heavy): a ring of crystal spikes bursts up around it and BLOCKS the ground for 6 s
      { id: 'slam', range: 80, min: 0, windup: 1.1, recover: 1.2, cd: 6, power: 40, shape: { shape: 'ring', r0: 30, r: 90 }, kind: 'strike', knock: 240, heavy: true, opening: true,
        leaves: { count: 7, radius: 96, life: 6, sprite: 'r_spikes' } },
      { id: 'ram', range: 170, min: 70, windup: 0.95, recover: 1.1, cd: 5, power: 36, shape: { shape: 'line', len: 170, width: 28 }, kind: 'dash', dashTime: 0.4, knock: 260, exposes: 1.6, exposeText: 'CRYSTAL EXPOSED!' },
    ],
  },
  bronze_hoplite: {
    name: 'Bronze Hoplite', level: 15, hp: 1800, def: 12, speed: 72, radius: 12, height: 40, mass: 2,
    detect: 170, leash: 460, exp: 150, loot: 'bronze_hoplite', weakness: ['shadow'], sprite: 'bronze_hoplite', poise: 90, turn: 2.6,
    role: 'bruiser',
    // the shield: frontal hits are 85% blocked and wear it down; flank or break it (2.2 s stun)
    shield: { arc: 1.2, mult: 0.15, hp: 380, breakTime: 2.2, regen: 8 },
    pattern: 'Shield Bash / Spear Sweep / Phalanx', desc: 'A rune-bound soldier behind a bronze shield. Get around it — or break the shield. Two of them lock shields and thrust as one.',
    attacks: [
      { id: 'bash', range: 40, min: 0, windup: 0.55, recover: 0.6, cd: 1.8, power: 30, shape: { shape: 'cone', r: 46, half: 0.7 }, kind: 'strike', knock: 260 },
      { id: 'sweep', range: 60, min: 0, windup: 0.75, recover: 0.8, cd: 3, power: 34, shape: { shape: 'cone', r: 70, half: 1.4 }, kind: 'strike', knock: 200, opening: true },
      // phalanx: with another hoplite close by — a long spear line; step out sideways
      { id: 'phalanx', range: 130, min: 30, windup: 0.9, recover: 0.9, cd: 4.5, power: 38, shape: { shape: 'cone', r: 130, half: 0.22 }, kind: 'strike', knock: 240, guardBreak: true, needsAlly: { type: 'bronze_hoplite', within: 120 } },
    ],
  },
  // B0: A3's extra sheets
  void_scarab: {
    name: 'Void Scarab', level: 14, hp: 520, def: 10, speed: 116, radius: 10, height: 24, mass: 0.9,
    detect: 170, leash: 480, exp: 70, loot: 'void_scarab', weakness: ['physical'], sprite: 'void_scarab', poise: 30, turn: 10,
    role: 'swarm',
    pattern: 'Void Claw / Void Ring', desc: 'Swarms in threes out of the dark alleys. The purple glow on its shell means a ring is coming.',
    attacks: [
      { id: 'claw', range: 36, min: 0, windup: 0.4, recover: 0.45, cd: 1.2, power: 26, shape: { shape: 'cone', r: 42, half: 0.9 }, kind: 'strike', knock: 120 },
      { id: 'ring', range: 60, min: 0, windup: 0.8, recover: 0.8, cd: 4.5, power: 28, shape: { shape: 'ring', r0: 16, r: 66 }, kind: 'strike', knock: 160, status: [{ id: 'slow', dur: 1.2 }] },
    ],
  },
  rune_wisp: {
    name: 'Rune Wisp', level: 15, hp: 720, def: 8, speed: 96, radius: 10, height: 30, mass: 0.7, float: true,
    detect: 210, leash: 520, exp: 120, loot: 'rune_wisp', weakness: ['shadow'], sprite: 'rune_wisp', poise: 30, turn: 10, role: 'caster',
    keepAway: 120, blinkWhenHit: 4,
    pattern: 'Blue Flame Breath / Flame Dash', desc: 'A soul-flame bound to the runes. Keeps its distance, breathes a long line of blue fire and blinks away when pressed.',
    attacks: [
      { id: 'breath', range: 190, min: 0, windup: 0.8, recover: 0.7, cd: 3, power: 30, shape: { shape: 'cone', r: 180, half: 0.18 }, kind: 'strike', knock: 120, status: [{ id: 'burn', dur: 3 }] },
      { id: 'dash', range: 180, min: 60, windup: 0.65, recover: 0.8, cd: 4.5, power: 26, shape: { shape: 'line', len: 180, width: 18 }, kind: 'dash', dashTime: 0.25, knock: 180 },
    ],
  },
  // ---------------- B1 FROSTWIND PLAINS (owner's sheets desgin/monster/B/B1). Route B's first map: Lv 1-8 like A1.
  snow_hare: {
    name: 'Snowdrift Hare', level: 1, hp: 40, def: 0, speed: 120, radius: 8, height: 22, mass: 0.5,
    detect: 110, leash: 380, exp: 8, loot: 'snow_hare', weakness: ['physical'], sprite: 'snow_hare', poise: 8, turn: 12,
    role: 'skirmisher', pattern: 'Hop Kick / Frost Spin', desc: 'Skittish. Cornered, it spins up a flurry of frost — step out of the ring.',
    attacks: [
      { id: 'kick', range: 30, min: 0, windup: 0.42, recover: 0.45, cd: 1.3, power: 7, shape: { shape: 'cone', r: 34, half: 0.8 }, kind: 'strike', knock: 90 },
      { id: 'spin', range: 40, min: 0, windup: 0.7, recover: 0.6, cd: 4.5, power: 10, shape: { shape: 'circle', r: 46 }, kind: 'strike', knock: 120, status: [{ id: 'slow', dur: 1 }] },
    ],
  },
  rime_wolf: {
    name: 'Rimefang Wolf', level: 3, hp: 90, def: 2, speed: 130, radius: 12, height: 36, mass: 0.8, corruptible: true,
    detect: 150, leash: 520, exp: 22, loot: 'rime_wolf', weakness: ['shadow'], sprite: 'rime_wolf', poise: 20, turn: 12,
    role: 'skirmisher', flank: true, punishIdle: 1.0,
    pattern: 'Bite / Frost Lunge', desc: 'Hunts the drifts in packs and circles to your back. The ice on its back flares before a lunge that chills the blood.',
    attacks: [
      { id: 'bite', range: 38, min: 0, windup: 0.38, recover: 0.42, cd: 1.1, power: 15, shape: { shape: 'cone', r: 42, half: 0.75 }, kind: 'strike', knock: 120 },
      { id: 'lunge', range: 130, min: 55, windup: 0.55, recover: 0.6, cd: 3.4, power: 19, shape: { shape: 'line', len: 130, width: 14 }, kind: 'dash', dashTime: 0.2, punish: true, status: [{ id: 'slow', dur: 1.2 }] },
    ],
  },
  frost_harrier: {
    name: 'Frost Harrier', level: 5, hp: 120, def: 3, speed: 110, radius: 11, height: 32, mass: 0.6, float: true,
    detect: 190, leash: 520, exp: 38, loot: 'frost_harrier', weakness: ['physical'], sprite: 'frost_harrier', poise: 20, turn: 10,
    role: 'caster', keepAway: 100,
    pattern: 'Talon Dive / Gale Ring', desc: 'Circles out of reach, then dives in a straight line. Its wings spin up a ring of frozen wind — leave it before it bursts.',
    attacks: [
      { id: 'dive', range: 170, min: 60, windup: 0.6, recover: 0.8, cd: 3, power: 18, shape: { shape: 'line', len: 170, width: 16 }, kind: 'dash', dashTime: 0.28, knock: 150, exposes: 1, exposeText: 'GROUNDED!' },
      // gale: its wings throw a burst of frozen wind where YOU stand (it fights from range) — move off the circle
      { id: 'gale', range: 150, min: 50, windup: 0.85, recover: 0.8, cd: 5, power: 20, shape: { shape: 'circle', r: 58, offset: 100 }, kind: 'strike', knock: 220 },
    ],
  },
  frost_bear: {
    name: 'Frostback Bear', level: 7, hp: 420, def: 8, speed: 62, radius: 20, height: 54, mass: 3, superArmor: true,
    detect: 150, leash: 440, exp: 70, loot: 'frost_bear', weakness: ['shadow'], sprite: 'frost_bear', poise: 80, turn: 2.5,
    role: 'bruiser',
    pattern: 'Maul / Ice Eruption', desc: 'Rears up before a maul. Its roar tears ice spikes out of the ground in front of it — they stay a while and wall off the path.',
    attacks: [
      { id: 'maul', range: 50, min: 0, windup: 0.6, recover: 0.6, cd: 1.8, power: 26, shape: { shape: 'cone', r: 58, half: 0.8 }, kind: 'strike', knock: 200 },
      { id: 'eruption', range: 110, min: 0, windup: 1.0, recover: 1.1, cd: 5, power: 30, shape: { shape: 'cone', r: 120, half: 0.35 }, kind: 'strike', knock: 240, heavy: true, opening: true, missRecover: 1.8,
        leaves: { count: 5, radius: 90, life: 5, sprite: 'r_spikes' } },
    ],
  },
  wolf: {
    name: 'Forest Wolf', level: 2, hp: 70, def: 2, speed: 128, radius: 10, height: 30, mass: 0.8, corruptible: true,
    detect: 150, leash: 520, exp: 18, loot: 'wolf', weakness: ['shadow'], sprite: 'wolf', poise: 18, turn: 12,
    role: 'skirmisher', flank: true, punishIdle: 1.0, // circles to your side / back, lunges at a player standing still
    pattern: 'Charge / Bite', desc: 'Hunts in packs. Watch for the crouch before the lunge.',
    attacks: [
      { id: 'bite', range: 38, min: 0, windup: 0.38, recover: 0.42, cd: 1.1, power: 14, shape: { shape: 'cone', r: 42, half: 0.75 }, kind: 'strike', knock: 120 },
      { id: 'lunge', range: 125, min: 55, windup: 0.52, recover: 0.55, cd: 3.2, power: 18, shape: { shape: 'line', len: 125, width: 13 }, kind: 'dash', dashTime: 0.2, punish: true },
    ],
  },
  // B0: A1's field monsters from the owner's sheets (the canvas-only goblins / crystal beasts are gone)
  leafling: {
    name: 'Leafling', level: 3, hp: 90, def: 3, speed: 96, radius: 9, height: 26, mass: 0.6, float: true, corruptible: true,
    detect: 150, leash: 480, exp: 26, loot: 'leafling', weakness: ['physical'], sprite: 'leafling', poise: 20, turn: 10, role: 'caster',
    keepAway: 90, pattern: 'Seed Shot / Bloom', desc: 'A forest spirit that keeps its distance and spits seeds. Its heart glows before it blooms — step out of the ring.',
    attacks: [
      { id: 'seed', range: 200, min: 0, windup: 0.6, recover: 0.6, cd: 2.2, power: 14, shape: { shape: 'cone', r: 170, half: 0.25 }, kind: 'volley', count: 1, spread: 0, speed: 210, projColor: '#8af06a' },
      { id: 'bloom', range: 56, min: 0, windup: 0.85, recover: 0.8, cd: 5, power: 18, shape: { shape: 'circle', r: 58 }, kind: 'strike', knock: 140, status: [{ id: 'root', dur: 0.9 }] },
    ],
  },
  treant: {
    name: 'Bramble Treant', level: 5, hp: 300, def: 7, speed: 58, radius: 16, height: 46, mass: 2.4, superArmor: true, corruptible: true,
    detect: 140, leash: 440, exp: 48, loot: 'treant', weakness: ['shadow'], sprite: 'treant', poise: 60, turn: 3, role: 'bruiser',
    pattern: 'Branch Swipe / Root Slam / Sap Orb', desc: 'Slow and heavy. It lifts both branches before the Root Slam — a slam that hits nothing leaves it rooted in place.',
    attacks: [
      { id: 'swipe', range: 42, min: 0, windup: 0.55, recover: 0.55, cd: 1.6, power: 18, shape: { shape: 'cone', r: 50, half: 0.9 }, kind: 'strike', knock: 150 },
      { id: 'slam', range: 72, min: 0, windup: 1.0, recover: 1.0, cd: 3.6, power: 34, shape: { shape: 'circle', r: 54, offset: 30 }, kind: 'strike', knock: 260, heavy: true, opening: true, missRecover: 2.0 },
      { id: 'orb', range: 220, min: 80, windup: 0.8, recover: 0.7, cd: 4.5, power: 20, shape: { shape: 'cone', r: 190, half: 0.3 }, kind: 'volley', count: 1, spread: 0, speed: 170, projKind: 'orb', projColor: '#8af06a' },
    ],
  },
  elder_treant: {
    name: 'Elder Treant', level: 8, hp: 760, def: 12, armor: 220, speed: 56, radius: 22, height: 64, mass: 5, scale: 1.4,
    detect: 190, leash: 400, exp: 240, loot: 'elder_treant', weakness: ['physical'], sprite: 'treant', poise: 140, turn: 1.8, role: 'tank',
    superArmor: true, miniBoss: true, shardColor: '#8af06a',
    pattern: 'Root Ring / Trample / Sap Barrage', desc: 'The oldest tree of the hidden cave. Break its bark armour, then strike the glowing heartwood.',
    attacks: [
      { id: 'ring', range: 90, min: 0, windup: 1.0, recover: 0.9, cd: 3.4, power: 34, shape: { shape: 'ring', r0: 28, r: 110 }, kind: 'strike', knock: 260 },
      { id: 'trample', range: 170, min: 50, windup: 0.8, recover: 1.2, cd: 4.5, power: 38, shape: { shape: 'line', len: 170, width: 26 }, kind: 'dash', dashTime: 0.32 },
      { id: 'barrage', range: 260, min: 90, windup: 0.9, recover: 0.8, cd: 5, power: 22, shape: { shape: 'cone', r: 200, half: 0.55 }, kind: 'volley', count: 5, spread: 0.9, speed: 230, projKind: 'orb', projColor: '#8af06a' },
    ],
  },
  thornling: {
    name: 'Thornling', level: 9, hp: 55, def: 2, speed: 118, radius: 9, height: 24, mass: 0.6,
    detect: 600, leash: 2000, exp: 8, loot: 'thornling', weakness: ['shadow'], sprite: 'thornling', poise: 10, turn: 12, role: 'swarm',
    pattern: 'Snap', desc: 'Roots given hunger by the Guardian.',
    attacks: [{ id: 'snap', range: 32, min: 0, windup: 0.4, recover: 0.5, cd: 1.3, power: 12, shape: { shape: 'cone', r: 36, half: 0.8 }, kind: 'strike' }],
  },
  guardian: {
    name: 'Guardian of the Forest', title: 'Warden of the Whispering Heart', level: 10, hp: 12000, def: 18, radius: 30, height: 90, boss: true,
    exp: 500, loot: 'guardian', weakness: ['shadow'],
    // victory presentation + what the world does next (game.onBossDefeated)
    defeat: {
      callout: ['GUARDIAN DEFEATED', 'The corruption is severed from its heart'],
      banner: ['WORLD STATE UPDATED', 'Whispering Forest has changed.'],
      startQuest: 'valley',
    },
    pattern: 'Claw / Charge / Leap / Smash · Roots / Crystals / Summon (Heartwood Ward) · Enrage', desc: 'An ancient warden bound to the forest heart. Its crystal core is exposed after its heaviest attacks.',
  },
};

// Corrupted variants (before the Guardian falls): tougher, more aggressive, purple eyes.
export const CORRUPT_MOD = { hp: 1.2, detect: 1.35, power: 1.1, speed: 1.08 };

// Elite variants (spawn data `elite: true`): a simple mini-threat for later areas — bigger, much tougher (hp ×4),
// more EXP and an extra roll on the 'elite' loot table. Multiplies with CORRUPT_MOD.
export const ELITE_MOD = { hp: 4, detect: 1.2, power: 1.3, speed: 1.05, exp: 3, scale: 1.2, loot: 'elite', level: 2 };

// AI states (spec names). RETURN = walking home after a leash / lost target / stuck on a wall.
export const MONSTER_STATE = {
  IDLE: 'idle', PATROL: 'patrol', AGGRO: 'aggro', CHASE: 'chase', ATTACK: 'attack', HIT: 'hit', RETURN: 'return', DEAD: 'dead',
};
