// ONLINE H5a — the server economy ledger (server/economy.js): seeded once from the save, ops with reasons, refused ops come
// back as econUndo, kill rewards in rooms the server hosts are paid by the server, saves are patched to the ledger.
// Run:  node tools/tests/economy.test.mjs
import { NetClient } from '../../src/net/client.js';
import { startServer } from '../../server.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 4000, what = 'condition') => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out: ' + what); await wait(15); } };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const save = (o) => JSON.stringify({ v: 6, savedAt: Date.now(), player: { classId: 'umbral_sword', level: 3, exp: 10, gold: 100, x: 1, y: 1 }, inventory: { items: { hp_potion: 2 }, gear: [], storage: {}, storageGear: [] }, equipment: { inst: {} }, ...o });

const srv = await startServer({ port: 0, dataDir: null, quiet: true, simHosts: true });
const url = `ws://localhost:${srv.port}/ws`, S = srv.game, all = [];
const player = async (name, storage = memStorage()) => {
  const c = new NetClient({ url, storage });
  const P = { c, name, undo: [], grants: [], inst: undefined, gos: [], rooms: [], hosts: [] };
  c.on('econUndo', (m) => P.undo.push(m));
  c.on('econGrant', (m) => P.grants.push(m));
  c.on('instanceState', (m) => { P.inst = m.instance; });
  c.on('dungeonGo', (m) => P.gos.push(m));
  c.on('roomState', (m) => P.rooms.push(m.room));
  c.on('roomHost', (m) => P.hosts.push(m.host));
  c.connect(name);
  await until(() => c.online && P.inst !== undefined, 3000, name + ' online');
  P.id = c.player.id;
  P.send = (t, f = {}) => c.send(t, f);
  P.at = async (m, x = 100, y = 100) => { P.send('pos', { m, x, y, d: 0, a: 'idle' }); await until(() => { const p = S.sessions.get(P.id)?.presence; return p && p.m === m && p.room; }, 2000, `${name} at ${m}`); };
  all.push(P);
  return P;
};

