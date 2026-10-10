// Thai for class role pieces ("Melee DPS · Assassin"), skill tags (skill card) and the generic skill-level ladder lines (T5).
export const TH_TAGS = {
  // roles (class `role` is split on " · " by tx)
  'Melee DPS': 'DPS ระยะประชิด', 'Assassin': 'นักฆ่า', 'Ranged Magic': 'เวทระยะไกล', 'Control': 'ควบคุม', 'Tank': 'แทงก์',
  'Protector': 'ผู้ปกป้อง', 'Crowd Control': 'ควบคุมฝูงชน', 'AoE DPS': 'DPS วงกว้าง', 'Execute': 'ปลิดชีพ', 'Mobility DPS': 'DPS คล่องตัว',
  'Single-Target Assassin': 'นักฆ่าเป้าเดี่ยว', 'Combo': 'คอมโบ', 'Duelist': 'นักดวล', 'Counter DPS': 'DPS สวนกลับ', 'Boss Specialist': 'ผู้เชี่ยวชาญการล้มบอส',
  'Support Tank': 'แทงก์สนับสนุน', 'Barrier Tank': 'แทงก์บาเรีย', 'Party Protector': 'ผู้ปกป้องปาร์ตี้', 'Main Tank': 'แทงก์หลัก',
  'Damage Mitigation': 'ลดดาเมจ', 'Frontline Tank': 'แทงก์แนวหน้า', 'Counter Tank': 'แทงก์สวนกลับ', 'Aggro DPS': 'DPS ดึงความสนใจ',
  'Bruiser Tank': 'แทงก์สายบู๊', 'Ranged DPS': 'DPS ระยะไกล', 'AoE': 'วงกว้าง', 'Control Mage': 'เมจควบคุม', 'Debuff': 'ดีบัฟ',
  'Summoner': 'ผู้อัญเชิญ', 'Support Mage': 'เมจสนับสนุน', 'Healer': 'ฮีลเลอร์', 'Barrier': 'บาเรีย', 'Purifier': 'ผู้ชำระล้าง',
  // skill tags
  melee: 'ประชิด', shadow: 'เงา', mark: 'ตีตรา', 'multi-hit': 'หลายครั้ง', dash: 'พุ่ง', mobility: 'เคลื่อนที่', invulnerable: 'อมตะ',
  aoe: 'วงกว้าง', stealth: 'ซ่อนตัว', utility: 'เสริม', ranged: 'ระยะไกล', pierce: 'ทะลุ', burst: 'ระเบิดพลัง', 'consumes-marks': 'ใช้รอย',
  magic: 'เวท', thread: 'เส้นด้าย', control: 'ควบคุม', 'consumes-threads': 'ใช้เส้นด้าย', ultimate: 'อัลติเมท', defense: 'ป้องกัน',
  shield: 'โล่', stun: 'มึนงง', holy: 'ศักดิ์สิทธิ์', taunt: 'ยั่วยุ', barrier: 'บาเรีย', support: 'สนับสนุน', guard: 'การ์ด', block: 'บล็อก',
  hold: 'กดค้าง', summon: 'อัญเชิญ', clone: 'ร่างแยก', zone: 'เขตพลัง', execute: 'ปลิดชีพ', teleport: 'วาร์ป', momentum: 'แรงส่ง',
  combo: 'คอมโบ', recast: 'กดซ้ำ', afterimage: 'ภาพติดตา', buff: 'บัฟ', speed: 'ความเร็ว', echo: 'เสียงสะท้อน', recordable: 'บันทึกได้',
  rewind: 'ย้อนกลับ', heal: 'รักษา', replay: 'เล่นซ้ำ', memory: 'ความทรงจำ', conditional: 'มีเงื่อนไข', counter: 'สวนกลับ', ally: 'พันธมิตร',
  link: 'เชื่อม', 'damage-reduction': 'ลดดาเมจ', resource: 'ทรัพยากร', 'knockback-immune': 'กันกระเด็น', resist: 'ต้านทาน',
  movement: 'เคลื่อนที่', pushback: 'ผลักถอย', aggro: 'ดึงความสนใจ', 'consumes-resource': 'ใช้ทรัพยากร', cleanse: 'ชำระล้าง',
  'debuff-immune': 'กันดีบัฟ', stance: 'ท่า', stagger: 'เสียหลัก', knockback: 'กระเด็น', 'damage-conversion': 'แปลงดาเมจ', wall: 'กำแพง',
  position: 'ตำแหน่ง', fortress: 'ป้อมปราการ', protection: 'ปกป้อง', requirement: 'มีเงื่อนไข', pull: 'ดึง', risk: 'เสี่ยง',
  debuff: 'ดีบัฟ', unshakable: 'ไม่สะทกสะท้าน', lightning: 'สายฟ้า', chain: 'ลูกโซ่', shock: 'ช็อต', slow: 'ช้าลง', script: 'อักขระ',
  dot: 'ดาเมจต่อเนื่อง', void: 'ความว่างเปล่า', phantom: 'ภูต', light: 'แสง', hot: 'รักษาต่อเนื่อง',
  // level ladder
  'Base': 'พื้นฐาน',
  'Base: 3 s veil': 'พื้นฐาน: ซ่อนตัว 3 วินาที',
};

