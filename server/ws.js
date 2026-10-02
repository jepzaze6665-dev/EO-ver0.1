// ONLINE N1 — minimal WebSocket server side (RFC 6455), no dependencies (the project has none: server.js is plain Node).
// Text frames only (the protocol is JSON); ping / pong / close handled here; fragmented messages are joined; frames from
// the client MUST be masked (RFC) — unmasked ones close the socket. maxBytes caps one message: bigger = close 1009.
import { createHash } from 'crypto';
import { EventEmitter } from 'events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const OP = { cont: 0x0, text: 0x1, binary: 0x2, close: 0x8, ping: 0x9, pong: 0xa };

export const acceptKey = (key) => createHash('sha1').update(key + GUID).digest('base64');

// server frame (never masked)
export function encodeFrame(opcode, payload = Buffer.alloc(0)) {
  const len = payload.length;
  const head = len < 126 ? Buffer.alloc(2) : len < 65536 ? Buffer.alloc(4) : Buffer.alloc(10);
  head[0] = 0x80 | opcode;
  if (len < 126) head[1] = len;
  else if (len < 65536) { head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}

// client-style masked frame (tests)
export function encodeMaskedFrame(opcode, payload, fin = true) {
  const mask = Buffer.from([0x12, 0x34, 0x56, 0x78]);
  const plain = encodeFrame(opcode, payload);
  const hl = plain.length - payload.length;
  const out = Buffer.alloc(plain.length + 4);
  plain.copy(out, 0, 0, hl);
  out[0] = (fin ? 0x80 : 0) | opcode;
  out[1] |= 0x80;
  mask.copy(out, hl);
  for (let i = 0; i < payload.length; i++) out[hl + 4 + i] = payload[i] ^ mask[i & 3];
  return out;
}

// pulls complete frames out of a byte buffer: { frames, rest } | { error }
export function decodeFrames(buf, maxBytes) {
  const frames = [];
  let off = 0;
  while (buf.length - off >= 2) {
    const b0 = buf[off], b1 = buf[off + 1];
    if (b0 & 0x70) return { error: 1002 };                 // RSV bits: no extensions negotiated
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f, p = off + 2;
    if (len === 126) { if (buf.length - p < 2) break; len = buf.readUInt16BE(p); p += 2; }
    else if (len === 127) {
      if (buf.length - p < 8) break;
      const big = buf.readBigUInt64BE(p); p += 8;
      if (big > BigInt(maxBytes)) return { error: 1009 };
      len = Number(big);
    }
    if (len > maxBytes) return { error: 1009 };
    if (!masked) return { error: 1002 };
    if (buf.length - p < 4 + len) break;
    const mask = buf.subarray(p, p + 4); p += 4;
    const payload = Buffer.alloc(len);
    for (let i = 0; i < len; i++) payload[i] = buf[p + i] ^ mask[i & 3];
    frames.push({ fin: (b0 & 0x80) !== 0, opcode: b0 & 0x0f, payload });
    off = p + len;
  }
  return { frames, rest: buf.subarray(off) };
}

// one accepted connection. Events: 'message' (string), 'close' (code, reason), 'pong'.
export class WsConnection extends EventEmitter {
  constructor(socket, { maxBytes = 4096, remote = '' } = {}) {
    super();
    this.socket = socket;
    this.maxBytes = maxBytes;
    this.remote = remote;
    this.buf = Buffer.alloc(0);
    this.parts = null;         // fragments of a message in progress
    this.open = true;
    socket.setNoDelay(true);
    socket.on('data', (d) => this.onData(d));
    socket.on('close', () => this.finish(1006, 'socket closed'));
    socket.on('error', () => this.finish(1006, 'socket error'));
  }

  onData(d) {
    if (!this.open) return;
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    if (this.buf.length > this.maxBytes * 4 + 64) return this.close(1009, 'too large');
    const r = decodeFrames(this.buf, this.maxBytes);
    if (r.error) return this.close(r.error, r.error === 1009 ? 'too large' : 'protocol error');
    this.buf = Buffer.from(r.rest);
    for (const f of r.frames) { if (!this.open) return; this.onFrame(f); }
  }

  onFrame({ fin, opcode, payload }) {
    if (opcode === OP.close) {
      const code = payload.length >= 2 ? payload.readUInt16BE(0) : 1005;
      return this.close(code === 1005 ? 1000 : code, 'client closed');
    }
    if (opcode === OP.ping) return this.raw(encodeFrame(OP.pong, payload));
    if (opcode === OP.pong) return this.emit('pong');
    if (opcode === OP.binary) return this.close(1003, 'text only');
    if (opcode === OP.text) {
      if (this.parts) return this.close(1002, 'protocol error');
      if (fin) return this.emit('message', payload.toString('utf8'));
      this.parts = [payload];
    } else if (opcode === OP.cont) {
      if (!this.parts) return this.close(1002, 'protocol error');
      this.parts.push(payload);
      const size = this.parts.reduce((s, b) => s + b.length, 0);
      if (size > this.maxBytes) return this.close(1009, 'too large');
      if (fin) { const msg = Buffer.concat(this.parts).toString('utf8'); this.parts = null; this.emit('message', msg); }
    } else this.close(1002, 'protocol error');
  }

  send(text) { if (this.open) this.raw(encodeFrame(OP.text, Buffer.from(text, 'utf8'))); }
  ping() { if (this.open) this.raw(encodeFrame(OP.ping)); }
  raw(b) { if (!this.socket.destroyed) this.socket.write(b); }

  close(code = 1000, reason = '') {
    if (!this.open) return;
    const r = Buffer.from(String(reason).slice(0, 100), 'utf8');
    const p = Buffer.alloc(2 + r.length); p.writeUInt16BE(code, 0); r.copy(p, 2);
    this.raw(encodeFrame(OP.close, p));
    this.socket.end();
    setTimeout(() => this.socket.destroy(), 500).unref();
    this.finish(code, reason);
  }

  finish(code, reason) {
    if (!this.open) return;
    this.open = false;
    this.emit('close', code, reason);
  }
}

// http 'upgrade' handler -> WsConnection (or a refused handshake)
export function acceptUpgrade(req, socket, opts) {
  const key = req.headers['sec-websocket-key'];
  if (req.headers.upgrade?.toLowerCase() !== 'websocket' || !key || req.headers['sec-websocket-version'] !== '13') {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    return null;
  }
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey(key)}`, '', ''].join('\r\n'));
  return new WsConnection(socket, { ...opts, remote: socket.remoteAddress || '' });
}
