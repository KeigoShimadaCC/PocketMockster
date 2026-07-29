# Overworld
Active contributors: KeigoShimadaCC

## Purpose
Document overworld movement, blocking, interaction, scripted map events, and related menu and dialogue state.

## Movement in `updateOverworld`
`Game.updateOverworld()` in `src/game.ts` handles movement in two phases:

1. **During tile-step animation (`moving === true`)**
   - Decrements `moveOffX` and `moveOffY` toward 0 at speed 4 px per tick.
   - When both reach 0, marks movement complete and calls `onStepComplete()`.

2. **When idle (`moving === false`)**
   - Reads one key from `consumePress()`.
   - If no queued press, falls back to held priority: `up`, `down`, `left`, `right` via `isHeld()`.
   - `a` triggers `interact()`.
   - `start` opens start menu.
   - Direction keys set `facing`, test `isBlocked(nx, ny)`, and if walkable:
     - move `px/py` to next tile
     - set `moveOffX/moveOffY` to `-dx * TILE` / `-dy * TILE`
     - set `moving = true`

## Blocking rules in `isBlocked`
`isBlocked(x, y)` checks:
- Tile solidity using `SOLID_TILES` re-exported by `src/maps.ts` from `src/content/types.ts`.
- Exception: if tile is a warp door (`map.warps` contains that position), it is walkable.
- Shallow water (`SHALLOW_TILE`, `~`) is blocked until `flags[BADGE_FLAG_SHALLOW]` is true (`badge_tide`).
- Lava tiles (`x`) are blocked while `lavaHot()` is true; heat toggles by `map.lavaPeriod`.
- Closed gates from `map.gates` block until their flag is opened.
- One-way tiles from `map.oneWay` block entry when approach direction does not match `oneWay.dir`.
- NPC occupancy: visible NPCs (`npcVisible`) block their tile.

## Step completion flow in `onStepComplete`
`onStepComplete()` runs checks in strict order:

```mermaid
flowchart TD
  A[Step complete] --> B{Warp tile?}
  B -- starter gate block --> C[Push player back + dialogue]
  B -- normal warp --> D[Switch map and coords then fire onEnter script event]
  B -- no warp --> E{Pad at tile?}
  E -- yes --> F[Teleport to pad target]
  E -- no --> G{Wind tile # and windDir?}
  G -- yes --> H[Forced step in windDir]
  G -- no --> I{Scripted map event on this tile?}
  I -- yes --> J[Run event script]
  I -- no --> K{Ground item here?}
  K -- yes --> L[Collect item + dialogue]
  K -- no --> M{Any egg hatches?}
  M -- yes --> N[Hatch dialogue]
  M -- no --> O[Daycare breeding tick]
  O --> P{Rival ambush condition?}
  P -- yes --> Q[Start rival battle]
  P -- no --> R{Trainer line of sight?}
  R -- yes --> S[Start trainer battle]
  R -- no --> T{Grass encounter roll?}
  T -- yes --> U[Start wild battle]
```

Specific checks include:
- Warp transitions, including Maple Town to Route 1 starter lock before `starterChosen`, plus `onEnter` script hooks.
- Teleport pads from `map.pads`.
- Wind push tiles (`#`) using `map.windDir`.
- Tile-bound scripted events from `map.events`.
- Ground item pickup from `map.items`.
- Party egg ticking (`tickEgg`).
- Daycare breeding step counter and egg generation every 256 valid steps.
- Rival ambush in lab after starter choice and before rival defeat.
- Trainer line-of-sight challenge via `inSight`.
- Wild encounters only on `G` grass tiles, with encounter rate roll and party viability checks.

## Line-of-sight in `inSight`
`inSight(npc)` traces forward from trainer facing direction up to `trainer.sight` tiles:
- Returns true if player is on one of those tiles.
- Stops early if a solid tile blocks vision.

## Interaction in `interact`
Interaction target order:
1. Adjacent visible NPC.
2. Talk-over-counter: if front tile is `C`, check one more tile beyond for NPC.
3. Adjacent sign (`map.signs`).
4. Adjacent locked door (`map.lockedDoors`).
5. Adjacent starter table tile `P` with context-sensitive starter text.

## NPC action dispatch in `talkTo`
`talkTo(npc)` routes by trainer status and `npc.action`:
- Trainer battle start if trainer exists and not yet defeated.
- `starter` -> starter selection dialogue and menu.
- `shop` -> mart shop menu.
- `gymleader` -> badge-dependent dialogue.
- `daycare` -> daycare dialogue and daycare menu stack.
- `trade` -> NPC trade flow.
- Default -> plain `npc.dialogue`.

If `npc.script` exists, it takes precedence and runs through `runScript` before action/dialogue dispatch (`src/game.ts`, `src/content/types.ts`).

## Interactive map devices
`interact()` also handles map devices from content definitions:
- Buttons (`map.buttons`): pressing A toggles or sets the flag (`toggle === false` means set-only), then shows feedback text.
- Gates (`map.gates`): closed gates can display gate-specific blocker text.
- Signs and locked doors: still read from `map.signs` and `map.lockedDoors`.

## Dialogue and menu state
From `src/game.ts`:
- `showDialogue(lines, done?)` paginates lines and switches mode to `dialogue`.
- `MenuState` fields: `title`, `items`, `index`, `onSelect`, `onCancel`, optional `info`.
- `openMenu(m, push)` supports nested menus via `menuStack`.
- `closeMenu()` pops previous menu or returns to `overworld`.
- `closeAllMenus()` clears all menu state and returns to `overworld`.

The start menu now includes a dedicated `QUESTS` entry, and `openQuestMenu()` renders active and completed quest journal lines from `QuestLog` (`src/game.ts`, `src/quests.ts`).

## Overworld rendering
`renderOverworld()`:
- Computes camera centered on player with map-edge clamp.
- Draws visible tiles via `drawTile`.
- Draws uncollected ground items.
- Draws visible NPC sprites and trainer exclamation markers.
- Draws player sprite with facing-based flip.
- Draws location banner and clock panel.

Then `renderTint()` applies outdoor day/night overlay.

Map data now comes from the content layer through `MAPS` (`src/content/maps/index.ts`) and the `src/maps.ts` re-export shim.

Related pages:
- [Story progression](../features/story-progression.md)
- [Day-night cycle](../features/day-night-cycle.md)
- [World map](../primitives/world-map.md)
- [Scripting](scripting.md)
- [Content pipeline](content-pipeline.md)

## Key source files
| File | Role |
| --- | --- |
| `src/game.ts` | Overworld update logic, interactions, menus, and rendering. |
| `src/content/types.ts` | Map content types: gates, buttons, one-way tiles, pads, events, and tile constants. |
| `src/content/maps/index.ts` | Aggregates authored map modules into runtime `MAPS`. |
| `src/maps.ts` | Thin compatibility re-export for `MAPS` and tile constants. |
| `src/input.ts` | Press and held input APIs consumed by `updateOverworld()`. |
| `src/daynight.ts` | Time formatting and day phase used in overworld HUD and tinting. |
