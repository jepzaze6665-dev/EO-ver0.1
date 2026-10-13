// Which NPC uses which sprite (assets/npcs/<art>.png, built by tools/build-npcs.js from desgin/NPC).
// Keyed by NPC id (looks are shared between NPCs, art is not). NPCs not listed keep the canvas figure (monsterSprites npcSprite).
// 'keeper' (Waystone Keeper) and 'granny' (spare old woman) are built but no NPC uses them yet.
export const NPC_ART = {
  guide: 'aldric',          // Captain Aldric, Lumina
  elder: 'maren',           // Elder Maren, Lumina
  smith: 'borin',           // Borin, Lumina
  kael: 'kael',             // Kael, A1 ruins
  scout: 'wren',            // Scout Wren, Valehaven
  ashen_pilgrim: 'pilgrim', // Ashen Pilgrim (wanderer)
  caravan: 'marrow',        // Marrow the Trader (random caravan)
  a_guildmaster: 'seraphine',
  a_merchant: 'odo',
  a_smith: 'hilde',
  a_gate_guard: 'callum',
  a_scholar: 'imre',
  guard: 'tomas',           // Tomas, Lumina gate guard
  child: 'pip',             // Pip, Lumina
  villager: 'hanna',        // Hanna, Lumina
};
