import { expect, test, type Page } from '@playwright/test';
import {
  advanceDialogue,
  battleLoop,
  newGameWithStarter,
  press,
  settle,
  state,
  waitMode,
  walk,
  type PMState,
} from './helpers';

test.setTimeout(180_000);

// ---------- fine-grained battle drivers ----------

async function pump(page: Page, messages: string[]): Promise<PMState> {
  const s = await state(page);
  if (s.battle?.phase === 'msg' && s.battle.message && messages[messages.length - 1] !== s.battle.message) {
    messages.push(s.battle.message);
  }
  return s;
}

/** click through messages / forced switches until the action phase (or battle end) */
async function toActionPhase(page: Page, messages: string[]): Promise<boolean> {
  for (let i = 0; i < 120; i++) {
    const s = await pump(page, messages);
    if (s.mode !== 'battle' || !s.battle) return false;
    if (s.battle.phase === 'action') return true;
    if (s.battle.phase === 'msg') {
      await press(page, 'a');
    } else if (s.battle.phase === 'party') {
      const idx = s.party.findIndex((m) => m.hp > 0 && !m.isEgg);
      await press(page, 'down', Math.max(0, idx));
      await press(page, 'a');
    } else {
      await press(page, 'b');
    }
    await page.waitForTimeout(40);
  }
  throw new Error('battle never reached the action phase: ' + messages.slice(-4).join(' | '));
}

const ACTIONS = { fight: 0, bag: 1, mockmon: 2, run: 3 } as const;

/** move the 2x2 action cursor onto a known slot and confirm it */
async function chooseAction(page: Page, action: keyof typeof ACTIONS): Promise<void> {
  const target = ACTIONS[action];
  let idx = (await state(page)).battle?.menuIndex ?? 0;
  if (idx >= 2 !== target >= 2) {
    await press(page, 'down');
    idx = (idx + 2) % 4;
  }
  if (idx % 2 !== target % 2) {
    await press(page, 'right');
  }
  await press(page, 'a');
}

/** FIGHT -> pick a move by id, then read back every message the turn produced */
async function useMove(page: Page, messages: string[], moveId: string): Promise<boolean> {
  if (!(await toActionPhase(page, messages))) return false;
  await chooseAction(page, 'fight');
  const s = await state(page);
  const idx = s.battle?.active.moves.findIndex((m) => m.id === moveId && m.pp > 0) ?? -1;
  if (idx < 0) throw new Error(`${moveId} not usable; moves: ${JSON.stringify(s.battle?.active.moves)}`);
  await press(page, 'down', idx);
  await press(page, 'a');
  await toActionPhase(page, messages); // collect everything the turn produced
  return true;
}

/** MOCKMON -> voluntary switch, then read back the turn's messages */
async function switchTo(page: Page, messages: string[], partyIndex: number): Promise<boolean> {
  if (!(await toActionPhase(page, messages))) return false;
  await chooseAction(page, 'mockmon');
  await press(page, 'down', partyIndex);
  await press(page, 'a');
  await toActionPhase(page, messages);
  return true;
}

/** BAG -> MockBall */
async function throwBall(page: Page, messages: string[]): Promise<boolean> {
  if (!(await toActionPhase(page, messages))) return false;
  await chooseAction(page, 'bag');
  await press(page, 'down', 2); // potion, superpotion, mockball
  await press(page, 'a');
  await toActionPhase(page, messages);
  return true;
}

/** leave a wild battle without caring about the outcome */
async function flee(page: Page, messages: string[] = []): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const s = await state(page);
    if (s.mode !== 'battle') break;
    if (!(await toActionPhase(page, messages))) break;
    await chooseAction(page, 'run');
    await toActionPhase(page, messages);
  }
  await settle(page);
}

async function walkUntilBattle(page: Page, maxSteps = 120): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    const s = await walk(page, i % 2 === 0 ? 'up' : 'down', 1);
    if (s.mode === 'battle') return;
  }
  throw new Error('no wild encounter found');
}

async function gotoGrass(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__PM.debug.warp('route1', 4, 20);
    window.__PM.debug.noEncounters(false);
  });
}

