import {
  CRUMBLE_RATE,
  CRUMBLE_START,
  era,
  KILL_GOLD,
  KILL_XP,
  LAST_ERA,
  MAX_QUEUE,
  PASSIVE_GOLD,
  OVERTIME_RAMP,
  OVERTIME_START,
  PASSIVE_XP,
  POWER,
  SIEGE,
  SLOT_COSTS,
  STARTING_GOLD,
  TURRET_REFUND,
  type ProjectileKind,
  type Role,
  type SpecialType,
  type TurretType,
  type UnitType,
} from './data';

/**
 * The battle, as plain data advanced in fixed steps. Nothing here draws or plays sound: it emits
 * events for that. Randomness comes from a seeded generator in the state, so a game replays the
 * same way from the same seed and commands.
 */

export type Team = 0 | 1;

export const WORLD = { width: 1600, height: 400, ground: 330 } as const;
export const STEP = 1 / 60;
export const BASE_X = [70, 1530] as const;
export const BASE_HALF = 62;
/** Turret slots on a base: toward the field by dx, above the ground by dy. */
export const TURRET_SLOTS = [
  { dx: 12, dy: 170 },
  { dx: 40, dy: 124 },
  { dx: 56, dy: 80 },
] as const;
/** Gap kept between a unit and the one in front of it on the same side. */
const SPACING = 4;

export const direction = (team: Team): 1 | -1 => (team === 0 ? 1 : -1);
export const other = (team: Team): Team => (team === 0 ? 1 : 0);
/** The x where a team's base faces the field. */
export const baseFront = (team: Team) => BASE_X[team] + direction(team) * BASE_HALF;

export interface Unit {
  id: number;
  team: Team;
  type: UnitType;
  x: number;
  hp: number;
  /** Seconds until it can attack again. */
  cooldown: number;
  /** Game time of its last attack, for the swing animation. */
  lastAttack: number;
  moving: boolean;
  /** Distance walked, for the step cycle. */
  walked: number;
}

export interface Projectile {
  id: number;
  team: Team;
  kind: ProjectileKind;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** A unit it follows, or null for a base or a patch of ground. */
  targetId: number | null;
  hitsBase: boolean;
  damage: number;
  splash: number;
  elapsed: number;
  duration: number;
  arc: number;
  x: number;
  y: number;
}

export interface Turret {
  type: TurretType;
  cooldown: number;
  /** Radians, for drawing the barrel. 0 points at the enemy. */
  aim: number;
  lastShot: number;
}

export interface Order {
  type: UnitType;
  progress: number;
}

export interface SideStats {
  trained: number;
  kills: number;
  losses: number;
  specials: number;
}

export interface Side {
  gold: number;
  xp: number;
  era: number;
  baseHp: number;
  baseMax: number;
  queue: Order[];
  slots: number;
  turrets: (Turret | null)[];
  /** Seconds until the special can be used again. */
  specialCooldown: number;
  special: { type: SpecialType; elapsed: number; fired: number } | null;
  /** Multiplies gold income: the AI's difficulty handicap. */
  income: number;
  stats: SideStats;
}

export type GameEvent =
  | { kind: 'spawn'; team: Team; x: number; unit: UnitType }
  | { kind: 'shot'; team: Team; projectile: ProjectileKind; x: number; y: number }
  | { kind: 'melee'; team: Team; x: number; y: number; era: number }
  | {
      kind: 'impact';
      team: Team;
      projectile: ProjectileKind;
      x: number;
      y: number;
      splash: number;
    }
  | { kind: 'death'; team: Team; x: number; unit: UnitType; id: number }
  | { kind: 'baseHit'; team: Team; damage: number }
  | { kind: 'turret'; team: Team; slot: number }
  | { kind: 'special'; team: Team; special: SpecialType }
  | { kind: 'advance'; team: Team; era: number }
  | { kind: 'end'; winner: Team };

export interface GameState {
  time: number;
  sides: [Side, Side];
  units: Unit[];
  projectiles: Projectile[];
  /** Filled during steps; whoever draws or plays sound empties it. */
  events: GameEvent[];
  nextId: number;
  seed: number;
  winner: Team | null;
}

function createSide(income: number): Side {
  const first = era(0);
  return {
    gold: STARTING_GOLD,
    xp: 0,
    era: 0,
    baseHp: first.baseHp,
    baseMax: first.baseHp,
    queue: [],
    slots: 1,
    turrets: [null, null, null],
    // Half charged, so the first one is available a little way in.
    specialCooldown: first.special.cooldown / 2,
    special: null,
    income,
    stats: { trained: 0, kills: 0, losses: 0, specials: 0 },
  };
}

