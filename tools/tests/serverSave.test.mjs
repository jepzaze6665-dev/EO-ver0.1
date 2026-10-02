// ONLINE N3 — saves on the server: SaveService (server/saves.js), JsonDirStore, ServerSaveAdapter (src/net/serverSave.js).
// Run:  node tools/tests/serverSave.test.mjs
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { NetClient } from '../../src/net/client.js';
import { ServerSaveAdapter } from '../../src/net/serverSave.js';
import { SaveSystem, SAVE_KEY, BACKUP_KEY } from '../../src/save/save.js';
import { NET_ERROR, NET_LIMITS } from '../../src/net/protocol.js';
import { startServer } from '../../server.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 3000, what = 'condition') => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out: ' + what); await wait(10); } };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const save = (n, extra = {}) => JSON.stringify({ v: 6, savedAt: n, player: { level: n }, ...extra });
const fakeNet = () => { const sent = [], ls = {}; return { sent, online: true, send(t, f) { if (!this.online) return false; sent.push({ t, ...f }); return true; }, on(t, fn) { ls[t] = fn; }, fire(t, m) { ls[t] && ls[t](m); } }; };

console.log('serverSave');
await test('adapter: reads the server copy, a write is instant locally and goes out once per interval (newest wins)', async () => {
  const net = fakeNet(), a = new ServerSaveAdapter(net, { mainKey: SAVE_KEY, backupKey: BACKUP_KEY });
  a.load({ main: save(1), backup: null });
  ok(a.read(SAVE_KEY) === save(1) && a.read(BACKUP_KEY) === null, 'loaded');
  a.write(SAVE_KEY, save(2));
  ok(a.read(SAVE_KEY) === save(2) && a.read(BACKUP_KEY) === save(1), 'local copy + backup rotate');
  ok(net.sent.length === 1 && net.sent[0].s === save(2), 'sent');
  a.write(SAVE_KEY, save(3)); a.write(SAVE_KEY, save(4));
  ok(net.sent.length === 1, 'throttled');
  await until(() => net.sent.length === 2, 2500, 'second send');
  ok(net.sent[1].s === save(4), 'only the newest is sent: ' + net.sent[1].s);
  a.write(BACKUP_KEY, 'x'); ok(net.sent.length === 2, 'backup writes stay local');
  a.reset();
});
await test('adapter: line down -> the newest save waits; after reconnect it wins unless the server has a newer one', async () => {
  const net = fakeNet(), a = new ServerSaveAdapter(net, { mainKey: SAVE_KEY, backupKey: BACKUP_KEY });
  a.load({ main: save(5), backup: null });
  net.online = false;
  a.write(SAVE_KEY, save(9));
  ok(!a.synced && net.sent.length === 0, 'waiting');
  net.online = true;
  ok(a.load({ main: save(5), backup: null }) === 'local' && a.read(SAVE_KEY) === save(9), 'local newer wins');
  ok(net.sent.at(-1).s === save(9), 'resent after reconnect');
  net.online = false; a.lastSent = 0; a.write(SAVE_KEY, save(10)); net.online = true;
  ok(a.load({ main: save(20), backup: null }) === 'server' && a.read(SAVE_KEY) === save(20), 'server newer wins');
  a.reset();
});
await test('SaveSystem works unchanged on the adapter (exists / load / reset)', () => {
  const net = fakeNet(), a = new ServerSaveAdapter(net, { mainKey: SAVE_KEY, backupKey: BACKUP_KEY });
  const ss = new SaveSystem({}, a);
  a.load({ main: null, backup: null });
  ok(!ss.exists(), 'no save');
  a.load({ main: 'garbage', backup: null });
  ok(ss.exists() && !ss.load(), 'damaged main, no backup -> null');
  ss.reset();
  ok(!ss.exists() && net.sent.some((m) => m.t === 'saveRemove'), 'reset -> saveRemove');
  a.reset();
});

