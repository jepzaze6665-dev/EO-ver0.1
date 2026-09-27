import { TAU, rand } from '../core/math.js';
import { TEAM } from '../core/constants.js';

// ASTRAL WEAVER — ranged control mage. Class = data + behaviour that only CALLS core systems:
//   ResourcePool (astral_charge) · SkillSystem · MarkSystem (star_mark on enemies)
//   ThreadSystem (astral_thread) · StatusSystem (slow / root / shield) · Combat (hitboxes, projectiles)
// Gameplay loop: Place Thread → Star Mark → control position → Astral Charge → Thread Burst
//                → Constellation Break (auto at 3 Star Marks) → Starfall Fate
// Nothing in the core knows this file exists; passives react to bus events through `on`.

const C = '#8ad8ff', CR = '120,200,255';
const MAX_RANGE = 240;

// animation table for the 'aw' preset (tools/build-player.js aw → assets/player/aw)
export const AW_ANIMS = {
  idle: { sheet: 'walk', cols: [0] },
  walk: { sheet: 'walk', cols: [1, 2, 3, 4, 5], fps: 9, loop: true },
  run: { sheet: 'walk', cols: [1, 2, 3, 4, 5], fps: 13, loop: true },
  atk1: { sheet: 'atk1', cols: [1, 2, 3, 4] },
  atk2: { sheet: 'atk2', cols: [1, 2, 3, 4] },
  atk3: { sheet: 'cast', cols: [1, 2, 3, 4, 5] },
  dodge: { sheet: 'sk3', cols: [2, 3, 4] },
  starNeedle: { sheet: 'sk1', cols: [1, 2, 3, 4, 5] },
  astralThread: { sheet: 'sk2', cols: [1, 2, 3, 4, 5] },
  cometStep: { sheet: 'sk3', cols: [1, 2, 3, 4, 5] },
  threadBurst: { sheet: 'sk5', cols: [1, 2, 3, 4, 5] },
  veil: { sheet: 'sk6', cols: [1, 2, 3, 4, 5] },
  starfall: { sheet: 'ult', cols: [1, 2, 3, 3, 4, 5] },
  hurt: { sheet: 'hit', cols: [1, 2, 3] },
  death: { sheet: 'hit', cols: [1, 2, 3, 4] },
};

