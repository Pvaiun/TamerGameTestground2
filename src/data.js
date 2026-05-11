export const ROOMS = {};
export const LAYOUT = { rooms: [], edges: [], size: { w: 9, h: 8 } };
export const ITEMS = {};
export const PATIENTS = {};
export const ATTENDING = { voice: {}, nights: [] };
export const GLYPHS = {};
export const VOICE = {
  intake: [],
  nights: { before: {}, after: {} },
  attending: {},
  events: {},
  subtitles: {},
  notes: {},
  noteAppends: {},
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
  const [rooms, layout, items, patients, attending, glyphs, voice] = await Promise.all([
    fetchJson('data/rooms.json'),
    fetchJson('data/layout.json'),
    fetchJson('data/items.json'),
    fetchJson('data/patients.json'),
    fetchJson('data/attending.json'),
    fetchJson('data/glyphs.json'),
    fetchJson('data/voiceprose.json'),
  ]);
  Object.assign(ROOMS, purgeMeta({ ...rooms }));
  LAYOUT.rooms = layout.rooms || [];
  LAYOUT.edges = layout.edges || [];
  LAYOUT.size = layout.size || { w: 9, h: 8 };
  Object.assign(ITEMS, purgeMeta({ ...items }));
  Object.assign(PATIENTS, purgeMeta({ ...patients }));
  ATTENDING.voice = attending.voice || {};
  ATTENDING.nights = attending.nights || [];
  for (const [k, v] of Object.entries(glyphs)) {
    if (k.startsWith('_')) continue;
    GLYPHS[k] = v;
  }
  VOICE.intake = voice.intake || [];
  VOICE.nights = voice.nights || { before: {}, after: {} };
  VOICE.attending = voice.attending || {};
  VOICE.events = voice.events || {};
  Object.assign(VOICE.subtitles, voice.subtitles || {});
  Object.assign(VOICE.notes, voice.notes || {});
  Object.assign(VOICE.noteAppends, voice.noteAppends || {});
}
