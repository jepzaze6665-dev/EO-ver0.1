# ECLIPSE ONLINE — guide for Claude (read first in every new chat)

Top-down dark-fantasy action RPG prototype. Vanilla ES modules + HTML5 Canvas, no dependencies.
Owner is a solo **beginner** developer who writes in **Thai** → answer in Thai, explain every change as
**FILE / CHANGE / REASON**, then *how to run*, *how to test*, *expected result*, *possible errors*.
Push to GitHub (`origin` = github.com/jepzaze6665-dev/EO-ver0.1, branch `main`) when the owner asks.

## Run / test
- `node server.js` → http://localhost:5173 (Claude preview config name: `eclipse-online`, `autoPort` on, see `.claude/launch.json`).
- Unit tests: `node tools/tests/run.mjs` (must print `ALL TEST FILES PASSED`).
- In-game (browser console, page loaded): `const C = await import('/tools/combatTest.js'); C.runAll(__game)`
  (combat / mechanics / Reaper / class-change checks, currently 101/101),
  `const L = await import('/tools/checklist.js'); L.runChecklist(__game, classId)` (spec TEST 1-31),
  `const T = await import('/tools/testkit.js'); T.playthrough(__game, 'nightfall_reaper')` (17-step full-game regression, any class)
  `T.routeA(__game, classId)` (V2.2 vertical slice, 29 steps: walks every boss gate on foot, 3 boss fights, City 2, save/load),
  `T.bossReset(__game)` (death mid-fight resets the boss)
  and `T.mapTour(__game)` (every map exit both ways, locks, no transition loops, everything reachable on foot from
  each map spawn), `T.a1Loop(__game, classId)` (guide → A1 → fight → EXP/gold/loot → back to the guide).
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
- World progression (V2.2): `src/world/worldProgression.js` owns defeatedBosses / unlockedMaps / triggeredEvents /
  currentRoute (quests + secrets are read from their own systems); gates and exits ask it through requirement data
  (`boss_defeated`, `map_unlocked`, `map_visited`, `event` in progression/requirements.js) — never `if (bossDead)`.
  Bosses = `src/data/bosses.js` (impl 'area' = generic `boss/areaBoss.js`, 'guardian' = the V2 Guardian), lifecycle in
  `boss/bossSystem.js` (pure state machine `boss/bossState.js`). World triggers = `src/data/worldTriggers.js`.
  Map data: `type/route/nextMap/bossId/requires/gates/hiddenAreas` (maps/mapRegistry.js explains every field).
