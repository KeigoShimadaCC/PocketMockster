# Background

This section captures why the project is structured the way it is and how major gameplay balance choices were made.

- [Design decisions](design-decisions.md)
- [Balance simulation](balance-simulation.md)

Recent architecture changes documented in this section include:

- The data-driven content layer and scripting DSL in `src/content/` and `src/script.ts`
- The frame-based sequence engine for cutscenes in `src/sequence.ts`
- Three-slot persistence with migration-aware loading in `src/frontend.ts` and runtime slot state in `src/main.ts`
- The AI agent harness as an exploratory testing strategy in `tools/agent/`
