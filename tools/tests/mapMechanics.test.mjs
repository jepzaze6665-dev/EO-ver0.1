// Unit tests for the map mechanic foundation (M0). Run:  node tools/tests/mapMechanics.test.mjs
import { MapMechanicSystem, MapMechanic, registerMapMechanic, MAP_MECHANICS } from '../../src/world/mapMechanics.js';
import { validateClientMessage, encode } from '../../src/net/protocol.js';
import { MAPS } from '../../src/maps/mapRegistry.js';
import '../../src/world/mechanics/index.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

// a test-only mechanic: counts, keeps a value in the save, syncs a number, takes a guest event
const log = [];
class Probe extends MapMechanic {
  enter() { log.push('enter:' + this.mapId); this.n = 0; this.saved.visits = (this.saved.visits || 0) + 1; }
  exit() { log.push('exit:' + this.mapId); }
  reset() { log.push('reset'); this.n = 0; }
  update(dt) { if (this.authority) { this.n += dt; this.markNet(); } }
  hudTags() { return [{ label: 'PROBE', color: '#fff' }]; }
  netState() { return { n: this.n }; }
  netApply(s) { this.n = s.n; }
  netEvent(k, d, from) { log.push(`evt:${k}:${d && d.v}:${from}`); }
}
registerMapMechanic('probe_test', Probe);

const make = (host = true) => {
  const maps = { m1: { id: 'm1', mechanics: [{ type: 'probe_test' }] }, m2: { id: 'm2' } };
  const world = { state: {}, mapManager: { get: (id) => maps[id] }, game: { online: { mobs: { host } } } };
  return { world, sys: new MapMechanicSystem(world) };
};

console.log('map mechanics');
test('enter builds only the current map\'s mechanics; leaving exits them', () => {
  log.length = 0;
  const { sys } = make();
  sys.enterMap('m1'); eq(sys.list.length, 1); ok(sys.get('probe_test'), 'get by type');
  sys.enterMap('m2'); eq(sys.list.length, 0);
  eq(log.join(','), 'enter:m1,exit:m1');
});
test('update / reset / hud tags', () => {
  log.length = 0;
  const { sys } = make();
  sys.enterMap('m1'); sys.update(0.5);
  eq(sys.list[0].n, 0.5); sys.reset(); eq(sys.list[0].n, 0); eq(sys.hudTags()[0].label, 'PROBE');
});
test('saved data lives in world.state.mapMech and survives re-entry', () => {
  const { sys, world } = make();
  sys.enterMap('m1'); sys.enterMap('m2'); sys.enterMap('m1');
  eq(world.state.mapMech.m1['0:probe_test'].visits, 2);
  ok(JSON.stringify(world.state).length > 0, 'plain JSON');
});
test('net: host states only when dirty (or forced); guest applies; other map ignored', () => {
  const host = make(true), guest = make(false);
  host.sys.enterMap('m1'); guest.sys.enterMap('m1');
  host.sys.update(1.25);
  const s = host.sys.netStates(false); ok(s && s[0].n === 1.25, 'dirty state sent');
  eq(host.sys.netStates(false), null, 'nothing new');
  ok(host.sys.netStates(true), 'forced resend');
  guest.sys.update(1); eq(guest.sys.list[0].n, 0, 'guest does not run the rules');
  guest.sys.netApply('m2', s); eq(guest.sys.list[0].n, 0, 'wrong map ignored');
  guest.sys.netApply('m1', s); eq(guest.sys.list[0].n, 1.25);
});
test('net: guest events go out; only the host handles them', () => {
  log.length = 0;
  const host = make(true), guest = make(false), sent = [];
  host.sys.enterMap('m1'); guest.sys.enterMap('m1');
  guest.sys.net = { sendEvent: (...a) => sent.push(a) };
  guest.sys.list[0].send('lever', { v: 3 });
  eq(sent.length, 1); eq(sent[0][0], 'm1');
  guest.sys.netEvent('m1', 0, 'lever', { v: 3 }, 'p2'); ok(!log.some((l) => l.startsWith('evt')), 'guest ignores');
  host.sys.netEvent(...sent[0], 'p2'); ok(log.includes('evt:lever:3:p2'), 'host got it');
  host.sys.list[0].send('self', { v: 1 }); ok(log.includes('evt:self:1:null'), 'host acts on its own event at once');
});
test('protocol: mapm / mapEvt validate', () => {
  ok(validateClientMessage(encode('mapm', { m: 'a1', s: { 0: { n: 1, list: [[1, 2]] } } })).ok, 'mapm');
  ok(validateClientMessage(encode('mapEvt', { m: 'a1', i: 0, k: 'lever', d: { v: 1 } })).ok, 'mapEvt');
  ok(!validateClientMessage(encode('mapEvt', { m: 'a1', i: 'x', k: 'lever', d: null })).ok, 'bad index');
});
test('data: every map mechanic type named by a map is registered', () => {
  for (const m of MAPS) for (const d of m.mechanics || []) ok(MAP_MECHANICS[d.type], `${m.id}: ${d.type}`);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
