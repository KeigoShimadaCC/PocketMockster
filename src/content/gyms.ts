import type { MType } from '../data/types';

export interface GymDef {
  n: number;
  mapId: string;
  town: string;
  townName: string;
  leaderId: string;
  leaderName: string;
  type: MType;
  badge: string;
  badgeFlag: string;
  cap: number;
  questStage: string; // main_journey stage completed by winning here
  nextHint: string;
}

export const GYMS: GymDef[] = [
  {
    n: 1, mapId: 'gym', town: 'verdantcity', townName: 'Verdant City',
    leaderId: 'leader_terra', leaderName: 'Terra', type: 'Rock',
    badge: 'Boulder Badge', badgeFlag: 'badge_boulder', cap: 14, questStage: 'badge2',
    nextHint: 'Verdant Woods leads north to Thornbury and Leader Weave.',
  },
  {
    n: 2, mapId: 'gym2', town: 'thornbury', townName: 'Thornbury',
    leaderId: 'leader_weave', leaderName: 'Weave', type: 'Bug',
    badge: 'Silk Badge', badgeFlag: 'badge_silk', cap: 18, questStage: 'badge3',
    nextHint: 'Route 3 and Seaside Cave lead to Tidewell Town.',
  },
  {
    n: 3, mapId: 'gym3', town: 'tidewell', townName: 'Tidewell Town',
    leaderId: 'leader_nerin', leaderName: 'Nerin', type: 'Water',
    badge: 'Tide Badge', badgeFlag: 'badge_tide', cap: 24, questStage: 'badge4',
    nextHint: 'The Tide Badge lets you wade shallow water. Route 4 leads to Voltmere City.',
  },
  {
    n: 4, mapId: 'gym4', town: 'voltmere', townName: 'Voltmere City',
    leaderId: 'leader_dyna', leaderName: 'Dyna', type: 'Electric',
    badge: 'Surge Badge', badgeFlag: 'badge_surge', cap: 30, questStage: 'badge5',
    nextHint: 'Route 5 climbs to Bloomrest.',
  },
  {
    n: 5, mapId: 'gym5', town: 'bloomrest', townName: 'Bloomrest',
    leaderId: 'leader_fern', leaderName: 'Fern', type: 'Grass',
    badge: 'Bloom Badge', badgeFlag: 'badge_bloom', cap: 35, questStage: 'badge6',
    nextHint: 'Route 6 crosses the ash flats to Cinderwake.',
  },
  {
    n: 6, mapId: 'gym6', town: 'cinderwake', townName: 'Cinderwake',
    leaderId: 'leader_pyra', leaderName: 'Pyra', type: 'Fire',
    badge: 'Ember Badge', badgeFlag: 'badge_ember', cap: 40, questStage: 'badge7',
    nextHint: 'Route 7 switchbacks up to Zephyr Heights.',
  },
  {
    n: 7, mapId: 'gym7', town: 'zephyrheights', townName: 'Zephyr Heights',
    leaderId: 'leader_aeris', leaderName: 'Aeris', type: 'Flying',
    badge: 'Gale Badge', badgeFlag: 'badge_gale', cap: 45, questStage: 'badge8',
    nextHint: 'Route 8 runs east to Somnium Town.',
  },
  {
    n: 8, mapId: 'gym8', town: 'somnium', townName: 'Somnium Town',
    leaderId: 'leader_mira', leaderName: 'Mira', type: 'Psychic',
    badge: 'Dream Badge', badgeFlag: 'badge_dream', cap: 50, questStage: 'nullpeak',
    nextHint: 'The Observatory holds the coordinates of Null Peak.',
  },
];

export const GYM_BY_LEADER: Record<string, GymDef> = Object.fromEntries(
  GYMS.map((g) => [g.leaderId, g]),
);

export function badgeCap(badgeCount: number): number {
  return GYMS[Math.min(badgeCount, GYMS.length - 1)].cap;
}
