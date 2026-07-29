import { Battle, type BattleKind, type PlayerAction } from './battle';
import { MOVES } from './data/moves';
import { DEX_ORDER, SPECIES } from './data/species';
import { ITEMS, itemName, shopStock } from './data/items';
import { consumePress, isHeld, type Key } from './input';
import {
  BADGE_FLAG_SHALLOW,
  MAPS,
  SHALLOW_TILE,
  SOLID_TILES,
  type EncounterEntry,
  type GameMap,
  type Gate,
  type MapEvent,
  type Npc,
} from './maps';
import { checkEvolution } from './evolution';
import { breedError, canBreed, makeEgg, tickEgg } from './breeding';
import { phaseFor } from './daynight';
import {
  createMockemon,
  displayName,
  evolve,
  healFull,
  learnMove,
  type Mockemon,
} from './mockemon';
import { chance, rand, randInt } from './rng';
import { MON_SPRITES } from './sprites';
import { ScriptRunner, type ScriptHost } from './script';
import { SCRIPTS } from './content/scripts';
import { trainerById } from './content/trainers';
import { QuestLog } from './quests';
import { QUESTS } from './content/quests';
import { decodeSave, encodeSave, migrateQuests, SAVE_VERSION, type SaveData } from './save';
import { GYMS, GYM_BY_LEADER, type GymDef } from './content/gyms';
import {
  CreditsRoll,
  IntroMovie,
  SLOT_KEYS,
  firstEmptySlot,
  markIntroSeen,
  newestSlot,
  readSlots,
} from './frontend';
import { formatPlaytime, paginate, wrap } from './ui';
import { BAR_H, TILE, VIEW_H, VIEW_W } from './constants';
import { renderControlsBar, renderOverworld, renderTint } from './render/overworld';
import { renderBattle } from './render/battle';
import { renderDex, renderDialogue, renderEnding, renderMenu, renderSummary, renderTitle } from './render/screens';

export type Facing = 'up' | 'down' | 'left' | 'right';

/** Beating these trainers opens the gate in front of whatever comes next. */
const TRAINER_UNLOCK_FLAGS: Record<string, string[]> = {
  elite_ryn: ['elite1Beaten'],
  elite_calla: ['elite2Beaten'],
  elite_volt: ['elite3Beaten'],
  elite_noct: ['elite4Beaten', 'championOpen'],
  director_nil: ['nilBeaten'],
  admin_patch: ['patchBeaten'],
  admin_merge: ['mergeBeaten'],
};

interface MenuState {
  title: string;
  items: string[];
  index: number;
  onSelect: (i: number) => void;
  onCancel: (() => void) | null;
  info?: string[];
  onChange?: (i: number) => void;
}

type Mode =
  | 'intro'
  | 'title'
  | 'overworld'
  | 'dialogue'
  | 'menu'
  | 'battle'
  | 'summary'
  | 'dex'
  | 'ending'
  | 'credits';

type BattlePhase = 'msg' | 'action' | 'moves' | 'party' | 'bag';

export class Game implements ScriptHost {
  ctx: CanvasRenderingContext2D;
  frame = 0;
  mode: Mode = 'title';
  titleIndex = 0;

  mapId = 'lab';
  px = 5;
  py = 6;
  facing: Facing = 'down';
  moveOffX = 0;
  moveOffY = 0;
  moving = false;

  party: Mockemon[] = [];
  storage: Mockemon[] = [];
  inventory: Record<string, number> = { potion: 0, superpotion: 0, mockball: 0 };
  money = 3000;
  badges: string[] = [];
  flags: Record<string, boolean> = {};
  defeatedTrainers = new Set<string>();
  collectedItems = new Set<string>();
  healPoint = { map: 'mapletown', x: 7, y: 9 };
  seenSpecies = new Set<string>();
  caughtSpecies = new Set<string>();
  minute = 600; // in-game clock (0..1439), starts 10:00
  daycare: (Mockemon | null)[] = [null, null];
  daycareSteps = 0;
  daycareEgg: Mockemon | null = null;
  dexIndex = 0;

  dialogueQueue: string[] = [];
  dialogueDone: (() => void) | null = null;

  menu: MenuState | null = null;
  menuStack: MenuState[] = [];

  battle: Battle | null = null;
  battlePhase: BattlePhase = 'msg';
  battleMsgs: string[] = [];
  battleMenuIndex = 0;
  battleOnEnd: ((outcome: string) => void) | null = null;
  battleForcedSwitch = false;
  battleSpriteKey = '';

  summaryMon: Mockemon | null = null;
  pendingHealItem: string | null = null;
  pendingGiveItem: string | null = null;
  pendingStone: string | null = null;

  noEncounters = false;
  endingShown = false;

  slot = 0;
  playFrames = 0;
  intro: IntroMovie | null = null;
  credits: CreditsRoll | null = null;

  scripts = new ScriptRunner();
  quests = new QuestLog(QUESTS);

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  playIntro(): void {
    this.intro = new IntroMovie();
    this.mode = 'intro';
  }

  startCredits(): void {
    const parade = [...this.caughtSpecies].filter((k) => MON_SPRITES[k]);
    this.credits = new CreditsRoll(
      {
        badges: this.badges.length,
        seen: this.seenSpecies.size,
        caught: this.caughtSpecies.size,
        dexTotal: DEX_ORDER.length,
        playtime: formatPlaytime(this.playFrames),
        party: this.party
          .filter((m) => !m.isEgg)
          .map((m) => ({ species: SPECIES[m.species]?.name ?? m.species, level: m.level })),
      },
      parade,
      VIEW_H,
    );
    this.mode = 'credits';
  }

  titleOptions(): string[] {
    const opts: string[] = ['NEW GAME'];
    if (this.hasSave()) opts.push('CONTINUE');
    opts.push('SLOTS', 'INTRO MOVIE');
    return opts;
  }

  openSlotMenu(): void {
    const slots = readSlots();
    this.openMenu(
      {
        title: 'SAVE SLOTS',
        items: slots.map(
          (s) =>
            `[${s.index + 1}] ${s.empty ? 'EMPTY' : `${s.lead}  ${s.badges}B  ${s.playtime}`}`,
        ),
        index: 0,
        onSelect: (i) => {
          const s = slots[i];
          if (s.empty) {
            this.slot = s.index;
            this.closeAllMenus();
            this.newGame();
          } else {
            this.closeAllMenus();
            this.load(s.index);
          }
        },
        onCancel: () => {
          this.closeAllMenus();
          this.mode = 'title';
        },
      },
      true,
    );
  }

  get map(): GameMap {
    return MAPS[this.mapId];
  }

  // ---------- helpers ----------

  showDialogue(lines: string[], done?: () => void): void {
    const pages: string[] = [];
    for (const line of lines) pages.push(...paginate(line));
    this.dialogueQueue = pages;
    this.dialogueDone = done ?? null;
    this.mode = 'dialogue';
  }

  openMenu(m: MenuState, push = false): void {
    if (push && this.menu) this.menuStack.push(this.menu);
    this.menu = m;
    this.mode = 'menu';
  }

  closeMenu(): void {
    this.menu = this.menuStack.pop() ?? null;
    if (!this.menu) this.mode = 'overworld';
  }

  closeAllMenus(): void {
    this.menu = null;
    this.menuStack = [];
    this.mode = 'overworld';
  }

  npcVisible(npc: Npc): boolean {
    if (npc.hiddenUntilFlag && !this.flags[npc.hiddenUntilFlag]) return false;
    if (npc.hiddenAfterFlag && this.flags[npc.hiddenAfterFlag]) return false;
    return true;
  }

  // ---------- script host ----------

  runScript(id: string): boolean {
    const cmds = SCRIPTS[id];
    if (!cmds || this.scripts.running) return false;
    this.scripts.run(cmds);
    return true;
  }

  fireEvent(event: MapEvent | undefined): boolean {
    if (!event) return false;
    if (event.once && this.flags[event.once]) return false;
    if (!this.runScript(event.script)) return false;
    if (event.once) this.flags[event.once] = true;
    return true;
  }

