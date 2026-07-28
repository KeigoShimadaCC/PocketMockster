# Systems
Active contributors: Keigo

## Purpose
This section explains the internal building blocks that run Pocket Mockster.

## System pages
| Page | Description |
| --- | --- |
| [Game loop](game-loop.md) | Boot flow, fixed-timestep update loop, mode dispatch, and debug API wiring. |
| [Overworld](overworld.md) | Tile movement, interaction rules, step events, and overworld rendering flow. |
| [Rendering](rendering.md) | Immediate-mode canvas rendering, sprites, tiles, and day-night tint overlay. |
| [Input](input.md) | Virtual key mapping and the held and pressed input queues used by gameplay. |
| [RNG](rng.md) | Seedable xorshift32 random system used for deterministic gameplay and tests. |
| [Persistence](persistence.md) | Save and load behavior through `localStorage` key `pm_save`. |

The battle system is documented separately in [Battle engine](battle-engine/index.md), which covers [damage and types](battle-engine/damage-and-types.md), [status and field effects](battle-engine/status-and-field.md), [abilities and held items](battle-engine/abilities-and-items.md), and [trainer AI](battle-engine/trainer-ai.md).
