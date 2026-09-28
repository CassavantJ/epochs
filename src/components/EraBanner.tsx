import { useEffect, useRef } from 'react';

import { drawUnitArt, paintLayer, SCENES } from '../game/art';
import { ERAS, ROLES } from '../game/data';
import { WORLD } from '../game/sim';
import styles from './EraBanner.module.css';

const HEIGHT = 190;
/** Scenery is painted at half size; units a little larger so they read. */
const SCENERY_SCALE = 0.5;
const UNIT_SCALE = 1.05;

/** The five eras side by side, each with its sky, land and three units. */
export function EraBanner() {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = box.current;
    const target = canvas.current;
    if (!element || !target) return;
    const paint = () => {
      const width = element.clientWidth;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      target.width = Math.round(width * ratio);
      target.height = Math.round(HEIGHT * ratio);
      const ctx = target.getContext('2d');
      if (!ctx) return;
      const slice = width / ERAS.length;
      // Narrow panels (phones) get smaller units, so the three don't pile up.
      const unitScale = Math.min(UNIT_SCALE, slice / 100);
      const ground = HEIGHT - 26;
      ERAS.forEach((entry, index) => {
        const scene = SCENES[index];
        if (!scene) return;
        const left = index * slice;
        ctx.save();
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.beginPath();
        ctx.rect(left, 0, slice + 0.5, HEIGHT);
        ctx.clip();
        const sky = ctx.createLinearGradient(0, 0, 0, ground);
        sky.addColorStop(0, scene.skyTop);
        sky.addColorStop(1, scene.skyBottom);
        ctx.fillStyle = sky;
        ctx.fillRect(left, 0, slice + 1, HEIGHT);
        // A stretch of that era's far and near scenery, lined up on the banner's ground.
        const offset = 180 + index * 240;
        for (const layer of ['far', 'mid', 'ground'] as const) {
          ctx.setTransform(
            ratio * SCENERY_SCALE,
            0,
            0,
            ratio * SCENERY_SCALE,
            (left - offset * SCENERY_SCALE) * ratio,
            (ground - WORLD.ground * SCENERY_SCALE) * ratio,
          );
          paintLayer(ctx, index, layer);
        }
        // The era's three units, marching right.
        ROLES.forEach((role, position) => {
          const type = entry.units[role];
          const x = left + slice * (0.2 + position * 0.3);
          ctx.setTransform(ratio * unitScale, 0, 0, ratio * unitScale, x * ratio, ground * ratio);
          drawUnitArt(ctx, type, 0, {
            walk: position * 1.3,
            moving: role !== 'heavy',
            attack: null,
            time: position,
            variant: index * 3 + position,
            flash: 0,
          });
        });
        ctx.restore();
      });
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={box} className={styles.banner}>
      <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
      <ol className={styles.names} aria-label="The five eras">
        {ERAS.map((entry) => (
          <li key={entry.id}>{entry.name}</li>
        ))}
      </ol>
    </div>
  );
}