  isBusy(): boolean {
    return this.mode !== 'overworld';
  }

  say(lines: string[], done: () => void): void {
    this.showDialogue(lines, done);
  }

  choose(title: string, labels: string[], onPick: (index: number) => void, onCancel: () => void): void {
    this.openMenu({
      title,
      items: labels,
      index: 0,
      onSelect: (i) => {
        this.closeAllMenus();
        onPick(i);
      },
      onCancel: () => {
        this.closeAllMenus();
        onCancel();
      },
    });
  }

  getFlag(flag: string): boolean {
    return !!this.flags[flag];
  }

  setFlag(flag: string, value: boolean): void {
    this.flags[flag] = value;
  }

  hasItem(item: string, count: number): boolean {
    return (this.inventory[item] ?? 0) >= count;
  }

  giveItem(item: string, count: number): void {
    this.inventory[item] = (this.inventory[item] ?? 0) + count;
  }

  takeItem(item: string, count: number): void {
    this.inventory[item] = Math.max(0, (this.inventory[item] ?? 0) - count);
  }

  giveMon(species: string, level: number): void {
    const mon = createMockemon(species, level);
    this.seenSpecies.add(mon.species);
    this.caughtSpecies.add(mon.species);
    if (this.party.length < 6) this.party.push(mon);
    else this.storage.push(mon);
  }

  giveEgg(species: string): void {
    const egg = createMockemon(species, 5);
    egg.isEgg = true;
    egg.hatchSteps = 2560;
    egg.nickname = 'Egg';
    if (this.party.length < 6) this.party.push(egg);
    else this.storage.push(egg);
  }

  changeMoney(delta: number): void {
    this.money = Math.max(0, this.money + delta);
  }

  healParty(): void {
    for (const m of this.party) healFull(m);
  }

  setHealPoint(): void {
    this.healPoint = { map: this.mapId, x: this.px, y: this.py };
    this.autosave();
  }

  openShop(stock?: string[], done?: () => void): void {
    const list = stock ?? shopStock(this.badges.length);
    this.openMenu({
      title: 'MOCK MART',
      items: list.map((id) => `${itemName(id)}  $${ITEMS[id].price}`),
      index: 0,
      info: [`Money: $${this.money}`, 'A: buy 1   B: leave'],
      onSelect: (i) => {
        const id = list[i];
        const price = ITEMS[id].price;
        if (this.money < price) return;
        this.money -= price;
        this.inventory[id] = (this.inventory[id] ?? 0) + 1;
        this.menu!.info = [`Money: $${this.money}`, `Bought ${itemName(id)}!`];
      },
      onCancel: () => {
        this.closeAllMenus();
        this.showDialogue(['CLERK: Thank you! Come again!'], done);
      },
    });
  }

  startBattle(trainerId: string, done: (outcome: 'win' | 'lose' | 'run' | 'caught' | null) => void): void {
    const trainer = trainerById(trainerId);
    if (!trainer) {
      done(null);
      return;
    }
    this.beginBattle(
      {
        kind: 'trainer',
        trainer: {
          name: trainer.name,
          spriteKey: trainer.spriteKey,
          party: trainer.party.map((p) => createMockemon(p.species, p.level)),
          prize: trainer.prize,
          introText: trainer.introText,
          defeatText: trainer.defeatText,
          ai: trainer.ai,
          potions: trainer.potions,
        },
      },
      (outcome) => {
        if (outcome === 'win') {
          this.defeatedTrainers.add(trainer.id);
          this.money += trainer.prize;
          this.onTrainerDefeated(trainer.id);
          const after = [trainer.defeatText, `You got $${trainer.prize} for winning!`];
          const gym = GYM_BY_LEADER[trainer.id];
          if (gym) {
            this.awardBadge(gym, after, () => done('win'));
            return;
          }
          if (trainer.id === 'champion_kai') {
            this.onChampionDefeated(after);
            return;
          }
          this.showDialogue(after, () => done('win'));
          return;
        }
        if (outcome === 'lose') this.whiteOut();
        done(outcome as 'lose' | 'run' | 'caught' | null);
      },
    );
  }

  warp(map: string, x: number, y: number): void {
    if (!MAPS[map]) return;
    this.mapId = map;
    this.px = x;
    this.py = y;
    this.moving = false;
    this.moveOffX = 0;
    this.moveOffY = 0;
  }

  questState(quest: string): { active: boolean; done: boolean; stage: string | null } {
    return this.quests.state(quest);
  }

  questStart(quest: string): void {
    this.quests.start(quest);
  }

  questAdvance(quest: string, stage?: string): void {
    this.quests.advance(quest, stage);
  }

  questComplete(quest: string): void {
    this.quests.complete(quest);
    const reward = QUESTS[quest]?.reward;
    if (!reward) return;
    if (reward.item) this.giveItem(reward.item, reward.count ?? 1);
    if (reward.money) this.changeMoney(reward.money);
    if (reward.mon) this.giveMon(reward.mon.species, reward.mon.level);
  }

  playCutscene(id: string, done: () => void): void {
    void id;
    done();
  }

  tileAt(x: number, y: number): string {
    const rows = this.map.tiles;
    if (y < 0 || y >= rows.length || x < 0 || x >= rows[0].length) return 'T';
    return rows[y][x];
  }

  gateAt(x: number, y: number): Gate | undefined {
    return this.map.gates?.find((g) => g.x === x && g.y === y);
  }

  gateOpen(gate: Gate): boolean {
    return !!this.flags[gate.flag];
  }

  /** 'x' lava tiles are only crossable while retracted. */
  lavaHot(): boolean {
    const period = this.map.lavaPeriod ?? 0;
    if (period <= 0) return false;
    return this.frame % (period * 2) < period;
  }

  isBlocked(x: number, y: number, dir?: Facing): boolean {
    const tile = this.tileAt(x, y);
    if (SOLID_TILES.has(tile)) {
      // doors that are warps are walkable
      if (this.map.warps.some((w) => w.x === x && w.y === y)) return false;
      return true;
    }
    if (tile === SHALLOW_TILE && !this.flags[BADGE_FLAG_SHALLOW]) return true;
    if (tile === 'x' && this.lavaHot()) return true;
    const gate = this.gateAt(x, y);
    if (gate && !this.gateOpen(gate)) return true;
    if (dir) {
      const one = this.map.oneWay?.find((o) => o.x === x && o.y === y);
      if (one && one.dir !== dir) return true;
    }
    for (const npc of this.map.npcs) {
      if (this.npcVisible(npc) && npc.x === x && npc.y === y) return true;
    }
    return false;
  }

  // ---------- title / save ----------

  hasSave(): boolean {
    try {
      return SLOT_KEYS.some((k) => !!localStorage.getItem(k));
    } catch {
      return false;
    }
  }

  slotKey(): string {
    return SLOT_KEYS[this.slot] ?? SLOT_KEYS[0];
  }

