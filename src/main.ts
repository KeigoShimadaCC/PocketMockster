import { Game } from './game';
import { clearInput, initInput, virtualPress, type Key } from './input';
import { createMockemon, gainExp, expForLevel, growthOf, healFull, movesAtLevel } from './mockemon';
import { MOVES } from './data/moves';
import { setSeed } from './rng';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
if (seedParam) setSeed(parseInt(seedParam, 10));

initInput();
const game = new Game(ctx);
if (params.get('noenc') === '1') game.noEncounters = true;

let last = 0;
const STEP = 1000 / 60;
let acc = 0;

function loop(t: number): void {
  acc += Math.min(100, t - last);
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
      })),
      storageCount: game.storage.length,
      dialogue: game.dialogueQueue[0] ?? null,
      menu: game.menu ? { title: game.menu.title, items: game.menu.items, index: game.menu.index } : null,
      battle: game.battle
        ? {
            phase: game.battlePhase,
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
              moves: game.battle.active.moves.map((ms) => ms.id),
            },
          }
        : null,
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
    givemon(species: string, level: number) {
      if (game.party.length < 6) game.party.push(createMockemon(species, level));
    },
    addItem(item: 'potion' | 'superpotion' | 'mockball', n: number) {
      game.inventory[item] += n;
    },
    healAll() {
      for (const m of game.party) healFull(m);
    },
    clearInput() {
      clearInput();
    },
    clearSave() {
      localStorage.removeItem('pm_save');
    },
  },
};
