import { Brain, DIFFICULTIES, type DifficultyId } from './ai';
import { GameAudio, type SoundName } from './audio';
import { CRUMBLE_START, era, OVERTIME_START, type ProjectileKind, type Role } from './data';
import {
  advance,
  baseFront,
  buildTurret,
  buySlot,
  canAdvance,
  cancelOrder,
  createGame,
  launchSpecial,
  slotCost,
  step,
  STEP,
  train,
  turretPlan,
  type GameEvent,
  type GameState,
  type Team,
  type TurretPlan,
} from './sim';
import { Visuals } from './visuals';
import { clampCamera, type View } from './view';

export interface Hud {
  time: number;
  gold: number;
  xp: number;
  xpNeeded: number | null;
  era: number;
  enemyEra: number;
  base: [number, number];
  baseMax: [number, number];
  queue: { name: string; progress: number }[];
  turret: TurretPlan;
  slotCost: number | null;
  specialLeft: number;
  specialTotal: number;
  specialActive: boolean;
  canAdvance: boolean;
  phase: 'normal' | 'overtime' | 'sudden-death';
  winner: Team | null;
  paused: boolean;
  speed: 1 | 2;
  sound: boolean;
}

const HUD_EVERY_S = 0.1;
const FOLLOW_PAUSE_S = 5;
/** Longest frame caught up on, so a stalled tab doesn't fast-forward the war. */
const MAX_FRAME_S = 0.1;

const SHOT_SOUNDS: Record<ProjectileKind, SoundName> = {
  stone: 'whoosh',
  boulder: 'whoosh',
  arrow: 'whoosh',
  bolt: 'whoosh',
  fireball: 'whoosh',
  bullet: 'gun',
  shell: 'gun',
  plasma: 'energy',
  laser: 'energy',
};

/**
 * One game: the simulation, the opponent, effects, sound and camera. The Game component feeds it
 * frames and input and draws from it; the HUD reads a snapshot refreshed ten times a second.
 */
export class EpochsGame {
  readonly state: GameState;
  readonly difficulty: DifficultyId;
  readonly visuals = new Visuals();
  readonly audio: GameAudio;
  camera = 0;
  view: View | null = null;
  paused = false;
  speed: 1 | 2 = 1;
  /** Called with things worth saying out loud (era changes, attacks, the result). */
  announce: (message: string) => void = () => undefined;

  #brain: Brain;
  #accumulator = 0;
  #hudAge = 0;
  #followAfter = 0;
  #lastAttackNotice = -Infinity;
  #listeners = new Set<() => void>();
  #hud: Hud;

  constructor({
    difficulty,
    seed,
    sound,
  }: {
    difficulty: DifficultyId;
    seed: number;
    sound: boolean;
  }) {
    const settings = DIFFICULTIES[difficulty];
    this.difficulty = difficulty;
    this.state = createGame({ seed, income: [1, settings.income] });
    this.#brain = new Brain(1, settings);
    this.audio = new GameAudio(sound);
    this.#hud = this.#makeHud();
  }

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  getSnapshot = () => this.#hud;

  setAnnouncer(announce: (message: string) => void): void {
    this.announce = announce;
  }

  setReducedMotion(reduced: boolean): void {
    this.visuals.reducedMotion = reduced;
  }

  /** A new canvas size: keeps the camera within the lane. */
  setView(view: View): void {
    this.view = view;
    this.camera = clampCamera(view, this.camera);
  }

  get over(): boolean {
    return this.state.winner !== null;
  }

  #emit(): void {
    this.#hud = this.#makeHud();
    this.#hudAge = 0;
    for (const listener of this.#listeners) listener();
  }

  /** Advances by a frame of wall time and processes what happened. */
  frame(seconds: number): void {
    const elapsed = Math.min(seconds, MAX_FRAME_S);
    const { state } = this;
    if (!this.paused && state.winner === null) {
      this.#accumulator += elapsed * this.speed;
      const before = state.time;
      // A call, not the field, so the check re-reads what the step just changed.
      while (this.#accumulator >= STEP && !this.over) {
        this.#brain.update(state);
        step(state);
        this.#accumulator -= STEP;
      }
      if (before < OVERTIME_START && state.time >= OVERTIME_START) {
        this.announce('Overtime: units hit harder every minute.');
      }
      if (before < CRUMBLE_START && state.time >= CRUMBLE_START) {
        this.announce('Sudden death: both bases are crumbling.');
      }
    }
    const events = state.events;
    state.events = [];
    this.visuals.ingest(events, state);
    this.#react(events);
    if (!this.paused) this.visuals.update(elapsed * this.speed);
    this.#followBattle(elapsed);

    this.#hudAge += elapsed;
    if (this.#hudAge >= HUD_EVERY_S || events.some((event) => event.kind === 'end')) this.#emit();
  }

  #pan(x: number): number {
    const view = this.view;
    if (!view) return 0;
    return ((x - this.camera) / view.span) * 2 - 1;
  }

