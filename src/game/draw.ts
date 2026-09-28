/**
 * Line-art drawings of every unit, base and turret, in the hub's glowing style. Each shape is
 * drawn twice with a Pen: a wide, faint pass for the glow, then the crisp line with fills.
 * Everything faces right; callers mirror the canvas for the team on the right.
 */
import type { ProjectileKind, TurretType, UnitType } from './data';
import type { Team } from './sim';

export interface Pen {
  ctx: CanvasRenderingContext2D;
  /** True on the faint glow pass: widen lines, skip fills and details. */
  glow: boolean;
  line: string;
  fill: string;
  /** A second, softer tone for secondary parts. */
  soft: string;
}

export const TEAM_COLORS: Record<Team, { line: string; glow: string; fill: string; soft: string }> =
  {
    0: {
      line: '#c4ecff',
      glow: 'rgba(140, 215, 255, 0.3)',
      fill: 'rgba(170, 225, 255, 0.16)',
      soft: 'rgba(196, 236, 255, 0.55)',
    },
    1: {
      line: '#ffc6b3',
      glow: 'rgba(255, 145, 115, 0.3)',
      fill: 'rgba(255, 170, 140, 0.16)',
      soft: 'rgba(255, 198, 179, 0.55)',
    },
  };

const LINE_WIDTH = 2.2;

/** Runs a drawing twice: glow, then line. */
export function withPens(
  ctx: CanvasRenderingContext2D,
  team: Team,
  draw: (pen: Pen) => void,
  { glow = true }: { glow?: boolean } = {},
): void {
  const colors = TEAM_COLORS[team];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (glow) {
    ctx.lineWidth = LINE_WIDTH * 3;
    ctx.strokeStyle = colors.glow;
    draw({ ctx, glow: true, line: colors.glow, fill: 'transparent', soft: colors.glow });
  }
  ctx.lineWidth = LINE_WIDTH;
  ctx.strokeStyle = colors.line;
  draw({ ctx, glow: false, line: colors.line, fill: colors.fill, soft: colors.soft });
}

// ---------------------------------------------------------------------------------------------
// Primitives

function stroke(pen: Pen, build: (ctx: CanvasRenderingContext2D) => void) {
  const { ctx } = pen;
  ctx.beginPath();
  build(ctx);
  ctx.strokeStyle = pen.line;
  ctx.stroke();
}

