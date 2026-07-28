// Campaign difficulty simulator. Replays the story fights with the real battle
// engine and data, using a greedy player policy, and reports win rates.
// Run: npx tsx tools/simulate.ts

import { Battle } from '../src/battle';
import { MOVES } from '../src/data/moves';
import { SPECIES } from '../src/data/species';
import { effectiveness } from '../src/data/types';
import { createMockemon, def, healFull, type Mockemon } from '../src/mockemon';
import { rand, randInt, setSeed } from '../src/rng';
import { MAPS } from '../src/maps';

const STARTERS = ['sproutle', 'cindercub', 'puddlefin'];
const COUNTER: Record<string, string> = {
  sproutle: 'cindercub',
  cindercub: 'puddlefin',
  puddlefin: 'sproutle',
};

function trainerParty(id: string): { species: string; level: number }[] {
  for (const map of Object.values(MAPS)) {
    for (const npc of map.npcs) {
      if (npc.trainer?.id === id) return npc.trainer.party;
    }
  }
  throw new Error('trainer not found: ' + id);
}

function pickPlayerMove(b: Battle): number {
  const active = b.active;
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < active.moves.length; i++) {
    const ms = active.moves[i];
    if (ms.pp <= 0) continue;
    const mv = MOVES[ms.id];
    if (mv.category === 'status') continue;
    let score = mv.power * effectiveness(mv.type, SPECIES[b.enemy.species].types);
    if (def(active).types.includes(mv.type)) score *= 1.5;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  if (best < 0) {
    // no damaging move with PP: use anything with PP
    best = active.moves.findIndex((ms) => ms.pp > 0);
  }
  return best;
}

interface FightResult {
  won: boolean;
  potionsUsed: number;
  turns: number;
}

function runFight(
  party: Mockemon[],
  enemy: Mockemon[],
  isTrainer: boolean,
  potions: { count: number; superPotions?: boolean },
): FightResult {
  const b = new Battle(
    party,
    isTrainer
      ? { kind: 'trainer', trainer: { name: 'Sim', spriteKey: 'hiker', party: enemy, prize: 0, introText: '', defeatText: '' } }
      : { kind: 'wild', mon: enemy[0] },
  );
  let potionsUsed = 0;
  let turns = 0;
  while (!b.outcome && turns < 200) {
    turns++;
    if (b.needsSwitch) {
      const idx = party.findIndex((m) => m.hp > 0);
      if (idx < 0) break;
      b.forcedSwitch(idx, []);
      continue;
    }
    if (potions.count > 0 && b.active.hp > 0 && b.active.hp / b.active.maxHp < 0.4) {
      potions.count--;
      potionsUsed++;
      b.takeTurn({ type: 'item', item: potions.superPotions ? 'superpotion' : 'potion' });
      continue;
    }
    const mv = pickPlayerMove(b);
    if (mv < 0) break; // fully out of PP
    b.takeTurn({ type: 'move', index: mv });
  }
  return { won: b.outcome === 'win', potionsUsed, turns };
}

function sampleWild(): Mockemon {
  const table = MAPS.route1.encounters;
  const total = table.reduce((s, e) => s + e.weight, 0);
  let roll = rand() * total;
  let entry = table[0];
  for (const e of table) {
    roll -= e.weight;
    if (roll <= 0) {
      entry = e;
      break;
    }
  }
  return createMockemon(entry.species, randInt(entry.minLv, entry.maxLv));
}

interface CampaignResult {
  badge: boolean;
  whiteouts: number;
  stuckAt: string | null;
  levelAtTerra: number;
  firstTryLosses: string[];
}

// Whiteouts are soft in the game (heal + respawn), so the campaign only
// "fails" if the same trainer beats you MAX_ATTEMPTS times in a row.
const MAX_ATTEMPTS = 5;

