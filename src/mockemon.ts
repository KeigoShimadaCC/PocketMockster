import { MOVES } from './data/moves';
import type { StatusId } from './data/moves';
import { SPECIES, type GrowthRate, type SpeciesDef } from './data/species';
import { rand, randInt } from './rng';

export interface MoveSlot {
  id: string;
  pp: number;
}

export interface StatBlock {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface NatureDef {
  name: string;
  up: keyof StatBlock | null;
  down: keyof StatBlock | null;
}

const NATURE_LIST: NatureDef[] = [
  { name: 'Hardy', up: null, down: null },
  { name: 'Lonely', up: 'atk', down: 'def' },
  { name: 'Brave', up: 'atk', down: 'spe' },
  { name: 'Adamant', up: 'atk', down: 'spa' },
  { name: 'Naughty', up: 'atk', down: 'spd' },
  { name: 'Bold', up: 'def', down: 'atk' },
  { name: 'Docile', up: null, down: null },
  { name: 'Relaxed', up: 'def', down: 'spe' },
  { name: 'Impish', up: 'def', down: 'spa' },
  { name: 'Lax', up: 'def', down: 'spd' },
  { name: 'Timid', up: 'spe', down: 'atk' },
  { name: 'Hasty', up: 'spe', down: 'def' },
  { name: 'Serious', up: null, down: null },
  { name: 'Jolly', up: 'spe', down: 'spa' },
  { name: 'Naive', up: 'spe', down: 'spd' },
  { name: 'Modest', up: 'spa', down: 'atk' },
  { name: 'Mild', up: 'spa', down: 'def' },
  { name: 'Quiet', up: 'spa', down: 'spe' },
  { name: 'Bashful', up: null, down: null },
  { name: 'Rash', up: 'spa', down: 'spd' },
  { name: 'Calm', up: 'spd', down: 'atk' },
  { name: 'Gentle', up: 'spd', down: 'def' },
  { name: 'Sassy', up: 'spd', down: 'spe' },
  { name: 'Careful', up: 'spd', down: 'spa' },
  { name: 'Quirky', up: null, down: null },
];

export const NATURES: Record<string, NatureDef> = Object.fromEntries(
  NATURE_LIST.map((n) => [n.name.toLowerCase(), n]),
);
export const NATURE_KEYS = NATURE_LIST.map((n) => n.name.toLowerCase());

export interface Mockemon {
  species: string;
  nickname: string;
  level: number;
  exp: number;
  pv: number; // personality value (drives shininess)
  shiny: boolean;
  nature: string;
  ivs: StatBlock;
  evs: StatBlock;
  gender: 'M' | 'F' | null;
  ability: string;
  heldItem: string | null;
  friendship: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
  moves: MoveSlot[];
  status: StatusId | null;
  sleepTurns: number;
  toxicCounter: number;
  pendingMoves: string[]; // moves awaiting the forget-a-move prompt
  isEgg?: boolean;
  hatchSteps?: number;
}

export function def(m: Mockemon): SpeciesDef {
  return SPECIES[m.species];
}

export function expForLevel(rate: GrowthRate, level: number): number {
  const n = Math.max(1, level);
  switch (rate) {
    case 'fast':
      return Math.floor((4 * n ** 3) / 5);
    case 'mediumfast':
      return n ** 3;
    case 'mediumslow':
      return Math.max(0, Math.floor((6 / 5) * n ** 3 - 15 * n ** 2 + 100 * n - 140));
    case 'slow':
      return Math.floor((5 * n ** 3) / 4);
    case 'erratic':
      if (n <= 50) return Math.floor((n ** 3 * (100 - n)) / 50);
      if (n <= 68) return Math.floor((n ** 3 * (150 - n)) / 100);
      if (n <= 98) return Math.floor((n ** 3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((n ** 3 * (160 - n)) / 100);
    case 'fluctuating':
      if (n < 15) return Math.floor((n ** 3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      if (n < 36) return Math.floor((n ** 3 * (n + 14)) / 50);
      return Math.floor((n ** 3 * (Math.floor(n / 2) + 32)) / 50);
  }
}

export function growthOf(m: Mockemon): GrowthRate {
  return def(m).growth;
}

export function levelExp(m: Mockemon): number {
  return expForLevel(growthOf(m), m.level);
}

function calcStat(base: number, iv: number, ev: number, level: number, isHp: boolean, nature: NatureDef, stat: keyof StatBlock): number {
  const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
  if (isHp) return core + level + 10;
  let mult = 1;
  if (nature.up === stat) mult = 1.1;
  if (nature.down === stat) mult = 0.9;
  return Math.floor((core + 5) * mult);
}

export function recalcStats(m: Mockemon): void {
  const s = def(m);
  const nat = NATURES[m.nature] ?? NATURES.hardy;
  const hpRatio = m.maxHp > 0 ? m.hp / m.maxHp : 1;
  m.maxHp = calcStat(s.base.hp, m.ivs.hp, m.evs.hp, m.level, true, nat, 'hp');
  m.atk = calcStat(s.base.atk, m.ivs.atk, m.evs.atk, m.level, false, nat, 'atk');
  m.def = calcStat(s.base.def, m.ivs.def, m.evs.def, m.level, false, nat, 'def');
  m.spa = calcStat(s.base.spa, m.ivs.spa, m.evs.spa, m.level, false, nat, 'spa');
  m.spd = calcStat(s.base.spd, m.ivs.spd, m.evs.spd, m.level, false, nat, 'spd');
  m.spe = calcStat(s.base.spe, m.ivs.spe, m.evs.spe, m.level, false, nat, 'spe');
  m.hp = Math.max(0, Math.round(m.maxHp * hpRatio));
}

export function movesAtLevel(speciesKey: string, level: number): string[] {
  const s = SPECIES[speciesKey];
  const known: string[] = [];
  for (const entry of s.learnset) {
    if (entry.lv <= level && !known.includes(entry.move)) known.push(entry.move);
  }
  return known.slice(-4);
}

export function isShiny(pv: number): boolean {
  return ((pv >>> 16) ^ (pv & 0xffff)) < 16; // 1/4096
}

export function createMockemon(speciesKey: string, level: number): Mockemon {
  const s = SPECIES[speciesKey];
  const pv = Math.floor(rand() * 0xffffffff);
  const m: Mockemon = {
    species: speciesKey,
    nickname: s.name,
    level,
    exp: expForLevel(s.growth, level),
    pv,
    shiny: isShiny(pv),
    nature: NATURE_KEYS[randInt(0, NATURE_KEYS.length - 1)],
    ivs: { hp: randInt(0, 31), atk: randInt(0, 31), def: randInt(0, 31), spa: randInt(0, 31), spd: randInt(0, 31), spe: randInt(0, 31) },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    gender: s.genderRatio === null ? null : rand() < s.genderRatio ? 'F' : 'M',
    ability: s.abilities[randInt(0, s.abilities.length - 1)],
    heldItem: null,
    friendship: s.baseFriendship ?? 70,
    hp: 0,
    maxHp: 0,
    atk: 0,
    def: 0,
    spa: 0,
    spd: 0,
    spe: 0,
    moves: movesAtLevel(speciesKey, level).map((id) => ({ id, pp: MOVES[id].pp })),
    status: null,
    sleepTurns: 0,
    toxicCounter: 0,
    pendingMoves: [],
  };
  recalcStats(m);
  m.hp = m.maxHp;
  return m;
}

const EV_STAT_CAP = 252;
const EV_TOTAL_CAP = 510;

export function addEVs(m: Mockemon, yieldStats: Partial<StatBlock>): void {
  const total = Object.values(m.evs).reduce((a, b) => a + b, 0);
  let room = EV_TOTAL_CAP - total;
  for (const [stat, amount] of Object.entries(yieldStats) as [keyof StatBlock, number][]) {
    if (room <= 0) break;
    const gain = Math.min(amount, room, EV_STAT_CAP - m.evs[stat]);
    if (gain <= 0) continue;
    m.evs[stat] += gain;
    room -= gain;
  }
  recalcStats(m);
}

export interface LevelUpResult {
  leveled: boolean;
  newLevel: number;
  learned: string[]; // auto-learned (had free slot)
  queued: string[]; // queued for forget prompt
}

export function gainExp(m: Mockemon, amount: number): LevelUpResult {
  const result: LevelUpResult = { leveled: false, newLevel: m.level, learned: [], queued: [] };
  m.exp += amount;
  while (m.level < 100 && m.exp >= expForLevel(growthOf(m), m.level + 1)) {
    m.level++;
    result.leveled = true;
    result.newLevel = m.level;
    m.friendship = Math.min(255, m.friendship + 3);
    const s = def(m);
    for (const entry of s.learnset) {
      if (entry.lv === m.level && !m.moves.some((ms) => ms.id === entry.move)) {
        if (m.moves.length >= 4) {
          m.pendingMoves.push(entry.move);
          result.queued.push(MOVES[entry.move].name);
        } else {
          m.moves.push({ id: entry.move, pp: MOVES[entry.move].pp });
          result.learned.push(MOVES[entry.move].name);
        }
      }
    }
  }
  recalcStats(m);
  return result;
}

export function learnMove(m: Mockemon, moveId: string, forgetIndex: number | null): boolean {
  if (m.moves.some((ms) => ms.id === moveId)) return false;
  if (m.moves.length < 4) {
    m.moves.push({ id: moveId, pp: MOVES[moveId].pp });
    return true;
  }
  if (forgetIndex === null || forgetIndex < 0 || forgetIndex >= m.moves.length) return false;
  m.moves.splice(forgetIndex, 1, { id: moveId, pp: MOVES[moveId].pp });
  return true;
}

export function evolve(m: Mockemon, toSpecies: string): void {
  const wasNickname = m.nickname === def(m).name;
  m.species = toSpecies;
  if (wasNickname) m.nickname = SPECIES[toSpecies].name;
  recalcStats(m);
}

export function healFull(m: Mockemon): void {
  m.hp = m.maxHp;
  m.status = null;
  m.sleepTurns = 0;
  m.toxicCounter = 0;
  for (const ms of m.moves) ms.pp = MOVES[ms.id].pp;
}

export function changeFriendship(m: Mockemon, delta: number): void {
  m.friendship = Math.max(0, Math.min(255, m.friendship + delta));
}

export function displayName(m: Mockemon): string {
  return m.shiny ? `${m.nickname} ★` : m.nickname;
}
