import { TAU, rand } from '../core/math.js';

// DUSKRUNNER — Class 2 of the Umbral Sword. Mobility DPS · Single-Target Assassin · Combo.
// Class = data + behaviour that only CALLS core systems:
//   ResourcePool ('momentum' + its tiers = passive ENDLESS MOTION) · SkillSystem recast (Flash Step, Mirage Shift)
//   SummonSystem ('mirage') · StatusSystem (silent_run, overdrive, counter_ready) · Combat (hitboxes)
//   Player hooks: tick (momentum drains while standing still), perfectDodge data (passive GHOST STEP)
// Gameplay loop: dash in (Blue Fang / Flash Step) → cut → dodge the answer → keep moving → MOMENTUM climbs →
//   every skill reads it (Dusk Barrage 3 → 9 hits, Blue Fang harder, enhanced at MAX) → Endless Run locks it at 100.
// Standing still or eating a heavy hit throws momentum away: the class is strong only while it keeps moving.
// Nothing in the core knows this file exists; passives react to bus events through `on`.

const C = '#5ab8ff', CR = '90,184,255', PALE = '#d8f0ff';
const M = 'momentum';

// animation table for the 'dr' preset (tools/build-player.js dr → assets/player/dr)
export const DR_ANIMS = {
  idle: { sheet: 'idle', cols: [0, 1, 2, 3, 4, 5], fps: 4, loop: true },
  walk: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 10, loop: true },
  run: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 14, loop: true },
  atk1: { sheet: 'atk1', cols: [1, 2, 3, 4] },
  atk2: { sheet: 'atk2', cols: [1, 2, 3, 4] },
  atk3: { sheet: 'sk6', cols: [1, 2, 3, 4] },          // starburst finisher (also the Ghost Step counter)
  dodge: { sheet: 'dash', cols: [1, 2, 3, 4] },
  blueFang: { sheet: 'sk1', cols: [1, 2, 3, 4] },
  flashStep: { sheet: 'sk2', cols: [2, 3, 4] },
  barrage: { sheet: 'sk3', cols: [1, 2, 3, 4, 2, 3, 4, 3] },
  mirage: { sheet: 'sk4', cols: [1, 2, 3, 4] },
  silentRun: { sheet: 'sk5', cols: [1, 2, 3, 3, 4] },
  endlessRun: { sheet: 'ult', cols: [1, 2, 3, 3, 4] },
  hurt: { sheet: 'hit', cols: [1, 2] },
  death: { sheet: 'hit', cols: [1, 2, 3, 4] },
};

// ---- helpers (class-local)
const momentum = (p) => (p.status && p.status.has('overdrive') ? 100 : p.resources.get(M)); // ENDLESS RUN = always max
const ratio = (p) => momentum(p) / 100;
// data table [[atMomentum, value], ...] -> value of the highest row reached
export function stageValue(table, m) {
  let v = table[0][1];
  for (const [at, x] of table) if (m >= at) v = x;
  return v;
}
// momentum per hit, capped per cast (one skill hitting a pack must not fill the bar by itself)
function feeder(p, per, cap) {
  let got = 0;
  return () => { if (got < cap) { got += per; p.gainResource(per); } };
}
// dash direction: movement keys if held, else the mouse
function dashAngle(p, g, a) {
  const mv = g.input && g.input.moveVector ? g.input.moveVector() : { x: 0, y: 0 };
  return mv.x || mv.y ? Math.atan2(mv.y, mv.x) : a;
}

