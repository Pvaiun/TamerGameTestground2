import { PATIENTS } from './data.js';
import { makeConditionsBag } from './conditions.js';

export function makePatient(speciesId) {
  const def = PATIENTS[speciesId];
  if (!def) throw new Error('Unknown patient: ' + speciesId);
  return {
    side: 'enemy',
    species: def.species,
    school: def.school,
    name: def.name,
    fileCap: def.fileCap,
    pages: 0,
    conditions: makeConditionsBag(),
    scriptIdx: 0,
    script: def.script.map(s => ({ ...s, effects: s.effects.map(e => ({ ...e })) })),
    cards: [...(def.cards || [])],
    queuedIntent: null,
    intentSkipped: false,
    def,
  };
}

export function chooseNextIntent(patient) {
  const len = patient.script.length;
  if (len === 0) return null;
  const intent = patient.script[patient.scriptIdx % len];
  patient.scriptIdx = (patient.scriptIdx + 1) % len;
  return intent;
}

export function peekNextIntent(patient) {
  if (patient.script.length === 0) return null;
  return patient.script[patient.scriptIdx % patient.script.length];
}
