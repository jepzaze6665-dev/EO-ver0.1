// ONLINE N2 — shared city rooms (server/cityRooms.js) with real clients + remote player interpolation
// (src/net/remotePlayers.js). Run:  node tools/tests/online.test.mjs
import { NetClient } from '../../src/net/client.js';
import { RemotePlayers } from '../../src/net/remotePlayers.js';
import { ONLINE, isSharedMap } from '../../src/data/online.js';
import { MAPS } from '../../src/maps/mapRegistry.js';
import { PROTOCOL_VERSION, encode } from '../../src/net/protocol.js';
import { startServer } from '../../server.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 2000, what = 'condition') => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out: ' + what); await wait(10); } };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

console.log('online');
await test('shared rooms = every non-secret city map (Valehaven stays in the dungeon)', () => {
  const cities = MAPS.filter((m) => m.type === 'city' && !m.secret).map((m) => m.id).sort();
  ok(JSON.stringify(cities) === JSON.stringify([...ONLINE.sharedMaps].sort()), `${cities} vs ${ONLINE.sharedMaps}`);
  ok(!isSharedMap('valehaven') && !isSharedMap('a1') && isSharedMap('lumina'), 'rules');
});
await test('interpolation: drawn between two snapshots, a snap (teleport) is never smeared', () => {
  const R = new RemotePlayers();
  R.setRoom('lumina', [['p1', 'Aria', 100, 100, 0, 'idle', 0, 'umbral_sword', 5]], 0);
  R.moves([['p1', 200, 100, 2, 'walk', 0, 0]], 0.1);
  let r = R.visible(0.1 + ONLINE.interpDelay - 0.05)[0];
  ok(r.x > 140 && r.x < 160 && r.y === 100, 'halfway x=' + r.x);
  r = R.visible(0.1 + ONLINE.interpDelay)[0];
  ok(r.x === 200 && r.a === 'walk' && r.d === 2, 'arrived');
  R.moves([['p1', 900, 900, 0, 'idle', 0, 1]], 0.2);
  r = R.visible(0.2 + ONLINE.interpDelay - 0.05)[0];
  ok(r.x === 200, 'no smear before the snap: ' + r.x);
  r = R.visible(0.2 + ONLINE.interpDelay + 0.01)[0];
  ok(r.x === 900 && r.y === 900, 'snapped');
  R.leave('p1', 'offline', 1);
  ok(R.visible(1.1).length === 1 && R.visible(1 + ONLINE.leaveFade + 0.01).length === 0, 'fades out, then removed');
});

const srv = await startServer({ port: 0, dataDir: null, quiet: true });
const url = `ws://localhost:${srv.port}/ws`;
const player = async (name) => {
  const c = new NetClient({ url, storage: memStorage() }), R = new RemotePlayers(), got = [];
  c.on('roomState', (m) => { got.push(m); R.setRoom(m.room, m.players, 0); });
  c.on('pJoin', (m) => { got.push(m); R.join(m.p, 0); });
  c.on('pLeave', (m) => { got.push(m); R.leave(m.id, m.why, 0); });
  c.on('moves', (m) => { got.push(m); R.moves(m.ps, 1); });
  c.on('pLook', (m) => { got.push(m); R.look(m.id, m.c, m.l); });
  c.connect(name);
  await until(() => c.online, 2000, name + ' online');
  return { c, R, got, pos: (m, x, y, a = 'idle') => c.send('pos', { m, x, y, d: 0, a }), look: (cls, l) => c.send('look', { c: cls, l }) };
};

