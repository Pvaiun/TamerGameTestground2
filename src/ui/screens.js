import { state, resetRun, NOTES_FATAL, NOTES_WARNING, TOTAL_NIGHTS } from '../state.js';
import { el } from './dom.js';
import { parseProse } from './textCorrupt.js';
import { renderGlyph } from './glyphs.js';
import { VOICE, PATIENTS, ITEMS } from '../data.js';
import { startRun, beginNight, finishNight } from '../run.js';
import { sfx } from '../audio.js';
import { render } from './render.js';
import { getArchive, recordPatient, recordRunResult, resetArchive } from '../archive.js';

function tag(text) { return el('div', { class: 'page-tag' }, text); }
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
function actionRow(...buttons) { return el('div', { class: 'action-row' }, buttons.filter(Boolean)); }

export function renderStart(page) {
  page.appendChild(tag('// page · admissions'));
  page.appendChild(el('h1', { class: 'page-heading' }, 'BLOODLINES'));
  page.appendChild(proseP('A document compiled from witness testimony, ward observation, and patient self-report. The Hospital is failing. The Attending requires final files. ~~Subject is~~ You are admitted.'));
  page.appendChild(proseP('*I do not remember walking in.*', 'voice-marg'));

  const archive = getArchive();
  if (archive.patientsSeen.length || archive.runsEscaped || archive.runsAdmitted) {
    const stats = el('div', { class: 'archive-mini' });
    const bits = [];
    if (archive.patientsSeen.length) bits.push(`${archive.patientsSeen.length} patient${archive.patientsSeen.length === 1 ? '' : 's'} on file`);
    if (archive.runsEscaped) bits.push(`${archive.runsEscaped} discharge${archive.runsEscaped === 1 ? '' : 's'}`);
    if (archive.runsAdmitted) bits.push(`${archive.runsAdmitted} admission${archive.runsAdmitted === 1 ? '' : 's'}`);
    if (archive.furthestNight) bits.push(`deepest night reached: ${archive.furthestNight}`);
    stats.textContent = bits.join(' · ');
    page.appendChild(stats);
  }

  page.appendChild(actionRow(
    btn('begin intake', () => { sfx('select'); state.screen = 'intake'; render(); }),
    btn('archive', () => { sfx('select'); state.screen = 'archive'; render(); }, { muted: true }),
  ));
}

export function renderIntake(page) {
  page.appendChild(tag('// page · intake form · 0413'));
  const fileBlock = el('div', { class: 'file-card' });
  fileBlock.appendChild(el('div', { class: 'file-header' }, [
    el('div', { class: 'glyph-portrait', html: renderGlyph('Lumenpup') }),
    el('div', { class: 'file-id' }, [
      el('div', { class: 'file-name' }, '[Patient 0413]'),
      proseP('Admitted [[8]] · file open', 'file-subtitle'),
    ]),
  ]));
  const notes = VOICE.intake || [];
  fileBlock.appendChild(el('div', { class: 'file-notes' }, notes.map(n => proseP(n))));
  page.appendChild(fileBlock);

  page.appendChild(actionRow(
    btn('proceed to bed', () => {
      sfx('select');
      startRun();
      state.screen = 'night_start';
      render();
    })
  ));
}

export function renderNightStart(page) {
  const run = state.run;
  if (!run) { state.screen = 'start'; render(); return; }
  page.appendChild(tag(`// night ${run.night} of ${run.totalNights}`));
  const marg = VOICE.nights.before[String(run.night)] || '';
  if (marg) page.appendChild(proseP(marg, 'voice-marg'));

  page.appendChild(proseP(`The clock above the door has stopped. You wake without sound. The Attending's rounds begin in an hour. ${parseProse('You have until ~~~~ the night ends.')}`));

  const stats = el('div', { class: 'run-stats' });
  stats.appendChild(el('span', {}, `night ${run.night} / ${run.totalNights}`));
  stats.appendChild(el('span', {}, `notes on file: ${run.notes} / ${NOTES_FATAL}`));
  if (run.realExitKnown) stats.appendChild(el('span', {}, `exit located`));
  page.appendChild(stats);

  if (run.inventory.length > 0) {
    const inv = el('div', { class: 'inventory-preview' });
    inv.appendChild(el('div', { class: 'rules-h' }, 'on your person'));
    const list = el('div', { class: 'inv-list' });
    for (const id of run.inventory) {
      const it = ITEMS[id];
      list.appendChild(el('div', { class: 'inv-item' }, it ? it.name : id));
    }
    inv.appendChild(list);
    page.appendChild(inv);
  }

  page.appendChild(actionRow(
    btn('leave the bed', () => {
      sfx('wake');
      beginNight();
      state.screen = 'explore';
      render();
    })
  ));
}

