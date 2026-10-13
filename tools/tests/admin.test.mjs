// ADMIN AD1 — back office (server/admin.js): off without a password, this computer only, login + cookie, header check,
// lockout, logout, audit log.   Run:  node tools/tests/admin.test.mjs
import { startServer } from '../../server.js';
import { AdminService, ADMIN_RULES } from '../../server/admin.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const H = { 'Content-Type': 'application/json', 'X-EO-Admin': '1' };
const post = (base, p, body, headers = H) => fetch(base + p, { method: 'POST', headers, body: JSON.stringify(body) });

console.log('admin');
const off = await startServer({ port: 0, dataDir: null, quiet: true });
await test('no admin password = /admin does not exist', async () => {
  ok((await fetch(`http://localhost:${off.port}/admin`)).status === 404, 'page');
  ok((await fetch(`http://localhost:${off.port}/admin/api/me`)).status === 404, 'api');
});
await off.close();

const s = await startServer({ port: 0, dataDir: null, quiet: true, adminPassword: 'boss-secret' });
const base = `http://localhost:${s.port}`;
let cookie = '';
await test('page is served; the API needs a login', async () => {
  const r = await fetch(base + '/admin');
  ok(r.status === 200 && (await r.text()).includes('Eclipse Admin'), 'page');
  ok((await fetch(base + '/admin/api/me')).status === 401, 'me without login');
});
await test('POST without the X-EO-Admin header is refused (another site cannot post)', async () => {
  const r = await post(base, '/admin/api/login', { name: 'admin', pw: 'boss-secret' }, { 'Content-Type': 'application/json' });
  ok(r.status === 403, 'status ' + r.status);
});
await test('right password -> HttpOnly cookie -> me / summary / audit work', async () => {
  const r = await post(base, '/admin/api/login', { name: 'admin', pw: 'boss-secret' });
  ok(r.status === 200, 'login ' + r.status);
  const c = r.headers.get('set-cookie');
  ok(/HttpOnly/.test(c) && /SameSite=Strict/.test(c), 'cookie flags');
  cookie = c.split(';')[0];
  const me = await (await fetch(base + '/admin/api/me', { headers: { cookie } })).json();
  ok(me.name === 'admin' && me.role === 'owner', 'me');
  const sum = await (await fetch(base + '/admin/api/summary', { headers: { cookie } })).json();
  ok(sum.online === 0 && typeof sum.accounts === 'number', 'summary');
  const au = await (await fetch(base + '/admin/api/audit', { headers: { cookie } })).json();
  ok(au.list[0].action === 'login', 'audit has the login');
});
await test(`${ADMIN_RULES.fails} wrong passwords lock the login, even the right one waits`, async () => {
  for (let i = 0; i < ADMIN_RULES.fails; i++) ok((await post(base, '/admin/api/login', { name: 'admin', pw: 'x' + i })).status === 401, 'wrong ' + i);
  ok((await post(base, '/admin/api/login', { name: 'admin', pw: 'boss-secret' })).status === 429, 'locked');
  s.admin.fails.until = 0;
});
await test('AD2 player list: one row per character, ledger numbers win over the save, online + where, read only', async () => {
  const g = s.game;
  const acc = g.accounts.login('Aria', null, { pw: 'secret1', create: true }).account;
  const main = JSON.stringify({ v: 6, player: { classId: 'umbral_sword', level: 12, gold: 999, map: 'a1' } });
  g.saves.store.set(acc.id, { main, at: Date.now(), econ: { gold: 340, level: 14, diamonds: 50, unverified: 2 }, progress: { bosses: { boss_a1: 1 } } });
  g.saves.store.set(g.charId(acc.id, 2), { main: JSON.stringify({ v: 6, player: { classId: 'astral_weaver', level: 3, gold: 10, map: 'lumina' } }), at: 1 });
  g.accounts.login('Empty', null, { pw: 'secret2', create: true }); // no character yet -> no row
  g.sessions.set(acc.id, { id: acc.id, presence: { m: 'lumina', room: 'lumina' } });
  const before = JSON.stringify(g.saves.store.get(acc.id));
  const { list } = await (await fetch(base + '/admin/api/players', { headers: { cookie } })).json();
  g.sessions.delete(acc.id);
  ok(list.length === 2, 'rows ' + list.length);
  const a = list.find((r) => r.slot === 1), b = list.find((r) => r.slot === 2);
  ok(a.account === 'Aria' && a.classId === 'umbral_sword' && a.level === 14 && a.gold === 340 && a.diamonds === 50, 'ledger numbers ' + JSON.stringify(a));
  ok(a.online && a.where === 'city' && a.map === 'lumina' && a.bosses === 1 && a.unverified === 2 && a.hasPw, 'online row');
  ok(!b.online && b.classId === 'astral_weaver' && b.level === 3 && b.map === 'lumina', 'slot 2 from its save');
  ok(JSON.stringify(g.saves.store.get(acc.id)) === before, 'nothing written');
  ok((await fetch(base + '/admin/api/players')).status === 401, 'needs login');
});
await test('logout ends the session', async () => {
  ok((await post(base, '/admin/api/logout', {}, { ...H, cookie })).status === 200, 'logout');
  ok((await fetch(base + '/admin/api/me', { headers: { cookie } })).status === 401, 'me after logout');
});
await test('requests from another computer are refused', () => {
  const a = new AdminService({ password: 'boss-secret' });
  let code = 0;
  const res = { writeHead: (c) => { code = c; }, end() {}, setHeader() {} };
  ok(a.handle({ method: 'GET', socket: { remoteAddress: '192.168.1.20' }, headers: {}, url: '/admin' }, res, '/admin') && code === 403, 'code ' + code);
  ok(!a.handle({ method: 'GET', socket: { remoteAddress: '192.168.1.20' }, headers: {}, url: '/x' }, res, '/index.html'), 'other paths untouched');
});
await test('the admin page file is never served as a static file', async () => {
  ok((await fetch(base + '/server/adminPage.html')).status === 403, 'private');
});
await s.close();

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
