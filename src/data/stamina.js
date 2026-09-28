// STAMINA RULES (Combat 2.0 §42) — what defensive actions cost. The pool itself is the 'stamina' entry in
// data/resources.js (max 100, regen after a short delay). Basic attacks never cost stamina.
// Skills name their own cost in class data: `stamina: n` (skillSystem checks + spends it).
export const STAMINA = {
  resource: 'stamina',
  dodge: 22,            // per SPACE dodge
  guardRaise: 5,        // raising a guard (the parry attempt) — you need at least this much to guard
  guardDrain: 6,        // per second while the guard is held
  blockPerDamage: 0.4,  // blocked hit: this × the damage it would have dealt …
  blockMin: 4, blockMax: 25, // … clamped to this range. Guard drops when stamina runs out ('guardBroken')
  parryRefund: 12,      // a perfect guard (parry) gives stamina back
};
