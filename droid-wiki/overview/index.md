# Pocket Mockster

Pocket Mockster is a monster-catching RPG built from scratch in TypeScript and rendered on an HTML5 canvas. It has original creatures, hand-made pixel art, and classic mechanics: explore a small overworld, battle wild creatures and trainers, catch and train a team, and take on the first gym.

The whole game runs client-side in the browser. There is no backend, no external service, and no runtime dependency. The build toolchain (Vite, TypeScript, ESLint, Vitest, Playwright) lives entirely in dev dependencies.

## What the demo covers

The playable slice runs from the title screen to the first gym badge:

1. Pick a starter from Prof. Maple in her lab: Sproutle (Grass), Cindercub (Fire), or Puddlefin (Water).
2. Beat rival Kai, who always picks the starter that counters yours.
3. Collect MockBalls from the old man in Maple Town.
4. Cross Route 1: tall-grass encounters, item pickups, and three line-of-sight trainers.
5. In Verdant City, heal at the Mock Center and shop at the Mock Mart.
6. Beat Gym Trainer Rocco, then Leader Terra (Rock-type) for the Boulder Badge.

## What is under the hood

Despite the small story, the engine is deep. It implements a canon-style damage formula, a 10-type effectiveness chart, the physical/special split, STAB, critical hits, stat stages, priority moves, status conditions, weather, terrain, screens, entry hazards, IVs, EVs, natures, six EXP growth curves, level-up learnsets, four evolution methods, breeding with IV/ability inheritance, held items, a shininess roll, and a tiered trainer AI.

| Area | Where it lives |
|---|---|
| Turn-based battle engine | [`src/battle.ts`](../systems/battle-engine/index.md) |
| Overworld, menus, and rendering | [`src/game.ts`](../systems/overworld.md) |
| Creature model (stats, EXP, leveling) | [`src/mockemon.ts`](../primitives/mockemon.md) |
| Static game data (species, moves, items, types, abilities) | [`src/data/`](../reference/data-models.md) |
| Maps, NPCs, trainers, encounter tables | [`src/maps.ts`](../primitives/world-map.md) |

## Where to go next

- New to the code? Start with [Architecture](architecture.md) for the big picture, then [Getting started](getting-started.md) to run it.
- Want to change battle behavior? See the [Battle engine](../systems/battle-engine/index.md).
- Want to add a creature, move, or item? See [Data models](../reference/data-models.md).
- Want to know the vocabulary? See the [Glossary](glossary.md).

All creatures, names, art, and code are original. Pocket Mockster is not affiliated with any existing monster-catching franchise.
