import { state, pushLog, resetRun } from '../state.js';
import { el } from './dom.js';
import { parseProse } from './textCorrupt.js';
import { renderGlyph } from './glyphs.js';
import { VOICE, STARTERS, PATIENTS, CARDS, SCHOOL_LABEL } from '../data.js';
import { startRun, currentRoom, advanceToNextRoom, isRunOver, addAbsorbedCard } from '../run.js';
import { beginBattle } from '../battle.js';
import { makePatient } from '../patient.js';
import { performCompile, findRecipe } from '../compile.js';
import { sfx } from '../audio.js';
import { render } from './render.js';
import { getArchive, recordPatient, recordAbsorption, recordRunResult, recordCardSeen, resetArchive } from '../archive.js';
import { cardEl } from './cardEl.js';
import { pickN } from '../rng.js';
import { makeCard } from '../card.js';

function tag(text) {
  return el('div', { class: 'page-tag' }, text);
}

function proseP(input, cls = '') {
  const p = document.createElement('p');
  if (cls) p.className = cls;
  p.innerHTML = parseProse(input);
  return p;
}

function btn(label, onClick, opts = {}) {
  return el('button', {
    class: `doc-button ${opts.muted ? 'muted' : ''} ${opts.danger ? 'danger' : ''} ${opts.disabled ? 'disabled' : ''}`.trim(),
    onclick: opts.disabled ? null : onClick,
  }, ['▸ ', label]);
}

function actionRow(...buttons) {
  return el('div', { class: 'action-row' }, buttons.filter(Boolean));
}

function fileCard(species, name, subtitle, notes, school) {
  const block = el('div', { class: 'file-card' });
  const head = el('div', { class: 'file-header' }, [
    el('div', { class: 'glyph-portrait', html: renderGlyph(species) }),
    el('div', { class: 'file-id' }, [
      el('div', { class: 'file-name' }, name),
      subtitle ? proseP(subtitle, 'file-subtitle') : null,
      school ? el('div', { class: 'file-school' }, school) : null,
    ].filter(Boolean)),
  ]);
  block.appendChild(head);
  if (notes && notes.length) {
    block.appendChild(el('div', { class: 'file-notes' }, notes.map(n => proseP(n))));
  }
  return block;
}

export function renderStart(page) {
  page.appendChild(tag('// page · admissions'));
  page.appendChild(el('h1', { class: 'page-heading' }, 'BLOODLINES'));
  page.appendChild(proseP('A document compiled from witness testimony, ward observation, and patient self-report. The Hospital is failing. The Attending requires final files. ~~Subject is~~ You are admitted.'));
  page.appendChild(proseP(VOICE.marginalia.intake || '*I do not remember walking in.*', 'voice-marg'));

  const archive = getArchive();
  if (archive.diagnosesDiscovered.length || archive.patientsEncountered.length || archive.runsAdmitted || archive.runsCompleted) {
    const stats = el('div', { class: 'archive-mini' });
    const bits = [];
    if (archive.diagnosesDiscovered.length) bits.push(`${archive.diagnosesDiscovered.length} diagnosis${archive.diagnosesDiscovered.length === 1 ? '' : 'es'} compiled`);
    if (archive.patientsEncountered.length) bits.push(`${archive.patientsEncountered.length} patient${archive.patientsEncountered.length === 1 ? '' : 's'} on file`);
    if (archive.runsCompleted) bits.push(`${archive.runsCompleted} discharge${archive.runsCompleted === 1 ? '' : 's'}`);
    if (archive.runsAdmitted) bits.push(`${archive.runsAdmitted} admission${archive.runsAdmitted === 1 ? '' : 's'}`);
    stats.textContent = bits.join(' · ');
    page.appendChild(stats);
  }

  page.appendChild(actionRow(
    btn('begin intake', () => {
      sfx('select');
      state.screen = 'intake';
      render();
    }),
    btn('archive', () => { sfx('select'); state.screen = 'archive'; render(); }, { muted: true }),
  ));
}

