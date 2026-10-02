// ONLINE N3 — save storage adapter that keeps the saves on the game server (same read / write / remove API as
// save/storage.js, so SaveSystem does not change). Reads come from a copy the server sends at login ('saveData');
// a write updates that copy at once (the game never waits on the network) and goes to the server as 'saveWrite'
// (at most one per NET_LIMITS.saveInterval; a newer save replaces one still waiting). The server rotates the backup
// itself, so backup writes stay local. Line down: the newest save waits and is sent after the reconnect, unless the
// server holds a newer one (savedAt).
import { NET_LIMITS } from './protocol.js';

const savedAt = (text) => { try { return JSON.parse(text).savedAt || 0; } catch { return -1; } };
const readable = (text) => savedAt(text) >= 0 && typeof text === 'string';

export class ServerSaveAdapter {
  constructor(net, { mainKey, backupKey }) {
    this.net = net;
    this.mainKey = mainKey; this.backupKey = backupKey;
    this.reset();
    net.on('saveOk', () => { this.unacked = null; });
  }

  reset() {
    clearTimeout(this.timer);
    this.main = null; this.backup = null;
    this.pending = null;   // newest save not sent yet
    this.unacked = null;   // sent, no 'saveOk' yet
    this.lastSent = 0; this.timer = null;
    this.loaded = false;
  }

  // 'saveData' from the server (login / reconnect) -> returns 'server' | 'local' (which copy won)
  load({ main, backup }) {
    const local = this.pending || this.unacked;
    this.loaded = true;
    if (local && savedAt(local) >= savedAt(main)) {
      this.pending = local; this.unacked = null;
      this.main = local; if (backup) this.backup = backup;
      this.flush();
      return 'local';
    }
    this.main = main ?? null; this.backup = backup ?? null;
    this.pending = null; this.unacked = null;
    return 'server';
  }

  read(key) { return key === this.mainKey ? this.main : key === this.backupKey ? this.backup : null; }

  write(key, text) {
    if (key === this.backupKey) { this.backup = String(text); return true; } // the server rotates its own backup
    if (key !== this.mainKey) return false;
    if (readable(this.main)) this.backup = this.main;
    this.main = String(text);
    this.pending = this.main;
    this.flush();
    return true;
  }

  remove(key) {
    if (key === this.mainKey) {
      if (this.main || this.backup) this.net.send('saveRemove', {});
      this.main = null; this.pending = null; this.unacked = null;
    } else if (key === this.backupKey) this.backup = null;
  }

  flush() {
    if (!this.pending || this.timer) return;
    const wait = this.lastSent + NET_LIMITS.saveInterval * 1000 + 50 - Date.now();
    if (wait > 0) { this.timer = setTimeout(() => { this.timer = null; this.flush(); }, wait); return; }
    if (this.net.send('saveWrite', { s: this.pending })) {
      this.unacked = this.pending; this.pending = null; this.lastSent = Date.now();
    }
  }

  get synced() { return !this.pending && !this.unacked; }
}
