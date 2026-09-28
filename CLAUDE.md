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
  `T.routeA(__game, classId)` (W2 Route A, 26 steps: A1 on foot, 2 optional mini-bosses, Guardian, north road into A2 on
  the other grid, secret city Valehaven, save/load),
  `T.bossReset(__game)` (death mid-fight resets the boss)
  `T.dodgeCheck(__game, classId)` / `T.counterCheck(__game, classId)` / `T.poiseCheck(__game)` / `T.enemyCheck(__game)` / `T.slotCheck(__game)` / `await T.tierCheck(__game)` / `T.uiCheck(__game)` / `await T.partyCheck(__game)` / `T.tankCheck(__game)` (Combat 2.0),
  `T.gridCheck(__game)` (W1 multi-grid: lock/unlock, load/unload + cleanup, save/load + fog on another grid, no leaks, respawn),
  `T.cityCheck(__game)` (City 2: unlock, north road, services, quest, save/load), `T.a3BossCheck(__game, classId)`,
  and `T.mapTour(__game)` (every map exit both ways, locks, no transition loops, everything reachable on foot from
  each map spawn), `T.a1Loop(__game, classId)` (guide → A1 → fight → EXP/gold/loot → back to the guide).
  `game.simulate(sec, perStep)` drives the game deterministically even when the tab is hidden.
- The preview pane in the background pauses `requestAnimationFrame`: the game does not advance (a map-entry fade
  looks "stuck" black). Drive it with `game.simulate(sec)` before screenshots.
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
  Map data: `grid/type/route/nextMap/bossId/requires/gates/hiddenAreas` (maps/mapRegistry.js explains every field).
- GRIDS (W1): every map names a `grid` = one tile map (`src/world/levels/`: index.js LEVELS + START_GRID, one module per
  grid: `size`, `seed`, `generate(builder)`, optional `setup(world, level)` / `apply(world)` = that grid's own objects and
  flag rules). ONE grid is loaded: `World.enterGrid` / `unloadGrid` swap the level fields (map, npcs, interactables,
  spawnPoints, monsters, guardian, ...); unload drops monsters / projectiles / telegraphs / vfx / render cache (tile map
  kept, so terrain changes survive). `changeMap` loads the target map's grid; MapManager lookups by position are per
  grid (`idAt(x, y, gridId?)`); quest tile markers are on START_GRID unless they name `map`. Secrets are world-wide
  (`world.secretsFound`); fog per grid (`revealed` + `revealedGrids` in the save); respawn = `world.checkpoint()`.
  Grids: `whispering` (A1 + Lumina + Valehaven), `ancient_valley` (A2 + Magma Rift), `citadel` (A3 + Sanctum), `asteria` (City 2).
- Don't build yet (spec): multiplayer/network, accounts/DB, guild, trading, PvP, real secret classes / secret bosses, world events.
- If a request would break the architecture: explain the problem, propose a better way, then implement.

## Assets (never reference a path without a real file)
- Monster art: `desgin/monster/<A|B>/<A1..A3|B1..B3>/` (1..4, BOSS, VFX BOSS, AURA Phase BOSS / Phase BOSS).
- Raw art: `desgin/class cr/<UB|AW|AG NEW|RP>/`, `desgin/VFX/<UB|AW|AG|RP>/` (AI sheets: fake checkerboard
  background, 6 columns × 4 direction rows).
- `node tools/build-player.js [ub|aw|ag|rp]` → `assets/player[/<preset>]/*.png + atlas.json`. Every preset is
  normalised to the same standard: canvas 160×160, pivot (80,140), neutral body ≈ 58-59 px. Frames are cut by
  blob ownership (effects never sliced); per-sheet `{ frames: 5 }` for 5-pose rows; `emptyFrames` recorded.
- `node tools/build-vfx.js` → `assets/vfx/*.png + vfx.json` (right-facing strips, rotated at runtime;
  per-file `rows` (front view for caster-centred effects) and `mirrorFrames`).
