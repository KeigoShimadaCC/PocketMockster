import { expect, test, type Page } from '@playwright/test';
import {
  advanceDialogue,
  battleLoop,
  newGameWithStarter,
  press,
  state,
  waitMode,
  walk,
} from './helpers';

test.setTimeout(300_000);

async function fightThroughDialogue(page: Page, preferMoves: string[]): Promise<string[]> {
  await advanceDialogue(page);
  await waitMode(page, 'battle');
  const msgs = await battleLoop(page, { preferMoves });
  await advanceDialogue(page);
  return msgs;
}

test('full playthrough: starter to first gym badge', async ({ page }) => {
  // --- Act 1: lab, starter, rival ---
  await newGameWithStarter(page, 777, 0); // sproutle
  await page.evaluate(() => window.__PM.debug.setPartyLevels(9));

  // walking toward the lab exit triggers the rival ambush
  let s = await walk(page, 'down', 2);
  expect(s.mode).toBe('dialogue');
  await fightThroughDialogue(page, ['tackle']);
  s = await state(page);
  expect(s.flags.rivalBeaten).toBe(true);

  // leave the lab
  await walk(page, 'right', 1);
  s = await walk(page, 'down', 2);
  expect(s.map).toBe('mapletown');

  // --- Act 2: Maple Town, get MockBalls ---
  await walk(page, 'down', 1);
  await walk(page, 'right', 4);
  await walk(page, 'up', 5);
  await walk(page, 'left', 1);
  await walk(page, 'up', 2);
  await press(page, 'up'); // face the old man
  await press(page, 'a');
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  s = await state(page);
  expect(s.flags.gotBalls).toBe(true);
  expect(s.inventory.mockball).toBeGreaterThanOrEqual(5);

  // --- Act 3: Route 1 ---
  await walk(page, 'left', 1);
  s = await walk(page, 'up', 3);
  expect(s.map).toBe('route1');

  // pick up the item ball lying on the route
  await walk(page, 'left', 4);
  const ballsBefore = (await state(page)).inventory.mockball;
  s = await walk(page, 'up', 3);
  expect(s.mode).toBe('dialogue');
  expect(s.dialogue).toContain('MockBall');
  await advanceDialogue(page);
  s = await state(page);
  expect(s.inventory.mockball).toBe(ballsBefore + 3);

  // walk the path north; three trainers will spot us on the way
  await page.evaluate(() => window.__PM.debug.setPartyLevels(12));
  await walk(page, 'right', 3);
  for (let guard = 0; guard < 40; guard++) {
    s = await state(page);
    if (s.map === 'verdantcity') break;
    s = await walk(page, 'up', 1);
    if (s.mode === 'dialogue') {
      await fightThroughDialogue(page, ['razorleaf', 'vinewhip', 'tackle']);
      await page.evaluate(() => window.__PM.debug.healAll());
    }
  }
  s = await state(page);
  expect(s.map).toBe('verdantcity');
  expect(s.defeated).toEqual(
    expect.arrayContaining(['trainer_ben', 'trainer_mia', 'trainer_cliff']),
  );

  // --- Act 4: Verdant City, heal and shop ---
  await walk(page, 'up', 7);
  await walk(page, 'left', 5);
  s = await walk(page, 'up', 5);
  expect(s.map).toBe('center');
  await walk(page, 'left', 1);
  await walk(page, 'up', 2);
  await press(page, 'up');
  await press(page, 'a'); // nurse over the counter
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  s = await state(page);
  for (const mon of s.party) expect(mon.hp).toBe(mon.maxHp);

  // exit center, go to the mart
  await walk(page, 'down', 2);
  await walk(page, 'right', 1);
  s = await walk(page, 'down', 1);
  expect(s.map).toBe('verdantcity');
  await walk(page, 'right', 8);
  s = await walk(page, 'up', 1);
  expect(s.map).toBe('mart');
  await walk(page, 'left', 1);
  await walk(page, 'up', 2);
  await press(page, 'up');
  await press(page, 'a'); // clerk over the counter
  await waitMode(page, 'menu');
  const moneyBefore = (await state(page)).money;
  const potionsBefore = (await state(page)).inventory.potion;
  await press(page, 'a'); // buy a potion
  s = await state(page);
  expect(s.money).toBe(moneyBefore - 300);
  expect(s.inventory.potion).toBe(potionsBefore + 1);
  await press(page, 'b');
  await advanceDialogue(page);
  await walk(page, 'down', 2);
  await walk(page, 'right', 1);
  s = await walk(page, 'down', 1);
  expect(s.map).toBe('verdantcity');

  // --- Act 5: the Verdant Gym ---
  await page.evaluate(() => window.__PM.debug.setPartyLevels(14));
  await walk(page, 'right', 3);
  await walk(page, 'down', 4);
  await walk(page, 'left', 4);
  s = await walk(page, 'up', 1);
  expect(s.map).toBe('gym');

  // gym trainer Rocco spots us
  s = await walk(page, 'up', 1);
  expect(s.mode).toBe('dialogue');
  const roccoMsgs = await fightThroughDialogue(page, ['razorleaf', 'vinewhip', 'tackle']);
  expect(roccoMsgs.join(' | ')).toContain('super effective');
  s = await state(page);
  expect(s.defeated).toContain('trainer_rocco');

  // around Rocco and up to Leader Terra
  await walk(page, 'left', 1);
  await walk(page, 'up', 7);
  await walk(page, 'right', 1);
  await press(page, 'up');
  await press(page, 'a');
  await waitMode(page, 'dialogue');
  const moneyBeforeTerra = (await state(page)).money;
  await advanceDialogue(page);
  await waitMode(page, 'battle');
  s = await state(page);
  expect(s.battle?.isTrainer).toBe(true);
  await battleLoop(page, { preferMoves: ['razorleaf', 'vinewhip', 'tackle'] });
  await advanceDialogue(page);
  await waitMode(page, 'ending');
  s = await state(page);
  expect(s.badges).toContain('Boulder Badge');
  expect(s.flags.gymDone).toBe(true);
  expect(s.money).toBe(moneyBeforeTerra + 1500);

  // dismiss the ending screen and keep playing
  await press(page, 'a');
  await advanceDialogue(page);
  s = await state(page);
  expect(s.mode).toBe('overworld');
  expect(s.endingShown).toBe(true);

  // --- Act 6: save and continue ---
  await press(page, 'start');
  await waitMode(page, 'menu');
  await press(page, 'down', 4); // SAVE is the 5th item now
  await press(page, 'a');
  await advanceDialogue(page);
  await page.goto('/?seed=777&noenc=1');
  await page.waitForFunction(() => !!window.__PM);
  await waitMode(page, 'title');
  await press(page, 'down');
  await press(page, 'a');
  await waitMode(page, 'overworld');
  s = await state(page);
  expect(s.map).toBe('gym');
  expect(s.badges).toContain('Boulder Badge');
  expect(s.party[0].species).toMatch(/sproutle|bramblore/);
});
