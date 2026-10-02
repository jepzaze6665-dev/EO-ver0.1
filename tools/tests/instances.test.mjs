// ONLINE N6 — dungeon runs: instance rooms, isolation, continuing through maps, returning, on-foot runs, reconnect,
// cleanup (server/dungeons.js + server/instances.js + server/cityRooms.js). Run:  node tools/tests/instances.test.mjs
import { NetClient } from '../../src/net/client.js';
import { ONLINE } from '../../src/data/online.js';
import { startServer } from '../../server.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 3000, what = 'condition') => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out: ' + what); await wait(10); } };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

const srv = await startServer({ port: 0, dataDir: null, quiet: true });
const url = `ws://localhost:${srv.port}/ws`;
const S = srv.game, all = [];
const player = async (name, storage = memStorage()) => {
  const c = new NetClient({ url, storage });
  const P = { c, name, storage, rooms: [], seen: new Map(), inst: undefined, left: [], gos: [], invites: [], party: null, leaves: [] };
  c.on('roomState', (m) => { P.rooms.push(m); P.room = m.room; P.seen = new Map(m.players.map((r) => [r[0], r[1]])); });
  c.on('pJoin', (m) => P.seen.set(m.p[0], m.p[1]));
  c.on('pLeave', (m) => { P.seen.delete(m.id); P.leaves.push(m); });
  c.on('instanceState', (m) => { P.inst = m.instance; });
  c.on('dungeonLeft', (m) => P.left.push(m));
  c.on('dungeonGo', (m) => P.gos.push(m));
  c.on('partyInvite', (m) => P.invites.push(m));
  c.on('party', (m) => { P.party = m.party; });
  c.connect(name);
  await until(() => c.online && P.inst !== undefined, 3000, name + ' online');
  P.id = c.player.id;
  P.send = (t, f = {}) => c.send(t, f);
  P.at = async (m, x = 100, y = 100) => { P.send('pos', { m, x, y, d: 0, a: 'idle' }); await until(() => S.game?.x || S.sessions.get(P.id)?.presence?.m === m, 2000, `${name} at ${m}`); await wait(30); };
  P.sees = (o) => P.seen.has(o.id);
  all.push(P);
  return P;
};
const partyRun = async (area, ...ps) => {
  const [a, ...others] = ps;
  for (const p of ps) await p.at('lumina');
  for (const o of others) { a.send('partyInvite', { name: o.name }); await until(() => o.invites.length); o.send('partyAnswer', { party: o.invites.at(-1).party, yes: true }); await until(() => o.party); }
  await until(() => a.party && a.party.members.length === ps.length);
  a.send('dungeonPropose', { area });
  for (const o of others) { await until(() => S.dungeons.checks.size, 2000); const c = [...S.dungeons.checks.values()][0]; o.send('dungeonAnswer', { check: c.id, yes: true }); }
  await until(() => ps.every((p) => p.gos.length), 2000, 'run started');
  for (const p of ps) await p.at(area, 200 + Math.random() * 50, 200);
  return a.gos[0].instance;
};
const cleanup = async () => { for (const p of all.splice(0)) p.c.stop(); await until(() => !S.sessions.size, 3000); S.parties.parties.clear(); S.parties.byPlayer.clear(); for (const id of [...S.dungeons.instances.byPlayer.keys()]) S.dungeons.instances.leave(id); };

