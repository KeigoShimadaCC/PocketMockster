import type { GameMap } from '../types';

export const center: GameMap = {
  id: 'center',
  name: 'Mock Center',
  indoor: true,
  tiles: [
    'wwwwwwwwwwww',
    'wFFFFFFFFFFw',
    'wFFFCCCFFFFw',
    'wFFFFFFFFFFw',
    'wFFFFFFFFFFw',
    'wFFFFFFFFFFw',
    'wFFFFFMMFFFw',
    'wwwwwwwwwwww',
  ],
  warps: [
    { x: 6, y: 6, to: 'verdantcity', tx: 4, ty: 5 },
    { x: 7, y: 6, to: 'verdantcity', tx: 4, ty: 5 },
  ],
  npcs: [
    {
      id: 'nurse',
      x: 5,
      y: 1,
      spriteKey: 'nurse',
      facing: 'down',
      script: 'mock_center_nurse',
      dialogue: [],
    },
  ],
  items: [],
  encounters: [],
  encounterRate: 0,
  signs: [],
  lockedDoors: [],
};
