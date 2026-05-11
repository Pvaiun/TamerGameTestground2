import { CONDITIONS, VOICE } from './data.js';
import { pushLog } from './state.js';

export const CONDITION_IDS = ['FEVERING', 'MENDING', 'DRAINED', 'BROKEN', 'SEDATED'];

export function makeConditionsBag() {
  const b = {};
  for (const id of CONDITION_IDS) b[id] = 0;
  return b;
}

export function applyCondition(fighter, id, stacks) {
  if (!CONDITIONS[id]) return;
  fighter.conditions[id] = Math.max(0, (fighter.conditions[id] || 0) + stacks);
}

export function getStacks(fighter, id) {
  return fighter.conditions[id] || 0;
}

export function hasCondition(fighter, id) {
  return getStacks(fighter, id) > 0;
}

export function cleanseAll(fighter) {
  for (const id of CONDITION_IDS) {
    if (CONDITIONS[id]?.cleansable !== false) fighter.conditions[id] = 0;
  }
}

export function transferConditions(from, to) {
  const moved = [];
  for (const id of CONDITION_IDS) {
    const s = from.conditions[id] || 0;
    if (s > 0) {
      moved.push({ id, stacks: s });
      to.conditions[id] = (to.conditions[id] || 0) + s;
      from.conditions[id] = 0;
    }
  }
  return moved;
}

export function tickStartOfTurn(fighter, battle, isPlayerTurn) {
  for (const id of CONDITION_IDS) {
    const stacks = fighter.conditions[id] || 0;
    if (stacks <= 0) continue;
    const def = CONDITIONS[id];
    if (!def || def.tickOn !== 'ownTurnStart' || !def.tickEffect) continue;
    const eff = def.tickEffect;
    const perStack = eff.perStack || 1;
    if (eff.type === 'fill') {
      const dmg = stacks * perStack;
      fighter.pages = Math.min(fighter.fileCap, fighter.pages + dmg);
      pushLog({ text: `${fighter.name}: ${def.name}. +${dmg} pages.`, cls: 'cls-cond' });
    } else if (eff.type === 'compress') {
      const heal = stacks * perStack;
      fighter.pages = Math.max(0, fighter.pages - heal);
      pushLog({ text: `${fighter.name}: ${def.name}. −${heal} pages.`, cls: 'cls-cond' });
    } else if (eff.type === 'insight' && isPlayerTurn) {
      const delta = stacks * perStack;
      battle.insight = Math.max(0, battle.insight + delta);
      pushLog({ text: `${fighter.name}: ${def.name}. ${delta >= 0 ? '+' : ''}${delta} insight.`, cls: 'cls-cond' });
    } else if (eff.type === 'lose_draw' && isPlayerTurn) {
      battle.drawReduction = (battle.drawReduction || 0) + stacks * perStack;
      pushLog({ text: `${fighter.name}: ${def.name}. Draw ${stacks * perStack} fewer.`, cls: 'cls-cond' });
    }
  }
}

export function decayEndOfTurn(fighter) {
  for (const id of CONDITION_IDS) {
    const stacks = fighter.conditions[id] || 0;
    if (stacks <= 0) continue;
    const def = CONDITIONS[id];
    if (def?.decay === 'endOfOwnTurn') fighter.conditions[id] = Math.max(0, stacks - 1);
  }
}

export function decayOnCardPlay(fighter) {
  for (const id of CONDITION_IDS) {
    const stacks = fighter.conditions[id] || 0;
    if (stacks <= 0) continue;
    const def = CONDITIONS[id];
    if (def?.decay === 'perCardPlay') fighter.conditions[id] = Math.max(0, stacks - 1);
  }
}
