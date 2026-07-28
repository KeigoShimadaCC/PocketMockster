export interface Warp {
  x: number;
  y: number;
  to: string;
  tx: number;
  ty: number;
}

export interface NpcTrainer {
  id: string;
  name: string;
  spriteKey: string;
  party: { species: string; level: number }[];
  prize: number;
  introText: string;
  defeatText: string;
  sight: number; // tiles of line-of-sight, 0 = talk only
  ai?: 'basic' | 'smart' | 'leader';
  potions?: number; // super potions usable in battle
}

export interface Npc {
  id: string;
  x: number;
  y: number;
  spriteKey: string;
  facing: 'up' | 'down' | 'left' | 'right';
  dialogue: string[];
  action?: 'heal' | 'shop' | 'giveballs' | 'starter' | 'gymleader' | 'daycare' | 'trade';
  trainer?: NpcTrainer;
  hiddenUntilFlag?: string;
  hiddenAfterFlag?: string;
}

export interface GroundItem {
  id: string;
  x: number;
  y: number;
  item: string;
  count: number;
}

export interface EncounterEntry {
  species: string;
  minLv: number;
  maxLv: number;
  weight: number;
  nightWeight?: number; // overrides weight during night phase
}

export interface GameMap {
  id: string;
  name: string;
  tiles: string[];
  warps: Warp[];
  npcs: Npc[];
  items: GroundItem[];
  encounters: EncounterEntry[];
  encounterRate: number;
  signs: { x: number; y: number; text: string }[];
  lockedDoors: { x: number; y: number; text: string }[];
  indoor: boolean;
}

export const SOLID_TILES = new Set(['T', 'W', 'B', 'R', 'D', 'w', 'C', 'S', 'o', 'f', 'P']);

const route1Encounters: EncounterEntry[] = [
  { species: 'nibbit', minLv: 2, maxLv: 4, weight: 25 },
  { species: 'fluffowl', minLv: 2, maxLv: 4, weight: 20 },
  { species: 'buzzler', minLv: 2, maxLv: 4, weight: 15 },
  { species: 'thistling', minLv: 2, maxLv: 4, weight: 10 },
  { species: 'sparkit', minLv: 3, maxLv: 4, weight: 8 },
  { species: 'mudlet', minLv: 3, maxLv: 4, weight: 6 },
  { species: 'gustling', minLv: 3, maxLv: 4, weight: 5 },
  { species: 'flarat', minLv: 3, maxLv: 4, weight: 4 },
  { species: 'cocoonet', minLv: 3, maxLv: 5, weight: 3 },
  { species: 'pebblit', minLv: 3, maxLv: 5, weight: 2 },
  { species: 'floazy', minLv: 3, maxLv: 5, weight: 1 },
  { species: 'psywisp', minLv: 3, maxLv: 5, weight: 0.7, nightWeight: 3 },
  { species: 'zapwing', minLv: 4, maxLv: 5, weight: 0.3 },
  { species: 'somnara', minLv: 4, maxLv: 6, weight: 0.1, nightWeight: 3.5 },
  { species: 'mimew', minLv: 4, maxLv: 6, weight: 0.1, nightWeight: 0.4 },
];

