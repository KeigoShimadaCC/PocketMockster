# How to contribute
Active contributors: KeigoShimadaCC

## Purpose

This page explains how contribution work happens in this repository and where to find the detailed workflow, testing, debugging, and tooling guidance.

## How work happens in this repo

There is no CI automation configured in this repository today. Quality gates are run locally before commit:

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run test:e2e`
5. `npm run validate:content`

Commit messages follow the conventional prefixes already used in the history: `feat`, `fix`, `test`, `docs`, `balance`, and `chore`.

## Definition of done

A change is done when:

- Type checking passes.
- Lint passes.
- Unit tests pass.
- End-to-end tests pass.
- Content validation passes (`npm run validate:content`).
- If combat logic changed, balance is still healthy.

## Pages in this section

- [Development workflow](development-workflow.md)
- [Testing](testing.md)
- [Debugging](debugging.md)
- [Tooling](tooling.md)
- [Agent harness](agent-harness.md)
- [Patterns and conventions](patterns-and-conventions.md)