export function createGame({
  seed = 1,
  income = [1, 1],
}: { seed?: number; income?: readonly [number, number] } = {}): GameState {
  return {
    time: 0,
    sides: [createSide(income[0]), createSide(income[1])],
    units: [],
    projectiles: [],
    events: [],
    nextId: 1,
    seed: seed >>> 0,
    winner: null,
  };
}

/** Mulberry32: small, fast and good enough for a game. Advances the state's seed. */
export function random(state: GameState): number {
  state.seed = (state.seed + 0x6d2b79f5) >>> 0;
  let t = state.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------------------------
// Commands. Each returns whether it happened.

export function train(state: GameState, team: Team, role: Role): boolean {
  const side = state.sides[team];
  const type = era(side.era).units[role];
  if (state.winner !== null || side.queue.length >= MAX_QUEUE || side.gold < type.cost) {
    return false;
  }
  side.gold -= type.cost;
  side.queue.push({ type, progress: 0 });
  return true;
}

/** Cancels a queued unit and refunds it in full. */
export function cancelOrder(state: GameState, team: Team, index: number): boolean {
  const side = state.sides[team];
  const [order] = side.queue.splice(index, 1);
  if (!order) return false;
  side.gold += order.type.cost;
  return true;
}

export type TurretPlan =
  | { kind: 'build'; slot: number; cost: number }
  | { kind: 'upgrade'; slot: number; cost: number }
  | { kind: 'none'; cost: number };

/** What the turret button would do: fill an empty slot, or replace the oldest outdated turret. */
export function turretPlan(state: GameState, team: Team): TurretPlan {
  const side = state.sides[team];
  const type = era(side.era).turret;
  const empty = side.turrets.findIndex((turret, slot) => slot < side.slots && turret === null);
  if (empty !== -1) return { kind: 'build', slot: empty, cost: type.cost };
  let oldest = -1;
  side.turrets.forEach((turret, slot) => {
    if (slot >= side.slots || !turret || turret.type.era >= side.era) return;
    const current = side.turrets[oldest];
    if (oldest === -1 || (current && turret.type.era < current.type.era)) oldest = slot;
  });
  const replaced = side.turrets[oldest];
  if (oldest === -1 || !replaced) return { kind: 'none', cost: type.cost };
  return {
    kind: 'upgrade',
    slot: oldest,
    cost: Math.round(type.cost - replaced.type.cost * TURRET_REFUND),
  };
}

export function buildTurret(state: GameState, team: Team): boolean {
  const side = state.sides[team];
  const plan = turretPlan(state, team);
  if (state.winner !== null || plan.kind === 'none' || side.gold < plan.cost) return false;
  side.gold -= plan.cost;
  side.turrets[plan.slot] = { type: era(side.era).turret, cooldown: 0, aim: 0, lastShot: -1 };
  state.events.push({ kind: 'turret', team, slot: plan.slot });
  return true;
}

export function slotCost(state: GameState, team: Team): number | null {
  return SLOT_COSTS[state.sides[team].slots] ?? null;
}

export function buySlot(state: GameState, team: Team): boolean {
  const side = state.sides[team];
  const cost = slotCost(state, team);
  if (state.winner !== null || cost === null || side.gold < cost) return false;
  side.gold -= cost;
  side.slots += 1;
  return true;
}

export function canAdvance(state: GameState, team: Team): boolean {
  const side = state.sides[team];
  const needed = era(side.era).xpToAdvance;
  return state.winner === null && needed !== null && side.xp >= needed;
}

/** Spends XP to move to the next era. The base grows, keeping its share of health. */
export function advance(state: GameState, team: Team): boolean {
  if (!canAdvance(state, team)) return false;
  const side = state.sides[team];
  side.xp -= era(side.era).xpToAdvance ?? 0;
  side.era = Math.min(side.era + 1, LAST_ERA);
  const next = era(side.era);
  side.baseHp = (side.baseHp / side.baseMax) * next.baseHp;
  side.baseMax = next.baseHp;
  state.events.push({ kind: 'advance', team, era: side.era });
  return true;
}

export function launchSpecial(state: GameState, team: Team): boolean {
  const side = state.sides[team];
  if (state.winner !== null || side.specialCooldown > 0 || side.special) return false;
  const type = era(side.era).special;
  side.special = { type, elapsed: 0, fired: 0 };
  side.specialCooldown = type.cooldown;
  side.stats.specials += 1;
  state.events.push({ kind: 'special', team, special: type });
  return true;
}

// ---------------------------------------------------------------------------------------------
// The step.

const PROJECTILE_SPEED: Record<ProjectileKind, number> = {
  stone: 420,
  boulder: 380,
  arrow: 620,
  bolt: 680,
  fireball: 460,
  bullet: 1500,
  shell: 720,
  plasma: 950,
  laser: 3200,
};

/** Arc height as a share of the distance flown. */
const PROJECTILE_ARC: Record<ProjectileKind, number> = {
  stone: 0.22,
  boulder: 0.35,
  arrow: 0.18,
  bolt: 0.08,
  fireball: 0.3,
  bullet: 0,
  shell: 0.12,
  plasma: 0,
  laser: 0,
};

const unitCenterY = (unit: Unit) => WORLD.ground - unit.type.height * 0.55;

function fire(
  state: GameState,
  team: Team,
  kind: ProjectileKind,
  from: { x: number; y: number },
  to: { x: number; y: number },
  hit: { targetId: number | null; hitsBase: boolean; damage: number; splash: number },
  duration?: number,
) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  state.projectiles.push({
    id: state.nextId++,
    team,
    kind,
    fromX: from.x,
    fromY: from.y,
    toX: to.x,
    toY: to.y,
    ...hit,
    elapsed: 0,
    duration: duration ?? Math.max(distance / PROJECTILE_SPEED[kind], 0.05),
    arc: distance * PROJECTILE_ARC[kind],
    x: from.x,
    y: from.y,
  });
  state.events.push({ kind: 'shot', team, projectile: kind, x: from.x, y: from.y });
}