function shape(pen: Pen, build: (ctx: CanvasRenderingContext2D) => void, fill = pen.fill) {
  const { ctx } = pen;
  ctx.beginPath();
  build(ctx);
  if (!pen.glow && fill !== 'transparent') {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = pen.line;
  ctx.stroke();
}

function line(pen: Pen, x1: number, y1: number, x2: number, y2: number) {
  stroke(pen, (ctx) => {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  });
}

function circle(pen: Pen, x: number, y: number, r: number, fill?: string) {
  shape(
    pen,
    (ctx) => {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    },
    fill,
  );
}

function thick(pen: Pen, width: number, draw: () => void) {
  const { ctx } = pen;
  const previous = ctx.lineWidth;
  ctx.lineWidth = previous * width;
  draw();
  ctx.lineWidth = previous;
}

// ---------------------------------------------------------------------------------------------
// Units

export interface Pose {
  /** Walk cycle phase, radians. */
  walk: number;
  moving: boolean;
  /** 0–1 through the attack animation, or null when not attacking. */
  attack: number | null;
  /** Seconds of game time, for idle motion. */
  time: number;
}

const DEG = Math.PI / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A melee swing: raised back, strike through, settle. */
function swingAngle(attack: number | null, rest: number): number {
  if (attack === null) return rest;
  return attack < 0.35
    ? lerp(-70 * DEG, 65 * DEG, attack / 0.35)
    : lerp(65 * DEG, rest, (attack - 0.35) / 0.65);
}

interface Figure {
  /** Where the front hand is. */
  hand: { x: number; y: number };
  shoulder: { x: number; y: number };
}

/** A walking stick figure: head, body, legs, back arm. Returns where the front arm starts. */
function figure(
  pen: Pen,
  pose: Pose,
  {
    hat,
    scale = 1,
    legs = true,
  }: { hat?: 'helmet' | 'cap' | 'visor' | 'hood'; scale?: number; legs?: boolean } = {},
): Figure {
  const s = scale;
  const swing = pose.moving ? Math.sin(pose.walk) : 0;
  const bob = pose.moving ? Math.abs(Math.cos(pose.walk)) * 1.2 : 0;
  const hipY = -20 * s - bob;
  const shoulderY = -31 * s - bob;
  const headY = -39.5 * s - bob;

  // Legs, then the body over them.
  if (legs) {
    const stride = 7.5 * s;
    line(
      pen,
      0,
      hipY,
      swing * stride,
      -Math.max(0, Math.cos(pose.walk)) * 2.5 * (pose.moving ? 1 : 0),
    );
    line(
      pen,
      0,
      hipY,
      -swing * stride,
      -Math.max(0, -Math.cos(pose.walk)) * 2.5 * (pose.moving ? 1 : 0),
    );
  }
  line(pen, 0, hipY, 0, shoulderY + 1);
  circle(pen, 0, headY, 4.6 * s);

  if (!pen.glow && hat) {
    const { ctx } = pen;
    ctx.beginPath();
    if (hat === 'helmet') {
      ctx.arc(0, headY - 0.5, 5.6 * s, Math.PI, 0);
      ctx.moveTo(-6.5 * s, headY - 0.5);
      ctx.lineTo(6.5 * s, headY - 0.5);
    } else if (hat === 'cap') {
      ctx.moveTo(-5 * s, headY - 3.5 * s);
      ctx.lineTo(7 * s, headY - 3.5 * s);
    } else if (hat === 'visor') {
      ctx.moveTo(1 * s, headY - 1 * s);
      ctx.lineTo(4.6 * s, headY - 1 * s);
    } else {
      ctx.moveTo(-4 * s, headY - 4 * s);
      ctx.lineTo(-7 * s, headY + 3 * s);
    }
    ctx.stroke();
  }

  // The back arm swings opposite the legs.
  const backAngle = 100 * DEG - swing * 0.35;
  line(pen, 0, shoulderY, Math.cos(backAngle) * 10 * s, shoulderY + Math.sin(backAngle) * 10 * s);
  return { shoulder: { x: 0, y: shoulderY }, hand: { x: 0, y: shoulderY } };
}

function arm(pen: Pen, from: { x: number; y: number }, angle: number, length = 11) {
  const hand = { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
  line(pen, from.x, from.y, hand.x, hand.y);
  return hand;
}

function club(pen: Pen, pose: Pose) {
  const body = figure(pen, pose, { hat: 'hood' });
  const angle = swingAngle(pose.attack, 35 * DEG);
  const hand = arm(pen, body.shoulder, angle);
  const tip = { x: hand.x + Math.cos(angle - 0.5) * 13, y: hand.y + Math.sin(angle - 0.5) * 13 };
  thick(pen, 1.6, () => {
    line(pen, hand.x, hand.y, tip.x, tip.y);
  });
  circle(pen, tip.x, tip.y, 3.2, pen.soft);
}

function slinger(pen: Pen, pose: Pose) {
  const body = figure(pen, pose, { hat: 'hood' });
  const spinning = pose.attack !== null && pose.attack < 0.5;
  const angle = spinning ? -90 * DEG + (pose.attack ?? 0) * 720 * DEG : 60 * DEG;
  const hand = arm(pen, body.shoulder, spinning ? -60 * DEG : 50 * DEG);
  const end = { x: hand.x + Math.cos(angle) * 9, y: hand.y + Math.sin(angle) * 9 };
  line(pen, hand.x, hand.y, end.x, end.y);
  if (pose.attack === null || pose.attack < 0.45) circle(pen, end.x, end.y, 2);
}

function hoplite(pen: Pen, pose: Pose) {
  const body = figure(pen, pose, { hat: 'helmet' });
  const thrust = pose.attack === null ? 0 : Math.sin(Math.min(pose.attack, 1) * Math.PI) * 9;
  const y = body.shoulder.y - 2;
  thick(pen, 0.9, () => {
    line(pen, -10 + thrust, y + 3, 26 + thrust, y - 2);
  });
  stroke(pen, (ctx) => {
    ctx.moveTo(26 + thrust, y - 2);
    ctx.lineTo(21 + thrust, y - 4.5);
    ctx.moveTo(26 + thrust, y - 2);
    ctx.lineTo(21.5 + thrust, y + 0.5);
  });
  circle(pen, 6, body.shoulder.y + 5, 8);
}

function archer(pen: Pen, pose: Pose, crossbow = false) {
  const body = figure(pen, pose, { hat: crossbow ? 'helmet' : 'hood' });
  const { shoulder } = body;
  if (crossbow) {
    const y = shoulder.y + 2;
    line(pen, 0, shoulder.y, 10, y);
    thick(pen, 1.3, () => {
      line(pen, 2, y, 20, y);
    });
    stroke(pen, (ctx) => {
      ctx.moveTo(17, y - 8);
      ctx.quadraticCurveTo(21, y, 17, y + 8);
    });
    return;
  }
  const drawn = pose.attack === null ? 0 : Math.max(0, 1 - pose.attack * 3);
  const bowX = 13;
  line(pen, 0, shoulder.y, bowX, shoulder.y);
  stroke(pen, (ctx) => {
    ctx.moveTo(bowX - 3, shoulder.y - 12);
    ctx.quadraticCurveTo(bowX + 6, shoulder.y, bowX - 3, shoulder.y + 12);
  });
  const stringX = bowX - 3 - drawn * 7;
  stroke(pen, (ctx) => {
    ctx.moveTo(bowX - 3, shoulder.y - 12);
    ctx.lineTo(stringX, shoulder.y);
    ctx.lineTo(bowX - 3, shoulder.y + 12);
  });
}

function swordsman(pen: Pen, pose: Pose) {
  const body = figure(pen, pose, { hat: 'helmet' });
  // Shield in front of the body.
  shape(pen, (ctx) => {
    const x = 5;
    const y = body.shoulder.y + 1;
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x + 5, y + 9);
    ctx.lineTo(x, y + 14);
    ctx.lineTo(x - 5, y + 9);
    ctx.closePath();
  });
  const angle = swingAngle(pose.attack, 20 * DEG);
  const hand = arm(pen, body.shoulder, angle);
  const blade = angle - 0.9;
  line(pen, hand.x, hand.y, hand.x + Math.cos(blade) * 17, hand.y + Math.sin(blade) * 17);
  const guard = blade + Math.PI / 2;
  line(
    pen,
    hand.x - Math.cos(guard) * 3,
    hand.y - Math.sin(guard) * 3,
    hand.x + Math.cos(guard) * 3,
    hand.y + Math.sin(guard) * 3,
  );
}

function rifleman(pen: Pen, pose: Pose, { bayonet }: { bayonet: boolean }) {
  const body = figure(pen, pose, { hat: bayonet ? 'helmet' : 'cap' });
  const { shoulder } = body;
  const thrust =
    bayonet && pose.attack !== null ? Math.sin(Math.min(pose.attack, 1) * Math.PI) * 8 : 0;
  const recoil = !bayonet && pose.attack !== null && pose.attack < 0.2 ? -2 : 0;
  const y = shoulder.y + (bayonet ? 5 : 1);
  line(pen, 0, shoulder.y, 9 + thrust + recoil, y);
  thick(pen, 1.3, () => {
    line(pen, -3 + thrust + recoil, y + 2, (bayonet ? 18 : 24) + thrust + recoil, y - 1);
  });
  if (bayonet) line(pen, 18 + thrust, y - 1, 25 + thrust, y - 2);
  if (!bayonet && !pen.glow && pose.attack !== null && pose.attack < 0.12) {
    muzzleFlash(pen.ctx, 26 + recoil, y - 1);
  }
}

function plasmaTrooper(pen: Pen, pose: Pose) {
  const body = figure(pen, pose, { hat: 'visor' });
  const { shoulder } = body;
  const y = shoulder.y + 2;
  line(pen, 0, shoulder.y, 8, y);
  shape(pen, (ctx) => {
    ctx.roundRect(1, y - 3, 16, 6, 2);
  });
  line(pen, 17, y, 22, y);
  if (!pen.glow && pose.attack !== null && pose.attack < 0.15)
    muzzleFlash(pen.ctx, 23, y, '#9dffe0');
}

function bladeDrone(pen: Pen, pose: Pose) {
  const hover = -26 + Math.sin(pose.time * 4) * 2;
  // Body: a diamond with an eye.
  shape(pen, (ctx) => {
    ctx.moveTo(0, hover - 11);
    ctx.lineTo(8, hover);
    ctx.lineTo(0, hover + 9);
    ctx.lineTo(-8, hover);
    ctx.closePath();
  });
  circle(pen, 2.5, hover - 1, 2);
  // Thruster.
  if (!pen.glow) {
    const flicker = 5 + Math.sin(pose.time * 40) * 2;
    stroke(pen, (ctx) => {
      ctx.moveTo(-3, hover + 11);
      ctx.lineTo(0, hover + 11 + flicker);
      ctx.lineTo(3, hover + 11);
    });
  }
  const angle = swingAngle(pose.attack, 10 * DEG);
  const root = { x: 6, y: hover };
  const tip = { x: root.x + Math.cos(angle - 0.4) * 20, y: root.y + Math.sin(angle - 0.4) * 20 };
  thick(pen, 1.2, () => {
    line(pen, root.x, root.y, tip.x, tip.y);
  });
}

function legs4(pen: Pen, pose: Pose, x: number, y: number, length: number, spread: number) {
  const swing = pose.moving ? Math.sin(pose.walk * 1.3) : 0;
  for (const [offset, phase] of [
    [-spread, 1],
    [-spread + 5, -1],
    [spread - 5, -1],
    [spread, 1],
  ] as const) {
    line(pen, x + offset, y, x + offset + swing * phase * 5, y + length);
  }
}

function rider(
  pen: Pen,
  pose: Pose,
  seatX: number,
  seatY: number,
  weapon: (hand: { x: number; y: number }) => void,
) {
  const { ctx } = pen;
  ctx.save();
  // Put the hip on the saddle; riders have no legs to walk with.
  ctx.translate(seatX, seatY + 20 * 0.85);
  const still = { ...pose, moving: false };
  const body = figure(pen, still, { hat: 'helmet', scale: 0.85, legs: false });
  const hand = arm(pen, body.shoulder, swingAngle(pose.attack, 25 * DEG), 9);
  weapon(hand);
  ctx.restore();
}

function boarRider(pen: Pen, pose: Pose) {
  const bob = pose.moving ? Math.sin(pose.walk * 1.3) * 1.2 : 0;
  const y = -20 + bob;
  legs4(pen, pose, 0, y + 6, 14, 14);
  shape(pen, (ctx) => {
    ctx.ellipse(0, y, 22, 10, 0, 0, Math.PI * 2);
  });
  // Head and tusk.
  shape(pen, (ctx) => {
    ctx.moveTo(18, y - 6);
    ctx.lineTo(30, y + 1);
    ctx.lineTo(19, y + 7);
    ctx.closePath();
  });
  stroke(pen, (ctx) => {
    ctx.moveTo(26, y + 3);
    ctx.quadraticCurveTo(31, y + 5, 32, y - 1);
  });
  // Bristles along the back.
  stroke(pen, (ctx) => {
    for (let x = -12; x <= 8; x += 5) {
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x - 2, y - 13);
    }
  });
  rider(pen, pose, -2, y - 8, (hand) => {
    line(pen, hand.x, hand.y, hand.x + 10, hand.y - 6);
    circle(pen, hand.x + 10, hand.y - 6, 2.6, pen.soft);
  });
}

