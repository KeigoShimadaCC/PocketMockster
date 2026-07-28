import type { GameMap } from '../types';

export const gym8: GameMap = {
  id: 'gym8', name: 'Somnium Gym', indoor: true,
  tiles: [
    'wwwwwwwwwwwwww',
    'wFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFw',
    'wFFFFFFFFFFFFw',
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
    { x: 6, y: 12, to: 'somnium', tx: 11, ty: 9 },
    { x: 7, y: 12, to: 'somnium', tx: 11, ty: 9 },
  ],
  npcs: [
    { id: 'gymtrainer_dream1', x: 8, y: 10, spriteKey: 'lass', facing: 'left', dialogue: ['Aide: The pads warp you. But which is the right path?'], trainer: { id: 'gymtrainer_dream1', name: 'Dream Aide Lura', spriteKey: 'lass', party: [{ species: 'somnara', level: 47 }, { species: 'psywisp', level: 47 }], prize: 1128, introText: 'Lura: Your mind must be sharp to navigate the pads!', defeatText: 'Lura: You saw through the dream...', sight: 3, ai: 'smart' } },
    { id: 'gymtrainer_dream2', x: 5, y: 7, spriteKey: 'bugcatcher', facing: 'right', dialogue: ['Aide: Close your eyes and feel the right pad.'], trainer: { id: 'gymtrainer_dream2', name: 'Dream Aide Vex', spriteKey: 'bugcatcher', party: [{ species: 'enigmew', level: 48 }, { species: 'mimew', level: 47 }], prize: 1152, introText: 'Vex: The dream resists your interpretation!', defeatText: 'Vex: Your clarity pierced the veil.', sight: 3, ai: 'smart' } },
    { id: 'gymtrainer_dream3', x: 9, y: 5, spriteKey: 'lass', facing: 'down', dialogue: ['Aide: Mira speaks in riddles. The pads speak in space.'], trainer: { id: 'gymtrainer_dream3', name: 'Dream Aide Sol', spriteKey: 'lass', party: [{ species: 'psywisp', level: 48 }, { species: 'somnara', level: 47 }], prize: 1152, introText: 'Sol: The final dream before Mira. Battle!', defeatText: 'Sol: You are ready. Mira awaits beyond the pads.', sight: 2, ai: 'smart' } },
    { id: 'leader_mira', x: 6, y: 2, spriteKey: 'gymleader', facing: 'down', action: 'gymleader', dialogue: [], trainer: { id: 'leader_mira', name: 'Leader Mira', spriteKey: 'gymleader', party: [{ species: 'somnara', level: 47 }, { species: 'enigmew', level: 47 }, { species: 'oraculum', level: 49 }], prize: 6000, introText: 'Mira: I see your future in the dreamscape, challenger. It is bright. But first, you must wake.', defeatText: 'Mira: The dream ends. The Dream Badge is yours. May your waking path lead to Summit Null.', sight: 0, ai: 'leader', potions: 3 } },
  ],
  items: [],
  encounters: [],
  encounterRate: 0,
  signs: [],
  lockedDoors: [],
  pads: [
    { x: 3, y: 9, tx: 3, ty: 4 },
    { x: 10, y: 9, tx: 6, ty: 11 },
    { x: 3, y: 4, tx: 6, ty: 11 },
    { x: 10, y: 4, tx: 6, ty: 3 },
  ],
};
