# Systems
Active contributors: KeigoShimadaCC

## Purpose
This section explains the internal building blocks that run Pocket Mockster.

The runtime now consumes a dedicated content layer in `src/content/` (maps, gyms, trainers, encounters, quests, scripts), while `src/maps.ts` remains a thin compatibility re-export.

## System pages
| Page | Description |
| --- | --- |
| [Game loop](game-loop.md) | Boot flow, fixed-timestep update loop, mode dispatch, and debug API wiring. |
| [Overworld](overworld.md) | Tile movement, interaction rules, step events, and overworld rendering flow. |
| [Rendering](rendering.md) | Immediate-mode canvas rendering, sprites, tiles, and day-night tint overlay. |
| [Scripting](scripting.md) | `ScriptCmd` language, `ScriptRunner` queue execution, and map/NPC script triggers. |
| [Cutscenes and sequences](cutscenes.md) | Frame-sequence engine, boot intro movie, credits roll, and script cutscene bridge. |
| [Content pipeline](content-pipeline.md) | Typed content modules, map/quest/script aggregation, and content validation. |
| [Input](input.md) | Virtual key mapping and the held and pressed input queues used by gameplay. |
| [RNG](rng.md) | Seedable xorshift32 random system used for deterministic gameplay and tests. |
| [Persistence](persistence.md) | Three-slot save and load behavior, save migration, and intro/save-slot frontend helpers. |

The battle system is documented separately in [Battle engine](battle-engine/index.md), which covers [damage and types](battle-engine/damage-and-types.md), [status and field effects](battle-engine/status-and-field.md), [abilities and held items](battle-engine/abilities-and-items.md), and [trainer AI](battle-engine/trainer-ai.md).
