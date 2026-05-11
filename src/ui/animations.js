import { el } from './dom.js';

function colFor(side) {
  return document.querySelector(`.file-col.${side}`);
}

export function spawnFloat(side, text, kind = 'dmg') {
  const col = colFor(side);
  const target = col ? (col.querySelector('.glyph-portrait') || col) : null;
  if (!target) return;
  const r = target.getBoundingClientRect();
  const f = el('div', { class: 'floating ' + (kind === 'compress' ? 'heal' : kind === 'crit' ? 'crit' : '') }, text);
  f.style.position = 'fixed';
  f.style.textAlign = 'center';
  f.style.minWidth = '64px';
  f.style.left = `${r.left + r.width / 2 - 32}px`;
  f.style.top  = `${r.top + 8}px`;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}

export function spawnCallout(text) {
  const screen = document.querySelector('.battle-screen') || document.querySelector('#app');
  if (!screen) return;
  const r = screen.getBoundingClientRect();
  const c = el('div', { class: 'callout' }, text);
  c.style.position = 'fixed';
  c.style.left = `${r.left + r.width / 2}px`;
  c.style.top  = `${r.top + 60}px`;
  document.body.appendChild(c);
  setTimeout(() => c.remove(), 950);
}

export function shakeStage() {
  for (const side of ['player', 'enemy']) pulseCol(side, 'shake-pulse');
}

export function playLunge(side) {
  pulseCol(side, 'lunge-anim');
}

export function playRecoil(side) {
  pulseCol(side, 'recoil-anim');
}

function pulseCol(side, cls) {
  const col = colFor(side);
  if (!col) return;
  col.classList.remove(cls);
  void col.offsetWidth;
  col.classList.add(cls);
  setTimeout(() => col.classList.remove(cls), 600);
}
