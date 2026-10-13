# Prompt: กล่องสมบัติ + วัตถุที่ยังวาดด้วยโค้ด (ECLIPSE ONLINE)

ส่งไฟล์มาที่ `desgin/Map/SHARED/objects/` (ชื่อไฟล์ตามหัวข้อ) แล้วบอก Claude ให้ตัดเป็น prop (เหมือน gate_d / gate_ret)
กติกาทุกแผ่น: **พื้นหลังดำสนิท (#000000) ไม่มีลายตาราง**, ทุกเฟรมอยู่ในแถวเดียวกัน ระยะห่างเท่ากัน ไม่ทับกัน, ไม่มีตัวอักษร / ตัวเลข / เงา

## สไตล์ร่วม (แปะหน้าทุก prompt)
```
Pixel art game sprite sheet, top-down 3/4 view (like Hollow Knight meets classic 16-bit JRPG),
dark fantasy, crisp pixel edges, limited palette, soft rim light from the top-left, consistent with a
dark navy / violet night world. Pure solid black background (#000000), no checkerboard, no text,
no labels, no grid lines, no drop shadow. Every frame the same size and the same ground line,
evenly spaced in one horizontal row.
```

## 1. chest_normal.png — กล่องธรรมดา (สำคัญที่สุด)
```
[style] A sturdy wooden treasure chest with dark iron bands and a round iron lock, about 1.3x the size
of a 32px tile. ONE ROW of 6 frames: 1 closed, 2 lid lifts slightly with a thin warm gold glow from
the gap, 3 lid half open with gold light spilling up, 4 lid fully open, bright gold glow and a few
sparkles rising, 5 fully open, glow fading, 6 open and empty (dark inside, no glow).
```

## 2. chest_rare.png — กล่องหายาก (Ornate / Rare)
```
[style] An ornate treasure chest of dark violet-black wood with polished gold trim, a glowing purple
crystal set in the lid, small runes engraved on the front, slightly larger than the normal chest.
ONE ROW of 6 frames: 1 closed with a faint pulsing violet glow, 2 lid lifts with violet-white light
leaking out, 3 half open, violet light beam shooting up, 4 fully open, bright burst of violet and gold
sparkles, 5 open with glow fading, 6 open and empty.
```
(ถ้าอยากได้ idle: เพิ่มแถวที่ 2 = 4 เฟรม กล่องปิด คริสตัลบนฝาเรืองแสงหายใจเข้าออก)

## 3. waystone.png — จุดเช็คพอยต์ในแผนที่
```
[style] A waist-high ancient standing stone with a carved rune circle on its face. ONE ROW of 5 frames:
1 dormant (dark grey stone, runes unlit), 2-5 activated loop: runes glowing soft cyan, small
floating light motes around it, the glow gently pulsing brighter and dimmer across the 4 frames.
```

## 4. death_pile.png — กองของตอนตาย
```
[style] A small pile of a fallen adventurer's belongings on the ground: a dropped backpack, a cloak,
a few coins and a broken sword, about one tile wide. ONE ROW of 4 frames: a ghostly red glow and
tiny ember particles slowly rising above the pile (loop). SECOND ROW: the same 4 frames with a pale
blue glow instead of red (a teammate's pile).
```

## 5. lore_tablet.png — ป้ายเรื่องราว / บันทึก
```
[style] A small floating parchment scroll tied with a ribbon, glowing warm gold, hovering above a tiny
stone pedestal. ONE ROW of 4 frames: the scroll bobs up and down slightly and its glow pulses (loop).
```

## 6. trial_relic.png — ชิ้นส่วนเควสเปลี่ยนอาชีพ
```
[style] A floating crystal shard relic, sharp and elegant, pale violet with a white core, surrounded by
a thin ring of light, hovering above the ground with a soft glow on the ground beneath. ONE ROW of
6 frames: the shard slowly rotates and the ring of light pulses (loop).
```
(ใช้สีม่วงเป็นหลัก เกมย้อมสีให้แต่ละอาชีพเองได้)

## 7. campfire.png — กองไฟ (B1 พายุหิมะ / B3 ภูเขาหนาว)
```
[style] A small campfire of logs ringed with stones, sitting on snow. ONE ROW of 6 frames: lively
orange-yellow flames flickering, a few sparks rising (loop).
```

## 8. switches.png — คันโยก / สวิตช์รูน / แท่นบูชา
```
[style] Dungeon interaction objects, 3 rows:
Row 1 (2 frames): an old iron wall lever on a stone base — lever up, lever down.
Row 2 (4 frames): a waist-high rune switch pillar of white stone with bronze trim — unlit, then 3 frames
of the rune glowing bright blue (loop).
Row 3 (4 frames): a small old stone altar with an empty brazier — cold, then 3 frames of a violet flame
burning in the brazier (loop).
```
