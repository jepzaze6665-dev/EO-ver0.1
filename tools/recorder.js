// PROMO RECORDER (dev tool): renders the real game frame by frame into an MP4 (H.264, WebCodecs) with exact timing,
// so the result is smooth even when the browser is slow or the tab is hidden. No sound (music is added in the editor).
//   const R = await import('/tools/recorder.js');
//   const rec = await R.start(__game, { name: 'test', w: 1920, h: 1080, fps: 30 });
//   await rec.shot(2, { hud: false, title: 'WHISPERING FOREST' });   // 2 s of game time
//   await rec.finish();                                                // -> recordings/test.mp4 (server.js dev route)
import { Muxer, ArrayBufferTarget } from 'https://cdn.jsdelivr.net/npm/mp4-muxer@5/+esm';

const STEP = 1 / 60;
const img = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
export const ART = {};
export async function loadArt() {
  if (!ART.logo) [ART.logo, ART.emblem] = await Promise.all([img('/assets/ui/title/logo.png'), img('/assets/ui/title/emblem.png')]);
  return ART;
}

// Force the game canvas to an exact video size (window resizes are ignored while recording).
export function sizeTo(r, W, H) {
  r._origResize = r._origResize || r.resize;
  r.resize = () => {
    r.canvas.width = W; r.canvas.height = H; r.dpr = 1;
    r.scale = Math.max(1, Math.round(H / 400));
    const vw = Math.ceil(W / r.scale), vh = Math.ceil(H / r.scale);
    r.scene.width = vw; r.scene.height = vh; r.light.width = vw; r.light.height = vh;
    r.sctx.imageSmoothingEnabled = false; r.ctx.imageSmoothingEnabled = false;
    r.vw = vw; r.vh = vh;
    if (r.onResize) r.onResize(vw, vh);
  };
  r.resize();
}
export function restoreSize(r) { if (r._origResize) { r.resize = r._origResize; delete r._origResize; r.resize(); } }

export async function start(g, { name = 'promo', w = 1920, h = 1080, fps = 30, bitrate = 12e6 } = {}) {
  await loadArt();
  sizeTo(g.renderer, w, h);
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: 'avc', width: w, height: h, frameRate: fps }, fastStart: 'in-memory' });
  let error = null;
  const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { error = e; } });
  enc.configure({ codec: 'avc1.640028', width: w, height: h, bitrate, framerate: fps });
  const canvas = g.renderer.canvas, ctx = g.renderer.ctx;
  let n = 0;
  const rec = {
    g, w, h, fps, frames: () => n, seconds: () => n / fps,
    // one video frame: draw the game (+ HUD), the overlay, then encode
    async frame({ hud = false, overlay } = {}) {
      g.renderer.render(g);
      if (hud && g.state === 'play') g.ui.draw(ctx, w, h);
      if (overlay) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); overlay(ctx, w, h); ctx.restore(); }
      const vf = new VideoFrame(canvas, { timestamp: Math.round((n * 1e6) / fps), duration: Math.round(1e6 / fps) });
      enc.encode(vf, { keyFrame: n % (fps * 2) === 0 });
      vf.close(); n++;
      if (enc.encodeQueueSize > 8) await new Promise((r) => enc.addEventListener('dequeue', r, { once: true }));
      if (error) throw error;
    },
    // `sec` seconds of game time. perStep(g, i) runs every 1/60 s step (bot input, camera ...); overlay(ctx, w, h, k) with
    // k = 0..1 through the shot; fade = black fade-in / -out seconds; title / sub = caption card.
    async shot(sec, { perStep, perFrame, hud = false, overlay, fade = 0.25, fadeIn = fade, fadeOut = fade, title, sub, slow = 1 } = {}) {
      const total = Math.max(1, Math.round(sec * fps));
      const steps = Math.max(1, Math.round((1 / fps / STEP) * slow));
      let i = 0;
      for (let f = 0; f < total; f++) {
        if (perFrame) perFrame(g, f / total);
        for (let s = 0; s < steps; s++) {
          if (perStep) perStep(g, i++);
          if (g.worldRuns()) g.update(STEP * (slow < 1 ? 1 : 1));
          g.input.endFrame();
        }
        const k = f / total, t = f / fps;
        await rec.frame({ hud, overlay: (c, W, H) => {
          if (overlay) overlay(c, W, H, k, t);
          if (title) caption(c, W, H, title, sub, t, sec);
          const a = Math.max(fadeIn > 0 ? 1 - t / fadeIn : 0, fadeOut > 0 ? 1 - (sec - t) / fadeOut : 0);
          if (a > 0) { c.fillStyle = `rgba(0,0,0,${Math.min(1, a)})`; c.fillRect(0, 0, W, H); }
        } });
      }
    },
    // a still / drawn-only card (no game update): draw(ctx, w, h, k, t)
    async card(sec, draw) {
      const total = Math.round(sec * fps);
      for (let f = 0; f < total; f++) {
        const k = f / total, t = f / fps;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        draw(ctx, w, h, k, t);
        const vf = new VideoFrame(canvas, { timestamp: Math.round((n * 1e6) / fps), duration: Math.round(1e6 / fps) });
        enc.encode(vf, { keyFrame: n % (fps * 2) === 0 }); vf.close(); n++;
        if (enc.encodeQueueSize > 8) await new Promise((r) => enc.addEventListener('dequeue', r, { once: true }));
      }
    },
    async finish() {
      await enc.flush(); enc.close(); muxer.finalize();
      restoreSize(g.renderer);
      const buf = target.buffer;
      const res = await fetch(`/dev/recording/${name}.mp4`, { method: 'POST', body: buf });
      return { ok: res.ok, file: `recordings/${name}.mp4`, bytes: buf.byteLength, seconds: n / fps };
    },
  };
  return rec;
}

