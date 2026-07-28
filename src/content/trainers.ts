import { MAPS } from './maps';
import type { NpcTrainer } from './types';

const fromMaps: Record<string, NpcTrainer> = {};
for (const map of Object.values(MAPS)) {
  for (const npc of map.npcs) {
    if (npc.trainer) fromMaps[npc.trainer.id] = npc.trainer;
  }
}

// trainers that only ever appear through scripts (ambushes, villain beats)
export const SCRIPT_TRAINERS: Record<string, NpcTrainer> = {
  grunt_woods_1: {
    id: 'grunt_woods_1',
    name: 'Rollback Grunt',
    spriteKey: 'villager2',
    party: [
      { species: 'buzzler', level: 14 },
      { species: 'thistling', level: 15 },
    ],
    prize: 600,
    introText: 'Grunt: v2.1: Added roadblock to Verdant Woods. Expect resistance!',
    defeatText: 'Grunt: Patch note: challenger defeated roadblock. Filing retreat.',
    sight: 0,
    ai: 'basic',
  },
};

export const TRAINERS: Record<string, NpcTrainer> = { ...fromMaps, ...SCRIPT_TRAINERS };

export function trainerById(id: string): NpcTrainer | undefined {
  return TRAINERS[id];
}