- `tools/tests/sprites.test.mjs` fails if any class animation uses an empty frame.
- Monsters: raw sheets `desgin/monster/<A1|A2|A3>/<1|2|boss>` (no extension, 2048² AI sheets, checkerboard / flat bg,
  different frame count per row) → `node tools/build-monsters.js [id]` (`--probe` = print rows / frames + previews in
  <os tmp>/eo-monster-probe) → `assets/monsters/<id>.png + monsters.json` (one atlas per monster, shared cell, feet
  pivot, rows mirrored to face right). Row layout per sheet = `SHEETS` in the tool. Which frames play = data
  `src/data/monsterArt.js` (idle/move/windup/attack/hurt/death/front/back + extras, per-attack overrides, boss `poses`,
  `replaces` sprite keys, `corrupt` tint → the 'C' variant). `src/monsters/sheetSprites.js` builds sets in the same shape
  as the canvas placeholders (monsterSprites.js), so Monster / AreaBoss / Guardian draw them; `tools/tests/monsterArt.test.mjs`.
- Map art per route map: `desgin/Map/A/<a1|a2|a3>/` (2 sheets each: tileset + props, 2048², dark navy bg; files may or may
  not end in .png), references `desgin/Map/Ref/`. GROUND = tile skins: `node tools/build-tiles.js [--preview]` cuts the
  tile cards, crops the painted border, wrap-blends the edges (seamless), shrinks to 32 px, evens the variants' colour →
  `assets/tiles/<skin>.png + tiles.json`; a grid names `skin` (world/levels) and `maps/tileSkins.js` swaps those tile
  types / wall faces into that grid's tileset only. PROPS: `tools/extract-props.js` (manifest; 2048 sheets use `SCALE`
  0.5; A2 props = `v_*`). The sheets' transition / edge tiles are NOT usable as autotiles (engine blends edges itself).
  `tools/tests/tiles.test.mjs`.
