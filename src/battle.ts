import { MOVES, isContact, type HazardId, type MoveDef, type ScreenId, type StageStat, type TerrainId, type WeatherId } from './data/moves';
import { PINCH_ABILITIES } from './data/abilities';
import { ITEMS } from './data/items';
import { SPECIES } from './data/species';
import { effectiveness } from './data/types';
import { addEVs, changeFriendship, def, displayName, evolve, gainExp, type Mockemon } from './mockemon';
import { chance, rand, randInt } from './rng';

export type AiTier = 'basic' | 'smart' | 'leader';

export interface TrainerDef {
  name: string;
  spriteKey: string;
  party: Mockemon[];
  prize: number;
  introText: string;
  defeatText: string;
  ai?: AiTier;
  potions?: number; // super potions usable in battle (leaders)
}

export type BattleKind = { kind: 'wild'; mon: Mockemon } | { kind: 'trainer'; trainer: TrainerDef };

export type PlayerAction =
  | { type: 'move'; index: number }
  | { type: 'switch'; index: number }
  | { type: 'item'; item: 'potion' | 'superpotion' | 'mockball' }
  | { type: 'run' };

export type BattleOutcome = 'win' | 'lose' | 'run' | 'caught' | null;

type Side = 'player' | 'enemy';

interface SideState {
  stages: Record<StageStat, number>;
  confusionTurns: number;
  flinched: boolean;
  leechSeed: boolean;
  reflectTurns: number;
  lightScreenTurns: number;
  spikes: boolean;
  stealthRock: boolean;
  charging: string | null; // move id mid-two-turn
  choiceLock: string | null; // power band
  emberBoost: boolean;
  sashUsed: boolean;
  aiSetupUsed: boolean; // smart+ AI: one stat-move per switch-in
}

const zeroStages = (): Record<StageStat, number> => ({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 });

const freshSide = (): SideState => ({
  stages: zeroStages(),
  confusionTurns: 0,
  flinched: false,
  leechSeed: false,
  reflectTurns: 0,
  lightScreenTurns: 0,
  spikes: false,
  stealthRock: false,
  charging: null,
  choiceLock: null,
  emberBoost: false,
  sashUsed: false,
  aiSetupUsed: false,
});

function stageMult(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

function accMult(stage: number): number {
  return stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage);
}

const STATUS_TEXT: Record<string, string> = {
  PAR: 'was paralyzed! It may not move!',
  BRN: 'was burned!',
  PSN: 'was poisoned!',
  TOX: 'was badly poisoned!',
  SLP: 'fell asleep!',
  FRZ: 'was frozen solid!',
};

export class Battle {
  party: Mockemon[];
  activeIndex = 0;
  enemyParty: Mockemon[];
  enemyIndex = 0;
  isTrainer: boolean;
  trainer: TrainerDef | null;
  outcome: BattleOutcome = null;
  needsSwitch = false;
  runAttempts = 0;
  caughtMon: Mockemon | null = null;

