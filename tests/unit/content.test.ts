import { describe, expect, it } from 'vitest';

import { MAPS, type GameMap } from '../../src/maps';
import { validateMaps, type ValidationSources } from '../../src/content/validate';

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

  // ---- New cross-reference checks (scripts, quests, flags, rewards) ----

  const emptySources: ValidationSources = { scripts: {}, trainers: {}, quests: {}, items: {}, species: {}, people: {} };

  it('reports unknown battle trainer referenced in a script', () => {
    const mapletown = makeMap('mapletown');
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      scripts: { test: [{ t: 'battle', trainer: 'no_such_trainer' }] },
    });
    expect(hasMessage(issues, "Unknown battle trainer 'no_such_trainer'")).toBe(true);
  });

  it('reports unknown giveMon species in a script', () => {
    const mapletown = makeMap('mapletown');
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      scripts: { test: [{ t: 'giveMon', species: 'no_such_species', level: 5 }] },
    });
    expect(hasMessage(issues, "Unknown species 'no_such_species' in giveMon")).toBe(true);
  });

  it('reports giveMon level out of range', () => {
    const mapletown = makeMap('mapletown');
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      scripts: { test: [{ t: 'giveMon', species: 'nibbit', level: 0 }] },
      species: { nibbit: {} },
    });
    expect(hasMessage(issues, 'giveMon level 0 is outside 1..100')).toBe(true);
  });

  it('reports unknown giveItem id in a script', () => {
    const mapletown = makeMap('mapletown');
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      scripts: { test: [{ t: 'giveItem', item: 'no_such_item' }] },
    });
    expect(hasMessage(issues, "Unknown item 'no_such_item' in giveItem")).toBe(true);
  });

  it('reports unknown shop stock item in a script', () => {
    const mapletown = makeMap('mapletown');
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      scripts: { test: [{ t: 'shop', stock: ['no_such_item'] }] },
    });
    expect(hasMessage(issues, "Unknown shop stock item 'no_such_item'")).toBe(true);
  });

  it('reports unknown warp target map in a script', () => {
    const mapletown = makeMap('mapletown');
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      scripts: { test: [{ t: 'warp', map: 'ghosttown', x: 0, y: 0 }] },
    });
    expect(hasMessage(issues, "Unknown warp target map 'ghosttown'")).toBe(true);
  });

  it('reports warp in a script landing on a solid tile', () => {
    const mapletown = makeMap('mapletown', ['...', '.T.', '...']);
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      scripts: { test: [{ t: 'warp', map: 'mapletown', x: 1, y: 1 }] },
    });
    expect(hasMessage(issues, "is on solid tile 'T'")).toBe(true);
  });

  it('reports unknown quest id in a script', () => {
    const mapletown = makeMap('mapletown');
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      scripts: { test: [{ t: 'questStart', quest: 'no_such_quest' }] },
    });
    expect(hasMessage(issues, "Unknown quest 'no_such_quest' in questStart")).toBe(true);
  });

  it('reports unknown quest stage in a script', () => {
    const mapletown = makeMap('mapletown');
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      scripts: { test: [{ t: 'questAdvance', quest: 'q1', stage: 'bad' }] },
      quests: { q1: { id: 'q1', stages: [{ id: 'good' }] } },
    });
    expect(hasMessage(issues, "Unknown stage 'bad' for quest 'q1' in questAdvance")).toBe(true);
  });

  it('walks nested script commands (choice options)', () => {
    const mapletown = makeMap('mapletown');
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      scripts: {
        test: [{
          t: 'choice',
          title: 'Pick',
          options: [
            { label: 'A', then: [{ t: 'battle', trainer: 'nested_bad' }] },
          ],
        }],
      },
    });
    expect(hasMessage(issues, "Unknown battle trainer 'nested_bad'")).toBe(true);
  });

  it('walks nested script commands (battle onWin)', () => {
    const mapletown = makeMap('mapletown');
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      scripts: {
        test: [{
          t: 'battle',
          trainer: 'ok',
          onWin: [{ t: 'giveItem', item: 'nested_bad_item' }],
        }],
      },
      trainers: { ok: {} },
    });
    expect(hasMessage(issues, "Unknown item 'nested_bad_item' in giveItem")).toBe(true);
  });

  it('warns when a quest giver does not match any NPC id', () => {
    const mapletown = makeMap('mapletown');
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      quests: { q1: { id: 'q1', giver: 'no_such_giver', stages: [] } },
    });
    expect(hasMessage(issues, "Quest giver 'no_such_giver' does not match any NPC id")).toBe(true);
  });

  it('reports unknown reward item', () => {
    const mapletown = makeMap('mapletown');
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      quests: { q1: { id: 'q1', stages: [], reward: { item: 'no_such_item' } } },
    });
    expect(hasMessage(issues, "Unknown reward item 'no_such_item'")).toBe(true);
  });

  it('reports unknown reward mon species', () => {
    const mapletown = makeMap('mapletown');
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      quests: { q1: { id: 'q1', stages: [], reward: { mon: { species: 'no_such_species', level: 10 } } } },
    });
    expect(hasMessage(issues, "Unknown reward mon species 'no_such_species'")).toBe(true);
  });

  it('reports reward mon level out of range', () => {
    const mapletown = makeMap('mapletown');
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      quests: { q1: { id: 'q1', stages: [], reward: { mon: { species: 'nibbit', level: 101 } } } },
      species: { nibbit: {} },
    });
    expect(hasMessage(issues, 'Reward mon level 101 is outside 1..100')).toBe(true);
  });

  it('warns when a flag is read but never set', () => {
    const mapletown = makeMap('mapletown');
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      scripts: { test: [{ t: 'if', flag: 'neverSet', then: [] }] },
    });
    expect(hasMessage(issues, "Flag 'neverSet' is read but never set")).toBe(true);
  });

  it('does not warn when a flag is both set and read', () => {
    const mapletown = makeMap('mapletown');
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      scripts: { test: [{ t: 'setFlag', flag: 'myFlag' }, { t: 'if', flag: 'myFlag', then: [] }] },
    });
    expect(hasMessage(issues, "Flag 'myFlag' is read but never set")).toBe(false);
  });

  it('does not warn for runtime-generated badge_ flags', () => {
    const mapletown = makeMap('mapletown');
    const issues = validateMaps({ mapletown }, {
      ...emptySources,
      scripts: { test: [{ t: 'if', flag: 'badge_boulder', then: [] }] },
    });
    expect(hasMessage(issues, "Flag 'badge_boulder' is read but never set")).toBe(false);
  });

  it('reports no new errors for the shipped content registry', () => {
    const errors = validateMaps(MAPS).filter((issue) => issue.severity === 'error');
    expect(errors).toEqual([]);
  });
});
