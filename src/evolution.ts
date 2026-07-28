import type { Mockemon } from './mockemon';
import { def } from './mockemon';

type EvolutionTrigger = { kind: 'level' } | { kind: 'stone'; stone: string } | { kind: 'trade' };

export function checkEvolution(m: Mockemon, trigger: EvolutionTrigger): string | null {
  const evo = def(m).evolution;
  if (!evo) return null;

  if (trigger.kind === 'level') {
    if (evo.method === 'level' && m.level >= (evo.level ?? 0)) return evo.to;
    if (evo.method === 'friendship' && m.friendship >= (evo.min ?? 160)) return evo.to;
    return null;
  }

  if (trigger.kind === 'stone') {
    if (evo.method === 'stone' && evo.stone === trigger.stone) return evo.to;
    return null;
  }

  if (evo.method === 'trade') return evo.to;
  return null;
}