function damageUnit(unit: Unit, amount: number) {
  unit.hp -= amount;
}

function damageBase(state: GameState, team: Team, amount: number) {
  const side = state.sides[team];
  if (state.winner !== null) return;
  side.baseHp = Math.max(0, side.baseHp - amount);
  state.events.push({ kind: 'baseHit', team, damage: amount });
  if (side.baseHp <= 0) {
    state.winner = other(team);
    state.events.push({ kind: 'end', winner: state.winner });
  }
}

/** The enemy unit nearest this team's base, which every unit and turret of the team faces. */
function enemyFront(units: readonly Unit[], team: Team): Unit | undefined {
  let front: Unit | undefined;
  for (const unit of units) {
    if (unit.team === team || unit.hp <= 0) continue;
    // For team 0 the nearest enemy has the lowest x; for team 1, the highest.
    if (!front || direction(team) * (unit.x - front.x) < 0) front = unit;
  }
  return front;
}

/** Income, special cooldowns and sudden death. Returns true if sudden death ended the game. */
function stepEconomy(state: GameState, dt: number): boolean {
  if (state.time >= CRUMBLE_START) {
    ([0, 1] as const).forEach((team) => {
      const side = state.sides[team];
      side.baseHp = Math.max(0, side.baseHp - side.baseMax * CRUMBLE_RATE * dt);
    });
    // Whichever falls first loses; both at once goes to the side that had more left.
    const [left, right] = state.sides;
    if (left.baseHp <= 0 || right.baseHp <= 0) {
      state.winner = left.baseHp / left.baseMax >= right.baseHp / right.baseMax ? 0 : 1;
      state.events.push({ kind: 'end', winner: state.winner });
      return true;
    }
  }
  for (const side of state.sides) {
    const power = POWER[side.era] ?? 1;
    side.gold += PASSIVE_GOLD * power * side.income * dt;
    side.xp += PASSIVE_XP * power * dt;
    side.specialCooldown = Math.max(0, side.specialCooldown - dt);
  }
  return false;
}

