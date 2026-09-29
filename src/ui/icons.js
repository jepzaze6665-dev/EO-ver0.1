import { makeCanvas } from '../core/assets.js';

// Procedural 32x32 icons for skills and items (placeholder art, same size as a real icon atlas).
const cache = new Map();

export function icon(name, color = '#b070ff') {
  const key = name + color;
  if (cache.has(key)) return cache.get(key);
  const c = makeCanvas(32, 32);
  const g = c.getContext('2d');
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const glow = (col, w, fn) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); fn(); g.stroke(); };
  switch (name) {
    // ---- Aegis Guardian
    case 'shield': case 'guard':
      g.fillStyle = '#2a4a8a'; g.beginPath(); g.moveTo(16, 3); g.lineTo(27, 8); g.lineTo(25, 20); g.lineTo(16, 29); g.lineTo(7, 20); g.lineTo(5, 8); g.closePath(); g.fill();
      g.strokeStyle = '#ffd070'; g.lineWidth = 2; g.stroke();
      glow('#fff0b0', 1.5, () => { g.moveTo(16, 8); g.lineTo(16, 24); g.moveTo(10, 14); g.lineTo(22, 14); });
      break;
    case 'shield_bash':
      g.fillStyle = '#2a4a8a'; g.beginPath(); g.moveTo(10, 5); g.lineTo(19, 9); g.lineTo(17, 20); g.lineTo(10, 27); g.lineTo(4, 20); g.lineTo(3, 9); g.closePath(); g.fill();
      g.strokeStyle = '#ffd070'; g.lineWidth = 2; g.stroke();
      for (let i = 0; i < 3; i++) glow('#9ad8ff', 2, () => { g.moveTo(21, 9 + i * 7); g.lineTo(29, 7 + i * 8); });
      break;
    case 'guardian_slash':
      glow('#8a6a20', 6, () => g.arc(10, 26, 20, -1.3, 0.1));
      glow('#ffd070', 3, () => g.arc(10, 26, 20, -1.3, 0.1));
      glow('#9ad8ff', 1.5, () => g.arc(10, 26, 15, -1.2, 0));
      break;
    case 'challenge':
      for (let i = 0; i < 3; i++) glow(['#8a6a20', '#ffd070', '#fff0b0'][i], 2, () => g.ellipse(16, 22, 6 + i * 5, 3 + i * 2.2, 0, 0, 7));
      glow('#fff0b0', 2, () => { g.moveTo(16, 4); g.lineTo(16, 18); });
      break;
    case 'barrier':
      g.fillStyle = 'rgba(140,200,255,0.45)'; g.beginPath(); g.arc(16, 24, 13, Math.PI, 0); g.closePath(); g.fill();
      glow('#ffd070', 2, () => g.arc(16, 24, 13, Math.PI, 0));
      glow('#ffd070', 2, () => { g.moveTo(3, 24); g.lineTo(29, 24); });
      break;
    case 'aegis':
      g.fillStyle = 'rgba(120,180,255,0.35)'; g.beginPath(); g.arc(16, 16, 14, 0, 7); g.fill();
      g.fillStyle = '#2a4a8a'; g.beginPath(); g.moveTo(16, 6); g.lineTo(24, 10); g.lineTo(22, 19); g.lineTo(16, 26); g.lineTo(10, 19); g.lineTo(8, 10); g.closePath(); g.fill();
      g.strokeStyle = '#ffd070'; g.lineWidth = 2; g.stroke();
      break;
    // ---- Nightfall Reaper
    case 'scythe':
      glow('#2a2030', 4, () => { g.moveTo(9, 29); g.lineTo(21, 5); });
      glow('#7a6a8a', 2, () => { g.moveTo(9, 29); g.lineTo(21, 5); });
      glow('#3a1a6a', 5, () => { g.moveTo(21, 5); g.quadraticCurveTo(8, 3, 3, 14); });
      glow(color, 2.5, () => { g.moveTo(21, 5); g.quadraticCurveTo(8, 3, 3, 14); });
      break;
    case 'reaper_arc':
      g.fillStyle = 'rgba(60,20,110,0.55)'; g.beginPath(); g.arc(16, 16, 13, 0, 7); g.fill();
      for (let i = 0; i < 3; i++) glow(['#3a1a6a', '#9a5cff', '#f0d8ff'][i], 4 - i * 1.2, () => g.arc(16, 16, 12 - i, i * 0.9, i * 0.9 + 4.6));
      g.fillStyle = '#e8c8ff'; g.beginPath(); g.moveTo(16, 12); g.lineTo(19, 16); g.lineTo(16, 20); g.lineTo(13, 16); g.closePath(); g.fill();
      break;
    case 'phantom_reap':
      for (let i = 0; i < 3; i++) glow(`rgba(150,90,255,${0.3 + i * 0.25})`, 2, () => { g.moveTo(3 + i * 4, 26 - i * 2); g.lineTo(18 + i * 4, 18 - i * 2); });
      glow('#3a1a6a', 5, () => g.arc(22, 20, 9, -2.4, 0.2));
      glow('#e0c0ff', 2.5, () => g.arc(22, 20, 9, -2.4, 0.2));
      break;
    case 'doppel':
      g.fillStyle = 'rgba(150,100,255,0.45)'; g.beginPath(); g.arc(20, 11, 5, 0, 7); g.fill(); g.fillRect(15, 15, 10, 13);
      g.fillStyle = '#140a20'; g.beginPath(); g.arc(12, 11, 5, 0, 7); g.fill(); g.fillRect(7, 15, 10, 13);
      glow('#b080ff', 1.5, () => { g.arc(12, 11, 5, 0, 7); });
      break;
    case 'nightfall_zone':
      g.fillStyle = 'rgba(70,20,130,0.6)'; g.beginPath(); g.ellipse(16, 22, 14, 7, 0, 0, 7); g.fill();
      glow('#b080ff', 2, () => g.ellipse(16, 22, 14, 7, 0, 0, 7));
      for (let i = 0; i < 4; i++) glow('#e0c8ff', 1.5, () => { g.moveTo(8 + i * 5.5, 20); g.lineTo(8 + i * 5.5, 8 + (i % 2) * 4); });
      break;
    case 'reaper_step':
      g.fillStyle = '#140a20'; g.beginPath(); g.arc(22, 12, 5, 0, 7); g.fill(); g.fillRect(17, 16, 10, 12);
      for (let i = 0; i < 3; i++) glow(`rgba(150,90,255,${0.25 + i * 0.2})`, 2, () => g.arc(9 + i, 18, 3 + i * 2, 0, 7));
      g.fillStyle = '#e8c8ff'; g.beginPath(); g.moveTo(9, 10); g.lineTo(12, 14); g.lineTo(9, 18); g.lineTo(6, 14); g.closePath(); g.fill();
      break;
    case 'funeral_eclipse':
      g.fillStyle = '#5a2aa0'; g.beginPath(); g.arc(16, 12, 10, 0, 7); g.fill();
      g.fillStyle = '#05000a'; g.beginPath(); g.arc(16, 12, 7, 0, 7); g.fill();
      glow('#fff', 1.2, () => g.arc(16, 12, 7, 0, 7));
      for (let i = 0; i < 5; i++) glow('#9a5cff', 2, () => { g.moveTo(5 + i * 5.5, 30); g.lineTo(6 + i * 5.5, 23 - (i % 2) * 3); });
      break;
    // ---- Duskrunner
    case 'twin_blades':
      for (const [x0, y0, x1, y1] of [[6, 27, 20, 7], [26, 27, 12, 7]]) { glow('#1a2a4a', 4, () => { g.moveTo(x0, y0); g.lineTo(x1, y1); }); glow(color, 2, () => { g.moveTo(x0, y0); g.lineTo(x1, y1); }); }
      break;
    case 'blue_fang':
      for (let i = 0; i < 3; i++) glow(`rgba(90,184,255,${0.25 + i * 0.25})`, 2, () => { g.moveTo(3 + i * 3, 24 - i * 3); g.lineTo(16 + i * 3, 20 - i * 3); });
      glow('#123a7a', 5, () => { g.moveTo(14, 26); g.lineTo(29, 8); });
      glow('#d8f0ff', 2, () => { g.moveTo(14, 26); g.lineTo(29, 8); });
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(29, 8); g.lineTo(30, 3); g.lineTo(25, 7); g.closePath(); g.fill();
      break;
    case 'flash_step':
      g.fillStyle = 'rgba(90,184,255,0.3)'; g.fillRect(4, 13, 10, 12);
      g.fillStyle = '#0a1a30'; g.beginPath(); g.arc(22, 10, 4, 0, 7); g.fill(); g.fillRect(18, 14, 8, 12);
      glow('#5ab8ff', 2, () => { g.moveTo(4, 26); g.lineTo(13, 18); g.lineTo(9, 14); g.lineTo(17, 6); });
      break;
    case 'dusk_barrage':
      for (let i = 0; i < 5; i++) { const q = -1.2 + i * 0.6; glow(i % 2 ? '#5ab8ff' : '#d8f0ff', 2, () => { g.moveTo(16 + Math.cos(q) * 4, 16 + Math.sin(q) * 4); g.lineTo(16 + Math.cos(q) * 14, 16 + Math.sin(q) * 14); }); }
      glow('#ffffff', 2.5, () => { g.moveTo(8, 8); g.lineTo(24, 24); g.moveTo(24, 8); g.lineTo(8, 24); });
      break;
    case 'mirage_shift':
      g.fillStyle = 'rgba(90,184,255,0.4)'; g.beginPath(); g.arc(9, 11, 4, 0, 7); g.fill(); g.fillRect(5, 15, 8, 12);
      g.fillStyle = '#0a1a30'; g.beginPath(); g.arc(24, 11, 4, 0, 7); g.fill(); g.fillRect(20, 15, 8, 12);
      glow('#d8f0ff', 1.5, () => { g.moveTo(22, 29); g.quadraticCurveTo(16, 31, 11, 29); });
      g.fillStyle = '#d8f0ff'; g.beginPath(); g.moveTo(10, 29); g.lineTo(14, 26); g.lineTo(14, 31); g.closePath(); g.fill();
      break;
    case 'silent_run':
      g.fillStyle = 'rgba(20,40,80,0.6)'; g.beginPath(); g.arc(16, 16, 13, 0, 7); g.fill();
      for (let i = 0; i < 4; i++) glow(`rgba(154,216,255,${0.2 + i * 0.2})`, 1.5, () => { g.moveTo(4, 10 + i * 4); g.lineTo(14 + i * 2, 10 + i * 4); });
      g.fillStyle = 'rgba(216,240,255,0.7)'; g.beginPath(); g.arc(22, 12, 4, 0, 7); g.fill(); g.fillRect(18, 16, 8, 10);
      break;
    case 'endless_run':
      glow('#123a7a', 5, () => g.arc(16, 16, 11, 0, 7));
      glow('#5ab8ff', 2.5, () => g.arc(16, 16, 11, -0.6, 4.2));
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(26, 9); g.lineTo(30, 16); g.lineTo(23, 14); g.closePath(); g.fill();
      glow('#d8f0ff', 2, () => { g.moveTo(10, 16); g.lineTo(22, 16); g.moveTo(17, 11); g.lineTo(22, 16); g.lineTo(17, 21); });
      break;
    // ---- Umbral Sword (loadout skills)
    case 'veil_shadow':
      g.fillStyle = 'rgba(90,40,150,0.5)'; g.beginPath(); g.arc(16, 17, 12, 0, 7); g.fill();
      for (let i = 0; i < 3; i++) glow(['#3a1a6a', '#8a50e0', '#e0c8ff'][i], 3 - i, () => { g.moveTo(8 + i * 2, 26); g.quadraticCurveTo(16, 4 + i * 3, 24 - i * 2, 26); });
      break;
    case 'phantom':
      glow('#4a2080', 5, () => { g.moveTo(6, 26); g.lineTo(24, 8); });
      glow('#d0a0ff', 2, () => { g.moveTo(6, 26); g.lineTo(24, 8); });
      glow('rgba(200,150,255,0.6)', 1.5, () => g.arc(16, 16, 13, -2.6, 0.6));
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(24, 8); g.lineTo(28, 4); g.lineTo(26, 10); g.closePath(); g.fill();
      break;
    // ---- Astral Weaver
    case 'needle':
      glow('#1a3a7a', 5, () => { g.moveTo(4, 28); g.lineTo(28, 4); });
      glow('#8ad8ff', 2.5, () => { g.moveTo(4, 28); g.lineTo(28, 4); });
      g.fillStyle = '#fff'; g.beginPath(); g.arc(26, 6, 3, 0, 7); g.fill();
      break;
    case 'thread':
      glow('#2a5aaa', 4, () => { g.moveTo(5, 24); g.quadraticCurveTo(16, 4, 27, 20); });
      glow('#bfe8ff', 1.5, () => { g.moveTo(5, 24); g.quadraticCurveTo(16, 4, 27, 20); });
      g.fillStyle = '#fff'; for (const [x, y] of [[5, 24], [27, 20]]) { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); }
      break;
    case 'comet':
      for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(120,200,255,${0.15 + i * 0.2})`; g.beginPath(); g.arc(6 + i * 5, 22 - i * 3, 2 + i, 0, 7); g.fill(); }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(26, 9, 4, 0, 7); g.fill();
      break;
    case 'burst':
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; glow(i % 2 ? '#8ad8ff' : '#e8f8ff', 2, () => { g.moveTo(16 + Math.cos(a) * 5, 16 + Math.sin(a) * 5); g.lineTo(16 + Math.cos(a) * 14, 16 + Math.sin(a) * 14); }); }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(16, 16, 4, 0, 7); g.fill();
      break;
    case 'starfall':
      for (const [x, y, r] of [[8, 8, 2], [16, 12, 3], [24, 7, 2]]) { glow('#8ad8ff', 1.5, () => { g.moveTo(x, y - 6); g.lineTo(x, y + 6); }); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y + 6, r, 0, 7); g.fill(); }
      g.fillStyle = '#3a6ad8'; g.beginPath(); g.ellipse(16, 27, 12, 3, 0, 0, 7); g.fill();
      break;
    case 'veil':
      glow('#2a5aaa', 4, () => g.arc(16, 16, 12, 0, 7));
      glow('#bfe8ff', 1.5, () => g.arc(16, 16, 12, 0, 7));
      g.fillStyle = 'rgba(138,216,255,0.35)'; g.beginPath(); g.arc(16, 16, 11, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(16, 16, 3, 0, 7); g.fill();
      break;
    case 'staff':
      glow('#8a6a30', 3, () => { g.moveTo(8, 28); g.lineTo(22, 10); });
      g.fillStyle = '#8ad8ff'; g.beginPath(); g.moveTo(24, 3); g.lineTo(29, 8); g.lineTo(24, 13); g.lineTo(19, 8); g.closePath(); g.fill();
      break;
    case 'slash':
      glow('#5a2a90', 6, () => g.arc(10, 26, 20, -1.3, 0.1));
      glow('#c080ff', 3, () => g.arc(10, 26, 20, -1.3, 0.1));
      glow('#fff', 1, () => g.arc(10, 26, 20, -1.1, -0.1));
      break;
    case 'twin':
      glow('#5a2a90', 5, () => { g.moveTo(6, 6); g.lineTo(26, 26); g.moveTo(26, 6); g.lineTo(6, 26); });
      glow('#d0a0ff', 2, () => { g.moveTo(6, 6); g.lineTo(26, 26); g.moveTo(26, 6); g.lineTo(6, 26); });
      break;
    case 'step':
      for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(160,90,255,${0.2 + i * 0.2})`; g.fillRect(4 + i * 5, 12, 6, 10); }
      g.fillStyle = '#e8d0ff'; g.beginPath(); g.moveTo(22, 8); g.lineTo(30, 16); g.lineTo(22, 24); g.closePath(); g.fill();
      break;
    case 'arc':
      for (let i = 0; i < 3; i++) glow(['#4a2080', '#9a50ff', '#f0d8ff'][i], 5 - i * 1.5, () => g.arc(16, 30, 10 + i * 6, -2.6, -0.5));
      break;
    case 'eclipse':
      g.fillStyle = '#9a50ff'; g.beginPath(); g.arc(16, 16, 13, 0, 7); g.fill();
      g.fillStyle = '#05000a'; g.beginPath(); g.arc(16, 16, 10, 0, 7); g.fill();
      glow('#fff', 1.5, () => g.arc(16, 16, 10, 0, 7));
      glow('#e0b0ff', 2, () => { g.moveTo(3, 29); g.lineTo(29, 3); });
      break;
    case 'break':
      g.fillStyle = '#b060ff';
      for (let i = 0; i < 3; i++) { const x = 8 + i * 8; g.beginPath(); g.moveTo(x, 10); g.lineTo(x + 4, 16); g.lineTo(x, 22); g.lineTo(x - 4, 16); g.closePath(); g.fill(); }
      glow('rgba(255,220,255,0.9)', 1.5, () => g.arc(16, 16, 14, 0, 7));
      break;
    case 'sword':
      glow('#2a2030', 5, () => { g.moveTo(7, 25); g.lineTo(25, 7); });
      glow(color, 3, () => { g.moveTo(8, 24); g.lineTo(25, 7); });
      glow('#fff', 1, () => { g.moveTo(12, 20); g.lineTo(24, 8); });
      g.fillStyle = '#c8a24a'; g.fillRect(6, 20, 8, 3); g.fillStyle = '#5a3a20'; g.fillRect(4, 24, 4, 4);
      break;
    case 'cloak':
      g.fillStyle = '#1a1024'; g.beginPath(); g.moveTo(16, 4); g.lineTo(27, 12); g.lineTo(28, 28); g.lineTo(4, 28); g.lineTo(5, 12); g.closePath(); g.fill();
      g.fillStyle = color; g.fillRect(6, 25, 20, 3); g.fillRect(15, 6, 2, 20);
      break;
    case 'sigil':
      g.fillStyle = '#120818'; g.beginPath(); g.arc(16, 16, 12, 0, 7); g.fill();
      glow(color, 2, () => g.arc(16, 16, 12, 0, 7));
      glow('#fff', 1.5, () => g.arc(16, 16, 6, 0, 7));
      break;
    case 'charm':
      glow('#8a6a3a', 2, () => { g.moveTo(8, 4); g.quadraticCurveTo(16, 14, 24, 4); });
      g.fillStyle = color; g.beginPath(); g.moveTo(16, 12); g.lineTo(22, 22); g.lineTo(16, 30); g.lineTo(10, 22); g.closePath(); g.fill();
      break;
    case 'heart':
      g.fillStyle = color; g.beginPath(); g.moveTo(16, 4); g.lineTo(26, 16); g.lineTo(16, 29); g.lineTo(6, 16); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.fillRect(13, 10, 3, 6);
      break;
    case 'potion':
      g.fillStyle = '#c8d0e0'; g.fillRect(13, 4, 6, 6);
      g.fillStyle = color; g.beginPath(); g.arc(16, 20, 9, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(11, 15, 3, 5);
      break;
    case 'fang':
      g.fillStyle = color; g.beginPath(); g.moveTo(10, 6); g.quadraticCurveTo(24, 10, 20, 28); g.quadraticCurveTo(14, 16, 10, 6); g.fill();
      break;
    case 'ore':
      g.fillStyle = '#5a5a60'; g.beginPath(); g.moveTo(6, 22); g.lineTo(12, 8); g.lineTo(24, 10); g.lineTo(27, 24); g.closePath(); g.fill();
      g.fillStyle = color; g.fillRect(12, 14, 5, 4); g.fillRect(19, 17, 4, 3);
      break;
    case 'shard':
      g.fillStyle = color; g.beginPath(); g.moveTo(16, 3); g.lineTo(24, 16); g.lineTo(16, 29); g.lineTo(9, 16); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.moveTo(16, 3); g.lineTo(16, 29); g.lineTo(9, 16); g.closePath(); g.fill();
      break;
    case 'rune':
      g.fillStyle = '#2a3040'; g.fillRect(6, 4, 20, 24);
      glow(color, 2, () => { g.moveTo(16, 8); g.lineTo(16, 24); g.moveTo(10, 12); g.lineTo(22, 20); g.moveTo(22, 12); g.lineTo(10, 20); });
      break;
    case 'coin':
      g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(16, 16, 10, 0, 7); g.fill();
      g.fillStyle = '#b08a20'; g.fillRect(14, 10, 4, 12);
      break;
    default:
      g.fillStyle = color; g.fillRect(8, 8, 16, 16);
  }
  cache.set(key, c);
  return c;
}

export function iconURL(name, color) {
  return icon(name, color).toDataURL();
}
