// RUN SUMMARY online — every member of a run sends its own run stats (damage / healing / falls / kills, from game.run.stats)
// every 2 s while in a run and once more right before banking; the server relays them to the run's members ('runStat').
// game.online.runStats.table() = the members' latest rows for the summary screen (yours first).
export class NetRunStats {
  constructor(session) {
    this.s = session;
    this.rows = new Map(); // playerId -> { name, s, at }
    this.t = 0;
    const n = session.net;
    n.on('welcome', () => this.rows.clear());
    n.on('runStat', (m) => { if (m && m.from && m.s) this.rows.set(m.from, { name: m.name || m.from, s: m.s, at: Date.now() }); });
  }
  mine() {
    const st = this.s.game.run && this.s.game.run.stats;
    return st ? { dmg: Math.round(st.dmg), heal: Math.round(st.heal), deaths: st.deaths, kills: st.kills } : null;
  }
  send() { const s = this.mine(); if (s && this.s.instance) this.s.net.send('runStat', { s }); }
  update(dt) {
    if (!this.s.instance) return;
    this.t -= dt;
    if (this.t <= 0) { this.t = 2; this.send(); }
  }
  // rows for the summary: members of the run (instance member names) with their latest stats; class / level from the party
  table() {
    const s = this.s, me = s.playerId, party = s.party ? s.party.members : [];
    const out = [];
    for (const [id, r] of this.rows) {
      if (id === me) continue;
      const pm = party.find((m) => m.id === id) || {};
      out.push({ id, name: r.name, c: pm.c || null, l: pm.l || null, ...r.s });
    }
    return out;
  }
  clear() { this.rows.clear(); }
}
