import { era, type Role } from './data';
import {
  advance,
  baseFront,
  buildTurret,
  buySlot,
  canAdvance,
  direction,
  random,
  slotCost,
  train,
  turretPlan,
  launchSpecial,
  type GameState,
  type Team,
} from './sim';

export type DifficultyId = 'easy' | 'normal' | 'hard';

export interface Difficulty {
  id: DifficultyId;
  name: string;
  description: string;
  /** Multiplies the AI's gold income. */
  income: number;
  /** Seconds between decisions, on average. */
  thinkEvery: number;
  /** Seconds it sits on an available era advance. */
  advanceDelay: number;
  /** 0–1: how readily it spends on turrets. */
  turrets: number;
  /** Enemy army value near its base, in its own melee units, that makes it use its special. */
  specialValue: number;
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  easy: {
    id: 'easy',
    name: 'Easy',
    description: 'Slow to react and slow to advance. Good for learning the ropes.',
    income: 0.8,
    thinkEvery: 1.6,
    advanceDelay: 30,
    turrets: 0.3,
    specialValue: 10,
  },
  normal: {
    id: 'normal',
    name: 'Normal',
    description: 'A fair fight: same income, sensible choices.',
    income: 1,
    thinkEvery: 0.9,
    advanceDelay: 6,
    turrets: 0.6,
    specialValue: 6,
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    description: 'Quick, greedy and earns a fifth more gold than you.',
    income: 1.2,
    thinkEvery: 0.5,
    advanceDelay: 0,
    turrets: 0.9,
    specialValue: 4,
  },
};

export const DIFFICULTY_IDS = ['easy', 'normal', 'hard'] as const satisfies readonly DifficultyId[];

/** Gold value of the enemy's units within `reach` (a share of the lane) of this team's base. */
export function pressure(state: GameState, team: Team, reach: number): number {
  const front = baseFront(team);
  const lane = Math.abs(baseFront(1) - baseFront(0));
  return state.units
    .filter((unit) => unit.team !== team && direction(team) * (unit.x - front) <= reach * lane)
    .reduce((total, unit) => total + unit.type.cost, 0);
}

/**
 * A computer opponent. It plays by the same rules and commands as the player; the difficulty
 * changes how fast and how well it decides, and (on Hard) how much gold it earns.
 */
export class Brain {
  readonly team: Team;
  readonly difficulty: Difficulty;
  #next = 0;
  #plan: Role | null = null;
  #advanceReadyAt: number | null = null;

  constructor(team: Team, difficulty: Difficulty) {
    this.team = team;
    this.difficulty = difficulty;
  }

  update(state: GameState): void {
    if (state.winner !== null || state.time < this.#next) return;
    this.#next = state.time + this.difficulty.thinkEvery * (0.75 + random(state) * 0.5);
    this.#think(state);
  }

  #think(state: GameState): void {
    const { team, difficulty } = this;
    const side = state.sides[team];

    if (canAdvance(state, team)) {
      this.#advanceReadyAt ??= state.time;
      if (state.time - this.#advanceReadyAt >= difficulty.advanceDelay) {
        advance(state, team);
        this.#advanceReadyAt = null;
      }
    }

    const current = era(side.era);
    const unitCost = current.units.melee.cost;
    const threat = pressure(state, team, 0.5);
    // Worth a special: a big enemy push on our half, or a big enemy army anywhere.
    const targets = Math.max(threat, pressure(state, team, 1) * 0.6);

    if (
      side.specialCooldown === 0 &&
      !side.special &&
      targets >= difficulty.specialValue * unitCost
    ) {
      launchSpecial(state, team);
    }

    const turret = turretPlan(state, team);
    const reserve = unitCost * 3;
    if (turret.kind !== 'none') {
      const wanted = turret.kind === 'upgrade' || state.time > 40 || threat > 0;
      if (wanted && random(state) < difficulty.turrets && side.gold >= turret.cost + reserve) {
        buildTurret(state, team);
      }
    } else {
      const cost = slotCost(state, team);
      const spare = current.turret.cost + unitCost * 4;
      if (
        cost !== null &&
        side.era >= 1 &&
        random(state) < difficulty.turrets * 0.5 &&
        side.gold >= cost + spare
      ) {
        buySlot(state, team);
      }
    }

    this.#plan ??= this.#choose(state);
    const planned = current.units[this.#plan];
    if (side.gold >= planned.cost) {
      if (train(state, team, this.#plan)) this.#plan = null;
    } else if (threat > 0 && this.#plan === 'heavy') {
      // Under attack there's no time to save up for a heavy.
      train(state, team, 'melee');
    }
  }

  /** The next unit to buy: a mixed army, leaning toward whatever counters the enemy's. */
  #choose(state: GameState): Role {
    const enemies = state.units.filter((unit) => unit.team !== this.team);
    const share = (role: Role) =>
      enemies.length === 0
        ? 0
        : enemies.filter((unit) => unit.type.role === role).length / enemies.length;
    const weights: Record<Role, number> = {
      melee: 0.45 + share('ranged') * 0.25,
      ranged: 0.35 + share('melee') * 0.15,
      heavy: 0.2 + share('heavy') * 0.3,
    };
    const ownFront = state.units.some(
      (unit) => unit.team === this.team && unit.type.role !== 'ranged',
    );
    // Archers alone can't hold a line.
    if (!ownFront) weights.ranged *= 0.3;
    const total = weights.melee + weights.ranged + weights.heavy;
    let roll = random(state) * total;
    for (const role of ['melee', 'ranged', 'heavy'] as const) {
      roll -= weights[role];
      if (roll <= 0) return role;
    }
    return 'melee';
  }
}
