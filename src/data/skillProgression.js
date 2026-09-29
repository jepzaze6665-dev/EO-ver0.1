// SKILL PROGRESSION DATA (Skill System S7) — skill levels, tree unlocks, categories and evolutions for every class
// except the parts a class file already defines itself (Umbral Sword keeps its own hand-made data).
// applySkillProgression(CLASSES) (skills/classes.js) copies a field onto a skill only if the skill does not have it.
// New behaviour comes from the generic traits in progression/skillTraits.js (echo / lifesteal / refund / reset /
// haste / poiseMult / charges), so no class code changes. Designed by Claude on the owner's request (2026-09-29).
import { TRAIT_TEXT } from '../progression/skillTraits.js';

// 5-level ladders. `lv5` = the new behaviour at Lv 5 (fields merged into the Lv 5 entry), `text` its line.
const damage = (text, lv5) => [
  { text: 'Base' },
  { power: 1.1, text: '+10% damage' },
  { power: 1.1, cooldown: 0.9, text: '-10% cooldown' },
  { power: 1.2, cooldown: 0.9, text: '+20% damage' },
  { power: 1.2, cooldown: 0.9, ...lv5, text },
];
const support = (text, lv5) => [
  { text: 'Base' },
  { cost: 0.9, text: '-10% cost' },
  { cost: 0.9, cooldown: 0.9, text: '-10% cooldown' },
  { cost: 0.85, cooldown: 0.85, text: '-15% cost and cooldown' },
  { cost: 0.85, cooldown: 0.85, ...lv5, text },
];
const T = (flag, extra = {}) => ({ flags: { [flag]: true }, ...extra });
const REQ = { skillLevel: 3, masteryLevel: 3 };
const evo = (id, name, desc, changes, fields) => ({ id, name, desc, changes, requirements: REQ, ...fields });

