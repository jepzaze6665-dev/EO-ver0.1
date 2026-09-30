import { TAU, rand } from '../core/math.js';
import { TEAM } from '../core/constants.js';
import { distToSegment } from '../combat/threadSystem.js';

// LUMEN ORACLE — Class 2 of the Astral Weaver. Support Mage · Healer · Barrier · Purifier.
// Class = data + behaviour that only CALLS core systems:
//   ResourcePool ('lumen' + tier RADIANCE) · SkillSystem · StatusSystem (shield = barrier, light_mark, guiding_light, cleanse)
//   ThreadSystem ('radiant_thread': the Weaver's thread turned into a healing thread) · Player.heal (event 'healed') ·
//   PartySystem through game.players() (solo = yourself; an ally / a real second player works the same) · Combat.
// Gameplay loop: MARK (Lumen Bolt: Light Mark) → HEAL / BARRIER (Oracle's Grace, Radiant Thread, Divine Barrier) → the light
//   you give becomes LUMEN (only effective healing counts) → SUPPORT (Guiding Light buffs) → PURIFY → JUDGMENT (the ultimate
//   heals the party and smites the foes in the same ring). Every choice: spend Lumen on protection, or on judgment.
// Nothing in the core knows this file exists; passives react to bus events through `on`.

const C = '#ffe08a', CR = '255,224,138', PALE = '#fffaf0', SKY = '150,200,255';
const L = 'lumen';
const RT = 'radiant_thread';

// animation table for the 'lo' preset (tools/build-player.js lo → assets/player/lo); no idle sheet (walk col 0)
// (dash col 3 and ult col 4 are empty in the art: not used)
// hit: the RELEASE column (staff thrust / light released) — every event of an action fires while it shows
// (tools/tests/castTiming.test.mjs)
export const LO_ANIMS = {
  idle: { sheet: 'walk', cols: [0] },
  walk: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 9, loop: true, bob: 1 },
  run: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 13, loop: true, bob: 1 },
  // basic combo = only frames WITHOUT painted light (owner: the painted orb / swirl covered the character); col 2 is the
  // staff thrust without its painted orb — the game's own light bolt leaves from the staff tip there
  atk1: { sheet: 'atk1', cols: [1, 2, 2, 5], hit: [2] },
  atk2: { sheet: 'atk2', cols: [1, 2, 2, 5], hit: [2] },
  atk3: { sheet: 'atk1', cols: [1, 2, 2, 2, 5], hit: [2] }, // finisher: the clean thrust held longer (SK1 is all painted light)
  dodge: { sheet: 'dash', cols: [1, 2] },
  lumenBolt: { sheet: 'sk1', cols: [1, 2, 3, 4], hit: [3] },
  grace: { sheet: 'sk2', cols: [1, 2, 3, 4], hit: [3] },
  radiantThread: { sheet: 'sk3', cols: [1, 2, 3, 4], hit: [3] },
  purify: { sheet: 'sk4', cols: [1, 2, 3, 4], hit: [3] },
  barrier: { sheet: 'sk5', cols: [1, 2, 3, 4], hit: [3] },
  lumenBurst: { sheet: 'sk6', cols: [1, 2, 3, 4], hit: [3] },
  judgment: { sheet: 'ult', cols: [1, 2, 3, 3, 5], hit: [3] },
  hurt: { sheet: 'hit', cols: [1, 2] },
  death: { sheet: 'hit', cols: [1, 2, 3, 4] },
};

// ---- helpers (class-local)
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const party = (g, p) => (g.players ? g.players() : [p]); // standing members, you included
const ratio = (m) => (m.maxHp ? m.hp / m.maxHp : 1);
function aimPoint(p, g, range) {
  const m = g.mouseWorld(), dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, range / d);
  return { x: p.x + dx * k, y: p.y + dy * k };
}
function foes(g) { return g.world.hostiles().filter((m) => !m.dead && !m.isBreakable); }
// the party member in range who needs it most (lowest HP share; ties go to an ally, not yourself)
function neediest(g, p, range, x = p.x, y = p.y) {
  let best = null;
  for (const m of party(g, p)) {
    if (Math.hypot(m.x - x, m.y - y) > range) continue;
    if (!best || ratio(m) < ratio(best) - 1e-9 || (Math.abs(ratio(m) - ratio(best)) < 1e-9 && best === p)) best = m;
  }
  return best || p;
}
// a party member (not you) near a point — who the cursor points at
function allyAt(g, p, x, y, within) {
  let best = null, bd = within;
  for (const m of party(g, p)) { if (m === p) continue; const d = Math.hypot(m.x - x, m.y - y); if (d < bd) { bd = d; best = m; } }
  return best;
}

