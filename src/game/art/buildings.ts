/**
 * Bases and turrets. A base is drawn with its center at x = 0 on the ground, the field to the
 * right; a turret at its slot, barrel along `aim` (0 is level, toward the enemy).
 */
import type { TurretType } from '../data';
import { Brush, INK, mix, shade, tint, type TeamPalette } from './paint';
import { BRONZE, STEEL, WOOD } from './people';

type Base = (brush: Brush, palette: TeamPalette, time: number) => void;

function flag(
  brush: Brush,
  x: number,
  y: number,
  height: number,
  palette: TeamPalette,
  time: number,
) {
  brush.capsule('#6b4a2a', x, y, x, y - height, 1.1);
  const top = y - height;
  const wave = Math.sin(time * 3.2) * 1.6;
  brush.paint(palette.main, (ctx) => {
    ctx.moveTo(x + 1, top + 1);
    ctx.quadraticCurveTo(x + 9, top - 1 + wave, x + 18, top + 2);
    ctx.quadraticCurveTo(x + 15, top + 6, x + 18, top + 10);
    ctx.quadraticCurveTo(x + 9, top + 8 + wave, x + 1, top + 10);
    ctx.closePath();
  });
}

/** Horizontal courses of blocks, clipped to the current path. */
function courses(
  brush: Brush,
  color: string,
  left: number,
  right: number,
  top: number,
  bottom: number,
  height: number,
  width: number,
) {
  const { ctx } = brush;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  let row = 0;
  for (let y = bottom - height; y > top; y -= height) {
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    const offset = row % 2 === 0 ? 0 : width / 2;
    for (let x = left + offset; x < right; x += width) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + height);
    }
    row += 1;
  }
  ctx.stroke();
}

function fire(brush: Brush, x: number, y: number, size: number, time: number) {
  const { ctx } = brush;
  const flicker = Math.sin(time * 13) * 0.12 + Math.sin(time * 21) * 0.08;
  for (const [color, scale] of [
    ['#ff7a2f', 1],
    ['#ffc23d', 0.66],
    ['#fff1b0', 0.33],
  ] as const) {
    const h = size * scale * (1 + flicker);
    const w = size * scale * 0.55;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w, y - h * 0.6, x, y - h);
    ctx.quadraticCurveTo(x + w, y - h * 0.6, x + w, y);
    ctx.closePath();
    ctx.fill();
  }
}

const cave: Base = (brush, palette, time) => {
  const rock = '#8c806e';
  brush.paint(rock, (ctx) => {
    ctx.moveTo(-64, 0);
    ctx.bezierCurveTo(-70, -110, -40, -196, 6, -192);
    ctx.bezierCurveTo(50, -188, 74, -110, 66, 0);
    ctx.closePath();
  });
  // Light from the upper right, shadow low on the left.
  brush.paint(
    shade(rock, 0.18),
    (ctx) => {
      ctx.moveTo(-64, 0);
      ctx.bezierCurveTo(-68, -80, -52, -140, -30, -170);
      ctx.bezierCurveTo(-40, -120, -34, -60, -20, 0);
      ctx.closePath();
    },
    { stroke: null },
  );
  brush.paint(
    tint(rock, 0.22),
    (ctx) => {
      ctx.moveTo(10, -186);
      ctx.bezierCurveTo(40, -180, 56, -140, 58, -100);
      ctx.bezierCurveTo(46, -140, 30, -168, 10, -186);
      ctx.closePath();
    },
    { stroke: null },
  );
  // Cracks and moss.
  brush.line(shade(rock, 0.4), 1.2, (ctx) => {
    ctx.moveTo(-36, -120);
    ctx.lineTo(-26, -96);
    ctx.lineTo(-34, -70);
    ctx.moveTo(18, -150);
    ctx.lineTo(28, -128);
  });
  brush.paint(
    '#6f8f3e',
    (ctx) => {
      ctx.ellipse(-14, -186, 14, 5, -0.2, Math.PI, Math.PI * 2);
    },
    { stroke: null },
  );
  // Cave mouth.
  brush.paint('#2a2019', (ctx) => {
    ctx.moveTo(16, 0);
    ctx.bezierCurveTo(14, -50, 60, -54, 60, 0);
    ctx.closePath();
  });
  // Fire in the doorway, on a ring of stones.
  fire(brush, 38, -4, 16, time);
  brush.capsule('#6b4a2a', 28, -3, 48, -1, 2);
  for (const x of [26, 34, 42, 50]) brush.circle('#9a9185', x, -1.5, 2.6);
  flag(brush, -6, -186, 26, palette, time);
};

