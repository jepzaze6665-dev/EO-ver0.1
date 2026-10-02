// ONLINE dev helpers for testing with several browser tabs (console of each tab, page loaded, server running):
//   const O = await import('/tools/onlineKit.js');
//   await O.login(__game, 'Name One', 'umbral_sword')   // (re)connect under a name + New Game in Lumina
//   await O.createParty(__game)                          // tab A: open party at the gate
//   await O.joinParty(__game)                            // tab B: join the first open party here
//   await O.propose(__game, 'a1')                        // leader: ask the party to enter
//   await O.accept(__game)                               // member: accept the ready check
//   await O.tick(__game, 2)                              // run 2 s of game in real time (hidden tabs do not animate)
// Names live on the server (server/data/accounts.json) and their token in this browser ORIGIN: on another port use new names.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 5000) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) return false; await wait(50); } return true; };

export async function login(g, name, classId = 'umbral_sword') {
  await until(() => g.state === 'title' || g.state === 'play');
  const on = g.online;
  if (g.state === 'play') g.toTitle();
  on.logout();
  on.connect(name);
  if (!(await until(() => on.saveReady || on.state === 'offline'))) return { ok: false, why: 'timeout' };
  if (!on.saveReady) return { ok: false, why: on.net.lastError && on.net.lastError.text };
  g.newGame(classId);
  await tick(g, 0.3);
  return { ok: true, name: on.playerName, map: g.world.mapId };
}
export async function createParty(g) { g.online.partyAction('partyCreate'); await until(() => g.online.party); return !!g.online.party; }
export async function joinParty(g) {
  const on = g.online;
  on.openParties = []; on.net.send('partyList', {});
  if (!(await until(() => on.openParties.length))) return false;
  on.partyAction('partyJoin', { party: on.openParties[0].id });
  return until(() => on.party);
}
export async function propose(g, area = 'a1') { g.online.net.send('dungeonPropose', { area }); return until(() => g.online.check); }
export async function accept(g) {
  const on = g.online;
  if (!(await until(() => on.check))) return false;
  on.net.send('dungeonAnswer', { check: on.check.check, yes: true });
  return until(() => on.instance);
}
// real-time simulation: also lets network messages in between steps
export async function tick(g, sec = 1, step = 0.1) { for (let t = 0; t < sec; t += step) { g.simulate(step); await wait(step * 1000); } }
