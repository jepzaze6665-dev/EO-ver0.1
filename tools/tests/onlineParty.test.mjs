// ONLINE N4 — parties on the server (server/parties.js) with real clients. Run:  node tools/tests/onlineParty.test.mjs
import { NetClient } from '../../src/net/client.js';
import { ONLINE } from '../../src/data/online.js';
import { NET_ERROR } from '../../src/net/protocol.js';
import { startServer } from '../../server.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 3000, what = 'condition') => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out: ' + what); await wait(10); } };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

const srv = await startServer({ port: 0, dataDir: null, quiet: true });
const url = `ws://localhost:${srv.port}/ws`;
const all = [];
const player = async (name, storage = memStorage()) => {
  const c = new NetClient({ url, storage });
  const P = { c, name, storage, party: undefined, invites: [], infos: [], errors: [] };
  c.on('party', (m) => { P.party = m.party; });
  c.on('partyInvite', (m) => P.invites.push(m));
  c.on('partyInviteGone', (m) => { P.invites = P.invites.filter((i) => i.party !== m.party); });
  c.on('partyInfo', (m) => P.infos.push(m.text));
  c.on('error', (m) => P.errors.push(m));
  c.connect(name);
  await until(() => c.online, 3000, name + ' online');
  P.id = c.player.id;
  P.send = (t, f = {}) => c.send(t, f);
  P.lastError = () => P.errors.at(-1);
  all.push(P);
  return P;
};
const join = async (leader, ...others) => {
  for (const o of others) {
    leader.send('partyInvite', { name: o.name });
    await until(() => o.invites.length, 2000, o.name + ' invited');
    o.send('partyAnswer', { party: o.invites.at(-1).party, yes: true });
    await until(() => o.party && o.party.members.some((m) => m.id === o.id), 2000, o.name + ' joined');
  }
  await until(() => leader.party && leader.party.members.length === others.length + 1, 2000, 'leader sees everyone');
};
const cleanup = async () => { for (const p of all.splice(0)) p.c.stop(); await until(() => !srv.game.sessions.size, 3000, 'all offline'); srv.game.parties.parties.clear(); srv.game.parties.byPlayer.clear(); };

