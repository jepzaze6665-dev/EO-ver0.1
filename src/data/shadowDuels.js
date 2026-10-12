// SHADOW DUELS (Quest rework Q2) — the last chapter of a class-change quest: the player fights the SHADOW OF THE NEW
// CLASS in Valehaven's Proving Ground (maps/provingGround.js). A shadow is an ordinary data boss (type 'trial',
// impl 'area', boss/areaBoss.js) drawn with that class's own player sprites, darkened (look.player = class id), and
// using that class's skill animations for its moves (move `anim` { windup, attack } = class animation names).
// Each shadow only appears while its trial is at the duel chapter: appear = flag duel_<class id> (progression.js
// sets it, clears it when the trial ends). Trial bosses pay nothing (the reward is the class itself), gate nothing and
// can be retried at once: dying respawns you at the Valehaven waystone beside the ring.
//
// shadowDuel(classId, spec) fills the shared parts; spec = { name, title, hp, level?, speed?, aura, teaches, phases,
// moves, vfx? }. Add a shadow = one call in SHADOWS below + the trial's `boss` chapter naming 'shadow_<class id>'.

const ARENA = { name: 'The Proving Ground', center: [55, 16], radius: 6.2, trigger: 4.6, bossSpawn: [58, 16], entry: [49.5, 16] };

export function shadowDuel(classId, spec) {
  const id = 'shadow_' + classId;
  return {
    id, name: spec.name, title: spec.title || 'Shadow of the Trial', type: 'trial', impl: 'area',
    route: null, map: 'proving', level: spec.level || 30, nativeLevel: spec.level || 30, recommendedLevel: spec.level || 30,
    teaches: spec.teaches || '',
    stats: { hp: spec.hp || 9000, def: spec.def || 8, speed: spec.speed || 150, radius: 14, height: 46, mass: 3, weakness: [], superArmor: true, poise: spec.poise || 700 },
    look: { player: classId, scale: 1, aura: spec.aura || '150,90,255', vfx: spec.vfx || {} },
    arena: { ...ARENA, cameraLock: true },
    appear: [{ type: 'flag', flag: 'duel_' + classId, label: 'Reach the last chapter of the class trial' }],
    phases: spec.phases,
    moves: spec.moves,
    rewards: {}, // the class itself is the reward (progression unlocks it on the kill)
    unlocks: [],
    shadowOf: classId,
  };
}

