// ITEM SETS (data only) — wearing several items of one set turns on its bonuses. An item joins a set with `setId`;
// the set's pieces = every item naming it (no list to keep in sync here). items/setSystem.js counts the worn pieces.
//   name, description, color : shown in the tooltip / Loadout window
//   bonuses : [{ pieces, modifiers?, effects?, text }] — pieces = worn items needed; every bonus with pieces <= the count is on.
//             modifiers = same format as an item (data/items/rules.js MODIFIER_TYPES; they join the item modifier set, so
//             the same caps apply); effects = same format as an item effect (trigger / condition / effect / cooldown / text).
// A set is a BUILD option, never a must: bonuses are small, each piece is still a sidegrade on its own.
export const SETS = {
  iron_vigil: {
    name: 'Iron Vigil', color: '#c8b080',
    description: 'Old watch-post gear. Alone, each piece is plain iron; together they hold a line.',
    bonuses: [
      { pieces: 2, modifiers: [{ type: 'guardGeneration', value: 0.1 }], text: '+10% Guard Generation.' },
      {
        pieces: 3, text: 'Block: -10% damage taken for 3 s (4 s cooldown).',
        effects: [{ trigger: 'onBlock', effect: { type: 'modifyStat', stat: 'damageReduction', value: 0.1 }, duration: 3, cooldown: 4,
          text: 'Block: -10% damage taken for 3 s (4 s cooldown).' }],
      },
    ],
  },
};
