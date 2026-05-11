import { state, pushLog, NOTES_FATAL, NOTES_WARNING } from './state.js';
import { ROOMS, ITEMS, PATIENTS, ATTENDING, VOICE } from './data.js';
import { sfx } from './audio.js';
import { endNight, observeAttending } from './world.js';
import { directionFromTo } from './map.js';

const KEY_FOR_EXIT = { 'n_exit': 'key_north', 'e_exit': 'key_east', 'w_exit': 'key_west', 's_exit': 'key_south' };

export function canPerform(action, params = {}) {
  const w = state.world;
  if (!w || w.ended) return false;
  if (state.run.ended) return false;
  const room = state.run.map.rooms[w.player.room];
  switch (action) {
    case 'move':
      if (w.player.hidden) return false;
      return state.run.map.adjacency[w.player.room].includes(params.toRoom);
    case 'look':
      if (w.player.hidden) return false;
      return state.run.map.adjacency[w.player.room].includes(params.toRoom);
    case 'listen':
      if (w.player.hidden) return false;
      return true;
    case 'hide':
      if (w.player.hidden) return false;
      return room.hiding_slots > 0;
    case 'unhide':
      return w.player.hidden;
    case 'take':
      if (w.player.hidden) return false;
      return room.items.length > 0;
    case 'read':
      if (w.player.hidden) return false;
      return room.items.some(isReadable) || state.run.inventory.some(isReadable);
    case 'wait':
      return true;
    case 'use_exit':
      if (w.player.hidden) return false;
      return room.is_exit_candidate;
  }
  return false;
}

function isReadable(itemId) {
  const it = ITEMS[itemId];
  return it && (it.effect === 'lore' || it.effect === 'reveal_exit' || it.effect === 'reveal_patrol');
}

export function performAction(action, params = {}) {
  if (!canPerform(action, params)) return { ok: false };
  const w = state.world;
  const before = { attendingRoom: w.attending.room };

  switch (action) {
    case 'move': doMove(params.toRoom); break;
    case 'look': doLook(params.toRoom); break;
    case 'listen': doListen(); break;
    case 'hide': doHide(); break;
    case 'unhide': doUnhide(); break;
    case 'take': doTake(params.itemId); break;
    case 'read': doRead(params.itemId); break;
    case 'wait': doWait(); break;
    case 'use_exit': doUseExit(); break;
  }

  if (state.run.ended) return { ok: true };

  w.time += 1;
  tickAttending();
  observeAttending();
  checkDetection();

  if (!w.ended && w.time >= w.nightLength) {
    endNight(w.player.room === state.run.map.startRoom ? 'safe_in_bed' : 'asleep_in_hall');
  }
  return { ok: true };
}

function doMove(toRoom) {
  const w = state.world;
  w.player.room = toRoom;
  const room = state.run.map.rooms[toRoom];
  room.visited = true;
  room.discovered = true;
  for (const n of state.run.map.adjacency[toRoom]) state.run.map.rooms[n].discovered = true;
  sfx('step');
  pushLog({ text: `you step into ${room.name}.`, cls: 'cls-move' });
  if (room.patient) {
    const subtitle = VOICE.subtitles[room.patient] || '';
    const seeLine = PATIENTS[room.patient]?.see_line || '';
    const first = !state.run.patientsSeen.has(room.patient);
    if (first) state.run.patientsSeen.add(room.patient);
    pushLog({ text: `[${subtitle}] ${seeLine}`, cls: 'cls-patient' + (first ? ' cls-new' : '') });
  }
  if (room.is_attending_office) {
    pushLog({ text: room.ambient, cls: 'cls-attending' });
  }
}

