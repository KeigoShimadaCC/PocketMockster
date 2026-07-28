import { beforeEach, describe, expect, it } from 'vitest';
import { checkEvolution } from '../../src/evolution';
import { createMockemon } from '../../src/mockemon';
import { setSeed } from '../../src/rng';

beforeEach(() => {
  setSeed(1234);
});

describe('checkEvolution', () => {
  it('checks level threshold evolution', () => {
    const sproutle = createMockemon('sproutle', 14);
    expect(checkEvolution(sproutle, { kind: 'level' })).toBeNull();
    sproutle.level = 15;
    expect(checkEvolution(sproutle, { kind: 'level' })).toBe('bramblore');
  });

  it('checks friendship evolution', () => {
    const nibbit = createMockemon('nibbit', 20);
    nibbit.friendship = 159;
    expect(checkEvolution(nibbit, { kind: 'level' })).toBeNull();
    nibbit.friendship = 160;
    expect(checkEvolution(nibbit, { kind: 'level' })).toBe('nibblex');
  });

  it('checks stone matching evolution', () => {
    const sparkit = createMockemon('sparkit', 20);
    expect(checkEvolution(sparkit, { kind: 'stone', stone: 'thunderstone' })).toBe('voltkat');
    expect(checkEvolution(sparkit, { kind: 'stone', stone: 'waterstone' })).toBeNull();

    const floazy = createMockemon('floazy', 20);
    expect(checkEvolution(floazy, { kind: 'stone', stone: 'waterstone' })).toBe('driftail');

    const psywisp = createMockemon('psywisp', 20);
    expect(checkEvolution(psywisp, { kind: 'stone', stone: 'moonstone' })).toBe('somnara');
  });

  it('checks trade evolution', () => {
    const pebblit = createMockemon('pebblit', 20);
    expect(checkEvolution(pebblit, { kind: 'trade' })).toBe('bouldron');

    const sproutle = createMockemon('sproutle', 20);
    expect(checkEvolution(sproutle, { kind: 'trade' })).toBeNull();
  });
});
