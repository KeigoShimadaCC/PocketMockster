export const MINUTES_PER_DAY = 1440;

export type DayPhase = 'morning' | 'day' | 'evening' | 'night';

function modMinute(minute: number): number {
  return ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

export function phaseFor(minute: number): DayPhase {
  const m = modMinute(minute);
  if (m >= 360 && m < 600) return 'morning';
  if (m >= 600 && m < 1020) return 'day';
  if (m >= 1020 && m < 1200) return 'evening';
  return 'night';
}

export function tintFor(phase: DayPhase): { color: string; alpha: number } {
  if (phase === 'night') return { color: '#1a2a6b', alpha: 0.35 };
  if (phase === 'evening') return { color: '#e8853a', alpha: 0.15 };
  if (phase === 'morning') return { color: '#7fc8f8', alpha: 0.08 };
  return { color: '#000000', alpha: 0 };
}

export function formatTime(minute: number): string {
  const m = modMinute(minute);
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function isNight(phase: DayPhase): boolean {
  return phase === 'night';
}
