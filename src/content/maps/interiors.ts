import type { GameMap, Npc } from '../types';

const INTERIOR_TILES = [
  'wwwwwwwwwwww',
  'wFFFFFFFFFFw',
  'wFFFCCCFFFFw',
  'wFFFFFFFFFFw',
  'wFFFFFFFFFFw',
  'wFFFFFFFFFFw',
  'wFFFFFMMFFFw',
  'wwwwwwwwwwww',
];

interface Exit {
  to: string;
  tx: number;
  ty: number;
}

function shell(id: string, name: string, exit: Exit, npcs: Npc[], signs: GameMap['signs'] = []): GameMap {
  return {
    id,
    name,
    indoor: true,
    tiles: [...INTERIOR_TILES],
    warps: [
      { x: 6, y: 6, to: exit.to, tx: exit.tx, ty: exit.ty },
      { x: 7, y: 6, to: exit.to, tx: exit.tx, ty: exit.ty },
    ],
    npcs,
    items: [],
    encounters: [],
    encounterRate: 0,
    signs,
    lockedDoors: [],
  };
}

/** Every settlement gets the same Mock Center; only the id, name and exit change. */
export function mockCenter(town: string, townName: string, exit: Exit, extras: Npc[] = []): GameMap {
  return shell(
    `center_${town}`,
    `${townName} Mock Center`,
    exit,
    [
      {
        id: `nurse_${town}`,
        x: 5,
        y: 1,
        spriteKey: 'nurse',
        facing: 'down',
        script: 'mock_center_nurse',
        dialogue: [],
      },
      ...extras,
    ],
  );
}

export function mockMart(town: string, townName: string, exit: Exit, extras: Npc[] = []): GameMap {
  return shell(
    `mart_${town}`,
    `${townName} Mock Mart`,
    exit,
    [
      {
        id: `clerk_${town}`,
        x: 5,
        y: 1,
        spriteKey: 'clerk',
        facing: 'down',
        action: 'shop',
        dialogue: [],
      },
      ...extras,
    ],
  );
}
