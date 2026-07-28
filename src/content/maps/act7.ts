import type { GameMap } from '../types';
import { mockCenter, mockMart } from './interiors';
import { route7 } from './route7';
import { zephyrheights } from './zephyrheights';
import { gym7 } from './gym7';
import { skybridge } from './skybridge';

export const ACT7_MAPS: Record<string, GameMap> = {
  route7,
  zephyrheights,
  center_zephyrheights: mockCenter('zephyrheights', 'Zephyr Heights', { to: 'zephyrheights', tx: 4, ty: 5 }),
  mart_zephyrheights: mockMart('zephyrheights', 'Zephyr Heights', { to: 'zephyrheights', tx: 12, ty: 5 }),
  gym7,
  skybridge,
};