function horse(pen: Pen, pose: Pose, x: number, y: number) {
  legs4(pen, pose, x, y + 6, 17, 13);
  shape(pen, (ctx) => {
    ctx.ellipse(x, y, 18, 8, 0, 0, Math.PI * 2);
  });
  // Neck and head.
  stroke(pen, (ctx) => {
    ctx.moveTo(x + 14, y - 3);
    ctx.lineTo(x + 22, y - 16);
    ctx.lineTo(x + 29, y - 12);
  });
  stroke(pen, (ctx) => {
    ctx.moveTo(x - 17, y - 2);
    ctx.quadraticCurveTo(x - 25, y + 2, x - 23, y + 10);
  });
}

function chariot(pen: Pen, pose: Pose) {
  const spin = pose.walk * 0.9;
  horse(pen, pose, 16, -24);
  // Cart and wheel.
  shape(pen, (ctx) => {
    ctx.moveTo(-26, -24);
    ctx.lineTo(-4, -24);
    ctx.lineTo(-8, -12);
    ctx.lineTo(-26, -12);
    ctx.closePath();
  });
  line(pen, -4, -18, 2, -22);
  circle(pen, -15, -11, 11);
  stroke(pen, (ctx) => {
    for (let spoke = 0; spoke < 3; spoke++) {
      const angle = spin + (spoke * Math.PI) / 3;
      ctx.moveTo(-15 + Math.cos(angle) * 11, -11 + Math.sin(angle) * 11);
      ctx.lineTo(-15 - Math.cos(angle) * 11, -11 - Math.sin(angle) * 11);
    }
  });
  rider(pen, pose, -14, -24, (hand) => {
    line(pen, hand.x - 4, hand.y + 4, hand.x + 18, hand.y - 3);
  });
}

