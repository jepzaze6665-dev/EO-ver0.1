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
await test('H5c: a gain from an unchecked source is undone; spending more than you own is undone', async () => {
  const a = all.at(-1), e = S.economy.get(a.id), g0 = e.gold, n0 = a.undo.length;
  a.send('econ', { ops: [['i', 'rune_crystal', 3, ['npc', 'gift']], ['$', 50, ['other']], ['g+', { instanceId: 'item_000010', itemId: 'relic_oath_mirror' }, ['npc', 'gift']], ['i', 'hp_potion', -9, ['use', 'hp_potion']]] });
  await until(() => a.undo.length === n0 + 4, 2000, 'four undos');
  ok(e.gold === g0 && !e.items.rune_crystal && !e.gear.item_000010 && e.items.hp_potion === 2, 'nothing changed');
});
await test('H5c shop: the right price buys one item; a wrong price / an item not paid for is undone; selling pays its sell price', async () => {
  const { ITEMS } = await import('../../src/items/items.js');
  const a = all.at(-1), e = S.economy.get(a.id), n0 = a.undo.length, price = ITEMS.hp_potion.price, g0 = e.gold, p0 = e.items.hp_potion || 0;
  a.send('econ', { ops: [['$', -price, ['buy', 'hp_potion']], ['i', 'hp_potion', 1, ['buy', 'hp_potion']], ['i', 'hp_potion', 1, ['buy', 'hp_potion']], ['$', -1, ['buy', 'hp_potion']]] });
  await until(() => a.undo.length === n0 + 2, 2000, 'second potion + wrong price undone');
  ok(e.gold === g0 - price && e.items.hp_potion === p0 + 1, 'one bought');
  // an HP potion has no sell price in the data: selling one pays nothing, any gold for it is undone
  ok(!ITEMS.hp_potion.sell, 'data: potions do not sell');
  a.send('econ', { ops: [['i', 'hp_potion', -1, ['sell', 'hp_potion']], ['$', 5, ['sell', 'hp_potion']]] });
  await until(() => a.undo.length === n0 + 3, 2000, 'gold for the sale undone');
  ok(e.gold === g0 - price && e.items.hp_potion === p0, 'given away, nothing paid');
});
await test('H5c death pile: lost items (pileDrop) come back only from that pile; the EXP loss is kept', async () => {
  const a = all.at(-1), e = S.economy.get(a.id), n0 = a.undo.length, p0 = e.items.hp_potion, x0 = e.exp;
  a.send('econ', { ops: [['i', 'hp_potion', -1, ['pileDrop', '111']], ['xp-', Math.min(3, x0), ['pileDrop', '111']]] });
  await until(() => e.items.hp_potion === p0 - 1, 2000, 'dropped');
  ok(e.exp === x0 - Math.min(3, x0) && e.pile && e.pile.at === '111', 'pile kept on the server');
  a.send('econ', { ops: [['i', 'hp_potion', 2, ['pile', '111']], ['i', 'hp_potion', 1, ['pile', '999']], ['i', 'hp_potion', 1, ['pile', '111']], ['xp-', 5, ['other']]] });
  await until(() => a.undo.length === n0 + 3, 2000, 'too many / wrong pile / stray exp loss undone');
  ok(e.items.hp_potion === p0, 'the one potion back');
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
  // RANDOM CHESTS: the server rolls the same seeded table as the client (player id + chest id)
  const { chestLoot, seededRng } = await import('../../src/loot/lootSystem.js');
  const r = chestLoot({ id: 'b1_chest_tower', kind: 'chest', gold: 120 }, seededRng(a.id + '|b1_chest_tower'));
  const g0 = e.gold, ops = [['$', r.gold, ['chest', 'b1_chest_tower']], ...r.items.map((l) => ['i', l.item, l.count, ['chest', 'b1_chest_tower']]), ['i', 'frost_pelt', 1, ['chest', 'b1_chest_tower']]];
  a.send('econ', { ops });
  await until(() => a.undo.length === n0 + 2, 2000, 'pelt (not in the roll) undone');
  ok(S.economy.get(a.id).gold === g0 + r.gold, 'paid the roll');
  a.send('econ', { ops: [['xp', 5, ['explore', 'areaDiscovered:Old Ford']], ['xp', 5, ['explore', 'areaDiscovered:Old Ford']]] });
  await until(() => a.undo.length === n0 + 3, 2000, 'second discovery undone');
});
await test('New Game resets the ledger to the starting kit', async () => {
  const a = all.at(-1);
  a.send('saveRemove', {});
  const { START_KIT } = await import('../../server/economy.js');
  await until(() => S.economy.get(a.id).gold === START_KIT.gold && JSON.stringify(S.economy.get(a.id).items) === JSON.stringify(START_KIT.items), 2000, 'back to the starting kit');
});

await test('DIAMONDS: a client gain is undone (only "dev" on a dev-login server); a respec spends from the ledger; a save cannot raise them', async () => {
  const a = await player('Gem'), e = S.economy.get(a.id), n0 = a.undo.length;
  a.send('econ', { ops: [['d', 500, ['other']], ['d', -5, ['respec', 'skills']]] });
  await until(() => a.undo.length === n0 + 2, 2000, 'free gain + spending nothing both undone');
  ok(!e.diamonds, 'still 0');
  a.send('econ', { ops: [['d', 100, ['dev', 'diamonds']]] }); // unit-test server = dev login
  await until(() => e.diamonds === 100, 2000, 'dev grant');
  a.send('econ', { ops: [['d', -50, ['respec', 'evolution']], ['d', -10, ['buy', 'hp_potion']]] });
  await until(() => a.undo.length === n0 + 3, 2000, 'diamonds spent on a shop = undone');
  ok(e.diamonds === 50, 'respec spent: ' + e.diamonds);
  ok(S.economy.grantDiamonds(a.id, 25) && e.diamonds === 75, 'server grant (top-up)');
  await until(() => a.grants.some((m) => m.ops[0][0] === 'd' && m.ops[0][1] === 25), 2000, 'grant sent to the client');
  a.send('saveWrite', { s: save({ player: { classId: 'umbral_sword', level: 1, exp: 0, gold: 0, diamonds: 99999, x: 1, y: 1 } }) });
  await until(() => S.saves.store.get(a.id)?.main, 2000, 'stored');
  ok(JSON.parse(S.saves.store.get(a.id).main).player.diamonds === 75, 'save patched to the ledger');
  S.devGrants = false;
  a.send('econ', { ops: [['d', 100, ['dev', 'diamonds']]] });
  await until(() => a.undo.length === n0 + 4, 2000, 'dev grant refused on a real server');
  S.devGrants = true;
});

for (const p of all) p.c.stop();
await srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
