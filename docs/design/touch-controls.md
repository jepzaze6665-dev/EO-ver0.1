# TOUCH CONTROLS — ระบบควบคุมมือถือสำหรับ ECLIPSE ONLINE

## สรุปแนวคิด

เกม ECLIPSE ONLINE รันในเบราว์เซอร์ HTML5 Canvas ได้บนมือถือทุกระบบปฏิบัติการ (iOS Safari, Android Chrome) โดยไม่ต้องแปลงเป็นแอป native ระบบ touch controls นี้เป็น **presentation layer** เท่านั้น — ไม่แก้ core game logic แต่สร้าง input abstraction ที่แปลง touch events ให้เป็น game actions เดียวกับคีย์บอร์ด/เมาส์

เป้าหมาย: ผู้เล่นบนมือถือเล่นได้สบาย ไม่ต้องต่อคีย์บอร์ดภายนอก และ UI อ่านง่ายบนจอขนาดเล็ก

---

## 1. Virtual Joystick (ซ้ายหน้าจอ)

### ตำแหน่งและขนาด
- **Dynamic origin** — จุดเริ่ม joystick อยู่ที่ตำแหน่งที่นิ้วสัมผัสครั้งแรกบนครึ่งซ้ายของจอ (ไม่ใช่จุดตายตัว) เพื่อรองรับท่าจับมือถือที่แตกต่างกัน
- **ขนางฐาน** 120 px (ปรับตามขนาดจอ: `clamp(100, min(w,h) * 0.18, 160)`)
- **ขนาง knob** 50 px
- **รัศมีการตอบสนอง** 60 px จากศูนย์กลางฐาน

### พฤติกรรม
- ลากนิ้วออกจากฐานเกินรัศมี → knob ติดขอบฐาน และค่า direction vector เป็น unit vector
- ปล่อยนิ้ว → knob ค่อย ๆ กลับศูนย์กลาง (lerp 0.2) และค่าเป็น 0
- **Dead zone** 15% ของรัศมี — นิ้วสั่นเล็กน้อยไม่ทำให้ตัวละครเดิน
- แสดงผลเป็น semi-transparent circle (ฐาน) + solid circle (knob) บน canvas layer เดียวกับ HUD
- รองรับ **multi-touch** — ข้ามกับปุ่มสกิลขวามือได้ (ใช้ `touch.identifier` แยกแต่ละนิ้ว)

### การเชื่อมต่อกับเกม
- สร้าง `TouchJoystick` class ใน `src/input/touchJoystick.js`
- อ่านค่า vector ผ่าน `game.input.joystick = { x, y, active }` ทุก frame
- `Player.update` อ่าน `game.input.joystick` แทนการอ่านคีย์บอร์ดโดยตรง (ถ้า joystick active)
- ผู้เล่นบน PC ใช้คีย์บอร์ดเหมือนเดิม — joystick ไม่แสดงบนหน้าจอ

---

## 2. Skill Buttons (ขวาหน้าจอ)

### Layout
- ปุ่มสกิล 1-5 เรียงแนวนอน 5 ปุ่ม ขนาง 56×56 px (ปรับตามจอ: `clamp(48, min(w,h) * 0.09, 72)`)
- ปุ่ม Q (special) และ E (interact) อยู่ด้านบนสุดของแถวสกิล
- ปุ่ม 5 (ultimate) ใหญ่กว่าปุ่มอื่น 1.3 เท่า และมี glow effect เมื่อพร้อมใช้
- ตำแหน่ง: ขอบขวาล่างของจอ เว้นระยะจากขอบ 16 px (safe area)

### พฤติกรรม
- แตะครั้งเดียว = cast skill (ไม่มี hold)
- แตะค้าง = ไม่มีผล (ไม่มี hold mechanic ในเกมนี้)
- แสดง cooldown overlay (dark + ตัวเลขวินาที) เหมือน skill bar บน PC
- แสดง stamina cost เป็นสีแดงถ้าไม่พอ
- แสดง skill icon จาก `Assets.itemIcons` หรือ `skillIconURL(skill)`
- รองรับ multi-touch — กดสกิลหลายปุ่มพร้อมกันได้ (ถ้าเกม logic อนุญาต)

