import type { ScriptCmd } from '../../script';

export const SCRIPTS: Record<string, ScriptCmd[]> = {
  mock_center_nurse: [
    {
      t: 'say',
      lines: ['NURSE: Welcome to the Mock Center! Let me heal your Mockemon to full health!', 'NURSE: ... ... ...'],
    },
    { t: 'healParty' },
    { t: 'setHealPoint' },
    { t: 'say', lines: ['NURSE: All healed! We hope to see you again!'] },
  ],
  ball_giver: [
    {
      t: 'if',
      flag: 'gotBalls',
      then: [{ t: 'say', lines: ['OLD MAN: Catch anything good yet?'] }],
      else: [
        { t: 'say', lines: ['OLD MAN: Off to Route 1? A trainer needs MockBalls to catch Mockemon!'] },
        { t: 'giveItem', item: 'mockball', count: 5 },
        { t: 'giveItem', item: 'potion', count: 2 },
        { t: 'setFlag', flag: 'gotBalls' },
        { t: 'questComplete', quest: 'parcel' },
        { t: 'questAdvance', quest: 'main_journey', stage: 'badge1' },
        {
          t: 'say',
          lines: [
            'You received 5 MockBalls and 2 Potions!',
            'OLD MAN: Weaken a wild Mockemon first, then throw the ball. Works even better if they are asleep or paralyzed!',
          ],
        },
      ],
    },
  ],
  sign_style: [{ t: 'say', lines: ['MAPLE TOWN - Where journeys sprout.'] }],
  hiker_yes_no_sample: [
    {
      t: 'say',
      lines: ['HIKER: I will trade my Pebblit (Lv15) for any one of your Mockemon. What do you say?'],
    },
    {
      t: 'choice',
      title: 'Trade with the hiker?',
      options: [
        { label: 'TRADE', then: [{ t: 'say', lines: ['HIKER: Wonderful! Show me the Mockemon you will trade.'] }] },
        { label: 'NO THANKS', then: [{ t: 'say', lines: ['HIKER: Maybe next time!'] }] },
      ],
      onCancel: [{ t: 'say', lines: ['HIKER: Maybe next time!'] }],
    },
  ],
  woods_grunt_block: [
    {
      t: 'if',
      flag: 'woodsGruntCleared',
      then: [],
      else: [
        { t: 'say', lines: ['GRUNT: Hey! This part of the woods is Team Rollback territory!', 'GRUNT: Nobody passes without a battle!'] },
        { t: 'battle', trainer: 'grunt_woods_1', onWin: [{ t: 'setFlag', flag: 'woodsGruntCleared' }, { t: 'say', lines: ['GRUNT: Argh! Fine, go through. But Team Rollback will not forget this!'] }] },
      ],
    },
  ],
  cave_dredge_scene: [
    {
      t: 'if',
      flag: 'caveDredgeSeen',
      then: [],
      else: [
        { t: 'setFlag', flag: 'caveDredgeSeen' },
        { t: 'say', lines: ['You hear the rumble of dredging equipment deeper in the cave.', 'Team Rollback is excavating something here...'] },
      ],
    },
  ],
  contest_signup: [
    {
      t: 'if',
      flag: 'contestEntered',
      then: [{ t: 'say', lines: ['CLERK: You are already registered! Good luck out there!'] }],
      else: [
        { t: 'say', lines: ['CLERK: Welcome to the Thornbury Bug Catching Contest!', 'Catch the best Bug-type Mockemon you can find!'] },
        { t: 'questStart', quest: 'contest' },
        { t: 'questAdvance', quest: 'contest', stage: 'register' },
        { t: 'setFlag', flag: 'contestEntered' },
        { t: 'say', lines: ['CLERK: You are registered! Head out and catch something amazing!'] },
      ],
    },
  ],
  fossil_revive: [
    {
      t: 'if',
      flag: 'fossilRevived',
      then: [{ t: 'say', lines: ['CURATOR: Your revived Mockemon is doing well! Take good care of it.'] }],
      else: [
        {
          t: 'if',
          flag: 'fossilDelivered',
          then: [
            { t: 'setFlag', flag: 'fossilRevived' },
            { t: 'giveMon', species: 'fossilisk', level: 20 },
            { t: 'questComplete', quest: 'fossil' },
            { t: 'say', lines: ['CURATOR: The revival is complete!', 'You received a Fossilisk! It has been dormant for millennia.'] },
          ],
          else: [
            { t: 'say', lines: ['CURATOR: Ah, you found a fossil sample in Seaside Cave?', 'Bring it to me and I can attempt a revival!'] },
          ],
        },
      ],
    },
  ],
  lighthouse_lamp: [
    {
      t: 'if',
      flag: 'lampRestored',
      then: [{ t: 'say', lines: ['KEEPER: The beacon burns bright again. Thank you, trainer!'] }],
      else: [
        {
          t: 'if',
          flag: 'lampParts',
          then: [
            { t: 'setFlag', flag: 'lampRestored' },
            { t: 'questComplete', quest: 'lighthouse' },
            { t: 'say', lines: ['KEEPER: You found the parts! Let me fix the lamp...', '... ... ...', 'The beacon shines once more! Ships can safely reach Tidewell now.'] },
          ],
          else: [
            { t: 'say', lines: ['KEEPER: The lighthouse lamp went dark!', 'I need replacement parts from Seaside Cave. Can you help?'] },
          ],
        },
      ],
    },
  ],
  powerplant_intro: [
    {
      t: 'if',
      flag: 'powerplantIntroSeen',
      then: [],
      else: [
        { t: 'setFlag', flag: 'powerplantIntroSeen' },
        { t: 'say', lines: ['The power plant hums with electricity.', 'Team Rollback operatives are siphoning power from the generators!'] },
      ],
    },
  ],
  powerplant_boss: [
    {
      t: 'if',
      flag: 'powerplantBossBeaten',
      then: [{ t: 'say', lines: ['The generators are quiet now. Team Rollback has retreated.'] }],
      else: [
        { t: 'say', lines: ['ADMIN PATCH: So you tracked us down. Impressive.', 'But this power belongs to Team Rollback now!'] },
        { t: 'battle', trainer: 'admin_patch', onWin: [{ t: 'setFlag', flag: 'powerplantBossBeaten' }, { t: 'say', lines: ['ADMIN PATCH: Impossible! Our plan...', 'No matter. The Director has what he needs elsewhere. Withdraw!'] }] },
      ],
    },
  ],
  kai_rematch_route5: [
    {
      t: 'if',
      flag: 'kaiRematch5Won',
      then: [{ t: 'say', lines: ['KAI: Still ahead of you. Keep pushing, rival.'] }],
      else: [
        { t: 'say', lines: ['KAI: There you are! Bloomrest is just up ahead.', 'But first, I want to see how much stronger you have gotten!'] },
        { t: 'battle', trainer: 'rival_kai_3', onWin: [{ t: 'setFlag', flag: 'kaiRematch5Won' }, { t: 'say', lines: ['KAI: You are getting stronger every time.', 'Do not let that go to your head. The league will not be so easy!'] }] },
      ],
    },
  ],
  berry_farmer: [
    {
      t: 'if',
      flag: 'berriesDelivered',
      then: [{ t: 'say', lines: ['FARMER: Thanks again for the berries! The crop is recovering nicely.'] }],
      else: [
        {
          t: 'if',
          flag: 'berriesCollected',
          then: [
            { t: 'setFlag', flag: 'berriesDelivered' },
            { t: 'giveItem', item: 'sitrusberry', count: 3 },
            { t: 'questComplete', quest: 'berries' },
            { t: 'say', lines: ['FARMER: You saved this season! Take these berries as thanks!'] },
          ],
          else: [
            { t: 'say', lines: ['FARMER: Pests are ruinin my berry crop on Route 5!', 'Can you gather some healthy ones before they are all gone?'] },
          ],
        },
      ],
    },
  ],
  berry_trade: [
    { t: 'say', lines: ['BERRY TRADER: I will trade you a rare berry for 3 Oran Berries.', 'Come back when you have enough!'] },
  ],
  cinder_forge: [
    {
      t: 'if',
      flag: 'forgeVisited',
      then: [{ t: 'say', lines: ['BLACKSMITH: The forge is hot and ready! Need something crafted?'] }],
      else: [
        { t: 'setFlag', flag: 'forgeVisited' },
        { t: 'say', lines: ['BLACKSMITH: Welcome to the Cinderwake Forge!', 'We craft fire-resistant gear for trainers braving the lava tubes.', 'Be careful up north. The lava flows on a cycle!'] },
      ],
    },
  ],
  lavatube_intro: [
    {
      t: 'if',
      flag: 'lavatubeIntroSeen',
      then: [],
      else: [
        { t: 'setFlag', flag: 'lavatubeIntroSeen' },
        { t: 'say', lines: ['The heat is intense. Lava pulses through these tubes on a timer.', 'Cross when the crust cools. Do not get caught mid-crossing!'] },
      ],
    },
  ],
  lavatube_boss: [
    {
      t: 'if',
      flag: 'lavatubeBossSeen',
      then: [],
      else: [
        { t: 'setFlag', flag: 'lavatubeBossSeen' },
        { t: 'say', lines: ['ADMIN MERGE: You followed me all the way here?', 'The Director plans to merge Originon with the Ledger itself.', 'But first, you will have to get past me!'] },
      ],
    },
  ],
  sky_feather: [
    {
      t: 'if',
      flag: 'skyFeatherPickedUp',
      then: [{ t: 'say', lines: ['COURIER: The packet is on its way. Safe skies, trainer!'] }],
      else: [
        { t: 'say', lines: ['COURIER: I need someone reliable to deliver this sky feather packet.', 'Carry it across the Route 7 sky bridge safely!'] },
        { t: 'questStart', quest: 'sky_feather' },
        { t: 'questAdvance', quest: 'sky_feather', stage: 'pickup' },
        { t: 'setFlag', flag: 'skyFeatherPickedUp' },
        { t: 'say', lines: ['COURIER: The packet is in your hands now. Do not drop it!'] },
      ],
    },
  ],
  skybridge_chase: [
    {
      t: 'if',
      flag: 'skybridgeChaseSeen',
      then: [],
      else: [
        { t: 'setFlag', flag: 'skybridgeChaseSeen' },
        { t: 'say', lines: ['Team Rollback grunts are chasing someone across the sky bridge!', 'The winds are fierce. You need to cross carefully!'] },
      ],
    },
  ],
  skybridge_rescue: [
    {
      t: 'if',
      flag: 'skybridgeRescueSeen',
      then: [],
      else: [
        { t: 'setFlag', flag: 'skybridgeRescueSeen' },
        { t: 'say', lines: ['You reached the other side! The courier thanks you for the safe delivery.', 'The sky feather packet is intact!'] },
      ],
    },
  ],
  observatory_coords: [
    {
      t: 'if',
      flag: 'nullpeakOpen',
      then: [{ t: 'say', lines: ['TECHNICIAN: The coordinates are locked in. Null Peak is open to you now!'] }],
      else: [
        { t: 'setFlag', flag: 'nullpeakOpen' },
        { t: 'say', lines: ['TECHNICIAN: We pinpointed the source of the anomaly!', 'Null Peak. The highest point in the region.', 'The coordinates are uploaded to your MockDex. The path north is open!'] },
      ],
    },
  ],
  observatory_ghost: [
    {
      t: 'if',
      flag: 'ghostSignalReported',
      then: [{ t: 'say', lines: ['TECHNICIAN: The signal has been catalogued. Thank you for your help!'] }],
      else: [
        {
          t: 'if',
          flag: 'ghostSignalFound',
          then: [
            { t: 'setFlag', flag: 'ghostSignalReported' },
            { t: 'giveItem', item: 'safetysash', count: 1 },
            { t: 'questComplete', quest: 'observatory_ghost' },
            { t: 'say', lines: ['TECHNICIAN: You found it! The signal is coming from Null Peak itself.', 'Take this Safety Sash as thanks for your help!'] },
          ],
          else: [
            { t: 'say', lines: ['TECHNICIAN: Our instruments picked up a ghost signal at night.', 'Can you investigate the hills outside Somnium after dark?'] },
          ],
        },
      ],
    },
  ],
  nullpeak_intro: [
    {
      t: 'if',
      flag: 'nullpeakIntroSeen',
      then: [],
      else: [
        { t: 'setFlag', flag: 'nullpeakIntroSeen' },
        { t: 'say', lines: ['The air grows thin as you ascend Null Peak.', 'A strange energy permeates everything. The Ledger feels close here.', 'Director Nil of Team Rollback is somewhere above...'] },
      ],
    },
  ],
  nullpeak_confrontation: [
    {
      t: 'if',
      flag: 'nullpeakConfrontationSeen',
      then: [],
      else: [
        { t: 'setFlag', flag: 'nullpeakConfrontationSeen' },
        { t: 'say', lines: ['DIRECTOR NIL: So. You made it to the summit.', 'I plan to rewrite this entire region using Originon.', 'The Ledger will be mine to edit. And you... you are just a footnote!'] },
      ],
    },
  ],
  originon_awaken: [
    {
      t: 'if',
      flag: 'originonAwakenSeen',
      then: [],
      else: [
        { t: 'setFlag', flag: 'originonAwakenSeen' },
        { t: 'say', lines: ['A blinding light erupts from the peak!', 'Originon stirs from its ancient slumber...', 'The very fabric of the region shimmers with raw data!'] },
      ],
    },
  ],
  champion_intro: [
    {
      t: 'if',
      flag: 'championIntroSeen',
      then: [],
      else: [
        { t: 'setFlag', flag: 'championIntroSeen' },
        { t: 'say', lines: ['CHAMPION KAI: You made it. I knew you would.', 'Eight badges. Team Rollback stopped. And now, one final battle.', 'Let us see who truly deserves the title of Champion!'] },
      ],
    },
  ],
};
