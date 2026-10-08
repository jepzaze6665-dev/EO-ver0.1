# ECLIPSE ONLINE — Prompt สร้าง Sprite NPC (ChatGPT)

ทำเฉพาะ sprite ในเกม และเฉพาะ NPC ที่มีชื่อ
**1 ภาพ = รวม 3 ตัวละคร** ทั้งหมดมี 13 ตัว จึงต้องสั่ง 5 ภาพ (ภาพสุดท้ายมี 1 ตัว)

## วิธีใช้
1. เปิด ChatGPT แล้วเริ่มแชตใหม่ทุกครั้งที่เริ่มภาพใหม่ (สไตล์จะได้ไม่ติดมาจากภาพก่อน)
2. คัดลอก **บล็อกสไตล์กลาง** และ **บล็อก layout** ไปวาง แล้วต่อด้วยบล็อกของภาพนั้น (ภาพ 1–5)
3. ตั้งขนาดภาพเป็นสี่เหลี่ยมจัตุรัส 1024×1024 หรือใหญ่กว่า
4. ถ้าออกมาไม่ดี เช่นท่าซ้อนกัน หรือหันผิดทิศ ให้พิมพ์สั่งแก้ในแชตเดิม เช่น
   `Keep everything, but make row 2 face away from the camera (back view).`
5. บันทึกไฟล์ไว้ที่ `desgin/NPC/sheet1.png` … `sheet5.png` แล้วบอกผม ผมจะเขียนเครื่องมือตัดภาพให้

## สิ่งที่ภาพต้องมี (ตาราง layout)
- 3 แถว แถวละ 1 ตัวละคร เรียงจากบนลงล่าง
- แต่ละแถวมี 6 ท่า เรียงจากซ้ายไปขวา:
  `ยืนหันหน้า | ยืนหันหลัง | ยืนหันซ้าย | ยืนหันขวา | เดินหันหน้า ก้าวเท้าซ้าย | เดินหันหน้า ก้าวเท้าขวา`
- ทุกท่าต้องแยกห่างกันชัดเจน ห้ามแตะหรือซ้อนกัน
- พื้นหลังสีดำสนิท ไม่มีตัวหนังสือหรือตัวเลข
- ทุกท่าต้องมีขนาดตัวเท่ากัน

---

## บล็อกสไตล์กลาง (ใส่ทุกครั้ง)
```
Pixel-art sprite sheet for a top-down dark-fantasy action RPG (3/4 top-down view, like classic SNES/GBA action RPGs).
Crisp clean pixel art, limited palette, 1-pixel dark outline around every character, soft cel shading, no anti-aliasing blur.
Mood: dark fantasy, moonlit, slightly muted colours with one accent colour per character.
Characters are small game sprites (about 48-64 pixels tall each, drawn large on the canvas), full body, feet visible.
```

## บล็อก layout (ใส่ทุกครั้ง)
```
Layout: a clean grid on a PURE BLACK background (#000000), no text, no labels, no numbers, no frames, no shadows on the ground.
3 rows, one character per row. Each row has 6 poses from left to right:
1) idle facing the camera (front), 2) idle facing away (back), 3) idle facing left (side profile),
4) idle facing right (side profile), 5) walking toward the camera, left foot forward, 6) walking toward the camera, right foot forward.
Same character, same size and same colours in all 6 poses. Big empty gaps between poses — no pose touches another.
All characters share the same scale (an adult is the same height in every row).
```

---

## ภาพ 1 — Lumina Village
```
Row 1 — CAPTAIN ALDRIC, village guard captain: middle-aged man, short grey-streaked beard, weathered steel breastplate over a
dark blue tabard with a small silver crescent emblem, brown cloak, sword at the hip, holding a spear upright. Stern but kind. Accent: navy blue.
Row 2 — ELDER MAREN, village elder and wise woman: old woman, long white braided hair, hooded moss-green robe with embroidered
runes, wooden staff topped with a small glowing lantern, slightly hunched. Accent: soft lantern gold.
Row 3 — BORIN, village blacksmith: stocky broad man, bald head, thick red beard, leather apron over a rolled-sleeve shirt,
soot on arms, heavy hammer resting on his shoulder. Accent: forge orange.
```