### การเชื่อมต่อ
- สร้าง `TouchSkillBar` class ใน `src/input/touchSkillBar.js`
- แต่ละปุ่มมี `data-skill` attribute = skill id
- เมื่อแตะ → เรียก `game.player.trySkill(skillId)` หรือ `game.player.castSkill(skillId)` (ตาม API ที่มีอยู่)
- อัปเดต cooldown/stamina ทุก frame จาก `game.player.skillSys`

---

## 3. Dodge และ Guard Buttons

### Dodge Button
- ตำแหน่ง: มุมขวาล่าง เหนือปุ่มสกิลเล็กน้อย
- ขนาง 64 px วงกลม
- แตะ = `game.player.tryDodge()` (หรือ input action ที่ตรงกัน)
- แสดง stamina cost (22) เป็นสีแดงถ้าไม่พอ
- มี cooldown สั้น ๆ (0.3 s) ป้องกับการแตะซ้ำ

### Guard Button (เฉพาะ Aegis line)
- แตะครั้งแรก = raise guard
- แตะครั้งที่สอง = lower guard
- หรือใช้ **toggle** แทน hold (เลือกได้ใน settings)
- แสดงสถานะ guard เป็นสีทองอ่อนบนปุ่ม

---

## 4. Responsive UI

### HUD Scaling
- ใช้ CSS `clamp()` สำหรับ font size ทั้งหมดใน HUD
- HP/STA/EXP bar ปรับความยาวตามขนาดจอ (`min(100%, 300px)`)
- Skill bar บน PC ซ่อนเมื่อเปิด touch mode (แสดงแทนด้วย touch buttons)
- Quest tracker และ route panel ย่อเป็น compact mode บนจอเล็ก

### Safe Areas
- รองรับ `env(safe-area-inset-*)` สำหรับ iPhone notch และ Android gesture bar
- ปุ่มทั้งหมดอยู่ใน safe area เสมอ

### Orientation
- รองรับทั้ง **portrait** และ **landscape**
- Portrait: joystick ซ้ายล่าง, skill bar ขวาล่าง (เหมือน landscape แต่แคบกว่า)
- Landscape: ตาม layout ปกติ
- ไม่บังคับ orientation — เล่นได้ทั้งสองแบบ

---

## 5. Performance

### Canvas Resolution
- ลด canvas resolution บนมือถือ: `canvas.width = screen.width * 0.75` (หรือใช้ `devicePixelRatio` แค่ 1.5 แทน 2-3)
- ปรับ particle count ให้น้อยลง 30% บนมือถือ
- ปรับ shadow quality เป็นต่ำกว่าบนมือถือ

### Touch Event Optimization
- ใช้ `{ passive: false }` สำหรับ touchstart/touchmove เพื่อ prevent scroll
- ใช้ `requestAnimationFrame` สำหรับ joystick smoothing (ไม่ใช้ CSS transition)
- ปิด context menu บน canvas (`contextmenu` event preventDefault)

---

## 6. Settings และ Accessibility

### Touch Settings (ใน ESC menu → Settings)
- **Touch Mode**: Auto / On / Off
  - Auto: ตรวจจับ touch device อัตโนมัติ
  - On: บังคับใช้ touch controls แม้บน PC
  - Off: ปิด touch controls (ใช้คีย์บอร์ด)
- **Joystick Size**: Small / Medium / Large
- **Button Size**: Small / Medium / Large
- **Vibration**: On / Off (ใช้ `navigator.vibrate()` เมื่อโดนตีหรือ cast skill)
- **Invert Y**: On / Off (สำหรับ joystick)

### Haptics
- เมื่อโดนตี: `navigator.vibrate(50)`
- เมื่อ cast ultimate: `navigator.vibrate([50, 50, 50])`
- เมื่อ perfect dodge: `navigator.vibrate(30)`

---

## 7. Data Files to Add / Change

