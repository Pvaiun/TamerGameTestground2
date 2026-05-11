import { state, pushLog, TOTAL_ROOMS, COMPILE_ROOMS, resetRun } from './state.js';
import { STARTERS, PATIENTS } from './data.js';
import { makeCard } from './card.js';
import { shuffleInPlace } from './rng.js';

export function startRun(starterId) {
  resetRun();
  const def = STARTERS[starterId];
  if (!def) throw new Error('Unknown starter: ' + starterId);
  state.run = {
    starter: starterId,
    starterDef: def,
    roomIdx: 0,
    rooms: generateRunMap(),
    deck: def.deck.map(id => makeCard(id)),
    fileCap: def.fileCap,
    absorbed: [],
    diagnoses: [],
    seenPatients: new Set(),
    skippedCompileRooms: 0,
  };
}

function generateRunMap() {
  const all = Object.values(PATIENTS).filter(p => !p.isBoss);
  const pool1 = all.filter(p => p.difficulty === 1).map(p => p.species);
  const pool2 = all.filter(p => p.difficulty === 2).map(p => p.species);
  const pool3 = all.filter(p => p.difficulty === 3).map(p => p.species);
  shuffleInPlace(pool1); shuffleInPlace(pool2); shuffleInPlace(pool3);

  const used = new Set();
  const pickFrom = pool => {
    for (const s of pool) if (!used.has(s)) { used.add(s); return s; }
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const rooms = [];
  for (let i = 1; i <= TOTAL_ROOMS; i++) {
    if (i === TOTAL_ROOMS) {
      rooms.push({ kind: 'boss', speciesId: 'the_attending' });
    } else if (COMPILE_ROOMS.has(i)) {
      rooms.push({ kind: 'compile' });
    } else {
      const tier = i <= 2 ? 1 : i <= 5 ? 2 : 3;
      const pool = tier === 1 ? pool1 : tier === 2 ? pool2 : pool3;
      rooms.push({ kind: 'battle', speciesId: pickFrom(pool) });
    }
  }
  return rooms;
}

export function currentRoom() {
  if (!state.run) return null;
  return state.run.rooms[state.run.roomIdx];
}

export function advanceToNextRoom() {
  if (!state.run) return;
  state.run.roomIdx += 1;
}

export function isRunOver() {
  if (!state.run) return true;
  return state.run.roomIdx >= TOTAL_ROOMS;
}

export function addAbsorbedCard(cardId) {
  if (!state.run) return;
  state.run.absorbed.push(cardId);
  state.run.deck.push(makeCard(cardId));
  state.run.deck.push(makeCard('taint'));
}

export function skipAbsorption() {
  // no card, no taint
}
