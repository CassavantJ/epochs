/**
 * The world behind the battle, one look per era: a sky, then far and near scenery that scroll
 * slower than the ground (parallax), then the ground itself. The player's era sets the scene.
 */
import { WORLD } from '../sim';
import { mix, shade, tint } from './paint';

export interface Scene {
  skyTop: string;
  skyBottom: string;
  sun: string;
  /** Where the sun or moon sits, as a share of the sky's width and height. */
  sunAt: [number, number];
  clouds: string | null;
  far: string;
  mid: string;
  ground: string;
  grass: string;
  stars?: boolean;
}

export const SCENES: readonly Scene[] = [
  {
    // Stone Age: a warm dawn over the savanna.
    skyTop: '#f4a97f',
    skyBottom: '#ffe3bf',
    sun: '#fff1c9',
    sunAt: [0.72, 0.52],
    clouds: '#ffe7d2',
    far: '#c48a6c',
    mid: '#a5733f',
    ground: '#7a5534',
    grass: '#9cb34d',
  },
  {
    // Bronze Age: desert noon.
    skyTop: '#6db6e8',
    skyBottom: '#f6e5b8',
    sun: '#fffbe6',
    sunAt: [0.28, 0.18],
    clouds: '#ffffff',
    far: '#d9b77e',
    mid: '#c79d5a',
    ground: '#b48a4f',
    grass: '#dcbc78',
  },
  {
    // Middle Ages: a clear green day.
    skyTop: '#4e97dd',
    skyBottom: '#cfe8f6',
    sun: '#fffbea',
    sunAt: [0.18, 0.2],
    clouds: '#ffffff',
    far: '#8ea6c4',
    mid: '#5f9b4b',
    ground: '#5f4631',
    grass: '#6aac4d',
  },
  {
    // Industrial Age: a smoky sunset.
    skyTop: '#b86b55',
    skyBottom: '#f3c08c',
    sun: '#ffe2a8',
    sunAt: [0.62, 0.6],
    clouds: '#8e6e66',
    far: '#8c6b5e',
    mid: '#6d5a4d',
    ground: '#4f4138',
    grass: '#7d8a47',
  },
  {
    // Future: a neon night.
    skyTop: '#0e1233',
    skyBottom: '#3a2c6b',
    sun: '#e8ecff',
    sunAt: [0.8, 0.22],
    clouds: null,
    far: '#262b5a',
    mid: '#1c2147',
    ground: '#1d2036',
    grass: '#4be0cf',
    stars: true,
  },
];

// Deterministic randomness so the scenery is the same every time.
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

const GROUND = WORLD.ground;