- UI kit (PIXEL-ART style — the owner dropped the first painterly kit as not matching the game): `desgin/UI/{plate,frame_kit,slot_frame,bar_frame,crystal}.png`
  (AI sheets, black background) → `node tools/build-ui.js` → `assets/ui/*.png + ui.json` ({ file, w, h, slice? }; background flood-removed
  from the chosen edges + soft fringe, pieces found as blobs, named in reading order or by 3×3 grid). Loaded as
  `Assets.ui[name]` (core/assets.js). `tools/tests/ui.test.mjs` checks every piece exists / is cut out.

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
  After Combat 2.0 (stamina, tiers, poise, slots, anti-tank): UB ≈ 159 · AW ≈ 134 · AG ≈ 95 · RP ≈ 190, all WIN the Guardian (80-125 s).
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
  Balance after C1 (bot): UB 158 · AW 133 · AG 93 · RP 184 dummy DPS, all WIN the Guardian.
  Done C2: dodge rules in `src/data/dodge.js` (time/dist/iframes, recovery 0.08 s, perfectWindow 0.2, perfectCooldown,
  slowMo; pure `isPerfectDodge`); one dash at a time (no dodge / attack / skill until dash + recovery); Perfect Dodge
  rewards = class data `perfectDodge { marks, resource, stamina, cooldownCut, statuses[] }` applied by Player
  (all 4 classes converted, +10 stamina refund; hook `onPerfectDodge(p, g, attacker)` only for extras);
  event 'attackDodged' { attacker, player, perfect } from enemyStrike / projectiles (for C3 Counter Window).
  `T.dodgeCheck(g, classId)` (8 steps) + tools/tests/dodge.test.mjs.
  Done C3: `src/combat/counterSystem.js` (game.counters) + rules `src/data/counter.js`: attackDodged (perfect 1.6 s /
  whiff 0.8 s) and perfectGuard (parry 2.0 s) put status `counter_window` on the attacker (DEF ×0.5, damage taken ×1.2;
  bosses / elites ×0.6 duration); first player hit inside it = 'counterHit' first + class data `counterBonus
  { marks, resource }` (UB +1 mark +5); hitboxes may carry `counterMult` (UB Twin Fang 1.3, Eclipse Sever 1.25).
  New status modifier `defenseMult` (damageSystem target.defenseMult). `game.sharedWorld` (false): when true,
  slow-mo / hit stop never touch the simulation (party / online: client-side presentation only).
  `T.counterCheck(g, classId)` (7 steps) + tools/tests/counter.test.mjs.
  Done C4: POISE = `src/combat/poiseSystem.js` (Poise class, pure) + rules `src/data/poise.js` (monster: regen after
  2 s, break immunity 2.5 s = no stun-lock, heavy wind-up armour ×0.5; boss: slow regen while fighting; counter ×1.5,
  big ×1.2). Data field `poise` replaces `staggerMax` (monsterTypes.js, bosses.js stats; elites ×2); Monster /
  AreaBoss / Guardian use it ('poiseBroken' event; bosses → STAGGERED weak window as before; boss bar = poise used up;
  elites show a poise bar in the target frame). GUARD BREAK (Aegis): `STAMINA.guardBreak` + status `guard_broken`;
  stamina empty or a `guardBreak` attack blocked without a parry → guard down, 0.7 s stun, −30 stamina, 60% damage
  through; parry beats it; `unblockable` ignores guard + parry. Tagged: monster `heavy` attacks, A1 lunge, A2 leap,
  Guardian smash / charge / jump (guardBreak), Guardian Final Attack (unblockable). `T.poiseCheck(g)` (8 steps) +
  tools/tests/poise.test.mjs. Checklist step 11/13 hardened (monsters could leave the player hurt → flaky).
  Done C5: `src/data/enemyCombat.js` (STARTUP = windup → ACTIVE → RECOVERY; roles). A monster / area-boss attack that
  hits nobody = 'attackMissed' + MISS text + recovery × missRecoverMult 1.5 (bosses 1.3, attack `missRecover`, goblin
  slam 2.0) → CounterSystem opens a 'whiff' window (unless a dodge already did). Roles in monster data (`role`:
  skirmisher / bruiser / tank / caster / swarm, shown in the codex + a fight hint): wolf `flank` (orbits to the
  player's side / back) + `punishIdle` 1 s (lunge `punish: true` ignores its cooldown vs a player standing still,
  Player.idleT); goblin bruiser; crystal tanks (existing armour / back core). `T.enemyCheck(g)` (5 steps) +
  tools/tests/enemyCombat.test.mjs.
  Done C6: ATTACK SLOTS `src/combat/attackSlots.js` (pure, game.attackSlots) + `src/data/attackSlots.js`: each player
  has capacity 3 points (normal attack 1, heavy 2); a monster must hold points from wind-up to end of recovery (released
  on leaving ATTACK / death, back after 0.25 s; stale holders pruned); without them it waits (`monster.waiting`) and
  circles just outside reach. Bosses don't use slots, their adds do. TARGETING `src/combat/targeting.js` (pure
  scoreTarget / pickTarget over `game.players()` — solo = [player], party-ready): taunt > vulnerable (guard-broken /
  stunned) > low HP > skirmishers → ranged classes > sticky current > distance; re-picked every 1.5 s (`monster.target`).
  combat.enemyStrike + enemy projectiles hit every player in `game.players()`. `T.slotCheck(g)` (5 steps: 5-monster
  pack never exceeds capacity, all get turns) + tools/tests/attackSlots.test.mjs. counterCheck damage compare now
  uses knock 0 + 6 samples (was flaky).
  Done C7: `src/data/skillTiers.js`: every class skill (1-5 + Q special) names `tier` fast / medium / high
  (limits: fast dur ≤ 0.45 + early cancel, medium ≤ 0.7, high ≥ 0.6 + superArmor; pure `tierProblems`), default
  stamina 6 / 12 / 25 via `staminaCost(skill)` (SkillSystem; own `stamina` overrides, 0 = free: Shadow Break,
  Aegis Guard) → AW / AG / RP skills now cost stamina too. Tier + STA shown in the Skills tab and skill tooltip.
  Player.addMark no longer hardcodes UB text: full marks = short hit stop + the class hudCounter readyText + event
  'marksFull'. Shadow Break adds the large slash sprite + a delayed shadow particle explosion (§55 order).
  `T.tierCheck(g)` (async, 8 steps: real cast() actions vs their tier + stamina spent) + tools/tests/skillTiers.test.mjs.
  Done C8 (combat UI §67, rules `src/data/combatUI.js`, presentation only): DODGE [SPACE] hint fades out for good after
  5 dodges or a Perfect Dodge (event 'playerDodged', `game.stats.dodges`, saved world flag `tut_dodge`); quest tracker +
  route panel fade to 22% while the fight is intense (boss fight, anyone holding an attack slot on you, or 2+ aggro
  enemies on the map — `hud.intenseFight()`) and come back after; boss bar meter = POISE left (label POISE / WEAK).
  Already there: HP / STA / resource / EXP frame, ◇◇◇ n/3 + SHADOW BREAK READY, skill bar 1-5 Q R F.
  `T.uiCheck(g)` (6 steps).
  Done C9 (party foundation, no networking): `src/party/partySystem.js` (game.party, members; solo = party of one) +
  `src/data/party.js` (max 4; downed: bleedOut 20 s, reviveTime 3 s hold [E], range 48, reviveHp 30%). 0 HP →
  Player.onDeath → game.onPlayerDeath(p) → party.onDefeated: teammates standing → DOWNED (`p.downed`, not dead,
  no damage, drawn lying down, enemies ignore it: game.players() = standing members) else ENCOUNTER FAILED
  (event 'encounterFailed', death panel = "ENCOUNTER FAILED" + Return to Checkpoint → game.respawn(): party.reset,
  last waystone / village, engaged boss resets). Revive = party.tryRevive(reviver, dt) each frame the reviver holds
  it (local: hold E); a hit on the reviver or letting go interrupts. HUD: DOWNED + bleed-out + revive bars,
  "[Hold E] Revive" prompt. classChange swaps the party member. `await T.partyCheck(g)` (8 steps, uses a real second
  Player object as a test ally) + tools/tests/party.test.mjs.
  Done C10: ANTI-TANKING `src/data/antiTank.js`: the player has POISE too (same Poise class; ~5 ordinary hits or 2 heavy
  in a row, never 1 hit) → status `staggered` 0.6 s (cannot act) + `exposed` 2.5 s (damage taken ×1.15) + knockback,
  event 'playerStaggered', 3 s immunity, regen after 1.6 s without hits; ENDURE: a hit taken at ≥ 90% HP leaves ≥ 1 HP
  (`target.endure(amount)` hook in combat.dealDamage). `T.tankCheck(g)` (6) + tools/tests/antiTank.test.mjs.
  Measured: A2 Grukk at LV 7, Umbral bot — dodging: 54 damage taken, 0 staggers; face-tanking: 563 damage, 2 staggers,
  still alive. All 8 area-boss fights (4 classes × A1/A2) win without god mode.
  **COMBAT 2.0 COMPLETE (C1-C10)** — pushed.
