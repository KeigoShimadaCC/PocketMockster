# Tooling
Active contributors: KeigoShimadaCC

## Purpose

This page summarizes the local toolchain used to build, lint, test, debug, and regenerate documentation assets.

## Core build and runtime tools

- Vite serves and bundles the app (`npm run dev`, `npm run build`, `npm run preview`).
- TypeScript is configured in `tsconfig.json` with strict checking and `noEmit` for type validation.
- ESLint runs from `eslint.config.js` using recommended JS and TypeScript rules with project-specific overrides.

## TypeScript and lint specifics

From `tsconfig.json`:

- `strict: true`
- `noUnusedLocals: true`
- `noFallthroughCasesInSwitch: true`
- `moduleResolution: bundler`
- `isolatedModules: true`
- `include: ["src"]`

From `eslint.config.js`:

- Base: `@eslint/js` recommended and `typescript-eslint` recommended.
- `@typescript-eslint/no-unused-vars` is an error unless names are prefixed with `_`.
- `@typescript-eslint/no-explicit-any` is off.
- Ignores include `dist`, `node_modules`, `test-results`, and `playwright-report`.

## Testing tools

- Vitest for unit tests (`npm test`), scoped to `tests/unit/**/*.test.ts`.
- Playwright for end-to-end tests (`npm run test:e2e`), scoped to `tests/*.spec.ts`.
- Content validator (`npm run validate:content`) via `tools/validate-content.ts`.
- Playwright auto-starts the dev server using `npm run dev`.

See [Testing](testing.md) for test authoring and helper patterns.

## `tools/` scripts

### `tools/simulate.ts`

- Headless campaign difficulty simulator using real battle/data systems.
- Run: `npx tsx tools/simulate.ts`
- Use for balance regression checks after combat changes.

### `tools/debugfight.ts`

- Deterministic, verbose single-fight tracer.
- Run: `npx tsx tools/debugfight.ts`
- Useful for turn-order, damage, and outcome debugging.

### `tools/validate-content.ts`

- Validates map/content wiring through `validateMaps()` in `src/content/validate`.
- Run: `npm run validate:content`
- Fails fast on content errors before PR.

### `tools/agent/`

- Agent harness for autonomous exploratory runs (`agent:play`) and standalone runtime server (`agent:server`).
- Core files: `player.mjs`, `pm-server.mjs`, `pm-mcp.mjs`, `profiles.json`.
- Produces per-run artifacts in `agent-runs/<id>/`.
- See [Agent harness](agent-harness.md).

### `tools/diag-rocco.mjs`

- Playwright-driven diagnostic flow for the gym leader path.
- Run: `node tools/diag-rocco.mjs`

### `tools/screenshots.mjs`

- Regenerates docs screenshots from scripted gameplay states.
- Run: `node tools/screenshots.mjs`
- Outputs image files under `docs/`.

## Docs and screenshots

The repository keeps generated game screenshots in `docs/`. Use `tools/screenshots.mjs` when visuals need refresh after UI or content changes.

## Related pages

- [Balance simulation](../background/balance-simulation.md)
- [Testing](testing.md)
- [Agent harness](agent-harness.md)
