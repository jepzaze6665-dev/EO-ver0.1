// SUMMON DATA — every summon type is described here; combat/summonSystem.js only reads these rules.
// A summon is owned by an entity (the player today, party members / monsters tomorrow), follows it and
// acts on a timer. WHAT it does (attacks, echoes of skills) is class code reacting to summon events.
//
//  duration     : seconds before it fades (summonExpired, reason 'timeout')
//  maxPerOwner  : oldest one is replaced when exceeded
//  powerMult    : damage share of its owner's hits (class code multiplies its hitbox power by it)
//  follow       : { dist, angle, speed } — stays `dist` px from the owner at `angle` rad from the owner's facing
//  act          : { interval } — emits summonReady every `interval` s while it is not busy
//  visual       : UI only (drawn with the owner's sprites in the owner's ghost colour)
export const SUMMONS = {
  // Nightfall Reaper: a shadow copy of the Reaper (Shadow Doppel, Funeral Eclipse)
  shadow_doppel: {
    id: 'shadow_doppel', name: 'Shadow Doppel',
    duration: 8, maxPerOwner: 1, powerMult: 0.4,
    follow: { dist: 34, angle: 2.4, speed: 8 },
    act: { interval: 1.1 },
    visual: { alpha: 0.72, glow: 0.35 },
  },
};

export const SUMMON_RULES = {
  maxTotal: 12, // hard cap across all owners (performance / leak guard)
};
