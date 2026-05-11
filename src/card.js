import { CARDS, VOICE } from './data.js';
import { nextInstanceId } from './state.js';

export function makeCard(id, mods = {}) {
  const def = CARDS[id];
  if (!def) {
    return {
      instanceId: nextInstanceId(),
      id,
      name: id,
      cost: 0,
      school: 'BASIC',
      rarity: 'common',
      effects: [],
      flags: {},
      prose: '',
    };
  }
  return {
    instanceId: nextInstanceId(),
    id,
    name: def.name,
    cost: def.cost,
    school: def.school,
    rarity: def.rarity,
    effects: def.effects.map(e => ({ ...e })),
    flags: { ...(def.flags || {}), ...(mods.flags || {}) },
    prose: def.prose || '',
  };
}

export function describeEffect(eff) {
  switch (eff.type) {
    case 'fill': return `Fill ${eff.amount} pages on ${eff.target === 'self' ? 'your' : 'their'} file.`;
    case 'compress': return `Remove ${eff.amount} pages from ${eff.target === 'self' ? 'your' : 'their'} file.`;
    case 'condition': return `${labelCondition(eff.id, eff.stacks)} on ${eff.target === 'self' ? 'you' : 'them'}.`;
    case 'cleanse': return `Cleanse conditions on ${eff.target === 'self' ? 'you' : 'them'}.`;
    case 'draw': return `Draw ${eff.amount}.`;
    case 'insight': return `Gain ${eff.amount} insight.`;
    case 'take_pages': return `Add ${eff.amount} pages to your file.`;
    case 'retain_hand': return `Keep hand at turn end.`;
    case 'echo_next': return `The next card you play this turn plays twice.`;
    case 'negate_intent': return `Cancel their next move.`;
    case 'reroll_intent': return `Force them to reroll their next move.`;
    case 'shell_turn': return `Take no pages from them this turn.`;
    case 'transfer_conditions': return `Move all your conditions onto them.`;
    case 'exhaust_from_hand': return eff.optional ? `Optionally exhaust 1 card.` : `Exhaust 1 card.`;
    case 'fill_if_exhausted': return `If a card was exhausted, fill ${eff.amount}.`;
    case 'copy_to_draw': return `Add a copy of this card to your draw pile.`;
    case 'copy_to_hand': return `Add a copy to your hand.`;
    case 'copy_from_discard_to_hand': return `Copy a card from discard to hand.`;
    case 'fill_scale_with_self_pages': return `Fill ${eff.base} + 1 per 5 of your pages.`;
    case 'fill_scale_with_self_threshold': return `Fill ${eff.base} (${eff.base + eff.bonus} if your pages ≥ ${eff.ifAtLeast}).`;
    case 'fill_scale_with_condition': return `Fill ${eff.base} (${eff.ifPresent} if they are ${eff.condition}).`;
    case 'substitute': return `Exhaust a card from hand; fill its cost × ${eff.multiplier}.`;
    case 'apply_random_condition': return `Apply a random condition (${eff.stacks || 1}) to them.`;
    case 'summon_haunt': return `Each of your turns, fill ${eff.amount} on them for ${eff.turns} turns.`;
    case 'self_compress': return `Remove ${eff.amount} pages from your file.`;
    case 'self_condition': return `${labelCondition(eff.id, eff.stacks)} on you.`;
    case 'self_cleanse': return `Cleanse your conditions.`;
    default: return eff.type;
  }
}

function labelCondition(id, stacks) {
  const map = { FEVERING: 'Fevering', MENDING: 'Mending', DRAINED: 'Drained', BROKEN: 'Broken', SEDATED: 'Sedated' };
  return `${map[id] || id} ${stacks > 0 ? '+' : ''}${stacks}`;
}

export function cardDescriptor(card) {
  if (card.flags?.unplayable) return 'Unplayable.';
  return card.effects.map(describeEffect).join(' ');
}

export function effectiveCost(card, battle) {
  let c = card.cost || 0;
  if (battle && battle.player && battle.player.conditions.BROKEN > 0) c += 1;
  return c;
}