export function renderIntake(page) {
  page.appendChild(tag('// page · intake form · 0413'));
  const def = STARTERS.patient_0413;
  page.appendChild(fileCard('Lumenpup', def.name, def.subtitle, def.notes));

  const explainer = el('div', { class: 'rules-block' });
  explainer.appendChild(el('h3', { class: 'rules-h' }, 'how the game is played'));
  explainer.appendChild(proseP('Each room is a patient. You sit across the desk. Between you, a file. You play TREATMENT cards from your hand: PROCEDURES fill their file, COMPRESSIONS take pages back from yours. When their file is full, they are discharged.'));
  explainer.appendChild(proseP('When yours is full, !!so are you.!!'));
  explainer.appendChild(proseP('After each room, choose one card from their pool to ABSORB. Absorbing adds the card to your casefile — and a TAINT, a dead draw in your hand. Some pages of you go into theirs.'));
  explainer.appendChild(proseP('At rooms 3, 6, and 9: compile two cards in your casefile to discover a diagnosis. At room 10: the Attending will see you now.'));
  page.appendChild(explainer);

  page.appendChild(proseP(VOICE.marginalia.first_room || '', 'voice-marg'));

  page.appendChild(actionRow(
    btn('proceed', () => {
      sfx('select');
      startRun('patient_0413');
      state.screen = 'room';
      render();
    })
  ));
}

export function renderRoom(page) {
  const run = state.run;
  if (!run) { state.screen = 'start'; render(); return; }
  if (isRunOver()) { state.screen = 'victory'; render(); return; }

  const roomNum = run.roomIdx + 1;
  page.appendChild(tag(`// page · room ${roomNum} of ${run.rooms.length}`));

  const room = currentRoom();
  if (!room) { state.screen = 'start'; render(); return; }

  const roomBar = el('div', { class: 'room-progress' });
  for (let i = 0; i < run.rooms.length; i++) {
    const r = run.rooms[i];
    const dotCls = ['room-dot'];
    if (i < run.roomIdx) dotCls.push('done');
    if (i === run.roomIdx) dotCls.push('current');
    dotCls.push('kind-' + r.kind);
    roomBar.appendChild(el('span', { class: dotCls.join(' '), title: r.kind + (r.speciesId ? (' · ' + r.speciesId) : '') }, ''));
  }
  page.appendChild(roomBar);

  // Marginalia
  let marg = '';
  if (roomNum === 1) marg = VOICE.marginalia.first_room;
  else if (roomNum >= 2 && roomNum <= 3) marg = VOICE.marginalia.early;
  else if (roomNum >= 4 && roomNum <= 6) marg = VOICE.marginalia.mid;
  else if (roomNum >= 7 && roomNum <= 9) marg = VOICE.marginalia.late;
  else if (roomNum === 10) marg = VOICE.marginalia.boss_before;
  if (marg) page.appendChild(proseP(marg, 'voice-marg'));

  // Run stats
  const stats = el('div', { class: 'run-stats' });
  stats.appendChild(el('span', {}, `deck ${run.deck.length}`));
  stats.appendChild(el('span', {}, `absorptions ${run.absorbed.length}`));
  if (run.diagnoses.length) stats.appendChild(el('span', {}, `diagnoses ${run.diagnoses.length}`));
  page.appendChild(stats);

  if (room.kind === 'battle' || room.kind === 'boss') {
    const def = PATIENTS[room.speciesId];
    page.appendChild(fileCard(
      def.species,
      def.name,
      VOICE.subtitles[def.species] || '',
      VOICE.notes[def.species] || [],
      SCHOOL_LABEL[def.school] || ''
    ));

    // Show file cap
    const meta = el('div', { class: 'patient-meta' });
    meta.appendChild(el('span', {}, `file capacity: ${def.fileCap}${room.kind === 'boss' && run.absorbed.length ? ` (+${run.absorbed.length * 4} from absorptions)` : ''} pages`));
    if (def.cards && def.cards.length) {
      meta.appendChild(el('span', {}, `offers: ${def.cards.length} card${def.cards.length === 1 ? '' : 's'}`));
    }
    page.appendChild(meta);

    page.appendChild(actionRow(
      btn(room.kind === 'boss' ? 'enter the office' : 'enter the room', () => {
        sfx('select');
        recordPatient(def.species);
        const patient = makePatient(room.speciesId);
        state.screen = 'battle';
        beginBattle(patient);
        render();
      }),
      btn('your casefile', () => openDeckReview(), { muted: true }),
      btn('your file', () => openSelfReview(), { muted: true }),
    ));
  } else if (room.kind === 'compile') {
    page.appendChild(el('h2', { class: 'page-heading-sub' }, 'compilation'));
    page.appendChild(proseP('Two cards from your file. The shared etiology becomes a diagnosis.'));
    page.appendChild(proseP('*Two things, in one hand.*', 'voice-marg'));

    page.appendChild(actionRow(
      btn('compile two cards', () => {
        sfx('select');
        state.screen = 'compile';
        render();
      }),
      btn('skip the consult', () => {
        sfx('select');
        advanceToNextRoom();
        render();
      }, { muted: true }),
      btn('your casefile', () => openDeckReview(), { muted: true }),
      btn('your file', () => openSelfReview(), { muted: true }),
    ));
  }
}

