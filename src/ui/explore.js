import { state, pushLog, NOTES_FATAL, NOTES_WARNING } from '../state.js';
import { el } from './dom.js';
import { parseProse } from './textCorrupt.js';
import { renderGlyph, hasGlyph } from './glyphs.js';
import { VOICE, ITEMS, PATIENTS, ROOMS, LAYOUT } from '../data.js';
import { canPerform, performAction } from '../turn.js';
import { attendingVisible } from '../world.js';
import { sfx } from '../audio.js';
import { render } from './render.js';

let interactionMode = 'move';

export function renderExplore(root) {
  const w = state.world;
  const run = state.run;
  if (!w || !run) {
    state.screen = 'start';
    render();
    return;
  }
  if (w.ended) {
    state.screen = 'night_end';
    render();
    return;
  }

  root.innerHTML = '';
  const screen = el('div', { class: 'explore-screen' });
  screen.appendChild(renderMasthead(w, run));

  const main = el('div', { class: 'explore-main' });
  main.appendChild(renderFloorplan(w, run));
  main.appendChild(renderLog());
  screen.appendChild(main);

  const lower = el('div', { class: 'explore-lower' });
  lower.appendChild(renderRoomView(w, run));
  lower.appendChild(renderActions(w, run));
  screen.appendChild(lower);

  screen.appendChild(renderStatus(w, run));

  root.appendChild(screen);
}

function renderMasthead(w, run) {
  return el('div', { class: 'battle-masthead' }, [
    el('div', { class: 'masthead-title' }, '// bloodlines'),
    el('div', { class: 'battle-room' }, `night ${w.night} of ${run.totalNights}`),
    el('div', { class: 'battle-turn' }, `${Math.max(0, w.nightLength - w.time)} time remaining`),
    el('button', { class: 'masthead-help', title: 'reference', onclick: () => import('./render.js').then(m => m.openHelpModal()) }, '?'),
  ]);
}

