import { useEffect, useRef } from 'react';

import type { UnitType } from '../game/data';
import { drawUnitArt } from '../game/art';

const SIZE = 40;

/** The unit's own drawing, standing still, for its button. */
export function UnitIcon({ type }: { type: UnitType }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = SIZE * ratio;
    canvas.height = SIZE * ratio;
    // Fit the tallest part (heavies are bigger) with a little room for the glow.
    const scale = Math.min((SIZE - 6) / (type.height + 8), (SIZE - 6) / (type.size + 26));
    ctx.setTransform(ratio * scale, 0, 0, ratio * scale, (SIZE / 2) * ratio, (SIZE - 3) * ratio);
    ctx.clearRect(-SIZE, -SIZE * 2, SIZE * 4, SIZE * 4);
    drawUnitArt(ctx, type, 0, {
      walk: 0,
      moving: false,
      attack: null,
      time: 0,
      variant: 1,
      flash: 0,
    });
  }, [type]);

  return (
    <canvas
      ref={ref}
      width={SIZE}
      height={SIZE}
      aria-hidden="true"
      style={{ width: SIZE, height: SIZE }}
    />
  );
}
