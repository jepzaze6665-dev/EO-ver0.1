# ECLIPSE ONLINE — guide for Claude (read first in every new chat)

Top-down dark-fantasy action RPG prototype. Vanilla ES modules + HTML5 Canvas, no dependencies.
Owner is a solo **beginner** developer who writes in **Thai** → answer in Thai, explain every change as
**FILE / CHANGE / REASON**, then *how to run*, *how to test*, *expected result*, *possible errors*.
Push to GitHub (`origin` = github.com/jepzaze6665-dev/EO-ver0.1, branch `main`) when the owner asks.

## Run / test
- `node server.js` → http://localhost:5173 (Claude preview config name: `eclipse-online`, `autoPort` on, see `.claude/launch.json`).
- Unit tests: `node tools/tests/run.mjs` (must print `ALL TEST FILES PASSED`).
- In-game (browser console, page loaded): `const C = await import('/tools/combatTest.js'); C.runAll(__game)`
  (combat / mechanics / Reaper / class-change checks, currently 101/101) and
  `const T = await import('/tools/testkit.js'); T.playthrough(__game, 'nightfall_reaper')` (17-step full-game regression, any class).
  `game.simulate(sec, perStep)` drives the game deterministically even when the tab is hidden.
- After editing `tools/testkit.js`, **reload the page**: `combatTest.js` imports it without a cache-busting query.

## Architecture rules (from the V2 master prompt — keep them)
- Core systems never name a class. Classes are **data + behaviour** calling core systems; passives react to
  bus events through the class's `on: { eventName(p, g, e) {} }` hooks.
- Pipeline: calculate (pure) → apply → feedback → events. Gameplay state is separate from DOM/UI (server-ready).
- Core (`src/combat/`, `src/status/`, `src/progression/`): damageSystem (pure, incl. execute stats), resourceSystem
  (+ resource `tiers` → stat bonuses), skillSystem (+ cooldownSystem, REQUIREMENTS incl. `markedFoe`), markSystem,
  threadSystem, summonSystem, guardSystem, StatusSet; rules live in `src/data/*.js` (resources, marks, statuses, threads,
  summons, classTree). Hitboxes may carry `powerFor(target)` (per-target power); VFX sprites support `ground` / `frame`.
- Classes: `src/skills/{umbralSword,astralWeaver,aegisGuardian,nightfallReaper}.js`, registry `src/skills/classes.js`
  (`STARTING_CLASSES` = the 3 tier-1 classes; Class 2 is reached only by class change). Passives for the codex: `passives`.
  Skill loadout (keys 1-4 chosen, 5 = ultimate, Q = special): `src/player/loadout.js`.
- Progression: `src/data/classTree.js` (tree, class-record counters as event filters, trials),
  `src/progression/{requirements,progression,classChange}.js`. Secret classes / awakenings = data only
  (`hidden` + `reveal`). Class 2 nodes stay `playable: false` until their class data exists.
- Don't build yet (spec): multiplayer/network, accounts/DB, guild, trading, PvP, real secret classes, world events.
- If a request would break the architecture: explain the problem, propose a better way, then implement.

## Assets (never reference a path without a real file)
- Raw art: `desgin/class cr/<UB|AW|AG NEW|RP>/`, `desgin/VFX/<UB|AW|AG|RP>/` (AI sheets: fake checkerboard
  background, 6 columns × 4 direction rows).
- `node tools/build-player.js [ub|aw|ag|rp]` → `assets/player[/<preset>]/*.png + atlas.json`. Every preset is
  normalised to the same standard: canvas 160×160, pivot (80,140), neutral body ≈ 58-59 px. Frames are cut by
  blob ownership (effects never sliced); per-sheet `{ frames: 5 }` for 5-pose rows; `emptyFrames` recorded.
- `node tools/build-vfx.js` → `assets/vfx/*.png + vfx.json` (right-facing strips, rotated at runtime;
  per-file `rows` (front view for caster-centred effects) and `mirrorFrames`).
- `tools/tests/sprites.test.mjs` fails if any class animation uses an empty frame.

## Machine / tooling gotchas (Windows, this repo)
- Files get CRLF on checkout: normalise to LF before string-replacing multi-line code in scripts.
- `node -e "..."` with complex quoting can hang (waits on stdin) → write edit scripts to a file
  (scratchpad) and run them with `</dev/null`; prefer the Write/Edit tools.
