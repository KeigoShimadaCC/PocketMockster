import { describe, expect, it } from 'vitest';
import { QUESTS } from '../../src/content/quests';
import { ITEMS } from '../../src/data/items';
import { SPECIES } from '../../src/data/species';
import { QuestLog, type QuestDef, type QuestProgress } from '../../src/quests';

const MAIN_STAGE_IDS = [
  'starter',
  'parcel',
  'badge1',
  'badge2',
  'badge3',
  'badge4',
  'badge5',
  'badge6',
  'badge7',
  'badge8',
  'nullpeak',
  'league',
  'champion',
] as const;

function makeDefs(): Record<string, QuestDef> {
  return {
    main_alpha: {
      id: 'main_alpha',
      title: 'Main Alpha',
      kind: 'main',
      act: 0,
      stages: [
        { id: 'm0', objective: 'Main 0', journal: 'Main J0' },
        { id: 'm1', objective: 'Main 1', journal: 'Main J1' },
      ],
    },
    side_beta: {
      id: 'side_beta',
      title: 'Side Beta',
      kind: 'side',
      act: 1,
      stages: [
        { id: 's0', objective: 'Side 0', journal: 'Side J0' },
        { id: 's1', objective: 'Side 1', journal: 'Side J1' },
        { id: 's2', objective: 'Side 2', journal: 'Side J2' },
      ],
    },
    side_gamma: {
      id: 'side_gamma',
      title: 'Side Gamma',
      kind: 'side',
      act: 3,
      stages: [{ id: 'g0', objective: 'Gamma 0', journal: 'Gamma J0' }],
    },
  };
}

describe('QuestLog', () => {
  it('state shape matches script contract defaults', () => {
    const log = new QuestLog(makeDefs());
    expect(log.state('main_alpha')).toEqual({ active: false, done: false, stage: null });
  });

  it('stageIndex is -1 when not started', () => {
    const log = new QuestLog(makeDefs());
    expect(log.stageIndex('main_alpha')).toBe(-1);
  });

  it('start activates stage 0', () => {
    const log = new QuestLog(makeDefs());
    log.start('main_alpha');
    expect(log.state('main_alpha')).toEqual({ active: true, done: false, stage: 'm0' });
    expect(log.stageIndex('main_alpha')).toBe(0);
  });

  it('start is no-op when already started', () => {
    const log = new QuestLog(makeDefs());
    log.start('main_alpha');
    log.advance('main_alpha');
    log.start('main_alpha');
    expect(log.stageIndex('main_alpha')).toBe(1);
  });

  it('start is no-op when done', () => {
    const log = new QuestLog(makeDefs());
    log.complete('main_alpha');
    log.start('main_alpha');
    expect(log.state('main_alpha')).toEqual({ active: false, done: true, stage: null });
  });

  it('unknown ids are ignored for start, advance, complete, state, and stageIndex', () => {
    const log = new QuestLog(makeDefs());
    log.start('missing');
    log.advance('missing');
    log.complete('missing');
    expect(log.state('missing')).toEqual({ active: false, done: false, stage: null });
    expect(log.stageIndex('missing')).toBe(-1);
    expect(log.toJSON()).toEqual({});
  });

  it('advance on not-started quest starts at stage 0 then advances', () => {
    const log = new QuestLog(makeDefs());
    log.advance('side_beta');
    expect(log.state('side_beta')).toEqual({ active: true, done: false, stage: 's1' });
    expect(log.stageIndex('side_beta')).toBe(1);
  });

  it('advance by explicit stage id jumps to that stage', () => {
    const log = new QuestLog(makeDefs());
    log.start('side_beta');
    log.advance('side_beta', 's2');
    expect(log.state('side_beta')).toEqual({ active: true, done: false, stage: 's2' });
    expect(log.stageIndex('side_beta')).toBe(2);
  });

  it('advance with unknown stage id is no-op', () => {
    const log = new QuestLog(makeDefs());
    log.start('side_beta');
    log.advance('side_beta', 'nope');
    expect(log.stageIndex('side_beta')).toBe(0);
  });

  it('advance past last stage does not auto-complete', () => {
    const log = new QuestLog(makeDefs());
    log.start('side_gamma');
    log.advance('side_gamma');
    expect(log.state('side_gamma')).toEqual({ active: true, done: false, stage: null });
  });

  it('complete on unstarted quest marks it done from nothing', () => {
    const log = new QuestLog(makeDefs());
    log.complete('side_beta');
    expect(log.state('side_beta')).toEqual({ active: false, done: true, stage: null });
    expect(log.stageIndex('side_beta')).toBe(-1);
  });

  it('complete on started quest preserves current stage', () => {
    const log = new QuestLog(makeDefs());
    log.start('side_beta');
    log.advance('side_beta', 's1');
    log.complete('side_beta');
    expect(log.state('side_beta')).toEqual({ active: false, done: true, stage: 's1' });
  });

  it('advance is no-op after completion', () => {
    const log = new QuestLog(makeDefs());
    log.complete('side_beta');
    log.advance('side_beta');
    expect(log.state('side_beta')).toEqual({ active: false, done: true, stage: null });
  });

  it('active sorts main first then by act', () => {
    const log = new QuestLog(makeDefs());
    log.start('side_gamma');
    log.start('side_beta');
    log.start('main_alpha');
    expect(log.active().map((q) => q.id)).toEqual(['main_alpha', 'side_beta', 'side_gamma']);
  });

  it('completed returns known completed quests only', () => {
    const log = new QuestLog(makeDefs());
    log.complete('side_gamma');
    log.complete('main_alpha');
    expect(log.completed().map((q) => q.id)).toEqual(['main_alpha', 'side_gamma']);
  });

  it('nextObjective prefers active main quest over side quests', () => {
    const log = new QuestLog(makeDefs());
    log.start('main_alpha');
    log.start('side_beta');
    expect(log.nextObjective()).toBe('Main 0');
  });

  it('nextObjective falls back to first active side quest', () => {
    const log = new QuestLog(makeDefs());
    log.start('side_beta');
    log.start('side_gamma');
    expect(log.nextObjective()).toBe('Side 0');
  });

  it('nextObjective returns null when active stage is out of range', () => {
    const log = new QuestLog(makeDefs());
    log.start('side_gamma');
    log.advance('side_gamma');
    expect(log.nextObjective()).toBeNull();
  });

  it('journal returns lines up to and including current stage', () => {
    const log = new QuestLog(makeDefs());
    log.start('side_beta');
    log.advance('side_beta');
    expect(log.journal('side_beta')).toEqual(['Side J0', 'Side J1']);
  });

  it('journal clamps to final stage when stage index is beyond range', () => {
    const log = new QuestLog(makeDefs());
    log.start('side_gamma');
    log.advance('side_gamma');
    expect(log.journal('side_gamma')).toEqual(['Gamma J0']);
  });

  it('journal for unknown or unstarted quest is empty', () => {
    const log = new QuestLog(makeDefs());
    expect(log.journal('side_beta')).toEqual([]);
    expect(log.journal('missing')).toEqual([]);
  });

  it('round-trips with toJSON constructor preserving progress', () => {
    const defs = makeDefs();
    const original = new QuestLog(defs);
    original.start('main_alpha');
    original.advance('main_alpha');
    original.complete('side_beta');
    const reloaded = new QuestLog(defs, original.toJSON());
    expect(reloaded.state('main_alpha')).toEqual({ active: true, done: false, stage: 'm1' });
    expect(reloaded.state('side_beta')).toEqual({ active: false, done: true, stage: null });
    expect(reloaded.toJSON()).toEqual(original.toJSON());
  });

  it('toJSON preserves progress entries not present in defs', () => {
    const progress: QuestProgress = { removed_quest: { stage: 4, done: true } };
    const log = new QuestLog(makeDefs(), progress);
    expect(log.toJSON()).toEqual({ removed_quest: { stage: 4, done: true } });
    expect(log.active()).toEqual([]);
    expect(log.completed()).toEqual([]);
  });
});

