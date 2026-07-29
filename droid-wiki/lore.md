# Lore

## Timeline

### 2026-07-28: Scaffolding and core data

1. **2026-07-28 (`147ee42`)**: Vite + TypeScript scaffolding.
2. **2026-07-28 (`e5e095e`)**: core data and art foundations (types, moves, 20-species roster, original sprites).

### 2026-07-28: First playable v1

3. **2026-07-28 (`31a273d`)**: first battle engine, stat/EXP flow, and world maps with NPC/trainers.
4. **2026-07-28 (`8840786`)**: full game loop (overworld, dialogue, menus, battles, shop, save, ending) plus e2e debug API.
5. **2026-07-28 (`5ec3451`)**: Playwright e2e suite for core flow.
6. **2026-07-28 (`793cc2d`)**: warp/path fixes and full-playthrough e2e pass.
7. **2026-07-28 (`b0141dd`)**: README screenshots and usage docs.
8. **2026-07-28 (`cc84809`)**: controls-bar UX and simulator-driven difficulty retune.

### 2026-07-28: Engine v2 and integration

9. **2026-07-28 (`eda77f6`)**: engine v2 rewrite (natures/IVs/EVs, abilities, held items, weather/terrain/screens/hazards, breeding/evolution methods, day/night, EXP share, AI tiers).
10. **2026-07-28 (`e44adab`)**: v2 gameplay integration (daycare loop, trade + stone evolutions, MockDex, PC storage, day/night presentation, whiteout penalty, move-forget flow).

### 2026-07-28: Hardening and pre-expansion test wall

11. **2026-07-28 (`f3ea51a`)**: rebalance pass after simulator runs.
12. **2026-07-28 (`d7904b3`)**: 42 adversarial battle unit tests.
13. **2026-07-28 (`22858ee`)**: 11 e2e system tests and lint cleanup.
14. **2026-07-28 (`c550c8b`)**: 16 adversarial review fixes.
15. **2026-07-28 (`84b923d`)**: docs polish with refreshed screenshot.
16. **2026-07-28 (`da27477`)**: 17 e2e coverage tests for battle mechanics, evolutions, held items, and day/night.

### 2026-07-29: The agent harness

17. **2026-07-29 (`cfebed8`)**: adds the AI play-testing harness and supporting wiki/debug hooks (`tools/agent/pm-server.mjs`, `pm-mcp.mjs`, `player.mjs`, `profiles.json`).
18. **2026-07-29 (`7bee198`)**: harness stability fixes for page-op serialization and battle/walk reporting.

### 2026-07-29: The content expansion

19. **2026-07-29 (`9d2b671`)**: phase 0 infrastructure (quests, scripts, timelines, content validator).
20. **2026-07-29 (`0fb3ec3`)**: phases 1-3 content and frontend expansion (species, gyms, maps, scripts, intro/credits flows, save-slot support).
21. **2026-07-29 (`f56efa4`)**: trainer-ID correction pass for story scripts.
22. **2026-07-29 (`ec13adf`)**: post-game additions, including Originon encounter and dex rewards.
23. **2026-07-29 (`ac873f7`)**: scenario gap fill (Juno beats, villain flow, Kai encounters, quest wiring).

## What changed in practice

The repository moved from a single-gym demo into a full 8-gym campaign in two days. The largest shift on 2026-07-29 is the new `src/content/` layer: multi-act map bundles, quest state progression, scripted cutscenes, and post-game beats around the Ledger, Team Rollback, Originon at Null Peak, and Champion Kai.
