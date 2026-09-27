# ECLIPSE ONLINE — Prototype Vertical Slice

2D top-down dark-fantasy action RPG prototype (HTML5 Canvas 2D, vanilla ES modules, zero dependencies).

**Explore → Discover → Fight → Build → Boss → World State Change → Explore Further**

## Run

```bash
node server.js
```

Open **http://localhost:5173** (ES modules need `http://`, so opening `index.html` directly won't work).
Any static server works too, e.g. `npx serve .` or `python -m http.server 5173`.

## Controls

| Key | Action |
|---|---|
| WASD | Move (360°) · Shift = sprint |
| Mouse | Aim · Left Click = 3-hit combo |
| Space | Dodge (2 charges) — dodge right before a hit for **PERFECT DODGE** |
| 1 / 2 / 3 / 4 / 5 | Shadow Slash · Twin Fang · Shade Step · Shadow Arc · **Eclipse Sever** (ultimate) |
| Q / Right Click | **Shadow Break** (needs 3 Shadow Marks) |
| R / F | Healing Draught / Shadow Tonic |
| E | Interact / talk |
| I / M / Esc | Inventory · Equipment · Monster Knowledge · Lore / World map / Menu (Save · Load · Reset) |
| F3 | Debug overlay (FPS, counts, flags) |

## Playable flow (Definition of Done)

1. Title → **Lumina Village** (safe hub: guild, blacksmith, item shop, storage, waystone, quest board, 4+ NPCs)
2. Elder Maren → quest **Whispers in the Forest**; Captain Aldric → tutorial side quest (Marks / Perfect Dodge / Break)
3. North gate → **Whispering Forest** (96×128): main route + loops, 6 combat clearings, river & bridge, waterfall, camp, Elder Tree, stone circle, crystal glade
4. Secrets (hidden from the minimap until found): **Hidden Cave** (break the violet-cracked stone; mini-boss, Eclipse Sigil, lore, secret NPC), Behind the Waterfall, Moonlit Shrine, Sealed Archive (ruins)
5. Shortcuts: fallen-log bridge (push from the north bank), bramble lane (cut from the forest side), ruins side gate (lever inside)
6. **Ancient Ruins** (64×64) → investigate the shrine → Seal Fragment → open the **Guardian Gate**
7. **Guardian of the Forest** — 3 phases, telegraphed attacks, weak windows (after smash / charge crash / full stagger), arena changes per phase, camera lock
8. Victory → **WORLD STATE UPDATED**: fog lifts, corruption fades, trees/tiles change, monster spawns change, NPC dialogue changes, northern thorns wither
9. **Valehaven — City 2** (the Ancient Valley): Route A ends here; the Sealed Depths door is the hook for the next content
10. Save / Load / Reset (LocalStorage; autosave on progress)

### V2.2 World Progression — Route A (every boss is a gate)

```
Lumina (City 1) ─► A1 Whispering Forest ─► [Boss A1 Hollow Fang] ─► A2 Deep Forest ─► [Boss A2 Grukk]
                ─► A3 Ancient Ruins ─► [MAJOR BOSS: Guardian of the Forest, 3 phases + final attack] ─► City 2 Valehaven
Route B (B1 → B2 → B3 → City 2): architecture / data only for now (data/routes.js, data/bosses.js `planned`)
```
- The road to the next map is **solid** (a glowing gate on the bridge / path) and its exit **locked** until the map's
  boss falls. City 2 opens when **any** route's major boss falls (never both).
- Route panel under the player frame (route · boss alive/defeated · next map locked/unlocked · why), boss bar
  (area / major, phase, weak window), locked exits say what opens them, the world map [M] lists route progress.
- Data: `src/data/bosses.js` · `src/data/routes.js` · `src/data/worldTriggers.js` · map `requires` / `gates` in `src/maps/*.js`.

## Architecture (`src/`)

```
core/        game loop (fixed 60 Hz update + rAF render, hit stop, slow-mo, game-time scheduler), entity, events, pool, math, rng, assets
input/       keyboard + mouse, input buffer
camera/      smooth follow, bounds, zoom punch, trauma shake, arena lock, cinematic focus
render/      low-res pixel scene → nearest upscale, y-sorting, lighting, fog, atmosphere, special props
combat/      class-agnostic hitboxes & damage resolver, telegraphs, pooled projectiles, perfect-dodge detection
skills/      Umbral Sword class definition (basic combo, 5 skills, Shadow Break, passives) — new classes plug in here
player/      player controller + sprite-sheet animation mapping
status/      timed statuses (stun, vulnerable/weak window, haste, surge…)
monsters/    data-driven monster types, AI state machine, placeholder sprite generator, Monster Knowledge
boss/        bossSystem (encounters: HIDDEN→IDLE→ENGAGED⇄PHASE_CHANGE→DEFEATED/RESET, arena lock, rewards), bossState (pure
             state machine), areaBoss (generic data-driven boss: strike/dash/leap/volley/pattern/nova/summon), guardian (Major Boss A3)
world/       world manager & World State, worldProgression (bosses / unlocked maps / events), worldTriggerSystem,
             gateSystem (boss gates + collision), transitions, NPCs, narrative (lore + state-dependent dialogue)
maps/        tile grid, collision, chunk-cached renderer, procedural tileset, zone builders (village/forest/ruins/arena/valley)
exploration/ interactables (chests, lore, waystones, levers, shrines…) and breakable secret walls
quests/  items/  inventory/  equipment/  ui/ (canvas HUD + DOM panels)  save/  audio/ (WebAudio synth placeholders)  vfx/
```

