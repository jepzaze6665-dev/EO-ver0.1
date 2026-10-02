import { TAU, rand } from '../core/math.js';
import { TILE, T } from '../core/constants.js';
import { ITEMS } from '../items/items.js';
import { LORE, BOARD_TEXT, BOARD_TEXT_AFTER } from '../world/narrative.js';
import { Monster } from '../monsters/monster.js';
import { Assets } from '../core/assets.js';

// Behaviour + visuals for every interactable kind. Keeping the rules here means the
// map files only *place* things; this file decides what they do.

export function isAvailable(w, it) {
  const f = w.state.flags;
  // secret objects become interactable once their area is discovered
  if (it.secret && !w.map.secretsFound.has(it.secret) && it.kind !== 'trigger') return false;
  switch (it.kind) {
    case 'chest': return !w.state.chests[it.id] || false;
    case 'resource': return !(w.state.nodes[it.id] > w.game.time);
    case 'totem': return !f.totemDone && !f.guardianDefeated && !w.totemActive;
    case 'gateSeal': return !f.gateOpened;
    case 'push': return !f.logBridge;
    case 'lever': return !f.ruinsGate;
    case 'trigger': return false;
    case 'questAltar': return w.game.quests.isActive(it.quest) && !f['lit_' + it.id];
    case 'timedRune': return w.game.quests.isActive(it.quest) && !f[it.flag];
    case 'npc': return !(it.npc && it.npc.hidden);
  }
  return true;
}

export function promptFor(w, it) {
  if (it.kind === 'chest') return it.rare ? 'Open Ornate Chest' : 'Open Chest';
  if (it.kind === 'lore' && w.state.lore[it.lore]) return (it.prompt || 'Read') + ' (read)';
  if (it.kind === 'resource') return 'Gather ' + ITEMS[it.item].name;
  if (it.kind === 'npc') return 'Talk to ' + it.npc.name;
  return it.prompt || 'Interact';
}

