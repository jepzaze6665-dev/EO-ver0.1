// ONLINE N9 — death piles on the server (server/piles.js): only the party sees a member's pile; carrying it needs the same
// map, close enough, the owner online. Run:  node tools/tests/piles.test.mjs
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
const player = async (name) => {
  const c = new NetClient({ url, storage: memStorage() });
  const P = { c, name, piles: [], taken: [], errors: [], invites: [], party: null, info: [] };
  c.on('piles', (m) => { P.piles = m.list; });
  c.on('pileTaken', (m) => P.taken.push(m));
  c.on('error', (m) => P.errors.push(m.text));
  c.on('partyInvite', (m) => P.invites.push(m));
  c.on('party', (m) => { P.party = m.party; });
  c.on('partyInfo', (m) => P.info.push(m.text));
  c.connect(name);
  await until(() => c.online, 3000, name + ' online');
  P.id = c.player.id;
  P.send = (t, f = {}) => c.send(t, f);
  P.at = async (m, x = 100, y = 100) => { P.send('pos', { m, x, y, d: 0, a: 'idle' }); await until(() => { const p = S.sessions.get(P.id)?.presence; return p && p.m === m && p.x === x && p.room; }, 2000, `${name} at ${m}`); };
  all.push(P);
  return P;
};
const party = async (a, b) => {
  await a.at('lumina'); await b.at('lumina');
  a.send('partyInvite', { name: b.name }); await until(() => b.invites.length);
  b.send('partyAnswer', { party: b.invites[0].party, yes: true }); await until(() => b.party && a.party && a.party.members.length === 2);
};
const cleanup = async () => { for (const p of all.splice(0)) p.c.stop(); await until(() => !S.sessions.size, 3000); S.parties.parties.clear(); S.parties.byPlayer.clear(); for (const id of [...S.dungeons.instances.byPlayer.keys()]) S.dungeons.instances.leave(id); };

console.log('piles');
await test('a pile is shown to party members only (not to the owner, not to strangers)', async () => {
  const a = await player('Aria'), b = await player('Borin'), c = await player('Cyra');
  await party(a, b); await c.at('lumina');
  a.send('pileSet', { m: 'a1', x: 500, y: 600, n: 4 });
  await until(() => b.piles.length, 2000, 'Borin sees it');
  ok(b.piles[0].owner === a.id && b.piles[0].name === 'Aria' && b.piles[0].m === 'a1' && b.piles[0].n === 4, JSON.stringify(b.piles));
  await wait(700);
  ok(!a.piles.length && !c.piles.length, 'owner / stranger get no list');
  a.send('pileClear', {});
  await until(() => !b.piles.length, 2000, 'cleared');
  await cleanup();
});
await test('carrying: refused from a city / another map / too far / by a stranger; close in the run = the owner gets it', async () => {
  const a = await player('Dain'), b = await player('Eryn'), c = await player('Fenn');
  await party(a, b);
  a.send('pileSet', { m: 'a1', x: 500, y: 600, n: 2 });
  await until(() => b.piles.length);
  b.send('pileTake', { owner: a.id }); await until(() => b.errors.length === 1); // Eryn is in Lumina
  await b.at('a1', 900, 900);
  b.send('pileTake', { owner: a.id }); await until(() => b.errors.length === 2);
  ok(/far/.test(b.errors[1]), b.errors[1]);
  await c.at('lumina'); await c.at('a1', 505, 600);
  c.send('pileTake', { owner: a.id }); await until(() => c.errors.length);
  ok(/party/.test(c.errors[0]), c.errors[0]);
  await b.at('a1', 540, 610);
  b.send('pileTake', { owner: a.id });
  await until(() => a.taken.length, 2000, 'owner told');
  ok(a.taken[0].by === 'Eryn' && b.info.some((t) => /carried/.test(t)), 'by + info');
  await until(() => !b.piles.length, 2000, 'gone from the list');
  b.send('pileTake', { owner: a.id }); await until(() => b.errors.length === 3);
  ok(/gone/.test(b.errors[2]), 'cannot take twice');
  await cleanup();
});
await test('an offline owner: the pile is hidden until they log in and send it again', async () => {
  const a = await player('Gale'), b = await player('Hale');
  await party(a, b);
  a.send('pileSet', { m: 'a2', x: 100, y: 100, n: 1 });
  await until(() => b.piles.length);
  a.c.stop();
  await until(() => !b.piles.length, 3000, 'hidden');
  await cleanup();
});

await srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
