// MARK DATA — every mark is described here; combat/markSystem.js only reads these rules.
//
//  maxStacks          : cap
//  duration           : seconds before the whole mark expires (null = no timer)
//  refreshOnStack     : adding a stack resets the duration timer
//  idleDecay          : { delay, step, outOfCombatOnly } — lose 1 stack every `step` s after `delay` s without new stacks
//  onMax              : 'hold'    -> stays at max until a skill consumes it (emits markFull)
//                       'trigger' -> consumed automatically at max (emits markTriggered; class code reacts)
//  clearOnDeath       : remove from the holder when it dies
//  display            : UI only
export const MARKS = {
  shadow_mark: {
    id: 'shadow_mark', name: 'Shadow Mark', maxStacks: 3, duration: null, refreshOnStack: false,
    idleDecay: { delay: 12, step: 2.5, outOfCombatOnly: true },
    onMax: 'hold', clearOnDeath: true, tags: ['self', 'burst'],
    display: { color: '#c080ff', full: '#f0c8ff' },
  },
  // Phase 6 (Astral Weaver): placed on enemies, 3 stacks -> Constellation Break
  star_mark: {
    id: 'star_mark', name: 'Star Mark', maxStacks: 3, duration: 6, refreshOnStack: true,
    idleDecay: null, onMax: 'trigger', clearOnDeath: true, tags: ['enemy', 'astral'],
    display: { color: '#8ad8ff', full: '#e8f8ff' },
  },
};
