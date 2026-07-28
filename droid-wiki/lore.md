# Lore

## Timeline of the one-day build

All commits in this repository are dated `2026-07-28`, so the timeline below uses commit order within that day.

## Scaffolding and core data (2026-07-28, commits 1-2)

1. **Commit 1 (`147ee42`)**: Vite + TypeScript scaffolding.
2. **Commit 2 (`e5e095e`)**: core game data and art foundations land together:
   - type chart and type utilities
   - move data
   - 20-species roster
   - original sprites

`src/data/types.ts` and `src/rng.ts` start in this early phase and have remained unchanged since then.

## First playable v1 (2026-07-28, commits 3-8)

3. **Commit 3 (`31a273d`)**: first battle engine, stat/EXP flow, and world maps with NPC/trainers.
4. **Commit 4 (`8840786`)**: full playable loop (overworld, dialogue, menus, battles, shop, save, ending) plus the e2e debug API.
5. **Commit 5 (`5ec3451`)**: Playwright e2e suite for core game flow.
6. **Commit 6 (`793cc2d`)**: route/warp fixes and full-playthrough e2e pass.
7. **Commit 7 (`b0141dd`)**: README documentation with screenshots.
8. **Commit 8 (`cc84809`)**: controls-bar UX and simulator-driven balance retune.

## Engine v2 rewrite (2026-07-28, commit 9)

9. **Commit 9 (`eda77f6`)** is the major rewrite point:
   - stat model upgrade to nature + IV + EV
   - abilities and held items
   - weather, terrain, screens, hazards
   - breeding and evolution-method support
   - day/night handling, EXP share, AI tiers, struggle handling

This commit heavily expands battle internals:
- `src/battle.ts`: `+808 / -127`
- `src/mockemon.ts`: `+209 / -32`

The v1 simple stat progression is effectively replaced by the IV/EV/nature system from this point onward.

## v2 game integration (2026-07-28, commit 10)

10. **Commit 10 (`e44adab`)** wires engine v2 features into game flow:
   - daycare and egg loop
   - NPC trade and stone evolutions
   - held-item interactions in moment-to-moment play
   - MockDex and PC storage
   - day/night clock and tints
   - whiteout money penalty and move-forget prompts

## Hardening and release polish (2026-07-28, commits 11-15)

11. **Commit 11 (`f3ea51a`)**: rebalance pass using simulator feedback.
12. **Commit 12 (`d7904b3`)**: 42 adversarial battle unit tests.
13. **Commit 13 (`22858ee`)**: 11 e2e system tests and lint cleanup.
14. **Commit 14 (`c550c8b`)**: 16 adversarial-review fixes.
15. **Commit 15 (`84b923d`)**: lab screenshot refresh for v2 docs.

## Growth trajectory

- Species count starts at 20 in commit 2 and reaches 26 by `HEAD`.
- The project keeps early data foundations (`types.ts`, `rng.ts`) while replacing core combat math and progression logic during v2.

Related docs: [how-to-contribute/tooling.md](how-to-contribute/tooling.md), [background/balance-simulation.md](background/balance-simulation.md).
