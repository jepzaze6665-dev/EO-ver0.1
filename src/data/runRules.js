// DUNGEON RUN RULES (owner 2026-10-02, ONLINE N9) — read by src/dungeon/runSystem.js.
// A RUN starts when you step from a city (Lumina / City 2 = data/online.js sharedMaps — the secret Valehaven is part of the
// dungeon) onto any other map and ends when you step into one of those cities (the run is BANKED:
// everything gained stays yours). DYING in a run (the death panel -> Return to Checkpoint) costs:
//   - expLoss of the EXP earned from monsters in this run (bosses included; quest / secret EXP is never lost). The level
//     never goes down: the loss stops at the start of the current level.
//   - EVERY item gained in this run (bag counts above the run start, gear instances new since the start — worn ones too)
//     drops as a DEATH PILE where you fell. Only you can open it; a party member can carry it to you (online). A second
//     death replaces the old pile (its items are gone). Gold is not an item: it is kept.
//   - never dropped: key items (`key: true`) and quest items (type quest_item) — quests must not break.
export const RUN_RULES = {
  expLoss: 0.5,
  keepTypes: ['quest_item'],
  pileRadius: 40,   // E range at the pile
  helpRange: 120,   // server check for a party member carrying it (px, from the presence position)
};
