import type { GameMap } from '../types';
import { mockCenter, mockMart } from './interiors';
import { route8 } from './route8';
import { somnium } from './somnium';
import { gym8 } from './gym8';
import { observatory } from './observatory';

export const ACT8_MAPS: Record<string, GameMap> = {
  route8,
  somnium,
  center_somnium: mockCenter('somnium', 'Somnium Town', { to: 'somnium', tx: 4, ty: 5 }),
  mart_somnium: mockMart('somnium', 'Somnium Town', { to: 'somnium', tx: 12, ty: 5 }),
  gym8,
  observatory,
};
