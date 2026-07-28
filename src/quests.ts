export interface QuestStage {
  id: string;
  objective: string;
  journal: string;
}

export interface QuestReward {
  item?: string;
  count?: number;
  money?: number;
  mon?: { species: string; level: number };
}

export interface QuestDef {
  id: string;
  title: string;
  kind: 'main' | 'side';
  act: number;
  stages: QuestStage[];
  reward?: QuestReward;
  giver?: string;
}

export type QuestProgress = Record<string, { stage: number; done: boolean }>;

export class QuestLog {
  private readonly defs: Record<string, QuestDef>;
  private readonly progress: QuestProgress;

  constructor(defs: Record<string, QuestDef>, progress: QuestProgress = {}) {
    this.defs = defs;
    this.progress = {};
    for (const [id, state] of Object.entries(progress)) {
      this.progress[id] = {
        stage: Number.isFinite(state.stage) ? Math.trunc(state.stage) : -1,
        done: Boolean(state.done),
      };
    }
  }

  start(id: string): void {
    const def = this.defs[id];
    if (!def) return;
    const current = this.progress[id];
    if (!current) {
      this.progress[id] = { stage: 0, done: false };
      return;
    }
    if (current.done) return;
  }

  advance(id: string, stage?: string): void {
    const def = this.defs[id];
    if (!def) return;
    if (!this.progress[id]) {
      this.progress[id] = { stage: 0, done: false };
    }
    const current = this.progress[id];
    if (!current || current.done) return;
    if (stage !== undefined) {
      const index = def.stages.findIndex((s) => s.id === stage);
      if (index < 0) return;
      current.stage = index;
      return;
    }
    current.stage += 1;
  }

  complete(id: string): void {
    const def = this.defs[id];
    if (!def) return;
    const current = this.progress[id];
    if (!current) {
      this.progress[id] = { stage: -1, done: true };
      return;
    }
    current.done = true;
  }

  state(id: string): { active: boolean; done: boolean; stage: string | null } {
    const def = this.defs[id];
    if (!def) {
      return { active: false, done: false, stage: null };
    }
    const current = this.progress[id];
    if (!current) {
      return { active: false, done: false, stage: null };
    }
    const stage = this.stageIdAt(def, current.stage);
    if (current.done) {
      return { active: false, done: true, stage };
    }
    return { active: true, done: false, stage };
  }

  stageIndex(id: string): number {
    const def = this.defs[id];
    if (!def) return -1;
    const current = this.progress[id];
    if (!current) return -1;
    return current.stage;
  }

  active(): QuestDef[] {
    const list: QuestDef[] = [];
    for (const [id, state] of Object.entries(this.progress)) {
      if (state.done) continue;
      const def = this.defs[id];
      if (!def) continue;
      list.push(def);
    }
    return list.sort(this.sortDefs);
  }

  completed(): QuestDef[] {
    const list: QuestDef[] = [];
    for (const [id, state] of Object.entries(this.progress)) {
      if (!state.done) continue;
      const def = this.defs[id];
      if (!def) continue;
      list.push(def);
    }
    return list.sort(this.sortDefs);
  }

  nextObjective(): string | null {
    const activeMain = this.active().find((q) => q.kind === 'main');
    if (activeMain) {
      return this.currentObjective(activeMain.id);
    }
    const side = this.active().find((q) => q.kind === 'side');
    if (!side) return null;
    return this.currentObjective(side.id);
  }

  journal(id: string): string[] {
    const def = this.defs[id];
    if (!def) return [];
    const current = this.progress[id];
    if (!current) return [];
    if (current.stage < 0) return [];
    const end = Math.min(current.stage, def.stages.length - 1);
    if (end < 0) return [];
    return def.stages.slice(0, end + 1).map((s) => s.journal);
  }

  toJSON(): QuestProgress {
    const out: QuestProgress = {};
    for (const [id, state] of Object.entries(this.progress)) {
      out[id] = { stage: state.stage, done: state.done };
    }
    return out;
  }

  private currentObjective(id: string): string | null {
    const def = this.defs[id];
    if (!def) return null;
    const current = this.progress[id];
    if (!current || current.done) return null;
    const stage = def.stages[current.stage];
    return stage?.objective ?? null;
  }

  private stageIdAt(def: QuestDef, index: number): string | null {
    const stage = def.stages[index];
    return stage?.id ?? null;
  }

  private sortDefs = (a: QuestDef, b: QuestDef): number => {
    const kindRankA = a.kind === 'main' ? 0 : 1;
    const kindRankB = b.kind === 'main' ? 0 : 1;
    if (kindRankA !== kindRankB) return kindRankA - kindRankB;
    if (a.act !== b.act) return a.act - b.act;
    return a.id.localeCompare(b.id);
  };
}
