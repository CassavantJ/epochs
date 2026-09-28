import { describe, expect, it } from 'vitest';

import { WORLD } from './sim';
import { clampCamera, createView, worldX } from './view';

describe('view', () => {
  it('shows the whole lane on a very wide screen', () => {
    const view = createView(2600, 500);
    expect(view.pans).toBe(false);
    expect(view.span).toBe(WORLD.width);
    expect(worldX(view, 0, view.left)).toBeCloseTo(0);
    expect(worldX(view, 0, view.left + WORLD.width * view.scale)).toBeCloseTo(WORLD.width);
  });

  it('shows about two thirds of the lane on a computer, and pans', () => {
    const view = createView(1280, 560);
    expect(view.pans).toBe(true);
    expect(view.span).toBeCloseTo(950);
  });

  it('pans on a narrow screen, keeping a readable stretch in view', () => {
    const view = createView(390, 360);
    expect(view.pans).toBe(true);
    expect(view.span).toBeGreaterThanOrEqual(500);
    expect(view.span).toBeLessThan(WORLD.width);
    expect(clampCamera(view, -50)).toBe(0);
    expect(clampCamera(view, 5000)).toBeCloseTo(WORLD.width - view.span);
    expect(worldX(view, 300, 0)).toBeCloseTo(300);
  });
});
