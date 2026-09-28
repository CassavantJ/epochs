import { TEAM_PALETTES } from './art';
import { KILL_GOLD, type ProjectileKind, type UnitType } from './data';
import { WORLD, type GameEvent, type GameState, type Team, type Unit } from './sim';

/** Short-lived effects that exist only on screen: sparks, dust, blasts, falling units, popups. */

type ParticleKind = 'spark' | 'dust' | 'fire' | 'smoke';

interface Particle {
  kind: ParticleKind;
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
  id: number;
  age: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
}

interface Burst {
  speed: number;
  colors: readonly string[];
  size: number;
  life: number;
  gravity: number;
  rise?: number;
}

const CORPSE_S = 1.2;
const HIT_FLASH_S = 0.14;
/** Shots that explode on impact; others with splash (a rain of arrows) just kick up dust. */
const BLASTS: readonly ProjectileKind[] = ['boulder', 'shell', 'fireball'];
const FIRE_COLORS = ['#ffd45c', '#ff9b3d', '#ff6b2f'] as const;
const SPARKS = ['#fff6c9', '#ffd45c', '#ffffff'] as const;

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
  #hitAt = new Map<number, number>();
  #hp = new Map<number, number>();
  #random = 0.5;

  #rand(): number {
    // Visual-only randomness, kept out of the game's seeded generator so it can't change play.
    this.#random = (this.#random * 9301 + 49297) % 233280;
    return this.#random / 233280;
  }

  #emit(kind: ParticleKind, x: number, y: number, count: number, burst: Burst) {
    const scaled = this.reducedMotion ? Math.ceil(count / 2) : count;
    for (let index = 0; index < scaled; index++) {
      const angle = this.#rand() * Math.PI * 2;
      const velocity = burst.speed * (0.35 + this.#rand() * 0.65);
      const lifetime = burst.life * (0.6 + this.#rand() * 0.6);
      this.particles.push({
        kind,
        x: x + (this.#rand() - 0.5) * 6,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity * 0.6 - (burst.rise ?? 0),
        life: lifetime,
        max: lifetime,
        size: burst.size * (0.6 + this.#rand() * 0.8),
        color: burst.colors[Math.floor(this.#rand() * burst.colors.length)] ?? '#ffffff',
        gravity: burst.gravity,
      });
    }
  }

  #dust(x: number, y: number, count: number) {
    this.#emit('dust', x, y, count, {
      speed: 30,
      colors: ['#c9b9a0', '#a8977f', '#d9ccb8'],
      size: 5,
      life: 0.6,
      gravity: -10,
      rise: 12,
    });
  }

  #explosion(x: number, y: number, radius: number) {
    this.rings.push({ x, y, radius, life: 0.35, max: 0.35, color: '#ffd45c' });
    this.#emit('fire', x, y, 10, {
      speed: 150,
      colors: FIRE_COLORS,
      size: 5,
      life: 0.35,
      gravity: -60,
    });
    this.#emit('smoke', x, y, 6, {
      speed: 40,
      colors: ['#9a918a', '#b3aba4', '#857d78'],
      size: 7,
      life: 0.9,
      gravity: -30,
      rise: 20,
    });
  }

  ingest(events: readonly GameEvent[], state: GameState): void {
    for (const event of events) {
      switch (event.kind) {
        case 'spawn':
          this.#dust(event.x, WORLD.ground - 2, 5);
          break;
        case 'melee':
          this.#emit('spark', event.x, event.y, 5, {
            speed: 140,
            colors: SPARKS,
            size: 2,
            life: 0.25,
            gravity: 400,
          });
          break;
        case 'impact':
          this.#impact(event);
          break;
        case 'death':
          this.corpses.push({
            x: event.x,
            team: event.team,
            type: event.unit,
            id: event.id,
            age: 0,
          });
          this.#dust(event.x, WORLD.ground - 3, 6);
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

  #impact(event: Extract<GameEvent, { kind: 'impact' }>) {
    const { x, y, projectile, splash } = event;
    if (projectile === 'plasma' || projectile === 'laser') {
      const glow = TEAM_PALETTES[event.team].glow;
      this.rings.push({ x, y, radius: Math.max(splash, 14), life: 0.3, max: 0.3, color: glow });
      this.#emit('spark', x, y, 8, {
        speed: 160,
        colors: [glow, '#ffffff'],
        size: 2.2,
        life: 0.3,
        gravity: 200,
      });
    } else if (BLASTS.includes(projectile)) {
      this.#explosion(x, y, Math.max(splash, 16));
    } else if (splash > 0) {
      this.#dust(x, WORLD.ground - 2, 4);
    } else if (y >= WORLD.ground - 8) {
      this.#dust(x, WORLD.ground - 2, 3);
    } else {
      this.#emit('spark', x, y, 3, {
        speed: 90,
        colors: SPARKS,
        size: 1.6,
        life: 0.2,
        gravity: 300,
      });
    }
  }

  /** Notes which units lost health since last frame, for their hit flash. */
  trackHits(units: readonly Unit[], time: number): void {
    const alive = new Set<number>();
    for (const unit of units) {
      alive.add(unit.id);
      const before = this.#hp.get(unit.id);
      if (before !== undefined && unit.hp < before) this.#hitAt.set(unit.id, time);
      this.#hp.set(unit.id, unit.hp);
    }
    for (const id of this.#hp.keys()) {
      if (!alive.has(id)) {
        this.#hp.delete(id);
        this.#hitAt.delete(id);
      }
    }
  }

  /** 0–1: how freshly a unit was hit. */
  hitFlash(id: number, time: number): number {
    const at = this.#hitAt.get(id);
    return at === undefined ? 0 : Math.max(0, 1 - (time - at) / HIT_FLASH_S);
  }

  update(dt: number): void {
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.vy += particle.gravity * dt;
      const soft = particle.kind === 'smoke' || particle.kind === 'dust';
      if (soft) {
        particle.vx *= 0.96;
        particle.size += dt * 10;
      }
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