function stepQueues(state: GameState, dt: number) {
  ([0, 1] as const).forEach((team) => {
    const side = state.sides[team];
    const order = side.queue[0];
    if (!order) return;
    order.progress = Math.min(order.progress + dt, order.type.trainTime);
    if (order.progress < order.type.trainTime) return;
    const dir = direction(team);
    const x = baseFront(team) + dir * (order.type.size / 2 + SPACING);
    // Wait for the doorway to clear.
    const blocked = state.units.some(
      (unit) =>
        unit.team === team &&
        Math.abs(unit.x - x) < (unit.type.size + order.type.size) / 2 + SPACING,
    );
    if (blocked) return;
    side.queue.shift();
    side.stats.trained += 1;
    state.units.push({
      id: state.nextId++,
      team,
      type: order.type,
      x,
      hp: order.type.hp,
      cooldown: 0,
      lastAttack: -1,
      moving: true,
      walked: 0,
    });
    state.events.push({ kind: 'spawn', team, x, unit: order.type });
  });
}

/** Melee blows land after every unit has acted, so neither side gets the first strike. */
interface Blow {
  team: Team;
  target: Unit | undefined;
  damage: number;
}

function stepUnits(state: GameState, dt: number) {
  const blows: Blow[] = [];
  ([0, 1] as const).forEach((team) => {
    const dir = direction(team);
    // Front of the line first, so each unit can check the one ahead of it.
    const line = state.units.filter((unit) => unit.team === team).sort((a, b) => dir * (b.x - a.x));
    const target = enemyFront(state.units, team);
    const targetEdge = target ? target.x - dir * (target.type.size / 2) : baseFront(other(team));

    line.forEach((unit, index) => {
      unit.cooldown = Math.max(0, unit.cooldown - dt);
      const edge = unit.x + dir * (unit.type.size / 2);
      const gap = dir * (targetEdge - edge);

      // A little slack, so float rounding can't leave a unit a hair out of range forever.
      if (gap <= unit.type.range + 0.5) {
        unit.moving = false;
        if (unit.cooldown <= 0) attack(state, unit, target, blows);
        return;
      }

      const ahead = line[index - 1];
      const room = ahead
        ? dir * (ahead.x - dir * (ahead.type.size / 2) - edge) - SPACING
        : Infinity;
      const move = Math.max(0, Math.min(unit.type.speed * dt, gap - unit.type.range, room));
      unit.moving = move > 0.01;
      unit.x += dir * move;
      unit.walked += move;
    });
  });
  for (const blow of blows) {
    if (blow.target) damageUnit(blow.target, blow.damage);
    else damageBase(state, other(blow.team), blow.damage * SIEGE);
  }
}

function attack(state: GameState, unit: Unit, target: Unit | undefined, blows: Blow[]) {
  const { type, team } = unit;
  const dir = direction(team);
  unit.cooldown = type.cooldown;
  unit.lastAttack = state.time;
  const enemy = other(team);

  if (type.projectile) {
    const from = { x: unit.x + dir * (type.size / 2), y: WORLD.ground - type.height * 0.72 };
    const to = target
      ? { x: target.x, y: unitCenterY(target) }
      : { x: baseFront(enemy) - dir * 10, y: WORLD.ground - 70 };
    fire(state, team, type.projectile, from, to, {
      targetId: target?.id ?? null,
      hitsBase: !target,
      damage: type.damage * overtime(state) * (target ? 1 : SIEGE),
      splash: type.splash,
    });
    return;
  }

  const damage = type.damage * overtime(state);
  blows.push({ team, target, damage });
  const x = target ? target.x - dir * (target.type.size / 2) : baseFront(enemy);
  state.events.push({
    kind: 'melee',
    team,
    x,
    y: WORLD.ground - type.height * 0.55,
    era: type.era,
  });
}

function stepTurrets(state: GameState, dt: number) {
  ([0, 1] as const).forEach((team) => {
    const side = state.sides[team];
    const dir = direction(team);
    const front = baseFront(team);
    side.turrets.forEach((turret, slot) => {
      if (!turret) return;
      turret.cooldown = Math.max(0, turret.cooldown - dt);
      const target = enemyFront(state.units, team);
      if (!target || dir * (target.x - front) > turret.type.range) return;
      const position = TURRET_SLOTS[slot] ?? TURRET_SLOTS[0];
      const from = { x: BASE_X[team] + dir * position.dx, y: WORLD.ground - position.dy };
      const to = { x: target.x, y: unitCenterY(target) };
      turret.aim = Math.atan2(to.y - from.y, dir * (to.x - from.x));
      if (turret.cooldown > 0) return;
      turret.cooldown = turret.type.cooldown;
      turret.lastShot = state.time;
      fire(state, team, turret.type.projectile, from, to, {
        targetId: target.id,
        hitsBase: false,
        damage: turret.type.damage,
        splash: turret.type.splash,
      });
    });
  });
}