function openSelfReview() {
  const run = state.run;
  if (!run) return;
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;
  modalRoot.innerHTML = '';
  const scrim = el('div', { class: 'modal-scrim', onclick: (e) => { if (e.target === scrim) modalRoot.innerHTML = ''; } });
  const modal = el('div', { class: 'doc-modal' });
  modal.appendChild(el('div', { class: 'page-tag' }, '// page · current subject · 0413'));

  const def = STARTERS[run.starter];
  const notes = [...def.notes];
  const roomNum = run.roomIdx + 1;
  const appends = VOICE.noteAppends.Lumenpup || {};
  for (const [k, v] of Object.entries(appends)) {
    if (roomNum >= parseInt(k, 10)) notes.push(v);
  }

  modal.appendChild(fileCard('Lumenpup', def.name, def.subtitle, notes));

  const tally = el('div', { class: 'final-stats' });
  tally.appendChild(el('div', {}, `room ${roomNum} of ${run.rooms.length}`));
  tally.appendChild(el('div', {}, `cards on file: ${run.deck.length}`));
  tally.appendChild(el('div', {}, `absorbed from others: ${run.absorbed.length}`));
  tally.appendChild(el('div', {}, `taints accumulated: ${run.deck.filter(c => c.id === 'taint').length}`));
  if (run.diagnoses.length) tally.appendChild(el('div', {}, `diagnoses compiled: ${run.diagnoses.join(' · ')}`));
  modal.appendChild(tally);

  modal.appendChild(el('div', { class: 'action-row' }, [
    btn('close', () => { modalRoot.innerHTML = ''; })
  ]));
  scrim.appendChild(modal);
  modalRoot.appendChild(scrim);
}

function openDeckReview() {
  const run = state.run;
  if (!run) return;
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;
  modalRoot.innerHTML = '';
  const scrim = el('div', { class: 'modal-scrim', onclick: (e) => { if (e.target === scrim) modalRoot.innerHTML = ''; } });
  const modal = el('div', { class: 'doc-modal deck-review-modal' });
  modal.appendChild(el('div', { class: 'page-tag' }, '// page · current casefile'));
  modal.appendChild(el('div', { class: 'rules-h' }, `${run.deck.length} card${run.deck.length === 1 ? '' : 's'} on file`));
  const grid = el('div', { class: 'card-grid' });
  for (const c of run.deck) grid.appendChild(cardEl(c));
  modal.appendChild(grid);
  modal.appendChild(el('div', { class: 'action-row' }, [
    btn('close', () => { modalRoot.innerHTML = ''; })
  ]));
  scrim.appendChild(modal);
  modalRoot.appendChild(scrim);
}

export function renderAbsorb(page) {
  const pending = state.pending;
  page.appendChild(tag('// page · post-treatment · absorption'));
  if (!pending) {
    page.appendChild(proseP('No file open.'));
    page.appendChild(actionRow(btn('continue', () => { state.screen = 'room'; render(); })));
    return;
  }
  const def = PATIENTS[pending.speciesId];
  page.appendChild(fileCard(def.species, def.name, VOICE.subtitles[def.species] || '', null, SCHOOL_LABEL[def.school]));
  page.appendChild(proseP('Their file offers what stays. Take one to your own.'));
  page.appendChild(proseP('Anything you absorb adds a ~~note~~ taint to your file. You will draw it. It will sit in your hand.'));

  const grid = el('div', { class: 'card-grid card-grid-offer' });
  for (let i = 0; i < pending.options.length; i++) {
    const cardId = pending.options[i];
    const card = makeCard(cardId);
    const e = cardEl(card, {
      onclick: () => {
        sfx('absorb');
        addAbsorbedCard(cardId);
        recordAbsorption(cardId);
        recordCardSeen(cardId);
        state.pending = null;
        advanceToNextRoom();
        state.screen = 'room';
        render();
      }
    });
    grid.appendChild(e);
  }
  page.appendChild(grid);

  page.appendChild(proseP(state.run.absorbed.length === 0
    ? (VOICE.marginalia.absorb_first_taint || '')
    : (state.run.absorbed.length >= 4 ? (VOICE.marginalia.absorb_many || '') : (VOICE.marginalia.post_absorb_first || '')),
    'voice-marg'));

  page.appendChild(actionRow(
    btn('close their file · take nothing', () => {
      sfx('select');
      state.pending = null;
      advanceToNextRoom();
      state.screen = 'room';
      render();
    }, { muted: true })
  ));
}

