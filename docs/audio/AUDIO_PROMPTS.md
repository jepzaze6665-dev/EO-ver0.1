# ECLIPSE ONLINE — ชุด Prompt เสียง v2 (เพลง 9 เพลง + SFX ครบทุกเสียง)

แนวเสียงทั้งเกม: **แนว Hollow Knight** — เบาบาง เศร้า มีช่องว่าง เครื่องดนตรีจริง (เปียโน, เชลโล, ไวโอลิน, ฮาร์ป,
คอรัสเบา ๆ) · SFX แห้ง คม สั้น ไม่มี reverb ยาว (ยกเว้นเสียงใหญ่: ult / บอส)

## วิธีใช้
1. คัดลอก prompt ภาษาอังกฤษไปสั่ง AI — เพลง = **Suno / Udio** (เลือก *Instrumental*) · SFX + Ambience = **ElevenLabs Sound Effects**
2. ตั้งชื่อไฟล์ตามตาราง (ตัวพิมพ์เล็ก) แล้ววาง:
   - เพลง → `desgin/SOUND/music/<ชื่อ>.mp3`
   - SFX → `desgin/SOUND/sfx/<ชื่อ>.wav` (ถ้าโหลด **wav** ได้ให้เลือก wav) · หลายแบบ: `hit_1`, `hit_2`, `hit_3` (เกมสุ่มเล่น)
   - Ambience → `desgin/SOUND/amb/<ชื่อ>.mp3`
3. รัน `node tools/build-audio.js` (เติม `--list` = ดูว่าเสียงไหนยังขาด) → รีโหลดเกม
4. เสียงไหนยังไม่มีไฟล์ เกมใช้เสียงเดิมให้อัตโนมัติ — ทำทีละชุดได้
5. ⚠ **License**: ใช้แพ็กเกจที่อนุญาตเชิงพาณิชย์ (แพ็กเกจฟรีของ Suno / Udio มักห้าม)

**กฎทอง SFX** — ต่อท้าย *ทุก* prompt ด้วยประโยคเดียวกันเสมอ เสียงจะฟังเป็นเกมเดียวกัน:
`, dark fantasy game sound effect, dry, punchy, short tail, no music, no voice`

**ช่อง "แบบ"** = ควรทำกี่ไฟล์ (เสียงที่ดังบ่อยต้องมีหลายแบบ ไม่งั้นฟังซ้ำซาก)

---

## 1. เพลง (9 เพลง)

ต่อท้ายทุก prompt: `, Hollow Knight style, instrumental, seamless loop, no intro, no fade-out ending`

| ไฟล์ | ใช้ที่ | ยาว | Prompt |
|---|---|---|---|
| `title` | หน้า Title | 2 นาที | `melancholic dark fantasy main theme, solo piano and soft string ensemble, distant wordless female choir, 70 bpm, minor key, a lonely eclipse over a ruined world` |
| `town` | Lumina · Asteria · Valehaven (ทุกเมือง) | 2-3 นาที | `gentle safe town theme, warm harp and acoustic guitar, soft flute and cello melody, calm but slightly wistful, 78 bpm, major key with minor colour` |
| `field_a` | A1 · A2 · A3 (Route A) | 3 นาที | `mysterious overgrown ancient lands exploration, pizzicato strings, soft woodwinds, sparse piano, gentle tension, 84 bpm, D minor` |
| `field_b` | B1 · B2 · B3 (Route B: หิมะ / ถ้ำคริสตัล / ภูเขา) | 3 นาที | `cold frozen wilderness exploration, solo violin over airy strings, celesta and glass shimmer, lonely and vast, 76 bpm, B minor` |
| `dungeon_dark` | ถ้ำลับ · Quiet Hollow · ลานบอสก่อนสู้ | 2 นาที | `ominous dark place, low cello drones, sparse single piano notes, distant heartbeat drum, eerie and still, 60 bpm` |
| `boss_common_p1` | มินิบอส + บอสธรรมดาทุกตัว (phase 1) | 2 นาที | `intense dark fantasy boss battle, driving string ostinato, taiko drums, choir stabs, 140 bpm, C minor` |
| `boss_common_p2` | บอสธรรมดา phase 2 ขึ้นไป | 2 นาที | **ใช้ Extend / Remix จาก p1** · `same theme, heavier: add brass, full choir, more percussion, same tempo and key` |
| `boss_final_p1` | Rune Knight · Crystal Warden · Varkharon (phase 1) | 2-3 นาที | `epic final boss battle, cathedral organ, deep male choir, virtuoso violin, war drums, 132 bpm, D minor, tragic and grand` |
| `boss_final_p2` | บอสใหญ่ phase 2 ขึ้นไป | 2-3 นาที | **ใช้ Extend / Remix จาก p1** · `same theme at its climax: full orchestra, dissonant choir, maximum intensity, same tempo and key` |

