import { shuffleInPlace } from './rng.js';
import { sfx } from './audio.js';

export function makeBattleDeck(cardInstances) {
  return {
    draw: shuffleInPlace([...cardInstances]),
    hand: [],
    discard: [],
    exhaust: [],
  };
}

export function drawOne(deck) {
  if (deck.draw.length === 0) {
    if (deck.discard.length === 0) return null;
    deck.draw = shuffleInPlace([...deck.discard]);
    deck.discard.length = 0;
    sfx('shuffle');
  }
  const card = deck.draw.pop();
  deck.hand.push(card);
  return card;
}

export function drawN(deck, n) {
  const drawn = [];
  for (let i = 0; i < n; i++) {
    const c = drawOne(deck);
    if (!c) break;
    drawn.push(c);
  }
  return drawn;
}

export function discardHand(deck, retainSet) {
  const keep = [];
  for (const c of deck.hand) {
    if (retainSet && retainSet.has(c.instanceId)) {
      keep.push(c);
    } else if (c.flags?.ethereal) {
      deck.exhaust.push(c);
    } else {
      deck.discard.push(c);
    }
  }
  deck.hand = keep;
}

export function exhaustFromHandByIdx(deck, idx) {
  const c = deck.hand[idx];
  if (!c) return null;
  deck.hand.splice(idx, 1);
  deck.exhaust.push(c);
  return c;
}

export function discardFromHandByIdx(deck, idx) {
  const c = deck.hand[idx];
  if (!c) return null;
  deck.hand.splice(idx, 1);
  deck.discard.push(c);
  return c;
}

export function exhaustByInstance(deck, instanceId) {
  const i = deck.hand.findIndex(c => c.instanceId === instanceId);
  if (i < 0) return null;
  return exhaustFromHandByIdx(deck, i);
}

export function addToDrawPileTop(deck, card) { deck.draw.push(card); }
export function addToDrawPileShuffled(deck, card) {
  deck.draw.push(card);
  shuffleInPlace(deck.draw);
}
export function addToHand(deck, card) { deck.hand.push(card); }

export function deckSize(deck) {
  return deck.draw.length + deck.hand.length + deck.discard.length + deck.exhaust.length;
}
