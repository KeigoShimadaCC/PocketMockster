# Input
Active contributors: Keigo

## Purpose
Summarize virtual key input handling and how gameplay modes consume input.

## Input model in `src/input.ts`
`Key` is a 7-key virtual set:
- `up`, `down`, `left`, `right`, `a`, `b`, `start`

State containers:
- `held: Set<Key>`
- `pressQueue: Key[]`

`KEYMAP` mappings include:
- Movement: arrows and `WASD`
- Confirm (`a`): `z`, `Enter`, `Space`
- Cancel (`b`): `x`, `Escape`, `Backspace`
- Menu (`start`): `m`, `Shift`

Core functions:
- `initInput()` registers `keydown` and `keyup` listeners.
- `consumePress()` pops one queued press.
- `isHeld(k)` checks held state.
- `virtualPress(k)` queues synthetic presses.
- `virtualHold(k, on)` toggles held state for tests.
- `clearInput()` clears queue and held keys.

`window.__PM.press` in `src/main.ts` calls `virtualPress` for E2E and debug control.

## How `Game` consumes input
`src/game.ts` reads input with `consumePress()` in each mode:
- Title: menu navigation and confirm.
- Overworld: one-time press first, then held directional fallback.
- Dialogue: advance on `a` or `b`.
- Menu: `up/down` plus select and cancel.
- Battle, summary, dex, ending: mode-specific handlers.

## Key source files
| File | Role |
| --- | --- |
| `src/input.ts` | Key mapping, queue and held state, input APIs. |
| `src/main.ts` | Input initialization and synthetic input bridge via `window.__PM.press`. |
| `src/game.ts` | Per-mode input consumption logic. |
