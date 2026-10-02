// ONLINE N1 — browser connection to the game server (server.js /ws). Network only: no game state, no DOM except the
// optional storage. Works with the browser WebSocket and Node's global WebSocket (tests).
//   const net = new NetClient(); net.onState((s) => ...); net.on('welcome', (m) => ...); net.connect('Aria');
// States: offline -> connecting -> online; a lost connection -> reconnecting (backoff 1, 2, 4 ... 10 s) -> online;
// 'kicked' by the server (replaced / version / rate) or a refused login -> offline with `lastError` (no auto-retry loop).
// DEV identity: the token from 'welcome' is kept per name in storage (localStorage) and sent with the next hello.
import { PROTOCOL_VERSION, NET_ERROR, encode } from './protocol.js';

export const NET_STATE = { offline: 'offline', connecting: 'connecting', online: 'online', reconnecting: 'reconnecting' };
const TOKEN_KEY = 'eclipse_online_dev_tokens';
const NO_RETRY = new Set([NET_ERROR.replaced, NET_ERROR.version, NET_ERROR.rate, NET_ERROR.nameTaken, NET_ERROR.token, NET_ERROR.name]);

export function defaultServerUrl(loc = globalThis.location) {
  if (!loc) return 'ws://localhost:5173/ws';
  return (loc.protocol === 'https:' ? 'wss://' : 'ws://') + loc.host + '/ws';
}

export class NetClient {
  constructor({ url = defaultServerUrl(), storage = globalThis.localStorage, WebSocketImpl = globalThis.WebSocket } = {}) {
    this.url = url;
    this.storage = storage;
    this.WS = WebSocketImpl;
    this.state = NET_STATE.offline;
    this.ws = null;
    this.name = null;
    this.player = null;          // { id, name } once welcomed
    this.lastError = null;       // { code, text }
    this.listeners = new Map();
    this.stateListeners = [];
    this.retry = 0;
    this.retryTimer = null;
    this.pingTimer = null;
    this.latency = null;         // ms (from ping / pong)
  }

  on(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(fn); return () => this.off(type, fn); }
  off(type, fn) { const l = this.listeners.get(type); if (l) l.splice(l.indexOf(fn) >>> 0, 1); }
  onState(fn) { this.stateListeners.push(fn); return () => this.stateListeners.splice(this.stateListeners.indexOf(fn) >>> 0, 1); }
  emit(type, msg) { for (const fn of [...(this.listeners.get(type) || [])]) { try { fn(msg); } catch (e) { console.error('[net]', type, e); } } }
  setState(s) { if (this.state === s) return; this.state = s; for (const fn of [...this.stateListeners]) fn(s, this); }

  get online() { return this.state === NET_STATE.online; }

  connect(name) {
    this.name = name;
    this.lastError = null;
    this.retry = 0;
    this.open(NET_STATE.connecting);
  }

  open(state) {
    clearTimeout(this.retryTimer);
    this.drop();
    this.setState(state);
    let ws;
    try { ws = new this.WS(this.url); } catch (e) { return this.lost({ code: NET_ERROR.server, text: e.message }); }
    this.ws = ws;
    ws.onopen = () => ws.send(encode('hello', { v: PROTOCOL_VERSION, name: this.name, ...(this.token() ? { token: this.token() } : {}) }));
    ws.onmessage = (ev) => this.onMessage(ws, ev.data);
    ws.onclose = () => { if (this.ws === ws) this.lost(null); };
    ws.onerror = () => {};
  }

  onMessage(ws, data) {
    if (this.ws !== ws) return;
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (msg.t === 'welcome') {
      this.player = { id: msg.id, name: msg.name };
      this.saveToken(msg.name, msg.token);
      this.retry = 0;
      this.setState(NET_STATE.online);
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.ping(), 5000);
    } else if (msg.t === 'pong') {
      if (msg.n === this.pingN && this.pingAt) { this.latency = Date.now() - this.pingAt; this.pingAt = 0; }
    } else if (msg.t === 'kicked' || (msg.t === 'error' && !this.player && NO_RETRY.has(msg.code))) {
      this.lastError = { code: msg.code, text: msg.text };
      this.stop();
    } else if (msg.t === 'error') {
      this.lastError = { code: msg.code, text: msg.text };
    }
    this.emit(msg.t, msg);
  }

  // the socket closed without us asking: try again unless the server said not to
  lost(err) {
    if (err) this.lastError = err;
    this.drop();
    if (!this.name) return this.setState(NET_STATE.offline);
    const delay = Math.min(10, 2 ** this.retry++) * 1000;
    this.setState(NET_STATE.reconnecting);
    this.retryTimer = setTimeout(() => this.open(NET_STATE.reconnecting), delay);
  }

  ping() { this.pingN = ((this.pingN || 0) + 1) % 1e6; if (this.send('ping', { n: this.pingN })) this.pingAt = Date.now(); }

  send(t, fields) { if (this.online && this.ws?.readyState === 1) { this.ws.send(encode(t, fields)); return true; } return false; }

  // stop for good (logout / kicked); reconnect = connect(name) again
  stop() {
    clearTimeout(this.retryTimer);
    this.name = null;
    this.player = null;
    this.drop();
    this.setState(NET_STATE.offline);
  }

  drop() {
    clearInterval(this.pingTimer);
    const ws = this.ws;
    this.ws = null;
    if (ws) { ws.onopen = ws.onmessage = ws.onclose = null; try { ws.close(); } catch { /* already closed */ } }
  }

  tokens() { try { return JSON.parse(this.storage?.getItem(TOKEN_KEY) || '{}') || {}; } catch { return {}; } }
  token() { return this.tokens()[this.name?.toLowerCase()]; }
  saveToken(name, token) {
    try { const all = this.tokens(); all[name.toLowerCase()] = token; this.storage?.setItem(TOKEN_KEY, JSON.stringify(all)); } catch { /* storage blocked: login again next time with a new name */ }
  }
}
