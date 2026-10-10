// CHARACTER SLOTS (owner 2026-10-10): an account logs in to a lobby (3 slots), picks one = that character's own save,
// a reconnect naming its slot goes straight back in, deleting clears only that slot, slot 1 = the pre-slot save.
// Run:  node tools/tests/charSlots.test.mjs
import { NetClient } from '../../src/net/client.js';
import { startServer } from '../../server.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 3000, what = 'condition') => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out: ' + what); await wait(15); } };
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'eo-slots-')); // a real data folder: player ids must be safe file names
const srv = await startServer({ port: 0, dataDir: dir, quiet: true, charSlots: true });
const url = `ws://localhost:${srv.port}/ws`, S = srv.game;
const client = (storage = mem()) => {
  const c = new NetClient({ url, storage }), P = { c, welcomes: [], saves: [] };
  c.on('welcome', (m) => { P.welcomes.push(m); if (!m.lobby) c.helloExtra = { slot: m.slot }; });
  c.on('saveData', (m) => P.saves.push(m));
  return P;
};
const save = (cls, lv) => JSON.stringify({ v: 6, savedAt: Date.now(), player: { classId: cls, level: lv, map: 'lumina' } });

console.log('charSlots');
const store = mem();
await test('login = lobby with 3 empty slots, no game messages until a pick', async () => {
  const P = client(store);
  P.c.connect('Slotter');
  await until(() => P.welcomes.length, 3000, 'welcome');
  const w = P.welcomes[0];
  ok(w.lobby && w.chars.length === 3 && w.chars.every((c) => c.empty), JSON.stringify(w));
  ok(!S.sessions.size, 'a lobby is not a player in the world');
  P.c.send('pos', { m: 'lumina', x: 1, y: 1, d: 0, a: 'idle' });
  await wait(100);
  ok(!S.sessions.size, 'still not in the world');
  P.c.stop();
});
await test('pick slot 2 -> own save; the lobby lists it afterwards; slot 1 stays empty', async () => {
  const P = client(store);
  P.c.connect('Slotter');
  await until(() => P.welcomes.length);
  P.c.send('charPick', { slot: 2 });
  await until(() => P.saves.length, 3000, 'saveData');
  const w = P.welcomes.at(-1);
  ok(!w.lobby && w.slot === 2 && w.id.endsWith('_s2'), JSON.stringify(w));
  P.c.send('saveWrite', { s: save('astral_weaver', 7) });
  await until(() => S.saves.store.get(w.id)?.main, 3000, 'saved');
  P.c.helloExtra = null; P.c.stop();
  const Q = client(store);
  Q.c.connect('Slotter');
  await until(() => Q.welcomes.length);
  const ch = Q.welcomes[0].chars;
  ok(ch[0].empty && ch[1].c === 'astral_weaver' && ch[2].empty, JSON.stringify(ch));
  Q.c.send('charPick', { slot: 1 });
  await until(() => Q.saves.length);
  ok(Q.saves[0].main === null, 'slot 1 has its own (empty) save');
  Q.c.stop();
});
await test('a hello naming its slot (reconnect) goes straight into that character', async () => {
  const P = client(store);
  P.c.helloExtra = { slot: 2 };
  P.c.connect('Slotter');
  await until(() => P.saves.length);
  ok(!P.welcomes[0].lobby && P.welcomes[0].slot === 2, JSON.stringify(P.welcomes[0]));
  ok(JSON.parse(P.saves[0].main).player.classId === 'astral_weaver', 'slot 2 save');
  P.c.helloExtra = null; P.c.stop();
});
await test('delete slot 2 from the lobby -> empty again', async () => {
  const P = client(store);
  P.c.connect('Slotter');
  await until(() => P.welcomes.length);
  P.c.send('charDelete', { slot: 2 });
  await until(() => P.welcomes.length === 2, 3000, 'new list');
  ok(P.welcomes[1].chars[1].empty, JSON.stringify(P.welcomes[1].chars));
  P.c.stop();
});

srv.close ? await srv.close() : null;
try { rmSync(dir, { recursive: true, force: true }); } catch { /* still open on Windows */ }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