// ---------- evolution triggers ----------

test('level-up evolution fires mid-battle (sproutle -> bramblore)', async ({ page }) => {
  await newGameWithStarter(page, 31415, 0);
  await page.evaluate(() => {
    window.__PM.debug.setPartyLevels(14);
    const m = window.__PM.state().party[0];
    window.__PM.debug.addExp(0, m.expNext - m.exp - 1); // one EXP short of level 15
  });
  await gotoGrass(page);
  await walkUntilBattle(page);
  const messages = await battleLoop(page, { preferMoves: ['razorleaf', 'vinewhip'] });
  const log = messages.join(' | ');
  expect(log).toContain('grew to level 15');
  expect(log).toContain('evolved into Bramblore');
  const s = await state(page);
  expect(s.party[0].species).toBe('bramblore');
  expect(s.party[0].level).toBe(15);
});

test('friendship evolution fires on level-up (nibbit -> nibblex)', async ({ page }) => {
  await newGameWithStarter(page, 27182, 0);
  await page.evaluate(() => {
    window.__PM.debug.givemon('nibbit', 14);
    window.__PM.debug.setFriendship(1, 170);
    const m = window.__PM.state().party[1];
    window.__PM.debug.addExp(1, m.expNext - m.exp - 1);
  });
  await gotoGrass(page);
  await walkUntilBattle(page);
  // the benched nibbit levels off shared EXP and evolves on friendship
  const messages = await battleLoop(page, { preferMoves: ['vinewhip', 'tackle'] });
  expect(messages.join(' | ')).toContain('evolved into Nibblex');
  const s = await state(page);
  expect(s.party[1].species).toBe('nibblex');
  expect(s.party[1].level).toBe(15);
});

// ---------- held items in battle ----------

test('oran berry triggers automatically at half HP in a real battle', async ({ page }) => {
  await newGameWithStarter(page, 1618, 0);
  await gotoGrass(page);
  const s0 = await state(page);
  await page.evaluate((hp) => {
    window.__PM.debug.setHp(0, hp);
    window.__PM.debug.setHeldItem(0, 'oranberry');
  }, Math.floor(s0.party[0].maxHp / 2) + 2);
  await walkUntilBattle(page);
  const messages = await battleLoop(page, { preferMoves: ['vinewhip', 'tackle'] });
  expect(messages.join(' | ')).toContain('ate its Oran Berry');
  expect((await state(page)).party[0].heldItem).toBeNull();
});

test('power band locks the holder into its first move', async ({ page }) => {
  await newGameWithStarter(page, 4242, 0);
  await page.evaluate(() => {
    window.__PM.debug.setPartyLevels(10);
    window.__PM.debug.setHeldItem(0, 'powerband');
  });
  await gotoGrass(page);
  await walkUntilBattle(page);
  const messages: string[] = [];
  await useMove(page, messages, 'vinewhip'); // locks the band onto Vine Whip
  await useMove(page, messages, 'growl'); // rejected while the lock holds
  expect(messages.join(' | ')).toContain('Power Band only allows Vine Whip');
  await flee(page, messages);
});

// ---------- trainer AI ----------

test('leader terra uses her super potion when her mon is critical', async ({ page }) => {
  await newGameWithStarter(page, 999, 0);
  await page.evaluate(() => {
    window.__PM.debug.setPartyLevels(14);
    window.__PM.debug.warp('gym', 6, 3); // directly below Terra, past Rocco
  });
  await press(page, 'up');
  await press(page, 'a');
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  await waitMode(page, 'battle');
  const messages: string[] = [];
  for (let turn = 0; turn < 12; turn++) {
    if (!(await toActionPhase(page, messages))) break;
    await page.evaluate(() => window.__PM.debug.setEnemyHp(2)); // critical, so the AI should heal
    await useMove(page, messages, 'growl');
    if (messages.some((m) => m.includes('Super Potion'))) break;
  }
  expect(messages.join(' | ')).toContain('used a Super Potion');
  expect(messages.join(' | ')).toContain('It recovered');
  await battleLoop(page, { preferMoves: ['razorleaf', 'vinewhip'] });
});

