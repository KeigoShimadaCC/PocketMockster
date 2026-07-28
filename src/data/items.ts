export type ItemKind = 'medicine' | 'ball' | 'stone' | 'held' | 'key';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  price: number; // 0 = not sold
  desc: string;
  healAmount?: number; // medicine
  typeBoost?: string; // held: boosts this type 1.2x
}

const list: ItemDef[] = [
  { id: 'potion', name: 'Potion', kind: 'medicine', price: 300, healAmount: 20, desc: 'Restores 20 HP.' },
  { id: 'superpotion', name: 'Super Potion', kind: 'medicine', price: 700, healAmount: 50, desc: 'Restores 50 HP.' },
  { id: 'mockball', name: 'MockBall', kind: 'ball', price: 200, desc: 'Catches wild Mockemon.' },
  { id: 'thunderstone', name: 'Thunder Stone', kind: 'stone', price: 2100, desc: 'Evolves certain Electric Mockemon.' },
  { id: 'waterstone', name: 'Water Stone', kind: 'stone', price: 2100, desc: 'Evolves certain Water Mockemon.' },
  { id: 'moonstone', name: 'Moon Stone', kind: 'stone', price: 2100, desc: 'Evolves certain mysterious Mockemon.' },
  { id: 'oranberry', name: 'Oran Berry', kind: 'held', price: 100, desc: 'Held: auto-restores 10 HP when below half.' },
  { id: 'sitrusberry', name: 'Sitrus Berry', kind: 'held', price: 200, desc: 'Held: auto-restores 25% HP when below half.' },
  { id: 'leftovers', name: 'Leftovers', kind: 'held', price: 1200, desc: 'Held: restores a little HP every turn.' },
  { id: 'powerband', name: 'Power Band', kind: 'held', price: 1500, desc: 'Held: Attack x1.5 but locked into one move.' },
  { id: 'safetysash', name: 'Safety Sash', kind: 'held', price: 1500, desc: 'Held: survive a one-hit KO from full HP once.' },
  { id: 'swiftfeather', name: 'Swift Feather', kind: 'held', price: 1000, desc: 'Held: sometimes strikes first (20%).' },
  { id: 'luckycharm', name: 'Lucky Charm', kind: 'held', price: 1800, desc: 'Held: earns 50% more EXP.' },
  { id: 'embercharm', name: 'Ember Charm', kind: 'held', price: 900, typeBoost: 'Fire', desc: 'Held: Fire moves +20%.' },
  { id: 'tidecharm', name: 'Tide Charm', kind: 'held', price: 900, typeBoost: 'Water', desc: 'Held: Water moves +20%.' },
  { id: 'leafcharm', name: 'Leaf Charm', kind: 'held', price: 900, typeBoost: 'Grass', desc: 'Held: Grass moves +20%.' },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((i) => [i.id, i]));
export const SHOP_STOCK = ['potion', 'superpotion', 'mockball', 'thunderstone', 'waterstone', 'moonstone', 'oranberry', 'sitrusberry'];
