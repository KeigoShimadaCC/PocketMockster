import { describe, expect, it } from 'vitest';

import { ABILITIES } from '../../src/data/abilities';
import { MOVES } from '../../src/data/moves';
import { DEX_ORDER, SPECIES } from '../../src/data/species';
import { MON_SPRITES } from '../../src/sprites';

const speciesList = Object.values(SPECIES);

describe('roster', () => {
  it('has unique ids contiguous from 1', () => {
    const ids = speciesList.map((s) => s.id).sort((a, b) => a - b);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 0; i < ids.length; i++) {
      expect(ids[i], `species id at index ${i}`).toBe(i + 1);
    }
    expect(DEX_ORDER.length).toBe(ids.length);
  });

  it('has a 16x16 sprite for every species', () => {
    for (const species of speciesList) {
      const sprite = MON_SPRITES[species.key];
      expect(sprite, `${species.key} sprite`).toBeDefined();
      expect(sprite.rows.length, `${species.key} sprite rows`).toBe(16);
      for (const [index, row] of sprite.rows.entries()) {
        expect(row.length, `${species.key} sprite row ${index}`).toBe(16);
      }
    }
  });

  it('only uses palette keys declared by the sprite', () => {
    for (const species of speciesList) {
      const sprite = MON_SPRITES[species.key];
      for (const [index, row] of sprite.rows.entries()) {
        for (const ch of row) {
          if (ch === '.') continue;
          expect(sprite.pal[ch], `${species.key} row ${index} palette key ${ch}`).toBeDefined();
        }
      }
    }
  });

  it('references existing moves in learnsets and egg moves', () => {
    for (const species of speciesList) {
      for (const entry of species.learnset) {
        expect(MOVES[entry.move], `${species.key} learnset move ${entry.move}`).toBeDefined();
        expect(entry.lv, `${species.key} learnset level for ${entry.move}`).toBeGreaterThanOrEqual(1);
        expect(entry.lv, `${species.key} learnset level for ${entry.move}`).toBeLessThanOrEqual(100);
      }
      for (const eggMove of species.eggMoves) {
        expect(MOVES[eggMove], `${species.key} egg move ${eggMove}`).toBeDefined();
      }
    }
  });

  it('references existing abilities', () => {
    for (const species of speciesList) {
      expect(species.abilities.length, `${species.key} abilities`).toBeGreaterThanOrEqual(1);
      for (const abilityId of species.abilities) {
        expect(ABILITIES[abilityId], `${species.key} ability ${abilityId}`).toBeDefined();
      }
    }
  });

  it('evolves into species that exist, above the pre-evolution learnset', () => {
    for (const species of speciesList) {
      const evo = species.evolution;
      if (!evo) continue;
      expect(SPECIES[evo.to], `${species.key} evolution target ${evo.to}`).toBeDefined();
      if (evo.method !== 'level') continue;
      const topLevel = Math.max(...species.learnset.map((entry) => entry.lv));
      expect(evo.level, `${species.key} evolution level`).toBeGreaterThan(topLevel);
    }
  });
});
