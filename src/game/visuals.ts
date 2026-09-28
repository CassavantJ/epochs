import { KILL_GOLD, type ProjectileKind, type UnitType } from './data';
import { TEAM_COLORS } from './draw';
import { WORLD, type GameEvent, type GameState, type Team } from './sim';

/** Short-lived effects that exist only on screen: sparks, blasts, falling units, gold popups. */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
}

interface Ring {
  x: number;
  y: number;
  radius: number;
  life: number;
  max: number;
  color: string;
}

export interface Corpse {
  x: number;
  team: Team;
  type: UnitType;
  age: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
}

const CORPSE_S = 1.1;
const BLAST_KINDS: readonly ProjectileKind[] = ['boulder', 'shell', 'fireball', 'plasma', 'laser'];
const IMPACT_COLORS: Partial<Record<ProjectileKind, string>> = {
  fireball: '#ffb46b',
  plasma: '#9dffe0',
  laser: '#e8fbff',
  shell: '#ffe2b0',
};

export class Visuals {
  particles: Particle[] = [];
  rings: Ring[] = [];
  corpses: Corpse[] = [];
  texts: FloatingText[] = [];
  /** Screen shake strength, in world units; decays. */
  shake = 0;
  /** 0–1 white flash over everything; decays. */
  flash = 0;
  /** Where each projectile was last frame, to point arrows along their flight. */
  previous = new Map<number, { x: number; y: number }>();
  reducedMotion = false;
  #random = 0.5;

  #rand(): number {
    // Visual-only randomness; kept out of the game's seeded generator so it can't change play.
    this.#random = (this.#random * 9301 + 49297) % 233280;
    return this.#random / 233280;
  }

  #burst(x: number, y: number, count: number, color: string, speed: number, gravity = 300) {
    const scaled = this.reducedMotion ? Math.ceil(count / 2) : count;
    for (let index = 0; index < scaled; index++) {
      const angle = this.#rand() * Math.PI * 2;
      const velocity = speed * (0.4 + this.#rand() * 0.6);
      const life = 0.3 + this.#rand() * 0.35;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - speed * 0.4,
        life,
        max: life,
        size: 1.2 + this.#rand() * 1.8,
        color,
        gravity,
      });
    }
  }

  ingest(events: readonly GameEvent[], state: GameState): void {
    for (const event of events) {
      switch (event.kind) {
        case 'spawn':
          this.#burst(event.x, WORLD.ground - 4, 5, 'rgba(255, 255, 255, 0.5)', 50, 80);
          break;
        case 'melee':
          this.#burst(event.x, event.y, 4, TEAM_COLORS[event.team].line, 120);
          break;
        case 'impact': {
          const color = IMPACT_COLORS[event.projectile] ?? TEAM_COLORS[event.team].line;
          if (event.splash > 0 || BLAST_KINDS.includes(event.projectile)) {
            const radius = Math.max(event.splash, 14);
            this.rings.push({ x: event.x, y: event.y, radius, life: 0.4, max: 0.4, color });
            this.#burst(event.x, event.y, 9, color, 170);
          } else {
            this.#burst(event.x, event.y, 3, color, 90);
          }
          break;
        }
        case 'death':
          this.corpses.push({ x: event.x, team: event.team, type: event.unit, age: 0 });
          if (event.team === 1) {
            const gold = Math.round(event.unit.cost * KILL_GOLD * state.sides[0].income);
            this.texts.push({
              x: event.x,
              y: WORLD.ground - event.unit.height - 16,
              text: `+${gold}`,
              life: 1,
            });
          }
          break;
        case 'baseHit':
          if (event.team === 0 && !this.reducedMotion) this.shake = Math.max(this.shake, 2.5);
          break;
        case 'special':
          if (!this.reducedMotion) {
            this.flash = Math.max(this.flash, 0.25);
            this.shake = Math.max(this.shake, 6);
          }
          break;
        case 'advance':
          if (!this.reducedMotion) this.flash = Math.max(this.flash, 0.35);
          break;
        default:
          break;
      }
    }
  }

  update(dt: number): void {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y = Math.min(particle.y + particle.vy * dt, WORLD.ground);
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
    for (const ring of this.rings) ring.life -= dt;
    this.rings = this.rings.filter((ring) => ring.life > 0);
    for (const corpse of this.corpses) corpse.age += dt;
    this.corpses = this.corpses.filter((corpse) => corpse.age < CORPSE_S);
    for (const text of this.texts) {
      text.life -= dt;
      text.y -= 28 * dt;
    }
    this.texts = this.texts.filter((text) => text.life > 0);
    this.shake = Math.max(0, this.shake - dt * 18);
    this.flash = Math.max(0, this.flash - dt * 1.4);
  }

  static readonly CORPSE_S = CORPSE_S;
}
