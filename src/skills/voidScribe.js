import { TAU, rand } from '../core/math.js';
import { TEAM } from '../core/constants.js';
import { SCRIPTS, SCRIPT_RULES } from '../data/scripts.js';

// VOID SCRIBE — Class 2 of the Astral Weaver. Control Mage · Damage over Time · Debuff · Summoner.
// Class = data + behaviour that only CALLS core systems:
//   ResourcePool ('void_ink' + tier ABYSSAL) · SkillSystem · StatusSystem (void_rot, sable_mark, void_seal, nulled, slow,
//   silence; modifier dotRate = DoT acceleration) · SummonSystem ('void_phantom', drawn from its VFX strip) · Combat.
//   SCRIPTS = glyphs written on the ground whose effect comes from data/scripts.js (REWRITE follows each entry's `next`).
// Gameplay loop: PLACE SCRIPT → DEBUFF (Sable Mark) → CONNECT (Void Chain) → SUMMON PHANTOM (it strikes foes inside your
//   scripts and makes the script pulse) → DoT builds VOID INK → REWRITE the field (Ruin / Bind / Hush) → FINAL SCRIPT: NULL.
// Preparation wins fights: little burst, low mobility, every tool is a slow death or a rule written on the ground.
// Nothing in the core knows this file exists; passives react to bus events through `on`.

const C = '#b060ff', CR = '176,96,255', PALE = '#f0d8ff', PINK = '255,96,208';
const INK = 'void_ink';

// animation table for the 'vs' preset (tools/build-player.js vs → assets/player/vs)
// (dash col 3-4 and sk2 col 4 are empty in the art: not used)
export const VS_ANIMS = {
  idle: { sheet: 'idle', cols: [0, 1, 2, 3, 4, 5], fps: 4, loop: true },
  walk: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 9, loop: true },
  run: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 13, loop: true },
  atk1: { sheet: 'atk1', cols: [1, 2, 3, 4] },
  atk2: { sheet: 'atk2', cols: [1, 2, 3, 4] },
  atk3: { sheet: 'sk2', cols: [1, 2, 3] },
  dodge: { sheet: 'dash', cols: [1, 2] },
  voidScript: { sheet: 'sk1', cols: [1, 2, 3, 4] },
  sableMark: { sheet: 'sk2', cols: [1, 2, 3, 5] },
  phantomQuill: { sheet: 'sk3', cols: [1, 2, 3, 4] },
  rewrite: { sheet: 'sk4', cols: [1, 2, 3, 4] },
  voidChain: { sheet: 'sk5', cols: [1, 2, 3, 4] },
  voidSeal: { sheet: 'sk6', cols: [1, 2, 3, 4] },
  finalScript: { sheet: 'ult', cols: [1, 2, 3, 4] },
  hurt: { sheet: 'hit', cols: [1, 2] },
  death: { sheet: 'hit', cols: [1, 2, 3, 4] },
};

// ---- helpers (class-local)
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function aimPoint(p, g, range) {
  const m = g.mouseWorld(), dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, range / d);
  return { x: p.x + dx * k, y: p.y + dy * k };
}
function foes(g) { return g.world.hostiles().filter((m) => !m.dead && !m.isBreakable); }
const isBoss = (t) => !!(t && (t.isBoss || t.type === 'guardian' || (t.def && t.def.boss)));
// harmful statuses on a target (categories debuff / dot / control) — passive ENDLESS SCRIPT counts them
function debuffCount(t) {
  if (!t || !t.status) return 0;
  let n = 0;
  for (const s of t.status.list()) { const c = t.status.defs[s.id] && t.status.defs[s.id].category; if (c === 'debuff' || c === 'dot' || c === 'control') n++; }
  return n;
}