export const Duskrunner = {
  id: 'duskrunner',
  stableId: 'class_duskrunner',
  name: 'Duskrunner',
  role: 'Mobility DPS · Single-Target Assassin · Combo',
  difficulty: 5,
  ratings: { damage: 4, range: 1, defense: 1, mobility: 5, support: 1 },
  description: 'The Umbral Sword who chose speed: twin blades, endless dashes, and a momentum that turns every skill into a storm.',
  identity: 'Dash. Cut. Dodge. Never stop.',
  strengths: ['Highest mobility: Flash Step, Blue Fang and Mirage Shift all move you', 'Momentum scales every skill (Dusk Barrage 3 → 9 hits)', 'Great single-target pressure on bosses that you can dance around'],
  weaknesses: ['Lowest defence of the Umbral line', 'Standing still or taking a heavy hit throws momentum away', 'Little area damage: packs take longer than for the Reaper'],
  signatureWeapon: 'Twin Dusk Blades',
  preset: 'dr',
  anims: DR_ANIMS,
  theme: { color: C, ghost: '#2a7aff', trail: 'shadow' },
  resource: M, // builder: dodges, dashes, hits, combos, perfect dodges (tiers in data/resources.js = ENDLESS MOTION)
  resources: [M],
  mark: null,
  base: { hp: 230, atk: 20, def: 4, crit: 0.13, critDmg: 0, physicalDmg: 0, cdr: 0, speed: 158, momentumGain: 1, armorBreak: 1, attackSpeed: 0, dodgeCostCut: 0 },
  perLevel: { hp: 11, atk: 1.55, def: 0.4 },
  defaultLoadout: ['blue_fang', 'dusk_barrage', 'mirage_shift', 'silent_run'],
  // MOMENTUM rules (data, not code)
  charge: { dodge: 8, dash: 6, basicHit: 3, combo: 6, skillHit: 3, skillCap: 12, ambush: 15, mirageReturn: 10, silentRun: 10 },
  momentum: {
    idleGrace: 0.5, idleDrain: 22,       // standing still in a fight: after 0.5 s, -22 / s
    movingGain: 3,                       // moving in a fight: +3 / s (x2 while in Silent Run)
    heavyHitLoss: 25, heavyShare: 0.12,  // a heavy / guard-break hit, or one taking 12%+ max HP, costs 25
    overdriveCooldown: 0.6,              // ENDLESS RUN: cooldowns tick 60% faster
  },
  // MOMENTUM COMBO: what each skill becomes as momentum rises
  barrage: { hits: [[0, 3], [50, 5], [80, 7], [100, 9]], power: 0.5, finisher: 1.5 },
  fang: { power: 1.8, perMomentum: 0.6, enhancedAt: 100, echoPower: 0.9 },
  // GHOST STEP: the next dodge within this window after a Perfect Dodge costs no stamina
  ghostStep: { window: 1.5 },
  passives: [
    { id: 'endless_motion', name: 'Endless Motion', desc: 'Momentum tiers: FLOW (30) +10% attack speed · RUSH (60) +20% attack speed, cheaper dodges, -10% cooldowns, +10% damage · MAX (100) +30% attack speed, dodges 40% cheaper, -20% cooldowns, +20% damage, +10% crit.' },
    { id: 'ghost_step', name: 'Ghost Step', desc: 'A Perfect Dodge gives +20 Momentum, readies a guaranteed-crit counter slash and makes your next dodge (within 1.5 s) free.' },
  ],
  guideIntro: [
    'You are strongest while moving. Dodges, dashes and hits build MOMENTUM; standing still in a fight drains it, and a heavy hit knocks it down.',
    'Momentum powers every skill: DUSK BARRAGE [2] strikes 3 → 9 times, BLUE FANG [1] hits harder. [Q] FLASH STEP dashes — press it again for a second dash.',
  ],
  tutorial: { marks: 'Reach 60 Momentum (RUSH)', break: 'Use Flash Step', breakSkill: 'flash_step' },

  // HUD counter: momentum tier as 3 diamonds (FLOW / RUSH / MAX)
  hudCounter(p) {
    const k = p.status.has('overdrive') ? 2 : p.resources.tier(M);
    return { label: 'MOMENTUM', value: k + 1, max: 3, color: C, full: PALE, ready: k >= 2, readyText: p.status.has('overdrive') ? 'ENDLESS RUN' : 'MAX MOMENTUM — ENHANCED SKILLS' };
  },

  // dash-strike along a path (Blue Fang / Flash Step / Mirage return): a line hitbox from `from` to where the player is now
  pathStrike(p, g, from, a, power, extra = {}) {
    const len = Math.hypot(p.x - from.x, p.y - from.y);
    return g.combat.spawnHitbox({ owner: p, x: from.x, y: from.y - 8, ang: a, shape: 'line', len: len + 20, width: 30, power, type: 'physical', knock: 60, stagger: 12, hitStop: 0.04, shake: 0.08, ...extra });
  },

  // FLASH STEP dash (first and second)
  flashDash(p, g, a, second) {
    const cls = p.cls, ang = dashAngle(p, g, a), from = { x: p.x, y: p.y };
    p.beginDodge(ang, true);
    g.audio.sfx('dash');
    p.gainResource(cls.charge.dash);
    return {
      name: 'flash_step', dur: 0.2, anim: 'flashStep', moveMul: 0, ang, cancelAt: 0.1, invuln: [0, 0.2], dash: { ang, dist: second ? 125 : 110 },
      ghostEvery: 0.025,
      events: [[0.16, () => {
        g.vfx.sprite('dr_streak', (from.x + p.x) / 2, (from.y + p.y) / 2 - 14, ang, { scale: Math.min(1.4, Math.max(0.6, Math.hypot(p.x - from.x, p.y - from.y) / 110)), life: 0.22, glow: 0.4 });
        if (second) g.vfx.text(p.x, p.y - 70, 'FLASH', { color: PALE, size: 9 });
        cls.pathStrike(p, g, from, ang, second ? 0.8 : 0.6, { onHit: () => p.gainResource(cls.charge.basicHit) });
      }]],
    };
  },

  // ---------------- basic: two quick twin-blade cuts, then a dashing starburst slash (COMBO)
  basic(p, g, a, step) {
    const cls = p.cls, counter = p.status.has('counter_ready'); // GHOST STEP counter (after a Perfect Dodge)
    const defs = [
      { dur: 0.26, at: 0.07, anim: 'atk1', r: 50, half: 1.0, power: 0.95, lunge: 14 },
      { dur: 0.26, at: 0.07, anim: 'atk2', r: 50, half: 1.0, power: 1.0, lunge: 14 },
      { dur: 0.36, at: 0.12, anim: 'atk3', r: 60, half: 1.3, power: 1.5, lunge: 38, combo: true, knock: 180 },
    ];
    const d = defs[step];
    return {
      name: 'basic' + step, basic: true, step, dur: d.dur, anim: counter ? 'atk3' : d.anim, moveMul: 0.55, ang: a, cancelAt: 0.05, comboAt: d.at + 0.06,
      lunge: { dist: counter ? 50 : d.lunge, t0: 0, t1: 0.1 },
      events: [[d.at, () => {
        let fed = false;
        g.audio.sfx(d.combo || counter ? 'slash_heavy' : 'swing');
        const fx = d.combo || counter ? 'dr_star' : 'dr_crescent';
        g.vfx.sprite(fx, p.x + Math.cos(a) * 28, p.y - 14 + Math.sin(a) * 28, a, { scale: d.combo || counter ? 0.9 : 0.55, life: 0.2, flipY: step === 1, glow: 0.3 });
        if (counter) {
          p.status.remove('counter_ready');
          g.vfx.text(p.x, p.y - 64, 'GHOST COUNTER', { color: PALE, size: 11 });
          g.vfx.flash(CR, 0.18, 6);
        }
        g.combat.spawnHitbox({
          owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: d.r + (counter ? 12 : 0), half: d.half, power: d.power * (counter ? 2.2 : 1), forceCrit: counter,
          type: 'physical', knock: d.knock ?? 70, stagger: counter ? 40 : 8 + step * 6, hitStop: d.combo || counter ? 0.07 : 0.035, shake: d.combo ? 0.16 : 0.08,
          onHit: () => {
            p.gainResource(cls.charge.basicHit);
            if ((d.combo || counter) && !fed) { fed = true; p.gainResource(counter ? cls.charge.ambush : cls.charge.combo); }
          },
        });
      }]],
    };
  },

  skills: [
    {
      slot: 1, id: 'blue_fang', tier: 'fast', name: 'Blue Fang', type: 'active', cooldown: 4, cost: 0, targeting: 'direction',
      tags: ['dash', 'mobility', 'momentum', 'invulnerable'], icon: 'blue_fang',
      desc: 'Dash THROUGH enemies with both blades (invulnerable). +60% damage at full Momentum; at MAX an afterimage cuts the same line again.',
      cast(p, g, a) {
        const cls = p.cls, f = cls.fang, from = { x: p.x, y: p.y }, m = momentum(p), feed = feeder(p, cls.charge.skillHit, cls.charge.skillCap);
        const power = f.power * (1 + f.perMomentum * (m / 100)), enhanced = m >= f.enhancedAt;
        p.beginDodge(a, true);
        g.audio.sfx('dash');
        p.gainResource(cls.charge.dash);
        return {
          name: 'blue_fang', dur: 0.32, anim: 'blueFang', moveMul: 0, ang: a, cancelAt: 0.3, invuln: [0, 0.28], dash: { ang: a, dist: 140 },
          ghostEvery: 0.03,
          events: [[0.22, () => {
            const len = Math.hypot(p.x - from.x, p.y - from.y), mid = { x: (from.x + p.x) / 2, y: (from.y + p.y) / 2 };
            g.audio.sfx('slash_heavy');
            g.vfx.sprite('dr_blade', mid.x, mid.y - 14, a, { scale: Math.min(1.5, Math.max(0.7, len / 110)), life: 0.26, glow: 0.5 });
            g.vfx.sprite('dr_crescent', p.x + Math.cos(a) * 18, p.y - 14 + Math.sin(a) * 18, a, { scale: 0.9, life: 0.24 });
            cls.pathStrike(p, g, from, a, power, { knock: 90, stagger: 22, hitStop: 0.06, shake: 0.15, onHit: feed });
            if (!enhanced) return;
            const end = { x: p.x, y: p.y };
            g.after(0.25, () => { // MAX MOMENTUM: the afterimage runs the same line again
              if (p.disposed || p.dead) return;
              g.vfx.sprite('dr_moon', (from.x + end.x) / 2, (from.y + end.y) / 2 - 14, a, { scale: Math.min(1.5, Math.max(0.8, len / 100)), life: 0.3, glow: 0.6 });
              g.vfx.text(end.x, end.y - 70, 'AFTERIMAGE', { color: PALE, size: 9 });
              g.combat.spawnHitbox({ owner: p, x: from.x, y: from.y - 8, ang: a, shape: 'line', len: len + 20, width: 34, power: f.echoPower * power, type: 'physical', knock: 60, stagger: 16, hitStop: 0.05, shake: 0.12 });
            });
          }]],
        };
      },
    },
    {
      slot: 2, id: 'dusk_barrage', tier: 'medium', name: 'Dusk Barrage', type: 'active', cooldown: 7, cost: 0, targeting: 'direction',
      tags: ['multi-hit', 'combo', 'momentum', 'melee'], icon: 'dusk_barrage',
      desc: 'A storm of twin-blade cuts in front of you. The number of hits follows your Momentum: 3 (below 50) · 5 (50) · 7 (80) · 9 (100). The last cut hits hardest.',
      cast(p, g, a) {
        const cls = p.cls, b = cls.barrage, n = stageValue(b.hits, momentum(p)), feed = feeder(p, 1, cls.charge.skillCap);
        const t0 = 0.08, t1 = 0.5, events = [];
        for (let i = 0; i < n; i++) {
          const last = i === n - 1, t = t0 + ((t1 - t0) * i) / Math.max(1, n - 1);
          events.push([t, () => {
            const q = a + rand(-0.5, 0.5);
            g.audio.sfx(last ? 'slash_heavy' : 'swing');
            g.vfx.sprite(last ? 'dr_cross' : 'dr_crescent', p.x + Math.cos(q) * 30, p.y - 14 + Math.sin(q) * 30, q, { scale: last ? 1.0 : 0.55, life: 0.16, flipY: i % 2 === 1, glow: 0.3 });
            g.combat.spawnHitbox({
              owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: last ? 68 : 60, half: 0.95, power: last ? b.finisher : b.power, type: 'physical',
              knock: last ? 160 : 15, stagger: last ? 30 : 6, hitStop: last ? 0.08 : 0.02, shake: last ? 0.18 : 0.04, onHit: feed,
            });
          }]);
        }
        events.push([0.02, () => g.vfx.text(p.x, p.y - 72, `DUSK BARRAGE ×${n}`, { color: n >= 9 ? '#ffffff' : PALE, size: n >= 9 ? 12 : 10 })]);
        return { name: 'dusk_barrage', dur: 0.62, anim: 'barrage', moveMul: 0.25, ang: a, cancelAt: 0.3, lunge: { dist: 16, t0: 0, t1: 0.1 }, events };
      },
    },
    {
      slot: 3, id: 'mirage_shift', tier: 'fast', name: 'Mirage Shift', type: 'active', cooldown: 9, cost: 0, targeting: 'direction',
      tags: ['mobility', 'dash', 'recast', 'afterimage'], icon: 'mirage_shift',
      desc: 'Leave a Mirage where you stand and dash forward. Press again within 3 s to snap back to the Mirage, cutting everything between you.',
      recast: {
        window: 3,
        // RETURN: back to the Mirage (validated: it still exists, its spot is open, it is on this map and in reach)
        cast(p, g, a) {
          const cls = p.cls, s = g.summons.forOwner(p, 'mirage')[0];
          const valid = s && !g.world.map.circleBlocked(s.x, s.y, p.radius) && Math.hypot(s.x - p.x, s.y - p.y) < 420;
          if (!valid) {
            if (s) g.summons.expire(s, 'invalid');
            g.vfx.text(p.x, p.y - 70, 'MIRAGE LOST', { color: '#8aa0c0', size: 9 });
            g.audio.sfx('deny');
            return { name: 'mirage_shift', dur: 0.12, anim: 'mirage', moveMul: 1, ang: a, cancelAt: 0 };
          }
          const from = { x: p.x, y: p.y }, back = Math.atan2(s.y - p.y, s.x - p.x);
          return {
            name: 'mirage_shift', dur: 0.3, anim: 'mirage', moveMul: 0, ang: back, cancelAt: 0.25, invuln: [0, 0.3],
            start: () => {
              g.vfx.sprite('dr_orb', p.x, p.y - 20, 0, { scale: 0.9, life: 0.3, glow: 0.5 });
              g.audio.sfx('blink');
              p.x = s.x; p.y = s.y; p.vx = p.vy = 0;
              p.dodging = false;
              g.summons.expire(s, 'returned');
              g.vfx.sprite('dr_streak', (from.x + p.x) / 2, (from.y + p.y) / 2 - 14, back, { scale: Math.min(1.6, Math.max(0.7, Math.hypot(p.x - from.x, p.y - from.y) / 110)), life: 0.3, glow: 0.5 });
              g.vfx.ring(p.x, p.y, 6, 50, { life: 0.3, color: CR, width: 2 });
              p.gainResource(cls.charge.mirageReturn);
            },
            events: [[0.06, () => {
              g.audio.sfx('slash_heavy');
              g.combat.spawnHitbox({ owner: p, x: from.x, y: from.y - 8, ang: back, shape: 'line', len: Math.hypot(p.x - from.x, p.y - from.y) + 20, width: 34, power: 1.6, type: 'physical', knock: 80, stagger: 24, hitStop: 0.06, shake: 0.14,
                onHit: () => p.gainResource(cls.charge.basicHit) });
            }]],
          };
        },
      },
      cast(p, g, a) {
        const cls = p.cls;
        const s = g.summons.create(p, 'mirage', p.x, p.y);
        if (s) { s.facing = a; g.vfx.sprite('dr_orb', s.x, s.y - 20, 0, { scale: 0.8, life: 0.3, glow: 0.5 }); }
        p.beginDodge(a, true);
        g.audio.sfx('dash');
        p.gainResource(cls.charge.dash);
        return { name: 'mirage_shift', dur: 0.26, anim: 'mirage', moveMul: 0, ang: a, cancelAt: 0.2, invuln: [0, 0.22], dash: { ang: a, dist: 110 }, ghostEvery: 0.03 };
      },
    },
    {
      slot: 4, id: 'silent_run', tier: 'fast', name: 'Silent Run', type: 'active', cooldown: 14, cost: 0, targeting: 'self',
      tags: ['stealth', 'buff', 'momentum', 'speed'], icon: 'silent_run',
      desc: 'Vanish for 3 s: +35% movement speed, monsters lose track of you and moving builds Momentum twice as fast. Your first hit out of it deals +50% damage (AMBUSH) and gives +15 Momentum.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'silent_run', dur: 0.3, anim: 'silentRun', moveMul: 0.6, ang: a, cancelAt: 0.15,
          events: [[0.12, () => {
            p.status.add('silent_run', 3, { source: p, refresh: true });
            p.gainResource(cls.charge.silentRun);
            g.audio.sfx('blink');
            g.vfx.sprite('dr_orb', p.x, p.y - 22, 0, { scale: 1.1, life: 0.35, glow: 0.5 });
            g.vfx.shadowSmoke(p.x, p.y, 10, { vy: -40 });
            g.vfx.text(p.x, p.y - 70, 'SILENT RUN', { color: PALE, size: 10 });
          }]],
        };
      },
    },
    {
      slot: 5, id: 'endless_run', tier: 'high', name: 'Endless Run', type: 'ultimate', cooldown: 30, cost: 30, targeting: 'self',
      tags: ['ultimate', 'buff', 'momentum', 'aoe'], icon: 'endless_run', ultimate: true,
      requirements: [{ type: 'resource', resource: M, min: 60, label: '60 Momentum (RUSH)' }],
      desc: 'ULTIMATE (needs 60 Momentum, spends 30). A blue crescent storm around you, then OVERDRIVE for 8 s: Momentum locked at MAX (every skill enhanced), +30% attack speed, faster feet, half-price dodges, cooldowns tick 60% faster.',
      cast(p, g, a) {
        return {
          name: 'endless_run', dur: 0.7, anim: 'endlessRun', moveMul: 0, ang: a, cancelAt: 99, invuln: [0, 0.7], superArmor: true,
          start: () => {
            g.slowMo(0.5, 0.3);
            g.audio.sfx('ult_charge');
            g.vfx.flash(CR, 0.3, 2);
          },
          events: [[0.35, () => {
            p.status.add('overdrive', 8, { source: p, refresh: true });
            p.resources.set(M, 100, 'skill:endless_run');
            g.camera.punch(0.2); g.camera.shake(0.5);
            g.hitStop = Math.max(g.hitStop, 0.1);
            g.audio.sfx('ult_slash');
            for (let i = 0; i < 6; i++) {
              const q = (i * TAU) / 6;
              g.after(i * 0.03, () => g.vfx.sprite('dr_moon', p.x + Math.cos(q) * 50, p.y - 14 + Math.sin(q) * 50, q, { scale: 1.1, life: 0.3, glow: 0.6 }));
            }
            g.vfx.ring(p.x, p.y, 12, 120, { life: 0.4, width: 5, color: CR, fill: true });
            g.vfx.burst(p.x, p.y - 20, C, 40, 260);
            g.vfx.text(p.x, p.y - 96, 'ENDLESS RUN', { color: PALE, size: 14, life: 1.2 });
            g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 8, shape: 'circle', r: 110, power: 2.6, type: 'physical', knock: 220, stagger: 60, hitStop: 0.12, shake: 0.4, big: true });
          }]],
        };
      },
    },
  ],

  // ---------------- FLASH STEP (Q / right click): dash, press again within 0.9 s for a second dash in a new direction
  special: {
    id: 'flash_step', tier: 'fast', name: 'Flash Step', type: 'special', slot: 'Q', key: 'Q', icon: 'flash_step',
    cost: 0, cooldown: 5, targeting: 'direction', tags: ['dash', 'mobility', 'recast', 'invulnerable'],
    desc: 'Dash (invulnerable) toward your movement keys or the cursor, cutting what you pass. Press again within 0.9 s for a second, longer dash — change direction in between.',
    recast: { window: 0.9, cast(p, g, a) { return p.cls.flashDash(p, g, a, true); } },
    cast(p, g, a) { return p.cls.flashDash(p, g, a, false); },
  },

  // ---------------- every frame (Player hook): MOMENTUM drains while standing still in a fight
  tick(p, g, dt) {
    const mo = p.cls.momentum;
    p.ghostStepT = Math.max(0, (p.ghostStepT || 0) - dt);
    if (p.dead || p.downed) return;
    if (p.status.has('overdrive')) { // ENDLESS RUN
      if (p.resources.get(M) < 100) p.resources.set(M, 100, 'overdrive');
      p.reduceCooldowns(dt * mo.overdriveCooldown);
      return;
    }
    if (!g.combat.inCombat) return;
    if (p.idleT > mo.idleGrace) p.resources.drain(M, mo.idleDrain * dt, 'idle');
    else if (p.moving) p.resources.gain(M, mo.movingGain * dt * (p.status.has('silent_run') ? 2 : 1), { reason: 'moving' });
  },

  // ---------------- passives: react to core events
  on: {
    playerDodged(p, g, e) {
      if (e.player !== p) return;
      p.gainResource(p.cls.charge.dodge);
      if (p.ghostStepT > 0) { // GHOST STEP: this dodge was free
        p.ghostStepT = 0;
        p.resources.gain('stamina', p.dodgeCost(), { raw: true, reason: 'ghostStep' }); // refund what tryDodge just spent
        g.vfx.text(p.x, p.y - 64, 'GHOST STEP', { color: PALE, size: 9 });
      }
    },
    // a heavy hit knocks momentum down (not during Endless Run)
    damageTaken(p, g, e) {
      if (e.target !== p || !(e.amount > 0) || (e.opts && e.opts.dot) || p.status.has('overdrive')) return;
      const mo = p.cls.momentum, o = e.opts || {};
      if (!(o.heavy || o.guardBreak || e.amount >= p.maxHp * mo.heavyShare) || p.resources.get(M) < 1) return;
      p.resources.drain(M, mo.heavyHitLoss, 'heavyHit');
      g.vfx.text(p.x, p.y - 84, 'MOMENTUM LOST', { color: '#8aa0c0', size: 9 });
    },
    // AMBUSH: the first hit out of Silent Run (the +50% comes from the status' damageMult)
    damageDealt(p, g, e) {
      if (e.source !== p || !p.status.has('silent_run') || (e.opts && e.opts.dot)) return;
      p.status.remove('silent_run');
      p.gainResource(p.cls.charge.ambush);
      g.vfx.text(p.x, p.y - 70, 'AMBUSH', { color: '#ffffff', size: 11 });
    },
    // momentum tier reached (data/resources.js tiers) — tell the player
    resourceTier(p, g, e) {
      if (e.entity !== p || e.tier <= e.before || !e.def) return;
      g.vfx.text(p.x, p.y - 82, e.def.label, { color: e.tier >= 2 ? '#ffffff' : PALE, size: e.tier >= 2 ? 13 : 11, life: 1.1 });
      g.vfx.ring(p.x, p.y, 8, 60, { life: 0.4, color: CR, width: 3 });
      g.audio.sfx('mark_full');
      if (e.tier >= 1) g.world.setFlag('tut_marks'); // tutorial step "Reach 60 Momentum"
    },
  },
  // GHOST STEP extras on top of the data rewards below (data/dodge.js)
  onPerfectDodge(p, g) {
    p.ghostStepT = p.cls.ghostStep.window;
    for (let i = 0; i < 8; i++) g.vfx.particle(p.x + rand(-10, 10), p.y - rand(4, 40), { color: i % 2 ? C : PALE, vy: -40, life: 0.5, size: 2, add: true });
  },
  counterBonus: { resource: 6 }, // data/counter.js
  perfectDodge: { resource: 20, stamina: 10, cooldownCut: 0.5, statuses: [{ id: 'counter_ready', dur: 1.5 }] }, // data/dodge.js
};
