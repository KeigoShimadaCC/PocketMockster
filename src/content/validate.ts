import { ITEMS } from '../data/items';
import { SPECIES } from '../data/species';
import type { ScriptCmd } from '../script';
import { PEOPLE } from '../sprites';
import { MAPS } from './maps';
import { QUESTS } from './quests';
import { SCRIPTS } from './scripts';
import { TRAINERS } from './trainers';
import { SHALLOW_TILE, SOLID_TILES, type GameMap } from './types';

export const KNOWN_TILES = new Set([
  '.', ',', 'G', 'T', 'W', 'R', 'B', 'D', 'S', 'w', 'F', 'C', 'M', 'P', 'o',
  SHALLOW_TILE, 'x', '#', '_',
]);
const BASE_INVENTORY_ITEM_IDS = new Set(['mockball', 'potion', 'superpotion']);
const RUNTIME_GENERATED_FLAG_EXACT = new Set([
  'gymDone',
  'starterChosen',
  'rivalBeaten',
  'gotBalls',
  'hikerTraded',
  'leagueOpen',
  'championBeaten',
  'postGame',
  'nibbitFound',
  'elite1Beaten',
  'elite2Beaten',
  'elite3Beaten',
  'elite4Beaten',
  'championOpen',
  'nilBeaten',
  'patchBeaten',
  'mergeBeaten',
]);
const DOCUMENTED_NON_NPC_GIVERS = new Set([
  'prof_maple',
  'route1_hiker',
  'contest_clerk',
  'museum_curator',
  'lighthouse_keeper',
  'zephyr_courier',
]);

export interface ContentIssue {
  severity: 'error' | 'warn';
  where: string;
  message: string;
}

export interface ValidationSources {
  scripts?: Record<string, ScriptCmd[]>;
  trainers?: Record<string, unknown>;
  quests?: Record<
    string,
    {
      id: string;
      giver?: string;
      stages: { id: string }[];
      reward?: { item?: string; mon?: { species: string; level: number } };
    }
  >;
  items?: Record<string, unknown>;
  species?: Record<string, unknown>;
  people?: Record<string, unknown>;
}

function inBounds(map: GameMap, x: number, y: number): boolean {
  if (y < 0 || y >= map.tiles.length) return false;
  const row = map.tiles[y];
  return x >= 0 && x < row.length;
}

function tileAt(map: GameMap, x: number, y: number): string {
  return map.tiles[y]?.[x] ?? '';
}

function addIssue(
  issues: ContentIssue[],
  severity: ContentIssue['severity'],
  where: string,
  message: string,
): void {
  issues.push({ severity, where, message });
}

function addFlagUsage(store: Map<string, string>, flag: string, where: string): void {
  if (!flag.trim()) return;
  if (!store.has(flag)) store.set(flag, where);
}

function isRuntimeGeneratedFlag(flag: string): boolean {
  if (RUNTIME_GENERATED_FLAG_EXACT.has(flag)) return true;
  if (flag.startsWith('badge_')) return true;
  if (flag.startsWith('starter_')) return true;
  return /^gym\d+Done$/.test(flag);
}

function walkScriptCommands(
  cmds: ScriptCmd[],
  where: string,
  onVisit: (cmd: ScriptCmd, where: string) => void,
): void {
  for (let i = 0; i < cmds.length; i++) {
    const cmd = cmds[i];
    const cmdWhere = `${where}[${i}]`;
    onVisit(cmd, cmdWhere);
    switch (cmd.t) {
      case 'choice':
        for (let optionIndex = 0; optionIndex < cmd.options.length; optionIndex++) {
          const option = cmd.options[optionIndex];
          walkScriptCommands(option.then, `${cmdWhere}:option[${optionIndex}]`, onVisit);
        }
        if (cmd.onCancel) walkScriptCommands(cmd.onCancel, `${cmdWhere}:onCancel`, onVisit);
        break;
      case 'if':
      case 'ifHasItem':
      case 'ifQuest':
        walkScriptCommands(cmd.then, `${cmdWhere}:then`, onVisit);
        if (cmd.else) walkScriptCommands(cmd.else, `${cmdWhere}:else`, onVisit);
        break;
      case 'battle':
        if (cmd.onWin) walkScriptCommands(cmd.onWin, `${cmdWhere}:onWin`, onVisit);
        if (cmd.onLose) walkScriptCommands(cmd.onLose, `${cmdWhere}:onLose`, onVisit);
        break;
      default:
        break;
    }
  }
}

