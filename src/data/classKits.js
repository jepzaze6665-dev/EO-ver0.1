// CLASS KITS (owner, K1) — each class's signature weapon + armour are PART OF THE CLASS, not items:
// never in the bag, never in the Combat Loadout, never dropped / sold / traded, nothing is created on a class change
// (no duplicates for a future online server). The class sprite already draws them; their small stats are added to the
// class's own stats (Player.recomputeStats, after the level stats). The 7 loadout slots hold only real items.
//   PIECES : piece id -> { name, slot 'weapon' | 'armor', icon, color, stats, desc }  (ids kept from the old items)
//   KITS   : class id -> { weapon, armor }  (class data names it as `kit`)
export const KIT_PIECES = {
  umbral_sword: {
    name: 'Umbral Sword', slot: 'weapon', icon: 'sword', color: '#a060ff',
    stats: { atk: 0 }, desc: 'A blade forged from a sliver of eclipse. Balanced and reliable.',
  },
  umbral_cloak: {
    name: 'Umbral Cloak', slot: 'armor', icon: 'cloak', color: '#7a50c0',
    stats: { def: 0, hp: 0 }, desc: 'Black cloak woven with shadow thread.',
  },
  celestial_loom: {
    name: 'Celestial Loom', slot: 'weapon', icon: 'staff', color: '#8ad8ff',
    stats: { atk: 0 }, desc: 'A gilded staff that spins starlight into thread. Signature weapon of the Astral Weaver.',
  },
  astral_robe: {
    name: 'Astral Robe', slot: 'armor', icon: 'cloak', color: '#5a7ad8',
    stats: { def: 0, hp: 0 }, desc: 'Night-blue robe embroidered with gold constellations.',
  },
  aegis_shield: {
    name: 'Aegis Shield & Blade', slot: 'weapon', icon: 'shield', color: '#ffd070',
    stats: { atk: 0 }, desc: 'A knight longsword and the gilded Aegis shield. Signature weapon of the Aegis Guardian.',
  },
  aegis_plate: {
    name: 'Aegis Plate', slot: 'armor', icon: 'cloak', color: '#c8d0e0',
    stats: { def: 0, hp: 0 }, desc: 'Polished silver plate under a midnight-blue mantle.',
  },
  reaper_scythe: {
    name: 'Reaper Scythe', slot: 'weapon', icon: 'scythe', color: '#9a5cff',
    stats: { atk: 2 }, desc: 'A shadow scythe that hungers for marked souls. Signature weapon of the Nightfall Reaper.',
  },
  reaper_shroud: {
    name: 'Reaper Shroud', slot: 'armor', icon: 'cloak', color: '#5a2aa0',
    stats: { def: 1, hp: 10 }, desc: 'Tattered night given form. Worn by those who walk the Long Night.',
  },
  twin_dusk_blades: {
    name: 'Twin Dusk Blades', slot: 'weapon', icon: 'twin_blades', color: '#5ab8ff',
    stats: { atk: 1, crit: 0.03 }, desc: 'Two short blades that never stop moving. Signature weapon of the Duskrunner.',
  },
  dusk_scarf: {
    name: 'Duskrunner Scarf', slot: 'armor', icon: 'cloak', color: '#2a5aaa',
    stats: { def: 0, hp: 5 }, desc: 'A long blue scarf that trails behind like wind. Worn by those who never stop.',
  },
  memory_blade: {
    name: 'Memory Blade', slot: 'weapon', icon: 'memory_blade', color: '#ff4a5a',
    stats: { atk: 2 }, desc: 'A long crimson blade that remembers every blow. Signature weapon of the Blade of Echoes.',
  },
  echo_coat: {
    name: 'Coat of Echoes', slot: 'armor', icon: 'cloak', color: '#d8d0d8',
    stats: { def: 2, hp: 15 }, desc: 'A pale duelist coat lined in red. Every scar on it is remembered.',
  },
  storm_staff: {
    name: 'Storm Staff & Focus', slot: 'weapon', icon: 'staff', color: '#7ac8ff',
    stats: { atk: 1, lightningDmg: 0.05 }, desc: 'A black staff crowned with a caged storm crystal, and a focus that hums with thunder. Signature weapon of the Stormcaller.',
  },
  stormweave_robe: {
    name: 'Stormweave Robe', slot: 'armor', icon: 'cloak', color: '#1a2a5a',
    stats: { def: 0, hp: 5 }, desc: 'A long navy robe that crackles when it moves. Worn by those who never stand still.',
  },
  void_tome: {
    name: 'Void Tome & Arcane Quill', slot: 'weapon', icon: 'staff', color: '#b060ff',
    stats: { atk: 1, voidDmg: 0.05 }, desc: 'A black grimoire whose blank pages drink the light, and a quill that writes laws into nothing. Signature weapon of the Void Scribe.',
  },
  scribe_robe: {
    name: "Scribe's Hooded Robe", slot: 'armor', icon: 'cloak', color: '#3a1a5a',
    stats: { def: 1, hp: 10 }, desc: 'A violet-lined black robe covered in script that rewrites itself.',
  },
  lumen_staff: {
    name: 'Lumen Staff & Celestial Codex', slot: 'weapon', icon: 'staff', color: '#ffe08a',
    stats: { atk: 0, lightDmg: 0.05 }, desc: 'A gilded staff crowned with a captive dawn, and a codex of the stars that heals whoever it is read to. Signature weapon of the Lumen Oracle.',
  },
  oracle_vestment: {
    name: 'Oracle Vestment', slot: 'armor', icon: 'cloak', color: '#e8d8a0',
    stats: { def: 1, hp: 15 }, desc: 'A dark vestment embroidered with golden constellations that glow when someone is healed.',
  },
  dawn_aegis: {
    name: 'Dawn Aegis & Holy Sword', slot: 'weapon', icon: 'dawn_shield', color: '#8ad0ff',
    stats: { atk: 0, def: 1 }, desc: 'A white-silver shield holding a blue dawn, and a holy longsword. Signature weapon of the Warden of Dawn.',
  },
  dawn_plate: {
    name: 'Dawnward Plate', slot: 'armor', icon: 'cloak', color: '#e8eef8',
    stats: { def: 2, hp: 20 }, desc: 'Silver plate that catches the first light. Worn by those who guard others first.',
  },
  bastion_aegis: {
    name: 'Bulwark Shield & Bastion Sword', slot: 'weapon', icon: 'bulwark', color: '#f0c850',
    stats: { atk: 0, def: 2 }, desc: 'A gilded tower shield and a heavy bastion sword. Signature weapon of the Bulwark Sentinel.',
  },
  fortress_plate: {
    name: 'Fortress Plate', slot: 'armor', icon: 'cloak', color: '#c8a050',
    stats: { def: 3, hp: 25 }, desc: 'Gold-chased steel over a midnight cape. Built to stand where others fall.',
  },
  ruin_blade: {
    name: 'Ruin Blade & Broken Aegis', slot: 'weapon', icon: 'oath_brand', color: '#b060ff',
    stats: { atk: 2 }, desc: 'A black greatsword that drinks the pain of its wielder, and a shattered oath-shield. Signature weapon of the Oathbreaker.',
  },
  oathbreaker_plate: {
    name: 'Oathbreaker Plate', slot: 'armor', icon: 'cloak', color: '#4a2a6a',
    stats: { def: 1, hp: 15 }, desc: 'Black spiked plate with a torn violet mantle. Every scar is a vow unmade.',
  },
};

export const kitPieces = (cls) => (cls && cls.kit ? [KIT_PIECES[cls.kit.weapon], KIT_PIECES[cls.kit.armor]].filter(Boolean) : []);
// the kit's stats, summed (added to the class stats; no item modifier layer involved)
export function kitStats(cls) {
  const out = {};
  for (const piece of kitPieces(cls)) for (const [k, v] of Object.entries(piece.stats || {})) out[k] = (out[k] || 0) + v;
  return out;
}
