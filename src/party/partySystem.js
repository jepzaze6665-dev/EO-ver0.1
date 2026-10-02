import { PARTY } from '../data/party.js';

// PARTY SYSTEM (Combat 2.0 §58, §63) — the list of players in this world and what happens when one falls.
//   members            : the players (solo = [player]); game.players() returns the living-or-downed ones
//   onDefeated(p)      : 0 HP -> DOWNED (teammates alive) or ENCOUNTER FAILED (nobody left standing)
//   revive progress    : a teammate holding [E] next to a downed member (update(dt)); a hit on the reviver
//                        interrupts it; the downed member bleeds out after PARTY.downed.bleedOut seconds
// Events: playerDowned · reviveStarted · reviveInterrupted · playerRevived · playerBledOut · encounterFailed
// Rules: data/party.js. Knows nothing about classes, maps or bosses (Game.respawn resets the encounter).
export class PartySystem {
  constructor(game, rules = PARTY) {
    this.game = game;
    this.rules = rules;
    this.members = [];
    this.revives = new Map(); // downed member -> { reviver, t }
    this.failed = false;
    // ONLINE: teammates on other clients (net/netRevive.js) — counted as standing, never simulated here
    this.allies = null; // () => number of standing remote teammates
    game.events.on('damageTaken', (e) => { for (const [target, r] of this.revives) if (e.target === r.reviver && e.amount > 0) this.interrupt(target, 'hit'); });
  }
  add(p) {
    if (!p || this.members.includes(p) || this.members.length >= this.rules.maxSize) return false;
    this.members.push(p);
    return true;
  }
  remove(p) { this.members = this.members.filter((m) => m !== p); this.revives.delete(p); }
  standing() { return this.members.filter((m) => !m.dead && !m.downed); }
  alliesStanding() { return this.allies ? this.allies() : 0; }

  // a member reached 0 HP -> 'downed' | 'failed'
  onDefeated(p) {
    const g = this.game;
    if (this.standing().some((m) => m !== p) || this.alliesStanding() > 0) {
      p.downed = true; p.downedT = 0; p.dead = false; p.hp = 0;
      g.events.emit('playerDowned', { player: p });
      return 'downed';
    }
    p.dead = true;
    this.fail();
    return 'failed';
  }
  fail() {
    if (this.failed) return;
    this.failed = true;
    for (const m of this.members) { if (m.downed) { m.downed = false; m.dead = true; } }
    this.revives.clear();
    this.game.events.emit('encounterFailed', { members: this.members.slice() });
  }
  // back at the checkpoint (Game.respawn): everyone stands up
  reset() {
    this.failed = false;
    this.revives.clear();
    for (const m of this.members) { m.downed = false; m.downedT = 0; }
  }

  // ---- revive
  downedNear(reviver) {
    const R = this.rules.downed.reviveRange;
    return this.members.find((m) => m !== reviver && m.downed && Math.hypot(m.x - reviver.x, m.y - reviver.y) <= R) || null;
  }
  // called every frame for each reviver that is holding the revive input (local input today, network later)
  tryRevive(reviver, dt) {
    const target = this.downedNear(reviver);
    if (!target || reviver.dead || reviver.downed) return null;
    let r = this.revives.get(target);
    if (!r || r.reviver !== reviver) { r = { reviver, t: 0 }; this.revives.set(target, r); this.game.events.emit('reviveStarted', { reviver, target }); }
    r.t += dt;
    r.held = true;
    if (r.t >= this.rules.downed.reviveTime) this.revive(target, reviver);
    return target;
  }
  interrupt(target, reason) {
    const r = this.revives.get(target);
    if (!r) return;
    this.revives.delete(target);
    this.game.events.emit('reviveInterrupted', { reviver: r.reviver, target, reason });
  }
  revive(target, reviver) {
    this.revives.delete(target);
    target.downed = false; target.downedT = 0;
    target.hp = Math.max(1, Math.round(target.maxHp * this.rules.downed.reviveHp));
    target.invulnT = Math.max(target.invulnT || 0, 1.5);
    this.game.events.emit('playerRevived', { target, reviver });
  }
  progress(target) { const r = this.revives.get(target); return r ? r.t / this.rules.downed.reviveTime : 0; }

  update(dt) {
    for (const m of this.members) {
      if (!m.downed) continue;
      m.downedT += dt;
      if (m.downedT >= this.rules.downed.bleedOut) {
        m.downed = false; m.dead = true; this.revives.delete(m);
        this.game.events.emit('playerBledOut', { player: m });
        // nobody standing here and (no online teammate up, or it is OUR player: our encounter ends, theirs goes on)
        if (!this.standing().length && (!this.alliesStanding() || m === this.game.player)) this.fail();
      }
    }
    // a revive only continues while the reviver keeps holding it (tryRevive marks it each frame)
    for (const [target, r] of this.revives) { if (!r.held) this.interrupt(target, 'released'); else r.held = false; }
  }
}
