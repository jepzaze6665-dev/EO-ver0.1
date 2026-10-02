// ONLINE rules (data). Shared by the browser and the server (server/cityRooms.js), so pure data only.
//
// SHARED ROOMS (N2): the cities everyone sees together. A shared room = a map of type 'city' that is not secret
// (tools/tests/online.test.mjs checks this list against maps/mapRegistry.js). Valehaven (secret city inside A1) stays
// part of the dungeon run (owner). Players on any other map are in no shared room (their own instance later, N6).
import { PARTY } from './party.js';

export const ONLINE = {
  sharedMaps: ['lumina', 'city2'],
  sendRate: 10,            // position updates per second (only when something changed)
  idleResend: 2,           // s: resend an unchanged position this often (late joiners / lost packets)
  serverTick: 10,          // server batches room movement this many times per second
  interpDelay: 0.12,       // s: remote players are drawn this far in the past, between two snapshots
  maxSpeed: 340,           // px/s a player can move in a city (walk ×1.08 + dash); faster = treated as a teleport (snap)
  leaveFade: 0.6,          // s: a player who leaves / goes offline fades out
  nameRange: 260,          // px: remote player names are shown within this distance
  maxRoomPlayers: 60,      // N2 cap per room (a full room refuses new players with 'roomFull' — they still play alone)
  // N4 ONLINE PARTY (server/parties.js). Not the in-world PartySystem (party/partySystem.js: downed / revive): this is who
  // plays together; N6 puts these members into the same dungeon, where the in-world party takes over.
  party: {
    maxSize: PARTY.maxSize,   // 4
    inviteTimeout: 60,        // s an invite stays open
    offlineGrace: 120,        // s a disconnected member keeps its place (reconnect window), then it is removed
    leaderInvitesOnly: true,  // only the leader invites (inviting while not in a party creates one)
  },
  // N7a SHARED MONSTERS (src/net/mobSync.js): the run-map host sends snapshots of monsters near any member
  mobs: {
    rate: 10,                 // snapshots per second (only changed monsters)
    fullEvery: 2,             // s: every nearby monster again (late joiners, despawns)
    range: 1100,              // px from any member: monsters further away are not sent (unless in a fight)
    maxRows: 120,             // = NET_LIMITS.maxMobRows
  },
  // N5 DUNGEON GATE (server/dungeons.js, panels.dungeonGate). The areas the gate can send you to = the route field maps
  // (tools/tests/dungeonGate.test.mjs checks the list against maps/mapRegistry.js: every non-secret 'field' map, `free`
  // exactly when the map has no requirement). A locked area cannot be entered; the server checks every member.
  // Arenas / secret maps are never listed: they are reached on foot inside a run (exploration and secrets stay).
  dungeon: {
    areas: [
      { id: 'a1', free: true }, { id: 'a2' }, { id: 'a3' },
      { id: 'b1', free: true }, { id: 'b2' }, { id: 'b3' },
    ],
    readyTimeout: 30,         // s the party has to accept before the entry is cancelled
    reconnectGrace: 120,      // N6: s a disconnected member stays in the run (reload / line drop), then removed
    returnOffset: [2, 0],     // N6: the 'Return to the city' stone stands this many tiles from each area's spawn
  },
};

export const dungeonArea = (id) => ONLINE.dungeon.areas.find((a) => a.id === id) || null;

export const isSharedMap = (mapId) => ONLINE.sharedMaps.includes(mapId);