// Lower-third style caption: thin gold line + uppercase title, fades in over 0.4 s.
export function caption(c, W, H, title, sub, t, sec) {
  const a = Math.min(1, t / 0.4, (sec - t) / 0.3);
  if (a <= 0) return;
  const s = H / 1080, x = 110 * s, y = H - 150 * s;
  c.globalAlpha = a;
  c.shadowColor = 'rgba(0,0,0,0.9)'; c.shadowBlur = 18 * s;
  c.fillStyle = '#f1e2b8'; c.font = `600 ${52 * s}px Kanit, sans-serif`; c.textBaseline = 'alphabetic';
  c.fillText(title, x, y);
  c.fillStyle = 'rgba(232,193,106,0.95)'; c.fillRect(x, y + 18 * s, Math.min(1, t / 0.6) * 260 * s, 3 * s);
  if (sub) { c.fillStyle = '#d8cfe8'; c.font = `400 ${28 * s}px Kanit, sans-serif`; c.fillText(sub, x, y + 62 * s); }
  c.shadowBlur = 0; c.globalAlpha = 1;
}

// centred big text (used for "30+ BOSSES"-style beats)
export function bigText(c, W, H, text, a = 1, size = 96, color = '#f1e2b8', dy = 0) {
  const s = H / 1080;
  c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = 'rgba(0,0,0,0.95)'; c.shadowBlur = 24 * s;
  c.fillStyle = color; c.font = `700 ${size * s}px Kanit, sans-serif`;
  c.fillText(text, W / 2, H / 2 + dy * s);
  c.shadowBlur = 0; c.globalAlpha = 1; c.textAlign = 'left';
}

