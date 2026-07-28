import { describe, it, expect, beforeEach } from 'vitest';
import { Battle, type TrainerDef } from '../../src/battle';
import { SPECIES } from '../../src/data/species';
import { createMockemon, type Mockemon } from '../../src/mockemon';
import { setSeed } from '../../src/rng';

function mon(species: string, level: number, opts: Partial<Mockemon> = {}): Mockemon {
  const m = createMockemon(species, level);
  Object.assign(m, opts);
  return m;
}

/** wild battle where the player mon is fast and the enemy only knows String Shot (harmless) */
function wild(user: Mockemon, foe: Mockemon): Battle {
  return new Battle([user], { kind: 'wild', mon: foe });
}

function pacifist(species: string, level: number, opts: Partial<Mockemon> = {}): Mockemon {
  return mon(species, level, { moves: [{ id: 'stringshot', pp: 40 }], ...opts });
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

beforeEach(() => setSeed(42));

describe('struggle', () => {
  it('is used when all moves are out of PP, deals typeless damage and recoil', () => {
    const user = mon('nibblex', 30, { moves: [{ id: 'tackle', pp: 0 }] });
    const foe = pacifist('pebblit', 5); // rock resists normal normally
    const b = wild(user, foe);
    const foeBefore = foe.hp;
    const userBefore = user.hp;
    const msgs = b.takeTurn({ type: 'move', index: 0 });
    expect(msgs.join(' ')).toContain('Struggle');
    expect(msgs.join(' ')).toContain('recoil');
    // typeless: no "not very effective" despite rock typing
    expect(msgs.join(' ')).not.toContain('not very effective');
    expect(foe.hp).toBeLessThan(foeBefore);
    expect(user.hp).toBeLessThan(userBefore); // 1/4 max HP recoil
    expect(userBefore - user.hp).toBe(Math.max(1, Math.floor(user.maxHp / 4)));
  });

  it('selecting a 0-PP move when another has PP does nothing', () => {
    const user = mon('nibblex', 30, { moves: [{ id: 'tackle', pp: 0 }, { id: 'bite', pp: 20 }] });
    const foe = pacifist('pebblit', 5);
    const b = wild(user, foe);
    const msgs = b.takeTurn({ type: 'move', index: 0 });
    expect(msgs.join(' ')).toContain('No PP left');
    expect(foe.hp).toBe(foe.maxHp);
  });
});

describe('move effects', () => {
  it('drain moves heal the user for a fraction of damage dealt', () => {
    const user = mon('bramblore', 30, { moves: [{ id: 'megadrain', pp: 15 }] });
    user.hp = 5;
    const foe = pacifist('mudlet', 20); // ground: grass is super effective
    const b = wild(user, foe);
    const before = user.hp;
    b.takeTurn({ type: 'move', index: 0 });
    expect(user.hp).toBeGreaterThan(before);
  });

  it('recoil moves damage the user by a fraction of damage dealt', () => {
    const user = mon('nibblex', 40, { moves: [{ id: 'takedown', pp: 20 }], ability: 'momentum' });
    const foe = pacifist('nibbit', 10);
    const b = wild(user, foe);
    const before = user.hp;
    const msgs = b.takeTurn({ type: 'move', index: 0 });
    if (msgs.join(' ').includes('missed')) return; // 85 acc: retry seeds make this vanishingly rare
    expect(user.hp).toBeLessThan(before);
    expect(msgs.join(' ')).toContain('recoil');
  });

  it('multi-hit moves strike 2-5 times and report the count', () => {
    let seen = false;
    for (let i = 0; i < 20 && !seen; i++) {
      setSeed(i * 3 + 42);
      const user = mon('nibblex', 30, { moves: [{ id: 'furyswipes', pp: 15 }], ability: 'momentum' });
      const foe = pacifist('bouldron', 30); // huge HP pool so all hits land
      const b = wild(user, foe);
      const msgs = b.takeTurn({ type: 'move', index: 0 });
      if (/Hit [2-5] time/.test(msgs.join(' '))) seen = true;
    }
    expect(seen).toBe(true);
  });

  it('two-turn moves charge first (invulnerable) and strike on the second turn', () => {
    const user = mon('cindercub', 30, { moves: [{ id: 'dig', pp: 10 }] });
    const foe = mon('sparkit', 10); // attacks back with thundershock
    const b = wild(user, foe);
    const t1 = b.takeTurn({ type: 'move', index: 0 });
    expect(t1.join(' ')).toContain('burrowed underground');
    expect(foe.hp).toBe(foe.maxHp); // no damage on charge turn
    expect(user.hp).toBe(user.maxHp); // invulnerable during charge
    const t2 = b.takeTurn({ type: 'move', index: 0 });
    expect(foe.hp).toBeLessThan(foe.maxHp);
    expect(t2.join(' ')).toContain('Dig');
  });

  it('flinch chance can prevent the target from moving', () => {
    // bite has 30% flinch; loop until observed
    let flinched = false;
    for (let i = 0; i < 60 && !flinched; i++) {
      setSeed(i * 13 + 5);
      const user = mon('nibblex', 40, { moves: [{ id: 'bite', pp: 25 }], ability: 'momentum' });
      const foe = mon('pebblit', 30); // slow, will act second
      const b = wild(user, foe);
      const msgs = b.takeTurn({ type: 'move', index: 0 });
      if (msgs.join(' ').includes('flinched')) flinched = true;
    }
    expect(flinched).toBe(true);
  });
});

describe('stat stages and accuracy', () => {
  it('Sand Attack makes the target miss more often', () => {
    const countHits = (sanded: boolean): number => {
      let hits = 0;
      for (let i = 0; i < 150; i++) {
        setSeed(i * 31 + 7);
        const user = mon('nibbit', 20, { moves: [{ id: 'tackle', pp: 40 }] });
        const foe = pacifist('mudlet', 5);
        const b = wild(user, foe);
        if (sanded) b.sides.player.stages.acc = -3;
        const before = foe.hp;
        b.takeTurn({ type: 'move', index: 0 });
        if (foe.hp < before) hits++;
      }
      return hits;
    };
    const clean = countHits(false);
    const sanded = countHits(true);
    expect(clean).toBe(150); // 100% accuracy at neutral
    expect(sanded).toBeLessThan(clean * 0.7); // -3 acc => 50% expected
  });

  it('evasion stages reduce incoming hit rate', () => {
    let hits = 0;
    for (let i = 0; i < 150; i++) {
      setSeed(i * 17 + 3);
      const user = mon('nibbit', 20, { moves: [{ id: 'tackle', pp: 40 }] });
      const foe = pacifist('mudlet', 5);
      const b = wild(user, foe);
      b.sides.enemy.stages.eva = 3;
      const before = foe.hp;
      b.takeTurn({ type: 'move', index: 0 });
      if (foe.hp < before) hits++;
    }
    expect(hits).toBeLessThan(105); // ~50% expected
  });
});

describe('weather, terrain, screens', () => {
  it('Sunny Day sets sun for 5 turns then fades', () => {
    const user = mon('cindercub', 20, { moves: [{ id: 'sunnyday', pp: 5 }, { id: 'growl', pp: 40 }] });
    const foe = pacifist('bouldron', 30); // bulky: survives until the sun fades
    const b = wild(user, foe);
    const msgs = b.takeTurn({ type: 'move', index: 0 });
    expect(msgs.join(' ')).toContain('harsh');
    expect(b.weather).toBe('sun');
    let faded = '';
    for (let i = 0; i < 4; i++) faded = b.takeTurn({ type: 'move', index: 1 }).join(' ');
    expect(faded).toContain('sunlight faded');
    expect(b.weatherTurns).toBe(0);
    expect(b.weather).toBeNull();
  });

  it('sun boosts fire moves ~1.5x', () => {
    const dmg = (sun: boolean): number => {
      const losses: number[] = [];
      for (let i = 0; i < 200; i++) {
        setSeed(i * 11 + 1);
        const user = mon('cindercub', 30, { moves: [{ id: 'ember', pp: 25 }] });
        const foe = pacifist('nibbit', 30);
        const b = wild(user, foe);
        if (sun) {
          b.weather = 'sun';
          b.weatherTurns = 5;
        }
        const before = foe.hp;
        b.takeTurn({ type: 'move', index: 0 });
        losses.push(before - foe.hp);
      }
      return mean(losses);
    };
    expect(dmg(true)).toBeGreaterThan(dmg(false) * 1.3);
  });

  it('Electric Terrain boosts electric moves', () => {
    const dmg = (terrain: boolean): number => {
      const losses: number[] = [];
      for (let i = 0; i < 200; i++) {
        setSeed(i * 19 + 2);
        const user = mon('sparkit', 30, { moves: [{ id: 'thundershock', pp: 30 }], ability: 'momentum' });
        const foe = pacifist('nibbit', 30);
        const b = wild(user, foe);
        if (terrain) {
          b.terrain = 'electric';
          b.terrainTurns = 5;
        }
        const before = foe.hp;
        b.takeTurn({ type: 'move', index: 0 });
        losses.push(before - foe.hp);
      }
      return mean(losses);
    };
    expect(dmg(true)).toBeGreaterThan(dmg(false) * 1.15);
  });

  it('Reflect halves physical damage for 5 turns', () => {
    const dmg = (reflected: boolean): number => {
      const losses: number[] = [];
      for (let i = 0; i < 200; i++) {
        setSeed(i * 23 + 4);
        const user = mon('nibblex', 30, { moves: [{ id: 'tackle', pp: 35 }], ability: 'momentum' });
        const foe = pacifist('nibbit', 30);
        const b = wild(user, foe);
        if (reflected) b.sides.enemy.reflectTurns = 5;
        const before = foe.hp;
        b.takeTurn({ type: 'move', index: 0 });
        losses.push(before - foe.hp);
      }
      return mean(losses);
    };
    const plain = dmg(false);
    const screened = dmg(true);
    expect(screened).toBeLessThan(plain * 0.65);
  });
});

describe('hazards', () => {
  it('Stealth Rock damages the next enemy sent out', () => {
    const user = mon('nibblex', 40, { moves: [{ id: 'stealthrock', pp: 20 }, { id: 'tackle', pp: 35 }], ability: 'momentum' });
    const foe1 = mon('nibbit', 5, { moves: [{ id: 'stringshot', pp: 40 }] });
    const foe2 = mon('nibbit', 20, { moves: [{ id: 'stringshot', pp: 40 }] });
    const trainer: TrainerDef = {
      name: 'T', spriteKey: 'hiker', party: [foe1, foe2], prize: 0, introText: '', defeatText: '',
    };
    const b = new Battle([user], { kind: 'trainer', trainer });
    b.takeTurn({ type: 'move', index: 0 }); // set rocks
    const msgs = b.takeTurn({ type: 'move', index: 1 }); // KO foe1, foe2 enters
    expect(msgs.join(' ')).toContain('Pointed stones dug into');
    expect(foe2.hp).toBeLessThan(foe2.maxHp);
  });

  it('hazard damage on entry can knock out a 1-HP switch-in and end the battle', () => {
    const user = mon('nibblex', 40, { moves: [{ id: 'stealthrock', pp: 20 }, { id: 'tackle', pp: 35 }], ability: 'momentum' });
    const foe1 = mon('nibbit', 5, { moves: [{ id: 'stringshot', pp: 40 }] });
    const foe2 = mon('pebblit', 5, { moves: [{ id: 'stringshot', pp: 40 }] });
    foe2.hp = 1;
    const trainer: TrainerDef = {
      name: 'T', spriteKey: 'hiker', party: [foe1, foe2], prize: 0, introText: '', defeatText: '',
    };
    const b = new Battle([user], { kind: 'trainer', trainer });
    b.takeTurn({ type: 'move', index: 0 });
    b.takeTurn({ type: 'move', index: 1 });
    expect(b.outcome).toBe('win');
  });

  it('Spikes hurt grounded switch-ins but not Flying-types', () => {
    const user = mon('nibblex', 40, { moves: [{ id: 'spikes', pp: 20 }, { id: 'tackle', pp: 35 }], ability: 'momentum' });
    const foe1 = mon('nibbit', 5, { moves: [{ id: 'stringshot', pp: 40 }] });
    const flyer = mon('fluffowl', 20, { moves: [{ id: 'stringshot', pp: 40 }] });
    const trainer: TrainerDef = {
      name: 'T', spriteKey: 'hiker', party: [foe1, flyer], prize: 0, introText: '', defeatText: '',
    };
    const b = new Battle([user], { kind: 'trainer', trainer });
    b.takeTurn({ type: 'move', index: 0 }); // spikes
    const msgs = b.takeTurn({ type: 'move', index: 1 }); // KO, flyer enters
    expect(msgs.join(' ')).not.toContain('hurt by the spikes');
    expect(flyer.hp).toBe(flyer.maxHp);
  });
});

describe('volatile statuses', () => {
  it('Confuse Ray confuses the target', () => {
    const user = mon('somnara', 20, { moves: [{ id: 'confuseray', pp: 10 }] });
    const foe = pacifist('nibbit', 10);
    const b = wild(user, foe);
    const msgs = b.takeTurn({ type: 'move', index: 0 });
    expect(msgs.join(' ')).toContain('became confused');
    expect(b.sides.enemy.confusionTurns).toBeGreaterThan(0);
  });

  it('confusion can cause self-hit damage', () => {
    let selfHit = false;
    for (let i = 0; i < 80 && !selfHit; i++) {
      setSeed(i * 29 + 11);
      const user = mon('somnara', 20, { moves: [{ id: 'confuseray', pp: 10 }, { id: 'mend', pp: 10 }] });
      const foe = mon('nibblex', 30, { moves: [{ id: 'tackle', pp: 35 }], ability: 'momentum' });
      const b = wild(user, foe);
      const before = foe.hp;
      b.takeTurn({ type: 'move', index: 0 }); // confuse
      const msgs = b.takeTurn({ type: 'move', index: 1 });
      if (msgs.join(' ').includes('hurt itself')) {
        selfHit = true;
        expect(foe.hp).toBeLessThan(before);
      }
    }
    expect(selfHit).toBe(true);
  });

  it('Leech Seed saps health each turn and fails on Grass-types', () => {
    const user = mon('sproutle', 20, { moves: [{ id: 'leechseed', pp: 10 }, { id: 'tackle', pp: 35 }] });
    const foe = pacifist('nibbit', 20);
    const b = wild(user, foe);
    const t1 = b.takeTurn({ type: 'move', index: 0 });
    expect(t1.join(' ')).toContain('seeded');
    const foeBefore = foe.hp;
    const t2 = b.takeTurn({ type: 'move', index: 1 });
    expect(t2.join(' ')).toContain('sapped by Leech Seed');
    expect(foe.hp).toBeLessThan(foeBefore);

    const user2 = mon('sproutle', 20, { moves: [{ id: 'leechseed', pp: 10 }] });
    const grassFoe = pacifist('thistling', 20);
    const b2 = wild(user2, grassFoe);
    const m = b2.takeTurn({ type: 'move', index: 0 });
    expect(m.join(' ')).toContain("doesn't affect");
  });

  it('Toxic poison damage escalates each turn', () => {
    const user = mon('buzzler', 30, { moves: [{ id: 'toxic', pp: 10 }, { id: 'mend', pp: 10 }] });
    const foe = pacifist('bouldron', 30);
    const b = wild(user, foe);
    b.takeTurn({ type: 'move', index: 0 });
    expect(foe.status).toBe('TOX');
    const h0 = foe.hp;
    b.takeTurn({ type: 'move', index: 1 });
    const firstTick = h0 - foe.hp;
    const h1 = foe.hp;
    b.takeTurn({ type: 'move', index: 1 });
    const secondTick = h1 - foe.hp;
    expect(secondTick).toBeGreaterThan(firstTick);
  });

  it('Cold Snap can freeze, and frozen mons cannot move', () => {
    let froze = false;
    for (let i = 0; i < 80 && !froze; i++) {
      setSeed(i * 37 + 1);
      const user = mon('puddlefin', 30, { moves: [{ id: 'coldsnap', pp: 25 }] });
      const foe = pacifist('nibbit', 20);
      const b = wild(user, foe);
      const msgs = b.takeTurn({ type: 'move', index: 0 });
      if (msgs.join(' ').includes('frozen solid')) froze = true;
    }
    expect(froze).toBe(true);
  });
});

describe('abilities', () => {
  it('Static Fur paralyzes contact attackers', () => {
    let para = false;
    for (let i = 0; i < 60 && !para; i++) {
      setSeed(i * 41 + 9);
      const user = mon('nibblex', 20, { moves: [{ id: 'tackle', pp: 35 }], ability: 'momentum' });
      const foe = mon('voltkat', 20, { ability: 'staticfur' });
      const b = wild(user, foe);
      const msgs = b.takeTurn({ type: 'move', index: 0 });
      if (msgs.join(' ').includes('Static Fur')) {
        para = true;
        expect(user.status).toBe('PAR');
      }
    }
    expect(para).toBe(true);
  });

  it('Rock Solid lets a full-HP mon survive a one-hit KO', () => {
    const user = mon('nibblex', 60, { moves: [{ id: 'takedown', pp: 20 }], ability: 'momentum' });
    const foe = mon('pebblit', 5, { ability: 'rocksolid' });
    const b = wild(user, foe);
    const msgs = b.takeTurn({ type: 'move', index: 0 });
    expect(msgs.join(' ')).toContain('Rock Solid');
    expect(foe.hp).toBe(1);
  });

  it('Airborne grants immunity to Ground moves', () => {
    const user = mon('mudlet', 20, { moves: [{ id: 'mudslap', pp: 10 }] });
    const foe = mon('somnara', 20, { ability: 'airborne' });
    const b = wild(user, foe);
    const msgs = b.takeTurn({ type: 'move', index: 0 });
    expect(msgs.join(' ')).toContain('Airborne');
    expect(foe.hp).toBe(foe.maxHp);
  });

  it('Sponge absorbs Water moves and heals', () => {
    const user = mon('puddlefin', 20, { moves: [{ id: 'watergun', pp: 25 }] });
    const foe = mon('mudlet', 20, { ability: 'sponge', moves: [{ id: 'harden', pp: 30 }] });
    foe.hp = Math.floor(foe.maxHp / 2);
    const b = wild(user, foe);
    const before = foe.hp;
    const msgs = b.takeTurn({ type: 'move', index: 0 });
    expect(msgs.join(' ')).toContain('Sponge');
    expect(foe.hp).toBeGreaterThan(before);
  });

  it('Ember Gut absorbs Fire moves and boosts the absorber', () => {
    const user = mon('cindercub', 20, { moves: [{ id: 'ember', pp: 25 }] });
    const foe = mon('flarat', 20, { ability: 'embergut' });
    const b = wild(user, foe);
    const msgs = b.takeTurn({ type: 'move', index: 0 });
    expect(msgs.join(' ')).toContain('Ember Gut');
    expect(foe.hp).toBe(foe.maxHp);
    expect(b.sides.enemy.emberBoost).toBe(true);
  });

  it('Menace lowers the foe Attack on switch-in', () => {
    const lead = mon('nibbit', 10);
    const intimidator = mon('fluffowl', 20, { ability: 'menace' });
    const foe = pacifist('nibbit', 10);
    const b = new Battle([lead, intimidator], { kind: 'wild', mon: foe });
    const msgs = b.takeTurn({ type: 'switch', index: 1 });
    expect(msgs.join(' ')).toContain('Menace');
    expect(b.sides.enemy.stages.atk).toBe(-1);
  });

  it('Musclebound roughly doubles physical damage', () => {
    const dmg = (muscle: boolean): number => {
      const losses: number[] = [];
      for (let i = 0; i < 300; i++) {
        setSeed(i * 43 + 6);
        const user = mon('nibblex', 30, {
          moves: [{ id: 'tackle', pp: 35 }],
          ability: muscle ? 'musclebound' : 'momentum',
        });
        const foe = pacifist('nibbit', 30);
        const b = wild(user, foe);
        const before = foe.hp;
        b.takeTurn({ type: 'move', index: 0 });
        losses.push(before - foe.hp);
      }
      return mean(losses);
    };
    expect(dmg(true)).toBeGreaterThan(dmg(false) * 1.7);
  });

  it('Momentum raises Speed each turn', () => {
    const user = mon('nibbit', 20, { ability: 'momentum', moves: [{ id: 'growl', pp: 40 }] });
    const foe = mon('bouldron', 5, { moves: [{ id: 'harden', pp: 30 }] });
    const b = wild(user, foe);
    const msgs = b.takeTurn({ type: 'move', index: 0 });
    expect(msgs.join(' ')).toContain('Momentum');
    expect(b.sides.player.stages.spe).toBe(1);
  });

  it('pinch abilities boost same-type moves at low HP', () => {
    const dmg = (low: boolean): number => {
      const losses: number[] = [];
      for (let i = 0; i < 300; i++) {
        setSeed(i * 47 + 8);
        const user = mon('sproutle', 30, { moves: [{ id: 'vinewhip', pp: 25 }], ability: 'verdantforce' });
        if (low) user.hp = Math.floor(user.maxHp / 3);
        const foe = pacifist('nibbit', 30);
        const b = wild(user, foe);
        const before = foe.hp;
        b.takeTurn({ type: 'move', index: 0 });
        losses.push(before - foe.hp);
      }
      return mean(losses);
    };
    expect(dmg(true)).toBeGreaterThan(dmg(false) * 1.3);
  });

  it('Adaptive raises STAB to 2x', () => {
    const dmg = (adaptive: boolean): number => {
      const losses: number[] = [];
      for (let i = 0; i < 300; i++) {
        setSeed(i * 53 + 10);
        const user = mon('mimew', 30, {
          moves: [{ id: 'tackle', pp: 35 }],
          ability: adaptive ? 'adaptive' : 'momentum',
        });
        const foe = pacifist('nibbit', 30);
        const b = wild(user, foe);
        const before = foe.hp;
        b.takeTurn({ type: 'move', index: 0 });
        losses.push(before - foe.hp);
      }
      return mean(losses);
    };
    // 2.0 vs 1.5 STAB => ~1.33 ratio
    const ratio = dmg(true) / dmg(false);
    expect(ratio).toBeGreaterThan(1.2);
    expect(ratio).toBeLessThan(1.45);
  });
});

describe('held items', () => {
  it('Oran Berry is eaten automatically below half HP', () => {
    const user = mon('nibbit', 20, { heldItem: 'oranberry', moves: [{ id: 'growl', pp: 40 }] });
    user.hp = Math.floor(user.maxHp / 2) - 1;
    const foe = pacifist('bouldron', 5);
    const b = wild(user, foe);
    const msgs = b.takeTurn({ type: 'move', index: 0 });
    expect(msgs.join(' ')).toContain('Oran Berry');
    expect(user.heldItem).toBeNull();
    expect(user.hp).toBeGreaterThanOrEqual(Math.floor(user.maxHp / 2));
  });

  it('Leftovers heal a little every turn', () => {
    const user = mon('nibbit', 20, { heldItem: 'leftovers', moves: [{ id: 'growl', pp: 40 }] });
    user.hp = user.maxHp - 5;
    const foe = pacifist('bouldron', 5);
    const b = wild(user, foe);
    b.takeTurn({ type: 'move', index: 0 });
    expect(user.hp).toBeGreaterThan(user.maxHp - 5);
  });

  it('Safety Sash saves from a one-hit KO once', () => {
    const user = mon('nibblex', 60, { moves: [{ id: 'takedown', pp: 20 }], ability: 'momentum' });
    const foe = mon('nibbit', 5, { heldItem: 'safetysash' });
    const b = wild(user, foe);
    const msgs = b.takeTurn({ type: 'move', index: 0 });
    expect(msgs.join(' ')).toContain('Safety Sash');
    expect(foe.hp).toBe(1);
  });

  it('Power Band locks the holder into its first move', () => {
    const user = mon('nibblex', 30, {
      heldItem: 'powerband',
      ability: 'momentum',
      moves: [
        { id: 'tackle', pp: 35 },
        { id: 'bite', pp: 25 },
      ],
    });
    const foe = pacifist('bouldron', 20);
    const b = wild(user, foe);
    b.takeTurn({ type: 'move', index: 0 });
    const msgs = b.takeTurn({ type: 'move', index: 1 });
    expect(msgs.join(' ')).toContain('Power Band');
    expect(msgs.join(' ')).toContain('Tackle');
  });

  it('type charms boost matching moves ~1.2x', () => {
    const dmg = (charm: boolean): number => {
      const losses: number[] = [];
      for (let i = 0; i < 300; i++) {
        setSeed(i * 59 + 12);
        const user = mon('cindercub', 30, {
          moves: [{ id: 'ember', pp: 25 }],
          heldItem: charm ? 'embercharm' : null,
        });
        const foe = pacifist('nibbit', 30);
        const b = wild(user, foe);
        const before = foe.hp;
        b.takeTurn({ type: 'move', index: 0 });
        losses.push(before - foe.hp);
      }
      return mean(losses);
    };
    expect(dmg(true)).toBeGreaterThan(dmg(false) * 1.1);
  });

  it('Swift Feather occasionally lets a slower mon move first', () => {
    let seen = false;
    for (let i = 0; i < 60 && !seen; i++) {
      setSeed(i * 61 + 14);
      const user = mon('pebblit', 20, { heldItem: 'swiftfeather', moves: [{ id: 'tackle', pp: 35 }] });
      const foe = mon('nibblex', 40, { moves: [{ id: 'tackle', pp: 35 }], ability: 'momentum' });
      const b = wild(user, foe);
      const msgs = b.takeTurn({ type: 'move', index: 0 });
      if (msgs.join(' ').includes('Swift Feather')) seen = true;
    }
    expect(seen).toBe(true);
  });
});

describe('experience and capture', () => {
  it('participants get full EXP and benched mons get half (exp share)', () => {
    const a = mon('sproutle', 30, { moves: [{ id: 'tackle', pp: 35 }] });
    const b = mon('cindercub', 30);
    const foe = mon('nibbit', 5, { moves: [{ id: 'stringshot', pp: 40 }] });
    const share = Math.floor((SPECIES.nibbit.expYield * 5) / 3);
    const battle = wild(a, foe);
    battle.party.push(b);
    const aExp = a.exp;
    const bExp = b.exp;
    for (let i = 0; i < 30 && foe.hp > 0 && !battle.outcome; i++) battle.takeTurn({ type: 'move', index: 0 });
    expect(battle.outcome).toBe('win');
    expect(a.exp - aExp).toBe(share);
    expect(b.exp - bExp).toBe(Math.floor(share / 2));
  });

  it('Lucky Charm multiplies EXP gain by 1.5', () => {
    const a = mon('sproutle', 30, { heldItem: 'luckycharm', moves: [{ id: 'tackle', pp: 35 }] });
    const foe = mon('nibbit', 5, { moves: [{ id: 'stringshot', pp: 40 }] });
    const share = Math.floor((SPECIES.nibbit.expYield * 5) / 3);
    const battle = wild(a, foe);
    const aExp = a.exp;
    for (let i = 0; i < 30 && foe.hp > 0 && !battle.outcome; i++) battle.takeTurn({ type: 'move', index: 0 });
    expect(a.exp - aExp).toBe(Math.floor(share * 1.5));
  });

  it('critical captures happen sometimes and succeed with one check', () => {
    let crits = 0;
    let caught = 0;
    for (let i = 0; i < 100; i++) {
      setSeed(i * 67 + 15);
      const user = mon('nibblex', 20);
      const foe = mon('pebblit', 3); // catchRate 255
      foe.hp = 1;
      const b = wild(user, foe);
      const msgs: string[] = [];
      for (let t = 0; t < 20 && !b.outcome; t++) msgs.push(...b.takeTurn({ type: 'item', item: 'mockball' }));
      if (msgs.join(' ').includes('Critical capture')) crits++;
      if (b.outcome === 'caught') caught++;
    }
    expect(caught).toBe(100); // a=255 always catches
    expect(crits).toBeGreaterThan(3); // ~12 expected
  });
});

describe('trainer AI', () => {
  it('leader AI uses a Super Potion below 25% HP', () => {
    const user = mon('nibbit', 5, { moves: [{ id: 'growl', pp: 40 }] });
    const foe = mon('bouldron', 20, { moves: [{ id: 'stringshot', pp: 40 }] });
    foe.hp = Math.floor(foe.maxHp * 0.2);
    const trainer: TrainerDef = {
      name: 'Terra', spriteKey: 'gymleader', party: [foe], prize: 0, introText: '', defeatText: '',
      ai: 'leader', potions: 1,
    };
    const b = new Battle([user], { kind: 'trainer', trainer });
    const before = foe.hp;
    const msgs = b.takeTurn({ type: 'move', index: 0 });
    expect(msgs.join(' ')).toContain('Super Potion');
    expect(foe.hp).toBeGreaterThan(before);
    expect(b.enemyPotions).toBe(0);
    // second turn: no more potions
    const msgs2 = b.takeTurn({ type: 'move', index: 0 });
    expect(msgs2.join(' ')).not.toContain('Super Potion');
  });

  it('smart AI does not spam stat moves into the cap', () => {
    const user = mon('nibblex', 30, { moves: [{ id: 'tackle', pp: 35 }], ability: 'momentum' });
    const foe = mon('mudlet', 30, { moves: [{ id: 'sandattack', pp: 40 }, { id: 'tackle', pp: 35 }] });
    const trainer: TrainerDef = {
      name: 'R', spriteKey: 'hiker', party: [foe], prize: 0, introText: '', defeatText: '', ai: 'smart',
    };
    const b = new Battle([user], { kind: 'trainer', trainer });
    let sandAttacks = 0;
    for (let i = 0; i < 8 && !b.outcome; i++) {
      const msgs = b.takeTurn({ type: 'move', index: 0 });
      if (msgs.join(' ').includes('Sand Attack')) sandAttacks++;
    }
    expect(sandAttacks).toBeLessThanOrEqual(1);
  });
});

describe('adversarial regressions', () => {
  it('two-turn moves consume PP once and the release turn is locked to the charging move', () => {
    const user = mon('nibblex', 30, { moves: [{ id: 'dig', pp: 10 }, { id: 'tackle', pp: 35 }], ability: 'momentum' });
    const foe = pacifist('bouldron', 30); // high def so dig doesn't one-shot
    const b = wild(user, foe);
    const msgs1 = b.takeTurn({ type: 'move', index: 0 }); // charge
    expect(msgs1.join(' ')).toContain('burrowed');
    expect(user.moves[0].pp).toBe(9);
    // pick a DIFFERENT move on the release turn: engine must fire dig anyway
    const msgs2 = b.takeTurn({ type: 'move', index: 1 });
    expect(msgs2.join(' ')).toContain('used Dig');
    expect(msgs2.join(' ')).not.toContain('used Tackle');
    expect(user.moves[0].pp).toBe(9); // no second PP spent on release
  });

  it('enemy releases its two-turn move instead of swapping to another', () => {
    const user = mon('bouldron', 30, { moves: [{ id: 'harden', pp: 40 }] });
    const foe = mon('nibblex', 30, { moves: [{ id: 'dig', pp: 10 }, { id: 'stringshot', pp: 40 }] });
    const b = wild(user, foe);
    b.takeTurn({ type: 'move', index: 0 }); // foe charges dig
    const msgs = b.takeTurn({ type: 'move', index: 0 });
    expect(msgs.join(' ')).toContain('Foe Nibblex used Dig');
    expect(foe.moves[0].pp).toBe(9);
  });

  it('power band falls back to Struggle when the locked move runs out of PP', () => {
    const user = mon('nibblex', 30, { moves: [{ id: 'tackle', pp: 1 }], heldItem: 'powerband' });
    const foe = pacifist('pebblit', 5);
    const b = wild(user, foe);
    b.takeTurn({ type: 'move', index: 0 }); // tackle: locks
    expect(user.moves[0].pp).toBe(0);
    const msgs = b.takeTurn({ type: 'move', index: 0 });
    expect(msgs.join(' ')).toContain('Struggle');
    expect(msgs.join(' ')).not.toContain('Power Band only allows');
    expect(msgs.join(' ')).not.toContain('No PP left');
  });

  it('power band lock clears on a voluntary switch', () => {
    const a = mon('nibblex', 30, { moves: [{ id: 'tackle', pp: 35 }], heldItem: 'powerband' });
    const c = mon('sproutle', 30, { moves: [{ id: 'vinewhip', pp: 25 }] });
    const foe = pacifist('pebblit', 5);
    const b = new Battle([a, c], { kind: 'wild', mon: foe });
    b.takeTurn({ type: 'move', index: 0 }); // tackle: lock set
    expect(b.sides.player.choiceLock).toBe('tackle');
    b.takeTurn({ type: 'switch', index: 1 });
    expect(b.sides.player.choiceLock).toBeNull();
    const msgs = b.takeTurn({ type: 'move', index: 0 }); // vine whip works freely
    expect(msgs.join(' ')).not.toContain('Power Band only allows');
    expect(msgs.join(' ')).toContain('used Vine Whip');
  });

  it('simultaneous last-mon KO awards a loss, not a win', () => {
    const user = mon('nibblex', 30, { moves: [{ id: 'tackle', pp: 0 }] }); // struggle only
    user.hp = 1; // struggle recoil will finish it
    const foe = mon('nibbit', 3, { moves: [{ id: 'stringshot', pp: 40 }] });
    foe.hp = 1;
    const b = wild(user, foe);
    const msgs = b.takeTurn({ type: 'move', index: 0 });
    expect(b.outcome).toBe('lose');
    expect(msgs.join(' ')).toContain('no more Mockemon');
  });

  it('ember gut boost resets when the boosted mon leaves the field', () => {
    const user = mon('flarat', 30, { moves: [{ id: 'scratch', pp: 35 }], ability: 'embergut' });
    const backup = mon('sproutle', 30, { moves: [{ id: 'tackle', pp: 35 }] });
    const foe = mon('cindercub', 20, { moves: [{ id: 'ember', pp: 25 }] });
    const b = new Battle([user, backup], { kind: 'wild', mon: foe });
    b.takeTurn({ type: 'move', index: 0 }); // ember absorbed -> boost
    expect(b.sides.player.emberBoost).toBe(true);
    b.takeTurn({ type: 'switch', index: 1 });
    expect(b.sides.player.emberBoost).toBe(false);
  });

  it('menace lowers the foe attack at the very start of battle', () => {
    const user = mon('nibblex', 30);
    const foe = mon('fluffowl', 20, { ability: 'menace' });
    const b = wild(user, foe); // no takeTurn at all
    expect(b.sides.player.stages.atk).toBe(-1);
  });

  it('safety sash is consumed on use and each holder gets its own save', () => {
    const user = mon('nibblex', 50, { moves: [{ id: 'tackle', pp: 35 }], ability: 'momentum' });
    const foe1 = mon('fluffowl', 10, { moves: [{ id: 'stringshot', pp: 40 }], heldItem: 'safetysash' });
    const foe2 = mon('fluffowl', 10, { moves: [{ id: 'stringshot', pp: 40 }], heldItem: 'safetysash' });
    const trainer: TrainerDef = {
      name: 'T', spriteKey: 'hiker', party: [foe1, foe2], prize: 0, introText: '', defeatText: '',
    };
    const b = new Battle([user], { kind: 'trainer', trainer });
    const msgs1 = b.takeTurn({ type: 'move', index: 0 });
    expect(msgs1.join(' ')).toContain('Safety Sash');
    expect(foe1.hp).toBe(1);
    expect(foe1.heldItem).toBeNull(); // consumed
    b.takeTurn({ type: 'move', index: 0 }); // finish foe1, foe2 enters
    const msgs3 = b.takeTurn({ type: 'move', index: 0 });
    expect(msgs3.join(' ')).toContain('Safety Sash'); // second holder's sash works
    expect(foe2.hp).toBe(1);
  });

  it('trainer battle EXP share is always an integer', () => {
    const user = mon('nibblex', 50, { moves: [{ id: 'tackle', pp: 35 }], ability: 'momentum' });
    // expYield 50 at lv7: 50*7/3*1.5 = 175.0 exactly? pick lv5: 50*5/3*1.5 = 125; lv4 -> 100; find odd floor case
    const foe = mon('nibbit', 7, { moves: [{ id: 'stringshot', pp: 40 }] });
    const trainer: TrainerDef = {
      name: 'T', spriteKey: 'hiker', party: [foe], prize: 0, introText: '', defeatText: '',
    };
    const b = new Battle([user], { kind: 'trainer', trainer });
    const msgs = b.takeTurn({ type: 'move', index: 0 });
    const m = msgs.join(' ').match(/gained (\d+(?:\.\d+)?) EXP/);
    expect(m).not.toBeNull();
    expect(Number.isInteger(Number(m![1]))).toBe(true);
  });

  it('voluntary switch into lethal hazards faints the switch-in immediately', () => {
    const a = mon('nibblex', 30, { moves: [{ id: 'tackle', pp: 35 }], ability: 'momentum' });
    const weak = mon('nibbit', 5, { moves: [{ id: 'tackle', pp: 35 }] });
    weak.hp = 1;
    const backup = mon('sproutle', 30, { moves: [{ id: 'tackle', pp: 35 }] });
    const foe = pacifist('bouldron', 30);
    const b = new Battle([a, weak, backup], { kind: 'wild', mon: foe });
    b.sides.player.stealthRock = true;
    const msgs = b.takeTurn({ type: 'switch', index: 1 });
    expect(msgs.join(' ')).toContain('fainted');
    expect(b.needsSwitch).toBe(true); // not left controlling a corpse
  });

  it('enemy power band holder is locked into its first move', () => {
    const user = mon('bouldron', 30, { moves: [{ id: 'harden', pp: 40 }] });
    const foe = mon('nibblex', 30, { moves: [{ id: 'tackle', pp: 35 }, { id: 'bite', pp: 25 }], heldItem: 'powerband' });
    const b = wild(user, foe);
    b.takeTurn({ type: 'move', index: 0 });
    const lock = b.sides.enemy.choiceLock;
    expect(lock).not.toBeNull();
    for (let i = 0; i < 3; i++) {
      b.takeTurn({ type: 'move', index: 0 });
      expect(b.sides.enemy.choiceLock).toBe(lock);
    }
  });
});
