import { beforeEach, describe, expect, it } from 'vitest';

import { MOVES } from '../../src/data/moves';
import { SPECIES } from '../../src/data/species';
import {
  NATURES,
  addEVs,
  changeFriendship,
  createMockemon,
  displayName,
  gainExp,
  healFull,
  isShiny,
  learnMove,
} from '../../src/mockemon';
import { setSeed } from '../../src/rng';

describe('mockemon core helpers', () => {
  beforeEach(() => {
    setSeed(1234);
  });

  it('createMockemon initializes valid defaults and move PP', () => {
    const sproutle = createMockemon('sproutle', 10);
    expect(sproutle.hp).toBe(sproutle.maxHp);
    expect(NATURES[sproutle.nature]).toBeDefined();
    for (const iv of Object.values(sproutle.ivs)) {
      expect(iv).toBeGreaterThanOrEqual(0);
      expect(iv).toBeLessThanOrEqual(31);
    }
    expect(sproutle.evs).toEqual({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
    expect(sproutle.moves.length).toBeGreaterThanOrEqual(1);
    expect(sproutle.moves.length).toBeLessThanOrEqual(4);
    for (const ms of sproutle.moves) {
      expect(ms.pp).toBe(MOVES[ms.id].pp);
    }
    expect(sproutle.friendship).toBe(70);

    const mimew = createMockemon('mimew', 10);
    expect(mimew.friendship).toBe(SPECIES.mimew.baseFriendship);
  });

  it('isShiny follows PV xor threshold', () => {
    expect(isShiny(0)).toBe(true);
    expect(isShiny(0x00200010)).toBe(false);
  });

  it('addEVs enforces per-stat and total caps', () => {
    const m = createMockemon('sproutle', 20);

    addEVs(m, { atk: 300 });
    expect(m.evs.atk).toBe(252);

    const additions: Array<'hp' | 'def' | 'spa' | 'spd' | 'spe'> = ['hp', 'def', 'spa', 'spd', 'spe'];
    for (const stat of additions) {
      addEVs(m, { [stat]: 60 });
      const total = Object.values(m.evs).reduce((sum, v) => sum + v, 0);
      expect(total).toBeLessThanOrEqual(510);
      expect(m.evs[stat]).toBeLessThanOrEqual(252);
    }
    const finalTotal = Object.values(m.evs).reduce((sum, v) => sum + v, 0);
    expect(finalTotal).toBe(510);
  });

  it('learnMove adds, replaces, and rejects invalid requests', () => {
    const m = createMockemon('sproutle', 1);

    m.moves = [{ id: 'tackle', pp: MOVES.tackle.pp }];
    expect(learnMove(m, 'ember', null)).toBe(true);
    expect(m.moves.map((ms) => ms.id)).toEqual(['tackle', 'ember']);

    m.moves = [
      { id: 'tackle', pp: MOVES.tackle.pp },
      { id: 'growl', pp: MOVES.growl.pp },
      { id: 'scratch', pp: MOVES.scratch.pp },
      { id: 'watergun', pp: MOVES.watergun.pp },
    ];
    expect(learnMove(m, 'vinewhip', 1)).toBe(true);
    expect(m.moves.map((ms) => ms.id)).toEqual(['tackle', 'vinewhip', 'scratch', 'watergun']);

    const snapshot = m.moves.map((ms) => ({ ...ms }));
    expect(learnMove(m, 'vinewhip', 0)).toBe(false);
    expect(m.moves).toEqual(snapshot);
    expect(learnMove(m, 'ember', 99)).toBe(false);
    expect(m.moves).toEqual(snapshot);
  });

  it('gainExp levels up repeatedly and queues moves when full', () => {
    const m = createMockemon('sproutle', 1);
    m.moves = [
      { id: 'tackle', pp: MOVES.tackle.pp },
      { id: 'growl', pp: MOVES.growl.pp },
      { id: 'scratch', pp: MOVES.scratch.pp },
      { id: 'ember', pp: MOVES.ember.pp },
    ];

    const result = gainExp(m, 100000);
    expect(result.leveled).toBe(true);
    expect(result.newLevel).toBeGreaterThan(1);
    expect(m.pendingMoves).toEqual(['vinewhip', 'stringshot', 'razorleaf']);
    expect(result.queued).toEqual([
      MOVES.vinewhip.name,
      MOVES.stringshot.name,
      MOVES.razorleaf.name,
    ]);
  });

  it('healFull restores battle state and PP', () => {
    const m = createMockemon('sproutle', 20);
    m.hp = 1;
    m.status = 'PSN';
    m.sleepTurns = 2;
    m.toxicCounter = 4;
    m.moves = m.moves.map((ms) => ({ ...ms, pp: 1 }));

    healFull(m);
    expect(m.hp).toBe(m.maxHp);
    expect(m.status).toBeNull();
    expect(m.sleepTurns).toBe(0);
    expect(m.toxicCounter).toBe(0);
    for (const ms of m.moves) {
      expect(ms.pp).toBe(MOVES[ms.id].pp);
    }
  });

  it('changeFriendship clamps between 0 and 255', () => {
    const m = createMockemon('sproutle', 10);
    m.friendship = 250;
    changeFriendship(m, 50);
    expect(m.friendship).toBe(255);
    changeFriendship(m, -999);
    expect(m.friendship).toBe(0);
  });

  it('displayName appends shiny star suffix', () => {
    const m = createMockemon('sproutle', 10);
    m.nickname = 'Buddy';
    m.shiny = false;
    expect(displayName(m)).toBe('Buddy');
    m.shiny = true;
    expect(displayName(m)).toBe('Buddy ★');
  });
});
