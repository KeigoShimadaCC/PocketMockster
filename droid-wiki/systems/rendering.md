# Rendering
Active contributors: Keigo

## Purpose
Describe how Pocket Mockster draws each frame with canvas 2D, sprites, tiles, and time-of-day tinting.

## Immediate-mode canvas rendering
Rendering is immediate-mode in `src/game.ts`:
- `render()` clears and repaints every frame.
- It draws the active mode scene, then draws the controls bar.
- There is no retained scene graph.

Layout constants in `src/game.ts`:
- `TILE = 32`
- `VIEW_W = 480`
- `VIEW_H = 320`
- `BAR_H = 32`

## Per-mode render paths
`render()` dispatches by `Game.mode`:
- `renderTitle()`
- `renderOverworld()` and `renderTint()` for overworld-family modes
- `renderBattle()`
- `renderSummary()`
- `renderDex()`
- `renderEnding()`
- `renderDialogue()` overlay when mode is `dialogue`
- `renderMenu()` overlay when mode is `menu`
- `renderControlsBar()` always

## Sprite system from `src/sprites.ts`
- `Sprite` interface:
  - `pal: Record<string, string>`
  - `rows: string[]`
- `drawSprite(ctx, spr, x, y, scale, flip)`:
  - Iterates 16x16 character grid rows.
  - `.` means transparent.
  - Looks up fill color in `pal`.
  - Supports horizontal flip with mirrored x index.
- `person(hair, shirt, pants, skin?)` factory returns humanoid sprite templates.
- `monSprite(key)` returns `MON_SPRITES[key]` with fallback to `MON_SPRITES.nibbit`.

## Tile drawing by character
`drawTile()` in `src/game.ts` draws procedural tile art by map character:
- Overworld and terrain: `.`, `,`, `G`, `T`, `W`
- Buildings and objects: `R`, `B`, `D`, `S`, `w`, `F`, `C`, `M`, `P`, `o`
- Unknown defaults to dark fill.

Map character grids come from `src/maps.ts`.

## Day and night tint overlay
`renderTint()` in `src/game.ts`:
- Skips indoor maps.
- Gets phase with `phaseFor(this.minute)`.
- Gets overlay with `tintFor(phase)` from `src/daynight.ts`.
- Applies full-screen alpha color fill on gameplay viewport.

## Drawing helpers
Bottom-of-file helpers in `src/game.ts`:
- `text(...)`
- `panel(...)`
- `hpBar(...)`
- `wrap(...)`
- `paginate(...)`

## Key source files
| File | Role |
| --- | --- |
| `src/game.ts` | Main render dispatcher, mode renderers, tile rendering, tint pass, draw helpers. |
| `src/sprites.ts` | Sprite definitions and sprite blitting utilities. |
| `src/daynight.ts` | Phase and tint values used by the tint overlay. |
| `src/maps.ts` | Character tile maps that drive `drawTile()`. |
