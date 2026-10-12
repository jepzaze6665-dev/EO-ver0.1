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

  // ---------------- ASTRAL LINE (Q4): casters keep their distance — close the gap after a volley
  // STORMCALLER: bolts and sky strikes, a nova when you hug it
  shadow_stormcaller: shadowDuel('stormcaller', {
    name: 'SHADOW OF THE STORMCALLER', title: 'The sky that answers someone else', hp: 12500, speed: 150, aura: '120,200,255',
    teaches: 'Dodge sideways through the bolts · the sky marks where it strikes · get close after the burst',
    phases: [
      { name: 'CHARGED', sub: 'Lightning seeks you', hpBelow: 1, moves: ['lash', 'strikes', 'burst'] },
      { name: 'SUPERCHARGED', sub: 'The storm breaks', hpBelow: 0.5, moves: ['lash', 'strikes', 'burst', 'tempest'], speed: 1.1, windup: 0.9 },
    ],
    moves: {
      lash: { kind: 'volley', range: 380, min: 80, windup: 0.7, recover: 0.5, cd: 2.4, weight: 4, power: 30, count: 3, spread: 0.35, speed: 360, dmg: 'magic', color: '#9ad8ff', anim: { windup: 'thunderLash', attack: 'thunderLash' } },
      strikes: { kind: 'pattern', layout: 'scatter', count: 5, r: 48, step: 80, delay: 0.15, range: 420, windup: 1.0, recover: 0.6, cd: 6, weight: 3, power: 38, knock: 100, dmg: 'magic', opening: 1.2, anim: { windup: 'chainTempest', attack: 'chainTempest' } },
      burst: { kind: 'strike', range: 100, windup: 0.8, recover: 1.0, cd: 7, weight: 2, power: 46, knock: 260, dmg: 'magic', opening: 1.6, shape: { shape: 'circle', r: 120 }, anim: { windup: 'stormBurst', attack: 'stormBurst' } },
      tempest: { kind: 'nova', range: 999, windup: 1.1, recover: 0.9, cd: 11, weight: 2, power: 32, rings: 3, width: 44, gap: 70, dmg: 'magic', color: '140,210,255', opening: 1.4, anim: { windup: 'heavensTempest', attack: 'heavensTempest' } },
    },
  }),
  // VOID SCRIBE: ink glyphs on the ground, slowing seals, phantom shots
  shadow_void_scribe: shadowDuel('void_scribe', {
    name: 'SHADOW OF THE VOID SCRIBE', title: 'The page that writes you out', hp: 13000, speed: 135, aura: '170,110,255',
    teaches: 'Never stand in its script · the seal slows — dodge out before it closes',
    phases: [
      { name: 'INK', sub: 'Every glyph is a trap', hpBelow: 1, moves: ['script', 'quill', 'seal'] },
      { name: 'ABYSSAL', sub: 'The page is almost full', hpBelow: 0.5, moves: ['script', 'quill', 'seal', 'null'], speed: 1.1, windup: 0.9 },
    ],
    moves: {
      script: { kind: 'leap', range: 360, min: 60, r: 80, track: 0.4, windup: 1.0, recover: 0.6, cd: 3.5, weight: 4, power: 34, knock: 80, dmg: 'magic', status: [{ id: 'slow', dur: 2 }], anim: { windup: 'voidScript', attack: 'voidScript' } },
      quill: { kind: 'volley', range: 380, min: 80, windup: 0.75, recover: 0.6, cd: 3, weight: 3, power: 26, count: 5, spread: 0.8, speed: 300, dmg: 'magic', color: '#b48aff', anim: { windup: 'phantomQuill', attack: 'phantomQuill' } },
      seal: { kind: 'strike', range: 120, windup: 1.1, recover: 0.9, cd: 7, weight: 2, power: 44, knock: 140, dmg: 'magic', opening: 1.6, shape: { shape: 'circle', r: 130 }, status: [{ id: 'slow', dur: 2.5 }], anim: { windup: 'voidSeal', attack: 'voidSeal' } },
      null: { kind: 'pattern', layout: 'cross', count: 7, r: 50, step: 70, delay: 0.1, range: 420, windup: 1.2, recover: 1.0, cd: 11, weight: 2, power: 36, knock: 120, dmg: 'magic', opening: 1.5, anim: { windup: 'finalScript', attack: 'finalScript' } },
    },
  }),
  // LUMEN ORACLE: lances of light, a judgment ring — and it heals itself if you leave it alone (weak after the heal)
  shadow_lumen_oracle: shadowDuel('lumen_oracle', {
    name: 'SHADOW OF THE LUMEN ORACLE', title: 'The light that will not let you rest', hp: 14000, speed: 140, aura: '255,240,160',
    teaches: 'Pressure it — a quiet shadow heals · step out of the judgment ring',
    phases: [
      { name: 'RADIANCE', sub: 'Light that blinds', hpBelow: 1, moves: ['bolt', 'grace', 'barrier'] },
      { name: 'JUDGMENT', sub: 'The ring closes', hpBelow: 0.5, moves: ['bolt', 'grace', 'barrier', 'judgment'], speed: 1.1, windup: 0.9 },
    ],
    moves: {
      bolt: { kind: 'volley', range: 400, min: 80, windup: 0.65, recover: 0.5, cd: 2.2, weight: 4, power: 30, count: 2, spread: 0.25, speed: 380, dmg: 'magic', color: '#fff2a0', anim: { windup: 'lumenBolt', attack: 'lumenBolt' } },
      grace: { kind: 'pattern', layout: 'ring', count: 6, r: 46, step: 90, delay: 0.1, range: 300, windup: 1.0, recover: 0.6, cd: 6, weight: 3, power: 34, knock: 100, dmg: 'magic', anim: { windup: 'grace', attack: 'grace' } },
      barrier: { kind: 'strike', range: 110, windup: 0.9, recover: 1.2, cd: 8, weight: 2, power: 40, knock: 220, dmg: 'magic', opening: 1.8, shape: { shape: 'circle', r: 110 }, anim: { windup: 'barrier', attack: 'lumenBurst' } },
      judgment: { kind: 'nova', range: 999, windup: 1.2, recover: 1.0, cd: 11, weight: 2, power: 34, rings: 2, width: 52, gap: 90, dmg: 'magic', color: '255,240,170', opening: 1.5, anim: { windup: 'judgment', attack: 'judgment' } },
    },
  }),

  // ---------------- AEGIS LINE (Q4): slow, heavy, guard-breaking blows — dodge, never trade
  // WARDEN OF DAWN: shield bashes, holy ground, a march that pushes you out
  shadow_warden_of_dawn: shadowDuel('warden_of_dawn', {
    name: 'SHADOW OF THE WARDEN', title: 'The dawn that stands in your way', hp: 14500, def: 14, speed: 120, aura: '255,210,120',
    teaches: 'Its march breaks guards · leave the holy ground · hit it after the bash',
    phases: [
      { name: 'DAWNLIGHT', sub: 'It holds the line', hpBelow: 1, moves: ['bash', 'march', 'bastion'] },
      { name: 'RADIANT', sub: 'The sanctuary rises', hpBelow: 0.5, moves: ['bash', 'march', 'bastion', 'sanctuary'], speed: 1.1, windup: 0.9 },
    ],
    moves: {
      bash: { kind: 'strike', range: 80, windup: 0.65, recover: 0.6, cd: 2, weight: 4, power: 40, knock: 180, opening: 1.0, shape: { shape: 'cone', r: 86, half: 0.8 }, anim: { windup: 'guard', attack: 'atk1' } },
      march: { kind: 'dash', range: 260, min: 80, windup: 0.85, recover: 0.8, cd: 5, weight: 3, power: 46, knock: 260, len: 220, width: 40, guardBreak: true, opening: 1.4, anim: { windup: 'march', attack: 'march' } },
      bastion: { kind: 'leap', range: 360, min: 60, r: 95, track: 0.4, windup: 1.1, recover: 0.7, cd: 7, weight: 2, power: 38, knock: 140, dmg: 'magic', status: [{ id: 'slow', dur: 2 }], anim: { windup: 'dawnBastion', attack: 'dawnBastion' } },
      sanctuary: { kind: 'nova', range: 999, windup: 1.2, recover: 1.0, cd: 11, weight: 2, power: 34, rings: 2, width: 50, gap: 80, dmg: 'magic', color: '255,220,140', opening: 1.6, anim: { windup: 'sanctuary', attack: 'sanctuary' } },
    },
  }),
  // BULWARK SENTINEL: the slowest, the toughest — a charging fortress and a counterweight slam
  shadow_bulwark_sentinel: shadowDuel('bulwark_sentinel', {
    name: 'SHADOW OF THE BULWARK', title: 'The wall that walks', hp: 15500, def: 18, speed: 105, aura: '220,170,110',
    teaches: 'Never block the counterweight · circle it — it turns slowly',
    phases: [
      { name: 'BASTION', sub: 'Nothing moves it', hpBelow: 1, moves: ['slam', 'step', 'weight'] },
      { name: 'CITADEL', sub: 'The fortress closes in', hpBelow: 0.5, moves: ['slam', 'step', 'weight', 'citadel'], speed: 1.1, windup: 0.9 },
    ],
    moves: {
      slam: { kind: 'strike', range: 80, windup: 0.75, recover: 0.7, cd: 2.2, weight: 4, power: 44, knock: 200, opening: 1.0, shape: { shape: 'cone', r: 90, half: 0.9 }, anim: { windup: 'guard', attack: 'atk1' } },
      step: { kind: 'dash', range: 220, min: 60, windup: 0.8, recover: 0.9, cd: 5, weight: 3, power: 48, knock: 260, len: 180, width: 44, guardBreak: true, opening: 1.4, anim: { windup: 'fortressStep', attack: 'fortressStep' } },
      weight: { kind: 'strike', range: 110, windup: 1.4, recover: 1.1, cd: 8, weight: 2, power: 70, knock: 300, unblockable: true, opening: 2.0, shape: { shape: 'circle', r: 115 }, anim: { windup: 'counterweight', attack: 'counterweight' } },
      citadel: { kind: 'nova', range: 999, windup: 1.2, recover: 1.0, cd: 12, weight: 2, power: 36, rings: 3, width: 46, gap: 76, color: '230,180,120', opening: 1.6, anim: { windup: 'citadel', attack: 'citadel' } },
    },
  }),
  // OATHBREAKER: brands, a chain that drags, and the verdict — strongest when it is hurt
  shadow_oathbreaker: shadowDuel('oathbreaker', {
    name: 'SHADOW OF THE OATHBREAKER', title: 'The oath you have not broken yet', hp: 14000, def: 12, speed: 125, aura: '255,110,90',
    teaches: 'The chain pulls you in — dodge its line · the verdict hits harder the lower it is',
    phases: [
      { name: 'FORSWORN', sub: 'It remembers every wound', hpBelow: 1, moves: ['cleave', 'chain', 'sinful'] },
      { name: 'UNBOUND', sub: 'Nothing holds it now', hpBelow: 0.5, moves: ['cleave', 'chain', 'sinful', 'verdict'], speed: 1.15, windup: 0.85 },
    ],
    moves: {
      cleave: { kind: 'combo', range: 90, recover: 0.7, cd: 2.4, weight: 4, power: 36, knock: 170, anim: { windup: 'atk1', attack: 'atk2' },
        hits: [
          { windup: 0.6, power: 36, shape: { shape: 'cone', r: 92, half: 0.85 } },
          { windup: 0.45, power: 40, shape: { shape: 'cone', r: 96, half: 0.9 } },
        ] },
      chain: { kind: 'dash', range: 300, min: 90, windup: 0.8, recover: 0.7, cd: 5, weight: 3, power: 40, knock: 120, len: 280, width: 32, opening: 1.3, anim: { windup: 'ruinChain', attack: 'ruinChain' } },
      sinful: { kind: 'strike', range: 100, windup: 1.2, recover: 1.0, cd: 7, weight: 2, power: 62, knock: 260, guardBreak: true, opening: 1.8, shape: { shape: 'circle', r: 105 }, anim: { windup: 'counter', attack: 'sinful' } },
      verdict: { kind: 'pattern', layout: 'cross', count: 7, r: 52, step: 74, delay: 0.1, range: 420, windup: 1.3, recover: 1.1, cd: 11, weight: 2, power: 40, knock: 160, opening: 1.6, anim: { windup: 'verdict', attack: 'verdictEnd' } },
    },
  }),
};
