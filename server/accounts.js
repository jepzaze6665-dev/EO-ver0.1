// ONLINE N1 — DEVELOPMENT identity, NOT a real account system: no password, no e-mail, no security review.
// First 'hello' with a free name creates the player and hands back a random token (the browser keeps it); later logins
// with that name must bring the token. The server stores only a hash of the token. Names are unique ignoring case.
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { NET_ERROR } from '../src/net/protocol.js';

const hash = (token) => createHash('sha256').update(token).digest('hex');
const keyOf = (name) => name.toLowerCase();

export class DevAccounts {
  constructor(store) { this.store = store; this.counter = store.all().length; }

  // -> { ok: true, account, token, created } | { ok: false, code, text }
  login(name, token) {
    const acc = this.store.get(keyOf(name));
    if (!acc) {
      const t = randomBytes(24).toString('hex');
      const account = { id: 'p' + String(++this.counter).padStart(5, '0') + randomBytes(2).toString('hex'), name, tokenHash: hash(t), createdAt: Date.now(), lastLogin: Date.now() };
      this.store.set(keyOf(name), account);
      return { ok: true, account, token: t, created: true };
    }
    if (!token) return { ok: false, code: NET_ERROR.nameTaken, text: `"${acc.name}" belongs to another player` };
    const a = Buffer.from(acc.tokenHash, 'hex'), b = Buffer.from(hash(token), 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, code: NET_ERROR.token, text: 'wrong token for this name' };
    acc.lastLogin = Date.now();
    this.store.set(keyOf(name), acc);
    return { ok: true, account: acc, token, created: false };
  }
}
