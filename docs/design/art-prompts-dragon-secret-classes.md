# ECLIPSE ONLINE — Art Prompts: Dragon Secret Classes (tier 4)

Three secret classes (tier 4) born from the dragon boss Varkharon. All three share one design
language: dragon-blood red + obsidian black + ember orange glow, with a dragon-motif trim that is
subtle enough to still read as each parent line.

**Place raw art at** `desgin/class cr/DRG/` (all three classes in one folder), and VFX at
`desgin/VFX/DRG/`.

---

## Shared negative prompt (every image)

```
text, letters, words, logo, watermark, signature, frame, border, card, UI panel, checkerboard,
background scenery, multiple characters, cropped feet, cropped head, blurry, low resolution,
extra limbs, extra arms, photo, 3d render, cel-shaded vector art
```

**Universal style clause** (append to every positive prompt):

```
top-down 3/4 view dark-fantasy action RPG pixel art, crisp clean pixel edges, no anti-aliasing,
no perspective distortion, game asset sheet, black background, character centred
```

---

## 1. Wyrmblood Reaver — `wyrmblood_reaver` (Umbral Sword line)

Fantasy: a hunter who pays for every strike with his own blood. His silhouette stays Umbral (long
coat, dark blade) but the blade is now a fang and his veins glow.

### Character sheet

One PNG per animation, all in `desgin/class cr/DRG/wr/`, same layout as the other presets: rows of
poses, 4 direction columns (front / right / back / left), plain black background, character about
58-60 px tall in a 160 px cell, feet near the bottom.

Files needed (same names as the other presets so the game can play them):

```
walk1.png    WALK 2.png    ATK1.png    ATK2.png    DASH.png    HIT.png
SK1.png      SK2.png       SK3.png     SK4.png     SK5.png     SK6.png
UT.png       VFX.png
```

Positive prompt for the sheet:

```
Top-down 3/4 pixel art character sprite sheet for a dark-fantasy action RPG, one warrior shown
in many poses arranged in a grid, 4 direction views (front, right, back, left) per row, plain
black background, no text, no labels.

The warrior: lean agile frame, messy black hair, pale skin, glowing crimson eyes, long tattered
black coat with a dark red dragon-scale trim on the shoulders and cuffs, exposed forearms marked
with glowing red veins, dark leather straps across the chest, holding a short curved dragon-fang
blade with a molten red edge.

Poses: idle breathing stance, walking cycle, slashing forward, dashing low, taking a hit, and
casting poses with one hand raised and red energy gathering in the palm.

Art style: crisp pixel art, strong crimson rim light, dark shadows, limited palette of black,
charcoal grey, deep crimson and ember orange, clean readable silhouette, game sprite sheet
```

### VFX strips

`desgin/VFX/DRG/`, one sheet per effect, right-facing strips (the game rotates them):

| File | What it shows |
|---|---|
| `SK1` | A dash-bite streak: a long crescent fang slash, red trail behind |
| `SK2` | A blood-pact pact circle on the ground, cracked rune ring, red |
| `SK3` | Scales flinging off: small scale shards burst outward |
| `SK4` | A heavy rend: two huge claw gouges tearing downward |
| `SK5` | A radial blood burst from a wound, droplets flying |
| `SK6` | A vein burst: a ring shockwave of red liquid energy |
| `UT` | An awakening pillar: a column of red light rising from a spreading pool |
| `VFX` | Blood droplets falling and splashing (generic cast VFX) |

Positive prompt for one VFX strip:

```
Top-down pixel art VFX sprite sheet for a dark-fantasy action RPG, a horizontal strip of 6 frames
showing one effect progressing left to right, plain black background, no text, no labels.
The effect: [DESCRIBE ONE EFFECT ONLY]. Bright crimson and ember orange glow, sharp pixel edges,
transparent-looking background, game VFX asset sheet.
```

---

## 2. Wyrmplate Warden — `wyrmplate_warden` (Aegis Guardian line)

Fantasy: a knight who takes damage and turns it into armour plates that grow on his body. His
silhouette stays Aegis (shield-first, heavy) but the shield becomes a dragon-plated guard and his
body visibly scales up as the armour grows.

### Character sheet

`desgin/class cr/DRG/wr2/` (or `wp/`), same file list and layout as above.

Positive prompt:

```
Top-down 3/4 pixel art character sprite sheet for a dark-fantasy action RPG, one heavily armoured
knight shown in many poses arranged in a grid, 4 direction views per row, plain black background,
no text, no labels.

The knight: broad heavy frame, full plate armour in dark steel and black, a collar of thick
overlapping dragon scales around the shoulders and chest, a horned dragon-head pauldron on the
left shoulder, glowing orange cracks between the plates, a large round dragon-scale shield with
spiked rim in the right hand, a short heavy blade in the left, tattered dark tabard hanging below.

Poses: idle with shield up, walking slowly with weight, shield bash forward, raising the shield
to absorb a hit, flinging scales outward, and a casting pose where the armour plates flare open.

Art style: crisp pixel art, strong orange glow from the plate cracks, heavy dark shadows, limited
palette of black, dark steel, burnt orange and bone white, chunky readable silhouette, game sprite
sheet
```

