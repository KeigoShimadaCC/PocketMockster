# Persistence
Active contributors: Keigo

## Purpose
Explain save and load behavior, title screen continue flow, and persisted state boundaries.

## Storage backend
`src/game.ts` uses browser `localStorage` key `pm_save`.

## Save path in `save()`
`save()` serializes and writes JSON with:
- `mapId`, `px`, `py`
- `party`, `storage`
- `inventory`, `money`, `badges`, `flags`
- `defeatedTrainers` as array
- `collectedItems` as array
- `healPoint`
- `seen` and `caught` as arrays
- `minute`
- `daycare`, `daycareSteps`, `daycareEgg`

Set-backed fields are converted to arrays before JSON write:
- `defeatedTrainers`
- `collectedItems`
- `seenSpecies`
- `caughtSpecies`

## Load path in `load()`
`load()`:
- Reads `pm_save` JSON and returns `false` if missing.
- Rehydrates core fields onto `Game`.
- Rebuilds sets from arrays for defeated trainers, collected items, seen, and caught.
- Applies defaults for older saves:
  - `storage ?? []`
  - `seen ?? []`
  - `caught ?? []`
  - `minute ?? 600`
  - `daycare ?? [null, null]`
  - `daycareSteps ?? 0`
  - `daycareEgg ?? null`
- Sets mode to `overworld`.

## Title flow and save presence
- `hasSave()` checks whether `pm_save` exists (guarded by `try/catch`).
- In title mode, options are:
  - `NEW GAME` only when no save exists
  - `NEW GAME` and `CONTINUE` when save exists
- `CONTINUE` calls `load()` and falls back to `newGame()` if load fails.
- `newGame()` resets player start state and opens intro dialogue.

## Saved vs not saved
Saved examples include current map position, party, storage, inventory, money, badges, and flags.

Also saved: defeated trainers, collected items, heal point, seen and caught dex progress, in-game minute, and daycare state.

Not saved includes transient runtime UI and control state such as current dialogue queue, open menus, active battle object and battle phase, movement offsets, and frame counter.

## Key source files
| File | Role |
| --- | --- |
| `src/game.ts` | `hasSave`, `save`, `load`, and title-mode continue flow. |
| `src/main.ts` | Starts the game object whose state is persisted by `Game`. |
