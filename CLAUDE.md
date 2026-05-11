# Bloodlines — Codebase Map (redesigned)

A solo deckbuilder roguelite. You are Patient 0413. Across ten rooms of a hospital you do not remember being admitted to, you compile a casefile by treating and absorbing the conditions of other patients. Each patient is a self-contained tragedy. By the time you reach the Attending, the file is full — and so are you.

Vanilla ES modules. No build step. No deps. Open `index.html` to run.

## Pillars

1. **The file is the gameplay.** Combat is two case files facing each other. You fill theirs with their name; they fill yours with yours. There is no HP — there are pages.
2. **Conditions, not elements.** No fire/water/grass. The five SCHOOLS are GRIEF, HUNGER, STILLNESS, DISSOCIATION, INTRUSION. Each species belongs to a school whose mechanics reflect the writing.
3. **Absorption is the cost of power.** Every patient defeated gives you one of their cards — and adds a TAINT page to your own file. By wave 10 you are mostly what you've taken.
4. **Compilation, not breeding.** At waves 3/6/9, combine two cards from your deck into a synthesis. Known recipes are named DIAGNOSES; unknown combos derive procedurally. Discovered diagnoses persist in the ARCHIVE.
5. **Three voice registers, kept strict.** Patient files: third-person clinical, [Bracketed] nicknames. Card text and mechanical log: neutral present tense. Protagonist marginalia: first-person, italic, intrusive — appears between rooms and on certain card plays.

## Architecture in one paragraph

`src/main.js` awaits `loadData()` (loads `data/*.json` into named exports on `src/data.js`), then calls `render()`. The whole app is **state mutation + re-render**: modules import `state` from `src/state.js`, mutate it, call `render()` from `src/ui/render.js`. `render()` clears `#app` and dispatches on `state.screen` to a renderer in `src/ui/screens.js`. There is no virtual DOM, no framework, no router. UI builds via `el(tag, props, children)` from `src/ui/dom.js`.

## File map

### Data (JSON; drives behavior — add fields here rather than hardcoding)
- `data/patients.json` — every patient: species, school, name (`[Bracketed]`), affliction (passive), card pool, intent script, fileCap.
- `data/cards.json` — every card: id, name, cost, school, rarity, effects[], optional flags (`exhaust`, `retain`, `unplayable`, `ethereal`).
- `data/conditions.json` — the five conditions (FEVERING, MENDING, DRAINED, BROKEN, SEDATED) — schema for stacks/turns/per-turn payload.
- `data/recipes.json` — named compilation recipes (school+school or card+card) producing diagnoses.
- `data/starters.json` — starting casefiles (decks + protagonist passives).
- `data/glyphs.json` — 16×16 hand-authored bitmap glyphs (one per species; same as before).
- `data/voiceprose.json` — narrative voice: patient subtitles, notes, card prose, condition prose, event prose. Existing markup: `~~strike~~`, `[[N]]` (N-char redaction bar), `**gold**`, `!!red!!`.

### Core
- `src/state.js` — `state` singleton, `pushLog`, `resetRun`, constants (`TOTAL_ROOMS=10`, `COMPILE_ROOMS={3,6,9}`).
- `src/data.js` — `loadData()` + named exports (`PATIENTS`, `CARDS`, `CONDITIONS`, `RECIPES`, `STARTERS`, `GLYPHS`, `VOICE`).
- `src/rng.js` — `rand`, `randi`, `pick`, `pickN`, `pickWeighted`, `sleep`, `shuffleInPlace`.
- `src/audio.js` — `sfx(type)` WebAudio bleeps; event types include `draw, play, fill, condition, faint, victory, absorb, compile, page`.
- `src/version.js` — version string.

### Game logic
- `src/run.js` — `startRun(starterId)`, `enterRoom(roomIdx)`, `advanceRoom()`, `endRun(outcome)`. Generates the run map (10 rooms with branches).
- `src/card.js` — `makeCard(id)`, `cardDescriptor(card)` (renders effect prose), `costAfterMods(card, fighter)`.
- `src/deck.js` — `Deck` class wraps draw / hand / discard / exhaust piles. `drawN`, `discardHand`, `shuffle`, `reshuffleFromDiscard`, `addToDeck`, `addToHand`.
- `src/conditions.js` — `applyCondition`, `tickConditions`, `hasCondition`, `cleanseConditions`. Each condition has schema in `data/conditions.json` defining how stacks decay and what tick payload they emit.
- `src/patient.js` — `makePatient(speciesId, room)`, `chooseIntent(patient, ctx)`, `runIntent(patient, ctx)`. AI is intent-script driven (Slay-The-Spire style telegraphed turns).
- `src/battle.js` — orchestrator: `beginBattle(patient)`, `playerPlay(handIdx)`, `playerEndTurn()`, `enemyTurn()`, `checkBattleEnd()`. Calls `effects.js` for card payloads.
- `src/effects.js` — effect dispatcher. Each card effect has a `type` (e.g. `fill`, `condition`, `draw`, `compress`, `cleanse`, `insight`, `taint`, `exhaust_random`, `copy_card`, etc.) and is dispatched here.
- `src/compile.js` — `findRecipe(cardA, cardB)`, `synthesizeCard(cardA, cardB)` (procedural fallback if no recipe), `commitCompilation`.
- `src/archive.js` — localStorage persistence. `loadArchive`, `saveArchive`, `recordPatient`, `recordDiagnosis`, `recordRunOutcome`. Tracks unlocks.

