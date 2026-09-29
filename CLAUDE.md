# ECLIPSE ONLINE — guide for Claude (read first in every new chat)

Top-down dark-fantasy action RPG prototype. Vanilla ES modules + HTML5 Canvas, no dependencies.
Owner is a solo **beginner** developer who writes in **Thai** → answer in Thai, explain every change as
**FILE / CHANGE / REASON**, then *how to run*, *how to test*, *expected result*, *possible errors*.
Push to GitHub (`origin` = github.com/jepzaze6665-dev/EO-ver0.1, branch `main`) when the owner asks.

## Run / test
- `node server.js` → http://localhost:5173 (Claude preview config name: `eclipse-online`, `autoPort` on, see `.claude/launch.json`).
- Unit tests: `node tools/tests/run.mjs` (must print `ALL TEST FILES PASSED`).
- In-game (browser console, page loaded): `const C = await import('/tools/combatTest.js'); C.runAll(__game)`
  (combat / mechanics / Reaper / Duskrunner / Echoes / class-change checks, currently 153/153; `C.duskChecks(__game)` /
  `C.echoChecks(__game)` alone). runAll now takes > 45 s: from the preview tool run it in parts (classChecks +
  mechanicChecks per 2 classes, then reaper/dusk/classChange, then echo) or the call times out and hangs the page,
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
  Grids: `whispering` (A1 + Lumina + Valehaven), `ancient_valley` (A2 + Magma Rift), `citadel` (A3 + Sanctum), `asteria` (City 2), `frostwind` (B1 + Frost Arena), `caverns` (B2 + Heart), `frostpeak` (B3).
- Don't build yet (spec): multiplayer/network, accounts/DB, guild, trading, PvP, real secret classes / secret bosses, world events.
- If a request would break the architecture: explain the problem, propose a better way, then implement.

## Assets (never reference a path without a real file)
- Monster art: `desgin/monster/<A|B>/<A1..A3|B1..B3>/` (1..4, BOSS, VFX BOSS, AURA Phase BOSS / Phase BOSS).
- Raw art: `desgin/class cr/AW/` + the Umbral line in `desgin/class cr/UB/<UB|RP|DR|BE>/` (UB, Nightfall
  Reaper, Duskrunner, Blade of Echoes) + the Aegis line in `desgin/class cr/AG/<AG NEW|WD|BS|OK>/` (AG = new set 2026-09-29:
  walk1.png ATK1 DASH DEF HIT SK1-6 UT, no idle / atk2 / parry sheet; WD / BS / OK = Warden of Dawn / Bulwark Sentinel /
  Oathbreaker, not built yet); VFX `desgin/VFX/AW/` + `desgin/VFX/UB/<UB|RP|DR|BE>/` + `desgin/VFX/AG/<AG|DW|BS|OK>/` (AI sheets: fake
  checkerboard background, 6 columns × 4 direction rows; DR / BE atk2 have 5 poses per row).