  toSaveData(): SaveData {
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      playFrames: this.playFrames,
      quests: this.quests.toJSON(),
      mapId: this.mapId,
      px: this.px,
      py: this.py,
      party: this.party,
      storage: this.storage,
      inventory: this.inventory,
      money: this.money,
      badges: this.badges,
      flags: this.flags,
      defeatedTrainers: [...this.defeatedTrainers],
      collectedItems: [...this.collectedItems],
      healPoint: this.healPoint,
      seen: [...this.seenSpecies],
      caught: [...this.caughtSpecies],
      minute: this.minute,
      daycare: this.daycare,
      daycareSteps: this.daycareSteps,
      daycareEgg: this.daycareEgg,
    };
  }

  save(): void {
    localStorage.setItem(this.slotKey(), encodeSave(this.toSaveData()));
  }

  /** Best-effort save; storage may be unavailable (private mode, quota). */
  persist(): boolean {
    try {
      this.save();
      return true;
    } catch {
      return false;
    }
  }

  load(slot = this.slot): boolean {
    this.slot = slot;
    let raw: string | null;
    try {
      raw = localStorage.getItem(this.slotKey());
    } catch {
      return false;
    }
    if (!raw) return false;
    const d = decodeSave(raw);
    if (!d) return false;
    this.resetRunState();
    this.mapId = d.mapId;
    this.px = d.px;
    this.py = d.py;
    this.party = d.party;
    this.storage = d.storage ?? [];
    this.inventory = d.inventory ?? { potion: 0, superpotion: 0, mockball: 0 };
    this.money = d.money ?? 3000;
    this.badges = d.badges ?? [];
    this.flags = d.flags ?? {};
    this.defeatedTrainers = new Set(d.defeatedTrainers ?? []);
    this.collectedItems = new Set(d.collectedItems ?? []);
    this.healPoint = d.healPoint ?? { map: 'mapletown', x: 7, y: 9 };
    this.seenSpecies = new Set(d.seen ?? []);
    this.caughtSpecies = new Set(d.caught ?? []);
    this.minute = d.minute ?? 600;
    this.daycare = d.daycare ?? [null, null];
    this.daycareSteps = d.daycareSteps ?? 0;
    this.daycareEgg = d.daycareEgg ?? null;
    this.quests = new QuestLog(QUESTS, d.quests ?? migrateQuests(this.flags, this.badges));
    this.playFrames = d.playFrames ?? 0;
    this.mode = 'overworld';
    return true;
  }

  /** Return every run-scoped field to its first-boot value. */
  resetRunState(): void {
    this.party = [];
    this.storage = [];
    this.inventory = { potion: 0, superpotion: 0, mockball: 0 };
    this.money = 3000;
    this.badges = [];
    this.flags = {};
    this.defeatedTrainers = new Set();
    this.collectedItems = new Set();
    this.healPoint = { map: 'mapletown', x: 7, y: 9 };
    this.seenSpecies = new Set();
    this.caughtSpecies = new Set();
    this.minute = 600;
    this.daycare = [null, null];
    this.daycareSteps = 0;
    this.daycareEgg = null;
    this.dexIndex = 0;
    this.dialogueQueue = [];
    this.dialogueDone = null;
    this.menu = null;
    this.menuStack = [];
    this.battle = null;
    this.battleOnEnd = null;
    this.battleForcedSwitch = false;
    this.summaryMon = null;
    this.pendingHealItem = null;
    this.pendingGiveItem = null;
    this.pendingStone = null;
    this.endingShown = false;
    this.playFrames = 0;
    this.moving = false;
    this.moveOffX = 0;
    this.moveOffY = 0;
    this.scripts.abort();
    this.quests = new QuestLog(QUESTS);
  }

  newGame(): void {
    this.resetRunState();
    this.mapId = 'lab';
    this.px = 5;
    this.py = 6;
    this.facing = 'up';
    this.mode = 'overworld';
    this.showDialogue([
      'PROF. MAPLE: Welcome to the world of MOCKEMON!',
      'PROF. MAPLE: This world is inhabited by curious creatures called Mockemon. Some keep them as pets. I study them. Others battle with them!',
      'PROF. MAPLE: Your very own Mockemon story is about to unfold! Come, talk to me and pick your first partner!',
    ]);
  }

  // ---------- overworld ----------

  updateOverworld(): void {
    // a running script owns the player: swallow input between its dialogue pages
    if (this.scripts.running) {
      consumePress();
      return;
    }
    if (this.moving) {
      const speed = 4;
      if (this.moveOffX > 0) this.moveOffX = Math.max(0, this.moveOffX - speed);
      if (this.moveOffX < 0) this.moveOffX = Math.min(0, this.moveOffX + speed);
      if (this.moveOffY > 0) this.moveOffY = Math.max(0, this.moveOffY - speed);
      if (this.moveOffY < 0) this.moveOffY = Math.min(0, this.moveOffY + speed);
      if (this.moveOffX === 0 && this.moveOffY === 0) {
        this.moving = false;
        this.onStepComplete();
      }
      return;
    }

    let k: Key | null = null;
    const pressed = consumePress();
    if (pressed) k = pressed;
    else if (isHeld('up')) k = 'up';
    else if (isHeld('down')) k = 'down';
    else if (isHeld('left')) k = 'left';
    else if (isHeld('right')) k = 'right';

    if (!k) return;

    if (k === 'a') {
      this.interact();
      return;
    }
    if (k === 'start') {
      this.openStartMenu();
      return;
    }
    if (k === 'b') return;

    const dir = k as Facing;
    this.facing = dir;
    this.stepTo(dir);
  }

  stepTo(dir: Facing): boolean {
    const [dx, dy] = deltas(dir);
    const nx = this.px + dx;
    const ny = this.py + dy;
    if (this.isBlocked(nx, ny, dir)) return false;
    this.px = nx;
    this.py = ny;
    this.moveOffX = -dx * TILE;
    this.moveOffY = -dy * TILE;
    this.moving = true;
    return true;
  }

  onStepComplete(): void {
    // warps
    const warp = this.map.warps.find((w) => w.x === this.px && w.y === this.py);
    if (warp && warp.to === 'route1' && this.mapId === 'mapletown' && !this.flags.starterChosen) {
      this.py += 1;
      this.showDialogue(["It's dangerous to go out without a Mockemon! Visit Prof. Maple's lab first."]);
      return;
    }
    if (warp) {
      this.mapId = warp.to;
      this.px = warp.tx;
      this.py = warp.ty;
      this.fireEvent(this.map.onEnter);
      return;
    }
    const pad = this.map.pads?.find((p) => p.x === this.px && p.y === this.py);
    if (pad) {
      this.px = pad.tx;
      this.py = pad.ty;
      return;
    }
    if (this.tileAt(this.px, this.py) === '#' && this.map.windDir) {
      if (this.stepTo(this.map.windDir)) return;
    }
    if (this.fireEvent(this.map.events?.find((e) => e.x === this.px && e.y === this.py))) return;
    // ground items
    const item = this.map.items.find(
      (it) => it.x === this.px && it.y === this.py && !this.collectedItems.has(it.id),
    );
    if (item) {
      this.collectedItems.add(item.id);
      this.inventory[item.item] = (this.inventory[item.item] ?? 0) + item.count;
      this.showDialogue([
        `You found ${item.count > 1 ? item.count + 'x ' : ''}${itemName(item.item)}!`,
      ]);
      return;
    }
    // party eggs tick down as you walk
    for (const m of this.party) {
      if (m.isEgg && tickEgg(m, 1)) {
        this.seenSpecies.add(m.species);
        this.caughtSpecies.add(m.species);
        this.showDialogue(['Oh?', `The Egg hatched into ${SPECIES[m.species].name}!`]);
        return;
      }
    }
    // daycare breeding progress
    if (this.daycare[0] && this.daycare[1] && !this.daycareEgg && canBreed(this.daycare[0], this.daycare[1])) {
      this.daycareSteps++;
      if (this.daycareSteps >= 256) {
        this.daycareSteps = 0;
        this.daycareEgg = makeEgg(this.daycare[0], this.daycare[1]);
      }
    }
    // rival ambush in lab
    if (
      this.mapId === 'lab' &&
      this.flags.starterChosen &&
      !this.flags.rivalBeaten &&
      this.py >= 6
    ) {
      this.startRivalBattle();
      return;
    }
    // trainer line of sight
    for (const npc of this.map.npcs) {
      const t = npc.trainer;
      if (!t || t.sight === 0 || this.defeatedTrainers.has(t.id) || !this.npcVisible(npc)) continue;
      if (this.inSight(npc) && this.party.some((m) => m.hp > 0 && !m.isEgg)) {
        this.startTrainerBattle(npc);
        return;
      }
    }
    // wild encounters
    if (
      this.tileAt(this.px, this.py) === 'G' &&
      this.map.encounters.length > 0 &&
      !this.noEncounters &&
      this.party.some((m) => m.hp > 0 && !m.isEgg) &&
      chance(this.map.encounterRate)
    ) {
      this.startWildBattle();
    }
  }

  inSight(npc: Npc): boolean {
    const t = npc.trainer!;
    const [dx, dy] = deltas(npc.facing);
    for (let i = 1; i <= t.sight; i++) {
      const x = npc.x + dx * i;
      const y = npc.y + dy * i;
      if (this.px === x && this.py === y) return true;
      if (SOLID_TILES.has(this.tileAt(x, y))) return false;
    }
    return false;
  }

  interact(): void {
    const [dx, dy] = deltas(this.facing);
    const tx = this.px + dx;
    const ty = this.py + dy;

    const npc = this.map.npcs.find((n) => n.x === tx && n.y === ty && this.npcVisible(n));
    if (npc) {
      this.talkTo(npc);
      return;
    }
    // talk over counters
    if (this.tileAt(tx, ty) === 'C') {
      const beyond = this.map.npcs.find(
        (n) => n.x === tx + dx && n.y === ty + dy && this.npcVisible(n),
      );
      if (beyond) {
        this.talkTo(beyond);
        return;
      }
    }
    const button = this.map.buttons?.find((b) => b.x === tx && b.y === ty);
    if (button) {
      this.flags[button.flag] = button.toggle === false ? true : !this.flags[button.flag];
      this.showDialogue([
        button.text ?? (this.flags[button.flag] ? 'The switch clicks. Something opened!' : 'The switch clicks back. Something closed.'),
      ]);
      return;
    }
    const closedGate = this.map.gates?.find((g) => g.x === tx && g.y === ty && !this.gateOpen(g));
    if (closedGate) {
      this.showDialogue([closedGate.text ?? 'A shutter blocks the way. There must be a switch somewhere.']);
      return;
    }
    const sign = this.map.signs.find((s) => s.x === tx && s.y === ty);
    if (sign) {
      this.showDialogue([sign.text]);
      return;
    }
    const door = this.map.lockedDoors.find((d) => d.x === tx && d.y === ty);
    if (door) {
      this.showDialogue([door.text]);
      return;
    }
    if (this.tileAt(tx, ty) === 'P') {
      if (!this.flags.starterChosen) {
        this.showDialogue(['Three MockBalls rest on the table. Prof. Maple watches you expectantly. Talk to her to choose!']);
      } else {
        this.showDialogue(['The remaining MockBalls hum quietly.']);
      }
    }
  }

  talkTo(npc: Npc): void {
    if (npc.trainer && !this.defeatedTrainers.has(npc.trainer.id)) {
      this.startTrainerBattle(npc);
      return;
    }
    if (npc.script) {
      this.runScript(npc.script);
      return;
    }
    switch (npc.action) {
      case 'starter':
        this.starterDialogue();
        return;
      case 'shop':
        this.openShop();
        return;
      case 'gymleader': {
        const gym = GYMS.find((g) => g.mapId === this.mapId);
        this.showDialogue([
          gym && this.flags[gym.badgeFlag]
            ? `${gym.leaderName}: The ${gym.badge} suits you. ${gym.nextHint}`
            : `${gym?.leaderName ?? 'Leader'}: ...`,
        ]);
        return;
      }
      case 'daycare':
        this.daycareDialogue();
        return;
      case 'trade':
        this.tradeDialogue();
        return;
      default:
        if (npc.dialogue.length > 0) this.showDialogue(npc.dialogue);
    }
  }

  daycareDialogue(): void {
    const [a, b] = this.daycare;
    const lines: string[] = ['DAYCARE LADY: Welcome to the Mockemon Daycare! I raise your Mockemon while you adventure.'];
    if (a && b) {
      const err = breedError(a, b);
      lines.push(
        err
          ? `Your ${displayName(a)} and ${displayName(b)}... ${err}`
          : `Your ${displayName(a)} and ${displayName(b)} are getting along wonderfully!`,
      );
      if (this.daycareEgg) lines.push('Oh! I found an EGG! Will you take it?');
      else lines.push('Who knows, an Egg might appear if you keep walking around!');
    } else if (a || b) {
      lines.push(`Your ${displayName((a ?? b)!)} is doing fine. Leave one more and maybe an Egg will appear!`);
    } else {
      lines.push('Leave two compatible Mockemon with me, and you might find an Egg later!');
    }
    this.showDialogue(lines, () => this.openDaycareMenu());
  }

  openDaycareMenu(): void {
    const options: string[] = [];
    if (this.daycareEgg) options.push('TAKE EGG');
    if (this.daycare.some((m) => m === null)) options.push('DEPOSIT');
    if (this.daycare.some((m) => m !== null)) options.push('TAKE BACK');
    options.push('BYE');
    this.openMenu({
      title: 'DAYCARE',
      items: options,
      index: 0,
      info: this.daycare.map((m, i) => `Slot ${i + 1}: ${m ? `${displayName(m)} Lv${m.level}` : '(empty)'}`),
      onSelect: (i) => {
        const sel = options[i];
        if (sel === 'TAKE EGG') {
          const egg = this.daycareEgg!;
          this.daycareEgg = null;
          this.closeAllMenus();
          if (this.party.length < 6) {
            this.party.push(egg);
            this.showDialogue(['You received the Egg! It will hatch as you walk with it.']);
          } else {
            this.storage.push(egg);
            this.showDialogue(['Your party is full! The Egg was sent to storage.']);
          }
        } else if (sel === 'DEPOSIT') {
          this.openDaycareDeposit();
        } else if (sel === 'TAKE BACK') {
          this.openDaycareTakeBack();
        } else {
          this.closeAllMenus();
        }
      },
      onCancel: () => this.closeAllMenus(),
    });
  }

  openDaycareDeposit(): void {
    const candidates = this.party.map((m, i) => ({ m, i }));
    if (this.party.length <= 1) {
      this.closeAllMenus();
      this.showDialogue(['DAYCARE LADY: You cannot leave your only Mockemon with me!']);
      return;
    }
    this.openMenu(
      {
        title: 'Deposit which?',
        items: candidates.map(({ m }) => `${m.isEgg ? 'EGG' : displayName(m)} Lv${m.level}`),
        index: 0,
        onSelect: (i) => {
          if (this.party.length <= 1) return;
          const mon = this.party[i];
          this.party.splice(i, 1);
          const slot = this.daycare[0] === null ? 0 : 1;
          this.daycare[slot] = mon;
          this.daycareSteps = 0;
          this.closeAllMenus();
          this.showDialogue([`DAYCARE LADY: I will take good care of ${displayName(mon)}!`]);
        },
        onCancel: () => this.openDaycareMenu(),
      },
      true,
    );
  }

  openDaycareTakeBack(): void {
    const deposited = this.daycare
      .map((m, i) => ({ m, i }))
      .filter((x): x is { m: Mockemon; i: number } => x.m !== null);
    this.openMenu(
      {
        title: 'Take back which?',
        items: deposited.map(({ m }) => `${m.isEgg ? 'EGG' : displayName(m)} Lv${m.level}`),
        index: 0,
        onSelect: (i) => {
          if (this.party.length >= 6) {
            this.closeAllMenus();
            this.showDialogue(['Your party is full! Make room first.']);
            return;
          }
          const { m, i: slot } = deposited[i];
          this.daycare[slot] = null;
          this.daycareSteps = 0;
          this.party.push(m);
          this.closeAllMenus();
          this.showDialogue([`Welcome back, ${displayName(m)}!`]);
        },
        onCancel: () => this.openDaycareMenu(),
      },
      true,
    );
  }

  tradeDialogue(): void {
    if (this.flags.hikerTraded) {
      this.showDialogue(['HIKER: How is my old Pebblit doing? It was a fine trade, was it not?']);
      return;
    }
    this.quests.start('hiker_trade');
    this.quests.advance('hiker_trade', 'trade');
    this.showDialogue(
      [
        'HIKER: I found this Pebblit in the mountains, but it misses adventure!',
        'HIKER: I will trade my Pebblit (Lv15) for any one of your Mockemon. What do you say?',
      ],
      () => {
        this.openMenu({
          title: 'Trade with the hiker?',
          items: ['TRADE', 'NO THANKS'],
          index: 0,
          onSelect: (i) => {
            if (i !== 0) {
              this.closeAllMenus();
              this.showDialogue(['HIKER: Maybe next time!']);
              return;
            }
            this.openTradeSelect();
          },
          onCancel: () => this.closeAllMenus(),
        });
      },
    );
  }

  openTradeSelect(): void {
    if (this.party.length <= 1) {
      this.closeAllMenus();
      this.showDialogue(['HIKER: You only have one Mockemon! I could never take it.']);
      return;
    }
    this.openMenu(
      {
        title: 'Give which Mockemon?',
        items: this.party.map((m) => `${m.isEgg ? 'EGG' : displayName(m)} Lv${m.level}`),
        index: 0,
        onSelect: (i) => {
          if (this.party.length <= 1) return;
          const given = this.party[i];
          if (given.isEgg) {
            this.showDialogue(['HIKER: An Egg? I would not know what to do with it!'], () => this.openTradeSelect());
            return;
          }
          this.party.splice(i, 1);
          const received = createMockemon('pebblit', 15);
          this.party.push(received);
          this.flags.hikerTraded = true;
          this.seenSpecies.add('pebblit');
          this.caughtSpecies.add('pebblit');
          this.quests.complete('hiker_trade');
          this.closeAllMenus();
          const evoTo = checkEvolution(received, { kind: 'trade' });
          const lines = [
            `You traded away ${displayName(given)}!`,
            `You received ${displayName(received)}! Take good care of it.`,
          ];
          if (evoTo) {
            lines.push('What? The traded Pebblit is glowing!');
            this.showDialogue(lines, () => {
              evolve(received, evoTo);
              this.seenSpecies.add(evoTo);
              this.caughtSpecies.add(evoTo);
              this.showDialogue([`It evolved into ${SPECIES[evoTo].name} right after the trade!`]);
            });
          } else {
            this.showDialogue(lines);
          }
        },
        onCancel: () => this.closeAllMenus(),
      },
      true,
    );
  }

  starterDialogue(): void {
    if (this.flags.starterChosen) {
      this.showDialogue(
        [
          `PROF. MAPLE: How is ${this.party[0]?.nickname ?? 'your partner'} doing? Let me have a look... There, all patched up!`,
          'PROF. MAPLE: Come back any time your team needs healing. And go challenge the Verdant Gym north of Route 1!',
        ],
        () => {
          for (const m of this.party) healFull(m);
        },
      );
      return;
    }
    this.showDialogue(
      [
        'PROF. MAPLE: On this table are three rare Mockemon I raised myself.',
        'PROF. MAPLE: Sproutle, the Grass-type. Cindercub, the Fire-type. And Puddlefin, the Water-type.',
        'PROF. MAPLE: Go on, choose your partner!',
      ],
      () => this.openStarterMenu(),
    );
  }

  openStarterMenu(): void {
    const starters = ['sproutle', 'cindercub', 'puddlefin'];
    this.openMenu({
      title: 'Choose your partner!',
      items: starters.map((s) => `${SPECIES[s].name} (${SPECIES[s].types.join('/')})`),
      index: 0,
      info: ['Choose wisely...'],
      onSelect: (i) => {
        const key = starters[i];
        this.openMenu(
          {
            title: `Choose ${SPECIES[key].name}?`,
            items: ['YES', 'NO'],
            index: 0,
            onSelect: (j) => {
              if (j === 0) {
                this.closeAllMenus();
                const mon = createMockemon(key, 5);
                this.party = [mon];
                this.flags.starterChosen = true;
                this.flags[`starter_${key}`] = true;
                this.seenSpecies.add(key);
                this.caughtSpecies.add(key);
                this.quests.start('main_journey');
                this.quests.advance('main_journey', 'parcel');
                this.quests.start('parcel');
                this.showDialogue([
                  `You chose ${mon.nickname}!`,
                  'PROF. MAPLE: A fine choice! Raise it with love.',
                  'KAI: Hold it right there!',
                  "KAI: If you're getting a Mockemon, then I'm taking the one that beats yours! Heh!",
                ]);
              } else {
                this.closeMenu();
              }
            },
            onCancel: () => this.closeMenu(),
          },
          true,
        );
      },
      onCancel: () => this.closeAllMenus(),
    });
  }

  startRivalBattle(): void {
    const counter: Record<string, string> = {
      sproutle: 'cindercub',
      cindercub: 'puddlefin',
      puddlefin: 'sproutle',
    };
    const playerStarter = this.party[0]?.species;
    if (!playerStarter) return;
    const rivalMon = counter[playerStarter] ?? 'cindercub';
    this.showDialogue(
      ["KAI: Not so fast! Let's see whose Mockemon is stronger. Battle me!"],
      () => {
        this.beginBattle(
          {
            kind: 'trainer',
            trainer: {
              name: 'Rival Kai',
              spriteKey: 'rival',
              party: [createMockemon(rivalMon, 5)],
              prize: 200,
              introText: '',
              defeatText: 'KAI: What?! I picked the wrong one...',
            },
          },
          (outcome) => {
            if (outcome === 'win') {
              this.flags.rivalBeaten = true;
              this.showDialogue([
                'KAI: Hmph! I went easy on you. Next time will be different!',
                'Kai stormed out of the lab.',
                'PROF. MAPLE: Ha! That Kai is all bark. Take this MockDex journey seriously, and go challenge Leader Terra in Verdant City!',
              ]);
            } else if (outcome === 'lose') {
              this.flags.rivalBeaten = true;
              for (const m of this.party) healFull(m);
              this.showDialogue([
                'KAI: Heh! Exactly as I planned!',
                'Kai strutted out of the lab.',
                'PROF. MAPLE: Do not be discouraged. I healed your Mockemon. Head north when you are ready.',
              ]);
            }
          },
        );
      },
    );
  }

  startTrainerBattle(npc: Npc): void {
    const t = npc.trainer!;
    this.showDialogue([t.introText], () => {
      this.beginBattle(
        {
          kind: 'trainer',
          trainer: {
            name: t.name,
            spriteKey: t.spriteKey,
            party: t.party.map((p) => createMockemon(p.species, p.level)),
            prize: t.prize,
            introText: t.introText,
            defeatText: t.defeatText,
            ai: t.ai,
            potions: t.potions,
          },
        },
        (outcome) => {
          if (outcome === 'win') {
            this.defeatedTrainers.add(t.id);
            this.money += t.prize;
            const after = [`${t.defeatText}`, `You got $${t.prize} for winning!`];
            const gym = GYM_BY_LEADER[t.id];
            if (gym) {
              this.awardBadge(gym, after);
              return;
            }
            if (t.id === 'champion_kai') {
              this.onChampionDefeated(after);
              return;
            }
            this.onTrainerDefeated(t.id);
            this.showDialogue(after);
          } else if (outcome === 'lose') {
            this.whiteOut();
          }
        },
      );
    });
  }

  /** Elite Four rooms and story gates open by flag as soon as their trainer falls. */
  onTrainerDefeated(id: string): void {
    for (const flag of TRAINER_UNLOCK_FLAGS[id] ?? []) this.flags[flag] = true;
  }

  awardBadge(gym: GymDef, after: string[], done?: () => void): void {
    if (!this.badges.includes(gym.badge)) this.badges.push(gym.badge);
    this.flags[gym.badgeFlag] = true;
    this.flags[`gym${gym.n}Done`] = true;
    if (gym.n === 1) this.flags.gymDone = true; // legacy flag kept for old saves and tests
    this.quests.advance('main_journey', gym.questStage);
    if (this.badges.length >= GYMS.length) this.flags.leagueOpen = true;
    after.push(
      `${gym.leaderName}: Take the ${gym.badge.toUpperCase()}. You earned every letter of it.`,
      gym.nextHint,
    );
    this.autosave();
    this.showDialogue(after, done);
  }

  onChampionDefeated(after: string[]): void {
    this.flags.championBeaten = true;
    this.flags.postGame = true;
    this.quests.advance('main_journey', 'champion');
    this.quests.complete('main_journey');
    this.autosave();
    this.showDialogue(after, () => {
      this.mode = 'ending';
    });
  }

  autosave(): void {
    this.persist();
  }

  rollEncounter(): EncounterEntry {
    const table = this.map.encounters;
    const night = phaseFor(this.minute) === 'night';
    const weightOf = (e: EncounterEntry): number => (night ? (e.nightWeight ?? e.weight * 0.25) : e.weight);
    const total = table.reduce((s, e) => s + weightOf(e), 0);
    let roll = rand() * total;
    let entry = table[0];
    for (const e of table) {
      roll -= weightOf(e);
      if (roll <= 0) {
        entry = e;
        break;
      }
    }
    return entry;
  }

  startWildBattle(): void {
    const entry = this.rollEncounter();
    const mon = createMockemon(entry.species, randInt(entry.minLv, entry.maxLv));
    this.seenSpecies.add(mon.species);
    this.beginBattle({ kind: 'wild', mon }, (outcome) => {
      if (outcome === 'lose') this.whiteOut();
      if (outcome === 'caught' && this.battle?.caughtMon) {
        const caught = this.battle.caughtMon;
        this.caughtSpecies.add(caught.species);
        if (this.party.length < 6) {
          this.party.push(caught);
          this.showDialogue([`${caught.nickname} was added to your party!`]);
        } else {
          this.storage.push(caught);
          this.showDialogue([`Your party is full! ${caught.nickname} was sent to storage.`]);
        }
      }
    });
  }

  whiteOut(): void {
    const lost = Math.floor(this.money / 2);
    this.money -= lost;
    for (const m of this.party) healFull(m);
    this.mapId = this.healPoint.map;
    this.px = this.healPoint.x;
    this.py = this.healPoint.y;
    this.showDialogue([
      `You panicked and dropped $${lost}...`,
      'You scurried back to safety and your Mockemon were fully healed.',
    ]);
  }

  // ---------- battle UI ----------

  beginBattle(kind: BattleKind, onEnd: (outcome: string) => void): void {
    this.battle = new Battle(this.party, kind);
    this.battleOnEnd = onEnd;
    this.mode = 'battle';
    this.battlePhase = 'msg';
    this.battleForcedSwitch = false;
    this.battleMenuIndex = 0;
    if (kind.kind === 'wild') {
      this.battleSpriteKey = '';
      this.battleMsgs = [`A wild ${kind.mon.nickname} appeared!`, `Go, ${this.battle.active.nickname}!`];
    } else {
      this.battleSpriteKey = kind.trainer.spriteKey;
      this.battleMsgs = [
        `${kind.trainer.name} wants to battle!`,
        `${kind.trainer.name} sent out ${this.battle.enemy.nickname}!`,
        `Go, ${this.battle.active.nickname}!`,
      ];
    }
    this.seenSpecies.add(this.battle.enemy.species);
  }

  battleAct(action: PlayerAction): void {
    const b = this.battle!;
    if (action.type === 'item') {
      const fail = (msg: string): void => {
        this.battleMsgs = [msg];
        this.battlePhase = 'msg';
      };
      if ((this.inventory[action.item] ?? 0) <= 0) {
        fail(`You have no ${itemName(action.item)} left!`);
        return;
      }
      if (action.item === 'mockball' && b.isTrainer) {
        fail("Can't catch a trainer's Mockemon!");
        return;
      }
      if ((action.item === 'potion' || action.item === 'superpotion') && b.active.hp >= b.active.maxHp) {
        fail('It would have no effect.');
        return;
      }
      this.inventory[action.item]--;
    }
    this.battleMsgs = b.takeTurn(action);
    this.battlePhase = 'msg';
  }

  updateBattle(): void {
    const b = this.battle!;
    const k = consumePress();
    if (!k) return;

    if (this.battlePhase === 'msg') {
      if (k === 'a' || k === 'b') {
        if (this.battleMsgs.length > 0) this.battleMsgs.shift();
        if (this.battleMsgs.length === 0) {
          if (b.outcome) {
            this.endBattle();
          } else if (b.needsSwitch) {
            this.battleForcedSwitch = true;
            this.battlePhase = 'party';
            this.battleMenuIndex = 0;
          } else {
            this.battlePhase = 'action';
            this.battleMenuIndex = 0;
          }
        }
      }
      return;
    }

    if (this.battlePhase === 'action') {
      const grid = ['FIGHT', 'BAG', 'MOCKMON', 'RUN'];
      if (k === 'up' || k === 'down') this.battleMenuIndex = (this.battleMenuIndex + 2) % 4;
      if (k === 'left' || k === 'right')
        this.battleMenuIndex = this.battleMenuIndex % 2 === 0 ? this.battleMenuIndex + 1 : this.battleMenuIndex - 1;
      if (k === 'a') {
        const sel = grid[this.battleMenuIndex];
        if (sel === 'FIGHT') {
          this.battlePhase = 'moves';
          this.battleMenuIndex = 0;
        } else if (sel === 'BAG') {
          this.battlePhase = 'bag';
          this.battleMenuIndex = 0;
        } else if (sel === 'MOCKMON') {
          this.battlePhase = 'party';
          this.battleMenuIndex = 0;
        } else {
          this.battleAct({ type: 'run' });
        }
      }
      return;
    }

    if (this.battlePhase === 'moves') {
      const moves = b.active.moves;
      const struggleOnly = moves.every((ms) => ms.pp <= 0);
      const count = struggleOnly ? 1 : moves.length;
      if (k === 'up') this.battleMenuIndex = Math.max(0, this.battleMenuIndex - 1);
      if (k === 'down') this.battleMenuIndex = Math.min(count - 1, this.battleMenuIndex + 1);
      if (k === 'b') {
        this.battlePhase = 'action';
        this.battleMenuIndex = 0;
      }
      if (k === 'a' && (struggleOnly || moves[this.battleMenuIndex].pp > 0)) {
        this.battleAct({ type: 'move', index: struggleOnly ? 0 : this.battleMenuIndex });
      }
      return;
    }

    if (this.battlePhase === 'bag') {
      const items = ['potion', 'superpotion', 'mockball'];
      if (k === 'up') this.battleMenuIndex = Math.max(0, this.battleMenuIndex - 1);
      if (k === 'down') this.battleMenuIndex = Math.min(items.length - 1, this.battleMenuIndex + 1);
      if (k === 'b') {
        this.battlePhase = 'action';
        this.battleMenuIndex = 1;
      }
      if (k === 'a') this.battleAct({ type: 'item', item: items[this.battleMenuIndex] as 'potion' | 'superpotion' | 'mockball' });
      return;
    }

    if (this.battlePhase === 'party') {
      if (k === 'up') this.battleMenuIndex = Math.max(0, this.battleMenuIndex - 1);
      if (k === 'down') this.battleMenuIndex = Math.min(this.party.length - 1, this.battleMenuIndex + 1);
      if (k === 'b' && !this.battleForcedSwitch) {
        this.battlePhase = 'action';
        this.battleMenuIndex = 2;
      }
      if (k === 'a') {
        const idx = this.battleMenuIndex;
        const target = this.party[idx];
        if (!target || target.hp <= 0 || target.isEgg) return;
        if (this.battleForcedSwitch) {
          const msgs: string[] = [];
          b.forcedSwitch(idx, msgs);
          this.battleForcedSwitch = false;
          this.battleMsgs = msgs;
          this.battlePhase = 'msg';
        } else {
          if (idx === b.activeIndex) return;
          this.battleAct({ type: 'switch', index: idx });
        }
      }
      return;
    }
  }

  processPendingMoves(done?: () => void): void {
    const mon = this.party.find((m) => m.pendingMoves.length > 0);
    if (!mon) {
      if (done) done();
      return;
    }
    const moveId = mon.pendingMoves[0];
    const mv = MOVES[moveId];
    this.openMenu({
      title: `${displayName(mon)} wants to learn ${mv.name}!`,
      items: [...mon.moves.map((ms) => `Forget ${MOVES[ms.id].name}`), 'Keep old moves'],
      index: 0,
      info: [`${mv.type} / ${mv.category} / pow ${mv.power}`, 'Choose a move to forget:'],
      onSelect: (i) => {
        if (i < mon.moves.length) {
          const forgotten = MOVES[mon.moves[i].id].name;
          learnMove(mon, moveId, i);
          mon.pendingMoves.shift();
          this.closeAllMenus();
          this.showDialogue(
            [`1, 2, and... Poof!`, `${displayName(mon)} forgot ${forgotten} and learned ${mv.name}!`],
            () => this.processPendingMoves(done),
          );
        } else {
          mon.pendingMoves.shift();
          this.closeAllMenus();
          this.showDialogue([`${displayName(mon)} gave up on learning ${mv.name}.`], () =>
            this.processPendingMoves(done),
          );
        }
      },
      onCancel: null, // the prompt must be answered
    });
  }

  endBattle(): void {
    const b = this.battle!;
    const outcome = b.outcome ?? 'run';
    this.mode = 'overworld';
    const cb = this.battleOnEnd;
    this.battleOnEnd = null;
    const finish = (): void => {
      if (cb) cb(outcome); // cb may read battle.caughtMon
      this.battle = null;
    };
    // forget-a-move prompts run first, then the battle-end callback (badge dialogue etc.)
    if (this.party.some((m) => m.pendingMoves.length > 0)) {
      this.processPendingMoves(finish);
    } else {
      finish();
    }
  }

  // ---------- start menu / shop / bag / party ----------

  openStartMenu(): void {
    const objective = this.quests.nextObjective();
    this.openMenu({
      title: 'MENU',
      items: ['MOCKEMON', 'BAG', 'MOCKDEX', 'QUESTS', 'STORAGE', 'SAVE', 'EXIT'],
      index: 0,
      info: objective ? ['NEXT:', ...wrap(objective, 34)] : undefined,
      onSelect: (i) => {
        if (i === 0) this.openPartyMenu(null);
        else if (i === 1) this.openBagMenu();
        else if (i === 2) {
          this.menu = null;
          this.dexIndex = 0;
          this.mode = 'dex';
        } else if (i === 3) this.openQuestMenu();
        else if (i === 4) this.openStorageMenu();
        else if (i === 5) {
          const ok = this.persist();
          this.closeAllMenus();
          this.showDialogue([ok ? 'Your progress was saved!' : 'Save failed! Storage is unavailable.']);
        } else this.closeAllMenus();
      },
      onCancel: () => this.closeAllMenus(),
    });
  }

  openQuestMenu(): void {
    const active = this.quests.active();
    const done = this.quests.completed();
    const entries = [...active, ...done];
    const updateInfo = (i: number): void => {
      const q = entries[i];
      if (q) this.menu!.info = wrap(this.quests.journal(q.id).slice(-1)[0] ?? '', 34);
    };
    this.openMenu(
      {
        title: 'QUEST LOG',
        items: entries.length > 0 ? entries.map((q) => `${this.quests.state(q.id).done ? '[x]' : '[ ]'} ${q.title}`) : ['(no quests yet)'],
        index: 0,
        info: entries.length > 0 ? wrap(this.quests.journal(entries[0].id).slice(-1)[0] ?? '', 34) : undefined,
        onSelect: (i) => updateInfo(i),
        onChange: (i) => updateInfo(i),
        onCancel: () => this.closeMenu(),
      },
      true,
    );
  }

  partyEntryLabel(m: Mockemon): string {
    if (m.isEgg) return `EGG  (steps: ${m.hatchSteps ?? 0})`;
    return `${displayName(m)} Lv${m.level}  ${m.hp}/${m.maxHp}${m.status ? ' ' + m.status : ''}${m.heldItem ? '  @' + itemName(m.heldItem) : ''}`;
  }

  openPartyMenu(healItem: string | null, push = true): void {
    this.pendingHealItem = healItem;
    this.openMenu(
      {
        title: healItem
          ? `Use ${itemName(healItem)} on:`
          : this.pendingGiveItem
            ? `Give ${itemName(this.pendingGiveItem)} to:`
            : this.pendingStone
              ? `Use ${itemName(this.pendingStone)} on:`
              : 'MOCKEMON',
        items: this.party.map((m) => this.partyEntryLabel(m)),
        index: 0,
        onSelect: (i) => {
          const mon = this.party[i];
          if (this.pendingHealItem) {
            const item = this.pendingHealItem;
            if (mon.isEgg || mon.hp <= 0 || mon.hp >= mon.maxHp) return;
            const heal = ITEMS[item].healAmount ?? 20;
            this.inventory[item]--;
            mon.hp = Math.min(mon.maxHp, mon.hp + heal);
            this.pendingHealItem = null;
            this.closeAllMenus();
            this.showDialogue([`${displayName(mon)} was healed!`]);
          } else if (this.pendingGiveItem) {
            const item = this.pendingGiveItem;
            const swapped = mon.heldItem;
            this.inventory[item]--;
            if (swapped) this.inventory[swapped] = (this.inventory[swapped] ?? 0) + 1;
            mon.heldItem = item;
            this.pendingGiveItem = null;
            this.closeAllMenus();
            this.showDialogue([
              swapped
                ? `${displayName(mon)} swapped ${itemName(swapped)} for ${itemName(item)}!`
                : `${displayName(mon)} is now holding ${itemName(item)}!`,
            ]);
          } else if (this.pendingStone) {
            const stone = this.pendingStone;
            const evoTo = checkEvolution(mon, { kind: 'stone', stone });
            if (!evoTo) {
              this.pendingStone = null;
              this.closeAllMenus();
              this.showDialogue(['It would not have any effect.']);
              return;
            }
            this.inventory[stone]--;
            this.pendingStone = null;
            this.closeAllMenus();
            const oldName = displayName(mon);
            evolve(mon, evoTo);
            this.seenSpecies.add(evoTo);
            this.caughtSpecies.add(evoTo);
            this.showDialogue([`What? ${oldName} is glowing!`, `${oldName} evolved into ${SPECIES[evoTo].name}!`]);
          } else {
            this.openPartyContext(mon);
          }
        },
        onCancel: () => {
          this.pendingHealItem = null;
          this.pendingGiveItem = null;
          this.pendingStone = null;
          this.closeMenu();
        },
      },
      push,
    );
  }

  openPartyContext(mon: Mockemon): void {
    const options = mon.isEgg ? ['SUMMARY', 'CANCEL'] : ['SUMMARY', 'TAKE ITEM', 'CANCEL'];
    this.openMenu(
      {
        title: displayName(mon),
        items: options,
        index: 0,
        onSelect: (i) => {
          const sel = options[i];
          if (sel === 'SUMMARY') {
            this.summaryMon = mon;
            this.mode = 'summary';
          } else if (sel === 'TAKE ITEM') {
            if (!mon.heldItem) {
              this.showDialogue([`${displayName(mon)} is not holding anything.`], () => {
                this.mode = 'overworld';
                this.openPartyMenu(null, false);
              });
              this.menu = null;
              this.menuStack = [];
              this.mode = 'dialogue';
              return;
            }
            const item = mon.heldItem;
            mon.heldItem = null;
            this.inventory[item] = (this.inventory[item] ?? 0) + 1;
            this.showDialogue([`Took back ${itemName(item)} from ${displayName(mon)}.`], () => {
              this.mode = 'overworld';
              this.openPartyMenu(null, false);
            });
            this.menu = null;
            this.menuStack = [];
            this.mode = 'dialogue';
          } else {
            this.closeMenu();
          }
        },
        onCancel: () => this.closeMenu(),
      },
      true,
    );
  }

  openBagMenu(): void {
    const owned = Object.keys(ITEMS).filter((id) => (this.inventory[id] ?? 0) > 0);
    this.openMenu(
      {
        title: 'BAG',
        items: owned.length > 0 ? owned.map((id) => `${itemName(id)} x${this.inventory[id]}`) : ['(empty)'],
        index: 0,
        info: [`Money: $${this.money}`],
        onSelect: (i) => {
          const id = owned[i];
          if (!id) return;
          const def2 = ITEMS[id];
          if (def2.kind === 'ball') {
            this.closeAllMenus();
            this.showDialogue(['Better save it for a wild Mockemon!']);
            return;
          }
          if (def2.kind === 'medicine') {
            this.pendingGiveItem = null;
            this.pendingStone = null;
            this.openPartyMenu(id);
            return;
          }
          if (def2.kind === 'stone') {
            this.pendingGiveItem = null;
            this.pendingHealItem = null;
            this.pendingStone = id;
            this.openPartyMenu(null);
            return;
          }
          if (def2.kind === 'held') {
            this.pendingHealItem = null;
            this.pendingStone = null;
            this.pendingGiveItem = id;
            this.openPartyMenu(null);
          }
        },
        onCancel: () => this.closeMenu(),
      },
      true,
    );
  }

  openStorageMenu(): void {
    this.openMenu(
      {
        title: 'PC STORAGE',
        items: ['DEPOSIT', 'WITHDRAW', 'BACK'],
        index: 0,
        info: [`Party: ${this.party.length}/6   Stored: ${this.storage.length}`],
        onSelect: (i) => {
          if (i === 0) this.openStorageDeposit();
          else if (i === 1) this.openStorageWithdraw();
          else this.closeMenu();
        },
        onCancel: () => this.closeMenu(),
      },
      true,
    );
  }

  openStorageDeposit(): void {
    if (this.party.length <= 1) {
      this.showDialogue(['You must keep at least one Mockemon with you!'], () => this.openStorageMenu());
      this.menu = null;
      this.mode = 'dialogue';
      return;
    }
    this.openMenu(
      {
        title: 'Deposit which?',
        items: this.party.map((m) => this.partyEntryLabel(m)),
        index: 0,
        onSelect: (i) => {
          if (this.party.length <= 1) return;
          const mon = this.party.splice(i, 1)[0];
          this.storage.push(mon);
          this.showDialogue([`${mon.isEgg ? 'The Egg' : displayName(mon)} was stored.`], () => {
            this.mode = 'overworld';
            this.openStorageMenu();
          });
          this.menu = null;
          this.menuStack = [];
          this.mode = 'dialogue';
        },
        onCancel: () => this.openStorageMenu(),
      },
      true,
    );
  }

  openStorageWithdraw(): void {
    if (this.storage.length === 0) {
      this.showDialogue(['Storage is empty.'], () => this.openStorageMenu());
      this.menu = null;
      this.mode = 'dialogue';
      return;
    }
    if (this.party.length >= 6) {
      this.showDialogue(['Your party is full!'], () => this.openStorageMenu());
      this.menu = null;
      this.mode = 'dialogue';
      return;
    }
    this.openMenu(
      {
        title: 'Withdraw which?',
        items: this.storage.map((m) => this.partyEntryLabel(m)),
        index: 0,
        onSelect: (i) => {
          if (this.party.length >= 6) return;
          const mon = this.storage.splice(i, 1)[0];
          this.party.push(mon);
          this.showDialogue([`${mon.isEgg ? 'The Egg' : displayName(mon)} joined your party!`], () => {
            this.mode = 'overworld';
            this.openStorageMenu();
          });
          this.menu = null;
          this.menuStack = [];
          this.mode = 'dialogue';
        },
        onCancel: () => this.openStorageMenu(),
      },
      true,
    );
  }

  // ---------- update ----------

  update(): void {
    this.frame++;
    const inGame = this.mode !== 'title' && this.mode !== 'intro' && this.mode !== 'credits';
    if (inGame) this.playFrames++;
    // in-game clock: 1 game minute every 10 frames (full day ~4 real minutes)
    if (inGame && this.frame % 10 === 0) this.minute = (this.minute + 1) % 1440;
    switch (this.mode) {
      case 'intro': {
        const k = consumePress();
        if (k === 'b' || k === 'start') this.intro?.skip();
        this.intro?.update();
        if (!this.intro || this.intro.done) {
          markIntroSeen();
          this.intro = null;
          this.mode = 'title';
        }
        break;
      }
      case 'title': {
        const k = consumePress();
        if (!k) break;
        const options = this.titleOptions();
        if (k === 'up') this.titleIndex = (this.titleIndex - 1 + options.length) % options.length;
        if (k === 'down') this.titleIndex = (this.titleIndex + 1) % options.length;
        if (k === 'a' || k === 'start') {
          const choice = options[this.titleIndex];
          if (choice === 'NEW GAME') {
            this.slot = firstEmptySlot();
            this.newGame();
          } else if (choice === 'CONTINUE') {
            if (!this.load(newestSlot())) this.newGame();
          } else if (choice === 'SLOTS') {
            this.openSlotMenu();
          } else if (choice === 'INTRO MOVIE') {
            this.playIntro();
          }
        }
        break;
      }
      case 'credits': {
        const k = consumePress();
        if (k === 'b' || k === 'start') this.credits?.skip();
        this.credits?.update();
        if (!this.credits || this.credits.done) {
          this.credits = null;
          this.titleIndex = 0;
          this.mode = 'title';
        }
        break;
      }
      case 'overworld':
        this.updateOverworld();
        break;
      case 'dialogue': {
        const k = consumePress();
        if (k === 'a' || k === 'b') {
          this.dialogueQueue.shift();
          if (this.dialogueQueue.length === 0) {
            const done = this.dialogueDone;
            this.dialogueDone = null;
            if (this.mode === 'dialogue') this.mode = 'overworld';
            if (done) done();
          }
        }
        break;
      }
      case 'menu': {
        const k = consumePress();
        const m = this.menu;
        if (!k || !m) break;
        if (k === 'up') {
          m.index = (m.index - 1 + m.items.length) % m.items.length;
          m.onChange?.(m.index);
        }
        if (k === 'down') {
          m.index = (m.index + 1) % m.items.length;
          m.onChange?.(m.index);
        }
        if (k === 'a') m.onSelect(m.index);
        if (k === 'b' && m.onCancel) m.onCancel();
        break;
      }
      case 'battle':
        this.updateBattle();
        break;
      case 'summary': {
        const k = consumePress();
        if (k === 'a' || k === 'b') this.mode = 'menu';
        break;
      }
      case 'dex': {
        const k = consumePress();
        if (!k) break;
        if (k === 'up') this.dexIndex = (this.dexIndex - 1 + DEX_ORDER.length) % DEX_ORDER.length;
        if (k === 'down') this.dexIndex = (this.dexIndex + 1) % DEX_ORDER.length;
        if (k === 'b' || k === 'start') {
          this.mode = 'menu';
        }
        break;
      }
      case 'ending': {
        const k = consumePress();
        if (k === 'a' || k === 'start') {
          this.endingShown = true;
          this.startCredits();
        }
        break;
      }
    }
    this.scripts.update(this);
  }

  // ---------- render ----------

  render(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#1a1c2c';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H + BAR_H);
    switch (this.mode) {
      case 'intro':
        this.intro?.render(this.ctx, VIEW_W, VIEW_H);
        break;
      case 'title':
        renderTitle(this);
        break;
      case 'battle':
        renderBattle(this);
        break;
      case 'summary':
        renderSummary(this);
        break;
      case 'dex':
        renderDex(this);
        break;
      case 'ending':
        renderEnding(this);
        break;
      case 'credits':
        this.credits?.render(this.ctx, VIEW_W, VIEW_H);
        break;
      default:
        renderOverworld(this);
        renderTint(this);
        if (this.mode === 'dialogue') renderDialogue(this);
        if (this.mode === 'menu') renderMenu(this);
    }
    renderControlsBar(this);
  }
}
// ---------- drawing utils ----------

function deltas(dir: Facing): [number, number] {
  switch (dir) {
    case 'up':
      return [0, -1];
    case 'down':
      return [0, 1];
    case 'left':
      return [-1, 0];
    case 'right':
      return [1, 0];
  }
}