const mudFort: Base = (brush, palette, time) => {
  const sand = '#d8b577';
  // The tall tower at the back holds the top turret.
  brush.paint(sand, (ctx) => {
    ctx.rect(-38, -182, 54, 72);
  });
  courses(brush, shade(sand, 0.2), -38, 16, -182, -110, 9, 14);
  brush.paint(sand, (ctx) => {
    ctx.moveTo(-62, 0);
    ctx.lineTo(-58, -120);
    ctx.lineTo(64, -120);
    ctx.lineTo(66, 0);
    ctx.closePath();
  });
  courses(brush, shade(sand, 0.2), -60, 65, -120, 0, 10, 16);
  // Battlements.
  for (let x = -58; x < 62; x += 14) {
    brush.paint(sand, (ctx) => {
      ctx.rect(x, -128, 8, 8);
    });
  }
  for (let x = -38; x < 14; x += 12) {
    brush.paint(sand, (ctx) => {
      ctx.rect(x, -189, 7, 7);
    });
  }
  // Gate with wooden doors.
  brush.paint('#3a2a1a', (ctx) => {
    ctx.moveTo(24, 0);
    ctx.lineTo(24, -40);
    ctx.quadraticCurveTo(40, -56, 56, -40);
    ctx.lineTo(56, 0);
    ctx.closePath();
  });
  brush.line(WOOD, 1.2, (ctx) => {
    for (let x = 28; x < 56; x += 6) {
      ctx.moveTo(x, -3);
      ctx.lineTo(x, -40);
    }
  });
  // Hanging banners.
  for (const x of [-44, -12]) {
    brush.paint(palette.main, (ctx) => {
      ctx.moveTo(x, -112);
      ctx.lineTo(x + 12, -112);
      ctx.lineTo(x + 12, -78);
      ctx.lineTo(x + 6, -84);
      ctx.lineTo(x, -78);
      ctx.closePath();
    });
    brush.circle(BRONZE, x + 6, -100, 3.2);
  }
  flag(brush, -12, -189, 24, palette, time);
};

const castle: Base = (brush, palette, time) => {
  const stone = '#a3a8ae';
  // Keep with a pointed roof.
  brush.paint(stone, (ctx) => {
    ctx.rect(-44, -178, 58, 178);
  });
  courses(brush, shade(stone, 0.2), -44, 14, -178, 0, 10, 14);
  brush.paint(palette.main, (ctx) => {
    ctx.moveTo(-50, -178);
    ctx.lineTo(-15, -224);
    ctx.lineTo(20, -178);
    ctx.closePath();
  });
  brush.paint(
    palette.dark,
    (ctx) => {
      ctx.moveTo(-15, -224);
      ctx.lineTo(-50, -178);
      ctx.lineTo(-30, -178);
      ctx.closePath();
    },
    { stroke: null },
  );
  // Arrow slits.
  for (const y of [-150, -110, -70]) {
    brush.paint('#2f3238', (ctx) => {
      ctx.roundRect(-18, y, 4, 13, 2);
    });
  }
  // Curtain wall and gatehouse toward the field.
  brush.paint(stone, (ctx) => {
    ctx.rect(14, -120, 52, 120);
  });
  courses(brush, shade(stone, 0.2), 14, 66, -120, 0, 10, 14);
  for (let x = 14; x < 64; x += 12) {
    brush.paint(stone, (ctx) => {
      ctx.rect(x, -128, 7, 8);
    });
  }
  brush.paint('#2a2622', (ctx) => {
    ctx.moveTo(26, 0);
    ctx.lineTo(26, -44);
    ctx.quadraticCurveTo(42, -62, 58, -44);
    ctx.lineTo(58, 0);
    ctx.closePath();
  });
  brush.line('#5b5f66', 1.4, (ctx) => {
    for (let x = 30; x < 58; x += 5.5) {
      ctx.moveTo(x, -50);
      ctx.lineTo(x, -6);
    }
    for (let y = -40; y < 0; y += 8) {
      ctx.moveTo(27, y);
      ctx.lineTo(57, y);
    }
  });
  flag(brush, -15, -224, 22, palette, time);
};