/** The sky, in screen space: gradient, sun or moon, stars, drifting clouds. */
export function paintSky(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  width: number,
  horizon: number,
  height: number,
  time: number,
  shift: number,
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, horizon);
  gradient.addColorStop(0, scene.skyTop);
  gradient.addColorStop(1, scene.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, Math.max(horizon, 1));
  ctx.fillStyle = scene.ground;
  ctx.fillRect(0, horizon, width, height - horizon);

  if (scene.stars) {
    const random = seeded(7);
    ctx.fillStyle = '#ffffff';
    for (let star = 0; star < 90; star++) {
      const x = random() * width;
      const y = random() * horizon * 0.8;
      ctx.globalAlpha = 0.3 + random() * 0.6;
      ctx.fillRect(x, y, 1.3, 1.3);
    }
    ctx.globalAlpha = 1;
  }

  const [sx, sy] = scene.sunAt;
  const sun = { x: width * sx - shift * 0.05, y: horizon * sy };
  const radius = Math.max(18, horizon * 0.09);
  const glow = ctx.createRadialGradient(sun.x, sun.y, radius * 0.5, sun.x, sun.y, radius * 4);
  glow.addColorStop(0, mix(scene.sun, scene.skyBottom, 0.2) + 'aa');
  glow.addColorStop(1, scene.sun + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(sun.x - radius * 4, sun.y - radius * 4, radius * 8, radius * 8);
  ctx.fillStyle = scene.sun;
  ctx.beginPath();
  if (scene.stars) {
    // A crescent: the disc minus an offset disc, so the sky shows through the bite.
    ctx.save();
    ctx.arc(sun.x, sun.y, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(sun.x - radius, sun.y - radius, radius * 2, radius * 2);
    ctx.arc(sun.x - radius * 0.45, sun.y - radius * 0.2, radius * 0.85, 0, Math.PI * 2);
    ctx.fill('evenodd');
    ctx.restore();
  } else {
    ctx.arc(sun.x, sun.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (scene.clouds) {
    const random = seeded(3);
    ctx.fillStyle = scene.clouds;
    for (let cloud = 0; cloud < 6; cloud++) {
      const speed = 4 + random() * 6;
      const span = width + 300;
      const x = ((((random() * span + time * speed - shift * 0.12) % span) + span) % span) - 150;
      const y = horizon * (0.12 + random() * 0.4);
      const size = (26 + random() * 30) * Math.max(0.6, horizon / 400);
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.ellipse(x, y, size * 1.6, size * 0.45, 0, 0, Math.PI * 2);
      ctx.ellipse(x - size * 0.5, y - size * 0.25, size * 0.6, size * 0.45, 0, 0, Math.PI * 2);
      ctx.ellipse(x + size * 0.4, y - size * 0.35, size * 0.75, size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------------------------
// Scenery layers, drawn once per era and size in world units.

function outline(ctx: CanvasRenderingContext2D, color: string, width = 1.2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** A ridge line across the lane from `base` up to about `peak`, filled down to the ground. */
function ridge(
  ctx: CanvasRenderingContext2D,
  color: string,
  base: number,
  peak: number,
  step: number,
  seed: number,
  smooth: boolean,
): { x: number; y: number }[] {
  const random = seeded(seed);
  const peaks: { x: number; y: number }[] = [];
  ctx.beginPath();
  ctx.moveTo(0, GROUND + 5);
  let x = -20;
  let previous = { x, y: base - random() * (base - peak) };
  ctx.lineTo(previous.x, previous.y);
  while (x < WORLD.width + 40) {
    x += step * (0.6 + random() * 0.8);
    const y = base - random() * (base - peak);
    if (smooth)
      ctx.quadraticCurveTo(previous.x + (x - previous.x) / 2, Math.min(previous.y, y) - 12, x, y);
    else ctx.lineTo(x, y);
    if (y < base - (base - peak) * 0.6) peaks.push({ x, y });
    previous = { x, y };
  }
  ctx.lineTo(WORLD.width + 40, GROUND + 5);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  outline(ctx, shade(color, 0.15));
  return peaks;
}

function tree(
  ctx: CanvasRenderingContext2D,
  kind: 'acacia' | 'palm' | 'pine',
  x: number,
  y: number,
  size: number,
  color: string,
) {
  const trunk = shade('#6b4a2a', 0.1);
  ctx.lineJoin = 'round';
  if (kind === 'pine') {
    ctx.fillStyle = trunk;
    ctx.fillRect(x - size * 0.06, y - size * 0.25, size * 0.12, size * 0.25);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let tier = 0; tier < 3; tier++) {
      const top = y - size * (0.45 + tier * 0.28);
      const half = size * (0.32 - tier * 0.08);
      ctx.moveTo(x - half, top + size * 0.32);
      ctx.lineTo(x, top);
      ctx.lineTo(x + half, top + size * 0.32);
    }
    ctx.fill();
    outline(ctx, shade(color, 0.3), 1);
    return;
  }
  ctx.strokeStyle = trunk;
  ctx.lineWidth = size * 0.08;
  ctx.beginPath();
  ctx.moveTo(x, y);
  if (kind === 'palm')
    ctx.quadraticCurveTo(x + size * 0.2, y - size * 0.5, x + size * 0.1, y - size);
  else ctx.lineTo(x, y - size * 0.6);
  ctx.stroke();
  ctx.fillStyle = color;
  if (kind === 'palm') {
    const top = { x: x + size * 0.1, y: y - size };
    for (const angle of [-2.6, -2, -1.2, -0.5, 0.2]) {
      ctx.beginPath();
      ctx.ellipse(
        top.x + Math.cos(angle) * size * 0.28,
        top.y + Math.sin(angle) * size * 0.12 + size * 0.05,
        size * 0.3,
        size * 0.07,
        angle + Math.PI / 2 + 1.2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    return;
  }
  // Acacia: a flat, wide crown.
  ctx.beginPath();
  ctx.ellipse(x, y - size * 0.68, size * 0.55, size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, shade(color, 0.25), 1);
}

function farLandmarks(ctx: CanvasRenderingContext2D, era: number, scene: Scene) {
  const random = seeded(20 + era);
  const color = tint(scene.far, 0.08);
  switch (era) {
    case 0: {
      // A smoking volcano.
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(900, GROUND);
      ctx.lineTo(1030, 150);
      ctx.lineTo(1080, 150);
      ctx.lineTo(1230, GROUND);
      ctx.fill();
      outline(ctx, shade(color, 0.2));
      ctx.fillStyle = 'rgba(120, 100, 95, 0.35)';
      for (let puff = 0; puff < 5; puff++) {
        ctx.beginPath();
        ctx.arc(1055 + puff * 14, 140 - puff * 22, 16 + puff * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 1:
      for (const [x, size] of [
        [380, 140],
        [540, 100],
        [1180, 120],
      ] as const) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x - size, GROUND);
        ctx.lineTo(x, GROUND - size);
        ctx.lineTo(x + size, GROUND);
        ctx.fill();
        outline(ctx, shade(color, 0.2));
        ctx.fillStyle = shade(color, 0.12);
        ctx.beginPath();
        ctx.moveTo(x, GROUND - size);
        ctx.lineTo(x + size, GROUND);
        ctx.lineTo(x + size * 0.25, GROUND);
        ctx.fill();
      }
      break;
    case 2:
      break;
    case 3:
      // A distant city of chimneys.
      for (let x = 100; x < WORLD.width; x += 90 + random() * 80) {
        const h = 60 + random() * 80;
        ctx.fillStyle = color;
        ctx.fillRect(x, GROUND - h, 40 + random() * 30, h);
        ctx.fillRect(x + 8, GROUND - h - 50, 9, 50);
        ctx.fillStyle = 'rgba(150, 125, 115, 0.2)';
        for (let puff = 0; puff < 4; puff++) {
          ctx.beginPath();
          ctx.arc(x + 12 + puff * 7, GROUND - h - 58 - puff * 14, 7 + puff * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    default:
      // A skyline with lit windows.
      for (let x = 20; x < WORLD.width; x += 50 + random() * 60) {
        const h = 90 + random() * 150;
        const w = 30 + random() * 26;
        ctx.fillStyle = color;
        ctx.fillRect(x, GROUND - h, w, h);
        ctx.fillStyle = 'rgba(120, 230, 255, 0.55)';
        for (let wy = GROUND - h + 8; wy < GROUND - 10; wy += 12) {
          for (let wx = x + 5; wx < x + w - 5; wx += 8) {
            if (random() > 0.55) ctx.fillRect(wx, wy, 3, 5);
          }
        }
      }
  }
}

function midProps(ctx: CanvasRenderingContext2D, era: number) {
  const random = seeded(40 + era);
  for (let x = 60; x < WORLD.width; x += 120 + random() * 160) {
    const y = GROUND - 30 - random() * 25;
    const size = 50 + random() * 40;
    switch (era) {
      case 0:
        if (random() > 0.35) tree(ctx, 'acacia', x, y, size, '#6f8a34');
        else {
          ctx.fillStyle = '#8c806e';
          ctx.beginPath();
          ctx.moveTo(x - 24, y + 20);
          ctx.lineTo(x - 20, y + 4);
          ctx.lineTo(x - 8, y - 8);
          ctx.lineTo(x + 10, y - 6);
          ctx.lineTo(x + 22, y + 6);
          ctx.lineTo(x + 25, y + 20);
          ctx.closePath();
          ctx.fill();
          outline(ctx, shade('#8c806e', 0.35), 1);
          ctx.fillStyle = tint('#8c806e', 0.25);
          ctx.beginPath();
          ctx.moveTo(x - 8, y - 6);
          ctx.lineTo(x + 8, y - 4);
          ctx.lineTo(x + 2, y + 2);
          ctx.closePath();
          ctx.fill();
        }
        break;
      case 1:
        tree(ctx, 'palm', x, y, size, '#5f8f3a');
        break;
      case 2:
        tree(ctx, 'pine', x, y, size * 0.9, '#2f6b3a');
        if (random() > 0.6) tree(ctx, 'pine', x + 22, y + 4, size * 0.7, '#357a42');
        break;
      case 3: {
        // Telegraph poles and wires.
        ctx.strokeStyle = '#4a3a30';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y + 20);
        ctx.lineTo(x, y - 60);
        ctx.moveTo(x - 12, y - 52);
        ctx.lineTo(x + 12, y - 52);
        ctx.stroke();
        break;
      }
      default: {
        // Glowing antenna masts.
        ctx.strokeStyle = '#3a3f70';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y + 20);
        ctx.lineTo(x, y - 70);
        ctx.stroke();
        ctx.fillStyle = '#ff5fa2';
        ctx.beginPath();
        ctx.arc(x, y - 72, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export type Layer = 'far' | 'mid' | 'ground';
export const PARALLAX: Record<Layer, number> = { far: 0.25, mid: 0.55, ground: 1 };

/** Paints one layer in world units (0..WORLD.width, 0..WORLD.height). */
export function paintLayer(ctx: CanvasRenderingContext2D, era: number, layer: Layer): void {
  const scene = SCENES[era] ?? SCENES[0];
  if (!scene) return;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (layer) {
    case 'far': {
      const peaks = ridge(ctx, scene.far, GROUND - 90, GROUND - 190, 90, 11 + era, era !== 2);
      if (era === 2) {
        // Snow on the sharp peaks of the far range.
        ctx.fillStyle = '#f4f6fb';
        for (const { x, y } of peaks) {
          ctx.beginPath();
          ctx.moveTo(x - 18, y + 22);
          ctx.lineTo(x, y);
          ctx.lineTo(x + 18, y + 22);
          ctx.lineTo(x + 7, y + 17);
          ctx.lineTo(x - 4, y + 24);
          ctx.closePath();
          ctx.fill();
        }
      }
      farLandmarks(ctx, era, scene);
      break;
    }
    case 'mid':
      ridge(ctx, scene.mid, GROUND - 25, GROUND - 70, 140, 31 + era, true);
      midProps(ctx, era);
      break;
    case 'ground': {
      const random = seeded(51 + era);
      const soil = ctx.createLinearGradient(0, GROUND, 0, WORLD.height);
      soil.addColorStop(0, scene.ground);
      soil.addColorStop(1, shade(scene.ground, 0.3));
      ctx.fillStyle = soil;
      ctx.fillRect(0, GROUND, WORLD.width, WORLD.height - GROUND);
      // The top edge: a grass or sand lip, or a glowing line in the future.
      ctx.fillStyle = scene.grass;
      ctx.beginPath();
      ctx.moveTo(0, GROUND - 3);
      for (let x = 0; x <= WORLD.width; x += 8) {
        ctx.lineTo(x, GROUND - 3 - (era === 4 ? 0 : random() * 3));
      }
      ctx.lineTo(WORLD.width, GROUND + 5);
      ctx.lineTo(0, GROUND + 5);
      ctx.closePath();
      ctx.fill();
      outline(ctx, shade(scene.grass, 0.3), 1);
      // Pebbles and tufts in the soil.
      for (let index = 0; index < 110; index++) {
        const x = random() * WORLD.width;
        const y = GROUND + 12 + random() * (WORLD.height - GROUND - 16);
        ctx.fillStyle = tint(scene.ground, 0.18 + random() * 0.12);
        ctx.beginPath();
        ctx.ellipse(x, y, 2 + random() * 3, 1.2 + random() * 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (era === 4) {
        ctx.strokeStyle = 'rgba(75, 224, 207, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < WORLD.width; x += 40) {
          ctx.moveTo(x, GROUND + 6);
          ctx.lineTo(x - 30, WORLD.height);
        }
        ctx.stroke();
      }
    }
  }
}