export const LumenOracle = {
  id: 'lumen_oracle',
  stableId: 'class_lumen_oracle',
  name: 'Lumen Oracle',
  role: 'Support Mage · Healer · Barrier · Purifier',
  difficulty: 4,
  ratings: { damage: 2, range: 4, defense: 2, mobility: 2, support: 5 },
  description: 'The Astral Weaver who turned the stars into mercy: healing light, golden barriers, threads that carry life, and a judgment that heals friends and smites foes in the same ring.',
  identity: 'Guide. Heal. Protect. Judge.',
  tagline: 'Light guides, heals — and judges.',
  loop: ['Mark', 'Heal / Barrier', 'Build Lumen', 'Support', 'Purify', 'Judgment'],
  strengths: ['The only real healer of the game: heals over time, bursts, heal threads', 'Barriers and purification for the whole party', 'Strong alone too: every heal on yourself is a heal, and the ultimate is also a big attack'],
  weaknesses: ['Lowest personal damage of the Astral line', 'Must keep the party close (every tool has a range)', 'Lumen must be split between protecting and judging'],
  signatureWeapon: 'lumen_staff',
  preset: 'lo',
  anims: LO_ANIMS,
  theme: { color: C, ghost: '#ffd070', trail: 'stardust' },
  startingGear: { weapon: 'lumen_staff', armor: 'oracle_vestment' },
  resource: L,
  resources: [L],
  mark: null,
  base: { hp: 220, atk: 20, def: 5, crit: 0.06, critDmg: 0, magicDmg: 0, lightDmg: 0, cdr: 0, speed: 148, lumenGain: 1, armorBreak: 1, healPower: 0 },
  perLevel: { hp: 11, atk: 1.5, def: 0.45 },
  defaultLoadout: ['lumen_bolt', 'oracles_grace', 'radiant_thread', 'divine_barrier'],
  // LUMEN rules (data, not code). Healing counts only what was REALLY restored (no farming on full-HP targets); everything
  // goes through a per-second budget.
  lumen: { perSec: 8, healShare: 40, barrierShare: 25, purify: 4, lightHit: 2, hitCap: 6, absorbShare: 20 },
  // heals: share of the TARGET's max HP (× 1 + healPower); on yourself heals count ×selfMult (a healer, not a tank)
  heal: { bolt: 0.08, selfBolt: 0.05, selfMult: 0.85 },
  grace: { r: 60, dur: 6, every: 0.5, share: 0.015, range: 320, sear: 0.3 }, // sear: light damage to foes on the sigil each beat
  thread: { every: 0.5, share: 0.01, flow: 0.4, flowCapPerSec: 0.08 }, // heal on one end -> 40% to the other (≤ 8% max HP / s)
  // what Purifying Light removes: status ids and / or whole categories (config, not skill code)
  purify: { r: 160, statuses: ['poison', 'burn', 'curse', 'slow', 'root', 'silence', 'shock', 'void_rot', 'exposed'], categories: ['dot'], healPer: 0.04, power: 1.0 },
  barrier: { share: 0.22, dur: 6, cap: 0.45, r: 200 },
  burst: { r: 180, heal: 0.18, power: 1.6 },
  judgment: { r: 190, heal: 0.3, barrier: 0.2, power: 3.4, lance: 1.4, lanceAt: 1.4, slow: 3 },
  lightMark: { dur: 6, bonus: 0.25 }, // JUDGMENT OF LIGHT: your light damage +20% on a Light-Marked foe
  guiding: { dur: 4 },
  passives: [
    { id: 'guiding_light', name: 'Guiding Light', trigger: 'you heal someone', desc: 'Whoever you heal gets GUIDING LIGHT for 4 s: +10% damage and +10% movement speed.' },
    { id: 'judgment_of_light', name: 'Judgment of Light', trigger: 'foe carries a Light Mark', desc: 'Your light damage is 25% stronger against Light-Marked foes (Lumen Bolt, Radiant Thread and the ultimate mark them).' },
    { id: 'radiance', name: 'Radiance (Lumen 70+)', trigger: 'resource threshold', desc: 'At 70+ Lumen your heals and barriers are 15% stronger and your light damage 10% stronger.' },
  ],
  guideIntro: [
    'Your light heals and judges. LUMEN BOLT [1] hits a foe (LIGHT MARK) — or heals an ally when you aim at them. ORACLE\'S GRACE [2] lays a healing sigil under whoever needs it most.',
    'Only REAL healing writes LUMEN. Spend it on DIVINE BARRIER [4], [Q] LUMEN BURST (a big heal + light nova) or the ultimate ASTRAL JUDGMENT.',
  ],
  tutorial: { marks: 'Reach 70 Lumen (RADIANCE)', break: 'Use Lumen Burst', breakSkill: 'lumen_burst' },

  // HUD counter: radiant threads out
  hudCounter(p) {
    const n = p.game && p.game.threads ? p.game.threads.count(p, RT) : 0;
    return { label: 'RADIANT THREADS', value: n, max: 2, color: C, full: PALE, ready: p.resources.get(L) >= 70, readyText: 'RADIANCE — LUMEN BURST' };
  },

  // ---- lumen through the per-second budget
  gainLumen(p, n, why) {
    const B = p.cls.lumen, want = Math.min(n, p.lumenBudget ?? B.perSec);
    if (!(want > 0)) return 0;
    p.lumenBudget = (p.lumenBudget ?? B.perSec) - want;
    p.resources.gain(L, want, { reason: why });
    return want;
  },
  healPower(p) { return 1 + (p.stats.healPower || 0); },
  // HEAL a party member: share of ITS max HP; Lumen only for what was really restored; GUIDING LIGHT on it
  healTarget(p, g, t, share, why = 'heal', opts = {}) {
    if (!t || t.dead || t.downed) return 0;
    const cls = p.cls;
    const amount = Math.round(t.maxHp * share * cls.healPower(p) * (t === p ? cls.heal.selfMult : 1));
    const got = t.heal(amount, p);
    if (got > 0) {
      cls.gainLumen(p, (got / t.maxHp) * cls.lumen.healShare, why);
      if (t.status) t.status.add('guiding_light', cls.guiding.dur, { source: p, refresh: true });
      g.events.emit('allyHealed', { source: p, target: t, amount: got, kind: why, flow: !!opts.flow });
    }
    return got;
  },
  // BARRIER: adds to what the target holds, capped (no stacking to infinity); Lumen for what was really added
  giveBarrier(p, g, t, share) {
    const cls = p.cls, B = cls.barrier;
    const want = Math.round(t.maxHp * share * cls.healPower(p)), cap = Math.round(t.maxHp * B.cap);
    const cur = t.status.get('shield'), have = cur ? Math.max(0, cur.amount || 0) : 0;
    const amount = Math.min(cap, have + want);
    t.status.add('shield', B.dur, { amount, source: p, refresh: true });
    const added = amount - have;
    if (added > 0) {
      cls.gainLumen(p, (added / t.maxHp) * cls.lumen.barrierShare, 'barrier');
      g.vfx.text(t.x, t.y - 78, `+${added} BARRIER`, { color: PALE, size: 10 });
      g.events.emit('barrierCreated', { owner: p, target: t, amount: added });
    }
    return added;
  },
  // PURIFY one member: removes the configured statuses / categories; returns how many
  purifyTarget(p, g, t) {
    const P = p.cls.purify;
    if (!t || !t.status) return 0;
    let n = 0;
    for (const s of t.status.list()) {
      const cat = t.status.defs[s.id] && t.status.defs[s.id].category;
      if (P.statuses.includes(s.id) || P.categories.includes(cat)) { t.status.remove(s.id); n++; }
    }
    return n;
  },
  // light damage with JUDGMENT OF LIGHT on marked foes
  lightMult(p, t) { return t && t.status && t.status.has('light_mark') ? 1 + p.cls.lightMark.bonus : 1; },
  markLight(p, g, t) { if (t && t.status && !t.dead) t.status.add('light_mark', p.cls.lightMark.dur, { source: p, refresh: true }); },

  // ---------------- basic: two motes of light, then a lance that Light-Marks
  basic(p, g, a, step) {
    const cls = p.cls;
    const defs = [
      { dur: 0.32, at: 0.17, anim: 'atk1', power: 0.85, speed: 480, scale: 0.4, frames: [0, 1] },
      { dur: 0.32, at: 0.17, anim: 'atk2', power: 0.9, speed: 480, scale: 0.4, frames: [0, 1] },
      { dur: 0.44, at: 0.23, anim: 'atk3', power: 1.25, speed: 560, scale: 0.6, frames: [2, 3], mark: true },
    ];
    const d = defs[step];
    return {
      name: 'basic' + step, basic: true, step, dur: d.dur, anim: d.anim, moveMul: 0.55, ang: a, cancelAt: 0.05, comboAt: d.at + 0.06,
      events: [[d.at, () => {
        g.audio.sfx(step === 2 ? 'cast' : 'swing_fast');
        const ox = p.x + Math.cos(a) * 16, oy = p.y - 18 + Math.sin(a) * 16;
        g.combat.projectiles.fire({
          x: ox, y: oy, vx: Math.cos(a) * d.speed, vy: Math.sin(a) * d.speed, r: step === 2 ? 9 : 6, life: 0.55,
          team: TEAM.PLAYER, owner: p, kind: 'sprite', sprite: 'lo_bolt', frames: d.frames, fps: 12, scale: d.scale,
          power: d.power, type: 'light', knock: step === 2 ? 110 : 40, stagger: 6 + step * 6, hitStop: 0.03, shake: 0.05, color: C, trail: true,
          powerFor: (t) => d.power * cls.lightMult(p, t),
          onHit: (t) => { cls.gainLumen(p, 1, 'light'); if (d.mark) cls.markLight(p, g, t); },
        });
      }]],
    };
  },

  skills: [
    {
      slot: 1, id: 'lumen_bolt', tier: 'fast', name: 'Lumen Bolt', type: 'active', cooldown: 2, cost: 0, targeting: 'direction',
      tags: ['ranged', 'light', 'heal', 'mark'], icon: 'lumen_bolt',
      desc: 'A bolt of light. At a foe: light damage + LIGHT MARK. Aimed at an ally: it heals them instead (8% of their max HP). Aimed at yourself: a small self-heal.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'lumen_bolt', dur: 0.34, anim: 'lumenBolt', moveMul: 0.35, ang: a, cancelAt: 0.2,
          events: [[0.18, () => {
            const m = g.mouseWorld(), ally = allyAt(g, p, m.x, m.y, 50);
            if (ally && dist(ally, p) <= 360) { // HEAL BOLT
              g.audio.sfx('shrine');
              g.vfx.beam(p.x, p.y - 22, Math.atan2(ally.y - p.y, ally.x - p.x), dist(ally, p), 3, { life: 0.2, color: CR });
              g.vfx.sprite('lo_grace', ally.x, ally.y - 34, 0, { scale: 0.6, life: 0.35, glow: 0.5 });
              cls.healTarget(p, g, ally, cls.heal.bolt, 'bolt');
              return;
            }
            if (Math.hypot(m.x - p.x, m.y - p.y) < 28) { // at your own feet: a small self-heal
              g.vfx.sprite('lo_grace', p.x, p.y - 28, 0, { scale: 0.5, life: 0.3, glow: 0.5 });
              cls.healTarget(p, g, p, cls.heal.selfBolt, 'bolt');
              return;
            }
            g.audio.sfx('star');
            const ox = p.x + Math.cos(a) * 18, oy = p.y - 18 + Math.sin(a) * 18;
            let fed = 0;
            g.combat.projectiles.fire({
              x: ox, y: oy, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, r: 9, life: 0.5,
              team: TEAM.PLAYER, owner: p, kind: 'sprite', sprite: 'lo_bolt', frames: [2, 3], fps: 14, scale: 0.8,
              pierce: true, power: 1.8, type: 'light', knock: 60, stagger: 12, hitStop: 0.04, shake: 0.08, color: C, trail: true,
              powerFor: (t) => 1.8 * cls.lightMult(p, t),
              onHit: (t) => { cls.markLight(p, g, t); if (fed < cls.lumen.hitCap) { fed += cls.lumen.lightHit; cls.gainLumen(p, cls.lumen.lightHit, 'light'); } },
            });
          }]],
        };
      },
    },
    {
      slot: 2, id: 'oracles_grace', tier: 'medium', name: 'Oracle\'s Grace', type: 'active', cooldown: 10, cost: 0, targeting: 'self',
      tags: ['heal', 'hot', 'zone', 'support', 'ally'], icon: 'oracles_grace',
      desc: 'A sigil of light under the party member in range who needs it most (yourself when alone): for 6 s everyone standing on it heals 1.5% of their max HP every 0.5 s (≈ 18%), and foes standing on it are seared by light.',
      cast(p, g, a) {
        const cls = p.cls, G = cls.grace;
        return {
          name: 'oracles_grace', dur: 0.46, anim: 'grace', moveMul: 0.2, ang: a, cancelAt: 0.3,
          events: [[0.24, () => {
            const t = neediest(g, p, G.range);
            g.audio.sfx('shrine');
            p.graces = (p.graces || []).filter((z) => z.t > 0).slice(-1); // at most 2 sigils
            const z = { x: t.x, y: t.y, r: G.r, t: G.dur, pulse: 0 };
            p.graces.push(z);
            g.vfx.sprite('lo_grace', t.x, t.y - 56, 0, { scale: 1, life: 0.5, glow: 0.5 });
            z.fx = g.vfx.sprite('lo_purify', t.x, t.y, 0, { scale: G.r / 48, life: G.dur, frame: 5, glow: 0.3, alpha: 0.5, ground: true, squash: 0.55 });
            g.vfx.text(t.x, t.y - 80, t === p ? 'GRACE' : 'GRACE → ALLY', { color: PALE, size: 10 });
            if (t !== p) g.events.emit('allyProtected', { source: p, target: t, kind: 'grace' });
          }]],
        };
      },
    },
    {
      slot: 3, id: 'radiant_thread', tier: 'fast', name: 'Radiant Thread', type: 'active', cooldown: 8, cost: 0, targeting: 'point',
      tags: ['thread', 'heal', 'ally', 'light', 'support'], icon: 'radiant_thread',
      desc: 'The Weaver\'s thread, made of healing light (up to 2, 6 s): from you to the ally nearest the cursor, or to the ground. Party members on it heal 1% max HP every 0.5 s, a heal on one end flows 40% to the other, and foes crossing it are burned and LIGHT-MARKED.',
      cast(p, g, a) {
        return {
          name: 'radiant_thread', dur: 0.38, anim: 'radiantThread', moveMul: 0.25, ang: a, cancelAt: 0.22,
          events: [[0.2, () => {
            const pt = aimPoint(p, g, 300), ally = allyAt(g, p, pt.x, pt.y, 70);
            const th = g.threads.create(p, RT, { entity: p }, ally ? { entity: ally } : pt);
            if (!th) return;
            g.audio.sfx('thread');
            g.vfx.sprite('lo_thread', (th.a.x + th.b.x) / 2, (th.a.y + th.b.y) / 2 - 16, Math.atan2(th.b.y - th.a.y, th.b.x - th.a.x), { scale: Math.min(2, Math.max(0.6, dist(th.a, th.b) / 100)), life: 0.35, glow: 0.5 });
            if (ally) { g.vfx.text(ally.x, ally.y - 80, 'RADIANT THREAD', { color: PALE, size: 9 }); g.events.emit('allyProtected', { source: p, target: ally, kind: 'thread' }); }
          }]],
        };
      },
    },
    {
      id: 'purifying_light', tier: 'fast', name: 'Purifying Light', type: 'active', cooldown: 9, cost: 0, targeting: 'self',
      tags: ['cleanse', 'heal', 'support', 'light', 'aoe'], icon: 'purifying_light',
      desc: 'A ring of pure light (r 160): removes poison, burn, curse, slow, root, silence, shock, void rot, exposed and every damage-over-time from the party (what is removed is class data), heals 4% max HP per effect removed, and burns nearby foes.',
      cast(p, g, a) {
        const cls = p.cls, P = cls.purify;
        return {
          name: 'purifying_light', dur: 0.4, anim: 'purify', moveMul: 0.2, ang: a, cancelAt: 0.25,
          events: [[0.21, () => {
            g.audio.sfx('shrine');
            g.vfx.sprite('lo_purify', p.x, p.y - 30, 0, { scale: 1.4, life: 0.45, glow: 0.6 });
            g.vfx.ring(p.x, p.y, 10, P.r, { life: 0.35, color: CR, width: 3 });
            let total = 0;
            for (const m of party(g, p)) {
              if (dist(m, p) > P.r) continue;
              const n = cls.purifyTarget(p, g, m);
              if (!n) continue;
              total += n;
              cls.healTarget(p, g, m, P.healPer * n, 'purify');
              g.vfx.text(m.x, m.y - 84, `PURIFIED ×${n}`, { color: PALE, size: 9 });
            }
            if (total) { cls.gainLumen(p, P.purify * total, 'purify'); g.events.emit('purified', { source: p, count: total }); }
            g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 6, shape: 'circle', r: P.r * 0.6, power: P.power, type: 'light', knock: 120, stagger: 14, hitStop: 0.04, shake: 0.12,
              powerFor: (t) => P.power * cls.lightMult(p, t) });
          }]],
        };
      },
    },
    {
      slot: 4, id: 'divine_barrier', tier: 'medium', name: 'Divine Barrier', type: 'active', cooldown: 14, cost: 25, targeting: 'self',
      tags: ['barrier', 'shield', 'support', 'ally', 'aoe'], icon: 'divine_barrier',
      desc: 'A golden barrier (25 Lumen) on every party member within 200 px: 22% of their max HP for 6 s, stacking up to 45% max HP.',
      cast(p, g, a) {
        const cls = p.cls, B = cls.barrier;
        return {
          name: 'divine_barrier', dur: 0.46, anim: 'barrier', moveMul: 0.2, ang: a, cancelAt: 0.3,
          events: [[0.24, () => {
            g.audio.sfx('shrine');
            g.vfx.ring(p.x, p.y, 10, B.r, { life: 0.4, color: CR, width: 2 });
            for (const m of party(g, p)) {
              if (dist(m, p) > B.r) continue;
              g.vfx.sprite('lo_barrier', m.x, m.y - 26, 0, { scale: 0.8, life: 0.5, glow: 0.5 });
              cls.giveBarrier(p, g, m, B.share);
              if (m !== p) g.events.emit('allyProtected', { source: p, target: m, kind: 'barrier' });
            }
          }]],
        };
      },
    },
    {
      slot: 5, id: 'astral_judgment', tier: 'high', name: 'Astral Judgment', type: 'ultimate', cooldown: 50, cost: 70, targeting: 'point',
      tags: ['ultimate', 'aoe', 'heal', 'barrier', 'cleanse', 'light', 'mark'], icon: 'astral_judgment', ultimate: true,
      desc: 'ULTIMATE (70 Lumen). A great ring of light (r 190) at the cursor. ALLIES inside: heal 30%, barrier 20%, purified, Guiding Light. FOES inside: heavy light damage, slowed 3 s, Light-Marked — and 1.4 s later a lance of judgment strikes every marked foe.',
      cast(p, g, a) {
        const cls = p.cls, J = cls.judgment, pt = aimPoint(p, g, 260);
        return {
          name: 'astral_judgment', dur: 0.9, anim: 'judgment', moveMul: 0, ang: a, cancelAt: 99, invuln: [0, 0.9], superArmor: true,
          start: () => {
            g.slowMo(0.5, 0.3);
            g.audio.sfx('ult_charge');
            g.vfx.flash('255,240,200', 0.3, 2);
            g.vfx.ring(pt.x, pt.y, 20, J.r, { life: 0.8, color: CR, width: 2 });
          },
          events: [[0.45, () => {
            g.camera.punch(0.2); g.camera.shake(0.4);
            g.vfx.sprite('lo_judgment', pt.x, pt.y - 150, 0, { scale: 2.4, life: 0.7, glow: 0.7 });
            g.vfx.ring(pt.x, pt.y, 20, J.r, { life: 0.45, width: 5, color: CR, fill: true });
            g.vfx.text(pt.x, pt.y - 120, 'ASTRAL JUDGMENT', { color: PALE, size: 14, life: 1.2 });
            g.audio.sfx('ult_slash');
            for (const m of party(g, p)) { // ALLIES
              if (dist(m, pt) > J.r) continue;
              cls.purifyTarget(p, g, m);
              cls.healTarget(p, g, m, J.heal, 'judgment');
              cls.giveBarrier(p, g, m, J.barrier);
            }
            g.combat.spawnHitbox({ owner: p, x: pt.x, y: pt.y, shape: 'circle', r: J.r, power: J.power, type: 'light', knock: 160, stagger: 50, hitStop: 0.1, shake: 0.4, big: true,
              powerFor: (t) => J.power * cls.lightMult(p, t),
              onHit: (t) => { cls.markLight(p, g, t); if (t.status) t.status.add('slow', J.slow, { source: p }); } });
            g.after(J.lanceAt, () => { // the lances of judgment
              if (p.dead || p.disposed) return;
              for (const t of foes(g)) {
                if (dist(t, pt) > J.r + 40 || !t.status.has('light_mark')) continue;
                g.vfx.sprite('lo_lance', t.x, t.y - 46, 0, { scale: 1, life: 0.4, glow: 0.6 });
                g.combat.dealDamage(p, t, { power: J.lance * cls.lightMult(p, t), type: 'light', knock: 40, stagger: 20, hitStop: 0.04, shake: 0.12, color: C, skillId: 'astral_judgment' });
              }
            });
          }]],
        };
      },
    },
  ],

  // ---------------- LUMEN BURST (Q / right click): a big heal around you + a light nova (the Heal Burst)
  special: {
    id: 'lumen_burst', tier: 'medium', name: 'Lumen Burst', type: 'special', slot: 'Q', key: 'Q', icon: 'lumen_burst',
    cost: 40, cooldown: 12, targeting: 'self', tags: ['heal', 'aoe', 'light', 'support'],
    desc: 'Release 40 Lumen as a burst of light (r 180): every party member inside heals 18% of their max HP, and foes inside take light damage.',
    cast(p, g, a) {
      const cls = p.cls, B = cls.burst;
      return {
        name: 'lumen_burst', dur: 0.46, anim: 'lumenBurst', moveMul: 0.1, ang: a, cancelAt: 0.3, superArmor: true,
        events: [[0.24, () => {
          g.audio.sfx('constellation');
          g.vfx.flash(CR, 0.2, 4);
          g.vfx.sprite('lo_spike', p.x, p.y - 48, 0, { scale: 1.4, life: 0.45, glow: 0.7 });
          g.vfx.ring(p.x, p.y, 10, B.r, { life: 0.4, width: 4, color: CR, fill: true });
          let n = 0;
          for (const m of party(g, p)) if (dist(m, p) <= B.r) { cls.healTarget(p, g, m, B.heal, 'burst'); n++; }
          g.vfx.text(p.x, p.y - 86, n > 1 ? `LUMEN BURST ×${n}` : 'LUMEN BURST', { color: PALE, size: 11 });
          g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 6, shape: 'circle', r: B.r, power: B.power, type: 'light', knock: 160, stagger: 24, hitStop: 0.06, shake: 0.2,
            powerFor: (t) => B.power * cls.lightMult(p, t) });
        }]],
      };
    },
  },

  // ---------------- every frame: grace sigils, radiant threads (healing along the line), lumen budget
  tick(p, g, dt) {
    const cls = p.cls;
    p.lumenBudget = Math.min(cls.lumen.perSec, (p.lumenBudget ?? cls.lumen.perSec) + cls.lumen.perSec * dt);
    p.flowUsed = Math.max(0, (p.flowUsed || 0) - cls.thread.flowCapPerSec * dt); // flow cap refills over a second
    if (p.dead || p.downed) return;
    // ORACLE'S GRACE sigils
    if (p.graces && p.graces.length) {
      const G = cls.grace;
      for (const z of p.graces) {
        z.t -= dt; z.pulse -= dt;
        if (z.t <= 0 || z.pulse > 0) continue;
        z.pulse += G.every;
        for (const m of party(g, p)) if (dist(m, z) <= z.r) cls.healTarget(p, g, m, G.share, 'grace');
        // holy ground: foes on the sigil are seared
        g.combat.spawnHitbox({ owner: p, x: z.x, y: z.y, shape: 'circle', r: z.r, power: G.sear, type: 'light', knock: 0, stagger: 3, hitStop: 0, shake: 0, skillId: 'oracles_grace', noSkillMods: true,
          powerFor: (t) => G.sear * cls.lightMult(p, t) });
      }
      for (const z of p.graces) if (z.t <= 0 && z.fx) z.fx.life = 0;
      p.graces = p.graces.filter((z) => z.t > 0);
    }
    // RADIANT THREAD: party members on the line heal
    const mine = g.threads.ofOwner(p).filter((th) => th.type === RT);
    if (mine.length) {
      p.threadPulse = (p.threadPulse ?? cls.thread.every) - dt;
      if (p.threadPulse <= 0) {
        p.threadPulse += cls.thread.every;
        for (const m of party(g, p)) {
          if (mine.some((th) => { const [q, r] = g.threads.ends(th); return distToSegment(m.x, m.y, q.x, q.y, r.x, r.y) <= (m.radius || 10) + 12; })) cls.healTarget(p, g, m, cls.thread.share, 'thread');
        }
      }
    }
  },

  // ---------------- passives / flows: react to core events
  on: {
    // a heal on one end of a radiant thread flows 40% to the other end (a flow never flows again; capped per second)
    healed(p, g, e) {
      const t = e.entity, cls = p.cls;
      if (!t || e.source !== p) return; // only the Oracle's own heals flow (a potion does not; a flow never flows again)
      for (const th of g.threads.ofOwner(p)) {
        if (th.type !== RT) continue;
        const other = th.a.entity === t ? th.b.entity : th.b.entity === t ? th.a.entity : null;
        if (!other || other.dead || !other.heal || !party(g, p).includes(other)) continue;
        const room = Math.max(0, other.maxHp * cls.thread.flowCapPerSec - (p.flowUsed || 0) * other.maxHp);
        const amount = Math.min(room, e.amount * cls.thread.flow);
        if (amount < 1) continue;
        p.flowUsed = (p.flowUsed || 0) + amount / other.maxHp;
        const got = other.heal(Math.round(amount), 'flow');
        if (got > 0) { g.vfx.beam(t.x, t.y - 20, Math.atan2(other.y - t.y, other.x - t.x), dist(t, other), 2, { life: 0.15, color: CR }); g.events.emit('allyHealed', { source: p, target: other, amount: got, kind: 'flow', flow: true }); }
      }
    },
    // your barriers soaking a hit on someone = protecting them -> Lumen (budget)
    shieldAbsorbed(p, g, e) {
      if (e.statusSource !== p || !(e.amount > 0) || !e.target || !e.target.maxHp) return;
      p.cls.gainLumen(p, (e.amount / e.target.maxHp) * p.cls.lumen.absorbShare, 'protect');
    },
    resourceTier(p, g, e) {
      if (e.entity !== p || e.resource !== L || e.tier <= e.before || !e.def) return;
      g.vfx.text(p.x, p.y - 82, e.def.label, { color: '#ffffff', size: 13, life: 1.1 });
      g.vfx.sprite('lo_spike', p.x, p.y - 31, 0, { scale: 0.9, life: 0.45, glow: 0.6 });
      g.audio.sfx('mark_full');
      g.world.setFlag('tut_marks'); // tutorial step "Reach 70 Lumen"
    },
  },
  counterBonus: { resource: 6 }, // data/counter.js
  perfectDodge: { resource: 10, stamina: 10, cooldownCut: 0.8, statuses: [{ id: 'haste', dur: 1.5, mult: 1.3 }] }, // data/dodge.js
};
