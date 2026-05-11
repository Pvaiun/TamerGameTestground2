import { state, pushLog, STARTING_HAND_SIZE, STARTING_INSIGHT } from './state.js';
import { makeBattleDeck, drawN, discardHand, addToDrawPileShuffled } from './deck.js';
import { makeCard, effectiveCost } from './card.js';
import { makeConditionsBag, tickStartOfTurn, decayEndOfTurn, decayOnCardPlay } from './conditions.js';
import { runEffect } from './effects.js';
import { chooseNextIntent } from './patient.js';
import { sfx } from './audio.js';
import { STARTERS } from './data.js';

export function beginBattle(patient) {
  const run = state.run;
  const starterDef = STARTERS[run.starter];

  const player = {
    side: 'player',
    species: 'Lumenpup',
    name: '[Patient 0413]',
    fileCap: run.fileCap,
    pages: 0,
    conditions: makeConditionsBag(),
    deck: makeBattleDeck(run.deck.map(c => makeCard(c.id, { flags: c.flags }))),
  };

  const battle = {
    player,
    enemy: patient,
    turn: 'player',
    turnCount: 1,
    maxInsight: starterDef.insightPerTurn || STARTING_INSIGHT,
    insight: starterDef.insightPerTurn || STARTING_INSIGHT,
    handSize: starterDef.handSize || STARTING_HAND_SIZE,
    drawReduction: 0,
    retainHand: false,
    echoNext: false,
    shellSide: null,
    exhaustFlag: false,
    rerollEnemyIntent: false,
    hauntsPlayer: [],
    ended: false,
    outcome: null,
    isBoss: !!patient.def?.isBoss,
  };

  state.battle = battle;
  state.log = [];

  if (battle.isBoss) {
    const absorbCount = run.absorbed.length;
    const noteCount = Math.max(1, Math.floor(absorbCount / 2));
    for (let i = 0; i < noteCount; i++) {
      addToDrawPileShuffled(player.deck, makeCard('attending_note'));
    }
    battle.enemy.fileCap += absorbCount * 4;
  }

  battle.enemy.queuedIntent = chooseNextIntent(battle.enemy);
  pushLog({ text: `${battle.enemy.name} sits across the desk.`, cls: 'cls-event' });

  startPlayerTurn({ initial: true });
}

function startPlayerTurn(opts = {}) {
  const battle = state.battle;
  if (battle.ended) return;
  battle.turn = 'player';

  battle.retainHand = false;
  battle.echoNext = false;
  battle.shellSide = null;
  battle.exhaustFlag = false;
  battle.rerollEnemyIntent = false;
  battle.drawReduction = 0;

  tickStartOfTurn(battle.player, battle, true);
  if (checkBattleEnd()) return;

  if (!opts.initial) {
    battle.insight = battle.maxInsight;
  }

  if (battle.hauntsPlayer && battle.hauntsPlayer.length > 0) {
    const remaining = [];
    for (const h of battle.hauntsPlayer) {
      battle.enemy.pages = Math.min(battle.enemy.fileCap, battle.enemy.pages + h.amount);
      pushLog({ text: `Something stays in the room. ${battle.enemy.name} +${h.amount} pages.`, cls: 'cls-fill' });
      sfx('fill');
      h.turns -= 1;
      if (h.turns > 0) remaining.push(h);
    }
    battle.hauntsPlayer = remaining;
    if (checkBattleEnd()) return;
  }

  const drawCount = Math.max(0, battle.handSize - (battle.drawReduction || 0));
  drawN(battle.player.deck, drawCount);
  if (drawCount > 0) sfx('draw');

  processAutoPlayCards();
  if (checkBattleEnd()) return;
}

export function processAutoPlayCards() {
  const battle = state.battle;
  if (!battle || battle.ended) return;
  const hand = battle.player.deck.hand;
  let i = 0;
  while (i < hand.length) {
    const c = hand[i];
    if (c.flags?.auto_play) {
      pushLog({ text: c.prose || c.name, cls: 'cls-cardplay-enemy' });
      const ctx = { battle, source: battle.player, card: c, abortPlay: false };
      for (const e of c.effects) {
        runEffect(e, ctx);
        if (checkBattleEnd()) return;
      }
      hand.splice(i, 1);
      battle.player.deck.exhaust.push(c);
      continue;
    }
    i++;
  }
}

export function canPlayCardAt(idx) {
  const battle = state.battle;
  if (!battle || battle.ended || battle.turn !== 'player') return false;
  const c = battle.player.deck.hand[idx];
  if (!c) return false;
  if (c.flags?.unplayable) return false;
  return effectiveCost(c, battle) <= battle.insight;
}