## ภาพ 2 — คนในป่าและคนเดินทาง
```
Row 1 — KAEL, ruin explorer in the old forest ruins: young man, messy dark hair, scarf over the lower face pulled down,
worn brown leather coat with many pouches, rolled map in one hand, short sword on the back. Curious, alert. Accent: teal.
Row 2 — SCOUT WREN, scout of the hidden valley Valehaven: lean young woman, short auburn hair, hooded green-grey ranger
cloak, longbow on the back, quiver, light leather armour, feather in the hood. Accent: forest green.
Row 3 — ASHEN PILGRIM, mysterious wandering pilgrim: tall figure fully wrapped in grey ash-coloured robes and bandages,
face hidden in a deep hood with only two faint ember-orange eyes, carries a tall walking staff with a small hanging censer
that trails embers, a few glowing cracks of orange on the robe hem. Eerie and quiet. Accent: ember orange.
```

## ภาพ 3 — Asteria City (1)
```
Row 1 — GUILDMASTER SERAPHINE, head of the adventurers' guild: elegant woman in her thirties, long silver hair tied back,
white-and-gold long coat with a high collar, rapier at the hip, a guild badge pinned on the chest. Confident leader. Accent: gold.
Row 2 — ODO, city merchant: plump cheerful man, round face, curled moustache, colourful striped vest over a white shirt,
red cap, a large backpack of goods with hanging pots and scrolls, coin pouch on the belt. Accent: crimson red.
Row 3 — HILDE, city smith: tall muscular woman, short blond hair, thick leather apron and gauntlets, burn marks, tongs in
one hand, a small glowing ingot in the other. Accent: hot iron orange.
```

## ภาพ 4 — Asteria City (2)
```
Row 1 — SIR CALLUM, knight of Asteria: young knight in polished silver plate armour with blue-and-white trim, short brown
hair, no helmet, kite shield with a star emblem on the back, longsword at the hip. Noble posture. Accent: sky blue.
Row 2 — ARCHIVIST IMRE, keeper of the Hall of Records: thin elderly man, round spectacles, long violet scholar robe with
star patterns, a thick book under one arm and a quill behind the ear, long thin grey beard. Accent: violet.
Row 3 — MARROW THE TRADER, nomad caravan trader of the frozen north: wiry man wrapped in thick fur coat and layered scarves,
fur hat, frost on the shoulders, tanned face with a sly grin, a lantern hanging from a pole over the shoulder, satchels of
exotic goods. Accent: amber.
```

## ภาพ 5 — ตัวสุดท้าย (1 ตัว)
> สำหรับภาพนี้ ให้เปลี่ยนคำว่า `3 rows` ในบล็อก layout เป็น `1 row`
```
Row 1 — WAYSTONE KEEPER, quiet keeper of the travel waystones and storage: hooded figure in a deep blue robe with glowing
cyan rune lines, carries a ring of old keys and a small floating rune crystal beside the shoulder. Calm and mysterious. Accent: cyan.
```

---

## หมายเหตุ
- ชื่อ NPC ทั้งหมดตรงกับชื่อในเกม ส่วน Waystone Keeper ยังไม่มีชื่อ ถ้าต้องการตั้งชื่อ บอกผมได้
- ถ้า GPT วาดท่า "หันซ้าย" กับ "หันขวา" ออกมาเหมือนกัน ไม่เป็นไร ผมกลับด้านภาพในเครื่องมือให้ได้
- ถ้า GPT ใส่พื้นหลังลายตารางหมากรุกปลอมมา ก็ยังตัดได้ (เครื่องมือของเรารองรับแบบนี้อยู่แล้ว) แต่ถ้าเป็นพื้นดำจะตัดได้สะอาดที่สุด
