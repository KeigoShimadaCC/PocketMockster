import { MOVES, type MoveDef } from './data/moves';
import { SPECIES } from './data/species';
import { effectiveness } from './data/types';
import { def, evolve, gainExp, type Mockemon } from './mockemon';
import { chance, rand, randInt } from './rng';

export interface TrainerDef {
  name: string;
  spriteKey: string;
  party: Mockemon[];
  prize: number;
  introText: string;
  defeatText: string;
}

export type BattleKind = { kind: 'wild'; mon: Mockemon } | { kind: 'trainer'; trainer: TrainerDef };

export type PlayerAction =
  | { type: 'move'; index: number }
  | { type: 'switch'; index: number }
  | { type: 'item'; item: 'potion' | 'superpotion' | 'mockball' }
  | { type: 'run' };

interface Stages {
  atk: number;
  def: number;
  spe: number;
}

const zeroStages = (): Stages => ({ atk: 0, def: 0, spe: 0 });

function stageMult(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

export type BattleOutcome = 'win' | 'lose' | 'run' | 'caught' | null;

export class Battle {
  party: Mockemon[];
  activeIndex = 0;
  enemyParty: Mockemon[];
  enemyIndex = 0;
  isTrainer: boolean;
  trainer: TrainerDef | null;
  playerStages: Stages = zeroStages();
  enemyStages: Stages = zeroStages();
  outcome: BattleOutcome = null;
  needsSwitch = false;
  runAttempts = 0;
  caughtMon: Mockemon | null = null;
  expEarnedBy = new Set<number>();

  constructor(party: Mockemon[], enemy: BattleKind) {
    this.party = party;
    if (enemy.kind === 'wild') {
      this.enemyParty = [enemy.mon];
      this.isTrainer = false;
      this.trainer = null;
    } else {
      this.enemyParty = enemy.trainer.party;
      this.isTrainer = true;
      this.trainer = enemy.trainer;
    }
    const firstAlive = this.party.findIndex((m) => m.hp > 0);
    this.activeIndex = firstAlive < 0 ? 0 : firstAlive;
  }

  get active(): Mockemon {
    return this.party[this.activeIndex];
  }

  get enemy(): Mockemon {
    return this.enemyParty[this.enemyIndex];
  }

  effectiveSpe(m: Mockemon, stages: Stages): number {
    let spe = m.spe * stageMult(stages.spe);
    if (m.status === 'PAR') spe *= 0.5;
    return spe;
  }

  private damage(attacker: Mockemon, defender: Mockemon, move: MoveDef, atkStages: Stages, defStages: Stages, msgs: string[]): number {
    const isPhys = move.category === 'physical';
    let a = isPhys ? attacker.atk * stageMult(atkStages.atk) : attacker.spa;
    const d = isPhys ? defender.def * stageMult(defStages.def) : defender.spd;
    if (isPhys && attacker.status === 'BRN') a *= 0.5;
    const crit = chance(1 / 16);
    const base = Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * move.power * (a / d)) / 50) + 2;
    const stab = def(attacker).types.includes(move.type) ? 1.5 : 1;
    const eff = effectiveness(move.type, SPECIES[defender.species].types);
    const roll = 0.85 + rand() * 0.15;
    let dmg = Math.floor(base * stab * eff * roll * (crit ? 1.5 : 1));
    if (eff > 0) dmg = Math.max(1, dmg);
    if (crit && eff > 0) msgs.push('A critical hit!');
    if (eff === 0) msgs.push(`It doesn't affect ${defender.nickname}...`);
    else if (eff > 1) msgs.push("It's super effective!");
    else if (eff < 1) msgs.push("It's not very effective...");
    return eff === 0 ? 0 : dmg;
  }

  private applyStatChange(move: MoveDef, user: Mockemon, target: Mockemon, userStages: Stages, targetStages: Stages, msgs: string[]): void {
    const sc = move.statChange;
    if (!sc || !chance(sc.chance)) return;
    const stages = sc.target === 'self' ? userStages : targetStages;
    const who = sc.target === 'self' ? user.nickname : target.nickname;
    const before = stages[sc.stat];
    stages[sc.stat] = Math.max(-6, Math.min(6, before + sc.stages));
    if (stages[sc.stat] === before) {
      msgs.push(`${who}'s stats won't go any ${sc.stages > 0 ? 'higher' : 'lower'}!`);
      return;
    }
    const statName = { atk: 'Attack', def: 'Defense', spe: 'Speed' }[sc.stat];
    msgs.push(`${who}'s ${statName} ${sc.stages > 0 ? 'rose' : 'fell'}!`);
  }

  private applyStatus(move: MoveDef, target: Mockemon, msgs: string[]): void {
    const st = move.status;
    if (!st || target.hp <= 0) return;
    if (move.category === 'status' || chance(st.chance)) {
      if (target.status) {
        if (move.category === 'status') msgs.push(`But it failed!`);
        return;
      }
      const eff = effectiveness(move.type, SPECIES[target.species].types);
      if (move.category === 'status' && eff === 0) {
        msgs.push(`It doesn't affect ${target.nickname}...`);
        return;
      }
      target.status = st.id;
      if (st.id === 'SLP') target.sleepTurns = randInt(1, 3);
      const text = { PAR: 'was paralyzed!', BRN: 'was burned!', PSN: 'was poisoned!', SLP: 'fell asleep!' }[st.id];
      msgs.push(`${target.nickname} ${text}`);
    }
  }

  private canAct(m: Mockemon, msgs: string[]): boolean {
    if (m.status === 'SLP') {
      if (m.sleepTurns > 0) {
        m.sleepTurns--;
        msgs.push(`${m.nickname} is fast asleep.`);
        return false;
      }
      m.status = null;
      msgs.push(`${m.nickname} woke up!`);
    }
    if (m.status === 'PAR' && chance(0.25)) {
      msgs.push(`${m.nickname} is paralyzed! It can't move!`);
      return false;
    }
    return true;
  }

  private useMove(attacker: Mockemon, defender: Mockemon, moveId: string, atkStages: Stages, defStages: Stages, msgs: string[]): void {
    const move = MOVES[moveId];
    msgs.push(`${attacker.nickname} used ${move.name}!`);
    if (move.accuracy < 999 && !chance(move.accuracy / 100)) {
      msgs.push(`${attacker.nickname}'s attack missed!`);
      return;
    }
    if (move.category === 'status') {
      this.applyStatChange(move, attacker, defender, atkStages, defStages, msgs);
      this.applyStatus(move, defender, msgs);
      return;
    }
    const dmg = this.damage(attacker, defender, move, atkStages, defStages, msgs);
    defender.hp = Math.max(0, defender.hp - dmg);
    if (defender.hp > 0) {
      this.applyStatChange(move, attacker, defender, atkStages, defStages, msgs);
      this.applyStatus(move, defender, msgs);
    }
  }

  private endOfTurn(m: Mockemon, msgs: string[]): void {
    if (m.hp <= 0) return;
    if (m.status === 'BRN') {
      m.hp = Math.max(0, m.hp - Math.max(1, Math.floor(m.maxHp / 8)));
      msgs.push(`${m.nickname} is hurt by its burn!`);
    } else if (m.status === 'PSN') {
      m.hp = Math.max(0, m.hp - Math.max(1, Math.floor(m.maxHp / 8)));
      msgs.push(`${m.nickname} is hurt by poison!`);
    }
  }

  private enemyPickMove(): string {
    const usable = this.enemy.moves.filter((ms) => ms.pp > 0);
    if (usable.length === 0) return 'tackle';
    let best = usable[0].id;
    let bestScore = -1;
    for (const ms of usable) {
      const mv = MOVES[ms.id];
      let score: number;
      if (mv.category === 'status') {
        score = this.enemy.hp > this.enemy.maxHp * 0.7 ? 45 : 10;
        if (mv.status && this.active.status) score = 0;
      } else {
        score = mv.power * effectiveness(mv.type, def(this.active).types);
        if (def(this.enemy).types.includes(mv.type)) score *= 1.5;
      }
      score *= 0.85 + rand() * 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = ms.id;
      }
    }
    return best;
  }

  private grantExp(msgs: string[]): void {
    const fainted = this.enemy;
    const gain = Math.max(1, Math.floor((SPECIES[fainted.species].expYield * fainted.level) / 7) * (this.isTrainer ? 1.5 : 1));
    const m = this.active;
    msgs.push(`${m.nickname} gained ${Math.floor(gain)} EXP!`);
    const res = gainExp(m, Math.floor(gain));
    if (res.leveled) {
      msgs.push(`${m.nickname} grew to level ${res.newLevel}!`);
      for (const learned of res.learned) msgs.push(`${m.nickname} learned ${learned}!`);
      if (res.evolvedTo) {
        const oldName = m.nickname;
        evolve(m, res.evolvedTo);
        msgs.push(`What? ${oldName} is evolving... ${oldName} evolved into ${SPECIES[res.evolvedTo].name}!`);
      }
    }
  }

  private handleEnemyFaint(msgs: string[]): void {
    msgs.push(`Foe ${this.enemy.nickname} fainted!`);
    this.grantExp(msgs);
    if (this.isTrainer) {
      const next = this.enemyParty.findIndex((m) => m.hp > 0);
      if (next >= 0) {
        this.enemyIndex = next;
        this.enemyStages = zeroStages();
        msgs.push(`${this.trainer!.name} sent out ${this.enemy.nickname}!`);
        return;
      }
    }
    this.outcome = 'win';
  }

  private handlePlayerFaint(msgs: string[]): void {
    msgs.push(`${this.active.nickname} fainted!`);
    const anyAlive = this.party.some((m) => m.hp > 0);
    if (!anyAlive) {
      this.outcome = 'lose';
      msgs.push('You have no more Mockemon that can fight!');
      msgs.push('You blacked out!');
    } else {
      this.needsSwitch = true;
    }
  }

  private tryCatch(msgs: string[]): void {
    if (this.isTrainer) {
      msgs.push("You can't catch another trainer's Mockemon!");
      return;
    }
    const t = this.enemy;
    msgs.push(`You threw a MockBall!`);
    const statusBonus = t.status === 'SLP' ? 2 : t.status ? 1.5 : 1;
    const a = Math.min(255, ((3 * t.maxHp - 2 * t.hp) * SPECIES[t.species].catchRate * statusBonus) / (3 * t.maxHp));
    if (randInt(0, 254) < a) {
      msgs.push('Shake... shake... shake... Click!');
      msgs.push(`Gotcha! ${t.nickname} was caught!`);
      this.caughtMon = t;
      this.outcome = 'caught';
    } else {
      const shakes = a > 180 ? 3 : a > 100 ? 2 : a > 40 ? 1 : 0;
      msgs.push('Shake...'.repeat(Math.max(1, shakes)) + ' Oh no! It broke free!');
    }
  }

  private tryRun(msgs: string[]): boolean {
    if (this.isTrainer) {
      msgs.push("You can't run from a trainer battle!");
      return false;
    }
    this.runAttempts++;
    const mySpe = this.effectiveSpe(this.active, this.playerStages);
    const foeSpe = this.effectiveSpe(this.enemy, this.enemyStages);
    const ok = mySpe >= foeSpe || chance(0.5 + this.runAttempts * 0.15);
    if (ok) {
      msgs.push('Got away safely!');
      this.outcome = 'run';
      return true;
    }
    msgs.push("Can't escape!");
    return false;
  }

  forcedSwitch(index: number, msgs: string[]): void {
    this.activeIndex = index;
    this.playerStages = zeroStages();
    this.needsSwitch = false;
    msgs.push(`Go, ${this.active.nickname}!`);
  }

  takeTurn(action: PlayerAction): string[] {
    const msgs: string[] = [];
    if (this.outcome) return msgs;

    let playerMoveId: string | null = null;
    let playerActs = false;

    if (action.type === 'run') {
      if (this.tryRun(msgs)) return msgs;
    } else if (action.type === 'switch') {
      const target = this.party[action.index];
      if (!target || target.hp <= 0 || action.index === this.activeIndex) {
        msgs.push("Can't switch to that Mockemon!");
        return msgs;
      }
      msgs.push(`${this.active.nickname}, come back!`);
      this.activeIndex = action.index;
      this.playerStages = zeroStages();
      msgs.push(`Go, ${this.active.nickname}!`);
    } else if (action.type === 'item') {
      if (action.item === 'mockball') {
        this.tryCatch(msgs);
        if (this.outcome) return msgs;
      } else {
        const heal = action.item === 'potion' ? 20 : 50;
        const before = this.active.hp;
        this.active.hp = Math.min(this.active.maxHp, this.active.hp + heal);
        msgs.push(`${this.active.nickname} recovered ${this.active.hp - before} HP!`);
      }
    } else {
      const slot = this.active.moves[action.index];
      if (!slot || slot.pp <= 0) {
        msgs.push('No PP left for this move!');
        return msgs;
      }
      playerMoveId = slot.id;
      playerActs = true;
    }

    const enemyMoveId = this.enemyPickMove();

    let playerFirst = true;
    if (playerActs && playerMoveId) {
      const pPri = MOVES[playerMoveId].priority ?? 0;
      const ePri = MOVES[enemyMoveId].priority ?? 0;
      if (pPri !== ePri) playerFirst = pPri > ePri;
      else {
        const mySpe = this.effectiveSpe(this.active, this.playerStages);
        const foeSpe = this.effectiveSpe(this.enemy, this.enemyStages);
        playerFirst = mySpe === foeSpe ? chance(0.5) : mySpe > foeSpe;
      }
    } else {
      playerFirst = false;
    }

    const playerAct = (): void => {
      if (!playerActs || !playerMoveId || this.active.hp <= 0 || this.enemy.hp <= 0) return;
      if (!this.canAct(this.active, msgs)) return;
      const slot = this.active.moves.find((ms) => ms.id === playerMoveId)!;
      slot.pp--;
      this.useMove(this.active, this.enemy, playerMoveId, this.playerStages, this.enemyStages, msgs);
    };

    const enemyAct = (): void => {
      if (this.enemy.hp <= 0 || this.active.hp <= 0 || this.outcome) return;
      if (!this.canAct(this.enemy, msgs)) return;
      const slot = this.enemy.moves.find((ms) => ms.id === enemyMoveId);
      if (slot) slot.pp--;
      this.useMove(this.enemy, this.active, enemyMoveId, this.enemyStages, this.playerStages, msgs);
    };

    if (playerFirst) {
      playerAct();
      if (this.enemy.hp <= 0) {
        this.handleEnemyFaint(msgs);
        if (this.outcome) return msgs;
      } else {
        enemyAct();
      }
    } else {
      enemyAct();
      if (this.active.hp > 0) {
        playerAct();
        if (this.enemy.hp <= 0) {
          this.handleEnemyFaint(msgs);
          if (this.outcome) return msgs;
        }
      }
    }

    this.endOfTurn(this.active, msgs);
    this.endOfTurn(this.enemy, msgs);

    if (this.enemy.hp <= 0 && !this.outcome) {
      this.handleEnemyFaint(msgs);
      if (this.outcome) return msgs;
    }
    if (this.active.hp <= 0 && !this.outcome) {
      this.handlePlayerFaint(msgs);
    }
    return msgs;
  }
}
