export interface AbilityDef {
  id: string;
  name: string;
  desc: string;
}

const list: AbilityDef[] = [
  { id: 'verdantforce', name: 'Verdant Force', desc: 'Grass moves gain 50% power when HP is low.' },
  { id: 'cinderheart', name: 'Cinder Heart', desc: 'Fire moves gain 50% power when HP is low.' },
  { id: 'riptide', name: 'Riptide', desc: 'Water moves gain 50% power when HP is low.' },
  { id: 'staticfur', name: 'Static Fur', desc: 'Contact may paralyze the attacker (30%).' },
  { id: 'toxicbarb', name: 'Toxic Barb', desc: 'Contact may poison the attacker (30%).' },
  { id: 'menace', name: 'Menace', desc: 'Lowers the foe\'s Attack when entering battle.' },
  { id: 'musclebound', name: 'Musclebound', desc: 'Doubles Attack.' },
  { id: 'momentum', name: 'Momentum', desc: 'Speed rises at the end of every turn.' },
  { id: 'rocksolid', name: 'Rock Solid', desc: 'Survives a one-hit KO from full HP with 1 HP.' },
  { id: 'airborne', name: 'Airborne', desc: 'Immune to Ground moves and ground hazards.' },
  { id: 'sponge', name: 'Sponge', desc: 'Water moves heal 25% HP instead of damaging.' },
  { id: 'embergut', name: 'Ember Gut', desc: 'Fire moves are absorbed, boosting own Fire moves.' },
  { id: 'adaptive', name: 'Adaptive', desc: 'Same-type attack bonus is doubled.' },
];

export const ABILITIES: Record<string, AbilityDef> = Object.fromEntries(list.map((a) => [a.id, a]));

// Pinch abilities: boost a type by 1.5x when hp <= 1/3
export const PINCH_ABILITIES: Record<string, string> = {
  verdantforce: 'Grass',
  cinderheart: 'Fire',
  riptide: 'Water',
};
