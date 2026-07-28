import type { GameMap } from '../types';

export const mart: GameMap = {
  id: 'mart',
  name: 'Mock Mart',
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
    { x: 6, y: 6, to: 'verdantcity', tx: 12, ty: 5 },
    { x: 7, y: 6, to: 'verdantcity', tx: 12, ty: 5 },
  ],
  npcs: [
    {
      id: 'clerk',
      x: 5,
      y: 1,
      spriteKey: 'clerk',
      facing: 'down',
      action: 'shop',
      dialogue: [],
    },
  ],
  items: [],
  encounters: [],
  encounterRate: 0,
  signs: [],
  lockedDoors: [],
};
