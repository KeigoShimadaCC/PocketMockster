import type { GameMap } from '../types';
import { center } from './center';
import { gym } from './gym';
import { lab } from './lab';
import { mapletown } from './mapletown';
import { mart } from './mart';
import { route1 } from './route1';
import { verdantcity } from './verdantcity';
import { ACT2_MAPS } from './act2';
import { ACT3_MAPS } from './act3';
import { ACT4_MAPS } from './act4';
import { ACT5_MAPS } from './act5';
import { ACT6_MAPS } from './act6';
import { ACT7_MAPS } from './act7';
import { ACT8_MAPS } from './act8';
import { ACT9_MAPS } from './act9';
import { ACT10_MAPS } from './act10';

export const MAPS: Record<string, GameMap> = {
  mapletown,
  lab,
  route1,
  verdantcity,
  center,
  mart,
  gym,
  ...ACT2_MAPS,
  ...ACT3_MAPS,
  ...ACT4_MAPS,
  ...ACT5_MAPS,
  ...ACT6_MAPS,
  ...ACT7_MAPS,
  ...ACT8_MAPS,
  ...ACT9_MAPS,
  ...ACT10_MAPS,
};
