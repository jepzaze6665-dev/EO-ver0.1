// STATUS DATA — every status effect is described here; status/status.js only reads these rules.
// Skills never hardcode what a status does: they call  entity.status.add('burn', 4, { source, damage })
//
//  category   : 'control' | 'debuff' | 'buff' | 'dot' | 'defense'   (control durations shrink with `tenacity`)
//  maxStacks  : cap (1 = no stacking)
//  stacking   : 'longest' -> keep the longer remaining duration (default)
//               'refresh' -> every application resets the duration
//               'stack'   -> +1 stack per application, duration refreshed
//  modifiers  : moveMult / damageMult (dealt) / damageTakenMult — multiplied per stack when perStack
//               values in `data` passed to add() (e.g. { mult: 1.3 }) override `mult`
//  flags      : cannotAct (no move/attack/skill), cannotMove, cannotCast (no skills),
//               stealth (monsters lose track / hold their attacks), taunted (monster must chase its taunter)
//  dot        : { interval, damage, type } — damage per tick per stack (data.damage overrides)
//  absorb     : shield — data.amount points of damage absorbed before HP
//  vulnerable : target takes the weak-window bonus from combat/damageSystem.js
//  display    : UI only (short label + colour)
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
  curse: { id: 'curse', category: 'debuff', maxStacks: 3, stacking: 'stack', perStack: true, modifiers: { damageTakenMult: 1.06 }, display: { label: 'CURSE', color: '#d070ff' } },
  // ---- damage over time
  burn: { id: 'burn', category: 'dot', maxStacks: 3, stacking: 'stack', dot: { interval: 0.5, damage: 3, type: 'fire' }, display: { label: 'BURN', color: '#ff9a40' } },
  poison: { id: 'poison', category: 'dot', maxStacks: 5, stacking: 'stack', dot: { interval: 1, damage: 4, type: 'poison' }, display: { label: 'POISON', color: '#90e050' } },
  // ---- buffs
  haste: { id: 'haste', category: 'buff', maxStacks: 1, stacking: 'longest', modifiers: { moveMult: 1.25 }, display: { label: 'HASTE', color: '#9af8ff' } },
  counter_ready: { id: 'counter_ready', category: 'buff', maxStacks: 1, stacking: 'refresh', display: { label: 'COUNTER READY', color: '#ffd070' } },
  // stealth + the next hit deals +60% (the hit itself ends it — see the class that grants it)
  veiled: { id: 'veiled', category: 'buff', maxStacks: 1, stacking: 'refresh', flags: ['stealth'], modifiers: { moveMult: 1.2, damageMult: 1.6 }, display: { label: 'VEILED', color: '#c8a0ff' } },
  surge: { id: 'surge', category: 'buff', maxStacks: 1, stacking: 'longest', modifiers: { damageMult: 1.15 }, display: { label: 'SURGE', color: '#e0a0ff' } },
  // ---- defense
  shield: { id: 'shield', category: 'defense', maxStacks: 1, stacking: 'refresh', absorb: true, display: { label: 'SHIELD', color: '#fff0a0' } },
  // boss mechanic: Thornlings tether the Guardian while they live (boss/guardian.js) — kill / control the adds
  heartwood_ward: { id: 'heartwood_ward', category: 'buff', maxStacks: 1, stacking: 'refresh', modifiers: { damageTakenMult: 0.5 }, display: { label: 'WARDED', color: '#7af0a0' } },
  damage_reduction: { id: 'damage_reduction', category: 'defense', maxStacks: 1, stacking: 'longest', modifiers: { damageTakenMult: 0.8 }, display: { label: 'GUARD', color: '#c8d8ff' } },
};

export const STATUS_RULES = {
  maxTenacity: 0.6,   // control duration reduction cap (no permanent CC immunity from stats)
  maxDuration: 60,    // guard: nothing lasts forever by accident
  maxEvents: 64,      // queued events per entity (leak guard if nobody drains them)
};