// ---------------- the shadows (Q3 Umbral line, Q4 Astral + Aegis)
export const SHADOWS = {
  // NIGHTFALL REAPER: wide scythe arcs, a dash-through reap, a dark zone, a late third cut (punishes early dodges)
  shadow_nightfall_reaper: shadowDuel('nightfall_reaper', {
    name: 'SHADOW OF THE REAPER', title: 'Nightfall, turned against you', hp: 16000, aura: '140,70,255',
    teaches: 'Read the scythe · dodge late, not early · leave the dark zone',
    phases: [
      { name: 'THE HARVEST', sub: 'It moves the way you will', hpBelow: 1, moves: ['arc', 'reap', 'triple'] },
      { name: 'NIGHTFALL', sub: 'The dark gathers — keep moving', hpBelow: 0.5, moves: ['arc', 'reap', 'triple', 'zone'], speed: 1.15, windup: 0.9 },
    ],
    moves: {
      arc: { kind: 'strike', range: 80, windup: 0.6, recover: 0.5, cd: 1.6, weight: 4, power: 42, knock: 160, dmg: 'shadow', shape: { shape: 'circle', r: 84 }, anim: { windup: 'reapersArc', attack: 'reapersArc' } },
      reap: { kind: 'dash', range: 260, min: 90, windup: 0.75, recover: 0.7, cd: 4, weight: 3, power: 48, knock: 220, len: 240, width: 36, guardBreak: true, opening: 1.4, anim: { windup: 'phantomReap', attack: 'phantomReap' } },
      triple: {
        kind: 'combo', range: 90, recover: 0.8, cd: 6, weight: 2, power: 30, knock: 170, opening: 1.6, anim: { windup: 'atk1', attack: 'atk3' },
        hits: [
          { windup: 0.5, power: 30, shape: { shape: 'cone', r: 92, half: 0.8 } },
          { windup: 0.35, power: 30, shape: { shape: 'cone', r: 92, half: 0.8 } },
          { windup: 0.85, power: 48, shape: { shape: 'circle', r: 100 } },
        ],
      },
      zone: { kind: 'leap', range: 400, min: 60, r: 110, track: 0.6, windup: 1.2, recover: 0.6, cd: 9, weight: 2, power: 36, knock: 120, dmg: 'shadow', status: [{ id: 'slow', dur: 2 }], opening: 1.2, anim: { windup: 'nightfallZone', attack: 'nightfallZone' } },
    },
  }),
  // DUSKRUNNER: never stands still — short dashes back to back, a flurry, faster still in phase 2. Less HP, more pressure.
  shadow_duskrunner: shadowDuel('duskrunner', {
    name: 'SHADOW OF THE DUSKRUNNER', title: 'The road that runs you down', hp: 13500, speed: 190, aura: '90,170,255',
    teaches: 'Dodge the dash, then punish the stop · it is weak only after the flurry',
    phases: [
      { name: 'FLOW', sub: 'It never stops moving', hpBelow: 1, moves: ['fang', 'step', 'flurry'] },
      { name: 'RUSH', sub: 'Faster — wait for it to stop', hpBelow: 0.5, moves: ['fang', 'step', 'flurry', 'endless'], speed: 1.2, windup: 0.85 },
    ],
    moves: {
      fang: { kind: 'dash', range: 280, min: 70, windup: 0.55, recover: 0.45, cd: 2.2, weight: 4, power: 38, knock: 160, len: 260, width: 32, anim: { windup: 'blueFang', attack: 'blueFang' } },
      step: { kind: 'dash', range: 200, min: 40, windup: 0.4, recover: 0.3, cd: 3.5, weight: 3, power: 28, knock: 120, len: 170, width: 30, anim: { windup: 'flashStep', attack: 'flashStep' } },
      flurry: {
        kind: 'combo', range: 80, recover: 1.1, cd: 6, weight: 2, power: 20, knock: 90, opening: 1.8, anim: { windup: 'barrage', attack: 'barrage' },
        hits: [
          { windup: 0.45, power: 20, shape: { shape: 'cone', r: 80, half: 0.9 } },
          { windup: 0.2, power: 20, shape: { shape: 'cone', r: 80, half: 0.9 } },
          { windup: 0.2, power: 20, shape: { shape: 'cone', r: 80, half: 0.9 } },
          { windup: 0.55, power: 34, shape: { shape: 'circle', r: 92 } },
        ],
      },
      endless: { kind: 'pattern', layout: 'cross', count: 5, r: 46, step: 70, delay: 0.12, range: 300, windup: 1.0, recover: 0.9, cd: 10, weight: 2, power: 34, knock: 120, opening: 1.4, anim: { windup: 'endlessRun', attack: 'endlessRun' } },
    },
  }),
  // BLADE OF ECHOES: every cut comes back — the second hit lands late; a held stance turns into a crimson X
  shadow_blade_of_echoes: shadowDuel('blade_of_echoes', {
    name: 'SHADOW OF THE ECHOING BLADE', title: 'Every cut you made, returned', hp: 15000, speed: 140, aura: '255,90,110',
    teaches: 'Every slash echoes — dodge twice · do not strike into the raised blade',
    phases: [
      { name: 'RESONANCE', sub: 'Every cut comes back', hpBelow: 1, moves: ['echo', 'thrust', 'crimson'] },
      { name: 'FULL MEMORY', sub: 'It remembers your whole fight', hpBelow: 0.5, moves: ['echo', 'thrust', 'crimson', 'recollect'], speed: 1.1, windup: 0.9 },
    ],
    moves: {
      echo: {
        kind: 'combo', range: 90, recover: 0.7, cd: 2.6, weight: 4, power: 34, knock: 150, anim: { windup: 'echoSlash', attack: 'echoSlash' },
        hits: [
          { windup: 0.55, power: 34, shape: { shape: 'cone', r: 92, half: 0.85 } },
          { windup: 0.9, power: 26, shape: { shape: 'cone', r: 100, half: 0.95 } },
        ],
      },
      thrust: { kind: 'dash', range: 230, min: 80, windup: 0.7, recover: 0.6, cd: 4.5, weight: 3, power: 44, knock: 200, len: 210, width: 30, opening: 1.2, anim: { windup: 'atk2', attack: 'atk2' } },
      crimson: { kind: 'strike', range: 110, windup: 1.3, recover: 0.9, cd: 7, weight: 2, power: 58, knock: 240, guardBreak: true, opening: 1.8, shape: { shape: 'circle', r: 110 }, anim: { windup: 'stance', attack: 'counterStrike' } },
      recollect: { kind: 'pattern', layout: 'ring', count: 8, r: 50, step: 120, delay: 0.1, range: 400, windup: 1.2, recover: 1.0, cd: 11, weight: 2, power: 36, knock: 140, opening: 1.6, anim: { windup: 'recollection', attack: 'recollection' } },
    },
  }),
};
