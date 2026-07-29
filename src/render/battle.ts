import { VIEW_H, VIEW_W } from '../constants';
import { MOVES } from '../data/moves';
import { itemName } from '../data/items';
import { displayName, expForLevel, growthOf } from '../mockemon';
import { drawSprite, MON_SPRITES } from '../sprites';
import { hpBar, panel, text, wrap } from '../ui';
import type { Game } from '../game';

export function renderBattle(g: Game): void {
  const ctx = g.ctx;
  const b = g.battle!;
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#8fd3f4');
  grad.addColorStop(1, '#b8e0a0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H - 88);

  // platforms
  ctx.fillStyle = 'rgba(120,160,90,0.6)';
  ctx.beginPath();
  ctx.ellipse(360, 130, 80, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(110, 226, 90, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  // weather/terrain indicator
  if (b.weather || b.terrain) {
    const label = [
      b.weather ? { sun: 'Harsh Sun', rain: 'Rain', sand: 'Sandstorm' }[b.weather] : '',
      b.terrain ? (b.terrain === 'electric' ? 'Electric Terrain' : 'Grassy Terrain') : '',
    ]
      .filter(Boolean)
      .join(' + ');
    panel(ctx, VIEW_W - 160, 12, 148, 22);
    text(ctx, label, VIEW_W - 86, 27, '#ffd93b', 10, true);
  }

  // enemy
  const enemy = b.enemy;
  drawSprite(ctx, MON_SPRITES[enemy.species], 310, 40, 6);
  panel(ctx, 10, 12, 200, 54);
  text(ctx, `${displayName(enemy)}  Lv${enemy.level}`, 20, 30, '#ffffff', 12);
  hpBar(ctx, 20, 40, 160, enemy.hp / enemy.maxHp);
  if (enemy.status) text(ctx, enemy.status, 176, 60, '#e63946', 10);

  // player
  const mine = b.active;
  drawSprite(ctx, MON_SPRITES[mine.species], 50, 140, 6, true);
  panel(ctx, 260, 150, 210, 74);
  text(ctx, `${displayName(mine)}  Lv${mine.level}`, 270, 168, '#ffffff', 12);
  hpBar(ctx, 270, 178, 170, mine.hp / mine.maxHp);
  text(ctx, `${mine.hp}/${mine.maxHp}`, 270, 202, '#ffffff', 11);
  if (mine.status) text(ctx, mine.status, 420, 202, '#e63946', 10);
  const expNow = mine.exp - expForLevel(growthOf(mine), mine.level);
  const expNext = expForLevel(growthOf(mine), mine.level + 1) - expForLevel(growthOf(mine), mine.level);
  ctx.fillStyle = '#29366f';
  ctx.fillRect(270, 210, 170, 6);
  ctx.fillStyle = '#4a9fd8';
  ctx.fillRect(270, 210, 170 * Math.max(0, Math.min(1, expNow / expNext)), 6);

  // message box
  panel(ctx, 0, VIEW_H - 88, VIEW_W, 88);
  if (g.battlePhase === 'msg') {
    const msg = g.battleMsgs[0] ?? '';
    wrap(msg, 54)
      .slice(0, 3)
      .forEach((l, i) => text(ctx, l, 16, VIEW_H - 60 + i * 20, '#ffffff', 13));
    if (Math.floor(g.frame / 30) % 2 === 0)
      text(ctx, '▼', VIEW_W - 26, VIEW_H - 14, '#ffd93b', 12);
  } else if (g.battlePhase === 'action') {
    text(ctx, `What will ${displayName(mine)} do?`, 16, VIEW_H - 50, '#ffffff', 13);
    const grid = ['FIGHT', 'BAG', 'MOCKMON', 'RUN'];
    grid.forEach((gLabel, i) => {
      const gx = 250 + (i % 2) * 110;
      const gy = VIEW_H - 60 + Math.floor(i / 2) * 30;
      const sel = i === g.battleMenuIndex;
      text(ctx, (sel ? '> ' : '  ') + gLabel, gx, gy, sel ? '#ffd93b' : '#ffffff', 13);
    });
  } else if (g.battlePhase === 'moves') {
    const struggleOnly = b.active.moves.every((ms) => ms.pp <= 0);
    if (struggleOnly) {
      const sel = g.battleMenuIndex === 0;
      text(ctx, `${sel ? '> ' : '  '}STRUGGLE`, 16, VIEW_H - 66, '#e63946', 12);
      text(ctx, 'No PP left!', 250, VIEW_H - 66, '#8fa3c0', 11);
    } else {
      b.active.moves.forEach((ms, i) => {
        const mv = MOVES[ms.id];
        const sel = i === g.battleMenuIndex;
        text(
          ctx,
          `${sel ? '> ' : '  '}${mv.name}`,
          16,
          VIEW_H - 66 + i * 19,
          sel ? '#ffd93b' : ms.pp <= 0 ? '#8fa3c0' : '#ffffff',
          12,
        );
        text(ctx, `${mv.type}  PP ${ms.pp}/${mv.pp}`, 250, VIEW_H - 66 + i * 19, '#8fa3c0', 11);
      });
    }
  } else if (g.battlePhase === 'bag') {
    const items = ['potion', 'superpotion', 'mockball'];
    items.forEach((it, i) => {
      const sel = i === g.battleMenuIndex;
      text(
        ctx,
        `${sel ? '> ' : '  '}${itemName(it)} x${g.inventory[it] ?? 0}`,
        16,
        VIEW_H - 62 + i * 22,
        sel ? '#ffd93b' : '#ffffff',
        13,
      );
    });
  } else if (g.battlePhase === 'party') {
    g.party.forEach((m, i) => {
      const sel = i === g.battleMenuIndex;
      const label = m.isEgg
        ? `EGG${i === b.activeIndex ? ' *' : ''}`
        : `${displayName(m)} Lv${m.level} ${m.hp}/${m.maxHp}${m.hp <= 0 ? ' (FNT)' : ''}${i === b.activeIndex ? ' *' : ''}`;
      text(ctx, (sel ? '> ' : '  ') + label, 16, VIEW_H - 70 + i * 14, sel ? '#ffd93b' : '#ffffff', 11);
    });
  }
}