export function interact(w, it) {
  const g = w.game, f = w.state.flags, p = g.player;
  switch (it.kind) {
    case 'npc':
      it.npc.faceTo(p);
      g.events.emit('npcTalked', { id: it.npc.id }); // quests (talk / turn-in objectives) update before the dialogue opens
      g.ui.openDialogue(it.npc);
      break;
    case 'chest': {
      w.state.chests[it.id] = true;
      g.audio.sfx(it.rare ? 'chest_rare' : 'chest');
      g.vfx.burst(it.x, it.y - 10, it.rare ? '#e0a0ff' : '#ffd070', it.rare ? 40 : 20, 140);
      if (it.rare) { g.vfx.ring(it.x, it.y, 6, 70, { color: '220,160,255', life: 0.6 }); g.ui.banner('RARE TREASURE', 'A hidden reward for the curious', '#e0b0ff'); }
      for (const l of it.loot || []) g.inventory.add(l.item, l.count);
      if (it.gold) { p.addGold(it.gold); g.ui.pickup({ name: 'Gold', color: '#ffd24a', icon: 'coin' }, it.gold); }
      g.events.emit('chestOpened', it.id);
      g.save.dirty = true;
      break;
    }
    case 'lore': {
      const lore = LORE[it.lore];
      const first = !w.state.lore[it.lore];
      w.state.lore[it.lore] = true;
      g.ui.showLore(lore.title, lore.text);
      if (first) {
        g.audio.sfx('lore');
        for (const [type, field] of lore.reveal || []) g.knowledge.reveal(type, field);
        g.events.emit('loreFound', { id: it.lore });
        g.save.dirty = true;
      }
      break;
    }
    case 'waystone':
      if (!w.state.waystones[it.id]) {
        w.state.waystones[it.id] = true;
        g.audio.sfx('waystone');
        g.vfx.ring(it.x, it.y, 4, 60, { color: '120,240,255', life: 0.6 });
        g.vfx.burst(it.x, it.y - 30, '#9af8ff', 30, 120);
        g.ui.banner('WAYSTONE ATTUNED', it.name, '#9af8ff');
        w.state.lastWaystone = it.id;
        g.save.dirty = true;
      }
      w.state.lastWaystone = it.id;
      p.hp = p.maxHp;
      g.ui.openTeleport(it.id);
      break;
    case 'storage':
      g.ui.openStorage();
      break;
    case 'dungeonGate': // ONLINE N5: Solo / Party entry to an unlocked area (panels.dungeonGate, server/dungeons.js)
      g.ui.panels.dungeonGate();
      break;
    case 'cityReturn': { // ONLINE N6: the return stone at each area's start — ends your part of the run (server decides)
      const party = g.online && g.online.instance && g.online.instance.members.length > 1;
      g.ui.panels.confirm('Return to the city', `Leave this run and go back to the city?${party ? '\nYour party stays here — you can rejoin them only through a new entry.' : ''}`, 'Return', 'Stay', () => g.online.leaveDungeon(), () => {});
      break;
    }
    case 'sign':
      if (it.text === 'board') g.ui.showLore('Quest Board', (f.guardianDefeated ? BOARD_TEXT_AFTER : BOARD_TEXT).join('\n'));
      else g.ui.showLore(it.title || 'Sign', it.text);
      break;
    case 'shrine':
      if (!f.shrineInvestigated) {
        w.setFlag('shrineInvestigated');
        g.inventory.add('seal_fragment', 1);
        g.audio.sfx('shrine');
        g.vfx.ring(it.x, it.y, 4, 120, { color: '90,240,255', life: 1 });
        g.vfx.burst(it.x, it.y - 30, '#5af0ff', 50, 180);
        g.camera.shake(0.3);
        g.ui.showLore('The Ancient Shrine', 'The altar flares as you approach. Visions pour into you: an antlered Warden of root and crystal, sleeping beyond the northern gate — and black veins crawling into its heart.\n\nA fragment of the old seal breaks free from the altar.\n\n→ Obtained: Ancient Seal Fragment. The Guardian Gate lies north of this shrine.');
      } else g.ui.showLore('The Ancient Shrine', 'The altar is quiet. Its light points north, toward the Guardian Gate.');
      break;
    case 'gateSeal':
      if (g.inventory.has('seal_fragment')) {
        w.setFlag('gateOpened');
        w.applyState();
        g.audio.sfx('gate');
        g.camera.shake(0.5);
        g.vfx.flash('90,240,255', 0.4, 2);
        g.vfx.burst(it.x, it.y - 40, '#5af0ff', 60, 200);
        g.ui.banner('THE GUARDIAN GATE OPENS', 'Something vast breathes beyond', '#9af8ff');
      } else {
        g.ui.showLore('Sealed Gate', 'Crystal seals bind the gate. A fragment-shaped hollow glows at its centre — something from the shrine to the south might fit.');
      }
      break;
    case 'lever':
      if (p.x < it.x - 4) { g.ui.showLore('Rusted Lever', 'The lever is on the other side of the bars. It can only be pulled from within the ruins.'); break; }
      w.setFlag('ruinsGate');
      w.applyState();
      g.audio.sfx('gate');
      g.ui.banner('SHORTCUT OPENED', 'Ruins Side Gate → Crystal Glade', '#ffd98a');
      break;
    case 'push':
      if (p.y > it.y + 10) { g.ui.showLore('Dead Tree', 'A dead tree leans over the river bank. From this side it would fall the wrong way — maybe from the northern bank…'); break; }
      w.setFlag('logBridge');
      w.applyState();
      g.audio.sfx('timber');
      g.camera.shake(0.5);
      g.vfx.burst(it.x, it.y + 40, '#a0d0ff', 40, 180);
      g.ui.banner('SHORTCUT OPENED', 'Fallen Log Bridge → Abandoned Camp', '#ffd98a');
      break;
    case 'blessing':
      if (!f.moonBlessing) {
        w.setFlag('moonBlessing');
        p.recomputeStats();
        p.hp = p.maxHp; for (const rid in p.resources.defs) p.resources.fill(rid);
        g.audio.sfx('shrine');
        g.vfx.ring(it.x, it.y, 4, 90, { color: '200,220,255', life: 0.8 });
        g.vfx.burst(p.x, p.y - 20, '#dfe8ff', 40, 150);
        g.ui.showLore('Moonlit Shrine', 'Pale light settles on your shoulders like a cloak.\n\nBlessing of the Moon: +5% Critical Chance, +10% Shadow gain (permanent).');
      } else g.ui.showLore('Moonlit Shrine', 'The moonlight hums softly. Your blessing endures.');
      break;
    case 'totem':
      w.startTotemEvent(it);
      break;
    case 'resource':
      w.state.nodes[it.id] = g.time + 120;
      g.inventory.add(it.item, 1);
      g.audio.sfx('gather');
      g.vfx.shards(it.x, it.y - 10, ITEMS[it.item].color, 12, 120);
      break;
    case 'dungeon':
      if (!f.dungeonSeen) {
        w.setFlag('dungeonSeen');
        g.quests.accept('depths');
      }
      g.ui.showLore('The Sealed Depths', 'A colossal door of violet crystal, veined with the same corruption that poisoned the Guardian. Runes crawl across its surface, rearranging themselves as you watch.\n\nIt will not open. Not yet.', () => g.ui.showEnding());
      break;
    // generic QUEST ALTAR (data: quest, group, count, flag): lights itself (flag lit_<id>); when every altar of its group
    // is lit the group `flag` is set (a quest's flag objective)
    case 'questAltar': {
      w.setFlag('lit_' + it.id);
      const n = Object.keys(f).filter((k) => k.startsWith('lit_' + it.group) && f[k]).length; // altar ids start with their group
      g.audio.sfx('shrine');
      g.vfx.burst(it.x, it.y - 24, '#ff8a30', 40, 160);
      g.vfx.ring(it.x, it.y, 4, 70, { color: '255,140,60', life: 0.7 });
      g.ui.banner('ALTAR REKINDLED', `${n} / ${it.count}`, '#ff9a50');
      if (n >= it.count) w.setFlag(it.flag);
      g.save.dirty = true;
      break;
    }
    // generic TIMED RUNE (data: quest, flag, period, open, burn, title, wake / cold texts): only answers while its runes
    // burn (the first `open` s of every `period` s); touched while cold it burns the player
    case 'timedRune':
      if ((g.time % it.period) < it.open) {
        w.setFlag(it.flag);
        g.audio.sfx('shrine');
        g.camera.shake(0.4);
        g.vfx.flash('255,120,40', 0.3, 2);
        g.vfx.burst(it.x, it.y - 40, '#ff8a30', 60, 200);
        g.ui.showLore(it.title, it.wake);
      } else {
        p.hp = Math.max(1, p.hp - Math.round(p.maxHp * (it.burn || 0.06)));
        g.vfx.text(p.x, p.y - 40, 'THE STONE IS COLD — IT BURNS', { color: '#ff7040', size: 10 });
        g.vfx.burst(p.x, p.y - 20, '#ff6020', 16, 100);
        g.audio.sfx('hurt');
      }
      break;
    // generic FORGE (data: needs { item: n }, gives { item: n }, flag, title, text, forge, done): turns the needed items
    // into the given ones once; otherwise shows its text + how many of the needed items you carry
    case 'forge': {
      if (f[it.flag]) { g.ui.showLore(it.title, it.done); break; }
      const need = Object.entries(it.needs);
      if (need.every(([id, n]) => g.inventory.has(id, n))) {
        for (const [id, n] of need) g.inventory.remove(id, n);
        for (const [id, n] of Object.entries(it.gives)) g.inventory.add(id, n);
        w.setFlag(it.flag);
        g.audio.sfx('gate');
        g.camera.shake(0.5);
        g.vfx.flash('255,120,40', 0.4, 2);
        g.vfx.burst(it.x, it.y - 30, '#ff8a30', 70, 220);
        if (it.banner) g.ui.banner(...it.banner);
        g.ui.showLore(it.title, it.forge);
        g.save.dirty = true;
      } else {
        const have = need.map(([id, n]) => `${ITEMS[id] ? ITEMS[id].name : id}: ${Math.min(n, g.inventory.count(id))} / ${n}`).join('\n');
        g.ui.showLore(it.title, `${it.text}\n\n${have}`);
      }
      break;
    }
    // generic SEALED DOOR (data: flag, item, consume, title, locked / opening / open texts, banner): bringing the item
    // sets the flag (an exit / gate names it in its requirements); without it the door only describes itself
    case 'sealDoor':
      if (f[it.flag]) { g.ui.showLore(it.title, it.open); break; }
      if (it.item && g.inventory.has(it.item)) {
        if (it.consume) g.inventory.remove(it.item, 1);
        w.setFlag(it.flag);
        w.applyState();
        g.audio.sfx('gate');
        g.camera.shake(0.6);
        g.vfx.flash('255,120,40', 0.45, 2);
        g.vfx.burst(it.x, it.y - 40, '#ff8a30', 70, 220);
        if (it.banner) g.ui.banner(...it.banner);
        g.ui.showLore(it.title, it.opening);
        g.save.dirty = true;
      } else g.ui.showLore(it.title, it.locked);
      break;
    case 'crackInfo':
      g.ui.showLore('Cracked Stone', 'Violet light seeps through the cracks and the stone hums faintly. It looks brittle — as if a strong strike would bring it down.');
      break;
    case 'glyphInfo':
      g.ui.showLore('Glowing Glyph', 'An ancient symbol pulses on the wall. Tapping it echoes hollowly — there is space behind this wall.');
      break;
  }
}

