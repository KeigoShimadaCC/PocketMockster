import { describe, expect, it } from 'vitest';
import { SCRIPTS } from '../../src/content/scripts/index';
import { ScriptRunner, type ScriptCmd, type ScriptHost } from '../../src/script';

type BattleOutcome = 'win' | 'lose' | 'run' | 'caught' | null;

class FakeHost implements ScriptHost {
  busy = false;
  calls: string[] = [];
  flags = new Map<string, boolean>();
  items = new Map<string, number>();
  money = 0;
  party: Array<{ species: string; level: number }> = [];
  eggs: string[] = [];
  healPartyCount = 0;
  healPointCount = 0;
  warps: Array<{ map: string; x: number; y: number }> = [];
  quests = new Map<string, { active: boolean; done: boolean; stage: string | null }>();

  private sayDone?: () => void;
  private pickChoice?: (index: number) => void;
  private cancelChoice?: () => void;
  private shopDone?: () => void;
  private battleDone?: (outcome: BattleOutcome) => void;
  private cutsceneDone?: () => void;

  isBusy(): boolean {
    return this.busy;
  }

  say(lines: string[], done: () => void): void {
    this.calls.push(`say:${JSON.stringify(lines)}`);
    this.busy = true;
    this.sayDone = done;
  }

  choose(title: string, labels: string[], onPick: (index: number) => void, onCancel: () => void): void {
    this.calls.push(`choose:${title}:${labels.join('|')}`);
    this.busy = true;
    this.pickChoice = onPick;
    this.cancelChoice = onCancel;
  }

  getFlag(flag: string): boolean {
    return this.flags.get(flag) ?? false;
  }

  setFlag(flag: string, value: boolean): void {
    this.calls.push(`setFlag:${flag}:${String(value)}`);
    this.flags.set(flag, value);
  }

  hasItem(item: string, count: number): boolean {
    return (this.items.get(item) ?? 0) >= count;
  }

  giveItem(item: string, count: number): void {
    this.calls.push(`giveItem:${item}:${count}`);
    this.items.set(item, (this.items.get(item) ?? 0) + count);
  }

  takeItem(item: string, count: number): void {
    this.calls.push(`takeItem:${item}:${count}`);
    this.items.set(item, Math.max(0, (this.items.get(item) ?? 0) - count));
  }

  giveMon(species: string, level: number): void {
    this.calls.push(`giveMon:${species}:${level}`);
    this.party.push({ species, level });
  }

  giveEgg(species: string): void {
    this.calls.push(`giveEgg:${species}`);
    this.eggs.push(species);
  }

  changeMoney(delta: number): void {
    this.calls.push(`money:${delta}`);
    this.money += delta;
  }

  healParty(): void {
    this.calls.push('healParty');
    this.healPartyCount += 1;
  }

  setHealPoint(): void {
    this.calls.push('setHealPoint');
    this.healPointCount += 1;
  }

  openShop(stock: string[] | undefined, done: () => void): void {
    this.calls.push(`shop:${stock ? stock.join('|') : ''}`);
    this.busy = true;
    this.shopDone = done;
  }

  startBattle(trainerId: string, done: (outcome: BattleOutcome) => void): void {
    this.calls.push(`battle:${trainerId}`);
    this.busy = true;
    this.battleDone = done;
  }

  warp(map: string, x: number, y: number): void {
    this.calls.push(`warp:${map}:${x}:${y}`);
    this.warps.push({ map, x, y });
  }

  questState(quest: string): { active: boolean; done: boolean; stage: string | null } {
    return this.quests.get(quest) ?? { active: false, done: false, stage: null };
  }

  questStart(quest: string): void {
    this.calls.push(`questStart:${quest}`);
    this.quests.set(quest, { active: true, done: false, stage: null });
  }

  questAdvance(quest: string, stage?: string): void {
    this.calls.push(`questAdvance:${quest}:${stage ?? ''}`);
    this.quests.set(quest, { active: true, done: false, stage: stage ?? null });
  }

