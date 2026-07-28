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
};
