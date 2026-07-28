import { MOVES } from './data/moves';
import { SPECIES } from './data/species';
import { createMockemon, type Mockemon, NATURE_KEYS, movesAtLevel, recalcStats } from './mockemon';
import { chance, pick, randInt } from './rng';

const STATS: Array<keyof Mockemon['ivs']> = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

function hasMimicGroup(m: Mockemon): boolean {
  return SPECIES[m.species].eggGroups.includes('Mimic');
}

function hasSharedEggGroup(a: Mockemon, b: Mockemon): boolean {
  const ag = SPECIES[a.species].eggGroups;
  const bg = SPECIES[b.species].eggGroups;
  return ag.some((g) => bg.includes(g));
}

function canUseOppositeGenderRule(m: Mockemon): boolean {
  return m.gender !== null || hasMimicGroup(m);
}

export function breedError(a: Mockemon, b: Mockemon): string | null {
  if (a.isEgg || b.isEgg) return 'Eggs cannot breed.';
  if (a.gender === null && !hasMimicGroup(a)) return 'Genderless non-Mimic cannot breed.';
  if (b.gender === null && !hasMimicGroup(b)) return 'Genderless non-Mimic cannot breed.';

  if (canUseOppositeGenderRule(a) && canUseOppositeGenderRule(b)) {
    if (a.gender !== null && b.gender !== null && a.gender === b.gender) {
      return 'Parents must be opposite genders.';
    }
  } else {
    return 'Parents must be opposite genders.';
  }

  if (!hasMimicGroup(a) && !hasMimicGroup(b) && !hasSharedEggGroup(a, b)) {
    return 'Parents have no compatible egg groups.';
  }

  return null;
}

export function canBreed(a: Mockemon, b: Mockemon): boolean {
  return breedError(a, b) === null;
}

function speciesParentFor(a: Mockemon, b: Mockemon): Mockemon {
  const aMimic = hasMimicGroup(a);
  const bMimic = hasMimicGroup(b);
  if (aMimic !== bMimic) return aMimic ? b : a;
  if (a.gender === 'F') return a;
  if (b.gender === 'F') return b;
  return a;
}

export function makeEgg(a: Mockemon, b: Mockemon): Mockemon {
  const speciesParent = speciesParentFor(a, b);
  const eggSpecies = speciesParent.species;
  const eggSpeciesDef = SPECIES[eggSpecies];

  const egg = createMockemon(eggSpecies, 1);

  const inherited: Array<keyof Mockemon['ivs']> = [];
  const pool = [...STATS];
  while (inherited.length < 3) {
    const i = randInt(0, pool.length - 1);
    inherited.push(pool[i]);
    pool.splice(i, 1);
  }

  for (const stat of STATS) {
    if (inherited.includes(stat)) {
      const parent = chance(0.5) ? a : b;
      egg.ivs[stat] = parent.ivs[stat];
    } else {
      egg.ivs[stat] = randInt(0, 31);
    }
    egg.evs[stat] = 0;
  }

  egg.nature = chance(0.5) ? speciesParent.nature : pick(NATURE_KEYS);
  egg.ability = chance(0.8) ? eggSpeciesDef.abilities[0] : pick(eggSpeciesDef.abilities);

  // egg moves take priority over level-1 moves when the combined list exceeds 4
  const moveIds: string[] = [];
  for (const id of eggSpeciesDef.eggMoves) {
    if (!moveIds.includes(id)) moveIds.push(id);
  }
  for (const id of movesAtLevel(eggSpecies, 1)) {
    if (!moveIds.includes(id)) moveIds.push(id);
  }

  egg.moves = moveIds.slice(0, 4).map((id) => ({ id, pp: MOVES[id].pp }));
  egg.level = 1;
  egg.exp = 0;
  egg.nickname = 'Egg';
  egg.isEgg = true;
  egg.hatchSteps = 512;
  egg.friendship = 120;
  egg.heldItem = null;
  egg.status = null;
  egg.sleepTurns = 0;
  egg.toxicCounter = 0;
  egg.pendingMoves = [];

  recalcStats(egg);
  egg.hp = egg.maxHp;

  return egg;
}

export function tickEgg(m: Mockemon, steps: number): boolean {
  if (!m.isEgg) return false;
  const next = Math.max(0, (m.hatchSteps ?? 0) - Math.max(0, steps));
  m.hatchSteps = next;
  if (next > 0) return false;

  m.isEgg = false;
  m.nickname = SPECIES[m.species].name;
  m.hatchSteps = 0;
  recalcStats(m);
  m.hp = m.maxHp;
  return true;
}