function stepSpecials(state: GameState, dt: number) {
  ([0, 1] as const).forEach((team) => {
    const side = state.sides[team];
    const active = side.special;
    if (!active) return;
    active.elapsed += dt;
    const { type } = active;
    const dir = direction(team);
    const due = Math.min(type.count, Math.ceil((active.elapsed / type.duration) * type.count));
    while (active.fired < due) {
      active.fired += 1;
      const enemies = state.units.filter((unit) => unit.team !== team);
      const pick = enemies[Math.floor(random(state) * enemies.length)];
      // With nobody to hit, it lands in front of the base.
      const x = pick
        ? pick.x + (random(state) - 0.5) * 80
        : baseFront(team) + dir * (120 + random(state) * 480);
      fire(
        state,
        team,
        type.projectile,
        { x: x - dir * 220, y: -60 },
        { x, y: WORLD.ground - 4 },
        { targetId: null, hitsBase: false, damage: type.damage, splash: type.splash },
        0.75,
      );
    }
    if (active.fired >= type.count && active.elapsed >= type.duration) side.special = null;
  });
}

function stepProjectiles(state: GameState, dt: number) {
  const byId = new Map(state.units.map((unit) => [unit.id, unit]));
  const landed: Projectile[] = [];
  for (const projectile of state.projectiles) {
    projectile.elapsed += dt;
    const target = projectile.targetId === null ? undefined : byId.get(projectile.targetId);
    if (target && target.hp > 0) {
      projectile.toX = target.x;
      projectile.toY = unitCenterY(target);
    }
    const progress = Math.min(projectile.elapsed / projectile.duration, 1);
    projectile.x = projectile.fromX + (projectile.toX - projectile.fromX) * progress;
    projectile.y =
      projectile.fromY +
      (projectile.toY - projectile.fromY) * progress -
      projectile.arc * 4 * progress * (1 - progress);
    if (progress >= 1) landed.push(projectile);
  }
  if (landed.length === 0) return;
  state.projectiles = state.projectiles.filter((projectile) => !landed.includes(projectile));

  for (const projectile of landed) {
    const enemy = other(projectile.team);
    state.events.push({
      kind: 'impact',
      team: projectile.team,
      projectile: projectile.kind,
      x: projectile.toX,
      y: projectile.toY,
      splash: projectile.splash,
    });
    if (projectile.hitsBase) {
      damageBase(state, enemy, projectile.damage);
      continue;
    }
    const target = projectile.targetId === null ? undefined : byId.get(projectile.targetId);
    const hitTarget = target && target.hp > 0 ? target : undefined;
    if (hitTarget) damageUnit(hitTarget, projectile.damage);
    if (projectile.splash > 0) {
      // Aimed shots splash at half strength; specials hit everything in the blast fully.
      const share = projectile.targetId === null ? 1 : 0.5;
      for (const unit of state.units) {
        if (unit.team !== enemy || unit === hitTarget || unit.hp <= 0) continue;
        if (Math.abs(unit.x - projectile.toX) <= projectile.splash + unit.type.size / 2) {
          damageUnit(unit, projectile.damage * share);
        }
      }
    }
  }
}

function removeDead(state: GameState) {
  const dead = state.units.filter((unit) => unit.hp <= 0);
  if (dead.length === 0) return;
  state.units = state.units.filter((unit) => unit.hp > 0);
  for (const unit of dead) {
    const killer = state.sides[other(unit.team)];
    killer.gold += unit.type.cost * KILL_GOLD * killer.income;
    killer.xp += unit.type.cost * KILL_XP;
    killer.stats.kills += 1;
    state.sides[unit.team].stats.losses += 1;
    state.events.push({ kind: 'death', team: unit.team, x: unit.x, unit: unit.type, id: unit.id });
  }
}

/** How much harder units hit right now: 1 until overtime, then climbing each minute. */
export function overtime(state: GameState): number {
  return 1 + (Math.max(0, state.time - OVERTIME_START) / 60) * OVERTIME_RAMP;
}

/** Advances the game by one STEP. */
export function step(state: GameState): void {
  if (state.winner !== null) return;
  const dt = STEP;
  state.time += dt;
  if (stepEconomy(state, dt)) return;
  stepQueues(state, dt);
  stepSpecials(state, dt);
  stepUnits(state, dt);
  stepTurrets(state, dt);
  stepProjectiles(state, dt);
  removeDead(state);
}
