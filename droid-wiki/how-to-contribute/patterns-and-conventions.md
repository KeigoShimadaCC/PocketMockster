# Patterns and conventions

This page describes the coding patterns that recur across Pocket Mockster. Match them when adding code.

## Language and strictness

The project is TypeScript in strict mode (`tsconfig.json`: `strict`, `noUnusedLocals`, `noFallthroughCasesInSwitch`). It compiles with `noEmit` for checking and lets Vite handle the actual bundling. Target is ES2020 with DOM libs. `isolatedModules` and `resolveJsonModule` are on.

ESLint uses the recommended JS and typescript-eslint rule sets with two local tweaks (`eslint.config.js`):

- `no-explicit-any` is off. `any` is used deliberately in a few places (e.g. the `window.__PM` payload).
- Unused variables error unless prefixed with `_`.

## Data as plain records

All static game content is a flat array of typed objects that gets indexed into a `Record` by key. This pattern repeats in every `src/data/` file and in `maps.ts`:

```ts
const list: MoveDef[] = [ /* ... */ ];
export const MOVES: Record<string, MoveDef> = Object.fromEntries(list.map((m) => [m.id, m]));
```

To add content you append to the `list` and the lookup map updates automatically. Optional fields on the def interfaces gate behavior: a move with a `weather` field sets weather, a species with an `evolution` field can evolve, and so on. Prefer adding an optional field over branching on a name.

## Template vs instance

Static data (a `SpeciesDef`, `MoveDef`, `ItemDef`) is immutable and shared. A live creature is a `Mockemon` object built by `createMockemon(speciesKey, level)` in [`src/mockemon.ts`](../primitives/mockemon.md). Never mutate the data records at runtime; mutate the instance. `def(m)` resolves an instance back to its species def.

## The RNG is centralized and seedable

All randomness goes through [`src/rng.ts`](../systems/rng.md) (`rand`, `randInt`, `chance`, `pick`). Do not call `Math.random()`. This keeps runs reproducible under a fixed seed, which the tests and the balance simulator depend on.

## Battle returns messages, does not render

`Battle.takeTurn()` mutates battle state and returns a `string[]` of narration. It never touches the canvas or the DOM. The `Game` battle UI owns display and input. Keep this separation: combat logic stays testable in Node (see `tools/simulate.ts` and `tests/unit/battle.test.ts`), and rendering stays in `Game`.

## Menus are data-driven closures

Interactive menus use a single `MenuState` shape in `game.ts`:

```ts
interface MenuState {
  title: string;
  items: string[];
  index: number;
  onSelect: (i: number) => void;
  onCancel: (() => void) | null;
  info?: string[];
}
```

`openMenu(state, push?)` shows a menu and optionally pushes the current one onto `menuStack` so `closeMenu()` can return to it. Nested flows (shop, bag, daycare, trade, storage, forget-a-move) are built by chaining `openMenu` calls with `push = true`. `closeAllMenus()` returns straight to the overworld. Dialogue similarly takes a lines array and an optional `done` callback via `showDialogue`.

## Rendering is immediate mode

Every frame repaints from scratch. Drawing helpers are small free functions at the bottom of `game.ts`: `text`, `panel`, `hpBar`, `wrap`, `paginate`, plus `drawSprite` from `sprites.ts`. Tiles are drawn procedurally by character in `drawTile`. There is no retained UI state to keep in sync; if you can compute it, draw it.

## Coordinates and tiles

The world is a grid. `TILE = 32` pixels. Map tiles are arrays of equal-length strings; `tileAt(x, y)` reads a character, returning `'T'` (tree, solid) for out-of-bounds. Movement animates a pixel offset (`moveOffX/Y`) toward zero, and `onStepComplete()` fires warp, item, encounter, and trainer checks when a step lands. See [Overworld](../systems/overworld.md).

## Story state lives in flags and sets

Progress is tracked with `game.flags` (a `Record<string, boolean>`), plus `Set`s for `defeatedTrainers`, `collectedItems`, `seenSpecies`, and `caughtSpecies`. NPC visibility keys off flags via `hiddenUntilFlag` / `hiddenAfterFlag`. Save/load serializes these (sets become arrays). When adding a story beat, prefer a new flag over ad-hoc state.

## Comments are sparse and intentional

The code is largely self-documenting through naming. Comments appear only where behavior is subtle (for example, "crit ignores attacker's negative stages" or "PP is consumed when the charge begins, not on the release turn"). Follow this: add a comment for a non-obvious invariant, not for what the code plainly says.

## Naming

- Files: lowercase, one concern each (`daynight.ts`, `breeding.ts`).
- Species/move/item/ability keys: lowercase, no spaces (`cindercub`, `razorleaf`, `superpotion`).
- Types and interfaces: PascalCase (`Mockemon`, `MoveDef`, `BattleKind`).
- Display names live in the data (`name` fields); keys are for lookup only.
