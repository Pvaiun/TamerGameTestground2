import { state, NIGHT_LENGTH } from './state.js';
import { ATTENDING } from './data.js';

export function startNight(night) {
  const nightDef = ATTENDING.nights.find(n => n.night === night) || ATTENDING.nights[ATTENDING.nights.length - 1];
  state.world = {
    night,
    time: 0,
    nightLength: NIGHT_LENGTH,
    player: {
      room: state.run.map.startRoom,
      hidden: false,
      hidingSpotName: null,
    },
    attending: {
      room: nightDef.route[0],
      route: nightDef.route,
      routeIdx: 0,
      speed: nightDef.speed || 2,
      moveTimer: 0,
      lastSeenRoom: null,
      lastSeenTime: -999,
    },
    notesThisNight: 0,
    ended: false,
    endReason: null,
  };
  const room = state.run.map.rooms[state.world.player.room];
  room.visited = true;
  room.discovered = true;
  for (const n of state.run.map.adjacency[state.world.player.room]) {
    state.run.map.rooms[n].discovered = true;
  }
  observeAttending();
}

export function endNight(reason) {
  if (state.world) {
    state.world.ended = true;
    state.world.endReason = reason;
  }
}

export function observeAttending() {
  const w = state.world;
  if (!w) return;
  const pRoom = w.player.room;
  const aRoom = w.attending.room;
  if (aRoom === pRoom || state.run.map.adjacency[pRoom].includes(aRoom)) {
    w.attending.lastSeenRoom = aRoom;
    w.attending.lastSeenTime = w.time;
  }
}

export function attendingVisible() {
  const w = state.world;
  if (!w) return false;
  return w.attending.lastSeenRoom && (w.time - w.attending.lastSeenTime) <= 3;
}
