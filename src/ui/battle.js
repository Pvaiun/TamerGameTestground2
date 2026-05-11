import { state } from '../state.js';
import { el } from './dom.js';
import { parseProse } from './textCorrupt.js';
import { renderGlyph } from './glyphs.js';
import { VOICE, CONDITIONS, PATIENTS, SCHOOL_LABEL } from '../data.js';
import { canPlayCardAt, playCard, endPlayerTurn } from '../battle.js';
import { cardEl } from './cardEl.js';
import { sfx } from '../audio.js';
import { render, openHelpModal } from './render.js';
import { currentRoom } from '../run.js';

export function renderBattle(root) {
  const battle = state.battle;
  if (!battle) return;

  root.innerHTML = '';

  const screen = el('div', { class: 'battle-screen' });

  const helpBtn = el('button', { class: 'masthead-help', onclick: () => openHelpModal() }, '?');
  screen.appendChild(el('div', { class: 'battle-masthead' }, [
    el('div', { class: 'masthead-title' }, '// bloodlines'),
    el('div', { class: 'battle-room' }, `room ${state.run.roomIdx + 1} / ${state.run.rooms.length}`),
    el('div', { class: 'battle-turn' }, battle.turn === 'player' ? 'your turn' : 'their turn'),
    helpBtn,
  ]));

  const top = el('div', { class: 'battle-top' });
  top.appendChild(renderEnemySide(battle));
  top.appendChild(renderLogColumn());
  screen.appendChild(top);

  const mid = el('div', { class: 'battle-mid' });
  mid.appendChild(renderPlayerStrip(battle));
  screen.appendChild(mid);

  const handRow = renderHandRow();
  screen.appendChild(handRow);

  const bottomBar = renderBottomBar();
  screen.appendChild(bottomBar);

  if (battle.ended) {
    screen.appendChild(renderBattleEnd(battle));
  }

  root.appendChild(screen);
}

function renderEnemySide(battle) {
  const fighter = battle.enemy;
  const col = el('div', { class: 'file-col enemy' });

  col.appendChild(el('div', { class: 'file-col-head' }, [
    el('div', { class: 'glyph-portrait', html: renderGlyph(fighter.species) }),
    el('div', { class: 'file-col-id' }, [
      el('div', { class: 'file-col-name' }, fighter.name),
      el('div', { class: 'file-col-school' }, SCHOOL_LABEL[fighter.school] || ''),
    ]),
  ]));

  col.appendChild(renderPageBar(fighter, 'enemy'));
  col.appendChild(renderCondRow(fighter));

  if (battle.enemy.queuedIntent && !battle.ended) {
    col.appendChild(renderIntent(battle.enemy.queuedIntent));
  }

  return col;
}

function renderPlayerStrip(battle) {
  const fighter = battle.player;
  const strip = el('div', { class: 'file-col player' });

  strip.appendChild(el('div', { class: 'file-col-head' }, [
    el('div', { class: 'glyph-portrait small', html: renderGlyph('Lumenpup') }),
    el('div', { class: 'file-col-id' }, [
      el('div', { class: 'file-col-name' }, fighter.name),
      el('div', { class: 'file-col-school' }, 'admission'),
    ]),
  ]));

  strip.appendChild(renderPageBar(fighter, 'player'));
  strip.appendChild(renderCondRow(fighter));

  return strip;
}

function renderPageBar(fighter, side) {
  const pct = Math.min(100, (fighter.pages / fighter.fileCap) * 100);
  const wrap = el('div', { class: 'page-bar-wrap' });
  const bar = el('div', { class: 'page-bar' });
  bar.appendChild(el('div', { class: `page-bar-fill side-${side}`, style: `width:${pct.toFixed(1)}%` }));
  wrap.appendChild(bar);
  wrap.appendChild(el('div', { class: 'page-bar-label' }, `${fighter.pages} / ${fighter.fileCap}`));
  return wrap;
}

function renderCondRow(fighter) {
  const row = el('div', { class: 'cond-row' });
  for (const id of ['FEVERING', 'MENDING', 'DRAINED', 'BROKEN', 'SEDATED']) {
    const stacks = fighter.conditions[id] || 0;
    if (stacks <= 0) continue;
    const def = CONDITIONS[id];
    const descRaw = (def?.desc || '').replace('{stacks}', stacks);
    row.appendChild(el('div', { class: `cond cond-${id.toLowerCase()}`, title: descRaw }, [
      el('span', { class: 'cond-name' }, def?.name || id),
      el('span', { class: 'cond-stacks' }, String(stacks)),
    ]));
  }
  return row;
}

function renderIntent(intent) {
  const wrap = el('div', { class: 'intent' });
  wrap.appendChild(el('div', { class: 'intent-label' }, 'next move'));
  wrap.appendChild(el('div', { class: 'intent-summary' }, summarizeIntent(intent.effects)));
  if (intent.telegraph) {
    wrap.appendChild(el('div', { class: 'intent-tele', html: parseProse(intent.telegraph) }));
  }
  return wrap;
}

