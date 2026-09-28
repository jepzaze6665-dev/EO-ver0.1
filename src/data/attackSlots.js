// ATTACK SLOTS + ENEMY TARGETING (Combat 2.0 §64) — enemies take turns instead of all striking at once, and pick
// whom to fight from the list of players (one today; a party of up to 4 later — nothing here assumes a single player).
//
// Slots (combat/attackSlots.js): every player has `capacity` points of "being attacked right now". An enemy must hold
// points for its attack from wind-up to the end of recovery; without them it waits and repositions around the player.
//  capacity      : points per player (3 = e.g. one heavy + one normal, or three quick bites)
//  cost          : points per attack — heavy attacks (attack data `heavy`) take more
//  releaseDelay  : after an attack ends, its points come back this much later (a beat between attackers)
//  waitRange     : a waiting enemy holds at (its attack range × this) and circles instead of walking into the player
// Bosses do not use slots (they are the fight); their summoned adds do.
//
// Targeting (combat/targeting.js, pure): score = weights below, highest wins; re-picked every `retargetEvery` s.
//  taunt      : the player that taunted it (status 'taunted' source) — always wins
//  current    : stickiness to the current target (no ping-pong)
//  vulnerable : a player that is guard-broken / stunned / downed-soon
//  lowHp      : a player under 35% HP
//  ranged     : skirmishers (role) pressure ranged classes (class ratings.range >= 4)
//  perPx      : distance penalty per pixel
export const ATTACK_SLOTS = {
  capacity: 3,
  cost: { normal: 1, heavy: 2 },
  releaseDelay: 0.25,
  waitRange: 1.7,
  retargetEvery: 1.5,
  targeting: { taunt: 10000, current: 40, vulnerable: 60, lowHp: 40, ranged: 30, perPx: -0.25 },
};
