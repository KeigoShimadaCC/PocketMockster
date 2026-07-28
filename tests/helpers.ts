import type { Page } from '@playwright/test';

export interface PMState {
  mode: string;
  map: string;
  x: number;
  y: number;
  moving: boolean;
  facing: string;
  money: number;
  badges: string[];
  flags: Record<string, boolean>;
  inventory: Record<string, number>;
  party: {
    species: string;
    nickname: string;
    level: number;
    hp: number;
    maxHp: number;
    moves: string[];
    status: string | null;
  }[];
  storageCount: number;
  dialogue: string | null;
  menu: { title: string; items: string[]; index: number } | null;
  battle: {
    phase: string;
    message: string | null;
    outcome: string | null;
    isTrainer: boolean;
    enemy: { species: string; level: number; hp: number; maxHp: number };
    active: { species: string; hp: number; moves: string[] };
  } | null;
  seen: number;
  caught: number;
  defeated: string[];
  endingShown: boolean;
}

declare global {
  interface Window {
    __PM: {
      press: (k: string) => void;
      state: () => PMState;
      debug: {
        setSeed: (n: number) => void;
        noEncounters: (on: boolean) => void;
        warp: (map: string, x: number, y: number) => void;
        setPartyLevels: (level: number) => void;
        givemon: (species: string, level: number) => void;
        addItem: (item: string, n: number) => void;
        healAll: () => void;
        clearInput: () => void;
        clearSave: () => void;
      };
    };
  }
}

export async function state(page: Page): Promise<PMState> {
  return page.evaluate(() => window.__PM.state());
}

export async function press(page: Page, key: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page.evaluate((k) => window.__PM.press(k), key);
    await page.waitForTimeout(60);
  }
}

export async function waitMode(page: Page, mode: string, timeout = 15000): Promise<void> {
  await page.waitForFunction((m) => window.__PM.state().mode === m, mode, { timeout });
}

export async function waitIdle(page: Page, timeout = 10000): Promise<void> {
  await page.waitForFunction(() => !window.__PM.state().moving, undefined, { timeout });
}

export async function advanceDialogue(page: Page, maxPages = 60): Promise<void> {
  for (let i = 0; i < maxPages; i++) {
    const s = await state(page);
    if (s.mode !== 'dialogue') return;
    await press(page, 'a');
    await page.waitForTimeout(80);
  }
}

// Walk one tile; resolves when the step animation finishes or the mode changes.
export async function step(page: Page, dir: string): Promise<PMState> {
  await press(page, dir);
  await page.waitForFunction(
    () => {
      const s = window.__PM.state();
      return (!s.moving && s.mode === 'overworld') || s.mode !== 'overworld';
    },
    undefined,
    { timeout: 8000 },
  );
  await page.waitForTimeout(40);
  return state(page);
}

export async function walk(page: Page, dir: string, tiles: number): Promise<PMState> {
  let s = await state(page);
  for (let i = 0; i < tiles; i++) {
    s = await step(page, dir);
    if (s.mode !== 'overworld') return s;
  }
  return s;
}

// Runs a battle to completion by spamming a chosen move, handling messages,
// forced switches, and returning every battle message observed.
export async function battleLoop(
  page: Page,
  opts: { moveIndex?: number; preferMoves?: string[]; maxTurns?: number } = {},
): Promise<string[]> {
  const messages: string[] = [];
  const maxIter = (opts.maxTurns ?? 60) * 12;
  for (let i = 0; i < maxIter; i++) {
    const s = await state(page);
    if (!s.battle || s.mode !== 'battle') return messages;
    const b = s.battle;
    if (b.phase === 'msg') {
      if (b.message && messages[messages.length - 1] !== b.message) messages.push(b.message);
      await press(page, 'a');
    } else if (b.phase === 'action') {
      // FIGHT is index 0 whenever the action menu opens
      await press(page, 'a');
    } else if (b.phase === 'moves') {
      let moveIndex = opts.moveIndex ?? 0;
      if (opts.preferMoves) {
        for (const pm of opts.preferMoves) {
          const idx = b.active.moves.indexOf(pm);
          if (idx >= 0) {
            moveIndex = idx;
            break;
          }
        }
      }
      await press(page, 'down', moveIndex);
      await press(page, 'a');
    } else if (b.phase === 'party') {
      // forced switch: pick first healthy mon
      const idx = s.party.findIndex((m) => m.hp > 0);
      await press(page, 'down', Math.max(0, idx));
      await press(page, 'a');
    } else if (b.phase === 'bag') {
      await press(page, 'b');
    }
    await page.waitForTimeout(50);
  }
  throw new Error('battleLoop did not finish; messages so far: ' + messages.join(' | '));
}

// Fresh game up to "standing in the lab with a starter chosen".
export async function newGameWithStarter(page: Page, seed: number, starterIndex = 0): Promise<void> {
  await page.goto(`/?seed=${seed}&noenc=1`);
  await page.waitForFunction(() => !!window.__PM);
  await page.evaluate(() => window.__PM.debug.clearSave());
  await waitMode(page, 'title');
  await press(page, 'a'); // NEW GAME
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  await waitMode(page, 'overworld');
  // player starts at (5,6) facing up; professor is at (5,3)
  await walk(page, 'up', 2);
  await press(page, 'a'); // talk
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  await waitMode(page, 'menu');
  await press(page, 'down', starterIndex);
  await press(page, 'a'); // choose
  await page.waitForFunction(() => window.__PM.state().menu?.items.includes('YES'));
  await press(page, 'a'); // confirm YES
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  await waitMode(page, 'overworld');
}
