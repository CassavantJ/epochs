/**
 * Everything that differs between eras: units, turrets, specials and what it takes to advance.
 * Stats come from one base table scaled by the era's POWER, so balance changes happen in one
 * place. Later eras are stronger per unit of gold, which is what makes advancing worth it.
 */

export type Role = 'melee' | 'ranged' | 'heavy';
export const ROLES = ['melee', 'ranged', 'heavy'] as const satisfies readonly Role[];

export type ProjectileKind =
  'stone' | 'boulder' | 'arrow' | 'bolt' | 'fireball' | 'bullet' | 'shell' | 'plasma' | 'laser';

export interface UnitType {
  id: string;
  name: string;
  role: Role;
  era: number;
  cost: number;
  /** Seconds to train. */
  trainTime: number;
  hp: number;
  damage: number;
  /** Seconds between attacks. */
  cooldown: number;
  /** Gap to the target, in world units, at which it stops and attacks. */
  range: number;
  speed: number;
  /** Body width, for spacing in the line. */
  size: number;
  /** Height of the figure, for health bars and where shots land. */
  height: number;
  /** Ranged attacks fire this; melee ones don't. */
  projectile: ProjectileKind | null;
  splash: number;
}

export interface TurretType {
  id: string;
  name: string;
  era: number;
  cost: number;
  damage: number;
  cooldown: number;
  /** Reach, measured from the front of the base. */
  range: number;
  projectile: ProjectileKind;
  splash: number;
}

export interface SpecialType {
  id: string;
  name: string;
  era: number;
  /** Per impact. */
  damage: number;
  count: number;
  /** Seconds over which the impacts land. */
  duration: number;
  splash: number;
  cooldown: number;
  projectile: ProjectileKind;
}

export interface Era {
  id: string;
  name: string;
  units: Record<Role, UnitType>;
  turret: TurretType;
  special: SpecialType;
  baseHp: number;
  /** XP needed to advance to the next era; null for the last. */
  xpToAdvance: number | null;
}

/** How much stronger (and pricier) each era is than the first. */
export const POWER = [1, 2.3, 5.2, 11.5, 25] as const;

const BASE_UNITS: Record<Role, Omit<UnitType, 'id' | 'name' | 'role' | 'era'>> = {
  melee: {
    cost: 15,
    trainTime: 1,
    hp: 60,
    damage: 10,
    cooldown: 1,
    range: 8,
    speed: 58,
    size: 20,
    height: 44,
    projectile: null,
    splash: 0,
  },
  ranged: {
    cost: 25,
    trainTime: 1.3,
    hp: 38,
    damage: 7,
    cooldown: 1.3,
    range: 190,
    speed: 52,
    size: 20,
    height: 44,
    projectile: 'stone',
    splash: 0,
  },
  heavy: {
    cost: 90,
    trainTime: 2.6,
    hp: 300,
    damage: 26,
    cooldown: 1.5,
    range: 10,
    speed: 42,
    size: 46,
    height: 58,
    projectile: null,
    splash: 0,
  },
};

const BASE_TURRET = { cost: 120, damage: 11, cooldown: 1.6, range: 430, splash: 0 };
const BASE_SPECIAL = { damage: 45, count: 14, duration: 2.5, splash: 45, cooldown: 50 };
const BASE_HP = 1200;

type UnitFlavor = { name: string } & Partial<Omit<UnitType, 'id' | 'name' | 'role' | 'era'>>;

interface EraFlavor {
  id: string;
  name: string;
  units: Record<Role, UnitFlavor>;
  turret: { name: string; projectile: ProjectileKind } & Partial<typeof BASE_TURRET>;
  special: { name: string; projectile: ProjectileKind } & Partial<typeof BASE_SPECIAL>;
  xpToAdvance: number | null;
}