// CHECK a finished clip without a video player (the preview pane shows <video> black): decode the MP4 with WebCodecs and
// save a contact sheet of the frames at `times` (seconds) -> recordings/<out>.png
export async function contactSheet(name, times, out = name + '_sheet', cols = 4) {
  const MP4Box = (await import('https://cdn.jsdelivr.net/npm/mp4box@0.5.2/+esm')).default;
  const buf = await (await fetch(`/recordings/${name}.mp4?${Date.now()}`)).arrayBuffer(); buf.fileStart = 0;
  const f = MP4Box.createFile(), samples = []; let info;
  f.onReady = (i) => { info = i; f.setExtractionOptions(i.videoTracks[0].id, null, { nbSamples: 1e6 }); f.start(); };
  f.onSamples = (id, u, s) => samples.push(...s);
  f.appendBuffer(buf); f.flush();
  const v = info.videoTracks[0], entry = f.getTrackById(v.id).mdia.minf.stbl.stsd.entries[0];
  const ds = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN); entry.avcC.write(ds);
  const fps = samples.length / (v.duration / v.timescale), want = times.map((t) => Math.round(t * fps));
  const rows = Math.ceil(times.length / cols), sheet = new OffscreenCanvas(cols * 480, rows * 270), sx = sheet.getContext('2d');
  let k = 0;
  const dec = new VideoDecoder({ output: (fr) => { want.forEach((w, i) => { if (w === k) sx.drawImage(fr, (i % cols) * 480, Math.floor(i / cols) * 270, 480, 270); }); k++; fr.close(); }, error: (e) => console.error(e) });
  dec.configure({ codec: v.codec, codedWidth: v.track_width, codedHeight: v.track_height, description: new Uint8Array(ds.buffer, 8) });
  for (const s of samples) dec.decode(new EncodedVideoChunk({ type: s.is_sync ? 'key' : 'delta', timestamp: (s.cts * 1e6) / s.timescale, data: s.data }));
  await dec.flush();
  const res = await fetch(`/dev/recording/${out}.png`, { method: 'POST', body: await sheet.convertToBlob() });
  return { ok: res.ok, file: `recordings/${out}.png`, frames: samples.length };
}

// MUSIC: put a slice of a song under a finished clip (no re-encode of the picture: its H.264 samples are copied).
//   await R.addMusic('promo_v5', '/recordings/song.mkv', { offset: 3.5, out: 'promo_v5_music' })
// offset = second of the song that plays at clip 0:00; fadeIn / fadeOut in seconds; any audio file the browser decodes.
export async function addMusic(name, audioUrl, { offset = 0, out = name + '_music', fadeIn = 0.05, fadeOut = 0.8, gain = 1 } = {}) {
  const MP4Box = (await import('https://cdn.jsdelivr.net/npm/mp4box@0.5.2/+esm')).default;
  // 1) the clip's video samples
  const vbuf = await (await fetch(`/recordings/${name}.mp4?${Date.now()}`)).arrayBuffer(); vbuf.fileStart = 0;
  const f = MP4Box.createFile(), samples = []; let info;
  f.onReady = (i) => { info = i; f.setExtractionOptions(i.videoTracks[0].id, null, { nbSamples: 1e6 }); f.start(); };
  f.onSamples = (id, u, s) => samples.push(...s);
  f.appendBuffer(vbuf); f.flush();
  const v = info.videoTracks[0], entry = f.getTrackById(v.id).mdia.minf.stbl.stsd.entries[0];
  const ds = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN); entry.avcC.write(ds);
  const description = new Uint8Array(ds.buffer, 8), dur = v.duration / v.timescale;
  // 2) the song slice as PCM with fades
  const ab = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(await (await fetch(audioUrl)).arrayBuffer());
  const sr = ab.sampleRate, n = Math.round(dur * sr), ch = Math.min(2, ab.numberOfChannels);
  const pcm = []; for (let c = 0; c < ch; c++) {
    const src = ab.getChannelData(c), dst = new Float32Array(n), s0 = Math.round(offset * sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr, k = Math.min(1, fadeIn > 0 ? t / fadeIn : 1, fadeOut > 0 ? (dur - t) / fadeOut : 1);
      dst[i] = (src[s0 + i] || 0) * Math.max(0, k) * gain;
    }
    pcm.push(dst);
  }
  // 3) mux: copied video + newly encoded AAC
  const { Muxer, ArrayBufferTarget } = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5/+esm');
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: 'avc', width: v.track_width, height: v.track_height }, audio: { codec: 'aac', numberOfChannels: ch, sampleRate: sr }, fastStart: 'in-memory' });
  samples.forEach((s, i) => muxer.addVideoChunkRaw(new Uint8Array(s.data), s.is_sync ? 'key' : 'delta', (s.cts * 1e6) / s.timescale, (s.duration * 1e6) / s.timescale,
    i === 0 ? { decoderConfig: { codec: v.codec, codedWidth: v.track_width, codedHeight: v.track_height, description } } : undefined));
  let err = null;
  const enc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { err = e; } });
  enc.configure({ codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: ch, bitrate: 192000 });
  const FR = 4800;
  for (let i = 0; i < n; i += FR) {
    const len = Math.min(FR, n - i), planar = new Float32Array(len * ch);
    for (let c = 0; c < ch; c++) planar.set(pcm[c].subarray(i, i + len), c * len);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: len, numberOfChannels: ch, timestamp: Math.round((i / sr) * 1e6), data: planar });
    enc.encode(ad); ad.close();
  }
  await enc.flush(); enc.close();
  if (err) throw err;
  muxer.finalize();
  const res = await fetch(`/dev/recording/${out}.mp4`, { method: 'POST', body: target.buffer });
  return { ok: res.ok, file: `recordings/${out}.mp4`, seconds: dur, songFrom: offset, songTo: offset + dur, bytes: target.buffer.byteLength };
}

