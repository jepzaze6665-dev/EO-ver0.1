import { TILE } from '../core/constants.js';
import { RESOURCES } from '../data/resources.js';
import { ITEMS } from '../items/items.js';
import { GEAR_SLOTS, MODIFIER_TYPES } from '../data/items/rules.js';
import { finalStatRows } from './loadoutUI.js';

// DEBUG OVERLAY (F3) — read-only view of the game state for testing (spec §40). Two parts:
//   debugInfo(game) : plain data (also handy from the console: __game.debugInfo())
//   drawDebug(game, ctx) : draws it + the sprite validation report
export function debugInfo(g) {
  const p = g.player, w = g.world, t = g.targets && g.targets.current;
  const rid = p.primaryResource;
  const quests = Object.keys(g.quests.active).map((id) => {
    const o = g.quests.current(id), st = g.quests.active[id];
    return `${id}${o ? ` → ${o.id}${o.count ? ` ${st.progress[o.id] || 0}/${o.count}` : ''}` : ''}`;
  });
  return {
    fps: g.fps,
    map: w.mapId, zone: w.currentZone, sub: w.currentSub ? w.currentSub.name : '',
    pos: [+(p.x / TILE).toFixed(1), +(p.y / TILE).toFixed(1)],
    hp: `${Math.ceil(p.hp)}/${p.maxHp}`, level: p.level, exp: `${p.exp}/${p.expToNext()}`, gold: p.gold,
    classId: p.cls.id, resource: `${RESOURCES[rid].label} ${Math.floor(p.resources.get(rid))}/${p.resources.max(rid)}`,
    target: t ? `${t.name || (t.def && t.def.name) || t.type} ${Math.ceil(t.hp)}/${Math.ceil(t.maxHp)}` : '-',
    enemies: w.hostiles().filter((e) => w.monsters.includes(e) || e === w.guardian).length,
    effects: {
      statuses: p.status.list().map((s) => (s.stacks > 1 ? `${s.id}×${s.stacks}` : s.id)),
      particles: g.vfx.particles.count(), projectiles: g.combat.projectiles.pool.count(), telegraphs: g.combat.telegraphs.list.length,
      marks: g.marks.count(), threads: g.threads.count(), summons: g.summons.count(),
      hazards: w.hazardSys.list.filter((h) => w.hazardSys.active(h)).length,
    },
    quests, questsDone: Object.keys(g.quests.completed).length,
    boss: w.bossActive && w.boss ? `${w.boss.type} phase ${w.boss.phase} ${Math.ceil(w.boss.hp)}/${w.boss.maxHp}` : '-',
    time: `timeScale ${g.timeScale.toFixed(2)} hitStop ${g.hitStop.toFixed(2)}`,
    flags: Object.keys(w.state.flags),
    route: g.worldProgress ? g.worldProgress.currentRoute || '-' : '-',
    bosses: g.bosses ? g.bosses.list.map((e) => `${e.id}:${e.state}`).join(' ') : '-',
    unlocked: g.worldProgress ? Object.keys(g.worldProgress.unlockedMaps).join(',') : '-',
    gear: gearDebugInfo(g),
  };
}

// GEAR (item system debug panel, spec §49): class, loadout, final stats, active modifiers (per source, incl. timed
// buffs) and the worn item effects with their cooldowns. Also from the console: __game.debugInfo().gear
export function gearDebugInfo(g) {
  const p = g.player, eq = g.equipment;
  if (!eq || !eq.itemModifiers) return null;
  // a modifier source is a slot id (worn item) or '<itemId>#<n>' (that item's timed buff)
  const name = (src) => { const worn = ITEMS[eq.slots[src]], buff = ITEMS[String(src).split('#')[0]]; return worn ? worn.name : buff ? buff.name + ' (buff)' : String(src); };
  return {
    classId: p.cls.id, className: p.cls.name,
    loadout: GEAR_SLOTS.map((s) => [s.label, eq.slots[s.id] ? ITEMS[eq.slots[s.id]].name : '-']),
    stats: finalStatRows(p).map(([l, v]) => [l, v]),
    modifiers: eq.itemModifiers().active().map((m) => `${name(m.source)}: ${m.value > 0 ? '+' : ''}${Math.round(m.value * 100)}% ${(MODIFIER_TYPES[m.type] || {}).label || m.type}`),
    effects: g.itemEffects ? g.itemEffects.active().map((x) => `${x.name} [${x.trigger}] ${x.running ? 'ACTIVE' : x.cooldownLeft > 0 ? 'cd ' + x.cooldownLeft.toFixed(1) + 's' : 'ready'}`) : [],
    lastFired: g.itemEffects ? g.itemEffects.log.slice(-3).map((l) => `${l.itemId} ${l.effect}`) : [],
  };
}

