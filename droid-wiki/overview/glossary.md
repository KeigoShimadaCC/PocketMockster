# Glossary

Project-specific terms and domain vocabulary used across the codebase and this wiki.

## Creatures and data

- **Mockemon** — a creature. As a runtime object it is the `Mockemon` interface in [`src/mockemon.ts`](../primitives/mockemon.md): a specific individual with level, stats, IVs, EVs, nature, moves, and status. As static data it is a `SpeciesDef` in [`src/data/species.ts`](../primitives/species.md).
- **Species** — the template for a Mockemon: base stats, types, learnset, evolution, egg groups, catch rate, EXP yield, and dex text. Keyed by a lowercase string (e.g. `cindercub`).
- **MockDex** — the in-game creature encyclopedia. Tracks seen and caught species. Rendered by the `dex` mode.
- **MockBall** — the catching item. Thrown at a weakened wild Mockemon.
- **Mock Center** — the healing building. Restores the whole party and sets the respawn point.
- **Mock Mart** — the shop.
- **Starter** — the first creature, chosen from Prof. Maple: Sproutle, Cindercub, or Puddlefin.

## Stats and growth

- **Base stats** — the species-level `StatBlock` (hp, atk, def, spa, spd, spe) that all individuals of a species share.
- **IV (individual value)** — a per-stat roll of 0-31 rolled at creation, making individuals differ.
- **EV (effort value)** — points earned per stat by defeating creatures, capped at 252 per stat and 510 total.
- **Nature** — one of 25 personalities; most raise one stat 10% and lower another 10%.
- **STAB** — same-type attack bonus. A move matching the user's type deals 1.5x (2x with the Adaptive ability).
- **Growth rate** — one of six EXP curves (`fast`, `mediumfast`, `mediumslow`, `slow`, `erratic`, `fluctuating`) mapping level to required EXP.
- **PV (personality value)** — a random 32-bit value stored per creature; drives the shiny check.
- **Shiny** — a rare alternate individual (~1/4096), flagged from the PV.

## Combat

- **Physical / special split** — physical moves use Attack vs Defense; special moves use Sp. Atk vs Sp. Def; status moves deal no damage.
- **Stat stage** — a temporary in-battle modifier from -6 to +6 on a stat (atk, def, spa, spd, spe, acc, eva).
- **Status condition** — a persistent ailment: `PAR` (paralysis), `BRN` (burn), `PSN` (poison), `TOX` (badly poisoned), `SLP` (sleep), `FRZ` (frozen).
- **Volatile status** — a battle-only condition that clears on switch: confusion, leech seed.
- **Weather** — `sun`, `rain`, or `sand`; modifies damage and can chip HP.
- **Terrain** — `electric` or `grassy`; boosts a move type or heals grounded creatures.
- **Screen** — `reflect` (halves physical damage) or `lightscreen` (halves special damage) for the whole side.
- **Hazard** — an entry trap: `spikes` or `stealthrock`, damaging a creature as it switches in.
- **Two-turn move** — a move that charges one turn (often invulnerable) and strikes the next, e.g. Dig, Fly.
- **AI tier** — the trainer decision model: `basic`, `smart`, or `leader`. See [Trainer AI](../systems/battle-engine/trainer-ai.md).
- **Whiteout** — losing all creatures; the player drops half their money, is fully healed, and respawns at the last heal point.
- **Critical capture** — a rare single-shake catch check instead of the normal four.

## World

- **Tile** — a single map cell. Maps are arrays of strings; each character is a tile type (see [`SOLID_TILES`](../primitives/world-map.md)).
- **Warp** — a tile that teleports the player to another map and position.
- **Line of sight** — a trainer's forward-facing detection range (`sight` tiles) that triggers a battle.
- **Encounter table** — the weighted list of wild species for a map, with optional night weights.
- **Flag** — a boolean in `game.flags` recording story progress (e.g. `starterChosen`, `rivalBeaten`, `gymDone`).
- **Heal point** — the map and coordinates the player respawns at after a whiteout.
- **Daycare** — the breeding building where two compatible creatures can produce an egg.

## Engineering

- **`window.__PM`** — the debug and end-to-end testing API installed by `main.ts`, exposing game state and scripted actions.
- **Seed** — the RNG seed. Fixing it (`?seed=N`) makes a run reproducible.
- **PlayerAction** — the tagged union a battle turn accepts: `move`, `switch`, `item`, or `run`.
- **Mode** — the `Game` state-machine field selecting the active update/render path.