// ---------------- visuals
export function drawInteractable(ctx, w, it, time) {
  const f = w.state.flags;
  const x = Math.round(it.x), y = Math.round(it.y);
  switch (it.kind) {
    case 'chest': drawChest(ctx, x, y, !!w.state.chests[it.id], it.rare, time); break;
    case 'lore':
      if (!w.state.lore[it.lore]) {
        const b = Math.sin(time * 3) * 2;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,230,160,0.35)';
        ctx.beginPath(); ctx.arc(x, y - 22 + b, 6, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#fff4d0';
        ctx.fillRect(x - 3, y - 26 + b, 6, 7);
        ctx.fillStyle = '#b08a50';
        ctx.fillRect(x - 2, y - 24 + b, 4, 1); ctx.fillRect(x - 2, y - 22 + b, 4, 1);
      }
      break;
    case 'waystone': drawWaystone(ctx, x, y, !!w.state.waystones[it.id], time); break;
    case 'dungeonGate': drawDungeonGate(ctx, x, y, time); break;
    case 'cityReturn': drawCityReturn(ctx, x, y, time); break;
    case 'lever': {
      ctx.fillStyle = '#4a4a52'; ctx.fillRect(x - 5, y - 14, 10, 14);
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2;
      const a = f.ruinsGate ? 0.7 : -0.7;
      ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + Math.sin(a) * 14, y - 12 - Math.cos(a) * 14); ctx.stroke();
      ctx.fillStyle = '#c04040'; ctx.fillRect(x + Math.sin(a) * 14 - 2, y - 12 - Math.cos(a) * 14 - 2, 4, 4);
      ctx.lineWidth = 1;
      break;
    }
    case 'resource':
      if (!(w.state.nodes[it.id] > w.game.time)) {
        const def = Assets.props[it.item === 'moon_crystal' ? 'cry_purple_cluster' : 'cry_cyan_cluster'];
        if (def) ctx.drawImage(def.img, def.x, def.y, def.w, def.h, x - def.w * 0.35, y - def.h * 0.7, def.w * 0.7, def.h * 0.7);
        if (Math.sin(time * 4 + x) > 0.9) { ctx.fillStyle = '#fff'; ctx.fillRect(x + rand(-8, 8), y - rand(8, 24), 2, 2); }
      }
      break;
    case 'totem':
      if (!f.totemDone && !f.guardianDefeated) {
        ctx.fillStyle = '#2a1a36'; ctx.fillRect(x - 6, y - 34, 12, 34);
        ctx.fillStyle = '#4a2a64'; ctx.fillRect(x - 8, y - 38, 16, 6);
        ctx.fillStyle = `rgba(220,90,255,${0.6 + 0.4 * Math.sin(time * 5)})`;
        ctx.fillRect(x - 2, y - 28, 4, 4); ctx.fillRect(x - 2, y - 18, 4, 4);
        for (let i = 0; i < 3; i++) { ctx.fillStyle = '#6a2a8a'; ctx.fillRect(x - 10 + i * 8, y - 2, 4, 2); }
      }
      break;
    // quest altar / timed rune statue: drawn from a prop (data `art`, `artScale`) + their fire
    case 'questAltar': case 'timedRune': {
      const def = Assets.props[it.art];
      const s = it.artScale || 1;
      if (def) ctx.drawImage(def.img, def.x, def.y, def.w, def.h, x - (def.w * s) / 2, y - def.h * s + 4, def.w * s, def.h * s);
      const burning = it.kind === 'questAltar' ? f['lit_' + it.id] : f[it.flag] || (w.game.quests.isActive(it.quest) && (w.game.time % it.period) < it.open);
      if (!burning) break;
      const fy = y - (it.fireY || (def ? def.h * s * 0.8 : 30));
      ctx.globalCompositeOperation = 'lighter';
      if (it.kind === 'timedRune') { // burning runes: a pulsing rune ring at its feet + ember eyes
        const a = 0.35 + 0.25 * Math.sin(time * 8);
        ctx.strokeStyle = `rgba(255,120,40,${a})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x, y - 2, 30, 11, 0, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x, y - 2, 22, 8, 0, 0, TAU); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = `rgba(255,170,60,${0.5 + a})`;
        ctx.beginPath(); ctx.arc(x - 5, fy, 3, 0, TAU); ctx.arc(x + 5, fy, 3, 0, TAU); ctx.fill();
      } else for (let i = 0; i < 3; i++) {
        const r = 12 - i * 4 + Math.sin(time * 9 + i) * 2;
        ctx.fillStyle = `rgba(255,${110 + i * 50},40,${0.25 + i * 0.1})`;
        ctx.beginPath(); ctx.arc(x, fy - i * 3, r, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
  }
}

function drawChest(ctx, x, y, open, rare, t) {
  const body = rare ? '#3a2250' : '#5a3a20', trim = rare ? '#d8a0ff' : '#d0a040', dark = rare ? '#1e1030' : '#3a2410';
  if (!open) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rare ? `rgba(200,120,255,${0.25 + 0.15 * Math.sin(t * 4)})` : `rgba(255,210,120,${0.12 + 0.08 * Math.sin(t * 3)})`;
    ctx.beginPath(); ctx.arc(x, y - 8, 16, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 11, y - 2, 22, 4);
  ctx.fillStyle = dark; ctx.fillRect(x - 11, y - 12, 22, 12);
  ctx.fillStyle = body; ctx.fillRect(x - 10, y - 11, 20, 10);
  ctx.fillStyle = trim; ctx.fillRect(x - 11, y - 12, 22, 2); ctx.fillRect(x - 2, y - 10, 4, 5);
  if (open) {
    ctx.fillStyle = dark; ctx.fillRect(x - 11, y - 20, 22, 8);
    ctx.fillStyle = '#120a06'; ctx.fillRect(x - 9, y - 12, 18, 3);
  } else {
    ctx.fillStyle = body; ctx.fillRect(x - 11, y - 18, 22, 7);
    ctx.fillStyle = trim; ctx.fillRect(x - 11, y - 18, 22, 1); ctx.fillRect(x - 11, y - 13, 22, 1);
  }
}

// RETURN STONE (online N6): a low stone with a pale gold rune circle — the way back to the city
function drawCityReturn(ctx, x, y, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const p = 0.5 + 0.5 * Math.sin(t * 2.2);
  ctx.strokeStyle = `rgba(255,220,140,${0.35 + 0.25 * p})`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(x, y, 22, 8, 0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x, y, 15, 5.5, 0, t * 0.8, t * 0.8 + 4.2); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y, 11, 4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#4a4438'; ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x - 7, y - 20); ctx.lineTo(x + 7, y - 22); ctx.lineTo(x + 10, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5e5646'; ctx.fillRect(x - 6, y - 19, 3, 17);
  ctx.fillStyle = `rgba(255,215,130,${0.65 + 0.35 * p})`; // house rune
  ctx.fillRect(x - 1, y - 16, 2, 9); ctx.fillRect(x - 4, y - 13, 8, 2); ctx.fillRect(x - 3, y - 7, 6, 1);
}

// DUNGEON GATE (online N5): a dark stone arch with a slow violet swirl between its pillars
function drawDungeonGate(ctx, x, y, t) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y, 26, 7, 0, 0, TAU); ctx.fill();
  // swirl (behind the pillars' fronts)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const r = 15 - i * 4, a = 0.22 + 0.08 * Math.sin(t * 2 + i);
    ctx.fillStyle = `rgba(${150 + i * 30},${70 + i * 30},255,${a})`;
    ctx.beginPath(); ctx.ellipse(x, y - 26, r, r * 1.45, 0, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(210,170,255,0.55)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(x, y - 26, 9 + i * 4, 15 + i * 5, 0, t * (1.4 - i * 0.5), t * (1.4 - i * 0.5) + 3.6); ctx.stroke(); }
  ctx.restore();
  // pillars + lintel
  ctx.fillStyle = '#2e2a38'; ctx.fillRect(x - 24, y - 50, 8, 50); ctx.fillRect(x + 16, y - 50, 8, 50);
  ctx.fillStyle = '#433d52'; ctx.fillRect(x - 22, y - 48, 3, 46); ctx.fillRect(x + 18, y - 48, 3, 46);
  ctx.fillStyle = '#2e2a38'; ctx.fillRect(x - 28, y - 58, 56, 9);
  ctx.fillStyle = '#4c4560'; ctx.fillRect(x - 28, y - 58, 56, 2);
  ctx.fillStyle = `rgba(190,140,255,${0.7 + 0.3 * Math.sin(t * 3)})`; // keystone rune
  ctx.beginPath(); ctx.moveTo(x, y - 61); ctx.lineTo(x + 4, y - 54); ctx.lineTo(x, y - 47); ctx.lineTo(x - 4, y - 54); ctx.closePath(); ctx.fill();
}

function drawWaystone(ctx, x, y, on, t) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y, 12, 4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3a3e4a';
  ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x - 6, y - 30); ctx.lineTo(x + 6, y - 30); ctx.lineTo(x + 9, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4e5464'; ctx.fillRect(x - 5, y - 28, 4, 26);
  ctx.fillStyle = on ? '#5af0ff' : '#2a4a58';
  ctx.fillRect(x - 1, y - 24, 2, 3); ctx.fillRect(x - 3, y - 17, 6, 2); ctx.fillRect(x - 1, y - 11, 2, 3);
  const b = Math.sin(t * 2) * 2;
  ctx.fillStyle = on ? '#9af8ff' : '#3a6070';
  ctx.beginPath(); ctx.moveTo(x, y - 46 + b); ctx.lineTo(x + 6, y - 38 + b); ctx.lineTo(x, y - 30 + b); ctx.lineTo(x - 6, y - 38 + b); ctx.closePath(); ctx.fill();
  if (on) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(90,240,255,${0.3 + 0.15 * Math.sin(t * 3)})`;
    ctx.beginPath(); ctx.arc(x, y - 38 + b, 12, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}
