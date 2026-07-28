import type { GameMap } from '../types';

export const observatory: GameMap = {
  id: 'observatory', name: 'Somnium Observatory', indoor: true,
  tiles: [
    'wwwwwwwwwwwwwwww',
    'wFFSFFFFFFFFFFSw',
    'wFFFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFFFw',
    'wFFFFFFFSFFFFFFw',
    'wFFFFFFMMFFFFFFw',
    'wwwwwwwwwwwwwwww',
  ],
  warps: [
    { x: 7, y: 12, to: 'somnium', tx: 17, ty: 5 },
    { x: 8, y: 12, to: 'somnium', tx: 17, ty: 5 },
  ],
  npcs: [
    { id: 'observatory_astronomer', x: 8, y: 3, spriteKey: 'professor', facing: 'down', script: 'observatory_coords', dialogue: [] },
    { id: 'observatory_tech', x: 5, y: 6, spriteKey: 'villager1', facing: 'right', script: 'observatory_ghost', dialogue: [] },
    { id: 'trainer_stargazer_vel', x: 10, y: 8, spriteKey: 'bugcatcher', facing: 'left', dialogue: ['Vel: I chart the night sky. Battle me under the stars!'], trainer: { id: 'trainer_stargazer_vel', name: 'Stargazer Vel', spriteKey: 'bugcatcher', party: [{ species: 'enigmew', level: 46 }, { species: 'psywisp', level: 46 }], prize: 1104, introText: 'Vel: The stars align for our battle!', defeatText: 'Vel: Your light outshone my stars.', sight: 3 } },
  ],
  items: [],
  encounters: [],
  encounterRate: 0,
  signs: [
    { x: 3, y: 1, text: 'SOMNIUM OBSERVATORY - Charts of stars and dreams alike.' },
    { x: 12, y: 1, text: 'TELESCOPE CHAMBER - Visitors welcome during night shifts.' },
    { x: 7, y: 11, text: 'EXIT - Back to Somnium Town.' },
  ],
  lockedDoors: [],
};
