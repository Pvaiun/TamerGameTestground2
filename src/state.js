export const TOTAL_NIGHTS = 7;
export const NIGHT_LENGTH = 30;
export const NOTES_WARNING = 6;
export const NOTES_FATAL = 12;
export const MAX_LOG = 80;

export const state = {
  screen: 'start',
  run: null,
  world: null,
  pending: null,
  log: [],
  archive: null,
};

export function pushLog(text, opts) {
  let entry;
  if (text && typeof text === 'object' && !Array.isArray(text)) {
    entry = { text: text.text || '', cls: '', ...text };
  } else {
    const o = (opts && typeof opts === 'object') ? opts : (opts ? { cls: opts } : {});
    entry = { text: String(text || ''), cls: '', ...o };
  }
  state.log.push(entry);
  if (state.log.length > MAX_LOG) state.log.shift();
  return entry;
}

export function clearLog() { state.log.length = 0; }

export function resetRun() {
  state.run = null;
  state.world = null;
  state.pending = null;
  state.log = [];
}

let instanceCounter = 1;
export function nextInstanceId() { return instanceCounter++; }