  questComplete(quest: string): void {
    this.calls.push(`questComplete:${quest}`);
    const prev = this.quests.get(quest) ?? { active: true, done: false, stage: null };
    this.quests.set(quest, { active: false, done: true, stage: prev.stage });
  }

  playCutscene(id: string, done: () => void): void {
    this.calls.push(`cutscene:${id}`);
    this.busy = true;
    this.cutsceneDone = done;
  }

  resolveSay(times = 1): void {
    const cb = this.sayDone;
    if (!cb) return;
    this.sayDone = undefined;
    this.busy = false;
    for (let i = 0; i < times; i += 1) cb();
  }

  resolveChoicePick(index: number, times = 1): void {
    const cb = this.pickChoice;
    if (!cb) return;
    this.pickChoice = undefined;
    this.cancelChoice = undefined;
    this.busy = false;
    for (let i = 0; i < times; i += 1) cb(index);
  }

  resolveChoiceCancel(times = 1): void {
    const cb = this.cancelChoice;
    if (!cb) return;
    this.pickChoice = undefined;
    this.cancelChoice = undefined;
    this.busy = false;
    for (let i = 0; i < times; i += 1) cb();
  }

  resolveShop(times = 1): void {
    const cb = this.shopDone;
    if (!cb) return;
    this.shopDone = undefined;
    this.busy = false;
    for (let i = 0; i < times; i += 1) cb();
  }

  resolveBattle(outcome: BattleOutcome, times = 1): void {
    const cb = this.battleDone;
    if (!cb) return;
    this.battleDone = undefined;
    this.busy = false;
    for (let i = 0; i < times; i += 1) cb(outcome);
  }

  resolveCutscene(times = 1): void {
    const cb = this.cutsceneDone;
    if (!cb) return;
    this.cutsceneDone = undefined;
    this.busy = false;
    for (let i = 0; i < times; i += 1) cb();
  }
}

function frame(runner: ScriptRunner, host: FakeHost, count = 1): void {
  for (let i = 0; i < count; i += 1) runner.update(host);
}