- `node tools/build-player.js [ub|aw|ag|rp|dr|be]` → `assets/player[/<preset>]/*.png + atlas.json`. Every preset is
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
- **CLASS 2 (owner's Class 2 spec, 24 sections)**: sprites for Duskrunner (DR) + Blade of Echoes (BE) delivered 2026-09-29.
  Done CL1 = DUSKRUNNER (second playable Class 2, `src/skills/duskrunner.js`, preset 'dr', VFX `dr_*`): resource MOMENTUM
  (data/resources.js; tiers FLOW 30 / RUSH 60 / MAX 100 = passive Endless Motion: attackSpeed, speed, dodgeCostCut, cdr,
  physicalDmg, crit); builds from dodges / dashes / hits / combos / moving in a fight, drains when standing still in a fight
  (class `tick` hook) and -25 on a heavy hit. Skills: Blue Fang (dash-through, +60% at full momentum, MAX = afterimage
  re-cut) · Dusk Barrage (hits 3/5/7/9 by momentum, data table) · Mirage Shift (summon 'mirage' + RECAST back to it,
  position validated) · Silent Run (status silent_run: stealth + speed, AMBUSH) · Q Flash Step (dash + RECAST 2nd dash) ·
  ult Endless Run (needs 60, spends 30; status overdrive 8 s: momentum locked 100, cooldowns ×1.6 speed, half-price
  dodges). Passive Ghost Step = perfectDodge data (+20, counter_ready crit) + free next dodge. Gear twin_dusk_blades /
  dusk_scarf. New GENERIC core: SkillSystem `recast: { window, cast }` (+ HUD "AGAIN"), Player `dodgeCost()` (stat
  dodgeCostCut, status dodgeCostMult), `attackSpeed()` (stat attackSpeed × status attackSpeedMult, basic attacks),
  class `tick(p, g, dt)` hook; HUD resource label shrinks to fit. Tests: tools/tests/duskrunner.test.mjs, C.duskChecks (11).
  Balance: single-target (1 dummy) DR ≈ 141-158 vs RP 141 / UB 111; 3-dummy bot DR 162 (RP 190); Guardian WIN 85 s.
  Done CL2 = BLADE OF ECHOES (third playable Class 2, `src/skills/bladeOfEchoes.js`, preset 'be', VFX `be_*`; build-vfx
  rows sk3/ut = 2, be_crescent mirrored): resource ECHO (tiers RESONANCE 50 / FULL MEMORY 90 = passive Pain Remembers:
  stat echoPower read by class code, + crit); built by TAKING damage (2-15 per hit), perfect counters (+20), echo hits.
  Q CRIMSON COUNTER = counter stance: action `counter: { from, to }` -> Player.tryBlock parries ANY-direction hits inside
  the window (not unblockable) -> perfectGuard (text from class `perfectGuardText`) -> cls.onPerfectGuard starts the
  counter strike (forced crit, stun non-bosses; Counter Window opens via CounterSystem). NOT the Aegis hold-guard (that stays
  Aegis-only): it is one skill with a timing window. MEMORY RECORD & REPLAY = generic `src/combat/actionRecorder.js`
  (Player makes `p.memory` from class `memory` rules: keep 6 s, max 8, kinds basic/skill/dodge/counter; `replay(fn)`
  = nothing recorded inside -> no infinite replay). Skills: Echo Slash (cut + delayed echo cut) · Rewind Edge (summon
  rewind_mark + RECAST back, heals 40% of HP lost for 15 Echo) · Crimson Memory (requirement type `recorded`; re-casts the
  last remembered Echo Slash / Crimson Counter / combo finisher, its effects never re-recorded) · Last Stand (requirement
  `hpBelow` 0.4; status last_stand x0.6 damage taken, counter +30%, Echo gain x1.5 via pool gainMult modifier) · ult Blade
  of Recollection (50 Echo: summon echo_self replays the last 6 actions, re-targeting the nearest foe each step, finale
  cross). Passive Persistent Memory: counter = -3 s Rewind Edge. Gear memory_blade / echo_coat. Bot: counter-stance classes
  (special tag 'counter') press Q on telegraphs instead of dodging. Tests: tools/tests/echoes.test.mjs, C.echoChecks (12).
  Balance: 3-dummy bot 124 DPS (lowest of the line, by design); Guardian WIN 90 s with 9 perfect counters, 79 dmg taken.
  BE polish (owner: hit timing, reversed VFX, cut-off hands): build-player preset option `nearestBody` (be only) = only the
  LARGEST dark blob of a cell is that frame's body; a blade crossing a cell split no longer counts as a second body and
  loose pieces go to the nearest body by pixel distance (fixed swords moving to the next frame). build-vfx mirrors be_slash
  / be_crescent / be_recall (drawn hollow-side first). Anim data `hit: [cols]` = impact frames; every BE hit event lands on
  one (echoes.test "timing"), the crimson copy's hits wait for its impact frame too.
  Next: Class 2 skill tree / skill points / class level (spec §8-9), combat loadout slots (§15), class-selection UI (§16).
- **AEGIS CLASS 2** (owner's 27-section spec: Warden of Dawn / Bulwark Sentinel / Oathbreaker, one at a time, Warden first).
  Art: `desgin/class cr/AG/<AG NEW|WD|BS|OK>`, VFX `desgin/VFX/AG/<AG|DW|BS|OK>`. AG itself now uses the new AG set.
  Done AG1 = WARDEN OF DAWN (`src/skills/wardenOfDawn.js`, preset 'wd' — mirrored row 3 for both sides, VFX set 'dw':
  dw_shield / dw_burst (chain) / dw_circle (holy ground) / dw_crest / dw_pillar / dw_knight / dw_dome): resource DAWNLIGHT
  (decay in fight after 6 s; tier RADIANT 60 = stat barrierPower), gains from block 6 / perfect guard 20 / support casts 5 /
  your barriers soaking (10%, ≤6 a hit) / a chained ally being hit (≤24 per chain) — every source capped by a feeder.
  Q Dawn Guard = the Aegis hold guard (riposte of light + small barrier on a perfect guard). Skills: Dawn Shield (barrier 20%
  on the neediest party member in range, stacks to 50% max HP) · Radiant Chain (ally -30% damage, breaks > 340 px; alone it
  binds you -15%) · Dawn Bastion (holy ground r 90 / 6 s: -25%, status flag `unshakable`, +0.3 tenacity, sears foes) ·
  Guardian March (high tier: advance 100 px, -50%, pushes + taunts) · Grace of Dawn (30: heal 12%, ×0.6 on yourself,
  overheal -> barrier) · ult Dawn's Sanctuary (60: r 150 / 8 s, barrier 20%, cleanse, -40%, `debuffImmune`, taunts, sears).
  Passives Last Light (a member < 35% -> you -20%, cd 12 s) + Shared Resolve (DEF ×1.3 while an ally carries your protection,
  ×1.12 self only). Zones + chain run in the class `tick` (p.zones, p.chain). Default loadout is solo-friendly (Radiant
  Chain swapped in for a party). NEW generic core: status flags `unshakable` (combat: no knockback; Player: no interrupt /
  no poise break) and `debuffImmune` (StatusSet.add refuses debuff / control / dot -> 'statusResisted'), status field
  `tenacity`; HUD barrier indicator (pale-gold layer on the HP bar, "hp +shield", SHIELD n chip); codex shows signature
  weapon + gameplay loop (class `loop`). Tests: tools/tests/warden.test.mjs (16), C.wardenChecks (24, uses a real second
  Player as the ally; its statuses are ticked by the test). Bot balance: 3-dummy 72 DPS (AG 92), Guardian WIN 190 s with
  45 damage taken (AG 135 s / 111) — support tank by design, needs a human playtest.
  Polish: anim data may carry `side: { sheet, cols }` = what the left / right views play instead (playerSprites.frame;
  sprites.test checks it) — AG ATK1 turns the head away from the blow in both side rows, so AG side attacks use DEF / SK2.
  build-vfx set options `feather` (glow crossing a frame / row cut fades out over N source px), `recenter` (frames off
  their grid cell), `dropLow` (frame-number badges under the row), `stripLabel` (direction labels in column 0).
  Done AG2 = BULWARK SENTINEL (`src/skills/bulwarkSentinel.js`, preset 'bs' (detected sides), VFX set 'bs': bs_aegis /
  bs_charge (side) / bs_wall / bs_crest / bs_pillar / bs_citadel; BS SK3 VFX has an opaque checker bg -> unused):
  resource BASTION (hit taken +5% HP -> +5, cap 6/hit, x2 in Iron Bastion; block 8; perfect guard 15; taunt 4/foe cap 16;
  step 4/foe cap 12; decay in fight after 5 s). FORTIFIED (class tick) at 70: status fortified 8 s (+40% DEF, guardBlockMult
  0.5, unshakable), drains 5/s, ends under 10, 6 s lockout. Q Bulwark Guard (arc 1.35, 80%). Skills: Iron Bastion (fast
  stance 8 s -40% dmg / -45% speed, RECAST ends it) · Fortress Step (lunge, big poise, stun, mark) · Absolute Provocation
  (AoE taunt r 170) · Counterweight (p.weight = damage taken + blocked, cap 60% max HP, forgotten after 6 s; power 1.6 ->
  3.4, ×1.5 in the Citadel, hard cap 4.5; the perfect-guard riposte spends half) · Shieldwall (20 Bastion: p.walls, members
  BEHIND it (depth 120, half-width 70) -40%) · ult Citadel of One (50: 10 s unshakable -50% dmg, guardBlockMult, taunt pulse
  r 220 / s, allies within 130 citadel_ward -20%; price: move ×0.35, dodge cost ×2). Passives Iron Will (< 40% HP DEF ×1.5)
  + Unbroken (base stats tenacity 0.3, knockResist 0.5, poiseResist 0.4). NEW generic: stats knockResist (combat
  knockback) / poiseResist (player poise), status modifier guardBlockMult (Player.tryBlock). checklist picks a non-recast
  skill for the cooldown step and walks slow classes further. Tests: tools/tests/bulwark.test.mjs (9), C.bulwarkChecks (23).
  Bot balance: 3-dummy 75 DPS, Guardian WIN 175 s (138 damage taken).
  Polish 2: build-player sheet opt `swapSides: [cols]` (exchange side-row columns drawn the wrong way), preset opts
  `bg.glowToAlpha` (+ `glowCool`: only cool light) = effect glow painted over the white sheet becomes translucent (no white
  halo), `edgeFade`, `splitFeather`. build-vfx `checker` (opaque fake-checker VFX sheets -> removeChecker). GENERIC STATUS
  AURA: status data `aura: { color, ring, columns, body, motes, scale }` drawn by Player.drawAura while the status lasts
  (citadel, fortified, oath_of_ruin, forbidden_oath).
  Done AG3 = OATHBREAKER (`src/skills/oathbreaker.js`, preset 'ok' (ATK2 / SK6 = 5 poses per row), VFX set 'ok': ok_brand /
  ok_defy / ok_flare / ok_spikes / ok_sigil / ok_crescent / ok_verdict): resource BROKEN OATH (hits taken ≤ 8, boss hits ≤ 12,
  Defiant Guard converts half the blocked damage ≤ 8, perfect guard 15 + Pain Repaid 10, brand 4, chain 5, Oath of Ruin 10;
  tier UNBOUND 70). Q Defiant Guard (65%, slow; a block opens RETALIATION 1.5 s). Skills: Oath Brand (mark oath_brand in
  data/marks.js: taunt, counters ×1.2) · Sinful Counter (requirement 20; spends ≤ 60; 1.2 + 0.035/pt, max 3.3; ×1.4 in
  Retaliation, ×1.3 Forsaken < 40% HP, ×1.2 Oath of Ruin, ×1.5 Forbidden, ×1.2 brand; HARD CAP 5×) · Ruin Chain (requirement
  markedFoe oath_brand 280: slides the foe to you via map.moveCircle, root 1 s; bosses get status ruin) · Oath of Ruin (8 s:
  +25% dmg, DEF ×0.6, damage taken ×1.15, taunt r 150) · ult Oathbreaker Verdict (60: forbidden_oath 10 s, unshakable,
  pulses taunt + ruin r 150; stores 40% of damage taken ≤ 60% max HP; when it ends the class tick plays verdict_end: blast
  2 + 4×share, max 4.5×). Tests: tools/tests/oathbreaker.test.mjs (6), C.oathChecks (18). combatTest loadout step now
  meets 'markedFoe' requirements. Bot balance: 3-dummy 116 DPS (highest of the Aegis line), Guardian WIN 110 s but 347
  damage taken (the risk).
  AEGIS CLASS 2 COMPLETE (Warden / Bulwark / Oathbreaker). Next: owner decides (skill tree / class level / loadout slots,
  human balance pass).
- Later Class 2 work: AW / AG paths need the owner's class data.
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
  B1a polish (owner): which side column faces RIGHT differs per sheet (wolf 2, bear 3, hare 2 — a wrong one = moonwalking);
  anim specs may be a LIST of pieces ([['walk',[2]],['idle',[2]]] = 2-step walk for one-pose-per-action sheets, also front /
  back); walks with 1-2 frames get a step bounce (Monster.draw); sizes vs the ~58 px player: hare 22 · wolf 36 · harrier 32 ·
  bear 54 · Bramble Treant 46 (Elder ×1.4, Thornbound Elder ×1.5).
  B1b done: boss_b1 HOARFANG, the Winter Alpha (area boss, Lv 10, 11000 HP) in map `frost_arena` (maps/frostArena.js,
  boss_arena up B1's arena stairs = exit arena_stairs with confirm; south gate b2_road_gate waits for B2). Art: B1 BOSS sheet
  (giant frost wolf, 9 rows), VFX `f_*` (build-boss-vfx: `clearLines` drops the separator lines of the grey-checker sheet),
  AURA `fa_*` (form / ring / bigring / void / burst). AreaBoss `look.phaseAura[phase]` = { transition: [fx...] played in
  sequence on the phase change, loop: fx kept under the boss }. Phase 1 THE HUNT (combo bite with a late 3rd hit, pounce
  leap, frost shards, howl = 2 Rimefang Wolves), phase 2 WHITEOUT at 55% (+ ice spikes cross, frost nova). Mechanics:
  `frostbite` (standing still -> 5 stacks -> FROZEN stun + hit) and `glacier` (ice pillars, then ABSOLUTE ZERO over the
  arena — only line-of-sight cover behind a pillar is safe; HP floor 20% until it has gone off once; interrupted -> recast
  in 2 s). Mechanic HUD tags must be { label, color }. Quest `eastern_road` (B spine), item frost_heart, lore hoarfang,
  trigger b1_boss_defeated. WorldMap: props > 300 px go to `bigProps` (culled by their box, not the anchor chunk). The
  owner's whole-arena prop f_frost_arena is NOT used as a floor (its rock walls cross the fight when scaled).
  `T.b1BossCheck(g, classId, { god, level: 9 })` 11/11; no god LV 9: RP 73 s · AW 91.5 s · UB 93 s · AG 104.5 s.
  B2a done: map `b2` CRYSTAL CAVERNS on grid `caverns` (168×208, zone Z.CAVERNS, music 'caverns', dark tint, skin 'caverns'
  from the B2 tileset — card boxes), terrain `maps/crystalCaverns.js` from the reference: solid rock with chambers joined by
  stone paths — Frozen Tunnel (NW entry) · Glittering Hall · Northern Gallery · Crystal Field · Old Mine (scaffolds, rails,
  lanterns) · Underground Lake (deep water, bridge) · Sunken Ruins · Eastern Plaza · Glowroot Grotto · Sealed Crystal Vault
  (Elite tortoise) · twin pools · Abyssal Arch (SE, sign: B3 later) · Heart of the Caverns (NE, gate cavern_heart_gate, event
  b2_heart_open = the B2 boss, next phase). Props `k_*` (B2 prop sheet). Reached from the Frost Arena's south road (gate
  b2_road_gate + exit south_road; B2 requires boss_b1), exit north_tunnel back. Monsters (desgin/monster/B/B2):
  `crystal_slime` (swarm: glob rush -> SPLATTERED / crystal pulse ring + slow), `cave_spider` (flank: fang / web shot = root /
  shard eruption heavy), `crystal_bat` (float caster: swoop / shard storm 6-way volley), `moss_tortoise` (tank, armour +
  back weak point: snap / shell quake guardBreak / pebble volley). Quest `crystal_depths` (lake -> ruins -> the Heart).
  `T.b2Check(g)` 7/7; spriteMonsterCheck 16/16 (Leafling keepAway 72 + bloom 78 so the bloom actually fires).
  B2b done: boss_b2 AMETHYST COLOSSUS (area, Lv 14, 15000 HP) in map `crystal_heart` (maps/crystalHeart.js, zone
  Z.CAVERN_HEART = tiles x >= 123 within 20 of the Heart; B2 exit heart_gate with confirm, arena exit heart_west). Art: B2
  BOSS sheet (crystal golem, 8 rows), VFX `c_*`, AURA `ca_*` via look.phaseAura. Phase 1 CRYSTAL SHELL (combo fists with a
  late 3rd, charge, slam, crystal spikes cross), phase 2 RESONANCE at 50% (+ prism volley, crystal rain, resonance nova).
  Mechanic `crystal_armor`: the boss gets `armor` (damageSystem armour: 70% absorbed); AreaBoss.onArmorBreak -> mechanic ->
  SHATTERED weak; then CLUSTERS (Breakables + a prop, `hp` 260) grow around the arena; after `grow` s each one left is
  absorbed (+40% armour each); all smashed -> it tries again later. Quest crystal_depths gets the boss step; item
  amethyst_core, lore, trigger b2_boss_defeated (B3 next). `T.b2BossCheck(g, c, { god, level: 13 })` 8-10 steps;
  no god LV 13: RP 129 s · UB 158.5 s · AW 165 s · AG 207.5 s (a bit longer than A2 — the armour; human playtest).
  B3a done: map `b3` FROSTPEAK on grid `frostpeak` (168×208, zones Z.FROSTPEAK + Z.PEAK_SUMMIT, music 'peak', skin
  'frostpeak' — CLIFF = dark rocky ground so the mountain reads as not walkable; a snowy CLIFF made the whole map look like
  snow), terrain `maps/frostpeak.js` from the reference: rock mountain with snow terraces joined by paths / stairs / bridges —
  South Gate (entry) · Pinewood Slopes · Frozen Lakes (ice + open water, east lake + bridge) · Frost Fortress gate ·
  Icebound Cave · Western Terrace · Crystal Plateau · Hermit's Shrine (Elite yeti) · Nomad Camp (waystone) · Glacier
  Stairs · Windcut Terrace · Eastern Switchback · Lookout Tower · SUMMIT CITADEL (zone PEAK_SUMMIT = the B3 major boss arena,
  not part of b3's region yet). Props `p_*` (B3 prop sheet: deep navy bg -> extract-props SHEET_BG NAVY_DEEP, boxes by
  hand). Way in: B2's Abyssal Arch (exit abyssal_arch; B3 requires boss_b2), exit south_gate back. Monsters
  (desgin/monster/B/B3): `glacier_wolf` (flank pack: fang / frost lunge + slow / rime burst heavy), `yeti` (bruiser:
  swipe / ground pound guardBreak + missRecover / ice hurl), `frost_imp` (swarm, blinkWhenHit 3: crescent claw / frost
  ring), `snow_eagle` (float caster: dive -> GROUNDED / feather fan / icefall at your position). Quest `frostpeak_climb`.
  `T.b3Check(g)` 7/7; spriteMonsterCheck 20/20.
  B3b done: boss_b3 CRYSTAL WARDEN (major, Lv 18, 24000 HP) in map `summit` (maps/summit.js, zone PEAK_SUMMIT; b3 exit
  summit_gate with confirm; north gate city2_frost_gate + exit north_road -> City 2; City 2 exit frost_road back). Art = the
  owner's "Phase BOSS" sheet: build-monsters row opt `blobs: { min, reach }` cuts frames as connected shapes (poses overlap
  in x; small pieces join the nearest frame, owner mask) + sheet `darkBg` (dark neutral checkerboard). Forms p1 / p2 / p3 +
  death are used; phase 4 = p3 + violet aura (its aura and the transformation rows join all poses into one shape — the
  owner can resend them with gaps). VFX `w_*` (B3 VFX sheet). 4 phases: DORMANT · AWAKENED 75% (rune_sequence = frost
  sigils) · CORRUPTED 45% (echoes = crystal reflections) · ENRAGED 20%. New mechanic `pylons` = SHATTERED ECLIPSE: untouchable
  charge, 3 pylons (380 HP) in 14 s -> EXPOSED 7 s, else an unblockable nova + retry; HP floor 10% until it succeeds once.
  Rewards warden_crest + lore, trigger b3_boss_defeated = ROUTE B COMPLETE. `T.b3BossCheck(g, c, { god, level: 17 })` 12/12;
  no god LV 17: UB 177.5 s · RP 174.5 s · AW 220.5 s · AG 206 s.
  Bug fixes (owner): (1) a boss arena carved into a field map showed as a BLACK hole from outside -> MapManager.activate sets
  `map.visibleAreas` (the map + its child arenas + its parent) and the renderer only darkens other maps; walking unchanged.
  (2) the boss seemed to vanish on a phase change -> the phase burst was scale 2.4 on top of it: now scale 1.2 / alpha 0.55,
  and look.phaseAura effects play on the GROUND layer under the boss (AreaBoss + Guardian).
  Gotcha: never put a `//` comment in the middle of a one-line statement (it comments out the rest -> the whole game breaks).
  B3 polish (owner): the Warden body had holes (darkBg erased the armour's dark greys) -> darkBg only clears LARGE connected
  dark-neutral regions between [minLum, lum] (the black outline protects the art); only single-body frames are used. Phases
  readable: AreaBoss look.phaseStyle[phase] = { aura, glow (drop-shadow px), scale } + a white pulse on the body during the
  transformation + a PHASE n / N label (Warden: pale ice -> cyan -> violet -> magenta, larger). Echoes take data filter /
  scale (no hue shift on the blue Warden). City 2 has TWO roads: South Gate = Route A (Sanctum), EAST GATE = Route B (the
  summit north road arrives at [154,67]; exit east_road, bridge over the moat, towers).
  Next: owner decides (Route A/B both complete; City 2 content, balance with a human player, F3 debug overlay).
- **Current: SKILL SYSTEM** (owner's 35-section spec, checked against the game: EXTEND the existing SkillSystem /
  loadout / classes, never rewrite them; keys stay 1-4 + 5 ult + Q; E = interact / revive). Phases: S1 classProgress + save
  · S2 skill level · S3 mastery · S4 evolution + UI · S5 skill tree / points / class level · S6 equipment skill modifiers +
  generic charges · S7 data for the other classes.
  Done S1: `src/progression/classProgress.js` (pure, game.classProgress): per class { level, exp, mastery, loadout, skills:
  { id: { level, masteryXp, masteryLevel, evolution } } }; class change keeps the old entry (its skills = LOCKED via
  `lockedSkills(CLASSES)`, `usable(skill)` = active class or `sharedClassIds`) and restores each class's own loadout.
  SAVE_VERSION 4 (v3 -> v4 seeds it from player.loadout). tools/tests/classProgress.test.mjs.
  Done S2: SKILL LEVEL `src/progression/skillLevels.js` (pure): skill data `levels: [{ power, area, cooldown, cost, flags,
  values, text }]` (full set per level). CORE applies power / area (Player.castMods while an action's events run ->
  `applySkillMods` in combat.spawnHitbox + projectiles.fire; `noSkillMods` opts out; a later g.after must set p.castMods
  itself) and cooldown / cost (SkillSystem.cooldownFor / costFor via caster.skillMods). Class code reads NEW BEHAVIOUR through
  `p.skillFlag(id, f)` / `p.skillValue(id, k, d)`. Points: 1 per character level after 1, per class (derived, no save
  field); raising to Lv n needs char LV [1,3,6,10,15] and [0,1,1,2,2] points; `p.upgradeSkill(id)` -> 'skillLevelUp'.
  Umbral 6 actives have 5 levels (Lv 5 = shadow trail / every cut marks / 195 px + haste / 2-hit mark / 4 s veil + mark /
  return mark); ult + special = 1 level. Skills tab: points, Lv n/5, this + next level text, [+ Level]. skillLevels.test.mjs.
  Done S3: SKILL MASTERY rules `src/data/skillMastery.js` (thresholds 0/60/180/400/750 = I-IV, capped; XP use 3, hit 1 ×4
  per cast, kill 8, counter 6, first hit ≤ 2 s after a Perfect Dodge 10, combo = cast ≤ 1.5 s after ANOTHER skill hit 4;
  dummies / breakables give no hit XP; rewards = small cooldown / cost cuts only, III = evolutions open) +
  `src/progression/masterySystem.js` (game.mastery listens to skillUsed / skillHit / perfectDodge / counterHit; active-class
  skills only; 'skillMasteryUp'). Hitboxes / projectiles spawned inside a cast carry `skillId` (applySkillMods) -> combat
  emits 'skillHit'. Player.skillMods = level mods (+ evolution) × mastery reward. Skills tab shows Mastery + XP bar. mastery.test.mjs.
  Done S4: SKILL EVOLUTION `src/progression/skillEvolution.js` (pure): skill data `evolutions: [{ id, name, desc, changes
  { behavior, damage, utility, resource, cooldown }, requirements { skillLevel, masteryLevel, charLevel?, flag?, item? },
  power / area / cooldown / cost ×, flags, values }]` (0-3, must carry a behaviour flag). ONE branch per skill, stored as
  classProgress skill.evolution (original data untouched); `p.evolveSkill(id, evo)` (not in combat) -> 'skillEvolved' banner;
  `revertEvolution` only if EVOLUTION_RULES.respec.allowed (off). Umbral Shadow Slash: Shadow Fang (1 target, +35%, +30% with
  2+ Marks) · Shadow Wave (wide, -25%, 2+ hits = extra Mark, cd +15%) · Phantom Cut (Lv 5; -20%, clone re-slash 0.6 s later).
  Skills tab: "◆ name" on the card + [Evolution ▸] panel (original + options, gameplay/damage/utility/resource/cooldown,
  missing requirements, Choose). A hitbox fired later (g.after) must name `skillId` itself. evolution.test.mjs.
  Done S5: SKILL TREE + CLASS LEVEL `src/data/skillTree.js`: skill data `unlock: { classLevel, requires: [ids] }` +
  `category` (OFFENSE / MOBILITY / UTILITY / RESOURCE / BURST / PASSIVE). CLASS LEVEL per class in classProgress (level / exp,
  same curve as the character): a tier-1 class MIRRORS the character level (setLevel / gainExp sync), other classes get class
  EXP from every expGained while active (`addClassExp`, 'classLevelUp'). Skill points + skill-level gates use class level.
  Locked skills: SkillSystem SKILL_FAIL.LOCKED (caster.skillUnlocked), cannot be slotted, HUD slot = dark + lock + "LV n";
  HUD also shows skill level (gold) / ◆ evolved and the leveled cost. Umbral: Slash 1 · Step 2 · Twin Fang 4 · Arc 6 · Veil 8 ·
  Phantom Edge 10 · ult 10 (spec said 20: kept at the Class 2 level for boss balance) · Shadow Break 1 (tutorial). Skills tab:
  Class LV / class EXP, tree strip in unlock order, category chips, "Unlocks with". Class 2 skills have no `unlock` yet (S7).
  **`SKILL_TREE.unlockAll = true` is set by tools/testkit.js on import** (combatTest / checklist import it): bots and regression
  use every skill at any level; to check the real locks, reload the page without loading the dev tools. skillTree.test.mjs.
  OWNER DECISION (after S5): skill points + unlocks + skill-level gates use the CHARACTER level (`SKILL_TREE.pointsFrom =
  'character'`, Player.progressLevel()) so a Class 2 arrives with all its points (no regrind); each class keeps its own pool.
  Class level is still tracked. Set pointsFrom 'class' to go back to the S5 rule.
  Done S6: CHARGES in `combat/cooldownSystem.js` (setMax(id, n): each missing charge has its own recharge timer; charges(),
  maxCharges(), nextCharge()); SkillSystem maxCharges = skill `charges` + modifier charges, synced every update. SKILL
  MODIFIERS `src/progression/skillModifiers.js`: item data `skillModifiers: [{ skillId | tag, stat: damage / area / cooldown /
  cost / charges / resourceGain / duration, operation: MULTIPLY | ADD, value }]` -> Equipment.applyTo -> p.mods.skillModifiers ->
  applied last in Player.skillMods (limits: cooldown ≥ ×0.4, cost ≥ ×0.3, +2 charges max). resourceGain = + class resource the
  first time each cast hits (game.js). Items hunger_rune / shade_charm (Shade Step 2/2) / eclipse_relic (merchant shops).
  HUD: "n/m" charges + next-charge bar; Skills tab: charges + "⚙" gear lines. skillModifiers.test.mjs.
  Done S7: GENERIC SKILL TRAITS `src/progression/skillTraits.js` (levels / evolutions switch them on by data, no class code):
  flags echo (every hitbox of the cast repeats once, values echoDelay 0.5 / echoPower 0.4; combat.spawnHitbox -> echoHitbox) ·
  lifesteal (≤ 4% max HP per hit) · refund (resource on kill) · reset (cooldown cut on kill, cdOnKill 99 = full) · haste; values
  poiseMult (× stagger, applySkillMods); level / evolution field `charges`. installSkillTraits(game) listens to skillUsed /
  skillHit. Per-class data `src/data/skillProgression.js` (Claude's design, owner asked): category + 5 levels (ladders
  damage / support, Lv 5 = a trait) for every active skill of all 9 classes, tree unlocks for Astral / Aegis (Class 2: none),
  2 evolutions on one signature skill per class (+ Umbral Shade Step: Twin Shade / Shade Reaper); applySkillProgression
  (skills/classes.js) only fills fields a skill lacks. CORE FIX: a hitbox with `powerFor` now gets the skill-level power too
  (applySkillMods wraps powerFor: result × power, it sees the base power). skillProgression.test.mjs.
  SKILL SYSTEM S1-S7 COMPLETE. (duskChecks / echoChecks "live fight" steps can flake once after other suites; rerun.)
- **Current: LEVEL REWORK** (owner 2026-09-29): cap 50, Class 2 = LV 30 only (no story requirement), Route A / B stay
  PARALLEL roads to City 2, A easier. Table: A1 1-14 (boss 14) · A2 14-26 (26) · A3 26-38 (38) | B1 1-17 (17) · B2 17-31 (31) ·
  B3 31-45 (Crystal Warden 45: hardest fight of v1, party-ready). Phases: L1 rules + scaling · L2 Route A · L3 Route B + B3 boss ·
  L4 quest EXP / unlock timings / full regression.
  Done L1: LEVELS.maxLevel 50; classTree CLASS2_BASE = [level 30]. LEVEL SCALING `src/data/levelScaling.js` +
  `src/progression/levelScaling.js` (pure): a map's `levelBand: { from: [oldMin, oldMax], to: [newMin, newMax] }` moves its
  monsters (Monster opts.levelBand, passed by world spawns): level remapped, hp / def × playerPower ratio, attack power ×
  playerHp ratio, EXP × expToNext ratio × band slope (same kills per level) -> the fight feels the same vs a player of that
  level; difficulty comes from map / route mods. partyScale(members) ready for the party system. Monster poise doubles for
  ELITES only (was "hp mod > 2"). No map has a band yet (L2 / L3). levelScaling.test.mjs; experience / progression tests
  updated to cap 50 / LV 30.
  Done L2 (Route A): map levelBand a1 [1,10]->[1,14] · a2 [10,14]->[14,26] · a3 [14,18]->[26,38] (+ map "Lv." subtitles).
  BOSSES: data `level` (new) + `nativeLevel` (stats tuned at): mini Hollow Fang 7 · Thornbound Elder 11 · Guardian 14 · Magma Beast
  26 · Rune Knight 38 (recommended 6 / 10 / 13 / 25 / 36). AreaBoss / Guardian scale hp / def by bossScale(def) and set
  `levelPowerMult` -> combat.dealDamage scales EVERY flat hit of a monster / boss (moves, mechanics, projectiles); summoned adds
  get shiftBand(level - nativeLevel); boss EXP reward × bossScale.exp (bossSystem). Guardian reads BOSSES.boss_a1.level.
  Tests moved to the new levels (testkit A-route setLevel, a2BossCheck default 25, a3BossCheck 36, combatTest balance
  botOpts.level default 13). No-god bot results (same feel as before): Guardian UB 85 s · AW 130 s · AG 150 s; Magma Beast UB 95 ·
  AW 103 · AG 143; Rune Knight UB 156 · AW 180.5 · AG 257.5 — all WIN. routeA 26/26, playthrough 17/17, checklist 31/31,
  a2 / a3 monster checks 12/12 + 8/8. Not yet: quest / hidden EXP rewards are still old numbers (L4 pacing).
  Done L3 (Route B, harder): map levelBand b1 [1,9]->[1,17] · b2 [10,14]->[17,31] · b3 [14,18]->[31,45] + map `monsterMod` =
  LEVEL_SCALING.routeMod.B (hp / power ×1.2, EXP ×1.25, detect ×1.1). Bosses Hoarfang 17 · Amethyst Colossus 31 · Crystal
  Warden 45 (rec 16 / 30 / 43) with boss data `difficulty: { hp, power, windup }` (B1 1.15 · B2 1.2 + windup 0.95 · B3 hp 1.3 /
  power 1.25 / windup 0.9 = shorter telegraphs); bossScale folds difficulty in, AreaBoss.wind() × levelScale.windup.
  PARTY-READY: every AreaBoss × partyScale(game.party.members) (hp +75% / poise +50% per extra player; solo ×1). Mechanic
  objects follow the boss level (crystal armour, cluster / pylon HP × levelScale.hp). BUG FIX: AreaBoss.onDeath clears
  mechanics that own world objects (clusters / pylons stayed up when the boss died mid-growth). Tests: testkit b1 / b2 / b3
  BossCheck defaults 16 / 30 / 43; levelScaling.test (owner table + B difficulty). No-god bots: Hoarfang UB 101 · AG 123.5 s;
  Colossus UB 186.5 · AW 216 s; Crystal Warden UB 225.5 · AW 274 · AG 324 · RP 202 s — all WIN, B3 ≈ +30-55% longer than before.
  Done L4 (pacing): quest / secret EXP follow the new levels — `src/progression/rewardScaling.js` (questExp / hiddenExp, used
  by ExperienceSystem) with [nativeLevel, newLevel, slope] per quest / secret in LEVEL_SCALING.questLevels / hiddenLevels.
  Map `levelBand.exp` = per-map EXP tune (a2 1.1 · a3 1.25 · b1 1.5 · b2 1.05 · b3 1.05); Rune Knight / Crystal Warden reward
  2500 EXP. World.spawnOpts(d) = how a spawn point's monsters are made (shared with the tool). PACING TOOL `tools/pacing.js`
  (`P.pacing(__game)`): one clear of every field spawn + quests + secrets + minis + boss rewards -> level at each boss:
  Route A 13 / 25 / 36 -> ends LV 38 · Route B 16 / 30 / 43 -> ends LV 45 (= the owner's targets; respawn farming adds more).
  Real playtime is NOT measured (bots only) — needs a human run. levelScaling.test: maps with a band keep their grid (a
  mid-line // comment once swallowed A2's grid), quest / secret pairs name real entries. Tests moved: routeA minis at LV 6 / 10
  (+400 s for the Aegis bot) and the Guardian at 13. Full regression green: unit tests, combatTest 77 + class suites (reaper 10,
  dusk 11, echo 12, classChange 14, warden 24, bulwark 23, oath 18), checklist 31/31 (UB, AW), routeA 26/26 (all 3 starters),
  playthrough 17/17, a1Loop, mapTour 9/9, gridCheck 20/20, cityCheck 11/11, routeB / b2 / b3 7/7, Combat 2.0 checks.
  (spriteMonsterCheck fails when run right after partyCheck — leftover state; 20/20 on a fresh page.)
  LEVEL REWORK L1-L4 COMPLETE.
- DIFFICULTY PASS (owner playtest: "levels too easy, bosses deal no damage — guard / dodge must matter"): `src/data/difficulty.js`
  enemyDamage (× every flat enemy hit on a player in combat.dealDamage: monster 1.7 · boss 1.9 · dot 1.2) + expRate 0.75 (every EXP
  reward, ExperienceSystem; pacing tool too). Measured hits: mobs avg 15% max HP (was 8), Hoarfang avg 22% / max 54% (was 11 / 29),
  Crystal Warden avg 32% (was 13). Endure (anti one-shot at >= 90% HP) unchanged. Guardian bot: dodging UB WIN 100 s / AG 150 s;
  NO-DODGE (balance botOpts { noDodge: true }): UB DIES in 45 s, AG still wins by guarding (1094 damage blocked / taken).
  Pacing (one clear, no farming): A 12 / 23 / 33 -> LV 34, B 14 / 27 / 39 -> LV 40 (fighting respawns reaches 38 / 45).
  All dodging bots still win every boss; regression green (routeA, playthrough, checklist, tank, a2 / a3 monsters, combat).
- AG art swapped to the owner's new set (2026-09-29): build-player sheet option `facing` (per-sheet side rows; AG ATK1's
  attack poses are mirrored vs its idle poses) + AG `nearestBody`; dodge now plays the real DASH sheet. Walk step-bob kept.
