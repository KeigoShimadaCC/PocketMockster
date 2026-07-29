# Development workflow
Active contributors: KeigoShimadaCC

## Purpose

This page describes the local edit, check, and commit loop used in this repository.

## Clone and install

From your machine:

1. Clone the repository.
2. Install dependencies with `npm install`.
3. Start the dev server with `npm run dev`.

## Daily loop

The repository currently uses a local workflow with no branch or PR automation configured in-repo.

Typical cycle:

1. Run `npm run dev`.
2. Make focused edits.
3. Validate locally.
4. Commit with a conventional message prefix.

## Check sequence before commit

Run checks in this order:

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run test:e2e`
5. `npm run validate:content`

If a check fails, fix the issue and rerun that check before continuing.

## Commit style

Use conventional commit prefixes that match existing history:

- `feat`
- `fix`
- `test`
- `docs`
- `balance`
- `chore`

Examples:

- `feat: add early-route held item tutorial`
- `fix: correct move priority tie handling`
- `balance: tune gym leader levels`

## Data-first content additions

Most game content is data-driven. New maps, quests, cutscene/script data, and story progression entries should be added under `src/content/`. Species, moves, and items still live in `src/data/*`.

After content edits, run `npm run validate:content` to catch reference and wiring issues before PR.
