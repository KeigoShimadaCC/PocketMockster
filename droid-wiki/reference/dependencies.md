# Dependencies

Active contributors: KeigoShimadaCC

Pocket Mockster has no runtime dependencies. The game runs client-side TypeScript/Canvas logic compiled and bundled at build time.

## Dev dependencies

Exact versions from `package.json`:

| Package | Version | Role |
| --- | --- | --- |
| `vite` | `^6.0.0` | Dev server and production bundler |
| `typescript` | `^5.6.0` | Type checking and compilation |
| `eslint` | `^10.8.0` | Lint engine |
| `@eslint/js` | `^10.0.1` | Core ESLint recommended rule presets |
| `@modelcontextprotocol/sdk` | `^1.30.0` | MCP client/server SDK used by the local agent harness tooling |
| `@openai/codex-sdk` | `^0.145.0` | Codex SDK used by the local agent harness tooling |
| `typescript-eslint` | `^8.65.0` | TypeScript parser/rules and recommended TS lint config |
| `vitest` | `^4.1.10` | Unit test runner |
| `@playwright/test` | `^1.49.0` | End-to-end browser test runner |
| `tsx` | `^4.23.1` | Run TypeScript tooling scripts directly (for example `tools/validate-content.ts`) |

## Automation and validation scripts (`package.json`)

- `agent:server`: `node tools/agent/pm-server.mjs`
- `agent:play`: `node tools/agent/player.mjs`
- `validate:content`: `tsx tools/validate-content.ts`

Related:

- [Tooling](../how-to-contribute/tooling.md)
- [Agent harness](../how-to-contribute/agent-harness.md)
