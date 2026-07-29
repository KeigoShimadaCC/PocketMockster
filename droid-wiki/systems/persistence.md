# Persistence
Active contributors: KeigoShimadaCC

## Purpose
Explain save and load behavior, title screen continue flow, and persisted state boundaries.

## Storage backend
`src/frontend.ts` defines three slot keys:
- `pm_save`
- `pm_save_2`
- `pm_save_3`

`pm_save` stays as slot 1 for backward compatibility with pre-slot saves.

`Game.slotKey()` in `src/game.ts` maps `Game.slot` to `SLOT_KEYS`, and `save()`/`load()` read and write through that key.

## Save path in `save()`
`Game.save()` in `src/game.ts` serializes and writes JSON with:
- `version`, `savedAt`, `playFrames`
- `quests: this.quests.toJSON()`
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
`Game.load(slot)` in `src/game.ts`:
- Selects a slot and reads its key from `SLOT_KEYS`.
- Returns `false` for missing or invalid payloads.
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
- Rehydrates quests with compatibility migration: `new QuestLog(QUESTS, d.quests ?? migrateQuests(this.flags, this.badges))`.
- Restores `playFrames` with `d.playFrames ?? 0`.
- Sets mode to `overworld`.

## Slot-aware title flow
- `hasSave()` checks all `SLOT_KEYS` (`src/game.ts`).
- In title mode, options are:
  - `NEW GAME`
  - `CONTINUE` (if any slot has data)
  - `SLOTS`
  - `INTRO MOVIE`
- `CONTINUE` loads `newestSlot()` from `src/frontend.ts`.
- `SLOTS` opens a slot picker (`openSlotMenu`) backed by `readSlots()` metadata (`lead`, badges, playtime, map, timestamp).
- Starting a new game defaults to `firstEmptySlot()`.

## Saved vs not saved
Saved examples include current map position, party, storage, inventory, money, badges, and flags.

Also saved: quests, defeated trainers, collected items, heal point, seen and caught dex progress, in-game minute, daycare state, and `playFrames` playtime.

Not saved includes transient runtime UI and control state such as current dialogue queue, open menus, active battle object and battle phase, movement offsets, and frame counter.

## Clear-save behavior
The debug API `window.__PM.debug.clearSave()` removes every key in `SLOT_KEYS` (`src/main.ts`), so clear-save now wipes all three save slots.

`INTRO_SEEN_KEY` is stored separately in `src/frontend.ts` and is not part of slot JSON payloads.

## Key source files
| File | Role |
| --- | --- |
| `src/game.ts` | Slot-aware save/load, migration, title continue and slot-selection flow, quest/playtime persistence. |
| `src/frontend.ts` | `SLOT_KEYS`, intro-seen flag key, slot metadata readers, newest/empty slot helpers. |
| `src/main.ts` | Boot intro-seen check and debug `clearSave()` that clears all slot keys. |
| `src/quests.ts` | `QuestLog` serialization and rehydration model used in save payloads. |
