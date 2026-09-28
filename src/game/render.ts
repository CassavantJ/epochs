import {
  drawBaseDamage,
  drawBaseShape,
  drawProjectile,
  drawTurretShape,
  drawUnitShape,
  TEAM_COLORS,
  withPens,
  type Pose,
} from './draw';
import {
  BASE_HALF,
  BASE_X,
  direction,
  TURRET_SLOTS,
  WORLD,
  type GameState,
  type Team,
  type Unit,
} from './sim';
import { Visuals } from './visuals';
import { worldTransform, type View } from './view';

const ATTACK_ANIMATION_S = 0.4;
const GROUND = WORLD.ground;

/** The landscape behind the battle, drawn once per size into its own canvas. */
export class Backdrop {
  #canvas: HTMLCanvasElement | null = null;
  #key = '';

  get(scale: number): HTMLCanvasElement {
    const key = scale.toFixed(4);
    if (this.#canvas && this.#key === key) return this.#canvas;
    const canvas = this.#canvas ?? document.createElement('canvas');
    canvas.width = Math.ceil(WORLD.width * scale);
    canvas.height = Math.ceil(WORLD.height * scale);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawBackdrop(ctx);
    }
    this.#canvas = canvas;
    this.#key = key;
    return canvas;
  }
}

function drawBackdrop(ctx: CanvasRenderingContext2D) {
  // A low moon.
  // Kept inside the top edge, or the glow would end in a hard line there.
  const moon = ctx.createRadialGradient(1120, 100, 4, 1120, 100, 95);
  moon.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
  moon.addColorStop(0.25, 'rgba(255, 255, 255, 0.08)');
  moon.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = moon;
  ctx.fillRect(1020, 0, 200, 200);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(1120, 100, 18, 0, Math.PI * 2);
  ctx.stroke();

  // Deterministic "random" for the scenery.
  let seed = 11;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  // Far mountains.
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  let x = 0;
  while (x <= WORLD.width) {
    ctx.lineTo(x, GROUND - 160 + random() * 90);
    x += 60 + random() * 70;
  }
  ctx.lineTo(WORLD.width, GROUND - 120);
  ctx.lineTo(WORLD.width, GROUND);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Near hills.
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.lineTo(0, GROUND - 40);
  for (let hill = 0; hill < 6; hill++) {
    const start = (hill * WORLD.width) / 6;
    const end = ((hill + 1) * WORLD.width) / 6;
    ctx.quadraticCurveTo(
      (start + end) / 2,
      GROUND - 80 + random() * 30,
      end,
      GROUND - 40 + random() * 12,
    );
  }
  ctx.lineTo(WORLD.width, GROUND);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.stroke();

  // Ground.
  const ground = ctx.createLinearGradient(0, GROUND, 0, WORLD.height);
  ground.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
  ground.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = ground;
  ctx.fillRect(0, GROUND, WORLD.width, WORLD.height - GROUND);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.lineTo(WORLD.width, GROUND);
  ctx.stroke();
  // Tufts and pebbles.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let tuft = 0; tuft < 90; tuft++) {
    const tx = random() * WORLD.width;
    const ty = GROUND + 6 + random() * 60;
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + 3, ty - 3);
    ctx.moveTo(tx + 3, ty);
    ctx.lineTo(tx + 5, ty - 4);
  }
  ctx.stroke();
}

function pose(unit: Unit, time: number): Pose {
  const since = time - unit.lastAttack;
  return {
    walk: unit.walked / 7,
    moving: unit.moving,
    attack: unit.lastAttack >= 0 && since < ATTACK_ANIMATION_S ? since / ATTACK_ANIMATION_S : null,
    time: time + unit.id * 0.37,
  };
}

function drawBase(ctx: CanvasRenderingContext2D, state: GameState, team: Team) {
  const side = state.sides[team];
  const dir = direction(team);
  ctx.save();
  ctx.translate(BASE_X[team], GROUND);
  ctx.scale(dir, 1);
  withPens(ctx, team, (pen) => {
    drawBaseShape(pen, side.era, state.time + team * 1.7);
  });
  drawBaseDamage(ctx, 1 - side.baseHp / side.baseMax);

  // Turret slots: empty mounts for unlocked slots, turrets where built.
  TURRET_SLOTS.forEach((slot, index) => {
    if (index >= side.slots) return;
    const turret = side.turrets[index];
    ctx.save();
    ctx.translate(slot.dx, -slot.dy);
    if (turret) {
      const recoil = Math.max(0, 1 - (state.time - turret.lastShot) / 0.2);
      withPens(ctx, team, (pen) => {
        drawTurretShape(pen, turret.type, turret.aim, recoil);
      });
    } else {
      ctx.strokeStyle = TEAM_COLORS[team].soft;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-9, -2, 18, 6);
      ctx.setLineDash([]);
    }
    ctx.restore();
  });
  ctx.restore();

  // Health bar above the base.
  const width = BASE_HALF * 1.6;
  const top = GROUND - 250;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(BASE_X[team] - width / 2, top, width, 6);
  ctx.fillStyle = TEAM_COLORS[team].line;
  ctx.fillRect(BASE_X[team] - width / 2, top, (width * side.baseHp) / side.baseMax, 6);
}