- **เพลงชนะ** ไม่ต้องทำ — ใช้ SFX `victory` (ข้อ 3)
- p2 ต้อง **tempo + คีย์เท่ากับ p1** เกมจะ crossfade 2.2 วินาทีให้กลืน
- ถ้าอยากให้บอสตัวไหนมีเพลงเองภายหลัง: บอกผม แล้ววางไฟล์ชื่อใหม่ได้เลย (ไม่ต้องแก้ระบบ)

## 2. Ambience (ไม่บังคับ, loop 20-30 วินาที)
| ไฟล์ | Prompt |
|---|---|
| `amb_village` | `quiet fantasy village ambience, distant birds, light wind, soft wooden creaks, seamless loop` |
| `amb_city` | `large medieval city ambience, distant crowd murmur, fountain water, far bell, seamless loop` |
| `amb_forest` | `mysterious forest ambience, rustling leaves, distant owl, insects, soft wind, seamless loop` |
| `amb_valley` | `open valley ambience, distant waterfall, river, gentle wind, seamless loop` |
| `amb_cave` | `dark cave ambience, water drips, low rumble, faint echo, seamless loop` |
| `amb_lava` | `volcanic cavern ambience, bubbling lava, crackling embers, deep rumble, seamless loop` |
| `amb_ruins` | `ancient stone ruins ambience, hollow wind through pillars, faint magical hum, seamless loop` |
| `amb_wind` | `cold snowy mountain wind, howling gusts, blowing snow, seamless loop` |

---

## 3. SFX — ครบทุกเสียงที่เกมใช้ (66 ชื่อ) เรียงตามลำดับที่ควรทำ

### ชุด 1 — ดังทุกวินาที (ทำก่อน แล้วเข้าเกมฟัง)
| ไฟล์ | แบบ | ยาว | ใช้ตอน | Prompt |
|---|---|---|---|---|
| `swing` | 3 | 0.3 s | ฟันธรรมดา | `quick sword whoosh swing` |
| `hit` | 3 | 0.2 s | โดนศัตรู | `blade hitting creature flesh, short impact` |
| `hurt` | 3 | 0.3 s | ผู้เล่นโดนตี | `hero takes a hit, dull thump impact` |
| `dodge` | 2 | 0.3 s | หลบ | `quick cloth dash whoosh` |
| `enemy_swing` | 3 | 0.3 s | ศัตรูฟาด | `monster claw swipe whoosh` |
| `kill` | 2 | 0.5 s | ศัตรูตาย | `creature defeated, soft dark dissolve whoosh` |
| `step` | 4 | 0.1 s | เดิน | `single soft footstep on dirt` |
| `ui` | 2 | 0.1 s | คลิกเมนู | `soft subtle interface click, wooden and clean` |
| `deny` | 1 | 0.2 s | ทำไม่ได้ / ขาดทรัพยากร | `soft muted interface error buzz` |

