/** Mounts and machines: the heavy unit of each era. Feet (or treads) at y = 0, facing right. */
import { Brush, INK, mix, reach, shade, SKIN_TONES, tint, type TeamPalette } from './paint';
import {
  arm,
  BRONZE,
  chop,
  club,
  hair,
  headband,
  heaterShield,
  HAIR,
  kettleHelm,
  kick,
  LEATHER,
  muzzleFlash,
  person,
  STEEL,
  thrust,
  WOOD,
  type Outfit,
  type Pose,
} from './people';

type Heavy = (brush: Brush, pose: Pose, palette: TeamPalette) => void;

function skinOf(pose: Pose): string {
  return SKIN_TONES[pose.variant % SKIN_TONES.length] ?? SKIN_TONES[0];
}

/** A leg with two joints, for animals: hip to knee to hoof. */
function animalLeg(
  brush: Brush,
  color: string,
  x: number,
  y: number,
  length: number,
  swing: number,
  width: number,
  hoof: string,
) {
  const knee = reach(x, y, swing * 0.5, length * 0.5);
  const foot = reach(knee.x, knee.y, swing * 0.5 - Math.max(0, swing) * 0.6, length * 0.5);
  brush.capsule(color, x, y, knee.x, knee.y, width);
  brush.capsule(color, knee.x, knee.y, foot.x, foot.y, width * 0.8);
  brush.paint(hoof, (ctx) => {
    ctx.roundRect(foot.x - width, foot.y - 1.2, width * 2.1, 2.6, 0.8);
  });
}

/** The rider's visible leg, bent over the mount's side. */
function riderLeg(brush: Brush, x: number, y: number, cloth: string, boot: string) {
  const knee = { x: x + 7, y: y + 3 };
  const ankle = { x: knee.x - 1, y: knee.y + 9 };
  brush.capsule(cloth, x, y, knee.x, knee.y, 3);
  brush.capsule(cloth, knee.x, knee.y, ankle.x, ankle.y, 2.6);
  brush.paint(boot, (ctx) => {
    ctx.ellipse(ankle.x + 1.8, ankle.y + 0.6, 3.8, 2.3, 0, 0, Math.PI * 2);
  });
}

/** Seats a rider so their hip lands on (x, y). */
function mount(brush: Brush, x: number, y: number, draw: () => void) {
  const { ctx } = brush;
  ctx.save();
  ctx.translate(x, y + 18.5);
  draw();
  ctx.restore();
}

function gait(pose: Pose, speed = 1.25): number[] {
  if (!pose.moving) return [0, 0, 0, 0];
  const phase = pose.walk * speed;
  return [
    Math.sin(phase),
    Math.sin(phase + Math.PI),
    Math.sin(phase + Math.PI * 0.5),
    Math.sin(phase + Math.PI * 1.5),
  ];
}

// ---------------------------------------------------------------------------------------------

