// ONLINE N1 — the network message protocol, shared by the browser client (src/net/client.js) and the server
// (server/gameServer.js). Pure: no DOM, no Node APIs.
//
// Every message is one JSON text frame: { t: '<type>', ...fields }. The client says which PROTOCOL_VERSION it speaks in
// 'hello'; a server that speaks another version refuses it (code 'version'), so old clients never half-work.
// A new message = one entry in CLIENT_MESSAGES / SERVER_MESSAGES. The server validates EVERY client message with
// validateClientMessage before it looks at it; unknown types / wrong fields are refused, never guessed.

export const PROTOCOL_VERSION = 15;

export const NET_LIMITS = {
  maxMessageBytes: 4096,     // largest ordinary client message
  maxSaveBytes: 262144,      // largest 'saveWrite' (the whole save as JSON text); the socket allows this much
  saveInterval: 1,           // s: at most one save write per second per player (autosave is every 4 s)
  // larger messages allowed per type (everything else: maxMessageBytes)
  typeBytes: { saveWrite: 262144, mobs: 32768, fx: 16384 },
  maxMobRows: 120,           // monsters in one 'mobs' message
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
  save: (v) => typeof v === 'string' && v.length <= NET_LIMITS.maxSaveBytes,
  dmg: (v) => Number.isInteger(v) && v >= 0 && v <= 1000000,
  mobRows: (v) => Array.isArray(v) && v.length <= NET_LIMITS.maxMobRows && v.every(validMobRow),
  mobActKind: (v) => ['tel', 'proj', 'btel', 'bhit', 'bproj', 'bdmg', 'bstat'].includes(v), // b* = boss: telegraph (visual) / strike / shots / forwarded mechanic damage / status
  bossData: (v) => validActData(v, -3),
  rows16: (v) => Array.isArray(v) && v.length <= 16 && v.every((r) => Array.isArray(r) && r.length <= 12 && validActData(r, 1)),                 // boss snapshot: mechanic states nest deeper (6 levels)
  bossEvtKind: (v) => v === 'obj' || v === 'hold' || v === 'ember',
  fxCalls: (v) => Array.isArray(v) && v.length <= 60 && v.every((c) => Array.isArray(c) && c.length <= 10 && (FX_METHODS.includes(c[0]) || BOSS_FX_EXTRA.includes(c[0])) && c.slice(1).every((a) => validActData(a, 1))),
  fxShots: (v) => Array.isArray(v) && v.length <= 16 && v.every((s) => s && typeof s === 'object' && !Array.isArray(s) && validActData(s, 1)),
  actData: (v) => validActData(v),
};