function summarizeIntent(effects) {
  let fillTotal = 0;
  const conditions = [];
  const others = [];
  for (const e of effects) {
    if (e.type === 'fill') fillTotal += e.amount;
    else if (e.type === 'condition') conditions.push(`${CONDITIONS[e.id]?.name || e.id} +${e.stacks}`);
    else if (e.type === 'self_compress') others.push(`compress ${e.amount}`);
    else if (e.type === 'self_condition') others.push(`self ${CONDITIONS[e.id]?.name || e.id}+${e.stacks}`);
    else if (e.type === 'self_cleanse') others.push('cleanse');
  }
  const parts = [];
  if (fillTotal > 0) parts.push(`fill ${fillTotal}`);
  parts.push(...conditions);
  parts.push(...others);
  return parts.join(' · ') || '—';
}

function renderLogColumn() {
  const col = el('div', { class: 'log-col' });
  col.appendChild(el('div', { class: 'log-title' }, '— narrative —'));
  const list = el('div', { class: 'log-list' });
  const lines = state.log.slice(-20);
  for (const entry of lines) {
    const line = el('div', { class: 'log-line ' + (entry.cls || '') });
    line.innerHTML = parseProse(entry.text || '');
    list.appendChild(line);
  }
  col.appendChild(list);
  setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0);
  return col;
}

function renderHandRow() {
  const battle = state.battle;
  const row = el('div', { class: 'hand-row' });
  if (!battle.player.deck.hand.length) {
    row.appendChild(el('div', { class: 'hand-empty' }, '— no cards in hand —'));
    return row;
  }
  for (let i = 0; i < battle.player.deck.hand.length; i++) {
    const c = battle.player.deck.hand[i];
    const playable = canPlayCardAt(i);
    const cls = !playable ? 'card-disabled' : '';
    const e = cardEl(c, {
      playable,
      disabled: !playable,
      onclick: () => {
        if (battle.ended || battle.turn !== 'player') return;
        if (!canPlayCardAt(i)) {
          sfx('reject');
          return;
        }
        playCard(i);
        render();
      }
    });
    if (cls) e.classList.add(cls);
    row.appendChild(e);
  }
  return row;
}

function renderBottomBar() {
  const battle = state.battle;
  const bar = el('div', { class: 'bottom-bar' });

  bar.appendChild(el('div', { class: 'insight' }, [
    el('span', { class: 'insight-label' }, 'insight'),
    el('span', { class: 'insight-value' }, `${battle.insight} / ${battle.maxInsight}`),
  ]));

  bar.appendChild(el('div', { class: 'piles' }, [
    pileEl('draw', battle.player.deck.draw.length),
    pileEl('discard', battle.player.deck.discard.length),
    pileEl('exhaust', battle.player.deck.exhaust.length),
  ]));

  const canEnd = !battle.ended && battle.turn === 'player';
  const endBtn = el('button', {
    class: 'doc-button end-turn-btn' + (canEnd ? '' : ' disabled'),
    onclick: canEnd ? () => { endPlayerTurn(); render(); } : null,
  }, [battle.turn === 'player' ? '▸ end turn' : '— their turn —']);
  bar.appendChild(endBtn);

  return bar;
}

function pileEl(name, count) {
  return el('div', { class: 'pile' }, [
    el('span', { class: 'pile-name' }, name),
    el('span', { class: 'pile-count' }, String(count)),
  ]);
}

function renderBattleEnd(battle) {
  const overlay = el('div', { class: 'battle-end-overlay' });
  const inner = el('div', { class: 'battle-end-inner' });

  if (battle.outcome === 'win') {
    inner.appendChild(el('div', { class: 'battle-end-title' }, `${battle.enemy.name} discharged.`));
    if (battle.isBoss) {
      inner.appendChild(el('button', { class: 'doc-button', onclick: () => {
        sfx('select');
        state.battle = null;
        state.screen = 'victory';
        render();
      } }, '▸ proceed'));
    } else {
      inner.appendChild(el('button', { class: 'doc-button', onclick: () => {
        sfx('select');
        const room = currentRoom();
        const def = room ? PATIENTS[room.speciesId] : null;
        state.pending = {
          speciesId: room ? room.speciesId : null,
          options: def ? [...(def.cards || [])] : [],
        };
        state.battle = null;
        state.screen = 'absorb';
        render();
      } }, '▸ close their file'));
    }
  } else {
    inner.appendChild(el('div', { class: 'battle-end-title loss' }, `${battle.player.name} admitted.`));
    inner.appendChild(el('button', { class: 'doc-button', onclick: () => {
      sfx('select');
      state.battle = null;
      state.screen = 'gameover';
      render();
    } }, '▸ continue'));
  }
  overlay.appendChild(inner);
  return overlay;
}
