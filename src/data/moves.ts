import type { MType } from './types';

export type MoveCategory = 'physical' | 'special' | 'status';
export type StatusId = 'PAR' | 'BRN' | 'PSN' | 'TOX' | 'SLP' | 'FRZ';
export type StageStat = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'acc' | 'eva';
export type WeatherId = 'sun' | 'rain' | 'sand';
export type TerrainId = 'electric' | 'grassy';
export type ScreenId = 'reflect' | 'lightscreen';
export type HazardId = 'spikes' | 'stealthrock';

export interface MoveDef {
  id: string;
  name: string;
  type: MType;
  category: MoveCategory;
  power: number;
  accuracy: number; // 0-100, 999 = never misses
  pp: number;
  priority?: number;
  typeless?: boolean; // ignores type chart (struggle)
  contact?: boolean; // overrides default (physical = contact)
  status?: { id: StatusId; chance: number }; // applied to target
  statChange?: { stat: StageStat; stages: number; target: 'self' | 'foe'; chance: number };
  drain?: number; // fraction of damage dealt, healed to user
  recoil?: number; // fraction of damage dealt, dealt to user
  recoilMaxHp?: number; // fraction of user's max HP (struggle)
  multiHit?: { min: number; max: number };
  twoTurn?: { chargeText: string; invulnerable: boolean };
  weather?: WeatherId;
  terrain?: TerrainId;
  screen?: ScreenId;
  hazard?: HazardId;
  confuseChance?: number;
  leechSeed?: boolean;
  flinchChance?: number;
  healSelf?: number; // fraction of max HP
}

