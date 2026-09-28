import { TAU, rand } from '../core/math.js';

// NIGHTFALL REAPER — Class 2 of the Umbral Sword. AoE DPS · Assassin · Execute.
// Class = data + behaviour that only CALLS core systems:
//   ResourcePool (nightfall_gauge + its tiers) · MarkSystem (reaper_mark = Shadow Mark on enemies)
//   SummonSystem (shadow_doppel) · StatusSystem (slow / root / haste) · Combat (hitboxes, per-target power)
//   damageSystem execute stats (Bloodless Night) · SkillSystem requirement 'markedFoe' (Reaper's Step)
// Gameplay loop: Reaper's Arc marks the pack → Nightfall Zone slows / marks / pulls them together
//   → Phantom Reap or Reaper's Step detonates the marks (Mark Explosion) → kills feed the Nightfall Gauge
//   (Death Harvest) → high gauge = more shadow damage / area / crit → Funeral Eclipse spends it all.
// Nothing in the core knows this file exists; passives react to bus events through `on`.

const C = '#a070ff', CR = '160,100,255', PALE = '#e8c8ff';
const MARK = 'reaper_mark';

// animation table for the 'rp' preset (tools/build-player.js rp → assets/player/rp)
export const RP_ANIMS = {
  idle: { sheet: 'idle', cols: [0, 1, 2, 3, 4, 5], fps: 4, loop: true },
  walk: { sheet: 'walk', cols: [1, 2, 3, 4, 5], fps: 9, loop: true },
  run: { sheet: 'walk', cols: [1, 2, 3, 4, 5], fps: 13, loop: true },
  atk1: { sheet: 'atk1', cols: [1, 2, 3, 4] },
  atk2: { sheet: 'atk2', cols: [1, 2, 3, 4] },
  atk3: { sheet: 'extra', cols: [1, 2, 3, 3, 4] },  // wide finishing sweep
  dodge: { sheet: 'dash', cols: [1, 2, 3, 4] },
  reapersArc: { sheet: 'sk1', cols: [1, 2, 3, 3, 4] }, // full 360° spin
  phantomReap: { sheet: 'sk2', cols: [1, 2, 3, 4] },
  doppel: { sheet: 'sk3', cols: [2, 3, 3] },         // cols 1 / 4 are clone-only frames in some rows
  nightfallZone: { sheet: 'sk4', cols: [1, 2, 3, 3, 4] },
  reapersStep: { sheet: 'sk5', cols: [2, 3, 3, 4] },   // melts into shadow, rises with the scythe
  harvest: { sheet: 'sk6', cols: [1, 2, 3, 3, 4] },
  funeral: { sheet: 'ult', cols: [1, 2, 3, 3, 3, 4] }, // black sun overhead
  hurt: { sheet: 'hit', cols: [1, 2] },
  death: { sheet: 'hit', cols: [1, 2, 3, 4] },
};

