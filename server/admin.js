// ADMIN AD1 — the back office at /admin (same server, same port). Only the owner's own computer may open it.
//   on      : only when an admin password is given (startServer({ adminPassword }) / env EO_ADMIN_PW); else /admin = 404
//   where   : only requests from this computer (127.0.0.1 / ::1) unless `allowRemote` (not used: owner rule 2026-10-13)
//   who     : ADMINS = [{ name, role }] — one 'owner' today; the list is ready for more admins with roles later
//   login   : POST /admin/api/login { name, pw } -> HttpOnly cookie (SameSite=Strict, Path=/admin), 8 h; 5 wrong in a row
//             = locked 60 s. Every POST must carry header `X-EO-Admin: 1` (a page from another site cannot add it).
//   audit   : every admin action -> one JSON line in <dataDir>/admin_audit.log (memory only in tests)
// Later phases add their API routes with route(method, path, fn, { write }).
import fs from 'fs';
import path from 'path';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { CHAR_SLOTS } from './gameServer.js';

export const ADMIN_RULES = { sessionHours: 8, fails: 5, lockSeconds: 60, bodyMax: 64 * 1024, auditKeep: 500 };
const LOCAL = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
const hashPw = (pw, salt) => scryptSync(String(pw), salt, 32);

export class AdminService {
  constructor({ game, password, dataDir = null, allowRemote = false, log = {} } = {}) {
    this.game = game; this.enabled = typeof password === 'string' && password.length >= 6;
    this.allowRemote = allowRemote; this.log = log;
    this.admins = new Map(); // name key -> { name, role, salt, hash }
    if (this.enabled) this.addAdmin('admin', password, 'owner');
    this.sessions = new Map(); // token -> { name, role, until }
    this.fails = { n: 0, until: 0 };
    this.auditFile = dataDir ? path.join(dataDir, 'admin_audit.log') : null;
    this.auditMem = [];
    this.routes = new Map(); // 'GET /admin/api/x' -> { fn, write }
    this.route('GET', '/admin/api/me', (ctx) => ({ name: ctx.admin.name, role: ctx.admin.role }));
    this.route('GET', '/admin/api/audit', () => ({ list: this.recentAudit(100) }));
    this.route('GET', '/admin/api/summary', () => this.summary());
    this.route('GET', '/admin/api/players', () => ({ list: this.players() }));
  }
  addAdmin(name, pw, role = 'owner') {
    const salt = randomBytes(16).toString('hex');
    this.admins.set(name.toLowerCase(), { name, role, salt, hash: hashPw(pw, salt) });
  }
  route(method, p, fn, { write = false } = {}) { this.routes.set(method + ' ' + p, { fn, write }); }

  // -> true when the request was an /admin one (answered here)
  handle(req, res, p) {
    if (p !== '/admin' && !p.startsWith('/admin/')) return false;
    if (!this.enabled) return send(res, 404, 'Not found'), true;
    if (!this.allowRemote && !LOCAL.includes(req.socket.remoteAddress)) return send(res, 403, 'Forbidden'), true;
    if (req.method === 'GET' && (p === '/admin' || p === '/admin/')) return this.page(res), true;
    if (!p.startsWith('/admin/api/')) return send(res, 404, 'Not found'), true;
    if (req.method === 'POST' && req.headers['x-eo-admin'] !== '1') return json(res, 403, { error: 'missing header' }), true;
    if (req.method === 'POST' && p === '/admin/api/login') return this.body(req, res, (b) => this.login(req, res, b)), true;
    const admin = this.sessionOf(req);
    if (!admin) return json(res, 401, { error: 'login' }), true;
    if (req.method === 'POST' && p === '/admin/api/logout') {
      this.sessions.delete(cookie(req)); this.audit(admin, 'logout');
      res.setHeader('Set-Cookie', 'eo_admin=; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=0');
      return json(res, 200, { ok: true }), true;
    }
    const r = this.routes.get(req.method + ' ' + p);
    if (!r) return json(res, 404, { error: 'unknown' }), true;
    const run = (body) => {
      const url = new URL(req.url, 'http://x');
      try {
        const out = r.fn({ admin, body, query: Object.fromEntries(url.searchParams), req });
        if (r.write) this.audit(admin, p.slice('/admin/api/'.length), body);
        json(res, 200, out ?? { ok: true });
      } catch (e) { json(res, 400, { error: e.message }); }
    };
    if (req.method === 'POST') this.body(req, res, run); else run(null);
    return true;
  }