export function renderCompile(page) {
  const run = state.run;
  if (!run) { state.screen = 'start'; render(); return; }
  if (!state.pending || state.pending.type !== 'compile') {
    state.pending = { type: 'compile', selected: [] };
  }
  const sel = state.pending.selected;

  page.appendChild(tag('// page · compilation'));
  page.appendChild(proseP('Select two cards from your casefile. They become one diagnosis.'));

  const recipe = (sel.length === 2)
    ? findRecipe(run.deck[sel[0]], run.deck[sel[1]])
    : null;

  if (sel.length === 2) {
    const cA = run.deck[sel[0]];
    const cB = run.deck[sel[1]];
    page.appendChild(el('div', { class: 'compile-preview' }, [
      cardEl(cA),
      el('div', { class: 'compile-plus' }, '+'),
      cardEl(cB),
      el('div', { class: 'compile-eq' }, '='),
      recipe
        ? el('div', { class: 'compile-result' }, [
            el('div', { class: 'compile-diagnosis' }, recipe.diagnosis),
            proseP(recipe.notes, 'compile-notes'),
            el('div', { class: 'compile-card-name' }, CARDS[recipe.result]?.name || recipe.result),
          ])
        : el('div', { class: 'compile-result' }, [
            el('div', { class: 'compile-diagnosis' }, '[Anomalous compilation]'),
            proseP('Subject does not match any schema.', 'compile-notes'),
          ]),
    ]));
  }

  const grid = el('div', { class: 'card-grid' });
  for (let i = 0; i < run.deck.length; i++) {
    const c = run.deck[i];
    if (c.flags?.unplayable) {
      const e = cardEl(c, { disabled: true });
      grid.appendChild(e);
      continue;
    }
    const isSelected = sel.includes(i);
    const e = cardEl(c, {
      selected: isSelected,
      onclick: () => {
        if (isSelected) sel.splice(sel.indexOf(i), 1);
        else if (sel.length < 2) sel.push(i);
        else { sel.shift(); sel.push(i); }
        sfx('select');
        render();
      }
    });
    grid.appendChild(e);
  }
  page.appendChild(grid);

  const canCompile = sel.length === 2;
  page.appendChild(actionRow(
    btn('compile', () => {
      if (!canCompile) return;
      const result = performCompile(sel[0], sel[1]);
      if (result) {
        sfx('compile');
        state.pending = { type: 'compile_result', card: result.card, diagnosis: result.diagnosis, notes: result.notes };
      }
      advanceToNextRoom();
      state.screen = 'room';
      render();
    }, { disabled: !canCompile, muted: !canCompile }),
    btn('skip', () => {
      sfx('select');
      state.pending = null;
      advanceToNextRoom();
      state.screen = 'room';
      render();
    }, { muted: true })
  ));
}

export function renderVictory(page) {
  page.appendChild(tag('// page · discharge'));
  page.appendChild(el('h1', { class: 'page-heading' }, 'discharged'));
  page.appendChild(proseP('Subject is no longer to be considered admitted. File closed. Subject may collect their belongings on exit.'));
  page.appendChild(proseP(VOICE.marginalia.victory || '', 'voice-marg'));

  const run = state.run;
  if (run) {
    const stats = el('div', { class: 'final-stats' });
    stats.appendChild(el('div', {}, `Rooms cleared: ${run.rooms.length}`));
    stats.appendChild(el('div', {}, `Cards absorbed: ${run.absorbed.length}`));
    stats.appendChild(el('div', {}, `Diagnoses compiled: ${run.diagnoses.length}`));
    if (run.diagnoses.length) stats.appendChild(el('div', {}, run.diagnoses.join(' · ')));
    page.appendChild(stats);
  }

  if (run && !state.run.__recorded) {
    recordRunResult('win', run.rooms.length);
    state.run.__recorded = true;
  }

  page.appendChild(actionRow(
    btn('begin again', () => { sfx('select'); resetRun(); state.screen = 'start'; render(); }),
    btn('archive', () => { sfx('select'); state.screen = 'archive'; render(); }, { muted: true }),
  ));
}

