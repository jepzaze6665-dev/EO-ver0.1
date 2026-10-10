# Wyrmblood Reaver — SKILL + VFX prompts

ใช้รูปแบบเดียวกับ ECLIPSE_ONLINE_Skill_VFX_Prompts.pdf ของเจ้าของ

Class: `wyrmblood_reaver` · Umbral Sword line · secret tier 4

---

## โครงสร้างการใช้ (2 ทางแยกกัน)

**ทางที่ 1 - ชิลด์ท่า (สกิล)**: แนบรูปตัวละคร + MASTER PROMPT ตัวละคร + SKILL BLOCK
-> เอฟเฟกต์ถูกวาด **อยู่ในภาพ** เพราะเกมวาดตัวละครกับ VFX พร้อมกัน

**ทางที่ 2 - VFX ล้วน**: ไม่แนบรูป + MASTER VFX PROMPT + VFX BLOCK
-> ต้องระบุ PRIMARY / SECONDARY / ACCENT สี และห้ามมีตัวละคร

**ต้องการต่อคลาส**: walk, idle, atk1, atk2, dash, hit, sk1-sk6, ut + VFX 8 strip

---

## 1. MASTER PROMPT - Character Skill Sheet

```
Use the uploaded character sprite sheet as the EXACT and ONLY visual character reference.
Create a combat skill animation sprite sheet for the exact same character for ECLIPSE ONLINE,
a 2D isometric pixel-art action RPG.

The uploaded image is the locked character model. DO NOT redesign the character.
Preserve exactly: face, eyes, hairstyle, hair shape, skin tone, head size, body proportions,
armor, clothing, coat, cape, boots, gloves, signature weapon, weapon shape, weapon size,
color palette, outline thickness, pixel density, shading style, lighting style, silhouette.

ONLY change: combat pose, movement, weapon movement, casting movement, defensive pose,
and class-specific skill VFX.

CHARACTER: lean agile warrior, messy black hair, pale skin, glowing crimson eyes, long tattered
black coat with dark red dragon-scale trim on the shoulders and cuffs, exposed forearms with
glowing red veins, dark leather straps across the chest, a short curved dragon-fang blade with a
molten red edge.

SPRITE SHEET: ROW 1 = FRONT / SOUTH, ROW 2 = BACK / NORTH, ROW 3 = LEFT / WEST, ROW 4 = RIGHT / EAST.
6 frames per row. Keep the character centered, same scale, same camera distance, never crop.

ANIMATION: frame 1 = preparation / neutral, frame 2 = wind-up, frame 3 = action begins,
frame 4 = strongest action / impact, frame 5 = follow-through, frame 6 = recovery.

TRUE TRANSPARENT BACKGROUND ONLY. NO background, floor, environment, character shadow, enemy, UI,
text, labels, grid, borders, separator lines, watermark, or logo.

PIXEL ART: crisp pixel art, hard pixel edges, no anti-aliasing, no blur, no 3D rendering,
no realistic rendering, no painterly rendering.

CHARACTER CONSISTENCY: treat the uploaded reference as a locked model sheet. The exact same
character must appear in every frame. Do not add or remove equipment. Only animate the existing
character.

Output ONLY the clean sprite sheet, ready for HTML5 Canvas 2D.
```

---

## 2. SKILL BLOCKS - ตัวละครทำท่า (แนบรูปเสมอ)

ต่อทุกบล็อกด้วย:
```
Keep the exact character design from the uploaded reference. Use only the existing signature weapon
and equipment. Do not add enemies or environment. Transparent background only. The skill animation
must remain readable, consistent, and production-ready for HTML5 Canvas.
```

### SK1 Crimson Fang
```
CLASS: WYRMBLOOD REAVER   SKILL: Crimson Fang
Fast predatory lunge bite with the fang blade pointed ahead of the body; frame 4 strongest;
a thin crimson streak trailing the blade.
```

### SK2 Blood Pact
```
CLASS: WYRMBLOOD REAVER   SKILL: Blood Pact
Self-burn ritual: one hand rises then presses to the chest, veins flaring brightest on frame 4,
head tilted back; the glow stays inside the body silhouette.
```

### SK3 Scale Shed
```
CLASS: WYRMBLOOD REAVER   SKILL: Scale Shed
Armour shed: shoulders hunch, dark red dragon scales burst off the shoulders and arms, arms spread
wide on frame 4 with small scale shards around the body.
```

### SK4 Wyrm Rend
```
CLASS: WYRMBLOOD REAVER   SKILL: Wyrm Rend
Violent two-handed downward rend; blade raised high on frames 1-2, dragged down through frame 4
with a crimson gouge trail along the blade path; the most violent pose set on this character.
```

### SK5 Vein Thrust
```
CLASS: WYRMBLOOD REAVER   SKILL: Vein Thrust
Clean straight thrust with the fang blade, arm fully extended on frame 4; minimal wind-up,
a narrow crimson line trailing the blade tip.
```

### SK6 Blood Harvest
```
CLASS: WYRMBLOOD REAVER   SKILL: Blood Harvest
Draining strike: the blade is dragged back through a wound, crimson droplets pulled along the
blade toward the character; frame 4 strongest with droplets mid-air.
```

