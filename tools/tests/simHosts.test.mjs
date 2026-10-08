// ONLINE H2 — the server hosts dungeon map rooms (server/simHosts.js): a SimGame joins the room as its hidden host, players
// turn guests and get its monster snapshots, their hits reach it, its boss kills are credited, it stops when the room empties.
// Run:  node tools/tests/simHosts.test.mjs
import { NetClient } from '../../src/net/client.js';
import { startServer } from '../../server.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 4000, what = 'condition') => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out: ' + what); await wait(15); } };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

const srv = await startServer({ port: 0, dataDir: null, quiet: true, simHosts: true });
const url = `ws://localhost:${srv.port}/ws`;
const S = srv.game, all = [];
const player = async (name) => {
  const c = new NetClient({ url, storage: memStorage() });
  const P = { c, name, inst: undefined, gos: [], invites: [], party: null, hosts: [], mobs: [], rooms: [], seen: new Set(), credits: [] };
  c.on('instanceState', (m) => { P.inst = m.instance; });
  c.on('dungeonGo', (m) => P.gos.push(m));
  c.on('partyInvite', (m) => P.invites.push(m));
  c.on('party', (m) => { P.party = m.party; });
  c.on('roomHost', (m) => P.hosts.push(m.host));
  c.on('roomState', (m) => { P.rooms.push(m.room); for (const r of m.players) P.seen.add(r[1]); });
  c.on('pJoin', (m) => P.seen.add(m.p[1]));
  c.on('mobs', (m) => P.mobs.push(m));
  c.on('bossCredit', (m) => P.credits.push(m));
  c.connect(name);
  await until(() => c.online && P.inst !== undefined, 3000, name + ' online');
  P.id = c.player.id;
  P.send = (t, f = {}) => c.send(t, f);
  P.at = async (m, x = 100, y = 100) => { P.send('pos', { m, x, y, d: 0, a: 'idle' }); await until(() => { const p = S.sessions.get(P.id)?.presence; return p && p.m === m && p.room; }, 2000, `${name} at ${m}`); };
  all.push(P);
  return P;
};

console.log('simHosts');
let room = null;
await test('a party run on A1: the server starts its own host, both players turn guests, nobody sees it', async () => {
  const a = await player('Aria'), b = await player('Borin');
  await a.at('lumina'); await b.at('lumina');
  a.send('partyInvite', { name: 'Borin' }); await until(() => b.invites.length);
  b.send('partyAnswer', { party: b.invites[0].party, yes: true }); await until(() => a.party && a.party.members.length === 2);
  a.send('dungeonPropose', { area: 'a1' });
  await until(() => S.dungeons.checks.size); b.send('dungeonAnswer', { check: [...S.dungeons.checks.keys()][0], yes: true });
  await until(() => a.gos.length && b.gos.length);
  await a.at('a1', 1600, 4900); await b.at('a1', 1640, 4900);
  room = a.rooms.at(-1);
  ok(a.hosts[0] === a.id, 'the first player hosts until the server host is ready');
  await until(() => a.hosts.at(-1)?.startsWith('sim') && b.hosts.at(-1)?.startsWith('sim'), 20000, 'server host took over');
  ok(S.simHosts.hosting(room), 'server says it hosts ' + room);
  ok(![...a.seen, ...b.seen].includes('RoomHost'), 'the host is never shown as a player');
});
await test('players get its monster snapshots (full list) and their hits reach its monsters', async () => {
  const a = all[0];
  await until(() => a.mobs.some((m) => m.full && m.ps.length), 6000, 'a full snapshot');
  const snap = a.mobs.filter((m) => m.full).at(-1), row = snap.ps.find((r) => !r[10] && r[4] > 30);
  ok(row, 'a living monster near the players');
  const sim = S.simHosts.rooms.get(room).sim.game, mon = sim.world.monsters.find((m) => m.netId === row[0]);
  ok(mon, 'the same monster lives in the server game');
  const hp0 = mon.hp;
  a.send('mobHit', { id: row[0], dmg: 12 });
  await until(() => mon.hp <= hp0 - 12 || mon.dead, 3000, 'hit applied on the server');
});
await test('its monsters see the players: a wolf next to a player attacks it (telegraph sent to the room)', async () => {
  const a = all[0], sim = S.simHosts.rooms.get(room).sim.game, acts = [];
  a.c.on('mobAct', (m) => acts.push(m));
  const wolf = sim.world.monsters.filter((m) => !m.dead && m.type === 'wolf').sort((p, q) => Math.hypot(p.x - 1600, p.y - 4900) - Math.hypot(q.x - 1600, q.y - 4900))[0];
  ok(wolf, 'a wolf on A1');
  a.send('pos', { m: 'a1', x: Math.round(wolf.x + 30), y: Math.round(wolf.y), d: 0, a: 'idle' });
  await until(() => wolf.aggro && wolf.target && wolf.target.netPlayer === a.id, 4000, 'wolf targets the player');
  await until(() => acts.some((m) => m.k === 'tel' && m.id === wolf.netId), 6000, 'its attack telegraph reaches the player');
});
await test('a boss the server host defeats is credited to the players in that room', async () => {
  const [a, b] = all;
  const sim = S.simHosts.rooms.get(room).sim.game;
  sim.bosses.complete('mini_hollow_fang');
  await until(() => a.credits.length && b.credits.length, 3000, 'credits');
  ok(a.credits[0].boss === 'mini_hollow_fang' && a.credits[0].first, JSON.stringify(a.credits));
});
await test('the room empties -> the server host stops', async () => {
  for (const p of all) await p.at('lumina');
  await until(() => !S.simHosts.rooms.size && !S.city.rooms.has(room), 4000, 'stopped');
});

for (const p of all) p.c.stop();
await srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
