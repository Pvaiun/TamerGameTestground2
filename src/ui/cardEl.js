import { el } from './dom.js';
import { parseProse } from './textCorrupt.js';
import { cardDescriptor, effectiveCost } from '../card.js';
import { SCHOOL_LABEL } from '../data.js';
import { state } from '../state.js';

export function cardEl(card, opts = {}) {
  const battle = state.battle;
  const cost = battle ? effectiveCost(card, battle) : card.cost;
  const baseCost = card.cost;
  const playable = opts.playable !== false;
  const selected = !!opts.selected;
  const disabled = !!opts.disabled;
  const cls = [
    'card',
    'card-' + (card.school || 'BASIC').toLowerCase(),
    card.flags?.unplayable ? 'card-unplayable' : '',
    card.flags?.exhaust ? 'card-exhaust' : '',
    selected ? 'card-selected' : '',
    disabled ? 'card-disabled' : '',
  ].filter(Boolean).join(' ');

  const wrap = el('div', { class: cls });

  const head = el('div', { class: 'card-head' }, [
    el('div', { class: 'card-cost' + (cost !== baseCost ? ' cost-bumped' : '') }, String(cost)),
    el('div', { class: 'card-name' }, card.name),
  ]);
  wrap.appendChild(head);

  const schoolLabel = SCHOOL_LABEL[card.school] || card.school;
  wrap.appendChild(el('div', { class: 'card-school' }, schoolLabel));

  const desc = el('div', { class: 'card-desc' });
  desc.textContent = cardDescriptor(card);
  wrap.appendChild(desc);

  if (card.flags?.exhaust && !card.flags?.unplayable) {
    wrap.appendChild(el('div', { class: 'card-flag' }, 'exhaust'));
  }
  if (card.flags?.ethereal) {
    wrap.appendChild(el('div', { class: 'card-flag' }, 'ethereal'));
  }
  if (card.flags?.unplayable) {
    wrap.appendChild(el('div', { class: 'card-flag' }, 'unplayable'));
  }

  if (card.prose) {
    const prose = el('div', { class: 'card-prose' });
    prose.innerHTML = parseProse(card.prose);
    wrap.appendChild(prose);
  }

  if (opts.onclick) wrap.addEventListener('click', opts.onclick);

  return wrap;
}
