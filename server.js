// Zero-dependency server for ECLIPSE ONLINE: static files for the browser (ES modules need http://) + the online game
// server on the same port (WebSocket at /ws, server/gameServer.js).
// Usage: node server.js  ->  http://localhost:5173      (PORT / EO_DATA env vars override the port / data folder)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameServer } from './server/gameServer.js';
import { JsonFileStore, JsonDirStore, MemoryStore } from './server/store.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.md': 'text/plain', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
// never served: server code + its data (player records), git internals
const PRIVATE = ['/server/', '/.git/', '/.claude/'];

// dataDir null = in-memory store (tests); quiet = no logs
export function startServer({ port = 5173, dataDir = path.join(ROOT, 'server', 'data'), quiet = false, limits } = {}) {
  const log = quiet ? {} : console;
  const store = dataDir ? new JsonFileStore(dataDir, 'accounts') : new MemoryStore();
  const saveStore = dataDir ? new JsonDirStore(path.join(dataDir, 'saves')) : new MemoryStore();
  const game = new GameServer({ store, saveStore, limits, log });
  const httpServer = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
    if (p === '/') p = '/index.html';
    const norm = path.posix.normalize(p.replace(/\\/g, '/'));
    if (PRIVATE.some((x) => norm.toLowerCase().startsWith(x))) { res.writeHead(403); return res.end(); }
    const file = path.join(ROOT, norm);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  });
  httpServer.on('upgrade', (req, socket) => game.upgrade(req, socket));
  httpServer.on('clientError', (err, socket) => socket.destroy());
  return new Promise((resolve) => httpServer.listen(port, () => {
    const close = () => new Promise((r) => { game.close(); httpServer.close(() => r()); httpServer.closeAllConnections?.(); });
    resolve({ http: httpServer, game, port: httpServer.address().port, close });
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = await startServer({ port: Number(process.env.PORT) || 5173, dataDir: process.env.EO_DATA || undefined });
  console.log(`ECLIPSE ONLINE running at http://localhost:${s.port}  (game server: ws://localhost:${s.port}/ws)`);
  // other computers on the same network (N10 multi-client tests): open one of these in their browser
  const { networkInterfaces } = await import('os');
  for (const list of Object.values(networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log(`  same network: http://${a.address}:${s.port}`);
  const stop = () => { s.close().then(() => process.exit(0)); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
