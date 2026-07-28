import type { GameMap } from '../types';

export const museum: GameMap = {
  id: 'museum',
  name: 'Tidewell Museum',
  indoor: true,
  tiles: [
    'wwwwwwwwwwwwww',
    'wFFFFFFFFFFFFw',
    'wFFCCCFFFFFFFw',
    'wFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFw',
    'wFSFFFFFFFSFFw',
    'wFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFw',
    'wFFFFFMMFFFFFw',
    'wwwwwwwwwwwwww',
  ],
  warps: [
    { x: 6, y: 11, to: 'tidewell', tx: 17, ty: 5 },
    { x: 7, y: 11, to: 'tidewell', tx: 17, ty: 5 },
  ],
  npcs: [
    {
      id: 'npc_museum_scientist',
      x: 4,
      y: 1,
      spriteKey: 'professor',
      facing: 'down',
      script: 'fossil_revive',
      dialogue: [],
    },
  ],
  items: [],
  encounters: [],
  encounterRate: 0,
  signs: [
    {
      x: 2,
      y: 5,
      text: 'Exhibit A: Fossil of a prehistoric sea Mockemon. It resembles a giant krabbet.',
    },
    {
      x: 10,
      y: 5,
      text: 'Exhibit B: A revived fossilisk skeleton. It stood three metres tall in life!',
    },
  ],
  lockedDoors: [],
};