function drawUnit(ctx: CanvasRenderingContext2D, unit: Unit, time: number) {
  ctx.save();
  ctx.translate(unit.x, GROUND);
  ctx.scale(direction(unit.team), 1);
  withPens(ctx, unit.team, (pen) => {
    drawUnitShape(pen, unit.type, pose(unit, time));
  });
  ctx.restore();
}

function drawHealth(ctx: CanvasRenderingContext2D, unit: Unit) {
  if (unit.hp >= unit.type.hp) return;
  const width = Math.max(unit.type.size, 18);
  const y = GROUND - unit.type.height - 10;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(unit.x - width / 2, y, width, 3);
  ctx.fillStyle = TEAM_COLORS[unit.team].line;
  ctx.fillRect(unit.x - width / 2, y, (width * Math.max(0, unit.hp)) / unit.type.hp, 3);
}

export interface FrameOptions {
  view: View;
  camera: number;
  ratio: number;
  width: number;
  height: number;
}

/** Draws the whole battlefield. The canvas stays transparent where the page gradient shows. */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  visuals: Visuals,
  backdrop: Backdrop,
  { view, camera, ratio, width, height }: FrameOptions,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width * ratio, height * ratio);

  const shake = visuals.shake;
  const jitter =
    shake > 0 ? (Math.sin(state.time * 90) + Math.sin(state.time * 57)) * shake * 0.5 : 0;
  const [a, b, c, d, e, f] = worldTransform(view, camera - jitter, ratio);

  // The backdrop, already rendered at this scale.
  const image = backdrop.get(view.scale * ratio);
  ctx.setTransform(1, 0, 0, 1, e, f);
  ctx.drawImage(image, 0, 0);
  ctx.setTransform(a, b, c, d, e, f);

  drawBase(ctx, state, 0);
  drawBase(ctx, state, 1);

  // Fallen units: tip over backwards and fade.
  for (const corpse of visuals.corpses) {
    const progress = corpse.age / Visuals.CORPSE_S;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.translate(corpse.x, GROUND);
    ctx.scale(direction(corpse.team), 1);
    ctx.rotate(
      -Math.min(progress * 3, 1) * (Math.PI / 2) * (corpse.type.role === 'heavy' ? 0.25 : 1),
    );
    withPens(
      ctx,
      corpse.team,
      (pen) => {
        drawUnitShape(pen, corpse.type, { walk: 0, moving: false, attack: null, time: 0 });
      },
      { glow: false },
    );
    ctx.restore();
  }

  // Units back to front: the ones nearest their own base first.
  const ordered = [...state.units].sort((left, right) => left.type.size - right.type.size);
  for (const unit of ordered) drawUnit(ctx, unit, state.time);
  for (const unit of state.units) drawHealth(ctx, unit);

  for (const projectile of state.projectiles) {
    const previous = visuals.previous.get(projectile.id) ?? {
      x: projectile.fromX,
      y: projectile.fromY,
    };
    const angle = Math.atan2(projectile.y - previous.y, projectile.x - previous.x);
    drawProjectile(ctx, projectile.kind, projectile.team, projectile.x, projectile.y, angle, {
      x: projectile.fromX,
      y: projectile.fromY,
    });
  }
  visuals.previous = new Map(
    state.projectiles.map((projectile) => [projectile.id, { x: projectile.x, y: projectile.y }]),
  );

  for (const ring of visuals.rings) {
    const progress = 1 - ring.life / ring.max;
    ctx.strokeStyle = ring.color;
    ctx.globalAlpha = 0.8 * (1 - progress);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius * (0.4 + progress * 0.8), 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const particle of visuals.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.max);
    ctx.fillStyle = particle.color;
    ctx.fillRect(
      particle.x - particle.size / 2,
      particle.y - particle.size / 2,
      particle.size,
      particle.size,
    );
  }
  ctx.globalAlpha = 1;

  ctx.font = '600 13px "Inter Variable", system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const text of visuals.texts) {
    ctx.globalAlpha = Math.min(1, text.life * 2);
    ctx.fillStyle = '#ffe28a';
    ctx.fillText(text.text, text.x, text.y);
  }
  ctx.globalAlpha = 1;

  if (visuals.flash > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(255, 255, 255, ${visuals.flash * 0.5})`;
    ctx.fillRect(0, 0, width * ratio, height * ratio);
  }
}

/** The whole lane in a strip: bases, every unit as a dot, and the part that's on screen. */
export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  { width, height, ratio, view, camera }: FrameOptions,
): void {
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const scale = width / WORLD.width;
  const mid = height / 2;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(width, mid);
  ctx.stroke();
  ([0, 1] as const).forEach((team) => {
    const side = state.sides[team];
    ctx.fillStyle = TEAM_COLORS[team].line;
    const x = BASE_X[team] * scale;
    const baseWidth = BASE_HALF * 2 * scale;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x - baseWidth / 2, 3, baseWidth, height - 6);
    ctx.globalAlpha = 1;
    ctx.fillRect(x - baseWidth / 2, height - 5, (baseWidth * side.baseHp) / side.baseMax, 3);
  });
  for (const unit of state.units) {
    ctx.fillStyle = TEAM_COLORS[unit.team].line;
    const radius = unit.type.role === 'heavy' ? 3 : 2;
    ctx.beginPath();
    ctx.arc(unit.x * scale, mid, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  if (view.pans) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(camera * scale + 0.75, 0.75, view.span * scale - 1.5, height - 1.5);
  }
}
