import { state, resetRun, TOTAL_NIGHTS } from './state.js';
import { buildMap, placePatients, placeItems, chooseRealExit } from './map.js';
import { startNight as worldStartNight, endNight as worldEndNight } from './world.js';

export function startRun() {
  resetRun();
  const map = buildMap();
  placePatients(map);
  placeItems(map);
  const realExit = chooseRealExit(map);
  state.run = {
    map,
    realExit,
    night: 1,
    totalNights: TOTAL_NIGHTS,
    notes: 0,
    fileNotes: [],
    inventory: [],
    patientsSeen: new Set(),
    realExitKnown: false,
    patrolKnown: false,
    ended: false,
    outcome: null,
  };
}

export function beginNight() {
  worldStartNight(state.run.night);
}

export function finishNight() {
  if (!state.world) return;
  if (state.run.ended) return;
  state.run.night += 1;
  if (state.run.night > TOTAL_NIGHTS) {
    state.run.ended = true;
    state.run.outcome = state.run.outcome || 'admitted';
  }
}

export function isRunOver() {
  return !state.run || state.run.ended;
}
