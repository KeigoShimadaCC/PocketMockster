# By the numbers

Data collected on 2026-07-28.

## Size

| Scope | Files | LOC |
| --- | ---: | ---: |
| `src/**/*.ts` | 16 | 5,499 |
| `tests/**/*.ts` | 13 | 2,272 |
| Total TypeScript (`src` + `tests`) | 29 | 7,771 |

| Language / file type (tracked at `HEAD`) | Files | LOC |
| --- | ---: | ---: |
| TypeScript (`.ts`) | 33 | 8,074 |
| HTML (`.html`) | 1 | 28 |
| JavaScript (`.js`, `.mjs`) | 3 | 157 |
| Markdown (`.md`) | 1 | 53 |

`package.json` has no `dependencies` section, so there are no runtime npm dependencies.

### Largest source files

```mermaid
xychart-beta
    title "Largest src files by LOC"
    x-axis "Lines of code" 0 --> 2100
    y-axis ["game.ts", "battle.ts", "sprites.ts", "maps.ts", "species.ts", "mockemon.ts"]
    bar [2032, 1011, 623, 535, 368, 274]
```

For testing details, see [how-to-contribute/testing.md](how-to-contribute/testing.md). For battle-system internals, see [systems/battle-engine/index.md](systems/battle-engine/index.md).

## Activity

- 15 commits total.
- All 15 commits are dated `2026-07-28`.
- Single listed author in `git shortlog -sn --all`: `KeigoShimadaCC`.

| Era | Commit range (same date: 2026-07-28) | Focus |
| --- | --- | --- |
| Scaffolding and data | 1-2 | Vite setup, types/moves/species/sprites |
| First playable v1 | 3-8 | Battle + maps + full loop + e2e + docs + balance retune |
| Engine v2 and integration | 9-10 | Stat model rewrite and advanced mechanics, then game integration |
| Hardening | 11-15 | Rebalance, adversarial unit tests, e2e systems tests, fixes, docs refresh |

`src/game.ts` is both the largest file (2,032 LOC) and the highest-churn file in history (2,242 changed lines across 7 commits).

## Bot-attributed commits

All 15 of 15 commits (100%) include a `Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>` trailer.

This is a co-author-trailer metric. It does not mean the bot was the only author on each commit.

## Complexity

| Metric | Value |
| --- | ---: |
| Average `src` file size | 343.7 LOC (`5,499 / 16`) |
| Largest `src` file | `src/game.ts` (2,032 LOC) |
| Second-largest `src` file | `src/battle.ts` (1,011 LOC) |

The deepest implementation structure is the battle engine (`src/battle.ts`) and its surrounding battle-state logic in `src/game.ts`.
