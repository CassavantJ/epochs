/** The cartoon art: every unit, base, turret and projectile, plus the scenery. */
import type { ProjectileKind, TurretType, UnitType } from '../data';
import type { Team } from '../sim';
import { drawBase, drawBaseDamage, drawTurret } from './buildings';
import { HEAVIES } from './heavies';
import { Brush, TEAM_PALETTES } from './paint';
import { SOLDIERS, type Pose } from './people';
import { drawProjectile } from './projectiles';

export { TEAM_PALETTES, TEAM_UI } from './paint';
export { paintLayer, paintSky, PARALLAX, SCENES, type Layer } from './scenery';
export type { Pose } from './people';

/** A unit with its feet at (0, 0), facing right. */
export function drawUnitArt(
  ctx: CanvasRenderingContext2D,
  type: UnitType,
  team: Team,
  pose: Pose,
): void {
  const draw = SOLDIERS[type.id] ?? HEAVIES[type.id];
  draw?.(new Brush(ctx, pose.flash), pose, TEAM_PALETTES[team]);
}

/** A base centered at (0, 0) on the ground, facing right. `damage` runs 0–1. */
export function drawBaseArt(
  ctx: CanvasRenderingContext2D,
  era: number,
  team: Team,
  time: number,
  damage: number,
): void {
  const brush = new Brush(ctx);
  drawBase(brush, era, TEAM_PALETTES[team], time);
  drawBaseDamage(brush, damage, time);
}

export function drawTurretArt(
  ctx: CanvasRenderingContext2D,
  type: TurretType,
  team: Team,
  aim: number,
  recoil: number,
): void {
  drawTurret(new Brush(ctx), type, TEAM_PALETTES[team], aim, recoil);
}

export function drawProjectileArt(
  ctx: CanvasRenderingContext2D,
  kind: ProjectileKind,
  team: Team,
  x: number,
  y: number,
  angle: number,
  from: { x: number; y: number },
  time: number,
): void {
  drawProjectile(new Brush(ctx), kind, TEAM_PALETTES[team], x, y, angle, from, time);
}
