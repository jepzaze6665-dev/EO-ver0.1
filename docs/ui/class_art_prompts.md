# ECLIPSE ONLINE — Prompt ภาพคลาส (หน้าเลือกคลาส)

แต่ละคลาสต้องการ **2 รูป**: (1) ภาพตัวละครเต็มตัว (splash) และ (2) ตราคลาส (emblem) — รวม 24 รูป

**กติกาทุกรูป**
- พื้นหลัง **ดำสนิท** (ผมตัดพื้นออกเองด้วยเครื่องมือ) · **ไม่มีตัวหนังสือ ไม่มีกรอบ**
- Splash: สัดส่วน **2:3** (เช่น 1024×1536) · ตัวละครสูงประมาณ 85% ของภาพ · หันเฉียงซ้ายเล็กน้อย (ภาพจะวางฝั่งขวาของจอ)
- Emblem: สัดส่วน **1:1** (เช่น 1024×1024)
- Midjourney: ต่อท้าย `--ar 2:3 --style raw` (splash) / `--ar 1:1 --style raw` (emblem) · ช่อง negative: `--no text, letters, logo, watermark, frame, border`
- **ห้าม**ใส่ชื่อเกม / อนิเมะของคนอื่นใน prompt (เช่น Shangri-La Frontier)
- วางไฟล์ที่ `desgin/UI/class/` ตั้งชื่อ `<class>_splash.png` และ `<class>_emblem.png` (ชื่อ class อยู่ในหัวข้อแต่ละอัน)

**Negative prompt (ใช้ได้ทุกรูป)**
```text
text, letters, words, logo, watermark, signature, frame, border, card, UI, background scenery, multiple characters, cropped feet, blurry, low resolution, extra limbs
```

---

## สาย UMBRAL (เงา · ม่วง)

### 1. Umbral Sword — `umbral_sword` (BASE)
**Splash**
```text
Full-body pixel art character splash of a young swordsman assassin with messy spiky black hair and glowing violet eyes, long black coat with violet trim and tattered hem, dark leather armor, holding a slim black shadow blade with a violet edge glow, confident ready stance, dark fantasy anime style, crisp detailed pixels, strong violet rim light, faint violet shadow mist around the feet, isolated on a plain pure black background, no text, no frame, character fills 85% of the image height
```
**Emblem**
```text
Pixel art class emblem icon: a sharp violet crescent-blade sigil shaped like a flame with a diamond core, dark metal crest with glowing violet edges, centered, isolated on plain pure black background, no text, crisp pixels, high resolution
```

### 2. Nightfall Reaper — `nightfall_reaper` (Class 2)
**Splash**
```text
Full-body pixel art character splash of a hooded reaper: deep black hood shadowing the face with two glowing violet eyes, layered tattered black cloak with spiked dark armor, holding a large curved scythe with a glowing violet blade, a pale full moon glow behind the shoulder, menacing still pose, dark fantasy anime style, crisp detailed pixels, violet rim light, wisps of violet shadow smoke, isolated on a plain pure black background, no text, no frame, character fills 85% of the image height
```
**Emblem**
```text
Pixel art class emblem icon: a violet scythe blade crossing a crescent moon above a diamond, dark iron crest with glowing violet edges, centered, isolated on plain pure black background, no text, crisp pixels, high resolution
```

### 3. Duskrunner — `duskrunner` (Class 2)
**Splash**
```text
Full-body pixel art character splash of a fast assassin with spiky black hair and blue eyes, long flowing dark blue scarf, light black armor with steel plates, holding twin short blades with glowing electric-blue edges, low dynamic running stance leaning forward, blue speed streaks behind, dark fantasy anime style, crisp detailed pixels, cold blue rim light, isolated on a plain pure black background, no text, no frame, character fills 85% of the image height
```
**Emblem**
```text
Pixel art class emblem icon: two crossed twin daggers inside a sharp blue flame-shaped sigil with speed lines, dark steel crest with glowing electric-blue edges, centered, isolated on plain pure black background, no text, crisp pixels, high resolution
```

### 4. Blade of Echoes — `blade_of_echoes` (Class 2)
**Splash**
```text
Full-body pixel art character splash of a duelist swordsman with spiky black hair and crimson eyes, black armored coat with a white and red half-cape on one shoulder, holding a long sword with a glowing crimson blade and faint ghostly afterimage copies of the blade behind it, calm counter stance, dark fantasy anime style, crisp detailed pixels, crimson rim light, isolated on a plain pure black background, no text, no frame, character fills 85% of the image height
```
**Emblem**
```text
Pixel art class emblem icon: a crimson sword with two fading echo outlines of itself, inside a red flame-shaped sigil, dark metal crest with glowing crimson edges, centered, isolated on plain pure black background, no text, crisp pixels, high resolution
```

---

## สาย ASTRAL (ดวงดาว · ฟ้า)

### 5. Astral Weaver — `astral_weaver` (BASE)
**Splash**
```text
Full-body pixel art character splash of a young star mage with long dark hair under a dark navy hood, layered dark robe with gold star embroidery, glowing pale-blue threads of starlight weaving between her fingers, a small floating constellation loom of light beside her, graceful casting pose, dark fantasy anime style, crisp detailed pixels, pale cyan rim light, tiny stars floating around, isolated on a plain pure black background, no text, no frame, character fills 85% of the image height
```
**Emblem**
```text
Pixel art class emblem icon: a four-pointed star connected by glowing constellation threads inside a circle, dark navy and gold crest with glowing pale-cyan edges, centered, isolated on plain pure black background, no text, crisp pixels, high resolution
```

