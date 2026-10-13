// DEV: the admin back office with FAKE players (memory only, nothing written to server/data).
// Run: node tools/adminDemo.mjs  ->  http://localhost:5199/admin   name admin · password devadmin
import { startServer } from '../server.js';

const port = Number(process.env.PORT) || 5199;
const s = await startServer({ port, dataDir: null, quiet: true, adminPassword: 'devadmin' });
const g = s.game;
const CLASSES = ['umbral_sword', 'astral_weaver', 'aegis_guardian', 'nightfall_reaper', 'stormcaller', 'warden_of_dawn'];
const MAPS = ['lumina', 'a1', 'a2', 'b1', 'city2', 'a3'];
for (let i = 0; i < 14; i++) {
  const acc = g.accounts.login('Player' + (i + 1), null, { pw: 'demopass', create: true }).account;
  acc.lastLogin = Date.now() - i * 3.6e6 * 5; acc.createdAt = Date.now() - i * 8.64e7 * 3;
  if (i === 3) delete acc.pwHash;
  const lvl = 1 + ((i * 7) % 50);
  g.saves.store.set(acc.id, {
    main: JSON.stringify({ v: 6, player: { classId: CLASSES[i % CLASSES.length], level: lvl, gold: lvl * 37, map: MAPS[i % MAPS.length] } }),
    at: Date.now() - i * 6e5, econ: { gold: lvl * 41, level: lvl, diamonds: (i % 4) * 25, unverified: i === 5 ? 7 : 0 },
    progress: { bosses: Object.fromEntries(Array.from({ length: i % 5 }, (_, k) => ['b' + k, 1])) },
  });
  if (i < 3) g.sessions.set(acc.id, { id: acc.id, presence: { m: MAPS[i], room: i === 1 ? null : MAPS[i] } });
}
console.log(`admin demo: http://localhost:${port}/admin  (admin / devadmin)`);