// N7a mob snapshot row (host -> others): [netId, type, x, y, hp, maxHp, facing×100, state, attack index (-1 none),
// phase (0 windup 1 active 2 recover), dead 0|1, flags (1 elite, 2 corrupted, 4 moving), level, armor]
// friends' skill effects (src/net/netFx.js): the vfx methods a client may ask the others to replay
export const FX_METHODS = ['particle', 'burst', 'spark', 'shadowSmoke', 'shards', 'slash', 'ring', 'beam', 'bolt', 'sprite', 'text', 'light', 'ghost'];
// boss channel only (a host's boss): screen flash, callout banner, camera shake
export const BOSS_FX_EXTRA = ['flash', 'callout', 'shake'];
export const MOB_STATES = ['idle', 'patrol', 'aggro', 'chase', 'attack', 'hit', 'return', 'dead'];
export const MOB_PHASES = ['windup', 'active', 'recover'];
const num = (v) => typeof v === 'number' && Number.isFinite(v);
// N7b monster action (host -> guests): 'tel' = a telegraphed attack started { shape, total, power, kind, knock, guardBreak,
// unblockable, status } · 'proj' = shots fired { power, list: [{ x, y, vx, vy, r, life, kind, homing, color }] }. Plain data
// only (numbers, short strings, booleans, small arrays / objects, 3 levels deep); guests clamp every value again.
export function validActData(v, depth = 0) {
  if (depth > 3) return false;
  if (v === null || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return v.length <= 32;
  if (Array.isArray(v)) return v.length <= 24 && v.every((x) => validActData(x, depth + 1));
  if (typeof v === 'object') { const k = Object.keys(v); return k.length <= 20 && k.every((x) => x.length <= 16 && validActData(v[x], depth + 1)); }
  return false;
}
export function validMobRow(r) {
  return Array.isArray(r) && r.length === 14 && typeof r[0] === 'string' && /^[a-z0-9]{1,16}$/.test(r[0]) && typeof r[1] === 'string' && /^[A-Za-z0-9_]{1,32}$/.test(r[1])
    && r.slice(2, 14).every(num) && r[7] >= 0 && r[7] < MOB_STATES.length && r[9] >= 0 && r[9] < MOB_PHASES.length;
}

// client -> server
export const CLIENT_MESSAGES = {
  hello: { v: 'int', name: 'name', token: 'token?' },   // log in (DEV identity: name + token, server/accounts.js)
  ping: { n: 'int?' },                                   // keep-alive / latency probe (server answers 'pong')
  // N2 presence (src/net/onlineSession.js): where I am + what I look like. Shared-city positions are NOT authoritative
  // (no combat there); dungeon movement gets server checks in N7.
  pos: { m: 'slug', x: 'coord', y: 'coord', d: 'dir', a: 'slug', k: 'unit?', h: 'unit?', dn: 'bool?' },  // map, position, facing, anim, anim progress, HP share (0 = down)
  look: { c: 'slug', l: 'level' },                       // class id + level (sent on change)
  leave: {},                                             // left the world (title screen)
  // N3 save on the server (src/net/serverSave.js): the client sends the whole save text; the server keeps the previous
  // one as the backup. NOT authoritative yet: boss kills / unlocks / loot move to the server in N8 / N9.
  saveWrite: { s: 'save' },
  saveRemove: {},                                        // New Game / reset
  // N4 online party (server/parties.js)
  partyCreate: {},
  partyInvite: { name: 'name' },                         // invite an online player by name (creates a party if needed)
  partyAnswer: { party: 'slug', yes: 'bool' },           // accept / decline an invite
  partyLeave: {},
  partyKick: { id: 'slug' },                             // leader only
  partyLead: { id: 'slug' },                             // leader only: make someone else the leader
  partyList: {},                                         // open parties at this city's gate
  partyJoin: { party: 'slug' },                          // join an open party at the gate (no invite needed)
  // N7a shared monsters in a run map (src/net/mobSync.js): the room HOST simulates them and sends snapshots; the others
  // report their hits to the host (relayed by the server). Not authoritative yet: N8 checks kills on the server.
  mobs: { ps: 'mobRows', full: 'bool' },                 // host only: changed monsters (full = every monster near the party)
  mobHit: { id: 'slug', dmg: 'dmg', st: 'number?', kb: 'number?', ang: 'number?', crit: 'bool?', ad: 'number?' }, // my hit on the host's monster / boss (ad = armour damage)
  bossEvt: { id: 'slug', k: 'bossEvtKind', d: 'actData' }, // guest -> host: hit on a cluster / pylon, holding [E] at a chain post, ember stacks
  mobAct: { id: 'slug', k: 'mobActKind', d: 'actData' },
  revive: { to: 'slug' },
  fx: { c: 'fxCalls', s: 'fxShots', b: 'slug?' },
  sum: { s: 'rows16', th: 'rows16' },                   // my summons / clones and threads (presentation only), relayed to my room        // b = a boss id: that boss's effects (host only — the clients check)
  boss: { b: 'bossData' },                                // N7c host only: boss snapshot { id, st, x, y, f, pose, state, phase, hp, max, dead, air, hurt, vul, move, tags }                    // my skill effects (presentation only), relayed to my room                                // I held [E] long enough next to this downed teammate  // N7b host only: a monster started an attack / fired shots
  // N5 dungeon gate (server/dungeons.js)
  dungeonEnter: { area: 'slug' },                        // solo entry
  dungeonPropose: { area: 'slug' },                      // party leader: ask every member to enter together
  dungeonAnswer: { check: 'slug', yes: 'bool' },         // a member accepts / declines the leader's proposal
  dungeonCancel: {},                                     // the leader withdraws the proposal
  dungeonLeave: {},                                      // N6: return to the city from the run's start point
};

// server -> client (documented here, the client does not validate them strictly)
export const SERVER_MESSAGES = {
  welcome: { v: 'int', id: 'string', name: 'name', token: 'token', created: 'bool' },
  pong: { n: 'int?', time: 'number' },
  error: { code: 'string', text: 'string' },
  kicked: { code: 'string', text: 'string' },          // the server is closing this connection on purpose
  // N2 shared city rooms (server/cityRooms.js). A player entry = [id, name, x, y, d, a, k, c, l]
  roomState: { room: 'string', map: 'string', players: 'array' }, // you joined a room (city or run map): everyone there
  pJoin: { p: 'array' },                                 // someone entered your room
  pLeave: { id: 'string', why: 'string' },               // 'left' (another map) | 'offline' (disconnected)
  moves: { ps: 'array' },                                // batched movement: [id, x, y, d, a, k, snap]
  pLook: { id: 'string', c: 'string', l: 'int' },
  // N3: your saves, right after 'welcome' (null = none)
  saveData: { main: 'string|null', backup: 'string|null' },
  saveOk: { at: 'number' },                              // a saveWrite is stored (savedAt of that save)
  // N4: your party ({ id, leader, members: [{ id, name, online, c, l, m }] }) or null; invites; plain notices
  party: { party: 'object|null' },
  partyInvite: { party: 'string', from: 'string', size: 'int' },
  partyInviteGone: { party: 'string' },                  // expired / party gone / you joined another
  partyInfo: { text: 'string' },
  partyListData: { city: 'string', parties: 'array' },  // [{ id, leader, size, max, members, level }]
  // N5: party ready check / entry
  dungeonCheck: { check: 'string', area: 'string', leader: 'string', members: 'array', ends: 'number' }, // members [{ id, name, answer: yes|wait }]
  dungeonCancel: { reason: 'string' },
  dungeonGo: { instance: 'string', area: 'string', mode: 'string', members: 'array' },  // enter now (members = names)
  // N6: which run you are in (null = none: in a city). Sent when it changes (gate entry, walking out on foot, leaving)
  instanceState: { instance: 'object|null' },            // { id, area, mode, city, members: [names], maps: [ids] }
  dungeonLeft: { city: 'string' },                       // answer to dungeonLeave: go to this city's gate
  roomHost: { room: 'string', host: 'string' },          // N7a: who simulates the monsters of this run map
  // mobs / mobAct (relayed as sent) · mobHit (relayed to the host, + from: player id)
  // N7b: room rows / moves carry the HP share h (0 = down): entry [id, name, x, y, d, a, k, c, l, h, dn], move [id, x, y, d, a, k, snap, h, dn]
  revived: { by: 'string' },
  // fx (relayed + from: player id) · boss (relayed as sent)                             // a teammate revived you (server checked it)
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
  party: 'party',         // a party action was refused (text says why)
  dungeon: 'dungeon',     // a dungeon entry was refused (locked area, not in a city, ... — text says who / why)
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
  if (raw.length > Math.max(...Object.values(NET_LIMITS.typeBytes))) return fail('too large');
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
  if (raw.length > (NET_LIMITS.typeBytes[msg.t] || NET_LIMITS.maxMessageBytes)) return fail('too large');
  return { ok: true, msg };
}

const fail = (text) => ({ ok: false, code: NET_ERROR.bad, text });

export const encode = (t, fields = {}) => JSON.stringify({ t, ...fields });
