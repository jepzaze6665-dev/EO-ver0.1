// DROP RATES (owner, D1) — one place for every loot rule that a future online server will also read. Data only.
//   global       : × every GEAR chance in every loot table (events: 2 = double drops). Capped at 100%.
//   bossRematch  : a defeated boss comes back when you enter its map again (rematch); progression stays saved
//   repeat       : what a boss pays on LATER kills (the first kill pays the full table, as before):
//     exp / gold   : × the first-kill EXP / gold
//     signature    : chance of the boss's signature item (owner: about one in 8-10 kills)
//     gearGroup    : chance of the table's guaranteed gear group (oneOf with chance 1, e.g. a random core)
//     trophies     : false = the boss's one-time trophy items / lore are first-kill only
// No pity / bad-luck protection (owner decision). Duplicates are salvaged into materials (D2).
export const DROP_RATES = {
  global: 1,
  bossRematch: true,
  repeat: { exp: 0.5, gold: 0.5, signature: 0.11, gearGroup: 0.3, trophies: false },
};
