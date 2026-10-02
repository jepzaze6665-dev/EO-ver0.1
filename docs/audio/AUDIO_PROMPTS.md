# ECLIPSE ONLINE — ชุด Prompt เสียง (ชุดที่ 1: เพลง + Ambience + SFX Combat/UI)

แนวทางเสียงทั้งเกม: **แนว Hollow Knight** — เบาบาง เศร้า มีช่องว่าง เครื่องดนตรีจริง (เปียโน, เชลโล, ไวโอลิน,
ฮาร์ป, คอรัสเบา ๆ) · SFX แห้ง คม สั้น ไม่มี reverb ยาว (ยกเว้นเสียงใหญ่: ult / บอส)

## วิธีใช้ (ทำตามนี้ทุกครั้ง)
1. คัดลอก prompt ภาษาอังกฤษไปสั่ง AI (เพลง = **Suno / Udio** เลือก *Instrumental* · SFX + Ambience = **ElevenLabs Sound Effects**)
2. สั่งหลายครั้ง เลือกอันที่ดีที่สุด → **ตั้งชื่อไฟล์ตามตาราง** (ตัวพิมพ์เล็ก) แล้ววางในโฟลเดอร์:
   - เพลง → `desgin/SOUND/music/<ชื่อ>.mp3`
   - Ambience → `desgin/SOUND/amb/<ชื่อ>.mp3`
   - SFX → `desgin/SOUND/sfx/<ชื่อ>.mp3` · มีหลายแบบได้: `hit_1.mp3`, `hit_2.mp3`, `hit_3.mp3` (เกมสุ่มเล่น)
3. รัน `node tools/build-audio.js` (หรือ `--list` ดูว่าเสียงไหนยังไม่มีไฟล์) → รีโหลดเกม เสียงใหม่ใช้ทันที
4. เสียงไหนยังไม่มีไฟล์ = เกมใช้เสียงเดิม (เสียงสังเคราะห์) อัตโนมัติ — ทำทีละนิดได้
5. ⚠ **License**: ใช้แพ็กเกจที่อนุญาตเชิงพาณิชย์ (แพ็กเกจฟรีของ Suno / Udio มักห้าม)

**เคล็ดลับเพลง loop**: ใส่ในทุก prompt เพลงว่า `seamless loop, no intro, no fade-out ending` ถ้ายังมีหัว/ท้าย
ผมทำจุด loop ให้ได้ (`desgin/SOUND/loops.json` = `{ "music/lumina.mp3": [วินาทีเริ่ม, วินาทีจบ] }`)

**เพลงบอสหลาย phase**: สร้าง phase 1 ก่อน แล้วใช้ **Extend / Remix / Cover** ของเพลงเดิมทำ phase 2, 3, 4
(**tempo + คีย์ต้องเท่ากัน** เกมจะ crossfade 2.2 วินาทีให้กลืนกัน) แต่ละ phase = หนักขึ้น เร็วขึ้นไม่ได้ แต่ใส่เครื่องเพิ่ม

---

## 1. เพลงเมือง / แผนที่ (13 เพลง, ยาว 2-3 นาที)

