import { describe, expect, it } from 'vitest';
import { decodeSave, encodeSave, sanitizeMon, SAVE_VERSION } from '../../src/save';
import { createMockemon } from '../../src/mockemon';
import { Game } from '../../src/game';
import { MOVES } from '../../src/data/moves';

function makeGame(): Game {
  return new Game(null as unknown as CanvasRenderingContext2D);
}

function validSave(): Record<string, unknown> {
  return {
    version: SAVE_VERSION,
    mapId: 'mapletown',
    px: 7,
    py: 9,
    party: [createMockemon('sproutle', 12)],
    money: 5000,
    badges: ['Boulder Badge'],
    flags: { starterChosen: true },
  };
}

describe('decodeSave', () => {
  it('round-trips a valid save', () => {
    const d = decodeSave(encodeSave(validSave() as never));
    expect(d).not.toBeNull();
    expect(d!.mapId).toBe('mapletown');
    expect(d!.money).toBe(5000);
    expect(d!.party).toHaveLength(1);
    expect(d!.party[0].species).toBe('sproutle');
    expect(d!.version).toBe(SAVE_VERSION);
  });

  it('rejects malformed JSON', () => {
    expect(decodeSave('{not json')).toBeNull();
    expect(decodeSave('null')).toBeNull();
    expect(decodeSave('42')).toBeNull();
  });

  it('rejects unknown maps and missing party', () => {
    expect(decodeSave(JSON.stringify({ ...validSave(), mapId: 'nowhere' }))).toBeNull();
    expect(decodeSave(JSON.stringify({ ...validSave(), party: 'oops' }))).toBeNull();
  });

  it('rejects a post-starter save whose party is unrepairable', () => {
    const d = { ...validSave(), party: [{ species: 'not_a_species', level: 5 }] };
    expect(decodeSave(JSON.stringify(d))).toBeNull();
  });

  it('accepts a pre-starter save with an empty party', () => {
    const d = { ...validSave(), party: [], flags: {} };
    expect(decodeSave(JSON.stringify(d))).not.toBeNull();
  });

  it('drops corrupt storage mons but keeps valid ones', () => {
    const d = { ...validSave(), storage: [{ species: 'ghost' }, createMockemon('nibbit', 4)] };
    const out = decodeSave(JSON.stringify(d));
    expect(out!.storage).toHaveLength(1);
    expect(out!.storage![0].species).toBe('nibbit');
  });

  it('clamps out-of-range numbers and drops unknown inventory items', () => {
    const d = {
      ...validSave(),
      money: -50,
      minute: 99999,
      px: 500,
      inventory: { potion: 3.7, masterball: 99, mockball: -2 },
    };
    const out = decodeSave(JSON.stringify(d))!;
    expect(out.money).toBe(0);
    expect(out.minute).toBe(1439);
    expect(out.px).toBeLessThan(500);
    expect(out.inventory).toEqual({ potion: 3, superpotion: 0, mockball: 0 });
  });

  it('resets an invalid heal point to the default', () => {
    const d = { ...validSave(), healPoint: { map: 'gone', x: 1, y: 1 } };
    const out = decodeSave(JSON.stringify(d))!;
    expect(out.healPoint).toEqual({ map: 'mapletown', x: 7, y: 9 });
  });

  it('migrates a v1 save without quests into a quest log', () => {
    const d = { ...validSave(), version: undefined, quests: undefined, flags: { starterChosen: true, gotBalls: true } };
    const out = decodeSave(JSON.stringify(d))!;
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.quests).toBeDefined();
    expect(out.quests!.parcel?.done).toBe(true);
    expect(out.quests!.main_journey).toBeDefined();
  });
});

describe('sanitizeMon', () => {
  it('rebuilds stats and clamps hp', () => {
    const raw = { ...createMockemon('cindercub', 10), hp: 9999, maxHp: -3 };
    const m = sanitizeMon(raw)!;
    expect(m.maxHp).toBeGreaterThan(0);
    expect(m.hp).toBeLessThanOrEqual(m.maxHp);
  });

  it('replaces invalid moves with the level-up learnset', () => {
    const raw = { ...createMockemon('puddlefin', 8), moves: [{ id: 'hyperbeam9000', pp: 5 }] };
    const m = sanitizeMon(raw)!;
    expect(m.moves.length).toBeGreaterThan(0);
    for (const ms of m.moves) expect(MOVES[ms.id]).toBeDefined();
  });

  it('rejects unknown species', () => {
    expect(sanitizeMon({ species: 'missingno', level: 5 })).toBeNull();
    expect(sanitizeMon(null)).toBeNull();
    expect(sanitizeMon('sproutle')).toBeNull();
  });

  it('nulls invalid status and held item', () => {
    const raw = { ...createMockemon('nibbit', 5), status: 'CURSED', heldItem: 'masterball' };
    const m = sanitizeMon(raw as never)!;
    expect(m.status).toBeNull();
    expect(m.heldItem).toBeNull();
  });
});

describe('Game.newGame reset', () => {
  it('clears all run state left over from a previous session', () => {
    const g = makeGame();
    g.money = 99999;
    g.badges = ['Boulder Badge', 'Silk Badge'];
    g.flags = { starterChosen: true, rivalBeaten: true };
    g.inventory = { potion: 55, superpotion: 3, mockball: 9 };
    g.party = [createMockemon('sproutle', 40)];
    g.storage = [createMockemon('nibbit', 7)];
    g.defeatedTrainers.add('trainer_ben');
    g.collectedItems.add('r1_potion1');
    g.seenSpecies.add('sproutle');
    g.caughtSpecies.add('sproutle');
    g.daycare = [createMockemon('fluffowl', 9), null];
    g.playFrames = 12345;
    g.endingShown = true;

    g.newGame();

    expect(g.money).toBe(3000);
    expect(g.badges).toEqual([]);
    expect(g.flags).toEqual({});
    expect(g.inventory).toEqual({ potion: 0, superpotion: 0, mockball: 0 });
    expect(g.party).toEqual([]);
    expect(g.storage).toEqual([]);
    expect(g.defeatedTrainers.size).toBe(0);
    expect(g.collectedItems.size).toBe(0);
    expect(g.seenSpecies.size).toBe(0);
    expect(g.caughtSpecies.size).toBe(0);
    expect(g.daycare).toEqual([null, null]);
    expect(g.playFrames).toBe(0);
    expect(g.endingShown).toBe(false);
    expect(g.quests.active()).toEqual([]);
    expect(g.mapId).toBe('lab');
    expect(g.mode).toBe('dialogue'); // intro dialogue is queued
  });
});
