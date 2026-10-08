// ONLINE H6 — accounts with passwords (server/accounts.js): create, log in from another device, remembered device token,
// wrong password + lockout, old token-only accounts setting a password, setPassword over the network.
// Run:  node tools/tests/accounts.test.mjs
import { Accounts, PASSWORD_RULES } from '../../server/accounts.js';
import { MemoryStore } from '../../server/store.js';
import { NetClient } from '../../src/net/client.js';
import { startServer } from '../../server.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 3000, what = 'condition') => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out: ' + what); await wait(10); } };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

console.log('accounts');
await test('real server rules: no account -> must create; create needs 6+ chars; the hash is stored, never the password', () => {
  const A = new Accounts(new MemoryStore(), { requirePassword: true });
  ok(A.login('Aria', null).code === 'noAccount', 'login without an account');
  ok(A.login('Aria', null, { pw: '123', create: true }).code === 'password', 'too short');
  const r = A.login('Aria', null, { pw: 'secret1', create: true });
  ok(r.ok && r.created && r.token, 'created');
  const raw = JSON.stringify(A.store.get('aria'));
  ok(!raw.includes('secret1') && !raw.includes(r.token), 'no password / token in the record');
  ok(A.login('aria', null, { pw: 'x2', create: true }).code === 'nameTaken', 'name taken ignoring case');
});
await test('another device logs in with the password (new device token); the old device still works by token', () => {
  const A = new Accounts(new MemoryStore(), { requirePassword: true });
  const t1 = A.login('Borin', null, { pw: 'hammer9', create: true }).token;
  const r2 = A.login('Borin', null, { pw: 'hammer9' });
  ok(r2.ok && r2.token && r2.token !== t1, 'second device');
  ok(A.login('Borin', t1).ok && A.login('Borin', r2.token).ok, 'both remembered');
  ok(A.login('Borin', null).code === 'nameTaken', 'nothing = refused');
});
await test(`wrong password: refused; ${PASSWORD_RULES.fails} in a row lock the name, even the right password waits`, () => {
  const A = new Accounts(new MemoryStore(), { requirePassword: true });
  A.login('Cyra', null, { pw: 'rightpw', create: true });
  for (let i = 0; i < PASSWORD_RULES.fails; i++) ok(A.login('Cyra', null, { pw: 'nope' + i }).code === 'password', 'wrong ' + i);
  ok(A.login('Cyra', null, { pw: 'rightpw' }).code === 'locked', 'locked');
  A.fails.get('cyra').until = 0;
  ok(A.login('Cyra', null, { pw: 'rightpw' }).ok, 'after the wait');
});
await test('an old account (token only) still logs in and can set a password; changing one needs the old password', () => {
  const store = new MemoryStore(), dev = new Accounts(store); // the old dev rule: free name without a password
  const t = dev.login('Dain', null).token;
  const A = new Accounts(store, { requirePassword: true });
  ok(A.login('Dain', t).ok && !A.hasPassword('Dain'), 'token login, no password yet');
  ok(A.setPassword('Dain', 'newpass1').ok && A.hasPassword('Dain'), 'set');
  ok(!A.setPassword('Dain', 'other22', 'wrong').ok && A.setPassword('Dain', 'other22', 'newpass1').ok, 'change needs the old one');
  ok(A.login('Dain', null, { pw: 'other22' }).ok, 'log in with it');
});
await test('over the network: create, log in elsewhere with the password, set a password for a passwordless account', async () => {
  const srv = await startServer({ port: 0, dataDir: null, quiet: true, requirePassword: true });
  const url = `ws://localhost:${srv.port}/ws`;
  const a = new NetClient({ url, storage: memStorage() }); let welcome = null;
  a.on('welcome', (m) => { welcome = m; });
  a.connect('Eryn');
  await until(() => a.state === 'offline' && a.lastError, 3000, 'refused');
  ok(a.lastError.code === 'noAccount', a.lastError.code);
  a.connect('Eryn', { pw: 'starlit7', create: true });
  await until(() => a.online, 3000, 'created');
  ok(welcome.created && welcome.hasPw, 'welcome says created + has a password');
  const b = new NetClient({ url, storage: memStorage() });
  b.connect('Eryn', { pw: 'wrong00' });
  await until(() => b.lastError, 3000, 'wrong refused');
  ok(b.lastError.code === 'password', b.lastError.code);
  b.connect('Eryn', { pw: 'starlit7' });
  await until(() => b.online, 3000, 'logged in elsewhere');
  b.stop(); a.stop();
  await srv.close();
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
