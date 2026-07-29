import { BAR_H, TILE, VIEW_H, VIEW_W } from '../constants';
import { formatTime, phaseFor, tintFor } from '../daynight';
import { BADGE_FLAG_SHALLOW, SHALLOW_TILE } from '../maps';
import { drawSprite, PEOPLE } from '../sprites';
import { panel, text } from '../ui';
import type { Game } from '../game';

export function renderOverworld(g: Game): void {
  const ctx = g.ctx;
  const map = g.map;
  const mapW = map.tiles[0].length * TILE;
  const mapH = map.tiles.length * TILE;
  const playerPx = g.px * TILE + g.moveOffX;
  const playerPy = g.py * TILE + g.moveOffY;
  let camX = playerPx + TILE / 2 - VIEW_W / 2;
  let camY = playerPy + TILE / 2 - VIEW_H / 2;
  camX = mapW <= VIEW_W ? (mapW - VIEW_W) / 2 : Math.max(0, Math.min(mapW - VIEW_W, camX));
  camY = mapH <= VIEW_H ? (mapH - VIEW_H) / 2 : Math.max(0, Math.min(mapH - VIEW_H, camY));

  const x0 = Math.floor(camX / TILE) - 1;
  const y0 = Math.floor(camY / TILE) - 1;
  for (let ty = y0; ty <= y0 + 12; ty++) {
    for (let tx = x0; tx <= x0 + 17; tx++) {
      drawTile(g, tx, ty, Math.round(tx * TILE - camX), Math.round(ty * TILE - camY));
    }
  }
  for (const it of map.items) {
    if (g.collectedItems.has(it.id)) continue;
    const x = Math.round(it.x * TILE - camX);
    const y = Math.round(it.y * TILE - camY);
    ctx.fillStyle = '#e63946';
    ctx.fillRect(x + 10, y + 12, 12, 10);
    ctx.fillStyle = '#f1faee';
    ctx.fillRect(x + 10, y + 17, 12, 5);
    ctx.fillStyle = '#1a1c2c';
    ctx.fillRect(x + 14, y + 15, 4, 4);
  }
  for (const npc of map.npcs) {
    if (!g.npcVisible(npc)) continue;
    const x = Math.round(npc.x * TILE - camX);
    const y = Math.round(npc.y * TILE - camY);
    drawSprite(ctx, PEOPLE[npc.spriteKey] ?? PEOPLE.villager1, x, y, 2, npc.facing === 'left');
    if (npc.trainer && !g.defeatedTrainers.has(npc.trainer.id) && npc.trainer.sight > 0) {
      text(ctx, '!', x + 16, y - 4, '#e63946', 14, true);
    }
  }
  drawSprite(
    ctx,
    PEOPLE.player,
    Math.round(playerPx - camX),
    Math.round(playerPy - camY),
    2,
    g.facing === 'left',
  );
  // location banner + clock
  panel(ctx, 6, 6, 150, 24);
  text(ctx, map.name, 12, 22, '#ffffff', 12);
  panel(ctx, VIEW_W - 86, 6, 80, 24);
  text(ctx, formatTime(g.minute), VIEW_W - 46, 22, phaseFor(g.minute) === 'night' ? '#7fc8f8' : '#ffd93b', 12, true);
}

export function renderTint(g: Game): void {
  if (g.map.indoor) return;
  const t = tintFor(phaseFor(g.minute));
  if (t.alpha <= 0) return;
  const ctx = g.ctx;
  ctx.save();
  ctx.globalAlpha = t.alpha;
  ctx.fillStyle = t.color;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.restore();
}

export function renderControlsBar(g: Game): void {
  const ctx = g.ctx;
  const hints: Record<Game['mode'], string> = {
    intro: 'X/Esc: skip',
    title: '\u2191\u2193 select   Z/Enter confirm',
    overworld: '\u2190\u2191\u2193\u2192/WASD move   Z/Enter interact   M/Shift menu',
    dialogue: 'Z/Enter next',
    menu: '\u2191\u2193 select   Z/Enter ok   X/Esc back',
    battle: '\u2190\u2191\u2193\u2192 select   Z/Enter ok   X/Esc back',
    summary: 'Z/Enter or X/Esc back',
    dex: '\u2191\u2193 browse   X/Esc back',
    ending: 'Z/Enter continue',
    credits: 'X/Esc: skip',
  };
  ctx.fillStyle = '#11131f';
  ctx.fillRect(0, VIEW_H, VIEW_W, BAR_H);
  ctx.fillStyle = '#333c57';
  ctx.fillRect(0, VIEW_H, VIEW_W, 2);
  text(ctx, hints[g.mode], VIEW_W / 2, VIEW_H + 21, '#8fa3c0', 12, true);
}

