// COMBAT UI RULES (Combat 2.0 §67) — presentation only; gameplay never reads this file.
//
//  dodgeHint.learnAfter : the "DODGE [SPACE]" hint above the skill bar fades out for good after this many dodges
//                         (or the first Perfect Dodge). Remembered as world flag 'tut_dodge' (saved with the game).
//  questFade            : the quest tracker + route panel fade while the fight is intense, then come back
//      alpha            : how visible they stay (0 = hidden)
//      speed            : fade speed (per second)
//      foes             : "intense" = this many enemies in the fight (aggro on this map), or anyone attacking you
//                         right now (attack slots), or any boss fight
export const COMBAT_UI = {
  dodgeHint: { learnAfter: 5 },
  questFade: { alpha: 0.22, speed: 3, foes: 2 },
  // HUD layout (owner chose B, docs/ui/ECLIPSE_ONLINE_HUD_Layout.pdf): 'focus' = class resource bar (+ tiers) and class
  // counter above the skill bar; 'classic' = both in the top-left frame. The player can switch in the ESC menu (localStorage).
  hudLayout: { default: 'focus', options: ['focus', 'classic'], storageKey: 'eclipse_hud_layout' },
};
