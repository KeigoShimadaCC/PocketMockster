export function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  color: string,
  size: number,
  center = false,
): void {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px "Courier New", monospace`;
  ctx.textAlign = center ? 'center' : 'left';
  ctx.fillText(s, x, y);
  ctx.textAlign = 'left';
}

export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(20,24,46,0.92)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#8fa3c0';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
}

export function hpBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  ratio: number,
): void {
  const r = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = '#29366f';
  ctx.fillRect(x, y, w, 10);
  ctx.fillStyle = r > 0.5 ? '#38b764' : r > 0.2 ? '#ffd93b' : '#e63946';
  ctx.fillRect(x + 1, y + 1, (w - 2) * r, 8);
}

export function wrap(s: string, width: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) {
      if (cur) lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

export function paginate(s: string): string[] {
  const lines = wrap(s, 54);
  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += 3) {
    pages.push(lines.slice(i, i + 3).join(' '));
  }
  return pages.length ? pages : [''];
}

export function formatPlaytime(frames: number): string {
  const totalMinutes = Math.floor(frames / (60 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}