export function renderGameover(page) {
  page.appendChild(tag('// page · admission'));
  page.appendChild(el('h1', { class: 'page-heading' }, 'admitted'));
  page.appendChild(proseP('Subject is to be considered ~~discharged~~ admitted. File remains open. Subject is no longer to leave the room.'));
  page.appendChild(proseP(VOICE.marginalia.defeat || '', 'voice-marg'));

  const run = state.run;
  if (run) {
    const stats = el('div', { class: 'final-stats' });
    stats.appendChild(el('div', {}, `Rooms entered: ${run.roomIdx + 1} / ${run.rooms.length}`));
    stats.appendChild(el('div', {}, `Cards absorbed: ${run.absorbed.length}`));
    stats.appendChild(el('div', {}, `Diagnoses compiled: ${run.diagnoses.length}`));
    page.appendChild(stats);
  }

  if (run && !state.run.__recorded) {
    recordRunResult('loss', run.roomIdx);
    state.run.__recorded = true;
  }

  page.appendChild(actionRow(
    btn('again', () => { sfx('select'); resetRun(); state.screen = 'start'; render(); }),
    btn('archive', () => { sfx('select'); state.screen = 'archive'; render(); }, { muted: true }),
  ));
}

export function renderArchive(page) {
  page.appendChild(tag('// page · archive'));
  page.appendChild(el('h1', { class: 'page-heading' }, 'the archive'));
  page.appendChild(proseP('Permanent record. What has been documented stays.'));

  const archive = getArchive();
  const stats = el('div', { class: 'archive-stats' });
  stats.appendChild(el('div', {}, `runs completed: ${archive.runsCompleted}`));
  stats.appendChild(el('div', {}, `runs admitted: ${archive.runsAdmitted}`));
  stats.appendChild(el('div', {}, `total absorptions: ${archive.totalAbsorptions}`));
  stats.appendChild(el('div', {}, `deepest room: ${archive.bestRoomReached}`));
  page.appendChild(stats);

  page.appendChild(el('h3', { class: 'rules-h' }, `diagnoses on file (${archive.diagnosesDiscovered.length})`));
  if (archive.diagnosesDiscovered.length === 0) {
    page.appendChild(proseP('The archive is empty.'));
  } else {
    const list = el('div', { class: 'archive-list' });
    for (const d of archive.diagnosesDiscovered) {
      const item = el('div', { class: 'archive-item' });
      item.appendChild(el('div', { class: 'archive-name' }, d.name));
      if (d.notes) item.appendChild(proseP(d.notes, 'archive-notes'));
      list.appendChild(item);
    }
    page.appendChild(list);
  }

  page.appendChild(el('h3', { class: 'rules-h' }, `patients seen (${archive.patientsEncountered.length}/${Object.keys(PATIENTS).length - 1})`));
  if (archive.patientsEncountered.length === 0) {
    page.appendChild(proseP('No patients on file.'));
  } else {
    const list = el('div', { class: 'archive-list patients' });
    for (const sp of archive.patientsEncountered) {
      const def = PATIENTS[sp];
      if (!def) continue;
      list.appendChild(el('div', { class: 'archive-patient' }, [
        el('div', { class: 'glyph-portrait small', html: renderGlyph(sp) }),
        el('div', { class: 'archive-patient-meta' }, [
          el('div', { class: 'archive-name' }, def.name),
          proseP(VOICE.subtitles[sp] || '', 'file-subtitle'),
        ]),
      ]));
    }
    page.appendChild(list);
  }

  page.appendChild(actionRow(
    btn('back', () => { sfx('select'); state.screen = state.run ? 'gameover' : 'start'; render(); }),
    btn('reset archive', () => {
      if (confirm('Erase the archive permanently?')) {
        resetArchive();
        render();
      }
    }, { muted: true, danger: true })
  ));
}
