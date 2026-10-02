// ONLINE N7a — run-map room hosts + mob snapshot / hit relays (server/cityRooms.js), row validation (protocol.js).
// The client side (puppets) is checked in the browser. Run:  node tools/tests/mobSync.test.mjs
import { NetClient } from '../../src/net/client.js';
import { validMobRow, validateClientMessage, encode } from '../../src/net/protocol.js';
import { startServer } from '../../server.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 3000, what = 'condition') => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out: ' + what); await wait(10); } };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const row = (id, hp = 100) => [id, 'wolf', 100, 200, hp, 120, 157, 3, -1, 0, 0, 4, 3, 0];

console.log('mobSync');
await test('rows: a well-formed row passes; wrong length / NaN / bad ids / unknown state are refused', () => {
  ok(validMobRow(row('m1')), 'good row');
  for (const bad of [row('m1').slice(0, 13), [...row('m1').slice(0, 2), NaN, ...row('m1').slice(3)], ['M<1>', ...row('m1').slice(1)], [...row('m1').slice(0, 7), 99, ...row('m1').slice(8)], [...row('m1').slice(0, 1), '../x', ...row('m1').slice(2)]])
    ok(!validMobRow(bad), 'refused ' + JSON.stringify(bad));
  ok(validateClientMessage(encode('mobs', { ps: Array.from({ length: 60 }, (_, i) => row('m' + i)), full: true })).ok, '60 monsters fit (bigger limit for mobs)');
  ok(!validateClientMessage(encode('mobs', { ps: Array.from({ length: 121 }, (_, i) => row('m' + i)), full: true })).ok, 'too many rows');
  ok(!validateClientMessage(encode('mobHit', { id: 'm1', dmg: -5 })).ok && !validateClientMessage(encode('mobHit', { id: 'm1', dmg: 1.5 })).ok, 'damage must be a whole positive number');
});

const srv = await startServer({ port: 0, dataDir: null, quiet: true });
const url = `ws://localhost:${srv.port}/ws`, S = srv.game, all = [];
const player = async (name) => {
  const c = new NetClient({ url, storage: memStorage() });
  const P = { c, name, hosts: [], mobs: [], hits: [], invites: [], party: null, gos: [] };
  c.on('roomHost', (m) => P.hosts.push(m));
  c.on('mobs', (m) => P.mobs.push(m));
  c.on('mobHit', (m) => P.hits.push(m));
  c.on('partyInvite', (m) => P.invites.push(m));
  c.on('party', (m) => { P.party = m.party; });
  c.on('dungeonGo', (m) => P.gos.push(m));
  c.connect(name); await until(() => c.online);
  P.id = c.player.id; P.send = (t, f = {}) => c.send(t, f);
  P.at = async (m) => { P.send('pos', { m, x: 100, y: 100, d: 0, a: 'idle' }); await until(() => S.sessions.get(P.id).presence?.m === m); await wait(40); };
  P.host = () => (P.hosts.at(-1) || {}).host;
  all.push(P);
  return P;
};
const partyRun = async (ps) => {
  const [a, ...o] = ps;
  for (const p of ps) await p.at('lumina');
  for (const x of o) { a.send('partyInvite', { name: x.name }); await until(() => x.invites.length); x.send('partyAnswer', { party: x.invites.at(-1).party, yes: true }); await until(() => x.party); }
  a.send('dungeonPropose', { area: 'a1' });
  for (const x of o) { await until(() => S.dungeons.checks.size); x.send('dungeonAnswer', { check: [...S.dungeons.checks.keys()][0], yes: true }); }
  await until(() => ps.every((p) => p.gos.length));
};

await test('the first one into a run map hosts it; later arrivals are told who hosts', async () => {
  const a = await player('Aria'), b = await player('Borin');
  await partyRun([a, b]);
  await a.at('a1'); await until(() => a.host() === a.id, 2000, 'Aria hosts');
  await b.at('a1'); await until(() => b.host() === a.id, 2000, 'Borin told Aria hosts');
  ok(!a.hosts.some((h) => h.host === b.id), 'host does not change on arrival');
  for (const p of all.splice(0)) p.c.stop(); await until(() => !S.sessions.size);
});
await test('only the host\'s snapshots are relayed (to the others, not back); hits go to the host with who hit', async () => {
  const a = await player('Cyra'), b = await player('Dain'), c = await player('Eryn');
  await partyRun([a, b, c]);
  await a.at('a1'); await b.at('a1'); await c.at('a1');
  a.send('mobs', { ps: [row('m1')], full: true });
  await until(() => b.mobs.length && c.mobs.length, 2000, 'relayed');
  ok(!a.mobs.length && b.mobs[0].ps[0][0] === 'm1' && b.mobs[0].full, 'not echoed, content kept');
  b.send('mobs', { ps: [row('fake', 1)], full: true }); await wait(200);
  ok(!a.mobs.length && c.mobs.length === 1, 'a guest cannot send snapshots');
  b.send('mobHit', { id: 'm1', dmg: 42, st: 10, crit: true });
  await until(() => a.hits.length, 2000, 'hit at the host');
  ok(a.hits[0].from === b.id && a.hits[0].dmg === 42 && !c.hits.length, 'host only, from = Dain');
  a.send('mobHit', { id: 'm1', dmg: 5 }); await wait(150);
  ok(a.hits.length === 1, 'the host never relays to itself');
  for (const p of all.splice(0)) p.c.stop(); await until(() => !S.sessions.size);
});
await test('the host leaves the map -> a new host is named (the party leader first); separate runs never share a host', async () => {
  const a = await player('Fenn'), b = await player('Gale'), c = await player('Hale');
  await partyRun([a, b, c]); // Fenn leads
  await b.at('a1'); await a.at('a1'); await c.at('a1');
  await until(() => a.host() === b.id && c.host() === b.id, 2000, 'Gale hosts (first in)');
  await b.at('arena');
  await until(() => a.host() === a.id && c.host() === a.id, 2000, 'leader Fenn takes over');
  await until(() => b.host() === b.id, 2000, 'Gale hosts the arena alone');
  const d = await player('Iris');
  await d.at('lumina'); await d.at('a1');
  await until(() => d.host() === d.id, 2000, 'a solo run hosts itself');
  ok(S.city.hostOf(S.sessions.get(a.id).presence.room) === a.id, 'party room host unchanged by the solo player');
  for (const p of all.splice(0)) p.c.stop(); await until(() => !S.sessions.size);
  ok(!S.city.hosts.size, 'no hosts left behind');
});

await srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