function doLook(toRoom) {
  const room = state.run.map.rooms[toRoom];
  state.run.map.rooms[toRoom].discovered = true;
  if (room.patient) {
    const subtitle = VOICE.subtitles[room.patient] || '';
    const seeLine = PATIENTS[room.patient]?.see_line || '';
    const first = !state.run.patientsSeen.has(room.patient);
    if (first) state.run.patientsSeen.add(room.patient);
    pushLog({ text: `[${subtitle}] ${seeLine}`, cls: 'cls-patient' + (first ? ' cls-new' : '') });
  } else if (room.items.length > 0) {
    const itemNames = room.items.map(id => ITEMS[id]?.name || id).join(', ');
    pushLog({ text: `you peek into ${room.name}. on the desk: ${itemNames}.`, cls: 'cls-action' });
  } else {
    pushLog({ text: `you peek into ${room.name}. ${room.ambient_empty}`, cls: 'cls-action' });
  }
}

function doListen() {
  const w = state.world;
  const me = state.run.map.rooms[w.player.room];
  const att = state.run.map.rooms[w.attending.room];
  const sameRoom = w.attending.room === w.player.room;
  const oneHop = state.run.map.adjacency[w.player.room].includes(w.attending.room);

  let twoHop = false;
  if (!sameRoom && !oneHop) {
    for (const adj of state.run.map.adjacency[w.player.room]) {
      if (state.run.map.adjacency[adj].includes(w.attending.room)) { twoHop = true; break; }
    }
  }

  if (sameRoom) {
    pushLog({ text: VOICE.attending.approach_here || 'the door opens.', cls: 'cls-listen cls-warning' });
  } else if (oneHop) {
    const dir = directionFromTo(state.run.map, w.player.room, w.attending.room);
    const tmpl = VOICE.attending[`approach_${dir}`] || `footsteps from ${dir}.`;
    pushLog({ text: tmpl, cls: 'cls-listen cls-warning' });
  } else if (twoHop) {
    const dir = directionFromTo(state.run.map, w.player.room, w.attending.room);
    pushLog({ text: `distant footsteps, ${dir}.`, cls: 'cls-listen' });
  } else {
    pushLog({ text: 'the corridor is quiet.', cls: 'cls-listen' });
  }
}

function doHide() {
  const w = state.world;
  w.player.hidden = true;
  w.player.hidingSpotName = pick_hiding_name(state.run.map.rooms[w.player.room].archetype);
  sfx('hide');
  pushLog({ text: `you hide ${w.player.hidingSpotName}.`, cls: 'cls-action' });
}

function pick_hiding_name(archetype) {
  if (archetype === 'ward') return 'under the bed';
  if (archetype === 'supply') return 'behind the shelves';
  if (archetype === 'office') return 'in the kneehole of the desk';
  if (archetype === 'records') return 'between the cabinets';
  if (archetype === 'dayroom') return 'behind the television';
  if (archetype === 'chapel') return 'in the confessional';
  if (archetype === 'stairwell') return 'beneath the stairs';
  if (archetype === 'attending_office') return 'inside the file cabinet';
  if (archetype === 'bed') return 'in your bed';
  return 'in a corner';
}

function doUnhide() {
  state.world.player.hidden = false;
  state.world.player.hidingSpotName = null;
  pushLog({ text: 'you come out.', cls: 'cls-action' });
}

function doTake(itemId) {
  const room = state.run.map.rooms[state.world.player.room];
  let id = itemId || room.items[0];
  const idx = room.items.indexOf(id);
  if (idx < 0) return;
  room.items.splice(idx, 1);
  state.run.inventory.push(id);
  sfx('take');
  const it = ITEMS[id];
  pushLog({ text: `you take ${it?.name || id}.`, cls: 'cls-take' });
  if (it?.effect === 'reveal_exit') {
    state.run.realExitKnown = true;
    const exitRoom = state.run.map.rooms[state.run.realExit];
    pushLog({ text: it.prose.replace('{exit_name}', exitRoom?.name || ''), cls: 'cls-read' });
  } else if (it?.effect === 'reveal_patrol') {
    state.run.patrolKnown = true;
    pushLog({ text: it.prose, cls: 'cls-read' });
  } else if (it?.effect === 'lore') {
    pushLog({ text: it.prose, cls: 'cls-read' });
  }
  if (room.is_attending_office) {
    addNote('note_caught_attending_office', { room: room.name });
  }
}

