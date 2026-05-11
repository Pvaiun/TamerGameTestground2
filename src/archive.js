import { VERSION } from './version.js';

const KEY = 'bloodlines.archive.v2';

const DEFAULT = () => ({
  version: VERSION,
  patientsSeen: [],
  itemsSeen: [],
  roomsSeen: [],
  runsEscaped: 0,
  runsAdmitted: 0,
  furthestNight: 0,
});

let cache = null;

export function getArchive() {
  if (!cache) {
    try {
      const raw = localStorage.getItem(KEY);
      cache = raw ? { ...DEFAULT(), ...JSON.parse(raw) } : DEFAULT();
    } catch (e) {
      cache = DEFAULT();
    }
  }
  return cache;
}

export function saveArchive() {
  try { localStorage.setItem(KEY, JSON.stringify(getArchive())); } catch (e) {}
}

export function recordPatient(species) {
  const a = getArchive();
  if (!a.patientsSeen.includes(species)) { a.patientsSeen.push(species); saveArchive(); }
}

export function recordItem(itemId) {
  const a = getArchive();
  if (!a.itemsSeen.includes(itemId)) { a.itemsSeen.push(itemId); saveArchive(); }
}

export function recordRoom(roomId) {
  const a = getArchive();
  if (!a.roomsSeen.includes(roomId)) { a.roomsSeen.push(roomId); saveArchive(); }
}

export function recordRunResult(outcome, night) {
  const a = getArchive();
  if (outcome === 'escaped') a.runsEscaped += 1;
  else a.runsAdmitted += 1;
  if (night > a.furthestNight) a.furthestNight = night;
  saveArchive();
}

export function resetArchive() {
  cache = DEFAULT();
  saveArchive();
}
