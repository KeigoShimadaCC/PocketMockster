# Game loop
Active contributors: Keigo

## Purpose
Explain how the runtime boots, steps simulation, renders frames, and exposes the test and debug bridge.

## Boot sequence in `src/main.ts`
`src/main.ts` does the following in order:
1. Reads `#game` canvas and creates `ctx`.
2. Sets `ctx.imageSmoothingEnabled = false`.
3. Reads URL params with `new URLSearchParams(location.search)`.
4. If `?seed=N` exists, calls `setSeed(parseInt(seedParam, 10))`.
5. Calls `initInput()`.
6. Constructs `const game = new Game(ctx)`.
7. If `?noenc=1`, sets `game.noEncounters = true`.
8. Starts `requestAnimationFrame(loop)`.

## Fixed-timestep loop
`main.ts` uses:
- `STEP = 1000 / 60` for 60 Hz simulation
- `acc` accumulator
- `Math.min(100, t - last)` to clamp large frame gaps to 100 ms

Then it runs zero or more `game.update()` steps per browser frame, followed by one `game.render()`.

```mermaid
flowchart TD
  A[requestAnimationFrame t] --> B[acc += min(100, t - last)]
  B --> C[last = t]
  C --> D{acc >= STEP?}
  D -- yes --> E[game.update]
  E --> F[acc -= STEP]
  F --> D
  D -- no --> G[game.render]
  G --> H[requestAnimationFrame loop]
```

## `window.__PM` API
`main.ts` installs a global test/debug object:

```ts
window.__PM = {
  press(k),
  state(),
  debug: {
    setSeed, noEncounters, warp, setPartyLevels, givemon, addItem, setTime,
    hatchEggs, setHeldItem, depositDaycare, walk, drainPP, healAll,
    clearInput, clearSave
  }
}
```

- `press(k)` calls `virtualPress(k)` for synthetic input.
- `state()` returns a serializable snapshot with mode, map, position, movement, money, badges, flags, inventory, party, storage, time/day phase, daycare state, dialogue, menu, battle snapshot, dex counts, defeated trainers, and ending state.
- `debug.*` methods mutate runtime state for tests and E2E flows.

## In-game clock and mode dispatch in `src/game.ts`
- `Game.update()` increments `frame` every tick.
- If mode is not `title`, clock advances `minute = (minute + 1) % 1440` every 10 frames.
- `Game.mode` dispatches update behavior across:
  - `title`
  - `overworld`
  - `dialogue`
  - `menu`
  - `battle`
  - `summary`
  - `dex`
  - `ending`
- `Game.render()` dispatches render behavior by mode with shared controls bar rendering each frame.

## Key source files
| File | Role |
| --- | --- |
| `src/main.ts` | Bootstraps canvas, URL flags, input, fixed loop, and `window.__PM`. |
| `src/game.ts` | Owns `Game`, update and render mode dispatch, in-game clock. |
| `src/input.ts` | Input queue and held-state primitives used by loop consumers. |
| `src/rng.ts` | Seed initialization target for `?seed=` and debug seed control. |
| `src/daynight.ts` | Day phase calculation read by `state()` and rendering. |
