// Verbose single-fight trace. Run: npx tsx tools/debugfight.ts
import { Battle } from '../src/battle';
import { MOVES } from '../src/data/moves';
import { SPECIES } from '../src/data/species';
import { effectiveness } from '../src/data/types';
import { createMockemon, def } from '../src/mockemon';
import { setSeed } from '../src/rng';

setSeed(999);

const player = [createMockemon('cindercub', 11)];
const enemy = [createMockemon('pebblit', 9), createMockemon('bouldron', 11)];
console.log('player:', JSON.stringify({ ...player[0], ivs: undefined }));
console.log('pebblit:', JSON.stringify({ ...enemy[0], ivs: undefined }));
console.log('bouldron:', JSON.stringify({ ...enemy[1], ivs: undefined }));

const b = new Battle(player, {
  kind: 'trainer',
  trainer: { name: 'Terra', spriteKey: 'gymleader', party: enemy, prize: 0, introText: '', defeatText: '' },
});

let potions = 4;

function pickMove(): number {
  let best = -1;
  let bestScore = -Infinity;
  b.active.moves.forEach((ms, i) => {
    if (ms.pp <= 0) return;
    const mv = MOVES[ms.id];
    if (mv.category === 'status') return;
    let score = mv.power * effectiveness(mv.type, SPECIES[b.enemy.species].types);
    if (def(b.active).types.includes(mv.type)) score *= 1.5;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best < 0 ? b.active.moves.findIndex((ms) => ms.pp > 0) : best;
}

for (let turn = 1; turn <= 60 && !b.outcome; turn++) {
  if (b.needsSwitch) break;
  let msgs: string[];
  if (potions > 0 && b.active.hp / b.active.maxHp < 0.4) {
    potions--;
    msgs = b.takeTurn({ type: 'item', item: 'potion' });
  } else {
    msgs = b.takeTurn({ type: 'move', index: pickMove() });
  }
  console.log(
    `T${turn} [me ${b.active.nickname} ${b.active.hp}/${b.active.maxHp} | foe ${b.enemy.nickname} ${b.enemy.hp}/${b.enemy.maxHp}] potions=${potions}`,
  );
  for (const m of msgs) console.log('   ', m);
}
console.log('outcome:', b.outcome);
