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
