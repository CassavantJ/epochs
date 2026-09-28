import { describe, expect, it } from 'vitest';

import { ERAS, era, MAX_QUEUE, POWER, SLOT_COSTS, STARTING_GOLD } from './data';
import {
  advance,
  baseFront,
  buildTurret,
  buySlot,
  cancelOrder,
  createGame,
  step,
  STEP,
  train,
  turretPlan,
  launchSpecial,
  type GameState,
  type Team,
} from './sim';

const run = (state: GameState, seconds: number) => {
  for (let elapsed = 0; elapsed < seconds; elapsed += STEP) step(state);
};

const units = (state: GameState, team: Team) => state.units.filter((unit) => unit.team === team);

describe('data', () => {
  it('has five eras of three units, a turret and a special', () => {
    expect(ERAS).toHaveLength(5);
    for (const [index, entry] of ERAS.entries()) {
      expect(entry.units.melee.era).toBe(index);
      expect(entry.turret.cost).toBeGreaterThan(0);
      expect(entry.special.count).toBeGreaterThan(0);
    }
    expect(ERAS.at(-1)?.xpToAdvance).toBeNull();
  });

  it('makes every era stronger and pricier than the last', () => {
    for (let index = 1; index < ERAS.length; index++) {
      const [before, after] = [era(index - 1), era(index)];
      for (const role of ['melee', 'ranged', 'heavy'] as const) {
        expect(after.units[role].cost).toBeGreaterThan(before.units[role].cost);
        expect(after.units[role].hp * after.units[role].damage).toBeGreaterThan(
          before.units[role].hp * before.units[role].damage,
        );
      }
      expect(after.baseHp).toBeGreaterThan(before.baseHp);
      expect(POWER[index]).toBeGreaterThan(POWER[index - 1] ?? Infinity);
    }
  });
});

describe('training', () => {
  it('charges gold, queues, then spawns in front of the base', () => {
    const state = createGame();
    const melee = era(0).units.melee;
    expect(train(state, 0, 'melee')).toBe(true);
    expect(state.sides[0].gold).toBe(STARTING_GOLD - melee.cost);
    run(state, melee.trainTime + 0.05);
    const [unit] = units(state, 0);
    expect(unit?.type).toBe(melee);
    expect(unit?.x).toBeGreaterThan(baseFront(0));
  });

  it('limits the queue and refunds cancelled orders', () => {
    const state = createGame();
    state.sides[0].gold = 10_000;
    for (let index = 0; index < MAX_QUEUE; index++) expect(train(state, 0, 'melee')).toBe(true);
    expect(train(state, 0, 'melee')).toBe(false);
    const gold = state.sides[0].gold;
    expect(cancelOrder(state, 0, 2)).toBe(true);
    expect(state.sides[0].gold).toBe(gold + era(0).units.melee.cost);
    expect(state.sides[0].queue).toHaveLength(MAX_QUEUE - 1);
  });

  it("won't train without the gold", () => {
    const state = createGame();
    state.sides[0].gold = 5;
    expect(train(state, 0, 'melee')).toBe(false);
    expect(state.sides[0].queue).toHaveLength(0);
  });
});

describe('combat', () => {
  it('sends units down the lane until they meet, then one side wins the fight', () => {
    const state = createGame();
    train(state, 0, 'melee');
    train(state, 0, 'melee');
    train(state, 1, 'melee');
    run(state, 30);
    expect(units(state, 1)).toHaveLength(0);
    expect(units(state, 0).length).toBeGreaterThan(0);
    expect(state.sides[0].stats.kills).toBe(1);
    expect(state.sides[1].stats.losses).toBe(1);
  });

  it('pays the killer gold and XP', () => {
    const state = createGame();
    const target = era(0).units.melee;
    train(state, 0, 'heavy');
    train(state, 1, 'melee');
    const before = { gold: state.sides[0].gold, xp: state.sides[0].xp };
    run(state, 25);
    // Passive income plus the kill.
    expect(state.sides[0].gold - before.gold).toBeGreaterThan(target.cost * 0.8);
    expect(state.sides[0].xp - before.xp).toBeGreaterThan(target.cost);
  });

  it('never lets opposing units pass through each other, and keeps its own line spaced', () => {
    const state = createGame();
    state.sides[0].gold = state.sides[1].gold = 10_000;
    state.sides[0].income = state.sides[1].income = 0;
    for (let index = 0; index < 5; index++) {
      train(state, 0, 'heavy');
      train(state, 1, 'heavy');
    }
    for (let elapsed = 0; elapsed < 40; elapsed += STEP) {
      step(state);
      const left = units(state, 0).sort((a, b) => b.x - a.x);
      const right = units(state, 1).sort((a, b) => a.x - b.x);
      const [front, enemy] = [left[0], right[0]];
      if (front && enemy) expect(front.x).toBeLessThan(enemy.x);
      for (let index = 1; index < left.length; index++) {
        const [ahead, behind] = [left[index - 1], left[index]];
        if (ahead && behind) expect(ahead.x - behind.x).toBeGreaterThanOrEqual(ahead.type.size / 2);
      }
    }
  });

  it('lets ranged units shoot from a distance', () => {
    const state = createGame();
    train(state, 0, 'ranged');
    train(state, 1, 'melee');
    let shots = 0;
    for (let elapsed = 0; elapsed < 30 && shots === 0; elapsed += STEP) {
      step(state);
      shots += state.events.filter((event) => event.kind === 'shot' && event.team === 0).length;
      state.events = [];
    }
    expect(shots).toBeGreaterThan(0);
    const [enemy] = units(state, 1);
    const [archer] = units(state, 0);
    if (enemy && archer) expect(enemy.x - archer.x).toBeGreaterThan(100);
  });

  it('ends the game when a base falls', () => {
    const state = createGame();
    state.sides[1].baseHp = 5;
    train(state, 0, 'melee');
    run(state, 40);
    expect(state.winner).toBe(0);
    expect(state.events.some((event) => event.kind === 'end')).toBe(true);
  });

  it('plays out the same from the same seed', () => {
    const play = () => {
      const state = createGame({ seed: 7 });
      state.sides[0].gold = state.sides[1].gold = 2000;
      for (const role of ['melee', 'ranged', 'heavy', 'melee'] as const) {
        train(state, 0, role);
        train(state, 1, role);
      }
      run(state, 20);
      launchSpecial(state, 0);
      run(state, 10);
      return state.units.map((unit) => [unit.id, Math.round(unit.x), Math.round(unit.hp)]);
    };
    expect(play()).toEqual(play());
  });
});

