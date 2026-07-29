# World map
Active contributors: KeigoShimadaCC

## Purpose
Define the overworld map primitive used by movement, collision, events, NPC interactions, warps, and wild encounters.

## Definition
The source-of-truth types now live in `src/content/types.ts`, while `src/maps.ts` is a compatibility re-export shim to `src/content/*`.

### `GameMap`
`GameMap` in `src/content/types.ts` contains:

- Core identity/layout: `id`, `name`, `tiles`, `indoor`
- Navigation: `warps`, `lockedDoors`, optional `gates`, optional `oneWay`, optional `pads`
- Actors/interactions: `npcs`, `signs`, `items`
- Encounter model: `encounters`, `encounterRate`
- Script hooks: optional `events`, optional `onEnter`
- Puzzle/environment toggles: optional `buttons`, optional `windDir`, optional `lavaPeriod`

### Supporting types
- `Warp`: `x`, `y`, `to`, `tx`, `ty`
- `Gate`: `x`, `y`, `flag`, optional `text` (solid until `flag` is set)
- `Button`: `x`, `y`, `flag`, optional `toggle`, optional `text` (sets/toggles a flag)
- `OneWay`: `x`, `y`, `dir` (tile only enterable while moving in `dir`)
- `Pad`: `x`, `y`, `tx`, `ty` (in-map teleport pair)
- `MapEvent`: `x`, `y`, `script`, optional `once` flag
- `GroundItem`: `id`, `x`, `y`, `item`, `count`
- `EncounterEntry`: `species`, `minLv`, `maxLv`, `weight`, optional `nightWeight`
- `Npc`: base fields plus optional `action`, `script`, `trainer`, `hiddenUntilFlag`, `hiddenAfterFlag`
- `NpcTrainer`: `party`, `prize`, `sight`, optional `ai` tier (`basic`/`smart`/`leader`), optional `potions`

## Tile model and collision
`SOLID_TILES` is `new Set(['T', 'W', 'B', 'R', 'D', 'w', 'C', 'S', 'o', 'P'])`.  
`SHALLOW_TILE` is `~` and `BADGE_FLAG_SHALLOW` is `badge_tide`.

| Tile(s) | Meaning in gameplay | Source |
| --- | --- | --- |
| `T W B R D w C S o P` | Always blocking unless special logic applies (for example, warp doors) | `src/content/types.ts`, `src/game.ts` |
| `~` | Shallow water; blocked until Tide Badge flag (`badge_tide`) is set | `src/content/types.ts`, `src/game.ts` |
| `#` | Wind tile; pushes player one step in `map.windDir` after movement resolves | `src/game.ts` |
| `x` | Lava tile; blocked while lava is “hot”, toggled by `map.lavaPeriod` | `src/game.ts` |
| `G` | Wild encounter tile, sampled via `encounterRate` + `encounters` | `src/game.ts` |

## Map authoring and aggregation
Maps are authored as modular files under `src/content/maps/`, then merged in `src/content/maps/index.ts` into a single `MAPS` registry (base maps + `ACT2_MAPS` ... `ACT10_MAPS`).

```text
src/content/maps/
  index.ts
  mapletown.ts
  lab.ts
  route1.ts
  verdantcity.ts
  center.ts
  mart.ts
  gym.ts
  act2.ts ... act10.ts
  (53 .ts files total in this folder)
```

Related content modules:

- `src/content/trainers.ts` derives a global trainer dictionary by scanning `MAPS` NPC trainers, then merges script-only trainers.
- `src/content/encounters.ts` defines shared encounter tables used by map files (for example `route1Encounters`).

## Related pages
- [Primitives index](./index.md)
- [Content pipeline](../systems/content-pipeline.md)
- [Overworld](../systems/overworld.md)
- [Scripting](../systems/scripting.md)
