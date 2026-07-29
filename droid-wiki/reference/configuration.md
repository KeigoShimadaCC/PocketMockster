# Configuration

Active contributors: KeigoShimadaCC

## NPM scripts (`package.json`)

- `dev`: Vite dev server
- `build`: `tsc && vite build`
- `preview`: Vite preview server
- `typecheck`: `tsc --noEmit`
- `test`: `vitest run`
- `test:e2e`: `playwright test`
- `lint`: `eslint .`
- `agent:server`: starts the local MCP bridge (`tools/agent/pm-server.mjs`)
- `agent:play`: runs the scripted player harness (`tools/agent/player.mjs`)
- `validate:content`: runs content validation (`tools/validate-content.ts`) through `tsx`

## Runtime parameters and persistence

- URL param `seed`: parsed in `src/main.ts`, then passed to `setSeed(parseInt(seed, 10))`.
- URL param `noenc=1`: sets `game.noEncounters = true` in `src/main.ts`.
- Intro boot behavior: `src/main.ts` calls `game.playIntro()` when `introSeen()` is false and `noenc` is not set. Intro state is tracked via `INTRO_SEEN_KEY = 'pm_intro_seen'` and persisted by `markIntroSeen()` in `src/frontend.ts`.
- Save key: `localStorage['pm_save']` (checked by `Game.hasSave`, written by `Game.save`, read by `Game.load`).

`Game.save()` in `src/game.ts` persists this schema:

- `mapId`
- `px`, `py`
- `party`
- `storage`
- `inventory`
- `money`
- `badges`
- `flags`
- `defeatedTrainers`
- `collectedItems`
- `healPoint`
- `seen`
- `caught`
- `minute`
- `daycare`
- `daycareSteps`
- `daycareEgg`

## Layout and timing constants

In `src/game.ts`:

- `TILE = 32`
- `VIEW_W = 480`
- `VIEW_H = 320`
- `BAR_H = 32`

In `src/rng.ts`:

- default seed: `0x9e3779b9` (also used as fallback when a provided seed resolves to zero)

## TypeScript config

`tsconfig.json` uses:

- `target: "ES2020"`
- `module: "ESNext"`
- `moduleResolution: "bundler"`
- `lib: ["ES2020", "DOM", "DOM.Iterable"]`
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: false`
- `noFallthroughCasesInSwitch: true`
- `isolatedModules: true`
- `resolveJsonModule: true`
- `skipLibCheck: true`
- `noEmit: true`
- `include: ["src"]`

## ESLint config

`eslint.config.js`:

- base configs: `@eslint/js` recommended + `typescript-eslint` recommended
- ignores: `dist`, `node_modules`, `test-results`, `playwright-report`
- rule override: `@typescript-eslint/no-unused-vars` with ignore patterns `^_` for args and vars
- rule override: `@typescript-eslint/no-explicit-any: off`
- extra globals block for `tools/**/*.mjs`, `playwright.config.ts`, and `vitest.config.ts`

## Test and tool configs

- `vitest.config.ts`: `test.include = ['tests/unit/**/*.test.ts']`
- `playwright.config.ts`:
  - `use.baseURL = 'http://localhost:5173'`
  - `workers = 1`
  - `timeout = 120_000`
  - `webServer.command = 'npm run dev'`
  - `webServer.url = 'http://localhost:5173'`
  - `webServer.reuseExistingServer = true`
- Vite uses default config file behavior in this repo (no `vite.config.*` present). Build command is `tsc && vite build` from `package.json`.

Related:

- [Persistence](../systems/persistence.md)
- [Game loop](../systems/game-loop.md)
