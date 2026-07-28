import type { GameMap } from '../types';
import { mockCenter, mockMart } from './interiors';
import { route4 } from './route4';
import { voltmere } from './voltmere';
import { gym4 } from './gym4';
import { powerplant_b1 } from './powerplant_b1';
import { powerplant_b2 } from './powerplant_b2';

export const ACT4_MAPS: Record<string, GameMap> = {
  route4,
  voltmere,
  center_voltmere: mockCenter('voltmere', 'Voltmere City', { to: 'voltmere', tx: 4, ty: 5 }),
  mart_voltmere: mockMart('voltmere', 'Voltmere City', { to: 'voltmere', tx: 12, ty: 5 }),
  gym4,
  powerplant_b1,
  powerplant_b2,
};
