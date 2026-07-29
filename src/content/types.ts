export type Dir4 = 'up' | 'down' | 'left' | 'right';

export interface Warp {
  x: number;
  y: number;
  to: string;
  tx: number;
  ty: number;
}

/** Solid until its flag is set; buttons and badges are what set those flags. */
export interface Gate {
  x: number;
  y: number;
  flag: string;
  text?: string;
}

/** Pressing A toggles (or sets) the flag, which opens the gates that watch it. */
export interface Button {
  x: number;
  y: number;
  flag: string;
  toggle?: boolean;
  text?: string;
}

/** Can only be entered while moving in `dir` (gym 2 silk threads). */
export interface OneWay {
  x: number;
  y: number;
  dir: Dir4;
}

/** In-map teleport pad pair (gym 8). */
export interface Pad {
  x: number;
  y: number;
  tx: number;
  ty: number;
}

export interface NpcTrainer {
  id: string;
  name: string;
  spriteKey: string;
  party: { species: string; level: number }[];
  prize: number;
  introText: string;
  defeatText: string;
  sight: number; // tiles of line-of-sight, 0 = talk only
  ai?: 'basic' | 'smart' | 'leader';
  potions?: number; // super potions usable in battle
}

export interface Npc {
  id: string;
  x: number;
  y: number;
  spriteKey: string;
  facing: 'up' | 'down' | 'left' | 'right';
  dialogue: string[];
  action?: 'heal' | 'shop' | 'giveballs' | 'starter' | 'gymleader' | 'daycare' | 'trade';
  script?: string; // key into SCRIPTS; takes precedence over action and dialogue
  trainer?: NpcTrainer;
  hiddenUntilFlag?: string;
  hiddenAfterFlag?: string;
}

export interface MapEvent {
  x: number;
  y: number;
  script: string;
  once?: string; // flag set after the event fires, so it never repeats
}

export interface GroundItem {
  id: string;
  x: number;
  y: number;
  item: string;
  count: number;
}

export interface EncounterEntry {
  species: string;
  minLv: number;
  maxLv: number;
  weight: number;
  nightWeight?: number; // overrides weight during night phase
}

export interface GameMap {
  id: string;
  name: string;
  tiles: string[];
  warps: Warp[];
  npcs: Npc[];
  items: GroundItem[];
  encounters: EncounterEntry[];
  encounterRate: number;
  signs: { x: number; y: number; text: string }[];
  lockedDoors: { x: number; y: number; text: string }[];
  indoor: boolean;
  events?: MapEvent[];
  onEnter?: MapEvent; // x/y ignored; runs when the player warps in
  gates?: Gate[];
  buttons?: Button[];
  oneWay?: OneWay[];
  pads?: Pad[];
  windDir?: Dir4; // direction '#' tiles push the player
  lavaPeriod?: number; // frames per on/off cycle for 'x' tiles
  legend?: Record<string, string>; // remap custom tile chars to canonical ones
}

// ---------- tile registry ----------

export interface TileDef {
  solid: boolean;
  encounterGrass?: boolean;
  shallow?: boolean;
  wind?: boolean;
  lava?: boolean;
  counter?: boolean;
  table?: boolean;
}

export const TILE_DEFS: Record<string, TileDef> = {
  '.': { solid: false },
  ',': { solid: false },
  'G': { solid: false, encounterGrass: true },
  'T': { solid: true },
  'W': { solid: true },
  'R': { solid: true },
  'B': { solid: true },
  'D': { solid: true },
  'S': { solid: true },
  'w': { solid: true },
  'F': { solid: false },
  'C': { solid: true, counter: true },
  'M': { solid: false },
  'P': { solid: true, table: true },
  'o': { solid: true },
  '~': { solid: false, shallow: true },
  'x': { solid: false, lava: true },
  '#': { solid: false, wind: true },
  '_': { solid: false },
};

export const SOLID_TILES = new Set(
  Object.entries(TILE_DEFS).filter(([, d]) => d.solid).map(([ch]) => ch),
);

/** Shallow water: crossable only once the Tide Badge is in hand. */
export const SHALLOW_TILE = '~';
export const BADGE_FLAG_SHALLOW = 'badge_tide';

/** Resolve a tile character through a map's optional legend remapping. */
export function resolveTile(map: GameMap, ch: string): string {
  return map.legend?.[ch] ?? ch;
}

export function tileDef(map: GameMap, ch: string): TileDef | undefined {
  return TILE_DEFS[resolveTile(map, ch)];
}