const boarRider: Heavy = (brush, pose, palette) => {
  const fur = '#6f4a2f';
  const [a = 0, b = 0, c = 0, d = 0] = gait(pose);
  const bob = pose.moving ? Math.abs(Math.sin(pose.walk * 1.25)) * 1.2 : 0;
  const y = -21 - bob;
  // Far legs first, darker.
  animalLeg(brush, shade(fur, 0.25), 11, y + 6, 15, b, 2.8, INK);
  animalLeg(brush, shade(fur, 0.25), -12, y + 6, 15, d, 2.8, INK);
  // Tail.
  brush.line(fur, 1.6, (ctx) => {
    ctx.moveTo(-21, y - 2);
    ctx.quadraticCurveTo(-27, y - 6, -24, y - 9);
  });
  // Body and belly.
  brush.ellipse(fur, -1, y, 21, 11);
  brush.paint(
    tint(fur, 0.25),
    (ctx) => {
      ctx.ellipse(0, y + 5, 15, 5, 0, 0, Math.PI);
    },
    { stroke: null },
  );
  // Bristles along the back.
  brush.line(shade(fur, 0.45), 1.3, (ctx) => {
    for (let x = -14; x <= 10; x += 4) {
      ctx.moveTo(x, y - 9.5);
      ctx.lineTo(x - 2.5, y - 14);
    }
  });
  // Head: a wedge down to the snout.
  brush.paint(fur, (ctx) => {
    ctx.moveTo(12, y - 8);
    ctx.quadraticCurveTo(24, y - 8, 29, y + 1);
    ctx.lineTo(28, y + 7);
    ctx.quadraticCurveTo(20, y + 10, 12, y + 6);
    ctx.closePath();
  });
  brush.ellipse('#c98f7a', 29, y + 3.5, 2.6, 3.6);
  brush.circle(INK, 21, y - 2.5, 1.3, null);
  // Ear and tusk.
  brush.polygon(shade(fur, 0.2), [
    [15, y - 7],
    [18, y - 13],
    [20, y - 7],
  ]);
  brush.paint('#f4ecd8', (ctx) => {
    ctx.moveTo(24, y + 6);
    ctx.quadraticCurveTo(28, y + 7, 27, y + 1);
    ctx.quadraticCurveTo(26, y + 5, 24, y + 4);
    ctx.closePath();
  });
  // Near legs.
  animalLeg(brush, fur, 9, y + 7, 15, a, 3, INK);
  animalLeg(brush, fur, -14, y + 7, 15, c, 3, INK);
  // Rider.
  const outfit: Outfit = {
    shirt: '#9a6a3a',
    pants: '#9a6a3a',
    boots: '#6b4524',
    bareLegs: true,
    head: (b2, rig) => {
      hair(HAIR[pose.variant % HAIR.length] ?? HAIR[0])(b2, rig);
      headband(b2, rig);
    },
  };
  mount(brush, -3, y - 9, () => {
    person(
      brush,
      { ...pose, moving: false },
      palette,
      outfit,
      (b2, rig) => {
        const upper = chop(pose.attack, 1.3);
        const { hand } = arm(b2, rig, upper, upper + 0.6, outfit.shirt);
        club(b2, hand, upper + 1.3);
      },
      { legs: false },
    );
  });
  riderLeg(brush, -3, y - 9, skinOf(pose), '#6b4524');
};

function horse(
  brush: Brush,
  pose: Pose,
  x: number,
  coat: string,
  mane: string,
  { cloth }: { cloth?: TeamPalette } = {},
) {
  const [a = 0, b = 0, c = 0, d = 0] = gait(pose, 1.1);
  const bob = pose.moving ? Math.abs(Math.sin(pose.walk * 1.1)) * 1.5 : 0;
  const y = -28 - bob;
  animalLeg(brush, shade(coat, 0.22), x + 12, y + 5, 24, b, 2.4, INK);
  animalLeg(brush, shade(coat, 0.22), x - 13, y + 5, 24, d, 2.4, INK);
  // Tail.
  brush.paint(mane, (ctx) => {
    ctx.moveTo(x - 18, y - 4);
    ctx.quadraticCurveTo(x - 30, y + 2, x - 25, y + 14);
    ctx.quadraticCurveTo(x - 24, y + 4, x - 17, y);
    ctx.closePath();
  });
  brush.ellipse(coat, x, y, 19, 9);
  // Neck and head.
  brush.paint(coat, (ctx) => {
    ctx.moveTo(x + 12, y - 5);
    ctx.quadraticCurveTo(x + 18, y - 18, x + 21, y - 21);
    ctx.lineTo(x + 31, y - 15);
    ctx.quadraticCurveTo(x + 33, y - 12, x + 30, y - 11);
    ctx.lineTo(x + 24, y - 12);
    ctx.quadraticCurveTo(x + 22, y - 4, x + 16, y + 4);
    ctx.closePath();
  });
  brush.polygon(shade(coat, 0.15), [
    [x + 20, y - 21],
    [x + 21, y - 27],
    [x + 24, y - 20],
  ]);
  brush.circle(INK, x + 25, y - 16.5, 1.1, null);
  // Mane down the neck.
  brush.paint(mane, (ctx) => {
    ctx.moveTo(x + 21, y - 21);
    ctx.quadraticCurveTo(x + 14, y - 16, x + 11, y - 6);
    ctx.lineTo(x + 14, y - 7);
    ctx.quadraticCurveTo(x + 17, y - 15, x + 22, y - 19);
    ctx.closePath();
  });
  if (cloth) {
    // A caparison: cloth over the back, down to the knees, in the team's colors.
    brush.paint(cloth.main, (ctx) => {
      ctx.moveTo(x - 17, y - 4);
      ctx.quadraticCurveTo(x, y - 12, x + 15, y - 4);
      ctx.lineTo(x + 16, y + 11);
      ctx.lineTo(x + 8, y + 9);
      ctx.lineTo(x, y + 12);
      ctx.lineTo(x - 8, y + 9);
      ctx.lineTo(x - 17, y + 11);
      ctx.closePath();
    });
    brush.line('#f4efe6', 1.4, (ctx) => {
      ctx.moveTo(x - 15, y + 6);
      ctx.lineTo(x + 14, y + 6);
    });
  }
  animalLeg(brush, coat, x + 10, y + 6, 24, a, 2.6, INK);
  animalLeg(brush, coat, x - 15, y + 6, 24, c, 2.6, INK);
  return { saddle: { x: x - 2, y: y - 8 }, head: { x: x + 25, y: y - 18 } };
}

