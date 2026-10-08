// ONLINE H3a — the server checks every hit a player reports on a monster / boss ('mobHit') before the room host gets it.
// A browser still computes its own damage (H3b will move that to the server), so this is a LIMIT, not a calculation:
//   per hit    : at most COMBAT_GUARD.perHit × the strongest class's base attack at the player's SERVER level (economy ledger)
//                -> a bigger number is cut down to that
//   per second : at most COMBAT_GUARD.perSecond × that attack in total -> the rest of that second's hits are dropped
//   hit rate   : at most COMBAT_GUARD.hitsPerSecond hits a second -> extra hits dropped
// The limits come from measurements of honest play (every class at LV 50 vs Varkharon, gear builds vs the Guardian, A1 packs):
// biggest hit 33×, most in a second 41×, most hits a second 24 — the limits leave ~2.5× room, so only cheating is cut.
// The class is not trusted (a player could claim another one): the strongest class at that level sets the limit.
import { CLASSES } from '../src/skills/classes.js';
import { levelStats } from '../src/progression/experience.js';

export const COMBAT_GUARD = { perHit: 80, perSecond: 120, hitsPerSecond: 60, logEvery: 10 };

const attackCache = new Map();
export function baseAttack(level) {
  if (!attackCache.has(level)) attackCache.set(level, Math.max(...Object.values(CLASSES).map((c) => (c.base.atk || 0) + ((levelStats(c.perLevel || {}, level) || {}).atk || 0))));
  return attackCache.get(level);
}

export class CombatGuard {
  constructor(server) { this.server = server; this.stats = { cut: 0, dropped: 0 }; }
  level(s) { return this.server.economy ? this.server.economy.get(s.id).level : 1; }

  // -> the hit to pass on (maybe cut down) or null (dropped)
  check(s, m) {
    const G = COMBAT_GUARD, atk = baseAttack(this.level(s)), now = Date.now();
    const w = s.guard || (s.guard = { at: now, dmg: 0, hits: 0, logged: 0, cut: 0, dropped: 0 });
    if (now - w.at >= 1000) { w.at = now; w.dmg = 0; w.hits = 0; }
    if (++w.hits > G.hitsPerSecond) return this.flag(s, w, 'dropped', 'too many hits');
    let dmg = m.dmg;
    if (dmg > atk * G.perHit) { dmg = Math.floor(atk * G.perHit); this.flag(s, w, 'cut', `hit ${m.dmg} > ${dmg}`); }
    if (w.dmg + dmg > atk * G.perSecond) return this.flag(s, w, 'dropped', 'too much damage this second');
    w.dmg += dmg;
    const ad = typeof m.ad === 'number' ? Math.min(m.ad, Math.floor(atk * G.perHit)) : m.ad; // armour damage: same limit
    return dmg === m.dmg && ad === m.ad ? m : { ...m, dmg, ad };
  }
  flag(s, w, kind, why) {
    w[kind]++; this.stats[kind]++;
    if (Date.now() - w.logged > COMBAT_GUARD.logEvery * 1000) { w.logged = Date.now(); this.server.log.info?.(`[server] combat guard: ${s.name} ${why} (cut ${w.cut}, dropped ${w.dropped})`); }
    return null;
  }
}
