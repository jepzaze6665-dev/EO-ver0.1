import { TAU, rand } from '../core/math.js';

// AEGIS GUARDIAN — tank / protector / crowd control. Class = data + behaviour calling core systems:
//   Guard System (hold Q / RMB: block, PERFECT GUARD -> counter) · ResourcePool (guard_gauge)
//   MarkSystem (guardian_mark on enemies) · StatusSystem (taunted, stun, shield, damage_reduction)
// Gameplay loop: Challenge (taunt + mark) → Guard → Block → Guard Gauge → Perfect Guard → Counter
//                → Holy Barrier → Guardian Slash judges marked foes → Aegis Ascension
// Nothing in the core knows this file exists; passives react to bus events through `on`.

const GOLD = '#ffd070', HOLY = '255,220,140', BLUE = '120,180,255';

// every base move comes from the AG NEW sheets, so the shield is always there (one consistent design)
//   bob: code-driven step bounce in px — the AG walk art barely moves its legs, the bounce sells the step
export const AG_ANIMS = {
  idle: { sheet: 'idle', cols: [0, 1, 2, 3, 4, 5], fps: 4, loop: true }, // breathing
  walk: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 8, loop: true, bob: 2 },
  run: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 12, loop: true, bob: 3 },
  atk1: { sheet: 'atk1', cols: [1, 2] },          // overhead cut
  atk2: { sheet: 'atk2', cols: [1, 2, 3] },       // thrust
  atk3: { sheet: 'atk1', cols: [2, 3, 3, 4] },    // full sweeping arc
  dodge: { sheet: 'walk', cols: [2, 3, 4] },
  guard: { sheet: 'guard', cols: [3] },           // shield square to the front in all 4 directions
  shieldBash: { sheet: 'sk1', cols: [1, 2, 3, 4] },
  guardianSlash: { sheet: 'sk2', cols: [1, 2, 3, 4] },
  challenge: { sheet: 'sk4', cols: [1, 2, 3, 3, 4] },
  barrier: { sheet: 'sk5', cols: [1, 2, 3, 3, 4] },
  counter: { sheet: 'sk6', cols: [3, 3, 4, 4] },  // golden flash on the shield -> riposte
  perfectGuard: { sheet: 'parry', cols: [2, 3, 4] },
  ascension: { sheet: 'ult', cols: [1, 2, 2, 3, 3, 4] },
  hurt: { sheet: 'hit', cols: [2, 3] },
  death: { sheet: 'hit', cols: [2, 3, 3] },
};

const front = (p, d) => ({ x: p.x + Math.cos(p.aim) * d, y: p.y - 14 + Math.sin(p.aim) * d });
const swingFx = (p, g, a, r, scale) => g.vfx.sprite('ag_crescent', p.x + Math.cos(a) * r, p.y - 14 + Math.sin(a) * r, a, { scale, life: 0.24 });

