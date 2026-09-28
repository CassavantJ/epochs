import type { ProjectileKind } from '../data';
import { Brush, mix, type TeamPalette } from './paint';
import { STEEL, WOOD } from './people';

function rock(brush: Brush, x: number, y: number, size: number, spin: number) {
  const { ctx } = brush;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  brush.polygon('#8d8a86', [
    [-size, -size * 0.4],
    [-size * 0.3, -size],
    [size * 0.7, -size * 0.7],
    [size, size * 0.2],
    [size * 0.3, size],
    [-size * 0.8, size * 0.6],
  ]);
  brush.circle('#b3b0ab', -size * 0.25, -size * 0.3, size * 0.3, null);
  ctx.restore();
}

/** Draws a projectile at (x, y) flying along `angle` (canvas radians). */
export function drawProjectile(
  brush: Brush,
  kind: ProjectileKind,
  palette: TeamPalette,
  x: number,
  y: number,
  angle: number,
  from: { x: number; y: number },
  time: number,
): void {
  const { ctx } = brush;
  switch (kind) {
    case 'stone':
      rock(brush, x, y, 2.6, time * 12);
      return;
    case 'boulder':
      rock(brush, x, y, 5.5, time * 6);
      return;
    case 'arrow':
    case 'bolt': {
      const length = kind === 'arrow' ? 16 : 12;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      brush.capsule(WOOD, -length, 0, 0, 0, kind === 'arrow' ? 0.9 : 1.3);
      brush.polygon(STEEL, [
        [0, -2.2],
        [5, 0],
        [0, 2.2],
      ]);
      brush.polygon(palette.main, [
        [-length, 0],
        [-length - 3, -3],
        [-length + 3, 0],
        [-length - 3, 3],
      ]);
      ctx.restore();
      return;
    }
    case 'fireball': {
      const flicker = 1 + Math.sin(time * 40) * 0.12;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ff7a2f';
      ctx.beginPath();
      ctx.arc(x, y, 10 * flicker, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      brush.circle('#ff8b33', x, y, 5.5 * flicker, null);
      brush.circle('#ffd45c', x + 0.8, y - 0.8, 3.4, null);
      brush.circle('#fff4c2', x + 1.2, y - 1.2, 1.6, null);
      return;
    }
    case 'bullet': {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      const trail = ctx.createLinearGradient(-26, 0, 0, 0);
      trail.addColorStop(0, 'rgba(255, 224, 122, 0)');
      trail.addColorStop(1, 'rgba(255, 236, 170, 0.95)');
      ctx.strokeStyle = trail;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'shell': {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      brush.paint('#3f403c', (c) => {
        c.moveTo(-6, -2.6);
        c.lineTo(3, -2.6);
        c.quadraticCurveTo(8, 0, 3, 2.6);
        c.lineTo(-6, 2.6);
        c.closePath();
      });
      ctx.restore();
      return;
    }
    case 'plasma': {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = palette.glow;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      brush.circle(mix(palette.glow, '#ffffff', 0.2), x, y, 4.6, null);
      brush.circle('#ffffff', x, y, 2, null);
      return;
    }
    case 'laser': {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = palette.glow;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3;
      ctx.strokeStyle = mix(palette.glow, '#ffffff', 0.5);
      ctx.stroke();
      ctx.restore();
      return;
    }
  }
}
