import type { GameMap } from '../types';

export const contest_hall: GameMap = {
  id: 'contest_hall',
  name: 'Contest Hall',
  indoor: true,
  tiles: [
    'wwwwwwwwwwwwww',
    'wFFFFFFFFFFFFw',
    'wFFCCCFFFFFFFw',
    'wFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFw',
    'wFFFFFMMFFFFFw',
    'wwwwwwwwwwwwww',
  ],
  warps: [
    { x: 6, y: 11, to: 'thornbury', tx: 17, ty: 5 },
    { x: 7, y: 11, to: 'thornbury', tx: 17, ty: 5 },
  ],
  npcs: [
    {
      id: 'npc_contest_judge',
      x: 4,
      y: 1,
      spriteKey: 'professor',
      facing: 'down',
      script: 'contest_signup',
      dialogue: [],
    },
    {
      id: 'contest_npc1',
      x: 10,
      y: 4,
      spriteKey: 'bugcatcher',
      facing: 'left',
      dialogue: [
        'The Bug Catching Contest is simple: catch bugs in a time limit.',
        'Whoever keeps the best one wins a prize!',
      ],
    },
    {
      id: 'contest_npc2',
      x: 2,
      y: 7,
      spriteKey: 'lass',
      facing: 'right',
      dialogue: [
        'I won last week with a silkette! Its silk pattern was gorgeous.',
      ],
    },
  ],
  items: [],
  encounters: [],
  encounterRate: 0,
  signs: [],
  lockedDoors: [],
};
