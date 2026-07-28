# Debugging

## Purpose

This page documents practical local debugging techniques for reproducible game-state issues.

## Start from a deterministic session

Use URL parameters to remove randomness when reproducing bugs:

- `?seed=N` sets the RNG seed.
- `?noenc=1` disables random encounters.

Example: `http://localhost:5173/?seed=1234&noenc=1`

## Inspect state with `window.__PM.state()`

Use `window.__PM.state()` in the browser console or in Playwright to get a full snapshot, including:

- Top-level mode and location: `mode`, `map`, `x`, `y`, `moving`, `facing`
- Progress and economy: `money`, `badges`, `flags`, `inventory`
- Team and storage: `party`, `storageCount`, `storage`
- Time and phase: `minute`, `phase`
- Daycare state: `daycare`, `daycareEgg`
- UI state: `dialogue`, `menu`
- Battle state: `battle.phase`, `battle.message`, `battle.outcome`, sides and HP
- Collection and progression: `seen`, `caught`, `defeated`, `endingShown`

## Use `window.__PM.debug.*` helpers

Core helpers for setup and reproduction:

- Travel and encounter setup: `warp`, `noEncounters`, `setSeed`
- Party setup: `setPartyLevels`, `givemon`, `setHeldItem`, `setHp`, `addExp`, `setFriendship`
- Inventory and resources: `addItem`, `healAll`, `drainPP`
- Time and breeding: `setTime`, `depositDaycare`, `walk`, `hatchEggs`
- Cleanup: `clearInput`, `clearSave`

These helpers let you build minimal repro states quickly.

## Reproduce battles in isolation

Use `tools/debugfight.ts` for a verbose, deterministic single-fight trace:

- Run `npx tsx tools/debugfight.ts`
- It seeds RNG, constructs specific player and enemy parties, and logs turn-by-turn messages.
- Use it to inspect action order, damage flow, item usage, and outcome transitions.

## Common issue: stale local save

If behavior does not match expected startup state, a stale `pm_save` in `localStorage` is often the cause.

Fix by clearing it:

- In browser console: `window.__PM.debug.clearSave()`
- Or from tests through the same debug API

## Read battle message arrays

Battle progression is message-driven. In tests and debug traces:

- Inspect `battle.message` from `window.__PM.state()`.
- Capture arrays returned by battle loops to confirm event order.
- Compare expected narration sequence against actual sequence to find logic drift.

## Related pages

- [Testing](testing.md)
- [Tooling](tooling.md)