function knight(pen: Pen, pose: Pose) {
  const bob = pose.moving ? Math.sin(pose.walk * 1.3) * 1.5 : 0;
  horse(pen, pose, 0, -27 + bob);
  const couch = pose.attack === null ? 0 : Math.sin(Math.min(pose.attack, 1) * Math.PI) * 8;
  rider(pen, { ...pose, attack: null }, -4, -33 + bob, (hand) => {
    thick(pen, 1.1, () => {
      line(pen, hand.x - 8 + couch, hand.y + 3, hand.x + 30 + couch, hand.y - 1);
    });
  });
  // Pennant.
  shape(
    pen,
    (ctx) => {
      ctx.moveTo(-10, -66 + bob);
      ctx.lineTo(-2, -63 + bob);
      ctx.lineTo(-10, -60 + bob);
      ctx.closePath();
    },
    pen.soft,
  );
}

function tank(pen: Pen, pose: Pose) {
  const recoil = pose.attack !== null && pose.attack < 0.25 ? -4 : 0;
  // Tracks.
  shape(pen, (ctx) => {
    ctx.roundRect(-26, -14, 52, 13, 6.5);
  });
  stroke(pen, (ctx) => {
    for (let wheel = -18; wheel <= 18; wheel += 12) {
      ctx.moveTo(wheel + 4, -7.5);
      ctx.arc(wheel, -7.5, 4, 0, Math.PI * 2);
    }
  });
  // Hull and turret.
  shape(pen, (ctx) => {
    ctx.moveTo(-22, -14);
    ctx.lineTo(-18, -25);
    ctx.lineTo(18, -25);
    ctx.lineTo(24, -14);
  });
  shape(pen, (ctx) => {
    ctx.moveTo(-10, -25);
    ctx.quadraticCurveTo(-8, -36, 2, -36);
    ctx.quadraticCurveTo(10, -36, 11, -25);
  });
  thick(pen, 1.5, () => {
    line(pen, 8 + recoil, -31, 34 + recoil, -31);
  });
  if (!pen.glow && pose.attack !== null && pose.attack < 0.15)
    muzzleFlash(pen.ctx, 37 + recoil, -31);
}

