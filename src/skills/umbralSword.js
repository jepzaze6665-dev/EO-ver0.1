import { TAU, rand } from '../core/math.js';
import { TEAM } from '../core/constants.js';
import { ANIMS } from '../player/playerSprites.js';

// UMBRAL SWORD — class definition. The combat core knows nothing about this file:
// a class is a stat block + basic combo + 5 skills + a special (Q) + passive hooks.
// Each skill returns an "action": a timeline of events the Player executes while
// still being controllable (moveMul) and cancelable by dodge (cancelAt).
// Future classes (Nightfall Reaper, Duskrunner, Blade of Echoes) plug in the same way.

const V = '170,80,255';
const fwd = (p, a, d) => ({ x: p.x + Math.cos(a) * d, y: p.y - 12 + Math.sin(a) * d });

function swing(p, g, a, o) {
  const c = fwd(p, a, 4);
  if (!o.noSprite) g.vfx.sprite('slash', p.x + Math.cos(a) * (o.r * 0.7), p.y - 14 + Math.sin(a) * (o.r * 0.7), a, { scale: o.r / 44, life: o.life ?? 0.2, flipY: !!o.flip });
  g.audio.sfx(o.sfx ?? 'swing');
}

export const UmbralSword = {
  id: 'umbral_sword',
  stableId: 'class_umbral_sword',
  name: 'Umbral Sword',
  role: 'Melee DPS · Assassin · Burst',
  difficulty: 3,
  ratings: { damage: 5, range: 1, defense: 2, mobility: 5, support: 1 },
  description: 'An assassin who marks, dances through danger and detonates shadow.',
  signatureWeapon: 'umbral_sword',
  preset: 'ub',
  anims: ANIMS,
  theme: { color: '#b070ff', ghost: '#8a3aff', trail: 'shadow' },
  startingGear: { weapon: 'umbral_sword', armor: 'umbral_cloak' },
  // 6 actives, 4 slots: the rest are swapped in from the Skills tab (key 5 is always Eclipse Sever)
  defaultLoadout: ['shadow_slash', 'twin_fang', 'shade_step', 'shadow_arc'],
  guideIntro: ['Your blade feeds on shadow. Each well-placed strike leaves a Shadow Mark — build three and you can unleash a SHADOW BREAK. [Q / Right Click]'],
  tutorial: { marks: 'Build 3 Shadow Marks', break: 'Unleash Shadow Break', breakSkill: 'shadow_break' },
  hudCounter(p) {
    return { label: 'SHADOW MARK', value: p.marks, max: p.maxMarks, color: '#b060ff', full: '#f0c8ff', ready: p.marks >= p.maxMarks, readyText: 'SHADOW BREAK READY — [Q]' };
  },
  resource: 'shadow_gauge', // primary resource (stable id → data/resources.js)
  resources: ['shadow_gauge'],
  mark: 'shadow_mark', // class mark (stable id → data/marks.js), stored in the generic MarkSystem
  base: { hp: 250, atk: 20, def: 6, crit: 0.08, critDmg: 0, shadowDmg: 0, cdr: 0, speed: 152, shadowGain: 1, armorBreak: 1 },
  perLevel: { hp: 12, atk: 1.5, def: 0.5 },

  // ---------------- basic 3-hit combo (LMB). 3rd hit builds a Shadow Mark.
  basic(p, g, a, step) {
    const counter = p.status.has('counter_ready'); // granted by a Perfect Dodge (status system)
    const defs = [
      { dur: 0.3, at: 0.07, anim: 'atk1', r: 52, half: 1.0, power: 1.0, lunge: 14, fx: { r: 30, half: 1.15 } },
      { dur: 0.3, at: 0.07, anim: 'atk2', r: 52, half: 1.0, power: 1.1, lunge: 14, fx: { r: 30, half: 1.15, flip: true } },
      { dur: 0.44, at: 0.13, anim: 'atk3', r: 62, half: 1.35, power: 1.55, lunge: 22, knock: 220, mark: true, fx: { r: 40, half: 1.4, width: 10, life: 0.26 } },
    ];
    const d = defs[step];
    return {
      name: 'basic' + step, basic: true, step, dur: d.dur, anim: counter ? 'counter' : d.anim, moveMul: 0.5,
      ang: a, cancelAt: 0.05, comboAt: d.at + 0.08,
      lunge: { dist: counter ? 40 : d.lunge, t0: 0, t1: 0.1 },
      events: [[d.at, () => {
        let marked = false;
        swing(p, g, a, counter ? { r: 46, half: 1.5, width: 12, life: 0.3, sfx: 'counter' } : d.fx);
        if (counter) { p.status.remove('counter_ready'); g.vfx.text(p.x, p.y - 64, 'COUNTER', { color: '#e0a0ff', size: 11 }); g.vfx.flash('150,60,255', 0.2, 6); }
        g.combat.spawnHitbox({
          owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: d.r + (counter ? 14 : 0), half: d.half + (counter ? 0.3 : 0),
          power: d.power * (counter ? 2.2 : 1), forceCrit: counter, knock: d.knock ?? 100, stagger: counter ? 40 : 10 + step * 6,
          hitStop: step === 2 || counter ? 0.08 : 0.045, shake: step === 2 ? 0.2 : 0.1, type: counter ? 'shadow' : 'physical',
          onHit: () => {
            p.gainResource(4);
            if ((d.mark || counter) && !marked) { marked = true; p.addMark(1); }
          },
        });
      }]],
    };
  },

  skills: [
    {
      slot: 1, id: 'shadow_slash', name: 'Shadow Slash', type: 'active', cooldown: 3.5, cost: 8, targeting: 'direction', tags: ['melee', 'shadow', 'mark'], icon: 'slash',
      desc: 'Lunge and cut the enemy in front. Builds 1 Shadow Mark.',
      cast(p, g, a) {
        let marked = false;
        return {
          name: 'shadow_slash', dur: 0.4, anim: 'shadowSlash', moveMul: 0.2, ang: a, cancelAt: 0.18,
          lunge: { dist: 48, t0: 0.04, t1: 0.14 },
          events: [[0.1, () => {
            swing(p, g, a, { r: 44, half: 1.2, life: 0.2, sfx: 'slash_heavy', noSprite: true });
            g.vfx.sprite('slash', p.x + Math.cos(a) * 34, p.y - 14 + Math.sin(a) * 34, a, { scale: 1.3, life: 0.3 });
            g.vfx.shadowSmoke(p.x, p.y, 6);
            g.combat.spawnHitbox({
              owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 76, half: 0.8, power: 2.1, type: 'shadow', knock: 180, stagger: 25, hitStop: 0.07, shake: 0.2,
              onHit: () => { p.gainResource(3); if (!marked) { marked = true; p.addMark(1); } },
            });
          }]],
        };
      },
    },
    {
      slot: 2, id: 'twin_fang', name: 'Twin Fang', type: 'active', cooldown: 6, cost: 12, targeting: 'direction', tags: ['melee', 'shadow', 'mark', 'multi-hit'], icon: 'twin',
      desc: 'Two rapid crossing cuts that shred through guards. Builds a Shadow Mark on hit.',
      cast(p, g, a) {
        const triple = p.mods.twinFangTriple;
        const times = triple ? [0.07, 0.2, 0.33] : [0.07, 0.22];
        let marked = false;
        const ev = times.map((t, i) => [t, () => {
          swing(p, g, a, { r: 36, life: 0.16, sfx: 'swing_fast', noSprite: true });
          g.vfx.sprite('twin', p.x + Math.cos(a) * 28, p.y - 14 + Math.sin(a) * 28, a, { scale: 1.05, life: 0.24, flipY: i % 2 === 1 });
          g.combat.spawnHitbox({
            owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 60, half: 1.1, power: 1.35, type: 'shadow', knock: 80, stagger: 14, hitStop: 0.05, shake: 0.12,
            onHit: () => { p.gainResource(2); if (!marked) { marked = true; p.addMark(1); } },
          });
        }]);
        return { name: 'twin_fang', dur: triple ? 0.5 : 0.42, anim: 'twinFang', moveMul: 0.5, ang: a, cancelAt: 0.15, events: ev, lunge: { dist: 18, t0: 0, t1: 0.2 } };
      },
    },
    {
      slot: 3, id: 'shade_step', name: 'Shade Step', type: 'active', cooldown: 4.5, cost: 10, targeting: 'direction', tags: ['dash', 'mobility', 'invulnerable', 'mark'], icon: 'step',
      desc: 'Dash through enemies as a shadow. Invulnerable; can trigger Perfect Dodge. Builds a Mark on hit.',
      cast(p, g, a) {
        const mv = g.input.moveVector();
        const ang = mv.x || mv.y ? Math.atan2(mv.y, mv.x) : a;
        const sx = p.x, sy = p.y;
        let marked = false;
        p.beginDodge(ang, true);
        g.audio.sfx('dash');
        return {
          name: 'shade_step', dur: 0.22, anim: 'shadeStep', moveMul: 0, ang, cancelAt: 0.22, invuln: [0, 0.3], dash: { ang, dist: 165 },
          ghostEvery: 0.025,
          events: [[0.2, () => {
            const len = Math.hypot(p.x - sx, p.y - sy);
            g.combat.spawnHitbox({
              owner: p, x: sx, y: sy - 8, ang: Math.atan2(p.y - sy, p.x - sx), shape: 'line', len: len + 10, width: 22, power: 1.3, type: 'shadow', knock: 60, stagger: 12, hitStop: 0.05,
              onHit: (t) => { g.vfx.sprite('shards', t.x, t.y - 16, rand(0, TAU), { scale: 0.5, life: 0.2 }); if (!marked) { marked = true; p.addMark(1); } },
            });
            g.vfx.sprite('thrust', (sx + p.x) / 2, (sy + p.y) / 2 - 12, Math.atan2(p.y - sy, p.x - sx), { scale: Math.max(1, len / 80), life: 0.28 });
            if (p.mods.shadeBomb) {
              g.vfx.ring(sx, sy, 6, 50, { life: 0.4 });
              g.combat.spawnHitbox({ owner: p, x: sx, y: sy, shape: 'circle', r: 54, delay: 0.35, power: 1.4, type: 'shadow', knock: 150, hitStop: 0.05,
                onHit: () => {} });
              g.after(0.35, () => { g.vfx.burst(sx, sy - 10, '#b060ff', 24, 160); g.vfx.ring(sx, sy, 10, 60, { life: 0.35 }); g.audio.sfx('boom_small'); });
            }
          }]],
        };
      },
    },
    {
      slot: 4, id: 'shadow_arc', name: 'Shadow Arc', type: 'active', cooldown: 8, cost: 22, targeting: 'direction', tags: ['aoe', 'shadow'], icon: 'arc',
      desc: 'Release a wide crescent of shadow that sweeps through groups. Hitting 3+ enemies builds a Mark.',
      cast(p, g, a) {
        let hits = 0, marked = false;
        return {
          name: 'shadow_arc', dur: 0.5, anim: 'shadowArc', moveMul: 0.25, ang: a, cancelAt: 0.25,
          events: [
            [0.12, () => {
              g.audio.sfx('arc');
              const c = fwd(p, a, 0);
              for (let i = 0; i < 3; i++) g.after(i * 0.07, () => g.vfx.sprite('wave', c.x + Math.cos(a) * (40 + i * 42), c.y + Math.sin(a) * (40 + i * 42), a, { scale: 1.1 + i * 0.35, life: 0.3 }));
              g.combat.spawnHitbox({
                owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'arcband', r0: 10, r: 40, half: 1.3, life: 0.28, power: 1.9, type: 'shadow', knock: 170, stagger: 20, hitStop: 0.05, shake: 0.22,
                grow: (hb, dt) => { hb.r = Math.min(155, hb.r + dt * 420); hb.r0 = Math.max(10, hb.r - 60); },
                onHit: () => { hits++; p.gainResource(2); if (hits >= 3 && !marked) { marked = true; p.addMark(1); } },
              });
            }],
          ],
        };
      },
    },
    {
      id: 'shadow_veil', name: 'Shadow Veil', type: 'active', cooldown: 12, cost: 15, targeting: 'self', tags: ['stealth', 'utility', 'mark'], icon: 'veil_shadow',
      desc: 'Melt into shadow for 3 s: monsters lose track of you and you move faster. Your next hit is an AMBUSH (+60% damage, +1 Shadow Mark).',
      cast(p, g, a) {
        return {
          name: 'shadow_veil', dur: 0.3, anim: 'aura', moveMul: 0.4, ang: a, cancelAt: 0.12,
          events: [[0.08, () => {
            p.status.add('veiled', 3, { source: p, refresh: true });
            g.audio.sfx('dash');
            g.vfx.shadowSmoke(p.x, p.y, 14, { vy: -40 });
            g.vfx.ring(p.x, p.y, 6, 46, { life: 0.3, color: '120,60,200', width: 2 });
          }]],
        };
      },
    },
    {
      id: 'phantom_edge', name: 'Phantom Edge', type: 'active', cooldown: 5, cost: 12, targeting: 'direction', tags: ['ranged', 'shadow', 'mark', 'pierce'], icon: 'phantom',
      desc: 'Hurl a phantom blade that pierces everything, then returns to you. Marks the first enemy hit on the way out.',
      cast(p, g, a) {
        let marked = false;
        const blade = (x, y, ang, back) => g.combat.projectiles.fire({
          x, y, vx: Math.cos(ang) * 540, vy: Math.sin(ang) * 540, r: 12, life: 0.4,
          team: TEAM.PLAYER, owner: p, kind: 'sprite', sprite: 'twin', frames: [2, 3, 4, 3], fps: 20, scale: 0.7,
          pierce: true, power: back ? 1.0 : 1.3, type: 'shadow', knock: 70, stagger: 12, hitStop: 0.04, shake: 0.1, color: '#b070ff', trail: true, wallStop: !back,
          onHit: () => { p.gainResource(2); if (!back && !marked) { marked = true; p.addMark(1); } },
        });
        return {
          name: 'phantom_edge', dur: 0.32, anim: 'atk2', moveMul: 0.5, ang: a, cancelAt: 0.14,
          events: [[0.08, () => {
            g.audio.sfx('swing_fast');
            const sx = p.x + Math.cos(a) * 14, sy = p.y - 14 + Math.sin(a) * 14;
            const out = blade(sx, sy, a, false);
            // the blade turns around where it is after 0.4 s and flies back to the Umbral Sword
            g.after(0.4, () => { const bx = out.active ? out.x : sx + Math.cos(a) * 216, by = out.active ? out.y : sy + Math.sin(a) * 216; blade(bx, by, Math.atan2(p.y - 14 - by, p.x - bx), true); });
          }]],
        };
      },
    },
    {
      slot: 5, id: 'eclipse_sever', name: 'Eclipse Sever', type: 'ultimate', cooldown: 24, cost: 50, targeting: 'direction', tags: ['burst', 'shadow', 'consumes-marks'], icon: 'eclipse', ultimate: true,
      desc: 'ULTIMATE. Summon a black eclipse and sever everything ahead. Consumes all Shadow Marks for bonus damage.',
      cast(p, g, a) {
        return {
          name: 'eclipse_sever', dur: 1.1, anim: 'eclipse', moveMul: 0, ang: a, cancelAt: 99, invuln: [0, 1.1], superArmor: true,
          start: () => {
            g.vfx.startEclipse(p.x, p.y, 1.0);
            g.slowMo(0.55, 0.45);
            g.audio.sfx('ult_charge');
            g.vfx.flash('40,0,60', 0.35, 2);
          },
          update: (t, dt) => { if (t < 0.5) g.vfx.shadowSmoke(p.x, p.y, 1, { vy: -60 }); },
          events: [
            [0.52, () => {
              const n = p.marks;
              p.consumeMarks(n);
              const power = 5 + n * 1.3;
              g.camera.targetZoom = 1;
              g.camera.punch(0.28);
              g.camera.shake(0.85);
              g.hitStop = Math.max(g.hitStop, 0.16);
              g.vfx.flash('200,140,255', 0.5, 2.5);
              g.audio.sfx('ult_slash');
              g.vfx.sprite('eclipse', p.x + Math.cos(a) * 90, p.y - 14 + Math.sin(a) * 90, a, { scale: 2.8, life: 0.55, glow: 0.5 });
              g.vfx.ring(p.x, p.y, 20, 170, { life: 0.5, width: 6, fill: true });
              g.vfx.burst(p.x + Math.cos(a) * 80, p.y + Math.sin(a) * 80, '#c080ff', 50, 280);
              g.vfx.light(p.x + Math.cos(a) * 90, p.y + Math.sin(a) * 90, 200, '#c080ff', 0.6, 1);
              if (n) g.vfx.text(p.x, p.y - 80, `ECLIPSE ×${n}`, { color: '#e0b0ff', size: 13 });
              g.combat.spawnHitbox({
                owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 195, half: 0.5, power, type: 'shadow', knock: 340, stagger: 90, hitStop: 0.2, shake: 0.5, big: true, breakBonus: 1.3,
              });
              g.combat.projectiles.fire({
                x: p.x + Math.cos(a) * 30, y: p.y - 14 + Math.sin(a) * 30, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, r: 26, life: 0.7,
                team: TEAM.PLAYER, owner: p, kind: 'wave', pierce: true, power: 2.2, type: 'shadow', knock: 200, stagger: 30, hitStop: 0.05, wallStop: false, trail: true, color: '#c080ff',
              });
            }],
          ],
          end: () => { g.camera.targetZoom = 1; },
        };
      },
    },
  ],

  // ---------------- SHADOW BREAK (Q / right click) — needs 3 Marks
  special: {
    id: 'shadow_break', name: 'Shadow Break', type: 'special', slot: 'Q', key: 'Q', icon: 'break',
    cost: 0, cooldown: 0.4, targeting: 'self', tags: ['burst', 'aoe', 'consumes-marks'],
    requirements: [{ type: 'mark', mark: 'shadow_mark', min: 3, label: '3 Shadow Marks' }],
    desc: 'Detonate 3 Shadow Marks: a massive burst around you. Devastating during a Weak Window.',
    cast(p, g, a) {
      const sigil = p.mods.sigil;
      const bandMult = p.mods.breakDmg || 1;
      return {
        name: 'shadow_break', dur: 0.66, anim: 'shadowBreak', moveMul: 0, ang: a, cancelAt: 0.4, invuln: [0, 0.35], superArmor: true,
        start: () => {
          p.consumeMarks(3);
          g.hitStop = Math.max(g.hitStop, 0.12);
          g.vfx.flash('120,40,200', 0.3, 5);
          g.audio.sfx('break_charge');
          g.vfx.sprite('wave', p.x, p.y - 16, -Math.PI / 2, { scale: 1.2, life: 0.14 }); // gathering shadow
        },
        events: [
          [0.14, () => {
            g.camera.targetZoom = 1;
            g.camera.punch(0.22);
            g.camera.shake(0.7);
            g.vfx.sprite('burst', p.x, p.y - 16, 0, { scale: 2.6, life: 0.5, glow: 0.55 });
            g.vfx.sprite('shards', p.x + Math.cos(a) * 60, p.y - 14 + Math.sin(a) * 60, a, { scale: 1.6, life: 0.4 });
            g.vfx.flash('230,190,255', 0.32, 3.5);
            g.vfx.shards(p.x, p.y - 10, '#b060ff', 26, 220);
            g.vfx.burst(p.x, p.y - 10, '#d8a0ff', 40, 260);
            g.vfx.light(p.x, p.y, 220, '#b060ff', 0.5, 1);
            g.audio.sfx('break');
            g.vfx.text(p.x, p.y - 84, 'SHADOW BREAK', { color: '#f0d0ff', size: 14, life: 1.2 });
            const mult = (sigil ? 1.4 : 1) * bandMult;
            g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 8, shape: 'circle', r: 112, power: 2.6 * mult, type: 'shadow', knock: 300, stagger: 60, hitStop: 0.16, shake: 0.4, big: true, breakBonus: 1.5 });
            g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 8, ang: a, shape: 'cone', r: 170, half: 0.55, power: 1.2 * mult, type: 'shadow', knock: 200, stagger: 25, hitStop: 0.05, breakBonus: 1.5 });
            p.gainResource(20, true);
            p.status.add('surge', 5, { mult: 1.15, refresh: true });
          }],
          [0.42, () => {
            if (!sigil) return;
            g.vfx.sprite('burst', p.x, p.y - 16, Math.PI / 4, { scale: 3.2, life: 0.4, glow: 0.4 });
            g.audio.sfx('boom_small');
            g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 8, shape: 'ring', r0: 60, r: 165, power: 1.8, type: 'shadow', knock: 200, stagger: 30, hitStop: 0.06 });
          }],
        ],
        end: () => { g.camera.targetZoom = 1; },
      };
    },
  },

  // ---------------- passive hooks (bus events — see core/events)
  on: {
    // AMBUSH: the first hit out of Shadow Veil (the +60% comes from the 'veiled' status damageMult)
    damageDealt(p, g, e) {
      if (e.source !== p || !p.status.has('veiled') || (e.opts && e.opts.dot)) return;
      p.status.remove('veiled');
      p.addMark(1);
      g.vfx.text(e.target.x, e.target.y - (e.target.height || 30) - 20, 'AMBUSH', { color: '#e0c0ff', size: 11 });
      g.vfx.shadowSmoke(e.target.x, e.target.y, 8);
    },
  },
  onPerfectDodge(p, g) {
    p.addMark(1);
    p.gainResource(20, true);
    p.reduceCooldowns(1.0);
    p.status.add('haste', 1.5, { mult: 1.3, refresh: true });
    p.status.add('counter_ready', 1.3, { refresh: true });
    if (p.mods.perfectBonus) { p.addMark(1); p.gainResource(15, true); }
  },
};

export const CLASSES = { umbral_sword: UmbralSword }; // v1 alias — the full registry is skills/classes.js
