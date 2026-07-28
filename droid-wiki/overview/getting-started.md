# Getting started

This page covers prerequisites, install, running the game, and the build and test commands.

## Prerequisites

- Node.js with npm (the project targets modern Node; any current LTS works).
- A browser with HTML5 canvas support to play.

The project has no runtime dependencies. Everything in `package.json` is a dev dependency: Vite, TypeScript, ESLint, Vitest, Playwright, and tsx.

## Install and run

```bash
npm install
npm run dev
```

Then open http://localhost:5173. Vite serves `index.html`, which loads `src/main.ts` as a module.

### Controls

| Action | Keys |
|---|---|
| Move | Arrow keys or WASD |
| Confirm / interact | Z or Enter |
| Cancel / back | X or Esc |
| Menu | M or Shift |

Key mapping is defined in [`src/input.ts`](../systems/input.md).

### URL parameters

The game reads two query parameters at boot in `src/main.ts`:

- `?seed=N` seeds the RNG so runs are deterministic.
- `?noenc=1` disables wild encounters.

Example: `http://localhost:5173/?seed=777&noenc=1`.

## Scripts

All scripts are defined in `package.json`.

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Type-check (`tsc`) then produce a production bundle in `dist/` |
| `npm run preview` | Serve the built bundle locally |
| `npm run typecheck` | `tsc --noEmit` strict type checks |
| `npm run lint` | Run ESLint across the project |
| `npm run test` | Run the Vitest unit suite (`tests/unit/**`) |
| `npm run test:e2e` | Run the Playwright end-to-end suite |

## Building for release

`npm run build` runs `tsc` for a full strict type check and then `vite build`, emitting a static bundle to `dist/`. Because the game is fully client-side, deployment is just serving the contents of `dist/` from any static host.

## First code tour

A good reading order for a newcomer:

1. [`src/main.ts`](../systems/game-loop.md) to see the loop and the `__PM` API.
2. [`src/game.ts`](../systems/overworld.md) `update()` and `render()` to see the mode switch.
3. [`src/battle.ts`](../systems/battle-engine/index.md) `takeTurn()` for combat.
4. [`src/data/species.ts`](../reference/data-models.md) to see how a creature is described.

For conventions used throughout, read [Patterns and conventions](../how-to-contribute/patterns-and-conventions.md).
