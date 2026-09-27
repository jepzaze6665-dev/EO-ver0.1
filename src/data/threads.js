// THREAD DATA — every thread type is described here; combat/threadSystem.js only reads these rules.
// A thread links two anchors: an entity (player, enemy, astral node) or a ground point.
// Other classes change behaviour by adding a type (lightning_thread, void_thread, healing_thread...)
// — never by writing a new thread system.
//
//  maxPerOwner  : oldest thread is replaced when exceeded
//  duration     : seconds before it fades (threadExpired)
//  maxLength    : anchor B is pulled back to this distance
//  width        : collision thickness (px) — enemies touching the line are "caught"
//  touch        : { interval, power, type, status, statusTime, mark } — what a touch does, per target
//                 (interval = per-target re-touch cooldown; the first touch also applies `mark`)
//  burst        : { power, type, width, mark } — when the thread is triggered (Thread Burst)
//  visual       : UI only
export const THREADS = {
  astral_thread: {
    id: 'astral_thread', name: 'Astral Thread',
    maxPerOwner: 3, duration: 7, maxLength: 230, width: 12,
    touch: { interval: 0.7, power: 0.35, type: 'magic', status: 'slow', statusTime: 1.2, mark: 'star_mark' },
    burst: { power: 2.3, type: 'magic', width: 30, mark: 'star_mark' },
    visual: { color: '#8ad8ff', glow: '120,200,255', core: '#f4fbff' },
  },
};

export const THREAD_RULES = {
  maxTotal: 32, // hard cap across all owners (performance / leak guard)
};
