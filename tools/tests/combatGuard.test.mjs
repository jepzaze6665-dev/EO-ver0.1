// ONLINE H3a — limits on the damage players report (server/combatGuard.js): a huge hit is cut to the level's limit, too much
// damage / too many hits in a second are dropped, honest numbers pass untouched; over the network the host gets the cut hit.
// Run:  node tools/tests/combatGuard.test.mjs
import { CombatGuard, COMBAT_GUARD, baseAttack } from '../../server/combatGuard.js';
import { NetClient } from '../../src/net/client.js';
import { startServer } from '../../server.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 3000, what = 'condition') => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out: ' + what); await wait(10); } };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const fake = (level) => ({ log: {}, economy: { get: () => ({ level }) } });

console.log('combatGuard');
await test('the limit grows with the level and uses the strongest class', () => {
  ok(baseAttack(50) > baseAttack(1) && baseAttack(1) >= 20, `${baseAttack(1)} -> ${baseAttack(50)}`);
});
await test('honest hits pass untouched; a huge hit is cut to perHit × attack', () => {
  const G = new CombatGuard(fake(10)), s = { name: 'A' }, atk = baseAttack(10);
  const m = { id: 'm1', dmg: Math.floor(atk * 20) };
  ok(G.check(s, m) === m, 'honest hit is the same object');
  const r = G.check({ name: 'B' }, { id: 'm1', dmg: 999999, ad: 999999 });
  ok(r.dmg === Math.floor(atk * COMBAT_GUARD.perHit) && r.ad === r.dmg, JSON.stringify(r));
});
await test('too much damage in one second / too many hits are dropped', () => {
  const G = new CombatGuard(fake(10)), s = { name: 'C' }, atk = baseAttack(10);
  let passed = 0;
  for (let i = 0; i < 10; i++) if (G.check(s, { id: 'x', dmg: Math.floor(atk * 30) })) passed++;
  ok(passed === Math.floor(COMBAT_GUARD.perSecond / 30), 'per second budget: ' + passed);
  const s2 = { name: 'D' };
  let n = 0;
  for (let i = 0; i < 100; i++) if (G.check(s2, { id: 'x', dmg: 1 })) n++;
  ok(n === COMBAT_GUARD.hitsPerSecond, 'hit rate: ' + n);
});
await test('over the network: the room host receives the cut hit', async () => {
  const srv = await startServer({ port: 0, dataDir: null, quiet: true });
  const url = `ws://localhost:${srv.port}/ws`, S = srv.game;
  const mk = async (name) => { const c = new NetClient({ url, storage: memStorage() }), P = { c, hits: [], gos: [], invites: [], party: null }; c.on('mobHit', (m) => P.hits.push(m)); c.on('dungeonGo', (m) => P.gos.push(m)); c.on('partyInvite', (m) => P.invites.push(m)); c.on('party', (m) => { P.party = m.party; }); c.connect(name); await until(() => c.online); P.id = c.player.id; P.at = async (m) => { c.send('pos', { m, x: 200, y: 200, d: 0, a: 'idle' }); await until(() => S.sessions.get(P.id)?.presence?.m === m && S.sessions.get(P.id)?.presence?.room); }; return P; };
  const a = await mk('Host'), b = await mk('Guest');
  await a.at('lumina'); await b.at('lumina');
  a.c.send('partyInvite', { name: 'Guest' }); await until(() => b.invites.length);
  b.c.send('partyAnswer', { party: b.invites[0].party, yes: true }); await until(() => a.party && a.party.members.length === 2);
  a.c.send('dungeonPropose', { area: 'a1' }); await until(() => S.dungeons.checks.size);
  b.c.send('dungeonAnswer', { check: [...S.dungeons.checks.keys()][0], yes: true }); await until(() => a.gos.length && b.gos.length);
  await a.at('a1'); await b.at('a1');
  b.c.send('mobHit', { id: 'm7', dmg: 999999 });
  await until(() => a.hits.length, 2000, 'host got the hit');
  ok(a.hits[0].dmg === Math.floor(baseAttack(1) * COMBAT_GUARD.perHit), 'cut: ' + a.hits[0].dmg);
  a.c.stop(); b.c.stop(); await srv.close();
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