export const TH_TAG_PATTERNS = [
  ['^([+-]\\d+%) damage$', 'ดาเมจ $1'],
  ['^([+-]\\d+%) cooldown$', 'คูลดาวน์ $1'],
  ['^([+-]\\d+%) cost$', 'ต้นทุน $1'],
  ['^(.+): \\+1 charge$', '$1: +1 ครั้ง'],
  // Character Build evolution kits (data/skillProgression.js KIT) — $1 = the skill name (kept English)
  ['^(.+) opens wounds: every hit makes the foe BLEED for 4 s\\. 10% less damage up front\\.$', '$1 เปิดแผล: ทุกครั้งที่โดน ศัตรูติด BLEED 4 วินาที ดาเมจตรงลดลง 10%'],
  ['^(.+) sets foes alight: every hit makes the foe BURN for 4 s\\. 10% less damage up front\\.$', '$1 จุดไฟศัตรู: ทุกครั้งที่โดน ศัตรูติด BURN 4 วินาที ดาเมจตรงลดลง 10%'],
  ['^Read and punish: a Perfect Dodge gives (.+) back at once, and it hits 15% harder\\.$', 'อ่านแล้วลงโทษ: Perfect Dodge คืน $1 ทันที และแรงขึ้น 15%'],
  ['^A shade repeats (.+) half a second later at 60% power\\.$', 'เงาร่ายซ้ำ $1 หลังจากนั้นครึ่งวินาที ด้วยพลัง 60%'],
  ['^Casting (.+) also gives you a shield of 12% max HP for 4 s\\.$', 'ใช้ $1 แล้วได้โล่ 12% ของ HP สูงสุด 4 วินาทีด้วย'],
  ['^(.+) lands like a wall: poise damage ×1\\.5, and casting it gives you a shield of 8% max HP\\.$', '$1 กระแทกดั่งกำแพง: ดาเมจ Poise ×1.5 และใช้แล้วได้โล่ 8% ของ HP สูงสุด'],
  ['^Two lighter casts of (.+) instead of one: 2 charges, and you move faster after each\\.$', 'ใช้ $1 แบบเบาได้สองครั้งแทนครั้งเดียว: เก็บได้ 2 ครั้ง และเคลื่อนที่เร็วขึ้นหลังแต่ละครั้ง'],
  ['^A crueller (.+): \\+25% critical chance on its hits\\.$', '$1 ที่โหดขึ้น: โอกาสคริติคอล +25%'],
  ['^A finishing (.+): \\+50% damage on foes below 35% HP\\.$', '$1 ปิดฉาก: ดาเมจ +50% กับศัตรูที่ HP ต่ำกว่า 35%'],
];
// fixed lines of the evolution kits (changes panel)
Object.assign(TH_TAGS, {
  'Wound, then let it bleed': 'สร้างแผล แล้วปล่อยให้เลือดไหล', '-10% · bleed': '-10% · เลือดไหล',
  'Light them up, keep moving': 'จุดไฟแล้วเคลื่อนที่ต่อ', '-10% · burn': '-10% · ไฟลุก', 'Every hit = BURN': 'ทุกครั้งที่โดน = BURN',
  'Perfect Dodge, then strike back': 'Perfect Dodge แล้วตอบโต้', 'Cast, step away, the shade casts again': 'ร่าย ถอยออก แล้วเงาร่ายซ้ำ',
  'Delayed second cast': 'การร่ายครั้งที่สองแบบหน่วงเวลา', 'Every cast keeps you shielded': 'ทุกการร่ายทำให้มีโล่อยู่เสมอ',
  'Shield 12% max HP': 'โล่ 12% ของ HP สูงสุด', 'Break their footing, hold yours': 'ทำลายหลักของศัตรู รักษาหลักของตัวเอง',
  'Poise ×1.5 · shield 8% max HP': 'Poise ×1.5 · โล่ 8% ของ HP สูงสุด', 'Cast, move, cast again': 'ร่าย เคลื่อนที่ แล้วร่ายอีก',
  'Fish for crits': 'หวังคริ', 'Finish wounded foes': 'ปิดฉากศัตรูที่บาดเจ็บ',
});