const chariot: Heavy = (brush, pose, palette) => {
  const { head } = horse(brush, pose, 18, '#8b5a2b', '#3b2616');
  // Team plume on the horse's head.
  brush.paint(palette.main, (ctx) => {
    ctx.ellipse(head.x - 2, head.y - 9, 2, 4, 0.3, 0, Math.PI * 2);
  });
  // Driver standing in the car.
  const outfit: Outfit = {
    shirt: palette.main,
    pants: palette.main,
    boots: LEATHER,
    bareLegs: true,
    head: (b, rig) => {
      hair(HAIR[(pose.variant + 3) % HAIR.length] ?? HAIR[0])(b, rig);
      b.paint(BRONZE, (ctx) => {
        ctx.arc(rig.head.x, rig.head.y - 1, 7.6, Math.PI * 1.05, Math.PI * 1.95);
        ctx.closePath();
      });
    },
  };
  const { ctx } = brush;
  ctx.save();
  ctx.translate(-14, -6);
  person(brush, { ...pose, moving: false }, palette, outfit, (b, rig) => {
    const push = thrust(pose.attack);
    const { hand } = arm(b, rig, 1.3 + push * 0.3, 1.8, outfit.shirt);
    const tip = reach(hand.x, hand.y, 1.65, 20 + push * 3);
    const butt = reach(hand.x, hand.y, 1.65, -8);
    b.capsule(WOOD, butt.x, butt.y, tip.x, tip.y, 1);
    b.polygon(BRONZE, [
      [tip.x - 1, tip.y - 2.2],
      [tip.x + 5, tip.y],
      [tip.x - 1, tip.y + 2.2],
    ]);
  });
  ctx.restore();
  // Car, pole and wheel.
  brush.capsule(WOOD, -4, -18, 10, -24, 1.3);
  brush.paint(WOOD, (c) => {
    c.moveTo(-26, -30);
    c.lineTo(-5, -30);
    c.quadraticCurveTo(-3, -20, -8, -14);
    c.lineTo(-26, -14);
    c.closePath();
  });
  brush.paint(palette.main, (c) => {
    c.roundRect(-23, -27, 14, 9, 2);
  });
  brush.circle(BRONZE, -16, -22.5, 2.2);
  const spin = pose.walk * 0.9;
  brush.circle(shade(WOOD, 0.1), -16, -12, 12);
  brush.circle(tint(WOOD, 0.15), -16, -12, 9.5, null);
  brush.line(shade(WOOD, 0.35), 1.6, (c) => {
    for (let spoke = 0; spoke < 3; spoke++) {
      const angle = spin + (spoke * Math.PI) / 3;
      c.moveTo(-16 + Math.cos(angle) * 9.5, -12 + Math.sin(angle) * 9.5);
      c.lineTo(-16 - Math.cos(angle) * 9.5, -12 - Math.sin(angle) * 9.5);
    }
  });
  brush.circle(BRONZE, -16, -12, 2.4);
};

