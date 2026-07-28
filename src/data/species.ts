import type { MType } from './types';
import type { StatBlock } from '../mockemon';

export type GrowthRate = 'fast' | 'mediumfast' | 'mediumslow' | 'slow' | 'erratic' | 'fluctuating';

export interface EvolutionDef {
  to: string;
  method: 'level' | 'stone' | 'trade' | 'friendship';
  level?: number;
  stone?: string;
  min?: number;
}

export interface SpeciesDef {
  id: number;
  key: string;
  name: string;
  types: MType[];
  base: StatBlock;
  catchRate: number; // 3-255
  expYield: number;
  growth: GrowthRate;
  genderRatio: number | null; // P(female); null = genderless
  eggGroups: string[];
  eggMoves: string[];
  abilities: string[];
  evYield: Partial<StatBlock>;
  baseFriendship?: number;
  learnset: { lv: number; move: string }[];
  evolution?: EvolutionDef;
  dex: string;
}

const list: SpeciesDef[] = [
  {
    id: 1, key: 'sproutle', name: 'Sproutle', types: ['Grass'],
    base: { hp: 45, atk: 49, def: 49, spa: 65, spd: 65, spe: 45 },
    catchRate: 45, expYield: 64, growth: 'mediumfast', genderRatio: 0.5,
    eggGroups: ['Grass', 'Monster'], eggMoves: ['leechseed'],
    abilities: ['verdantforce'], evYield: { spa: 1 },
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 3, move: 'growl' }, { lv: 6, move: 'vinewhip' },
      { lv: 9, move: 'stringshot' }, { lv: 11, move: 'razorleaf' },
    ],
    evolution: { to: 'bramblore', method: 'level', level: 15 },
    dex: 'A seed sprouts from its head. It photosynthesizes while napping in sunny fields.',
  },
  {
    id: 2, key: 'bramblore', name: 'Bramblore', types: ['Grass'],
    base: { hp: 60, atk: 62, def: 63, spa: 80, spd: 80, spe: 60 },
    catchRate: 45, expYield: 142, growth: 'mediumfast', genderRatio: 0.5,
    eggGroups: ['Grass', 'Monster'], eggMoves: ['leechseed'],
    abilities: ['verdantforce'], evYield: { spa: 2 },
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 1, move: 'growl' }, { lv: 6, move: 'vinewhip' },
      { lv: 13, move: 'razorleaf' }, { lv: 17, move: 'sleeppowder' }, { lv: 19, move: 'leechseed' },
      { lv: 21, move: 'megadrain' }, { lv: 24, move: 'grassyterrain' },
    ],
    dex: 'Its thorny vines can snap a steel fence. It guards forest clearings fiercely.',
  },
  {
    id: 3, key: 'cindercub', name: 'Cindercub', types: ['Fire'],
    base: { hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 },
    catchRate: 45, expYield: 62, growth: 'mediumfast', genderRatio: 0.5,
    eggGroups: ['Field'], eggMoves: ['firefang'],
    abilities: ['cinderheart'], evYield: { spe: 1 },
    learnset: [
      { lv: 1, move: 'scratch' }, { lv: 3, move: 'growl' }, { lv: 6, move: 'ember' },
      { lv: 8, move: 'quickattack' }, { lv: 9, move: 'dig' }, { lv: 13, move: 'bite' },
    ],
    evolution: { to: 'emberuin', method: 'level', level: 15 },
    dex: 'A bear cub with a smoldering tail tuft. It hugs warm rocks to sleep at night.',
  },
  {
    id: 4, key: 'emberuin', name: 'Emberuin', types: ['Fire'],
    base: { hp: 58, atk: 64, def: 58, spa: 80, spd: 65, spe: 80 },
    catchRate: 45, expYield: 142, growth: 'mediumfast', genderRatio: 0.5,
    eggGroups: ['Field'], eggMoves: ['firefang'],
    abilities: ['cinderheart'], evYield: { spa: 2 },
    learnset: [
      { lv: 1, move: 'scratch' }, { lv: 1, move: 'growl' }, { lv: 6, move: 'ember' },
      { lv: 13, move: 'bite' }, { lv: 17, move: 'flameburst' }, { lv: 20, move: 'takedown' },
      { lv: 24, move: 'sunnyday' },
    ],
    dex: 'Embers crown its head like a ruined castle. Its roar sets dry grass alight.',
  },
  {
    id: 5, key: 'puddlefin', name: 'Puddlefin', types: ['Water'],
    base: { hp: 44, atk: 48, def: 65, spa: 50, spd: 64, spe: 43 },
    catchRate: 45, expYield: 63, growth: 'mediumfast', genderRatio: 0.5,
    eggGroups: ['Water1', 'Monster'], eggMoves: ['coldsnap'],
    abilities: ['riptide'], evYield: { def: 1 },
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 3, move: 'tailwhip' }, { lv: 6, move: 'watergun' },
      { lv: 9, move: 'harden' }, { lv: 10, move: 'bite' }, { lv: 12, move: 'bubblebeam' },
    ],
    evolution: { to: 'torrentle', method: 'level', level: 15 },
    dex: 'It carries a puddle in its shell everywhere. Splashes shyly when startled.',
  },
  {
    id: 6, key: 'torrentle', name: 'Torrentle', types: ['Water'],
    base: { hp: 59, atk: 63, def: 80, spa: 65, spd: 80, spe: 58 },
    catchRate: 45, expYield: 142, growth: 'mediumfast', genderRatio: 0.5,
    eggGroups: ['Water1', 'Monster'], eggMoves: ['coldsnap'],
    abilities: ['riptide'], evYield: { def: 2 },
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 1, move: 'tailwhip' }, { lv: 6, move: 'watergun' },
      { lv: 13, move: 'bubblebeam' }, { lv: 17, move: 'aquajet' }, { lv: 21, move: 'raindance' },
    ],
    dex: 'Its shell stores a small storm. Tipping it over releases a roaring torrent.',
  },
  {
    id: 7, key: 'nibbit', name: 'Nibbit', types: ['Normal'],
    base: { hp: 30, atk: 56, def: 35, spa: 25, spd: 35, spe: 72 },
    catchRate: 255, expYield: 51, growth: 'fast', genderRatio: 0.5,
    eggGroups: ['Field'], eggMoves: ['furyswipes'],
    abilities: ['momentum'], evYield: { spe: 1 },
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 3, move: 'tailwhip' }, { lv: 7, move: 'quickattack' },
      { lv: 11, move: 'bite' }, { lv: 14, move: 'doubleteam' },
    ],
    evolution: { to: 'nibblex', method: 'friendship', min: 160 },
    dex: 'A tiny rodent that nibbles everything. Its front teeth never stop growing.',
  },
  {
    id: 8, key: 'fluffowl', name: 'Fluffowl', types: ['Normal', 'Flying'],
    base: { hp: 40, atk: 45, def: 40, spa: 35, spd: 35, spe: 56 },
    catchRate: 255, expYield: 50, growth: 'mediumslow', genderRatio: 0.5,
    eggGroups: ['Flying'], eggMoves: ['fly'],
    abilities: ['menace'], evYield: { spe: 1 },
    learnset: [
      { lv: 1, move: 'peck' }, { lv: 3, move: 'growl' }, { lv: 7, move: 'gust' },
      { lv: 12, move: 'wingattack' }, { lv: 15, move: 'doubleteam' },
    ],
    evolution: { to: 'howlette', method: 'friendship', min: 160 },
    dex: 'A ball of downy feathers. It hoots softly to lull its prey to sleep.',
  },
  {
    id: 9, key: 'buzzler', name: 'Buzzler', types: ['Bug'],
    base: { hp: 45, atk: 60, def: 50, spa: 30, spd: 40, spe: 55 },
    catchRate: 190, expYield: 55, growth: 'fast', genderRatio: 0.5,
    eggGroups: ['Bug'], eggMoves: ['toxic'],
    abilities: ['rocksolid'], evYield: { atk: 1 },
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 4, move: 'stringshot' }, { lv: 8, move: 'bugbite' },
      { lv: 13, move: 'harden' }, { lv: 16, move: 'toxic' },
    ],
    dex: 'A beetle that buzzes at exactly 440 Hz. Musicians tune their instruments to it.',
  },
  {
    id: 10, key: 'cocoonet', name: 'Cocoonet', types: ['Bug', 'Flying'],
    base: { hp: 55, atk: 45, def: 55, spa: 60, spd: 55, spe: 65 },
    catchRate: 120, expYield: 75, growth: 'erratic', genderRatio: 0.5,
    eggGroups: ['Bug'], eggMoves: [],
    abilities: ['adaptive'], evYield: { spa: 1 },
    learnset: [
      { lv: 1, move: 'gust' }, { lv: 1, move: 'stringshot' }, { lv: 9, move: 'bugbite' },
      { lv: 14, move: 'wingattack' }, { lv: 18, move: 'sleeppowder' },
    ],
    dex: 'It weaves silk nets between trees to catch drifting pollen and small prey.',
  },
  {
    id: 11, key: 'sparkit', name: 'Sparkit', types: ['Electric'],
    base: { hp: 35, atk: 55, def: 40, spa: 60, spd: 50, spe: 90 },
    catchRate: 190, expYield: 70, growth: 'mediumfast', genderRatio: 0.5,
    eggGroups: ['Field'], eggMoves: ['furyswipes'],
    abilities: ['staticfur'], evYield: { spe: 1 },
    learnset: [
      { lv: 1, move: 'scratch' }, { lv: 4, move: 'thundershock' }, { lv: 9, move: 'quickattack' },
      { lv: 14, move: 'spark' }, { lv: 18, move: 'furyswipes' },
    ],
    evolution: { to: 'voltkat', method: 'stone', stone: 'thunderstone' },
    dex: 'A kitten whose fur crackles with static. Petting it is a shocking experience.',
  },
  {
    id: 12, key: 'pebblit', name: 'Pebblit', types: ['Rock'],
    base: { hp: 40, atk: 55, def: 100, spa: 30, spd: 30, spe: 20 },
    catchRate: 255, expYield: 60, growth: 'mediumslow', genderRatio: 0.5,
    eggGroups: ['Mineral'], eggMoves: ['sandattack'],
    abilities: ['rocksolid'], evYield: { def: 1 },
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 4, move: 'harden' }, { lv: 8, move: 'rockthrow' },
      { lv: 13, move: 'rocktomb' },
    ],
    evolution: { to: 'bouldron', method: 'trade' },
    dex: 'Often mistaken for a roadside stone. It grumbles when stepped on.',
  },
  {
    id: 13, key: 'bouldron', name: 'Bouldron', types: ['Rock', 'Ground'],
    base: { hp: 55, atk: 45, def: 130, spa: 45, spd: 45, spe: 35 },
    catchRate: 120, expYield: 100, growth: 'mediumslow', genderRatio: 0.5,
    eggGroups: ['Mineral'], eggMoves: [],
    abilities: ['rocksolid'], evYield: { def: 2 },
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 1, move: 'harden' }, { lv: 8, move: 'mudslap' },
      { lv: 12, move: 'rockthrow' }, { lv: 16, move: 'rocktomb' }, { lv: 18, move: 'stealthrock' },
      { lv: 20, move: 'dig' }, { lv: 22, move: 'sandstorm' },
    ],
    dex: 'A living boulder that naps for decades. Mountain trails detour around it.',
  },
  {
    id: 14, key: 'mudlet', name: 'Mudlet', types: ['Ground'],
    base: { hp: 50, atk: 60, def: 55, spa: 40, spd: 45, spe: 40 },
    catchRate: 190, expYield: 58, growth: 'mediumfast', genderRatio: 0.5,
    eggGroups: ['Water1', 'Field'], eggMoves: ['sandattack'],
    abilities: ['sponge'], evYield: { hp: 1 },
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 4, move: 'mudslap' }, { lv: 6, move: 'sandattack' },
      { lv: 9, move: 'harden' }, { lv: 14, move: 'dig' },
    ],
    dex: 'A cheerful mudfish that surfaces after rain. It leaves smiley prints in the muck.',
  },
  {
    id: 15, key: 'floazy', name: 'Floazy', types: ['Water', 'Flying'],
    base: { hp: 52, atk: 44, def: 42, spa: 58, spd: 50, spe: 60 },
    catchRate: 190, expYield: 61, growth: 'mediumfast', genderRatio: 0.5,
    eggGroups: ['Water1', 'Flying'], eggMoves: ['coldsnap'],
    abilities: ['sponge'], evYield: { spa: 1 },
    learnset: [
      { lv: 1, move: 'watergun' }, { lv: 5, move: 'gust' }, { lv: 10, move: 'wingattack' },
      { lv: 15, move: 'bubblebeam' }, { lv: 18, move: 'coldsnap' },
    ],
    evolution: { to: 'driftail', method: 'stone', stone: 'waterstone' },
    dex: 'A drowsy duck that floats downstream on its back, snoring bubbles.',
  },
  {
    id: 16, key: 'psywisp', name: 'Psywisp', types: ['Psychic'],
    base: { hp: 40, atk: 30, def: 35, spa: 75, spd: 60, spe: 70 },
    catchRate: 100, expYield: 75, growth: 'slow', genderRatio: 0.5,
    eggGroups: ['Amorphous'], eggMoves: ['confuseray'],
    abilities: ['airborne'], evYield: { spa: 1 },
    learnset: [
      { lv: 1, move: 'confusion' }, { lv: 6, move: 'growl' }, { lv: 12, move: 'thunderwave' },
      { lv: 14, move: 'confuseray' }, { lv: 18, move: 'lightscreen' }, { lv: 22, move: 'mend' },
    ],
    evolution: { to: 'somnara', method: 'stone', stone: 'moonstone' },
    dex: 'A faint wisp said to be a daydream that escaped. It hums forgotten lullabies.',
  },
  {
    id: 17, key: 'thistling', name: 'Thistling', types: ['Grass', 'Bug'],
    base: { hp: 42, atk: 55, def: 48, spa: 45, spd: 48, spe: 50 },
    catchRate: 190, expYield: 57, growth: 'mediumfast', genderRatio: 0.5,
    eggGroups: ['Grass', 'Bug'], eggMoves: ['spikes'],
    abilities: ['toxicbarb'], evYield: { atk: 1 },
    learnset: [
      { lv: 1, move: 'absorb' }, { lv: 5, move: 'stringshot' }, { lv: 9, move: 'razorleaf' },
      { lv: 14, move: 'bugbite' }, { lv: 16, move: 'spikes' }, { lv: 18, move: 'toxic' },
      { lv: 20, move: 'megadrain' },
    ],
    dex: 'It disguises itself as a thistle. Grazing herds learned to check twice.',
  },
  {
    id: 18, key: 'gustling', name: 'Gustling', types: ['Flying'],
    base: { hp: 38, atk: 50, def: 38, spa: 50, spd: 42, spe: 85 },
    catchRate: 190, expYield: 56, growth: 'erratic', genderRatio: null,
    eggGroups: ['Flying', 'Amorphous'], eggMoves: [],
    abilities: ['momentum'], evYield: { spe: 1 },
    learnset: [
      { lv: 1, move: 'gust' }, { lv: 5, move: 'quickattack' }, { lv: 10, move: 'peck' },
      { lv: 12, move: 'doubleteam' }, { lv: 15, move: 'wingattack' },
    ],
    dex: 'A pocket of wind given form. It races weather vanes and always wins.',
  },
  {
    id: 19, key: 'zapwing', name: 'Zapwing', types: ['Electric', 'Flying'],
    base: { hp: 45, atk: 48, def: 40, spa: 68, spd: 50, spe: 88 },
    catchRate: 90, expYield: 80, growth: 'slow', genderRatio: 0.5,
    eggGroups: ['Flying'], eggMoves: [],
    abilities: ['staticfur'], evYield: { spe: 2 },
    learnset: [
      { lv: 1, move: 'peck' }, { lv: 5, move: 'thundershock' }, { lv: 11, move: 'gust' },
      { lv: 16, move: 'spark' }, { lv: 20, move: 'electricterrain' }, { lv: 24, move: 'fly' },
    ],
    dex: 'It surfs thunderclouds and steals lightning. Its feathers glow before storms.',
  },
  {
    id: 20, key: 'flarat', name: 'Flarat', types: ['Fire'],
    base: { hp: 38, atk: 58, def: 38, spa: 52, spd: 40, spe: 78 },
    catchRate: 190, expYield: 59, growth: 'fast', genderRatio: 0.5,
    eggGroups: ['Field'], eggMoves: ['sunnyday'],
    abilities: ['embergut'], evYield: { spe: 1 },
    learnset: [
      { lv: 1, move: 'scratch' }, { lv: 5, move: 'ember' }, { lv: 10, move: 'quickattack' },
      { lv: 15, move: 'firefang' }, { lv: 18, move: 'sunnyday' },
    ],
    dex: 'A rat with a matchstick tail. It sneaks into kitchens to warm its paws.',
  },
  {
    id: 21, key: 'nibblex', name: 'Nibblex', types: ['Normal'],
    base: { hp: 55, atk: 81, def: 60, spa: 50, spd: 60, spe: 97 },
    catchRate: 127, expYield: 145, growth: 'fast', genderRatio: 0.5,
    eggGroups: ['Field'], eggMoves: ['furyswipes'],
    abilities: ['momentum', 'musclebound'], evYield: { spe: 2 },
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 1, move: 'tailwhip' }, { lv: 7, move: 'quickattack' },
      { lv: 11, move: 'bite' }, { lv: 14, move: 'doubleteam' }, { lv: 18, move: 'furyswipes' },
      { lv: 24, move: 'takedown' },
    ],
    dex: 'Its fangs can pierce concrete. It stands guard over its nest all night.',
  },
  {
    id: 22, key: 'howlette', name: 'Howlette', types: ['Normal', 'Flying'],
    base: { hp: 70, atk: 60, def: 55, spa: 76, spd: 66, spe: 90 },
    catchRate: 90, expYield: 155, growth: 'mediumslow', genderRatio: 0.5,
    eggGroups: ['Flying'], eggMoves: ['fly'],
    abilities: ['menace', 'adaptive'], evYield: { spe: 2 },
    learnset: [
      { lv: 1, move: 'peck' }, { lv: 1, move: 'growl' }, { lv: 7, move: 'gust' },
      { lv: 12, move: 'wingattack' }, { lv: 16, move: 'quickattack' }, { lv: 22, move: 'fly' },
    ],
    dex: 'A silent hunter. Its wingbeats make no sound at all on moonlit nights.',
  },
  {
    id: 23, key: 'voltkat', name: 'Voltkat', types: ['Electric'],
    base: { hp: 60, atk: 75, def: 55, spa: 90, spd: 70, spe: 115 },
    catchRate: 75, expYield: 160, growth: 'mediumfast', genderRatio: 0.5,
    eggGroups: ['Field'], eggMoves: ['furyswipes'],
    abilities: ['staticfur', 'momentum'], evYield: { spe: 2 },
    learnset: [
      { lv: 1, move: 'scratch' }, { lv: 1, move: 'thundershock' }, { lv: 9, move: 'quickattack' },
      { lv: 14, move: 'spark' }, { lv: 18, move: 'furyswipes' }, { lv: 22, move: 'thunderwave' },
      { lv: 26, move: 'electricterrain' },
    ],
    dex: 'It stores a lightning bolt in each whisker. Storm clouds follow it home.',
  },
  {
    id: 24, key: 'driftail', name: 'Driftail', types: ['Water', 'Flying'],
    base: { hp: 75, atk: 62, def: 60, spa: 85, spd: 72, spe: 82 },
    catchRate: 75, expYield: 160, growth: 'mediumfast', genderRatio: 0.5,
    eggGroups: ['Water1', 'Flying'], eggMoves: ['coldsnap'],
    abilities: ['sponge', 'menace'], evYield: { spd: 2 },
    learnset: [
      { lv: 1, move: 'watergun' }, { lv: 1, move: 'gust' }, { lv: 10, move: 'wingattack' },
      { lv: 15, move: 'bubblebeam' }, { lv: 18, move: 'coldsnap' }, { lv: 22, move: 'raindance' },
      { lv: 26, move: 'fly' },
    ],
    dex: 'It rides storm currents for weeks without landing, sleeping mid-air.',
  },
  {
    id: 25, key: 'somnara', name: 'Somnara', types: ['Psychic'],
    base: { hp: 65, atk: 45, def: 55, spa: 110, spd: 90, spe: 85 },
    catchRate: 60, expYield: 165, growth: 'slow', genderRatio: 0.5,
    eggGroups: ['Amorphous'], eggMoves: ['confuseray'],
    abilities: ['airborne', 'adaptive'], evYield: { spa: 2 },
    learnset: [
      { lv: 1, move: 'confusion' }, { lv: 1, move: 'growl' }, { lv: 12, move: 'thunderwave' },
      { lv: 14, move: 'confuseray' }, { lv: 18, move: 'lightscreen' }, { lv: 18, move: 'reflect' },
      { lv: 22, move: 'mend' }, { lv: 28, move: 'confuseray' },
    ],
    dex: 'It weaves dreams into visible threads. Cities under its glow sleep deeply.',
  },
  {
    id: 26, key: 'mimew', name: 'Mimew', types: ['Normal'],
    base: { hp: 70, atk: 60, def: 60, spa: 60, spd: 60, spe: 60 },
    catchRate: 45, expYield: 90, growth: 'slow', genderRatio: null,
    eggGroups: ['Mimic'], eggMoves: [],
    abilities: ['adaptive'], evYield: { hp: 2 }, baseFriendship: 100,
    learnset: [
      { lv: 1, move: 'tackle' }, { lv: 4, move: 'growl' }, { lv: 9, move: 'quickattack' },
      { lv: 16, move: 'takedown' }, { lv: 22, move: 'doubleteam' },
    ],
    dex: 'It reshapes its body to befriend any Mockemon. Breeders treasure it.',
  },
];

export const SPECIES: Record<string, SpeciesDef> = Object.fromEntries(list.map((s) => [s.key, s]));
export const DEX_ORDER = list.map((s) => s.key);
export const DEX_COUNT = list.length;
