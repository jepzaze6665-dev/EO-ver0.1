// ONLINE N9 — death piles online (server/piles.js). game.online.piles = party members' piles from the server
// (dungeon/runSystem.js sync() turns them into 'deathPile' interactables); our own pile's place is sent when it changes
// (and again after every login); a member carrying ours = 'pileTaken' -> game.run.recover(by).
export class NetPiles {
  constructor(session) {
    this.s = session;
    this.list = [];
    this.sentKey = null;
    const n = session.net;
    n.on('welcome', () => { this.sentKey = null; this.list = []; });
    n.on('piles', (m) => { this.list = Array.isArray(m.list) ? m.list : []; });
    n.on('pileTaken', (m) => { const g = session.game; if (g.run) g.run.recover(m.by); this.sentKey = null; });
  }
  update() {
    const g = this.s.game, pile = g.run && g.run.pile;
    const key = pile ? `${pile.map}:${pile.x}:${pile.y}:${g.run.pileCount()}` : 'none';
    if (key === this.sentKey) return;
    const ok = pile ? this.s.net.send('pileSet', { m: pile.map, x: Math.max(0, pile.x), y: Math.max(0, pile.y), n: g.run.pileCount() }) : this.s.net.send('pileClear', {});
    if (ok) this.sentKey = key;
  }
}
