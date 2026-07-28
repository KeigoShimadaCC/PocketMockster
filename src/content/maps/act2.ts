import type { GameMap } from '../types';
import { mockCenter, mockMart } from './interiors';
import { verdantwoods } from './verdantwoods';
import { thornbury } from './thornbury';
import { gym2 } from './gym2';
import { contest_hall } from './contest_hall';

export const ACT2_MAPS: Record<string, GameMap> = {
  verdantwoods,
  thornbury,
  center_thornbury: mockCenter('thornbury', 'Thornbury', { to: 'thornbury', tx: 4, ty: 5 }),
  mart_thornbury: mockMart('thornbury', 'Thornbury', { to: 'thornbury', tx: 12, ty: 5 }),
  gym2,
  contest_hall,
};
