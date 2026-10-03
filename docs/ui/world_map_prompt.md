# ECLIPSE ONLINE — Prompt ภาพแผนที่โลก (หน้าเลือกแผนที่)

ภาพนี้ใช้เป็นพื้นหลังด้านขวาของหน้าเลือกแผนที่ หมุด A1-A3 / B1-B3 จะวางทับด้วยโค้ด
**ในภาพห้ามมีตัวหนังสือ หมุด หรือไอคอน** มีแค่ภูมิประเทศ

## ขนาด
- สัดส่วน **16:10** หรือ **3:2** (เช่น 1920×1200 หรือ 1536×1024)
- Midjourney: `--ar 3:2 --style raw` · ใส่ negative ด้วย `--no text, letters, labels, icons, pins, UI, frame, border`

## Prompt หลัก
```text
Top-down fantasy world map painting for a dark fantasy RPG, seen from high above like a cartographer's map but painted in detailed pixel-art style. At the bottom centre, a small walled village in a clearing (Lumina). From it, two regions spread upward: on the LEFT side, a dense dark-green whispering forest (lower left), above it lush green terraced cliffs with rivers, waterfalls and a glowing red lava rift (middle left), and at the upper left a ruined white-stone citadel with bronze roofs and faint blue rune lights. On the RIGHT side, wide snowy plains with frozen lakes (lower right), above them dark crystal caverns with purple glowing crystals breaking through rocky ground (middle right), and at the upper right tall icy mountain peaks with a fortress on the summit. At the top centre, a grand walled city with spires and a crystal plaza (Asteria) where both sides meet. Natural winding roads lead from the village up through each side to the city. Dark moody night palette: deep navy, dark green, muted gold highlights, soft violet glow from a faint eclipse light in the sky, vignette on the edges, rich detail, no text, no labels, no icons, no UI.
```

## Negative prompt
```text
text, letters, words, labels, names, numbers, icons, pins, markers, compass rose, legend, UI, frame, border, watermark, signature, characters, people close-up, blurry, photo
```

## ตำแหน่งที่หมุดจะไปวาง (ให้ภาพมีพื้นที่ตรงนั้นตามนี้)
| หมุด | พื้นที่ในภาพ | ตำแหน่งโดยประมาณ (ซ้าย→ขวา %, บน→ล่าง %) |
|---|---|---|
| Lumina (หมู่บ้าน) | กลางล่าง | 50, 86 |
| A1 ป่าเสียงกระซิบ | ซ้ายล่าง | 34, 70 |
| A2 หุบเขาโบราณ + ลาวา | ซ้ายกลาง | 22, 48 |
| A3 เมืองรูนพังทลาย | ซ้ายบน | 30, 25 |
| B1 ทุ่งหิมะ | ขวาล่าง | 66, 70 |
| B2 ถ้ำคริสตัล | ขวากลาง | 78, 48 |
| B3 ยอดเขาน้ำแข็ง | ขวาบน | 70, 25 |
| Asteria (เมืองหลวง) | กลางบน | 50, 10 |

ถ้าภาพที่ได้มีตำแหน่งต่างไปบ้างไม่เป็นไร ผมย้ายหมุดให้ตรงภาพได้ (แก้ตัวเลขในไฟล์ `src/data/worldMap.js`)

## วางไฟล์
- วางที่ `desgin/UI/worldmap.png` แล้วบอกผม ผมจะย่อและวางเป็น `assets/ui/worldmap.png` ให้
- พอมีไฟล์นี้ หน้าเลือกแผนที่จะใช้ภาพจริงแทนแผนที่ที่วาดด้วยโค้ดโดยอัตโนมัติ
