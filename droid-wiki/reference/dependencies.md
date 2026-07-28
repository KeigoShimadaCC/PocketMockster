# Dependencies

Pocket Mockster has no runtime dependencies. The game runs client-side TypeScript/Canvas logic compiled and bundled at build time.

## Dev dependencies

Exact versions from `package.json`:

| Package | Version | Role |
| --- | --- | --- |
| `vite` | `^6.0.0` | Dev server and production bundler |
| `typescript` | `^5.6.0` | Type checking and compilation |
| `eslint` | `^10.8.0` | Lint engine |
| `@eslint/js` | `^10.0.1` | Core ESLint recommended rule presets |
| `typescript-eslint` | `^8.65.0` | TypeScript parser/rules and recommended TS lint config |
| `vitest` | `^4.1.10` | Unit test runner |
| `@playwright/test` | `^1.49.0` | End-to-end browser test runner |
| `tsx` | `^4.23.1` | Run TypeScript tooling scripts directly (for example `tools/simulate.ts`) |

Related:

- [Tooling](../how-to-contribute/tooling.md)