function renderFloorplan(w, run) {
  const wrap = el('div', { class: 'floorplan-wrap' });
  wrap.appendChild(el('div', { class: 'panel-title' }, 'ward'));

  const size = LAYOUT.size;
  const CELL = 56;
  const PAD = 16;
  const svgW = size.w * CELL + PAD * 2;
  const svgH = size.h * CELL + PAD * 2;

  const rooms = run.map.rooms;
  const adjacency = run.map.adjacency;
  const attRoomId = attendingVisible() ? w.attending.lastSeenRoom : null;

  let svg = `<svg viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" class="floorplan-svg">`;

  // Edges (corridor lines) - draw faded for undiscovered, solid for discovered
  for (const [aId, neighbors] of Object.entries(adjacency)) {
    const a = rooms[aId];
    if (!a.discovered) continue;
    for (const bId of neighbors) {
      const b = rooms[bId];
      if (!b.discovered) continue;
      if (aId > bId) continue;
      const x1 = PAD + a.x * CELL + CELL / 2;
      const y1 = PAD + a.y * CELL + CELL / 2;
      const x2 = PAD + b.x * CELL + CELL / 2;
      const y2 = PAD + b.y * CELL + CELL / 2;
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="fp-edge" />`;
    }
  }

  // Rooms
  const adjPlayer = new Set(adjacency[w.player.room] || []);
  for (const r of Object.values(rooms)) {
    if (!r.discovered) continue;
    const x = PAD + r.x * CELL + 8;
    const y = PAD + r.y * CELL + 8;
    const wd = CELL - 16;
    const ht = CELL - 16;
    const classes = ['fp-room', `fp-${r.archetype}`];
    if (r.visited) classes.push('fp-visited');
    if (w.player.room === r.id) classes.push('fp-player');
    if (attRoomId === r.id) classes.push('fp-attending');
    if (adjPlayer.has(r.id)) classes.push('fp-adjacent');
    if (r.id === run.realExit && run.realExitKnown) classes.push('fp-real-exit');
    svg += `<rect x="${x}" y="${y}" width="${wd}" height="${ht}" class="${classes.join(' ')}" data-room="${r.id}" />`;

    if (r.patient) {
      svg += `<g transform="translate(${x + 4} ${y + 4})" class="fp-patient-glyph">`;
      svg += renderGlyphInline(r.patient, wd - 8);
      svg += `</g>`;
    } else if (r.id === w.player.room) {
      svg += `<text x="${x + wd / 2}" y="${y + ht / 2 + 5}" class="fp-marker fp-marker-player" text-anchor="middle">0413</text>`;
    } else if (attRoomId === r.id) {
      svg += `<text x="${x + wd / 2}" y="${y + ht / 2 + 5}" class="fp-marker fp-marker-attending" text-anchor="middle">!</text>`;
    } else if (r.is_exit_candidate) {
      svg += `<text x="${x + wd / 2}" y="${y + ht / 2 + 5}" class="fp-marker fp-marker-exit" text-anchor="middle">EX</text>`;
    } else if (r.has_records) {
      svg += `<text x="${x + wd / 2}" y="${y + ht / 2 + 5}" class="fp-marker" text-anchor="middle">R</text>`;
    } else if (r.is_attending_office) {
      svg += `<text x="${x + wd / 2}" y="${y + ht / 2 + 5}" class="fp-marker fp-marker-warn" text-anchor="middle">!!</text>`;
    } else if (r.items.length > 0) {
      svg += `<text x="${x + wd / 2}" y="${y + ht / 2 + 5}" class="fp-marker" text-anchor="middle">•</text>`;
    }
  }

  // Undiscovered: outlines only (where adjacent to discovered)
  for (const r of Object.values(rooms)) {
    if (r.discovered) continue;
    const x = PAD + r.x * CELL + 8;
    const y = PAD + r.y * CELL + 8;
    svg += `<rect x="${x}" y="${y}" width="${CELL - 16}" height="${CELL - 16}" class="fp-room fp-undiscovered" />`;
  }

  svg += `</svg>`;
  const svgEl = document.createElement('div');
  svgEl.className = 'floorplan-svg-host';
  svgEl.innerHTML = svg;
  for (const rect of svgEl.querySelectorAll('rect.fp-adjacent')) {
    rect.style.cursor = 'pointer';
    const roomId = rect.getAttribute('data-room');
    rect.addEventListener('click', () => handleRoomClick(roomId));
    rect.addEventListener('mouseenter', () => showRoomTooltip(roomId));
  }
  wrap.appendChild(svgEl);

  const legend = el('div', { class: 'fp-legend' }, [
    el('span', {}, '0413 = you'),
    el('span', { class: 'fp-leg-attending' }, '! = Attending'),
    el('span', { class: 'fp-leg-exit' }, 'EX = exit door'),
    el('span', {}, 'R = records'),
    el('span', {}, '• = item'),
  ]);
  wrap.appendChild(legend);

  wrap.appendChild(el('div', { class: 'fp-modehint' }, interactionMode === 'look'
    ? 'click an adjacent room to LOOK'
    : 'click an adjacent room to MOVE'));

  return wrap;
}

function renderGlyphInline(species, size) {
  const inner = renderGlyph(species);
  return inner.replace('<svg', `<svg width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"`);
}

function showRoomTooltip(_roomId) { /* placeholder */ }

function handleRoomClick(roomId) {
  if (interactionMode === 'look') {
    if (canPerform('look', { toRoom: roomId })) {
      performAction('look', { toRoom: roomId });
      interactionMode = 'move';
      render();
    }
    return;
  }
  if (canPerform('move', { toRoom: roomId })) {
    performAction('move', { toRoom: roomId });
    render();
  } else {
    sfx('reject');
  }
}

function renderLog() {
  const col = el('div', { class: 'log-col explore-log' });
  col.appendChild(el('div', { class: 'panel-title' }, 'log'));
  const list = el('div', { class: 'log-list' });
  for (const entry of state.log.slice(-30)) {
    const line = el('div', { class: 'log-line ' + (entry.cls || '') });
    line.innerHTML = parseProse(entry.text || '');
    list.appendChild(line);
  }
  col.appendChild(list);
  setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0);
  return col;
}

function renderRoomView(w, run) {
  const room = run.map.rooms[w.player.room];
  const wrap = el('div', { class: 'room-view' });
  wrap.appendChild(el('div', { class: 'panel-title' }, `you are in: ${room.name}`));

  if (w.player.hidden) {
    wrap.appendChild(proseP(`You are hidden ${w.player.hidingSpotName || 'in a corner'}. You cannot see well.`, 'voice-marg'));
    return wrap;
  }

  if (room.patient) {
    const sp = room.patient;
    const block = el('div', { class: 'room-patient' });
    block.appendChild(el('div', { class: 'glyph-portrait', html: renderGlyph(sp) }));
    block.appendChild(el('div', { class: 'room-patient-meta' }, [
      el('div', { class: 'file-name' }, '[' + (VOICE.subtitles[sp] || sp) + ']'),
      proseP(PATIENTS[sp]?.see_line || ''),
    ]));
    wrap.appendChild(block);
    const notes = VOICE.notes[sp] || [];
    if (notes.length) {
      const noteBox = el('div', { class: 'patient-notes-box' });
      for (const n of notes.slice(0, 2)) noteBox.appendChild(proseP(n, 'patient-note-line'));
      wrap.appendChild(noteBox);
    }
  } else {
    wrap.appendChild(proseP(room.ambient));
  }

  if (room.items.length > 0) {
    const il = el('div', { class: 'room-items' });
    il.appendChild(el('div', { class: 'panel-title small' }, 'on a surface here:'));
    for (const id of room.items) {
      const it = ITEMS[id];
      il.appendChild(el('div', { class: 'room-item' }, it ? it.name : id));
    }
    wrap.appendChild(il);
  }

  if (room.is_exit_candidate) {
    wrap.appendChild(proseP('this is an exterior door.', 'doc-blood-text'));
  }
  if (room.is_attending_office) {
    wrap.appendChild(proseP('!!this is the Attending\'s office.!! you should not be here.', 'voice-marg'));
  }

  return wrap;
}

function renderActions(w, run) {
  const wrap = el('div', { class: 'action-panel' });
  wrap.appendChild(el('div', { class: 'panel-title' }, 'actions'));
  const grid = el('div', { class: 'action-grid' });

  const room = run.map.rooms[w.player.room];

  const addBtn = (label, action, params, opts = {}) => {
    const can = action === '_mode' ? true : canPerform(action, params || {});
    const cls = `action-btn ${can ? '' : 'action-btn-off'} ${opts.danger ? 'action-btn-danger' : ''} ${opts.active ? 'action-btn-active' : ''}`.trim();
    const b = el('button', {
      class: cls,
      onclick: can ? () => {
        if (action === '_mode') { interactionMode = params; render(); return; }
        const res = performAction(action, params);
        if (res.ok) render();
        else sfx('reject');
      } : null,
    }, label);
    grid.appendChild(b);
  };

  if (w.player.hidden) {
    addBtn('▸ come out', 'unhide');
    addBtn('▸ wait', 'wait');
  } else {
    addBtn(interactionMode === 'look' ? '▸ click a room to look' : '▸ look (click a room)', '_mode', interactionMode === 'look' ? 'move' : 'look', { active: interactionMode === 'look' });
    addBtn('▸ listen', 'listen');
    if (room.hiding_slots > 0) addBtn('▸ hide', 'hide');
    if (room.items.length > 0) {
      for (const id of room.items) {
        const it = ITEMS[id];
        addBtn(`▸ take ${it?.name || id}`, 'take', { itemId: id });
      }
    }
    const readables = [...room.items, ...run.inventory].filter(id => {
      const it = ITEMS[id];
      return it && (it.effect === 'lore' || it.effect === 'reveal_exit' || it.effect === 'reveal_patrol');
    });
    if (readables.length > 0) addBtn('▸ read', 'read', { itemId: readables[0] });
    if (room.is_exit_candidate) addBtn('▸ open this door', 'use_exit', {}, { danger: true });
    addBtn('▸ wait', 'wait');
  }

  wrap.appendChild(grid);
  return wrap;
}

function renderStatus(w, run) {
  const bar = el('div', { class: 'bottom-bar status-bar' });
  bar.appendChild(el('div', { class: 'status-block' }, [
    el('span', { class: 'status-label' }, 'time remaining'),
    el('span', { class: 'status-value' }, String(Math.max(0, w.nightLength - w.time))),
  ]));
  const notesCls = run.notes >= NOTES_FATAL ? 'status-fatal' : (run.notes >= NOTES_WARNING ? 'status-warn' : '');
  bar.appendChild(el('div', { class: 'status-block ' + notesCls }, [
    el('span', { class: 'status-label' }, 'notes on file'),
    el('span', { class: 'status-value' }, `${run.notes} / ${NOTES_FATAL}`),
  ]));

  bar.appendChild(el('div', { class: 'status-block' }, [
    el('span', { class: 'status-label' }, 'inventory'),
    el('span', { class: 'status-value-small' }, run.inventory.length === 0
      ? '—'
      : run.inventory.map(id => ITEMS[id]?.name || id).join(' · ')),
  ]));

  bar.appendChild(el('div', { class: 'status-block' }, [
    el('span', { class: 'status-label' }, 'patients seen'),
    el('span', { class: 'status-value' }, `${run.patientsSeen.size}/${Object.keys(PATIENTS).length}`),
  ]));

  return bar;
}

function proseP(input, cls = '') {
  const p = document.createElement('p');
  if (cls) p.className = cls;
  p.innerHTML = parseProse(input);
  return p;
}