- Don't build yet (spec): multiplayer/network, accounts/DB, guild, trading, PvP, real secret classes / secret bosses, world events.
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
- Bash heredocs here eat backslashes (a written `\\n` arrives as `\n`, a `\n` as a real newline): write JS that
  contains escapes with Write/Edit,
  or check the result with `node --check`.

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
  beyond_lumina. P8: **separate maps** over the one generated terrain (same world tile coordinates everywhere): defs in
  `src/maps/{luminaVillage,fieldA1,fieldA2,fieldA3,majorBossArena,ancientValley}.js` + `mapRegistry.js` (region = zones
  [+ minTy/maxTy], spawn, exits {rect, to, entry, requires.flag}); `src/world/mapManager.js` (tile → area, bounds, BFS
  `nextExit` for quest arrows), `src/world/transitionSystem.js` (exits, locks, boss-fight lock, cooldown). Only the active
  map is walkable (`WorldMap.isSolid` + `activeArea`; `isTerrainSolid` ignores maps), simulated, hostile, drawn (other
  maps masked black) and on the minimap. Teleports / load / respawn: `world.syncMapToPlayer()`. Events mapExited/
  mapEntered; save stores `player.map`; quest `reach {map}`. A1 = forest south of the river (y ≥ 98), A2 = north +
  Hidden Cave, A3 = ruins + gate. P9: map files can own content (`content.interactables` / `content.spawns`,
  `content.optional` = Optional Area sub-banner); A1 = tutorial area: Hunter's Notice (combat basics) + 2 Crystal Glade
  warnings (Optional Area, Lv.6 beasts). Fixed V1 terrain bugs found by the reachability test: log bridge never touched
  its banks, Bramble Lane was walled off from the village. P10: A2 = Deep Forest: `corruptedMonsters: true` in the map
  data decides corruption (A1 beasts are now normal), `content.hazards` run by `src/world/hazardSystem.js` (miasma =
  statuses while inside, thorns = telegraphed strike + root; `while: { flag / notFlag }`; off after the Guardian),
  crossroads sign. Hidden content foundation: `src/data/hidden.js` ({ id, type, map, trigger{event, match}, chance,
  condition, reward, once, flag }) + `src/world/hiddenSystem.js` → 'hiddenFound' (rewards via Experience/Loot systems,
  flags `hidden_<type>_found`, saved in world.state.hidden); the 4 secret areas pay their 60 EXP through it.
  P11: A3 = Ancient Ruins: map `monsterMod` (tougher, +EXP, +2 level; Monster opts.areaMod, per-instance `level` shown
  in nameplates / target frame), first Elite (Crystal Beast at the shrine, `content.spawns` elite + unique; ELITE_MOD hp ×4),
  rune-ward `beam` hazards (shrine yard until shrineInvestigated, gate antechamber until gateOpened), NPC Kael
  (`content.npcs`, dialogue 'kael'), boss entrance = exit `confirm` (panels.confirm; "Not yet" returns you to where you
  stood; tests set `transitions.autoConfirm`). P12: Major Boss = Guardian (11 telegraphed moves, 3 phases, damage
  gates, weak windows) + **Heartwood Ward**: living Thornling adds tether it (status `heartwood_ward`, −50% damage
  taken) so AoE / taunt / control matter (§26). Boss UI = `boss.hudState()` snapshot drawn by hud.drawBoss (no boss
  internals in the HUD); `world.boss` = the current map's boss (map `boss` field); name/title/defeat texts/follow-up
  quest in `MONSTERS.guardian` (`title`, `defeat`). `T.bossArena(__game, classId)` checks it. Boss balance (bot): all
  classes WIN (Astral ~100 s, Umbral ~110 s, Reaper ~105 s, Aegis ~155 s). P13: HUD shows EXP numbers + gold, minimap
  caption = map name + sub-area; `Player.heal(amount, source)` → 'healed' event (+N HP text); crits show CRITICAL
  (listener on damageDealt). P14: save split into `src/save/storage.js` (LocalStorageAdapter / MemoryAdapter — a server
  adapter later), `src/save/saveData.js` (pure: SAVE_VERSION 2, v1→v2 migration, parse + validate/repair) and
  `src/save/save.js` (snapshot, backup key `..._backup`, falls back to it when the main save is damaged, `lastError`,
  no save while dead / in a boss fight); `game.saveGame()` / `game.loadGame()` (returns false + toast on failure).
  Verified: save → real page reload → load = identical state. P15: F3 overlay moved to `src/ui/debugOverlay.js`
  (`__game.debugInfo()` from the console: map, pos, HP/LV/EXP/class/resource/gold, target, enemies on the map, effects,
  quest state, boss); spec TEST 1-31 = `tools/checklist.js` (`L.runChecklist(__game, classId)`, 31/31 for all 4 classes).
  (V2.1 P1-15 + V2.2 merged on branch merge-v2.2; boss bar = BossSystem.barInfo + the boss's hudState() tags;
  save = V2.1 storage/backup/validation + V2.2 `worldProgress` section.)
