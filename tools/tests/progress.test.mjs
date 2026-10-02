// ONLINE N8 — server-owned progression (server/progress.js): boss kills credited by the server, Dungeon Gate unlocks
// from the server's list, seeding from an old save, saves cannot forge kills, New Game clears.
// Run:  node tools/tests/progress.test.mjs
import { NetClient } from '../../src/net/client.js';
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
  const P = { c, name, storage, progress: undefined, credits: [], errors: [], gos: [], invites: [], party: null, inst: undefined };
  c.on('progress', (m) => { P.progress = m.bosses; });
  c.on('bossCredit', (m) => P.credits.push(m));
  c.on('error', (m) => P.errors.push(m));
  c.on('dungeonGo', (m) => P.gos.push(m));
  c.on('partyInvite', (m) => P.invites.push(m));
  c.on('party', (m) => { P.party = m.party; });
  c.on('instanceState', (m) => { P.inst = m.instance; });
  c.connect(name);
  await until(() => c.online && P.progress !== undefined, 3000, name + ' online + progress');
  P.id = c.player.id;
  P.send = (t, f = {}) => c.send(t, f);
  P.at = async (m, x = 100, y = 100) => { P.send('pos', { m, x, y, d: 0, a: 'idle' }); await until(() => S.sessions.get(P.id)?.presence?.m === m && S.sessions.get(P.id)?.presence?.room, 2000, `${name} at ${m}`); await wait(30); };
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
  for (const p of ps) await p.at(area, 200, 200);
  return a.gos[0].instance;
};
const cleanup = async () => { for (const p of all.splice(0)) p.c.stop(); await until(() => !S.sessions.size, 3000); S.parties.parties.clear(); S.parties.byPlayer.clear(); for (const id of [...S.dungeons.instances.byPlayer.keys()]) S.dungeons.instances.leave(id); };

console.log('progress');
await test('a new player: no kills on the server; A2 is locked at the gate, A1 is free', async () => {
  const a = await player('Aria');
  ok(Array.isArray(a.progress) && !a.progress.length, 'empty list');
  await a.at('lumina');
  a.send('dungeonEnter', { area: 'a2' });
  await until(() => a.errors.some((e) => e.code === 'dungeon'), 2000, 'refused');
  a.send('dungeonEnter', { area: 'a1' });
  await until(() => a.gos.length, 2000, 'A1 entry');
  await cleanup();
});

await test('the host of the boss map reports a kill: everyone of the run IN that room is credited once; others not', async () => {
  const a = await player('Borin'), b = await player('Cyra'), c = await player('Dain');
  const inst = await partyRun('a1', a, b, c);
  await a.at('arena', 500, 500); await b.at('arena', 520, 500); // Dain stays in A1
  ok(S.city.hostOf(`${inst}:arena`) === a.id, 'Borin hosts the arena');
  b.send('bossKill', { boss: 'boss_a1' }); // a guest cannot report
  await until(() => b.errors.length, 2000, 'guest refused');
  ok(!a.credits.length && !b.credits.length, 'no credit from a guest');
  a.send('bossKill', { boss: 'boss_a1' });
  await until(() => a.credits.length && b.credits.length, 2000, 'credits');
  ok(a.credits[0].boss === 'boss_a1' && a.credits[0].first && b.credits[0].first, 'first kill for both');
  a.send('bossKill', { boss: 'boss_a1' });
  await wait(200);
  ok(a.credits.length === 1 && b.credits.length === 1, 'the same run credits a boss once');
  ok(!c.credits.length, 'a member on another map is not credited');
  a.send('bossKill', { boss: 'boss_a2' }); // not this room's boss: its map is the rift
  await until(() => a.errors.length, 2000, 'wrong map refused');
  ok(S.progress.bosses(a.id).includes('boss_a1') && !S.progress.bosses(c.id).length, 'server lists');
  await cleanup();
});

await test('a credited kill opens the next area at the Dungeon Gate; a new run credits again (not first)', async () => {
  const st = memStorage();
  let a = await player('Eryn', st);
  await a.at('lumina');
  a.send('dungeonEnter', { area: 'a1' }); await until(() => a.gos.length);
  await a.at('a1'); await a.at('arena', 500, 500);
  a.send('bossKill', { boss: 'boss_a1' });
  await until(() => a.credits.length);
  await a.at('lumina'); // back in the city: the run is over
  a.send('dungeonEnter', { area: 'a2' });
  await until(() => a.gos.length === 2, 2000, 'A2 now open');
  await a.at('lumina');
  a.send('dungeonEnter', { area: 'a1' }); await until(() => a.gos.length === 3);
  await a.at('a1'); await a.at('arena', 500, 500);
  a.send('bossKill', { boss: 'boss_a1' });
  await until(() => a.credits.length === 2, 2000, 'credited in the new run');
  ok(a.credits[1].first === false, 'repeat kill');
  a.c.stop(); all.length = 0; await until(() => !S.sessions.size);
  a = await player('Eryn', st);
  ok(a.progress.includes('boss_a1'), 'login sends the list');
  await cleanup();
});

await test('a save cannot forge kills; an old record is seeded once from its save; New Game clears', async () => {
  const st = memStorage();
  let a = await player('Fenn', st);
  a.send('saveWrite', { s: JSON.stringify({ v: 6, worldProgress: { defeatedBosses: { boss_b1: { time: 1 }, boss_b2: { time: 2 } } } }) });
  await wait(200);
  ok(!S.progress.bosses(a.id).length, 'saveWrite changes nothing');
  a.c.stop(); all.length = 0; await until(() => !S.sessions.size);
  // a record from before N8 (no progress field): trusted once
  const rec = S.saves.store.get(a.id); delete rec.progress; S.saves.store.set(a.id, rec);
  a = await player('Fenn', st);
  ok(a.progress.includes('boss_b1') && a.progress.includes('boss_b2'), 'seeded: ' + a.progress);
  await a.at('lumina');
  a.send('dungeonEnter', { area: 'b3' }); await until(() => a.gos.length, 2000, 'B3 open (B2 boss seeded)');
  a.send('saveRemove', {});
  await until(() => Array.isArray(a.progress) && !a.progress.length, 2000, 'New Game: empty list pushed');
  ok(!S.progress.bosses(a.id).length && S.saves.store.get(a.id).deletedProgress, 'cleared, old one kept aside');
  await cleanup();
});

await srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