| ไฟล์ | ใช้ที่ | Prompt |
|---|---|---|
| `title` | หน้า Title | `melancholic dark fantasy main theme, solo piano and soft string ensemble, distant wordless female choir, slow 70 bpm, minor key, a lonely eclipse over a ruined world, Hollow Knight style, instrumental, seamless loop` |
| `lumina` | Lumina Village (เมืองเริ่มต้น) | `gentle village theme, warm acoustic guitar and harp, soft flute melody, quiet and safe but slightly wistful, 80 bpm, D major with minor colour, Hollow Knight Dirtmouth mood, instrumental, seamless loop, no intro, no ending` |
| `asteria` | Asteria City (เมือง 2) | `grand but lonely royal city theme, cello and violin duet, soft brass swells, harp arpeggios, noble and melancholic, 76 bpm, Hollow Knight City of Tears mood without rain, instrumental, seamless loop` |
| `valehaven` | Valehaven (เมืองลับ) | `hidden peaceful valley sanctuary, music box and soft strings, light choir pad, dreamy and fragile, 66 bpm, instrumental, seamless loop` |
| `whispering_forest` | A1 Whispering Forest | `mysterious overgrown forest exploration, plucked strings pizzicato, soft woodwinds, sparse piano notes, gentle tension, 84 bpm, Hollow Knight Greenpath mood, instrumental, seamless loop` |
| `hidden_cave` | ถ้ำลับ A1 | `dark quiet cave, deep cello drones, single piano notes with space, water drip like percussion, eerie and calm, 60 bpm, instrumental, seamless loop` |
| `ancient_valley` | A2 Ancient Valley | `ancient fallen kingdom terraces, solemn strings, ethnic flute, low choir, waterfalls and ruins, nostalgic and vast, 72 bpm, instrumental, seamless loop` |
| `quiet_hollow` | Quiet Hollow (รังมังกร) | `ominous ash cave before a sealed dragon, low cello drones, distant timpani heartbeat, faint dissonant choir, smouldering dread, 58 bpm, instrumental, seamless loop` |
| `rune_citadel` | A3 Rune Citadel | `ruined white stone citadel with glowing runes, haunting violin solo, bell-like celesta, soft organ pad, sorrowful and majestic, 70 bpm, instrumental, seamless loop` |
| `frostwind` | B1 Frostwind Plains | `cold empty snowfield, solo violin over airy string pad, glass harmonica, wind-like textures, lonely, 74 bpm, instrumental, seamless loop` |
| `crystal_caverns` | B2 Crystal Caverns | `glittering crystal cavern, celesta and harp shimmer, low cello pulse, mysterious and beautiful, 78 bpm, Hollow Knight Crystal Peak mood, instrumental, seamless loop` |
| `frostpeak` | B3 Frostpeak | `harsh frozen mountain climb, determined cello ostinato, sparse snare, high strings, cold wind, rising tension, 88 bpm, instrumental, seamless loop` |
| `boss_arena_calm` | ลานบอส (ก่อนสู้) | `the silence before a boss, low string drone, very sparse piano, a distant heartbeat drum, unease, 60 bpm, instrumental, seamless loop` |
| `victory` | ชนะบอส / จบ route | `short triumphant but bittersweet fanfare, strings and soft brass, choir swell, resolves warmly, 20 seconds, instrumental` |

## 2. เพลงบอส (แยก phase — คีย์ / tempo เดิมในบอสเดียวกัน)

ทุก prompt เติมท้ายด้วย: `, Hollow Knight boss fight style, instrumental, seamless loop, no intro, no ending`

