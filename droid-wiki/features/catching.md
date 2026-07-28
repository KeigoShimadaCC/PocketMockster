# Catching
Active contributors: Keigo

## Purpose
Document how wild Mockemon capture works from the battle bag in `src/game.ts` and `Battle.tryCatch` in `src/battle.ts`.

## Player flow
1. In battle, choose `BAG`.
2. Select `MockBall`.
3. The action calls `Battle.tryCatch`.
4. If successful, battle outcome becomes `'caught'`.
5. In `Game.startWildBattle` callback, the caught Mockemon is added to party if there is room, otherwise to storage.
6. `caughtSpecies` is updated for the caught species.

Trainer battles block capture attempts and show a failure message.

## Catch formula
`Battle.tryCatch` computes:

`a = min(255, ((3*maxHp - 2*hp) * catchRate * statusBonus) / (3*maxHp))`

Where:
- `statusBonus = 2` for `SLP` or `FRZ`
- `statusBonus = 1.5` for other status
- `statusBonus = 1` for no status

If `a >= 255`, the catch succeeds automatically.

Otherwise:
- Critical capture chance is 12 percent.
- On critical capture, run 1 shake check.
- Otherwise, run 4 shake checks.

Shake threshold:

`b = floor(65536 / (255 / a)^0.1875)`

Each check succeeds if random `[0,65535]` is less than `b`.

## Catch resolution flow
```mermaid
flowchart TD
  A[Use MockBall in battle bag] --> B{Trainer battle?}
  B -- yes --> C[Cannot catch trainer mon]
  B -- no --> D[Compute a with HP, catchRate, statusBonus]
  D --> E{a >= 255}
  E -- yes --> F[Auto catch]
  E -- no --> G[Set checks: 1 if critical else 4]
  G --> H[Compute b and run shake checks]
  H --> I{All checks pass?}
  I -- yes --> F
  I -- no --> J[Break free]
  F --> K[outcome = caught and caughtMon set]
  K --> L[Game adds to party or storage and updates caughtSpecies]
```

## Related pages
- [Battle engine overview](../systems/battle-engine/index.md)
- [MockDex](mockdex.md)
