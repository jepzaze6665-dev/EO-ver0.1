// F4 COSMETICS (fashion): change how a character LOOKS, never its stats. Three slots, each holds one or nothing:
//   dye  = a colour treatment of the whole body (canvas `filter`, e.g. hue-rotate) — works on every class sprite
//   aura = a ring of light at the feet (+ light columns), drawn under / over the body like the status auras
//   glow = the GLOW LAYER (src/vfx/glowLayer.js): the lit parts of the sprite (blade / runes) shine + heartbeat pulse;
//          `glow` = glowLayer options (hue = which colours count as lit, tint = colour it shines)
// Owned cosmetics = player.wardrobe (saved). `free: true` = every player has it. The rest are unlocked later (shop /
// rewards / premium: not built; the Dev Panel unlocks all). Online: worn ids travel in the 'look' message (wd / wa / wg).
export const COSMETIC_SLOTS = ['dye', 'aura', 'glow'];

export const COSMETICS = {
  // DYES
  dye_crimson: { slot: 'dye', name: 'Crimson Dye', rarity: 'rare', free: true, filter: 'hue-rotate(110deg) saturate(1.3)', swatch: '#c8283a' },
  dye_frost: { slot: 'dye', name: 'Frost Dye', rarity: 'rare', filter: 'hue-rotate(-60deg) saturate(1.1) brightness(1.08)', swatch: '#5ab4ff' },
  dye_gold: { slot: 'dye', name: 'Gilded Dye', rarity: 'epic', filter: 'sepia(0.7) saturate(1.8) hue-rotate(-12deg) brightness(1.08)', swatch: '#e8b838' },
  dye_ash: { slot: 'dye', name: 'Ashen Dye', rarity: 'rare', free: true, filter: 'grayscale(0.85) contrast(1.15)', swatch: '#8a8a90' },
  dye_void: { slot: 'dye', name: 'Void Dye', rarity: 'legendary', filter: 'hue-rotate(200deg) saturate(1.6) brightness(0.92)', swatch: '#7a3cf0' },
  // AURAS ({ color 'r,g,b', ring, columns, pulse })
  aura_ember: { slot: 'aura', name: 'Ember Ring', rarity: 'rare', free: true, aura: { color: '255,110,50', ring: 1, columns: 0 }, swatch: '#ff6e32' },
  aura_frost: { slot: 'aura', name: 'Frostbloom', rarity: 'epic', aura: { color: '140,210,255', ring: 1.1, columns: 3 }, swatch: '#8cd2ff' },
  aura_dawn: { slot: 'aura', name: 'Dawn Halo', rarity: 'epic', aura: { color: '255,215,110', ring: 1.2, columns: 4 }, swatch: '#ffd76e' },
  aura_eclipse: { slot: 'aura', name: 'Eclipse Crown', rarity: 'legendary', aura: { color: '170,90,255', ring: 1.3, columns: 6 }, swatch: '#aa5aff' },
  // GLOWS (glowLayer options)
  glow_violet: { slot: 'glow', name: 'Violet Pulse', rarity: 'epic', free: true, glow: { hue: [250, 330], minLum: 0.4, minSat: 0.4, pulse: 0.7 }, swatch: '#a05aff' },
  glow_storm: { slot: 'glow', name: 'Storm Pulse', rarity: 'epic', glow: { hue: [180, 250], minLum: 0.5, pulse: 0.5, rate: 1.6 }, swatch: '#5ab4ff' },
  glow_blood: { slot: 'glow', name: 'Heartblood', rarity: 'legendary', glow: { minLum: 0.45, minSat: 0.45, tint: '#ff3040', pulse: 0.9, rate: 1.0 }, swatch: '#ff3040' },
};

export const cosmeticOf = (id) => (id && COSMETICS[id]) || null;
export const FREE_COSMETICS = Object.keys(COSMETICS).filter((id) => COSMETICS[id].free);
// a worn set { dye, aura, glow } cleaned: unknown ids / ids in the wrong slot dropped
export function cleanLook(w = {}) {
  const out = {};
  for (const s of COSMETIC_SLOTS) { const c = cosmeticOf(w[s]); out[s] = c && c.slot === s ? w[s] : null; }
  return out;
}

// OWNER (2026-10-10): the system is kept but NOT live yet — off for players (no Wardrobe tab, nothing drawn or sent online).
// Turn it on for a look with ?fashion in the URL; set `enabled: true` to release it.
export const COSMETIC_RULES = { enabled: false };
export function cosmeticsOn() {
  if (COSMETIC_RULES.enabled) return true;
  try { return typeof location !== 'undefined' && new URLSearchParams(location.search).has('fashion'); } catch { return false; }
}