| ไฟล์ | บอส | Prompt |
|---|---|---|
| `boss_common` | สำรอง (บอสที่ยังไม่มีเพลงเอง) | `intense dark fantasy boss battle, driving strings ostinato, taiko drums, choir stabs, 140 bpm, C minor` |
| `boss_mini_p1` / `_p2` | มินิบอสทุกตัว | p1 `fast aggressive strings and percussion duel, 135 bpm, D minor` · p2 = Extend: `same theme, heavier, add brass and choir` |
| `boss_guardian_p1` · `_p2` · `_p3` | Guardian of the Forest (A1) | p1 `ancient forest guardian awakens, epic cello and violin, tribal drums, wooden percussion, 128 bpm, E minor` · p2 `+ choir and brass, more urgent` · p3 `corrupted, dissonant choir, full orchestra climax` |
| `boss_magma_beast_p1` · `_p2` | Magma Beast (A2) | p1 `molten lava beast, heavy low brass, pounding taiko, aggressive strings, 132 bpm, F minor` · p2 `molten fury: faster feel, distorted low strings, roaring choir` |
| `boss_rune_knight_p1` · `_p2` · `_p3` | Rune Knight (A3 Major) | p1 `noble fallen knight duel, virtuoso violin, harpsichord, marching drums, 144 bpm, A minor` · p2 `+ organ and runic choir` · p3 `tragic climax, full choir, cathedral organ, all strings` |
| `boss_hoarfang_p1` · `_p2` | Hoarfang (B1) | p1 `winter alpha wolf hunt, fast staccato strings, war drums, howling horn, 138 bpm, B minor` · p2 `whiteout: icy high strings, choir, blizzard intensity` |
| `boss_colossus_p1` · `_p2` | Amethyst Colossus (B2) | p1 `giant crystal golem, heavy slow brass, celesta and glass percussion, 120 bpm, G minor` · p2 `resonance: shimmering crystal choir, pounding drums` |
| `boss_crystal_warden_p1` … `_p4` | Crystal Warden (B3 Major, 4 phase) | p1 `dormant ice warden, cold string drone building, 130 bpm, C# minor` · p2 `awakened: strings ostinato + drums` · p3 `corrupted: dissonant choir, distorted strings` · p4 `enraged: full orchestra, choir, maximum intensity` |
| `boss_varkharon_p1` … `_p4` | Varkharon (บอสลับ, 4 phase) | p1 `sealed ancient dragon king, ominous organ, deep male choir, war drums, 126 bpm, D minor` · p2 `awakened flame: brass fanfares, fiery strings` · p3 `abyssal corruption: dissonant choir, low drones, chaos` · p4 `cinder king's wrath: everything, epic final battle, cathedral organ and full choir` |

ถ้ายังทำไม่ครบทุก phase: เกมเล่น phase ที่มีอันล่าสุดต่อไป (เช่นมีแค่ `_p1` = ทั้งไฟต์ใช้ p1)

## 3. Ambience (loop 20-30 วินาที, ElevenLabs)
| ไฟล์ | Prompt |
|---|---|
| `amb_village` | `quiet fantasy village ambience, distant birds, light wind, soft wooden creaks, faint far-away chatter, seamless loop` |
| `amb_city` | `large medieval city ambience, distant crowd murmur, footsteps on stone, fountain water, bell far away, seamless loop` |
| `amb_forest` | `mysterious forest ambience, rustling leaves, distant owl, insects, soft wind, seamless loop` |
| `amb_valley` | `open valley ambience, distant waterfall, river, gentle wind, birds, seamless loop` |
| `amb_cave` | `dark cave ambience, water drips, low rumble, faint echo, seamless loop` |
| `amb_lava` | `volcanic cavern ambience, bubbling lava, crackling embers, deep rumble, seamless loop` |
| `amb_ruins` | `ancient stone ruins ambience, hollow wind through pillars, faint magical hum, seamless loop` |
| `amb_wind` | `cold snowy mountain wind ambience, howling gusts, blowing snow, seamless loop` |

## 4. SFX ชุดที่ 1 — Combat + UI (ElevenLabs, ทำ 2-3 แบบต่อชื่อถ้าเป็นเสียงที่ดังบ่อย)
ทุก prompt เติมท้าย: `, game sound effect, dry, punchy, no music`

