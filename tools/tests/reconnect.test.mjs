// ONLINE N10 — a dropped line in the middle of a party run: the client reconnects by itself (src/net/client.js backoff)
// and gets everything back: same run (instanceState), party member online again, same run-map room, the server's boss
// list, its save; the teammate sees it return; a kick for good ('replaced') does not retry.
// Run:  node tools/tests/reconnect.test.mjs
import { NetClient } from '../../src/net/client.js';
import { startServer } from '../../server.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 4000, what = 'condition') => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out: ' + what); await wait(10); } };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

const srv = await startServer({ port: 0, dataDir: null, quiet: true });
const url = `ws://localhost:${srv.port}/ws`;
const S = srv.game, all = [];
const player = async (name, storage = memStorage()) => {
  const c = new NetClient({ url, storage });
  const P = { c, name, inst: undefined, gos: [], invites: [], party: null, rooms: [], joins: [], leaves: [], progress: [], saves: [], states: [] };
  c.on('instanceState', (m) => { P.inst = m.instance; });
  c.on('dungeonGo', (m) => P.gos.push(m));
  c.on('partyInvite', (m) => P.invites.push(m));
  c.on('party', (m) => { P.party = m.party; });
  c.on('roomState', (m) => P.rooms.push(m.room));
  c.on('pJoin', (m) => P.joins.push(m.p[1]));
  c.on('pLeave', (m) => P.leaves.push(m.why));
  c.on('progress', (m) => P.progress.push(m.bosses));
  c.on('saveData', (m) => P.saves.push(m.main));
  c.onState((s) => P.states.push(s));
  c.connect(name);
  await until(() => c.online && P.inst !== undefined, 3000, name + ' online');
  P.id = c.player.id;
  P.send = (t, f = {}) => c.send(t, f);
  P.at = async (m, x = 100, y = 100) => { P.send('pos', { m, x, y, d: 0, a: 'idle' }); await until(() => { const p = S.sessions.get(P.id)?.presence; return p && p.m === m && p.room; }, 2000, `${name} at ${m}`); };
  all.push(P);
  return P;
};

console.log('reconnect');
await test('a dropped line mid-run: auto reconnect -> same run, same room, party online, boss list + save back, teammate sees the return', async () => {
  const a = await player('Aria'), b = await player('Borin');
  await a.at('lumina'); await b.at('lumina');
  a.send('partyInvite', { name: 'Borin' }); await until(() => b.invites.length);
  b.send('partyAnswer', { party: b.invites[0].party, yes: true }); await until(() => a.party && a.party.members.length === 2);
  a.send('dungeonPropose', { area: 'a1' });
  await until(() => S.dungeons.checks.size); b.send('dungeonAnswer', { check: [...S.dungeons.checks.keys()][0], yes: true });
  await until(() => a.gos.length && b.gos.length);
  await a.at('a1', 200, 200); await b.at('a1', 220, 200);
  b.send('saveWrite', { s: JSON.stringify({ v: 6, savedAt: 5, player: {} }) }); await until(() => S.saves.store.get(b.id)?.main);
  const inst = b.inst.id, progressBefore = b.progress.length, savesBefore = b.saves.length;
  b.c.ws.close(); // the line drops (not a logout)
  await until(() => a.party.members.find((m) => m.name === 'Borin').online === false, 3000, 'teammate sees Borin offline');
  ok(a.leaves.includes('offline'), 'left the room as offline');
  await until(() => b.c.online && b.states.includes('reconnecting'), 6000, 'reconnected by itself');
  await until(() => b.inst && b.inst.id === inst, 3000, 'same run');
  ok(b.progress.length === progressBefore + 1 && b.saves.length === savesBefore + 1 && b.saves.at(-1), 'boss list + save sent again');
  await b.at('a1', 220, 200); // the client sends its position again after a reconnect
  await until(() => b.rooms.at(-1) === `${inst}:a1` && a.joins.filter((n) => n === 'Borin').length >= 2, 3000, 'same room, Aria sees him back');
  await until(() => a.party.members.find((m) => m.name === 'Borin').online, 3000, 'party online again');
});
await test('a kick for good (logged in elsewhere) does not retry', async () => {
  const st = memStorage(), a = await player('Cyra', st);
  const a2 = new NetClient({ url, storage: st }); a2.connect('Cyra');
  await until(() => a2.online && !a.c.online, 3000, 'replaced');
  await wait(1500);
  ok(a.c.state === 'offline' && a.c.lastError && a.c.lastError.code === 'replaced' && !a.c.online, 'stays offline: ' + a.c.state);
  a2.stop();
});

for (const p of all) p.c.stop();
await srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
