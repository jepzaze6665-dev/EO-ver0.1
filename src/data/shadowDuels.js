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
};
