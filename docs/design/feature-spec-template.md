# Feature Spec Template

Copy this file to `docs/design/<feature-name>.md` and fill it in.
(คัดลอกไฟล์นี้ไปเป็น docs/design/<ชื่อฟีเจอร์>.md แล้วเติมข้อมูล)

---

# <FEATURE NAME> — SPEC

> Send Claude Code ONLY the path of this file. It reads the file as the contract.

## 0. Concept

<One paragraph: what the fantasy is, what changes for the player in combat, how it differs from
what already exists in the game.>

- **Modelled on**: `<real class id in src/skills/>` — because <reason>
- **Core systems used**: `<real names in src/combat/, e.g. summonSystem, threadSystem, markSystem>`
- **Art**: `desgin/class cr/<...>/<PRESET>` · preset `<...>` · VFX set `<...>`

## 1. Resource

| Field | Value |
|---|---|
| Name | <e.g. FROST> |
| Max | <e.g. 100> |
| Tiers | <e.g. 40 = CHARGED, 80 = SUPERCHARGED> + stats each tier grants |
| Gain sources | <every source WITH its cap, e.g. on hit +1, max 5/s, clears after 2 s idle> |
| Drain | <e.g. -25 on a heavy hit, drains 5/s in a fight> |
| Why this shape | <short: why this, how it differs from existing class resources> |

## 2. Skills

Keys: 1-4 = active · 5 = ultimate · Q = special

### Key 1 — <SKILL NAME>
- Category: OFFENSE / MOBILITY / UTILITY / RESOURCE / BURST / PASSIVE
- Resource cost: `<n>` · Cooldown: `<seconds>` · Tier: fast / medium / high
- Windup: `<seconds>`
- What it does: <...>
- Numbers: <power, area, duration>

### Key 2 — <SKILL NAME>
<same fields>

### Key 3 — <SKILL NAME>
<same fields>

### Key 4 — <SKILL NAME>
<same fields>

### Key 5 (ULT) — <SKILL NAME>
- Resource cost: `<n>` · Cooldown: `<seconds>` · Tier: high
- Requirement (if any): <e.g. markedFoe / hpBelow / scriptCount>
- What it does: <...>

### Key Q — <SKILL NAME>
- Resource cost: `<n>` · Cooldown: `<seconds>`
- What it does: <...>

## 3. Passives (both)

### P1 — <NAME>
- Hook: `on: { <eventName>(p, g, e) {} }`
- Effect: <...>

### P2 — <NAME>
- Hook: `on: { ... }`
- Effect: <...>

## 4. Files to add / change

| File | What to do |
|---|---|
| `src/skills/<class>.js` | <...> |
| `src/skills/classes.js` | <add to STARTING_CLASSES or CLASS_TREE> |
| `src/data/skillProgression.js` | category + 5 levels + tree unlocks |
| `src/data/skillIcons.js` | map each skill to its icon |
| `src/data/classTree.js` | <if needed> |

## 5. Generic core to add

> NEVER name this class inside `src/combat/` `src/status/` `src/progression/`.
> Everything new must be generic; the class calls it.

| Where | Shape | Who reads it |
|---|---|---|
| `src/data/<...>.js` | <flag / modifier / event> | <consumer> |

## 6. Art

```bash
node tools/build-player.js <preset>
node tools/build-vfx.js
node tools/build-icons.js
```

- Raw source: `desgin/class cr/<...>`
- Must exist after build: `assets/player/<preset>/*.png`, `assets/icons/<...>`

## 7. Tests

- Unit: `tools/tests/<name>.test.mjs` — must be added to `tools/tests/run.mjs`
- In-game: a `tools/testkit.js` function `<name>Check(g)` — decide how many steps

```js
const T = await import('/tools/testkit.js');
await T.<name>Check(__game, '<classId>');
```

## 8. Balance targets

| Metric | Target |
|---|---|
| Bot DPS on 3 dummies | <range> |
| Bot vs the map boss (no god) | <range in seconds> |
| EXP on a normal clear | <if calculable> |

## 9. Architecture rules (do not break)

- Core never names a class. A class is data + behaviour reacting to bus events.
- Pipeline: calculate (pure) -> apply -> feedback -> events
- Gameplay state stays separate from DOM/UI
- Every new system must be usable by other classes later
- Art style: top-down pixel art, tiles as separate square cards, plain dark navy background