export function renderNightEnd(page) {
  const run = state.run;
  const w = state.world;
  if (!run || !w) { state.screen = 'start'; render(); return; }
  page.appendChild(tag(`// night ${w.night} of ${run.totalNights} — closing`));

  const reason = w.endReason;
  let marg;
  if (reason === 'caught' || w.notesThisNight >= 2) marg = VOICE.nights.after.noted_many;
  else if (w.notesThisNight === 1) marg = VOICE.nights.after.noted_few;
  else if (reason === 'asleep_in_hall') marg = VOICE.nights.after.asleep_in_hall;
  else marg = VOICE.nights.after.uncaught;
  if (marg) page.appendChild(proseP(marg, 'voice-marg'));

  const summary = el('div', { class: 'final-stats' });
  summary.appendChild(el('div', {}, `notes added tonight: ${w.notesThisNight || 0}`));
  summary.appendChild(el('div', {}, `notes on file: ${run.notes} / ${NOTES_FATAL}`));
  if (run.notes >= NOTES_WARNING && run.notes < NOTES_FATAL) {
    summary.appendChild(el('div', { class: 'warning' }, parseProse('!!You are nearing admission.!!')));
  }
  if (run.inventory.length) {
    summary.appendChild(el('div', {}, `inventory: ${run.inventory.map(id => ITEMS[id]?.name || id).join(', ')}`));
  }
  if (run.realExitKnown) {
    summary.appendChild(el('div', {}, `exit located: ${run.map.rooms[run.realExit]?.name}`));
  }
  page.appendChild(summary);

  finishNight();

  if (state.run.ended) {
    page.appendChild(actionRow(
      btn('continue', () => {
        if (state.run.outcome === 'escaped') { state.screen = 'victory'; render(); }
        else { state.screen = 'gameover'; render(); }
      })
    ));
    return;
  }

  page.appendChild(actionRow(
    btn(state.run.night > run.totalNights ? 'face the morning' : `proceed to night ${state.run.night}`, () => {
      sfx('select');
      if (state.run.night > run.totalNights) {
        state.run.outcome = 'admitted';
        state.run.ended = true;
        state.screen = 'gameover';
      } else {
        state.screen = 'night_start';
      }
      render();
    })
  ));
}

export function renderVictory(page) {
  page.appendChild(tag('// page · discharge'));
  page.appendChild(el('h1', { class: 'page-heading' }, 'discharged'));
  page.appendChild(proseP('Subject is no longer to be considered admitted. The door opens. Subject may collect their belongings on exit.'));
  page.appendChild(proseP('*I left. ~~I did not leave.~~ I left.*', 'voice-marg'));
  const run = state.run;
  if (run && !run.__recorded) {
    recordRunResult('escaped', run.night);
    for (const sp of run.patientsSeen) recordPatient(sp);
    run.__recorded = true;
  }
  if (run) {
    const stats = el('div', { class: 'final-stats' });
    stats.appendChild(el('div', {}, `nights survived: ${run.night - 1}`));
    stats.appendChild(el('div', {}, `notes on file: ${run.notes}`));
    stats.appendChild(el('div', {}, `patients encountered: ${run.patientsSeen.size}`));
    page.appendChild(stats);
  }
  page.appendChild(actionRow(
    btn('again', () => { sfx('select'); resetRun(); state.screen = 'start'; render(); }),
    btn('archive', () => { sfx('select'); state.screen = 'archive'; render(); }, { muted: true }),
  ));
}

export function renderGameover(page) {
  page.appendChild(tag('// page · admission'));
  page.appendChild(el('h1', { class: 'page-heading' }, 'admitted'));
  page.appendChild(proseP('Subject is to be considered ~~discharged~~ admitted. The file is closed. The room is yours indefinitely.'));
  page.appendChild(proseP('*I will be along shortly.*', 'voice-marg'));
  const run = state.run;
  if (run && !run.__recorded) {
    recordRunResult('admitted', run.night);
    for (const sp of run.patientsSeen) recordPatient(sp);
    run.__recorded = true;
  }
  if (run) {
    const stats = el('div', { class: 'final-stats' });
    stats.appendChild(el('div', {}, `nights endured: ${Math.min(run.night, run.totalNights)}`));
    stats.appendChild(el('div', {}, `notes on file: ${run.notes} / ${NOTES_FATAL}`));
    stats.appendChild(el('div', {}, `patients encountered: ${run.patientsSeen.size}`));
    page.appendChild(stats);
  }
  page.appendChild(actionRow(
    btn('again', () => { sfx('select'); resetRun(); state.screen = 'start'; render(); }),
    btn('archive', () => { sfx('select'); state.screen = 'archive'; render(); }, { muted: true }),
  ));
}

export function renderArchive(page) {
  page.appendChild(tag('// page · archive'));
  page.appendChild(el('h1', { class: 'page-heading' }, 'the archive'));
  page.appendChild(proseP('Permanent record across runs.'));
  const a = getArchive();
  const stats = el('div', { class: 'archive-stats' });
  stats.appendChild(el('div', {}, `runs escaped: ${a.runsEscaped}`));
  stats.appendChild(el('div', {}, `runs admitted: ${a.runsAdmitted}`));
  stats.appendChild(el('div', {}, `deepest night: ${a.furthestNight}`));
  stats.appendChild(el('div', {}, `patients seen: ${a.patientsSeen.length}`));
  page.appendChild(stats);

  page.appendChild(el('h3', { class: 'rules-h' }, `patients seen (${a.patientsSeen.length}/${Object.keys(PATIENTS).length})`));
  if (a.patientsSeen.length === 0) {
    page.appendChild(proseP('the archive is empty.'));
  } else {
    const list = el('div', { class: 'archive-list patients' });
    for (const sp of a.patientsSeen) {
      list.appendChild(el('div', { class: 'archive-patient' }, [
        el('div', { class: 'glyph-portrait small', html: renderGlyph(sp) }),
        el('div', { class: 'archive-patient-meta' }, [
          el('div', { class: 'archive-name' }, '[' + (VOICE.subtitles[sp] || sp) + ']'),
        ]),
      ]));
    }
    page.appendChild(list);
  }

  page.appendChild(actionRow(
    btn('back', () => { sfx('select'); state.screen = state.run ? (state.run.outcome === 'escaped' ? 'victory' : 'gameover') : 'start'; render(); }),
    btn('reset archive', () => {
      if (confirm('Erase the archive permanently?')) { resetArchive(); render(); }
    }, { muted: true, danger: true })
  ));
}
