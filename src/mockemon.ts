import { MOVES } from './data/moves';
import type { StatusId } from './data/moves';
import { SPECIES, type SpeciesDef } from './data/species';
import { randInt } from './rng';

export interface MoveSlot {
  id: string;
  pp: number;
}

export interface Mockemon {
  species: string;
  nickname: string;
  level: number;
  exp: number;
  ivs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
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
}

export function def(m: Mockemon): SpeciesDef {
  return SPECIES[m.species];
}

export function expForLevel(level: number): number {
  return level * level * level;
}

function calcStat(base: number, iv: number, level: number, isHp: boolean): number {
  if (isHp) return Math.floor(((2 * base + iv) * level) / 100) + level + 10;
  return Math.floor(((2 * base + iv) * level) / 100) + 5;
}

export function recalcStats(m: Mockemon): void {
  const s = def(m);
  const hpRatio = m.maxHp > 0 ? m.hp / m.maxHp : 1;
  m.maxHp = calcStat(s.base.hp, m.ivs.hp, m.level, true);
  m.atk = calcStat(s.base.atk, m.ivs.atk, m.level, false);
  m.def = calcStat(s.base.def, m.ivs.def, m.level, false);
  m.spa = calcStat(s.base.spa, m.ivs.spa, m.level, false);
  m.spd = calcStat(s.base.spd, m.ivs.spd, m.level, false);
  m.spe = calcStat(s.base.spe, m.ivs.spe, m.level, false);
  m.hp = Math.max(1, Math.round(m.maxHp * hpRatio));
}

export function movesAtLevel(speciesKey: string, level: number): string[] {
  const s = SPECIES[speciesKey];
  const known: string[] = [];
  for (const entry of s.learnset) {
    if (entry.lv <= level && !known.includes(entry.move)) known.push(entry.move);
  }
  return known.slice(-4);
}

export function createMockemon(speciesKey: string, level: number): Mockemon {
  const m: Mockemon = {
    species: speciesKey,
    nickname: SPECIES[speciesKey].name,
    level,
    exp: expForLevel(level),
    ivs: {
      hp: randInt(0, 15),
      atk: randInt(0, 15),
      def: randInt(0, 15),
      spa: randInt(0, 15),
      spd: randInt(0, 15),
      spe: randInt(0, 15),
    },
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
  };
  recalcStats(m);
  m.hp = m.maxHp;
  return m;
}

export interface LevelUpResult {
  leveled: boolean;
  newLevel: number;
  learned: string[];
  evolvedTo: string | null;
}

export function gainExp(m: Mockemon, amount: number): LevelUpResult {
  const result: LevelUpResult = { leveled: false, newLevel: m.level, learned: [], evolvedTo: null };
  m.exp += amount;
  while (m.level < 100 && m.exp >= expForLevel(m.level + 1)) {
    m.level++;
    result.leveled = true;
    result.newLevel = m.level;
    const s = def(m);
    for (const entry of s.learnset) {
      if (entry.lv === m.level && !m.moves.some((ms) => ms.id === entry.move)) {
        if (m.moves.length >= 4) m.moves.shift();
        m.moves.push({ id: entry.move, pp: MOVES[entry.move].pp });
        result.learned.push(MOVES[entry.move].name);
      }
    }
    if (s.evolvesTo && s.evolveLevel && m.level >= s.evolveLevel) {
      result.evolvedTo = s.evolvesTo;
    }
  }
  recalcStats(m);
  return result;
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
  for (const ms of m.moves) ms.pp = MOVES[ms.id].pp;
}
