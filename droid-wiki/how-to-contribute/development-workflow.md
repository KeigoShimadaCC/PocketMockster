# Development workflow

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

Most game content is data-driven. When adding species, moves, items, maps, or trainers, append entries to the relevant `list` in `src/data/*` and let the exported lookup records derive from that list.

This keeps new content consistent with existing loading and indexing patterns.
