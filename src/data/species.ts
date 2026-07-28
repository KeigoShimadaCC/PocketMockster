import type { MType } from './types';

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface SpeciesDef {
  id: number;
  key: string;
  name: string;
  types: MType[];
  base: BaseStats;
  catchRate: number; // 3-255
  expYield: number;
  learnset: { lv: number; move: string }[];
  evolvesTo?: string;
  evolveLevel?: number;
  dex: string;
}

const list: SpeciesDef[] = [
  {
    id: 1, key: 'sproutle', name: 'Sproutle', types: ['Grass'],
    base: { hp: 45, atk: 49, def: 49, spa: 65, spd: 65, spe: 45 },
    catchRate: 45, expYield: 64,
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 3, move: 'growl' }, { lv: 6, move: 'vinewhip' },
      { lv: 10, move: 'stringshot' }, { lv: 13, move: 'razorleaf' },
    ],
    evolvesTo: 'bramblore', evolveLevel: 15,
    dex: 'A seed sprouts from its head. It photosynthesizes while napping in sunny fields.',
  },
  {
    id: 2, key: 'bramblore', name: 'Bramblore', types: ['Grass'],
    base: { hp: 60, atk: 62, def: 63, spa: 80, spd: 80, spe: 60 },
    catchRate: 45, expYield: 142,
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 1, move: 'growl' }, { lv: 6, move: 'vinewhip' },
      { lv: 13, move: 'razorleaf' }, { lv: 17, move: 'sleeppowder' },
    ],
    dex: 'Its thorny vines can snap a steel fence. It guards forest clearings fiercely.',
  },
  {
    id: 3, key: 'cindercub', name: 'Cindercub', types: ['Fire'],
    base: { hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 },
    catchRate: 45, expYield: 62,
    learnset: [
      { lv: 1, move: 'scratch' }, { lv: 3, move: 'growl' }, { lv: 6, move: 'ember' },
      { lv: 10, move: 'quickattack' }, { lv: 13, move: 'bite' },
    ],
    evolvesTo: 'emberuin', evolveLevel: 15,
    dex: 'A bear cub with a smoldering tail tuft. It hugs warm rocks to sleep at night.',
  },
  {
    id: 4, key: 'emberuin', name: 'Emberuin', types: ['Fire'],
    base: { hp: 58, atk: 64, def: 58, spa: 80, spd: 65, spe: 80 },
    catchRate: 45, expYield: 142,
    learnset: [
      { lv: 1, move: 'scratch' }, { lv: 1, move: 'growl' }, { lv: 6, move: 'ember' },
      { lv: 13, move: 'bite' }, { lv: 17, move: 'flameburst' },
    ],
    dex: 'Embers crown its head like a ruined castle. Its roar sets dry grass alight.',
  },
  {
    id: 5, key: 'puddlefin', name: 'Puddlefin', types: ['Water'],
    base: { hp: 44, atk: 48, def: 65, spa: 50, spd: 64, spe: 43 },
    catchRate: 45, expYield: 63,
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 3, move: 'tailwhip' }, { lv: 6, move: 'watergun' },
      { lv: 10, move: 'harden' }, { lv: 13, move: 'bubblebeam' },
    ],
    evolvesTo: 'torrentle', evolveLevel: 15,
    dex: 'It carries a puddle in its shell everywhere. Splashes shyly when startled.',
  },
  {
    id: 6, key: 'torrentle', name: 'Torrentle', types: ['Water'],
    base: { hp: 59, atk: 63, def: 80, spa: 65, spd: 80, spe: 58 },
    catchRate: 45, expYield: 142,
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 1, move: 'tailwhip' }, { lv: 6, move: 'watergun' },
      { lv: 13, move: 'bubblebeam' }, { lv: 17, move: 'aquajet' },
    ],
    dex: 'Its shell stores a small storm. Tipping it over releases a roaring torrent.',
  },
  {
    id: 7, key: 'nibbit', name: 'Nibbit', types: ['Normal'],
    base: { hp: 30, atk: 56, def: 35, spa: 25, spd: 35, spe: 72 },
    catchRate: 255, expYield: 51,
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 3, move: 'tailwhip' }, { lv: 7, move: 'quickattack' },
      { lv: 11, move: 'bite' },
    ],
    dex: 'A tiny rodent that nibbles everything. Its front teeth never stop growing.',
  },
  {
    id: 8, key: 'fluffowl', name: 'Fluffowl', types: ['Normal', 'Flying'],
    base: { hp: 40, atk: 45, def: 40, spa: 35, spd: 35, spe: 56 },
    catchRate: 255, expYield: 50,
    learnset: [
      { lv: 1, move: 'peck' }, { lv: 3, move: 'growl' }, { lv: 7, move: 'gust' },
      { lv: 12, move: 'wingattack' },
    ],
    dex: 'A ball of downy feathers. It hoots softly to lull its prey to sleep.',
  },
  {
    id: 9, key: 'buzzler', name: 'Buzzler', types: ['Bug'],
    base: { hp: 45, atk: 60, def: 50, spa: 30, spd: 40, spe: 55 },
    catchRate: 190, expYield: 55,
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 4, move: 'stringshot' }, { lv: 8, move: 'bugbite' },
      { lv: 13, move: 'harden' },
    ],
    dex: 'A beetle that buzzes at exactly 440 Hz. Musicians tune their instruments to it.',
  },
  {
    id: 10, key: 'cocoonet', name: 'Cocoonet', types: ['Bug', 'Flying'],
    base: { hp: 55, atk: 45, def: 55, spa: 60, spd: 55, spe: 65 },
    catchRate: 120, expYield: 75,
    learnset: [
      { lv: 1, move: 'gust' }, { lv: 1, move: 'stringshot' }, { lv: 9, move: 'bugbite' },
      { lv: 14, move: 'wingattack' },
    ],
    dex: 'It weaves silk nets between trees to catch drifting pollen and small prey.',
  },
  {
    id: 11, key: 'sparkit', name: 'Sparkit', types: ['Electric'],
    base: { hp: 35, atk: 55, def: 40, spa: 60, spd: 50, spe: 90 },
    catchRate: 190, expYield: 70,
    learnset: [
      { lv: 1, move: 'scratch' }, { lv: 4, move: 'thundershock' }, { lv: 9, move: 'quickattack' },
      { lv: 14, move: 'spark' },
    ],
    dex: 'A kitten whose fur crackles with static. Petting it is a shocking experience.',
  },
  {
    id: 12, key: 'pebblit', name: 'Pebblit', types: ['Rock'],
    base: { hp: 40, atk: 80, def: 100, spa: 30, spd: 30, spe: 20 },
    catchRate: 255, expYield: 60,
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 4, move: 'harden' }, { lv: 8, move: 'rockthrow' },
      { lv: 13, move: 'rocktomb' },
    ],
    evolvesTo: 'bouldron', evolveLevel: 18,
    dex: 'Often mistaken for a roadside stone. It grumbles when stepped on.',
  },
  {
    id: 13, key: 'bouldron', name: 'Bouldron', types: ['Rock', 'Ground'],
    base: { hp: 55, atk: 95, def: 115, spa: 45, spd: 45, spe: 35 },
    catchRate: 120, expYield: 100,
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 1, move: 'harden' }, { lv: 8, move: 'rockthrow' },
      { lv: 13, move: 'rocktomb' }, { lv: 16, move: 'mudslap' }, { lv: 20, move: 'dig' },
    ],
    dex: 'A living boulder that naps for decades. Mountain trails detour around it.',
  },
  {
    id: 14, key: 'mudlet', name: 'Mudlet', types: ['Ground'],
    base: { hp: 50, atk: 60, def: 55, spa: 40, spd: 45, spe: 40 },
    catchRate: 190, expYield: 58,
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 4, move: 'mudslap' }, { lv: 9, move: 'harden' },
      { lv: 14, move: 'dig' },
    ],
    dex: 'A cheerful mudfish that surfaces after rain. It leaves smiley prints in the muck.',
  },
  {
    id: 15, key: 'floazy', name: 'Floazy', types: ['Water', 'Flying'],
    base: { hp: 52, atk: 44, def: 42, spa: 58, spd: 50, spe: 60 },
    catchRate: 190, expYield: 61,
    learnset: [
      { lv: 1, move: 'watergun' }, { lv: 5, move: 'gust' }, { lv: 10, move: 'wingattack' },
      { lv: 15, move: 'bubblebeam' },
    ],
    dex: 'A drowsy duck that floats downstream on its back, snoring bubbles.',
  },
  {
    id: 16, key: 'psywisp', name: 'Psywisp', types: ['Psychic'],
    base: { hp: 40, atk: 30, def: 35, spa: 75, spd: 60, spe: 70 },
    catchRate: 100, expYield: 75,
    learnset: [
      { lv: 1, move: 'confusion' }, { lv: 6, move: 'growl' }, { lv: 12, move: 'thunderwave' },
    ],
    dex: 'A faint wisp said to be a daydream that escaped. It hums forgotten lullabies.',
  },
  {
    id: 17, key: 'thistling', name: 'Thistling', types: ['Grass', 'Bug'],
    base: { hp: 42, atk: 55, def: 48, spa: 45, spd: 48, spe: 50 },
    catchRate: 190, expYield: 57,
    learnset: [
      { lv: 1, move: 'absorb' }, { lv: 5, move: 'stringshot' }, { lv: 9, move: 'razorleaf' },
      { lv: 14, move: 'bugbite' },
    ],
    dex: 'It disguises itself as a thistle. Grazing herds learned to check twice.',
  },
  {
    id: 18, key: 'gustling', name: 'Gustling', types: ['Flying'],
    base: { hp: 38, atk: 50, def: 38, spa: 50, spd: 42, spe: 85 },
    catchRate: 190, expYield: 56,
    learnset: [
      { lv: 1, move: 'gust' }, { lv: 5, move: 'quickattack' }, { lv: 10, move: 'peck' },
      { lv: 15, move: 'wingattack' },
    ],
    dex: 'A pocket of wind given form. It races weather vanes and always wins.',
  },
  {
    id: 19, key: 'zapwing', name: 'Zapwing', types: ['Electric', 'Flying'],
    base: { hp: 45, atk: 48, def: 40, spa: 68, spd: 50, spe: 88 },
    catchRate: 90, expYield: 80,
    learnset: [
      { lv: 1, move: 'peck' }, { lv: 5, move: 'thundershock' }, { lv: 11, move: 'gust' },
      { lv: 16, move: 'spark' },
    ],
    dex: 'It surfs thunderclouds and steals lightning. Its feathers glow before storms.',
  },
  {
    id: 20, key: 'flarat', name: 'Flarat', types: ['Fire'],
    base: { hp: 38, atk: 58, def: 38, spa: 52, spd: 40, spe: 78 },
    catchRate: 190, expYield: 59,
    learnset: [
      { lv: 1, move: 'scratch' }, { lv: 5, move: 'ember' }, { lv: 10, move: 'quickattack' },
      { lv: 15, move: 'firefang' },
    ],
    dex: 'A rat with a matchstick tail. It sneaks into kitchens to warm its paws.',
  },
];

export const SPECIES: Record<string, SpeciesDef> = Object.fromEntries(list.map((s) => [s.key, s]));
export const DEX_ORDER = list.map((s) => s.key);
