// SKILL TRAITS (Skill System S7) — generic behaviours a skill LEVEL or EVOLUTION can switch on through data, so any
// class gets "new behaviour" without new class code. Read from the cast's merged mods (Player.skillMods):
//   flags.echo      values { echoDelay = 0.5, echoPower = 0.4 }  every hitbox of the cast repeats once (combat.spawnHitbox)
//   values.poiseMult                                               × stagger / poise damage of the cast's hitboxes
//   flags.lifesteal values { lifesteal = 0.05 }                    heal a share of the damage the skill deals
//   flags.refund    values { refundOnKill = 10 }                   class resource when the skill kills
//   flags.reset     values { cdOnKill = 2 }                        seconds cut from this skill's cooldown on a kill
//   flags.haste     values { hasteTime = 1.5, hasteMult = 1.2 }    move faster after casting
//   charges (number field)                                         + charges (SkillSystem.maxCharges)
// Class-specific behaviour still uses p.skillFlag / p.skillValue in the class file (e.g. Umbral).
export const TRAIT_DEFAULTS = {
  echoDelay: 0.5, echoPower: 0.4, lifesteal: 0.05, refundOnKill: 10, cdOnKill: 2, hasteTime: 1.5, hasteMult: 1.2,
  lifestealCapPerHit: 0.04, // never more than 4% max HP from one hit
};
export const TRAIT_TEXT = {
  echo: 'ECHO: every hit repeats 0.5 s later (40%)',
  lifesteal: 'LIFESTEAL: heals 5% of the damage dealt',
  refund: 'REFUND: +10 resource when it kills',
  reset: 'RESET: a kill cuts 2 s from its cooldown',
  haste: 'HASTE: move 20% faster for 1.5 s after casting',
};

const v = (m, k) => (m.values && m.values[k] != null ? m.values[k] : TRAIT_DEFAULTS[k]);

// combat.spawnHitbox: schedule the echo copy of a hitbox spawned inside a cast
export function echoHitbox(combat, def, hb) {
  const m = hb.owner && hb.owner.castMods;
  if (!m || !m.flags || !m.flags.echo || hb.isEcho || def.noSkillMods || !combat.game.after) return;
  const ratio = v(m, 'echoPower');
  const copy = { ...def, isEcho: true, noSkillMods: true, skillId: hb.skillId, power: hb.power * ratio, onHit: null, hitStop: 0.02, shake: 0.05 };
  // a per-target power function computes its own number: scale ITS result too (it sees the original hitbox power)
  if (hb.powerFor) copy.powerFor = (t, h) => hb.powerFor(t, h) * ratio; // hb.powerFor already carries the skill level
  if (Number.isFinite(hb.r)) copy.r = hb.r;
  combat.game.after(v(m, 'echoDelay'), () => {
    if (hb.owner.dead) return;
    combat.game.vfx.ring(copy.x ?? hb.x, copy.y ?? hb.y, 6, (copy.r || 40) * 0.6, { life: 0.25, color: '200,160,255', width: 2 });
    combat.spawnHitbox(copy);
  });
}

// event side of the traits (lifesteal / refund / reset / haste); game.events is recreated per session
export function installSkillTraits(game) {
  const ev = game.events;
  const modsOf = (p, id) => { const s = p && p.skillSys && p.skillSys.get(id); return s ? p.skillMods(s) : null; };
  ev.on('skillUsed', (e) => {
    const p = e.caster;
    if (p !== game.player || e.recast) return;
    const m = modsOf(p, e.skillId);
    if (m && m.flags.haste) p.status.add('haste', v(m, 'hasteTime'), { mult: v(m, 'hasteMult'), refresh: true });
  });
  ev.on('skillHit', (e) => {
    const p = e.source;
    if (p !== game.player || !(e.amount > 0)) return;
    const m = modsOf(p, e.skillId);
    if (!m) return;
    if (m.flags.lifesteal && p.heal) p.heal(Math.min(e.amount * v(m, 'lifesteal'), p.maxHp * TRAIT_DEFAULTS.lifestealCapPerHit), 'lifesteal');
    if (e.killed && m.flags.refund) p.gainResource(v(m, 'refundOnKill'), true);
    if (e.killed && m.flags.reset) p.skillSys.cooldowns.reduce(e.skillId, v(m, 'cdOnKill'));
  });
}