const factory: Base = (brush, palette, time) => {
  const brick = '#a4553f';
  // Chimney.
  brush.paint(brick, (ctx) => {
    ctx.rect(-50, -206, 18, 80);
  });
  courses(brush, shade(brick, 0.25), -50, -32, -206, -126, 6, 9);
  brush.paint('#3b3632', (ctx) => {
    ctx.rect(-52, -212, 22, 7);
  });
  // Smoke.
  const { ctx } = brush;
  for (let puff = 0; puff < 5; puff++) {
    const age = (time * 0.3 + puff / 5) % 1;
    ctx.fillStyle = `rgba(90, 86, 84, ${0.45 * (1 - age)})`;
    ctx.beginPath();
    ctx.arc(-41 + age * 26, -216 - age * 64, 5 + age * 13, 0, Math.PI * 2);
    ctx.fill();
  }
  // Main hall with a sawtooth roof.
  brush.paint(brick, (c) => {
    c.rect(-62, -130, 128, 130);
  });
  courses(brush, shade(brick, 0.25), -62, 66, -130, 0, 7, 12);
  brush.paint('#4a4642', (c) => {
    c.moveTo(-64, -130);
    for (let x = -64; x < 62; x += 26) {
      c.lineTo(x + 20, -152);
      c.lineTo(x + 20, -130);
      c.lineTo(x + 26, -130);
    }
    c.lineTo(68, -130);
    c.closePath();
  });
  // Windows, lit.
  for (const y of [-108, -70]) {
    for (let x = -52; x < 16; x += 22) {
      brush.paint('#ffd97a', (c) => {
        c.rect(x, y, 14, 18);
      });
      brush.line('#5b4a3a', 1, (c) => {
        c.moveTo(x + 7, y);
        c.lineTo(x + 7, y + 18);
        c.moveTo(x, y + 9);
        c.lineTo(x + 14, y + 9);
      });
    }
  }
  // Loading door.
  brush.paint('#4a5058', (c) => {
    c.rect(26, -56, 34, 56);
  });
  brush.line('#353a41', 1.2, (c) => {
    for (let y = -50; y < 0; y += 6) {
      c.moveTo(27, y);
      c.lineTo(59, y);
    }
  });
  brush.paint(palette.main, (c) => {
    c.rect(26, -64, 34, 6);
  });
  flag(brush, 40, -152, 30, palette, time);
};

const dome: Base = (brush, palette, time) => {
  const shell = '#e6ebf1';
  const glow = mix(palette.glow, '#ffffff', 0.3);
  // Antenna and its blinking light.
  brush.capsule('#9aa3ad', -2, -150, -2, -212, 1.6);
  brush.capsule('#9aa3ad', -12, -190, 8, -190, 1.2);
  const blink = Math.sin(time * 4) > 0 ? 1 : 0.35;
  const { ctx } = brush;
  ctx.globalAlpha = blink;
  brush.circle(glow, -2, -214, 3.2);
  ctx.globalAlpha = 1;
  // Dome, with its shading kept inside the outline.
  const outline = (c: CanvasRenderingContext2D) => {
    c.moveTo(-64, 0);
    c.lineTo(-64, -58);
    c.bezierCurveTo(-64, -176, 66, -176, 66, -58);
    c.lineTo(66, 0);
    c.closePath();
  };
  brush.paint(shell, outline, { stroke: null });
  brush.clip(outline, () => {
    brush.paint(
      shade(shell, 0.12),
      (c) => {
        c.rect(-70, -200, 34, 200);
      },
      { stroke: null },
    );
  });
  brush.paint(null, outline);
  // Glass band and panel seams.
  brush.paint('#9fb8d6', (c) => {
    c.moveTo(-50, -96);
    c.bezierCurveTo(-30, -126, 30, -126, 52, -96);
    c.lineTo(46, -86);
    c.bezierCurveTo(26, -112, -26, -112, -44, -86);
    c.closePath();
  });
  brush.line(shade(shell, 0.25), 1, (c) => {
    c.moveTo(-64, -58);
    c.lineTo(66, -58);
    c.moveTo(1, -148);
    c.lineTo(1, -58);
  });
  // Glowing team strip.
  brush.paint(glow, (c) => {
    c.rect(-62, -40, 126, 5);
  });
  // Door.
  brush.paint('#3a4250', (c) => {
    c.roundRect(24, -48, 34, 48, [12, 12, 0, 0]);
  });
  brush.paint(
    glow,
    (c) => {
      c.rect(38, -30, 6, 3);
    },
    { stroke: null },
  );
};

const BASES: readonly Base[] = [cave, mudFort, castle, factory, dome];

export function drawBase(brush: Brush, era: number, palette: TeamPalette, time: number): void {
  (BASES[era] ?? cave)(brush, palette, time);
}