// SONG ANALYSIS (for beat-synced clips): duration, tempo (BPM) + beat phase, loudness per second (log energy, relative),
// onset strength per 10 ms (window.songOnset for further checks).
//   const a = await R.analyzeSong('/desgin/song/field_a.mkv')   -> { duration, bpm, phase, start, loud: [..per second] }
export async function analyzeSong(url) {
  const ab = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(await (await fetch(url)).arrayBuffer());
  const L = ab.getChannelData(0), Rr = ab.numberOfChannels > 1 ? ab.getChannelData(1) : L, hop = 480, N = Math.floor(L.length / hop);
  const en = new Float32Array(N), lo = new Float32Array(N); let lp = 0;
  for (let f = 0; f < N; f++) { let a = 0, b = 0; for (let i = f * hop; i < (f + 1) * hop; i++) { const x = (L[i] + Rr[i]) / 2; lp += 0.02 * (x - lp); a += x * x; b += lp * lp; } en[f] = Math.log(1e-7 + a); lo[f] = Math.log(1e-7 + b); }
  const on = new Float32Array(N);
  for (let f = 2; f < N; f++) on[f] = Math.max(0, en[f] - Math.max(en[f - 1], en[f - 2])) + 2 * Math.max(0, lo[f] - Math.max(lo[f - 1], lo[f - 2]));
  // first audible moment
  let start = 0; const peak = Math.max(...en.filter(Number.isFinite)); for (let f = 0; f < N; f++) if (en[f] > peak - 6) { start = f / 100; break; }
  // tempo by comb over the loud middle of the song
  const a0 = Math.min(N - 100, Math.round((start + 10) * 100)), a1 = Math.min(N, a0 + 6000);
  let best = [0, 0, 0];
  for (let bpm = 70; bpm <= 180; bpm += 0.1) {
    const P = 6000 / bpm;
    for (let p = 0; p < P; p += 1) { let s = 0, c = 0; for (let t = a0 + p; t < a1; t += P) { const f = Math.round(t); s += Math.max(on[f - 1] || 0, on[f], on[f + 1] || 0); c++; } s /= c; if (s > best[0]) best = [s, bpm, (a0 + p) / 100]; }
  }
  const loud = []; for (let s = 0; s < ab.duration - 1; s++) { let v = 0; for (let f = s * 100; f < (s + 1) * 100; f++) v += en[f]; loud.push(Math.round(v / 10) / 10); }
  window.songOnset = on;
  return { duration: Math.round(ab.duration * 10) / 10, bpm: Math.round(best[1] * 10) / 10, phase: best[2], start, loud };
}
