import { state, pushLog } from './state.js';
import { CARDS, CONDITIONS, VOICE } from './data.js';
import { applyCondition, transferConditions, getStacks } from './conditions.js';
import { drawOne, exhaustFromHandByIdx, addToHand, addToDrawPileTop, addToDrawPileShuffled } from './deck.js';
import { makeCard } from './card.js';
import { sfx } from './audio.js';
import { spawnFloat } from './ui/animations.js';

const CONDITION_LABEL = id => CONDITIONS[id]?.name || id;

function defaultTarget(type) {
  switch (type) {
    case 'fill': return 'enemy';
    case 'compress': return 'self';
    case 'condition': return 'enemy';
    case 'cleanse': return 'self';
    case 'self_compress': return 'self';
    case 'self_condition': return 'self';
    case 'self_cleanse': return 'self';
    default: return 'enemy';
  }
}

function resolveTarget(effect, source, battle) {
  const t = effect.target || defaultTarget(effect.type);
  return t === 'self' ? source : (source === battle.player ? battle.enemy : battle.player);
}

function addPages(fighter, amount, battle) {
  if (amount <= 0) return 0;
  if (battle.shellSide === fighter.side) {
    pushLog({ text: `Nothing reaches ${fighter.name}.`, cls: 'cls-neutral' });
    return 0;
  }
  const before = fighter.pages;
  fighter.pages = Math.min(fighter.fileCap, fighter.pages + amount);
  const delta = fighter.pages - before;
  if (delta > 0) try { spawnFloat(fighter.side, '+' + delta, 'fill'); } catch (e) {}
  return delta;
}

function removePages(fighter, amount) {
  if (amount <= 0) return 0;
  const before = fighter.pages;
  fighter.pages = Math.max(0, fighter.pages - amount);
  const delta = before - fighter.pages;
  if (delta > 0) try { spawnFloat(fighter.side, '−' + delta, 'compress'); } catch (e) {}
  return delta;
}

