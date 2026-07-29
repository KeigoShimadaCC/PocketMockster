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
  grunt_vc_1: {
    id: 'grunt_vc_1',
    name: 'Rollback Grunt',
    spriteKey: 'villager2',
    party: [
      { species: 'nibbit', level: 12 },
      { species: 'fluffowl', level: 13 },
    ],
    prize: 520,
    introText: 'Grunt: v1.4: Mock Center now requires Rollback subscription. Pay up!',
    defeatText: 'Grunt: Rollback failed. Subscription cancelled. Retreating!',
    sight: 0,
    ai: 'basic',
  },
  grunt_sc_1: {
    id: 'grunt_sc_1',
    name: 'Rollback Grunt',
    spriteKey: 'villager2',
    party: [
      { species: 'krabbet', level: 18 },
      { species: 'pebblit', level: 19 },
    ],
    prize: 760,
    introText: 'Grunt: v3.1: Dredging operation in progress. No visitors!',
    defeatText: 'Grunt: Equipment damaged. Filing maintenance report.',
    sight: 0,
    ai: 'basic',
  },
  grunt_sc_2: {
    id: 'grunt_sc_2',
    name: 'Rollback Grunt',
    spriteKey: 'villager2',
    party: [
      { species: 'mudlet', level: 20 },
      { species: 'nibblex', level: 21 },
    ],
    prize: 840,
    introText: 'Grunt: v3.2: Fossil extraction behind schedule. You are not helping!',
    defeatText: 'Grunt: Extraction halted. The fossil stays buried... for now.',
    sight: 0,
    ai: 'basic',
  },
  grunt_ledger_1: {
    id: 'grunt_ledger_1',
    name: 'Rollback Agent',
    spriteKey: 'villager2',
    party: [
      { species: 'bloomule', level: 31 },
      { species: 'cactoss', level: 32 },
    ],
    prize: 1240,
    introText: 'Agent: v5.0: Acquiring Ledger index from corrupt official. Step aside!',
    defeatText: 'Agent: Acquisition failed. The index remains with the people.',
    sight: 0,
    ai: 'smart',
  },
  rival_kai_1: {
    id: 'rival_kai_1',
    name: 'Rival Kai',
    spriteKey: 'rival',
    party: [
      { species: 'fluffowl', level: 10 },
      { species: 'buzzler', level: 11 },
    ],
    prize: 440,
    introText: 'KAI: Hey, you got a badge already? Not bad! But do not get cocky. Battle me!',
    defeatText: 'KAI: Okay, okay! You are tougher than you look. See you around!',
    sight: 0,
    ai: 'smart',
  },
  rival_kai_2: {
    id: 'rival_kai_2',
    name: 'Rival Kai',
    spriteKey: 'rival',
    party: [
      { species: 'cocoonet', level: 20 },
      { species: 'driftail', level: 21 },
      { species: 'gustling', level: 22 },
    ],
    prize: 880,
    introText: 'KAI: Three badges? I have three too! Let us see whose team grew stronger!',
    defeatText: 'KAI: You are pulling ahead! I need to train harder. Next time!',
    sight: 0,
    ai: 'smart',
  },
  rival_kai_4: {
    id: 'rival_kai_4',
    name: 'Rival Kai',
    spriteKey: 'rival',
    party: [
      { species: 'skywyrm', level: 42 },
      { species: 'voltkat', level: 43 },
      { species: 'cindrake', level: 44 },
    ],
    prize: 1760,
    introText: 'KAI: Seven badges, same as me. The league is close. But first, let me test you!',
    defeatText: 'KAI: You are ready. The Victory Trail and Summit Null await. Do not lose before I get there!',
    sight: 0,
    ai: 'smart',
  },
};

export const TRAINERS: Record<string, NpcTrainer> = { ...fromMaps, ...SCRIPT_TRAINERS };

export function trainerById(id: string): NpcTrainer | undefined {
  return TRAINERS[id];
}
