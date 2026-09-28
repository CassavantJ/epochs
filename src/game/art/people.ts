/**
 * Foot soldiers: one jointed body (head, torso, two-part limbs) dressed per unit. Everything
 * faces right with the feet at (0, 0). Angles follow `reach`: 0 points down, + swings forward.
 */
import { Brush, INK, mix, reach, shade, SKIN_TONES, tint, type TeamPalette } from './paint';

export interface Pose {
  /** Walk cycle phase, radians. */
  walk: number;
  moving: boolean;
  /** 0–1 through the attack animation, or null. */
  attack: number | null;
  /** Seconds, for idle motion. */
  time: number;
  /** Picks a skin tone and small differences, so a line of soldiers isn't identical. */
  variant: number;
  /** 0–1: how recently it was hit. */
  flash: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rig {
  hip: Point;
  shoulder: Point;
  head: Point;
  skin: string;
  palette: TeamPalette;
  pose: Pose;
}

export interface Outfit {
  shirt: string;
  pants: string;
  boots: string;
  belt?: string;
  /** Hair or a helmet, drawn over the head. */
  head: (brush: Brush, rig: Rig) => void;
  /** Over the torso: armor, a tabard, straps. */
  torso?: (brush: Brush, rig: Rig) => void;
  /** Behind everything: a quiver, a cape. */
  back?: (brush: Brush, rig: Rig) => void;
  /** Bare legs show skin instead of `pants`. */
  bareLegs?: boolean;
}

/** Draws the front arm and whatever it holds. */
export type FrontArm = (brush: Brush, rig: Rig) => void;

const THIGH = 9;
const SHIN = 8.8;
const UPPER_ARM = 7.5;
const FOREARM = 7;

/** An arm from the shoulder; returns the elbow and hand. */
export function arm(
  brush: Brush,
  rig: Rig,
  upper: number,
  fore: number,
  sleeve: string,
  { back = false }: { back?: boolean } = {},
): { elbow: Point; hand: Point } {
  const { shoulder } = rig;
  const skin = back ? shade(rig.skin, 0.2) : rig.skin;
  const cloth = back ? shade(sleeve, 0.2) : sleeve;
  const elbow = reach(shoulder.x, shoulder.y, upper, UPPER_ARM);
  const hand = reach(elbow.x, elbow.y, fore, FOREARM);
  brush.capsule(cloth, shoulder.x, shoulder.y, elbow.x, elbow.y, 2.6);
  brush.capsule(skin, elbow.x, elbow.y, hand.x, hand.y, 2.2);
  brush.circle(skin, hand.x, hand.y, 2.5);
  return { elbow, hand };
}

function leg(brush: Brush, rig: Rig, outfit: Outfit, thigh: number, bend: number, back: boolean) {
  const { hip } = rig;
  const knee = reach(hip.x, hip.y, thigh, THIGH);
  const ankle = reach(knee.x, knee.y, thigh - bend, SHIN);
  const cloth = outfit.bareLegs ? rig.skin : outfit.pants;
  const color = back ? shade(cloth, 0.22) : cloth;
  brush.capsule(color, hip.x, hip.y, knee.x, knee.y, 3);
  brush.capsule(color, knee.x, knee.y, ankle.x, ankle.y, 2.6);
  brush.paint(back ? shade(outfit.boots, 0.2) : outfit.boots, (ctx) => {
    ctx.ellipse(ankle.x + 1.8, ankle.y + 0.2, 4, 2.4, 0, 0, Math.PI * 2);
  });
}

function torso(brush: Brush, rig: Rig, outfit: Outfit) {
  const { hip, shoulder } = rig;
  const midY = (hip.y + shoulder.y) / 2;
  brush.paint(outfit.shirt, (ctx) => {
    ctx.moveTo(hip.x - 5.5, hip.y + 2);
    ctx.quadraticCurveTo(hip.x - 7.2, midY, shoulder.x - 6.2, shoulder.y - 0.5);
    ctx.quadraticCurveTo(shoulder.x, shoulder.y - 3.8, shoulder.x + 6.4, shoulder.y);
    ctx.quadraticCurveTo(hip.x + 7.8, midY, hip.x + 6, hip.y + 2);
    ctx.closePath();
  });
  // Shade down the back, light from the front-top.
  brush.paint(
    shade(outfit.shirt, 0.16),
    (ctx) => {
      ctx.moveTo(hip.x - 5.2, hip.y + 1.4);
      ctx.quadraticCurveTo(hip.x - 6.6, midY, shoulder.x - 5.6, shoulder.y);
      ctx.quadraticCurveTo(shoulder.x - 3, midY, hip.x - 2, hip.y + 1.4);
      ctx.closePath();
    },
    { stroke: null },
  );
  if (outfit.belt) {
    brush.paint(outfit.belt, (ctx) => {
      ctx.roundRect(hip.x - 6, hip.y - 1.2, 12.2, 3, 1);
    });
  }
  outfit.torso?.(brush, rig);
}

function headShape(brush: Brush, rig: Rig) {
  const { head, shoulder, skin } = rig;
  brush.capsule(skin, shoulder.x + 0.5, shoulder.y, head.x - 0.5, head.y + 4, 2.4);
  brush.circle(skin, head.x, head.y, 7);
  // Ear, eye, brow, mouth.
  brush.circle(shade(skin, 0.1), head.x - 1.6, head.y + 0.6, 1.7);
  const { ctx } = brush;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(head.x + 3.4, head.y - 0.6, 1.05, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(head.x + 1.9, head.y - 3.2);
  ctx.lineTo(head.x + 5, head.y - 2.6);
  ctx.moveTo(head.x + 3.4, head.y + 3.4);
  ctx.lineTo(head.x + 5.6, head.y + 3);
  ctx.stroke();
}

/** A whole soldier. `legs: false` is for riders, whose legs the mount draws. */
export function person(
  brush: Brush,
  pose: Pose,
  palette: TeamPalette,
  outfit: Outfit,
  frontArm: FrontArm,
  { legs = true, backArm = true }: { legs?: boolean; backArm?: boolean } = {},
): void {
  const phase = pose.walk;
  const swing = pose.moving ? Math.sin(phase) : 0;
  const bob = pose.moving ? Math.abs(Math.cos(phase)) * 1.4 : Math.sin(pose.time * 2.2) * 0.35;
  const rig: Rig = {
    hip: { x: 0, y: -18.5 - bob },
    shoulder: { x: 1.2, y: -30.5 - bob },
    head: { x: 2.4, y: -38.5 - bob },
    skin: SKIN_TONES[pose.variant % SKIN_TONES.length] ?? SKIN_TONES[0],
    palette,
    pose,
  };

  outfit.back?.(brush, rig);
  if (backArm) {
    const angle = pose.moving ? -swing * 0.6 : -0.12;
    arm(brush, rig, angle, angle + 0.35, outfit.shirt, { back: true });
  }
  if (legs) {
    leg(
      brush,
      rig,
      outfit,
      -swing * 0.6,
      pose.moving ? Math.max(0, -Math.cos(phase)) * 0.9 : 0,
      true,
    );
  }
  torso(brush, rig, outfit);
  if (legs) {
    leg(
      brush,
      rig,
      outfit,
      swing * 0.6,
      pose.moving ? Math.max(0, Math.cos(phase)) * 0.9 : 0,
      false,
    );
  }
  headShape(brush, rig);
  outfit.head(brush, rig);
  frontArm(brush, rig);
}

// ---------------------------------------------------------------------------------------------
// Attack timing

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(Math.max(t, 0), 1);

/** A chop: from raised to struck in the first fifth, then back to rest. */
export function chop(attack: number | null, rest: number, raised = 2.8, struck = 0.5): number {
  if (attack === null) return rest;
  if (attack < 0.18) return lerp(raised, struck, attack / 0.18);
  return lerp(struck, rest, (attack - 0.18) / 0.5);
}

/** A thrust: 0 at rest, out to 1 and back. */
export function thrust(attack: number | null): number {
  if (attack === null) return 0;
  return attack < 0.15 ? attack / 0.15 : Math.max(0, 1 - (attack - 0.15) / 0.4);
}

/** Recoil for guns: a quick kick back. */
export function kick(attack: number | null): number {
  if (attack === null) return 0;
  return Math.max(0, 1 - attack / 0.25);
}

// ---------------------------------------------------------------------------------------------
// Headwear and gear

const HAIR = ['#3b2616', '#1f1612', '#6b4424', '#2c1d14', '#8a5a2c'] as const;
const WOOD = '#8a5a2e';
const STEEL = '#b9c3cc';
const BRONZE = '#c98f3c';
const LEATHER = '#6e4527';

function hair(color: string, style: 'shaggy' | 'tied' = 'shaggy') {
  return (brush: Brush, { head }: Rig) => {
    brush.paint(color, (ctx) => {
      ctx.moveTo(head.x + 5, head.y - 4.5);
      ctx.quadraticCurveTo(head.x + 1, head.y - 9.5, head.x - 5.5, head.y - 5.5);
      ctx.quadraticCurveTo(
        head.x - 9,
        head.y - 1,
        head.x - 7,
        head.y + (style === 'shaggy' ? 6 : 3),
      );
      ctx.quadraticCurveTo(head.x - 4, head.y + 1, head.x - 2.5, head.y - 3.5);
      ctx.quadraticCurveTo(head.x + 1, head.y - 5, head.x + 5, head.y - 4.5);
      ctx.closePath();
    });
    if (style === 'tied') brush.circle(color, head.x - 7.5, head.y - 4, 2.4);
  };
}

function headband(brush: Brush, { head, palette }: Rig) {
  brush.paint(palette.main, (ctx) => {
    ctx.moveTo(head.x - 6.8, head.y - 3.2);
    ctx.quadraticCurveTo(head.x, head.y - 6, head.x + 6.6, head.y - 3.4);
    ctx.lineTo(head.x + 6.8, head.y - 1.4);
    ctx.quadraticCurveTo(head.x, head.y - 4, head.x - 7, head.y - 1.2);
    ctx.closePath();
  });
  // The knot's tails.
  brush.line(palette.dark, 1.6, (ctx) => {
    ctx.moveTo(head.x - 6.8, head.y - 2.2);
    ctx.quadraticCurveTo(head.x - 10, head.y - 1, head.x - 11, head.y + 2.5);
  });
}

function bronzeHelmet(brush: Brush, { head, palette, pose }: Rig) {
  // Horsehair crest in the team color, swaying a little.
  const sway = Math.sin(pose.time * 3) * 0.6;
  brush.paint(palette.main, (ctx) => {
    ctx.moveTo(head.x - 6, head.y - 7);
    ctx.quadraticCurveTo(head.x - 1, head.y - 15 + sway, head.x + 5, head.y - 9);
    ctx.quadraticCurveTo(head.x, head.y - 11, head.x - 6, head.y - 7);
    ctx.closePath();
  });
  brush.paint(BRONZE, (ctx) => {
    ctx.moveTo(head.x - 7.5, head.y + 2);
    ctx.quadraticCurveTo(head.x - 8, head.y - 8.5, head.x, head.y - 8.5);
    ctx.quadraticCurveTo(head.x + 7.8, head.y - 8.2, head.x + 7.4, head.y - 1);
    ctx.lineTo(head.x + 2.2, head.y - 1);
    ctx.lineTo(head.x + 2, head.y + 4);
    ctx.lineTo(head.x - 3, head.y + 4);
    ctx.closePath();
  });
  brush.paint(
    tint(BRONZE, 0.4),
    (ctx) => {
      ctx.ellipse(head.x + 1, head.y - 5.8, 3.4, 1.4, -0.2, 0, Math.PI * 2);
    },
    { stroke: null },
  );
}

function clothCap(brush: Brush, { head, palette }: Rig) {
  brush.paint(palette.main, (ctx) => {
    ctx.moveTo(head.x - 7.4, head.y - 1);
    ctx.quadraticCurveTo(head.x - 6.5, head.y - 9.5, head.x + 1, head.y - 9);
    ctx.quadraticCurveTo(head.x + 7.5, head.y - 8, head.x + 7.2, head.y - 3);
    ctx.lineTo(head.x - 7.4, head.y - 1);
    ctx.closePath();
  });
  brush.line(palette.light, 1.2, (ctx) => {
    ctx.moveTo(head.x - 3, head.y - 7.5);
    ctx.lineTo(head.x + 2, head.y - 8);
  });
}

function kettleHelm(brush: Brush, { head }: Rig) {
  brush.paint(STEEL, (ctx) => {
    ctx.moveTo(head.x - 10, head.y - 2);
    ctx.lineTo(head.x + 10.5, head.y - 2.5);
    ctx.quadraticCurveTo(head.x + 6, head.y - 4, head.x + 5.5, head.y - 5);
    ctx.quadraticCurveTo(head.x + 4, head.y - 11, head.x - 1, head.y - 11);
    ctx.quadraticCurveTo(head.x - 5.5, head.y - 11, head.x - 5.8, head.y - 4.6);
    ctx.quadraticCurveTo(head.x - 7, head.y - 3.8, head.x - 10, head.y - 2);
    ctx.closePath();
  });
  brush.paint(
    tint(STEEL, 0.5),
    (ctx) => {
      ctx.ellipse(head.x - 1, head.y - 8.5, 2.2, 1, 0, 0, Math.PI * 2);
    },
    { stroke: null },
  );
}

function sallet(brush: Brush, { head }: Rig) {
  brush.paint(STEEL, (ctx) => {
    ctx.moveTo(head.x - 9.5, head.y + 1.5);
    ctx.quadraticCurveTo(head.x - 8, head.y - 10, head.x + 1, head.y - 9.5);
    ctx.quadraticCurveTo(head.x + 7.8, head.y - 8.5, head.x + 7.6, head.y - 2.6);
    ctx.lineTo(head.x - 2, head.y - 2.6);
    ctx.lineTo(head.x - 5, head.y + 1);
    ctx.closePath();
  });
}

function brodieHelmet(brush: Brush, { head, palette }: Rig) {
  const olive = '#5f6a45';
  brush.paint(olive, (ctx) => {
    ctx.moveTo(head.x - 10, head.y - 2.5);
    ctx.quadraticCurveTo(head.x, head.y - 1.5, head.x + 10, head.y - 3);
    ctx.quadraticCurveTo(head.x + 6, head.y - 4.5, head.x + 5.4, head.y - 6);
    ctx.quadraticCurveTo(head.x + 1, head.y - 11.5, head.x - 4.5, head.y - 6.5);
    ctx.quadraticCurveTo(head.x - 6, head.y - 4, head.x - 10, head.y - 2.5);
    ctx.closePath();
  });
  brush.line(palette.main, 1.8, (ctx) => {
    ctx.moveTo(head.x - 4.6, head.y - 5);
    ctx.quadraticCurveTo(head.x, head.y - 6.8, head.x + 5, head.y - 5.2);
  });
}

function peakedCap(brush: Brush, { head, palette }: Rig) {
  brush.paint(palette.dark, (ctx) => {
    ctx.moveTo(head.x - 7, head.y - 2.5);
    ctx.quadraticCurveTo(head.x - 7.5, head.y - 10.5, head.x + 1, head.y - 10);
    ctx.quadraticCurveTo(head.x + 7, head.y - 9.5, head.x + 6.5, head.y - 3.5);
    ctx.closePath();
  });
  brush.paint(INK, (ctx) => {
    ctx.moveTo(head.x + 1, head.y - 3.6);
    ctx.quadraticCurveTo(head.x + 8, head.y - 4.2, head.x + 11, head.y - 2.4);
    ctx.lineTo(head.x + 5, head.y - 2.2);
    ctx.closePath();
  });
  brush.circle('#e9c66a', head.x + 2.8, head.y - 7, 1.2);
}

function visorHelmet(brush: Brush, { head, palette, pose }: Rig) {
  brush.paint('#e8edf3', (ctx) => {
    ctx.arc(head.x, head.y - 0.5, 8.4, Math.PI * 0.62, Math.PI * 2.2);
    ctx.closePath();
  });
  const pulse = 0.7 + Math.sin(pose.time * 5) * 0.3;
  brush.paint(mix(palette.glow, '#ffffff', 0.3 * pulse), (ctx) => {
    ctx.roundRect(head.x + 0.5, head.y - 3.2, 8.4, 3.6, 1.6);
  });
  brush.line(palette.main, 1.4, (ctx) => {
    ctx.moveTo(head.x - 6.4, head.y - 5);
    ctx.lineTo(head.x - 2, head.y - 7.8);
  });
}

function quiver(brush: Brush, { shoulder, palette }: Rig) {
  brush.paint(LEATHER, (ctx) => {
    ctx.save();
    ctx.translate(shoulder.x - 6.5, shoulder.y + 4);
    ctx.rotate(-0.35);
    ctx.roundRect(-2.6, -10, 5.2, 16, 2);
    ctx.restore();
  });
  brush.line('#d9c9a3', 1.3, (ctx) => {
    for (const offset of [-1.2, 0.4, 1.8]) {
      ctx.moveTo(shoulder.x - 4.5 + offset, shoulder.y - 5.5);
      ctx.lineTo(shoulder.x - 1.8 + offset, shoulder.y - 12);
    }
  });
  brush.line(palette.main, 1.6, (ctx) => {
    ctx.moveTo(shoulder.x - 8.4, shoulder.y + 3);
    ctx.lineTo(shoulder.x - 3.8, shoulder.y + 0.8);
  });
}

function peltSpots(brush: Brush, { hip, shoulder }: Rig) {
  const { ctx } = brush;
  ctx.fillStyle = brush.color('#5c3a1e');
  for (const [dx, dy] of [
    [-2.5, 0.35],
    [2.5, 0.55],
    [0, 0.75],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(hip.x + dx, hip.y + (shoulder.y - hip.y) * dy, 1.5, 1.1, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function warPaint(brush: Brush, { head, palette }: Rig) {
  brush.line(palette.main, 1.4, (ctx) => {
    ctx.moveTo(head.x + 1.5, head.y + 1.6);
    ctx.lineTo(head.x + 5.5, head.y + 1);
  });
}

function tabard(brush: Brush, { hip, shoulder, palette }: Rig) {
  brush.paint(palette.main, (ctx) => {
    ctx.moveTo(shoulder.x - 4, shoulder.y + 1);
    ctx.lineTo(shoulder.x + 4.5, shoulder.y + 1.2);
    ctx.lineTo(hip.x + 5.5, hip.y + 6);
    ctx.lineTo(hip.x - 4.5, hip.y + 6);
    ctx.closePath();
  });
  brush.line('#f4efe6', 1.6, (ctx) => {
    const cx = (shoulder.x + hip.x) / 2 + 0.6;
    const cy = (shoulder.y + hip.y) / 2;
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx, cy + 4);
    ctx.moveTo(cx - 3, cy - 1);
    ctx.lineTo(cx + 3, cy - 1);
  });
}

function sash(brush: Brush, { hip, shoulder, palette }: Rig) {
  brush.line(palette.main, 2.6, (ctx) => {
    ctx.moveTo(shoulder.x - 4.5, shoulder.y + 0.5);
    ctx.lineTo(hip.x + 5, hip.y - 0.5);
  });
}

function cuirass(brush: Brush, { hip, shoulder }: Rig) {
  brush.paint(BRONZE, (ctx) => {
    ctx.moveTo(shoulder.x - 5.4, shoulder.y + 1.4);
    ctx.quadraticCurveTo(shoulder.x + 1, shoulder.y - 1.5, shoulder.x + 6, shoulder.y + 1);
    ctx.quadraticCurveTo(hip.x + 7, (hip.y + shoulder.y) / 2, hip.x + 5, hip.y - 1);
    ctx.lineTo(hip.x - 4.5, hip.y - 1);
    ctx.quadraticCurveTo(hip.x - 6, (hip.y + shoulder.y) / 2, shoulder.x - 5.4, shoulder.y + 1.4);
    ctx.closePath();
  });
  brush.paint(
    tint(BRONZE, 0.45),
    (ctx) => {
      ctx.ellipse(shoulder.x + 2, shoulder.y + 4, 2.4, 1.3, -0.4, 0, Math.PI * 2);
    },
    { stroke: null },
  );
}

function armorStripes(brush: Brush, { hip, shoulder, palette, pose }: Rig) {
  const glow = mix(palette.glow, '#ffffff', 0.25 + Math.sin(pose.time * 4) * 0.15);
  brush.line(glow, 1.6, (ctx) => {
    ctx.moveTo(shoulder.x + 3, shoulder.y + 2);
    ctx.lineTo(hip.x + 3.5, hip.y - 2);
  });
  brush.paint('#c8d1dc', (ctx) => {
    ctx.roundRect(hip.x - 6, hip.y - 1.5, 12.2, 3.2, 1);
  });
}

function industrialUniform(palette: TeamPalette): string {
  return mix(palette.main, '#5e5a45', 0.5);
}

// ---------------------------------------------------------------------------------------------
// Weapons

function club(brush: Brush, hand: Point, angle: number) {
  // A tapered stick with a rounded end: thin at the grip, heavy at the tip.
  const tip = reach(hand.x, hand.y, angle, 13);
  const back = reach(hand.x, hand.y, angle, -3);
  const normal = { x: Math.cos(angle), y: -Math.sin(angle) };
  const heading = Math.atan2(Math.cos(angle), Math.sin(angle));
  const grip = 1.5;
  const head = 3.5;
  brush.paint(WOOD, (ctx) => {
    ctx.moveTo(back.x + normal.x * grip, back.y + normal.y * grip);
    ctx.lineTo(tip.x + normal.x * head, tip.y + normal.y * head);
    ctx.arc(tip.x, tip.y, head, heading - Math.PI / 2, heading + Math.PI / 2);
    ctx.lineTo(back.x - normal.x * grip, back.y - normal.y * grip);
    ctx.closePath();
  });
  const knot = reach(hand.x, hand.y, angle, 9);
  brush.circle(shade(WOOD, 0.3), knot.x, knot.y, 1, null);
}

function blade(brush: Brush, hand: Point, angle: number, length: number, color = STEEL) {
  const tip = reach(hand.x, hand.y, angle, length);
  const normal = angle + Math.PI / 2;
  const base = reach(hand.x, hand.y, angle, 2.5);
  brush.paint(color, (ctx) => {
    ctx.moveTo(base.x + Math.sin(normal) * 1.8, base.y + Math.cos(normal) * 1.8);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(base.x - Math.sin(normal) * 1.8, base.y - Math.cos(normal) * 1.8);
    ctx.closePath();
  });
  // Crossguard.
  const a = reach(base.x, base.y, normal, 3.5);
  const b = reach(base.x, base.y, normal, -3.5);
  brush.capsule('#8a6a3a', a.x, a.y, b.x, b.y, 1);
}

function roundShield(brush: Brush, x: number, y: number, palette: TeamPalette) {
  brush.circle(BRONZE, x, y, 9.5);
  brush.circle(palette.main, x, y, 7.4, null);
  brush.paint(
    '#f4efe6',
    (ctx) => {
      ctx.moveTo(x - 3.5, y + 3);
      ctx.lineTo(x, y - 4);
      ctx.lineTo(x + 3.5, y + 3);
    },
    { stroke: null },
  );
  brush.line('#f4efe6', 1.5, (ctx) => {
    ctx.moveTo(x - 3.5, y + 3);
    ctx.lineTo(x, y - 4);
    ctx.lineTo(x + 3.5, y + 3);
  });
}

function heaterShield(brush: Brush, x: number, y: number, palette: TeamPalette) {
  brush.paint(palette.main, (ctx) => {
    ctx.moveTo(x - 6, y - 7);
    ctx.lineTo(x + 6, y - 7);
    ctx.lineTo(x + 6, y + 1);
    ctx.quadraticCurveTo(x + 5, y + 7, x, y + 10);
    ctx.quadraticCurveTo(x - 5, y + 7, x - 6, y + 1);
    ctx.closePath();
  });
  brush.line('#f4efe6', 1.8, (ctx) => {
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x, y + 7);
    ctx.moveTo(x - 4, y - 1);
    ctx.lineTo(x + 4, y - 1);
  });
}

function rifle(brush: Brush, hand: Point, angle: number, length: number, { bayonet = false } = {}) {
  const stockEnd = reach(hand.x, hand.y, angle, -7);
  const woodEnd = reach(hand.x, hand.y, angle, length * 0.55);
  const muzzle = reach(hand.x, hand.y, angle, length);
  brush.capsule('#7a4b26', stockEnd.x, stockEnd.y, woodEnd.x, woodEnd.y, 2);
  brush.capsule('#4a4f57', woodEnd.x, woodEnd.y, muzzle.x, muzzle.y, 1.1);
  if (bayonet) {
    const point = reach(muzzle.x, muzzle.y, angle, 7);
    brush.polygon(STEEL, [
      [muzzle.x, muzzle.y - 1],
      [point.x, point.y],
      [muzzle.x, muzzle.y + 1],
    ]);
  }
  return muzzle;
}

export function muzzleFlash(brush: Brush, at: Point, angle: number, color = '#ffe07a') {
  const { ctx } = brush;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(Math.PI / 2 - angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -3.5);
  ctx.lineTo(11, 0);
  ctx.lineTo(0, 3.5);
  ctx.lineTo(3, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff8de';
  ctx.beginPath();
  ctx.arc(1.5, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// The soldiers

type Soldier = (brush: Brush, pose: Pose, palette: TeamPalette) => void;

const brawler: Soldier = (brush, pose, palette) => {
  const outfit: Outfit = {
    shirt: '#9a6a3a',
    pants: '#9a6a3a',
    boots: '#6b4524',
    bareLegs: true,
    head: (b, rig) => {
      hair(HAIR[pose.variant % HAIR.length] ?? HAIR[0])(b, rig);
      headband(b, rig);
      warPaint(b, rig);
    },
    torso: peltSpots,
  };
  person(brush, pose, palette, outfit, (b, rig) => {
    const upper = chop(pose.attack, 1.05);
    const { hand } = arm(b, rig, upper, upper + 0.75, outfit.shirt);
    club(b, hand, upper + 1.35);
  });
};

const slinger: Soldier = (brush, pose, palette) => {
  const outfit: Outfit = {
    shirt: '#b98b56',
    pants: '#b98b56',
    boots: '#6b4524',
    bareLegs: true,
    head: (b, rig) => {
      hair(HAIR[(pose.variant + 2) % HAIR.length] ?? HAIR[0], 'tied')(b, rig);
      headband(b, rig);
    },
    torso: peltSpots,
  };
  person(brush, pose, palette, outfit, (b, rig) => {
    const whirling = pose.attack !== null && pose.attack < 0.45;
    const upper = whirling ? 2.9 : 0.35;
    const { hand } = arm(b, rig, upper, upper + (whirling ? 0.2 : 0.4), outfit.shirt);
    const spin = whirling ? (pose.attack ?? 0) * 26 : 0;
    const end = whirling ? reach(hand.x, hand.y, spin, 9) : reach(hand.x, hand.y, 0.2, 9);
    b.line(LEATHER, 1.1, (ctx) => {
      ctx.moveTo(hand.x, hand.y);
      ctx.lineTo(end.x, end.y);
    });
    if (pose.attack === null || whirling) b.circle('#8d8a86', end.x, end.y, 2);
  });
};

const hoplite: Soldier = (brush, pose, palette) => {
  const outfit: Outfit = {
    shirt: palette.main,
    pants: palette.main,
    boots: LEATHER,
    bareLegs: true,
    head: bronzeHelmet,
    torso: cuirass,
  };
  person(brush, pose, palette, outfit, (b, rig) => {
    const push = thrust(pose.attack);
    const { hand } = arm(b, rig, 1.25 + push * 0.35, 1.75 - push * 0.1, outfit.shirt);
    const angle = 1.62;
    const butt = reach(hand.x, hand.y, angle, -13);
    const tip = reach(hand.x, hand.y, angle, 22);
    b.capsule(WOOD, butt.x, butt.y, tip.x, tip.y, 1);
    b.polygon(BRONZE, [
      [tip.x - 1, tip.y - 2.4],
      [tip.x + 6, tip.y],
      [tip.x - 1, tip.y + 2.4],
    ]);
    roundShield(b, rig.shoulder.x + 4.5, rig.shoulder.y + 9, palette);
  });
};

const archer: Soldier = (brush, pose, palette) => {
  const outfit: Outfit = {
    shirt: '#e6d8b8',
    pants: '#e6d8b8',
    boots: LEATHER,
    bareLegs: true,
    head: (b, rig) => {
      hair(HAIR[(pose.variant + 1) % HAIR.length] ?? HAIR[0])(b, rig);
      clothCap(b, rig);
    },
    torso: sash,
    back: quiver,
  };
  person(
    brush,
    pose,
    palette,
    outfit,
    (b, rig) => {
      const drawn = pose.attack === null ? 1 : Math.min(1, pose.attack * 2.5);
      // The drawing hand, behind the bow.
      const pull = arm(b, rig, 1.4, 1.4 - drawn * 1.9, outfit.shirt);
      const { hand } = arm(b, rig, 1.52, 1.58, outfit.shirt);
      const top = { x: hand.x - 2, y: hand.y - 12 };
      const bottom = { x: hand.x - 2, y: hand.y + 12 };
      b.line(shade(WOOD, 0.1), 2.4, (ctx) => {
        ctx.moveTo(top.x, top.y);
        ctx.quadraticCurveTo(hand.x + 7, hand.y, bottom.x, bottom.y);
      });
      b.line('#efe6d2', 0.7, (ctx) => {
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(pull.hand.x, pull.hand.y);
        ctx.lineTo(bottom.x, bottom.y);
      });
      if (drawn >= 1) {
        b.line('#caa472', 1.2, (ctx) => {
          ctx.moveTo(pull.hand.x, pull.hand.y);
          ctx.lineTo(hand.x + 5, hand.y);
        });
      }
    },
    { backArm: false },
  );
};

const swordsman: Soldier = (brush, pose, palette) => {
  const outfit: Outfit = {
    shirt: '#9aa4ae',
    pants: '#7d8690',
    boots: '#3c3430',
    belt: LEATHER,
    head: kettleHelm,
    torso: tabard,
  };
  person(brush, pose, palette, outfit, (b, rig) => {
    heaterShield(b, rig.shoulder.x + 5.5, rig.shoulder.y + 8.5, palette);
    const upper = chop(pose.attack, 0.9, 2.9, 0.6);
    const { hand } = arm(b, rig, upper, upper + 0.6, outfit.shirt);
    blade(b, hand, upper + 1.4, 17);
  });
};

const crossbowman: Soldier = (brush, pose, palette) => {
  const outfit: Outfit = {
    shirt: '#c7b184',
    pants: '#6d5a44',
    boots: '#3c3430',
    belt: LEATHER,
    head: sallet,
    torso: tabard,
  };
  person(brush, pose, palette, outfit, (b, rig) => {
    const recoil = kick(pose.attack) * 2;
    const { hand } = arm(b, rig, 1.1, 1.72, outfit.shirt);
    const angle = 1.62;
    const back = reach(hand.x - recoil, hand.y, angle, -6);
    const front = reach(hand.x - recoil, hand.y, angle, 13);
    b.capsule(WOOD, back.x, back.y, front.x, front.y, 1.6);
    b.line('#4a4f57', 2.2, (ctx) => {
      ctx.moveTo(front.x - 2, front.y - 8);
      ctx.quadraticCurveTo(front.x + 3, front.y, front.x - 2, front.y + 8);
    });
    if (pose.attack === null || pose.attack > 0.6) {
      b.line('#8a6a3a', 1.4, (ctx) => {
        ctx.moveTo(hand.x, hand.y - 1);
        ctx.lineTo(front.x + 2, front.y - 1);
      });
    }
  });
};

const trooper: Soldier = (brush, pose, palette) => {
  const uniform = industrialUniform(palette);
  const outfit: Outfit = {
    shirt: uniform,
    pants: shade(uniform, 0.1),
    boots: '#2a2522',
    belt: '#6b4a2a',
    head: brodieHelmet,
  };
  person(brush, pose, palette, outfit, (b, rig) => {
    const push = thrust(pose.attack);
    const { hand } = arm(b, rig, 0.95 + push * 0.4, 1.7, outfit.shirt);
    rifle(b, { x: hand.x + push * 4, y: hand.y }, 1.75, 20, { bayonet: true });
  });
};

const marksman: Soldier = (brush, pose, palette) => {
  const uniform = industrialUniform(palette);
  const outfit: Outfit = {
    shirt: uniform,
    pants: shade(uniform, 0.1),
    boots: '#2a2522',
    belt: '#6b4a2a',
    head: peakedCap,
  };
  person(brush, pose, palette, outfit, (b, rig) => {
    const recoil = kick(pose.attack) * 2.5;
    const { hand } = arm(b, rig, 1.35, 1.62, outfit.shirt);
    const angle = 1.6;
    const muzzle = rifle(b, { x: hand.x - recoil, y: hand.y - 1 }, angle, 24);
    if (pose.attack !== null && pose.attack < 0.12) muzzleFlash(b, muzzle, angle);
  });
};

const plasmaTrooper: Soldier = (brush, pose, palette) => {
  const outfit: Outfit = {
    shirt: '#e8edf3',
    pants: '#4b5563',
    boots: '#e8edf3',
    head: visorHelmet,
    torso: armorStripes,
  };
  person(brush, pose, palette, outfit, (b, rig) => {
    const recoil = kick(pose.attack) * 2;
    const { hand } = arm(b, rig, 1.25, 1.65, outfit.shirt);
    const angle = 1.6;
    const back = reach(hand.x - recoil, hand.y, angle, -6);
    const front = reach(hand.x - recoil, hand.y, angle, 14);
    b.paint('#d5dce6', (ctx) => {
      ctx.save();
      ctx.translate((back.x + front.x) / 2, (back.y + front.y) / 2);
      ctx.rotate(Math.PI / 2 - angle);
      ctx.roundRect(-10, -3.2, 20, 6.4, 2.5);
      ctx.restore();
    });
    b.circle(palette.glow, (back.x + front.x) / 2 - 1, (back.y + front.y) / 2, 1.8);
    const muzzle = reach(front.x, front.y, angle, 3);
    b.capsule('#6b7280', front.x, front.y, muzzle.x, muzzle.y, 1.3);
    if (pose.attack !== null && pose.attack < 0.14) muzzleFlash(b, muzzle, angle, palette.glow);
  });
};

/** The future's melee unit is a hovering drone with an energy blade, not a person. */
const bladeDrone: Soldier = (brush, pose, palette) => {
  const hover = -27 + Math.sin(pose.time * 4) * 2;
  const { ctx } = brush;
  // Thruster flame.
  const flicker = 6 + Math.sin(pose.time * 38) * 1.8;
  ctx.fillStyle = mix(palette.glow, '#ffffff', 0.35);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(-4, hover + 9);
  ctx.quadraticCurveTo(0, hover + 9 + flicker * 2, 4, hover + 9);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  // Body.
  brush.paint('#e3e9f0', (c) => {
    c.ellipse(0, hover, 11, 9, 0, 0, Math.PI * 2);
  });
  brush.paint(
    '#b9c3cf',
    (c) => {
      c.ellipse(-1, hover + 4.5, 9, 3.4, 0, 0, Math.PI);
    },
    { stroke: null },
  );
  brush.paint(palette.main, (c) => {
    c.roundRect(-10, hover - 2, 5, 6, 2);
  });
  // Eye.
  brush.circle(INK, 5, hover - 1.5, 3.4);
  brush.circle(palette.glow, 5.8, hover - 1.8, 1.8, null);
  // Blade arm.
  const angle = chop(pose.attack, 1.9, 3, 0.9);
  const root = { x: 7, y: hover + 3 };
  const tip = reach(root.x, root.y, angle, 20);
  ctx.save();
  ctx.globalAlpha = 0.35;
  brush.line(palette.glow, 6, (c) => {
    c.moveTo(root.x, root.y);
    c.lineTo(tip.x, tip.y);
  });
  ctx.restore();
  brush.line(mix(palette.glow, '#ffffff', 0.55), 2.2, (c) => {
    c.moveTo(root.x, root.y);
    c.lineTo(tip.x, tip.y);
  });
  brush.circle('#6b7280', root.x, root.y, 2.2);
};

export const SOLDIERS: Record<string, Soldier> = {
  'stone-melee': brawler,
  'stone-ranged': slinger,
  'bronze-melee': hoplite,
  'bronze-ranged': archer,
  'medieval-melee': swordsman,
  'medieval-ranged': crossbowman,
  'industrial-melee': trooper,
  'industrial-ranged': marksman,
  'future-melee': bladeDrone,
  'future-ranged': plasmaTrooper,
};

export { hair, headband, kettleHelm, bronzeHelmet, clothCap, WOOD, STEEL, BRONZE, LEATHER, HAIR };
export { club, blade, heaterShield, roundShield, rifle };
