import { beforeEach, describe, expect, it } from 'vitest';

import { createMockemon, recalcStats } from '../../src/mockemon';
import { setSeed } from '../../src/rng';

describe('recalcStats', () => {
  beforeEach(() => {
    setSeed(1234);
  });

  it('computes HP with IVs/EVs/level formula', () => {
    const m = createMockemon('sproutle', 50);
    m.nature = 'hardy';
    m.ivs = { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 };
    m.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

    recalcStats(m);
    expect(m.maxHp).toBe(115);
  });

  it('applies neutral and non-neutral nature multipliers', () => {
    const m = createMockemon('sproutle', 50);
    m.ivs = { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 };
    m.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

    m.nature = 'hardy';
    recalcStats(m);
    expect(m.atk).toBe(64);

    m.nature = 'lonely';
    recalcStats(m);
    expect(m.atk).toBe(70);
    expect(m.def).toBe(57);
  });

  it('includes EV contribution in stat core formula', () => {
    const m = createMockemon('sproutle', 50);
    m.nature = 'hardy';
    m.ivs = { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 };
    m.evs = { hp: 0, atk: 252, def: 0, spa: 0, spd: 0, spe: 0 };

    recalcStats(m);
    expect(m.atk).toBe(95);
  });

  it('preserves HP ratio across recalculation', () => {
    const m = createMockemon('sproutle', 50);
    m.nature = 'hardy';
    m.ivs = { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 };
    m.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    recalcStats(m);

    m.hp = Math.floor(m.maxHp / 2);
    m.evs.hp = 252;
    recalcStats(m);

    expect(Math.abs(m.hp - Math.round(m.maxHp / 2))).toBeLessThanOrEqual(1);
  });

  it('matches formula for a second species with different base stats', () => {
    const m = createMockemon('pebblit', 20);
    m.nature = 'hardy';
    m.ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
    m.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

    recalcStats(m);
    expect(m.def).toBe(51);
  });
});