describe('QUESTS registry integrity', () => {
  it('contains the main journey and the 12 planned side quests', () => {
    const sideIds = Object.values(QUESTS)
      .filter((q) => q.kind === 'side')
      .map((q) => q.id)
      .sort();
    expect(QUESTS.main_journey).toBeDefined();
    expect(sideIds).toEqual([
      'berries',
      'contest',
      'daycare_egg',
      'dex_milestones',
      'fossil',
      'gauntlet',
      'hiker_trade',
      'lighthouse',
      'lost_nibbit',
      'observatory_ghost',
      'parcel',
      'sky_feather',
    ]);
  });

  it('every quest id matches its object key and stage ids are unique/non-empty', () => {
    const seenIds = new Set<string>();
    for (const [key, quest] of Object.entries(QUESTS)) {
      expect(quest.id).toBe(key);
      expect(seenIds.has(quest.id)).toBe(false);
      seenIds.add(quest.id);
      expect(quest.stages.length).toBeGreaterThan(0);
      const stageIds = quest.stages.map((s) => s.id);
      const uniqueStageIds = new Set(stageIds);
      expect(uniqueStageIds.size).toBe(stageIds.length);
      for (const stage of quest.stages) {
        expect(stage.id.length).toBeGreaterThan(0);
        expect(stage.objective.length).toBeGreaterThan(0);
        expect(stage.journal.length).toBeGreaterThan(0);
      }
    }
  });

  it('every reward item and species id resolves against real registries', () => {
    for (const quest of Object.values(QUESTS)) {
      const reward = quest.reward;
      if (!reward) continue;
      if (reward.item) expect(ITEMS[reward.item]).toBeDefined();
      if (reward.mon) expect(SPECIES[reward.mon.species]).toBeDefined();
    }
  });

  it('main_journey has the exact stable ordered stage ids', () => {
    const ids = QUESTS.main_journey.stages.map((s) => s.id);
    expect(ids).toEqual([...MAIN_STAGE_IDS]);
  });

  it('main_journey has exactly one stage for each gym badge', () => {
    const badgeStages = QUESTS.main_journey.stages.filter((s) => /^badge[1-8]$/.test(s.id));
    expect(badgeStages.map((s) => s.id)).toEqual([
      'badge1',
      'badge2',
      'badge3',
      'badge4',
      'badge5',
      'badge6',
      'badge7',
      'badge8',
    ]);
  });

  it('nextObjective returns main objective when side quest is also active', () => {
    const log = new QuestLog(QUESTS);
    log.start('main_journey');
    log.start('parcel');
    expect(log.nextObjective()).toBe(QUESTS.main_journey.stages[0].objective);
  });
});