// ---- helpers (class-local)
const area = (p, r) => r * (1 + (p.stats.aoe || 0)); // gauge tiers add `aoe`
const marksOn = (g, t) => g.marks.get(t, MARK);
function aimPoint(p, g, range) {
  const m = g.mouseWorld(), dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, range / d);
  return { x: p.x + dx * k, y: p.y + dy * k };
}
// gauge per hit, capped per cast (one skill hitting 10 foes must not fill the gauge by itself)
function feeder(p, per, cap) {
  let got = 0;
  return () => { if (got < cap) { got += per; p.gainResource(per); } };
}
// move a point-like thing (a summon) with wall collision
function slide(g, obj, dx, dy) {
  const tmp = { x: obj.x, y: obj.y, radius: 7 };
  g.world.map.moveCircle(tmp, dx, dy);
  obj.x = tmp.x; obj.y = tmp.y;
}
function nearestFoe(g, x, y, within) {
  let best = null, bd = within;
  for (const m of g.world.hostiles()) {
    if (m.dead || m.isBreakable) continue;
    const d = Math.hypot(m.x - x, m.y - y);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

export const NightfallReaper = {
  id: 'nightfall_reaper',
  stableId: 'class_nightfall_reaper',
  name: 'Nightfall Reaper',
  role: 'AoE DPS · Assassin · Execute',
  difficulty: 4,
  ratings: { damage: 5, range: 2, defense: 2, mobility: 4, support: 1 },
  description: 'The Umbral Sword who chose the scythe: marks whole packs, detonates the marks and harvests the fallen.',
  identity: 'Mark them all. Let night fall. Reap.',
  strengths: ['Best area damage: 360° sweeps, shadow zones, mark explosions', 'Executes low-HP foes (Bloodless Night, Funeral Eclipse)', 'Snowballs: every kill refills the gauge and speeds you up'],
  weaknesses: ['Needs marks before it bursts', 'Weak on a single tough target early in a fight', 'Low defence, short reach outside Reaper\'s Step'],
  signatureWeapon: 'reaper_scythe',
  preset: 'rp',
  anims: RP_ANIMS,
  theme: { color: C, ghost: '#7a3aff', trail: 'shadow' },
  startingGear: { weapon: 'reaper_scythe', armor: 'reaper_shroud' },
  resource: 'nightfall_gauge', // builder: kills, shadow skills, combos, mark explosions (tiers in data/resources.js)
  resources: ['nightfall_gauge'],
  mark: null, // no self mark; Shadow Marks live on enemies
  enemyMark: MARK,
  // Bloodless Night = execute stats (combat/damageSystem.js): +30% shadow damage to foes under 35% HP
  base: { hp: 240, atk: 21, def: 5, crit: 0.08, critDmg: 0, shadowDmg: 0, cdr: 0, speed: 150, nightfallGain: 1, armorBreak: 1, aoe: 0, executeDmg: 0.3, executeAt: 0.35, executeType: 'shadow' },
  perLevel: { hp: 12, atk: 1.6, def: 0.5 },
  defaultLoadout: ['reapers_arc', 'phantom_reap', 'shadow_doppel', 'nightfall_zone'],
  // Nightfall Gauge generation rules (data, not code)
  charge: { basicHit: 2, combo: 6, skillHit: 3, skillCap: 12, markExplosion: 5, kill: 8, harvest: 10 },
  // Death Harvest (passive): a foe dying within `range` of the Reaper
  harvest: { range: 220, haste: 2.5, hasteMult: 1.2 },
  markBonus: 0.25,        // Reaper's Arc: +25% damage per Shadow Mark already on the target
  executeLine: 0.2,       // Funeral Eclipse: non-boss foes under 20% HP are executed
  // Shadow Doppel: which of the Reaper's skills the clone copies
  doppel: { mirror: ['reapers_arc', 'phantom_reap'], delay: 0.18 },
  passives: [
    { id: 'death_harvest', name: 'Death Harvest', desc: 'A foe dying near you (220 px) restores 10 Nightfall Gauge and grants +20% movement speed for 2.5 s. Your own kills give 8 more.' },
    { id: 'bloodless_night', name: 'Bloodless Night', desc: 'Your shadow damage is increased by 30% against foes below 35% HP.' },
  ],
  guideIntro: [
    'Your scythe marks everything it touches with Shadow Marks. REAPER\'S ARC [1] marks a whole pack; PHANTOM REAP [2] dashes through and detonates the marks.',
    'Kills, shadow skills and mark explosions fill the NIGHTFALL GAUGE: at 50 and 80 you hit harder and wider. [Q] REAPER\'S STEP teleports you to a marked foe.',
  ],
  tutorial: { marks: 'Put 3 Shadow Marks on one foe', break: 'Strike with Reaper\'s Step', breakSkill: 'reapers_step' },

  // HUD counter: the most Shadow Marks on a foe within Reaper's Step range
  hudCounter(p) {
    const foes = p.markedFoes(MARK, 300), g = p.game;
    const top = foes.reduce((m, f) => Math.max(m, g.marks.get(f, MARK)), 0);
    return { label: 'SHADOW MARK', value: top, max: 3, color: C, full: PALE, ready: foes.length > 0, readyText: 'REAPER\'S STEP READY — [Q]' };
  },

  markTarget(p, g, t, n = 1) {
    if (!t || t.dead || t.isBreakable) return;
    g.marks.apply(t, MARK, { source: p, stacks: n, sourceClass: 'nightfall_reaper' });
  },

  // MARK EXPLOSION: consume every Shadow Mark on `t` — a burst around it that grows with the stacks.
  // Never applies marks (no chain loops). Returns the stacks consumed.
  explode(p, g, t, mult = 1) {
    const n = g.marks.consume(t, MARK);
    if (!n) return 0;
    const cls = p.cls;
    g.vfx.sprite('rp_vortex', t.x, t.y - 18, rand(0, TAU), { scale: 0.9 + n * 0.25, life: 0.4, glow: 0.6 });
    g.vfx.burst(t.x, t.y - 16, C, 10 + n * 6, 140 + n * 30);
    g.vfx.light(t.x, t.y, 60 + n * 20, C, 0.35, 0.8);
    g.vfx.text(t.x, t.y - (t.height || 30) - 26, n >= 3 ? 'MARK EXPLOSION ×3' : `EXPLOSION ×${n}`, { color: PALE, size: n >= 3 ? 11 : 9 });
    g.audio.sfx(n >= 3 ? 'boom_small' : 'mark');
    g.combat.spawnHitbox({ owner: p, x: t.x, y: t.y, shape: 'circle', r: area(p, 44 + n * 8), power: 0.7 * n * mult, type: 'shadow', knock: 120 + n * 30, stagger: 15 + n * 8, hitStop: 0.05 + n * 0.02, shake: 0.12 + n * 0.06, big: n >= 3 });
    p.gainResource(cls.charge.markExplosion * n);
    return n;
  },

  // NIGHTFALL ZONE (also the ultimate's Eclipse Zone): pulses every 0.5 s — damage, slow, a Shadow Mark
  // every 2nd pulse, marked foes take more; the collapse at the end pulls everything in and roots it.
  zone(p, g, pt, { duration = 4, power = 0.4, radius = 86, collapse = 1.4 } = {}) {
    const cls = p.cls, r = area(p, radius), n = Math.round(duration / 0.5);
    // the pool of night: opens (animated), then stays on the ground until the collapse
    const pool = { scale: r / 30, glow: 0.3, ground: true, squash: 0.55, alpha: 0.75 };
    g.vfx.sprite('rp_portal', pt.x, pt.y, 0, { ...pool, life: 0.45 });
    g.after(0.3, () => g.vfx.sprite('rp_portal', pt.x, pt.y, 0, { ...pool, life: duration - 0.2, frame: 3 }));
    for (let k = 1; k <= n; k++) g.after(k * 0.5, () => {
      if (p.disposed || p.dead) return;
      const last = k === n, feed = feeder(p, 1, 4);
      g.vfx.ring(pt.x, pt.y, r * 0.85, r, { life: 0.5, color: CR, width: 2, fill: true });
      g.vfx.shadowSmoke(pt.x + rand(-r * 0.6, r * 0.6), pt.y + rand(-r * 0.3, r * 0.3), 3, { vy: -35 });
      if (!last) {
        g.combat.spawnHitbox({ owner: p, x: pt.x, y: pt.y, shape: 'circle', r, power, type: 'shadow', knock: 0, stagger: 4, hitStop: 0.02, shake: 0.04,
          powerFor: (t) => power * (1 + 0.2 * marksOn(g, t)),
          onHit: (t) => { if (t.status) t.status.add('slow', 1.0, { source: p }); if (k % 2 === 0) cls.markTarget(p, g, t); feed(); } });
        return;
      }
      // collapse
      g.audio.sfx('boom_small');
      g.camera.shake(0.3);
      g.vfx.sprite('rp_vortex', pt.x, pt.y - 14, 0, { scale: r / 30, life: 0.45, glow: 0.6 });
      g.vfx.text(pt.x, pt.y - 60, 'NIGHTFALL', { color: PALE, size: 11 });
      g.combat.spawnHitbox({ owner: p, x: pt.x, y: pt.y, shape: 'circle', r: r * 1.1, power: collapse, type: 'shadow', knock: 0, stagger: 30, hitStop: 0.08, shake: 0.25,
        onHit: (t) => {
          if (t.knockback && Math.hypot(t.x - pt.x, t.y - pt.y) > 12) t.knockback(Math.atan2(pt.y - t.y, pt.x - t.x), t.superArmor ? 40 : 220);
          if (t.status && !t.isBreakable && !t.isBoss) t.status.add('root', 0.8, { source: p }); // bosses are only pulled
          cls.markTarget(p, g, t);
          feed();
        } });
    });
  },

  // SHADOW DOPPEL: summon (or refresh) the clone beside the Reaper
  summonDoppel(p, g, duration) {
    const a = p.facing + 2.4;
    const s = g.summons.create(p, 'shadow_doppel', p.x + Math.cos(a) * 34, p.y + Math.sin(a) * 34, { duration });
    if (!s) return null;
    g.vfx.sprite('rp_flames', s.x, s.y - 24, 0, { scale: 0.9, life: 0.45, glow: 0.5 });
    g.vfx.shadowSmoke(s.x, s.y, 10, { vy: -40 });
    g.summons.act(s, 'doppel', 0.35);
    return s;
  },

  // what the clone does when it copies a skill (lower damage: summon powerMult)
  echo: {
    reapers_arc(p, g, s) {
      const cls = p.cls, r = area(p, 80), feed = feeder(p, 1, 3);
      g.summons.act(s, 'reapersArc', 0.42);
      g.vfx.sprite('rp_crescent', s.x, s.y - 14, rand(0, TAU), { scale: r / 50, life: 0.3, glow: 0.4 });
      g.vfx.ring(s.x, s.y, r * 0.4, r, { life: 0.25, color: CR, width: 2 });
      g.combat.spawnHitbox({ owner: p, x: s.x, y: s.y - 8, shape: 'circle', r, power: 1.8 * s.powerMult, type: 'shadow', knock: 110, stagger: 12, hitStop: 0.03, shake: 0.08,
        powerFor: (t) => 1.8 * s.powerMult * (1 + cls.markBonus * marksOn(g, t)),
        onHit: (t) => { cls.markTarget(p, g, t); feed(); } });
    },
    phantom_reap(p, g, s) {
      const a = p.aim, sx = s.x, sy = s.y;
      g.summons.act(s, 'phantomReap', 0.35);
      slide(g, s, Math.cos(a) * 130, Math.sin(a) * 130);
      s.facing = a;
      const len = Math.hypot(s.x - sx, s.y - sy);
      g.vfx.sprite('rp_lance', (sx + s.x) / 2, (sy + s.y) / 2 - 14, a, { scale: Math.max(0.8, len / 80), life: 0.3 });
      g.combat.spawnHitbox({ owner: p, x: sx, y: sy - 8, ang: a, shape: 'line', len: len + 16, width: 28, power: 1.6 * s.powerMult, type: 'shadow', knock: 90, stagger: 14, hitStop: 0.04,
        onHit: (t) => p.cls.markTarget(p, g, t) });
    },
  },

  // ---------------- basic: 2 scythe cuts, then a wide shadow sweep (COMBO) that marks everything it hits
  basic(p, g, a, step) {
    const cls = p.cls;
    const defs = [
      { dur: 0.32, at: 0.09, anim: 'atk1', r: 58, half: 1.1, power: 1.0, lunge: 12, type: 'physical', fx: 0.9 },
      { dur: 0.32, at: 0.09, anim: 'atk2', r: 58, half: 1.1, power: 1.1, lunge: 12, type: 'physical', fx: 0.9 },
      { dur: 0.46, at: 0.15, anim: 'atk3', r: 70, half: 1.5, power: 1.6, lunge: 20, type: 'shadow', fx: 1.25, combo: true, knock: 220 },
    ];
    const d = defs[step];
    return {
      name: 'basic' + step, basic: true, step, dur: d.dur, anim: d.anim, moveMul: 0.5, ang: a, cancelAt: 0.05, comboAt: d.at + 0.08,
      lunge: { dist: d.lunge, t0: 0, t1: 0.1 },
      events: [[d.at, () => {
        let comboFed = false;
        g.audio.sfx(d.combo ? 'slash_heavy' : 'swing');
        g.vfx.sprite('rp_crescent', p.x + Math.cos(a) * 30, p.y - 14 + Math.sin(a) * 30, a, { scale: d.fx, life: d.combo ? 0.28 : 0.2, flipY: step === 1 });
        g.combat.spawnHitbox({
          owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: d.combo ? area(p, d.r) : d.r, half: d.half, power: d.power, type: d.type,
          knock: d.knock ?? 100, stagger: 10 + step * 6, hitStop: d.combo ? 0.08 : 0.045, shake: d.combo ? 0.2 : 0.1,
          onHit: (t) => {
            p.gainResource(cls.charge.basicHit);
            if (!d.combo) return;
            cls.markTarget(p, g, t);
            if (!comboFed) { comboFed = true; p.gainResource(cls.charge.combo); }
          },
        });
      }]],
    };
  },

  skills: [
    {
      slot: 1, id: 'reapers_arc', name: 'Reaper\'s Arc', type: 'active', cooldown: 5, cost: 0, targeting: 'self',
      tags: ['aoe', 'shadow', 'mark', 'melee'], icon: 'reaper_arc',
      desc: 'Spin the scythe in a full circle. Places a Shadow Mark on everything hit and deals +25% damage per mark a target already carries.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'reapers_arc', dur: 0.5, anim: 'reapersArc', moveMul: 0.3, ang: a, cancelAt: 0.25,
          events: [[0.16, () => {
            const r = area(p, 92), feed = feeder(p, cls.charge.skillHit, cls.charge.skillCap);
            g.audio.sfx('arc');
            for (let i = 0; i < 4; i++) {
              const q = a + (i * Math.PI) / 2;
              g.after(i * 0.03, () => g.vfx.sprite('rp_crescent', p.x + Math.cos(q) * r * 0.5, p.y - 12 + Math.sin(q) * r * 0.5, q, { scale: r / 62, life: 0.26, glow: 0.45 }));
            }
            g.vfx.ring(p.x, p.y, 12, r, { life: 0.3, color: CR, width: 3 });
            g.vfx.shadowSmoke(p.x, p.y, 8);
            g.combat.spawnHitbox({
              owner: p, x: p.x, y: p.y - 8, shape: 'circle', r, power: 1.8, type: 'shadow', knock: 150, stagger: 20, hitStop: 0.06, shake: 0.2,
              powerFor: (t) => 1.8 * (1 + cls.markBonus * marksOn(g, t)), // bonus is read BEFORE this hit marks it
              onHit: (t) => { cls.markTarget(p, g, t); feed(); },
            });
          }]],
        };
      },
    },
    {
      slot: 2, id: 'phantom_reap', name: 'Phantom Reap', type: 'active', cooldown: 7, cost: 0, targeting: 'direction',
      tags: ['dash', 'shadow', 'multi-hit', 'consumes-marks', 'invulnerable'], icon: 'phantom_reap',
      desc: 'Dash through enemies as a phantom (invulnerable), cutting 3 times along the path. The final reap scales with Shadow Marks and detonates them (Mark Explosion).',
      cast(p, g, a) {
        const cls = p.cls, sx = p.x, sy = p.y, feed = feeder(p, cls.charge.skillHit, cls.charge.skillCap);
        p.beginDodge(a, true);
        g.audio.sfx('dash');
        const pathHit = (power, width, extra = {}) => {
          const len = Math.hypot(p.x - sx, p.y - sy);
          return g.combat.spawnHitbox({ owner: p, x: sx, y: sy - 8, ang: a, shape: 'line', len: len + 20, width, power, type: 'shadow', knock: 30, stagger: 8, hitStop: 0.03, shake: 0.06, ...extra });
        };
        return {
          name: 'phantom_reap', dur: 0.34, anim: 'phantomReap', moveMul: 0, ang: a, cancelAt: 0.34, invuln: [0, 0.32], dash: { ang: a, dist: 150 },
          ghostEvery: 0.03,
          events: [
            [0.08, () => pathHit(0.55, 26, { onHit: feed })],
            [0.15, () => pathHit(0.55, 26, { onHit: feed })],
            [0.22, () => pathHit(0.55, 26, { onHit: feed })],
            [0.3, () => {
              const len = Math.hypot(p.x - sx, p.y - sy);
              g.audio.sfx('slash_heavy');
              g.vfx.sprite('rp_lance', (sx + p.x) / 2, (sy + p.y) / 2 - 14, a, { scale: Math.max(1, len / 70), life: 0.32, glow: 0.5 });
              g.vfx.sprite('rp_spear', p.x + Math.cos(a) * 20, p.y - 14 + Math.sin(a) * 20, a, { scale: 1.1, life: 0.3 });
              pathHit(1.4, 34, {
                knock: 200, stagger: 40, hitStop: 0.1, shake: 0.3, big: true,
                powerFor: (t) => 1.4 + 0.7 * marksOn(g, t), // FINAL REAP: +0.7 power per Shadow Mark
                onHit: (t) => { cls.explode(p, g, t); feed(); },
              });
            }],
          ],
        };
      },
    },
    {
      slot: 3, id: 'shadow_doppel', name: 'Shadow Doppel', type: 'active', cooldown: 16, cost: 20, targeting: 'self',
      tags: ['summon', 'clone', 'shadow'], icon: 'doppel',
      desc: 'Split off a Shadow Clone for 8 s (40% damage). It fights beside you, copies Reaper\'s Arc and Phantom Reap, and marks what it cuts.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'shadow_doppel', dur: 0.45, anim: 'doppel', moveMul: 0.2, ang: a, cancelAt: 0.25,
          events: [[0.15, () => {
            const s = cls.summonDoppel(p, g);
            if (!s) return;
            g.audio.sfx('dash');
            g.vfx.text(p.x, p.y - 76, 'SHADOW DOPPEL', { color: PALE, size: 10 });
            g.after(0.25, () => { if (g.summons.list.includes(s)) cls.echo.reapers_arc(p, g, s); }); // arrives with a spin
          }]],
        };
      },
    },
    {
      slot: 4, id: 'nightfall_zone', name: 'Nightfall Zone', type: 'active', cooldown: 12, cost: 0, targeting: 'point',
      tags: ['zone', 'aoe', 'shadow', 'control', 'mark'], icon: 'nightfall_zone',
      desc: 'Open a pool of night at the cursor for 4 s: it slows, damages and Shadow-Marks foes inside (marked foes take more). It then collapses, pulling foes to the centre and rooting them (bosses are only pulled).',
      cast(p, g, a) {
        const cls = p.cls, pt = aimPoint(p, g, 200);
        return {
          name: 'nightfall_zone', dur: 0.5, anim: 'nightfallZone', moveMul: 0.15, ang: a, cancelAt: 0.3,
          events: [[0.2, () => { g.audio.sfx('cast'); cls.zone(p, g, pt); }]],
        };
      },
    },
    {
      slot: 5, id: 'funeral_eclipse', name: 'Funeral Eclipse', type: 'ultimate', cooldown: 28, cost: 50, targeting: 'self',
      tags: ['ultimate', 'aoe', 'shadow', 'summon', 'consumes-marks', 'execute'], icon: 'funeral_eclipse', ultimate: true,
      desc: 'ULTIMATE (50+ Nightfall — spends it ALL). A black sun rises: an Eclipse Zone and a Shadow Clone appear, every Shadow Mark nearby explodes, then night falls on everything around you — stronger the more gauge you spent. Non-boss foes left under 20% HP are executed.',
      cast(p, g, a) {
        const cls = p.cls, rid = p.primaryResource;
        const spent = this.cost + p.resources.get(rid), k = spent / 100; // cost already paid by the SkillSystem
        return {
          name: 'funeral_eclipse', dur: 1.5, anim: 'funeral', moveMul: 0, ang: a, cancelAt: 99, invuln: [0, 1.5], superArmor: true,
          start: () => {
            p.resources.set(rid, 0, 'skill:funeral_eclipse');
            g.slowMo(0.5, 0.45);
            g.audio.sfx('ult_charge');
            g.vfx.flash('30,0,50', 0.4, 2);
            g.vfx.startEclipse(p.x, p.y, 1.4);
            g.vfx.sprite('rp_blacksun', p.x, p.y - 84, 0, { scale: 1.3, life: 0.95, glow: 0.5 }); // rises above the Reaper ...
          },
          update: (t) => { if (t < 0.9 && Math.random() < 0.5) g.vfx.shadowSmoke(p.x + rand(-40, 40), p.y + rand(-10, 10), 1, { vy: -70 }); },
          events: [
            [0.35, () => {
              cls.zone(p, g, { x: p.x, y: p.y }, { duration: 3, power: 0.5, radius: 120, collapse: 1.2 });
              cls.summonDoppel(p, g, 6);
            }],
            [0.95, () => {
              g.camera.punch(0.28); g.camera.shake(0.9);
              g.hitStop = Math.max(g.hitStop, 0.16);
              g.vfx.flash('200,150,255', 0.5, 2.5);
              g.audio.sfx('ult_slash');
              g.vfx.sprite('rp_blacksun', p.x, p.y - 84, 0, { scale: 1.9, life: 0.6, glow: 0.7 }); // ... and flares
              g.vfx.ring(p.x, p.y, 20, area(p, 180), { life: 0.5, width: 6, color: CR, fill: true });
              g.vfx.burst(p.x, p.y - 20, C, 60, 300);
              g.vfx.light(p.x, p.y, 240, C, 0.6, 1);
              g.vfx.text(p.x, p.y - 96, 'FUNERAL ECLIPSE', { color: PALE, size: 14, life: 1.2 });
              // every Shadow Mark in reach explodes first (stronger than a normal explosion)
              for (const m of p.markedFoes(MARK, area(p, 240))) cls.explode(p, g, m, 1.5);
              const power = 3.0 + 2.0 * k;
              g.combat.spawnHitbox({
                owner: p, x: p.x, y: p.y - 8, shape: 'circle', r: area(p, 170), power, type: 'shadow', knock: 300, stagger: 90, hitStop: 0.18, shake: 0.5, big: true, breakBonus: 1.3,
                powerFor: (t) => (t.isBoss && t.hp / t.maxHp < cls.executeLine ? power * 1.5 : power),
                onHit: (t) => { // EXECUTE: what is left under the line dies (bosses take the bonus above instead)
                  if (t.dead || t.isBoss || t.isBreakable || !t.maxHp || t.hp / t.maxHp >= cls.executeLine) return;
                  g.vfx.text(t.x, t.y - (t.height || 30) - 34, 'EXECUTED', { color: '#ffffff', size: 12 });
                  g.combat.dealDamage(p, t, { power: t.hp * 1.5 + (t.defense || 0) + 10, flat: true, type: 'shadow', knock: 0, big: true, execute: true });
                },
              });
            }],
          ],
          end: () => { g.camera.targetZoom = 1; },
        };
      },
    },
  ],

  // ---------------- REAPER'S STEP (Q / right click) — needs a Shadow-Marked foe in range
  special: {
    id: 'reapers_step', name: 'Reaper\'s Step', type: 'special', slot: 'Q', key: 'Q', icon: 'reaper_step',
    cost: 0, cooldown: 6, targeting: 'target', tags: ['teleport', 'mobility', 'shadow', 'consumes-marks'],
    requirements: [{ type: 'markedFoe', mark: MARK, range: 300, label: 'a Shadow-Marked foe nearby' }],
    desc: 'Step through the shadows to the marked foe nearest your cursor, appear behind it and cut — detonating its Shadow Marks.',
    cast(p, g, a) {
      const cls = p.cls, m = g.mouseWorld();
      const foes = p.markedFoes(MARK, 300).sort((x, y) => Math.hypot(x.x - m.x, x.y - m.y) - Math.hypot(y.x - m.x, y.y - m.y));
      const t = foes[0];
      const through = Math.atan2(t.y - p.y, t.x - p.x); // arrive on the far side of the target
      const back = through + Math.PI;
      return {
        name: 'reapers_step', dur: 0.42, anim: 'reapersStep', moveMul: 0, ang: back, cancelAt: 0.3, invuln: [0, 0.3], superArmor: true,
        start: () => {
          g.vfx.shadowSmoke(p.x, p.y, 12, { vy: -50 });
          g.vfx.sprite('rp_flames', p.x, p.y - 24, 0, { scale: 0.8, life: 0.35 });
          g.audio.sfx('blink');
          const ox = p.x, oy = p.y;
          p.x = t.x; p.y = t.y; // from the target, slide out to its far side (walls stop the slide)
          g.world.map.moveCircle(p, Math.cos(through) * ((t.radius || 10) + 18), Math.sin(through) * ((t.radius || 10) + 18));
          p.vx = p.vy = 0;
          g.vfx.sprite('rp_lance', (ox + p.x) / 2, (oy + p.y) / 2 - 14, through, { scale: Math.max(1, Math.hypot(p.x - ox, p.y - oy) / 80), life: 0.25 });
          g.vfx.shadowSmoke(p.x, p.y, 10, { vy: -40 });
        },
        events: [[0.14, () => {
          g.audio.sfx('slash_heavy');
          g.vfx.sprite('rp_crescent', p.x + Math.cos(back) * 30, p.y - 14 + Math.sin(back) * 30, back, { scale: 1.3, life: 0.28, glow: 0.5 });
          g.combat.spawnHitbox({
            owner: p, x: p.x, y: p.y - 10, ang: back, shape: 'cone', r: area(p, 70), half: 1.0, power: 2.0, type: 'shadow', knock: 160, stagger: 35, hitStop: 0.09, shake: 0.25,
            onHit: (x) => { if (x === t) cls.explode(p, g, x); else cls.markTarget(p, g, x); p.gainResource(cls.charge.skillHit); },
          });
        }]],
      };
    },
  },

  // ---------------- passives: react to core events (see core/events bus)
  on: {
    // DEATH HARVEST — any foe dying near the Reaper feeds the gauge and speeds it up
    enemyKilled(p, g, e) {
      const t = e.target, cls = p.cls;
      if (!t || t.isBreakable || p.dead) return;
      if (e.source === p) p.gainResource(cls.charge.kill);
      if (Math.hypot(t.x - p.x, t.y - p.y) > cls.harvest.range) return;
      p.gainResource(cls.charge.harvest, true);
      p.status.add('haste', cls.harvest.haste, { mult: cls.harvest.hasteMult, refresh: true });
      for (let i = 0; i < 6; i++) g.vfx.particle(t.x + rand(-8, 8), t.y - rand(10, 30), { vx: (p.x - t.x) * 2.2, vy: (p.y - 20 - t.y) * 2.2, color: i % 2 ? C : PALE, life: 0.45, size: 2, drag: 1, add: true });
      g.vfx.text(p.x, p.y - 70, 'HARVEST', { color: PALE, size: 9 });
    },
    // the clone copies chosen skills (class data: doppel.mirror)
    skillUsed(p, g, e) {
      if (e.caster !== p || !p.cls.doppel.mirror.includes(e.skillId)) return;
      for (const s of g.summons.forOwner(p, 'shadow_doppel')) g.after(p.cls.doppel.delay, () => { if (g.summons.list.includes(s)) p.cls.echo[e.skillId](p, g, s); });
    },
    // the clone's own attack: lunge at the nearest foe and cut
    summonReady(p, g, e) {
      const s = e.summon;
      if (e.owner !== p || s.type !== 'shadow_doppel') return;
      const t = nearestFoe(g, s.x, s.y, 170);
      if (!t) return;
      const a = Math.atan2(t.y - s.y, t.x - s.x), d = Math.hypot(t.x - s.x, t.y - s.y);
      if (d > 30) slide(g, s, Math.cos(a) * (d - 26), Math.sin(a) * (d - 26));
      s.facing = a;
      g.summons.act(s, 'atk3', 0.4);
      g.vfx.sprite('rp_crescent', s.x + Math.cos(a) * 26, s.y - 14 + Math.sin(a) * 26, a, { scale: 0.9, life: 0.22 });
      g.audio.sfx('swing');
      g.combat.spawnHitbox({ owner: p, x: s.x, y: s.y - 10, ang: a, shape: 'cone', r: 62, half: 1.2, power: 1.2 * s.powerMult, type: 'shadow', knock: 80, stagger: 10, hitStop: 0.03, shake: 0.06,
        onHit: (x) => { p.cls.markTarget(p, g, x); p.gainResource(1); } });
    },
    // gauge tier reached (data/resources.js tiers) — tell the player
    resourceTier(p, g, e) {
      if (e.entity !== p || e.tier <= e.before || !e.def) return;
      g.vfx.text(p.x, p.y - 82, e.def.label, { color: e.tier >= 1 ? '#ffffff' : PALE, size: e.tier >= 1 ? 13 : 11, life: 1.2 });
      g.vfx.ring(p.x, p.y, 8, 60, { life: 0.4, color: CR, width: 3 });
      g.audio.sfx('mark_full');
    },
    targetMarked(p, g, e) { if (e.source === p && e.markId === MARK && e.stacks >= e.maxStacks) g.world.setFlag('tut_marks'); },
  },
  counterBonus: { resource: 8 }, // data/counter.js
  perfectDodge: { resource: 10, stamina: 10, cooldownCut: 0.8, statuses: [{ id: 'haste', dur: 1.5, mult: 1.3 }] }, // data/dodge.js
};
