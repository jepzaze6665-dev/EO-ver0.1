# ECLIPSE ONLINE — guide for Claude (read first in every new chat)

Top-down dark-fantasy action RPG prototype. Vanilla ES modules + HTML5 Canvas, no dependencies.
Owner is a solo **beginner** developer who writes in **Thai** → answer in Thai, explain every change as
**FILE / CHANGE / REASON**, then *how to run*, *how to test*, *expected result*, *possible errors*.
Push to GitHub (`origin` = github.com/jepzaze6665-dev/EO-ver0.1, branch `main`) when the owner asks.

## Run / test
- `node server.js` → http://localhost:5173 (Claude preview config name: `eo`, see `.claude/launch.json`).
- Unit tests: `node tools/tests/run.mjs` (must print `ALL TEST FILES PASSED`).
- In-game (browser console, page loaded): `const C = await import('/tools/combatTest.js'); C.runAll(__game)`
  (combat / mechanics / class-change checks, currently 75/75) and
  `const T = await import('/tools/testkit.js'); T.playthrough(__game, 'aegis_guardian')` (15-step full-game regression).
  `game.simulate(sec, perStep)` drives the game deterministically even when the tab is hidden.
- After editing `tools/testkit.js`, **reload the page**: `combatTest.js` imports it without a cache-busting query.

## Architecture rules (from the V2 master prompt — keep them)
- Core systems never name a class. Classes are **data + behaviour** calling core systems; passives react to
  bus events through the class's `on: { eventName(p, g, e) {} }` hooks.
- Pipeline: calculate (pure) → apply → feedback → events. Gameplay state is separate from DOM/UI (server-ready).
- Core (`src/combat/`, `src/status/`, `src/progression/`): damageSystem (pure), resourceSystem, skillSystem
  (+ cooldownSystem, REQUIREMENTS), markSystem, threadSystem, guardSystem, StatusSet; rules live in `src/data/*.js`
  (resources, marks, statuses, threads, classTree).
- Classes: `src/skills/{umbralSword,astralWeaver,aegisGuardian}.js`, registry `src/skills/classes.js`.
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
  class UI (tree + codex).
- Balance (bot, dummy DPS): Umbral ≈ 153-158, Astral ≈ 132, Aegis ≈ 92-95 (takes the least damage); all beat the Guardian solo.
- **Next: Phase 15-16 — first playable Class 2 = Nightfall Reaper (UB)**. Art + VFX are built (preset `rp`,
  VFX `rp_*`). **Waiting for the owner's class data** (identity, resource, core mechanic, 4-6 skills,
  ultimate = black sun art, Q special + passive, unlock conditions) — or the owner says "ออกแบบให้เลย" (design it).
- Known art limits: AG walk sheet barely moves its legs (a code step-bob compensates; new walk art would fix it).
