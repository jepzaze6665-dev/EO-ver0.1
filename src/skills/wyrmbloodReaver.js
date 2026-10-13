import { rand } from '../core/math.js';

// WYRMBLOOD REAVER — secret class of the Umbral line (Varkharon's blood). High-risk melee duelist.
// Class = data + behaviour that only CALLS core systems:
//   SkillSystem `hpCost` (skills are paid with your own HP — Player.spendHp, never below 1) · ResourcePool ('wyrm_fury' +
//   tiers = DRAGON'S BLOOD) · StatusSystem (blood_pact, blood_awaken = flag 'deathless', bleed, burn, shield) · Combat
//   Player hooks: hitMult (passive DRAGON'S THIRST), noEndure + potionMult (passive CURSED VEIN)
// Gameplay loop: pay HP to cast → land the hits to drink it back → keep HP LOW (30-50%) where every blow is stronger →
//   burned HP becomes WYRM FURY → Vein Burst (Q) cashes it in as a heal-nova, the ultimate makes you deathless.
// One heavy mistake at low HP kills you: no Endure safety net, potions work at 60%.

const C = '#ff3a3a', CR = '255,58,58', PALE = '#ffd0c0', EMBER = '#ff9a40';
const F = 'wyrm_fury';

// animation table for the 'wr' preset (tools/build-player.js wr -> assets/player/wr). Every sheet: col 0 = neutral,
// 1 = wind-up, 2-4 = action, 5 = recovery. No idle sheet: idle = the walk sheet's first pose.
export const WR_ANIMS = {
  idle: { sheet: 'walk', cols: [0], fps: 2, loop: true },
  walk: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 10, loop: true },
  run: { sheet: 'walk', cols: [0, 1, 2, 3, 4, 5], fps: 14, loop: true },
  atk1: { sheet: 'atk1', cols: [1, 2, 3, 4] },
  atk2: { sheet: 'atk2', cols: [1, 2, 3, 4] },
  atk3: { sheet: 'sk2', cols: [1, 3, 4] },                 // heavy cleave finisher
  dodge: { sheet: 'dash', cols: [1, 2, 3, 4] },
  crimsonFang: { sheet: 'sk1', cols: [1, 2, 3, 4] },
  wyrmRend: { sheet: 'sk2', cols: [1, 2, 3, 3, 4] },
  bloodPact: { sheet: 'sk3', cols: [1, 2, 3, 3, 4] },
  scaleShed: { sheet: 'sk4', cols: [1, 2, 3, 3, 4] },
  cinderVein: { sheet: 'sk5', cols: [1, 2, 3, 4] },
  hemorrhage: { sheet: 'sk6', cols: [1, 2, 3, 3, 4] },
  veinBurst: { sheet: 'sk7', cols: [1, 2, 3, 3, 4] },
  awakening: { sheet: 'ult', cols: [1, 2, 3, 3, 4] },
  hurt: { sheet: 'hit', cols: [1, 2] },
  death: { sheet: 'hit', cols: [1, 2, 3, 4] },
};

// ---- helpers (class-local)
const hpRatio = (p) => (p.maxHp ? p.hp / p.maxHp : 1);
// DRAGON'S THIRST: the lower your HP, the harder and the thirstier you are ([[below, value], ...])
function thirst(p, table) {
  const r = hpRatio(p);
  for (const [below, v] of table) if (r < below) return v;
  return 1;
}
// heal a share of the damage a hit dealt (scaled by Dragon's Thirst), capped per hit
function drink(p, info, share, reason = 'drain') {
  if (!info || !(info.amount > 0) || p.dead) return 0;
  const cls = p.cls, amt = Math.min(info.amount * share * thirst(p, cls.thirst.drain), p.maxHp * cls.thirst.capPerHit);
  return p.heal(amt, reason);
}
// a status dot from this player: data.damage = share of ATK per tick
const dotDamage = (p, share) => Math.max(1, Math.round(((p.stats && p.stats.atk) || 0) * share));
// fx anchored on the ground under (x, y): a front-view strip whose content ends at the bottom of its frame
function standFx(g, key, x, y, scale, o = {}) {
  const fh = { wr_scale: 172, wr_hemo: 206, wr_burst: 194, wr_dragon: 236, wr_pact: 252 }[key] || 160;
  return g.vfx.sprite(key, x, y + 6 - (fh * scale) / 2, 0, { scale, ...o });
}

