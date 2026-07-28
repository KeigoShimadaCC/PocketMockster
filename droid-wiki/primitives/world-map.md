# World map
Active contributors: Keigo

## Purpose
Define the overworld map data model, including tile layouts, warps, NPC scripts, encounter tables, and map-level interaction metadata.

## Definition
Defined in `src/maps.ts`.

### `GameMap`
- `id`, `name`
- `tiles: string[]`
- `warps: Warp[]`
- `npcs: Npc[]`
- `items: GroundItem[]`
- `encounters: EncounterEntry[]`
- `encounterRate`
- `signs`
- `lockedDoors`
- `indoor`

### Supporting types
- `Warp`: `x`, `y`, `to`, `tx`, `ty`
- `Npc`:
  - Base fields: `id`, `x`, `y`, `spriteKey`, `facing`, `dialogue`
  - Optional `action`: `heal` | `shop` | `giveballs` | `starter` | `gymleader` | `daycare` | `trade`
  - Optional `trainer: NpcTrainer`
  - Optional `hiddenUntilFlag`, `hiddenAfterFlag`
- `NpcTrainer`:
  - `id`, `name`, `spriteKey`
  - `party` (`species`, `level`)
  - `prize`, `introText`, `defeatText`
  - `sight`
  - Optional AI tier `ai`: `basic` | `smart` | `leader`
  - Optional `potions`
- `GroundItem`: `id`, `x`, `y`, `item`, `count`
- `EncounterEntry`: `species`, `minLv`, `maxLv`, `weight`, optional `nightWeight`

## Collision and tile legend
- `SOLID_TILES` is `new Set(['T', 'W', 'B', 'R', 'D', 'w', 'C', 'S', 'o', 'f', 'P'])`.
- Tile character legend used in map strings:
  - `T` tree
  - `W` water
  - `B` window
  - `R` roof
  - `D` door
  - `w` wall
  - `C` counter
  - `S` sign or tree marker
  - `o` rock
  - `f` furniture/blocking marker
  - `P` starter table
  - `G` tall grass
  - `,` path
  - `.` grass/open walkable ground
  - `F` floor
  - `M` map transition mat

## Maps in code
`MAPS` currently defines 7 maps:

| Map ID | Name | Purpose |
| --- | --- | --- |
| `mapletown` | Maple Town | Start town hub with daycare, trade NPC, and early story NPCs |
| `lab` | Prof. Maple's Lab | Starter selection and rival intro |
| `route1` | Route 1 | Wild encounters, item pickups, and trainer battles |
| `verdantcity` | Verdant City | City hub linking center, mart, and gym |
| `center` | Mock Center | Team healing via nurse action |
| `mart` | Mock Mart | Item shop via clerk action |
| `gym` | Verdant Gym | Gym trainers and leader Terra encounter |

## Related pages
- [Primitives index](./index.md)
- [Overworld system](../systems/overworld.md)
- [Day/night cycle](../features/day-night-cycle.md)
- [Data models reference](../reference/data-models.md)
