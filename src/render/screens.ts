import { VIEW_H, VIEW_W } from '../constants';
import { ABILITIES } from '../data/abilities';
import { itemName } from '../data/items';
import { DEX_ORDER, SPECIES } from '../data/species';
import { TYPE_COLORS } from '../data/types';
import { MOVES } from '../data/moves';
import { readSlots } from '../frontend';
import { def, displayName, expForLevel, growthOf } from '../mockemon';
import { drawSprite, MON_SPRITES } from '../sprites';
import { formatPlaytime, panel, text, wrap } from '../ui';
import type { Game } from '../game';

export function renderTitle(g: Game): void {
  const ctx = g.ctx;
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#29366f');
  grad.addColorStop(1, '#3b5dc9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(ctx, 'POCKET', 240, 60, '#ffd93b', 40, true);
  text(ctx, 'MOCKSTER', 240, 100, '#ffffff', 40, true);
  const keys = Object.keys(MON_SPRITES);
  const idx = Math.floor(g.frame / 45) % keys.length;
  drawSprite(ctx, MON_SPRITES[keys[idx]], 240 - 32, 115, 4);
  const options = g.titleOptions();
  options.forEach((o, i) => {
    const sel = i === g.titleIndex;
    text(ctx, (sel ? '> ' : '  ') + o, 240, 220 + i * 24, sel ? '#ffd93b' : '#c0cbdc', 15, true);
  });
  if (g.hasSave()) {
    const slots = readSlots();
    const newest = slots.reduce((best, s) => (!s.empty && s.savedAt > best.savedAt ? s : best), slots[0]);
    if (!newest.empty) {
      text(ctx, `${newest.lead}  ${newest.badges}B  ${newest.playtime}`, 240, 300, '#8fa3c0', 11, true);
    }
  }
}

export function renderDialogue(g: Game): void {
  const ctx = g.ctx;
  panel(ctx, 8, VIEW_H - 92, VIEW_W - 16, 84);
  const page = g.dialogueQueue[0] ?? '';
  const lines = wrap(page, 54);
  lines.slice(0, 3).forEach((l, i) => text(ctx, l, 20, VIEW_H - 66 + i * 20, '#ffffff', 13));
  if (Math.floor(g.frame / 30) % 2 === 0) text(ctx, '▼', VIEW_W - 30, VIEW_H - 18, '#ffd93b', 12);
}

export function renderMenu(g: Game): void {
  const m = g.menu;
  if (!m) return; // menu was cleared but mode hasn't transitioned yet
  const ctx = g.ctx;
  const h = 40 + m.items.length * 22 + (m.info ? m.info.length * 18 : 0);
  const w = 260;
  const x = VIEW_W / 2 - w / 2;
  const y = Math.max(10, VIEW_H / 2 - h / 2);
  panel(ctx, x, y, w, h);
  text(ctx, m.title, x + 12, y + 22, '#ffd93b', 13);
  m.items.forEach((it, i) => {
    const sel = i === m.index;
    text(ctx, (sel ? '> ' : '  ') + it, x + 14, y + 46 + i * 22, sel ? '#ffd93b' : '#ffffff', 13);
  });
  if (m.info) {
    m.info.forEach((l, i) =>
      text(ctx, l, x + 14, y + 46 + m.items.length * 22 + i * 18, '#8fa3c0', 11),
    );
  }
}

export function renderSummary(g: Game): void {
  const ctx = g.ctx;
  const m = g.summaryMon!;
  const s = def(m);
  ctx.fillStyle = '#29366f';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (m.isEgg) {
    text(ctx, 'EGG', 240, 60, '#ffd93b', 24, true);
    text(ctx, `It looks like it will hatch soon... (${m.hatchSteps ?? 0} steps left)`, 240, 120, '#c0cbdc', 12, true);
    text(ctx, 'Watch over it as you walk!', 240, 150, '#8fa3c0', 12, true);
    text(ctx, 'Press B to go back', 360, 310, '#8fa3c0', 10);
    return;
  }
  drawSprite(ctx, MON_SPRITES[m.species], 30, 30, 6);
  text(ctx, `${displayName(m)}  Lv${m.level}${m.gender ? (m.gender === 'M' ? ' \u2642' : ' \u2640') : ''}`, 160, 40, '#ffffff', 16);
  s.types.forEach((t, i) => {
    ctx.fillStyle = TYPE_COLORS[t];
    ctx.fillRect(160 + i * 74, 50, 68, 18);
    text(ctx, t, 194 + i * 74, 63, '#ffffff', 11, true);
  });
  text(ctx, `HP  ${m.hp}/${m.maxHp}`, 160, 92, '#ffffff', 12);
  text(ctx, `ATK ${m.atk}   DEF ${m.def}`, 160, 112, '#ffffff', 12);
  text(ctx, `SPA ${m.spa}   SPD ${m.spd}   SPE ${m.spe}`, 160, 132, '#ffffff', 12);
  text(ctx, `EXP ${m.exp}  (next: ${expForLevel(growthOf(m), m.level + 1)})`, 160, 152, '#8fa3c0', 11);
  const ability = ABILITIES[m.ability];
  text(ctx, `Nature: ${m.nature}   Ability: ${ability?.name ?? m.ability}`, 160, 172, '#8fa3c0', 11);
  text(ctx, `Item: ${m.heldItem ? itemName(m.heldItem) : 'none'}   Friendship: ${m.friendship}`, 160, 190, '#8fa3c0', 11);
  text(ctx, 'MOVES', 30, 212, '#ffd93b', 13);
  m.moves.forEach((ms, i) => {
    const mv = MOVES[ms.id];
    text(ctx, `${mv.name}  (${mv.type})  PP ${ms.pp}/${mv.pp}`, 30, 232 + i * 18, '#ffffff', 12);
  });
  text(ctx, wrap(s.dex, 60)[0] ?? '', 30, 310, '#c0cbdc', 10);
  text(ctx, 'Press B to go back', 360, 310, '#8fa3c0', 10);
}

export function renderDex(g: Game): void {
  const ctx = g.ctx;
  ctx.fillStyle = '#29366f';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(ctx, `MOCKDEX   Seen ${g.seenSpecies.size}/${DEX_ORDER.length}   Caught ${g.caughtSpecies.size}/${DEX_ORDER.length}`, 20, 24, '#ffd93b', 13);
  const perPage = 11;
  const page = Math.floor(g.dexIndex / perPage);
  const start = page * perPage;
  for (let i = start; i < Math.min(start + perPage, DEX_ORDER.length); i++) {
    const key = DEX_ORDER[i];
    const s = SPECIES[key];
    const row = i - start;
    const sel = i === g.dexIndex;
    const seen = g.seenSpecies.has(key);
    const caught = g.caughtSpecies.has(key);
    const label = seen ? s.name : '----------';
    const ball = caught ? '\u25cf ' : '  ';
    text(ctx, `${sel ? '>' : ' '} ${ball}${String(s.id).padStart(2, ' ')}. ${label}`, 20, 52 + row * 22, sel ? '#ffd93b' : seen ? '#ffffff' : '#8fa3c0', 13);
  }
  const key = DEX_ORDER[g.dexIndex];
  const s = SPECIES[key];
  if (g.seenSpecies.has(key)) {
    drawSprite(ctx, MON_SPRITES[key], 330, 52, 4);
    text(ctx, s.types.join(' / '), 330, 140, '#c0cbdc', 12);
    if (g.caughtSpecies.has(key)) {
      wrap(s.dex, 26).slice(0, 5).forEach((l, i) => text(ctx, l, 300, 170 + i * 18, '#8fa3c0', 11));
    } else {
      text(ctx, 'Not caught yet.', 300, 170, '#8fa3c0', 11);
    }
  }
  text(ctx, 'X/Esc: back', 380, 306, '#8fa3c0', 11);
}

export function renderEnding(g: Game): void {
  const ctx = g.ctx;
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#29366f');
  grad.addColorStop(1, '#5d275d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(ctx, 'CONGRATULATIONS!', 240, 80, '#ffd93b', 24, true);
  text(ctx, 'You are the Champion of the Mocca region!', 240, 120, '#ffffff', 14, true);
  text(ctx, `Badges: ${g.badges.length}/8`, 240, 155, '#c0cbdc', 12, true);
  text(ctx, `MockDex: seen ${g.seenSpecies.size}/${DEX_ORDER.length}, caught ${g.caughtSpecies.size}/${DEX_ORDER.length}`, 240, 175, '#c0cbdc', 12, true);
  text(ctx, `Playtime: ${formatPlaytime(g.playFrames)}`, 240, 195, '#c0cbdc', 12, true);
  text(ctx, 'Press Z/Enter for credits', 240, 290, '#8fa3c0', 11, true);
}
