// ONLINE N1 — the game server: connections -> sessions. Every client frame is validated (src/net/protocol.js) before
// anything reads it; one bad client never crashes the server (each message runs inside try / catch).
//   socket -> 'hello' (within NET_LIMITS.helloTimeout) -> DevAccounts.login -> session (one per player: a second login
//   of the same player closes the old socket with 'replaced', so a player entity is never duplicated).
// Later phases add message handlers with `on(type, fn(session, msg))` and react to 'sessionOpened' / 'sessionClosed'.
import { EventEmitter } from 'events';
import { acceptUpgrade } from './ws.js';
import { DevAccounts } from './accounts.js';
import { CityRooms } from './cityRooms.js';
import { PROTOCOL_VERSION, NET_LIMITS, NET_ERROR, validateClientMessage, encode } from '../src/net/protocol.js';

export class GameServer extends EventEmitter {
  constructor({ store, limits = {}, log = console } = {}) {
    super();
    this.limits = { ...NET_LIMITS, ...limits };
    this.accounts = new DevAccounts(store);
    this.store = store;
    this.log = log;
    this.conns = new Set();        // every open connection (logged in or not)
    this.sessions = new Map();     // player id -> session
    this.handlers = new Map();     // message type -> fn(session, msg)
    this.on('error', () => {});    // an 'error' emit must never throw
    this.timer = setInterval(() => this.tick(), 1000);
    this.timer.unref?.();
    this.handle('ping', (s, m) => s.send('pong', { n: m.n, time: Date.now() }));
    this.city = new CityRooms(this);   // N2 shared cities
  }

  handle(type, fn) { this.handlers.set(type, fn); }

  // http server 'upgrade' event
  upgrade(req, socket) {
    if (!req.url.startsWith('/ws')) { socket.destroy(); return; }
    const ws = acceptUpgrade(req, socket, { maxBytes: this.limits.maxMessageBytes });
    if (!ws) return;
    const c = { ws, session: null, opened: Date.now(), lastSeen: Date.now(), lastPing: Date.now(), tokens: this.limits.ratePerSecond, warned: 0 };
    this.conns.add(c);
    ws.on('message', (raw) => this.onMessage(c, raw));
    ws.on('pong', () => { c.lastSeen = Date.now(); });
    ws.on('close', () => this.onClose(c));
  }

  onMessage(c, raw) {
    c.lastSeen = Date.now();
    if (--c.tokens < 0) {
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
      const fn = this.handlers.get(msg.t);
      if (fn) fn(c.session, msg);
    } catch (e) {
      this.log.error?.(`[server] ${msg.t} from ${c.session?.name || '?'} failed:`, e);
      this.sendTo(c, 'error', { code: NET_ERROR.server, text: 'server error' });
    }
  }

  login(c, msg) {
    if (msg.v !== PROTOCOL_VERSION) return this.kick(c, NET_ERROR.version, `server speaks protocol ${PROTOCOL_VERSION}, please reload`);
    const r = this.accounts.login(msg.name, msg.token);
    if (!r.ok) return this.sendTo(c, 'error', { code: r.code, text: r.text });
    const old = this.sessions.get(r.account.id);
    if (old) this.kick(old.conn, NET_ERROR.replaced, 'logged in from another window');
    const session = {
      id: r.account.id, name: r.account.name, conn: c, since: Date.now(),
      send: (t, f) => this.sendTo(c, t, f),
    };
    c.session = session;
    this.sessions.set(session.id, session);
    session.send('welcome', { v: PROTOCOL_VERSION, id: session.id, name: session.name, token: r.token, created: r.created });
    this.log.info?.(`[server] ${session.name} (${session.id}) online — ${this.sessions.size} player(s)`);
    this.emit('sessionOpened', session);
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
    for (const c of [...this.conns]) c.ws.close(1001, 'server shutting down');
    this.store.flush();
  }
}
