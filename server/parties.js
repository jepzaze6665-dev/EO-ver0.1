// ONLINE N4 — parties on the server (rules: ONLINE.party in src/data/online.js). Keyed by PLAYER id, not by connection,
// so a member who drops keeps their place for ONLINE.party.offlineGrace seconds and is back in the party on reconnect.
//   create / invite (leader only; inviting while not in a party creates one) / answer (accept or decline) / leave /
//   kick + lead (leader only). A leader who leaves or drops hands the lead to the longest-standing ONLINE member
//   (else the longest-standing member). Every change sends the whole party ('party') to every online member.
// Nobody is ever moved anywhere by a party: entering a dungeon together needs each member's own confirmation (N5).
import { ONLINE } from '../src/data/online.js';
import { NET_ERROR } from '../src/net/protocol.js';

export class PartyService {
  constructor(server) {
    this.server = server;
    this.parties = new Map();   // party id -> { id, leader, members: Map(playerId -> { id, name, online, offlineAt, joined }) }
    this.byPlayer = new Map();  // player id -> party id
    this.invites = new Map();   // invited player id -> Map(party id -> { from, at })
    this.counter = 0;
    this.lastSig = new Map();   // party id -> what the members last saw (map / level changes are pushed by tick)
    const H = (t, fn) => server.handle(t, (s, m) => fn.call(this, s, m));
    H('partyCreate', this.create); H('partyInvite', this.invite); H('partyAnswer', this.answer);
    H('partyLeave', (s) => this.leave(s.id, 'left')); H('partyKick', this.kick); H('partyLead', this.lead);
    server.on('sessionOpened', (s) => this.online(s));
    server.on('sessionClosed', (s) => this.offline(s));
    this.timer = setInterval(() => this.tick(), 1000);
    this.timer.unref?.();
  }

  get rules() { return ONLINE.party; }
  partyOf(playerId) { return this.parties.get(this.byPlayer.get(playerId)); }
  session(playerId) { return this.server.sessions.get(playerId); }
  refuse(s, text) { s.send('error', { code: NET_ERROR.party, text }); return false; }

  create(s) {
    if (this.partyOf(s.id)) return this.refuse(s, 'you are already in a party');
    const p = { id: 'pt' + (++this.counter).toString(36) + Date.now().toString(36).slice(-4), leader: s.id, members: new Map() };
    this.parties.set(p.id, p);
    this.addMember(p, s);
    this.dropInvites(s.id);
    this.push(p);
    return p;
  }