function walker(pen: Pen, pose: Pose) {
  const swing = pose.moving ? Math.sin(pose.walk * 0.8) : 0;
  const bodyY = -44 + Math.abs(swing) * 1.5;
  // Two bent legs.
  for (const phase of [1, -1]) {
    const foot = swing * phase * 9;
    stroke(pen, (ctx) => {
      ctx.moveTo(phase * 4, bodyY + 8);
      ctx.lineTo(phase * 4 + 10 + foot * 0.5, bodyY + 26);
      ctx.lineTo(phase * 2 + foot, 0);
      ctx.moveTo(phase * 2 + foot - 6, 0);
      ctx.lineTo(phase * 2 + foot + 6, 0);
    });
  }
  shape(pen, (ctx) => {
    ctx.moveTo(-16, bodyY - 8);
    ctx.lineTo(12, bodyY - 12);
    ctx.lineTo(20, bodyY);
    ctx.lineTo(12, bodyY + 9);
    ctx.lineTo(-14, bodyY + 9);
    ctx.closePath();
  });
  // Visor and cannon.
  line(pen, 6, bodyY - 4, 15, bodyY - 5);
  const recoil = pose.attack !== null && pose.attack < 0.25 ? -3 : 0;
  thick(pen, 1.4, () => {
    line(pen, 8 + recoil, bodyY + 4, 34 + recoil, bodyY + 4);
  });
  if (!pen.glow && pose.attack !== null && pose.attack < 0.15) {
    muzzleFlash(pen.ctx, 36 + recoil, bodyY + 4, '#9dffe0');
  }
}

