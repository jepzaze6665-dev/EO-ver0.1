// RESOURCE DATA — every class resource is described here, never inside the core.
// The ResourcePool (combat/resourceSystem.js) reads these rules; it does not know which
// class owns a resource. Adding Storm Charge / Void Ink / Guard Gauge = add an entry.
//
//  max, start          : capacity and value on spawn / respawn
//  regen               : per second, { inCombat, outOfCombat, delay? } — delay = seconds after the last spend before it regens
//  decay               : per second after `delay` seconds without gaining, { inCombat, outOfCombat, delay }
//  gainStat            : character stat that multiplies normal (non-raw) gains, e.g. shadowGain
//  tiers               : optional [{ at, label, stats }] — while the value is >= `at`, the holder gets `stats`
//                        added to its stats (highest tier only). The Player re-computes stats when the tier changes.
//  label / colors      : display only (UI reads them; gameplay never does)
export const RESOURCES = {
  // COMBAT 2.0 — every character's decision resource (not a class resource): dodge, guard, parry, some skills.
  // Costs live in data/stamina.js. Basic attacks never use it.
  stamina: {
    id: 'stamina', name: 'Stamina', label: 'STAMINA',
    max: 100, start: 100, respawn: 100,
    regen: { inCombat: 30, outOfCombat: 60, delay: 0.6 },
    decay: { inCombat: 0, outOfCombat: 0, delay: 0 },
    colors: ['#7fe08a', '#1f6a2c'],
  },
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
  // Duskrunner: MOMENTUM — built by moving: dodges, dashes, hits, Perfect Dodges, combos. It drains while you stand
  // still in a fight (class tick: duskrunner.momentum.idle*) and a heavy hit knocks a chunk off; fades out of combat.
  // The tiers are the passive ENDLESS MOTION: faster attacks, faster feet, cheaper dodges, shorter cooldowns.
  momentum: {
    id: 'momentum', name: 'Momentum', label: 'MOMENTUM',
    max: 100, start: 0, respawn: 0,
    regen: { inCombat: 0, outOfCombat: 0 },
    decay: { inCombat: 0, outOfCombat: 20, delay: 1.5 },
    gainStat: 'momentumGain',
    tiers: [
      { at: 30, label: 'FLOW', stats: { attackSpeed: 0.1, speed: 8 } },
      { at: 60, label: 'RUSH', stats: { attackSpeed: 0.2, speed: 16, physicalDmg: 0.1, dodgeCostCut: 0.25, cdr: 0.1 } },
      { at: 100, label: 'MAX MOMENTUM', stats: { attackSpeed: 0.3, speed: 24, physicalDmg: 0.2, dodgeCostCut: 0.4, cdr: 0.2, crit: 0.1 } },
    ],
    colors: ['#5ab8ff', '#123a7a'],
  },
  // Blade of Echoes: ECHO — the pain and the blows it remembers. Built by TAKING hits, perfect counters and echo
  // skills; spent on Crimson Memory / Rewind heal / the ultimate. Tiers = passive PAIN REMEMBERS (echoPower is read by
  // the class: counter + echo damage). Fades out of combat.
  echo: {
    id: 'echo', name: 'Echo', label: 'ECHO',
    max: 100, start: 0, respawn: 0,
    regen: { inCombat: 0, outOfCombat: 0 },
    decay: { inCombat: 0, outOfCombat: 8, delay: 4 },
    gainStat: 'echoGain',
    tiers: [
      { at: 50, label: 'RESONANCE', stats: { echoPower: 0.25 } },
      { at: 90, label: 'FULL MEMORY', stats: { echoPower: 0.5, crit: 0.1 } },
    ],
    colors: ['#ff4a5a', '#5a0c16'],
  },
  // Warden of Dawn: DAWNLIGHT — built by guarding (block / perfect guard), your barriers soaking blows, a chained ally
  // being hit and casting support skills (gains per source are capped by the class); spent on Dawn Shield, Dawn Bastion,
  // Grace of Dawn and the ultimate. Slowly fades in a fight when unused, faster outside it. Tier RADIANT = stronger barriers.
  dawnlight: {
    id: 'dawnlight', name: 'Dawnlight', label: 'DAWN',
    max: 100, start: 0, respawn: 0,
    regen: { inCombat: 0, outOfCombat: 0 },
    decay: { inCombat: 1.5, outOfCombat: 8, delay: 6 },
    gainStat: 'dawnGain',
    tiers: [{ at: 60, label: 'RADIANT', stats: { barrierPower: 0.2 } }],
    colors: ['#ffe08a', '#6a5a20'],
  },
  // Bulwark Sentinel: BASTION — built by blocking, taking hits (more inside Iron Bastion), perfect guards and taunting
  // (per-source caps in the class). At 70 the Bulwark becomes FORTIFIED (class code: status 'fortified', drains
  // Bastion while it lasts, ends at 10 or after 8 s, then 6 s before it can start again). Spent by Shieldwall and the
  // ultimate. Fades slowly in a fight when nothing feeds it.
  bastion: {
    id: 'bastion', name: 'Bastion', label: 'BASTION',
    max: 100, start: 0, respawn: 0,
    regen: { inCombat: 0, outOfCombat: 0 },
    decay: { inCombat: 2, outOfCombat: 10, delay: 5 },
    gainStat: 'bastionGain',
    colors: ['#f0c850', '#5a4414'],
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
