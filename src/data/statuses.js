// STATUS DATA — every status effect is described here; status/status.js only reads these rules.
// Skills never hardcode what a status does: they call  entity.status.add('burn', 4, { source, damage })
//
//  category   : 'control' | 'debuff' | 'buff' | 'dot' | 'defense'   (control durations shrink with `tenacity`)
//  maxStacks  : cap (1 = no stacking)
//  stacking   : 'longest' -> keep the longer remaining duration (default)
//               'refresh' -> every application resets the duration
//               'stack'   -> +1 stack per application, duration refreshed
//  modifiers  : moveMult / damageMult (dealt) / damageTakenMult / defenseMult (× DEF against incoming hits) — multiplied per stack when perStack
//               guardBlockMult (× damage let through a normal block) / dodgeCostMult / attackSpeedMult
//               values in `data` passed to add() (e.g. { mult: 1.3 }) override `mult`
//  flags      : cannotAct (no move/attack/skill), cannotMove, cannotCast (no skills),
//               stealth (monsters lose track / hold their attacks), taunted (monster must chase its taunter),
//               unshakable (no knockback, poise never breaks, hits never interrupt an action),
//               debuffImmune (new debuff / control / dot statuses are resisted)
//  tenacity   : added to the holder's tenacity while active (control durations shorter; capped by STATUS_RULES)
//  dot        : { interval, damage, type } — damage per tick per stack (data.damage overrides)
//  absorb     : shield — data.amount points of damage absorbed before HP
//  vulnerable : target takes the weak-window bonus from combat/damageSystem.js
//  display    : UI only (short label + colour)
//  aura       : drawn around the holder while active (Player.drawAura) — { color: 'r,g,b', ring, columns, body, motes, scale }
export const STATUSES = {
  // ---- control
  stun: { id: 'stun', category: 'control', maxStacks: 1, stacking: 'longest', flags: ['cannotAct'], display: { label: 'STUN', color: '#ffe070' } },
  root: { id: 'root', category: 'control', maxStacks: 1, stacking: 'longest', flags: ['cannotMove'], display: { label: 'ROOT', color: '#a0e080' } },
  silence: { id: 'silence', category: 'control', maxStacks: 1, stacking: 'longest', flags: ['cannotCast'], display: { label: 'SILENCE', color: '#c0b0ff' } },
  slow: { id: 'slow', category: 'debuff', maxStacks: 1, stacking: 'longest', modifiers: { moveMult: 0.6 }, display: { label: 'SLOW', color: '#8ab8ff' } },
  // ---- debuffs
  // taunt: the monster must fight the taunter and hits 20% softer
  taunted: { id: 'taunted', category: 'debuff', maxStacks: 1, stacking: 'refresh', flags: ['taunted'], modifiers: { damageMult: 0.8 }, display: { label: 'TAUNTED', color: '#ffd070' } },
  vulnerable: { id: 'vulnerable', category: 'debuff', maxStacks: 1, stacking: 'longest', vulnerable: true, display: { label: 'VULNERABLE', color: '#9af8ff' } },
  // Combat 2.0 Counter Window (combat/counterSystem.js, data/counter.js): the attacker was beaten — punish it now
  // Guard Break (data/stamina.js guardBreak): the guard was smashed open — no acting for a moment
  guard_broken: { id: 'guard_broken', category: 'control', maxStacks: 1, stacking: 'longest', flags: ['cannotAct'], modifiers: { moveMult: 0.4 }, display: { label: 'GUARD BREAK', color: '#ff9a80' } },
  // Combat 2.0 anti-tanking (data/antiTank.js): the player's poise broke — a moment of no control, then exposed
  staggered: { id: 'staggered', category: 'control', maxStacks: 1, stacking: 'longest', flags: ['cannotAct'], display: { label: 'STAGGERED', color: '#ff9a80' } },
  exposed: { id: 'exposed', category: 'debuff', maxStacks: 1, stacking: 'longest', modifiers: { damageTakenMult: 1.15 }, display: { label: 'EXPOSED', color: '#ffb0a0' } },
  counter_window: { id: 'counter_window', category: 'debuff', maxStacks: 1, stacking: 'longest', modifiers: { damageTakenMult: 1.2, defenseMult: 0.5 }, display: { label: 'COUNTER', color: '#ffb060' } },
  curse: { id: 'curse', category: 'debuff', maxStacks: 3, stacking: 'stack', perStack: true, modifiers: { damageTakenMult: 1.06 }, display: { label: 'CURSE', color: '#d070ff' } },
  // ---- damage over time
  burn: { id: 'burn', category: 'dot', maxStacks: 3, stacking: 'stack', dot: { interval: 0.5, damage: 3, type: 'fire' }, display: { label: 'BURN', color: '#ff9a40' } },
  poison: { id: 'poison', category: 'dot', maxStacks: 5, stacking: 'stack', dot: { interval: 1, damage: 4, type: 'poison' }, display: { label: 'POISON', color: '#90e050' } },
  // ---- buffs
  haste: { id: 'haste', category: 'buff', maxStacks: 1, stacking: 'longest', modifiers: { moveMult: 1.25 }, display: { label: 'HASTE', color: '#9af8ff' } },
  counter_ready: { id: 'counter_ready', category: 'buff', maxStacks: 1, stacking: 'refresh', display: { label: 'COUNTER READY', color: '#ffd070' } },
  // stealth + the next hit deals +60% (the hit itself ends it — see the class that grants it)
  veiled: { id: 'veiled', category: 'buff', maxStacks: 1, stacking: 'refresh', flags: ['stealth'], modifiers: { moveMult: 1.2, damageMult: 1.6 }, display: { label: 'VEILED', color: '#c8a0ff' } },
  // Duskrunner: SILENT RUN (stealth + speed; the first hit out of it lands harder and ends it — class code)
  silent_run: { id: 'silent_run', category: 'buff', maxStacks: 1, stacking: 'refresh', flags: ['stealth'], modifiers: { moveMult: 1.35, damageMult: 1.5 }, display: { label: 'SILENT RUN', color: '#9ad8ff' } },
  // Duskrunner ultimate ENDLESS RUN: momentum never falls (class code), faster attacks / feet, half-price dodges
  overdrive: { id: 'overdrive', category: 'buff', maxStacks: 1, stacking: 'refresh', modifiers: { moveMult: 1.15, attackSpeedMult: 1.3, dodgeCostMult: 0.5 }, display: { label: 'OVERDRIVE', color: '#5ab8ff' } },
  // Blade of Echoes: LAST STAND (HP under 40%): takes 40% less damage; the class reads it for counter / echo bonuses
  last_stand: { id: 'last_stand', category: 'buff', maxStacks: 1, stacking: 'refresh', modifiers: { damageTakenMult: 0.6 }, display: { label: 'LAST STAND', color: '#ff6a6a' } },
  // Stormcaller: SHOCK (lightning debuff, up to 3 stacks: each takes 3% more damage + a small lightning tick; the class
  // passes the tick size), STILL AIR (standing still in a fight: your damage -15%), TAILWIND (inside your Tempest Field), STATIC GUARD (after Storm Step: -30% damage taken)
  shock: { id: 'shock', category: 'debuff', maxStacks: 3, stacking: 'stack', perStack: true, modifiers: { damageTakenMult: 1.03 }, dot: { interval: 1, damage: 3, type: 'lightning' }, display: { label: 'SHOCK', color: '#7ac8ff' } },
  still_air: { id: 'still_air', category: 'debuff', maxStacks: 1, stacking: 'refresh', modifiers: { damageMult: 0.85 }, display: { label: 'STILL AIR', color: '#8a9ab0' } },
  static_guard: { id: 'static_guard', category: 'defense', maxStacks: 1, stacking: 'refresh', modifiers: { damageTakenMult: 0.7 }, display: { label: 'STATIC GUARD', color: '#b0e0ff' } },
  tailwind: { id: 'tailwind', category: 'buff', maxStacks: 1, stacking: 'refresh', modifiers: { moveMult: 1.2 }, display: { label: 'TAILWIND', color: '#9ad8ff' } },
  surge: { id: 'surge', category: 'buff', maxStacks: 1, stacking: 'longest', modifiers: { damageMult: 1.15 }, display: { label: 'SURGE', color: '#e0a0ff' } },
  // ---- defense
  shield: { id: 'shield', category: 'defense', maxStacks: 1, stacking: 'refresh', absorb: true, display: { label: 'SHIELD', color: '#fff0a0' } },
  // boss mechanic: Thornlings tether the Guardian while they live (boss/guardian.js) — kill / control the adds
  heartwood_ward: { id: 'heartwood_ward', category: 'buff', maxStacks: 1, stacking: 'refresh', modifiers: { damageTakenMult: 0.5 }, display: { label: 'WARDED', color: '#7af0a0' } },
  // ---- Warden of Dawn (skills/wardenOfDawn.js) — `mult` in add() data overrides the base value
  radiant_chain: { id: 'radiant_chain', category: 'defense', maxStacks: 1, stacking: 'refresh', modifiers: { damageTakenMult: 0.7 }, display: { label: 'RADIANT CHAIN', color: '#ffe08a' } },
  dawn_bastion: { id: 'dawn_bastion', category: 'defense', maxStacks: 1, stacking: 'refresh', flags: ['unshakable'], tenacity: 0.3, modifiers: { damageTakenMult: 0.75 }, display: { label: 'BASTION', color: '#ffe8b0' } },
  sanctuary: { id: 'sanctuary', category: 'defense', maxStacks: 1, stacking: 'refresh', flags: ['unshakable', 'debuffImmune'], modifiers: { damageTakenMult: 0.6 }, display: { label: 'SANCTUARY', color: '#fff4d0' } },
  guardian_march: { id: 'guardian_march', category: 'defense', maxStacks: 1, stacking: 'refresh', flags: ['unshakable'], modifiers: { damageTakenMult: 0.5 }, display: { label: 'MARCH', color: '#8ad0ff' } },
  last_light: { id: 'last_light', category: 'buff', maxStacks: 1, stacking: 'refresh', modifiers: { damageTakenMult: 0.8 }, display: { label: 'LAST LIGHT', color: '#fff0b0' } },
  shared_resolve: { id: 'shared_resolve', category: 'buff', maxStacks: 1, stacking: 'refresh', modifiers: { defenseMult: 1.3 }, display: { label: 'RESOLVE', color: '#bfe6ff' } },
  // ---- Bulwark Sentinel (skills/bulwarkSentinel.js)
  iron_bastion: { id: 'iron_bastion', category: 'defense', maxStacks: 1, stacking: 'refresh', modifiers: { damageTakenMult: 0.6, moveMult: 0.55 }, display: { label: 'IRON BASTION', color: '#e8c86a' } },
  fortified: { id: 'fortified', category: 'buff', maxStacks: 1, stacking: 'refresh', flags: ['unshakable'], modifiers: { defenseMult: 1.4, guardBlockMult: 0.5 }, aura: { color: '255,200,90', ring: 0.9, body: 0.06 }, display: { label: 'FORTIFIED', color: '#ffd24a' } },
  shieldwall: { id: 'shieldwall', category: 'defense', maxStacks: 1, stacking: 'refresh', modifiers: { damageTakenMult: 0.6 }, display: { label: 'SHIELDWALL', color: '#9ac8ff' } },
  citadel: { id: 'citadel', category: 'defense', maxStacks: 1, stacking: 'refresh', flags: ['unshakable'], modifiers: { damageTakenMult: 0.5, moveMult: 0.35, dodgeCostMult: 2, guardBlockMult: 0.5 }, aura: { color: '140,200,255', ring: 1.6, body: 0.1, motes: 1, sprite: { key: 'bs_aura', loop: [3, 4], fps: 7, scale: 0.85, lift: 0.15 } }, display: { label: 'CITADEL', color: '#ffe8a0' } },
  citadel_ward: { id: 'citadel_ward', category: 'defense', maxStacks: 1, stacking: 'refresh', modifiers: { damageTakenMult: 0.8 }, display: { label: 'WARDED', color: '#bfe0ff' } },
  iron_will: { id: 'iron_will', category: 'buff', maxStacks: 1, stacking: 'refresh', modifiers: { defenseMult: 1.5 }, display: { label: 'IRON WILL', color: '#e0b060' } },
  // ---- Oathbreaker (skills/oathbreaker.js)
  defiant_guard: { id: 'defiant_guard', category: 'buff', maxStacks: 1, stacking: 'refresh', display: { label: 'DEFIANT', color: '#c080ff' } },
  oath_of_ruin: { id: 'oath_of_ruin', category: 'buff', maxStacks: 1, stacking: 'refresh', modifiers: { damageMult: 1.25, defenseMult: 0.6, damageTakenMult: 1.15 }, aura: { color: '200,60,90', ring: 0.9, body: 0.06 }, display: { label: 'OATH OF RUIN', color: '#ff6080' } },
  forbidden_oath: { id: 'forbidden_oath', category: 'buff', maxStacks: 1, stacking: 'refresh', flags: ['unshakable'], modifiers: { damageMult: 1.15 }, aura: { color: '220,50,90', ring: 1.4, body: 0.1, motes: 1, sprite: { key: 'ok_aura', loop: [2, 4], fps: 8, scale: 0.8, lift: 0.12 } }, display: { label: 'FORBIDDEN OATH', color: '#d080ff' } },
  ruin: { id: 'ruin', category: 'debuff', maxStacks: 1, stacking: 'refresh', modifiers: { defenseMult: 0.8, damageMult: 0.9 }, display: { label: 'RUIN', color: '#b060ff' } },
  damage_reduction: { id: 'damage_reduction', category: 'defense', maxStacks: 1, stacking: 'longest', modifiers: { damageTakenMult: 0.8 }, display: { label: 'GUARD', color: '#c8d8ff' } },
};

export const STATUS_RULES = {
  maxTenacity: 0.6,   // control duration reduction cap (no permanent CC immunity from stats)
  maxDuration: 60,    // guard: nothing lasts forever by accident
  maxEvents: 64,      // queued events per entity (leak guard if nobody drains them)
};
