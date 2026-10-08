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
];
