import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5173/?seed=1234&noenc=1');
await page.waitForFunction(() => !!window.__PM);
await page.evaluate(() => window.__PM.debug.clearSave());
const press = async (k, n = 1) => {
  for (let i = 0; i < n; i++) {
    await page.evaluate((kk) => window.__PM.press(kk), k);
    await page.waitForTimeout(60);
  }
};
const st = () => page.evaluate(() => window.__PM.state());

await press('a');
await page.waitForTimeout(300);
for (let i = 0; i < 20; i++) { const s = await st(); if (s.mode !== 'dialogue') break; await press('a'); }
// walk up to professor
for (let i = 0; i < 2; i++) { await press('up'); await page.waitForTimeout(350); }
await press('a');
await page.waitForTimeout(200);
for (let i = 0; i < 20; i++) { const s = await st(); if (s.mode !== 'dialogue') break; await press('a'); }
// starter menu: pick puddlefin (index 2)
await press('down', 2);
await press('a');
await page.waitForTimeout(200);
await press('a'); // YES
await page.waitForTimeout(200);
for (let i = 0; i < 20; i++) { const s = await st(); if (s.mode !== 'dialogue') break; await press('a'); }
await page.evaluate(() => { window.__PM.debug.setPartyLevels(12); window.__PM.debug.warp('gym', 6, 11); });
await page.waitForTimeout(200);
await press('up');
await page.waitForTimeout(400);
let s = await st();
console.log('after walk up:', s.mode, s.dialogue ?? '');
for (let i = 0; i < 20; i++) { s = await st(); if (s.mode !== 'dialogue') break; await press('a'); }
console.log('mode now:', (await st()).mode);
// battle loop with logging
for (let i = 0; i < 400; i++) {
  s = await st();
  if (!s.battle || s.mode !== 'battle') { console.log('battle ended at iter', i, 'mode', s.mode, 'menu', s.menu?.title, 'dialogue', s.dialogue); break; }
  if (i % 20 === 0) console.log(i, s.battle.phase, 'enemy', s.battle.enemy.species, s.battle.enemy.hp + '/' + s.battle.enemy.maxHp, 'mine', s.battle.active.species, s.battle.active.hp, 'msg:', s.battle.message);
  const b = s.battle;
  if (b.phase === 'msg') await press('a');
  else if (b.phase === 'action') await press('a');
  else if (b.phase === 'moves') {
    let idx = b.active.moves.findIndex((m) => m.id === 'bubblebeam' && m.pp > 0);
    if (idx < 0) idx = b.active.moves.findIndex((m) => m.id === 'watergun' && m.pp > 0);
    if (idx < 0) idx = b.active.moves.findIndex((m) => m.pp > 0);
    if (idx < 0) idx = 0;
    await press('down', idx);
    await press('a');
  } else if (b.phase === 'party') await press('a');
  else if (b.phase === 'bag') await press('b');
  await page.waitForTimeout(60);
}
await browser.close();
