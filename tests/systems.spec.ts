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
} from './helpers';

async function walkUntilBattle(page: Page, maxSteps = 80): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    const dir = i % 2 === 0 ? 'up' : 'down';
    const s = await walk(page, dir, 1);
    if (s.mode === 'battle') return;
  }
  throw new Error('no wild encounter found');
}

test('whiteout halves money and returns to the heal point', async ({ page }) => {
  await newGameWithStarter(page, 2024, 0);
  await page.evaluate(() => {
    window.__PM.debug.setPartyLevels(1);
    window.__PM.debug.warp('gym', 6, 11);
  });
  await walk(page, 'up', 1); // Rocco spots us
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  await waitMode(page, 'battle');
  await battleLoop(page, { maxTurns: 20 });
  const s = await state(page);
  expect(s.mode).toBe('overworld');
  expect(s.map).toBe('mapletown');
  expect(s.money).toBe(1500); // half of 3000
  expect(s.party[0].hp).toBe(s.party[0].maxHp); // healed after whiteout
});

test('struggle is used when every move is out of PP', async ({ page }) => {
  await newGameWithStarter(page, 77, 0);
  await page.evaluate(() => {
    window.__PM.debug.setPartyLevels(12);
    window.__PM.debug.drainPP(0);
    window.__PM.debug.warp('route1', 4, 20);
    window.__PM.debug.noEncounters(false);
  });
  await walkUntilBattle(page);
  const messages = await battleLoop(page, { maxTurns: 30 });
  expect(messages.join(' | ')).toContain('Struggle');
});

test('forget-a-move prompt appears on level-up and can replace a move', async ({ page }) => {
  await newGameWithStarter(page, 5150, 0); // sproutle
  await page.evaluate(() => {
    window.__PM.debug.setPartyLevels(10); // knows 4 moves; razorleaf queues at 11
    window.__PM.debug.warp('route1', 4, 20);
    window.__PM.debug.noEncounters(false);
  });
  let promptSeen = false;
  for (let b = 0; b < 14 && !promptSeen; b++) {
    await walkUntilBattle(page);
    await battleLoop(page, { skipSettle: true, preferMoves: ['vinewhip', 'tackle'] });
    await advanceDialogue(page);
    let s = await state(page);
    if (s.mode === 'menu' && s.menu?.title.includes('wants to learn')) {
      promptSeen = true;
      expect(s.menu.title).toContain('Razor Leaf');
      expect(s.menu.items.length).toBe(5); // 4 forgets + keep
      expect(s.menu.items[4]).toBe('Keep old moves');
      // forget slot 0
      await press(page, 'a');
      await advanceDialogue(page);
      s = await state(page);
      expect(s.mode).toBe('overworld');
      expect(s.party[0].moves).toContain('razorleaf');
      expect(s.party[0].moves[0]).not.toBe('tackle');
    } else {
      await settle(page);
      await page.evaluate(() => window.__PM.debug.healAll());
    }
  }
  expect(promptSeen).toBe(true);
});

test('daycare: two compatible parents produce an egg that hatches on the go', async ({ page }) => {
  await newGameWithStarter(page, 4242, 0);
  await page.evaluate(() => {
    window.__PM.debug.givemon('mimew', 10);
    window.__PM.debug.depositDaycare(0, 1); // sproutle + mimew (Mimic group)
    window.__PM.debug.walk(300);
  });
  let s = await state(page);
  expect(s.daycareEgg).toBe(true);
  // collect the egg from the daycare lady
  await page.evaluate(() => window.__PM.debug.warp('mapletown', 15, 7));
  await press(page, 'right'); // face her
  await press(page, 'a');
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  await waitMode(page, 'menu');
  s = await state(page);
  expect(s.menu?.items[0]).toBe('TAKE EGG');
  await press(page, 'a'); // take it
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  s = await state(page);
  expect(s.party.length).toBe(1);
  expect(s.party[0].isEgg).toBe(true);
  expect(s.party[0].hatchSteps).toBeGreaterThan(0);
  // hatch it
  await page.evaluate(() => window.__PM.debug.hatchEggs());
  s = await state(page);
  expect(s.party[0].isEgg).toBe(false);
  expect(s.party[0].species).toBe('sproutle'); // non-Mimic parent's species
  expect(s.party[0].level).toBe(1);
});

test('NPC trade: pebblit received via trade evolves into bouldron', async ({ page }) => {
  await newGameWithStarter(page, 9090, 0);
  await page.evaluate(() => {
    window.__PM.debug.givemon('nibbit', 5);
    window.__PM.debug.warp('mapletown', 4, 12);
  });
  await press(page, 'left'); // face the hiker
  await press(page, 'a');
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  await waitMode(page, 'menu');
  await press(page, 'a'); // TRADE
  await waitMode(page, 'menu');
  await press(page, 'down'); // select nibbit
  await press(page, 'a');
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  const s = await state(page);
  expect(s.party.length).toBe(2);
  expect(s.party[1].species).toBe('bouldron');
  expect(s.party.some((m) => m.species === 'nibbit')).toBe(false);
  expect(s.flags.hikerTraded).toBe(true);
});

