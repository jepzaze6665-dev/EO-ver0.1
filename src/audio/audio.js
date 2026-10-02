// Audio: real sound files when they exist (tools/build-audio.js -> assets/audio/audio.json, rules in
// src/data/sounds.js), else every sound is synthesised with WebAudio as before (fallback, like sprites).
import { AUDIO_BUSES, AUDIO_STORAGE_KEY, SOUND_RULES, SFX, ZONE_MUSIC, ZONE_AMBIENCE, bossTrack, spatial } from '../data/sounds.js';

const MANIFEST = 'assets/audio/audio.json';

export class Audio {
  constructor() {
    this.zoneWant = null;
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicNode = null;
    this.currentMusic = null;
    this.last = {};
    this.voices = {}; // sfx name -> playing count
    this.manifest = { sfx: {}, music: {}, amb: {} };
    this.buffers = new Map(); // file -> AudioBuffer | Promise
    this.listener = null; // () => { x, y } (Game sets it: the camera centre)
    this.levels = {};
    for (const [k, b] of Object.entries(AUDIO_BUSES)) this.levels[k] = b.def;
    try { Object.assign(this.levels, JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY) || '{}').levels || {}); this.muted = !!JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY) || '{}').muted; } catch (e) {}
    this.boss = null; // { id, phase } while a boss track rules
    this.ambNode = null; this.currentAmb = null;
  }
  get volume() { return this.levels.master; }
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      const bus = (k, mul) => { const g = this.ctx.createGain(); g.connect(this.master); g._mul = mul; return g; };
      this.sfxBus = bus('sfx', 1); this.musicBus = bus('music', 0.56); this.ambBus = bus('amb', 1); this.uiBus = bus('ui', 1);
      this.applyLevels();
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.loadManifest();
      if (this.pendingMusic) this.music(this.pendingMusic);
    } catch (e) { this.ctx = null; }
  }
  async loadManifest() {
    try {
      const r = await fetch(MANIFEST, { cache: 'no-cache' });
      if (!r.ok) return;
      const m = await r.json();
      this.manifest = { sfx: m.sfx || {}, music: m.music || {}, amb: m.amb || {} };
      for (const files of Object.values(this.manifest.sfx)) for (const file of files) this.buffer(file); // sfx are small: preload
      // a track that just got a file replaces the synth theme playing now
      if (this.boss) { const b = this.boss; this.boss = null; this.bossMusic(b.id, b.phase); }
      else if (this.zoneTrack && this.zoneTrack !== this.currentMusic) this.music(this.zoneTrack);
      if (this.wantAmb) { const a = this.wantAmb; this.currentAmb = null; this.ambience(a); }
    } catch (e) {}
  }
  buffer(file) {
    if (this.buffers.has(file)) return this.buffers.get(file);
    const p = fetch('assets/audio/' + file).then((r) => r.arrayBuffer()).then((a) => this.ctx.decodeAudioData(a))
      .then((b) => { this.buffers.set(file, b); return b; }).catch(() => { this.buffers.set(file, null); return null; });
    this.buffers.set(file, p);
    return p;
  }
  hasMusic(name) { return !!this.manifest.music[name]; }
  // ---- volume
  applyLevels() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, L = this.levels;
    this.master.gain.setTargetAtTime(this.muted ? 0 : L.master, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(L.sfx * this.sfxBus._mul, t, 0.05);
    this.musicBus.gain.setTargetAtTime(L.music * this.musicBus._mul, t, 0.05);
    this.ambBus.gain.setTargetAtTime(L.amb * this.ambBus._mul, t, 0.05);
    this.uiBus.gain.setTargetAtTime(L.ui * this.uiBus._mul, t, 0.05);
  }
  saveLevels() { try { localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify({ levels: this.levels, muted: this.muted })); } catch (e) {} }
  setLevel(bus, v) { if (!(bus in AUDIO_BUSES)) return; this.levels[bus] = Math.max(0, Math.min(1, +v || 0)); this.applyLevels(); this.saveLevels(); }
  setMuted(m) { this.muted = m; this.applyLevels(); this.saveLevels(); }
  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, attack = 0.005, delay = 0, bus } = {}) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.curBus || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, { vol = 0.3, freq = 1200, q = 1, type = 'bandpass', slide = 0, delay = 0 } = {}) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.curBus || this.sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  // sfx(name, { x, y }) — with a position the sound fades with distance from the listener and pans.
  sfx(name, at) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime, R = SOUND_RULES, def = SFX[name] || {};
    if (this.last[name] && now - this.last[name] < R.minGap) return; // de-dupe bursts
    let gain = 1, pan = 0;
    if (at && this.listener) {
      const l = this.listener();
      if (l) { const sp = spatial(at.x, at.y, l.x, l.y); gain = sp.gain; pan = sp.pan; if (gain <= 0.01) return; }
    }
    if ((this.voices[name] || 0) >= (def.maxVoices || R.maxVoices)) return;
    this.last[name] = now;
    const bus = def.bus === 'ui' ? this.uiBus : this.sfxBus;
    const files = this.manifest.sfx[name];
    if (files && files.length) {
      const file = files[Math.floor(Math.random() * files.length)], b = this.buffers.get(file);
      if (b && !(b instanceof Promise)) { this.playBuffer(name, b, bus, gain * (def.vol ?? 1), pan, def.pitch || R.pitch); return; }
    }
    this.curBus = bus;
    if (gain < 1 || pan) { // synth fallback through a positional node
      const g = this.ctx.createGain(); g.gain.value = gain;
      if (pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(bus); } else g.connect(bus);
      this.curBus = g;
    }
    try { this.synth(name); } finally { this.curBus = null; }
  }
  playBuffer(name, buf, bus, vol, pan, pitch) {
    const c = this.ctx, src = c.createBufferSource(), g = c.createGain();
    src.buffer = buf;
    src.playbackRate.value = pitch[0] + Math.random() * (pitch[1] - pitch[0]);
    g.gain.value = vol;
    src.connect(g);
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(bus); } else g.connect(bus);
    this.voices[name] = (this.voices[name] || 0) + 1;
    src.onended = () => { this.voices[name]--; };
    src.start();
  }
  synth(name) {
    const N = (d, o) => this.noise(d, o), Tn = (f, d, o) => this.tone(f, d, o);
    switch (name) {
      case 'swing': N(0.12, { freq: 2400, slide: 0.4, vol: 0.18, q: 2 }); break;
      case 'swing_fast': N(0.08, { freq: 3000, slide: 0.5, vol: 0.16, q: 2 }); break;
      case 'slash_heavy': N(0.2, { freq: 1800, slide: 0.3, vol: 0.25, q: 1.5 }); Tn(220, 0.2, { type: 'sawtooth', vol: 0.06, slide: 0.5 }); break;
      case 'hit': N(0.08, { freq: 900, vol: 0.3, type: 'lowpass' }); Tn(140, 0.08, { type: 'square', vol: 0.08, slide: 0.5 }); break;
      case 'crit': N(0.12, { freq: 1400, vol: 0.35 }); Tn(880, 0.15, { type: 'triangle', vol: 0.12, slide: 1.5 }); break;
      case 'hurt': Tn(180, 0.18, { type: 'sawtooth', vol: 0.15, slide: 0.5 }); N(0.1, { freq: 600, vol: 0.2 }); break;
      case 'dodge': case 'dash': N(0.18, { freq: 800, slide: 3, vol: 0.14, q: 3 }); break;
      case 'perfect': Tn(660, 0.35, { type: 'triangle', vol: 0.2 }); Tn(990, 0.45, { type: 'triangle', vol: 0.16, delay: 0.06 }); Tn(1320, 0.6, { type: 'sine', vol: 0.12, delay: 0.12 }); break;
      case 'mark': Tn(520, 0.12, { type: 'triangle', vol: 0.14, slide: 1.3 }); break;
      // ---- Aegis Guardian
      case 'block': N(0.1, { freq: 2600, vol: 0.22, q: 6 }); Tn(620, 0.12, { type: 'square', vol: 0.07, slide: 0.8 }); break;
      case 'perfect_guard': Tn(1040, 0.3, { type: 'triangle', vol: 0.18 }); Tn(1560, 0.45, { type: 'sine', vol: 0.13, delay: 0.04 }); N(0.12, { freq: 4000, vol: 0.2, q: 8 }); break;
      case 'taunt': Tn(160, 0.4, { type: 'sawtooth', vol: 0.12, slide: 1.4 }); Tn(320, 0.35, { type: 'triangle', vol: 0.1, delay: 0.05 }); break;
      // ---- Astral Weaver
      case 'star': Tn(1320, 0.12, { type: 'triangle', vol: 0.1, slide: 1.4 }); N(0.08, { freq: 5000, vol: 0.08, q: 4 }); break;
      case 'thread': Tn(740, 0.25, { type: 'sine', vol: 0.12, slide: 1.2 }); Tn(1110, 0.3, { type: 'sine', vol: 0.07, delay: 0.05 }); break;
      case 'thread_burst': N(0.3, { freq: 1600, vol: 0.28, slide: 0.4 }); Tn(990, 0.3, { type: 'triangle', vol: 0.14, slide: 0.6 }); Tn(1480, 0.4, { type: 'sine', vol: 0.1, delay: 0.06 }); break;
      case 'constellation': Tn(880, 0.3, { type: 'triangle', vol: 0.16 }); Tn(1320, 0.4, { type: 'triangle', vol: 0.13, delay: 0.06 }); Tn(1760, 0.55, { type: 'sine', vol: 0.1, delay: 0.12 }); N(0.2, { freq: 3000, vol: 0.12 }); break;
      case 'mark_full': Tn(520, 0.12, { type: 'triangle', vol: 0.14 }); Tn(780, 0.3, { type: 'triangle', vol: 0.16, delay: 0.07 }); break;
      case 'break_charge': Tn(120, 0.18, { type: 'sawtooth', vol: 0.2, slide: 2 }); break;
      case 'break': Tn(70, 0.8, { type: 'sine', vol: 0.5, slide: 0.4 }); N(0.6, { freq: 500, vol: 0.4, type: 'lowpass', slide: 0.3 }); Tn(440, 0.5, { type: 'sawtooth', vol: 0.08, slide: 0.25 }); break;
      case 'ult_charge': Tn(90, 0.5, { type: 'sawtooth', vol: 0.18, slide: 3 }); N(0.5, { freq: 300, slide: 6, vol: 0.2 }); break;
      case 'ult_slash': Tn(55, 1.2, { type: 'sine', vol: 0.55, slide: 0.5 }); N(0.9, { freq: 2600, slide: 0.15, vol: 0.4, q: 0.7 }); Tn(1760, 0.4, { type: 'triangle', vol: 0.1, slide: 0.3 }); break;
      case 'arc': N(0.35, { freq: 1500, slide: 0.3, vol: 0.28, q: 1 }); Tn(300, 0.3, { type: 'triangle', vol: 0.08, slide: 0.5 }); break;
      case 'counter': N(0.15, { freq: 2600, vol: 0.28 }); Tn(1040, 0.25, { type: 'triangle', vol: 0.14 }); break;
      case 'boom_small': Tn(90, 0.3, { vol: 0.3, slide: 0.5 }); N(0.25, { freq: 400, vol: 0.25, type: 'lowpass' }); break;
      case 'windup': Tn(200, 0.25, { type: 'square', vol: 0.05, slide: 1.4 }); break;
      case 'windup_big': Tn(80, 0.5, { type: 'sawtooth', vol: 0.12, slide: 1.6 }); break;
      case 'enemy_swing': N(0.12, { freq: 1200, slide: 0.5, vol: 0.14 }); break;
      case 'slam': case 'slam_big': Tn(60, 0.5, { vol: 0.45, slide: 0.5 }); N(0.35, { freq: 300, vol: 0.35, type: 'lowpass' }); break;
      case 'claw': N(0.2, { freq: 1500, slide: 0.4, vol: 0.3 }); break;
      case 'charge': N(0.6, { freq: 200, vol: 0.25, type: 'lowpass' }); break;
      case 'crash': Tn(50, 0.7, { vol: 0.5, slide: 0.5 }); N(0.5, { freq: 800, vol: 0.4 }); break;
      case 'roar': Tn(90, 1.3, { type: 'sawtooth', vol: 0.3, slide: 0.6, attack: 0.1 }); Tn(135, 1.1, { type: 'sawtooth', vol: 0.18, slide: 0.5, attack: 0.1 }); N(1.2, { freq: 400, vol: 0.25, slide: 0.5 }); break;
      case 'roar_small': Tn(120, 0.6, { type: 'sawtooth', vol: 0.18, slide: 0.6, attack: 0.05 }); break;
      case 'roots': N(0.9, { freq: 250, vol: 0.2, type: 'lowpass' }); break;
      case 'cast': Tn(700, 0.4, { type: 'triangle', vol: 0.08, slide: 1.8 }); break;
      case 'shoot': N(0.15, { freq: 3000, vol: 0.15, slide: 0.4 }); break;
      case 'shatter': for (let i = 0; i < 4; i++) Tn(1800 + Math.random() * 1600, 0.2, { type: 'triangle', vol: 0.06, delay: i * 0.03 }); N(0.2, { freq: 4000, vol: 0.12 }); break;
      case 'weak': Tn(880, 0.3, { type: 'square', vol: 0.06 }); Tn(1320, 0.4, { type: 'square', vol: 0.05, delay: 0.1 }); break;
      case 'kill': N(0.25, { freq: 500, vol: 0.18, slide: 0.4 }); break;
      case 'step': N(0.04, { freq: 400, vol: 0.03, type: 'lowpass' }); break;
      case 'deny': Tn(160, 0.12, { type: 'square', vol: 0.06 }); break;
      case 'potion': Tn(600, 0.12, { vol: 0.1 }); Tn(900, 0.2, { vol: 0.1, delay: 0.08 }); break;
      case 'levelup': [523, 659, 784, 1046].forEach((f, i) => Tn(f, 0.35, { type: 'triangle', vol: 0.12, delay: i * 0.09 })); break;
      case 'quest': [440, 660].forEach((f, i) => Tn(f, 0.3, { type: 'triangle', vol: 0.1, delay: i * 0.1 })); break;
      case 'quest_done': [523, 659, 784, 1046, 1318].forEach((f, i) => Tn(f, 0.4, { type: 'triangle', vol: 0.1, delay: i * 0.08 })); break;
      case 'chest': Tn(440, 0.15, { type: 'triangle', vol: 0.1 }); Tn(660, 0.25, { type: 'triangle', vol: 0.1, delay: 0.1 }); break;
      case 'chest_rare': [392, 523, 659, 784, 1046].forEach((f, i) => Tn(f, 0.5, { type: 'triangle', vol: 0.1, delay: i * 0.07 })); break;
      case 'secret': [330, 415, 494, 659].forEach((f, i) => Tn(f, 0.8, { type: 'sine', vol: 0.12, delay: i * 0.14 })); break;
      case 'lore': Tn(392, 0.6, { type: 'sine', vol: 0.08 }); Tn(587, 0.8, { type: 'sine', vol: 0.06, delay: 0.1 }); break;
      case 'waystone': Tn(784, 0.8, { type: 'sine', vol: 0.12 }); Tn(1175, 1.0, { type: 'sine', vol: 0.08, delay: 0.1 }); break;
      case 'shrine': case 'gate': Tn(196, 1.2, { type: 'triangle', vol: 0.15, attack: 0.2 }); Tn(294, 1.2, { type: 'triangle', vol: 0.12, attack: 0.3 }); break;
      case 'timber': N(0.8, { freq: 300, vol: 0.3, type: 'lowpass', slide: 0.4 }); Tn(70, 0.6, { vol: 0.3, delay: 0.5, slide: 0.5 }); break;
      case 'rubble': N(0.5, { freq: 500, vol: 0.3, type: 'lowpass' }); break;
      case 'gather': Tn(1200, 0.15, { type: 'triangle', vol: 0.08 }); break;
      case 'equip': N(0.1, { freq: 3000, vol: 0.12 }); Tn(660, 0.1, { type: 'square', vol: 0.04 }); break;
      case 'ui': Tn(880, 0.05, { type: 'square', vol: 0.03 }); break;
      case 'blink': Tn(1200, 0.2, { type: 'sine', vol: 0.08, slide: 0.3 }); break;
      case 'dash_enemy': N(0.25, { freq: 700, vol: 0.14, slide: 0.5 }); break;
      case 'discover_boss': Tn(65, 2, { type: 'sawtooth', vol: 0.15, attack: 0.5 }); Tn(98, 2, { type: 'sawtooth', vol: 0.1, attack: 0.5 }); break;
      case 'victory': [392, 523, 659, 784, 1046, 1318].forEach((f, i) => Tn(f, 1.2, { type: 'triangle', vol: 0.12, delay: i * 0.12 })); break;
      case 'death': Tn(220, 1.5, { type: 'sawtooth', vol: 0.15, slide: 0.3, attack: 0.05 }); break;
    }
  }

  // Generative ambient music per zone: slow pads + occasional notes.
  // ---- music. A boss track stays while that boss rules (bossMusic / endBoss); zone music waits under it.
  zone(z, info) {
    this.zoneWant = { track: ZONE_MUSIC[z], synth: info && info.music };
    this.ambience(ZONE_AMBIENCE[z] || null);
    if (!this.boss) this.music(this.zoneTrack);
  }
  // a fixed screen track (title): file when there is one, else the synth theme
  screen(track, synth) { this.boss = null; this.zoneWant = { track, synth }; this.ambience(null); this.music(this.zoneTrack); }
  get zoneTrack() { const w = this.zoneWant; return w ? (w.track && this.hasMusic(w.track) ? w.track : w.synth) : null; }
  bossMusic(bossId, phase = 1) {
    if (this.boss && this.boss.id === bossId && this.boss.phase === phase) return;
    this.boss = { id: bossId, phase };
    const t = bossTrack(bossId, phase, (n) => this.hasMusic(n));
    this.music(t || 'boss', { fade: phase > 1 ? SOUND_RULES.phaseFade : SOUND_RULES.musicFade, force: true });
  }
  endBoss(next) { this.boss = null; this.music(next || this.zoneTrack); }
  music(name, { fade = SOUND_RULES.musicFade, force = false } = {}) {
    if (!name) return;
    if (!force && this.boss) return; // zone changes inside an arena keep the boss track
    if (!this.ctx) { this.pendingMusic = name; return; }
    if (this.currentMusic === name) return;
    this.currentMusic = name;
    if (this.musicNode) {
      const old = this.musicNode, t = this.ctx.currentTime;
      old.gain.gain.cancelScheduledValues(t); old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + fade);
      setTimeout(() => old.stop(), fade * 1000 + 200);
      this.musicNode = null;
    }
    const files = this.manifest.music[name];
    if (files && files.length) { this.playTrack(name, files[0], fade); return; }
    const SCALES = {
      village: { root: 196, notes: [0, 2, 4, 7, 9, 12], pad: 'triangle', tempo: 1.4, bright: 1 },
      forest: { root: 147, notes: [0, 3, 5, 7, 10, 12], pad: 'sine', tempo: 2.2, bright: 0.6 },
      ruins: { root: 131, notes: [0, 1, 5, 7, 8, 12], pad: 'sine', tempo: 2.6, bright: 0.5 },
      gate: { root: 110, notes: [0, 1, 6, 7], pad: 'sawtooth', tempo: 3, bright: 0.3 },
      arena: { root: 110, notes: [0, 3, 7, 10], pad: 'sine', tempo: 3, bright: 0.4 },
      boss: { root: 110, notes: [0, 3, 5, 6, 7, 10, 12], pad: 'sawtooth', tempo: 0.28, bright: 0.8, boss: true },
      cave: { root: 123, notes: [0, 2, 3, 7, 8], pad: 'sine', tempo: 2.4, bright: 0.5 },
      ancient: { root: 165, notes: [0, 2, 3, 7, 9, 10, 12], pad: 'triangle', tempo: 2.1, bright: 0.75 },
      peak: { root: 165, notes: [0, 2, 5, 7, 9, 12, 14], pad: 'triangle', tempo: 2.2, bright: 0.95 },
      caverns: { root: 139, notes: [0, 2, 3, 7, 8, 12], pad: 'sine', tempo: 2.8, bright: 0.6 },
      frost: { root: 185, notes: [0, 2, 3, 7, 9, 12, 14], pad: 'sine', tempo: 2.4, bright: 0.9 },
      asteria: { root: 208, notes: [0, 2, 4, 5, 7, 9, 12], pad: 'triangle', tempo: 1.5, bright: 1.1 },
      valley: { root: 175, notes: [0, 2, 4, 7, 9, 11, 12], pad: 'triangle', tempo: 1.8, bright: 1 },
      victory: { root: 196, notes: [0, 4, 7, 12, 16], pad: 'triangle', tempo: 1.2, bright: 1 },
    };
    const S = SCALES[name] || SCALES.forest;
    const c = this.ctx;
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(1, c.currentTime + 2);
    gain.connect(this.musicBus);
    const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 500 + S.bright * 1200; filt.connect(gain);
    const oscs = [];
    for (const [mul, v] of [[0.5, 0.25], [0.75, 0.12], [1, 0.1]]) {
      const o = c.createOscillator(); o.type = S.pad; o.frequency.value = S.root * mul;
      const g = c.createGain(); g.gain.value = v * (S.pad === 'sawtooth' ? 0.35 : 1);
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07 + Math.random() * 0.1; lg.gain.value = v * 0.4;
      lfo.connect(lg); lg.connect(g.gain); lfo.start();
      o.connect(g); g.connect(filt); o.start();
      oscs.push(o, lfo);
    }
    let alive = true, step = 0;
    const tick = () => {
      if (!alive) return;
      const t = c.currentTime;
      if (S.boss) {
        // driving pulse for the boss
        const f = S.root * (step % 8 < 6 ? 0.5 : 0.5 * Math.pow(2, 3 / 12));
        this.tone(f, 0.22, { type: 'square', vol: 0.12, bus: gain });
        if (step % 4 === 0) this.noise(0.12, { freq: 120, vol: 0.2, type: 'lowpass' });
        if (step % 8 === 4) this.noise(0.08, { freq: 3000, vol: 0.05 });
        if (step % 16 === 0) this.tone(S.root * Math.pow(2, S.notes[Math.floor(Math.random() * S.notes.length)] / 12) * 2, 1.2, { type: 'triangle', vol: 0.07, bus: gain, attack: 0.05 });
      } else if (Math.random() < 0.75) {
        const n = S.notes[Math.floor(Math.random() * S.notes.length)];
        const f = S.root * Math.pow(2, n / 12) * (Math.random() < 0.5 ? 2 : 4);
        this.tone(f, 2.5, { type: 'triangle', vol: 0.05 * S.bright + 0.02, attack: 0.3, bus: gain });
      }
      step++;
      setTimeout(tick, S.tempo * 1000 * (S.boss ? 1 : 0.6 + Math.random() * 0.8));
    };
    tick();
    this.musicNode = { gain, stop: () => { alive = false; oscs.forEach((o) => { try { o.stop(); } catch (e) {} }); gain.disconnect(); } };
  }
  // a looping file on a bus with a fade-in; loop points from the manifest (seconds) when given
  playTrack(name, file, fade, bus = this.musicBus, slot = 'musicNode') {
    const c = this.ctx, gain = c.createGain();
    gain.gain.value = 0; gain.connect(bus);
    let src = null, alive = true;
    const node = { gain, stop: () => { alive = false; try { src && src.stop(); } catch (e) {} gain.disconnect(); } };
    this[slot] = node;
    Promise.resolve(this.buffer(file)).then((b) => {
      if (!alive || !b) return;
      src = c.createBufferSource(); src.buffer = b; src.loop = true;
      const lp = (this.manifest.loops || {})[file];
      if (lp) { src.loopStart = lp[0]; src.loopEnd = lp[1]; }
      src.connect(gain); src.start();
      const t = c.currentTime;
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(1, t + fade);
    });
  }
  ambience(name) {
    this.wantAmb = name;
    if (!this.ctx || this.currentAmb === name) return;
    const files = name && this.manifest.amb[name];
    if (name && !files) return; // no file yet: keep silence (or the previous loop until a real one exists)
    this.currentAmb = name;
    if (this.ambNode) { const o = this.ambNode, t = this.ctx.currentTime; o.gain.gain.linearRampToValueAtTime(0, t + SOUND_RULES.ambFade); setTimeout(() => o.stop(), SOUND_RULES.ambFade * 1000 + 200); this.ambNode = null; }
    if (files) this.playTrack(name, files[0], SOUND_RULES.ambFade, this.ambBus, 'ambNode');
  }
}