export const MAPS: Record<string, GameMap> = {
  mapletown: {
    id: 'mapletown',
    name: 'Maple Town',
    indoor: false,
    tiles: [
      'TTTTTTTT,,TTTTTTTTTT',
      'T.......,,.........T',
      'T..RRRR....RRRR....T',
      'T..RRRR....RRRR....T',
      'T..BBDB....BDBB....T',
      'T..................T',
      'T....RRRRRR........T',
      'T....RRRRRR........T',
      'T....BBDBBB........T',
      'T........S.........T',
      'T..................T',
      'T..................T',
      'T..................T',
      'T..................T',
      'T..................T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      { x: 8, y: 0, to: 'route1', tx: 8, ty: 21 },
      { x: 9, y: 0, to: 'route1', tx: 9, ty: 21 },
    ],
    npcs: [
      {
        id: 'town_kid',
        x: 14,
        y: 10,
        spriteKey: 'villager1',
        facing: 'down',
        dialogue: [
          'Technology is amazing! They say the MockDex can hold data on 26 whole Mockemon!',
        ],
      },
      {
        id: 'daycare_lady',
        x: 16,
        y: 7,
        spriteKey: 'villager1',
        facing: 'left',
        action: 'daycare',
        dialogue: [],
      },
      {
        id: 'trade_hiker',
        x: 3,
        y: 12,
        spriteKey: 'hiker',
        facing: 'right',
        action: 'trade',
        dialogue: [],
      },
      {
        id: 'ball_giver',
        x: 10,
        y: 2,
        spriteKey: 'villager2',
        facing: 'down',
        action: 'giveballs',
        dialogue: [],
        hiddenUntilFlag: 'starterChosen',
      },
    ],
    items: [],
    encounters: [],
    encounterRate: 0,
    signs: [{ x: 9, y: 9, text: 'MAPLE TOWN - Where journeys sprout.' }],
    lockedDoors: [
      { x: 5, y: 4, text: "It's your house. Mom says: be back for dinner... someday!" },
      { x: 12, y: 4, text: 'The door is locked. Someone is snoring inside.' },
    ],
  },

  lab: {
    id: 'lab',
    name: "Prof. Maple's Lab",
    indoor: true,
    tiles: [
      'wwwwwwwwwwww',
      'wFFFFFFFFFFw',
      'wFCCFFFFCCFw',
      'wFFFPPPFFFFw',
      'wFFFFFFFFFFw',
      'wFFFFFFFFFFw',
      'wFFFFFFFFFFw',
      'wFFFFFFFFFFw',
      'wFFFFFMMFFFw',
      'wwwwwwwwwwww',
    ],
    warps: [
      { x: 6, y: 8, to: 'mapletown', tx: 7, ty: 9 },
      { x: 7, y: 8, to: 'mapletown', tx: 7, ty: 9 },
    ],
    npcs: [
      {
        id: 'professor',
        x: 5,
        y: 4,
        spriteKey: 'professor',
        facing: 'down',
        action: 'starter',
        dialogue: [],
      },
      {
        id: 'rival',
        x: 8,
        y: 6,
        spriteKey: 'rival',
        facing: 'left',
        dialogue: ['Kai: Heh. Pick your Mockemon already, slowpoke!'],
        hiddenAfterFlag: 'rivalBeaten',
      },
    ],
    items: [],
    encounters: [],
    encounterRate: 0,
    signs: [],
    lockedDoors: [],
  },

  route1: {
    id: 'route1',
    name: 'Route 1',
    indoor: false,
    tiles: [
      'TTTTTTTT,,TTTTTTTTTT',
      'T.......,,.........T',
      'T..GGGG.,,..GGGG...T',
      'T..GGGG.,,..GGGG...T',
      'T..GGGG.,,..GGGG...T',
      'T.......,,.........T',
      'T.......,,......WWWT',
      'T..GGG..,,......WWWT',
      'T..GGG..,,.........T',
      'T..GGG..,,..GGGG...T',
      'T.......,,..GGGG...T',
      'T.......,,..GGGG...T',
      'T....o..,,.........T',
      'T.......,,....GGG..T',
      'T..GGGG.,,....GGG..T',
      'T..GGGG.,,....GGG..T',
      'T..GGGG.,,.........T',
      'T.......,,.........T',
      'T.......,,...o.....T',
      'T..GG...,,.........T',
      'T..GG...,,..GGG....T',
      'T.......,,..GGG....T',
      'T.......,,.........T',
      'TTTTTTTT,,TTTTTTTTTT',
    ],
    warps: [
      { x: 8, y: 0, to: 'verdantcity', tx: 9, ty: 16 },
      { x: 9, y: 0, to: 'verdantcity', tx: 10, ty: 16 },
      { x: 8, y: 22, to: 'mapletown', tx: 8, ty: 1 },
      { x: 9, y: 22, to: 'mapletown', tx: 9, ty: 1 },
    ],
    npcs: [
      {
        id: 'trainer_ben',
        x: 12,
        y: 10,
        spriteKey: 'bugcatcher',
        facing: 'left',
        dialogue: ['Ben: My bugs buzz in perfect pitch!'],
        trainer: {
          id: 'trainer_ben',
          name: 'Bug Catcher Ben',
          spriteKey: 'bugcatcher',
          party: [
            { species: 'buzzler', level: 3 },
            { species: 'thistling', level: 3 },
          ],
          prize: 120,
          introText: 'Ben: Hey! You walked into my bug net! Battle time!',
          defeatText: 'Ben: My bugs got squashed...',
          sight: 4,
        },
      },
      {
        id: 'trainer_mia',
        x: 7,
        y: 15,
        spriteKey: 'lass',
        facing: 'right',
        dialogue: ['Mia: Fluffowl is the fluffiest. No contest.'],
        trainer: {
          id: 'trainer_mia',
          name: 'Lass Mia',
          spriteKey: 'lass',
          party: [
            { species: 'fluffowl', level: 4 },
            { species: 'nibbit', level: 4 },
          ],
          prize: 150,
          introText: "Mia: You look new! Let's see what you've got!",
          defeatText: 'Mia: Aww, my fluffy team!',
          sight: 3,
        },
      },
      {
        id: 'trainer_cliff',
        x: 12,
        y: 18,
        spriteKey: 'hiker',
        facing: 'left',
        dialogue: ['Cliff: The gym leader in Verdant City? Hard as a rock, that one.'],
        trainer: {
          id: 'trainer_cliff',
          name: 'Hiker Cliff',
          spriteKey: 'hiker',
          party: [
            { species: 'pebblit', level: 5 },
            { species: 'mudlet', level: 5 },
          ],
          prize: 240,
          introText: 'Cliff: HO HO! A challenger on my trail!',
          defeatText: 'Cliff: Solid battle, kid!',
          sight: 4,
        },
      },
    ],
    items: [
      { id: 'r1_potion1', x: 14, y: 7, item: 'potion', count: 1 },
      { id: 'r1_potion2', x: 16, y: 12, item: 'potion', count: 1 },
      { id: 'r1_ball1', x: 5, y: 19, item: 'mockball', count: 3 },
      { id: 'r1_moonstone', x: 17, y: 18, item: 'moonstone', count: 1 },
      { id: 'r1_thunderstone', x: 2, y: 6, item: 'thunderstone', count: 1 },
      { id: 'r1_waterstone', x: 17, y: 2, item: 'waterstone', count: 1 },
      { id: 'r1_oran', x: 2, y: 13, item: 'oranberry', count: 2 },
    ],
    encounters: route1Encounters,
    encounterRate: 0.14,
    signs: [],
    lockedDoors: [],
  },

  verdantcity: {
    id: 'verdantcity',
    name: 'Verdant City',
    indoor: false,
    tiles: [
      'TTTTTTTTTTTTTTTTTTTTTT',
      'T....................T',
      'T..RRRR...RRRR.......T',
      'T..RRRR...RRRR.......T',
      'T..BDBB...BBDB.......T',
      'T....................T',
      'T.......RRRRRR.......T',
      'T.......RRRRRR.......T',
      'T.......BBBDBB.......T',
      'T.........S..........T',
      'T....................T',
      'T....................T',
      'T....................T',
      'T....................T',
      'T....................T',
      'T....................T',
      'T....................T',
      'TTTTTTTTT,,TTTTTTTTTTT',
    ],
    warps: [
      { x: 4, y: 4, to: 'center', tx: 6, ty: 5 },
      { x: 12, y: 4, to: 'mart', tx: 6, ty: 5 },
      { x: 11, y: 8, to: 'gym', tx: 6, ty: 11 },
      { x: 9, y: 17, to: 'route1', tx: 8, ty: 1 },
      { x: 10, y: 17, to: 'route1', tx: 9, ty: 1 },
    ],
    npcs: [
      {
        id: 'city_tip1',
        x: 6,
        y: 10,
        spriteKey: 'villager1',
        facing: 'down',
        dialogue: ['The Mock Center heals your whole team for free. Bless them.'],
      },
      {
        id: 'city_tip2',
        x: 15,
        y: 12,
        spriteKey: 'villager2',
        facing: 'left',
        dialogue: [
          "Leader Terra's Rock-types are super sturdy!",
          'Grass and Water moves will crack them right open.',
        ],
      },
    ],
    items: [],
    encounters: [],
    encounterRate: 0,
    signs: [{ x: 10, y: 9, text: 'VERDANT CITY - Verdant Gym: Leader Terra, the Unshakable Stone.' }],
    lockedDoors: [],
  },

  center: {
    id: 'center',
    name: 'Mock Center',
    indoor: true,
    tiles: [
      'wwwwwwwwwwww',
      'wFFFFFFFFFFw',
      'wFFFCCCFFFFw',
      'wFFFFFFFFFFw',
      'wFFFFFFFFFFw',
      'wFFFFFFFFFFw',
      'wFFFFFMMFFFw',
      'wwwwwwwwwwww',
    ],
    warps: [
      { x: 6, y: 6, to: 'verdantcity', tx: 4, ty: 5 },
      { x: 7, y: 6, to: 'verdantcity', tx: 4, ty: 5 },
    ],
    npcs: [
      {
        id: 'nurse',
        x: 5,
        y: 1,
        spriteKey: 'nurse',
        facing: 'down',
        action: 'heal',
        dialogue: [],
      },
    ],
    items: [],
    encounters: [],
    encounterRate: 0,
    signs: [],
    lockedDoors: [],
  },

  mart: {
    id: 'mart',
    name: 'Mock Mart',
    indoor: true,
    tiles: [
      'wwwwwwwwwwww',
      'wFFFFFFFFFFw',
      'wFFFCCCFFFFw',
      'wFFFFFFFFFFw',
      'wFFFFFFFFFFw',
      'wFFFFFFFFFFw',
      'wFFFFFMMFFFw',
      'wwwwwwwwwwww',
    ],
    warps: [
      { x: 6, y: 6, to: 'verdantcity', tx: 12, ty: 5 },
      { x: 7, y: 6, to: 'verdantcity', tx: 12, ty: 5 },
    ],
    npcs: [
      {
        id: 'clerk',
        x: 5,
        y: 1,
        spriteKey: 'clerk',
        facing: 'down',
        action: 'shop',
        dialogue: [],
      },
    ],
    items: [],
    encounters: [],
    encounterRate: 0,
    signs: [],
    lockedDoors: [],
  },

  gym: {
    id: 'gym',
    name: 'Verdant Gym',
    indoor: true,
    tiles: [
      'wwwwwwwwwwwwww',
      'wFFFFFFFFFFFFw',
      'wFFFFFFFFFFFFw',
      'wFFFFFFFFFFFFw',
      'wFFooFFFFooFFw',
      'wFFFFFFFFFFFFw',
      'wFFFFFFFFFFFFw',
      'wFFooFFFFooFFw',
      'wFFFFFFFFFFFFw',
      'wFFFFFFFFFFFFw',
      'wFFFFFFFFFFFFw',
      'wFFFFFFFFFFFFw',
      'wFFFFFMMFFFFFw',
      'wwwwwwwwwwwwww',
    ],
    warps: [
      { x: 6, y: 12, to: 'verdantcity', tx: 11, ty: 9 },
      { x: 7, y: 12, to: 'verdantcity', tx: 11, ty: 9 },
    ],
    npcs: [
      {
        id: 'trainer_rocco',
        x: 6,
        y: 8,
        spriteKey: 'hiker',
        facing: 'down',
        dialogue: ['Rocco: Terra is waiting. She does not blink. Ever.'],
        trainer: {
          id: 'trainer_rocco',
          name: 'Gym Trainer Rocco',
          spriteKey: 'hiker',
          party: [
            { species: 'pebblit', level: 7 },
            { species: 'pebblit', level: 8 },
          ],
          prize: 320,
          introText: 'Rocco: Before Terra, you must break through ME!',
          defeatText: 'Rocco: Crushed... like gravel...',
          sight: 3,
          ai: 'smart',
        },
      },
      {
        id: 'leader_terra',
        x: 6,
        y: 2,
        spriteKey: 'gymleader',
        facing: 'down',
        action: 'gymleader',
        dialogue: [],
        trainer: {
          id: 'leader_terra',
          name: 'Leader Terra',
          spriteKey: 'gymleader',
          party: [
            { species: 'pebblit', level: 9 },
            { species: 'bouldron', level: 10 },
          ],
          prize: 1500,
          introText:
            'Terra: I am Terra, the Unshakable Stone. My will, like my Mockemon, does not crack. Show me yours!',
          defeatText: 'Terra: ...The stone cracks. Magnificent.',
          sight: 0,
          ai: 'leader',
          potions: 1,
        },
      },
    ],
    items: [],
    encounters: [],
    encounterRate: 0,
    signs: [],
    lockedDoors: [],
  },
};