/** Cracks, smoke and flames as a base loses health. `damage` runs from 0 to 1. */
export function drawBaseDamage(brush: Brush, damage: number, time: number): void {
  const { ctx } = brush;
  if (damage > 0.3) {
    brush.line(INK, 1.6, (c) => {
      c.moveTo(-22, -130);
      c.lineTo(-12, -104);
      c.lineTo(-24, -80);
      c.lineTo(-14, -56);
      if (damage > 0.55) {
        c.moveTo(34, -112);
        c.lineTo(22, -90);
        c.lineTo(32, -66);
      }
    });
  }
  if (damage > 0.5) {
    for (let puff = 0; puff < 4; puff++) {
      const age = (time * 0.45 + puff / 4) % 1;
      ctx.fillStyle = `rgba(60, 55, 55, ${0.5 * (1 - age)})`;
      ctx.beginPath();
      ctx.arc(-10 + age * 18, -120 - age * 70, 6 + age * 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (damage > 0.75) fire(brush, -8, -112, 18, time);
}

// ---------------------------------------------------------------------------------------------
// Turrets

function mountPlate(brush: Brush, color: string) {
  brush.paint(color, (ctx) => {
    ctx.roundRect(-11, 0, 22, 5, 1.5);
  });
  brush.capsule(shade(color, 0.2), -7, 5, -9, 12, 1.2);
}

export function drawTurret(
  brush: Brush,
  type: TurretType,
  palette: TeamPalette,
  aim: number,
  recoil: number,
): void {
  const { ctx } = brush;
  const metalMount = type.era >= 3;
  mountPlate(brush, metalMount ? '#6b7280' : WOOD);
  ctx.save();
  ctx.translate(0, -3);
  ctx.rotate(Math.max(-1, Math.min(0.8, aim)));
  ctx.translate(-recoil * 3, 0);
  switch (type.era) {
    case 0: {
      // A sling arm on a log frame, loaded with a rock.
      brush.capsule(WOOD, -10, 0, 8, 0, 2.4);
      brush.capsule(shade(WOOD, 0.15), -4, -2, 12, -10 + recoil * 6, 1.6);
      brush.circle('#8d8a86', 13, -12 + recoil * 6, 3.6);
      break;
    }
    case 1: {
      brush.paint(WOOD, (c) => {
        c.roundRect(-10, -4, 26, 6, 2);
      });
      brush.line(shade(WOOD, 0.2), 2.2, (c) => {
        c.moveTo(8, -15);
        c.quadraticCurveTo(15, -1, 8, 13);
      });
      brush.line('#efe6d2', 0.8, (c) => {
        c.moveTo(8, -15);
        c.lineTo(-4 + recoil * 8, -1);
        c.lineTo(8, 13);
      });
      if (recoil < 0.3) brush.capsule(STEEL, -4, -1, 20, -1, 1);
      break;
    }
    case 2: {
      brush.paint(WOOD, (c) => {
        c.moveTo(-12, 2);
        c.lineTo(8, 2);
        c.lineTo(2, -8);
        c.closePath();
      });
      const lift = recoil * 1.2;
      const tip = { x: 4 + Math.cos(-0.9 - lift) * 16, y: -6 + Math.sin(-0.9 - lift) * 16 };
      brush.capsule(shade(WOOD, 0.1), 0, -5, tip.x, tip.y, 1.8);
      brush.circle('#4a4642', tip.x, tip.y, 3.4);
      if (recoil < 0.2) brush.circle('#ff9b3d', tip.x, tip.y - 2.5, 2.2, null);
      break;
    }
    case 3: {
      brush.paint('#5b6068', (c) => {
        c.roundRect(-9, -8, 16, 11, 2);
      });
      brush.paint(
        palette.main,
        (c) => {
          c.rect(-9, -3, 16, 3);
        },
        { stroke: null },
      );
      const spin = recoil * 3;
      for (const offset of [-2.4, 0, 2.4]) {
        brush.capsule(
          '#3c4047',
          7,
          -2.5 + offset * Math.cos(spin),
          24,
          -2.5 + offset * Math.cos(spin),
          1,
        );
      }
      brush.paint('#3c4047', (c) => {
        c.roundRect(21, -6, 4, 7, 1);
      });
      break;
    }
    default: {
      brush.paint('#e6ebf1', (c) => {
        c.roundRect(-10, -9, 22, 12, 6);
      });
      brush.capsule('#9aa3ad', 10, -3, 26, -3, 2.4);
      const glow = mix(palette.glow, '#ffffff', 0.25 + (1 - recoil) * 0.15);
      brush.circle(glow, 0, -3, 3.6);
      brush.circle(glow, 26, -3, 2.2);
    }
  }
  ctx.restore();
}
