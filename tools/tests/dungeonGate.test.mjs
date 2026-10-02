// ONLINE N5 — Dungeon Gate: area list rules, solo entry, party ready check (server/dungeons.js) with real clients.
// Run:  node tools/tests/dungeonGate.test.mjs
import { NetClient } from '../../src/net/client.js';
import { ONLINE } from '../../src/data/online.js';
import { MAPS } from '../../src/maps/mapRegistry.js';
import { NET_ERROR } from '../../src/net/protocol.js';
import { startServer } from '../../server.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 3000, what = 'condition') => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out: ' + what); await wait(10); } };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

console.log('dungeonGate');
await test('areas = every non-secret field map; free exactly when the map has no requirement', () => {
  const fields = MAPS.filter((m) => m.type === 'field' && !m.secret);
  ok(JSON.stringify(fields.map((m) => m.id).sort()) === JSON.stringify(ONLINE.dungeon.areas.map((a) => a.id).sort()), 'same list');
  for (const a of ONLINE.dungeon.areas) { const m = MAPS.find((x) => x.id === a.id); ok(!!a.free === !(m.requires && m.requires.length), a.id + ' free flag'); ok(m.spawn, a.id + ' has a spawn'); }
});

const srv = await startServer({ port: 0, dataDir: null, quiet: true });
const url = `ws://localhost:${srv.port}/ws`;
const all = [];
const player = async (name, { city = 'lumina', unlocked = null } = {}) => {
  const c = new NetClient({ url, storage: memStorage() });
  const P = { c, name, errors: [], checks: [], cancels: [], gos: [], party: null, invites: [] };
  c.on('error', (m) => P.errors.push(m));
  c.on('dungeonCheck', (m) => P.checks.push(m));
  c.on('dungeonCancel', (m) => P.cancels.push(m));
  c.on('dungeonGo', (m) => P.gos.push(m));
  c.on('party', (m) => { P.party = m.party; });
  c.on('partyInvite', (m) => P.invites.push(m));
  let saved = false;
  c.on('saveData', () => { saved = true; });
  c.connect(name);
  await until(() => c.online && saved, 3000, name + ' online');
  P.id = c.player.id;
  P.send = (t, f = {}) => c.send(t, f);
  if (unlocked) { // N8: unlocks come from the server's boss kills (server/progress.js): credit the boss before each map
    const prog = srv.game.progress.get(P.id), need = { a2: 'boss_a1', a3: 'boss_a2', b2: 'boss_b1', b3: 'boss_b2' };
    for (const m of unlocked) if (need[m]) prog.bosses[need[m]] = 1;
  }
  if (city) { P.send('pos', { m: city, x: 100, y: 100, d: 0, a: 'idle' }); await until(() => ONLINE.sharedMaps.includes(city) ? srv.game.city.rooms.get(city)?.has(srv.game.sessions.get(P.id)) : srv.game.sessions.get(P.id).presence?.m === city, 2000, 'placed'); }
  all.push(P);
  return P;
};
const errText = (P) => (P.errors.at(-1) || {}).text || '';
const makeParty = async (leader, ...others) => {
  for (const o of others) {
    leader.send('partyInvite', { name: o.name }); await until(() => o.invites.length);
    o.send('partyAnswer', { party: o.invites.at(-1).party, yes: true }); await until(() => o.party);
  }
  await until(() => leader.party && leader.party.members.length === others.length + 1);
};
const cleanup = async () => { for (const p of all.splice(0)) p.c.stop(); await until(() => !srv.game.sessions.size, 3000); srv.game.parties.parties.clear(); srv.game.parties.byPlayer.clear(); };

