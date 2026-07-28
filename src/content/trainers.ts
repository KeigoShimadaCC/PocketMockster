import { MAPS } from './maps';
import type { NpcTrainer } from './types';

const fromMaps: Record<string, NpcTrainer> = {};
for (const map of Object.values(MAPS)) {
  for (const npc of map.npcs) {
    if (npc.trainer) fromMaps[npc.trainer.id] = npc.trainer;
  }
}

// trainers that only ever appear through scripts (ambushes, villain beats)
export const SCRIPT_TRAINERS: Record<string, NpcTrainer> = {};

export const TRAINERS: Record<string, NpcTrainer> = { ...fromMaps, ...SCRIPT_TRAINERS };

export function trainerById(id: string): NpcTrainer | undefined {
  return TRAINERS[id];
}