export const AegisGuardian = {
  id: 'aegis_guardian',
  stableId: 'class_aegis_guardian',
  name: 'Aegis Guardian',
  role: 'Tank · Protector · Crowd Control',
  difficulty: 3,
  ratings: { damage: 2, range: 2, defense: 5, mobility: 2, support: 5 },
  description: 'The heart of the party\'s defence: taunts, blocks, and turns every perfect guard into a counter.',
  identity: 'Stand in front. Take the blow. Answer it.',
  strengths: ['Highest survivability: block, shields, damage reduction', 'Taunt and crowd control', 'Protects the party (barriers)'],
  weaknesses: ['Lowest damage', 'Slow on its feet', 'Must face the danger to block it'],
  signatureWeapon: 'aegis_shield',
  preset: 'ag',
  anims: AG_ANIMS,
  theme: { color: GOLD, ghost: '#ffd070', trail: 'shadow' },
  resource: 'guard_gauge',
  resources: ['guard_gauge'],
  mark: null,
  enemyMark: 'guardian_mark',
  base: { hp: 330, atk: 20, def: 13, crit: 0.04, critDmg: 0, holyDmg: 0, cdr: 0, speed: 138, guardGain: 1, armorBreak: 1.2 },
  perLevel: { hp: 16, atk: 1.2, def: 0.8 },
  startingGear: { weapon: 'aegis_shield', armor: 'aegis_plate' },
  defaultLoadout: ['shield_bash', 'guardian_slash', 'guardian_challenge', 'holy_barrier'],
  // Guard System data (combat/guardSystem.js)
  guard: { arc: 1.25, reduction: 0.75, perfectWindow: 0.2, moveMul: 0.4, recover: 0.3, fx: 'ag_emblem' },
  // Guard Gauge generation rules (data, not code)
  charge: { basicHit: 3, block: 10, perfectGuard: 30, markedHitMe: 5, bash: 6, taunt: 5, judgment: 10 },
  tutorial: { marks: 'Taunt a foe with Guardian Mark', perfect: 'Perform a Perfect Guard', break: 'Raise a Holy Barrier', breakSkill: 'holy_barrier' },
  guideIntro: [
    'Your shield is your weapon. HOLD [Q / Right Click] to guard: frontal hits are blocked and fill your Guard Gauge.',
    'Raise the guard right before a blow lands for a PERFECT GUARD — no damage and an instant counter. Taunt foes with Guardian Challenge [3].',
  ],

  hudCounter(p) {
    // how many foes currently carry your Guardian Mark (taunted)
    let n = 0;
    for (const m of p.game.world.hostiles()) if (p.game.marks.get(m, 'guardian_mark')) n++;
    return { label: 'GUARDIAN MARK', value: Math.min(3, n), max: 3, color: GOLD, full: '#fff0b0', ready: false };
  },

  // mark + taunt one enemy (MarkSystem + StatusSystem)
  markTarget(p, g, t) {
    if (!t || t.dead || t.isBreakable) return;
    g.marks.apply(t, 'guardian_mark', { source: p, sourceClass: 'aegis_guardian' });
    if (t.status) t.status.add('taunted', 8, { source: p, refresh: true });
  },

  // ---------------- basic: 2 sword cuts + a wide spinning slash
  basic(p, g, a, step) {
    const cls = p.cls;
    const defs = [
      { dur: 0.36, at: 0.1, anim: 'atk1', r: 56, half: 1.0, power: 1.2, lunge: 12 },
      { dur: 0.36, at: 0.1, anim: 'atk2', r: 56, half: 1.0, power: 1.25, lunge: 12 },
      { dur: 0.5, at: 0.18, anim: 'atk3', r: 70, half: 2.6, power: 1.8, lunge: 6, knock: 200 },
    ];
    const d = defs[step];
    return {
      name: 'basic' + step, basic: true, step, dur: d.dur, anim: d.anim, moveMul: 0.4, ang: a, cancelAt: 0.06, comboAt: d.at + 0.08,
      lunge: { dist: d.lunge, t0: 0, t1: 0.1 },
      events: [[d.at, () => {
        g.audio.sfx(step === 2 ? 'slash_heavy' : 'swing');
        swingFx(p, g, a, 30, step === 2 ? 1.1 : 0.75);
        g.combat.spawnHitbox({
          owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: d.r, half: d.half, power: d.power, type: 'physical',
          knock: d.knock ?? 110, stagger: 12 + step * 8, hitStop: step === 2 ? 0.08 : 0.05, shake: step === 2 ? 0.2 : 0.1,
          onHit: () => p.gainResource(cls.charge.basicHit),
        });
      }]],
    };
  },

  skills: [
    {
      id: 'shield_bash', name: 'Shield Bash', type: 'active', cooldown: 5, cost: 0, targeting: 'direction',
      tags: ['melee', 'stun', 'mark', 'control'], icon: 'shield_bash',
      desc: 'Slam forward with the shield: stuns and places a Guardian Mark (taunt) on everything hit.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'shield_bash', dur: 0.42, anim: 'shieldBash', moveMul: 0.1, ang: a, cancelAt: 0.25, superArmor: true,
          lunge: { dist: 42, t0: 0.04, t1: 0.16 },
          events: [[0.16, () => {
            g.audio.sfx('crash');
            g.camera.shake(0.25);
            g.vfx.sprite('ag_bash', p.x + Math.cos(a) * 34, p.y - 16 + Math.sin(a) * 34, a, { scale: 1.1, life: 0.3, glow: 0.5 });
            g.combat.spawnHitbox({
              owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 66, half: 0.9, power: 1.5, type: 'physical', knock: 230, stagger: 40, hitStop: 0.09, shake: 0.2,
              onHit: (t) => { if (t.status && !t.isBreakable) t.status.add('stun', 0.8, { source: p }); cls.markTarget(p, g, t); p.gainResource(cls.charge.bash); },
            });
          }]],
        };
      },
    },
    {
      id: 'guardian_slash', name: 'Guardian Slash', type: 'active', cooldown: 4, cost: 0, targeting: 'direction',
      tags: ['melee', 'aoe', 'holy', 'consumes-marks'], icon: 'guardian_slash',
      desc: 'A wide holy crescent. Foes carrying your Guardian Mark are JUDGED: the mark is consumed for heavy bonus holy damage and Guard Gauge.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'guardian_slash', dur: 0.46, anim: 'guardianSlash', moveMul: 0.3, ang: a, cancelAt: 0.24,
          events: [[0.18, () => {
            g.audio.sfx('arc');
            for (let i = 0; i < 2; i++) g.after(i * 0.06, () => swingFx(p, g, a, 40 + i * 26, 1.3 + i * 0.3));
            g.combat.spawnHitbox({
              owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 92, half: 1.2, power: 1.9, type: 'holy', knock: 150, stagger: 22, hitStop: 0.06, shake: 0.18,
              onHit: (t) => {
                if (!g.marks.get(t, 'guardian_mark')) return;
                g.marks.consume(t, 'guardian_mark');
                g.combat.dealDamage(p, t, { power: 1.6, type: 'holy', knock: 60, hitStop: 0.05, big: true });
                g.vfx.text(t.x, t.y - (t.height || 30) - 18, 'JUDGMENT', { color: '#fff0b0', size: 10 });
                g.vfx.sprite('ag_flash', t.x, t.y - 18, 0, { scale: 0.8, life: 0.3, glow: 0.6 });
                p.gainResource(cls.charge.judgment);
              },
            });
          }]],
        };
      },
    },
    {
      id: 'guardian_challenge', name: 'Guardian Challenge', type: 'active', cooldown: 12, cost: 0, targeting: 'self',
      tags: ['taunt', 'aoe', 'mark', 'defense'], icon: 'challenge',
      desc: 'A war cry: every foe nearby is TAUNTED (Guardian Mark, -20% damage) and must fight you. You take 30% less damage for 4 s.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'guardian_challenge', dur: 0.55, anim: 'challenge', moveMul: 0, ang: a, cancelAt: 0.35, superArmor: true,
          events: [[0.22, () => {
            g.audio.sfx('taunt');
            g.camera.shake(0.3);
            g.vfx.sprite('ag_beacon', p.x, p.y - 6, 0, { scale: 2.2, life: 0.5, glow: 0.4 });
            g.vfx.ring(p.x, p.y, 20, 165, { life: 0.45, color: HOLY, width: 3 });
            p.status.add('damage_reduction', 4, { mult: 0.7, source: p, refresh: true });
            let n = 0;
            for (const m of g.world.hostiles()) {
              if (m.dead || m.isBreakable || Math.hypot(m.x - p.x, m.y - p.y) > 165) continue;
              cls.markTarget(p, g, m); n++;
              g.vfx.text(m.x, m.y - (m.height || 30) - 12, '!', { color: GOLD, size: 13 });
            }
            if (n) p.gainResource(cls.charge.taunt * n);
          }]],
        };
      },
    },
    {
      id: 'holy_barrier', name: 'Holy Barrier', type: 'active', cooldown: 16, cost: 40, targeting: 'self',
      tags: ['barrier', 'shield', 'defense', 'support'], icon: 'barrier',
      desc: 'Raise a holy dome: a shield worth 35% of max HP for 6 s, heals 8% and pushes enemies away. (Party members will share it.)',
      cast(p, g, a) {
        return {
          name: 'holy_barrier', dur: 0.6, anim: 'barrier', moveMul: 0, ang: a, cancelAt: 0.4, superArmor: true,
          events: [[0.25, () => {
            g.audio.sfx('shrine');
            g.vfx.sprite('ag_dome', p.x, p.y - 22, 0, { scale: 1.5, life: 0.6, glow: 0.5 });
            g.vfx.flash(HOLY, 0.2, 4);
            p.status.add('shield', 6, { amount: Math.round(p.maxHp * 0.35), source: p, refresh: true });
            p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.08);
            g.vfx.text(p.x, p.y - 74, 'HOLY BARRIER', { color: '#fff0b0', size: 11 });
            g.events.emit('barrierCreated', { owner: p, amount: Math.round(p.maxHp * 0.35) });
            g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 8, shape: 'circle', r: 84, power: 0.6, type: 'holy', knock: 300, stagger: 30, hitStop: 0.04 });
          }]],
        };
      },
    },
    {
      slot: 5, id: 'aegis_ascension', name: 'Aegis Ascension', type: 'ultimate', cooldown: 30, cost: 70, targeting: 'self',
      tags: ['ultimate', 'aoe', 'taunt', 'defense', 'holy'], icon: 'aegis', ultimate: true,
      desc: 'ULTIMATE. Ascend behind a colossal holy shield: a crushing slam taunts everything nearby, then for 8 s you take 50% less damage and deal 25% more.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'aegis_ascension', dur: 1.0, anim: 'ascension', moveMul: 0, ang: a, cancelAt: 99, invuln: [0, 1.0], superArmor: true,
          start: () => { g.slowMo(0.5, 0.4); g.audio.sfx('ult_charge'); g.vfx.flash('60,50,20', 0.3, 2); },
          events: [
            [0.2, () => g.vfx.sprite('ag_aegis', p.x, p.y - 30, 0, { scale: 2.4, life: 0.8, glow: 0.6 })],
            [0.62, () => {
              g.audio.sfx('slam_big');
              g.camera.punch(0.25); g.camera.shake(0.8);
              g.vfx.flash('255,240,190', 0.45, 2.5);
              g.vfx.ring(p.x, p.y, 20, 200, { life: 0.5, width: 6, color: HOLY, fill: true });
              g.vfx.light(p.x, p.y, 230, GOLD, 0.6, 1);
              g.vfx.text(p.x, p.y - 90, 'AEGIS ASCENSION', { color: '#fff0b0', size: 14, life: 1.2 });
              p.status.add('damage_reduction', 8, { mult: 0.5, source: p, refresh: true });
              p.status.add('surge', 8, { mult: 1.25, source: p, refresh: true });
              for (const m of g.world.hostiles()) if (!m.dead && !m.isBreakable && Math.hypot(m.x - p.x, m.y - p.y) < 200) cls.markTarget(p, g, m);
              g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 8, shape: 'circle', r: 130, power: 3.2, type: 'holy', knock: 320, stagger: 80, hitStop: 0.16, shake: 0.5, big: true, breakBonus: 1.3 });
            }],
          ],
        };
      },
    },
  ],

  // ---------------- AEGIS GUARD (hold Q / right click) — the Guard System; tapping from code raises it too
  special: {
    id: 'aegis_guard', name: 'Aegis Guard', type: 'special', slot: 'Q', key: 'Q', icon: 'guard',
    cost: 0, cooldown: 0.1, targeting: 'self', tags: ['guard', 'block', 'defense', 'hold'], hold: true,
    desc: 'HOLD to guard: frontal hits deal 75% less and fill the Guard Gauge. Raise it just before a blow for a PERFECT GUARD: no damage + instant counter.',
    cast(p) { p.setGuard(true); return null; },
  },

  // Perfect Guard: automatic counter strike (sk6 animation)
  onPerfectGuard(p, g, src) {
    const cls = p.cls, a = src ? Math.atan2(src.y - p.y, src.x - p.x) : p.aim;
    p.gainResource(cls.charge.perfectGuard, true);
    p.startAction({
      name: 'guard_counter', dur: 0.42, anim: 'counter', moveMul: 0, ang: a, cancelAt: 0.3, superArmor: true, invuln: [0, 0.2],
      events: [[0.1, () => {
        g.audio.sfx('counter');
        g.vfx.sprite('ag_flash', p.x + Math.cos(a) * 30, p.y - 16 + Math.sin(a) * 30, a, { scale: 1.1, life: 0.3, glow: 0.6 });
        g.combat.spawnHitbox({
          owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 76, half: 1.0, power: 2.4, type: 'holy', forceCrit: true, knock: 260, stagger: 60, hitStop: 0.1, shake: 0.3,
          onHit: (t) => { if (t.status && !t.isBreakable) t.status.add('stun', 1.0, { source: p }); cls.markTarget(p, g, t); },
        });
      }]],
    });
  },
  onGuardBlock(p) { p.gainResource(p.cls.charge.block); },
  onPerfectDodge(p, g) { p.gainResource(10, true); p.reduceCooldowns(0.5); },

  on: {
    // taunted foes that still hit the Guardian feed the gauge
    damageTaken(p, g, e) {
      if (e.target === p && e.source && e.amount > 0 && g.marks.get(e.source, 'guardian_mark')) p.gainResource(p.cls.charge.markedHitMe);
    },
    targetMarked(p, g, e) { if (e.source === p && e.markId === 'guardian_mark') g.world.setFlag('tut_marks'); },
  },
};
