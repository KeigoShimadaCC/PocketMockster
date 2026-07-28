import type { GameMap } from '../types';

export const nullpeak_summit: GameMap = {
  id: 'nullpeak_summit', name: 'Null Peak Summit', indoor: false,
  tiles: [
    'TTTTTTTTTTTTTTTTTTTT',
    'T..................T',
    'T..................T',
    'T..................T',
    'T..................T',
    'T.......TTTT.......T',
    'T.......T..T.......T',
    'T.......T..T.......T',
    'T.......T..T.......T',
    'T.......TT.T.......T',
    'T..................T',
    'T..................T',
    'T..................T',
    'T..................T',
    'T..................T',
    'T..................T',
    'T..................T',
    'TTTTTTTTTDTTTTTTTTTT',
  ],
  warps: [
    { x: 9, y: 17, to: 'nullpeak_1f', tx: 9, ty: 1 },
  ],
  npcs: [
    { id: 'director_nil', x: 9, y: 7, spriteKey: 'gymleader', facing: 'down', dialogue: [], trainer: { id: 'director_nil', name: 'Director Nil', spriteKey: 'gymleader', party: [{ species: 'mimew', level: 50 }, { species: 'somnara', level: 50 }, { species: 'oraculum', level: 52 }, { species: 'originon', level: 54 }], prize: 9000, introText: 'Nil: CHANGELOG v0.1: Initial release. This region was perfect then. I will revert it with Originon, the first Mockemon. You cannot stop a rollback.', defeatText: 'Nil: Hotfix... unsuccessful. The rollback failed. Originon is free. Go, challenger. The region is yours.', sight: 0, ai: 'leader', potions: 3 } },
  ],
  items: [],
  encounters: [],
  encounterRate: 0,
  signs: [],
  lockedDoors: [],
  events: [
    { x: 10, y: 10, script: 'nullpeak_confrontation', once: 'nilBeaten' },
    { x: 9, y: 6, script: 'originon_awaken', once: 'origiononAwakened' },
  ],
};
