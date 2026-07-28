# Move
Active contributors: Keigo

## Purpose
Define the move data contract used by the battle engine for damage, targeting effects, statuses, and field-state changes.

## Definition
Defined in `src/data/moves.ts` as `MoveDef`:

- Required fields: `id`, `name`, `type`, `category`, `power`, `accuracy`, `pp`
- `accuracy` uses `999` to mean never misses.

## Union types
- `MoveCategory`: `physical` | `special` | `status`
- `StatusId`: `PAR` | `BRN` | `PSN` | `TOX` | `SLP` | `FRZ`
- `StageStat`: `atk` | `def` | `spa` | `spd` | `spe` | `acc` | `eva`
- `WeatherId`: `sun` | `rain` | `sand`
- `TerrainId`: `electric` | `grassy`
- `ScreenId`: `reflect` | `lightscreen`
- `HazardId`: `spikes` | `stealthrock`

## Optional field meanings
- `priority`: action priority offset.
- `typeless`: ignores type chart, used by typeless actions like Struggle.
- `contact`: explicit override for contact classification.
- `status`: target status application `{ id, chance }`.
- `statChange`: staged stat change `{ stat, stages, target, chance }`.
- `drain`: fraction of damage dealt returned as healing.
- `recoil`: fraction of damage dealt reflected to the user.
- `recoilMaxHp`: fixed recoil as fraction of user max HP.
- `multiHit`: random hit count bounds `{ min, max }`.
- `twoTurn`: charge-turn metadata `{ chargeText, invulnerable }`.
- `weather`: sets active weather.
- `terrain`: sets active terrain.
- `screen`: sets team screen effect.
- `hazard`: places entry hazard.
- `confuseChance`: chance to apply confusion.
- `leechSeed`: applies leech-seed style effect.
- `flinchChance`: chance to flinch the target.
- `healSelf`: fraction of user max HP restored.

## Contact resolution
- `isContact(move)` in `src/data/moves.ts`:
  - Returns `move.contact` when explicitly set.
  - Otherwise defaults to `true` for `physical` moves and `false` for others.

## Representative moves
| Move | Category | Key optional fields |
| --- | --- | --- |
| `quickattack` | physical | `priority: 1` |
| `struggle` | physical | `typeless: true`, `recoilMaxHp: 0.25`, `accuracy: 999` |
| `firefang` | physical | `status` (burn chance), `flinchChance` |
| `bubblebeam` | special | `statChange` (speed drop chance) |
| `furyswipes` | physical | `multiHit` |
| `dig` | physical | `twoTurn` with invulnerability |
| `stealthrock` | status | `hazard` |
| `mend` | status | `healSelf: 0.5` |

Full move listings are in [Data models reference](../reference/data-models.md).

## Engine interpretation note
The battle engine interprets these fields during turn resolution. See:

- [Battle engine: damage and types](../systems/battle-engine/damage-and-types.md)
- [Battle engine: status and field](../systems/battle-engine/status-and-field.md)

## Related pages
- [Primitives index](./index.md)
- [Mockemon](./mockemon.md)
- [Species](./species.md)
- [Data models reference](../reference/data-models.md)