  invite(s, { name }) {
    let p = this.partyOf(s.id);
    if (p && this.rules.leaderInvitesOnly && p.leader !== s.id) return this.refuse(s, 'only the party leader can invite');
    const t = [...this.server.sessions.values()].find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!t) return this.refuse(s, `${name} is not online`);
    if (t.id === s.id) return this.refuse(s, 'you cannot invite yourself');
    if (this.partyOf(t.id)) return this.refuse(s, `${t.name} is already in a party`);
    if (p && p.members.size >= this.rules.maxSize) return this.refuse(s, `the party is full (${this.rules.maxSize})`);
    if (!p) p = this.create(s);
    let mine = this.invites.get(t.id);
    if (!mine) this.invites.set(t.id, (mine = new Map()));
    mine.set(p.id, { from: s.name, at: Date.now() });
    t.send('partyInvite', { party: p.id, from: s.name, size: p.members.size });
    s.send('partyInfo', { text: `Invite sent to ${t.name}` });
    return true;
  }

  answer(s, { party, yes }) {
    const inv = this.invites.get(s.id)?.get(party);
    if (!inv) return this.refuse(s, 'that invite is no longer open');
    this.invites.get(s.id).delete(party);
    const p = this.parties.get(party);
    const inviter = p && [...p.members.values()].find((m) => m.name === inv.from);
    if (!yes) { if (inviter) this.session(inviter.id)?.send('partyInfo', { text: `${s.name} declined the invite` }); return true; }
    if (!p) return this.refuse(s, 'that party no longer exists');
    if (this.partyOf(s.id)) return this.refuse(s, 'leave your party first');
    if (p.members.size >= this.rules.maxSize) return this.refuse(s, 'the party is full');
    this.addMember(p, s);
    this.dropInvites(s.id);
    this.notice(p, `${s.name} joined the party`, s.id);
    this.push(p);
    return true;
  }

  kick(s, { id }) {
    const p = this.partyOf(s.id);
    if (!p || p.leader !== s.id) return this.refuse(s, 'only the party leader can remove members');
    if (id === s.id || !p.members.has(id)) return this.refuse(s, 'not a member');
    this.session(id)?.send('partyInfo', { text: 'You were removed from the party' });
    this.leave(id, 'kicked');
    return true;
  }

  lead(s, { id }) {
    const p = this.partyOf(s.id);
    if (!p || p.leader !== s.id) return this.refuse(s, 'only the party leader can do that');
    if (!p.members.has(id) || id === s.id) return this.refuse(s, 'not a member');
    p.leader = id;
    this.notice(p, `${p.members.get(id).name} now leads the party`);
    this.push(p);
    return true;
  }

  leave(playerId, why) {
    const p = this.partyOf(playerId);
    if (!p) return;
    const m = p.members.get(playerId);
    p.members.delete(playerId);
    this.byPlayer.delete(playerId);
    this.session(playerId)?.send('party', { party: null });
    if (!p.members.size) { this.disband(p); return; }
    if (p.leader === playerId) this.passLead(p);
    this.notice(p, `${m.name} ${why === 'kicked' ? 'was removed from' : why === 'timeout' ? 'was disconnected too long and left' : 'left'} the party`);
    this.push(p);
  }

  disband(p) {
    this.parties.delete(p.id);
    this.lastSig.delete(p.id);
    for (const [who, m] of this.invites) if (m.delete(p.id)) this.session(who)?.send('partyInviteGone', { party: p.id });
  }

  passLead(p) {
    const ms = [...p.members.values()].sort((a, b) => a.joined - b.joined);
    const next = ms.find((m) => m.online) || ms[0];
    if (next) p.leader = next.id;
  }

  addMember(p, s) {
    p.members.set(s.id, { id: s.id, name: s.name, online: true, offlineAt: 0, joined: Date.now() + p.members.size / 1000 });
    this.byPlayer.set(s.id, p.id);
  }

  dropInvites(playerId) {
    const mine = this.invites.get(playerId);
    if (!mine) return;
    for (const id of mine.keys()) this.session(playerId)?.send('partyInviteGone', { party: id });
    this.invites.delete(playerId);
  }

  online(s) {
    const p = this.partyOf(s.id);
    if (!p) return;
    const m = p.members.get(s.id);
    m.online = true; m.offlineAt = 0; m.name = s.name;
    this.notice(p, `${s.name} is back online`, s.id);
    this.push(p);
  }

  offline(s) {
    this.invites.delete(s.id);
    const p = this.partyOf(s.id);
    if (!p) return;
    const m = p.members.get(s.id);
    m.online = false; m.offlineAt = Date.now();
    if (p.leader === s.id) this.passLead(p);
    this.push(p);
  }

  view(p) {
    return {
      id: p.id, leader: p.leader, max: this.rules.maxSize,
      members: [...p.members.values()].sort((a, b) => a.joined - b.joined).map((m) => {
        const pr = this.session(m.id)?.presence;
        return { id: m.id, name: m.name, online: m.online, c: pr?.c || null, l: pr?.l || null, m: m.online ? pr?.m || null : null };
      }),
    };
  }

  push(p) {
    const v = this.view(p);
    this.lastSig.set(p.id, JSON.stringify(v));
    for (const m of p.members.values()) if (m.online) this.session(m.id)?.send('party', { party: v });
  }

  notice(p, text, except) { for (const m of p.members.values()) if (m.online && m.id !== except) this.session(m.id)?.send('partyInfo', { text }); }

  tick() {
    const now = Date.now(), R = this.rules;
    for (const [who, mine] of this.invites) {
      for (const [id, inv] of mine) if (now - inv.at > R.inviteTimeout * 1000) { mine.delete(id); this.session(who)?.send('partyInviteGone', { party: id }); }
      if (!mine.size) this.invites.delete(who);
    }
    for (const p of [...this.parties.values()]) {
      for (const m of [...p.members.values()]) if (!m.online && now - m.offlineAt > R.offlineGrace * 1000) this.leave(m.id, 'timeout');
      if (this.parties.has(p.id) && JSON.stringify(this.view(p)) !== this.lastSig.get(p.id)) this.push(p); // map / level changed
    }
  }

  close() { clearInterval(this.timer); }
}
