// C1 CHAT — local room + party channels on the real server (server/chat.js), cleaning + profanity filter (src/net/chat.js).
// Run:  node tools/tests/chat.test.mjs
import { NetClient } from '../../src/net/client.js';
import { NET_ERROR } from '../../src/net/protocol.js';
import { CHAT_RULES, cleanChat, filterChat } from '../../src/net/chat.js';
import { startServer } from '../../server.js';

let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 3000, what = 'condition') => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timed out: ' + what); await wait(10); } };
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

console.log('chat');
await test('cleaning: control characters out, spaces collapsed, cut to maxLen', async () => {
  ok(cleanChat('  hi\n\tthere\u0000 ') === 'hi there', 'cleaned');
  ok([...cleanChat('ก'.repeat(500))].length === CHAT_RULES.maxLen, 'cut');
  ok(cleanChat(42) === '', 'not text');
});
await test('profanity filter: English + Thai become ***, ordinary words kept (หีบ, สัดส่วน)', async () => {
  ok(filterChat('what the fuck') === 'what the ****', 'english');
  ok(filterChat('ไอ้เหี้ย') === 'ไอ้*****', 'thai: ' + filterChat('ไอ้เหี้ย'));
  ok(filterChat('เปิดหีบ สัดส่วน') === 'เปิดหีบ สัดส่วน', 'game words kept');
  ok(filterChat('Dickens classic') === 'Dickens classic', 'no false hit');
});

const srv = await startServer({ port: 0, dataDir: null, quiet: true });
const url = `ws://localhost:${srv.port}/ws`;
const all = [];
const player = async (name) => {
  const c = new NetClient({ url, storage: memStorage() });
  const P = { c, name, lines: [], errors: [], party: null, invites: [] };
  c.on('chat', (m) => P.lines.push(m));
  c.on('error', (m) => P.errors.push(m));
  c.on('party', (m) => { P.party = m.party; });
  c.on('partyInvite', (m) => P.invites.push(m));
  c.connect(name);
  await until(() => c.online, 3000, name + ' online');
  P.id = c.player.id;
  P.send = (t, f = {}) => c.send(t, f);
  P.at = (m) => c.send('pos', { m, x: 100, y: 100, d: 0, a: 'idle' });
  all.push(P);
  return P;
};

await test('local: everyone in the same city room hears it (sender too), another room does not', async () => {
  const a = await player('Talia'), b = await player('Brann'), c = await player('Corra');
  a.at('lumina'); b.at('lumina'); c.at('city2');
  await until(() => srv.game.city.rooms.get('lumina')?.size === 2, 2000, 'room');
  a.send('chat', { ch: 'local', text: '  hello   there ' });
  await until(() => b.lines.length && a.lines.length, 2000, 'heard');
  ok(b.lines[0].text === 'hello there' && b.lines[0].from === 'Talia' && b.lines[0].ch === 'local', 'cleaned line from Talia');
  await wait(150);
  ok(!c.lines.length, 'the other city heard nothing');
});
await test('party: members hear it on any map; without a party = refused', async () => {
  const a = all[0], b = all[1], c = all[2];
  c.send('chat', { ch: 'party', text: 'anyone?' });
  await until(() => c.errors.length, 2000, 'refused');
  ok(c.errors.at(-1).code === NET_ERROR.chat && /party/.test(c.errors.at(-1).text), 'not in a party');
  a.send('partyInvite', { name: 'Corra' });
  await until(() => c.invites.length, 2000, 'invite');
  c.send('partyAnswer', { party: c.invites[0].party, yes: true });
  await until(() => c.party && c.party.members.length === 2, 2000, 'joined');
  const nb = b.lines.length;
  await wait(900);
  c.send('chat', { ch: 'party', text: 'boss at the north gate, wait for me' });
  await until(() => a.lines.some((l) => l.ch === 'party'), 2000, 'party heard');
  ok(a.lines.at(-1).from === 'Corra', 'from Corra in another city');
  await wait(150);
  ok(b.lines.length === nb, 'a non-member heard nothing');
});
await test('the server filters + refuses floods (min gap, burst)', async () => {
  const a = all[0], b = all[1];
  await wait(1000);
  a.send('chat', { ch: 'local', text: 'shit happens' });
  await until(() => b.lines.at(-1)?.text.startsWith('****'), 2000, 'filtered');
  const e0 = a.errors.length;
  a.send('chat', { ch: 'local', text: 'again' });
  await until(() => a.errors.length > e0, 2000, 'too fast');
  ok(/slow down/.test(a.errors.at(-1).text), 'slow down');
});

for (const p of all) p.c.stop();
srv.close?.();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