### VFX strips

`desgin/VFX/DRG/`, second prefix:

| File | What it shows |
|---|---|
| `WP1` | A shield bash impact: a heavy arc of orange sparks |
| `WP2` | Plates knitting together: a ring of interlocking scale shapes |
| `WP3` | An armour shudder: a hexagonal plate barrier flashing |
| `WP4` | A ground slam: a cracked stone ring with orange glow from below |
| `WP5` | A taunt roar: a wide warning arc with a dragon head silhouette |
| `WP6` | A barrier dome: a heavy dome of orange light |
| `WPUT` | A carapace growth: the knight swelling, plates spreading outward |
| `WP VFX` | Heavy footfall dust with orange embers |

---

## 3. Eclipse Scribe / Void Mirror — `eclipse_scribe` (Astral Weaver line)

Fantasy: a scribe who steals a piece of every hit and throws it back as a mirrored beam. Silhouette
stays Astral (hooded robe, floating) but the robe is now black-and-red and the codex is replaced by
a cracked blood-mirror.

### Character sheet

`desgin/class cr/DRG/es/`, same file list and layout.

Positive prompt:

```
Top-down 3/4 pixel art character sprite sheet for a dark-fantasy action RPG, one robed figure shown
in many poses arranged in a grid, 4 direction views per row, plain black background, no text, no
labels.

The figure: a slim hooded scribe in a long black robe lined with deep crimson, the hood shadowing
the face with two glowing red slits for eyes, floating slightly off the ground, long sleeves
trailing like liquid shadow, holding a cracked oval blood-mirror frame in one hand and a thin bone
quill in the other, faint red mist orbiting the figure.

Poses: idle hovering, drifting forward, casting with the mirror raised, pulling the mirror to the
chest, throwing the quill, and a casting pose where the mirror cracks and light pours out.

Art style: crisp pixel art, crimson and violet rim light, deep shadows, limited palette of black,
deep crimson, violet and pale bone white, elegant readable silhouette, game sprite sheet
```

### VFX strips

`desgin/VFX/DRG/`, third prefix:

| File | What it shows |
|---|---|
| `ES1` | A mirror beam: a straight crimson line snapping outward |
| `ES2` | A steal: red droplets pulled from an impact toward a point |
| `ES3` | A mirror crack: a spiderweb of red cracks spreading |
| `ES4` | A beam returning: a line bouncing back along its own path |
| `ES5` | A stolen-shard projectile: a shard of red glass spinning |
| `ES6` | A big return beam: a wide reflected column of crimson light |
| `ESUT` | A constellation of the wyrm: several red star points linked by lines, then flaring |
| `ES VFX` | Mirror dust motes drifting |

---

## Build commands (after the art arrives)

```bash
node tools/build-player.js wr        # Wyrmblood Reaver
node tools/build-player.js wp        # Wyrmplate Warden
node tools/build-player.js es        # Eclipse Scribe
node tools/build-vfx.js              # picks up the DRG set once added to SETS in build-vfx.js
node tools/build-icons.js            # after icons land in desgin/ICON SKILL/DRG/
```

Each preset must end up normalised to canvas 160x160, pivot (80,140), neutral body about 58-59 px,
with `atlas.json` written. If a preset uses per-sheet options, add them next to the preset in
`tools/build-player.js` following the pattern of `PRESETS.vs` (it uses `liftFx` and `nearestBody`).

## Splash + emblem (class-select screen)

Also needed for each class: `<id>_splash.png` (2:3, black background) and `<id>_emblem.png` (1:1,
black background), placed at `desgin/UI/class/`, then `node tools/build-class-art.js`.

**Wyrmblood Reaver emblem**
```
Pixel art class emblem icon: a curved dragon fang dripping red, crossed with a crimson slash
sigil, dark iron crest with glowing red edges, centred, isolated on plain pure black background,
no text, crisp pixels, high resolution
```

**Wyrmplate Warden emblem**
```
Pixel art class emblem icon: a dragon head made of overlapping armour scales with an open jaw,
dark steel crest with glowing orange cracks, centred, isolated on plain pure black background,
no text, crisp pixels, high resolution
```

**Eclipse Scribe emblem**
```
Pixel art class emblem icon: an oval cracked mirror reflecting a red star, dark frame with
crimson edges, centred, isolated on plain pure black background, no text, crisp pixels, high
resolution
```
