# Fun facts

## Verified bits of Pocket Mockster trivia

1. **`src/game.ts` is now the giant.**  
   It is the longest TypeScript/module file in the repo at **2,546 LOC** (`wc -l` across `src`, `tests`, and `tools`).

2. **The villain faction talks like a version-control team on purpose.**  
   Team Rollback dialogue is full of VCS language like “first draft,” “merge branches,” “merge conflict,” and “force-push” (`src/content/maps/lavatube.ts`, `src/content/scripts/index.ts`).

3. **Grunt battle barks are written as patch notes.**  
   `src/content/trainers.ts` includes lines like:
   - `Grunt: v2.1: Added roadblock to Verdant Woods. Expect resistance!`
   - `Grunt: Patch note: challenger defeated roadblock. Filing retreat.`

4. **Originon is literally framed as “the first entry.”**  
   The story and presentation both anchor this joke:
   - Credits line in `src/frontend.ts`: `Originon           the first entry`
   - Story line in `src/content/scripts/index.ts`: “The first Mockemon ever recorded in the Ledger...”

5. **The AI play-tester has personalities, not just one bot.**  
   `tools/agent/profiles.json` defines `casual-kid`, `speedrunner`, and `qa-adversary`, each with different speed/effort/debug behavior.

6. **The credits explicitly call out the build gates.**  
   `src/frontend.ts` credits include:
   - `Region design      Droid`
   - `Battle engine      Droid`
   - `Mockemon roster    Droid`
   - `Scenario           Droid`
   - `Quality gates      tsc, vitest, playwright`
