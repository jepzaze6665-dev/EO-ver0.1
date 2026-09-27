// STORAGE ADAPTERS — where save data lives. The SaveSystem only calls read / write / remove, so moving saves to a
// Node.js server / database later means writing one more adapter with the same three methods (async-capable
// callers can wrap them); no gameplay code changes.

// Browser localStorage (V2.1). Every call is guarded: private mode / full storage never crash the game.
export class LocalStorageAdapter {
  read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  write(key, text) { try { localStorage.setItem(key, text); return true; } catch (e) { console.warn('save write failed', e); return false; } }
  remove(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }
}

// In-memory storage: unit tests, and a stand-in for "no persistent storage available".
export class MemoryAdapter {
  constructor(initial = {}) { this.data = { ...initial }; }
  read(key) { return key in this.data ? this.data[key] : null; }
  write(key, text) { this.data[key] = String(text); return true; }
  remove(key) { delete this.data[key]; }
}