// aim point clamped to a range (targeting: 'point')
function aimPoint(p, g, range) {
  const m = g.mouseWorld(), dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, range / d);
  return { x: p.x + dx * k, y: p.y + dy * k };
}
function nearestHostile(g, x, y, within) {
  let best = null, bd = within;
  for (const m of g.world.hostiles()) {
    if (m.dead || m.isBreakable) continue;
    const d = Math.hypot(m.x - x, m.y - y);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

export const AstralWeaver = {
  id: 'astral_weaver',
  stableId: 'class_astral_weaver',
  name: 'Astral Weaver',
  role: 'Ranged Magic · Control · Utility',
  difficulty: 4, // ★ out of 5
  ratings: { damage: 4, range: 5, defense: 2, mobility: 3, support: 4 },
  description: 'A mage who controls the battlefield with threads of starlight.',
  signatureWeapon: 'celestial_loom',
  preset: 'aw',
  anims: AW_ANIMS,
  theme: { color: C, ghost: '#4a7aff', trail: 'stardust' },
  resource: 'astral_charge', // builder → spender (starts at 0, decays out of combat)
  resources: ['astral_charge'],
  mark: null, // no self mark; Star Marks live on enemies
  enemyMark: 'star_mark',
  base: { hp: 210, atk: 21, def: 4, crit: 0.07, critDmg: 0, magicDmg: 0, cdr: 0, speed: 150, astralGain: 1, armorBreak: 1 },
  perLevel: { hp: 10, atk: 1.6, def: 0.4 },
  startingGear: { weapon: 'celestial_loom', armor: 'astral_robe' },
  // Astral Charge generation rules (data, not code)
  charge: { basicHit: 4, needleHit: 5, threadTouch: 3, markApplied: 2, bind: 6, constellation: 14, perfectDodge: 15 },
  guideIntro: [
    'Your loom spins starlight. Weave Astral Threads [2] — foes that cross them are slowed and Star-Marked. Three Star Marks on one foe cause a CONSTELLATION BREAK.',
    'Build Astral Charge, then detonate every thread at once with THREAD BURST [4]. Keep your distance — you are fragile up close.',
  ],
  tutorial: { marks: 'Trigger a Constellation Break', break: 'Detonate threads with Thread Burst', breakSkill: 'thread_burst' },

  // HUD counter panel (generic HUD asks the class what to show)
  hudCounter(p) {
    const n = p.threadCount;
    return { label: 'ASTRAL THREADS', value: n, max: 3, color: C, full: '#e8f8ff', ready: false };
  },

  // apply this class's enemy mark (MarkSystem handles stacks / expiry / Constellation trigger)
  markTarget(p, g, t) {
    if (!t || t.dead || t.isBreakable) return;
    g.marks.apply(t, 'star_mark', { source: p, sourceClass: 'astral_weaver' });
  },

  // ---------------- basic: 2 star bolts, then a piercing lance that places a Star Mark
  basic(p, g, a, step) {
    const cls = p.cls;
    const defs = [
      { dur: 0.32, at: 0.1, anim: 'atk1', power: 0.95, speed: 470, scale: 0.55, pierce: false },
      { dur: 0.32, at: 0.1, anim: 'atk2', power: 1.0, speed: 470, scale: 0.55, pierce: false },
      { dur: 0.46, at: 0.18, anim: 'atk3', power: 1.45, speed: 560, scale: 0.8, pierce: true, mark: true },
    ];
    const d = defs[step];
    return {
      name: 'basic' + step, basic: true, step, dur: d.dur, anim: d.anim, moveMul: 0.55, ang: a, cancelAt: 0.05, comboAt: d.at + 0.06,
      events: [[d.at, () => {
        g.audio.sfx(step === 2 ? 'cast' : 'swing_fast');
        const ox = p.x + Math.cos(a) * 16, oy = p.y - 16 + Math.sin(a) * 16;
        g.vfx.burst(ox, oy, C, 5, 50);
        g.combat.projectiles.fire({
          x: ox, y: oy, vx: Math.cos(a) * d.speed, vy: Math.sin(a) * d.speed, r: step === 2 ? 9 : 6, life: 0.55,
          team: TEAM.PLAYER, owner: p, kind: 'sprite', sprite: 'aw_needle', frames: [1, 2, 3, 2], fps: 18, scale: d.scale,
          pierce: d.pierce, power: d.power, type: 'magic', knock: step === 2 ? 140 : 60, stagger: 8 + step * 6, hitStop: 0.03, shake: 0.06, color: C, trail: true,
          onHit: (t) => {
            p.gainResource(cls.charge.basicHit);
            g.vfx.sprite('aw_star', t.x, t.y - 18, rand(0, TAU), { scale: 0.45, life: 0.2, glow: 0.4 });
            if (d.mark) cls.markTarget(p, g, t);
          },
        });
      }]],
    };
  },

  skills: [
    {
      slot: 1, id: 'star_needle', name: 'Star Needle', type: 'active', cooldown: 2.2, cost: 0, targeting: 'direction',
      tags: ['ranged', 'magic', 'mark', 'pierce'], icon: 'needle',
      desc: 'Hurl a piercing needle of starlight. Places a Star Mark on every enemy it passes.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'star_needle', dur: 0.36, anim: 'starNeedle', moveMul: 0.3, ang: a, cancelAt: 0.16,
          events: [[0.14, () => {
            g.audio.sfx('star');
            const ox = p.x + Math.cos(a) * 18, oy = p.y - 16 + Math.sin(a) * 18;
            g.vfx.sprite('aw_star', ox, oy, a, { scale: 0.6, life: 0.2 });
            g.combat.projectiles.fire({
              x: ox, y: oy, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, r: 9, life: 0.45,
              team: TEAM.PLAYER, owner: p, kind: 'sprite', sprite: 'aw_needle', frames: [2, 3], fps: 16, scale: 1.05,
              pierce: true, power: 1.7, type: 'magic', knock: 90, stagger: 14, hitStop: 0.05, shake: 0.12, color: C, trail: true,
              onHit: (t) => { p.gainResource(cls.charge.needleHit); cls.markTarget(p, g, t); },
            });
          }]],
        };
      },
    },
    {
      slot: 2, id: 'astral_thread', name: 'Astral Thread', type: 'active', cooldown: 3, cost: 0, targeting: 'point',
      tags: ['thread', 'control', 'magic'], icon: 'thread',
      desc: 'Weave a thread of starlight from your feet to the cursor. Enemies crossing it are slowed, damaged and Star-Marked. Aim at an enemy to BIND it (root).',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'astral_thread', dur: 0.4, anim: 'astralThread', moveMul: 0.2, ang: a, cancelAt: 0.2,
          events: [[0.16, () => {
            const pt = aimPoint(p, g, MAX_RANGE);
            const foe = nearestHostile(g, pt.x, pt.y, 46);
            const th = g.threads.create(p, 'astral_thread', { x: p.x, y: p.y }, foe ? { entity: foe } : pt);
            if (!th) return;
            g.audio.sfx('thread');
            g.vfx.sprite('aw_star', th.a.x, th.a.y - 6, 0, { scale: 0.55, life: 0.3 });
            g.vfx.sprite('aw_star', th.b.x, th.b.y - 6, 0, { scale: 0.7, life: 0.35 });
            if (foe) { // Astral Bind — successful control
              foe.status.add('root', 1.1, { source: p });
              cls.markTarget(p, g, foe);
              p.gainResource(cls.charge.bind);
              g.vfx.text(foe.x, foe.y - (foe.height || 30) - 10, 'BOUND', { color: C, size: 9 });
            }
          }]],
        };
      },
    },
    {
      slot: 3, id: 'comet_step', name: 'Comet Step', type: 'active', cooldown: 5, cost: 0, targeting: 'direction',
      tags: ['dash', 'mobility', 'invulnerable', 'thread'], icon: 'comet',
      desc: 'Blink as a comet (invulnerable, can Perfect Dodge). Leaves an Astral Thread along your path.',
      cast(p, g, a) {
        const mv = g.input.moveVector();
        const ang = mv.x || mv.y ? Math.atan2(mv.y, mv.x) : a;
        const sx = p.x, sy = p.y;
        p.beginDodge(ang, true);
        g.audio.sfx('blink');
        return {
          name: 'comet_step', dur: 0.22, anim: 'cometStep', moveMul: 0, ang, cancelAt: 0.22, invuln: [0, 0.28], dash: { ang, dist: 150 },
          ghostEvery: 0.03,
          events: [[0.21, () => {
            const len = Math.hypot(p.x - sx, p.y - sy);
            g.vfx.sprite('aw_comet', (sx + p.x) / 2, (sy + p.y) / 2 - 14, Math.atan2(p.y - sy, p.x - sx), { scale: Math.max(1, len / 70), life: 0.3 });
            if (len >= 40) g.threads.create(p, 'astral_thread', { x: sx, y: sy }, { x: p.x, y: p.y }, { duration: 5 });
          }]],
        };
      },
    },
    {
      slot: 4, id: 'thread_burst', name: 'Thread Burst', type: 'active', cooldown: 6, cost: 30, targeting: 'self',
      tags: ['thread', 'burst', 'aoe', 'magic', 'consumes-threads'], icon: 'burst',
      requirements: [{ type: 'value', key: 'threadCount', min: 1, label: 'an Astral Thread' }],
      desc: 'Detonate every Astral Thread you have woven. Each explosion places a Star Mark.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'thread_burst', dur: 0.5, anim: 'threadBurst', moveMul: 0.1, ang: a, cancelAt: 0.3, superArmor: true,
          events: [[0.18, () => {
            const segs = g.threads.triggerAll(p, 'burst');
            g.audio.sfx('thread_burst');
            g.camera.shake(0.35 + segs.length * 0.1);
            g.vfx.flash(CR, 0.25, 4);
            for (const seg of segs) {
              const len = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay), ang = Math.atan2(seg.by - seg.ay, seg.bx - seg.ax);
              const n = Math.max(1, Math.round(len / 55));
              for (let i = 0; i <= n; i++) {
                const k = i / n;
                g.after(i * 0.03, () => g.vfx.sprite('aw_nova', seg.ax + (seg.bx - seg.ax) * k, seg.ay + (seg.by - seg.ay) * k - 10, ang, { scale: 0.9, life: 0.32, glow: 0.5 }));
              }
              g.vfx.light((seg.ax + seg.bx) / 2, (seg.ay + seg.by) / 2, 90 + len * 0.3, C, 0.4, 0.8);
              g.combat.threadBurst(seg, p, { onHit: () => p.gainResource(cls.charge.markApplied) }); // Star Mark comes from thread data (burst.mark)
            }
            if (segs.length) g.vfx.text(p.x, p.y - 80, segs.length > 1 ? `THREAD BURST ×${segs.length}` : 'THREAD BURST', { color: '#e8f8ff', size: 12 });
          }]],
        };
      },
    },
    {
      slot: 5, id: 'starfall_fate', name: 'Starfall Fate', type: 'ultimate', cooldown: 22, cost: 60, targeting: 'point',
      tags: ['ultimate', 'aoe', 'magic', 'mark'], icon: 'starfall', ultimate: true,
      desc: 'ULTIMATE. Call down a rain of stars on the target area. Every star places a Star Mark; the final impact is devastating.',
      cast(p, g, a) {
        const cls = p.cls;
        const pt = aimPoint(p, g, 260);
        const drop = (r, power, big) => {
          g.vfx.sprite('aw_starfall', pt.x + rand(-20, 20), pt.y - 40, Math.PI / 2, { scale: big ? 2.2 : 1.4, life: 0.4, glow: 0.6 });
          g.vfx.burst(pt.x, pt.y - 6, C, big ? 40 : 16, big ? 260 : 150);
          g.audio.sfx(big ? 'constellation' : 'star');
          g.combat.spawnHitbox({ owner: p, x: pt.x, y: pt.y, shape: 'circle', r, power, type: 'magic', knock: big ? 260 : 90, stagger: big ? 70 : 18, hitStop: big ? 0.14 : 0.05, shake: big ? 0.6 : 0.2, big,
            onHit: (t) => { if (!big) cls.markTarget(p, g, t); } });
        };
        return {
          name: 'starfall_fate', dur: 1.05, anim: 'starfall', moveMul: 0, ang: a, cancelAt: 99, invuln: [0, 1.05], superArmor: true,
          start: () => {
            g.slowMo(0.5, 0.4);
            g.audio.sfx('ult_charge');
            g.vfx.flash('30,40,90', 0.35, 2);
            g.vfx.sprite('aw_sigil', pt.x, pt.y - 4, 0, { scale: 2.2, life: 1.0, glow: 0.3 });
            g.vfx.ring(pt.x, pt.y, 30, 110, { life: 0.9, color: CR, width: 2 });
          },
          events: [
            [0.42, () => drop(80, 1.6, false)],
            [0.56, () => drop(80, 1.6, false)],
            [0.7, () => drop(80, 1.6, false)],
            [0.88, () => {
              drop(125, 4.2, true);
              g.camera.punch(0.25);
              g.vfx.flash('200,230,255', 0.45, 2.5);
              g.vfx.light(pt.x, pt.y, 220, C, 0.6, 1);
              g.vfx.text(pt.x, pt.y - 90, 'STARFALL FATE', { color: '#e8f8ff', size: 14, life: 1.2 });
            }],
          ],
        };
      },
    },
  ],

  // ---------------- ASTRAL VEIL (Q / right click) — shield + repel
  special: {
    id: 'astral_veil', name: 'Astral Veil', type: 'special', slot: 'Q', key: 'Q', icon: 'veil',
    cost: 0, cooldown: 12, targeting: 'self', tags: ['defense', 'shield', 'control'],
    desc: 'Wrap yourself in a veil of stars: a shield (20% max HP) and a pulse that repels and slows nearby enemies.',
    cast(p, g, a) {
      return {
        name: 'astral_veil', dur: 0.45, anim: 'veil', moveMul: 0.2, ang: a, cancelAt: 0.25, superArmor: true,
        events: [[0.15, () => {
          p.status.add('shield', 5, { amount: Math.round(p.maxHp * 0.2), source: p, refresh: true });
          g.audio.sfx('shrine');
          g.vfx.sprite('aw_sigil', p.x, p.y - 20, 0, { scale: 1.5, life: 0.45, glow: 0.5 });
          g.vfx.ring(p.x, p.y, 10, 80, { life: 0.35, color: CR, width: 3 });
          g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 8, shape: 'circle', r: 78, power: 0.8, type: 'magic', knock: 280, stagger: 30, hitStop: 0.05, shake: 0.2,
            onHit: (t) => { if (t.status) t.status.add('slow', 2.5, { source: p }); } });
        }]],
      };
    },
  },

  // ---------------- passives: react to core events (see core/events bus)
  on: {
    // Constellation Break — the MarkSystem consumed 3 Star Marks on a target we marked
    markTriggered(p, g, e) {
      if (e.markId !== 'star_mark' || e.source !== p) return;
      const t = e.target;
      g.vfx.sprite('aw_star', t.x, t.y - 22, 0, { scale: 1.7, life: 0.45, glow: 0.7 });
      g.vfx.ring(t.x, t.y, 8, 70, { life: 0.35, color: CR, width: 3 });
      g.vfx.burst(t.x, t.y - 20, '#e8f8ff', 24, 180);
      g.vfx.text(t.x, t.y - (t.height || 30) - 24, 'CONSTELLATION BREAK', { color: '#e8f8ff', size: 11, life: 1.1 });
      g.audio.sfx('constellation');
      g.camera.shake(0.3);
      // bonus magic damage around the target — never applies marks (no chain loops)
      g.combat.spawnHitbox({ owner: p, x: t.x, y: t.y, shape: 'circle', r: 58, power: 2.8, type: 'magic', knock: 160, stagger: 45, hitStop: 0.1, shake: 0.3, big: true, breakBonus: 1.3 });
      p.gainResource(p.cls.charge.constellation, true);
    },
    threadTouched(p, g, e) { if (e.owner === p && e.first) p.gainResource(p.cls.charge.threadTouch); },
  },
  onPerfectDodge(p, g) {
    p.gainResource(p.cls.charge.perfectDodge, true);
    p.reduceCooldowns(0.8);
    p.status.add('haste', 1.5, { mult: 1.3, refresh: true });
  },
};
