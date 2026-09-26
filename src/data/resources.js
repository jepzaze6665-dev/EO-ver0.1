// RESOURCE DATA — every class resource is described here, never inside the core.
// The ResourcePool (combat/resourceSystem.js) reads these rules; it does not know which
// class owns a resource. Adding Storm Charge / Void Ink / Guard Gauge = add an entry.
//
//  max, start          : capacity and value on spawn / respawn
//  regen               : per second, { inCombat, outOfCombat }
//  decay               : per second after `delay` seconds without gaining, { inCombat, outOfCombat, delay }
//  gainStat            : character stat that multiplies normal (non-raw) gains, e.g. shadowGain
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