- **Current: UI ART PASS.** U1 built `tools/build-ui.js` + `Assets.ui` loader; U2 put kit frames on the skill bar. The owner then
  REPLACED the painterly kit with a **pixel-art kit** (matches the pixel world): `plate` (474×206, slice 60: buttons / name
  plates) and `frame` (504×494 window frame, see-through middle, slice 65) + its 8 separate corners / edges
  (`frame_corner_*`, `frame_edge_*`). Old pieces deleted (tools/tests/ui.test.mjs checks they stay gone). The skill bar is
  back to the plain boxes (hud falls back when `slot_normal` is absent) until a pixel slot frame exists. Fit check in the
  real game (runtime-only preview): frame + plate sit well with the tiles / sprites; the plate's centre gems stretch
  under 9-slice and touch short text — draw plates as caps + middle, text kept clear of the gems.
  Then the owner added 3 more pixel pieces, all usable: `slot_frame` → `slot_normal` + GENERATED `slot_hover` (glow) /
  `slot_pressed` (dark) / `slot_disabled` (grey) (build-ui `variants`) — the U2 skill bar picks them up again (checked
  in game: ready / cooldown / no-stamina / Q ready glow); `bar_frame` (614×106, see-through slot, slice 95 = end caps) for
  HP / stamina / boss bars; `crystal` (shadow crystal + shards, 177×276) for Shadow Mark icons / emblem.
  Done U3: `src/ui/uiKit.css` (linked after the base <style> in index.html, overrides only): every `.panel` + `.dialogue`
  = CSS border-image of `frame_tile` (build-ui COMPOSE: frame corners + plain rune edge that repeats — the edge gems are
  left out so big windows never stretch them; `frame_gem` is cut for later), dark gradient interior, centred uppercase
  h2 with a fading rule; main buttons (primary, title / ESC menu, close, death, dialogue options) = `plate_tile`
  (caps + plain middle, gem-free) with glow on hover / sink on press / grey when disabled; tabs = glowing underline.
  Checked in game: title, Inventory, Skills, ESC menu, dialogue. ui.test checks the CSS only uses existing images.
  Owner: Shadow Mark stays as it is (no crystal icons). Next: U4 = HP / stamina / resource bars + boss bar with
  bar_frame; U5 title screen.
