import type { MType } from './types';

export type MoveCategory = 'physical' | 'special' | 'status';
export type StatusId = 'PAR' | 'BRN' | 'PSN' | 'SLP';

export interface MoveDef {
  id: string;
  name: string;
  type: MType;
  category: MoveCategory;
  power: number;
  accuracy: number; // 0-100, 999 = never misses
  pp: number;
  priority?: number;
  status?: { id: StatusId; chance: number }; // chance 0-1 applied to target
  statChange?: { stat: 'atk' | 'def' | 'spe'; stages: number; target: 'self' | 'foe'; chance: number };
}

const list: MoveDef[] = [
  { id: 'tackle', name: 'Tackle', type: 'Normal', category: 'physical', power: 40, accuracy: 100, pp: 35 },
  { id: 'scratch', name: 'Scratch', type: 'Normal', category: 'physical', power: 40, accuracy: 100, pp: 35 },
  { id: 'quickattack', name: 'Quick Attack', type: 'Normal', category: 'physical', power: 40, accuracy: 100, pp: 30, priority: 1 },
  { id: 'bite', name: 'Bite', type: 'Normal', category: 'physical', power: 60, accuracy: 100, pp: 25 },
  { id: 'growl', name: 'Growl', type: 'Normal', category: 'status', power: 0, accuracy: 100, pp: 40, statChange: { stat: 'atk', stages: -1, target: 'foe', chance: 1 } },
  { id: 'tailwhip', name: 'Tail Whip', type: 'Normal', category: 'status', power: 0, accuracy: 100, pp: 30, statChange: { stat: 'def', stages: -1, target: 'foe', chance: 1 } },
  { id: 'harden', name: 'Harden', type: 'Normal', category: 'status', power: 0, accuracy: 999, pp: 30, statChange: { stat: 'def', stages: 1, target: 'self', chance: 1 } },
  { id: 'ember', name: 'Ember', type: 'Fire', category: 'special', power: 40, accuracy: 100, pp: 25, status: { id: 'BRN', chance: 0.1 } },
  { id: 'flameburst', name: 'Flame Burst', type: 'Fire', category: 'special', power: 70, accuracy: 100, pp: 15, status: { id: 'BRN', chance: 0.1 } },
  { id: 'firefang', name: 'Fire Fang', type: 'Fire', category: 'physical', power: 65, accuracy: 95, pp: 15, status: { id: 'BRN', chance: 0.1 } },
  { id: 'watergun', name: 'Water Gun', type: 'Water', category: 'special', power: 40, accuracy: 100, pp: 25 },
  { id: 'bubblebeam', name: 'Bubble Beam', type: 'Water', category: 'special', power: 65, accuracy: 100, pp: 20, statChange: { stat: 'spe', stages: -1, target: 'foe', chance: 0.1 } },
  { id: 'aquajet', name: 'Aqua Jet', type: 'Water', category: 'physical', power: 40, accuracy: 100, pp: 20, priority: 1 },
  { id: 'vinewhip', name: 'Vine Whip', type: 'Grass', category: 'physical', power: 45, accuracy: 100, pp: 25 },
  { id: 'razorleaf', name: 'Razor Leaf', type: 'Grass', category: 'physical', power: 55, accuracy: 95, pp: 25 },
  { id: 'sleeppowder', name: 'Sleep Powder', type: 'Grass', category: 'status', power: 0, accuracy: 75, pp: 15, status: { id: 'SLP', chance: 1 } },
  { id: 'absorb', name: 'Absorb', type: 'Grass', category: 'special', power: 40, accuracy: 100, pp: 25 },
  { id: 'thundershock', name: 'Thunder Shock', type: 'Electric', category: 'special', power: 40, accuracy: 100, pp: 30, status: { id: 'PAR', chance: 0.1 } },
  { id: 'spark', name: 'Spark', type: 'Electric', category: 'physical', power: 65, accuracy: 100, pp: 20, status: { id: 'PAR', chance: 0.3 } },
  { id: 'thunderwave', name: 'Thunder Wave', type: 'Electric', category: 'status', power: 0, accuracy: 90, pp: 20, status: { id: 'PAR', chance: 1 } },
  { id: 'rockthrow', name: 'Rock Throw', type: 'Rock', category: 'physical', power: 50, accuracy: 90, pp: 15 },
  { id: 'rocktomb', name: 'Rock Tomb', type: 'Rock', category: 'physical', power: 60, accuracy: 95, pp: 15, statChange: { stat: 'spe', stages: -1, target: 'foe', chance: 1 } },
  { id: 'mudslap', name: 'Mud Slap', type: 'Ground', category: 'special', power: 30, accuracy: 100, pp: 10 },
  { id: 'dig', name: 'Dig', type: 'Ground', category: 'physical', power: 70, accuracy: 100, pp: 10 },
  { id: 'bugbite', name: 'Bug Bite', type: 'Bug', category: 'physical', power: 60, accuracy: 100, pp: 20 },
  { id: 'stringshot', name: 'String Shot', type: 'Bug', category: 'status', power: 0, accuracy: 95, pp: 40, statChange: { stat: 'spe', stages: -1, target: 'foe', chance: 1 } },
  { id: 'gust', name: 'Gust', type: 'Flying', category: 'special', power: 40, accuracy: 100, pp: 35 },
  { id: 'peck', name: 'Peck', type: 'Flying', category: 'physical', power: 35, accuracy: 100, pp: 35 },
  { id: 'wingattack', name: 'Wing Attack', type: 'Flying', category: 'physical', power: 60, accuracy: 100, pp: 35 },
  { id: 'confusion', name: 'Confusion', type: 'Psychic', category: 'special', power: 50, accuracy: 100, pp: 25 },
];

export const MOVES: Record<string, MoveDef> = Object.fromEntries(list.map((m) => [m.id, m]));
