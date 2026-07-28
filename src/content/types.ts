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
}

export const SOLID_TILES = new Set(['T', 'W', 'B', 'R', 'D', 'w', 'C', 'S', 'o', 'P']);

/** Shallow water: crossable only once the Tide Badge is in hand. */
export const SHALLOW_TILE = '~';
export const BADGE_FLAG_SHALLOW = 'badge_tide';
