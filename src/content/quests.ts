import type { QuestDef } from '../quests';

export const QUESTS: Record<string, QuestDef> = {
  main_journey: {
    id: 'main_journey',
    title: 'The Main Journey',
    kind: 'main',
    act: 0,
    giver: 'prof_maple',
    stages: [
      {
        id: 'starter',
        objective: 'Choose your starter at Prof. Maple\'s Lab and begin your Mocca League challenge.',
        journal: 'Prof. Maple gave me a MockDex and asked me to challenge the Mocca League.',
      },
      {
        id: 'parcel',
        objective: 'Deliver Maple\'s parcel and continue toward Verdant City.',
        journal: 'I picked up Maple\'s parcel and need to deliver it before pushing onward.',
      },
      {
        id: 'badge1',
        objective: 'Beat Leader Terra of Verdant Gym (Rock) for the Boulder Badge.',
        journal: 'My first league target is Terra in Verdant City.',
      },
      {
        id: 'badge2',
        objective: 'Beat Leader Weave of Thornbury Gym (Bug) for the Silk Badge.',
        journal: 'With one badge in hand, I am heading to Thornbury for the Bug Gym.',
      },
      {
        id: 'badge3',
        objective: 'Beat Leader Nerin of Tidewell Gym (Water) for the Tide Badge.',
        journal: 'The next badge is in Tidewell Town, where Nerin commands Water Mockemon.',
      },
      {
        id: 'badge4',
        objective: 'Beat Leader Dyna of Voltmere Gym (Electric) for the Surge Badge.',
        journal: 'Voltmere City\'s Electric Gym stands between me and the mid-league stretch.',
      },
      {
        id: 'badge5',
        objective: 'Beat Leader Fern of Bloomrest Gym (Grass) for the Bloom Badge.',
        journal: 'I reached Bloomrest and must defeat Fern to claim badge five.',
      },
      {
        id: 'badge6',
        objective: 'Beat Leader Pyra of Cinderwake Gym (Fire) for the Ember Badge.',
        journal: 'Cinderwake\'s Fire Gym is next, led by Pyra.',
      },
      {
        id: 'badge7',
        objective: 'Beat Leader Aeris of Zephyr Heights Gym (Flying) for the Gale Badge.',
        journal: 'Only two gyms remain. Aeris awaits in Zephyr Heights.',
      },
      {
        id: 'badge8',
        objective: 'Beat Leader Mira of Somnium Gym (Psychic) for the Dream Badge.',
        journal: 'The final gym badge is the Dream Badge from Mira in Somnium Town.',
      },
      {
        id: 'nullpeak',
        objective: 'Stop Director Nil and Team Rollback at Null Peak Summit.',
        journal: 'With eight badges earned, I must stop Team Rollback at Null Peak.',
      },
      {
        id: 'league',
        objective: 'Clear Victory Trail and reach Summit Null.',
        journal: 'Team Rollback has been confronted. The path to the league is Victory Trail.',
      },
      {
        id: 'champion',
        objective: 'Defeat Champion Kai at Summit Null.',
        journal: 'I reached Summit Null. One final battle with Kai decides the championship.',
      },
    ],
  },
  parcel: {
    id: 'parcel',
    title: 'Maple\'s Parcel',
    kind: 'side',
    act: 0,
    giver: 'prof_maple',
    // no reward block: the ball_giver script hands over the balls and potions itself
    stages: [
      {
        id: 'pickup',
        objective: 'Pick up Maple\'s parcel from Maple Town.',
        journal: 'Prof. Maple asked me to carry an important parcel.',
      },
      {
        id: 'deliver',
        objective: 'Deliver the parcel and report back to Maple.',
        journal: 'I delivered the parcel and should return for my reward.',
      },
    ],
  },
  lost_nibbit: {
    id: 'lost_nibbit',
    title: 'Lost Nibbit',
    kind: 'side',
    act: 1,
    giver: 'verdant_mom',
    reward: { item: 'moonstone', count: 1 },
    stages: [
      {
        id: 'heard',
        objective: 'Talk to the worried parent in Verdant City about the missing Nibbit.',
        journal: 'A parent in Verdant City asked me to find their runaway Nibbit.',
      },
      {
        id: 'track',
        objective: 'Search Route 1 and Verdant back alleys for the missing Nibbit.',
        journal: 'I am tracking the Nibbit through scratch marks and scattered berries.',
      },
      {
        id: 'return',
        objective: 'Return the Nibbit to its owner in Verdant City.',
        journal: 'I found the missing Nibbit and now need to bring it home.',
      },
    ],
  },
  hiker_trade: {
    id: 'hiker_trade',
    title: 'Hiker\'s Trade Request',
    kind: 'side',
    act: 1,
    giver: 'route1_hiker',
    reward: { mon: { species: 'bouldron', level: 18 } },
    stages: [
      {
        id: 'request',
        objective: 'Hear the Route 1 hiker\'s trade offer.',
        journal: 'A hiker on Route 1 offered a special trade.',
      },
      {
        id: 'trade',
        objective: 'Complete the hiker\'s trade and inspect your new partner.',
        journal: 'I have the Mockemon the hiker wanted. Time to trade.',
      },
    ],
  },
  contest: {
    id: 'contest',
    title: 'Bug Catching Contest',
    kind: 'side',
    act: 2,
    giver: 'contest_clerk',
    reward: { item: 'swiftfeather', count: 1 },
    stages: [
      {
        id: 'register',
        objective: 'Register at Thornbury Contest Hall.',
        journal: 'The Thornbury clerk invited me to the Bug Catching Contest.',
      },
      {
        id: 'compete',
        objective: 'Catch a Bug-type Mockemon in the contest window.',
        journal: 'The contest has started. I need a strong Bug catch before time runs out.',
      },
      {
        id: 'claim',
        objective: 'Submit your catch and claim the contest reward.',
        journal: 'I finished the contest and should collect my prize.',
      },
    ],
  },
  daycare_egg: {
    id: 'daycare_egg',
    title: 'Daycare Egg Recovery',
    kind: 'side',
    act: 2,
    giver: 'daycare_keeper',
    reward: { item: 'luckycharm', count: 1 },
    stages: [
      {
        id: 'report',
        objective: 'Speak with the daycare keeper in Thornbury about the stolen egg.',
        journal: 'A daycare egg was stolen near Thornbury.',
      },
      {
        id: 'retrieve',
        objective: 'Track down the thief in Verdant Woods and recover the egg.',
        journal: 'I am searching Verdant Woods for clues about the stolen daycare egg.',
      },
      {
        id: 'return',
        objective: 'Return the egg to the daycare keeper.',
        journal: 'I recovered the egg and need to bring it back safely.',
      },
    ],
  },
  fossil: {
    id: 'fossil',
    title: 'Seaside Fossil Revival',
    kind: 'side',
    act: 3,
    giver: 'museum_curator',
    reward: { mon: { species: 'pebblit', level: 20 } },
    stages: [
      {
        id: 'accept',
        objective: 'Meet the Tidewell museum curator about a newly recovered fossil.',
        journal: 'The museum in Tidewell needs help reviving a fossil from Seaside Cave.',
      },
      {
        id: 'deliver',
        objective: 'Bring the fossil sample from Seaside Cave to the Tidewell museum.',
        journal: 'I found the fossil sample. The curator can attempt revival now.',
      },
      {
        id: 'revive',
        objective: 'Receive the revived Mockemon from the museum.',
        journal: 'The restoration process is complete; I can claim the revived Mockemon.',
      },
    ],
  },
  lighthouse: {
    id: 'lighthouse',
    title: 'Lighthouse Lamp',
    kind: 'side',
    act: 3,
    giver: 'lighthouse_keeper',
    reward: { item: 'tidecharm', count: 1 },
    stages: [
      {
        id: 'blackout',
        objective: 'Talk to the Tidewell lighthouse keeper about the darkened lamp.',
        journal: 'The Tidewell lighthouse lamp went dark and ships are turning back.',
      },
      {
        id: 'parts',
        objective: 'Find replacement parts in Seaside Cave.',
        journal: 'I need lamp parts from Seaside Cave to relight the beacon.',
      },
      {
        id: 'restore',
        objective: 'Return to the lighthouse and restore the lamp.',
        journal: 'I found the parts and can relight the Tidewell beacon.',
      },
    ],
  },
  gauntlet: {
    id: 'gauntlet',
    title: 'Voltmere Gauntlet',
    kind: 'side',
    act: 4,
    giver: 'voltmere_referee',
    reward: { item: 'powerband', count: 1 },
    stages: [
      {
        id: 'enter',
        objective: 'Enter the Voltmere trainer gauntlet.',
        journal: 'A referee in Voltmere invited me to a back-to-back battle gauntlet.',
      },
      {
        id: 'streak',
        objective: 'Win the full gauntlet streak without leaving.',
        journal: 'I need to clear every gauntlet battle in one run.',
      },
      {
        id: 'prize',
        objective: 'Claim your gauntlet prize from the referee.',
        journal: 'The gauntlet is done. I should collect my reward.',
      },
    ],
  },
  berries: {
    id: 'berries',
    title: 'Bloomrest Berry Help',
    kind: 'side',
    act: 5,
    giver: 'berry_farmer',
    reward: { item: 'sitrusberry', count: 3 },
    stages: [
      {
        id: 'request',
        objective: 'Speak with the berry farmer in Bloomrest.',
        journal: 'A Bloomrest farmer asked me to help rescue this season\'s berry crop.',
      },
      {
        id: 'collect',
        objective: 'Gather healthy berries from Route 5 before pests ruin them.',
        journal: 'I am collecting ripe berries from Route 5 for the farmer.',
      },
      {
        id: 'deliver',
        objective: 'Deliver the berries to the Bloomrest farmer.',
        journal: 'I gathered enough berries and can turn them in now.',
      },
    ],
  },
  sky_feather: {
    id: 'sky_feather',
    title: 'Sky Feather Delivery',
    kind: 'side',
    act: 7,
    giver: 'zephyr_courier',
    reward: { item: 'swiftfeather', count: 1 },
    stages: [
      {
        id: 'pickup',
        objective: 'Pick up the sealed feather packet in Zephyr Heights.',
        journal: 'A courier asked me to hand-deliver a fragile sky feather packet.',
      },
      {
        id: 'crosswinds',
        objective: 'Carry the packet safely across the Route 7 sky bridge.',
        journal: 'The route is windy. I need to cross the bridge without delay.',
      },
      {
        id: 'handoff',
        objective: 'Deliver the packet to its recipient in Zephyr Heights.',
        journal: 'I reached the destination and should complete the delivery.',
      },
    ],
  },
  observatory_ghost: {
    id: 'observatory_ghost',
    title: 'Observatory Ghost Signal',
    kind: 'side',
    act: 8,
    giver: 'observatory_tech',
    reward: { item: 'safetysash', count: 1 },
    stages: [
      {
        id: 'briefing',
        objective: 'Meet the Somnium observatory technician about a ghost signal.',
        journal: 'The observatory detected a repeating ghost signal at night.',
      },
      {
        id: 'night_scan',
        objective: 'Investigate the signal source outside Somnium after dark.',
        journal: 'I need to scan the hills at night to trace the ghost transmission.',
      },
      {
        id: 'report',
        objective: 'Report your findings back to the observatory.',
        journal: 'I isolated the source and should report back to the tech team.',
      },
    ],
  },
  dex_milestones: {
    id: 'dex_milestones',
    title: 'MockDex Milestones',
    kind: 'side',
    act: 0,
    giver: 'prof_maple',
    reward: { item: 'leftovers', count: 1 },
    stages: [
      {
        id: 'seen_10',
        objective: 'Register 10 species in the MockDex and claim Maple\'s first reward.',
        journal: 'Maple is tracking my dex progress with rewards at 10, 20, 30, and 40 species.',
      },
      {
        id: 'seen_20',
        objective: 'Register 20 species in the MockDex for the second milestone reward.',
        journal: 'I hit the first milestone. Next stop: 20 species seen.',
      },
      {
        id: 'seen_30',
        objective: 'Register 30 species in the MockDex for the third milestone reward.',
        journal: 'Maple challenged me to keep cataloging species until 30 entries.',
      },
      {
        id: 'seen_40',
        objective: 'Register 40 species in the MockDex for the final milestone reward.',
        journal: 'Only one milestone remains: 40 species for Maple\'s final dex reward.',
      },
    ],
  },
};