### UI
- `src/ui/render.js` — `render()` dispatcher; `advanceScreen(name)`. Renders the `// bloodlines` masthead on non-battle screens.
- `src/ui/screens.js` — every non-battle screen: `renderStart, renderIntake, renderMap, renderAbsorb, renderCompile, renderConsult, renderEvent, renderVictory, renderGameover, renderArchive`. Each opens with a `// page · subject` tag and ends with `▸` action rows.
- `src/ui/battle.js` — battle screen. Two facing case files (you and them), hand of cards across the bottom, narrative log on the side. Click to play cards.
- `src/ui/cardEl.js` — `cardEl(card, opts)` builds the visual card. Hover/long-press for full inspect modal.
- `src/ui/dom.js` — `el(tag, props, children)`, `attachLongPress`, `app()`, tooltip helpers (kept from before).
- `src/ui/textCorrupt.js` — `parseProse(input)` for markup, `strike/redact/gold` element builders (kept from before).
- `src/ui/glyphs.js` — `renderGlyph(species)` returns SVG markup (kept from before).
- `src/ui/animations.js` — `spawnFloat`, `spawnCallout`, `shakeStage`, `playLunge`, `playRecoil` (kept; remapped to new selectors).

### Assets / tooling
- `index.html` — single page; `<div id="app">` + `<div id="modal-root">`; loads `src/main.js` as module.
- `styles.css` — all styles; layered as tokens → corruption text → battle layout (two-file desk + hand) → document page screens.

## The five condition schools

| School | Theme | Mechanical archetype |
|---|---|---|
| GRIEF | Absence, loss, what stays | Cards that exhaust or cost file pages; scale on losses; payoff cards |
| HUNGER | Consumption, escalation | High-cost high-damage; consume hand; growing power |
| STILLNESS | Waiting, catatonia, the bench | Defense, draw, ramp; multi-turn payoffs |
| DISSOCIATION | Identity, doubling, slipping | Copy, transfer, redirect, scry |
| INTRUSION | What should not be here | Status afflicting, chaos, summons, opponent disruption |

## Patient → school mapping

Each existing 16×16 glyph is preserved. Each species is assigned exactly one school.

- GRIEF: Emberkin, Cinderling, Frostfin, Glimmerfox, Dawnstag, Pyrelord
- HUNGER: Ashmaw, Charnel, Deepmaw, Sproutkin, Vinewyrm, Bloomback
- STILLNESS: Brineback, Coralhusk, Loamback, Mosshorn, Halowyrm, Soothlick
- DISSOCIATION: Tidewhelp, Rivergeist, Mireling, Hollowoak, Wraithfin, Shadowmaw
- INTRUSION: Magmaw, Thornling, Voidling, Nightcreep, Umbragale, Aurabeast
- Protagonist: Lumenpup

## Run structure

10 rooms. Layout:
- Rooms 1, 2, 4, 5, 7, 8 — battle (patient encounter, random pool by school weight increasing with depth)
- Room 3, 6, 9 — compile (between-battle synthesis) OR consult (shop) OR event, decided by branch
- Room 10 — The Attending (boss; plays the player's own absorbed cards)

After each battle: choose 1 of 3 offered cards from the patient's pool. Absorbing also adds 1 TAINT card to the protagonist's deck (an unplayable / weak card representing the residue).

## Adding things — checklists

**New card:** add an entry in `cards.json` with effects composed of existing types. New effect type → add to dispatch in `effects.js`. Reference the card id in a patient's pool or a starter's deck.

**New patient:** add entry in `patients.json` (school, fileCap, affliction id, card pool, intents). Add glyph to `glyphs.json` if not present. Add `subtitles[species]` and `notes[species]` to `voiceprose.json`.

**New condition:** add to `conditions.json` (tick behavior, decay). Add a slot in fighter `conditions:{}` map. Decide whether it can be cleansed and how it telegraphs.

**New recipe:** add to `recipes.json` with inputs (schools or card ids), result card id, diagnosis text.

**New screen:** renderer in `screens.js`, register in `render.js` switch, set `state.screen = 'name'` to enter.

## Conventions

- **Data over code.** New numbers go in JSON. JSON entries are read by named handlers in JS.
- **`state` is global and mutated directly.** Don't pass it as a parameter; import it.
- **Re-render after mutation.** Any user-visible change ends with `render()`. Async flows interleave `render()` and `await sleep(ms)` for animation pacing.
- **No build step.** Browser-native ES modules.
- **No comments unless non-obvious.** Identifiers carry intent.
- **One voice per layer.** Patient files = clinical third person. Card text = mechanical neutral. Protagonist whispers = first-person italic intrusive.

## Test / verify

No automated tests. Manual: open `index.html`. Combat changes verified via the in-battle log (`state.log`, rendered next to the desk).
