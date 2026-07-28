export type Key = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start';

const held = new Set<Key>();
const pressQueue: Key[] = [];

const KEYMAP: Record<string, Key> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  z: 'a',
  Enter: 'a',
  ' ': 'a',
  x: 'b',
  Escape: 'b',
  Backspace: 'b',
  m: 'start',
  Shift: 'start',
};

export function initInput(): void {
  window.addEventListener('keydown', (e) => {
    const k = KEYMAP[e.key];
    if (!k) return;
    e.preventDefault();
    if (!held.has(k)) pressQueue.push(k);
    held.add(k);
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.key];
    if (!k) return;
    held.delete(k);
  });
}

export function isHeld(k: Key): boolean {
  return held.has(k);
}

export function consumePress(): Key | null {
  return pressQueue.shift() ?? null;
}

export function virtualPress(k: Key): void {
  pressQueue.push(k);
}

export function virtualHold(k: Key, on: boolean): void {
  if (on) held.add(k);
  else held.delete(k);
}

export function clearInput(): void {
  pressQueue.length = 0;
  held.clear();
}