- **Current: WORLD V3 "Equal-size maps + monster art"** (owner, 2026-09-28): the WHOLE current world grid (forest,
  river, Crystal Glade, ruins, valley) becomes **A1 Whispering Forest**; **A2 = Ashen Badlands** (volcanic canyon: rock,
  lava, dust) and **A3 = Rune Citadel** (white stone + bronze, glowing runes, crystal) are NEW maps of the SAME size
  (~168×208), each its own grid, only the current map loaded. Bosses: **Guardian = A1 boss** (new antler/crystal art,
  purple corrupted form), Hollow Fang + Grukk → optional A1 mini-bosses, A2 boss = magma beast, A3 major boss = rune
  knight. Monster sets: A1 hare / frost wolf / Guardian · A2 armadillo / rock rhino / magma beast · A3 crystal golem /
  bronze hoplite / rune knight. Map reference art exists in `desgin/Map/A/`.
  Done M1 (monster sprite pipeline): build-monsters tool + atlases for all 9 sheets, sheetSprites loader, Monster.draw
  plays whole anims (wind-up spread over the telegraph, death anim, front/back rows, enrage), Guardian draws its sheet by
  pose (`drawSheetBody`, canvas body kept as fallback `drawCanvasBody`), wolves (+ Hollow Fang) = frost wolf art,
  corrupted = purple tint. New A1 monster **Whisper Hare** (`rabbit`, Lv 1, Forest Entrance meadow, loot `hare_pelt`)
  with generic monster `enrage` data (below HP% → speed/power ×, 'monsterEnraged'). Checked: unit tests, combatTest
  101/101, checklist 31/31, routeA all pass, no console errors.
  Done W1 (multi-grid world, see GRIDS above): old world = grid `whispering` (all 6 maps), new grid `ashen` (168×208,
  map `ashen` ASHEN BADLANDS placeholder: Scorched Pass → Ember Canyon → Magma Caldera, side Ash Flats / Cinder Rift,
  hidden pocket slot; zone Z.BADLANDS + music 'badlands'; planned boss `boss_ashen`). Temporary way in: `ember_portal`
  exit on the Guardian Arena's east rim (needs boss_a3), back via `portal_back`. gridCheck 20/20 + every suite green.
  Done W2 (A1 restructure, save v3): maps = lumina · **a1** (one map: old A1 + Deep Forest + Ruins + Gate; region zones
  FOREST/CAVE/RUINS/GATE; connector tiles x 96-99 zoned in worldGen.js; `corruptedMonsters: { maxTy: 97 }` = north of the
  river, `monsterMods` = ruins hardened; Kael, shrine Elite, mire / thorns / rune-ward hazards moved in) · **arena** (A1
  boss arena, `parent: 'a1'`; north road exit + gate `a2_road_gate` -> A2) · **valehaven** (SECRET city, `secret: true`,
  needs boss_a1, only way in = `valley_road` Sealed Path exit of A1; hidden.js `valehaven` type 'secret_city' pays once;
  quest `valley` = THE HIDDEN VALLEY: find it + talk to Scout Wren) · **a2** (Ashen Badlands, grid `ashen`, back exit to the
  arena). Bosses: **boss_a1 = the Guardian** (type area, impl guardian, unlocks a2); **mini_hollow_fang / mini_grukk** =
  type `mini` (optional, gate nothing, quest `forest_hunts`, loot tables hollow_fang / grukk); boss_a2 (magma beast) and
  boss_a3 (rune knight, major) planned. Routes: `cityPlanned` (City 2 has no map yet — its trigger returns in W5).
  Quest route_a: river (flag riverCrossed via trigger on areaDiscovered 'Deep Forest') -> ruins zone -> gate -> Guardian
  -> reach a2. Quest markers may name `markerMap`. World map lists found secret maps. Save v3 migration (saveData.js
  V3_BOSS_IDS / V3_MAP_IDS; route_a progress restarts). The W1 ember portal is gone.
  W3a done (A2 look): the owner's A2 art is an ANCIENT VALLEY (green terraced cliffs, river, waterfalls, ruins), not
  volcanic → owner chose: A2 follows the art + a lava rift at the end for the Magma Beast. Grid `ancient_valley`
  (Z.ANCIENT, music 'ancient', skin 'valley', old grid id 'ashen' aliased in saves), terrain `maps/ancientValley.js`:
  Valley Gate → Pine Terraces → River Fords → Statue Commons → High Meadow → MAGMA RIFT (scorched ground + lava, clear
  boss ground at `regions.bossRift`), sides Sunken Temple / Golden Arch → Gilded Shrine (loop) / Mirror Lake, hidden slot
  Quiet Hollow; river on the east + south, each road crosses it once (auto BRIDGE tiles). New tiles T.SCORCHED (walkable)
  and T.LAVA (solid, shots fly over). Waystone `ws_a2_gate`. Landmarks are per grid (`landmarks` in world/levels).
  W3b done (A2 monsters): `armadillo` Stoneback Armadillo Lv 10 (hp 700, skirmisher: tail circle · Boulder Roll dash ->
  DIZZY vulnerable 1.4 s · Spike Burst ring, heavy) and `rock_rhino` Crag Rhino Lv 12 (hp 1300, bruiser, superArmor, slow
  turn: Horn Gore cone · Rampage Charge dash, guardBreak, missRecover 1.9 + STUMBLING · Tremor Stomp circle + slow);
  art per attack in monsterArt `attacks`; loot stone_scute / crag_horn; packs per terrace in maps/fieldA2.js
  `content.spawns` (+ Elite rhino at the Gilded Shrine). Monster attacks may carry `status` and `exposeText` (generic;
  the back-core turn after a dash is only for `weakPoint` monsters). `T.a2MonsterCheck(g, classId)` (12 steps: every
  attack used after a telegraph, punish windows, slow, loot, a no-god LV 10 pack fight) — 12/12 for all 4 classes.
  Bots dodge almost perfectly (take 0-1 hits): real difficulty needs a human playtest.
  W3c done (A2 boss): `boss_a2` MAGMA BEAST (live, impl 'area', Lv 14, rec 13, hp 16000, arena = Magma Rift center
  [84,26] r 8.5). Phase 1 MOLTEN HIDE: bite · charge (guardBreak, opening) · fireball volley (burn) · eruption (scatter,
  burn, opening); phase 2 MOLTEN FURY at 50% (red enraged form, faster): + fire_fan · lava_rain · magma_nova. AreaBoss now
  plays sheet art: pose -> anim via move `anim` > look.phaseAnims[phase] > look.anims > defaults (`sheetFrame`), death anim,
  stagger in weak windows; `pattern` moves may have `opening`. Quest `burning_rift` (A2 spine, starts on the first A2 visit;
  flag riftFound via trigger), rewards magma_heart + lore 'magma_beast', trigger a2_boss_defeated (A3 coming later).
  `T.a2BossCheck(g, classId, { god, level, seconds })` 8/8. No-god balance at LV 13: RP 88 s · UB 102 s · AW 108 s ·
  AG 149 s, all win.
  W3d done (owner feedback: boss VFX sheets, arenas like A1, less repetitive fights): BOSS VFX = `node
  tools/build-boss-vfx.js [--preview]` cuts `desgin/monster/<A1|A2|A3>/VFX BOSS/*` (13 rows each; light sheets flood-
  removed, the dark A2 sheet by glow extraction; `counts` splits touching frames) → `assets/vfx/boss/*.png + boss.json`
  merged into Assets.vfx: `g_*` green (A1), `m_*` orange (A2), `r_*` blue-gold (A3) — orb, slash, burst, shockwave /
  crater / spikes, bolt, blast, sigil, quake / eruption / pillar, crystal, spark, dome, vortex, shatter. Bosses name them
  in `look.vfx` (AreaBoss `fx(key)`: charge, slash, impact, bolt (sprite projectiles), eruption, nova, phase, pool; the
  Guardian's own code plays boss_a1 look.vfx). ARENAS like A1: A2's Magma Rift is its own boss_arena map `rift` (zone
  Z.RIFT, parent a2, confirm gate `rift_gate`, arena r 14.5 ringed by a lava moat) + generic `arena.cameraLock`
  (BossSystem.lockCamera). SIGNATURE MECHANICS: `src/boss/mechanics.js` (data `mechanics: [{ type }]`, hooks reset /
  update / onMoveDone / onImpact / wantsTurn / tags): Magma Beast = `overheat` (fire moves add HEAT → OVERHEAT blast →
  5.5 s collapse) + `lava_pools` (eruptions leave burning pools). HUD shows mechanic tags (HEAT n%). The Guardian's
  descriptive list is `notes`. Tests: `tools/tests/bossVfx.test.mjs`; a2BossCheck 12/12; no-god LV 13: UB 102 · AW 104 ·
  RP 95 · AG 145 s.
  W4a done (owner approved the A3 designs): A3 RUNE CITADEL = grid `citadel` (zones Z.CITADEL + Z.SANCTUM, skin
  'citadel' from the A3 tileset — build-tiles skin option `bg: 'measured'` for dark sheets; props `c_*` from the A3 prop
  sheet, boxes in extract-props), terrain `maps/runeCitadel.js` (walled street grid, canal + bridges, plazas: Gate Ward ·
  Market · Lamplight Row · Winged Plaza · Crystal Shrine · Well Court · Archive Ruins · Bronze Barracks · Golden Gate;
  the Sanctum arena is carved north of the Golden Gate, sealed by a wall until W4b). Map `a3` (maps/fieldA3.js, requires
  boss_a2; entry from the Rift's east causeway: rift gate `a3_road_gate` + exit `east_road`), quest `fallen_city`.
  Monsters: `crystal_golem` (Lv 14, armour 900, weakPoint 'front' + `weakPointText`, slam `leaves` crystal spikes =
  World.spawnSpikes: temporary blocked tiles), `bronze_hoplite` (Lv 15, `shield` via Monster.tryBlock/onBlock: front
  hits ×0.15, shield hp breaks → stun + vulnerable, flank = open; attack `needsAlly` = PHALANX spear line). Old monsters
  made distinct: dash `bounces` (armadillo roll ricochets off walls, can hit again) and `steer`/`steerMax` (rhino charge
  bends once). build-monsters row opts `mirrorFrames`. `T.a3MonsterCheck(g, classId)` 8/8 for all 4 classes.
  Bots take ~no hits in pack fights: A3 balance needs a human playtest. (slotCheck "everyone gets turns" can flake once.)
  W4b done: A3 MAJOR BOSS = RUNE KNIGHT (boss_a3 live: Lv 18, 24000 HP, poise 1300) in the SANCTUM = own boss_arena map
  `maps/sanctum.js` (zone Z.SANCTUM, camera lock, sealed), reached by exit `golden_gate` (confirm) from A3; rewards 1500 EXP,
  500 G, loot 'rune_knight', `asterian_crest`, lore; unlocks city2; trigger a3_boss_defeated = ROUTE A COMPLETE banner.
  AreaBoss: KIND `combo` (hits[] each with windup / shape / power / track — a late last hit punishes early dodges),
  mechanics may `filterMoves` (move pool), `tryBlock`/`onBlock` (shield), `onTelegraph` (copy), `poseAnim`, `hpFloor`
  (applyFloor = max of the phase floor and every mechanic's floor). combat: a BLOCKED hit calls `target.onBlockedHit`
  (bosses keep their floors). New mechanics (boss/mechanics.js): `stance` (sword / shield switch; shield blocks the front
  ×0.1, guard HP breaks → GUARD BROKEN weak), `rune_sequence` (phase 2, sigils I-IV burst in order; the runes are
  telegraphs OWNED BY THE MECHANIC so a stagger doesn't erase them), `echoes` (phase 3 ghost hoplites copy its telegraphs),
  `judgement` (HP floor 15% until the blast resolves; interrupted = re-cast; only the blue domes are safe → EXHAUSTED weak).
  Quest fix (generic): in ordered quests a flag step that unlocks late ticks if its flag was already set. Camera ignores a
  non-finite aim (a NaN mouse once froze it). `T.a3BossCheck(g, classId, { god, level: 17 })` 12/12 (god) ·
  no god, LV 17: UB ≈ 178 s · AW ≈ 185 s · AG ≈ 273 s · RP ≈ 150 s, all WIN.
  W5 done: CITY 2 = ASTERIA CITY from the owner's art (desgin/Map/City/ASTERIA CITY: prop sheet + tileset, reference
  desgin/Map/Ref/ASTERIA CITY). Grid `asteria` 160×160 (world/levels/asteria.js, zone Z.ASTERIA, music 'asteria', skin
  'asteria'), terrain `maps/asteriaCity.js` (laid out 1:1 from the reference, 8 ref px = 1 tile): moat + wall + great
  South Gate, avenues + canal, Crystal Plaza (fountain), Asteria Keep, Noble Quarter / Rosewall Homes / Greenroof Lane
  (rows of houses with lanes), Grand Bazaar, Guild Quarter, Forge Row, Hall of Records, Old Quarter ruins, Fountain Garden,
  forest ring. Map `city2` (maps/city2.js, safe, requires any Major Boss: boss_a3 | boss_b3), reached by the Sanctum's
  north road (gate city2_road_gate + exit north_road; exit south_road back). Services = NPCs in map content: Guildmaster
  Seraphine (quest `asteria` THE LIVING CITY: reach the plaza + meet her), Odo (shop — items.js `SHOPS` per NPC id,
  panels.shop uses the NPC you talk to), Hilde (smith), Sir Callum, Archivist Imre, citizens; waystone + storage.
  City props `a_*` are extracted at FULL size (no SCALE: the sheet's buildings are meant to be large; scales in the
  terrain are final); extract-props: per-sheet background test `SHEET_BG` (grey sheet) + `FILL_HOLES` (box mode keeps
  background-coloured pixels enclosed by a prop). routes: `cityPlanned` gone. `tools/mapOverview.js` (O.show(__game, 4)):
  whole-map render of the loaded grid. `T.cityCheck(g)` 11/11.
  B0 done (Route B prep, owner 2026-09-29): art moved to desgin/monster/<A|B>/<map>/ (tools follow). Owner rule: NO monster
  without sprite art — goblin / crystal_beast / crystal_alpha / wraith and their canvas code are gone. Replacements from
  the owner's extra sheets: A1 `leafling` (Leafling, caster: seed shot / bloom + root; its art is also the Guardian's
  `thornling` adds) and `treant` (Bramble Treant, bruiser: swipe / Root Slam heavy + missRecover / sap orb) +
  `elder_treant` (unique cave mini-boss, treant art ×1.55); A2 `quill_lizard` (flank skirmisher: whip / quill spray /
  spin rush -> DIZZY) + `burrower` (Thornshell Burrower: snap / burrow ambush = heavy circle ahead, guard break);
  A3 `void_scarab` (swarm of 3: claw / void ring + slow) + `rune_wisp` (caster: blue flame breath + burn / flame dash,
  `blinkWhenHit`). Mini-boss Grukk = THE THORNBOUND ELDER (id mini_grukk kept for saves, treant art, summons corrupted
  leaflings); Goblin Glade -> Thornwood Glade; goblin_iron shown as "Ironbark Splinter". Monster data flags instead of
  type names: `corruptible`, `shardColor`, `blinkWhenHit`, attack `projColor`. build-monsters: sheet `region`, row
  opts `y` / `x` (labelled / direction-grid sheets), `pocket`, `clearLight` (blurry sheets). `T.spriteMonsterCheck(g)` 8/8.
  Owner's Route B art (not used yet): maps desgin/Map/B/B1..B3 (+ Ref b1 FROSTWIND PLAINS, b2 CRYSTAL CAVERNS, b3 FROSTPEAK),
  monsters desgin/monster/B/B1..B3 (4 + BOSS each, VFX BOSS, "AURA Phase BOSS" for B1/B2 phase changes, B3 "Phase BOSS" =
  Crystal Warden multi-phase sheet: 4 phases + transitions, frames ~75% of the normal boss sheet -> usable as the main body).
  B1a done: ROUTE B is playable. Lumina's EASTERN ROAD (exit eastern_road, east lane) -> map `b1` FROSTWIND PLAINS on grid
  `frostwind` (168×208, zones Z.FROSTWIND + Z.FROST_ARENA, music 'frost', skin 'frost' — build-tiles picks may be card
  BOXES [x0,y0,x1,y1] for sheets whose cards touch), terrain `maps/frostwind.js` from the reference (square snowfield in a
  ragged rock ring, Hunter's Lodge NW, watchtower, crossroads, nomad camp, trapper's ruins, FROZEN MERE = new walkable
  tile T.ICE with open deep-water holes, Rimewater river + bridge, Ice Shrine, Frost Arena SE sealed by gate
  b1_arena_gate (event b1_arena_open) until its boss exists). Props `f_*` (B1 prop sheet, SCALE 0.5). Monsters (sheets
  desgin/monster/B/B1, one pose per action row × 4 direction columns): `snow_hare` (kick / frost spin + slow),
  `rime_wolf` (flank pack, bite / frost lunge + slow), `frost_harrier` (float caster: talon dive -> GROUNDED / gale burst
  at your position), `frost_bear` (maul / ice eruption = heavy cone that leaves ice spikes); Elite bear at the Ice Shrine.
  Item `frost_pelt`. Builder note: disc() needs whole-tile centres. `T.routeBCheck(g)` 7/7, spriteMonsterCheck 12/12.
  Next: B1b the B1 boss in the Frost Arena (owner's B1 BOSS sheet + VFX BOSS + AURA Phase BOSS for its phase change), then B2, B3.
- Known art limits: AG walk sheet barely moves its legs (a code step-bob compensates; new walk art would fix it).
