# Abilities and held items
Active contributors: Keigo

Purpose: map `src/data/abilities.ts` and `src/data/items.ts` to their concrete battle behavior in `src/battle.ts`.

## Related pages
- [Battle engine](./index.md)
- [Damage and type effectiveness](./damage-and-types.md)
- [Status and field effects](./status-and-field.md)
- [Move primitive](../../primitives/move.md)
- [Mockemon primitive](../../primitives/mockemon.md)
- [Data models](../../reference/data-models.md)
- [Catching feature](../../features/catching.md)

## Abilities implemented in battle
All 13 ability IDs in `src/data/abilities.ts` are consumed in `src/battle.ts`.

| Ability | Battle behavior |
| --- | --- |
| `verdantforce` | Included in `PINCH_ABILITIES`; if user HP `<= floor(maxHp/3)` and move type is Grass, damage modifier `*1.5`. |
| `cinderheart` | Pinch Fire bonus `*1.5` at low HP. |
| `riptide` | Pinch Water bonus `*1.5` at low HP. |
| `staticfur` | On contact, 30% chance to paralyze attacker if attacker has no status. |
| `toxicbarb` | On contact, 30% chance to poison attacker if attacker has no status. |
| `menace` | On switch-in (`onSwitchIn`), lowers foe Attack stage by 1 unless already at -6. |
| `musclebound` | In `atkStat`, doubles physical attack (`*2`). |
| `momentum` | In `endOfTurn`, raises own side Speed stage by 1 (up to +6) if alive. |
| `rocksolid` | If at full HP and lethal hit lands, survive at 1 HP. |
| `airborne` | Immune to Ground damage; also treated as not grounded for Spikes. |
| `sponge` | Absorbs Water damaging moves, heals 25% max HP, takes no damage. |
| `embergut` | Absorbs Fire damaging moves, sets `emberBoost` on defender side. |
| `adaptive` | STAB multiplier becomes `2.0` instead of `1.5`. |

## Held items used in battle
Battle logic uses held items for end-of-turn healing, stat/damage multipliers, move lock, priority, survival, and EXP boost.

| Item | Battle behavior |
| --- | --- |
| `oranberry` | End-of-turn at `hp <= floor(maxHp/2)`: consume and heal `10`. |
| `sitrusberry` | End-of-turn at `hp <= floor(maxHp/2)`: consume and heal `floor(maxHp/4)`. |
| `leftovers` | End-of-turn heal `max(1, floor(maxHp/16))`. |
| `powerband` | Physical attack `*1.5` in `atkStat`; also enforces `choiceLock` to one move until switch/reset. |
| `safetysash` | At full HP, survive lethal hit at 1 HP once, then item is consumed. |
| `swiftfeather` | During turn order, 20% chance to gain +1 priority for that turn. |
| `luckycharm` | `grantExp`: holder gains 50% more EXP (`floor(amount*1.5)`). |
| `embercharm` | If move type is Fire, final damage modifier `*1.2`. |
| `tidecharm` | If move type is Water, final damage modifier `*1.2`. |
| `leafcharm` | If move type is Grass, final damage modifier `*1.2`. |

## Power Band choice-lock details (`choiceLock`)
`choiceLock` is tracked per side (`SideState.choiceLock`).

Player path in `takeTurn`:
1. If active holds `powerband` and not mid-charge:
   - if no existing lock and selected move is not `struggle`, set `choiceLock` to selected move ID.
   - if locked and selected move differs, turn fails with lock message.
   - if locked move has no PP, clear lock and force `struggle`.

Enemy path:
1. `enemyPickMove` checks lock first:
   - if locked move still usable, must use it.
   - if locked move unusable, clears lock and returns `struggle`.
2. After selecting move, if enemy holds `powerband` and has no lock and move is not `struggle`, set lock.

Lock reset points:
- Player switch and forced switch reset player-side `choiceLock = null`.
- Enemy replacement after faint resets enemy-side `choiceLock = null`.

## Ability and item interactions in move resolution
- Contact abilities (`staticfur`, `toxicbarb`) only trigger when `isContact(move)` is true and target survives hit.
- `emberBoost` from `embergut` is consumed as a state flag in damage math and can stack with STAB/pinch/type charm modifiers multiplicatively.
- `rocksolid` and `safetysash` are checked after raw damage is computed but before HP subtraction.

## Key source files
| File | Role |
| --- | --- |
| `src/data/abilities.ts` | Ability IDs and pinch mapping source |
| `src/data/items.ts` | Held item IDs and typeBoost metadata |
| `src/battle.ts` | All ability/item runtime effects, including locks, recoil survival, status reflection, and EXP bonus |
| `src/data/moves.ts` | Contact metadata and move type/category fields used by ability/item checks |
