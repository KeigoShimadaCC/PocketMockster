import { ITEMS } from '../data/items';
import { SPECIES } from '../data/species';
import { PEOPLE } from '../sprites';
import { MAPS } from './maps';
import { SOLID_TILES, type GameMap } from './types';

export const KNOWN_TILES = new Set(['.', ',', 'G', 'T', 'W', 'R', 'B', 'D', 'S', 'w', 'F', 'C', 'M', 'P', 'o']);
const BASE_INVENTORY_ITEM_IDS = new Set(['mockball', 'potion', 'superpotion']);
const KNOWN_ITEM_IDS = new Set([...Object.keys(ITEMS), ...BASE_INVENTORY_ITEM_IDS]);

export interface ContentIssue {
  severity: 'error' | 'warn';
  where: string;
  message: string;
}

function inBounds(map: GameMap, x: number, y: number): boolean {
  if (y < 0 || y >= map.tiles.length) return false;
  const row = map.tiles[y];
  return x >= 0 && x < row.length;
}

function tileAt(map: GameMap, x: number, y: number): string {
  return map.tiles[y]?.[x] ?? '';
}

export function validateMaps(maps: Record<string, GameMap> = MAPS): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const npcIds = new Map<string, string>();
  const trainerIds = new Map<string, string>();
  const itemIds = new Map<string, string>();

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

      if (!PEOPLE[npc.spriteKey]) {
        issues.push({
          severity: 'error',
          where: npcWhere,
          message: `Unknown NPC spriteKey '${npc.spriteKey}'`,
        });
      }

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
        if (!SPECIES[partyMon.species]) {
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

      if (!KNOWN_ITEM_IDS.has(item.item)) {
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
      if (!SPECIES[encounter.species]) {
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
