import type { GameMap } from '../types';
import { mockCenter, mockMart } from './interiors';
import { route6 } from './route6';
import { cinderwake } from './cinderwake';
import { gym6 } from './gym6';
import { lavatube } from './lavatube';

export const ACT6_MAPS: Record<string, GameMap> = {
  route6,
  cinderwake,
  center_cinderwake: mockCenter('cinderwake', 'Cinderwake', { to: 'cinderwake', tx: 4, ty: 5 }),
  mart_cinderwake: mockMart('cinderwake', 'Cinderwake', { to: 'cinderwake', tx: 12, ty: 5 }),
  gym6,
  lavatube,
};
