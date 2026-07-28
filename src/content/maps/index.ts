import type { GameMap } from '../types';
import { center } from './center';
import { gym } from './gym';
import { lab } from './lab';
import { mapletown } from './mapletown';
import { mart } from './mart';
import { route1 } from './route1';
import { verdantcity } from './verdantcity';

export const MAPS: Record<string, GameMap> = {
  mapletown,
  lab,
  route1,
  verdantcity,
  center,
  mart,
  gym,
};