### UT Dragon Blood Awakening
```
CLASS: WYRMBLOOD REAVER   SKILL: Dragon Blood Awakening-ULTIMATE
Massive ultimate transformation; kneels head-down on frame 1, rises with every vein blazing by
frame 3, head tilted fully back with the blade planted point-down on frame 4; ultimate scale,
96x96 px per frame.
```

### ATK1 / ATK2 / DASH / HIT / IDLE

ใช้ MASTER + บล็อกจาก art-prompts-wyrmblood-reaver.md หัวข้อ 2 (แอนิเมชันทั่วไป)

---

## 3. MASTER PROMPT - VFX Sprite Sheet (ไม่แนบรูป)

```
Create a production-ready 2D pixel-art VFX sprite sheet for ECLIPSE ONLINE, a fantasy isometric
action RPG.

VFX ONLY. Do NOT create a character, enemy, weapon, environment, floor, scenery, or UI.
The VFX must be independently layerable over a character sprite in HTML5 Canvas 2D.

SKILL: [SKILL NAME]    CLASS: WYRMBLOOD REAVER
VFX TYPE: [SLASH / DASH / PROJECTILE / AOE / BARRIER / MAGIC / EXPLOSION / HEAL / RITUAL]

Design a clear readable game effect with a strong silhouette and obvious
start -> charge -> impact -> end timing.

PIXEL ART: crisp pixel art, hard pixel edges, no anti-aliasing, no blur, no 3D, no painterly
rendering. Use hard pixel clusters and controlled color ramps.

COLOR: Primary: deep crimson   Secondary: ember orange   Accent: black
Do not introduce unrelated colors.

SPRITE FORMAT: 4 rows (South, North, West, East), 6 frames per row.
Non-directional AOE / ground VFX may use a single animation row.

ANIMATION: frame 1 = initial appearance / charge, frame 2 = energy forming, frame 3 = expansion,
frame 4 = maximum effect / impact, frame 5 = follow-through / particles, frame 6 = fade out.

TRUE TRANSPARENT BACKGROUND ONLY. NO white, black, pink or colored backdrop. NO floor, ground
texture, scenery, character shadow, UI, text, labels, borders, grid, watermark, or logo.

Do not create a fake character silhouette. Do not include hands, body, face, armor, or weapon.

Output ONLY the clean VFX sprite sheet.
```

---

## 4. VFX BLOCKS (เติมใน MASTER ข้างบน - ไม่แนบรูป)

ต่อทุก block:
```
VFX ONLY. Do not create character, enemy, weapon, environment, floor, or UI. Transparent background
only. Crisp hard-edged pixel art. VFX must be readable and independently layerable over a
character sprite.
```

| ไฟล์ | เติมใน MASTER VFX |
|---|---|
| SK1 | `SKILL: Crimson Fang   VFX TYPE: SLASH`<br>`Fast sharp crescent fang slash of compressed blood energy; crimson core, orange edge, short fragments.` |
| SK2 | `SKILL: Blood Pact   VFX TYPE: RITUAL`<br>`Cracked rune pact circle burning on the ground; the ring closes then ignites.` |
| SK3 | `SKILL: Scale Shed   VFX TYPE: MAGIC`<br>`Small dark red dragon scale shards flinging outward in a burst.` |
| SK4 | `SKILL: Wyrm Rend   VFX TYPE: SLASH`<br>`Two huge claw gouges tearing downward through the air; heavy crimson trail.` |
| SK5 | `SKILL: Vein Thrust   VFX TYPE: PROJECTILE`<br>`A straight red thrust streak with a bright molten tip and short tail.` |
| SK6 | `SKILL: Blood Harvest   VFX TYPE: MAGIC`<br>`Crimson droplets pulled inward along a line toward a point, then compressing.` |
| UT | `SKILL: Dragon Blood Awakening   VFX TYPE: AOE`<br>`A column of red light rising from a spreading pool on the ground; ultimate scale.` |
| VFX | `SKILL: Blood droplets   VFX TYPE: MAGIC`<br>`Blood droplets falling and splashing on the ground.` |

---

## 5. Passive icons (2)

```
Use the uploaded character sprite sheet as the visual reference for class identity. Create a square
pixel-art passive-skill icon.
PASSIVE: Dragon's Thirst   CLASS: WYRMBLOOD REAVER
A gauntlet hand with black blood draining from the fingers into a crimson pool, framed by two
curved dragon fang shapes. Class palette: black, deep crimson, ember orange.
True transparent background. No text, letters, numbers, or UI frame. Readable at 32x32 and 64x64.
```

```
PASSIVE: Bloodless Night   CLASS: WYRMBLOOD REAVER
A cracked dragon fang standing upright with a thin crimson line running through it.
Class palette: black, deep crimson, ember orange. Transparent background. No text, no UI frame.
Readable at 32x32 and 64x64.
```

---

## 6. Splash + emblem

ใช้จาก art-prompts-dragon-secret-classes.md - Wyrmblood Reaver splash + emblem

---

## 7. Build

```bash
node tools/build-player.js wr      # หลังเพิ่ม preset 'wr' ใน build-player.js
node tools/build-vfx.js            # หลังเพิ่ม set 'wr' ใน build-vfx.js
node tools/tests/sprites.test.mjs
```

ตรวจผล: `tools/viewer.html`