export const SKILL_PROGRESSION = {
  // ======================= UMBRAL SWORD (levels / tree in its own file) — extra evolutions
  shade_step: {
    evolutions: [
      evo('twin_shade', 'Twin Shade', 'Two shorter shadow dashes instead of one: store 2 charges and chain them, and you move faster after each.',
        { behavior: 'Double dash for dodging combos', damage: 'Same', utility: '2 charges · haste after the dash', resource: 'Same', cooldown: '+25% per charge' },
        { charges: 1, cooldown: 1.25, flags: { haste: true } }),
      evo('shade_reaper', 'Shade Reaper', 'The dash becomes an execution: it cuts 30% harder, and a kill with it instantly gives most of its cooldown back.',
        { behavior: 'Chain kills through a pack', damage: '+30%', utility: 'Kill = -3 s cooldown', resource: 'Same', cooldown: 'Same' },
        { power: 1.3, flags: { reset: true }, values: { cdOnKill: 3 } }),
    ],
  },

  // ======================= ASTRAL WEAVER (Class 1)
  star_needle: {
    category: 'OFFENSE', levels: damage(TRAIT_TEXT.echo, T('echo')),
    evolutions: [
      evo('twin_needle', 'Twin Needle', 'Lighter needles you can fire twice in a row: 2 charges, and each cast gives you a burst of speed to reposition.',
        { behavior: 'Kite: shoot, move, shoot', damage: '-15%', utility: '2 charges · haste', resource: 'Same', cooldown: 'Same' },
        { charges: 1, power: 0.85, flags: { haste: true } }),
      evo('piercing_star', 'Piercing Star', 'One heavy star that breaks poise hard; killing with it recharges it faster.',
        { behavior: 'Break elites and bosses', damage: '+30%', utility: 'Poise damage ×1.6 · kill = -2 s', resource: 'Same', cooldown: '+20%' },
        { power: 1.3, cooldown: 1.2, values: { poiseMult: 1.6 }, flags: { reset: true } }),
    ],
  },
  comet_step: { category: 'MOBILITY', unlock: { classLevel: 2 }, levels: support('COMET TRAIL: +1 charge', { charges: 1 }) },
  astral_thread: { category: 'UTILITY', unlock: { classLevel: 4, requires: ['star_needle'] }, levels: support(TRAIT_TEXT.haste, T('haste')) },
  thread_burst: { category: 'OFFENSE', unlock: { classLevel: 6, requires: ['astral_thread'] }, levels: damage(TRAIT_TEXT.refund, T('refund')) },
  starfall_fate: { category: 'BURST', unlock: { classLevel: 10 } },
  astral_veil: { category: 'UTILITY' },

  // ======================= AEGIS GUARDIAN (Class 1)
  shield_bash: {
    category: 'UTILITY', levels: damage('SHATTERING BASH: poise damage ×1.5', { values: { poiseMult: 1.5 } }),
    evolutions: [
      evo('shield_rush', 'Shield Rush', 'A wider, running bash that hits a whole line of enemies and leaves you faster — for gathering a pack.',
        { behavior: 'Gather and control packs', damage: '-10%', utility: '+30% area · haste after', resource: 'Same', cooldown: 'Same' },
        { area: 1.3, power: 0.9, flags: { haste: true } }),
      evo('punishing_bash', 'Punishing Bash', 'A slow crushing blow: huge poise damage, and it heals you for part of the damage.',
        { behavior: 'Tank sustain vs bosses', damage: '+30%', utility: 'Poise ×2 · lifesteal 8%', resource: 'Same', cooldown: '+20%' },
        { power: 1.3, cooldown: 1.2, values: { poiseMult: 2, lifesteal: 0.08 }, flags: { lifesteal: true } }),
    ],
  },
  guardian_slash: { category: 'OFFENSE', unlock: { classLevel: 2 }, levels: damage(TRAIT_TEXT.lifesteal, T('lifesteal')) },
  guardian_challenge: { category: 'UTILITY', unlock: { classLevel: 4 }, levels: support(TRAIT_TEXT.haste, T('haste')) },
  holy_barrier: { category: 'UTILITY', unlock: { classLevel: 6 }, levels: support('BLESSED BARRIER: +1 charge', { charges: 1 }) },
  aegis_ascension: { category: 'BURST', unlock: { classLevel: 10 } },
  aegis_guard: { category: 'UTILITY' },

  // ======================= NIGHTFALL REAPER (Class 2: everything open at the character level)
  reapers_arc: {
    category: 'OFFENSE', levels: damage(TRAIT_TEXT.echo, T('echo')),
    evolutions: [
      evo('wide_harvest', 'Wide Harvest', 'A huge sweeping scythe arc for packs; every kill feeds your Nightfall Gauge.',
        { behavior: 'Farm packs, fuel the gauge', damage: '-20%', utility: '+35% area', resource: '+10 on kill', cooldown: 'Same' },
        { area: 1.35, power: 0.8, flags: { refund: true } }),
      evo('grave_echo', 'Grave Echo', 'The arc returns: every cut is repeated by your shadow half a second later at 70%.',
        { behavior: 'Double damage on targets that stay', damage: '-15% then +70% echo', utility: 'Delayed second arc', resource: 'Same', cooldown: 'Same' },
        { power: 0.85, flags: { echo: true }, values: { echoPower: 0.7 } }),
    ],
  },
  phantom_reap: { category: 'MOBILITY', levels: damage(TRAIT_TEXT.reset, T('reset')) },
  shadow_doppel: { category: 'UTILITY', levels: support(TRAIT_TEXT.haste, T('haste')) },
  nightfall_zone: { category: 'OFFENSE', levels: damage(TRAIT_TEXT.lifesteal, T('lifesteal')) },
  funeral_eclipse: { category: 'BURST' },
  reapers_step: { category: 'MOBILITY' },

  // ======================= DUSKRUNNER (Class 2)
  blue_fang: {
    category: 'MOBILITY', levels: damage(TRAIT_TEXT.reset, T('reset')),
    evolutions: [
      evo('twin_fangs', 'Twin Blue Fangs', 'Two lighter dash-cuts back to back (2 charges), each leaving you faster — never stop moving.',
        { behavior: 'Keep momentum up', damage: '-15%', utility: '2 charges · haste', resource: 'Same', cooldown: 'Same' },
        { charges: 1, power: 0.85, flags: { haste: true } }),
      evo('executioner_fang', 'Executioner Fang', 'A heavy finishing dash: +30% damage, and a kill resets it completely.',
        { behavior: 'Execute and go again', damage: '+30%', utility: 'Kill = full reset', resource: 'Same', cooldown: '+25%' },
        { power: 1.3, cooldown: 1.25, flags: { reset: true }, values: { cdOnKill: 99 } }),
    ],
  },
  dusk_barrage: { category: 'OFFENSE', levels: damage(TRAIT_TEXT.echo, T('echo')) },
  mirage_shift: { category: 'MOBILITY', levels: support(TRAIT_TEXT.haste, T('haste')) },
  silent_run: { category: 'UTILITY', levels: support('SHADOW RUNNER: +1 charge', { charges: 1 }) },
  endless_run: { category: 'BURST' },
  flash_step: { category: 'MOBILITY' },

  // ======================= BLADE OF ECHOES (Class 2)
  echo_slash: {
    category: 'OFFENSE', levels: damage(TRAIT_TEXT.echo, T('echo')),
    evolutions: [
      evo('resonant_slash', 'Resonant Slash', 'Your memory rings louder: every cut is repeated at 60% half a second later.',
        { behavior: 'Layer hits for burst', damage: '-10% then +60% echo', utility: 'Delayed repeat', resource: 'Same', cooldown: 'Same' },
        { power: 0.9, flags: { echo: true }, values: { echoPower: 0.6 } }),
      evo('bloodied_memory', 'Bloodied Memory', 'Pain feeds the blade: the slash heals you for 10% of its damage.',
        { behavior: 'Stay in the fight longer', damage: '+15%', utility: 'Lifesteal 10%', resource: 'Same', cooldown: '+15%' },
        { power: 1.15, cooldown: 1.15, flags: { lifesteal: true }, values: { lifesteal: 0.1 } }),
    ],
  },
  rewind_edge: { category: 'MOBILITY', levels: support(TRAIT_TEXT.haste, T('haste')) },
  crimson_memory: { category: 'BURST', levels: damage(TRAIT_TEXT.lifesteal, T('lifesteal')) },
  last_stand: { category: 'UTILITY', levels: support(TRAIT_TEXT.haste, T('haste')) },
  blade_of_recollection: { category: 'BURST' },
  crimson_counter: { category: 'UTILITY' },

  // ======================= WARDEN OF DAWN (Class 2)
  grace_of_dawn: {
    category: 'UTILITY', levels: support('DAWN\'S BLESSING: +1 charge', { charges: 1 }),
    evolutions: [
      evo('twin_grace', 'Twin Grace', 'Store two heals (2 charges) for emergencies — each costs a little more light.',
        { behavior: 'Burst healing when it goes wrong', damage: '—', utility: '+1 charge', resource: '+20% cost', cooldown: 'Same' },
        { charges: 1, cost: 1.2, flags: { haste: true } }),
      evo('swift_grace', 'Swift Grace', 'Quick small graces: 30% shorter cooldown and you move faster after each cast.',
        { behavior: 'Heal on the move', damage: '—', utility: 'Haste after cast', resource: 'Same', cooldown: '-30%' },
        { cooldown: 0.7, flags: { haste: true } }),
    ],
  },
  dawn_shield: { category: 'UTILITY', levels: support(TRAIT_TEXT.haste, T('haste')) },
  radiant_chain: { category: 'UTILITY', levels: support(TRAIT_TEXT.haste, T('haste')) },
  dawn_bastion: { category: 'UTILITY', levels: damage(TRAIT_TEXT.lifesteal, T('lifesteal')) },
  guardian_march: { category: 'MOBILITY', levels: damage('UNSTOPPABLE MARCH: poise damage ×1.6', { values: { poiseMult: 1.6 } }) },
  dawns_sanctuary: { category: 'BURST' },
  dawn_guard: { category: 'UTILITY' },

  // ======================= BULWARK SENTINEL (Class 2)
  fortress_step: {
    category: 'MOBILITY', levels: damage(TRAIT_TEXT.reset, T('reset')),
    evolutions: [
      evo('battering_step', 'Battering Step', 'A wide shoulder charge that breaks poise twice as hard and speeds you up to reach the next foe.',
        { behavior: 'Open bosses and elites', damage: '-10%', utility: '+30% area · poise ×2 · haste', resource: 'Same', cooldown: 'Same' },
        { area: 1.3, power: 0.9, values: { poiseMult: 2 }, flags: { haste: true } }),
      evo('iron_riposte', 'Iron Riposte', 'A slower heavy step that heals you for part of its damage — the fortress repairs itself.',
        { behavior: 'Self-sustain tank', damage: '+25%', utility: 'Lifesteal 8%', resource: 'Same', cooldown: '+20%' },
        { power: 1.25, cooldown: 1.2, flags: { lifesteal: true }, values: { lifesteal: 0.08 } }),
    ],
  },
  iron_bastion: { category: 'UTILITY', levels: support(TRAIT_TEXT.haste, T('haste')) },
  absolute_provocation: { category: 'UTILITY', levels: support(TRAIT_TEXT.haste, T('haste')) },
  counterweight: { category: 'OFFENSE', levels: damage(TRAIT_TEXT.lifesteal, T('lifesteal')) },
  shieldwall: { category: 'UTILITY', levels: support('TWIN WALLS: +1 charge', { charges: 1 }) },
  citadel_of_one: { category: 'BURST' },
  bulwark_guard: { category: 'UTILITY' },

  // ======================= OATHBREAKER (Class 2)
  sinful_counter: {
    category: 'BURST', levels: damage(TRAIT_TEXT.lifesteal, T('lifesteal')),
    evolutions: [
      evo('penance', 'Penance', 'The counter drinks your sins back: it heals you for 10% of its damage.',
        { behavior: 'Trade blows and survive', damage: '-10%', utility: 'Lifesteal 10%', resource: 'Same', cooldown: 'Same' },
        { power: 0.9, flags: { lifesteal: true }, values: { lifesteal: 0.1 } }),
      evo('wrath_unbound', 'Wrath Unbound', 'The broken oath strikes twice: +20% damage and an echo of the blow at 50%.',
        { behavior: 'All-in burst', damage: '+20% then +50% echo', utility: 'Delayed repeat', resource: 'Same', cooldown: '+25%' },
        { power: 1.2, cooldown: 1.25, flags: { echo: true }, values: { echoPower: 0.5 } }),
    ],
  },
  oath_brand: { category: 'UTILITY', levels: damage(TRAIT_TEXT.refund, T('refund')) },
  ruin_chain: { category: 'UTILITY', levels: damage('RUINOUS PULL: poise damage ×1.6', { values: { poiseMult: 1.6 } }) },
  oath_of_ruin: { category: 'BURST', levels: support(TRAIT_TEXT.haste, T('haste')) },
  oathbreaker_verdict: { category: 'BURST' },
  defiant_guard: { category: 'UTILITY' },
};

// copies progression data onto the class skills (only fields a skill does not define itself)
export function applySkillProgression(classes, table = SKILL_PROGRESSION) {
  for (const cls of Object.values(classes)) {
    for (const s of [...cls.skills, cls.special].filter(Boolean)) {
      const d = table[s.id];
      if (!d) continue;
      for (const k of ['category', 'unlock', 'levels', 'evolutions']) if (d[k] && s[k] === undefined) s[k] = d[k];
    }
  }
  return classes;
}
