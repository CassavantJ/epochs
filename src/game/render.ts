import {
  drawBaseArt,
  drawProjectileArt,
  drawTurretArt,
  drawUnitArt,
  paintLayer,
  paintSky,
  PARALLAX,
  SCENES,
  TEAM_UI,
  type Layer,
  type Pose,
} from './art';
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
const LAYERS: readonly Layer[] = ['far', 'mid', 'ground'];
const SCENE_FADE_MS = 2000;

/**
 * The scenery behind the battle, cached per era and size, with a crossfade when the player
 * advances to a new era.
 */
export class Scenery {
  #cache = new Map<string, HTMLCanvasElement>();
  #scale = 0;
  #era = -1;
  #previous = -1;
  #changedAt = 0;

  /** The era to show and, during a change, the one fading out and how far along it is. */
  track(era: number, now: number): { era: number; previous: number; blend: number } {
    if (this.#era === -1) this.#era = era;
    if (era !== this.#era) {
      this.#previous = this.#era;
      this.#era = era;
      this.#changedAt = now;
    }
    const blend = Math.min(1, (now - this.#changedAt) / SCENE_FADE_MS);
    if (blend >= 1 && this.#previous !== -1) {
      // Done fading: drop the old era's images.
      for (const key of [...this.#cache.keys()]) {
        if (key.startsWith(`${this.#previous}:`)) this.#cache.delete(key);
      }
      this.#previous = -1;
    }
    return { era: this.#era, previous: this.#previous, blend };
  }

  layer(era: number, layer: Layer, scale: number): HTMLCanvasElement {
    if (scale !== this.#scale) {
      this.#cache.clear();
      this.#scale = scale;
    }
    const key = `${era}:${layer}`;
    const cached = this.#cache.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(WORLD.width * scale);
    canvas.height = Math.ceil(WORLD.height * scale);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      paintLayer(ctx, era, layer);
    }
    this.#cache.set(key, canvas);
    return canvas;
  }
}

function pose(unit: Unit, time: number, visuals: Visuals): Pose {
  const since = time - unit.lastAttack;
  return {
    walk: unit.walked / 7,
    moving: unit.moving,
    attack: unit.lastAttack >= 0 && since < ATTACK_ANIMATION_S ? since / ATTACK_ANIMATION_S : null,
    time: time + unit.id * 0.37,
    variant: unit.id,
    flash: visuals.hitFlash(unit.id, time),
  };
}

function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  share: number,
  color: string,
) {
  ctx.fillStyle = 'rgba(20, 14, 28, 0.7)';
  ctx.beginPath();
  ctx.roundRect(x - width / 2 - 1, y - 1, width + 2, height + 2, 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y, width * Math.max(0, Math.min(1, share)), height, 1.5);
  ctx.fill();
}

function drawBase(ctx: CanvasRenderingContext2D, state: GameState, team: Team) {
  const side = state.sides[team];
  ctx.save();
  ctx.translate(BASE_X[team], GROUND);
  ctx.scale(direction(team), 1);
  drawBaseArt(ctx, side.era, team, state.time + team * 1.7, 1 - side.baseHp / side.baseMax);
  TURRET_SLOTS.forEach((slot, index) => {
    if (index >= side.slots) return;
    const turret = side.turrets[index];
    ctx.save();
    ctx.translate(slot.dx, -slot.dy);
    if (turret) {
      const recoil = Math.max(0, 1 - (state.time - turret.lastShot) / 0.25);
      drawTurretArt(ctx, turret.type, team, turret.aim, recoil);
    } else {
      // An empty mount waiting for a turret.
      ctx.fillStyle = 'rgba(35, 26, 46, 0.35)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(-11, 0, 22, 5, 1.5);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  });
  ctx.restore();
  bar(
    ctx,
    BASE_X[team],
    GROUND - 250,
    BASE_HALF * 1.6,
    7,
    side.baseHp / side.baseMax,
    TEAM_UI[team],
  );
}

function drawUnit(ctx: CanvasRenderingContext2D, unit: Unit, time: number, visuals: Visuals) {
  ctx.save();
  ctx.translate(unit.x, GROUND);
  ctx.scale(direction(unit.team), 1);
  drawUnitArt(ctx, unit.type, unit.team, pose(unit, time, visuals));
  ctx.restore();
}

export interface FrameOptions {
  view: View;
  camera: number;
  ratio: number;
  width: number;
  height: number;
}

/** Draws the whole battlefield: sky, scenery, bases, units, shots and effects. */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  visuals: Visuals,
  scenery: Scenery,
  { view, camera, ratio, width, height }: FrameOptions,
): void {
  visuals.trackHits(state.units, state.time);
  const scene = scenery.track(state.sides[0].era, performance.now());
  const scale = view.scale * ratio;
  const horizon = view.top + GROUND * view.scale;

  // Sky and scenery, fading from the old era's look into the new one.
  const eras = scene.previous === -1 ? [scene.era] : [scene.previous, scene.era];
  eras.forEach((era, index) => {
    ctx.globalAlpha = index === 0 ? 1 : scene.blend;
    const look = SCENES[era] ?? SCENES[0];
    if (look) {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      paintSky(ctx, look, width, horizon, height, state.time, camera * view.scale);
    }
    for (const layer of LAYERS) {
      const image = scenery.layer(era, layer, scale);
      const offset = (view.left - camera * PARALLAX[layer] * view.scale) * ratio;
      ctx.setTransform(1, 0, 0, 1, offset, view.top * ratio);
      ctx.drawImage(image, 0, 0);
    }
  });
  ctx.globalAlpha = 1;

  const shake = visuals.shake;
  const jitter =
    shake > 0 ? (Math.sin(state.time * 90) + Math.sin(state.time * 57)) * shake * 0.5 : 0;
  ctx.setTransform(...worldTransform(view, camera - jitter, ratio));
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Only what's on screen gets drawn (plus a margin for wide mounts and long barrels).
  const left = camera - 80;
  const right = camera + view.span + 80;
  const visible = (x: number) => x >= left && x <= right;

  if (visible(BASE_X[0] + BASE_HALF) || visible(BASE_X[0] - BASE_HALF)) drawBase(ctx, state, 0);
  if (visible(BASE_X[1] + BASE_HALF) || visible(BASE_X[1] - BASE_HALF)) drawBase(ctx, state, 1);

  // Fallen units tip over and fade.
  for (const corpse of visuals.corpses) {
    if (!visible(corpse.x)) continue;
    const progress = corpse.age / Visuals.CORPSE_S;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress * progress);
    ctx.translate(corpse.x, GROUND);
    ctx.scale(direction(corpse.team), 1);
    const tip = corpse.type.role === 'heavy' ? 0.2 : 1;
    ctx.rotate(-Math.min(progress * 4, 1) * (Math.PI / 2) * tip);
    drawUnitArt(ctx, corpse.type, corpse.team, {
      walk: 0,
      moving: false,
      attack: null,
      time: 0,
      variant: corpse.id,
      flash: 0,
    });
    ctx.restore();
  }

  // Heavies behind infantry, so mounts don't hide the soldiers beside them.
  const onScreen = state.units.filter((unit) => visible(unit.x));
  const ordered = [...onScreen].sort((a, b) => b.type.size - a.type.size || a.id - b.id);
  for (const unit of ordered) drawUnit(ctx, unit, state.time, visuals);
  for (const unit of onScreen) {
    if (unit.hp < unit.type.hp) {
      const barWidth = Math.max(unit.type.size, 20);
      const y = GROUND - unit.type.height - 12;
      bar(ctx, unit.x, y, barWidth, 3.5, unit.hp / unit.type.hp, TEAM_UI[unit.team]);
    }
  }

  for (const projectile of state.projectiles) {
    const previous = visuals.previous.get(projectile.id) ?? {
      x: projectile.fromX,
      y: projectile.fromY,
    };
    const angle = Math.atan2(projectile.y - previous.y, projectile.x - previous.x);
    drawProjectileArt(
      ctx,
      projectile.kind,
      projectile.team,
      projectile.x,
      projectile.y,
      angle,
      { x: projectile.fromX, y: projectile.fromY },
      state.time,
    );
  }
  visuals.previous = new Map(
    state.projectiles.map((projectile) => [projectile.id, { x: projectile.x, y: projectile.y }]),
  );

  for (const ring of visuals.rings) {
    const progress = 1 - ring.life / ring.max;
    ctx.globalAlpha = 0.9 * (1 - progress);
    ctx.fillStyle = ring.color;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius * (0.3 + progress * 0.9), 0, Math.PI * 2);
    ctx.fill();
  }
  for (const particle of visuals.particles) {
    const life = Math.max(0, particle.life / particle.max);
    ctx.fillStyle = particle.color;
    if (particle.kind === 'spark') {
      ctx.globalAlpha = life;
      const half = particle.size / 2;
      ctx.fillRect(particle.x - half, particle.y - half, particle.size, particle.size);
    } else {
      ctx.globalAlpha = particle.kind === 'fire' ? life : life * 0.55;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  ctx.font = '700 13px "Inter Variable", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(35, 26, 46, 0.8)';
  for (const text of visuals.texts) {
    ctx.globalAlpha = Math.min(1, text.life * 2);
    ctx.strokeText(text.text, text.x, text.y);
    ctx.fillStyle = '#ffd84d';
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
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(width, mid);
  ctx.stroke();
  ([0, 1] as const).forEach((team) => {
    const side = state.sides[team];
    ctx.fillStyle = TEAM_UI[team];
    const x = BASE_X[team] * scale;
    const baseWidth = BASE_HALF * 2 * scale;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x - baseWidth / 2, 3, baseWidth, height - 6);
    ctx.globalAlpha = 1;
    ctx.fillRect(x - baseWidth / 2, height - 5, (baseWidth * side.baseHp) / side.baseMax, 3);
  });
  for (const unit of state.units) {
    ctx.fillStyle = TEAM_UI[unit.team];
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
