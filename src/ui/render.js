import { state } from '../state.js';
import { app, el } from './dom.js';
import { renderStart, renderIntake, renderRoom, renderAbsorb, renderCompile, renderVictory, renderGameover, renderArchive } from './screens.js';
import { renderBattle } from './battle.js';
import { VERSION } from '../version.js';
import { parseProse } from './textCorrupt.js';
import { CONDITIONS } from '../data.js';

function openHelpModal() {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;
  modalRoot.innerHTML = '';
  const scrim = el('div', { class: 'modal-scrim', onclick: (e) => { if (e.target === scrim) modalRoot.innerHTML = ''; } });
  const modal = el('div', { class: 'doc-modal help-modal' });
  modal.appendChild(el('div', { class: 'page-tag' }, '// page · reference'));
  modal.appendChild(el('h2', { class: 'page-heading-sub' }, 'how the game is played'));

  const rules = document.createElement('div');
  rules.className = 'help-section';
  rules.innerHTML = `
    <p><strong>Combat.</strong> Two files face each other. You fill theirs by playing cards; they fill yours each turn by acting on a telegraphed intent. When one file is full, that side is discharged (theirs) or admitted (yours).</p>
    <p><strong>Insight.</strong> You start each turn with insight (your energy). Cards cost insight to play. You draw 5 cards per turn. Hand is discarded at turn end unless retained.</p>
    <p><strong>Treatments.</strong> ${parseProse('**Fill** adds pages to a file. **Compress** removes pages from a file. Conditions stack and tick over turns. Cards exhaust if marked.')}</p>
    <p><strong>Absorption.</strong> After winning, you may absorb one card from the patient's pool — and add a TAINT to your own file (a dead draw). Or close their file and take nothing.</p>
    <p><strong>Compilation.</strong> At rooms 3, 6, 9: combine two cards into a synthesis. Schools-paired produce named diagnoses, which persist in the archive across runs.</p>
    <p><strong>The Attending.</strong> Final boss at room 10. Their file capacity scales with how many cards you absorbed. They will add Attending Notes to your draw pile.</p>
  `;
  modal.appendChild(rules);

  modal.appendChild(el('h3', { class: 'rules-h' }, 'conditions'));
  const condList = el('div', { class: 'help-conditions' });
  for (const [id, def] of Object.entries(CONDITIONS)) {
    if (id.startsWith('_')) continue;
    condList.appendChild(el('div', { class: `cond cond-${id.toLowerCase()}` }, [
      el('span', { class: 'cond-name' }, def.name),
    ]));
    const dp = document.createElement('p');
    dp.className = 'help-cond-desc';
    dp.textContent = def.desc.replace('{stacks}', 'N');
    condList.appendChild(dp);
  }
  modal.appendChild(condList);

  modal.appendChild(el('h3', { class: 'rules-h' }, 'schools'));
  const schoolList = document.createElement('div');
  schoolList.className = 'help-schools';
  schoolList.innerHTML = `
    <div><span class="school-tag school-grief">grief</span> absence, loss. Sacrifice/exhaust cards; scale on losses.</div>
    <div><span class="school-tag school-hunger">hunger</span> consumption. High damage; cost in pages or cards.</div>
    <div><span class="school-tag school-stillness">stillness</span> waiting. Defense, retains, MENDING, multi-turn payoffs.</div>
    <div><span class="school-tag school-dissociation">dissociation</span> identity. Copy, transfer, redirect.</div>
    <div><span class="school-tag school-intrusion">intrusion</span> what should not be. Status afflicting, chaos, summons.</div>
  `;
  modal.appendChild(schoolList);

  modal.appendChild(el('div', { class: 'action-row' }, [
    el('button', { class: 'doc-button', onclick: () => { modalRoot.innerHTML = ''; } }, '▸ close')
  ]));
  scrim.appendChild(modal);
  modalRoot.appendChild(scrim);
}

export { openHelpModal };

export function render() {
  const root = app();
  if (!root) return;
  root.innerHTML = '';

  if (state.screen === 'battle') {
    renderBattle(root);
    return;
  }

  const wrap = el('div', { class: 'app-wrap' });

  const helpBtn = el('button', { class: 'masthead-help', onclick: () => openHelpModal() }, '?');
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
    case 'start':    renderStart(page);    break;
    case 'intake':   renderIntake(page);   break;
    case 'room':     renderRoom(page);     break;
    case 'absorb':   renderAbsorb(page);   break;
    case 'compile':  renderCompile(page);  break;
    case 'victory':  renderVictory(page);  break;
    case 'gameover': renderGameover(page); break;
    case 'archive':  renderArchive(page);  break;
    default:
      page.appendChild(el('p', {}, `Unknown screen: ${state.screen}`));
  }

  wrap.appendChild(page);
  root.appendChild(wrap);
}