const dir = mkdtempSync(join(tmpdir(), 'eo-save-'));
let srv = await startServer({ port: 0, dataDir: dir, quiet: true });
const url = () => `ws://localhost:${srv.port}/ws`;
const login = async (name, storage = memStorage()) => {
  const c = new NetClient({ url: url(), storage }), got = [];
  for (const t of ['saveData', 'saveOk', 'error']) c.on(t, (m) => got.push(m));
  c.connect(name);
  await until(() => got.some((m) => m.t === 'saveData'), 3000, name + ' saveData');
  return { c, got, storage, data: () => got.filter((m) => m.t === 'saveData').at(-1) };
};

await test('server: a new player has no save; a write is stored, acknowledged and comes back on the next login', async () => {
  const st = memStorage(), a = await login('Aria', st);
  ok(a.data().main === null && a.data().backup === null, 'empty');
  a.c.send('saveWrite', { s: save(1) });
  await until(() => a.got.some((m) => m.t === 'saveOk' && m.at === 1), 2000, 'saveOk');
  a.c.stop();
  const b = await login('Aria', st);
  ok(b.data().main === save(1), 'came back');
  b.c.stop();
});
await test('server: the previous save becomes the backup; too fast = refused; junk = refused', async () => {
  const st = memStorage(), a = await login('Borin', st);
  a.c.send('saveWrite', { s: save(1) }); await wait(NET_LIMITS.saveInterval * 1000 + 100);
  a.c.send('saveWrite', { s: save(2) });
  a.c.send('saveWrite', { s: save(3) });
  await until(() => a.got.some((m) => m.t === 'error' && m.code === NET_ERROR.rate), 2000, 'rate');
  await wait(NET_LIMITS.saveInterval * 1000 + 100);
  a.c.send('saveWrite', { s: '{"no":"version"}' });
  await until(() => a.got.some((m) => m.t === 'error' && m.code === NET_ERROR.bad), 2000, 'unreadable refused');
  a.c.stop();
  const b = await login('Borin', st);
  ok(b.data().main === save(2) && b.data().backup === save(1), JSON.stringify(b.data()));
  b.c.stop();
});
await test('server: two players never see each other\'s saves', async () => {
  const a = await login('Cyra'), b = await login('Dain');
  a.c.send('saveWrite', { s: save(7, { who: 'Cyra' }) });
  await until(() => a.got.some((m) => m.t === 'saveOk'));
  b.c.stop();
  const b2 = await login('Dain', b.storage);
  ok(b2.data().main === null, 'Dain still empty');
  a.c.stop(); b2.c.stop();
});
await test('server: New Game (saveRemove) clears main + backup but keeps an undo copy on disk', async () => {
  const st = memStorage(), a = await login('Eryn', st);
  a.c.send('saveWrite', { s: save(4) }); await until(() => a.got.some((m) => m.t === 'saveOk'));
  a.c.send('saveRemove', {}); await wait(100);
  const rec = srv.game.saves.store.get(a.c.player.id);
  ok(rec.main === null && rec.backup === null && rec.deleted === save(4), JSON.stringify(rec));
  a.c.stop();
  ok((await login('Eryn', st)).data().main === null, 'gone for the player');
});
await test('saves survive a server restart (one file per player in the data folder)', async () => {
  const st = memStorage(), a = await login('Fenn', st);
  a.c.send('saveWrite', { s: save(11) }); await until(() => a.got.some((m) => m.t === 'saveOk'));
  a.c.stop();
  await srv.close();
  ok(readdirSync(join(dir, 'saves')).filter((f) => f.endsWith('.json')).length >= 4, 'files');
  srv = await startServer({ port: 0, dataDir: dir, quiet: true });
  const b = await login('Fenn', st);
  ok(b.data().main === save(11), 'loaded from disk after restart');
  b.c.stop();
});
await test('a save is never served over http', async () => {
  const r = await fetch(`http://localhost:${srv.port}/server/data/saves/`);
  ok(r.status === 403, 'status ' + r.status);
});

await srv.close();
rmSync(dir, { recursive: true, force: true });
ok(!existsSync(dir), 'temp dir removed');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
