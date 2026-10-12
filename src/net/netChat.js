// C1 CHAT (browser side) = game.online.chat: sends lines, keeps the log (CHAT_RULES.history), speech bubbles over the
// speaker (remote players + you), system lines from the game. Who hears what is decided by the server (server/chat.js).
import { CHAT_RULES, QUICK_CHAT, cleanChat } from './chat.js';
import { tx } from '../i18n/i18n.js';

export class NetChat {
  constructor(session) {
    this.s = session;
    this.log = [];          // { ch, from, id, text, at, mine }
    this.bubbles = new Map(); // player id -> { text, until (performance time s) }
    this.listeners = new Set();
    session.net.on('chat', (m) => this.add({ ...m, mine: m.id === session.playerId }));
    session.net.on('error', (m) => { if (m.code === 'chat') this.system(m.text); });
  }
  get now() { return performance.now() / 1000; }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  changed() { for (const fn of this.listeners) fn(); }

  add(line) {
    if (line.q && QUICK_CHAT[line.q]) line.text = tx(QUICK_CHAT[line.q]); // C3: quick lines in the reader's language
    this.log.push(line);
    if (this.log.length > CHAT_RULES.history) this.log.splice(0, this.log.length - CHAT_RULES.history);
    if (line.id && line.ch !== 'system') this.bubbles.set(line.id, { text: line.text, until: this.now + CHAT_RULES.bubble, ch: line.ch });
    this.changed();
  }
  // a line only you see (game notices, refusals)
  system(text) { this.add({ ch: 'system', from: '', id: null, text, at: Date.now() }); }

  // returns false when nothing was sent (empty / offline)
  send(ch, raw) {
    const text = cleanChat(raw);
    if (!text) return false;
    if (!this.s.net.online) { this.system('Not connected'); return false; }
    if (ch === 'party' && !this.s.party) { this.system('You are not in a party — use /l for nearby players'); return false; }
    this.s.net.send('chat', { ch, text });
    return true;
  }
  // C3 quick chat: one tap, sent as an id
  sendQuick(ch, q) {
    if (!QUICK_CHAT[q]) return false;
    if (!this.s.net.online) { this.system('Not connected'); return false; }
    if (ch === 'party' && !this.s.party) ch = 'local';
    this.s.net.send('chat', { ch, text: q, q });
    return true;
  }
  bubble(id) {
    const b = this.bubbles.get(id);
    if (!b) return null;
    if (b.until < this.now) { this.bubbles.delete(id); return null; }
    return b;
  }
  clear() { this.log = []; this.bubbles.clear(); this.changed(); }
}
