# Data models

Active contributors: KeigoShimadaCC

This page is the canonical shape reference for static and authored game data.

## Core catalog models (`src/data/*`)

Current catalog counts are 41 species, 66 moves, and 16 items (`src/data/species.ts`, `src/data/moves.ts`, `src/data/items.ts`).

### Species model (`src/data/species.ts`)

- `SpeciesDef` fields: `id`, `key`, `name`, `types`, `base`, `catchRate`, `expYield`, `growth`, `genderRatio`, `eggGroups`, `eggMoves`, `abilities`, `evYield`, `baseFriendship?`, `learnset`, `evolution?`, `dex`.
- `EvolutionDef` supports `method: 'level' | 'stone' | 'trade' | 'friendship'` with method-specific fields.
- `GrowthRate` supports `'fast' | 'mediumfast' | 'mediumslow' | 'slow' | 'erratic' | 'fluctuating'`.
- Exports include `SPECIES`, `DEX_ORDER`, and `DEX_COUNT`.

### Move model (`src/data/moves.ts`)

- `MoveDef` fields cover battle behavior: `id`, `name`, `type`, `category`, `power`, `accuracy`, `pp`, plus optional `priority`, `typeless`, `contact`, `status`, `statChange`, `drain`, `recoil`, `recoilMaxHp`, `multiHit`, `twoTurn`, `weather`, `terrain`, `screen`, `hazard`, `confuseChance`, `leechSeed`, `flinchChance`, `healSelf`.
- Exports include `MOVES` and helper `isContact(move)`.

### Item model (`src/data/items.ts`)

- `ItemDef` fields: `id`, `name`, `kind`, `price`, `desc`, `healAmount?`, `typeBoost?`.
- `ItemKind` supports `'medicine' | 'ball' | 'stone' | 'held' | 'key'`.
- Exports include `ITEMS`, base `SHOP_STOCK`, and `shopStock(badges)` unlock logic.

### Ability and type models (`src/data/abilities.ts`, `src/data/types.ts`)

- `AbilityDef` fields: `id`, `name`, `desc`. Exports include `ABILITIES` and `PINCH_ABILITIES`.
- `MType` union: `Normal`, `Fire`, `Water`, `Grass`, `Electric`, `Rock`, `Ground`, `Bug`, `Flying`, `Psychic`.
- Type chart logic is exposed through `effectiveness(attack, defenderTypes)` and `TYPE_COLORS`.

## Content-layer map models (`src/content/types.ts`)

`GameMap` now includes authored interaction systems beyond tiles/warps/NPCs:

- Base fields: `id`, `name`, `tiles`, `warps`, `npcs`, `items`, `encounters`, `encounterRate`, `signs`, `lockedDoors`, `indoor`.
- Expanded optional fields: `events`, `onEnter`, `gates`, `buttons`, `oneWay`, `pads`, `windDir`, `lavaPeriod`.

Supporting interfaces:

- Traversal/control: `Warp`, `Gate`, `Button`, `OneWay`, `Pad`.
- Eventing/content: `MapEvent`, `GroundItem`, `EncounterEntry`.
- NPCs: `Npc`, `NpcTrainer`.
- Tile constants: `SOLID_TILES`, `SHALLOW_TILE`, `BADGE_FLAG_SHALLOW`.

For full map authoring context, see [World map](../primitives/world-map.md) and [Content pipeline](../systems/content-pipeline.md).

## Quest models (`src/quests.ts`)

- `QuestDef`: `id`, `title`, `kind ('main' | 'side')`, `act`, `stages`, optional `reward`, optional `giver`.
- `QuestStage`: `id`, `objective`, `journal`.
- `QuestReward`: optional `item`, `count`, `money`, `mon`.
- `QuestProgress`: `Record<string, { stage: number; done: boolean }>` used for persistence.
- `QuestLog` is the runtime state manager for start/advance/complete/state/journal serialization.

See [Quests](../features/quests.md).

## Script DSL models (`src/script.ts`)

`ScriptCmd` is a tagged union covering dialogue, choices, flags, inventory, money, healing, battle, movement, quest progression, cutscenes, and host callbacks:

- Dialog/control: `say`, `choice`, `wait`, `call`.
- World/state: `setFlag`, `if`, `ifHasItem`, `ifQuest`, `warp`.
- Inventory/party: `giveItem`, `takeItem`, `giveMon`, `giveEgg`, `money`, `healParty`, `setHealPoint`, `shop`.
- Combat/progression: `battle`, `questStart`, `questAdvance`, `questComplete`, `cutscene`.

`ScriptHost` is implemented by `Game` and supplies the command surface (`src/game.ts`, `src/script.ts`).

See [Scripting](../systems/scripting.md).

## Gym and sequence models

- `GymDef` (`src/content/gyms.ts`): `n`, `mapId`, `town`, `townName`, `leaderId`, `leaderName`, `type`, `badge`, `badgeFlag`, `cap`, `questStage`, `nextHint`.
- `SeqStep` and `Easing` (`src/sequence.ts`) define cutscene/intro/credits sequencing via per-frame callbacks and easing functions.
