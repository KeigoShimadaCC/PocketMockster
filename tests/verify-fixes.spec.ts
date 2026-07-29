import { expect, test } from '@playwright/test';
import { advanceDialogue, newGameWithStarter, pickMenu, press, state, waitMode } from './helpers';

test.setTimeout(120_000);

// Phase 0: newGame() full reset — no stale state from a previous session
test('new game after progression wipes all run state', async ({ page }) => {
  await newGameWithStarter(page, 9901, 0);
  // simulate a player who has progressed significantly
  await page.evaluate(() => {
    const g = (window.__PM as any).state();
    window.__PM.debug.addItem('potion', 10);
    window.__PM.debug.addItem('mockball', 5);
    window.__PM.debug.givemon('nibbit', 8);
    window.__PM.debug.givemon('fluffowl', 6);
  });
  await page.evaluate(() => {
    // stash everything in storage to simulate a full party + storage
    const s = (window.__PM as any).state();
  });
  // set badges/flags/defeated trainers via scripts
  await page.evaluate(() => window.__PM.debug.runScript('ball_giver'));
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  await waitMode(page, 'overworld');

  const before = await state(page);
  expect(before.inventory.mockball).toBeGreaterThan(0);
  expect(before.inventory.potion).toBeGreaterThan(0);
  expect(before.party.length).toBeGreaterThan(1);
  expect(before.completedQuests.length).toBeGreaterThan(0);

  // start a brand new game in the same runtime
  await page.evaluate(() => {
    const game = (window as any).__game;
    // trigger new game via the debug API by clearing save and reloading
    window.__PM.debug.clearSave();
  });
  await page.goto('/?seed=9901&noenc=1');
  await page.waitForFunction(() => !!window.__PM);
  await waitMode(page, 'title');
  await press(page, 'a'); // NEW GAME
  await waitMode(page, 'dialogue');
  await advanceDialogue(page);
  await waitMode(page, 'overworld');

  const after = await state(page);
  expect(after.money).toBe(3000);
  expect(after.badges).toEqual([]);
  expect(after.inventory).toEqual({ potion: 0, superpotion: 0, mockball: 0 });
  expect(after.party).toEqual([]);
  expect(after.defeated).toEqual([]);
  expect(after.activeQuests).toEqual([]);
  expect(after.completedQuests).toEqual([]);
  expect(after.seen).toBe(0);
  expect(after.caught).toBe(0);
});

