import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'fs';

const server = await createServer({ server: { port: 5199 } });
await server.listen();
mkdirSync('docs', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 520, height: 380 } });

const press = async (k, times = 1) => {
  for (let i = 0; i < times; i++) {
    await page.evaluate((key) => window.__PM.press(key), k);
    await page.waitForTimeout(80);
  }
};
const advance = async () => {
  for (let i = 0; i < 60; i++) {
    const s = await page.evaluate(() => window.__PM.state());
    if (s.mode !== 'dialogue') return;
    await press('a');
  }
};
const shot = async (name) => {
  await page.waitForTimeout(300);
  await page.locator('#game').screenshot({ path: `docs/${name}.png` });
  console.log('saved', name);
};

await page.goto('http://localhost:5199/?seed=7&noenc=1');
await page.waitForFunction(() => !!window.__PM);
await page.evaluate(() => window.__PM.debug.clearSave());
await shot('title');

await press('a');
await advance();
// walk to professor, choose starter
await press('up', 2);
await press('a');
await advance();
await press('a', 2);
await advance();
await page.evaluate(() => window.__PM.debug.setPartyLevels(9));
await shot('lab');

// wild battle screenshot
await page.evaluate(() => {
  window.__PM.debug.warp('route1', 4, 20);
  window.__PM.debug.noEncounters(false);
});
for (let i = 0; i < 60; i++) {
  const s = await page.evaluate(() => window.__PM.state());
  if (s.mode === 'battle') break;
  await press(i % 2 === 0 ? 'up' : 'down');
  await page.waitForTimeout(250);
}
await press('a'); // past "wild X appeared"
await press('a'); // past "Go, X!"
await shot('battle');

// overworld route shot
await page.evaluate(() => {
  window.__PM.debug.noEncounters(true);
  window.__PM.debug.healAll();
  window.__PM.debug.warp('verdantcity', 9, 10);
});
await press('up');
await shot('city');

await browser.close();
await server.close();
