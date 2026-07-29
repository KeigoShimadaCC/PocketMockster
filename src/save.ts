import { MOVES } from './data/moves';
import type { StatusId } from './data/moves';
import { SPECIES } from './data/species';
import { ITEMS } from './data/items';
import { MAPS } from './maps';
import {
  expForLevel,
  movesAtLevel,
  NATURES,
  recalcStats,
  type Mockemon,
  type MoveSlot,
  type StatBlock,
} from './mockemon';
import { QuestLog, type QuestProgress } from './quests';
import { QUESTS } from './content/quests';

export const SAVE_VERSION = 2;

export interface SaveData {
  version?: number;
  savedAt?: number;
  playFrames?: number;
  quests?: QuestProgress;
  mapId: string;
  px: number;
  py: number;
  party: Mockemon[];
  storage?: Mockemon[];
  inventory?: Record<string, number>;
  money?: number;
  badges?: string[];
  flags?: Record<string, boolean>;
  defeatedTrainers?: string[];
  collectedItems?: string[];
  healPoint?: { map: string; x: number; y: number };
  seen?: string[];
  caught?: string[];
  minute?: number;
  daycare?: (Mockemon | null)[];
  daycareSteps?: number;
  daycareEgg?: Mockemon | null;
}

// v1 saves predate the quest log: rebuild it from the flags/badges they did store.
export function migrateQuests(flags: Record<string, boolean>, badges: string[]): QuestProgress {
  const log = new QuestLog(QUESTS);
  if (flags.starterChosen) {
    log.start('main_journey');
    log.advance('main_journey', 'parcel');
  }
  if (badges.length > 0) log.advance('main_journey', `badge${Math.min(badges.length + 1, 8)}`);
  if (flags.gotBalls) log.complete('parcel');
  if (flags.hikerTraded) log.complete('hiker_trade');
  return log.toJSON();
}

/** Each entry upgrades a save from version N to N+1. Applied sequentially. */
const MIGRATIONS: Record<number, (d: SaveData) => SaveData> = {
  1: (d) => ({
    ...d,
    quests: d.quests ?? migrateQuests(d.flags ?? {}, d.badges ?? []),
  }),
};

const VALID_STATUS = new Set<StatusId>(['PAR', 'BRN', 'PSN', 'TOX', 'SLP', 'FRZ']);
const KNOWN_ITEM_IDS = new Set(Object.keys(ITEMS));

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function int(v: unknown, fallback: number, min: number, max: number): number {
  const n = Math.floor(num(v, fallback));
  return Math.max(min, Math.min(max, n));
}

function sanitizeStatBlock(v: unknown, fallback: number, min: number, max: number): StatBlock {
  const src = (v && typeof v === 'object' ? v : {}) as Partial<StatBlock>;
  return {
    hp: int(src.hp, fallback, min, max),
    atk: int(src.atk, fallback, min, max),
    def: int(src.def, fallback, min, max),
    spa: int(src.spa, fallback, min, max),
    spd: int(src.spd, fallback, min, max),
    spe: int(src.spe, fallback, min, max),
  };
}

function sanitizeMoves(v: unknown, species: string, level: number): MoveSlot[] {
  const out: MoveSlot[] = [];
  if (Array.isArray(v)) {
    for (const slot of v as Partial<MoveSlot>[]) {
      if (!slot || typeof slot !== 'object') continue;
      if (typeof slot.id !== 'string' || !MOVES[slot.id]) continue;
      if (out.some((ms) => ms.id === slot.id)) continue;
      out.push({ id: slot.id, pp: int(slot.pp, MOVES[slot.id].pp, 0, MOVES[slot.id].pp) });
      if (out.length >= 4) break;
    }
  }
  if (out.length === 0) {
    return movesAtLevel(species, level).map((id) => ({ id, pp: MOVES[id].pp }));
  }
  return out;
}

