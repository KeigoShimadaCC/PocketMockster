# Cleanup opportunities

- `src/game.ts` is **2058 lines** and currently mixes overworld movement, dialogue/menu flow, battle UI flow, save/load, and rendering. This is a clear complexity hotspot and the best candidate for extraction work (for example, rendering and menu flow modules).
- `src/battle.ts` is **1011 lines** and is the second major concentration of logic.
- `src/` contains **zero** `TODO`, `FIXME`, or `HACK` comments (verified by grep), which indicates intentional cleanup discipline in code comments.
- No CI workflow files are present (no `.github/workflows/*`), so lint/type/test checks are currently local-only.
- `dist/` and `test-results/` are present in the repository as generated artifact directories.