const knight: Heavy = (brush, pose, palette) => {
  const { saddle } = horse(brush, pose, 0, '#d4d7da', '#8a8f96', { cloth: palette });
  const outfit: Outfit = {
    shirt: '#9aa4ae',
    pants: '#7d8690',
    boots: '#3c3430',
    head: kettleHelm,
    torso: (b, rig) => {
      b.paint(palette.main, (ctx) => {
        ctx.moveTo(rig.shoulder.x - 4, rig.shoulder.y + 1);
        ctx.lineTo(rig.shoulder.x + 4.5, rig.shoulder.y + 1.2);
        ctx.lineTo(rig.hip.x + 5.5, rig.hip.y + 3);
        ctx.lineTo(rig.hip.x - 4.5, rig.hip.y + 3);
        ctx.closePath();
      });
    },
  };
  const couch = thrust(pose.attack);
  mount(brush, saddle.x, saddle.y, () => {
    person(
      brush,
      { ...pose, moving: false },
      palette,
      outfit,
      (b, rig) => {
        heaterShield(b, rig.shoulder.x + 4.5, rig.shoulder.y + 9, palette);
        const { hand } = arm(b, rig, 1.2 + couch * 0.25, 1.7, outfit.shirt);
        const angle = 1.66;
        const butt = reach(hand.x + couch * 4, hand.y, angle, -10);
        const tip = reach(hand.x + couch * 4, hand.y, angle, 34);
        b.paint(palette.light, (ctx) => {
          const n = { x: Math.cos(angle), y: -Math.sin(angle) };
          ctx.moveTo(butt.x + n.x * 1.8, butt.y + n.y * 1.8);
          ctx.lineTo(tip.x, tip.y);
          ctx.lineTo(butt.x - n.x * 1.8, butt.y - n.y * 1.8);
          ctx.closePath();
        });
        const guard = reach(hand.x + couch * 4, hand.y, angle, 3);
        b.circle(STEEL, guard.x, guard.y, 2.8);
      },
      { legs: false },
    );
  });
  riderLeg(brush, saddle.x, saddle.y, '#7d8690', '#3c3430');
};

const tank: Heavy = (brush, pose, palette) => {
  const paint = mix(palette.main, '#5e6a45', 0.55);
  const recoil = kick(pose.attack) * 4;
  const roll = pose.walk * 0.5;
  // Treads and wheels.
  brush.paint('#34322f', (ctx) => {
    ctx.roundRect(-27, -14, 54, 14, 7);
  });
  for (let x = -19; x <= 19; x += 9.5) {
    brush.circle('#6b6b66', x, -7, 4.4);
    brush.line('#34322f', 1.2, (ctx) => {
      ctx.moveTo(x + Math.cos(roll) * 3.5, -7 + Math.sin(roll) * 3.5);
      ctx.lineTo(x - Math.cos(roll) * 3.5, -7 - Math.sin(roll) * 3.5);
    });
  }
  // Hull.
  brush.paint(paint, (ctx) => {
    ctx.moveTo(-26, -14);
    ctx.lineTo(-22, -25);
    ctx.lineTo(20, -25);
    ctx.lineTo(28, -14);
    ctx.closePath();
  });
  brush.paint(
    tint(paint, 0.2),
    (ctx) => {
      ctx.moveTo(-21, -24);
      ctx.lineTo(19, -24);
      ctx.lineTo(21, -21);
      ctx.lineTo(-22, -21);
      ctx.closePath();
    },
    { stroke: null },
  );
  // Barrel, then the turret over its root.
  brush.capsule('#4b5046', 8 - recoil, -33, 38 - recoil, -33, 2.2);
  brush.paint('#4b5046', (ctx) => {
    ctx.roundRect(35 - recoil, -35.5, 5, 5, 1);
  });
  brush.paint(paint, (ctx) => {
    ctx.moveTo(-12, -25);
    ctx.quadraticCurveTo(-11, -38, 2, -38);
    ctx.quadraticCurveTo(13, -38, 14, -25);
    ctx.closePath();
  });
  // Team star.
  const { ctx } = brush;
  ctx.save();
  ctx.translate(1, -31);
  brush.paint(
    palette.light,
    (c) => {
      for (let point = 0; point < 5; point++) {
        const outer = (point * Math.PI * 2) / 5 - Math.PI / 2;
        const inner = outer + Math.PI / 5;
        c.lineTo(Math.cos(outer) * 3.6, Math.sin(outer) * 3.6);
        c.lineTo(Math.cos(inner) * 1.5, Math.sin(inner) * 1.5);
      }
      c.closePath();
    },
    { stroke: null },
  );
  ctx.restore();
  brush.capsule('#3c3f38', -4, -38, 4, -38, 1.4);
  if (pose.attack !== null && pose.attack < 0.14)
    muzzleFlash(brush, { x: 40 - recoil, y: -33 }, Math.PI / 2);
};