const FLAVORS: readonly EraFlavor[] = [
  {
    id: 'stone',
    name: 'Stone Age',
    units: {
      melee: { name: 'Brawler' },
      ranged: { name: 'Slinger', projectile: 'stone' },
      heavy: { name: 'Boar Rider' },
    },
    turret: { name: 'Rock Sling', projectile: 'boulder', splash: 28 },
    special: { name: 'Rockfall', projectile: 'boulder' },
    xpToAdvance: 450,
  },
  {
    id: 'bronze',
    name: 'Bronze Age',
    units: {
      melee: { name: 'Hoplite', hp: 70, damage: 9 },
      ranged: { name: 'Archer', projectile: 'arrow', range: 210 },
      heavy: { name: 'Chariot', speed: 52 },
    },
    turret: { name: 'Ballista', projectile: 'bolt', range: 470 },
    special: { name: 'Arrow Storm', projectile: 'arrow', count: 22, damage: 32, splash: 30 },
    xpToAdvance: 1100,
  },
  {
    id: 'medieval',
    name: 'Middle Ages',
    units: {
      melee: { name: 'Swordsman' },
      ranged: { name: 'Crossbowman', projectile: 'bolt', damage: 8, cooldown: 1.5 },
      heavy: { name: 'Knight', speed: 50 },
    },
    turret: { name: 'Mangonel', projectile: 'fireball', splash: 36, cooldown: 1.9, damage: 19 },
    special: { name: 'Fire Rain', projectile: 'fireball' },
    xpToAdvance: 2600,
  },
  {
    id: 'industrial',
    name: 'Industrial Age',
    units: {
      melee: { name: 'Trooper', range: 20 },
      ranged: { name: 'Marksman', projectile: 'bullet', range: 240, cooldown: 1.2 },
      heavy: { name: 'Tank', projectile: 'shell', range: 150, splash: 30, hp: 280, speed: 38 },
    },
    turret: { name: 'Gatling', projectile: 'bullet', cooldown: 0.45, damage: 5.5, range: 480 },
    special: { name: 'Artillery', projectile: 'shell', count: 12, damage: 52, splash: 55 },
    xpToAdvance: 6000,
  },
  {
    id: 'future',
    name: 'Future',
    units: {
      melee: { name: 'Blade Drone', speed: 72 },
      ranged: { name: 'Plasma Trooper', projectile: 'plasma', range: 230 },
      heavy: { name: 'Walker', projectile: 'plasma', range: 140, splash: 34, speed: 40 },
    },
    turret: { name: 'Ion Cannon', projectile: 'laser', range: 520, damage: 18 },
    special: { name: 'Orbital Lance', projectile: 'laser', count: 10, damage: 60, splash: 60 },
    xpToAdvance: null,
  },
];

const round = (value: number) => Math.round(value * 10) / 10;

export const ERAS: readonly Era[] = FLAVORS.map((flavor, era) => {
  const power = POWER[era] ?? 1;
  const unit = (role: Role): UnitType => {
    const { name, ...overrides } = flavor.units[role];
    const stats = { ...BASE_UNITS[role], ...overrides };
    return {
      ...stats,
      id: `${flavor.id}-${role}`,
      name,
      role,
      era,
      cost: Math.round(stats.cost * power),
      hp: round(stats.hp * power),
      damage: round(stats.damage * power),
    };
  };
  const turret = { ...BASE_TURRET, ...flavor.turret };
  const special = { ...BASE_SPECIAL, ...flavor.special };
  return {
    id: flavor.id,
    name: flavor.name,
    units: { melee: unit('melee'), ranged: unit('ranged'), heavy: unit('heavy') },
    turret: {
      ...turret,
      id: `${flavor.id}-turret`,
      era,
      cost: Math.round(turret.cost * power),
      damage: round(turret.damage * power),
    },
    special: { ...special, id: `${flavor.id}-special`, era, damage: round(special.damage * power) },
    baseHp: Math.round(BASE_HP * power),
    xpToAdvance: flavor.xpToAdvance,
  };
});

export const LAST_ERA = ERAS.length - 1;

/** Gold for a second base turret slot, then a third. The first comes free. */
export const SLOT_COSTS = [0, 250, 800] as const;
export const MAX_QUEUE = 5;
/** Per second, times the era's POWER. */
export const PASSIVE_GOLD = 2.5;
export const PASSIVE_XP = 1.2;
/** Share of a unit's cost paid to whoever kills it, in gold and in XP. */
export const KILL_GOLD = 0.5;
export const KILL_XP = 1.2;
/** A turret sells back for this share of its cost when replaced. */
export const TURRET_REFUND = 0.5;
export const STARTING_GOLD = 175;
/** Units hit bases this many times harder than they hit units, so a breakthrough counts. */
export const SIEGE = 2;
/**
 * Overtime: from this many seconds in, unit damage grows by OVERTIME_RAMP per minute, so an even
 * war of attrition still ends.
 */
export const OVERTIME_START = 10 * 60;
export const OVERTIME_RAMP = 0.3;
/** Sudden death: from this many seconds in, both bases crumble by this share of their health a second. */
export const CRUMBLE_START = 18 * 60;
export const CRUMBLE_RATE = 0.01;

export function era(index: number): Era {
  const found = ERAS[Math.min(Math.max(index, 0), LAST_ERA)];
  if (!found) throw new Error('No eras defined');
  return found;
}
