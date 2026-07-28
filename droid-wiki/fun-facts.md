# Fun facts

## Five verified facts

1. **It was built in one day.**  
   `git log --reverse` shows 15 commits, and every one is dated `2026-07-28`.

2. **Buzzler is tuned to concert A.**  
   In `src/data/species.ts`, Buzzler's dex text says:  
   `"A beetle that buzzes at exactly 440 Hz. Musicians tune their instruments to it."`

3. **There is a headless campaign simulator for balance tuning.**  
   `tools/simulate.ts` sets `TRIALS = 400` and loops over 3 starters × 3 wild-fight counts (9 configs total).  
   Commit `f3ea51a` records that this loop was used to retune Cindercub to a 92-98% badge rate.

4. **The browser runtime exposes a full debug API on `window.__PM`.**  
   `src/main.ts` defines `window.__PM` with helpers like `warp`, `setPartyLevels`, `addItem`, and `setTime`.  
   Playwright specs call it directly across journey/mechanics/systems tests.

5. **The project is both clean and bot-tagged in commit history.**  
   `rg "TODO|FIXME|HACK" src` returns no matches, and all 15 of 15 commits include a `Co-authored-by: factory-droid[bot]` trailer.

Related docs: [how-to-contribute/tooling.md](how-to-contribute/tooling.md), [background/balance-simulation.md](background/balance-simulation.md).
