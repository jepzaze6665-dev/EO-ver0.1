// ONLINE rules (data). Shared by the browser and the server (server/cityRooms.js), so pure data only.
//
// SHARED ROOMS (N2): the cities everyone sees together. A shared room = a map of type 'city' that is not secret
// (tools/tests/online.test.mjs checks this list against maps/mapRegistry.js). Valehaven (secret city inside A1) stays
// part of the dungeon run (owner). Players on any other map are in no shared room (their own instance later, N6).
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
};

export const isSharedMap = (mapId) => ONLINE.sharedMaps.includes(mapId);