function doRead(itemId) {
  let id = itemId;
  if (!id) {
    id = state.run.inventory.find(isReadable) || state.run.map.rooms[state.world.player.room].items.find(isReadable);
  }
  if (!id) return;
  const it = ITEMS[id];
  const exitRoom = state.run.map.rooms[state.run.realExit];
  pushLog({ text: it.prose.replace('{exit_name}', exitRoom?.name || ''), cls: 'cls-read' });
}

function doWait() {
  pushLog({ text: 'you wait.', cls: 'cls-action' });
}

function doUseExit() {
  const w = state.world;
  const room = state.run.map.rooms[w.player.room];
  const keyNeeded = KEY_FOR_EXIT[room.id];
  const hasKey = keyNeeded ? state.run.inventory.includes(keyNeeded) : true;
  const isReal = room.id === state.run.realExit;

  if (!hasKey) {
    pushLog({ text: VOICE.events.exit_attempt_locked, cls: 'cls-event' });
    addNote('note_door', { door: room.name });
    return;
  }
  if (!isReal) {
    pushLog({ text: VOICE.events.exit_attempt_wrong, cls: 'cls-event' });
    addNote('note_door', { door: room.name });
    return;
  }
  pushLog({ text: VOICE.events.exit_attempt_right, cls: 'cls-win' });
  sfx('escape');
  state.run.ended = true;
  state.run.outcome = 'escaped';
  state.world.ended = true;
  state.world.endReason = 'escaped';
}

function tickAttending() {
  const w = state.world;
  if (!w) return;
  const a = w.attending;
  a.moveTimer += 1;
  if (a.moveTimer >= a.speed) {
    a.moveTimer = 0;
    a.routeIdx = (a.routeIdx + 1) % a.route.length;
    a.room = a.route[a.routeIdx];
  }
}

function checkDetection() {
  const w = state.world;
  if (w.ended) return;
  if (w.attending.room !== w.player.room) return;
  if (w.player.hidden) {
    pushLog({ text: VOICE.attending.passes_through, cls: 'cls-attending' });
    return;
  }
  const room = state.run.map.rooms[w.player.room];
  let noteKey = 'note_caught_hallway';
  if (room.archetype === 'ward') {
    noteKey = 'note_caught_ward';
  } else if (room.archetype === 'supply') noteKey = 'note_caught_supply';
  else if (room.archetype === 'office') noteKey = 'note_caught_office';
  else if (room.archetype === 'records') noteKey = 'note_caught_records';
  else if (room.archetype === 'attending_office') noteKey = 'note_caught_attending_office';
  const ctx = { room: room.name, patient: room.patient ? `[${VOICE.subtitles[room.patient]}]` : '[empty]' };
  addNote(noteKey, ctx);
  sfx('caught');
  endNight('caught');
}

function addNote(noteKey, ctx = {}) {
  state.run.notes += 1;
  if (state.world) state.world.notesThisNight = (state.world.notesThisNight || 0) + 1;
  let text = VOICE.attending[noteKey] || 'a note is added to your file.';
  for (const [k, v] of Object.entries(ctx)) text = text.split('{' + k + '}').join(v);
  state.run.fileNotes = state.run.fileNotes || [];
  state.run.fileNotes.push({ night: state.world?.night || state.run.night, text });
  pushLog({ text: 'NOTE: ' + text, cls: 'cls-note' });
  if (state.run.notes >= NOTES_FATAL) {
    state.run.ended = true;
    state.run.outcome = 'admitted';
    if (state.world) state.world.ended = true;
  }
}