export function rejectionReason(idx) {
  const battle = state.battle;
  if (!battle || battle.ended || battle.turn !== 'player') return 'Not your turn.';
  const c = battle.player.deck.hand[idx];
  if (!c) return 'No card.';
  if (c.flags?.unplayable) return 'Unplayable.';
  if (effectiveCost(c, battle) > battle.insight) return 'Not enough insight.';
  return null;
}

export function playCard(idx) {
  const battle = state.battle;
  if (!canPlayCardAt(idx)) return false;
  const c = battle.player.deck.hand[idx];
  const cost = effectiveCost(c, battle);
  battle.insight -= cost;
  battle.player.deck.hand.splice(idx, 1);

  sfx('play');
  pushLog({ text: c.prose || c.name, cls: 'cls-cardplay' });

  const ctx = { battle, source: battle.player, card: c, abortPlay: false };
  for (const e of c.effects) {
    runEffect(e, ctx);
    if (ctx.abortPlay) break;
    if (checkBattleEnd()) break;
  }

  decayOnCardPlay(battle.player);
  processAutoPlayCards();

  if (battle.echoNext && !ctx.abortPlay && !battle.ended) {
    battle.echoNext = false;
    pushLog({ text: '(echo.)', cls: 'cls-neutral' });
    const ctx2 = { battle, source: battle.player, card: c, abortPlay: false };
    for (const e of c.effects) {
      runEffect(e, ctx2);
      if (ctx2.abortPlay) break;
      if (checkBattleEnd()) break;
    }
  }

  if (ctx.abortPlay && !battle.ended) {
    battle.insight += cost;
    battle.player.deck.hand.push(c);
    pushLog({ text: `${c.name} fizzles.`, cls: 'cls-neutral' });
  } else if (!battle.ended) {
    if (c.flags?.exhaust) {
      battle.player.deck.exhaust.push(c);
    } else {
      battle.player.deck.discard.push(c);
    }
  }

  if (battle.rerollEnemyIntent && !battle.ended) {
    battle.enemy.queuedIntent = chooseNextIntent(battle.enemy);
    battle.rerollEnemyIntent = false;
  }
  return true;
}

export function endPlayerTurn() {
  const battle = state.battle;
  if (!battle || battle.ended || battle.turn !== 'player') return;
  sfx('end_turn');

  if (!battle.retainHand) {
    discardHand(battle.player.deck, null);
  } else {
    const keep = [];
    for (const c of battle.player.deck.hand) {
      if (c.flags?.ethereal || c.flags?.unplayable) battle.player.deck.exhaust.push(c);
      else keep.push(c);
    }
    battle.player.deck.hand = keep;
  }

  decayEndOfTurn(battle.player);

  battle.turn = 'enemy';
  enemyTurn();
  if (checkBattleEnd()) return;

  battle.turnCount += 1;
  startPlayerTurn();
}

function enemyTurn() {
  const battle = state.battle;
  if (battle.ended) return;
  const enemy = battle.enemy;

  tickStartOfTurn(enemy, battle, false);
  if (checkBattleEnd()) return;

  if (enemy.intentSkipped) {
    enemy.intentSkipped = false;
    pushLog({ text: `${enemy.name} hesitates.`, cls: 'cls-neutral' });
  } else if (enemy.queuedIntent) {
    pushLog({ text: enemy.queuedIntent.telegraph || '', cls: 'cls-cardplay-enemy' });
    for (const eff of enemy.queuedIntent.effects) {
      const ctx = { battle, source: enemy, card: null, abortPlay: false };
      runEffect(eff, ctx);
      if (checkBattleEnd()) return;
    }
  }

  decayEndOfTurn(enemy);
  enemy.queuedIntent = chooseNextIntent(enemy);
}

export function checkBattleEnd() {
  const battle = state.battle;
  if (!battle || battle.ended) return !!battle?.ended;
  if (battle.enemy.pages >= battle.enemy.fileCap) {
    battle.ended = true;
    battle.outcome = 'win';
    sfx('victory');
    pushLog({ text: `${battle.enemy.name} discharged.`, cls: 'cls-win' });
    return true;
  }
  if (battle.player.pages >= battle.player.fileCap) {
    battle.ended = true;
    battle.outcome = 'loss';
    sfx('defeat');
    pushLog({ text: `${battle.player.name} admitted.`, cls: 'cls-loss' });
    return true;
  }
  return false;
}
