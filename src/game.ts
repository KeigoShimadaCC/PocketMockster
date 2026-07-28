import { Battle, type BattleKind, type PlayerAction } from './battle';
import { MOVES } from './data/moves';
import { DEX_ORDER, SPECIES } from './data/species';
import { ITEMS, SHOP_STOCK } from './data/items';
import { ABILITIES } from './data/abilities';
import { TYPE_COLORS } from './data/types';
import { consumePress, isHeld, type Key } from './input';
import { MAPS, SOLID_TILES, type EncounterEntry, type GameMap, type Npc } from './maps';
import { checkEvolution } from './evolution';
import { breedError, canBreed, makeEgg, tickEgg } from './breeding';
import { formatTime, phaseFor, tintFor } from './daynight';
import {
  createMockemon,
  def,
  displayName,
  evolve,
  healFull,
  expForLevel,
  growthOf,
  learnMove,
  type Mockemon,
} from './mockemon';
import { chance, rand, randInt } from './rng';
import { drawSprite, MON_SPRITES, PEOPLE } from './sprites';

const TILE = 32;
const VIEW_W = 480;
const VIEW_H = 320; // gameplay area; a controls bar is drawn below it
const BAR_H = 32;

export type Facing = 'up' | 'down' | 'left' | 'right';

function itemName(id: string): string {
  return ITEMS[id]?.name ?? id;
}

interface MenuState {
  title: string;
  items: string[];
  index: number;
  onSelect: (i: number) => void;
  onCancel: (() => void) | null;
  info?: string[];
}

type Mode =
  | 'title'
  | 'overworld'
  | 'dialogue'
  | 'menu'
  | 'battle'
  | 'summary'
  | 'dex'
  | 'ending';

type BattlePhase = 'msg' | 'action' | 'moves' | 'party' | 'bag';

export class Game {
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

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
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

  tileAt(x: number, y: number): string {
    const rows = this.map.tiles;
    if (y < 0 || y >= rows.length || x < 0 || x >= rows[0].length) return 'T';
    return rows[y][x];
  }

  isBlocked(x: number, y: number): boolean {
    if (SOLID_TILES.has(this.tileAt(x, y))) {
      // doors that are warps are walkable
      if (this.map.warps.some((w) => w.x === x && w.y === y)) return false;
      return true;
    }
    for (const npc of this.map.npcs) {
      if (this.npcVisible(npc) && npc.x === x && npc.y === y) return true;
    }
    return false;
  }

  // ---------- title / save ----------

  hasSave(): boolean {
    try {
      return !!localStorage.getItem('pm_save');
    } catch {
      return false;
    }
  }