export const VoidScribe = {
  id: 'void_scribe',
  stableId: 'class_void_scribe',
  name: 'Void Scribe',
  role: 'Control Mage · Damage over Time · Debuff · Summoner',
  difficulty: 5,
  ratings: { damage: 3, range: 4, defense: 2, mobility: 2, support: 3 },
  description: 'The Astral Weaver who stopped weaving stars and started writing rules: scripts on the ground, marks that rot, phantoms of ink, and a final line that erases everything.',
  identity: 'Write the rule. Let the void enforce it.',
  tagline: 'Whatever is written into the void becomes law.',
  loop: ['Place Script', 'Debuff', 'Connect', 'Summon Phantom', 'Damage over Time', 'Rewrite', 'Null'],
  strengths: ['Strongest control of the line: slow, silence, root, DoT acceleration', 'Damage keeps ticking while you reposition', 'Phantoms and scripts fight for you — great on long fights and packs'],
  weaknesses: ['Needs time to prepare the ground before it deals real damage', 'Lowest mobility of the Astral line (no blink)', 'Little burst: Void Ink must be spent at the right moment'],
  signatureWeapon: 'void_tome',
  preset: 'vs',
  anims: VS_ANIMS,
  theme: { color: C, ghost: '#6a2aff', trail: 'shadow' },
  startingGear: { weapon: 'void_tome', armor: 'scribe_robe' },
  resource: INK,
  resources: [INK],
  mark: null,
  base: { hp: 215, atk: 21, def: 4, crit: 0.06, critDmg: 0, magicDmg: 0, voidDmg: 0, cdr: 0, speed: 146, inkGain: 1, armorBreak: 1 },
  perLevel: { hp: 10.5, atk: 1.6, def: 0.4 },
  defaultLoadout: ['void_script', 'sable_mark', 'phantom_quill', 'rewrite'],
  // VOID INK rules (data, not code). Everything except deaths goes through a per-second budget (no ink farming).
  ink: { perSec: 6, dotTick: 0.6, debuff: 2, sable: 5, scriptPulse: 0.4, share: 0.5, death: 8, deathCap: 16, deathWindow: 3 },
  // DoT tick sizes = × your ATK per stack
  dot: { rot: 0.18, sable: 0.2, dur: 5 },
  // passive ENDLESS SCRIPT: direct void damage +12% per harmful status on the target beyond the first, max +36%
  endless: { per: 0.12, max: 0.36 },
  phantom: { range: 240, keep: 70, speed: 140, power: 0.8, inscribe: 1.5, cap: 2, wardCost: 1 }, // wardCost: s of phantom life per hit you take
  chain: { range: 260, max: 5, dur: 5, share: 0.25, power: 0.7 },
  seal: { r: 75, dur: 5, silence: 2, power: 1.3 },
  nullRule: { r: 170, dur: 6, every: 0.5, final: 2.5, perDebuff: 0.5, finalMax: 5.5 },
  passives: [
    { id: 'endless_script', name: 'Endless Script', trigger: 'foe with several debuffs', desc: 'Your direct void damage is 12% stronger for every harmful effect on the target beyond the first (up to +36%).' },
    { id: 'ink_of_the_abyss', name: 'Ink of the Abyss', trigger: 'foe dies under a void effect', desc: 'A foe dying while rotting / Sable-Marked / sealed gives +8 Void Ink (at most 16 every 3 s — no endless loops).' },
    { id: 'phantom_ward', name: 'Phantom Ward', trigger: 'a phantom of yours exists', desc: 'While one of your void phantoms exists you take 25% less damage; each hit you take costs a phantom 1 s of its life.' },
    { id: 'abyssal', name: 'Abyssal (Ink 70+)', trigger: 'resource threshold', desc: 'At 70+ Void Ink your void damage is 15% stronger.' },
  ],
  guideIntro: [
    'You win by preparing the ground. VOID SCRIPT [1] writes a glyph that hurts (RUIN); REWRITE [4] turns your scripts into BIND (slow) or HUSH (silence).',
    'SABLE MARK [2] makes a foe rot; damage over time writes VOID INK. PHANTOM QUILL [3] summons phantoms that strike foes inside your scripts. [Q] VOID SEAL makes every DoT tick twice as fast.',
  ],
  tutorial: { marks: 'Reach 70 Void Ink (ABYSSAL)', break: 'Seal a foe with Void Seal', breakSkill: 'void_seal' },

  // HUD counter: scripts written on the ground
  hudCounter(p) {
    const n = (p.scripts || []).length;
    return { label: 'VOID SCRIPTS', value: n, max: SCRIPT_RULES.max, color: C, full: PALE, ready: p.resources.get(INK) >= 70, readyText: 'ABYSSAL — VOID SEAL' };
  },

  // ---- ink through the per-second budget
  writeInk(p, g, n, why) {
    const I = p.cls.ink;
    const want = Math.min(n, p.inkBudget ?? I.perSec);
    if (want <= 0) return 0;
    p.inkBudget = (p.inkBudget ?? I.perSec) - want;
    p.resources.gain(INK, want, { reason: why });
    return want;
  },
  // ENDLESS SCRIPT multiplier for a direct hit on t
  endlessMult(p, t) {
    const e = p.cls.endless, n = debuffCount(t);
    return 1 + Math.min(e.max, Math.max(0, n - 1) * e.per);
  },
  // direct void damage on one foe (phantom strikes, script pulses, seals)
  voidHit(p, g, t, power, extra = {}) {
    if (!t || t.dead) return null;
    return g.combat.dealDamage(p, t, { power: power * p.cls.endlessMult(p, t), type: 'void', knock: 20, stagger: 6, hitStop: 0.02, shake: 0.04, color: C, ...extra });
  },
  // VOID ROT (stacking void DoT) sized by your ATK
  rot(p, g, t, stacks = 1) {
    if (!t || t.dead || !t.status) return;
    const cls = p.cls;
    if (t.status.add('void_rot', cls.dot.dur, { source: p, stacks, damage: Math.max(2, Math.round((p.stats.atk || 20) * cls.dot.rot)) })) cls.writeInk(p, g, cls.ink.debuff, 'debuff');
  },

  // ---- SCRIPTS: glyphs on the ground (effect from data/scripts.js)
  writeScript(p, g, x, y, effect = SCRIPT_RULES.first) {
    p.scripts = p.scripts || [];
    while (p.scripts.length >= SCRIPT_RULES.max) this.eraseScript(p, g, p.scripts[0], 'replaced');
    const s = { id: (p.scriptSeq = (p.scriptSeq || 0) + 1), x, y, r: SCRIPT_RULES.radius, t: SCRIPT_RULES.duration, total: SCRIPT_RULES.duration, effect, pulse: 0.15, fx: null };
    p.scripts.push(s);
    this.drawScript(p, g, s, true);
    g.events.emit('scriptWritten', { owner: p, script: s });
    return s;
  },
  drawScript(p, g, s, fresh) {
    const def = SCRIPTS[s.effect];
    if (s.fx) s.fx.life = 0;
    if (fresh) g.vfx.sprite('vs_glyph', s.x, s.y - 24, 0, { scale: 0.8, life: 0.4, glow: 0.5 });
    s.fx = g.vfx.sprite('vs_rewrite', s.x, s.y, 0, { scale: s.r / 48, life: s.t, frame: 3, glow: 0.3, alpha: 0.55, ground: true, squash: 0.55 });
    g.vfx.ring(s.x, s.y, 6, s.r, { life: 0.35, color: def.color, width: 2 });
    g.vfx.text(s.x, s.y - 44, def.label, { color: `rgb(${def.color})`, size: 9 });
  },
  eraseScript(p, g, s, why) {
    const i = (p.scripts || []).indexOf(s);
    if (i < 0) return;
    p.scripts.splice(i, 1);
    if (s.fx) s.fx.life = 0;
    g.events.emit('scriptExpired', { owner: p, script: s, reason: why });
  },
  // one pulse of a script on everything inside (mult: phantom INSCRIBE / Null repeat)
  pulseScript(p, g, s, mult = 1) {
    const cls = p.cls, def = SCRIPTS[s.effect], pu = def.pulse;
    let n = 0;
    for (const t of foes(g)) {
      if (dist(t, s) > s.r + (t.radius || 0)) continue;
      n++;
      cls.voidHit(p, g, t, pu.power * mult, { knock: 0, stagger: 3, hitStop: 0, shake: 0, skillId: 'void_script', scriptPulse: true });
      if (pu.status && t.status && !t.dead && !(pu.bossStatus === false && isBoss(t))) {
        if (pu.status === 'void_rot') cls.rot(p, g, t, pu.stacks || 1);
        else if (t.status.add(pu.status, pu.statusTime, { source: p })) cls.writeInk(p, g, cls.ink.scriptPulse, 'script');
      }
    }
    g.vfx.ring(s.x, s.y, s.r * 0.3, s.r, { life: 0.25, color: def.color, width: n ? 1.5 : 1 }); // its rule's colour, every beat
    return n;
  },
  scriptAt(p, x, y) { return (p.scripts || []).find((s) => Math.hypot(s.x - x, s.y - y) <= s.r); },
  inNull(p, x, y) { const z = p.nullZone; return !!(z && z.t > 0 && Math.hypot(z.x - x, z.y - y) <= z.r); },

  // ---------------- basic: two ink darts, then a void bolt that rots
  basic(p, g, a, step) {
    const cls = p.cls;
    const defs = [
      { dur: 0.32, at: 0.12, anim: 'atk1', power: 0.8, speed: 460, scale: 0.45 },
      { dur: 0.32, at: 0.12, anim: 'atk2', power: 0.85, speed: 460, scale: 0.45 },
      { dur: 0.44, at: 0.18, anim: 'atk3', power: 1.15, speed: 520, scale: 0.6, rot: true },
    ];
    const d = defs[step];
    return {
      name: 'basic' + step, basic: true, step, dur: d.dur, anim: d.anim, moveMul: 0.55, ang: a, cancelAt: 0.05, comboAt: d.at + 0.06,
      events: [[d.at, () => {
        g.audio.sfx(step === 2 ? 'cast' : 'swing_fast');
        const ox = p.x + Math.cos(a) * 16, oy = p.y - 18 + Math.sin(a) * 16;
        g.combat.projectiles.fire({
          x: ox, y: oy, vx: Math.cos(a) * d.speed, vy: Math.sin(a) * d.speed, r: step === 2 ? 9 : 6, life: 0.6,
          team: TEAM.PLAYER, owner: p, kind: 'sprite', sprite: 'vs_chain', frames: [2, 3], fps: 14, scale: d.scale,
          power: d.power, type: 'void', knock: step === 2 ? 110 : 40, stagger: 6 + step * 6, hitStop: 0.03, shake: 0.05, color: C, trail: true,
          powerFor: (t) => d.power * cls.endlessMult(p, t),
          onHit: (t) => { if (d.rot) cls.rot(p, g, t); },
        });
      }]],
    };
  },

  skills: [
    {
      slot: 1, id: 'void_script', tier: 'fast', name: 'Void Script', type: 'active', cooldown: 3, cost: 0, targeting: 'point',
      tags: ['zone', 'script', 'dot', 'control', 'void'], icon: 'void_script',
      desc: 'Write a RUIN script on the ground at the cursor (up to 3, 8 s): every 0.5 s foes on it take void damage and VOID ROT. REWRITE turns scripts into BIND (slow) and HUSH (silence).',
      cast(p, g, a) {
        const cls = p.cls, pt = aimPoint(p, g, 240);
        return {
          name: 'void_script', dur: 0.38, anim: 'voidScript', moveMul: 0.3, ang: a, cancelAt: 0.2,
          events: [[0.16, () => { g.audio.sfx('thread'); cls.writeScript(p, g, pt.x, pt.y); }]],
        };
      },
    },
    {
      slot: 2, id: 'sable_mark', tier: 'fast', name: 'Sable Mark', type: 'active', cooldown: 5, cost: 0, targeting: 'direction',
      tags: ['ranged', 'mark', 'dot', 'debuff', 'void'], icon: 'sable_mark',
      desc: 'A quill of ink that SABLE-MARKS the first foe it hits for 8 s: it rots (void damage every second) and loses 15% defence. Void Chain links Sable-Marked foes.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'sable_mark', dur: 0.36, anim: 'sableMark', moveMul: 0.3, ang: a, cancelAt: 0.18,
          events: [[0.14, () => {
            g.audio.sfx('star');
            const ox = p.x + Math.cos(a) * 18, oy = p.y - 18 + Math.sin(a) * 18;
            g.combat.projectiles.fire({
              x: ox, y: oy, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, r: 9, life: 0.5,
              team: TEAM.PLAYER, owner: p, kind: 'sprite', sprite: 'vs_chain', frames: [3, 2], fps: 12, scale: 0.8,
              power: 1.0, type: 'void', knock: 50, stagger: 10, hitStop: 0.04, shake: 0.08, color: C, trail: true,
              powerFor: (t) => 1.0 * cls.endlessMult(p, t),
              onHit: (t) => {
                if (!t.status || t.dead) return;
                t.status.add('sable_mark', 8, { source: p, refresh: true, damage: Math.max(2, Math.round((p.stats.atk || 20) * cls.dot.sable)) });
                cls.writeInk(p, g, cls.ink.sable, 'sable');
                g.vfx.sprite('vs_sigil', t.x, t.y - 26, 0, { scale: 0.7, life: 0.4, glow: 0.5 });
                g.vfx.text(t.x, t.y - (t.height || 30) - 14, 'SABLE', { color: PALE, size: 9 });
              },
            });
          }]],
        };
      },
    },
    {
      slot: 3, id: 'phantom_quill', tier: 'medium', name: 'Phantom Quill', type: 'active', cooldown: 12, cost: 25, targeting: 'point',
      tags: ['summon', 'phantom', 'void', 'script'], icon: 'phantom_quill',
      desc: 'Write a VOID PHANTOM at the cursor (25 Ink, 10 s, 2 at once). It drifts to foes — those standing in your scripts first — and strikes them with void (+ Void Rot). A strike on a foe inside a script INSCRIBES it: that script pulses at once, 1.5× as hard.',
      cast(p, g, a) {
        const cls = p.cls, pt = aimPoint(p, g, 200);
        return {
          name: 'phantom_quill', dur: 0.5, anim: 'phantomQuill', moveMul: 0.2, ang: a, cancelAt: 0.3,
          events: [[0.22, () => {
            // Phantom Quill keeps 2; only the ultimate may add a 3rd
            const mine = g.summons.forOwner(p, 'void_phantom');
            if (mine.length >= cls.phantom.cap) g.summons.expire(mine[0], 'replaced');
            const s = g.summons.create(p, 'void_phantom', pt.x, pt.y);
            if (!s) return;
            g.audio.sfx('shrine');
            g.vfx.sprite('vs_phantom', pt.x, pt.y - 34, 0, { scale: 0.8, life: 0.5, glow: 0.5 });
            g.vfx.text(pt.x, pt.y - 76, 'VOID PHANTOM', { color: PALE, size: 9 });
          }]],
        };
      },
    },
    {
      slot: 4, id: 'rewrite', tier: 'fast', name: 'Rewrite', type: 'active', cooldown: 3, cost: 15, targeting: 'self',
      tags: ['script', 'control', 'utility'], icon: 'rewrite',
      requirements: [{ type: 'value', key: 'scriptCount', min: 1, label: 'a Void Script' }],
      desc: 'Rewrite every script you have (15 Ink): RUIN → BIND (slow) → HUSH (silence; bosses keep acting) → RUIN. Each one pulses its new rule at once and lasts 2 s longer.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'rewrite', dur: 0.36, anim: 'rewrite', moveMul: 0.3, ang: a, cancelAt: 0.2,
          events: [[0.14, () => {
            g.audio.sfx('thread_burst');
            for (const s of p.scripts || []) {
              const from = s.effect;
              s.effect = SCRIPTS[from].next || from;
              s.t = Math.min(s.total + 2, s.t + 2);
              cls.drawScript(p, g, s, false);
              cls.pulseScript(p, g, s);
              g.events.emit('scriptRewritten', { owner: p, script: s, from, to: s.effect });
            }
          }]],
        };
      },
    },
    {
      id: 'void_chain', tier: 'medium', name: 'Void Chain', type: 'active', cooldown: 10, cost: 0, targeting: 'self',
      tags: ['link', 'void', 'debuff', 'aoe'], icon: 'void_chain',
      desc: 'Chain every Sable-Marked foe within 260 px (up to 5) for 5 s: a void jolt hits each of them, then 25% of the damage any chained foe takes is dealt to the others (shared damage never shares again).',
      cast(p, g, a) {
        const cls = p.cls, ch = cls.chain;
        return {
          name: 'void_chain', dur: 0.46, anim: 'voidChain', moveMul: 0.2, ang: a, cancelAt: 0.3,
          events: [[0.2, () => {
            const list = foes(g).filter((t) => t.status && t.status.has('sable_mark') && dist(t, p) <= ch.range).sort((m, n) => dist(m, p) - dist(n, p)).slice(0, ch.max);
            if (!list.length) { g.vfx.text(p.x, p.y - 70, 'NO SABLE MARK', { color: '#9a8ab0', size: 9 }); return; }
            g.audio.sfx('thread');
            p.voidLinks = { targets: list, t: ch.dur, drawT: 0 };
            for (const t of list) {
              g.vfx.sprite('vs_chain', (p.x + t.x) / 2, (p.y + t.y) / 2 - 18, Math.atan2(t.y - p.y, t.x - p.x), { scale: Math.min(2, Math.max(0.6, dist(p, t) / 90)), life: 0.3, glow: 0.5 });
              cls.voidHit(p, g, t, ch.power, { knock: 40, stagger: 12 });
            }
            g.vfx.text(p.x, p.y - 76, `VOID CHAIN ×${list.length}`, { color: PALE, size: 10 });
            g.events.emit('voidChained', { owner: p, targets: list });
          }]],
        };
      },
    },
    {
      slot: 5, id: 'final_script_null', tier: 'high', name: 'Final Script: Null', type: 'ultimate', cooldown: 45, cost: 60, targeting: 'point',
      tags: ['ultimate', 'zone', 'void', 'dot', 'summon', 'script'], icon: 'final_script_null', ultimate: true,
      desc: 'ULTIMATE (60 Ink). Write NULL over the target area for 6 s: foes inside are slowed and NULLED (DoTs ×1.5, +15% damage taken), your scripts inside pulse twice as often, your phantoms strike twice, and a third phantom is written. When it ends: NULL EXPLOSION, stronger for every harmful effect on each foe.',
      cast(p, g, a) {
        const cls = p.cls, N = cls.nullRule, pt = aimPoint(p, g, 260);
        return {
          name: 'final_script_null', dur: 0.8, anim: 'finalScript', moveMul: 0, ang: a, cancelAt: 99, invuln: [0, 0.8], superArmor: true,
          start: () => {
            g.slowMo(0.5, 0.3);
            g.audio.sfx('ult_charge');
            g.vfx.flash('40,10,70', 0.35, 2);
            g.vfx.ring(pt.x, pt.y, 20, N.r, { life: 0.7, color: CR, width: 2 });
          },
          events: [[0.4, () => {
            p.nullZone = { x: pt.x, y: pt.y, r: N.r, t: N.dur, pulse: 0 };
            g.vfx.sprite('vs_null', pt.x, pt.y - 30, 0, { scale: 2.4, life: 0.6, glow: 0.6 });
            p.nullZone.fx = g.vfx.sprite('vs_orb', pt.x, pt.y, 0, { scale: N.r / 70, life: N.dur, frame: 3, glow: 0.3, alpha: 0.5, ground: true, squash: 0.55 });
            g.vfx.text(pt.x, pt.y - 110, 'FINAL SCRIPT: NULL', { color: PALE, size: 14, life: 1.2 });
            const s = g.summons.create(p, 'void_phantom', pt.x + rand(-30, 30), pt.y + rand(-20, 20)); // PHANTOM INCREASE
            if (s) g.vfx.sprite('vs_phantom', s.x, s.y - 34, 0, { scale: 0.8, life: 0.5, glow: 0.5 });
            g.events.emit('zoneCreated', { owner: p, kind: 'null', x: pt.x, y: pt.y, radius: N.r, duration: N.dur });
          }]],
        };
      },
    },
  ],

  // ---------------- VOID SEAL (Q / right click): seal an area — DoTs tick twice as fast, silence (not bosses)
  special: {
    id: 'void_seal', tier: 'medium', name: 'Void Seal', type: 'special', slot: 'Q', key: 'Q', icon: 'void_seal',
    cost: 30, cooldown: 10, targeting: 'point', tags: ['debuff', 'control', 'void', 'dot'],
    desc: 'Seal the area at the cursor (30 Ink): foes there take void damage, are SEALED for 5 s (every damage-over-time on them ticks twice as fast, they take 10% more damage and deal 25% less) and SILENCED for 2 s (bosses are not silenced).',
    cast(p, g, a) {
      const cls = p.cls, S = cls.seal, pt = aimPoint(p, g, 260);
      return {
        name: 'void_seal', dur: 0.45, anim: 'voidSeal', moveMul: 0.2, ang: a, cancelAt: 0.3,
        events: [[0.2, () => {
          g.audio.sfx('constellation');
          g.vfx.sprite('vs_orb', pt.x, pt.y - 20, 0, { scale: 1.1, life: 0.45, glow: 0.6 });
          g.vfx.ring(pt.x, pt.y, 10, S.r, { life: 0.35, color: PINK, width: 3 });
          let n = 0;
          for (const t of foes(g)) {
            if (dist(t, pt) > S.r + (t.radius || 0)) continue;
            n++;
            t.status.add('void_seal', S.dur, { source: p, refresh: true });
            if (!isBoss(t)) t.status.add('silence', S.silence, { source: p });
            cls.voidHit(p, g, t, S.power, { knock: 60, stagger: 16, skillId: 'void_seal' });
          }
          g.vfx.text(pt.x, pt.y - 70, n ? `VOID SEAL ×${n}` : 'VOID SEAL', { color: PALE, size: 11 });
          g.events.emit('voidSeal', { owner: p, count: n });
        }]],
      };
    },
  },

  // ---------------- every frame: scripts, phantoms, void links, the Null zone, ink budget
  tick(p, g, dt) {
    const cls = p.cls;
    p.inkBudget = Math.min(cls.ink.perSec, (p.inkBudget ?? cls.ink.perSec) + cls.ink.perSec * dt);
    p.inkDeathT = Math.max(0, (p.inkDeathT || 0) - dt);
    if (p.inkDeathT <= 0) p.inkDeaths = 0;
    if (p.dead || p.downed) return;
    // scripts (pulse twice as often inside Null = SCRIPT REPEAT)
    if (p.scripts && p.scripts.length) {
      for (const s of [...p.scripts]) {
        s.t -= dt;
        if (s.t <= 0) { cls.eraseScript(p, g, s, 'timeout'); continue; }
        s.pulse -= dt * (cls.inNull(p, s.x, s.y) ? 2 : 1);
        if (s.pulse <= 0) { s.pulse += SCRIPT_RULES.every; cls.pulseScript(p, g, s); }
      }
    }
    // PHANTOM WARD while a phantom exists
    const phantoms = g.summons.forOwner(p, 'void_phantom');
    if (phantoms.length) p.status.add('phantom_ward', 0.3, { source: p, refresh: true });
    // phantoms drift to their prey (foes in scripts first) and keep a little distance
    for (const s of phantoms) {
      const t = cls.phantomTarget(p, g, s);
      s.prey = t;
      if (!t || s.busy > 0) continue;
      const d = dist(s, t), a = Math.atan2(t.y - s.y, t.x - s.x);
      s.facing = a;
      if (d > cls.phantom.keep) { const k = Math.min(d - cls.phantom.keep, cls.phantom.speed * dt); s.x += Math.cos(a) * k; s.y += Math.sin(a) * k; }
    }
    // void links
    const L = p.voidLinks;
    if (L) {
      L.t -= dt; L.drawT -= dt;
      L.targets = L.targets.filter((t) => !t.dead);
      if (L.t <= 0 || L.targets.length < 2) p.voidLinks = null;
      else if (L.drawT <= 0) {
        L.drawT = 0.12;
        for (let i = 1; i < L.targets.length; i++) { const a = L.targets[i - 1], b = L.targets[i]; g.vfx.bolt(a.x, a.y - 16, b.x, b.y - 16, { color: CR, width: 1.2, life: 0.14, jag: 5 }); }
      }
    }
    // FINAL SCRIPT: NULL
    const z = p.nullZone;
    if (z) {
      z.t -= dt; z.pulse -= dt;
      const N = cls.nullRule;
      if (z.t > 0 && z.pulse <= 0) {
        z.pulse += N.every;
        for (const t of foes(g)) if (dist(t, z) <= z.r + (t.radius || 0)) { t.status.add('nulled', N.every + 0.2, { source: p, refresh: true }); t.status.add('slow', N.every + 0.2, { source: p }); }
      }
      if (z.t <= 0) { p.nullZone = null; if (z.fx) z.fx.life = 0; cls.nullExplosion(p, g, z); }
    }
  },
  nullExplosion(p, g, z) {
    const cls = p.cls, N = cls.nullRule;
    g.camera.punch(0.25); g.camera.shake(0.5);
    g.vfx.flash('120,40,200', 0.4, 2.5);
    g.vfx.sprite('vs_null', z.x, z.y - 30, 0, { scale: 3, life: 0.5, glow: 0.7 });
    g.vfx.ring(z.x, z.y, 20, z.r, { life: 0.45, width: 5, color: CR, fill: true });
    g.vfx.text(z.x, z.y - 110, 'NULL', { color: '#ffffff', size: 16, life: 1.2 });
    g.audio.sfx('ult_slash');
    g.combat.spawnHitbox({ owner: p, x: z.x, y: z.y, shape: 'circle', r: z.r, power: N.final, type: 'void', knock: 220, stagger: 60, hitStop: 0.12, shake: 0.5, big: true, skillId: 'final_script_null', noSkillMods: true,
      powerFor: (t) => Math.min(N.finalMax, N.final + N.perDebuff * debuffCount(t)) });
  },
  // prey for a phantom: foes standing in a script first, then the nearest in range
  phantomTarget(p, g, s) {
    const cls = p.cls;
    let best = null, bs = Infinity;
    for (const t of foes(g)) {
      const d = dist(t, s);
      if (d > cls.phantom.range) continue;
      const sc = d - (cls.scriptAt(p, t.x, t.y) ? 150 : 0);
      if (sc < bs) { bs = sc; best = t; }
    }
    return best;
  },
  phantomStrike(p, g, s, t) {
    const cls = p.cls, P = cls.phantom;
    if (!t || t.dead) return;
    g.summons.act(s, 'strike', 0.3);
    g.vfx.sprite('vs_chain', (s.x + t.x) / 2, (s.y + t.y) / 2 - 22, Math.atan2(t.y - s.y, t.x - s.x), { scale: Math.min(1.8, Math.max(0.5, dist(s, t) / 90)), life: 0.22, glow: 0.5 });
    cls.voidHit(p, g, t, P.power * s.powerMult, { knock: 30, stagger: 8, skillId: 'phantom_quill' });
    cls.rot(p, g, t);
    const sc = cls.scriptAt(p, t.x, t.y);
    if (sc) { // INSCRIBE: the script under the foe pulses at once
      cls.pulseScript(p, g, sc, P.inscribe);
      g.vfx.text(t.x, t.y - (t.height || 30) - 20, 'INSCRIBED', { color: PALE, size: 8 });
      g.events.emit('scriptInscribed', { owner: p, script: sc, target: t });
    }
  },

  // ---------------- passives: react to core events
  on: {
    summonReady(p, g, e) {
      const s = e.summon;
      if (e.owner !== p || s.type !== 'void_phantom' || !s.prey) return;
      p.cls.phantomStrike(p, g, s, s.prey);
      if (p.cls.inNull(p, s.x, s.y)) g.after(0.35, () => { if (g.summons.list.includes(s) && s.prey) p.cls.phantomStrike(p, g, s, s.prey); }); // Null: strikes twice
    },
    // damage-over-time ticks write ink; chained foes share void damage
    damageDealt(p, g, e) {
      if (e.source !== p || !(e.amount > 0)) return;
      const o = e.opts || {};
      if (o.dot && o.statusId) p.cls.writeInk(p, g, p.cls.ink.dotTick, 'dot');
      const L = p.voidLinks;
      if (!L || o.voidShare || !L.targets.includes(e.target)) return;
      const share = e.amount * p.cls.chain.share;
      for (const t of L.targets) {
        if (t === e.target || t.dead) continue;
        g.combat.dealDamage(p, t, { power: share, flat: true, dot: true, type: 'void', voidShare: true, color: C });
      }
      p.cls.writeInk(p, g, p.cls.ink.share, 'share');
    },
    // PHANTOM WARD: a hit you take wears the oldest phantom down
    damageTaken(p, g, e) {
      if (e.target !== p || !(e.amount > 0) || (e.opts && e.opts.dot) || !p.status.has('phantom_ward')) return;
      const s = g.summons.forOwner(p, 'void_phantom')[0];
      if (s) s.duration = Math.max(s.t + 0.05, s.duration - p.cls.phantom.wardCost);
    },
    // INK OF THE ABYSS: a foe dies under a void effect (capped per window)
    enemyKilled(p, g, e) {
      const t = e.target, I = p.cls.ink;
      if (!t || !t.status || !['void_rot', 'sable_mark', 'void_seal', 'nulled'].some((id) => t.status.has(id))) return;
      const got = p.inkDeaths || 0;
      if (got >= I.deathCap) return;
      const n = Math.min(I.death, I.deathCap - got);
      p.inkDeaths = got + n; p.inkDeathT = I.deathWindow;
      p.resources.gain(INK, n, { reason: 'abyss' });
      g.vfx.text(t.x, t.y - (t.height || 30) - 24, `+${n} INK`, { color: PALE, size: 9 });
      g.events.emit('passiveTriggered', { player: p, id: 'ink_of_the_abyss' });
    },
    resourceTier(p, g, e) {
      if (e.entity !== p || e.resource !== INK || e.tier <= e.before || !e.def) return;
      g.vfx.text(p.x, p.y - 82, e.def.label, { color: '#ffffff', size: 13, life: 1.1 });
      g.vfx.sprite('vs_sigil', p.x, p.y - 30, 0, { scale: 0.9, life: 0.45, glow: 0.6 });
      g.audio.sfx('mark_full');
      g.world.setFlag('tut_marks'); // tutorial step "Reach 70 Void Ink"
    },
  },
  counterBonus: { resource: 6 }, // data/counter.js
  perfectDodge: { resource: 12, stamina: 10, cooldownCut: 0.8, statuses: [{ id: 'haste', dur: 1.5, mult: 1.3 }] }, // data/dodge.js
};