test('stones evolve the right species and fail gracefully on others', async ({ page }) => {
  await newGameWithStarter(page, 1313, 0);
  await page.evaluate(() => {
    window.__PM.debug.givemon('sparkit', 15);
    window.__PM.debug.addItem('thunderstone', 1);
  });
  // try the stone on sproutle first: no effect, not consumed
  await press(page, 'start');
  await waitMode(page, 'menu');
  await press(page, 'down'); // BAG
  await press(page, 'a');
  await waitMode(page, 'menu');
  await press(page, 'a'); // only owned item is the stone
  await waitMode(page, 'menu');
  await press(page, 'a'); // use on sproutle (index 0)
  await waitMode(page, 'dialogue');
  let s = await state(page);
  expect(s.dialogue).toContain('not have any effect');
  await advanceDialogue(page);
  s = await state(page);
  expect(s.inventory.thunderstone).toBe(1);
  expect(s.party[0].species).toBe('sproutle');
  // now use it on sparkit
  await press(page, 'start');
  await waitMode(page, 'menu');
  await press(page, 'down');
  await press(page, 'a');
  await waitMode(page, 'menu');
  await press(page, 'a');
  await waitMode(page, 'menu');
  await press(page, 'down'); // sparkit
  await press(page, 'a');
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  s = await state(page);
  expect(s.party[1].species).toBe('voltkat');
  expect(s.inventory.thunderstone).toBe(0);
});

test('held items can be given via the bag and taken back via the party menu', async ({ page }) => {
  await newGameWithStarter(page, 606, 0);
  await page.evaluate(() => window.__PM.debug.addItem('oranberry', 1));
  await press(page, 'start');
  await waitMode(page, 'menu');
  await press(page, 'down'); // BAG
  await press(page, 'a');
  await waitMode(page, 'menu');
  await press(page, 'a'); // oran berry
  await waitMode(page, 'menu');
  await press(page, 'a'); // give to sproutle
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  let s = await state(page);
  expect(s.party[0].heldItem).toBe('oranberry');
  expect(s.inventory.oranberry ?? 0).toBe(0);
  // take it back through the party context menu
  await press(page, 'start');
  await waitMode(page, 'menu');
  await press(page, 'a'); // MOCKEMON
  await waitMode(page, 'menu');
  await press(page, 'a'); // select sproutle
  await waitMode(page, 'menu');
  s = await state(page);
  expect(s.menu?.items).toContain('TAKE ITEM');
  await press(page, 'down'); // TAKE ITEM
  await press(page, 'a');
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  s = await state(page);
  expect(s.party[0].heldItem).toBeNull();
  expect(s.inventory.oranberry).toBe(1);
  await press(page, 'b'); // leave party menu
});

test('MockDex screen lists species with seen/caught tracking', async ({ page }) => {
  await newGameWithStarter(page, 42, 0);
  await press(page, 'start');
  await waitMode(page, 'menu');
  await press(page, 'down', 2); // MOCKDEX
  await press(page, 'a');
  await waitMode(page, 'dex');
  let s = await state(page);
  expect(s.seen).toBe(1);
  expect(s.caught).toBe(1);
  await press(page, 'down', 5);
  await press(page, 'b');
  s = await state(page);
  expect(s.mode).toBe('menu');
  await press(page, 'b');
});

test('PC storage deposits and withdraws party members', async ({ page }) => {
  await newGameWithStarter(page, 88, 0);
  await page.evaluate(() => {
    for (const sp of ['nibbit', 'fluffowl', 'buzzler', 'thistling', 'sparkit']) window.__PM.debug.givemon(sp, 5);
  });
  let s = await state(page);
  expect(s.party.length).toBe(6);
  await press(page, 'start');
  await waitMode(page, 'menu');
  await press(page, 'down', 3); // STORAGE
  await press(page, 'a');
  await waitMode(page, 'menu');
  await press(page, 'a'); // DEPOSIT
  await waitMode(page, 'menu');
  await press(page, 'down', 5); // sparkit
  await press(page, 'a');
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  s = await state(page);
  expect(s.party.length).toBe(5);
  expect(s.storageCount).toBe(1);
  expect(s.storage[0].species).toBe('sparkit');
  // withdraw it again
  await press(page, 'down'); // WITHDRAW
  await press(page, 'a');
  await waitMode(page, 'menu');
  await press(page, 'a');
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  s = await state(page);
  expect(s.party.length).toBe(6);
  expect(s.storageCount).toBe(0);
  await press(page, 'b');
  await press(page, 'b');
});

test('in-game clock advances and night phase applies', async ({ page }) => {
  await newGameWithStarter(page, 3141, 0);
  let s = await state(page);
  const t0 = s.minute;
  expect(s.phase).toBe('day'); // starts 10:00
  await page.waitForTimeout(2500);
  s = await state(page);
  expect(s.minute).not.toBe(t0); // clock ticks
  await page.evaluate(() => window.__PM.debug.setTime(0)); // midnight
  s = await state(page);
  expect(s.phase).toBe('night');
  // wild battles still work at night
  await page.evaluate(() => {
    window.__PM.debug.warp('route1', 4, 20);
    window.__PM.debug.noEncounters(false);
  });
  await walkUntilBattle(page);
  s = await state(page);
  expect(s.mode).toBe('battle');
  await battleLoop(page, { maxTurns: 20 });
});

test('mart sells stones and held items from the expanded stock', async ({ page }) => {
  await newGameWithStarter(page, 777, 0);
  await page.evaluate(() => window.__PM.debug.warp('mart', 6, 5));
  await walk(page, 'left', 1);
  await walk(page, 'up', 2);
  await press(page, 'up');
  await press(page, 'a');
  await waitMode(page, 'menu');
  let s = await state(page);
  expect(s.menu?.items.some((i) => i.includes('Thunder Stone'))).toBe(true);
  expect(s.menu?.items.some((i) => i.includes('Oran Berry'))).toBe(true);
  // buy a thunderstone (4th item)
  await press(page, 'down', 3);
  const moneyBefore = s.money;
  await press(page, 'a');
  s = await state(page);
  expect(s.money).toBe(moneyBefore - 2100);
  expect(s.inventory.thunderstone).toBe(1);
  await press(page, 'b');
  await advanceDialogue(page);
});
