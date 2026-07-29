# By the numbers

Data collected on 2026-07-29.

## Size

| Scope | Files | LOC |
| --- | ---: | ---: |
| `src/**/*.ts` | 81 | 13,190 |
| `tests/**/*.ts` | 21 | 4,811 |
| `tools/**/*.{ts,mjs}` | 9 | 1,611 |
| Total (`src` + `tests` + `tools`) | 111 | 19,612 |

```mermaid
xychart-beta
    title "LOC by top-level area"
    x-axis "Lines of code" 0 --> 7000
    y-axis ["src engine", "src content", "src data", "tests", "tools"]
    bar [6570, 5814, 806, 4811, 1611]
```

### Language and file-type breakdown

| Language / file type (tracked at `HEAD`) | Files | LOC |
| --- | ---: | ---: |
| TypeScript (`.ts`) | 107 | 18,327 |
| JavaScript modules (`.mjs`) | 6 | 1,611 |
| Markdown (`.md`) | 73 | 4,513 |
| HTML (`.html`) | 2 | 56 |

### Source vs test vs config counts

| Category | Files |
| --- | ---: |
| Source files (`src/**/*.ts` + `tools/**/*.{ts,mjs}`) | 90 |
| Test files (`tests/**/*.ts`) | 21 |
| Root config/build files (`package*.json`, `*.config.*`, `tsconfig.json`, `index.html`) | 7 |

### Largest TypeScript / module files

| File | LOC |
| --- | ---: |
| `src/game.ts` | 2,546 |
| `src/battle.ts` | 1,011 |
| `src/sprites.ts` | 938 |
| `tools/agent/pm-server.mjs` | 931 |
| `tests/unit/battle.test.ts` | 789 |
| `tests/unit/script.test.ts` | 668 |
| `src/data/species.ts` | 568 |
| `src/content/scripts/index.ts` | 490 |

## Content scale

| Content set | Count |
| --- | ---: |
| Species | 41 |
| Moves | 66 |
| Items | 16 |
| Map entries | 56 |
| Map files | 53 |
| Gyms | 8 |
| Quests | 13 |
| Cutscene scripts | 34 |
| Trainers | 93 |

## Activity

- 23 commits total.
- Commit dates currently span two days:
  - 2026-07-28: 16 commits
  - 2026-07-29: 7 commits
- First commit: `2026-07-28 147ee42 chore: scaffold Vite + TypeScript project`.

### Churn hotspots (last 90 days)

| Rank | File | Commits touching file |
| --- | --- | ---: |
| 1 | `src/game.ts` | 10 |
| 2 | `src/maps.ts` | 8 |
| 3 | `src/main.ts` | 8 |
| 4 | `tests/helpers.ts` | 6 |
| 5 | `src/data/species.ts` | 6 |
| 6 | `src/battle.ts` | 6 |
| 7 | `tests/journey.spec.ts` | 5 |
| 8 | `src/content/scripts/index.ts` | 5 |

## Bot-attributed commits

`23 / 23` commits include a `Co-authored-by: ...[bot]` trailer in commit body (`git log --format='%b'`), so the observed lower bound is **100%**.

This is trailer-based attribution only. It does not imply sole authorship.

## What grew most in this expansion

Two new layers now drive a large share of repository size:

- `src/content/` (5,814 LOC): the multi-act story/data layer, including split map bundles and script timelines.
- `tools/agent/` (module-heavy inside the 1,611 tools LOC): the Codex + MCP play-testing harness (`pm-server.mjs`, `pm-mcp.mjs`, `player.mjs`, `profiles.json`).
