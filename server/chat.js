// C1 CHAT — the server decides who hears a line: 'local' = the sender's room (city room or run-map room, server/cityRooms.js),
// 'party' = the sender's party members who are online (server/parties.js), wherever they are. Every line is cleaned and
// filtered here (src/net/chat.js), so a modified client cannot send raw text, flood, or pick its own listeners.
import { CHAT_RULES, cleanChat, filterChat } from '../src/net/chat.js';
import { NET_ERROR } from '../src/net/protocol.js';

export class ChatService {
  constructor(server) {
    this.server = server;
    this.sent = new Map(); // player id -> times (ms) of their recent lines
    server.handle('chat', (s, m) => this.say(s, m.ch, m.text));
    server.on('sessionClosed', (s) => this.sent.delete(s.id));
  }

  refuse(s, text) { s.send('error', { code: NET_ERROR.chat, text }); return false; }

  // flood guard: minGap between lines + at most `burst` lines per `burstWindow`
  allowed(id, now) {
    const list = (this.sent.get(id) || []).filter((t) => now - t < CHAT_RULES.burstWindow * 1000);
    if (list.length && now - list[list.length - 1] < CHAT_RULES.minGap * 1000) return false;
    if (list.length >= CHAT_RULES.burst) return false;
    list.push(now);
    this.sent.set(id, list);
    return true;
  }

  say(s, ch, raw) {
    if (s.sim || s.lobby) return false;
    const text = filterChat(cleanChat(raw));
    if (!text) return false;
    const now = Date.now();
    let to;
    if (ch === 'local') {
      const room = s.presence?.room, set = room && this.server.city.rooms.get(room);
      if (!set) return this.refuse(s, 'nobody can hear you here');
      to = [...set].filter((x) => !x.sim);
    } else {
      const p = this.server.parties.partyOf(s.id);
      if (!p) return this.refuse(s, 'you are not in a party');
      to = [...p.members.keys()].map((id) => this.server.sessions.get(id)).filter(Boolean);
    }
    if (!this.allowed(s.id, now)) return this.refuse(s, 'slow down: you are sending messages too fast');
    const line = { ch, id: s.id, from: s.name, text, at: now };
    for (const x of to) x.send('chat', line);
    return true;
  }
}
