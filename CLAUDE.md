# Bloodlines — Codebase Map (v2: seven nights)

Turn-based stealth roguelite exploration. You are Patient 0413. The hospital is closing in seven nights. You wake every midnight with an hour before the Attending's rounds, leave your room, and try to find a way out before night seven.

Vanilla ES modules. No build step. No deps. Open `index.html` to run.

## Pillars

1. **The hospital is the game.** A procedural graph of rooms, hallways, wards, storage closets, stairwells, exits. Each run reshuffles.
2. **Patients are setting, not opposition.** Each patient is placed in a room with their glyph and file. You see them, hear them, walk past them. You never act on them. Some make their rooms dangerous; you respond by not going in there.
3. **The Attending is the threat.** A single moving piece that patrols a partly-known route. If they enter your room and you aren't hidden, your file gets a note. Enough notes by night seven and you're admitted as what the file says.
4. **Files are perception.** Every patient's file is viewable. Yours fills with the Attending's observations. The Attending's file (mostly redacted) hints at their schedule. You never edit any file.
5. **Three voices kept strict.** Patient files: clinical third-person, `[Bracketed]` names. Mechanical UI / log: neutral present tense. Protagonist marginalia: first-person italic intrusive — appears in transitions between nights and on certain events.

## Architecture

`src/main.js` awaits `loadData()` then calls `render()`. State is a global singleton in `src/state.js` mutated directly by gameplay code; `render()` reads `state.screen` and dispatches to a renderer. No virtual DOM, no framework, no router. UI builds via `el(tag, props, children)` from `src/ui/dom.js`.

The world state lives in `state.run` (the current run) and `state.world` (the current night's spatial state — player position, attending position, item locations, time-of-night counter, file notes).

## Verbs

The player's verbs come from a hospital hallway at night, not from a card game.

| Verb | Cost | Effect |
|---|---|---|
| MOVE | 1 time-unit | Walk to an adjacent room |
| LOOK | 1 time-unit | Peek into an adjacent room without entering. Reveals contents (patient, items, etc.) |
| LISTEN | 1 time-unit | Pause at a door / in the hall. Reveals sounds (Attending footstep direction, patient noise, exit hum) |
| HIDE | 1 time-unit | Conceal yourself in the current room (cabinet, bed, behind door). Limited slots per room. While hidden, Attending passes through |
| TAKE | 1 time-unit | Pick up an item in the current room |
| READ | 1 time-unit | Read a document in the current room. Reveals lore / hint / file entry |
| WAIT | 1 time-unit | Let time pass |

Each night is a fixed number of time-units (default 30). At end-of-night you must be back in your starting bed or fall asleep wherever you are (auto-caught).

## The Attending

A piece that walks a route. The route has a base shift schedule and drifts over nights as closure approaches. You can:

- Hear footsteps in adjacent rooms (LISTEN)
- See light under their door (peripheral)
- Read their schedule (if you find their office)

Their detection is binary: if they enter your room and you aren't HIDDEN, they note you.

Per-night caps and per-run notes feed the loss condition. Six unforced notes → admission begins. Twelve → admitted, run over.

## File map

### Data
- `data/rooms.json` — room archetypes (ward, supply, office, stairwell, exit-candidate, etc.) with hiding-slot counts and ambient prose.
- `data/items.json` — items: keys, papers, disguises, sedatives. Effects on play.
- `data/patients.json` — the 30 patients reused for placement. Each has: glyph, name, subtitle, notes, **room preference** (which room archetypes they appear in), **ambient effect** (what happens if you're adjacent / look in).
- `data/attending.json` — patrol patterns by night, voice prose for sightings.
- `data/glyphs.json` — kept from v1.
- `data/voiceprose.json` — patient files (kept); plus a new `nights[]` section for the protagonist's between-night marginalia and an `attending` section for what the Attending writes when noting you.

### Core
- `src/state.js` — `state` singleton, `pushLog`, `resetRun`, constants.
- `src/data.js` — `loadData()` + named exports.
- `src/rng.js` — RNG helpers (`rand`, `randi`, `pick`, `pickN`, `pickWeighted`, `shuffleInPlace`).
- `src/audio.js` — procedural SFX. New events: `step`, `door`, `take`, `caught`, `hide`, `tick`, `escape`, `admit`.
- `src/version.js` — version.

### Game logic
- `src/map.js` — procedural floor-plan generation. Builds a graph of rooms with adjacencies, places patients, items, exits.
- `src/world.js` — initialize per-night state. Track player/Attending positions, time, hidden state, items collected.
- `src/turn.js` — process a player action. Advance time. Trigger Attending move. Resolve detection. Apply ambient effects.
- `src/ai.js` — Attending patrol logic. Path computation.
- `src/run.js` — `startRun()`, `beginNight()`, `endNight()`. Tracks notes across nights, manages cross-night state.
- `src/archive.js` — localStorage persistence: which patients you've encountered, which rooms you've seen, run outcomes.

### UI
- `src/ui/render.js` — dispatcher. Routes on `state.screen`.
- `src/ui/screens.js` — non-exploration screens: start, intake, night-start, night-end, archive, victory (escape), gameover (admitted).
- `src/ui/explore.js` — the main gameplay screen: floor plan + current room + action panel + file ticker.
- `src/ui/floorplan.js` — SVG floor plan renderer. Renders the graph of rooms with player/Attending positions and known information.
- `src/ui/roomview.js` — current room view: glyph if patient, description, items, hiding spots.
- `src/ui/dom.js` — kept (el, attachLongPress, tooltip helpers).
- `src/ui/textCorrupt.js` — kept (parseProse, corruption markup).
- `src/ui/glyphs.js` — kept.

## Adding things

**New patient:** entry in `patients.json` (glyph reference, room archetype preference, ambient effect). Add glyph if not present. Add to `voiceprose.json` subtitles/notes if not present.

**New room archetype:** entry in `rooms.json` (name, prose, hiding slots, valid patient preferences, item likelihood).

**New item:** entry in `items.json` (name, prose, effect type, rarity).

**New screen:** renderer in `screens.js`, register in `render.js` switch, set `state.screen` to enter.

## Conventions

- **Data over code.** New parameters go in JSON.
- **`state` is global and mutated directly.** Import and mutate.
- **Re-render after mutation.** Any user-visible change ends with `render()`.
- **No build step.** Browser-native ES modules.
- **No comments unless non-obvious.** Identifiers carry intent.
- **One voice per layer.** Patient files = clinical third person. Mechanical UI = neutral. Protagonist marginalia = first-person italic intrusive.

## Test / verify

No automated tests. Manual: open `index.html`. Headless playthrough is verifiable via Playwright (see prior verification harness if reinstating).
