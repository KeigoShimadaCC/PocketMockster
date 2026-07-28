# MockDex
Active contributors: Keigo

## Purpose
Document dex tracking and rendering behavior from `renderDex()` in `src/game.ts` plus species ordering from `src/data/species.ts`.

## Core data and limits
- Dex mode is `mode = 'dex'`.
- Render function is `renderDex()`.
- Ordered species list comes from `DEX_ORDER`.
- Total species count comes from `DEX_COUNT` (26).
- UI header displays `Seen X/26` and `Caught Y/26`.

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

## Related pages
- [Catching](catching.md)
- [Species primitive](../primitives/species.md)
