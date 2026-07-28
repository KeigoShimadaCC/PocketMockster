export type ScriptCmd =
  | { t: 'say'; lines: string[] }
  | { t: 'choice'; title: string; options: { label: string; then: ScriptCmd[] }[]; onCancel?: ScriptCmd[] }
  | { t: 'setFlag'; flag: string; value?: boolean }
  | { t: 'if'; flag: string; then: ScriptCmd[]; else?: ScriptCmd[] }
  | { t: 'ifHasItem'; item: string; count?: number; then: ScriptCmd[]; else?: ScriptCmd[] }
  | { t: 'ifQuest'; quest: string; stage?: string; state?: 'active' | 'done' | 'none'; then: ScriptCmd[]; else?: ScriptCmd[] }
  | { t: 'giveItem'; item: string; count?: number }
  | { t: 'takeItem'; item: string; count?: number }
  | { t: 'giveMon'; species: string; level: number }
  | { t: 'giveEgg'; species: string }
  | { t: 'money'; delta: number }
  | { t: 'healParty' }
  | { t: 'setHealPoint' }
  | { t: 'shop'; stock?: string[] }
  | { t: 'battle'; trainer: string; onWin?: ScriptCmd[]; onLose?: ScriptCmd[] }
  | { t: 'warp'; map: string; x: number; y: number }
  | { t: 'wait'; frames: number }
  | { t: 'questStart'; quest: string }
  | { t: 'questAdvance'; quest: string; stage?: string }
  | { t: 'questComplete'; quest: string }
  | { t: 'cutscene'; id: string }
  | { t: 'call'; fn: (host: ScriptHost) => void };

export interface ScriptHost {
  isBusy(): boolean;
  say(lines: string[], done: () => void): void;
  choose(title: string, labels: string[], onPick: (index: number) => void, onCancel: () => void): void;
  getFlag(flag: string): boolean;
  setFlag(flag: string, value: boolean): void;
  hasItem(item: string, count: number): boolean;
  giveItem(item: string, count: number): void;
  takeItem(item: string, count: number): void;
  giveMon(species: string, level: number): void;
  giveEgg(species: string): void;
  changeMoney(delta: number): void;
  healParty(): void;
  setHealPoint(): void;
  openShop(stock: string[] | undefined, done: () => void): void;
  startBattle(trainerId: string, done: (outcome: 'win' | 'lose' | 'run' | 'caught' | null) => void): void;
  warp(map: string, x: number, y: number): void;
  questState(quest: string): { active: boolean; done: boolean; stage: string | null };
  questStart(quest: string): void;
  questAdvance(quest: string, stage?: string): void;
  questComplete(quest: string): void;
  playCutscene(id: string, done: () => void): void;
}

type WaitPending = { kind: 'wait'; frames: number };
type AsyncPending = { kind: 'async'; token: number; resolved: boolean };
type Pending = WaitPending | AsyncPending;

export class ScriptRunner {
  private queue: ScriptCmd[] = [];
  private pending: Pending | null = null;
  private isRunning = false;
  private nextToken = 1;

  get running(): boolean {
    return this.isRunning;
  }

  run(cmds: ScriptCmd[]): void {
    if (this.isRunning) return;
    this.queue = [...cmds];
    this.pending = null;
    this.isRunning = this.queue.length > 0;
  }

  abort(): void {
    this.queue = [];
    this.pending = null;
    this.isRunning = false;
  }

  update(host: ScriptHost): void {
    if (!this.isRunning) return;

    if (this.pending?.kind === 'wait') {
      this.pending.frames -= 1;
      if (this.pending.frames > 0) return;
      this.pending = null;
    }

    if (this.pending?.kind === 'async') {
      if (!this.pending.resolved) return;
      this.pending = null;
    }

    while (this.isRunning && this.pending === null && !host.isBusy()) {
      const cmd = this.queue.shift();
      if (!cmd) {
        this.isRunning = false;
        return;
      }

      switch (cmd.t) {
        case 'say': {
          this.startAsync((done) => host.say(cmd.lines, done));
          return;
        }
        case 'choice': {
          this.startAsync((done) =>
            host.choose(
              cmd.title,
              cmd.options.map((o) => o.label),
              (index) => {
                const selected = cmd.options[index];
                if (selected) this.prepend(selected.then);
                done();
              },
              () => {
                if (cmd.onCancel) this.prepend(cmd.onCancel);
                done();
              },
            ),
          );
          return;
        }
        case 'setFlag':
          host.setFlag(cmd.flag, cmd.value ?? true);
          break;
        case 'if':
          this.prepend(host.getFlag(cmd.flag) ? cmd.then : (cmd.else ?? []));
          break;
        case 'ifHasItem':
          this.prepend(host.hasItem(cmd.item, cmd.count ?? 1) ? cmd.then : (cmd.else ?? []));
          break;
        case 'ifQuest': {
          const state = host.questState(cmd.quest);
          let ok = true;
          if (cmd.state === 'active') ok = state.active && !state.done;
          if (cmd.state === 'done') ok = state.done;
          if (cmd.state === 'none') ok = !state.active && !state.done;
          if (cmd.stage !== undefined) ok = ok && state.stage === cmd.stage;
          this.prepend(ok ? cmd.then : (cmd.else ?? []));
          break;
        }
        case 'giveItem':
          host.giveItem(cmd.item, cmd.count ?? 1);
          break;
        case 'takeItem':
          host.takeItem(cmd.item, cmd.count ?? 1);
          break;
        case 'giveMon':
          host.giveMon(cmd.species, cmd.level);
          break;
        case 'giveEgg':
          host.giveEgg(cmd.species);
          break;
        case 'money':
          host.changeMoney(cmd.delta);
          break;
        case 'healParty':
          host.healParty();
          break;
        case 'setHealPoint':
          host.setHealPoint();
          break;
        case 'shop':
          this.startAsync((done) => host.openShop(cmd.stock, done));
          return;
        case 'battle':
          this.startAsync((done) =>
            host.startBattle(cmd.trainer, (outcome) => {
              if (outcome === 'win' && cmd.onWin) this.prepend(cmd.onWin);
              if (outcome === 'lose' && cmd.onLose) this.prepend(cmd.onLose);
              done();
            }),
          );
          return;
        case 'warp':
          host.warp(cmd.map, cmd.x, cmd.y);
          break;
        case 'wait': {
          const frames = Math.floor(cmd.frames);
          if (frames > 0) {
            this.pending = { kind: 'wait', frames };
            return;
          }
          break;
        }
        case 'questStart':
          host.questStart(cmd.quest);
          break;
        case 'questAdvance':
          host.questAdvance(cmd.quest, cmd.stage);
          break;
        case 'questComplete':
          host.questComplete(cmd.quest);
          break;
        case 'cutscene':
          this.startAsync((done) => host.playCutscene(cmd.id, done));
          return;
        case 'call':
          cmd.fn(host);
          break;
        default:
          break;
      }
    }

    if (this.queue.length === 0 && this.pending === null) {
      this.isRunning = false;
    }
  }

  private prepend(cmds: ScriptCmd[]): void {
    if (cmds.length === 0) return;
    this.queue = [...cmds, ...this.queue];
  }

  private startAsync(register: (done: () => void) => void): void {
    const token = this.nextToken++;
    const pending: AsyncPending = { kind: 'async', token, resolved: false };
    this.pending = pending;
    register(() => {
      if (this.pending?.kind !== 'async') return;
      if (this.pending.token !== token) return;
      if (this.pending.resolved) return;
      this.pending.resolved = true;
    });
  }
}
