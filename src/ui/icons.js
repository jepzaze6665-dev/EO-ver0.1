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
