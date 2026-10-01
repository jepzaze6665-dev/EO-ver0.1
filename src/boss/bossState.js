// BOSS STATE MACHINE — pure: (current state, what is true right now) -> next state. No game objects inside,
// so it runs in unit tests (tools/tests/boss.test.mjs) and could run on a server. boss/bossSystem.js does the
// side effects when the state changes (spawn, arena lock, boss bar, rewards, events).
//
//   HIDDEN ──(appear requirements met)──> IDLE ──(player steps into the arena)──> ENGAGED
//   ENGAGED <──> PHASE_CHANGE (boss crossed an HP threshold; it roars, then fights on)
//   ENGAGED / PHASE_CHANGE ──(HP 0)──> DEFEATED (final, saved)   ──(player died / left)──> RESET ──> IDLE
export const BOSS_STATE = {
  HIDDEN: 'hidden', IDLE: 'idle', ENGAGED: 'engaged', PHASE_CHANGE: 'phase_change', DEFEATED: 'defeated', RESET: 'reset',
};
const S = BOSS_STATE;

// input: { alreadyDefeated, canAppear, playerInTrigger, playerAlive, entityDead, transitioning, reset }
export function nextBossState(state, i) {
  if (state === S.DEFEATED) return S.DEFEATED;
  const fighting = state === S.ENGAGED || state === S.PHASE_CHANGE;
  if (i.alreadyDefeated && !fighting) return S.DEFEATED; // killed in an earlier session (saved)
  switch (state) {
    case S.HIDDEN: return i.canAppear ? S.IDLE : S.HIDDEN;
    case S.IDLE:
      if (!i.canAppear) return S.HIDDEN;
      return i.playerInTrigger && i.playerAlive ? S.ENGAGED : S.IDLE;
    case S.ENGAGED:
    case S.PHASE_CHANGE:
      if (i.entityDead) return S.DEFEATED;
      if (i.reset) return S.RESET;
      return i.transitioning ? S.PHASE_CHANGE : S.ENGAGED;
    case S.RESET: return S.IDLE;
  }
  return state;
}
export const isFighting = (s) => s === S.ENGAGED || s === S.PHASE_CHANGE;