### 6. Stormcaller — `stormcaller` (Class 2)
**Splash**
```text
Full-body pixel art character splash of a storm mage with long dark hair under a deep blue hood, dark blue robe with silver trim fluttering in the wind, holding a tall staff topped with a crackling blue crystal, small lightning bolts arcing around the body, windswept dynamic pose, dark fantasy anime style, crisp detailed pixels, electric-blue rim light, isolated on a plain pure black background, no text, no frame, character fills 85% of the image height
```
**Emblem**
```text
Pixel art class emblem icon: a jagged lightning bolt splitting a storm-cloud ring, dark steel crest with glowing electric-blue edges, centered, isolated on plain pure black background, no text, crisp pixels, high resolution
```

### 7. Void Scribe — `void_scribe` (Class 2)
**Splash**
```text
Full-body pixel art character splash of a void mage with long dark hair under a deep purple hood, dark violet robe with arcane runes, holding an open floating black tome in one hand and a glowing arcane quill in the other, violet glyph circles drifting around, mysterious calm pose, dark fantasy anime style, crisp detailed pixels, violet rim light, isolated on a plain pure black background, no text, no frame, character fills 85% of the image height
```
**Emblem**
```text
Pixel art class emblem icon: an open black book with a quill crossing it and a violet void rune glowing above, dark metal crest with glowing violet edges, centered, isolated on plain pure black background, no text, crisp pixels, high resolution
```

### 8. Lumen Oracle — `lumen_oracle` (Class 2)
**Splash**
```text
Full-body pixel art character splash of a holy oracle with long dark hair under a cream hood, flowing cream-white and gold robe, holding a tall golden staff topped with a radiant sun-ring, a small glowing codex floating at the side, soft healing light motes around, serene blessing pose, dark fantasy anime style, crisp detailed pixels, warm golden rim light, isolated on a plain pure black background, no text, no frame, character fills 85% of the image height
```
**Emblem**
```text
Pixel art class emblem icon: a radiant golden sun-ring with an eye of light in the centre and small rays, ivory and gold crest with glowing warm-gold edges, centered, isolated on plain pure black background, no text, crisp pixels, high resolution
```

---

## สาย AEGIS (โล่ · ทอง)

### 9. Aegis Guardian — `aegis_guardian` (BASE)
**Splash**
```text
Full-body pixel art character splash of a young knight with black hair, polished silver plate armor with gold trim, long royal-blue cape, holding a round blue and gold shield with a cross emblem in front and a sword lowered at the side, steadfast guarding stance, dark fantasy anime style, crisp detailed pixels, warm golden rim light, isolated on a plain pure black background, no text, no frame, character fills 85% of the image height
```
**Emblem**
```text
Pixel art class emblem icon: a blue and gold kite shield with a radiant cross, small wings at its sides, gold crest with glowing warm-gold edges, centered, isolated on plain pure black background, no text, crisp pixels, high resolution
```

### 10. Warden of Dawn — `warden_of_dawn` (Class 2)
**Splash**
```text
Full-body pixel art character splash of a holy knight with black hair, white and silver plate armor with pale-blue accents, a huge white tower shield with a glowing dawn-sun emblem, holy longsword resting on the shoulder, soft dawn light rays behind, protective noble pose, dark fantasy anime style, crisp detailed pixels, pale-blue and gold rim light, isolated on a plain pure black background, no text, no frame, character fills 85% of the image height
```
**Emblem**
```text
Pixel art class emblem icon: a rising sun behind a white tower shield with pale-blue light rays, silver crest with glowing pale-blue edges, centered, isolated on plain pure black background, no text, crisp pixels, high resolution
```

### 11. Bulwark Sentinel — `bulwark_sentinel` (Class 2)
**Splash**
```text
Full-body pixel art character splash of a heavy fortress knight with black hair, massive dark-gold and bronze plate armor, a huge ornate gold shield with a blue cross gem planted on the ground, bastion sword in the other hand, immovable wide stance, dark fantasy anime style, crisp detailed pixels, golden rim light, faint blue barrier glow in front of the shield, isolated on a plain pure black background, no text, no frame, character fills 85% of the image height
```
**Emblem**
```text
Pixel art class emblem icon: a castle tower merged with a heavy gold shield and a blue gem, bronze crest with glowing gold edges, centered, isolated on plain pure black background, no text, crisp pixels, high resolution
```

### 12. Oathbreaker — `oathbreaker` (Class 2)
**Splash**
```text
Full-body pixel art character splash of a fallen knight with messy black hair and glowing violet eyes, cracked black plate armor with purple and crimson veins of light, a broken shield on one arm, holding a jagged ruin blade glowing magenta-violet, defiant aggressive pose, dark fantasy anime style, crisp detailed pixels, violet-crimson rim light, dark energy cracks in the air, isolated on a plain pure black background, no text, no frame, character fills 85% of the image height
```
**Emblem**
```text
Pixel art class emblem icon: a cracked shield split by a jagged violet blade with crimson sparks, black iron crest with glowing magenta-violet edges, centered, isolated on plain pure black background, no text, crisp pixels, high resolution
```

---

## เคล็ดลับให้ทั้งชุดเข้ากัน
- ทำ **Umbral Sword ก่อน** เลือกรูปที่ชอบที่สุด แล้วใช้เป็นภาพอ้างอิงสไตล์ให้ทุกคลาสที่เหลือ (Midjourney: `--sref <ลิงก์รูปนั้น>`; เครื่องมืออื่น: ใส่เป็น reference image)
- class 2 ของแต่ละสายควรมีหน้าตาเป็น "คนเดิมที่อัปเกรด" (ผมดำ ชุดโทนเดียวกับ base) แบบในภาพที่ส่งมา
- ถ้าตัวละครออกมาไม่เต็มตัว (เท้าขาด) ให้เพิ่ม `full body visible from head to boots`