console.log('economy');
await test('an old record is seeded once from its save; later saves cannot change gold / items (patched to the ledger)', async () => {
  const st = memStorage(), a = await player('Aria', st);
  a.c.stop(); await until(() => !S.sessions.size);
  const rec = S.saves.store.get(a.id) || {};
  S.saves.store.set(a.id, { ...rec, main: save(), econ: undefined });
  const b = await player('Aria', st);
  void b;
  const e = S.economy.get(a.id);
  ok(e.gold === 100 && e.level === 3 && e.items.hp_potion === 2, JSON.stringify(e));
  all.at(-1).send('saveWrite', { s: save({ player: { classId: 'umbral_sword', level: 40, exp: 0, gold: 999999, x: 1, y: 1 }, inventory: { items: { hp_potion: 99, rune_crystal: 50 }, gear: [{ instanceId: 'item_000001', itemId: 'relic_oath_mirror' }], storage: {}, storageGear: [] } }) });
  await until(() => JSON.parse(S.saves.store.get(a.id).main).player.gold !== 999999 || false, 2000, 'stored');
  const d = JSON.parse(S.saves.store.get(a.id).main);
  ok(d.player.gold === 100 && d.player.level === 3 && d.inventory.items.hp_potion === 2 && !d.inventory.items.rune_crystal && !d.inventory.gear.length, JSON.stringify(d.inventory));
});
await test('ops: a not-yet-checked reward is accepted (counted unverified), spending more than you own / a duplicate gear id is undone', async () => {
  const a = all.at(-1), e = S.economy.get(a.id), u0 = e.unverified;
  a.send('econ', { ops: [['i', 'rune_crystal', 3, ['npc', 'gift']], ['$', 50, ['npc', 'gift']], ['g+', { instanceId: 'item_000010', itemId: 'relic_oath_mirror' }, ['npc', 'gift']]] });
  await until(() => S.economy.get(a.id).items.rune_crystal === 3, 2000, 'applied');
  ok(e.gold === 150 && e.gear.item_000010 && e.unverified === u0 + 3, 'gold / gear / unverified');
  a.send('econ', { ops: [['$', -1000, ['buy', 'x']], ['g+', { instanceId: 'item_000010', itemId: 'relic_oath_mirror' }, ['other']], ['i', 'hp_potion', -9, ['use', 'hp_potion']]] });
  await until(() => a.undo.length === 3, 2000, 'three undos');
  ok(e.gold === 150 && e.items.hp_potion === 2, 'nothing changed');
});
await test('in a room the server hosts: a client claiming kill rewards is undone; the server pays the kill itself (econGrant)', async () => {
  const a = all.at(-1);
  await a.at('lumina');
  a.send('dungeonEnter', { area: 'a1' }); await until(() => a.gos.length);
  await a.at('a1', 1600, 4900);
  await until(() => a.hosts.at(-1)?.startsWith('sim'), 20000, 'server host');
  const n = a.undo.length;
  a.send('econ', { ops: [['xp', 500, ['kill', 'wolf']], ['$', 30, ['kill', 'wolf']]] });
  await until(() => a.undo.length === n + 2, 2000, 'kill claims undone');
  const sim = S.simHosts.rooms.get(a.rooms.at(-1)).sim.game, wolf = sim.world.monsters.find((m) => !m.dead && m.type === 'wolf');
  const before = { ...S.economy.get(a.id) };
  wolf.dead = true; sim.world.onMonsterKilled(wolf, null);
  await until(() => a.grants.length, 2000, 'grant');
  const g = a.grants[0], xp = g.ops.find((o) => o[0] === 'xp');
  ok(xp && xp[1] > 0 && g.src === 'wolf', JSON.stringify(g));
  const after = S.economy.get(a.id);
  ok(after.level * 1e6 + after.exp > before.level * 1e6 + before.exp, 'ledger EXP grew');
});
await test('H5b: a quest pays what its data says, once; more than that / a second time / an unknown quest is undone', async () => {
  const { QUESTS } = await import('../../src/data/quests.js');
  const [qid, q] = Object.entries(QUESTS).find(([, x]) => x.rewards && x.rewards.gold > 0 && x.rewards.items && Object.keys(x.rewards.items).length);
  const a = all.at(-1), e = S.economy.get(a.id), gold0 = e.gold, item = Object.keys(q.rewards.items)[0], n0 = a.undo.length;
  a.send('econ', { ops: [['$', q.rewards.gold, ['quest', qid]], ['i', item, q.rewards.items[item], ['quest', qid]]] });
  await until(() => S.economy.get(a.id).gold === gold0 + q.rewards.gold, 2000, 'paid');
  a.send('econ', { ops: [['$', 1, ['quest', qid]], ['$', 5, ['quest', 'no_such_quest']]] });
  await until(() => a.undo.length === n0 + 2, 2000, 'second claim + unknown quest undone');
  ok(S.economy.get(a.id).gold === gold0 + q.rewards.gold, 'nothing more paid');
});
await test('H5b: a map chest pays its data loot once; gold above it is undone; an area discovery pays its EXP once', async () => {
  const a = all.at(-1), e = S.economy.get(a.id), n0 = a.undo.length;
  a.send('econ', { ops: [['$', 999, ['chest', 'b1_chest_tower']]] });
  await until(() => a.undo.length === n0 + 1, 2000, 'too much gold undone');
  const g0 = e.gold;
  a.send('econ', { ops: [['$', 120, ['chest', 'b1_chest_tower']], ['i', 'frost_pelt', 2, ['chest', 'b1_chest_tower']], ['i', 'frost_pelt', 1, ['chest', 'b1_chest_tower']]] });
  await until(() => a.undo.length === n0 + 2, 2000, 'third pelt undone');
  ok(S.economy.get(a.id).gold === g0 + 120 && S.economy.get(a.id).items.frost_pelt === 2, 'paid once');
  a.send('econ', { ops: [['xp', 5, ['explore', 'areaDiscovered:Old Ford']], ['xp', 5, ['explore', 'areaDiscovered:Old Ford']]] });
  await until(() => a.undo.length === n0 + 3, 2000, 'second discovery undone');
});
await test('New Game clears the ledger', async () => {
  const a = all.at(-1);
  a.send('saveRemove', {});
  await until(() => S.economy.get(a.id).gold === 0 && !Object.keys(S.economy.get(a.id).items).length, 2000, 'cleared');
});

for (const p of all) p.c.stop();
await srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