  #react(events: readonly GameEvent[]): void {
    const play = (name: SoundName, x: number, volume = 1) => {
      const pan = this.#pan(x);
      // Offscreen sounds are quieter.
      this.audio.play(name, { pan, volume: Math.abs(pan) > 1 ? volume * 0.5 : volume });
    };
    for (const event of events) {
      switch (event.kind) {
        case 'spawn':
          play('spawn', event.x, event.team === 0 ? 1 : 0.5);
          break;
        case 'melee':
          play('melee', event.x);
          break;
        case 'shot':
          play(SHOT_SOUNDS[event.projectile], event.x, 0.8);
          break;
        case 'impact':
          play(event.splash > 0 ? 'boom' : 'thud', event.x, event.splash > 0 ? 0.8 : 0.5);
          break;
        case 'death':
          play('death', event.x);
          break;
        case 'baseHit':
          if (event.team === 0 && this.state.time - this.#lastAttackNotice > 25) {
            this.#lastAttackNotice = this.state.time;
            this.announce('Your base is under attack.');
          }
          break;
        case 'special':
          play('special', baseFront(event.team));
          if (event.team === 1) this.announce(`The enemy called ${event.special.name}.`);
          break;
        case 'advance': {
          const name = era(event.era).name;
          play('advance', baseFront(event.team), event.team === 0 ? 1 : 0.5);
          this.announce(
            event.team === 0
              ? `You advanced to the ${name}.`
              : `The enemy advanced to the ${name}.`,
          );
          break;
        }
        case 'end':
          this.audio.play(event.winner === 0 ? 'victory' : 'defeat');
          this.announce(
            event.winner === 0
              ? 'Victory! The enemy base has fallen.'
              : 'Defeat. Your base has fallen.',
          );
          break;
        default:
          break;
      }
    }
  }

  /** Keeps the camera on the fighting, unless the player has panned by hand recently. */
  #followBattle(seconds: number): void {
    const view = this.view;
    if (!view?.pans || performance.now() < this.#followAfter) return;
    const { units } = this.state;
    const ours = units.filter((unit) => unit.team === 0).map((unit) => unit.x);
    const theirs = units.filter((unit) => unit.team === 1).map((unit) => unit.x);
    const front = ours.length > 0 ? Math.max(...ours) : baseFront(0) + 150;
    const enemy = theirs.length > 0 ? Math.min(...theirs) : front + 300;
    const focus = (front + Math.min(enemy, front + 400)) / 2;
    const target = clampCamera(view, focus - view.span / 2);
    this.camera += (target - this.camera) * Math.min(1, seconds * 2.5);
  }

  /** Manual panning: holds the camera there for a few seconds. */
  panTo(camera: number): void {
    if (!this.view) return;
    this.camera = clampCamera(this.view, camera);
    this.#followAfter = performance.now() + FOLLOW_PAUSE_S * 1000;
  }

  // Player commands. Each clicks on success and buzzes when it can't happen.

  #command(done: boolean): boolean {
    this.audio.unlock();
    this.audio.play(done ? 'click' : 'denied');
    this.#emit();
    return done;
  }

  train(role: Role): boolean {
    return this.#command(train(this.state, 0, role));
  }

  cancel(index: number): boolean {
    return this.#command(cancelOrder(this.state, 0, index));
  }

  turret(): boolean {
    return this.#command(buildTurret(this.state, 0));
  }

  slot(): boolean {
    return this.#command(buySlot(this.state, 0));
  }

  special(): boolean {
    return this.#command(launchSpecial(this.state, 0));
  }

  advance(): boolean {
    return this.#command(advance(this.state, 0));
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.audio.suspend();
    else this.audio.resume();
    this.#emit();
  }

  toggleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : 1;
    this.#emit();
  }

  setSound(enabled: boolean): void {
    this.audio.setEnabled(enabled);
    this.#emit();
  }

  dispose(): void {
    this.audio.close();
    this.#listeners.clear();
  }

  #makeHud(): Hud {
    const { state } = this;
    const [you, enemy] = state.sides;
    const current = era(you.era);
    const phase =
      state.time >= CRUMBLE_START
        ? 'sudden-death'
        : state.time >= OVERTIME_START
          ? 'overtime'
          : 'normal';
    return {
      time: state.time,
      gold: Math.floor(you.gold),
      xp: Math.floor(you.xp),
      xpNeeded: current.xpToAdvance,
      era: you.era,
      enemyEra: enemy.era,
      base: [you.baseHp, enemy.baseHp],
      baseMax: [you.baseMax, enemy.baseMax],
      queue: you.queue.map((order) => ({
        name: order.type.name,
        progress: order.progress / order.type.trainTime,
      })),
      turret: turretPlan(state, 0),
      slotCost: slotCost(state, 0),
      specialLeft: you.specialCooldown,
      specialTotal: current.special.cooldown,
      specialActive: you.special !== null,
      canAdvance: canAdvance(state, 0),
      phase,
      winner: state.winner,
      paused: this.paused,
      speed: this.speed,
      sound: this.audio.enabled,
    };
  }
}
