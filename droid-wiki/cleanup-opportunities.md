# Cleanup opportunities

- `src/game.ts` is **2546 lines** (`wc -l src/game.ts`) and currently mixes overworld movement, dialogue/menu flow, quest progression, script execution hooks, battle UI flow, save/load, and rendering. This is still the top complexity hotspot and best extraction candidate.
- `src/battle.ts` is **1011 lines** and is the second major concentration of logic.
- `src/` contains **zero** `TODO`, `FIXME`, or `HACK` comments (verified by grep), which indicates intentional cleanup discipline in code comments.
- `tests/coverage.spec.ts` still has failing E2E cases on the current tree (latest run: 14 passed, 3 failed). Failing cases were:
  - `friendship evolution fires on level-up (nibbit -> nibblex)`
  - `power band locks the holder into its first move`
  - `two-turn dig charges, then releases even if another move is picked`
- No CI workflow files are present (no `.github/workflows/*`), so lint/type/test checks are currently local-only.
- `dist/` and `test-results/` are present in the repository as generated artifact directories.
- There is an untracked local diagnostic script: `tools/diag-evo.mjs`. Decide whether to commit it (if it is a maintained workflow) or remove it from working trees before release.
