# MockDex
Active contributors: KeigoShimadaCC

## Purpose
Document dex tracking and rendering behavior from `renderDex()` in `src/game.ts`, plus species ordering and count exports from `src/data/species.ts`.

## Core data and limits
- Dex mode is `mode = 'dex'`.
- Render function is `renderDex()`.
- Ordered species list comes from `DEX_ORDER` in `src/data/species.ts`.
- Total species count comes from `DEX_COUNT` in `src/data/species.ts` (currently `41`).
- UI header displays `Seen X/<DEX_ORDER.length>` and `Caught Y/<DEX_ORDER.length>` in `renderDex()` (`src/game.ts`).

## Seen and caught tracking
Tracked sets:
- `seenSpecies`
- `caughtSpecies`

Key updates in game flow:
- Seen:
  - Wild encounter creation (`startWildBattle`)
  - Battle start (`beginBattle`)
  - Evolution results
  - Trade receive and trade evolution
  - Egg hatch
- Caught:
  - Successful wild capture
  - Evolution results
  - Trade receive and trade evolution
  - Egg hatch

## Display rules
- Dex list is paginated with 11 entries per page.
- If not seen, the list hides species name as `----------`.
- If seen, list shows species name and sprite.
- If caught, the detail panel shows dex text.
- If seen but not caught, detail panel shows `Not caught yet.`

This produces a two-stage discovery model:
1. encounter reveals identity,
2. capture unlocks full entry text.

## Dex milestone rewards
- Quest content includes a `dex_milestones` side quest (10/20/30/40 seen-species milestones) in `src/content/quests.ts`.
- Post-game Maple rewards are delivered through `maple_postgame` script flags (`dexReward10`, `dexReward20`, `dexReward30`, `dexReward40`) in `src/content/scripts/index.ts`.
- The Maple reward script grants `luckycharm` (10), `powerband` (20), and `safetysash` (30), then caps with completion dialogue at 40 in `src/content/scripts/index.ts`.

## Related pages
- [Catching](catching.md)
- [Species primitive](../primitives/species.md)
- [Quests](quests.md)
