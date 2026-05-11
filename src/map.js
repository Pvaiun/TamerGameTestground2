import { LAYOUT, ROOMS, ITEMS, PATIENTS } from './data.js';
import { pick, shuffleInPlace } from './rng.js';

export function buildMap() {
  const map = {
    rooms: {},
    adjacency: {},
    exits: [],
    startRoom: null,
    attendingOffice: null,
    recordsRoom: null,
  };
  for (const r of LAYOUT.rooms) {
    const arch = ROOMS[r.archetype] || {};
    const room = {
      id: r.id,
      archetype: r.archetype,
      name: r.name || arch.name || r.id,
      x: r.x,
      y: r.y,
      ambient: arch.ambient || '',
      ambient_empty: arch.ambient_empty || arch.ambient || '',
      hiding_slots: arch.hiding_slots || 0,
      forbidden: !!arch.forbidden,
      safe: !!arch.safe,
      exposed: !!arch.exposed,
      is_exit_candidate: !!arch.is_exit_candidate,
      is_attending_office: !!arch.is_attending_office,
      has_records: !!arch.has_records,
      patient: null,
      items: [],
      discovered: false,
      visited: false,
    };
    map.rooms[r.id] = room;
    if (arch.is_start) map.startRoom = r.id;
    if (arch.is_attending_office) map.attendingOffice = r.id;
    if (arch.has_records) map.recordsRoom = r.id;
    if (arch.is_exit_candidate) map.exits.push(r.id);
  }
  for (const r of LAYOUT.rooms) map.adjacency[r.id] = [];
  for (const [a, b] of LAYOUT.edges) {
    map.adjacency[a].push(b);
    map.adjacency[b].push(a);
  }
  return map;
}

export function placePatients(map) {
  const patientRooms = Object.values(map.rooms).filter(r => {
    const arch = ROOMS[r.archetype];
    return arch && arch.patient_allowed;
  });
  const species = shuffleInPlace(Object.keys(PATIENTS));
  for (let i = 0; i < patientRooms.length && i < species.length; i++) {
    patientRooms[i].patient = species[i];
  }
}

export function placeItems(map) {
  const all = Object.values(ITEMS);
  for (const item of all) {
    if (item.unique) {
      const candidates = Object.values(map.rooms).filter(r => roomMatchesSpawn(r, item.spawn));
      if (candidates.length === 0) continue;
      const room = pick(candidates);
      room.items.push(item.id);
    } else if (item.stackable) {
      const candidates = Object.values(map.rooms).filter(r => roomMatchesSpawn(r, item.spawn));
      if (candidates.length === 0) continue;
      const count = 1 + Math.floor(Math.random() * 2);
      const chosen = shuffleInPlace([...candidates]).slice(0, count);
      for (const r of chosen) r.items.push(item.id);
    }
  }
}

function roomMatchesSpawn(room, rule) {
  if (rule === 'any') return true;
  return room.archetype === rule;
}

export function chooseRealExit(map) {
  return pick(map.exits);
}

export function neighbors(map, roomId) {
  return map.adjacency[roomId] || [];
}

export function directionFromTo(map, fromId, toId) {
  const from = map.rooms[fromId];
  const to = map.rooms[toId];
  if (!from || !to) return 'unknown';
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'east' : 'west';
  if (dy !== 0) return dy > 0 ? 'south' : 'north';
  return 'nearby';
}
