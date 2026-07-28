import type { GameMap } from '../types';
import { mockCenter, mockMart } from './interiors';
import { route5 } from './route5';
import { bloomrest } from './bloomrest';
import { gym5 } from './gym5';
import { greenhouse } from './greenhouse';

export const ACT5_MAPS: Record<string, GameMap> = {
  route5,
  bloomrest,
  center_bloomrest: mockCenter('bloomrest', 'Bloomrest', { to: 'bloomrest', tx: 4, ty: 5 }),
  mart_bloomrest: mockMart('bloomrest', 'Bloomrest', { to: 'bloomrest', tx: 12, ty: 5 }),
  gym5,
  greenhouse,
};
