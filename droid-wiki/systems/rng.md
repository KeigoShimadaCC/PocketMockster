# RNG
Active contributors: Keigo

## Purpose
Document the centralized seedable random number generator used across gameplay systems.

## Implementation in `src/rng.ts`
`src/rng.ts` stores a module-level mutable `seed` and exposes:
- `setSeed(s)`:
  - coerces to unsigned 32-bit with `s >>> 0`
  - guards zero by replacing it with `0x9e3779b9`
- `rand()`:
  - xorshift32 transform on `seed`
  - returns normalized float in `[0, 1)` via `seed / 0xffffffff`
- `randInt(min, max)`:
  - inclusive integer range helper
- `chance(p)`:
  - `rand() < p`
- `pick(arr)`:
  - random element from array

## Why centralized and seedable
- Determinism for tests and repeatable simulator runs.
- One RNG path avoids mixed behavior from multiple generators.
- `src/main.ts` supports deterministic startup through `?seed=N`, which calls `setSeed(...)`.

This RNG is global mutable state. Any caller that uses `rand`-family functions advances shared sequence state.

Related pages:
- [Design decisions](../background/design-decisions.md)
- [Testing](../how-to-contribute/testing.md)

## Key source files
| File | Role |
| --- | --- |
| `src/rng.ts` | Xorshift32 state and random helper APIs. |
| `src/main.ts` | URL seed parameter plumbing (`?seed=`). |
| `src/game.ts` | Runtime consumer (`rand`, `randInt`, `chance`) for encounters and gameplay rolls. |
