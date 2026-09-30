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
  // Duskrunner: a still afterimage left where Mirage Shift was cast; recasting the skill returns you to it.
  // No follow / act: it only marks a place (the duration = the recast window).
  mirage: {
    id: 'mirage', name: 'Mirage',
    duration: 3, maxPerOwner: 1, powerMult: 0.5,
    visual: { alpha: 0.5, glow: 0.5 },
  },
  // Blade of Echoes: the spot Rewind Edge remembers (a still crimson afterimage; duration = the rewind window)
  rewind_mark: {
    id: 'rewind_mark', name: 'Rewind Point',
    duration: 4, maxPerOwner: 1, powerMult: 0,
    visual: { alpha: 0.35, glow: 0.55 },
  },
  // Blade of Echoes ultimate: a crimson copy that REPLAYS the recorded actions in order (class code drives it)
  echo_self: {
    id: 'echo_self', name: 'Echo of Recollection',
    duration: 4, maxPerOwner: 1, powerMult: 0.8,
    visual: { alpha: 0.7, glow: 0.5 },
  },
  // Void Scribe: a void phantom written by Phantom Quill (class code moves it and makes it strike; visual.sprite = drawn
  // from the vs_phantom VFX strip, not as a copy of the caster). Max 3 (the ultimate adds one on top of Phantom Quill's 2)
  void_phantom: {
    id: 'void_phantom', name: 'Void Phantom',
    duration: 10, maxPerOwner: 3, powerMult: 1,
    act: { interval: 1.1 },
    visual: { alpha: 0.85, glow: 0.3, sprite: { key: 'vs_phantom', frame: 3, scale: 0.55, lift: 0.08 } },
  },
};

export const SUMMON_RULES = {
  maxTotal: 12, // hard cap across all owners (performance / leak guard)
};
