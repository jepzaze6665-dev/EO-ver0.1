// ONLINE — revive across clients (game.online.revive). The in-world PartySystem (party/partySystem.js) only knows the
// players of THIS client; in a run the other members live on other clients. So:
//   - allies(): the members of our run map (presence stream: HP share h, downed flag dn) — the party counts the standing
//     ones, so falling with a teammate up = DOWNED (revivable), not ENCOUNTER FAILED (PartySystem `allies` hook)
//   - a downed player sends h 0 + dn and shows lying down on every screen (anim 'death', progress 1)
//   - hold [E] next to a downed teammate for PARTY.downed.reviveTime: a hit on you or letting go resets it; done ->
//     'revive' { to } — the SERVER checks you share the run map, the target is downed and close, then sends it 'revived'
//   - 'revived' { by } on the downed client = PartySystem.revive (HP PARTY.downed.reviveHp, short i-frames)
import { PARTY } from '../data/party.js';

export class NetRevive {
  constructor(session) {
    this.session = session;
    this.target = null; this.t = 0; this.lastHold = -1; this.lastHp = null;
    session.net.on('revived', (m) => this.onRevived(m));
  }
  get game() { return this.session.game; }

  // run-map teammates as { name, downed, dead } (empty outside a run room)
  allies() {
    const s = this.session, w = this.game.world;
    if (!s.online || !s.instance || !w || !s.remotes.here(w.mapId)) return [];
    return s.remotes.list.filter((r) => !r.leaving).map((r) => ({ id: r.id, name: r.name, downed: !!r.dn, dead: (r.h ?? 1) <= 0 && !r.dn }));
  }
  standingAllies() { return this.allies().filter((a) => !a.downed && !a.dead).length; }

  // a downed teammate (remote) within reach of p
  near(p) {
    const s = this.session, w = this.game.world, R = PARTY.downed.reviveRange;
    if (!s.online || !s.instance || !s.remotes.here(w.mapId) || p.dead || p.downed) return null;
    return s.remotes.list.find((r) => !r.leaving && r.dn && Math.hypot(r.x - p.x, r.y - p.y) <= R) || null;
  }

  // every game step [E] is held (Player input) and no local downed member is closer. A gap in holding (game time, not
  // rendered frames), a hit on the reviver or another target resets it.
  hold(p, dt) {
    const r = this.near(p), now = this.game.time;
    if (!r) { this.target = null; this.t = 0; return; }
    const broken = this.target !== r.id || now - this.lastHold > 0.15 || (this.lastHp !== null && p.hp < this.lastHp);
    if (broken) { this.target = r.id; this.t = 0; }
    this.lastHold = now; this.lastHp = p.hp;
    this.t += dt;
    if (this.t >= PARTY.downed.reviveTime) {
      this.session.net.send('revive', { to: r.id });
      this.t = 0; this.target = null;
    }
  }
  progress() { return this.target && this.game.time - this.lastHold <= 0.15 ? Math.min(1, this.t / PARTY.downed.reviveTime) : 0; }

  onRevived({ by }) {
    const g = this.game, p = g.player;
    if (!p || !p.downed || !g.party) return;
    g.party.revive(p, { name: by, remote: true });
    g.ui.banner('REVIVED', `${by} pulled you back up`, '#8af0a0', 2.5);
    g.audio.sfx('levelup');
  }
}