await test('scenario 1: two clients in Lumina see each other (name, class, level)', async () => {
  const a = await player('Aria'), b = await player('Borin');
  a.look('umbral_sword', 4); a.pos('lumina', 1000, 1000);
  await until(() => a.got.some((m) => m.t === 'roomState'), 2000, 'A room');
  b.look('aegis_guardian', 2); b.pos('lumina', 1100, 1000);
  await until(() => b.R.get(a.c.player.id), 2000, 'B sees A');
  await until(() => a.R.get(b.c.player.id), 2000, 'A sees B');
  const ra = b.R.get(a.c.player.id), rb = a.R.get(b.c.player.id);
  ok(ra.name === 'Aria' && ra.cls === 'umbral_sword' && ra.level === 4 && ra.x === 1000, 'A as seen by B');
  ok(rb.name === 'Borin' && rb.cls === 'aegis_guardian' && rb.level === 2, 'B as seen by A');
  a.c.stop(); b.c.stop(); await until(() => !srv.game.city.rooms.size, 2000, 'rooms empty');
});
await test('scenario 2: one moves, the other gets the movement (batched, only movers)', async () => {
  const a = await player('Cyra'), b = await player('Dain');
  a.pos('lumina', 500, 500); b.pos('lumina', 600, 600);
  await until(() => b.R.get(a.c.player.id) && a.R.get(b.c.player.id));
  for (let i = 1; i <= 5; i++) { a.pos('lumina', 500 + i * 10, 500, 'walk'); await wait(110); }
  await until(() => b.R.get(a.c.player.id).snaps.at(-1).x === 550, 2000, 'B got the last move');
  const r = b.R.get(a.c.player.id);
  ok(r.snaps.at(-1).a === 'walk' && !r.snaps.at(-1).snap, 'walking, not a teleport');
  ok(!a.got.some((m) => m.t === 'moves' && m.ps.some((p) => p[0] === a.c.player.id)), 'nobody is sent their own moves');
  a.pos('lumina', 2500, 2500);
  await until(() => r.snaps.at(-1).x === 2500, 2000, 'jump');
  ok(r.snaps.at(-1).snap, 'a jump faster than maxSpeed arrives as a snap');
  a.c.stop(); b.c.stop(); await until(() => !srv.game.city.rooms.size);
});
await test('leaving the city (into A1) / disconnecting: the others are told (left / offline), no ghosts', async () => {
  const a = await player('Eryn'), b = await player('Fenn'), c = await player('Gale');
  for (const [p, x] of [[a, 100], [b, 200], [c, 300]]) p.pos('lumina', x, 100);
  await until(() => b.R.list.length === 2 && c.R.list.length === 2, 2000, 'all see all');
  a.pos('a1', 100, 3500);
  await until(() => b.got.some((m) => m.t === 'pLeave' && m.why === 'left'), 2000, 'left');
  ok(srv.game.city.rooms.get('lumina').size === 2, 'A is not in the Lumina room any more');
  c.c.stop();
  await until(() => b.got.some((m) => m.t === 'pLeave' && m.why === 'offline'), 2000, 'offline');
  ok(srv.game.city.rooms.get('lumina').size === 1, 'one left');
  a.pos('lumina', 120, 120);
  await until(() => a.got.filter((m) => m.t === 'roomState').length === 2, 2000, 'A back: fresh roomState');
  ok(a.got.filter((m) => m.t === 'roomState').at(-1).players.length === 1, 'A sees only B (C is gone)');
  a.c.stop(); b.c.stop(); await until(() => !srv.game.city.rooms.size);
});
await test('rooms are separate: Lumina players never see City 2 players; the title (leave) removes you', async () => {
  const a = await player('Hale'), b = await player('Iris');
  a.pos('lumina', 100, 100); b.pos('city2', 100, 100);
  await wait(300);
  ok(!a.R.list.length && !b.R.list.length, 'nobody seen across cities');
  b.pos('lumina', 150, 100);
  await until(() => a.R.list.length === 1);
  b.c.send('leave', {});
  await until(() => a.got.some((m) => m.t === 'pLeave'), 2000, 'leave');
  a.c.stop(); b.c.stop(); await until(() => !srv.game.city.rooms.size);
});
await test('the same player logging in again replaces the old entity in the room (one, not two)', async () => {
  const st = memStorage(), w = await player('Jory');
  const a = new NetClient({ url, storage: st }); a.connect('Kade'); await until(() => a.online);
  a.send('pos', { m: 'lumina', x: 10, y: 10, d: 0, a: 'idle' });
  w.pos('lumina', 20, 20);
  await until(() => w.R.list.length === 1);
  const a2 = new NetClient({ url, storage: st }); a2.connect('Kade'); await until(() => a2.online);
  a2.send('pos', { m: 'lumina', x: 30, y: 30, d: 0, a: 'idle' });
  await until(() => w.got.some((m) => m.t === 'pLeave' && m.why === 'offline') && w.got.some((m) => m.t === 'pJoin'), 2000, 'old one left, new one joined');
  ok(w.R.list.filter((r) => !r.leaving).length === 1, 'W sees one Kade');
  ok(srv.game.city.rooms.get('lumina').size === 2, 'room size ' + srv.game.city.rooms.get('lumina').size);
  a2.stop(); w.c.stop(); await until(() => !srv.game.city.rooms.size);
});
await test('bad presence data is refused (NaN, negative, wrong dir, huge strings) and changes nothing', async () => {
  const errs = [];
  const ws = new WebSocket(url);
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'error') errs.push(m); };
  await new Promise((r) => { ws.onopen = r; });
  ws.send(encode('hello', { v: PROTOCOL_VERSION, name: 'Lark' }));
  await wait(100);
  for (const bad of [{ m: 'lumina', x: -5, y: 1, d: 0, a: 'idle' }, { m: 'lumina', x: 1, y: 1, d: 7, a: 'idle' }, { m: '../x', x: 1, y: 1, d: 0, a: 'idle' },
    { m: 'lumina', x: 1, y: 1, d: 0, a: 'x'.repeat(40) }, { m: 'lumina', x: 1, y: 1, d: 0, a: 'idle', hp: 1 }]) ws.send(encode('pos', bad));
  ws.send('{"t":"pos","m":"lumina","x":NaN,"y":1,"d":0,"a":"idle"}');
  await until(() => errs.length >= 6, 2000, 'six errors');
  ok(!srv.game.city.rooms.size, 'nobody joined a room');
  ws.close();
});

await srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