function drawTile(g: Game, tx: number, ty: number, x: number, y: number): void {
  const ctx = g.ctx;
  const ch = g.tileAt(tx, ty);
  const indoor = g.map.indoor;
  switch (ch) {
    case '.': {
      ctx.fillStyle = '#7ec850';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#6db843';
      if ((tx + ty) % 2 === 0) ctx.fillRect(x + 6, y + 6, 3, 3);
      ctx.fillRect(x + 20, y + 22, 3, 3);
      break;
    }
    case ',': {
      ctx.fillStyle = '#d9c27e';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#c9b26e';
      ctx.fillRect(x + 4, y + 10, 4, 3);
      ctx.fillRect(x + 22, y + 20, 4, 3);
      break;
    }
    case 'G': {
      ctx.fillStyle = '#4f9e3a';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#3d7f2c';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(x + 3 + i * 8, y + 8, 3, 18);
        ctx.fillRect(x + 5 + i * 8, y + 14, 3, 12);
      }
      break;
    }
    case 'T': {
      ctx.fillStyle = '#7ec850';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#5a4632';
      ctx.fillRect(x + 12, y + 20, 8, 10);
      ctx.fillStyle = '#2e7d3a';
      ctx.fillRect(x + 2, y + 2, 28, 20);
      ctx.fillStyle = '#3f9c4d';
      ctx.fillRect(x + 5, y + 4, 10, 8);
      break;
    }
    case 'W': {
      ctx.fillStyle = '#4a9fd8';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#7fc8f8';
      const wave = Math.floor(g.frame / 30) % 2;
      ctx.fillRect(x + 4 + wave * 4, y + 8, 12, 2);
      ctx.fillRect(x + 14 - wave * 4, y + 22, 12, 2);
      break;
    }
    case 'R': {
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#a03225';
      ctx.fillRect(x, y + 12, TILE, 4);
      ctx.fillRect(x, y + 26, TILE, 4);
      break;
    }
    case 'B': {
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#87ceeb';
      ctx.fillRect(x + 8, y + 8, 16, 12);
      ctx.strokeStyle = '#b8ac90';
      ctx.strokeRect(x + 8.5, y + 8.5, 15, 11);
      break;
    }
    case 'D': {
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(x + 6, y + 4, 20, 28);
      ctx.fillStyle = '#ffd93b';
      ctx.fillRect(x + 21, y + 18, 3, 3);
      break;
    }
    case 'S': {
      ctx.fillStyle = indoor ? '#d8cfc0' : '#7ec850';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#5a4632';
      ctx.fillRect(x + 14, y + 16, 4, 14);
      ctx.fillStyle = '#8a6547';
      ctx.fillRect(x + 4, y + 4, 24, 14);
      break;
    }
    case 'w': {
      ctx.fillStyle = '#8d99ae';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#6e7a8e';
      ctx.fillRect(x, y + 24, TILE, 8);
      break;
    }
    case 'F': {
      ctx.fillStyle = '#d8cfc0';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#ccc2b0';
      if ((tx + ty) % 2 === 0) ctx.fillRect(x, y, TILE, TILE);
      break;
    }
    case 'C': {
      ctx.fillStyle = '#d8cfc0';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#a06a3a';
      ctx.fillRect(x + 1, y + 6, 30, 24);
      ctx.fillStyle = '#c08a4a';
      ctx.fillRect(x + 1, y + 6, 30, 8);
      break;
    }
    case 'M': {
      ctx.fillStyle = '#d8cfc0';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#6e7a8e';
      ctx.fillRect(x + 2, y + 2, 28, 28);
      ctx.fillStyle = '#8d99ae';
      ctx.fillRect(x + 6, y + 6, 20, 20);
      break;
    }
    case 'P': {
      ctx.fillStyle = '#d8cfc0';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#a06a3a';
      ctx.fillRect(x, y + 8, TILE, 22);
      if (!g.flags.starterChosen) {
        ctx.fillStyle = '#e63946';
        ctx.beginPath();
        ctx.arc(x + 16, y + 16, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f1faee';
        ctx.fillRect(x + 10, y + 16, 12, 4);
      }
      break;
    }
    case 'o': {
      ctx.fillStyle = g.map.indoor ? '#d8cfc0' : '#7ec850';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#8d8371';
      ctx.beginPath();
      ctx.arc(x + 16, y + 18, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a89e8c';
      ctx.beginPath();
      ctx.arc(x + 13, y + 14, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case SHALLOW_TILE: {
      const open = !!g.flags[BADGE_FLAG_SHALLOW];
      ctx.fillStyle = open ? '#5aa9e6' : '#3a7ca5';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#a8dadc';
      const bob = Math.sin((g.frame + tx * 9 + ty * 5) / 22) * 3;
      ctx.fillRect(x + 3, y + 12 + bob, 12, 3);
      ctx.fillRect(x + 18, y + 20 - bob, 11, 3);
      break;
    }
    case 'x': {
      const hot = g.lavaHot();
      ctx.fillStyle = hot ? '#e2543a' : '#5a3a34';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = hot ? '#ffd93b' : '#7a4a3a';
      ctx.fillRect(x + 4, y + 6, 24, 6);
      ctx.fillRect(x + 8, y + 20, 16, 5);
      break;
    }
    case '#': {
      ctx.fillStyle = g.map.indoor ? '#cfd8e0' : '#a8c8d8';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      const drift = (g.frame / 4 + tx * 6) % TILE;
      ctx.beginPath();
      ctx.moveTo(x + drift, y + 8);
      ctx.lineTo(x + drift - 10, y + 8);
      ctx.moveTo(x + drift, y + 22);
      ctx.lineTo(x + drift - 14, y + 22);
      ctx.stroke();
      break;
    }
    case '_': {
      ctx.fillStyle = '#3d3f52';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#5a5f7a';
      ctx.fillRect(x + 2, y + 2, 28, 28);
      break;
    }
    default: {
      ctx.fillStyle = '#1a1c2c';
      ctx.fillRect(x, y, TILE, TILE);
    }
  }
  renderTileOverlay(g, tx, ty, x, y);
}

function renderTileOverlay(g: Game, tx: number, ty: number, x: number, y: number): void {
  const ctx = g.ctx;
  const gate = g.gateAt(tx, ty);
  if (gate && !g.gateOpen(gate)) {
    ctx.fillStyle = '#8d99ae';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 2 + i * 8, y, 4, TILE);
    ctx.fillStyle = '#e63946';
    ctx.fillRect(x + 12, y + 13, 8, 6);
    return;
  }
  const button = g.map.buttons?.find((b) => b.x === tx && b.y === ty);
  if (button) {
    const on = !!g.flags[button.flag];
    ctx.fillStyle = '#463f33';
    ctx.fillRect(x + 6, y + 8, 20, 16);
    ctx.fillStyle = on ? '#5ad25a' : '#e63946';
    ctx.fillRect(x + 10, on ? y + 12 : y + 16, 12, 6);
    return;
  }
  const pad = g.map.pads?.find((p) => p.x === tx && p.y === ty);
  if (pad) {
    const pulse = 6 + Math.sin(g.frame / 12) * 3;
    ctx.fillStyle = '#7d3ac0';
    ctx.beginPath();
    ctx.arc(x + 16, y + 16, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8a7ff';
    ctx.beginPath();
    ctx.arc(x + 16, y + 16, pulse, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const one = g.map.oneWay?.find((o) => o.x === tx && o.y === ty);
  if (one) {
    ctx.fillStyle = '#f1faee';
    const cx = x + 16;
    const cy = y + 16;
    const arrow: Record<string, [number, number][]> = {
      up: [[cx, cy - 8], [cx - 7, cy + 6], [cx + 7, cy + 6]],
      down: [[cx, cy + 8], [cx - 7, cy - 6], [cx + 7, cy - 6]],
      left: [[cx - 8, cy], [cx + 6, cy - 7], [cx + 6, cy + 7]],
      right: [[cx + 8, cy], [cx - 6, cy - 7], [cx - 6, cy + 7]],
    };
    const pts = arrow[one.dir];
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[1][0], pts[1][1]);
    ctx.lineTo(pts[2][0], pts[2][1]);
    ctx.closePath();
    ctx.fill();
  }
}