  login(req, res, b) {
    if (this.fails.until > Date.now()) return json(res, 429, { error: `locked — wait ${Math.ceil((this.fails.until - Date.now()) / 1000)} s` });
    const a = this.admins.get(String(b?.name || '').toLowerCase());
    const good = a && timingSafeEqual(a.hash, hashPw(b.pw ?? '', a.salt));
    if (!good) {
      this.fails.n++;
      if (this.fails.n >= ADMIN_RULES.fails) { this.fails = { n: 0, until: Date.now() + ADMIN_RULES.lockSeconds * 1000 }; this.audit({ name: '?' }, 'login locked'); }
      return json(res, 401, { error: 'wrong name or password' });
    }
    this.fails = { n: 0, until: 0 };
    const token = randomBytes(24).toString('hex');
    this.sessions.set(token, { name: a.name, role: a.role, until: Date.now() + ADMIN_RULES.sessionHours * 3600e3 });
    this.audit(a, 'login');
    res.setHeader('Set-Cookie', `eo_admin=${token}; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=${ADMIN_RULES.sessionHours * 3600}`);
    json(res, 200, { ok: true, name: a.name, role: a.role });
  }
  sessionOf(req) {
    const t = cookie(req), s = t && this.sessions.get(t);
    if (!s) return null;
    if (s.until < Date.now()) { this.sessions.delete(t); return null; }
    return s;
  }
  body(req, res, fn) {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > ADMIN_RULES.bodyMax) req.destroy(); else chunks.push(c); });
    req.on('end', () => {
      let b = null;
      try { b = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; } catch { return json(res, 400, { error: 'bad json' }); }
      fn(b);
    });
  }

  audit(admin, action, data) {
    const row = { at: Date.now(), admin: admin.name, action, ...(data && Object.keys(data).length ? { data } : {}) };
    this.auditMem.push(row);
    if (this.auditMem.length > ADMIN_RULES.auditKeep) this.auditMem.shift();
    if (this.auditFile) try { fs.appendFileSync(this.auditFile, JSON.stringify(row) + '\n'); } catch (e) { this.log.warn?.('admin audit: ' + e.message); }
  }
  recentAudit(n) {
    if (this.auditFile) try {
      return fs.readFileSync(this.auditFile, 'utf8').trim().split('\n').slice(-n).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse();
    } catch { /* no file yet */ }
    return this.auditMem.slice(-n).reverse();
  }
  // header numbers
  summary() {
    const g = this.game;
    const people = [...(g?.sessions?.values?.() || [])].filter((s) => !s.sim);
    const runs = g?.dungeons?.instances?.list?.size ?? 0;
    const parties = g?.parties?.parties?.size ?? 0;
    return { online: people.length, accounts: g?.accounts?.store?.all?.().length ?? 0, runs, parties, serverTime: Date.now() };
  }
  // AD2: one row per CHARACTER (account × slot that has a save or a ledger). Read only: never seeds or writes a record.
  // Numbers: the server ledger (econ) when it exists — that is what the player really owns — else the save text.
  players() {
    const g = this.game, out = [];
    if (!g) return out;
    for (const acc of g.accounts.store.all()) {
      for (let slot = 1; slot <= CHAR_SLOTS; slot++) {
        const id = g.charId(acc.id, slot);
        let r;
        try { r = g.saves.store.get(id); } catch { r = null; }
        if (!r || (!r.main && !r.econ)) continue;
        let d = null;
        try { d = r.main ? JSON.parse(r.main) : null; } catch { d = null; }
        const p = (d && d.player) || {}, e = r.econ || {};
        const s = g.sessions.get(id), pr = s && s.presence;
        const inst = g.dungeons?.instances?.of?.(id), party = g.parties?.partyOf?.(id);
        out.push({
          id, account: acc.name, accountId: acc.id, slot,
          classId: p.classId || null,
          level: e.level ?? p.level ?? 1,
          gold: e.gold ?? p.gold ?? 0,
          diamonds: e.diamonds ?? p.diamonds ?? 0,
          map: (pr && pr.m) || p.map || null,
          online: !!s,
          where: !s ? null : inst ? (inst.mode === 'party' ? 'party run' : 'solo run') : pr && pr.room ? 'city' : 'lobby',
          party: party ? party.members?.size ?? party.members?.length ?? null : null,
          bosses: Object.keys(r.progress?.bosses || {}).length,
          unverified: e.unverified ?? 0,
          hasPw: !!acc.pwHash,
          created: acc.createdAt || null, lastLogin: acc.lastLogin || null, lastSave: r.at || null,
          deleted: !r.main && !!r.deleted,
        });
      }
    }
    return out;
  }
  page(res) {
    fs.readFile(new URL('./adminPage.html', import.meta.url), (err, data) => {
      if (err) return send(res, 500, 'admin page missing');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' });
      res.end(data);
    });
  }
}

function cookie(req) {
  const m = /(?:^|;\s*)eo_admin=([0-9a-f]{48})/.exec(req.headers.cookie || '');
  return m ? m[1] : null;
}
function send(res, code, text) { res.writeHead(code, { 'Content-Type': 'text/plain' }); res.end(text); }
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
