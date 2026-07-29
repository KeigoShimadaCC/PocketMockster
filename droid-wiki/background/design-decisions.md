# Design decisions

Pocket Mockster centralizes randomness in `src/rng.ts` with a seedable PRNG and a non-zero default seed (`0x9e3779b9`). This supports deterministic repros for tests and repeatable campaign simulations. See [RNG](../systems/rng.md).

`Battle` is pure combat logic and returns message strings from turn resolution instead of rendering directly. UI drawing stays in `Game`, so battle rules are testable headlessly in Node (`vitest` and tooling scripts). See [Battle engine](../systems/battle-engine/index.md) and [Testing](../how-to-contribute/testing.md).

Static game content is data-first in `src/data/*` records (species, moves, items, abilities, types). Behavior-specific fields are optional on data models (for example status chance, hazards, weather, terrain, screens, multi-hit), so new mechanics can usually be added by extending data instead of rewriting core loops.

Story and world progression moved from hard-coded control flow to a content-driven layer under `src/content/` plus a small scripting DSL (`src/script.ts`, `src/content/scripts/*`, `src/content/maps/*`, `src/content/quests/*`). This keeps map edits, quest stages, and cutscene triggers editable as data and script definitions instead of giant conditional branches in `Game`.

Cutscenes now run through a frame-based sequence engine (`src/sequence.ts`) and sequence builders in content scripts, so multi-step camera/dialogue/movement scenes execute deterministically and can be tested without bespoke ad hoc timing code.

Persistence uses explicit slot keys (`SLOT_KEYS`) and exposes slot state in runtime (`game.slot` / `window.__PM.state().slot`), with migration-aware loading paths in the frontend persistence layer (`src/frontend.ts`) and quest state wiring in the game core. The practical result is three save slots with backward-compatible load behavior for older save shapes.

The browser debug surface `window.__PM` in `src/main.ts` exposes scripted controls and state snapshots (`press`, `state`, and `debug.*` helpers). This makes deterministic scenario setup and E2E orchestration practical without modifying production gameplay code.

Testing strategy now includes an AI agent harness (`tools/agent/player.mjs`, `tools/agent/pm-server.mjs`, `tools/agent/pm-mcp.mjs`) alongside unit and Playwright suites. The harness is intentionally exploratory: it runs profile-guided autonomous play and records JSONL + report artifacts in `agent-runs/` for regression triage (`tests/agent.spec.ts`).

The model separates immutable templates from mutable instances: `SpeciesDef` in `src/data/species.ts` defines canonical species templates, while `Mockemon` instances in `src/mockemon.ts` hold battle state, level progression, IV/EV/nature, move PP, status, and held items.

The `eda77f6` engine v2 rewrite replaced a simpler stat model with IV/EV/nature, shininess, abilities, held items, weather/terrain/screens/hazards, expanded evolution methods, breeding, day/night, EXP share, crit capture, AI tiers, and struggle behavior. This moved the project from a lightweight prototype toward a more canon-aligned monster battle ruleset.

Core formulas were implemented to mirror genre expectations, including damage flow, catch checks, growth-rate EXP curves, and battle-order effects. This is one reason both simulation and adversarial test suites can validate difficulty and correctness against stable numeric behavior.

Related:

- [Balance simulation](balance-simulation.md)
- [Scripting](../systems/scripting.md)
- [Cutscenes](../systems/cutscenes.md)
- [Persistence](../systems/persistence.md)
- [Agent harness](../how-to-contribute/agent-harness.md)