const UNIT_DRAWINGS: Record<string, (pen: Pen, pose: Pose) => void> = {
  'stone-melee': club,
  'stone-ranged': slinger,
  'stone-heavy': boarRider,
  'bronze-melee': hoplite,
  'bronze-ranged': (pen, pose) => {
    archer(pen, pose);
  },
  'bronze-heavy': chariot,
  'medieval-melee': swordsman,
  'medieval-ranged': (pen, pose) => {
    archer(pen, pose, true);
  },
  'medieval-heavy': knight,
  'industrial-melee': (pen, pose) => {
    rifleman(pen, pose, { bayonet: true });
  },
  'industrial-ranged': (pen, pose) => {
    rifleman(pen, pose, { bayonet: false });
  },
  'industrial-heavy': tank,
  'future-melee': bladeDrone,
  'future-ranged': plasmaTrooper,
  'future-heavy': walker,
};

/** Draws a unit with its feet at (0, 0), facing right. */
export function drawUnitShape(pen: Pen, type: UnitType, pose: Pose): void {
  (UNIT_DRAWINGS[type.id] ?? club)(pen, pose);
}

function muzzleFlash(ctx: CanvasRenderingContext2D, x: number, y: number, color = '#fff6d6') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 3);
  ctx.lineTo(x + 9, y);
  ctx.lineTo(x, y + 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Bases, drawn with the base center at x = 0 on the ground, the field to the right.

export function drawBaseShape(pen: Pen, era: number, time: number): void {
  switch (era) {
    case 0:
      cave(pen, time);
      break;
    case 1:
      mudFort(pen);
      break;
    case 2:
      castle(pen, time);
      break;
    case 3:
      factory(pen, time);
      break;
    default:
      dome(pen, time);
  }
}

function cave(pen: Pen, time: number) {
  shape(pen, (ctx) => {
    ctx.moveTo(-62, 0);
    ctx.bezierCurveTo(-66, -120, -30, -190, 8, -186);
    ctx.bezierCurveTo(50, -182, 70, -110, 64, 0);
    ctx.closePath();
  });
  // Cave mouth facing the field.
  shape(
    pen,
    (ctx) => {
      ctx.moveTo(18, 0);
      ctx.bezierCurveTo(18, -44, 58, -48, 58, 0);
    },
    'rgba(0, 0, 0, 0.35)',
  );
  // Ledges for the turret slots, and a few cracks in the rock.
  stroke(pen, (ctx) => {
    ctx.moveTo(-6, -170);
    ctx.lineTo(24, -170);
    ctx.moveTo(22, -124);
    ctx.lineTo(54, -124);
    ctx.moveTo(-40, -90);
    ctx.lineTo(-24, -70);
    ctx.lineTo(-30, -52);
  });
  if (!pen.glow) {
    const flicker = 4 + Math.sin(time * 11) * 1.5 + Math.sin(time * 17) * 1;
    const { ctx } = pen;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 190, 120, 0.85)';
    ctx.beginPath();
    ctx.moveTo(32, -2);
    ctx.quadraticCurveTo(38, -8 - flicker, 38, -14 - flicker);
    ctx.quadraticCurveTo(40, -8 - flicker, 44, -2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function crenellations(pen: Pen, left: number, right: number, y: number, size = 7) {
  stroke(pen, (ctx) => {
    ctx.moveTo(left, y);
    for (let x = left; x < right; x += size * 2) {
      ctx.lineTo(x, y - size);
      ctx.lineTo(Math.min(x + size, right), y - size);
      ctx.lineTo(Math.min(x + size, right), y);
      ctx.lineTo(Math.min(x + size * 2, right), y);
    }
  });
}

function mudFort(pen: Pen) {
  shape(pen, (ctx) => {
    ctx.moveTo(-60, 0);
    ctx.lineTo(-56, -118);
    ctx.lineTo(62, -118);
    ctx.lineTo(64, 0);
    ctx.closePath();
  });
  // Tower at the back carrying the top slot.
  shape(pen, (ctx) => {
    ctx.rect(-34, -178, 52, 60);
  });
  crenellations(pen, -34, 18, -178, 6);
  crenellations(pen, -56, 62, -118, 7);
  // Gate.
  shape(
    pen,
    (ctx) => {
      ctx.moveTo(26, 0);
      ctx.lineTo(26, -40);
      ctx.quadraticCurveTo(40, -54, 54, -40);
      ctx.lineTo(54, 0);
    },
    'rgba(0, 0, 0, 0.35)',
  );
  stroke(pen, (ctx) => {
    for (let y = -100; y < -10; y += 22) {
      ctx.moveTo(-50, y);
      ctx.lineTo(-20, y);
    }
  });
}

function castle(pen: Pen, time: number) {
  // Keep.
  shape(pen, (ctx) => {
    ctx.rect(-40, -186, 60, 186);
  });
  crenellations(pen, -40, 20, -186, 6);
  // Curtain wall toward the field.
  shape(pen, (ctx) => {
    ctx.rect(20, -130, 44, 130);
  });
  crenellations(pen, 20, 64, -130, 5.5);
  // Gatehouse with portcullis.
  shape(
    pen,
    (ctx) => {
      ctx.moveTo(30, 0);
      ctx.lineTo(30, -42);
      ctx.quadraticCurveTo(44, -58, 58, -42);
      ctx.lineTo(58, 0);
    },
    'rgba(0, 0, 0, 0.35)',
  );
  stroke(pen, (ctx) => {
    for (let x = 36; x < 58; x += 6) {
      ctx.moveTo(x, -46);
      ctx.lineTo(x, 0);
    }
    ctx.moveTo(-20, -150);
    ctx.lineTo(-20, -134);
    ctx.moveTo(-20, -100);
    ctx.lineTo(-20, -84);
  });
  // Banner on the keep.
  const wave = Math.sin(time * 3) * 3;
  line(pen, -10, -186, -10, -222);
  shape(
    pen,
    (ctx) => {
      ctx.moveTo(-10, -222);
      ctx.quadraticCurveTo(4, -218 + wave, 16, -214);
      ctx.quadraticCurveTo(4, -210 + wave, -10, -206);
      ctx.closePath();
    },
    pen.soft,
  );
}

function factory(pen: Pen, time: number) {
  shape(pen, (ctx) => {
    ctx.moveTo(-60, 0);
    ctx.lineTo(-60, -130);
    // Sawtooth roof.
    for (let x = -60; x < 40; x += 25) {
      ctx.lineTo(x + 25, -150);
      ctx.lineTo(x + 25, -130);
    }
    ctx.lineTo(64, -130);
    ctx.lineTo(64, 0);
    ctx.closePath();
  });
  // Chimney.
  shape(pen, (ctx) => {
    ctx.rect(-48, -200, 16, 70);
  });
  // Windows and a big door.
  stroke(pen, (ctx) => {
    for (let x = -46; x < 20; x += 20) {
      ctx.rect(x, -104, 12, 16);
      ctx.rect(x, -64, 12, 16);
    }
  });
  shape(
    pen,
    (ctx) => {
      ctx.rect(28, -52, 30, 52);
    },
    'rgba(0, 0, 0, 0.35)',
  );
  // Smoke puffs drifting up.
  if (!pen.glow) {
    const { ctx } = pen;
    ctx.save();
    for (let puff = 0; puff < 4; puff++) {
      const age = (time * 0.35 + puff / 4) % 1;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.16 * (1 - age)})`;
      ctx.beginPath();
      ctx.arc(-40 + age * 22, -206 - age * 70, 5 + age * 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function dome(pen: Pen, time: number) {
  shape(pen, (ctx) => {
    ctx.moveTo(-62, 0);
    ctx.lineTo(-62, -60);
    ctx.bezierCurveTo(-62, -170, 64, -170, 64, -60);
    ctx.lineTo(64, 0);
    ctx.closePath();
  });
  // Panel lines.
  stroke(pen, (ctx) => {
    ctx.moveTo(-62, -60);
    ctx.lineTo(64, -60);
    ctx.moveTo(1, -148);
    ctx.lineTo(1, -60);
    ctx.moveTo(-44, -118);
    ctx.lineTo(-28, -60);
    ctx.moveTo(46, -118);
    ctx.lineTo(30, -60);
  });
  // Antenna tower and a pulsing light.
  line(pen, 0, -148, 0, -196);
  line(pen, -8, -176, 8, -176);
  if (!pen.glow) {
    const { ctx } = pen;
    const pulse = 0.5 + Math.sin(time * 3) * 0.5;
    ctx.save();
    ctx.fillStyle = `rgba(160, 255, 230, ${0.4 + pulse * 0.6})`;
    ctx.beginPath();
    ctx.arc(0, -198, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  shape(
    pen,
    (ctx) => {
      ctx.roundRect(24, -46, 34, 46, [10, 10, 0, 0]);
    },
    'rgba(0, 0, 0, 0.35)',
  );
}

/** Cracks drawn over a damaged base; `damage` is 0 (fine) to 1 (ruined). */
export function drawBaseDamage(ctx: CanvasRenderingContext2D, damage: number): void {
  if (damage < 0.35) return;
  ctx.save();
  ctx.strokeStyle = `rgba(0, 0, 0, ${Math.min(0.6, damage * 0.7)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-20, -120);
  ctx.lineTo(-10, -90);
  ctx.lineTo(-22, -64);
  ctx.lineTo(-12, -40);
  if (damage > 0.6) {
    ctx.moveTo(30, -110);
    ctx.lineTo(18, -86);
    ctx.lineTo(28, -60);
  }
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Turrets: drawn at their slot, barrel along `aim` (0 is straight at the enemy).

export function drawTurretShape(pen: Pen, type: TurretType, aim: number, recoil: number): void {
  const { ctx } = pen;
  // Mount.
  shape(pen, (c) => {
    c.roundRect(-9, -2, 18, 6, 2);
  });
  ctx.save();
  ctx.rotate(Math.max(-1.1, Math.min(0.9, aim)));
  ctx.translate(-recoil * 3, 0);
  switch (type.era) {
    case 0:
      // A sling arm on a pivot.
      line(pen, -6, -4, 12, -9);
      circle(pen, 13, -10, 3.2, pen.soft);
      break;
    case 1:
      shape(pen, (c) => {
        c.rect(-6, -7, 20, 5);
      });
      stroke(pen, (c) => {
        c.moveTo(8, -15);
        c.quadraticCurveTo(14, -5, 8, 5);
      });
      break;
    case 2:
      line(pen, -8, -2, 14, -12);
      shape(
        pen,
        (c) => {
          c.arc(15, -13, 4, 0, Math.PI * 2);
        },
        'rgba(255, 180, 110, 0.6)',
      );
      break;
    case 3:
      shape(pen, (c) => {
        c.roundRect(-8, -8, 14, 9, 2);
      });
      stroke(pen, (c) => {
        c.moveTo(6, -6);
        c.lineTo(22, -6);
        c.moveTo(6, -3);
        c.lineTo(22, -3);
      });
      break;
    default:
      shape(pen, (c) => {
        c.ellipse(0, -5, 9, 6, 0, 0, Math.PI * 2);
      });
      thick(pen, 1.4, () => {
        line(pen, 6, -5, 24, -5);
      });
      if (!pen.glow) circle(pen, 0, -5, 2, 'rgba(160, 255, 230, 0.9)');
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Projectiles

const PROJECTILE_COLORS: Partial<Record<ProjectileKind, string>> = {
  fireball: '#ffb46b',
  plasma: '#9dffe0',
  bullet: '#fff4c9',
};

export function drawProjectile(
  ctx: CanvasRenderingContext2D,
  kind: ProjectileKind,
  team: Team,
  x: number,
  y: number,
  angle: number,
  from: { x: number; y: number },
): void {
  const color = PROJECTILE_COLORS[kind] ?? TEAM_COLORS[team].line;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  switch (kind) {
    case 'stone':
    case 'boulder':
    case 'shell': {
      const r = kind === 'boulder' ? 6 : kind === 'shell' ? 4 : 2.8;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'arrow':
    case 'bolt': {
      const length = kind === 'arrow' ? 15 : 11;
      ctx.lineWidth = kind === 'arrow' ? 1.6 : 2.6;
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(-length, 0);
      ctx.lineTo(0, 0);
      ctx.moveTo(0, 0);
      ctx.lineTo(-4, -2.5);
      ctx.moveTo(0, 0);
      ctx.lineTo(-4, 2.5);
      ctx.stroke();
      break;
    }
    case 'bullet': {
      ctx.lineWidth = 2;
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      break;
    }
    case 'fireball':
    case 'plasma': {
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'laser': {
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.lineWidth = 8;
      ctx.globalAlpha = 0.2;
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}
