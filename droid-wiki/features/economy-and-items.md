# Economy and items
Active contributors: KeigoShimadaCC

## Purpose
Summarize player money flow and item usage paths implemented in `src/game.ts` and item definitions in `src/data/items.ts`.

## Money flow
- Trainer wins award money (`this.money += trainer.prize`).
- Shop purchases reduce money one item at a time.
- Whiteout penalty removes half current money:
  - `lost = Math.floor(this.money / 2)`
  - party is healed
  - player respawns at `healPoint`

## Shop and stock
`openShop()` uses `SHOP_STOCK` and buys one unit per confirm press.

Current `SHOP_STOCK` in `src/data/items.ts`:
- `potion`
- `superpotion`
- `mockball`
- `thunderstone`
- `waterstone`
- `moonstone`
- `oranberry`
- `sitrusberry`

## Bag categories and overworld usage
`openBagMenu()` reads owned items and dispatches by `ItemKind`:
- `medicine`: selects a party target and heals through `openPartyMenu` heal path.
- `ball`: blocked in overworld with "Better save it for a wild Mockemon!"
- `stone`: opens party target select and attempts stone evolution.
- `held`: opens party target select to give a held item.
- `key`: item kind exists in data model, but no key-item use flow is wired in this menu path.

Held item management in party context:
- Give item: swap with existing held item if needed.
- Take item: returns held item to inventory.

## Gift items
The Maple Town old man (`giveballs`) grants a one-time starter bundle:
- `5 MockBalls`
- `2 Potions`
- flag set: `gotBalls`

## Item catalog overview
`src/data/items.ts` currently defines 16 item ids in `ITEMS`:
- Medicine: Potion, Super Potion
- Ball: MockBall
- Evolution stones: Thunder Stone, Water Stone, Moon Stone
- Held items:
  - Berries (Oran, Sitrus)
  - Passive sustain (Leftovers)
  - Power modifiers and constraints (Power Band)
  - Survival utility (Safety Sash)
  - Turn-order utility (Swift Feather)
  - EXP utility (Lucky Charm)
  - Type-boost charms (Ember, Tide, Leaf)

## Quest reward items in the current content set
Quest reward metadata in `src/content/quests.ts` and quest payout wiring in `Game.questComplete()` (`src/game.ts`) include:
- `moonstone` (`lost_nibbit`)
- `swiftfeather` (`contest`, `sky_feather`)
- `luckycharm` (`daycare_egg`)
- `tidecharm` (`lighthouse`)
- `powerband` (`gauntlet`)
- `sitrusberry` (`berries`, count 3)
- `safetysash` (`observatory_ghost`)
- `leftovers` (`dex_milestones`)

In-battle item resolution details live in battle engine documentation.

## Related pages
- [Battle engine abilities and items](../systems/battle-engine/abilities-and-items.md)
- [Data models reference](../reference/data-models.md)
