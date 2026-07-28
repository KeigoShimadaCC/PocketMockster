import { describe, expect, it } from 'vitest';

import { MAPS, type GameMap } from '../../src/maps';
import { validateMaps } from '../../src/content/validate';

function makeMap(id: string, tiles: string[] = ['...', '...', '...']): GameMap {
  return {
    id,
    name: id,
    tiles,
    warps: [],
    npcs: [],
    items: [],
    encounters: [],
    encounterRate: 0,
    signs: [],
    lockedDoors: [],
    indoor: false,
  };
}

function hasMessage(issues: ReturnType<typeof validateMaps>, fragment: string): boolean {
  return issues.some((issue) => issue.message.includes(fragment));
}

describe('content validator', () => {
  it('reports no errors for the shipped map registry', () => {
    const errors = validateMaps(MAPS).filter((issue) => issue.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('keeps every map reachable from the start town', () => {
    const reachable = validateMaps(MAPS).filter((issue) => issue.message.includes('unreachable'));
    expect(reachable).toEqual([]);
  });

  it('reports ragged tile rows', () => {
    const mapletown = makeMap('mapletown', ['....', '..']);
    const issues = validateMaps({ mapletown });
    expect(hasMessage(issues, 'Map tiles are ragged')).toBe(true);
  });

  it('reports unknown tile chars', () => {
    const mapletown = makeMap('mapletown', ['..?', '...', '...']);
    const issues = validateMaps({ mapletown });
    expect(hasMessage(issues, "Unknown tile '?'")).toBe(true);
  });

  it('reports warp origins out of bounds', () => {
    const mapletown = makeMap('mapletown');
    mapletown.warps.push({ x: 9, y: 9, to: 'route1', tx: 1, ty: 1 });
    const route1 = makeMap('route1');
    const issues = validateMaps({ mapletown, route1 });
    expect(hasMessage(issues, 'Warp origin is out of bounds')).toBe(true);
  });

  it('reports warps pointing to missing maps', () => {
    const mapletown = makeMap('mapletown');
    mapletown.warps.push({ x: 1, y: 1, to: 'ghosttown', tx: 1, ty: 1 });
    const issues = validateMaps({ mapletown });
    expect(hasMessage(issues, "Warp target map 'ghosttown' does not exist")).toBe(true);
  });

  it('reports warps landing on solid tiles', () => {
    const mapletown = makeMap('mapletown');
    mapletown.warps.push({ x: 1, y: 1, to: 'route1', tx: 1, ty: 1 });
    const route1 = makeMap('route1', ['...', '.T.', '...']);
    const issues = validateMaps({ mapletown, route1 });
    expect(hasMessage(issues, "is on solid tile 'T'")).toBe(true);
  });

  it('reports npcs standing on solid tiles', () => {
    const mapletown = makeMap('mapletown', ['...', '.T.', '...']);
    mapletown.npcs.push({
      id: 'npc1',
      x: 1,
      y: 1,
      spriteKey: 'villager1',
      facing: 'down',
      dialogue: ['hello'],
    });
    const issues = validateMaps({ mapletown });
    expect(hasMessage(issues, "NPC is on solid tile 'T'")).toBe(true);
  });

  it('reports duplicate npc ids across maps', () => {
    const mapletown = makeMap('mapletown');
    mapletown.warps.push({ x: 1, y: 1, to: 'route1', tx: 1, ty: 1 });
    mapletown.npcs.push({ id: 'dup', x: 1, y: 1, spriteKey: 'villager1', facing: 'down', dialogue: ['a'] });
    const route1 = makeMap('route1');
    route1.warps.push({ x: 1, y: 1, to: 'mapletown', tx: 1, ty: 1 });
    route1.npcs.push({ id: 'dup', x: 1, y: 1, spriteKey: 'villager2', facing: 'up', dialogue: ['b'] });
    const issues = validateMaps({ mapletown, route1 });
    expect(hasMessage(issues, "Duplicate NPC id 'dup'")).toBe(true);
  });

  it('reports unknown npc sprite keys', () => {
    const mapletown = makeMap('mapletown');
    mapletown.npcs.push({
      id: 'npc1',
      x: 1,
      y: 1,
      spriteKey: 'not-a-sprite',
      facing: 'down',
      dialogue: ['hello'],
    });
    const issues = validateMaps({ mapletown });
    expect(hasMessage(issues, "Unknown NPC spriteKey 'not-a-sprite'")).toBe(true);
  });

  it('reports unknown trainer party species', () => {
    const mapletown = makeMap('mapletown');
    mapletown.npcs.push({
      id: 'trainer-npc',
      x: 1,
      y: 1,
      spriteKey: 'villager1',
      facing: 'down',
      dialogue: ['battle'],
      trainer: {
        id: 't1',
        name: 'T1',
        spriteKey: 'villager1',
        party: [{ species: 'missing-species', level: 5 }],
        prize: 100,
        introText: 'go',
        defeatText: 'done',
        sight: 2,
      },
    });
    const issues = validateMaps({ mapletown });
    expect(hasMessage(issues, "Unknown trainer party species 'missing-species'")).toBe(true);
  });

  it('reports trainer party level 0', () => {
    const mapletown = makeMap('mapletown');
    mapletown.npcs.push({
      id: 'trainer-low',
      x: 1,
      y: 1,
      spriteKey: 'villager1',
      facing: 'down',
      dialogue: ['battle'],
      trainer: {
        id: 't-low',
        name: 'Low',
        spriteKey: 'villager1',
        party: [{ species: 'nibbit', level: 0 }],
        prize: 100,
        introText: 'go',
        defeatText: 'done',
        sight: 2,
      },
    });
    const issues = validateMaps({ mapletown });
    expect(hasMessage(issues, 'Trainer party level 0 is outside 1..100')).toBe(true);
  });

  it('reports trainer party level 101', () => {
    const mapletown = makeMap('mapletown');
    mapletown.npcs.push({
      id: 'trainer-high',
      x: 1,
      y: 1,
      spriteKey: 'villager1',
      facing: 'down',
      dialogue: ['battle'],
      trainer: {
        id: 't-high',
        name: 'High',
        spriteKey: 'villager1',
        party: [{ species: 'nibbit', level: 101 }],
        prize: 100,
        introText: 'go',
        defeatText: 'done',
        sight: 2,
      },
    });
    const issues = validateMaps({ mapletown });
    expect(hasMessage(issues, 'Trainer party level 101 is outside 1..100')).toBe(true);
  });

  it('reports encounter weights <= 0', () => {
    const mapletown = makeMap('mapletown', ['.G.', '.G.', '.G.']);
    mapletown.encounterRate = 1;
    mapletown.encounters = [{ species: 'nibbit', minLv: 2, maxLv: 3, weight: 0 }];
    const issues = validateMaps({ mapletown });
    expect(hasMessage(issues, 'Encounter weight 0 must be > 0')).toBe(true);
  });

  it("reports encounterRate > 0 when there are no 'G' tiles", () => {
    const mapletown = makeMap('mapletown');
    mapletown.encounterRate = 1;
    mapletown.encounters = [{ species: 'nibbit', minLv: 2, maxLv: 3, weight: 1 }];
    const issues = validateMaps({ mapletown });
    expect(hasMessage(issues, "Encounter rate is > 0 but map has no 'G' tiles")).toBe(true);
  });

  it("reports maps unreachable from 'mapletown'", () => {
    const mapletown = makeMap('mapletown');
    const unreachable = makeMap('unreachable');
    const issues = validateMaps({ mapletown, unreachable });
    expect(hasMessage(issues, "Map is unreachable from 'mapletown'")).toBe(true);
  });
});
