import { describe, expect, it } from 'vitest';
import { formatTime, phaseFor, tintFor } from '../../src/daynight';

describe('daynight helpers', () => {
  it('resolves phase boundaries and wrapping', () => {
    expect(phaseFor(359)).toBe('night');
    expect(phaseFor(360)).toBe('morning');
    expect(phaseFor(599)).toBe('morning');
    expect(phaseFor(600)).toBe('day');
    expect(phaseFor(1019)).toBe('day');
    expect(phaseFor(1020)).toBe('evening');
    expect(phaseFor(1199)).toBe('evening');
    expect(phaseFor(1200)).toBe('night');
    expect(phaseFor(0)).toBe('night');
    expect(phaseFor(1440)).toBe('night');
  });

  it('returns expected tint values', () => {
    expect(tintFor('night').alpha).toBe(0.35);
  });

  it('formats times in HH:MM', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(690)).toBe('11:30');
  });
});
