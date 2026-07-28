import { expect, test } from '@playwright/test';
import { advanceDialogue, battleLoop, newGameWithStarter, press, state, waitMode, walk } from './helpers';

test('water moves are super effective against the rock gym trainer', async ({ page }) => {
  await newGameWithStarter(page, 1234, 2); // puddlefin
  await page.evaluate(() => window.__PM.debug.setPartyLevels(12));
  await page.evaluate(() => window.__PM.debug.warp('gym', 6, 11));
  // walking up triggers Rocco's line of sight
  await walk(page, 'up', 1);
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  await waitMode(page, 'battle');
  const s = await state(page);
  expect(s.battle?.isTrainer).toBe(true);
  expect(s.battle?.enemy.species).toBe('pebblit');
  // puddlefin lv12 moves: tackle, tailwhip, watergun, harden -> water gun = index 2
  const messages = await battleLoop(page, { moveIndex: 2 });
  expect(messages.join(' | ')).toContain("It's super effective!");
  await advanceDialogue(page);
  const after = await state(page);
  expect(after.defeated).toContain('trainer_rocco');
  expect(after.money).toBeGreaterThan(3000);
});

test('wild battles: catching with a MockBall grows the party', async ({ page }) => {
  await newGameWithStarter(page, 999, 0);
  await page.evaluate(() => {
    window.__PM.debug.setPartyLevels(10);
    window.__PM.debug.addItem('mockball', 25);
    window.__PM.debug.warp('route1', 4, 20);
    window.__PM.debug.noEncounters(false);
  });
  // pace between two tall-grass tiles until an encounter triggers
  for (let i = 0; i < 80; i++) {
    const dir = i % 2 === 0 ? 'up' : 'down';
    const s = await walk(page, dir, 1);
    if (s.mode === 'battle') break;
  }
  let s = await state(page);
  expect(s.mode).toBe('battle');
  expect(s.battle?.isTrainer).toBe(false);

  // throw MockBalls until caught
  for (let i = 0; i < 200; i++) {
    s = await state(page);
    if (!s.battle) break;
    if (s.battle.phase === 'msg') {
      await press(page, 'a');
    } else if (s.battle.phase === 'action') {
      await press(page, 'right'); // FIGHT -> BAG
      await press(page, 'a');
    } else if (s.battle.phase === 'bag') {
      await press(page, 'down', 2); // mockball
      await press(page, 'a');
    } else if (s.battle.phase === 'party') {
      await press(page, 'a');
    }
    await page.waitForTimeout(50);
  }
  s = await state(page);
  expect(s.mode).not.toBe('battle');
  expect(s.party.length + s.storageCount).toBe(2);
  expect(s.caught).toBe(2);
});

test('running away from a wild battle works', async ({ page }) => {
  await newGameWithStarter(page, 555, 0);
  await page.evaluate(() => {
    window.__PM.debug.setPartyLevels(10);
    window.__PM.debug.warp('route1', 4, 20);
    window.__PM.debug.noEncounters(false);
  });
  for (let i = 0; i < 80; i++) {
    const dir = i % 2 === 0 ? 'up' : 'down';
    const s = await walk(page, dir, 1);
    if (s.mode === 'battle') break;
  }
  let s = await state(page);
  expect(s.mode).toBe('battle');
  for (let i = 0; i < 100; i++) {
    s = await state(page);
    if (!s.battle) break;
    if (s.battle.phase === 'msg') {
      await press(page, 'a');
    } else if (s.battle.phase === 'action') {
      await press(page, 'down'); // 0 -> 2
      await press(page, 'right'); // 2 -> 3 RUN
      await press(page, 'a');
    } else if (s.battle.phase === 'party') {
      await press(page, 'a');
    }
    await page.waitForTimeout(50);
  }
  s = await state(page);
  expect(s.mode).not.toBe('battle');
  expect(s.party.length).toBe(1);
});
