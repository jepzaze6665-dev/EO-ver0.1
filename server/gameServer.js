// ONLINE N1 — the game server: connections -> sessions. Every client frame is validated (src/net/protocol.js) before
// anything reads it; one bad client never crashes the server (each message runs inside try / catch).
//   socket -> 'hello' (within NET_LIMITS.helloTimeout) -> DevAccounts.login -> session (one per player: a second login
//   of the same player closes the old socket with 'replaced', so a player entity is never duplicated).
// Later phases add message handlers with `on(type, fn(session, msg))` and react to 'sessionOpened' / 'sessionClosed'.
import { EventEmitter } from 'events';
import { acceptUpgrade } from './ws.js';
import { Accounts } from './accounts.js';
const CHAR_SLOTS = 3; // characters per account (owner)
import { CityRooms } from './cityRooms.js';
import { SaveService } from './saves.js';
import { PartyService } from './parties.js';
import { DungeonService } from './dungeons.js';
import { ProgressService } from './progress.js';
import { PileService } from './piles.js';
import { EconomyService } from './economy.js';
import { CombatGuard } from './combatGuard.js';
import { SimHostService } from './simHosts.js';
import { MemoryStore } from './store.js';
import { PROTOCOL_VERSION, NET_LIMITS, NET_ERROR, validateClientMessage, encode } from '../src/net/protocol.js';

export class GameServer extends EventEmitter {
  constructor({ store, saveStore = new MemoryStore(), limits = {}, log = console, simHosts = false, requirePassword = false, charSlots = false } = {}) {
    super();
    this.charSlots = charSlots; // CHARACTER SLOTS: on for `node server.js`; off (= straight into slot 1) in the older unit tests
    this.limits = { ...NET_LIMITS, ...limits };
    this.accounts = new Accounts(store, { requirePassword }); // H6: passwords (required on the real server)
    this.devGrants = !requirePassword; // dev-login servers (EO_DEVLOGIN=1, unit tests) accept 'dev' diamond grants (economy.js)
    this.store = store;
    this.log = log;
    this.conns = new Set();        // every open connection (logged in or not)
    this.sessions = new Map();     // player id -> session
    this.handlers = new Map();     // message type -> fn(session, msg)
    this.on('error', () => {});    // an 'error' emit must never throw
    this.timer = setInterval(() => this.tick(), 1000);
    this.timer.unref?.();
    this.handle('ping', (s, m) => s.send('pong', { n: m.n, time: Date.now() }));
    this.handle('setPassword', (s, m) => { const r = this.accounts.setPassword(s.name, m.pw, m.old); s.send(r.ok ? 'passwordSet' : 'error', r.ok ? {} : { code: NET_ERROR.account, text: r.text }); });
    this.city = new CityRooms(this);   // N2 shared cities
    this.saves = new SaveService(this, saveStore);   // N3 saves
    this.parties = new PartyService(this);           // N4 parties
    this.dungeons = new DungeonService(this);        // N5 dungeon gate + instances
    this.progress = new ProgressService(this, saveStore); // N8 boss kills decided by the server
    this.economy = new EconomyService(this, saveStore, { scan: simHosts }); // H5a what each player owns (ledger); H5b checks
    this.piles = new PileService(this);              // N9 death piles shown to the party
    this.combatGuard = new CombatGuard(this);        // H3a limits on the damage players report
    this.simHosts = new SimHostService(this, { enabled: simHosts }); // H2 the server hosts dungeon map rooms
  }

  handle(type, fn) { this.handlers.set(type, fn); }

  // http server 'upgrade' event
  upgrade(req, socket) {
    if (!req.url.startsWith('/ws')) { socket.destroy(); return; }
    const ws = acceptUpgrade(req, socket, { maxBytes: Math.max(...Object.values(this.limits.typeBytes)) + 1024 }); // per-type sizes: protocol.js
    if (!ws) return;
    const c = { ws, session: null, opened: Date.now(), lastSeen: Date.now(), lastPing: Date.now(), tokens: this.limits.ratePerSecond, warned: 0 };
    this.conns.add(c);
    ws.on('message', (raw) => this.onMessage(c, raw));
    ws.on('pong', () => { c.lastSeen = Date.now(); });
    ws.on('close', () => this.onClose(c));
  }

  onMessage(c, raw) {
    c.lastSeen = Date.now();
    if (!c.session?.sim && --c.tokens < 0) { // H2 server room hosts are trusted (local)
      if (++c.warned > this.limits.ratePerSecond) return this.kick(c, NET_ERROR.rate, 'too many messages');
      return this.sendTo(c, 'error', { code: NET_ERROR.rate, text: 'slow down' });
    }
    const r = validateClientMessage(raw);
    if (!r.ok) return this.sendTo(c, 'error', { code: r.code, text: r.text });
    const msg = r.msg;
    try {
      if (!c.session) {
        if (msg.t !== 'hello') return this.sendTo(c, 'error', { code: NET_ERROR.notReady, text: 'say hello first' });
        return this.login(c, msg);
      }
      if (msg.t === 'hello') return this.sendTo(c, 'error', { code: NET_ERROR.bad, text: 'already logged in' });
      if (msg.t === 'charPick') return this.pickChar(c.session, msg.slot);
      if (msg.t === 'charDelete') return this.deleteChar(c.session, msg.slot);
      if (c.session.lobby && msg.t !== 'setPassword' && msg.t !== 'ping') return this.sendTo(c, 'error', { code: NET_ERROR.notReady, text: 'pick a character first' });
      const fn = this.handlers.get(msg.t);
      if (fn) fn(c.session, msg);
    } catch (e) {
      this.log.error?.(`[server] ${msg.t} from ${c.session?.name || '?'} failed:`, e);
      this.sendTo(c, 'error', { code: NET_ERROR.server, text: 'server error' });
    }
  }

