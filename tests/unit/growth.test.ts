import { beforeEach, describe, expect, it } from 'vitest';

import type { GrowthRate } from '../../src/data/species';
import { expForLevel } from '../../src/mockemon';
import { setSeed } from '../../src/rng';

describe('expForLevel', () => {
  beforeEach(() => {
    setSeed(1234);
  });

  it('matches exact mediumfast values', () => {
    expect(expForLevel('mediumfast', 1)).toBe(1);
    expect(expForLevel('mediumfast', 5)).toBe(125);
    expect(expForLevel('mediumfast', 50)).toBe(125000);
    expect(expForLevel('mediumfast', 100)).toBe(1000000);
  });

  it('matches exact fast values', () => {
    expect(expForLevel('fast', 50)).toBe(100000);
    expect(expForLevel('fast', 100)).toBe(800000);
  });

  it('matches exact slow values', () => {
    expect(expForLevel('slow', 50)).toBe(156250);
    expect(expForLevel('slow', 100)).toBe(1250000);
  });

  it('matches exact mediumslow values', () => {
    expect(expForLevel('mediumslow', 1)).toBe(0);
    // floor(1.2*125000 - 15*2500 + 100*50 - 140) = floor(117360) = 117360
    expect(expForLevel('mediumslow', 50)).toBe(117360);
    expect(expForLevel('mediumslow', 100)).toBe(1059860);
  });

  it('matches exact erratic values', () => {
    // n<=50 branch: floor((50^3 * (100-50)) / 50) = floor(125000) = 125000
    expect(expForLevel('erratic', 50)).toBe(125000);
    expect(expForLevel('erratic', 100)).toBe(600000);
  });

  it('matches exact fluctuating values', () => {
    expect(expForLevel('fluctuating', 14)).toBe(1591);
    expect(expForLevel('fluctuating', 36)).toBe(46656);
  });

  it('is monotonic non-decreasing for all growth rates from 1..100', () => {
    const rates: GrowthRate[] = ['fast', 'mediumfast', 'mediumslow', 'slow', 'erratic', 'fluctuating'];
    for (const rate of rates) {
      for (let level = 1; level < 100; level++) {
        const curr = expForLevel(rate, level);
        const next = expForLevel(rate, level + 1);
        expect(next, `${rate} level ${level} -> ${level + 1}`).toBeGreaterThanOrEqual(curr);
      }
    }
  });
});