export function validateMaps(maps: Record<string, GameMap> = MAPS, sources: ValidationSources = {}): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const scripts = sources.scripts ?? SCRIPTS;
  const trainers = sources.trainers ?? TRAINERS;
  const quests = sources.quests ?? QUESTS;
  const items = sources.items ?? ITEMS;
  const species = sources.species ?? SPECIES;
  const people = sources.people ?? PEOPLE;
  const knownItemIds = new Set([...Object.keys(items), ...BASE_INVENTORY_ITEM_IDS]);
  const npcIds = new Map<string, string>();
  const trainerIds = new Map<string, string>();
  const itemIds = new Map<string, string>();
  const setFlags = new Map<string, string>();
  const readFlags = new Map<string, string>();

  for (const solidTile of SOLID_TILES) {
    if (!KNOWN_TILES.has(solidTile)) {
      issues.push({
        severity: 'warn',
        where: 'SOLID_TILES',
        message: `Solid tile '${solidTile}' is not in KNOWN_TILES`,
      });
    }
  }

  for (const [mapKey, map] of Object.entries(maps)) {
    if (map.id !== mapKey) {
      issues.push({
        severity: 'error',
        where: `map:${mapKey}`,
        message: `Map id mismatch: expected '${mapKey}' but got '${map.id}'`,
      });
    }

    if (map.tiles.length === 0) {
      issues.push({
        severity: 'error',
        where: `map:${mapKey}`,
        message: 'Map tiles must not be empty',
      });
    }

    const width = map.tiles[0]?.length ?? 0;
    for (let y = 0; y < map.tiles.length; y++) {
      const row = map.tiles[y];
      if (row.length !== width) {
        issues.push({
          severity: 'error',
          where: `map:${mapKey}:tiles[${y}]`,
          message: `Map tiles are ragged: expected width ${width} but got ${row.length}`,
        });
      }
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (!KNOWN_TILES.has(ch)) {
          issues.push({
            severity: 'error',
            where: `map:${mapKey}:tile(${x},${y})`,
            message: `Unknown tile '${ch}'`,
          });
        }
      }
    }

    for (const warp of map.warps) {
      if (!inBounds(map, warp.x, warp.y)) {
        issues.push({
          severity: 'error',
          where: `map:${mapKey}:warp(${warp.x},${warp.y})`,
          message: 'Warp origin is out of bounds',
        });
      }
      const destination = maps[warp.to];
      if (!destination) {
        issues.push({
          severity: 'error',
          where: `map:${mapKey}:warp(${warp.x},${warp.y})`,
          message: `Warp target map '${warp.to}' does not exist`,
        });
        continue;
      }
      if (!inBounds(destination, warp.tx, warp.ty)) {
        issues.push({
          severity: 'error',
          where: `map:${mapKey}:warp(${warp.x},${warp.y})`,
          message: `Warp destination (${warp.tx},${warp.ty}) is out of bounds in map '${warp.to}'`,
        });
        continue;
      }
      const destinationTile = tileAt(destination, warp.tx, warp.ty);
      if (SOLID_TILES.has(destinationTile)) {
        issues.push({
          severity: 'error',
          where: `map:${mapKey}:warp(${warp.x},${warp.y})`,
          message: `Warp destination (${warp.tx},${warp.ty}) in map '${warp.to}' is on solid tile '${destinationTile}'`,
        });
      }
    }

    for (const npc of map.npcs) {
      const npcWhere = `map:${mapKey}:npc:${npc.id}`;
      if (!inBounds(map, npc.x, npc.y)) {
        issues.push({
          severity: 'error',
          where: npcWhere,
          message: 'NPC position is out of bounds',
        });
      } else {
        const tile = tileAt(map, npc.x, npc.y);
        if (SOLID_TILES.has(tile)) {
          issues.push({
            severity: 'error',
            where: npcWhere,
            message: `NPC is on solid tile '${tile}'`,
          });
        }
      }

      if (npcIds.has(npc.id)) {
        issues.push({
          severity: 'error',
          where: npcWhere,
          message: `Duplicate NPC id '${npc.id}' also used at ${npcIds.get(npc.id)}`,
        });
      } else {
        npcIds.set(npc.id, npcWhere);
      }

      if (!people[npc.spriteKey]) {
        issues.push({
          severity: 'error',
          where: npcWhere,
          message: `Unknown NPC spriteKey '${npc.spriteKey}'`,
        });
      }
      if (npc.hiddenUntilFlag) addFlagUsage(readFlags, npc.hiddenUntilFlag, `${npcWhere}:hiddenUntilFlag`);
      if (npc.hiddenAfterFlag) addFlagUsage(readFlags, npc.hiddenAfterFlag, `${npcWhere}:hiddenAfterFlag`);

      const trainer = npc.trainer;
      if (!trainer) continue;

      const trainerWhere = `${npcWhere}:trainer:${trainer.id}`;
      if (trainerIds.has(trainer.id)) {
        issues.push({
          severity: 'error',
          where: trainerWhere,
          message: `Duplicate trainer id '${trainer.id}' also used at ${trainerIds.get(trainer.id)}`,
        });
      } else {
        trainerIds.set(trainer.id, trainerWhere);
      }

      if (trainer.party.length === 0) {
        issues.push({
          severity: 'error',
          where: trainerWhere,
          message: 'Trainer party must not be empty',
        });
      }
      for (const partyMon of trainer.party) {
        if (!species[partyMon.species]) {
          issues.push({
            severity: 'error',
            where: trainerWhere,
            message: `Unknown trainer party species '${partyMon.species}'`,
          });
        }
        if (partyMon.level < 1 || partyMon.level > 100) {
          issues.push({
            severity: 'error',
            where: trainerWhere,
            message: `Trainer party level ${partyMon.level} is outside 1..100`,
          });
        }
      }

      if (trainer.prize < 0) {
        issues.push({
          severity: 'error',
          where: trainerWhere,
          message: `Trainer prize ${trainer.prize} must be >= 0`,
        });
      }

      if (trainer.sight !== undefined && (trainer.sight < 0 || trainer.sight > 8)) {
        issues.push({
          severity: 'error',
          where: trainerWhere,
          message: `Trainer sight ${trainer.sight} is outside 0..8`,
        });
      }
    }

    for (const item of map.items) {
      const itemWhere = `map:${mapKey}:item:${item.id}`;
      if (!inBounds(map, item.x, item.y)) {
        issues.push({
          severity: 'error',
          where: itemWhere,
          message: 'Ground item position is out of bounds',
        });
      }

      if (itemIds.has(item.id)) {
        issues.push({
          severity: 'error',
          where: itemWhere,
          message: `Duplicate ground item id '${item.id}' also used at ${itemIds.get(item.id)}`,
        });
      } else {
        itemIds.set(item.id, itemWhere);
      }

      if (!knownItemIds.has(item.item)) {
        issues.push({
          severity: 'error',
          where: itemWhere,
          message: `Unknown ground item '${item.item}'`,
        });
      }
    }

    for (let i = 0; i < map.signs.length; i++) {
      const sign = map.signs[i];
      if (!inBounds(map, sign.x, sign.y)) {
        issues.push({
          severity: 'error',
          where: `map:${mapKey}:sign[${i}]`,
          message: 'Sign position is out of bounds',
        });
      }
    }

    for (let i = 0; i < map.lockedDoors.length; i++) {
      const door = map.lockedDoors[i];
      if (!inBounds(map, door.x, door.y)) {
        issues.push({
          severity: 'error',
          where: `map:${mapKey}:lockedDoor[${i}]`,
          message: 'Locked door position is out of bounds',
        });
      }
    }

    for (const encounter of map.encounters) {
      const encounterWhere = `map:${mapKey}:encounter:${encounter.species}`;
      if (!species[encounter.species]) {
        issues.push({
          severity: 'error',
          where: encounterWhere,
          message: `Unknown encounter species '${encounter.species}'`,
        });
      }
      if (encounter.minLv > encounter.maxLv) {
        issues.push({
          severity: 'error',
          where: encounterWhere,
          message: `Encounter level range is invalid: minLv ${encounter.minLv} > maxLv ${encounter.maxLv}`,
        });
      }
      if (encounter.minLv < 1 || encounter.minLv > 100) {
        issues.push({
          severity: 'error',
          where: encounterWhere,
          message: `Encounter minLv ${encounter.minLv} is outside 1..100`,
        });
      }
      if (encounter.maxLv < 1 || encounter.maxLv > 100) {
        issues.push({
          severity: 'error',
          where: encounterWhere,
          message: `Encounter maxLv ${encounter.maxLv} is outside 1..100`,
        });
      }
      if (encounter.weight <= 0) {
        issues.push({
          severity: 'error',
          where: encounterWhere,
          message: `Encounter weight ${encounter.weight} must be > 0`,
        });
      }
      if (encounter.nightWeight !== undefined && encounter.nightWeight <= 0) {
        issues.push({
          severity: 'error',
          where: encounterWhere,
          message: `Encounter nightWeight ${encounter.nightWeight} must be > 0`,
        });
      }
    }

    for (const [kind, list] of [
      ['gate', map.gates ?? []],
      ['button', map.buttons ?? []],
      ['oneWay', map.oneWay ?? []],
      ['pad', map.pads ?? []],
    ] as const) {
      for (const entry of list) {
        const where = `map:${mapKey}:${kind}(${entry.x},${entry.y})`;
        if (!inBounds(map, entry.x, entry.y)) {
          issues.push({ severity: 'error', where, message: `${kind} position is out of bounds` });
          continue;
        }
        const tile = tileAt(map, entry.x, entry.y);
        if (SOLID_TILES.has(tile)) {
          issues.push({
            severity: 'error',
            where,
            message: `${kind} sits on solid tile '${tile}', so it can never be used`,
          });
        }
        if (kind === 'pad' && 'tx' in entry && !inBounds(map, entry.tx, entry.ty)) {
          issues.push({ severity: 'error', where, message: 'Pad destination is out of bounds' });
        }
      }
    }

    const gateFlags = new Set((map.gates ?? []).map((g) => g.flag));
    for (const gate of map.gates ?? []) addFlagUsage(readFlags, gate.flag, `map:${mapKey}:gate(${gate.x},${gate.y})`);
    for (const button of map.buttons ?? []) {
      addFlagUsage(setFlags, button.flag, `map:${mapKey}:button(${button.x},${button.y})`);
      if (!gateFlags.has(button.flag) && !button.text) {
        issues.push({
          severity: 'warn',
          where: `map:${mapKey}:button(${button.x},${button.y})`,
          message: `Button flag '${button.flag}' opens no gate on this map`,
        });
      }
    }

    const hasWindTiles = map.tiles.some((row) => row.includes('#'));
    if (hasWindTiles && !map.windDir) {
      issues.push({
        severity: 'error',
        where: `map:${mapKey}`,
        message: "Map has '#' wind tiles but no windDir",
      });
    }
    if (map.windDir && !hasWindTiles) {
      issues.push({
        severity: 'warn',
        where: `map:${mapKey}`,
        message: "Map sets windDir but has no '#' tiles",
      });
    }
    const hasLava = map.tiles.some((row) => row.includes('x'));
    if (hasLava && !map.lavaPeriod) {
      issues.push({
        severity: 'error',
        where: `map:${mapKey}`,
        message: "Map has 'x' lava tiles but no lavaPeriod, so they stay passable forever",
      });
    }

    for (const npc of map.npcs) {
      if (npc.script && !scripts[npc.script]) {
        issues.push({
          severity: 'error',
          where: `map:${mapKey}:npc:${npc.id}`,
          message: `NPC references unknown script '${npc.script}'`,
        });
      }
    }
    for (const event of [...(map.events ?? []), ...(map.onEnter ? [map.onEnter] : [])]) {
      const where = `map:${mapKey}:event(${event.x},${event.y})`;
      if (!scripts[event.script]) {
        issues.push({ severity: 'error', where, message: `Event references unknown script '${event.script}'` });
      }
      if (event.once) addFlagUsage(setFlags, event.once, `${where}:once`);
      if (map.events?.includes(event) && !inBounds(map, event.x, event.y)) {
        issues.push({ severity: 'error', where, message: 'Event position is out of bounds' });
      }
    }

    const hasTallGrass = map.tiles.some((row) => row.includes('G'));
    if (map.encounterRate > 0 && !hasTallGrass) {
      issues.push({
        severity: 'error',
        where: `map:${mapKey}`,
        message: "Encounter rate is > 0 but map has no 'G' tiles",
      });
    }
    if (hasTallGrass && map.encounters.length === 0) {
      issues.push({
        severity: 'warn',
        where: `map:${mapKey}`,
        message: "Map has 'G' tiles but encounter table is empty",
      });
    }
  }

  const questById = new Map(Object.values(quests).map((quest) => [quest.id, quest]));

  for (const [scriptId, cmds] of Object.entries(scripts)) {
    walkScriptCommands(cmds, `script:${scriptId}`, (cmd, where) => {
      switch (cmd.t) {
        case 'battle':
          if (!trainers[cmd.trainer]) {
            addIssue(issues, 'error', where, `Unknown battle trainer '${cmd.trainer}'`);
          }
          break;
        case 'giveMon':
          if (!species[cmd.species]) {
            addIssue(issues, 'error', where, `Unknown species '${cmd.species}' in giveMon`);
          }
          if (cmd.level < 1 || cmd.level > 100) {
            addIssue(issues, 'error', where, `giveMon level ${cmd.level} is outside 1..100`);
          }
          break;
        case 'giveEgg':
          if (!species[cmd.species]) {
            addIssue(issues, 'error', where, `Unknown species '${cmd.species}' in giveEgg`);
          }
          break;
        case 'giveItem':
        case 'takeItem':
          if (!knownItemIds.has(cmd.item)) {
            addIssue(issues, 'error', where, `Unknown item '${cmd.item}' in ${cmd.t}`);
          }
          break;
        case 'shop':
          for (const itemId of cmd.stock ?? []) {
            if (!knownItemIds.has(itemId)) {
              addIssue(issues, 'error', where, `Unknown shop stock item '${itemId}'`);
            }
          }
          break;
        case 'warp': {
          const map = maps[cmd.map];
          if (!map) {
            addIssue(issues, 'error', where, `Unknown warp target map '${cmd.map}'`);
            break;
          }
          if (!inBounds(map, cmd.x, cmd.y)) {
            addIssue(issues, 'error', where, `Warp destination (${cmd.x},${cmd.y}) is out of bounds in map '${cmd.map}'`);
            break;
          }
          const tile = tileAt(map, cmd.x, cmd.y);
          if (SOLID_TILES.has(tile)) {
            addIssue(issues, 'error', where, `Warp destination (${cmd.x},${cmd.y}) in map '${cmd.map}' is on solid tile '${tile}'`);
          }
          break;
        }
        case 'questStart':
        case 'questComplete':
        case 'questAdvance':
        case 'ifQuest': {
          const quest = questById.get(cmd.quest);
          if (!quest) {
            addIssue(issues, 'error', where, `Unknown quest '${cmd.quest}' in ${cmd.t}`);
            break;
          }
          if (
            (cmd.t === 'ifQuest' || cmd.t === 'questAdvance') &&
            cmd.stage !== undefined &&
            !quest.stages.some((stage) => stage.id === cmd.stage)
          ) {
            addIssue(issues, 'error', where, `Unknown stage '${cmd.stage}' for quest '${cmd.quest}' in ${cmd.t}`);
          }
          break;
        }
        case 'setFlag':
          addFlagUsage(setFlags, cmd.flag, where);
          break;
        case 'if':
          addFlagUsage(readFlags, cmd.flag, where);
          break;
        default:
          break;
      }
    });
  }

  for (const quest of Object.values(quests)) {
    if (quest.giver && !npcIds.has(quest.giver) && !DOCUMENTED_NON_NPC_GIVERS.has(quest.giver)) {
      addIssue(
        issues,
        'warn',
        `quest:${quest.id}:giver`,
        `Quest giver '${quest.giver}' does not match any NPC id`,
      );
    }

    const reward = quest.reward;
    if (!reward) continue;
    if (reward.item && !knownItemIds.has(reward.item)) {
      addIssue(issues, 'error', `quest:${quest.id}:reward`, `Unknown reward item '${reward.item}'`);
    }
    if (reward.mon) {
      if (!species[reward.mon.species]) {
        addIssue(
          issues,
          'error',
          `quest:${quest.id}:reward`,
          `Unknown reward mon species '${reward.mon.species}'`,
        );
      }
      if (reward.mon.level < 1 || reward.mon.level > 100) {
        addIssue(
          issues,
          'error',
          `quest:${quest.id}:reward`,
          `Reward mon level ${reward.mon.level} is outside 1..100`,
        );
      }
    }
  }

  for (const [flag, where] of readFlags) {
    if (setFlags.has(flag) || isRuntimeGeneratedFlag(flag)) continue;
    addIssue(issues, 'warn', where, `Flag '${flag}' is read but never set by scripts, map buttons, or events`);
  }

  if (!maps.mapletown) {
    issues.push({
      severity: 'error',
      where: 'maps',
      message: "Missing required start map 'mapletown'",
    });
    return issues;
  }

  const visited = new Set<string>();
  const queue = ['mapletown'];
  visited.add('mapletown');

  while (queue.length > 0) {
    const currentKey = queue.shift()!;
    const currentMap = maps[currentKey];
    if (!currentMap) continue;
    for (const warp of currentMap.warps) {
      if (!maps[warp.to] || visited.has(warp.to)) continue;
      visited.add(warp.to);
      queue.push(warp.to);
    }
  }

  for (const mapKey of Object.keys(maps)) {
    if (!visited.has(mapKey)) {
      issues.push({
        severity: 'error',
        where: `map:${mapKey}`,
        message: "Map is unreachable from 'mapletown'",
      });
    }
  }

  return issues;
}