- **V2.2 "World Progression + Boss Gate + Boss Foundation"** (owner's 37-point spec; world scale fixed: 2 cities,
  Route A playable, Route B data-only). Done — Route A vertical slice: Lumina → A1 → **Boss A1 Hollow Fang** (Howling Den,
  carved east of the River Crossing waystone by `buildHowlingDen` in forest.js; 1 phase: bite/lunge/howl) → bridge gate →
  A2 → **Boss A2 Grukk the Thornbound** (Goblin Glade; 2 phases: cleave/leap/cross drums/war-cry adds → thorn ring with a
  gap, poison spears) → Ancient Path gate → A3 → **Major Boss A3 = Guardian** (+ Final Attack "Last Root of the Forest"
  at 12%, HP floor until seen) → arena north gate → **City 2 Valehaven** (= the old Ancient Valley map, id `city2`, safe,
  no wraiths; old `valley` map id is gone, quest id `valley` kept). Save v2 adds `worldProgress`; older saves are
  migrated (visited maps / guardian flag → defeated bosses). Quest `route_a` (priority 1) is the spine, started by a
  world trigger after `beyond_lumina`. HUD: route panel, generic boss bar (area / major), idle boss labels, locked
  exit text; world map lists route progress. Save storage = `src/save/storage.js` adapters (merged with V2.1 P14).
  Boss HP (bot, god mode): A1 4500 ≈ 35 s at LV 4, A2 9000 ≈ 75 s at LV 7, Guardian 12000 ≈ 90 s at LV 10.
- Later (owner decides): Route B maps + bosses (add maps/b1..b3 + fill the `planned` boss entries), real
  hidden events per map, City 2 services, balance pass with a human player.
- **Current: COMBAT 2.0 "Fast Action + Souls-lite Decision Combat"** (owner's spec §38-69). Already existed before it:
  Perfect Dodge (projectiles + enemyStrike, slow-mo, purple flash), Aegis guard + perfect guard (guardSystem), monster
  stagger meter, `vulnerable` openings after heavy enemy attacks, boss weak windows, Shadow Mark → Shadow Break (Q).
  Owner decisions: **Sprint removed** (Shift freed); **Guard/Parry stays Aegis-only** (Shift / RMB / Q hold for Aegis;
  other classes: RMB stays = the Q special); **party = foundation only** (attack slots, downed state, target lists
  over "players", solo-playable; no networking). Phase plan:
  C1 Stamina core (shared resource, 100, regen after delay; dodge 22 replaces dodge charges; guard drain / parry cost;
     optional skill `stamina` cost in data) + remove sprint + HUD stamina bar.
  C2 Dodge 2.0 + Perfect Dodge rewards (generic: +1 mark / resource via class hook, small cooldown cut, counter window).
  C3 Counter Window (generic status after perfect dodge / parry / enemy whiff: less DEF, more damage taken).
  C4 Poise (stagger → poise with regen, visible on bosses/elites; Guard Break on heavy hits for Aegis).
  C5 Enemy commitment + roles (startup/active/recovery data, miss → recovery; wolf flank, goblin, crystal weak point).
  C6 Attack Slot system (limited simultaneous attackers, party-ready target selection).
  C7 Skill commitment tiers (fast / medium / high data) + Shadow Break / Eclipse Sever feel pass.
  C8 Combat UI (◇◇◇ 0/3 + SHADOW BREAK READY, DODGE [SPACE] hint until learned, quest UI fades in combat, boss poise).
  C9 Party foundation (Downed state + revive interface, ENCOUNTER FAILED → checkpoint + boss reset).
  C10 Anti-tanking + balance + full regression.
  Done C1: 'stamina' in data/resources.js (every player's pool gets it; regen { delay } = pause after spending),
  costs in `src/data/stamina.js` (dodge 22 — replaces the 2 dodge charges; Aegis guard: raise 5, hold 6/s, block
  0.4 × damage (4-25), parry refunds 12, empty → guard drops + 'guardBroken'); skills may set `stamina: n`
  (SkillSystem → SKILL_FAIL.STAMINA; Umbral: 8/12/15/20/30); ResourcePool.drain(); sprint removed (walk ×1.08; Aegis
  guard also on Shift); HUD STA bar under HP (red when a dodge is unaffordable). tools/tests/stamina.test.mjs.
  Balance after C1 (bot): UB 158 · AW 133 · AG 93 · RP 184 dummy DPS, all WIN the Guardian. Next: C2.
- Known art limits: AG walk sheet barely moves its legs (a code step-bob compensates; new walk art would fix it).
