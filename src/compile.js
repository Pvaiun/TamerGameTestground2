import { state } from './state.js';
import { RECIPES } from './data.js';
import { makeCard } from './card.js';
import { recordDiagnosis } from './archive.js';

export function findRecipe(cardA, cardB) {
  const schoolsKey = [cardA.school, cardB.school].sort().join('|');
  for (const r of RECIPES.recipes) {
    if ([...r.inputs].sort().join('|') === schoolsKey) return r;
  }
  return null;
}

export function performCompile(cardAIdx, cardBIdx) {
  const run = state.run;
  if (!run) return null;
  if (cardAIdx === cardBIdx) return null;
  const cardA = run.deck[cardAIdx];
  const cardB = run.deck[cardBIdx];
  if (!cardA || !cardB) return null;

  const recipe = findRecipe(cardA, cardB);
  let resultCardId, diagnosis, notes;
  if (recipe) {
    resultCardId = recipe.result;
    diagnosis = recipe.diagnosis;
    notes = recipe.notes || '';
  } else {
    resultCardId = 'synthesis_the_witness';
    diagnosis = '[Anomalous compilation]';
    notes = 'Subject does not match any schema.';
  }

  const newCard = makeCard(resultCardId);
  const indices = [cardAIdx, cardBIdx].sort((a, b) => b - a);
  for (const i of indices) run.deck.splice(i, 1);
  run.deck.push(newCard);

  if (!run.diagnoses.includes(diagnosis)) run.diagnoses.push(diagnosis);
  recordDiagnosis(diagnosis, notes);

  return { card: newCard, diagnosis, notes };
}

export function compilableCards() {
  if (!state.run) return [];
  return state.run.deck.filter(c => !c.flags?.unplayable);
}
