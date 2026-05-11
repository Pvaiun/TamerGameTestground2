import { state } from '../state.js';
import { app, el } from './dom.js';
import { renderStart, renderIntake, renderNightStart, renderNightEnd, renderVictory, renderGameover, renderArchive } from './screens.js';
import { renderExplore } from './explore.js';
import { VERSION } from '../version.js';
import { parseProse } from './textCorrupt.js';

export function render() {
  const root = app();
  if (!root) return;
  root.innerHTML = '';

  if (state.screen === 'explore') {
    renderExplore(root);
    return;
  }

  const wrap = el('div', { class: 'app-wrap' });
  const helpBtn = el('button', { class: 'masthead-help', title: 'reference', onclick: () => openHelpModal() }, '?');
  const masthead = el('div', { class: 'masthead' }, [
    el('div', { class: 'masthead-title' }, '// bloodlines'),
    el('div', { class: 'masthead-right' }, [
      helpBtn,
      el('div', { class: 'masthead-version' }, `v${VERSION}`),
    ]),
  ]);
  wrap.appendChild(masthead);

  const page = el('div', { class: 'doc-page' });
  switch (state.screen) {
    case 'start':       renderStart(page);       break;
    case 'intake':      renderIntake(page);      break;
    case 'night_start': renderNightStart(page);  break;
    case 'night_end':   renderNightEnd(page);    break;
    case 'victory':     renderVictory(page);     break;
    case 'gameover':    renderGameover(page);    break;
    case 'archive':     renderArchive(page);     break;
    default:
      page.appendChild(el('p', {}, `unknown screen: ${state.screen}`));
  }
  wrap.appendChild(page);
  root.appendChild(wrap);
}

export function openHelpModal() {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;
  modalRoot.innerHTML = '';
  const scrim = el('div', { class: 'modal-scrim', onclick: (e) => { if (e.target === scrim) modalRoot.innerHTML = ''; } });
  const modal = el('div', { class: 'doc-modal help-modal' });
  modal.appendChild(el('div', { class: 'page-tag' }, '// page · reference'));
  modal.appendChild(el('h2', { class: 'page-heading-sub' }, 'rules'));
  const body = document.createElement('div');
  body.className = 'help-section';
  body.innerHTML = `
    <p><strong>Seven nights.</strong> The Hospital is closing. You are Patient 0413. You do not remember walking in. The Attending requires final files. Get out before night seven or be admitted.</p>
    <p><strong>Each night</strong> you wake at midnight with 30 time-units before lights-on. You can move room to room, look into rooms without entering, listen at doors, hide in cabinets, take items, read what you find. At end of night you must be back in your bed. Otherwise you fall asleep in the hallway.</p>
    <p><strong>The Attending</strong> walks the corridors. ${parseProse('If they enter your room and you are not hidden, ~~it is over~~ they note you. Six notes is a warning. Twelve is admission.')}</p>
    <p><strong>The exit.</strong> There are three doors that could be exits. One is the real exit this run. The duty roster (records room) names it. The keys (offices, supply) open it. Use the right door, with the right key, on any night.</p>
    <p><strong>The patients</strong> are in their rooms. You are not here for them. Walking past their doors is sometimes loud. Looking in is sometimes worse.</p>
  `;
  modal.appendChild(body);
  modal.appendChild(el('h3', { class: 'rules-h' }, 'verbs'));
  const verbs = document.createElement('div');
  verbs.className = 'help-verbs';
  verbs.innerHTML = `
    <div><b>MOVE</b> into an adjacent room.</div>
    <div><b>LOOK</b> into an adjacent room without entering.</div>
    <div><b>LISTEN</b> at the doorway — hear the Attending's direction.</div>
    <div><b>HIDE</b> in the current room if it has a hiding spot.</div>
    <div><b>TAKE</b> an item from the current room.</div>
    <div><b>READ</b> a document.</div>
    <div><b>WAIT</b> — let one time-unit pass.</div>
    <div><b>USE EXIT</b> at an exit door (correct key required).</div>
  `;
  modal.appendChild(verbs);
  modal.appendChild(el('div', { class: 'action-row' }, [
    el('button', { class: 'doc-button', onclick: () => { modalRoot.innerHTML = ''; } }, '▸ close'),
  ]));
  scrim.appendChild(modal);
  modalRoot.appendChild(scrim);
}