### ชุด 2 — ต่อสู้
| ไฟล์ | แบบ | ยาว | ใช้ตอน | Prompt |
|---|---|---|---|---|
| `swing_fast` | 2 | 0.2 s | ฟันเร็ว | `very fast light blade swish` |
| `slash_heavy` | 2 | 0.5 s | ฟันหนัก / ท่าจบคอมโบ | `heavy sword slash whoosh with metal ring` |
| `crit` | 2 | 0.4 s | คริติคอล | `powerful critical hit, sharp crack with bright metallic ring` |
| `dash` | 2 | 0.4 s | สกิลพุ่ง | `fast magical dash whoosh with air rush` |
| `blink` | 1 | 0.3 s | วาร์ป / หายตัว | `quick magical teleport blink, airy shimmer` |
| `perfect` | 1 | 0.8 s | Perfect Dodge | `time slows, shimmering chime with reverse whoosh` |
| `block` | 2 | 0.3 s | กันด้วยโล่ | `shield blocks sword, solid metal clang` |
| `perfect_guard` | 1 | 0.6 s | Parry | `perfect parry, bright ringing metal clash with sparkle` |
| `counter` | 1 | 0.4 s | ตีสวน | `fast counter strike, sharp slash with impact` |
| `taunt` | 1 | 0.6 s | ยั่วศัตรู | `knight war shout replaced by a deep rising horn-like magic pulse` |
| `cast` | 2 | 0.5 s | ร่ายเวท | `soft arcane spell cast, magical shimmer` |
| `shoot` | 2 | 0.3 s | ยิงกระสุนเวท | `magic projectile launched, quick energy whoosh` |
| `boom_small` | 2 | 0.5 s | ระเบิดเล็ก | `small magical explosion, short boom` |
| `arc` | 1 | 0.5 s | ฟันวงกว้าง | `wide sweeping blade arc, long whoosh` |
| `chain` | 1 | 0.5 s | โซ่ / ดึงศัตรู | `heavy metal chain whips and pulls, rattling` |
| `fire` | 2 | 0.5 s | ไฟ / ลูกไฟ | `fire burst whoosh, crackling flame` |
| `potion` | 1 | 0.6 s | ดื่มยา | `drinking potion, glass gulp with soft healing chime` |
| `death` | 1 | 2 s | ผู้เล่นตาย | `hero falls, heavy body thud then fading low tone` |

### ชุด 3 — ศัตรู / บอส
| ไฟล์ | แบบ | ยาว | ใช้ตอน | Prompt |
|---|---|---|---|---|
| `windup` | 2 | 0.3 s | ศัตรูตั้งท่า | `enemy prepares attack, short rising tension tone` |
| `windup_big` | 1 | 0.6 s | ตั้งท่าหนัก | `big enemy prepares heavy attack, deep ominous rising tone` |
| `claw` | 2 | 0.4 s | ข่วน | `beast claw slash, tearing whoosh` |
| `slam` | 2 | 0.6 s | ทุบพื้น | `heavy ground slam, deep thud with rubble` |
| `slam_big` | 2 | 1 s | บอสทุบพื้น | `giant boss slams the ground, huge earth-shaking boom` |
| `charge` | 1 | 0.8 s | ศัตรูพุ่งชาร์จ | `heavy beast charging, thundering rush` |
| `dash_enemy` | 1 | 0.4 s | ศัตรูพุ่ง | `creature lunges forward, fast whoosh` |
| `crash` | 1 | 1 s | ชนกำแพง / ตกกระแทก | `huge body crashes into stone, heavy impact and debris` |
| `quake` | 1 | 1.2 s | แผ่นดินไหว | `ground quake rumble, cracking earth` |
| `roar` | 2 | 2 s | บอสคำราม | `huge monster roar, deep and terrifying` |
| `roar_small` | 2 | 0.8 s | มอนสเตอร์คำรามเล็ก | `small beast growl roar` |
| `roots` | 1 | 0.9 s | รากไม้ / หนาม | `roots burst from the ground, wood creak and snap` |
| `shatter` | 2 | 0.5 s | คริสตัล / น้ำแข็งแตก | `crystal shatters, bright glass break` |
| `weak` | 1 | 0.6 s | บอสเปิดจุดอ่อน | `boss stunned, glass crack chime, opportunity sound` |
| `discover_boss` | 1 | 2 s | เจอบอส | `ominous discovery sting, low brass swell with dark choir` |
| `victory` | 1 | 6 s | ชนะบอส | `bittersweet triumphant fanfare, strings and soft brass, choir swell, resolves warmly` |