### Classes (choose on New Game)

| Class | Role | Resource | Mechanic |
|---|---|---|---|
| **Astral Weaver** | Ranged magic · control | Astral Charge (builds, decays out of combat) | Astral Threads + Star Marks on enemies → Constellation Break |
| **Umbral Sword** | Melee assassin · burst | Shadow Gauge | Shadow Marks on self → Shadow Break · Shadow Veil (stealth → Ambush) · Phantom Edge |
| **Aegis Guardian** | Tank · protector · crowd control | Guard Gauge (fills by blocking) | Hold Q/RMB to **guard**; Perfect Guard → counter · Guardian Mark (taunt, −20% dmg) → Guardian Slash judgment · Holy Barrier · Aegis Ascension |

**Skill loadout:** keys 1-4 are chosen per character in the **Skills** tab (`I` → Skills; locked in combat, saved);
key 5 is the ultimate and Q the class special. Umbral Sword knows 6 actives for 4 slots.

**Class progression** (`I` → Class): each class keeps *class records* (Constellation Breaks, Perfect Guards,
Shadow Breaks…, counted from game events). Every Class 2 path (3 per class, 9 total) has requirements — level,
quest, class records — and a **class trial**; passing it unlocks the path. Class 2 classes are not playable yet
(they become selectable once their class data exists). **Class Change** (`Class` tab → Your Classes): the
character can switch to any class it owns — its starting class + every unlocked one — outside combat; level,
EXP, gold, inventory, quests and class records stay, the preset / resource / skills / passives / signature gear
change (`src/progression/classChange.js`). Tree, counters and trials: `src/data/classTree.js`; generic requirement types
(level · quest · flag · counter · item · secrets · trial · class · any · all, with hidden conditions for secret
classes): `src/progression/requirements.js`.

Class data lives in `src/skills/<class>.js` and is registered in `src/skills/classes.js`. Core systems used by every class:
`combat/damageSystem` · `resourceSystem` · `skillSystem` · `markSystem` · `threadSystem` · `guardSystem` · `status/status`
(rules in `src/data/*.js`). Saves store the class id; old saves load as Umbral Sword.

The combat core never references Umbral Sword directly: a class is a stat block + a basic combo + skills that return
*actions* (timelines of hitbox/VFX events). Enemies use the same hitbox shapes through telegraphs.

## Assets & pipeline

- `desgin/class cr/UB|AW|AG/` — class sheets (6 columns × 4 directions). `node tools/build-player.js [ub|aw|ag]` removes the checkerboard
  background, splits cells by detecting character blobs, aligns frames on the feet, auto-detects which side row faces
  left/right, normalises every class to the same body height / pivot, and writes `assets/player[/aw]/*.png` + `atlas.json`.
- `desgin/VFX/UB|AW|AG/` — skill effect sheets. `node tools/build-vfx.js` writes strips to `assets/vfx/` (AW: `aw_*`, AG: `ag_*`; directional effects use the right-facing row, caster-centred ones the front row). **To replace art:** drop new sheets with the same layout and rerun.
- `ของแมพ/*.png` — asset sets. `node tools/extract-props.js` cuts ~218 props (trees, rocks, crystals, ruins, village
  buildings…) into `assets/props/props.png` + `props.json`.
- Monsters, NPCs, tiles, icons and the Guardian are procedural placeholders generated at startup with the same frame
  structure a real sheet would use (see `monsters/monsterSprites.js`, `maps/tiles.js`).

## Testing

Unit tests (pure combat core, no browser):

```bash
node tools/tests/run.mjs          # all unit tests (combat, resource, skill, mark, status, thread, guard, progression, sprites, loadout, syntax)
```

In-game: a **training yard** with 3 Training Dummies (HP, DPS meter, auto-reset) stands west of the Lumina fountain.


`tools/testkit.js` is a browser-side harness (bot that fights and perfect-dodges, teleports, interacts) driving the
real game through a deterministic `game.simulate(seconds)` hook. From the dev-tools console:

```js
const T = await import('/tools/testkit.js');
T.playthrough(__game, 'astral_weaver');             // full 15-step regression for a class
T.toBoss(__game);                                   // jump to the Guardian fight
T.fight(__game, 300, { untilBossDead: true });      // bot plays the fight, returns a phase log
T.routeA(__game, 'aegis_guardian');                 // V2.2: Lumina → A1 → Boss A1 → gate → A2 → Boss A2 → A3 → Major Boss → City 2 → save/load
T.bossReset(__game);                                // dying in a boss fight resets the boss, nothing is lost
```

**Combat test (Phase 7)** — checks the V2 test requirements inside the running game for every starting class
(damage = HP loss, resource gain / exact cost / never negative, cooldown + anti-spam, mark stack / expire / trigger,
thread create / expire / trigger, 45 s stress run: no NaN / infinite damage / infinite resource / runaway objects)
and prints a balance report (30 s dummy DPS + a real Guardian fight without god mode):

```js
const C = await import('/tools/combatTest.js');
const r = C.runAll(__game);   // r.passed / r.total
console.table(r.rows); console.table(r.balance);
```