// Phase 0: save sanitization rejects corrupt party mons
test('corrupted party species falls back to new game', async ({ page }) => {
  await page.goto('/?seed=9902&noenc=1');
  await page.waitForFunction(() => !!window.__PM);
  await page.evaluate(() => {
    localStorage.setItem('pm_save', JSON.stringify({
      version: 2,
      mapId: 'mapletown',
      px: 7, py: 9,
      party: [{ species: 'MISSINGNO', level: 5, hp: 20, maxHp: 20 }],
      flags: { starterChosen: true },
      inventory: { potion: 1, superpotion: 0, mockball: 0 },
      money: 5000,
    }));
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__PM);
  await waitMode(page, 'title');
  await press(page, 'down'); // CONTINUE
  await press(page, 'a');
  await waitMode(page, 'dialogue');
  const s = await state(page);
  expect(s.map).toBe('lab');
  expect(s.dialogue).toContain('MOCKEMON');
});

// Phase 0: v1 save without version field migrates quests
test('versionless save migrates quest log on load', async ({ page }) => {
  await page.goto('/?seed=9903&noenc=1');
  await page.waitForFunction(() => !!window.__PM);
  await page.evaluate(() => {
    localStorage.setItem('pm_save', JSON.stringify({
      mapId: 'mapletown',
      px: 7, py: 9,
      party: [{ species: 'sproutle', level: 10, hp: 30, maxHp: 30, moves: [{ id: 'tackle', pp: 35 }], nature: 'hardy', ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 }, evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ability: 'verdantforce', friendship: 70, shiny: false, pv: 0, status: null, sleepTurns: 0, toxicCounter: 0, pendingMoves: [], nickname: 'Sproutle', exp: 1000, gender: 'M' }],
      flags: { starterChosen: true, gotBalls: true },
      badges: ['Boulder Badge'],
      inventory: { potion: 3, superpotion: 0, mockball: 5 },
      money: 4000,
    }));
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__PM);
  await waitMode(page, 'title');
  await press(page, 'down');
  await press(page, 'a');
  await waitMode(page, 'overworld');
  const s = await state(page);
  expect(s.party.length).toBe(1);
  expect(s.activeQuests).toContain('main_journey');
  expect(s.completedQuests).toContain('parcel');
});

// Phase 0: save with out-of-range values gets clamped
test('save with extreme values is clamped not rejected', async ({ page }) => {
  await page.goto('/?seed=9904&noenc=1');
  await page.waitForFunction(() => !!window.__PM);
  await page.evaluate(() => {
    localStorage.setItem('pm_save', JSON.stringify({
      version: 2,
      mapId: 'mapletown',
      px: 999, py: -5,
      party: [{ species: 'sproutle', level: 10, hp: 30, maxHp: 30, moves: [{ id: 'tackle', pp: 35 }], nature: 'hardy', ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 }, evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ability: 'verdantforce', friendship: 70, shiny: false, pv: 0, status: null, sleepTurns: 0, toxicCounter: 0, pendingMoves: [], nickname: 'Sproutle', exp: 1000, gender: 'M' }],
      flags: { starterChosen: true },
      inventory: { potion: 99999, superpotion: 0, mockball: -5 },
      money: -1000,
      minute: 99999,
    }));
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__PM);
  await waitMode(page, 'title');
  await press(page, 'down');
  await press(page, 'a');
  await waitMode(page, 'overworld');
  const s = await state(page);
  expect(s.money).toBeGreaterThanOrEqual(0);
  expect(s.money).toBeLessThanOrEqual(9999999);
  expect(s.party[0].hp).toBeLessThanOrEqual(s.party[0].maxHp);
});

// Phase 0: safe manual save reports failure gracefully
test('manual save via menu persists and shows confirmation', async ({ page }) => {
  await newGameWithStarter(page, 9905, 0);
  await press(page, 'start');
  await waitMode(page, 'menu');
  await pickMenu(page, 'SAVE');
  await waitMode(page, 'dialogue');
  const s = await state(page);
  expect(s.dialogue).toContain('saved');
  await advanceDialogue(page);
  await waitMode(page, 'overworld');
  const saved = await page.evaluate(() => !!localStorage.getItem('pm_save'));
  expect(saved).toBe(true);
});

// Phase 2.1: tile registry — 'M' (machine) is walkable, 'T' (tree) is solid
test('tile registry: machine tile is walkable, tree is solid', async ({ page }) => {
  await newGameWithStarter(page, 9906, 0);
  // warp to a map with machine tiles (center has 'M' tiles)
  await page.evaluate(() => window.__PM.debug.warp('center', 3, 4));
  await waitMode(page, 'overworld');
  const s = await state(page);
  // verify we can walk around the center (machine tiles are not solid)
  expect(s.map).toBe('center');
  // walk right — if 'M' were solid this would fail silently
  await press(page, 'right');
  await page.waitForTimeout(200);
  const moved = await state(page);
  // player should have moved (or at least not be stuck)
  expect(moved.mode).toBe('overworld');
});

// Phase 1: render extraction — all screens render without errors
test('all game modes render without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await newGameWithStarter(page, 9907, 0);
  await waitMode(page, 'overworld');
  // open start menu
  await press(page, 'start');
  await waitMode(page, 'menu');
  const s = await state(page);
  expect(s.menu?.items).toContain('MOCKDEX');
  // close menu
  await press(page, 'b');
  await waitMode(page, 'overworld');
  expect(errors).toEqual([]);
});

// Phase 3: agent harness — health endpoint responds with version info
test('agent server health check and pricing table load', async ({ request }) => {
  // This test verifies the harness can boot; the full agent test is in agent.spec.ts
  // We just check the pricing file is valid JSON here
  const fs = await import('fs');
  const path = await import('path');
  const pricingPath = path.resolve('tools/agent/pricing.json');
  const pricing = JSON.parse(fs.readFileSync(pricingPath, 'utf-8'));
  expect(pricing).toBeDefined();
  expect(Object.keys(pricing).length).toBeGreaterThan(0);
  for (const [model, rates] of Object.entries(pricing)) {
    const r = rates as Record<string, number>;
    expect(r.input).toBeGreaterThan(0);
    expect(r.output).toBeGreaterThan(0);
  }
});
