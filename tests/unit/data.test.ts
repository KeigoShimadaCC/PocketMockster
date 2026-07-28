import { beforeEach, describe, expect, it } from 'vitest';

import { ABILITIES } from '../../src/data/abilities';
import { ITEMS, SHOP_STOCK } from '../../src/data/items';
import { MOVES } from '../../src/data/moves';
import { DEX_ORDER, SPECIES } from '../../src/data/species';
import { MAPS } from '../../src/maps';
import { setSeed } from '../../src/rng';

describe('data integrity', () => {
  beforeEach(() => {
    setSeed(1234);
  });

  it('has valid move references in learnsets and egg moves', () => {
    for (const species of Object.values(SPECIES)) {
      for (const entry of species.learnset) {
        expect(MOVES[entry.move], `${species.key} learnset move ${entry.move}`).toBeDefined();
      }
      for (const eggMove of species.eggMoves) {
        expect(MOVES[eggMove], `${species.key} egg move ${eggMove}`).toBeDefined();
      }
    }
  });

  it('has valid ability references for all species', () => {
    for (const species of Object.values(SPECIES)) {
      for (const abilityId of species.abilities) {
        expect(ABILITIES[abilityId], `${species.key} ability ${abilityId}`).toBeDefined();
      }
    }
  });

  it('has valid evolution definitions', () => {
    for (const species of Object.values(SPECIES)) {
      const evo = species.evolution;
      if (!evo) continue;
      expect(SPECIES[evo.to], `${species.key} evolution target ${evo.to}`).toBeDefined();
      if (evo.method === 'stone') {
        expect(evo.stone, `${species.key} stone evolution missing stone`).toBeDefined();
        expect(ITEMS[evo.stone!], `${species.key} stone ${evo.stone}`).toBeDefined();
        expect(ITEMS[evo.stone!].kind, `${species.key} stone kind for ${evo.stone}`).toBe('stone');
      }
      if (evo.method === 'level') {
        expect(evo.level, `${species.key} level evolution missing level`).toBeDefined();
        expect(evo.level!).toBeGreaterThanOrEqual(2);
        expect(evo.level!).toBeLessThanOrEqual(100);
      }
      if (evo.method === 'friendship') {
        expect(evo.min, `${species.key} friendship evolution missing min`).toBeDefined();
        expect(evo.min!).toBeGreaterThanOrEqual(1);
        expect(evo.min!).toBeLessThanOrEqual(255);
      }
    }
  });

  it('has unique species ids and expected dex size', () => {
    const speciesList = Object.values(SPECIES);
    const ids = speciesList.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEX_ORDER.length).toBe(speciesList.length);
    expect(DEX_ORDER.length).toBe(26);
  });

  it('has valid encounter and trainer species references on maps', () => {
    for (const map of Object.values(MAPS)) {
      for (const encounter of map.encounters) {
        expect(SPECIES[encounter.species], `${map.id} encounter species ${encounter.species}`).toBeDefined();
        expect(encounter.weight, `${map.id} encounter ${encounter.species} weight`).toBeGreaterThan(0);
        expect(encounter.minLv, `${map.id} encounter ${encounter.species} minLv`).toBeLessThanOrEqual(encounter.maxLv);
      }

      for (const npc of map.npcs) {
        const trainer = npc.trainer;
        if (!trainer) continue;
        for (const partyMon of trainer.party) {
          expect(SPECIES[partyMon.species], `${map.id}/${trainer.id} party species ${partyMon.species}`).toBeDefined();
        }
      }
    }
  });

  it('has valid shop stock ids and non-negative item prices', () => {
    for (const itemId of SHOP_STOCK) {
      expect(ITEMS[itemId], `shop stock item ${itemId}`).toBeDefined();
    }
    for (const item of Object.values(ITEMS)) {
      expect(item.price, `${item.id} price`).toBeGreaterThanOrEqual(0);
    }
  });

  it('enforces required species fields and stat ranges', () => {
    for (const species of Object.values(SPECIES)) {
      expect(species.types.length, `${species.key} types length`).toBeGreaterThanOrEqual(1);
      expect(species.types.length, `${species.key} types length`).toBeLessThanOrEqual(2);
      expect(species.abilities.length, `${species.key} abilities length`).toBeGreaterThanOrEqual(1);
      expect(species.abilities.length, `${species.key} abilities length`).toBeLessThanOrEqual(2);
      expect(species.eggGroups.length, `${species.key} egg groups`).toBeGreaterThanOrEqual(1);
      expect(species.catchRate, `${species.key} catch rate`).toBeGreaterThanOrEqual(1);
      expect(species.catchRate, `${species.key} catch rate`).toBeLessThanOrEqual(255);
      expect(species.expYield, `${species.key} exp yield`).toBeGreaterThan(0);
      expect(species.dex.trim().length, `${species.key} dex`).toBeGreaterThan(0);

      for (const [statName, value] of Object.entries(species.base)) {
        expect(value, `${species.key} base.${statName}`).toBeGreaterThanOrEqual(20);
        expect(value, `${species.key} base.${statName}`).toBeLessThanOrEqual(160);
      }
    }
  });
});
