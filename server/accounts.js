// ONLINE H6 — player accounts: name + PASSWORD (scrypt hash + salt, never stored in clear) + remembered devices.
//   create : hello { name, pw, create: true } -> new account (name unique ignoring case, password 6-64 chars)
//   log in : hello { name, pw }  (any device)  — or hello { name, token } (a device that logged in before: "remember me")
//   every successful password login adds a device token (max 5 kept, oldest dropped); the server keeps only their hashes
//   wrong password 5 times -> that name is locked for 60 s (slows guessing)
//   accounts from before H6 (dev identity: token only, no password) still log in with their token and can set a password
//   (setPassword). `requirePassword: false` (unit tests) = the old dev rule: a free name is created without a password.
// The connection itself is plain ws:// on a LAN; a public server must run behind HTTPS / WSS (docs/online).
import { randomBytes, createHash, timingSafeEqual, scryptSync } from 'crypto';
import { NET_ERROR } from '../src/net/protocol.js';

const hash = (token) => createHash('sha256').update(token).digest('hex');
const keyOf = (name) => name.toLowerCase();
const same = (hexA, hexB) => { const a = Buffer.from(hexA, 'hex'), b = Buffer.from(hexB, 'hex'); return a.length === b.length && timingSafeEqual(a, b); };
export const PASSWORD_RULES = { min: 6, max: 64, devices: 5, fails: 5, lockSeconds: 60 };
const pwHash = (pw, salt) => scryptSync(pw, salt, 32).toString('hex');

export class Accounts {
  constructor(store, { requirePassword = false } = {}) {
    this.store = store; this.counter = store.all().length; this.requirePassword = requirePassword;
    this.fails = new Map(); // name key -> { n, until }
  }
  tokensOf(acc) { return acc.tokenHashes || (acc.tokenHash ? [acc.tokenHash] : []); }
  newToken(acc) {
    const t = randomBytes(24).toString('hex');
    acc.tokenHashes = [...this.tokensOf(acc), hash(t)].slice(-PASSWORD_RULES.devices);
    delete acc.tokenHash;
    return t;
  }
  badPw(pw) { return typeof pw !== 'string' || pw.length < PASSWORD_RULES.min || pw.length > PASSWORD_RULES.max; }
  setPw(acc, pw) { acc.pwSalt = randomBytes(16).toString('hex'); acc.pwHash = pwHash(pw, acc.pwSalt); }

  // -> { ok: true, account, token, created } | { ok: false, code, text }
  login(name, token, { pw, create } = {}) {
    const key = keyOf(name), acc = this.store.get(key);
    if (!acc) {
      if (this.requirePassword && !create) return { ok: false, code: NET_ERROR.noAccount, text: `No account named "${name}" — create one` };
      if ((this.requirePassword || pw !== undefined) && this.badPw(pw)) return { ok: false, code: NET_ERROR.password, text: `Password must be ${PASSWORD_RULES.min}-${PASSWORD_RULES.max} characters` };
      const account = { id: 'p' + String(++this.counter).padStart(5, '0') + randomBytes(2).toString('hex'), name, createdAt: Date.now(), lastLogin: Date.now() };
      if (pw !== undefined) this.setPw(account, pw);
      const t = this.newToken(account);
      this.store.set(key, account);
      return { ok: true, account, token: t, created: true };
    }
    if (create) return { ok: false, code: NET_ERROR.nameTaken, text: `"${acc.name}" is taken — pick another name or log in` };
    const f = this.fails.get(key);
    if (f && f.until > Date.now()) return { ok: false, code: NET_ERROR.locked, text: `Too many wrong passwords — wait ${Math.ceil((f.until - Date.now()) / 1000)} s` };
    // remembered device
    if (token && this.tokensOf(acc).some((h) => same(h, hash(token)))) return this.ok(key, acc, token);
    if (pw !== undefined && acc.pwHash) {
      if (same(acc.pwHash, pwHash(String(pw), acc.pwSalt))) { this.fails.delete(key); return this.ok(key, acc, this.newToken(acc)); }
      const n = (f ? f.n : 0) + 1; // a lock resets the count to 0 when it starts
      this.fails.set(key, { n: n >= PASSWORD_RULES.fails ? 0 : n, until: n >= PASSWORD_RULES.fails ? Date.now() + PASSWORD_RULES.lockSeconds * 1000 : 0 });
      return { ok: false, code: NET_ERROR.password, text: 'Wrong password' };
    }
    if (token) return { ok: false, code: NET_ERROR.token, text: acc.pwHash ? 'This device was signed out — log in with your password' : 'wrong token for this name' };
    return { ok: false, code: NET_ERROR.nameTaken, text: acc.pwHash ? `Enter the password for "${acc.name}"` : `"${acc.name}" belongs to another player` };
  }
  ok(key, acc, token) {
    acc.lastLogin = Date.now();
    this.store.set(key, acc);
    return { ok: true, account: acc, token, created: false };
  }
  hasPassword(name) { const a = this.store.get(keyOf(name)); return !!(a && a.pwHash); }

  // logged in: set or change the password (changing needs the old one)
  setPassword(name, pw, old) {
    const key = keyOf(name), acc = this.store.get(key);
    if (!acc) return { ok: false, text: 'no account' };
    if (this.badPw(pw)) return { ok: false, text: `Password must be ${PASSWORD_RULES.min}-${PASSWORD_RULES.max} characters` };
    if (acc.pwHash && !(typeof old === 'string' && same(acc.pwHash, pwHash(old, acc.pwSalt)))) return { ok: false, text: 'Current password is wrong' };
    this.setPw(acc, pw);
    this.store.set(key, acc);
    return { ok: true };
  }
}
export { Accounts as DevAccounts }; // older imports
