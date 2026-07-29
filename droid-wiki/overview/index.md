# Pocket Mockster

Pocket Mockster is a monster-catching RPG built from scratch in TypeScript and rendered on an HTML5 canvas. It has original creatures, hand-made pixel art, and classic mechanics: explore an overworld, battle wild creatures and trainers, catch and train a team, and clear all eight gyms to challenge the Champion.

The whole game runs client-side in the browser. There is no backend, no external service, and no runtime dependency. The build toolchain (Vite, TypeScript, ESLint, Vitest, Playwright) lives entirely in dev dependencies.

## The game

A full journey now runs from the boot movie to the end credits: eight gym badges, a story about the region's origins, and a Champion fight. See [Story progression](../features/story-progression.md) for the full arc and [Quests](../features/quests.md) for the objective and journal system.

- **The premise.** The Mocca region runs on the Ledger, a stone record of every Mockemon ever catalogued. Team Rollback, led by Director Nil, wants to revert the region to its "first draft." Something first of all stirs at Null Peak: Originon, the first entry in the Ledger.
- **Your journey.** Pick a starter from Prof. Maple (Sproutle/Grass, Cindercub/Fire, Puddlefin/Water), then beat rival Kai and work through eight gyms across eight towns.
- **The eight leaders.** Terra (Rock), Weave (Bug), Nerin (Water), Dyna (Electric), Fern (Grass), Pyra (Fire), Aeris (Flying), and Mira (Psychic). Level caps climb from 14 to 50.
- **The endgame.** After the eighth badge you confront Team Rollback at Null Peak, clear Victory Trail, reach Summit Null, and battle Champion Kai. Post-game content includes the Originon encounter and MockDex milestone rewards.

## What is under the hood

The engine implements a canon-style damage formula, a 10-type effectiveness chart, the physical/special split, STAB, critical hits, stat stages, priority moves, status conditions, weather, terrain, screens, entry hazards, IVs, EVs, natures, six EXP growth curves, level-up learnsets, four evolution methods, breeding with IV/ability inheritance, held items, a shininess roll, and a tiered trainer AI.

On top of the engine sits a data-driven content layer, a cutscene/dialogue scripting language, a quest tracker, and a boot movie plus end credits.

| Area | Where it lives |
|---|---|
| Turn-based battle engine | [`src/battle.ts`](../systems/battle-engine/index.md) |
| Overworld, menus, and the game hub | [`src/game.ts`](../systems/overworld.md) |
| Cutscene and dialogue scripting | [`src/script.ts`](../systems/scripting.md) |
| Cutscene/animation sequencing, intro movie, credits | [`src/sequence.ts`, `src/frontend.ts`](../systems/cutscenes.md) |
| Quest objectives and journal | [`src/quests.ts`](../features/quests.md) |
| Creature model (stats, EXP, leveling) | [`src/mockemon.ts`](../primitives/mockemon.md) |
| Maps, gyms, trainers, encounters, quests, scripts | [`src/content/`](../systems/content-pipeline.md) |
| Static game data (species, moves, items, types, abilities) | [`src/data/`](../reference/data-models.md) |
| AI agent play-testing harness | [`tools/agent/`](../how-to-contribute/agent-harness.md) |

## Where to go next

- New to the code? Start with [Architecture](architecture.md) for the big picture, then [Getting started](getting-started.md) to run it.
- Want to change battle behavior? See the [Battle engine](../systems/battle-engine/index.md).
- Want to build maps, cutscenes, or quests? See the [Content pipeline](../systems/content-pipeline.md) and [Scripting](../systems/scripting.md).
- Want to add a creature, move, or item? See [Data models](../reference/data-models.md).
- Want to know the vocabulary? See the [Glossary](glossary.md).

All creatures, names, art, and code are original. Pocket Mockster is not affiliated with any existing monster-catching franchise.
