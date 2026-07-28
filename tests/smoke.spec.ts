import { expect, test } from '@playwright/test';
import { advanceDialogue, newGameWithStarter, press, state, waitMode } from './helpers';

test('title screen loads', async ({ page }) => {
  await page.goto('/?seed=42&noenc=1');
  await page.waitForFunction(() => !!window.__PM);
  await page.evaluate(() => window.__PM.debug.clearSave());
  const s = await state(page);
  expect(s.mode).toBe('title');
  await expect(page.locator('#game')).toBeVisible();
});

test('new game intro leads to the lab', async ({ page }) => {
  await page.goto('/?seed=42&noenc=1');
  await page.waitForFunction(() => !!window.__PM);
  await page.evaluate(() => window.__PM.debug.clearSave());
  await press(page, 'a');
  await waitMode(page, 'dialogue');
  let s = await state(page);
  expect(s.dialogue).toContain('Welcome to the world of MOCKEMON');
  await advanceDialogue(page);
  s = await state(page);
  expect(s.mode).toBe('overworld');
  expect(s.map).toBe('lab');
  expect(s.party.length).toBe(0);
});

test('choosing a starter fills the party and sets flags', async ({ page }) => {
  await newGameWithStarter(page, 42, 0);
  const s = await state(page);
  expect(s.party.length).toBe(1);
  expect(s.party[0].species).toBe('sproutle');
  expect(s.party[0].level).toBe(5);
  expect(s.party[0].hp).toBeGreaterThan(0);
  expect(s.flags.starterChosen).toBe(true);
});

test('cannot leave town without a starter', async ({ page }) => {
  await page.goto('/?seed=42&noenc=1');
  await page.waitForFunction(() => !!window.__PM);
  await page.evaluate(() => window.__PM.debug.clearSave());
  await press(page, 'a');
  await advanceDialogue(page);
  await waitMode(page, 'overworld');
  await page.evaluate(() => window.__PM.debug.warp('mapletown', 8, 2));
  await press(page, 'up', 2);
  await page.waitForTimeout(800);
  const s = await state(page);
  expect(s.map).toBe('mapletown');
  expect(s.mode).toBe('dialogue');
  expect(s.dialogue).toContain('dangerous to go out');
});

test('save and continue restores progress', async ({ page }) => {
  await newGameWithStarter(page, 42, 1);
  // open start menu and save
  await press(page, 'start');
  await waitMode(page, 'menu');
  await press(page, 'down', 4); // SAVE is the 5th item now
  await press(page, 'a');
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  // reload and continue
  await page.goto('/?seed=42&noenc=1');
  await page.waitForFunction(() => !!window.__PM);
  await waitMode(page, 'title');
  await press(page, 'down');
  await press(page, 'a'); // CONTINUE
  await waitMode(page, 'overworld');
  const s = await state(page);
  expect(s.map).toBe('lab');
  expect(s.party.length).toBe(1);
  expect(s.party[0].species).toBe('cindercub');
  expect(s.flags.starterChosen).toBe(true);
});