console.log('onlineParty');
await test('scenario 3: invite by name -> accept -> both see the same party, the inviter leads', async () => {
  const a = await player('Aria'), b = await player('Borin');
  a.send('partyInvite', { name: 'borin' }); // any case
  await until(() => b.invites.length, 2000, 'invite arrives');
  ok(b.invites[0].from === 'Aria' && a.party && a.party.leader === a.id, 'a party was created for Aria');
  b.send('partyAnswer', { party: b.invites[0].party, yes: true });
  await until(() => b.party && a.party.members.length === 2, 2000, 'joined');
  ok(b.party.id === a.party.id && b.party.leader === a.id, 'same party, Aria leads');
  ok(a.party.members.every((m) => m.online), 'both online');
  ok(a.infos.some((t) => t.includes('Borin joined')), 'Aria told');
  await cleanup();
});
await test('refusals: offline name, yourself, a member who is not the leader, someone already in a party, a full party', async () => {
  const a = await player('Cyra'), b = await player('Dain'), c = await player('Eryn'), d = await player('Fenn'), e = await player('Gale');
  a.send('partyInvite', { name: 'Nobody' }); await until(() => a.errors.length === 1); ok(a.lastError().code === NET_ERROR.party && /not online/.test(a.lastError().text), 'offline');
  a.send('partyInvite', { name: 'Cyra' }); await until(() => a.errors.length === 2); ok(/yourself/.test(a.lastError().text), 'self');
  await join(a, b, c, d);
  b.send('partyInvite', { name: 'Gale' }); await until(() => b.errors.length); ok(/leader/.test(b.lastError().text), 'only the leader invites');
  a.send('partyInvite', { name: 'Gale' }); await until(() => a.errors.length === 3); ok(/full/.test(a.lastError().text), 'full at ' + ONLINE.party.maxSize);
  e.send('partyInvite', { name: 'Dain' }); await until(() => e.errors.length); ok(/already in a party/.test(e.lastError().text), 'already in a party');
  ok(!e.party, 'a refused invite creates no party');
  await cleanup();
});
await test('decline: no join, the inviter is told; the invite cannot be used again', async () => {
  const a = await player('Hale'), b = await player('Iris');
  a.send('partyInvite', { name: 'Iris' }); await until(() => b.invites.length);
  const id = b.invites[0].party;
  b.send('partyAnswer', { party: id, yes: false });
  await until(() => a.infos.some((t) => t.includes('declined')), 2000, 'told');
  b.send('partyAnswer', { party: id, yes: true }); await until(() => b.errors.length);
  ok(!b.party && a.party.members.length === 1, 'not joined');
  await cleanup();
});
await test('leader leaves -> the longest-standing member leads; the last one leaving disbands the party', async () => {
  const a = await player('Jory'), b = await player('Kade'), c = await player('Lark');
  await join(a, b, c);
  a.send('partyLeave'); await until(() => a.party === null && b.party.members.length === 2, 2000, 'left');
  ok(b.party.leader === b.id && c.party.leader === b.id, 'Kade leads now');
  b.send('partyLeave'); await until(() => c.party.members.length === 1);
  ok(c.party.leader === c.id, 'alone, leading');
  c.send('partyLeave'); await until(() => c.party === null);
  ok(srv.game.parties.parties.size === 0, 'disbanded');
  await cleanup();
});
await test('leader actions: make leader, remove a member (others cannot)', async () => {
  const a = await player('Mira'), b = await player('Nash'), c = await player('Orin');
  await join(a, b, c);
  c.send('partyKick', { id: b.id }); await until(() => c.errors.length); ok(b.party, 'member cannot kick');
  a.send('partyKick', { id: c.id }); await until(() => c.party === null && a.party.members.length === 2, 2000, 'kicked');
  ok(c.infos.some((t) => /removed/.test(t)), 'told');
  a.send('partyLead', { id: b.id }); await until(() => a.party.leader === b.id && b.party.leader === b.id, 2000, 'lead passed');
  a.send('partyKick', { id: b.id }); await until(() => a.errors.length); ok(b.party, 'old leader lost the right');
  await cleanup();
});
await test('disconnect: member stays (offline), leader role moves to an online member; reconnect = back in the party', async () => {
  const st = memStorage(), a = await player('Pell', st), b = await player('Quin');
  await join(a, b);
  a.c.stop();
  await until(() => b.party.members.find((m) => m.id === a.id && !m.online), 2000, 'shown offline');
  ok(b.party.leader === b.id, 'Quin leads while Pell is away');
  const a2 = await player('Pell', st);
  await until(() => a2.party && a2.party.members.length === 2, 2000, 'Pell gets the party back');
  ok(b.party.members.every((m) => m.online) && b.party.leader === b.id, 'online again, lead stays with Quin');
  ok(b.infos.some((t) => /back online/.test(t)), 'told');
  await cleanup();
});
await test('the offline grace runs out -> removed; an invite runs out -> withdrawn', async () => {
  const keep = { ...ONLINE.party };
  ONLINE.party.offlineGrace = 1; ONLINE.party.inviteTimeout = 1;
  try {
    const a = await player('Rhea'), b = await player('Sage'), c = await player('Tarn');
    await join(a, b);
    b.c.stop();
    await until(() => a.party.members.length === 1, 4000, 'removed after grace');
    ok(a.infos.some((t) => /too long/.test(t)), 'told');
    a.send('partyInvite', { name: 'Tarn' }); await until(() => c.invites.length);
    await until(() => !c.invites.length, 4000, 'invite withdrawn');
  } finally { Object.assign(ONLINE.party, keep); }
  await cleanup();
});
await test('a second login of the same player keeps one membership (no duplicate member)', async () => {
  const st = memStorage(), a = await player('Ulla', st), b = await player('Vane');
  await join(a, b);
  const a2 = await player('Ulla', st);
  await until(() => a2.party && b.party.members.filter((m) => m.name === 'Ulla').length === 1 && b.party.members.every((m) => m.online), 3000, 'one Ulla, online');
  ok(b.party.members.length === 2, 'two members');
  await cleanup();
});
await test('party list carries class / level / map from presence (for the HUD and N5)', async () => {
  const a = await player('Wren'), b = await player('Xan');
  await join(a, b);
  b.send('look', { c: 'astral_weaver', l: 7 }); b.send('pos', { m: 'lumina', x: 10, y: 10, d: 0, a: 'idle' });
  await until(() => { const m = a.party.members.find((x) => x.id === b.id); return m.c === 'astral_weaver' && m.l === 7 && m.m === 'lumina'; }, 3000, 'pushed by the tick');
  await cleanup();
});

await srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
