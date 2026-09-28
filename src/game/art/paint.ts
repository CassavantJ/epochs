/**
 * Shared painting helpers for the cartoon art: one outline color and width everywhere, flat fills
 * with a shade and a highlight, and rounded "capsule" limbs.
 */
import type { Team } from '../sim';

/** The outline color for everything, a very dark plum rather than black. */
export const INK = '#231a2e';
/** Outline width in world units, so it scales with the zoom like the art does. */
export const OUTLINE = 1.5;

export interface TeamPalette {
  main: string;
  dark: string;
  light: string;
  /** A glowing variant for energy weapons and lights. */
  glow: string;
}

export const TEAM_PALETTES: Record<Team, TeamPalette> = {
  0: { main: '#3f7fe0', dark: '#2a569f', light: '#8fbaff', glow: '#6fd6ff' },
  1: { main: '#d6473a', dark: '#982d24', light: '#ff9a8c', glow: '#ff6f9a' },
};

/** Colors for bars, the minimap and other UI-ish marks. */
export const TEAM_UI: Record<Team, string> = { 0: '#5c9dff', 1: '#ff6b57' };

export const SKIN_TONES = ['#f3cba4', '#dca47a', '#b97c52', '#8e5a38', '#f7d7bb'] as const;

const hex = (color: string): [number, number, number] => {
  const value = parseInt(color.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

/** Blends two #rrggbb colors; t = 0 gives a, 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  const channel = (x: number, y: number) =>
    Math.round(x + (y - x) * Math.min(t, 1))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(ar, br)}${channel(ag, bg)}${channel(ab, bb)}`;
}

export const shade = (color: string, amount = 0.28) => mix(color, INK, amount);
export const tint = (color: string, amount = 0.35) => mix(color, '#ffffff', amount);

/**
 * The paint for one drawing: its fills get pushed toward white while `flash` is up, which is how
 * a unit shows it was just hit.
 */
export class Brush {
  readonly ctx: CanvasRenderingContext2D;
  readonly flash: number;

  constructor(ctx: CanvasRenderingContext2D, flash = 0) {
    this.ctx = ctx;
    this.flash = flash;
  }

  color(fill: string): string {
    return this.flash > 0 ? mix(fill, '#ffffff', this.flash * 0.7) : fill;
  }

  /** Fills a path and outlines it. Pass `stroke: null` for no outline. */
  paint(
    fill: string | CanvasGradient | null,
    build: (ctx: CanvasRenderingContext2D) => void,
    { stroke = INK, width = OUTLINE }: { stroke?: string | null; width?: number } = {},
  ): void {
    const { ctx } = this;
    ctx.beginPath();
    build(ctx);
    if (fill !== null) {
      ctx.fillStyle = typeof fill === 'string' ? this.color(fill) : fill;
      ctx.fill();
    }
    if (stroke !== null) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  /** Runs `draw` clipped to the shape `build` traces, for shading that must stay inside. */
  clip(build: (ctx: CanvasRenderingContext2D) => void, draw: () => void): void {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    build(ctx);
    ctx.clip();
    draw();
    ctx.restore();
  }

  line(color: string, width: number, build: (ctx: CanvasRenderingContext2D) => void): void {
    const { ctx } = this;
    ctx.beginPath();
    build(ctx);
    ctx.strokeStyle = this.color(color);
    ctx.lineWidth = width;
    ctx.stroke();
  }

  circle(fill: string, x: number, y: number, r: number, stroke: string | null = INK): void {
    this.paint(
      fill,
      (ctx) => {
        ctx.arc(x, y, r, 0, Math.PI * 2);
      },
      { stroke },
    );
  }

  ellipse(fill: string, x: number, y: number, rx: number, ry: number, rotation = 0): void {
    this.paint(fill, (ctx) => {
      ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
    });
  }

  /** A rounded bar between two points: limbs, shafts, barrels. */
  capsule(fill: string, x1: number, y1: number, x2: number, y2: number, radius: number): void {
    this.paint(fill, (ctx) => {
      capsulePath(ctx, x1, y1, x2, y2, radius);
    });
  }

  polygon(fill: string, points: readonly (readonly [number, number])[]): void {
    this.paint(fill, (ctx) => {
      points.forEach(([x, y], index) => {
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
    });
  }
}

export function capsulePath(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius: number,
): void {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.arc(x2, y2, radius, angle - Math.PI / 2, angle + Math.PI / 2);
  ctx.arc(x1, y1, radius, angle + Math.PI / 2, angle + (Math.PI * 3) / 2);
  ctx.closePath();
}

/** A point `length` away from (x, y) at `angle`, with 0 pointing straight down and + toward +x. */
export function reach(
  x: number,
  y: number,
  angle: number,
  length: number,
): { x: number; y: number } {
  return { x: x + Math.sin(angle) * length, y: y + Math.cos(angle) * length };
}