- Never `git stash` / `git checkout --` a file with uncommitted work without checking first.

## Status (update this section at the end of each phase)
- Done: V1 vertical slice; V2 phases 1-14 — combat foundation, resources, skills/cooldowns, marks, statuses,
  Astral Weaver + threads, combat tests, Umbral Sword refinement (Shadow Veil, Phantom Edge, loadout),
  Aegis Guardian + guard system (new AG art), class progression (records, requirements, trials), class change,
  class UI (tree + codex); Phase 15-16 — Nightfall Reaper (first playable Class 2, owner's design): Nightfall Gauge
  (tiers 50 DUSK / 80 NIGHTFALL), Shadow Mark on enemies (`reaper_mark`, hold → Mark Explosion), skills Reaper's Arc,
  Phantom Reap, Shadow Doppel (SummonSystem clone), Nightfall Zone; Q = Reaper's Step; ult Funeral Eclipse; passives
  Death Harvest (enemyKilled) + Bloodless Night (execute stats). Unlock: UB lineage, 20 Shadow Breaks + Trial of the Long Night.
- Balance (bot, dummy DPS over 3 dummies): Umbral ≈ 158-160, Astral ≈ 134, Aegis ≈ 92, Reaper ≈ 188-201 (its single-target
  DPS ≈ Umbral's; the extra is AoE on the 2nd dummy); all beat the Guardian solo.
- Later Class 2 work (paused for V2.1): Duskrunner / Blade of Echoes / AW / AG paths need the owner's class data.
  Unused RP art: `sk6` (anim `harvest`) is mapped but no skill plays it yet.
- **Current: V2.1 "Class × World Integration"** (owner's 16-phase spec: Lumina → A1 → A2 → A3 → Boss Arena, EXP/loot/
  quest/target/save). Owner chose **B = real separate maps with transitions** (not the seamless zone world) and
  **start at LV 1** (cap 30). Done: P1 audit, P2 level rules in `src/data/levels.js` + pure `src/progression/experience.js`
  (class `base` = level 1, `perLevel` × `statGrowth`; `levelUp` / `expGained` events; Class 2 needs LV 10; tests set LV 10
  for the boss). P3: monster deaths emit `enemyDefeated` (world.js) → `ExperienceSystem`
  (`src/progression/experienceSystem.js`), `LootSystem` (`src/loot/lootSystem.js`, tables in `src/data/lootTables.js`,
  monsters name `loot: '<table>'`), quests, knowledge; boss reward = same event, once; `player.addGold/removeGold/canAfford`;
  `src/combat/targetSystem.js` (Tab nearest/cycle, click, auto on hit; HUD target frame). P4: monster states = `MONSTER_STATE`
  (idle/patrol/aggro/chase/attack/hit/return/dead), spec getters (name, attack, movementSpeed, aggroRange, attackRange,
  expReward, lootTable), `ELITE_MOD` (spawn `elite: true`, extra 'elite' loot roll), stuck-on-wall → RETURN (+ snap home),
  display levels for LV 1 (wolf 2 · goblin 4 · crystal beast 6 · alpha 8 · guardian 10 · wraith 12). EXP budget: one clear
  before the boss ≈ LV 8, after boss + quests ≈ LV 10. P5: all EXP via events (`expSources` in levels.js).
  P6: `MAX_STACK` / `maxStackOf` (items.js), Inventory.add caps + returns added, `itemCollected` / `inventoryFull`; all
  gold through addGold/removeGold/canAfford. P7: quest data in `src/data/quests.js` (name/description/giver/autoStart/
  ordered/requirements/rewards; objectives kill·collect·talk·reach·boss·flag + `marker`), `src/quests/quests.js` is generic
  (events questAccepted/Updated/Completed; NPC "!" + HUD arrow from data). Main quest `beyond_lumina` (auto on New Game,
  Village Guide = Captain Aldric), `whispers` now ends with "Report to Elder Maren"; `first_steps` (side) needs
  beyond_lumina. Next: P8 Lumina integration + the B map split (separate maps + transition system), then A1/A2/A3/arena. Monster display levels / zone "Lv." subtitles still show the old 5-15 range (fix in P4).
- Known art limits: AG walk sheet barely moves its legs (a code step-bob compensates; new walk art would fix it).