  login(c, msg) {
    if (msg.v !== PROTOCOL_VERSION) return this.kick(c, NET_ERROR.version, `server speaks protocol ${PROTOCOL_VERSION}, please reload`);
    if (msg.sim !== undefined) return this.simHosts.login(c, msg); // H2: a room host the server started itself (secret key)
    const r = this.accounts.login(msg.name, msg.token, { pw: msg.pw, create: msg.create });
    if (!r.ok) return this.sendTo(c, 'error', { code: r.code, text: r.text });
    // CHARACTER SLOTS: the login is a LOBBY (no game messages) until a slot is picked; a reconnect names its slot
    const session = {
      id: r.account.id, account: r.account.id, name: r.account.name, conn: c, since: Date.now(), lobby: true, token: r.token, created: r.created,
      send: (t, f) => this.sendTo(c, t, f),
    };
    c.session = session;
    if (msg.slot || !this.charSlots) return this.pickChar(session, msg.slot || 1);
    session.send('welcome', { v: PROTOCOL_VERSION, id: session.id, name: session.name, token: r.token, created: r.created, hasPw: this.accounts.hasPassword(session.name), lobby: true, chars: this.charList(session.account) });
  }
  // a character's player id: slot 1 = the account id (every save made before slots), others "<account>_s<slot>" (a safe file name)
  charId(account, slot) { return slot === 1 ? account : `${account}_s${slot}`; }
  charList(account) {
    const out = [];
    for (let slot = 1; slot <= CHAR_SLOTS; slot++) {
      const r = this.saves.store.get(this.charId(account, slot)) || {};
      let d = null;
      try { d = r.main ? JSON.parse(r.main) : null; } catch { d = null; }
      const p = d && d.player;
      out.push(p ? { slot, c: p.classId, l: p.level, m: p.map || null } : { slot, empty: true });
    }
    return out;
  }
  pickChar(s, slot) {
    if (!s || !s.lobby || !Number.isInteger(slot) || slot < 1 || slot > CHAR_SLOTS) return s && s.send('error', { code: NET_ERROR.bad, text: 'no such character slot' });
    const id = this.charId(s.account, slot);
    // one character of an account plays at a time: another window / slot of it is sent back
    for (const o of [...this.sessions.values()]) if (o.account === s.account && o !== s) this.kick(o.conn, NET_ERROR.replaced, 'logged in from another window');
    s.id = id; s.slot = slot; s.lobby = false;
    this.sessions.set(id, s);
    s.send('welcome', { v: PROTOCOL_VERSION, id, name: s.name, token: s.token, created: s.created, hasPw: this.accounts.hasPassword(s.name), slot });
    this.log.info?.(`[server] ${s.name} (${id}) online — ${this.sessions.size} player(s)`);
    this.emit('sessionOpened', s);
  }
  deleteChar(s, slot) {
    if (!s || !s.lobby || !Number.isInteger(slot) || slot < 1 || slot > CHAR_SLOTS) return;
    const id = this.charId(s.account, slot), r = this.saves.store.get(id);
    if (r && (r.main || r.backup)) {
      this.saves.store.set(id, { deleted: r.main || r.backup, deletedProgress: r.progress || null, deletedAt: Date.now(), main: null, backup: null, at: Date.now() });
      this.progress?.reset({ id, send() {} });
      this.economy?.reset(id);
    }
    s.send('welcome', { v: PROTOCOL_VERSION, id: s.id, name: s.name, token: s.token, created: false, hasPw: this.accounts.hasPassword(s.name), lobby: true, chars: this.charList(s.account) });
  }

  onClose(c) {
    this.conns.delete(c);
    const s = c.session;
    if (s && this.sessions.get(s.id) === s) {
      this.sessions.delete(s.id);
      this.log.info?.(`[server] ${s.name} offline — ${this.sessions.size} player(s)`);
      this.emit('sessionClosed', s);
    }
  }

  sendTo(c, t, fields) { c.ws.send(encode(t, fields)); }

  kick(c, code, text) {
    this.sendTo(c, 'kicked', { code, text });
    c.ws.close(code === NET_ERROR.replaced ? 4001 : 4000, code);
  }

  broadcast(t, fields, except) { const s = encode(t, fields); for (const x of this.sessions.values()) if (x !== except) x.conn.ws.send(s); }

  tick() {
    const now = Date.now(), L = this.limits;
    for (const c of this.conns) {
      c.tokens = L.ratePerSecond; c.warned = 0;
      if (!c.session && now - c.opened > L.helloTimeout * 1000) { this.kick(c, NET_ERROR.timeout, 'no hello'); continue; }
      if (now - c.lastSeen > L.timeout * 1000) { this.kick(c, NET_ERROR.timeout, 'connection timed out'); continue; }
      if (now - c.lastPing >= L.heartbeat * 1000) { c.lastPing = now; c.ws.ping(); }
    }
  }

  close() {
    clearInterval(this.timer);
    this.city.close();
    this.parties.close();
    this.dungeons.close();
    this.piles.close();
    this.simHosts.close();
    for (const c of [...this.conns]) c.ws.close(1001, 'server shutting down');
    this.store.flush();
  }
}
