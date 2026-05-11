export const CARDS = {};
export const PATIENTS = {};
export const CONDITIONS = {};
export const RECIPES = { recipes: [] };
export const STARTERS = {};
export const GLYPHS = {};
export const VOICE = {
  subtitles: {},
  notes: {},
  noteAppends: {},
  conditions: {},
  cards: {},
  events: {},
  marginalia: {},
};

async function fetchJson(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Failed to load ${path}: ${r.status}`);
  return r.json();
}

function purgeMeta(obj) {
  for (const k of Object.keys(obj)) {
    if (k.startsWith('_')) delete obj[k];
  }
  return obj;
}

export async function loadData() {
  const [cards, patients, conditions, recipes, starters, glyphs, voice] = await Promise.all([
    fetchJson('data/cards.json'),
    fetchJson('data/patients.json'),
    fetchJson('data/conditions.json'),
    fetchJson('data/recipes.json'),
    fetchJson('data/starters.json'),
    fetchJson('data/glyphs.json'),
    fetchJson('data/voiceprose.json'),
  ]);
  Object.assign(CARDS, purgeMeta({ ...cards }));
  Object.assign(PATIENTS, purgeMeta({ ...patients }));
  Object.assign(CONDITIONS, purgeMeta({ ...conditions }));
  RECIPES.recipes = recipes.recipes || [];
  Object.assign(STARTERS, purgeMeta({ ...starters }));
  for (const [k, v] of Object.entries(glyphs)) {
    if (k.startsWith('_')) continue;
    GLYPHS[k] = v;
  }
  Object.assign(VOICE.subtitles,    voice.subtitles    || {});
  Object.assign(VOICE.notes,        voice.notes        || {});
  Object.assign(VOICE.noteAppends,  voice.noteAppends  || {});
  Object.assign(VOICE.conditions,   voice.conditions   || {});
  Object.assign(VOICE.cards,        voice.cards        || {});
  Object.assign(VOICE.events,       voice.events       || {});
  Object.assign(VOICE.marginalia,   voice.marginalia   || {});
}

export const SCHOOLS = ['GRIEF', 'HUNGER', 'STILLNESS', 'DISSOCIATION', 'INTRUSION'];
export const SCHOOL_LABEL = {
  GRIEF: 'grief',
  HUNGER: 'hunger',
  STILLNESS: 'stillness',
  DISSOCIATION: 'dissociation',
  INTRUSION: 'intrusion',
  BASIC: 'admission',
  SYNTHESIS: 'synthesis',
  BOSS: 'attending',
};