const walker: Heavy = (brush, pose, palette) => {
  const metal = '#c5ccd6';
  const phase = pose.moving ? pose.walk * 0.9 : 0;
  const bob = pose.moving ? Math.abs(Math.sin(phase)) * 2 : Math.sin(pose.time * 2) * 0.4;
  const bodyY = -45 - bob;
  // Two legs with backward knees, far one darker.
  for (const [offset, far] of [
    [Math.PI, true],
    [0, false],
  ] as const) {
    const stride = pose.moving ? Math.sin(phase + offset) * 8 : 0;
    const lift = pose.moving ? Math.max(0, Math.cos(phase + offset)) * 3 : 0;
    const hip = { x: -2, y: bodyY + 9 };
    const knee = { x: -9 + stride * 0.4, y: bodyY + 25 };
    const foot = { x: stride, y: -1 - lift };
    const color = far ? shade(metal, 0.25) : metal;
    brush.capsule(color, hip.x, hip.y, knee.x, knee.y, 3.4);
    brush.capsule(color, knee.x, knee.y, foot.x, foot.y, 3);
    brush.circle(shade(color, 0.2), knee.x, knee.y, 3.2);
    brush.paint(shade(color, 0.3), (ctx) => {
      ctx.roundRect(foot.x - 6, foot.y - 2, 13, 3.6, 1.5);
    });
  }
  // Body.
  brush.paint(metal, (ctx) => {
    ctx.moveTo(-17, bodyY - 9);
    ctx.lineTo(10, bodyY - 12);
    ctx.lineTo(19, bodyY - 1);
    ctx.lineTo(13, bodyY + 10);
    ctx.lineTo(-15, bodyY + 10);
    ctx.closePath();
  });
  brush.paint(palette.main, (ctx) => {
    ctx.moveTo(-15, bodyY + 3);
    ctx.lineTo(8, bodyY + 3);
    ctx.lineTo(6, bodyY + 9);
    ctx.lineTo(-14, bodyY + 9);
    ctx.closePath();
  });
  // Cockpit glass.
  const glow = mix(palette.glow, '#ffffff', 0.35 + Math.sin(pose.time * 3) * 0.1);
  brush.paint(glow, (ctx) => {
    ctx.moveTo(4, bodyY - 9);
    ctx.lineTo(10, bodyY - 10);
    ctx.lineTo(16, bodyY - 2);
    ctx.lineTo(6, bodyY - 2);
    ctx.closePath();
  });
  // Cannon.
  const recoil = kick(pose.attack) * 3;
  brush.capsule('#6b7280', 6 - recoil, bodyY + 6, 32 - recoil, bodyY + 6, 2.6);
  brush.circle(palette.glow, 32 - recoil, bodyY + 6, 2.4);
  if (pose.attack !== null && pose.attack < 0.14) {
    muzzleFlash(brush, { x: 34 - recoil, y: bodyY + 6 }, Math.PI / 2, palette.glow);
  }
};

export const HEAVIES: Record<string, Heavy> = {
  'stone-heavy': boarRider,
  'bronze-heavy': chariot,
  'medieval-heavy': knight,
  'industrial-heavy': tank,
  'future-heavy': walker,
};
