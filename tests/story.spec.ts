import { expect, test } from '@playwright/test';
import { advanceDialogue, newGameWithStarter, pickMenu, press, state, waitMode, walk } from './helpers';

test.setTimeout(120_000);

test('script-driven ball giver hands out items once and advances the main quest', async ({ page }) => {
  await newGameWithStarter(page, 4711, 0);
  await page.evaluate(() => window.__PM.debug.warp('mapletown', 10, 3));
  const before = await state(page);
  expect(before.questStages.main_journey).toBe('parcel');
  await press(page, 'up');
  await press(page, 'a'); // talk to the old man
  await waitMode(page, 'dialogue');
  await advanceDialogue(page); // drains every page the script queues
  await waitMode(page, 'overworld');
  const after = await state(page);
  expect(after.inventory.mockball).toBe(before.inventory.mockball + 5);
  expect(after.inventory.potion).toBe(before.inventory.potion + 2);
  expect(after.flags.gotBalls).toBe(true);
  expect(after.questStages.main_journey).toBe('badge1');
  expect(after.completedQuests).toContain('parcel');
  // talking again must not repeat the gift
  await press(page, 'a');
  await waitMode(page, 'dialogue');
  const repeat = await state(page);
  expect(repeat.dialogue).toContain('Catch anything good yet?');
  await advanceDialogue(page);
  const final = await state(page);
  expect(final.inventory.mockball).toBe(after.inventory.mockball);
});

test('script-driven nurse heals the party and moves the heal point', async ({ page }) => {
  await newGameWithStarter(page, 4712, 0);
  await page.evaluate(() => {
    window.__PM.debug.warp('center', 5, 2);
    window.__PM.debug.setHp(0, 1);
  });
  await press(page, 'up');
  await press(page, 'a');
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  await waitMode(page, 'overworld');
  const s = await state(page);
  expect(s.party[0].hp).toBe(s.party[0].maxHp);
  expect(s.healPoint.map).toBe('center');
});

test('pause menu shows the next objective and the quest log lists quests', async ({ page }) => {
  await newGameWithStarter(page, 4713, 0);
  await press(page, 'start');
  await waitMode(page, 'menu');
  const s = await state(page);
  expect(s.menu?.info?.join(' ')).toContain('NEXT:');
  expect(s.objective).toContain('parcel');
  await pickMenu(page, 'QUESTS');
  await waitMode(page, 'menu');
  const q = await state(page);
  expect(q.menu?.title).toBe('QUEST LOG');
  expect(q.menu?.items.join(' | ')).toContain('The Main Journey');
});

test('save v2 round-trips quest progress through a reload', async ({ page }) => {
  await newGameWithStarter(page, 4714, 0);
  await page.evaluate(() => {
    window.__PM.debug.runScript('ball_giver');
  });
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  await waitMode(page, 'overworld');
  await press(page, 'start');
  await waitMode(page, 'menu');
  await pickMenu(page, 'SAVE');
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pm_save') ?? '{}'));
  expect(saved.version).toBe(2);
  expect(saved.quests.main_journey.stage).toBeGreaterThan(1);

  await page.goto('/?seed=4714&noenc=1');
  await page.waitForFunction(() => !!window.__PM);
  await waitMode(page, 'title');
  await press(page, 'down'); // CONTINUE
  await press(page, 'a');
  await waitMode(page, 'overworld');
  const s = await state(page);
  expect(s.questStages.main_journey).toBe('badge1');
  expect(s.completedQuests).toContain('parcel');
});

test('legacy save without a quest log migrates instead of breaking', async ({ page }) => {
  await newGameWithStarter(page, 4715, 0);
  await page.evaluate(() => {
    window.__PM.debug.addItem('mockball', 3);
    window.__PM.state();
  });
  await press(page, 'start');
  await waitMode(page, 'menu');
  await pickMenu(page, 'SAVE');
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  // strip the v2 additions to emulate a save written by the previous release
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('pm_save') ?? '{}');
    delete raw.version;
    delete raw.quests;
    raw.flags.gotBalls = true;
    localStorage.setItem('pm_save', JSON.stringify(raw));
  });
  await page.goto('/?seed=4715&noenc=1');
  await page.waitForFunction(() => !!window.__PM);
  await waitMode(page, 'title');
  await press(page, 'down');
  await press(page, 'a');
  await waitMode(page, 'overworld');
  const s = await state(page);
  expect(s.party.length).toBe(1);
  expect(s.activeQuests).toContain('main_journey');
  expect(s.completedQuests).toContain('parcel');
  expect(s.objective).toBeTruthy();
});

test('a corrupted save falls back to a new game instead of crashing', async ({ page }) => {
  await page.goto('/?seed=4716&noenc=1');
  await page.waitForFunction(() => !!window.__PM);
  await page.evaluate(() => localStorage.setItem('pm_save', '{"mapId":"nowhere","party":'));
  await page.reload();
  await page.waitForFunction(() => !!window.__PM);
  await waitMode(page, 'title');
  await press(page, 'down');
  await press(page, 'a'); // CONTINUE on a broken file
  await waitMode(page, 'dialogue');
  const s = await state(page);
  expect(s.map).toBe('lab'); // new game intro instead of a crash
  expect(s.dialogue).toContain('MOCKEMON');
});

test('scripts hand control back to the overworld when they finish', async ({ page }) => {
  await newGameWithStarter(page, 4717, 0);
  await page.evaluate(() => window.__PM.debug.warp('mapletown', 5, 5));
  const fired = await page.evaluate(() => window.__PM.debug.runScript('sign_style'));
  expect(fired).toBe(true);
  await waitMode(page, 'dialogue');
  const s = await state(page);
  expect(s.dialogue).toContain('MAPLE TOWN');
  await advanceDialogue(page);
  await waitMode(page, 'overworld');
  // a second run is allowed once the first one released the runner
  expect(await page.evaluate(() => window.__PM.debug.runScript('sign_style'))).toBe(true);
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  const moved = await walk(page, 'left', 1);
  expect(moved.mode).toBe('overworld');
  expect(moved.x).toBe(4);
});
