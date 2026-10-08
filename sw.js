// MOBILE M2 — service worker for the installed app (PWA). NETWORK FIRST: every file comes from the server when it can
// (so an update is seen right away); a copy is kept and used only when the network fails (a quicker restart on a bad
// connection). The game itself is online-only: the WebSocket (/ws) and the server's private paths are never touched.
const CACHE = 'eclipse-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/ws') || url.pathname.startsWith('/dev/')) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || Response.error())),
  );
});
