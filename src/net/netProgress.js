// ONLINE N8 — the client side of server-owned progression (server/progress.js). game.online.progress
//   - when a boss dies and WE host that run map (solo run = always), tell the server: 'bossKill' { boss }. Guests see the
//     host's puppet die and complete the fight locally (net/bossSync.js); only the host's report counts on the server.
//   - the server's list of our defeated bosses ('progress' on login / New Game, 'bossCredit' per kill) is the truth:
//     any boss on it that this game does not know yet is recorded (worldProgress.defeatBoss = unlocks, no rewards —
//     the rewards are paid where the fight was seen: boss/bossSystem.js complete()).
// DEV offline (?offline): nothing is sent, the save decides as before.
export class NetProgress {
  constructor(session) {
    this.s = session;
    this.bosses = new Set(); // the server's defeated bosses for us
    this.known = false;      // a 'progress' arrived for this login
    this.checkT = 0;
    const n = session.net;
    n.on('welcome', () => { this.known = false; this.bosses.clear(); });
    n.on('progress', (m) => { this.bosses = new Set(m.bosses || []); this.known = true; this.merge(); });
    n.on('bossCredit', (m) => { this.bosses.add(m.boss); this.merge(); });
  }
  // every game session has a fresh event bus (Game.setupSession -> wireEvents calls this)
  wire(ev) { ev.on('bossDefeated', (e) => this.report(e.bossId)); }

  // we host the fight's run map (MobSync: host + a run room)
  hosting() { const s = this.s, M = s.mobs; return s.online && M.host && !!M.room && M.room.includes(':'); }
  report(bossId) { if (bossId && this.hosting()) this.s.net.send('bossKill', { boss: bossId }); }

  // New Game: the old character's kills must not come back before the server's empty list arrives
  clear() { this.bosses.clear(); }

  // record every server kill the game is missing (only while a character is loaded)
  merge() {
    const g = this.s.game, wp = g.worldProgress;
    if (!this.known || g.state !== 'play' || !g.player || !wp) return 0;
    let n = 0;
    for (const id of this.bosses) if (!wp.isBossDefeated(id) && g.bosses.get(id)) { wp.defeatBoss(id); n++; }
    return n;
  }
  // a save loaded after the list arrived: checked once a second
  update() { const t = Date.now(); if (t >= this.checkT) { this.checkT = t + 1000; this.merge(); } }
}