  save(): void {
    const data = {
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
    localStorage.setItem('pm_save', JSON.stringify(data));
  }

  load(): boolean {
    const raw = localStorage.getItem('pm_save');
    if (!raw) return false;
    const d = JSON.parse(raw);
    this.mapId = d.mapId;
    this.px = d.px;
    this.py = d.py;
    this.party = d.party;
    this.storage = d.storage ?? [];
    this.inventory = d.inventory;
    this.money = d.money;
    this.badges = d.badges;
    this.flags = d.flags;
    this.defeatedTrainers = new Set(d.defeatedTrainers);
    this.collectedItems = new Set(d.collectedItems);
    this.healPoint = d.healPoint;
    this.seenSpecies = new Set(d.seen ?? []);
    this.caughtSpecies = new Set(d.caught ?? []);
    this.minute = d.minute ?? 600;
    this.daycare = d.daycare ?? [null, null];
    this.daycareSteps = d.daycareSteps ?? 0;
    this.daycareEgg = d.daycareEgg ?? null;
    this.mode = 'overworld';
    return true;
  }

  newGame(): void {
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
    const [dx, dy] = deltas(dir);
    const nx = this.px + dx;
    const ny = this.py + dy;
    if (this.isBlocked(nx, ny)) return;
    this.px = nx;
    this.py = ny;
    this.moveOffX = -dx * TILE;
    this.moveOffY = -dy * TILE;
    this.moving = true;
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
      return;
    }
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
      if (npc.action === 'gymleader') {
        this.startTrainerBattle(npc);
        return;
      }
      this.startTrainerBattle(npc);
      return;
    }
    switch (npc.action) {
      case 'starter':
        this.starterDialogue();
        return;
      case 'heal':
        this.showDialogue(
          ['NURSE: Welcome to the Mock Center! Let me heal your Mockemon to full health!', 'NURSE: ... ... ...', 'NURSE: All healed! We hope to see you again!'],
          () => {
            for (const m of this.party) healFull(m);
            this.healPoint = { map: 'center', x: 6, y: 5 };
          },
        );
        return;
      case 'shop':
        this.openShop();
        return;
      case 'giveballs':
        if (!this.flags.gotBalls) {
          this.flags.gotBalls = true;
          this.inventory.mockball += 5;
          this.inventory.potion += 2;
          this.showDialogue([
            'OLD MAN: Off to Route 1? A trainer needs MockBalls to catch Mockemon!',
            'You received 5 MockBalls and 2 Potions!',
            'OLD MAN: Weaken a wild Mockemon first, then throw the ball. Works even better if they are asleep or paralyzed!',
          ]);
        } else {
          this.showDialogue(['OLD MAN: Catch anything good yet?']);
        }
        return;
      case 'gymleader': {
        this.showDialogue([
          this.flags.gymDone
            ? 'Terra: The Boulder Badge suits you. The world beyond this demo awaits, someday.'
            : 'Terra: ...',
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
    const playerStarter = this.party[0].species;
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
            if (t.id === 'leader_terra') {
              this.flags.gymDone = true;
              this.badges.push('Boulder Badge');
              after.push('Terra: Take it. The BOULDER BADGE. Proof that your bond is harder than stone.');
              this.showDialogue(after, () => {
                this.mode = 'ending';
              });
              return;
            }
            this.showDialogue(after);
          } else if (outcome === 'lose') {
            this.whiteOut();
          }
        },
      );
    });
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
    this.openMenu({
      title: 'MENU',
      items: ['MOCKEMON', 'BAG', 'MOCKDEX', 'STORAGE', 'SAVE', 'EXIT'],
      index: 0,
      onSelect: (i) => {
        if (i === 0) this.openPartyMenu(null);
        else if (i === 1) this.openBagMenu();
        else if (i === 2) {
          this.menu = null;
          this.dexIndex = 0;
          this.mode = 'dex';
        } else if (i === 3) this.openStorageMenu();
        else if (i === 4) {
          this.save();
          this.closeAllMenus();
          this.showDialogue(['Your progress was saved!']);
        } else this.closeAllMenus();
      },
      onCancel: () => this.closeAllMenus(),
    });
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

  openShop(): void {
    const stock = SHOP_STOCK;
    this.openMenu({
      title: 'MOCK MART',
      items: stock.map((id) => `${itemName(id)}  $${ITEMS[id].price}`),
      index: 0,
      info: [`Money: $${this.money}`, 'A: buy 1   B: leave'],
      onSelect: (i) => {
        const id = stock[i];
        const price = ITEMS[id].price;
        if (this.money < price) return;
        this.money -= price;
        this.inventory[id] = (this.inventory[id] ?? 0) + 1;
        this.menu!.info = [`Money: $${this.money}`, `Bought ${itemName(id)}!`];
      },
      onCancel: () => {
        this.closeAllMenus();
        this.showDialogue(['CLERK: Thank you! Come again!']);
      },
    });
  }

  // ---------- update ----------

  update(): void {
    this.frame++;
    // in-game clock: 1 game minute every 10 frames (full day ~4 real minutes)
    if (this.mode !== 'title' && this.frame % 10 === 0) this.minute = (this.minute + 1) % 1440;
    switch (this.mode) {
      case 'title': {
        const k = consumePress();
        if (!k) break;
        const options = this.hasSave() ? 2 : 1;
        if (k === 'up' || k === 'down') this.titleIndex = (this.titleIndex + 1) % options;
        if (k === 'a' || k === 'start') {
          if (this.titleIndex === 0) this.newGame();
          else if (!this.load()) this.newGame();
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
        if (k === 'up') m.index = (m.index - 1 + m.items.length) % m.items.length;
        if (k === 'down') m.index = (m.index + 1) % m.items.length;
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
          this.mode = 'overworld';
          this.showDialogue([
            'Terra: Rest at the Mock Center, stock up, and keep training. Your journey has only just begun!',
          ]);
        }
        break;
      }
    }
  }

  // ---------- render ----------

  render(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#1a1c2c';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H + BAR_H);
    switch (this.mode) {
      case 'title':
        this.renderTitle();
        break;
      case 'battle':
        this.renderBattle();
        break;
      case 'summary':
        this.renderSummary();
        break;
      case 'dex':
        this.renderDex();
        break;
      case 'ending':
        this.renderEnding();
        break;
      default:
        this.renderOverworld();
        this.renderTint();
        if (this.mode === 'dialogue') this.renderDialogue();
        if (this.mode === 'menu') this.renderMenu();
    }
    this.renderControlsBar();
  }

  renderTint(): void {
    if (this.map.indoor) return;
    const t = tintFor(phaseFor(this.minute));
    if (t.alpha <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = t.alpha;
    ctx.fillStyle = t.color;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }

  renderDex(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#29366f';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, `MOCKDEX   Seen ${this.seenSpecies.size}/26   Caught ${this.caughtSpecies.size}/26`, 20, 24, '#ffd93b', 13);
    const perPage = 11;
    const page = Math.floor(this.dexIndex / perPage);
    const start = page * perPage;
    for (let i = start; i < Math.min(start + perPage, DEX_ORDER.length); i++) {
      const key = DEX_ORDER[i];
      const s = SPECIES[key];
      const row = i - start;
      const sel = i === this.dexIndex;
      const seen = this.seenSpecies.has(key);
      const caught = this.caughtSpecies.has(key);
      const label = seen ? s.name : '----------';
      const ball = caught ? '\u25cf ' : '  ';
      text(ctx, `${sel ? '>' : ' '} ${ball}${String(s.id).padStart(2, ' ')}. ${label}`, 20, 52 + row * 22, sel ? '#ffd93b' : seen ? '#ffffff' : '#8fa3c0', 13);
    }
    const key = DEX_ORDER[this.dexIndex];
    const s = SPECIES[key];
    if (this.seenSpecies.has(key)) {
      drawSprite(ctx, MON_SPRITES[key], 330, 52, 4);
      text(ctx, s.types.join(' / '), 330, 140, '#c0cbdc', 12);
      if (this.caughtSpecies.has(key)) {
        wrap(s.dex, 26).slice(0, 5).forEach((l, i) => text(ctx, l, 300, 170 + i * 18, '#8fa3c0', 11));
      } else {
        text(ctx, 'Not caught yet.', 300, 170, '#8fa3c0', 11);
      }
    }
    text(ctx, 'X/Esc: back', 380, 306, '#8fa3c0', 11);
  }

  renderControlsBar(): void {
    const ctx = this.ctx;
    const hints: Record<Mode, string> = {
      title: '\u2191\u2193 select   Z/Enter confirm',
      overworld: '\u2190\u2191\u2193\u2192/WASD move   Z/Enter interact   M/Shift menu',
      dialogue: 'Z/Enter next',
      menu: '\u2191\u2193 select   Z/Enter ok   X/Esc back',
      battle: '\u2190\u2191\u2193\u2192 select   Z/Enter ok   X/Esc back',
      summary: 'Z/Enter or X/Esc back',
      dex: '\u2191\u2193 browse   X/Esc back',
      ending: 'Z/Enter continue',
    };
    ctx.fillStyle = '#11131f';
    ctx.fillRect(0, VIEW_H, VIEW_W, BAR_H);
    ctx.fillStyle = '#333c57';
    ctx.fillRect(0, VIEW_H, VIEW_W, 2);
    text(ctx, hints[this.mode], VIEW_W / 2, VIEW_H + 21, '#8fa3c0', 12, true);
  }

  renderTitle(): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#29366f');
    g.addColorStop(1, '#3b5dc9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, 'POCKET', 240, 70, '#ffd93b', 40, true);
    text(ctx, 'MOCKSTER', 240, 115, '#ffffff', 40, true);
    const keys = Object.keys(MON_SPRITES);
    const idx = Math.floor(this.frame / 45) % keys.length;
    drawSprite(ctx, MON_SPRITES[keys[idx]], 240 - 32, 130, 4);
    const options = this.hasSave() ? ['NEW GAME', 'CONTINUE'] : ['NEW GAME'];
    options.forEach((o, i) => {
      const sel = i === this.titleIndex;
      text(ctx, (sel ? '> ' : '  ') + o, 240, 240 + i * 26, sel ? '#ffd93b' : '#c0cbdc', 16, true);
    });
  }

  renderOverworld(): void {
    const ctx = this.ctx;
    const map = this.map;
    const mapW = map.tiles[0].length * TILE;
    const mapH = map.tiles.length * TILE;
    const playerPx = this.px * TILE + this.moveOffX;
    const playerPy = this.py * TILE + this.moveOffY;
    let camX = playerPx + TILE / 2 - VIEW_W / 2;
    let camY = playerPy + TILE / 2 - VIEW_H / 2;
    camX = mapW <= VIEW_W ? (mapW - VIEW_W) / 2 : Math.max(0, Math.min(mapW - VIEW_W, camX));
    camY = mapH <= VIEW_H ? (mapH - VIEW_H) / 2 : Math.max(0, Math.min(mapH - VIEW_H, camY));

    const x0 = Math.floor(camX / TILE) - 1;
    const y0 = Math.floor(camY / TILE) - 1;
    for (let ty = y0; ty <= y0 + 12; ty++) {
      for (let tx = x0; tx <= x0 + 17; tx++) {
        this.drawTile(tx, ty, Math.round(tx * TILE - camX), Math.round(ty * TILE - camY));
      }
    }
    for (const it of map.items) {
      if (this.collectedItems.has(it.id)) continue;
      const x = Math.round(it.x * TILE - camX);
      const y = Math.round(it.y * TILE - camY);
      ctx.fillStyle = '#e63946';
      ctx.fillRect(x + 10, y + 12, 12, 10);
      ctx.fillStyle = '#f1faee';
      ctx.fillRect(x + 10, y + 17, 12, 5);
      ctx.fillStyle = '#1a1c2c';
      ctx.fillRect(x + 14, y + 15, 4, 4);
    }
    for (const npc of map.npcs) {
      if (!this.npcVisible(npc)) continue;
      const x = Math.round(npc.x * TILE - camX);
      const y = Math.round(npc.y * TILE - camY);
      drawSprite(ctx, PEOPLE[npc.spriteKey] ?? PEOPLE.villager1, x, y, 2, npc.facing === 'left');
      if (npc.trainer && !this.defeatedTrainers.has(npc.trainer.id) && npc.trainer.sight > 0) {
        text(ctx, '!', x + 16, y - 4, '#e63946', 14, true);
      }
    }
    drawSprite(
      ctx,
      PEOPLE.player,
      Math.round(playerPx - camX),
      Math.round(playerPy - camY),
      2,
      this.facing === 'left',
    );
    // location banner + clock
    panel(ctx, 6, 6, 150, 24);
    text(ctx, map.name, 12, 22, '#ffffff', 12);
    panel(ctx, VIEW_W - 86, 6, 80, 24);
    text(ctx, formatTime(this.minute), VIEW_W - 46, 22, phaseFor(this.minute) === 'night' ? '#7fc8f8' : '#ffd93b', 12, true);
  }

  drawTile(tx: number, ty: number, x: number, y: number): void {
    const ctx = this.ctx;
    const ch = this.tileAt(tx, ty);
    const indoor = this.map.indoor;
    switch (ch) {
      case '.': {
        ctx.fillStyle = '#7ec850';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#6db843';
        if ((tx + ty) % 2 === 0) ctx.fillRect(x + 6, y + 6, 3, 3);
        ctx.fillRect(x + 20, y + 22, 3, 3);
        break;
      }
      case ',': {
        ctx.fillStyle = '#d9c27e';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#c9b26e';
        ctx.fillRect(x + 4, y + 10, 4, 3);
        ctx.fillRect(x + 22, y + 20, 4, 3);
        break;
      }
      case 'G': {
        ctx.fillStyle = '#4f9e3a';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#3d7f2c';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(x + 3 + i * 8, y + 8, 3, 18);
          ctx.fillRect(x + 5 + i * 8, y + 14, 3, 12);
        }
        break;
      }
      case 'T': {
        ctx.fillStyle = '#7ec850';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#5a4632';
        ctx.fillRect(x + 12, y + 20, 8, 10);
        ctx.fillStyle = '#2e7d3a';
        ctx.fillRect(x + 2, y + 2, 28, 20);
        ctx.fillStyle = '#3f9c4d';
        ctx.fillRect(x + 5, y + 4, 10, 8);
        break;
      }
      case 'W': {
        ctx.fillStyle = '#4a9fd8';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#7fc8f8';
        const wave = Math.floor(this.frame / 30) % 2;
        ctx.fillRect(x + 4 + wave * 4, y + 8, 12, 2);
        ctx.fillRect(x + 14 - wave * 4, y + 22, 12, 2);
        break;
      }
      case 'R': {
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#a03225';
        ctx.fillRect(x, y + 12, TILE, 4);
        ctx.fillRect(x, y + 26, TILE, 4);
        break;
      }
      case 'B': {
        ctx.fillStyle = '#e8dcc0';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#87ceeb';
        ctx.fillRect(x + 8, y + 8, 16, 12);
        ctx.strokeStyle = '#b8ac90';
        ctx.strokeRect(x + 8.5, y + 8.5, 15, 11);
        break;
      }
      case 'D': {
        ctx.fillStyle = '#e8dcc0';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#8a5a2b';
        ctx.fillRect(x + 6, y + 4, 20, 28);
        ctx.fillStyle = '#ffd93b';
        ctx.fillRect(x + 21, y + 18, 3, 3);
        break;
      }
      case 'S': {
        ctx.fillStyle = indoor ? '#d8cfc0' : '#7ec850';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#5a4632';
        ctx.fillRect(x + 14, y + 16, 4, 14);
        ctx.fillStyle = '#8a6547';
        ctx.fillRect(x + 4, y + 4, 24, 14);
        break;
      }
      case 'w': {
        ctx.fillStyle = '#8d99ae';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#6e7a8e';
        ctx.fillRect(x, y + 24, TILE, 8);
        break;
      }
      case 'F': {
        ctx.fillStyle = '#d8cfc0';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#ccc2b0';
        if ((tx + ty) % 2 === 0) ctx.fillRect(x, y, TILE, TILE);
        break;
      }
      case 'C': {
        ctx.fillStyle = '#d8cfc0';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#a06a3a';
        ctx.fillRect(x + 1, y + 6, 30, 24);
        ctx.fillStyle = '#c08a4a';
        ctx.fillRect(x + 1, y + 6, 30, 8);
        break;
      }
      case 'M': {
        ctx.fillStyle = '#d8cfc0';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#6e7a8e';
        ctx.fillRect(x + 2, y + 2, 28, 28);
        ctx.fillStyle = '#8d99ae';
        ctx.fillRect(x + 6, y + 6, 20, 20);
        break;
      }
      case 'P': {
        ctx.fillStyle = '#d8cfc0';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#a06a3a';
        ctx.fillRect(x, y + 8, TILE, 22);
        if (!this.flags.starterChosen) {
          ctx.fillStyle = '#e63946';
          ctx.beginPath();
          ctx.arc(x + 16, y + 16, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f1faee';
          ctx.fillRect(x + 10, y + 16, 12, 4);
        }
        break;
      }
      case 'o': {
        ctx.fillStyle = this.map.indoor ? '#d8cfc0' : '#7ec850';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#8d8371';
        ctx.beginPath();
        ctx.arc(x + 16, y + 18, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#a89e8c';
        ctx.beginPath();
        ctx.arc(x + 13, y + 14, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default: {
        ctx.fillStyle = '#1a1c2c';
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }

  renderDialogue(): void {
    const ctx = this.ctx;
    panel(ctx, 8, VIEW_H - 92, VIEW_W - 16, 84);
    const page = this.dialogueQueue[0] ?? '';
    const lines = wrap(page, 54);
    lines.slice(0, 3).forEach((l, i) => text(ctx, l, 20, VIEW_H - 66 + i * 20, '#ffffff', 13));
    if (Math.floor(this.frame / 30) % 2 === 0) text(ctx, '▼', VIEW_W - 30, VIEW_H - 18, '#ffd93b', 12);
  }

  renderMenu(): void {
    const ctx = this.ctx;
    const m = this.menu!;
    const h = 40 + m.items.length * 22 + (m.info ? m.info.length * 18 : 0);
    const w = 260;
    const x = VIEW_W / 2 - w / 2;
    const y = Math.max(10, VIEW_H / 2 - h / 2);
    panel(ctx, x, y, w, h);
    text(ctx, m.title, x + 12, y + 22, '#ffd93b', 13);
    m.items.forEach((it, i) => {
      const sel = i === m.index;
      text(ctx, (sel ? '> ' : '  ') + it, x + 14, y + 46 + i * 22, sel ? '#ffd93b' : '#ffffff', 13);
    });
    if (m.info) {
      m.info.forEach((l, i) =>
        text(ctx, l, x + 14, y + 46 + m.items.length * 22 + i * 18, '#8fa3c0', 11),
      );
    }
  }

  renderSummary(): void {
    const ctx = this.ctx;
    const m = this.summaryMon!;
    const s = def(m);
    ctx.fillStyle = '#29366f';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (m.isEgg) {
      text(ctx, 'EGG', 240, 60, '#ffd93b', 24, true);
      text(ctx, `It looks like it will hatch soon... (${m.hatchSteps ?? 0} steps left)`, 240, 120, '#c0cbdc', 12, true);
      text(ctx, 'Watch over it as you walk!', 240, 150, '#8fa3c0', 12, true);
      text(ctx, 'Press B to go back', 360, 310, '#8fa3c0', 10);
      return;
    }
    drawSprite(ctx, MON_SPRITES[m.species], 30, 30, 6);
    text(ctx, `${displayName(m)}  Lv${m.level}${m.gender ? (m.gender === 'M' ? ' \u2642' : ' \u2640') : ''}`, 160, 40, '#ffffff', 16);
    s.types.forEach((t, i) => {
      ctx.fillStyle = TYPE_COLORS[t];
      ctx.fillRect(160 + i * 74, 50, 68, 18);
      text(ctx, t, 194 + i * 74, 63, '#ffffff', 11, true);
    });
    text(ctx, `HP  ${m.hp}/${m.maxHp}`, 160, 92, '#ffffff', 12);
    text(ctx, `ATK ${m.atk}   DEF ${m.def}`, 160, 112, '#ffffff', 12);
    text(ctx, `SPA ${m.spa}   SPD ${m.spd}   SPE ${m.spe}`, 160, 132, '#ffffff', 12);
    text(ctx, `EXP ${m.exp}  (next: ${expForLevel(growthOf(m), m.level + 1)})`, 160, 152, '#8fa3c0', 11);
    const ability = ABILITIES[m.ability];
    text(ctx, `Nature: ${m.nature}   Ability: ${ability?.name ?? m.ability}`, 160, 172, '#8fa3c0', 11);
    text(ctx, `Item: ${m.heldItem ? itemName(m.heldItem) : 'none'}   Friendship: ${m.friendship}`, 160, 190, '#8fa3c0', 11);
    text(ctx, 'MOVES', 30, 212, '#ffd93b', 13);
    m.moves.forEach((ms, i) => {
      const mv = MOVES[ms.id];
      text(ctx, `${mv.name}  (${mv.type})  PP ${ms.pp}/${mv.pp}`, 30, 232 + i * 18, '#ffffff', 12);
    });
    text(ctx, wrap(s.dex, 60)[0] ?? '', 30, 310, '#c0cbdc', 10);
    text(ctx, 'Press B to go back', 360, 310, '#8fa3c0', 10);
  }

  renderBattle(): void {
    const ctx = this.ctx;
    const b = this.battle!;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#8fd3f4');
    g.addColorStop(1, '#b8e0a0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H - 88);

    // platforms
    ctx.fillStyle = 'rgba(120,160,90,0.6)';
    ctx.beginPath();
    ctx.ellipse(360, 130, 80, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(110, 226, 90, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // weather/terrain indicator
    if (b.weather || b.terrain) {
      const label = [
        b.weather ? { sun: 'Harsh Sun', rain: 'Rain', sand: 'Sandstorm' }[b.weather] : '',
        b.terrain ? (b.terrain === 'electric' ? 'Electric Terrain' : 'Grassy Terrain') : '',
      ]
        .filter(Boolean)
        .join(' + ');
      panel(ctx, VIEW_W - 160, 12, 148, 22);
      text(ctx, label, VIEW_W - 86, 27, '#ffd93b', 10, true);
    }

    // enemy
    const enemy = b.enemy;
    drawSprite(ctx, MON_SPRITES[enemy.species], 310, 40, 6);
    panel(ctx, 10, 12, 200, 54);
    text(ctx, `${displayName(enemy)}  Lv${enemy.level}`, 20, 30, '#ffffff', 12);
    hpBar(ctx, 20, 40, 160, enemy.hp / enemy.maxHp);
    if (enemy.status) text(ctx, enemy.status, 176, 60, '#e63946', 10);

    // player
    const mine = b.active;
    drawSprite(ctx, MON_SPRITES[mine.species], 50, 140, 6, true);
    panel(ctx, 260, 150, 210, 74);
    text(ctx, `${displayName(mine)}  Lv${mine.level}`, 270, 168, '#ffffff', 12);
    hpBar(ctx, 270, 178, 170, mine.hp / mine.maxHp);
    text(ctx, `${mine.hp}/${mine.maxHp}`, 270, 202, '#ffffff', 11);
    if (mine.status) text(ctx, mine.status, 420, 202, '#e63946', 10);
    const expNow = mine.exp - expForLevel(growthOf(mine), mine.level);
    const expNext = expForLevel(growthOf(mine), mine.level + 1) - expForLevel(growthOf(mine), mine.level);
    ctx.fillStyle = '#29366f';
    ctx.fillRect(270, 210, 170, 6);
    ctx.fillStyle = '#4a9fd8';
    ctx.fillRect(270, 210, 170 * Math.max(0, Math.min(1, expNow / expNext)), 6);

    // message box
    panel(ctx, 0, VIEW_H - 88, VIEW_W, 88);
    if (this.battlePhase === 'msg') {
      const msg = this.battleMsgs[0] ?? '';
      wrap(msg, 54)
        .slice(0, 3)
        .forEach((l, i) => text(ctx, l, 16, VIEW_H - 60 + i * 20, '#ffffff', 13));
      if (Math.floor(this.frame / 30) % 2 === 0)
        text(ctx, '▼', VIEW_W - 26, VIEW_H - 14, '#ffd93b', 12);
    } else if (this.battlePhase === 'action') {
      text(ctx, `What will ${displayName(mine)} do?`, 16, VIEW_H - 50, '#ffffff', 13);
      const grid = ['FIGHT', 'BAG', 'MOCKMON', 'RUN'];
      grid.forEach((gLabel, i) => {
        const gx = 250 + (i % 2) * 110;
        const gy = VIEW_H - 60 + Math.floor(i / 2) * 30;
        const sel = i === this.battleMenuIndex;
        text(ctx, (sel ? '> ' : '  ') + gLabel, gx, gy, sel ? '#ffd93b' : '#ffffff', 13);
      });
    } else if (this.battlePhase === 'moves') {
      const struggleOnly = b.active.moves.every((ms) => ms.pp <= 0);
      if (struggleOnly) {
        const sel = this.battleMenuIndex === 0;
        text(ctx, `${sel ? '> ' : '  '}STRUGGLE`, 16, VIEW_H - 66, '#e63946', 12);
        text(ctx, 'No PP left!', 250, VIEW_H - 66, '#8fa3c0', 11);
      } else {
        b.active.moves.forEach((ms, i) => {
          const mv = MOVES[ms.id];
          const sel = i === this.battleMenuIndex;
          text(
            ctx,
            `${sel ? '> ' : '  '}${mv.name}`,
            16,
            VIEW_H - 66 + i * 19,
            sel ? '#ffd93b' : ms.pp <= 0 ? '#8fa3c0' : '#ffffff',
            12,
          );
          text(ctx, `${mv.type}  PP ${ms.pp}/${mv.pp}`, 250, VIEW_H - 66 + i * 19, '#8fa3c0', 11);
        });
      }
    } else if (this.battlePhase === 'bag') {
      const items = ['potion', 'superpotion', 'mockball'];
      items.forEach((it, i) => {
        const sel = i === this.battleMenuIndex;
        text(
          ctx,
          `${sel ? '> ' : '  '}${itemName(it)} x${this.inventory[it] ?? 0}`,
          16,
          VIEW_H - 62 + i * 22,
          sel ? '#ffd93b' : '#ffffff',
          13,
        );
      });
    } else if (this.battlePhase === 'party') {
      this.party.forEach((m, i) => {
        const sel = i === this.battleMenuIndex;
        const label = m.isEgg
          ? `EGG${i === b.activeIndex ? ' *' : ''}`
          : `${displayName(m)} Lv${m.level} ${m.hp}/${m.maxHp}${m.hp <= 0 ? ' (FNT)' : ''}${i === b.activeIndex ? ' *' : ''}`;
        text(ctx, (sel ? '> ' : '  ') + label, 16, VIEW_H - 70 + i * 14, sel ? '#ffd93b' : '#ffffff', 11);
      });
    }
  }

  renderEnding(): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#29366f');
    g.addColorStop(1, '#5d275d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // badge
    ctx.fillStyle = '#b8a038';
    ctx.beginPath();
    ctx.moveTo(240, 50);
    ctx.lineTo(275, 75);
    ctx.lineTo(262, 115);
    ctx.lineTo(218, 115);
    ctx.lineTo(205, 75);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d9c27e';
    ctx.beginPath();
    ctx.arc(240, 85, 15, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'CONGRATULATIONS!', 240, 155, '#ffd93b', 24, true);
    text(ctx, 'You earned the BOULDER BADGE', 240, 185, '#ffffff', 14, true);
    text(ctx, 'and completed the Pocket Mockster demo!', 240, 205, '#ffffff', 14, true);
    text(ctx, `MockDex: seen ${this.seenSpecies.size}/26, caught ${this.caughtSpecies.size}/26`, 240, 235, '#c0cbdc', 12, true);
    text(ctx, 'The world keeps going. Catch them all!', 240, 260, '#c0cbdc', 12, true);
    text(ctx, 'Press Z/Enter to keep playing', 240, 300, '#8fa3c0', 11, true);
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

function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  color: string,
  size: number,
  center = false,
): void {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px "Courier New", monospace`;
  ctx.textAlign = center ? 'center' : 'left';
  ctx.fillText(s, x, y);
  ctx.textAlign = 'left';
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(20,24,46,0.92)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#8fa3c0';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
}

function hpBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, ratio: number): void {
  const r = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = '#29366f';
  ctx.fillRect(x, y, w, 10);
  ctx.fillStyle = r > 0.5 ? '#38b764' : r > 0.2 ? '#ffd93b' : '#e63946';
  ctx.fillRect(x + 1, y + 1, (w - 2) * r, 8);
}

function wrap(s: string, width: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) {
      if (cur) lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

function paginate(s: string): string[] {
  const lines = wrap(s, 54);
  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += 3) {
    pages.push(lines.slice(i, i + 3).join(' '));
  }
  return pages.length ? pages : [''];
}
