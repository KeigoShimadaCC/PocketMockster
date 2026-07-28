import type { GameMap } from '../types';
import { mockCenter, mockMart } from './interiors';
import { route3 } from './route3';
import { seasidecave } from './seasidecave';
import { tidewell } from './tidewell';
import { gym3 } from './gym3';
import { museum } from './museum';
import { lighthouse } from './lighthouse';

export const ACT3_MAPS: Record<string, GameMap> = {
  route3,
  seasidecave,
  tidewell,
  center_tidewell: mockCenter('tidewell', 'Tidewell Town', { to: 'tidewell', tx: 4, ty: 5 }),
  mart_tidewell: mockMart('tidewell', 'Tidewell Town', { to: 'tidewell', tx: 12, ty: 5 }),
  gym3,
  museum,
  lighthouse,
};
