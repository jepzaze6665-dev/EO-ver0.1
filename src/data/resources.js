// RESOURCE DATA — every class resource is described here, never inside the core.
// The ResourcePool (combat/resourceSystem.js) reads these rules; it does not know which
// class owns a resource. Adding Storm Charge / Void Ink / Guard Gauge = add an entry.
//
//  max, start          : capacity and value on spawn / respawn
//  regen               : per second, { inCombat, outOfCombat }
//  decay               : per second after `delay` seconds without gaining, { inCombat, outOfCombat, delay }
//  gainStat            : character stat that multiplies normal (non-raw) gains, e.g. shadowGain
//  tiers               : optional [{ at, label, stats }] — while the value is >= `at`, the holder gets `stats`
//                        added to its stats (highest tier only). The Player re-computes stats when the tier changes.
//  label / colors      : display only (UI reads them; gameplay never does)
export const RESOURCES = {
  shadow_gauge: {
    id: 'shadow_gauge', name: 'Shadow Gauge', label: 'SHADOW',
    max: 100, start: 40, respawn: 50,
    regen: { inCombat: 0, outOfCombat: 4 },
    decay: { inCombat: 0, outOfCombat: 0, delay: 0 },
    gainStat: 'shadowGain',
    colors: ['#b070ff', '#4a1a90'],
  },
  // Aegis Guardian: built by blocking (guard) and being hit by taunted foes, spent on protection
  guard_gauge: {
    id: 'guard_gauge', name: 'Guard Gauge', label: 'GUARD',
    max: 100, start: 0, respawn: 0,
    regen: { inCombat: 0, outOfCombat: 0 },
    decay: { inCombat: 0, outOfCombat: 8, delay: 4 },
    gainStat: 'guardGain',
    colors: ['#ffd070', '#8a6a20'],
  },
  // Nightfall Reaper: built by kills, shadow skills, combos and mark explosions; the higher it is, the
  // stronger the Reaper (tiers). Funeral Eclipse spends it all. Fades out of combat.
  nightfall_gauge: {
    id: 'nightfall_gauge', name: 'Nightfall Gauge', label: 'NIGHT',
    max: 100, start: 0, respawn: 0,
    regen: { inCombat: 0, outOfCombat: 0 },
    decay: { inCombat: 0, outOfCombat: 6, delay: 4 },
    gainStat: 'nightfallGain',
    tiers: [
      { at: 50, label: 'DUSK', stats: { shadowDmg: 0.1, aoe: 0.1 } },
      { at: 80, label: 'NIGHTFALL', stats: { shadowDmg: 0.2, aoe: 0.2, crit: 0.1, critDmg: 0.2 } },
    ],
    colors: ['#9a5cff', '#2a0c55'],
  },
  // Phase 6 (Astral Weaver) — defined now so the pool is proven to be class-agnostic.
  astral_charge: {
    id: 'astral_charge', name: 'Astral Charge', label: 'ASTRAL',
    max: 100, start: 0, respawn: 0,
    regen: { inCombat: 0, outOfCombat: 0 },
    decay: { inCombat: 0, outOfCombat: 10, delay: 3 },
    gainStat: 'astralGain',
    colors: ['#8ad8ff', '#2a4a9a'],
  },
};