// ---------- day/night ----------

test('night weighting shifts the route 1 encounter table', async ({ page }) => {
  await newGameWithStarter(page, 555, 0);
  await page.evaluate(() => window.__PM.debug.warp('route1', 4, 20));
  const roll = (minute: number): Promise<Record<string, number>> =>
    page.evaluate((m) => {
      window.__PM.debug.setTime(m);
      return window.__PM.debug.rollEncounters(600);
    }, minute);
  const nocturnal = ['psywisp', 'somnara', 'mimew'];
  const share = (counts: Record<string, number>): number =>
    nocturnal.reduce((sum, k) => sum + (counts[k] ?? 0), 0) / 600;
  const day = share(await roll(12 * 60));
  const night = share(await roll(0));
  expect(day).toBeLessThan(0.05);
  expect(night).toBeGreaterThan(0.12);
  expect(night).toBeGreaterThan(day * 3);
  // and a night encounter really starts a battle
  await page.evaluate(() => {
    window.__PM.debug.setPartyLevels(20);
    window.__PM.debug.noEncounters(false);
  });
  await walkUntilBattle(page);
  expect((await state(page)).phase).toBe('night');
  await flee(page);
});

// ---------- battle mechanics through the UI ----------

test('weather move announces itself in battle', async ({ page }) => {
  await newGameWithStarter(page, 1357, 0);
  await page.evaluate(() => window.__PM.debug.givemon('flarat', 18));
  await gotoGrass(page);
  await walkUntilBattle(page);
  const messages: string[] = [];
  await switchTo(page, messages, 1);
  await useMove(page, messages, 'sunnyday');
  expect(messages.join(' | ')).toContain('The sunlight turned harsh!');
  await flee(page, messages);
});

test('benched party members gain shared EXP after a win', async ({ page }) => {
  await newGameWithStarter(page, 2468, 0);
  await page.evaluate(() => window.__PM.debug.givemon('nibbit', 5));
  const before = (await state(page)).party[1].exp;
  await gotoGrass(page);
  await walkUntilBattle(page);
  await battleLoop(page, { preferMoves: ['vinewhip', 'tackle'] });
  expect((await state(page)).party[1].exp).toBeGreaterThan(before);
});

test('menace fires when its holder switches in mid-battle', async ({ page }) => {
  await newGameWithStarter(page, 8642, 0);
  await page.evaluate(() => window.__PM.debug.givemon('fluffowl', 8));
  await gotoGrass(page);
  await walkUntilBattle(page);
  const messages: string[] = [];
  await switchTo(page, messages, 1);
  expect(messages.join(' | ')).toContain('Menace cut the foe');
  await flee(page, messages);
});

test('two-turn dig charges, then releases even if another move is picked', async ({ page }) => {
  await newGameWithStarter(page, 1113, 1); // cindercub
  await page.evaluate(() => window.__PM.debug.setPartyLevels(9));
  await gotoGrass(page);
  await walkUntilBattle(page);
  const messages: string[] = [];
  await useMove(page, messages, 'dig');
  expect(messages.join(' | ')).toContain('burrowed underground');
  const before = messages.length;
  await useMove(page, messages, 'ember'); // the engine must fire Dig instead
  const turn = messages.slice(before).join(' | ');
  expect(turn).toContain('used Dig');
  expect(turn).not.toContain('Cindercub used Ember');
  await flee(page, messages);
});

test('critical captures happen while throwing mockballs', async ({ page }) => {
  await newGameWithStarter(page, 6060, 0);
  await page.evaluate(() => {
    window.__PM.debug.setPartyLevels(30);
    window.__PM.debug.addItem('mockball', 99);
  });
  await gotoGrass(page);
  const messages: string[] = [];
  await walkUntilBattle(page);
  for (let seed = 1; seed <= 40; seed++) {
    if ((await state(page)).mode !== 'battle') {
      await settle(page);
      await walkUntilBattle(page);
    }
    // reseeding per throw makes the 12% critical-capture roll deterministic
    await page.evaluate((k) => window.__PM.debug.setSeed(k), seed);
    await throwBall(page, messages);
    if (messages.some((m) => m.includes('Critical capture'))) break;
  }
  expect(messages.join(' | ')).toContain('Critical capture!');
  await settle(page);
});