export function runEffect(effect, ctx) {
  const e = effect;
  const battle = ctx.battle;
  const source = ctx.source;
  const target = resolveTarget(e, source, battle);
  switch (e.type) {
    case 'fill': {
      const got = addPages(target, e.amount || 0, battle);
      if (got > 0) {
        sfx('fill');
        pushLog({ text: `${target.name} +${got} pages.`, cls: target === battle.player ? 'cls-fill-self' : 'cls-fill' });
        battle.lastFloat = { side: target.side, kind: 'fill', amount: got };
      }
      break;
    }
    case 'compress':
    case 'self_compress': {
      const t = e.type === 'self_compress' ? source : target;
      const dropped = removePages(t, e.amount || 0);
      if (dropped > 0) {
        sfx('compress');
        pushLog({ text: `${t.name} −${dropped} pages.`, cls: 'cls-compress' });
        battle.lastFloat = { side: t.side, kind: 'compress', amount: dropped };
      }
      break;
    }
    case 'condition': {
      applyCondition(target, e.id, e.stacks);
      sfx('condition');
      pushLog({ text: `${target.name}: ${CONDITION_LABEL(e.id)} ${e.stacks > 0 ? '+' : ''}${e.stacks}.`, cls: 'cls-cond' });
      break;
    }
    case 'self_condition': {
      applyCondition(source, e.id, e.stacks);
      sfx('condition');
      pushLog({ text: `${source.name}: ${CONDITION_LABEL(e.id)} ${e.stacks > 0 ? '+' : ''}${e.stacks}.`, cls: 'cls-cond' });
      break;
    }
    case 'cleanse':
    case 'self_cleanse': {
      const t = e.type === 'self_cleanse' ? source : target;
      let count = 0;
      for (const id of Object.keys(t.conditions)) {
        if (t.conditions[id] > 0 && CONDITIONS[id]?.cleansable) { t.conditions[id] = 0; count++; }
      }
      if (count > 0) {
        sfx('compress');
        pushLog({ text: `${t.name} clears.`, cls: 'cls-cond' });
      }
      break;
    }
    case 'draw': {
      for (let i = 0; i < (e.amount || 0); i++) drawOne(battle.player.deck);
      sfx('draw');
      break;
    }
    case 'insight': {
      battle.insight = Math.max(0, battle.insight + (e.amount || 0));
      break;
    }
    case 'take_pages': {
      const got = addPages(source, e.amount || 0, battle);
      if (got > 0) pushLog({ text: `${source.name} +${got} pages (cost).`, cls: 'cls-fill-self' });
      break;
    }
    case 'retain_hand': {
      battle.retainHand = true;
      pushLog({ text: 'Hand kept.', cls: 'cls-neutral' });
      break;
    }
    case 'echo_next': {
      battle.echoNext = true;
      pushLog({ text: 'The next card plays twice.', cls: 'cls-neutral' });
      break;
    }
    case 'negate_intent': {
      if (battle.enemy.queuedIntent) {
        battle.enemy.queuedIntent = null;
        battle.enemy.intentSkipped = true;
        pushLog({ text: VOICE.events.intent_negated || 'It does not.', cls: 'cls-neutral' });
      }
      break;
    }
    case 'reroll_intent': {
      battle.rerollEnemyIntent = true;
      pushLog({ text: VOICE.events.intent_rerolled || 'They begin again.', cls: 'cls-neutral' });
      break;
    }
    case 'shell_turn': {
      battle.shellSide = 'player';
      pushLog({ text: 'Nothing reaches you this turn.', cls: 'cls-neutral' });
      break;
    }
    case 'transfer_conditions': {
      const moved = transferConditions(source, target);
      if (moved.length > 0) {
        sfx('condition');
        pushLog({ text: `${moved.length} condition(s) transfer to ${target.name}.`, cls: 'cls-cond' });
      } else {
        pushLog({ text: 'Nothing to transfer.', cls: 'cls-neutral' });
      }
      break;
    }
    case 'exhaust_from_hand': {
      const hand = battle.player.deck.hand;
      let bestIdx = -1;
      for (let i = hand.length - 1; i >= 0; i--) {
        if (hand[i].instanceId !== ctx.card.instanceId) { bestIdx = i; break; }
      }
      if (bestIdx < 0) {
        battle.exhaustFlag = false;
        if (!e.optional) ctx.abortPlay = true;
        break;
      }
      const exh = exhaustFromHandByIdx(battle.player.deck, bestIdx);
      battle.exhaustFlag = true;
      sfx('compress');
      pushLog({ text: `${exh.name} exhausted.`, cls: 'cls-neutral' });
      break;
    }
    case 'fill_if_exhausted': {
      if (battle.exhaustFlag) {
        const got = addPages(target, e.amount || 0, battle);
        if (got > 0) {
          sfx('fill');
          pushLog({ text: `${target.name} +${got} pages.`, cls: 'cls-fill' });
        }
      }
      battle.exhaustFlag = false;
      break;
    }
    case 'copy_to_draw': {
      const c = makeCard(e.cardId, { flags: e.flags });
      addToDrawPileShuffled(battle.player.deck, c);
      pushLog({ text: `${c.name} shuffled into draw.`, cls: 'cls-neutral' });
      break;
    }
    case 'copy_to_hand': {
      const c = makeCard(e.cardId, { flags: e.flags });
      addToHand(battle.player.deck, c);
      pushLog({ text: `${c.name} added to hand.`, cls: 'cls-neutral' });
      break;
    }
    case 'copy_from_discard_to_hand': {
      const discard = battle.player.deck.discard;
      if (discard.length === 0) {
        pushLog({ text: 'Discard is empty.', cls: 'cls-neutral' });
        break;
      }
      const proto = discard[discard.length - 1];
      const c = makeCard(proto.id);
      addToHand(battle.player.deck, c);
      pushLog({ text: `${c.name} copied to hand.`, cls: 'cls-neutral' });
      break;
    }
    case 'fill_scale_with_self_pages': {
      const bonus = Math.floor(source.pages / 5) * (e.perFivePages || 1);
      const amt = (e.base || 0) + bonus;
      const got = addPages(target, amt, battle);
      if (got > 0) { sfx('fill'); pushLog({ text: `${target.name} +${got} pages.`, cls: 'cls-fill' }); }
      break;
    }
    case 'fill_scale_with_self_threshold': {
      const amt = source.pages >= (e.ifAtLeast || 0) ? ((e.base || 0) + (e.bonus || 0)) : (e.base || 0);
      const got = addPages(target, amt, battle);
      if (got > 0) { sfx('fill'); pushLog({ text: `${target.name} +${got} pages.`, cls: 'cls-fill' }); }
      break;
    }
    case 'fill_scale_with_condition': {
      const amt = getStacks(target, e.condition) > 0 ? (e.ifPresent || 0) : (e.base || 0);
      const got = addPages(target, amt, battle);
      if (got > 0) { sfx('fill'); pushLog({ text: `${target.name} +${got} pages.`, cls: 'cls-fill' }); }
      break;
    }
    case 'substitute': {
      const hand = battle.player.deck.hand;
      const idx = hand.findIndex(c => c.instanceId !== ctx.card.instanceId);
      if (idx < 0) { ctx.abortPlay = true; break; }
      const sac = hand[idx];
      const cost = Math.max(1, sac.cost || 1);
      exhaustFromHandByIdx(battle.player.deck, idx);
      const amt = cost * (e.multiplier || 4);
      const got = addPages(target, amt, battle);
      if (got > 0) { sfx('fill'); pushLog({ text: `${sac.name} substitutes for ${got} pages.`, cls: 'cls-fill' }); }
      break;
    }
    case 'apply_random_condition': {
      const ids = ['FEVERING', 'MENDING', 'DRAINED', 'BROKEN', 'SEDATED'].filter(id => id !== 'MENDING');
      const id = ids[Math.floor(Math.random() * ids.length)];
      applyCondition(target, id, e.stacks || 1);
      sfx('condition');
      pushLog({ text: `${target.name}: ${CONDITION_LABEL(id)} +${e.stacks || 1}.`, cls: 'cls-cond' });
      break;
    }
    case 'summon_haunt': {
      battle.hauntsPlayer = battle.hauntsPlayer || [];
      battle.hauntsPlayer.push({ amount: e.amount, turns: e.turns });
      pushLog({ text: `Something stays in the room.`, cls: 'cls-cond' });
      break;
    }
    default:
      pushLog({ text: `(unhandled effect: ${e.type})`, cls: 'cls-neutral' });
  }
}
