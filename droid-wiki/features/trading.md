# Trading
Active contributors: Keigo

## Purpose
Document the Maple Town NPC trade flow in `src/game.ts` and its built-in trade evolution interaction.

## Hiker trade flow
The hiker NPC (`action: trade`) uses `tradeDialogue()` and `openTradeSelect()`.

Trade behavior:
- One-time trade, guarded by `flags.hikerTraded`.
- Player must have more than one party member.
- Eggs are rejected as trade input.
- Player gives any non-egg party member.
- Player receives `Pebblit` at level 15 (`createMockemon('pebblit', 15)`).
- `flags.hikerTraded = true`.
- Dex tracking updates add `pebblit` to seen and caught.

## Immediate trade evolution
After receiving Pebblit:
- `checkEvolution(received, { kind: 'trade' })` is called.
- For Pebblit, this resolves to `bouldron`.
- The game runs `evolve(received, evoTo)` immediately.
- Dex tracking also adds `bouldron` to seen and caught.

This models classic trade-evolution behavior directly inside the NPC trade sequence.

## Related pages
- [Evolution](evolution.md)