const list: MoveDef[] = [
  { id: 'tackle', name: 'Tackle', type: 'Normal', category: 'physical', power: 40, accuracy: 100, pp: 35 },
  { id: 'scratch', name: 'Scratch', type: 'Normal', category: 'physical', power: 40, accuracy: 100, pp: 35 },
  { id: 'quickattack', name: 'Quick Attack', type: 'Normal', category: 'physical', power: 40, accuracy: 100, pp: 30, priority: 1 },
  { id: 'bite', name: 'Bite', type: 'Normal', category: 'physical', power: 60, accuracy: 100, pp: 25, flinchChance: 0.3 },
  { id: 'takedown', name: 'Take Down', type: 'Normal', category: 'physical', power: 90, accuracy: 85, pp: 20, recoil: 0.25 },
  { id: 'furyswipes', name: 'Fury Swipes', type: 'Normal', category: 'physical', power: 18, accuracy: 80, pp: 15, multiHit: { min: 2, max: 5 } },
  { id: 'furyattack', name: 'Fury Attack', type: 'Normal', category: 'physical', power: 15, accuracy: 85, pp: 20, multiHit: { min: 2, max: 5 } },
  { id: 'growl', name: 'Growl', type: 'Normal', category: 'status', power: 0, accuracy: 100, pp: 40, statChange: { stat: 'atk', stages: -1, target: 'foe', chance: 1 } },
  { id: 'tailwhip', name: 'Tail Whip', type: 'Normal', category: 'status', power: 0, accuracy: 100, pp: 30, statChange: { stat: 'def', stages: -1, target: 'foe', chance: 1 } },
  { id: 'harden', name: 'Harden', type: 'Normal', category: 'status', power: 0, accuracy: 999, pp: 30, statChange: { stat: 'def', stages: 1, target: 'self', chance: 1 } },
  { id: 'doubleteam', name: 'Double Team', type: 'Normal', category: 'status', power: 0, accuracy: 999, pp: 15, statChange: { stat: 'eva', stages: 1, target: 'self', chance: 1 } },
  { id: 'struggle', name: 'Struggle', type: 'Normal', category: 'physical', power: 50, accuracy: 999, pp: 1, typeless: true, recoilMaxHp: 0.25 },
  { id: 'ember', name: 'Ember', type: 'Fire', category: 'special', power: 40, accuracy: 100, pp: 25, status: { id: 'BRN', chance: 0.1 } },
  { id: 'flameburst', name: 'Flame Burst', type: 'Fire', category: 'special', power: 70, accuracy: 100, pp: 15, status: { id: 'BRN', chance: 0.1 } },
  { id: 'firefang', name: 'Fire Fang', type: 'Fire', category: 'physical', power: 65, accuracy: 95, pp: 15, status: { id: 'BRN', chance: 0.1 }, flinchChance: 0.1 },
  { id: 'sunnyday', name: 'Sunny Day', type: 'Fire', category: 'status', power: 0, accuracy: 999, pp: 5, weather: 'sun' },
  { id: 'watergun', name: 'Water Gun', type: 'Water', category: 'special', power: 40, accuracy: 100, pp: 25 },
  { id: 'bubblebeam', name: 'Bubble Beam', type: 'Water', category: 'special', power: 65, accuracy: 100, pp: 20, statChange: { stat: 'spe', stages: -1, target: 'foe', chance: 0.1 } },
  { id: 'aquajet', name: 'Aqua Jet', type: 'Water', category: 'physical', power: 40, accuracy: 100, pp: 20, priority: 1 },
  { id: 'coldsnap', name: 'Cold Snap', type: 'Water', category: 'special', power: 40, accuracy: 100, pp: 25, status: { id: 'FRZ', chance: 0.1 } },
  { id: 'raindance', name: 'Rain Dance', type: 'Water', category: 'status', power: 0, accuracy: 999, pp: 5, weather: 'rain' },
  { id: 'vinewhip', name: 'Vine Whip', type: 'Grass', category: 'physical', power: 45, accuracy: 100, pp: 25 },
  { id: 'razorleaf', name: 'Razor Leaf', type: 'Grass', category: 'physical', power: 55, accuracy: 95, pp: 25 },
  { id: 'sleeppowder', name: 'Sleep Powder', type: 'Grass', category: 'status', power: 0, accuracy: 75, pp: 15, status: { id: 'SLP', chance: 1 } },
  { id: 'absorb', name: 'Absorb', type: 'Grass', category: 'special', power: 40, accuracy: 100, pp: 25, drain: 0.5, contact: false },
  { id: 'megadrain', name: 'Mega Drain', type: 'Grass', category: 'special', power: 60, accuracy: 100, pp: 15, drain: 0.5, contact: false },
  { id: 'leechseed', name: 'Leech Seed', type: 'Grass', category: 'status', power: 0, accuracy: 90, pp: 10, leechSeed: true },
  { id: 'grassyterrain', name: 'Grassy Terrain', type: 'Grass', category: 'status', power: 0, accuracy: 999, pp: 10, terrain: 'grassy' },
  { id: 'thundershock', name: 'Thunder Shock', type: 'Electric', category: 'special', power: 40, accuracy: 100, pp: 30, status: { id: 'PAR', chance: 0.1 } },
  { id: 'spark', name: 'Spark', type: 'Electric', category: 'physical', power: 65, accuracy: 100, pp: 20, status: { id: 'PAR', chance: 0.3 } },
  { id: 'thunderwave', name: 'Thunder Wave', type: 'Electric', category: 'status', power: 0, accuracy: 90, pp: 20, status: { id: 'PAR', chance: 1 } },
  { id: 'electricterrain', name: 'Electric Terrain', type: 'Electric', category: 'status', power: 0, accuracy: 999, pp: 10, terrain: 'electric' },
  { id: 'rockthrow', name: 'Rock Throw', type: 'Rock', category: 'physical', power: 50, accuracy: 90, pp: 15, contact: false },
  { id: 'rocktomb', name: 'Rock Tomb', type: 'Rock', category: 'physical', power: 60, accuracy: 95, pp: 15, statChange: { stat: 'spe', stages: -1, target: 'foe', chance: 1 }, contact: false },
  { id: 'sandstorm', name: 'Sandstorm', type: 'Rock', category: 'status', power: 0, accuracy: 999, pp: 10, weather: 'sand' },
  { id: 'stealthrock', name: 'Stealth Rock', type: 'Rock', category: 'status', power: 0, accuracy: 999, pp: 20, hazard: 'stealthrock' },
  { id: 'mudslap', name: 'Mud Slap', type: 'Ground', category: 'special', power: 30, accuracy: 100, pp: 10, statChange: { stat: 'acc', stages: -1, target: 'foe', chance: 1 }, contact: false },
  { id: 'sandattack', name: 'Sand Attack', type: 'Ground', category: 'status', power: 0, accuracy: 100, pp: 15, statChange: { stat: 'acc', stages: -1, target: 'foe', chance: 1 } },
  { id: 'dig', name: 'Dig', type: 'Ground', category: 'physical', power: 70, accuracy: 100, pp: 10, twoTurn: { chargeText: 'burrowed underground!', invulnerable: true } },
  { id: 'spikes', name: 'Spikes', type: 'Ground', category: 'status', power: 0, accuracy: 999, pp: 20, hazard: 'spikes' },
  { id: 'bugbite', name: 'Bug Bite', type: 'Bug', category: 'physical', power: 60, accuracy: 100, pp: 20 },
  { id: 'stringshot', name: 'String Shot', type: 'Bug', category: 'status', power: 0, accuracy: 95, pp: 40, statChange: { stat: 'spe', stages: -1, target: 'foe', chance: 1 } },
  { id: 'toxic', name: 'Toxic', type: 'Bug', category: 'status', power: 0, accuracy: 90, pp: 10, status: { id: 'TOX', chance: 1 } },
  { id: 'gust', name: 'Gust', type: 'Flying', category: 'special', power: 40, accuracy: 100, pp: 35 },
  { id: 'peck', name: 'Peck', type: 'Flying', category: 'physical', power: 35, accuracy: 100, pp: 35 },
  { id: 'wingattack', name: 'Wing Attack', type: 'Flying', category: 'physical', power: 60, accuracy: 100, pp: 35 },
  { id: 'fly', name: 'Fly', type: 'Flying', category: 'physical', power: 70, accuracy: 95, pp: 15, twoTurn: { chargeText: 'flew up high!', invulnerable: true } },
  { id: 'confusion', name: 'Confusion', type: 'Psychic', category: 'special', power: 50, accuracy: 100, pp: 25, contact: false },
  { id: 'confuseray', name: 'Confuse Ray', type: 'Psychic', category: 'status', power: 0, accuracy: 100, pp: 10, confuseChance: 1 },
  { id: 'reflect', name: 'Reflect', type: 'Psychic', category: 'status', power: 0, accuracy: 999, pp: 20, screen: 'reflect' },
  { id: 'lightscreen', name: 'Light Screen', type: 'Psychic', category: 'status', power: 0, accuracy: 999, pp: 30, screen: 'lightscreen' },
  { id: 'mend', name: 'Mend', type: 'Psychic', category: 'status', power: 0, accuracy: 999, pp: 10, healSelf: 0.5 },
];

export const MOVES: Record<string, MoveDef> = Object.fromEntries(list.map((m) => [m.id, m]));

export function isContact(move: MoveDef): boolean {
  if (move.contact !== undefined) return move.contact;
  return move.category === 'physical';
}
