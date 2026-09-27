import { CLASSES } from '../skills/classes.js';
import { CLASS_TREE } from '../data/classTree.js';
import { Player } from '../player/player.js';

// CLASS CHANGE — turns the current character into another class it owns.
//   owns = the class it started with + every class unlocked through progression (trials)
// What changes: preset (sprites / anims), resource pool, skill set + loadout, class passives, guard,
//   signature gear. What stays: level, EXP, gold, position, HP ratio, inventory, quests, class records.
// A class can only be changed to once its data exists in skills/classes.js (Class 2: Phase 15/16).
export const CLASS_CHANGE_RULES = {
  allowInCombat: false,
  allowInBossFight: false,
};

// why a change is (not) possible — machine-readable reason for the UI
export function classChangeCheck(game, toId, { force = false } = {}) {
  const p = game.player, prog = game.progression;
  if (!CLASSES[toId]) return { ok: false, reason: CLASS_TREE[toId] ? 'not_playable' : 'unknown' };
  if (p.cls.id === toId) return { ok: false, reason: 'same' };
  if (!force && !prog.owns(toId)) return { ok: false, reason: 'locked' };
  if (p.dead) return { ok: false, reason: 'dead' };
  if (!CLASS_CHANGE_RULES.allowInCombat && game.combat.inCombat) return { ok: false, reason: 'combat' };
  if (!CLASS_CHANGE_RULES.allowInBossFight && game.world.bossActive) return { ok: false, reason: 'boss' };
  return { ok: true };
}

export function changeClass(game, toId, opts = {}) {
  const check = classChangeCheck(game, toId, opts);
  if (!check.ok) return check;
  const old = game.player, from = old.cls, to = CLASSES[toId];

  // signature gear follows the class; other equipment (found / crafted) stays equipped
  const eq = game.equipment;
  for (const slot of ['weapon', 'armor']) {
    const oldSig = from.startingGear && from.startingGear[slot], newSig = to.startingGear && to.startingGear[slot];
    if (!newSig || eq.slots[slot] !== oldSig) continue;
    if (oldSig && !game.inventory.has(oldSig)) game.inventory.add(oldSig, 1, true);
    eq.slots[slot] = newSig;
  }

  const p = new Player(game, to, game.spritesFor(to));
  p.x = old.x; p.y = old.y; p.facing = old.facing;
  p.level = old.level; p.exp = old.exp; p.gold = old.gold;
  p.recomputeStats();
  p.hp = Math.max(1, Math.round(p.maxHp * (old.maxHp ? old.hp / old.maxHp : 1)));
  old.dispose();
  // anything the old class left in the world
  game.marks.clearEntity(old);
  for (const th of [...game.threads.list]) if (th.owner === old) game.threads.expire(th, 'classChanged');

  game.player = p;
  game.classId = toId;
  game.spriteReport = game.validateSprites ? game.validateSprites(to.preset) : game.spriteReport;
  game.progression.history.push({ from: from.id, to: toId, level: p.level });
  game.events.emit('classChanged', { from: from.id, to: toId, player: p });
  game.save.dirty = true;
  return { ok: true, player: p };
}