function runCampaign(starter: string, wildFights: number, potionBudget: number): CampaignResult {
  const party = [createMockemon(starter, 5)];
  const potions: { count: number; superPotions?: boolean } = { count: 2 }; // route pickups
  let whiteouts = 0;
  const firstTryLosses: string[] = [];

  const attemptTrainer = (id: string, enemies: () => Mockemon[]): boolean => {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const r = runFight(party, enemies(), true, potions);
      if (r.won) return true;
      whiteouts++;
      if (attempt === 1) firstTryLosses.push(id);
      party.forEach(healFull);
      potions.count = Math.max(potions.count, 2);
    }
    return false;
  };

  // rival: loss is story-tolerated, Maple heals you either way
  const rival = runFight(party, [createMockemon(COUNTER[starter], 5)], true, potions);
  if (!rival.won) {
    whiteouts++;
    firstTryLosses.push('rival');
  }
  party.forEach(healFull);

  // wild grinding on route 1; flee while weak, catch a companion early,
  // backtrack to Prof. Maple's free heal when low
  for (let i = 0; i < wildFights; i++) {
    const lead = party.find((m) => m.hp > 0) ?? party[0];
    if (lead.hp / lead.maxHp < 0.6) party.forEach(healFull);
    if (i === 1 && party.length === 1) {
      party.push(sampleWild()); // simulate a successful catch
      continue;
    }
    const r = runFight(party, [sampleWild()], false, potions);
    if (!r.won) {
      whiteouts++;
      firstTryLosses.push('wild');
      party.forEach(healFull);
    }
  }

  // route trainers; heal up before each and carry a couple potions
  for (const id of ['trainer_ben', 'trainer_mia', 'trainer_cliff']) {
    party.forEach(healFull);
    potions.count = Math.max(potions.count, 2);
    if (!attemptTrainer(id, () => trainerParty(id).map((p) => createMockemon(p.species, p.level)))) {
      return { badge: false, whiteouts, stuckAt: id, levelAtTerra: party[0].level, firstTryLosses };
    }
  }

  // Mock Center heal + prize money buys Super Potions for the gym
  party.forEach(healFull);
  potions.count = potionBudget;
  potions.superPotions = true;

  if (!attemptTrainer('trainer_rocco', () => trainerParty('trainer_rocco').map((p) => createMockemon(p.species, p.level)))) {
    return { badge: false, whiteouts, stuckAt: 'trainer_rocco', levelAtTerra: party[0].level, firstTryLosses };
  }

  party.forEach(healFull);
  potions.count = potionBudget;
  const lvAtTerra = party[0].level;
  if (!attemptTrainer('leader_terra', () => trainerParty('leader_terra').map((p) => createMockemon(p.species, p.level)))) {
    return { badge: false, whiteouts, stuckAt: 'leader_terra', levelAtTerra: lvAtTerra, firstTryLosses };
  }
  return { badge: true, whiteouts, stuckAt: null, levelAtTerra: lvAtTerra, firstTryLosses };
}

const TRIALS = 400;
console.log('=== Pocket Mockster campaign simulation ===');
console.log(`trials per config: ${TRIALS}  (whiteouts are soft; stuck = ${MAX_ATTEMPTS} straight losses to one trainer)\n`);

for (const wildFights of [4, 8, 12]) {
  for (const starter of STARTERS) {
    let badges = 0;
    let whiteoutSum = 0;
    let flawless = 0;
    let terraLvSum = 0;
    const stuck: Record<string, number> = {};
    const ftl: Record<string, number> = {};
    for (let t = 0; t < TRIALS; t++) {
      setSeed((t + 1) * 2654435761 + wildFights * 97 + STARTERS.indexOf(starter));
      const r = runCampaign(starter, wildFights, 4);
      if (r.badge) badges++;
      else stuck[r.stuckAt!] = (stuck[r.stuckAt!] ?? 0) + 1;
      if (r.whiteouts === 0) flawless++;
      whiteoutSum += r.whiteouts;
      terraLvSum += r.levelAtTerra;
      for (const id of r.firstTryLosses) ftl[id] = (ftl[id] ?? 0) + 1;
    }
    const fmt = (o: Record<string, number>): string =>
      Object.entries(o)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}:${((v / TRIALS) * 100).toFixed(0)}%`)
        .join(' ') || '-';
    console.log(
      `wilds=${String(wildFights).padStart(2)} ${starter.padEnd(9)} badge=${((badges / TRIALS) * 100).toFixed(1).padStart(5)}%  flawless=${((flawless / TRIALS) * 100).toFixed(0).padStart(3)}%  avgWhiteouts=${(whiteoutSum / TRIALS).toFixed(2)}  avgLv@Terra=${(terraLvSum / TRIALS).toFixed(1)}`,
    );
    console.log(`          stuck: ${fmt(stuck)}   first-try losses: ${fmt(ftl)}`);
  }
  console.log('');
}
