import { VERSION } from './version.js';

const KEY = 'bloodlines.archive.v1';

const DEFAULT_ARCHIVE = () => ({
  version: VERSION,
  patientsEncountered: [],
  diagnosesDiscovered: [],
  runsCompleted: 0,
  runsAdmitted: 0,
  totalAbsorptions: 0,
  bestRoomReached: 0,
  cardsSeen: [],
});

let cache = null;

export function getArchive() {
  if (!cache) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        cache = { ...DEFAULT_ARCHIVE(), ...parsed };
      } else {
        cache = DEFAULT_ARCHIVE();
      }
    } catch (e) {
      cache = DEFAULT_ARCHIVE();
    }
  }
  return cache;
}

export function saveArchive() {
  try { localStorage.setItem(KEY, JSON.stringify(getArchive())); } catch (e) {}
}

export function recordPatient(speciesId) {
  const a = getArchive();
  if (!a.patientsEncountered.includes(speciesId)) {
    a.patientsEncountered.push(speciesId);
    saveArchive();
  }
}

export function recordDiagnosis(name, notes) {
  const a = getArchive();
  if (!a.diagnosesDiscovered.find(d => d.name === name)) {
    a.diagnosesDiscovered.push({ name, notes });
    saveArchive();
  }
}

export function recordAbsorption(cardId) {
  const a = getArchive();
  a.totalAbsorptions += 1;
  if (cardId && !a.cardsSeen.includes(cardId)) a.cardsSeen.push(cardId);
  saveArchive();
}

export function recordCardSeen(cardId) {
  const a = getArchive();
  if (cardId && !a.cardsSeen.includes(cardId)) {
    a.cardsSeen.push(cardId);
    saveArchive();
  }
}

export function recordRunResult(outcome, roomReached) {
  const a = getArchive();
  if (outcome === 'win') a.runsCompleted += 1;
  else a.runsAdmitted += 1;
  if (roomReached > a.bestRoomReached) a.bestRoomReached = roomReached;
  saveArchive();
}

export function resetArchive() {
  cache = DEFAULT_ARCHIVE();
  saveArchive();
}
