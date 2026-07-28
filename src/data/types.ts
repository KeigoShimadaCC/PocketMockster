export type MType =
  | 'Normal'
  | 'Fire'
  | 'Water'
  | 'Grass'
  | 'Electric'
  | 'Rock'
  | 'Ground'
  | 'Bug'
  | 'Flying'
  | 'Psychic';

// chart[attacker][defender] = multiplier (1 if absent)
const chart: Partial<Record<MType, Partial<Record<MType, number>>>> = {
  Normal: { Rock: 0.5 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Rock: 0.5, Bug: 2 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Rock: 2, Ground: 2 },
  Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Rock: 2, Ground: 2, Bug: 0.5, Flying: 0.5 },
  Electric: { Water: 2, Grass: 0.5, Electric: 0.5, Ground: 0, Flying: 2 },
  Rock: { Fire: 2, Bug: 2, Flying: 2, Ground: 0.5 },
  Ground: { Fire: 2, Electric: 2, Grass: 0.5, Rock: 2, Bug: 0.5, Flying: 0 },
  Bug: { Grass: 2, Psychic: 2, Fire: 0.5, Flying: 0.5, Rock: 0.5 },
  Flying: { Grass: 2, Bug: 2, Electric: 0.5, Rock: 0.5 },
  Psychic: { Psychic: 0.5 },
};

export function effectiveness(attack: MType, defenderTypes: MType[]): number {
  let mult = 1;
  for (const d of defenderTypes) {
    mult *= chart[attack]?.[d] ?? 1;
  }
  return mult;
}

export const TYPE_COLORS: Record<MType, string> = {
  Normal: '#a8a878',
  Fire: '#f08030',
  Water: '#6890f0',
  Grass: '#78c850',
  Electric: '#f8d030',
  Rock: '#b8a038',
  Ground: '#e0c068',
  Bug: '#a8b820',
  Flying: '#a890f0',
  Psychic: '#f85888',
};