describe('eras', () => {
  it('advances with enough XP, spending it and growing the base', () => {
    const state = createGame();
    expect(advance(state, 0)).toBe(false);
    const needed = era(0).xpToAdvance ?? 0;
    state.sides[0].xp = needed + 10;
    state.sides[0].baseHp = era(0).baseHp / 2;
    expect(advance(state, 0)).toBe(true);
    expect(state.sides[0].era).toBe(1);
    expect(state.sides[0].xp).toBeCloseTo(10);
    expect(state.sides[0].baseHp).toBeCloseTo(era(1).baseHp / 2);
  });

  it('stops at the last era', () => {
    const state = createGame();
    state.sides[0].era = ERAS.length - 1;
    state.sides[0].xp = 1e9;
    expect(advance(state, 0)).toBe(false);
  });
});

describe('turrets', () => {
  it('builds in free slots, then offers upgrades once outdated', () => {
    const state = createGame();
    state.sides[0].gold = 100_000;
    expect(turretPlan(state, 0)).toMatchObject({ kind: 'build', slot: 0 });
    expect(buildTurret(state, 0)).toBe(true);
    expect(turretPlan(state, 0).kind).toBe('none');
    expect(buySlot(state, 0)).toBe(true);
    expect(state.sides[0].gold).toBe(100_000 - era(0).turret.cost - SLOT_COSTS[1]);
    expect(turretPlan(state, 0)).toMatchObject({ kind: 'build', slot: 1 });
    buildTurret(state, 0);
    state.sides[0].xp = 1e6;
    advance(state, 0);
    const plan = turretPlan(state, 0);
    expect(plan.kind).toBe('upgrade');
    expect(plan.cost).toBeLessThan(era(1).turret.cost);
    buildTurret(state, 0);
    expect(state.sides[0].turrets.map((turret) => turret?.type.era)).toEqual([1, 0, undefined]);
  });

  it('shoots enemies that come in range', () => {
    const state = createGame();
    state.sides[0].gold = 1000;
    buildTurret(state, 0);
    train(state, 1, 'melee');
    run(state, 40);
    expect(state.sides[0].stats.kills).toBe(1);
    expect(state.sides[0].baseHp).toBeGreaterThan(state.sides[0].baseMax * 0.9);
  });
});

describe('specials', () => {
  it('needs to recharge, and hits enemy units', () => {
    const state = createGame();
    state.sides[1].gold = 1000;
    for (let index = 0; index < 5; index++) train(state, 1, 'melee');
    run(state, 12);
    expect(launchSpecial(state, 0)).toBe(false);
    state.sides[0].specialCooldown = 0;
    const before = units(state, 1).reduce((total, unit) => total + unit.hp, 0);
    expect(launchSpecial(state, 0)).toBe(true);
    expect(launchSpecial(state, 0)).toBe(false);
    run(state, 4);
    const after = units(state, 1).reduce((total, unit) => total + unit.hp, 0);
    expect(after).toBeLessThan(before * 0.5);
  });
});

describe('overtime', () => {
  it('ramps up damage after ten minutes and crumbles both bases after eighteen', () => {
    const state = createGame();
    state.sides[0].income = state.sides[1].income = 0;
    run(state, 10 * 60 + 1);
    expect(state.winner).toBeNull();
    state.sides[1].baseHp = state.sides[1].baseMax * 0.5;
    run(state, 8 * 60 + 5);
    expect(state.sides[0].baseHp).toBeLessThan(state.sides[0].baseMax);
    run(state, 60);
    // The side with more of its base left wins.
    expect(state.winner).toBe(0);
  });
});
