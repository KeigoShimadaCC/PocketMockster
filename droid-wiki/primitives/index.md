# Primitives
Active contributors: KeigoShimadaCC

## Purpose
This section documents the foundational domain objects that the game, battle engine, data files, and maps build on.

## Domain object index
| Domain object | Defined in | Primary uses |
| --- | --- | --- |
| `Mockemon`, `MoveSlot`, `StatBlock` | `src/mockemon.ts` | Party state, battle state, leveling, evolution updates, healing, save/load payloads |
| `SpeciesDef`, `EvolutionDef` | `src/data/species.ts` | Creature roster (`DEX_COUNT` currently 41), learnsets, base stats, growth rates, evolution rules, dex metadata |
| `MoveDef` and move unions | `src/data/moves.ts` | Battle action resolution for 66 move definitions (top-level move list) including damage, statuses, stat stages, weather, terrain, hazards, and screens |
| `MType` and type chart | `src/data/types.ts` | Damage effectiveness and UI type-color rendering |
| `GameMap`, `Warp`, `Npc`, `NpcTrainer`, `GroundItem`, `EncounterEntry` | `src/content/types.ts` (`src/maps.ts` re-exports) | Overworld layout, collisions, NPC interaction, encounters, map transitions, gates/buttons/events, and map puzzle metadata |

## Pages
- [Mockemon](./mockemon.md)
- [Species](./species.md)
- [Move](./move.md)
- [World map](./world-map.md)
