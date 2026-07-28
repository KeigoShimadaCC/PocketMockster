let seed = 0x9e3779b9;

export function setSeed(s: number): void {
  seed = s >>> 0;
  if (seed === 0) seed = 0x9e3779b9;
}

export function rand(): number {
  seed ^= seed << 13;
  seed >>>= 0;
  seed ^= seed >> 17;
  seed ^= seed << 5;
  seed >>>= 0;
  return seed / 0xffffffff;
}

export function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

export function chance(p: number): boolean {
  return rand() < p;
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