await test('scenario 4: solo entry into a free area from the city -> own instance', async () => {
  const a = await player('Aria'), b = await player('Borin');
  a.send('dungeonEnter', { area: 'a1' }); b.send('dungeonEnter', { area: 'b1' });
  await until(() => a.gos.length && b.gos.length, 2000, 'both sent');
  ok(a.gos[0].area === 'a1' && a.gos[0].mode === 'solo' && a.gos[0].members.join() === 'Aria', 'Aria solo A1');
  ok(a.gos[0].instance !== b.gos[0].instance, 'separate instances');
  ok(srv.game.dungeons.instances.of(a.id).area === 'a1', 'server knows where Aria is');
  await cleanup();
});
await test('scenario 7: a locked area cannot be entered; unlocked on the server = allowed; not in a city = refused', async () => {
  const a = await player('Cyra'), b = await player('Dain', { unlocked: ['a1', 'a2'] }), c = await player('Eryn', { city: 'a1' });
  a.send('dungeonEnter', { area: 'a2' }); await until(() => a.errors.length);
  ok(a.errors[0].code === NET_ERROR.dungeon && /locked/.test(errText(a)) && !a.gos.length, 'locked: ' + errText(a));
  b.send('dungeonEnter', { area: 'a2' }); await until(() => b.gos.length, 2000, 'Dain enters A2');
  c.send('dungeonEnter', { area: 'a1' }); await until(() => c.errors.length);
  ok(/city/.test(errText(c)) && !c.gos.length, 'not in a city');
  a.send('dungeonEnter', { area: 'arena' }); await until(() => a.errors.length === 2);
  ok(/unknown/.test(errText(a)), 'arenas / secret maps cannot be picked');
  await cleanup();
});
await test('scenario 5: party — leader proposes, each member accepts for themselves, ONE instance for all', async () => {
  const a = await player('Fenn'), b = await player('Gale'), c = await player('Hale');
  await makeParty(a, b, c);
  b.send('dungeonPropose', { area: 'a1' }); await until(() => b.errors.length);
  ok(/leader/.test(errText(b)), 'only the leader proposes');
  a.send('dungeonPropose', { area: 'a1' });
  await until(() => b.checks.length && c.checks.length, 2000, 'ready check');
  const chk = b.checks[0];
  ok(chk.leader === 'Fenn' && chk.members.find((m) => m.name === 'Fenn').answer === 'yes' && chk.members.find((m) => m.name === 'Gale').answer === 'wait', 'leader counted, members wait');
  ok(!a.gos.length, 'nobody moved yet');
  b.send('dungeonAnswer', { check: chk.check, yes: true });
  await until(() => c.checks.length >= 2 && c.checks.at(-1).members.find((m) => m.name === 'Gale').answer === 'yes', 2000, 'progress pushed');
  ok(!a.gos.length, 'still waiting for Hale');
  c.send('dungeonAnswer', { check: chk.check, yes: true });
  await until(() => a.gos.length && b.gos.length && c.gos.length, 2000, 'all go');
  ok(new Set([a, b, c].map((p) => p.gos[0].instance)).size === 1 && a.gos[0].mode === 'party' && a.gos[0].members.length === 3, 'same instance');
  await cleanup();
});
await test('party: a member without the unlock blocks it with a clear message naming them', async () => {
  const a = await player('Iris', { unlocked: ['a2'] }), b = await player('Jory');
  await makeParty(a, b);
  a.send('dungeonPropose', { area: 'a2' }); await until(() => a.errors.length);
  ok(/Jory has not unlocked/.test(errText(a)) && !b.checks.length, errText(a));
  await cleanup();
});
await test('party: decline / leaving the party / disconnecting / time running out all cancel for everyone', async () => {
  const keep = ONLINE.dungeon.readyTimeout;
  const a = await player('Kade'), b = await player('Lark'), c = await player('Mira');
  await makeParty(a, b, c);
  a.send('dungeonPropose', { area: 'b1' }); await until(() => b.checks.length);
  b.send('dungeonAnswer', { check: b.checks[0].check, yes: false });
  await until(() => a.cancels.length && c.cancels.length, 2000, 'declined');
  ok(/Lark declined/.test(a.cancels[0].reason), a.cancels[0].reason);
  a.send('dungeonPropose', { area: 'b1' }); await until(() => c.checks.length >= 2);
  c.send('partyLeave'); await until(() => a.cancels.length === 2, 3000, 'party changed');
  a.send('dungeonPropose', { area: 'b1' }); await until(() => b.checks.length >= 3);
  b.c.stop(); await until(() => a.cancels.length === 3, 3000, 'disconnect');
  ok(/disconnected|party changed/.test(a.cancels[2].reason), a.cancels[2].reason);
  ok(!a.gos.length, 'nobody entered');
  await cleanup();
  ONLINE.dungeon.readyTimeout = 1;
  try {
    const d = await player('Nash'), e = await player('Orin');
    await makeParty(d, e);
    d.send('dungeonPropose', { area: 'a1' }); await until(() => e.checks.length);
    await until(() => d.cancels.length && e.cancels.length, 3000, 'timeout');
    ok(/in time/.test(d.cancels[0].reason), d.cancels[0].reason);
  } finally { ONLINE.dungeon.readyTimeout = keep; }
  await cleanup();
});
await test('the leader cannot force anyone: no answer = no entry; the leader can cancel', async () => {
  const a = await player('Pell'), b = await player('Quin');
  await makeParty(a, b);
  a.send('dungeonPropose', { area: 'a1' }); await until(() => b.checks.length);
  a.send('dungeonAnswer', { check: b.checks[0].check, yes: true }); // answering again changes nothing
  await wait(300);
  ok(!a.gos.length && !b.gos.length, 'nobody moved');
  a.send('dungeonCancel'); await until(() => b.cancels.length);
  ok(/cancelled/.test(b.cancels[0].reason), b.cancels[0].reason);
  await cleanup();
});

await srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
