import { Game } from './game';
import { clearInput, initInput, virtualPress, type Key } from './input';
import { createMockemon, gainExp, expForLevel, growthOf, healFull, movesAtLevel } from './mockemon';
import { MOVES } from './data/moves';
import { phaseFor } from './daynight';
import { canBreed, makeEgg, tickEgg } from './breeding';
import { setSeed } from './rng';
import { introSeen, SLOT_KEYS } from './frontend';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
if (seedParam) setSeed(parseInt(seedParam, 10));

initInput();
const game = new Game(ctx);
if (params.get('noenc') === '1') game.noEncounters = true;
if (!introSeen() && !params.get('noenc')) game.playIntro();

let last = 0;
const STEP = 1000 / 60;
let acc = 0;
let speed = 1; // agent/test fast-forward multiplier

function loop(t: number): void {
  acc += Math.min(100, t - last) * speed;
  last = t;
  while (acc >= STEP) {
    game.update();
    acc -= STEP;
  }
  game.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---- E2E / debug API ----
declare global {
  interface Window {
    __PM: unknown;
  }
}

window.__PM = {
  press(k: Key) {
    virtualPress(k);
  },
  state() {
    return {
      mode: game.mode,
      speed,
      slot: game.slot,
      playFrames: game.playFrames,
      map: game.mapId,
      x: game.px,
      y: game.py,
      moving: game.moving,
      facing: game.facing,
      money: game.money,
      badges: [...game.badges],
      flags: { ...game.flags },
      inventory: { ...game.inventory },
      party: game.party.map((m) => ({
        species: m.species,
        nickname: m.nickname,
        level: m.level,
        hp: m.hp,
        maxHp: m.maxHp,
        moves: m.moves.map((ms) => ms.id),
        status: m.status,
        isEgg: !!m.isEgg,
        hatchSteps: m.hatchSteps ?? 0,
        heldItem: m.heldItem,
        pendingMoves: [...m.pendingMoves],
        friendship: m.friendship,
        ability: m.ability,
        exp: m.exp,
        expNext: expForLevel(growthOf(m), m.level + 1),
        shiny: m.shiny,
      })),
      storageCount: game.storage.length,
      storage: game.storage.map((m) => ({ species: m.species, level: m.level, isEgg: !!m.isEgg })),
      minute: game.minute,
      phase: phaseFor(game.minute),
      daycare: game.daycare.map((m) => (m ? { species: m.species, level: m.level } : null)),
      daycareEgg: !!game.daycareEgg,
      dialogue: game.dialogueQueue[0] ?? null,
      menu: game.menu
        ? { title: game.menu.title, items: game.menu.items, index: game.menu.index, info: game.menu.info ?? null }
        : null,
      battle: game.battle
        ? {
            phase: game.battlePhase,
            menuIndex: game.battleMenuIndex,
            message: game.battleMsgs[0] ?? null,
            outcome: game.battle.outcome,
            isTrainer: game.battle.isTrainer,
            enemy: {
              species: game.battle.enemy.species,
              level: game.battle.enemy.level,
              hp: game.battle.enemy.hp,
              maxHp: game.battle.enemy.maxHp,
            },
            active: {
              species: game.battle.active.species,
              hp: game.battle.active.hp,
              moves: game.battle.active.moves.map((ms) => ({ id: ms.id, pp: ms.pp })),
            },
          }
        : null,
      healPoint: game.healPoint,
      objective: game.quests.nextObjective(),
      activeQuests: game.quests.active().map((q) => q.id),
      completedQuests: game.quests.completed().map((q) => q.id),
      questStages: Object.fromEntries(
        [...game.quests.active(), ...game.quests.completed()].map((q) => [q.id, game.quests.state(q.id).stage]),
      ),
      seen: game.seenSpecies.size,
      caught: game.caughtSpecies.size,
      defeated: [...game.defeatedTrainers],
      endingShown: game.endingShown,
    };
  },
  debug: {
    setSeed(n: number) {
      setSeed(n);
    },
    setSpeed(n: number) {
      speed = Math.max(0.25, Math.min(20, n));
    },
    mapInfo() {
      const m = game.map;
      return {
        id: m.id,
        name: m.name,
        width: m.tiles[0].length,
        height: m.tiles.length,
        tiles: m.tiles,
        warps: m.warps.map((w) => ({ x: w.x, y: w.y, to: w.to, tx: w.tx, ty: w.ty })),
        npcs: m.npcs
          .filter((n) => game.npcVisible(n))
          .map((n) => ({ id: n.id, x: n.x, y: n.y, action: n.action ?? null, trainer: !!n.trainer })),
        items: m.items
          .filter((it) => !game.collectedItems.has(it.id))
          .map((it) => ({ x: it.x, y: it.y, item: it.item, count: it.count })),
        signs: m.signs.map((s) => ({ x: s.x, y: s.y })),
        player: { x: game.px, y: game.py, facing: game.facing },
      };
    },
    noEncounters(on: boolean) {
      game.noEncounters = on;
    },
    warp(map: string, x: number, y: number) {
      game.mapId = map;
      game.px = x;
      game.py = y;
      game.moving = false;
      game.moveOffX = 0;
      game.moveOffY = 0;
    },
    setPartyLevels(level: number) {
      for (const m of game.party) {
        m.exp = expForLevel(growthOf(m), level);
        m.level = level;
        gainExp(m, 0);
        m.moves = movesAtLevel(m.species, level).map((id) => ({ id, pp: MOVES[id].pp }));
        healFull(m);
      }
    },
    givemon(species: string, level: number, shiny = false) {
      if (game.party.length >= 6) return;
      const m = createMockemon(species, level);
      m.shiny = shiny;
      game.party.push(m);
    },
    setFriendship(partyIndex: number, value: number) {
      const m = game.party[partyIndex];
      if (m) m.friendship = value;
    },
    addExp(partyIndex: number, amount: number) {
      const m = game.party[partyIndex];
      if (m) gainExp(m, amount);
    },
    setHp(partyIndex: number, hp: number) {
      const m = game.party[partyIndex];
      if (m) m.hp = Math.max(1, Math.min(m.maxHp, hp));
    },
    setEnemyHp(hp: number) {
      const b = game.battle;
      if (b) b.enemy.hp = Math.max(1, Math.min(b.enemy.maxHp, hp));
    },
    runScript(id: string) {
      return game.runScript(id);
    },
    rollEncounters(n: number) {
      const counts: Record<string, number> = {};
      for (let i = 0; i < n; i++) {
        const sp = game.rollEncounter().species;
        counts[sp] = (counts[sp] ?? 0) + 1;
      }
      return counts;
    },
    addItem(item: string, n: number) {
      game.inventory[item] = (game.inventory[item] ?? 0) + n;
    },
    setTime(minute: number) {
      game.minute = ((minute % 1440) + 1440) % 1440;
    },
    hatchEggs() {
      for (const m of game.party) if (m.isEgg) tickEgg(m, 99999);
    },
    setHeldItem(partyIndex: number, item: string | null) {
      const m = game.party[partyIndex];
      if (m) m.heldItem = item;
    },
    depositDaycare(a: number, b: number) {
      const m1 = game.party[a];
      const m2 = game.party[b];
      if (!m1 || !m2) return;
      game.daycare = [m1, m2];
      game.party = game.party.filter((_, i) => i !== a && i !== b);
    },
    walk(steps: number) {
      // simulate steps: egg ticking + daycare breeding progress
      for (let s = 0; s < steps; s++) {
        for (const m of game.party) if (m.isEgg) tickEgg(m, 1);
        if (game.daycare[0] && game.daycare[1] && !game.daycareEgg && canBreed(game.daycare[0], game.daycare[1])) {
          game.daycareSteps++;
          if (game.daycareSteps >= 256) {
            game.daycareSteps = 0;
            game.daycareEgg = makeEgg(game.daycare[0], game.daycare[1]);
          }
        }
      }
    },
    drainPP(partyIndex: number) {
      const m = game.party[partyIndex];
      if (m) for (const ms of m.moves) ms.pp = 0;
    },
    healAll() {
      for (const m of game.party) healFull(m);
    },
    clearInput() {
      clearInput();
    },
    clearSave() {
      for (const k of SLOT_KEYS) localStorage.removeItem(k);
    },
  },
};