console.log('instances');
await test('scenario 5 + 6: the party sees each other in its run; a solo player on the same map sees nobody and is not seen', async () => {
  const a = await player('Aria'), b = await player('Borin'), c = await player('Cyra');
  const inst = await partyRun('a1', a, b);
  await until(() => a.sees(b) && b.sees(a), 2000, 'party members see each other in A1');
  ok(a.room === `${inst}:a1`, 'room = run map: ' + a.room);
  await c.at('lumina'); await c.at('a1', 210, 200); // walks out of Lumina on foot = her own solo run
  await wait(200);
  ok(c.inst && c.inst.mode === 'solo' && c.inst.id !== inst, 'Cyra has her own run');
  ok(!c.sees(a) && !c.sees(b) && !a.sees(c) && !b.sees(c), 'separate runs never see each other');
  ok(S.dungeons.instances.of(a.id) === S.dungeons.instances.of(b.id) && S.dungeons.instances.of(c.id) !== S.dungeons.instances.of(a.id), 'server agrees');
  await cleanup();
});
await test('continuing through the map exits: same run, rooms per map, the run remembers every map visited', async () => {
  const a = await player('Dain'), b = await player('Eryn');
  const inst = await partyRun('a1', a, b);
  await until(() => a.sees(b));
  await a.at('arena', 500, 500);
  await until(() => !b.sees(a) && a.room === `${inst}:arena`, 2000, 'Dain alone in the arena room');
  await b.at('arena', 520, 500);
  await until(() => a.sees(b) && b.sees(a), 2000, 'together again in the arena');
  await a.at('a2'); await b.at('a2');
  await until(() => a.sees(b) && a.inst.maps.join() === 'a1,arena,a2', 2000, 'maps: ' + (a.inst && a.inst.maps));
  ok(a.inst.id === inst && a.inst.area === 'a1', 'still the same run');
  await cleanup();
});
await test('return stone: dungeonLeave -> back to the run\'s city; the others see you go; your next position is the city', async () => {
  const a = await player('Fenn'), b = await player('Gale');
  await partyRun('b1', a, b);
  await until(() => a.sees(b));
  a.send('dungeonLeave');
  await until(() => a.left.length && a.inst === null, 2000, 'left');
  ok(a.left[0].city === 'lumina', 'city ' + a.left[0].city);
  await until(() => !b.sees(a) && b.inst.members.length === 1, 2000, 'Gale told');
  await a.at('lumina');
  await until(() => a.room === 'lumina', 2000, 'in the Lumina room');
  b.send('dungeonLeave'); await until(() => b.inst === null);
  await until(() => !S.dungeons.instances.list.size, 2000, 'empty run deleted');
  await cleanup();
});
await test('walking back into a city on foot (or respawning there) also ends your part of the run', async () => {
  const a = await player('Hale');
  await a.at('lumina'); await a.at('a1');
  await until(() => a.inst && a.inst.city === 'lumina' && a.inst.area === 'a1', 2000, 'on-foot solo run, city Lumina');
  await a.at('lumina');
  await until(() => a.inst === null && !S.dungeons.instances.list.size, 2000, 'run over');
  await cleanup();
});
await test('disconnect in a run: the place is kept, a reconnect within the grace rejoins the same run', async () => {
  const st = memStorage(), a = await player('Iris', st), b = await player('Jory');
  const inst = await partyRun('a1', a, b);
  await until(() => b.sees(a));
  a.c.stop();
  await until(() => !b.sees(a), 2000, 'gone from view');
  ok(S.dungeons.instances.of(a.id)?.id === inst, 'still a member');
  const a2 = await player('Iris', st);
  ok(a2.inst && a2.inst.id === inst, 'told which run on login');
  await a2.at('a1', 230, 200);
  await until(() => b.sees(a2) && a2.sees(b), 2000, 'together again');
  ok(S.dungeons.instances.list.size === 1, 'no second run made');
  await cleanup();
});
await test('the grace runs out -> removed; the last member gone -> the run is deleted (nothing else is touched)', async () => {
  const keep = ONLINE.dungeon.reconnectGrace;
  ONLINE.dungeon.reconnectGrace = 1;
  try {
    const a = await player('Kade'), b = await player('Lark');
    const inst = await partyRun('a1', a, b);
    a.c.stop();
    await until(() => b.inst && b.inst.members.length === 1, 4000, 'removed after the grace');
    b.c.stop();
    await until(() => !S.dungeons.instances.get(inst), 4000, 'deleted');
  } finally { ONLINE.dungeon.reconnectGrace = keep; }
  await cleanup();
});

await srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