describe('ScriptRunner', () => {
  it('runs instant commands in one frame', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      { t: 'setFlag', flag: 'a' },
      { t: 'giveItem', item: 'mockball', count: 2 },
      { t: 'takeItem', item: 'mockball', count: 1 },
      { t: 'money', delta: 50 },
      { t: 'warp', map: 'route1', x: 1, y: 2 },
    ]);
    frame(runner, host);
    expect(host.getFlag('a')).toBe(true);
    expect(host.items.get('mockball')).toBe(1);
    expect(host.money).toBe(50);
    expect(host.warps).toEqual([{ map: 'route1', x: 1, y: 2 }]);
    expect(runner.running).toBe(false);
  });

  it('stops at first blocking command', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      { t: 'say', lines: ['A'] },
      { t: 'setFlag', flag: 'after' },
    ]);
    frame(runner, host);
    expect(host.calls).toEqual(['say:["A"]']);
    expect(host.getFlag('after')).toBe(false);
    expect(runner.running).toBe(true);
  });

  it('resumes say on later frame', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      { t: 'say', lines: ['A'] },
      { t: 'setFlag', flag: 'after' },
    ]);
    frame(runner, host);
    host.resolveSay();
    frame(runner, host);
    expect(host.getFlag('after')).toBe(true);
    expect(runner.running).toBe(false);
  });

  it('does nothing while host is busy', () => {
    const host = new FakeHost();
    host.busy = true;
    const runner = new ScriptRunner();
    runner.run([{ t: 'setFlag', flag: 'x' }]);
    frame(runner, host);
    expect(host.getFlag('x')).toBe(false);
    expect(runner.running).toBe(true);
  });

  it('wait counts down in frames', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      { t: 'wait', frames: 2 },
      { t: 'setFlag', flag: 'done' },
    ]);
    frame(runner, host);
    expect(host.getFlag('done')).toBe(false);
    frame(runner, host);
    expect(host.getFlag('done')).toBe(false);
    frame(runner, host);
    expect(host.getFlag('done')).toBe(true);
    expect(runner.running).toBe(false);
  });

  it('if true prepends then branch', () => {
    const host = new FakeHost();
    host.flags.set('ok', true);
    const runner = new ScriptRunner();
    runner.run([
      { t: 'if', flag: 'ok', then: [{ t: 'setFlag', flag: 'then' }] },
      { t: 'setFlag', flag: 'tail' },
    ]);
    frame(runner, host);
    expect(host.calls).toEqual(['setFlag:then:true', 'setFlag:tail:true']);
  });

  it('if false uses else branch', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      { t: 'if', flag: 'ok', then: [{ t: 'setFlag', flag: 'then' }], else: [{ t: 'setFlag', flag: 'else' }] },
    ]);
    frame(runner, host);
    expect(host.getFlag('then')).toBe(false);
    expect(host.getFlag('else')).toBe(true);
  });

  it('ifHasItem true path and default count', () => {
    const host = new FakeHost();
    host.items.set('potion', 1);
    const runner = new ScriptRunner();
    runner.run([
      { t: 'ifHasItem', item: 'potion', then: [{ t: 'setFlag', flag: 'yes' }], else: [{ t: 'setFlag', flag: 'no' }] },
    ]);
    frame(runner, host);
    expect(host.getFlag('yes')).toBe(true);
    expect(host.getFlag('no')).toBe(false);
  });

  it('ifHasItem false path with required count', () => {
    const host = new FakeHost();
    host.items.set('potion', 1);
    const runner = new ScriptRunner();
    runner.run([
      {
        t: 'ifHasItem',
        item: 'potion',
        count: 2,
        then: [{ t: 'setFlag', flag: 'yes' }],
        else: [{ t: 'setFlag', flag: 'no' }],
      },
    ]);
    frame(runner, host);
    expect(host.getFlag('yes')).toBe(false);
    expect(host.getFlag('no')).toBe(true);
  });

  it('ifQuest matches active state and stage', () => {
    const host = new FakeHost();
    host.quests.set('q1', { active: true, done: false, stage: 'alpha' });
    const runner = new ScriptRunner();
    runner.run([
      {
        t: 'ifQuest',
        quest: 'q1',
        state: 'active',
        stage: 'alpha',
        then: [{ t: 'setFlag', flag: 'pass' }],
        else: [{ t: 'setFlag', flag: 'fail' }],
      },
    ]);
    frame(runner, host);
    expect(host.getFlag('pass')).toBe(true);
    expect(host.getFlag('fail')).toBe(false);
  });

  it('ifQuest matches done state', () => {
    const host = new FakeHost();
    host.quests.set('q1', { active: false, done: true, stage: 'omega' });
    const runner = new ScriptRunner();
    runner.run([
      {
        t: 'ifQuest',
        quest: 'q1',
        state: 'done',
        then: [{ t: 'setFlag', flag: 'done' }],
        else: [{ t: 'setFlag', flag: 'notDone' }],
      },
    ]);
    frame(runner, host);
    expect(host.getFlag('done')).toBe(true);
    expect(host.getFlag('notDone')).toBe(false);
  });

  it('ifQuest matches none state', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      {
        t: 'ifQuest',
        quest: 'missing',
        state: 'none',
        then: [{ t: 'setFlag', flag: 'none' }],
        else: [{ t: 'setFlag', flag: 'exists' }],
      },
    ]);
    frame(runner, host);
    expect(host.getFlag('none')).toBe(true);
    expect(host.getFlag('exists')).toBe(false);
  });

  it('choice pick prepends selected branch', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      {
        t: 'choice',
        title: 'Pick',
        options: [
          { label: 'A', then: [{ t: 'setFlag', flag: 'a' }] },
          { label: 'B', then: [{ t: 'setFlag', flag: 'b' }] },
        ],
      },
    ]);
    frame(runner, host);
    host.resolveChoicePick(1);
    frame(runner, host);
    expect(host.getFlag('a')).toBe(false);
    expect(host.getFlag('b')).toBe(true);
  });

  it('choice cancel uses onCancel branch', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      {
        t: 'choice',
        title: 'Pick',
        options: [{ label: 'A', then: [{ t: 'setFlag', flag: 'a' }] }],
        onCancel: [{ t: 'setFlag', flag: 'c' }],
      },
    ]);
    frame(runner, host);
    host.resolveChoiceCancel();
    frame(runner, host);
    expect(host.getFlag('a')).toBe(false);
    expect(host.getFlag('c')).toBe(true);
  });

  it('supports deep nested choice-if-choice composition', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      {
        t: 'choice',
        title: 'Outer',
        options: [
          {
            label: 'Go',
            then: [
              {
                t: 'if',
                flag: 'gate',
                then: [
                  {
                    t: 'choice',
                    title: 'Inner',
                    options: [{ label: 'Yes', then: [{ t: 'setFlag', flag: 'deep' }] }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
    host.flags.set('gate', true);
    frame(runner, host);
    host.resolveChoicePick(0);
    frame(runner, host);
    host.resolveChoicePick(0);
    frame(runner, host);
    expect(host.getFlag('deep')).toBe(true);
    expect(runner.running).toBe(false);
  });

  it('battle win runs onWin branch', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      {
        t: 'battle',
        trainer: 'rival',
        onWin: [{ t: 'setFlag', flag: 'won' }],
        onLose: [{ t: 'setFlag', flag: 'lost' }],
      },
    ]);
    frame(runner, host);
    host.resolveBattle('win');
    frame(runner, host);
    expect(host.getFlag('won')).toBe(true);
    expect(host.getFlag('lost')).toBe(false);
  });

  it('battle lose runs onLose branch', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      {
        t: 'battle',
        trainer: 'rival',
        onWin: [{ t: 'setFlag', flag: 'won' }],
        onLose: [{ t: 'setFlag', flag: 'lost' }],
      },
    ]);
    frame(runner, host);
    host.resolveBattle('lose');
    frame(runner, host);
    expect(host.getFlag('won')).toBe(false);
    expect(host.getFlag('lost')).toBe(true);
  });

  it('battle non-win-lose continues without branch', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      {
        t: 'battle',
        trainer: 'rival',
        onWin: [{ t: 'setFlag', flag: 'won' }],
        onLose: [{ t: 'setFlag', flag: 'lost' }],
      },
      { t: 'setFlag', flag: 'tail' },
    ]);
    frame(runner, host);
    host.resolveBattle('run');
    frame(runner, host);
    expect(host.getFlag('won')).toBe(false);
    expect(host.getFlag('lost')).toBe(false);
    expect(host.getFlag('tail')).toBe(true);
  });

  it('shop blocks and resumes', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      { t: 'shop', stock: ['mockball', 'potion'] },
      { t: 'setFlag', flag: 'after' },
    ]);
    frame(runner, host);
    expect(host.getFlag('after')).toBe(false);
    host.resolveShop();
    frame(runner, host);
    expect(host.getFlag('after')).toBe(true);
  });

  it('cutscene blocks and resumes', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      { t: 'cutscene', id: 'intro' },
      { t: 'setFlag', flag: 'after' },
    ]);
    frame(runner, host);
    expect(host.getFlag('after')).toBe(false);
    host.resolveCutscene();
    frame(runner, host);
    expect(host.getFlag('after')).toBe(true);
  });

  it('done callback called twice does not double-advance', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      { t: 'say', lines: ['A'] },
      { t: 'giveItem', item: 'potion', count: 1 },
    ]);
    frame(runner, host);
    host.resolveSay(2);
    frame(runner, host);
    expect(host.items.get('potion')).toBe(1);
    expect(host.calls.filter((c) => c.startsWith('giveItem:')).length).toBe(1);
  });

  it('run while running is ignored', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([{ t: 'say', lines: ['A'] }]);
    runner.run([{ t: 'setFlag', flag: 'new' }]);
    frame(runner, host);
    expect(host.calls).toEqual(['say:["A"]']);
    expect(host.getFlag('new')).toBe(false);
  });

  it('abort clears queue and pending', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      { t: 'say', lines: ['A'] },
      { t: 'setFlag', flag: 'after' },
    ]);
    frame(runner, host);
    runner.abort();
    host.resolveSay();
    frame(runner, host);
    expect(host.getFlag('after')).toBe(false);
    expect(runner.running).toBe(false);
  });

  it('running becomes false on same update as final instant command', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([{ t: 'setFlag', flag: 'only' }]);
    frame(runner, host);
    expect(host.getFlag('only')).toBe(true);
    expect(runner.running).toBe(false);
  });

  it('unknown command is skipped and does not hang', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    const bogus = { t: 'bogus' } as unknown as ScriptCmd;
    runner.run([bogus, { t: 'setFlag', flag: 'after' }]);
    frame(runner, host);
    expect(host.getFlag('after')).toBe(true);
    expect(runner.running).toBe(false);
  });

  it('default values work for setFlag, giveItem, takeItem', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      { t: 'setFlag', flag: 'x' },
      { t: 'giveItem', item: 'mockball' },
      { t: 'takeItem', item: 'mockball' },
    ]);
    frame(runner, host);
    expect(host.getFlag('x')).toBe(true);
    expect(host.items.get('mockball')).toBe(0);
  });

  it('invokes call and creature/quest commands', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run([
      { t: 'giveMon', species: 'sproutle', level: 5 },
      { t: 'giveEgg', species: 'pebblit' },
      { t: 'healParty' },
      { t: 'setHealPoint' },
      { t: 'questStart', quest: 'q1' },
      { t: 'questAdvance', quest: 'q1', stage: 'mid' },
      { t: 'questComplete', quest: 'q1' },
      { t: 'call', fn: (h) => h.setFlag('called', true) },
    ]);
    frame(runner, host);
    expect(host.party).toEqual([{ species: 'sproutle', level: 5 }]);
    expect(host.eggs).toEqual(['pebblit']);
    expect(host.healPartyCount).toBe(1);
    expect(host.healPointCount).toBe(1);
    expect(host.questState('q1')).toEqual({ active: false, done: true, stage: 'mid' });
    expect(host.getFlag('called')).toBe(true);
  });

  it('SCRIPTS.mock_center_nurse call sequence matches', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run(SCRIPTS.mock_center_nurse);
    frame(runner, host);
    host.resolveSay();
    frame(runner, host);
    host.resolveSay();
    frame(runner, host);
    expect(host.calls).toEqual([
      'say:["NURSE: Welcome to the Mock Center! Let me heal your Mockemon to full health!","NURSE: ... ... ..."]',
      'healParty',
      'setHealPoint',
      'say:["NURSE: All healed! We hope to see you again!"]',
    ]);
  });

  it('SCRIPTS.ball_giver first-time sequence matches', () => {
    const host = new FakeHost();
    const runner = new ScriptRunner();
    runner.run(SCRIPTS.ball_giver);
    frame(runner, host);
    host.resolveSay();
    frame(runner, host);
    host.resolveSay();
    frame(runner, host);
    expect(host.calls).toEqual([
      'say:["OLD MAN: Off to Route 1? A trainer needs MockBalls to catch Mockemon!"]',
      'giveItem:mockball:5',
      'giveItem:potion:2',
      'setFlag:gotBalls:true',
      'questComplete:parcel',
      'questAdvance:main_journey:badge1',
      'say:["You received 5 MockBalls and 2 Potions!","OLD MAN: Weaken a wild Mockemon first, then throw the ball. Works even better if they are asleep or paralyzed!"]',
    ]);
  });

  it('SCRIPTS.ball_giver repeat path uses already-got line', () => {
    const host = new FakeHost();
    host.flags.set('gotBalls', true);
    const runner = new ScriptRunner();
    runner.run(SCRIPTS.ball_giver);
    frame(runner, host);
    host.resolveSay();
    frame(runner, host);
    expect(host.calls).toEqual(['say:["OLD MAN: Catch anything good yet?"]']);
  });
});
