// ONLINE N1 — protocol, WebSocket frames, dev identity, game server sessions (a real server on a free port + real
// WebSocket clients). Run:  node tools/tests/net.test.mjs
import net from 'net';
import { PROTOCOL_VERSION, validateClientMessage, validName, NET_ERROR, encode } from '../../src/net/protocol.js';
import { NetClient, NET_STATE } from '../../src/net/client.js';
import { decodeFrames, encodeMaskedFrame, acceptKey } from '../../server/ws.js';
import { DevAccounts } from '../../server/accounts.js';
import { MemoryStore } from '../../server/store.js';
import { startServer } from '../../server.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 2000, what = 'condition') => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out: ' + what); await wait(10); } };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

console.log('net');
await test('protocol: valid hello / ping pass, junk is refused with a reason', () => {
  ok(validateClientMessage(encode('hello', { v: 1, name: 'Aria' })).ok, 'hello');
  ok(validateClientMessage(encode('ping', {})).ok, 'ping');
  for (const raw of ['nope', '[]', '{"t":"teleport"}', encode('hello', { v: 1 }), encode('hello', { v: 1, name: 'Aria', gold: 9e9 }),
    encode('hello', { v: '1', name: 'Aria' }), encode('hello', { v: 1, name: 'Aria', token: 'xyz' }), '{"t":"__proto__"}', 'x'.repeat(5000)])
    ok(!validateClientMessage(raw).ok, 'refused: ' + raw.slice(0, 40));
});
await test('names: 3-16 letters / numbers / Thai / single spaces', () => {
  ok(validName('Aria') === null && validName('นักดาบ') === null && validName('Dark Knight') === null, 'good names');
  ok(validName('ab') && validName(' Aria') && validName('a'.repeat(17)) && validName('A  B') && validName('<b>'), 'bad names');
});
await test('frames: masked client frames decode (short, 126, split across reads), unmasked = protocol error', () => {
  const big = Buffer.alloc(300, 65);
  const both = Buffer.concat([encodeMaskedFrame(1, Buffer.from('hi')), encodeMaskedFrame(1, big)]);
  const r = decodeFrames(both, 4096);
  ok(r.frames.length === 2 && r.frames[0].payload.toString() === 'hi' && r.frames[1].payload.length === 300, 'two frames');
  const half = decodeFrames(both.subarray(0, 20), 4096);
  ok(half.frames.length === 1 && half.rest.length === 12, 'partial frame waits');
  ok(decodeFrames(Buffer.from([0x81, 0x02, 0x68, 0x69]), 4096).error === 1002, 'unmasked');
  ok(decodeFrames(encodeMaskedFrame(1, Buffer.alloc(5000)), 4096).error === 1009, 'too large');
  ok(acceptKey('dGhlIHNhbXBsZSBub25jZQ==') === 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=', 'RFC 6455 sample key');
});
await test('dev identity: new name -> token; same name needs that token; stored as a hash only', () => {
  const store = new MemoryStore(), acc = new DevAccounts(store);
  const a = acc.login('Aria');
  ok(a.ok && a.created && /^[a-f0-9]{48}$/.test(a.token), 'created');
  ok(acc.login('aria').code === NET_ERROR.nameTaken, 'name taken (any case)');
  ok(acc.login('Aria', 'f'.repeat(48)).code === NET_ERROR.token, 'wrong token');
  const b = acc.login('Aria', a.token);
  ok(b.ok && !b.created && b.account.id === a.account.id, 'login again');
  ok(!JSON.stringify(store.all()).includes(a.token), 'token not stored');
});

const srv = await startServer({ port: 0, dataDir: null, quiet: true, limits: { helloTimeout: 0.5, ratePerSecond: 20 } });
const url = `ws://localhost:${srv.port}/ws`;
const client = (storage = memStorage()) => new NetClient({ url, storage });
// a bare socket that records every server message
const raw = () => new Promise((res) => {
  const ws = new WebSocket(url), got = [];
  ws.onmessage = (e) => got.push(JSON.parse(e.data));
  ws.onopen = () => res({ ws, got, closed: () => ws.readyState === 3 });
  ws.onclose = () => {};
});

await test('two clients connect, get welcomed, the server lists two sessions', async () => {
  const a = client(), b = client();
  a.connect('Aria'); b.connect('Borin');
  await until(() => a.online && b.online, 2000, 'both online');
  ok(a.player.name === 'Aria' && b.player.name === 'Borin' && a.player.id !== b.player.id, 'players');
  ok(srv.game.sessions.size === 2, 'sessions ' + srv.game.sessions.size);
  a.stop(); b.stop();
  await until(() => srv.game.sessions.size === 0, 2000, 'sessions closed on disconnect');
});
await test('token is kept: reconnecting with the same name works, another browser cannot take it', async () => {
  const st = memStorage(), a = client(st);
  a.connect('Cyra'); await until(() => a.online); const id = a.player.id; a.stop();
  const a2 = client(st); a2.connect('Cyra'); await until(() => a2.online); ok(a2.player.id === id, 'same player');
  const thief = client(); thief.connect('Cyra');
  await until(() => thief.state === NET_STATE.offline && thief.lastError, 2000, 'refused');
  ok(thief.lastError.code === NET_ERROR.nameTaken, thief.lastError.code);
  ok(a2.online, 'owner still online');
  a2.stop();
});
await test('the same player logging in twice: the OLD connection is replaced (one entity, never two)', async () => {
  const st = memStorage(), a = client(st);
  a.connect('Dain'); await until(() => a.online);
  const b = client(st); b.connect('Dain'); await until(() => b.online);
  await until(() => a.state === NET_STATE.offline, 2000, 'old one kicked');
  ok(a.lastError?.code === NET_ERROR.replaced, 'replaced');
  ok([...srv.game.sessions.values()].filter((s) => s.name === 'Dain').length === 1, 'one session');
  b.stop();
});
await test('messages before hello are refused; bad messages get an error and the server keeps running', async () => {
  const r = await raw();
  r.ws.send(encode('ping', {}));
  r.ws.send('{"t":"giveGold","amount":999999}');
  r.ws.send('not json');
  await until(() => r.got.length >= 3);
  ok(r.got[0].code === NET_ERROR.notReady && r.got[1].code === NET_ERROR.bad && r.got[2].code === NET_ERROR.bad, JSON.stringify(r.got));
  r.ws.send(encode('hello', { v: PROTOCOL_VERSION, name: 'Eryn' }));
  await until(() => r.got.some((m) => m.t === 'welcome'), 2000, 'still able to log in');
  r.ws.send(encode('ping', { n: 7 }));
  await until(() => r.got.some((m) => m.t === 'pong' && m.n === 7), 2000, 'pong');
  r.ws.close();
});
await test('wrong protocol version = kicked with a clear text', async () => {
  const r = await raw();
  r.ws.send(encode('hello', { v: PROTOCOL_VERSION + 1, name: 'Fenn' }));
  await until(() => r.closed(), 2000, 'closed');
  ok(r.got.some((m) => m.t === 'kicked' && m.code === NET_ERROR.version), JSON.stringify(r.got));
});
await test('no hello in time = dropped; flood = dropped; oversized frame = dropped', async () => {
  const quiet = await raw();
  await until(() => quiet.closed(), 3000, 'hello timeout');
  const flood = await raw();
  for (let i = 0; i < 80; i++) flood.ws.send(encode('ping', {}));
  await until(() => flood.closed(), 3000, 'flood');
  ok(flood.got.some((m) => m.code === NET_ERROR.rate), 'rate errors');
  const big = await raw();
  big.ws.send('x'.repeat(10000));
  await until(() => big.closed(), 3000, 'oversized');
  ok(srv.game.conns.size === 0, 'no leaked connections: ' + srv.game.conns.size);
});
await test('a broken handshake / garbage TCP never crashes the server', async () => {
  await new Promise((res) => { const s = net.connect(srv.port, 'localhost', () => { s.write('GET /ws HTTP/1.1\r\nHost: x\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n'); }); s.on('data', (d) => { if (!String(d).startsWith('HTTP/1.1 400')) res(); }); s.on('close', res); s.on('error', res); setTimeout(() => { s.destroy(); res(); }, 1000); });
  await new Promise((res) => { const s = net.connect(srv.port, 'localhost', () => { s.write('\x00\xff garbage\r\n\r\n'); }); s.on('close', res); s.on('error', res); setTimeout(() => { s.destroy(); res(); }, 300); });
  const a = client(); a.connect('Gale'); await until(() => a.online, 2000, 'server alive'); a.stop();
});
await test('server files and player data are never served over http', async () => {
  for (const p of ['/server/data/accounts.json', '/server/gameServer.js', '/%2e%2e/%2e%2e/windows/win.ini', '/.git/config']) {
    const r = await fetch(`http://localhost:${srv.port}${p}`);
    ok(r.status === 403 || r.status === 404, p + ' -> ' + r.status);
  }
  ok((await fetch(`http://localhost:${srv.port}/src/net/protocol.js`)).status === 200, 'shared protocol is served');
});
await test('server goes down -> client RECONNECTS by itself when it is back', async () => {
  const s2 = await startServer({ port: 0, dataDir: null, quiet: true });
  const port = s2.port, st = memStorage();
  const a = new NetClient({ url: `ws://localhost:${port}/ws`, storage: st });
  a.connect('Hale'); await until(() => a.online);
  // same memory store survives a "restart" only in a real data folder; here a fresh store = new account, same name
  await s2.close();
  await until(() => a.state === NET_STATE.reconnecting, 3000, 'reconnecting');
  const s3 = await startServer({ port, dataDir: null, quiet: true });
  st.setItem('eclipse_online_dev_tokens', '{}');
  await until(() => a.online, 6000, 'back online');
  a.stop(); await s3.close();
});

await srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