  sides: Record<Side, SideState> = { player: freshSide(), enemy: freshSide() };
  weather: WeatherId | null = null;
  weatherTurns = 0;
  terrain: TerrainId | null = null;
  terrainTurns = 0;
  participants: Map<number, Set<number>> = new Map(); // enemy slot -> player party indices
  enemyPotions: number;

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
    this.enemyPotions = this.trainer?.potions ?? 0;
    const firstAlive = this.party.findIndex((m) => m.hp > 0 && !m.isEgg);
    this.activeIndex = firstAlive < 0 ? 0 : firstAlive;
    this.markParticipant();
  }

  get active(): Mockemon {
    return this.party[this.activeIndex];
  }

  get enemy(): Mockemon {
    return this.enemyParty[this.enemyIndex];
  }

  mon(side: Side): Mockemon {
    return side === 'player' ? this.active : this.enemy;
  }

  other(side: Side): Side {
    return side === 'player' ? 'enemy' : 'player';
  }

  private markParticipant(): void {
    if (!this.participants.has(this.enemyIndex)) this.participants.set(this.enemyIndex, new Set());
    this.participants.get(this.enemyIndex)!.add(this.activeIndex);
  }

  effectiveSpe(m: Mockemon, side: SideState): number {
    let spe = m.spe * stageMult(side.stages.spe);
    if (m.status === 'PAR') spe *= 0.5;
    return spe;
  }

  private atkStat(m: Mockemon, side: SideState, crit: boolean, isPhys: boolean): number {
    const stage = isPhys ? side.stages.atk : side.stages.spa;
    const s = crit ? Math.max(0, stage) : stage; // crit ignores attacker's negative stages
    let a = (isPhys ? m.atk : m.spa) * stageMult(s);
    if (isPhys && m.ability === 'musclebound') a *= 2;
    if (isPhys && m.heldItem === 'powerband') a *= 1.5;
    return a;
  }

  private defStat(m: Mockemon, side: SideState, crit: boolean, isPhys: boolean): number {
    const stage = isPhys ? side.stages.def : side.stages.spd;
    const s = crit ? Math.min(0, stage) : stage; // crit ignores defender's positive stages
    let d = (isPhys ? m.def : m.spd) * stageMult(s);
    if (this.weather === 'sand' && !isPhys && def(m).types.includes('Rock')) d *= 1.5;
    return d;
  }

  private typeEffectiveness(move: MoveDef, defender: Mockemon): number {
    if (move.typeless) return 1;
    return effectiveness(move.type, SPECIES[defender.species].types);
  }

  // Returns damage dealt (0 if none). Handles ability immunities/absorbs.
  private damage(user: Mockemon, target: Mockemon, move: MoveDef, userSide: Side, msgs: string[]): number {
    const uSide = this.sides[userSide];
    const tSide = this.sides[this.other(userSide)];
    let eff = this.typeEffectiveness(move, target);
    // ability-based immunities / absorptions
    if (move.type === 'Ground' && (target.ability === 'airborne') && eff > 0) {
      msgs.push(`${displayName(target)} is immune thanks to Airborne!`);
      return 0;
    }
    if (move.type === 'Water' && target.ability === 'sponge' && move.power > 0) {
      const heal = Math.max(1, Math.floor(target.maxHp / 4));
      target.hp = Math.min(target.maxHp, target.hp + heal);
      msgs.push(`${displayName(target)} absorbed the water with Sponge!`);
      return 0;
    }
    if (move.type === 'Fire' && target.ability === 'embergut' && move.power > 0) {
      tSide.emberBoost = true;
      msgs.push(`${displayName(target)} absorbed the flames with Ember Gut!`);
      return 0;
    }
    if (eff === 0) {
      msgs.push(`It doesn't affect ${displayName(target)}...`);
      return 0;
    }
    const isPhys = move.category === 'physical';
    const crit = chance(1 / 16);
    let a = this.atkStat(user, uSide, crit, isPhys);
    const d = Math.max(1, this.defStat(target, tSide, crit, isPhys));
    if (isPhys && user.status === 'BRN') a *= 0.5;
    const base = Math.floor((Math.floor((2 * user.level) / 5 + 2) * move.power * (a / d)) / 50) + 2;

    let mod = 1;
    // weather
    if (this.weather === 'sun') {
      if (move.type === 'Fire') mod *= 1.5;
      if (move.type === 'Water') mod *= 0.5;
    } else if (this.weather === 'rain') {
      if (move.type === 'Water') mod *= 1.5;
      if (move.type === 'Fire') mod *= 0.5;
    }
    // terrain
    if (this.terrain === 'electric' && move.type === 'Electric') mod *= 1.3;
    if (this.terrain === 'grassy' && move.type === 'Grass') mod *= 1.3;
    // crit
    if (crit) mod *= 1.5;
    // random roll
    mod *= 0.85 + rand() * 0.15;
    // STAB
    if (!move.typeless && def(user).types.includes(move.type)) mod *= user.ability === 'adaptive' ? 2 : 1.5;
    // effectiveness
    mod *= eff;
    // screens (not bypassed by typeless; crit ignores screens)
    if (!crit) {
      if (isPhys && tSide.reflectTurns > 0) mod *= 0.5;
      if (!isPhys && tSide.lightScreenTurns > 0) mod *= 0.5;
    }
    // pinch abilities
    const pinchType = PINCH_ABILITIES[user.ability];
    if (pinchType && pinchType === move.type && user.hp <= Math.floor(user.maxHp / 3)) mod *= 1.5;
    // ember gut boost
    if (move.type === 'Fire' && uSide.emberBoost) mod *= 1.5;
    // held-item type charms
    const held = user.heldItem ? ITEMS[user.heldItem] : null;
    if (held?.typeBoost === move.type) mod *= 1.2;

    let dmg = Math.floor(base * mod);
    dmg = Math.max(1, dmg);

    // sturdy / safety sash
    if (target.hp === target.maxHp && dmg >= target.hp) {
      if (target.ability === 'rocksolid') {
        dmg = target.hp - 1;
        msgs.push(`${displayName(target)} hung on with Rock Solid!`);
      } else if (target.heldItem === 'safetysash' && !tSide.sashUsed) {
        dmg = target.hp - 1;
        tSide.sashUsed = true;
        msgs.push(`${displayName(target)} hung on using its Safety Sash!`);
      }
    }
    if (crit) msgs.push('A critical hit!');
    if (eff > 1) msgs.push("It's super effective!");
    else if (eff < 1) msgs.push("It's not very effective...");
    return dmg;
  }

  private accuracyCheck(user: Mockemon, target: Mockemon, move: MoveDef, userSide: Side): boolean {
    if (move.accuracy >= 999) return true;
    const uSide = this.sides[userSide];
    const tSide = this.sides[this.other(userSide)];
    const diff = uSide.stages.acc - tSide.stages.eva;
    const p = (move.accuracy / 100) * accMult(diff);
    return chance(p);
  }

  private applyStatChange(move: MoveDef, user: Mockemon, target: Mockemon, userSide: Side, msgs: string[]): void {
    const sc = move.statChange;
    if (!sc || !chance(sc.chance)) return;
    const sideKey = sc.target === 'self' ? userSide : this.other(userSide);
    const who = sc.target === 'self' ? user : target;
    const side = this.sides[sideKey];
    const before = side.stages[sc.stat];
    side.stages[sc.stat] = Math.max(-6, Math.min(6, before + sc.stages));
    const statName = { atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', acc: 'accuracy', eva: 'evasion' }[sc.stat];
    if (side.stages[sc.stat] === before) {
      msgs.push(`${displayName(who)}'s ${statName} won't go any ${sc.stages > 0 ? 'higher' : 'lower'}!`);
      return;
    }
    msgs.push(`${displayName(who)}'s ${statName} ${sc.stages > 0 ? 'rose' : 'fell'}!`);
  }

  private applyStatus(move: MoveDef, target: Mockemon, msgs: string[]): void {
    const st = move.status;
    if (!st || target.hp <= 0) return;
    if (move.category === 'status' || chance(st.chance)) {
      if (target.status) {
        if (move.category === 'status') msgs.push('But it failed!');
        return;
      }
      if (move.category === 'status' && this.typeEffectiveness(move, target) === 0) {
        msgs.push(`It doesn't affect ${displayName(target)}...`);
        return;
      }
      target.status = st.id;
      if (st.id === 'SLP') target.sleepTurns = randInt(1, 3);
      if (st.id === 'TOX') target.toxicCounter = 0;
      msgs.push(`${displayName(target)} ${STATUS_TEXT[st.id]}`);
    }
  }

  private applyVolatile(move: MoveDef, target: Mockemon, targetSide: Side, msgs: string[]): void {
    const tSide = this.sides[targetSide];
    if (move.confuseChance && chance(move.confuseChance)) {
      if (tSide.confusionTurns > 0) {
        if (move.category === 'status') msgs.push(`${displayName(target)} is already confused!`);
      } else {
        tSide.confusionTurns = randInt(2, 5);
        msgs.push(`${displayName(target)} became confused!`);
      }
    }
    if (move.leechSeed) {
      if (def(target).types.includes('Grass')) {
        msgs.push(`It doesn't affect ${displayName(target)}...`);
      } else if (tSide.leechSeed) {
        msgs.push('But it failed!');
      } else {
        tSide.leechSeed = true;
        msgs.push(`${displayName(target)} was seeded!`);
      }
    }
  }

  private applyFieldEffects(move: MoveDef, userSide: Side, msgs: string[]): void {
    const uSide = this.sides[userSide];
    const tSide = this.sides[this.other(userSide)];
    if (move.weather) {
      this.weather = move.weather;
      this.weatherTurns = 5;
      msgs.push({ sun: 'The sunlight turned harsh!', rain: 'It started to rain!', sand: 'A sandstorm kicked up!' }[move.weather as WeatherId]);
    }
    if (move.terrain) {
      this.terrain = move.terrain;
      this.terrainTurns = 5;
      msgs.push(move.terrain === 'electric' ? 'An electric current runs across the field!' : 'Grass sprouted across the field!');
    }
    if (move.screen) {
      const key: ScreenId = move.screen;
      if (key === 'reflect') {
        uSide.reflectTurns = 5;
        msgs.push('Reflect raised the team\'s Defense!');
      } else {
        uSide.lightScreenTurns = 5;
        msgs.push('Light Screen raised the team\'s Sp. Def!');
      }
    }
    if (move.hazard) {
      const key: HazardId = move.hazard;
      if (key === 'spikes') {
        if (tSide.spikes) msgs.push('But it failed!');
        else {
          tSide.spikes = true;
          msgs.push('Spikes were scattered around the foe\'s feet!');
        }
      } else {
        if (tSide.stealthRock) msgs.push('But it failed!');
        else {
          tSide.stealthRock = true;
          msgs.push('Pointed stones float around the foe\'s side!');
        }
      }
    }
  }

  private canAct(m: Mockemon, side: Side, msgs: string[]): boolean {
    const s = this.sides[side];
    if (m.status === 'SLP') {
      if (m.sleepTurns > 0) {
        m.sleepTurns--;
        msgs.push(`${displayName(m)} is fast asleep.`);
        return false;
      }
      m.status = null;
      msgs.push(`${displayName(m)} woke up!`);
    }
    if (m.status === 'FRZ') {
      if (chance(0.2)) {
        m.status = null;
        msgs.push(`${displayName(m)} thawed out!`);
      } else {
        msgs.push(`${displayName(m)} is frozen solid!`);
        return false;
      }
    }
    if (m.status === 'PAR' && chance(0.25)) {
      msgs.push(`${displayName(m)} is paralyzed! It can't move!`);
      return false;
    }
    if (s.flinched) {
      msgs.push(`${displayName(m)} flinched and couldn't move!`);
      return false;
    }
    if (s.confusionTurns > 0) {
      s.confusionTurns--;
      msgs.push(`${displayName(m)} is confused!`);
      if (s.confusionTurns === 0) msgs.push(`${displayName(m)} snapped out of confusion!`);
      if (chance(0.5)) {
        const dmg = Math.max(1, Math.floor((Math.floor((2 * m.level) / 5 + 2) * 40 * (m.atk / Math.max(1, m.def))) / 50) + 2);
        m.hp = Math.max(0, m.hp - dmg);
        msgs.push(`It hurt itself in its confusion!`);
        return false;
      }
    }
    return true;
  }

  private useMove(user: Mockemon, target: Mockemon, moveId: string, userSide: Side, msgs: string[]): void {
    const move = MOVES[moveId];
    const uSide = this.sides[userSide];
    const tSide = this.sides[this.other(userSide)];
    const userName = userSide === 'enemy' ? `Foe ${displayName(user)}` : displayName(user);

    // two-turn: first turn charges
    if (move.twoTurn && uSide.charging !== moveId) {
      uSide.charging = moveId;
      msgs.push(`${userName} ${move.twoTurn.chargeText}`);
      return;
    }
    uSide.charging = null;
    msgs.push(`${userName} used ${move.name}!`);

    // invulnerable target (charging with invulnerability)
    if (tSide.charging && MOVES[tSide.charging]?.twoTurn?.invulnerable) {
      msgs.push(`But it missed!`);
      return;
    }
    if (!this.accuracyCheck(user, target, move, userSide)) {
      msgs.push(`${userName}'s attack missed!`);
      return;
    }
    if (move.category === 'status') {
      this.applyStatChange(move, user, target, userSide, msgs);
      this.applyStatus(move, target, msgs);
      this.applyVolatile(move, target, this.other(userSide), msgs);
      this.applyFieldEffects(move, userSide, msgs);
      if (move.healSelf) {
        const before = user.hp;
        user.hp = Math.min(user.maxHp, user.hp + Math.floor(user.maxHp * move.healSelf));
        msgs.push(`${userName} recovered ${user.hp - before} HP!`);
      }
      return;
    }

    const hits = move.multiHit ? (chance(0.35) ? 2 : chance(0.5) ? 3 : chance(0.5) ? 4 : 5) : 1;
    let totalDmg = 0;
    let landedHits = 0;
    for (let h = 0; h < hits; h++) {
      if (target.hp <= 0) break;
      const dmg = this.damage(user, target, move, userSide, msgs);
      if (dmg > 0) {
        landedHits++;
        totalDmg += dmg;
        target.hp = Math.max(0, target.hp - dmg);
      }
      if (h === 0 && dmg === 0) break; // immune/absorbed messages already printed
    }
    if (move.multiHit && landedHits > 0) msgs.push(`Hit ${landedHits} time(s)!`);
    if (totalDmg === 0) return;

    if (move.drain && target.hp >= 0) {
      const heal = Math.max(1, Math.floor(totalDmg * move.drain));
      const before = user.hp;
      user.hp = Math.min(user.maxHp, user.hp + heal);
      if (user.hp > before) msgs.push(`${displayName(target)} had its energy drained!`);
    }
    if (move.recoil) {
      const rec = Math.max(1, Math.floor(totalDmg * move.recoil));
      user.hp = Math.max(0, user.hp - rec);
      msgs.push(`${userName} is damaged by recoil!`);
    }
    if (move.recoilMaxHp) {
      const rec = Math.max(1, Math.floor(user.maxHp * move.recoilMaxHp));
      user.hp = Math.max(0, user.hp - rec);
      msgs.push(`${userName} is damaged by recoil!`);
    }
    if (target.hp > 0) {
      if (move.flinchChance && chance(move.flinchChance)) tSide.flinched = true;
      this.applyStatChange(move, user, target, userSide, msgs);
      this.applyStatus(move, target, msgs);
      this.applyVolatile(move, target, this.other(userSide), msgs);
      // contact-trigger abilities on the defender
      if (isContact(move) && target.hp > 0) {
        if (target.ability === 'staticfur' && !user.status && chance(0.3)) {
          user.status = 'PAR';
          msgs.push(`${userName} was paralyzed by ${displayName(target)}'s Static Fur!`);
        } else if (target.ability === 'toxicbarb' && !user.status && chance(0.3)) {
          user.status = 'PSN';
          msgs.push(`${userName} was poisoned by ${displayName(target)}'s Toxic Barb!`);
        }
      }
    }
  }

  private endOfTurn(m: Mockemon, side: Side, msgs: string[]): void {
    if (m.hp <= 0) return;
    const s = this.sides[side];
    const name = side === 'enemy' ? `Foe ${displayName(m)}` : displayName(m);
    if (m.status === 'BRN') {
      m.hp = Math.max(0, m.hp - Math.max(1, Math.floor(m.maxHp / 8)));
      msgs.push(`${name} is hurt by its burn!`);
    } else if (m.status === 'PSN') {
      m.hp = Math.max(0, m.hp - Math.max(1, Math.floor(m.maxHp / 8)));
      msgs.push(`${name} is hurt by poison!`);
    } else if (m.status === 'TOX') {
      m.toxicCounter++;
      m.hp = Math.max(0, m.hp - Math.max(1, Math.floor((m.maxHp * m.toxicCounter) / 16)));
      msgs.push(`${name} is hurt by poison!`);
    }
    if (m.hp <= 0) return;
    if (s.leechSeed) {
      const drain = Math.max(1, Math.floor(m.maxHp / 8));
      m.hp = Math.max(0, m.hp - drain);
      const other = this.mon(this.other(side));
      if (other.hp > 0) other.hp = Math.min(other.maxHp, other.hp + drain);
      msgs.push(`${name}'s health is sapped by Leech Seed!`);
    }
    if (this.weather === 'sand' && !def(m).types.some((t) => t === 'Rock' || t === 'Ground')) {
      m.hp = Math.max(0, m.hp - Math.max(1, Math.floor(m.maxHp / 16)));
      msgs.push(`${name} is buffeted by the sandstorm!`);
    }
    if (this.terrain === 'grassy' && m.hp > 0) {
      m.hp = Math.min(m.maxHp, m.hp + Math.max(1, Math.floor(m.maxHp / 16)));
    }
    if (m.hp <= 0) return;
    if (m.heldItem === 'leftovers') {
      m.hp = Math.min(m.maxHp, m.hp + Math.max(1, Math.floor(m.maxHp / 16)));
    }
    if (m.hp <= 0) return;
    // berries
    if (m.hp <= Math.floor(m.maxHp / 2)) {
      if (m.heldItem === 'oranberry') {
        m.heldItem = null;
        m.hp = Math.min(m.maxHp, m.hp + 10);
        msgs.push(`${name} ate its Oran Berry!`);
      } else if (m.heldItem === 'sitrusberry') {
        m.heldItem = null;
        m.hp = Math.min(m.maxHp, m.hp + Math.floor(m.maxHp / 4));
        msgs.push(`${name} ate its Sitrus Berry!`);
      }
    }
    if (m.ability === 'momentum' && m.hp > 0) {
      if (s.stages.spe < 6) {
        s.stages.spe++;
        msgs.push(`${name}'s Speed rose with Momentum!`);
      }
    }
  }

  private tickFieldCounters(msgs: string[]): void {
    for (const side of ['player', 'enemy'] as Side[]) {
      const s = this.sides[side];
      if (s.reflectTurns > 0 && --s.reflectTurns === 0) msgs.push('Reflect wore off!');
      if (s.lightScreenTurns > 0 && --s.lightScreenTurns === 0) msgs.push('Light Screen wore off!');
    }
    if (this.weatherTurns > 0 && --this.weatherTurns === 0) {
      msgs.push({ sun: 'The harsh sunlight faded.', rain: 'The rain stopped.', sand: 'The sandstorm subsided.' }[this.weather as WeatherId]);
      this.weather = null;
    }
    if (this.terrainTurns > 0 && --this.terrainTurns === 0) {
      msgs.push('The terrain faded.');
      this.terrain = null;
    }
  }

  private estimateDamage(attacker: Mockemon, defender: Mockemon, move: MoveDef): number {
    if (move.category === 'status') return 0;
    const isPhys = move.category === 'physical';
    const a = isPhys ? attacker.atk * (attacker.ability === 'musclebound' ? 2 : 1) : attacker.spa;
    const d = Math.max(1, isPhys ? defender.def : defender.spd);
    const base = Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * move.power * (a / d)) / 50) + 2;
    const stab = !move.typeless && def(attacker).types.includes(move.type) ? 1.5 : 1;
    const eff = this.typeEffectiveness(move, defender);
    return Math.floor(base * stab * eff * 0.925);
  }

  private enemyPickMove(): string {
    const foe = this.enemy;
    const usable = foe.moves.filter((ms) => ms.pp > 0);
    if (usable.length === 0) return 'struggle';
    const tier: AiTier = this.trainer?.ai ?? 'basic';
    if (tier === 'basic') {
      let best = usable[0].id;
      let bestScore = -1;
      for (const ms of usable) {
        const mv = MOVES[ms.id];
        let score: number;
        if (mv.category === 'status') {
          score = foe.hp > foe.maxHp * 0.7 ? 45 : 10;
          if (mv.status && this.active.status) score = 0;
        } else {
          score = mv.power * this.typeEffectiveness(mv, this.active);
          if (def(foe).types.includes(mv.type)) score *= 1.5;
        }
        score *= 0.85 + rand() * 0.3;
        if (score > bestScore) {
          bestScore = score;
          best = ms.id;
        }
      }
      return best;
    }
    // smart / leader: pick by estimated damage, prefer KOs
    let best = usable[0].id;
    let bestScore = -1;
    for (const ms of usable) {
      const mv = MOVES[ms.id];
      let score: number;
      if (mv.category === 'status') {
        score = 0;
        if (mv.status && !this.active.status && foe.hp > foe.maxHp * 0.5) score = 30;
        if (mv.screen && this.sides.enemy.reflectTurns === 0 && this.sides.enemy.lightScreenTurns === 0 && foe.hp > foe.maxHp * 0.6) score = 35;
        if (mv.statChange && foe.hp > foe.maxHp * 0.6 && !this.sides.enemy.aiSetupUsed) {
          const sc = mv.statChange;
          const targetStages = sc.target === 'self' ? this.sides.enemy.stages : this.sides.player.stages;
          const cur = targetStages[sc.stat];
          const capped = sc.stages > 0 ? cur >= 6 : cur <= -6;
          if (!capped) score = 25;
        }
        if (mv.healSelf && foe.hp < foe.maxHp * 0.4) score = 70;
      } else {
        score = this.estimateDamage(foe, this.active, mv);
        if (score >= this.active.hp) score += 100; // prefer the KO
        if ((mv.priority ?? 0) > 0 && score >= this.active.hp) score += 50;
      }
      score *= 0.9 + rand() * 0.2;
      if (score > bestScore) {
        bestScore = score;
        best = ms.id;
      }
    }
    return best;
  }

  private grantExp(faintedEnemyIndex: number, msgs: string[]): void {
    const fainted = this.enemyParty[faintedEnemyIndex];
    const share = Math.max(1, Math.floor((SPECIES[fainted.species].expYield * fainted.level) / 3) * (this.isTrainer ? 1.5 : 1));
    const involved = this.participants.get(faintedEnemyIndex) ?? new Set<number>();
    for (let i = 0; i < this.party.length; i++) {
      const m = this.party[i];
      if (m.hp <= 0 || m.isEgg) continue;
      let amount = involved.has(i) ? share : Math.floor(share / 2);
      if (m.heldItem === 'luckycharm') amount = Math.floor(amount * 1.5);
      if (amount <= 0) continue;
      msgs.push(`${displayName(m)} gained ${amount} EXP!`);
      addEVs(m, SPECIES[fainted.species].evYield);
      const res = gainExp(m, amount);
      if (res.leveled) {
        msgs.push(`${displayName(m)} grew to level ${res.newLevel}!`);
        for (const learned of res.learned) msgs.push(`${displayName(m)} learned ${learned}!`);
        for (const queued of res.queued) msgs.push(`${displayName(m)} wants to learn ${queued}!`);
        // level / friendship evolution check
        const evo = def(m).evolution;
        if (evo && ((evo.method === 'level' && m.level >= (evo.level ?? 101)) || (evo.method === 'friendship' && m.friendship >= (evo.min ?? 160)))) {
          const oldName = displayName(m);
          evolve(m, evo.to);
          msgs.push(`What? ${oldName} is evolving... ${oldName} evolved into ${SPECIES[evo.to].name}!`);
        }
      }
      changeFriendship(m, 1);
    }
  }

  private applyHazards(side: Side, msgs: string[]): void {
    const s = this.sides[side];
    const m = this.mon(side);
    const name = side === 'enemy' ? `Foe ${displayName(m)}` : displayName(m);
    const grounded = !def(m).types.includes('Flying') && m.ability !== 'airborne';
    if (s.stealthRock) {
      const eff = effectiveness('Rock', def(m).types);
      const dmg = Math.max(1, Math.floor((m.maxHp / 8) * eff));
      m.hp = Math.max(0, m.hp - dmg);
      msgs.push(`Pointed stones dug into ${name}!`);
    }
    if (s.spikes && grounded) {
      m.hp = Math.max(0, m.hp - Math.max(1, Math.floor(m.maxHp / 8)));
      msgs.push(`${name} was hurt by the spikes!`);
    }
  }

  private onSwitchIn(side: Side, msgs: string[]): void {
    const m = this.mon(side);
    if (m.hp > 0 && m.ability === 'menace') {
      const foeSide = this.sides[this.other(side)];
      if (foeSide.stages.atk > -6) {
        foeSide.stages.atk--;
        msgs.push(`${displayName(m)}'s Menace cut the foe's Attack!`);
      }
    }
    this.markParticipant();
  }

  private handleEnemyFaint(msgs: string[]): void {
    msgs.push(`Foe ${displayName(this.enemy)} fainted!`);
    this.grantExp(this.enemyIndex, msgs);
    if (this.isTrainer) {
      const next = this.enemyParty.findIndex((m) => m.hp > 0);
      if (next >= 0) {
        this.enemyIndex = next;
        const old = this.sides.enemy;
        old.stages = zeroStages();
        old.confusionTurns = 0;
        old.flinched = false;
        old.leechSeed = false;
        old.charging = null;
        old.choiceLock = null;
        old.aiSetupUsed = false;
        this.enemy.toxicCounter = 0;
        msgs.push(`${this.trainer!.name} sent out ${displayName(this.enemy)}!`);
        this.applyHazards('enemy', msgs);
        this.onSwitchIn('enemy', msgs);
        if (this.enemy.hp <= 0) {
          // hazards knocked it out on entry
          this.handleEnemyFaint(msgs);
        }
        return;
      }
    }
    this.outcome = 'win';
  }

  private handlePlayerFaint(msgs: string[]): void {
    msgs.push(`${displayName(this.active)} fainted!`);
    changeFriendship(this.active, -5);
    const anyAlive = this.party.some((m) => m.hp > 0 && !m.isEgg);
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
    msgs.push('You threw a MockBall!');
    const statusBonus = t.status === 'SLP' || t.status === 'FRZ' ? 2 : t.status ? 1.5 : 1;
    const a = Math.min(255, ((3 * t.maxHp - 2 * t.hp) * SPECIES[t.species].catchRate * statusBonus) / (3 * t.maxHp));
    const critCapture = chance(0.12);
    const checks = critCapture ? 1 : 4;
    const b = Math.floor(65536 / Math.pow(255 / Math.max(1, a), 0.1875));
    let success = a >= 255;
    if (!success) {
      success = true;
      for (let i = 0; i < checks; i++) {
        if (randInt(0, 65535) >= b) {
          success = false;
          break;
        }
      }
    }
    if (success) {
      if (critCapture) msgs.push('Critical capture!');
      msgs.push('Shake... shake... shake... Click!');
      msgs.push(`Gotcha! ${displayName(t)} was caught!`);
      this.caughtMon = t;
      this.outcome = 'caught';
    } else {
      const shakes = a > 180 ? 3 : a > 100 ? 2 : a > 40 ? 1 : 0;
      msgs.push('Shake... '.repeat(Math.max(1, shakes)) + 'Oh no! It broke free!');
    }
  }

  private tryRun(msgs: string[]): boolean {
    if (this.isTrainer) {
      msgs.push("You can't run from a trainer battle!");
      return false;
    }
    this.runAttempts++;
    const mySpe = this.effectiveSpe(this.active, this.sides.player);
    const foeSpe = this.effectiveSpe(this.enemy, this.sides.enemy);
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
    const old = this.sides.player;
    old.stages = zeroStages();
    old.confusionTurns = 0;
    old.flinched = false;
    old.leechSeed = false;
    old.charging = null;
    old.choiceLock = null;
    this.active.toxicCounter = 0;
    this.activeIndex = index;
    this.needsSwitch = false;
    msgs.push(`Go, ${displayName(this.active)}!`);
    this.applyHazards('player', msgs);
    if (this.active.hp <= 0) {
      this.handlePlayerFaint(msgs);
      return;
    }
    this.onSwitchIn('player', msgs);
  }

  private leaderUsePotion(msgs: string[]): boolean {
    if (this.enemyPotions > 0 && this.enemy.hp > 0 && this.enemy.hp / this.enemy.maxHp < 0.25) {
      this.enemyPotions--;
      const before = this.enemy.hp;
      this.enemy.hp = Math.min(this.enemy.maxHp, this.enemy.hp + 50);
      msgs.push(`${this.trainer!.name} used a Super Potion on ${displayName(this.enemy)}!`);
      msgs.push(`It recovered ${this.enemy.hp - before} HP!`);
      return true;
    }
    return false;
  }

  takeTurn(action: PlayerAction): string[] {
    const msgs: string[] = [];
    if (this.outcome) return msgs;
    const pSide = this.sides.player;
    pSide.flinched = false;
    this.sides.enemy.flinched = false;

    let playerMoveId: string | null = null;
    let playerActs = false;

    if (action.type === 'run') {
      if (this.tryRun(msgs)) return msgs;
    } else if (action.type === 'switch') {
      const target = this.party[action.index];
      if (!target || target.hp <= 0 || target.isEgg || action.index === this.activeIndex) {
        msgs.push("Can't switch to that Mockemon!");
        return msgs;
      }
      msgs.push(`${displayName(this.active)}, come back!`);
      const old = this.sides.player;
      old.stages = zeroStages();
      old.confusionTurns = 0;
      old.leechSeed = false;
      old.charging = null;
      this.active.toxicCounter = 0;
      this.activeIndex = action.index;
      msgs.push(`Go, ${displayName(this.active)}!`);
      this.applyHazards('player', msgs);
      this.onSwitchIn('player', msgs);
    } else if (action.type === 'item') {
      if (action.item === 'mockball') {
        this.tryCatch(msgs);
        if (this.outcome) return msgs;
      } else {
        const heal = action.item === 'potion' ? 20 : 50;
        const before = this.active.hp;
        this.active.hp = Math.min(this.active.maxHp, this.active.hp + heal);
        msgs.push(`${displayName(this.active)} recovered ${this.active.hp - before} HP!`);
      }
    } else {
      const usable = this.active.moves.filter((ms) => ms.pp > 0);
      if (usable.length === 0) {
        playerMoveId = 'struggle';
        playerActs = true;
      } else {
        const slot = this.active.moves[action.index];
        if (!slot || slot.pp <= 0) {
          msgs.push('No PP left for this move!');
          return msgs;
        }
        playerMoveId = slot.id;
        playerActs = true;
      }
    }

    // choice band lock
    if (playerActs && playerMoveId) {
      if (this.active.heldItem === 'powerband') {
        if (pSide.choiceLock && pSide.choiceLock !== playerMoveId) {
          msgs.push(`Power Band only allows ${MOVES[pSide.choiceLock].name}!`);
          return msgs;
        }
        pSide.choiceLock = playerMoveId;
      }
    }

    // enemy action: leader potion or move
    let enemyMoveId: string | null = null;
    let enemySkippedForPotion = false;
    if (!this.outcome && this.enemy.hp > 0) {
      if (this.trainer?.ai === 'leader' && this.leaderUsePotion(msgs)) {
        enemySkippedForPotion = true;
      } else {
        enemyMoveId = this.enemyPickMove();
        if (MOVES[enemyMoveId].statChange) this.sides.enemy.aiSetupUsed = true;
      }
    }

    // order
    let playerFirst = true;
    if (playerActs && playerMoveId && !enemySkippedForPotion && enemyMoveId) {
      let pPri = MOVES[playerMoveId].priority ?? 0;
      let ePri = MOVES[enemyMoveId].priority ?? 0;
      if (this.active.heldItem === 'swiftfeather' && chance(0.2)) {
        pPri += 1;
        msgs.push(`${displayName(this.active)}'s Swift Feather let it move first!`);
      }
      if (pPri !== ePri) playerFirst = pPri > ePri;
      else {
        const mySpe = this.effectiveSpe(this.active, this.sides.player);
        const foeSpe = this.effectiveSpe(this.enemy, this.sides.enemy);
        playerFirst = mySpe === foeSpe ? chance(0.5) : mySpe > foeSpe;
      }
    } else {
      playerFirst = false;
    }

    const playerAct = (): void => {
      if (!playerActs || !playerMoveId || this.active.hp <= 0 || this.enemy.hp <= 0) return;
      // second turn of a charging move bypasses canAct
      if (!this.sides.player.charging) {
        if (!this.canAct(this.active, 'player', msgs)) return;
      }
      const slot = this.active.moves.find((ms) => ms.id === playerMoveId);
      if (slot && slot.pp > 0) slot.pp--;
      this.useMove(this.active, this.enemy, playerMoveId, 'player', msgs);
    };

    const enemyAct = (): void => {
      if (!enemyMoveId || this.enemy.hp <= 0 || this.active.hp <= 0 || this.outcome) return;
      if (!this.sides.enemy.charging) {
        if (!this.canAct(this.enemy, 'enemy', msgs)) return;
      }
      const slot = this.enemy.moves.find((ms) => ms.id === enemyMoveId);
      if (slot && slot.pp > 0) slot.pp--;
      this.useMove(this.enemy, this.active, enemyMoveId, 'enemy', msgs);
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
      if (this.active.hp > 0 && !this.outcome) {
        playerAct();
        if (this.enemy.hp <= 0) {
          this.handleEnemyFaint(msgs);
          if (this.outcome) return msgs;
        }
      }
    }

    if (!this.outcome) {
      this.endOfTurn(this.active, 'player', msgs);
      this.endOfTurn(this.enemy, 'enemy', msgs);
      this.tickFieldCounters(msgs);
    }

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
