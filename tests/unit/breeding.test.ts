import { beforeEach, describe, expect, it } from 'vitest';
import { canBreed, breedError, makeEgg, tickEgg } from '../../src/breeding';
import { createMockemon } from '../../src/mockemon';
import { setSeed } from '../../src/rng';

beforeEach(() => {
  setSeed(1234);
});

describe('breeding compatibility', () => {
  it('breeds with shared egg group and opposite genders', () => {
    const a = createMockemon('nibbit', 10);
    const b = createMockemon('cindercub', 10);
    a.gender = 'F';
    b.gender = 'M';
    expect(canBreed(a, b)).toBe(true);
    expect(breedError(a, b)).toBeNull();
  });

  it('fails for same gender', () => {
    const a = createMockemon('nibbit', 10);
    const b = createMockemon('cindercub', 10);
    a.gender = 'M';
    b.gender = 'M';
    expect(canBreed(a, b)).toBe(false);
    expect(breedError(a, b)).toBeTruthy();
  });

  it('fails for genderless non-Mimic', () => {
    const a = createMockemon('gustling', 10);
    const b = createMockemon('fluffowl', 10);
    b.gender = 'M';
    expect(a.gender).toBeNull();
    expect(canBreed(a, b)).toBe(false);
    expect(breedError(a, b)).toContain('Genderless non-Mimic');
  });

  it('allows mimew with male, female, and another mimew', () => {
    const mimew = createMockemon('mimew', 10);

    const male = createMockemon('cindercub', 10);
    male.gender = 'M';
    expect(canBreed(mimew, male)).toBe(true);

    const female = createMockemon('nibbit', 10);
    female.gender = 'F';
    expect(canBreed(mimew, female)).toBe(true);

    const mimew2 = createMockemon('mimew', 10);
    expect(canBreed(mimew, mimew2)).toBe(true);
  });

  it('eggs cannot breed', () => {
    const a = createMockemon('nibbit', 10);
    const b = createMockemon('cindercub', 10);
    a.gender = 'F';
    b.gender = 'M';
    const egg = makeEgg(a, b);
    expect(canBreed(egg, a)).toBe(false);
    expect(breedError(egg, a)).toContain('Eggs cannot breed');
  });
});

describe('makeEgg', () => {
  it("uses mother's species when no single Mimic parent is involved", () => {
    const mother = createMockemon('nibbit', 20);
    const father = createMockemon('cindercub', 20);
    mother.gender = 'F';
    father.gender = 'M';

    const egg = makeEgg(mother, father);
    expect(egg.species).toBe('nibbit');
    expect(egg.level).toBe(1);
    expect(egg.isEgg).toBe(true);
    expect(egg.hatchSteps).toBe(512);
  });

  it('uses non-Mimic parent species when exactly one parent is Mimic', () => {
    const mimew = createMockemon('mimew', 20);
    const other = createMockemon('cindercub', 20);
    other.gender = 'M';

    const egg = makeEgg(mimew, other);
    expect(egg.species).toBe('cindercub');
  });

  it('inherits exactly three IV stats from one of the parents', () => {
    const a = createMockemon('nibbit', 20);
    const b = createMockemon('cindercub', 20);
    a.gender = 'F';
    b.gender = 'M';

    a.ivs = { hp: 1, atk: 3, def: 5, spa: 7, spd: 9, spe: 11 };
    b.ivs = { hp: 2, atk: 4, def: 6, spa: 8, spd: 10, spe: 12 };

    const egg = makeEgg(a, b);
    const inheritedCount = (['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const).filter((stat) =>
      egg.ivs[stat] === a.ivs[stat] || egg.ivs[stat] === b.ivs[stat],
    ).length;
    expect(inheritedCount).toBe(3);
  });

  it('includes egg moves when applicable', () => {
    const mother = createMockemon('thistling', 20);
    const father = createMockemon('sproutle', 20);
    mother.gender = 'F';
    father.gender = 'M';
    const egg = makeEgg(mother, father);
    expect(egg.species).toBe('thistling');
    expect(egg.moves.map((m) => m.id)).toContain('spikes');
  });
});

describe('tickEgg', () => {
  it('hatches after enough steps and becomes a normal mon', () => {
    const mother = createMockemon('nibbit', 20);
    const father = createMockemon('cindercub', 20);
    mother.gender = 'F';
    father.gender = 'M';
    const egg = makeEgg(mother, father);

    expect(tickEgg(egg, 100)).toBe(false);
    expect(egg.isEgg).toBe(true);
    expect(egg.hatchSteps).toBe(412);

    expect(tickEgg(egg, 412)).toBe(true);
    expect(egg.isEgg).toBe(false);
    expect(egg.hatchSteps).toBe(0);
    expect(egg.nickname).toBe('Nibbit');
  });
});
