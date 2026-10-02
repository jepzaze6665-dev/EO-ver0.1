// ONLINE N1 — the network message protocol, shared by the browser client (src/net/client.js) and the server
// (server/gameServer.js). Pure: no DOM, no Node APIs.
//
// Every message is one JSON text frame: { t: '<type>', ...fields }. The client says which PROTOCOL_VERSION it speaks in
// 'hello'; a server that speaks another version refuses it (code 'version'), so old clients never half-work.
// A new message = one entry in CLIENT_MESSAGES / SERVER_MESSAGES. The server validates EVERY client message with
// validateClientMessage before it looks at it; unknown types / wrong fields are refused, never guessed.

export const PROTOCOL_VERSION = 2;

export const NET_LIMITS = {
  maxMessageBytes: 4096,     // a client frame larger than this closes the connection
  helloTimeout: 5,           // s: a socket that does not say 'hello' in time is dropped
  heartbeat: 10,             // s between server pings
  timeout: 30,               // s without any message from the client = stale, dropped
  ratePerSecond: 40,         // client messages per second (burst bucket); more = 'rate' error, then dropped
  nameMin: 3,
  nameMax: 16,
};

// field rules: 'string' / 'number' / 'int' / 'bool' / 'name' / 'token'; a trailing '?' = optional
const FIELD = {
  string: (v) => typeof v === 'string' && v.length <= 256,
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  int: (v) => Number.isInteger(v),
  bool: (v) => typeof v === 'boolean',
  name: (v) => typeof v === 'string' && validName(v) === null,
  token: (v) => typeof v === 'string' && /^[a-f0-9]{32,64}$/.test(v),
  slug: (v) => typeof v === 'string' && /^[A-Za-z0-9_]{1,24}$/.test(v),   // map / class / animation ids
  coord: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100000,
  dir: (v) => v === 0 || v === 1 || v === 2 || v === 3,                   // dir4: down, up, right, left
  unit: (v) => typeof v === 'number' && v >= 0 && v <= 1,
  level: (v) => Number.isInteger(v) && v >= 1 && v <= 99,
};

// client -> server
export const CLIENT_MESSAGES = {
  hello: { v: 'int', name: 'name', token: 'token?' },   // log in (DEV identity: name + token, server/accounts.js)
  ping: { n: 'int?' },                                   // keep-alive / latency probe (server answers 'pong')
  // N2 presence (src/net/onlineSession.js): where I am + what I look like. Shared-city positions are NOT authoritative
  // (no combat there); dungeon movement gets server checks in N7.
  pos: { m: 'slug', x: 'coord', y: 'coord', d: 'dir', a: 'slug', k: 'unit?' },  // map, position, facing, anim, anim progress
  look: { c: 'slug', l: 'level' },                       // class id + level (sent on change)
  leave: {},                                             // left the world (title screen)
};

// server -> client (documented here, the client does not validate them strictly)
export const SERVER_MESSAGES = {
  welcome: { v: 'int', id: 'string', name: 'name', token: 'token', created: 'bool' },
  pong: { n: 'int?', time: 'number' },
  error: { code: 'string', text: 'string' },
  kicked: { code: 'string', text: 'string' },          // the server is closing this connection on purpose
  // N2 shared city rooms (server/cityRooms.js). A player entry = [id, name, x, y, d, a, k, c, l]
  roomState: { room: 'string', players: 'array' },      // you joined a room: everyone already there
  pJoin: { p: 'array' },                                 // someone entered your room
  pLeave: { id: 'string', why: 'string' },               // 'left' (another map) | 'offline' (disconnected)
  moves: { ps: 'array' },                                // batched movement: [id, x, y, d, a, k, snap]
  pLook: { id: 'string', c: 'string', l: 'int' },
};

export const NET_ERROR = {
  bad: 'bad',             // not JSON / unknown type / wrong fields
  version: 'version',     // client and server speak different protocol versions
  name: 'name',           // name not allowed
  nameTaken: 'nameTaken', // name belongs to another player (no / wrong token)
  token: 'token',         // token does not match the name
  notReady: 'notReady',   // a game message before 'hello'
  rate: 'rate',           // too many messages
  replaced: 'replaced',   // the same player logged in somewhere else
  timeout: 'timeout',
  server: 'server',       // unexpected server error (the server keeps running)
  roomFull: 'roomFull',   // the shared city room is full: you still play, alone
};

// null = ok, else a short reason
export function validName(name) {
  if (typeof name !== 'string') return 'not text';
  const n = name.trim();
  if (n !== name) return 'no spaces at the start / end';
  if (n.length < NET_LIMITS.nameMin || n.length > NET_LIMITS.nameMax) return `${NET_LIMITS.nameMin}-${NET_LIMITS.nameMax} characters`;
  if (!/^[A-Za-z0-9_฀-๿]+( [A-Za-z0-9_฀-๿]+)*$/.test(n)) return 'letters, numbers, _ and single spaces only';
  return null;
}

// one text frame -> { ok: true, msg } | { ok: false, code, text }
export function validateClientMessage(raw) {
  if (typeof raw !== 'string') return fail('not text');
  if (raw.length > NET_LIMITS.maxMessageBytes) return fail('too large');
  let msg;
  try { msg = JSON.parse(raw); } catch { return fail('not JSON'); }
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return fail('not an object');
  const schema = Object.prototype.hasOwnProperty.call(CLIENT_MESSAGES, msg.t) ? CLIENT_MESSAGES[msg.t] : null;
  if (!schema) return fail(`unknown type "${String(msg.t).slice(0, 24)}"`);
  for (const k of Object.keys(msg)) if (k !== 't' && !(k in schema)) return fail(`unknown field "${k.slice(0, 24)}"`);
  for (const [k, rule] of Object.entries(schema)) {
    const optional = rule.endsWith('?');
    const check = FIELD[optional ? rule.slice(0, -1) : rule];
    if (msg[k] === undefined) { if (optional) continue; return fail(`missing "${k}"`); }
    if (!check(msg[k])) return fail(`bad "${k}"`);
  }
  return { ok: true, msg };
}

const fail = (text) => ({ ok: false, code: NET_ERROR.bad, text });

export const encode = (t, fields = {}) => JSON.stringify({ t, ...fields });