| ไฟล์ | ใช้ตอน | ยาว | Prompt |
|---|---|---|---|
| `swing` (×3) | ฟันธรรมดา | 0.3 s | `quick sword whoosh swing` |
| `swing_fast` (×2) | ฟันเร็ว | 0.2 s | `very fast light blade swish` |
| `slash_heavy` (×2) | ฟันหนัก | 0.5 s | `heavy sword slash whoosh with metal ring` |
| `hit` (×3) | โดนศัตรู | 0.2 s | `blade hitting creature flesh, short impact` |
| `crit` (×2) | คริติคอล | 0.4 s | `powerful critical hit impact, sharp crack with bright metallic ring` |
| `kill` (×2) | ศัตรูตาย | 0.5 s | `creature defeated, soft dark dissolve whoosh` |
| `hurt` (×3) | ผู้เล่นโดน | 0.3 s | `player gets hit, dull thump with short grunt-less impact` |
| `death` | ผู้เล่นตาย | 2 s | `hero falls, heavy body thud then fading low tone` |
| `dodge` (×2) | หลบ | 0.3 s | `quick cloth dash whoosh` |
| `dash` | พุ่ง (สกิล) | 0.4 s | `fast magical dash whoosh with air rush` |
| `perfect` | Perfect Dodge | 0.8 s | `time slows down, shimmering magical chime with reverse whoosh` |
| `block` (×2) | Guard กัน | 0.3 s | `shield blocking sword, solid metal clang` |
| `perfect_guard` | Parry | 0.6 s | `perfect parry, bright ringing metal clash with sparkle` |
| `counter` | Counter hit | 0.4 s | `fast counter strike, sharp slash with impact` |
| `mark` | ติด Mark | 0.2 s | `small dark magic tick, shadow ping` |
| `mark_full` | Mark เต็ม | 0.5 s | `dark energy fully charged, rising shadow chime` |
| `break` | Shadow Break | 1.2 s | `massive shadow explosion, deep boom with glass shatter tail` |
| `ult_charge` | ชาร์จ Ultimate | 1 s | `magic power charging up, rising rumble and energy hum` |
| `ult_slash` | Ultimate ปล่อย | 1.5 s | `enormous epic slash, deep boom, wide whoosh, magical ringing tail` |
| `cast` (×2) | ร่ายเวท | 0.5 s | `soft arcane spell cast, magical shimmer` |
| `shoot` (×2) | ยิงกระสุน | 0.3 s | `magic projectile launched, quick energy whoosh` |
| `boom_small` (×2) | ระเบิดเล็ก | 0.5 s | `small magical explosion, short boom` |
| `windup` | ศัตรูตั้งท่า | 0.3 s | `enemy preparing attack, short rising tension tone` |
| `windup_big` | ศัตรูตั้งท่าหนัก | 0.6 s | `big enemy preparing heavy attack, deep ominous rising growl-like tone` |
| `enemy_swing` (×2) | ศัตรูฟาด | 0.3 s | `monster claw swipe whoosh` |
| `slam` (×2) | ทุบพื้น | 0.6 s | `heavy ground slam, deep thud with rubble` |
| `slam_big` | บอสทุบพื้น | 1 s | `giant boss slams the ground, huge earth-shaking boom` |
| `roar` | บอสคำราม | 2 s | `huge monster roar, deep and terrifying` |
| `weak` | บอสเปิดจุดอ่อน | 0.6 s | `boss stunned, glass crack chime, opportunity sound` |
| `potion` | ดื่มยา | 0.6 s | `drinking a potion, glass gulp with soft healing chime` |
| `levelup` | เลเวลอัป | 2 s | `level up, ascending warm magical chime with soft choir` |
| `quest` | รับเควส | 0.8 s | `quest accepted, soft parchment and gentle chime` |
| `quest_done` | เควสเสร็จ | 1.5 s | `quest complete, satisfying warm chime sequence` |
| `chest` | เปิดหีบ | 0.8 s | `wooden chest opening, creak and small sparkle` |
| `chest_rare` | หีบหายาก | 1.5 s | `rare treasure chest, creak then brilliant magical sparkle` |
| `equip` | ใส่ของ | 0.3 s | `equipping armor, short leather and metal clink` |
| `ui` (×2) | คลิก UI | 0.1 s | `soft subtle UI click, wooden and clean` |
| `deny` | ทำไม่ได้ | 0.2 s | `soft UI error buzz, muted` |
| `waystone` | Waystone | 1.5 s | `ancient stone activates, magical resonant hum and chime` |
| `secret` | เจอความลับ | 2 s | `secret discovered, mysterious magical shimmer arpeggio` |

---
**ชุดถัดไป (ทำทีหลัง):** เสียงเฉพาะ 12 คลาส (A4) · เสียงมอนสเตอร์ / บอสแต่ละตัว (A5) · เสียงก้าวเท้าตามพื้น (A6)
