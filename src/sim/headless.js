// HEADLESS (online plan H1, docs/online/HEADLESS_SERVER_PLAN.md): stand-ins for the browser APIs the game touches,
// so the real Game (same rules, same systems) runs in Node with no screen, sound or keyboard.
// Everything here is a do-nothing object: drawing, sound and DOM calls are accepted and ignored.

// any property / call / construction returns the same harmless proxy
function nothing() {
  const fn = function () {};
  let proxy;
  const handler = {
    get(_, k) {
      if (k === Symbol.toPrimitive) return (hint) => (hint === 'number' ? 0 : '');
      if (k === Symbol.iterator) return function* () {};
      if (k === 'then') return undefined; // not a promise
      if (k === 'length' || k === 'width' || k === 'height') return 0;
      if (k === 'style' || k === 'dataset' || k === 'classList') return proxy;
      return proxy;
    },
    set() { return true; },
    apply() { return proxy; },
    construct() { return proxy; },
    has() { return true; },
  };
  proxy = new Proxy(fn, handler);
  return proxy;
}
export const NOTHING = nothing();

// a 2D context that measures text as 0 wide and draws nothing
function fakeContext() {
  const ctx = {
    canvas: null,
    measureText: (t) => ({ width: String(t || '').length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(0, (w | 0) * (h | 0) * 4)) }),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(0, (w | 0) * (h | 0) * 4)) }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => ({}),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    isPointInPath: () => false,
  };
  return new Proxy(ctx, {
    get(t, k) { if (k in t) return t[k]; return typeof k === 'string' && /^[a-z]/.test(k) ? () => {} : undefined; },
    set(t, k, v) { t[k] = v; return true; },
  });
}

class FakeCanvas {
  constructor(w = 1280, h = 720) { this.width = w; this.height = h; this.style = {}; this.clientWidth = w; this.clientHeight = h; }
  getContext() { if (!this._ctx) { this._ctx = fakeContext(); this._ctx.canvas = this; } return this._ctx; }
  addEventListener() {} removeEventListener() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height, right: this.width, bottom: this.height }; }
  toDataURL() { return ''; }
  focus() {}
}

class FakeImage {
  constructor() { this.width = 0; this.height = 0; this.naturalWidth = 0; this.naturalHeight = 0; this.complete = true; }
  set src(v) { this._src = v; if (this.onload) queueMicrotask(() => this.onload && this.onload()); }
  get src() { return this._src; }
  addEventListener() {} removeEventListener() {}
}

const memoryStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
};

function fakeElement(tag = 'div') {
  if (tag === 'canvas') return new FakeCanvas();
  const el = NOTHING;
  return el;
}

// Installs the stand-ins on globalThis (only where Node has nothing). Call once, before importing src/core/game.js
// in a process that never had a browser. Returns the canvas to give the Game.
let installed = false;
export function installHeadless() {
  const g = globalThis;
  if (!installed) {
    installed = true;
    const listeners = { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
    if (!g.window) g.window = g;
    Object.assign(g, {
      addEventListener: g.addEventListener || listeners.addEventListener,
      removeEventListener: g.removeEventListener || listeners.removeEventListener,
    });
    g.innerWidth ??= 1280; g.innerHeight ??= 720; g.devicePixelRatio ??= 1;
    g.location ??= { href: 'http://headless/', search: '', hostname: 'headless', host: 'headless', protocol: 'http:', pathname: '/', reload() {} };
    try { if (!g.navigator || !g.navigator.userAgent) g.navigator = { userAgent: 'headless', language: 'en', languages: ['en'], getGamepads: () => [] }; } catch { /* Node 21+ has a read-only navigator */ }
    g.localStorage ??= memoryStorage();
    g.sessionStorage ??= memoryStorage();
    g.Image ??= FakeImage;
    g.HTMLCanvasElement ??= FakeCanvas;
    g.OffscreenCanvas ??= FakeCanvas;
    g.requestAnimationFrame ??= () => 0; // the headless loop is driven by SimGame.tick, never by frames
    g.cancelAnimationFrame ??= () => {};
    g.AudioContext ??= function () { return NOTHING; };
    g.WebSocket ??= function () { return NOTHING; };
    g.matchMedia ??= () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    g.getComputedStyle ??= () => NOTHING;
    if (!g.document) {
      g.document = {
        createElement: fakeElement,
        createElementNS: (_, tag) => fakeElement(tag),
        getElementById: () => NOTHING, querySelector: () => NOTHING, querySelectorAll: () => [],
        body: NOTHING, head: NOTHING, documentElement: NOTHING,
        fonts: { load: async () => [], ready: Promise.resolve() },
        addEventListener() {}, removeEventListener() {},
        hidden: true, visibilityState: 'hidden',
      };
    }
  }
  return new FakeCanvas();
}

// fetch('assets/...') from the project folder, so the real loadAll() reads the same atlas / json data as the browser
// (images become empty FakeImage: the server needs the numbers, not the pixels)
export function installAssetFetch(rootDir) {
  const g = globalThis;
  if (g.__headlessFetch) return;
  const realFetch = g.fetch;
  g.__headlessFetch = true;
  g.fetch = async (src, ...rest) => {
    const s = String(src);
    if (/^[a-z]+:/i.test(s)) return realFetch(src, ...rest);
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    try {
      const body = await readFile(join(rootDir, s.replace(/^\/+/, '').split('?')[0]));
      return { ok: true, status: 200, json: async () => JSON.parse(body.toString('utf8')), text: async () => body.toString('utf8') };
    } catch {
      return { ok: false, status: 404, json: async () => { throw new Error('404 ' + s); }, text: async () => '' };
    }
  };
}
