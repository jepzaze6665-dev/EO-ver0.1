import { LEVEL_SCALING } from '../data/levelScaling.js';
import { LEVELS } from '../data/levels.js';
import { expToNext } from './experience.js';

// LEVEL SCALING (pure) — rules and reasons in data/levelScaling.js. No game objects: unit-tested.

const growth = () => LEVELS.statGrowth;
// expected player damage / HP at a level (relative units)
export function playerPower(level, r = LEVEL_SCALING) { return r.player.atk + r.player.atkPerLevel * growth() * (Math.max(1, level) - 1); }
export function playerHp(level, r = LEVEL_SCALING) { return r.player.hp + r.player.hpPerLevel * growth() * (Math.max(1, level) - 1); }

// EXP a level is worth (the cap has no "next" -> use the level below)
function expWorth(level) {
  const lv = Math.max(1, Math.min(LEVELS.maxLevel - 1, Math.round(level)));
  return expToNext(lv);
}

// a native-level stat block moved to `level` -> multipliers { hp, def, power, exp }
// slope = new levels per native level of the band (1 = same pace)
export function scaleFor(nativeLevel, level, slope = 1, r = LEVEL_SCALING) {
  if (!(level > 0) || level === nativeLevel && slope === 1) return { hp: 1, def: 1, power: 1, exp: 1 };
  const m = (x) => Math.max(r.minMult, x);
  return {
    hp: m(playerPower(level, r) / playerPower(nativeLevel, r)),
    def: m(playerPower(level, r) / playerPower(nativeLevel, r)),
    power: m(playerHp(level, r) / playerHp(nativeLevel, r)),
    exp: m((expWorth(level) / expWorth(nativeLevel)) * slope),
  };
}

// map band: { from: [oldMin, oldMax], to: [newMin, newMax] } -> the new level of a native level (+ slope)
export function remapLevel(nativeLevel, band) {
  if (!band || !band.from || !band.to) return { level: nativeLevel, slope: 1 };
  const [a0, a1] = band.from, [b0, b1] = band.to;
  const slope = a1 > a0 ? (b1 - b0) / (a1 - a0) : 1;
  const t = Math.max(a0, Math.min(a1, nativeLevel));
  return { level: Math.round(b0 + (t - a0) * slope), slope };
}

// BOSSES: data `level` = the new level, `nativeLevel` = the level its stats were tuned at (default: same)
// + boss data `difficulty: { hp, power, windup }` (Route B bosses are harder than the level alone)
export function bossScale(def) {
  const s = scaleFor(def.nativeLevel ?? def.level, def.level), d = def.difficulty || {};
  return { ...s, hp: s.hp * (d.hp || 1), power: s.power * (d.power || 1), windup: d.windup || 1 };
}
// band that shifts summoned adds by the same number of levels as their boss
export function shiftBand(shift) { return shift ? { from: [0, 200], to: [shift, 200 + shift] } : null; }

// future party system: HP / poise multiplier for `members` players (1 = solo)
export function partyScale(members = 1, r = LEVEL_SCALING) {
  const n = Math.max(0, (members | 0) - 1);
  return { hp: 1 + n * r.party.hp, poise: 1 + n * r.party.poise };
}