### ไฟล์ใหม่
- `src/input/touchJoystick.js` — Virtual joystick class
- `src/input/touchSkillBar.js` — Skill buttons class
- `src/input/touchControls.js` — Main touch controller (รวม joystick + buttons + settings)
- `src/ui/touchHUD.js` — Touch-specific HUD rendering (joystick graphics, button overlays)

### ไฟล์ที่ต้องแก้
- `src/input/input.js` (หรือไฟล์ input หลัก) — เพิ่ม touch event listeners
- `src/ui/hud.js` — ซ่อน skill bar เมื่อ touch mode on, แสดง touch buttons แทน
- `src/ui/theme.css` — เพิ่ม CSS สำหรับ touch buttons (responsive sizing)
- `index.html` — เพิ่ม `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">`
- `src/main.js` — ตรวจจับ touch device และเปิด touch mode อัตโนมัติ

### Architecture Rules
- Touch controls เป็น **presentation layer** เท่านั้น — ไม่แก้ core game logic
- ทุก touch action ต้อง map กับ game action เดียวกับคีย์บอร์ด (เช่น joystick = WASD, skill button = key 1-5)
- รองรับ **simultaneous** keyboard + touch (ผู้เล่นอาจใช้คีย์บอร์ดภายนอกกับจอสัมผัส)

---

## 8. Tests

### Unit Tests
- `tools/tests/touchControls.test.mjs`
  - Joystick vector calculation (dead zone, max radius, direction)
  - Skill button → skill cast mapping
  - Multi-touch tracking (joystick + skill button simultaneously)
  - Settings persistence (localStorage)

### In-game Tests
- `T.touchCheck(g)` — เปิด touch mode และตรวจสอบ:
  - Joystick แสดงผลบนหน้าจอ
  - ลาก joystick → ตัวละครเดิน
  - แตะ skill button → cast skill
  - แตะ dodge button → dodge
  - แตะ guard button → guard (Aegis)
  - UI ไม่ overlap กัน
  - ไม่มี console errors

### Manual Tests (บนมือถือจริง)
- เปิดเกมบน iPhone Safari และ Android Chrome
- เดิน, สกิล, dodge, guard ทั้งหมดทำงาน
- ไม่มี scroll/zoom ขณะเล่น
- ปุ่มไม่ overlap กันหรืออยู่นอกจอ
- เล่นได้สบาย ไม่ต้องยืดนิ้ว

---

## 9. Balance Notes

- มือถืออาจยากกว่า PC ในการ dodge timing — พิจารณาเพิ่ม perfect dodge window เล็กน้อย (เช่น 0.2 → 0.25 s) เฉพาะบนมือถือ
- ปุ่มสกิลอาจกดผิดง่ายกว่าคีย์บอร์ด — เพิ่ม confirmation สำหรับ ultimate (แตะครั้งแรก = highlight, แตะครั้งที่สอง = cast)
- ไม่ต้องปรับ game balance อื่น ๆ — touch controls เป็น input method เท่านั้น

---

## 10. Future Considerations

- **Controller support** — รองรับ Bluetooth game controller (Android) ผ่าน Gamepad API
- **Custom layout** — ผู้เล่นลากปุ่มไปวางตำแหน่งเองได้
- **Gesture shortcuts** — ปัดนิ้วเพื่อ dodge, แตะคู่เพื่อ ultimate
- **Tablet optimization** — layout พิเศษสำหรับ iPad (จอใหญ่กว่ามือถือ แต่ยังใช้ touch)

---

## สรุป

ระบบ touch controls นี้เป็น **input abstraction layer** ที่ทำให้เกมเล่นได้บนมือถือโดยไม่แก้ core game logic โดยมี virtual joystick ซ้ายหน้าจอ, ปุ่มสกิลขวาหน้าจอ, รองรับ multi-touch, responsive UI, และ performance optimization สำหรับมือถือ

เมื่อ approve แล้วให้ส่งไฟล์นี้ให้ Claude Code implement ตาม spec ได้เลยครับ
