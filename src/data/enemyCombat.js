// ENEMY COMBAT RULES (Combat 2.0 §50-51) — attack commitment and roles shared by every monster / area boss.
//
// Every enemy attack is  STARTUP (monster data `windup`, telegraphed) -> ACTIVE (the strike / dash) -> RECOVERY (`recover`).
// If the attack MISSES (nobody hit — dodged, out of range, behind it), the enemy is stuck longer in recovery and the
// player gets a Counter Window (event 'attackMissed' -> combat/counterSystem.js, reason 'whiff').
//
//  missRecoverMult     : recovery × this after a miss (an attack may set its own `missRecover`)
//  bossMissRecoverMult : the same for area bosses (data/bosses.js moves)
//  punishIdle          : default seconds a player must stand still before `punishIdle` monsters use their `punish` attack
//                        off cooldown (monster data: punishIdle: seconds, attack: punish: true)
//  flank               : monsters with `flank: true` approach from the player's side / back instead of head-on
//                        { angle: radians off the player's back, dist: px from the player, range: start flanking within }
//
// ROLES (monster data `role`, shown in the Monster Knowledge codex):
//   skirmisher : fast pressure, flanks, punishes standing still (Forest Wolf)
//   bruiser    : medium speed, slow heavy blow with a clear telegraph, long recovery when it misses (Forest Goblin)
//   tank       : high DEF + armour, slow turns, a weak point to reach (Crystal Beast / Amethyst Behemoth)
//   caster     : keeps distance, projectiles (Rune Wraith)       swarm : weak adds in numbers (Thornling)
//   future     : archer · area controller · assassin · support · summoner · disabler · shield (data only)
export const ENEMY_COMBAT = {
  missRecoverMult: 1.5,
  bossMissRecoverMult: 1.3,
  punishIdle: 1.0,
  flank: { angle: 0.7, dist: 30, range: 170 }, // dist < a bite's reach: arriving there = in range
  roles: {
    skirmisher: 'Skirmisher — fast pressure, flanks, punishes standing still',
    bruiser: 'Bruiser — slow heavy blow, clear telegraph, punish its misses',
    tank: 'Tank — armoured, slow to turn, find the weak point',
    caster: 'Caster — keeps its distance, ranged attacks',
    swarm: 'Swarm — weak alone, dangerous in numbers',
  },
};