export const WyrmbloodReaver = {
  id: 'wyrmblood_reaver',
  stableId: 'class_wyrmblood_reaver',
  name: 'Wyrmblood Reaver',
  role: 'Secret Class · Blood Duelist · Sustain DPS',
  difficulty: 5,
  ratings: { damage: 4, range: 1, defense: 1, mobility: 3, support: 1 },
  description: "An Umbral blade who drank the Cinder King's blood: every skill is paid with his own life, and every wound he deals pays it back.",
  identity: 'Bleed to win. The closer to death, the deadlier.',
  strengths: ['Heals himself with every hit — long fights without potions', 'Low HP = more damage and more life drain (Dragon\'s Thirst)', 'Strong single-target pressure on bosses'],
  weaknesses: ['Skills cost HP: a missed combo leaves you weak', 'No Endure — a big hit at low HP kills outright', 'Potions heal only 60%'],
  signatureWeapon: 'Twin Cinderfangs',
  preset: 'wr',
  anims: WR_ANIMS,
  theme: { color: C, ghost: '#a01818', trail: 'shadow' },
  resource: F, // builder: HP spent on skills (furyPerHpPct), basic hits, perfect dodges
  resources: [F],
  mark: null,
  base: { hp: 245, atk: 21, def: 4, crit: 0.12, critDmg: 0, physicalDmg: 0, cdr: 0, speed: 154, furyGain: 1, armorBreak: 1, attackSpeed: 0 },
  perLevel: { hp: 11, atk: 1.6, def: 0.4 },
  defaultLoadout: ['crimson_fang', 'wyrm_rend', 'blood_pact', 'scale_shed'],
  // passive CURSED VEIN (Player reads these): no Endure, potions heal 60%
  noEndure: true,
  potionMult: 0.6,
  // WYRM FURY rules (data)
  fury: { perHpPct: 1.2, basicHit: 1, perfectDodge: 10 },
  // DRAGON'S THIRST: damage and drain by HP share ([[below, mult], ...], first match wins)
  thirst: { damage: [[0.3, 1.4], [0.5, 1.2]], drain: [[0.3, 2], [0.5, 1.4]], capPerHit: 0.05 },
  // skill numbers (data, read by the casts)
  fang: { power: 1.7, drain: 0.4, dist: 135 },
  rend: { power: 2.2, perMissing: 1.0, maxBonus: 0.7, drain: 0.25 },
  pact: { duration: 6, basicDrain: 0.15 },
  scale: { share: 0.18, duration: 5 },
  cinder: { power: 0.9, burn: 4, burnPower: 0.18, burnHeal: 0.3 },
  hemo: { radius: 140, power: 1.0, perStack: 0.6, drain: 0.3 },
  burst: { minFury: 30, radius: 115, power: 1, perFury: 0.02, healPerFury: 0.002 },
  awaken: { duration: 6, drain: 0.3, finale: 2.6, radius: 135 },
  bleed: { time: 4, power: 0.12 },
  passives: [
    { id: 'dragons_thirst', name: "Dragon's Thirst", desc: 'Below 50% HP your hits deal +20% damage and drain 40% more life; below 30% HP +40% damage and double drain.' },
    { id: 'cursed_vein', name: 'Cursed Vein', desc: 'The dragon blood has a price: no Endure (a hit at full health can kill you) and potions heal only 60%.' },
  ],
  guideIntro: [
    'Your skills cost HP, not mana. Every 1% of HP you pay becomes WYRM FURY. Your hits drink life back — keep attacking to stay alive.',
    'Below 50% HP you hit harder and drink more (DRAGON\'S THIRST). [Q] VEIN BURST spends all Fury in a blast that heals you. Watch out: no Endure, potions heal only 60%.',
  ],
  tutorial: { marks: 'Reach 50 Wyrm Fury (BLOODBOIL)', break: 'Use Vein Burst', breakSkill: 'vein_burst' },

  // HUD counter: Fury tier as 3 diamonds
  hudCounter(p) {
    const k = p.resources.tier(F);
    return { label: 'WYRM FURY', value: k + 1, max: 3, color: C, full: PALE, ready: p.resources.get(F) >= p.cls.burst.minFury, readyText: p.status.has('blood_awaken') ? 'DRAGON BLOOD' : 'VEIN BURST READY' };
  },
  // passive DRAGON'S THIRST (Player.gearHitMult calls this for every direct hit)
  hitMult(p) { return thirst(p, p.cls.thirst.damage); },

  // ---------------- basic: two quick blade cuts, then a heavy cleave that makes the foe BLEED
  basic(p, g, a, step) {
    const cls = p.cls;
    const defs = [
      { dur: 0.28, at: 0.08, anim: 'atk1', r: 52, half: 1.0, power: 0.95, lunge: 14 },
      { dur: 0.28, at: 0.08, anim: 'atk2', r: 52, half: 1.0, power: 1.0, lunge: 14 },
      { dur: 0.4, at: 0.15, anim: 'atk3', r: 62, half: 1.2, power: 1.5, lunge: 26, combo: true, knock: 150 },
    ];
    const d = defs[step];
    return {
      name: 'basic' + step, basic: true, step, dur: d.dur, anim: d.anim, moveMul: 0.55, ang: a, cancelAt: 0.05, comboAt: d.at + 0.06,
      lunge: { dist: d.lunge, t0: 0, t1: 0.1 },
      events: [[d.at, () => {
        g.audio.sfx(d.combo ? 'slash_heavy' : 'swing');
        g.vfx.sprite('wr_slash', p.x + Math.cos(a) * (d.combo ? 50 : 44), p.y - 14 + Math.sin(a) * (d.combo ? 50 : 44), a, { scale: d.combo ? 0.8 : 0.55, life: 0.2, flipY: step === 1, glow: 0.35 });
        g.combat.spawnHitbox({
          owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: d.r, half: d.half, power: d.power, type: 'physical',
          knock: d.knock ?? 60, stagger: 8 + step * 7, hitStop: d.combo ? 0.07 : 0.035, shake: d.combo ? 0.15 : 0.07,
          onHit: (t, info) => {
            p.gainResource(cls.fury.basicHit);
            if (p.status.has('blood_pact')) drink(p, info, cls.pact.basicDrain);
            if (d.combo && t.status && !t.dead) t.status.add('bleed', cls.bleed.time, { source: p, damage: dotDamage(p, cls.bleed.power) });
          },
        });
      }]],
    };
  },

  skills: [
    {
      slot: 1, id: 'crimson_fang', tier: 'fast', name: 'Crimson Fang', type: 'active', cooldown: 5, cost: 0, hpCost: 0.06, targeting: 'direction',
      tags: ['dash', 'mobility', 'drain', 'bleed'], icon: 'crimson_fang',
      desc: 'Pay 6% HP: dash THROUGH enemies with a blood-red bite. Drinks back 40% of the damage dealt and makes every foe hit bleed.',
      cast(p, g, a) {
        const cls = p.cls, f = cls.fang, from = { x: p.x, y: p.y };
        p.beginDodge(a, true);
        g.audio.sfx('dash');
        return {
          name: 'crimson_fang', dur: 0.32, anim: 'crimsonFang', moveMul: 0, ang: a, cancelAt: 0.3, invuln: [0, 0.24], dash: { ang: a, dist: f.dist },
          ghostEvery: 0.03,
          events: [[0.22, () => {
            const len = Math.hypot(p.x - from.x, p.y - from.y);
            g.audio.sfx('slash_heavy');
            g.vfx.sprite('wr_fang', (from.x + p.x) / 2, (from.y + p.y) / 2 - 14, a, { scale: Math.min(1.3, Math.max(0.6, len / 120)), life: 0.28, glow: 0.5 });
            g.combat.spawnHitbox({
              owner: p, x: from.x, y: from.y - 8, ang: a, shape: 'line', len: len + 20, width: 30, power: f.power, type: 'physical', knock: 80, stagger: 20, hitStop: 0.06, shake: 0.14,
              onHit: (t, info) => {
                drink(p, info, f.drain);
                if (t.status && !t.dead) t.status.add('bleed', cls.bleed.time, { source: p, damage: dotDamage(p, cls.bleed.power) });
              },
            });
          }]],
        };
      },
    },
    {
      slot: 2, id: 'wyrm_rend', tier: 'medium', name: 'Wyrm Rend', type: 'active', cooldown: 7, cost: 0, hpCost: 0.1, targeting: 'direction',
      tags: ['melee', 'burst', 'drain'], icon: 'wyrm_rend',
      desc: 'Pay 10% HP: a crushing overhead cleave. +1% damage for every 1% HP you are missing (up to +70%), drinks back 25%.',
      cast(p, g, a) {
        const cls = p.cls, r = cls.rend;
        const power = r.power * (1 + Math.min(r.maxBonus, (1 - hpRatio(p)) * r.perMissing));
        return {
          name: 'wyrm_rend', dur: 0.62, anim: 'wyrmRend', moveMul: 0.15, ang: a, cancelAt: 0.4, lunge: { dist: 22, t0: 0.15, t1: 0.3 },
          events: [[0.36, () => {
            g.audio.sfx('slash_heavy');
            g.camera.shake(0.25);
            g.vfx.sprite('wr_rend', p.x + Math.cos(a) * 38, p.y - 14 + Math.sin(a) * 38, a, { scale: 0.9, life: 0.3, glow: 0.6 });
            g.combat.spawnHitbox({
              owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 84, half: 0.85, power, type: 'physical', knock: 170, stagger: 45, hitStop: 0.1, shake: 0.25, big: true,
              onHit: (t, info) => drink(p, info, r.drain),
            });
          }]],
        };
      },
    },
    {
      slot: 3, id: 'blood_pact', tier: 'fast', name: 'Blood Pact', type: 'active', cooldown: 14, cost: 0, hpCost: 0.2, targeting: 'self',
      tags: ['buff', 'drain', 'attack-speed'], icon: 'blood_pact',
      desc: 'Pay 20% HP: blood turns to flame for 6 s — +30% attack speed and your basic attacks drink back 15% of their damage.',
      cast(p, g, a) {
        const cls = p.cls;
        return {
          name: 'blood_pact', dur: 0.4, anim: 'bloodPact', moveMul: 0.4, ang: a, cancelAt: 0.3,
          events: [[0.2, () => {
            p.status.add('blood_pact', cls.pact.duration, { source: p, refresh: true });
            g.audio.sfx('blink');
            g.vfx.burst(p.x, p.y - 24, C, 18, 140);
            g.vfx.text(p.x, p.y - 72, 'BLOOD PACT', { color: PALE, size: 10 });
          }]],
        };
      },
    },
    {
      slot: 4, id: 'scale_shed', tier: 'fast', name: 'Scale Shed', type: 'active', cooldown: 12, cost: 0, hpCost: 0.1, targeting: 'self',
      tags: ['shield', 'defense'], icon: 'scale_shed',
      desc: 'Pay 10% HP: crimson dragon scales lock around you — a shield of 18% max HP for 5 s.',
      cast(p, g, a) {
        const cls = p.cls, s = cls.scale;
        return {
          name: 'scale_shed', dur: 0.36, anim: 'scaleShed', moveMul: 0.3, ang: a, cancelAt: 0.25,
          events: [[0.16, () => {
            p.status.add('shield', s.duration, { amount: Math.round(p.maxHp * s.share), source: p, refresh: true });
            g.audio.sfx('block');
            standFx(g, 'wr_scale', p.x, p.y, 0.45, { life: 0.6, glow: 0.4, alpha: 0.85 });
            g.vfx.text(p.x, p.y - 72, 'SCALE SHED', { color: PALE, size: 10 });
          }]],
        };
      },
    },
    {
      id: 'cinder_vein', tier: 'medium', name: 'Cinder Vein', type: 'active', cooldown: 8, cost: 0, hpCost: 0.08, targeting: 'direction',
      tags: ['aoe', 'burn', 'drain'], icon: 'cinder_vein',
      desc: 'Pay 8% HP: fling a cone of burning blood. Every foe hit BURNS for 4 s, and each burn tick you caused heals you for 30% of it.',
      cast(p, g, a) {
        const cls = p.cls, c = cls.cinder;
        return {
          name: 'cinder_vein', dur: 0.46, anim: 'cinderVein', moveMul: 0.3, ang: a, cancelAt: 0.35,
          events: [[0.22, () => {
            g.audio.sfx('cast');
            g.vfx.sprite('wr_cinder', p.x + Math.cos(a) * 52, p.y - 14 + Math.sin(a) * 52, a, { scale: 0.9, life: 0.34, glow: 0.5 });
            g.combat.spawnHitbox({
              owner: p, x: p.x, y: p.y - 10, ang: a, shape: 'cone', r: 110, half: 0.6, power: c.power, type: 'physical', knock: 60, stagger: 12, hitStop: 0.04, shake: 0.1,
              onHit: (t) => { if (t.status && !t.dead) t.status.add('burn', c.burn, { source: p, damage: dotDamage(p, c.burnPower) }); },
            });
          }]],
        };
      },
    },
    {
      id: 'hemorrhage', tier: 'medium', name: 'Hemorrhage', type: 'active', cooldown: 10, cost: 0, hpCost: 0.12, targeting: 'self',
      tags: ['aoe', 'bleed', 'burst', 'drain'], icon: 'hemorrhage',
      desc: 'Pay 12% HP: rip the blood out of every foe around you. Each one takes more damage for every BLEED stack it carries (the bleeding ends), and you drink back 30%.',
      cast(p, g, a) {
        const cls = p.cls, h = cls.hemo;
        return {
          name: 'hemorrhage', dur: 0.5, anim: 'hemorrhage', moveMul: 0.2, ang: a, cancelAt: 0.4,
          events: [[0.26, () => {
            g.audio.sfx('slash_heavy');
            g.camera.shake(0.2);
            standFx(g, 'wr_hemo', p.x, p.y, 0.55, { life: 0.4, glow: 0.5 });
            g.combat.spawnHitbox({
              owner: p, x: p.x, y: p.y - 8, shape: 'circle', r: h.radius, power: h.power, type: 'physical', knock: 90, stagger: 25, hitStop: 0.06, shake: 0.2,
              powerFor: (t) => {
                const st = t.status && t.status.get('bleed');
                return h.power + h.perStack * (st ? st.stacks || 1 : 0);
              },
              onHit: (t, info) => {
                if (t.status && t.status.get('bleed')) {
                  t.status.remove('bleed');
                  g.vfx.burst(t.x, t.y - 20, C, 10, 120);
                }
                drink(p, info, h.drain);
              },
            });
          }]],
        };
      },
    },
    {
      slot: 5, id: 'dragon_blood_awakening', tier: 'high', name: 'Dragon Blood Awakening', type: 'ultimate', cooldown: 45, cost: 90, targeting: 'self',
      tags: ['ultimate', 'buff', 'drain', 'aoe'], icon: 'dragon_blood_awakening', ultimate: true,
      desc: 'ULTIMATE (90 Wyrm Fury). The dragon wakes in your blood for 6 s: your HP cannot fall below 1, +15% damage, your hits heal 30% of the damage. It ends in a blood-fire blast around you.',
      cast(p, g, a) {
        const cls = p.cls, w = cls.awaken;
        return {
          name: 'dragon_blood_awakening', dur: 0.8, anim: 'awakening', moveMul: 0, ang: a, cancelAt: 99, invuln: [0, 0.8], superArmor: true,
          start: () => {
            g.slowMo(0.5, 0.3);
            g.audio.sfx('ult_charge');
            g.vfx.flash(CR, 0.3, 2);
          },
          events: [[0.42, () => {
            p.status.add('blood_awaken', w.duration, { source: p, refresh: true });
            g.camera.punch(0.2); g.camera.shake(0.5);
            g.audio.sfx('ult_slash');
            g.vfx.burst(p.x, p.y - 20, C, 40, 260);
            g.vfx.text(p.x, p.y - 96, 'DRAGON BLOOD AWAKENING', { color: PALE, size: 13, life: 1.2 });
            g.after(w.duration, () => {
              if (p.disposed || p.dead) return;
              g.audio.sfx('ult_slash');
              g.camera.shake(0.4);
              standFx(g, 'wr_burst', p.x, p.y, 0.75, { life: 0.4, glow: 0.6 });
              g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 8, shape: 'circle', r: w.radius, power: w.finale, type: 'physical', knock: 220, stagger: 60, hitStop: 0.12, shake: 0.4, big: true, skillId: 'dragon_blood_awakening' });
            });
          }]],
        };
      },
    },
  ],

  // ---------------- VEIN BURST (Q / right click): spend ALL Wyrm Fury (30+) in a blood nova that heals you
  special: {
    id: 'vein_burst', tier: 'fast', name: 'Vein Burst', type: 'special', slot: 'Q', key: 'Q', icon: 'vein_burst',
    cost: 0, cooldown: 4, targeting: 'self', tags: ['aoe', 'heal', 'spender'],
    requirements: [{ type: 'resource', resource: F, min: 30, label: '30 Wyrm Fury' }],
    desc: 'Needs 30 Wyrm Fury, spends it all: a nova of blood-fire around you (stronger with more Fury) that heals you 0.2% max HP per Fury spent (100 Fury = 20%).',
    cast(p, g, a) {
      const cls = p.cls, b = cls.burst, fury = p.resources.get(F);
      p.resources.set(F, 0, 'skill:vein_burst');
      return {
        name: 'vein_burst', dur: 0.4, anim: 'veinBurst', moveMul: 0, ang: a, cancelAt: 0.3, invuln: [0, 0.25],
        events: [[0.18, () => {
          g.audio.sfx('slash_heavy');
          g.camera.shake(0.25);
          standFx(g, 'wr_burst', p.x, p.y, 0.4 + fury / 400, { life: 0.36, glow: 0.6 });
          g.vfx.text(p.x, p.y - 74, 'VEIN BURST', { color: PALE, size: 11 });
          p.heal(p.maxHp * b.healPerFury * fury, 'vein_burst');
          g.combat.spawnHitbox({ owner: p, x: p.x, y: p.y - 8, shape: 'circle', r: b.radius, power: b.power + b.perFury * fury, type: 'physical', knock: 140, stagger: 35, hitStop: 0.08, shake: 0.25 });
        }]],
      };
    },
  },

  // ---------------- passives / Fury: react to core events
  on: {
    // every HP paid as a cost becomes Wyrm Fury
    hpSpent(p, g, e) {
      if (e.entity !== p) return;
      p.gainResource((e.amount / p.maxHp) * 100 * p.cls.fury.perHpPct);
      if (e.amount >= p.maxHp * 0.05) for (let i = 0; i < 6; i++) g.vfx.particle(p.x + rand(-8, 8), p.y - rand(10, 40), { color: i % 2 ? C : EMBER, vy: 30, life: 0.5, size: 2 });
    },
    damageDealt(p, g, e) {
      if (e.source !== p || !(e.amount > 0)) return;
      const o = e.opts || {}, cls = p.cls;
      // CINDER VEIN: your burn ticks heal you
      if (o.dot && o.statusId === 'burn') { p.heal(e.amount * cls.cinder.burnHeal, 'drain'); return; }
      // DRAGON BLOOD AWAKENING: every direct hit heals
      if (!o.dot && p.status.has('blood_awaken')) p.heal(e.amount * cls.awaken.drain, 'drain');
    },
    // Fury tier reached (data/resources.js tiers) — tell the player
    resourceTier(p, g, e) {
      if (e.entity !== p || e.tier <= e.before || !e.def) return;
      g.vfx.text(p.x, p.y - 82, e.def.label, { color: e.tier >= 1 ? '#ffffff' : PALE, size: e.tier >= 1 ? 13 : 11, life: 1.1 });
      g.vfx.ring(p.x, p.y, 8, 60, { life: 0.4, color: CR, width: 3 });
      g.audio.sfx('mark_full');
      g.world.setFlag('tut_marks'); // tutorial step "Reach 50 Wyrm Fury"
    },
  },
  // a Perfect Dodge: blood drawn back from the miss (on top of the data rewards below)
  onPerfectDodge(p, g) {
    p.heal(p.maxHp * 0.05, 'perfect_dodge');
    for (let i = 0; i < 8; i++) g.vfx.particle(p.x + rand(-10, 10), p.y - rand(4, 40), { color: i % 2 ? C : PALE, vy: -40, life: 0.5, size: 2, add: true });
  },
  counterBonus: { resource: 6 }, // data/counter.js
  perfectDodge: { resource: 10, stamina: 10, cooldownCut: 0.5 }, // data/dodge.js
};

