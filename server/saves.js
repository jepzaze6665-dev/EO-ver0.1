// ONLINE N3 — player saves on the server (one record per player: { main, backup, deleted, at }).
//   login      -> 'saveData' { main, backup } (after 'welcome')
//   saveWrite  -> the old main becomes the backup (only if it was a readable save), the new text is main, 'saveOk'
//   saveRemove -> New Game: main + backup cleared; the last main is kept in `deleted` (never sent: an undo for the owner)
// The server only checks the text is a JSON object with a numeric version `v` and fits NET_LIMITS.maxSaveBytes; it does
// NOT trust or read the game state inside yet (the browser still simulates everything). Boss kills / map unlocks / loot
// become server decisions in N8 / N9; then those fields stop coming from this text.
// N8: boss kills now live in the same record as `progress` (server/progress.js) — a saveWrite never touches it.
import { NET_LIMITS, NET_ERROR } from '../src/net/protocol.js';

const readable = (text) => {
  if (typeof text !== 'string') return null;
  try { const d = JSON.parse(text); return d && typeof d === 'object' && !Array.isArray(d) && typeof d.v === 'number' ? d : null; } catch { return null; }
};

export class SaveService {
  constructor(server, store) {
    this.server = server;
    this.store = store;
    server.on('sessionOpened', (s) => {
      const r = this.store.get(s.id) || {};
      s.send('saveData', { main: r.main ?? null, backup: r.backup ?? null });
    });
    server.handle('saveWrite', (s, m) => this.write(s, m.s));
    server.handle('saveRemove', (s) => this.remove(s));
  }

  write(s, text) {
    const now = Date.now();
    if (now - (s.lastSave || 0) < NET_LIMITS.saveInterval * 1000) return s.send('error', { code: NET_ERROR.rate, text: 'saving too often' });
    const d = readable(text);
    if (!d) return s.send('error', { code: NET_ERROR.bad, text: 'save is not readable' });
    s.lastSave = now;
    const r = this.store.get(s.id) || {};
    const next = { ...r, main: text, at: now };
    if (readable(r.main)) next.backup = r.main;
    this.store.set(s.id, next);
    s.send('saveOk', { at: typeof d.savedAt === 'number' ? d.savedAt : now });
  }

  remove(s) {
    const r = this.store.get(s.id);
    if (!r || (!r.main && !r.backup)) return;
    this.store.set(s.id, { deleted: r.main || r.backup, deletedProgress: r.progress || null, deletedAt: Date.now(), main: null, backup: null, at: Date.now() });
    this.server.progress?.reset(s); // N8: a new character starts with no boss kills
  }
}
