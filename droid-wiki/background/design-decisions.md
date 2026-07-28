# Design decisions

Pocket Mockster centralizes randomness in `src/rng.ts` with a seedable PRNG and a non-zero default seed (`0x9e3779b9`). This supports deterministic repros for tests and repeatable campaign simulations. See [RNG](../systems/rng.md).

`Battle` is pure combat logic and returns message strings from turn resolution instead of rendering directly. UI drawing stays in `Game`, so battle rules are testable headlessly in Node (`vitest` and tooling scripts). See [Battle engine](../systems/battle-engine/index.md) and [Testing](../how-to-contribute/testing.md).

Static game content is data-first in `src/data/*` records (species, moves, items, abilities, types). Behavior-specific fields are optional on data models (for example status chance, hazards, weather, terrain, screens, multi-hit), so new mechanics can usually be added by extending data instead of rewriting core loops.

The browser debug surface `window.__PM` in `src/main.ts` exposes scripted controls and state snapshots (`press`, `state`, and `debug.*` helpers). This makes deterministic scenario setup and E2E orchestration practical without modifying production gameplay code.

The model separates immutable templates from mutable instances: `SpeciesDef` in `src/data/species.ts` defines canonical species templates, while `Mockemon` instances in `src/mockemon.ts` hold battle state, level progression, IV/EV/nature, move PP, status, and held items.

The `eda77f6` engine v2 rewrite replaced a simpler stat model with IV/EV/nature, shininess, abilities, held items, weather/terrain/screens/hazards, expanded evolution methods, breeding, day/night, EXP share, crit capture, AI tiers, and struggle behavior. This moved the project from a lightweight prototype toward a more canon-aligned monster battle ruleset.

Core formulas were implemented to mirror genre expectations, including damage flow, catch checks, growth-rate EXP curves, and battle-order effects. This is one reason both simulation and adversarial test suites can validate difficulty and correctness against stable numeric behavior.

Related:

- [Balance simulation](balance-simulation.md)