/** Returns a fully-populated, internally consistent Mockemon, or null if unrepairable. */
export function sanitizeMon(v: unknown): Mockemon | null {
  if (!v || typeof v !== 'object') return null;
  const raw = v as Partial<Mockemon>;
  if (typeof raw.species !== 'string' || !SPECIES[raw.species]) return null;
  const species = raw.species;
  const spec = SPECIES[species];
  const level = int(raw.level, 5, 1, 100);
  const m: Mockemon = {
    species,
    nickname: typeof raw.nickname === 'string' && raw.nickname.length > 0 ? raw.nickname : spec.name,
    level,
    exp: Math.max(expForLevel(spec.growth, level), Math.floor(num(raw.exp, 0))),
    pv: int(raw.pv, 0, 0, 0xffffffff),
    shiny: raw.shiny === true,
    nature: typeof raw.nature === 'string' && NATURES[raw.nature] ? raw.nature : 'hardy',
    ivs: sanitizeStatBlock(raw.ivs, 15, 0, 31),
    evs: sanitizeStatBlock(raw.evs, 0, 0, 252),
    gender: raw.gender === 'M' || raw.gender === 'F' ? raw.gender : null,
    ability:
      typeof raw.ability === 'string' && spec.abilities.includes(raw.ability)
        ? raw.ability
        : spec.abilities[0],
    heldItem: typeof raw.heldItem === 'string' && KNOWN_ITEM_IDS.has(raw.heldItem) ? raw.heldItem : null,
    friendship: int(raw.friendship, spec.baseFriendship ?? 70, 0, 255),
    hp: Math.max(0, Math.floor(num(raw.hp, 0))),
    maxHp: Math.max(0, Math.floor(num(raw.maxHp, 0))),
    atk: 0,
    def: 0,
    spa: 0,
    spd: 0,
    spe: 0,
    moves: sanitizeMoves(raw.moves, species, level),
    status: typeof raw.status === 'string' && VALID_STATUS.has(raw.status) ? raw.status : null,
    sleepTurns: int(raw.sleepTurns, 0, 0, 7),
    toxicCounter: int(raw.toxicCounter, 0, 0, 15),
    pendingMoves: Array.isArray(raw.pendingMoves)
      ? raw.pendingMoves.filter((id): id is string => typeof id === 'string' && !!MOVES[id])
      : [],
  };
  if (raw.isEgg === true) {
    m.isEgg = true;
    m.hatchSteps = int(raw.hatchSteps, 2560, 0, 99999);
  }
  // recalcStats preserves the hp/maxHp ratio; a garbage maxHp yields ratio 1 (full).
  recalcStats(m);
  m.hp = int(m.hp, m.maxHp, 0, m.maxHp);
  return m;
}

function sanitizeStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
}

function sanitizeFlags(v: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = !!val;
  }
  return out;
}

function sanitizeInventory(v: unknown): Record<string, number> {
  const out: Record<string, number> = { potion: 0, superpotion: 0, mockball: 0 };
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (!KNOWN_ITEM_IDS.has(k)) continue;
      out[k] = int(val, 0, 0, 9999);
    }
  }
  return out;
}

export function sanitizeSave(d: SaveData): SaveData | null {
  if (!d || typeof d !== 'object') return null;
  if (typeof d.mapId !== 'string' || !MAPS[d.mapId]) return null;
  if (!Array.isArray(d.party)) return null;

  const map = MAPS[d.mapId];
  const flags = sanitizeFlags(d.flags);
  const party = d.party.map(sanitizeMon).filter((m): m is Mockemon => m !== null).slice(0, 6);
  // a pre-starter save legitimately has no party; after that it is unrepairable
  if (flags.starterChosen && party.length === 0) return null;

  const daycareRaw = Array.isArray(d.daycare) ? d.daycare : [null, null];
  const daycare: (Mockemon | null)[] = [
    daycareRaw[0] ? sanitizeMon(daycareRaw[0]) : null,
    daycareRaw[1] ? sanitizeMon(daycareRaw[1]) : null,
  ];
  const healPoint =
    d.healPoint && typeof d.healPoint === 'object' && typeof d.healPoint.map === 'string' && MAPS[d.healPoint.map]
      ? { map: d.healPoint.map, x: int(d.healPoint.x, 0, 0, 999), y: int(d.healPoint.y, 0, 0, 999) }
      : { map: 'mapletown', x: 7, y: 9 };

  return {
    version: SAVE_VERSION,
    savedAt: num(d.savedAt, Date.now()),
    playFrames: Math.max(0, Math.floor(num(d.playFrames, 0))),
    quests: d.quests && typeof d.quests === 'object' ? d.quests : undefined,
    mapId: d.mapId,
    px: int(d.px, 5, 0, map.tiles[0].length - 1),
    py: int(d.py, 6, 0, map.tiles.length - 1),
    party,
    storage: Array.isArray(d.storage)
      ? d.storage.map(sanitizeMon).filter((m): m is Mockemon => m !== null)
      : [],
    inventory: sanitizeInventory(d.inventory),
    money: int(d.money, 3000, 0, 9_999_999),
    badges: sanitizeStringArray(d.badges),
    flags,
    defeatedTrainers: sanitizeStringArray(d.defeatedTrainers),
    collectedItems: sanitizeStringArray(d.collectedItems),
    healPoint,
    seen: sanitizeStringArray(d.seen).filter((s) => SPECIES[s]),
    caught: sanitizeStringArray(d.caught).filter((s) => SPECIES[s]),
    minute: int(d.minute, 600, 0, 1439),
    daycare,
    daycareSteps: int(d.daycareSteps, 0, 0, 99999),
    daycareEgg: d.daycareEgg ? sanitizeMon(d.daycareEgg) : null,
  };
}

/** Parse, version-migrate, and sanitize a raw save string. Null when unusable. */
export function decodeSave(raw: string): SaveData | null {
  let d: SaveData;
  try {
    d = JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
  if (!d || typeof d !== 'object') return null;
  let version = typeof d.version === 'number' && Number.isFinite(d.version) ? d.version : 1;
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (step) d = step(d);
    version++;
  }
  return sanitizeSave(d);
}

export function encodeSave(d: SaveData): string {
  return JSON.stringify(d);
}