test('spikes damage an incoming trainer mon on entry', async ({ page }) => {
  await newGameWithStarter(page, 7777, 0);
  await page.evaluate(() => {
    window.__PM.debug.givemon('thistling', 16);
    window.__PM.debug.setPartyLevels(16);
    window.__PM.debug.warp('gym', 6, 11);
  });
  await walk(page, 'up', 1); // Rocco spots us: two pebblits
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  await waitMode(page, 'battle');
  const messages: string[] = [];
  await switchTo(page, messages, 1); // thistling
  await useMove(page, messages, 'spikes');
  expect(messages.join(' | ')).toContain('Spikes were scattered');
  const rest = await battleLoop(page, { preferMoves: ['razorleaf', 'bugbite'] });
  expect([...messages, ...rest].join(' | ')).toContain('hurt by the spikes');
});

test('light screen announces itself in battle', async ({ page }) => {
  await newGameWithStarter(page, 4815, 0);
  await page.evaluate(() => window.__PM.debug.givemon('psywisp', 18));
  await gotoGrass(page);
  await walkUntilBattle(page);
  const messages: string[] = [];
  await switchTo(page, messages, 1);
  await useMove(page, messages, 'lightscreen');
  expect(messages.join(' | ')).toContain('Light Screen raised');
  await flee(page, messages);
});

test('stat stage drops show messages in battle (growl)', async ({ page }) => {
  await newGameWithStarter(page, 9876, 0);
  await gotoGrass(page);
  await walkUntilBattle(page);
  const messages: string[] = [];
  await useMove(page, messages, 'growl');
  expect(messages.join(' | ')).toContain('Attack fell');
  await flee(page, messages);
});

test('drain moves heal the user in battle (mega drain)', async ({ page }) => {
  await newGameWithStarter(page, 3690, 0);
  await page.evaluate(() => {
    window.__PM.debug.givemon('thistling', 20);
    const m = window.__PM.state().party[1];
    window.__PM.debug.setHp(1, Math.floor(m.maxHp / 2));
  });
  await gotoGrass(page);
  await walkUntilBattle(page);
  const messages: string[] = [];
  await switchTo(page, messages, 1);
  for (let i = 0; i < 3 && !messages.some((m) => m.includes('energy drained')); i++) {
    const s = await state(page);
    if (s.mode !== 'battle' || s.battle?.active.species !== 'thistling') break;
    await useMove(page, messages, 'megadrain');
  }
  expect(messages.join(' | ')).toContain('energy drained');
  await flee(page, messages);
});

test('recoil moves damage the user in battle (take down)', async ({ page }) => {
  await newGameWithStarter(page, 5150, 0);
  await page.evaluate(() => window.__PM.debug.givemon('emberuin', 20));
  await gotoGrass(page);
  await walkUntilBattle(page);
  const messages: string[] = [];
  await switchTo(page, messages, 1);
  for (let i = 0; i < 5 && !messages.some((m) => m.includes('damaged by recoil')); i++) {
    let s = await state(page);
    if (s.mode !== 'battle') {
      await settle(page);
      await walkUntilBattle(page);
      await switchTo(page, messages, 1);
      s = await state(page);
    }
    if (s.battle?.active.species !== 'emberuin') break;
    await useMove(page, messages, 'takedown'); // 85% accuracy, so retry on a miss
  }
  expect(messages.join(' | ')).toContain('damaged by recoil');
  await flee(page, messages);
});

test('shiny mockemon show a star in battle messages', async ({ page }) => {
  await newGameWithStarter(page, 1212, 0);
  await page.evaluate(() => window.__PM.debug.givemon('nibbit', 5, true));
  await gotoGrass(page);
  await walkUntilBattle(page);
  const messages: string[] = [];
  await switchTo(page, messages, 1);
  expect(messages.join(' | ')).toContain('★');
  expect((await state(page)).party[1].shiny).toBe(true);
  await flee(page, messages);
});
