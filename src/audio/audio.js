// Placeholder audio: every sound is synthesised with WebAudio (no files), so any
// sfx name can later be mapped to a real sample without touching gameplay code.
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = 0.5;
    this.musicNode = null;
    this.currentMusic = null;
    this.last = {};
  }
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.8; this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.28; this.musicBus.connect(this.master);
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      if (this.pendingMusic) this.music(this.pendingMusic);
    } catch (e) { this.ctx = null; }
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : this.volume; }

  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, attack = 0.005, delay = 0, bus } = {}) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus);
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
    s.connect(f); f.connect(g); g.connect(this.sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  sfx(name) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.03) return; // de-dupe bursts
    this.last[name] = now;
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
  music(name) {
    if (!this.ctx) { this.pendingMusic = name; return; }
    if (this.currentMusic === name) return;
    this.currentMusic = name;
    if (this.musicNode) {
      const old = this.musicNode;
      old.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
      setTimeout(() => old.stop(), 1700);
    }
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
}