function drawGear(g, c) {
  const d = gearDebugInfo(g);
  if (!d) return;
  const lines = [['CURRENT CLASS', '#e0c070'], [d.className.toUpperCase(), '#fff'], ['LOADOUT', '#e0c070'],
    ...d.loadout.map(([l, n]) => [`${l.padEnd(12)} ${n}`, '#fff']), ['FINAL STATS', '#e0c070'],
    ...d.stats.map(([l, v]) => [`${l.padEnd(20)} ${v}`, '#cfe']), ['ACTIVE MODIFIERS', '#e0c070'],
    ...(d.modifiers.length ? d.modifiers : ['-']).map((m) => [m, '#d8b0ff']), ['ITEM EFFECTS', '#e0c070'],
    ...(d.effects.length ? d.effects : ['-']).map((m) => [m, '#ffd8a0'])];
  const lh = 15, w = 330, x = c.canvas.width - 310 - w - 16, y = 200; // left of the sprite validation box (bottom right)
  c.fillStyle = 'rgba(0,0,0,0.7)';
  c.fillRect(x - 8, y - 14, w + 8, lines.length * lh + 10);
  c.font = '12px monospace';
  lines.forEach(([t, col], i) => { c.fillStyle = col; c.fillText(String(t).slice(0, 46), x, y + i * lh); });
}

export function drawDebug(g, c) {
  const d = debugInfo(g), e = d.effects;
  const lines = [
    `FPS ${d.fps}   map ${d.map}  (zone ${d.zone} ${d.sub})   pos ${d.pos.join(', ')}`,
    `${d.classId}  LV ${d.level}  EXP ${d.exp}  HP ${d.hp}  ${d.resource}  gold ${d.gold}`,
    `target ${d.target}   enemies on map ${d.enemies}   boss ${d.boss}`,
    `effects: status [${e.statuses.join(', ') || '-'}]  particles ${e.particles}  proj ${e.projectiles}  tele ${e.telegraphs}  marks ${e.marks}  threads ${e.threads}  summons ${e.summons}  hazards ${e.hazards}`,
    `quests: ${d.quests.join(' · ') || '-'}  (done ${d.questsDone})`,
    `${d.time}   flags ${d.flags.join(',')}`,
    `route ${d.route}  bosses ${d.bosses}  unlocked ${d.unlocked}`,
  ];
  const H = c.canvas.height, W = c.canvas.width, rep = g.spriteReport || [];
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = 'rgba(0,0,0,0.65)';
  c.fillRect(0, H - 20 - lines.length * 18, Math.min(W, 1100), 20 + lines.length * 18);
  c.fillRect(W - 300, H - 40 - rep.length * 18, 300, 40 + rep.length * 18);
  c.font = '14px monospace';
  c.fillStyle = '#fff';
  c.fillText('SPRITE VALIDATION', W - 290, H - 22 - rep.length * 18);
  rep.forEach((r, i) => { c.fillStyle = r.ok ? '#9f9' : '#fc6'; c.fillText(`${r.name.padEnd(6)} ${r.ok ? '✓' : '⚠ ' + r.issues.join(', ')}  h${r.bodyHeight} feet±${r.feet}`, W - 290, H - 4 - (rep.length - 1 - i) * 18); });
  c.fillStyle = '#9f9';
  lines.forEach((l, i) => c.fillText(l, 10, H - 6 - (lines.length - 1 - i) * 18));
  drawGear(g, c);
  c.restore();
}
