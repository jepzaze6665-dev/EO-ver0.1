// V2.1 TEST CHECKLIST (spec §41, TEST 1-31) — one run through the vertical slice with the real systems:
//   const L = await import('/tools/checklist.js'); L.runChecklist(__game, 'astral_weaver')
// Returns rows [n, name, pass, detail]; console.table(rows) prints them. Real controls are used where possible
// (held keys, Tab, left click, skill keys, exits); jumps between distant places use teleports (the testkit's goto),
// and the boss is fought by the test bot in god mode at LV 10 like the playthrough.
// TEST 30 "reload" rebuilds the whole session from nothing (boot) — the real page-reload variant was verified in
// Phase 14 (save -> F5 -> load gives the identical state).
import { goto, use, bot, releaseInput } from './testkit.js';

const TILE = 32;
const hold = (g, key, sec, each) => { g.input.down.add(key); g.simulate(sec, each); g.input.down.delete(key); };
const press = (g, key) => { g.input.pressedKeys.add(key); g.handleGlobalKeys(); g.simulate(1 / 60); };

export function runChecklist(g, classId = 'umbral_sword') {
  const rows = [];
  let n = 0;
  const ok = (name, pass, detail = '') => { rows.push([++n, name, !!pass, String(detail)]); return !!pass; };
  const ev = {};
  const count = (name) => { ev[name] = []; g.events.on(name, (e) => ev[name].push(e)); };

  ok('Game opens', !!g && !!g.world && !!g.player && ['title', 'play'].includes(g.state), g.state);
  g.newGame(classId);
  ['damageDealt', 'skillUsed', 'skillFailed', 'enemyDefeated', 'expGained', 'goldChanged', 'lootDropped', 'itemCollected',
    'questUpdated', 'questCompleted', 'mapEntered', 'npcTalked', 'targetChanged', 'resourceChanged', 'bossDefeated'].forEach(count);
  const w = () => g.world, p = g.player;
  ok('Player spawns in Lumina Village', w().mapId === 'lumina' && w().mapManager.idAt(p.x, p.y) === 'lumina', w().mapId);

  // 3-4 movement + collision
  releaseInput(g);
  const x0 = p.x; hold(g, 'KeyD', 0.5);
  ok('Player walks', Math.abs(p.x - x0) > 20, `moved ${Math.round(p.x - x0)} px`);
  goto(g, 33, 177); // south of the Adventurer Guild (building tiles 31-35 × 171-174)
  let inWall = false;
  hold(g, 'KeyW', 1.5, () => { if (w().map.isSolid(Math.floor(p.x / TILE), Math.floor(p.y / TILE))) inWall = true; });
  ok('Collision stops the player at a wall', !inWall && p.y > 174.5 * TILE, `y=${(p.y / TILE).toFixed(1)}`);

  // 5-6 guide + quest
  use(g, 'npc_guide'); g.ui.panels.close(true);
  ok('Talk to the Village Guide', ev.npcTalked.some((e) => e.id === 'guide'));
  use(g, 'npc_elder'); g.ui.panels.dialogueAction('quest:whispers');
  ok('Quest accepted', g.quests.isActive('beyond_lumina') && g.quests.active.beyond_lumina.done.talk && g.quests.isActive('whispers'));

  // 7 walk out to A1
  goto(g, 47.5, 163); hold(g, 'KeyW', 1.6);
  ok('Walk out to A1', w().mapId === 'a1', w().mapId);

  // 8-18 first fight in A1
  goto(g, 38, 121); g.simulate(0.3);
  const foes = w().hostiles().filter((m) => w().monsters.includes(m));
  ok('Monsters found in A1', foes.length > 0, `${foes.length} on the map`);
  press(g, 'Tab');
  const target = g.targets.current;
  ok('Target a monster (Tab)', !!target, target ? target.name : '-');
  const start = { lv: p.level, exp: p.exp, gold: p.gold, items: Object.values(g.inventory.items).reduce((a, b) => a + b, 0), res: p.resources.get(p.primaryResource) };
  g.simulate(3, (gg, i) => bot(gg, i, { god: true }));
  const basic = ev.damageDealt.filter((e) => e.source === p && !e.skillId);
  ok('Attack a monster', basic.length > 0 || ev.damageDealt.some((e) => e.source === p), `${ev.damageDealt.filter((e) => e.source === p).length} hits`);
  // skill + resource + cooldown through the real skill pipeline
  releaseInput(g); g.simulate(0.3); // end the bot's action / guard first
  const skill = p.cls.skills.find((s) => (s.cooldown || 0) > 1 && !s.ultimate) || p.cls.skills[0];
  p.resources.set(p.primaryResource, p.resources.max(p.primaryResource));
  // monsters may still be mid-attack: each try starts from a free player (not hurt, no action / guard / stun)
  const free = () => { p.hurtT = 0; p.endAction(true); p.setGuard(false); p.status.remove('guard_broken'); p.status.remove('stun'); };
  p.skillSys.cooldowns.clear(skill.id); g.combat.lastCombatTime = g.time; free();
  const used = p.trySkill(skill); g.simulate(0.1);
  ok('Use a class skill', used && ev.skillUsed.some((e) => e.caster === p), skill.id);
  ok('Resource system works', ev.resourceChanged.some((e) => e.entity === p), `${p.primaryResource} changes: ${ev.resourceChanged.filter((e) => e.entity === p).length}`);
  g.simulate(1); // let the cast finish (a skill can't be used mid-action either)
  free(); const again = p.trySkill(skill);
  ok('Cooldown blocks a second cast', !again && ev.skillFailed.some((e) => e.reason === 'cooldown'), `${skill.id} cd ${skill.cooldown}s`);
  releaseInput(g);
  for (const [x, y] of [[38, 121], [20, 112], [22, 131], [47, 144]]) {
    if (g.quests.active.beyond_lumina && g.quests.active.beyond_lumina.done.hunt) break;
    goto(g, x, y); g.simulate(25, (gg, i) => { if (!(g.quests.active.beyond_lumina && g.quests.active.beyond_lumina.done.hunt)) bot(gg, i, { god: true }); });
  }
  const kills = ev.enemyDefeated.filter((e) => !e.boss);
  ok('Monster dies', kills.length > 0, `${kills.length} defeated`);
  ok('EXP gained', ev.expGained.length > 0 && (p.level > start.lv || p.exp > start.exp), `LV${start.lv}→${p.level}`);
  ok('Gold gained', p.gold > start.gold, `${start.gold}→${p.gold}`);
  const items = Object.values(g.inventory.items).reduce((a, b) => a + b, 0);
  ok('Loot gained', ev.lootDropped.some((e) => e.items.length) || items > start.items, `items ${start.items}→${items}`);
  ok('Quest objective updates', ev.questUpdated.some((e) => e.id === 'beyond_lumina') && g.quests.active.beyond_lumina.done.hunt);

  // 19-21 through A1 (W2: one map from the forest edge to the ruins) -> the Guardian Arena
  releaseInput(g); goto(g, 50, 101.5); hold(g, 'KeyW', 1.2);
  ok('Walk across the river (Deep Forest, A1)', w().mapId === 'a1' && p.y < 98 * 32, w().mapId);
  releaseInput(g); goto(g, 90, 71); hold(g, 'KeyD', 2.2);
  ok('Walk the Ancient Path into the Ruins (A1)', w().mapId === 'a1' && w().currentZone === 3, `${w().mapId} zone=${w().currentZone}`);
  use(g, 'ancient_shrine'); g.ui.panels.close(true); use(g, 'gate_seal'); g.ui.panels.close(true);
  releaseInput(g); goto(g, 135, 51); hold(g, 'KeyW', 1);
  const asked = g.ui.panels.current && g.ui.panels.current.name === 'confirm';
  if (asked) g.ui.panels.current.advance(); // "Enter"
  g.simulate(0.3);
  ok('Enter the Major Boss Arena (asks first)', asked && w().mapId === 'arena', `asked=${asked} map=${w().mapId}`);

  // 22-26 boss
  p.setLevel(10); p.hp = p.maxHp;
  goto(g, 135, 37); g.simulate(3);
  const gd = w().guardian;
  ok('Boss spawns and wakes', gd && !gd.dead && w().bossActive && gd.state !== 'dormant', gd && gd.state);
  g.simulate(2.5);
  ok('Boss HP UI shows', g.ui.hud.bossBar && w().boss === gd && gd.hudState().maxHp === gd.maxHp, gd.hudState().name);
  const bossHp0 = gd.hp, goldBefore = p.gold;
  for (let s = 0; s < 80 && !gd.dead; s++) g.simulate(5, (gg, i) => bot(gg, i, { god: true }));
  ok('Boss combat (damage both ways)', bossHp0 > 0 && ev.damageDealt.some((e) => e.target === gd) && ev.damageDealt.some((e) => e.target === p && e.source === gd));
  ok('Boss defeated', gd.dead);
  g.simulate(9);
  ok('Boss reward received (once)', ev.enemyDefeated.filter((e) => e.boss && e.type === 'guardian').length === 1 && g.inventory.has('guardian_heart') && p.gold > goldBefore, `gold +${p.gold - goldBefore}`);

  // 27-28 back to Lumina (waystone teleport), report
  g.teleportTo('ws_village'); g.simulate(0.3);
  ok('Return to Lumina Village', w().mapId === 'lumina', w().mapId);
  use(g, 'npc_elder'); g.ui.panels.close(true); use(g, 'npc_guide'); g.ui.panels.close(true);
  ok('Quests complete', g.quests.isDone('whispers') && g.quests.isDone('beyond_lumina'), Object.keys(g.quests.completed).join(','));

  // 29-31 save, "reload" (fresh session), load
  const snap = () => JSON.stringify({ c: p.cls.id, lv: g.player.level, exp: g.player.exp, gold: g.player.gold, map: g.world.mapId, inv: g.inventory.items, done: Object.keys(g.quests.completed).sort(), flags: Object.keys(g.world.state.flags).sort() });
  const before = snap();
  ok('Save', g.save.save(), g.save.lastError || '');
  g.boot();
  ok('Reload (fresh session)', g.state === 'title' && g.player.level === 1, `state=${g.state}`);
  const loaded = g.loadGame();
  const after = JSON.stringify({ c: g.player.cls.id, lv: g.player.level, exp: g.player.exp, gold: g.player.gold, map: g.world.mapId, inv: g.inventory.items, done: Object.keys(g.quests.completed).sort(), flags: Object.keys(g.world.state.flags).sort() });
  ok('Load Game: progress is back', loaded && after === before, loaded ? (after === before ? 'identical' : `${before} != ${after}`) : g.save.lastError);
  return rows;
}
