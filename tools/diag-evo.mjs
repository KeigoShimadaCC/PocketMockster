import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()); });
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message));

const state = () => page.evaluate(() => window.__PM.state());
const press = async (k, n = 1) => {
  for (let i = 0; i < n; i++) { await page.evaluate((key) => window.__PM.press(key), k); await page.waitForTimeout(60); }
};

await page.goto('http://localhost:5199/?seed=31415&noenc=1');
await page.waitForFunction(() => !!window.__PM);
await page.evaluate(() => window.__PM.debug.clearSave());
await page.waitForFunction(() => window.__PM.state().mode === 'title');
await press('a');
await page.waitForFunction(() => window.__PM.state().mode === 'dialogue');
for (let i = 0; i < 30; i++) { const s = await state(); if (s.mode !== 'dialogue') break; await press('a'); }
// walk to professor and pick sproutle
await press('up'); await page.waitForTimeout(300);
await press('up'); await page.waitForTimeout(300);
await press('a'); await page.waitForTimeout(200);
for (let i = 0; i < 20; i++) { const s = await state(); if (s.mode !== 'dialogue') break; await press('a'); }
let s = await state();
console.log('mode at starter menu:', s.mode);
await press('a'); // choose sproutle
await page.waitForTimeout(200);
await press('a'); // YES
await page.waitForTimeout(200);
for (let i = 0; i < 20; i++) { const st = await state(); if (st.mode !== 'dialogue') break; await press('a'); }

await page.evaluate(() => {
  window.__PM.debug.setPartyLevels(14);
  const p = window.__PM.state().party[0];
  window.__PM.debug.addExp(0, p.expNext - p.exp - 1);
  window.__PM.debug.warp('route1', 4, 20);
  window.__PM.debug.noEncounters(false);
});
s = await state();
console.log('pre-battle:', JSON.stringify({ exp: s.party[0].exp, expNext: s.party[0].expNext, level: s.party[0].level }));

// walk until battle
for (let i = 0; i < 90; i++) {
  await press(i % 2 === 0 ? 'up' : 'down');
  await page.waitForTimeout(120);
  s = await state();
  if (s.mode === 'battle') break;
}
console.log('mode:', s.mode, 'enemy:', s.battle?.enemy.species);

// fight
for (let i = 0; i < 200; i++) {
  s = await state();
  if (s.mode !== 'battle') break;
  if (s.battle.phase === 'msg') await press('a');
  else if (s.battle.phase === 'action') await press('a');
  else if (s.battle.phase === 'moves') { await press('down', 3); await press('a'); } // razorleaf
  else if (s.battle.phase === 'party') await press('a');
  await page.waitForTimeout(50);
}
console.log('after battle mode:', s.mode, 'dialogue:', (await state()).dialogue);
s = await state();
console.log('party:', JSON.stringify(s.party.map((m) => ({ sp: m.species, lv: m.level, exp: m.exp }))));
for (let i = 0; i < 10 && s.mode === 'dialogue'; i++) { await press('a'); await page.waitForTimeout(100); s = await state(); console.log('dlg:', s.dialogue, 'mode:', s.mode); }
console.log('final:', JSON.stringify(s.party.map((m) => ({ sp: m.species, lv: m.level }))));

await browser.close();
await server.close();
