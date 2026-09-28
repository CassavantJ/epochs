import { WORLD } from './sim';

/**
 * How the battlefield maps onto the canvas. Wide screens see the whole lane. Narrow ones (phones
 * held upright, small windows) see a stretch of it at a readable size and pan along it.
 */
export interface View {
  /** CSS pixels per world unit. */
  scale: number;
  /** World units visible across the canvas. */
  span: number;
  /** Whether the lane is wider than the screen, so the camera pans. */
  pans: boolean;
  /** Top of the world on the canvas, in CSS pixels. */
  top: number;
  /** Left of the world on the canvas when not panning, in CSS pixels. */
  left: number;
}

/**
 * How much lane to show: about two thirds on a computer, so units are big enough to read, and a
 * little less on a phone. Very wide screens fit the whole lane.
 */
const DESKTOP_SPAN = 1100;
const PHONE_SPAN = 520;

export function createView(width: number, height: number): View {
  const wanted = width < 700 ? PHONE_SPAN : DESKTOP_SPAN;
  const scale = Math.max(Math.min(height / WORLD.height, width / wanted), 0.01);
  const span = Math.min(width / scale, WORLD.width);
  const pans = span < WORLD.width - 1;
  return {
    scale,
    span,
    pans,
    top: Math.max(0, (height - WORLD.height * scale) / 2),
    left: pans ? 0 : (width - WORLD.width * scale) / 2,
  };
}

export function clampCamera(view: View, camera: number): number {
  return view.pans ? Math.min(Math.max(camera, 0), WORLD.width - view.span) : 0;
}

/** Canvas transform for world drawing at a camera position, including the device pixel ratio. */
export function worldTransform(
  view: View,
  camera: number,
  ratio: number,
): [number, number, number, number, number, number] {
  const s = view.scale * ratio;
  return [s, 0, 0, s, (view.left - camera * view.scale) * ratio, view.top * ratio];
}

/** World x under a CSS-pixel x on the canvas. */
export function worldX(view: View, camera: number, screenX: number): number {
  return (screenX - view.left) / view.scale + camera;
}
