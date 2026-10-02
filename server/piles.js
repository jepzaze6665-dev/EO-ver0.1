// ONLINE N9 — death piles on the server (the items themselves live in the owner's save: dungeon/runSystem.js).
// The owner's client tells where its pile lies ('pileSet' { m, x, y, n } / 'pileClear'); the server keeps that place
// (memory: the client sends it again after every login) and shows it to the owner's PARTY ('piles' { list } — pushed when it
// changes). A party member standing next to it in a dungeon run ('pileTake' { owner }) carries it: the server checks same
// party, owner online, same map, distance (presence) -> the pile is gone here and the owner gets 'pileTaken' { by } (their
// client moves the items back into the bag). Nobody else can see or take it.
import { isSharedMap } from '../src/data/online.js';
import { RUN_RULES } from '../src/data/runRules.js';
import { NET_ERROR } from '../src/net/protocol.js';

export class PileService {
  constructor(server) {
    this.server = server;
    this.piles = new Map(); // owner id -> { m, x, y, n }
    server.handle('pileSet', (s, m) => { this.piles.set(s.id, { m: m.m, x: Math.round(m.x), y: Math.round(m.y), n: m.n }); });
    server.handle('pileClear', (s) => { this.piles.delete(s.id); });
    server.handle('pileTake', (s, m) => this.take(s, m.owner));
    server.on('sessionClosed', (s) => this.piles.delete(s.id)); // an offline owner cannot receive it: hidden until they return
    this.timer = setInterval(() => this.tick(), 500);
    this.timer.unref?.();
  }

  refuse(s, text) { s.send('error', { code: NET_ERROR.party, text }); return false; }

  take(s, ownerId) {
    const pile = this.piles.get(ownerId), owner = this.server.sessions.get(ownerId);
    const party = this.server.parties.partyOf(s.id);
    if (!pile || !owner || ownerId === s.id) return this.refuse(s, 'that pile is gone');
    if (!party || !party.members.has(ownerId)) return this.refuse(s, 'only the party can carry it');
    const p = s.presence;
    if (!p || !p.room || isSharedMap(p.room) || p.m !== pile.m) return this.refuse(s, 'the pile is not here');
    if (Math.hypot(p.x - pile.x, p.y - pile.y) > RUN_RULES.helpRange) return this.refuse(s, 'too far from the pile');
    this.piles.delete(ownerId);
    owner.send('pileTaken', { by: s.name });
    s.send('partyInfo', { text: `You carried ${owner.name}'s belongings back to them` });
    return true;
  }

  // each member: the piles of the other members of their party (sent only when that list changes)
  tick() {
    for (const s of this.server.sessions.values()) {
      const party = this.server.parties.partyOf(s.id), list = [];
      if (party) for (const id of party.members.keys()) {
        const pl = id !== s.id && this.piles.get(id), o = pl && this.server.sessions.get(id);
        if (o) list.push({ owner: id, name: o.name, ...pl });
      }
      const sig = JSON.stringify(list);
      if (sig !== (s.pileSig || '[]')) { s.pileSig = sig; s.send('piles', { list }); }
    }
  }

  close() { clearInterval(this.timer); }
}
