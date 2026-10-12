// Music videos (.mkv) -> audio files the game can play.  node tools/mkv-audio.js
// Reads desgin/song/*.mkv, takes the AAC audio track out (no ffmpeg needed: a small Matroska reader) and writes
// desgin/SOUND/music/<track>.aac (ADTS). Names: spaces / dashes -> '_', 'boss_commonp1' -> 'boss_common_p1'.
// Then run: node tools/build-audio.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'desgin', 'song');
const OUT = path.join(ROOT, 'desgin', 'SOUND', 'music');

// containers we walk into (children follow inline)
const MASTER = new Set([0x18538067, 0x1654AE6B, 0xAE, 0x1F43B675, 0xA0]);

function vint(buf, pos, keepMarker) {
  const b = buf[pos];
  let len = 1, mask = 0x80;
  while (len <= 8 && !(b & mask)) { len++; mask >>= 1; }
  let v = keepMarker ? b : b & (mask - 1);
  let allOnes = (b & (mask - 1)) === mask - 1;
  for (let i = 1; i < len; i++) { v = v * 256 + buf[pos + i]; if (buf[pos + i] !== 0xff) allOnes = false; }
  return { v, len, unknown: !keepMarker && allOnes };
}
const uint = (buf, a, n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + buf[a + i]; return v; };

function extract(buf) {
  const tracks = []; let cur = null;
  const frames = []; let audio = null;
  let pos = 0;
  while (pos < buf.length - 2) {
    const id = vint(buf, pos, true); if (id.len > 4) break;
    const sz = vint(buf, pos + id.len);
    const data = pos + id.len + sz.len;
    if (MASTER.has(id.v)) { if (id.v === 0xAE) tracks.push(cur = {}); pos = data; continue; }
    const end = data + sz.v;
    if (sz.unknown || end > buf.length) break;
    if (cur && id.v === 0xD7) cur.num = uint(buf, data, sz.v);
    else if (cur && id.v === 0x83) cur.type = uint(buf, data, sz.v);
    else if (cur && id.v === 0x86) cur.codec = buf.toString('latin1', data, end);
    else if (cur && id.v === 0x63A2) cur.priv = buf.subarray(data, end);
    else if (id.v === 0xA3 || id.v === 0xA1) {
      if (!audio) audio = tracks.find((t) => t.type === 2 && /^A_AAC/.test(t.codec || ''));
      if (!audio) throw new Error('no AAC audio track');
      const tn = vint(buf, data);
      if (tn.v === audio.num) {
        let p = data + tn.len + 2;
        const flags = buf[p++], lacing = (flags >> 1) & 3;
        if (!lacing) frames.push(buf.subarray(p, end));
        else {
          const n = buf[p++] + 1, sizes = [];
          if (lacing === 1) for (let i = 0; i < n - 1; i++) { let s = 0, b; do { b = buf[p++]; s += b; } while (b === 255); sizes.push(s); }
          else if (lacing === 3) {
            let f = vint(buf, p); p += f.len; sizes.push(f.v);
            for (let i = 1; i < n - 1; i++) { const d = vint(buf, p); p += d.len; const sv = d.v - (Math.pow(2, 7 * d.len - 1) - 1); sizes.push(sizes[i - 1] + sv); }
          }
          const rest = end - p - sizes.reduce((a, b) => a + b, 0);
          if (lacing === 2) { const each = (end - p) / n; for (let i = 0; i < n; i++) sizes.push(each); }
          else sizes.push(rest);
          for (const s of sizes) { frames.push(buf.subarray(p, p + s)); p += s; }
        }
      }
    }
    pos = end;
  }
  if (!audio || !audio.priv) throw new Error('no AAC config');
  const asc = audio.priv;
  const objType = asc[0] >> 3, sf = ((asc[0] & 7) << 1) | (asc[1] >> 7), ch = (asc[1] >> 3) & 15;
  const parts = [];
  for (const f of frames) {
    const L = f.length + 7, h = Buffer.alloc(7);
    h[0] = 0xff; h[1] = 0xf1;
    h[2] = ((objType - 1) << 6) | (sf << 2) | (ch >> 2);
    h[3] = ((ch & 3) << 6) | (L >> 11);
    h[4] = (L >> 3) & 0xff;
    h[5] = ((L & 7) << 5) | 0x1f; h[6] = 0xfc;
    parts.push(h, f);
  }
  return { data: Buffer.concat(parts), frames: frames.length, sf, ch };
}

const trackName = (f) => f.replace(/\.mkv$/i, '').toLowerCase().replace(/[\s-]+/g, '_').replace(/([a-z])p(\d)$/, '$1_p$2');

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(SRC).filter((x) => /\.mkv$/i.test(x))) {
  const r = extract(fs.readFileSync(path.join(SRC, f)));
  const name = trackName(f) + '.aac';
  fs.writeFileSync(path.join(OUT, name), r.data);
  console.log(`${f} -> music/${name}  ${(r.data.length / 1e6).toFixed(1)} MB, ${r.frames} frames, ${(r.frames * 1024 / [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050][r.sf] / 60).toFixed(1)} min`);
}
