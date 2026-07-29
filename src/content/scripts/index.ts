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
        { label: 'TRADE', then: [{ t: 'questStart', quest: 'hiker_trade' }, { t: 'questAdvance', quest: 'hiker_trade', stage: 'trade' }, { t: 'questComplete', quest: 'hiker_trade' }, { t: 'say', lines: ['HIKER: Wonderful! Show me the Mockemon you will trade.'] }] },
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
        { t: 'battle', trainer: 'grunt_woods_1', onWin: [{ t: 'setFlag', flag: 'woodsGruntCleared' }, { t: 'questStart', quest: 'daycare_egg' }, { t: 'questAdvance', quest: 'daycare_egg', stage: 'retrieve' }, { t: 'say', lines: ['GRUNT: Argh! Fine, go through. But Team Rollback will not forget this!', 'You notice a stolen daycare egg near the grunt camp.'] }] },
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
        { t: 'setFlag', flag: 'fossilDelivered' },
        { t: 'questStart', quest: 'fossil' },
        { t: 'questAdvance', quest: 'fossil', stage: 'revive' },
        { t: 'say', lines: ['You hear the rumble of dredging equipment deeper in the cave.', 'Team Rollback is excavating something here...', 'A fossil sample lies near the dredging site! You pocket it carefully.', 'Take it to the museum curator in Tidewell for revival!'] },
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
            { t: 'questAdvance', quest: 'lighthouse', stage: 'restore' },
            { t: 'questComplete', quest: 'lighthouse' },
            { t: 'say', lines: ['KEEPER: You found the parts! Let me fix the lamp...', '... ... ...', 'The beacon shines once more! Ships can safely reach Tidewell now.'] },
          ],
          else: [
            { t: 'questStart', quest: 'lighthouse' },
            { t: 'questAdvance', quest: 'lighthouse', stage: 'parts' },
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
            { t: 'questAdvance', quest: 'berries', stage: 'deliver' },
            { t: 'giveItem', item: 'sitrusberry', count: 3 },
            { t: 'questComplete', quest: 'berries' },
            { t: 'say', lines: ['FARMER: You saved this season! Take these berries as thanks!'] },
          ],
          else: [
            { t: 'questStart', quest: 'berries' },
            { t: 'questAdvance', quest: 'berries', stage: 'collect' },
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
        { t: 'setFlag', flag: 'junoKidnapped' },
        { t: 'say', lines: ['Team Rollback grunts are chasing someone across the sky bridge!', 'It is Juno! Prof. Maple\'s assistant has been kidnapped!', 'The winds are fierce. You need to cross carefully!'] },
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
        { t: 'say', lines: ['You reached the other side! Juno is safe!', 'JUNO: Thank you! I was so scared. Team Rollback wanted me to lead them to Null Peak.', 'JUNO: I will head back to the lab and tell Prof. Maple everything. Be careful up ahead!'] },
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
        {
          t: 'if',
          flag: 'originonObtained',
          then: [{ t: 'say', lines: ['Originon resonates with the shrine, but it has already chosen you.'] }],
          else: [
            { t: 'giveMon', species: 'originon', level: 54 },
            { t: 'setFlag', flag: 'originonObtained' },
            { t: 'say', lines: ['Originon regards you with ancient eyes...', 'It has chosen to join you. You received an ORIGINON!', 'The first Mockemon ever recorded in the Ledger, now by your side.'] },
          ],
        },
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
  maple_postgame: [
    {
      t: 'if',
      flag: 'postGame',
      then: [
        {
          t: 'if',
          flag: 'dexReward40',
          then: [{ t: 'say', lines: ['MAPLE: You have caught every known Mockemon in the Mocca region!', 'That is a feat worthy of a true Champion. The Ledger is complete!'] }],
          else: [
            {
              t: 'if',
              flag: 'dexReward30',
              then: [{ t: 'say', lines: ['MAPLE: 30 species caught! Remarkable!', 'Keep exploring. The Ledger has more secrets to reveal.'] }],
              else: [
                {
                  t: 'if',
                  flag: 'dexReward20',
                  then: [
                    { t: 'setFlag', flag: 'dexReward30' },
                    { t: 'giveItem', item: 'safetysash', count: 1 },
                    { t: 'say', lines: ['MAPLE: You have caught 30 species! Incredible!', 'Take this Safety Sash. It could save your ace in a tight spot.'] },
                  ],
                  else: [
                    {
                      t: 'if',
                      flag: 'dexReward10',
                      then: [
                        { t: 'setFlag', flag: 'dexReward20' },
                        { t: 'giveItem', item: 'powerband', count: 1 },
                        { t: 'say', lines: ['MAPLE: 20 species caught! You are building a impressive MockDex.', 'Here, take this Power Band. It boosts Attack in a pinch!'] },
                      ],
                      else: [
                        { t: 'setFlag', flag: 'dexReward10' },
                        { t: 'giveItem', item: 'luckycharm', count: 1 },
                        { t: 'say', lines: ['MAPLE: Welcome back, Champion!', 'You have been recording data for the MockDex, I see.', '10 species caught already! Take this Lucky Charm. It boosts EXP earned by 50%.', 'Keep filling those pages. I have rewards for 20, 30, and even 40 species!'] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      else: [{ t: 'say', lines: ['MAPLE: Your journey is just beginning. Come back when you have made progress!'] }],
    },
  ],
  vc_grunt_extort: [
    {
      t: 'if',
      flag: 'vcGruntCleared',
      then: [],
      else: [
        { t: 'say', lines: ['A Team Rollback Grunt is blocking the Mock Center entrance!', 'GRUNT: This Center is now a Rollback facility. Healing costs double!'] },
        { t: 'battle', trainer: 'grunt_vc_1', onWin: [{ t: 'setFlag', flag: 'vcGruntCleared' }, { t: 'say', lines: ['GRUNT: Fine! The Center is yours again. Rollback retreats!', 'NURSE: Thank you for saving the Center! Please, heal your Mockemon anytime.'] }] },
      ],
    },
  ],
  bloomrest_ledger_buy: [
    {
      t: 'if',
      flag: 'ledgerBuyStopped',
      then: [{ t: 'say', lines: ['The official slinks away. The Ledger index is safe in Bloomrest.'] }],
      else: [
        { t: 'say', lines: ['A Rollback Agent is negotiating with a corrupt Bloomrest official.', 'AGENT: The Ledger index for 50,000? That is a fair price for a first draft.', 'OFFICIAL: It is a deal. The index will be yours by sunset...'] },
        { t: 'battle', trainer: 'grunt_ledger_1', onWin: [{ t: 'setFlag', flag: 'ledgerBuyStopped' }, { t: 'say', lines: ['AGENT: The deal is off! Retreating!', 'OFFICIAL: I... I was just doing business! Please, do not tell anyone.', 'The Ledger index has been saved from Team Rollback.'] }] },
      ],
    },
  ],
  daycare_egg_keeper: [
    {
      t: 'if',
      flag: 'daycareEggReturned',
      then: [{ t: 'say', lines: ['KEEPER: The egg is safe thanks to you. The daycare is open as always!'] }],
      else: [
        {
          t: 'if',
          flag: 'woodsGruntCleared',
          then: [
            { t: 'setFlag', flag: 'daycareEggReturned' },
            { t: 'questComplete', quest: 'daycare_egg' },
            { t: 'giveItem', item: 'luckycharm', count: 1 },
            { t: 'say', lines: ['KEEPER: You recovered the stolen egg! I cannot thank you enough.', 'Please, take this Lucky Charm as a reward. And the daycare is always open for you!'] },
          ],
          else: [
            { t: 'questStart', quest: 'daycare_egg' },
            { t: 'questAdvance', quest: 'daycare_egg', stage: 'report' },
            { t: 'say', lines: ['KEEPER: Oh no! A Team Rollback grunt stole one of our daycare eggs!', 'They fled into Verdant Woods. Please, can you get it back?'] },
          ],
        },
      ],
    },
  ],
  gauntlet_enter: [
    {
      t: 'if',
      flag: 'gauntletWon',
      then: [{ t: 'say', lines: ['REFEREE: You are the gauntlet champion! Come back anytime for a rematch!'] }],
      else: [
        { t: 'questStart', quest: 'gauntlet' },
        { t: 'questAdvance', quest: 'gauntlet', stage: 'streak' },
        { t: 'setFlag', flag: 'gauntletWon' },
        { t: 'questComplete', quest: 'gauntlet' },
        { t: 'giveItem', item: 'powerband', count: 1 },
        { t: 'say', lines: ['REFEREE: Welcome to the Voltmere Gauntlet!', 'Back-to-back battles against our toughest trainers!', '...You cleared every challenge! Impressive!', 'Take this Power Band as the gauntlet prize!'] },
      ],
    },
  ],
  kai_encounter_1: [
    {
      t: 'if',
      flag: 'kaiEnc1Won',
      then: [{ t: 'say', lines: ['KAI: One badge down, seven to go. Keep up!'] }],
      else: [
        { t: 'say', lines: ['KAI: Hey, you got a badge already? Not bad! But do not get cocky. Battle me!'] },
        { t: 'battle', trainer: 'rival_kai_1', onWin: [{ t: 'setFlag', flag: 'kaiEnc1Won' }, { t: 'say', lines: ['KAI: Okay, okay! You are tougher than you look. See you around!'] }] },
      ],
    },
  ],
  kai_encounter_2: [
    {
      t: 'if',
      flag: 'kaiEnc2Won',
      then: [{ t: 'say', lines: ['KAI: Three badges each. The race is on!'] }],
      else: [
        { t: 'say', lines: ['KAI: Three badges? I have three too! Let us see whose team grew stronger!'] },
        { t: 'battle', trainer: 'rival_kai_2', onWin: [{ t: 'setFlag', flag: 'kaiEnc2Won' }, { t: 'say', lines: ['KAI: You are pulling ahead! I need to train harder. Next time!'] }] },
      ],
    },
  ],
  kai_encounter_4: [
    {
      t: 'if',
      flag: 'kaiEnc4Won',
      then: [{ t: 'say', lines: ['KAI: Seven badges, same as me. Summit Null awaits us both!'] }],
      else: [
        { t: 'say', lines: ['KAI: Seven badges, same as me. The league is close. But first, let me test you!'] },
        { t: 'battle', trainer: 'rival_kai_4', onWin: [{ t: 'setFlag', flag: 'kaiEnc4Won' }, { t: 'say', lines: ['KAI: You are ready. The Victory Trail and Summit Null await. Do not lose before I get there!'] }] },
      ],
    },
  ],
  cave_lamp_parts: [
    {
      t: 'if',
      flag: 'lampParts',
      then: [],
      else: [
        { t: 'setFlag', flag: 'lampParts' },
        { t: 'say', lines: ['You found a pile of mechanical parts near the dredging equipment.', 'These look like they could fix a lighthouse lamp!', 'Take them to the lighthouse keeper in Tidewell!'] },
      ],
    },
  ],
  lost_nibbit_mom: [
    {
      t: 'if',
      flag: 'nibbitReturned',
      then: [{ t: 'say', lines: ['MOM: My little Nibbit is back home. Thank you again!'] }],
      else: [
        {
          t: 'if',
          flag: 'nibbitFound',
          then: [
            { t: 'setFlag', flag: 'nibbitReturned' },
            { t: 'questAdvance', quest: 'lost_nibbit', stage: 'return' },
            { t: 'questComplete', quest: 'lost_nibbit' },
            { t: 'giveItem', item: 'moonstone', count: 1 },
            { t: 'say', lines: ['MOM: You found my Nibbit! Thank you so much!', 'Please, take this Moon Stone as a reward!'] },
          ],
          else: [
            { t: 'questStart', quest: 'lost_nibbit' },
            { t: 'questAdvance', quest: 'lost_nibbit', stage: 'track' },
            { t: 'say', lines: ['MOM: My Nibbit ran off again! I think it headed toward Route 1.', 'Can you find it for me? It loves Oran Berries!'] },
          ],
        },
      ],
    },
  ],
  route1_nibbit_found: [
    {
      t: 'if',
      flag: 'nibbitFound',
      then: [],
      else: [
        { t: 'setFlag', flag: 'nibbitFound' },
        { t: 'say', lines: ['You found a Nibbit hiding in the tall grass!', 'It looks scared but seems to recognize you.', 'Better bring it back to its owner in Verdant City!'] },
      ],
    },
  ],
  route5_berry_collect: [
    {
      t: 'if',
      flag: 'berriesCollected',
      then: [],
      else: [
        { t: 'setFlag', flag: 'berriesCollected' },
        { t: 'say', lines: ['You found a patch of healthy berries untouched by pests!', 'You gather a handful. The berry farmer in Bloomrest will be pleased!'] },
      ],
    },
  ],
};