### ชุด 4 — สกิลพิเศษ / Ultimate
| ไฟล์ | แบบ | ยาว | ใช้ตอน | Prompt |
|---|---|---|---|---|
| `mark` | 2 | 0.2 s | ติด Mark | `small dark magic tick, shadow ping` |
| `mark_full` | 1 | 0.5 s | Mark เต็ม | `dark energy fully charged, rising shadow chime` |
| `break_charge` | 1 | 0.4 s | เตรียม Shadow Break | `dark energy gathers, quick rising hum` |
| `break` | 1 | 1.2 s | Shadow Break | `massive shadow explosion, deep boom with glass shatter tail` |
| `ult_charge` | 1 | 1 s | ชาร์จ Ultimate | `power charging up, rising rumble and energy hum` |
| `ult_slash` | 1 | 1.5 s | Ultimate ปล่อย | `enormous epic slash, deep boom, wide whoosh, ringing tail` |
| `star` | 2 | 0.3 s | ดาว (Astral) | `small star twinkle hit, bright celestial ping` |
| `thread` | 2 | 0.4 s | เส้นด้ายดาว | `magical thread stretches, glassy sine shimmer` |
| `thread_burst` | 1 | 0.6 s | เส้นด้ายระเบิด | `magical threads snap and burst, sparkling crack` |
| `constellation` | 1 | 1 s | กลุ่มดาว | `constellation forms, rising celestial chimes` |

### ชุด 5 — โลก / UI / รางวัล
| ไฟล์ | แบบ | ยาว | ใช้ตอน | Prompt |
|---|---|---|---|---|
| `levelup` | 1 | 2 s | เลเวลอัป | `level up, ascending warm magical chime with soft choir` |
| `quest` | 1 | 0.8 s | รับเควส | `quest accepted, parchment rustle and gentle chime` |
| `quest_done` | 1 | 1.5 s | เควสสำเร็จ | `quest complete, satisfying warm chime sequence` |
| `chest` | 1 | 0.8 s | เปิดหีบ | `wooden chest opening, creak and small sparkle` |
| `chest_rare` | 1 | 1.5 s | หีบหายาก | `rare treasure chest, creak then brilliant magical sparkle` |
| `equip` | 2 | 0.3 s | ใส่ของ | `equipping armor, short leather and metal clink` |
| `gather` | 2 | 0.3 s | เก็บของ | `pick up item, soft pluck with tiny chime` |
| `secret` | 1 | 2 s | เจอความลับ | `secret discovered, mysterious magical shimmer arpeggio` |
| `lore` | 1 | 1 s | อ่านจารึก | `ancient tablet read, soft mystical tone with stone resonance` |
| `waystone` | 1 | 1.5 s | Waystone | `ancient stone activates, resonant hum and chime` |
| `shrine` | 1 | 1.5 s | ศาลเจ้า / กลไกโบราณ | `ancient shrine awakens, deep resonant tone with soft light hum` |
| `gate` | 1 | 1.5 s | ประตูเปิด | `heavy stone gate opens, grinding rumble` |
| `rubble` | 1 | 0.6 s | หินพัง | `rocks crumble, small debris fall` |
| `timber` | 1 | 1.2 s | ต้นไม้ล้ม | `tree cracks and falls, heavy thud` |

---
**รวม:** 66 ชื่อ ≈ 95 ไฟล์ (นับแบบ) · ชุดถัดไป (ภายหลัง): เสียงเฉพาะ 12 คลาส · มอนสเตอร์ / บอสแต่ละตัว · ก้าวเท้าตามพื้น
